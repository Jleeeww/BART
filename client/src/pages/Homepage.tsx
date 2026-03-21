import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { SimulationToggle } from "@/components/SimulationToggle";
import { Star, StarOff, AlertTriangle } from "lucide-react";

function useWIBClock() {
  const [time, setTime] = useState("");
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      const wib = new Date(now.getTime() + 7 * 60 * 60 * 1000);
      setTime(
        `${String(wib.getUTCHours()).padStart(2, "0")}:${String(wib.getUTCMinutes()).padStart(2, "0")}:${String(wib.getUTCSeconds()).padStart(2, "0")} WIB`
      );
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return time;
}

interface StockCardData {
  symbol: string;
  name: string;
  price: string;
  change: string;
  changePercent: string;
  sector: string;
  sectorBadge: string | null;
  readinessScore: number;
  marketRegime: string;
  actionGuidance: string;
  actionColor: "green" | "yellow" | "blue" | "red" | "black";
  actionState: string;
  homepageBucket: "siap_dipantau" | "watchlist_prioritas" | "hindari_dulu";
  aiSentence: string;
  isInWatchlist: boolean;
  isGorengan?: boolean;
  gorenganWarning?: string | null;
  riskOverride?: string | null;
}

function getIDXSessionStatus(): { label: string; color: "green" | "yellow" | "red" } {
  const now = new Date();
  const wibOffset = 7 * 60;
  const utcMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
  const wibMinutes = (utcMinutes + wibOffset) % (24 * 60);
  const totalMinutes = Math.floor(wibMinutes / 60) * 60 + (wibMinutes % 60);

  const wibDate = new Date(now.getTime() + wibOffset * 60 * 1000);
  const dayOfWeek = wibDate.getUTCDay();

  if (dayOfWeek === 0 || dayOfWeek === 6) {
    return { label: "Pasar Tutup", color: "red" };
  }
  if (totalMinutes >= 8 * 60 + 45 && totalMinutes < 9 * 60) {
    return { label: "Pra-Pembukaan", color: "yellow" };
  }
  if (totalMinutes >= 9 * 60 && totalMinutes < 12 * 60) {
    return { label: "Sesi 1 Berlangsung", color: "green" };
  }
  if (totalMinutes >= 12 * 60 && totalMinutes < 13 * 60 + 30) {
    return { label: "Istirahat", color: "yellow" };
  }
  if (totalMinutes >= 13 * 60 + 30 && totalMinutes < 15 * 60 + 50) {
    return { label: "Sesi 2 Berlangsung", color: "green" };
  }
  if (totalMinutes >= 15 * 60 + 50 && totalMinutes < 16 * 60) {
    return { label: "Pra-Penutupan", color: "yellow" };
  }
  return { label: "Pasar Tutup", color: "red" };
}

const sessionColorMap = {
  green: "#22c55e",
  yellow: "#f59e0b",
  red: "#ef4444",
};

type BucketType = "siap_dipantau" | "watchlist_prioritas" | "hindari_dulu";

const bucketAccent: Record<BucketType, string> = {
  siap_dipantau: "#34d399",
  watchlist_prioritas: "#fbbf24",
  hindari_dulu: "#f87171",
};

