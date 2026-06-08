"""Pydantic request/response models.

Convention: ``*In`` for POST/PATCH bodies, ``*Out`` for responses,
``*Update`` for partial PATCH bodies (all fields optional).
"""
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict


# ---------- Accounts ----------
class AccountIn(BaseModel):
    external_id: str
    display_name: str
    broker: Optional[str] = None
    starting_balance: float = 0.0
    commission_per_side: float = 0.0
    fees_per_side: float = 0.0


class AccountOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    external_id: str
    display_name: str
    broker: Optional[str]
    starting_balance: float
    commission_per_side: float
    fees_per_side: float
    commission_rates: Optional[str] = None
    account_type: str
    prop_firm: Optional[str]
    profit_target: float
    max_drawdown: float
    drawdown_mode: str
    trailing_drawdown_cap: float
    max_loss_per_day: float
    payout_threshold: float
    payout_buffer: float
    min_days_between_payouts: int
    archived: bool
    prop_firm_key: Optional[str]
    prop_firm_plan_key: Optional[str]
    safety_net_amount: float
    extra_safety_buffer: float
    payout_min: float
    payout_caps: Optional[str]
    max_payouts: int
    min_trading_days_before_payout: int
    consistency_rule_pct: float
    payout_preference: str
    payout_preference_amount: float
    contracts_micro_max: int
    contracts_mini_max: int
    status: str
    blown_date: Optional[datetime]
    blow_reason: Optional[str]
    passed_eval_date: Optional[datetime]

    # Computed by the list endpoint (None elsewhere)
    realized_pnl: Optional[float] = None
    total_payouts_received: Optional[float] = None
    current_equity: Optional[float] = None
    target_reached: Optional[bool] = None
    trade_count: Optional[int] = None
    broker_balance: Optional[float] = None
    broker_balance_updated_at: Optional[datetime] = None
    broker_drift: Optional[float] = None
    broker_high_water_mark: Optional[float] = None
    starting_balance_offset: Optional[float] = 0.0
    reconciliation_note: Optional[str] = None


class AccountUpdate(BaseModel):
    display_name: Optional[str] = None
    broker: Optional[str] = None
    starting_balance: Optional[float] = None
    commission_per_side: Optional[float] = None
    fees_per_side: Optional[float] = None
    commission_rates: Optional[str] = None
    account_type: Optional[str] = None
    prop_firm: Optional[str] = None
    profit_target: Optional[float] = None
    max_drawdown: Optional[float] = None
    drawdown_mode: Optional[str] = None
    trailing_drawdown_cap: Optional[float] = None
    max_loss_per_day: Optional[float] = None
    payout_threshold: Optional[float] = None
    payout_buffer: Optional[float] = None
    min_days_between_payouts: Optional[int] = None
    archived: Optional[bool] = None
    prop_firm_key: Optional[str] = None
    prop_firm_plan_key: Optional[str] = None
    safety_net_amount: Optional[float] = None
    extra_safety_buffer: Optional[float] = None
    payout_min: Optional[float] = None
    payout_caps: Optional[str] = None
    max_payouts: Optional[int] = None
    min_trading_days_before_payout: Optional[int] = None
    consistency_rule_pct: Optional[float] = None
    payout_preference: Optional[str] = None
    payout_preference_amount: Optional[float] = None
    contracts_micro_max: Optional[int] = None
    contracts_mini_max: Optional[int] = None
    status: Optional[str] = None
    blown_date: Optional[datetime] = None
    blow_reason: Optional[str] = None
    passed_eval_date: Optional[datetime] = None
    broker_balance: Optional[float] = None
    broker_high_water_mark: Optional[float] = None
    starting_balance_offset: Optional[float] = None
    reconciliation_note: Optional[str] = None


class ApplyPresetIn(BaseModel):
    firm_key: str
    plan_key: str


class BulkApplyPresetIn(BaseModel):
    firm_key: str
    plan_key: str
    account_type: Optional[str] = None  # 'eval' | 'pa' | 'funded' | None = any
    only_unassigned: bool = False       # only accounts with no prop_firm_key set
    exclude_blown: bool = True
    exclude_closed: bool = True


class BulkApplyPresetResult(BaseModel):
    updated: int
    account_ids: list[int]
    skipped: int


