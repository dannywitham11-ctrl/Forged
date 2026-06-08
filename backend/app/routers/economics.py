from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from .. import models, schemas
from ..db import get_db
from ..prop import compute_economics

router = APIRouter(prefix="/api/economics", tags=["economics"])


@router.get("", response_model=schemas.EconomicsSummary)
def economics(db: Session = Depends(get_db)):
    accounts = db.query(models.Account).all()
    return compute_economics(db, accounts)
