/**
 * ============================================================
 * OHLCV INGESTER v1.0
 * ============================================================
 * server/engine/ohlcvIngester.ts
 *
 * Pulls daily OHLCV from Yahoo (.JK) and upserts it into
 * session_history so the bandarmology engine reads REAL prices
 * instead of DEMO seed prices.
 *
 * CRITICAL: this only writes PRICE columns. On conflict it does
 * NOT touch flow columns (netFlow, foreign/domestic, brokerData,
 * flowBias…) or dataSource — so it never clobbers broker/flow
 * data that came from seeding or a real scrape. Price and flow
 * are layered independently onto the same (symbol, date, 0) row.
 */
import { db } from '../db';
import { sessionHistory } from '../../shared/schema';
import { fetchOHLCV } from './ohlcvFetcher';

export interface OHLCVIngestResult {
  symbol: string;
  bars: number;
  ok: boolean;
  source: 'IDX' | 'YAHOO' | 'NONE';
}

/** Upsert daily OHLCV for one symbol. Session 0 = daily bar. */
export async function ingestOHLCVForSymbol(
  symbol: string,
  rangeDays: number = 40
): Promise<OHLCVIngestResult> {
  const sym = symbol.toUpperCase();
  const { bars, source } = await fetchOHLCV(sym, rangeDays);
  if (bars.length === 0) return { symbol: sym, bars: 0, ok: false, source: 'NONE' };

  const now = new Date().toISOString();

  for (let i = 0; i < bars.length; i++) {
    const b = bars[i];
    const prevClose = i > 0 ? bars[i - 1].close : null;
    const changePct =
      prevClose && prevClose > 0
        ? Number((((b.close - prevClose) / prevClose) * 100).toFixed(4))
        : null;
    // Prefer real IDR turnover (IDX Value); fall back to volume × close (Yahoo).
    const todayValue =
      b.value != null ? Math.round(b.value) :
      b.volume != null ? Math.round(b.volume * b.close) :
      null;

    await db
      .insert(sessionHistory)
      .values({
        symbol: sym,
        date: b.time as string, // fetchOHLCV() is always daily ('1d') — time is always 'YYYY-MM-DD' here
        session: 0,
        open: b.open,
        high: b.high,
        low: b.low,
        close: b.close,
        prevClose,
        changePct,
        todayValue,
        dataSource: source,
        ingestedAt: now,
      })
      .onConflictDoUpdate({
        target: [sessionHistory.symbol, sessionHistory.date, sessionHistory.session],
        set: {
          // Price columns only — flow columns and dataSource left untouched.
          open: b.open,
          high: b.high,
          low: b.low,
          close: b.close,
          prevClose,
          changePct,
          todayValue,
          ingestedAt: now,
        },
      });
  }

  return { symbol: sym, bars: bars.length, ok: true, source };
}

/** Sequentially ingest a batch, with a small delay to stay polite to the source. */
export async function ingestOHLCVBatch(
  symbols: string[],
  rangeDays: number = 40
): Promise<{ total: number; ok: number; failed: string[]; totalBars: number; bySource: Record<string, number> }> {
  const failed: string[] = [];
  const bySource: Record<string, number> = {};
  let ok = 0;
  let totalBars = 0;

  for (const sym of symbols) {
    try {
      const r = await ingestOHLCVForSymbol(sym, rangeDays);
      if (r.ok) {
        ok++;
        totalBars += r.bars;
        bySource[r.source] = (bySource[r.source] ?? 0) + 1;
      } else {
        failed.push(sym);
      }
    } catch {
      failed.push(sym);
    }
    await new Promise((res) => setTimeout(res, 150)); // ~7 req/s cap
  }

  return { total: symbols.length, ok, failed, totalBars, bySource };
}
