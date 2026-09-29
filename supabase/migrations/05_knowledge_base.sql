-- Knowledge base for RAG: documents belonging to a collaboration session.
-- Each document is chunked into smaller pieces so that only the most relevant
-- chunks are retrieved at query time, keeping LLM context windows manageable.

CREATE TABLE IF NOT EXISTS knowledge_documents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID REFERENCES collaboration_sessions(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable row-level security
ALTER TABLE knowledge_documents ENABLE ROW LEVEL SECURITY;

-- Policies: participants in the owning session can read/write their own docs
DROP POLICY IF EXISTS "Session participants can view session knowledge" ON knowledge_documents;
DROP POLICY IF EXISTS "Session participants can insert session knowledge" ON knowledge_documents;
DROP POLICY IF EXISTS "Session participants can update session knowledge" ON knowledge_documents;
DROP POLICY IF EXISTS "Session participants can delete session knowledge" ON knowledge_documents;

CREATE POLICY "Session participants can view session knowledge" ON knowledge_documents
  FOR SELECT TO authenticated
  USING (
    session_id IN (
      SELECT s.id FROM collaboration_sessions s
      JOIN session_participants sp ON s.id = sp.session_id
      WHERE sp.user_id = auth.uid()
    )
  );

CREATE POLICY "Session participants can insert session knowledge" ON knowledge_documents
  FOR INSERT TO authenticated
  WITH CHECK (
    session_id IN (
      SELECT s.id FROM collaboration_sessions s
      JOIN session_participants sp ON s.id = sp.session_id
      WHERE sp.user_id = auth.uid()
    )
  );

CREATE POLICY "Session participants can update session knowledge" ON knowledge_documents
  FOR UPDATE TO authenticated
  USING (
    session_id IN (
      SELECT s.id FROM collaboration_sessions s
      JOIN session_participants sp ON s.id = sp.session_id
      WHERE sp.user_id = auth.uid()
    )
  );

CREATE POLICY "Session participants can delete session knowledge" ON knowledge_documents
  FOR DELETE TO authenticated
  USING (
    session_id IN (
      SELECT s.id FROM collaboration_sessions s
      JOIN session_participants sp ON s.id = sp.session_id
      WHERE sp.user_id = auth.uid()
    )
  );

-- Add an updated_at trigger
DROP TRIGGER IF EXISTS update_knowledge_documents_updated_at ON knowledge_documents;
CREATE TRIGGER update_knowledge_documents_updated_at
  BEFORE UPDATE ON knowledge_documents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
