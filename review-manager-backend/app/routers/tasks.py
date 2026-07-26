from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app import crud, schemas
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
    return [crud.task_to_out(t) for t in tasks]


@router.get("/{task_id}", response_model=schemas.TaskOut)
def get_task(task_id: int, db: Session = Depends(get_db)):
    task = crud.get_task(db, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="작업을 찾을 수 없습니다")
    return crud.task_to_out(task)


@router.patch("/{task_id}/result", response_model=schemas.TaskOut)
def update_result(
    task_id: int, data: schemas.TaskResultUpdate, db: Session = Depends(get_db)
):
    task = crud.get_task(db, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="작업을 찾을 수 없습니다")
    task = crud.update_task_result(db, task, data.result_link)
    return crud.task_to_out(task)


@router.patch("/{task_id}/settlement", response_model=schemas.TaskOut)
def update_settlement(
    task_id: int, data: schemas.TaskSettlementUpdate, db: Session = Depends(get_db)
):
    task = crud.get_task(db, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="작업을 찾을 수 없습니다")
    task = crud.update_task_settlement(db, task, data)
    return crud.task_to_out(task)


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
        return crud.task_to_out(crud.claim_task(db, task, account))
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
    return crud.task_to_out(task)
