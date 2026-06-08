from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import models, schemas
from ..db import get_db

router = APIRouter(prefix="/api/playbooks", tags=["playbooks"])


@router.get("", response_model=list[schemas.TradingPlaybookOut])
def list_playbooks(db: Session = Depends(get_db), include_archived: bool = False):
    q = db.query(models.TradingPlaybook)
    if not include_archived:
        q = q.filter(models.TradingPlaybook.archived == False)  # noqa: E712
    return q.order_by(models.TradingPlaybook.name).all()


@router.post("", response_model=schemas.TradingPlaybookOut)
def create_playbook(data: schemas.TradingPlaybookIn, db: Session = Depends(get_db)):
    if db.query(models.TradingPlaybook).filter_by(name=data.name).first():
        raise HTTPException(400, "Playbook name already exists")
    p = models.TradingPlaybook(**data.model_dump())
    db.add(p)
    db.commit()
    db.refresh(p)
    return p


@router.patch("/{playbook_id}", response_model=schemas.TradingPlaybookOut)
def update_playbook(playbook_id: int, data: schemas.TradingPlaybookUpdate, db: Session = Depends(get_db)):
    p = db.get(models.TradingPlaybook, playbook_id)
    if not p:
        raise HTTPException(404, "Not found")
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(p, k, v)
    db.commit()
    db.refresh(p)
    return p


@router.delete("/{playbook_id}")
def delete_playbook(playbook_id: int, db: Session = Depends(get_db)):
    p = db.get(models.TradingPlaybook, playbook_id)
    if not p:
        raise HTTPException(404, "Not found")
    db.delete(p)
    db.commit()
    return {"ok": True}
