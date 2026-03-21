/**
 * ============================================================
 * VALUATION MODIFIER v1.0
 * ============================================================
 * Applies a small valuation + quality adjustment to the
 * v1.1 bandarmology readiness score.
 *
 * DESIGN RULES:
 *   - Bandarmology remains dominant (90%+ of signal)
 *   - Max total adjustment: ±5 points
 *   - Deterministic: same input → same output
 *   - Safe: null inputs → 0 modifier (no adjustment)
 *   - Never pushes a HINDARI stock into WATCHLIST range
 *   - Never pushes a WATCHLIST stock into SIAP range
 *
 * MODIFIER TABLE:
 *   Valuation:  MURAH=+3, WAJAR=0, MAHAL=-3, NO_DATA=0
 *   Quality:    KUAT=+2,  SEDANG=0, LEMAH=-2, NO_DATA=0
 *   Max total:  clamp(sum, -5, +5)
 * ============================================================
 */

export type ValuationLabel = 'MURAH' | 'WAJAR' | 'MAHAL' | 'TIDAK_ADA_DATA';
export type QualityLabel   = 'KUAT'  | 'SEDANG' | 'LEMAH' | 'TIDAK_ADA_DATA';

export interface ValuationModifierInput {
  valuationLabel: ValuationLabel | null | undefined;
  qualityLabel:   QualityLabel   | null | undefined;
  currentReadiness: number;
}

export interface ValuationModifierOutput {
  adjustedReadiness: number;
  modifier: number;
  valuationComponent: number;
  qualityComponent: number;
  wasAdjusted: boolean;
}

export function applyValuationModifier(
  input: ValuationModifierInput
): ValuationModifierOutput {
  const { valuationLabel, qualityLabel, currentReadiness } = input;

  if (
    currentReadiness === null ||
    currentReadiness === undefined ||
    isNaN(currentReadiness) ||
    !isFinite(currentReadiness)
  ) {
    return {
      adjustedReadiness: currentReadiness ?? 0,
      modifier: 0,
      valuationComponent: 0,
      qualityComponent: 0,
      wasAdjusted: false,
    };
  }

  let valuationComponent = 0;
  if (valuationLabel === 'MURAH') valuationComponent = +3;
  if (valuationLabel === 'MAHAL') valuationComponent = -3;

  let qualityComponent = 0;
  if (qualityLabel === 'KUAT')  qualityComponent = +2;
  if (qualityLabel === 'LEMAH') qualityComponent = -2;

  const rawModifier = valuationComponent + qualityComponent;
  const modifier = Math.max(-5, Math.min(5, rawModifier));

  let adjusted = currentReadiness + modifier;

  const originalBucket =
    currentReadiness >= 80 ? 'SIAP' :
    currentReadiness >= 60 ? 'WATCHLIST' : 'HINDARI';

  const adjustedBucket =
    adjusted >= 80 ? 'SIAP' :
    adjusted >= 60 ? 'WATCHLIST' : 'HINDARI';

  if (originalBucket !== adjustedBucket) {
    if (originalBucket === 'HINDARI' && adjustedBucket === 'WATCHLIST') {
      adjusted = 59;
    } else if (originalBucket === 'WATCHLIST' && adjustedBucket === 'SIAP') {
      adjusted = 79;
    } else if (originalBucket === 'WATCHLIST' && adjustedBucket === 'HINDARI') {
      adjusted = 60;
    } else if (originalBucket === 'SIAP' && adjustedBucket === 'WATCHLIST') {
      adjusted = 80;
    }
  }

  adjusted = Math.max(0, Math.min(100, Math.round(adjusted)));

  return {
    adjustedReadiness: adjusted,
    modifier,
    valuationComponent,
    qualityComponent,
    wasAdjusted: modifier !== 0,
  };
}
