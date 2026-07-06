import type { Express } from "express";
import { storage } from "../storage";
import { getStockDecision, mapStockDataToInput } from "../engine/unifiedDecision";
import { computeGorenganFromStock } from "../engine/gorenganDetector";
import { computeValuation } from "../engine/valuationEngine";
import { applyValuationModifier } from "../engine/valuationModifier";

export function registerSignalsRoutes(app: Express): void {
  app.get('/api/signals', async (req, res) => {
    try {
      const { getAllSignalLifecycles } = await import('../engine/signalLifecycle');

      const watchlist = await storage.getWatchlist();

      const lifecycles = await getAllSignalLifecycles();

      const allStocks = await storage.getAllStocks();
      const stockMap = new Map(allStocks.map((s: any) => [s.symbol, s]));

      const signals = watchlist.map((w: any) => {
        const lifecycle = lifecycles.find(l => l.symbol === w.symbol) ?? null;
        const stock = stockMap.get(w.symbol);

        return {
          symbol:       w.symbol,
          companyName:  stock?.name ?? w.symbol,
          addedAt:      w.addedAt ?? null,
          price:        stock?.price ?? null,
          changePercent: stock?.changePercent ?? null,

          status:       lifecycle?.status ?? 'AKTIF',
          statusReason: lifecycle?.statusReason ?? 'Belum ada data sesi.',
          scoreDrift:   lifecycle?.scoreDrift ?? null,
          baselineScore: lifecycle?.baselineScore ?? null,
          currentScore: lifecycle?.currentScore ?? (stock as any)?.readinessScore ?? null,
          firedAt:      lifecycle?.firedAt ?? w.addedAt ?? null,
          updatedAt:    lifecycle?.updatedAt ?? null,
        };
      });

      res.status(200).json({
        signals,
        total:     signals.length,
        aktif:     signals.filter((s: any) => s.status === 'AKTIF').length,
        diragukan: signals.filter((s: any) => s.status === 'DIRAGUKAN').length,
        gugur:     signals.filter((s: any) => s.status === 'GUGUR').length,
      });

    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[/api/signals] Error:', message);
      res.status(500).json({ error: message, signals: [] });
    }
  });

  app.post('/api/signals/:symbol/update', async (req, res) => {
    try {
      const symbol = req.params.symbol?.toUpperCase();
      if (!symbol) return res.status(400).json({ error: 'Symbol required' });

      const { updateSignalLifecycle } = await import('../engine/signalLifecycle');

      const stock = await storage.getStockBySymbol(symbol);
      if (!stock) return res.status(404).json({ error: 'Stock not found' });

      const gorenganResult = computeGorenganFromStock({
        symbol,
        changePercent: typeof stock.changePercent === 'number' ? String(stock.changePercent) : stock.changePercent,
        flowBias: stock.flowBias || "Netral",
        flowIntensity: stock.flowIntensity || "Tidak Ada Data",
        flowReliability: stock.flowReliability || "Rendah",
        brokerData: stock.brokerData || "[]",
        foreignActivityData: stock.foreignActivityData || "{}",
        stockCharacter: stock.stockCharacter || null
      });

      const brainInput = mapStockDataToInput({
        flowBias: stock.flowBias,
        flowIntensity: stock.flowIntensity,
        flowReliability: stock.flowReliability,
        changePercent: stock.changePercent,
        growth: (stock as any).growth,
        insiderData: (stock as any).insiderData,
        brokerData: stock.brokerData,
        foreignActivityData: stock.foreignActivityData,
        stockCharacter: stock.stockCharacter,
        isGorengan: gorenganResult.isGorengan,
      });

      const decision = getStockDecision(brainInput);

      let score = decision.readiness;
      try {
        const valOut = computeValuation({
          peRatio: parseFloat(String(stock.peRatio)) || null,
          dividendYield: parseFloat(String(stock.dividendYield)) || null,
          roe: parseFloat(String(stock.roe)) || null,
          netMargin: parseFloat(String(stock.netMargin)) || null,
          sector: stock.sector ?? null,
        });
        const modResult = applyValuationModifier({
          valuationLabel: valOut.valuation.label,
          qualityLabel: valOut.quality.label,
          currentReadiness: decision.readiness,
        });
        if (modResult.wasAdjusted) score = modResult.adjustedReadiness;
      } catch {}

      const regime = decision.marketRegime.toLowerCase();
      let currentCycle: string | null = null;
      if (regime.includes('akumulasi') && score >= 80) currentCycle = 'ENTRY_WINDOW';
      else if (regime.includes('akumulasi') && score >= 60) currentCycle = 'KONFIRMASI_MULAI';
      else if (regime.includes('distribusi')) currentCycle = 'WASPADAI_DISTRIBUSI';

      const result = await updateSignalLifecycle({
        symbol,
        currentScore: score,
        currentDate:  new Date().toISOString().split('T')[0],
        currentRegime: decision.marketRegime,
        currentCycle,
      });

      res.status(200).json(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: message });
    }
  });
}
