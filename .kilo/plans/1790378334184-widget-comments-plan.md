# Widget Comments — Implementation Plan

Per-widget threaded comments on the collaboration canvas: separate `widget_comments` table, Supabase Realtime, comment icon in the widget header opening a compact thread popover. Create / edit / delete + threaded replies. No @mentions.

## Locked decisions

| # | Decision |
|---|-----------|
| 1 | Separate `widget_comments` table, own RLS, own realtime channel |
| 2 | Scope: create / edit / delete + threaded replies. No @mentions |
| 3 | UI: per-widget comment icon in the widget header → compact thread popover |
| 4 | Transport: Supabase Realtime, mirroring the `dashboard_widgets` channel at `CollaborationPage.jsx:938` |
| 5 | Deleting a widget **cascades** its comment rows (`ON DELETE CASCADE`) |
| 6 | `author_name` denormalized on the row (from `currentUser.name`, `CollaborationPage.jsx:796`); no `profiles` join |
| 7 | Arbitrary `parent_id` depth in the schema; UI renders 2 levels (direct replies indented, deeper replies flattened with a "Replying to &lt;name&gt;" label) |

## Codebase facts that drive the design

- Stack is **plain JSX** — no `tsconfig.json`, no `src/types/`. Tailwind v4 + CSS vars (`var(--color-*)`), `lucide-react` icons, custom popovers only (no Radix/Headless UI).
- `Widget` is a local function component at `CollaborationPage.jsx:327`; header action buttons at `:401-411`. `onPointerDown` already early-returns on `button` (`:339`), so a header button does not fight drag. Still pass `e.stopPropagation()` like the download button does (`:403`).
- **The widget root has `overflow-hidden`** (`:393`). An absolutely-positioned popover rendered inside the widget would be clipped. The popover **must** use `createPortal` to `document.body` — the same pattern as the invite dialog (`:607`) and model explainer (`:707`).
- Reference realtime block: `CollaborationPage.jsx:938-984` — `supabase.channel(...)` → `.on('postgres_changes', { event: '*', schema: 'public', table, filter })` → `.subscribe()`, cleanup via `supabase.removeChannel(channel)`.
- `supabase/migrations/01_initial_schema.sql` has **no** `ALTER PUBLICATION supabase_realtime ADD TABLE` for `dashboard_widgets`. The new migration **must** add it, or the channel will subscribe successfully and silently never fire.
- `supabaseService.js:363` `subscribeToWidgets` filters on a `user_id` column that does not exist on `dashboard_widgets` — pre-existing dead/broken code. Do **not** mirror it. Leave it alone (out of scope) or fix separately.
- Auth: `useAuthStore()` at `CollaborationPage.jsx:793` gives `user`; `currentUser` (`:796`) supplies id/name/color. RLS requires a real `auth.uid()`, so the feature is gated on `user?.id`.
- No test framework exists. Validation is `npm run lint` + `npm run build` + manual two-browser check.

## Tasks

### 1. `supabase/migrations/03_widget_comments.sql` (new)

```sql
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
```

Reuse the existing `update_updated_at_column()` from `01_initial_schema.sql:84`.

**RLS** — `ALTER TABLE widget_comments ENABLE ROW LEVEL SECURITY;`. Membership gate copied verbatim from the `dashboard_widgets` policies (`01_initial_schema.sql:166-206`):

```sql
session_id IN (
  SELECT s.id FROM collaboration_sessions s
  JOIN session_participants sp ON s.id = sp.session_id
  WHERE sp.user_id = auth.uid()
)
```

Policy set:
- `SELECT TO authenticated` — membership gate, **plus** `EXISTS (SELECT 1 FROM dashboard_widgets w WHERE w.id = widget_id AND w.session_id = session_id)`. This closes the hole where a client posts a `session_id` it belongs to but pairs it with a widget from someone else's session.
- `INSERT TO authenticated` — same two conditions in `WITH CHECK`, **plus** `user_id = auth.uid()` (no impersonating other authors).
- `UPDATE TO authenticated` — `USING (user_id = auth.uid() AND <membership>)`. Author-only edits; no host override.
- `DELETE TO authenticated` — `USING (user_id = auth.uid() AND <membership>)`. Author-only deletes.

**Realtime publication** (idempotent, unlike migration 01):

```sql
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE widget_comments;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
```

### 2. `src/features/collaboration/widgetComments.js` (new)

Thin data layer over `supabase` from `src/config/supabase.js`. No `supabaseService` methods — the widget path in `CollaborationPage.jsx` talks to the client directly (`:874`, `:1097`, `:1124`, `:1146`), so mirror that.

- `fetchWidgetComments(widgetId)` — `select('*').eq('widget_id', …).order('created_at', { ascending: true })`.
- `createComment({ widgetId, sessionId, parentId, userId, authorName, content })` → returns the inserted row.
- `updateComment(id, content)` → returns the updated row.
- `deleteComment(id)`.
- `subscribeToWidgetComments(sessionId, handler)` → returns the channel; caller removes it.

All four throw on `error` so the UI can surface a notification via `addNotification` (`:794`). Return the row on insert/update so the caller can render optimistically.

### 3. `src/features/collaboration/WidgetCommentsPopover.jsx` (new)

