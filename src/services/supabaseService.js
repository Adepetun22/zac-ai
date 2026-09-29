import { supabase } from '../config/supabase';

// sessionStorage key that carries the reason a Supabase email link was
// rejected. The callback URL is enough for a *valid* link — the router reads
// the path, so `/reset-password?code=...` routes on its own — but on the
// failure path GoTrue appends the reason to the fragment and the client may
// clean that up before the page renders, which would leave the user staring
// at a blank form. Keeping the reason makes that message reliable.
const AUTH_ERROR_KEY = 'zac:authError';

const readSessionItem = (key) => {
  if (typeof window === 'undefined') return null;
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    // Storage can be unavailable (private mode, blocked cookies).
    return null;
  }
};

const writeSessionItem = (key, value) => {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(key, value);
  } catch {
    // Same as above: the flow still completes and the reason is read from the
    // URL instead, which is less reliable but still shown to the user.
  }
};

const removeSessionItem = (key) => {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(key);
  } catch {
    // Nothing to clean up when storage is unavailable.
  }
};

/**
 * Service class to handle all Supabase operations for the dashboard
 */
class SupabaseService {
  constructor() {
    this.client = supabase;
  }

  /**
   * Authentication methods
   *
   * ⚠ DEPRECATED — all credential-bearing auth operations are now proxied
   * through the backend (@/store/authStore) so the browser never sends
   * email/password directly to Supabase. These wrappers are kept for
   * backward-compatibility with any code that still calls them, but new code
   * MUST go through the auth store.
   */

  // Resolve the public origin of the deployed app, falling back to the
  // configured backend URL (with any /api suffix stripped) when there is no
  // browser window (SSR, tests, pre-hydration).
  getRedirectBase() {
    return (
      (typeof window !== 'undefined' && window.location?.origin) ||
      (import.meta.env.VITE_BACKEND_URL || '').replace(/\/api$/, '').replace(/\/$/, '') ||
      undefined
    );
  }

  // Stash why GoTrue rejected a link (expired / already-used recovery or
  // confirmation link). ResetPasswordPage prefers the reason still on the URL
  // and falls back to this, so an expired link never renders a blank form.
  rememberAuthError(message) {
    writeSessionItem(AUTH_ERROR_KEY, message);
  }

  readAuthError() {
    return readSessionItem(AUTH_ERROR_KEY) || '';
  }

  clearAuthError() {
    removeSessionItem(AUTH_ERROR_KEY);
  }

  // Sign up a new user. @deprecated — use useAuthStore.getState().signUp() instead.
  async signUp(email, password, name) {
    // Supabase sends a confirmation email by default, but it needs a
    // redirect target to build a working link. Without emailRedirectTo the
    // confirmation flow is dead — the user can never verify their account.
    //
    // The target deliberately carries no `#`: Supabase appends
    // `?code=<auth_code>` to it, and a `#` would swallow that query string
    // into the fragment where the client cannot read it, breaking the PKCE
    // exchange. The app routes on the path, so the link lands on
    // `<origin>/login?code=...`, the client exchanges the code there, and
    // PublicRoute forwards the now-authenticated user to /dashboard.
    const redirectBase = this.getRedirectBase();

    const { data, error } = await this.client.auth.signUp({
      email,
      password,
      options: {
        data: { name },
        emailRedirectTo: redirectBase ? `${redirectBase}/login` : undefined,
      },
    });

    if (error) throw error;
    return data;
  }

