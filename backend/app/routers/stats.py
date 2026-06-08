from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from .. import models, schemas
from ..analytics import compute_stats
from ..db import get_db

router = APIRouter(prefix="/api/stats", tags=["stats"])


@router.get("", response_model=schemas.FullStats)
def get_stats(
    db: Session = Depends(get_db),
    account_ids: list[int] = Query(default=[]),
    symbol: Optional[str] = None,
    strategy_id: Optional[int] = None,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
):
    q = db.query(models.Trade)
    if account_ids:
        q = q.filter(models.Trade.account_id.in_(account_ids))
        accts = db.query(models.Account).filter(models.Account.id.in_(account_ids)).all()
        starting = sum(a.starting_balance or 0 for a in accts)
        payouts = db.query(models.Payout).filter(models.Payout.account_id.in_(account_ids)).all()
        total_payouts = sum(p.amount for p in payouts)
    else:
        accts = db.query(models.Account).all()
        starting = sum(a.starting_balance or 0 for a in accts)
        total_payouts = sum(p.amount for p in db.query(models.Payout).all())

    # Broker reconciliation: only authoritative when EVERY selected account has a balance.
    broker_accounts_covered = sum(1 for a in accts if a.broker_balance is not None)
    broker_accounts_total = len(accts)
    broker_total: Optional[float] = None
    if broker_accounts_covered == broker_accounts_total and broker_accounts_total > 0:
        broker_total = float(sum(a.broker_balance for a in accts))

    if symbol:
        q = q.filter(models.Trade.symbol == symbol)
    if strategy_id:
        q = q.filter(models.Trade.strategy_id == strategy_id)
    if from_date:
        q = q.filter(models.Trade.trade_date >= datetime.fromisoformat(from_date))
    if to_date:
        q = q.filter(models.Trade.trade_date <= datetime.fromisoformat(to_date))
    trades = q.all()
    strategies = {s.id: s for s in db.query(models.Strategy).all()}
    return compute_stats(
        trades,
        starting_balance=starting,
        total_payouts=total_payouts,
        strategies_by_id=strategies,
        broker_total=broker_total,
        broker_accounts_covered=broker_accounts_covered,
        broker_accounts_total=broker_accounts_total,
    )
