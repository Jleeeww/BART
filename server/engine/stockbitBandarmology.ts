/**
 * ============================================================
 * STOCKBIT BANDARMOLOGY v1.0
 * ============================================================
 * server/engine/stockbitBandarmology.ts
 *
 * Reconstructs per-STOCK broker summary (bandarmology) by
 * sweeping Stockbit's per-BROKER activity and inverting it:
 *   for each broker → [(stock, net value, type)]  ⇒  index by stock.
 *
 * Broker universe comes from IDX's free broker list (member
 * codes == Stockbit codes), sorted by traded value; capped to
 * the top N (env STOCKBIT_MAX_BROKERS, default 45) so a full
 * sweep fits the Stockbit rate limit. Foreign brokers are few
 * and always included, so net-foreign flow stays accurate.
 */
import { fetchBrokerActivity, stockbitEnabled, type BrokerActivityRow } from './stockbitClient';
import { idxFetchJSON } from './idxClient';

export interface BrokerLeg {
  broker: string;
  type: 'FOREIGN' | 'LOCAL' | 'GOVERNMENT';
  value: number; // signed net IDR
  lot: number;
}

export interface StockBandar {
  symbol: string;
  date: string;
  foreignNet: number; // net foreign flow (IDR) — the core bandarmology signal
  localNet: number;
  govNet: number;
  netValue: number; // sum of swept brokers' net (accumulation/distribution imbalance)
  topBuyers: BrokerLeg[];
  topSellers: BrokerLeg[];
  brokerCount: number;
}

interface Cache { at: number; date: string; byStock: Map<string, StockBandar>; }
let cache: Cache | null = null;
const TTL_MS = 30 * 60 * 1000; // 30 min

/** Active IDX broker codes for the latest trading day, sorted by value desc. */
async function getBrokerCodes(): Promise<string[]> {
  const now = new Date();
  for (let back = 0; back < 7; back++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - back);
    const date = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
    const raw: any = await idxFetchJSON(
      `https://www.idx.co.id/primary/TradingSummary/GetBrokerSummary?length=9999&start=0&date=${date}`,
    );
    const rows = raw?.data;
    if (Array.isArray(rows) && rows.length > 0) {
      return rows
        .filter((r: any) => r.IDFirm)
        .sort((a: any, b: any) => (Number(b.Value) || 0) - (Number(a.Value) || 0))
        .map((r: any) => String(r.IDFirm).toUpperCase());
    }
  }
  return [];
}

/** Sweep brokers → invert → per-stock bandarmology. Cached 30 min. */
export async function buildBandarmology(force = false): Promise<Cache | null> {
  if (!stockbitEnabled()) return null;
  if (!force && cache && Date.now() - cache.at < TTL_MS) return cache;

  let codes = await getBrokerCodes();
  if (codes.length === 0) return cache; // keep stale on failure
  const max = Number(process.env.STOCKBIT_MAX_BROKERS ?? 45);
  codes = codes.slice(0, max);

  // Accumulate per-stock broker legs.
  const legs = new Map<string, BrokerLeg[]>();
  let date = new Date().toISOString().slice(0, 10);
  let ok = 0;
  for (const code of codes) {
    const rows: BrokerActivityRow[] = await fetchBrokerActivity(code);
    if (rows.length === 0) continue;
    ok++;
    for (const r of rows) {
      if (!legs.has(r.stockCode)) legs.set(r.stockCode, []);
      legs.get(r.stockCode)!.push({ broker: r.brokerCode, type: r.type, value: r.value, lot: r.lot });
    }
  }
  if (ok === 0) return cache;

  const byStock = new Map<string, StockBandar>();
  for (const [symbol, arr] of Array.from(legs.entries())) {
    const sum = (pred: (l: BrokerLeg) => boolean) =>
      arr.filter(pred).reduce((s: number, l: BrokerLeg) => s + l.value, 0);
    const sorted = [...arr].sort((a, b) => b.value - a.value);
    byStock.set(symbol, {
      symbol,
      date,
      foreignNet: sum((l) => l.type === 'FOREIGN'),
      localNet: sum((l) => l.type === 'LOCAL'),
      govNet: sum((l) => l.type === 'GOVERNMENT'),
      netValue: sum(() => true),
      topBuyers: sorted.filter((l) => l.value > 0).slice(0, 8),
      topSellers: sorted.filter((l) => l.value < 0).slice(-8).reverse(),
      brokerCount: arr.length,
    });
  }

  cache = { at: Date.now(), date, byStock };
  return cache;
}

