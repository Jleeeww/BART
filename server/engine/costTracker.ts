/**
 * ============================================================
 * COST TRACKER v1.0
 * ============================================================
 * server/engine/costTracker.ts
 *
 * In-memory daily cost counters for all Claude API pipelines.
 * Persists to api_cost_log table on each update.
 *
 * Pricing: claude-sonnet-4-5 (May 2026)
 *   Input:      $3.00 / 1M tokens
 *   Output:     $15.00 / 1M tokens
 *   Web search: $0.01 / call
 *
 * Daily caps:
 *   News:       $2.00
 *   Management: $1.00
 *   Insider:    $2.00
 *   Chat:       $1.00 (per-user limits enforced separately)
 *   GLOBAL:     $5.00
 * ============================================================
 */

import { getCostCapOverrides } from './systemConfig';

export type Pipeline = 'news' | 'management' | 'insider' | 'chat' | 'thematic';

// ── Pricing constants ─────────────────────────────────────────

const INPUT_COST_PER_TOKEN  = 3.00  / 1_000_000;   // $3.00/MTok
const OUTPUT_COST_PER_TOKEN = 15.00 / 1_000_000;   // $15.00/MTok
const WEB_SEARCH_COST       = 0.01;                 // $0.01/call

// ── Daily caps ────────────────────────────────────────────────

const BASE_DAILY_CAPS: Record<Pipeline | 'global', number> = {
  news:       2.00,
  management: 1.00,
  insider:    2.00,
  chat:       1.00,
  thematic:   1.50,
  global:     5.00,
};

// Effective caps = base caps merged with any admin runtime overrides (cost_caps).
// Read synchronously so the hot circuit-breaker path never blocks.
function effectiveCaps(): Record<Pipeline | 'global', number> {
  try {
    const ov = getCostCapOverrides();
    return {
      ...BASE_DAILY_CAPS,
      ...(typeof ov.news     === 'number' ? { news:     ov.news }     : {}),
      ...(typeof ov.thematic === 'number' ? { thematic: ov.thematic } : {}),
      ...(typeof ov.global   === 'number' ? { global:   ov.global }   : {}),
      ...(typeof ov.management === 'number' ? { management: ov.management } : {}),
      ...(typeof ov.insider  === 'number' ? { insider:  ov.insider }  : {}),
      ...(typeof ov.chat     === 'number' ? { chat:     ov.chat }     : {}),
    };
  } catch {
    return BASE_DAILY_CAPS;
  }
}

// Back-compat export: base caps (callers that read a static number still work).
export const DAILY_CAPS = BASE_DAILY_CAPS;

// ── In-memory state ───────────────────────────────────────────

interface DayState {
  date:           string;   // YYYY-MM-DD WIB
  news:           number;
  management:     number;
  insider:        number;
  chat:           number;
  thematic:       number;
  total:          number;
  requestCount:   number;
}

function todayWIB(): string {
  const now = new Date();
  const wib = new Date(now.getTime() + 7 * 60 * 60 * 1000);
  return wib.toISOString().slice(0, 10);
}

function freshState(): DayState {
  return { date: todayWIB(), news: 0, management: 0, insider: 0, chat: 0, thematic: 0, total: 0, requestCount: 0 };
}

let _state: DayState = freshState();

function ensureToday(): void {
  const today = todayWIB();
  if (_state.date !== today) {
    _state = freshState();
  }
}

// ── Public API ────────────────────────────────────────────────

export function estimateCost(
  inputTokens:  number,
  outputTokens: number,
  webSearches:  number = 0
): number {
  return (
    inputTokens  * INPUT_COST_PER_TOKEN +
    outputTokens * OUTPUT_COST_PER_TOKEN +
    webSearches  * WEB_SEARCH_COST
  );
}

export function recordCost(
  pipeline:     Pipeline,
  inputTokens:  number,
  outputTokens: number,
  webSearches:  number = 0
): number {
  ensureToday();
  const cost = estimateCost(inputTokens, outputTokens, webSearches);
  _state[pipeline] += cost;
  _state.total     += cost;
  _state.requestCount += 1;
  persistCost();
  return cost;
}

