"""Prop firm SEED library.

Loaded into the DB on first boot; after that, edit firms/plans via the API
(GET/POST/PATCH /api/prop-firms and /api/prop-firms/{id}/plans). Values are
best-effort as of early 2026 — verify against each firm's help center before
relying on them for real-money decisions.
"""

PROP_FIRM_SEEDS = {
    "apex_intraday": {
        "label": "Apex Trader Funding (Intraday Trailing)",
        "website": "https://apextraderfunding.com",
        "default_drawdown_mode": "trailing_realtime",
        "default_consistency_rule_pct": 0.30,
        "default_min_trading_days_before_payout": 8,
        "default_payout_min": 500.0,
        "verified_at": "2026-01",
        "notes": "Intraday trailing DD. DD locks at starting once equity hits start+DD+$100. 30% consistency rule.",
        "plans": [
            {"key": "apex_25k", "label": "25K Intraday Trailing", "account_size": 25000, "profit_target": 1500, "max_drawdown": 1500, "safety_net_amount": 1600, "payout_caps": "1500,1500,1500,1500,2000,2500", "contracts_micro": 4, "contracts_mini": 0, "eval_cost_monthly": 147, "activation_fee": 130, "reset_fee": 80},
            {"key": "apex_50k", "label": "50K Intraday Trailing", "account_size": 50000, "profit_target": 3000, "max_drawdown": 2500, "safety_net_amount": 2600, "payout_caps": "2000,2000,2000,2000,2500,3000", "contracts_micro": 10, "contracts_mini": 1, "eval_cost_monthly": 167, "activation_fee": 140, "reset_fee": 80},
            {"key": "apex_75k", "label": "75K Intraday Trailing", "account_size": 75000, "profit_target": 4250, "max_drawdown": 2750, "safety_net_amount": 2850, "payout_caps": "2250,2250,2250,2250,2750,3250", "contracts_micro": 12, "contracts_mini": 1, "eval_cost_monthly": 187, "activation_fee": 140, "reset_fee": 80},
            {"key": "apex_100k", "label": "100K Intraday Trailing", "account_size": 100000, "profit_target": 6000, "max_drawdown": 3000, "safety_net_amount": 3100, "payout_caps": "2500,2500,2500,2500,3000,4000", "contracts_micro": 14, "contracts_mini": 2, "eval_cost_monthly": 207, "activation_fee": 220, "reset_fee": 80},
            {"key": "apex_150k", "label": "150K Intraday Trailing", "account_size": 150000, "profit_target": 9000, "max_drawdown": 5000, "safety_net_amount": 5100, "payout_caps": "2750,2750,2750,2750,3500,5000", "contracts_micro": 17, "contracts_mini": 2, "eval_cost_monthly": 297, "activation_fee": 220, "reset_fee": 80},
            {"key": "apex_250k", "label": "250K Intraday Trailing", "account_size": 250000, "profit_target": 15000, "max_drawdown": 6500, "safety_net_amount": 6600, "payout_caps": "3000,3000,3000,3000,4000,6500", "contracts_micro": 27, "contracts_mini": 3, "eval_cost_monthly": 517, "activation_fee": 220, "reset_fee": 80},
            {"key": "apex_300k", "label": "300K Intraday Trailing", "account_size": 300000, "profit_target": 20000, "max_drawdown": 7500, "safety_net_amount": 7600, "payout_caps": "4000,4000,4000,4000,5000,7500", "contracts_micro": 35, "contracts_mini": 4, "eval_cost_monthly": 657, "activation_fee": 340, "reset_fee": 80},
        ],
    },
    "apex_eod": {
        "label": "Apex Trader Funding (EOD Drawdown)",
        "website": "https://apextraderfunding.com",
        "default_drawdown_mode": "trailing_eod",
        "default_consistency_rule_pct": 0.30,
        "default_min_trading_days_before_payout": 8,
        "default_payout_min": 500.0,
        "verified_at": "2026-01",
        "notes": "End-of-day trailing drawdown — peak only ratchets up on the daily close. Same payout structure as Intraday.",
        "plans": [
            {"key": "apex_eod_25k", "label": "25K EOD", "account_size": 25000, "profit_target": 1500, "max_drawdown": 1500, "safety_net_amount": 1600, "payout_caps": "1500,1500,1500,1500,2000,2500", "contracts_micro": 4, "contracts_mini": 0, "eval_cost_monthly": 167, "activation_fee": 130, "reset_fee": 80},
            {"key": "apex_eod_50k", "label": "50K EOD", "account_size": 50000, "profit_target": 3000, "max_drawdown": 2000, "safety_net_amount": 2100, "payout_caps": "2000,2000,2000,2000,2500,3000", "contracts_micro": 10, "contracts_mini": 1, "eval_cost_monthly": 187, "activation_fee": 140, "reset_fee": 80},
            {"key": "apex_eod_75k", "label": "75K EOD", "account_size": 75000, "profit_target": 4250, "max_drawdown": 2250, "safety_net_amount": 2350, "payout_caps": "2250,2250,2250,2250,2750,3250", "contracts_micro": 12, "contracts_mini": 1, "eval_cost_monthly": 207, "activation_fee": 140, "reset_fee": 80},
            {"key": "apex_eod_100k", "label": "100K EOD", "account_size": 100000, "profit_target": 6000, "max_drawdown": 2500, "safety_net_amount": 2600, "payout_caps": "2500,2500,2500,2500,3000,4000", "contracts_micro": 14, "contracts_mini": 2, "eval_cost_monthly": 227, "activation_fee": 220, "reset_fee": 80},
            {"key": "apex_eod_150k", "label": "150K EOD", "account_size": 150000, "profit_target": 9000, "max_drawdown": 4000, "safety_net_amount": 4100, "payout_caps": "2750,2750,2750,2750,3500,5000", "contracts_micro": 17, "contracts_mini": 2, "eval_cost_monthly": 317, "activation_fee": 220, "reset_fee": 80},
            {"key": "apex_eod_250k", "label": "250K EOD", "account_size": 250000, "profit_target": 15000, "max_drawdown": 5000, "safety_net_amount": 5100, "payout_caps": "3000,3000,3000,3000,4000,6500", "contracts_micro": 27, "contracts_mini": 3, "eval_cost_monthly": 537, "activation_fee": 220, "reset_fee": 80},
            {"key": "apex_eod_300k", "label": "300K EOD", "account_size": 300000, "profit_target": 20000, "max_drawdown": 6000, "safety_net_amount": 6100, "payout_caps": "4000,4000,4000,4000,5000,7500", "contracts_micro": 35, "contracts_mini": 4, "eval_cost_monthly": 677, "activation_fee": 340, "reset_fee": 80},
        ],
    },
    "tpt": {
        "label": "TakeProfit Trader",
        "website": "https://takeprofittrader.com",
        "default_drawdown_mode": "trailing_eod",
        "default_consistency_rule_pct": 0.50,
        "default_min_trading_days_before_payout": 5,
        "default_payout_min": 250.0,
        "verified_at": "2026-01",
        "notes": "EOD trailing DD. 50% consistency rule. 80/20 split first $10K then 100%. Verify current rules.",
        "plans": [
            {"key": "tpt_25k", "label": "25K Combine", "account_size": 25000, "profit_target": 1500, "max_drawdown": 1500, "safety_net_amount": 0, "payout_caps": "1500,1500,1500,1500,1500,2000", "contracts_micro": 30, "contracts_mini": 3, "eval_cost_monthly": 150, "activation_fee": 0, "reset_fee": 79},
            {"key": "tpt_50k", "label": "50K Combine", "account_size": 50000, "profit_target": 3000, "max_drawdown": 2500, "safety_net_amount": 0, "payout_caps": "2500,2500,2500,2500,2500,3000", "contracts_micro": 50, "contracts_mini": 5, "eval_cost_monthly": 170, "activation_fee": 0, "reset_fee": 99},
            {"key": "tpt_75k", "label": "75K Combine", "account_size": 75000, "profit_target": 4500, "max_drawdown": 3000, "safety_net_amount": 0, "payout_caps": "3000,3000,3000,3000,3500,4000", "contracts_micro": 75, "contracts_mini": 7, "eval_cost_monthly": 245, "activation_fee": 0, "reset_fee": 119},
            {"key": "tpt_100k", "label": "100K Combine", "account_size": 100000, "profit_target": 6000, "max_drawdown": 3500, "safety_net_amount": 0, "payout_caps": "3500,3500,3500,3500,4000,5000", "contracts_micro": 100, "contracts_mini": 10, "eval_cost_monthly": 330, "activation_fee": 0, "reset_fee": 149},
            {"key": "tpt_150k", "label": "150K Combine", "account_size": 150000, "profit_target": 9000, "max_drawdown": 5000, "safety_net_amount": 0, "payout_caps": "5000,5000,5000,5000,5000,6000", "contracts_micro": 150, "contracts_mini": 15, "eval_cost_monthly": 360, "activation_fee": 0, "reset_fee": 199},
        ],
    },
    "lucid": {
        "label": "Lucid Trading",
        "website": "https://lucidtrading.com",
        "default_drawdown_mode": "trailing_eod",
        "default_consistency_rule_pct": 0.30,
        "default_min_trading_days_before_payout": 7,
        "default_payout_min": 500.0,
        "verified_at": "2026-01",
        "notes": "Newer firm — payout schedule and contract limits vary by promotion. Verify before relying.",
        "plans": [
            {"key": "lucid_25k", "label": "25K", "account_size": 25000, "profit_target": 1500, "max_drawdown": 1500, "safety_net_amount": 1600, "payout_caps": "1500,1500,1500,1500,2000", "contracts_micro": 5, "contracts_mini": 0, "eval_cost_monthly": 99, "activation_fee": 100, "reset_fee": 75},
            {"key": "lucid_50k", "label": "50K", "account_size": 50000, "profit_target": 3000, "max_drawdown": 2500, "safety_net_amount": 2600, "payout_caps": "2000,2000,2000,2000,2500", "contracts_micro": 10, "contracts_mini": 1, "eval_cost_monthly": 129, "activation_fee": 100, "reset_fee": 75},
            {"key": "lucid_100k", "label": "100K", "account_size": 100000, "profit_target": 6000, "max_drawdown": 3000, "safety_net_amount": 3100, "payout_caps": "3000,3000,3000,3000,4000", "contracts_micro": 15, "contracts_mini": 2, "eval_cost_monthly": 199, "activation_fee": 150, "reset_fee": 75},
            {"key": "lucid_150k", "label": "150K", "account_size": 150000, "profit_target": 9000, "max_drawdown": 4500, "safety_net_amount": 4600, "payout_caps": "4000,4000,4000,4000,5000", "contracts_micro": 20, "contracts_mini": 2, "eval_cost_monthly": 269, "activation_fee": 150, "reset_fee": 75},
        ],
    },
    "tradovate": {
        "label": "Tradovate (Personal / Broker Account)",
        "website": "https://tradovate.com",
        "default_drawdown_mode": "none",
        "default_consistency_rule_pct": 0.0,
        "default_min_trading_days_before_payout": 0,
        "default_payout_min": 0.0,
        "verified_at": "2026-05",
        "notes": "Personal Tradovate broker account — not a prop firm. No DD limits, no profit targets, no payout rules. Use for trade tracking & analytics. Commissions reflect Tradovate's standard tier ($0.39/side micros, $1.49/side standards) — adjust if you're on Active Trader / Lifetime tiers.",
        "plans": [
            {"key": "tradovate_personal", "label": "Personal Account", "account_size": 0,
             "profit_target": 0, "max_drawdown": 0, "safety_net_amount": 0,
             "payout_caps": "0", "max_payouts": 0,
             "contracts_micro": 999, "contracts_mini": 999,
             "eval_cost_monthly": 0, "activation_fee": 0, "reset_fee": 0,
             "notes": "Apply to set Tradovate-standard commission rates"},
        ],
    },
    "tradeify": {
        "label": "Tradeify",
        "website": "https://tradeify.co",
        "default_drawdown_mode": "trailing_eod",
        "default_consistency_rule_pct": 0.35,
        "default_min_trading_days_before_payout": 5,
        "default_payout_min": 250.0,
        "verified_at": "2026-06",
        "notes": "Growth program: 2-step eval, EOD trailing DD, no consistency rule in eval but 35% once funded, 5-day Sim Funded payout cycle. Per-size profit targets/DDs/contract limits are best-estimates from public pricing widget — verify against your dashboard and edit if wrong.",
        "plans": [
            {"key": "tradeify_growth_25k", "label": "Growth 25K", "account_size": 25000, "profit_target": 1500, "max_drawdown": 1500, "safety_net_amount": 1600, "payout_caps": "1500,1500,1500,1500,2000", "contracts_micro": 5, "contracts_mini": 0, "eval_cost_monthly": 99, "activation_fee": 130, "reset_fee": 40},
            {"key": "tradeify_growth_50k", "label": "Growth 50K", "account_size": 50000, "profit_target": 3000, "max_drawdown": 2500, "safety_net_amount": 2600, "payout_caps": "2000,2000,2000,2000,2500,3000", "contracts_micro": 10, "contracts_mini": 1, "eval_cost_monthly": 111, "activation_fee": 140, "reset_fee": 45},
            {"key": "tradeify_growth_100k", "label": "Growth 100K", "account_size": 100000, "profit_target": 6000, "max_drawdown": 3500, "safety_net_amount": 3600, "payout_caps": "2500,2500,2500,2500,3000,4000", "contracts_micro": 15, "contracts_mini": 2, "eval_cost_monthly": 181, "activation_fee": 220, "reset_fee": 70},
            {"key": "tradeify_growth_150k", "label": "Growth 150K", "account_size": 150000, "profit_target": 9000, "max_drawdown": 4500, "safety_net_amount": 4600, "payout_caps": "2750,2750,2750,2750,3500,5000", "contracts_micro": 20, "contracts_mini": 2, "eval_cost_monthly": 251, "activation_fee": 220, "reset_fee": 100},
        ],
    },
    "topstep": {
        "label": "TopstepTrader",
        "website": "https://topstep.com",
        "default_drawdown_mode": "trailing_eod",
        "default_consistency_rule_pct": 0.50,
        "default_min_trading_days_before_payout": 5,
        "default_payout_min": 250.0,
        "verified_at": "2026-01",
        "notes": "EOD trailing DD. 50% consistency rule. Verify current rules.",
        "plans": [
            {"key": "topstep_50k", "label": "50K Combine", "account_size": 50000, "profit_target": 3000, "max_drawdown": 2000, "safety_net_amount": 0, "payout_caps": "5000,5000,5000,5000,5000,5000", "contracts_micro": 50, "contracts_mini": 5, "eval_cost_monthly": 49, "activation_fee": 149, "reset_fee": 49},
            {"key": "topstep_100k", "label": "100K Combine", "account_size": 100000, "profit_target": 6000, "max_drawdown": 3000, "safety_net_amount": 0, "payout_caps": "5000,5000,5000,5000,5000,5000", "contracts_micro": 100, "contracts_mini": 10, "eval_cost_monthly": 99, "activation_fee": 149, "reset_fee": 99},
            {"key": "topstep_150k", "label": "150K Combine", "account_size": 150000, "profit_target": 9000, "max_drawdown": 4500, "safety_net_amount": 0, "payout_caps": "5000,5000,5000,5000,5000,5000", "contracts_micro": 150, "contracts_mini": 15, "eval_cost_monthly": 149, "activation_fee": 149, "reset_fee": 149},
        ],
    },
}


def seed_prop_firms(db):
    """Idempotently seed firm/plan rows. Never overwrites user edits; adds any
    plan keys that don't exist yet so new presets can ship on update."""
    from . import models

    for firm_key, firm in PROP_FIRM_SEEDS.items():
        existing = db.query(models.PropFirmDef).filter_by(key=firm_key).first()
        if not existing:
            f = models.PropFirmDef(
                key=firm_key,
                label=firm["label"],
                website=firm["website"],
                default_drawdown_mode=firm["default_drawdown_mode"],
                default_consistency_rule_pct=firm["default_consistency_rule_pct"],
                default_min_trading_days_before_payout=firm["default_min_trading_days_before_payout"],
                default_payout_min=firm["default_payout_min"],
                notes=firm["notes"],
                verified_at=firm["verified_at"],
                is_custom=False,
            )
            db.add(f)
            db.flush()
            for p in firm["plans"]:
                db.add(models.PropFirmPlanDef(firm_id=f.id, **p))
        else:
            for p in firm["plans"]:
                if not db.query(models.PropFirmPlanDef).filter_by(firm_id=existing.id, key=p["key"]).first():
                    db.add(models.PropFirmPlanDef(firm_id=existing.id, **p))
    db.commit()
