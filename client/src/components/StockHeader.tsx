import { ArrowUp, ArrowDown, Package } from "lucide-react";
import { StockResponse } from "@shared/routes";
import { Badge } from "@/components/ui/badge";

interface StockHeaderProps {
  stock: StockResponse;
}

export function StockHeader({ stock }: StockHeaderProps) {
  const isPositive = parseFloat(stock.change) >= 0;
  const ChangeIcon = isPositive ? ArrowUp : ArrowDown;
  const changeColorClass = isPositive ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400";
  const bgColorClass = isPositive ? "bg-emerald-100/50 dark:bg-emerald-900/20" : "bg-rose-100/50 dark:bg-rose-900/20";

  // Parse IDX indices and stock tags
  const idxIndices: string[] = stock.idxIndices ? JSON.parse(stock.idxIndices) : [];
  const stockTags: string[] = stock.stockTags ? JSON.parse(stock.stockTags) : [];
  
  // Calculate lot value (1 lot = 100 shares)
  const priceNum = parseInt(stock.price);
  const lotValue = priceNum * 100;

  return (
    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6 pb-6 border-b border-border/50">
      <div className="flex items-start gap-4">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center text-primary font-bold text-2xl shadow-sm border border-primary/20">
          {stock.symbol.substring(0, 1)}
        </div>
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground" data-testid="text-stock-symbol">
              {stock.symbol}
            </h1>
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium uppercase tracking-wider ${bgColorClass} ${changeColorClass}`}>
              IDX
            </span>
          </div>
          <p className="text-lg text-muted-foreground font-medium mt-1" data-testid="text-stock-name">
            {stock.name}
          </p>
          {/* IDX Index Tags and Stock Tags */}
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            {idxIndices.map((index) => (
              <Badge key={index} variant="secondary" className="text-[10px] font-bold uppercase tracking-wider" data-testid={`badge-index-${index}`}>
                {index}
              </Badge>
            ))}
            {stock.sectorBadge && (
              <Badge variant="outline" className="text-[10px] font-bold uppercase tracking-wider bg-primary/5 border-primary/20 text-primary" data-testid="badge-sector">
                {stock.sectorBadge}
              </Badge>
            )}
            {stockTags.map((tag) => (
              <Badge key={tag} variant="outline" className="text-[10px] font-medium" data-testid={`badge-tag-${tag}`}>
                {tag}
              </Badge>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-col md:items-end">
        <div className="flex items-baseline gap-3">
          <span className="text-4xl md:text-5xl font-mono font-bold tracking-tighter tabular-nums" data-testid="text-stock-price">
            IDR {priceNum.toLocaleString('id-ID')}
          </span>
        </div>
        <div className={`flex items-center gap-2 mt-2 font-mono font-medium ${changeColorClass}`}>
          <ChangeIcon className="w-5 h-5" />
          <span className="text-lg tabular-nums" data-testid="text-price-change">
            {isPositive ? "+" : ""}{parseFloat(stock.change).toFixed(2)}
          </span>
          <span className={`px-2 py-1 rounded-md text-sm ${bgColorClass}`} data-testid="text-price-change-percent">
            {isPositive ? "+" : ""}{parseFloat(stock.changePercent).toFixed(2)}%
          </span>
        </div>
        {/* Lot Size Context */}
        <div className="flex items-center gap-2 mt-3 text-xs text-muted-foreground" data-testid="text-lot-info">
          <Package className="w-3.5 h-3.5" />
          <span className="font-medium">1 Lot = 100 Saham</span>
          <span className="text-foreground font-semibold">≈ IDR {lotValue.toLocaleString('id-ID')}</span>
        </div>
      </div>
    </div>
  );
}
