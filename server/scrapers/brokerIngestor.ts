/**
 * ============================================================
 * BROKER DATA INGESTION ORCHESTRATOR v1.0
 * ============================================================
 * server/scrapers/brokerIngestor.ts
 *
 * Runs IDX → Stockbit cascade for a list of symbols and writes
 * broker data into the stocks table (broker_data, foreign_activity_data,
 * last_broker_scrape, scrape_source, scrape_quality).
 *
 * Concurrency: max 5 parallel scrapes (IDX is slow, be polite).
 * Results logged to scrape_log table.
 * ============================================================
 */

import { scrapeIDXBrokerSummary }      from './idxBrokerScraper';
import { scrapeStockbitBrokerSummary } from './stockbitBrokerScraper';
import type { ScrapedBrokerData }      from './idxBrokerScraper';

const CONCURRENCY_LIMIT = 5;

export interface IngestResult {
  symbol:   string;
  success:  boolean;
  source:   string | null;
  quality:  string | null;
  brokers:  number;
  errorMsg: string | null;
}

export interface IngestSummary {
  attempted:       number;
  succeeded:       number;
  failed:          number;
  durationMs:      number;
  sourceBreakdown: Record<string, number>;
  results:         IngestResult[];
}

// ── Persist a single scraped result to DB ─────────────────────

async function persistBrokerData(data: ScrapedBrokerData): Promise<void> {
  const { pool } = await import('../db');

  // Convert ScrapedBrokerEntry[] → BrokerRecord-compatible JSON
  // buildBandarmologyInput parseBrokerData reads: code, netBuy, netSell, volumePercent, avgBuyPrice, avgSellPrice
  const brokerJson = JSON.stringify(
    data.brokers.map((b) => ({
      code:          b.code,
      netBuy:        String(b.netBuy),
      netSell:       String(b.netSell),
      volumePercent: b.volumePercent !== null ? String(b.volumePercent) : null,
      avgBuyPrice:   b.avgBuyPrice   !== null ? String(b.avgBuyPrice)   : null,
      avgSellPrice:  b.avgSellPrice  !== null ? String(b.avgSellPrice)  : null,
    }))
  );

  const foreignJson = JSON.stringify({
    foreignNet:  data.foreignNet,
    domesticNet: data.domesticNet,
    totalValue:  data.totalValue,
    totalVolume: data.totalVolume,
  });

  await pool.query(
    `UPDATE stocks
     SET broker_data            = $2,
         foreign_activity_data  = $3,
         last_broker_scrape     = NOW(),
         scrape_source          = $4,
         scrape_quality         = $5
     WHERE symbol = $1`,
    [data.symbol, brokerJson, foreignJson, data.source, data.dataQuality]
  );
}

// ── Single-symbol cascade: IDX → Stockbit ────────────────────

async function ingestSymbol(symbol: string): Promise<IngestResult> {
  const attempts: Array<() => Promise<ScrapedBrokerData | null>> = [
    () => scrapeIDXBrokerSummary(symbol),
    () => scrapeStockbitBrokerSummary(symbol),
  ];

  for (const attempt of attempts) {
    let data: ScrapedBrokerData | null = null;
    try {
      data = await attempt();
    } catch { /* attempt returns null on error already */ }

    if (data && data.brokers.length > 0) {
      try {
        await persistBrokerData(data);
        return {
          symbol,
          success:  true,
          source:   data.source,
          quality:  data.dataQuality,
          brokers:  data.brokers.length,
          errorMsg: null,
        };
      } catch (err) {
        return {
          symbol,
          success:  false,
          source:   data.source,
          quality:  data.dataQuality,
          brokers:  data.brokers.length,
          errorMsg: `persist failed: ${String(err)}`,
        };
      }
    }
  }

  return {
    symbol,
    success:  false,
    source:   null,
    quality:  'FAILED',
    brokers:  0,
    errorMsg: 'all sources returned null',
  };
}

// ── Concurrency pool helper ───────────────────────────────────

async function runWithConcurrency<T>(
  items: string[],
  fn:    (item: string) => Promise<T>,
  limit: number
): Promise<T[]> {
  const results: T[] = [];
  let   idx = 0;

  async function worker(): Promise<void> {
    while (idx < items.length) {
      const i = idx++;
      results[i] = await fn(items[i]);
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, worker);
  await Promise.all(workers);
  return results;
}

// ── Log run to scrape_log table ───────────────────────────────

async function logScrapeRun(
  symbols:   string[],
  results:   IngestResult[],
  startMs:   number
): Promise<void> {
  try {
    const { pool } = await import('../db');
    const durationMs = Date.now() - startMs;
    const succeeded  = results.filter((r) => r.success).length;
    const failed     = results.filter((r) => !r.success).length;
    const breakdown  = results.reduce<Record<string, number>>((acc, r) => {
      if (r.source) acc[r.source] = (acc[r.source] ?? 0) + 1;
      return acc;
    }, {});

    await pool.query(
      `INSERT INTO scrape_log (symbols, attempted, succeeded, failed, duration_ms, source_breakdown, run_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
      [symbols, symbols.length, succeeded, failed, durationMs, JSON.stringify(breakdown)]
    );
  } catch (err) {
    console.warn('[brokerIngestor] scrape_log insert failed:', err);
  }
}

// ── Public API ────────────────────────────────────────────────

export async function ingestBrokerData(symbols: string[]): Promise<IngestSummary> {
  const startMs = Date.now();
  console.log(`[brokerIngestor] Starting ingest for ${symbols.length} symbols`);

  const results = await runWithConcurrency(symbols, ingestSymbol, CONCURRENCY_LIMIT);

  const succeeded = results.filter((r) => r.success).length;
  const failed    = results.filter((r) => !r.success).length;
  const sourceBreakdown = results.reduce<Record<string, number>>((acc, r) => {
    if (r.source) acc[r.source] = (acc[r.source] ?? 0) + 1;
    return acc;
  }, {});

  const durationMs = Date.now() - startMs;

  console.log(`[brokerIngestor] Done: ${succeeded}/${symbols.length} succeeded in ${durationMs}ms`);
  results.filter((r) => !r.success).forEach((r) =>
    console.warn(`[brokerIngestor] FAIL ${r.symbol}: ${r.errorMsg}`)
  );

  await logScrapeRun(symbols, results, startMs);

  return { attempted: symbols.length, succeeded, failed, durationMs, sourceBreakdown, results };
}
