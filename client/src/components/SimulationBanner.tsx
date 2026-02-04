import { useSimulation } from "@/contexts/SimulationContext";
import { AlertTriangle, PlayCircle, CheckCircle, XCircle, Loader2, Database, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export function SimulationBanner() {
  const { state, runSimulation, isRunningSimulation, auditSummary, lastSimulationError } = useSimulation();

  if (!state.isSimulationMode) {
    return null;
  }

  const extendedSummary = auditSummary as {
    passCount?: number;
    failCount?: number;
    totalStocks?: number;
    stockUniverse?: { blueChips: string[]; speculative: string[] };
    behaviorFailures?: number;
  } | null;

  return (
    <div 
      className="w-full bg-amber-100 dark:bg-amber-900/30 border-b border-amber-300 dark:border-amber-700 py-2 px-4"
      data-testid="banner-simulation-mode"
    >
      <div className="max-w-7xl mx-auto flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            <span className="text-sm font-medium text-amber-800 dark:text-amber-200">
              Mode Simulasi Aktif – Data T-1 ({state.replayDate})
            </span>
            <Badge variant="outline" className="text-xs bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 border-blue-400">
              <Database className="w-3 h-3 mr-1" />
              Real Market Data
            </Badge>
          </div>
          
          <div className="flex items-center gap-3">
            <Button
              size="sm"
              variant="outline"
              className="bg-amber-50 dark:bg-amber-900/50 border-amber-400 text-amber-700 dark:text-amber-300"
              onClick={() => runSimulation()}
              disabled={isRunningSimulation}
              data-testid="button-run-simulation"
            >
              {isRunningSimulation ? (
                <>
                  <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                  Validasi 12 Saham...
                </>
              ) : (
                <>
                  <PlayCircle className="w-4 h-4 mr-1" />
                  Jalankan Validasi
                </>
              )}
            </Button>
            
            {extendedSummary && (
              <div className="flex items-center gap-2">
                {extendedSummary.failCount === 0 ? (
                  <Badge variant="outline" className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300 border-emerald-400">
                    <CheckCircle className="w-3 h-3 mr-1" />
                    {extendedSummary.passCount}/{extendedSummary.totalStocks} PASS
                  </Badge>
                ) : (
                  <Badge variant="destructive" className="animate-pulse">
                    <XCircle className="w-3 h-3 mr-1" />
                    {extendedSummary.failCount} FAIL
                  </Badge>
                )}
              </div>
            )}
            
            {lastSimulationError && (
              <span className="text-xs text-red-600 dark:text-red-400">
                Error: {lastSimulationError}
              </span>
            )}
          </div>
        </div>
        
        {extendedSummary?.stockUniverse && (
          <div className="flex flex-wrap items-center gap-2 text-xs text-amber-700 dark:text-amber-300">
            <span className="flex items-center gap-1">
              <TrendingUp className="w-3 h-3" />
              Blue Chips:
            </span>
            {extendedSummary.stockUniverse.blueChips.map(s => (
              <Badge key={s} variant="outline" className="text-xs py-0 px-1 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300">
                {s}
              </Badge>
            ))}
            <span className="mx-2 text-amber-500">|</span>
            <span>Spekulatif:</span>
            {extendedSummary.stockUniverse.speculative.map(s => (
              <Badge key={s} variant="outline" className="text-xs py-0 px-1 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300">
                {s}
              </Badge>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
