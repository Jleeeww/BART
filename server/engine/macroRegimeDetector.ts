import { getCrisisMode, getSuppressionOverride } from './systemConfig';

export type MacroRegimeType =
  | 'CAPITAL_INFLOW'
  | 'NEUTRAL'
  | 'CAPITAL_OUTFLOW'
  | 'CAPITAL_FLIGHT'
  | 'FAILSAFE_SUPPRESSED'
  | 'INSUFFICIENT_DATA';

export interface MacroRegime {
  regime:       MacroRegimeType;
  multiplier:   number;
  confidence:   number;
  triggers:     string[];
  durationDays: number;
  note:         string;
}

interface HistoryRow {
  date:         string;
  ihsg_foreign: number | null;
  indogb_ust:   number | null;
  indo_cds:     number | null;
  eido_change:  number | null;
}

// Data missing / not enough history, but NO sign of severe decline.
// Fail conservative (×0.9), NEVER fail open at ×1.0.
const INSUFFICIENT_DATA_REGIME: MacroRegime = {
  regime: 'INSUFFICIENT_DATA', multiplier: 0.9, confidence: 0,
  triggers: [],
  durationDays: 0,
  note: 'Data makro belum cukup untuk mendeteksi rezim — skor disesuaikan konservatif (×0.9) hingga data lengkap.',
};

// Data incomplete AND a severe-decline proxy is present → suppress harder (×0.75).
const FAILSAFE_SUPPRESSED_REGIME: MacroRegime = {
  regime: 'FAILSAFE_SUPPRESSED', multiplier: 0.75, confidence: 30,
  triggers: ['Data makro tidak lengkap namun terdeteksi tekanan pasar (penurunan tajam).'],
  durationDays: 0,
  note: 'Data makro tidak lengkap namun pasar menunjukkan tekanan — skor disesuaikan ke bawah (×0.75) demi keamanan.',
};

// Cold cache (fresh boot before first compute) — mildly conservative, not open.
const COLD_CACHE_DEFAULT: MacroRegime = {
  regime: 'INSUFFICIENT_DATA', multiplier: 0.9, confidence: 0,
  triggers: [],
  durationDays: 0,
  note: 'Rezim makro belum dihitung — skor disesuaikan konservatif (×0.9) sementara.',
};

let _cachedRegime: MacroRegime | null = null;
let _cacheTime = 0;
const REGIME_TTL = 4 * 60 * 60 * 1000; // 4 hours

/**
 * Admin override precedence (authoritative over auto-detection):
 *   FORCE_CRISIS → synthetic CAPITAL_FLIGHT
 *   FORCE_NORMAL → NEUTRAL (×1.0)
 *   AUTO + suppression_override.multiplier → clamp to min(auto, override) — never LESS conservative
 * Applied on the read path so toggles take effect without a recompute.
 */
function applyAdminOverride(auto: MacroRegime): MacroRegime {
  let mode: string;
  let override: number | null;
  try {
    mode = getCrisisMode();
    override = getSuppressionOverride();
  } catch {
    return auto;
  }

  if (mode === 'FORCE_CRISIS') {
    const mult = typeof override === 'number' ? override : 0.6;
    return {
      regime: 'CAPITAL_FLIGHT',
      multiplier: mult,
      confidence: 100,
      triggers: ['Mode krisis diaktifkan manual oleh admin.'],
      durationDays: auto.durationDays,
      note: `Mode krisis manual (admin). Sinyal bandarmologi dipotong ${Math.round((1 - mult) * 100)}%.`,
    };
  }

  if (mode === 'FORCE_NORMAL') {
    return {
      regime: 'NEUTRAL', multiplier: 1.0, confidence: 100,
      triggers: ['Supresi dinonaktifkan manual oleh admin (mode normal paksa).'],
      durationDays: 0,
      note: 'Mode normal dipaksa oleh admin — tidak ada supresi makro.',
    };
  }

  // AUTO: apply a suppression floor if configured (only ever more conservative).
  if (typeof override === 'number' && override < auto.multiplier) {
    return {
      ...auto,
      multiplier: override,
      note: `${auto.note} (Supresi minimum admin ×${override} diterapkan.)`,
    };
  }
  return auto;
}

export function getCachedMacroRegime(): MacroRegime {
  const base = (_cachedRegime !== null && Date.now() - _cacheTime < REGIME_TTL)
    ? _cachedRegime
    : COLD_CACHE_DEFAULT;
  return applyAdminOverride(base);
}

export function setCachedMacroRegime(regime: MacroRegime): void {
  _cachedRegime = regime;
  _cacheTime = Date.now();
}

