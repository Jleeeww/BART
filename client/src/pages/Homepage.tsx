import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Activity, Radio, ShieldCheck } from "lucide-react";

interface StockData {
  symbol: string;
  name: string;
  readinessScore: number;
  marketRegime: string;
  homepageBucket: string;
  sector: string | null;
  isGorengan?: boolean;
}

const mono = "'IBM Plex Mono', monospace";
const sora = "'Sora', sans-serif";

function scoreColor(score: number) {
  if (score >= 80) return "#34d399";
  if (score >= 60) return "#fbbf24";
  return "#f87171";
}

function bucketAccent(bucket: string) {
  if (bucket === "siap_dipantau") return "#34d399";
  if (bucket === "watchlist_prioritas") return "#fbbf24";
  return "#f87171";
}

export default function Homepage() {
  const { data: stocks } = useQuery<StockData[]>({
    queryKey: ["/api/stocks"],
  });

  return (
    <div style={{ background: "#0f0f0f" }}>
      {/* SECTION 1 — Full viewport hero */}
      <section className="relative min-h-screen flex flex-col overflow-hidden" style={{ background: "#0f0f0f" }}>
        {/* BACKGROUND LAYER */}
        <div className="absolute inset-0 z-0">
          {/* Layer A — Blurred Radar preview */}
          <div
            className="absolute inset-0 pt-32 overflow-hidden pointer-events-none select-none"
            style={{ opacity: 0.2, filter: "blur(2px)" }}
          >
            {stocks && stocks.length > 0 && (
              <table className="w-full" style={{ minWidth: 800 }}>
                <thead>
                  <tr style={{ background: "#111111" }}>
                    {["SAHAM", "SEKTOR", "SKOR", "REZIM", "POSISI SIKLUS", "ALIRAN DANA", "KONSENTRASI", "AKSI"].map((h) => (
                      <th
                        key={h}
                        className="text-left px-4 py-2"
                        style={{ fontFamily: mono, fontSize: 9, letterSpacing: "0.1em", color: "#6b7280", fontWeight: 400 }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {stocks.slice(0, 12).map((stock) => {
                    const accent = bucketAccent(stock.homepageBucket);
                    return (
                      <tr
                        key={stock.symbol}
                        style={{ background: "#161616", borderBottom: "1px solid rgba(255,255,255,0.03)", borderLeft: `2px solid ${accent}` }}
                      >
                        <td className="px-4 py-3">
                          <p className="text-sm font-bold text-white" style={{ fontFamily: sora }}>{stock.symbol}</p>
                          <p className="text-[10px]" style={{ fontFamily: mono, color: "#6b7280" }}>{stock.name}</p>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-[10px]" style={{ fontFamily: mono, color: "#6b7280" }}>{stock.sector || "—"}</span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="text-lg font-bold" style={{ fontFamily: mono, color: scoreColor(stock.readinessScore) }}>{stock.readinessScore}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-0.5 rounded-sm text-[10px]" style={{ fontFamily: mono, color: "#6b7280", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>{stock.marketRegime}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-[11px]" style={{ fontFamily: mono, color: "#94a3b8" }}>—</span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="text-[11px]" style={{ fontFamily: mono, color: "#6b7280" }}>→ Netral</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-[10px]" style={{ fontFamily: mono, color: "rgba(255,255,255,0.12)" }}>—</span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="text-[10px] px-3 py-1.5 rounded-sm" style={{ fontFamily: mono, background: "rgba(56,189,248,0.1)", color: "#38BDF8", border: "1px solid rgba(56,189,248,0.2)" }}>DETAIL →</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Layer B — Gradient overlay */}
          <div
            className="absolute inset-0"
            style={{ background: "linear-gradient(to bottom, #0f0f0f 0%, #0f0f0f40 30%, #0f0f0f10 60%, #0f0f0f 100%)" }}
          />

          {/* Layer C — Scanline texture */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ background: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.016) 2px, rgba(255,255,255,0.016) 3px)" }}
          />
        </div>

        {/* FOREGROUND CONTENT */}
        <div className="relative z-10 flex flex-col items-center justify-center min-h-screen px-8 text-center">
          <p
            className="text-[10px] tracking-[0.3em] uppercase mb-6 opacity-80"
            style={{ fontFamily: mono, color: "#38BDF8" }}
          >
            BANDARMOLOGY ANALYSIS & RESEARCH TERMINAL
          </p>

          <h1 style={{ fontFamily: sora }} className="text-5xl font-bold text-white leading-tight mb-4">
            <div style={{ opacity: 0, animation: "fadeInUp 0.4s ease forwards", animationDelay: "0ms" }}>
              Baca Pasar
            </div>
            <div style={{ opacity: 0, animation: "fadeInUp 0.4s ease forwards", animationDelay: "100ms" }}>
              Sebelum Harga
            </div>
            <div style={{ opacity: 0, animation: "fadeInUp 0.4s ease forwards", animationDelay: "200ms", color: "#38BDF8" }}>
              Bergerak.
            </div>
          </h1>

          <p
            className="text-lg max-w-lg mx-auto mt-2 mb-8 leading-relaxed"
            style={{
              fontFamily: sora,
              color: "#6b7280",
              opacity: 0,
              animation: "fadeInUp 0.4s ease forwards",
              animationDelay: "350ms",
            }}
            data-testid="text-homepage-subtitle"
          >
            BART mendeteksi perilaku institusi dan bandar di seluruh IDX
            sebelum pergerakan harga terjadi.
          </p>

          <div
            style={{ opacity: 0, animation: "fadeInUp 0.4s ease forwards", animationDelay: "500ms" }}
            className="flex flex-col items-center"
          >
            <Link href="/radar">
              <button
                className="font-bold text-sm tracking-wider px-8 py-3.5 rounded-md transition-all duration-200 hover:scale-[1.02]"
                style={{
                  fontFamily: mono,
                  background: "#38BDF8",
                  color: "#000",
                  boxShadow: "0 10px 25px -5px rgba(56,189,248,0.2)",
                }}
                data-testid="button-open-radar"
              >
                BUKA RADAR →
              </button>
            </Link>
            <Link href="/stock/BBCA">
              <span
                className="text-[11px] mt-3 block transition-colors cursor-pointer hover:text-[#ffffff60]"
                style={{ fontFamily: mono, color: "rgba(255,255,255,0.19)" }}
                data-testid="link-example-analysis"
              >
                Lihat contoh analisis saham →
              </span>
            </Link>
          </div>

          <div
            className="flex gap-12 justify-center mt-16 items-center"
            style={{ opacity: 0, animation: "fadeInUp 0.4s ease forwards", animationDelay: "600ms" }}
          >
            <div className="text-center">
              <p className="text-2xl font-bold text-white" style={{ fontFamily: mono }}>12+</p>
              <p className="text-[10px] tracking-widest uppercase" style={{ fontFamily: mono, color: "#6b7280" }}>Model Deteksi</p>
            </div>
            <div className="w-px h-8 self-center" style={{ background: "rgba(255,255,255,0.06)" }} />
            <div className="text-center">
              <p className="text-2xl font-bold" style={{ fontFamily: mono, color: "#38BDF8" }}>v2.0</p>
              <p className="text-[10px] tracking-widest uppercase" style={{ fontFamily: mono, color: "#6b7280" }}>Engine Bandarmologi</p>
            </div>
            <div className="w-px h-8 self-center" style={{ background: "rgba(255,255,255,0.06)" }} />
            <div className="text-center">
              <p className="text-2xl font-bold text-white" style={{ fontFamily: mono }}>IDX</p>
              <p className="text-[10px] tracking-widest uppercase" style={{ fontFamily: mono, color: "#6b7280" }}>Seluruh Pasar</p>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 2 — Feature strip */}
      <section className="py-12 px-8" style={{ background: "#0a0a0a", borderTop: "1px solid rgba(255,255,255,0.03)" }}>
        <h2
          className="text-xl font-bold text-white text-center mb-8"
          style={{ fontFamily: sora }}
        >
          Dirancang untuk trader yang berpikir seperti institusi.
        </h2>

        <div className="grid grid-cols-3 gap-6 max-w-4xl mx-auto">
          {[
            {
              icon: Activity,
              title: "Bandarmology Engine",
              desc: "12 model deteksi perilaku institusi. Dari akumulasi stealth hingga stabilitas rezim pasar.",
            },
            {
              icon: Radio,
              title: "Radar IDX",
              desc: "Pemindaian seluruh pasar secara bersamaan. Temukan kampanye akumulasi sebelum harga bergerak.",
            },
            {
              icon: ShieldCheck,
              title: "Bukan Sinyal Jual Beli",
              desc: "BART membantu Anda berpikir seperti pro. Bukan robot trading — panduan analisis berbasis data.",
            },
          ].map((f) => {
            const Icon = f.icon;
            return (
              <div
                key={f.title}
                className="p-6 rounded-md transition-all duration-200 hover:border-[rgba(56,189,248,0.2)]"
                style={{ background: "#161616", border: "1px solid rgba(255,255,255,0.03)" }}
              >
                <div
                  className="w-8 h-8 rounded-sm flex items-center justify-center mb-4"
                  style={{ background: "rgba(56,189,248,0.1)" }}
                >
                  <Icon style={{ width: 16, height: 16, color: "#38BDF8" }} />
                </div>
                <h3 className="text-sm font-bold text-white mb-2" style={{ fontFamily: sora }}>
                  {f.title}
                </h3>
                <p className="text-[11px] leading-relaxed" style={{ fontFamily: mono, color: "#6b7280" }}>
                  {f.desc}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* SECTION 3 — Bottom CTA strip */}
      <section
        className="py-10 px-8"
        style={{ background: "#0f0f0f", borderTop: "1px solid rgba(255,255,255,0.03)" }}
      >
        <div className="flex items-center justify-between max-w-4xl mx-auto">
          <div>
            <p className="text-lg font-bold text-white" style={{ fontFamily: sora }}>
              Siap memindai pasar?
            </p>
            <p className="text-xs mt-1" style={{ fontFamily: mono, color: "#6b7280" }}>
              Data IDX live segera hadir via PT Berkat Digital Investasi
            </p>
          </div>
          <Link href="/radar">
            <button
              className="font-bold text-sm tracking-wider px-8 py-3.5 rounded-md transition-all duration-200 hover:scale-[1.02]"
              style={{
                fontFamily: mono,
                background: "#38BDF8",
                color: "#000",
                boxShadow: "0 10px 25px -5px rgba(56,189,248,0.2)",
              }}
              data-testid="button-bottom-radar"
            >
              BUKA RADAR →
            </button>
          </Link>
        </div>
      </section>
    </div>
  );
}
