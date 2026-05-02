import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

const mono = "'IBM Plex Mono', monospace";
const sora = "'Sora', sans-serif";

interface StockData {
  symbol: string;
  name: string;
  price: string;
  changePercent: string;
  readinessScore: number;
  homepageBucket: string;
  flowBias?: string;
}

interface SectorRotationSector {
  sector: string;
  displayName: string;
  rotationScore: number;
  direction: "MASUK" | "KELUAR" | "NETRAL";
  stockCount: number;
  akumulasiCount: number;
  distribusiCount: number;
  topStocks: {
    symbol: string;
    companyName: string;
    readinessScore: number;
    cyclePosition: string | null;
    flowBias: string | null;
  }[];
  momentum: "NAIK" | "TURUN" | "STABIL";
  previousScore: number | null;
}

interface SectorRotationSnapshot {
  sectors: SectorRotationSector[];
  hotSectors: string[];
  coldSectors: string[];
  rotationStrength: "KUAT" | "SEDANG" | "LEMAH";
  dominantTheme: string;
  computedAt: string;
  isStale: boolean;
}

interface MacroCommodity {
  name: string;
  currentPrice: number | null;
  change5d: number | null;
  trend: "NAIK" | "TURUN" | "STABIL" | null;
  unit: string;
  source: "LIVE" | "FALLBACK";
}

interface MacroSignal {
  type: string;
  sector: string;
  effect: "POSITIF" | "NEGATIF" | "NETRAL";
  strength: "KUAT" | "SEDANG" | "LEMAH";
  description: string;
}

interface MacroContextSnapshot {
  oil: MacroCommodity;
  gold: MacroCommodity;
  usdIdr: MacroCommodity;
  signals: MacroSignal[];
  marketSentiment: "RISK_ON" | "RISK_OFF" | "NETRAL";
  sentimentReason: string;
  computedAt: string;
  isStale: boolean;
}

interface AltDataSnapshot {
  weather: {
    regionId: string;
    regionName: string;
    sector: string;
    rainfallMm: number | null;
    weatherCode: string | null;
    temperature: number | null;
    fetchedAt: string;
  }[];
  cpo: {
    priceIDR: number | null;
    priceUSD: number | null;
    trend: string | null;
    fetchedAt: string;
    source: string;
  };
  coal: {
    hba1USD: number | null;
    hba2USD: number | null;
    hba3USD: number | null;
    trend: string | null;
    fetchedAt: string;
    source: string;
  };
  degradedSources: string[];
}

function getIDXSessionStatus(): { label: string; color: "green" | "yellow" | "red" } {
  const now = new Date();
  const wibOffset = 7 * 60;
  const utcMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
  const wibMinutes = (utcMinutes + wibOffset) % (24 * 60);
  const totalMinutes = Math.floor(wibMinutes / 60) * 60 + (wibMinutes % 60);
  const wibDate = new Date(now.getTime() + wibOffset * 60 * 1000);
  const dayOfWeek = wibDate.getUTCDay();
  if (dayOfWeek === 0 || dayOfWeek === 6) return { label: "Pasar Tutup", color: "red" };
  if (totalMinutes >= 8 * 60 + 45 && totalMinutes < 9 * 60) return { label: "Pra-Pembukaan", color: "yellow" };
  if (totalMinutes >= 9 * 60 && totalMinutes < 12 * 60) return { label: "Sesi 1 Berlangsung", color: "green" };
  if (totalMinutes >= 12 * 60 && totalMinutes < 13 * 60 + 30) return { label: "Istirahat", color: "yellow" };
  if (totalMinutes >= 13 * 60 + 30 && totalMinutes < 15 * 60 + 50) return { label: "Sesi 2 Berlangsung", color: "green" };
  if (totalMinutes >= 15 * 60 + 50 && totalMinutes < 16 * 60) return { label: "Pra-Penutupan", color: "yellow" };
  return { label: "Pasar Tutup", color: "red" };
}

const SECTORS = [
  "Keuangan", "Konsumer Primer", "Konsumer Sekunder", "Energi",
  "Material & Tambang", "Industri", "Teknologi", "Telekomunikasi",
  "Kesehatan", "Properti", "Infrastruktur",
];

const WEATHER_REGIONS = ["Riau", "Kalimantan Selatan", "Kalimantan Timur", "Sulawesi Tengah"];

function LiveIDXBadge() {
  return (
    <span
      className="px-2 py-0.5 rounded-sm border"
      style={{
        fontFamily: mono,
        fontSize: 9,
        background: "rgba(255,255,255,0.02)",
        color: "rgba(255,255,255,0.12)",
        borderColor: "rgba(255,255,255,0.06)",
      }}
    >
      Live IDX
    </span>
  );
}

