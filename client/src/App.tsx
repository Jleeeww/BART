import { Switch, Route, Link } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Menu } from "lucide-react";
import NotFound from "@/pages/not-found";
import Homepage from "@/pages/Homepage";
import StockDashboard from "@/pages/StockDashboard";
import RadarPage from "@/pages/RadarPage";
import WatchlistPage from "@/pages/WatchlistPage";
import ScreenerPage from "@/pages/ScreenerPage";
import { SimulationProvider } from "@/contexts/SimulationContext";
import { SimulationBanner } from "@/components/SimulationBanner";
import { Sidebar } from "@/components/Sidebar";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Homepage} />
      <Route path="/stock/:symbol" component={StockDashboard} />
      <Route path="/radar" component={RadarPage} />
      <Route path="/watchlist" component={WatchlistPage} />
      <Route path="/screener" component={ScreenerPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function AppLayout() {
  return (
    <div className="flex min-h-screen" style={{ background: "#0f0f0f" }}>
      <Sidebar />
      <div
        className="md:hidden fixed top-0 left-0 right-0 z-50 h-12 bg-[#0a0a0a] border-b border-[#ffffff08] flex items-center justify-between px-4"
        data-testid="mobile-top-bar"
      >
        <Link href="/">
          <span
            className="text-base font-bold cursor-pointer"
            style={{ fontFamily: "'IBM Plex Mono', monospace", color: "#38BDF8" }}
          >
            BART
          </span>
        </Link>
        <button className="text-[#6b7280]" data-testid="mobile-menu-button">
          <Menu size={20} />
        </button>
      </div>
      <main className="flex-1 ml-0 md:ml-[200px] min-h-screen overflow-auto pt-12 md:pt-0">
        <Router />
      </main>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <SimulationProvider>
          <SimulationBanner />
          <Toaster />
          <AppLayout />
        </SimulationProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
