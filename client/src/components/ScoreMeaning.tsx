import { Info } from "lucide-react";

const mono = "'JetBrains Mono', 'IBM Plex Mono', monospace";

interface ScoreMeaningProps {
  score: number | null;
}

/**
 * "Skor ini mengukur apa?" — score-meaning education (macro hardening item 3)
 * plus the IHSG-correlation disclaimer shown beside any score > 50 (item 5).
 * Legally important + honest: a score is NOT a price prediction.
 */
export function ScoreMeaning({ score }: ScoreMeaningProps) {
  const showCorrelation = typeof score === "number" && score > 50;

  return (
    <div
      style={{
        background: "var(--surface-1)",
        border: "1px solid var(--border-2)",
        borderRadius: 10,
        padding: "14px 18px",
      }}
      data-testid="card-score-meaning"
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <Info size={14} style={{ color: "var(--text-3)" }} />
        <span style={{ fontFamily: mono, fontSize: 12, letterSpacing: "0.1em", color: "var(--text-2)", fontWeight: 700 }}>
          SKOR INI MENGUKUR APA?
        </span>
      </div>
      <p style={{ fontFamily: mono, fontSize: 12, color: "var(--text-3)", lineHeight: 1.7, margin: 0 }}>
        Skor mengukur <strong>aktivitas institusional (bandarmologi)</strong> dan konteks pasar — <strong>bukan prediksi harga</strong>,
        bukan jaminan, dan bukan arah pasar. Skor tinggi berarti aktivitas akumulasi terdeteksi, bukan sinyal "aman untuk beli".
      </p>
      {showCorrelation && (
        <p style={{ fontFamily: mono, fontSize: 12, color: "var(--warning)", lineHeight: 1.7, marginTop: 8, marginBottom: 0 }}>
          ⚠ Dalam kondisi pasar turun, saham ini masih bisa mengikuti pergerakan IHSG (risiko sistematis/beta).
          Skor mencerminkan aktivitas institusional, bukan arah pasar.
        </p>
      )}
    </div>
  );
}
