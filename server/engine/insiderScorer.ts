/**
 * ============================================================
 * INSIDER SCORER v1.0
 * ============================================================
 * server/engine/insiderScorer.ts
 *
 * Aggregates InsiderTransaction[] into a composite InsiderScore.
 * Purely deterministic — no Claude calls, no I/O.
 *
 * SCORING PIPELINE (last 90 days):
 *   Step 1  — Aggregate counts and net IDR value
 *   Step 2  — Cluster buy: 3+ insiders (2+ unique) in 14-day window → base 85
 *   Step 3  — Price context: stock ≥8% above 30d-prior close at buy date → +10
 *             (uses session_history; returns null when history unavailable)
 *   Step 4  — Single/dual buy, no sells → base 65-70
 *   Step 5  — Selling patterns: 2+ sells → 25; sells 3× buys by value → 15
 *   Step 6  — Mixed signal → 50
 *   Step 7  — Filing delay: avg > 5 days → −10 penalty + governance flag
 *   Step 8  — < 2 transactions in 90 days → INSUFFICIENT_DATA, score = null
 *             (excluded from composite, not treated as zero)
 *
 * FILING DELAY → GOVERNANCE:
 *   filingDelayFlag feeds to Layer 4 (Manajemen) as a governance signal.
 *   The compositeEngineV3 reads filingDelayFlag and can discount management layer.
 * ============================================================
 */

import type { InsiderTransaction } from './insiderResearch';

// ── Types ────────────────────────────────────────────────────

export type InsiderSignal =
  | 'STRONG_BUY'
  | 'BUY'
  | 'NEUTRAL'
  | 'SELL'
  | 'STRONG_SELL'
  | 'INSUFFICIENT_DATA';

export interface InsiderScore {
  score:              number | null;  // 0-100; null = insufficient data → excluded from composite
  isReliable:         boolean;
  signal:             InsiderSignal;
  insiderBuyCount:    number;
  insiderSellCount:   number;
  netInsiderValue:    number;         // IDR, last 90 days
  clusterBuySignal:   boolean;        // 3+ insiders buying in 14-day window
  priceContextSignal: boolean | null; // buying on price weakness; null = no price history
  filingDelayFlag:    boolean;        // late reporting — governance concern
  topTransactions:    InsiderTransaction[];
  note:               string;         // Bahasa Indonesia summary for UI
  computedAt:         string;         // ISO timestamp
}

// ── Config ───────────────────────────────────────────────────

export const INSIDER_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const WINDOW_DAYS    = 90;
const CLUSTER_WINDOW = 14;   // days
const DELAY_THRESHOLD = 5;   // days — late filing governance flag

// ── In-memory score cache ────────────────────────────────────

const _scoreCache = new Map<string, { result: InsiderScore; timestamp: number }>();

// ── Date helpers ─────────────────────────────────────────────

function daysAgo(n: number): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function parseDate(iso: string): Date {
  return new Date(iso + 'T00:00:00.000Z');
}

// ── Cluster buy detection ─────────────────────────────────────
// True when ≥ 3 buy transactions (with ≥ 2 distinct insiders)
// occur within a 14-day rolling window.

function detectClusterBuy(buys: InsiderTransaction[]): boolean {
  if (buys.length < 3) return false;

  const sorted = [...buys].sort(
    (a, b) => parseDate(a.transactionDate).getTime() - parseDate(b.transactionDate).getTime()
  );

  for (let i = 0; i <= sorted.length - 3; i++) {
    const t0    = parseDate(sorted[i].transactionDate).getTime();
    const t2    = parseDate(sorted[i + 2].transactionDate).getTime();
    const spanD = (t2 - t0) / 86_400_000;
    if (spanD <= CLUSTER_WINDOW) {
      const names = new Set(sorted.slice(i, i + 3).map((t) => t.personName));
      if (names.size >= 2) return true;
    }
  }
  return false;
}

// ── Price context (buying on market weakness) ────────────────
// Queries session_history for each buy: if the close price 30 days
// before the transaction was ≥8% above the insider's purchase price,
// the insider bought on weakness.
// Returns null when session_history has no data for the symbol/date.

async function detectPriceWeakness30d(
  buys:   InsiderTransaction[],
  symbol: string
): Promise<boolean | null> {
  if (buys.length === 0) return null;
  try {
    const { pool } = await import('../db');
    let hadData = false;
    for (const t of buys) {
      if (t.pricePerShare <= 0) continue;
      const d30Str = new Date(
        new Date(t.transactionDate + 'T00:00:00.000Z').getTime() - 30 * 86_400_000
      ).toISOString().slice(0, 10);

      const rows = await pool.query<{ close: number }>(
        `SELECT close FROM session_history
         WHERE symbol = $1 AND date <= $2
         ORDER BY date DESC LIMIT 1`,
        [symbol, d30Str]
      );
      if (rows.rows.length === 0 || !rows.rows[0].close) continue;

      hadData = true;
      const weakness = (rows.rows[0].close - t.pricePerShare) / rows.rows[0].close;
      if (weakness > 0.08) return true;
    }
    return hadData ? false : null;
  } catch {
    return null;
  }
}

// ── Score → signal label ──────────────────────────────────────

function signalFromScore(score: number): InsiderSignal {
  if (score >= 80) return 'STRONG_BUY';
  if (score >= 60) return 'BUY';
  if (score >= 40) return 'NEUTRAL';
  if (score >= 20) return 'SELL';
  return 'STRONG_SELL';
}

// ── Main scorer ──────────────────────────────────────────────

