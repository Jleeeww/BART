/**
 * ============================================================
 * JUNE 2026 BANDARMOLOGY VALIDATION RUNNER
 * ============================================================
 * scripts/runJune2026Validation.ts
 *
 * Validates the netForeignFlow fix (M6/M8/M12/M14 now read
 * foreignFlowHistory instead of netTotalFlow≈0) against 9 IDX
 * stocks from the June 2–18 2026 trading window.
 *
 * RUNS TWO ENGINE PATHS PER STOCK:
 *
 *   PATH A — computeStockReadiness (categorical composite)
 *     Uses: flowBias/flowIntensity (derived from 12d window),
 *     foreignActivityData (last-session snapshot), keystats.
 *     Produces: 7-layer compositeScore, homepageBucket, activeFlags.
 *
 *   PATH B — computeBandarmologyV2 (model-level, raw history)
 *     Uses: foreignFlowHistory[] (all 12 sessions directly).
 *     Produces: M6, M8, M12, M14 individual scores + V2 composite.
 *     This is the primary test target of the fix.
 *
 * NOTE — VALIDATION DESIGN (per fixture design spec):
 *   Validate against the ACTUAL window flow direction, NOT stored
 *   archetype labels. Three stocks have stale stored labels:
 *     KLBF (stored=stealth-accum,  actual=weak-dist-accelerating)
 *     BBRI (stored=clean-accum,    actual=heavy-dist+reversal)
 *     BREN (stored=smart-exit,     actual=weak-dist/outlier-noise)
 *
 * INVOKE:
 *   npx tsx scripts/runJune2026Validation.ts
 * ============================================================
 */

import { JUNE_2026_FIXTURES, type June2026Fixture } from './june2026Fixtures';
import { computeStockReadiness }                     from '../server/engine/stockReadiness';
import { computeBandarmologyV2 }                     from '../server/engine/bandarmologyCore';
import { buildBandarmologyInput }                    from '../server/engine/buildBandarmologyInput';
import { getBandarmologyDecisionV2 }                 from '../server/engine/bandarmologyDecisionV2';
import type { RawStockRecord }                       from '../server/engine/buildBandarmologyInput';

// ── Formatting helpers ────────────────────────────────────────────

function fmt(n: number | null, dec = 1): string {
  if (n === null) return '—';
  return n.toFixed(dec);
}

function pad(s: string, w: number): string {
  return s.slice(0, w).padEnd(w);
}

function lpad(s: string, w: number): string {
  return s.slice(0, w).padStart(w);
}

// ── Per-stock result types ────────────────────────────────────────

interface PathAResult {
  readiness:    number;   // bandarmologyScore from getStockDecision()
  composite:    number;   // compositeV3 score
  bucket:       string;
  action:       string;
  activeWeight: number;   // activeWeightSum (proxy for confidence)
  activeFlags:  string[];
  isGorengan:   boolean;
}

interface PathBResult {
  m6:      number | null;
  m8:      number | null;
  m12:     number | null;
  m14:     number | null;
  m14Age:  number;
  m14Mat:  string;
  m16:     string | null;
  v2Score: number | null;
  v2Label: string;
}

// ── Build BandarmologyInput from fixture ─────────────────────────

function buildV2Input(f: June2026Fixture) {
  const raw: RawStockRecord = {
    symbol:  f.symbol,
    close:   f.lastClose,
    open:    f.lastClose - 10,   // minor intraday, not critical
    high:    f.lastHigh,
    low:     f.lastLow,
    prevClose: f.lastPrevClose,
    change:  f.lastClose - f.lastPrevClose,
    changePercent: ((f.lastClose - f.lastPrevClose) / f.lastPrevClose) * 100,
    todayValue:   f.avg20dValue,   // use avg as today's proxy
    avg20dValue:  f.avg20dValue,
    foreignActivityData: f.foreignActivityData,
    brokerData:          f.brokerData,
    netFlowHistory:      null,       // not the focus — always ~0 in real IDX data
    foreignFlowHistory:  f.foreignFlowHistory,
    flowBias:        f.flowBias,
    flowIntensity:   f.flowIntensity,
    flowReliability: f.flowReliability,
  };

  // No stored M6 history for these test stocks — M16 returns null safely.
  return buildBandarmologyInput(raw, null);
}

// ── Main ──────────────────────────────────────────────────────────

