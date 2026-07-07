import { useEffect, useState } from "react";
import { Link } from "wouter";
import { TrendingUp, TrendingDown, Activity, Landmark, Coins } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

function SkeletonRows({ n = 5 }: { n?: number }) {
  return (
    <div>
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} className="flex items-center justify-between py-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-16" />
        </div>
      ))}
    </div>
  );
}

/**
 * Official IDX market data panel: daily movers (gainers / losers / most active),
 * key indices (IHSG + LQ45…), and recent dividend announcements. Theme-aware,
 * uses semantic tokens + tabular figures.
 */
interface Mover { code: string; name: string; close: number | null; changePercent: number | null; value: number | null; }
interface IdxIndex { code: string; value: number | null; change: number | null; percent: number | null; }
interface Dividend { code: string; name: string; cashDividend: number | null; }

const fmtNum = (n: number | null, d = 0) =>
  n == null ? "—" : n.toLocaleString("id-ID", { minimumFractionDigits: d, maximumFractionDigits: d });
const fmtBn = (n: number | null) => (n == null ? "—" : `${(n / 1e9).toLocaleString("id-ID", { maximumFractionDigits: 0 })} M`);

const KEY_INDICES = ["COMPOSITE", "LQ45", "IDX30", "IDX80", "IDXBUMN20", "SRI-KEHATI"];

function MoverRow({ m }: { m: Mover }) {
  const up = (m.changePercent ?? 0) >= 0;
  return (
    <Link href={`/stock/${m.code}`}>
      <div className="flex items-center justify-between py-2 px-1 rounded hover:bg-surface-2 cursor-pointer transition-colors">
        <div className="min-w-0">
          <span className="text-sm font-semibold text-foreground">{m.code}</span>
          <span className="text-xs text-text-3 ml-2 truncate">{m.name}</span>
        </div>
        <div className="flex items-center gap-3 shrink-0" style={{ fontVariantNumeric: "tabular-nums" }}>
          <span className="text-sm text-text-2">{fmtNum(m.close)}</span>
          <span className="text-sm font-semibold w-16 text-right" style={{ color: up ? "var(--positive)" : "var(--danger)" }}>
            {up ? "+" : ""}{fmtNum(m.changePercent, 2)}%
          </span>
        </div>
      </div>
    </Link>
  );
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border/50 bg-card p-4">
      <h3 className="text-sm font-bold text-foreground flex items-center gap-2 mb-3">{icon}{title}</h3>
      {children}
    </div>
  );
}

export function IDXMarketPanel() {
  const [movers, setMovers] = useState<{ gainers: Mover[]; losers: Mover[]; mostActive: Mover[] } | null>(null);
  const [indices, setIndices] = useState<IdxIndex[]>([]);
  const [dividends, setDividends] = useState<Dividend[]>([]);
  const [tab, setTab] = useState<"gainers" | "losers" | "mostActive">("gainers");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    Promise.allSettled([
      fetch("/api/idx/movers?limit=8").then(r => r.ok ? r.json() : null).then(d => d && setMovers(d)),
      fetch("/api/idx/indices").then(r => r.ok ? r.json() : null).then(d => d?.indices && setIndices(d.indices)),
      fetch("/api/idx/dividends").then(r => r.ok ? r.json() : null).then(d => d?.dividends && setDividends(d.dividends)),
    ]).finally(() => setLoaded(true));
  }, []);

  const keyIndices = KEY_INDICES.map(c => indices.find(i => i.code === c)).filter(Boolean) as IdxIndex[];
  const rows = movers?.[tab] ?? [];
  const tabs: { key: typeof tab; label: string; icon: React.ReactNode }[] = [
    { key: "gainers", label: "Top Gainer", icon: <TrendingUp className="w-3.5 h-3.5" /> },
    { key: "losers", label: "Top Loser", icon: <TrendingDown className="w-3.5 h-3.5" /> },
    { key: "mostActive", label: "Teraktif", icon: <Activity className="w-3.5 h-3.5" /> },
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Indices */}
      <Section icon={<Landmark className="w-4 h-4 text-signal" />} title="Indeks IDX">
        <div className="space-y-1.5">
          {keyIndices.length === 0 ? (loaded ? <p className="text-sm text-text-4">Data tidak tersedia</p> : <SkeletonRows n={6} />) : keyIndices.map(ix => {
            const up = (ix.percent ?? 0) >= 0;
            return (
              <div key={ix.code} className="flex items-center justify-between py-1" style={{ fontVariantNumeric: "tabular-nums" }}>
                <span className="text-sm text-text-2">{ix.code === "COMPOSITE" ? "IHSG" : ix.code}</span>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold text-foreground">{fmtNum(ix.value, 2)}</span>
                  <span className="text-xs w-14 text-right" style={{ color: up ? "var(--positive)" : "var(--danger)" }}>
                    {up ? "+" : ""}{fmtNum(ix.percent, 2)}%
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </Section>

      {/* Movers with tabs */}
      <Section icon={tabs.find(t => t.key === tab)!.icon} title="Pergerakan Harian">
        <div className="flex gap-1 mb-2">
          {tabs.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors ${tab === t.key ? "bg-signal-dim text-signal" : "text-text-3 hover:text-foreground"}`}>
              {t.icon}{t.label}
            </button>
          ))}
        </div>
        <div>{rows.length === 0 ? (loaded ? <p className="text-sm text-text-4 py-2">Data tidak tersedia</p> : <SkeletonRows n={6} />) : rows.map(m => <MoverRow key={m.code} m={m} />)}</div>
        {tab === "mostActive" && rows.length > 0 && (
          <p className="text-xs text-text-4 mt-2">Nilai transaksi: {fmtBn(rows[0].value)} tertinggi</p>
        )}
      </Section>

      {/* Dividends */}
      <Section icon={<Coins className="w-4 h-4 text-warning" />} title="Dividen Terbaru">
        <div className="space-y-1">
          {dividends.length === 0 ? (loaded ? <p className="text-sm text-text-4">Tidak ada data</p> : <SkeletonRows n={6} />) : dividends.slice(0, 8).map((d, i) => (
            <Link key={`${d.code}-${i}`} href={`/stock/${d.code}`}>
              <div className="flex items-center justify-between py-1.5 px-1 rounded hover:bg-surface-2 cursor-pointer transition-colors">
                <span className="text-sm font-semibold text-foreground">{d.code}</span>
                <span className="text-sm text-text-2" style={{ fontVariantNumeric: "tabular-nums" }}>Rp {fmtNum(d.cashDividend, 2)}</span>
              </div>
            </Link>
          ))}
        </div>
      </Section>
    </div>
  );
}
