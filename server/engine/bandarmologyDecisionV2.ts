import type { BandarmologyV2Result } from './bandarmologyCore';

export type DecisionLabel =
  | 'WATCHLIST_PRIORITAS'
  | 'SIAP_DIPANTAU'
  | 'HINDARI_DULU'
  | 'NETRAL';

export type CyclePosition =
  | 'TERLALU_DINI'
  | 'KONFIRMASI_MULAI'
  | 'ENTRY_WINDOW'
  | 'WASPADAI_DISTRIBUSI';

export type ConcentrationType =
  | 'KENDALI_BANDAR'
  | 'JEBAKAN_DISTRIBUSI'
  | 'TERSEBAR';

export interface ConfirmationStatus {
  met: boolean;
  criteriaMetCount: number;
  details: {
    campaignActive: boolean;
    flowStrong: boolean;
    priceResponding: boolean;
    rollingStrong: boolean;
  };
}

export interface DecisionV2Output {
  label: DecisionLabel;
  cyclePosition: CyclePosition | null;
  concentrationType: ConcentrationType;
  confirmation: ConfirmationStatus;
  actionText: string;
  urgency: 'RENDAH' | 'SEDANG' | 'TINGGI';
  decision: DecisionLabel;
  compositeScore: number;
  regime: string | null;
}

function getCyclePosition(result: BandarmologyV2Result): CyclePosition | null {
  const m14 = result.M14_campaignDuration;
  if (!m14 || m14.score === null) return null;
  const maturity: string = m14.maturity ?? '';
  if (maturity === 'FORMING')  return 'TERLALU_DINI';
  if (maturity === 'ACTIVE')   return 'KONFIRMASI_MULAI';
  if (maturity === 'MATURE')   return 'ENTRY_WINDOW';
  if (maturity === 'EXTENDED') return 'WASPADAI_DISTRIBUSI';
  return null;
}

function getConcentrationType(result: BandarmologyV2Result): ConcentrationType {
  const m3 = result.M3_brokerDominance;
  if (!m3 || m3.score === null) return 'TERSEBAR';
  const score = m3.score;
  const netFlowScore = result.M6_flowNormalized?.score ?? 50;
  if (score < 40) return 'TERSEBAR';
  if (score >= 40 && netFlowScore < 35) return 'JEBAKAN_DISTRIBUSI';
  return 'KENDALI_BANDAR';
}

function evaluateConfirmation(result: BandarmologyV2Result): ConfirmationStatus {
  const m6Score  = result.M6_flowNormalized?.score  ?? 0;
  const m12Score = result.M12_rollingAccumulation?.score ?? 0;
  const m15Score = result.M15_priceElasticity?.score ?? 0;
  const cyclePos = getCyclePosition(result);
  const campaignActive = cyclePos === 'KONFIRMASI_MULAI'
    || cyclePos === 'ENTRY_WINDOW'
    || cyclePos === 'WASPADAI_DISTRIBUSI';
  const flowStrong      = m6Score  >= 65;
  const priceResponding = m15Score >= 65;
  const rollingStrong   = m12Score >= 65;
  const criteriaMetCount = [campaignActive, flowStrong, priceResponding, rollingStrong]
    .filter(Boolean).length;
  return {
    met: criteriaMetCount >= 2,
    criteriaMetCount,
    details: { campaignActive, flowStrong, priceResponding, rollingStrong },
  };
}

function buildActionText(
  label: DecisionLabel,
  confirmation: ConfirmationStatus,
  cyclePos: CyclePosition | null,
  concentrationType: ConcentrationType,
): string {
  if (label === 'HINDARI_DULU') return 'Hindari — struktur tidak mendukung';
  if (label === 'NETRAL')       return 'Pantau — belum ada sinyal jelas';
  if (label === 'SIAP_DIPANTAU') {
    if (cyclePos === 'ENTRY_WINDOW') return 'Entry bertahap dapat dipertimbangkan';
    return 'Pantau konfirmasi aliran dana';
  }
  if (concentrationType === 'JEBAKAN_DISTRIBUSI') {
    return 'Waspadai — konsentrasi tinggi tapi aliran berbalik';
  }
  if (!confirmation.met) {
    const missing = 2 - confirmation.criteriaMetCount;
    return `Tunggu Konfirmasi — butuh ${missing} kriteria lagi terpenuhi`;
  }
  if (cyclePos === 'ENTRY_WINDOW')        return 'Akumulasi bertahap — entry window terbuka';
  if (cyclePos === 'WASPADAI_DISTRIBUSI') return 'Hati-hati — kampanye memanjang, pantau distribusi';
  if (cyclePos === 'KONFIRMASI_MULAI')    return 'Mulai akumulasi kecil — konfirmasi sedang terbentuk';
  return 'Akumulasi bertahap direkomendasikan';
}

function buildUrgency(
  label: DecisionLabel,
  cyclePos: CyclePosition | null,
  confirmation: ConfirmationStatus,
): 'RENDAH' | 'SEDANG' | 'TINGGI' {
  if (label === 'HINDARI_DULU') return 'RENDAH';
  if (label === 'NETRAL')       return 'RENDAH';
  if (cyclePos === 'ENTRY_WINDOW' && confirmation.met)       return 'TINGGI';
  if (cyclePos === 'KONFIRMASI_MULAI' && confirmation.met)   return 'SEDANG';
  return 'RENDAH';
}

export function getBandarmologyDecisionV2(result: BandarmologyV2Result): DecisionV2Output {
  const score = result.composite.score ?? 0;
  const regime = result.M16_regimeStability?.regime ?? null;

  let label: DecisionLabel;
  if (score >= 70 && regime === 'ACCUMULATION') label = 'WATCHLIST_PRIORITAS';
  else if (score >= 55)                          label = 'SIAP_DIPANTAU';
  else if (score < 40)                           label = 'HINDARI_DULU';
  else                                           label = 'NETRAL';

  const cyclePos          = getCyclePosition(result);
  const concentrationType = getConcentrationType(result);
  const confirmation      = evaluateConfirmation(result);
  const actionText        = buildActionText(label, confirmation, cyclePos, concentrationType);
  const urgency           = buildUrgency(label, cyclePos, confirmation);

  return {
    label,
    cyclePosition: cyclePos,
    concentrationType,
    confirmation,
    actionText,
    urgency,
    decision: label,
    compositeScore: score,
    regime,
  };
}
