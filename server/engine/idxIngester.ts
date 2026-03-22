import { saveSessionHistory, buildStockHistory } from './historyBuilder';
import { invalidateRadarCache } from './radarEngine';

export interface IDXBrokerRow {
  code: string;
  buyValue: number;
  sellValue: number;
  netValue: number;
}

export interface IDXStockSessionData {
  symbol: string;
  date: string;
  session: 0 | 1 | 2;

  open: number;
  high: number;
  low: number;
  close: number;
  prevClose: number;

  todayValue: number;

  brokers: IDXBrokerRow[];

  foreignBuy: number;
  foreignSell: number;
  domesticBuy: number;
  domesticSell: number;
}

export interface IDXSessionPayload {
  date: string;
  session: 0 | 1 | 2;
  source: 'IDX_LIVE' | 'IDX_EOD' | 'IDX_DELAYED' | 'MANUAL';
  stocks: IDXStockSessionData[];
}

export interface IngestionResult {
  success: number;
  errors: number;
  skipped: number;
  durationMs: number;
  date: string;
  session: number;
  source: string;
}

function computeFlowSignals(
  netFlow: number,
  avg20dValue: number | null
): {
  flowBias: string;
  flowIntensity: string;
  flowReliability: string;
} {
  if (!avg20dValue || avg20dValue === 0) {
    return {
      flowBias: 'Netral',
      flowIntensity: 'Tidak Ada Data',
      flowReliability: 'Rendah',
    };
  }

  const ratio = netFlow / avg20dValue;

  const flowBias = ratio > 0.05 ? 'Akumulasi'
    : ratio < -0.05 ? 'Distribusi'
    : 'Netral';

  const flowIntensity =
    ratio > 0.5  ? 'Akumulasi Besar'
    : ratio > 0.2  ? 'Akumulasi Sedang'
    : ratio > 0.05 ? 'Akumulasi Ringan'
    : ratio < -0.5 ? 'Distribusi Besar'
    : ratio < -0.2 ? 'Distribusi Sedang'
    : ratio < -0.05 ? 'Distribusi Ringan'
    : 'Netral';

  const flowReliability = Math.abs(ratio) > 0.3 ? 'Tinggi'
    : Math.abs(ratio) > 0.1 ? 'Sedang'
    : 'Rendah';

  return { flowBias, flowIntensity, flowReliability };
}

export async function ingestSession(
  payload: IDXSessionPayload
): Promise<IngestionResult> {
  const startTime = Date.now();
  let success = 0;
  let errors = 0;
  let skipped = 0;

  console.log(
    `[idxIngester] Starting ingestion: ${payload.date} ` +
    `session=${payload.session} source=${payload.source} ` +
    `stocks=${payload.stocks.length}`
  );

  for (const stock of payload.stocks) {
    try {
      if (!stock.symbol || !stock.date) {
        skipped++;
        continue;
      }

      const netFlow = (stock.foreignBuy - stock.foreignSell) +
                      (stock.domesticBuy - stock.domesticSell);
      const netForeignFlow  = stock.foreignBuy - stock.foreignSell;
      const netDomesticFlow = stock.domesticBuy - stock.domesticSell;
      const changePct = stock.prevClose > 0
        ? ((stock.close - stock.prevClose) / stock.prevClose) * 100
        : null;

      let avg20dValue: number | null = null;
      try {
        const history = await buildStockHistory(stock.symbol, 20);
        avg20dValue = history.avg20dValue;
      } catch (_) {}

      const { flowBias, flowIntensity, flowReliability } =
        computeFlowSignals(netFlow, avg20dValue);

      await saveSessionHistory({
        symbol:          stock.symbol,
        date:            stock.date,
        session:         stock.session,
        open:            stock.open,
        high:            stock.high,
        low:             stock.low,
        close:           stock.close,
        prevClose:       stock.prevClose,
        changePct,
        todayValue:      stock.todayValue,
        avg20dValue,
        netFlow,
        netForeignFlow,
        netDomesticFlow,
        foreignBuy:      stock.foreignBuy,
        foreignSell:     stock.foreignSell,
        domesticBuy:     stock.domesticBuy,
        domesticSell:    stock.domesticSell,
        flowBias,
        flowIntensity,
        flowReliability,
        brokerData:      stock.brokers,
        m6Score:         null,
        compositeScore:  null,
        regime:          null,
        dataSource:      payload.source,
      });

      success++;
    } catch (err) {
      errors++;
      console.error(
        `[idxIngester] Error processing ${stock.symbol}:`,
        err instanceof Error ? err.message : err
      );
    }
  }

  if (success > 0) {
    invalidateRadarCache();
    console.log(
      `[idxIngester] Complete: ${success} saved, ` +
      `${errors} errors, ${skipped} skipped, ` +
      `${Date.now() - startTime}ms. Radar cache invalidated.`
    );
  }

  return {
    success,
    errors,
    skipped,
    durationMs: Date.now() - startTime,
    date:    payload.date,
    session: payload.session,
    source:  payload.source,
  };
}

export async function seedDemoHistory(
  symbol: string,
  sessions: Array<{
    date: string;
    netFlow: number;
    close: number;
    todayValue: number;
    flowBias: string;
  }>
): Promise<void> {
  for (const s of sessions) {
    await saveSessionHistory({
      symbol,
      date:       s.date,
      session:    0,
      close:      s.close,
      todayValue: s.todayValue,
      netFlow:    s.netFlow,
      flowBias:   s.flowBias,
      dataSource: 'DEMO',
    });
  }
  console.log(
    `[idxIngester] Seeded ${sessions.length} demo sessions for ${symbol}`
  );
}
