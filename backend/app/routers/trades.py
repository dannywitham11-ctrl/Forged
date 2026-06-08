from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from .. import models, schemas
from ..db import get_db
from ..instruments import get_spec

router = APIRouter(prefix="/api/trades", tags=["trades"])


def _apply_filters(q, account_ids, symbol, side, from_date, to_date, win_only,
                   strategy_id, has_mistakes):
    if account_ids:
        q = q.filter(models.Trade.account_id.in_(account_ids))
    if symbol:
        q = q.filter(models.Trade.symbol == symbol)
    if side:
        q = q.filter(models.Trade.side == side)
    if from_date:
        q = q.filter(models.Trade.trade_date >= datetime.fromisoformat(from_date))
    if to_date:
        q = q.filter(models.Trade.trade_date <= datetime.fromisoformat(to_date))
    if win_only == "wins":
        q = q.filter(models.Trade.net_pnl > 0)
    elif win_only == "losses":
        q = q.filter(models.Trade.net_pnl < 0)
    if strategy_id:
        q = q.filter(models.Trade.strategy_id == strategy_id)
    if has_mistakes:
        q = q.filter(models.Trade.mistakes.isnot(None), models.Trade.mistakes != "")
    return q


@router.get("", response_model=list[schemas.TradeOut])
def list_trades(
    db: Session = Depends(get_db),
    account_ids: list[int] = Query(default=[]),
    symbol: Optional[str] = None,
    side: Optional[str] = None,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    win_only: Optional[str] = None,
    strategy_id: Optional[int] = None,
    has_mistakes: Optional[bool] = None,
    limit: int = Query(500, le=5000),
    offset: int = 0,
):
    q = db.query(models.Trade)
    q = _apply_filters(q, account_ids, symbol, side, from_date, to_date,
                       win_only, strategy_id, has_mistakes)
    q = q.order_by(models.Trade.entry_time.desc()).offset(offset).limit(limit)
    return q.all()


@router.get("/{trade_id}", response_model=schemas.TradeOut)
def get_trade(trade_id: int, db: Session = Depends(get_db)):
    t = db.get(models.Trade, trade_id)
    if not t:
        raise HTTPException(404, "Trade not found")
    return t


@router.patch("/{trade_id}", response_model=schemas.TradeOut)
def update_trade(trade_id: int, data: schemas.TradeUpdate, db: Session = Depends(get_db)):
    t = db.get(models.Trade, trade_id)
    if not t:
        raise HTTPException(404, "Trade not found")
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(t, k, v)
    _recompute_planned(t)  # planned levels may have changed
    db.commit()
    db.refresh(t)
    return t


def _recompute_planned(t: models.Trade):
    """Convert planned target/stop (price or ticks) to $ risk/reward + RR + realized R."""
    spec = get_spec(t.symbol)
    pv = spec["point_value"]
    tick = spec["tick_size"]
    qty = t.quantity

    def to_dollars(mode: str | None, value: float | None) -> float | None:
        if mode is None or value is None:
            return None
        if mode == "price":
            return abs(value - t.avg_entry_price) * pv * qty
        if mode == "ticks":
            return abs(value) * tick * pv * qty
        return None

    reward = to_dollars(t.planned_target_mode, t.planned_target_value)
    risk = to_dollars(t.planned_stop_mode, t.planned_stop_value)

    t.planned_reward = reward
    t.planned_risk = risk
    t.planned_rr = (reward / risk) if (reward is not None and risk and risk > 0) else None
    t.realized_r = (t.net_pnl / risk) if (risk and risk > 0) else None


@router.get("/{trade_id}/executions", response_model=list[schemas.ExecutionOut])
def trade_executions(trade_id: int, db: Session = Depends(get_db)):
    return (
        db.query(models.Execution)
        .filter_by(trade_id=trade_id)
        .order_by(models.Execution.fill_time)
        .all()
    )
