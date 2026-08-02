from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app import adspower, crud, schemas
from app.database import get_db

router = APIRouter(prefix="/api/accounts", tags=["accounts"])


@router.patch("/{account_id}", response_model=schemas.ReviewAccountOut)
def update_account(
    account_id: int, data: schemas.ReviewAccountUpdate, db: Session = Depends(get_db)
):
    account = crud.get_account(db, account_id)
    if not account:
        raise HTTPException(status_code=404, detail="계정을 찾을 수 없습니다")
    return crud.account_to_out(crud.update_account(db, account, data))


@router.delete("/{account_id}")
def delete_account(account_id: int, db: Session = Depends(get_db)):
    account = crud.get_account(db, account_id)
    if not account:
        raise HTTPException(status_code=404, detail="계정을 찾을 수 없습니다")
    try:
        crud.delete_account(db, account)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {"ok": True}


@router.get("/{account_id}/store-history", response_model=list[schemas.AccountStoreHistoryItem])
def get_store_history(account_id: int, db: Session = Depends(get_db)):
    account = crud.get_account(db, account_id)
    if not account:
        raise HTTPException(status_code=404, detail="계정을 찾을 수 없습니다")
    return crud.get_account_store_history(db, account_id)


@router.post("/{account_id}/launch", response_model=schemas.AccountLaunchOut)
def launch_account(account_id: int, db: Session = Depends(get_db)):
    account = crud.get_account(db, account_id)
    if not account:
        raise HTTPException(status_code=404, detail="계정을 찾을 수 없습니다")
    if not account.adspower_profile_id:
        raise HTTPException(status_code=400, detail="이 계정에는 AdsPower 프로필이 연결되어 있지 않습니다")
    if not adspower.is_configured():
        raise HTTPException(status_code=400, detail="AdsPower API 키가 서버에 설정되어 있지 않습니다")
    try:
        data = adspower.start_browser(account.adspower_profile_id)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"AdsPower 실행 실패: {e}")
    return schemas.AccountLaunchOut(debug_port=data.get("debug_port"))
