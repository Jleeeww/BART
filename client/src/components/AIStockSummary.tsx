import { Sparkles } from "lucide-react";

interface AIStockSummaryProps {
  summary: string;
  confidence?: "High" | "Medium" | "Low";
}

export function AIStockSummary({ summary, confidence = "High" }: AIStockSummaryProps) {
  const confidenceColor = {
    High: "bg-emerald-100/50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
    Medium: "bg-amber-100/50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
    Low: "bg-rose-100/50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300",
  };

  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-950/30 dark:to-purple-950/30 border border-indigo-100 dark:border-indigo-900/50 p-6 shadow-sm">
      <div className="absolute top-0 right-0 p-3 opacity-10">
        <Sparkles className="w-24 h-24 text-indigo-600" />
      </div>
      
      <div className="relative z-10">
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-indigo-600 text-white shadow-indigo-200 dark:shadow-none shadow-lg">
              <Sparkles className="w-4 h-4" />
            </div>
            <h3 className="font-display font-bold text-indigo-900 dark:text-indigo-100 text-lg">
              AI Summary
            </h3>
          </div>
          <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider ${confidenceColor[confidence]}`}>
            {confidence}
          </span>
        </div>
        
        <p className="text-indigo-900/80 dark:text-indigo-200/80 leading-relaxed text-sm md:text-base">
          {summary}
        </p>
      </div>
    </div>
  );
}
