/**
 * ============================================================
 * IDX MARKET DATA v1.0
 * ============================================================
 * server/engine/idxData.ts
 *
 * Official IDX datasets beyond OHLCV + company profile, each
 * fetched via the cookie-primed idxClient and cached in memory.
 * Powers: Keuangan/Valuasi (financial ratios), Berita
 * (announcements), Pasar/header (indices), Homepage/Pasar
 * (daily movers), corporate actions (dividends).
 *
 * All fetchers never throw — return [] / null on failure.
 */
import { idxFetchJSON } from './idxClient';

const num = (v: unknown): number | null => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

// IDX throttles rapid sequential requests from one session — pace walk-backs.
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Parse IDX's Indonesian-formatted number strings: "5.916,070" -> 5916.07
function parseIDNumber(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v !== 'string') return null;
  const cleaned = v.replace(/\./g, '').replace(',', '.').replace('%', '').trim();
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

interface Cache<T> { at: number; data: T; }
function makeCache<T>() { return new Map<string, Cache<T>>(); }
function fresh<T>(c: Cache<T> | undefined, ttl: number): c is Cache<T> {
  return !!c && Date.now() - c.at < ttl;
}

// ─── 1. Financial ratios (per-stock fundamentals, market-wide monthly) ─────────
export interface IDXFinancialRatio {
  code: string;
  name: string;
  sector: string | null;
  per: number | null;
  pbv: number | null;
  der: number | null;
  roe: number | null;
  roa: number | null;
  npm: number | null;
  eps: number | null;
  bookValue: number | null;
  sales: number | null;
  netProfit: number | null;
  assets: number | null;
  equity: number | null;
  fsDate: string | null;
}

const ratioCache = makeCache<IDXFinancialRatio[]>();
const RATIO_TTL = 6 * 60 * 60 * 1000; // 6h

/** All-stock financial ratios for the most recent available period. */
export async function fetchIDXFinancialRatios(): Promise<IDXFinancialRatio[]> {
  const hit = ratioCache.get('all');
  if (fresh(hit, RATIO_TTL)) return hit.data;

  const map = (rows: any[]): IDXFinancialRatio[] => rows.map((r: any) => ({
    code: String(r.code ?? '').toUpperCase(),
    name: r.stockName ?? '',
    sector: r.sector ?? null,
    per: num(r.per), pbv: num(r.priceBV), der: num(r.deRatio),
    roe: num(r.roe), roa: num(r.roa), npm: num(r.npm), eps: num(r.eps),
    bookValue: num(r.bookValue), sales: num(r.sales),
    netProfit: num(r.profitAttrOwner ?? r.profitPeriod),
    assets: num(r.assets), equity: num(r.equity),
    fsDate: r.fsDate ?? null,
  })).filter((x: IDXFinancialRatio) => x.code);

  const now = new Date();
  let best: IDXFinancialRatio[] = [];
  // Walk back a few quarters. The current month often has only a handful of
  // early filers — require a near-full period before accepting.
  for (let back = 0; back < 8; back++) {
    if (back > 0) await sleep(500);
    const d = new Date(now.getFullYear(), now.getMonth() - back, 1);
    const y = d.getFullYear(), m = d.getMonth() + 1;
    const url = `https://www.idx.co.id/primary/DigitalStatistic/GetApiDataPaginated?urlName=LINK_FINANCIAL_DATA_RATIO&periodYear=${y}&periodMonth=${m}&periodType=monthly&isPrint=False&cumulative=false&pageSize=1500&pageNumber=1`;
    const raw: any = await idxFetchJSON(url);
    const rows = raw?.data;
    if (Array.isArray(rows) && rows.length > 0) {
      const mapped = map(rows);
      if (mapped.length > best.length) best = mapped;
      if (mapped.length >= 300) break; // full period found
    }
  }
  if (best.length > 0) ratioCache.set('all', { at: Date.now(), data: best });
  return best.length > 0 ? best : (ratioCache.get('all')?.data ?? []);
}

