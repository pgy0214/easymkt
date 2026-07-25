from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy.orm import Session

from app import auth, crud, models, schemas, sms
from app.database import get_db

router = APIRouter(prefix="/api/portal", tags=["portal"])


def get_current_reviewer(
    authorization: Optional[str] = Header(default=None), db: Session = Depends(get_db)
) -> models.Reviewer:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="로그인이 필요합니다")
    token = authorization.removeprefix("Bearer ").strip()
    try:
        reviewer_id = auth.verify_token(token)
    except ValueError as e:
        raise HTTPException(status_code=401, detail=str(e))
    reviewer = crud.get_reviewer(db, reviewer_id)
    if not reviewer:
        raise HTTPException(status_code=401, detail="계정을 찾을 수 없습니다")
    return reviewer


@router.post("/otp/request")
def request_otp(data: schemas.OtpRequestIn, db: Session = Depends(get_db)):
    reviewer = crud.get_reviewer_by_contact(db, data.phone)
    if not reviewer:
        if not data.name:
            raise HTTPException(
                status_code=404, detail="등록된 번호가 아닙니다 — 이름을 함께 입력하면 새로 등록됩니다"
            )
        reviewer = crud.create_reviewer(
            db,
            schemas.ReviewerCreate(name=data.name, contact_info=data.phone, is_active=False),
        )

    code = crud.issue_otp(db, reviewer)
    try:
        sms.send_otp_sms(data.phone, code)
    except RuntimeError as e:
        # Aligo not configured yet — surface the code so local dev/testing can continue
        raise HTTPException(
            status_code=500,
            detail=f"{e} (개발 중이라면 서버 로그에서 인증번호를 확인하세요: {code})",
        )
    return {"ok": True}


@router.post("/otp/verify", response_model=schemas.OtpVerifyOut)
def verify_otp(data: schemas.OtpVerifyIn, db: Session = Depends(get_db)):
    reviewer = crud.get_reviewer_by_contact(db, data.phone)
    if not reviewer or not crud.verify_otp(db, reviewer, data.code):
        raise HTTPException(status_code=400, detail="인증번호가 올바르지 않거나 만료되었습니다")
    token = auth.issue_token(reviewer.id)
    return schemas.OtpVerifyOut(token=token, reviewer=reviewer)


@router.get("/me", response_model=schemas.ReviewerOut)
def get_me(reviewer: models.Reviewer = Depends(get_current_reviewer)):
    return reviewer


@router.post("/accounts", response_model=schemas.ReviewAccountOut)
def add_my_account(
    data: schemas.ReviewAccountCreate,
    reviewer: models.Reviewer = Depends(get_current_reviewer),
    db: Session = Depends(get_db),
):
    return crud.create_account(db, reviewer.id, data)


@router.delete("/accounts/{account_id}")
def delete_my_account(
    account_id: int,
    reviewer: models.Reviewer = Depends(get_current_reviewer),
    db: Session = Depends(get_db),
):
    account = crud.get_account(db, account_id)
    if not account or account.reviewer_id != reviewer.id:
        raise HTTPException(status_code=404, detail="계정을 찾을 수 없습니다")
    try:
        crud.delete_account(db, account)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {"ok": True}


@router.get("/pool", response_model=list[schemas.TaskOut])
def get_pool(
    reviewer: models.Reviewer = Depends(get_current_reviewer), db: Session = Depends(get_db)
):
    if not reviewer.is_active:
        return []
    platforms = sorted({a.platform for a in reviewer.accounts})
    if not platforms:
        return []
    return [crud.task_to_out(t) for t in crud.get_open_pool_tasks(db, platforms)]


@router.get("/tasks/mine", response_model=list[schemas.TaskOut])
def get_my_tasks(
    reviewer: models.Reviewer = Depends(get_current_reviewer), db: Session = Depends(get_db)
):
    return [crud.task_to_out(t) for t in crud.get_reviewer_tasks(db, reviewer.id)]


@router.post("/tasks/{task_id}/claim", response_model=schemas.TaskOut)
def claim_task(
    task_id: int,
    data: schemas.PortalClaimIn,
    reviewer: models.Reviewer = Depends(get_current_reviewer),
    db: Session = Depends(get_db),
):
    if not reviewer.is_active:
        raise HTTPException(status_code=403, detail="관리자 승인 대기 중입니다. 승인 후 작업을 가져갈 수 있어요")
    task = crud.get_task(db, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="작업을 찾을 수 없습니다")
    account = crud.get_account(db, data.account_id)
    if not account or account.reviewer_id != reviewer.id:
        raise HTTPException(status_code=400, detail="본인 소유 계정이 아닙니다")
    try:
        return crud.task_to_out(crud.claim_task(db, task, account))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.patch("/tasks/{task_id}/result", response_model=schemas.TaskOut)
def submit_my_result(
    task_id: int,
    data: schemas.TaskResultUpdate,
    reviewer: models.Reviewer = Depends(get_current_reviewer),
    db: Session = Depends(get_db),
):
    task = crud.get_task(db, task_id)
    if not task or not task.review_account or task.review_account.reviewer_id != reviewer.id:
        raise HTTPException(status_code=404, detail="작업을 찾을 수 없습니다")
    return crud.task_to_out(crud.update_task_result(db, task, data.result_link))
