from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from .. import models, schemas
from ..db import get_db
from ..plan import compute_payout_forecast, compute_plan_summary

router = APIRouter(prefix="/api/plan", tags=["plan"])


@router.get("", response_model=schemas.PlanSummary)
def plan_summary(db: Session = Depends(get_db)):
    return compute_plan_summary(db)


@router.get("/forecast", response_model=schemas.PayoutForecast)
def payout_forecast(db: Session = Depends(get_db)):
    accounts = db.query(models.Account).all()
    return compute_payout_forecast(db, accounts)