function StockCard({ stock, bucket, index, onToggleWatchlist, isToggling }: {
  stock: StockCardData;
  bucket: BucketType;
  index: number;
  onToggleWatchlist: (symbol: string, isAdding: boolean) => void;
  isToggling: boolean;
}) {
  const [, navigate] = useLocation();
  const isPositive = parseFloat(stock.change) >= 0;
  const accent = bucketAccent[bucket];

  return (
    <div
      className="stock-card-animate"
      style={{ animationDelay: `${index * 40}ms` }}
    >
      <div
        onClick={() => navigate(`/stock/${stock.symbol}`)}
        className="stock-card-row flex items-center gap-4 px-4 py-3 mb-2 rounded-md transition-all duration-150 cursor-pointer"
        style={{
          background: "#161616",
          borderLeft: `2px solid ${accent}`,
        }}
        data-testid={`card-stock-${stock.symbol}`}
      >
        <div className="flex-shrink-0 w-32">
          <Link href={`/stock/${stock.symbol}`}>
            <span
              className="font-bold text-white text-base hover:text-[#38BDF8] transition-colors cursor-pointer"
              style={{ fontFamily: "'Sora', sans-serif" }}
              data-testid={`link-stock-${stock.symbol}`}
            >
              {stock.symbol}
            </span>
          </Link>
          <div className="flex items-center gap-1.5 mt-0.5">
            <p
              className="text-[10px] text-[#6b7280] truncate"
              style={{ fontFamily: "'IBM Plex Mono', monospace" }}
            >
              {stock.name}
            </p>
            {stock.isGorengan && (
              <span className="flex items-center text-[9px] text-red-400 font-bold" data-testid={`badge-gorengan-${stock.symbol}`}>
                <AlertTriangle className="w-2.5 h-2.5 mr-0.5" />
                GOR
              </span>
            )}
          </div>
        </div>

        <div className="flex-shrink-0 w-16 text-center">
          <span
            className="text-xl font-bold"
            style={{ fontFamily: "'IBM Plex Mono', monospace", color: accent }}
            data-testid={`badge-score-${stock.symbol}`}
          >
            {stock.readinessScore}
          </span>
          <p
            className="text-[9px] text-[#6b7280] tracking-widest"
            style={{ fontFamily: "'IBM Plex Mono', monospace" }}
          >
            SKOR
          </p>
        </div>

        <div className="flex-1 min-w-0">
          <span
            className="inline-block text-[10px] px-2 py-0.5 rounded-sm text-[#38BDF8]"
            style={{
              fontFamily: "'IBM Plex Mono', monospace",
              background: "rgba(255,255,255,0.02)",
              border: "1px solid rgba(255,255,255,0.06)",
            }}
          >
            {stock.marketRegime}
          </span>
          <p
            className="text-[11px] text-[#6b7280] mt-1 truncate"
            style={{ fontFamily: "'Sora', sans-serif" }}
            data-testid={`badge-action-${stock.symbol}`}
          >
            {stock.actionGuidance}
          </p>
        </div>

        <div className="flex-shrink-0 w-24 text-right">
          <p
            className="text-sm font-medium text-white"
            style={{ fontFamily: "'IBM Plex Mono', monospace" }}
          >
            {parseInt(stock.price).toLocaleString("id-ID")}
          </p>
          <p
            className="text-xs mt-0.5"
            style={{
              fontFamily: "'IBM Plex Mono', monospace",
              color: isPositive ? "#22c55e" : "#ef4444",
            }}
          >
            {isPositive ? "+" : ""}
            {stock.changePercent}%
          </p>
        </div>

        <div className="flex-shrink-0 w-20 flex gap-2 justify-end items-center">
          <button
            disabled={isToggling}
            onClick={(e) => {
              e.stopPropagation();
              onToggleWatchlist(stock.symbol, !stock.isInWatchlist);
            }}
            className="text-[#6b7280] hover:text-amber-400 transition-colors disabled:opacity-50"
            data-testid={`button-watchlist-${stock.symbol}`}
          >
            {stock.isInWatchlist ? (
              <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
            ) : (
              <StarOff className="w-4 h-4" />
            )}
          </button>
          <Link href={`/stock/${stock.symbol}`}>
            <button
              className="text-[10px] px-2 py-1 rounded-sm transition-all"
              style={{
                fontFamily: "'IBM Plex Mono', monospace",
                background: "rgba(56,189,248,0.1)",
                color: "#38BDF8",
                border: "1px solid rgba(56,189,248,0.2)",
              }}
              data-testid={`button-detail-${stock.symbol}`}
            >
              DETAIL →
            </button>
          </Link>
        </div>
      </div>
    </div>
  );
}

