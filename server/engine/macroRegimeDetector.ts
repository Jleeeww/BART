export type MacroRegimeType =
  | 'CAPITAL_INFLOW'
  | 'NEUTRAL'
  | 'CAPITAL_OUTFLOW'
  | 'CAPITAL_FLIGHT'
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

const INSUFFICIENT_DATA_REGIME: MacroRegime = {
  regime: 'INSUFFICIENT_DATA', multiplier: 1.0, confidence: 0,
  triggers: [], durationDays: 0,
  note: 'Riwayat makro belum cukup untuk mendeteksi rezim',
};

let _cachedRegime: MacroRegime | null = null;
let _cacheTime = 0;
const REGIME_TTL = 4 * 60 * 60 * 1000; // 4 hours

export function getCachedMacroRegime(): MacroRegime {
  if (_cachedRegime !== null && Date.now() - _cacheTime < REGIME_TTL) {
    return _cachedRegime;
  }
  return INSUFFICIENT_DATA_REGIME;
}

export function setCachedMacroRegime(regime: MacroRegime): void {
  _cachedRegime = regime;
  _cacheTime = Date.now();
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
      return INSUFFICIENT_DATA_REGIME;
    }
  }

  if (history.length < 10) return INSUFFICIENT_DATA_REGIME;

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

  // CAPITAL_FLIGHT — highest priority
  if (
    foreignFlow20d !== null && foreignFlow20d < -500 &&
    cdsChange20d   !== null && cdsChange20d   > 30
  ) {
    const triggers: string[] = [
      `Aliran asing rata-rata ${foreignFlow20d.toFixed(1)} miliar IDR/hari selama 20 hari (di bawah ambang -500)`,
      `Spread CDS naik ${cdsChange20d.toFixed(1)} bps dalam 20 hari (di atas ambang +30)`,
    ];
    const duration = computeDurationDays(history, 'CAPITAL_FLIGHT');
    const result: MacroRegime = {
      regime: 'CAPITAL_FLIGHT',
      multiplier: 0.6,
      confidence: 85,
      triggers,
      durationDays: duration,
      note: `Aliran modal asing keluar secara struktural selama ${duration} hari. Sinyal bandarmologi dipotong 40% selama periode ini.`,
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
