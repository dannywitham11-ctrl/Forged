from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from .. import models, schemas
from ..db import get_db

router = APIRouter(prefix="/api/settings", tags=["settings"])


def _get_or_create(db: Session) -> models.UserSettings:
    s = db.query(models.UserSettings).first()
    if s is None:
        s = models.UserSettings()
        db.add(s)
        db.commit()
        db.refresh(s)
    return s


@router.get("", response_model=schemas.UserSettingsOut)
def get_settings(db: Session = Depends(get_db)):
    return _get_or_create(db)


@router.patch("", response_model=schemas.UserSettingsOut)
def update_settings(data: schemas.UserSettingsUpdate, db: Session = Depends(get_db)):
    s = _get_or_create(db)
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(s, k, v)
    db.commit()
    db.refresh(s)
    return s
