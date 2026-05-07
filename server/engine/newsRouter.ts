/**
 * ============================================================
 * NEWS ROUTER v1.0
 * ============================================================
 * server/engine/newsRouter.ts
 *
 * Maps NewsImpactAnalysis results to specific IDX stocks/sectors.
 * Works entirely off the in-memory getAnalyzedCache() — no DB reads.
 *
 * PRIMARY EXPORTS:
 *   getImpactsForSymbol(symbol, sectorName) — impacts for one stock
 *   getMarketAlerts()                       — CRITICAL/HIGH alerts (24h)
 * ============================================================
 */

import { getAnalyzedCache } from './newsAnalyzer';
import type { NewsImpactAnalysis } from './newsAnalyzer';

// ── Types ────────────────────────────────────────────────────

export interface StockNewsImpact {
  articleId: string;
  eventType: string;
  eventSeverity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  direction: 'POSITIF' | 'NEGATIF' | 'NETRAL' | 'MIXED';
  strength: 'KUAT' | 'SEDANG' | 'LEMAH';
  mechanism: string;
  macroOverride: string;
  macroOverrideReason: string | null;
  traderImplication: string;
  requiresImmediateAttention: boolean;
  expiryHorizon: string;
  rawInsight: string;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  matchType: 'STOCK' | 'SECTOR' | 'BROAD_MARKET';
  analyzedAt: string;
}

export interface MarketAlert {
  articleId: string;
  eventType: string;
  eventSeverity: 'CRITICAL' | 'HIGH';
  macroOverride: string;
  traderImplication: string;
  requiresImmediateAttention: boolean;
  rawInsight: string;
  affectedCount: number;
  analyzedAt: string;
}

// ── Config ───────────────────────────────────────────────────

const IMPACT_AGE_MS = 24 * 60 * 60 * 1000; // Only surface analyses < 24h old

const SEVERITY_ORDER: Record<string, number> = {
  CRITICAL: 0,
  HIGH: 1,
  MEDIUM: 2,
  LOW: 3,
};

// ── Sector aliases ───────────────────────────────────────────
// Maps canonical English sector names and Bahasa Indonesia aliases
// so Claude's output (which may use either language) matches DB sector names.

const SECTOR_ALIASES: Array<{ canonical: string; aliases: string[] }> = [
  { canonical: 'financials',               aliases: ['keuangan', 'perbankan', 'bank', 'financial', 'finance'] },
  { canonical: 'consumer staples',         aliases: ['konsumer', 'barang konsumsi', 'consumer', 'fmcg', 'kebutuhan pokok'] },
  { canonical: 'energy',                   aliases: ['energi', 'minyak', 'batubara', 'coal', 'migas'] },
  { canonical: 'materials',                aliases: ['bahan baku', 'material', 'kimia', 'semen', 'pertambangan', 'mining'] },
  { canonical: 'industrials',              aliases: ['industri', 'industrial', 'manufaktur', 'otomotif'] },
  { canonical: 'communication services',   aliases: ['telekomunikasi', 'telecom', 'komunikasi', 'media'] },
  { canonical: 'consumer discretionary',   aliases: ['retail', 'ritel', 'diskresioner', 'barang mewah'] },
  { canonical: 'real estate',              aliases: ['properti', 'property', 'real estate'] },
  { canonical: 'healthcare',               aliases: ['kesehatan', 'farmasi', 'health', 'pharmaceutical'] },
  { canonical: 'technology',               aliases: ['teknologi', 'tech', 'digital'] },
  { canonical: 'utilities',                aliases: ['utilitas', 'listrik', 'pln', 'air'] },
];

function sectorMatches(entitySector: string, stockSector: string): boolean {
  if (!entitySector || !stockSector) return false;

  const a = entitySector.toLowerCase().trim();
  const b = stockSector.toLowerCase().trim();

  if (a === b) return true;
  if (b.includes(a) || a.includes(b)) return true;

  for (const { canonical, aliases } of SECTOR_ALIASES) {
    const allForms = [canonical, ...aliases];
    const aMatches = allForms.some((f) => a.includes(f) || f.includes(a));
    const bMatches = allForms.some((f) => b.includes(f) || f.includes(b));
    if (aMatches && bMatches) return true;
  }

  return false;
}

// ── Public API ───────────────────────────────────────────────

/**
 * Returns all news impacts relevant to a given stock symbol + sector.
 * Matches: exact ticker, sector overlap, or BROAD_MARKET entity.
 * Sorted: CRITICAL first, then by newest analyzedAt.
 */