/**
 * Read bandarmology for one stock. Prefers the live in-memory sweep cache;
 * falls back to persisted session_history.broker_data so the UI shows data
 * instantly after a restart WITHOUT triggering a fresh (slow, token-spending)
 * sweep. Sweeps happen only via ingestBandarmology() / the scheduler.
 */
export async function getBandarmology(symbol: string): Promise<StockBandar | null> {
  const sym = symbol.toUpperCase();
  if (cache) {
    const hit = cache.byStock.get(sym);
    if (hit) return hit;
  }
  // Persisted fallback
  try {
    const { db } = await import('../db');
    const { sessionHistory } = await import('../../shared/schema');
    const { eq, and, desc } = await import('drizzle-orm');
    const rows = await db
      .select()
      .from(sessionHistory)
      .where(and(eq(sessionHistory.symbol, sym), eq(sessionHistory.flowReliability, 'STOCKBIT')))
      .orderBy(desc(sessionHistory.date))
      .limit(1);
    const r: any = rows[0];
    if (!r || !r.brokerData) return null;
    const bd = r.brokerData as any;
    return {
      symbol: sym,
      date: r.date,
      foreignNet: Number(r.netForeignFlow) || 0,
      localNet: Number(r.netDomesticFlow) || 0,
      govNet: 0,
      netValue: Number(r.netFlow) || 0,
      topBuyers: bd.topBuyers ?? [],
      topSellers: bd.topSellers ?? [],
      brokerCount: bd.brokerCount ?? 0,
    };
  } catch {
    return null;
  }
}

/**
 * Ingest bandarmology into session_history for the homepage universe.
 * Writes ONLY flow columns (net flow, foreign/domestic, broker_data,
 * flow bias/reliability) — price columns are left untouched.
 */
export async function ingestBandarmology(): Promise<{ updated: number; date: string } | null> {
  const c = await buildBandarmology(true);
  if (!c) return null;

  const { db } = await import('../db');
  const { sessionHistory } = await import('../../shared/schema');
  const { HOMEPAGE_UNIVERSE } = await import('./lq45Universe');
  const now = new Date().toISOString();

  let updated = 0;
  for (const symbol of HOMEPAGE_UNIVERSE) {
    const b = c.byStock.get(symbol.toUpperCase());
    if (!b) continue;

    const foreignBuy = b.topBuyers.filter((l) => l.type === 'FOREIGN').reduce((s, l) => s + l.value, 0);
    const foreignSell = -b.topSellers.filter((l) => l.type === 'FOREIGN').reduce((s, l) => s + l.value, 0);
    const domesticNet = b.localNet + b.govNet;
    const flowBias = b.foreignNet > 0 ? 'Akumulasi' : b.foreignNet < 0 ? 'Distribusi' : 'Netral';
    const intensity = Math.abs(b.foreignNet) > 50e9 ? 'Kuat' : Math.abs(b.foreignNet) > 10e9 ? 'Sedang' : 'Lemah';

    const flow = {
      netFlow: b.netValue,
      netForeignFlow: b.foreignNet,
      netDomesticFlow: domesticNet,
      foreignBuy, foreignSell,
      flowBias, flowIntensity: intensity, flowReliability: 'STOCKBIT',
      brokerData: { topBuyers: b.topBuyers, topSellers: b.topSellers, brokerCount: b.brokerCount },
    };

    await db.insert(sessionHistory).values({
      symbol: symbol.toUpperCase(), date: b.date, session: 0,
      ...flow, dataSource: 'STOCKBIT', ingestedAt: now,
    }).onConflictDoUpdate({
      target: [sessionHistory.symbol, sessionHistory.date, sessionHistory.session],
      set: { ...flow, ingestedAt: now }, // flow columns only — price left intact
    });
    updated++;
  }
  return { updated, date: c.date };
}