function StockCardSkeleton() {
  return (
    <div
      className="flex items-center gap-4 px-4 py-3 mb-2 rounded-md"
      style={{ background: "#161616", border: "1px solid rgba(255,255,255,0.03)" }}
    >
      <div className="w-32 space-y-1">
        <Skeleton className="h-4 w-16 bg-[#222]" />
        <Skeleton className="h-3 w-28 bg-[#222]" />
      </div>
      <div className="w-16 flex flex-col items-center gap-1">
        <Skeleton className="h-6 w-10 bg-[#222]" />
        <Skeleton className="h-2 w-8 bg-[#222]" />
      </div>
      <div className="flex-1 space-y-1">
        <Skeleton className="h-4 w-24 bg-[#222]" />
        <Skeleton className="h-3 w-36 bg-[#222]" />
      </div>
      <div className="w-24 space-y-1 flex flex-col items-end">
        <Skeleton className="h-4 w-16 bg-[#222]" />
        <Skeleton className="h-3 w-10 bg-[#222]" />
      </div>
      <div className="w-20 flex gap-2 justify-end">
        <Skeleton className="h-6 w-6 rounded bg-[#222]" />
        <Skeleton className="h-6 w-14 rounded bg-[#222]" />
      </div>
    </div>
  );
}

const tabConfig: { key: BucketType; label: string; tabLabel: string; description: string }[] = [
  {
    key: "siap_dipantau",
    label: "SIAP DIPANTAU",
    tabLabel: "Siap Dipantau",
    description: "Saham dengan Smart Money Readiness Score ≥ 80 — struktur siap dengan momentum yang mulai selaras.",
  },
  {
    key: "watchlist_prioritas",
    label: "WATCHLIST",
    tabLabel: "Watchlist Prioritas",
    description: "Saham dengan Readiness Score 60-79 — sedang dipersiapkan, tapi belum waktunya masuk.",
  },
  {
    key: "hindari_dulu",
    label: "HINDARI DULU",
    tabLabel: "Hindari Dulu",
    description: "Saham dengan Readiness Score < 60 — risiko tinggi, hindari entry baru.",
  },
];

