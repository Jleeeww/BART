import { IDXMarketPanel } from "@/components/IDXMarketPanel";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";

const mono = "'JetBrains Mono', 'IBM Plex Mono', monospace";
const inter = "'Inter', system-ui, sans-serif";

export default function Homepage() {
  const [, setLocation] = useLocation();
  const [stocks, setStocks] = useState<any[]>([]);
  const [newsStats, setNewsStats] = useState({ total: 0, criticalAlerts: 0, highAlerts: 0 });
  const [macroRegime, setMacroRegime] = useState<any>(null);
  const [ihsg, setIhsg] = useState<{ value: number | null; percent: number | null } | null>(null);

  // Button hover states
  const [primaryHover, setPrimaryHover] = useState(false);
  const [secondaryHover, setSecondaryHover] = useState(false);
  const [linkHover, setLinkHover] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/stocks")
      .then((r) => (r.ok ? r.json() : []))
      .then(setStocks)
      .catch(() => {});
    fetch("/api/news")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.stats)
          setNewsStats({
            total: d.total ?? 0,
            criticalAlerts: d.stats.criticalAlerts ?? 0,
            highAlerts: d.stats.highAlerts ?? 0,
          });
      })
      .catch(() => {});
    fetch("/api/macro/regime")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d?.current) setMacroRegime(d.current); })
      .catch(() => {});
    fetch("/api/idx/indices")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const c = d?.indices?.find((i: any) => i.code === "COMPOSITE");
        if (c) setIhsg({ value: c.value ?? null, percent: c.percent ?? null });
      })
      .catch(() => {});
  }, []);

  // Top sector derivation
  const topSector = (() => {
    if (!stocks.length) return null;
    const counts: Record<string, number> = {};
    stocks.forEach((s) => {
      if (s.sector) counts[s.sector] = (counts[s.sector] ?? 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  })();

  // Derived values
  const sentimentValue =
    newsStats.criticalAlerts > 2
      ? { label: "RISK OFF", color: "var(--danger)" }
      : newsStats.criticalAlerts > 0
      ? { label: "WASPADA", color: "var(--warning)" }
      : { label: "RISK ON", color: "var(--positive)" };

  function accentColor(bucket: string) {
    if (bucket === "siap_dipantau") return "var(--positive)";
    if (bucket === "watchlist_prioritas") return "var(--warning)";
    return "var(--danger)";
  }

  function scoreColor(score: number | null) {
    if (score === null) return "var(--text-4)";
    if (score >= 60) return "var(--positive)";
    if (score >= 40) return "var(--warning)";
    return "var(--danger)";
  }

  const stats = [
    { value: "6", label: "Layer Intelijen" },
    { value: "v3.0", label: "Engine Bandarmologi", color: "var(--signal)" },
    { value: "IDX", label: "Seluruh Pasar" },
  ];

  const howItWorks = [
    {
      icon: (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="var(--signal)" strokeWidth="1.5">
          <path d="M1 3h6M1 8h9M1 13h6M13 8l2-5M13 8l2 5" />
        </svg>
      ),
      title: "Baca Aliran Broker",
      desc: "Pantau institusi yang sebenarnya bergerak. Bandar, asing, retail — terpisah jelas.",
    },
    {
      icon: (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="var(--signal)" strokeWidth="1.5">
          <rect x="1" y="2" width="14" height="3" rx="1" />
          <rect x="1" y="6.5" width="14" height="3" rx="1" />
          <rect x="1" y="11" width="14" height="3" rx="1" />
        </svg>
      ),
      title: "Analisis 6 Layer",
      desc: "Bandarmologi, berita, fundamental, manajemen, valuasi, makro. Satu skor terintegrasi.",
    },
    {
      icon: (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="var(--signal)" strokeWidth="1.5">
          <circle cx="8" cy="8" r="6" />
          <path d="M8 8L11 5" />
          <circle cx="8" cy="8" r="1" fill="var(--signal)" />
        </svg>
      ),
      title: "Skor Kesiapan Trading",
      desc: "0–100 dengan tiga keputusan jelas: Watchlist Prioritas, Pantau, atau Hindari.",
    },
  ];

  const footerLinks = ["Tentang", "Kebijakan", "Kontak"];

  return (
    <>
      {/* CSS Animations */}
      <style>{`
        @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
        .ticker-track { animation: ticker-scroll 60s linear infinite; }
        .ticker-track:hover { animation-play-state: paused; }
        @keyframes ticker-scroll { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
        @media (max-width: 768px) {
          .homepage-hero-headline { font-size: 2.2rem !important; }
          .homepage-grid-3 { grid-template-columns: 1fr !important; }
          .homepage-stats { flex-direction: column !important; gap: 24px !important; }
          .homepage-ctas { flex-direction: column !important; align-items: stretch !important; }
        }
      `}</style>

      <div style={{ background: "var(--surface-0)", minHeight: "100vh" }}>

        {/* ─── ZONE A: Hero ─── */}
        <section
          style={{
            minHeight: "100vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            background: "var(--surface-0)",
            padding: "0 32px",
            textAlign: "center",
            position: "relative",
          }}
        >
          {/* Pre-header */}
          <p
            style={{
              fontFamily: mono,
              fontSize: 13,
              letterSpacing: "0.3em",
              color: "var(--signal)",
              textTransform: "uppercase",
              marginBottom: 32,
            }}
          >
            <span style={{ animation: "blink 1.2s ease-in-out infinite", display: "inline-block" }}>●</span>
            {" BART INTELLIGENCE TERMINAL · v3.0"}
          </p>

          {/* Main headline */}
          <div
            className="homepage-hero-headline"
            style={{
              fontFamily: inter,
              fontSize: "clamp(2.8rem, 6vw, 3.75rem)",
              fontWeight: 600,
              letterSpacing: "-0.04em",
              lineHeight: 1.05,
              marginBottom: 20,
            }}
          >
            <div style={{ color: "var(--text-1)" }}>Baca pasar IDX</div>
            <div style={{ color: "var(--signal)" }}>seperti institusi.</div>
          </div>

          {/* Subline */}
          <p
            style={{
              fontFamily: inter,
              fontSize: 16,
              color: "var(--text-3)",
              maxWidth: 480,
              margin: "0 auto",
              lineHeight: 1.65,
              marginBottom: 48,
            }}
          >
            Enam layer intelijen. Satu skor kesiapan trading. Khusus untuk pasar IDX.
          </p>

          {/* CTAs */}
          <div
            className="homepage-ctas"
            style={{
              display: "flex",
              flexDirection: "row",
              gap: 12,
              justifyContent: "center",
            }}
          >
            <button
              onClick={() => setLocation("/radar")}
              onMouseEnter={() => setPrimaryHover(true)}
              onMouseLeave={() => setPrimaryHover(false)}
              style={{
                background: primaryHover ? "rgba(79,195,247,0.85)" : "var(--signal)",
                color: "var(--surface-0)",
                padding: "12px 28px",
                borderRadius: 8,
                border: "none",
                fontFamily: mono,
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                cursor: "pointer",
              }}
            >
              Buka Radar →
            </button>
            <button
              onClick={() => setLocation("/stock/BBCA")}
              onMouseEnter={() => setSecondaryHover(true)}
              onMouseLeave={() => setSecondaryHover(false)}
              style={{
                background: "transparent",
                color: secondaryHover ? "var(--text-1)" : "var(--text-3)",
                padding: "12px 24px",
                border: secondaryHover
                  ? "1px solid rgba(255,255,255,0.25)"
                  : "1px solid var(--border-2)",
                borderRadius: 8,
                fontFamily: mono,
                fontSize: 12,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                cursor: "pointer",
              }}
            >
              Lihat saham contoh
            </button>
          </div>

          {/* Stats strip */}
          <div
            className="homepage-stats"
            style={{
              display: "flex",
              flexDirection: "row",
              gap: 48,
              justifyContent: "center",
              alignItems: "center",
              marginTop: 64,
            }}
          >
            {stats.map((stat, i) => (
              <div key={stat.label} style={{ display: "flex", alignItems: "center", gap: 48 }}>
                <div style={{ textAlign: "center" }}>
                  <p
                    style={{
                      fontFamily: mono,
                      fontSize: 22,
                      fontWeight: 700,
                      color: stat.color ?? "var(--text-1)",
                      marginBottom: 4,
                    }}
                  >
                    {stat.value}
                  </p>
                  <p
                    style={{
                      fontFamily: mono,
                      fontSize: 12,
                      letterSpacing: "0.15em",
                      textTransform: "uppercase",
                      color: "var(--text-4)",
                    }}
                  >
                    {stat.label}
                  </p>
                </div>
                {i < stats.length - 1 && (
                  <div style={{ width: 1, height: 32, background: "var(--border-2)" }} />
                )}
              </div>
            ))}
          </div>
        </section>

        {/* ─── ZONE B: Live Ticker Strip ─── */}
        <div
          style={{
            background: "var(--surface-1)",
            borderTop: "1px solid var(--border-2)",
            borderBottom: "1px solid var(--border-2)",
            overflow: "hidden",
            padding: "12px 0",
          }}
        >
          {stocks.length === 0 ? (
            <p
              style={{
                fontFamily: mono,
                fontSize: 12,
                color: "var(--text-4)",
                textAlign: "center",
                padding: "12px 32px",
              }}
            >
              Pipeline saham memuat...
            </p>
          ) : (
            <div
              className="ticker-track"
              style={{ display: "flex", gap: 8, width: "max-content" }}
            >
              {[...stocks, ...stocks].map((stock, i) => {
                const cp = parseFloat(stock.changePercent || "0");
                const accent = accentColor(stock.homepageBucket);
                return (
                  <div
                    key={`${stock.symbol}-${i}`}
                    onClick={() => setLocation(`/stock/${stock.symbol}`)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "6px 14px",
                      borderRadius: 6,
                      background: "var(--surface-3)",
                      border: "1px solid var(--border-1)",
                      borderLeft: `2px solid ${accent}`,
                      cursor: "pointer",
                      flexShrink: 0,
                      minWidth: 130,
                    }}
                  >
                    <div>
                      <p
                        style={{
                          fontFamily: mono,
                          fontSize: 12,
                          fontWeight: 600,
                          color: "var(--text-1)",
                          marginBottom: 2,
                        }}
                      >
                        {stock.symbol}
                      </p>
                      <p
                        style={{
                          fontFamily: mono,
                          fontSize: 12,
                          color: cp >= 0 ? "var(--positive)" : "var(--danger)",
                        }}
                      >
                        {cp >= 0 ? `+${cp.toFixed(2)}%` : `${cp.toFixed(2)}%`}
                      </p>
                    </div>
                    <span
                      style={{
                        fontFamily: mono,
                        fontSize: (stock as any).computeError ? 10 : 18,
                        fontWeight: 700,
                        color: scoreColor(stock.readinessScore),
                        marginLeft: "auto",
                        textAlign: "right",
                      }}
                    >
                      {(stock as any).computeError ? "—" : stock.readinessScore}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ─── MACRO REGIME BANNER ─── */}
        {(() => {
          const regimeMap: Record<string, { label: string; color: string }> = {
            CAPITAL_INFLOW:     { label: "KAPITAL MASUK",    color: "var(--positive)" },
            NEUTRAL:            { label: "NETRAL",           color: "var(--text-3)" },
            CAPITAL_OUTFLOW:    { label: "KAPITAL KELUAR",   color: "var(--warning)" },
            CAPITAL_FLIGHT:     { label: "PELARIAN MODAL",   color: "var(--danger)" },
            FAILSAFE_SUPPRESSED:{ label: "SUPRESI FAIL-SAFE", color: "var(--danger)" },
            INSUFFICIENT_DATA:  { label: "DATA BELUM CUKUP", color: "var(--text-4)" },
          };
          const regime = macroRegime?.regime ?? "INSUFFICIENT_DATA";
          const { label, color } = regimeMap[regime] ?? regimeMap.INSUFFICIENT_DATA;
          const multiplier: number = macroRegime?.multiplier ?? 1.0;
          const note: string = macroRegime?.note ?? "Memuat data aliran modal...";
          const suppressed = multiplier < 1.0;
          const ihsgPct = ihsg?.percent;

          return (
            <div style={{
              background: "var(--surface-1)",
              borderTop: "1px solid var(--border-1)",
              borderBottom: `1px solid ${color}22`,
              padding: "14px 32px",
            }}>
              <div style={{ maxWidth: 860, margin: "0 auto", display: "flex", alignItems: "flex-start", gap: 20, flexWrap: "wrap" }}>
                {/* Badge */}
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: color, boxShadow: `0 0 6px ${color}88` }} />
                  <span style={{ fontFamily: mono, fontSize: 12, letterSpacing: "0.15em", color, fontWeight: 700 }}>
                    REZIM MAKRO
                  </span>
                  <span style={{ fontFamily: mono, fontSize: 12, fontWeight: 700, color, marginLeft: 4 }}>
                    {label}
                  </span>
                  {multiplier !== 1.0 && (
                    <span style={{ fontFamily: mono, fontSize: 12, color: "var(--text-3)", marginLeft: 4 }}>
                      ×{multiplier.toFixed(2)} bando
                    </span>
                  )}
                  {typeof ihsgPct === "number" && (
                    <span style={{ fontFamily: mono, fontSize: 12, fontWeight: 700, marginLeft: 8,
                      color: ihsgPct < 0 ? "var(--danger)" : "var(--positive)" }}>
                      IHSG {ihsgPct >= 0 ? "+" : ""}{ihsgPct.toFixed(2)}% hari ini
                    </span>
                  )}
                </div>

                {/* Note + suppression warning */}
                <div style={{ flex: 1, minWidth: 200 }}>
                  <p style={{ fontFamily: mono, fontSize: 12, color: "var(--text-3)", lineHeight: 1.6, margin: 0 }}>
                    {note}
                  </p>
                  {suppressed && (
                    <p style={{ fontFamily: mono, fontSize: 12, color, fontWeight: 700, lineHeight: 1.6, marginTop: 4, marginBottom: 0 }}>
                      ⚠ Seluruh skor disesuaikan ke bawah (×{multiplier.toFixed(2)}). Kondisi pasar berisiko — pertimbangkan posisi defensif. Skor mengukur aktivitas institusional, bukan arah pasar.
                    </p>
                  )}
                </div>
              </div>
            </div>
          );
        })()}

        {/* ─── ZONE C: Status Pasar ─── */}
        <section style={{ padding: "48px 32px", background: "var(--surface-0)" }}>
          <p
            style={{
              fontFamily: mono,
              fontSize: 12,
              letterSpacing: "0.2em",
              color: "var(--text-4)",
              textTransform: "uppercase",
              marginBottom: 24,
              textAlign: "center",
            }}
          >
            STATUS PASAR SAAT INI
          </p>

          <div
            className="homepage-grid-3"
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr",
              gap: 12,
              maxWidth: 860,
              margin: "0 auto",
            }}
          >
            {/* Card 1: Sentimen Pasar */}
            <div
              style={{
                background: "var(--surface-1)",
                border: "1px solid var(--border-1)",
                borderRadius: 10,
                padding: "20px 22px",
              }}
            >
              <p
                style={{
                  fontFamily: mono,
                  fontSize: 13,
                  letterSpacing: "0.15em",
                  color: "var(--text-4)",
                  textTransform: "uppercase",
                  marginBottom: 10,
                }}
              >
                SENTIMEN PASAR
              </p>
              <p
                style={{
                  fontFamily: mono,
                  fontSize: 20,
                  fontWeight: 700,
                  color: sentimentValue.color,
                }}
              >
                {sentimentValue.label}
              </p>
              <p
                style={{
                  fontFamily: mono,
                  fontSize: 12,
                  color: "var(--text-4)",
                  marginTop: 6,
                }}
              >
                Berdasarkan pipeline berita
              </p>
            </div>

            {/* Card 2: Sektor Hari Ini */}
            <div
              style={{
                background: "var(--surface-1)",
                border: "1px solid var(--border-1)",
                borderRadius: 10,
                padding: "20px 22px",
              }}
            >
              <p
                style={{
                  fontFamily: mono,
                  fontSize: 13,
                  letterSpacing: "0.15em",
                  color: "var(--text-4)",
                  textTransform: "uppercase",
                  marginBottom: 10,
                }}
              >
                SEKTOR AKTIF
              </p>
              <p
                style={{
                  fontFamily: mono,
                  fontSize: 16,
                  fontWeight: 700,
                  color: "var(--signal)",
                }}
              >
                {topSector ? `${topSector} ↑` : "—"}
              </p>
              <p
                style={{
                  fontFamily: mono,
                  fontSize: 12,
                  color: "var(--text-4)",
                  marginTop: 6,
                }}
              >
                Sektor dengan aktivitas tertinggi
              </p>
            </div>

            {/* Card 3: Pipeline Berita */}
            <div
              style={{
                background: "var(--surface-1)",
                border: "1px solid var(--border-1)",
                borderRadius: 10,
                padding: "20px 22px",
              }}
            >
              <p
                style={{
                  fontFamily: mono,
                  fontSize: 13,
                  letterSpacing: "0.15em",
                  color: "var(--text-4)",
                  textTransform: "uppercase",
                  marginBottom: 10,
                }}
              >
                PIPELINE BERITA
              </p>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: "var(--positive)",
                    boxShadow: "0 0 5px rgba(74,222,128,0.6)",
                    animation: "blink 1.2s ease-in-out infinite",
                    flexShrink: 0,
                  }}
                />
                <p
                  style={{
                    fontFamily: mono,
                    fontSize: 20,
                    fontWeight: 700,
                    color: "var(--positive)",
                  }}
                >
                  AKTIF
                </p>
              </div>
              <p
                style={{
                  fontFamily: mono,
                  fontSize: 12,
                  color: "var(--text-4)",
                  marginTop: 6,
                }}
              >
                {newsStats.total} artikel · {newsStats.criticalAlerts} kritis
              </p>
            </div>
          </div>
        </section>

        {/* ─── ZONE C2: Data Pasar Resmi IDX ─── */}
        <section style={{ padding: "0 32px 48px", background: "var(--surface-0)" }}>
          <div style={{ maxWidth: 1200, margin: "0 auto" }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-1)", marginBottom: 4 }}>Data Pasar — Resmi IDX</h2>
            <p style={{ fontSize: 13, color: "var(--text-3)", marginBottom: 20 }}>Indeks, pergerakan harian, dan dividen langsung dari Bursa Efek Indonesia.</p>
            <IDXMarketPanel />
          </div>
        </section>

        {/* ─── ZONE D: How It Works ─── */}
        <section
          style={{
            padding: "64px 32px",
            background: "var(--surface-1)",
            borderTop: "1px solid var(--border-1)",
          }}
        >
          <p
            style={{
              fontFamily: mono,
              fontSize: 12,
              letterSpacing: "0.3em",
              textTransform: "uppercase",
              color: "var(--signal)",
              textAlign: "center",
              marginBottom: 12,
              opacity: 0.8,
            }}
          >
            CARA KERJA
          </p>
          <h2
            style={{
              fontFamily: inter,
              fontSize: 22,
              fontWeight: 600,
              color: "var(--text-1)",
              textAlign: "center",
              marginBottom: 48,
              letterSpacing: "-0.02em",
            }}
          >
            Dirancang untuk trader yang berpikir seperti institusi.
          </h2>

          <div
            className="homepage-grid-3"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
              gap: 16,
              maxWidth: 900,
              margin: "0 auto",
            }}
          >
            {howItWorks.map((card) => (
              <div
                key={card.title}
                style={{
                  padding: 24,
                  borderRadius: 8,
                  background: "var(--surface-3)",
                  border: "1px solid var(--border-2)",
                }}
              >
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 8,
                    background: "rgba(79,195,247,0.08)",
                    border: "1px solid rgba(79,195,247,0.12)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: 20,
                  }}
                >
                  {card.icon}
                </div>
                <h3
                  style={{
                    fontFamily: inter,
                    fontSize: 15,
                    fontWeight: 600,
                    color: "var(--text-1)",
                    marginBottom: 10,
                  }}
                >
                  {card.title}
                </h3>
                <p
                  style={{
                    fontFamily: mono,
                    fontSize: 13,
                    color: "var(--text-3)",
                    lineHeight: 1.7,
                  }}
                >
                  {card.desc}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* ─── ZONE E: Footer ─── */}
        <footer
          style={{
            padding: "32px",
            background: "var(--surface-0)",
            borderTop: "1px solid var(--border-1)",
            textAlign: "center",
          }}
        >
          <p
            style={{
              fontFamily: mono,
              fontSize: 12,
              color: "var(--text-4)",
              letterSpacing: "0.06em",
              marginBottom: 12,
            }}
          >
            PT Berkat Digital Investasi · BART v3.0 · IDX Indonesia
          </p>
          <div
            style={{
              display: "flex",
              flexDirection: "row",
              gap: 24,
              justifyContent: "center",
            }}
          >
            {footerLinks.map((link, i) => (
              <span
                key={link}
                onClick={() => {}}
                onMouseEnter={(e) => {
                  setLinkHover(i);
                  (e.currentTarget as HTMLElement).style.color = "var(--text-3)";
                }}
                onMouseLeave={(e) => {
                  setLinkHover(null);
                  (e.currentTarget as HTMLElement).style.color = "var(--text-4)";
                }}
                style={{
                  fontFamily: mono,
                  fontSize: 12,
                  color: linkHover === i ? "var(--text-3)" : "var(--text-4)",
                  cursor: "pointer",
                  letterSpacing: "0.06em",
                }}
              >
                {link}
              </span>
            ))}
          </div>
        </footer>

      </div>
    </>
  );
}
