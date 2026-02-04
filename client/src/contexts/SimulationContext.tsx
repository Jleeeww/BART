import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface SimulationState {
  isSimulationMode: boolean;
  replayDate: string; // YYYY-MM-DD
  dataSource: "LIVE" | "REPLAY";
}

interface SimulationAuditSummary {
  runId: string;
  replayDate: string;
  totalStocks: number;
  passCount: number;
  failCount: number;
  consistencyFailures: number;
  safetyFailures: number;
  uxSanityFailures: number;
  details: SimulationAuditDetail[];
}

interface SimulationAuditDetail {
  symbol: string;
  readinessScore: number;
  marketRegime: string;
  actionGuidanceState: string;
  actionGuidanceLabel: string;
  homepageBucket: string;
  isGorengan: boolean;
  consistencyCheck: "PASS" | "FAIL";
  safetyCheck: "PASS" | "FAIL";
  uxSanityCheck: "PASS" | "FAIL";
  overallResult: "PASS" | "FAIL";
  failureReasons: string[];
}

interface SimulationContextValue {
  state: SimulationState;
  toggleSimulationMode: () => void;
  setReplayDate: (date: string) => void;
  runSimulation: () => Promise<void>;
  auditSummary: SimulationAuditSummary | null;
  isRunningSimulation: boolean;
  lastSimulationError: string | null;
}

const SimulationContext = createContext<SimulationContextValue | null>(null);

function getYesterdayDate(): string {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return yesterday.toISOString().split("T")[0];
}

export function SimulationProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  
  const [state, setState] = useState<SimulationState>({
    isSimulationMode: false,
    replayDate: getYesterdayDate(),
    dataSource: "LIVE",
  });
  
  const [auditSummary, setAuditSummary] = useState<SimulationAuditSummary | null>(null);
  const [lastSimulationError, setLastSimulationError] = useState<string | null>(null);

  const simulationMutation = useMutation({
    mutationFn: async (date: string) => {
      const response = await apiRequest("POST", "/api/simulation/run", { replayDate: date });
      return response.json();
    },
    onSuccess: (data) => {
      setAuditSummary(data);
      setLastSimulationError(null);
      queryClient.invalidateQueries({ queryKey: ["/api/stocks"] });
    },
    onError: (error: Error) => {
      setLastSimulationError(error.message);
    },
  });

  const toggleSimulationMode = useCallback(() => {
    setState((prev) => {
      const newMode = !prev.isSimulationMode;
      return {
        ...prev,
        isSimulationMode: newMode,
        dataSource: newMode ? "REPLAY" : "LIVE",
      };
    });
    queryClient.invalidateQueries({ queryKey: ["/api/stocks"] });
  }, [queryClient]);

  const setReplayDate = useCallback((date: string) => {
    setState((prev) => ({ ...prev, replayDate: date }));
  }, []);

  const runSimulation = useCallback(async () => {
    await simulationMutation.mutateAsync(state.replayDate);
  }, [simulationMutation, state.replayDate]);

  return (
    <SimulationContext.Provider
      value={{
        state,
        toggleSimulationMode,
        setReplayDate,
        runSimulation,
        auditSummary,
        isRunningSimulation: simulationMutation.isPending,
        lastSimulationError,
      }}
    >
      {children}
    </SimulationContext.Provider>
  );
}

export function useSimulation() {
  const context = useContext(SimulationContext);
  if (!context) {
    throw new Error("useSimulation must be used within a SimulationProvider");
  }
  return context;
}
