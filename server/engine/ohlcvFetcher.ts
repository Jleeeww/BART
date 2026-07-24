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

/** One daily bar in lightweight-charts CandlestickData shape (+ volume). */
export interface OHLCVBar {
  time: string;   // 'YYYY-MM-DD' — lightweight-charts BusinessDay-compatible
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
 * Fetch daily OHLCV bars for an IDX stock.
 * @param symbol  Bare symbol ("BBCA") or Yahoo ticker ("BBCA.JK").
 * @param rangeDays  Lookback window in calendar days (default 100).
 * @returns Chronological array of bars; [] on failure.
 */
export async function fetchYahooOHLCV(
  symbol: string,
  rangeDays: number = 100
): Promise<OHLCVBar[]> {
  const ticker = toYahooTicker(symbol);
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=${rangeDays}d`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });
    clearTimeout(timeout);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = await res.json();
    const result = data?.chart?.result?.[0];
    const timestamps = result?.timestamp as number[] | undefined;
    const quote = result?.indicators?.quote?.[0];
    if (!timestamps || !quote) return [];

    const { open, high, low, close, volume } = quote as {
      open: (number | null)[];
      high: (number | null)[];
      low: (number | null)[];
      close: (number | null)[];
      volume: (number | null)[];
    };

    const bars: OHLCVBar[] = [];
    for (let i = 0; i < timestamps.length; i++) {
      const o = open?.[i], h = high?.[i], l = low?.[i], c = close?.[i];
      // Skip incomplete bars (Yahoo returns nulls for halted/no-trade days).
      if (o == null || h == null || l == null || c == null) continue;
      if (![o, h, l, c].every(isFinite)) continue;
      const v = volume?.[i];
      bars.push({
        time: new Date(timestamps[i] * 1000).toISOString().slice(0, 10),
        open: o, high: h, low: l, close: c,
        volume: v != null && isFinite(v) ? v : null,
      });
    }
    return bars;
  } catch {
    return [];
  }
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
