const BASE = (import.meta as any).env?.VITE_API_BASE || ''

export type Account = {
  id: number
  external_id: string
  display_name: string
  broker: string | null
  starting_balance: number
  commission_per_side: number
  fees_per_side: number
  account_type: string
  prop_firm: string | null
  profit_target: number
  max_drawdown: number
  drawdown_mode: string
  trailing_drawdown_cap: number
  max_loss_per_day: number
  payout_threshold: number
  payout_buffer: number
  min_days_between_payouts: number
  archived: boolean
  prop_firm_key: string | null
  prop_firm_plan_key: string | null
  safety_net_amount: number
  extra_safety_buffer: number
  payout_min: number
  payout_caps: string | null
  max_payouts: number
  min_trading_days_before_payout: number
  consistency_rule_pct: number
  payout_preference: 'min' | 'max' | 'custom'
  payout_preference_amount: number
  contracts_micro_max: number
  contracts_mini_max: number
  status: 'active' | 'passed_eval' | 'funded' | 'blown' | 'paid_out' | 'closed'
  blown_date: string | null
  blow_reason: string | null
  passed_eval_date: string | null

  // Computed by the list endpoint
  realized_pnl: number | null
  total_payouts_received: number | null
  current_equity: number | null
  target_reached: boolean | null
  trade_count: number | null
  broker_balance: number | null
  broker_balance_updated_at: string | null
  broker_drift: number | null
  broker_high_water_mark: number | null
  starting_balance_offset: number | null
  reconciliation_note: string | null
}

export type PropFirmPlan = {
  id: number
  firm_id: number
  key: string; label: string; account_size: number
  profit_target: number; max_drawdown: number; safety_net_amount: number
  payout_caps: string | null   // CSV in DB
  max_payouts: number
  contracts_micro: number; contracts_mini: number
  eval_cost_monthly: number; activation_fee: number; reset_fee: number
  drawdown_mode_override: string | null
  notes: string | null; archived: boolean
}
export type PropFirm = {
  id: number
  key: string; label: string; website: string | null
  default_drawdown_mode: string
  default_consistency_rule_pct: number
  default_min_trading_days_before_payout: number
  default_payout_min: number
  verified_at: string | null; notes: string | null
  is_custom: boolean; archived: boolean
  plans: PropFirmPlan[]
}

export type TradingPlaybook = {
  id: number; name: string; description: string | null
  account_group: string  // 'pa' | 'eval' | 'all' | custom
  contracts: number; stop_ticks: number; target_ticks: number
  risk_dollars: number; max_trades_per_day: number; max_loss_per_day: number
  archived: boolean
}

export type UserSettings = {
  id: number
  target_pa_count: number; monthly_budget: number
  preferred_firm_key: string | null; preferred_plan_key: string | null
  dd_alert_threshold: number
  pa_playbook_id: number | null; eval_playbook_id: number | null
  timezone: string
  date_by: 'exit' | 'entry'
}

export type ForecastedPayout = {
  account_id: number; account_name: string
  predicted_date: string; amount: number; payout_number: number
}
export type ForecastBucket = {
  label: string; end_date: string
  payouts: ForecastedPayout[]; total: number
}
export type PayoutForecast = {
  buckets: ForecastBucket[]
  total_next_6_months: number
  all_predicted: ForecastedPayout[]
}

export type AccountETA = {
  account_id: number; display_name: string; prop_firm: string | null
  account_type: string; status: string; current_equity: number
  uses_broker_balance: boolean
  days_to_funded: number | null; eta_funded_date: string | null
  days_to_min_payout: number | null; eta_min_payout_date: string | null; min_payout_amount: number
  days_to_max_payout: number | null; eta_max_payout_date: string | null; max_payout_amount: number
  recent_avg_daily_pnl: number; blocked_reason: string | null
}

export type StricterPlaybookSuggestion = {
  triggered: boolean; reason: string | null
  current: TradingPlaybook | null
  suggested_contracts: number | null
  suggested_stop_ticks: number | null
  suggested_target_ticks: number | null
  explanation: string | null
}

export type AccountPurchaseSuggestion = {
  needed: number; affordable_now: number
  next_purchase_date: string | null
  suggested_firm_key: string | null; suggested_plan_key: string | null
  monthly_recurring_after: number; notes: string[]
}