  // Send a password reset email. The redirect target is the reset page so the
  // recovery link lands the user where they can set a new password.
  // @deprecated Use `useAuthStore.getState().requestPasswordReset()` instead.
  //
  // NOTE: do NOT put a `#` in here. Supabase appends `?code=<auth_code>` to
  // whatever `redirectTo` you give it; with a `#` present the `?code=...` is
  // swallowed into the hash fragment, the client's `parseParametersFromURL`
  // can't read it and the PKCE exchange never happens — a valid recovery link
  // silently does nothing. Without the `#` the code stays in the query string,
  // the client exchanges it, and the app routes on the path straight to
  // `<origin>/reset-password?code=...`, where the new-password form renders.
  async requestPasswordReset(email) {
    const redirectBase = this.getRedirectBase();

    const { error } = await this.client.auth.resetPasswordForEmail(email, {
      redirectTo: redirectBase ? `${redirectBase}/reset-password` : undefined,
    });

    if (error) throw error;
    return { error: null };
  }

  // Sign in a user. @deprecated — use useAuthStore.getState().signIn() instead.
  async signIn(email, password) {
    const { data, error } = await this.client.auth.signInWithPassword({
      email,
      password,
    });
    
    if (error) throw error;
    return data;
  }

  // Sign out the current user. @deprecated — use useAuthStore.getState().signOut().
  async signOut() {
    const { error } = await this.client.auth.signOut();
    if (error) throw error;
  }

  // Get current user session
  getCurrentUser() {
    return this.client.auth.getUser();
  }

  // Update the current user's password. @deprecated — use useAuthStore.getState().updatePassword() instead.
  // Requires an active session.
  async updatePassword(newPassword) {
    const { error } = await this.client.auth.updateUser({
      password: newPassword,
    });
    if (error) throw error;
    return { error: null };
  }

  // Get a user's profile from the profiles table
  async getProfile(userId) {
    const { data, error } = await this.client
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (error) throw error;
    return data; // null if no row exists
  }

  // Upsert the current user's profile (used as a fallback if the trigger missed)
  async upsertProfile(profile) {
    const { data, error } = await this.client
      .from('profiles')
      .upsert(profile)
      .select('id, name, email, avatar_url')
      .single();

    if (error) throw error;
    return data;
  }

  // Update the current user's profile
  async updateProfile(userId, updates) {
    const { data, error } = await this.client
      .from('profiles')
      .update(updates)
      .eq('id', userId)
      .select('id, name, email, avatar_url')
      .single();

    if (error) throw error;
    return data;
  }

  // Listen for auth state changes
  onAuthStateChange(callback) {
    return this.client.auth.onAuthStateChange(callback);
  }

  /**
   * Dashboard widgets operations
   * Widgets are keyed by `session_id` (a collaboration session the user
   * participates in), not directly by `user_id`. These helpers resolve
   * the user's session(s) via `session_participants` first.
   */

  // Get the collaboration session ids a user belongs to
  async getUserSessionIds(userId) {
    const { data, error } = await this.client
      .from('session_participants')
      .select('session_id')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;
    return (data || []).map((row) => row.session_id);
  }

  // Get all dashboard widgets for a user (across their sessions)
  async getWidgets(userId) {
    const sessionIds = await this.getUserSessionIds(userId);
    if (sessionIds.length === 0) return [];

    const MAX_IN_BATCH = 25;
    let allWidgets = [];

    for (let i = 0; i < sessionIds.length; i += MAX_IN_BATCH) {
      const batch = sessionIds.slice(i, i + MAX_IN_BATCH);
      const { data, error } = await this.client
        .from('dashboard_widgets')
        .select('*')
        .in('session_id', batch);

      if (error) throw error;
      if (data && data.length > 0) {
        allWidgets = allWidgets.concat(data);
      }
    }

    return allWidgets;
  }

  // Create a new dashboard widget (must supply a session_id)
  async createWidget(widget) {
    const { error } = await this.client
      .from('dashboard_widgets')
      .insert([{
        ...widget,
        created_at: new Date().toISOString(),
      }]);

    if (error) throw error;
  }

  // Update an existing dashboard widget
  async updateWidget(id, updates) {
    const { error } = await this.client
      .from('dashboard_widgets')
      .update(updates)
      .eq('id', id);

    if (error) throw error;
  }