export async function scoreInsider(
  transactions: InsiderTransaction[],
  symbol:       string
): Promise<InsiderScore> {
  const computedAt = new Date().toISOString();
  const cutoff     = daysAgo(WINDOW_DAYS);

  // Filter to last 90 days, HIGH + MEDIUM reliability only
  const recent = transactions.filter(
    (t) => parseDate(t.transactionDate) >= cutoff && t.reliability !== 'LOW'
  );

  const buys  = recent.filter((t) => t.transactionType === 'BUY');
  const sells = recent.filter((t) => t.transactionType === 'SELL');

  const insiderBuyCount  = buys.length;
  const insiderSellCount = sells.length;

  const netBuyValue  = buys.reduce( (s, t) => s + t.totalValue, 0);
  const netSellValue = sells.reduce((s, t) => s + t.totalValue, 0);
  const netInsiderValue = netBuyValue - netSellValue;

  // ── Step 8: Insufficient data ─────────────────────────────
  if (recent.length < 2) {
    return {
      score:             null,
      isReliable:        false,
      signal:            'INSUFFICIENT_DATA',
      insiderBuyCount,
      insiderSellCount,
      netInsiderValue,
      clusterBuySignal:  false,
      priceContextSignal:null,
      filingDelayFlag:   false,
      topTransactions:   recent.slice(0, 5),
      note:              'Data insider belum cukup untuk dianalisis (< 2 transaksi dalam 90 hari)',
      computedAt,
    };
  }

  // ── Signals ──────────────────────────────────────────────
  const clusterBuySignal   = detectClusterBuy(buys);
  const priceContextSignal = await detectPriceWeakness30d(buys, symbol);

  // ── Step 7: Filing delay (computed early to apply to note) ─
  const avgDelay     = recent.reduce((s, t) => s + t.filingDelayDays, 0) / recent.length;
  const filingDelayFlag = avgDelay > DELAY_THRESHOLD;

  // ── Steps 2-6: Base score ─────────────────────────────────
  let baseScore: number;
  let noteParts: string[] = [];

  if (clusterBuySignal) {
    // Step 2: Cluster buy — highest conviction signal
    baseScore = 85;
    noteParts.push(`Cluster buy: 3+ insider membeli dalam ${CLUSTER_WINDOW} hari`);

    // Step 3: Price context multiplier
    if (priceContextSignal) {
      baseScore = Math.min(100, baseScore + 10);
      noteParts.push('pembelian saat harga lemah — sinyal tinggi');
    }
  } else if (insiderBuyCount >= 1 && insiderSellCount === 0) {
    // Step 4: Only buys
    baseScore = insiderBuyCount >= 2 ? 70 : 65;
    noteParts.push(`${insiderBuyCount} insider membeli tanpa penjualan`);
    if (priceContextSignal) {
      baseScore = Math.min(100, baseScore + 5);
      noteParts.push('pembelian saat harga melemah');
    }
  } else if (insiderSellCount >= 2 && netSellValue > netBuyValue * 3) {
    // Step 5b: Heavy selling — value-weighted
    baseScore = 15;
    noteParts.push('Penjualan insider melebihi pembelian 3× dari sisi nilai');
  } else if (insiderSellCount >= 2) {
    // Step 5a: Multiple sells
    baseScore = 25;
    noteParts.push(`${insiderSellCount} insider menjual — potensi distribusi`);
  } else {
    // Step 6: Mixed / unclear
    baseScore = 50;
    noteParts.push('Sinyal campuran pembelian dan penjualan');
  }

  // ── Step 7: Filing delay penalty ────────────────────────
  if (filingDelayFlag) {
    baseScore = Math.max(0, baseScore - 10);
    noteParts.push(`pelaporan terlambat rata-rata ${Math.round(avgDelay)} hari — bendera tata kelola`);
  }

  const finalScore  = Math.max(0, Math.min(100, Math.round(baseScore)));
  const finalSignal = signalFromScore(finalScore);

  const topTransactions = [...recent]
    .sort((a, b) => b.totalValue - a.totalValue)
    .slice(0, 5);

  return {
    score:             finalScore,
    isReliable:        true,
    signal:            finalSignal,
    insiderBuyCount,
    insiderSellCount,
    netInsiderValue,
    clusterBuySignal,
    priceContextSignal,
    filingDelayFlag,
    topTransactions,
    note:              noteParts.join(' · '),
    computedAt,
  };
}

// ── Cache management ─────────────────────────────────────────

export function cacheInsiderScore(symbol: string, result: InsiderScore): void {
  _scoreCache.set(symbol.toUpperCase(), { result, timestamp: Date.now() });
}

export function getCachedInsiderScore(symbol: string): InsiderScore | null {
  const entry = _scoreCache.get(symbol.toUpperCase());
  if (!entry) return null;
  if (Date.now() - entry.timestamp > INSIDER_CACHE_TTL_MS) {
    _scoreCache.delete(symbol.toUpperCase());
    return null;
  }
  return entry.result;
}

export function getInsiderCacheStats(): { size: number; symbols: string[] } {
  return {
    size:    _scoreCache.size,
    symbols: Array.from(_scoreCache.keys()),
  };
}

// ── Convenience: recompute and cache from raw transactions ────

export async function computeAndCacheInsiderScore(
  symbol:       string,
  transactions: InsiderTransaction[]
): Promise<InsiderScore> {
  const result = await scoreInsider(transactions, symbol);
  cacheInsiderScore(symbol, result);
  return result;
}