export type PlanSummary = {
  settings: UserSettings
  etas: AccountETA[]
  purchase_suggestion: AccountPurchaseSuggestion
  stricter_pa_suggestion: StricterPlaybookSuggestion
  stricter_eval_suggestion: StricterPlaybookSuggestion
  pa_playbook: TradingPlaybook | null
  eval_playbook: TradingPlaybook | null
  aggregate_dd_today: number
  dd_alert_breached: boolean
}

export type MarketDataBar = {
  ts: string; o: number; h: number; l: number; c: number; v: number
}
export type MarketDataSummaryRow = {
  symbol: string; timeframe: string; bar_count: number
  earliest: string; latest: string; sources: string[]
}
export type MarketDataUploadResult = {
  symbol: string; timeframe: string
  parsed: number; inserted: number; skipped_duplicates: number
  price_divisor: number
  earliest: string | null; latest: string | null
  notes: string[]
}
export type YahooFetchResult = {
  symbol: string; yahoo_symbol: string; timeframe: string
  bars: number; notes: string[]
}

export type TradeAttachment = {
  id: number; trade_id: number; filename: string
  mime_type: string | null; kind: string; size_bytes: number
  created_at: string; url: string
}

export type ResetEverythingResult = {
  deleted_accounts: number; deleted_trades: number; deleted_executions: number
  deleted_uploads: number; deleted_strategies: number; deleted_playbooks: number
  deleted_payouts: number; deleted_costs: number; deleted_attachments: number
  files_removed: number
}

export type AccountCost = {
  id: number; account_id: number | null; prop_firm_key: string | null
  category: string; amount: number; cost_date: string; description: string | null
  is_recurring: boolean; recurring_end_date: string | null
  effective_total: number; cycles_elapsed: number
}

export type AccountEconomics = {
  account_id: number; display_name: string; prop_firm: string | null
  account_type: string; status: string
  starting_balance: number; current_equity: number; realized_pnl: number
  total_paid_out: number; total_costs: number; net_real: number
  days_active: number
}

export type EconomicsSummary = {
  total_costs: number; total_payouts_received: number; net_real_pnl: number
  paper_pnl_active_accounts: number
  blown_accounts: number; active_accounts: number; funded_accounts: number
  break_even_progress_pct: number; amount_to_break_even: number
  days_to_break_even: number | null
  cost_breakdown: Record<string, number>
  per_account: AccountEconomics[]
  monthly_burn_estimate: number; runway_months: number | null
  is_profitable: boolean
}

export type Strategy = {
  id: number; name: string; description: string | null; color: string; archived: boolean
}

export type Payout = {
  id: number; account_id: number; payout_date: string; amount: number; notes: string | null
}

export type Trade = {
  id: number; account_id: number; strategy_id: number | null
  symbol: string; instrument_root: string
  side: 'Long' | 'Short'
  entry_time: string; exit_time: string
  quantity: number; avg_entry_price: number; avg_exit_price: number
  gross_pnl: number; commissions: number; fees: number; net_pnl: number
  duration_seconds: number
  mfe: number | null; mae: number | null; mfe_pnl: number | null; mae_pnl: number | null
  point_value: number
  notes: string | null; tags: string | null; mistakes: string | null
  rating: number | null
  planned_target_mode: 'price' | 'ticks' | null
  planned_target_value: number | null
  planned_stop_mode: 'price' | 'ticks' | null
  planned_stop_value: number | null
  planned_risk: number | null; planned_reward: number | null
  planned_rr: number | null; realized_r: number | null
  trade_date: string
}

export type Execution = {
  id: number; account_id: number; trade_id: number | null
  fill_id: string; fill_time: string; symbol: string
  side: 'Buy' | 'Sell'; quantity: number; fill_price: number
  order_type: string | null; open_close: string | null; position_after: number | null
  high_during_position: number | null; low_during_position: number | null
}

