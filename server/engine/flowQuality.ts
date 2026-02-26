export function calculateFlowQualityScore(p: any): number {
  let score = 0;

  const foreign = p.netForeignFlow || 0;
  const domestic = p.netDomesticFlow || 0;

  if (foreign > 0 && domestic > 0)
    score += 25;
  else if (foreign > 0 || domestic > 0)
    score += 12;

  const map: any = {
    "Akumulasi Besar": 25,
    "Akumulasi Sedang": 18,
    "Akumulasi Ringan": 12,
    "Netral": 10,
    "Distribusi Sedang": 4,
    "Distribusi Besar": 0
  };
  score += map[p.flowIntensity] ?? 10;

  if (p.buyAvg && p.lastPrice) {
    const ratio = p.lastPrice / p.buyAvg;
    if (ratio > 1.01) score += 20;
    else if (ratio > 0.995) score += 14;
    else if (ratio > 0.98) score += 7;
    else score += 2;
  }

  const rel: any = {
    "Tinggi": 15,
    "Sedang": 8,
    "Rendah": 2
  };
  score += rel[p.flowReliability] ?? 8;

  if (p.buyAvg && p.sellAvg) {
    const sellRatio = p.sellAvg / p.buyAvg;
    if (sellRatio >= 1) score += 15;
    else if (sellRatio >= 0.998) score += 10;
    else if (sellRatio >= 0.995) score += 5;
  }

  return Math.max(0, Math.min(100, score));
}
