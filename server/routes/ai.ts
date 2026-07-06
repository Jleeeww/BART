import type { Express } from "express";
import Anthropic from "@anthropic-ai/sdk";
import { storage } from "../storage";
import { computeDetailFields, type BandarmologyDetailInput } from "../engine/bandarmologyDetail";
import { computeGorenganFromStock } from "../engine/gorenganDetector";
import { computeStockReadiness } from "../engine/stockReadiness";
import { mapStockDataToInput, getStockDecision } from "../engine/unifiedDecision";
import { retrieveContext, buildRetrievalQuery } from "../engine/ragEngine";

// ─── Claude web-search client (initialised once, null if no API key) ──────────
const anthropicClient = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null;

// ─── Per-symbol AI analysis cache (15-min TTL) ────────────────────────────────
const aiAnalysisCache = new Map<string, { text: string; timestamp: number }>();
const AI_CACHE_TTL = 15 * 60 * 1000;

// ─── Per-IP rate limits for /api/ai ──────────────────────────────────────────
const AI_RATE_LIMIT_HOURLY = 10;
const AI_RATE_LIMIT_DAILY  = 30;
const _ipHourly = new Map<string, { count: number; windowStart: number }>();
const _ipDaily  = new Map<string, { count: number; date: string }>();

function todayUTCDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function checkAndIncrementIpLimit(ip: string): { allowed: boolean; reason?: string } {
  const now = Date.now();
  const today = todayUTCDate();

  // Hourly window (rolling)
  const hourly = _ipHourly.get(ip);
  if (hourly && now - hourly.windowStart < 3_600_000) {
    if (hourly.count >= AI_RATE_LIMIT_HOURLY) {
      return { allowed: false, reason: `Rate limit: max ${AI_RATE_LIMIT_HOURLY} AI calls per hour` };
    }
    hourly.count++;
  } else {
    _ipHourly.set(ip, { count: 1, windowStart: now });
  }

  // Daily cap
  const daily = _ipDaily.get(ip);
  if (daily && daily.date === today) {
    if (daily.count >= AI_RATE_LIMIT_DAILY) {
      return { allowed: false, reason: `Rate limit: max ${AI_RATE_LIMIT_DAILY} AI calls per day` };
    }
    daily.count++;
  } else {
    _ipDaily.set(ip, { count: 1, date: today });
  }

  return { allowed: true };
}

