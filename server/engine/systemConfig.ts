/**
 * ============================================================
 * SYSTEM CONFIG v1.0
 * ============================================================
 * server/engine/systemConfig.ts
 *
 * Runtime admin config backed by the `system_config` KV table.
 * Lets the admin dashboard toggle crisis mode / suppression /
 * scanner / cost caps at runtime WITHOUT a redeploy.
 *
 * Two read paths:
 *   getConfig<T>(key, fallback)     — async, always fresh-ish (reads cache, reloads if stale)
 *   getConfigSync<T>(key, fallback) — sync, for hot scoring paths (compositeEngineV3)
 *
 * A background interval (started via startConfigRefresh) keeps the
 * in-memory cache warm every ~15s so getConfigSync never blocks and
 * toggles propagate within one TTL.
 * ============================================================
 */

export type CrisisMode = 'AUTO' | 'FORCE_CRISIS' | 'FORCE_NORMAL';

export interface CrisisModeConfig      { mode: CrisisMode; }
export interface SuppressionOverride   { multiplier: number | null; }
export interface ScannerEnabledConfig  { enabled: boolean; }
export interface CostCapsOverride      { news?: number; thematic?: number; global?: number; management?: number; insider?: number; chat?: number; }

// Canonical keys (documented; values are jsonb blobs)
export const CONFIG_KEYS = {
  CRISIS_MODE:          'crisis_mode',
  SUPPRESSION_OVERRIDE: 'suppression_override',
  SCANNER_ENABLED:      'scanner_enabled',
  COST_CAPS:            'cost_caps',
} as const;

export type ConfigKey = (typeof CONFIG_KEYS)[keyof typeof CONFIG_KEYS];

const CONFIG_TTL_MS = 15_000;

const _cache = new Map<string, unknown>();
let _loadedAt = 0;
let _loading: Promise<void> | null = null;

async function reload(): Promise<void> {
  try {
    const { pool } = await import('../db');
    const result = await pool.query<{ key: string; value: unknown }>(
      `SELECT key, value FROM system_config`
    );
    _cache.clear();
    for (const row of result.rows) _cache.set(row.key, row.value);
    _loadedAt = Date.now();
  } catch {
    // Non-fatal: keep whatever we had. Never throw on the read path.
    _loadedAt = Date.now();
  }
}

/** Ensure the cache is loaded at least once and not older than the TTL. */
async function ensureFresh(): Promise<void> {
  if (Date.now() - _loadedAt < CONFIG_TTL_MS && _loadedAt !== 0) return;
  if (_loading) return _loading;
  _loading = reload().finally(() => { _loading = null; });
  return _loading;
}

/** Start a background refresh so getConfigSync is always warm. Call once at boot. */
export function startConfigRefresh(): void {
  void reload();
  setInterval(() => { void reload(); }, CONFIG_TTL_MS);
}

/** Async read — reloads if the cache is stale. Never throws. */
export async function getConfig<T>(key: ConfigKey, fallback: T): Promise<T> {
  await ensureFresh();
  return (_cache.has(key) ? (_cache.get(key) as T) : fallback);
}

/**
 * Sync read for hot paths (scoring). Returns the last cached value; the
 * background interval keeps it warm. Falls back if never loaded.
 */
export function getConfigSync<T>(key: ConfigKey, fallback: T): T {
  // Kick a background reload if stale, but never block.
  if (Date.now() - _loadedAt >= CONFIG_TTL_MS) void ensureFresh();
  return (_cache.has(key) ? (_cache.get(key) as T) : fallback);
}

/** Upsert a config value and invalidate the cache. */
export async function setConfig(key: ConfigKey, value: unknown, updatedBy = 'admin'): Promise<void> {
  const { pool } = await import('../db');
  await pool.query(
    `INSERT INTO system_config (key, value, updated_by, updated_at)
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT (key) DO UPDATE SET
       value      = EXCLUDED.value,
       updated_by = EXCLUDED.updated_by,
       updated_at = NOW()`,
    [key, JSON.stringify(value), updatedBy]
  );
  _cache.set(key, value);
  _loadedAt = Date.now();
}

// ── Typed getters (sync — used on scoring/scan hot paths) ─────────

export function getCrisisMode(): CrisisMode {
  return getConfigSync<CrisisModeConfig>(CONFIG_KEYS.CRISIS_MODE, { mode: 'AUTO' }).mode ?? 'AUTO';
}

export function getSuppressionOverride(): number | null {
  const v = getConfigSync<SuppressionOverride>(CONFIG_KEYS.SUPPRESSION_OVERRIDE, { multiplier: null });
  return typeof v.multiplier === 'number' ? v.multiplier : null;
}

export function isScannerEnabled(): boolean {
  return getConfigSync<ScannerEnabledConfig>(CONFIG_KEYS.SCANNER_ENABLED, { enabled: true }).enabled !== false;
}

export function getCostCapOverrides(): CostCapsOverride {
  return getConfigSync<CostCapsOverride>(CONFIG_KEYS.COST_CAPS, {});
}

/** Snapshot of all effective config for the admin dashboard. */
export async function getAllConfig(): Promise<Record<string, unknown>> {
  await ensureFresh();
  return {
    [CONFIG_KEYS.CRISIS_MODE]:          _cache.get(CONFIG_KEYS.CRISIS_MODE)          ?? { mode: 'AUTO' },
    [CONFIG_KEYS.SUPPRESSION_OVERRIDE]: _cache.get(CONFIG_KEYS.SUPPRESSION_OVERRIDE) ?? { multiplier: null },
    [CONFIG_KEYS.SCANNER_ENABLED]:      _cache.get(CONFIG_KEYS.SCANNER_ENABLED)      ?? { enabled: true },
    [CONFIG_KEYS.COST_CAPS]:            _cache.get(CONFIG_KEYS.COST_CAPS)            ?? {},
  };
}
