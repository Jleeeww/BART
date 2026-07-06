/**
 * ============================================================
 * TEMPORARY BRIDGE — STOCKBIT BROKER SCRAPER v1.0
 * ============================================================
 * server/scrapers/stockbitBrokerScraper.ts
 *
 * Fallback scraper for broker-per-saham data when IDX direct
 * API and Playwright fail. Scrapes Stockbit's public pages.
 *
 * LEGALLY GREY: Stockbit ToS may prohibit scraping.
 * Same pre-launch bridge rationale as idxBrokerScraper.ts.
 * Replace with licensed feed when PT BDI license is active.
 *
 * Strategy (cascade on failure):
 *   1. Stockbit internal JSON API intercept (fast)
 *   2. Stockbit page HTML table parse (fallback)
 *   Returns null gracefully — never throws.
 * ============================================================
 */

import { chromium } from 'playwright';
import type { ScrapedBrokerData, ScrapedBrokerEntry } from './idxBrokerScraper';

export type { ScrapedBrokerData, ScrapedBrokerEntry };

const FOREIGN_BROKER_CODES = new Set([
  'KZ','YU','RX','AK','BK','MS','CG','ZP','DR',
  'CS','DB','PB','ML','CY','DP','LG','DH','XC',
]);

function isForeignBroker(code: string): boolean {
  const upper = code.toUpperCase();
  return FOREIGN_BROKER_CODES.has(upper) || /^[A-Z]{2}$/.test(upper) && upper.charCodeAt(0) < 78;
}

function parseNum(raw: string | number | undefined | null): number {
  if (raw === null || raw === undefined) return 0;
  if (typeof raw === 'number') return raw;
  const s = String(raw).replace(/[^0-9.\-]/g, '');
  const n = parseFloat(s);
  return isFinite(n) ? n : 0;
}

// Stockbit uses compact notation: "1.23B" = 1.23 billion IDR, "456M" = 456 million
function parseCompact(raw: string | number | undefined | null): number {
  if (raw === null || raw === undefined) return 0;
  if (typeof raw === 'number') return raw;
  const s = String(raw).trim().toUpperCase();
  const multipliers: Record<string, number> = { T: 1e12, B: 1e9, M: 1e6, K: 1e3 };
  for (const [suffix, mult] of Object.entries(multipliers)) {
    if (s.endsWith(suffix)) {
      const n = parseFloat(s.slice(0, -1));
      return isFinite(n) ? n * mult : 0;
    }
  }
  return parseNum(raw);
}

const STOCKBIT_USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

// Candidate Stockbit API endpoints (reverse-engineered — may break without notice)
const STOCKBIT_API_CANDIDATES = [
  (sym: string) => `https://stockbit.com/api/v2.0/stock/${sym}/brokerSummary`,
  (sym: string) => `https://stockbit.com/api/v2.0/market/broker-summary/${sym}`,
  (sym: string) => `https://api.stockbit.com/v2.0/stock/${sym}/broker-transaction`,
];

function parseStockbitApiRows(
  rows: Record<string, unknown>[],
  symbol: string
): ScrapedBrokerData | null {
  if (!rows || rows.length === 0) return null;

  const brokers: ScrapedBrokerEntry[] = rows.map((r) => {
    const code = String(r.broker_id ?? r.BrokerID ?? r.broker ?? r.code ?? '').trim();
    const name = String(r.broker_name ?? r.BrokerName ?? r.name ?? code);
    type V = string | number | null | undefined;
    const buy  = parseCompact((r.buy_value  ?? r.BuyValue  ?? r.buyValue  ?? 0) as V);
    const sell = parseCompact((r.sell_value ?? r.SellValue ?? r.sellValue ?? 0) as V);
    const avgBuyRaw  = (r.avg_buy  ?? r.AvgBuy)  as V;
    const avgSellRaw = (r.avg_sell ?? r.AvgSell) as V;
    const pctRaw     = (r.pct      ?? r.Pct)     as V;
    return {
      code,
      name,
      netBuy:        buy,
      netSell:       sell,
      netVolume:     parseNum((r.net_volume ?? r.NetVolume ?? r.netVolume ?? 0) as V),
      avgBuyPrice:   avgBuyRaw  != null ? parseNum(avgBuyRaw)  : null,
      avgSellPrice:  avgSellRaw != null ? parseNum(avgSellRaw) : null,
      volumePercent: pctRaw     != null ? parseNum(pctRaw)     : null,
    };
  }).filter((b) => b.code.length > 0);

  if (brokers.length === 0) return null;

  const foreignNet  = brokers.filter((b) => isForeignBroker(b.code)).reduce((s, b) => s + b.netBuy - b.netSell, 0);
  const domesticNet = brokers.filter((b) => !isForeignBroker(b.code)).reduce((s, b) => s + b.netBuy - b.netSell, 0);

  return {
    symbol,
    date:        new Date().toISOString().slice(0, 10),
    brokers,
    foreignNet,
    domesticNet,
    totalValue:  brokers.reduce((s, b) => s + b.netBuy + b.netSell, 0),
    totalVolume: brokers.reduce((s, b) => s + Math.abs(b.netVolume), 0),
    scrapedAt:   new Date().toISOString(),
    source:      'STOCKBIT_FALLBACK',
    dataQuality: brokers.length >= 5 ? 'COMPLETE' : 'PARTIAL',
  };
}

