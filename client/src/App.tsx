import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Homepage from "@/pages/Homepage";
import StockDashboard from "@/pages/StockDashboard";
import { SimulationProvider } from "@/contexts/SimulationContext";
import { SimulationBanner } from "@/components/SimulationBanner";

function Router() {
  return (
    <Switch>
      {/* Homepage with readiness market map */}
      <Route path="/" component={Homepage} />
      {/* Stock detail page */}
      <Route path="/stock/:symbol" component={StockDashboard} />
      {/* Fallback to 404 */}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <SimulationProvider>
          <SimulationBanner />
          <Toaster />
          <Router />
        </SimulationProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