export async function getIDXRatioForSymbol(symbol: string): Promise<IDXFinancialRatio | null> {
  const all = await fetchIDXFinancialRatios();
  const sym = symbol.toUpperCase();
  return all.find((r) => r.code === sym) ?? null;
}

// ─── 2. Company announcements (per-stock disclosures) ──────────────────────────
export interface IDXAnnouncement {
  title: string;
  date: string | null;
  attachments: { name: string; url: string }[];
}

const annCache = makeCache<IDXAnnouncement[]>();
const ANN_TTL = 60 * 60 * 1000; // 1h

export async function fetchIDXAnnouncements(symbol: string, pageSize = 15): Promise<IDXAnnouncement[]> {
  const sym = symbol.toUpperCase();
  const hit = annCache.get(sym);
  if (fresh(hit, ANN_TTL)) return hit.data;

  const url = `https://www.idx.co.id/primary/ListedCompany/GetProfileAnnouncement?KodeEmiten=${sym}&indexFrom=0&pageSize=${pageSize}&dateFrom=&dateTo=&lang=id`;
  const raw: any = await idxFetchJSON(url);
  const replies = raw?.Replies ?? raw?.replies;
  if (!Array.isArray(replies)) return annCache.get(sym)?.data ?? [];

  const mapped: IDXAnnouncement[] = replies.map((r: any) => {
    const p = r.pengumuman ?? r;
    const atts = (r.attachments ?? []).map((a: any) => ({
      name: a.OriginalFilename ?? a.FileId ?? 'Lampiran',
      url: a.FullSavePath
        ? (String(a.FullSavePath).startsWith('http') ? a.FullSavePath : `https://www.idx.co.id${a.FullSavePath}`)
        : '',
    }));
    return {
      title: p.JudulPengumuman ?? p.Title ?? p.judul ?? 'Pengumuman',
      date: p.TglPengumuman ?? p.PublishDate ?? p.tanggal ?? null,
      attachments: atts,
    };
  });
  annCache.set(sym, { at: Date.now(), data: mapped });
  return mapped;
}

// ─── 3. Index list (IHSG + sector/thematic indices) ────────────────────────────
export interface IDXIndex {
  code: string;
  value: number | null;
  change: number | null;
  percent: number | null;
  time: string | null;
}

const indexCache = makeCache<IDXIndex[]>();
const INDEX_TTL = 5 * 60 * 1000; // 5min

export async function fetchIDXIndexList(): Promise<IDXIndex[]> {
  const hit = indexCache.get('all');
  if (fresh(hit, INDEX_TTL)) return hit.data;

  const raw: any = await idxFetchJSON('https://www.idx.co.id/primary/home/GetIndexList');
  const rows = Array.isArray(raw) ? raw : raw?.data;
  if (!Array.isArray(rows)) return indexCache.get('all')?.data ?? [];

  const mapped: IDXIndex[] = rows.map((r: any) => ({
    code: r.IndexCode ?? '',
    value: parseIDNumber(r.Current ?? r.Closing),
    change: parseIDNumber(r.Change),
    percent: parseIDNumber(r.Percent),
    time: r.Time ?? null,
  })).filter((x: IDXIndex) => x.code);
  indexCache.set('all', { at: Date.now(), data: mapped });
  return mapped;
}

// ─── 4. Daily movers (derived from all-stock summary) ──────────────────────────
export interface IDXMover {
  code: string;
  name: string;
  close: number | null;
  change: number | null;
  changePercent: number | null;
  value: number | null;   // IDR turnover
  volume: number | null;
}

const summaryCache = makeCache<IDXMover[]>();
const SUMMARY_TTL = 5 * 60 * 1000;

function fmtDate(d: Date): string {
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
}