export type StatCards = {
  net_pnl: number; gross_pnl: number; total_commissions: number
  current_equity: number; starting_balance: number; return_pct: number; total_payouts: number
  trade_count: number; win_count: number; loss_count: number; breakeven_count: number
  win_rate: number; profit_factor: number
  avg_win: number; avg_loss: number; payoff_ratio: number
  largest_win: number; largest_loss: number
  expectancy: number; expectancy_r: number
  avg_hold_seconds: number; avg_winner_hold_seconds: number; avg_loser_hold_seconds: number
  max_consec_wins: number; max_consec_losses: number; current_streak: number
  total_contracts: number
  trading_days: number; winning_days: number; losing_days: number; breakeven_days: number
  day_win_rate: number; avg_winning_day: number; avg_losing_day: number
  largest_winning_day: number; largest_losing_day: number
  avg_daily_pnl: number; avg_daily_volume: number; avg_trades_per_day: number
  max_drawdown: number; max_drawdown_pct: number; current_drawdown: number
  avg_planned_rr: number | null; avg_realized_r: number | null
  plan_adherence: number | null; mistake_rate: number | null; avg_rating: number | null
  broker_total: number | null; broker_pnl: number | null
  uses_broker_balance: boolean
  broker_accounts_covered: number; broker_accounts_total: number
}

export type EquityPoint = { t: string; equity: number; trade_id: number }
export type DrawdownPoint = { t: string; drawdown: number; trade_id: number }
export type DailyPnl = { date: string; net_pnl: number; trade_count: number; win_count: number; loss_count: number }
export type BreakdownRow = { key: string; net_pnl: number; trade_count: number; win_rate: number }
export type PnlBucket = { bucket: string; count: number; low: number; high: number }
export type InsightSub = { key: string; label: string; score: number; weight: number; value_display: string }
export type InsightScore = { score: number; grade: string; components: InsightSub[]; summary: string }

export type FullStats = {
  cards: StatCards
  equity_curve: EquityPoint[]; drawdown_curve: DrawdownPoint[]
  daily: DailyPnl[]
  by_symbol: BreakdownRow[]; by_dow: BreakdownRow[]; by_hour: BreakdownRow[]; by_side: BreakdownRow[]
  by_strategy: BreakdownRow[]; by_mistake: BreakdownRow[]
  pnl_distribution: PnlBucket[]; insight: InsightScore
}

export type PropStatus = {
  account_id: number; account_type: string; prop_firm: string | null
  starting_balance: number; current_equity: number; realized_pnl: number
  total_payouts: number; high_water_mark: number; status: string
  drawdown_mode: string; drawdown_floor: number; distance_to_drawdown: number
  drawdown_used_pct: number; blown: boolean
  blown_date: string | null; blow_reason: string | null
  profit_target: number; distance_to_target: number; target_reached: boolean
  daily_pnl_today: number; max_loss_per_day: number; distance_to_daily_loss: number

  payouts_taken: number; next_payout_number: number; max_payouts: number
  is_final_payout: boolean
  safety_net_balance: number; safety_net_amount: number; extra_safety_buffer: number
  available_above_safety_net: number
  payout_preference: 'min' | 'max' | 'custom'
  payout_min: number; payout_max_for_next: number; payout_amount_for_next: number
  distance_to_next_payout: number
  eligible_for_payout: boolean; eligibility_reason: string | null
  trading_days_used: number

  last_payout_date: string | null; days_since_last_payout: number | null
  min_days_between_payouts: number
  min_trading_days_before_payout: number

  predicted_next_payout_date: string | null; predicted_next_payout_amount: number | null
  avg_daily_pnl_recent: number; days_needed_for_next: number | null

  consistency_rule_pct: number; largest_day_pnl: number; largest_day_pct_of_total: number
  consistency_compliant: boolean
  max_profit_today_to_stay_consistent: number | null
  extra_profit_needed_to_fix_consistency: number | null
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
    ...init,
  })
  if (!r.ok) {
    const text = await r.text().catch(() => '')
    throw new Error(`${r.status} ${r.statusText}: ${text}`)
  }
  return r.json()
}

function qs(params: Record<string, string | number | boolean | string[] | number[] | undefined>) {
  const u = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === '') continue
    if (Array.isArray(v)) v.forEach(x => u.append(k, String(x)))
    else u.set(k, String(v))
  }
  return u.toString()
}

