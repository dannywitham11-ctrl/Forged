import json as _json
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .. import models, schemas
from ..db import get_db
from ..prop import compute_prop_status
from ..services import (
    apply_preset_to_account,
    detect_account_type,
    evaluate_account_lifecycle,
    friendly_account_name,
    rebuild_trades_for_account,
)

router = APIRouter(prefix="/api/accounts", tags=["accounts"])


@router.get("", response_model=list[schemas.AccountOut])
def list_accounts(db: Session = Depends(get_db)):
    """Accounts enriched with realized_pnl / current_equity / target_reached so the
    UI can filter (hide blown, hide passed evals) without per-account round trips."""
    accts = db.query(models.Account).order_by(models.Account.display_name).all()
    if not accts:
        return []
    # Aggregate trades and payouts in two queries instead of N.
    trade_rows = db.execute(
        select(
            models.Trade.account_id,
            func.sum(models.Trade.net_pnl).label("pnl"),
            func.count(models.Trade.id).label("n"),
        ).group_by(models.Trade.account_id)
    ).all()
    payout_rows = db.execute(
        select(models.Payout.account_id, func.sum(models.Payout.amount).label("paid"))
        .group_by(models.Payout.account_id)
    ).all()
    pnl_map = {r.account_id: float(r.pnl or 0) for r in trade_rows}
    count_map = {r.account_id: int(r.n or 0) for r in trade_rows}
    paid_map = {r.account_id: float(r.paid or 0) for r in payout_rows}

    changed = False
    for a in accts:
        a.realized_pnl = pnl_map.get(a.id, 0.0)
        a.total_payouts_received = paid_map.get(a.id, 0.0)
        if a.broker_balance is not None:
            a.current_equity = a.broker_balance
        else:
            a.current_equity = (
                (a.starting_balance or 0.0)
                + (a.starting_balance_offset or 0.0)
                + a.realized_pnl
                - a.total_payouts_received
            )
        a.target_reached = bool(
            (a.profit_target or 0) > 0
            and a.current_equity >= (a.starting_balance or 0) + (a.profit_target or 0)
        )
        a.trade_count = count_map.get(a.id, 0)
        if evaluate_account_lifecycle(db, a, a.realized_pnl, a.total_payouts_received):
            changed = True
        if a.broker_balance is not None:
            a.broker_drift = round(a.current_equity - a.broker_balance, 2)
    if changed:
        db.commit()
    return accts


@router.post("", response_model=schemas.AccountOut)
def create_account(data: schemas.AccountIn, db: Session = Depends(get_db)):
    if db.query(models.Account).filter_by(external_id=data.external_id).first():
        raise HTTPException(400, "Account with this external_id already exists")
    acct = models.Account(**data.model_dump())
    db.add(acct)
    db.commit()
    db.refresh(acct)
    return acct


@router.patch("/{account_id}", response_model=schemas.AccountOut)
def update_account(account_id: int, data: schemas.AccountUpdate, db: Session = Depends(get_db)):
    acct = db.get(models.Account, account_id)
    if not acct:
        raise HTTPException(404, "Account not found")
    changed_pricing = False
    for k, v in data.model_dump(exclude_unset=True).items():
        if k in ("commission_per_side", "fees_per_side", "commission_rates") and v != getattr(acct, k):
            changed_pricing = True
        setattr(acct, k, v)
    db.commit()
    db.refresh(acct)
    if changed_pricing:
        rebuild_trades_for_account(db, acct)
        db.commit()
    return acct


@router.delete("/{account_id}")
def delete_account(account_id: int, db: Session = Depends(get_db)):
    acct = db.get(models.Account, account_id)
    if not acct:
        raise HTTPException(404, "Account not found")
    db.delete(acct)
    db.commit()
    return {"ok": True}


@router.get("/{account_id}/prop-status", response_model=schemas.PropStatus)
def account_prop_status(account_id: int, db: Session = Depends(get_db)):
    acct = db.get(models.Account, account_id)
    if not acct:
        raise HTTPException(404, "Account not found")
    status = compute_prop_status(db, acct)
    db.commit()  # in case status was auto-set to 'blown'
    return status