  // Delete a dashboard widget
  async deleteWidget(id) {
    const { error } = await this.client
      .from('dashboard_widgets')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
  }

  /**
   * Ensure the current user has a default collaboration session and is a
   * participant in it. Widgets are keyed by `session_id`, and RLS only
   * allows access to sessions the user participates in, so this must exist
   * before reading/writing widgets. Returns the session id.
   */
  async ensureUserSession(userId) {
    if (this.client) {
      try {
        const { data: { session } } = await this.client.auth.getSession();
        if (!session) {
          console.warn('Supabase: no active auth session, skipping collaboration session creation');
          return crypto.randomUUID();
        }

        const { data: existing, error: existingError } = await this.client
          .from('session_participants')
          .select('session_id')
          .eq('user_id', userId)
          .limit(1);

        if (!existingError && existing && existing.length > 0) {
          return existing[0].session_id;
        }

        const sessionId = crypto.randomUUID();

        await this.client
          .from('collaboration_sessions')
          .insert({ id: sessionId, created_by: userId });

        await this.client
          .from('session_participants')
          .upsert({ session_id: sessionId, user_id: userId }, { onConflict: ['session_id', 'user_id'] });

        return sessionId;
      } catch (error) {
        console.warn('Could not ensure collaboration session:', error.message);
      }
    }

    return crypto.randomUUID();
  }

  // Get session details including creator
  async getSession(sessionId) {
    const { data, error } = await this.client
      .from('collaboration_sessions')
      .select('*')
      .eq('id', sessionId)
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  // Get all participants in a session
  async getSessionParticipants(sessionId) {
    const { data, error } = await this.client
      .from('session_participants')
      .select('user_id')
      .eq('session_id', sessionId);

    if (error) throw error;
    return (data || []).map(row => row.user_id);
  }

  // Remove a participant from a session
  async removeParticipant(sessionId, userId) {
    const { error } = await this.client
      .from('session_participants')
      .delete()
      .eq('session_id', sessionId)
      .eq('user_id', userId);

    if (error) throw error;
  }
  /**
    * AI Models operations
    *
    * ⚠ DEPRECATED — the direct-Supabase methods below are kept for backward
    * compatibility. New code MUST use the backend /api/models endpoints
    * which encrypt API keys server-side before storing them.
    *
    * The backend endpoints (POST/GET/PUT/DELETE /api/models) handle:
    *   - Encrypting api_key before storing in Supabase
    *   - Decrypting api_key only when the server needs it for LLM calls
    *   - Masking api_key in list responses
    *
    * Direct-Supabase methods (below) store/return plaintext keys and should
    * not be used for new features.
    */

  // ── Backend-routed model operations (encrypts API keys) ──────

  // Build the URL for the backend API.
  getBackendUrl(path) {
    const backendUrl = (import.meta.env.VITE_BACKEND_URL || '').replace(/\/$/, '')
    return backendUrl ? `${backendUrl}${path}` : `/api${path}`
  }

  // Create a model via the backend (api_key is encrypted server-side).
  async createAiModelBackend(model) {
    const response = await fetch(this.getBackendUrl('/models'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(model),
    })
    if (!response.ok) {
      const data = await response.json().catch(() => ({}))
      throw new Error(data.error || `HTTP ${response.status}`)
    }
    return response.json()
  }

  // Fetch models via the backend (api_key is masked in the response).
  async getAiModelsBackend(userId) {
    const response = await fetch(this.getBackendUrl(`/models?userId=${encodeURIComponent(userId)}`))
    if (!response.ok) {
      const data = await response.json().catch(() => ({}))
      throw new Error(data.error || `HTTP ${response.status}`)
    }
    const data = await response.json()
    return data.aiModels || []
  }

  // Fetch a single model via the backend (returns decrypted api_key for editing).
  async getAiModelBackend(id, userId) {
    const response = await fetch(this.getBackendUrl(`/models/${encodeURIComponent(id)}?userId=${encodeURIComponent(userId)}`))
    if (!response.ok) {
      const data = await response.json().catch(() => ({}))
      throw new Error(data.error || `HTTP ${response.status}`)
    }
    const data = await response.json()
    return data.aiModel
  }

  // Update a model via the backend (api_key is encrypted server-side if provided).
  async updateAiModelBackend(id, updates) {
    const response = await fetch(this.getBackendUrl(`/models/${encodeURIComponent(id)}`), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    })
    if (!response.ok) {
      const data = await response.json().catch(() => ({}))
      throw new Error(data.error || `HTTP ${response.status}`)
    }
    return response.json()
  }

