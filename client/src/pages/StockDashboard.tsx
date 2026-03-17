import { useEffect, useState, useMemo } from "react";
import { useParams, Link } from "wouter";
import { useStock } from "@/hooks/use-stocks";
import { 
  Users, Sparkles, Shield, Target, Activity, AlertOctagon, Lightbulb, 
  Gauge, ChevronDown, ChevronUp, EyeOff, Eye, HelpCircle, BarChart3, 
  Info, ArrowLeft, TrendingUp, DollarSign, Newspaper, AlertTriangle, 
  UserCheck, PieChart, Loader2, Package, Search, ChevronRight, Zap
} from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { StockHeader } from "@/components/StockHeader";
import { PriceChart } from "@/components/PriceChart";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { motion, AnimatePresence } from "framer-motion";
import { CandlestickChart } from "@/components/CandlestickChart";
import { Separator } from "@/components/ui/separator";

// IDX Market Session Status based on WIB time
function getIDXSessionStatus(): { label: string; color: "green" | "yellow" | "red" } {
  const now = new Date();
  const wibOffset = 7 * 60;
  const utcMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
  const wibMinutes = (utcMinutes + wibOffset) % (24 * 60);
  const hour = Math.floor(wibMinutes / 60);
  const minute = wibMinutes % 60;
  const totalMinutes = hour * 60 + minute;
  
  const wibDate = new Date(now.getTime() + wibOffset * 60 * 1000);
  const dayOfWeek = wibDate.getUTCDay();
  
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    return { label: "PASAR TUTUP", color: "red" };
  }
  
  if (totalMinutes >= 8 * 60 + 45 && totalMinutes < 9 * 60) {
    return { label: "PRA-PEMBUKAAN", color: "yellow" };
  }
  if (totalMinutes >= 9 * 60 && totalMinutes < 12 * 60) {
    return { label: "SESI 1 BERLANGSUNG", color: "green" };
  }
  if (totalMinutes >= 12 * 60 && totalMinutes < 13 * 60 + 30) {
    return { label: "ISTIRAHAT", color: "yellow" };
  }
  if (totalMinutes >= 13 * 60 + 30 && totalMinutes < 15 * 60 + 50) {
    return { label: "SESI 2 BERLANGSUNG", color: "green" };
  }
  if (totalMinutes >= 15 * 60 + 50 && totalMinutes < 16 * 60) {
    return { label: "PRA-PENUTUPAN", color: "yellow" };
  }
  return { label: "PASAR TUTUP", color: "red" };
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