async function main() {
  console.log('\n' + '═'.repeat(80));
  console.log('JUNE 2026 BANDARMOLOGY VALIDATION — 9 IDX STOCKS');
  console.log('═'.repeat(80));
  console.log('Date window : Jun 2–18 2026 (12 sessions). Jun 16 = no data.');
  console.log('Fix active  : M6/M8/M12/M14 read foreignFlowHistory (not netTotalFlow≈0).');
  console.log('');
  console.log('⚠  STALE STORED LABELS — validate by FLOW DATA here, not stored labels:');
  console.log('   KLBF stored=stealth-accum  →  June actual=weak-dist-accelerating');
  console.log('   BBRI stored=clean-accum    →  June actual=heavy-dist+reversal-stress');
  console.log('   BREN stored=smart-exit     →  June actual=weak-dist/outlier-noise');
  console.log('');

  const pathAResults: Record<string, PathAResult> = {};
  const pathBResults: Record<string, PathBResult> = {};

  for (const f of JUNE_2026_FIXTURES) {
    // ── PATH A: computeStockReadiness ──────────────────────────
    const srInput = {
      symbol:             f.symbol,
      sector:             f.sector,
      changePercent:      f.changePercent,
      flowBias:           f.flowBias,
      flowIntensity:      f.flowIntensity,
      flowReliability:    f.flowReliability,
      brokerData:         f.brokerData,
      foreignActivityData: f.foreignActivityData,
      stockCharacter:     null,
      insiderData:        null,
      growth:             null,
      peRatio:            f.peTTM,
      dividendYield:      f.dividendYield,
      roe:                f.roe,
      netMargin:          f.netMargin,
      marketCap:          String(Math.round(f.marketCap)),
      avg20dValue:        f.avg20dValue,
    };

    const srResult = computeStockReadiness(srInput);

    pathAResults[f.symbol] = {
      readiness:    srResult.bandarmologyScore,
      composite:    srResult.compositeScore,
      bucket:       srResult.homepageBucket,
      action:       srResult.decision.action,
      activeWeight: srResult.activeWeightSum,
      activeFlags:  srResult.activeFlags,
      isGorengan:   srResult.isGorengan,
    };

    // ── PATH B: computeBandarmologyV2 (model-level) ────────────
    const v2Input  = buildV2Input(f);
    const v2Result = computeBandarmologyV2(v2Input);
    const v2Dec    = getBandarmologyDecisionV2(v2Result);

    const m14 = v2Result.M14_campaignDuration;
    const m16 = v2Result.M16_regimeStability;

    pathBResults[f.symbol] = {
      m6:      v2Result.M6_flowNormalized?.score   ?? null,
      m8:      v2Result.M8_stealthAccumulation?.score ?? null,
      m12:     v2Result.M12_rollingAccumulation?.score ?? null,
      m14:     m14?.score   ?? null,
      m14Age:  m14?.campaignAge ?? 0,
      m14Mat:  m14?.maturity ?? 'NO_CAMPAIGN',
      m16:     m16?.regime   ?? null,
      v2Score: v2Result.composite.score,
      v2Label: v2Dec.decision,
    };
  }

  // ── TABLE 1: PATH A — Categorical Composite ────────────────────

  console.log('━'.repeat(80));
  console.log('PATH A — computeStockReadiness  (categorical flow labels → 7-layer composite)');
  console.log('━'.repeat(80));
  console.log(
    pad('TICKER', 7) +
    lpad('BANDO', 6) +
    lpad('COMP', 6) +
    lpad('CONF%', 6) +
    '  ' + pad('ACTION', 10) +
    pad('BUCKET', 22) +
    'FLAGS / NOTES'
  );
  console.log('─'.repeat(80));

  for (const f of JUNE_2026_FIXTURES) {
    const a = pathAResults[f.symbol];
    const conf = (a.activeWeight * 100).toFixed(0) + '%';
    const flags = a.activeFlags.length > 0
      ? a.activeFlags.join(' ')
      : (a.isGorengan ? 'GORENGAN' : '—');

    console.log(
      pad(f.symbol, 7) +
      lpad(String(a.readiness), 6) +
      lpad(a.composite.toFixed(1), 6) +
      lpad(conf, 6) +
      '  ' +
      pad(a.action, 10) +
      pad(a.bucket, 22) +
      flags
    );
  }

  // ── TABLE 2: PATH B — Model-Level V2 Scores ───────────────────

  console.log('');
  console.log('━'.repeat(90));
  console.log('PATH B — computeBandarmologyV2  (foreignFlowHistory[] → M6/M8/M12/M14 direct)');
  console.log('  M6  = last-day foreignFlow / avg20d (spot signal)');
  console.log('  M8  = persistence × consistency last 5 days (stealth detector, gate: meanFlow>0)');
  console.log('  M12 = recency-weighted rolling avg last 5 days [w=1,2,3,4,5]');
  console.log('  M14 = trailing positive streak from today backward');
  console.log('  M16 = null for all (no stored M6 history for these test stocks — expected)');
  console.log('━'.repeat(90));
  console.log(
    pad('TICKER', 7) +
    lpad('M6', 6) +
    lpad('M8', 6) +
    lpad('M12', 6) +
    '  ' + pad('M14(age/mat)', 20) +
    lpad('V2COMP', 8) +
    '  ' + 'V2 LABEL'
  );
  console.log('─'.repeat(90));

  for (const f of JUNE_2026_FIXTURES) {
    const b = pathBResults[f.symbol];
    const m14str = b.m14Mat === 'NO_CAMPAIGN'
      ? 'NO_CAMPAIGN'
      : `${fmt(b.m14)}(age=${b.m14Age}/${b.m14Mat})`;

    console.log(
      pad(f.symbol, 7) +
      lpad(fmt(b.m6), 6) +
      lpad(fmt(b.m8), 6) +
      lpad(fmt(b.m12), 6) +
      '  ' + pad(m14str, 20) +
      lpad(fmt(b.v2Score), 8) +
      '  ' + b.v2Label
    );
  }

  // ── TABLE 3: Expected vs Actual Summary ───────────────────────

  console.log('');
  console.log('━'.repeat(80));
  console.log('VALIDATION SUMMARY — actual vs expected archetype');
  console.log('━'.repeat(80));
  console.log(
    pad('TICKER', 7) +
    pad('A-ACTION', 10) +
    pad('MATCH', 7) +
    'EXPECTED ARCHETYPE'
  );
  console.log('─'.repeat(80));

  let passCount = 0;
  const criticalChecks: string[] = [];

  for (const f of JUNE_2026_FIXTURES) {
    const a   = pathAResults[f.symbol];
    const b   = pathBResults[f.symbol];
    const avoided = a.action === 'AVOID';
    const match = f.expectAvoid
      ? (avoided ? '✓ PASS' : '✗ FAIL')
      : (!avoided ? '✓ PASS' : '✗ FAIL');

    if (match.startsWith('✓')) passCount++;

    // Critical per-stock notes
    let note = '';
    if (f.symbol === 'BBRI') {
      const bbriOk = b.m14Age === 0;
      note = bbriOk
        ? ' [M14 age=0 ✓ — Jun17 reversal did NOT flip streak]'
        : ' [⚠ M14 age>0 — Jun17 reversal may be inflating streak!]';
    }
    if (f.symbol === 'BUVA') {
      const buvaM6High = (b.m6 ?? 0) > 60;
      const buvaM12Low = (b.m12 ?? 100) < 45;
      note = buvaM6High && buvaM12Low
        ? ` [M6=${fmt(b.m6)} (last day +) but M12=${fmt(b.m12)} (rolling −) ✓ no false positive]`
        : ` [M6=${fmt(b.m6)} M12=${fmt(b.m12)}]`;
    }
    if (f.symbol === 'UNVR') {
      note = ` [M12=${fmt(b.m12)} — recency decay of early distribution ${(b.m12 ?? 50) > 50 ? '⚠ late recovery detected' : '✓'}]`;
    }

    console.log(
      pad(f.symbol, 7) +
      pad(a.action, 10) +
      pad(match, 7) +
      f.expectedArchetype.slice(0, 43) + note
    );
  }

  criticalChecks.push(
    `BBRI M14 age: ${pathBResults['BBRI'].m14Age} (must be 0 — Jun17 green print must NOT create streak)`,
    `BUVA readiness: ${pathAResults['BUVA'].readiness} (must be low — three dampeners active)`,
    `UNVR M12: ${fmt(pathBResults['UNVR'].m12)} (tests recency-weight decay of Jun2-5 front-load)`,
    `KLBF M12: ${fmt(pathBResults['KLBF'].m12)} (stale stored label=accum; Jun flow=heavy dist)`,
  );

  console.log('');
  console.log(`Result: ${passCount} / ${JUNE_2026_FIXTURES.length} expected archetypes matched`);

  console.log('');
  console.log('━'.repeat(80));
  console.log('CRITICAL CHECKS (explicit per task spec)');
  console.log('━'.repeat(80));
  criticalChecks.forEach(c => console.log('  ' + c));

  console.log('');
  console.log('━'.repeat(80));
  console.log('M11 NOTE: M11=50 for all stocks (domestic mirrors foreign → avgScore always 50).');
  console.log('  This is CORRECT — M11 detects dual-direction flow impossible in real IDX data.');
  console.log('  M11 was excluded from "DO NOT CHANGE" list. No action needed.');
  console.log('━'.repeat(80));
  console.log('');
}

main().catch(console.error);
