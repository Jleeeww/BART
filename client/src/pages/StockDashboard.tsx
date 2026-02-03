import { useEffect, useState } from "react";
import { useParams } from "wouter";
import { useStock } from "@/hooks/use-stocks";
import { Users, Sparkles, Shield, Target, Activity, AlertOctagon, Lightbulb, Gauge, ChevronDown, ChevronUp } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

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
                    {/* HERO DECISION BLOCK */}
                    {!aiLoading && aiData?.decisionEngine && (
                      <Card className={`p-6 border-2 shadow-md ${
                        aiData.decisionEngine.status === "Layak Dikoleksi Bertahap" 
                          ? "border-emerald-300 dark:border-emerald-700 bg-gradient-to-br from-emerald-500/10 to-emerald-500/5" 
                          : aiData.decisionEngine.status === "Perlu Waspada"
                            ? "border-amber-300 dark:border-amber-700 bg-gradient-to-br from-amber-500/10 to-amber-500/5"
                            : "border-red-300 dark:border-red-700 bg-gradient-to-br from-red-500/10 to-red-500/5"
                      }`} data-testid="card-hero-decision">
                        <div className="flex flex-col gap-4">
                          {/* Status Title */}
                          <div className="flex items-center justify-between flex-wrap gap-3">
                            <h2 className={`text-xl font-bold font-display ${
                              aiData.decisionEngine.status === "Layak Dikoleksi Bertahap" 
                                ? "text-emerald-700 dark:text-emerald-400" 
                                : aiData.decisionEngine.status === "Perlu Waspada"
                                  ? "text-amber-700 dark:text-amber-400"
                                  : "text-red-700 dark:text-red-400"
                            }`} data-testid="text-decision-status">
                              Status Saham: {aiData.decisionEngine.status}
                            </h2>
                            {/* Sub-badge */}
                            <span className={`text-xs font-bold px-3 py-1.5 rounded-full uppercase tracking-wide ${
                              aiData.decisionEngine.subBadge === "Akumulasi Sehat" 
                                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300" 
                                : aiData.decisionEngine.subBadge === "Akumulasi Rapuh"
                                  ? "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
                                  : aiData.decisionEngine.subBadge === "Distribusi Awal"
                                    ? "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300"
                                    : "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300"
                            }`} data-testid="badge-decision-subbadge">
                              {aiData.decisionEngine.subBadge}
                            </span>
                          </div>
                          
                          {/* ALASAN UTAMA - Max 3 bullets */}
                          <div className="pt-4 border-t border-border/30">
                            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3">Alasan Utama</p>
                            <ul className="space-y-2" data-testid="list-main-reasons">
                              {aiData.decisionEngine.reasons.slice(0, 3).map((reason: string, idx: number) => (
                                <li key={idx} className="flex items-start gap-2 text-sm text-foreground" data-testid={`reason-${idx}`}>
                                  <div className={`w-1.5 h-1.5 rounded-full mt-2 shrink-0 ${
                                    aiData.decisionEngine.status === "Layak Dikoleksi Bertahap" 
                                      ? "bg-emerald-500" 
                                      : aiData.decisionEngine.status === "Perlu Waspada"
                                        ? "bg-amber-500"
                                        : "bg-red-500"
                                  }`} />
                                  {reason}
                                </li>
                              ))}
                            </ul>
                          </div>
                          
                          {/* RISIKO UTAMA - Only 1 */}
                          <div className="pt-4 border-t border-border/30">
                            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2 flex items-center gap-1.5">
                              <AlertTriangle className="w-3 h-3 text-amber-500" />
                              Risiko Utama
                            </p>
                            <p className="text-sm text-muted-foreground leading-relaxed" data-testid="text-primary-risk">
                              {aiData.decisionEngine.primaryRisk}
                            </p>
                          </div>
                          
                          {/* COCOK UNTUK SIAPA */}
                          <div className="pt-4 border-t border-border/30">
                            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2 flex items-center gap-1.5">
                              <Users className="w-3 h-3 text-primary" />
                              Cocok untuk Siapa
                            </p>
                            <p className="text-sm text-foreground font-medium" data-testid="text-investor-fit">
                              {aiData.decisionEngine.investorFit}
                            </p>
                          </div>
                        </div>
                      </Card>
                    )}
                    
                    {/* Loading state for decision engine */}
                    {aiLoading && (
                      <Card className="p-6 border-border/50 shadow-sm animate-pulse">
                        <div className="h-8 bg-muted rounded w-3/4 mb-4" />
                        <div className="space-y-2">
                          <div className="h-4 bg-muted rounded w-full" />
                          <div className="h-4 bg-muted rounded w-5/6" />
                          <div className="h-4 bg-muted rounded w-4/6" />
                        </div>
                      </Card>
                    )}

                    {/* SMART MONEY READINESS SCORE */}
                    {!aiLoading && aiData?.smartMoneyReadinessScore && (
                      <Card className="p-6 border-border/50 shadow-sm" data-testid="card-smart-money-readiness">
                        <div className="flex flex-col gap-4">
                          {/* Score Display */}
                          <div className="flex items-center justify-between flex-wrap gap-3">
                            <div className="flex items-center gap-3">
                              <div className={`w-14 h-14 rounded-full flex items-center justify-center ${
                                aiData.smartMoneyReadinessScore.score >= 75 
                                  ? "bg-emerald-100 dark:bg-emerald-900/40" 
                                  : aiData.smartMoneyReadinessScore.score >= 55
                                    ? "bg-blue-100 dark:bg-blue-900/40"
                                    : aiData.smartMoneyReadinessScore.score >= 35
                                      ? "bg-amber-100 dark:bg-amber-900/40"
                                      : "bg-red-100 dark:bg-red-900/40"
                              }`}>
                                <Target className={`w-7 h-7 ${
                                  aiData.smartMoneyReadinessScore.score >= 75 
                                    ? "text-emerald-600 dark:text-emerald-400" 
                                    : aiData.smartMoneyReadinessScore.score >= 55
                                      ? "text-blue-600 dark:text-blue-400"
                                      : aiData.smartMoneyReadinessScore.score >= 35
                                        ? "text-amber-600 dark:text-amber-400"
                                        : "text-red-600 dark:text-red-400"
                                }`} />
                              </div>
                              <div>
                                <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-0.5">Smart Money Readiness</p>
                                <div className="flex items-baseline gap-2">
                                  <span className={`text-3xl font-bold font-display ${
                                    aiData.smartMoneyReadinessScore.score >= 75 
                                      ? "text-emerald-700 dark:text-emerald-400" 
                                      : aiData.smartMoneyReadinessScore.score >= 55
                                        ? "text-blue-700 dark:text-blue-400"
                                        : aiData.smartMoneyReadinessScore.score >= 35
                                          ? "text-amber-700 dark:text-amber-400"
                                          : "text-red-700 dark:text-red-400"
                                  }`} data-testid="text-readiness-score">
                                    {aiData.smartMoneyReadinessScore.score}
                                  </span>
                                  <span className="text-lg text-muted-foreground font-medium">/ 100</span>
                                </div>
                              </div>
                            </div>
                            
                            {/* Status Label */}
                            <span className={`text-xs font-bold px-3 py-1.5 rounded-full ${
                              aiData.smartMoneyReadinessScore.score >= 75 
                                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300" 
                                : aiData.smartMoneyReadinessScore.score >= 55
                                  ? "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300"
                                  : aiData.smartMoneyReadinessScore.score >= 35
                                    ? "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
                                    : "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300"
                            }`} data-testid="badge-readiness-status">
                              {aiData.smartMoneyReadinessScore.statusLabel}
                            </span>
                          </div>
                          
                          {/* Short Explanation */}
                          <p className="text-sm text-muted-foreground leading-relaxed" data-testid="text-readiness-explanation">
                            {aiData.smartMoneyReadinessScore.shortExplanation}
                          </p>
                          
                          {/* Inconsistency Warning */}
                          {aiData.smartMoneyReadinessScore.hasInconsistency && (
                            <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20" data-testid="warning-inconsistency">
                              <AlertOctagon className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                              <p className="text-xs font-medium text-amber-700 dark:text-amber-400">
                                {aiData.smartMoneyReadinessScore.inconsistencyNote}
                              </p>
                            </div>
                          )}
                          
                          {/* Expandable Detail Section */}
                          <Collapsible className="pt-2 border-t border-border/30">
                            <CollapsibleTrigger className="flex items-center justify-between w-full py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors group" data-testid="button-expand-grading">
                              <span>Bagaimana Skor Ini Dinilai?</span>
                              <ChevronDown className="w-4 h-4 group-data-[state=open]:hidden" />
                              <ChevronUp className="w-4 h-4 hidden group-data-[state=open]:block" />
                            </CollapsibleTrigger>
                            <CollapsibleContent className="pt-3 space-y-4" data-testid="section-grading-detail">
                              {/* Component Breakdown Table */}
                              <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                  <thead>
                                    <tr className="border-b border-border/50">
                                      <th className="text-left py-2 text-xs font-bold text-muted-foreground uppercase tracking-widest">Komponen</th>
                                      <th className="text-center py-2 text-xs font-bold text-muted-foreground uppercase tracking-widest">Bobot</th>
                                      <th className="text-right py-2 text-xs font-bold text-muted-foreground uppercase tracking-widest">Kondisi Saat Ini</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {aiData.smartMoneyReadinessScore.components.map((comp: { name: string; weight: string; condition: string }, idx: number) => (
                                      <tr key={idx} className="border-b border-border/30 last:border-b-0" data-testid={`row-component-${idx}`}>
                                        <td className="py-2 text-foreground font-medium">{comp.name}</td>
                                        <td className="py-2 text-center text-muted-foreground">{comp.weight}</td>
                                        <td className="py-2 text-right">
                                          <span className={`text-xs font-semibold px-2 py-0.5 rounded ${
                                            comp.condition.includes("Aktif") || comp.condition.includes("Kuat") || comp.condition.includes("Konsisten") || comp.condition.includes("Selaras") || comp.condition.includes("Rendah")
                                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
                                              : comp.condition.includes("Rapuh") || comp.condition.includes("Parsial") || comp.condition.includes("Netral") || comp.condition.includes("Sedang") || comp.condition.includes("Tersembunyi")
                                                ? "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
                                                : "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300"
                                          }`}>
                                            {comp.condition}
                                          </span>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                              
                              {/* AI Grading Explanation */}
                              <div className="p-3 rounded-lg bg-muted/50 border border-border/30">
                                <p className="text-xs text-muted-foreground leading-relaxed" data-testid="text-grading-explanation">
                                  {aiData.smartMoneyReadinessScore.gradingExplanation}
                                </p>
                              </div>
                            </CollapsibleContent>
                          </Collapsible>
                        </div>
                      </Card>
                    )}

                    {/* Company Profile - Simplified */}
                    <Card className="p-6 border-border/50 shadow-sm">
                      <h3 className="text-lg font-bold font-display mb-4">Profil Perusahaan</h3>
                      <p className="text-muted-foreground leading-relaxed mb-4">
                        {stock.description}
                      </p>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-1">Sektor</p>
                          <p className="text-base font-semibold text-foreground">{stock.sector}</p>
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-1">Subsektor</p>
                          <p className="text-base font-semibold text-foreground">{stock.subsector}</p>
                        </div>
                      </div>
                    </Card>
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
                    {/* SECTION 1: MARKET REGIME (CORE ENGINE) */}
                    {!aiLoading && aiData?.marketMode && (
                      <Card className={`p-6 border-2 shadow-md ${
                        aiData.marketMode.includes("Akumulasi") 
                          ? "border-emerald-300 dark:border-emerald-700 bg-gradient-to-br from-emerald-500/10 to-emerald-500/5" 
                          : aiData.marketMode.includes("Distribusi")
                            ? "border-amber-300 dark:border-amber-700 bg-gradient-to-br from-amber-500/10 to-amber-500/5"
                            : "border-slate-300 dark:border-slate-700 bg-gradient-to-br from-slate-500/10 to-slate-500/5"
                      }`} data-testid="card-market-regime">
                        <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
                          <div>
                            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1">Rezim Pasar</p>
                            <h2 className={`text-xl font-bold font-display ${
                              aiData.marketMode.includes("Akumulasi") 
                                ? "text-emerald-700 dark:text-emerald-400" 
                                : aiData.marketMode.includes("Distribusi")
                                  ? "text-amber-700 dark:text-amber-400"
                                  : "text-foreground"
                            }`} data-testid="text-market-regime">
                              {aiData.marketMode}
                            </h2>
                          </div>
                          <span className={`text-xs font-bold px-3 py-1.5 rounded-full uppercase ${
                            aiData.marketModeConfidence === "Tinggi" 
                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300" 
                              : aiData.marketModeConfidence === "Sedang"
                                ? "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
                                : "bg-slate-100 text-slate-700 dark:bg-slate-800/40 dark:text-slate-300"
                          }`} data-testid="badge-regime-confidence">
                            Keyakinan {aiData.marketModeConfidence}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground leading-relaxed mb-4" data-testid="text-regime-explanation">
                          {aiData.marketModeExplanation}
                        </p>
                        {/* Operational Guidance */}
                        <div className="p-3 rounded-lg bg-background/50 border border-border/30">
                          <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1">Panduan Operasional</p>
                          <p className="text-sm text-foreground" data-testid="text-operational-guidance">
                            {aiData.marketMode.includes("Akumulasi Aktif") && "Fase ini mendukung strategi akumulasi bertahap. Pantau konfirmasi dari aliran dana yang konsisten."}
                            {aiData.marketMode.includes("Akumulasi Tersembunyi") && "Fase diam-diam membangun posisi. Hindari mengejar harga, fokus pada deteksi akumulasi institusional."}
                            {aiData.marketMode.includes("Distribusi Saat Menguat") && "Kenaikan harga mungkin menyembunyikan rotasi. Pertimbangkan untuk mengurangi eksposur pada penguatan."}
                            {aiData.marketMode.includes("Distribusi Pasif") && "Fase likuidasi bertahap. Hindari akumulasi baru hingga ada tanda stabilisasi."}
                            {aiData.marketMode === "Vakum Pasca-Distribusi" && "Fase pencarian level baru. Tunggu konfirmasi dukungan institusional sebelum mempertimbangkan posisi."}
                          </p>
                        </div>
                      </Card>
                    )}
                    
                    {/* Loading state */}
                    {aiLoading && (
                      <Card className="p-6 border-border/50 shadow-sm animate-pulse">
                        <div className="h-6 bg-muted rounded w-1/3 mb-4" />
                        <div className="h-8 bg-muted rounded w-2/3 mb-4" />
                        <div className="h-4 bg-muted rounded w-full" />
                      </Card>
                    )}

                    {/* SECTION 2: KUALITAS KENDALI BANDAR (Combined Score) */}
                    {!aiLoading && aiData?.controlQualityScore && (
                      <Card className="p-6 border-border/50 shadow-sm" data-testid="card-control-quality">
                        <div className="flex items-center justify-between mb-4">
                          <div>
                            <h3 className="text-lg font-bold font-display text-foreground">Kualitas Kendali Bandar</h3>
                            <p className="text-xs text-muted-foreground">Kombinasi: Kualitas Aliran + Reliabilitas + Stabilitas Broker</p>
                          </div>
                          <div className="text-right">
                            <p className={`text-3xl font-bold ${
                              aiData.controlQualityScore.level === "Tinggi" 
                                ? 'text-emerald-600 dark:text-emerald-400' 
                                : aiData.controlQualityScore.level === "Sedang" 
                                  ? 'text-amber-600 dark:text-amber-400' 
                                  : 'text-red-600 dark:text-red-400'
                            }`} data-testid="text-control-quality-score">
                              {aiData.controlQualityScore.score}
                            </p>
                            <p className="text-xs text-muted-foreground">/100</p>
                          </div>
                        </div>
                        
                        {/* Score Bar */}
                        <div className="mb-4">
                          <div className="h-3 bg-muted rounded-full overflow-hidden">
                            <div 
                              className={`h-full transition-all ${
                                aiData.controlQualityScore.level === "Tinggi" 
                                  ? 'bg-emerald-500' 
                                  : aiData.controlQualityScore.level === "Sedang" 
                                    ? 'bg-amber-500' 
                                    : 'bg-red-500'
                              }`}
                              style={{ width: `${aiData.controlQualityScore.score}%` }}
                            />
                          </div>
                          <div className="flex justify-between mt-1 text-[10px] text-muted-foreground">
                            <span>Lemah</span>
                            <span>Kuat</span>
                          </div>
                        </div>
                        
                        <div className="mb-4">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
                            aiData.controlQualityScore.level === "Tinggi" 
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' 
                              : aiData.controlQualityScore.level === "Sedang" 
                                ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' 
                                : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                          }`} data-testid="badge-control-quality-level">
                            Kendali {aiData.controlQualityScore.level}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground leading-relaxed" data-testid="text-control-quality-interpretation">
                          {aiData.controlQualityScore.interpretation}
                        </p>
                      </Card>
                    )}

                    {/* SECTION 3: KONSENTRASI KENDALI (Broker Control Score) */}
                    {!aiLoading && aiData?.brokerControlScore && (
                      <Card className="p-4 border-border/50 shadow-sm" data-testid="card-broker-control-score">
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="text-sm font-bold text-foreground">Konsentrasi Kendali</h4>
                            <p className="text-xs text-muted-foreground">Top 3 broker menguasai {aiData.brokerControlScore.score}% akumulasi</p>
                          </div>
                          <span className={`text-xs font-bold px-2 py-1 rounded ${
                            aiData.brokerControlScore.score >= 70 
                              ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' 
                              : aiData.brokerControlScore.score >= 40 
                                ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' 
                                : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                          }`} data-testid="badge-broker-control-level">
                            {aiData.brokerControlScore.level}
                          </span>
                        </div>
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
                      return (
                        <div className="space-y-6">
                          {/* SECTION 1: TINGKAT RISIKO SAAT INI */}
                          {!aiLoading && aiData?.simplifiedRisk && (
                            <Card className={`p-6 border-2 shadow-md ${
                              aiData.simplifiedRisk.level === "Rendah" 
                                ? "border-emerald-300 dark:border-emerald-700 bg-gradient-to-br from-emerald-500/10 to-emerald-500/5" 
                                : aiData.simplifiedRisk.level === "Sedang"
                                  ? "border-amber-300 dark:border-amber-700 bg-gradient-to-br from-amber-500/10 to-amber-500/5"
                                  : "border-red-300 dark:border-red-700 bg-gradient-to-br from-red-500/10 to-red-500/5"
                            }`} data-testid="card-risk-level">
                              <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
                                <div>
                                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1">Tingkat Risiko Saat Ini</p>
                                  <h2 className={`text-2xl font-bold font-display ${
                                    aiData.simplifiedRisk.level === "Rendah" 
                                      ? "text-emerald-700 dark:text-emerald-400" 
                                      : aiData.simplifiedRisk.level === "Sedang"
                                        ? "text-amber-700 dark:text-amber-400"
                                        : "text-red-700 dark:text-red-400"
                                  }`} data-testid="text-risk-level">
                                    {aiData.simplifiedRisk.level}
                                  </h2>
                                </div>
                                <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                                  aiData.simplifiedRisk.level === "Rendah" 
                                    ? "bg-emerald-100 dark:bg-emerald-900/40" 
                                    : aiData.simplifiedRisk.level === "Sedang"
                                      ? "bg-amber-100 dark:bg-amber-900/40"
                                      : "bg-red-100 dark:bg-red-900/40"
                                }`}>
                                  <Shield className={`w-6 h-6 ${
                                    aiData.simplifiedRisk.level === "Rendah" 
                                      ? "text-emerald-600 dark:text-emerald-400" 
                                      : aiData.simplifiedRisk.level === "Sedang"
                                        ? "text-amber-600 dark:text-amber-400"
                                        : "text-red-600 dark:text-red-400"
                                  }`} />
                                </div>
                              </div>
                              
                              {/* PENJELASAN SINGKAT (1 Paragraph) */}
                              <p className="text-sm text-muted-foreground leading-relaxed" data-testid="text-risk-explanation">
                                {aiData.simplifiedRisk.explanation}
                              </p>
                            </Card>
                          )}
                          
                          {/* Loading state */}
                          {aiLoading && (
                            <Card className="p-6 border-border/50 shadow-sm animate-pulse">
                              <div className="h-6 bg-muted rounded w-1/3 mb-4" />
                              <div className="h-8 bg-muted rounded w-1/4 mb-4" />
                              <div className="h-4 bg-muted rounded w-full" />
                            </Card>
                          )}

                          {/* SECTION 2: FAILURE TRIGGERS (MAX 3) */}
                          {!aiLoading && aiData?.simplifiedRisk?.failureTriggers && (
                            <Card className="p-6 border-border/50 shadow-sm" data-testid="card-failure-triggers">
                              <h3 className="text-sm font-bold text-foreground uppercase tracking-widest mb-4 flex items-center gap-2">
                                <AlertTriangle className="w-4 h-4 text-amber-500" />
                                Kapan Analisis Ini Bisa Salah
                              </h3>
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                {aiData.simplifiedRisk.failureTriggers.slice(0, 3).map((trigger: string, idx: number) => (
                                  <div key={idx} className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/5 border border-amber-500/20" data-testid={`failure-trigger-${idx}`}>
                                    <div className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                                    <p className="text-xs font-medium text-amber-700 dark:text-amber-400 leading-tight">
                                      {trigger}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            </Card>
                          )}

                          {/* SECTION 3: DETEKSI JEBAKAN PASAR (Smart Trap Detection Panel) */}
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
                                  <div className="flex items-start gap-3" data-testid="trap-content-container">
                                    <div 
                                      className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                                        aiData.trapDetection.type === "bull_trap"
                                          ? "bg-red-500/20"
                                          : aiData.trapDetection.type === "bear_trap"
                                          ? "bg-blue-500/20"
                                          : "bg-emerald-500/20"
                                      }`}
                                      data-testid={`trap-icon-${aiData.trapDetection.type}`}
                                    >
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
                                        <Gauge className="w-4 h-4 text-muted-foreground" data-testid="icon-confidence-gauge" />
                                        <span className="text-xs text-muted-foreground" data-testid="text-confidence-label">Keyakinan:</span>
                                        <div className="flex gap-1" data-testid="confidence-levels-container">
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
                                      <AlertOctagon 
                                        className={`w-4 h-4 ${
                                          aiData.trapDetection.type === "bull_trap"
                                            ? "text-red-600 dark:text-red-400"
                                            : "text-blue-600 dark:text-blue-400"
                                        }`} 
                                        data-testid="icon-trap-warning"
                                      />
                                      <p 
                                        className={`text-xs font-medium ${
                                          aiData.trapDetection.type === "bull_trap"
                                            ? "text-red-700 dark:text-red-300"
                                            : "text-blue-700 dark:text-blue-300"
                                        }`}
                                        data-testid="text-trap-warning"
                                      >
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
                        </div>
                      );
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
                            {/* HERO STATUS: INSIDER VS BANDAR ALIGNMENT */}
                            {aiData?.insiderBandarAlignment && (
                              <Card className={`p-6 border-2 shadow-md ${
                                aiData.insiderBandarAlignment.status === "Selaras" 
                                  ? "border-emerald-300 dark:border-emerald-700 bg-gradient-to-br from-emerald-500/10 to-emerald-500/5" 
                                  : aiData.insiderBandarAlignment.status === "Bertentangan"
                                    ? "border-red-300 dark:border-red-700 bg-gradient-to-br from-red-500/10 to-red-500/5"
                                    : "border-slate-300 dark:border-slate-700 bg-gradient-to-br from-slate-500/10 to-slate-500/5"
                              }`} data-testid="card-insider-bandar-alignment">
                                <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
                                  <div>
                                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1">Insider vs Bandar</p>
                                    <h2 className={`text-xl font-bold font-display ${
                                      aiData.insiderBandarAlignment.status === "Selaras" 
                                        ? "text-emerald-700 dark:text-emerald-400" 
                                        : aiData.insiderBandarAlignment.status === "Bertentangan"
                                          ? "text-red-700 dark:text-red-400"
                                          : "text-foreground"
                                    }`} data-testid="text-alignment-status">
                                      {aiData.insiderBandarAlignment.status}
                                    </h2>
                                  </div>
                                  <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                                    aiData.insiderBandarAlignment.status === "Selaras" 
                                      ? "bg-emerald-100 dark:bg-emerald-900/40" 
                                      : aiData.insiderBandarAlignment.status === "Bertentangan"
                                        ? "bg-red-100 dark:bg-red-900/40"
                                        : "bg-slate-100 dark:bg-slate-800/40"
                                  }`}>
                                    <UserCheck className={`w-6 h-6 ${
                                      aiData.insiderBandarAlignment.status === "Selaras" 
                                        ? "text-emerald-600 dark:text-emerald-400" 
                                        : aiData.insiderBandarAlignment.status === "Bertentangan"
                                          ? "text-red-600 dark:text-red-400"
                                          : "text-slate-600 dark:text-slate-400"
                                    }`} />
                                  </div>
                                </div>
                                <p className="text-sm text-muted-foreground leading-relaxed" data-testid="text-alignment-interpretation">
                                  {aiData.insiderBandarAlignment.interpretation}
                                </p>
                                
                                {/* Context with Market Regime */}
                                {aiData?.marketMode && (
                                  <div className="mt-4 p-3 rounded-lg bg-background/50 border border-border/30">
                                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1">Konteks Rezim Pasar</p>
                                    <p className="text-xs text-muted-foreground" data-testid="text-regime-context">
                                      Analisis ini dilakukan dalam konteks rezim pasar <span className="font-semibold text-foreground">{aiData.marketMode}</span>. 
                                      {aiData.marketMode.includes("Akumulasi") && " Keselarasan positif dalam fase akumulasi memperkuat tesis konstruktif."}
                                      {aiData.marketMode.includes("Distribusi") && " Perhatikan potensi divergensi jika insider mulai menjual saat distribusi berlangsung."}
                                    </p>
                                  </div>
                                )}
                              </Card>
                            )}
                            
                            {/* Insider Overview */}
                            <Card className="p-6 border-border/50 shadow-sm">
                              <div className="flex items-center justify-between mb-4">
                                <h3 className="text-base font-bold font-display text-foreground">Skor Keselarasan Insider</h3>
                                <div className="text-right">
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
