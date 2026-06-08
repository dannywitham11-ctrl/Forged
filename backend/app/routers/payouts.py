from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import models, schemas
from ..db import get_db

router = APIRouter(prefix="/api/payouts", tags=["payouts"])


@router.get("", response_model=list[schemas.PayoutOut])
def list_payouts(db: Session = Depends(get_db), account_id: Optional[int] = None):
    q = db.query(models.Payout)
    if account_id:
        q = q.filter(models.Payout.account_id == account_id)
    return q.order_by(models.Payout.payout_date.desc()).all()


@router.post("", response_model=schemas.PayoutOut)
def create_payout(data: schemas.PayoutIn, db: Session = Depends(get_db)):
    acct = db.get(models.Account, data.account_id)
    if not acct:
        raise HTTPException(404, "Account not found")
    p = models.Payout(**data.model_dump())
    db.add(p)
    db.commit()
    db.refresh(p)
    return p


@router.delete("/{payout_id}")
def delete_payout(payout_id: int, db: Session = Depends(get_db)):
    p = db.get(models.Payout, payout_id)
    if not p:
        raise HTTPException(404, "Not found")
    db.delete(p)
    db.commit()
    return {"ok": True}
