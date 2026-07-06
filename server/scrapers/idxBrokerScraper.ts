/**
 * ============================================================
 * TEMPORARY BRIDGE — IDX BROKER SCRAPER v1.0
 * ============================================================
 * server/scrapers/idxBrokerScraper.ts
 *
 * Scrapes broker-per-saham data from idx.co.id.
 * LEGALLY GREY: IDX ToS prohibits scraping. This is a pre-launch
 * bridge until PT Berkat Digital Investasi secures a direct IDX
 * data license.
 *
 * TODO: Replace with licensed IDX data feed when PT BDI license
 *       is active. See BART_context.md for licensing roadmap.
 *
 * Strategy (cascade on failure):
 *   1. IDX direct JSON API  (fastest, no Playwright)
 *   2. IDX Playwright scrape (heavier, handles JS-rendered tables)
 *   Returns null gracefully on any failure — never throws.
 * ============================================================
 */

import { chromium } from 'playwright';

export interface ScrapedBrokerEntry {
  code:            string;
  name:            string;
  netBuy:          number;   // IDR (used by buildBandarmologyInput: b.netBuy)
  netSell:         number;   // IDR
  netVolume:       number;   // shares
  avgBuyPrice:     number | null;
  avgSellPrice:    number | null;
  volumePercent:   number | null;
}

export interface ScrapedBrokerData {
  symbol:      string;
  date:        string;       // YYYY-MM-DD trading date
  brokers:     ScrapedBrokerEntry[];
  foreignNet:  number;       // aggregate foreign net IDR
  domesticNet: number;       // aggregate domestic net IDR
  totalValue:  number;       // total day's value IDR
  totalVolume: number;       // total day's volume shares
  scrapedAt:   string;       // ISO timestamp
  source:      'IDX' | 'STOCKBIT_FALLBACK';
  dataQuality: 'COMPLETE' | 'PARTIAL' | 'FAILED';
}

// Known foreign broker codes on IDX (SMART_FOREIGN per brokerRegistry)
const FOREIGN_BROKER_CODES = new Set([
  'KZ','YU','RX','AK','BK','MS','CG','ZP','DR',
  'CS','DB','PB','ML','CY','DP','LG','DH','XC',
]);

function isForeignBroker(code: string): boolean {
  const upper = code.toUpperCase();
  return FOREIGN_BROKER_CODES.has(upper) || /^[A-Z]{2}$/.test(upper) && upper.charCodeAt(0) < 78;
}

// Parse Indonesian number: "1.234.567,89" → 1234567.89
function parseIDN(raw: string | number | undefined | null): number {
  if (raw === null || raw === undefined) return 0;
  if (typeof raw === 'number') return raw;
  const s = String(raw).replace(/[Rp\s, ]/g, (c) => c === ',' ? '.' : '').replace(/\./g, '');
  // Re-run: replace thousands dots first, then decimal comma
  const cleaned = String(raw).replace(/[Rp\s]/g, '').trim();
  // Indonesian: dots = thousands, comma = decimal
  const normalized = cleaned.replace(/\./g, '').replace(',', '.');
  const n = parseFloat(normalized);
  return isFinite(n) ? n : 0;
}

// ── Strategy 1: IDX direct JSON API ──────────────────────────

interface IdxApiRow {
  IDBroker?:    string;
  Broker?:      string;
  NamaBroker?:  string;
  BuyValue?:    number | string;
  SellValue?:   number | string;
  NetValue?:    number | string;
  BuyVolume?:   number | string;
  SellVolume?:  number | string;
  NetVolume?:   number | string;
  BuyAvg?:      number | string;
  SellAvg?:     number | string;
  Pct?:         number | string;
  FreqBuy?:     number | string;
  FreqSell?:    number | string;
}

const IDX_API_CANDIDATES = [
  (sym: string) => `https://www.idx.co.id/primary/TradingIDX/GetBrokerSummary?IDStockCode=${sym}&start=0&length=100`,
  (sym: string) => `https://www.idx.co.id/primary/StockData/GetBrokerSummary?stockCode=${sym}&start=0&length=100`,
  (sym: string) => `https://www.idx.co.id/primary/TradingIDX/GetBrokerPerSaham?IDStockCode=${sym}&start=0&length=100`,
];

