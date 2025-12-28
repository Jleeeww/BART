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
        newsOverviewSummary: "Recent developments for BBCA are centered around strong quarterly performance and digital banking expansion. The news landscape is characterized by stable growth narratives and positive regulatory adjustments in the Indonesian banking sector, reinforcing the company's structural position as a market leader.",
        newsImpact: "Medium",
        newsRelevance: "Structural",
        newsFeed: JSON.stringify([
          { headline: "BBCA Reports 12% YoY Net Profit Growth in Q3 2025", date: "2025-10-25", source: "IDX News", impact: "Structural" },
          { headline: "Bank Indonesia Maintains Policy Rate, Positive for Banking Margins", date: "2025-11-15", source: "Business Times", impact: "Structural" },
          { headline: "BBCA Digital App Reaches 30 Million Active Users", date: "2025-12-05", source: "TechDaily", impact: "Temporary" },
          { headline: "Global Market Volatility Slightly Affects Local Financial Sector", date: "2025-12-20", source: "MarketWatch", impact: "Noise" }
        ]),
        corporateActions: JSON.stringify([
          { type: "Cash Dividend", date: "2025-04-10", status: "Completed", explanation: "Distributed IDR 205 per share, reflecting strong capital position and commitment to shareholder returns." },
          { type: "Stock Split", date: "2024-10-15", status: "Completed", explanation: "1:5 split to increase liquidity and make shares more accessible to retail investors." }
        ]),
        investorInterpretation: "Investors should view the current news flow as supportive of long-term stability. The combination of consistent profit growth and successful digital transformation suggests that the company's core fundamentals remain intact despite broader market noise. The structural relevance of recent earnings reports outweighs short-term volatility concerns.",
        eventAnalysis: JSON.stringify([
          {
            title: "Q3 2025 Earnings Report",
            event: "Bank Central Asia (BBCA) reported a 12% year-over-year increase in net profit for the third quarter of 2025, reaching a milestone in operational efficiency.",
            why: "Management attribute the growth to higher Net Interest Income (NII) and improved loan-to-deposit ratios, supported by Indonesia's steady consumer consumption and infrastructure financing demand.",
            immediate: "Positive market sentiment led to a 1.5% appreciation in share price immediately post-announcement. Capital adequacy remains robust, providing a strong cushion against macro shocks.",
            secondOrder: "Institutional investors are likely to rebalance toward banking as a defensive play. However, smaller retail banks may face liquidity competition as BBCA attracts more low-cost CASA deposits.",
            thesis: "Positive. The earnings reinforce the structural growth thesis. The ability to grow margins in a stable rate environment demonstrates superior operational leverage and market dominance."
          },
          {
            title: "Strategic Digital Acquisition",
            event: "BBCA announced the acquisition of a boutique fintech platform specializing in SME credit scoring and digital lending.",
            why: "The move is designed to accelerate digital penetration into the underbanked SME segment, where traditional credit assessment has been a bottleneck for growth.",
            immediate: "Minimal impact on share price due to the relatively small transaction size. Integration costs are expected to marginally impact short-term operating expenses.",
            secondOrder: "Long-term data advantage over competitors. Successful integration could lower cost-of-risk through better predictive analytics, though cultural integration remains a key execution risk.",
            thesis: "Conditional. Positive if digital synergy exceeds integration costs. The strategic value lies in defensive moats against emerging neo-banks by matching their technological agility."
          }
        ]),
        financialsAnalystView: "While the headline growth is impressive, analysts should monitor the sustainability of loan yield improvements. The trade-off between aggressive digital expansion and maintaining high Net Interest Margins (NIM) is a critical balance. Structural efficiency gains are visible, but macro-driven deposit competition could pressure funding costs in future periods.",
        flowAnalystView: "The current accumulation phase is driven by high-quality institutional demand. However, the concentration of ownership among top domestic funds creates a liquidity risk during periods of macro stress. The reliability of flow is high, but the trade-off is a potential for volatility if institutional sentiment shifts rapidly.",
        riskAnalystView: "Primary risk remains macro-sensitivity to global interest rate cycles. While domestic buffers are strong, the bank's valuation premium leaves little room for earnings disappointments. Structural risks are low, but regulatory shifts regarding capital requirements or digital banking oversight remain key uncertainties.",
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
