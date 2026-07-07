import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { testBandarmologyRouter } from "./routes/testBandarmology";
import { registerAdminRoutes } from "./routes/admin";
import { registerScraperRoutes } from "./routes/scraper";
import { registerBacktestRoutes } from "./routes/backtest";
import { registerDistributionRoutes } from "./routes/distribution";
import { registerValuationRoutes } from "./routes/valuation";
import { registerSignalsRoutes } from "./routes/signals";
import { registerMacroRoutes } from "./routes/macro";
import { registerInsiderRoutes } from "./routes/insider";
import { registerManagementRoutes } from "./routes/management";
import { registerNewsRoutes } from "./routes/news";
import { registerWatchlistRoutes } from "./routes/watchlist";
import { registerRadarRoutes } from "./routes/radar";
import { registerSimulationRoutes } from "./routes/simulation";
import { registerPipelineRoutes } from "./routes/pipeline";
import { registerStocksRoutes } from "./routes/stocks";
import { registerAiRoutes } from "./routes/ai";
import { registerIdxDataRoutes } from "./routes/idxData";

// ========================================
// UNIFIED BRAIN ENGINE
// Single source of truth: getStockDecision() in server/engine/unifiedDecision.ts
// 3 Actions: BUY, WATCHLIST, AVOID
// 3 Buckets: Siap Dipantau, Watchlist Prioritas, Hindari Dulu
// ========================================

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  app.use("/api", testBandarmologyRouter);

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
          { headline: "Bank Indonesia Pertahankan Suku Bunga Acuan di Level 5.75%", date: "2025-11-15", source: "Business Times", impact: "Struktural" },
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

    // Seed additional stocks for homepage
    const additionalStocks = [
      {
        symbol: "BMRI",
        name: "Bank Mandiri (Persero) Tbk",
        price: "6850",
        change: "-75",
        changePercent: "-1.08",
        summary: "BMRI mengalami tekanan jual moderat dengan volume di bawah rata-rata. Distribusi dari broker institusi terdeteksi, namun struktur fundamental masih solid.",
        description: "Bank Mandiri adalah bank BUMN terbesar di Indonesia dengan fokus pada segmen korporasi dan UMKM.",
        sector: "Financials",
        subsector: "Banks",
        marketCap: "640.2T IDR",
        peRatio: "10.5",
        dividendYield: "4.2",
        roe: "17.2",
        netMargin: "26.5",
        growth: "8.5",
        investorView: "Saham bank BUMN dengan valuasi menarik namun menghadapi tekanan jangka pendek.",
        financialSummary: "Pertumbuhan laba solid dengan ekspansi kredit yang terjaga.",
        revenue2023: "82.3T IDR",
        revenue2024: "91.5T IDR", 
        revenue2025: "98.7T IDR",
        netProfit2023: "38.4T IDR",
        netProfit2024: "42.1T IDR",
        netProfit2025: "45.8T IDR",
        assets2023: "1,850.2T IDR",
        assets2024: "1,945.4T IDR",
        assets2025: "2,025.8T IDR",
        liabilities2023: "1,620.3T IDR",
        liabilities2024: "1,705.4T IDR",
        liabilities2025: "1,778.6T IDR",
        ocf2023: "22.5T IDR",
        ocf2024: "24.2T IDR",
        ocf2025: "26.7T IDR",
        tradingActivitySummary: "Volume perdagangan menurun 0.7x dari rata-rata dengan tekanan jual dari institusi domestik.",
        flowOverviewSummary: "Aliran keluar bersih 45.6B IDR didominasi oleh distribusi institusi domestik.",
        flowBias: "Distribusi",
        flowIntensity: "Distribusi Sedang",
        flowReliability: "Sedang",
        brokerData: JSON.stringify([
          { code: "MBK", name: "PT Maybank Kim Eng", netBuy: null, netSell: "28.5B IDR", volumePercent: "11.4%", avgBuy: "6,890", avgSell: "6,840" },
          { code: "BK", name: "PT Mandiri Sekuritas", netBuy: null, netSell: "17.1B IDR", volumePercent: "8.8%", avgBuy: "6,880", avgSell: "6,850" }
        ]),
        foreignActivityData: JSON.stringify({
          foreignBuy: "45.2B IDR", foreignSell: "52.4B IDR", netForeignFlow: "-7.2B IDR",
          domesticBuy: "120.7B IDR", domesticSell: "159.1B IDR", foreignPercent: 18, domesticPercent: 82
        }),
        avgBuyPrice: "6,885 IDR",
        avgSellPrice: "6,845 IDR",
        newsOverviewSummary: "Tidak ada berita material yang mempengaruhi sentimen saat ini.",
        newsImpact: "Rendah",
        newsRelevance: "Sementara",
        newsFeed: JSON.stringify([
          { headline: "BMRI Targetkan Pertumbuhan Kredit 10% di 2026", date: "2025-12-15", source: "Bisnis Indonesia", impact: "Struktural" }
        ]),
        corporateActions: JSON.stringify([]),
        investorInterpretation: "Tekanan jual jangka pendek tidak mengubah tesis fundamental, namun perlu kehati-hatian.",
        eventAnalysis: JSON.stringify([]),
        financialsAnalystView: "ROE 17.2% solid untuk bank BUMN dengan valuasi PE 10.5x yang menarik.",
        flowAnalystView: "Distribusi sedang terdeteksi, menunggu stabilisasi sebelum entry.",
        riskAnalystView: "Risiko eksekusi pada ekspansi kredit UMKM perlu dipantau.",
        riskData: JSON.stringify({
          overview: "Profil risiko moderat dengan tekanan jangka pendek.",
          level: "Sedang",
          skew: "Defensif",
          primaryRisks: [{ title: "Tekanan Kredit UMKM", why: "Segmen UMKM sensitif terhadap kondisi ekonomi.", likelihood: "Sedang", impact: "Sedang" }],
          contrarianRisks: [],
          tension: "Valuasi menarik vs tekanan aliran jangka pendek.",
          invalidation: ["NPL naik di atas 3.5%"],
          investorFit: { suitable: "Value investor dengan horizon menengah.", unsuitable: "Trader momentum." }
        }),
        insiderData: null,
        aiConfidence: "Sedang",
        idxIndices: JSON.stringify(["IDX30", "LQ45"]),
        sectorBadge: "SEKTOR KEUANGAN",
        stockTags: JSON.stringify(["Bank BUMN", "Blue Chip"]),
        stockCharacter: "Defensif",
        stockCharacterDesc: "Pergerakan defensif dengan volatilitas terkendali.",
        retailSentiment: "Sentimen ritel netral cenderung wait and see.",
        foreignDomesticInterpretation: "Keduanya dalam mode distribusi ringan.",
        localRiskFactors: JSON.stringify([{ type: "Credit Risk", text: "Risiko kualitas kredit segmen UMKM." }]),
        retailSummary: "Saham defensif dengan valuasi menarik, namun sedang dalam fase konsolidasi."
      },
      {
        symbol: "TLKM",
        name: "Telkom Indonesia (Persero) Tbk",
        price: "2950",
        change: "25",
        changePercent: "0.85",
        summary: "TLKM menunjukkan akumulasi bertahap dengan volume stabil. Struktur sedang membaik dengan minat institusi yang meningkat.",
        description: "Telkom Indonesia adalah perusahaan telekomunikasi terbesar di Indonesia dengan dominasi di segmen seluler dan data center.",
        sector: "Communication Services",
        subsector: "Telecommunications",
        marketCap: "292.1T IDR",
        peRatio: "14.8",
        dividendYield: "4.5",
        roe: "18.5",
        netMargin: "15.2",
        growth: "6.2",
        investorView: "Saham defensif dengan yield tinggi dan potensi pertumbuhan data center.",
        financialSummary: "Pendapatan stabil dengan margin yang terjaga meski tekanan kompetisi.",
        revenue2023: "145.2T IDR",
        revenue2024: "152.8T IDR",
        revenue2025: "161.5T IDR",
        netProfit2023: "21.8T IDR",
        netProfit2024: "23.4T IDR",
        netProfit2025: "24.9T IDR",
        assets2023: "285.4T IDR",
        assets2024: "298.7T IDR",
        assets2025: "312.4T IDR",
        liabilities2023: "142.3T IDR",
        liabilities2024: "148.5T IDR",
        liabilities2025: "155.2T IDR",
        ocf2023: "52.5T IDR",
        ocf2024: "55.2T IDR",
        ocf2025: "58.7T IDR",
        tradingActivitySummary: "Volume meningkat 1.1x dengan akumulasi tersinkronisasi.",
        flowOverviewSummary: "Akumulasi bertahap 32.4B IDR dari institusi domestik dan asing.",
        flowBias: "Akumulasi",
        flowIntensity: "Akumulasi Ringan",
        flowReliability: "Sedang",
        brokerData: JSON.stringify([
          { code: "BNI", name: "PT BNI Securities", netBuy: "18.5B IDR", netSell: null, volumePercent: "9.2%", avgBuy: "2,945", avgSell: "2,955" },
          { code: "CIMB", name: "PT CIMB Securities", netBuy: "13.9B IDR", netSell: null, volumePercent: "7.8%", avgBuy: "2,948", avgSell: "2,952" }
        ]),
        foreignActivityData: JSON.stringify({
          foreignBuy: "65.2B IDR", foreignSell: "48.4B IDR", netForeignFlow: "16.8B IDR",
          domesticBuy: "95.7B IDR", domesticSell: "80.1B IDR", foreignPercent: 35, domesticPercent: 65
        }),
        avgBuyPrice: "2,946 IDR",
        avgSellPrice: "2,954 IDR",
        newsOverviewSummary: "Ekspansi data center menjadi katalis jangka menengah yang menarik.",
        newsImpact: "Sedang",
        newsRelevance: "Struktural",
        newsFeed: JSON.stringify([
          { headline: "TLKM Umumkan Ekspansi Data Center di 5 Kota", date: "2025-12-18", source: "Tech News", impact: "Struktural" }
        ]),
        corporateActions: JSON.stringify([]),
        investorInterpretation: "Akumulasi bertahap mengindikasikan minat yang membaik, namun belum konfirmasi penuh.",
        eventAnalysis: JSON.stringify([]),
        financialsAnalystView: "Yield 4.5% menarik untuk income investor dengan pertumbuhan moderat.",
        flowAnalystView: "Akumulasi ringan perlu konfirmasi lanjutan sebelum entry agresif.",
        riskAnalystView: "Kompetisi di segmen seluler tetap menjadi risiko utama.",
        riskData: JSON.stringify({
          overview: "Profil defensif dengan risiko kompetisi moderat.",
          level: "Rendah-Sedang",
          skew: "Seimbang",
          primaryRisks: [{ title: "Tekanan Kompetisi", why: "Persaingan harga di segmen seluler.", likelihood: "Sedang", impact: "Sedang" }],
          contrarianRisks: [],
          tension: "Yield menarik vs pertumbuhan yang moderat.",
          invalidation: ["Margin turun di bawah 12%"],
          investorFit: { suitable: "Dividend investor dan investor defensif.", unsuitable: "Growth investor." }
        }),
        insiderData: null,
        aiConfidence: "Sedang",
        idxIndices: JSON.stringify(["IDX30", "LQ45", "IDX80"]),
        sectorBadge: "SEKTOR TELEKOMUNIKASI",
        stockTags: JSON.stringify(["BUMN", "Dividend Stock"]),
        stockCharacter: "Defensif",
        stockCharacterDesc: "Pergerakan stabil dengan volatilitas rendah.",
        retailSentiment: "Sentimen ritel positif moderat.",
        foreignDomesticInterpretation: "Keduanya dalam mode akumulasi ringan.",
        localRiskFactors: JSON.stringify([{ type: "Competition Risk", text: "Persaingan dengan operator lain." }]),
        retailSummary: "Saham defensif dengan yield tinggi, cocok untuk investor konservatif."
      },
      {
        symbol: "ASII",
        name: "Astra International Tbk",
        price: "4580",
        change: "-120",
        changePercent: "-2.55",
        summary: "ASII mengalami distribusi signifikan dengan volume tinggi. Tekanan dari sektor otomotif dan sentimen negatif terhadap komoditas.",
        description: "Astra International adalah konglomerat terbesar Indonesia dengan eksposur ke otomotif, alat berat, dan jasa keuangan.",
        sector: "Consumer Discretionary",
        subsector: "Automobiles",
        marketCap: "185.4T IDR",
        peRatio: "8.2",
        dividendYield: "5.8",
        roe: "14.2",
        netMargin: "8.5",
        growth: "-3.2",
        investorView: "Valuasi murah namun menghadapi headwind siklus komoditas dan transisi EV.",
        financialSummary: "Pendapatan tertekan oleh perlambatan penjualan otomotif dan komoditas.",
        revenue2023: "285.2T IDR",
        revenue2024: "278.5T IDR",
        revenue2025: "268.7T IDR",
        netProfit2023: "24.8T IDR",
        netProfit2024: "23.1T IDR",
        netProfit2025: "21.5T IDR",
        assets2023: "425.4T IDR",
        assets2024: "418.7T IDR",
        assets2025: "412.4T IDR",
        liabilities2023: "185.3T IDR",
        liabilities2024: "178.5T IDR",
        liabilities2025: "172.2T IDR",
        ocf2023: "32.5T IDR",
        ocf2024: "28.2T IDR",
        ocf2025: "25.7T IDR",
        tradingActivitySummary: "Volume melonjak 1.8x dengan distribusi agresif dari institusi.",
        flowOverviewSummary: "Distribusi besar 85.6B IDR didominasi oleh institusi asing.",
        flowBias: "Distribusi",
        flowIntensity: "Distribusi Besar",
        flowReliability: "Tinggi",
        brokerData: JSON.stringify([
          { code: "UBS", name: "PT UBS Securities", netBuy: null, netSell: "45.5B IDR", volumePercent: "15.4%", avgBuy: "4,650", avgSell: "4,560" },
          { code: "CLSA", name: "PT CLSA Indonesia", netBuy: null, netSell: "28.1B IDR", volumePercent: "10.8%", avgBuy: "4,640", avgSell: "4,570" }
        ]),
        foreignActivityData: JSON.stringify({
          foreignBuy: "42.2B IDR", foreignSell: "98.4B IDR", netForeignFlow: "-56.2B IDR",
          domesticBuy: "85.7B IDR", domesticSell: "115.1B IDR", foreignPercent: 42, domesticPercent: 58
        }),
        avgBuyPrice: "4,645 IDR",
        avgSellPrice: "4,565 IDR",
        newsOverviewSummary: "Penurunan penjualan otomotif dan kekhawatiran transisi EV menekan sentimen.",
        newsImpact: "Tinggi",
        newsRelevance: "Struktural",
        newsFeed: JSON.stringify([
          { headline: "Penjualan Mobil Nasional Turun 12% di November 2025", date: "2025-12-10", source: "Bisnis Indonesia", impact: "Struktural" }
        ]),
        corporateActions: JSON.stringify([]),
        investorInterpretation: "Distribusi besar mengindikasikan revisi ekspektasi oleh institusi.",
        eventAnalysis: JSON.stringify([]),
        financialsAnalystView: "PE 8.2x murah namun mencerminkan kekhawatiran struktural.",
        flowAnalystView: "Distribusi agresif - hindari entry baru hingga stabilisasi.",
        riskAnalystView: "Transisi EV dan siklus komoditas menjadi risiko utama.",
        riskData: JSON.stringify({
          overview: "Profil risiko tinggi dengan multiple headwinds.",
          level: "Tinggi",
          skew: "Negatif",
          primaryRisks: [
            { title: "Transisi EV", why: "Disrupsi model bisnis otomotif konvensional.", likelihood: "Tinggi", impact: "Tinggi" },
            { title: "Siklus Komoditas", why: "Eksposur ke coal dan palm oil.", likelihood: "Sedang", impact: "Tinggi" }
          ],
          contrarianRisks: [],
          tension: "Valuasi murah vs headwinds struktural signifikan.",
          invalidation: ["Market share otomotif turun di bawah 45%"],
          investorFit: { suitable: "Deep value investor dengan horizon panjang.", unsuitable: "Sebagian besar investor retail." }
        }),
        insiderData: null,
        aiConfidence: "Tinggi",
        idxIndices: JSON.stringify(["IDX30", "LQ45"]),
        sectorBadge: "SEKTOR CONSUMER",
        stockTags: JSON.stringify(["Konglomerat", "Value Trap?"]),
        stockCharacter: "Siklis",
        stockCharacterDesc: "Sensitif terhadap siklus ekonomi dan komoditas.",
        retailSentiment: "Sentimen ritel negatif dengan kekhawatiran jangka panjang.",
        foreignDomesticInterpretation: "Keduanya dalam mode distribusi agresif.",
        localRiskFactors: JSON.stringify([{ type: "EV Disruption", text: "Transisi ke kendaraan listrik." }]),
        retailSummary: "Saham dengan risiko tinggi - hindari entry baru hingga ada tanda stabilisasi."
      },
      {
        symbol: "BBRI",
        name: "Bank Rakyat Indonesia (Persero) Tbk",
        price: "4950",
        change: "50",
        changePercent: "1.02",
        summary: "BBRI menunjukkan akumulasi tersinkronisasi dengan volume solid. Struktur mendukung dengan momentum yang mulai selaras.",
        description: "Bank Rakyat Indonesia adalah bank BUMN dengan fokus pada segmen mikro dan UMKM, memiliki jaringan terluas di Indonesia.",
        sector: "Financials",
        subsector: "Banks",
        marketCap: "747.8T IDR",
        peRatio: "12.8",
        dividendYield: "3.8",
        roe: "19.5",
        netMargin: "24.2",
        growth: "10.5",
        investorView: "Bank dengan penetrasi mikro terbaik dan potensi pertumbuhan berkelanjutan.",
        financialSummary: "Pertumbuhan laba double digit didukung ekspansi kredit mikro.",
        revenue2023: "125.2T IDR",
        revenue2024: "138.5T IDR",
        revenue2025: "152.7T IDR",
        netProfit2023: "58.4T IDR",
        netProfit2024: "64.1T IDR",
        netProfit2025: "70.8T IDR",
        assets2023: "1,650.2T IDR",
        assets2024: "1,785.4T IDR",
        assets2025: "1,925.8T IDR",
        liabilities2023: "1,420.3T IDR",
        liabilities2024: "1,535.4T IDR",
        liabilities2025: "1,658.6T IDR",
        ocf2023: "42.5T IDR",
        ocf2024: "48.2T IDR",
        ocf2025: "54.7T IDR",
        tradingActivitySummary: "Volume meningkat 1.3x dengan akumulasi tersinkronisasi dari institusi.",
        flowOverviewSummary: "Akumulasi kuat 156.8B IDR dari institusi domestik dan asing.",
        flowBias: "Akumulasi",
        flowIntensity: "Akumulasi Besar",
        flowReliability: "Tinggi",
        brokerData: JSON.stringify([
          { code: "BK", name: "PT Mandiri Sekuritas", netBuy: "68.5B IDR", netSell: null, volumePercent: "14.2%", avgBuy: "4,920", avgSell: "4,960" },
          { code: "BNI", name: "PT BNI Securities", netBuy: "52.3B IDR", netSell: null, volumePercent: "11.8%", avgBuy: "4,925", avgSell: "4,955" }
        ]),
        foreignActivityData: JSON.stringify({
          foreignBuy: "125.2B IDR", foreignSell: "58.4B IDR", netForeignFlow: "66.8B IDR",
          domesticBuy: "285.7B IDR", domesticSell: "195.7B IDR", foreignPercent: 32, domesticPercent: 68
        }),
        avgBuyPrice: "4,922 IDR",
        avgSellPrice: "4,957 IDR",
        newsOverviewSummary: "Ekspansi kredit mikro dan digitalisasi menjadi pendorong pertumbuhan.",
        newsImpact: "Sedang",
        newsRelevance: "Struktural",
        newsFeed: JSON.stringify([
          { headline: "BBRI Capai 100 Juta Nasabah Mikro Digital", date: "2025-12-20", source: "CNBC Indonesia", impact: "Struktural" }
        ]),
        corporateActions: JSON.stringify([]),
        investorInterpretation: "Akumulasi tersinkronisasi mengkonfirmasi minat institusi yang kuat.",
        eventAnalysis: JSON.stringify([]),
        financialsAnalystView: "ROE 19.5% tertinggi di sektor dengan pertumbuhan berkelanjutan.",
        flowAnalystView: "Akumulasi kuat - struktur mendukung aksi akumulasi bertahap.",
        riskAnalystView: "Risiko kredit mikro perlu dipantau namun secara historis terkendali.",
        riskData: JSON.stringify({
          overview: "Profil risiko rendah-sedang dengan fundamental kuat.",
          level: "Rendah-Sedang",
          skew: "Positif",
          primaryRisks: [{ title: "Kualitas Kredit Mikro", why: "Sensitif terhadap kondisi ekonomi grassroot.", likelihood: "Rendah", impact: "Sedang" }],
          contrarianRisks: [],
          tension: "Valuasi premium untuk kualitas eksekusi yang konsisten.",
          invalidation: ["NPL mikro naik di atas 3%"],
          investorFit: { suitable: "Investor institusi dan ritel dengan horizon menengah.", unsuitable: "Trader jangka pendek." }
        }),
        insiderData: JSON.stringify({
          alignmentScore: 82,
          overview: "Insider menunjukkan akumulasi konsisten.",
          totalBuy: "52.2M IDR", totalSell: "8.8M IDR", netFlow: "+43.4M IDR",
          buyPercent: 86, sellPercent: 14, signalStrength: "Kuat",
          aiInterpretation: "Akumulasi insider mengkonfirmasi keyakinan manajemen terhadap prospek.",
          sentimentNote: "Dominasi beli 86% mencerminkan sentimen positif internal.",
          transactions: [
            { name: "Sunarso", position: "Direktur Utama", type: "Beli", shares: "200,000", price: "4,850", date: "2025-12-15" }
          ]
        }),
        aiConfidence: "Tinggi",
        idxIndices: JSON.stringify(["IDX30", "LQ45", "IDX80"]),
        sectorBadge: "SEKTOR KEUANGAN",
        stockTags: JSON.stringify(["Bank BUMN", "Blue Chip", "Micro Banking Leader"]),
        stockCharacter: "Institusional",
        stockCharacterDesc: "Pergerakan didominasi transaksi institusi yang terstruktur.",
        retailSentiment: "Sentimen ritel sangat positif.",
        foreignDomesticInterpretation: "Keduanya dalam mode akumulasi tersinkronisasi.",
        localRiskFactors: JSON.stringify([{ type: "Micro Credit", text: "Risiko kredit segmen mikro." }]),
        retailSummary: "Saham dengan struktur siap dan momentum yang mulai selaras - layak untuk akumulasi bertahap."
      },
      {
        symbol: "UNVR",
        name: "Unilever Indonesia Tbk",
        price: "1850",
        change: "-15",
        changePercent: "-0.80",
        summary: "UNVR dalam fase distribusi akhir siklus. Tekanan struktural dari pergeseran preferensi konsumen dan kompetisi lokal.",
        description: "Unilever Indonesia adalah produsen barang konsumen terkemuka dengan portofolio brand rumah tangga yang kuat.",
        sector: "Consumer Staples",
        subsector: "Household Products",
        marketCap: "70.8T IDR",
        peRatio: "18.5",
        dividendYield: "6.2",
        roe: "82.5",
        netMargin: "12.8",
        growth: "-8.5",
        investorView: "Saham defensif yang kehilangan momentum dengan tekanan margin dan market share.",
        financialSummary: "Pendapatan menurun dengan tekanan margin dari kompetisi lokal.",
        revenue2023: "42.5T IDR",
        revenue2024: "39.8T IDR",
        revenue2025: "36.5T IDR",
        netProfit2023: "5.8T IDR",
        netProfit2024: "5.1T IDR",
        netProfit2025: "4.5T IDR",
        assets2023: "22.4T IDR",
        assets2024: "20.7T IDR",
        assets2025: "19.4T IDR",
        liabilities2023: "15.3T IDR",
        liabilities2024: "14.5T IDR",
        liabilities2025: "13.8T IDR",
        ocf2023: "5.5T IDR",
        ocf2024: "4.8T IDR",
        ocf2025: "4.2T IDR",
        tradingActivitySummary: "Volume stabil dengan distribusi bertahap dari institusi.",
        flowOverviewSummary: "Distribusi 28.4B IDR tanpa tanda pembalikan trend.",
        flowBias: "Distribusi",
        flowIntensity: "Distribusi Sedang",
        flowReliability: "Tinggi",
        brokerData: JSON.stringify([
          { code: "CS", name: "PT Credit Suisse", netBuy: null, netSell: "15.5B IDR", volumePercent: "12.4%", avgBuy: "1,870", avgSell: "1,845" }
        ]),
        foreignActivityData: JSON.stringify({
          foreignBuy: "22.2B IDR", foreignSell: "38.4B IDR", netForeignFlow: "-16.2B IDR",
          domesticBuy: "35.7B IDR", domesticSell: "47.7B IDR", foreignPercent: 38, domesticPercent: 62
        }),
        avgBuyPrice: "1,865 IDR",
        avgSellPrice: "1,847 IDR",
        newsOverviewSummary: "Kompetisi dari brand lokal dan e-commerce menggerus market share.",
        newsImpact: "Tinggi",
        newsRelevance: "Struktural",
        newsFeed: JSON.stringify([
          { headline: "Brand Lokal Kuasai 40% Pasar FMCG Indonesia", date: "2025-12-12", source: "Nielsen", impact: "Struktural" }
        ]),
        corporateActions: JSON.stringify([]),
        investorInterpretation: "Distribusi berkelanjutan - akhir siklus terdeteksi.",
        eventAnalysis: JSON.stringify([]),
        financialsAnalystView: "ROE tinggi namun berbasis aset yang menyusut.",
        flowAnalystView: "Distribusi konsisten - kurangi eksposur.",
        riskAnalystView: "Risiko struktural dari disrupsi brand lokal dan digital.",
        riskData: JSON.stringify({
          overview: "Profil risiko tinggi dengan headwinds struktural.",
          level: "Tinggi",
          skew: "Negatif",
          primaryRisks: [
            { title: "Disrupsi Brand Lokal", why: "Brand lokal mengambil market share.", likelihood: "Tinggi", impact: "Tinggi" },
            { title: "E-commerce Disruption", why: "Perubahan kanal distribusi.", likelihood: "Tinggi", impact: "Sedang" }
          ],
          contrarianRisks: [],
          tension: "Yield tinggi vs penurunan fundamental berkelanjutan.",
          invalidation: ["Market share turun di bawah 25%"],
          investorFit: { suitable: "Income investor yang aware risiko.", unsuitable: "Growth investor dan investor konservatif." }
        }),
        insiderData: null,
        aiConfidence: "Tinggi",
        idxIndices: JSON.stringify(["LQ45"]),
        sectorBadge: "SEKTOR CONSUMER",
        stockTags: JSON.stringify(["FMCG", "High Yield", "Declining"]),
        stockCharacter: "Defensif Melemah",
        stockCharacterDesc: "Karakteristik defensif yang kehilangan daya tarik.",
        retailSentiment: "Sentimen ritel negatif dengan kekhawatiran fundamental.",
        foreignDomesticInterpretation: "Keduanya dalam mode distribusi.",
        localRiskFactors: JSON.stringify([{ type: "Brand Disruption", text: "Persaingan dari brand lokal." }]),
        retailSummary: "Saham dalam fase distribusi akhir siklus - kurangi eksposur secara bertahap."
      }
    ];

    for (const stockData of additionalStocks) {
      const existing = await storage.getStockBySymbol(stockData.symbol);
      if (!existing) {
        await storage.createStock(stockData);
        console.log(`Seeded ${stockData.symbol} stock data`);
      }
    }
  } catch (e) {
    console.error("Error seeding data (might be because tables don't exist yet):", e);
  }

  // ── Stocks routes ──────────────────────────────────────────────────────────────
  registerStocksRoutes(app);

  // Watchlist endpoints
  // ── Watchlist routes ─────────────────────────────────────────────────────────
  registerWatchlistRoutes(app);


  // ── AI routes ─────────────────────────────────────────────────────────────────
  registerAiRoutes(app);
  // ── Simulation routes ────────────────────────────────────────────────────────
  registerSimulationRoutes(app);

  // ── Radar routes ─────────────────────────────────────────────────────────────
  registerRadarRoutes(app);

  // ── Valuation routes ─────────────────────────────────────────────────────────
  registerValuationRoutes(app);

  // ── Macro/alt-data routes ────────────────────────────────────────────────────
  registerMacroRoutes(app);

  // ── Pipeline routes (history, ingest, monitor) ───────────────────────────────
  registerPipelineRoutes(app);

  // ── Signals routes ───────────────────────────────────────────────────────────
  registerSignalsRoutes(app);

  // ── Backtest routes ──────────────────────────────────────────────────────────
  registerBacktestRoutes(app);

  // ── Distribution routes ──────────────────────────────────────────────────────
  registerDistributionRoutes(app);

  // ── News routes ──────────────────────────────────────────────────────────────
  registerNewsRoutes(app);

  // ── Scraper routes ───────────────────────────────────────────────────────────
  registerScraperRoutes(app);


  // ── Insider + Management routes ──────────────────────────────────────────────
  registerInsiderRoutes(app);
  registerManagementRoutes(app);

  // ── IDX official market-data routes ──────────────────────────────────────────
  registerIdxDataRoutes(app);

  // ── Admin routes ─────────────────────────────────────────────────────────────
  registerAdminRoutes(app);

  return httpServer;
}