/** All-stock daily summary for the latest trading day. */
export async function fetchIDXStockSummary(): Promise<IDXMover[]> {
  const hit = summaryCache.get('latest');
  if (fresh(hit, SUMMARY_TTL)) return hit.data;

  const now = new Date();
  for (let back = 0; back < 7; back++) {
    if (back > 0) await sleep(500);
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - back);
    const url = `https://www.idx.co.id/primary/TradingSummary/GetStockSummary?date=${fmtDate(d)}`;
    const raw: any = await idxFetchJSON(url);
    const rows = raw?.data;
    if (Array.isArray(rows) && rows.length > 0) {
      const mapped: IDXMover[] = rows.map((r: any) => {
        const prev = num(r.Previous), close = num(r.Close);
        const pct = prev && prev > 0 && close != null ? Number((((close - prev) / prev) * 100).toFixed(2)) : null;
        return {
          code: r.StockCode ?? '', name: r.StockName ?? '',
          close, change: num(r.Change), changePercent: pct,
          value: num(r.Value), volume: num(r.Volume),
        };
      }).filter((x: IDXMover) => x.code && x.value && x.value > 0);
      summaryCache.set('latest', { at: Date.now(), data: mapped });
      return mapped;
    }
  }
  return summaryCache.get('latest')?.data ?? [];
}

export async function getIDXMovers(limit = 10): Promise<{ gainers: IDXMover[]; losers: IDXMover[]; mostActive: IDXMover[] }> {
  const all = await fetchIDXStockSummary();
  const withPct = all.filter((s) => s.changePercent != null);
  const gainers = [...withPct].sort((a, b) => (b.changePercent! - a.changePercent!)).slice(0, limit);
  const losers = [...withPct].sort((a, b) => (a.changePercent! - b.changePercent!)).slice(0, limit);
  const mostActive = [...all].sort((a, b) => (b.value! - a.value!)).slice(0, limit);
  return { gainers, losers, mostActive };
}

// ─── 5. Dividends (corporate actions, market-wide monthly) ─────────────────────
export interface IDXDividend {
  code: string;
  name: string;
  cashDividend: number | null;
  cumDate: string | null;
  exDate: string | null;
  paymentDate: string | null;
}

const divCache = makeCache<IDXDividend[]>();
const DIV_TTL = 6 * 60 * 60 * 1000;

export async function fetchIDXDividends(): Promise<IDXDividend[]> {
  const hit = divCache.get('recent');
  if (fresh(hit, DIV_TTL)) return hit.data;

  const now = new Date();
  const acc: IDXDividend[] = [];
  // Aggregate the last 3 months of dividend announcements.
  for (let back = 0; back < 3; back++) {
    if (back > 0) await sleep(500);
    const d = new Date(now.getFullYear(), now.getMonth() - back, 1);
    const query = Buffer.from(JSON.stringify({ year: String(d.getFullYear()), month: String(d.getMonth() + 1), quarter: 0, type: 'monthly' })).toString('base64');
    const url = `https://www.idx.co.id/primary/DigitalStatistic/GetApiDataPaginated?urlName=LINK_DIVIDEND&query=${query}&periodYear=${d.getFullYear()}&periodMonth=${d.getMonth() + 1}&periodType=monthly&isPrint=False&cumulative=false`;
    const raw: any = await idxFetchJSON(url);
    const rows = raw?.data ?? raw?.replies;
    if (Array.isArray(rows)) {
      for (const r of rows) {
        acc.push({
          code: String(r.Code ?? r.code ?? r.StockCode ?? '').toUpperCase(),
          name: r.Name ?? r.stockName ?? r.CompanyName ?? '',
          cashDividend: num(r.CashDividendPerShareInIDR ?? r.Dividate ?? r.cashDividend ?? r.Dividend),
          cumDate: r.RecordDate ?? r.CumDate ?? r.cumDate ?? null,
          exDate: r.ExDate ?? r.exDate ?? null,
          paymentDate: r.PaymentDate ?? r.paymentDate ?? null,
        });
      }
    }
  }
  const mapped = acc.filter((x) => x.code);
  divCache.set('recent', { at: Date.now(), data: mapped });
  return mapped;
}
