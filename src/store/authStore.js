import { create } from 'zustand';
import { supabase } from '../config/supabase';
import supabaseService from '../services/supabaseService';

// Load the user's profile from the `profiles` table and merge the name
// into the auth user object. If no profile row exists yet (e.g. the user
// was created before the auto-create trigger), we upsert one.
const loadProfileIntoUser = async (authUser) => {
  if (!authUser) return authUser;
  try {
    let profile = await supabaseService.getProfile(authUser.id);
    if (!profile) {
      // Trigger may not have created the row (user pre-dates the trigger);
      // create it from auth metadata.
      profile = await supabaseService.upsertProfile({
        id: authUser.id,
        name: authUser.user_metadata?.name,
        email: authUser.email,
      });
    }
    if (profile) {
      return {
        ...authUser,
        name: profile.name || authUser.user_metadata?.name,
        email: profile.email || authUser.email,
        avatar_url: profile.avatar_url,
      };
    }
  } catch (err) {
    console.warn('Could not load profile:', err.message);
  }
  return {
    ...authUser,
    name: authUser.user_metadata?.name,
  };
};


const useAuthStore = create((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  
  initAuth: async () => {
    if (!supabase) {
      console.warn('Supabase not configured, initializing with mock auth');
      set({ 
        user: { id: 'mock-user', email: 'demo@example.com', name: 'Demo User' },
        isAuthenticated: true,
        isLoading: false
      });
      return;
    }
    
    // Get initial session
    const { data: { session } } = await supabase.auth.getSession();
    
    if (session) {
      const user = await loadProfileIntoUser(session.user);
      set({ 
        user, 
        isAuthenticated: true, 
        isLoading: false 
      });
    } else {
      set({ user: null, isAuthenticated: false, isLoading: false });
    }
    
    // Listen for auth changes
    const { data: { subscription } } = await supabase.auth.onAuthStateChange(
      async (_event, session) => {
        const user = session?.user ? await loadProfileIntoUser(session.user) : null;
        set({ 
          user,
          isAuthenticated: !!session,
          isLoading: false
        });
      }
    );
    
    return () => {
      subscription.unsubscribe();
    };
  },
  
  signIn: async (email, password) => {
    if (!supabase) {
      console.warn('Supabase not configured, using mock sign in');
      set({ 
        user: { id: 'mock-user', email, name: email.split('@')[0] },
        isAuthenticated: true 
      });
      return { error: null };
    }
    
    const { error, data } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    
    if (!error && data.session) {
      const user = await loadProfileIntoUser(data.user);
      set({ 
        user, 
        isAuthenticated: true 
      });
    }
    
    return { error };
  },
  
  signUp: async (email, password, name) => {
    if (!supabase) {
      console.warn('Supabase not configured, using mock sign up');
      set({ 
        user: { id: 'mock-user', email, name },
        isAuthenticated: true 
      });
      return { error: null };
    }
    
    const { error, data } = await supabaseService.signUp(email, password, name);
    if (error) return { error };
    
    if (data?.user) {
      // Best-effort: load the profile the trigger just created
      let user = { ...data.user, name: data.user.user_metadata?.name || name };
      try {
        const profile = await supabaseService.getProfile(data.user.id);
        if (profile) {
          user = { ...user, name: profile.name || user.name, email: profile.email || user.email };
        }
      } catch {
        // Trigger may not have flushed yet; metadata name is sufficient
      }
      set({ user, isAuthenticated: true });
    }
    
    return { error: null };
  },
  
  signOut: async () => {
    if (supabase) {
      await supabase.auth.signOut();
    }
    set({ user: null, isAuthenticated: false });
  },
  
  updateUser: async (updates) => {
    if (!supabase) {
      console.warn('Supabase not configured, updating mock user');
      set(state => ({ 
        user: { ...state.user, ...updates } 
      }));
      return { error: null };
    }
    
    const { error, data } = await supabase.auth.updateUser(updates);
    
    if (!error && data.user) {
      set({ user: data.user });
    }
    
    return { error };
  }
}));

export default useAuthStore;
