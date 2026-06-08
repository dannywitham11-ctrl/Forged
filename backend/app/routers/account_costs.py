from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import models, schemas
from ..db import get_db
from ..services import expand_cost_amount, monthly_cycles_elapsed

router = APIRouter(prefix="/api/account-costs", tags=["costs"])


def _to_out(c: models.AccountCost) -> schemas.AccountCostOut:
    cycles = monthly_cycles_elapsed(c.cost_date, end_cap=c.recurring_end_date) if c.is_recurring else 1
    return schemas.AccountCostOut(
        id=c.id,
        account_id=c.account_id,
        prop_firm_key=c.prop_firm_key,
        category=c.category,
        amount=c.amount,
        cost_date=c.cost_date,
        description=c.description,
        is_recurring=bool(c.is_recurring),
        recurring_end_date=c.recurring_end_date,
        effective_total=expand_cost_amount(c),
        cycles_elapsed=cycles,
    )


@router.get("", response_model=list[schemas.AccountCostOut])
def list_costs(db: Session = Depends(get_db), account_id: Optional[int] = None):
    q = db.query(models.AccountCost)
    if account_id:
        q = q.filter(models.AccountCost.account_id == account_id)
    rows = q.order_by(models.AccountCost.cost_date.desc()).all()
    return [_to_out(c) for c in rows]


@router.post("", response_model=schemas.AccountCostOut)
def create_cost(data: schemas.AccountCostIn, db: Session = Depends(get_db)):
    c = models.AccountCost(**data.model_dump())
    db.add(c)
    db.commit()
    db.refresh(c)
    return _to_out(c)


@router.patch("/{cost_id}", response_model=schemas.AccountCostOut)
def update_cost(cost_id: int, data: schemas.AccountCostUpdate, db: Session = Depends(get_db)):
    c = db.get(models.AccountCost, cost_id)
    if not c:
        raise HTTPException(404, "Not found")
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(c, k, v)
    db.commit()
    db.refresh(c)
    return _to_out(c)


@router.delete("/{cost_id}")
def delete_cost(cost_id: int, db: Session = Depends(get_db)):
    c = db.get(models.AccountCost, cost_id)
    if not c:
        raise HTTPException(404, "Not found")
    db.delete(c)
    db.commit()
    return {"ok": True}