# ---------- Prop firm CRUD ----------
class PropFirmPlanIn(BaseModel):
    key: str
    label: str
    account_size: float
    profit_target: float = 0.0
    max_drawdown: float = 0.0
    drawdown_mode_override: Optional[str] = None
    safety_net_amount: float = 0.0
    payout_caps: Optional[str] = None
    max_payouts: int = 0
    contracts_micro: int = 0
    contracts_mini: int = 0
    eval_cost_monthly: float = 0.0
    activation_fee: float = 0.0
    reset_fee: float = 0.0
    notes: Optional[str] = None


class PropFirmPlanOut(PropFirmPlanIn):
    model_config = ConfigDict(from_attributes=True)
    id: int
    firm_id: int
    archived: bool


class PropFirmPlanUpdate(BaseModel):
    key: Optional[str] = None
    label: Optional[str] = None
    account_size: Optional[float] = None
    profit_target: Optional[float] = None
    max_drawdown: Optional[float] = None
    drawdown_mode_override: Optional[str] = None
    safety_net_amount: Optional[float] = None
    payout_caps: Optional[str] = None
    max_payouts: Optional[int] = None
    contracts_micro: Optional[int] = None
    contracts_mini: Optional[int] = None
    eval_cost_monthly: Optional[float] = None
    activation_fee: Optional[float] = None
    reset_fee: Optional[float] = None
    notes: Optional[str] = None
    archived: Optional[bool] = None


class PropFirmDefIn(BaseModel):
    key: str
    label: str
    website: Optional[str] = None
    default_drawdown_mode: str = "trailing_realtime"
    default_consistency_rule_pct: float = 0.0
    default_min_trading_days_before_payout: int = 0
    default_payout_min: float = 500.0
    notes: Optional[str] = None
    verified_at: Optional[str] = None


class PropFirmDefOut(PropFirmDefIn):
    model_config = ConfigDict(from_attributes=True)
    id: int
    archived: bool
    is_custom: bool
    plans: list[PropFirmPlanOut]


class PropFirmDefUpdate(BaseModel):
    key: Optional[str] = None
    label: Optional[str] = None
    website: Optional[str] = None
    default_drawdown_mode: Optional[str] = None
    default_consistency_rule_pct: Optional[float] = None
    default_min_trading_days_before_payout: Optional[int] = None
    default_payout_min: Optional[float] = None
    notes: Optional[str] = None
    verified_at: Optional[str] = None
    archived: Optional[bool] = None


# ---------- Playbooks ----------
class TradingPlaybookIn(BaseModel):
    name: str
    description: Optional[str] = None
    account_group: str = "pa"
    contracts: int = 1
    stop_ticks: int = 10
    target_ticks: int = 20
    risk_dollars: float = 0.0
    max_trades_per_day: int = 0
    max_loss_per_day: float = 0.0


class TradingPlaybookOut(TradingPlaybookIn):
    model_config = ConfigDict(from_attributes=True)
    id: int
    archived: bool


class TradingPlaybookUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    account_group: Optional[str] = None
    contracts: Optional[int] = None
    stop_ticks: Optional[int] = None
    target_ticks: Optional[int] = None
    risk_dollars: Optional[float] = None
    max_trades_per_day: Optional[int] = None
    max_loss_per_day: Optional[float] = None
    archived: Optional[bool] = None


# ---------- User settings (singleton) ----------
class UserSettingsOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    target_pa_count: int
    monthly_budget: float
    preferred_firm_key: Optional[str]
    preferred_plan_key: Optional[str]
    dd_alert_threshold: float
    pa_playbook_id: Optional[int]
    eval_playbook_id: Optional[int]
    timezone: str
    date_by: str


class UserSettingsUpdate(BaseModel):
    target_pa_count: Optional[int] = None
    monthly_budget: Optional[float] = None
    preferred_firm_key: Optional[str] = None
    preferred_plan_key: Optional[str] = None
    dd_alert_threshold: Optional[float] = None
    pa_playbook_id: Optional[int] = None
    eval_playbook_id: Optional[int] = None
    timezone: Optional[str] = None
    date_by: Optional[str] = None


# ---------- Forecast ----------
class ForecastedPayout(BaseModel):
    account_id: int
    account_name: str
    predicted_date: datetime
    amount: float
    payout_number: int


class ForecastBucket(BaseModel):
    label: str  # "Next 1 week", "Next 2 months"
    end_date: datetime
    payouts: list[ForecastedPayout]
    total: float


