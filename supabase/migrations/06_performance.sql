-- Performance and RAG search support for a multi-user deployment.
--
-- Run this migration against Supabase after 05_knowledge_base.sql. It is
-- intentionally idempotent so it can be applied repeatedly.

-- ── Foreign-key and hot-path indexes ────────────────────────
CREATE INDEX IF NOT EXISTS idx_dashboard_widgets_session_id
  ON dashboard_widgets (session_id);

CREATE INDEX IF NOT EXISTS idx_ai_models_user_id
  ON ai_models (user_id);

CREATE INDEX IF NOT EXISTS idx_ai_models_user_model_status
  ON ai_models (user_id, model_id, status);

CREATE INDEX IF NOT EXISTS idx_analytics_data_user_id_created_at
  ON analytics_data (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_session_participants_user_id
  ON session_participants (user_id);

CREATE INDEX IF NOT EXISTS idx_collaboration_sessions_created_by
  ON collaboration_sessions (created_by);

CREATE INDEX IF NOT EXISTS idx_knowledge_documents_session_created
  ON knowledge_documents (session_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_knowledge_documents_user_id
  ON knowledge_documents (user_id);

-- ── Postgres full-text search for knowledge documents ───────
-- A stored generated column keeps the index in sync without a trigger.
ALTER TABLE knowledge_documents
  ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (
    to_tsvector(
      'english',
      coalesce(title, '') || ' ' || coalesce(content, '')
    )
  ) STORED;

CREATE INDEX IF NOT EXISTS idx_knowledge_documents_search_vector
  ON knowledge_documents USING GIN (search_vector);

-- Search a single session's documents. The caller (service-role route) has
-- already verified session membership; RLS also protects direct client access.
CREATE OR REPLACE FUNCTION search_knowledge_documents(
  p_session_id UUID,
  p_query TEXT,
  p_top_k INTEGER DEFAULT 5
)
RETURNS TABLE (
  doc_id UUID,
  title TEXT,
  content TEXT,
  relevance REAL
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    kd.id AS doc_id,
    kd.title,
    kd.content,
    ts_rank(kd.search_vector, websearch_to_tsquery('english', p_query)) AS relevance
  FROM knowledge_documents AS kd
  WHERE kd.session_id = p_session_id
    AND kd.search_vector @@ websearch_to_tsquery('english', p_query)
  ORDER BY relevance DESC
  LIMIT GREATEST(1, LEAST(COALESCE(p_top_k, 5), 20));
$$;

GRANT EXECUTE ON FUNCTION search_knowledge_documents(UUID, TEXT, INTEGER) TO anon, authenticated, service_role;

-- List documents for the knowledge panel. Only a short preview is returned so
-- a session with many large documents cannot exhaust the API response.
CREATE OR REPLACE FUNCTION list_knowledge_documents(
  p_session_id UUID,
  p_limit INTEGER DEFAULT 200
)
RETURNS TABLE (
  id UUID,
  session_id UUID,
  user_id UUID,
  title TEXT,
  content TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    kd.id,
    kd.session_id,
    kd.user_id,
    kd.title,
    left(kd.content, 500) AS content,
    kd.created_at,
    kd.updated_at
  FROM knowledge_documents AS kd
  WHERE kd.session_id = p_session_id
  ORDER BY kd.created_at DESC
  LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 200), 500));
$$;

GRANT EXECUTE ON FUNCTION list_knowledge_documents(UUID, INTEGER) TO anon, authenticated, service_role;