import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Activity, Radio, ShieldCheck } from "lucide-react";
import { ScoreRing } from "@/components/ScoreRing";
import { DecisionBadge } from "@/components/DecisionBadge";

interface StockData {
  symbol: string;
  name: string;
  readinessScore: number;
  marketRegime: string;
  homepageBucket: string;
  sector: string | null;
  changePercent: string;
  isGorengan?: boolean;
}

const mono = "'IBM Plex Mono', monospace";
const sora = "'Sora', sans-serif";

function getIDXSessionStatus(): { label: string; live: boolean } {
  const now = new Date();
  const wibOffset = 7 * 60;
  const utcMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
  const wibMinutes = (utcMinutes + wibOffset) % (24 * 60);
  const totalMinutes = Math.floor(wibMinutes / 60) * 60 + (wibMinutes % 60);
  const wibDate = new Date(now.getTime() + wibOffset * 60 * 1000);
  const dayOfWeek = wibDate.getUTCDay();
  if (dayOfWeek === 0 || dayOfWeek === 6) return { label: "PASAR TUTUP", live: false };
  if (totalMinutes >= 9 * 60 && totalMinutes < 12 * 60) return { label: "SESI 1 BERLANGSUNG", live: true };
  if (totalMinutes >= 13 * 60 + 30 && totalMinutes < 15 * 60 + 50) return { label: "SESI 2 BERLANGSUNG", live: true };
  if (totalMinutes >= 8 * 60 + 45) return { label: "PRA-PEMBUKAAN", live: false };
  return { label: "PASAR TUTUP", live: false };
}

function bucketToDecision(bucket: string): string {
  if (bucket === "siap_dipantau") return "SIAP_DIPANTAU";
  if (bucket === "watchlist_prioritas") return "WATCHLIST_PRIORITAS";
  return "HINDARI_DULU";
}

