import os
from datetime import datetime

from fastapi import APIRouter, Depends, File, Header, HTTPException, UploadFile
from sqlalchemy.orm import Session

from .. import models, schemas
from ..db import get_db
from ..services import rebuild_trades_for_account
from ..tradeaccount_reader import parse_data_bytes, parse_data_file

router = APIRouter(prefix="/api/admin", tags=["admin"])

UPLOAD_DIR = os.environ.get("UPLOAD_DIR", "/uploads")
SIERRA_DATA_MOUNT = os.environ.get("SIERRA_DATA_PATH", "/sierra-data")


@router.post("/import-tradeaccount-data")
async def import_tradeaccount_data(file: UploadFile = File(...), db: Session = Depends(get_db)):
    """Parse a Sierra `TradeAccountData_*.data` file and update the matching
    account's broker_balance (matched by external_id from field 2001)."""
    content = await file.read()
    if not content:
        raise HTTPException(400, "Empty file")
    try:
        parsed = parse_data_bytes(content)
    except Exception as e:
        raise HTTPException(400, f"Could not parse .data file: {e}")
    if not parsed.external_id:
        raise HTTPException(400, "File has no account external_id (field 2001)")
    if parsed.balance is None:
        raise HTTPException(400, "File has no balance field (2004)")

    acct = db.query(models.Account).filter_by(external_id=parsed.external_id).first()
    if not acct:
        raise HTTPException(404, f"No matching account for external_id '{parsed.external_id}'")

    prev = acct.broker_balance
    acct.broker_balance = parsed.balance
    acct.broker_balance_updated_at = datetime.utcnow()
    if parsed.high_water_mark is not None:
        if not acct.broker_high_water_mark or parsed.high_water_mark > acct.broker_high_water_mark:
            acct.broker_high_water_mark = parsed.high_water_mark
    db.commit()
    return {
        "external_id": parsed.external_id,
        "currency": parsed.currency,
        "previous_balance": prev,
        "new_balance": parsed.balance,
        "high_water_mark": parsed.high_water_mark,
        "session_pnl": parsed.session_pnl,
    }


def _find_tradeaccount_files() -> list[dict]:
    """Find every TradeAccountData_*.data file under the Sierra mount (recursively)."""
    seen: set[str] = set()
    results: list[dict] = []
    if not os.path.isdir(SIERRA_DATA_MOUNT):
        return results
    for root, _dirs, files in os.walk(SIERRA_DATA_MOUNT):
        for name in files:
            low = name.lower()
            if low.endswith(".data") and "tradeaccount" in low:
                full = os.path.join(root, name)
                if full in seen:
                    continue
                seen.add(full)
                try:
                    results.append({"path": full, "name": name, "size": os.path.getsize(full)})
                except OSError:
                    continue
    results.sort(key=lambda x: x["name"])
    return results


@router.get("/tradeaccount-data/scan")
def scan_tradeaccount_data():
    """List TradeAccountData_*.data files visible in the mounted Sierra folder."""
    return {"mounted": os.path.isdir(SIERRA_DATA_MOUNT), "files": _find_tradeaccount_files()}


@router.post("/tradeaccount-data/import-all")
def import_all_tradeaccount_data(db: Session = Depends(get_db)):
    """Apply every parseable .data balance under the Sierra mount in one pass."""
    files = _find_tradeaccount_files()
    if not files:
        raise HTTPException(404, f"No .data files found under {SIERRA_DATA_MOUNT}")

    updated = []
    skipped = []
    for f in files:
        try:
            parsed = parse_data_file(f["path"])
        except Exception as e:
            skipped.append({"name": f["name"], "reason": f"parse error: {e}"})
            continue
        if not parsed.external_id or parsed.balance is None:
            skipped.append({"name": f["name"], "reason": "missing required fields"})
            continue
        acct = db.query(models.Account).filter_by(external_id=parsed.external_id).first()
        if not acct:
            skipped.append({"name": f["name"], "reason": f"no account for {parsed.external_id}"})
            continue
        prev = acct.broker_balance
        acct.broker_balance = parsed.balance
        acct.broker_balance_updated_at = datetime.utcnow()
        if parsed.high_water_mark is not None:
            if not acct.broker_high_water_mark or parsed.high_water_mark > acct.broker_high_water_mark:
                acct.broker_high_water_mark = parsed.high_water_mark
        updated.append({"external_id": parsed.external_id, "previous": prev, "new": parsed.balance})
    db.commit()
    return {"updated": len(updated), "skipped": len(skipped), "updates": updated, "skips": skipped}


@router.post("/rebuild-all-trades")
def rebuild_all_trades(db: Session = Depends(get_db)):
    """Re-run the matcher on every account's executions (idempotent)."""
    rows = []
    for acct in db.query(models.Account).all():
        n = rebuild_trades_for_account(db, acct)
        rows.append({"account_id": acct.id, "external_id": acct.external_id, "trades": n})
    db.commit()
    return {"rebuilt": len(rows), "accounts": rows, "total_trades": sum(r["trades"] for r in rows)}


@router.post("/reset-everything", response_model=schemas.ResetEverythingResult)
def reset_everything(db: Session = Depends(get_db), x_confirm: str = Header(default="")):
    """Wipe all user data (keeps the seeded prop firm defs). Requires header
    `X-Confirm: DELETE EVERYTHING`."""
    if x_confirm != "DELETE EVERYTHING":
        raise HTTPException(
            400, "Missing or invalid X-Confirm header. Set 'X-Confirm: DELETE EVERYTHING' to proceed."
        )

    counts = {
        "accounts": db.query(models.Account).count(),
        "trades": db.query(models.Trade).count(),
        "executions": db.query(models.Execution).count(),
        "uploads": db.query(models.UploadBatch).count(),
        "strategies": db.query(models.Strategy).count(),
        "playbooks": db.query(models.TradingPlaybook).count(),
        "payouts": db.query(models.Payout).count(),
        "costs": db.query(models.AccountCost).count(),
        "attachments": db.query(models.TradeAttachment).count(),
    }

    attachment_paths = [a.stored_path for a in db.query(models.TradeAttachment).all()]
    upload_paths = [u.stored_path for u in db.query(models.UploadBatch).all()]

    # Children before parents (explicit, even though cascades cover much of it).
    db.query(models.TradeAttachment).delete()
    db.query(models.Execution).delete()
    db.query(models.Trade).delete()
    db.query(models.AccountCost).delete()
    db.query(models.Payout).delete()
    db.query(models.Account).delete()
    db.query(models.UploadBatch).delete()
    db.query(models.Strategy).delete()
    db.query(models.TradingPlaybook).delete()
    db.query(models.UserSettings).delete()
    db.commit()

    files_removed = 0
    for p in (*attachment_paths, *upload_paths):
        try:
            if p and os.path.exists(p):
                os.remove(p)
                files_removed += 1
        except OSError:
            pass

    db.add(models.UserSettings())  # recreate singleton
    db.commit()

    return schemas.ResetEverythingResult(
        deleted_accounts=counts["accounts"],
        deleted_trades=counts["trades"],
        deleted_executions=counts["executions"],
        deleted_uploads=counts["uploads"],
        deleted_strategies=counts["strategies"],
        deleted_playbooks=counts["playbooks"],
        deleted_payouts=counts["payouts"],
        deleted_costs=counts["costs"],
        deleted_attachments=counts["attachments"],
        files_removed=files_removed,
    )
