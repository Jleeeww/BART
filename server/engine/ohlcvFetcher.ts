/**
 * ============================================================
 * OHLCV FETCHER v1.0
 * ============================================================
 * server/engine/ohlcvFetcher.ts
 *
 * Fetches daily OHLCV bars for a single IDX stock from Yahoo
 * Finance (free, no API key). Feeds both:
 *   - lightweight-charts (PriceChart.tsx) via { time, open, high, low, close }
 *   - the bandarmology engine via session_history.priceHistory
 *
 * DESIGN RULES (mirror macroFlowFetcher.ts):
 *   - Never throws — returns [] on any failure
 *   - 5s timeout via AbortController
 *   - Mozilla User-Agent (Yahoo blocks empty UA)
 *   - Symbol-agnostic: accepts "BBCA" or "BBCA.JK"
 *
 * NOTE: Yahoo's chart endpoint is an unofficial public API.
 * It is free and needs no key, but is not contractually stable.
 */

/** Minute/hour intervals Yahoo supports natively, with their real max lookback (calendar days). */
export const INTRADAY_INTERVALS = ['1m', '5m', '15m', '30m', '1h'] as const;
// '1mo' is a real Yahoo interval (one candle per calendar month) — grouped
// with '1d' below since both use date-string time and no zero-volume filter.
export type OHLCVInterval = (typeof INTRADAY_INTERVALS)[number] | '1d' | '1mo';
const INTERVAL_MAX_DAYS: Record<(typeof INTRADAY_INTERVALS)[number], number> = {
  '1m': 8, '5m': 60, '15m': 60, '30m': 60, '1h': 730,
};

/** One OHLCV bar in lightweight-charts-compatible shape (+ volume). */
export interface OHLCVBar {
  // 'YYYY-MM-DD' (daily, BusinessDay-compatible) for interval='1d'; Unix
  // seconds (UTCTimestamp) for intraday intervals, so multiple bars/day
  // render as distinct points instead of collapsing onto one column.
  time: string | number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number | null;
  value?: number | null; // real IDR turnover when the source provides it (IDX); Yahoo omits
}

/** Normalize a bare IDX symbol to a Yahoo ticker: "BBCA" -> "BBCA.JK". */
export function toYahooTicker(symbol: string): string {
  const s = symbol.trim().toUpperCase();
  return s.includes('.') ? s : `${s}.JK`;
}

/**
 * Fetch OHLCV bars for an IDX stock from Yahoo Finance.
 * @param symbol  Bare symbol ("BBCA") or Yahoo ticker ("BBCA.JK").
 * @param rangeDays  Lookback window in calendar days (default 100); clamped
 *   to Yahoo's real per-interval limit (e.g. 1m maxes out at 8 days).
 * @param interval  '1d' (default), '1mo' (one candle per calendar month), or
 *   an intraday interval ('1m'/'5m'/'15m'/'30m'/'1h').
 * @returns Chronological array of bars; [] on failure.
 */
export async function fetchYahooOHLCV(
  symbol: string,
  rangeDays: number = 100,
  interval: OHLCVInterval = '1d'
): Promise<OHLCVBar[]> {
  const ticker = toYahooTicker(symbol);
  const isIntraday = (INTRADAY_INTERVALS as readonly string[]).includes(interval);
  const clampedDays = isIntraday ? Math.min(rangeDays, INTERVAL_MAX_DAYS[interval as (typeof INTRADAY_INTERVALS)[number]]) : rangeDays;
  try {
    const { getYahooFinanceClient } = await import('./yahooFinance');
    const yf = getYahooFinanceClient();
    const period1 = new Date(Date.now() - clampedDays * 24 * 3600 * 1000).toISOString();
    const result = await yf.chart(ticker, { period1, interval });
    const rows = result?.quotes ?? [];

    const bars: OHLCVBar[] = [];
    for (const row of rows) {
      const { open: o, high: h, low: l, close: c, volume: v, date } = row;
      // Skip incomplete bars (Yahoo returns nulls for halted/no-trade minutes/days).
      if (o == null || h == null || l == null || c == null) continue;
      if (![o, h, l, c].every(isFinite)) continue;
      // Intraday: Yahoo pads the grid with zero-volume "carry-forward" filler
      // bars outside real trading minutes (pre/post-market, session breaks) —
      // these render as near-invisible flat hairline candles, not real trades.
      // Daily bars keep zero-volume (could legitimately be a halted session).
      if (isIntraday && (!v || v === 0)) continue;
      const d = new Date(date);
      bars.push({
        time: isIntraday ? Math.floor(d.getTime() / 1000) : d.toISOString().slice(0, 10),
        open: o, high: h, low: l, close: c,
        volume: v != null && isFinite(v) ? v : null,
      });
    }
    return bars;
  } catch {
    return [];
  }
}

/**
 * Synthesize a coarser interval by grouping N consecutive bars into one
 * (open=first, high=max, low=min, close=last, volume=sum, time=first's time).
 * Used for '4H' — Yahoo has no native 4-hour interval, so we group four
 * real 1H bars. Bars are grouped by array position (real trading bars only,
 * already filtered of session-break/closed-market gaps), not by calendar
 * clock-hour boundaries — this avoids a 4H bucket straddling IDX's lunch
 * break oddly and mirrors how a session-aware chart would group bars.
 */
export function aggregateBars(bars: OHLCVBar[], groupSize: number): OHLCVBar[] {
  const out: OHLCVBar[] = [];
  for (let i = 0; i < bars.length; i += groupSize) {
    const group = bars.slice(i, i + groupSize);
    if (group.length === 0) continue;
    out.push({
      time: group[0].time,
      open: group[0].open,
      high: Math.max(...group.map(b => b.high)),
      low: Math.min(...group.map(b => b.low)),
      close: group[group.length - 1].close,
      volume: group.reduce((sum, b) => sum + (b.volume ?? 0), 0),
    });
  }
  return out;
}

export interface OHLCVResult {
  bars: OHLCVBar[];
  source: 'IDX' | 'YAHOO' | 'NONE';
}

/**
 * Unified OHLCV fetch: official IDX first (real Value, official close),
 * Yahoo `.JK` as fallback. Used by both the chart endpoint and the ingester.
 */
export async function fetchOHLCV(
  symbol: string,
  rangeDays: number = 40
): Promise<OHLCVResult> {
  const { fetchIDXStockHistory } = await import('./idxClient');
  const idxBars = await fetchIDXStockHistory(symbol, Math.min(rangeDays, 60));
  if (idxBars.length > 0) return { bars: idxBars, source: 'IDX' };

  const yahooBars = await fetchYahooOHLCV(symbol, rangeDays);
  if (yahooBars.length > 0) return { bars: yahooBars, source: 'YAHOO' };

  return { bars: [], source: 'NONE' };
}
