/**
 * ============================================================
 * MANAGEMENT SCORER v1.0
 * ============================================================
 * server/engine/managementScorer.ts
 *
 * Aggregates BODMemberProfile[] into a composite management score.
 * Purely deterministic — no Claude calls.
 *
 * WEIGHTS:
 *   trackRecord      30%
 *   governance       25%
 *   insiderAlignment 20%
 *   stability        15%
 *   reputation       10%
 *
 * RULES:
 *   - INSUFFICIENT reliability profiles excluded from scoring
 *   - CRITICAL red flag → compositeScore = 0, hindariOverride = true
 *   - CRITICAL cannot be overridden by any other signal
 *   - Null dimension scores use 50 (neutral)
 *
 * MODIFIER (read by routes.ts):
 *   compositeScore > 70 → +5 pts readiness
 *   compositeScore < 40 → -8 pts readiness
 *   CRITICAL red flag   → readiness forced to 0, HINDARI bucket
 * ============================================================
 */

import type { BODMemberProfile } from './managementResearch';

// ── Types ────────────────────────────────────────────────────

export interface MemberScore {
  name:               string;
  title:              string;
  compositeScore:     number;
  hasCriticalRedFlag: boolean;
  reliability:        string;
  excluded:           boolean;  // true when reliability = INSUFFICIENT
  keyInsight:         string;
}

export interface ManagementScoreResult {
  symbol:                 string;
  compositeScore:         number;            // 0-100
  hasCriticalRedFlag:     boolean;
  criticalRedFlagMember:  string | null;
  criticalRedFlagReason:  string | null;
  qualityLabel:           'KUAT' | 'SEDANG' | 'LEMAH';
  hindariOverride:        boolean;
  memberScores:           MemberScore[];
  scoredMemberCount:      number;
  excludedMemberCount:    number;
  reliability:            'HIGH' | 'MEDIUM' | 'LOW';
  researchedAt:           string;
}

// ── Config ───────────────────────────────────────────────────

const DIMENSION_WEIGHTS = {
  trackRecord:      0.30,
  governance:       0.25,
  insiderAlignment: 0.20,
  stability:        0.15,
  reputation:       0.10,
} as const;

const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days — BOD changes infrequently

// ── In-memory score cache ────────────────────────────────────

const _scoreCache = new Map<string, { result: ManagementScoreResult; timestamp: number }>();

// ── Score helpers ────────────────────────────────────────────

function memberComposite(p: BODMemberProfile): number {
  const d = {
    trackRecord:      p.trackRecordScore      ?? 50,
    governance:       p.governanceScore       ?? 50,
    insiderAlignment: p.insiderAlignmentScore ?? 50,
    stability:        p.stabilityScore        ?? 50,
    reputation:       p.reputationScore       ?? 50,
  };
  return (
    d.trackRecord      * DIMENSION_WEIGHTS.trackRecord      +
    d.governance       * DIMENSION_WEIGHTS.governance       +
    d.insiderAlignment * DIMENSION_WEIGHTS.insiderAlignment +
    d.stability        * DIMENSION_WEIGHTS.stability        +
    d.reputation       * DIMENSION_WEIGHTS.reputation
  );
}

function aggregateReliability(profiles: BODMemberProfile[]): 'HIGH' | 'MEDIUM' | 'LOW' {
  const tiers = profiles.map((p) => p.reliability);
  if (tiers.some((t) => t === 'HIGH'))   return 'HIGH';
  if (tiers.some((t) => t === 'MEDIUM')) return 'MEDIUM';
  return 'LOW';
}

function qualityFrom(score: number): 'KUAT' | 'SEDANG' | 'LEMAH' {
  if (score > 70) return 'KUAT';
  if (score >= 40) return 'SEDANG';
  return 'LEMAH';
}

// ── Public scorer ────────────────────────────────────────────

