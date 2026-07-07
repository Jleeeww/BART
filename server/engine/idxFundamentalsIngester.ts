/**
 * ============================================================
 * IDX FUNDAMENTALS INGESTER v1.0
 * ============================================================
 * server/engine/idxFundamentalsIngester.ts
 *
 * Periodically refreshes the `stocks` table's DEMO numeric fields
 * with REAL official IDX data:
 *   - price / change / changePercent  ← latest daily stock summary
 *   - peRatio / roe                    ← latest financial ratios
 * Only touches those columns (leaves AI/summary text intact).
 *
 * Scheduled daily; safe to run manually.
 */
import { db } from '../db';
import { stocks as stocksTable } from '../../shared/schema';
import { eq } from 'drizzle-orm';
import { fetchIDXStockSummary, fetchIDXFinancialRatios } from './idxData';

export interface FundamentalsUpdateResult {
  updated: number;
  priceUpdated: number;
  ratioUpdated: number;
}

export async function updateStocksFromIDX(): Promise<FundamentalsUpdateResult> {
  const [summary, ratios] = await Promise.all([
    fetchIDXStockSummary(),
    fetchIDXFinancialRatios(),
  ]);

  const summaryBy = new Map(summary.map((s) => [s.code, s]));
  const ratioBy = new Map(ratios.map((r) => [r.code, r]));

  const rows = await db.select({ symbol: stocksTable.symbol }).from(stocksTable);

  let updated = 0, priceUpdated = 0, ratioUpdated = 0;
  for (const { symbol } of rows) {
    const s = summaryBy.get(symbol);
    const r = ratioBy.get(symbol);
    if (!s && !r) continue;

    const set: Record<string, unknown> = {};
    if (s && s.close != null && s.close > 0) {
      set.price = String(s.close);
      if (s.change != null) set.change = String(s.change);
      if (s.changePercent != null) set.changePercent = String(s.changePercent);
      priceUpdated++;
    }
    if (r) {
      if (r.per != null) set.peRatio = String(r.per);
      if (r.roe != null) set.roe = String(r.roe);
      ratioUpdated++;
    }
    if (Object.keys(set).length === 0) continue;

    await db.update(stocksTable).set(set as any).where(eq(stocksTable.symbol, symbol));
    updated++;
  }

  return { updated, priceUpdated, ratioUpdated };
}
