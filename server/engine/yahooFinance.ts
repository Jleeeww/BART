/**
 * ============================================================
 * YAHOO FINANCE CLIENT v1.0
 * ============================================================
 * server/engine/yahooFinance.ts
 *
 * Central wrapper around the `yahoo-finance2` package — the primary
 * source for live quotes, fundamentals, financial statements, and
 * cross-universe ticker search (see server/engine/ohlcvFetcher.ts for
 * OHLCV bars, which already has its own IDX-primary/Yahoo-fallback path).
 *
 * DESIGN RULES (mirror ohlcvFetcher.ts / macroFlowFetcher.ts):
 *   - Never throws — every export returns null/[] on any failure.
 *   - Short in-memory TTL caches so a 60s-polling UI doesn't hammer
 *     Yahoo's unofficial endpoints on every request.
 *   - Symbol-agnostic: accepts "BBCA" or "BBCA.JK".
 *
 * Scope note: broker bandarmology (net buy/sell) has no Yahoo
 * equivalent and stays Stockbit-exclusive (stockbitBandarmology.ts).
 * News stays IDX/RSS-sourced (newsFetcher.ts / idxData.ts).
 */

import YahooFinance from 'yahoo-finance2';
import { toYahooTicker } from './ohlcvFetcher';

const yf = new YahooFinance({ suppressNotices: ['yahooSurvey'] });

/** Shared client instance — for callers (e.g. ohlcvFetcher.ts) that need a Yahoo method not wrapped below. */
export function getYahooFinanceClient(): InstanceType<typeof YahooFinance> {
  return yf;
}

// ── tiny in-memory TTL cache ────────────────────────────────────────
function makeCache<T>(ttlMs: number) {
  const store = new Map<string, { value: T; at: number }>();
  return {
    get(key: string): T | undefined {
      const hit = store.get(key);
      if (!hit) return undefined;
      if (Date.now() - hit.at > ttlMs) { store.delete(key); return undefined; }
      return hit.value;
    },
    set(key: string, value: T): void {
      store.set(key, { value, at: Date.now() });
    },
  };
}

const quoteCache = makeCache<YahooQuote | null>(30_000);
const fundamentalsCache = makeCache<YahooFundamentals | null>(5 * 60_000);
const financialsCache = makeCache<YahooFinancials | null>(60 * 60_000);
const searchCache = makeCache<YahooSearchResult[]>(60_000);

// IDX stock codes are 4 uppercase letters (occasionally digits for a few
// legacy tickers) — used to filter cross-market noise out of search().
const IDX_CODE_RE = /^[A-Z][A-Z0-9]{2,5}$/;

export interface YahooQuote {
  symbol: string;
  price: number | null;
  change: number | null;
  changePercent: number | null;
  dayHigh: number | null;
  dayLow: number | null;
  volume: number | null;
  marketCap: number | null;
  companyName: string | null;
  currency: string | null;
}

/** Live quote (price/change/volume) for a single symbol. Never throws. */
export async function fetchYahooQuote(symbol: string): Promise<YahooQuote | null> {
  const ticker = toYahooTicker(symbol);
  const cached = quoteCache.get(ticker);
  if (cached !== undefined) return cached;
  try {
    const q = await yf.quote(ticker);
    if (!q) { quoteCache.set(ticker, null); return null; }
    const result: YahooQuote = {
      symbol: symbol.toUpperCase().replace(/\.JK$/i, ''),
      price: q.regularMarketPrice ?? null,
      change: q.regularMarketChange ?? null,
      changePercent: q.regularMarketChangePercent ?? null,
      dayHigh: q.regularMarketDayHigh ?? null,
      dayLow: q.regularMarketDayLow ?? null,
      volume: q.regularMarketVolume ?? null,
      marketCap: q.marketCap ?? null,
      companyName: q.longName ?? q.shortName ?? null,
      currency: q.currency ?? null,
    };
    quoteCache.set(ticker, result);
    return result;
  } catch {
    quoteCache.set(ticker, null);
    return null;
  }
}

export interface YahooFundamentals {
  symbol: string;
  sector: string | null;
  industry: string | null;
  description: string | null;
  per: number | null;         // trailing P/E
  pbv: number | null;         // price-to-book
  dividendYield: number | null; // fraction, e.g. 0.0565 = 5.65%
  roe: number | null;         // fraction
  der: number | null;         // debt-to-equity, if reported
  netMargin: number | null;
  marketCap: number | null;
}

/** Fundamentals (PER/PBV/ROE/dividend yield/sector) for a single symbol. Never throws. */
export async function fetchYahooFundamentals(symbol: string): Promise<YahooFundamentals | null> {
  const ticker = toYahooTicker(symbol);
  const cached = fundamentalsCache.get(ticker);
  if (cached !== undefined) return cached;
  try {
    const q = await yf.quoteSummary(ticker, {
      modules: ['summaryDetail', 'financialData', 'defaultKeyStatistics', 'assetProfile'],
    });
    const result: YahooFundamentals = {
      symbol: symbol.toUpperCase().replace(/\.JK$/i, ''),
      sector: q.assetProfile?.sector ?? null,
      industry: q.assetProfile?.industry ?? null,
      description: q.assetProfile?.longBusinessSummary ?? null,
      per: q.summaryDetail?.trailingPE ?? null,
      pbv: q.defaultKeyStatistics?.priceToBook ?? null,
      dividendYield: q.summaryDetail?.dividendYield ?? null,
      roe: q.financialData?.returnOnEquity ?? null,
      der: q.financialData?.debtToEquity ?? null,
      netMargin: q.financialData?.profitMargins ?? null,
      marketCap: q.summaryDetail?.marketCap ?? null,
    };
    fundamentalsCache.set(ticker, result);
    return result;
  } catch {
    fundamentalsCache.set(ticker, null);
    return null;
  }
}