// Rate-limit state (independent from IDX scraper)
let _lastRequestMs = 0;

async function applyRateLimit(): Promise<void> {
  const elapsed  = Date.now() - _lastRequestMs;
  const jitter   = 300 + Math.floor(Math.random() * 400);
  const minDelay = 4000 + jitter;
  if (elapsed < minDelay) {
    await new Promise((r) => setTimeout(r, minDelay - elapsed));
  }
  _lastRequestMs = Date.now();
}

async function tryStockbitPlaywright(symbol: string): Promise<ScrapedBrokerData | null> {
  let browser: Awaited<ReturnType<typeof chromium.launch>> | null = null;
  try {
    browser = await chromium.launch({ headless: true });
    const ctx  = await browser.newContext({
      userAgent: STOCKBIT_USER_AGENT,
      locale:    'id-ID',
      viewport:  { width: 1280, height: 900 },
      extraHTTPHeaders: {
        'Accept-Language': 'id-ID,id;q=0.9,en;q=0.8',
      },
    });
    const page = await ctx.newPage();

    // Intercept JSON API calls made by the Stockbit SPA
    const capturedRows: Record<string, unknown>[] = [];
    page.on('response', async (resp) => {
      try {
        const url = resp.url();
        if (!url.includes('stockbit.com') && !url.includes('broker')) return;
        const ct = resp.headers()['content-type'] ?? '';
        if (!ct.includes('json')) return;
        const json = await resp.json().catch(() => null) as Record<string, unknown> | null;
        if (!json) return;
        // Stockbit nests data under various paths
        const rows =
          (json?.data as Record<string, unknown>[]) ??
          (json?.result as Record<string, unknown>[]) ??
          (json?.brokers as Record<string, unknown>[]) ??
          ((json as Record<string, unknown>)?.Data as Record<string, unknown>[]) ??
          (Array.isArray(json) ? (json as Record<string, unknown>[]) : null);
        if (Array.isArray(rows) && rows.length > 0) capturedRows.push(...rows);
      } catch { /* ignore */ }
    });

    await page.goto(
      `https://stockbit.com/symbol/${symbol}`,
      { waitUntil: 'domcontentloaded', timeout: 20000 }
    );

    // Navigate to broker tab if there is one
    const brokerTabSelectors = [
      'a[href*="broker" i]',
      'button:has-text("Broker")',
      '[role="tab"]:has-text("Broker")',
      'li:has-text("Broker")',
    ];
    for (const sel of brokerTabSelectors) {
      const el = page.locator(sel).first();
      if (await el.count() > 0) {
        await el.click().catch(() => {});
        break;
      }
    }

    // Wait for broker data to load
    await page.waitForTimeout(3000);

    // Try intercepted JSON first
    if (capturedRows.length > 0) {
      const parsed = parseStockbitApiRows(capturedRows, symbol);
      if (parsed) return parsed;
    }

    // HTML table fallback
    const tableRows = await page.$$('table tbody tr');
    if (tableRows.length < 3) return null;

    const brokers: ScrapedBrokerEntry[] = [];
    for (const row of tableRows) {
      const cells = await row.$$eval('td', (tds) => tds.map((td) => td.innerText.trim()));
      if (cells.length < 4) continue;
      const code = cells[0]?.replace(/\s/g, '') ?? '';
      if (!code || code.length > 4) continue;
      brokers.push({
        code,
        name:          cells[1] ?? code,
        netBuy:        parseCompact(cells[2]),
        netSell:       parseCompact(cells[3]),
        netVolume:     cells[4] ? parseNum(cells[4]) : 0,
        avgBuyPrice:   cells[5] ? parseCompact(cells[5]) : null,
        avgSellPrice:  cells[6] ? parseCompact(cells[6]) : null,
        volumePercent: cells[7] ? parseNum(cells[7]) : null,
      });
    }

    if (brokers.length < 3) return null;

    const foreignNet  = brokers.filter((b) => isForeignBroker(b.code)).reduce((s, b) => s + b.netBuy - b.netSell, 0);
    const domesticNet = brokers.filter((b) => !isForeignBroker(b.code)).reduce((s, b) => s + b.netBuy - b.netSell, 0);
    return {
      symbol,
      date:        new Date().toISOString().slice(0, 10),
      brokers,
      foreignNet,
      domesticNet,
      totalValue:  brokers.reduce((s, b) => s + b.netBuy + b.netSell, 0),
      totalVolume: brokers.reduce((s, b) => s + Math.abs(b.netVolume), 0),
      scrapedAt:   new Date().toISOString(),
      source:      'STOCKBIT_FALLBACK',
      dataQuality: brokers.length >= 10 ? 'COMPLETE' : 'PARTIAL',
    };
  } catch (err) {
    console.warn(`[stockbitScraper] Playwright failed for ${symbol}:`, err);
    return null;
  } finally {
    await browser?.close();
  }
}

export async function scrapeStockbitBrokerSummary(
  symbol: string
): Promise<ScrapedBrokerData | null> {
  try {
    await applyRateLimit();
    return await tryStockbitPlaywright(symbol);
  } catch (err) {
    console.warn(`[stockbitScraper] scrapeStockbitBrokerSummary(${symbol}) failed:`, err);
    return null;
  }
}
