/**
 * ============================================================
 * TEST ENDPOINT: GET /api/test-bandarmology
 * ============================================================
 * server/routes/testBandarmology.ts  (or register inline in your router)
 *
 * Returns a full BandarmologyV2Result using a synthetic sample
 * that exercises all 12 models including:
 *   - M14 MATURE campaign (10-day streak)
 *   - M16 ACCUMULATION regime (from seeded history)
 *   - M15 absorption signal
 *   - M11 aligned foreign+domestic buying
 *   - Composite with regime modifier
 *
 * Mount in your Express app:
 *   import { testBandarmologyRouter } from "./routes/testBandarmology";
 *   app.use("/api", testBandarmologyRouter);
 *
 * Or if using a file-based router (Next.js / Hono), paste the
 * handler function body into your route file.
 * ============================================================
 */

import { Router, Request, Response } from "express";
import {
  computeBandarmologyV2,
  BandarmologyInput,
} from "../engine/bandarmologyCore";
import {
  buildBandarmologyInput,
  RawStockRecord,
} from "../engine/buildBandarmologyInput";
import {
  getM6History,
  saveBandarmologyHistory,
} from "../engine/bandarmologyHistory";

export const testBandarmologyRouter = Router();

// ============================================================
// SAMPLE STOCK RECORD
// Represents a mid-cap IDX stock (BBRI-style) mid-accumulation campaign.
// avg20dValue = 600B IDR → tier 1 (full confidence)
// netFlow = +80B → M6 = 56.7 (mild accumulation in v2.0 calibration)
// 10-day positive streak → M14 = MATURE
// M11: aligned foreign + domestic → compositeScore > 55
// M16: seeded from ACCUMULATION regime history
// ============================================================

const SAMPLE_SYMBOL = "BBRI_TEST";
const SAMPLE_DATE   = "2025-03-15";

const SAMPLE_BROKER_DATA = JSON.stringify([
  { code: "BK",   netBuy: "45.2B IDR",  netSell: "12.1B IDR", volumePercent: "18.3%", avgBuyPrice: "5,240 IDR", avgSellPrice: "5,235 IDR" },
  { code: "YP",   netBuy: "32.8B IDR",  netSell: "8.4B IDR",  volumePercent: "14.1%", avgBuyPrice: "5,238 IDR", avgSellPrice: "5,230 IDR" },
  { code: "CIMB", netBuy: "22.1B IDR",  netSell: "15.3B IDR", volumePercent: "11.2%", avgBuyPrice: "5,242 IDR", avgSellPrice: "5,240 IDR" },
  { code: "AK",   netBuy: "18.5B IDR",  netSell: "22.0B IDR", volumePercent: "9.8%",  avgBuyPrice: "5,236 IDR", avgSellPrice: "5,241 IDR" },
  { code: "ZP",   netBuy: "11.2B IDR",  netSell: "9.8B IDR",  volumePercent: "7.4%",  avgBuyPrice: "5,235 IDR", avgSellPrice: "5,238 IDR" },
  { code: "MK",   netBuy: "8.0B IDR",   netSell: "18.5B IDR", volumePercent: "6.2%",  avgBuyPrice: "5,230 IDR", avgSellPrice: "5,238 IDR" },
]);

const SAMPLE_FOREIGN_ACTIVITY = JSON.stringify({
  foreignBuy:    "52000000000",   // 52B IDR
  foreignSell:   "18000000000",   // 18B IDR
  domesticBuy:   "85000000000",   // 85B IDR
  domesticSell:  "39000000000",   // 39B IDR
  netForeignFlow: "34000000000",  // +34B IDR net foreign buy
  netDomesticFlow: "46000000000", // +46B IDR net domestic buy
});

