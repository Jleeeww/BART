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
        price: "11250",
        change: "50",
        changePercent: "0.45",
        summary: "BBCA menunjukkan fundamental yang stabil dengan profitabilitas konsisten serta likuiditas yang kuat. Pertumbuhan laba bersih 12% YoY di Q3 2025 didukung oleh ekspansi Net Interest Income (NII) dan disiplin biaya yang terjaga. Rasio kecukupan modal tetap kokoh, mencerminkan profil defensif perusahaan.",
        description: "Bank Central Asia (BBCA) adalah bank swasta terbesar di Indonesia yang berperan sebagai pilar utama infrastruktur keuangan nasional. Model bisnisnya berfokus pada perbankan transaksional dengan dominasi pendanaan murah (CASA), memberikan keunggulan kompetitif unik di sektor perbankan Indonesia.",
        sector: "Financials",
        subsector: "Banks",
        marketCap: "1,385.4T IDR",
        peRatio: "24.2",
        dividendYield: "2.1",
        roe: "15.8",
        netMargin: "28.4",
        growth: "12.0",
        investorView: "Investor memprioritaskan BBCA karena kualitas aset yang unggul dan dominasi di perbankan transaksional. Kemampuannya mempertahankan margin tinggi dan pertumbuhan konsisten bahkan saat kondisi makro berubah menjadikannya aset defensif inti dalam portofolio ekuitas Indonesia.",
        financialSummary: "Hasil Q3 2025 menunjukkan tren kenaikan konsisten pada pendapatan dan laba bersih, didorong oleh efisiensi operasional dan kondisi kredit yang kondusif. Neraca kuat dan posisi modal yang solid memungkinkan distribusi dividen berkelanjutan sambil mendukung ekspansi kredit.",
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
        tradingActivitySummary: "Aktivitas perdagangan pada 22 Des 2025 menunjukkan peningkatan volume 1.2x rata-rata, dengan akumulasi tersinkronisasi dari institusi domestik (130.4B IDR) dan asing (92.8B IDR).",
        flowOverviewSummary: "Pelaku pasar menunjukkan akumulasi tersinkronisasi pada 22 Des 2025 pasca rilis laporan keuangan kuartalan. Aliran masuk bersih 223.2B IDR didukung oleh sumber institusi asing dan domestik, dengan 3 broker teratas menguasai 41.2% total volume, mengindikasikan minat institusi yang terkonsentrasi.",
        flowBias: "Akumulasi",
        flowIntensity: "Akumulasi Sedang",
        flowReliability: "Tinggi",
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
        newsOverviewSummary: "Rilis laporan keuangan Q3 2025 menjadi pendorong utama sentimen saat ini, mengkonfirmasi ketahanan operasional bank. Pertumbuhan laba bersih 12% YoY sejalan dengan tren struktural jangka panjang, sementara kualitas aset yang terjaga meredam kekhawatiran risiko kredit.",
        newsImpact: "Sedang",
        newsRelevance: "Struktural",
        newsFeed: JSON.stringify([
          { headline: "BBCA Catat Pertumbuhan Laba Bersih 12% YoY di Q3 2025", date: "2025-12-22", source: "IDX News", impact: "Struktural" },
          { headline: "Bank Indonesia Pertahankan Suku Bunga Acuan, Positif untuk Margin Perbankan", date: "2025-11-15", source: "Business Times", impact: "Struktural" },
          { headline: "Aplikasi Digital BBCA Capai 30 Juta Pengguna Aktif", date: "2025-12-05", source: "TechDaily", impact: "Sementara" }
        ]),
        corporateActions: JSON.stringify([
          { type: "Rilis Laporan Keuangan", date: "2025-12-22", status: "Selesai", explanation: "Pelaporan resmi hasil Q3 2025 yang menunjukkan ekspansi laba 12%." },
          { type: "Dividen Tunai", date: "2025-04-10", status: "Selesai", explanation: "Distribusi IDR 205 per saham, mencerminkan posisi modal yang kuat." }
        ]),
        investorInterpretation: "Hasil Q3 memvalidasi tesis leverage operasional yang unggul. Investor perlu mencermati sinkronisasi aliran dana asing dan domestik (total bersih 223.2B IDR) sebagai sinyal dukungan institusi yang meluas pasca rilis laporan keuangan.",
        eventAnalysis: JSON.stringify([
          {
            title: "Laporan Keuangan Q3 2025",
            event: "Bank Central Asia (BBCA) mencatat peningkatan laba bersih 12% dibanding periode yang sama tahun lalu (YoY) pada kuartal ketiga 2025.",
            why: "Pendorong utama meliputi ekspansi NII, disiplin biaya yang terjaga, dan metrik kualitas aset yang stabil meski menghadapi tekanan makro global.",
            immediate: "Apresiasi harga 0.45% dengan volume 1.2x rata-rata, mengindikasikan penyerapan positif hasil oleh pasar.",
            secondOrder: "Penguatan tren perpindahan ke aset berkualitas di sektor keuangan Indonesia. Dominasi pendanaan BBCA (CASA) kemungkinan menguat seiring bank kecil menghadapi biaya likuiditas lebih tinggi.",
            thesis: "Positif. Mengkonfirmasi pertumbuhan struktural dan pencapaian efisiensi operasional.",
            confidence: "Tinggi",
            conditions: "Tesis mengasumsikan stabilitas permintaan kredit domestik yang berkelanjutan. Invalidasi akan terjadi jika ada lonjakan NPL atau pembatasan regulasi pada Net Interest Margin."
          }
        ]),
        financialsAnalystView: "ROE 15.8% dan Net Margin 28.4% mencerminkan tingkat profitabilitas dan efisiensi yang tinggi. Keunggulan struktural terletak pada kemampuan bank mempertahankan metrik ini sambil menumbuhkan portofolio kredit 12% YoY, didukung posisi kecukupan modal yang kuat.",
        flowAnalystView: "Aliran dana 22 Des ditandai dengan lonjakan volume sehat 1.2x dan akumulasi bersih 223.2B IDR. Reliabilitas tinggi dari aliran ini didukung oleh spread ketat 4 IDR antara harga beli rata-rata (9542) dan jual (9538), menunjukkan eksekusi institusi yang efisien.",
        riskAnalystView: "Meski kecukupan modal 'Kuat', risiko utama tetap pada potensi de-rating valuasi jika pertumbuhan laba turun di bawah kisaran 10-12%. Sensitivitas makro terhadap keputusan suku bunga BI tetap menjadi ketidakpastian eksternal paling signifikan.",
        riskData: JSON.stringify({
          overview: "BBCA mempertahankan profil risiko konservatif yang ditandai dengan kecukupan modal tinggi dan kualitas aset yang unggul.",
          level: "Sedang",
          skew: "Seimbang",
          primaryRisks: [
            { title: "Kompresi NIM", why: "Potensi kenaikan biaya pendanaan jika persaingan deposito meningkat.", likelihood: "Sedang", impact: "Tinggi" },
            { title: "Perlambatan Makro", why: "Perlambatan PDB Indonesia akan berdampak langsung pada permintaan kredit.", likelihood: "Rendah", impact: "Sangat Tinggi" }
          ],
          contrarianRisks: [
            { title: "Konsentrasi Institusi", why: "Kepemilikan institusi yang tinggi menjadikan saham ini proxy untuk pergeseran sentimen emerging market.", material: "Redemption dana EM secara bersamaan.", affected: "Pemegang institusi jangka panjang." }
          ],
          tension: "Diperdagangkan pada premi untuk kepastian operasional; investor menukar potensi capital gain dengan reliabilitas tinggi dan karakteristik defensif.",
          invalidation: [
            "Kontraksi Net Interest Margin di bawah 5.0%.",
            "Lonjakan NPL berkelanjutan di atas 3.0%.",
            "Kehilangan dominasi CASA (rasio CASA < 70%)."
          ],
          investorFit: {
            suitable: "Investor institusi dan ritel konservatif yang mencari proxy ekonomi Indonesia dengan volatilitas lebih rendah.",
            unsuitable: "Investor yang mencari pertumbuhan high-beta atau aset undervalued dengan potensi turnaround signifikan."
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
        aiConfidence: "Tinggi",
        // IDX-specific fields
        idxIndices: JSON.stringify(["IDX30", "LQ45", "IDX80"]),
        sectorBadge: "SEKTOR KEUANGAN",
        stockTags: JSON.stringify(["Bank Besar", "Blue Chip"]),
        stockCharacter: "Institusional",
        stockCharacterDesc: "Pergerakan harga terlihat dikendalikan oleh transaksi besar bertahap. Volatilitas relatif terjaga dengan pola akumulasi yang terstruktur.",
        retailSentiment: "Kenaikan harga cenderung didorong akumulasi perlahan, bukan euforia ritel. Partisipasi institusi mendominasi struktur perdagangan.",
        foreignDomesticInterpretation: "Investor asing dan domestik sama-sama mencatat pembelian bersih, menunjukkan konsensus positif lintas segmen investor terhadap saham ini.",
        localRiskFactors: JSON.stringify([
          { type: "Rupiah Risk", text: "Pelemahan nilai tukar Rupiah dapat memengaruhi sentimen investor asing dan arus modal portofolio." },
          { type: "BI Rate Risk", text: "Perubahan suku bunga Bank Indonesia dapat memengaruhi margin bunga bersih dan permintaan kredit." },
          { type: "Political Cycle", text: "Dinamika politik domestik dapat meningkatkan volatilitas pasar dalam jangka pendek." }
        ]),
        retailSummary: "Saham ini cocok untuk investor yang mencari stabilitas jangka menengah dengan risiko relatif terkontrol. Pergerakan harga tidak terlalu agresif, namun didukung fundamental yang solid. BBCA menjadi pilihan defensif bagi investor yang mengutamakan keamanan modal dibanding pertumbuhan agresif."
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
      let confidence = "Sedang";
      const volPct = parseFloat((b.volumePercent || "0").replace("%", ""));
      
      // Role inference based on behavior patterns
      if (b.netBuy && !b.netSell && volPct >= 8) {
        role = "Akumulator";
        confidence = "Tinggi";
      } else if (b.netSell && !b.netBuy && volPct >= 8) {
        role = "Distributor";
        confidence = "Tinggi";
      } else if (b.netBuy && !b.netSell) {
        role = "Akumulator";
      } else if (b.netSell && !b.netBuy) {
        role = "Distributor";
      } else if (volPct < 5) {
        role = "Proxy Ritel";
        confidence = "Rendah";
      } else if (b.netBuy && b.netSell) {
        role = "Market Maker";
      }
      
      // Operator detection: high volume with tape control signals
      if (tapeControlFlag && volPct >= 10 && (role === "Akumulator" || role === "Distributor")) {
        role = "Operator";
        confidence = "Tinggi";
      }
      
      const roleDescriptions: Record<string, string> = {
        "Akumulator": "pembelian bersih konsisten dengan niat membangun posisi",
        "Distributor": "penjualan bersih dengan pola pengurangan inventori",
        "Market Maker": "aliran dua arah menyediakan likuiditas tanpa bias arah",
        "Proxy Ritel": "aktivitas ritel terfragmentasi dengan karakteristik institusional terbatas",
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
    let marketMode = "Akumulasi Aktif";
    if (earlyDistributionFlag && score < 40) marketMode = "Vakum Pasca-Distribusi";
    else if (earlyDistributionFlag) marketMode = "Distribusi Saat Menguat";
    else if (tapeControlFlag && score > 60) marketMode = "Akumulasi Tersembunyi";
    else if (score > 80) marketMode = "Akumulasi Aktif";
    else if (score < 40 && payload.flow_signals.flow_bias === "Distribution") marketMode = "Distribusi Pasif";
    else if (score < 30) marketMode = "Vakum Pasca-Distribusi";
    
    let marketModeExplanation = "";
    switch(marketMode) {
      case "Akumulasi Tersembunyi": marketModeExplanation = "Pelaku dominan tampak membangun posisi secara diam-diam dengan dukungan harga mekanis. Kualitas aliran mulai terbentuk namun belum tercermin dalam penemuan harga organik."; break;
      case "Akumulasi Aktif": marketModeExplanation = "Aktivitas institusi tersinkronisasi mendorong apresiasi harga organik. Kualitas aliran tinggi dengan partisipasi yang luas."; break;
      case "Distribusi Saat Menguat": marketModeExplanation = "Meski harga naik, struktur aliran internal menunjukkan rotasi institusional sedang berlangsung. Penguatan headline mungkin menyembunyikan distribusi yang mendasari."; break;
      case "Distribusi Pasif": marketModeExplanation = "Penjualan institusi terjadi tanpa penekanan harga agresif. Likuiditas diserap secara bertahap, mengurangi volatilitas langsung namun membangun risiko penurunan."; break;
      case "Vakum Pasca-Distribusi": marketModeExplanation = "Fase distribusi sebelumnya telah selesai. Pasar mencari level harga baru dengan dukungan institusional terbatas. Likuiditas mungkin tipis."; break;
    }

    // Conviction Timeline Inference
    let convictionPhase = "Penempatan";
    if (earlyDistributionFlag || marketMode.includes("Distribusi")) {
      convictionPhase = "Distribusi";
    } else if (score > 80 || marketMode === "Akumulasi Tersembunyi") {
      convictionPhase = "Kepadatan";
    } else if (score > 60) {
      convictionPhase = "Konfirmasi";
    } else if (score < 30) {
      convictionPhase = "Reset";
    }

    // Base conviction explanation (will be modified by intent later)
    let convictionExplanation = "";
    switch(convictionPhase) {
      case "Penempatan": convictionExplanation = "Posisi awal institusional terdeteksi. Kualitas aliran masih dini; tesis tetap spekulatif hingga partisipasi tersinkronisasi dikonfirmasi dari pelaku domestik dan asing."; break;
      case "Konfirmasi": convictionExplanation = "Narasi yang berlaku mendapat validasi struktural. Akumulasi tersinkronisasi dan respons harga positif menunjukkan keyakinan institusional meningkat untuk jangka menengah."; break;
      case "Kepadatan": convictionExplanation = "Konsensus institusional telah mencapai level tinggi. Meski aliran teknis tetap berkualitas, asimetri perdagangan bergeser karena posisi semakin terkonsentrasi."; break;
      case "Distribusi": convictionExplanation = "Kualitas aliran internal memburuk. Akumulasi yang diamati tampak semakin didorong oleh partisipasi siklus akhir, sementara pemimpin institusional menunjukkan tanda rotasi struktural."; break;
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
    const accumulatorCount = brokerInsights.filter((b: any) => b.inferredRole === "Akumulator").length;
    const distributorCount = brokerInsights.filter((b: any) => b.inferredRole === "Distributor").length;
    const operatorCount = brokerInsights.filter((b: any) => b.inferredRole === "Operator").length;
    const brokerRoleMix = accumulatorCount > distributorCount ? "Dominan Akumulator" : 
                          distributorCount > accumulatorCount ? "Dominan Distributor" : "Seimbang";
    
    // Flow quality trend inference (simplified - based on current score position)
    const flowQualityTrend = score > 70 ? "membaik" : score > 50 ? "stabil" : "melemah";
    
    // Intent inference using multi-signal confluence
    let primaryIntent = "Pembangunan Inventori";
    let secondaryIntent: string | undefined = undefined;
    let intentConfidence: "Rendah" | "Sedang" | "Tinggi" = "Sedang";
    let intentExplanation = "";
    
    // Multi-signal confluence logic (incorporating flowQualityTrend)
    if (earlyDistributionFlag || marketMode === "Distribusi Saat Menguat") {
      primaryIntent = "Keluar Inventori";
      intentConfidence = earlyDistributionFlag ? "Tinggi" : "Sedang";
      if (flowQualityTrend === "melemah") intentConfidence = "Tinggi";
      intentExplanation = "Karakteristik aliran menunjukkan pelaku dominan mengurangi eksposur sambil menjaga perilaku harga yang teratur. Kombinasi kualitas aliran internal yang memburuk dan aksi harga headline yang tangguh konsisten dengan pola rotasi institusional.";
    } else if (tapeControlFlag && score < 50 && brokerRoleMix === "Seimbang") {
      primaryIntent = "Pemanenan Likuiditas";
      intentConfidence = flowQualityTrend === "stabil" ? "Sedang" : "Rendah";
      intentExplanation = "Struktur mikro pasar menunjukkan churn tinggi dengan kemajuan arah bersih terbatas. Aktivitas broker tinggi tanpa bias akumulasi atau distribusi mungkin mengindikasikan penempatan taktis di sekitar level teknis kunci.";
    } else if (tapeControlFlag && score > 50) {
      primaryIntent = "Operasi Dukungan Harga";
      intentConfidence = operatorCount > 0 ? "Tinggi" : "Sedang";
      secondaryIntent = "Pembangunan Inventori";
      intentExplanation = "Karakteristik aliran menunjukkan pelaku dominan secara aktif mengelola stabilitas harga di zona support. Perilaku tape mekanis dikombinasikan dengan kualitas aliran moderat menunjukkan posisi defensif daripada akumulasi agresif.";
    } else if (marketMode === "Akumulasi Tersembunyi" && convictionPhase === "Penempatan") {
      primaryIntent = "Pembangunan Inventori";
      intentConfidence = flowQualityTrend === "membaik" ? "Tinggi" : "Sedang";
      intentExplanation = "Karakteristik aliran menunjukkan pelaku dominan membangun posisi secara diam-diam dengan pergeseran harga minimal. Pola akumulasi volatilitas rendah dan eksekusi terkendali konsisten dengan penempatan institusional tahap awal.";
    } else if (marketMode === "Akumulasi Aktif" && (convictionPhase === "Konfirmasi" || convictionPhase === "Kepadatan")) {
      primaryIntent = "Persiapan Mark-Up";
      intentConfidence = (score > 70 && flowQualityTrend === "membaik") ? "Tinggi" : "Sedang";
      secondaryIntent = "Pembangunan Inventori";
      intentExplanation = "Karakteristik aliran menunjukkan pelaku dominan bertransisi dari akumulasi diam-diam ke pembangunan posisi yang lebih terlihat. Aliran bersih yang meluas dan kualitas aliran yang membaik mengindikasikan repositioning struktural menjelang katalis yang diantisipasi.";
    } else if (marketMode === "Distribusi Pasif" || marketMode === "Vakum Pasca-Distribusi") {
      primaryIntent = "Keluar Inventori";
      intentConfidence = flowQualityTrend === "melemah" ? "Tinggi" : "Sedang";
      intentExplanation = "Karakteristik aliran menunjukkan pelaku dominan sebagian besar telah menyelesaikan siklus rotasi mereka. Berkurangnya sponsorship institusional dan kualitas aliran yang menurun mengindikasikan pencarian keseimbangan valuasi baru.";
    } else if (brokerRoleMix === "Dominan Akumulator" && score > 60) {
      primaryIntent = "Pembangunan Inventori";
      intentConfidence = flowQualityTrend === "membaik" ? "Tinggi" : "Sedang";
      intentExplanation = "Karakteristik aliran menunjukkan pelaku dominan membangun posisi melalui absorpsi yang stabil. Aktivitas broker yang condong akumulator dan kualitas aliran moderat mendukung tesis penempatan institusional yang konstruktif.";
    } else {
      primaryIntent = "Pembangunan Inventori";
      intentConfidence = "Rendah";
      intentExplanation = "Pola aliran saat ini tidak menunjukkan intensi arah yang jelas. Pelaku pasar tampak menunggu katalis tambahan sebelum berkomitmen pada penempatan berkelanjutan. Pantau perubahan kualitas aliran atau komposisi peran broker.";
    }
    
    // Modify conviction explanation based on intent (per spec requirements)
    if (primaryIntent === "Persiapan Mark-Up") {
      convictionExplanation += " Analisis intensi smart money memperkuat pandangan konstruktif, dengan karakteristik aliran menunjukkan persiapan aktif untuk potensi apresiasi harga.";
    } else if (primaryIntent === "Keluar Inventori" && (convictionPhase === "Kepadatan" || convictionPhase === "Distribusi")) {
      convictionExplanation += " Namun, analisis intensi smart money menunjukkan rotasi institusional mungkin sedang berlangsung meski level posisi tinggi. Keyakinan tahap akhir perlu diperlakukan dengan hati-hati.";
    } else if (primaryIntent === "Pemanenan Likuiditas") {
      convictionExplanation += " Pola churn tinggi menunjukkan aktivitas taktis yang mungkin tidak diterjemahkan menjadi keyakinan arah berkelanjutan.";
    }
    
    const smartMoneyIntent = {
      primaryIntent,
      secondaryIntent,
      confidence: intentConfidence,
      explanation: intentExplanation
    };

    // Bandar Heatmap mock data - shows broker dominance over time
    const bandarHeatmap = [
      {
        date: "2025-01",
        brokers: [
          { code: "BK", intensity: 80, role: "Akumulator" },
          { code: "BNI", intensity: 65, role: "Akumulator" },
          { code: "CIMB", intensity: 40, role: "Netral" },
          { code: "YP", intensity: 20, role: "Distributor" }
        ]
      },
      {
        date: "2025-02",
        brokers: [
          { code: "BK", intensity: 75, role: "Akumulator" },
          { code: "BNI", intensity: 70, role: "Akumulator" },
          { code: "CIMB", intensity: 55, role: "Akumulator" },
          { code: "YP", intensity: 35, role: "Distributor" }
        ]
      },
      {
        date: "2025-03",
        brokers: [
          { code: "BK", intensity: 50, role: "Netral" },
          { code: "BNI", intensity: 60, role: "Akumulator" },
          { code: "CIMB", intensity: 65, role: "Akumulator" },
          { code: "YP", intensity: 45, role: "Netral" }
        ]
      },
      {
        date: "2025-04",
        brokers: [
          { code: "BK", intensity: 30, role: "Distributor" },
          { code: "BNI", intensity: 25, role: "Distributor" },
          { code: "CIMB", intensity: 35, role: "Distributor" },
          { code: "YP", intensity: 70, role: "Akumulator" }
        ]
      }
    ];

    // Phase Timeline mock data - shows market phase evolution
    const phaseTimeline = [
      { date: "2025-01", phase: "Akumulasi Senyap", description: "Institusi membangun posisi secara diam-diam tanpa mempengaruhi harga secara signifikan." },
      { date: "2025-02", phase: "Akumulasi Aktif", description: "Institusi mulai meningkatkan volume pembelian dan mendukung kenaikan harga secara bertahap." },
      { date: "2025-03", phase: "Konfirmasi", description: "Pola akumulasi terkonfirmasi dengan volume dan momentum yang konsisten." },
      { date: "2025-04", phase: "Mark-Up", description: "Fase kenaikan harga aktif dimana institusi mulai mendorong valuasi lebih tinggi." }
    ];

    // AI interpretation for phase timeline
    const bandarPhaseInterpretation = `Perpindahan dari Akumulasi Senyap ke Akumulasi Aktif menunjukkan peningkatan keyakinan institusi. Stabilitas broker yang tinggi selama periode ini mengindikasikan adanya kampanye terstruktur, bukan akumulasi acak. Rotasi kepemilikan dari broker BK dan BNI ke YP pada bulan April menandakan potensi pergeseran fase pasar yang perlu dipantau.`;

    // Smart Trap Detection - Mock logic based on flow patterns
    // Bull Trap: Price rising + Broker Stability falling + Distributor dominance + Distribution phase
    // Bear Trap: Price falling + Accumulator active + Foreign flow in + Stealth Accumulation phase
    const trapDetection = (() => {
      const currentPhase = phaseTimeline[phaseTimeline.length - 1]?.phase || "";
      const recentBrokers = bandarHeatmap[bandarHeatmap.length - 1]?.brokers || [];
      const distributorCount = recentBrokers.filter((b: any) => b.role === "Distributor").length;
      const accumulatorCount = recentBrokers.filter((b: any) => b.role === "Akumulator").length;
      
      // Mock: Check for Bull Trap conditions
      const bullTrapConditions = 
        (currentPhase === "Mark-Up" || currentPhase === "Distribusi") &&
        distributorCount >= 2;
      
      // Mock: Check for Bear Trap conditions  
      const bearTrapConditions = 
        (currentPhase === "Akumulasi Senyap" || currentPhase === "Akumulasi Aktif") &&
        accumulatorCount >= 2;
      
      if (bullTrapConditions) {
        return {
          type: "bull_trap",
          detected: true,
          confidence: distributorCount >= 3 ? "Tinggi" : "Sedang",
          title: "Potensi Bull Trap Terdeteksi",
          explanation: "Kenaikan harga saat ini terjadi bersamaan dengan peningkatan distribusi oleh broker besar. Stabilitas akumulasi menurun, menunjukkan bahwa kenaikan kemungkinan dimanfaatkan sebagai likuiditas keluar bagi pelaku besar. Pergerakan harga naik dapat menjadi jebakan bagi investor yang masuk terlambat."
        };
      }
      
      if (bearTrapConditions) {
        return {
          type: "bear_trap",
          detected: true,
          confidence: accumulatorCount >= 3 ? "Tinggi" : "Sedang",
          title: "Potensi Bear Trap Terdeteksi",
          explanation: "Penurunan harga terjadi di tengah peningkatan akumulasi oleh broker institusi. Hal ini sering terjadi saat pelaku besar menekan harga sementara untuk mengumpulkan saham sebelum fase kenaikan berikutnya. Tekanan jual mungkin bersifat sementara dan taktis."
        };
      }
      
      return {
        type: "none",
        detected: false,
        confidence: "Rendah",
        title: "Tidak Ada Jebakan Signifikan Terdeteksi",
        explanation: "Saat ini tidak terdeteksi pola jebakan pasar yang signifikan. Perilaku aliran dana dan fase pasar menunjukkan pergerakan yang konsisten dengan fundamental."
      };
    })();

    // ─── DECISION ENGINE (PART A) ───
    // Determines stock status, sub-badge, reasons, and investor fit
    const decisionEngine = (() => {
      let status = "Layak Dikoleksi Bertahap";
      let subBadge = "Akumulasi Sehat";
      let reasons: string[] = [];
      let primaryRisk = "";
      let investorFit = "";
      
      // Determine status based on market mode, flow quality, and conviction
      if (earlyDistributionFlag || marketMode.includes("Distribusi")) {
        status = "Perlu Waspada";
        subBadge = "Distribusi Awal";
        reasons = [
          "Aliran dana institusi menunjukkan tanda-tanda rotasi",
          "Stabilitas kendali bandar mulai menurun",
          "Struktur harga internal melemah"
        ];
        primaryRisk = "Tekanan jual institusional dapat meningkat jika rezim distribusi berlanjut.";
        investorFit = "Investor dengan toleransi risiko tinggi yang memahami dinamika rotasi institusional.";
      } else if (score < 40 || marketMode === "Vakum Pasca-Distribusi") {
        status = "Hindari Sementara";
        subBadge = "Spekulatif";
        reasons = [
          "Dukungan institusi sangat terbatas",
          "Likuiditas pasar tipis",
          "Tidak ada katalis struktural yang jelas"
        ];
        primaryRisk = "Volatilitas tinggi tanpa dasar institusional yang kuat.";
        investorFit = "Tidak direkomendasikan untuk sebagian besar profil investor saat ini.";
      } else if (score > 70 && brokerStabilityScore.level === "Tinggi") {
        status = "Layak Dikoleksi Bertahap";
        subBadge = "Akumulasi Sehat";
        reasons = [
          "Aliran dana institusi konsisten dan tersinkronisasi",
          "Struktur harga terkontrol oleh pelaku dominan",
          "Risiko distribusi masih terbatas"
        ];
        primaryRisk = "Tesis dapat gagal jika terjadi pergeseran rezim ke distribusi secara mendadak.";
        investorFit = "Investor defensif hingga menengah yang mencari stabilitas dengan potensi apresiasi bertahap.";
      } else if (score > 50 && brokerStabilityScore.level === "Sedang") {
        status = "Layak Dikoleksi Bertahap";
        subBadge = "Akumulasi Rapuh";
        reasons = [
          "Akumulasi institusi terdeteksi namun belum sepenuhnya stabil",
          "Kendali bandar masih dalam tahap pembentukan",
          "Fundamental mendukung meski aliran dana fluktuatif"
        ];
        primaryRisk = "Kepemimpinan akumulasi yang berputar dapat menghambat momentum kenaikan.";
        investorFit = "Investor menengah yang bersedia menunggu konfirmasi lebih lanjut.";
      } else {
        status = "Perlu Waspada";
        subBadge = "Spekulatif";
        reasons = [
          "Konsensus institusi belum terbentuk",
          "Perilaku aliran dana masih terfragmentasi",
          "Memerlukan katalis tambahan untuk konfirmasi"
        ];
        primaryRisk = "Volatilitas dapat meningkat tanpa arah yang jelas.";
        investorFit = "Investor agresif dengan horizon waktu pendek dan toleransi volatilitas tinggi.";
      }
      
      return { status, subBadge, reasons, primaryRisk, investorFit };
    })();

    // ─── COMBINED CONTROL QUALITY SCORE (PART B) ───
    // Merges flow quality, flow reliability, and broker stability into single metric
    const controlQualityScore = (() => {
      const flowQuality = score; // 0-100
      const flowReliability = payload.flow_signals.flow_reliability === "Tinggi" ? 90 : 
                              payload.flow_signals.flow_reliability === "Sedang" ? 60 : 30;
      const brokerStability = brokerStabilityScore.score;
      
      // Weighted average: 40% flow quality, 30% reliability, 30% broker stability
      const combined = Math.round(flowQuality * 0.4 + flowReliability * 0.3 + brokerStability * 0.3);
      
      let level = "Rendah";
      let interpretation = "";
      
      if (combined >= 70) {
        level = "Tinggi";
        interpretation = "Kendali bandar sangat kuat dengan aliran dana berkualitas tinggi dan konsistensi institusi yang terjaga.";
      } else if (combined >= 50) {
        level = "Sedang";
        interpretation = "Kendali bandar cukup terstruktur namun memerlukan pemantauan berkelanjutan terhadap perubahan perilaku institusi.";
      } else {
        level = "Rendah";
        interpretation = "Kendali bandar lemah atau terfragmentasi. Pergerakan harga mungkin tidak didukung fondasi institusional yang kuat.";
      }
      
      return { score: combined, level, interpretation };
    })();

    // ─── INSIDER-BANDAR ALIGNMENT (PART D) ───
    // Determines if insider activity aligns with bandar behavior
    const insiderBandarAlignment = (() => {
      // Mock logic based on flow direction vs insider sentiment
      const flowDirection = payload.flow_signals.flow_bias === "Akumulasi" ? "beli" : "jual";
      const insiderDirection = "beli"; // From mock insider data showing 78% buy
      
      let status = "Netral";
      let interpretation = "";
      
      if (flowDirection === insiderDirection && score > 60) {
        status = "Selaras";
        interpretation = "Aktivitas insider sejalan dengan perilaku bandar. Manajemen menunjukkan keyakinan yang konsisten dengan akumulasi institusi, memperkuat validitas tesis fundamental.";
      } else if (flowDirection !== insiderDirection) {
        status = "Bertentangan";
        interpretation = "Aktivitas insider berlawanan dengan arah aliran institusi. Divergensi ini memerlukan perhatian khusus karena insider mungkin memiliki informasi yang belum tercermin di pasar.";
      } else {
        status = "Netral";
        interpretation = "Aktivitas insider tidak memberikan sinyal arah yang jelas relatif terhadap perilaku bandar. Pantau perkembangan transaksi insider untuk konfirmasi lebih lanjut.";
      }
      
      return { status, interpretation };
    })();

    // ─── SIMPLIFIED RISK LEVEL (PART C) ───
    const simplifiedRisk = (() => {
      let level = "Sedang";
      let explanation = "";
      let failureTriggers: string[] = [];
      
      if (earlyDistributionFlag || marketMode.includes("Distribusi")) {
        level = "Tinggi";
        explanation = "Struktur aliran dana internal menunjukkan rotasi institusional sedang berlangsung. Meski harga mungkin masih bertahan, fondasi akumulasi mulai melemah dan risiko koreksi meningkat jika distribusi berlanjut.";
        failureTriggers = [
          "Distribusi mendadak oleh broker dominan",
          "Pergeseran rezim ke Vakum Pasca-Distribusi",
          "Hilangnya stabilitas kendali bandar"
        ];
      } else if (score < 40) {
        level = "Tinggi";
        explanation = "Dukungan institusional sangat terbatas pada level saat ini. Tanpa sponsor institusi yang jelas, pergerakan harga rentan terhadap volatilitas acak dan tekanan jual ritel.";
        failureTriggers = [
          "Tidak ada pemulihan aliran institusi dalam 5-10 hari",
          "Penembusan level support teknis kunci",
          "Pergeseran sentimen makro negatif"
        ];
      } else if (score > 70 && brokerStabilityScore.level === "Tinggi") {
        level = "Rendah";
        explanation = "Profil risiko terkendali dengan dukungan institusi yang kuat dan konsisten. Struktur akumulasi sehat mengurangi probabilitas koreksi signifikan dalam jangka pendek.";
        failureTriggers = [
          "Pergeseran mendadak rezim pasar ke distribusi",
          "Keluar masif dari broker dominan",
          "Kejutan negatif fundamental yang signifikan"
        ];
      } else {
        level = "Sedang";
        explanation = "Risiko dalam batas wajar dengan dukungan institusi moderat. Pergerakan harga didukung fondasi yang cukup namun memerlukan validasi berkelanjutan dari aliran dana.";
        failureTriggers = [
          "Penurunan stabilitas broker di bawah 40%",
          "Akumulasi berubah menjadi distribusi",
          "Kehilangan momentum aliran positif"
        ];
      }
      
      return { level, explanation, failureTriggers };
    })();

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