class PayoutForecast(BaseModel):
    buckets: list[ForecastBucket]
    total_next_6_months: float
    all_predicted: list[ForecastedPayout]


# ---------- Plan / strategy ----------
class AccountETA(BaseModel):
    account_id: int
    display_name: str
    prop_firm: Optional[str]
    account_type: str
    status: str
    current_equity: float
    # True when current_equity reflects the broker's authoritative balance.
    uses_broker_balance: bool = False

    days_to_funded: Optional[int]  # eval -> hitting profit target
    eta_funded_date: Optional[datetime]

    days_to_min_payout: Optional[int]
    eta_min_payout_date: Optional[datetime]
    min_payout_amount: float

    days_to_max_payout: Optional[int]
    eta_max_payout_date: Optional[datetime]
    max_payout_amount: float

    recent_avg_daily_pnl: float
    blocked_reason: Optional[str]  # e.g. "Account blown" / "Consistency violated"


class StricterPlaybookSuggestion(BaseModel):
    triggered: bool
    reason: Optional[str]
    current: Optional[TradingPlaybookOut]
    suggested_contracts: Optional[int]
    suggested_stop_ticks: Optional[int]
    suggested_target_ticks: Optional[int]
    explanation: Optional[str]


class AccountPurchaseSuggestion(BaseModel):
    needed: int
    affordable_now: int
    next_purchase_date: Optional[datetime]
    suggested_firm_key: Optional[str]
    suggested_plan_key: Optional[str]
    monthly_recurring_after: float
    notes: list[str]


class PlanSummary(BaseModel):
    settings: UserSettingsOut
    etas: list[AccountETA]
    purchase_suggestion: AccountPurchaseSuggestion
    stricter_pa_suggestion: StricterPlaybookSuggestion
    stricter_eval_suggestion: StricterPlaybookSuggestion
    pa_playbook: Optional[TradingPlaybookOut]
    eval_playbook: Optional[TradingPlaybookOut]
    aggregate_dd_today: float  # combined realized drawdown today across selected accounts
    dd_alert_breached: bool


class MarketDataBarOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    ts: datetime
    o: float
    h: float
    l: float
    c: float
    v: float


class MarketDataUploadResult(BaseModel):
    symbol: str
    timeframe: str
    parsed: int
    inserted: int
    skipped_duplicates: int
    price_divisor: float
    earliest: Optional[datetime]
    latest: Optional[datetime]
    notes: list[str]


class MarketDataSummaryRow(BaseModel):
    symbol: str
    timeframe: str
    bar_count: int
    earliest: datetime
    latest: datetime
    sources: list[str]


class YahooFetchResult(BaseModel):
    symbol: str
    yahoo_symbol: str
    timeframe: str
    bars: int
    notes: list[str]


class TradeAttachmentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    trade_id: int
    filename: str
    mime_type: Optional[str]
    kind: str
    size_bytes: int
    created_at: datetime
    url: str  # /api/trades/attachments/{id}/file


class ResetEverythingResult(BaseModel):
    deleted_accounts: int
    deleted_trades: int
    deleted_executions: int
    deleted_uploads: int
    deleted_strategies: int
    deleted_playbooks: int
    deleted_payouts: int
    deleted_costs: int
    deleted_attachments: int
    files_removed: int


class AccountCostIn(BaseModel):
    account_id: Optional[int] = None
    prop_firm_key: Optional[str] = None
    category: str
    amount: float
    cost_date: datetime
    description: Optional[str] = None
    is_recurring: bool = False
    recurring_end_date: Optional[datetime] = None


class AccountCostUpdate(BaseModel):
    """All fields optional; only sent values are applied."""
    account_id: Optional[int] = None
    prop_firm_key: Optional[str] = None
    category: Optional[str] = None
    amount: Optional[float] = None
    cost_date: Optional[datetime] = None
    description: Optional[str] = None
    is_recurring: Optional[bool] = None
    recurring_end_date: Optional[datetime] = None


class AccountCostOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    account_id: Optional[int]
    prop_firm_key: Optional[str]
    category: str
    amount: float
    cost_date: datetime
    description: Optional[str]
    is_recurring: bool = False
    recurring_end_date: Optional[datetime] = None
    # amount * cycles_elapsed for recurring, otherwise = amount.
    effective_total: float = 0.0
    cycles_elapsed: int = 1


