import type { ValuationEngineOutput, ValuationLabel } from './valuationEngine';

export type AlignmentType =
  | 'MURAH_AKUMULASI'
  | 'MURAH_DISTRIBUSI'
  | 'WAJAR_AKUMULASI'
  | 'WAJAR_DISTRIBUSI'
  | 'MAHAL_AKUMULASI'
  | 'MAHAL_DISTRIBUSI'
  | 'INSUFFICIENT_DATA';

export interface SynthesisResult {
  alignment: AlignmentType;
  headline: string;
  explanation: string;
  implication: string;
  alertLevel: 'INFO' | 'POSITIVE' | 'CAUTION' | 'DANGER';
  synthScore: number;
  components: {
    bandarmologyScore: number | null;
    valuationScore: number | null;
    qualityScore: number | null;
  };
}

function getAlignment(
  valuationLabel: ValuationLabel,
  flowBias: string | null | undefined,
  bandarmologyDecision: string | null | undefined
): AlignmentType {
  if (valuationLabel === 'TIDAK_ADA_DATA') return 'INSUFFICIENT_DATA';

  const isAccumulating =
    flowBias === 'Akumulasi' ||
    bandarmologyDecision === 'WATCHLIST_PRIORITAS' ||
    bandarmologyDecision === 'SIAP_DIPANTAU';

  const isDistributing =
    flowBias === 'Distribusi' ||
    bandarmologyDecision === 'HINDARI_DULU';

  if (valuationLabel === 'MURAH') {
    if (isAccumulating)  return 'MURAH_AKUMULASI';
    if (isDistributing)  return 'MURAH_DISTRIBUSI';
    return 'WAJAR_AKUMULASI';
  }

  if (valuationLabel === 'WAJAR') {
    if (isDistributing) return 'WAJAR_DISTRIBUSI';
    return 'WAJAR_AKUMULASI';
  }

  if (valuationLabel === 'MAHAL') {
    if (isAccumulating)  return 'MAHAL_AKUMULASI';
    return 'MAHAL_DISTRIBUSI';
  }

  return 'INSUFFICIENT_DATA';
}

const SYNTHESIS_MAP: Record<AlignmentType, {
  headline: string;
  explanation: string;
  implication: string;
  alertLevel: SynthesisResult['alertLevel'];
}> = {
  MURAH_AKUMULASI: {
    headline: 'Pelaku besar masuk di harga yang belum diapresiasi pasar',
    explanation: 'Valuasi di bawah rata-rata sektor, namun institusi justru sedang mengakumulasi. ' +
      'Ini adalah kombinasi klasik sebelum rerating harga — fundamentalnya murah, dan smart money sudah tahu.',
    implication: 'Konfirmasi akumulasi berlanjut sebelum masuk. Ini adalah setup dengan rasio risiko-reward terbaik.',
    alertLevel: 'POSITIVE',
  },
  MURAH_DISTRIBUSI: {
    headline: 'Harga murah tapi institusi sedang keluar — waspadai value trap',
    explanation: 'Valuasi terlihat menarik secara numerik, namun institusi yang memiliki informasi lebih baik ' +
      'justru sedang mendistribusikan. Ini adalah sinyal value trap klasik.',
    implication: 'Jangan tergoda valuasi murah. Tunggu institusi berhenti menjual sebelum mempertimbangkan masuk.',
    alertLevel: 'CAUTION',
  },
  WAJAR_AKUMULASI: {
    headline: 'Valuasi wajar dengan dukungan akumulasi institusi',
    explanation: 'Harga berada di kisaran wajar untuk sektornya, dan institusi sedang mengakumulasi. ' +
      'Tidak ada diskon besar, namun ada kepercayaan dari smart money.',
    implication: 'Setup normal untuk akumulasi bertahap. Pantau apakah valuasi bergerak ke area murah seiring akumulasi berlanjut.',
    alertLevel: 'INFO',
  },
  WAJAR_DISTRIBUSI: {
    headline: 'Valuasi wajar namun institusi mulai mengurangi posisi',
    explanation: 'Harga tidak mahal, namun institusi sudah mulai mendistribusikan. ' +
      'Ini bisa menjadi tanda awal rotasi keluar sebelum harga bergerak turun.',
    implication: 'Pantau ketat. Jika distribusi menguat, pertimbangkan untuk tidak menambah posisi.',
    alertLevel: 'CAUTION',
  },
  MAHAL_AKUMULASI: {
    headline: 'Institusi beli di harga mahal — ada ekspektasi katalis besar',
    explanation: 'Valuasi di atas rata-rata sektor, namun institusi tetap mengakumulasi. ' +
      'Ini mengindikasikan smart money mengantisipasi pertumbuhan atau katalis yang belum terefleksi dalam harga.',
    implication: 'Berisiko jika katalis tidak terwujud. Cocok untuk investor yang percaya pada growth story-nya.',
    alertLevel: 'INFO',
  },
  MAHAL_DISTRIBUSI: {
    headline: 'Valuasi mahal dan institusi sedang keluar — risiko koreksi tinggi',
    explanation: 'Kombinasi paling berbahaya: harga sudah di atas rata-rata sektor, ' +
      'dan institusi yang masuk duluan kini sedang mengambil profit.',
    implication: 'Hindari masuk baru. Jika sudah pegang, evaluasi exit strategy.',
    alertLevel: 'DANGER',
  },
  INSUFFICIENT_DATA: {
    headline: 'Data tidak cukup untuk sintesis penuh',
    explanation: 'Analisis valuasi atau bandarmology belum tersedia untuk saham ini. ' +
      'Kesimpulan sintesis akan tersedia setelah data lengkap.',
    implication: 'Gunakan tab Flow dan Risiko untuk analisis manual sementara.',
    alertLevel: 'INFO',
  },
};

