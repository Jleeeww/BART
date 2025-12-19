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
        summary: "BBCA shows stable fundamentals with consistent profitability and strong liquidity. Recent price movement appears driven by steady accumulation rather than speculative trading. Valuation remains relatively high compared to peers, reflecting its defensive profile. Main risk lies in slower growth versus smaller banks.",
        description: "PT Bank Central Asia Tbk is one of the largest commercial banks in Indonesia with a strong retail and SME banking franchise. Known for conservative credit policies and efficient operations.",
        sector: "Financials",
        subsector: "Banking",
        marketCap: "600.2T IDR",
        peRatio: "18.5",
        dividendYield: "3.20",
        roe: "15.8",
        netMargin: "28.4",
        growth: "5.2",
        investorView: "BBCA is viewed by investors as a defensive, income-oriented holding. The stock appeals to those seeking stability through established market leadership and consistent dividend payments. Conservative lending practices and strong loan portfolios have supported investor confidence across market cycles. Institutional ownership remains high, reflecting its liquidity and creditworthiness.",
        financialSummary: "BBCA demonstrates steady revenue growth supported by expanding loan portfolios and stable fee-based income. Net profit has remained consistent, reflecting efficient cost management and low loan loss provisions. Operating cash flow has grown steadily, indicating strong cash generation from banking operations. The balance sheet is characterized by substantial asset growth supported by carefully managed liabilities, maintaining appropriate capital ratios. These metrics reflect the bank's operational stability and prudent financial management.",
        revenue2023: "80.2T IDR",
        revenue2024: "85.5T IDR",
        revenue2025: "91.3T IDR",
        netProfit2023: "22.8T IDR",
        netProfit2024: "24.3T IDR",
        netProfit2025: "25.9T IDR",
        assets2023: "890.5T IDR",
        assets2024: "945.2T IDR",
        assets2025: "1,005.8T IDR",
        liabilities2023: "780.3T IDR",
        liabilities2024: "825.4T IDR",
        liabilities2025: "878.6T IDR",
        ocf2023: "28.5T IDR",
        ocf2024: "31.2T IDR",
        ocf2025: "34.7T IDR",
        tradingActivitySummary: "Recent trading patterns show institutional accumulation with steady volume participation.",
        flowOverviewSummary: "Trading flow analysis reveals a balanced institutional presence with moderate net accumulation. Domestic institutional investors have shown steady buying interest, while some profit-taking has occurred through selective sales by certain brokers. The overall flow pattern suggests cautious optimism among market participants, with typical positioning for a defensive banking stock.",
        flowBias: "Accumulation",
        flowIntensity: "Moderate Accumulation",
        flowReliability: "High",
        brokerData: JSON.stringify([
          { code: "BK", name: "PT Mandiri Sekuritas", netBuy: "125.5B IDR", netSell: null, volumePercent: "12.4%" },
          { code: "BNI", name: "PT BNI Securities", netBuy: "98.2B IDR", netSell: null, volumePercent: "9.8%" },
          { code: "CIMB", name: "PT CIMB Securities", netBuy: "72.3B IDR", netSell: null, volumePercent: "7.2%" },
          { code: "MBK", name: "PT Maybank Kim Eng", netBuy: null, netSell: "45.3B IDR", volumePercent: "8.7%" },
          { code: "BHS", name: "PT Bahana Securities", netBuy: null, netSell: "28.4B IDR", volumePercent: "6.5%" }
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

  return httpServer;
}
