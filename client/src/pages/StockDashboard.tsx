import { useState } from "react";
import { useStock } from "@/hooks/use-stocks";
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

export default function StockDashboard() {
  const symbol = "BBCA"; // Hardcoded for this demo
  const { data: stock, isLoading, error } = useStock(symbol);
  const [activeTab, setActiveTab] = useState("overview");

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
                      </p>
                    </Card>
                  </TabsContent>
                  
                  {/* Financials Tab */}
                  <TabsContent value="financials" className="mt-0 focus-visible:outline-none space-y-6">
                    <Card className="p-6 border-border/50 shadow-sm bg-gradient-to-br from-primary/5 to-primary/10 dark:from-primary/10 dark:to-primary/5">
                      <h3 className="text-lg font-bold font-display mb-4 text-foreground">Financial Performance Summary</h3>
                      <p className="text-muted-foreground leading-relaxed">
                        {stock.financialSummary}
                      </p>
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
                      <h3 className="text-lg font-bold font-display mb-4 text-foreground">AI Flow Overview</h3>
                      <p className="text-muted-foreground leading-relaxed mb-6">
                        {stock.flowOverviewSummary}
                      </p>
                      
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
                                    <td colSpan={5} className="py-3 px-3 text-muted-foreground text-center">
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
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                  {/* Foreign Activity */}
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

                                  {/* Domestic Activity */}
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
                                      <div className="h-1" />
                                    </div>
                                  </div>
                                </div>

                                {/* Bar Visual for Participation Split */}
                                <div className="space-y-3">
                                  <h5 className="text-sm font-semibold text-foreground">Participation Split</h5>
                                  <div className="flex items-center gap-3">
                                    <div className="flex-1 h-6 rounded-md overflow-hidden border border-border/30 flex">
                                      <div
                                        className="bg-blue-500 dark:bg-blue-400 transition-all"
                                        style={{ width: `${data.domesticPercent}%` }}
                                      />
                                      <div
                                        className="bg-amber-500 dark:bg-amber-400 transition-all"
                                        style={{ width: `${data.foreignPercent}%` }}
                                      />
                                    </div>
                                    <div className="flex gap-4 text-xs font-semibold whitespace-nowrap">
                                      <span>
                                        <span className="inline-block w-3 h-3 rounded-sm bg-blue-500 dark:bg-blue-400 mr-1" />
                                        {data.domesticPercent}%
                                      </span>
                                      <span>
                                        <span className="inline-block w-3 h-3 rounded-sm bg-amber-500 dark:bg-amber-400 mr-1" />
                                        {data.foreignPercent}%
                                      </span>
                                    </div>
                                  </div>
                                  <p className="text-xs text-muted-foreground">
                                    The stock shows strong domestic investor interest, which is typical for established blue-chip banking stocks. Foreign participation remains meaningful but secondary, reflecting cautious international investor positioning in Indonesian equities.
                                  </p>
                                </div>
                              </div>
                            );
                          } catch (e) {
                            return <p className="text-muted-foreground text-sm">No foreign/domestic data available</p>;
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
                        {stock.newsOverviewSummary}
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

                    {/* SECTION 2: Filtered News Feed */}
                    <Card className="p-6 border-border/50 shadow-sm">
                      <h4 className="text-base font-bold font-display mb-4 text-foreground">Filtered News Feed</h4>
                      <div className="space-y-4">
                        {(() => {
                          try {
                            const news = JSON.parse(stock.newsFeed);
                            return news.map((item: any, index: number) => (
                              <div key={index} className="p-4 rounded-md border border-border/30 hover:bg-muted/30 transition-colors">
                                <div className="flex justify-between items-start gap-4 mb-2">
                                  <h5 className="font-semibold text-foreground leading-tight">{item.headline}</h5>
                                  <span className={`shrink-0 inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                                    item.impact === "Structural" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" :
                                    item.impact === "Temporary" ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" :
                                    "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-500"
                                  }`}>
                                    {item.impact}
                                  </span>
                                </div>
                                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                  <span>{item.date}</span>
                                  <span className="w-1 h-1 rounded-full bg-border" />
                                  <span>{item.source}</span>
                                </div>
                              </div>
                            ));
                          } catch (e) {
                            return <p className="text-muted-foreground text-sm">No news items available</p>;
                          }
                        })()}
                      </div>
                    </Card>

                    {/* SECTION 3: Corporate Action Summary */}
                    <Card className="p-6 border-border/50 shadow-sm">
                      <h4 className="text-base font-bold font-display mb-4 text-foreground">Corporate Action Summary</h4>
                      <div className="space-y-6">
                        {(() => {
                          try {
                            const actions = JSON.parse(stock.corporateActions);
                            return actions.map((action: any, index: number) => (
                              <div key={index} className="space-y-3">
                                <div className="flex items-center justify-between">
                                  <div>
                                    <h5 className="font-bold text-foreground">{action.type}</h5>
                                    <p className="text-xs text-muted-foreground">{action.date} • {action.status}</p>
                                  </div>
                                </div>
                                <div className="p-3 bg-secondary/30 rounded-md">
                                  <p className="text-xs text-muted-foreground leading-relaxed">
                                    <span className="font-semibold text-foreground block mb-1">Impact Analysis:</span>
                                    {action.explanation}
                                  </p>
                                </div>
                                {index < actions.length - 1 && <div className="border-b border-border/30" />}
                              </div>
                            ));
                          } catch (e) {
                            return <p className="text-muted-foreground text-sm">No corporate actions available</p>;
                          }
                        })()}
                      </div>
                    </Card>

                    {/* SECTION 4: What This Means for Investors */}
                    <Card className="p-6 border border-primary/20 bg-primary/5 shadow-sm">
                      <h4 className="text-base font-bold font-display mb-3 text-foreground flex items-center gap-2">
                        <Activity className="w-4 h-4 text-primary" />
                        What This Means for Investors
                      </h4>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {stock.investorInterpretation}
                      </p>
                    </Card>
                  </TabsContent>

                  {/* Placeholder for other tabs */}
                  {["valuation", "risk"].map((tab) => (
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
