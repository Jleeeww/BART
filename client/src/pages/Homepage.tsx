import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { SimulationToggle } from "@/components/SimulationToggle";
import { 
  TrendingUp, 
  TrendingDown, 
  Eye, 
  AlertTriangle, 
  Star,
  StarOff,
  Flame,
  ArrowRight,
  Info,
  Clock
} from "lucide-react";
import { motion } from "framer-motion";

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

function getIDXSessionStatus() {
  const now = new Date();
  const day = now.getDay();
  const hours = now.getHours();
  const minutes = now.getMinutes();
  const time = hours * 100 + minutes;

  if (day === 0 || day === 6) return { status: "CLOSED", label: "Market Closed", color: "text-red-500" };
  
  // Session 1: 09:00 - 12:00
  if (time >= 900 && time < 1200) return { status: "OPEN", label: "Session I", color: "text-emerald-500" };
  // Break: 12:00 - 13:30
  if (time >= 1200 && time < 1330) return { status: "BREAK", label: "Market Break", color: "text-amber-500" };
  // Session 2: 13:30 - 16:00
  if (time >= 1330 && time < 1600) return { status: "OPEN", label: "Session II", color: "text-emerald-500" };
  
  return { status: "CLOSED", label: "Market Closed", color: "text-red-500" };
}

function ScannerRow({ stock }: { stock: StockCardData }) {
  const isPositive = parseFloat(stock.change) >= 0;
  const scoreColor = stock.readinessScore >= 80 ? "text-emerald-500" : stock.readinessScore >= 60 ? "text-amber-500" : "text-red-500";
  
  return (
    <Link href={`/stock/${stock.symbol}`}>
      <div className="terminal-scanner-row flex items-center justify-between p-2 cursor-pointer border-b border-[#1F1F1F] hover:bg-[#1A1A1A] transition-colors">
        <div className="flex items-center gap-2">
          <span className="font-mono font-bold text-sm text-[#EAEAEA]">{stock.symbol}</span>
          {stock.isGorengan && <AlertTriangle className="w-3 h-3 text-red-500" />}
          <span className={`text-[10px] font-mono font-bold ${scoreColor}`}>
            {stock.readinessScore}
          </span>
        </div>
        <div className="flex flex-col items-end">
          <span className="font-mono text-xs text-[#EAEAEA]">{parseInt(stock.price).toLocaleString('id-ID')}</span>
          <span className={`font-mono text-[10px] ${isPositive ? 'text-emerald-500' : 'text-red-500'}`}>
            {isPositive ? '+' : ''}{stock.changePercent}%
          </span>
        </div>
      </div>
    </Link>
  );
}

