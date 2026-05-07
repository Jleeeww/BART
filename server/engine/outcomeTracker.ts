/**
 * ============================================================
 * OUTCOME TRACKER v1.0
 * ============================================================
 * server/engine/outcomeTracker.ts
 *
 * Runs daily after IDX market close (scheduled from index.ts).
 * Converts historical signals + news impacts into RAG documents
 * so future analyses can learn from past outcomes.
 * ============================================================
 */

import type { Pool } from '@neondatabase/serverless';
import { storeDocument, storeNewsOutcome } from './ragEngine';

let _pool: Pool | null = null;
async function getPool(): Promise<Pool | null> {
  if (!process.env.DATABASE_URL) return null;
  if (_pool) return _pool;
  const { pool } = await import('../db');
  _pool = pool as unknown as Pool;
  return _pool;
}

// ── News outcome tracker ───────────────────────────────────────

/**
 * For news_impacts older than 10 sessions (~10 trading days) that
 * have no NEWS_OUTCOME stored yet: fetch actual price change from
 * session_history and persist as a RAG document.
 */
export async function recordNewsOutcomes(): Promise<void> {
  const pool = await getPool();
  if (!pool) return;

  try {
    // Find news impacts older than 10 trading days with no stored outcome
    const impacts = await pool.query<{
      article_id: string;
      symbol: string;
      sector_name: string | null;
      direction: string;
      strength: string;
      analyzed_at: string;
      trader_implication: string | null;
    }>(
      `SELECT ni.article_id, ni.symbol, ni.sector_name,
              ni.direction, ni.strength, ni.analyzed_at, ni.trader_implication
       FROM news_impacts ni
       WHERE ni.analyzed_at < NOW() - INTERVAL '10 days'
         AND NOT EXISTS (
           SELECT 1 FROM rag_documents rd
           WHERE rd.type = 'NEWS_OUTCOME'
             AND rd.metadata->>'impactId' = ni.article_id || '_' || ni.symbol
         )
       LIMIT 50`
    );

    for (const impact of impacts.rows) {
      const impactKey = `${impact.article_id}_${impact.symbol}`;

      // Look up price at analysis time and ~10 sessions later
      const priceRows = await pool.query<{ close: number; date: string }>(
        `SELECT close, date
         FROM session_history
         WHERE symbol = $1
           AND date >= $2::date - INTERVAL '1 day'
         ORDER BY date ASC
         LIMIT 12`,
        [impact.symbol, impact.analyzed_at]
      );

      if (priceRows.rows.length < 2) continue;

      const baseline = priceRows.rows[0].close;
      const endRow   = priceRows.rows[Math.min(10, priceRows.rows.length - 1)];
      const sessions = priceRows.rows.indexOf(endRow);
      const actualChange = baseline > 0
        ? ((endRow.close - baseline) / baseline) * 100
        : 0;

      await storeNewsOutcome(impactKey, actualChange, sessions);
    }

    console.log(`[outcomeTracker] recordNewsOutcomes: processed ${impacts.rows.length} impacts`);
  } catch (err) {
    console.warn('[outcomeTracker] recordNewsOutcomes error:', err);
  }
}

// ── Signal outcome tracker ─────────────────────────────────────

/**
 * For GUGUR signals in signal_lifecycle: measure price change from
 * baseline date to the GUGUR date, then store as a MARKET_PATTERN
 * RAG document so the engine learns what conditions precede signal death.
 */
export async function recordSignalOutcomes(): Promise<void> {
  const pool = await getPool();
  if (!pool) return;

  try {
    const signals = await pool.query<{
      symbol: string;
      baseline_score: number | null;
      baseline_date: string | null;
      updated_at: string | null;
      status_reason: string | null;
      score_drift: number | null;
    }>(
      `SELECT sl.symbol, sl.baseline_score, sl.baseline_date,
              sl.updated_at, sl.status_reason, sl.score_drift
       FROM signal_lifecycle sl
       WHERE sl.status = 'GUGUR'
         AND sl.baseline_date IS NOT NULL
         AND NOT EXISTS (
           SELECT 1 FROM rag_documents rd
           WHERE rd.type = 'MARKET_PATTERN'
             AND rd.symbol = sl.symbol
             AND rd.metadata->>'signalType' = 'GUGUR'
             AND rd.metadata->>'baselineDate' = sl.baseline_date
         )
       LIMIT 30`
    );

    for (const sig of signals.rows) {
      if (!sig.baseline_date || !sig.updated_at) continue;

      // Fetch baseline price and GUGUR-date price
      const priceRows = await pool.query<{ close: number; date: string }>(
        `SELECT close, date
         FROM session_history
         WHERE symbol = $1
           AND date BETWEEN $2::date AND $3::date + INTERVAL '1 day'
         ORDER BY date ASC`,
        [sig.symbol, sig.baseline_date, sig.updated_at]
      );

      if (priceRows.rows.length < 2) continue;

      const baseline  = priceRows.rows[0].close;
      const final     = priceRows.rows[priceRows.rows.length - 1].close;
      const sessions  = priceRows.rows.length - 1;
      const priceDelta = baseline > 0 ? ((final - baseline) / baseline) * 100 : 0;

      const direction = priceDelta > 0 ? 'naik' : priceDelta < 0 ? 'turun' : 'flat';
      const content =
        `Signal GUGUR untuk ${sig.symbol}: ` +
        `skor drift ${sig.score_drift?.toFixed(1) ?? '?'} poin, ` +
        `harga ${direction} ${Math.abs(priceDelta).toFixed(2)}% ` +
        `dalam ${sessions} sesi. ` +
        (sig.status_reason ? `Alasan: ${sig.status_reason}.` : '');

      await storeDocument({
        type:    'MARKET_PATTERN',
        symbol:  sig.symbol,
        sector:  null,
        content,
        metadata: {
          signalType:    'GUGUR',
          baselineDate:  sig.baseline_date,
          gugurDate:     sig.updated_at,
          baselineScore: sig.baseline_score,
          scoreDrift:    sig.score_drift,
          priceDelta,
          sessions,
        },
        validUntil: null,
      });
    }

    console.log(`[outcomeTracker] recordSignalOutcomes: processed ${signals.rows.length} GUGUR signals`);
  } catch (err) {
    console.warn('[outcomeTracker] recordSignalOutcomes error:', err);
  }
}

// ── Combined daily runner ──────────────────────────────────────

export async function runDailyOutcomeTracking(): Promise<void> {
  console.log('[outcomeTracker] Starting daily outcome tracking...');
  await Promise.allSettled([
    recordNewsOutcomes(),
    recordSignalOutcomes(),
  ]);
  console.log('[outcomeTracker] Daily outcome tracking complete');
}
