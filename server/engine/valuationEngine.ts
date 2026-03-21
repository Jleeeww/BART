import { safe_normalize, clamp } from './bandarmologyCore';

export interface SectorBenchmark {
  sectorKey: string;
  displayName: string;
  avgPE: number;
  avgPBV: number;
  avgROE: number;
  avgNetMargin: number;
  avgDivYield: number;
}

export const SECTOR_BENCHMARKS: SectorBenchmark[] = [
  {
    sectorKey: 'Financials',
    displayName: 'Keuangan & Perbankan',
    avgPE: 10.5, avgPBV: 1.6, avgROE: 14.0,
    avgNetMargin: 28.0, avgDivYield: 3.5,
  },
  {
    sectorKey: 'Consumer Staples',
    displayName: 'Konsumer Primer',
    avgPE: 24.0, avgPBV: 4.2, avgROE: 18.0,
    avgNetMargin: 8.5, avgDivYield: 2.2,
  },
  {
    sectorKey: 'Consumer Discretionary',
    displayName: 'Konsumer Sekunder',
    avgPE: 20.0, avgPBV: 3.0, avgROE: 14.0,
    avgNetMargin: 6.5, avgDivYield: 1.8,
  },
  {
    sectorKey: 'Energy',
    displayName: 'Energi',
    avgPE: 7.5, avgPBV: 1.3, avgROE: 16.0,
    avgNetMargin: 12.0, avgDivYield: 5.0,
  },
  {
    sectorKey: 'Basic Materials',
    displayName: 'Material & Tambang',
    avgPE: 8.0, avgPBV: 1.4, avgROE: 15.0,
    avgNetMargin: 10.0, avgDivYield: 4.5,
  },
  {
    sectorKey: 'Industrials',
    displayName: 'Industri',
    avgPE: 14.0, avgPBV: 1.8, avgROE: 12.0,
    avgNetMargin: 7.0, avgDivYield: 2.0,
  },
  {
    sectorKey: 'Technology',
    displayName: 'Teknologi',
    avgPE: 35.0, avgPBV: 5.5, avgROE: 10.0,
    avgNetMargin: 8.0, avgDivYield: 0.5,
  },
  {
    sectorKey: 'Telecommunications',
    displayName: 'Telekomunikasi',
    avgPE: 18.0, avgPBV: 3.0, avgROE: 18.0,
    avgNetMargin: 15.0, avgDivYield: 3.8,
  },
  {
    sectorKey: 'Healthcare',
    displayName: 'Kesehatan',
    avgPE: 28.0, avgPBV: 4.5, avgROE: 14.0,
    avgNetMargin: 10.0, avgDivYield: 1.2,
  },
  {
    sectorKey: 'Real Estate',
    displayName: 'Properti',
    avgPE: 12.0, avgPBV: 1.1, avgROE: 8.0,
    avgNetMargin: 18.0, avgDivYield: 2.5,
  },
  {
    sectorKey: 'Infrastructure',
    displayName: 'Infrastruktur',
    avgPE: 20.0, avgPBV: 2.5, avgROE: 12.0,
    avgNetMargin: 12.0, avgDivYield: 2.8,
  },
  {
    sectorKey: 'Transportation',
    displayName: 'Transportasi',
    avgPE: 16.0, avgPBV: 2.0, avgROE: 11.0,
    avgNetMargin: 8.0, avgDivYield: 2.0,
  },
];

const DEFAULT_BENCHMARK: SectorBenchmark = {
  sectorKey: 'Unknown',
  displayName: 'Umum',
  avgPE: 15.0, avgPBV: 2.0, avgROE: 12.0,
  avgNetMargin: 10.0, avgDivYield: 2.5,
};

export function getSectorBenchmark(sector: string | null | undefined): SectorBenchmark {
  if (!sector) return DEFAULT_BENCHMARK;
  const match = SECTOR_BENCHMARKS.find(
    b => b.sectorKey.toLowerCase() === sector.toLowerCase()
  );
  return match ?? DEFAULT_BENCHMARK;
}

export type ValuationLabel = 'MURAH' | 'WAJAR' | 'MAHAL' | 'TIDAK_ADA_DATA';
export type QualityLabel   = 'KUAT'  | 'SEDANG' | 'LEMAH' | 'TIDAK_ADA_DATA';

export interface ValuationResult {
  label: ValuationLabel;
  score: number;
  peScore: number | null;
  pbvScore: number | null;
  confidence: number;
  sectorBenchmark: SectorBenchmark;
  relativePE: number | null;
  interpretation: string;
}

export interface FundamentalQuality {
  label: QualityLabel;
  score: number;
  roeScore: number | null;
  marginScore: number | null;
  divScore: number | null;
  confidence: number;
  interpretation: string;
}

export interface ValuationEngineOutput {
  valuation: ValuationResult;
  quality: FundamentalQuality;
  hasEnoughData: boolean;
}