/**
 * Resolve the regime when data is missing / history too short.
 * Fails CONSERVATIVE: if any severe-decline proxy is present → FAILSAFE (×0.75),
 * otherwise INSUFFICIENT_DATA (×0.9). Never returns ×1.0.
 * Caches the result so the scoring path and the display path agree.
 */
function resolveInsufficient(history: HistoryRow[]): MacroRegime {
  // Severe-decline proxy from whatever partial history exists.
  const recent = history.slice(0, Math.min(10, history.length));
  const eidoSum   = sum(recent.map(r => r.eido_change));
  const foreignAvg = avg(recent.map(r => r.ihsg_foreign));
  const severe =
    (eidoSum   !== null && eidoSum   < -8) ||   // EIDO ETF down >8% cumulatively
    (foreignAvg !== null && foreignAvg < -300); // heavy foreign net selling
  const result = severe ? FAILSAFE_SUPPRESSED_REGIME : INSUFFICIENT_DATA_REGIME;
  setCachedMacroRegime(result);
  return result;
}

function avg(values: (number | null)[]): number | null {
  const valid = values.filter((v): v is number => v !== null && isFinite(v));
  if (valid.length === 0) return null;
  return valid.reduce((a, b) => a + b, 0) / valid.length;
}

function sum(values: (number | null)[]): number | null {
  const valid = values.filter((v): v is number => v !== null && isFinite(v));
  if (valid.length === 0) return null;
  return valid.reduce((a, b) => a + b, 0);
}

function computeDurationDays(
  history: HistoryRow[],
  regimeType: MacroRegimeType
): number {
  if (regimeType === 'NEUTRAL' || regimeType === 'INSUFFICIENT_DATA') return 0;
  const expectPositive = regimeType === 'CAPITAL_INFLOW';
  let count = 0;
  for (const row of history) {
    if (row.ihsg_foreign === null) break;
    const isPositive = row.ihsg_foreign > 0;
    if (isPositive === expectPositive) {
      count++;
    } else {
      break;
    }
  }
  return count;
}

