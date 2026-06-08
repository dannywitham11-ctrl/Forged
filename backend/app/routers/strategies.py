from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import models, schemas
from ..db import get_db

router = APIRouter(prefix="/api/strategies", tags=["strategies"])


@router.get("", response_model=list[schemas.StrategyOut])
def list_strategies(db: Session = Depends(get_db), include_archived: bool = False):
    q = db.query(models.Strategy)
    if not include_archived:
        q = q.filter(models.Strategy.archived == False)  # noqa: E712 (SQLAlchemy needs ==)
    return q.order_by(models.Strategy.name).all()


@router.post("", response_model=schemas.StrategyOut)
def create_strategy(data: schemas.StrategyIn, db: Session = Depends(get_db)):
    if db.query(models.Strategy).filter_by(name=data.name).first():
        raise HTTPException(400, "Strategy name already exists")
    s = models.Strategy(**data.model_dump())
    db.add(s)
    db.commit()
    db.refresh(s)
    return s


@router.patch("/{strategy_id}", response_model=schemas.StrategyOut)
def update_strategy(strategy_id: int, data: schemas.StrategyUpdate, db: Session = Depends(get_db)):
    s = db.get(models.Strategy, strategy_id)
    if not s:
        raise HTTPException(404, "Not found")
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(s, k, v)
    db.commit()
    db.refresh(s)
    return s


@router.delete("/{strategy_id}")
def delete_strategy(strategy_id: int, db: Session = Depends(get_db)):
    s = db.get(models.Strategy, strategy_id)
    if not s:
        raise HTTPException(404, "Not found")
    db.query(models.Trade).filter_by(strategy_id=strategy_id).update(
        {models.Trade.strategy_id: None}, synchronize_session=False
    )
    db.delete(s)
    db.commit()
    return {"ok": True}