const SAMPLE_RAW: RawStockRecord = {
  symbol:  SAMPLE_SYMBOL,
  date:    SAMPLE_DATE,

  brokerData:          SAMPLE_BROKER_DATA,
  foreignActivityData: SAMPLE_FOREIGN_ACTIVITY,

  // Price: mild gain, controlled range
  close:     5245,
  open:      5230,
  high:      5260,
  low:       5225,
  prevClose: 5235,
  change:    10,

  avgBuyPrice:  "5,240 IDR",
  avgSellPrice: "5,238 IDR",

  // Volume: 1.35× avg (healthy, not spike)
  todayValue:   "810000000000",   // 810B IDR
  avg20dValue:  "600000000000",   // 600B IDR

  // Net flow history: 10-session building campaign (oldest → newest)
  // Critical: [0]=oldest, [-1]=today
  netFlowHistory: [
    55e9, 60e9, 62e9, 65e9, 70e9,   // sessions 1-5 (older)
    72e9, 75e9, 78e9, 80e9, 80e9,   // sessions 6-10 (recent, incl. today)
  ],

  priceHistory: [
    5180, 5190, 5195, 5200, 5210,
    5215, 5220, 5228, 5235, 5245,
  ],

  flowBias:        "Akumulasi",
  flowIntensity:   "Akumulasi Sedang",
  flowReliability: "Tinggi",

  // No calendar events
  calendarFlags: {
    isExDividend:           false,
    isRebalanceDay:         false,
    isRightsIssuePeriod:    false,
    isPostSuspension:       false,
    isWindowDressingPeriod: false,
  },

  // _m6ScoreHistory: will be seeded by the endpoint handler below
};

// ============================================================
// SEED M6 SCORE HISTORY
// Simulates 5 prior sessions of M6 scores consistent with
// ACCUMULATION regime: mean ~65, std ~5, upward trend.
// These are stored values from prior computations.
// ============================================================
const SEEDED_M6_HISTORY: number[] = [
  60.8,  // 5 sessions ago (oldest)
  62.1,  // 4 sessions ago
  63.4,  // 3 sessions ago
  65.2,  // 2 sessions ago
  66.7,  // 1 session ago (most recent prior)
  // NOTE: today's M6 is NOT here — M16 reads PRIOR sessions only
];

// ============================================================
// TEST HANDLER
// ============================================================

