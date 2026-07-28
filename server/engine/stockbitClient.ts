/**
 * ============================================================
 * STOCKBIT CLIENT v1.0
 * ============================================================
 * server/engine/stockbitClient.ts
 *
 * Authenticated client for Stockbit's exodus API. Provides the
 * per-broker daily activity used to reconstruct per-stock
 * bandarmology (broker net buy/sell, foreign/local/gov split).
 *
 * ⚠️ AUTH: starts from STOCKBIT_TOKEN in .env (a Bearer JWT copied
 * from a logged-in Stockbit web session), then gets swapped out at
 * runtime via setToken() by stockbitAuth.ts's scheduled Playwright
 * refresh (reuses a saved login session — no stored password/OTP).
 *
 * ⚠️ ToS: automated access to Stockbit may violate their Terms.
 * Enabled only when STOCKBIT_TOKEN is set. Personal use, at the
 * account owner's own risk.
 *
 * Rate limit: ~40 requests / 5 min → paced via a serialized queue.
 */

const EXODUS = 'https://exodus.stockbit.com';

const BASE_HEADERS: Record<string, string> = {
  Accept: 'application/json, text/plain, */*',
  'X-Platform': 'web',
  Referer: 'https://stockbit.com/',
  Origin: 'https://stockbit.com',
  'User-Agent':
    'Mozilla/5.0 (X11; Linux x86_64; rv:149.0) Gecko/20100101 Firefox/149.0',
};

export function stockbitEnabled(): boolean {
  return !!token;
}

let token = process.env.STOCKBIT_TOKEN ?? '';

/** Called by stockbitAuth's scheduled refresh (or a cached token at boot) to swap in a fresh token. */
export function setToken(newToken: string): void {
  token = newToken;
}

/**
 * Admin-configurable override: reads the token from the `system_config` DB
 * table (set via the admin dashboard) and swaps it in if present, taking
 * precedence over the `.env`/local-file value this module boots with.
 * No-op (keeps whatever token is already set) if nothing is configured in DB.
 */
export async function loadTokenFromConfig(): Promise<void> {
  const { getConfig, CONFIG_KEYS } = await import('./systemConfig');
  const cfg = await getConfig<{ token: string; updatedAt: string } | null>(CONFIG_KEYS.STOCKBIT_TOKEN, null);
  if (cfg?.token) setToken(cfg.token);
}

// Serialized queue: ~1 request / 8s stays well under 40 / 5min.
let queue: Promise<unknown> = Promise.resolve();
const GAP_MS = Number(process.env.STOCKBIT_GAP_MS ?? 8000);

async function rawFetch(path: string): Promise<any | null> {
  if (!token) return null;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  try {
    const res = await fetch(`${EXODUS}${path}`, {
      headers: { ...BASE_HEADERS, Authorization: `Bearer ${token}` },
      signal: controller.signal,
    });
    if (!res.ok) {
      if (res.status === 401) console.warn('[stockbit] 401 — token expired/invalid');
      return null;
    }
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/** Serialized fetch of an exodus path (path includes leading slash + query). */
export async function stockbitFetch(path: string): Promise<any | null> {
  const run = queue.then(() => rawFetch(path));
  queue = run.then(
    () => new Promise((r) => setTimeout(r, GAP_MS)),
    () => new Promise((r) => setTimeout(r, GAP_MS)),
  );
  return run;
}

export interface BrokerActivityRow {
  stockCode: string;
  brokerCode: string;
  type: 'FOREIGN' | 'LOCAL' | 'GOVERNMENT';
  value: number; // signed net IDR (buy positive, sell negative)
  lot: number;
  avgPrice: number;
  freq: number;
}

/**
 * Per-broker daily net activity: every stock this broker net bought/sold.
 * period: RT_PERIOD_LAST_1_DAY (default) | RT_PERIOD_LAST_1_WEEK | …
 */
export async function fetchBrokerActivity(
  brokerCode: string,
  period = 'RT_PERIOD_LAST_1_DAY',
): Promise<BrokerActivityRow[]> {
  const path =
    `/order-trade/broker/activity?broker_code=${brokerCode}` +
    `&limit=400&page=1&transaction_type=TRANSACTION_TYPE_NET` +
    `&market_board=MARKET_TYPE_REGULER&investor_type=INVESTOR_TYPE_ALL&period=${period}`;
  const raw = await stockbitFetch(path);
  const t = raw?.data?.broker_activity_transaction;
  if (!t) return [];

  const map = (arr: any[]): BrokerActivityRow[] =>
    (arr ?? []).map((x: any) => ({
      stockCode: String(x.stock_code ?? '').toUpperCase(),
      brokerCode: String(x.broker_code ?? brokerCode).toUpperCase(),
      type: String(x.type ?? '').replace('BROKER_TYPE_', '') as BrokerActivityRow['type'],
      value: Number(x.value) || 0,
      lot: Number(x.lot) || 0,
      avgPrice: Number(x.avg_price) || 0,
      freq: Number(x.freq) || 0,
    })).filter((r: BrokerActivityRow) => r.stockCode);

  return [...map(t.brokers_buy), ...map(t.brokers_sell)];
}
