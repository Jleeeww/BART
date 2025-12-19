import { Sparkles } from "lucide-react";

interface AIStockSummaryProps {
  summary: string;
}

export function AIStockSummary({ summary }: AIStockSummaryProps) {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-950/30 dark:to-purple-950/30 border border-indigo-100 dark:border-indigo-900/50 p-6 shadow-sm">
      <div className="absolute top-0 right-0 p-3 opacity-10">
        <Sparkles className="w-24 h-24 text-indigo-600" />
      </div>
      
      <div className="relative z-10">
        <div className="flex items-center gap-2 mb-3">
          <div className="p-1.5 rounded-lg bg-indigo-600 text-white shadow-indigo-200 dark:shadow-none shadow-lg">
            <Sparkles className="w-4 h-4" />
          </div>
          <h3 className="font-display font-bold text-indigo-900 dark:text-indigo-100 text-lg">
            AI Summary
          </h3>
        </div>
        
        <p className="text-indigo-900/80 dark:text-indigo-200/80 leading-relaxed text-sm md:text-base">
          {summary}
        </p>
      </div>
    </div>
  );
}