function StockCard({ stock, onToggleWatchlist, isToggling }: { stock: StockCardData; onToggleWatchlist: (symbol: string, isAdding: boolean) => void; isToggling: boolean }) {
  const isPositive = parseFloat(stock.change) >= 0;
  const scoreColor = stock.readinessScore >= 80 ? "text-emerald-500" : stock.readinessScore >= 60 ? "text-amber-500" : "text-red-500";
  const accentColor = stock.readinessScore >= 80 ? "bg-emerald-500" : stock.readinessScore >= 60 ? "bg-amber-500" : "bg-red-500";
  const regimeBg = stock.readinessScore >= 80 ? "bg-emerald-500/10 text-emerald-500" : stock.readinessScore >= 60 ? "bg-amber-500/10 text-amber-500" : "bg-red-500/10 text-red-500";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      <Card 
        className="relative overflow-hidden bg-[#111111] border-[#1F1F1F] p-5 hover-elevate transition-all"
        data-testid={`card-stock-${stock.symbol}`}
      >
        <div className={`absolute left-0 top-0 bottom-0 w-1 ${accentColor}`} />
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-1">
              <Link href={`/stock/${stock.symbol}`}>
                <h2 className="text-2xl font-mono font-bold text-[#EAEAEA] cursor-pointer hover:text-[#4ADE80] transition-colors" data-testid={`link-stock-${stock.symbol}`}>
                  {stock.symbol}
                </h2>
              </Link>
              <Badge variant="outline" className={`font-mono text-xs border-[#1F1F1F] ${regimeBg}`}>
                {stock.marketRegime}
              </Badge>
              {stock.isInWatchlist && (
                <Badge variant="outline" className="text-[10px] bg-blue-500/10 text-blue-400 border-blue-500/30">
                  WATCHLIST
                </Badge>
              )}
              {stock.isGorengan && (
                <Badge variant="destructive" className="text-[10px] font-bold bg-red-500/20 text-red-500 border-red-500/30">
                  SPEKULATIF
                </Badge>
              )}
            </div>
            <p className="text-sm text-[#8B8B8B] mb-3">{stock.name}</p>
            <p className="text-xs text-[#8B8B8B] italic leading-relaxed" data-testid={`text-ai-${stock.symbol}`}>
              {stock.aiSentence}
            </p>
          </div>

          <div className="flex items-center gap-6">
            <div className="text-right">
              <div className="text-xs text-[#8B8B8B] font-mono uppercase mb-1">Score</div>
              <div className={`text-4xl font-mono font-bold ${scoreColor}`} data-testid={`badge-score-${stock.symbol}`}>
                {stock.readinessScore}
              </div>
            </div>

            <div className="text-right min-w-[100px]">
              <div className="font-mono text-lg text-[#EAEAEA]">{parseInt(stock.price).toLocaleString('id-ID')}</div>
              <div className={`font-mono text-sm flex items-center justify-end gap-1 ${isPositive ? 'text-emerald-500' : 'text-red-500'}`}>
                {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                {stock.changePercent}%
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Button
                size="icon"
                variant="ghost"
                className="h-9 w-9 border border-[#1F1F1F] hover:bg-[#1A1A1A]"
                disabled={isToggling}
                onClick={() => onToggleWatchlist(stock.symbol, !stock.isInWatchlist)}
                data-testid={`button-watchlist-${stock.symbol}`}
              >
                {stock.isInWatchlist ? (
                  <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                ) : (
                  <StarOff className="w-4 h-4 text-[#8B8B8B]" />
                )}
              </Button>
              <Link href={`/stock/${stock.symbol}`}>
                <Button size="sm" variant="outline" className="text-[10px] font-mono h-8 border-[#1F1F1F] hover:bg-[#1A1A1A] gap-1" data-testid={`button-detail-${stock.symbol}`}>
                  DETAILS <ArrowRight className="w-3 h-3" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}

function StockCardSkeleton() {
  return (
    <Card className="bg-[#111111] border-[#1F1F1F] p-5">
      <div className="flex flex-col md:flex-row justify-between gap-4">
        <div className="flex-1 space-y-3">
          <div className="flex items-center gap-3">
            <Skeleton className="h-8 w-24 bg-[#1F1F1F]" />
            <Skeleton className="h-5 w-32 bg-[#1F1F1F]" />
          </div>
          <Skeleton className="h-4 w-48 bg-[#1F1F1F]" />
          <Skeleton className="h-10 w-full bg-[#1F1F1F]" />
        </div>
        <div className="flex items-center gap-6">
          <Skeleton className="h-12 w-16 bg-[#1F1F1F]" />
          <Skeleton className="h-12 w-24 bg-[#1F1F1F]" />
          <div className="flex flex-col gap-2">
            <Skeleton className="h-9 w-9 bg-[#1F1F1F]" />
            <Skeleton className="h-8 w-16 bg-[#1F1F1F]" />
          </div>
        </div>
      </div>
    </Card>
  );
}

export default function Homepage() {
  const [togglingSymbols, setTogglingSymbols] = useState<Set<string>>(new Set());
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);
  
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

  const session = getIDXSessionStatus();

  return (
    <div className="flex flex-col h-screen bg-[#0B0B0B] text-[#EAEAEA]">
      {/* TOP NAVBAR */}
      <header className="sticky top-0 z-50 flex items-center justify-between px-4 h-14 bg-[#111111] border-b border-[#1F1F1F]">
        <div className="flex items-center gap-3">
          <div className="flex flex-col">
            <span className="text-xl font-mono font-bold text-[#4ADE80]">BART</span>
            <span className="text-[10px] font-mono text-[#8B8B8B] tracking-wider leading-none">BANDAR ANALYSIS & RESEARCH TERMINAL</span>
          </div>
        </div>

        <div className="hidden md:flex items-center gap-2 px-3 py-1 bg-[#1A1A1A] border border-[#1F1F1F] rounded-full">
          <div className={`w-2 h-2 rounded-full animate-pulse ${session.status === 'OPEN' ? 'bg-emerald-500' : 'bg-red-500'}`} />
          <span className={`text-[10px] font-mono font-bold uppercase ${session.color}`}>{session.label}</span>
          <span className="text-[10px] font-mono text-[#8B8B8B] ml-2">
            {currentTime.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB
          </span>
        </div>

        <div className="flex items-center gap-4">
          <SimulationToggle />
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* LEFT SCANNER SIDEBAR */}
        <aside className="hidden lg:flex flex-col w-[280px] bg-[#111111] border-r border-[#1F1F1F]">
          <div className="p-3 border-b border-[#1F1F1F] bg-[#0B0B0B]">
            <span className="text-[10px] font-mono font-bold text-[#8B8B8B] uppercase tracking-widest">STOCK SCANNER</span>
          </div>
          
          <Tabs defaultValue="siap" className="flex-1 flex flex-col overflow-hidden">
            <TabsList className="grid grid-cols-3 bg-[#111111] h-10 border-b border-[#1F1F1F] rounded-none p-0">
              <TabsTrigger value="siap" className="text-[10px] font-mono rounded-none data-[state=active]:bg-[#1A1A1A] data-[state=active]:text-[#4ADE80]">SIAP</TabsTrigger>
              <TabsTrigger value="watchlist" className="text-[10px] font-mono rounded-none data-[state=active]:bg-[#1A1A1A] data-[state=active]:text-[#FACC15]">PANTAU</TabsTrigger>
              <TabsTrigger value="hindari" className="text-[10px] font-mono rounded-none data-[state=active]:bg-[#1A1A1A] data-[state=active]:text-[#EF4444]">HINDARI</TabsTrigger>
            </TabsList>
            
            <div className="flex-1 overflow-y-auto custom-scrollbar">
              <TabsContent value="siap" className="m-0 border-none">
                {readyStocks.map(s => <ScannerRow key={s.symbol} stock={s} />)}
              </TabsContent>
              <TabsContent value="watchlist" className="m-0 border-none">
                {watchlistStocks.map(s => <ScannerRow key={s.symbol} stock={s} />)}
              </TabsContent>
              <TabsContent value="hindari" className="m-0 border-none">
                {avoidStocks.map(s => <ScannerRow key={s.symbol} stock={s} />)}
              </TabsContent>
            </div>
          </Tabs>
        </aside>

        {/* MAIN CONTENT AREA */}
        <main className="flex-1 overflow-y-auto bg-[#0B0B0B] custom-scrollbar">
          <div className="max-w-5xl mx-auto p-6">
            <div className="mb-8 border-b border-[#1F1F1F] pb-4">
              <div className="flex items-center gap-3 text-[#8B8B8B] font-mono text-xs mb-2">
                <Clock className="w-3.5 h-3.5" />
                <span>LAST UPDATED: {currentTime.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase()}</span>
                <span className="px-1.5 py-0.5 border border-[#1F1F1F] rounded text-[10px]">LIVE DATA</span>
              </div>
              <h1 className="text-3xl font-mono font-bold text-[#EAEAEA] mb-1" data-testid="text-homepage-title">
                PETA KESIAPAN SAHAM
              </h1>
              <p className="text-[#8B8B8B] text-sm" data-testid="text-homepage-subtitle">
                Analysis of market structure, smart money behavior, and institutional flow.
              </p>
            </div>

            <Tabs defaultValue="siap" className="w-full">
              <TabsList className="inline-flex w-auto h-auto p-0 bg-transparent border-b border-[#1F1F1F] rounded-none mb-6 gap-8" data-testid="tabs-homepage">
                <TabsTrigger 
                  value="siap" 
                  className="px-0 py-2 bg-transparent rounded-none border-b-2 border-transparent data-[state=active]:border-[#4ADE80] data-[state=active]:text-[#4ADE80] text-sm font-mono font-bold uppercase transition-all"
                  data-testid="tab-siap"
                >
                  SIAP DIPANTAU ({readyStocks.length})
                </TabsTrigger>
                <TabsTrigger 
                  value="watchlist" 
                  className="px-0 py-2 bg-transparent rounded-none border-b-2 border-transparent data-[state=active]:border-[#FACC15] data-[state=active]:text-[#FACC15] text-sm font-mono font-bold uppercase transition-all"
                  data-testid="tab-watchlist"
                >
                  WATCHLIST PRIORITAS ({watchlistStocks.length})
                </TabsTrigger>
                <TabsTrigger 
                  value="hindari" 
                  className="px-0 py-2 bg-transparent rounded-none border-b-2 border-transparent data-[state=active]:border-[#EF4444] data-[state=active]:text-[#EF4444] text-sm font-mono font-bold uppercase transition-all"
                  data-testid="tab-hindari"
                >
                  HINDARI DULU ({avoidStocks.length})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="siap" className="space-y-4 focus-visible:outline-none" data-testid="content-siap">
                <div className="flex items-center gap-3 p-3 bg-emerald-500/5 border border-emerald-500/20 rounded-md mb-6">
                  <Flame className="w-5 h-5 text-emerald-500" />
                  <p className="text-xs text-emerald-400 leading-relaxed font-mono">
                    SAHAM DENGAN <strong className="text-emerald-300">READINESS SCORE ≥ 80</strong> — STRUKTUR AKUMULASI MATANG DENGAN MOMENTUM KONFIRMASI.
                  </p>
                </div>
                {isLoading ? (
                  <div className="space-y-4">
                    <StockCardSkeleton />
                    <StockCardSkeleton />
                  </div>
                ) : readyStocks.length === 0 ? (
                  <div className="p-20 text-center border border-dashed border-[#1F1F1F] rounded-lg">
                    <p className="text-[#8B8B8B] font-mono text-sm">NO STOCKS CURRENTLY IN SCANNER RANGE</p>
                  </div>
                ) : (
                  <div className="grid gap-4">
                    {readyStocks.map(stock => (
                      <StockCard 
                        key={stock.symbol} 
                        stock={stock} 
                        onToggleWatchlist={handleToggleWatchlist}
                        isToggling={togglingSymbols.has(stock.symbol)}
                      />
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="watchlist" className="space-y-4 focus-visible:outline-none" data-testid="content-watchlist">
                <div className="flex items-center gap-3 p-3 bg-amber-500/5 border border-amber-500/20 rounded-md mb-6">
                  <Eye className="w-5 h-5 text-amber-500" />
                  <p className="text-xs text-amber-400 leading-relaxed font-mono">
                    SAHAM DENGAN <strong className="text-amber-300">READINESS SCORE 60-79</strong> — SEDANG DALAM TAHAP PERSIAPAN STRUKTUR, AWASI BREAKOUT.
                  </p>
                </div>
                {isLoading ? (
                  <div className="space-y-4">
                    <StockCardSkeleton />
                    <StockCardSkeleton />
                  </div>
                ) : watchlistStocks.length === 0 ? (
                  <div className="p-20 text-center border border-dashed border-[#1F1F1F] rounded-lg">
                    <p className="text-[#8B8B8B] font-mono text-sm">NO STOCKS CURRENTLY IN WATCHLIST RANGE</p>
                  </div>
                ) : (
                  <div className="grid gap-4">
                    {watchlistStocks.map(stock => (
                      <StockCard 
                        key={stock.symbol} 
                        stock={stock} 
                        onToggleWatchlist={handleToggleWatchlist}
                        isToggling={togglingSymbols.has(stock.symbol)}
                      />
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="hindari" className="space-y-4 focus-visible:outline-none" data-testid="content-hindari">
                <div className="flex items-center gap-3 p-3 bg-red-500/5 border border-red-500/20 rounded-md mb-6">
                  <AlertTriangle className="w-5 h-5 text-red-500" />
                  <p className="text-xs text-red-400 leading-relaxed font-mono">
                    SAHAM DENGAN <strong className="text-red-300">READINESS SCORE &lt; 60</strong> — RISIKO DISTRIBUSI TINGGI, STRUKTUR PASAR BELUM MENDUKUNG.
                  </p>
                </div>
                {isLoading ? (
                  <div className="space-y-4">
                    <StockCardSkeleton />
                    <StockCardSkeleton />
                  </div>
                ) : avoidStocks.length === 0 ? (
                  <div className="p-20 text-center border border-dashed border-[#1F1F1F] rounded-lg">
                    <p className="text-[#8B8B8B] font-mono text-sm">NO STOCKS CURRENTLY IN AVOIDANCE RANGE</p>
                  </div>
                ) : (
                  <div className="grid gap-4">
                    {avoidStocks.map(stock => (
                      <StockCard 
                        key={stock.symbol} 
                        stock={stock} 
                        onToggleWatchlist={handleToggleWatchlist}
                        isToggling={togglingSymbols.has(stock.symbol)}
                      />
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
        </main>
      </div>
    </div>
  );
}
