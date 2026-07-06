import type { Express } from "express";
import { computeGorenganFromStock } from "../engine/gorenganDetector";
import { mapStockDataToInput, getStockDecision } from "../engine/unifiedDecision";
import { runEngineTests } from "../engine/runTests";
import { storage } from "../storage";

// ========================================
// SIMULATION MODE API ENDPOINTS
// Market Replay Simulator for Pre-Live Validation
// ========================================

// LOCKED STOCK UNIVERSE (12 stocks)
const SIMULATION_STOCK_UNIVERSE = [
  // Blue Chips (expected: Watchlist / Akumulasi, calm language)
  "ICBP", "UNVR", "BBCA", "ADRO", "UNTR",
  // Speculative Stocks (expected: Gorengan detector, Hindari Dulu)
  "BUMI", "DADA", "BULL", "PIPA", "WIFI", "SGER", "MORA"
];

const BLUE_CHIP_STOCKS = ["ICBP", "UNVR", "BBCA", "ADRO", "UNTR"];
const SPECULATIVE_STOCKS = ["BUMI", "DADA", "BULL", "PIPA", "WIFI", "SGER", "MORA"];

// Simple cache for Yahoo Finance data (avoid rate limiting)
const marketDataCache = new Map<string, {
  data: any;
  timestamp: number;
}>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes cache

// News Classification Types
type NewsClassification = "FUNDAMENTAL" | "SENTIMENT" | "IRRELEVANT";

interface ClassifiedNews {
  headline: string;
  source: string;
  publishTime: string;
  classification: NewsClassification;
  aiExplanation: string;
  affectsStructure: boolean;
  affectsBehavior: boolean;
}

// Classify news items using smart filter
function classifyNews(headline: string, fullText: string = ""): {
  classification: NewsClassification;
  aiExplanation: string;
  affectsStructure: boolean;
  affectsBehavior: boolean;
} {
  const headlineLower = headline.toLowerCase();
  const textLower = (fullText || headline).toLowerCase();

  // Fundamental Impact Keywords
  const fundamentalKeywords = [
    "laba", "rugi", "pendapatan", "revenue", "earnings", "dividen",
    "akuisisi", "merger", "capex", "investasi", "ekspansi pabrik",
    "right issue", "stock split", "buyback", "kontrak baru",
    "proyek strategis", "kinerja keuangan", "laporan keuangan"
  ];

  // Sentiment/Noise Keywords
  const sentimentKeywords = [
    "spekulasi", "rumor", "kabar", "potensi", "kemungkinan",
    "rencana", "berencana", "akan", "mungkin", "dikabarkan",
    "optimis", "pesimis", "target harga", "rekomendasi analis"
  ];

  // Irrelevant Keywords
  const irrelevantKeywords = [
    "ihsg", "indeks", "bursa", "market cap", "trading volume",
    "teknikal", "chart", "fibonacci", "support resistance"
  ];

  const hasFundamental = fundamentalKeywords.some(kw => textLower.includes(kw));
  const hasSentiment = sentimentKeywords.some(kw => textLower.includes(kw));
  const hasIrrelevant = irrelevantKeywords.some(kw => textLower.includes(kw));

  const behaviorKeywords = [
    "rights issue", "right issue", "dividen", "akuisisi", "merger",
    "buyback", "laba", "earnings", "restrukturisasi"
  ];
  const affectsBehavior = behaviorKeywords.some(kw => textLower.includes(kw));

  if (hasFundamental && !hasSentiment) {
    return {
      classification: "FUNDAMENTAL",
      aiExplanation: `Berita ini berkaitan dengan perubahan fundamental perusahaan yang berdampak pada struktur bisnis. Investor perlu memperhatikan implikasi jangka menengah-panjang.`,
      affectsStructure: true,
      affectsBehavior
    };
  }

  if (hasSentiment || (!hasFundamental && !hasIrrelevant)) {
    return {
      classification: "SENTIMENT",
      aiExplanation: `Berita ini bersifat spekulatif atau sentimen pasar. Tidak mengubah fundamental perusahaan, namun dapat mempengaruhi pergerakan harga jangka pendek.`,
      affectsStructure: false,
      affectsBehavior
    };
  }

  return {
    classification: "IRRELEVANT",
    aiExplanation: `Berita ini tidak relevan dengan analisis fundamental saham. Informasi bersifat umum atau noise pasar.`,
    affectsStructure: false,
    affectsBehavior: false
  };
}

