import { db } from '../db';
import { sessionHistory } from '../../shared/schema';
import { eq, and, asc } from 'drizzle-orm';
import { analyzeScoreDistribution } from './scoreMonitor';

export interface BacktestSignal {
  symbol: string;
  signalDate: string;
  signalScore: number;
  signalRegime: string | null;
  priceAtSignal: number;
  price5Sessions: number | null;
  price10Sessions: number | null;
  price15Sessions: number | null;
  return5: number | null;
  return10: number | null;
  return15: number | null;
  correct5: boolean | null;
  correct10: boolean | null;
  correct15: boolean | null;
}

export interface BacktestResult {
  symbol: string;
  totalSessions: number;
  totalSignals: number;
  accuracy5: number | null;
  accuracy10: number | null;
  accuracy15: number | null;
  avgReturn5: number | null;
  avgReturn10: number | null;
  avgReturn15: number | null;
  falsePositiveRate: number | null;
  signals: BacktestSignal[];
  scoreDistribution: ReturnType<typeof analyzeScoreDistribution>;
  recommendation: string;
}

export interface BacktestSummary {
  totalSymbols: number;
  totalSignals: number;
  overallAccuracy10: number | null;
  bestSymbols: string[];
  worstSymbols: string[];
  calibrationNeeded: boolean;
  recommendations: string[];
  results: BacktestResult[];
}

export async function backtestSymbol(
  symbol: string
): Promise<BacktestResult | null> {
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
      .orderBy(asc(sessionHistory.date));

    if (!records || records.length < 20) return null;

    const signals: BacktestSignal[] = [];
    const scores: number[] = [];

    for (let i = 0; i < records.length - 15; i++) {
      const session = records[i];
      const score = session.compositeScore ?? 0;
      scores.push(score);

      const regime = (session.regime ?? '').toLowerCase();
      const isSignal = score >= 60 &&
        (regime.includes('accumulation') || regime.includes('akumulasi'));

      if (!isSignal) continue;

      const s5  = records[i + 5]  ?? null;
      const s10 = records[i + 10] ?? null;
      const s15 = records[i + 15] ?? null;

      const p0  = session.close ?? 0;
      const p5  = s5?.close  ?? null;
      const p10 = s10?.close ?? null;
      const p15 = s15?.close ?? null;

      const ret = (now: number, fut: number | null) =>
        fut && now > 0
          ? Number(((fut - now) / now * 100).toFixed(2))
          : null;

      signals.push({
        symbol:          symbol.toUpperCase(),
        signalDate:      session.date,
        signalScore:     score,
        signalRegime:    session.regime ?? null,
        priceAtSignal:   p0,
        price5Sessions:  p5,
        price10Sessions: p10,
        price15Sessions: p15,
        return5:         ret(p0, p5),
        return10:        ret(p0, p10),
        return15:        ret(p0, p15),
        correct5:        p5  ? p5  > p0 : null,
        correct10:       p10 ? p10 > p0 : null,
        correct15:       p15 ? p15 > p0 : null,
      });
    }

    if (signals.length === 0) return null;

    const acc = (key: 'correct5' | 'correct10' | 'correct15') => {
      const valid = signals.filter(s => s[key] !== null);
      if (!valid.length) return null;
      return Number(
        (valid.filter(s => s[key]).length / valid.length * 100).toFixed(1)
      );
    };

    const avgRet = (key: 'return5' | 'return10' | 'return15') => {
      const vals = signals.filter(s => s[key] !== null).map(s => s[key]!);
      if (!vals.length) return null;
      return Number((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2));
    };

    const accuracy10 = acc('correct10');
    const falsePositiveRate = accuracy10 !== null
      ? Number((100 - accuracy10).toFixed(1)) : null;

    let recommendation = '';
    if (accuracy10 === null) {
      recommendation = 'Data tidak cukup untuk evaluasi.';
    } else if (accuracy10 >= 70) {
      recommendation = `Akurasi ${accuracy10}% — engine terkalibrasi baik untuk ${symbol}.`;
    } else if (accuracy10 >= 55) {
      recommendation = `Akurasi sedang ${accuracy10}% — pertimbangkan penyesuaian threshold.`;
    } else {
      recommendation = `Akurasi rendah ${accuracy10}% — kalibrasi diperlukan untuk ${symbol}.`;
    }

    return {
      symbol: symbol.toUpperCase(),
      totalSessions: records.length,
      totalSignals: signals.length,
      accuracy5:  acc('correct5'),
      accuracy10,
      accuracy15: acc('correct15'),
      avgReturn5:  avgRet('return5'),
      avgReturn10: avgRet('return10'),
      avgReturn15: avgRet('return15'),
      falsePositiveRate,
      signals,
      scoreDistribution: analyzeScoreDistribution(scores),
      recommendation,
    };
  } catch (err) {
    console.error(`[backtestEngine] Error for ${symbol}:`, err);
    return null;
  }
}

export async function backtestAll(
  symbols: string[]
): Promise<BacktestSummary> {
  const results: BacktestResult[] = [];

  for (const sym of symbols) {
    const r = await backtestSymbol(sym);
    if (r) results.push(r);
    await new Promise(res => setTimeout(res, 0));
  }

  if (!results.length) {
    return {
      totalSymbols: 0, totalSignals: 0,
      overallAccuracy10: null,
      bestSymbols: [], worstSymbols: [],
      calibrationNeeded: true,
      recommendations: ['Tidak ada data historis yang cukup.'],
      results: [],
    };
  }

  const totalSignals = results.reduce((s, r) => s + r.totalSignals, 0);
  const acc10s = results.filter(r => r.accuracy10 !== null).map(r => r.accuracy10!);
  const overallAccuracy10 = acc10s.length
    ? Number((acc10s.reduce((a, b) => a + b, 0) / acc10s.length).toFixed(1))
    : null;

  const bestSymbols  = results.filter(r => (r.accuracy10 ?? 0) >= 70).map(r => r.symbol);
  const worstSymbols = results.filter(r => r.accuracy10 !== null && r.accuracy10 < 40).map(r => r.symbol);
  const calibrationNeeded = (overallAccuracy10 ?? 0) < 55 ||
    worstSymbols.length > results.length * 0.3;

  const recommendations: string[] = [];
  if (overallAccuracy10 !== null) {
    if (overallAccuracy10 >= 70)
      recommendations.push(`Akurasi keseluruhan ${overallAccuracy10}% — engine siap launch.`);
    else if (overallAccuracy10 >= 55)
      recommendations.push(`Akurasi ${overallAccuracy10}% — kalibrasi minor diperlukan.`);
    else
      recommendations.push(`PERINGATAN: Akurasi ${overallAccuracy10}% — kalibrasi mayor diperlukan.`);
  }
  if (bestSymbols.length)
    recommendations.push(`Best: ${bestSymbols.slice(0, 5).join(', ')}`);
  if (worstSymbols.length)
    recommendations.push(`Perlu perhatian: ${worstSymbols.slice(0, 5).join(', ')}`);

  return {
    totalSymbols: results.length, totalSignals,
    overallAccuracy10, bestSymbols, worstSymbols,
    calibrationNeeded, recommendations, results,
  };
}
