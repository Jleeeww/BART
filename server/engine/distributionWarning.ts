/**
 * ============================================================
 * DISTRIBUTION EARLY WARNING SYSTEM v1.0
 * ============================================================
 * Detects early signs of accumulation-to-distribution
 * transition before price reacts.
 *
 * TRIGGER CONDITIONS (need ≥3 of 5 for WARNING):
 *
 * C1 — Campaign Aging (M14)
 * C2 — Flow Weakening (M6)
 * C3 — Broker Side-Switch
 * C4 — Price Elasticity Rising (M15)
 * C5 — Flow Decomposition Diverging (M11)
 *
 * ALERT LEVELS:
 *   PANTAU_DISTRIBUSI   1-2 conditions  amber
 *   WASPADA_DISTRIBUSI  3 conditions    orange
 *   BAHAYA_DISTRIBUSI   4-5 conditions  red
 *   AMAN                0 conditions    none
 * ============================================================
 */

import { db } from '../db';
import { sessionHistory } from '../../shared/schema';
import { eq, and, desc } from 'drizzle-orm';

export type DistributionAlertLevel =
  | 'AMAN'
  | 'PANTAU_DISTRIBUSI'
  | 'WASPADA_DISTRIBUSI'
  | 'BAHAYA_DISTRIBUSI';

export interface DistributionWarningResult {
  symbol: string;
  alertLevel: DistributionAlertLevel;
  conditionsMet: number;
  totalConditions: number;
  conditions: {
    c1_campaignAging:    boolean;
    c2_flowWeakening:    boolean;
    c3_brokerSideSwitch: boolean | null;
    c4_elasticityRising: boolean;
    c5_flowDiverging:    boolean;
  };
  details: string[];
  recommendation: string;
  confidence: 'TINGGI' | 'SEDANG' | 'RENDAH';
  checkedAt: string;
}

function evaluateC1(
  cyclePosition: string | null,
  campaignAge: number | null,
  recentScores: number[]
): { met: boolean; detail: string } {
  if (cyclePosition === 'WASPADAI_DISTRIBUSI') {
    return {
      met: true,
      detail: 'Kampanye sudah memasuki fase distribusi (>15 sesi)',
    };
  }
  if (campaignAge !== null && campaignAge > 12) {
    // Sustained decline: 2+ consecutive declining sessions
    const sustainedDecline = recentScores.length >= 3 &&
      recentScores[recentScores.length - 1] < recentScores[recentScores.length - 2] &&
      recentScores[recentScores.length - 2] < recentScores[recentScores.length - 3];
    if (sustainedDecline) {
      return {
        met: true,
        detail: `Kampanye ${campaignAge} sesi dengan skor menurun ${recentScores.length >= 3 ? '2+' : ''} sesi berturut-turut`,
      };
    }
  }
  return { met: false, detail: 'Kampanye masih dalam fase aktif normal' };
}

function evaluateC2(
  m6ScoreHistory: number[]
): { met: boolean; detail: string } {
  if (m6ScoreHistory.length < 3) {
    return { met: false, detail: 'Riwayat M6 tidak cukup' };
  }
  const recent3 = m6ScoreHistory.slice(-3);
  const current = recent3[2];
  const oldest  = recent3[0];
  const drop    = oldest - current;

  if (drop >= 10 && current < 55) {
    return {
      met: true,
      detail: `Aliran dana melemah ${drop.toFixed(0)} poin dalam 3 sesi (M6: ${current.toFixed(0)})`,
    };
  }
  return { met: false, detail: 'Aliran dana masih stabil' };
}

