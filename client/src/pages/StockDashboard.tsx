import { useEffect, useState } from "react";
import { useParams } from "wouter";
import { useStock } from "@/hooks/use-stocks";
import { Users, Sparkles, Shield, Target, Activity, AlertOctagon, Lightbulb, Gauge } from "lucide-react";

// IDX Market Session Status based on WIB time
function getIDXSessionStatus(): { label: string; color: "green" | "yellow" | "red" } {
  const now = new Date();
  // Convert to WIB (UTC+7)
  const wibOffset = 7 * 60; // 7 hours in minutes
  const utcMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
  const wibMinutes = (utcMinutes + wibOffset) % (24 * 60);
  const hour = Math.floor(wibMinutes / 60);
  const minute = wibMinutes % 60;
  const totalMinutes = hour * 60 + minute;
  
  // Check day of week (0 = Sunday, 6 = Saturday) in WIB
  const wibDate = new Date(now.getTime() + wibOffset * 60 * 1000);
  const dayOfWeek = wibDate.getUTCDay();
  
  // Market closed on weekends
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    return { label: "Pasar Tutup", color: "red" };
  }
  
  // 08:45-08:59 Pra-Pembukaan
  if (totalMinutes >= 8 * 60 + 45 && totalMinutes < 9 * 60) {
    return { label: "Pra-Pembukaan", color: "yellow" };
  }
  // 09:00-12:00 Sesi 1
  if (totalMinutes >= 9 * 60 && totalMinutes < 12 * 60) {
    return { label: "Sesi 1 Berlangsung", color: "green" };
  }
  // 12:00-13:30 Istirahat
  if (totalMinutes >= 12 * 60 && totalMinutes < 13 * 60 + 30) {
    return { label: "Istirahat", color: "yellow" };
  }
  // 13:30-15:49 Sesi 2
  if (totalMinutes >= 13 * 60 + 30 && totalMinutes < 15 * 60 + 50) {
    return { label: "Sesi 2 Berlangsung", color: "green" };
  }
  // 15:50-16:00 Pra-Penutupan
  if (totalMinutes >= 15 * 60 + 50 && totalMinutes < 16 * 60) {
    return { label: "Pra-Penutupan", color: "yellow" };
  }
  // Otherwise closed
  return { label: "Pasar Tutup", color: "red" };
}

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
  Newspaper, 
  AlertTriangle,
  UserCheck
} from "lucide-react";
import { motion } from "framer-motion";

