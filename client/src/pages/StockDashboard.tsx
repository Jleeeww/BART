import { useEffect, useState } from "react";
import { useParams } from "wouter";
import { useStock } from "@/hooks/use-stocks";
async function fetchAIAnalysis(payload: any) {
  const res = await fetch("/api/ai", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error("AI analysis failed");
  }

  return res.json();
}
import { StockHeader } from "@/components/StockHeader";
import { AIStockSummary } from "@/components/AIStockSummary";
import { PriceChart } from "@/components/PriceChart";
import { MetricCard } from "@/components/MetricCard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { 
  Loader2, 
  PieChart, 
  TrendingUp, 
  DollarSign, 
  Activity, 
  Newspaper, 
  AlertTriangle 
} from "lucide-react";
import { motion } from "framer-motion";

function ConvictionTimeline({ phase, explanation }: { phase: string; explanation: string }) {
  const phases = ["Positioning", "Confirmation", "Crowding", "Distribution", "Reset"];
  const currentIndex = phases.indexOf(phase);

  return (
    <Card className="p-4 border-border/50 shadow-sm bg-muted/20">
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Conviction Lifecycle</p>
        <span className="text-xs font-bold px-2 py-0.5 rounded bg-primary/10 text-primary uppercase">{phase}</span>
      </div>
      <div className="relative h-2 bg-muted rounded-full overflow-hidden flex mb-3">
        {phases.map((p, idx) => (
          <div 
            key={p} 
            className={`flex-1 h-full transition-all border-r border-background/20 last:border-0 ${
              idx === currentIndex ? "bg-primary" : idx < currentIndex ? "bg-primary/40" : "bg-transparent"
            }`}
          />
        ))}
      </div>
      <div className="flex justify-between text-[10px] text-muted-foreground uppercase font-bold px-0.5 mb-3">
        {phases.map((p, idx) => (
          <span key={p} className={idx === currentIndex ? "text-primary" : ""}>{p}</span>
        ))}
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed italic border-t border-border/20 pt-3">
        {explanation}
      </p>
    </Card>
  );
}