function evaluateC3(
  currentBrokerData: unknown | null,
  historicalBrokerData: (unknown | null)[]
): { met: boolean | null; detail: string } {
  if (!currentBrokerData || !historicalBrokerData.some(b => b !== null)) {
    return { met: null, detail: 'Data broker tidak tersedia (aktif dengan data live)' };
  }
  try {
    const current = Array.isArray(currentBrokerData)
      ? currentBrokerData as any[]
      : JSON.parse(currentBrokerData as string);

    const currentSellers = new Set(
      current
        .filter((b: any) => {
          const netBuy  = Number(b.buyValue  ?? b.netBuy  ?? 0);
          const netSell = Number(b.sellValue ?? b.netSell ?? 0);
          return netSell > netBuy;
        })
        .map((b: any) => String(b.code ?? b.brokerCode ?? ''))
        .filter(Boolean)
    );

    const priorAccumulators = new Map<string, number>();
    for (const hist of historicalBrokerData) {
      if (!hist) continue;
      const brokers = Array.isArray(hist)
        ? hist as any[]
        : JSON.parse(hist as string);
      brokers.forEach((b: any) => {
        const netBuy  = Number(b.buyValue  ?? b.netBuy  ?? 0);
        const netSell = Number(b.sellValue ?? b.netSell ?? 0);
        if (netBuy > netSell) {
          const code = String(b.code ?? b.brokerCode ?? '');
          if (code) {
            priorAccumulators.set(
              code,
              (priorAccumulators.get(code) ?? 0) + (netBuy - netSell)
            );
          }
        }
      });
    }

    const top3 = Array.from(priorAccumulators.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([code]) => code);

    const switched = top3.filter(code => currentSellers.has(code));

    if (switched.length > 0) {
      return {
        met: true,
        detail: `Broker ${switched.join(', ')} yang sebelumnya akumulasi kini menjual`,
      };
    }
    return { met: false, detail: 'Broker akumulator masih konsisten beli' };

  } catch {
    return { met: null, detail: 'Error parsing data broker' };
  }
}

function evaluateC4(
  m15Score: number | null
): { met: boolean; detail: string } {
  if (m15Score === null) {
    return { met: false, detail: 'Skor elastisitas tidak tersedia' };
  }
  if (m15Score < 40) {
    return {
      met: true,
      detail: `Kontrol harga melemah — elastisitas tinggi (M15: ${m15Score.toFixed(0)})`,
    };
  }
  return { met: false, detail: 'Kontrol harga institusional masih kuat' };
}

function evaluateC5(
  m11AlignmentScore: number | null
): { met: boolean; detail: string } {
  if (m11AlignmentScore === null) {
    return { met: false, detail: 'Skor dekomposisi tidak tersedia' };
  }
  if (m11AlignmentScore < 20) {
    return {
      met: true,
      detail: `Aliran asing dan domestik tidak sinkron (alignment: ${m11AlignmentScore.toFixed(0)})`,
    };
  }
  return { met: false, detail: 'Aliran asing dan domestik masih selaras' };
}

function getAlertLevel(count: number): DistributionAlertLevel {
  if (count >= 4) return 'BAHAYA_DISTRIBUSI';
  if (count === 3) return 'WASPADA_DISTRIBUSI';
  if (count >= 1) return 'PANTAU_DISTRIBUSI';
  return 'AMAN';
}

function getRecommendation(level: DistributionAlertLevel): string {
  switch (level) {
    case 'BAHAYA_DISTRIBUSI':
      return 'Evaluasi posisi segera. Beberapa sinyal distribusi terkonfirmasi secara bersamaan.';
    case 'WASPADA_DISTRIBUSI':
      return 'Pantau dengan ketat. Jangan tambah posisi sampai sinyal membaik.';
    case 'PANTAU_DISTRIBUSI':
      return 'Waspadai perkembangan. Tesis masih berlaku tapi ada tanda-tanda awal perubahan.';
    case 'AMAN':
      return 'Struktur akumulasi masih intact. Tidak ada tanda distribusi terdeteksi.';
  }
}

function getConfidence(
  conditionsMet: number,
  c3Available: boolean
): 'TINGGI' | 'SEDANG' | 'RENDAH' {
  if (!c3Available && conditionsMet >= 2) return 'SEDANG';
  if (conditionsMet >= 4) return 'TINGGI';
  if (conditionsMet >= 2) return 'SEDANG';
  return 'RENDAH';
}

export interface DistributionWarningInput {
  symbol: string;
  cyclePosition: string | null;
  campaignAge: number | null;
  recentCompositeScores: number[];
  m6ScoreHistory: number[];
  m15Score: number | null;
  m11AlignmentScore: number | null;
  currentBrokerData: unknown | null;
  historicalBrokerData: (unknown | null)[];
}