export async function computeMacroRegime(mockHistory?: HistoryRow[]): Promise<MacroRegime> {
  let history: HistoryRow[];

  if (mockHistory !== undefined) {
    history = mockHistory;
  } else {
    try {
      const { pool } = await import('../db');
      const result = await pool.query<HistoryRow>(
        `SELECT date, ihsg_foreign, indogb_ust, indo_cds, eido_change
         FROM macro_flow_history
         ORDER BY date DESC
         LIMIT 22`
      );
      history = result.rows;
    } catch {
      // No data at all → mildly conservative, never fail open.
      setCachedMacroRegime(INSUFFICIENT_DATA_REGIME);
      return INSUFFICIENT_DATA_REGIME;
    }
  }

  if (history.length < 10) return resolveInsufficient(history);

  const last20 = history.slice(0, 20);
  const last5  = history.slice(0, 5);

  const foreignFlow20d  = avg(last20.map(r => r.ihsg_foreign));
  const foreignFlow5d   = avg(last5.map(r => r.ihsg_foreign));  // eslint-disable-line @typescript-eslint/no-unused-vars
  const eidoFlow20d     = sum(last20.map(r => r.eido_change));

  const oldestCds = history[Math.min(19, history.length - 1)].indo_cds;
  const newestCds = history[0].indo_cds;
  const cdsChange20d =
    newestCds !== null && oldestCds !== null ? newestCds - oldestCds : null;

  const oldestSpread = history[Math.min(19, history.length - 1)].indogb_ust;
  const newestSpread = history[0].indogb_ust;
  const spreadChange20d =
    newestSpread !== null && oldestSpread !== null ? newestSpread - oldestSpread : null;

  // CAPITAL_FLIGHT — highest priority.
  // Recalibrated for a severe (~40%) crash so it does NOT depend solely on CDS
  // (which was historically null-stubbed, making this branch dead). Two paths:
  //   (a) strict classic: foreign flow < -500 AND CDS rising > +30  → confidence 85
  //   (b) 2-of-4 escalation over independent stress signals          → confidence 70
  // Multiplier ladder: 3+ signals → ×0.5 (deeper cut), 2 signals → ×0.6.
  const flightSignals: string[] = [];
  if (foreignFlow20d !== null && foreignFlow20d < -500) {
    flightSignals.push(`Aliran asing rata-rata ${foreignFlow20d.toFixed(1)} miliar IDR/hari selama 20 hari (di bawah -500)`);
  }
  if (cdsChange20d !== null && cdsChange20d > 30) {
    flightSignals.push(`Spread CDS naik ${cdsChange20d.toFixed(1)} bps dalam 20 hari (di atas +30)`);
  }
  if (eidoFlow20d !== null && eidoFlow20d < -20) {
    flightSignals.push(`Akumulasi perubahan EIDO ${eidoFlow20d.toFixed(1)}% dalam 20 hari (di bawah -20%)`);
  }
  if (spreadChange20d !== null && spreadChange20d > 50) {
    flightSignals.push(`Spread IndoGB-UST melebar ${spreadChange20d.toFixed(1)} bps dalam 20 hari (di atas +50)`);
  }

  const strictFlight =
    foreignFlow20d !== null && foreignFlow20d < -500 &&
    cdsChange20d   !== null && cdsChange20d   > 30;

  if (strictFlight || flightSignals.length >= 2) {
    const duration = computeDurationDays(history, 'CAPITAL_FLIGHT');
    const multiplier = flightSignals.length >= 3 ? 0.5 : 0.6;
    const confidence = strictFlight ? 85 : 70;
    const result: MacroRegime = {
      regime: 'CAPITAL_FLIGHT',
      multiplier,
      confidence,
      triggers: flightSignals,
      durationDays: duration,
      note: `Aliran modal asing keluar secara struktural selama ${duration} hari. Sinyal bandarmologi dipotong ${Math.round((1 - multiplier) * 100)}% selama periode ini.`,
    };
    setCachedMacroRegime(result);
    return result;
  }

  // CAPITAL_OUTFLOW
  const outflowConditions: string[] = [];
  if (foreignFlow20d !== null && foreignFlow20d < -200) {
    outflowConditions.push(`Aliran asing rata-rata ${foreignFlow20d.toFixed(1)} miliar IDR/hari (di bawah -200)`);
  }
  if (spreadChange20d !== null && spreadChange20d < -30) {
    outflowConditions.push(`Spread IndoGB-UST turun ${Math.abs(spreadChange20d).toFixed(1)} bps dalam 20 hari`);
  }
  if (eidoFlow20d !== null && eidoFlow20d < -10) {
    outflowConditions.push(`Akumulasi perubahan EIDO ${eidoFlow20d.toFixed(2)}% dalam 20 hari (di bawah -10%)`);
  }
  if (outflowConditions.length > 0) {
    const duration = computeDurationDays(history, 'CAPITAL_OUTFLOW');
    const result: MacroRegime = {
      regime: 'CAPITAL_OUTFLOW',
      multiplier: 0.75,
      confidence: 65,
      triggers: outflowConditions,
      durationDays: duration,
      note: 'Aliran asing cenderung keluar 20 hari terakhir. Sinyal bandarmologi dipotong 25%.',
    };
    setCachedMacroRegime(result);
    return result;
  }

  // CAPITAL_INFLOW
  if (
    foreignFlow20d !== null && foreignFlow20d > 300 &&
    (spreadChange20d === null || spreadChange20d >= 0) &&
    (cdsChange20d   === null || cdsChange20d   <= 0)
  ) {
    const triggers: string[] = [
      `Aliran asing rata-rata ${foreignFlow20d.toFixed(1)} miliar IDR/hari selama 20 hari (di atas +300)`,
    ];
    if (spreadChange20d !== null) {
      triggers.push(`Spread IndoGB-UST stabil atau naik (${spreadChange20d >= 0 ? '+' : ''}${spreadChange20d.toFixed(1)} bps)`);
    }
    if (cdsChange20d !== null) {
      triggers.push(`CDS tidak memburuk (${cdsChange20d <= 0 ? '' : '+'}${cdsChange20d.toFixed(1)} bps)`);
    }
    const duration = computeDurationDays(history, 'CAPITAL_INFLOW');
    const result: MacroRegime = {
      regime: 'CAPITAL_INFLOW',
      multiplier: 1.15,
      confidence: 70,
      triggers,
      durationDays: duration,
      note: `Aliran modal asing masuk secara konsisten ${duration} hari. Sinyal akumulasi diperkuat 15%.`,
    };
    setCachedMacroRegime(result);
    return result;
  }

  // NEUTRAL — fallthrough
  const duration = computeDurationDays(history, 'NEUTRAL');
  const result: MacroRegime = {
    regime: 'NEUTRAL',
    multiplier: 1.0,
    confidence: 50,
    triggers: [],
    durationDays: duration,
    note: 'Aliran modal asing campuran — tidak ada rezim yang jelas saat ini.',
  };
  setCachedMacroRegime(result);
  return result;
}
