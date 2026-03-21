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
            <div className="grid grid-cols-3 gap-2 mt-2">
              {SECTORS.map((s) => (
                <div
                  key={s}
                  className="rounded-sm p-3 transition-colors hover:border-[#ffffff15]"
                  style={{ background: "#111111", border: "1px solid rgba(255,255,255,0.03)" }}
                >
                  <p className="text-[10px] truncate" style={{ fontFamily: mono, color: "#6b7280" }}>{s}</p>
                  <p className="text-sm font-bold" style={{ fontFamily: mono, color: "rgba(255,255,255,0.12)" }}>—%</p>
                </div>
              ))}
            </div>
          </div>
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
