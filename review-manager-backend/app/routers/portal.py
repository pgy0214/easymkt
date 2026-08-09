import datetime
import os
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy.orm import Session

from app import auth, crud, kakao, models, schemas, sms
from app.crawlers import naver_date_check
from app.database import get_db

router = APIRouter(prefix="/api/portal", tags=["portal"])


@router.get("/dev-autologin", response_model=schemas.PortalDevAutoLoginOut)
def dev_autologin(db: Session = Depends(get_db)):
    """개발 단계 전용 — PORTAL_DEV_BYPASS_REVIEWER_ID가 .env에 설정돼 있으면 OTP
    없이 그 리뷰어로 바로 로그인할 토큰을 내준다. 배포 환경에서는 반드시 비워둘 것
    (비워두면 이 엔드포인트는 항상 {enabled: false}만 반환하고 아무 토큰도 안 줌)."""
    raw_id = os.environ.get("PORTAL_DEV_BYPASS_REVIEWER_ID")
    if not raw_id:
        return schemas.PortalDevAutoLoginOut(enabled=False)
    reviewer = crud.get_reviewer(db, int(raw_id))
    if not reviewer:
        return schemas.PortalDevAutoLoginOut(enabled=False)
    return schemas.PortalDevAutoLoginOut(enabled=True, token=auth.issue_token(reviewer.id))


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
        if not data.privacy_consent:
            raise HTTPException(status_code=400, detail="개인정보 수집·이용에 동의해주세요")
        reviewer = crud.create_reviewer(
            db,
            schemas.ReviewerCreate(name=data.name, contact_info=data.phone, is_active=False),
        )
        reviewer.privacy_consent_at = datetime.datetime.utcnow()
        db.commit()

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
    return schemas.OtpVerifyOut(token=token, reviewer=crud.reviewer_to_out(reviewer))


@router.post("/login", response_model=schemas.OtpVerifyOut)
def login(data: schemas.PortalLoginIn, db: Session = Depends(get_db)):
    """최초 가입 이후의 일반 로그인 — 전화번호+비밀번호. 비밀번호가 아직 없는
    계정(엑셀로 미리 올려둔 리뷰어 등)은 인증번호 로그인으로 안내한다."""
    reviewer = crud.get_reviewer_by_contact(db, data.phone)
    if not reviewer:
        raise HTTPException(
            status_code=404, detail="등록된 번호가 아닙니다 — 인증번호로 먼저 가입해주세요"
        )
    if not reviewer.password_hash:
        raise HTTPException(
            status_code=400,
            detail="비밀번호가 아직 설정되지 않았습니다 — 인증번호로 로그인 후 설정해주세요",
        )
    if not auth.verify_password(data.password, reviewer.password_hash):
        raise HTTPException(status_code=400, detail="비밀번호가 올바르지 않습니다")
    token = auth.issue_token(reviewer.id)
    return schemas.OtpVerifyOut(token=token, reviewer=crud.reviewer_to_out(reviewer))


@router.get("/kakao/config", response_model=schemas.KakaoConfigOut)
def kakao_config():
    if not kakao.is_configured():
        return schemas.KakaoConfigOut(configured=False)
    return schemas.KakaoConfigOut(
        configured=True, client_id=kakao.client_id(), redirect_uri=kakao.redirect_uri()
    )


@router.post("/kakao/exchange", response_model=schemas.KakaoExchangeOut)
def kakao_exchange(data: schemas.KakaoExchangeIn, db: Session = Depends(get_db)):
    if not kakao.is_configured():
        raise HTTPException(status_code=500, detail="카카오 로그인이 설정되지 않았습니다")
    access_token = kakao.exchange_code_for_token(data.code)
    profile = kakao.get_kakao_profile(access_token)
    reviewer = crud.get_reviewer_by_kakao_id(db, profile["kakao_id"])
    if reviewer:
        token = auth.issue_token(reviewer.id)
        return schemas.KakaoExchangeOut(linked=True, token=token, reviewer=crud.reviewer_to_out(reviewer))
    return schemas.KakaoExchangeOut(
        linked=False, kakao_access_token=access_token, suggested_name=profile.get("nickname")
    )