export function getImpactsForSymbol(
  symbol: string,
  sectorName: string
): StockNewsImpact[] {
  const cache = getAnalyzedCache();
  const now = Date.now();
  const impacts: StockNewsImpact[] = [];

  for (const entry of Array.from(cache.values())) {
    if (now - entry.timestamp > IMPACT_AGE_MS) continue;

    const analysis = entry.analysis;

    for (const entity of analysis.affectedEntities) {
      let matchType: 'STOCK' | 'SECTOR' | 'BROAD_MARKET' | null = null;

      if (entity.type === 'STOCK' && entity.symbol === symbol) {
        matchType = 'STOCK';
      } else if (entity.type === 'SECTOR' && sectorMatches(entity.name, sectorName)) {
        matchType = 'SECTOR';
      } else if (entity.type === 'BROAD_MARKET') {
        matchType = 'BROAD_MARKET';
      }

      if (matchType) {
        impacts.push({
          articleId:                  analysis.articleId,
          eventType:                  analysis.eventType,
          eventSeverity:              analysis.eventSeverity,
          direction:                  entity.direction,
          strength:                   entity.strength,
          mechanism:                  entity.mechanism,
          macroOverride:              analysis.macroOverride,
          macroOverrideReason:        analysis.macroOverrideReason,
          traderImplication:          analysis.traderImplication,
          requiresImmediateAttention: analysis.requiresImmediateAttention,
          expiryHorizon:              analysis.expiryHorizon,
          rawInsight:                 analysis.rawInsight,
          confidence:                 entity.confidence,
          matchType,
          analyzedAt: analysis.analyzedAt,
        });
        break; // One entry per analysis per symbol — avoid duplicates from multiple entities
      }
    }
  }

  return impacts.sort((a, b) => {
    const diff = (SEVERITY_ORDER[a.eventSeverity] ?? 3) - (SEVERITY_ORDER[b.eventSeverity] ?? 3);
    if (diff !== 0) return diff;
    return new Date(b.analyzedAt).getTime() - new Date(a.analyzedAt).getTime();
  });
}

/**
 * Returns all CRITICAL/HIGH severity analyses from the last 24h.
 * Sorted: requiresImmediateAttention first, then CRITICAL before HIGH.
 */
export function getMarketAlerts(): MarketAlert[] {
  const cache = getAnalyzedCache();
  const now = Date.now();
  const alerts: MarketAlert[] = [];

  for (const entry of Array.from(cache.values())) {
    if (now - entry.timestamp > IMPACT_AGE_MS) continue;

    const analysis = entry.analysis;
    if (analysis.eventSeverity !== 'CRITICAL' && analysis.eventSeverity !== 'HIGH') continue;

    alerts.push({
      articleId:                  analysis.articleId,
      eventType:                  analysis.eventType,
      eventSeverity:              analysis.eventSeverity as 'CRITICAL' | 'HIGH',
      macroOverride:              analysis.macroOverride,
      traderImplication:          analysis.traderImplication,
      requiresImmediateAttention: analysis.requiresImmediateAttention,
      rawInsight:                 analysis.rawInsight,
      affectedCount:              analysis.affectedEntities.length,
      analyzedAt:                 analysis.analyzedAt,
    });
  }

  return alerts.sort((a, b) => {
    if (a.requiresImmediateAttention !== b.requiresImmediateAttention) {
      return a.requiresImmediateAttention ? -1 : 1;
    }
    return (SEVERITY_ORDER[a.eventSeverity] ?? 1) - (SEVERITY_ORDER[b.eventSeverity] ?? 1);
  });
}

// ── News modifier ────────────────────────────────────────────

const DIRECTION_SCORES: Record<string, Record<string, number>> = {
  POSITIF: { KUAT: 8, SEDANG: 5, LEMAH: 2 },
  NEGATIF: { KUAT: -8, SEDANG: -5, LEMAH: -2 },
};
const NEWS_MODIFIER_CAP = 15;

/**
 * Computes a numeric readiness score modifier based on active news impacts.
 * Synchronous — reads only from in-memory cache.
 *
 * Returns:
 *   modifier      — capped ±15; apply to readiness score
 *   macroOverride — true if any active impact has macroOverride=YES_HARD
 *   context       — top-3 mechanism strings for UI display
 */
export function getNewsModifier(
  symbol: string,
  sectorName: string
): { modifier: number; macroOverride: boolean; context: string[] } {
  const impacts = getImpactsForSymbol(symbol, sectorName);

  if (impacts.length === 0) {
    return { modifier: 0, macroOverride: false, context: [] };
  }

  let total = 0;
  let macroOverride = false;
  const context: string[] = [];

  for (const impact of impacts) {
    const dirScores = DIRECTION_SCORES[impact.direction];
    if (dirScores) {
      total += dirScores[impact.strength] ?? 0;
    }
    if (impact.macroOverride === 'YES_HARD') macroOverride = true;
    if (impact.mechanism) context.push(impact.mechanism);
  }

  return {
    modifier:      Math.max(-NEWS_MODIFIER_CAP, Math.min(NEWS_MODIFIER_CAP, total)),
    macroOverride,
    context:       context.slice(0, 3),
  };
}

/**
 * Returns a summary of all analyses currently in cache (for status/debug).
 */
export function getNewsRouterStats(): {
  totalAnalyzed: number;
  freshAnalyzed: number;
  criticalAlerts: number;
  highAlerts: number;
} {
  const cache = getAnalyzedCache();
  const now = Date.now();
  let fresh = 0;
  let critical = 0;
  let high = 0;

  for (const entry of Array.from(cache.values())) {
    if (now - entry.timestamp < IMPACT_AGE_MS) {
      fresh++;
      if (entry.analysis.eventSeverity === 'CRITICAL') critical++;
      if (entry.analysis.eventSeverity === 'HIGH') high++;
    }
  }

  return {
    totalAnalyzed: cache.size,
    freshAnalyzed: fresh,
    criticalAlerts: critical,
    highAlerts: high,
  };
}
