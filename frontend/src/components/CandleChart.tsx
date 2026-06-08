import { useEffect, useRef, useState } from 'react'
import { createChart, ColorType, IChartApi, ISeriesApi, CandlestickData, LineStyle, UTCTimestamp, SeriesMarker, Time } from 'lightweight-charts'
import { Trade, Execution, MarketDataBar, fmtUsd, api, parseBackendTime } from '../lib/api'

const TIMEFRAMES = ['1m', '5m', '15m', '1h', '1d']

export default function CandleChart({ trade, executions }: { trade: Trade; executions: Execution[] }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const candleRef = useRef<ISeriesApi<'Candlestick'> | null>(null)
  const [timeframe, setTimeframe] = useState('1m')
  const [bars, setBars] = useState<MarketDataBar[] | null>(null)
  const [loadingBars, setLoadingBars] = useState(false)
  const [yahooBusy, setYahooBusy] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)

  // Load real bars for this trade's window (+ padding).
  useEffect(() => {
    if (!trade) return
    let cancelled = false
    setLoadingBars(true); setBars(null)
    const padMin = timeframe === '1d' ? 60 * 24 * 5 : timeframe === '1h' ? 60 * 12 : 60
    // Backend stores naive-UTC timestamps — parse as UTC or the window misses the trade.
    const entryUtcMs = parseBackendTime(trade.entry_time).getTime()
    const exitUtcMs = parseBackendTime(trade.exit_time).getTime()
    const from = new Date(entryUtcMs - padMin * 60_000).toISOString()
    const to = new Date(exitUtcMs + padMin * 60_000).toISOString()
    api.marketData.bars(trade.symbol, from, to, timeframe)
      .then(rows => { if (!cancelled) setBars(rows) })
      .catch(() => { if (!cancelled) setBars([]) })
      .finally(() => { if (!cancelled) setLoadingBars(false) })
    return () => { cancelled = true }
  }, [trade.id, trade.symbol, trade.entry_time, trade.exit_time, timeframe])

  const usingReal = (bars?.length ?? 0) > 0

  useEffect(() => {
    if (!containerRef.current || executions.length === 0) return
    if (bars === null) return  // wait for fetch

    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height: 460,
      layout: {
        background: { type: ColorType.Solid, color: '#121826' },
        textColor: '#7b8aa8',
        fontFamily: 'JetBrains Mono, ui-monospace, monospace',
      },
      grid: {
        vertLines: { color: '#1a2233' },
        horzLines: { color: '#1a2233' },
      },
      rightPriceScale: { borderColor: '#222b3d', scaleMargins: { top: 0.1, bottom: 0.2 } },
      timeScale: { borderColor: '#222b3d', timeVisible: true, secondsVisible: false },
      crosshair: {
        mode: 1,
        vertLine: { color: '#3a4a66', width: 1, style: LineStyle.Dashed, labelBackgroundColor: '#222b3d' },
        horzLine: { color: '#3a4a66', width: 1, style: LineStyle.Dashed, labelBackgroundColor: '#222b3d' },
      },
    })
    const series = chart.addCandlestickSeries({
      upColor: '#22c55e', downColor: '#ef4444',
      borderUpColor: '#22c55e', borderDownColor: '#ef4444',
      wickUpColor: '#22c55e', wickDownColor: '#ef4444',
      priceFormat: { type: 'price', precision: 2, minMove: 0.25 },
    })
    chartRef.current = chart; candleRef.current = series

    const sortedExecs = [...executions].sort((a, b) => +new Date(a.fill_time) - +new Date(b.fill_time))
    const candles: CandlestickData[] = []

    if (usingReal) {
      bars!.forEach(b => {
        candles.push({
          time: Math.floor(parseBackendTime(b.ts).getTime() / 1000) as UTCTimestamp,
          open: b.o, high: b.h, low: b.l, close: b.c,
        })
      })
    } else {
      // Synthesize from fills.
      const usedTimes = new Set<number>()
      let prevClose = sortedExecs[0].fill_price
      let prevHi = sortedExecs[0].fill_price
      let prevLo = sortedExecs[0].fill_price
      sortedExecs.forEach((e) => {
        let t = Math.floor(parseBackendTime(e.fill_time).getTime() / 1000)
        while (usedTimes.has(t)) t += 1
        usedTimes.add(t)
        const open = prevClose, close = e.fill_price
        const hd = e.high_during_position
        const ld = e.low_during_position
        const high = Math.max(open, close, hd != null && hd > 0 ? hd : -Infinity, prevHi)
        const low = Math.min(open, close, ld != null && ld > 0 ? ld : Infinity, prevLo)
        candles.push({ time: t as UTCTimestamp, open, high, low, close })
        prevClose = close; prevHi = Math.max(prevHi, high); prevLo = Math.min(prevLo, low)
      })
    }
    series.setData(candles)

    const candleTimes = candles.map(c => c.time as number)
    function snap(ts: number): Time {
      if (!usingReal) return ts as UTCTimestamp
      let chosen = candleTimes[0]
      for (const ct of candleTimes) {
        if (ct <= ts) chosen = ct
        else break
      }
      return chosen as UTCTimestamp
    }
    const markers: SeriesMarker<Time>[] = sortedExecs.map(e => {
      const isBuy = e.side === 'Buy'
      const isClose = e.open_close === 'Close'
      const ts = Math.floor(parseBackendTime(e.fill_time).getTime() / 1000)
      return {
        time: snap(ts),
        position: isBuy ? 'belowBar' : 'aboveBar',
        color: isBuy ? '#22c55e' : '#ef4444',
        shape: isBuy ? 'arrowUp' : 'arrowDown',
        text: `${isClose ? 'C' : 'O'} ${e.quantity} @ ${e.fill_price.toFixed(2)}`,
        size: Math.min(2, 1 + e.quantity / 5),
      }
    })
    series.setMarkers(markers)

    series.createPriceLine({
      price: trade.avg_entry_price, color: '#7b8aa8', lineWidth: 1,
      lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: 'Entry',
    })
    series.createPriceLine({
      price: trade.avg_exit_price, color: '#f59e0b', lineWidth: 1,
      lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: 'Exit',
    })

    chart.timeScale().fitContent()

    const resize = () => {
      if (containerRef.current && chartRef.current) {
        chartRef.current.resize(containerRef.current.clientWidth, 460)
      }
    }
    window.addEventListener('resize', resize)
    return () => {
      window.removeEventListener('resize', resize)
      chart.remove()
      chartRef.current = null; candleRef.current = null
    }
  }, [trade.id, executions.length, bars, timeframe]) // eslint-disable-line

  async function tryYahooFetch() {
    setYahooBusy(true); setFeedback(null)
    try {
      const r = await api.marketData.yahooFetch(trade.symbol, timeframe, 7)
      setFeedback(`Yahoo: pulled ${r.bars} new bars for ${r.yahoo_symbol}. ${r.notes.join(' ')}`)
      const padMin = 60
      const from = new Date(new Date(trade.entry_time).getTime() - padMin * 60_000).toISOString()
      const to = new Date(new Date(trade.exit_time).getTime() + padMin * 60_000).toISOString()
      const rows = await api.marketData.bars(trade.symbol, from, to, timeframe)
      setBars(rows)
    } catch (e: any) {
      setFeedback(`Yahoo fetch failed: ${e.message || e}`)
    } finally { setYahooBusy(false) }
  }

  if (executions.length === 0) return null

  return (
    <div className="bg-panel glass-panel hover-lift border border-border rounded-lg p-4">
      <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
        <div>
          <div className="text-sm font-semibold flex items-center gap-2">
            {trade.symbol} · {trade.side} × {trade.quantity}
            <span className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded ${
              usingReal ? 'bg-win/20 text-win' : 'bg-warn/15 text-warn'
            }`}>
              {usingReal ? 'real bars' : 'synthesized'}
            </span>
          </div>
          <div className="text-[10px] text-muted">
            Entry {trade.avg_entry_price.toFixed(2)} → Exit {trade.avg_exit_price.toFixed(2)} ·
            Net {fmtUsd(trade.net_pnl, { signed: true })}
            {usingReal && ` · ${bars!.length} bars cached`}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-panel2 border border-border rounded text-xs overflow-hidden">
            {TIMEFRAMES.map(tf => (
              <button key={tf} onClick={() => setTimeframe(tf)}
                className={`px-2 py-1 ${timeframe === tf ? 'bg-accent text-bg font-medium' : 'text-muted hover:text-text'}`}>
                {tf}
              </button>
            ))}
          </div>
          {!usingReal && (
            <button onClick={tryYahooFetch} disabled={yahooBusy}
              className="text-xs bg-panel2 border border-border rounded px-2 py-1 hover:border-accent/40 disabled:opacity-50">
              {yahooBusy ? 'Fetching…' : 'Try Yahoo →'}
            </button>
          )}
        </div>
      </div>
      <div ref={containerRef} className="w-full" />
      {loadingBars && <div className="text-[10px] text-muted mt-2">Loading bars…</div>}
      {!usingReal && !loadingBars && (
        <div className="text-[10px] text-muted mt-2">
          No cached bars for this symbol/timeframe in this window. Showing synthesized candles.
          Upload bars on the <a href="/market-data" className="text-accent hover:underline">Market Data</a> page,
          or try the Yahoo button above (continuous front-month, last ~7 days for 1m).
        </div>
      )}
      {feedback && <div className="text-[10px] text-accent mt-2">{feedback}</div>}
    </div>
  )
}