export interface YahooFinancialQuarter {
  label: string;          // "Q1 2026"
  endDate: string;        // 'YYYY-MM-DD'
  totalRevenue: number | null;
  costOfRevenue: number | null;
  grossProfit: number | null;
  operatingIncome: number | null;
  incomeBeforeTax: number | null;
  netIncome: number | null;
  // Balance sheet
  totalAssets: number | null;
  stockholdersEquity: number | null;
  totalDebt: number | null;
  cashAndCashEquivalents: number | null;
  // Cash flow
  operatingCashFlow: number | null;
  freeCashFlow: number | null;
}

export interface YahooFinancials {
  symbol: string;
  quarters: YahooFinancialQuarter[]; // most recent first
}

function quarterLabel(date: Date): string {
  const q = Math.floor(date.getUTCMonth() / 3) + 1;
  return `Q${q} ${date.getUTCFullYear()}`;
}

/**
 * Quarterly income-statement figures for the financial-statements panel.
 * Uses `fundamentalsTimeSeries` (module: 'all') rather than the legacy
 * quoteSummary `incomeStatementHistoryQuarterly` submodule, which Yahoo
 * has returned almost no data for since Nov 2024. Some fields (gross
 * profit / cost of revenue / operating income) are legitimately absent
 * for financial-sector issuers (banks don't report COGS) — left null
 * rather than synthesized. Never throws.
 */
export async function fetchYahooFinancials(symbol: string): Promise<YahooFinancials | null> {
  const ticker = toYahooTicker(symbol);
  const cached = financialsCache.get(ticker);
  if (cached !== undefined) return cached;
  try {
    const period1 = new Date();
    period1.setUTCFullYear(period1.getUTCFullYear() - 2);
    const rows = await yf.fundamentalsTimeSeries(ticker, {
      period1: period1.toISOString().slice(0, 10),
      type: 'quarterly',
      module: 'all',
    });
    if (!Array.isArray(rows) || rows.length === 0) { financialsCache.set(ticker, null); return null; }

    const quarters: YahooFinancialQuarter[] = rows
      .map((r: any) => {
        const date = new Date(r.date);
        return {
          label: quarterLabel(date),
          endDate: date.toISOString().slice(0, 10),
          totalRevenue: r.totalRevenue ?? r.operatingRevenue ?? null,
          costOfRevenue: r.costOfRevenue ?? null,
          grossProfit: r.grossProfit ?? (r.totalRevenue != null && r.costOfRevenue != null ? r.totalRevenue - r.costOfRevenue : null),
          operatingIncome: r.operatingIncome ?? r.totalOperatingIncomeAsReported ?? null,
          incomeBeforeTax: r.pretaxIncome ?? null,
          netIncome: r.netIncome ?? r.netIncomeCommonStockholders ?? null,
          totalAssets: r.totalAssets ?? null,
          stockholdersEquity: r.stockholdersEquity ?? r.totalEquityGrossMinorityInterest ?? null,
          totalDebt: r.totalDebt ?? null,
          cashAndCashEquivalents: r.cashAndCashEquivalents ?? null,
          operatingCashFlow: r.operatingCashFlow ?? null,
          freeCashFlow: r.freeCashFlow ?? null,
        };
      })
      .sort((a, b) => b.endDate.localeCompare(a.endDate));

    const result: YahooFinancials = { symbol: symbol.toUpperCase().replace(/\.JK$/i, ''), quarters };
    financialsCache.set(ticker, result);
    return result;
  } catch {
    financialsCache.set(ticker, null);
    return null;
  }
}

export interface YahooSearchResult {
  symbol: string;      // bare IDX symbol, no ".JK"
  companyName: string;
}

/**
 * Cross-universe ticker search, filtered to `.JK`-suffixed (IDX-listed)
 * results only — Yahoo's search() spans all global markets. Never throws.
 */
export async function searchYahooTickers(query: string): Promise<YahooSearchResult[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const cached = searchCache.get(q.toUpperCase());
  if (cached !== undefined) return cached;
  try {
    const r = await yf.search(q, { quotesCount: 10 });
    const results: YahooSearchResult[] = (r.quotes ?? [])
      .filter((item: any) => typeof item?.symbol === 'string' && item.symbol.toUpperCase().endsWith('.JK'))
      .map((item: any): YahooSearchResult => ({
        symbol: String(item.symbol).slice(0, -3).toUpperCase(),
        companyName: String(item.longname ?? item.shortname ?? item.symbol),
      }))
      .filter((item: YahooSearchResult) => IDX_CODE_RE.test(item.symbol));
    searchCache.set(q.toUpperCase(), results);
    return results;
  } catch {
    searchCache.set(q.toUpperCase(), []);
    return [];
  }
}