@router.post("/kakao/confirm", response_model=schemas.OtpVerifyOut)
def kakao_confirm(data: schemas.KakaoConfirmIn, db: Session = Depends(get_db)):
    # kakao_id는 클라이언트를 신뢰하지 않고 액세스 토큰으로 서버에서 다시 조회한다
    profile = kakao.get_kakao_profile(data.kakao_access_token)
    reviewer = crud.get_reviewer_by_contact(db, data.phone)
    if not reviewer or not crud.verify_otp(db, reviewer, data.code):
        raise HTTPException(status_code=400, detail="인증번호가 올바르지 않거나 만료되었습니다")
    existing = crud.get_reviewer_by_kakao_id(db, profile["kakao_id"])
    if existing and existing.id != reviewer.id:
        raise HTTPException(status_code=400, detail="이미 다른 계정에 연결된 카카오 계정입니다")
    reviewer.kakao_id = profile["kakao_id"]
    db.commit()
    token = auth.issue_token(reviewer.id)
    return schemas.OtpVerifyOut(token=token, reviewer=crud.reviewer_to_out(reviewer))


@router.get("/me", response_model=schemas.ReviewerOut)
def get_me(
    reviewer: models.Reviewer = Depends(get_current_reviewer), db: Session = Depends(get_db)
):
    duplicate_ids = crud.get_duplicate_blog_reviewer_ids(db)
    return crud.reviewer_to_out(reviewer, duplicate_ids)


@router.patch("/me/password", response_model=schemas.ReviewerOut)
def set_my_password(
    data: schemas.PortalSetPasswordIn,
    reviewer: models.Reviewer = Depends(get_current_reviewer),
    db: Session = Depends(get_db),
):
    """인증번호로 로그인한 상태에서만 호출됨 — 최초 가입 직후, 또는 비밀번호를
    잊어 인증번호로 다시 들어온 경우 둘 다 여기서 새 비밀번호를 설정한다."""
    if len(data.password) < 4:
        raise HTTPException(status_code=400, detail="비밀번호는 4자 이상이어야 합니다")
    reviewer.password_hash = auth.hash_password(data.password)
    db.commit()
    db.refresh(reviewer)
    return crud.reviewer_to_out(reviewer)


@router.patch("/me/blog-url", response_model=schemas.ReviewerOut)
def update_my_blog_url(
    data: schemas.PortalBlogUrlIn,
    reviewer: models.Reviewer = Depends(get_current_reviewer),
    db: Session = Depends(get_db),
):
    reviewer.blog_url = data.blog_url
    reviewer.blog_index = data.blog_index
    if data.email is not None:
        reviewer.email = data.email
    db.commit()
    db.refresh(reviewer)
    duplicate_ids = crud.get_duplicate_blog_reviewer_ids(db)
    return crud.reviewer_to_out(reviewer, duplicate_ids)


@router.post("/accounts", response_model=schemas.ReviewAccountOut)
def add_my_account(
    data: schemas.ReviewAccountCreate,
    reviewer: models.Reviewer = Depends(get_current_reviewer),
    db: Session = Depends(get_db),
):
    return crud.account_to_out(crud.create_account(db, reviewer.id, data))


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


@router.get("/pool", response_model=list[schemas.PoolGroupOut])
def get_pool(
    reviewer: models.Reviewer = Depends(get_current_reviewer), db: Session = Depends(get_db)
):
    if not reviewer.is_active:
        return []
    platforms = sorted({a.platform for a in reviewer.accounts})
    if not platforms:
        return []
    return crud.get_open_pool_summary(db, platforms, reviewer)


