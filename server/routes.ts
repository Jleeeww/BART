import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  // Seed data check (simple check on startup)
  try {
    const existing = await storage.getStockBySymbol("BBCA");
    if (!existing) {
      await storage.createStock({
        symbol: "BBCA",
        name: "Bank Central Asia Tbk",
        price: "11,250",
        change: "50",
        changePercent: "0.45",
        summary: "Bank Central Asia (BBCA) continues to demonstrate structural resilience with a 12% YoY net profit growth in Q3 2025. This performance is underpinned by robust Net Interest Income (NII) expansion and maintained cost discipline, further solidified by a strong capital adequacy ratio.",
        description: "Bank Central Asia (BBCA) is the largest private bank in Indonesia, serving as a primary pillar of the nation's financial infrastructure. Its business model focuses on transactional banking and a dominant position in low-cost funding (CASA), providing it with a unique competitive advantage in the Indonesian banking sector.",
        sector: "Financials",
        subsector: "Banks",
        marketCap: "1,385.4T IDR",
        peRatio: "24.2",
        dividendYield: "2.1%",
        roe: "15.8",
        netMargin: "28.4",
        growth: "12.0",
        investorView: "Investors prioritize BBCA for its exceptional asset quality and dominance in transactional banking. Its ability to maintain high margins and consistent growth even during macro shifts makes it a core defensive asset in Indonesian equity portfolios.",
        financialSummary: "The Q3 2025 results show a consistent upward trajectory in revenue and net profit, driven by operational efficiency and favorable credit conditions. The bank's strong balance sheet and capital position allow for sustained dividend distributions while supporting credit expansion.",
        revenue2023: "94.5T IDR",
        revenue2024: "105.2T IDR",
        revenue2025: "117.8T IDR",
        netProfit2023: "48.6T IDR",
        netProfit2024: "54.4T IDR",
        netProfit2025: "60.9T IDR",
        assets2023: "1,350.2T IDR",
        assets2024: "1,425.4T IDR",
        assets2025: "1,505.8T IDR",
        liabilities2023: "780.3T IDR",
        liabilities2024: "825.4T IDR",
        liabilities2025: "878.6T IDR",
        ocf2023: "28.5T IDR",
        ocf2024: "31.2T IDR",
        ocf2025: "34.7T IDR",
        tradingActivitySummary: "Trading activity on Dec 22, 2025, showed a volume increase to 1.2x average, with synchronized accumulation from both domestic (130.4B IDR) and foreign (92.8B IDR) institutional participants.",
        flowOverviewSummary: "Market participants exhibited synchronized accumulation on Dec 22, 2025, following the quarterly earnings release. The net inflow of 223.2B IDR was supported by both foreign and domestic institutional sources, with the top 3 brokers accounting for 41.2% of total volume, indicating concentrated institutional interest.",
        flowBias: "Accumulation",
        flowIntensity: "Moderate Accumulation",
        flowReliability: "High",
        brokerData: JSON.stringify([
          { code: "BK", name: "PT Mandiri Sekuritas", netBuy: "125.5B IDR", netSell: null, volumePercent: "12.4%", avgBuy: "9,540", avgSell: "9,530" },
          { code: "BNI", name: "PT BNI Securities", netBuy: "98.2B IDR", netSell: null, volumePercent: "9.8%", avgBuy: "9,545", avgSell: "9,535" },
          { code: "CIMB", name: "PT CIMB Securities", netBuy: "72.3B IDR", netSell: null, volumePercent: "7.2%", avgBuy: "9,542", avgSell: "9,532" },
          { code: "MBK", name: "PT Maybank Kim Eng", netBuy: null, netSell: "45.3B IDR", volumePercent: "8.7%", avgBuy: "9,548", avgSell: "9,538" },
          { code: "BHS", name: "PT Bahana Securities", netBuy: null, netSell: "28.4B IDR", volumePercent: "6.5%", avgBuy: "9,550", avgSell: "9,540" }
        ]),
        foreignActivityData: JSON.stringify({
          foreignBuy: "185.2B IDR",
          foreignSell: "92.4B IDR",
          netForeignFlow: "92.8B IDR",
          domesticBuy: "450.7B IDR",
          domesticSell: "320.3B IDR",
          foreignPercent: 22,
          domesticPercent: 78
        }),
        avgBuyPrice: "9,542 IDR",
        avgSellPrice: "9,538 IDR",
        newsOverviewSummary: "The Q3 2025 earnings release is the primary driver of current sentiment, confirming the bank's operational resilience. Headline net profit growth of 12% YoY aligns with long-term structural trends, while maintained asset quality mitigates immediate credit risk concerns.",
        newsImpact: "Medium",
        newsRelevance: "Structural",
        newsFeed: JSON.stringify([
          { headline: "BBCA Reports 12% YoY Net Profit Growth in Q3 2025", date: "2025-12-22", source: "IDX News", impact: "Structural" },
          { headline: "Bank Indonesia Maintains Policy Rate, Positive for Banking Margins", date: "2025-11-15", source: "Business Times", impact: "Structural" },
          { headline: "BBCA Digital App Reaches 30 Million Active Users", date: "2025-12-05", source: "TechDaily", impact: "Temporary" }
        ]),
        corporateActions: JSON.stringify([
          { type: "Earnings Release", date: "2025-12-22", status: "Completed", explanation: "Official reporting of Q3 2025 results showing 12% profit expansion." },
          { type: "Cash Dividend", date: "2025-04-10", status: "Completed", explanation: "Distributed IDR 205 per share, reflecting strong capital position." }
        ]),
        investorInterpretation: "The Q3 results validate the thesis of superior operational leverage. Investors should note the synchronization of foreign and domestic flows (net total 223.2B IDR) as a signal of broad-based institutional support post-earnings.",
        eventAnalysis: JSON.stringify([
          {
            title: "Q3 2025 Earnings Report",
            event: "Bank Central Asia (BBCA) reported a 12% year-over-year increase in net profit for the third quarter of 2025.",
            why: "Drivers include NII expansion, sustained cost discipline, and stable asset quality metrics despite global macro headwinds.",
            immediate: "0.45% price appreciation on 1.2x average volume, indicating a firm positive absorption of results by the market.",
            secondOrder: "Reinforcement of the 'flight-to-quality' trade in Indonesian financials. BBCA's funding dominance (CASA) likely to strengthen as smaller peers face higher liquidity costs.",
            thesis: "Positive. Confirms structural growth and operational efficiency milestones.",
            confidence: "High",
            conditions: "Thesis assumes continued stability in domestic credit demand. Invalidation would involve a sharp uptick in NPLs or unexpected regulatory caps on Net Interest Margins."
          }
        ]),
        financialsAnalystView: "ROE of 15.8% and Net Margin of 28.4% reflect a high level of profitability and efficiency. The structural advantage lies in the bank's ability to maintain these metrics while growing the loan book by 12% YoY, supported by a Strong capital adequacy position.",
        flowAnalystView: "Dec 22 flow was characterized by a healthy 1.2x volume spike and net accumulation of 223.2B IDR. The High reliability of this flow is supported by the tight 4 IDR spread between buy (9542) and sell (9538) average prices, suggesting efficient institutional execution.",
        riskAnalystView: "While capital adequacy is 'Strong', the primary risk remains valuation-driven de-rating if profit growth falls below the 10-12% range. Macro-sensitivity to BI rate decisions remains the most significant external uncertainty.",
        riskData: JSON.stringify({
          overview: "BBCA maintains a conservative risk profile characterized by high capital adequacy and superior asset quality.",
          level: "Moderate",
          skew: "Balanced",
          primaryRisks: [
            { title: "NIM Compression", why: "Potential for funding cost increases if deposit competition intensifies.", likelihood: "Medium", impact: "High" },
            { title: "Macro Slowdown", why: "Deceleration in Indonesian GDP would directly impact credit demand.", likelihood: "Low", impact: "Very High" }
          ],
          contrarianRisks: [
            { title: "Institutional Concentration", why: "High institutional ownership makes the stock a proxy for EM sentiment shifts.", material: "Simultaneous EM fund redemptions.", affected: "Long-term institutional holders." }
          ],
          tension: "Trading at a premium for operational certainty; investors trade potential capital gains for high reliability and defensive characteristics.",
          invalidation: [
            "Net Interest Margin contraction below 5.0%.",
            "Sustained NPL spike above 3.0%.",
            "Loss of CASA dominance (CASA ratio < 70%)."
          ],
          investorFit: {
            suitable: "Conservative institutional and retail investors seeking proxies for Indonesia's economy with lower volatility.",
            unsuitable: "Investors seeking high-beta growth or undervalued assets with significant turnaround potential."
          }
        }),
        insiderData: JSON.stringify({
          alignmentScore: 78,
          overview: "Transaksi insider BBCA dalam 12 bulan terakhir menunjukkan pola akumulasi yang konsisten dari manajemen senior. Direktur Utama dan CFO tercatat melakukan pembelian signifikan pasca pengumuman dividen, mengindikasikan keyakinan internal terhadap prospek fundamental perusahaan.",
          totalBuy: "45.2M IDR",
          totalSell: "12.8M IDR",
          netFlow: "+32.4M IDR",
          buyPercent: 78,
          sellPercent: 22,
          signalStrength: "Kuat",
          aiInterpretation: "Pola transaksi insider mengindikasikan keyakinan manajemen yang tinggi terhadap valuasi dan prospek pertumbuhan. Pembelian terkonsentrasi pada periode pasca earning release menunjukkan bahwa manajemen melihat harga saat ini sebagai entry point yang menarik. Tidak ada pola distribusi signifikan yang terdeteksi dari pemegang saham internal utama.",
          sentimentNote: "Dominasi aktivitas beli (78%) mencerminkan sentimen positif internal. Transaksi jual yang ada umumnya terkait dengan diversifikasi portofolio pribadi dan bukan indikasi kekhawatiran fundamental.",
          transactions: [
            { name: "Jahja Setiaatmadja", position: "Presiden Direktur", type: "Beli", shares: "150,000", price: "11,200", date: "2025-12-18" },
            { name: "Vera Eve Lim", position: "Direktur", type: "Beli", shares: "75,000", price: "11,150", date: "2025-12-10" },
            { name: "Rudy Susanto", position: "Wakil Presiden Direktur", type: "Beli", shares: "100,000", price: "11,050", date: "2025-11-28" },
            { name: "Armand W. Hartono", position: "Wakil Presiden Komisaris", type: "Jual", shares: "50,000", price: "11,300", date: "2025-11-15" },
            { name: "Suwignyo Budiman", position: "Direktur", type: "Beli", shares: "60,000", price: "10,950", date: "2025-10-22" }
          ]
        }),
        aiConfidence: "High",
      });
      console.log("Seeded BBCA stock data");
    }
  } catch (e) {
    console.error("Error seeding data (might be because tables don't exist yet):", e);
  }

  app.get(api.stocks.getBySymbol.path, async (req, res) => {
    const symbol = req.params.symbol;
    const stock = await storage.getStockBySymbol(symbol);
    if (!stock) {
      return res.status(404).json({ message: "Stock not found" });
    }
    res.json(stock);
  });

  app.post("/api/ai", (req, res) => {
    const payload = req.body;
    
    // Calculate Flow Quality Score based on payload
    // broker concentration, buy avg vs close, foreign vs domestic alignment
    let score = 50; // Base score
    
    // Logic for Foreign/Domestic alignment
    if (payload.flow_signals.net_foreign_buy_idr > 0 && payload.flow_signals.net_domestic_buy_idr > 0) {
      score += 15; // Synchronized accumulation
    } else if (payload.flow_signals.net_foreign_buy_idr < 0 && payload.flow_signals.net_domestic_buy_idr < 0) {
      score -= 15; // Synchronized distribution
    }
    
    // Logic for Buy Average vs Close
    const priceContext = payload.price_context;
    const buyAvg = payload.flow_signals.buy_avg_price;
    if (buyAvg && priceContext.last_price > buyAvg) {
      score += 10; // Positive price response
    } else if (buyAvg && priceContext.last_price < buyAvg) {
      score -= 10; // Negative price response
    }
    
    // Logic for Flow Intensity
    if (payload.flow_signals.flow_intensity === "Big Accumulation") score += 15;
    if (payload.flow_signals.flow_intensity === "Big Distribution") score -= 15;
    
    // Early Distribution Detection Logic
    const signals = [];
    // 1. Positive flow but weakening price (buy avg < last price but close to it)
    if (payload.flow_signals.net_foreign_buy_idr > 0 && priceContext.last_price <= buyAvg * 1.01) {
      signals.push("Price structure weakening relative to net inflow.");
    }
    // 2. High concentration but low flow reliability/bias
    if (payload.flow_signals.flow_intensity.includes("Moderate") && payload.flow_signals.flow_reliability !== "High") {
      signals.push("Institutional concentration rising with inconsistent execution quality.");
    }
    // 3. Sell average gaining pricing power (sell avg close to buy avg)
    if (buyAvg && payload.flow_signals.sell_avg_price >= buyAvg * 0.995) {
      signals.push("Distribution average gaining pricing power over accumulation.");
    }
    // 4. Late session strength without follow-through (implied by narrative timing)
    if (payload.event_specifics.event_type === "Market Update") {
      signals.push("Narrative exhaustion detected; lack of new structural catalysts.");
    }

    const earlyDistributionFlag = signals.length >= 3;
    const earlyDistributionExplanation = earlyDistributionFlag 
      ? `Analisis menunjukkan ${signals.length} sinyal distribusi mulai muncul. Meski aliran bersih masih positif, struktur harga internal dan kekuatan jual menunjukkan fase distribusi awal. Pelaku pasar perlu waspada terhadap potensi jebakan likuiditas karena smart money tampak melakukan rotasi di tengah penguatan harga.`
      : "Struktur aliran dana saat ini masih sehat dengan partisipasi institusi yang tersinkronisasi dan eksekusi yang efisien.";

    // ─── Broker Control Score Calculation ───
    // Measures concentration of net accumulation among top brokers
    const calculateBrokerControlScore = (brokers: any[]) => {
      const positive = brokers
        .map(b => {
          // Parse netBuy/netSell values (format: "125.5B IDR")
          const buyVal = b.netBuy ? parseFloat(b.netBuy.replace(/[^\d.]/g, "")) : 0;
          const sellVal = b.netSell ? parseFloat(b.netSell.replace(/[^\d.]/g, "")) : 0;
          return { ...b, net: buyVal - sellVal };
        })
        .filter(b => b.net > 0);

      if (positive.length === 0) {
        return {
          score: 0,
          level: "Tidak Ada",
          interpretation: "Tidak terdeteksi akumulasi dari broker."
        };
      }

      positive.sort((a, b) => b.net - a.net);

      const top3 = positive.slice(0, 3).reduce((sum, b) => sum + b.net, 0);
      const total = positive.reduce((sum, b) => sum + b.net, 0);

      const brokerScore = Math.round((top3 / total) * 100);

      let level = "Konsentrasi Rendah";
      let interpretation =
        "Akumulasi tersebar di banyak broker, menunjukkan partisipasi institusi yang lebih luas dan struktur tren yang lebih sehat.";

      if (brokerScore >= 70) {
        level = "Konsentrasi Tinggi";
        interpretation =
          "Sedikit broker menguasai sebagian besar akumulasi. Ini meningkatkan probabilitas kelanjutan tren tapi juga risiko volatilitas jika mereka berbalik arah.";
      } else if (brokerScore >= 40) {
        level = "Konsentrasi Sedang";
        interpretation =
          "Akumulasi cukup terkonsentrasi. Pergerakan harga didukung institusi tapi masih bergantung pada perilaku broker utama.";
      }

      return { score: brokerScore, level, interpretation };
    };

    const brokerControlScore = calculateBrokerControlScore(payload.broker_data || []);

    // ─── Broker Stability Score Calculation ───
    // Measures whether the same brokers consistently dominate accumulation across multiple periods
    // This helps detect true operator campaigns vs temporary positioning
    const calculateBrokerStabilityScore = (currentBrokers: any[]) => {
      // Generate simulated historical data based on current broker patterns
      // In production, this would use actual historical broker flow data
      const historicalDays = 5;
      const historicalData: Array<{ date: string; brokers: Array<{ code: string; net: number }> }> = [];
      
      // Parse current broker data
      const parsedBrokers = currentBrokers.map(b => {
        const buyVal = b.netBuy ? parseFloat(b.netBuy.replace(/[^\d.]/g, "")) : 0;
        const sellVal = b.netSell ? parseFloat(b.netSell.replace(/[^\d.]/g, "")) : 0;
        return { code: b.code, net: buyVal - sellVal };
      });
      
      // Simulate historical patterns with some variance
      for (let i = 0; i < historicalDays; i++) {
        const dayBrokers = parsedBrokers.map(b => ({
          code: b.code,
          net: b.net * (0.7 + Math.random() * 0.6) // Add 30% variance
        }));
        historicalData.push({
          date: `Day-${i + 1}`,
          brokers: dayBrokers
        });
      }
      
      if (historicalData.length === 0) {
        return {
          score: 0,
          level: "Rendah" as const,
          interpretation: "Data historis tidak cukup untuk menilai stabilitas broker."
        };
      }
      
      // Step 1 & 2: For each day, identify top 3 brokers and track frequency
      const brokerAppearances: Record<string, number> = {};
      let totalTop3Slots = 0;
      
      for (const day of historicalData) {
        const positiveBrokers = day.brokers.filter(b => b.net > 0);
        positiveBrokers.sort((a, b) => b.net - a.net);
        const top3 = positiveBrokers.slice(0, 3);
        
        totalTop3Slots += top3.length;
        
        for (const broker of top3) {
          brokerAppearances[broker.code] = (brokerAppearances[broker.code] || 0) + 1;
        }
      }
      
      if (totalTop3Slots === 0) {
        return {
          score: 0,
          level: "Rendah" as const,
          interpretation: "Tidak terdeteksi pola akumulasi konsisten dalam periode yang dianalisis."
        };
      }
      
      // Step 3: Compute stability score
      // Find top recurring brokers (those appearing most frequently)
      const sortedByAppearance = Object.entries(brokerAppearances)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3);
      
      const topRecurringAppearances = sortedByAppearance.reduce((sum, [, count]) => sum + count, 0);
      const stabilityScore = Math.round((topRecurringAppearances / totalTop3Slots) * 100);
      
      // Step 4: Classify
      let level: "Rendah" | "Sedang" | "Tinggi" = "Rendah";
      let interpretation = "Kepemimpinan akumulasi berputar. Ini menunjukkan penempatan jangka pendek daripada kampanye institusional terkoordinasi.";
      
      if (stabilityScore >= 70) {
        level = "Tinggi";
        interpretation = "Broker yang sama secara konsisten mendominasi akumulasi, menandakan kampanye operator terstruktur dengan intensi berkelanjutan.";
      } else if (stabilityScore >= 40) {
        level = "Sedang";
        interpretation = "Beberapa broker aktif berulang kali, mengindikasikan minat institusional yang mulai terbentuk namun belum sepenuhnya mengendalikan.";
      }
      
      return { score: stabilityScore, level, interpretation };
    };

    const brokerStabilityScore = calculateBrokerStabilityScore(payload.broker_data || []);

    // Advanced Bandarmology Logic
    // Tape Control Detection
    const tapeControlSignals = [];
    if (priceContext.last_price > buyAvg && payload.flow_signals.flow_intensity === "Neutral") {
      tapeControlSignals.push("Mechanical price support observed during neutral organic flow.");
    }
    if (payload.flow_signals.sell_avg_price >= buyAvg * 0.998) {
      tapeControlSignals.push("Tight execution corridor suggests inventory recycling between dominant participants.");
    }
    const tapeControlFlag = tapeControlSignals.length >= 2;
    const tapeControlExplanation = tapeControlFlag 
      ? "Perilaku harga tampak didukung secara mekanis daripada organik. Kontrol tape menunjukkan fase konsolidasi inventori oleh pelaku dominan, kemungkinan untuk menstabilkan level harga saat ini."
      : "Aktivitas pasar tampak didorong oleh partisipasi institusi organik tanpa tanda-tanda signifikan pertahanan harga mekanis.";

    // Broker Classification
    const brokerInsights = (payload.broker_data || []).map((b: any) => {
      let role = "Market Maker";
      let confidence = "Medium";
      const volPct = parseFloat((b.volumePercent || "0").replace("%", ""));
      
      // Role inference based on behavior patterns
      if (b.netBuy && !b.netSell && volPct >= 8) {
        role = "Accumulator";
        confidence = "High";
      } else if (b.netSell && !b.netBuy && volPct >= 8) {
        role = "Distributor";
        confidence = "High";
      } else if (b.netBuy && !b.netSell) {
        role = "Accumulator";
      } else if (b.netSell && !b.netBuy) {
        role = "Distributor";
      } else if (volPct < 5) {
        role = "Retail Proxy";
        confidence = "Low";
      } else if (b.netBuy && b.netSell) {
        role = "Market Maker";
      }
      
      // Operator detection: high volume with tape control signals
      if (tapeControlFlag && volPct >= 10 && (role === "Accumulator" || role === "Distributor")) {
        role = "Operator";
        confidence = "High";
      }
      
      const roleDescriptions: Record<string, string> = {
        "Accumulator": "pembelian bersih konsisten dengan niat membangun posisi",
        "Distributor": "penjualan bersih dengan pola pengurangan inventori",
        "Market Maker": "aliran dua arah menyediakan likuiditas tanpa bias arah",
        "Retail Proxy": "aktivitas ritel terfragmentasi dengan karakteristik institusional terbatas",
        "Operator": "aktivitas terkoordinasi menunjukkan manajemen inventori atau stabilisasi harga"
      };
      
      return {
        brokerCode: b.code,
        inferredRole: role,
        confidenceLevel: confidence,
        roleShiftFlag: false,
        explanation: `${b.code} menunjukkan ${roleDescriptions[role] || "perilaku tidak terklasifikasi"}.`
      };
    });

    // A/D Mode Engine
    let marketMode = "Active Accumulation";
    if (earlyDistributionFlag && score < 40) marketMode = "Post-Distribution Vacuum";
    else if (earlyDistributionFlag) marketMode = "Distribution into Strength";
    else if (tapeControlFlag && score > 60) marketMode = "Stealth Accumulation";
    else if (score > 80) marketMode = "Active Accumulation";
    else if (score < 40 && payload.flow_signals.flow_bias === "Distribution") marketMode = "Passive Distribution";
    else if (score < 30) marketMode = "Post-Distribution Vacuum";
    
    let marketModeExplanation = "";
    switch(marketMode) {
      case "Stealth Accumulation": marketModeExplanation = "Pelaku dominan tampak membangun posisi secara diam-diam dengan dukungan harga mekanis. Kualitas aliran mulai terbentuk namun belum tercermin dalam penemuan harga organik."; break;
      case "Active Accumulation": marketModeExplanation = "Aktivitas institusi tersinkronisasi mendorong apresiasi harga organik. Kualitas aliran tinggi dengan partisipasi yang luas."; break;
      case "Distribution into Strength": marketModeExplanation = "Meski harga naik, struktur aliran internal menunjukkan rotasi institusional sedang berlangsung. Penguatan headline mungkin menyembunyikan distribusi yang mendasari."; break;
      case "Passive Distribution": marketModeExplanation = "Penjualan institusi terjadi tanpa penekanan harga agresif. Likuiditas diserap secara bertahap, mengurangi volatilitas langsung namun membangun risiko penurunan."; break;
      case "Post-Distribution Vacuum": marketModeExplanation = "Fase distribusi sebelumnya telah selesai. Pasar mencari level harga baru dengan dukungan institusional terbatas. Likuiditas mungkin tipis."; break;
    }

    // Conviction Timeline Inference
    let convictionPhase = "Positioning";
    if (earlyDistributionFlag || marketMode.includes("Distribution")) {
      convictionPhase = "Distribution";
    } else if (score > 80 || marketMode === "Stealth Accumulation") {
      convictionPhase = "Crowding";
    } else if (score > 60) {
      convictionPhase = "Confirmation";
    } else if (score < 30) {
      convictionPhase = "Reset";
    }

    // Base conviction explanation (will be modified by intent later)
    let convictionExplanation = "";
    switch(convictionPhase) {
      case "Positioning": convictionExplanation = "Posisi awal institusional terdeteksi. Kualitas aliran masih dini; tesis tetap spekulatif hingga partisipasi tersinkronisasi dikonfirmasi dari pelaku domestik dan asing."; break;
      case "Confirmation": convictionExplanation = "Narasi yang berlaku mendapat validasi struktural. Akumulasi tersinkronisasi dan respons harga positif menunjukkan keyakinan institusional meningkat untuk jangka menengah."; break;
      case "Crowding": convictionExplanation = "Konsensus institusional telah mencapai level tinggi. Meski aliran teknis tetap berkualitas, asimetri perdagangan bergeser karena posisi semakin terkonsentrasi."; break;
      case "Distribution": convictionExplanation = "Kualitas aliran internal memburuk. Akumulasi yang diamati tampak semakin didorong oleh partisipasi siklus akhir, sementara pemimpin institusional menunjukkan tanda rotasi struktural."; break;
      case "Reset": convictionExplanation = "Siklus sebelumnya telah selesai. Pelaku pasar saat ini mencari katalis struktural baru dan level institusional yang segar."; break;
    }

    // Clamp score 0-100
    score = Math.max(0, Math.min(100, score));
    
    let interpretation = "";
    if (score > 80) interpretation = "Keyakinan institusional luar biasa ditandai sinkronisasi tinggi antar tipe pelaku.";
    else if (score > 60) interpretation = "Pola akumulasi solid dengan reliabilitas moderat; memerlukan validasi katalis struktural berkelanjutan.";
    else if (score > 40) interpretation = "Dinamika aliran netral menunjukkan kurangnya konsensus institusional yang jelas pada level valuasi saat ini.";
    else if (score > 20) interpretation = "Bias distribusi mulai muncul; pelaku institusi tampak mengurangi eksposur selama volatilitas.";
    else interpretation = "Distribusi signifikan dari berbagai meja, menunjukkan penurunan keyakinan institusional secara luas.";

    // Smart Money Intent Engine
    const accumulatorCount = brokerInsights.filter((b: any) => b.inferredRole === "Accumulator").length;
    const distributorCount = brokerInsights.filter((b: any) => b.inferredRole === "Distributor").length;
    const operatorCount = brokerInsights.filter((b: any) => b.inferredRole === "Operator").length;
    const brokerRoleMix = accumulatorCount > distributorCount ? "Accumulator-Dominant" : 
                          distributorCount > accumulatorCount ? "Distributor-Dominant" : "Balanced";
    
    // Flow quality trend inference (simplified - based on current score position)
    const flowQualityTrend = score > 70 ? "improving" : score > 50 ? "flat" : "deteriorating";
    
    // Intent inference using multi-signal confluence
    let primaryIntent = "Inventory Building";
    let secondaryIntent: string | undefined = undefined;
    let intentConfidence: "Low" | "Medium" | "High" = "Medium";
    let intentExplanation = "";
    
    // Multi-signal confluence logic (incorporating flowQualityTrend)
    if (earlyDistributionFlag || marketMode === "Distribution into Strength") {
      primaryIntent = "Inventory Exit";
      intentConfidence = earlyDistributionFlag ? "High" : "Medium";
      if (flowQualityTrend === "deteriorating") intentConfidence = "High";
      intentExplanation = "Karakteristik aliran menunjukkan pelaku dominan mengurangi eksposur sambil menjaga perilaku harga yang teratur. Kombinasi kualitas aliran internal yang memburuk dan aksi harga headline yang tangguh konsisten dengan pola rotasi institusional.";
    } else if (tapeControlFlag && score < 50 && brokerRoleMix === "Balanced") {
      primaryIntent = "Liquidity Harvesting";
      intentConfidence = flowQualityTrend === "flat" ? "Medium" : "Low";
      intentExplanation = "Struktur mikro pasar menunjukkan churn tinggi dengan kemajuan arah bersih terbatas. Aktivitas broker tinggi tanpa bias akumulasi atau distribusi mungkin mengindikasikan penempatan taktis di sekitar level teknis kunci.";
    } else if (tapeControlFlag && score > 50) {
      primaryIntent = "Price Support Operation";
      intentConfidence = operatorCount > 0 ? "High" : "Medium";
      secondaryIntent = "Inventory Building";
      intentExplanation = "Karakteristik aliran menunjukkan pelaku dominan secara aktif mengelola stabilitas harga di zona support. Perilaku tape mekanis dikombinasikan dengan kualitas aliran moderat menunjukkan posisi defensif daripada akumulasi agresif.";
    } else if (marketMode === "Stealth Accumulation" && convictionPhase === "Positioning") {
      primaryIntent = "Inventory Building";
      intentConfidence = flowQualityTrend === "improving" ? "High" : "Medium";
      intentExplanation = "Karakteristik aliran menunjukkan pelaku dominan membangun posisi secara diam-diam dengan pergeseran harga minimal. Pola akumulasi volatilitas rendah dan eksekusi terkendali konsisten dengan penempatan institusional tahap awal.";
    } else if (marketMode === "Active Accumulation" && (convictionPhase === "Confirmation" || convictionPhase === "Crowding")) {
      primaryIntent = "Mark-Up Preparation";
      intentConfidence = (score > 70 && flowQualityTrend === "improving") ? "High" : "Medium";
      secondaryIntent = "Inventory Building";
      intentExplanation = "Karakteristik aliran menunjukkan pelaku dominan bertransisi dari akumulasi diam-diam ke pembangunan posisi yang lebih terlihat. Aliran bersih yang meluas dan kualitas aliran yang membaik mengindikasikan repositioning struktural menjelang katalis yang diantisipasi.";
    } else if (marketMode === "Passive Distribution" || marketMode === "Post-Distribution Vacuum") {
      primaryIntent = "Inventory Exit";
      intentConfidence = flowQualityTrend === "deteriorating" ? "High" : "Medium";
      intentExplanation = "Karakteristik aliran menunjukkan pelaku dominan sebagian besar telah menyelesaikan siklus rotasi mereka. Berkurangnya sponsorship institusional dan kualitas aliran yang menurun mengindikasikan pencarian keseimbangan valuasi baru.";
    } else if (brokerRoleMix === "Accumulator-Dominant" && score > 60) {
      primaryIntent = "Inventory Building";
      intentConfidence = flowQualityTrend === "improving" ? "High" : "Medium";
      intentExplanation = "Karakteristik aliran menunjukkan pelaku dominan membangun posisi melalui absorpsi yang stabil. Aktivitas broker yang condong akumulator dan kualitas aliran moderat mendukung tesis penempatan institusional yang konstruktif.";
    } else {
      primaryIntent = "Inventory Building";
      intentConfidence = "Low";
      intentExplanation = "Pola aliran saat ini tidak menunjukkan intensi arah yang jelas. Pelaku pasar tampak menunggu katalis tambahan sebelum berkomitmen pada penempatan berkelanjutan. Pantau perubahan kualitas aliran atau komposisi peran broker.";
    }
    
    // Modify conviction explanation based on intent (per spec requirements)
    if (primaryIntent === "Mark-Up Preparation") {
      convictionExplanation += " Analisis intensi smart money memperkuat pandangan konstruktif, dengan karakteristik aliran menunjukkan persiapan aktif untuk potensi apresiasi harga.";
    } else if (primaryIntent === "Inventory Exit" && (convictionPhase === "Crowding" || convictionPhase === "Distribution")) {
      convictionExplanation += " Namun, analisis intensi smart money menunjukkan rotasi institusional mungkin sedang berlangsung meski level posisi tinggi. Keyakinan tahap akhir perlu diperlakukan dengan hati-hati.";
    } else if (primaryIntent === "Liquidity Harvesting") {
      convictionExplanation += " Pola churn tinggi menunjukkan aktivitas taktis yang mungkin tidak diterjemahkan menjadi keyakinan arah berkelanjutan.";
    }
    
    const smartMoneyIntent = {
      primaryIntent,
      secondaryIntent,
      confidence: intentConfidence,
      explanation: intentExplanation
    };

    // Structured analyst-style response without buy/sell signals
    res.json({
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
      marketMode,
      marketModeExplanation,
      convictionPhase,
      convictionExplanation,
      smartMoneyIntent,
      event_analysis: {
        impact: "Sedang",
        relevance: "Struktural",
        thesis: `${payload.event_specifics.event_type} (${payload.event_specifics.headline}) konsisten dengan tren operasional yang diamati. Meski peningkatan efisiensi struktural terlihat, sensitivitas makro tetap menjadi variabel utama untuk persistensi valuasi.`,
        confidence: "Tinggi",
        conditions: "Persistensi tesis mengasumsikan stabilitas permintaan kredit domestik dan tidak ada kontraksi signifikan pada Net Interest Margin (NIM) yang berlaku."
      },
      risk_analysis: `Risiko utama untuk ${payload.stock} berpusat pada de-rating yang didorong makro dan potensi kompresi NIM jika persaingan deposito meningkat. Kualitas aset yang ada memberikan bantalan defensif, meski premi valuasi tetap sensitif terhadap perlambatan pertumbuhan.`
    });
  });

  return httpServer;
}
