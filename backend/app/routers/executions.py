from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from .. import models, schemas
from ..db import get_db

router = APIRouter(prefix="/api/executions", tags=["executions"])


@router.get("", response_model=list[schemas.ExecutionOut])
def list_executions(
    db: Session = Depends(get_db),
    account_id: Optional[int] = None,
    trade_id: Optional[int] = None,
    limit: int = Query(500, le=5000),
):
    q = db.query(models.Execution)
    if account_id:
        q = q.filter(models.Execution.account_id == account_id)
    if trade_id:
        q = q.filter(models.Execution.trade_id == trade_id)
    return q.order_by(models.Execution.fill_time.desc()).limit(limit).all()