function ConvictionTimeline({ phase, explanation }: { phase: string; explanation: string }) {
  const phases = ["Penempatan", "Konfirmasi", "Kepadatan", "Distribusi", "Reset"];
  const phaseLabels: Record<string, string> = {
    "Penempatan": "Penempatan",
    "Konfirmasi": "Konfirmasi",
    "Kepadatan": "Kepadatan",
    "Distribusi": "Distribusi",
    "Reset": "Reset",
    // Legacy English labels for backward compatibility
    "Positioning": "Penempatan",
    "Confirmation": "Konfirmasi",
    "Crowding": "Kepadatan",
    "Distribution": "Distribusi"
  };
  const currentIndex = phases.indexOf(phase) !== -1 ? phases.indexOf(phase) : 
    phase === "Positioning" ? 0 : phase === "Confirmation" ? 1 : phase === "Crowding" ? 2 : phase === "Distribution" ? 3 : 4;

  return (
    <Card className="p-4 border-border/50 shadow-sm bg-muted/20">
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Siklus Keyakinan Pasar</p>
        <span className="text-xs font-bold px-2 py-0.5 rounded bg-primary/10 text-primary uppercase">{phaseLabels[phase] || phase}</span>
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
          <span key={p} className={idx === currentIndex ? "text-primary" : ""}>{phaseLabels[p]}</span>
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
  const [sessionStatus, setSessionStatus] = useState(getIDXSessionStatus());

  // Update session status every minute
  useEffect(() => {
    const interval = setInterval(() => {
      setSessionStatus(getIDXSessionStatus());
    }, 60000); // Update every minute
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!stock) return;

    setAiLoading(true);
    const payload = {
      stock: stock.symbol,
      date: new Date().toISOString().split('T')[0],
      context: stock.summary,
      broker_data: JSON.parse(stock.brokerData),

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
          <p className="text-muted-foreground font-medium animate-pulse">Memuat data pasar...</p>
        </div>
      </div>
    );
  }

  if (error || !stock) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full p-8 text-center border-destructive/20 bg-destructive/5">
          <AlertTriangle className="w-12 h-12 text-destructive mx-auto mb-4" />
          <h2 className="text-xl font-bold text-foreground mb-2">Gagal memuat saham</h2>
          <p className="text-muted-foreground mb-6">
            Tidak dapat mengambil data untuk {symbol}. Silakan coba lagi nanti.
          </p>
          <button 
            onClick={() => window.location.reload()}
            className="px-6 py-2 bg-background border border-border rounded-lg font-semibold hover:bg-secondary transition-colors"
          >
            Coba Lagi
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
            {(() => {
              const dotColor = sessionStatus.color === "green" ? "bg-emerald-500" : 
                               sessionStatus.color === "yellow" ? "bg-amber-500" : "bg-rose-500";
              const bgColor = sessionStatus.color === "green" ? "bg-emerald-50 dark:bg-emerald-900/20" : 
                              sessionStatus.color === "yellow" ? "bg-amber-50 dark:bg-amber-900/20" : "bg-rose-50 dark:bg-rose-900/20";
              const textColor = sessionStatus.color === "green" ? "text-emerald-700 dark:text-emerald-400" : 
                                sessionStatus.color === "yellow" ? "text-amber-700 dark:text-amber-400" : "text-rose-700 dark:text-rose-400";
              return (
                <div className={`hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${bgColor} ${textColor}`} data-testid="badge-session-status">
                  <div className={`w-2 h-2 rounded-full ${dotColor} ${sessionStatus.color === "green" ? "animate-pulse" : ""}`} />
                  {sessionStatus.label}
                </div>
              );
            })()}
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
                    { id: "overview", label: "Ringkasan", icon: PieChart },
                    { id: "financials", label: "Keuangan", icon: DollarSign },
                    { id: "valuation", label: "Valuasi", icon: TrendingUp },
                    { id: "flow", label: "Aliran Dana", icon: Activity },
                    { id: "news", label: "Berita", icon: Newspaper },
                    { id: "risk", label: "Risiko", icon: AlertTriangle },
                    { id: "insider", label: "Insider", icon: UserCheck },
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
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-xl font-bold font-display">Profil Perusahaan</h3>
                        {!aiLoading && aiData?.marketMode && (
                          <span className="text-xs font-bold px-2 py-1 rounded bg-secondary text-foreground uppercase">
                            Mode: {aiData.marketMode}
                          </span>
                        )}
                      </div>
                      {!aiLoading && aiData && (
                        <div className="mb-6 space-y-4">
                          <ConvictionTimeline phase={aiData.convictionPhase} explanation={aiData.convictionExplanation} />
                          <div className="p-4 bg-primary/5 border border-primary/10 rounded-lg">
                            <p className="text-xs font-bold text-primary uppercase tracking-widest mb-1">Rezim Pasar</p>
                            <p className="text-sm text-muted-foreground leading-relaxed">{aiData.marketModeExplanation}</p>
                          </div>
                        </div>
                      )}
                      <p className="text-muted-foreground leading-relaxed mb-6">
                        {stock.description}
                      </p>
                      
                      <div className="grid grid-cols-2 gap-6 mb-8">
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-1">Sektor</p>
                          <p className="text-lg font-semibold text-foreground">{stock.sector}</p>
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-1">Subsektor</p>
                          <p className="text-lg font-semibold text-foreground">{stock.subsector}</p>
                        </div>
                      </div>
                      
                      <div className="pt-6 border-t border-border/50">
                        <h4 className="text-sm font-bold text-foreground uppercase tracking-wider mb-4">Metrik Utama</h4>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <MetricCard 
                            label="Rasio P/E" 
                            value={parseFloat(stock.peRatio).toFixed(2)} 
                            trend="neutral"
                          />
                          <MetricCard 
                            label="ROE" 
                            value={`${parseFloat(stock.roe).toFixed(1)}%`}
                            trend="up"
                          />
                          <MetricCard 
                            label="Margin Bersih" 
                            value={`${parseFloat(stock.netMargin).toFixed(1)}%`}
                            trend="neutral"
                          />
                          <MetricCard 
                            label="Pertumbuhan YoY" 
                            value={`${parseFloat(stock.growth).toFixed(1)}%`}
                            trend="up"
                          />
                        </div>
                      </div>
                    </Card>

                    <Card className="p-6 border-border/50 shadow-sm bg-gradient-to-br from-primary/5 to-primary/10 dark:from-primary/10 dark:to-primary/5">
                      <h3 className="text-lg font-bold font-display mb-4 text-foreground">Bagaimana investor melihat saham ini</h3>
                      <p className="text-muted-foreground leading-relaxed">
                        {stock.investorView}
                        {aiData?.flowQualityScore < 50 && " Konsensus institusi tampak terfragmentasi pada level saat ini; pelaku pasar perlu memantau potensi divergensi antara harga dan kualitas aliran."}
                        {aiData?.flowQualityScore > 75 && " Meski keyakinan institusi tetap tinggi, profil risiko-imbal hasil bergeser karena posisi semakin padat."}
                      </p>
                    </Card>

                    {aiData?.smartMoneyIntent && (
                      <Card className="p-6 border-border/50 shadow-sm bg-gradient-to-br from-indigo-500/5 to-purple-500/5 dark:from-indigo-500/10 dark:to-purple-500/10">
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="text-lg font-bold font-display text-foreground flex items-center gap-2">
                            <Activity className="w-5 h-5 text-indigo-500" />
                            Intensi Dana Besar
                          </h3>
                          <span className={`text-[10px] font-bold px-2 py-1 rounded uppercase ${
                            aiData.smartMoneyIntent.confidence === "High" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400" :
                            aiData.smartMoneyIntent.confidence === "Medium" ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400" :
                            "bg-slate-100 text-slate-600 dark:bg-slate-800/30 dark:text-slate-400"
                          }`}>
                            Kepercayaan {aiData.smartMoneyIntent.confidence === "High" ? "Tinggi" : aiData.smartMoneyIntent.confidence === "Medium" ? "Sedang" : "Rendah"}
                          </span>
                        </div>
                        <div className="mb-4">
                          <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1">Tujuan Utama</p>
                          <p className="text-xl font-bold text-indigo-600 dark:text-indigo-400">{aiData.smartMoneyIntent.primaryIntent}</p>
                          {aiData.smartMoneyIntent.secondaryIntent && (
                            <p className="text-sm text-muted-foreground mt-1">
                              Sekunder: <span className="font-semibold">{aiData.smartMoneyIntent.secondaryIntent}</span>
                            </p>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          {aiData.smartMoneyIntent.explanation}
                        </p>
                      </Card>
                    )}

                    {/* Stock Personality (Karakter Pergerakan Saham) */}
                    {stock.stockCharacter && (
                      <Card className="p-6 border-border/50 shadow-sm bg-gradient-to-br from-violet-500/5 to-fuchsia-500/5 dark:from-violet-500/10 dark:to-fuchsia-500/10" data-testid="card-stock-character">
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="text-lg font-bold font-display text-foreground flex items-center gap-2">
                            <Sparkles className="w-5 h-5 text-violet-500" />
                            Karakter Pergerakan Saham
                          </h3>
                          <span className="text-xs font-bold px-2 py-1 rounded bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-400 uppercase">
                            {stock.stockCharacter}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          {stock.stockCharacterDesc}
                        </p>
                      </Card>
                    )}

                    {/* Retail Sentiment Interpretation */}
                    {stock.retailSentiment && (
                      <Card className="p-6 border-border/50 shadow-sm bg-gradient-to-br from-amber-500/5 to-orange-500/5 dark:from-amber-500/10 dark:to-orange-500/10" data-testid="card-retail-sentiment">
                        <h3 className="text-lg font-bold font-display text-foreground flex items-center gap-2 mb-4">
                          <Users className="w-5 h-5 text-amber-500" />
                          Sentimen Investor Ritel
                        </h3>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          {stock.retailSentiment}
                        </p>
                      </Card>
                    )}

                    {/* Foreign vs Domestic Flow Interpretation */}
                    {stock.foreignDomesticInterpretation && (
                      <Card className="p-6 border-border/50 shadow-sm bg-gradient-to-br from-cyan-500/5 to-sky-500/5 dark:from-cyan-500/10 dark:to-sky-500/10" data-testid="card-foreign-domestic">
                        <h3 className="text-lg font-bold font-display text-foreground flex items-center gap-2 mb-4">
                          <Target className="w-5 h-5 text-cyan-500" />
                          Aliran Asing vs Domestik
                        </h3>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          {stock.foreignDomesticInterpretation}
                        </p>
                      </Card>
                    )}

                    {/* Retail Investor Summary (Ringkasan untuk Investor Ritel) */}
                    {stock.retailSummary && (
                      <Card className="p-6 border-border/50 shadow-sm bg-gradient-to-br from-emerald-500/5 to-teal-500/5 dark:from-emerald-500/10 dark:to-teal-500/10 border-2 border-emerald-200 dark:border-emerald-800/30" data-testid="card-retail-summary">
                        <h3 className="text-lg font-bold font-display text-foreground flex items-center gap-2 mb-4">
                          <Shield className="w-5 h-5 text-emerald-500" />
                          Ringkasan untuk Investor Ritel
                        </h3>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          {stock.retailSummary}
                        </p>
                      </Card>
                    )}
                  </TabsContent>
                  
                  {/* Financials Tab */}
                  <TabsContent value="financials" className="mt-0 focus-visible:outline-none space-y-6">
                    <Card className="p-6 border-border/50 shadow-sm bg-gradient-to-br from-primary/5 to-primary/10 dark:from-primary/10 dark:to-primary/5">
                      <h3 className="text-lg font-bold font-display mb-4 text-foreground">Ringkasan Kinerja Keuangan</h3>
                      <p className="text-muted-foreground leading-relaxed mb-4">
                        {stock.financialSummary}
                        {aiData?.flowQualityScore < 50 && " Narasi keuangan struktural menghadapi potensi hambatan dari risiko distribusi institusional yang muncul."}
                        {aiData?.flowQualityScore > 75 && " Kinerja keuangan yang berkelanjutan diimbangi dengan akumulasi institusi terkonsentrasi, meningkatkan sensitivitas makro."}
                      </p>
                      <div className="mt-4 p-4 bg-primary/5 border border-primary/10 rounded-md">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-2 flex items-center gap-2">
                          <Activity className="w-3 h-3" />
                          Perspektif Analis Keuangan
                        </p>
                        <p className="text-sm text-muted-foreground leading-relaxed italic">
                          {stock.financialsAnalystView}
                        </p>
                      </div>
                    </Card>

                    <Card className="p-6 border-border/50 shadow-sm">
                      <h4 className="text-base font-bold font-display mb-4 text-foreground">Laporan Laba Rugi</h4>
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
                              <td className="py-3 px-3 text-muted-foreground">Pendapatan</td>
                              <td className="text-right py-3 px-3 font-mono text-foreground">{stock.revenue2023}</td>
                              <td className="text-right py-3 px-3 font-mono text-foreground">{stock.revenue2024}</td>
                              <td className="text-right py-3 px-3 font-mono text-foreground">{stock.revenue2025}</td>
                            </tr>
                            <tr className="border-b border-border/30 hover:bg-muted/30">
                              <td className="py-3 px-3 text-muted-foreground">Laba Bersih</td>
                              <td className="text-right py-3 px-3 font-mono text-foreground">{stock.netProfit2023}</td>
                              <td className="text-right py-3 px-3 font-mono text-foreground">{stock.netProfit2024}</td>
                              <td className="text-right py-3 px-3 font-mono text-foreground">{stock.netProfit2025}</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </Card>

                    <Card className="p-6 border-border/50 shadow-sm">
                      <h4 className="text-base font-bold font-display mb-4 text-foreground">Neraca</h4>
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
                              <td className="py-3 px-3 text-muted-foreground">Total Aset</td>
                              <td className="text-right py-3 px-3 font-mono text-foreground">{stock.assets2023}</td>
                              <td className="text-right py-3 px-3 font-mono text-foreground">{stock.assets2024}</td>
                              <td className="text-right py-3 px-3 font-mono text-foreground">{stock.assets2025}</td>
                            </tr>
                            <tr className="border-b border-border/30 hover:bg-muted/30">
                              <td className="py-3 px-3 text-muted-foreground">Total Liabilitas</td>
                              <td className="text-right py-3 px-3 font-mono text-foreground">{stock.liabilities2023}</td>
                              <td className="text-right py-3 px-3 font-mono text-foreground">{stock.liabilities2024}</td>
                              <td className="text-right py-3 px-3 font-mono text-foreground">{stock.liabilities2025}</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </Card>

                    <Card className="p-6 border-border/50 shadow-sm">
                      <h4 className="text-base font-bold font-display mb-4 text-foreground">Arus Kas</h4>
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
                              <td className="py-3 px-3 text-muted-foreground">Arus Kas Operasional</td>
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
                        <h3 className="text-lg font-bold font-display text-foreground">Ringkasan AI Aliran Dana</h3>
                        {!aiLoading && aiData && (
                          <div className="text-right">
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Kualitas Aliran</p>
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
                          </div>
                          {aiData.earlyDistributionFlag && (
                            <div className="mt-3 pt-3 border-t border-border/20">
                              <p className="text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-widest mb-1 flex items-center gap-1.5">
                                <AlertTriangle className="w-3 h-3" />
                                Risiko Distribusi Awal Terdeteksi
                              </p>
                              <p className="text-sm text-muted-foreground italic">{aiData.earlyDistributionExplanation}</p>
                            </div>
                          )}
                          {aiData.tapeControlFlag && (
                            <div className="mt-3 pt-3 border-t border-border/20">
                              <p className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest mb-1 flex items-center gap-1.5">
                                <Activity className="w-3 h-3" />
                                Perilaku Kontrol Tape Terdeteksi
                              </p>
                              <p className="text-sm text-muted-foreground italic">{aiData.tapeControlExplanation}</p>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Flow Intensity Gradient Bar */}
                      <div className="mb-6">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">Intensitas Aliran</p>
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
                            <span>Distribusi Besar</span>
                            <span>Akumulasi Besar</span>
                          </div>
                        </div>
                        <p className="text-sm font-semibold text-foreground mt-3">{stock.flowIntensity}</p>
                      </div>

                      <div className="grid grid-cols-2 gap-6">
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-2">Bias Aliran</p>
                          <p className="text-base font-semibold text-foreground">{stock.flowBias === "Accumulation" ? "Akumulasi" : stock.flowBias === "Distribution" ? "Distribusi" : stock.flowBias}</p>
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-2">Reliabilitas Aliran</p>
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary">
                            {stock.flowReliability}
                          </span>
                        </div>
                      </div>
                    </Card>

                    {/* Broker Control Score Card */}
                    {!aiLoading && aiData?.brokerControlScore && (
                      <Card className="p-6 border-border/50 shadow-sm" data-testid="card-broker-control-score">
                        <div className="flex items-center justify-between mb-4">
                          <h4 className="text-base font-bold font-display text-foreground">Skor Kontrol Broker</h4>
                          <div className="text-right">
                            <p className={`text-2xl font-bold ${
                              aiData.brokerControlScore.score >= 70 
                                ? 'text-red-600 dark:text-red-400' 
                                : aiData.brokerControlScore.score >= 40 
                                  ? 'text-amber-600 dark:text-amber-400' 
                                  : 'text-emerald-600 dark:text-emerald-400'
                            }`} data-testid="text-broker-control-score-value">
                              {aiData.brokerControlScore.score}%
                            </p>
                          </div>
                        </div>
                        <div className="mb-4">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
                            aiData.brokerControlScore.score >= 70 
                              ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' 
                              : aiData.brokerControlScore.score >= 40 
                                ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' 
                                : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                          }`} data-testid="badge-broker-control-level">
                            {aiData.brokerControlScore.level}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground leading-relaxed" data-testid="text-broker-control-interpretation">
                          {aiData.brokerControlScore.interpretation}
                        </p>
                      </Card>
                    )}

                    {/* Broker Stability Score Card */}
                    {!aiLoading && aiData?.brokerStabilityScore && (
                      <Card className="p-6 border-border/50 shadow-sm" data-testid="card-broker-stability-score">
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <h4 className="text-base font-bold font-display text-foreground">Stabilitas Broker</h4>
                            <p className="text-xs text-muted-foreground">Mengukur apakah institusi yang sama secara konsisten mengendalikan akumulasi</p>
                          </div>
                          <div className="text-right">
                            <p className={`text-2xl font-bold ${
                              aiData.brokerStabilityScore.level === "High" 
                                ? 'text-emerald-600 dark:text-emerald-400' 
                                : aiData.brokerStabilityScore.level === "Moderate" 
                                  ? 'text-amber-600 dark:text-amber-400' 
                                  : 'text-muted-foreground'
                            }`} data-testid="text-broker-stability-score-value">
                              {aiData.brokerStabilityScore.score}%
                            </p>
                          </div>
                        </div>
                        <div className="mb-4">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
                            aiData.brokerStabilityScore.level === "High" 
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' 
                              : aiData.brokerStabilityScore.level === "Moderate" 
                                ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' 
                                : 'bg-muted text-muted-foreground'
                          }`} data-testid="badge-broker-stability-level">
                            Stabilitas {aiData.brokerStabilityScore.level === "High" ? "Tinggi" : aiData.brokerStabilityScore.level === "Moderate" ? "Sedang" : "Rendah"}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground leading-relaxed" data-testid="text-broker-stability-interpretation">
                          {aiData.brokerStabilityScore.interpretation}
                        </p>
                      </Card>
                    )}

                    {/* Bandar Heatmap - Peta Panas Aktivitas Bandar */}
                    {!aiLoading && aiData?.bandarHeatmap && (
                      <Card className="p-6 border-border/50 shadow-sm" data-testid="card-bandar-heatmap">
                        <div className="mb-4">
                          <h4 className="text-base font-bold font-display text-foreground flex items-center gap-2" data-testid="text-heatmap-title">
                            <div className="w-5 h-5 rounded bg-gradient-to-br from-emerald-500 to-amber-500 flex items-center justify-center">
                              <Activity className="w-3 h-3 text-white" />
                            </div>
                            Peta Panas Aktivitas Bandar
                          </h4>
                          <p className="text-xs text-muted-foreground mt-1" data-testid="text-heatmap-subtitle">
                            Menunjukkan broker mana yang paling dominan dalam akumulasi/distribusi di setiap periode waktu.
                          </p>
                        </div>
                        
                        {/* Legend above heatmap */}
                        <div className="mb-4 p-3 rounded-lg bg-muted/30 border border-border/50" data-testid="legend-heatmap-header">
                          <p className="text-xs font-bold text-foreground uppercase tracking-widest mb-2">Legenda Warna Aktivitas Bandar</p>
                          <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                            <div className="flex items-center gap-1.5" data-testid="legend-akumulasi-kuat">
                              <div className="w-4 h-4 rounded" style={{ backgroundColor: "#22c55e" }} />
                              <span>Akumulasi Kuat</span>
                            </div>
                            <div className="flex items-center gap-1.5" data-testid="legend-aktivitas-ringan">
                              <div className="w-4 h-4 rounded" style={{ backgroundColor: "#fde047" }} />
                              <span>Aktivitas Ringan / Transisi</span>
                            </div>
                            <div className="flex items-center gap-1.5" data-testid="legend-distribusi-dominan">
                              <div className="w-4 h-4 rounded" style={{ backgroundColor: "#8B0000" }} />
                              <span>Distribusi Dominan</span>
                            </div>
                            <div className="flex items-center gap-1.5" data-testid="legend-tidak-signifikan">
                              <div className="w-4 h-4 rounded bg-slate-300 dark:bg-slate-600" />
                              <span>Tidak Signifikan</span>
                            </div>
                          </div>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm" data-testid="table-bandar-heatmap">
                            <thead>
                              <tr className="border-b border-border/50">
                                <th className="text-left py-2 px-3 font-semibold text-foreground text-xs">Broker</th>
                                {aiData.bandarHeatmap.map((period: any) => (
                                  <th key={period.date} className="text-center py-2 px-3 font-semibold text-foreground text-xs" data-testid={`th-period-${period.date}`}>
                                    {period.date.split("-")[1] === "01" ? "Jan" : 
                                     period.date.split("-")[1] === "02" ? "Feb" : 
                                     period.date.split("-")[1] === "03" ? "Mar" : 
                                     period.date.split("-")[1] === "04" ? "Apr" : 
                                     period.date.split("-")[1]}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {(() => {
                                const allCodes = aiData.bandarHeatmap.flatMap((p: any) => p.brokers.map((b: any) => b.code));
                                const brokerCodes = Array.from(new Set(allCodes)) as string[];
                                return brokerCodes.map((brokerCode: string) => (
                                  <tr key={brokerCode} className="border-b border-border/30" data-testid={`row-broker-${brokerCode}`}>
                                    <td className="py-2 px-3 font-mono font-semibold text-foreground text-xs">{brokerCode}</td>
                                    {aiData.bandarHeatmap.map((period: any) => {
                                      const broker = period.brokers.find((b: any) => b.code === brokerCode);
                                      if (!broker) return <td key={period.date} className="text-center py-2 px-3"><div className="w-8 h-6 mx-auto rounded bg-slate-200 dark:bg-slate-700" /></td>;
                                      
                                      const intensity = broker.intensity;
                                      const role = broker.role;
                                      
                                      // New color scheme: Bright Green, Soft Yellow, Dark Red, Light Gray
                                      const getCellColor = () => {
                                        if (role === "Tidak Aktif" || intensity < 20) {
                                          return { bg: "#94a3b8", label: "Tidak Aktif" }; // Light Gray
                                        }
                                        if (role === "Akumulator") {
                                          return { bg: "#22c55e", label: "Akumulasi" }; // Bright Green
                                        }
                                        if (role === "Distributor") {
                                          return { bg: "#8B0000", label: "Distribusi" }; // Dark Red
                                        }
                                        return { bg: "#fde047", label: "Transisi" }; // Soft Yellow
                                      };
                                      
                                      const cellStyle = getCellColor();
                                      
                                      return (
                                        <td key={period.date} className="text-center py-2 px-3" data-testid={`cell-${brokerCode}-${period.date}`}>
                                          <div className="relative group">
                                            <div 
                                              className="w-8 h-6 mx-auto rounded cursor-pointer"
                                              style={{ 
                                                backgroundColor: cellStyle.bg,
                                                opacity: role === "Tidak Aktif" || intensity < 20 ? 0.5 : 0.4 + (intensity / 100) * 0.6
                                              }}
                                              data-testid={`heatmap-cell-${brokerCode}-${period.date}`}
                                            />
                                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-foreground text-background text-xs rounded invisible group-hover:visible transition-opacity whitespace-nowrap z-10 pointer-events-none" data-testid={`tooltip-${brokerCode}-${period.date}`}>
                                              {brokerCode} — {cellStyle.label} (Intensitas {intensity}%)
                                            </div>
                                          </div>
                                        </td>
                                      );
                                    })}
                                  </tr>
                                ));
                              })()}
                            </tbody>
                          </table>
                        </div>
                      </Card>
                    )}

                    {/* Phase Timeline - Timeline Fase Pergerakan Bandar */}
                    {!aiLoading && aiData?.phaseTimeline && (
                      <Card className="p-6 border-border/50 shadow-sm" data-testid="card-phase-timeline">
                        <div className="mb-4">
                          <h4 className="text-base font-bold font-display text-foreground flex items-center gap-2" data-testid="text-timeline-title">
                            <div className="w-5 h-5 rounded bg-gradient-to-br from-blue-500 to-emerald-500 flex items-center justify-center">
                              <Target className="w-3 h-3 text-white" />
                            </div>
                            Timeline Fase Pergerakan Bandar
                          </h4>
                          <p className="text-xs text-muted-foreground mt-1" data-testid="text-timeline-subtitle">
                            Menunjukkan evolusi fase akumulasi hingga distribusi berdasarkan perilaku institusi.
                          </p>
                        </div>
                        
                        {/* Timeline Bar */}
                        <div className="relative mb-6" data-testid="timeline-bar-container">
                          <div className="flex items-stretch h-12 rounded-lg overflow-hidden border border-border/50">
                            {aiData.phaseTimeline.map((item: any, index: number) => {
                              const phaseColors: Record<string, string> = {
                                "Akumulasi Senyap": "bg-blue-500",
                                "Akumulasi Aktif": "bg-emerald-500",
                                "Konfirmasi": "bg-green-600",
                                "Mark-Up": "bg-amber-500",
                                "Distribusi": "bg-rose-500",
                                "Reset": "bg-slate-600"
                              };
                              const bgColor = phaseColors[item.phase] || "bg-slate-400";
                              
                              return (
                                <div 
                                  key={index}
                                  className={`relative flex-1 ${bgColor} flex items-center justify-center group cursor-pointer`}
                                  data-testid={`phase-segment-${index}`}
                                >
                                  <span className="text-xs font-semibold text-white drop-shadow-sm text-center px-1 leading-tight" data-testid={`phase-label-${index}`}>
                                    {item.phase}
                                  </span>
                                  <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 text-[10px] text-muted-foreground font-mono" data-testid={`phase-date-${index}`}>
                                    {item.date.split("-")[1] === "01" ? "Jan" : 
                                     item.date.split("-")[1] === "02" ? "Feb" : 
                                     item.date.split("-")[1] === "03" ? "Mar" : 
                                     item.date.split("-")[1] === "04" ? "Apr" : 
                                     item.date.split("-")[1]}
                                  </div>
                                  {/* Tooltip */}
                                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 px-3 py-2 bg-foreground text-background text-xs rounded-lg invisible group-hover:visible z-20 w-48 pointer-events-none shadow-lg" data-testid={`phase-tooltip-${index}`}>
                                    <p className="font-bold mb-1">{item.phase}</p>
                                    <p className="text-[11px] leading-relaxed opacity-90">{item.description}</p>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                          {/* Arrow indicators */}
                          <div className="flex justify-between mt-3 px-2">
                            {aiData.phaseTimeline.map((_: any, index: number) => (
                              index < aiData.phaseTimeline.length - 1 && (
                                <div key={index} className="flex-1 flex items-center justify-end pr-2" data-testid={`arrow-indicator-${index}`}>
                                  <span className="text-muted-foreground text-lg">
                                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                      <path d="M5 12h14M12 5l7 7-7 7" />
                                    </svg>
                                  </span>
                                </div>
                              )
                            ))}
                          </div>
                        </div>

                        {/* Phase Legend - Only show phases that exist in data */}
                        <div className="flex flex-wrap gap-3 mb-4 text-xs" data-testid="legend-timeline">
                          {(() => {
                            const phases = aiData.phaseTimeline.map((p: any) => p.phase);
                            const phaseColors: Record<string, string> = {
                              "Akumulasi Senyap": "bg-blue-500",
                              "Akumulasi Aktif": "bg-emerald-500",
                              "Konfirmasi": "bg-green-600",
                              "Mark-Up": "bg-amber-500",
                              "Distribusi": "bg-rose-500",
                              "Reset": "bg-slate-600"
                            };
                            const uniquePhases = Array.from(new Set(phases)) as string[];
                            return uniquePhases.map((phase: string) => (
                              <div key={phase} className="flex items-center gap-1.5" data-testid={`legend-phase-${phase.replace(/\s+/g, '-').toLowerCase()}`}>
                                <div className={`w-3 h-3 rounded ${phaseColors[phase] || 'bg-slate-400'}`} />
                                <span className="text-muted-foreground">{phase}</span>
                              </div>
                            ));
                          })()}
                        </div>

                        {/* AI Interpretation */}
                        {aiData.bandarPhaseInterpretation && (
                          <div className="p-4 bg-primary/5 border border-primary/10 rounded-lg" data-testid="card-ai-phase-interpretation">
                            <p className="text-xs font-bold text-primary uppercase tracking-widest mb-2 flex items-center gap-2" data-testid="text-ai-interpretation-label">
                              <Sparkles className="w-3 h-3" />
                              Interpretasi AI Fase Bandar
                            </p>
                            <p className="text-sm text-muted-foreground leading-relaxed italic" data-testid="text-ai-interpretation-content">
                              {aiData.bandarPhaseInterpretation}
                            </p>
                          </div>
                        )}
                      </Card>
                    )}

                    {/* SECTION 2: Broker Summary */}
                    <Card className="p-6 border-border/50 shadow-sm">
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="text-base font-bold font-display text-foreground">Ringkasan Broker</h4>
                        {aiData?.smartMoneyIntent && (
                          <div className="flex items-center gap-2 text-xs">
                            <span className="text-muted-foreground">Tujuan Institusional Dominan:</span>
                            <span className="font-bold text-indigo-600 dark:text-indigo-400">{aiData.smartMoneyIntent.primaryIntent}</span>
                          </div>
                        )}
                      </div>
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
                              <th className="text-right py-3 px-3 font-semibold text-foreground">AI Role</th>
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
                                    <td className="py-3 px-3 text-right">
                                      {(() => {
                                        const insight = aiData?.brokerInsights?.find((i: any) => i.brokerCode === broker.code);
                                        return insight ? (
                                          <div className="inline-flex flex-col items-end">
                                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-secondary text-foreground uppercase">
                                              {insight.inferredRole}
                                            </span>
                                            <span className="text-[9px] text-muted-foreground mt-0.5 whitespace-nowrap">
                                              Conf: {insight.confidenceLevel}
                                            </span>
                                          </div>
                                        ) : <span className="text-muted-foreground">—</span>;
                                      })()}
                                    </td>
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
                      <p className="text-xs text-muted-foreground mt-3 leading-relaxed">
                        The convergence of buy and sell average prices suggests institutional participation with minimal execution friction, indicating a high-quality liquidity environment.
                      </p>
                      </div>
                    </Card>

                    {/* SECTION 3: Foreign vs Domestic Activity */}
                    <Card className="p-6 border-border/50 shadow-sm space-y-6">
                      <div>
                        <h4 className="text-base font-bold font-display mb-4 text-foreground">Aktivitas Asing vs Domestik</h4>
                        {(() => {
                          try {
                            const data = JSON.parse(stock.foreignActivityData);
                            return (
                              <div className="space-y-6">
                                {/* ... existing visual elements ... */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                  <div className="space-y-3">
                                    <h5 className="text-sm font-semibold text-foreground">Investor Asing</h5>
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
                                    <h5 className="text-sm font-semibold text-foreground">Investor Domestik</h5>
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
                                  <h5 className="text-sm font-semibold text-foreground">Distribusi Partisipasi</h5>
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
                                    Perspektif Analis Aliran Dana
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
                      <h3 className="text-lg font-bold font-display mb-4 text-foreground">Ringkasan AI Berita</h3>
                      <p className="text-muted-foreground leading-relaxed mb-6">
                        {aiLoading ? "Processing event data..." : (aiData?.event_analysis.thesis || stock.newsOverviewSummary)}
                      </p>
                      <div className="grid grid-cols-2 gap-6">
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-2">Dampak Berita</p>
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
                            stock.newsImpact === "High" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" :
                            stock.newsImpact === "Medium" ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" :
                            "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400"
                          }`}>
                            {stock.newsImpact}
                          </span>
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-2">Relevansi</p>
                          <p className="text-base font-semibold text-foreground">{stock.newsRelevance}</p>
                        </div>
                      </div>
                    </Card>

                    {/* SECTION 2: Event Analysis (Analyst Framework) */}
                    <div className="space-y-4">
                      <h3 className="text-lg font-bold font-display text-foreground px-1">Analisis Peristiwa</h3>
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
                                        Apa yang Terjadi?
                                      </p>
                                      <p className="text-sm text-foreground leading-relaxed">{event.event}</p>
                                    </div>
                                    <div>
                                      <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                                        <TrendingUp className="w-3 h-3" />
                                        Pemicu (Mengapa?)
                                      </p>
                                      <p className="text-sm text-foreground leading-relaxed">{event.why}</p>
                                    </div>
                                  </div>
                                  <div className="space-y-4">
                                    <div>
                                      <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                                        <Activity className="w-3 h-3" />
                                        Reaksi Pasar Langsung
                                      </p>
                                      <p className="text-sm text-foreground leading-relaxed">{event.immediate}</p>
                                    </div>
                                    <div>
                                      <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                                        <Activity className="w-3 h-3" />
                                        Efek Lanjutan
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
                                        Kepercayaan Analis: {event.confidence}
                                      </p>
                                    </div>
                                    <p className="text-xs text-muted-foreground italic leading-relaxed">
                                      <span className="font-bold not-italic text-foreground">Kondisi keberlanjutan:</span> {event.conditions}
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
                      <h4 className="text-base font-bold font-display mb-4 text-foreground">Feed Aktivitas Terkini</h4>
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
                      <h3 className="text-lg font-bold font-display mb-4 text-foreground">Apa Arti Ini Bagi Investor</h3>
                      <p className="text-muted-foreground leading-relaxed">
                        {stock.investorInterpretation}
                        {aiData?.flowQualityScore < 50 && " Current accumulation signals exhibit low conviction characteristics, suggesting potential narrative fatigue or false positioning."}
                        {aiData?.flowQualityScore > 75 && " Institutional participation is high-quality, though the resulting consensus may limit immediate alpha capture without new fundamental surprises."}
                        {aiData?.earlyDistributionFlag && " Signs of liquidity rotation are emerging. Investors are encouraged to prioritize downside protection as alpha-seeking attractiveness potentially diminishes."}
                        {(aiData?.convictionPhase === "Crowding" || aiData?.convictionPhase === "Distribution") && " Elevated consensus suggests the current cycle may be entering a period of narrative saturation and increased rotation risk."}
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
                                <h3 className="text-lg font-bold font-display text-foreground uppercase tracking-tight">Analisis Risiko AI</h3>
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
                              {aiData?.marketMode && (
                                <div className="mb-4 p-3 bg-secondary/50 rounded-lg border border-border/30">
                                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1">Rezim Pasar</p>
                                  <p className="text-sm font-semibold text-foreground">{aiData.marketMode}</p>
                                  <p className="text-xs text-muted-foreground mt-1">{aiData.marketModeExplanation}</p>
                                </div>
                              )}
                              <p className="text-muted-foreground leading-relaxed mb-6">
                                {aiLoading ? "Mengevaluasi faktor risiko..." : (aiData?.risk_analysis || stock.riskAnalystView)}
                                {aiData?.flowQualityScore < 50 && " Kualitas aliran terfragmentasi meningkatkan probabilitas de-rating struktural jika konsensus pasar bergeser."}
                                {aiData?.flowQualityScore > 75 && " Konsensus tinggi menciptakan risiko kepadatan inheren; kegagalan memenuhi ekspektasi tinggi dapat menyebabkan respons harga yang tidak proporsional."}
                                {aiData?.earlyDistributionFlag && " Dinamika internal menunjukkan partisipan institusional mengurangi eksposur meski ketahanan volume headline."}
                                {(aiData?.marketMode?.includes("Distribusi") || aiData?.marketMode === "Vakum Pasca-Distribusi") && " Rezim pasar saat ini menunjukkan daya tarik alpha-seeking berkurang. Kekuatan harga perlu dipantau untuk potensi jebakan likuiditas."}
                              </p>
                              <div className="grid grid-cols-2 gap-6">
                                <div>
                                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">Tingkat Risiko Keseluruhan</p>
                                  <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${
                                    risk.level === 'Low' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400' :
                                    risk.level === 'Moderate' ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400' :
                                    'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                                  }`}>
                                    {risk.level}
                                  </span>
                                </div>
                                <div>
                                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">Kecenderungan Analis</p>
                                  <p className="text-base font-bold text-foreground">{risk.skew}</p>
                                </div>
                              </div>
                            </Card>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              <div className="space-y-4">
                                <h4 className="text-sm font-bold text-foreground uppercase tracking-widest px-1">Risiko Pasar Utama</h4>
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
                                  Risiko Kontrarian
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
                                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-tighter mb-1">Kapan relevan:</p>
                                        <p className="text-xs text-foreground font-medium">{r.material}</p>
                                      </div>
                                      <div>
                                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-tighter mb-1">Siapa yang terpengaruh:</p>
                                        <p className="text-xs text-foreground font-medium">{r.affected}</p>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                                {aiData?.earlyDistributionFlag && (
                                  <div className="p-5 border border-amber-500/20 bg-amber-500/5 rounded-xl space-y-3">
                                    <h5 className="font-bold text-amber-700 dark:text-amber-400 flex items-center gap-2 text-sm">
                                      <AlertTriangle className="w-4 h-4" />
                                      Risiko Distribusi Awal
                                    </h5>
                                    <p className="text-sm text-muted-foreground leading-relaxed italic">
                                      "{aiData.earlyDistributionExplanation}"
                                    </p>
                                  </div>
                                )}
                                {aiData?.tapeControlFlag && (
                                  <div className="p-5 border border-blue-500/20 bg-blue-500/5 rounded-xl space-y-3">
                                    <h5 className="font-bold text-blue-700 dark:text-blue-400 flex items-center gap-2 text-sm">
                                      <Activity className="w-4 h-4" />
                                      Risiko Kontrol Tape
                                    </h5>
                                    <p className="text-sm text-muted-foreground leading-relaxed italic">
                                      "{aiData.tapeControlExplanation}"
                                    </p>
                                  </div>
                                )}
                                {(aiData?.smartMoneyIntent?.primaryIntent === "Inventory Exit" || aiData?.smartMoneyIntent?.primaryIntent === "Liquidity Harvesting") && (
                                  <div className="p-5 border border-red-500/20 bg-red-500/5 rounded-xl space-y-3">
                                    <h5 className="font-bold text-red-700 dark:text-red-400 flex items-center gap-2 text-sm">
                                      <AlertTriangle className="w-4 h-4" />
                                      Peringatan Intensi Dana Besar
                                    </h5>
                                    <p className="text-sm text-muted-foreground leading-relaxed italic">
                                      Pola perilaku institusional saat ini menunjukkan "{aiData.smartMoneyIntent.primaryIntent}". 
                                      {aiData.smartMoneyIntent.primaryIntent === "Keluar Inventori" && " Pelaku dominan tampak mengurangi eksposur melalui likuidasi teratur. Ketahanan harga mungkin menyembunyikan rotasi yang mendasari."}
                                      {aiData.smartMoneyIntent.primaryIntent === "Pemanenan Likuiditas" && " Aktivitas taktis tinggi di sekitar level kunci mungkin mengindikasikan perilaku stop-run atau pola tembus palsu. Kemajuan arah bersih mungkin terbatas meski volume terlihat."}
                                    </p>
                                    <p className="text-xs text-muted-foreground/70 mt-2">
                                      Kepercayaan: {aiData.smartMoneyIntent.confidence}
                                    </p>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Smart Trap Detection Panel */}
                            {aiData?.trapDetection && (
                              <Card className="p-6 border-border/50 shadow-sm" data-testid="card-trap-detection">
                                <div className="mb-4">
                                  <h4 className="text-sm font-bold text-foreground uppercase tracking-widest flex items-center gap-2" data-testid="text-trap-title">
                                    <div className="w-5 h-5 rounded bg-gradient-to-br from-amber-500 to-red-500 flex items-center justify-center">
                                      <Shield className="w-3 h-3 text-white" />
                                    </div>
                                    Deteksi Jebakan Pasar oleh AI
                                  </h4>
                                  <p className="text-xs text-muted-foreground mt-1" data-testid="text-trap-subtitle">
                                    Sistem mendeteksi potensi pergerakan harga yang menyesatkan berdasarkan perilaku bandar.
                                  </p>
                                </div>
                                
                                <div 
                                  className={`p-5 rounded-xl space-y-4 ${
                                    aiData.trapDetection.type === "bull_trap" 
                                      ? "bg-red-500/10 border border-red-500/30" 
                                      : aiData.trapDetection.type === "bear_trap"
                                      ? "bg-blue-500/10 border border-blue-500/30"
                                      : "bg-muted/30 border border-border/50"
                                  }`}
                                  data-testid={`trap-card-${aiData.trapDetection.type}`}
                                >
                                  {/* Trap Icon and Title */}
                                  <div className="flex items-start gap-3">
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                                      aiData.trapDetection.type === "bull_trap"
                                        ? "bg-red-500/20"
                                        : aiData.trapDetection.type === "bear_trap"
                                        ? "bg-blue-500/20"
                                        : "bg-emerald-500/20"
                                    }`}>
                                      {aiData.trapDetection.type === "bull_trap" ? (
                                        <AlertOctagon className="w-5 h-5 text-red-500" />
                                      ) : aiData.trapDetection.type === "bear_trap" ? (
                                        <Lightbulb className="w-5 h-5 text-blue-500" />
                                      ) : (
                                        <Shield className="w-5 h-5 text-emerald-500" />
                                      )}
                                    </div>
                                    <div className="flex-1">
                                      <h5 className={`font-bold text-base ${
                                        aiData.trapDetection.type === "bull_trap"
                                          ? "text-red-700 dark:text-red-400"
                                          : aiData.trapDetection.type === "bear_trap"
                                          ? "text-blue-700 dark:text-blue-400"
                                          : "text-emerald-700 dark:text-emerald-400"
                                      }`} data-testid="text-trap-type-title">
                                        {aiData.trapDetection.title}
                                      </h5>
                                      
                                      {/* Confidence Meter */}
                                      <div className="flex items-center gap-2 mt-2" data-testid="confidence-meter">
                                        <Gauge className="w-4 h-4 text-muted-foreground" />
                                        <span className="text-xs text-muted-foreground">Keyakinan:</span>
                                        <div className="flex gap-1">
                                          {["Rendah", "Sedang", "Tinggi"].map((level) => (
                                            <span 
                                              key={level}
                                              className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                                                level === aiData.trapDetection.confidence
                                                  ? aiData.trapDetection.type === "bull_trap"
                                                    ? "bg-red-500 text-white"
                                                    : aiData.trapDetection.type === "bear_trap"
                                                    ? "bg-blue-500 text-white"
                                                    : "bg-emerald-500 text-white"
                                                  : "bg-muted text-muted-foreground"
                                              }`}
                                              data-testid={`confidence-level-${level.toLowerCase()}`}
                                            >
                                              {level}
                                            </span>
                                          ))}
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                  
                                  {/* AI Explanation */}
                                  <div className="pt-3 border-t border-border/30">
                                    <p className="text-sm text-muted-foreground leading-relaxed" data-testid="text-trap-explanation">
                                      {aiData.trapDetection.explanation}
                                    </p>
                                  </div>
                                  
                                  {/* Warning for detected traps */}
                                  {aiData.trapDetection.detected && (
                                    <div className={`flex items-center gap-2 p-3 rounded-lg ${
                                      aiData.trapDetection.type === "bull_trap"
                                        ? "bg-red-500/20"
                                        : "bg-blue-500/20"
                                    }`} data-testid="trap-warning-box">
                                      <AlertOctagon className={`w-4 h-4 ${
                                        aiData.trapDetection.type === "bull_trap"
                                          ? "text-red-600 dark:text-red-400"
                                          : "text-blue-600 dark:text-blue-400"
                                      }`} />
                                      <p className={`text-xs font-medium ${
                                        aiData.trapDetection.type === "bull_trap"
                                          ? "text-red-700 dark:text-red-300"
                                          : "text-blue-700 dark:text-blue-300"
                                      }`}>
                                        {aiData.trapDetection.type === "bull_trap"
                                          ? "Waspada: Hindari mengejar kenaikan harga tanpa konfirmasi volume institusional."
                                          : "Perhatian: Jangan panik jual — institusi mungkin sedang mengumpulkan saham."
                                        }
                                      </p>
                                    </div>
                                  )}
                                </div>
                              </Card>
                            )}

                            <Card className="p-6 border-border/50 shadow-sm">
                              <h4 className="text-sm font-bold text-foreground uppercase tracking-widest mb-4">Pembatalan Tesis</h4>
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

                            {/* Indonesia-Specific Risk Factors */}
                            {stock.localRiskFactors && (
                              <Card className="p-6 border-border/50 shadow-sm bg-gradient-to-br from-orange-500/5 to-red-500/5 dark:from-orange-500/10 dark:to-red-500/10" data-testid="card-local-risks">
                                <h4 className="text-sm font-bold text-foreground uppercase tracking-widest mb-4 flex items-center gap-2">
                                  <Shield className="w-4 h-4 text-orange-500" />
                                  Faktor Risiko Lokal Indonesia
                                </h4>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                  {JSON.parse(stock.localRiskFactors).map((risk: { type: string; text: string }, idx: number) => (
                                    <div key={idx} className="p-4 rounded-lg bg-background border border-border/50">
                                      <p className="text-xs font-bold text-orange-600 dark:text-orange-400 uppercase tracking-widest mb-2">
                                        {risk.type}
                                      </p>
                                      <p className="text-sm text-muted-foreground leading-relaxed">
                                        {risk.text}
                                      </p>
                                    </div>
                                  ))}
                                </div>
                              </Card>
                            )}

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4">
                              <div className="space-y-2">
                                <h4 className="text-sm font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-widest flex items-center gap-2">
                                  <TrendingUp className="w-4 h-4" />
                                  Cocok Untuk
                                </h4>
                                <p className="text-xs text-muted-foreground leading-relaxed">{risk.investorFit.suitable}</p>
                              </div>
                              <div className="space-y-2">
                                <h4 className="text-sm font-bold text-red-700 dark:text-red-400 uppercase tracking-widest flex items-center gap-2">
                                  <AlertTriangle className="w-4 h-4" />
                                  Tidak Cocok Untuk
                                </h4>
                                <p className="text-xs text-muted-foreground leading-relaxed">{risk.investorFit.unsuitable}</p>
                              </div>
                            </div>
                          </div>
                        );
                      } catch (e) {
                        return (
                          <Card className="p-12 border-border/50 border-dashed shadow-none flex flex-col items-center justify-center text-center">
                            <h3 className="text-lg font-bold mb-2 text-foreground">Gagal Memuat Data Risiko</h3>
                            <p className="text-muted-foreground">Tidak dapat memproses framework risiko analis.</p>
                          </Card>
                        );
                      }
                    })()}
                  </TabsContent>

                  {/* Insider Tab */}
                  <TabsContent value="insider" className="mt-0 focus-visible:outline-none space-y-6">
                    {(() => {
                      try {
                        const insider = stock.insiderData ? JSON.parse(stock.insiderData) : null;
                        if (!insider) {
                          return (
                            <Card className="p-12 border-border/50 border-dashed shadow-none flex flex-col items-center justify-center text-center">
                              <UserCheck className="w-12 h-12 text-muted-foreground mb-4" />
                              <h3 className="text-lg font-bold mb-2">Tidak Ada Data Insider</h3>
                              <p className="text-muted-foreground">Data transaksi insider belum tersedia untuk saham ini.</p>
                            </Card>
                          );
                        }
                        return (
                          <div className="space-y-6">
                            {/* Insider Overview */}
                            <Card className="p-6 border-border/50 shadow-sm bg-gradient-to-br from-primary/5 to-primary/10 dark:from-primary/10 dark:to-primary/5">
                              <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-bold font-display text-foreground">Aktivitas Insider</h3>
                                <div className="text-right">
                                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Skor Keselarasan</p>
                                  <p className={`text-2xl font-bold ${
                                    insider.alignmentScore >= 70 ? 'text-emerald-600 dark:text-emerald-400' :
                                    insider.alignmentScore >= 40 ? 'text-amber-600 dark:text-amber-400' :
                                    'text-red-600 dark:text-red-400'
                                  }`}>{insider.alignmentScore}/100</p>
                                </div>
                              </div>
                              {(insider.overview || insider.interpretation) && (
                                <p className="text-muted-foreground leading-relaxed mb-4">
                                  {insider.overview || insider.interpretation}
                                </p>
                              )}
                              <div className="grid grid-cols-3 gap-4 mt-4">
                                <div className="text-center p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-1">Total Pembelian</p>
                                  <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                                    {typeof insider.totalBuyValue === 'number' 
                                      ? `${(insider.totalBuyValue / 1000000000).toFixed(1)}B IDR`
                                      : insider.totalBuy || '-'}
                                  </p>
                                </div>
                                <div className="text-center p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-1">Total Penjualan</p>
                                  <p className="text-lg font-bold text-red-600 dark:text-red-400">
                                    {typeof insider.totalSellValue === 'number'
                                      ? `${(insider.totalSellValue / 1000000000).toFixed(1)}B IDR`
                                      : insider.totalSell || '-'}
                                  </p>
                                </div>
                                <div className="text-center p-3 rounded-lg bg-primary/10 border border-primary/20">
                                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-1">Arus Bersih</p>
                                  <p className={`text-lg font-bold ${
                                    (typeof insider.netFlow === 'number' ? insider.netFlow < 0 : String(insider.netFlow).startsWith('-'))
                                      ? 'text-red-600 dark:text-red-400' 
                                      : 'text-emerald-600 dark:text-emerald-400'
                                  }`}>
                                    {typeof insider.netFlow === 'number'
                                      ? `${insider.netFlow >= 0 ? '+' : ''}${(insider.netFlow / 1000000000).toFixed(1)}B IDR`
                                      : insider.netFlow}
                                  </p>
                                </div>
                              </div>
                            </Card>

                            {/* AI Insider Analysis */}
                            <Card className="p-6 border-border/50 shadow-sm">
                              <div className="flex items-center gap-2 mb-4">
                                <Activity className="w-5 h-5 text-indigo-500" />
                                <h4 className="text-base font-bold font-display text-foreground">Interpretasi AI</h4>
                              </div>
                              <div className="space-y-4">
                                <div className="p-4 bg-primary/5 border border-primary/10 rounded-lg">
                                  <p className="text-xs font-bold text-primary uppercase tracking-widest mb-2">Interpretasi AI</p>
                                  <p className="text-sm text-muted-foreground leading-relaxed">{insider.aiInterpretation || insider.interpretation}</p>
                                </div>
                                <div className="p-4 bg-secondary/50 rounded-lg border border-border/30">
                                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">Kekuatan Sinyal</p>
                                  <div className="flex items-center gap-3">
                                    <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                                      <div 
                                        className={`h-full transition-all ${
                                          insider.signalStrength === 'Kuat' || insider.signalStrength === 'Strong' ? 'bg-emerald-500 w-full' :
                                          insider.signalStrength === 'Sedang' || insider.signalStrength === 'Moderat' || insider.signalStrength === 'Moderate' ? 'bg-amber-500 w-2/3' :
                                          'bg-muted-foreground w-1/3'
                                        }`}
                                      />
                                    </div>
                                    <span className={`text-sm font-bold ${
                                      insider.signalStrength === 'Kuat' || insider.signalStrength === 'Strong' ? 'text-emerald-600 dark:text-emerald-400' :
                                      insider.signalStrength === 'Sedang' || insider.signalStrength === 'Moderat' || insider.signalStrength === 'Moderate' ? 'text-amber-600 dark:text-amber-400' :
                                      'text-muted-foreground'
                                    }`}>{insider.signalStrength}</span>
                                  </div>
                                </div>
                              </div>
                            </Card>

                            {/* Recent Insider Transactions */}
                            <Card className="p-6 border-border/50 shadow-sm">
                              <h4 className="text-base font-bold font-display mb-4 text-foreground">Riwayat Transaksi</h4>
                              <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                  <thead>
                                    <tr className="border-b border-border/50">
                                      <th className="text-left py-3 px-3 font-semibold text-foreground">Nama</th>
                                      <th className="text-left py-3 px-3 font-semibold text-foreground">Jabatan</th>
                                      <th className="text-left py-3 px-3 font-semibold text-foreground">Tipe</th>
                                      <th className="text-right py-3 px-3 font-semibold text-foreground">Jumlah Saham</th>
                                      <th className="text-right py-3 px-3 font-semibold text-foreground">Harga</th>
                                      <th className="text-right py-3 px-3 font-semibold text-foreground">Tanggal</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {insider.transactions?.map((tx: any, idx: number) => {
                                      const isBuy = tx.type === 'BUY' || tx.type === 'Beli';
                                      const typeLabel = isBuy ? 'Beli' : 'Jual';
                                      return (
                                        <tr key={idx} className="border-b border-border/30 hover:bg-muted/30">
                                          <td className="py-3 px-3 font-medium text-foreground">{tx.name}</td>
                                          <td className="py-3 px-3 text-muted-foreground">{tx.position}</td>
                                          <td className="py-3 px-3">
                                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                                              isBuy ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                                              'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                            }`}>
                                              {typeLabel}
                                            </span>
                                          </td>
                                          <td className="text-right py-3 px-3 font-mono text-foreground">
                                            {typeof tx.shares === 'number' ? tx.shares.toLocaleString('id-ID') : tx.shares}
                                          </td>
                                          <td className="text-right py-3 px-3 font-mono text-foreground">
                                            {typeof tx.price === 'number' ? `IDR ${tx.price.toLocaleString('id-ID')}` : tx.price}
                                          </td>
                                          <td className="text-right py-3 px-3 text-muted-foreground">{tx.date}</td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            </Card>

                            {/* Insider Sentiment Indicator */}
                            {(() => {
                              // Calculate percentages if not provided
                              const buyVal = insider.totalBuyValue || 0;
                              const sellVal = insider.totalSellValue || 0;
                              const total = buyVal + sellVal;
                              const buyPct = insider.buyPercent ?? (total > 0 ? Math.round((buyVal / total) * 100) : 50);
                              const sellPct = insider.sellPercent ?? (total > 0 ? Math.round((sellVal / total) * 100) : 50);
                              return (
                                <Card className="p-6 border-border/50 shadow-sm bg-gradient-to-br from-indigo-500/5 to-purple-500/5 dark:from-indigo-500/10 dark:to-purple-500/10">
                                  <h4 className="text-base font-bold font-display mb-4 text-foreground">Sentimen Insider (12 Bulan)</h4>
                                  <div className="flex items-center gap-4">
                                    <div className="flex-1 h-4 rounded-full overflow-hidden border border-border/30 flex">
                                      <div className="bg-emerald-500 dark:bg-emerald-400" style={{ width: `${buyPct}%` }} />
                                      <div className="bg-red-500 dark:bg-red-400" style={{ width: `${sellPct}%` }} />
                                    </div>
                                    <div className="flex items-center gap-4 text-xs">
                                      <span className="flex items-center gap-1">
                                        <div className="w-2 h-2 rounded-full bg-emerald-500" />
                                        Beli {buyPct}%
                                      </span>
                                      <span className="flex items-center gap-1">
                                        <div className="w-2 h-2 rounded-full bg-red-500" />
                                        Jual {sellPct}%
                                      </span>
                                    </div>
                                  </div>
                                  {(insider.sentimentNote || insider.sentiment) && (
                                    <p className="text-xs text-muted-foreground mt-3 italic">{insider.sentimentNote || `Sentimen: ${insider.sentiment}`}</p>
                                  )}
                                </Card>
                              );
                            })()}
                          </div>
                        );
                      } catch (e) {
                        return (
                          <Card className="p-12 border-border/50 border-dashed shadow-none flex flex-col items-center justify-center text-center">
                            <h3 className="text-lg font-bold mb-2 text-foreground">Gagal Memuat Data Insider</h3>
                            <p className="text-muted-foreground">Tidak dapat memproses data transaksi insider.</p>
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
                        <h3 className="text-lg font-bold mb-2">Segera Hadir</h3>
                        <p className="text-muted-foreground max-w-sm">
                          Modul analisis {tab === "valuation" ? "valuasi" : tab} sedang dalam pengembangan. Cek kembali nanti untuk insights mendetail.
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
