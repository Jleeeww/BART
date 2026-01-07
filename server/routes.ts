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
    
    // Clamp score 0-100
    score = Math.max(0, Math.min(100, score));
    
    let interpretation = "";
    if (score > 80) interpretation = "Exceptional institutional conviction with high synchronization.";
    else if (score > 60) interpretation = "Solid accumulation pattern with moderate reliability.";
    else if (score > 40) interpretation = "Neutral flow characterized by lack of clear institutional consensus.";
    else if (score > 20) interpretation = "Distribution bias with emerging signs of institutional exit.";
    else interpretation = "Significant distribution across multiple participant types.";

    // Structured analyst-style response without buy/sell signals
    res.json({
      flow_analysis: `Institutional flow for ${payload.stock} shows ${payload.flow_signals.flow_intensity} ${payload.flow_signals.flow_bias} with ${payload.flow_signals.flow_reliability} reliability. The synchronized participation of domestic and foreign institutions suggests broad-based positioning.`,
      flowQualityScore: score,
      flowQualityInterpretation: interpretation,
      event_analysis: {
        impact: "Medium",
        relevance: "Structural",
        thesis: `The ${payload.event_specifics.event_type} (${payload.event_specifics.headline}) aligns with the long-term operational trajectory. Structural efficiency gains are visible, though macro-sensitivity remains a primary external factor.`,
        confidence: "High",
        conditions: "Assumes continued stability in domestic consumption and no significant contraction in Net Interest Margins (NIM)."
      },
      risk_analysis: `Primary risks for ${payload.stock} are centered on macro-driven de-rating and potential NIM compression if deposit competition intensifies. Asset quality remains stable, providing a robust defensive cushion.`
    });
  });

  return httpServer;
}