function SourceBadge({ source }: { source: string }) {
  const isFallback = source.includes("FALLBACK");
  return (
    <span
      className="px-2 py-0.5 rounded-sm border"
      style={{
        fontFamily: mono,
        fontSize: 9,
        background: isFallback ? "rgba(245,158,11,0.1)" : "rgba(16,185,129,0.1)",
        color: isFallback ? "rgba(245,158,11,0.6)" : "#34d399",
        borderColor: isFallback ? "rgba(245,158,11,0.2)" : "rgba(16,185,129,0.2)",
      }}
    >
      {isFallback ? "Fallback" : "Live"}
    </span>
  );
}

function StockLogo({ symbol }: { symbol: string }) {
  const [failed, setFailed] = useState(false);
  return (
    <div
      className="w-6 h-6 rounded-sm flex-shrink-0 flex items-center justify-center overflow-hidden"
      style={{ background: "#1e1e1e", border: "1px solid rgba(255,255,255,0.06)" }}
    >
      {failed ? (
        <span className="text-[8px] font-bold" style={{ fontFamily: mono, color: "#38BDF8" }}>
          {symbol.slice(0, 2)}
        </span>
      ) : (
        <img
          src={`https://assets.stockbit.com/logos/companies/${symbol}.png`}
          alt={symbol}
          className="w-4 h-4 object-contain"
          onError={() => setFailed(true)}
        />
      )}
    </div>
  );
}

