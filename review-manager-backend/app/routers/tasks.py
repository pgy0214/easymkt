from typing import Optional

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app import crud, importers, schemas
from app.crawlers import kakao_blind_check, naver_blind_check
from app.database import get_db

router = APIRouter(prefix="/api/tasks", tags=["tasks"])


@router.get("", response_model=list[schemas.TaskOut])
def list_tasks(
    reviewer_id: Optional[int] = None,
    account_id: Optional[int] = None,
    platform: Optional[str] = None,
    status: Optional[str] = None,
    blind_status: Optional[str] = None,
    settlement_status: Optional[str] = None,
    reviewer_category: Optional[str] = None,
    created_from: Optional[str] = None,
    created_to: Optional[str] = None,
    sort: Optional[str] = None,
    db: Session = Depends(get_db),
):
    tasks = crud.get_tasks(
        db,
        reviewer_id=reviewer_id,
        account_id=account_id,
        platform=platform,
        status=status,
        blind_status=blind_status,
        settlement_status=settlement_status,
        reviewer_category=reviewer_category,
        created_from=created_from,
        created_to=created_to,
        sort=sort,
    )
    return [crud.task_to_out(db, t) for t in tasks]


@router.get("/{task_id}", response_model=schemas.TaskOut)
def get_task(task_id: int, db: Session = Depends(get_db)):
    task = crud.get_task(db, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="작업을 찾을 수 없습니다")
    return crud.task_to_out(db, task)


@router.patch("/{task_id}/result", response_model=schemas.TaskOut)
def update_result(
    task_id: int, data: schemas.TaskResultUpdate, db: Session = Depends(get_db)
):
    task = crud.get_task(db, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="작업을 찾을 수 없습니다")
    task = crud.update_task_result(db, task, data.result_link)
    return crud.task_to_out(db, task)


@router.patch("/{task_id}/settlement", response_model=schemas.TaskOut)
def update_settlement(
    task_id: int, data: schemas.TaskSettlementUpdate, db: Session = Depends(get_db)
):
    task = crud.get_task(db, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="작업을 찾을 수 없습니다")
    task = crud.update_task_settlement(db, task, data)
    return crud.task_to_out(db, task)


@router.post("/{task_id}/assign", response_model=schemas.TaskOut)
def assign_task(task_id: int, data: schemas.TaskAssignIn, db: Session = Depends(get_db)):
    """관리자가 리뷰어를 직접 골라 오픈풀 작업을 배정 (개별연락 후 배정) —
    포털 셀프클레임과 동일한 검증(플랫폼 일치, 쿨다운)을 그대로 재사용한다."""
    task = crud.get_task(db, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="작업을 찾을 수 없습니다")
    account = crud.get_account(db, data.account_id)
    if not account:
        raise HTTPException(status_code=404, detail="계정을 찾을 수 없습니다")
    try:
        return crud.task_to_out(db, crud.claim_task(db, task, account))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{task_id}/recheck-blind", response_model=schemas.TaskOut)
def recheck_blind(task_id: int, db: Session = Depends(get_db)):
    task = crud.get_task(db, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="작업을 찾을 수 없습니다")
    if task.status != "completed":
        raise HTTPException(status_code=400, detail="완료되지 않은 작업은 블라인드 확인할 수 없습니다")

    if task.platform == "naver":
        naver_blind_check.recheck_task(db, task)
    else:
        kakao_blind_check.recheck_task(db, task)

    db.refresh(task)
    return crud.task_to_out(db, task)


@router.post("/blind-check/bulk", response_model=list[schemas.BlindBulkCheckRowOut])
async def bulk_blind_check(file: UploadFile = File(...)):
    """이 프로그램에서 만든 캠페인(Task)과 무관한, 과거/외부 캠페인의 리뷰를 엑셀
    업로드로 한꺼번에 확인한다. 행마다 {매장URL, 마이플레이스링크}가 필요 —
    마이플레이스 링크에 박힌 사용자 id로 그 매장의 현재 리뷰 목록을 대조해
    노출/블라인드 여부를 판정한다(닉네임은 바뀔 수 있어 매칭에 쓰지 않는다)."""
    content = await file.read()
    rows = importers.parse_blind_check_rows(content, file.filename or "upload.xlsx")
    if not rows:
        raise HTTPException(
            status_code=400, detail="매장URL/마이플레이스링크 컬럼이 모두 채워진 행이 없습니다"
        )

    store_profile_ids: dict[str, set[str] | None] = {}
    results: list[schemas.BlindBulkCheckRowOut] = []
    for idx, row in enumerate(rows):
        store_url = row["store_url"]
        profile_url = row["profile_url"]
        note = row["note"]

        if store_url not in store_profile_ids:
            try:
                store_profile_ids[store_url] = naver_blind_check.scrape_store_review_profile_ids(store_url)
            except Exception as e:
                store_profile_ids[store_url] = None
                naver_blind_check.logger.exception("블라인드 일괄확인 매장 스크래핑 실패: %s", store_url)

        profile_ids = store_profile_ids[store_url]
        profile_id = naver_blind_check.extract_profile_id(profile_url)

        if profile_ids is None:
            results.append(
                schemas.BlindBulkCheckRowOut(
                    row_index=idx, store_url=store_url, profile_url=profile_url, note=note,
                    error="매장 리뷰 목록을 가져오지 못했습니다",
                )
            )
        elif not profile_id:
            results.append(
                schemas.BlindBulkCheckRowOut(
                    row_index=idx, store_url=store_url, profile_url=profile_url, note=note,
                    error="마이플레이스 링크에서 사용자 id를 찾지 못했습니다",
                )
            )
        else:
            results.append(
                schemas.BlindBulkCheckRowOut(
                    row_index=idx, store_url=store_url, profile_url=profile_url, note=note,
                    is_blinded=profile_id not in profile_ids,
                )
            )
    return results
