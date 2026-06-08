"""Idempotent schema migrations.

There is no Alembic. Append `ALTER TABLE ... ADD COLUMN IF NOT EXISTS ...`
statements here; they run on every startup after Base.metadata.create_all.
When adding a column, update three places: models.py, this list, and schemas.py.
"""
from sqlalchemy import text

ALTERS = [
    # Account: prop firm config
    "ALTER TABLE accounts ADD COLUMN IF NOT EXISTS account_type VARCHAR DEFAULT 'personal'",
    "ALTER TABLE accounts ADD COLUMN IF NOT EXISTS prop_firm VARCHAR",
    "ALTER TABLE accounts ADD COLUMN IF NOT EXISTS profit_target DOUBLE PRECISION DEFAULT 0",
    "ALTER TABLE accounts ADD COLUMN IF NOT EXISTS max_drawdown DOUBLE PRECISION DEFAULT 0",
    "ALTER TABLE accounts ADD COLUMN IF NOT EXISTS drawdown_mode VARCHAR DEFAULT 'none'",
    "ALTER TABLE accounts ADD COLUMN IF NOT EXISTS trailing_drawdown_cap DOUBLE PRECISION DEFAULT 0",
    "ALTER TABLE accounts ADD COLUMN IF NOT EXISTS max_loss_per_day DOUBLE PRECISION DEFAULT 0",
    "ALTER TABLE accounts ADD COLUMN IF NOT EXISTS payout_threshold DOUBLE PRECISION DEFAULT 0",
    "ALTER TABLE accounts ADD COLUMN IF NOT EXISTS payout_buffer DOUBLE PRECISION DEFAULT 0",
    "ALTER TABLE accounts ADD COLUMN IF NOT EXISTS min_days_between_payouts INTEGER DEFAULT 0",
    "ALTER TABLE accounts ADD COLUMN IF NOT EXISTS archived BOOLEAN DEFAULT FALSE",

    # Account: prop firm preset linkage + payout config
    "ALTER TABLE accounts ADD COLUMN IF NOT EXISTS prop_firm_key VARCHAR",
    "ALTER TABLE accounts ADD COLUMN IF NOT EXISTS prop_firm_plan_key VARCHAR",
    "ALTER TABLE accounts ADD COLUMN IF NOT EXISTS safety_net_amount DOUBLE PRECISION DEFAULT 0",
    "ALTER TABLE accounts ADD COLUMN IF NOT EXISTS extra_safety_buffer DOUBLE PRECISION DEFAULT 0",
    "ALTER TABLE accounts ADD COLUMN IF NOT EXISTS payout_min DOUBLE PRECISION DEFAULT 500",
    "ALTER TABLE accounts ADD COLUMN IF NOT EXISTS payout_caps VARCHAR",
    "ALTER TABLE accounts ADD COLUMN IF NOT EXISTS max_payouts INTEGER DEFAULT 0",
    "ALTER TABLE accounts ADD COLUMN IF NOT EXISTS min_trading_days_before_payout INTEGER DEFAULT 0",
    "ALTER TABLE accounts ADD COLUMN IF NOT EXISTS consistency_rule_pct DOUBLE PRECISION DEFAULT 0",
    "ALTER TABLE accounts ADD COLUMN IF NOT EXISTS payout_preference VARCHAR DEFAULT 'max'",
    "ALTER TABLE accounts ADD COLUMN IF NOT EXISTS payout_preference_amount DOUBLE PRECISION DEFAULT 0",
    "ALTER TABLE accounts ADD COLUMN IF NOT EXISTS contracts_micro_max INTEGER DEFAULT 0",
    "ALTER TABLE accounts ADD COLUMN IF NOT EXISTS contracts_mini_max INTEGER DEFAULT 0",

    # Account: lifecycle
    "ALTER TABLE accounts ADD COLUMN IF NOT EXISTS status VARCHAR DEFAULT 'active'",
    "ALTER TABLE accounts ADD COLUMN IF NOT EXISTS blown_date TIMESTAMP",
    "ALTER TABLE accounts ADD COLUMN IF NOT EXISTS blow_reason VARCHAR",
    "ALTER TABLE accounts ADD COLUMN IF NOT EXISTS passed_eval_date TIMESTAMP",

    # Trade: journal + planned levels
    "ALTER TABLE trades ADD COLUMN IF NOT EXISTS strategy_id INTEGER REFERENCES strategies(id)",
    "ALTER TABLE trades ADD COLUMN IF NOT EXISTS mistakes VARCHAR",
    "ALTER TABLE trades ADD COLUMN IF NOT EXISTS rating INTEGER",
    "ALTER TABLE trades ADD COLUMN IF NOT EXISTS planned_target_mode VARCHAR",
    "ALTER TABLE trades ADD COLUMN IF NOT EXISTS planned_target_value DOUBLE PRECISION",
    "ALTER TABLE trades ADD COLUMN IF NOT EXISTS planned_stop_mode VARCHAR",
    "ALTER TABLE trades ADD COLUMN IF NOT EXISTS planned_stop_value DOUBLE PRECISION",
    "ALTER TABLE trades ADD COLUMN IF NOT EXISTS planned_risk DOUBLE PRECISION",
    "ALTER TABLE trades ADD COLUMN IF NOT EXISTS planned_reward DOUBLE PRECISION",
    "ALTER TABLE trades ADD COLUMN IF NOT EXISTS planned_rr DOUBLE PRECISION",
    "ALTER TABLE trades ADD COLUMN IF NOT EXISTS realized_r DOUBLE PRECISION",

    # Broker balance reconciliation + user timezone
    "ALTER TABLE accounts ADD COLUMN IF NOT EXISTS broker_balance DOUBLE PRECISION",
    "ALTER TABLE accounts ADD COLUMN IF NOT EXISTS broker_balance_updated_at TIMESTAMP",
    "ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS timezone VARCHAR DEFAULT 'UTC'",
    "ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS date_by VARCHAR DEFAULT 'exit'",
    "ALTER TABLE accounts ADD COLUMN IF NOT EXISTS starting_balance_offset DOUBLE PRECISION DEFAULT 0",
    "ALTER TABLE accounts ADD COLUMN IF NOT EXISTS reconciliation_note TEXT",
    "ALTER TABLE accounts ADD COLUMN IF NOT EXISTS commission_rates TEXT",
    "ALTER TABLE accounts ADD COLUMN IF NOT EXISTS broker_high_water_mark DOUBLE PRECISION",

    # AccountCost: recurring monthly subscriptions
    "ALTER TABLE account_costs ADD COLUMN IF NOT EXISTS is_recurring BOOLEAN DEFAULT FALSE",
    "ALTER TABLE account_costs ADD COLUMN IF NOT EXISTS recurring_end_date TIMESTAMP",
]


def run_migrations(engine):
    with engine.begin() as conn:
        for sql in ALTERS:
            try:
                conn.execute(text(sql))
            except Exception as e:  # noqa: BLE001 — best-effort, idempotent
                print(f"[migration] skip: {sql[:80]}... ({e})")
