import { ArrowUp, ArrowDown } from "lucide-react";
import { StockResponse } from "@shared/routes";

interface StockHeaderProps {
  stock: StockResponse;
}

export function StockHeader({ stock }: StockHeaderProps) {
  const isPositive = parseFloat(stock.change) >= 0;
  const ChangeIcon = isPositive ? ArrowUp : ArrowDown;
  const changeColorClass = isPositive ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400";
  const bgColorClass = isPositive ? "bg-emerald-100/50 dark:bg-emerald-900/20" : "bg-rose-100/50 dark:bg-rose-900/20";

  return (
    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6 pb-6 border-b border-border/50">
      <div className="flex items-start gap-4">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center text-primary font-bold text-2xl shadow-sm border border-primary/20">
          {stock.symbol.substring(0, 1)}
        </div>
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground">
              {stock.symbol}
            </h1>
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium uppercase tracking-wider ${bgColorClass} ${changeColorClass}`}>
              NYSE
            </span>
          </div>
          <p className="text-lg text-muted-foreground font-medium mt-1">
            {stock.name}
          </p>
        </div>
      </div>

      <div className="flex flex-col md:items-end">
        <div className="flex items-baseline gap-3">
          <span className="text-4xl md:text-5xl font-mono font-bold tracking-tighter tabular-nums">
            ${parseFloat(stock.price).toFixed(2)}
          </span>
        </div>
        <div className={`flex items-center gap-2 mt-2 font-mono font-medium ${changeColorClass}`}>
          <ChangeIcon className="w-5 h-5" />
          <span className="text-lg tabular-nums">
            {isPositive ? "+" : ""}{parseFloat(stock.change).toFixed(2)}
          </span>
          <span className={`px-2 py-1 rounded-md text-sm ${bgColorClass}`}>
            {isPositive ? "+" : ""}{parseFloat(stock.changePercent).toFixed(2)}%
          </span>
        </div>
        <p className="text-xs text-muted-foreground mt-2 font-medium uppercase tracking-widest">
          Market Open • Delayed 15m
        </p>
      </div>
    </div>
  );
}
