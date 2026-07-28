import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Activity } from "lucide-react";

/**
 * Broker net buy/sell (bandarmology) panel — extracted from StockDashboard's
 * "flow" tab so it can also be reused by the terminal-style Beranda page.
 * Self-fetches GET /api/bandarmology/:symbol (Stockbit-sourced; no Yahoo
 * equivalent exists for broker activity data).
 */
export function BandarmologyPanel({ symbol }: { symbol: string }) {
  const [bandarData, setBandarData] = useState<any>(null);
  const [bandarLoading, setBandarLoading] = useState(true);
  const [brokerHistoryFor, setBrokerHistoryFor] = useState<string | null>(null);
  const [brokerHistory, setBrokerHistory] = useState<any[]>([]);
  const [brokerHistoryLoading, setBrokerHistoryLoading] = useState(false);

  useEffect(() => {
    if (!symbol) return;
    let cancelled = false;
    setBandarData(null);
    setBandarLoading(true);
    setBrokerHistoryFor(null);
    setBrokerHistory([]);
    fetch(`/api/bandarmology/${symbol}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled) return;
        if (data && data.symbol) setBandarData(data);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setBandarLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [symbol]);

  if (bandarLoading && !bandarData) {
    return (
      <Card className="p-5 border-border/50 bg-card">
        <Skeleton className="h-4 w-48 mb-4" />
        <div className="grid grid-cols-3 gap-3 mb-4">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-14" />
          ))}
        </div>
        <div className="grid grid-cols-2 gap-4">
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      </Card>
    );
  }

  if (!bandarData) return null;

  const b = (n: number) => `${n >= 0 ? "+" : ""}${(n / 1e9).toLocaleString("id-ID", { maximumFractionDigits: 1 })} M`;
  const fNet = bandarData.foreignNet ?? 0;

  return (
    <Card className="p-5 border-border/50 bg-card">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h3 className="text-base font-bold text-foreground flex items-center gap-2">
          <Activity className="w-4 h-4 text-signal" /> Bandarmology — Broker Net (Stockbit)
        </h3>
        <span
          className="text-xs px-2 py-0.5 rounded-full font-semibold"
          style={{ color: fNet >= 0 ? "var(--positive)" : "var(--danger)", background: fNet >= 0 ? "var(--signal-dim)" : "rgba(220,38,38,0.1)" }}
        >
          {fNet >= 0 ? "AKUMULASI ASING" : "DISTRIBUSI ASING"}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-3 mb-5" style={{ fontVariantNumeric: "tabular-nums" }}>
        {[
          { label: "Net Asing", val: bandarData.foreignNet },
          { label: "Net Lokal", val: bandarData.localNet },
          { label: "Net Pemerintah", val: bandarData.govNet },
        ].map((m) => (
          <div key={m.label} className="rounded-md border border-border/40 bg-surface-2 px-3 py-2.5">
            <div className="text-xs text-text-3 uppercase tracking-wide mb-1">{m.label}</div>
            <div className="text-base font-semibold" style={{ color: (m.val ?? 0) >= 0 ? "var(--positive)" : "var(--danger)" }}>
              {b(m.val ?? 0)}
            </div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {[
          { title: "Top Broker Beli", rows: bandarData.topBuyers ?? [], pos: true },
          { title: "Top Broker Jual", rows: bandarData.topSellers ?? [], pos: false },
        ].map((col) => (
          <div key={col.title}>
            <p className="text-xs font-semibold text-text-3 uppercase tracking-wide mb-2">{col.title}</p>
            <div className="divide-y divide-border/40">
              {col.rows.slice(0, 6).map((r: any, i: number) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => {
                    const next = brokerHistoryFor === r.broker ? null : r.broker;
                    setBrokerHistoryFor(next);
                    if (next) {
                      setBrokerHistoryLoading(true);
                      fetch(`/api/bandarmology/${symbol}/broker/${next}/history?limit=30`)
                        .then((res) => (res.ok ? res.json() : null))
                        .then((data) => setBrokerHistory(data?.history ?? []))
                        .catch(() => setBrokerHistory([]))
                        .finally(() => setBrokerHistoryLoading(false));
                    }
                  }}
                  className="w-full flex items-center justify-between py-1.5 hover:bg-surface-2 rounded transition-colors text-left"
                  style={{ fontVariantNumeric: "tabular-nums" }}
                >
                  <span className="text-sm font-semibold text-foreground underline decoration-dotted">{r.broker}</span>
                  <span className="text-xs text-text-4">{r.type === "FOREIGN" ? "Asing" : r.type === "GOVERNMENT" ? "Pemerintah" : "Lokal"}</span>
                  <span className="text-sm font-medium w-24 text-right" style={{ color: col.pos ? "var(--positive)" : "var(--danger)" }}>
                    {b(r.value)}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
      <p className="text-xs text-text-4 mt-3">
        Sumber: Stockbit · {bandarData.brokerCount} broker · {bandarData.date}
      </p>

      {brokerHistoryFor && (
        <div className="mt-4 pt-4 border-t border-border/40">
          <p className="text-xs font-semibold text-text-3 uppercase tracking-wide mb-2">Aktivitas Harian — {brokerHistoryFor}</p>
          {brokerHistoryLoading && <p className="text-xs text-text-4">Memuat riwayat...</p>}
          {!brokerHistoryLoading && brokerHistory.length === 0 && (
            <p className="text-xs text-text-4">Belum ada riwayat tersimpan untuk broker ini di saham ini.</p>
          )}
          {!brokerHistoryLoading && brokerHistory.length > 0 && (
            <div className="max-h-64 overflow-y-auto divide-y divide-border/40">
              {brokerHistory.map((h: any) => (
                <div key={h.date} className="grid grid-cols-4 gap-2 py-1.5 text-xs" style={{ fontVariantNumeric: "tabular-nums" }}>
                  <span className="text-text-3">{h.date}</span>
                  <span className="font-medium" style={{ color: h.netValue >= 0 ? "var(--positive)" : "var(--danger)" }}>
                    {b(h.netValue)}
                  </span>
                  <span className="text-text-4">{h.netLot.toLocaleString("id-ID")} lot</span>
                  <span className="text-text-4 text-right">
                    {h.closePrice != null ? h.closePrice.toLocaleString("id-ID") : "-"}
                    {h.changePct != null && (
                      <span className={h.changePct >= 0 ? "text-[var(--positive)]" : "text-[var(--danger)]"}>
                        {" "}
                        ({h.changePct >= 0 ? "+" : ""}
                        {h.changePct.toFixed(2)}%)
                      </span>
                    )}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