export default function StockDashboard() {
  const { symbol = "BBCA" } = useParams<{ symbol: string }>();
  const [activeTab, setActiveTab] = useState("overview");
  const { data: stock, isLoading, error } = useStock(symbol);
  const [aiData, setAIData] = useState<any>(null);
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    if (!stock) return;

    setAiLoading(true);
    const payload = {
      stock: stock.symbol,
      date: new Date().toISOString().split('T')[0],
      context: stock.summary,

      price_context: {
        last_price: parseFloat(stock.price.replace(/,/g, "")),
        d1_change_pct: parseFloat(stock.changePercent),
        volume_vs_avg: 1.2,
      },

      flow_signals: {
        net_foreign_buy_idr: 92800000000,
        net_domestic_buy_idr: 130400000000,
        flow_bias: stock.flowBias,
        flow_intensity: stock.flowIntensity,
        flow_reliability: stock.flowReliability,
        buy_avg_price: parseFloat(stock.avgBuyPrice.replace(/[^0-9.]/g, "")),
        sell_avg_price: parseFloat(stock.avgSellPrice.replace(/[^0-9.]/g, "")),
      },

      fundamentals: {
        roe: parseFloat(stock.roe),
        net_margin: parseFloat(stock.netMargin),
        yoy_profit_growth_pct: parseFloat(stock.growth),
        capital_adequacy: "Strong",
      },

      event_specifics: {
        event_type: "Market Update",
        headline: `${stock.symbol} market activity analysis`,
      },
    };

    fetchAIAnalysis(payload)
      .then(setAIData)
      .catch(console.error)
      .finally(() => setAiLoading(false));
  }, [stock]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-12 h-12 text-primary animate-spin" />
          <p className="text-muted-foreground font-medium animate-pulse">Loading market data...</p>
        </div>
      </div>
    );
  }

  if (error || !stock) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full p-8 text-center border-destructive/20 bg-destructive/5">
          <AlertTriangle className="w-12 h-12 text-destructive mx-auto mb-4" />
          <h2 className="text-xl font-bold text-foreground mb-2">Unable to load stock</h2>
          <p className="text-muted-foreground mb-6">
            We couldn't retrieve data for {symbol}. Please try again later.
          </p>
          <button 
            onClick={() => window.location.reload()}
            className="px-6 py-2 bg-background border border-border rounded-lg font-semibold hover:bg-secondary transition-colors"
          >
            Retry
          </button>
        </Card>
      </div>
    );
  }

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { 
      opacity: 1,
      transition: { 
        staggerChildren: 0.1,
        duration: 0.5
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 }
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="bg-card border-b border-border sticky top-0 z-30 shadow-sm backdrop-blur-xl bg-card/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="font-display font-bold text-xl tracking-tight">BR Trade</span>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-secondary text-secondary-foreground text-sm font-medium">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Market Open
            </div>
            <div className="w-8 h-8 rounded-full bg-secondary border border-border overflow-hidden">
              <img 
                src="https://api.dicebear.com/7.x/avataaars/svg?seed=Felix" 
                alt="User" 
                className="w-full h-full object-cover"
              />
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <motion.div 
          initial="hidden"
          animate="visible"
          variants={containerVariants}
          className="space-y-8"
        >
          {/* Header Section */}
          <motion.div variants={itemVariants}>
            <StockHeader stock={stock} />
          </motion.div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Main Chart Section */}
            <motion.div variants={itemVariants} className="lg:col-span-2 space-y-6">
              <PriceChart />
              
              <Tabs defaultValue="overview" value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="w-full justify-start h-auto p-1 bg-secondary/50 rounded-xl overflow-x-auto no-scrollbar">
                  {[
                    { id: "overview", label: "Overview", icon: PieChart },
                    { id: "financials", label: "Financials", icon: DollarSign },
                    { id: "valuation", label: "Valuation", icon: TrendingUp },
                    { id: "flow", label: "Flow", icon: Activity },
                    { id: "news", label: "News", icon: Newspaper },
                    { id: "risk", label: "Risk", icon: AlertTriangle },
                  ].map((tab) => (
                    <TabsTrigger 
                      key={tab.id} 
                      value={tab.id}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-lg data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm transition-all"
                    >
                      <tab.icon className="w-4 h-4" />
                      {tab.label}
                    </TabsTrigger>
                  ))}
                </TabsList>
                
                <div className="mt-6">
                  <TabsContent value="overview" className="mt-0 focus-visible:outline-none space-y-6">
                    <Card className="p-6 border-border/50 shadow-sm">
                      <h3 className="text-xl font-bold font-display mb-4">Company Profile</h3>
                      {!aiLoading && aiData && (
                        <div className="mb-6">
                          <ConvictionTimeline phase={aiData.convictionPhase} explanation={aiData.convictionExplanation} />
                        </div>
                      )}
                      <p className="text-muted-foreground leading-relaxed mb-6">
                        {stock.description}
                      </p>
                      
                      <div className="grid grid-cols-2 gap-6 mb-8">
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-1">Sector</p>
                          <p className="text-lg font-semibold text-foreground">{stock.sector}</p>
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-1">Subsector</p>
                          <p className="text-lg font-semibold text-foreground">{stock.subsector}</p>
                        </div>
                      </div>
                      
                      <div className="pt-6 border-t border-border/50">
                        <h4 className="text-sm font-bold text-foreground uppercase tracking-wider mb-4">Key Metrics</h4>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <MetricCard 
                            label="P/E Ratio" 
                            value={parseFloat(stock.peRatio).toFixed(2)} 
                            trend="neutral"
                          />
                          <MetricCard 
                            label="ROE" 
                            value={`${parseFloat(stock.roe).toFixed(1)}%`}
                            trend="up"
                          />
                          <MetricCard 
                            label="Net Margin" 
                            value={`${parseFloat(stock.netMargin).toFixed(1)}%`}
                            trend="neutral"
                          />
                          <MetricCard 
                            label="YoY Growth" 
                            value={`${parseFloat(stock.growth).toFixed(1)}%`}
                            trend="up"
                          />
                        </div>
                      </div>
                    </Card>

                    <Card className="p-6 border-border/50 shadow-sm bg-gradient-to-br from-primary/5 to-primary/10 dark:from-primary/10 dark:to-primary/5">
                      <h3 className="text-lg font-bold font-display mb-4 text-foreground">How investors typically view this stock</h3>
                      <p className="text-muted-foreground leading-relaxed">
                        {stock.investorView}
                        {aiData?.flowQualityScore < 50 && " Caution is advised as current accumulation patterns show signs of low institutional consensus."}
                        {aiData?.flowQualityScore > 75 && " Market participants should note potential crowding risk as institutional conviction reaches high levels."}
                      </p>
                    </Card>
                  </TabsContent>
                  
                  {/* Financials Tab */}
                  <TabsContent value="financials" className="mt-0 focus-visible:outline-none space-y-6">
                    <Card className="p-6 border-border/50 shadow-sm bg-gradient-to-br from-primary/5 to-primary/10 dark:from-primary/10 dark:to-primary/5">
                      <h3 className="text-lg font-bold font-display mb-4 text-foreground">Financial Performance Summary</h3>
                      <p className="text-muted-foreground leading-relaxed mb-4">
                        {stock.financialSummary}
                        {aiData?.flowQualityScore < 50 && " The current financial trajectory should be weighed against emerging institutional distribution risks."}
                        {aiData?.flowQualityScore > 75 && " Strong financial milestones are increasingly reflected in concentrated institutional positioning."}
                      </p>
                      <div className="mt-4 p-4 bg-primary/5 border border-primary/10 rounded-md">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-2 flex items-center gap-2">
                          <Activity className="w-3 h-3" />
                          Analyst Financial Perspective
                        </p>
                        <p className="text-sm text-muted-foreground leading-relaxed italic">
                          {stock.financialsAnalystView}
                        </p>
                      </div>
                    </Card>

                    <Card className="p-6 border-border/50 shadow-sm">
                      <h4 className="text-base font-bold font-display mb-4 text-foreground">Income Statement</h4>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-border/50">
                              <th className="text-left py-3 px-3 font-semibold text-foreground">Metric</th>
                              <th className="text-right py-3 px-3 font-semibold text-foreground">2023</th>
                              <th className="text-right py-3 px-3 font-semibold text-foreground">2024</th>
                              <th className="text-right py-3 px-3 font-semibold text-foreground">2025</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr className="border-b border-border/30 hover:bg-muted/30">
                              <td className="py-3 px-3 text-muted-foreground">Revenue</td>
                              <td className="text-right py-3 px-3 font-mono text-foreground">{stock.revenue2023}</td>
                              <td className="text-right py-3 px-3 font-mono text-foreground">{stock.revenue2024}</td>
                              <td className="text-right py-3 px-3 font-mono text-foreground">{stock.revenue2025}</td>
                            </tr>
                            <tr className="border-b border-border/30 hover:bg-muted/30">
                              <td className="py-3 px-3 text-muted-foreground">Net Profit</td>
                              <td className="text-right py-3 px-3 font-mono text-foreground">{stock.netProfit2023}</td>
                              <td className="text-right py-3 px-3 font-mono text-foreground">{stock.netProfit2024}</td>
                              <td className="text-right py-3 px-3 font-mono text-foreground">{stock.netProfit2025}</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </Card>

                    <Card className="p-6 border-border/50 shadow-sm">
                      <h4 className="text-base font-bold font-display mb-4 text-foreground">Balance Sheet</h4>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-border/50">
                              <th className="text-left py-3 px-3 font-semibold text-foreground">Metric</th>
                              <th className="text-right py-3 px-3 font-semibold text-foreground">2023</th>
                              <th className="text-right py-3 px-3 font-semibold text-foreground">2024</th>
                              <th className="text-right py-3 px-3 font-semibold text-foreground">2025</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr className="border-b border-border/30 hover:bg-muted/30">
                              <td className="py-3 px-3 text-muted-foreground">Total Assets</td>
                              <td className="text-right py-3 px-3 font-mono text-foreground">{stock.assets2023}</td>
                              <td className="text-right py-3 px-3 font-mono text-foreground">{stock.assets2024}</td>
                              <td className="text-right py-3 px-3 font-mono text-foreground">{stock.assets2025}</td>
                            </tr>
                            <tr className="border-b border-border/30 hover:bg-muted/30">
                              <td className="py-3 px-3 text-muted-foreground">Total Liabilities</td>
                              <td className="text-right py-3 px-3 font-mono text-foreground">{stock.liabilities2023}</td>
                              <td className="text-right py-3 px-3 font-mono text-foreground">{stock.liabilities2024}</td>
                              <td className="text-right py-3 px-3 font-mono text-foreground">{stock.liabilities2025}</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </Card>

                    <Card className="p-6 border-border/50 shadow-sm">
                      <h4 className="text-base font-bold font-display mb-4 text-foreground">Cash Flow</h4>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-border/50">
                              <th className="text-left py-3 px-3 font-semibold text-foreground">Metric</th>
                              <th className="text-right py-3 px-3 font-semibold text-foreground">2023</th>
                              <th className="text-right py-3 px-3 font-semibold text-foreground">2024</th>
                              <th className="text-right py-3 px-3 font-semibold text-foreground">2025</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr className="border-b border-border/30 hover:bg-muted/30">
                              <td className="py-3 px-3 text-muted-foreground">Operating Cash Flow</td>
                              <td className="text-right py-3 px-3 font-mono text-foreground">{stock.ocf2023}</td>
                              <td className="text-right py-3 px-3 font-mono text-foreground">{stock.ocf2024}</td>
                              <td className="text-right py-3 px-3 font-mono text-foreground">{stock.ocf2025}</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </Card>
                  </TabsContent>

                  {/* Flow Tab */}
                  <TabsContent value="flow" className="mt-0 focus-visible:outline-none space-y-6">
                    {/* SECTION 1: AI Flow Overview */}
                    <Card className="p-6 border-border/50 shadow-sm bg-gradient-to-br from-primary/5 to-primary/10 dark:from-primary/10 dark:to-primary/5">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-bold font-display text-foreground">AI Flow Overview</h3>
                        {!aiLoading && aiData && (
                          <div className="text-right">
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Flow Quality</p>
                            <p className="text-2xl font-bold text-primary">{aiData.flowQualityScore}/100</p>
                          </div>
                        )}
                      </div>
                      <p className="text-muted-foreground leading-relaxed mb-6">
                        {aiLoading ? "Analyzing market flow..." : (aiData?.flow_analysis || stock.flowOverviewSummary)}
                      </p>
                      
                      {!aiLoading && aiData?.flowQualityInterpretation && (
                        <div className="mb-6 space-y-4">
                          <ConvictionTimeline phase={aiData.convictionPhase} explanation={aiData.convictionExplanation} />
                          <div className="p-4 bg-background/50 rounded-lg border border-border/30">
                            <p className="text-sm font-medium text-foreground">{aiData.flowQualityInterpretation}</p>
                          {aiData.earlyDistributionFlag && (
                            <div className="mt-3 pt-3 border-t border-border/20">
                              <p className="text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-widest mb-1 flex items-center gap-1.5">
                                <AlertTriangle className="w-3 h-3" />
                                Early Distribution Risk Detected
                              </p>
                              <p className="text-sm text-muted-foreground italic">{aiData.earlyDistributionExplanation}</p>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Flow Intensity Gradient Bar */}
                      <div className="mb-6">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">Flow Intensity</p>
                        <div className="space-y-2">
                          <div className="relative h-8 rounded-md border border-border/30 overflow-hidden flex items-center">
                            <div className="absolute inset-0 bg-gradient-to-r from-red-500 via-neutral-400 to-emerald-500 dark:from-red-600 dark:via-neutral-500 dark:to-emerald-600" />
                            {(() => {
                              const intensityValues: Record<string, number> = {
                                "Big Distribution": 10,
                                "Moderate Distribution": 30,
                                "Neutral": 50,
                                "Moderate Accumulation": 70,
                                "Big Accumulation": 90,
                              };
                              const position = intensityValues[stock.flowIntensity] || 50;
                              return (
                                <div
                                  className="absolute w-0.5 h-10 bg-foreground shadow-lg rounded-full -top-1 transition-all"
                                  style={{ left: `${position}%` }}
                                />
                              );
                            })()}
                          </div>
                          <div className="flex justify-between text-xs text-muted-foreground px-1">
                            <span>Big Distribution</span>
                            <span>Big Accumulation</span>
                          </div>
                        </div>
                        <p className="text-sm font-semibold text-foreground mt-3">{stock.flowIntensity}</p>
                      </div>

                      <div className="grid grid-cols-2 gap-6">
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-2">Flow Bias</p>
                          <p className="text-base font-semibold text-foreground">{stock.flowBias}</p>
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-2">Flow Reliability</p>
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary">
                            {stock.flowReliability}
                          </span>
                        </div>
                      </div>
                    </Card>

                    {/* SECTION 2: Broker Summary */}
                    <Card className="p-6 border-border/50 shadow-sm">
                      <h4 className="text-base font-bold font-display mb-4 text-foreground">Broker Summary</h4>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-border/50">
                              <th className="text-left py-3 px-3 font-semibold text-foreground">Broker Code</th>
                              <th className="text-left py-3 px-3 font-semibold text-foreground">Broker Name</th>
                              <th className="text-right py-3 px-3 font-semibold text-foreground">Avg Buy</th>
                              <th className="text-right py-3 px-3 font-semibold text-foreground">Avg Sell</th>
                              <th className="text-right py-3 px-3 font-semibold text-foreground">Net Buy (IDR)</th>
                              <th className="text-right py-3 px-3 font-semibold text-foreground">Net Sell (IDR)</th>
                              <th className="text-right py-3 px-3 font-semibold text-foreground">% of Volume</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(() => {
                              try {
                                const brokers = JSON.parse(stock.brokerData);
                                const sorted = [...brokers].sort((a: any, b: any) => {
                                  const aVal = parseFloat(a.netBuy?.replace(/[B IDR]/g, "") || a.netSell?.replace(/[B IDR]/g, "") || "0");
                                  const bVal = parseFloat(b.netBuy?.replace(/[B IDR]/g, "") || b.netSell?.replace(/[B IDR]/g, "") || "0");
                                  return bVal - aVal;
                                });
                                return sorted.map((broker: any, index: number) => (
                                  <tr key={index} className="border-b border-border/30 hover:bg-muted/30">
                                    <td className="py-3 px-3 font-mono font-semibold text-foreground">{broker.code}</td>
                                    <td className="py-3 px-3 text-muted-foreground">{broker.name}</td>
                                    <td className="text-right py-3 px-3 font-mono text-emerald-600 dark:text-emerald-400">{broker.avgBuy || "—"}</td>
                                    <td className="text-right py-3 px-3 font-mono text-red-600 dark:text-red-400">{broker.avgSell || "—"}</td>
                                    <td className="text-right py-3 px-3 font-mono">
                                      {broker.netBuy ? (
                                        <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                                          {broker.netBuy}
                                        </span>
                                      ) : (
                                        <span className="text-muted-foreground">—</span>
                                      )}
                                    </td>
                                    <td className="text-right py-3 px-3 font-mono">
                                      {broker.netSell ? (
                                        <span className="text-red-600 dark:text-red-400 font-semibold">
                                          {broker.netSell}
                                        </span>
                                      ) : (
                                        <span className="text-muted-foreground">—</span>
                                      )}
                                    </td>
                                    <td className="text-right py-3 px-3 font-mono text-foreground">{broker.volumePercent}</td>
                                  </tr>
                                ));
                              } catch (e) {
                                return (
                                  <tr>
                                    <td colSpan={7} className="py-3 px-3 text-muted-foreground text-center">
                                      No broker data available
                                    </td>
                                  </tr>
                                );
                              }
                            })()}
                          </tbody>
                        </table>
                      </div>

                      {/* Average Transaction Price Section */}
                      <div className="mt-6 pt-6 border-t border-border/30">
                        <h5 className="text-sm font-bold font-display mb-4 text-foreground">Average Transaction Price</h5>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Buy Average Price</p>
                            <p className="text-lg font-semibold text-emerald-600 dark:text-emerald-400 font-mono">{stock.avgBuyPrice}</p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Sell Average Price</p>
                            <p className="text-lg font-semibold text-red-600 dark:text-red-400 font-mono">{stock.avgSellPrice}</p>
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground mt-3">
                          The narrow spread between buy and sell prices indicates institutional participation with minimal price friction during execution.
                        </p>
                      </div>
                    </Card>

                    {/* SECTION 3: Foreign vs Domestic Activity */}
                    <Card className="p-6 border-border/50 shadow-sm space-y-6">
                      <div>
                        <h4 className="text-base font-bold font-display mb-4 text-foreground">Foreign vs Domestic Activity</h4>
                        {(() => {
                          try {
                            const data = JSON.parse(stock.foreignActivityData);
                            return (
                              <div className="space-y-6">
                                {/* ... existing visual elements ... */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                  <div className="space-y-3">
                                    <h5 className="text-sm font-semibold text-foreground">Foreign Investors</h5>
                                    <div className="space-y-2 text-sm">
                                      <div className="flex justify-between items-center">
                                        <span className="text-muted-foreground">Buy:</span>
                                        <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">{data.foreignBuy}</span>
                                      </div>
                                      <div className="flex justify-between items-center">
                                        <span className="text-muted-foreground">Sell:</span>
                                        <span className="font-mono font-semibold text-red-600 dark:text-red-400">{data.foreignSell}</span>
                                      </div>
                                      <div className="flex justify-between items-center border-t border-border/30 pt-2">
                                        <span className="text-muted-foreground font-semibold">Net Flow:</span>
                                        <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">{data.netForeignFlow}</span>
                                      </div>
                                    </div>
                                  </div>

                                  <div className="space-y-3">
                                    <h5 className="text-sm font-semibold text-foreground">Domestic Investors</h5>
                                    <div className="space-y-2 text-sm">
                                      <div className="flex justify-between items-center">
                                        <span className="text-muted-foreground">Buy:</span>
                                        <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">{data.domesticBuy}</span>
                                      </div>
                                      <div className="flex justify-between items-center">
                                        <span className="text-muted-foreground">Sell:</span>
                                        <span className="font-mono font-semibold text-red-600 dark:text-red-400">{data.domesticSell}</span>
                                      </div>
                                    </div>
                                  </div>
                                </div>

                                {/* Participation Split ... */}
                                <div className="space-y-3">
                                  <h5 className="text-sm font-semibold text-foreground">Participation Split</h5>
                                  <div className="flex items-center gap-3">
                                    <div className="flex-1 h-6 rounded-md overflow-hidden border border-border/30 flex">
                                      <div className="bg-blue-500 dark:bg-blue-400 transition-all" style={{ width: `${data.domesticPercent}%` }} />
                                      <div className="bg-amber-500 dark:bg-amber-400 transition-all" style={{ width: `${data.foreignPercent}%` }} />
                                    </div>
                                    <div className="flex gap-4 text-xs font-semibold whitespace-nowrap">
                                      <span><span className="inline-block w-3 h-3 rounded-sm bg-blue-500 dark:bg-blue-400 mr-1" />{data.domesticPercent}%</span>
                                      <span><span className="inline-block w-3 h-3 rounded-sm bg-amber-500 dark:bg-amber-400 mr-1" />{data.foreignPercent}%</span>
                                    </div>
                                  </div>
                                </div>

                                {/* Analyst View Section for Flow */}
                                <div className="mt-4 p-4 bg-primary/5 border border-primary/10 rounded-md">
                                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-2 flex items-center gap-2">
                                    <Activity className="w-3 h-3" />
                                    Analyst Flow Perspective
                                  </p>
                                  <p className="text-sm text-muted-foreground leading-relaxed italic">
                                    {stock.flowAnalystView}
                                  </p>
                                </div>
                              </div>
                            );
                          } catch (e) {
                            return null;
                          }
                        })()}
                      </div>
                    </Card>
                  </TabsContent>

                  {/* News Tab */}
                  <TabsContent value="news" className="mt-0 focus-visible:outline-none space-y-6">
                    {/* SECTION 1: AI News Overview */}
                    <Card className="p-6 border-border/50 shadow-sm bg-gradient-to-br from-primary/5 to-primary/10 dark:from-primary/10 dark:to-primary/5">
                      <h3 className="text-lg font-bold font-display mb-4 text-foreground">AI News Overview</h3>
                      <p className="text-muted-foreground leading-relaxed mb-6">
                        {aiLoading ? "Processing event data..." : (aiData?.event_analysis.thesis || stock.newsOverviewSummary)}
                      </p>
                      <div className="grid grid-cols-2 gap-6">
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-2">News Impact</p>
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
                            stock.newsImpact === "High" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" :
                            stock.newsImpact === "Medium" ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" :
                            "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400"
                          }`}>
                            {stock.newsImpact}
                          </span>
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-2">Relevance</p>
                          <p className="text-base font-semibold text-foreground">{stock.newsRelevance}</p>
                        </div>
                      </div>
                    </Card>

                    {/* SECTION 2: Event Analysis (Analyst Framework) */}
                    <div className="space-y-4">
                      <h3 className="text-lg font-bold font-display text-foreground px-1">Event Analysis</h3>
                      {(() => {
                        try {
                          const events = JSON.parse(stock.eventAnalysis);
                          return events.map((event: any, index: number) => (
                            <Card key={index} className="overflow-hidden border-border/50 shadow-sm">
                              <div className="bg-muted/30 px-6 py-4 border-b border-border/50 flex items-center justify-between">
                                <h4 className="font-bold text-foreground">{event.title}</h4>
                                <span className={`text-xs font-bold px-2 py-1 rounded uppercase tracking-tighter ${
                                  event.thesis.startsWith("Positive") ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400" :
                                  event.thesis.startsWith("Negative") ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400" :
                                  "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
                                }`}>
                                  Thesis: {event.thesis.split(".")[0]}
                                </span>
                              </div>
                              <div className="p-6 space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                  <div className="space-y-4">
                                    <div>
                                      <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                                        <Activity className="w-3 h-3" />
                                        What Happened?
                                      </p>
                                      <p className="text-sm text-foreground leading-relaxed">{event.event}</p>
                                    </div>
                                    <div>
                                      <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                                        <TrendingUp className="w-3 h-3" />
                                        Drivers (Why?)
                                      </p>
                                      <p className="text-sm text-foreground leading-relaxed">{event.why}</p>
                                    </div>
                                  </div>
                                  <div className="space-y-4">
                                    <div>
                                      <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                                        <Activity className="w-3 h-3" />
                                        Immediate Market Reaction
                                      </p>
                                      <p className="text-sm text-foreground leading-relaxed">{event.immediate}</p>
                                    </div>
                                    <div>
                                      <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                                        <Activity className="w-3 h-3" />
                                        Second-Order Effects
                                      </p>
                                      <p className="text-sm text-foreground leading-relaxed">{event.secondOrder}</p>
                                    </div>
                                  </div>
                                </div>

                                <div className="pt-4 border-t border-border/30">
                                  <div className="bg-primary/5 rounded-lg p-4 border border-primary/10">
                                    <div className="flex items-center justify-between mb-2">
                                      <p className="text-xs font-bold text-primary uppercase tracking-widest flex items-center gap-1.5">
                                        <AlertTriangle className="w-3 h-3" />
                                        Analyst Confidence: {event.confidence}
                                      </p>
                                    </div>
                                    <p className="text-xs text-muted-foreground italic leading-relaxed">
                                      <span className="font-bold not-italic text-foreground">Conditions for continuation:</span> {event.conditions}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            </Card>
                          ));
                        } catch (e) {
                          return null;
                        }
                      })()}
                    </div>

                    {/* SECTION 3: News Feed */}
                    <Card className="p-6 border-border/50 shadow-sm">
                      <h4 className="text-base font-bold font-display mb-4 text-foreground">Recent Activity Feed</h4>
                      <div className="space-y-4">
                        {(() => {
                          try {
                            const news = JSON.parse(stock.newsFeed);
                            return news.map((item: any, index: number) => (
                              <div key={index} className="flex gap-4 pb-4 border-b border-border/30 last:border-0 last:pb-0">
                                <div className="flex-1">
                                  <div className="flex justify-between items-start mb-1">
                                    <h5 className="text-sm font-bold text-foreground leading-tight">{item.headline}</h5>
                                    <span className="text-[10px] font-mono text-muted-foreground whitespace-nowrap ml-4">{item.date}</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs text-muted-foreground">{item.source}</span>
                                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-tighter ${
                                      item.impact === "Structural" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" :
                                      item.impact === "Temporary" ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" :
                                      "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-500"
                                    }`}>
                                      {item.impact}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            ));
                          } catch (e) {
                            return null;
                          }
                        })()}
                      </div>
                    </Card>

                    {/* Corporate Action Summary */}
                    <Card className="p-6 border-border/50 shadow-sm bg-gradient-to-br from-primary/5 to-primary/10 dark:from-primary/10 dark:to-primary/5">
                      <h3 className="text-lg font-bold font-display mb-4 text-foreground">What This Means for Investors</h3>
                      <p className="text-muted-foreground leading-relaxed">
                        {stock.investorInterpretation}
                        {aiData?.flowQualityScore < 50 && " The current accumulation signals carry a significant risk of being 'noise' or false positives due to low quality scores."}
                        {aiData?.flowQualityScore > 75 && " While institutional support is high quality, the concentrated positioning may limit immediate upside without further structural catalysts."}
                        {aiData?.earlyDistributionFlag && " Analysts observe signs of liquidity rotation. Chasing current price strength is discouraged as alpha-seeking attractiveness diminishes."}
                        {(aiData?.convictionPhase === "Crowding" || aiData?.convictionPhase === "Distribution") && " High consensus levels suggest narrative saturation. Investors are advised to monitor for liquidity traps rather than chasing volatility."}
                      </p>
                    </Card>
                  </TabsContent>

                  {/* Risk Tab */}
                  <TabsContent value="risk" className="mt-0 focus-visible:outline-none space-y-6">
                    {(() => {
                      try {
                        const risk = JSON.parse(stock.riskData);
                        return (
                          <div className="space-y-6">
                            {/* SECTION 1: AI Risk Overview */}
                            <Card className="p-6 border-border/50 shadow-sm bg-gradient-to-br from-primary/5 to-primary/10 dark:from-primary/10 dark:to-primary/5">
                              <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-bold font-display text-foreground uppercase tracking-tight">AI Risk Analysis</h3>
                                {!aiLoading && aiData && (
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-primary/10 text-primary uppercase">
                                    Cycle: {aiData.convictionPhase}
                                  </span>
                                )}
                              </div>
                              {aiData && (
                                <div className="mb-6">
                                  <ConvictionTimeline phase={aiData.convictionPhase} explanation={aiData.convictionExplanation} />
                                </div>
                              )}
                              <p className="text-muted-foreground leading-relaxed mb-6">
                                {aiLoading ? "Evaluating risk factors..." : (aiData?.risk_analysis || stock.riskAnalystView)}
                                {aiData?.flowQualityScore < 50 && " The low flow quality score suggests that apparent accumulation may not be sustained, introducing a risk of sudden price reversals."}
                                {aiData?.flowQualityScore > 75 && " Crowding risk is elevated; the high consensus among institutional participants may lead to sharp drawdowns if the narrative shifts."}
                                {aiData?.earlyDistributionFlag && " EARLY DISTRIBUTION ALERT: Internal signals suggest institutional rotation is underway despite positive headline flows."}
                              </p>
                              <div className="grid grid-cols-2 gap-6">
                                <div>
                                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">Overall Risk Level</p>
                                  <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${
                                    risk.level === 'Low' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400' :
                                    risk.level === 'Moderate' ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400' :
                                    'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                                  }`}>
                                    {risk.level}
                                  </span>
                                </div>
                                <div>
                                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">Analyst Skew</p>
                                  <p className="text-base font-bold text-foreground">{risk.skew}</p>
                                </div>
                              </div>
                            </Card>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              <div className="space-y-4">
                                <h4 className="text-sm font-bold text-foreground uppercase tracking-widest px-1">Primary Market Risks</h4>
                                {risk.primaryRisks.map((r: any, idx: number) => (
                                  <Card key={idx} className="p-4 border-border/50 hover-elevate transition-all">
                                    <div className="flex justify-between items-start mb-2">
                                      <h5 className="font-bold text-sm">{r.title}</h5>
                                      <div className="flex gap-1.5">
                                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 uppercase">
                                          L: {r.likelihood}
                                        </span>
                                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 uppercase">
                                          I: {r.impact}
                                        </span>
                                      </div>
                                    </div>
                                    <p className="text-xs text-muted-foreground leading-relaxed">{r.why}</p>
                                  </Card>
                                ))}
                              </div>

                              <div className="space-y-4">
                                <h4 className="text-sm font-bold text-foreground uppercase tracking-widest px-1 flex items-center gap-2">
                                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                                  Contrarian Risks
                                </h4>
                                {risk.contrarianRisks.map((r: any, idx: number) => (
                                  <div key={idx} className="p-5 border border-amber-500/20 bg-amber-500/5 rounded-xl space-y-3">
                                    <h5 className="font-bold text-amber-700 dark:text-amber-400 flex items-center gap-2 text-sm">
                                      {r.title}
                                    </h5>
                                    <p className="text-sm text-muted-foreground leading-relaxed italic">
                                      "{r.why}"
                                    </p>
                                    <div className="grid grid-cols-2 gap-4 pt-2 border-t border-amber-500/10">
                                      <div>
                                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-tighter mb-1">When it matters:</p>
                                        <p className="text-xs text-foreground font-medium">{r.material}</p>
                                      </div>
                                      <div>
                                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-tighter mb-1">Who is affected:</p>
                                        <p className="text-xs text-foreground font-medium">{r.affected}</p>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>

                            <Card className="p-6 border-border/50 shadow-sm">
                              <h4 className="text-sm font-bold text-foreground uppercase tracking-widest mb-4">Thesis Invalidation</h4>
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                {risk.invalidation.map((cond: string, idx: number) => (
                                  <div key={idx} className="flex items-start gap-2 p-3 rounded-lg bg-red-500/5 border border-red-500/10">
                                    <div className="w-1.5 h-1.5 rounded-full bg-red-500 mt-1.5 shrink-0" />
                                    <p className="text-xs font-medium text-red-700 dark:text-red-400 leading-tight">
                                      {cond}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            </Card>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4">
                              <div className="space-y-2">
                                <h4 className="text-sm font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-widest flex items-center gap-2">
                                  <TrendingUp className="w-4 h-4" />
                                  Suitable For
                                </h4>
                                <p className="text-xs text-muted-foreground leading-relaxed">{risk.investorFit.suitable}</p>
                              </div>
                              <div className="space-y-2">
                                <h4 className="text-sm font-bold text-red-700 dark:text-red-400 uppercase tracking-widest flex items-center gap-2">
                                  <AlertTriangle className="w-4 h-4" />
                                  Not Suitable For
                                </h4>
                                <p className="text-xs text-muted-foreground leading-relaxed">{risk.investorFit.unsuitable}</p>
                              </div>
                            </div>
                          </div>
                        );
                      } catch (e) {
                        return (
                          <Card className="p-12 border-border/50 border-dashed shadow-none flex flex-col items-center justify-center text-center">
                            <h3 className="text-lg font-bold mb-2 text-foreground">Error Loading Risk Data</h3>
                            <p className="text-muted-foreground">Unable to parse analyst risk framework.</p>
                          </Card>
                        );
                      }
                    })()}
                  </TabsContent>

                  {/* Placeholder for other tabs */}
                  {["valuation"].map((tab) => (
                    <TabsContent key={tab} value={tab} className="mt-0 focus-visible:outline-none">
                      <Card className="p-12 border-border/50 border-dashed shadow-none flex flex-col items-center justify-center text-center">
                        <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center mb-4">
                          <Activity className="w-8 h-8 text-muted-foreground" />
                        </div>
                        <h3 className="text-lg font-bold mb-2">Coming Soon</h3>
                        <p className="text-muted-foreground max-w-sm">
                          The {tab} analysis module is currently being built. Check back soon for detailed insights.
                        </p>
                      </Card>
                    </TabsContent>
                  ))}
                </div>
              </Tabs>
            </motion.div>

            {/* Sidebar Section */}
            <motion.div variants={itemVariants} className="space-y-6">
              <AIStockSummary summary={stock.summary} confidence={stock.aiConfidence as "High" | "Medium" | "Low"} />
            </motion.div>
          </div>
        </motion.div>
      </main>
    </div>
  );
}
