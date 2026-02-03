import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { 
  TrendingUp, 
  TrendingDown, 
  Eye, 
  AlertTriangle, 
  Star,
  StarOff,
  Flame,
  ArrowRight
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
  actionColor: "green" | "yellow" | "red";
  aiSentence: string;
  isInWatchlist: boolean;
}

function StockCard({ stock, onToggleWatchlist, isToggling }: { stock: StockCardData; onToggleWatchlist: (symbol: string, isAdding: boolean) => void; isToggling: boolean }) {
  const isPositive = parseFloat(stock.change) >= 0;
  
  const colorClasses = {
    green: "border-l-emerald-500 bg-emerald-500/5",
    yellow: "border-l-amber-500 bg-amber-500/5",
    red: "border-l-red-500 bg-red-500/5",
  };

  const badgeVariants = {
    green: "bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
    yellow: "bg-amber-500/20 text-amber-700 dark:text-amber-400 border-amber-500/30",
    red: "bg-red-500/20 text-red-700 dark:text-red-400 border-red-500/30",
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      <Card 
        className={`p-4 border-l-4 ${colorClasses[stock.actionColor]} hover-elevate transition-all`}
        data-testid={`card-stock-${stock.symbol}`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Link href={`/stock/${stock.symbol}`}>
                <span 
                  className="text-lg font-bold text-foreground hover:text-primary transition-colors cursor-pointer"
                  data-testid={`link-stock-${stock.symbol}`}
                >
                  {stock.symbol}
                </span>
              </Link>
              <Badge 
                variant="outline" 
                className={`text-xs ${badgeVariants[stock.actionColor]}`}
                data-testid={`badge-score-${stock.symbol}`}
              >
                {stock.readinessScore}/100
              </Badge>
              {stock.isInWatchlist && (
                <Badge variant="outline" className="text-xs bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30">
                  Watchlist
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground truncate mb-2">{stock.name}</p>
            
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm font-medium">{parseInt(stock.price).toLocaleString('id-ID')}</span>
              <span className={`text-xs flex items-center gap-0.5 ${isPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                {stock.changePercent}%
              </span>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="secondary" className="text-xs">
                  {stock.marketRegime}
                </Badge>
                <Badge 
                  variant="outline" 
                  className={`text-xs font-medium ${badgeVariants[stock.actionColor]}`}
                  data-testid={`badge-action-${stock.symbol}`}
                >
                  {stock.actionGuidance}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground italic" data-testid={`text-ai-${stock.symbol}`}>
                {stock.aiSentence}
              </p>
            </div>
          </div>

          <div className="flex flex-col items-end gap-2">
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              disabled={isToggling}
              onClick={() => onToggleWatchlist(stock.symbol, !stock.isInWatchlist)}
              data-testid={`button-watchlist-${stock.symbol}`}
            >
              {stock.isInWatchlist ? (
                <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
              ) : (
                <StarOff className="w-4 h-4 text-muted-foreground" />
              )}
            </Button>
            <Link href={`/stock/${stock.symbol}`}>
              <Button size="sm" variant="outline" className="text-xs gap-1" data-testid={`button-detail-${stock.symbol}`}>
                Detail
                <ArrowRight className="w-3 h-3" />
              </Button>
            </Link>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}

function StockCardSkeleton() {
  return (
    <Card className="p-4 border-l-4 border-l-muted">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-16" />
            <Skeleton className="h-5 w-12" />
          </div>
          <Skeleton className="h-4 w-48" />
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-12" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-5 w-32" />
          </div>
          <Skeleton className="h-3 w-full" />
        </div>
        <div className="flex flex-col gap-2">
          <Skeleton className="h-8 w-8 rounded-md" />
          <Skeleton className="h-8 w-16 rounded-md" />
        </div>
      </div>
    </Card>
  );
}

export default function Homepage() {
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

  const readyStocks = stocks?.filter(s => s.readinessScore >= 80) || [];
  const watchlistStocks = stocks?.filter(s => s.readinessScore >= 60 && s.readinessScore < 80) || [];
  const avoidStocks = stocks?.filter(s => s.readinessScore < 60) || [];

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <header className="mb-8">
          <h1 className="text-2xl font-bold text-foreground mb-2" data-testid="text-homepage-title">
            Peta Kesiapan Saham Hari Ini
          </h1>
          <p className="text-sm text-muted-foreground" data-testid="text-homepage-subtitle">
            Disusun berdasarkan perilaku bandar, struktur pasar, dan risiko distribusi.
            <br />
            <span className="italic">Bukan sinyal, melainkan panduan kesiapan.</span>
          </p>
        </header>

        <Tabs defaultValue="siap" className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-6" data-testid="tabs-homepage">
            <TabsTrigger value="siap" className="gap-1.5" data-testid="tab-siap">
              <Flame className="w-4 h-4 text-emerald-500" />
              <span className="hidden sm:inline">Siap Dipantau</span>
              <span className="sm:hidden">Siap</span>
              <Badge variant="secondary" className="ml-1 text-xs">
                {readyStocks.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="watchlist" className="gap-1.5" data-testid="tab-watchlist">
              <Eye className="w-4 h-4 text-amber-500" />
              <span className="hidden sm:inline">Watchlist Prioritas</span>
              <span className="sm:hidden">Pantau</span>
              <Badge variant="secondary" className="ml-1 text-xs">
                {watchlistStocks.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="hindari" className="gap-1.5" data-testid="tab-hindari">
              <AlertTriangle className="w-4 h-4 text-red-500" />
              <span className="hidden sm:inline">Hindari Dulu</span>
              <span className="sm:hidden">Hindari</span>
              <Badge variant="secondary" className="ml-1 text-xs">
                {avoidStocks.length}
              </Badge>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="siap" className="space-y-4" data-testid="content-siap">
            <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 mb-4">
              <p className="text-sm text-emerald-700 dark:text-emerald-400">
                <Flame className="w-4 h-4 inline mr-1" />
                Saham dengan <strong>Smart Money Readiness Score ≥ 80</strong> — struktur siap dengan momentum yang mulai selaras.
              </p>
            </div>
            {isLoading ? (
              <div className="space-y-4">
                <StockCardSkeleton />
                <StockCardSkeleton />
              </div>
            ) : readyStocks.length === 0 ? (
              <Card className="p-8 text-center">
                <p className="text-muted-foreground">Tidak ada saham dalam kategori ini saat ini.</p>
              </Card>
            ) : (
              readyStocks.map(stock => (
                <StockCard 
                  key={stock.symbol} 
                  stock={stock} 
                  onToggleWatchlist={handleToggleWatchlist}
                  isToggling={togglingSymbols.has(stock.symbol)}
                />
              ))
            )}
          </TabsContent>

          <TabsContent value="watchlist" className="space-y-4" data-testid="content-watchlist">
            <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 mb-4">
              <p className="text-sm text-amber-700 dark:text-amber-400">
                <Eye className="w-4 h-4 inline mr-1" />
                Saham dengan <strong>Readiness Score 60-79</strong> — sedang dipersiapkan, tapi belum waktunya masuk.
              </p>
            </div>
            {isLoading ? (
              <div className="space-y-4">
                <StockCardSkeleton />
                <StockCardSkeleton />
              </div>
            ) : watchlistStocks.length === 0 ? (
              <Card className="p-8 text-center">
                <p className="text-muted-foreground">Tidak ada saham dalam kategori ini saat ini.</p>
              </Card>
            ) : (
              watchlistStocks.map(stock => (
                <StockCard 
                  key={stock.symbol} 
                  stock={stock} 
                  onToggleWatchlist={handleToggleWatchlist}
                  isToggling={togglingSymbols.has(stock.symbol)}
                />
              ))
            )}
          </TabsContent>

          <TabsContent value="hindari" className="space-y-4" data-testid="content-hindari">
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 mb-4">
              <p className="text-sm text-red-700 dark:text-red-400">
                <AlertTriangle className="w-4 h-4 inline mr-1" />
                Saham dengan <strong>Readiness Score &lt; 60</strong> — risiko tinggi, hindari entry baru.
              </p>
            </div>
            {isLoading ? (
              <div className="space-y-4">
                <StockCardSkeleton />
                <StockCardSkeleton />
              </div>
            ) : avoidStocks.length === 0 ? (
              <Card className="p-8 text-center">
                <p className="text-muted-foreground">Tidak ada saham dalam kategori ini saat ini.</p>
              </Card>
            ) : (
              avoidStocks.map(stock => (
                <StockCard 
                  key={stock.symbol} 
                  stock={stock} 
                  onToggleWatchlist={handleToggleWatchlist}
                  isToggling={togglingSymbols.has(stock.symbol)}
                />
              ))
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
