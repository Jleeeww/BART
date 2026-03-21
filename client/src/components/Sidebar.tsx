import { Link, useLocation } from "wouter";
import {
  LayoutGrid,
  Radio,
  Star,
  SlidersHorizontal,
  BarChart2,
  Settings,
} from "lucide-react";

const navItems = [
  { icon: LayoutGrid, label: "Peta Kesiapan", route: "/", exact: true },
  { icon: Radio, label: "Radar", route: "/radar" },
  { icon: Star, label: "Watchlist", route: "/watchlist", locked: true },
  { icon: SlidersHorizontal, label: "Screener", route: "/screener", locked: true },
  { icon: BarChart2, label: "Pasar", route: "/pasar", locked: true },
  { icon: Settings, label: "Pengaturan", route: "/pengaturan", locked: true },
] as const;

export function Sidebar() {
  const [location] = useLocation();

  function isActive(route: string, exact?: boolean) {
    if (exact) {
      return location === route || location.startsWith("/stock/");
    }
    return location.startsWith(route);
  }

  return (
    <aside
      className="hidden md:flex flex-col fixed left-0 top-0 h-screen z-50"
      style={{
        width: 200,
        background: "#0a0a0a",
        borderRight: "1px solid rgba(255,255,255,0.03)",
      }}
    >
      <Link href="/">
        <div
          className="flex items-center px-4 cursor-pointer"
          style={{ height: 48, borderBottom: "1px solid rgba(255,255,255,0.03)" }}
        >
          <span
            className="font-bold text-base tracking-wider"
            style={{ fontFamily: "'IBM Plex Mono', monospace", color: "#38BDF8" }}
          >
            BART
          </span>
        </div>
      </Link>

      <nav className="flex-1 py-4">
        {navItems.map((item) => {
          const Icon = item.icon;
          const locked = "locked" in item && item.locked;
          const active = !locked && isActive(item.route, "exact" in item && item.exact);

          if (locked) {
            return (
              <div
                key={item.route}
                className="flex items-center gap-3 px-4 py-2.5 mx-2 rounded-md cursor-not-allowed"
                style={{ color: "rgba(255,255,255,0.12)" }}
              >
                <Icon className="w-4 h-4" />
                <span
                  className="text-sm flex-1"
                  style={{ fontFamily: "'IBM Plex Mono', monospace" }}
                >
                  {item.label}
                </span>
                <span
                  className="px-1.5 rounded-sm"
                  style={{
                    fontFamily: "'IBM Plex Mono', monospace",
                    fontSize: 9,
                    background: "rgba(255,255,255,0.02)",
                    color: "rgba(255,255,255,0.12)",
                  }}
                >
                  Segera
                </span>
              </div>
            );
          }

          return (
            <Link key={item.route} href={item.route}>
              <div
                className={`flex items-center gap-3 px-4 py-2.5 mx-2 rounded-md transition-all duration-150 cursor-pointer ${
                  active
                    ? "text-[#38BDF8]"
                    : "text-[#6b7280] hover:text-white hover:bg-[#ffffff06]"
                }`}
                style={
                  active
                    ? {
                        background: "rgba(56,189,248,0.1)",
                        borderLeft: "2px solid #38BDF8",
                      }
                    : {}
                }
              >
                <Icon className="w-4 h-4" />
                <span
                  className="text-sm"
                  style={{ fontFamily: "'IBM Plex Mono', monospace" }}
                >
                  {item.label}
                </span>
              </div>
            </Link>
          );
        })}
      </nav>

      <div
        className="p-4"
        style={{ borderTop: "1px solid rgba(255,255,255,0.03)" }}
      >
        <p
          className="tracking-wide"
          style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: 9,
            color: "rgba(255,255,255,0.12)",
          }}
        >
          PT Berkat Digital Investasi
        </p>
        <p
          className="tracking-wide mt-0.5"
          style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: 9,
            color: "rgba(255,255,255,0.12)",
          }}
        >
          BART v2.0
        </p>
      </div>
    </aside>
  );
}