export const api = {
  accounts: {
    list: () => req<Account[]>('/api/accounts'),
    ddCurve: (id: number) => req<{
      account_id: number; starting_balance: number; drawdown_mode: string;
      max_drawdown: number; profit_target: number;
      points: Array<{ t: string; equity: number; dd_floor: number; cushion: number; event: string; delta: number }>
    }>(`/api/accounts/${id}/dd-curve`),
    update: (id: number, data: Partial<Account>) =>
      req<Account>(`/api/accounts/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    propStatus: (id: number) => req<PropStatus>(`/api/accounts/${id}/prop-status`),
    applyPreset: (id: number, firm_key: string, plan_key: string) =>
      req<Account>(`/api/accounts/${id}/apply-preset`, { method: 'POST', body: JSON.stringify({ firm_key, plan_key }) }),
    markBlown: (id: number) => req<Account>(`/api/accounts/${id}/mark-blown`, { method: 'POST' }),
    resetStatus: (id: number) => req<Account>(`/api/accounts/${id}/reset-status`, { method: 'POST' }),
    regenerateName: (id: number) => req<Account>(`/api/accounts/${id}/regenerate-name`, { method: 'POST' }),
    reclassifyAll: () => req<{ updated: number; changes: any[] }>(`/api/accounts/reclassify-all`, { method: 'POST' }),
    bulkApplyPreset: (data: { firm_key: string; plan_key: string; account_type?: string; only_unassigned?: boolean; exclude_blown?: boolean; exclude_closed?: boolean }) =>
      req<{ updated: number; account_ids: number[]; skipped: number }>(`/api/accounts/bulk-apply-preset`, { method: 'POST', body: JSON.stringify(data) }),
  },
  propFirms: {
    list: () => req<PropFirm[]>('/api/prop-firms'),
    create: (data: Partial<PropFirm>) =>
      req<PropFirm>('/api/prop-firms', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: Partial<PropFirm>) =>
      req<PropFirm>(`/api/prop-firms/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    delete: (id: number) => req<{ok:boolean}>(`/api/prop-firms/${id}`, { method: 'DELETE' }),
    addPlan: (firmId: number, data: Partial<PropFirmPlan>) =>
      req<PropFirmPlan>(`/api/prop-firms/${firmId}/plans`, { method: 'POST', body: JSON.stringify(data) }),
    updatePlan: (planId: number, data: Partial<PropFirmPlan>) =>
      req<PropFirmPlan>(`/api/prop-firms/plans/${planId}`, { method: 'PATCH', body: JSON.stringify(data) }),
    deletePlan: (planId: number) =>
      req<{ok:boolean}>(`/api/prop-firms/plans/${planId}`, { method: 'DELETE' }),
  },
  playbooks: {
    list: () => req<TradingPlaybook[]>('/api/playbooks'),
    create: (data: Partial<TradingPlaybook>) =>
      req<TradingPlaybook>('/api/playbooks', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: Partial<TradingPlaybook>) =>
      req<TradingPlaybook>(`/api/playbooks/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    delete: (id: number) => req<{ok:boolean}>(`/api/playbooks/${id}`, { method: 'DELETE' }),
  },
  settings: {
    get: () => req<UserSettings>('/api/settings'),
    update: (data: Partial<UserSettings>) =>
      req<UserSettings>('/api/settings', { method: 'PATCH', body: JSON.stringify(data) }),
  },
  plan: {
    summary: () => req<PlanSummary>('/api/plan'),
    forecast: () => req<PayoutForecast>('/api/plan/forecast'),
  },
  costs: {
    list: (account_id?: number) => req<AccountCost[]>(`/api/account-costs?${qs({ account_id })}`),
    create: (data: { account_id?: number; prop_firm_key?: string; category: string; amount: number; cost_date: string; description?: string; is_recurring?: boolean; recurring_end_date?: string | null }) =>
      req<AccountCost>('/api/account-costs', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: Partial<{ account_id: number | null; prop_firm_key: string | null; category: string; amount: number; cost_date: string; description: string | null; is_recurring: boolean; recurring_end_date: string | null }>) =>
      req<AccountCost>(`/api/account-costs/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    delete: (id: number) => req<{ok:boolean}>(`/api/account-costs/${id}`, { method: 'DELETE' }),
  },
  economics: () => req<EconomicsSummary>('/api/economics'),
  strategies: {
    list: () => req<Strategy[]>('/api/strategies'),
    create: (data: { name: string; description?: string; color?: string }) =>
      req<Strategy>('/api/strategies', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: Partial<Strategy>) =>
      req<Strategy>(`/api/strategies/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    delete: (id: number) => req<{ok:boolean}>(`/api/strategies/${id}`, { method: 'DELETE' }),
  },
  payouts: {
    list: (account_id?: number) => req<Payout[]>(`/api/payouts?${qs({ account_id })}`),
    create: (data: { account_id: number; payout_date: string; amount: number; notes?: string }) =>
      req<Payout>('/api/payouts', { method: 'POST', body: JSON.stringify(data) }),
    delete: (id: number) => req<{ok:boolean}>(`/api/payouts/${id}`, { method: 'DELETE' }),
  },
  trades: {
    list: (params: { account_ids?: number[]; symbol?: string; side?: string; from_date?: string; to_date?: string; win_only?: string; strategy_id?: number; has_mistakes?: boolean; limit?: number }) =>
      req<Trade[]>(`/api/trades?${qs(params as any)}`),
    get: (id: number) => req<Trade>(`/api/trades/${id}`),
    update: (id: number, data: Partial<Trade>) =>
      req<Trade>(`/api/trades/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    executions: (id: number) => req<Execution[]>(`/api/trades/${id}/executions`),
    listAttachments: (id: number) => req<TradeAttachment[]>(`/api/trades/${id}/attachments`),
    uploadAttachment: async (id: number, file: File, kind = 'screenshot') => {
      const fd = new FormData(); fd.append('file', file); fd.append('kind', kind)
      const r = await fetch(`${BASE}/api/trades/${id}/attachments`, { method: 'POST', body: fd })
      if (!r.ok) throw new Error(`${r.status}: ${await r.text()}`)
      return r.json() as Promise<TradeAttachment>
    },
    deleteAttachment: (id: number) => req<{ok:boolean}>(`/api/trades/attachments/${id}`, { method: 'DELETE' }),
  },
  marketData: {
    summary: () => req<MarketDataSummaryRow[]>('/api/market-data/summary'),
    bars: (symbol: string, fromDt: string, toDt: string, timeframe = '1m') =>
      req<MarketDataBar[]>(`/api/market-data/bars?${qs({ symbol, from: fromDt, to: toDt, timeframe })}`),
    upload: async (file: File, symbol: string, timeframe = '1m', priceDivisor?: number) => {
      const fd = new FormData()
      fd.append('file', file); fd.append('symbol', symbol); fd.append('timeframe', timeframe)
      if (priceDivisor != null) fd.append('price_divisor', String(priceDivisor))
      const r = await fetch(`${BASE}/api/market-data/upload`, { method: 'POST', body: fd })
      if (!r.ok) throw new Error(`${r.status}: ${await r.text()}`)
      return r.json() as Promise<MarketDataUploadResult>
    },
    uploadScid: async (file: File, symbol: string, timeframe = '1m') => {
      const fd = new FormData()
      fd.append('file', file); fd.append('symbol', symbol); fd.append('timeframe', timeframe)
      const r = await fetch(`${BASE}/api/market-data/upload-scid`, { method: 'POST', body: fd })
      if (!r.ok) throw new Error(`${r.status}: ${await r.text()}`)
      return r.json() as Promise<MarketDataUploadResult>
    },
    sierraFiles: () => req<{mounted: boolean; path: string; files: Array<{filename: string; size_bytes: number; modified: number}>; hint?: string}>('/api/market-data/sierra/files'),
    sierraImport: async (filename: string, symbol: string, timeframe = '1m') => {
      const fd = new FormData()
      fd.append('filename', filename); fd.append('symbol', symbol); fd.append('timeframe', timeframe)
      const r = await fetch(`${BASE}/api/market-data/sierra/import`, { method: 'POST', body: fd })
      if (!r.ok) throw new Error(`${r.status}: ${await r.text()}`)
      return r.json() as Promise<MarketDataUploadResult>
    },
    yahooFetch: async (symbol: string, timeframe = '1m', days = 7) => {
      const fd = new FormData()
      fd.append('symbol', symbol); fd.append('timeframe', timeframe); fd.append('days', String(days))
      const r = await fetch(`${BASE}/api/market-data/yahoo-fetch`, { method: 'POST', body: fd })
      if (!r.ok) throw new Error(`${r.status}: ${await r.text()}`)
      return r.json() as Promise<YahooFetchResult>
    },
    deleteSymbol: (symbol: string, timeframe?: string) =>
      req<{deleted:number}>(`/api/market-data/symbol/${encodeURIComponent(symbol)}?${qs({ timeframe })}`,
        { method: 'DELETE' }),
  },
  tradeAccountData: {
    scan: () => req<{
      mounted: boolean
      files: Array<{ path: string; name: string; size: number }>
    }>('/api/admin/tradeaccount-data/scan'),
    importAll: () => req<{
      updated: number; skipped: number
      updates: Array<{ external_id: string; previous: number | null; new: number }>
      skips: Array<{ name: string; reason: string }>
    }>('/api/admin/tradeaccount-data/import-all', { method: 'POST' }),
    importOne: async (file: File) => {
      const fd = new FormData()
      fd.append('file', file)
      const r = await fetch(`${BASE}/api/admin/import-tradeaccount-data`, { method: 'POST', body: fd })
      if (!r.ok) throw new Error(`${r.status}: ${await r.text()}`)
      return r.json() as Promise<{
        external_id: string; currency: string
        previous_balance: number | null; new_balance: number
        high_water_mark: number | null; session_pnl: number | null
      }>
    },
  },
  admin: {
    resetEverything: async () => {
      const r = await fetch(`${BASE}/api/admin/reset-everything`, {
        method: 'POST', headers: { 'X-Confirm': 'DELETE EVERYTHING' }
      })
      if (!r.ok) throw new Error(`${r.status}: ${await r.text()}`)
      return r.json() as Promise<ResetEverythingResult>
    },
  },
  accountDelete: (id: number) => req<{ok:boolean}>(`/api/accounts/${id}`, { method: 'DELETE' }),
  stats: (params: { account_ids?: number[]; symbol?: string; strategy_id?: number; from_date?: string; to_date?: string }) =>
    req<FullStats>(`/api/stats?${qs(params as any)}`),
  upload: async (file: File) => {
    const fd = new FormData()
    fd.append('file', file)
    const r = await fetch(`${BASE}/api/uploads`, { method: 'POST', body: fd })
    if (!r.ok) throw new Error(`${r.status} ${await r.text()}`)
    return r.json() as Promise<{
      batch_id: number; filename: string; parsed_rows: number;
      inserted_executions: number; skipped_duplicates: number;
      trades_built: number; accounts_touched: string[];
      detected_format: 'sierra' | 'ninjatrader' | null;
    }>
  },
  uploads: () => req<any[]>('/api/uploads'),
}

/**
 * Parse a backend timestamp as UTC.
 *
 * The backend stores all times as naive UTC and serializes them without a tz
 * marker (e.g. "2026-05-15T14:00:00"). Browsers would parse such strings as
 * LOCAL time, shifting them by the user's offset — always parse via this helper.
 */
export function parseBackendTime(s: string): Date {
  if (!s) return new Date(NaN)
  if (s.endsWith('Z') || /[+-]\d\d:?\d\d$/.test(s)) return new Date(s)
  return new Date(s + 'Z')
}

export function fmtUsd(n: number, opts?: { signed?: boolean }) {
  const abs = Math.abs(n)
  const s = abs.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const sign = n < 0 ? '-' : (opts?.signed && n > 0 ? '+' : '')
  return `${sign}$${s}`
}
export function fmtPct(x: number, digits = 1) { return `${(x * 100).toFixed(digits)}%` }
export function fmtDuration(sec: number) {
  if (!sec) return '0s'
  if (sec < 60) return `${Math.round(sec)}s`
  if (sec < 3600) return `${Math.floor(sec / 60)}m ${Math.round(sec % 60)}s`
  const h = Math.floor(sec / 3600); const m = Math.floor((sec % 3600) / 60)
  return `${h}h ${m}m`
}
