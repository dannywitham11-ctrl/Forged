from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, selectinload

from .. import models, schemas
from ..db import get_db

router = APIRouter(prefix="/api/prop-firms", tags=["prop-firms"])


@router.get("", response_model=list[schemas.PropFirmDefOut])
def list_firms(db: Session = Depends(get_db), include_archived: bool = False):
    q = db.query(models.PropFirmDef).options(selectinload(models.PropFirmDef.plans))
    if not include_archived:
        q = q.filter(models.PropFirmDef.archived == False)  # noqa: E712
    firms = q.order_by(models.PropFirmDef.label).all()
    for f in firms:
        f.plans = [p for p in f.plans if include_archived or not p.archived]
    return firms


@router.post("", response_model=schemas.PropFirmDefOut)
def create_firm(data: schemas.PropFirmDefIn, db: Session = Depends(get_db)):
    if db.query(models.PropFirmDef).filter_by(key=data.key).first():
        raise HTTPException(400, f"Firm key '{data.key}' already exists")
    f = models.PropFirmDef(**data.model_dump(), is_custom=True)
    db.add(f)
    db.commit()
    db.refresh(f)
    return f


@router.patch("/{firm_id}", response_model=schemas.PropFirmDefOut)
def update_firm(firm_id: int, data: schemas.PropFirmDefUpdate, db: Session = Depends(get_db)):
    f = db.get(models.PropFirmDef, firm_id)
    if not f:
        raise HTTPException(404, "Firm not found")
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(f, k, v)
    db.commit()
    db.refresh(f)
    return f


@router.delete("/{firm_id}")
def delete_firm(firm_id: int, db: Session = Depends(get_db)):
    f = db.get(models.PropFirmDef, firm_id)
    if not f:
        raise HTTPException(404, "Firm not found")
    db.delete(f)
    db.commit()
    return {"ok": True}


@router.post("/{firm_id}/plans", response_model=schemas.PropFirmPlanOut)
def add_plan(firm_id: int, data: schemas.PropFirmPlanIn, db: Session = Depends(get_db)):
    f = db.get(models.PropFirmDef, firm_id)
    if not f:
        raise HTTPException(404, "Firm not found")
    if db.query(models.PropFirmPlanDef).filter_by(firm_id=firm_id, key=data.key).first():
        raise HTTPException(400, f"Plan key '{data.key}' already exists for this firm")
    p = models.PropFirmPlanDef(firm_id=firm_id, **data.model_dump())
    db.add(p)
    db.commit()
    db.refresh(p)
    return p


@router.patch("/plans/{plan_id}", response_model=schemas.PropFirmPlanOut)
def update_plan(plan_id: int, data: schemas.PropFirmPlanUpdate, db: Session = Depends(get_db)):
    p = db.get(models.PropFirmPlanDef, plan_id)
    if not p:
        raise HTTPException(404, "Plan not found")
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(p, k, v)
    db.commit()
    db.refresh(p)
    return p


@router.delete("/plans/{plan_id}")
def delete_plan(plan_id: int, db: Session = Depends(get_db)):
    p = db.get(models.PropFirmPlanDef, plan_id)
    if not p:
        raise HTTPException(404, "Plan not found")
    db.delete(p)
    db.commit()
    return {"ok": True}