export function registerAiRoutes(app: Express): void {
  app.post("/api/ai", async (req, res) => {
    // Per-IP rate limit check
    const clientIp = (req.headers['x-forwarded-for'] as string ?? req.socket.remoteAddress ?? 'unknown').split(',')[0].trim();
    const rateCheck = checkAndIncrementIpLimit(clientIp);
    if (!rateCheck.allowed) {
      return res.status(429).json({ error: rateCheck.reason });
    }

    const payload = req.body;

    // Look up stock to get consistent readinessScore and actionGuidance
    const stockSymbol = payload.stock as string;
    const stockData = await storage.getStockBySymbol(stockSymbol);
  
    // ═══════════════════════════════════════════════════════════
    // BANDARMOLOGY INTELLIGENCE ENGINE (Single Entry Point)
    // All intelligence computed via computeDetailFields()
    // ═══════════════════════════════════════════════════════════
    const flowSignals = payload.flow_signals || {};
    const priceContext = payload.price_context || {};
    let brokerArr: any[] = [];
    try {
      if (payload.broker_data) {
        brokerArr = Array.isArray(payload.broker_data) ? payload.broker_data : JSON.parse(payload.broker_data);
      } else if (stockData?.brokerData) {
        brokerArr = typeof stockData.brokerData === "string" ? JSON.parse(stockData.brokerData) : stockData.brokerData;
      }
    } catch { brokerArr = []; }

    const bandarmologyInput: BandarmologyDetailInput = {
      flowBias:         flowSignals.flow_bias       || stockData?.flowBias       || "Netral",
      flowIntensity:    flowSignals.flow_intensity   || stockData?.flowIntensity  || "",
      flowReliability:  flowSignals.flow_reliability || stockData?.flowReliability || "Sedang",
      netForeignBuyIdr: flowSignals.net_foreign_buy_idr || 0,
      netDomesticBuyIdr: flowSignals.net_domestic_buy_idr || 0,
      buyAvg:           flowSignals.buy_avg_price   || 0,
      sellAvg:          flowSignals.sell_avg_price  || 0,
      lastPrice:        priceContext.last_price     || 0,
      brokerData:       brokerArr,
      foreignActivityData: stockData?.foreignActivityData || "{}",
      changePercent:    parseFloat(String(stockData?.changePercent || payload.changePercent || "0")),
      growth:           parseFloat(String(stockData?.growth || "0")),
      insiderData:      stockData?.insiderData      || null,
      stockCharacter:   stockData?.stockCharacter   || null,
      eventType:        payload.event_specifics?.event_type || ""
    };
    const intel = computeDetailFields(bandarmologyInput);

    const score = intel.flowQualityScore;
    const brokerStabilityScore = intel.brokerStabilityScore;
    const brokerControlScore = intel.brokerControlScore;
    const earlyDistributionFlag = intel.earlyDistributionFlag;
    const earlyDistributionExplanation = intel.earlyDistributionExplanation;
    const tapeControlFlag = intel.tapeControlFlag;
    const tapeControlExplanation = intel.tapeControlExplanation;
    const brokerInsights = intel.brokerInsights;
    const marketMode = intel.marketMode;
    const marketModeExplanation = intel.marketModeExplanation;
    const convictionPhase = intel.convictionPhase;
    const convictionExplanation = intel.convictionExplanation;
    const smartMoneyIntent = intel.smartMoneyIntent;
    const currentPhaseLabel = intel.currentPhaseLabel;
    const bandarHeatmap = intel.bandarHeatmap;
    const phaseTimeline = intel.phaseTimeline;
    const bandarPhaseInterpretation = intel.bandarPhaseInterpretation;
    const trapDetection = intel.trapDetection;
    const decisionEngine = intel.decisionEngine;
    const controlQualityScore = intel.controlQualityScore;
    const insiderBandarAlignment = intel.insiderBandarAlignment;
    const simplifiedRisk = intel.simplifiedRisk;
    const smartMoneyReadinessScore = intel.smartMoneyReadinessScore;
    const interpretation = intel.flowQualityInterpretation;
  

    // ========================================
    // ACTION GUIDANCE MODE (UNIFIED BRAIN)
    // Uses getStockDecision() — single source of truth
    // Same function used by homepage /api/stocks
    // ========================================
    const actionGuidance = (() => {
      const flowBias = stockData?.flowBias || payload.flow_signals.flow_bias || "Netral";
      const flowIntensity = stockData?.flowIntensity || payload.flow_signals.flow_intensity || "";
      const flowReliabilityValue = stockData?.flowReliability || payload.flow_signals.flow_reliability || "Sedang";

      // GORENGAN DETECTOR
      const gorenganResult = computeGorenganFromStock({
        symbol: stockSymbol,
        changePercent: String(stockData?.changePercent || "0"),
        flowBias,
        flowIntensity,
        flowReliability: flowReliabilityValue,
        brokerData: stockData?.brokerData || "[]",
        foreignActivityData: stockData?.foreignActivityData || "{}",
        stockCharacter: stockData?.stockCharacter
      });

      // MAP to unified brain input (same function as homepage)
      const brainInput = mapStockDataToInput({
        flowBias,
        flowIntensity,
        flowReliability: flowReliabilityValue,
        changePercent: stockData?.changePercent,
        growth: stockData?.growth,
        insiderData: stockData?.insiderData,
        brokerData: stockData?.brokerData,
        foreignActivityData: stockData?.foreignActivityData,
        stockCharacter: stockData?.stockCharacter,
        isGorengan: gorenganResult.isGorengan,
      });

      // GET DECISION from unified brain
      const decision = getStockDecision(brainInput);

      // Derive insider alignment for confidence
      const insiderStatus = insiderBandarAlignment.status;
      const insiderAlignment = insiderStatus === "Selaras" ? 80 : insiderStatus === "Netral" ? 50 : 20;

      const riskLevel = simplifiedRisk.level;
      const isHighRisk = riskLevel === "Tinggi" || riskLevel === "Sangat Tinggi";
      const flowQualityScore = score;

      // CONFIDENCE LAYER
      let confidence: "Tinggi" | "Sedang" | "Rendah";
      let confidenceReason: string;

      const signalAlignment = {
        readinessHigh: decision.readiness >= 70,
        regimePositive: decision.action === "BUY" || decision.action === "WATCHLIST",
        riskLow: !isHighRisk,
        flowStrong: flowQualityScore >= 60,
        insiderAligned: insiderAlignment >= 60
      };

      const alignedCount = Object.values(signalAlignment).filter(Boolean).length;
      const hasContradiction = (signalAlignment.readinessHigh && decision.action === "AVOID") ||
                               (signalAlignment.regimePositive && isHighRisk) ||
                               (decision.action === "BUY" && insiderAlignment < 40);

      if (hasContradiction) {
        confidence = "Rendah";
        confidenceReason = "Terdapat inkonsistensi antara sinyal-sinyal utama yang memerlukan kewaspadaan tambahan.";
      } else if (alignedCount >= 4) {
        confidence = "Tinggi";
        confidenceReason = "Sebagian besar sinyal utama saling mendukung dan konsisten.";
      } else if (alignedCount >= 2) {
        confidence = "Sedang";
        confidenceReason = "Beberapa sinyal mendukung namun belum sepenuhnya selaras.";
      } else {
        confidence = "Rendah";
        confidenceReason = "Sinyal-sinyal utama belum menunjukkan konsistensi yang cukup.";
      }

      const primaryActionLabel = {
        AKUMULASI_BERTAHAP: "Layak Akumulasi",
        WATCHLIST_PRIORITAS: "Tunggu Konfirmasi",
        HINDARI_DULU: "Hindari Entry Baru",
      }[decision.actionState] || "Hindari Entry Baru";

      const statusColor = decision.color as "green" | "yellow" | "red" | "gray";

      const homepageBucket = decision.bucket === "Siap Dipantau" ? "siap_dipantau" as const
        : decision.bucket === "Watchlist Prioritas" ? "watchlist_prioritas" as const
        : "hindari_dulu" as const;

      return {
        primaryAction: decision.actionState,
        primaryActionLabel,
        combinedStatus: decision.actionState,
        statusLabel: decision.bucket,
        statusColor,
        isWatchlistPriority: decision.actionState === "WATCHLIST_PRIORITAS",
        shortSummary: decision.shortSummary,
        confidence,
        confidenceReason,
        expandedExplanation: {
          whyAction: decision.whyAction,
          mainRisk: decision.mainRisk,
          failureTrigger: decision.failureTrigger
        },
        homepageBucket,
        isGorengan: gorenganResult.isGorengan,
        gorenganWarning: gorenganResult.isGorengan ? "Aktivitas spekulatif ritel terdeteksi" : null,
        gorenganDetails: gorenganResult.isGorengan ? gorenganResult.layerDetails : [],
        riskOverride: gorenganResult.riskOverride,
        _debug: {
          readinessScore: decision.readiness,
          regime: decision.marketRegime,
          riskLevel,
          flowQuality: flowQualityScore,
          unifiedState: decision.actionState,
          gorenganTriggeredLayers: gorenganResult.triggeredLayers
        }
      };
    })();

    // CANONICAL COMPOSITE — gorengan + decision + M17 + compositeV3 in one call
    const aiReadiness = computeStockReadiness({
      symbol:              stockSymbol,
      sector:              stockData?.sector ?? null,
      changePercent:       stockData?.changePercent ?? null,
      flowBias:            stockData?.flowBias ?? null,
      flowIntensity:       stockData?.flowIntensity ?? null,
      flowReliability:     stockData?.flowReliability ?? null,
      brokerData:          stockData?.brokerData ?? null,
      foreignActivityData: stockData?.foreignActivityData ?? null,
      stockCharacter:      stockData?.stockCharacter ?? null,
      insiderData:         stockData?.insiderData ?? null,
      growth:              stockData?.growth ?? null,
      peRatio:             stockData?.peRatio ?? null,
      dividendYield:       stockData?.dividendYield ?? null,
      roe:                 stockData?.roe ?? null,
      netMargin:           stockData?.netMargin ?? null,
      marketCap:           stockData?.marketCap ?? null,
      avg20dValue:         (stockData as any)?.avg20dValue ?? null,
    });
    actionGuidance._debug.readinessScore = aiReadiness.compositeScore;

    // Expose layer detail for smartMoneyReadinessScore response
    const valuationLabelForResponse: string | null = null;
    const qualityLabelForResponse:   string | null = null;
    const newsModifierForResponse:   number | null = null;
    const newsIsHardOverride = aiReadiness.macroHardCap;
    const activeNewsContext:  string[] = [];
    const mgmtModifierForResponse:   number | null = null;
    const mgmtHindariOverride = aiReadiness.hardOverride === 'MANAGEMENT_CRITICAL';
    const mgmtQualityLabel:   string | null = aiReadiness.layers.management.score !== null
      ? (aiReadiness.layers.management.score >= 70 ? 'KUAT'
        : aiReadiness.layers.management.score >= 40 ? 'SEDANG' : 'LEMAH')
      : null;

    // ========================================
    // SMART NEWS FILTER ENGINE
    // Classifies news into Fundamental, Sentiment, or Noise
    // ========================================
    const smartNewsFilter = (() => {
      // Sample news items to classify (in production, would come from news API)
      const rawNews = [
        {
          id: "n1",
          headline: "BBCA Catat Pertumbuhan Laba Bersih 12% YoY di Q3 2025",
          date: "2025-12-22",
          source: "IDX News"
        },
        {
          id: "n2",
          headline: "Bank Indonesia Pertahankan Suku Bunga Acuan di Level 5.75%",
          date: "2025-11-15",
          source: "Bisnis Indonesia"
        },
        {
          id: "n3",
          headline: "Aplikasi Digital BBCA Capai 30 Juta Pengguna Aktif",
          date: "2025-12-05",
          source: "TechDaily"
        },
        {
          id: "n4",
          headline: "Analis Goldman Sachs Pertahankan Rating Overweight untuk BBCA",
          date: "2025-12-18",
          source: "Bloomberg"
        },
        {
          id: "n5",
          headline: "BBCA Raih Penghargaan Bank Terbaik Versi Majalah Finance",
          date: "2025-12-01",
          source: "Kompas"
        },
        {
          id: "n6",
          headline: "Volume Transaksi Digital Banking Meningkat 40% di Q3",
          date: "2025-12-10",
          source: "Kontan"
        },
        {
          id: "n7",
          headline: "Rumor Akuisisi Fintech oleh BBCA Beredar di Pasar",
          date: "2025-12-15",
          source: "Media Sosial"
        },
        {
          id: "n8",
          headline: "BBCA Tetap Jadi Saham Favorit Investor Asing",
          date: "2025-12-20",
          source: "Investor Daily"
        }
      ];

      // Classification function
      const classifyNews = (headline: string): { 
        category: "fundamental" | "sentiment" | "noise";
        aiInterpretation: string;
        contextTag: string;
      } => {
        const headlineLower = headline.toLowerCase();
      
        // Category A: Fundamental-Changing News
        const fundamentalKeywords = [
          "laba bersih", "laporan keuangan", "pendapatan", "right issue",
          "akuisisi", "divestasi", "restrukturisasi", "regulasi baru",
          "capex", "ekspansi", "merger", "obligasi", "utang", "kredit macet",
          "npm", "nim", "roa", "roe", "car", "ldr"
        ];
      
        if (fundamentalKeywords.some(kw => headlineLower.includes(kw))) {
          return {
            category: "fundamental",
            aiInterpretation: "Berita ini berpotensi memengaruhi prospek jangka menengah hingga panjang karena berdampak langsung pada struktur keuangan atau kemampuan menghasilkan laba.",
            contextTag: "Berpotensi memengaruhi valuasi"
          };
        }
      
        // Category B: Sentiment/Flow News
        const sentimentKeywords = [
          "rating", "rekomendasi", "analis", "suku bunga", "bank indonesia",
          "makro", "sentimen", "asing", "rotasi", "sektor", "kebijakan",
          "investor", "favorit", "volume", "transaksi"
        ];
      
        if (sentimentKeywords.some(kw => headlineLower.includes(kw))) {
          return {
            category: "sentiment",
            aiInterpretation: "Berita ini lebih berpengaruh terhadap sentimen dan psikologi pasar. Dampaknya cenderung bersifat sementara dan bergantung pada respons pelaku institusi.",
            contextTag: "Dapat memengaruhi volatilitas jangka pendek"
          };
        }
      
        // Category C: Noise (filtered by default)
        return {
          category: "noise",
          aiInterpretation: "Informasi ini tidak memiliki dampak struktural yang signifikan terhadap fundamental maupun perilaku institusi.",
          contextTag: "Tidak berdampak pada struktur kampanye bandar"
        };
      };

      // Classify all news
      const classifiedNews = rawNews.map(news => {
        const classification = classifyNews(news.headline);
      
        // Generate specific interpretation based on headline content
        let specificInterpretation = classification.aiInterpretation;
        let specificContextTag = classification.contextTag;
      
        // Customize interpretations for specific headlines
        if (news.headline.includes("Laba Bersih")) {
          specificInterpretation = "Pertumbuhan laba 12% YoY mengindikasikan keberlanjutan leverage operasional. Hasil ini dapat memengaruhi ekspektasi valuasi jangka menengah.";
          specificContextTag = "Berpotensi memperkuat tesis valuasi";
        } else if (news.headline.includes("Suku Bunga")) {
          specificInterpretation = "Kebijakan suku bunga acuan dapat memengaruhi margin perbankan. Stabilitas suku bunga cenderung mendukung prediktabilitas pendapatan bunga bersih.";
          specificContextTag = "Dapat memengaruhi ekspektasi NIM";
        } else if (news.headline.includes("Analis Goldman")) {
          specificInterpretation = "Rekomendasi analis internasional dapat memengaruhi aliran dana asing jangka pendek. Dampaknya bergantung pada respons pelaku institusi lainnya.";
          specificContextTag = "Dapat memicu respons pelaku asing";
        } else if (news.headline.includes("Digital Banking") || news.headline.includes("Aplikasi Digital")) {
          specificInterpretation = "Pertumbuhan pengguna digital mencerminkan transformasi operasional, namun dampak ke profitabilitas memerlukan validasi lebih lanjut.";
          specificContextTag = "Mendukung narasi transformasi digital";
        } else if (news.headline.includes("Rumor")) {
          specificInterpretation = "Informasi ini belum terkonfirmasi dan berasal dari sumber tidak resmi. Tidak direkomendasikan sebagai dasar analisis.";
          specificContextTag = "Tidak dapat diverifikasi";
        } else if (news.headline.includes("Penghargaan")) {
          specificInterpretation = "Penghargaan bersifat simbolis dan tidak memiliki dampak langsung terhadap fundamental atau perilaku institusi.";
          specificContextTag = "Tidak berdampak pada valuasi";
        }
      
        // Check if news contradicts flow analysis
        const flowContradictionNote = score < 40 && classification.category === "fundamental" 
          ? " Respons pasar terhadap berita ini masih terbatas dan belum tercermin dalam perilaku bandar."
          : "";
      
        return {
          ...news,
          category: classification.category,
          categoryLabel: classification.category === "fundamental" 
            ? "Berpengaruh ke Fundamental"
            : classification.category === "sentiment"
              ? "Mempengaruhi Sentimen Pasar"
              : "Informasi Tidak Signifikan",
          aiInterpretation: specificInterpretation + flowContradictionNote,
          contextTag: specificContextTag
        };
      });

      // Count by category
      const fundamentalCount = classifiedNews.filter(n => n.category === "fundamental").length;
      const sentimentCount = classifiedNews.filter(n => n.category === "sentiment").length;
      const noiseCount = classifiedNews.filter(n => n.category === "noise").length;

      // Summary text
      const summaryText = `${fundamentalCount} berita fundamental • ${sentimentCount} berita sentimen • ${noiseCount} berita disaring`;

      return {
        summary: {
          fundamentalCount,
          sentimentCount,
          noiseCount,
          summaryText
        },
        news: classifiedNews,
        // Architecture hooks for future features (not implemented yet)
        _futureHooks: {
          newsVsBandarReaction: null,
          newsAbsorptionTracking: null,
          newsImpactDecay: null
        }
      };
    })();

    // ────────────────────────────────────────────────────────────
    // CLAUDE WEB SEARCH ENRICHMENT
    // Adds real-time news & macro context to the analysis.
    // Uses 15-min in-memory cache per symbol to control API cost.
    // Non-critical: failures return null, never block the response.
    // ────────────────────────────────────────────────────────────
    let webSearchAnalysis: string | null = null;

    const wssCacheKey = stockSymbol;
    const wssCached = aiAnalysisCache.get(wssCacheKey);

    if (wssCached && Date.now() - wssCached.timestamp < AI_CACHE_TTL) {
      webSearchAnalysis = wssCached.text;
    } else if (anthropicClient) {
      try {
        const sector = stockData?.sector ?? 'Unknown';
        const readiness = actionGuidance._debug.readinessScore;
        const decision = actionGuidance.primaryAction;
        const flowBias = stockData?.flowBias ?? 'Netral';

        // Retrieve relevant historical context from RAG knowledge base
        const ragDocs = await retrieveContext(
          buildRetrievalQuery(stockSymbol, `${sector} ${decision} ${flowBias}`),
          stockSymbol,
          5
        );
        const historicalCtx = ragDocs.length > 0
          ? `\n\nKONTEKS HISTORIS BART:\n${ragDocs.map((d) => `[${d.type}] ${d.content}`).join('\n\n')}`
          : '';

        const wssResponse = await Promise.race<Anthropic.Message>([
          anthropicClient.messages.create({
            model: "claude-sonnet-4-5",
            max_tokens: 1000,
            tools: [
              {
                type: "web_search_20250305" as "web_search_20250305",
                name: "web_search",
                max_uses: 3,
              } as any,
            ],
            system: `Kamu adalah BART — sistem intelijen trading institusional untuk pasar saham IDX Indonesia. Kamu menganalisis saham untuk trader ritel Indonesia dengan horizon trading 5-60 sesi.

  PENTING: Kamu BUKAN memberikan rekomendasi beli/jual. Kamu memberikan analisis konteks dan panduan berpikir.

  Saat menganalisis saham:
  1. Gunakan web search untuk mencari berita terbaru tentang saham ini
  2. Cari kondisi makro terkini yang mempengaruhi sektor saham ini
  3. Cari apakah ada perubahan regulasi atau peringkat yang relevan
  4. Gunakan data dari BART engine sebagai foundation analisis
  5. Integrasikan semua konteks untuk analisis komprehensif

  Search domains yang dipercaya:
  idx.co.id, ojk.go.id, bi.go.id, kontan.co.id, bisnis.com,
  cnbcindonesia.com, tempo.co, reuters.com, bloomberg.com

  Selalu nyatakan sumber informasi yang kamu temukan dari web search.
  Jika ada konflik antara berita terbaru dan data engine BART,
  prioritaskan konteks makro terbaru.${historicalCtx}`,
            messages: [
              {
                role: "user",
                content: `Analisis saham ${stockSymbol} (${stockData?.name ?? stockSymbol}) di sektor ${sector}.

  Data BART Engine:
  - Skor kesiapan: ${readiness}/100
  - Keputusan engine: ${decision}
  - Aliran dana: ${flowBias} (${stockData?.flowIntensity ?? ''})
  - P/E Ratio: ${stockData?.peRatio ?? 'N/A'}
  - ROE: ${stockData?.roe ?? 'N/A'}%
  - Net Margin: ${stockData?.netMargin ?? 'N/A'}%

  Tolong cari berita terbaru dan konteks makro untuk saham ini, lalu berikan analisis singkat (3-4 paragraf) yang mengintegrasikan temuan web search dengan data engine BART di atas. Fokus pada: (1) berita atau event terbaru yang relevan, (2) kondisi sektor saat ini, (3) implikasi untuk trader jangka menengah.`,
              },
            ],
          }),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error("AI analysis timeout")), 30000)
          ),
        ]);

        const fullText = wssResponse.content
          .filter((block) => block.type === "text")
          .map((block) => (block.type === "text" ? block.text : ""))
          .join("\n")
          .trim();

        if (fullText) {
          webSearchAnalysis = fullText;
          aiAnalysisCache.set(wssCacheKey, { text: fullText, timestamp: Date.now() });
        }

        // Record cost
        const inputTok  = (wssResponse as any).usage?.input_tokens  ?? 1500;
        const outputTok = (wssResponse as any).usage?.output_tokens ?? 1000;
        const searches  = wssResponse.content.filter(
          (b: any) => b.type === 'tool_use' && b.name === 'web_search'
        ).length;
        const { recordCost: rc } = await import('../engine/costTracker');
        rc('chat', inputTok, outputTok, searches);

      } catch (wssErr) {
        console.error("[/api/ai] Claude web search error:", wssErr);
        webSearchAnalysis = null;
      }
    }

    // Structured analyst-style response without buy/sell signals
    res.json({
      // Decision Engine (Part A)
      decisionEngine,
    
      // Control & Regime (Part B)
      controlQualityScore,
      marketMode,
      marketModeExplanation,
      marketModeConfidence: score > 70 ? "Tinggi" : score > 50 ? "Sedang" : "Rendah",
    
      // Existing flow data
      flow_analysis: `Aktivitas institusional untuk ${payload.stock} menunjukkan ${payload.flow_signals.flow_intensity} ${payload.flow_signals.flow_bias} dengan reliabilitas ${payload.flow_signals.flow_reliability}. Posisi berbasis luas didukung oleh partisipasi tersinkronisasi dari sumber institusi domestik dan asing.`,
      flowQualityScore: score,
      flowQualityInterpretation: interpretation,
      earlyDistributionFlag,
      earlyDistributionExplanation,
      tapeControlFlag,
      tapeControlExplanation,
      brokerInsights,
      brokerControlScore,
      brokerStabilityScore,
      convictionPhase,
      convictionExplanation,
      smartMoneyIntent,
      bandarHeatmap,
      phaseTimeline,
      bandarPhaseInterpretation,
      trapDetection,
    
      // Simplified Risk (Part C)
      simplifiedRisk,
    
      // Insider-Bandar Alignment (Part D)
      insiderBandarAlignment,
    
      // Smart Money Readiness Score (Core Intelligence) — Composite v3
      smartMoneyReadinessScore: {
        ...smartMoneyReadinessScore,
        score:              aiReadiness.compositeScore,
        compositeV3:        aiReadiness.layers,
        hardOverride:       aiReadiness.hardOverride,
        macroHardCap:       aiReadiness.macroHardCap,
        activeWeightSum:    aiReadiness.activeWeightSum,
        // legacy fields (kept for API compatibility)
        valuationModifier:  valuationLabelForResponse,
        valuationLabel:     valuationLabelForResponse,
        qualityLabel:       qualityLabelForResponse,
        newsModifier:       newsModifierForResponse,
        newsIsHardOverride,
        activeNewsContext,
        managementModifier: mgmtModifierForResponse,
        managementHindari:  mgmtHindariOverride,
        managementQuality:  mgmtQualityLabel,
      },
    
      // Action Guidance Mode (Decision Layer)
      actionGuidance,
    
      // Smart News Filter (Contextual Intelligence)
      smartNewsFilter,

      // Claude Web Search Analysis (real-time enrichment)
      webSearchAnalysis,

      event_analysis: {
        impact: "Sedang",
        relevance: "Struktural",
        thesis: `${payload.event_specifics?.event_type ?? 'Event'} (${payload.event_specifics?.headline ?? 'N/A'}) konsisten dengan tren operasional yang diamati. Meski peningkatan efisiensi struktural terlihat, sensitivitas makro tetap menjadi variabel utama untuk persistensi valuasi.`,
        confidence: "Tinggi",
        conditions: "Persistensi tesis mengasumsikan stabilitas permintaan kredit domestik dan tidak ada kontraksi signifikan pada Net Interest Margin (NIM) yang berlaku."
      },
      risk_analysis: `Risiko utama untuk ${payload.stock} berpusat pada de-rating yang didorong makro dan potensi kompresi NIM jika persaingan deposito meningkat. Kualitas aset yang ada memberikan bantalan defensif, meski premi valuasi tetap sensitif terhadap perlambatan pertumbuhan.`
    });
  });
}
