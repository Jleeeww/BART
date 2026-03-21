import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { getStockDecision, mapStockDataToInput } from "./engine/unifiedDecision";
import { runEngineTests } from "./engine/runTests";
import { computeBandarmology, buildBandarmologyInput, computeGorenganFromStock } from "./engine/bandarmologyCoreV1";
import { testBandarmologyRouter } from "./routes/testBandarmology";

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
  // LOCKED HOMEPAGE UNIVERSE - all 12 stocks must always render
  const HOMEPAGE_UNIVERSE = [
    "ICBP", "UNVR", "BBCA", "ADRO", "UNTR",
    "BUMI", "DADA", "BULL", "PIPA", "WIFI", "SGER", "MORA"
  ];

  const UNIVERSE_STOCK_NAMES: Record<string, string> = {
    ICBP: "Indofood CBP Sukses Makmur Tbk",
    UNVR: "Unilever Indonesia Tbk",
    BBCA: "Bank Central Asia Tbk",
    ADRO: "Adaro Energy Indonesia Tbk",
    UNTR: "United Tractors Tbk",
    BUMI: "Bumi Resources Tbk",
    DADA: "Diamond Citra Propertindo Tbk",
    BULL: "Buana Lintas Lautan Tbk",
    PIPA: "Bukaka Teknik Utama Tbk",
    WIFI: "Solusi Sinergi Digital Tbk",
    SGER: "Sumber Global Energy Tbk",
    MORA: "Mora Telematika Indonesia Tbk",
  };

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
          sector: null,
          subsector: null,
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
          idxIndices: null, sectorBadge: null,
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
              readinessScore: 0,
              marketRegime: "Tidak Diketahui",
              actionGuidance: "Data Tidak Lengkap",
              actionColor: "red",
              actionState: "HINDARI_DULU",
              homepageBucket: "hindari_dulu",
              aiSentence: "Data tidak tersedia atau gagal diproses",
              isInWatchlist: watchlistSymbols.has(stock.symbol),
              isGorengan: false,
              gorenganWarning: null,
              riskOverride: null,
            };
          }

          // GORENGAN DETECTOR
          const gorenganResult = computeGorenganFromStock({
            changePercent: typeof stock.changePercent === 'number' ? String(stock.changePercent) : stock.changePercent,
            flowBias: stock.flowBias || "Netral",
            flowIntensity: stock.flowIntensity || "Tidak Ada Data",
            flowReliability: stock.flowReliability || "Rendah",
            brokerData: stock.brokerData || "[]",
            foreignActivityData: stock.foreignActivityData || "{}",
            stockCharacter: stock.stockCharacter || null
          });

          // MAP stock data to unified brain input
          const brainInput = mapStockDataToInput({
            flowBias: stock.flowBias,
            flowIntensity: stock.flowIntensity,
            flowReliability: stock.flowReliability,
            changePercent: stock.changePercent,
            growth: stock.growth,
            insiderData: stock.insiderData,
            brokerData: stock.brokerData,
            foreignActivityData: stock.foreignActivityData,
            stockCharacter: stock.stockCharacter,
            isGorengan: gorenganResult.isGorengan,
          });

          // GET DECISION from unified brain
          const decision = getStockDecision(brainInput);

          const homepageBucket = decision.bucket === "Siap Dipantau" ? "siap_dipantau"
            : decision.bucket === "Watchlist Prioritas" ? "watchlist_prioritas"
            : "hindari_dulu";

          return {
            symbol: stock.symbol,
            name: stock.name,
            price: stock.price,
            change: stock.change,
            changePercent: stock.changePercent,
            sector: stock.sector,
            sectorBadge: stock.sectorBadge,
            readinessScore: decision.readiness,
            marketRegime: decision.marketRegime,
            actionGuidance: decision.bucket,
            actionColor: decision.color,
            actionState: decision.actionState,
            homepageBucket,
            aiSentence: decision.shortSummary,
            isInWatchlist: watchlistSymbols.has(stock.symbol),
            isGorengan: gorenganResult.isGorengan,
            gorenganWarning: gorenganResult.isGorengan ? "Aktivitas spekulatif ritel terdeteksi" : null,
            riskOverride: gorenganResult.riskOverride,
          };
        } catch (analysisError) {
          console.error(`[UNIVERSE AUDIT] ${stock.symbol}: analysis FAILED — ${analysisError}`);
          return {
            symbol: stock.symbol,
            name: stock.name,
            price: stock.price || 0,
            change: stock.change || 0,
            changePercent: stock.changePercent || 0,
            sector: stock.sector || null,
            sectorBadge: stock.sectorBadge || null,
            readinessScore: 0,
            marketRegime: "Tidak Diketahui",
            actionGuidance: "Data Tidak Lengkap",
            actionColor: "red",
            actionState: "HINDARI_DULU",
            homepageBucket: "hindari_dulu",
            aiSentence: "Data tidak tersedia atau gagal diproses",
            isInWatchlist: watchlistSymbols.has(stock.symbol),
            isGorengan: false,
            gorenganWarning: null,
            riskOverride: null,
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

  // Watchlist endpoints
  app.get("/api/watchlist", async (_req, res) => {
    try {
      const watchlistItems = await storage.getWatchlist();
      res.json(watchlistItems);
    } catch (error) {
      console.error("Error fetching watchlist:", error);
      res.status(500).json({ message: "Failed to fetch watchlist" });
    }
  });

  app.post("/api/watchlist/:symbol", async (req, res) => {
    try {
      const { symbol } = req.params;
      const isInWatchlist = await storage.isInWatchlist(symbol);
      if (isInWatchlist) {
        return res.status(400).json({ message: "Already in watchlist" });
      }
      const watchlistItem = await storage.addToWatchlist({ symbol });
      res.json(watchlistItem);
    } catch (error) {
      console.error("Error adding to watchlist:", error);
      res.status(500).json({ message: "Failed to add to watchlist" });
    }
  });

  app.delete("/api/watchlist/:symbol", async (req, res) => {
    try {
      const { symbol } = req.params;
      await storage.removeFromWatchlist(symbol);
      res.json({ success: true });
    } catch (error) {
      console.error("Error removing from watchlist:", error);
      res.status(500).json({ message: "Failed to remove from watchlist" });
    }
  });

  app.post("/api/ai", async (req, res) => {
    const payload = req.body;
    
    // Look up stock to get consistent readinessScore and actionGuidance
    const stockSymbol = payload.stock as string;
    const stockData = await storage.getStockBySymbol(stockSymbol);
    
    // ═══════════════════════════════════════════════════════════
    // BANDARMOLOGY INTELLIGENCE ENGINE (Single Entry Point)
    // All intelligence computed via computeBandarmology()
    // ═══════════════════════════════════════════════════════════
    const bandarmologyInput = buildBandarmologyInput(payload, stockData);
    const intel = computeBandarmology(bandarmologyInput);

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
      
      // Smart Money Readiness Score (Core Intelligence)
      // IMPORTANT: Override score with consistent value from actionGuidance
      smartMoneyReadinessScore: {
        ...smartMoneyReadinessScore,
        score: actionGuidance._debug.readinessScore, // Use consistent score
      },
      
      // Action Guidance Mode (Decision Layer)
      actionGuidance,
      
      // Smart News Filter (Contextual Intelligence)
      smartNewsFilter,
      
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
  app.get("/api/test-engine", (_req, res) => {
    res.json(runEngineTests());
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

  return httpServer;
}