const IDX_HEADERS = {
  'User-Agent':      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept':          'application/json, text/plain, */*',
  'Accept-Language': 'id-ID,id;q=0.9,en;q=0.8',
  'Referer':         'https://www.idx.co.id/id/data-pasar/laporan-perdagangan/ringkasan-transaksi-broker-per-saham/',
  'X-Requested-With':'XMLHttpRequest',
};

function parseIdxApiRows(rows: IdxApiRow[], symbol: string): ScrapedBrokerData | null {
  if (!rows || rows.length === 0) return null;

  const brokers: ScrapedBrokerEntry[] = rows.map((r) => {
    const code = String(r.IDBroker ?? r.Broker ?? '').trim();
    const name = String(r.NamaBroker ?? code);
    const buy  = parseIDN(r.BuyValue);
    const sell = parseIDN(r.SellValue);
    return {
      code,
      name,
      netBuy:        buy,
      netSell:       sell,
      netVolume:     parseIDN(r.NetVolume),
      avgBuyPrice:   r.BuyAvg  ? parseIDN(r.BuyAvg)  : null,
      avgSellPrice:  r.SellAvg ? parseIDN(r.SellAvg) : null,
      volumePercent: r.Pct     ? parseIDN(r.Pct)     : null,
    };
  }).filter((b) => b.code.length > 0);

  if (brokers.length === 0) return null;

  const foreignBrokers  = brokers.filter((b) => isForeignBroker(b.code));
  const domesticBrokers = brokers.filter((b) => !isForeignBroker(b.code));

  const foreignNet  = foreignBrokers.reduce((s, b) => s + b.netBuy - b.netSell, 0);
  const domesticNet = domesticBrokers.reduce((s, b) => s + b.netBuy - b.netSell, 0);
  const totalValue  = brokers.reduce((s, b) => s + b.netBuy + b.netSell, 0);
  const totalVolume = brokers.reduce((s, b) => s + Math.abs(b.netVolume), 0);

  return {
    symbol,
    date:        new Date().toISOString().slice(0, 10),
    brokers,
    foreignNet,
    domesticNet,
    totalValue,
    totalVolume,
    scrapedAt:   new Date().toISOString(),
    source:      'IDX',
    dataQuality: brokers.length >= 5 ? 'COMPLETE' : 'PARTIAL',
  };
}

async function tryIDXDirectAPI(symbol: string): Promise<ScrapedBrokerData | null> {
  for (const urlFn of IDX_API_CANDIDATES) {
    const url = urlFn(symbol);
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 10000);
      const res = await fetch(url, { signal: ctrl.signal, headers: IDX_HEADERS });
      clearTimeout(timer);

      if (!res.ok) continue;
      const ct = res.headers.get('content-type') ?? '';
      if (!ct.includes('json')) continue;

      const data = await res.json() as Record<string, unknown>;

      // IDX API may wrap data in various keys
      const rows = (
        (data?.Data as IdxApiRow[]) ??
        (data?.data as IdxApiRow[]) ??
        (data?.BrokerSummary as IdxApiRow[]) ??
        (data?.result as IdxApiRow[]) ??
        (Array.isArray(data) ? data as IdxApiRow[] : null)
      );

      const parsed = rows ? parseIdxApiRows(rows, symbol) : null;
      if (parsed) return parsed;
    } catch {
      continue;
    }
  }
  return null;
}

// ── Strategy 2: IDX Playwright scrape ────────────────────────

async function tryIDXPlaywright(symbol: string): Promise<ScrapedBrokerData | null> {
  let browser: Awaited<ReturnType<typeof chromium.launch>> | null = null;
  try {
    browser = await chromium.launch({ headless: true });
    const ctx  = await browser.newContext({
      userAgent: IDX_HEADERS['User-Agent'],
      locale:    'id-ID',
      viewport:  { width: 1280, height: 900 },
    });
    const page = await ctx.newPage();

    // Intercept JSON responses from the IDX API calls the page makes
    const capturedRows: IdxApiRow[] = [];
    page.on('response', async (resp) => {
      try {
        const url = resp.url();
        if (!url.includes('idx.co.id') && !url.includes('Broker')) return;
        const ct = resp.headers()['content-type'] ?? '';
        if (!ct.includes('json')) return;
        const json = await resp.json().catch(() => null);
        if (!json) return;
        const rows = json?.Data ?? json?.data ?? json?.BrokerSummary ?? (Array.isArray(json) ? json : null);
        if (Array.isArray(rows) && rows.length > 0) capturedRows.push(...rows);
      } catch { /* ignore */ }
    });

    await page.goto(
      'https://www.idx.co.id/id/data-pasar/laporan-perdagangan/ringkasan-transaksi-broker-per-saham/',
      { waitUntil: 'domcontentloaded', timeout: 15000 }
    );

    // Try to find and interact with the stock code search input
    const inputSelectors = [
      'input[placeholder*="saham" i]',
      'input[placeholder*="stock" i]',
      'input[placeholder*="kode" i]',
      'input[id*="stock" i]',
      'input[type="search"]',
      '.select2-input',
      'input[id*="kode" i]',
    ];

    for (const sel of inputSelectors) {
      const input = page.locator(sel).first();
      if (await input.count() > 0) {
        await input.fill(symbol);
        await page.waitForTimeout(1500);
        // Try pressing Enter or clicking first autocomplete result
        const option = page.locator('li[class*="option" i], .select2-result, li[role="option"]').first();
        if (await option.count() > 0) {
          await option.click();
        } else {
          await page.keyboard.press('Enter');
        }
        break;
      }
    }

    // Wait for network activity to settle and table to appear
    await page.waitForTimeout(3000);

    // If we captured JSON via network interception, use that
    if (capturedRows.length > 0) {
      const parsed = parseIdxApiRows(capturedRows, symbol);
      if (parsed) return parsed;
    }

    // Fallback: parse visible table
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
        netBuy:        parseIDN(cells[2]),
        netSell:       parseIDN(cells[3]),
        netVolume:     cells[4] ? parseIDN(cells[4]) : 0,
        avgBuyPrice:   cells[5] ? parseIDN(cells[5]) : null,
        avgSellPrice:  cells[6] ? parseIDN(cells[6]) : null,
        volumePercent: cells[7] ? parseIDN(cells[7]) : null,
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
      source:      'IDX',
      dataQuality: brokers.length >= 10 ? 'COMPLETE' : 'PARTIAL',
    };
  } catch (err) {
    console.warn(`[idxBrokerScraper] Playwright failed for ${symbol}:`, err);
    return null;
  } finally {
    await browser?.close();
  }
}

// ── Public API ────────────────────────────────────────────────

// Rate-limit state (shared across calls in this process)
let _lastRequestMs = 0;

async function applyRateLimit(): Promise<void> {
  const elapsed = Date.now() - _lastRequestMs;
  const jitter   = 200 + Math.floor(Math.random() * 300); // 200–500ms jitter per spec
  const minDelay = 3000 + jitter;
  if (elapsed < minDelay) {
    await new Promise((r) => setTimeout(r, minDelay - elapsed));
  }
  _lastRequestMs = Date.now();
}

export async function scrapeIDXBrokerSummary(
  symbol: string
): Promise<ScrapedBrokerData | null> {
  try {
    await applyRateLimit();

    // Strategy 1: direct JSON API (fast path, no browser)
    const apiResult = await tryIDXDirectAPI(symbol);
    if (apiResult) return apiResult;

    // Strategy 2: Playwright page scrape
    return await tryIDXPlaywright(symbol);
  } catch (err) {
    console.warn(`[idxBrokerScraper] scrapeIDXBrokerSummary(${symbol}) failed:`, err);
    return null;
  }
}