function scoreValuation(
  peRatio: number | null | undefined,
  sector: string | null | undefined
): ValuationResult {
  const benchmark = getSectorBenchmark(sector);
  const available: number[] = [];

  let peScore: number | null = null;
  let relativePE: number | null = null;

  if (peRatio !== null && peRatio !== undefined && isFinite(peRatio) && peRatio > 0) {
    relativePE = peRatio / benchmark.avgPE;
    peScore = clamp(safe_normalize(relativePE, 0.3, 2.0) ?? 50);
    available.push(peScore);
  }

  if (available.length === 0) {
    return {
      label: 'TIDAK_ADA_DATA',
      score: 50,
      peScore: null,
      pbvScore: null,
      confidence: 0,
      sectorBenchmark: benchmark,
      relativePE: null,
      interpretation: 'Data valuasi tidak tersedia untuk analisis.',
    };
  }

  const score = available.reduce((s, v) => s + v, 0) / available.length;
  const confidence = Math.round((available.length / 1) * 100);

  let label: ValuationLabel;
  let interpretation: string;

  if (score < 35) {
    label = 'MURAH';
    const discount = relativePE ? Math.round((1 - relativePE) * 100) : 0;
    interpretation = `Saham diperdagangkan ${discount}% di bawah rata-rata sektor ${benchmark.displayName}. ` +
      `Secara historis menarik jika fundamental bisnis tetap solid.`;
  } else if (score < 65) {
    label = 'WAJAR';
    interpretation = `Valuasi sesuai dengan rata-rata sektor ${benchmark.displayName}. ` +
      `Tidak ada diskon signifikan, namun juga tidak overpriced.`;
  } else {
    label = 'MAHAL';
    const premium = relativePE ? Math.round((relativePE - 1) * 100) : 0;
    interpretation = `Saham diperdagangkan ${premium}% di atas rata-rata sektor ${benchmark.displayName}. ` +
      `Harga sudah merefleksikan ekspektasi pertumbuhan tinggi.`;
  }

  return {
    label, score, peScore, pbvScore: null,
    confidence, sectorBenchmark: benchmark,
    relativePE: relativePE ? Number(relativePE.toFixed(2)) : null,
    interpretation,
  };
}

function scoreFundamentalQuality(
  roe: number | null | undefined,
  netMargin: number | null | undefined,
  dividendYield: number | null | undefined,
  sector: string | null | undefined
): FundamentalQuality {
  const benchmark = getSectorBenchmark(sector);
  const available: number[] = [];

  let roeScore: number | null = null;
  let marginScore: number | null = null;
  let divScore: number | null = null;

  if (roe !== null && roe !== undefined && isFinite(roe) && roe !== 0) {
    roeScore = clamp(safe_normalize(roe, 0, benchmark.avgROE * 2) ?? 50);
    available.push(roeScore);
  }

  if (netMargin !== null && netMargin !== undefined && isFinite(netMargin) && netMargin !== 0) {
    marginScore = clamp(safe_normalize(netMargin, 0, benchmark.avgNetMargin * 2) ?? 50);
    available.push(marginScore);
  }

  if (dividendYield !== null && dividendYield !== undefined && isFinite(dividendYield) && dividendYield > 0) {
    divScore = clamp(safe_normalize(dividendYield, 0, benchmark.avgDivYield * 2) ?? 50);
    available.push(divScore);
  }

  if (available.length === 0) {
    return {
      label: 'TIDAK_ADA_DATA', score: 50,
      roeScore: null, marginScore: null, divScore: null,
      confidence: 0,
      interpretation: 'Data fundamental tidak tersedia.',
    };
  }

  const score = available.reduce((s, v) => s + v, 0) / available.length;
  const confidence = Math.round((available.length / 3) * 100);

  let label: QualityLabel;
  let interpretation: string;

  if (score >= 55) {
    label = 'KUAT';
    interpretation = `Fundamental bisnis kuat dibanding rata-rata sektor ${benchmark.displayName}. ` +
      `ROE dan margin laba berada di atas rata-rata industri.`;
  } else if (score >= 35) {
    label = 'SEDANG';
    interpretation = `Fundamental bisnis rata-rata untuk sektor ${benchmark.displayName}. ` +
      `Tidak ada kelemahan signifikan, namun juga tidak menonjol.`;
  } else {
    label = 'LEMAH';
    interpretation = `Fundamental bisnis di bawah rata-rata sektor ${benchmark.displayName}. ` +
      `Perhatikan tren ROE dan margin sebelum berinvestasi.`;
  }

  return {
    label, score: Number(score.toFixed(2)),
    roeScore, marginScore, divScore,
    confidence,
    interpretation,
  };
}

export interface ValuationInput {
  peRatio?: number | null;
  dividendYield?: number | null;
  roe?: number | null;
  netMargin?: number | null;
  sector?: string | null;
}

export function computeValuation(input: ValuationInput): ValuationEngineOutput {
  const valuation = scoreValuation(input.peRatio, input.sector);
  const quality   = scoreFundamentalQuality(
    input.roe, input.netMargin, input.dividendYield, input.sector
  );

  const hasEnoughData = valuation.label !== 'TIDAK_ADA_DATA' ||
                        quality.label   !== 'TIDAK_ADA_DATA';

  return { valuation, quality, hasEnoughData };
}
