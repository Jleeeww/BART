export interface ScoreDistribution {
  total: number;
  mean: number;
  median: number;
  std: number;
  buckets: {
    veryLow: number;
    low: number;
    mid: number;
    high: number;
    veryHigh: number;
  };
  percentages: {
    veryLow: number;
    low: number;
    mid: number;
    high: number;
    veryHigh: number;
  };
  extremeRate: number;
  healthStatus: 'HEALTHY' | 'WARNING' | 'CRITICAL';
  warnings: string[];
  recommendation: string;
}

export function analyzeScoreDistribution(
  scores: number[]
): ScoreDistribution {
  if (scores.length === 0) {
    return {
      total: 0, mean: 0, median: 0, std: 0,
      buckets: { veryLow:0, low:0, mid:0, high:0, veryHigh:0 },
      percentages: { veryLow:0, low:0, mid:0, high:0, veryHigh:0 },
      extremeRate: 0,
      healthStatus: 'WARNING',
      warnings: ['No scores to analyze'],
      recommendation: 'Feed data into engine first.',
    };
  }

  const sorted = [...scores].sort((a, b) => a - b);
  const n = scores.length;
  const mean = scores.reduce((s, v) => s + v, 0) / n;
  const median = sorted[Math.floor(n / 2)];
  const variance = scores.reduce((s, v) => s + (v - mean) ** 2, 0) / n;
  const std = Math.sqrt(variance);

  const buckets = {
    veryLow:  scores.filter(s => s <= 20).length,
    low:      scores.filter(s => s > 20 && s <= 40).length,
    mid:      scores.filter(s => s > 40 && s <= 60).length,
    high:     scores.filter(s => s > 60 && s <= 80).length,
    veryHigh: scores.filter(s => s > 80).length,
  };

  const pct = (v: number) => Number(((v / n) * 100).toFixed(1));
  const percentages = {
    veryLow:  pct(buckets.veryLow),
    low:      pct(buckets.low),
    mid:      pct(buckets.mid),
    high:     pct(buckets.high),
    veryHigh: pct(buckets.veryHigh),
  };

  const extremeRate = Number(
    (((buckets.veryLow + buckets.veryHigh) / n) * 100).toFixed(1)
  );

  const warnings: string[] = [];
  let healthStatus: ScoreDistribution['healthStatus'] = 'HEALTHY';
  let recommendation = 'Distribusi skor normal. Tidak perlu tindakan.';

  if (mean < 25) {
    warnings.push(`Mean ${mean.toFixed(1)} terlalu rendah — sebagian besar saham HINDARI`);
    healthStatus = 'WARNING';
    recommendation = 'Periksa apakah data flow/broker terisi dengan benar.';
  }
  if (mean > 75) {
    warnings.push(`Mean ${mean.toFixed(1)} terlalu tinggi — threshold akumulasi terlalu longgar`);
    healthStatus = 'WARNING';
    recommendation = 'Threshold akumulasi mungkin terlalu longgar. Perlu kalibrasi.';
  }
  if (extremeRate > 60) {
    warnings.push(`${extremeRate}% saham di zona ekstrem`);
    healthStatus = 'CRITICAL';
    recommendation = 'KRITIS: Engine perlu kalibrasi ulang sebelum launch.';
  } else if (extremeRate > 40) {
    warnings.push(`${extremeRate}% saham di zona ekstrem — di atas normal`);
    if (healthStatus === 'HEALTHY') healthStatus = 'WARNING';
    recommendation = 'Monitor selama 3-5 sesi.';
  }
  if (std < 8) {
    warnings.push(`Std dev ${std.toFixed(1)} terlalu rendah — skor terlalu seragam`);
    if (healthStatus === 'HEALTHY') healthStatus = 'WARNING';
    recommendation = 'Engine tidak membedakan saham dengan baik. Periksa model weights.';
  }

  return {
    total: n,
    mean: Number(mean.toFixed(2)),
    median: Number(median.toFixed(2)),
    std: Number(std.toFixed(2)),
    buckets, percentages, extremeRate,
    healthStatus, warnings, recommendation,
  };
}

let _lastDistribution: ScoreDistribution | null = null;
let _lastCheckedAt: string | null = null;

export function cacheDistribution(dist: ScoreDistribution): void {
  _lastDistribution = dist;
  _lastCheckedAt = new Date().toISOString();
}

export function getLastDistribution(): {
  distribution: ScoreDistribution | null;
  checkedAt: string | null;
} {
  return { distribution: _lastDistribution, checkedAt: _lastCheckedAt };
}
