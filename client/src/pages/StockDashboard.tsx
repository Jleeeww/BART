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
  const symbol = "GOGL"; // Hardcoded for this demo
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
            <span className="font-display font-bold text-xl tracking-tight">TradeDash</span>
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
                  <TabsContent value="overview" className="mt-0 focus-visible:outline-none">
                    <Card className="p-6 border-border/50 shadow-sm">
                      <h3 className="text-xl font-bold font-display mb-4">Company Profile</h3>
                      <p className="text-muted-foreground leading-relaxed mb-8">
                        {stock.description}
                      </p>
                      
                      <h4 className="text-sm font-bold text-foreground uppercase tracking-wider mb-4">Key Statistics</h4>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <MetricCard 
                          label="Market Cap" 
                          value={stock.marketCap} 
                          trend="neutral"
                        />
                        <MetricCard 
                          label="P/E Ratio" 
                          value={parseFloat(stock.peRatio).toFixed(2)} 
                          trend="down"
                        />
                        <MetricCard 
                          label="Div Yield" 
                          value={`${parseFloat(stock.dividendYield).toFixed(2)}%`}
                          trend="up"
                        />
                        <MetricCard 
                          label="Beta (5Y)" 
                          value="1.42" 
                          trend="neutral"
                        />
                      </div>
                    </Card>
                  </TabsContent>
                  
                  {/* Placeholder for other tabs */}
                  {["financials", "valuation", "flow", "news", "risk"].map((tab) => (
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
              <AIStockSummary summary={stock.summary} />
              
              <Card className="p-6 border-border/50 shadow-sm">
                <h3 className="font-display font-bold text-lg mb-4">Analyst Rating</h3>
                <div className="flex items-center gap-4 mb-6">
                  <div className="flex-1 h-3 bg-secondary rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500 w-[65%]" />
                  </div>
                  <span className="font-bold text-emerald-600">Buy</span>
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Analyst Target</span>
                    <span className="font-mono font-medium">$165.00</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Low Target</span>
                    <span className="font-mono font-medium">$132.00</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">High Target</span>
                    <span className="font-mono font-medium">$180.00</span>
                  </div>
                </div>
              </Card>

              <Card className="p-6 border-border/50 shadow-sm bg-primary text-primary-foreground relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-10 transform translate-x-1/4 -translate-y-1/4">
                  <TrendingUp className="w-40 h-40" />
                </div>
                <div className="relative z-10">
                  <h3 className="font-display font-bold text-xl mb-2">Trade {stock.symbol}</h3>
                  <p className="text-primary-foreground/80 text-sm mb-6">
                    Commission-free trading available now.
                  </p>
                  <button className="w-full py-3 bg-background text-foreground font-bold rounded-xl hover:bg-background/90 transition-colors shadow-lg shadow-black/10">
                    Buy Shares
                  </button>
                  <button className="w-full mt-3 py-3 bg-primary-foreground/10 text-primary-foreground font-bold rounded-xl hover:bg-primary-foreground/20 transition-colors border border-primary-foreground/20">
                    Add to Watchlist
                  </button>
                </div>
              </Card>
            </motion.div>
          </div>
        </motion.div>
      </main>
    </div>
  );
}
