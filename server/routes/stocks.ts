import type { Express } from "express";
import { api } from "@shared/routes";
import { storage } from "../storage";
import { HOMEPAGE_UNIVERSE } from "../engine/lq45Universe";
import { computeStockReadiness } from "../engine/stockReadiness";
import { UNIVERSE_STOCK_NAMES, UNIVERSE_STOCK_SECTORS } from "../config/constants";
import { db } from "../db";
import { stocks as stocksTable } from "@shared/schema";
import { inArray, isNull, and as andOp, eq } from "drizzle-orm";

export function registerStocksRoutes(app: Express): void {
  app.get(api.stocks.getBySymbol.path, async (req, res) => {
    const symbol = req.params.symbol;
    const stock = await storage.getStockBySymbol(symbol);
    if (!stock) {
      return res.status(404).json({ message: "Stock not found" });
    }
    res.json(stock);
  });

  // Get all stocks for homepage with readiness data
  // Uses UNIFIED ACTION GUIDANCE ENGINE for consistency
  // HOMEPAGE_UNIVERSE imported from server/engine/lq45Universe.ts — edit there, not here

  // Backfill: update DB rows whose sector is NULL for the known universe stocks.
  // Runs once at startup; safe to re-run (only touches rows still missing sector).
  (async () => {
    try {
      const symbols = Object.keys(UNIVERSE_STOCK_SECTORS);
      const rowsNeedingFix = await db
        .select({ symbol: stocksTable.symbol })
        .from(stocksTable)
        .where(andOp(inArray(stocksTable.symbol, symbols), isNull(stocksTable.sector)));
      if (rowsNeedingFix.length > 0) {
        for (const row of rowsNeedingFix) {
          const meta = UNIVERSE_STOCK_SECTORS[row.symbol];
          if (!meta) continue;
          await db
            .update(stocksTable)
            .set({ sector: meta.sector, subsector: meta.subsector, sectorBadge: meta.sectorBadge })
            .where(eq(stocksTable.symbol, row.symbol));
          console.log(`[SECTOR BACKFILL] Updated ${row.symbol}: sector=${meta.sector}, subsector=${meta.subsector}`);
        }
        console.log(`[SECTOR BACKFILL] Completed: ${rowsNeedingFix.length} stock(s) updated`);
      } else {
        console.log(`[SECTOR BACKFILL] No null-sector rows found for universe stocks`);
      }
    } catch (err) {
      console.error(`[SECTOR BACKFILL] Failed:`, err);
    }
  })();

  app.get("/api/stocks", async (_req, res) => {
    try {
      const allStocks = await storage.getAllStocks();
      const watchlistItems = await storage.getWatchlist();
      const watchlistSymbols = new Set(watchlistItems.map(w => w.symbol));

      // Build map of DB stocks by symbol
      const dbStockMap = new Map(allStocks.map(s => [s.symbol, s]));

      // Ensure all 12 universe stocks are present - fill missing with fallback
      const missingSymbols: string[] = [];
      const universeStocks = HOMEPAGE_UNIVERSE.map(symbol => {
        const existing = dbStockMap.get(symbol);
        if (existing) return existing;

        missingSymbols.push(symbol);
        console.log(`[UNIVERSE AUDIT] Stock ${symbol} missing from DB — using fallback`);

        const sectorMeta = UNIVERSE_STOCK_SECTORS[symbol] ?? null;

        return {
          id: 0,
          symbol,
          name: UNIVERSE_STOCK_NAMES[symbol] || symbol,
          price: 0,
          change: 0,
          changePercent: 0,
          summary: "Data tidak tersedia atau gagal diproses",
          description: "",
          marketCap: null,
          peRatio: null,
          dividendYield: null,
          updatedAt: null,
          aiConfidence: null,
          sector: sectorMeta?.sector ?? null,
          subsector: sectorMeta?.subsector ?? null,
          roe: null,
          netMargin: null,
          growth: "0",
          investorView: null,
          financialSummary: null,
          revenue2023: null, revenue2024: null, revenue2025: null,
          netProfit2023: null, netProfit2024: null, netProfit2025: null,
          assets2023: null, assets2024: null, assets2025: null,
          liabilities2023: null, liabilities2024: null, liabilities2025: null,
          ocf2023: null, ocf2024: null, ocf2025: null,
          tradingActivitySummary: null,
          flowReliability: "Rendah",
          brokerData: null,
          flowOverviewSummary: null,
          flowBias: "Netral",
          foreignActivityData: null,
          flowIntensity: "Tidak Ada Data",
          avgBuyPrice: null, avgSellPrice: null,
          newsOverviewSummary: null,
          newsImpact: null, newsRelevance: null, newsFeed: null,
          corporateActions: null,
          investorInterpretation: null, eventAnalysis: null,
          financialsAnalystView: null, flowAnalystView: null, riskAnalystView: null,
          riskData: null, insiderData: null,
          idxIndices: null, sectorBadge: sectorMeta?.sectorBadge ?? null,
          stockTags: null, stockCharacter: null, stockCharacterDesc: null,
          retailSentiment: null, foreignDomesticInterpretation: null,
          localRiskFactors: null, retailSummary: null,
        };
      });

      // Console audit
      console.log(`[UNIVERSE AUDIT] totalUniverseCount: ${HOMEPAGE_UNIVERSE.length}`);
      console.log(`[UNIVERSE AUDIT] totalRenderedCount: ${universeStocks.length}`);
      if (missingSymbols.length > 0) {
        console.log(`[UNIVERSE AUDIT] missingSymbols: ${missingSymbols.join(", ")}`);
      } else {
        console.log(`[UNIVERSE AUDIT] missingSymbols: none`);
      }

      const safeParseBulk = (v: any): number | null => { const n = parseFloat(String(v)); return isFinite(n) ? n : null; };

      // Calculate readiness score for each stock using UNIFIED BRAIN
      // RULE: Never filter out stocks. If analysis fails, use fallback state.
      const stocksWithReadiness = universeStocks.map(stock => {
        try {
          // Check if this is a fallback stock with no real data
          const hasRealData = stock.id !== 0 && Number(stock.price) > 0;

          if (!hasRealData) {
            console.log(`[UNIVERSE AUDIT] ${stock.symbol}: analysis skipped — using fallback state (Data Tidak Lengkap)`);
            return {
              symbol: stock.symbol,
              name: stock.name,
              price: stock.price,
              change: stock.change,
              changePercent: stock.changePercent,
              sector: stock.sector,
              sectorBadge: stock.sectorBadge,
              readinessScore: null,
              marketRegime: "Tidak Diketahui",
              actionGuidance: "Analisis tidak tersedia",
              actionColor: "red",
              actionState: "HINDARI_DULU",
              homepageBucket: "hindari_dulu",
              aiSentence: "Analisis tidak tersedia — data tidak lengkap",
              isInWatchlist: watchlistSymbols.has(stock.symbol),
              isGorengan: false,
              gorenganWarning: null,
              riskOverride: null,
              computeError: true,
              errorMessage: "Data tidak tersedia di database",
            };
          }

          // CANONICAL COMPOSITE — gorengan + decision + M17 + compositeV3 in one call
          const readiness = computeStockReadiness({
            symbol:              stock.symbol,
            sector:              stock.sector ?? null,
            changePercent:       stock.changePercent,
            flowBias:            stock.flowBias,
            flowIntensity:       stock.flowIntensity,
            flowReliability:     stock.flowReliability,
            brokerData:          stock.brokerData,
            foreignActivityData: stock.foreignActivityData,
            stockCharacter:      stock.stockCharacter ?? null,
            insiderData:         stock.insiderData ?? null,
            growth:              stock.growth ?? null,
            peRatio:             stock.peRatio,
            dividendYield:       stock.dividendYield,
            roe:                 stock.roe,
            netMargin:           stock.netMargin,
            marketCap:           stock.marketCap ?? null,
            avg20dValue:         (stock as any).avg20dValue ?? null,
          });

          return {
            symbol: stock.symbol,
            name: stock.name,
            price: stock.price,
            change: stock.change,
            changePercent: stock.changePercent,
            sector: stock.sector,
            sectorBadge: stock.sectorBadge,
            readinessScore:  readiness.compositeScore,
            marketRegime:    readiness.decision.marketRegime,
            actionGuidance:  readiness.actionGuidance,
            actionColor:     readiness.actionColor,
            actionState:     readiness.actionState,
            homepageBucket:  readiness.homepageBucket,
            aiSentence:      readiness.decision.shortSummary,
            isInWatchlist:   watchlistSymbols.has(stock.symbol),
            isGorengan:      readiness.isGorengan,
            gorenganWarning: readiness.isGorengan ? "Aktivitas spekulatif ritel terdeteksi" : null,
            riskOverride:    readiness.gorenganResult.riskOverride,
            hardOverride:    readiness.hardOverride,
            macroHardCap:    readiness.macroHardCap,
            activeWeightSum: readiness.activeWeightSum,
            compositeV3Layers: readiness.layers,
            scrapeSource:    (stock as any).scrapeSource ?? null,
          };
        } catch (analysisError: any) {
          console.error(`[UNIVERSE AUDIT] ${stock.symbol}: analysis FAILED —`, {
            message: analysisError?.message,
            stack: analysisError?.stack?.split('\n').slice(0, 3).join(' | '),
          });
          return {
            symbol: stock.symbol,
            name: stock.name,
            price: stock.price || 0,
            change: stock.change || 0,
            changePercent: stock.changePercent || 0,
            sector: stock.sector || null,
            sectorBadge: stock.sectorBadge || null,
            readinessScore: null,
            marketRegime: "Tidak Diketahui",
            actionGuidance: "Analisis tidak tersedia",
            actionColor: "red",
            actionState: "HINDARI_DULU",
            homepageBucket: "hindari_dulu",
            aiSentence: "Analisis tidak tersedia — data tidak lengkap",
            isInWatchlist: watchlistSymbols.has(stock.symbol),
            isGorengan: false,
            gorenganWarning: null,
            riskOverride: null,
            computeError: true,
            errorMessage: analysisError?.message ?? "Unknown analysis error",
          };
        }
      });

      res.json(stocksWithReadiness);
    } catch (error) {
      console.error("Error fetching stocks:", error);
      res.status(500).json({ message: "Failed to fetch stocks" });
    }
  });

  app.get("/api/search", async (req, res) => {
    try {
      const q = (typeof req.query.q === "string" ? req.query.q : "").trim();
      if (q.length < 1) return res.json([]);
      const qUpper = q.toUpperCase();
      const qLower = q.toLowerCase();
      const allStocks = await storage.getAllStocks();
      const dbMap = new Map(allStocks.map(s => [s.symbol, s]));
      const universe = HOMEPAGE_UNIVERSE.map(symbol => {
        const db = dbMap.get(symbol);
        return {
          symbol,
          companyName: db?.name || UNIVERSE_STOCK_NAMES[symbol] || symbol,
          price: db ? String(db.price) : "0",
          changePercent: db ? String(db.changePercent) : "0",
        };
      });
      const results = universe
        .filter(s => s.symbol.includes(qUpper) || s.companyName.toLowerCase().includes(qLower))
        .slice(0, 8);
      res.json(results);
    } catch (error) {
      console.error("Error searching stocks:", error);
      res.status(500).json({ message: "Failed to search stocks" });
    }
  });
}
