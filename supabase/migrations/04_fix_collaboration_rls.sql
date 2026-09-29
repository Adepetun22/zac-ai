-- Fix: Allow users to join collaboration sessions via invite code / join flow.
--
-- Two RLS gaps prevented invites from working:
--
-- 1. Missing UPDATE policy on session_participants.
--    handleJoinSession() (CollaborationPage.jsx) calls .upsert() with
--    onConflict=['session_id','user_id']. PostgREST translates that into
--    INSERT ... ON CONFLICT DO UPDATE. When the participant row already
--    exists (e.g. the host re-joins their own session after
--    ensureUserSession() already created the row, or a user refreshes and
--    the row persists) the DO UPDATE branch fires but no UPDATE policy
--    existed, so RLS rejected it with 403 Forbidden.
--
-- 2. Restrictive SELECT policy on collaboration_sessions.
--    The only SELECT policy was "created_by = auth.uid()", so invitees
--    could not look up a session they were invited to. The SELECT
--    returned null, handleJoinSession() silently fell through, and the
--    invitee was never inserted into session_participants — making the
--    invite code appear to do nothing.
--
-- 3. (Bonus) dashboard_widgets was missing from the supabase_realtime
--    publication (noted in migration 03). Without it, real-time widget
--    channels subscribe successfully but never receive payload events.

-- ── Policy 1: Allow any authenticated user to look up a session by ID ──
-- The invite/join flow needs invitees to resolve a session UUID they were
-- given. Session metadata (id, created_by, invite_code, timestamps) is
-- not sensitive; widgets, comments, and participant lists are gated by
-- their own per-table policies.
DROP POLICY IF EXISTS "Users can view sessions by id" ON collaboration_sessions;
CREATE POLICY "Users can view sessions by id" ON collaboration_sessions
    FOR SELECT TO authenticated
    USING (true);

-- ── Policy 2: Allow users to update their own session_participants row ──
-- Required for upsert (INSERT ... ON CONFLICT DO UPDATE) to succeed when
-- the row already exists. Both USING and WITH CHECK check user_id =
-- auth.uid() so a user can only touch their own participation record.
DROP POLICY IF EXISTS "Users can update their own session participation" ON session_participants;
CREATE POLICY "Users can update their own session participation" ON session_participants
    FOR UPDATE TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- ── Realtime publication for dashboard_widgets ──
-- Migration 01 forgot to add dashboard_widgets to the realtime publication.
-- Without this, the WebSocket/realtime subscription channel subscribes
-- successfully but never receives INSERT/UPDATE/DELETE events for widgets.
DO $$ BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE dashboard_widgets;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