export function scoreManagement(
  profiles: BODMemberProfile[],
  symbol:   string
): ManagementScoreResult {
  const now     = new Date().toISOString();
  const eligible = profiles.filter((p) => p.reliability !== 'INSUFFICIENT');
  const excluded = profiles.length - eligible.length;

  // No data case — return neutral
  if (eligible.length === 0) {
    return {
      symbol:                symbol.toUpperCase(),
      compositeScore:        50,
      hasCriticalRedFlag:    false,
      criticalRedFlagMember: null,
      criticalRedFlagReason: null,
      qualityLabel:          'SEDANG',
      hindariOverride:       false,
      memberScores:          profiles.map((p) => ({
        name: p.name, title: p.title, compositeScore: 0,
        hasCriticalRedFlag: false, reliability: p.reliability,
        excluded: true, keyInsight: p.keyInsight,
      })),
      scoredMemberCount:  0,
      excludedMemberCount: profiles.length,
      reliability:         'LOW',
      researchedAt:        now,
    };
  }

  // Check for CRITICAL red flag — this can never be overridden
  const criticalMember = eligible.find((p) => p.hasCriticalRedFlag);

  const memberScores: MemberScore[] = profiles.map((p) => ({
    name:               p.name,
    title:              p.title,
    compositeScore:     p.reliability === 'INSUFFICIENT' ? 0 : Math.round(memberComposite(p)),
    hasCriticalRedFlag: p.hasCriticalRedFlag,
    reliability:        p.reliability,
    excluded:           p.reliability === 'INSUFFICIENT',
    keyInsight:         p.keyInsight,
  }));

  if (criticalMember) {
    const criticalFlag =
      criticalMember.redFlags.find((f) => f.severity === 'CRITICAL') ??
      criticalMember.redFlags[0];  // fall back to first flag if severity label mismatched
    return {
      symbol:                symbol.toUpperCase(),
      compositeScore:        0,
      hasCriticalRedFlag:    true,
      criticalRedFlagMember: criticalMember.name,
      criticalRedFlagReason: criticalFlag?.description ?? 'Red flag kritis teridentifikasi',
      qualityLabel:          'LEMAH',
      hindariOverride:       true,
      memberScores,
      scoredMemberCount:     eligible.length,
      excludedMemberCount:   excluded,
      reliability:           aggregateReliability(eligible),
      researchedAt:          now,
    };
  }

  // Normal composite
  const sum   = eligible.reduce((acc, p) => acc + memberComposite(p), 0);
  const score = Math.round(sum / eligible.length);

  return {
    symbol:                symbol.toUpperCase(),
    compositeScore:        score,
    hasCriticalRedFlag:    false,
    criticalRedFlagMember: null,
    criticalRedFlagReason: null,
    qualityLabel:          qualityFrom(score),
    hindariOverride:       false,
    memberScores,
    scoredMemberCount:     eligible.length,
    excludedMemberCount:   excluded,
    reliability:           aggregateReliability(eligible),
    researchedAt:          now,
  };
}

// ── Cache management ─────────────────────────────────────────

export function cacheManagementResult(symbol: string, result: ManagementScoreResult): void {
  _scoreCache.set(symbol.toUpperCase(), { result, timestamp: Date.now() });
}

export function getCachedManagementResult(symbol: string): ManagementScoreResult | null {
  const entry = _scoreCache.get(symbol.toUpperCase());
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    _scoreCache.delete(symbol.toUpperCase());
    return null;
  }
  return entry.result;
}

// ── Synchronous modifier for routes.ts ──────────────────────
// Called inside the synchronous bulk .map() — reads cache only, no I/O.

export function getManagementModifier(symbol: string): {
  modifier:        number;
  hindariOverride: boolean;
  qualityLabel:    string | null;
} {
  const cached = _scoreCache.get(symbol.toUpperCase());
  if (!cached || Date.now() - cached.timestamp > CACHE_TTL_MS) {
    return { modifier: 0, hindariOverride: false, qualityLabel: null };
  }

  const { compositeScore, hasCriticalRedFlag } = cached.result;

  if (hasCriticalRedFlag) {
    return { modifier: -100, hindariOverride: true, qualityLabel: 'CRITICAL' };
  }
  if (compositeScore > 70) {
    return { modifier: 5, hindariOverride: false, qualityLabel: 'KUAT' };
  }
  if (compositeScore < 40) {
    return { modifier: -8, hindariOverride: false, qualityLabel: 'LEMAH' };
  }
  return { modifier: 0, hindariOverride: false, qualityLabel: 'SEDANG' };
}

export function getManagementCacheStats(): { size: number; symbols: string[] } {
  return {
    size:    _scoreCache.size,
    symbols: Array.from(_scoreCache.keys()),
  };
}
