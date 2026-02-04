import { useSimulation } from "@/contexts/SimulationContext";
import { AlertTriangle, PlayCircle, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export function SimulationBanner() {
  const { state, runSimulation, isRunningSimulation, auditSummary, lastSimulationError } = useSimulation();

  if (!state.isSimulationMode) {
    return null;
  }

  return (
    <div 
      className="w-full bg-amber-100 dark:bg-amber-900/30 border-b border-amber-300 dark:border-amber-700 py-2 px-4"
      data-testid="banner-simulation-mode"
    >
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          <span className="text-sm font-medium text-amber-800 dark:text-amber-200">
            Mode Simulasi Aktif – Menggunakan data historis ({state.replayDate})
          </span>
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
                Menjalankan...
              </>
            ) : (
              <>
                <PlayCircle className="w-4 h-4 mr-1" />
                Jalankan Validasi
              </>
            )}
          </Button>
          
          {auditSummary && (
            <div className="flex items-center gap-2">
              {auditSummary.failCount === 0 ? (
                <Badge variant="outline" className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300 border-emerald-400">
                  <CheckCircle className="w-3 h-3 mr-1" />
                  {auditSummary.passCount}/{auditSummary.totalStocks} PASS
                </Badge>
              ) : (
                <Badge variant="destructive" className="animate-pulse">
                  <XCircle className="w-3 h-3 mr-1" />
                  {auditSummary.failCount} FAIL
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
    </div>
  );
}