# ---------- Executions ----------
class ExecutionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    account_id: int
    trade_id: Optional[int]
    fill_id: str
    fill_time: datetime
    symbol: str
    side: str
    quantity: int
    fill_price: float
    order_type: Optional[str]
    open_close: Optional[str]
    position_after: Optional[int]
    high_during_position: Optional[float] = None
    low_during_position: Optional[float] = None


# ---------- Trades ----------
class TradeOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    account_id: int
    strategy_id: Optional[int]
    symbol: str
    instrument_root: str
    side: str
    entry_time: datetime
    exit_time: datetime
    quantity: int
    avg_entry_price: float
    avg_exit_price: float
    gross_pnl: float
    commissions: float
    fees: float
    net_pnl: float
    duration_seconds: int
    mfe: Optional[float]
    mae: Optional[float]
    mfe_pnl: Optional[float]
    mae_pnl: Optional[float]
    point_value: float

    notes: Optional[str] = None
    tags: Optional[str] = None
    mistakes: Optional[str] = None
    rating: Optional[int] = None

    planned_target_mode: Optional[str] = None
    planned_target_value: Optional[float] = None
    planned_stop_mode: Optional[str] = None
    planned_stop_value: Optional[float] = None
    planned_risk: Optional[float] = None
    planned_reward: Optional[float] = None
    planned_rr: Optional[float] = None
    realized_r: Optional[float] = None

    trade_date: datetime


class TradeUpdate(BaseModel):
    notes: Optional[str] = None
    tags: Optional[str] = None
    mistakes: Optional[str] = None
    rating: Optional[int] = None
    strategy_id: Optional[int] = None
    planned_target_mode: Optional[str] = None  # 'price' | 'ticks' | null
    planned_target_value: Optional[float] = None
    planned_stop_mode: Optional[str] = None
    planned_stop_value: Optional[float] = None


# ---------- Strategies ----------
class StrategyIn(BaseModel):
    name: str
    description: Optional[str] = None
    color: str = "#6ee7b7"


class StrategyOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    description: Optional[str]
    color: str
    archived: bool


class StrategyUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    color: Optional[str] = None
    archived: Optional[bool] = None


# ---------- Payouts ----------
class PayoutIn(BaseModel):
    account_id: int
    payout_date: datetime
    amount: float
    notes: Optional[str] = None


class PayoutOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    account_id: int
    payout_date: datetime
    amount: float
    notes: Optional[str]


# ---------- Upload ----------
class UploadResult(BaseModel):
    batch_id: int
    filename: str
    parsed_rows: int
    inserted_executions: int
    skipped_duplicates: int
    trades_built: int
    accounts_touched: list[str]
    detected_format: Optional[str] = None  # 'sierra' | 'ninjatrader'


# ---------- Stats ----------
class StatCards(BaseModel):
    net_pnl: float
    gross_pnl: float
    total_commissions: float
    current_equity: float
    starting_balance: float
    return_pct: float
    total_payouts: float

    trade_count: int
    win_count: int
    loss_count: int
    breakeven_count: int
    win_rate: float
    profit_factor: float

    avg_win: float
    avg_loss: float
    payoff_ratio: float
    largest_win: float
    largest_loss: float

    expectancy: float
    expectancy_r: float
    avg_hold_seconds: float
    avg_winner_hold_seconds: float
    avg_loser_hold_seconds: float

    max_consec_wins: int
    max_consec_losses: int
    current_streak: int
    total_contracts: int

    trading_days: int
    winning_days: int
    losing_days: int
    breakeven_days: int
    day_win_rate: float
    avg_winning_day: float
    avg_losing_day: float
    largest_winning_day: float
    largest_losing_day: float
    avg_daily_pnl: float
    avg_daily_volume: float
    avg_trades_per_day: float

    max_drawdown: float
    max_drawdown_pct: float
    current_drawdown: float

    avg_planned_rr: Optional[float] = None
    avg_realized_r: Optional[float] = None
    plan_adherence: Optional[float] = None
    mistake_rate: Optional[float] = None
    avg_rating: Optional[float] = None

    # Broker balance reconciliation (when ≥1 account has broker_balance set)
    broker_total: Optional[float] = None
    broker_pnl: Optional[float] = None
    uses_broker_balance: bool = False
    broker_accounts_covered: int = 0
    broker_accounts_total: int = 0