@router.get("/{account_id}/dd-curve", response_model=schemas.DDCurveResponse)
def account_dd_curve(account_id: int, db: Session = Depends(get_db)):
    """Equity curve + trailing drawdown floor at each trade/payout event."""
    acct = db.get(models.Account, account_id)
    if not acct:
        raise HTTPException(404, "Account not found")

    trades = (
        db.query(models.Trade).filter_by(account_id=acct.id).order_by(models.Trade.exit_time).all()
    )
    payouts = (
        db.query(models.Payout).filter_by(account_id=acct.id).order_by(models.Payout.payout_date).all()
    )
    events = []
    for t in trades:
        events.append((t.exit_time, "trade", t.net_pnl))
    for p in payouts:
        events.append((p.payout_date, "payout", -p.amount))
    events.sort(key=lambda x: x[0])

    starting = acct.starting_balance or 0
    dd = acct.max_drawdown or 0
    mode = acct.drawdown_mode or "none"
    cap_offset = acct.trailing_drawdown_cap if (acct.trailing_drawdown_cap or 0) > 0 else dd

    equity = starting + (acct.starting_balance_offset or 0)
    trailing_peak = equity
    if acct.broker_high_water_mark and acct.broker_high_water_mark > trailing_peak:
        trailing_peak = acct.broker_high_water_mark
        if cap_offset and trailing_peak > starting + cap_offset:
            trailing_peak = starting + cap_offset
    eod_peak = equity
    last_day = None

    points = []
    for ts, kind, delta in events:
        equity += delta
        if mode == "static" and dd > 0:
            floor = starting - dd
        elif mode == "trailing_realtime" and dd > 0:
            if equity > trailing_peak:
                trailing_peak = min(equity, starting + cap_offset)
            floor = trailing_peak - dd
        elif mode == "trailing_eod" and dd > 0:
            if last_day is not None and ts.date() != last_day:
                eod_peak = max(eod_peak, equity)
                if cap_offset and eod_peak > starting + cap_offset:
                    eod_peak = starting + cap_offset
            floor = eod_peak - dd
            last_day = ts.date()
        else:
            floor = equity - 1e9  # no DD configured
        points.append(schemas.DDCurvePoint(
            t=ts, equity=round(equity, 2),
            dd_floor=round(floor, 2) if dd > 0 else 0,
            cushion=round(equity - floor, 2) if dd > 0 else 0,
            event=kind, delta=round(delta, 2),
        ))

    # Broker balance is authoritative for the final equity point.
    if acct.broker_balance is not None and points:
        last_floor = points[-1].dd_floor
        points[-1] = schemas.DDCurvePoint(
            t=points[-1].t,
            equity=round(float(acct.broker_balance), 2),
            dd_floor=last_floor,
            cushion=round(float(acct.broker_balance) - last_floor, 2) if dd > 0 else 0,
            event=points[-1].event,
            delta=points[-1].delta,
        )

    return schemas.DDCurveResponse(
        account_id=acct.id,
        starting_balance=starting,
        drawdown_mode=mode,
        max_drawdown=dd,
        profit_target=acct.profit_target or 0,
        points=points,
    )


@router.post("/{account_id}/apply-preset", response_model=schemas.AccountOut)
def apply_preset(account_id: int, data: schemas.ApplyPresetIn, db: Session = Depends(get_db)):
    """Apply a stored prop firm plan preset to this account."""
    acct = db.get(models.Account, account_id)
    if not acct:
        raise HTTPException(404, "Account not found")
    firm = db.query(models.PropFirmDef).filter_by(key=data.firm_key).first()
    if not firm:
        raise HTTPException(400, f"Unknown firm {data.firm_key}")
    plan = db.query(models.PropFirmPlanDef).filter_by(firm_id=firm.id, key=data.plan_key).first()
    if not plan:
        raise HTTPException(400, f"Unknown plan {data.firm_key}/{data.plan_key}")

    apply_preset_to_account(acct, firm, plan)
    if data.firm_key == "tradovate":
        acct.commission_rates = _json.dumps({
            "MNQ": 0.39, "MES": 0.39, "M2K": 0.39, "MYM": 0.39,
            "NQ": 1.49, "ES": 1.49, "YM": 1.49, "RTY": 1.49,
            "MCL": 0.39, "CL": 1.49,
            "MGC": 0.39, "GC": 1.49,
        })
        acct.account_type = "personal"
    db.commit()
    rebuild_trades_for_account(db, acct)  # commissions/firm changed
    db.commit()
    db.refresh(acct)
    return acct


@router.post("/bulk-apply-preset", response_model=schemas.BulkApplyPresetResult)
def bulk_apply_preset(data: schemas.BulkApplyPresetIn, db: Session = Depends(get_db)):
    """Apply a firm/plan preset to many accounts at once."""
    firm = db.query(models.PropFirmDef).filter_by(key=data.firm_key).first()
    if not firm:
        raise HTTPException(400, f"Unknown firm {data.firm_key}")
    plan = db.query(models.PropFirmPlanDef).filter_by(firm_id=firm.id, key=data.plan_key).first()
    if not plan:
        raise HTTPException(400, f"Unknown plan {data.firm_key}/{data.plan_key}")

    q = db.query(models.Account)
    if data.account_type:
        q = q.filter(models.Account.account_type == data.account_type)
    if data.only_unassigned:
        q = q.filter(models.Account.prop_firm_key.is_(None))
    if data.exclude_blown:
        q = q.filter(models.Account.status != "blown")
    if data.exclude_closed:
        q = q.filter(models.Account.status != "closed")

    candidates = q.all()
    updated_ids = []
    for a in candidates:
        apply_preset_to_account(a, firm, plan)
        updated_ids.append(a.id)
    db.commit()
    return schemas.BulkApplyPresetResult(
        updated=len(updated_ids),
        account_ids=updated_ids,
        skipped=db.query(models.Account).count() - len(updated_ids),
    )


