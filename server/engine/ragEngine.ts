/**
 * ============================================================
 * RAG KNOWLEDGE BASE ENGINE v1.0
 * ============================================================
 * server/engine/ragEngine.ts
 *
 * Vector store backed by Neon DB + pgvector.
 * Embeddings: OpenAI text-embedding-3-small (1536 dims).
 *
 * Graceful degradation:
 *   - If OPENAI_API_KEY missing → storeDocument is a no-op,
 *     retrieveContext returns [].
 *   - If DATABASE_URL missing → same.
 *
 * DB prerequisite (run once on DB):
 *   CREATE EXTENSION IF NOT EXISTS vector;
 *   CREATE INDEX CONCURRENTLY ON rag_documents
 *     USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
 * ============================================================
 */

import OpenAI from 'openai';
import type { Pool } from '@neondatabase/serverless';

// Lazy pool — avoid importing db.ts (which throws) when DATABASE_URL is absent
let _pool: Pool | null = null;
async function getPool(): Promise<Pool | null> {
  if (!process.env.DATABASE_URL) return null;
  if (_pool) return _pool;
  const { pool } = await import('../db');
  _pool = pool as unknown as Pool;
  return _pool;
}

// ── Types ─────────────────────────────────────────────────────

export type DocType =
  | 'NEWS_OUTCOME'
  | 'RESEARCH_REPORT'
  | 'MANAGEMENT_PROFILE'
  | 'MARKET_PATTERN'
  | 'MACRO_CAUSAL';

export interface RagDocInput {
  type:       DocType;
  symbol:     string | null;
  sector:     string | null;
  content:    string;
  metadata:   Record<string, unknown>;
  validUntil: Date | null;
}

export interface RagDocResult {
  id:         number;
  type:       string;
  symbol:     string | null;
  sector:     string | null;
  content:    string;
  metadata:   Record<string, unknown> | null;
  similarity: number;
  createdAt:  Date;
}

// ── OpenAI client ──────────────────────────────────────────────

const openaiClient = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

// ── Embedding ──────────────────────────────────────────────────

async function embed(text: string): Promise<number[] | null> {
  if (!openaiClient) return null;
  try {
    const res = await openaiClient.embeddings.create({
      model: 'text-embedding-3-small',
      input: text.slice(0, 8000),
    });
    const vec = res.data[0].embedding;
    if (vec.length !== 1536) {
      console.warn('[ragEngine] unexpected embedding dims:', vec.length);
      return null;
    }
    return vec;
  } catch (err) {
    console.warn('[ragEngine] embed error:', err);
    return null;
  }
}

// ── Core functions ─────────────────────────────────────────────

export async function storeDocument(doc: RagDocInput): Promise<number | null> {
  const pool = await getPool();
  if (!pool || !openaiClient) return null;

  const embedding = await embed(doc.content);
  if (!embedding) return null;

  const vectorStr = `[${embedding.join(',')}]`;

  try {
    const result = await pool.query<{ id: number }>(
      `INSERT INTO rag_documents
         (type, symbol, sector, content, metadata, embedding, valid_until)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6::vector, $7)
       RETURNING id`,
      [
        doc.type,
        doc.symbol,
        doc.sector,
        doc.content,
        JSON.stringify(doc.metadata),
        vectorStr,
        doc.validUntil?.toISOString() ?? null,
      ]
    );
    return result.rows[0]?.id ?? null;
  } catch (err) {
    console.warn('[ragEngine] storeDocument error:', err);
    return null;
  }
}

export async function retrieveContext(
  query:   string,
  symbol:  string | null,
  topK = 5
): Promise<RagDocResult[]> {
  if (!query.trim()) return [];
  const pool = await getPool();
  if (!pool || !openaiClient) return [];

  const k = Math.min(Math.max(topK, 1), 100);
  const embedding = await embed(query);
  if (!embedding) return [];

  const vectorStr = `[${embedding.join(',')}]`;

  try {
    const result = await pool.query<{
      id: number; type: string; symbol: string | null; sector: string | null;
      content: string; metadata: Record<string, unknown> | null;
      similarity: number; created_at: Date;
    }>(
      `SELECT id, type, symbol, sector, content, metadata, created_at,
              1 - (embedding <=> $1::vector) AS similarity
       FROM rag_documents
       WHERE ($2::text IS NULL OR symbol = $2 OR symbol IS NULL)
         AND (valid_until IS NULL OR valid_until > NOW())
       ORDER BY embedding <=> $1::vector
       LIMIT $3`,
      [vectorStr, symbol, k]
    );
    return result.rows.map((r) => ({
      id:         r.id,
      type:       r.type,
      symbol:     r.symbol,
      sector:     r.sector,
      content:    r.content,
      metadata:   r.metadata,
      similarity: Number(r.similarity),
      createdAt:  r.created_at,
    }));
  } catch (err) {
    console.warn('[ragEngine] retrieveContext error:', err);
    return [];
  }
}

// ── Domain helpers ─────────────────────────────────────────────

export async function storeNewsOutcome(
  impactId:     string,
  actualChange: number,
  sessions:     number
): Promise<number | null> {
  const direction = actualChange > 0 ? 'naik' : actualChange < 0 ? 'turun' : 'flat';
  const content =
    `News outcome [${impactId}]: harga ${direction} ${Math.abs(actualChange).toFixed(2)}% ` +
    `selama ${sessions} sesi setelah publikasi berita.`;

  return storeDocument({
    type:       'NEWS_OUTCOME',
    symbol:     null,
    sector:     null,
    content,
    metadata:   { impactId, actualChange, sessions },
    validUntil: null,
  });
}

export function buildRetrievalQuery(symbol: string, context: string): string {
  return `${symbol} IDX Indonesia saham: ${context}`;
}

// ── Schema initialiser (run once at startup) ──────────────────

export async function ensureRagSchema(): Promise<void> {
  const pool = await getPool();
  if (!pool) return;
  try {
    await pool.query(`CREATE EXTENSION IF NOT EXISTS vector`);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS rag_documents (
        id          SERIAL PRIMARY KEY,
        type        TEXT    NOT NULL,
        symbol      TEXT,
        sector      TEXT,
        content     TEXT    NOT NULL,
        metadata    JSONB,
        embedding   vector(1536),
        valid_until TIMESTAMPTZ,
        created_at  TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS rag_documents_symbol_type_idx
        ON rag_documents (symbol, type)
    `);
    // IVFFlat — only worth creating once table has ≥100 rows
    await pool.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_indexes
          WHERE tablename = 'rag_documents'
            AND indexname  = 'rag_documents_embedding_ivfflat_idx'
        ) AND (SELECT COUNT(*) FROM rag_documents) >= 100 THEN
          EXECUTE '
            CREATE INDEX rag_documents_embedding_ivfflat_idx
              ON rag_documents
              USING ivfflat (embedding vector_cosine_ops)
              WITH (lists = 100)
          ';
        END IF;
      END $$
    `).catch(() => {}); // non-fatal if vector extension not yet available
  } catch (err) {
    console.warn('[ragEngine] ensureRagSchema warning:', err);
  }
}
