import { useState, useEffect, type ReactNode } from "react";
import { Switch, Route, Link, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Menu, Loader2 } from "lucide-react";
import NotFound from "@/pages/not-found";
import LandingPage from "@/pages/LandingPage";
import AuthPage from "@/pages/AuthPage";
import Homepage from "@/pages/Homepage";
import StockDashboard from "@/pages/StockDashboard";
import RadarPage from "@/pages/RadarPage";
import WatchlistPage from "@/pages/WatchlistPage";
import ScreenerPage from "@/pages/ScreenerPage";
import PasarPage from "@/pages/PasarPage";
import BeritaPage from "@/pages/BeritaPage";
import TemaPasarPage from "@/pages/TemaPasarPage";
import AdminConfigPage from "@/pages/AdminConfigPage";
import AdminSeed from "@/pages/AdminSeed";
import AdminUsersPage from "@/pages/AdminUsersPage";
import { SimulationProvider } from "@/contexts/SimulationContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { AuthProvider, useAuth, getAuthToken } from "@/contexts/AuthContext";
import { SimulationBanner } from "@/components/SimulationBanner";
import { Sidebar } from "@/components/Sidebar";
import { PendingLockScreen } from "@/components/PendingLockScreen";

// Routes below are RELATIVE — the whole block is mounted under /dashboard via
// the nested Route in AppRouter, so "/radar" here means "/dashboard/radar".
function DashboardRouter() {
  const { user } = useAuth();
  return (
    <Switch>
      <Route path="/" component={Homepage} />
      <Route path="/stock/:symbol" component={StockDashboard} />
      <Route path="/radar" component={RadarPage} />
      <Route path="/watchlist" component={WatchlistPage} />
      <Route path="/screener" component={ScreenerPage} />
      <Route path="/pasar" component={PasarPage} />
      <Route path="/berita" component={BeritaPage} />
      <Route path="/tema" component={TemaPasarPage} />
      {user?.role === "admin" && <Route path="/admin/users" component={AdminUsersPage} />}
      {user?.role === "admin" && <Route path="/admin/config" component={AdminConfigPage} />}
      {user?.role === "admin" && <Route path="/admin/seed" component={AdminSeed} />}
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
  const { isUnlocked } = useAuth();

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
        {isUnlocked ? <DashboardRouter /> : <PendingLockScreen />}
      </main>
    </div>
  );
}

// Gate for everything under /dashboard: unauthenticated visitors go to /login;
// authenticated-but-PENDING users get the locked layout (handled in AppLayout).
function DashboardGate() {
  const { user, loading } = useAuth();

  // `user` can lag one render behind navigation right after login (the wouter
  // location store updates synchronously, before React flushes context state),
  // so treat "token present but user not loaded yet" as loading — never bounce
  // a fresh login back to /login.
  if (loading || (!user && getAuthToken())) {
    return (
      <div style={{
        minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
        background: "var(--surface-0)",
      }}>
        <Loader2 size={22} className="animate-spin" style={{ color: "var(--signal)" }} />
      </div>
    );
  }
  if (!user) return <Redirect to="~/login" />;
  return <AppLayout />;
}

function AppRouter() {
  return (
    <Switch>
      <Route path="/" component={LandingPage} />
      <Route path="/login">
        <AuthPage mode="login" />
      </Route>
      <Route path="/register">
        <AuthPage mode="register" />
      </Route>
      <Route path="/dashboard" nest>
        <DashboardGate />
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <TooltipProvider>
            <SimulationProvider>
              <SimulationBanner />
              <Toaster />
              <AppRouter />
            </SimulationProvider>
          </TooltipProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
