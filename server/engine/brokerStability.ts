export function parseBrokerIDR(v: any): number {
  if (!v) return 0;
  const s = String(v).toUpperCase();
  const num = parseFloat(s.replace(/[^\d.]/g, "")) || 0;
  if (s.includes("T")) return num * 1e12;
  if (s.includes("B")) return num * 1e9;
  if (s.includes("M")) return num * 1e6;
  return num;
}

export function calculateBrokerStabilityScore(brokers: any[]) {
  if (!brokers || brokers.length === 0)
    return { score: 0, level: "Rendah" as const, interpretation: "Data broker tidak tersedia untuk menilai stabilitas." };

  const parsed = brokers.map(b => {
    const buy = parseBrokerIDR(b.netBuy);
    const sell = parseBrokerIDR(b.netSell);
    return {
      code: b.code,
      net: buy - sell,
      volPct: parseFloat((b.volumePercent || "0").replace("%", ""))
    };
  });

  const buyers = parsed
    .filter(b => b.net > 0)
    .sort((a, b) => b.net - a.net);

  if (buyers.length === 0)
    return { score: 5, level: "Rendah" as const, interpretation: "Tidak terdeteksi pola akumulasi konsisten dalam periode yang dianalisis." };

  const total = buyers.reduce((s, b) => s + b.net, 0);
  const top3 = buyers.slice(0, 3).reduce((s, b) => s + b.net, 0);
  const concentration = total > 0 ? top3 / total : 0;

  const volumeCommitment = Math.min(
    buyers.slice(0, 3).reduce((s, b) => s + b.volPct, 0) / 30,
    1
  );

  const score = Math.round(concentration * 60 + volumeCommitment * 40);

  const level: "Rendah" | "Sedang" | "Tinggi" =
    score > 70 ? "Tinggi" :
    score > 40 ? "Sedang" :
    "Rendah";

  const interpretation =
    level === "Tinggi"
      ? "Broker yang sama secara konsisten mendominasi akumulasi, menandakan kampanye operator terstruktur dengan intensi berkelanjutan."
      : level === "Sedang"
      ? "Beberapa broker aktif berulang kali, mengindikasikan minat institusional yang mulai terbentuk namun belum sepenuhnya mengendalikan."
      : "Kepemimpinan akumulasi berputar. Ini menunjukkan penempatan jangka pendek daripada kampanye institusional terkoordinasi.";

  return { score, level, interpretation };
}
