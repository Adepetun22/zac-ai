-- Per-widget threaded comments on the collaboration canvas.
-- Depends on dashboard_widgets (01_initial_schema.sql) and the
-- update_updated_at_column() helper defined there.

CREATE TABLE IF NOT EXISTS widget_comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  widget_id UUID NOT NULL REFERENCES dashboard_widgets(id) ON DELETE CASCADE,
  session_id UUID NOT NULL,
  parent_id UUID REFERENCES widget_comments(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  author_name TEXT NOT NULL,
  content TEXT NOT NULL CHECK (char_length(content) BETWEEN 1 AND 2000),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS widget_comments_widget_idx
  ON widget_comments (widget_id, created_at);
CREATE INDEX IF NOT EXISTS widget_comments_parent_idx
  ON widget_comments (parent_id);

DROP TRIGGER IF EXISTS update_widget_comments_updated_at ON widget_comments;
CREATE TRIGGER update_widget_comments_updated_at
  BEFORE UPDATE ON widget_comments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE widget_comments ENABLE ROW LEVEL SECURITY;

-- Membership gate, copied verbatim from the dashboard_widgets policies
-- (01_initial_schema.sql:166-206): the caller must be a participant of
-- the session the comment belongs to.
--
-- SELECT additionally requires that the widget lives in that same
-- session — this closes the hole where a client posts a session_id it
-- belongs to but pairs it with a widget from someone else's session.
DROP POLICY IF EXISTS "Users can view comments in their sessions" ON widget_comments;
CREATE POLICY "Users can view comments in their sessions" ON widget_comments
  FOR SELECT TO authenticated
  USING (
    session_id IN (
      SELECT s.id FROM collaboration_sessions s
      JOIN session_participants sp ON s.id = sp.session_id
      WHERE sp.user_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM dashboard_widgets w
      WHERE w.id = widget_comments.widget_id
        AND w.session_id = widget_comments.session_id
    )
  );

-- INSERT: same two conditions in WITH CHECK, plus user_id = auth.uid()
-- (no impersonating other authors).
DROP POLICY IF EXISTS "Users can insert comments in their sessions" ON widget_comments;
CREATE POLICY "Users can insert comments in their sessions" ON widget_comments
  FOR INSERT TO authenticated
  WITH CHECK (
    session_id IN (
      SELECT s.id FROM collaboration_sessions s
      JOIN session_participants sp ON s.id = sp.session_id
      WHERE sp.user_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM dashboard_widgets w
      WHERE w.id = widget_comments.widget_id
        AND w.session_id = widget_comments.session_id
    )
    AND user_id = auth.uid()
  );

-- UPDATE: author-only edits; no host override.
DROP POLICY IF EXISTS "Users can update their own comments" ON widget_comments;
CREATE POLICY "Users can update their own comments" ON widget_comments
  FOR UPDATE TO authenticated
  USING (
    user_id = auth.uid()
    AND session_id IN (
      SELECT s.id FROM collaboration_sessions s
      JOIN session_participants sp ON s.id = sp.session_id
      WHERE sp.user_id = auth.uid()
    )
  );

-- DELETE: author-only deletes.
DROP POLICY IF EXISTS "Users can delete their own comments" ON widget_comments;
CREATE POLICY "Users can delete their own comments" ON widget_comments
  FOR DELETE TO authenticated
  USING (
    user_id = auth.uid()
    AND session_id IN (
      SELECT s.id FROM collaboration_sessions s
      JOIN session_participants sp ON s.id = sp.session_id
      WHERE sp.user_id = auth.uid()
    )
  );

-- Realtime publication (idempotent — migration 01 forgot this for
-- dashboard_widgets, so without it the channel subscribes successfully
-- and silently never fires).
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE widget_comments;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;