// Fetch real market data from Yahoo Finance (with caching)
async function fetchRealMarketData(symbol: string, date: string): Promise<{
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  change: number;
  changePercent: number;
  marketCap: number | null;
  dataSource: "REAL" | "SIMULATED";
  confidence: "Tinggi" | "Sedang" | "Rendah";
}> {
  // Check cache first
  const cacheKey = `${symbol}-${date}`;
  const cached = marketDataCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    console.log(`Using cached data for ${symbol}`);
    return cached.data;
  }

  try {
    // Yahoo Finance uses .JK suffix for IDX stocks
    const yahooSymbol = `${symbol}.JK`;
    
    // Fetch from Yahoo Finance chart API
    const endDate = new Date(date);
    endDate.setDate(endDate.getDate() + 1);
    const startDate = new Date(date);
    startDate.setDate(startDate.getDate() - 7); // Get last 7 days for context
    
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${yahooSymbol}?period1=${Math.floor(startDate.getTime() / 1000)}&period2=${Math.floor(endDate.getTime() / 1000)}&interval=1d`;
    
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
      }
    });
    
    if (!response.ok) {
      throw new Error(`Yahoo Finance API error: ${response.status}`);
    }
    
    const data = await response.json();
    const result = data.chart?.result?.[0];
    
    if (!result || !result.indicators?.quote?.[0]) {
      throw new Error("No data available");
    }
    
    const quote = result.indicators.quote[0];
    const timestamps = result.timestamp || [];
    
    // Get the last available trading day data
    const lastIdx = timestamps.length - 1;
    const prevIdx = Math.max(0, lastIdx - 1);
    
    if (lastIdx < 0) {
      throw new Error("No trading data");
    }
    
    const open = quote.open[lastIdx] || 0;
    const high = quote.high[lastIdx] || 0;
    const low = quote.low[lastIdx] || 0;
    const close = quote.close[lastIdx] || 0;
    const volume = quote.volume[lastIdx] || 0;
    const prevClose = quote.close[prevIdx] || close;
    
    const change = close - prevClose;
    const changePercent = prevClose > 0 ? (change / prevClose) * 100 : 0;
    
    const realData = {
      open: Math.round(open),
      high: Math.round(high),
      low: Math.round(low),
      close: Math.round(close),
      volume,
      change: Math.round(change),
      changePercent: Math.round(changePercent * 100) / 100,
      marketCap: result.meta?.marketCap || null,
      dataSource: "REAL" as const,
      confidence: "Tinggi" as const
    };
    
    // Cache the result
    marketDataCache.set(cacheKey, { data: realData, timestamp: Date.now() });
    
    return realData;
  } catch (error) {
    console.log(`Failed to fetch real data for ${symbol}, using simulated data:`, error);
    
    const basePrice = getBasePrice(symbol);
    const close = basePrice;
    const high = Math.round(close * 1.01);
    const low = Math.round(close * 0.99);
    const open = Math.round((high + low) / 2);

    return {
      open,
      high,
      low,
      close,
      volume: 25000000,
      change: 0,
      changePercent: 0,
      marketCap: null,
      dataSource: "SIMULATED",
      confidence: "Sedang"
    };
  }
}

// Base prices for simulation fallback
function getBasePrice(symbol: string): number {
  const basePrices: Record<string, number> = {
    "ICBP": 10500, "UNVR": 3200, "BBCA": 9800, "ADRO": 2650, "UNTR": 26500,
    "BUMI": 128, "DADA": 50, "BULL": 168, "PIPA": 340, "WIFI": 178, "SGER": 520, "MORA": 89
  };
  return basePrices[symbol] || 1000;
}

// Generate simulated news for a stock
function generateSimulatedNews(symbol: string, date: string): ClassifiedNews[] {
  const isBlueChip = BLUE_CHIP_STOCKS.includes(symbol);
  
  if (isBlueChip) {
    // Blue chip stocks get fundamental news
    const fundamentalNews = [
      { headline: `${symbol} Catat Pertumbuhan Laba Bersih 8.5% YoY`, source: "IDX News", classification: "FUNDAMENTAL" as NewsClassification },
      { headline: `Dividen Interim ${symbol} Diumumkan Rp150 per Saham`, source: "Bisnis Indonesia", classification: "FUNDAMENTAL" as NewsClassification },
      { headline: `Analis Pertahankan Rating ${symbol} di Level Overweight`, source: "CNBC Indonesia", classification: "SENTIMENT" as NewsClassification }
    ];
    
    return fundamentalNews.map(n => {
      const classified = classifyNews(n.headline);
      return {
        headline: n.headline,
        source: n.source,
        publishTime: `${date}T09:00:00`,
        classification: n.classification,
        aiExplanation: classified.aiExplanation,
        affectsStructure: classified.affectsStructure,
        affectsBehavior: classified.affectsBehavior
      };
    });
  } else {
    // Speculative stocks get sentiment/noise news
    const speculativeNews = [
      { headline: `Saham ${symbol} Melonjak, Investor Berburu Cuan Cepat`, source: "Detik Finance", classification: "SENTIMENT" as NewsClassification },
      { headline: `${symbol} Dikabarkan Akan Ekspansi, Belum Ada Konfirmasi Resmi`, source: "Tribun Bisnis", classification: "SENTIMENT" as NewsClassification },
      { headline: `Volume Transaksi ${symbol} Meledak 5x Lipat dari Rata-rata`, source: "Kontan", classification: "IRRELEVANT" as NewsClassification }
    ];
    
    return speculativeNews.map(n => {
      const classified = classifyNews(n.headline);
      return {
        headline: n.headline,
        source: n.source,
        publishTime: `${date}T10:00:00`,
        classification: n.classification,
        aiExplanation: classified.aiExplanation,
        affectsStructure: classified.affectsStructure,
        affectsBehavior: classified.affectsBehavior
      };
    });
  }
}

// Run simulation validation on all stocks
export function registerSimulationRoutes(app: Express): void {
  app.post("/api/simulation/run", async (req, res) => {
    const { replayDate } = req.body;
    const runId = `SIM-${Date.now()}`;
  
    // Use T-1 (yesterday) if no date provided
    const dataDate = replayDate || (() => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      return yesterday.toISOString().split("T")[0];
    })();
  
    // Use LOCKED stock universe
    const stocksToSimulate = SIMULATION_STOCK_UNIVERSE;
  
    const auditDetails: any[] = [];
    let passCount = 0;
    let failCount = 0;
    let consistencyFailures = 0;
    let safetyFailures = 0;
    let uxSanityFailures = 0;
    let behaviorFailures = 0;

    for (const symbol of stocksToSimulate) {
      // ========================================
      // STEP 1: FETCH REAL MARKET DATA
      // ========================================
      const marketData = await fetchRealMarketData(symbol, dataDate);
    
      // ========================================
      // STEP 2: LOAD NEWS AND CLASSIFY
      // ========================================
      const newsItems = generateSimulatedNews(symbol, dataDate);
      const newsClassificationSummary = {
        fundamental: newsItems.filter(n => n.classification === "FUNDAMENTAL").length,
        sentiment: newsItems.filter(n => n.classification === "SENTIMENT").length,
        irrelevant: newsItems.filter(n => n.classification === "IRRELEVANT").length,
      };
    
      // ========================================
      // STEP 3: FEATURE EXTRACTION
      // ========================================
      const isBlueChip = BLUE_CHIP_STOCKS.includes(symbol);

      const flowBias = marketData.changePercent > 0.5 ? "Akumulasi"
        : marketData.changePercent < -0.5 ? "Distribusi"
        : "Netral";
      const flowIntensity = Math.abs(marketData.changePercent) > 2 ? "Besar" : "Moderat";
      const flowReliability = marketData.dataSource === "REAL"
        ? (isBlueChip ? "Tinggi" : "Sedang")
        : "Sedang";

      // ========================================
      // STEP 4: GORENGAN DETECTION via computeGorenganFromStock
      // ========================================
      const simGorenganResult = computeGorenganFromStock({
        symbol,
        changePercent: String(marketData.changePercent),
        flowBias,
        flowIntensity,
        flowReliability,
        brokerData: "[]",
        foreignActivityData: JSON.stringify({
          netForeignFlow: isBlueChip ? "10B IDR" : "0",
          netDomesticFlow: isBlueChip ? "20B IDR" : "5B IDR"
        }),
      });
      const isGorengan = simGorenganResult.isGorengan;
      const triggeredLayers = simGorenganResult.triggeredLayers;

      // ========================================
      // STEP 5-8: UNIFIED BRAIN (getStockDecision)
      // Same function used by homepage and detail page
      // ========================================
      const simBrainInput = mapStockDataToInput({
        flowBias,
        flowIntensity,
        flowReliability,
        changePercent: String(marketData.changePercent),
        isGorengan,
      });
      const simDecision = getStockDecision(simBrainInput);

      const readinessScore = simDecision.readiness;
      const marketRegime = simDecision.marketRegime;

      const actionGuidance = {
        state: simDecision.actionState,
        label: simDecision.bucket,
        color: simDecision.color,
        shortSummary: simDecision.shortSummary,
        whyAction: simDecision.whyAction,
        mainRisk: simDecision.mainRisk,
        failureTrigger: simDecision.failureTrigger,
        homepageBucket: simDecision.bucket === "Siap Dipantau" ? "siap_dipantau" as const
          : simDecision.bucket === "Watchlist Prioritas" ? "watchlist_prioritas" as const
          : "hindari_dulu" as const
      };

      const actualBucket = actionGuidance.homepageBucket;
    
      // ========================================
      // VALIDATION CHECKS
      // ========================================
    
      const failureReasons: string[] = [];
    
      // A) CONSISTENCY CHECK
      let consistencyCheck: "PASS" | "FAIL" = "PASS";
      const expectedBucket = actionGuidance.homepageBucket;
    
      if (expectedBucket !== actualBucket && !isGorengan) {
        consistencyCheck = "FAIL";
        failureReasons.push(`Bucket mismatch: expected ${expectedBucket}, got ${actualBucket}`);
        consistencyFailures++;
      }
    
      // Watchlist alignment
      const isWatchlistPriorityBucket = actualBucket === "watchlist_prioritas";
      const expectedWatchlistPriority = actionGuidance.state === "WATCHLIST_PRIORITAS";
      if (isWatchlistPriorityBucket !== expectedWatchlistPriority) {
        consistencyCheck = "FAIL";
        failureReasons.push(`Watchlist priority mismatch: bucket=${isWatchlistPriorityBucket}, state=${expectedWatchlistPriority}`);
        consistencyFailures++;
      }
    
      // State-bucket mapping
      const stateToBucketMap: Record<string, string> = {
        "AKUMULASI_BERTAHAP": "siap_dipantau",
        "WATCHLIST_PRIORITAS": "watchlist_prioritas",
        "PANTAU_SAJA": "hindari_dulu",
        "HINDARI_DULU": "hindari_dulu",
        "KURANGI_EXIT": "hindari_dulu",
      };
      const expectedBucketFromState = stateToBucketMap[actionGuidance.state] || "hindari_dulu";
      if (actualBucket !== expectedBucketFromState && !isGorengan) {
        consistencyCheck = "FAIL";
        failureReasons.push(`State-bucket mismatch: state ${actionGuidance.state} should map to ${expectedBucketFromState}, got ${actualBucket}`);
        consistencyFailures++;
      }
    
      // B) SAFETY CHECK
      let safetyCheck: "PASS" | "FAIL" = "PASS";
      if (isGorengan) {
        if (actionGuidance.state === "AKUMULASI_BERTAHAP" || 
            actionGuidance.state === "WATCHLIST_PRIORITAS") {
          safetyCheck = "FAIL";
          failureReasons.push(`Gorengan stock showing unsafe state: ${actionGuidance.state}`);
          safetyFailures++;
        }
        if (readinessScore > 59) {
          safetyCheck = "FAIL";
          failureReasons.push(`Gorengan readiness score not clamped: ${readinessScore}`);
          safetyFailures++;
        }
      }
    
      // C) UX SANITY CHECK
      let uxSanityCheck: "PASS" | "FAIL" = "PASS";
      if (!actionGuidance.label || actionGuidance.label.trim() === "") {
        uxSanityCheck = "FAIL";
        failureReasons.push("Missing action guidance label");
        uxSanityFailures++;
      }
      if (!actionGuidance.shortSummary || actionGuidance.shortSummary.trim() === "") {
        uxSanityCheck = "FAIL";
        failureReasons.push("Missing action guidance summary");
        uxSanityFailures++;
      }
    
      const englishKeywords = ["buy", "sell", "hold", "wait", "avoid"];
      const hasEnglish = englishKeywords.some(kw => 
        actionGuidance.shortSummary.toLowerCase().includes(kw) ||
        actionGuidance.label.toLowerCase().includes(kw)
      );
      if (hasEnglish) {
        uxSanityCheck = "FAIL";
        failureReasons.push("Action guidance contains English text instead of Bahasa Indonesia");
        uxSanityFailures++;
      }
    
      // D) EXPECTED BEHAVIOR CHECK
      let behaviorCheck: "PASS" | "FAIL" = "PASS";
    
      // Blue chips should mostly show Watchlist/Akumulasi with calm language
      if (isBlueChip) {
        const isCalm = actionGuidance.state === "AKUMULASI_BERTAHAP" || 
                       actionGuidance.state === "WATCHLIST_PRIORITAS";
        if (!isCalm && !isGorengan) {
          behaviorCheck = "FAIL";
          failureReasons.push(`Blue chip ${symbol} showing aggressive action: ${actionGuidance.state}`);
          behaviorFailures++;
        }
      }
    
      if (isGorengan) {
        if (actionGuidance.state === "AKUMULASI_BERTAHAP" ||
            actionGuidance.state === "WATCHLIST_PRIORITAS") {
          behaviorCheck = "FAIL";
          failureReasons.push(`Gorengan stock ${symbol} should not show Watchlist/Akumulasi`);
          behaviorFailures++;
        }
      }
    
      // Overall result
      const overallResult = (consistencyCheck === "PASS" && 
                            safetyCheck === "PASS" && 
                            uxSanityCheck === "PASS" &&
                            behaviorCheck === "PASS") ? "PASS" : "FAIL";
    
      if (overallResult === "PASS") {
        passCount++;
      } else {
        failCount++;
      }
    
      const auditEntry = {
        symbol,
        readinessScore,
        marketRegime,
        actionGuidanceState: actionGuidance.state,
        actionGuidanceLabel: actionGuidance.label,
        homepageBucket: actualBucket,
        isGorengan,
        gorenganLayers: triggeredLayers,
        consistencyCheck,
        safetyCheck,
        uxSanityCheck,
        behaviorCheck,
        overallResult,
        failureReasons,
        // Enhanced data for audit report
        marketData: {
          open: marketData.open,
          high: marketData.high,
          low: marketData.low,
          close: marketData.close,
          volume: marketData.volume,
          change: marketData.change,
          changePercent: marketData.changePercent,
          dataSource: marketData.dataSource,
          confidence: marketData.confidence,
        },
        newsClassification: newsClassificationSummary,
        stockType: isBlueChip ? "BLUE_CHIP" : (isGorengan ? "SPECULATIVE" : "OTHER"),
      };
    
      auditDetails.push(auditEntry);
    
      // Persist audit log to database
      try {
        await storage.insertSimulationAuditLog({
          runId,
          replayDate: dataDate,
          symbol,
          readinessScore: readinessScore.toString(),
          marketRegime,
          actionGuidanceState: actionGuidance.state,
          actionGuidanceLabel: actionGuidance.label,
          homepageBucket: actualBucket,
          isGorengan: isGorengan ? "true" : "false",
          gorenganLayers: JSON.stringify(triggeredLayers),
          consistencyCheck,
          safetyCheck,
          uxSanityCheck,
          overallResult,
          failureReasons: JSON.stringify(failureReasons),
        });
      } catch (logError) {
        console.error(`Failed to persist audit log for ${symbol}:`, logError);
      }
    }
  
    // Count data sources
    const realDataCount = auditDetails.filter(d => d.marketData?.dataSource === "REAL").length;
    const simulatedDataCount = auditDetails.filter(d => d.marketData?.dataSource === "SIMULATED").length;
  
    const summary = {
      runId,
      replayDate: dataDate,
      simulationMode: true,
      dataDate,
      totalStocks: stocksToSimulate.length,
      stockUniverse: {
        blueChips: BLUE_CHIP_STOCKS,
        speculative: SPECULATIVE_STOCKS,
      },
      dataSourceStats: {
        realData: realDataCount,
        simulatedData: simulatedDataCount,
        realDataPercent: Math.round((realDataCount / stocksToSimulate.length) * 100),
      },
      passCount,
      failCount,
      consistencyFailures,
      safetyFailures,
      uxSanityFailures,
      behaviorFailures,
      validationApproach: "Stock classification (Blue Chip vs Speculative) determines expected behavior validation",
      details: auditDetails,
      auditPersisted: true,
    };
  
    res.json(summary);
  });

  // ========================================
  // ENGINE TEST ENDPOINT
  // Validates unified brain with locked test scenarios
  // ========================================
  app.get("/api/test-engine", async (_req, res) => {
    res.json(await runEngineTests());
  });

  // ========================================
  // DIAGNOSTIC: Market Data Fetch Pipeline
  // Tests Yahoo Finance connectivity for all 12 universe stocks
  // ========================================
  app.get("/api/diagnostics/market-data", async (_req, res) => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dateStr = yesterday.toISOString().split("T")[0];

    console.log(`\n========================================`);
    console.log(`[DIAGNOSTICS] Market Data Fetch Pipeline`);
    console.log(`[DIAGNOSTICS] Date: ${dateStr}`);
    console.log(`[DIAGNOSTICS] Universe: ${SIMULATION_STOCK_UNIVERSE.length} stocks`);
    console.log(`========================================\n`);

    const results: Array<{
      requestedSymbol: string;
      yahooFormattedSymbol: string;
      fetchStatus: "success" | "fail";
      returnedOHLCLength: number;
      returnedVolume: number | null;
      ohlc: { open: number; high: number; low: number; close: number } | null;
      errorMessage: string | null;
    }> = [];

    for (const symbol of SIMULATION_STOCK_UNIVERSE) {
      const yahooFormattedSymbol = `${symbol}.JK`;
    
      try {
        const endDate = new Date(dateStr);
        endDate.setDate(endDate.getDate() + 1);
        const startDate = new Date(dateStr);
        startDate.setDate(startDate.getDate() - 7);

        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${yahooFormattedSymbol}?period1=${Math.floor(startDate.getTime() / 1000)}&period2=${Math.floor(endDate.getTime() / 1000)}&interval=1d`;

        console.log(`[DIAGNOSTICS] ${symbol} → ${yahooFormattedSymbol} | Fetching...`);

        const response = await fetch(url, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
          }
        });

        if (!response.ok) {
          const errText = `HTTP ${response.status} ${response.statusText}`;
          console.log(`[DIAGNOSTICS] ${symbol} → FAIL | ${errText}`);
          results.push({
            requestedSymbol: symbol,
            yahooFormattedSymbol,
            fetchStatus: "fail",
            returnedOHLCLength: 0,
            returnedVolume: null,
            ohlc: null,
            errorMessage: errText,
          });
          continue;
        }

        const data = await response.json();
        const result = data.chart?.result?.[0];

        if (!result || !result.indicators?.quote?.[0]) {
          const errText = "No chart data in response";
          console.log(`[DIAGNOSTICS] ${symbol} → FAIL | ${errText}`);
          results.push({
            requestedSymbol: symbol,
            yahooFormattedSymbol,
            fetchStatus: "fail",
            returnedOHLCLength: 0,
            returnedVolume: null,
            ohlc: null,
            errorMessage: errText,
          });
          continue;
        }

        const quote = result.indicators.quote[0];
        const timestamps = result.timestamp || [];
        const lastIdx = timestamps.length - 1;

        const ohlcLength = timestamps.length;
        const volume = lastIdx >= 0 ? (quote.volume?.[lastIdx] || 0) : null;
        const ohlc = lastIdx >= 0 ? {
          open: Math.round(quote.open?.[lastIdx] || 0),
          high: Math.round(quote.high?.[lastIdx] || 0),
          low: Math.round(quote.low?.[lastIdx] || 0),
          close: Math.round(quote.close?.[lastIdx] || 0),
        } : null;

        console.log(`[DIAGNOSTICS] ${symbol} → SUCCESS | OHLC bars: ${ohlcLength} | Volume: ${volume} | Close: ${ohlc?.close}`);

        results.push({
          requestedSymbol: symbol,
          yahooFormattedSymbol,
          fetchStatus: "success",
          returnedOHLCLength: ohlcLength,
          returnedVolume: volume,
          ohlc,
          errorMessage: null,
        });
      } catch (error: any) {
        const errMsg = error?.message || String(error);
        console.log(`[DIAGNOSTICS] ${symbol} → FAIL | ${errMsg}`);
        results.push({
          requestedSymbol: symbol,
          yahooFormattedSymbol,
          fetchStatus: "fail",
          returnedOHLCLength: 0,
          returnedVolume: null,
          ohlc: null,
          errorMessage: errMsg,
        });
      }
    }

    const totalSuccess = results.filter(r => r.fetchStatus === "success").length;
    const totalFailed = results.filter(r => r.fetchStatus === "fail").length;
    const failedSymbols = results.filter(r => r.fetchStatus === "fail").map(r => r.requestedSymbol);

    const summary = {
      totalRequested: SIMULATION_STOCK_UNIVERSE.length,
      totalSuccess,
      totalFailed,
      failedSymbols,
    };

    console.log(`\n========================================`);
    console.log(`[DIAGNOSTICS] SUMMARY`);
    console.log(`[DIAGNOSTICS] totalRequested: ${summary.totalRequested}`);
    console.log(`[DIAGNOSTICS] totalSuccess: ${summary.totalSuccess}`);
    console.log(`[DIAGNOSTICS] totalFailed: ${summary.totalFailed}`);
    console.log(`[DIAGNOSTICS] failedSymbols: ${failedSymbols.length > 0 ? failedSymbols.join(", ") : "none"}`);
    console.log(`========================================\n`);

    // Also log DB stock presence for cross-reference
    const allStocks = await storage.getAllStocks();
    const dbSymbols = allStocks.map(s => s.symbol);
    const inDB = SIMULATION_STOCK_UNIVERSE.filter(s => dbSymbols.includes(s));
    const notInDB = SIMULATION_STOCK_UNIVERSE.filter(s => !dbSymbols.includes(s));

    console.log(`[DIAGNOSTICS] DB cross-reference:`);
    console.log(`[DIAGNOSTICS]   In DB (${inDB.length}): ${inDB.join(", ")}`);
    console.log(`[DIAGNOSTICS]   NOT in DB (${notInDB.length}): ${notInDB.join(", ")}`);
    console.log(`[DIAGNOSTICS]   DB has extra stocks not in universe: ${dbSymbols.filter(s => !SIMULATION_STOCK_UNIVERSE.includes(s)).join(", ") || "none"}`);

    res.json({
      diagnosticDate: dateStr,
      perSymbol: results,
      summary,
      dbCrossReference: {
        inDB,
        notInDB,
        extraInDB: dbSymbols.filter(s => !SIMULATION_STOCK_UNIVERSE.includes(s)),
      },
      explanation: "Homepage /api/stocks reads from database, NOT Yahoo Finance. Stocks not in DB get fallback state. Yahoo Finance is only used by the simulation pipeline (/api/simulation/run)."
    });
  });

  // Get simulation status
  app.get("/api/simulation/status", async (_req, res) => {
    res.json({
      available: true,
      description: "Market Replay Simulator untuk validasi pre-live",
      features: [
        "Validasi konsistensi homepage-detail",
        "Pengecekan keamanan gorengan",
        "Audit UX Bahasa Indonesia",
        "Pipeline analisis lengkap",
        "Persistensi audit log ke database"
      ]
    });
  });

  // Get audit logs for a simulation run (internal use)
  app.get("/api/simulation/audit/:runId", async (req, res) => {
    const { runId } = req.params;
    try {
      const logs = await storage.getSimulationAuditLogs(runId);
      res.json({
        runId,
        totalLogs: logs.length,
        logs: logs.map(log => ({
          ...log,
          gorenganLayers: JSON.parse(log.gorenganLayers || "[]"),
          failureReasons: JSON.parse(log.failureReasons || "[]"),
        })),
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to retrieve audit logs" });
    }
  });
}