export function isCapReached(pipeline: Pipeline): boolean {
  ensureToday();
  const caps = effectiveCaps();
  if (_state[pipeline] >= caps[pipeline]) return true;
  if (_state.total     >= caps.global)   return true;
  return false;
}

export function getDailyCost(): Readonly<DayState> {
  ensureToday();
  return { ..._state };
}

export function getCostSummary(): string {
  ensureToday();
  return (
    `[costTracker] Date=${_state.date} ` +
    `News=$${_state.news.toFixed(4)} ` +
    `Mgmt=$${_state.management.toFixed(4)} ` +
    `Insider=$${_state.insider.toFixed(4)} ` +
    `Chat=$${_state.chat.toFixed(4)} ` +
    `Thematic=$${_state.thematic.toFixed(4)} ` +
    `Total=$${_state.total.toFixed(4)}/${effectiveCaps().global} ` +
    `Requests=${_state.requestCount}`
  );
}

// Debounced persist — at most once per 30s to avoid hammering DB
let _persistTimer: ReturnType<typeof setTimeout> | null = null;

let _thematicColEnsured = false;

function persistCost(): void {
  if (_persistTimer) return;
  _persistTimer = setTimeout(async () => {
    _persistTimer = null;
    try {
      const { pool } = await import('../db');
      const s = _state;
      // api_cost_log is not Drizzle-managed; ensure the thematic column exists (idempotent, once).
      if (!_thematicColEnsured) {
        await pool.query(`ALTER TABLE api_cost_log ADD COLUMN IF NOT EXISTS thematic_cost numeric DEFAULT 0`).catch(() => {});
        _thematicColEnsured = true;
      }
      await pool.query(
        `INSERT INTO api_cost_log (date, estimated_cost_usd, news_cost, management_cost, insider_cost, chat_cost, thematic_cost, request_count, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
         ON CONFLICT (date) DO UPDATE SET
           estimated_cost_usd = EXCLUDED.estimated_cost_usd,
           news_cost           = EXCLUDED.news_cost,
           management_cost     = EXCLUDED.management_cost,
           insider_cost        = EXCLUDED.insider_cost,
           chat_cost           = EXCLUDED.chat_cost,
           thematic_cost       = EXCLUDED.thematic_cost,
           request_count       = EXCLUDED.request_count,
           updated_at          = NOW()`,
        [s.date, s.total, s.news, s.management, s.insider, s.chat, s.thematic, s.requestCount]
      );
    } catch { /* non-fatal */ }
  }, 30_000);
}

export function logStartupCostEstimate(): void {
  const newsDaily      = 44 * 8;  // 44 cycles × 8 articles
  const newsCostPerArt = estimateCost(600, 900, 0.5); // avg: half use web search
  const newsEst        = newsDaily * newsCostPerArt;

  const mgmtEst    = (2 / 7) * 5 * estimateCost(2000, 1500, 3); // 2 runs/week, 5 stocks, 3 searches each
  const insiderEst = (1 / 7) * 10 * estimateCost(1500, 800, 2);
  const chatEst    = 10 * estimateCost(1500, 1000, 3);           // 10 calls/day assumed
  const totalEst   = newsEst + mgmtEst + insiderEst + chatEst;

  console.log(
    `[costEstimate] Estimated daily cost with current limits:\n` +
    `  News pipeline  (44 cycles × 8 articles): ~$${newsEst.toFixed(2)}\n` +
    `  Management     (2 runs/week ÷ 7):         ~$${mgmtEst.toFixed(2)}\n` +
    `  Insider        (1 run/week ÷ 7):           ~$${insiderEst.toFixed(2)}\n` +
    `  User AI chat   (assumed 10 calls/day):     ~$${chatEst.toFixed(2)}\n` +
    `  ESTIMATED DAILY TOTAL:                     ~$${totalEst.toFixed(2)}\n` +
    `  ESTIMATED MONTHLY:                         ~$${(totalEst * 30).toFixed(0)}\n` +
    `  Hard caps: news=$${DAILY_CAPS.news} mgmt=$${DAILY_CAPS.management} insider=$${DAILY_CAPS.insider} chat=$${DAILY_CAPS.chat} global=$${DAILY_CAPS.global}/day`
  );
}