class EquityPoint(BaseModel):
    t: datetime
    equity: float
    trade_id: int


class DrawdownPoint(BaseModel):
    t: datetime
    drawdown: float
    trade_id: int


class DailyPnl(BaseModel):
    date: str
    net_pnl: float
    trade_count: int
    win_count: int
    loss_count: int


class BreakdownRow(BaseModel):
    key: str
    net_pnl: float
    trade_count: int
    win_rate: float


class InsightSub(BaseModel):
    key: str
    label: str
    score: float  # 0..100
    weight: float
    value_display: str


class InsightScore(BaseModel):
    score: float  # 0..100 overall
    grade: str  # A+/A/B/C/D/F
    components: list[InsightSub]
    summary: str


class FullStats(BaseModel):
    cards: StatCards
    equity_curve: list[EquityPoint]
    drawdown_curve: list[DrawdownPoint]
    daily: list[DailyPnl]
    by_symbol: list[BreakdownRow]
    by_dow: list[BreakdownRow]
    by_hour: list[BreakdownRow]
    by_side: list[BreakdownRow]
    by_strategy: list[BreakdownRow]
    by_mistake: list[BreakdownRow]
    pnl_distribution: list[dict]
    insight: InsightScore


# ---------- Prop firm ----------
class DDCurvePoint(BaseModel):
    t: datetime
    equity: float
    dd_floor: float
    cushion: float  # equity - dd_floor (negative = blown)
    event: str  # 'trade' | 'payout'
    delta: float  # the equity change at this point


class DDCurveResponse(BaseModel):
    account_id: int
    starting_balance: float
    drawdown_mode: str
    max_drawdown: float
    profit_target: float
    points: list[DDCurvePoint]


class PropStatus(BaseModel):
    account_id: int
    account_type: str
    prop_firm: Optional[str]
    starting_balance: float
    current_equity: float
    realized_pnl: float
    total_payouts: float
    high_water_mark: float
    status: str

    drawdown_mode: str
    drawdown_floor: float
    distance_to_drawdown: float
    drawdown_used_pct: float
    blown: bool
    blown_date: Optional[datetime]
    blow_reason: Optional[str]

    profit_target: float
    distance_to_target: float
    target_reached: bool

    daily_pnl_today: float
    max_loss_per_day: float
    distance_to_daily_loss: float

    # Payout state
    payouts_taken: int
    next_payout_number: int
    max_payouts: int
    is_final_payout: bool = False
    safety_net_balance: float
    safety_net_amount: float
    extra_safety_buffer: float
    available_above_safety_net: float

    payout_preference: str  # 'min'|'max'|'custom'
    payout_min: float
    payout_max_for_next: float
    payout_amount_for_next: float
    distance_to_next_payout: float
    eligible_for_payout: bool
    eligibility_reason: Optional[str]
    trading_days_used: int

    last_payout_date: Optional[datetime]
    days_since_last_payout: Optional[int]
    min_days_between_payouts: int
    min_trading_days_before_payout: int

    predicted_next_payout_date: Optional[datetime]
    predicted_next_payout_amount: Optional[float]
    avg_daily_pnl_recent: float
    days_needed_for_next: Optional[int]

    # Consistency rule (e.g. Apex 30%)
    consistency_rule_pct: float
    largest_day_pnl: float
    largest_day_pct_of_total: float  # 0..1
    consistency_compliant: bool
    max_profit_today_to_stay_consistent: Optional[float]
    extra_profit_needed_to_fix_consistency: Optional[float]


# ---------- Economics / Path to profitability ----------
class AccountEconomics(BaseModel):
    account_id: int
    display_name: str
    prop_firm: Optional[str]
    account_type: str
    status: str
    starting_balance: float
    current_equity: float
    realized_pnl: float
    total_paid_out: float
    total_costs: float
    net_real: float  # payouts_received - costs (real money in pocket)
    days_active: int


class EconomicsSummary(BaseModel):
    total_costs: float
    total_payouts_received: float
    net_real_pnl: float
    paper_pnl_active_accounts: float
    blown_accounts: int
    active_accounts: int
    funded_accounts: int
    break_even_progress_pct: float
    amount_to_break_even: float
    days_to_break_even: Optional[int]
    cost_breakdown: dict[str, float]
    per_account: list[AccountEconomics]
    monthly_burn_estimate: float
    runway_months: Optional[float]
    is_profitable: bool
