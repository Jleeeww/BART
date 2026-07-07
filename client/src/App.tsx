import { useState, useEffect } from "react";
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
import PasarPage from "@/pages/PasarPage";
import BeritaPage from "@/pages/BeritaPage";
import AdminSeed from "@/pages/AdminSeed";
import { SimulationProvider } from "@/contexts/SimulationContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
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
      <Route path="/pasar" component={PasarPage} />
      <Route path="/berita" component={BeritaPage} />
      <Route path="/admin/seed" component={AdminSeed} />
      <Route component={NotFound} />
    </Switch>
  );
}

function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia(query).matches : false
  );
  useEffect(() => {
    const mql = window.matchMedia(query);
    setMatches(mql.matches);
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, [query]);
  return matches;
}

function AppLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const mainMargin = isDesktop ? (collapsed ? 56 : 200) : 0;

  return (
    <div className="flex min-h-screen" style={{ background: "var(--surface-0)" }}>
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />
      <div
        className="md:hidden fixed top-0 left-0 right-0 z-50 h-12 flex items-center justify-between px-4 border-b"
        style={{ background: "var(--surface-1)", borderColor: "var(--border-2)" }}
        data-testid="mobile-top-bar"
      >
        <Link href="/">
          <span
            className="text-base font-bold cursor-pointer"
            style={{ fontFamily: "'IBM Plex Mono', monospace", color: "var(--signal)" }}
          >
            BART
          </span>
        </Link>
        <button style={{ color: "var(--text-3)" }} data-testid="mobile-menu-button">
          <Menu size={20} />
        </button>
      </div>
      <main
        className="flex-1 min-h-screen overflow-auto transition-all duration-200"
        style={{ marginLeft: mainMargin, paddingTop: isDesktop ? 0 : 48 }}
      >
        <Router />
      </main>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TooltipProvider>
          <SimulationProvider>
            <SimulationBanner />
            <Toaster />
            <AppLayout />
          </SimulationProvider>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
