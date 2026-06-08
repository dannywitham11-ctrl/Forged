import os
from datetime import datetime

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from .. import models, schemas
from ..db import get_db

router = APIRouter(prefix="/api/trades", tags=["attachments"])

UPLOAD_DIR = os.environ.get("UPLOAD_DIR", "/tmp" if os.environ.get("VERCEL") else "/uploads")
ATTACHMENT_DIR = os.path.join(UPLOAD_DIR, "attachments")


def _to_out(a: models.TradeAttachment) -> schemas.TradeAttachmentOut:
    return schemas.TradeAttachmentOut(
        id=a.id, trade_id=a.trade_id, filename=a.filename,
        mime_type=a.mime_type, kind=a.kind, size_bytes=a.size_bytes,
        created_at=a.created_at, url=f"/api/trades/attachments/{a.id}/file",
    )


@router.post("/{trade_id}/attachments", response_model=schemas.TradeAttachmentOut)
async def upload_attachment(
    trade_id: int,
    file: UploadFile = File(...),
    kind: str = Form("screenshot"),
    db: Session = Depends(get_db),
):
    t = db.get(models.Trade, trade_id)
    if not t:
        raise HTTPException(404, "Trade not found")
    content = await file.read()
    if not content:
        raise HTTPException(400, "Empty file")
    if len(content) > 25 * 1024 * 1024:
        raise HTTPException(400, "Attachment exceeds 25 MB limit")

    os.makedirs(ATTACHMENT_DIR, exist_ok=True)
    stamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S_%f")
    safe = (file.filename or f"paste_{stamp}.png").replace("/", "_").replace("\\", "_")
    stored = f"trade{trade_id}_{stamp}_{safe}"
    path = os.path.join(ATTACHMENT_DIR, stored)
    with open(path, "wb") as f:
        f.write(content)

    a = models.TradeAttachment(
        trade_id=trade_id, filename=file.filename or stored,
        stored_path=path, mime_type=file.content_type, kind=kind,
        size_bytes=len(content),
    )
    db.add(a)
    db.commit()
    db.refresh(a)
    return _to_out(a)


@router.get("/{trade_id}/attachments", response_model=list[schemas.TradeAttachmentOut])
def list_attachments(trade_id: int, db: Session = Depends(get_db)):
    rows = (
        db.query(models.TradeAttachment)
        .filter_by(trade_id=trade_id)
        .order_by(models.TradeAttachment.created_at)
        .all()
    )
    return [_to_out(r) for r in rows]


@router.delete("/attachments/{attachment_id}")
def delete_attachment(attachment_id: int, db: Session = Depends(get_db)):
    a = db.get(models.TradeAttachment, attachment_id)
    if not a:
        raise HTTPException(404, "Not found")
    try:
        if a.stored_path and os.path.exists(a.stored_path):
            os.remove(a.stored_path)
    except OSError:
        pass
    db.delete(a)
    db.commit()
    return {"ok": True}


@router.get("/attachments/{attachment_id}/file")
def get_attachment_file(attachment_id: int, db: Session = Depends(get_db)):
    a = db.get(models.TradeAttachment, attachment_id)
    if not a or not os.path.exists(a.stored_path):
        raise HTTPException(404, "File not found")
    return FileResponse(
        a.stored_path, media_type=a.mime_type or "application/octet-stream", filename=a.filename
    )