export default function Homepage() {
  const [activeTab, setActiveTab] = useState<BucketType>("siap_dipantau");
  const [togglingSymbols, setTogglingSymbols] = useState<Set<string>>(new Set());

  const { data: stocks, isLoading } = useQuery<StockCardData[]>({
    queryKey: ["/api/stocks"],
  });

  const addToWatchlistMutation = useMutation({
    mutationFn: async (symbol: string) => {
      await apiRequest("POST", `/api/watchlist/${symbol}`);
    },
    onMutate: async (symbol) => {
      setTogglingSymbols(prev => new Set(prev).add(symbol));
      await queryClient.cancelQueries({ queryKey: ["/api/stocks"] });
      const previousStocks = queryClient.getQueryData<StockCardData[]>(["/api/stocks"]);
      queryClient.setQueryData<StockCardData[]>(["/api/stocks"], (old) =>
        old?.map((s) => (s.symbol === symbol ? { ...s, isInWatchlist: true } : s))
      );
      return { previousStocks };
    },
    onError: (_err, _symbol, context) => {
      if (context?.previousStocks) {
        queryClient.setQueryData(["/api/stocks"], context.previousStocks);
      }
    },
    onSettled: (_data, _error, symbol) => {
      setTogglingSymbols(prev => {
        const next = new Set(prev);
        next.delete(symbol);
        return next;
      });
      queryClient.invalidateQueries({ queryKey: ["/api/stocks"] });
    },
  });

  const removeFromWatchlistMutation = useMutation({
    mutationFn: async (symbol: string) => {
      await apiRequest("DELETE", `/api/watchlist/${symbol}`);
    },
    onMutate: async (symbol) => {
      setTogglingSymbols(prev => new Set(prev).add(symbol));
      await queryClient.cancelQueries({ queryKey: ["/api/stocks"] });
      const previousStocks = queryClient.getQueryData<StockCardData[]>(["/api/stocks"]);
      queryClient.setQueryData<StockCardData[]>(["/api/stocks"], (old) =>
        old?.map((s) => (s.symbol === symbol ? { ...s, isInWatchlist: false } : s))
      );
      return { previousStocks };
    },
    onError: (_err, _symbol, context) => {
      if (context?.previousStocks) {
        queryClient.setQueryData(["/api/stocks"], context.previousStocks);
      }
    },
    onSettled: (_data, _error, symbol) => {
      setTogglingSymbols(prev => {
        const next = new Set(prev);
        next.delete(symbol);
        return next;
      });
      queryClient.invalidateQueries({ queryKey: ["/api/stocks"] });
    },
  });

  const handleToggleWatchlist = (symbol: string, isAdding: boolean) => {
    if (togglingSymbols.has(symbol)) return;
    if (isAdding) {
      addToWatchlistMutation.mutate(symbol);
    } else {
      removeFromWatchlistMutation.mutate(symbol);
    }
  };

  const readyStocks = stocks?.filter(s => s.homepageBucket === "siap_dipantau") || [];
  const watchlistStocks = stocks?.filter(s => s.homepageBucket === "watchlist_prioritas") || [];
  const avoidStocks = stocks?.filter(s => s.homepageBucket === "hindari_dulu") || [];

  if (stocks && stocks.length > 0) {
    const totalBucketed = readyStocks.length + watchlistStocks.length + avoidStocks.length;
    const unbucketedStocks = stocks.filter(
      s => !["siap_dipantau", "watchlist_prioritas", "hindari_dulu"].includes(s.homepageBucket)
    );
    console.log(`[HOMEPAGE AUDIT] totalUniverseCount: ${stocks.length}`);
    console.log(`[HOMEPAGE AUDIT] totalRenderedCount: ${totalBucketed}`);
    if (unbucketedStocks.length > 0) {
      const missing = unbucketedStocks.map(s => `${s.symbol}(bucket=${s.homepageBucket})`);
      console.warn(`[HOMEPAGE AUDIT] missingFromBuckets: ${missing.join(", ")}`);
    } else {
      console.log(`[HOMEPAGE AUDIT] missingSymbols: none — all stocks bucketed`);
    }
  }

  const bucketStocks: Record<BucketType, StockCardData[]> = {
    siap_dipantau: readyStocks,
    watchlist_prioritas: watchlistStocks,
    hindari_dulu: avoidStocks,
  };

  const totalStocks = (stocks?.length) || 0;
  const session = getIDXSessionStatus();
  const isSessionActive = session.color === "green";
  const wibTime = useWIBClock();
  const activeStocks = bucketStocks[activeTab];
  const activeConfig = tabConfig.find(t => t.key === activeTab)!;

  return (
    <div className="min-h-screen" style={{ background: "#0f0f0f" }}>
      {/* SECTION 1 — Top Navigation Bar */}
      <nav
        className="flex items-center justify-between px-6"
        style={{ height: 48, background: "#0a0a0a", borderBottom: "1px solid rgba(255,255,255,0.03)" }}
      >
        <span
          className="font-bold text-lg tracking-wider"
          style={{ fontFamily: "'IBM Plex Mono', monospace", color: "#38BDF8" }}
        >
          BART
        </span>
        <SimulationToggle />
      </nav>

      {/* SECTION 2 — Hero Block */}
      <section
        className="relative w-full px-6 pt-10 pb-6"
        style={{ background: "#0f0f0f" }}
      >
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: "repeating-linear-gradient(0deg, rgba(255,255,255,0.03) 0px, rgba(255,255,255,0.03) 1px, transparent 1px, transparent 3px)",
          }}
        />
        <div className="relative flex flex-wrap justify-between items-start gap-6">
          <div className="flex-1 min-w-[280px] max-w-[60%]">
            <p
              className="text-[10px] tracking-[0.2em] uppercase mb-2"
              style={{ fontFamily: "'IBM Plex Mono', monospace", color: "#38BDF8" }}
            >
              BANDARMOLOGY INTELLIGENCE
            </p>
            <h1
              className="text-3xl font-bold text-white leading-tight"
              style={{ fontFamily: "'Sora', sans-serif" }}
              data-testid="text-homepage-title"
            >
              Peta Kesiapan Saham
            </h1>
            <h2
              className="text-3xl font-bold leading-tight"
              style={{ fontFamily: "'Sora', sans-serif", color: "#38BDF8" }}
            >
              Hari Ini
            </h2>
            <p
              className="text-sm mt-3 max-w-lg"
              style={{ color: "#6b7280" }}
              data-testid="text-homepage-subtitle"
            >
              Disusun berdasarkan perilaku bandar, struktur pasar, dan risiko distribusi.{" "}
              <span className="italic">Bukan sinyal — panduan kesiapan.</span>
            </p>
          </div>

          <div
            className="flex-shrink-0 w-48 rounded-md p-4"
            style={{ background: "#161616", border: "1px solid rgba(255,255,255,0.03)" }}
          >
            <p
              className="text-[9px] tracking-[0.2em] uppercase mb-2"
              style={{ fontFamily: "'IBM Plex Mono', monospace", color: "#6b7280" }}
            >
              STATUS PASAR
            </p>
            <div className="flex items-center gap-2">
              <span
                className="relative inline-block w-2 h-2 rounded-full flex-shrink-0"
                style={{ background: sessionColorMap[session.color] }}
              >
                {isSessionActive && (
                  <span
                    className="absolute inset-0 rounded-full animate-ping"
                    style={{ background: sessionColorMap[session.color], opacity: 0.5 }}
                  />
                )}
              </span>
              <p
                className="text-sm font-medium"
                style={{
                  fontFamily: "'IBM Plex Mono', monospace",
                  color: sessionColorMap[session.color],
                }}
              >
                {session.label}
              </p>
            </div>
            <p
              className="text-xs mt-2"
              style={{ fontFamily: "'IBM Plex Mono', monospace", color: "#6b7280" }}
            >
              {wibTime}
            </p>
          </div>
        </div>
      </section>

      {/* SECTION 3 — Aggregate Stats Bar */}
      <section
        className="w-full px-6 py-3 flex items-stretch gap-0 overflow-x-auto"
        style={{
          background: "#111111",
          borderTop: "1px solid rgba(255,255,255,0.06)",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        {[
          { label: "SAHAM DIPANTAU", value: totalStocks, color: "#fff" },
          { label: "SIAP DIPANTAU", value: readyStocks.length, color: "#34d399" },
          { label: "WATCHLIST", value: watchlistStocks.length, color: "#fbbf24" },
          { label: "HINDARI DULU", value: avoidStocks.length, color: "#f87171" },
        ].map((stat, i, arr) => (
          <div
            key={stat.label}
            className="flex flex-col gap-0.5 px-6"
            style={{
              borderRight: i < arr.length - 1 ? "1px solid rgba(255,255,255,0.08)" : "none",
            }}
          >
            <span
              className="text-[10px] tracking-widest whitespace-nowrap"
              style={{ fontFamily: "'IBM Plex Mono', monospace", color: "#6b7280" }}
            >
              {stat.label}
            </span>
            <span
              className="text-xl font-bold"
              style={{ fontFamily: "'IBM Plex Mono', monospace", color: stat.color }}
            >
              {isLoading ? "—" : stat.value}
            </span>
          </div>
        ))}
      </section>

      {/* SECTION 4 — Radar Placeholder Banner */}
      <div className="mx-6 my-4">
        <div
          className="flex justify-between items-center px-5 py-4 rounded-md"
          style={{
            background: "#0d1a2a",
            border: "1px solid rgba(56,189,248,0.2)",
          }}
        >
          <div>
            <p
              className="text-[10px] tracking-[0.2em] uppercase mb-1"
              style={{ fontFamily: "'IBM Plex Mono', monospace", color: "#38BDF8" }}
            >
              BANDARMOLOGY RADAR
            </p>
            <p
              className="text-sm"
              style={{ fontFamily: "'Sora', sans-serif", color: "#6b7280" }}
            >
              Pemindaian institusional di seluruh IDX — segera hadir
            </p>
          </div>
          <span
            className="text-[10px] tracking-widest px-3 py-1 rounded-sm flex-shrink-0"
            style={{
              fontFamily: "'IBM Plex Mono', monospace",
              background: "rgba(56,189,248,0.1)",
              color: "#38BDF8",
              border: "1px solid rgba(56,189,248,0.3)",
            }}
          >
            SEGERA
          </span>
        </div>
      </div>

      {/* SECTION 5 — Bucket Tabs + Stock Cards */}
      <section className="px-6 pb-10">
        <div
          className="flex gap-0"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}
          data-testid="tabs-homepage"
        >
          {tabConfig.map((tab) => {
            const isActive = activeTab === tab.key;
            const accent = bucketAccent[tab.key];
            const count = bucketStocks[tab.key].length;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className="px-4 py-2 flex items-center gap-2 transition-colors"
                style={{
                  fontFamily: "'IBM Plex Mono', monospace",
                  fontSize: 12,
                  letterSpacing: "0.05em",
                  textTransform: "uppercase" as const,
                  color: isActive ? "#fff" : "#6b7280",
                  borderBottom: isActive ? `2px solid ${accent}` : "2px solid transparent",
                  background: "transparent",
                }}
                data-testid={`tab-${tab.key === "siap_dipantau" ? "siap" : tab.key === "watchlist_prioritas" ? "watchlist" : "hindari"}`}
              >
                {tab.tabLabel}
                <span
                  className="px-1.5 py-0.5 rounded-sm text-[10px]"
                  style={{
                    fontFamily: "'IBM Plex Mono', monospace",
                    background: isActive ? `${accent}20` : "rgba(255,255,255,0.03)",
                    color: isActive ? accent : "#6b7280",
                  }}
                >
                  {isLoading ? "—" : count}
                </span>
              </button>
            );
          })}
        </div>

        <div
          className="text-xs px-4 py-2.5 rounded-sm mt-3 mb-4"
          style={{
            fontFamily: "'IBM Plex Mono', monospace",
            background: "#161616",
            color: bucketAccent[activeTab],
          }}
        >
          {activeConfig.description}
        </div>

        <div data-testid={`content-${activeTab === "siap_dipantau" ? "siap" : activeTab === "watchlist_prioritas" ? "watchlist" : "hindari"}`}>
          {isLoading ? (
            <div>
              <StockCardSkeleton />
              <StockCardSkeleton />
              <StockCardSkeleton />
            </div>
          ) : activeStocks.length === 0 ? (
            <div
              className="rounded-md px-6 py-12 text-center"
              style={{
                background: "#161616",
                border: "1px dashed rgba(255,255,255,0.06)",
              }}
            >
              <p className="text-3xl mb-3" style={{ color: "rgba(255,255,255,0.06)" }}>◎</p>
              <p
                className="text-sm"
                style={{ fontFamily: "'IBM Plex Mono', monospace", color: "#6b7280" }}
              >
                Tidak ada saham terdeteksi
              </p>
              <p
                className="text-[10px] mt-1"
                style={{ fontFamily: "'IBM Plex Mono', monospace", color: "rgba(255,255,255,0.12)" }}
              >
                Radar sedang memindai pasar IDX
              </p>
            </div>
          ) : (
            activeStocks.map((stock, index) => (
              <StockCard
                key={stock.symbol}
                stock={stock}
                bucket={activeTab}
                index={index}
                onToggleWatchlist={handleToggleWatchlist}
                isToggling={togglingSymbols.has(stock.symbol)}
              />
            ))
          )}
        </div>
      </section>
    </div>
  );
}