function ConvictionTimeline({ phase, explanation }: { phase: string; explanation: string }) {
  const phases = ["Penempatan", "Konfirmasi", "Kepadatan", "Distribusi", "Reset"];
  const phaseLabels: Record<string, string> = {
    "Penempatan": "Penempatan",
    "Konfirmasi": "Konfirmasi",
    "Kepadatan": "Kepadatan",
    "Distribusi": "Distribusi",
    "Reset": "Reset",
    "Positioning": "Penempatan",
    "Confirmation": "Konfirmasi",
    "Crowding": "Kepadatan",
    "Distribution": "Distribusi"
  };
  const currentIndex = phases.indexOf(phase) !== -1 ? phases.indexOf(phase) : 
    phase === "Positioning" ? 0 : phase === "Confirmation" ? 1 : phase === "Crowding" ? 2 : phase === "Distribution" ? 3 : 4;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-mono font-bold text-[#8B8B8B] uppercase tracking-wider">Market Conviction Cycle</p>
        <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-[#4ADE80]/10 text-[#4ADE80] uppercase border border-[#4ADE80]/20">
          {phaseLabels[phase] || phase}
        </span>
      </div>
      <div className="relative h-1.5 bg-[#1F1F1F] rounded-full overflow-hidden flex">
        {phases.map((p, idx) => (
          <div 
            key={p} 
            className={`flex-1 h-full transition-all border-r border-[#0B0B0B]/50 last:border-0 ${
              idx === currentIndex ? "bg-[#4ADE80]" : idx < currentIndex ? "bg-[#4ADE80]/40" : "bg-transparent"
            }`}
          />
        ))}
      </div>
      <div className="flex justify-between text-[8px] text-[#8B8B8B] font-mono uppercase">
        {phases.map((p, idx) => (
          <span key={p} className={idx === currentIndex ? "text-[#4ADE80]" : ""}>{phaseLabels[p]}</span>
        ))}
      </div>
      <p className="text-[11px] text-[#8B8B8B] leading-relaxed italic border-t border-[#1F1F1F] pt-2">
        {explanation}
      </p>
    </div>
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
    }, 60000);
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
      // Pass the stock data to allow the AI to compute v2 scores if needed
      isGorengan: stock.stockCharacter === "Spekulatif",
      changePercent: stock.changePercent,
      growth: stock.growth,
      insiderData: stock.insiderData,
    };

    fetchAIAnalysis(payload)
      .then(setAIData)
      .catch(console.error)
      .finally(() => setAiLoading(false));
  }, [stock]);

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-[#0B0B0B]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 text-[#4ADE80] animate-spin" />
          <p className="text-[#8B8B8B] font-mono text-sm animate-pulse uppercase tracking-widest">Initializing terminal data...</p>
        </div>
      </div>
    );
  }

  if (error || !stock) {
    return (
      <div className="h-screen flex items-center justify-center bg-[#0B0B0B] p-4">
        <div className="max-w-md w-full p-8 text-center border border-[#EF4444]/20 bg-[#EF4444]/5 rounded-lg">
          <AlertTriangle className="w-10 h-10 text-[#EF4444] mx-auto mb-4" />
          <h2 className="text-lg font-mono font-bold text-[#EAEAEA] mb-2 uppercase">DATA FETCH ERROR</h2>
          <p className="text-[#8B8B8B] text-sm mb-6">
            Unable to retrieve terminal data for {symbol}. System offline or invalid ticker.
          </p>
          <button 
            onClick={() => window.location.reload()}
            className="px-6 py-2 bg-transparent border border-[#1F1F1F] text-[#EAEAEA] font-mono text-xs uppercase hover:bg-[#1A1A1A] transition-colors"
          >
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-[#0B0B0B] text-[#EAEAEA] font-sans selection:bg-[#4ADE80]/30 selection:text-[#4ADE80]">
      {/* TERMINAL NAVBAR */}
      <header className="h-14 bg-[#111111] border-b border-[#1F1F1F] sticky top-0 z-50 flex items-center px-4 shrink-0">
        <div className="flex items-center gap-4 w-1/3">
          <Link href="/" className="flex items-center gap-2 group">
            <ArrowLeft className="w-4 h-4 text-[#8B8B8B] group-hover:text-[#4ADE80] transition-colors" />
            <div className="flex items-baseline gap-1.5">
              <span className="font-mono font-bold text-lg text-[#4ADE80] tracking-tighter">BART</span>
              <span className="text-[10px] font-mono text-[#8B8B8B] uppercase hidden sm:block">Terminal</span>
            </div>
          </Link>
        </div>
        
        <div className="flex-1 flex flex-col items-center justify-center">
          <div className="flex items-center gap-3">
            <span className="font-mono text-xl font-bold tracking-tight text-[#EAEAEA]">{stock.symbol}</span>
            <span className="px-1.5 py-0.5 rounded border border-[#1F1F1F] bg-[#0B0B0B] text-[10px] font-mono font-bold text-[#8B8B8B]">IDX</span>
            <span className="text-sm font-medium text-[#8B8B8B] hidden md:block">{stock.name}</span>
          </div>
        </div>
        
        <div className="w-1/3 flex items-center justify-end gap-4">
          <div className="flex items-center gap-2 px-2.5 py-1 rounded bg-[#0B0B0B] border border-[#1F1F1F]" data-testid="badge-session-status">
            <div className={`w-1.5 h-1.5 rounded-full ${
              sessionStatus.color === "green" ? "bg-[#4ADE80] animate-pulse" : 
              sessionStatus.color === "yellow" ? "bg-[#FACC15]" : "bg-[#EF4444]"
            }`} />
            <span className={`text-[10px] font-mono font-bold ${
              sessionStatus.color === "green" ? "text-[#4ADE80]" : 
              sessionStatus.color === "yellow" ? "text-[#FACC15]" : "text-[#EF4444]"
            }`}>
              {sessionStatus.label}
            </span>
          </div>
          <div className="w-7 h-7 rounded bg-[#1A1A1A] border border-[#1F1F1F] flex items-center justify-center overflow-hidden">
             <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Felix" alt="User" className="w-full h-full object-cover" />
          </div>
        </div>
      </header>

      {/* THREE-PANEL TERMINAL LAYOUT */}
      <div className="flex flex-1 overflow-hidden">
        
        {/* LEFT PANEL: SIGNAL PANEL */}
        <aside className="hidden lg:flex flex-col w-64 bg-[#111111] border-r border-[#1F1F1F] overflow-y-auto custom-scrollbar shrink-0">
          <div className="p-3 bg-[#1A1A1A] border-b border-[#1F1F1F]">
            <h3 className="text-[10px] font-mono font-bold text-[#8B8B8B] uppercase tracking-widest flex items-center gap-2">
              <Zap className="w-3 h-3 text-[#4ADE80]" />
              Signal Panel
            </h3>
          </div>
          
          <div className="p-4 space-y-6">
            {/* COMPOSITE SCORE */}
            <div className="space-y-1" data-testid="section-composite-score">
              <label className="text-[10px] font-mono font-bold text-[#8B8B8B] uppercase tracking-wider">Composite Score</label>
              <div className={`text-5xl font-mono font-bold tracking-tighter ${
                (aiData?.readiness || 0) >= 70 ? "text-[#4ADE80]" : 
                (aiData?.readiness || 0) >= 40 ? "text-[#FACC15]" : "text-[#EF4444]"
              }`}>
                {aiLoading ? "—" : (aiData?.readiness || "—")}
              </div>
            </div>

            <Separator className="bg-[#1F1F1F]" />

            {/* MARKET REGIME */}
            <div className="space-y-1" data-testid="section-regime">
              <label className="text-[10px] font-mono font-bold text-[#8B8B8B] uppercase tracking-wider">Regime</label>
              <div className={`text-sm font-mono font-bold uppercase ${
                aiData?.marketRegime?.includes("Accumulation") || aiData?.marketRegime?.includes("Uptrend") || aiData?.marketRegime?.includes("Akumulasi") ? "text-[#4ADE80]" : 
                aiData?.marketRegime?.includes("Distribution") || aiData?.marketRegime?.includes("Downtrend") || aiData?.marketRegime?.includes("Distribusi") ? "text-[#EF4444]" : "text-[#FACC15]"
              }`}>
                {aiLoading ? "ANALYZING..." : (aiData?.marketRegime || "UNKNOWN")}
              </div>
            </div>

            {/* CAMPAIGN MATURITY */}
            <div className="space-y-1" data-testid="section-maturity">
              <label className="text-[10px] font-mono font-bold text-[#8B8B8B] uppercase tracking-wider">Campaign Maturity</label>
              <div className="flex mt-1">
                {(() => {
                  const phase = aiData?.convictionPhase?.phase || "—";
                  let label = "UNKNOWN";
                  let color = "bg-[#1F1F1F] text-[#8B8B8B]";
                  
                  if (phase.includes("Positioning") || phase.includes("Early") || phase.includes("Penempatan")) {
                    label = "EARLY";
                    color = "bg-[#4ADE80]/10 text-[#4ADE80] border-[#4ADE80]/20";
                  } else if (phase.includes("Confirmation") || phase.includes("Konfirmasi")) {
                    label = "BUILDING";
                    color = "bg-blue-500/10 text-blue-400 border-blue-500/20";
                  } else if (phase.includes("Crowding") || phase.includes("Kepadatan")) {
                    label = "MATURE";
                    color = "bg-[#FACC15]/10 text-[#FACC15] border-[#FACC15]/20";
                  } else if (phase.includes("Distribution") || phase.includes("Distribusi")) {
                    label = "EXTENDED";
                    color = "bg-[#EF4444]/10 text-[#EF4444] border-[#EF4444]/20";
                  }

                  return (
                    <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${color}`}>
                      {label}
                    </span>
                  );
                })()}
              </div>
            </div>

            {/* ABSORPTION */}
            <div className="space-y-1" data-testid="section-absorption">
              <label className="text-[10px] font-mono font-bold text-[#8B8B8B] uppercase tracking-wider">Absorption</label>
              <div className="flex mt-1">
                {(() => {
                  const score = aiData?.smartMoneyReadinessScore?.absorption || ((aiData?.readiness || 0) > 60 ? "Strong" : (aiData?.readiness || 0) > 30 ? "Moderate" : "Weak");
                  const color = score === "Strong" ? "text-[#4ADE80] bg-[#4ADE80]/10 border-[#4ADE80]/20" : 
                                score === "Moderate" ? "text-[#FACC15] bg-[#FACC15]/10 border-[#FACC15]/20" : "text-[#EF4444] bg-[#EF4444]/10 border-[#EF4444]/20";
                  return (
                    <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${color}`}>
                      {aiLoading ? "..." : score.toUpperCase()}
                    </span>
                  );
                })()}
              </div>
            </div>

            {/* FAKE BREAKOUT RISK */}
            <div className="space-y-1" data-testid="section-trap-risk">
              <label className="text-[10px] font-mono font-bold text-[#8B8B8B] uppercase tracking-wider">Fake Breakout Risk</label>
              <div className="flex mt-1">
                {(() => {
                  const isTrap = aiData?.trapDetection?.isTrap || (parseFloat(stock.changePercent) > 5 && (aiData?.readiness || 0) < 40);
                  return (
                    <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${
                      isTrap ? "text-[#EF4444] bg-[#EF4444]/10 border-[#EF4444]/20" : "text-[#4ADE80] bg-[#4ADE80]/10 border-[#4ADE80]/20"
                    }`}>
                      {aiLoading ? "..." : (isTrap ? "HIGH" : "LOW")}
                    </span>
                  );
                })()}
              </div>
            </div>

            <Separator className="bg-[#1F1F1F]" />

            {/* INSTITUTIONAL SIGNALS */}
            <div className="space-y-3" data-testid="section-institutional-signals">
               <label className="text-[10px] font-mono font-bold text-[#8B8B8B] uppercase tracking-wider">Institutional Signals</label>
               <div className="space-y-2">
                 <div className="flex justify-between items-center text-[11px] font-mono">
                   <span className="text-[#8B8B8B]">FLOW BIAS</span>
                   <span className={stock.flowBias === "Strong Accumulation" ? "text-[#4ADE80]" : stock.flowBias.includes("Accumulation") ? "text-[#4ADE80]/80" : "text-[#EF4444]"}>{stock.flowBias}</span>
                 </div>
                 <div className="flex justify-between items-center text-[11px] font-mono">
                   <span className="text-[#8B8B8B]">INTENSITY</span>
                   <span className="text-[#EAEAEA]">{stock.flowIntensity}</span>
                 </div>
                 <div className="flex justify-between items-center text-[11px] font-mono">
                   <span className="text-[#8B8B8B]">RELIABILITY</span>
                   <span className="text-[#EAEAEA]">{stock.flowReliability}</span>
                 </div>
                 {aiData?.smartMoneyIntent && (
                   <div className="flex justify-between items-center text-[11px] font-mono pt-2 border-t border-[#1F1F1F]">
                     <span className="text-[#8B8B8B]">INTENT</span>
                     <span className="text-blue-400">{aiData.smartMoneyIntent.primaryIntent}</span>
                   </div>
                 )}
               </div>
            </div>
          </div>
        </aside>

        {/* CENTER PANEL: MAIN CONTENT */}
        <main className="flex-1 flex flex-col overflow-y-auto bg-[#0B0B0B] custom-scrollbar">
          <div className="px-6 py-4">
             {/* REDESIGNED HEADER SECTION WRAPPER */}
             <div className="mb-6">
                <StockHeader stock={stock} />
             </div>

             {/* CANDLESTICK CHART */}
             <div className="mb-8 h-[500px] border border-[#1F1F1F] bg-[#111111] rounded-lg overflow-hidden relative" data-testid="candlestick-chart-container">
               <div className="absolute top-3 left-4 z-10">
                 <h3 className="text-[10px] font-mono font-bold text-[#8B8B8B] uppercase tracking-widest bg-[#111111]/80 px-2 py-1 rounded">
                   Historical Ticker Analysis
                 </h3>
               </div>
               <CandlestickChart symbol={stock.symbol} height={500} />
             </div>

             {/* TABS SECTION */}
             <Tabs defaultValue="overview" value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="w-full justify-start h-10 p-0 bg-[#111111] border-b border-[#1F1F1F] rounded-none gap-4">
                  {[
                    { id: "overview", label: "Overview", icon: PieChart },
                    { id: "flow", label: "Capital Flow", icon: Activity },
                    { id: "insider", label: "Insider", icon: UserCheck },
                    { id: "financials", label: "Financials", icon: DollarSign },
                    { id: "valuation", label: "Valuation", icon: TrendingUp },
                    { id: "news", label: "News", icon: Newspaper },
                    { id: "risk", label: "Risk Audit", icon: AlertTriangle },
                  ].map((tab) => (
                    <TabsTrigger 
                      key={tab.id} 
                      value={tab.id}
                      className="flex items-center gap-2 px-4 h-full rounded-none border-b-2 border-transparent data-[state=active]:border-[#4ADE80] data-[state=active]:bg-transparent data-[state=active]:text-[#4ADE80] transition-all font-mono text-xs uppercase font-bold"
                    >
                      <tab.icon className="w-3.5 h-3.5" />
                      {tab.label}
                    </TabsTrigger>
                  ))}
                </TabsList>
                
                <div className="mt-6 pb-20">
                  <TabsContent value="overview" className="mt-0 focus-visible:outline-none space-y-8">
                    {/* EXISTING OVERVIEW CONTENT RE-STYLED FOR TERMINAL */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* ACTION GUIDANCE HERO - MOVED TO RIGHT PANEL BUT KEEPING LOGIC HERE FOR MOBILE */}
                      <div className="xl:hidden">
                         {/* Action guidance would show here on mobile */}
                      </div>
                      
                      {/* BANDAR HEATMAP */}
                      {!aiLoading && aiData?.bandarHeatmap && (
                        <div className="p-5 bg-[#111111] border border-[#1F1F1F] rounded-lg" data-testid="card-bandar-heatmap">
                          <h4 className="text-xs font-mono font-bold text-[#EAEAEA] uppercase tracking-wider mb-4 flex items-center gap-2">
                             <Activity className="w-4 h-4 text-[#4ADE80]" />
                             Bandar Heatmap
                          </h4>
                          <div className="space-y-2">
                            {aiData.bandarHeatmap.map((entry: any, idx: number) => {
                              const net = entry.net || 0;
                              const maxAbs = Math.max(...aiData.bandarHeatmap.map((e: any) => Math.abs(e.net || 0)), 1);
                              const barWidth = Math.min(100, (Math.abs(net) / maxAbs) * 100);
                              const isPositive = net >= 0;
                              return (
                                <div key={idx} className="flex items-center gap-3" data-testid={`row-broker-${entry.broker}`}>
                                  <span className="font-mono text-[10px] text-[#8B8B8B] w-8">{entry.broker}</span>
                                  <div className="flex-1 h-3 bg-[#0B0B0B] border border-[#1F1F1F] rounded-sm overflow-hidden flex items-center">
                                    <div 
                                      className={`h-full ${isPositive ? "bg-[#4ADE80]" : "bg-[#EF4444]"}`} 
                                      style={{ width: `${barWidth}%`, opacity: 0.6 + (barWidth/100)*0.4 }} 
                                    />
                                  </div>
                                  <span className={`font-mono text-[10px] w-14 text-right ${isPositive ? "text-[#4ADE80]" : "text-[#EF4444]"}`}>
                                    {isPositive ? "+" : ""}{(net/1e9).toFixed(1)}B
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* PHASE TIMELINE */}
                      {!aiLoading && aiData?.phaseTimeline && (
                        <div className="p-5 bg-[#111111] border border-[#1F1F1F] rounded-lg" data-testid="card-phase-timeline">
                          <h4 className="text-xs font-mono font-bold text-[#EAEAEA] uppercase tracking-wider mb-4 flex items-center gap-2">
                             <Target className="w-4 h-4 text-blue-400" />
                             Phase Evolution
                          </h4>
                          <div className="space-y-4">
                            {aiData.phaseTimeline.map((item: any, index: number) => {
                              const phaseLabels: Record<string, string> = {
                                "Stealth Accumulation": "STEALTH ACCUM",
                                "Active Accumulation": "ACTIVE ACCUM",
                                "Early Accumulation": "EARLY ACCUM",
                                "Active Distribution": "ACTIVE DIST",
                                "Distribution": "DISTRIBUTION",
                                "Sideways": "SIDEWAYS"
                              };
                              return (
                                <div key={index} className="border border-[#1F1F1F] p-3 rounded bg-[#0B0B0B] flex justify-between items-center">
                                  <div>
                                    <span className="text-xs font-mono font-bold text-[#EAEAEA]">{phaseLabels[item.phase] || item.phase.toUpperCase()}</span>
                                    <p className="text-[10px] text-[#8B8B8B] mt-1 italic">Institutional activity detected in this phase</p>
                                  </div>
                                  {item.confidence && (
                                    <span className="text-[10px] font-mono font-bold bg-[#1F1F1F] px-1.5 py-0.5 rounded text-[#8B8B8B]">CONF: {item.confidence}</span>
                                  )}
                                </div>
                              );
                            })}
                            {aiData.bandarPhaseInterpretation && (
                              <div className="mt-4 pt-4 border-t border-[#1F1F1F]">
                                <p className="text-[11px] text-[#8B8B8B] leading-relaxed italic">
                                  {aiData.bandarPhaseInterpretation}
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* BROKER SUMMARY TABLE */}
                    <div className="bg-[#111111] border border-[#1F1F1F] rounded-lg overflow-hidden">
                      <div className="p-4 bg-[#1A1A1A] border-b border-[#1F1F1F] flex justify-between items-center">
                         <h4 className="text-[10px] font-mono font-bold text-[#8B8B8B] uppercase tracking-widest">Broker Activity Ledger</h4>
                         {aiData?.smartMoneyIntent && (
                           <div className="text-[10px] font-mono font-bold text-[#4ADE80]">INTENT: {aiData.smartMoneyIntent.primaryIntent.toUpperCase()}</div>
                         )}
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-[11px] font-mono">
                          <thead>
                            <tr className="border-b border-[#1F1F1F] bg-[#0B0B0B]/50">
                              <th className="text-left py-2 px-4 text-[#8B8B8B]">CODE</th>
                              <th className="text-left py-2 px-4 text-[#8B8B8B]">NAME</th>
                              <th className="text-right py-2 px-4 text-[#8B8B8B]">AVG BUY</th>
                              <th className="text-right py-2 px-4 text-[#8B8B8B]">AVG SELL</th>
                              <th className="text-right py-2 px-4 text-[#8B8B8B]">NET BUY (IDR)</th>
                              <th className="text-right py-2 px-4 text-[#8B8B8B]">NET SELL (IDR)</th>
                              <th className="text-right py-2 px-4 text-[#8B8B8B]">% VOL</th>
                              <th className="text-right py-2 px-4 text-[#8B8B8B]">ROLE</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#1F1F1F]">
                            {(() => {
                                try {
                                  const brokers = JSON.parse(stock.brokerData);
                                  const sorted = [...brokers].sort((a: any, b: any) => {
                                    const aVal = parseFloat(a.netBuy?.replace(/[B IDR]/g, "") || a.netSell?.replace(/[B IDR]/g, "") || "0");
                                    const bVal = parseFloat(b.netBuy?.replace(/[B IDR]/g, "") || b.netSell?.replace(/[B IDR]/g, "") || "0");
                                    return bVal - aVal;
                                  });
                                  return sorted.map((broker: any, index: number) => (
                                    <tr key={index} className="hover:bg-[#1A1A1A] transition-colors">
                                      <td className="py-2 px-4 font-bold text-[#EAEAEA]">{broker.code}</td>
                                      <td className="py-2 px-4 text-[#8B8B8B] truncate max-w-[120px]">{broker.name}</td>
                                      <td className="text-right py-2 px-4 text-[#4ADE80]">{broker.avgBuy || "—"}</td>
                                      <td className="text-right py-2 px-4 text-[#EF4444]">{broker.avgSell || "—"}</td>
                                      <td className="text-right py-2 px-4 font-bold text-[#4ADE80]">{broker.netBuy || "—"}</td>
                                      <td className="text-right py-2 px-4 font-bold text-[#EF4444]">{broker.netSell || "—"}</td>
                                      <td className="text-right py-2 px-4 text-[#EAEAEA]">{broker.volumePercent}</td>
                                      <td className="py-2 px-4 text-right">
                                        {(() => {
                                          const insight = aiData?.brokerInsights?.find((i: any) => i.brokerCode === broker.code);
                                          return insight ? (
                                            <span className="text-[9px] font-bold px-1 py-0.5 rounded bg-[#1F1F1F] text-[#EAEAEA] border border-[#1F1F1F] uppercase">
                                              {insight.inferredRole}
                                            </span>
                                          ) : <span className="text-[#8B8B8B]">—</span>;
                                        })()}
                                      </td>
                                    </tr>
                                  ));
                                } catch (e) { return <tr><td colSpan={8} className="py-4 text-center text-[#8B8B8B]">DATA UNAVAILABLE</td></tr>; }
                            })()}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </TabsContent>

                  {/* CAPITAL FLOW TAB */}
                  <TabsContent value="flow" className="mt-0 focus-visible:outline-none space-y-6">
                     <div className="p-6 bg-[#111111] border border-[#1F1F1F] rounded-lg">
                        <h4 className="text-xs font-mono font-bold text-[#EAEAEA] uppercase tracking-wider mb-6 flex items-center gap-2">
                           <Activity className="w-4 h-4 text-[#4ADE80]" />
                           Investor Flow Analysis
                        </h4>
                        {(() => {
                          try {
                            const data = JSON.parse(stock.foreignActivityData);
                            return (
                              <div className="space-y-8">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                                  <div className="space-y-4">
                                    <h5 className="text-[10px] font-mono font-bold text-[#8B8B8B] uppercase tracking-widest border-b border-[#1F1F1F] pb-2">Foreign Institution</h5>
                                    <div className="space-y-3 font-mono">
                                      <div className="flex justify-between items-center text-sm">
                                        <span className="text-[#8B8B8B]">BUY VOL</span>
                                        <span className="text-[#4ADE80] font-bold">{data.foreignBuy}</span>
                                      </div>
                                      <div className="flex justify-between items-center text-sm">
                                        <span className="text-[#8B8B8B]">SELL VOL</span>
                                        <span className="text-[#EF4444] font-bold">{data.foreignSell}</span>
                                      </div>
                                      <div className="flex justify-between items-center pt-3 border-t border-[#1F1F1F]">
                                        <span className="text-[#EAEAEA] font-bold">NET FLOW</span>
                                        <span className={`font-bold ${data.netForeignFlow.includes("-") ? "text-[#EF4444]" : "text-[#4ADE80]"}`}>{data.netForeignFlow}</span>
                                      </div>
                                    </div>
                                  </div>
                                  <div className="space-y-4">
                                    <h5 className="text-[10px] font-mono font-bold text-[#8B8B8B] uppercase tracking-widest border-b border-[#1F1F1F] pb-2">Domestic Institution</h5>
                                    <div className="space-y-3 font-mono">
                                      <div className="flex justify-between items-center text-sm">
                                        <span className="text-[#8B8B8B]">BUY VOL</span>
                                        <span className="text-[#4ADE80] font-bold">{data.domesticBuy}</span>
                                      </div>
                                      <div className="flex justify-between items-center text-sm">
                                        <span className="text-[#8B8B8B]">SELL VOL</span>
                                        <span className="text-[#EF4444] font-bold">{data.domesticSell}</span>
                                      </div>
                                      <div className="flex justify-between items-center pt-3 border-t border-[#1F1F1F]">
                                        <span className="text-[#EAEAEA] font-bold">NET FLOW</span>
                                        <span className={`font-bold ${data.netDomesticFlow?.includes("-") ? "text-[#EF4444]" : "text-[#4ADE80]"}`}>{data.netDomesticFlow || "N/A"}</span>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                                <div className="space-y-3">
                                  <h5 className="text-[10px] font-mono font-bold text-[#8B8B8B] uppercase tracking-widest">Market Participation Split</h5>
                                  <div className="flex items-center gap-4">
                                    <div className="flex-1 h-2 bg-[#0B0B0B] border border-[#1F1F1F] rounded-full overflow-hidden flex">
                                      <div className="bg-blue-500" style={{ width: `${data.domesticPercent}%` }} />
                                      <div className="bg-[#FACC15]" style={{ width: `${data.foreignPercent}%` }} />
                                    </div>
                                    <div className="flex gap-4 text-[10px] font-mono font-bold">
                                      <div className="flex items-center gap-1.5"><div className="w-2 h-2 bg-blue-500 rounded-full" /> DOMESTIK {data.domesticPercent}%</div>
                                      <div className="flex items-center gap-1.5"><div className="w-2 h-2 bg-[#FACC15] rounded-full" /> ASING {data.foreignPercent}%</div>
                                    </div>
                                  </div>
                                </div>
                                <div className="p-4 bg-[#0B0B0B] border border-[#1F1F1F] rounded italic">
                                   <p className="text-xs text-[#8B8B8B] leading-relaxed">{stock.flowAnalystView}</p>
                                </div>
                              </div>
                            );
                          } catch (e) { return null; }
                        })()}
                     </div>
                  </TabsContent>

                  {/* ── INSIDER TAB ──────────────────────────────── */}
                  <TabsContent value="insider" className="mt-0 focus-visible:outline-none space-y-6">
                    {(() => {
                      try {
                        const insider = JSON.parse(stock.insiderData);
                        return (
                          <div className="space-y-6">
                            {/* Alignment Score + Signal Summary */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                              <div className="col-span-1 bg-[#111111] border border-[#1F1F1F] rounded-lg p-5 flex flex-col items-center justify-center gap-2">
                                <span className="text-[10px] font-mono font-bold text-[#8B8B8B] uppercase tracking-widest">Insider Alignment</span>
                                <span className={`text-5xl font-mono font-bold ${insider.alignmentScore >= 70 ? "text-[#4ADE80]" : insider.alignmentScore >= 40 ? "text-[#FACC15]" : "text-[#EF4444]"}`} data-testid="text-insider-alignment">{insider.alignmentScore}</span>
                                <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded uppercase ${insider.signalStrength === "Kuat" ? "bg-[#4ADE80]/10 text-[#4ADE80] border border-[#4ADE80]/20" : "bg-[#FACC15]/10 text-[#FACC15] border border-[#FACC15]/20"}`}>{insider.signalStrength}</span>
                              </div>
                              <div className="col-span-2 bg-[#111111] border border-[#1F1F1F] rounded-lg p-5 space-y-4">
                                <h4 className="text-[10px] font-mono font-bold text-[#8B8B8B] uppercase tracking-widest border-b border-[#1F1F1F] pb-3">Net Flow Summary</h4>
                                <div className="grid grid-cols-3 gap-4 font-mono">
                                  <div className="space-y-1">
                                    <div className="text-[10px] text-[#8B8B8B] uppercase">Total Buy</div>
                                    <div className="text-base font-bold text-[#4ADE80]">{insider.totalBuy}</div>
                                  </div>
                                  <div className="space-y-1">
                                    <div className="text-[10px] text-[#8B8B8B] uppercase">Total Sell</div>
                                    <div className="text-base font-bold text-[#EF4444]">{insider.totalSell}</div>
                                  </div>
                                  <div className="space-y-1">
                                    <div className="text-[10px] text-[#8B8B8B] uppercase">Net</div>
                                    <div className={`text-base font-bold ${insider.netFlow?.startsWith("+") ? "text-[#4ADE80]" : "text-[#EF4444]"}`}>{insider.netFlow}</div>
                                  </div>
                                </div>
                                <div className="h-2 bg-[#0B0B0B] border border-[#1F1F1F] rounded-full overflow-hidden flex">
                                  <div className="bg-[#4ADE80] h-full transition-all" style={{ width: `${insider.buyPercent}%` }} />
                                  <div className="bg-[#EF4444] h-full transition-all" style={{ width: `${insider.sellPercent}%` }} />
                                </div>
                                <div className="flex gap-4 text-[10px] font-mono font-bold">
                                  <span className="flex items-center gap-1.5"><span className="w-2 h-2 bg-[#4ADE80] rounded-full" />BUY {insider.buyPercent}%</span>
                                  <span className="flex items-center gap-1.5"><span className="w-2 h-2 bg-[#EF4444] rounded-full" />SELL {insider.sellPercent}%</span>
                                </div>
                              </div>
                            </div>

                            {/* AI Interpretation */}
                            {insider.aiInterpretation && (
                              <div className="bg-[#111111] border border-[#1F1F1F] rounded-lg overflow-hidden">
                                <div className="p-4 bg-[#1A1A1A] border-b border-[#1F1F1F]">
                                  <h4 className="text-[10px] font-mono font-bold text-[#8B8B8B] uppercase tracking-widest">AI Interpretation</h4>
                                </div>
                                <div className="p-5 space-y-4">
                                  <p className="text-sm text-[#EAEAEA] leading-relaxed">{insider.aiInterpretation}</p>
                                  {insider.sentimentNote && <p className="text-xs text-[#8B8B8B] leading-relaxed italic border-l-2 border-[#1F1F1F] pl-4">{insider.sentimentNote}</p>}
                                </div>
                              </div>
                            )}

                            {/* Transactions Table */}
                            {insider.transactions?.length > 0 && (
                              <div className="bg-[#111111] border border-[#1F1F1F] rounded-lg overflow-hidden">
                                <div className="p-4 bg-[#1A1A1A] border-b border-[#1F1F1F]">
                                  <h4 className="text-[10px] font-mono font-bold text-[#8B8B8B] uppercase tracking-widest">Registered Transactions</h4>
                                </div>
                                <div className="overflow-x-auto">
                                  <table className="w-full text-[11px] font-mono">
                                    <thead>
                                      <tr className="border-b border-[#1F1F1F] bg-[#0B0B0B]/60">
                                        <th className="text-left py-2.5 px-4 text-[#8B8B8B]">NAME</th>
                                        <th className="text-left py-2.5 px-4 text-[#8B8B8B]">POSITION</th>
                                        <th className="text-center py-2.5 px-4 text-[#8B8B8B]">TYPE</th>
                                        <th className="text-right py-2.5 px-4 text-[#8B8B8B]">SHARES</th>
                                        <th className="text-right py-2.5 px-4 text-[#8B8B8B]">PRICE</th>
                                        <th className="text-right py-2.5 px-4 text-[#8B8B8B]">DATE</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-[#1F1F1F]">
                                      {insider.transactions.map((tx: any, idx: number) => (
                                        <tr key={idx} className="hover:bg-[#1A1A1A] transition-colors" data-testid={`row-insider-${idx}`}>
                                          <td className="py-2.5 px-4 font-bold text-[#EAEAEA]">{tx.name}</td>
                                          <td className="py-2.5 px-4 text-[#8B8B8B]">{tx.position}</td>
                                          <td className="py-2.5 px-4 text-center">
                                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${tx.type === "Beli" ? "bg-[#4ADE80]/10 text-[#4ADE80] border border-[#4ADE80]/20" : "bg-[#EF4444]/10 text-[#EF4444] border border-[#EF4444]/20"}`}>{tx.type}</span>
                                          </td>
                                          <td className="py-2.5 px-4 text-right text-[#EAEAEA]">{tx.shares}</td>
                                          <td className="py-2.5 px-4 text-right font-bold text-[#EAEAEA]">{tx.price}</td>
                                          <td className="py-2.5 px-4 text-right text-[#8B8B8B]">{tx.date}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            )}

                            {/* Bandar Alignment */}
                            {aiData?.insiderBandarAlignment && (
                              <div className="bg-[#111111] border border-[#1F1F1F] rounded-lg p-5 flex items-start gap-4">
                                <div className={`shrink-0 w-2.5 h-2.5 rounded-full mt-1 ${aiData.insiderBandarAlignment.status === "Selaras" ? "bg-[#4ADE80]" : "bg-[#FACC15]"}`} />
                                <div>
                                  <div className="text-xs font-mono font-bold text-[#EAEAEA] uppercase mb-1">Bandar–Insider Alignment: <span className={aiData.insiderBandarAlignment.status === "Selaras" ? "text-[#4ADE80]" : "text-[#FACC15]"}>{aiData.insiderBandarAlignment.status}</span></div>
                                  <p className="text-xs text-[#8B8B8B] leading-relaxed">{aiData.insiderBandarAlignment.interpretation}</p>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      } catch (e) {
                        return (
                          <div className="bg-[#111111] border border-[#1F1F1F] rounded-lg p-10 text-center font-mono text-xs text-[#8B8B8B] uppercase tracking-widest">
                            No Insider Data Available for {stock.symbol}
                          </div>
                        );
                      }
                    })()}
                  </TabsContent>

                  {/* ── FINANCIALS TAB ────────────────────────────── */}
                  <TabsContent value="financials" className="mt-0 focus-visible:outline-none space-y-6">
                    <div className="space-y-6">
                      {/* Key Ratios Row */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {[
                          { label: "P/E Ratio", value: stock.peRatio ? `${stock.peRatio}×` : "—", note: "Price/Earnings" },
                          { label: "ROE", value: stock.roe ? `${stock.roe}%` : "—", note: "Return on Equity" },
                          { label: "Net Margin", value: stock.netMargin ? `${stock.netMargin}%` : "—", note: "Profitability" },
                          { label: "Revenue Growth", value: stock.growth ? `${stock.growth}%` : "—", note: "YoY Growth" },
                        ].map((m) => (
                          <div key={m.label} className="bg-[#111111] border border-[#1F1F1F] rounded-lg p-4 space-y-1" data-testid={`card-metric-${m.label.replace(/[^a-z]/gi, "-").toLowerCase()}`}>
                            <div className="text-[10px] font-mono text-[#8B8B8B] uppercase tracking-widest">{m.label}</div>
                            <div className="text-2xl font-mono font-bold text-[#EAEAEA]">{m.value}</div>
                            <div className="text-[10px] font-mono text-[#8B8B8B]">{m.note}</div>
                          </div>
                        ))}
                      </div>

                      {/* Income Statement Trend */}
                      <div className="bg-[#111111] border border-[#1F1F1F] rounded-lg overflow-hidden">
                        <div className="p-4 bg-[#1A1A1A] border-b border-[#1F1F1F]">
                          <h4 className="text-[10px] font-mono font-bold text-[#8B8B8B] uppercase tracking-widest">Income Statement (3-Year)</h4>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-[11px] font-mono">
                            <thead>
                              <tr className="border-b border-[#1F1F1F] bg-[#0B0B0B]/60">
                                <th className="text-left py-2.5 px-5 text-[#8B8B8B]">METRIC</th>
                                <th className="text-right py-2.5 px-5 text-[#8B8B8B]">FY 2023</th>
                                <th className="text-right py-2.5 px-5 text-[#8B8B8B]">FY 2024</th>
                                <th className="text-right py-2.5 px-5 text-[#8B8B8B] text-[#4ADE80]">FY 2025</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-[#1F1F1F]">
                              <tr className="hover:bg-[#1A1A1A]">
                                <td className="py-3 px-5 text-[#8B8B8B] font-bold uppercase">Revenue</td>
                                <td className="py-3 px-5 text-right text-[#EAEAEA]">{stock.revenue2023 || "—"}</td>
                                <td className="py-3 px-5 text-right text-[#EAEAEA]">{stock.revenue2024 || "—"}</td>
                                <td className="py-3 px-5 text-right font-bold text-[#4ADE80]">{stock.revenue2025 || "—"}</td>
                              </tr>
                              <tr className="hover:bg-[#1A1A1A]">
                                <td className="py-3 px-5 text-[#8B8B8B] font-bold uppercase">Net Profit</td>
                                <td className="py-3 px-5 text-right text-[#EAEAEA]">{stock.netProfit2023 || "—"}</td>
                                <td className="py-3 px-5 text-right text-[#EAEAEA]">{stock.netProfit2024 || "—"}</td>
                                <td className="py-3 px-5 text-right font-bold text-[#4ADE80]">{stock.netProfit2025 || "—"}</td>
                              </tr>
                              <tr className="hover:bg-[#1A1A1A]">
                                <td className="py-3 px-5 text-[#8B8B8B] font-bold uppercase">Total Assets</td>
                                <td className="py-3 px-5 text-right text-[#EAEAEA]">{stock.assets2023 || "—"}</td>
                                <td className="py-3 px-5 text-right text-[#EAEAEA]">{stock.assets2024 || "—"}</td>
                                <td className="py-3 px-5 text-right font-bold text-[#4ADE80]">{stock.assets2025 || "—"}</td>
                              </tr>
                              <tr className="hover:bg-[#1A1A1A]">
                                <td className="py-3 px-5 text-[#8B8B8B] font-bold uppercase">Total Liabilities</td>
                                <td className="py-3 px-5 text-right text-[#EAEAEA]">{stock.liabilities2023 || "—"}</td>
                                <td className="py-3 px-5 text-right text-[#EAEAEA]">{stock.liabilities2024 || "—"}</td>
                                <td className="py-3 px-5 text-right font-bold text-[#EAEAEA]">{stock.liabilities2025 || "—"}</td>
                              </tr>
                              <tr className="hover:bg-[#1A1A1A]">
                                <td className="py-3 px-5 text-[#8B8B8B] font-bold uppercase">Operating Cash Flow</td>
                                <td className="py-3 px-5 text-right text-[#EAEAEA]">{stock.ocf2023 || "—"}</td>
                                <td className="py-3 px-5 text-right text-[#EAEAEA]">{stock.ocf2024 || "—"}</td>
                                <td className="py-3 px-5 text-right font-bold text-[#4ADE80]">{stock.ocf2025 || "—"}</td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* Analyst View */}
                      {stock.financialsAnalystView && (
                        <div className="bg-[#111111] border border-[#1F1F1F] rounded-lg overflow-hidden">
                          <div className="p-4 bg-[#1A1A1A] border-b border-[#1F1F1F]">
                            <h4 className="text-[10px] font-mono font-bold text-[#8B8B8B] uppercase tracking-widest">Analyst Assessment</h4>
                          </div>
                          <div className="p-5">
                            <p className="text-sm text-[#EAEAEA] leading-relaxed">{stock.financialsAnalystView}</p>
                          </div>
                        </div>
                      )}

                      {/* Financial Summary */}
                      {stock.financialSummary && (
                        <div className="bg-[#111111] border-l-2 border-[#4ADE80] pl-4 py-2">
                          <p className="text-xs text-[#8B8B8B] leading-relaxed italic">{stock.financialSummary}</p>
                        </div>
                      )}
                    </div>
                  </TabsContent>

                  {/* ── VALUATION TAB ─────────────────────────────── */}
                  <TabsContent value="valuation" className="mt-0 focus-visible:outline-none space-y-6">
                    <div className="space-y-6">
                      {/* Core Valuation Multiples */}
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        {[
                          { label: "P/E Ratio", value: stock.peRatio ? `${stock.peRatio}×` : "—", desc: "Price to Earnings", color: "text-[#EAEAEA]" },
                          { label: "Dividend Yield", value: stock.dividendYield ? `${stock.dividendYield}%` : "—", desc: "Annual Yield", color: "text-[#4ADE80]" },
                          { label: "ROE", value: stock.roe ? `${stock.roe}%` : "—", desc: "Return on Equity", color: stock.roe && parseFloat(stock.roe) >= 15 ? "text-[#4ADE80]" : "text-[#FACC15]" },
                          { label: "Net Margin", value: stock.netMargin ? `${stock.netMargin}%` : "—", desc: "Profit Efficiency", color: stock.netMargin && parseFloat(stock.netMargin) >= 20 ? "text-[#4ADE80]" : "text-[#EAEAEA]" },
                          { label: "Revenue Growth", value: stock.growth ? `${stock.growth}%` : "—", desc: "YoY Growth", color: stock.growth && parseFloat(stock.growth) >= 10 ? "text-[#4ADE80]" : "text-[#FACC15]" },
                          { label: "Market Cap", value: stock.marketCap || "—", desc: "Total Capitalization", color: "text-[#EAEAEA]" },
                        ].map((v) => (
                          <div key={v.label} className="bg-[#111111] border border-[#1F1F1F] rounded-lg p-5 space-y-2" data-testid={`card-valuation-${v.label.replace(/[^a-z]/gi, "-").toLowerCase()}`}>
                            <div className="text-[10px] font-mono text-[#8B8B8B] uppercase tracking-widest">{v.label}</div>
                            <div className={`text-3xl font-mono font-bold ${v.color}`}>{v.value}</div>
                            <div className="text-[10px] font-mono text-[#8B8B8B]">{v.desc}</div>
                          </div>
                        ))}
                      </div>

                      {/* Investor View */}
                      {stock.investorView && (
                        <div className="bg-[#111111] border border-[#1F1F1F] rounded-lg overflow-hidden">
                          <div className="p-4 bg-[#1A1A1A] border-b border-[#1F1F1F]">
                            <h4 className="text-[10px] font-mono font-bold text-[#8B8B8B] uppercase tracking-widest">Institutional Investor Perspective</h4>
                          </div>
                          <div className="p-5">
                            <p className="text-sm text-[#EAEAEA] leading-relaxed">{stock.investorView}</p>
                          </div>
                        </div>
                      )}

                      {/* Retail Summary */}
                      {stock.retailSummary && (
                        <div className="bg-[#111111] border border-[#1F1F1F] rounded-lg overflow-hidden">
                          <div className="p-4 bg-[#1A1A1A] border-b border-[#1F1F1F]">
                            <h4 className="text-[10px] font-mono font-bold text-[#8B8B8B] uppercase tracking-widest">Retail Investor Suitability</h4>
                          </div>
                          <div className="p-5">
                            <p className="text-sm text-[#8B8B8B] leading-relaxed">{stock.retailSummary}</p>
                          </div>
                        </div>
                      )}

                      {/* Corporate Actions */}
                      {(() => {
                        try {
                          const actions = JSON.parse(stock.corporateActions);
                          if (!actions?.length) return null;
                          return (
                            <div className="bg-[#111111] border border-[#1F1F1F] rounded-lg overflow-hidden">
                              <div className="p-4 bg-[#1A1A1A] border-b border-[#1F1F1F]">
                                <h4 className="text-[10px] font-mono font-bold text-[#8B8B8B] uppercase tracking-widest">Corporate Actions</h4>
                              </div>
                              <div className="divide-y divide-[#1F1F1F]">
                                {actions.map((action: any, idx: number) => (
                                  <div key={idx} className="p-4 flex items-start gap-4 hover:bg-[#1A1A1A] transition-colors" data-testid={`row-corpaction-${idx}`}>
                                    <div className={`mt-0.5 shrink-0 px-1.5 py-0.5 rounded text-[9px] font-mono font-bold uppercase ${action.status === "Selesai" ? "bg-[#4ADE80]/10 text-[#4ADE80] border border-[#4ADE80]/20" : "bg-[#FACC15]/10 text-[#FACC15] border border-[#FACC15]/20"}`}>{action.status}</div>
                                    <div className="flex-1">
                                      <div className="text-xs font-mono font-bold text-[#EAEAEA] mb-1">{action.type} <span className="text-[#8B8B8B] font-normal">— {action.date}</span></div>
                                      <div className="text-xs text-[#8B8B8B] leading-relaxed">{action.explanation}</div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        } catch (e) { return null; }
                      })()}
                    </div>
                  </TabsContent>

                  {/* ── RISK AUDIT TAB ────────────────────────────── */}
                  <TabsContent value="risk" className="mt-0 focus-visible:outline-none space-y-6">
                    {(() => {
                      try {
                        const riskData = JSON.parse(stock.riskData);
                        return (
                          <div className="space-y-6">
                            {/* Risk Level Header */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                              <div className="bg-[#111111] border border-[#1F1F1F] rounded-lg p-5 space-y-2">
                                <div className="text-[10px] font-mono text-[#8B8B8B] uppercase tracking-widest">Overall Risk Level</div>
                                <div className={`text-3xl font-mono font-bold ${riskData.level === "Rendah" ? "text-[#4ADE80]" : riskData.level === "Sedang" ? "text-[#FACC15]" : "text-[#EF4444]"}`} data-testid="text-risk-level">{riskData.level}</div>
                                <div className="text-[10px] font-mono text-[#8B8B8B]">Risk Profile</div>
                              </div>
                              <div className="bg-[#111111] border border-[#1F1F1F] rounded-lg p-5 space-y-2">
                                <div className="text-[10px] font-mono text-[#8B8B8B] uppercase tracking-widest">Risk Skew</div>
                                <div className="text-3xl font-mono font-bold text-[#EAEAEA]">{riskData.skew}</div>
                                <div className="text-[10px] font-mono text-[#8B8B8B]">Asymmetry</div>
                              </div>
                              {aiData?.simplifiedRisk && (
                                <div className="bg-[#111111] border border-[#1F1F1F] rounded-lg p-5 space-y-2">
                                  <div className="text-[10px] font-mono text-[#8B8B8B] uppercase tracking-widest">AI Risk Score</div>
                                  <div className={`text-3xl font-mono font-bold ${aiData.simplifiedRisk.level === "Rendah" ? "text-[#4ADE80]" : aiData.simplifiedRisk.level === "Sedang" ? "text-[#FACC15]" : "text-[#EF4444]"}`}>{aiData.simplifiedRisk.level}</div>
                                  <div className="text-[10px] font-mono text-[#8B8B8B]">Derived from Live Flow</div>
                                </div>
                              )}
                            </div>

                            {/* Risk Overview */}
                            {riskData.overview && (
                              <div className="bg-[#111111] border-l-2 border-[#FACC15] pl-4 py-3">
                                <p className="text-sm text-[#EAEAEA] leading-relaxed">{riskData.overview}</p>
                              </div>
                            )}

                            {/* Trap Detection */}
                            {aiData?.trapDetection?.detected && (
                              <div className={`bg-[#111111] border rounded-lg p-5 ${aiData.trapDetection.type === "bear_trap" ? "border-[#4ADE80]/30" : "border-[#EF4444]/30"}`}>
                                <div className="flex items-start gap-3">
                                  <AlertTriangle className={`w-4 h-4 shrink-0 mt-0.5 ${aiData.trapDetection.type === "bear_trap" ? "text-[#4ADE80]" : "text-[#EF4444]"}`} />
                                  <div>
                                    <div className="text-xs font-mono font-bold text-[#EAEAEA] uppercase mb-2 flex items-center gap-2">
                                      {aiData.trapDetection.title}
                                      <span className={`text-[9px] px-1.5 py-0.5 rounded border ${aiData.trapDetection.confidence === "Tinggi" ? "border-[#EF4444]/30 text-[#EF4444] bg-[#EF4444]/5" : "border-[#FACC15]/30 text-[#FACC15] bg-[#FACC15]/5"}`}>CONF: {aiData.trapDetection.confidence}</span>
                                    </div>
                                    <p className="text-xs text-[#8B8B8B] leading-relaxed">{aiData.trapDetection.explanation}</p>
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* Primary Risks Table */}
                            {riskData.primaryRisks?.length > 0 && (
                              <div className="bg-[#111111] border border-[#1F1F1F] rounded-lg overflow-hidden">
                                <div className="p-4 bg-[#1A1A1A] border-b border-[#1F1F1F]">
                                  <h4 className="text-[10px] font-mono font-bold text-[#8B8B8B] uppercase tracking-widest">Primary Risk Factors</h4>
                                </div>
                                <div className="divide-y divide-[#1F1F1F]">
                                  {riskData.primaryRisks.map((risk: any, idx: number) => (
                                    <div key={idx} className="p-4 hover:bg-[#1A1A1A] transition-colors" data-testid={`row-risk-${idx}`}>
                                      <div className="flex items-center justify-between mb-2">
                                        <span className="text-xs font-mono font-bold text-[#EAEAEA]">{risk.title}</span>
                                        <div className="flex items-center gap-2">
                                          <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border ${risk.likelihood === "Tinggi" ? "border-[#EF4444]/30 text-[#EF4444] bg-[#EF4444]/5" : risk.likelihood === "Sedang" ? "border-[#FACC15]/30 text-[#FACC15] bg-[#FACC15]/5" : "border-[#8B8B8B]/30 text-[#8B8B8B]"}`}>PROB: {risk.likelihood}</span>
                                          <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border ${risk.impact === "Sangat Tinggi" || risk.impact === "Tinggi" ? "border-[#EF4444]/30 text-[#EF4444] bg-[#EF4444]/5" : "border-[#FACC15]/30 text-[#FACC15] bg-[#FACC15]/5"}`}>IMPACT: {risk.impact}</span>
                                        </div>
                                      </div>
                                      <p className="text-xs text-[#8B8B8B] leading-relaxed">{risk.why}</p>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Contrarian Risks */}
                            {riskData.contrarianRisks?.length > 0 && (
                              <div className="bg-[#111111] border border-[#1F1F1F] rounded-lg overflow-hidden">
                                <div className="p-4 bg-[#1A1A1A] border-b border-[#1F1F1F]">
                                  <h4 className="text-[10px] font-mono font-bold text-[#8B8B8B] uppercase tracking-widest">Contrarian Risk Scenarios</h4>
                                </div>
                                <div className="divide-y divide-[#1F1F1F]">
                                  {riskData.contrarianRisks.map((risk: any, idx: number) => (
                                    <div key={idx} className="p-4 hover:bg-[#1A1A1A] transition-colors">
                                      <div className="text-xs font-mono font-bold text-[#EAEAEA] mb-2">{risk.title}</div>
                                      <div className="space-y-1 text-xs text-[#8B8B8B]">
                                        <p>{risk.why}</p>
                                        {risk.material && <p className="text-[#FACC15]">Catalyst: {risk.material}</p>}
                                        {risk.affected && <p>Affects: {risk.affected}</p>}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Invalidation Triggers */}
                            {riskData.invalidation?.length > 0 && (
                              <div className="bg-[#111111] border border-[#EF4444]/20 rounded-lg overflow-hidden">
                                <div className="p-4 bg-[#EF4444]/5 border-b border-[#EF4444]/20">
                                  <h4 className="text-[10px] font-mono font-bold text-[#EF4444] uppercase tracking-widest">Thesis Invalidation Triggers</h4>
                                </div>
                                <div className="p-4 space-y-2">
                                  {riskData.invalidation.map((trigger: string, idx: number) => (
                                    <div key={idx} className="flex items-start gap-3 text-xs font-mono text-[#EAEAEA]">
                                      <span className="text-[#EF4444] shrink-0 mt-0.5">✕</span>
                                      <span>{trigger}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* AI Simplified Risk */}
                            {aiData?.simplifiedRisk && (
                              <div className="bg-[#111111] border border-[#1F1F1F] rounded-lg overflow-hidden">
                                <div className="p-4 bg-[#1A1A1A] border-b border-[#1F1F1F]">
                                  <h4 className="text-[10px] font-mono font-bold text-[#8B8B8B] uppercase tracking-widest">Live Risk Assessment</h4>
                                </div>
                                <div className="p-5 space-y-4">
                                  <p className="text-sm text-[#EAEAEA] leading-relaxed">{aiData.simplifiedRisk.explanation}</p>
                                  {aiData.simplifiedRisk.failureTriggers?.length > 0 && (
                                    <div className="space-y-1.5 pt-2 border-t border-[#1F1F1F]">
                                      <div className="text-[10px] font-mono font-bold text-[#8B8B8B] uppercase tracking-widest mb-2">Live Failure Triggers</div>
                                      {aiData.simplifiedRisk.failureTriggers.map((t: string, i: number) => (
                                        <div key={i} className="flex items-start gap-2 text-xs text-[#8B8B8B]">
                                          <span className="text-[#FACC15] shrink-0">→</span><span>{t}</span>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}

                            {/* Risk Analyst View */}
                            {stock.riskAnalystView && (
                              <div className="bg-[#111111] border-l-2 border-[#EF4444]/40 pl-4 py-3">
                                <p className="text-xs text-[#8B8B8B] leading-relaxed italic">{stock.riskAnalystView}</p>
                              </div>
                            )}
                          </div>
                        );
                      } catch (e) {
                        return (
                          <div className="space-y-6">
                            {/* Fallback to AI risk data only */}
                            {aiData?.simplifiedRisk && (
                              <div className="bg-[#111111] border border-[#1F1F1F] rounded-lg p-6 space-y-4">
                                <h4 className="text-[10px] font-mono font-bold text-[#8B8B8B] uppercase tracking-widest">Live Risk Assessment</h4>
                                <div className={`text-3xl font-mono font-bold ${aiData.simplifiedRisk.level === "Rendah" ? "text-[#4ADE80]" : aiData.simplifiedRisk.level === "Sedang" ? "text-[#FACC15]" : "text-[#EF4444]"}`}>{aiData.simplifiedRisk.level}</div>
                                <p className="text-sm text-[#EAEAEA] leading-relaxed">{aiData.simplifiedRisk.explanation}</p>
                              </div>
                            )}
                            {!aiData?.simplifiedRisk && (
                              <div className="bg-[#111111] border border-[#1F1F1F] rounded-lg p-10 text-center font-mono text-xs text-[#8B8B8B] uppercase tracking-widest">
                                Risk Audit Data Not Available
                              </div>
                            )}
                          </div>
                        );
                      }
                    })()}
                  </TabsContent>

                  {/* ── NEWS TAB ──────────────────────────────────── */}
                  <TabsContent value="news" className="mt-0 focus-visible:outline-none space-y-6">
                    {!aiLoading && aiData?.smartNewsFilter?.news && (
                      <div className="bg-[#111111] border border-[#1F1F1F] rounded-lg overflow-hidden">
                        <div className="p-4 bg-[#1A1A1A] border-b border-[#1F1F1F] flex items-center justify-between">
                          <h4 className="text-[10px] font-mono font-bold text-[#8B8B8B] uppercase tracking-widest">Sentiment Intelligence</h4>
                          {aiData.smartNewsFilter.summary && (
                            <span className="text-[10px] font-mono text-[#8B8B8B]">{aiData.smartNewsFilter.summary.summaryText}</span>
                          )}
                        </div>
                        <div className="p-6 space-y-6">
                          {aiData.smartNewsFilter.news.map((news: any, idx: number) => (
                            <div key={idx} className="flex gap-4 items-start group">
                              <div className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${
                                news.category === 'fundamental' ? 'bg-[#4ADE80]' :
                                news.category === 'sentiment' ? 'bg-[#FACC15]' : 'bg-[#8B8B8B]'
                              }`} />
                              <div className="space-y-1 flex-1">
                                <h5 className="text-sm font-bold text-[#EAEAEA] group-hover:text-[#4ADE80] transition-colors">{news.headline}</h5>
                                <p className="text-xs text-[#8B8B8B] leading-relaxed line-clamp-2">{news.aiInterpretation}</p>
                                <div className="flex items-center gap-3 pt-1 text-[9px] font-mono text-[#8B8B8B] uppercase flex-wrap">
                                  <span className="bg-[#1F1F1F] px-1.5 py-0.5 rounded text-[#EAEAEA]">{news.categoryLabel}</span>
                                  <span>{news.source} • {news.date}</span>
                                  {news.contextTag && <span className="text-[#FACC15]">{news.contextTag}</span>}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </TabsContent>
                </div>
             </Tabs>
          </div>
        </main>

        {/* RIGHT PANEL: MARKET INTELLIGENCE */}
        <aside className="hidden xl:flex flex-col w-80 bg-[#111111] border-l border-[#1F1F1F] overflow-y-auto custom-scrollbar shrink-0">
          <div className="p-3 bg-[#1A1A1A] border-b border-[#1F1F1F]">
            <h3 className="text-[10px] font-mono font-bold text-[#8B8B8B] uppercase tracking-widest flex items-center gap-2">
              <PieChart className="w-3 h-3 text-blue-400" />
              Market Intelligence
            </h3>
          </div>

          <div className="p-4 space-y-8">
            {/* ACTION GUIDANCE HERO - TERMINAL REFORMATTED */}
            {!aiLoading && aiData?.actionGuidance && (
              <div className="space-y-4" data-testid="card-action-guidance">
                 <div className="flex items-center gap-2">
                    <Target className="w-4 h-4 text-[#4ADE80]" />
                    <h4 className="text-[10px] font-mono font-bold text-[#8B8B8B] uppercase tracking-widest">Recommended Action</h4>
                 </div>
                 
                 <div className={`p-4 rounded border-2 ${
                    aiData.actionGuidance.statusColor === "green" ? "border-[#4ADE80]/30 bg-[#4ADE80]/5" :
                    aiData.actionGuidance.statusColor === "red" ? "border-[#EF4444]/30 bg-[#EF4444]/5" :
                    "border-[#FACC15]/30 bg-[#FACC15]/5"
                 }`}>
                    <div className="flex items-center gap-2 mb-2">
                       <span className={`w-2 h-2 rounded-full ${
                          aiData.actionGuidance.statusColor === "green" ? "bg-[#4ADE80]" :
                          aiData.actionGuidance.statusColor === "red" ? "bg-[#EF4444]" : "bg-[#FACC15]"
                       }`} />
                       <span className={`text-xs font-mono font-bold uppercase ${
                          aiData.actionGuidance.statusColor === "green" ? "text-[#4ADE80]" :
                          aiData.actionGuidance.statusColor === "red" ? "text-[#EF4444]" : "text-[#FACC15]"
                       }`} data-testid="badge-combined-status">
                          {aiData.actionGuidance.statusLabel}
                       </span>
                    </div>
                    
                    <div className="text-xl font-mono font-bold text-[#EAEAEA] mb-3 leading-tight" data-testid="text-primary-action">
                       {aiData.actionGuidance.primaryActionLabel}
                    </div>
                    
                    <p className="text-[11px] text-[#8B8B8B] leading-relaxed mb-4 italic" data-testid="text-action-summary">
                       {aiData.actionGuidance.shortSummary}
                    </p>
                    
                    <div className="flex items-center justify-between text-[10px] font-mono">
                       <span className="text-[#8B8B8B] uppercase">Confidence</span>
                       <span className={`font-bold px-1.5 py-0.5 rounded ${
                          aiData.actionGuidance.confidence === "Tinggi" ? "bg-[#4ADE80]/20 text-[#4ADE80]" : "bg-[#FACC15]/20 text-[#FACC15]"
                       }`} data-testid="badge-confidence">
                          {aiData.actionGuidance.confidence.toUpperCase()}
                       </span>
                    </div>
                 </div>
              </div>
            )}

            <Separator className="bg-[#1F1F1F]" />

            {/* CONVICTION TIMELINE */}
            <div data-testid="section-conviction-timeline">
               {aiData?.convictionPhase && (
                 <ConvictionTimeline 
                   phase={aiData.convictionPhase.phase} 
                   explanation={aiData.convictionPhase.explanation} 
                 />
               )}
            </div>

            <Separator className="bg-[#1F1F1F]" />

            {/* TRAP DETECTION */}
            {aiData?.trapDetection && (
              <div className="space-y-4" data-testid="section-trap-detection">
                 <div className="flex items-center gap-2">
                    <AlertOctagon className="w-4 h-4 text-[#EF4444]" />
                    <h4 className="text-[10px] font-mono font-bold text-[#8B8B8B] uppercase tracking-widest">Trap Detection</h4>
                 </div>
                 <div className={`p-3 rounded border font-mono text-[11px] ${
                    aiData.trapDetection.isTrap ? "border-[#EF4444]/30 bg-[#EF4444]/5 text-[#EF4444]" : "border-[#4ADE80]/30 bg-[#4ADE80]/5 text-[#4ADE80]"
                 }`}>
                    {aiData.trapDetection.isTrap ? (
                      <div className="space-y-2">
                        <div className="font-bold uppercase tracking-tighter">TRAP DETECTED</div>
                        <p className="text-[10px] leading-relaxed text-[#8B8B8B] italic">{aiData.trapDetection.trapType}: {aiData.trapDetection.reasoning}</p>
                      </div>
                    ) : (
                      <div className="font-bold uppercase tracking-tighter">NO TRAPS DETECTED</div>
                    )}
                 </div>
              </div>
            )}
            
            <div className="pt-4 mt-auto">
               <div className="p-3 border border-[#1F1F1F] bg-[#0B0B0B] rounded">
                  <p className="text-[9px] font-mono text-[#8B8B8B] leading-tight uppercase text-center">
                    Confidential Intelligence • BART Terminal v2.0
                  </p>
               </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
