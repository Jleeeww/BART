import { useQuery } from "@tanstack/react-query";
import { Sparkles, ExternalLink } from "lucide-react";

const mono = "'JetBrains Mono', 'IBM Plex Mono', monospace";

interface Theme {
  id: string;
  title: string;
  summary: string;
  category: string;
  keywords: string[];
  confidence: string;
}
interface Flag {
  id: number;
  symbol: string;
  theme: string;
  direction: "POSITIF" | "NEGATIF" | "NETRAL";
  sector: string | null;
  rationale: string;
  confidence: string;
  sourceUrls: string[] | null;
}
interface LatestResponse {
  scan: {
    id: number;
    scanAt: string;
    slot: string;
    status: string;
    themes: Theme[] | null;
    narrative: string | null;
    eventCount: number | null;
  } | null;
  flags: Flag[];
  message?: string;
}

const dirColor: Record<string, string> = {
  POSITIF: "var(--positive)",
  NEGATIF: "var(--danger)",
  NETRAL: "var(--text-3)",
};

export default function TemaPasarPage() {
  const { data, isLoading } = useQuery<LatestResponse>({ queryKey: ["/api/thematic/latest"] });

  const scan = data?.scan ?? null;
  const themes = scan?.themes ?? [];
  const flags = data?.flags ?? [];
  const updated = scan?.scanAt ? new Date(scan.scanAt).toLocaleString("id-ID") : "";

  return (
    <div style={{ padding: "48px 32px", maxWidth: 960, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
        <Sparkles size={20} style={{ color: "var(--signal)" }} />
        <h1 style={{ fontFamily: mono, fontSize: 22, fontWeight: 700, color: "var(--text-1)", margin: 0 }}>
          Tema Pasar
        </h1>
        <span style={{ fontFamily: mono, fontSize: 11, fontWeight: 700, color: "var(--signal)", border: "1px solid var(--signal)", borderRadius: 4, padding: "1px 6px" }}>
          INTERPRETASI AI
        </span>
      </div>
      <p style={{ fontFamily: mono, fontSize: 12, color: "var(--text-3)", lineHeight: 1.7, marginBottom: 24 }}>
        Analisis AI atas berita &amp; peristiwa pasar — pemetaan tema → sektor → saham. Bukan bagian dari skor deterministik,
        bukan sinyal pasti, bukan rekomendasi.
        {updated && <span style={{ color: "var(--text-4)" }}> · diperbarui {updated}</span>}
      </p>

      {isLoading && (
        <div style={{ height: 120, background: "var(--surface-1)", borderRadius: 10, border: "1px solid var(--border-2)" }} className="animate-pulse" />
      )}

      {!isLoading && (!scan || scan.status === "NO_CATALYST" || themes.length === 0) && (
        <div style={{ background: "var(--surface-1)", border: "1px solid var(--border-2)", borderRadius: 10, padding: "24px", textAlign: "center" }}>
          <p style={{ fontFamily: mono, fontSize: 13, color: "var(--text-3)", margin: 0 }}>
            {scan?.narrative || data?.message || "Tidak ada katalis signifikan hari ini."}
          </p>
        </div>
      )}

      {!isLoading && themes.length > 0 && (
        <>
          {scan?.narrative && (
            <div style={{ background: "var(--surface-1)", border: "1px solid var(--signal)", borderRadius: 10, padding: "14px 18px", marginBottom: 20 }}>
              <p style={{ fontFamily: mono, fontSize: 13, color: "var(--text-2)", lineHeight: 1.7, margin: 0 }}>{scan.narrative}</p>
            </div>
          )}

          {/* Themes */}
          <h2 style={{ fontFamily: mono, fontSize: 13, letterSpacing: "0.1em", color: "var(--text-3)", fontWeight: 700, marginBottom: 12 }}>TEMA HARI INI</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 28 }}>
            {themes.map((t) => (
              <div key={t.id} style={{ background: "var(--surface-1)", border: "1px solid var(--border-2)", borderRadius: 10, padding: "14px 18px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                  <span style={{ fontFamily: mono, fontSize: 11, fontWeight: 700, color: "var(--signal)", border: "1px solid var(--border-2)", borderRadius: 4, padding: "1px 6px" }}>{t.category}</span>
                  <span style={{ fontFamily: mono, fontSize: 13, fontWeight: 700, color: "var(--text-1)" }}>{t.title}</span>
                  <span style={{ fontFamily: mono, fontSize: 11, color: "var(--text-4)", marginLeft: "auto" }}>keyakinan: {t.confidence}</span>
                </div>
                <p style={{ fontFamily: mono, fontSize: 12, color: "var(--text-3)", lineHeight: 1.7, margin: 0 }}>{t.summary}</p>
              </div>
            ))}
          </div>

          {/* Flagged stocks */}
          {flags.length > 0 && (
            <>
              <h2 style={{ fontFamily: mono, fontSize: 13, letterSpacing: "0.1em", color: "var(--text-3)", fontWeight: 700, marginBottom: 12 }}>SAHAM TERDAMPAK</h2>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {flags.map((f) => (
                  <div key={f.id} style={{ background: "var(--surface-1)", border: "1px solid var(--border-2)", borderRadius: 10, padding: "12px 16px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4, flexWrap: "wrap" }}>
                      <a href={`/stock/${f.symbol}`} style={{ fontFamily: mono, fontSize: 14, fontWeight: 700, color: "var(--text-1)" }}>{f.symbol}</a>
                      {f.sector && <span style={{ fontFamily: mono, fontSize: 11, color: "var(--text-4)" }}>{f.sector}</span>}
                      <span style={{ fontFamily: mono, fontSize: 12, fontWeight: 700, color: dirColor[f.direction] ?? "var(--text-3)" }}>{f.direction}</span>
                      <span style={{ fontFamily: mono, fontSize: 11, color: "var(--text-4)", marginLeft: "auto" }}>keyakinan: {f.confidence}</span>
                    </div>
                    <p style={{ fontFamily: mono, fontSize: 12, color: "var(--text-2)", lineHeight: 1.7, margin: 0 }}>{f.rationale}</p>
                    {f.sourceUrls && f.sourceUrls.length > 0 && (
                      <div style={{ marginTop: 4, display: "flex", gap: 10, flexWrap: "wrap" }}>
                        {f.sourceUrls.slice(0, 3).map((u, j) => (
                          <a key={j} href={u} target="_blank" rel="noreferrer" style={{ fontFamily: mono, fontSize: 11, color: "var(--signal)", display: "inline-flex", alignItems: "center", gap: 3 }}>
                            sumber {j + 1} <ExternalLink size={10} />
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}

      <p style={{ fontFamily: mono, fontSize: 11, color: "var(--text-4)", lineHeight: 1.6, marginTop: 28 }}>
        Seluruh interpretasi dihasilkan AI dari berita publik. Bukan rekomendasi transaksi. Skor deterministik saham ditampilkan terpisah dan tidak dipengaruhi tema ini.
      </p>
    </div>
  );
}