function computeSynthScore(
  bandarmologyScore: number | null,
  valuationScore: number | null,
  qualityScore: number | null,
  alignment: AlignmentType
): number {
  const scores: { value: number; weight: number }[] = [];

  if (bandarmologyScore !== null) scores.push({ value: bandarmologyScore, weight: 0.50 });
  if (qualityScore      !== null) scores.push({ value: qualityScore,      weight: 0.30 });

  if (valuationScore !== null) {
    const invertedVal = 100 - valuationScore;
    scores.push({ value: invertedVal, weight: 0.20 });
  }

  if (scores.length === 0) return 50;

  const totalWeight = scores.reduce((s, v) => s + v.weight, 0);
  const weighted    = scores.reduce((s, v) => s + v.value * v.weight, 0);
  let base = weighted / totalWeight;

  if (alignment === 'MURAH_AKUMULASI')   base = Math.min(100, base + 8);
  if (alignment === 'MAHAL_DISTRIBUSI')  base = Math.max(0,   base - 10);
  if (alignment === 'MURAH_DISTRIBUSI')  base = Math.max(0,   base - 5);

  return Number(base.toFixed(2));
}

export interface SynthesisInput {
  bandarmologyDecision: string | null | undefined;
  bandarmologyScore: number | null | undefined;
  flowBias: string | null | undefined;
  valuationOutput: ValuationEngineOutput | null;
}

export function computeSynthesis(input: SynthesisInput): SynthesisResult {
  const { bandarmologyDecision, bandarmologyScore, flowBias, valuationOutput } = input;

  const valuationLabel = valuationOutput?.valuation.label ?? 'TIDAK_ADA_DATA';
  const valuationScore = valuationOutput?.valuation.score ?? null;
  const qualityScore   = valuationOutput?.quality.score   ?? null;

  const alignment = getAlignment(valuationLabel, flowBias, bandarmologyDecision);
  const template  = SYNTHESIS_MAP[alignment];

  const synthScore = computeSynthScore(
    bandarmologyScore ?? null,
    valuationScore,
    qualityScore,
    alignment
  );

  return {
    alignment,
    headline:    template.headline,
    explanation: template.explanation,
    implication: template.implication,
    alertLevel:  template.alertLevel,
    synthScore,
    components: {
      bandarmologyScore: bandarmologyScore ?? null,
      valuationScore,
      qualityScore,
    },
  };
}
