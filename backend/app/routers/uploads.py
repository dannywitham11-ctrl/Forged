import os

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

from .. import models, schemas
from ..db import get_db
from ..mw_parser import parse_motivewave_executions
from ..nt_parser import looks_like_ninjatrader_csv, parse_ninjatrader_executions
from ..parser import parse_sierra_fills
from ..services import insert_executions, rebuild_trades_for_account, store_upload

router = APIRouter(prefix="/api/uploads", tags=["uploads"])

UPLOAD_DIR = os.environ.get("UPLOAD_DIR", "/uploads")


@router.post("", response_model=schemas.UploadResult)
async def upload_sierra(file: UploadFile = File(...), db: Session = Depends(get_db)):
    content = await file.read()
    if not content:
        raise HTTPException(400, "Empty file")

    stored_name, path = store_upload(UPLOAD_DIR, file.filename or "upload.txt", content)

    # Sniff the header to pick a parser: NinjaTrader and Sierra have distinctive
    # headers; anything else falls through to the flexible MotiveWave parser.
    head_text = content[:4096].decode("utf-8", errors="replace")
    if looks_like_ninjatrader_csv(head_text):
        detected_format = "ninjatrader"
        fills = list(parse_ninjatrader_executions(path))
    elif "ActivityType" in head_text or "TradeAccount" in head_text:
        detected_format = "sierra"
        fills = list(parse_sierra_fills(path))
    else:
        detected_format = "motivewave"
        fills = list(parse_motivewave_executions(path))

    batch = models.UploadBatch(
        filename=file.filename or stored_name,
        stored_path=path,
        row_count=len(fills),
    )
    db.add(batch)
    db.flush()

    if not fills:
        batch.inserted_executions = 0
        db.commit()
        return schemas.UploadResult(
            batch_id=batch.id, filename=batch.filename,
            parsed_rows=0, inserted_executions=0, skipped_duplicates=0,
            trades_built=0, accounts_touched=[],
            detected_format=detected_format,
        )

    inserted, skipped, touched_ids = insert_executions(db, fills, batch)
    batch.inserted_executions = inserted
    batch.skipped_duplicates = skipped

    trades_built = 0
    touched_external = []
    for acct_id in touched_ids:
        acct = db.get(models.Account, acct_id)
        trades_built += rebuild_trades_for_account(db, acct)
        touched_external.append(acct.external_id)

    db.commit()
    return schemas.UploadResult(
        batch_id=batch.id,
        filename=batch.filename,
        parsed_rows=len(fills),
        inserted_executions=inserted,
        skipped_duplicates=skipped,
        trades_built=trades_built,
        accounts_touched=touched_external,
        detected_format=detected_format,
    )


@router.get("")
def list_uploads(db: Session = Depends(get_db)):
    rows = db.query(models.UploadBatch).order_by(models.UploadBatch.created_at.desc()).all()
    return [
        {
            "id": r.id, "filename": r.filename, "row_count": r.row_count,
            "inserted_executions": r.inserted_executions,
            "skipped_duplicates": r.skipped_duplicates,
            "created_at": r.created_at,
        }
        for r in rows
    ]
