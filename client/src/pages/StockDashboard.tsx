import { useEffect, useState, useMemo } from "react";
import { useParams } from "wouter";
import { useStock } from "@/hooks/use-stocks";
import { StatusCard } from "@/components/StatusCard";
import { LayerBreakdown } from "@/components/LayerBreakdown";
import { ScoreRing as ScoreRingV3 } from "@/components/v3/ScoreRing";
import { BODMemberCard } from "@/components/v3/BODMemberCard";
import { NewsArticleCard } from "@/components/v3/NewsArticleCard";

const mono = "'JetBrains Mono', 'IBM Plex Mono', monospace";
const sora = "'Inter', system-ui, sans-serif";
const inter = "'Inter', system-ui, sans-serif";
import { Users, Sparkles, Shield, Target, Activity, AlertOctagon, Lightbulb, Gauge, ChevronDown, ChevronUp, EyeOff, Eye, HelpCircle, BarChart3, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

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
  UserCheck,
  GitMerge,
  ArrowRight
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
  const [showShortcuts, setShowShortcuts] = useState(false);
  const { data: stock, isLoading, error } = useStock(symbol);
  const [aiData, setAIData] = useState<any>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [sessionStatus, setSessionStatus] = useState(getIDXSessionStatus());
  const [valuationData, setValuationData] = useState<any>(null);
  const [distWarning, setDistWarning] = useState<any>(null);
  const [newsData, setNewsData] = useState<any>(null);
  const [managementData, setManagementData] = useState<any>(null);
  const [insiderData, setInsiderData] = useState<any>(null);

  const TAB_IDS = ["overview", "flow", "financials", "news", "risk", "insider", "valuation"] as const;

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key;
      if (k === "?") { setShowShortcuts(s => !s); return; }
      if (k === "Escape") { setShowShortcuts(false); return; }
      if (k === "r") { setActiveTab("overview"); return; }
      if (k === "f") { setActiveTab("flow"); return; }
      if (k === "n") { setActiveTab("news"); return; }
      if (k === "d") { setActiveTab("risk"); return; }
      if (k === "j") {
        setActiveTab(cur => {
          const i = TAB_IDS.indexOf(cur as any);
          return TAB_IDS[Math.min(i + 1, TAB_IDS.length - 1)];
        });
        return;
      }
      if (k === "k") {
        setActiveTab(cur => {
          const i = TAB_IDS.indexOf(cur as any);
          return TAB_IDS[Math.max(i - 1, 0)];
        });
        return;
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!symbol) return;
    let cancelled = false;
    fetch(`/api/distribution/${symbol}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (cancelled) return;
        const validLevels = ['AMAN', 'PANTAU_DISTRIBUSI', 'WASPADA_DISTRIBUSI', 'BAHAYA_DISTRIBUSI'];
        if (data && validLevels.includes(data.alertLevel)) {
          setDistWarning(data);
        } else {
          setDistWarning(null);
        }
      })
      .catch(() => { if (!cancelled) setDistWarning(null); });
    return () => { cancelled = true; };
  }, [symbol]);

  const decisionV2 = useMemo(() => {
    if (!aiData?.actionGuidance) return null;
    const label = aiData.actionGuidance.combinedStatus || 'NETRAL';
    const brokerScore = aiData.brokerControlScore?.score ?? 0;
    const flowQuality = aiData.flowQualityScore ?? 50;
    let concentrationType: 'KENDALI_BANDAR' | 'JEBAKAN_DISTRIBUSI' | 'TERSEBAR' = 'TERSEBAR';
    if (brokerScore >= 40 && flowQuality < 35) concentrationType = 'JEBAKAN_DISTRIBUSI';
    else if (brokerScore >= 40) concentrationType = 'KENDALI_BANDAR';
    const phase = aiData.convictionPhase || '';
    let cyclePosition: string | null = null;
    if (phase === 'Penempatan' || phase === 'Positioning') cyclePosition = 'TERLALU_DINI';
    else if (phase === 'Konfirmasi' || phase === 'Confirmation') cyclePosition = 'KONFIRMASI_MULAI';
    else if (phase === 'Kepadatan' || phase === 'Density') cyclePosition = 'ENTRY_WINDOW';
    else if (phase === 'Distribusi' || phase === 'Distribution') cyclePosition = 'WASPADAI_DISTRIBUSI';
    const campaignActive = cyclePosition === 'KONFIRMASI_MULAI' || cyclePosition === 'ENTRY_WINDOW' || cyclePosition === 'WASPADAI_DISTRIBUSI';
    const flowStrong = flowQuality >= 65;
    const priceResponding = aiData.controlQualityScore?.score >= 65;
    const rollingStrong = aiData.brokerStabilityScore?.score >= 65;
    const criteriaMetCount = [campaignActive, flowStrong, priceResponding, rollingStrong].filter(Boolean).length;
    return {
      label,
      cyclePosition,
      concentrationType,
      confirmation: {
        met: criteriaMetCount >= 2,
        criteriaMetCount,
        details: { campaignActive, flowStrong, priceResponding, rollingStrong },
      },
    };
  }, [aiData]);

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

  useEffect(() => {
    if (!stock) return;
    fetch(`/api/valuation/${stock.symbol}`)
      .then(r => { if (!r.ok) throw new Error('Valuation fetch failed'); return r.json(); })
      .then(data => { if (data.error) throw new Error(data.error); setValuationData(data); })
      .catch(err => { console.error(err); setValuationData(null); });
  }, [stock]);

  useEffect(() => {
    if (!stock) return;
    fetch(`/api/news/${stock.symbol}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data && Array.isArray(data.impacts)) setNewsData(data); })
      .catch(() => {});
  }, [stock]);

  useEffect(() => {
    if (!stock) return;
    fetch(`/api/management/${stock.symbol}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data && typeof data.compositeScore === 'number') setManagementData(data); })
      .catch(() => {});
  }, [stock]);

  useEffect(() => {
    if (!stock) return;
    fetch(`/api/insider/${stock.symbol}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data && (data.signal || data.score !== undefined)) setInsiderData(data); })
      .catch(() => {});
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

  const decision = aiData?.actionGuidance?.combinedStatus ?? 'NETRAL';
  const readinessScore = aiData?.smartMoneyReadinessScore?.score ?? 0;
  const mainReasons: string[] = aiData?.decisionEngine?.reasons ?? [];
  const mainRisk: string = aiData?.decisionEngine?.primaryRisk ?? '';
  const traderProfile: string = (aiData?.decisionEngine?.investorFit ?? '')
    .replace(/Investor defensif/gi, "Trader konservatif")
    .replace(/Investor menengah/gi, "Trader aktif");
  const statusLabel: string = aiData?.smartMoneyReadinessScore?.statusLabel ?? '';
  const aiConfidence: number = aiData?.actionGuidance?.confidence === 'Tinggi' ? 85 : aiData?.actionGuidance?.confidence === 'Sedang' ? 60 : 35;
  const bandarmologyScore: number | null = aiData?.brokerControlScore?.score ?? null;
  const managementScore: number | null = managementData?.compositeScore != null ? Math.min(100, Math.round(managementData.compositeScore * 20)) : null;
  const fundamentalScore: number | null = (() => {
    const roe = parseFloat(stock.roe); const nm = parseFloat(stock.netMargin); const gr = parseFloat(stock.growth);
    if (isNaN(roe) && isNaN(nm) && isNaN(gr)) return null;
    const roeS = Math.min(100, Math.max(0, roe * 3));
    const nmS  = Math.min(100, Math.max(0, nm * 4));
    const grS  = Math.min(100, Math.max(0, 50 + gr));
    return Math.round((roeS + nmS + grS) / 3);
  })();
  const valuationScore: number | null = valuationData?.fairValueScore ?? null;
  const newsScore: number | null = newsData?.impacts?.length > 0 ? (newsData.impacts.filter((n: any) => n.direction === 'POSITIF').length / newsData.impacts.length) * 100 : null;
  const newsOverride = newsData?.impacts?.some((n: any) => n.macroOverride === 'true' || n.macroOverride === true) ?? false;
  const managementRedFlag = managementData?.hasCriticalRedFlag === 'true';

  return (
    <div className="min-h-screen" style={{ background: "#060606", paddingBottom: 80 }}>

      {/* SECTION A — Sticky Ticker Bar */}
      <div
        style={{
          position: "sticky", top: 0, zIndex: 40,
          background: "#0a0a0a", borderBottom: "1px solid rgba(255,255,255,0.06)",
          height: 56, padding: "0 24px",
          display: "flex", alignItems: "center", gap: 16,
        }}
      >
        {/* Logo */}
        <div
          className="flex-shrink-0 rounded-md flex items-center justify-center overflow-hidden"
          style={{ width: 32, height: 32, background: "#0f0f0f", border: "1px solid rgba(255,255,255,0.06)" }}
        >
          <img
            src={`https://assets.stockbit.com/logos/companies/${stock.symbol}.png`}
            alt={stock.symbol}
            className="w-6 h-6 object-contain"
            onError={(e) => {
              const el = e.currentTarget;
              el.style.display = "none";
              const parent = el.parentElement;
              if (parent) {
                const span = document.createElement("span");
                span.textContent = stock.symbol.slice(0, 2);
                span.style.cssText = `font-family:${mono};font-size:10px;font-weight:700;color:#38BDF8`;
                parent.appendChild(span);
              }
            }}
          />
        </div>

        {/* Symbol · Name · Sector */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          <span style={{ fontFamily: mono, fontSize: 15, fontWeight: 700, color: "#F4F4F5" }}>
            {stock.symbol}
          </span>
          <span style={{ color: "rgba(255,255,255,0.12)" }}>·</span>
          <span style={{ fontFamily: inter, fontSize: 13, color: "#71717A" }}>
            {stock.name}
          </span>
          {stock.sector && (
            <span style={{
              fontFamily: mono, fontSize: 8, letterSpacing: "0.12em",
              textTransform: "uppercase" as const, color: "#4FC3F7",
              background: "rgba(56,189,248,0.08)", border: "1px solid rgba(56,189,248,0.15)",
              borderRadius: 4, padding: "2px 7px",
            }}>
              {stock.sector}
            </span>
          )}
        </div>

        {/* Price + change + session — right-aligned */}
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 20 }}>
          <div style={{ textAlign: "right" }}>
            <p style={{ fontFamily: mono, fontSize: 16, fontWeight: 700, color: "#F4F4F5", lineHeight: 1 }}>
              Rp {parseFloat(String(stock.price).replace(/[^0-9.-]/g, "") || "0").toLocaleString("id-ID")}
            </p>
            <p style={{
              fontFamily: mono, fontSize: 11, marginTop: 3,
              color: parseFloat(stock.changePercent) > 0 ? "#4ADE80" : parseFloat(stock.changePercent) < 0 ? "#F87171" : "#71717A",
            }}>
              {parseFloat(stock.changePercent) > 0
                ? `▲ +${parseFloat(stock.changePercent).toFixed(2)}%`
                : parseFloat(stock.changePercent) < 0
                  ? `▼ ${parseFloat(stock.changePercent).toFixed(2)}%`
                  : `— 0.00%`}
            </p>
          </div>

          {/* Divider */}
          <div style={{ width: 1, height: 24, background: "rgba(255,255,255,0.06)" }} />

          {/* Session badge */}
          <div style={{ textAlign: "right" }} data-testid="badge-session-status">
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <div style={{
                width: 6, height: 6, borderRadius: "50%",
                background: sessionStatus.color === "green" ? "#4ADE80" : sessionStatus.color === "yellow" ? "#FBBF24" : "#F87171",
                boxShadow: sessionStatus.color === "green" ? "0 0 6px rgba(16,185,129,0.6)" : "none",
              }} />
              <span style={{
                fontFamily: mono, fontSize: 10,
                color: sessionStatus.color === "green" ? "#4ADE80" : sessionStatus.color === "yellow" ? "#FBBF24" : "#F87171",
              }}>
                {sessionStatus.label}
              </span>
            </div>
            <p style={{ fontFamily: mono, fontSize: 8, color: "#3F3F46", marginTop: 2, letterSpacing: "0.06em" }}>
              SESI IDX
            </p>
          </div>
        </div>
      </div>

      <main style={{ maxWidth: 1200, margin: "0 auto", padding: "24px 24px 0" }}>
        <motion.div
          initial="hidden"
          animate="visible"
          variants={containerVariants}
          className="space-y-5"
        >

          {/* CHART — Hero, top of analysis area */}
          <motion.div variants={itemVariants}>
            <div style={{ borderRadius: 10, overflow: "hidden", border: "1px solid rgba(255,255,255,0.06)" }}>
              <PriceChart />
            </div>
          </motion.div>

          {/* SCORE BLOCK — primary decision artifact, below chart */}
          <motion.div variants={itemVariants}>
            {aiLoading ? (
              <div style={{ height: 160, background: "#0a0a0a", borderRadius: 10, border: "1px solid rgba(255,255,255,0.06)" }}
                className="animate-pulse" />
            ) : (
              <StatusCard
                score={readinessScore}
                decision={decision}
                statusLabel={statusLabel}
                symbol={symbol}
                confidence={aiConfidence}
                layerCount={[bandarmologyScore, newsScore, fundamentalScore, managementScore, valuationScore].filter(s => s !== null).length}
                newsOverride={newsOverride}
                managementRedFlag={managementRedFlag}
                onAnalysisClick={() => {
                  document.getElementById("section-intelligence")?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
              />
            )}
          </motion.div>


          {/* TABS — Analysis sections below score */}
          <motion.div variants={itemVariants} className="space-y-4">

            <Tabs defaultValue="overview" value={activeTab} onValueChange={setActiveTab} className="w-full">
              <div style={{ marginBottom: 16, borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                <TabsList
                  className="w-full justify-start h-auto overflow-x-auto no-scrollbar p-0"
                  style={{ background: "transparent", gap: 0, borderRadius: 0 }}
                >
                  {[
                    { id: "overview",   label: "Ringkasan" },
                    { id: "flow",       label: "Flow Broker", demoData: (stock as any)?.scrapeSource === 'MANUAL_SEED' },
                    { id: "financials", label: "Keuangan" },
                    { id: "news",       label: "Berita" },
                    { id: "risk",       label: "Distribusi" },
                    { id: "insider",    label: "Manajemen" },
                    { id: "valuation",  label: "Valuasi" },
                  ].map((tab) => (
                    <TabsTrigger
                      key={tab.id}
                      value={tab.id}
                      className="px-4 py-2.5 transition-all rounded-none border-b-2"
                      style={{
                        fontFamily: mono, fontSize: 11, letterSpacing: "0.04em",
                        borderBottom: activeTab === tab.id ? "2px solid #4FC3F7" : "2px solid transparent",
                        color: activeTab === tab.id ? "#4FC3F7" : "#71717A",
                        background: "transparent",
                      }}
                      data-state={activeTab === tab.id ? "active" : "inactive"}
                    >
                      {tab.label}
                      {(tab as any).demoData && (
                        <span style={{
                          marginLeft: 5, fontSize: 8, fontWeight: 700, padding: "1px 4px",
                          background: "#78350f", color: "#fbbf24", borderRadius: 2,
                          letterSpacing: "0.06em", verticalAlign: "middle",
                        }}>DEMO</span>
                      )}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </div>
                
                <div className="mt-4">
                  <TabsContent value="overview" className="mt-0 focus-visible:outline-none space-y-5">
                    {/* ── Intelligence Grid ── */}
                    {!aiLoading && (
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                        {/* Card 1: RINGKASAN */}
                        <div style={{
                          background: "#080808", border: "1px solid rgba(255,255,255,0.04)",
                          borderRadius: 10, padding: "18px 20px",
                        }}>
                          <p style={{ fontFamily: mono, fontSize: 9, letterSpacing: "0.2em", color: "#3F3F46", textTransform: "uppercase", marginBottom: 14 }}>
                            RINGKASAN
                          </p>
                          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                            {(mainReasons.length > 0 ? mainReasons.slice(0, 3) : ["Memuat analisis..."]).map((r, i) => (
                              <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                                <span style={{ fontFamily: mono, fontSize: 11, color: "#4ADE80", flexShrink: 0, lineHeight: "18px" }}>+</span>
                                <span style={{ fontFamily: inter, fontSize: 12, color: "#A1A1AA", lineHeight: 1.55 }}>{r}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                        {/* Card 2: ALIRAN INSTITUSI */}
                        <div style={{
                          background: "#080808", border: "1px solid rgba(255,255,255,0.04)",
                          borderRadius: 10, padding: "18px 20px",
                        }}>
                          <p style={{ fontFamily: mono, fontSize: 9, letterSpacing: "0.2em", color: "#3F3F46", textTransform: "uppercase", marginBottom: 14 }}>
                            ALIRAN INSTITUSI
                          </p>
                          {bandarmologyScore !== null ? (
                            <>
                              <p style={{
                                fontFamily: mono, fontSize: 26, fontWeight: 700,
                                color: bandarmologyScore >= 70 ? "#4ADE80" : bandarmologyScore >= 50 ? "#4FC3F7" : bandarmologyScore >= 40 ? "#FBBF24" : "#F87171",
                                lineHeight: 1, marginBottom: 6,
                              }}>
                                {bandarmologyScore >= 70 ? "+" : bandarmologyScore < 40 ? "−" : "~"}{bandarmologyScore}
                              </p>
                              <p style={{ fontFamily: mono, fontSize: 10, color: "#71717A", marginBottom: 14 }}>
                                Skor bandarmologi agregat
                              </p>
                              <div style={{ height: 1, background: "rgba(255,255,255,0.04)", marginBottom: 12 }} />
                              <p style={{ fontFamily: mono, fontSize: 10, color: "#71717A" }}>
                                Skor M6: {bandarmologyScore} · Tren: {
                                  aiData?.brokerStabilityScore?.score >= 65 ? "naik" :
                                  aiData?.brokerStabilityScore?.score >= 40 ? "stabil" : "turun"
                                }
                              </p>
                            </>
                          ) : (
                            <p style={{ fontFamily: mono, fontSize: 11, color: "#3F3F46" }}>Memuat...</p>
                          )}
                        </div>
                        {/* Card 3: KONTEKS MAKRO */}
                        <div style={{
                          background: "#080808", border: "1px solid rgba(255,255,255,0.04)",
                          borderRadius: 10, padding: "18px 20px",
                        }}>
                          <p style={{ fontFamily: mono, fontSize: 9, letterSpacing: "0.2em", color: "#3F3F46", textTransform: "uppercase", marginBottom: 14 }}>
                            KONTEKS MAKRO
                          </p>
                          {newsOverride ? (
                            <p style={{ fontFamily: mono, fontSize: 13, fontWeight: 600, color: "#F87171", marginBottom: 6 }}>
                              ⚠ Override aktif
                            </p>
                          ) : (
                            <p style={{ fontFamily: mono, fontSize: 13, fontWeight: 600, color: "#F4F4F5", marginBottom: 6 }}>
                              Normal
                            </p>
                          )}
                          <div style={{ height: 1, background: "rgba(255,255,255,0.04)", margin: "10px 0" }} />
                          <p style={{ fontFamily: mono, fontSize: 10, color: "#71717A" }}>
                            {newsData?.impacts?.length > 0
                              ? `${newsData.impacts.length} berita relevan · `
                              : "Tidak ada berita · "}
                            {newsData?.impacts?.some((n: any) => n.direction === "POSITIF")
                              ? "sentimen positif"
                              : newsData?.impacts?.some((n: any) => n.direction === "NEGATIF")
                                ? "sentimen negatif"
                                : "sentimen netral"}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* ── Risk + Profil Trader ── */}
                    {!aiLoading && (mainRisk || traderProfile) && (
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                        <div style={{ background: "#0a0a0a", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 8, padding: "14px 16px" }}>
                          <p style={{ fontFamily: mono, fontSize: 9, letterSpacing: "0.15em", textTransform: "uppercase", color: "#3F3F46", marginBottom: 8 }}>
                            RISIKO UTAMA
                          </p>
                          <p style={{ fontFamily: inter, fontSize: 13, color: "#71717A", lineHeight: 1.55 }}>
                            {mainRisk || "—"}
                          </p>
                        </div>
                        <div style={{ background: "#0a0a0a", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 8, padding: "14px 16px" }}>
                          <p style={{ fontFamily: mono, fontSize: 9, letterSpacing: "0.15em", textTransform: "uppercase", color: "#3F3F46", marginBottom: 8 }}>
                            PROFIL TRADER
                          </p>
                          <p style={{ fontFamily: inter, fontSize: 13, color: "#71717A", lineHeight: 1.55 }}>
                            {traderProfile
                              ? traderProfile.replace(/Investor defensif/gi, "Trader konservatif").replace(/Investor menengah/gi, "Trader aktif")
                              : "—"}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* ── Analisis 6 Layer ── */}
                    <LayerBreakdown
                      bandarmologyScore={bandarmologyScore}
                      newsScore={newsScore !== null ? Math.round(newsScore) : null}
                      fundamentalScore={fundamentalScore}
                      managementScore={managementScore}
                      valuationScore={valuationScore}
                      macroScore={null}
                      confidence={aiConfidence}
                      defaultCollapsed={true}
                    />

                    {/* AI Summary — only on Ringkasan tab */}
                    <AIStockSummary summary={stock.summary} confidence={stock.aiConfidence as "High" | "Medium" | "Low"} />

                    {/* ── Distribution warning (unique signal, shown only here) ── */}

                    {distWarning && distWarning.alertLevel !== 'AMAN' && (
                      <div
                        className={`rounded-md p-4 mb-4 border ${
                          distWarning.alertLevel === 'BAHAYA_DISTRIBUSI'
                            ? 'bg-red-500/5 border-red-500/30'
                            : distWarning.alertLevel === 'WASPADA_DISTRIBUSI'
                            ? 'bg-orange-500/5 border-orange-500/30'
                            : 'bg-amber-500/5 border-amber-500/20'
                        }`}
                        data-testid="card-distribution-warning"
                      >
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <AlertTriangle
                              className={`w-4 h-4 ${
                                distWarning.alertLevel === 'BAHAYA_DISTRIBUSI'
                                  ? 'text-red-400'
                                  : distWarning.alertLevel === 'WASPADA_DISTRIBUSI'
                                  ? 'text-orange-400'
                                  : 'text-amber-400'
                              }`}
                            />
                            <span className="font-mono text-[9px] tracking-widest text-[#6b7280] uppercase">
                              PERINGATAN DISTRIBUSI DINI
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span
                              className={`font-mono text-[9px] px-2 py-0.5 rounded-sm border ${
                                distWarning.alertLevel === 'BAHAYA_DISTRIBUSI'
                                  ? 'bg-red-500/10 text-red-400 border-red-500/30'
                                  : distWarning.alertLevel === 'WASPADA_DISTRIBUSI'
                                  ? 'bg-orange-500/10 text-orange-400 border-orange-500/30'
                                  : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                              }`}
                              data-testid="badge-distribution-conditions"
                            >
                              {distWarning.conditionsMet}/{distWarning.totalConditions} kondisi
                            </span>
                            <span className="font-mono text-[9px] text-[#6b7280]">
                              {distWarning.confidence}
                            </span>
                          </div>
                        </div>
                        <p
                          className={`text-sm font-bold mb-2 ${
                            distWarning.alertLevel === 'BAHAYA_DISTRIBUSI'
                              ? 'text-red-400'
                              : distWarning.alertLevel === 'WASPADA_DISTRIBUSI'
                              ? 'text-orange-400'
                              : 'text-amber-400'
                          }`}
                          data-testid="text-distribution-level"
                        >
                          {distWarning.alertLevel === 'BAHAYA_DISTRIBUSI' &&
                            'Bahaya — Sinyal Distribusi Terkonfirmasi'}
                          {distWarning.alertLevel === 'WASPADA_DISTRIBUSI' &&
                            'Waspada — Tanda Distribusi Mulai Terdeteksi'}
                          {distWarning.alertLevel === 'PANTAU_DISTRIBUSI' &&
                            'Pantau — Sinyal Awal Perlu Diperhatikan'}
                        </p>
                        <div className="space-y-1 mb-3">
                          {(distWarning.details ?? [])
                            .filter(
                              (d: string) =>
                                !d.startsWith('C3:') ||
                                distWarning.conditions?.c3_brokerSideSwitch !== null
                            )
                            .map((detail: string, i: number) => (
                              <p key={i} className="font-mono text-[10px] text-[#9ca3af]">
                                {detail}
                              </p>
                            ))}
                        </div>
                        <div className="bg-[#ffffff04] rounded-sm px-3 py-2 flex items-start gap-2">
                          <span className="text-[#38BDF8] text-xs mt-0.5">→</span>
                          <p
                            className="font-mono text-[10px] text-[#6b7280]"
                            data-testid="text-distribution-recommendation"
                          >
                            {distWarning.recommendation}
                          </p>
                        </div>
                      </div>
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
                          <Badge variant="outline" className={`text-xs ${
                            decisionV2?.concentrationType === 'JEBAKAN_DISTRIBUSI' ? 'border-red-500 text-red-400' :
                            decisionV2?.concentrationType === 'KENDALI_BANDAR'     ? 'border-emerald-500 text-emerald-400' :
                            'border-slate-500 text-slate-400'
                          }`} data-testid="badge-broker-control-level">
                            {decisionV2?.concentrationType === 'JEBAKAN_DISTRIBUSI' && 'Jebakan Distribusi'}
                            {decisionV2?.concentrationType === 'KENDALI_BANDAR'     && 'Kendali Bandar'}
                            {decisionV2?.concentrationType === 'TERSEBAR'           && 'Tersebar'}
                            {!decisionV2 && aiData.brokerControlScore.level}
                          </Badge>
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
                          <p className="text-xs font-bold text-foreground uppercase tracking-widest mb-2">Legenda Aliran Dana Broker</p>
                          <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                            <div className="flex items-center gap-1.5" data-testid="legend-akumulasi-kuat">
                              <div className="w-4 h-4 rounded bg-emerald-500" />
                              <span>Net Beli (Akumulasi)</span>
                            </div>
                            <div className="flex items-center gap-1.5" data-testid="legend-distribusi-dominan">
                              <div className="w-4 h-4 rounded bg-rose-500" />
                              <span>Net Jual (Distribusi)</span>
                            </div>
                          </div>
                        </div>
                        <div className="overflow-x-auto">
                          {aiData.bandarHeatmap.length > 0 ? (
                            <div className="space-y-2" data-testid="table-bandar-heatmap">
                              {aiData.bandarHeatmap.map((entry: any, idx: number) => {
                                const net = entry.net || 0;
                                const maxAbs = Math.max(...aiData.bandarHeatmap.map((e: any) => Math.abs(e.net || 0)), 1);
                                const barWidth = Math.min(100, (Math.abs(net) / maxAbs) * 100);
                                const isPositive = net >= 0;

                                return (
                                  <div key={idx} className="flex items-center gap-3 py-1.5 px-3 rounded-lg bg-muted/20" data-testid={`row-broker-${entry.broker}`}>
                                    <span className="font-mono font-semibold text-foreground text-xs w-12 shrink-0">{entry.broker}</span>
                                    <div className="flex-1 flex items-center gap-2">
                                      <div className="flex-1 h-5 bg-muted/30 rounded overflow-hidden relative">
                                        <div
                                          className={`h-full rounded ${isPositive ? "bg-emerald-500" : "bg-rose-500"}`}
                                          style={{ width: `${barWidth}%`, opacity: 0.7 + (barWidth / 100) * 0.3 }}
                                          data-testid={`heatmap-bar-${entry.broker}`}
                                        />
                                      </div>
                                      <span className={`text-xs font-mono font-semibold min-w-[80px] text-right ${isPositive ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                                        {isPositive ? "+" : ""}{(net / 1e9).toFixed(1)}B
                                      </span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <p className="text-xs text-muted-foreground text-center py-4">Data broker tidak tersedia</p>
                          )}
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
                        
                        {/* Current Phase Display */}
                        <div className="relative mb-6" data-testid="timeline-bar-container">
                          {aiData.phaseTimeline.map((item: any, index: number) => {
                            const phaseColors: Record<string, string> = {
                              "Stealth Accumulation": "bg-blue-500",
                              "Active Accumulation": "bg-emerald-500",
                              "Early Accumulation": "bg-teal-500",
                              "Active Distribution": "bg-rose-500",
                              "Distribution": "bg-amber-500",
                              "Sideways": "bg-slate-500"
                            };
                            const phaseLabels: Record<string, string> = {
                              "Stealth Accumulation": "Akumulasi Tersembunyi",
                              "Active Accumulation": "Akumulasi Aktif",
                              "Early Accumulation": "Akumulasi Awal",
                              "Active Distribution": "Distribusi Aktif",
                              "Distribution": "Distribusi",
                              "Sideways": "Sideways"
                            };
                            const bgColor = phaseColors[item.phase] || "bg-slate-400";
                            const label = phaseLabels[item.phase] || item.phase;

                            return (
                              <div key={index} className={`${bgColor} rounded-lg p-4 flex items-center justify-between`} data-testid={`phase-segment-${index}`}>
                                <div>
                                  <span className="text-sm font-bold text-white drop-shadow-sm" data-testid={`phase-label-${index}`}>
                                    {label}
                                  </span>
                                  <p className="text-xs text-white/70 mt-1">Fase saat ini berdasarkan analisis sinyal pasar</p>
                                </div>
                                {item.confidence && (
                                  <span className="text-xs font-semibold text-white/90 bg-white/20 px-2 py-1 rounded">
                                    Reliabilitas: {item.confidence}
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>

                        {/* Phase Legend */}
                        <div className="flex flex-wrap gap-3 mb-4 text-xs" data-testid="legend-timeline">
                          {(() => {
                            const phaseColors: Record<string, string> = {
                              "Stealth Accumulation": "bg-blue-500",
                              "Active Accumulation": "bg-emerald-500",
                              "Early Accumulation": "bg-teal-500",
                              "Active Distribution": "bg-rose-500",
                              "Distribution": "bg-amber-500",
                              "Sideways": "bg-slate-500"
                            };
                            const phaseLabels: Record<string, string> = {
                              "Stealth Accumulation": "Akumulasi Tersembunyi",
                              "Active Accumulation": "Akumulasi Aktif",
                              "Early Accumulation": "Akumulasi Awal",
                              "Active Distribution": "Distribusi Aktif",
                              "Distribution": "Distribusi",
                              "Sideways": "Sideways"
                            };
                            const phases = aiData.phaseTimeline.map((p: any) => p.phase);
                            const uniquePhases = Array.from(new Set(phases)) as string[];
                            return uniquePhases.map((phase: string) => (
                              <div key={phase} className="flex items-center gap-1.5" data-testid={`legend-phase-${phase.replace(/\s+/g, '-').toLowerCase()}`}>
                                <div className={`w-3 h-3 rounded ${phaseColors[phase] || 'bg-slate-400'}`} />
                                <span className="text-muted-foreground">{phaseLabels[phase] || phase}</span>
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
                    {/* WEB SEARCH ANALYSIS — shown only when AI enrichment is available */}
                    {aiData?.webSearchAnalysis && (
                      <Card className="p-5 border border-[#38BDF8]/20 bg-gradient-to-br from-[#0d1a2a] to-[#0a1520] shadow-sm" data-testid="card-web-search-analysis">
                        <div className="flex items-center gap-2 mb-3">
                          <Sparkles className="w-4 h-4 text-[#38BDF8]" />
                          <p className="text-xs font-bold text-[#38BDF8] uppercase tracking-widest" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
                            Analisis Live — Web Search
                          </p>
                          <span className="ml-auto text-[10px] text-[#6b7280] font-mono">claude-sonnet</span>
                        </div>
                        <p className="text-sm text-[#d1d5db] leading-relaxed whitespace-pre-wrap">
                          {aiData.webSearchAnalysis}
                        </p>
                      </Card>
                    )}

                    {/* MACRO OVERRIDE BANNER — shown when any impact has YES_HARD */}
                    {newsData?.impacts?.some((i: any) => i.macroOverride === 'YES_HARD') && (
                      <div className="bg-red-500/5 border border-red-500/20 rounded-md px-4 py-2 mb-3">
                        <p className="text-red-400 text-[10px] uppercase tracking-widest font-bold" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
                          ⚠ OVERRIDE MAKRO AKTIF — sinyal positif saham ini dikurangi signifikan oleh kondisi makro
                        </p>
                      </div>
                    )}

                    {/* SECTION 1: Analyzed News Impacts */}
                    {/* Analyzed impacts — filtered by symbol/sector only */}
                    {newsData?.impacts?.length > 0 ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                        {newsData.impacts.map((impact: any, idx: number) => (
                          <NewsArticleCard
                            key={`${impact.articleId}-${idx}`}
                            title={impact.mechanism ?? "Dampak berita"}
                            summary={impact.traderImplication}
                            source={impact.eventType ?? ""}
                            publishedAt={impact.analyzedAt}
                            direction={impact.direction}
                          />
                        ))}
                      </div>
                    ) : (
                      <div style={{
                        background: "#0a0a0a", border: "1px solid rgba(255,255,255,0.05)",
                        borderRadius: 8, padding: "32px 24px", textAlign: "center",
                      }}>
                        <p style={{ fontFamily: mono, fontSize: 11, color: "#3F3F46", marginBottom: 6 }}>
                          Tidak ada berita relevan untuk {symbol} dalam 30 hari terakhir.
                        </p>
                        <p style={{ fontFamily: mono, fontSize: 10, color: "#27272A" }}>
                          Pipeline berita aktif setiap 15 menit.
                        </p>
                      </div>
                    )}
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
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Info className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground cursor-help" data-testid="tooltip-failure-risk" />
                                  </TooltipTrigger>
                                  <TooltipContent side="top" className="max-w-xs text-center">
                                    <p>Analisis ini bisa tidak berlaku jika terjadi perubahan perilaku pelaku besar.</p>
                                  </TooltipContent>
                                </Tooltip>
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
                  <TabsContent value="insider" className="mt-0 focus-visible:outline-none space-y-5">
                    {managementData ? (
                      <>
                        {/* Critical red flag banner */}
                        {managementData.hasCriticalRedFlag && (
                          <div style={{
                            background: "rgba(248,113,113,0.07)", border: "1px solid rgba(248,113,113,0.25)",
                            borderRadius: 8, padding: "12px 16px",
                          }}>
                            <p style={{ fontFamily: mono, fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", color: "#F87171", marginBottom: 4, textTransform: "uppercase" }}>
                              ⛔ Bendera Merah Kritis Teridentifikasi
                            </p>
                            <p style={{ fontFamily: inter, fontSize: 12, color: "#FCA5A5", lineHeight: 1.55 }}>
                              {managementData.criticalRedFlagMember}: {managementData.criticalRedFlagReason}
                            </p>
                          </div>
                        )}

                        {/* Section 1: Composite score ring */}
                        <div style={{
                          background: "#0a0a0a", border: "1px solid rgba(255,255,255,0.06)",
                          borderRadius: 10, padding: "20px 24px",
                          display: "flex", alignItems: "center", gap: 28,
                        }}>
                          <ScoreRingV3 score={managementData.compositeScore} size={120} showLabel />
                          <div style={{ flex: 1 }}>
                            <p style={{ fontFamily: mono, fontSize: 9, letterSpacing: "0.2em", color: "#3F3F46", textTransform: "uppercase", marginBottom: 8 }}>
                              INTEGRITAS & REKAM JEJAK BOD
                            </p>
                            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                              <span style={{
                                fontFamily: mono, fontSize: 11, fontWeight: 700, letterSpacing: "0.08em",
                                color: managementData.qualityLabel === "KUAT" ? "#4ADE80" : managementData.qualityLabel === "LEMAH" ? "#F87171" : "#FBBF24",
                                background: managementData.qualityLabel === "KUAT" ? "rgba(74,222,128,0.10)" : managementData.qualityLabel === "LEMAH" ? "rgba(248,113,113,0.10)" : "rgba(251,191,36,0.10)",
                                border: managementData.qualityLabel === "KUAT" ? "1px solid rgba(74,222,128,0.25)" : managementData.qualityLabel === "LEMAH" ? "1px solid rgba(248,113,113,0.25)" : "1px solid rgba(251,191,36,0.25)",
                                borderRadius: 9999, padding: "3px 10px",
                              }}>
                                {managementData.qualityLabel}
                              </span>
                              <span style={{ fontFamily: mono, fontSize: 9, color: "#3F3F46" }}>
                                Reliabilitas: {managementData.reliability}
                              </span>
                            </div>
                            <p style={{ fontFamily: inter, fontSize: 12, color: "#71717A" }}>
                              {managementData.scoredMemberCount} anggota dinilai
                              {managementData.excludedMemberCount > 0 && ` · ${managementData.excludedMemberCount} dikecualikan`}
                            </p>
                          </div>
                        </div>

                        {/* Section 2: 5-component breakdown */}
                        <div style={{
                          background: "#0a0a0a", border: "1px solid rgba(255,255,255,0.05)",
                          borderRadius: 10, padding: "16px 20px",
                        }}>
                          <p style={{ fontFamily: mono, fontSize: 9, letterSpacing: "0.2em", color: "#3F3F46", textTransform: "uppercase", marginBottom: 14 }}>
                            BOBOT KOMPONEN
                          </p>
                          {[
                            { label: "Rekam Jejak",      weight: 30, score: managementData.memberScores?.length ? Math.round(managementData.memberScores.reduce((s: number, m: any) => s + (m.compositeScore ?? 0), 0) / managementData.memberScores.length) : null },
                            { label: "Tata Kelola",      weight: 25, score: null },
                            { label: "Alinemen Insider", weight: 20, score: null },
                            { label: "Stabilitas",       weight: 15, score: null },
                            { label: "Reputasi",         weight: 10, score: null },
                          ].map((comp) => {
                            const color = comp.score !== null ? (comp.score >= 70 ? "#4ADE80" : comp.score >= 50 ? "#4FC3F7" : comp.score >= 40 ? "#FBBF24" : "#F87171") : "rgba(255,255,255,0.06)";
                            return (
                              <div key={comp.label} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                                <div style={{ width: 120, flexShrink: 0 }}>
                                  <span style={{ fontFamily: mono, fontSize: 10, color: "#A1A1AA" }}>{comp.label}</span>
                                </div>
                                <span style={{ fontFamily: mono, fontSize: 8, color: "#27272A", background: "rgba(255,255,255,0.02)", borderRadius: 3, padding: "1px 5px", flexShrink: 0, width: 28, textAlign: "center" }}>
                                  {comp.weight}%
                                </span>
                                <div style={{ flex: 1, height: 2, background: "rgba(255,255,255,0.05)", borderRadius: 9999 }}>
                                  <div style={{ height: "100%", width: comp.score !== null ? `${comp.score}%` : "0%", background: color, borderRadius: 9999, transition: "width 0.7s" }} />
                                </div>
                                <div style={{ width: 28, textAlign: "right", fontFamily: mono, fontSize: 11, fontWeight: 600, color: comp.score !== null ? color : "#27272A" }}>
                                  {comp.score !== null ? comp.score : "—"}
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {/* Section 3: BOD member cards */}
                        {managementData.memberScores?.length > 0 && (
                          <div>
                            <p style={{ fontFamily: mono, fontSize: 9, letterSpacing: "0.14em", color: "#3F3F46", textTransform: "uppercase", marginBottom: 10 }}>
                              PROFIL ANGGOTA BOD
                            </p>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                              {managementData.memberScores.map((member: any, idx: number) => (
                                <BODMemberCard
                                  key={`${member.name}-${idx}`}
                                  name={member.name}
                                  title={member.title}
                                  compositeScore={member.compositeScore}
                                  keyInsight={member.keyInsight}
                                  hasCriticalRedFlag={member.hasCriticalRedFlag}
                                  reliability={member.reliability}
                                  excluded={member.excluded}
                                />
                              ))}
                            </div>
                          </div>
                        )}
                      </>
                    ) : (
                      /* Empty state — no research yet */
                      <div style={{
                        background: "#0a0a0a", border: "1px solid rgba(255,255,255,0.05)",
                        borderRadius: 10, padding: "40px 24px", textAlign: "center",
                      }}>
                        <p style={{ fontFamily: mono, fontSize: 11, color: "#3F3F46", marginBottom: 8 }}>
                          Riset manajemen belum tersedia untuk {symbol}.
                        </p>
                        <p style={{ fontFamily: inter, fontSize: 12, color: "#27272A", marginBottom: 20, lineHeight: 1.6 }}>
                          Riset BOD membutuhkan koneksi API. Klik untuk memicu riset baru.
                        </p>
                        <button
                          onClick={async () => {
                            try {
                              await fetch(`/api/management/${symbol}/research`, { method: "POST" });
                              const res = await fetch(`/api/management/${symbol}`);
                              const data = await res.json();
                              if (data && typeof data.compositeScore === "number") {
                                window.location.reload();
                              }
                            } catch {}
                          }}
                          style={{
                            fontFamily: mono, fontSize: 10, letterSpacing: "0.1em",
                            color: "#4FC3F7", background: "rgba(79,195,247,0.07)",
                            border: "1px solid rgba(79,195,247,0.2)",
                            borderRadius: 6, padding: "8px 16px", cursor: "pointer",
                          }}
                        >
                          PICU RISET MANAJEMEN →
                        </button>
                      </div>
                    )}

                    {/* Section 5: OJK Insider Activity (Layer 7) */}
                    <div style={{
                      background: "#0a0a0a", border: "1px solid rgba(255,255,255,0.06)",
                      borderRadius: 10, padding: "18px 20px",
                    }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                        <p style={{ fontFamily: mono, fontSize: 9, letterSpacing: "0.2em", color: "#3F3F46", textTransform: "uppercase" }}>
                          AKTIVITAS INSIDER (90 HARI)
                        </p>
                        {insiderData?.clusterBuySignal && (
                          <span style={{
                            fontFamily: mono, fontSize: 9, fontWeight: 700, letterSpacing: "0.08em",
                            color: "#4ADE80", background: "rgba(74,222,128,0.10)",
                            border: "1px solid rgba(74,222,128,0.25)",
                            borderRadius: 9999, padding: "3px 10px",
                          }}>
                            Cluster Buy Aktif
                          </span>
                        )}
                      </div>

                      {!insiderData ? (
                        <div style={{ textAlign: "center", paddingTop: 8, paddingBottom: 8 }}>
                          <p style={{ fontFamily: mono, fontSize: 11, color: "#3F3F46" }}>
                            Data insider belum cukup untuk dianalisis
                          </p>
                          <button
                            onClick={async () => {
                              try {
                                const token = prompt("MANAGEMENT_TOKEN:");
                                if (!token) return;
                                const r = await fetch(`/api/insider/${symbol}/research`, {
                                  method: "POST",
                                  headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
                                  body: JSON.stringify({ companyName: stock.name }),
                                });
                                const d = await r.json();
                                if (d.signal) setInsiderData(d);
                              } catch {}
                            }}
                            style={{
                              fontFamily: mono, fontSize: 10, letterSpacing: "0.1em",
                              color: "#4FC3F7", background: "rgba(79,195,247,0.07)",
                              border: "1px solid rgba(79,195,247,0.2)",
                              borderRadius: 6, padding: "8px 16px", cursor: "pointer", marginTop: 10,
                            }}
                          >
                            PICU RISET INSIDER →
                          </button>
                        </div>
                      ) : insiderData.signal === "INSUFFICIENT_DATA" ? (
                        <p style={{ fontFamily: inter, fontSize: 12, color: "#71717A", marginBottom: 8 }}>
                          Data insider belum cukup untuk dianalisis
                        </p>
                      ) : (
                        <>
                          {/* Stat row */}
                          <div style={{ display: "flex", gap: 20, marginBottom: 14, flexWrap: "wrap" as const }}>
                            {[
                              { label: "Pembelian", value: `${insiderData.insiderBuyCount ?? 0} transaksi`, color: "#4ADE80" },
                              { label: "Penjualan", value: `${insiderData.insiderSellCount ?? 0} transaksi`, color: "#F87171" },
                              { label: "Nilai Net", value: (() => {
                                const v = insiderData.netInsiderValue ?? 0;
                                const abs = Math.abs(v);
                                const fmt = abs >= 1e9 ? `Rp ${(abs/1e9).toFixed(1)}M`
                                           : abs >= 1e6 ? `Rp ${(abs/1e6).toFixed(0)}Jt`
                                           : `Rp ${abs.toLocaleString("id-ID")}`;
                                return (v >= 0 ? "+" : "−") + fmt;
                              })(), color: (insiderData.netInsiderValue ?? 0) >= 0 ? "#4ADE80" : "#F87171" },
                            ].map((s) => (
                              <div key={s.label}>
                                <p style={{ fontFamily: mono, fontSize: 8, letterSpacing: "0.12em", color: "#3F3F46", textTransform: "uppercase", marginBottom: 3 }}>
                                  {s.label}
                                </p>
                                <p style={{ fontFamily: mono, fontSize: 13, fontWeight: 700, color: s.color }}>{s.value}</p>
                              </div>
                            ))}
                            <div>
                              <p style={{ fontFamily: mono, fontSize: 8, letterSpacing: "0.12em", color: "#3F3F46", textTransform: "uppercase", marginBottom: 3 }}>
                                Sinyal
                              </p>
                              <p style={{
                                fontFamily: mono, fontSize: 11, fontWeight: 700,
                                color: insiderData.signal === "STRONG_BUY" || insiderData.signal === "BUY" ? "#4ADE80"
                                     : insiderData.signal === "STRONG_SELL" || insiderData.signal === "SELL" ? "#F87171"
                                     : "#FBBF24",
                              }}>
                                {insiderData.signal?.replace("_", " ")}
                              </p>
                            </div>
                          </div>

                          {/* Note */}
                          {insiderData.note && (
                            <p style={{ fontFamily: inter, fontSize: 11, color: "#71717A", marginBottom: 14, lineHeight: 1.55 }}>
                              {insiderData.note}
                            </p>
                          )}

                          {/* Cluster buy alert */}
                          {insiderData.clusterBuySignal && (
                            <div style={{
                              background: "rgba(74,222,128,0.06)", border: "1px solid rgba(74,222,128,0.2)",
                              borderRadius: 6, padding: "8px 12px", marginBottom: 14,
                            }}>
                              <p style={{ fontFamily: mono, fontSize: 10, color: "#4ADE80", fontWeight: 600 }}>
                                Cluster Buy: 3+ insider beli dalam 14 hari
                                {insiderData.priceContextSignal && " — saat harga lemah"}
                              </p>
                            </div>
                          )}

                          {/* Top transactions */}
                          {(insiderData.topTransactions ?? insiderData.allTransactions ?? []).length > 0 && (
                            <div>
                              <p style={{ fontFamily: mono, fontSize: 8, letterSpacing: "0.12em", color: "#3F3F46", textTransform: "uppercase", marginBottom: 8 }}>
                                TRANSAKSI TERBARU
                              </p>
                              <div style={{ display: "flex", flexDirection: "column" as const, gap: 4 }}>
                                {(insiderData.topTransactions ?? insiderData.allTransactions ?? []).slice(0, 5).map((tx: any, i: number) => (
                                  <div key={i} style={{
                                    display: "flex", alignItems: "center", gap: 10,
                                    padding: "6px 10px",
                                    background: "rgba(255,255,255,0.02)", borderRadius: 5,
                                    flexWrap: "wrap" as const,
                                  }}>
                                    <span style={{ fontFamily: mono, fontSize: 9, color: "#3F3F46", flexShrink: 0 }}>
                                      {tx.transactionDate}
                                    </span>
                                    <span style={{ fontFamily: inter, fontSize: 11, color: "#A1A1AA", flex: 1, minWidth: 80 }}>
                                      {tx.personName}
                                    </span>
                                    <span style={{ fontFamily: mono, fontSize: 9, color: "#52525B" }}>
                                      {tx.role?.slice(0, 20)}
                                    </span>
                                    <span style={{
                                      fontFamily: mono, fontSize: 9, fontWeight: 700,
                                      color: tx.transactionType === "BUY" ? "#4ADE80" : "#F87171",
                                    }}>
                                      {tx.transactionType === "BUY" ? "BELI" : "JUAL"}
                                    </span>
                                    <span style={{ fontFamily: mono, fontSize: 10, color: "#71717A" }}>
                                      {Number(tx.shares).toLocaleString("id-ID")} lbr
                                    </span>
                                    <span style={{ fontFamily: mono, fontSize: 10, color: "#A1A1AA", fontWeight: 600 }}>
                                      {(() => {
                                        const v = Number(tx.totalValue);
                                        if (v >= 1e9) return `Rp ${(v/1e9).toFixed(1)}M`;
                                        if (v >= 1e6) return `Rp ${(v/1e6).toFixed(0)}Jt`;
                                        return `Rp ${v.toLocaleString("id-ID")}`;
                                      })()}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Filing delay warning */}
                          {insiderData.filingDelayFlag && (
                            <div style={{
                              background: "rgba(251,191,36,0.06)", border: "1px solid rgba(251,191,36,0.2)",
                              borderRadius: 6, padding: "8px 12px", marginTop: 12,
                            }}>
                              <p style={{ fontFamily: mono, fontSize: 9, color: "#FBBF24" }}>
                                Pelaporan terlambat terdeteksi — sinyal tata kelola negatif
                              </p>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </TabsContent>

                  {/* Valuasi Tab */}
                  <TabsContent value="valuation" className="mt-0 focus-visible:outline-none">
                    <div className="p-4 space-y-4">
                      {valuationData ? (() => {
                        const v = valuationData.valuation?.valuation;
                        const q = valuationData.valuation?.quality;
                        const bench = valuationData.sectorBenchmark;
                        const pe = parseFloat(stock.peRatio);
                        const dy = parseFloat(stock.dividendYield);
                        const roeVal = parseFloat(stock.roe);
                        const nm = parseFloat(stock.netMargin);
                        const monoFont = "'IBM Plex Mono', monospace";
                        const verdictColor = v?.label === 'MURAH' ? '#34d399' : v?.label === 'MAHAL' ? '#fbbf24' : '#94a3b8';
                        const verdictBg = v?.label === 'MURAH' ? 'rgba(52,211,153,0.08)' : v?.label === 'MAHAL' ? 'rgba(251,191,36,0.08)' : 'rgba(148,163,184,0.05)';
                        const qualityColor = q?.label === 'KUAT' ? '#34d399' : q?.label === 'LEMAH' ? '#f87171' : '#94a3b8';
                        const qualityBg = q?.label === 'KUAT' ? 'rgba(52,211,153,0.08)' : q?.label === 'LEMAH' ? 'rgba(248,113,113,0.08)' : 'rgba(148,163,184,0.05)';

                        return (
                          <>
                            <div className="rounded-lg p-5" style={{ background: verdictBg, border: `1px solid ${verdictColor}30` }} data-testid="valuation-verdict">
                              <div className="flex items-center justify-between mb-3">
                                <p className="text-[9px] tracking-widest uppercase" style={{ fontFamily: monoFont, color: '#6b7280' }}>VERDICT VALUASI</p>
                                <span className="text-[10px] px-2 py-0.5 rounded" style={{ fontFamily: monoFont, background: `${verdictColor}20`, color: verdictColor }}>
                                  {bench?.displayName ?? 'Umum'}
                                </span>
                              </div>
                              <p className="text-2xl font-bold mb-1" style={{ fontFamily: monoFont, color: verdictColor }} data-testid="text-valuation-label">
                                {v?.label === 'MURAH' ? '🟢 MURAH' : v?.label === 'MAHAL' ? '🟡 MAHAL' : v?.label === 'TIDAK_ADA_DATA' ? '⚪ N/A' : '⚪ WAJAR'}
                              </p>
                              <p className="text-xs leading-relaxed" style={{ fontFamily: monoFont, color: '#94a3b8' }} data-testid="text-valuation-interpretation">
                                {v?.interpretation ?? ''}
                              </p>
                            </div>

                            {v?.relativePE !== null && v?.relativePE !== undefined && (
                              <div className="rounded-md p-4" style={{ background: '#161616', border: '1px solid rgba(255,255,255,0.03)' }} data-testid="valuation-relative-pe">
                                <p className="text-[9px] tracking-widest uppercase mb-3" style={{ fontFamily: monoFont, color: '#6b7280' }}>P/E RELATIF VS SEKTOR</p>
                                <div className="flex items-center gap-3 mb-2">
                                  <span className="text-3xl font-bold" style={{ fontFamily: monoFont, color: v.relativePE < 0.85 ? '#34d399' : v.relativePE > 1.15 ? '#fbbf24' : '#ffffff' }} data-testid="text-relative-pe">
                                    {v.relativePE.toFixed(2)}x
                                  </span>
                                  <span className="text-xs" style={{ fontFamily: monoFont, color: '#6b7280' }}>
                                    {v.relativePE < 1 ? `${Math.round((1 - v.relativePE) * 100)}% di bawah rata-rata` : v.relativePE > 1 ? `${Math.round((v.relativePE - 1) * 100)}% di atas rata-rata` : 'Sama dengan rata-rata'}
                                  </span>
                                </div>
                                <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: '#1e1e1e' }}>
                                  <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, v.relativePE * 50)}%`, background: v.relativePE < 0.85 ? '#34d399' : v.relativePE > 1.15 ? '#fbbf24' : '#64748b' }} />
                                </div>
                                <div className="flex justify-between mt-1">
                                  <span className="text-[9px]" style={{ fontFamily: monoFont, color: '#4a5568' }}>0x</span>
                                  <span className="text-[9px]" style={{ fontFamily: monoFont, color: '#4a5568' }}>1x (avg)</span>
                                  <span className="text-[9px]" style={{ fontFamily: monoFont, color: '#4a5568' }}>2x</span>
                                </div>
                              </div>
                            )}

                            <div className="grid grid-cols-2 gap-3">
                              {[
                                {
                                  label: "P/E RATIO", sub: "Price to Earnings",
                                  value: isNaN(pe) || pe === 0 ? null : pe.toFixed(2),
                                  bench: bench?.avgPE?.toFixed(1),
                                  color: isNaN(pe) || pe === 0 ? '#ffffff20' : pe > (bench?.avgPE ?? 15) * 1.3 ? '#fbbf24' : pe < (bench?.avgPE ?? 15) * 0.7 ? '#34d399' : '#ffffff',
                                },
                                {
                                  label: "DIVIDEND YIELD", sub: "Imbal Dividen",
                                  value: isNaN(dy) || dy === 0 ? null : dy.toFixed(2) + '%',
                                  bench: (bench?.avgDivYield?.toFixed(1) ?? '') + '%',
                                  color: isNaN(dy) || dy === 0 ? '#ffffff20' : dy > (bench?.avgDivYield ?? 2.5) ? '#34d399' : '#ffffff',
                                },
                                {
                                  label: "ROE", sub: "Return on Equity",
                                  value: isNaN(roeVal) || roeVal === 0 ? null : roeVal.toFixed(2) + '%',
                                  bench: (bench?.avgROE?.toFixed(1) ?? '') + '%',
                                  color: isNaN(roeVal) || roeVal === 0 ? '#ffffff20' : roeVal > (bench?.avgROE ?? 12) ? '#34d399' : roeVal < (bench?.avgROE ?? 12) * 0.5 ? '#f87171' : '#ffffff',
                                },
                                {
                                  label: "NET MARGIN", sub: "Margin Laba Bersih",
                                  value: isNaN(nm) || nm === 0 ? null : nm.toFixed(2) + '%',
                                  bench: (bench?.avgNetMargin?.toFixed(1) ?? '') + '%',
                                  color: isNaN(nm) || nm === 0 ? '#ffffff20' : nm > (bench?.avgNetMargin ?? 10) ? '#34d399' : '#ffffff',
                                },
                              ].map(m => (
                                <div key={m.label} className="rounded-md p-4" style={{ background: '#161616', border: '1px solid rgba(255,255,255,0.03)' }} data-testid={`valuation-${m.label.toLowerCase().replace(/[\s/]+/g, '-')}`}>
                                  <p className="text-[9px] tracking-widest uppercase mb-2" style={{ fontFamily: monoFont, color: '#6b7280' }}>{m.label}</p>
                                  <p className="text-2xl font-bold" style={{ fontFamily: monoFont, color: m.color }}>{m.value ?? '—'}</p>
                                  <div className="flex items-center justify-between mt-1">
                                    <p className="text-[10px]" style={{ fontFamily: monoFont, color: '#6b7280' }}>{m.sub}</p>
                                    {m.bench && <p className="text-[9px]" style={{ fontFamily: monoFont, color: '#4a5568' }}>avg: {m.bench}</p>}
                                  </div>
                                </div>
                              ))}
                            </div>

                            <div className="rounded-lg p-4" style={{ background: qualityBg, border: `1px solid ${qualityColor}30` }} data-testid="valuation-quality">
                              <div className="flex items-center justify-between mb-2">
                                <p className="text-[9px] tracking-widest uppercase" style={{ fontFamily: monoFont, color: '#6b7280' }}>KUALITAS FUNDAMENTAL</p>
                                <span className="text-xs font-bold px-2 py-0.5 rounded" style={{ fontFamily: monoFont, background: `${qualityColor}20`, color: qualityColor }} data-testid="text-quality-label">
                                  {q?.label ?? 'N/A'}
                                </span>
                              </div>
                              <p className="text-xs leading-relaxed" style={{ fontFamily: monoFont, color: '#94a3b8' }} data-testid="text-quality-interpretation">
                                {q?.interpretation ?? ''}
                              </p>
                            </div>

                            <div className="rounded-md p-4" style={{ background: '#161616', border: '1px solid rgba(255,255,255,0.03)' }} data-testid="valuation-analyst-note">
                              <p className="text-[9px] tracking-widest uppercase mb-2" style={{ fontFamily: monoFont, color: '#6b7280' }}>CATATAN ANALIS</p>
                              <p className="text-xs leading-relaxed" style={{ fontFamily: monoFont, color: '#6b7280' }}>
                                Data valuasi berdasarkan laporan keuangan terakhir. Benchmark sektor ({bench?.displayName ?? 'Umum'}) digunakan sebagai pembanding relatif.
                              </p>
                            </div>
                          </>
                        );
                      })() : (
                        <div className="space-y-3">
                          <div className="h-24 rounded-lg animate-pulse" style={{ background: '#161616' }} />
                          <div className="grid grid-cols-2 gap-3">
                            {[1,2,3,4].map(i => <div key={i} className="h-24 rounded-md animate-pulse" style={{ background: '#161616' }} />)}
                          </div>
                        </div>
                      )}
                    </div>
                  </TabsContent>
                </div>
              </Tabs>
            </motion.div>

        </motion.div>
      </main>

      {/* Keyboard shortcuts hint */}
      <div
        style={{
          position: "fixed", bottom: 20, right: 20, zIndex: 40,
          display: "flex", alignItems: "center", gap: 6,
          background: "#0a0a0a", border: "1px solid rgba(255,255,255,0.06)",
          borderRadius: 8, padding: "6px 10px", cursor: "pointer",
          opacity: showShortcuts ? 0 : 1, transition: "opacity 0.2s",
        }}
        onClick={() => setShowShortcuts(true)}
        title="Keyboard shortcuts (?)"
      >
        <span style={{ fontFamily: mono, fontSize: 10, color: "#3F3F46", letterSpacing: "0.06em" }}>?</span>
        <span style={{ fontFamily: mono, fontSize: 8, color: "#3F3F46", letterSpacing: "0.08em" }}>SHORTCUTS</span>
      </div>

      {/* Keyboard shortcuts overlay */}
      {showShortcuts && (
        <div
          style={{
            position: "fixed", inset: 0, zIndex: 50,
            background: "rgba(0,0,0,0.7)", display: "flex",
            alignItems: "center", justifyContent: "center",
          }}
          onClick={() => setShowShortcuts(false)}
        >
          <div
            style={{
              background: "#0a0a0a", border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 12, padding: "28px 32px", minWidth: 320,
              boxShadow: "0 25px 50px rgba(0,0,0,0.6)",
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
              <p style={{ fontFamily: mono, fontSize: 9, letterSpacing: "0.2em", color: "#3F3F46", textTransform: "uppercase" }}>
                KEYBOARD SHORTCUTS
              </p>
              <button
                onClick={() => setShowShortcuts(false)}
                style={{ fontFamily: mono, fontSize: 10, color: "#3F3F46", background: "none", border: "none", cursor: "pointer", padding: 0 }}
              >
                ESC
              </button>
            </div>
            {[
              { key: "r", label: "Ringkasan (Overview)" },
              { key: "f", label: "Flow Broker" },
              { key: "n", label: "Berita" },
              { key: "d", label: "Distribusi" },
              { key: "j", label: "Tab berikutnya →" },
              { key: "k", label: "Tab sebelumnya ←" },
              { key: "?", label: "Toggle shortcut panel" },
            ].map(({ key, label }) => (
              <div key={key} style={{ display: "flex", alignItems: "center", gap: 12, paddingBottom: 10 }}>
                <span style={{
                  fontFamily: mono, fontSize: 10, fontWeight: 700, color: "#F4F4F5",
                  background: "#141414", border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 4, padding: "3px 8px", minWidth: 24, textAlign: "center",
                }}>
                  {key}
                </span>
                <span style={{ fontFamily: inter, fontSize: 12, color: "#71717A" }}>{label}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