export default function Homepage() {
  const { data: stocks } = useQuery<StockData[]>({ queryKey: ["/api/stocks"] });
  const session = getIDXSessionStatus();
  const today = new Date().toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
  const stockCount = stocks?.length ?? 0;

  return (
    <div style={{ background: "#080808" }}>

      {/* ─── ZONE A: Terminal Header ─── */}
      <div
        className="flex items-center justify-between px-6 py-2.5"
        style={{ background: "#0a0a0a", borderBottom: "1px solid rgba(255,255,255,0.04)" }}
      >
        <span style={{ fontFamily: mono, fontWeight: 700, fontSize: 16, color: "#38BDF8" }}>BART</span>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {session.live && (
            <span
              style={{
                width: 6, height: 6, borderRadius: "50%",
                background: "#34D399", display: "inline-block",
                animation: "pulse 2s infinite",
              }}
            />
          )}
          <span style={{ fontFamily: mono, fontSize: 9, color: "#38BDF8", opacity: 0.7, letterSpacing: "0.1em" }}>
            {session.live ? "● " : "○ "}{session.label}
            {" · "}SESI: {today}
            {" · "}{stockCount} SAHAM
            {" · "}PIPELINE: AKTIF
          </span>
        </div>
        <Link href="/radar">
          <input
            type="text"
            placeholder="Cari saham..."
            readOnly
            className="cursor-pointer rounded-md px-3 py-1.5 text-xs outline-none"
            style={{
              fontFamily: mono, background: "#161616",
              border: "1px solid rgba(255,255,255,0.06)", color: "#6B7280", width: 160,
            }}
          />
        </Link>
      </div>

      {/* ─── ZONE B: Hero ─── */}
      <section
        className="relative min-h-screen flex flex-col overflow-hidden"
        style={{ background: "#080808" }}
      >
        {/* Background: blurred radar preview */}
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0 pt-32 overflow-hidden pointer-events-none select-none"
            style={{ opacity: 0.15, filter: "blur(2px)" }}>
            {stocks && stocks.length > 0 && (
              <table className="w-full" style={{ minWidth: 800 }}>
                <thead>
                  <tr style={{ background: "#111111" }}>
                    {["SAHAM", "SEKTOR", "SKOR", "REZIM", "POSISI SIKLUS", "ALIRAN DANA", "AKSI"].map((h) => (
                      <th key={h} className="text-left px-4 py-2"
                        style={{ fontFamily: mono, fontSize: 9, letterSpacing: "0.1em", color: "#6b7280", fontWeight: 400 }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {stocks.slice(0, 14).map((stock) => (
                    <tr key={stock.symbol}
                      style={{ background: "#161616", borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                      <td className="px-4 py-2">
                        <p className="text-sm font-bold text-white" style={{ fontFamily: sora }}>{stock.symbol}</p>
                      </td>
                      <td className="px-4 py-2">
                        <span style={{ fontFamily: mono, fontSize: 10, color: "#6b7280" }}>{stock.sector || "—"}</span>
                      </td>
                      <td className="px-4 py-2 text-center">
                        <span className="text-lg font-bold"
                          style={{ fontFamily: mono, color: stock.readinessScore >= 60 ? "#34d399" : stock.readinessScore >= 40 ? "#fbbf24" : "#f87171" }}>
                          {stock.readinessScore}
                        </span>
                      </td>
                      <td className="px-4 py-2">
                        <span style={{ fontFamily: mono, fontSize: 10, color: "#6b7280" }}>{stock.marketRegime}</span>
                      </td>
                      <td className="px-4 py-2">
                        <span style={{ fontFamily: mono, fontSize: 10, color: "#9ca3af" }}>—</span>
                      </td>
                      <td className="px-4 py-2">
                        <span style={{ fontFamily: mono, fontSize: 10, color: "#6b7280" }}>→ Netral</span>
                      </td>
                      <td className="px-4 py-2">
                        <span style={{ fontFamily: mono, fontSize: 10, color: "#38BDF8" }}>ANALISIS →</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          <div className="absolute inset-0"
            style={{ background: "linear-gradient(to bottom, #080808 0%, #08080840 25%, #08080810 55%, #080808 100%)" }} />
          <div className="absolute inset-0 pointer-events-none"
            style={{ background: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.012) 2px, rgba(255,255,255,0.012) 3px)" }} />
        </div>

        {/* Foreground */}
        <div className="relative z-10 flex flex-col items-center justify-center min-h-screen px-8 text-center">
          <p style={{ fontFamily: mono, fontSize: 10, letterSpacing: "0.3em", textTransform: "uppercase", color: "#38BDF8", opacity: 0.9, marginBottom: 20 }}>
            BART INTELLIGENCE TERMINAL
          </p>

          <h1 style={{ fontFamily: sora, fontWeight: 700, color: "#FFFFFF", lineHeight: 1.12, marginBottom: 16 }}
            className="text-5xl md:text-6xl">
            <div style={{ opacity: 0, animation: "fadeInUp 0.4s ease forwards" }}>Baca Pasar</div>
            <div style={{ opacity: 0, animation: "fadeInUp 0.4s ease forwards", animationDelay: "120ms" }}>
              Seperti Institusi.
            </div>
          </h1>

          <p style={{
            fontFamily: sora, fontSize: 16, color: "#6B7280", maxWidth: 480,
            lineHeight: 1.65, marginBottom: 32,
            opacity: 0, animation: "fadeInUp 0.4s ease forwards", animationDelay: "280ms",
          }}>
            Enam layer intelijen. Satu skor kesiapan trading.
            <br />Khusus untuk pasar IDX.
          </p>

          <div className="flex gap-4 items-center justify-center"
            style={{ opacity: 0, animation: "fadeInUp 0.4s ease forwards", animationDelay: "420ms" }}>
            <Link href="/radar">
              <button
                className="font-bold rounded-lg transition-all duration-150 hover:bg-[#7DD3FC] hover:scale-[1.02]"
                style={{
                  fontFamily: sora, fontSize: 14, fontWeight: 700,
                  background: "#38BDF8", color: "#000",
                  padding: "12px 28px",
                  boxShadow: "0 8px 20px -4px rgba(56,189,248,0.25)",
                }}
                data-testid="button-open-radar"
              >
                Buka Radar →
              </button>
            </Link>
            <Link href="/stock/BBCA">
              <button
                className="rounded-lg transition-all duration-150"
                style={{
                  fontFamily: sora, fontSize: 14,
                  background: "transparent",
                  color: "#38BDF8", padding: "12px 24px",
                  border: "1px solid rgba(56,189,248,0.3)",
                }}
                data-testid="link-example-analysis"
              >
                Lihat Contoh Saham
              </button>
            </Link>
          </div>

          {/* Stats strip */}
          <div className="flex gap-12 justify-center mt-16 items-center"
            style={{ opacity: 0, animation: "fadeInUp 0.4s ease forwards", animationDelay: "560ms" }}>
            <div className="text-center">
              <p className="text-2xl font-bold text-white" style={{ fontFamily: mono }}>6</p>
              <p style={{ fontFamily: mono, fontSize: 9, letterSpacing: "0.15em", textTransform: "uppercase", color: "#6b7280" }}>Layer Intelijen</p>
            </div>
            <div className="w-px h-8 self-center" style={{ background: "rgba(255,255,255,0.06)" }} />
            <div className="text-center">
              <p className="text-2xl font-bold" style={{ fontFamily: mono, color: "#38BDF8" }}>v3.0</p>
              <p style={{ fontFamily: mono, fontSize: 9, letterSpacing: "0.15em", textTransform: "uppercase", color: "#6b7280" }}>Engine Bandarmologi</p>
            </div>
            <div className="w-px h-8 self-center" style={{ background: "rgba(255,255,255,0.06)" }} />
            <div className="text-center">
              <p className="text-2xl font-bold text-white" style={{ fontFamily: mono }}>IDX</p>
              <p style={{ fontFamily: mono, fontSize: 9, letterSpacing: "0.15em", textTransform: "uppercase", color: "#6b7280" }}>Seluruh Pasar</p>
            </div>
          </div>
        </div>
      </section>

      {/* ─── ZONE C: Live Signal Strip ─── */}
      {stocks && stocks.length > 0 && (
        <section style={{ background: "#0a0a0a", borderTop: "1px solid rgba(255,255,255,0.03)", padding: "16px 0" }}>
          <div style={{ overflowX: "auto", paddingBottom: 4 }} className="no-scrollbar">
            <div style={{ display: "flex", gap: 10, paddingLeft: 24, paddingRight: 24, width: "max-content" }}>
              {stocks.slice(0, 16).map((stock) => {
                const cp = parseFloat(stock.changePercent || "0");
                const decision = bucketToDecision(stock.homepageBucket);
                const accentColor = decision === "SIAP_DIPANTAU" ? "#34D399" : decision === "WATCHLIST_PRIORITAS" ? "#FBBF24" : "#F87171";
                return (
                  <Link href={`/stock/${stock.symbol}`} key={stock.symbol}>
                    <div
                      className="cursor-pointer transition-all duration-150 hover:border-[rgba(255,255,255,0.1)]"
                      style={{
                        width: 148, padding: "12px 14px",
                        background: "#111111", border: "1px solid #1F2937",
                        borderLeft: `3px solid ${accentColor}`,
                        borderRadius: 10,
                      }}
                    >
                      <p style={{ fontFamily: sora, fontSize: 13, fontWeight: 700, color: "#FFFFFF", marginBottom: 4 }}>
                        {stock.symbol}
                      </p>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                        <span style={{
                          fontFamily: mono, fontSize: 16, fontWeight: 700,
                          color: stock.readinessScore >= 60 ? "#34D399" : stock.readinessScore >= 40 ? "#FBBF24" : "#F87171",
                        }}>
                          {stock.readinessScore}
                        </span>
                        <span style={{
                          fontFamily: mono, fontSize: 10,
                          color: cp > 0 ? "#34D399" : cp < 0 ? "#F87171" : "#6B7280",
                        }}>
                          {cp > 0 ? `+${cp.toFixed(2)}%` : `${cp.toFixed(2)}%`}
                        </span>
                      </div>
                      <DecisionBadge decision={decision} size="sm" showIcon={false} />
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* ─── ZONE D: How It Works ─── */}
      <section className="py-16 px-8" style={{ background: "#0a0a0a", borderTop: "1px solid rgba(255,255,255,0.03)" }}>
        <p style={{ fontFamily: mono, fontSize: 10, letterSpacing: "0.25em", textTransform: "uppercase", color: "#38BDF8", textAlign: "center", marginBottom: 12, opacity: 0.8 }}>
          CARA KERJA
        </p>
        <h2 className="text-center mb-12" style={{ fontFamily: sora, fontSize: 22, fontWeight: 700, color: "#FFFFFF" }}>
          Dirancang untuk trader yang berpikir seperti institusi.
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
          {[
            {
              icon: Activity,
              title: "Baca Aliran Broker",
              desc: "12 model deteksi perilaku institusi. Dari akumulasi stealth hingga stabilitas rezim pasar.",
            },
            {
              icon: Radio,
              title: "Analisis 6 Layer",
              desc: "Bandarmologi, makro, fundamental, manajemen, valuasi, dan rotasi sektor — diintegrasikan dalam satu skor.",
            },
            {
              icon: ShieldCheck,
              title: "Satu Skor Kesiapan",
              desc: "Bukan sinyal beli/jual. Satu angka yang memberi konteks lengkap: kapan, kenapa, dan seberapa siap.",
            },
          ].map((f) => {
            const Icon = f.icon;
            return (
              <div
                key={f.title}
                className="p-6 rounded-xl transition-all duration-150"
                style={{ background: "#111111", border: "1px solid #1F2937" }}
              >
                <div className="w-9 h-9 rounded-lg flex items-center justify-center mb-5"
                  style={{ background: "rgba(56,189,248,0.1)" }}>
                  <Icon style={{ width: 18, height: 18, color: "#38BDF8" }} />
                </div>
                <h3 className="mb-2" style={{ fontFamily: sora, fontSize: 15, fontWeight: 600, color: "#FFFFFF" }}>
                  {f.title}
                </h3>
                <p style={{ fontFamily: mono, fontSize: 11, color: "#6B7280", lineHeight: 1.7 }}>
                  {f.desc}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* ─── Bottom CTA ─── */}
      <section className="py-10 px-8" style={{ background: "#080808", borderTop: "1px solid rgba(255,255,255,0.03)" }}>
        <div className="flex items-center justify-between max-w-4xl mx-auto">
          <div>
            <p style={{ fontFamily: sora, fontSize: 17, fontWeight: 700, color: "#FFFFFF" }}>
              Siap memindai pasar?
            </p>
            <p style={{ fontFamily: mono, fontSize: 10, color: "#6B7280", marginTop: 4 }}>
              Data IDX live segera hadir via PT Berkat Digital Investasi
            </p>
          </div>
          <Link href="/radar">
            <button
              className="rounded-lg font-bold transition-all duration-150 hover:scale-[1.02]"
              style={{
                fontFamily: sora, fontSize: 14, fontWeight: 700,
                background: "#38BDF8", color: "#000",
                padding: "12px 28px",
                boxShadow: "0 8px 20px -4px rgba(56,189,248,0.2)",
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
