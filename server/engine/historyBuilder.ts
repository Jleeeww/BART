import { db } from '../db';
import { sessionHistory } from '../../shared/schema';
import { eq, desc, and } from 'drizzle-orm';

export interface StockHistoryArrays {
  netFlowHistory: number[];
  priceHistory: number[];
  m6ScoreHistory: number[];
  avg20dValue: number | null;
  shortNetFlowHistory: number[];
  sessionCount: number;
  dataSource: string;
}

export async function buildStockHistory(
  symbol: string,
  maxSessions: number = 60
): Promise<StockHistoryArrays> {
  const empty: StockHistoryArrays = {
    netFlowHistory: [],
    priceHistory: [],
    m6ScoreHistory: [],
    avg20dValue: null,
    shortNetFlowHistory: [],
    sessionCount: 0,
    dataSource: 'NONE',
  };

  if (!symbol) return empty;

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
      .limit(maxSessions);

    if (!records || records.length === 0) return empty;

    const ordered = [...records].reverse();

    const netFlowHistory: number[] = [];
    const priceHistory: number[] = [];
    const m6ScoreHistory: number[] = [];
    const valueHistory: number[] = [];

    for (const r of ordered) {
      if (r.netFlow !== null && r.netFlow !== undefined &&
          isFinite(r.netFlow)) {
        netFlowHistory.push(r.netFlow);
      }
      if (r.close !== null && r.close !== undefined &&
          r.close > 0 && isFinite(r.close)) {
        priceHistory.push(r.close);
      }
      if (r.m6Score !== null && r.m6Score !== undefined &&
          isFinite(r.m6Score)) {
        m6ScoreHistory.push(r.m6Score);
      }
      if (r.todayValue !== null && r.todayValue !== undefined &&
          r.todayValue > 0 && isFinite(r.todayValue)) {
        valueHistory.push(r.todayValue);
      }
    }

    const last20Values = valueHistory.slice(-20);
    const avg20dValue = last20Values.length > 0
      ? last20Values.reduce((s, v) => s + v, 0) / last20Values.length
      : null;

    const shortNetFlowHistory = netFlowHistory.slice(-5);
    const m6ForM16 = m6ScoreHistory.slice(-5);
    const mostRecentSource = records[0]?.dataSource ?? 'NONE';

    return {
      netFlowHistory,
      priceHistory,
      m6ScoreHistory: m6ForM16,
      avg20dValue,
      shortNetFlowHistory,
      sessionCount: records.length,
      dataSource: mostRecentSource,
    };

  } catch (err) {
    console.error(`[historyBuilder] Error for ${symbol}:`, err);
    return empty;
  }
}

export async function saveSessionHistory(
  record: {
    symbol: string;
    date: string;
    session: 0 | 1 | 2;
    open?: number | null;
    high?: number | null;
    low?: number | null;
    close?: number | null;
    prevClose?: number | null;
    changePct?: number | null;
    todayValue?: number | null;
    avg20dValue?: number | null;
    netFlow?: number | null;
    netForeignFlow?: number | null;
    netDomesticFlow?: number | null;
    foreignBuy?: number | null;
    foreignSell?: number | null;
    domesticBuy?: number | null;
    domesticSell?: number | null;
    flowBias?: string | null;
    flowIntensity?: string | null;
    flowReliability?: string | null;
    brokerData?: unknown | null;
    m6Score?: number | null;
    compositeScore?: number | null;
    regime?: string | null;
    dataSource?: string;
  }
): Promise<void> {
  try {
    const values = {
      symbol:          record.symbol.toUpperCase(),
      date:            record.date,
      session:         record.session,
      open:            record.open ?? null,
      high:            record.high ?? null,
      low:             record.low ?? null,
      close:           record.close ?? null,
      prevClose:       record.prevClose ?? null,
      changePct:       record.changePct ?? null,
      todayValue:      record.todayValue ?? null,
      avg20dValue:     record.avg20dValue ?? null,
      netFlow:         record.netFlow ?? null,
      netForeignFlow:  record.netForeignFlow ?? null,
      netDomesticFlow: record.netDomesticFlow ?? null,
      foreignBuy:      record.foreignBuy ?? null,
      foreignSell:     record.foreignSell ?? null,
      domesticBuy:     record.domesticBuy ?? null,
      domesticSell:    record.domesticSell ?? null,
      flowBias:        record.flowBias ?? null,
      flowIntensity:   record.flowIntensity ?? null,
      flowReliability: record.flowReliability ?? null,
      brokerData:      record.brokerData ?? null,
      m6Score:         record.m6Score ?? null,
      compositeScore:  record.compositeScore ?? null,
      regime:          record.regime ?? null,
      dataSource:      record.dataSource ?? 'DEMO',
      ingestedAt:      new Date().toISOString(),
    };

    await db
      .insert(sessionHistory)
      .values(values)
      .onConflictDoUpdate({
        target: [
          sessionHistory.symbol,
          sessionHistory.date,
          sessionHistory.session,
        ],
        set: {
          open:            values.open,
          high:            values.high,
          low:             values.low,
          close:           values.close,
          prevClose:       values.prevClose,
          changePct:       values.changePct,
          todayValue:      values.todayValue,
          avg20dValue:     values.avg20dValue,
          netFlow:         values.netFlow,
          netForeignFlow:  values.netForeignFlow,
          netDomesticFlow: values.netDomesticFlow,
          foreignBuy:      values.foreignBuy,
          foreignSell:     values.foreignSell,
          domesticBuy:     values.domesticBuy,
          domesticSell:    values.domesticSell,
          flowBias:        values.flowBias,
          flowIntensity:   values.flowIntensity,
          flowReliability: values.flowReliability,
          brokerData:      values.brokerData,
          m6Score:         values.m6Score,
          compositeScore:  values.compositeScore,
          regime:          values.regime,
          dataSource:      values.dataSource,
          ingestedAt:      values.ingestedAt,
        },
      });
  } catch (err) {
    console.error(`[historyBuilder] saveSessionHistory error for ${record.symbol}:`, err);
    throw err;
  }
}

export async function getHistoryStatus(symbol: string): Promise<{
  sessionCount: number;
  dateRange: { oldest: string | null; newest: string | null };
  hasFullHistory: boolean;
  hasLongHistory: boolean;
}> {
  try {
    const records = await db
      .select({
        date: sessionHistory.date,
      })
      .from(sessionHistory)
      .where(
        and(
          eq(sessionHistory.symbol, symbol.toUpperCase()),
          eq(sessionHistory.session, 0)
        )
      )
      .orderBy(desc(sessionHistory.date))
      .limit(60);

    const count = records.length;
    return {
      sessionCount: count,
      dateRange: {
        oldest: count > 0 ? records[count - 1].date : null,
        newest: count > 0 ? records[0].date : null,
      },
      hasFullHistory: count >= 20,
      hasLongHistory: count >= 60,
    };
  } catch (err) {
    return {
      sessionCount: 0,
      dateRange: { oldest: null, newest: null },
      hasFullHistory: false,
      hasLongHistory: false,
    };
  }
}