- `createPortal` to `document.body`. Position from the trigger button's `getBoundingClientRect()`; fixed positioning, `z-50`; flip to above if it would overflow the viewport bottom; clamp to viewport edges horizontally.
- Recompute on `scroll` (capture) and `resize`, and close when the anchor leaves the viewport.
- Close on outside `mousedown` and `Escape` — copy the pattern from `Header.jsx:17-47`.
- Width ~320px, `max-h-[320px]` with `overflow-y-auto` on the list, textarea pinned at the bottom. Compact: no avatar images, small `text-xs` body, `var(--color-*)` only.
- Threading: build roots (`parent_id == null`) and children by `parent_id` in one pass. Render each root, then its direct children indented one level. A child whose own `parent_id` is not `null` (i.e. depth ≥ 2) renders flat under the root with a muted `Replying to {ancestorAuthorName}` prefix. Resolve ancestors through a `Map` of id → comment.
- Composer: `Enter` sends, `Shift+Enter` newlines, 2000-char cap with a counter past 1800, disabled while a write is in flight.
- `replyingTo` state: a small chip above the textarea (`Replying to <name>`, ✕ to cancel) toggled by a per-comment "Reply" affordance.
- Edit: inline textarea replacing the comment body, prefilled; `Save`/`Cancel`. Only offered when `comment.user_id === currentUserId`.
- Delete: only when `comment.user_id === currentUserId`; no confirmation for a single comment, but see the cascade note below.
- Empty state: "No comments yet" + the composer.
- Timestamp: relative ("2m") with `title={absolute ISO string}`.

### 4. `CollaborationPage.jsx` edits

- `Widget` props: add `sessionId`, `currentUserId`, `currentUserName`, and `commentCount` (or a `getCommentCount(widgetId)`).
- `Widget` header (`:401-411`): add a `MessageSquare` button **before** the delete `X`, matching the download button's markup — `p-1 rounded cursor-pointer transition-colors hover:opacity-70`, `style={{ color: 'var(--color-text-muted)' }}`, `title="Comments"`. Add a small count badge when `commentCount > 0`. Wrap the `Widget`'s `onPointerDown` so dragging closes any open popover.
- Import `MessageSquare` from `lucide-react` alongside the existing icons.
- Page-level state: `const [comments, setComments] = useState({})` keyed by `widget_id`, plus `const [commentsOpenFor, setCommentsOpenFor] = useState(null)`. One popover open at a time.
- Page-level realtime effect, immediately after the existing widget effect (`:938-984`): channel `widget-comments-${sessionId}` (sessionId in the name — still the same pattern, but avoids a static-name collision if the page ever mounts twice), `event: '*'`, `table: 'widget_comments'`, `filter: session_id=eq.${sessionId}`. Handler merges by `payload.new`/`payload.old` into the map, deduping on `id` (your own optimistic insert will echo back). `DELETE` removes by `id`. Cleanup `supabase.removeChannel(channel)`.
- Initial load: when `widgets` load (`:863-899`), fetch comments for all of them in one query (`.in('widget_id', ids)`) rather than per widget. Guard the 25-id Postgres `IN` limit the same way `supabaseService.getWidgets` batches (`:149`).
- Delete widget (`:1136`): also drop the entry from `comments` and clear `commentsOpenFor` if it matches.
- Guard: render the comment button only when `supabase` is truthy **and** `user?.id` exists. When Supabase env is missing the page degrades to localStorage (`:869`); a comment button there would be a dead end.

## Consequences to state, not silently accept

- **Deleting a root comment cascades to its replies** (`parent_id ... ON DELETE CASCADE`). Deleting a parent wipes the sub-thread with no undo. This mirrors the widget-delete answer (decision 5) but it is data loss, so the delete affordance for a comment with children should be visually distinct.
- `author_name` goes stale if a user renames themselves. Accepted per decision 6.
- `dashboard_widgets` is still missing from the `supabase_realtime` publication, so existing cross-client widget drag sync may already be broken. Fixing that is **out of scope** for this plan but worth a separate ticket.

## Validation

1. `npm run lint` — clean.
2. `npm run build` — clean (this is the only type-ish gate; there is no `tsc`).
3. Apply the migration in the Supabase SQL editor. Verify: `select relname from pg_publication_tables where pubname='supabase_realtime'` contains `widget_comments`; `\d widget_comments` shows both indexes and 4 policies; `select tgname from pg_trigger where tgrelid='widget_comments'::regclass` shows the updated_at trigger.
4. RLS spot-check while signed in as user A: `select * from widget_comments` returns only A's session rows. Signed out, returns zero rows (RLS enabled, no anon policy).
5. Two browsers, same session: A posts a root comment and a reply → appears in B's popover without refresh. A edits → B sees the new body. A deletes → comment disappears in B.
6. Reply-to-reply produces a depth-2 comment that renders flat with a "Replying to …" prefix.
7. Delete a widget with comments → comment rows gone (`select count(*) from widget_comments where widget_id = '<id>'` = 0), no error surfaced.
8. Popover near the viewport bottom flips above; scrolling the page moves it; dragging the widget closes it.
9. Clear `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` → the comment icon is absent, no console errors, the rest of the page still works.

## Out of scope

@mentions and notifications, comment resolution/checkbox, emoji reactions, editing `author_name`, fixing the broken `supabaseService.subscribeToWidgets`, adding `dashboard_widgets` to the realtime publication, server-side rate limiting.

## Open questions

None — all design decisions are locked above.