  // Delete a model via the backend.
  async deleteAiModelBackend(id) {
    const response = await fetch(this.getBackendUrl(`/models/${encodeURIComponent(id)}`), {
      method: 'DELETE',
    })
    if (!response.ok) {
      const data = await response.json().catch(() => ({}))
      throw new Error(data.error || `HTTP ${response.status}`)
    }
    return response.json()
  }

  // ── Deprecated direct-Supabase methods (plaintext keys) ───────

  // Get all AI models for a user. @deprecated Use getAiModelsBackend() instead.
  async getAiModels(userId) {
    const { data, error } = await this.client
      .from('ai_models')
      .select('*')
      .eq('user_id', userId);

    if (error) throw error;
    return data;
  }

  // Create a new AI model. @deprecated Use createAiModelBackend() instead.
  async createAiModel(model) {
    const { error } = await this.client
      .from('ai_models')
      .insert([{
        name: model.name,
        provider: model.provider,
        model_id: model.model_id || null,
        api_key: model.api_key || null,
        endpoint: model.endpoint || null,
        status: model.status || 'active',
        cost: model.cost ?? 0,
        latency: model.latency ?? 0,
        api_requests: model.api_requests ?? 0,
        tokens_processed: model.tokens_processed ?? 0,
        user_id: model.user_id,
        created_at: new Date().toISOString(),
      }]);

    if (error) throw error;
  }

  // Update an AI model. @deprecated Use updateAiModelBackend() instead.
  async updateAiModel(id, updates) {
    const { error } = await this.client
      .from('ai_models')
      .update(updates)
      .eq('id', id);

    if (error) throw error;
  }

  // Delete an AI model. @deprecated Use deleteAiModelBackend() instead.
  async deleteAiModel(id) {
    const { error } = await this.client
      .from('ai_models')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  /**
   * Analytics data operations
   */

  // Get analytics data for a user
  async getAnalytics(userId, startDate, endDate) {
    let query = this.client
      .from('analytics_data')
      .select('*')
      .eq('user_id', userId);

    if (startDate) {
      query = query.gte('created_at', startDate.toISOString());
    }
    if (endDate) {
      query = query.lte('created_at', endDate.toISOString());
    }

    const { data, error } = await query
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data;
  }

  // Insert analytics data
  async insertAnalytics(data) {
    const { error } = await this.client
      .from('analytics_data')
      .insert([{
        ...data,
        user_id: data.user_id,
        created_at: new Date().toISOString(),
      }]);
    
    if (error) throw error;
  }

  /**
   * Real-time subscriptions
   */

  // Subscribe to widget changes for a user
  subscribeToWidgets(userId, callback) {
    return this.client
      .channel(`widgets-${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'dashboard_widgets',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          callback(payload);
        }
      )
      .subscribe();
  }

  // Subscribe to AI model changes for a user
  subscribeToAiModels(userId, callback) {
    return this.client
      .channel(`ai-models-${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'ai_models',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          callback(payload);
        }
      )
      .subscribe();
  }

  /**
   * Helper methods
   */

  // Check if Supabase is properly configured
  isInitialized() {
    return !!this.client;
  }

  // Get Supabase client instance
  getClient() {
    return this.client;
  }
}

// Create a singleton instance
const supabaseService = new SupabaseService();

export default supabaseService;
