import { supabase } from '../config/supabase';

/**
 * Returns the current Supabase access token, or null if the user is not signed in
 * or Supabase isn't configured. Used to authenticate the Liveblocks WebSocket
 * connection by forwarding the token to our backend's /api/liveblocks-auth endpoint.
 */
export async function getSupabaseAccessToken() {
  if (!supabase) return null;
  try {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token || null;
  } catch {
    return null;
  }
}

/**
 * Builds an `authEndpoint` function suitable for `@liveblocks/client`'s
 * createClient({ authEndpoint }). It posts to `/api/liveblocks-auth` (proxied by
 * Netlify to the Render backend) with the room id and the user's Supabase
 * access token, and returns `{ token }` for Liveblocks.
 *
 * The same shape is reused by `LiveblocksProvider` for `@liveblocks/react`.
 */
export function createLiveblocksAuthEndpoint({ backendUrl } = {}) {
  const base = backendUrl || (import.meta.env.VITE_BACKEND_URL || '').replace(/\/$/, '')
  const url = base ? `${base}/api/liveblocks-auth` : '/api/liveblocks-auth'

  return async (room) => {
    const token = await getSupabaseAccessToken()
    const headers = { 'Content-Type': 'application/json' }
    if (token) headers['Authorization'] = `Bearer ${token}`

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ room }),
    })

    if (!response.ok) {
      // Returning { error: 'forbidden' } tells Liveblocks to give up and stop
      // retrying, instead of hammering the endpoint until it times out.
      const body = await response.json().catch(() => ({}))
      if (response.status === 401 || response.status === 403) {
        return { error: 'forbidden', reason: body.reason || body.error || 'Not authorized' }
      }
      throw new Error(`Liveblocks auth failed: HTTP ${response.status} ${body.detail || body.error || ''}`)
    }

    return await response.json()
  }
}