@router.post("/{account_id}/regenerate-name", response_model=schemas.AccountOut)
def regenerate_name(account_id: int, db: Session = Depends(get_db)):
    acct = db.get(models.Account, account_id)
    if not acct:
        raise HTTPException(404, "Account not found")
    plan_label = None
    firm_label = acct.prop_firm
    if acct.prop_firm_key and acct.prop_firm_plan_key:
        firm = db.query(models.PropFirmDef).filter_by(key=acct.prop_firm_key).first()
        if firm:
            firm_label = firm.label
            plan = db.query(models.PropFirmPlanDef).filter_by(firm_id=firm.id, key=acct.prop_firm_plan_key).first()
            if plan:
                plan_label = plan.label
    auto = friendly_account_name(acct.external_id, plan_label, firm_label)
    if auto:
        acct.display_name = auto
    inferred = detect_account_type(acct.external_id)
    if inferred != "personal":
        acct.account_type = inferred
    db.commit()
    db.refresh(acct)
    return acct


@router.post("/{account_id}/rebuild")
def rebuild_single_account(account_id: int, db: Session = Depends(get_db)):
    """Force a re-match of this account's trades from its raw executions."""
    acct = db.get(models.Account, account_id)
    if not acct:
        raise HTTPException(404, "Account not found")
    n = rebuild_trades_for_account(db, acct)
    db.commit()
    return {"account_id": account_id, "trades_rebuilt": n}


@router.post("/bulk-set-commissions")
def bulk_set_commissions(payload: dict, db: Session = Depends(get_db)):
    """Apply a per-root commission schedule (per side per contract) to many accounts.

    Body: {"rates": {"MNQ": 0.51, ...}, "account_type": "pa"|"eval"|null,
           "only_firm_key": "apex_intraday"|null}. Triggers a full re-match.
    """
    rates = payload.get("rates")
    if not rates or not isinstance(rates, dict):
        raise HTTPException(400, "Provide rates as {symbol_root: per_side_dollars}")
    rates_json = _json.dumps({k.upper(): float(v) for k, v in rates.items()})

    q = db.query(models.Account)
    if payload.get("account_type"):
        q = q.filter(models.Account.account_type == payload["account_type"])
    if payload.get("only_firm_key"):
        q = q.filter(models.Account.prop_firm_key == payload["only_firm_key"])
    accts = q.all()

    updated = []
    for a in accts:
        a.commission_rates = rates_json
    db.commit()
    for a in accts:
        rebuild_trades_for_account(db, a)
        updated.append(a.external_id)
    db.commit()
    return {"updated": len(updated), "rates": rates, "accounts": updated}


@router.post("/reclassify-all")
def reclassify_all_accounts(db: Session = Depends(get_db)):
    """Re-infer account_type for every account from its external_id prefix."""
    changes = []
    for acct in db.query(models.Account).all():
        new_type = detect_account_type(acct.external_id)
        if new_type != "personal" and new_type != acct.account_type:
            changes.append({
                "id": acct.id, "external_id": acct.external_id,
                "from": acct.account_type, "to": new_type,
            })
            acct.account_type = new_type
    db.commit()
    return {"updated": len(changes), "changes": changes}


@router.post("/{account_id}/mark-blown", response_model=schemas.AccountOut)
def mark_blown(account_id: int, db: Session = Depends(get_db)):
    acct = db.get(models.Account, account_id)
    if not acct:
        raise HTTPException(404, "Account not found")
    acct.status = "blown"
    acct.blown_date = datetime.utcnow()
    acct.blow_reason = "manual"
    db.commit()
    db.refresh(acct)
    return acct


@router.post("/{account_id}/reset-status", response_model=schemas.AccountOut)
def reset_status(account_id: int, db: Session = Depends(get_db)):
    acct = db.get(models.Account, account_id)
    if not acct:
        raise HTTPException(404, "Account not found")
    acct.status = "active"
    acct.blown_date = None
    acct.blow_reason = None
    db.commit()
    db.refresh(acct)
    return acct