export function computeDistributionWarning(
  input: DistributionWarningInput
): DistributionWarningResult {
  const now = new Date().toISOString();

  const c1 = evaluateC1(input.cyclePosition, input.campaignAge, input.recentCompositeScores);
  const c2 = evaluateC2(input.m6ScoreHistory);
  const c3 = evaluateC3(input.currentBrokerData, input.historicalBrokerData);
  const c4 = evaluateC4(input.m15Score);
  const c5 = evaluateC5(input.m11AlignmentScore);

  const conditions = {
    c1_campaignAging:    c1.met,
    c2_flowWeakening:    c2.met,
    c3_brokerSideSwitch: c3.met,
    c4_elasticityRising: c4.met,
    c5_flowDiverging:    c5.met,
  };

  const conditionsMet = [c1.met, c2.met, c3.met, c4.met, c5.met]
    .filter(v => v === true).length;

  const totalConditions = [c1.met, c2.met, c3.met, c4.met, c5.met]
    .filter(v => v !== null).length;

  const alertLevel = getAlertLevel(conditionsMet);

  const details: string[] = [];
  if (c1.met) details.push('C1: ' + c1.detail);
  if (c2.met) details.push('C2: ' + c2.detail);
  if (c3.met === true) details.push('C3: ' + c3.detail);
  if (c4.met) details.push('C4: ' + c4.detail);
  if (c5.met) details.push('C5: ' + c5.detail);
  if (c3.met === null) details.push('C3: ' + c3.detail);

  return {
    symbol:         input.symbol.toUpperCase(),
    alertLevel,
    conditionsMet,
    totalConditions,
    conditions,
    details,
    recommendation: getRecommendation(alertLevel),
    confidence:     getConfidence(conditionsMet, c3.met !== null),
    checkedAt:      now,
  };
}

export async function computeDistributionWarningFromDB(
  symbol: string,
  currentEngineResult: {
    cyclePosition: string | null;
    campaignAge: number | null;
    compositeScore: number | null;
    m6Score: number | null;
    m15Score: number | null;
    m11AlignmentScore: number | null;
    brokerData: unknown | null;
  }
): Promise<DistributionWarningResult> {
  try {
    const records = await db
      .select()
      .from(sessionHistory)
      .where(
        and(
          eq(sessionHistory.symbol, symbol.toUpperCase()),
          eq(sessionHistory.session, 0)
        )
      )
      .orderBy(desc(sessionHistory.date))
      .limit(5);

    const ordered = [...records].reverse();

    const recentCompositeScores = ordered
      .map(r => r.compositeScore)
      .filter((s): s is number => s !== null);

    const m6ScoreHistory = ordered
      .map(r => r.m6Score)
      .filter((s): s is number => s !== null);

    const historicalBrokerData = ordered
      .map(r => r.brokerData ?? null);

    return computeDistributionWarning({
      symbol,
      cyclePosition:         currentEngineResult.cyclePosition,
      campaignAge:           currentEngineResult.campaignAge,
      recentCompositeScores: [
        ...recentCompositeScores,
        ...(currentEngineResult.compositeScore !== null
          ? [currentEngineResult.compositeScore] : [])
      ],
      m6ScoreHistory: [
        ...m6ScoreHistory,
        ...(currentEngineResult.m6Score !== null
          ? [currentEngineResult.m6Score] : [])
      ],
      m15Score:            currentEngineResult.m15Score,
      m11AlignmentScore:   currentEngineResult.m11AlignmentScore,
      currentBrokerData:   currentEngineResult.brokerData,
      historicalBrokerData,
    });

  } catch (err) {
    console.error(`[distributionWarning] DB error for ${symbol}:`, err);
    return {
      symbol:          symbol.toUpperCase(),
      alertLevel:      'AMAN',
      conditionsMet:   0,
      totalConditions: 0,
      conditions: {
        c1_campaignAging:    false,
        c2_flowWeakening:    false,
        c3_brokerSideSwitch: null,
        c4_elasticityRising: false,
        c5_flowDiverging:    false,
      },
      details:        ['Data tidak cukup untuk evaluasi distribusi.'],
      recommendation: 'Pantau setelah data lebih tersedia.',
      confidence:     'RENDAH',
      checkedAt:      new Date().toISOString(),
    };
  }
}
