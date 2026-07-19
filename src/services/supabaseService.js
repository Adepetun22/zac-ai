import { supabase } from '../config/supabase';

/**
 * Service class to handle all Supabase operations for the dashboard
 */
class SupabaseService {
  constructor() {
    this.client = supabase;
  }

  /**
   * Authentication methods
   */

  // Sign up a new user
  async signUp(email, password, name) {
    const { data, error } = await this.client.auth.signUp({
      email,
      password,
      options: {
        data: { name },
      },
    });
    
    if (error) throw error;
    return data;
  }

  // Sign in a user
  async signIn(email, password) {
    const { data, error } = await this.client.auth.signInWithPassword({
      email,
      password,
    });
    
    if (error) throw error;
    return data;
  }

  // Sign out the current user
  async signOut() {
    const { error } = await this.client.auth.signOut();
    if (error) throw error;
  }

  // Get current user session
  getCurrentUser() {
    return this.client.auth.getUser();
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
      .eq('user_id', userId);

    if (error) throw error;
    return (data || []).map((row) => row.session_id);
  }

  // Get all dashboard widgets for a user (across their sessions)
  async getWidgets(userId) {
    const sessionIds = await this.getUserSessionIds(userId);
    if (sessionIds.length === 0) return [];

    const { data, error } = await this.client
      .from('dashboard_widgets')
      .select('*')
      .in('session_id', sessionIds);

    if (error) throw error;
    return data;
  }

  // Create a new dashboard widget (must supply a session_id)
  async createWidget(widget) {
    const { data, error } = await this.client
      .from('dashboard_widgets')
      .insert([{
        ...widget,
        created_at: new Date().toISOString(),
      }])
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  // Update an existing dashboard widget
  async updateWidget(id, updates) {
    const { data, error } = await this.client
      .from('dashboard_widgets')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
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
    const sessionId = `default-${userId}`;

    // Try to create the session (idempotent thanks to the fixed id)
    await this.client
      .from('collaboration_sessions')
      .upsert({ id: sessionId, created_by: userId })
      .select('id')
      .maybeSingle();

    // Ensure the user is a participant
    await this.client
      .from('session_participants')
      .upsert({ session_id: sessionId, user_id: userId })
      .select('session_id')
      .maybeSingle();

    return sessionId;
  }
  /**
   * AI Models operations
   */

  // Get all AI models for a user
  async getAiModels(userId) {
    const { data, error } = await this.client
      .from('ai_models')
      .select('*')
      .eq('user_id', userId);
    
    if (error) throw error;
    return data;
  }

  // Create a new AI model
  async createAiModel(model) {
    const { data, error } = await this.client
      .from('ai_models')
      .insert([{
        name: model.name,
        provider: model.provider,
        status: model.status || 'inactive',
        cost: model.cost ?? 0,
        latency: model.latency ?? 0,
        api_requests: model.api_requests ?? 0,
        tokens_processed: model.tokens_processed ?? 0,
        user_id: model.user_id,
        created_at: new Date().toISOString(),
      }])
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  // Update an AI model
  async updateAiModel(id, updates) {
    const { data, error } = await this.client
      .from('ai_models')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }

  // Delete an AI model
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