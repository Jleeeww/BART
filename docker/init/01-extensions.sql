-- Runs once, automatically, on first container start (empty data dir only).
-- Enables pgvector so the rag_documents.embedding vector(1536) column works.
CREATE EXTENSION IF NOT EXISTS vector;
