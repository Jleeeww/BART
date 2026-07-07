/**
 * ============================================================
 * IDX OFFICIAL CLIENT v1.0
 * ============================================================
 * server/engine/idxClient.ts
 *
 * Minimal Node port of the session-priming approach used by
 * NeaByteLab/IDX-API (MIT). Fetches official IDX endpoints at
 * www.idx.co.id/primary/* by first priming a Cloudflare `__cf_bm`
 * cookie from the public homepage, then sending it with browser
 * headers. Verified reachable from a normal server.
 *
 * Provides ONLY what BART needs: per-stock daily OHLCV history
 * (GetTradingInfoSS). IDX's free broker/foreign endpoints are
 * market-wide aggregates, NOT per-stock, so they are not used
 * for bandarmology here.
 */
import type { OHLCVBar } from './ohlcvFetcher';

const BROWSER_HEADERS: Record<string, string> = {
  Accept: 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9,id;q=0.8',
  Referer: 'https://www.idx.co.id/',
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36',
};

const SESSION_TTL_MS = 25 * 60 * 1000; // __cf_bm lives ~30min; refresh before that
let sessionCookie = '';
let primedAt = 0;

async function ensureSession(): Promise<void> {
  if (sessionCookie && Date.now() - primedAt < SESSION_TTL_MS) return;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch('https://www.idx.co.id/id', {
      headers: BROWSER_HEADERS,
      signal: controller.signal,
    });
    const setCookies = res.headers.getSetCookie?.() ?? [];
    sessionCookie = setCookies.map((c) => c.split(';')[0]).join('; ');
    primedAt = Date.now();
    await res.body?.cancel();
  } finally {
    clearTimeout(timeout);
  }
}

// IDX throttles concurrent/rapid requests from one session. Serialize ALL
// IDX traffic through a single queue with a small gap so pages that fire
// several IDX-backed fetches at once (management + ratios + announcements)
// don't trip the throttle. One retry after a brief backoff on a throttled miss.
let idxQueue: Promise<unknown> = Promise.resolve();
const IDX_GAP_MS = 250;

async function rawFetch(url: string): Promise<any | null> {
  await ensureSession();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(url, {
      headers: {
        ...BROWSER_HEADERS,
        'X-Requested-With': 'XMLHttpRequest',
        ...(sessionCookie ? { Cookie: sessionCookie } : {}),
      },
      signal: controller.signal,
    });
    if (!res.ok) {
      if (res.status === 403 || res.status === 401) sessionCookie = '';
      return null;
    }
    const text = (await res.text()).replace(/[\u0000-\u001F]/g, ' ');
    return JSON.parse(text);
  } finally {
    clearTimeout(timeout);
  }
}

/** Fetch an IDX primary endpoint as JSON, serialized. Returns null on failure. */
export async function idxFetchJSON(url: string): Promise<any | null> {
  const run = idxQueue.then(async () => {
    try {
      let out = await rawFetch(url);
      if (out === null) {
        await new Promise((r) => setTimeout(r, 600));
        out = await rawFetch(url);
      }
      return out;
    } catch {
      return null;
    }
  });
  idxQueue = run.then(
    () => new Promise((r) => setTimeout(r, IDX_GAP_MS)),
    () => new Promise((r) => setTimeout(r, IDX_GAP_MS)),
  );
  return run;
}

/**
 * Per-stock daily OHLCV history from IDX (official EOD).
 * @param symbol Bare IDX code, e.g. "BBCA".
 * @param length Number of most-recent sessions to fetch.
 * @returns Chronological OHLCVBar[] (oldest->newest); [] on failure.
 */
export async function fetchIDXStockHistory(
  symbol: string,
  length: number = 40
): Promise<OHLCVBar[]> {
  const code = symbol.trim().toUpperCase();
  const url = `https://www.idx.co.id/primary/ListedCompany/GetTradingInfoSS?code=${code}&start=0&length=${length}`;
  const json = await idxFetchJSON(url);
  const replies = json?.replies;
  if (!Array.isArray(replies)) return [];

  const bars: OHLCVBar[] = [];
  for (const r of replies) {
    const open = Number(r.OpenPrice), high = Number(r.High);
    const low = Number(r.Low), close = Number(r.Close);
    if (![open, high, low, close].every((n) => Number.isFinite(n)) || close <= 0) continue;
    bars.push({
      time: String(r.Date).slice(0, 10),
      open, high, low, close,
      volume: r.Volume != null && isFinite(Number(r.Volume)) ? Number(r.Volume) : null,
      value: r.Value != null && isFinite(Number(r.Value)) ? Number(r.Value) : null,
    });
  }
  // IDX returns newest-first -> reverse to chronological.
  return bars.reverse();
}