@router.get("/experience/campaigns", response_model=list[schemas.PortalExperienceCampaignOut])
def get_portal_experience_campaigns(
    reviewer: models.Reviewer = Depends(get_current_reviewer), db: Session = Depends(get_db)
):
    return crud.get_portal_experience_campaigns(db, reviewer.id)


@router.post("/experience/campaigns/{campaign_id}/apply", response_model=schemas.PortalExperienceCampaignOut)
def apply_to_experience_campaign(
    campaign_id: int,
    reviewer: models.Reviewer = Depends(get_current_reviewer),
    db: Session = Depends(get_db),
):
    if not reviewer.is_active:
        raise HTTPException(status_code=403, detail="관리자 승인 대기 중입니다. 승인 후 신청할 수 있어요")
    campaign = crud.get_experience_campaign(db, campaign_id)
    if not campaign:
        raise HTTPException(status_code=404, detail="캠페인을 찾을 수 없습니다")
    try:
        crud.create_experience_application(db, campaign_id, reviewer.id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    campaigns = crud.get_portal_experience_campaigns(db, reviewer.id)
    updated = next((c for c in campaigns if c.id == campaign_id), None)
    if not updated:
        raise HTTPException(status_code=404, detail="캠페인을 찾을 수 없습니다")
    return updated


@router.post("/accounts/check-availability", response_model=list[schemas.AccountAvailabilityOut])
def check_availability(
    reviewer: models.Reviewer = Depends(get_current_reviewer), db: Session = Depends(get_db)
):
    """스케줄러(2분 주기)를 기다리지 않고, 지금 이 순간 내 계정들의 마이플레이스를
    직접 크롤링해서 리뷰 가능한 날짜가 있는지 즉시 확인한다. 계정 1개당 실제
    브라우저를 띄워 확인하므로 몇 초씩 걸릴 수 있다."""
    results = []
    for account in reviewer.accounts:
        if account.platform != "naver" or not account.profile_url:
            continue
        try:
            date = naver_date_check.find_next_available_date(account.profile_url)
        except Exception as e:
            results.append(
                schemas.AccountAvailabilityOut(account_id=account.id, label=account.label, error=str(e))
            )
            continue
        results.append(
            schemas.AccountAvailabilityOut(account_id=account.id, label=account.label, available_date=date)
        )
    return results


@router.get("/tasks/mine", response_model=list[schemas.TaskOut])
def get_my_tasks(
    reviewer: models.Reviewer = Depends(get_current_reviewer), db: Session = Depends(get_db)
):
    return [crud.task_to_out(db, t) for t in crud.get_reviewer_tasks(db, reviewer.id)]


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
        return crud.task_to_out(db, crud.claim_task(db, task, account))
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
    return crud.task_to_out(db, crud.update_task_result(db, task, data.result_link))


@router.get("/tasks/{task_id}/brief", response_model=schemas.TaskBriefOut)
def get_task_brief(
    task_id: int,
    reviewer: models.Reviewer = Depends(get_current_reviewer),
    db: Session = Depends(get_db),
):
    """리뷰어가 자기 작업의 원고 자료(가이드라인/지역특징/메뉴/참고이미지)와
    영수증 이미지를 조회 — 본인이 클레임한 작업만 조회 가능."""
    task = crud.get_task(db, task_id)
    if not task or not task.review_account or task.review_account.reviewer_id != reviewer.id:
        raise HTTPException(status_code=404, detail="작업을 찾을 수 없습니다")
    target = task.review_target
    return schemas.TaskBriefOut(
        guideline=target.guideline if target else None,
        regional_features=target.regional_features if target else None,
        menu_items=crud.decode_menu_items(target.menu_items_json) if target else None,
        reference_photo_path=target.reference_photo_path if target else None,
        assigned_photo_paths=crud.assign_photos_for_task(task),
        assigned_review_text=crud.assign_review_text_for_task(db, task),
        receipt_image_path=task.receipt_image_path,
    )
