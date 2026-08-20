import threading
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app import crud, importers, schemas
from app.crawlers import kakao_blind_check, naver_blind_check
from app.database import get_db

router = APIRouter(prefix="/api/tasks", tags=["tasks"])


@router.post("/{task_id}/receipt-image", response_model=schemas.TaskOut)
async def upload_task_receipt_image(
    task_id: int, file: UploadFile = File(...), db: Session = Depends(get_db)
):
    """로컬에서 만든 영수증 이미지를 수동으로 이 작업에 붙인다(크롬/폰트가 없는
    클라우드 배포판에서 자동 생성이 안 되는 것의 대안)."""
    task = crud.get_task(db, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="작업을 찾을 수 없습니다")
    content = await file.read()
    try:
        crud.save_task_receipt_image(db, task, content, file.filename or "receipt.jpg")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return crud.task_to_out(db, task)

# 블라인드 일괄확인은 Selenium을 순차로 여러 번 띄우는 오래 걸리는 작업이라
# 요청-응답 안에서 처리하면(이전 방식) 서버가 이벤트루프를 붙잡아 로그인 등 다른
# API까지 전부 막아버린다. 그래서 별도 스레드에서 돌리고, job_id로 진행 상황을
# 폴링/중단할 수 있게 메모리에 상태를 들고 있는다. 서버 재시작 시 사라져도
# 무방한 일회성 조회 작업이라 DB에 영속화하지 않는다.
_blind_bulk_jobs: dict[str, dict] = {}


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


def _run_blind_bulk_job(
    job_id: str, rows: list[dict], store_url: str, store_name: str, headless: bool | None
) -> None:
    job = _blind_bulk_jobs[job_id]
    cancel_event: threading.Event = job["cancel_event"]

    store_error: str | None = None
    profile_dates: dict[str, object] | None = None
    try:
        profile_dates = naver_blind_check.scrape_store_review_profile_ids(
            store_url, cancel_event=cancel_event, headless=headless
        )
    except Exception as e:
        store_error = str(e) or "매장 리뷰 목록을 가져오지 못했습니다"
        naver_blind_check.logger.exception("블라인드 일괄확인 매장 스크래핑 실패: %s", store_url)

    for idx, row in enumerate(rows):
        if cancel_event.is_set():
            break

        profile_url = row["profile_url"]
        note = row["note"]
        profile_id = naver_blind_check.extract_profile_id(profile_url)

        if profile_dates is None:
            row_out = schemas.BlindBulkCheckRowOut(
                row_index=idx, store_name=store_name, store_url=store_url,
                profile_url=profile_url, note=note, error=store_error,
            )
        elif not profile_id:
            row_out = schemas.BlindBulkCheckRowOut(
                row_index=idx, store_name=store_name, store_url=store_url,
                profile_url=profile_url, note=note,
                error="마이플레이스 링크에서 사용자 id를 찾지 못했습니다",
            )
        else:
            found_date = profile_dates.get(profile_id)
            row_out = schemas.BlindBulkCheckRowOut(
                row_index=idx, store_name=store_name, store_url=store_url,
                profile_url=profile_url, note=note,
                is_blinded=found_date is None,
                review_date=found_date.isoformat() if found_date else None,
            )
        job["results"].append(row_out)
        job["processed"] = idx + 1

    job["status"] = "cancelled" if cancel_event.is_set() else "done"


@router.post("/blind-check/bulk/start", response_model=schemas.BlindBulkCheckStartOut)
async def start_bulk_blind_check(
    file: UploadFile = File(...),
    store_id: int = Form(...),
    live_view: bool = Form(False),
    db: Session = Depends(get_db),
):
    """이 프로그램에서 만든 캠페인(Task)과 무관한, 과거/외부 캠페인의 리뷰를 엑셀
    업로드로 한꺼번에 확인한다. 매장은 드롭다운으로 한 번만 고르고, 파일에는
    마이플레이스링크만 있으면 된다 — 그 매장의 현재 리뷰 목록을 딱 한 번 긁어서
    각 링크의 사용자 id가 그 안에 있는지로 노출/블라인드를 판정한다(닉네임은
    바뀔 수 있어 매칭에 쓰지 않는다). live_view=True면 헤드리스를 끄고 실제
    크롬 창을 띄워 확인 과정을 눈으로 볼 수 있다. 실제 확인은 백그라운드
    스레드에서 진행되고, 이 요청은 job_id만 즉시 반환한다."""
    store = crud.get_store(db, store_id)
    if not store:
        raise HTTPException(status_code=404, detail="매장을 찾을 수 없습니다")

    content = await file.read()
    rows = importers.parse_blind_check_rows(content, file.filename or "upload.xlsx")
    if not rows:
        raise HTTPException(status_code=400, detail="마이플레이스링크 컬럼이 채워진 행이 없습니다")

    job_id = uuid.uuid4().hex
    _blind_bulk_jobs[job_id] = {
        "status": "running",
        "total": len(rows),
        "processed": 0,
        "results": [],
        "cancel_event": threading.Event(),
    }
    threading.Thread(
        target=_run_blind_bulk_job,
        args=(job_id, rows, store.url, store.name, not live_view),
        daemon=True,
    ).start()
    return schemas.BlindBulkCheckStartOut(job_id=job_id, total=len(rows))


@router.get("/blind-check/bulk/{job_id}", response_model=schemas.BlindBulkCheckJobOut)
async def get_bulk_blind_check(job_id: str):
    job = _blind_bulk_jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="작업을 찾을 수 없습니다")
    return schemas.BlindBulkCheckJobOut(
        job_id=job_id,
        status=job["status"],
        total=job["total"],
        processed=job["processed"],
        results=job["results"],
    )


@router.post("/blind-check/bulk/{job_id}/cancel", response_model=schemas.BlindBulkCheckJobOut)
async def cancel_bulk_blind_check(job_id: str):
    job = _blind_bulk_jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="작업을 찾을 수 없습니다")
    job["cancel_event"].set()
    return schemas.BlindBulkCheckJobOut(
        job_id=job_id,
        status=job["status"],
        total=job["total"],
        processed=job["processed"],
        results=job["results"],
    )
