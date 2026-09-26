import { supabase } from '../../config/supabase'

// Thin data layer over the shared Supabase client. The widget path in
// CollaborationPage.jsx talks to the client directly (insert/update/delete
// inline at :1097/:1124/:1146), so this module mirrors that style rather
// than adding supabaseService methods.
//
// Every call throws on error so the caller can surface a notification via
// addNotification(). Insert/update return the row so the UI can render
// optimistically before the realtime echo arrives.

const MAX_IN_BATCH = 25

// Fetch every comment for the given widget IDs in one query, mirroring the
// batching in supabaseService.getWidgets (Postgres IN limit).
export async function fetchWidgetComments(widgetIds) {
  if (!supabase) return []
  if (!widgetIds || widgetIds.length === 0) return []

  let allRows = []
  for (let i = 0; i < widgetIds.length; i += MAX_IN_BATCH) {
    const batch = widgetIds.slice(i, i + MAX_IN_BATCH)
    const { data, error } = await supabase
      .from('widget_comments')
      .select('*')
      .in('widget_id', batch)
      .order('created_at', { ascending: true })

    if (error) throw error
    if (data) allRows = allRows.concat(data)
  }
  return allRows
}

export async function createComment({ widgetId, sessionId, parentId, userId, authorName, content }) {
  if (!supabase) throw new Error('Supabase not configured')
  const { data, error } = await supabase
    .from('widget_comments')
    .insert([{
      widget_id: widgetId,
      session_id: sessionId,
      parent_id: parentId || null,
      user_id: userId,
      author_name: authorName,
      content,
    }])
    .select()
    .single()

  if (error) throw error
  return data
}

export async function updateComment(id, content) {
  if (!supabase) throw new Error('Supabase not configured')
  const { data, error } = await supabase
    .from('widget_comments')
    .update({ content })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function deleteComment(id) {
  if (!supabase) throw new Error('Supabase not configured')
  const { error } = await supabase
    .from('widget_comments')
    .delete()
    .eq('id', id)

  if (error) throw error
}

// Subscribe to realtime changes for a session. Returns the channel; the
// caller is responsible for supabase.removeChannel(channel) on cleanup.
// Channel name includes sessionId to avoid a static-name collision if the
// page ever mounts twice.
export function subscribeToWidgetComments(sessionId, handler) {
  if (!supabase) return null
  const channel = supabase
    .channel(`widget-comments-${sessionId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'widget_comments',
        filter: `session_id=eq.${sessionId}`,
      },
      handler
    )
    .subscribe()
  return channel
}