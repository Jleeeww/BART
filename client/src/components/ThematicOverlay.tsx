import { useQuery } from "@tanstack/react-query";
import { Sparkles } from "lucide-react";

const mono = "'JetBrains Mono', 'IBM Plex Mono', monospace";

interface ThematicFlag {
  symbol: string;
  theme: string;
  direction: "POSITIF" | "NEGATIF" | "NETRAL";
  sector: string | null;
  rationale: string;
  confidence: string;
  sourceUrls: string[];
}

interface ThematicSymbolResponse {
  symbol: string;
  flags: ThematicFlag[];
  updatedAt: string | null;
}

const dirColor: Record<string, string> = {
  POSITIF: "var(--positive)",
  NEGATIF: "var(--danger)",
  NETRAL: "var(--text-3)",
};

/**
 * "Interpretasi AI · Tema Pasar" overlay for the stock-detail page.
 * PURE OVERLAY — this reads the thematic scanner output only; it never affects
 * the deterministic score, which is rendered separately above.
 */
export function ThematicOverlay({ symbol }: { symbol: string }) {
  const { data } = useQuery<ThematicSymbolResponse>({
    queryKey: [`/api/thematic/symbol/${symbol}`],
  });

  const flags = data?.flags ?? [];
  if (!flags.length) return null; // no theme touches this stock — stay quiet

  const updated = data?.updatedAt ? new Date(data.updatedAt).toLocaleString("id-ID") : "";

  return (
    <div
      style={{
        background: "var(--surface-1)",
        border: "1px solid var(--signal)",
        borderRadius: 10,
        padding: "14px 18px",
      }}
      data-testid="card-thematic-overlay"
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
        <Sparkles size={14} style={{ color: "var(--signal)" }} />
        <span style={{ fontFamily: mono, fontSize: 12, letterSpacing: "0.1em", color: "var(--signal)", fontWeight: 700 }}>
          TEMA PASAR · INTERPRETASI AI
        </span>
        {updated && (
          <span style={{ fontFamily: mono, fontSize: 11, color: "var(--text-4)" }}>diperbarui {updated}</span>
        )}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {flags.map((f, i) => (
          <div key={i} style={{ borderTop: i > 0 ? "1px solid var(--border-2)" : "none", paddingTop: i > 0 ? 10 : 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
              <span style={{ fontFamily: mono, fontSize: 12, fontWeight: 700, color: dirColor[f.direction] ?? "var(--text-3)" }}>
                {f.direction}
              </span>
              <span style={{ fontFamily: mono, fontSize: 11, color: "var(--text-4)" }}>· {f.theme}</span>
              <span style={{ fontFamily: mono, fontSize: 11, color: "var(--text-3)", marginLeft: "auto" }}>
                keyakinan: {f.confidence}
              </span>
            </div>
            <p style={{ fontFamily: mono, fontSize: 12, color: "var(--text-2)", lineHeight: 1.7, margin: 0 }}>
              {f.rationale}
            </p>
            {f.sourceUrls?.length > 0 && (
              <div style={{ marginTop: 4, display: "flex", gap: 8, flexWrap: "wrap" }}>
                {f.sourceUrls.slice(0, 3).map((u, j) => (
                  <a key={j} href={u} target="_blank" rel="noreferrer"
                    style={{ fontFamily: mono, fontSize: 11, color: "var(--signal)" }}>
                    sumber {j + 1}
                  </a>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <p style={{ fontFamily: mono, fontSize: 11, color: "var(--text-4)", lineHeight: 1.6, marginTop: 10, marginBottom: 0 }}>
        Interpretasi AI dari berita publik — bukan bagian dari skor deterministik, bukan sinyal pasti, bukan rekomendasi.
      </p>
    </div>
  );
}