function formatTimestamp(ts: string) {
  try {
    const d = new Date(ts);
    return d.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch {
    return ts;
  }
}

export default function PasarPage() {
  const [sessionStatus, setSessionStatus] = useState(getIDXSessionStatus());
  const [altData, setAltData] = useState<AltDataSnapshot | null>(null);
  const [altLoading, setAltLoading] = useState(true);
  const [altError, setAltError] = useState(false);
  const [sectorRotation, setSectorRotation] = useState<SectorRotationSnapshot | null>(null);
  const [macroContext, setMacroContext] = useState<MacroContextSnapshot | null>(null);

  const { data: stocks } = useQuery<StockData[]>({ queryKey: ["/api/stocks"] });

  useEffect(() => {
    const interval = setInterval(() => setSessionStatus(getIDXSessionStatus()), 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    setAltLoading(true);
    fetch("/api/alt-data/snapshot")
      .then((r) => r.json())
      .then((d) => { setAltData(d); setAltError(false); })
      .catch(() => setAltError(true))
      .finally(() => setAltLoading(false));
  }, []);

  useEffect(() => {
    fetch("/api/sector-rotation")
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const data = await r.json();
        if (data && Array.isArray(data.sectors)) setSectorRotation(data);
      })
      .catch(() => {});

    fetch("/api/macro-context")
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const data = await r.json();
        if (data && data.oil && data.gold && data.usdIdr && Array.isArray(data.signals)) {
          setMacroContext(data);
        }
      })
      .catch(() => {});
  }, []);

  const topAkumulasi = useMemo(() => {
    if (!stocks) return [];
    return stocks
      .filter((s) => s.homepageBucket === "siap_dipantau" || s.homepageBucket === "watchlist_prioritas")
      .sort((a, b) => b.readinessScore - a.readinessScore)
      .slice(0, 5);
  }, [stocks]);

  const statusDotColor = sessionStatus.color === "green" ? "bg-emerald-500" : sessionStatus.color === "yellow" ? "bg-amber-500" : "bg-rose-500";
  const statusTextColor = sessionStatus.color === "green" ? "text-emerald-400" : sessionStatus.color === "yellow" ? "text-amber-400" : "text-rose-400";
  const statusValueColor = sessionStatus.color === "green" ? "#34d399" : sessionStatus.color === "yellow" ? "#fbbf24" : "#f87171";

  return (
    <div className="px-6 py-6 min-h-screen" style={{ background: "#0f0f0f" }}>
      <div className="flex items-start justify-between mb-5">
        <div>
          <p className="text-[10px] tracking-[0.2em] uppercase mb-1" style={{ fontFamily: mono, color: "#38BDF8" }} data-testid="text-pasar-label">
            PASAR
          </p>
          <h1 className="text-2xl font-bold text-white" style={{ fontFamily: sora }} data-testid="text-pasar-title">
            Kondisi Pasar IDX
          </h1>
          <p className="text-sm mt-1" style={{ fontFamily: mono, color: "#6b7280" }}>
            Gambaran institusional pasar Indonesia hari ini
          </p>
        </div>
        <div className={`flex items-center gap-2 text-xs ${statusTextColor}`} data-testid="badge-pasar-session">
          <div className={`w-1.5 h-1.5 rounded-full ${statusDotColor} ${sessionStatus.color === "green" ? "animate-pulse" : ""}`} />
          <span style={{ fontFamily: mono }}>{sessionStatus.label}</span>
        </div>
      </div>

      <div
        className="flex items-center gap-0 px-4 py-3 mb-6 rounded-md"
        style={{ background: "#161616", border: "1px solid rgba(255,255,255,0.03)" }}
        data-testid="bar-market-pulse"
      >
        <div className="flex-1">
          <p className="text-[9px] tracking-widest uppercase" style={{ fontFamily: mono, color: "#6b7280" }}>IHSG</p>
          <p className="text-xl font-bold text-white" style={{ fontFamily: mono }}>—</p>
          <p className="text-[10px]" style={{ fontFamily: mono, color: "rgba(255,255,255,0.12)" }}>Live IDX</p>
        </div>
        <div className="w-px h-8 mx-6" style={{ background: "rgba(255,255,255,0.08)" }} />
        <div className="flex-1">
          <p className="text-[9px] tracking-widest uppercase" style={{ fontFamily: mono, color: "#6b7280" }}>VOLUME PASAR</p>
          <p className="text-xl font-bold text-white" style={{ fontFamily: mono }}>—</p>
          <p className="text-[10px]" style={{ fontFamily: mono, color: "rgba(255,255,255,0.12)" }}>Live IDX</p>
        </div>
        <div className="w-px h-8 mx-6" style={{ background: "rgba(255,255,255,0.08)" }} />
        <div className="flex-1">
          <p className="text-[9px] tracking-widest uppercase" style={{ fontFamily: mono, color: "#6b7280" }}>NET FOREIGN</p>
          <p className="text-xl font-bold text-white" style={{ fontFamily: mono }}>—</p>
          <p className="text-[10px]" style={{ fontFamily: mono, color: "rgba(255,255,255,0.12)" }}>Live IDX</p>
        </div>
        <div className="w-px h-8 mx-6" style={{ background: "rgba(255,255,255,0.08)" }} />
        <div className="flex-1">
          <p className="text-[9px] tracking-widest uppercase" style={{ fontFamily: mono, color: "#6b7280" }}>STATUS PASAR</p>
          <p className="text-sm font-bold" style={{ fontFamily: mono, color: statusValueColor }}>{sessionStatus.label}</p>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div>
          <div className="rounded-md p-4 mb-4" style={{ background: "#161616", border: "1px solid rgba(255,255,255,0.03)" }} data-testid="card-ihsg-chart">
            <div className="flex items-center justify-between mb-4">
              <span className="text-[9px] tracking-widest uppercase" style={{ fontFamily: mono, color: "#6b7280" }}>
                INDEKS HARGA SAHAM GABUNGAN
              </span>
              <LiveIDXBadge />
            </div>
            <div
              className="h-48 rounded-sm flex flex-col items-center justify-center"
              style={{ background: "#111111", border: "1px dashed rgba(255,255,255,0.03)" }}
            >
              <p className="text-3xl mb-2" style={{ color: "rgba(255,255,255,0.03)" }}>◎</p>
              <p className="text-[10px] text-center" style={{ fontFamily: mono, color: "rgba(255,255,255,0.12)" }}>
                Grafik IHSG tersedia dengan data IDX live
              </p>
              <p className="text-[9px] mt-1" style={{ fontFamily: mono, color: "rgba(255,255,255,0.08)" }}>
                PT Berkat Digital Investasi
              </p>
            </div>
          </div>

          <div className="rounded-md p-4 mb-4" style={{ background: "#161616", border: "1px solid rgba(255,255,255,0.03)" }} data-testid="card-sector-heatmap">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[9px] tracking-widest uppercase" style={{ fontFamily: mono, color: "#6b7280" }}>
                PERFORMA SEKTOR HARI INI
              </span>
              <LiveIDXBadge />
            </div>

            {sectorRotation ? (
              <>
                {sectorRotation.dominantTheme && (
                  <div
                    className="rounded-sm px-3 py-2 mb-3"
                    style={{
                      background: "#0d1a0d",
                      border: "1px solid rgba(16,185,129,0.15)",
                      fontFamily: mono,
                      fontSize: 10,
                      color: "rgba(52,211,153,0.8)",
                    }}
                    data-testid="banner-dominant-theme"
                  >
                    ◎ {sectorRotation.dominantTheme}
                  </div>
                )}

                <div className="grid grid-cols-3 gap-2">
                  {sectorRotation.sectors?.map((s: any) => {
                    const borderColor =
                      s.direction === "MASUK" ? "rgba(16,185,129,0.3)" :
                      s.direction === "KELUAR" ? "rgba(239,68,68,0.3)" :
                      "rgba(255,255,255,0.03)";
                    const scoreColor =
                      s.direction === "MASUK" ? "#34d399" :
                      s.direction === "KELUAR" ? "#f87171" :
                      "#ffffff";
                    const dirLabel =
                      s.direction === "MASUK" ? "↑ Masuk" :
                      s.direction === "KELUAR" ? "↓ Keluar" :
                      "→ Netral";
                    const dirColor =
                      s.direction === "MASUK" ? "#34d399" :
                      s.direction === "KELUAR" ? "#f87171" :
                      "#6b7280";
                    return (
                      <div
                        key={s.sector}
                        className="rounded-sm p-3 transition-colors hover:border-[#ffffff15] relative"
                        style={{ background: "#111111", border: `1px solid ${borderColor}` }}
                        data-testid={`sector-tile-${s.sector}`}
                      >
                        {(s.momentum === "NAIK" || s.momentum === "TURUN") && (
                          <span
                            className="absolute top-2 right-2"
                            style={{
                              fontFamily: mono,
                              fontSize: 9,
                              color: s.momentum === "NAIK" ? "rgba(52,211,153,0.6)" : "rgba(248,113,113,0.6)",
                            }}
                          >
                            {s.momentum === "NAIK" ? "▲" : "▼"}
                          </span>
                        )}
                        <p className="text-[10px] truncate mb-1" style={{ fontFamily: mono, color: "#6b7280" }}>
                          {s.displayName}
                        </p>
                        <p className="text-xl font-bold" style={{ fontFamily: mono, color: scoreColor }}>
                          {s.rotationScore}
                        </p>
                        <p className="text-[9px] mt-0.5" style={{ fontFamily: mono, color: dirColor }}>
                          {dirLabel}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <div className="grid grid-cols-3 gap-2 mt-2">
                {SECTORS.map((s) => (
                  <div
                    key={s}
                    className="rounded-sm p-3"
                    style={{ background: "#111111", border: "1px solid rgba(255,255,255,0.03)" }}
                  >
                    <p className="text-[10px] truncate" style={{ fontFamily: mono, color: "#6b7280" }}>{s}</p>
                    <p className="text-sm font-bold" style={{ fontFamily: mono, color: "rgba(255,255,255,0.12)" }}>—%</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {sectorRotation && sectorRotation.hotSectors.length > 0 && (
            <div
              className="rounded-md p-4 mb-4"
              style={{ background: "#161616", border: "1px solid rgba(255,255,255,0.03)" }}
              data-testid="card-saham-unggulan"
            >
              <p className="text-[9px] tracking-widest uppercase mb-3" style={{ fontFamily: mono, color: "#6b7280" }}>
                SAHAM UNGGULAN DI SEKTOR PANAS
              </p>
              {sectorRotation.hotSectors.slice(0, 2).map((sectorKey: string) => {
                const sectorObj = sectorRotation.sectors.find((x) => x.sector === sectorKey);
                if (!sectorObj) return null;
                return (
                  <div key={sectorKey} className="mb-4 last:mb-0">
                    <p className="text-[10px] mb-2" style={{ fontFamily: mono, color: "#38BDF8" }}>
                      {sectorObj.displayName}
                    </p>
                    {sectorObj.topStocks.map((ts, i) => {
                      const scoreColor =
                        ts.readinessScore >= 60 ? "#34d399" :
                        ts.readinessScore >= 40 ? "#fbbf24" :
                        "#f87171";
                      const cycleLabel =
                        ts.cyclePosition === "ENTRY_WINDOW" ? "Entry Window" :
                        ts.cyclePosition === "KONFIRMASI_MULAI" ? "Konfirmasi" :
                        null;
                      const cycleColor =
                        ts.cyclePosition === "ENTRY_WINDOW" ? "rgba(52,211,153,0.7)" :
                        ts.cyclePosition === "KONFIRMASI_MULAI" ? "rgba(56,189,248,0.7)" :
                        "#6b7280";
                      return (
                        <div
                          key={ts.symbol}
                          className="flex items-center gap-3 py-1.5"
                          style={{ borderBottom: i < sectorObj.topStocks.length - 1 ? "1px solid rgba(255,255,255,0.02)" : "none" }}
                          data-testid={`row-saham-unggulan-${ts.symbol}`}
                        >
                          <div
                            className="w-5 h-5 rounded-sm flex-shrink-0 flex items-center justify-center overflow-hidden"
                            style={{ background: "#1e1e1e", border: "1px solid rgba(255,255,255,0.06)" }}
                          >
                            <img
                              src={`https://assets.stockbit.com/logos/companies/${ts.symbol}.png`}
                              alt={ts.symbol}
                              className="w-3.5 h-3.5 object-contain"
                              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                            />
                          </div>
                          <span className="text-sm font-bold text-white w-14" style={{ fontFamily: sora }}>
                            {ts.symbol}
                          </span>
                          <span className="text-xs font-bold" style={{ fontFamily: mono, color: scoreColor }}>
                            {ts.readinessScore}
                          </span>
                          {cycleLabel && (
                            <span className="text-[9px]" style={{ fontFamily: mono, color: cycleColor }}>
                              {cycleLabel}
                            </span>
                          )}
                          <a
                            href={`/stock/${ts.symbol}`}
                            className="ml-auto text-[10px] hover:text-white transition-colors"
                            style={{ fontFamily: mono, color: "#6b7280" }}
                            data-testid={`link-detail-${ts.symbol}`}
                          >
                            DETAIL →
                          </a>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div>
          <div className="rounded-md p-4 mb-4" style={{ background: "#161616", border: "1px solid rgba(255,255,255,0.03)" }} data-testid="card-top-akumulasi">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[9px] tracking-widest uppercase" style={{ fontFamily: mono, color: "#6b7280" }}>
                TOP AKUMULASI
              </span>
              <LiveIDXBadge />
            </div>
            {topAkumulasi.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-[10px]" style={{ fontFamily: mono, color: "rgba(255,255,255,0.12)" }}>
                  Tidak ada akumulasi aktif terdeteksi
                </p>
              </div>
            ) : (
              topAkumulasi.map((stock, i) => {
                const cp = parseFloat(stock.changePercent);
                return (
                  <div
                    key={stock.symbol}
                    className="flex items-center gap-3 py-2"
                    style={{ borderBottom: i < topAkumulasi.length - 1 ? "1px solid rgba(255,255,255,0.02)" : "none" }}
                    data-testid={`row-top-akumulasi-${stock.symbol}`}
                  >
                    <StockLogo symbol={stock.symbol} />
                    <span className="text-sm font-bold text-white w-16" style={{ fontFamily: sora }}>{stock.symbol}</span>
                    <span className="text-[10px] flex-1 truncate" style={{ fontFamily: mono, color: "#6b7280" }}>{stock.name}</span>
                    <span
                      className="text-sm font-bold w-12 text-right"
                      style={{
                        fontFamily: mono,
                        color: stock.readinessScore >= 80 ? "#34d399" : stock.readinessScore >= 60 ? "#fbbf24" : "#f87171",
                      }}
                    >
                      {stock.readinessScore}
                    </span>
                    <span
                      className={`text-xs w-16 text-right ${cp > 0 ? "text-emerald-400" : cp < 0 ? "text-red-400" : "text-[#6b7280]"}`}
                      style={{ fontFamily: mono }}
                    >
                      {cp > 0 ? `+${cp.toFixed(2)}%` : cp < 0 ? `${cp.toFixed(2)}%` : "0.00%"}
                    </span>
                  </div>
                );
              })
            )}
          </div>

          <div className="rounded-md p-4 mb-4" style={{ background: "#161616", border: "1px solid rgba(255,255,255,0.03)" }} data-testid="card-aktivitas-asing">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[9px] tracking-widest uppercase" style={{ fontFamily: mono, color: "#6b7280" }}>
                AKTIVITAS ASING
              </span>
              <LiveIDXBadge />
            </div>
            {["Net Foreign Flow", "Foreign Buy", "Foreign Sell"].map((label, i) => (
              <div
                key={label}
                className="flex justify-between items-center py-2"
                style={{ borderBottom: i < 2 ? "1px solid rgba(255,255,255,0.02)" : "none" }}
              >
                <span className="text-[10px]" style={{ fontFamily: mono, color: "#6b7280" }}>{label}</span>
                <span className="text-sm" style={{ fontFamily: mono, color: "rgba(255,255,255,0.12)" }}>—</span>
              </div>
            ))}
            <p className="text-[9px] mt-3" style={{ fontFamily: mono, color: "rgba(255,255,255,0.08)" }}>
              Data asing real-time tersedia dengan lisensi IDX
            </p>
          </div>

          <div className="rounded-md p-4" style={{ background: "#161616", border: "1px solid rgba(255,255,255,0.03)" }} data-testid="card-top-broker">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[9px] tracking-widest uppercase" style={{ fontFamily: mono, color: "#6b7280" }}>
                TOP BROKER
              </span>
              <LiveIDXBadge />
            </div>
            {[1, 2, 3, 4, 5].map((rank, i) => (
              <div
                key={rank}
                className="flex items-center gap-3 py-2"
                style={{ borderBottom: i < 4 ? "1px solid rgba(255,255,255,0.02)" : "none" }}
              >
                <span className="text-[10px] w-4" style={{ fontFamily: mono, color: "rgba(255,255,255,0.19)" }}>#{rank}</span>
                <span className="text-sm font-bold w-8" style={{ fontFamily: mono, color: "rgba(255,255,255,0.12)" }}>—</span>
                <span className="text-[10px] flex-1" style={{ fontFamily: mono, color: "rgba(255,255,255,0.12)" }}>—</span>
                <span className="text-xs" style={{ fontFamily: mono, color: "rgba(255,255,255,0.12)" }}>—</span>
              </div>
            ))}
            <p className="text-[9px] mt-2" style={{ fontFamily: mono, color: "rgba(255,255,255,0.08)" }}>
              Data broker real-time tersedia dengan lisensi IDX
            </p>
          </div>
        </div>
      </div>

      {macroContext && (
        <div className="mt-6 mb-4" data-testid="section-macro-context">
          <p className="text-[10px] tracking-[0.2em] uppercase mb-3" style={{ fontFamily: mono, color: "#38BDF8" }}>
            KONDISI MAKRO SAAT INI
          </p>
          <p className="text-[10px] mb-4" style={{ fontFamily: mono, color: "#6b7280" }}>
            Sinyal komoditas dan forex yang mempengaruhi sektor IDX
          </p>

          <div
            className="rounded-md px-4 py-3 mb-4 flex items-center justify-between"
            style={{ background: "#161616", border: "1px solid rgba(255,255,255,0.03)" }}
            data-testid="bar-market-sentiment"
          >
            {(() => {
              const sentiment = macroContext.marketSentiment;
              const bg =
                sentiment === "RISK_ON" ? "rgba(16,185,129,0.1)" :
                sentiment === "RISK_OFF" ? "rgba(239,68,68,0.1)" :
                "rgba(255,255,255,0.02)";
              const color =
                sentiment === "RISK_ON" ? "#34d399" :
                sentiment === "RISK_OFF" ? "#f87171" :
                "#6b7280";
              const border =
                sentiment === "RISK_ON" ? "rgba(16,185,129,0.3)" :
                sentiment === "RISK_OFF" ? "rgba(239,68,68,0.3)" :
                "rgba(255,255,255,0.06)";
              const label =
                sentiment === "RISK_ON" ? "RISK ON" :
                sentiment === "RISK_OFF" ? "RISK OFF" :
                "NETRAL";
              return (
                <span
                  className="px-3 py-1 rounded-sm border"
                  style={{ background: bg, color, borderColor: border, fontFamily: mono, fontSize: 12 }}
                  data-testid={`badge-sentiment-${sentiment}`}
                >
                  {label}
                </span>
              );
            })()}
            <span
              className="max-w-sm text-right"
              style={{ fontFamily: mono, fontSize: 10, color: "#6b7280" }}
            >
              {macroContext.sentimentReason}
            </span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            {(() => {
              const cards: Array<{ key: string; label: string; price: string; change: number | null; source: string }> = [
                {
                  key: "oil",
                  label: "MINYAK WTI",
                  price: macroContext.oil?.currentPrice != null ? `USD ${macroContext.oil.currentPrice.toLocaleString("en-US", { minimumFractionDigits: 2 })}` : "—",
                  change: macroContext.oil?.change5d ?? null,
                  source: macroContext.oil?.source ?? "FALLBACK",
                },
                {
                  key: "gold",
                  label: "EMAS",
                  price: macroContext.gold?.currentPrice != null ? `USD ${macroContext.gold.currentPrice.toLocaleString("en-US", { minimumFractionDigits: 2 })}` : "—",
                  change: macroContext.gold?.change5d ?? null,
                  source: macroContext.gold?.source ?? "FALLBACK",
                },
                {
                  key: "usdIdr",
                  label: "USD/IDR",
                  price: macroContext.usdIdr?.currentPrice != null ? `Rp ${macroContext.usdIdr.currentPrice.toLocaleString("id-ID")}` : "—",
                  change: macroContext.usdIdr?.change5d ?? null,
                  source: macroContext.usdIdr?.source ?? "FALLBACK",
                },
                {
                  key: "cpo",
                  label: "CPO",
                  price: altData?.cpo?.priceIDR
                    ? `Rp ${altData.cpo.priceIDR.toLocaleString("id-ID")}/kg`
                    : altData?.cpo?.priceUSD
                      ? `USD ${altData.cpo.priceUSD}/MT`
                      : "—",
                  change: null,
                  source: altData?.cpo?.source ?? "FALLBACK",
                },
              ];
              return cards.map((c) => (
                <div
                  key={c.key}
                  className="rounded-md p-3"
                  style={{ background: "#161616", border: "1px solid rgba(255,255,255,0.03)" }}
                  data-testid={`card-macro-${c.key}`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-[9px] tracking-widest uppercase" style={{ fontFamily: mono, color: "#6b7280" }}>
                      {c.label}
                    </p>
                    <SourceBadge source={c.source} />
                  </div>
                  <p className="text-lg font-bold text-white" style={{ fontFamily: mono }}>
                    {c.price}
                  </p>
                  <p
                    className="mt-1"
                    style={{
                      fontFamily: mono,
                      fontSize: 10,
                      color: c.change == null ? "rgba(255,255,255,0.2)" : c.change > 0 ? "#34d399" : c.change < 0 ? "#f87171" : "#6b7280",
                    }}
                  >
                    {c.change == null ? "—" : c.change > 0 ? `▲ +${c.change.toFixed(2)}%` : c.change < 0 ? `▼ ${c.change.toFixed(2)}%` : `→ 0.00%`}
                  </p>
                </div>
              ));
            })()}
          </div>

          <div
            className="rounded-md p-4 mb-4"
            style={{ background: "#161616", border: "1px solid rgba(255,255,255,0.03)" }}
            data-testid="card-macro-signals"
          >
            <p className="text-[9px] tracking-widest uppercase mb-3" style={{ fontFamily: mono, color: "#6b7280" }}>
              SINYAL MAKRO AKTIF
            </p>
            {macroContext.signals?.length ? (
              macroContext.signals.map((sig: any, i: number) => {
                const sectorMap: Record<string, string> = {
                  "Financials": "Keuangan",
                  "Energy": "Energi",
                  "Industrials": "Industri",
                  "Communication Services": "Telekomunikasi",
                  "Consumer Staples": "Konsumer Primer",
                  "Consumer Discretionary": "Konsumer Sekunder",
                  "Real Estate": "Properti",
                  "Basic Materials": "Material & Tambang",
                  "ALL": "Semua Sektor",
                };
                return (
                  <div
                    key={i}
                    className="flex items-start gap-3 py-2"
                    style={{ borderBottom: i < macroContext.signals.length - 1 ? "1px solid rgba(255,255,255,0.03)" : "none" }}
                    data-testid={`row-signal-${sig.type}`}
                  >
                    <span
                      className="font-bold w-4 flex-shrink-0"
                      style={{
                        fontFamily: mono,
                        fontSize: 14,
                        color: sig.effect === "POSITIF" ? "#34d399" : sig.effect === "NEGATIF" ? "#f87171" : "#6b7280",
                      }}
                    >
                      {sig.effect === "POSITIF" ? "↑" : sig.effect === "NEGATIF" ? "↓" : "→"}
                    </span>
                    <span
                      className="px-2 py-0.5 rounded-sm border flex-shrink-0"
                      style={{
                        background: "rgba(255,255,255,0.02)",
                        borderColor: "rgba(255,255,255,0.06)",
                        fontFamily: mono,
                        fontSize: 9,
                        color: "#38BDF8",
                      }}
                    >
                      {sectorMap[sig.sector] ?? sig.sector}
                    </span>
                    <span
                      className="flex-1"
                      style={{ fontFamily: mono, fontSize: 10, color: "#9ca3af" }}
                    >
                      {sig.description}
                    </span>
                  </div>
                );
              })
            ) : (
              <p style={{ fontFamily: mono, fontSize: 10, color: "rgba(255,255,255,0.2)" }}>
                Tidak ada sinyal makro signifikan saat ini
              </p>
            )}
          </div>
        </div>
      )}

      <div className="mt-6">
        <p className="text-[10px] tracking-[0.2em] uppercase mb-3" style={{ fontFamily: mono, color: "#38BDF8" }} data-testid="text-alt-data-label">
          DATA ALTERNATIF
        </p>
        <p className="text-[10px] mb-4" style={{ fontFamily: mono, color: "#6b7280" }}>
          Sinyal dari sumber data publik Indonesia — aktif
        </p>

        {altLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1, 2, 3].map((k) => (
              <div key={k} className="h-40 rounded-md animate-pulse" style={{ background: "#161616" }} />
            ))}
          </div>
        ) : altError ? (
          <p className="text-[10px]" style={{ fontFamily: mono, color: "rgba(248,113,113,0.5)" }}>
            Gagal memuat data alternatif
          </p>
        ) : altData ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-md p-4" style={{ background: "#161616", border: "1px solid rgba(255,255,255,0.03)" }} data-testid="card-cpo-price">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[9px] tracking-widest uppercase" style={{ fontFamily: mono, color: "#6b7280" }}>
                  HARGA CPO
                </span>
                <SourceBadge source={altData.cpo.source} />
              </div>
              <p className="text-2xl font-bold text-white mb-1" style={{ fontFamily: mono }}>
                {altData.cpo.priceIDR
                  ? `Rp ${altData.cpo.priceIDR.toLocaleString("id-ID")}/kg`
                  : altData.cpo.priceUSD
                    ? `USD ${altData.cpo.priceUSD}/MT`
                    : "—"}
              </p>
              {altData.cpo.trend && (
                <p
                  className={`text-xs ${altData.cpo.trend === "NAIK" ? "text-emerald-400" : altData.cpo.trend === "TURUN" ? "text-red-400" : "text-amber-400"}`}
                  style={{ fontFamily: mono }}
                >
                  {altData.cpo.trend === "NAIK" ? "↑ Naik" : altData.cpo.trend === "TURUN" ? "↓ Turun" : "→ Stabil"}
                </p>
              )}
              <p className="text-[9px] mt-2" style={{ fontFamily: mono, color: "#6b7280" }}>
                Relevan: Konsumer Primer, Basic Materials
              </p>
              <p className="text-[9px] mt-2" style={{ fontFamily: mono, color: "rgba(255,255,255,0.12)" }}>
                Diperbarui: {formatTimestamp(altData.cpo.fetchedAt)}
              </p>
            </div>

            <div className="rounded-md p-4" style={{ background: "#161616", border: "1px solid rgba(255,255,255,0.03)" }} data-testid="card-coal-price">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[9px] tracking-widest uppercase" style={{ fontFamily: mono, color: "#6b7280" }}>
                  HARGA BATUBARA (HBA)
                </span>
                <SourceBadge source={altData.coal.source} />
              </div>
              <p className="text-2xl font-bold text-white mb-1" style={{ fontFamily: mono }}>
                {altData.coal.hba1USD ? `USD ${altData.coal.hba1USD}/ton (GAR 6322)` : "—"}
              </p>
              {altData.coal.trend && (
                <p
                  className={`text-xs ${altData.coal.trend === "NAIK" ? "text-emerald-400" : altData.coal.trend === "TURUN" ? "text-red-400" : "text-amber-400"}`}
                  style={{ fontFamily: mono }}
                >
                  {altData.coal.trend === "NAIK" ? "↑ Naik" : altData.coal.trend === "TURUN" ? "↓ Turun" : "→ Stabil"}
                </p>
              )}
              <div className="mt-2">
                <p className="text-[10px]" style={{ fontFamily: mono, color: "#6b7280" }}>
                  HBA2: USD {altData.coal.hba2USD ?? "—"}/ton
                </p>
                <p className="text-[10px]" style={{ fontFamily: mono, color: "#6b7280" }}>
                  HBA3: USD {altData.coal.hba3USD ?? "—"}/ton
                </p>
              </div>
              <p className="text-[9px] mt-2" style={{ fontFamily: mono, color: "#6b7280" }}>
                Relevan: Energi, Basic Materials
              </p>
              <p className="text-[9px] mt-2" style={{ fontFamily: mono, color: "rgba(255,255,255,0.12)" }}>
                Diperbarui: {formatTimestamp(altData.coal.fetchedAt)}
              </p>
            </div>

            <div className="rounded-md p-4" style={{ background: "#161616", border: "1px solid rgba(255,255,255,0.03)" }} data-testid="card-bmkg-weather">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[9px] tracking-widest uppercase" style={{ fontFamily: mono, color: "#6b7280" }}>
                  CUACA PRODUKSI
                </span>
                {(() => {
                  const regions = altData.weather.filter((w) => WEATHER_REGIONS.includes(w.regionName));
                  const allNull = regions.every((w) => w.rainfallMm === null);
                  return (
                    <span
                      className="px-2 py-0.5 rounded-sm border"
                      style={{
                        fontFamily: mono,
                        fontSize: 9,
                        background: allNull ? "rgba(245,158,11,0.1)" : "rgba(16,185,129,0.1)",
                        color: allNull ? "rgba(245,158,11,0.6)" : "#34d399",
                        borderColor: allNull ? "rgba(245,158,11,0.2)" : "rgba(16,185,129,0.2)",
                      }}
                    >
                      {allNull ? "Degraded" : "Live"}
                    </span>
                  );
                })()}
              </div>
              {altData.weather
                .filter((w) => WEATHER_REGIONS.includes(w.regionName))
                .map((w, i, arr) => (
                  <div
                    key={w.regionId}
                    className="flex items-center justify-between py-1.5"
                    style={{ borderBottom: i < arr.length - 1 ? "1px solid rgba(255,255,255,0.02)" : "none" }}
                  >
                    <span className="text-[10px]" style={{ fontFamily: mono, color: "#6b7280" }}>{w.regionName}</span>
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[10px] ${
                          w.rainfallMm === null
                            ? "text-[#ffffff12]"
                            : w.rainfallMm >= 25
                              ? "text-red-400"
                              : w.rainfallMm >= 10
                                ? "text-amber-400"
                                : w.rainfallMm >= 1
                                  ? "text-sky-400"
                                  : "text-emerald-400"
                        }`}
                        style={{ fontFamily: mono }}
                      >
                        {w.rainfallMm === null
                          ? "—"
                          : w.rainfallMm >= 25
                            ? "⛈ Lebat"
                            : w.rainfallMm >= 10
                              ? "🌧 Sedang"
                              : w.rainfallMm >= 1
                                ? "🌦 Ringan"
                                : "☀ Cerah"}
                      </span>
                      {w.temperature !== null && (
                        <span className="text-[10px]" style={{ fontFamily: mono, color: "#6b7280" }}>
                          {w.temperature}°C
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              <p className="text-[9px] mt-3" style={{ fontFamily: mono, color: "rgba(255,255,255,0.12)" }}>
                Data cuaca dari BMKG · Mempengaruhi produksi perkebunan & tambang
              </p>
            </div>
          </div>
        ) : null}
      </div>

      <p className="mt-8 text-center text-[10px]" style={{ fontFamily: mono, color: "rgba(255,255,255,0.12)" }}>
        Data pasar lengkap tersedia setelah integrasi IDX live · PT Berkat Digital Investasi · Data alternatif: BMKG, ESDM
      </p>
    </div>
  );
}