async function handleTestBandarmology(_req: Request, res: Response): Promise<void> {
  try {
    // ── Step 1: Load M6 history from storage ─────────────────
    // In production this would be: await getM6History(symbol, 5)
    // For the test, we seed in-memory storage first.

    // Pass m6ScoreHistory directly to buildBandarmologyInput.
    // In production: const m6History = await getM6History(SAMPLE_SYMBOL, 5);
    const m6History = SEEDED_M6_HISTORY;

    // ── Step 2: Build typed input ─────────────────────────────
    const input: BandarmologyInput = buildBandarmologyInput(SAMPLE_RAW, m6History);

    // ── Step 3: Run engine ────────────────────────────────────
    const result = computeBandarmologyV2(input);

    // ── Step 4: Save to history (async, non-blocking) ─────────
    // In production: call this after every successful computation.
    const netFlow = input.flow.netForeignFlow + input.flow.netDomesticFlow;
    saveBandarmologyHistory(
      SAMPLE_SYMBOL,
      result,
      SAMPLE_DATE,
      netFlow,
      input.price.close
    ).catch((err) => {
      console.error("[test-bandarmology] history save error:", err);
    });

    // ── Step 5: Annotate for readability ──────────────────────
    const response = {
      status: "ok",
      engineVersion: result.meta.engineVersion,
      symbol: SAMPLE_SYMBOL,
      date:   SAMPLE_DATE,

      // ── Composite summary ──────────────────────────────────
      composite: {
        score:        result.composite.score,
        rawScore:     result.composite.rawScore,
        confidence:   `${result.composite.confidence}%`,
        activeModels: result.composite.activeModels,
        riskPenalty:  result.composite.riskPenalty,
        regimeModifier: result.composite.regimeModifier,
      },

      // ── Regime ─────────────────────────────────────────────
      regime: result.M16_regimeStability
        ? {
            regime:    result.M16_regimeStability.regime,
            modifier:  result.M16_regimeStability.regimeModifier,
            flowMean:  result.M16_regimeStability.flowMean,
            flowTrend: result.M16_regimeStability.flowTrend,
            confidence: `${result.M16_regimeStability.confidence}%`,
          }
        : { regime: "UNAVAILABLE — no M6 history" },

      // ── Individual model scores ───────────────────────────
      models: {
        M1_accumulationStrength: fmt(result.M1_accumulationStrength),
        M2_absorptionScore:      fmt(result.M2_absorptionScore),
        M3_brokerDominance:      fmt(result.M3_brokerDominance),
        M6_flowNormalized: {
          ...fmt(result.M6_flowNormalized),
          calibration: "50=neutral, 75=strong accum, 25=strong distrib (v2.0 symmetric bounds)",
        },
        M7_brokerRotation:       fmt(result.M7_brokerRotation),
        M8_stealthAccumulation:  fmt(result.M8_stealthAccumulation),
        M9_fakeBreakoutRisk: {
          ...fmt(result.M9_fakeBreakoutRisk),
          note: "INVERTED: high score = high risk = reduces composite",
        },
        M11_flowDecomposition: {
          score:        result.M11_flowDecomposition.compositeScore,
          foreignScore: result.M11_flowDecomposition.foreignScore,
          domesticScore: result.M11_flowDecomposition.domesticScore,
          alignmentScore: result.M11_flowDecomposition.alignmentScore,
          isReliable:   result.M11_flowDecomposition.isReliable,
          weight:       result.M11_flowDecomposition.weight,
        },
        M12_rollingAccumulation: {
          ...fmt(result.M12_rollingAccumulation),
          note: "recency weights [1,2,3,4,5]: building > tapering",
        },
        M14_campaignDuration: {
          score:       result.M14_campaignDuration.score,
          campaignAge: result.M14_campaignDuration.campaignAge,
          maturity:    result.M14_campaignDuration.maturity,
          isReliable:  result.M14_campaignDuration.isReliable,
          weight:      result.M14_campaignDuration.weight,
        },
        M15_priceElasticity: {
          score:       result.M15_priceElasticity.score,
          elasticity:  result.M15_priceElasticity.elasticity,
          isReliable:  result.M15_priceElasticity.isReliable,
          weight:      result.M15_priceElasticity.weight,
        },
      },

      // ── Data integrity ────────────────────────────────────
      integrity: {
        isValid:  result.integrityReport.isValid,
        errors:   result.integrityReport.errors,
        warnings: result.integrityReport.warnings,
      },

      // ── Engine metadata ───────────────────────────────────
      meta: {
        liquidityTier:       result.meta.liquidityTier,
        calendarSuppression: result.meta.calendarSuppression,
        engineVersion:       result.meta.engineVersion,
      },
    };

    res.status(200).json(response);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({
      status: "error",
      message,
      engineVersion: "2.0.0",
    });
  }
}

// ── Format helper ─────────────────────────────────────────────
function fmt(m: { score: number | null; isReliable: boolean; weight: number; note?: string }) {
  return {
    score:      m.score,
    isReliable: m.isReliable,
    weight:     m.weight,
    ...(m.note ? { note: m.note } : {}),
  };
}

// ============================================================
// REGISTER ROUTE
// ============================================================

testBandarmologyRouter.get("/test-bandarmology", handleTestBandarmology);

// ============================================================
// STANDALONE HANDLER EXPORT
// For frameworks that don't use Express Router (Next.js, Hono, etc.)
// ============================================================

export { handleTestBandarmology };

/**
 * Next.js App Router usage example:
 *
 * // app/api/test-bandarmology/route.ts
 * import { buildBandarmologyInput } from "@/server/engine/buildBandarmologyInput";
 * import { computeBandarmologyV2 } from "@/server/engine/bandarmologyCore";
 * import { getM6History, saveBandarmologyHistory } from "@/server/engine/bandarmologyHistory";
 * import { NextResponse } from "next/server";
 *
 * export async function GET() {
 *   const m6History = await getM6History("BBRI", 5);
 *   const input = buildBandarmologyInput(rawStockRecord, m6History);
 *   const result = computeBandarmologyV2(input);
 *   return NextResponse.json(result);
 * }
 */
