import { create } from 'zustand';
import { supabase } from '../config/supabase';
import supabaseService from '../services/supabaseService';
import useNotificationStore from './notificationStore';

// ── Backend auth proxy helpers ─────────────────────────────────
// Auth credentials (email/password) are sent to the backend, which uses the
// Supabase service-role key to call the auth API. The browser never talks to
// Supabase directly for auth, so the Network tab never reveals the Supabase
// URL or anon key during sign-in / sign-up / password-reset flows.

// Build the URL for the backend auth API.
// When VITE_BACKEND_URL is set (production) we append the path directly.
// When it's absent (local dev) the Vite proxy forwards /api/* → backend.
const getAuthApiUrl = (path) => {
  const backendUrl = (import.meta.env.VITE_BACKEND_URL || '').replace(/\/$/, '')
  return backendUrl ? `${backendUrl}${path}` : `/api${path}`
}

// Lightweight wrapper — returns { ok, data } so callers can check status.
async function authFetch(path, options = {}) {
  const response = await fetch(getAuthApiUrl(path), {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
  })
  const data = await response.json().catch(() => ({}))
  return { ok: response.ok, data }
}

// Retrieve the current access token from the client-side session.
async function getAccessToken() {
  if (!supabase) return null
  const { data: { session } } = await supabase.auth.getSession()
  return session?.access_token || null
}

// Restore the session on the client-side Supabase client so that data
// subscriptions / realtime channels work as before.
async function setClientSession(session) {
  if (!supabase || !session) return
  try {
    await supabase.auth.setSession(session)
  } catch (err) {
    console.warn('Failed to restore client session:', err.message)
  }
}

// Params Supabase puts on an auth-callback URL. They must be read BEFORE the
// first `supabase.auth` call: the client strips `?code=` from the query string
// with `history.replaceState` during its own initialize(), and on the failure
// path the params live in the hash instead. The router only looks at the path,
// so the fragment is free to carry the auth result — but read it anyway, since
// nothing in the app is guaranteed to have cleaned it up.
const readCallbackParams = () => {
  if (typeof window === 'undefined') return {};
  const params = {};
  const merge = (source) => {
    source.forEach((value, key) => {
      if (!(key in params)) params[key] = value;
    });
  };
  merge(new URLSearchParams(window.location.search));
  const hash = window.location.hash || '';
  // The fragment carries the callback result, never a route, so the whole of
  // it is safe to parse as params.
  if (hash.includes('=')) merge(new URLSearchParams(hash.replace(/^#/, '')));
  return params;
};

// Human-readable reason a link was rejected, or '' when the callback is fine.
const describeCallbackError = (params) => {
  const code = params.error_code || '';
  const description = (params.error_description || params.error || '').replace(/\+/g, ' ');
  if (!code && !description) return '';
  if (description && code) return `${description} (${code})`;
  return description || code || 'This link is invalid or has expired.';
};

// Load the user's profile from the `profiles` table and merge the name
// into the auth user object. If no profile row exists yet (e.g. the user
// was created before the auto-create trigger), we upsert one.
const splitName = (fullName) => {
  if (!fullName) return { first_name: undefined, last_name: undefined };
  const parts = fullName.trim().split(' ');
  return {
    first_name: parts[0] || undefined,
    last_name: parts.slice(1).join(' ') || undefined,
  };
};

const loadProfileIntoUser = async (authUser) => {
  if (!authUser) return authUser;
  try {
    let profile = await supabaseService.getProfile(authUser.id);
    if (!profile) {
      profile = await supabaseService.upsertProfile({
        id: authUser.id,
        name: authUser.user_metadata?.name,
        email: authUser.email,
      });
    }
    if (profile) {
      const nameParts = splitName(profile.name || authUser.user_metadata?.name);
      return {
        ...authUser,
        ...nameParts,
        name: profile.name || authUser.user_metadata?.name,
        email: profile.email || authUser.email,
        avatar_url: profile.avatar_url,
        user_metadata: {
          ...authUser.user_metadata,
          ...nameParts,
          name: profile.name || authUser.user_metadata?.name,
        },
      };
    }
  } catch (err) {
    console.warn('Could not load profile:', err.message);
  }
  const nameParts = splitName(authUser.user_metadata?.name);
  return {
    ...authUser,
    ...nameParts,
    user_metadata: {
      ...authUser.user_metadata,
      ...nameParts,
    },
  };
};


const useAuthStore = create((set, get) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  sessionTimeoutMs: 30 * 60 * 1000,
  warningTimeoutMs: 5 * 60 * 1000,
  logoutTimer: null,
  warningTimer: null,
  
  resetSessionTimer: () => {
    const { logoutTimer, warningTimer, sessionTimeoutMs, warningTimeoutMs } = get();
    if (logoutTimer) clearTimeout(logoutTimer);
    if (warningTimer) clearTimeout(warningTimer);
    
    const logoutId = setTimeout(() => {
      get().signOut();
    }, sessionTimeoutMs);
    
    const warningId = setTimeout(() => {
      useNotificationStore.getState().addUserNotification('Session expiring soon', 'You will be signed out due to inactivity');
    }, sessionTimeoutMs - warningTimeoutMs);
    
    set({ logoutTimer: logoutId, warningTimer: warningId });
  },
  
  initAuth: async () => {
    if (!supabase) {
      console.warn('Supabase not configured, initializing with mock auth');
      set({ 
        user: { id: 'mock-user', email: 'demo@example.com', name: 'Demo User' },
        isAuthenticated: true,
        isLoading: false
      });
      get().resetSessionTimer();
      return;
    }
    
    // Stash why GoTrue rejected the link, while the reason is still on the URL.
    // The router only reads the path, so the fragment survives navigation, but
    // the client is free to clean it up and the page cannot render a blank form
    // for a rejected link — remember the reason as a fallback.
    const callbackError = describeCallbackError(readCallbackParams());
    if (callbackError) supabaseService.rememberAuthError(callbackError);

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
      async (event, session) => {
        const user = session?.user ? await loadProfileIntoUser(session.user) : null;
        set({
          user,
          isAuthenticated: !!session,
          isLoading: false
        });

        if (event === 'SIGNED_IN' && session) {
          get().resetSessionTimer();
        } else if (event === 'SIGNED_OUT') {
          const { logoutTimer, warningTimer } = get();
          if (logoutTimer) clearTimeout(logoutTimer);
          if (warningTimer) clearTimeout(warningTimer);
          set({ logoutTimer: null, warningTimer: null });
        }
      }
    );
    
    // Set up inactivity timer if authenticated
    if (session) {
      get().resetSessionTimer();
      const activityEvents = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
      const handleActivity = () => get().resetSessionTimer();
      activityEvents.forEach(event => document.addEventListener(event, handleActivity, { passive: true }));
      
      return () => {
        subscription.unsubscribe();
        activityEvents.forEach(event => document.removeEventListener(event, handleActivity));
        const { logoutTimer, warningTimer } = get();
        if (logoutTimer) clearTimeout(logoutTimer);
        if (warningTimer) clearTimeout(warningTimer);
      };
    }
    
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
    
    const { ok, data } = await authFetch('/auth/signin', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })

    if (!ok || data.error) {
      return { error: new Error(data.error || 'Failed to sign in') }
    }

    // Restore the session on the client-side Supabase client so that
    // realtime subscriptions and data operations keep working.
    if (data.session) {
      await setClientSession(data.session)
    }

    if (data.user) {
      const user = await loadProfileIntoUser(data.user)
      set({ user, isAuthenticated: true })
    }

    return { error: null }
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
    
    const { ok, data } = await authFetch('/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ email, password, name }),
    })

    if (!ok || data.error) {
      return { error: new Error(data.error || 'Failed to create account') }
    }

    // When email confirmation is enabled, signUp returns a user but no
    // session — logging in there would bypass the confirmation gate.
    if (data?.user && data?.session) {
      await setClientSession(data.session)
      let user = { ...data.user, name: data.user.user_metadata?.name || name }
      try {
        const profile = await supabaseService.getProfile(data.user.id)
        if (profile) {
          user = { ...user, name: profile.name || user.name, email: profile.email || user.email }
        }
      } catch { /* trigger may not have flushed yet */ }
      set({ user, isAuthenticated: true })
    }

    return { error: null }
  },
  
  signOut: async () => {
    // Also notify the backend so it can perform any server-side cleanup.
    const accessToken = await getAccessToken()
    if (accessToken) {
      try {
        await authFetch('/auth/signout', {
          method: 'POST',
          headers: { Authorization: `Bearer ${accessToken}` },
          body: JSON.stringify({ access_token: accessToken }),
        })
      } catch { /* ignore — local sign-out still proceeds */ }
    }
    if (supabase) {
      await supabase.auth.signOut();
    }
    set({ user: null, isAuthenticated: false });
  },
  
  // Send a password reset email. Always reports success to the caller so the
  // UI can show a neutral confirmation — Supabase deliberately does not reveal
  // whether an address is registered, and echoing that back would let anyone
  // enumerate accounts.
  requestPasswordReset: async (email) => {
    if (!supabase) {
      console.warn('Supabase not configured, password reset unavailable');
      return { error: new Error('Password reset is not available right now') };
    }

    const { ok, data } = await authFetch('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    })

    if (!ok || data.error) {
      return { error: new Error(data.error || 'Failed to send reset email') }
    }

    return { error: null };
  },
  
  // Set a new password from the recovery flow. Distinct from updatePassword,
  // which serves the authenticated Settings change and must not sign the user
  // out — the recovery session is single-purpose and is dropped here once the
  // new password is set.
  resetPassword: async (newPassword) => {
    if (!supabase) {
      return { error: new Error('Password reset is not available right now') };
    }

    const accessToken = await getAccessToken()
    if (!accessToken) {
      return { error: new Error('No active recovery session') }
    }

    const { ok, data } = await authFetch('/auth/update-password', {
      method: 'POST',
      body: JSON.stringify({ password: newPassword, access_token: accessToken }),
    })

    if (!ok || data.error) {
      return { error: new Error(data.error || 'Failed to reset password') }
    }

    // Clear the recovery session — it's single-purpose.
    await supabase.auth.signOut();
    set({ user: null, isAuthenticated: false });

    return { error: null };
  },
  
  updateUser: async (updates) => {
    if (!supabase) {
      console.warn('Supabase not configured, updating mock user');
      set(state => ({
        user: { ...state.user, ...updates }
      }));
      return { error: null };
    }

    const accessToken = await getAccessToken()
    if (!accessToken) {
      return { error: new Error('Not authenticated') }
    }

    const { ok, data } = await authFetch('/auth/user', {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify(updates),
    })

    if (!ok || data.error) {
      return { error: new Error(data.error || 'Failed to update profile') }
    }

    // Sync the profiles table (name field etc.) — this is a data operation
    // that still goes through the client-side Supabase client.
    if (updates.data?.first_name || updates.data?.last_name) {
      try {
        const profileUpdates = {};
        if (updates.data?.first_name || updates.data?.last_name) {
          profileUpdates.name = `${updates.data.first_name || ''} ${updates.data.last_name || ''}`.trim();
        }
        if (Object.keys(profileUpdates).length > 0) {
          await supabaseService.updateProfile(get().user?.id, profileUpdates);
        }
        const user = await loadProfileIntoUser(get().user);
        set({ user });
      } catch (err) {
        console.warn('Could not sync profile:', err.message);
      }
    }

    return { error: null };
  },

  updatePassword: async (newPassword) => {
    if (!supabase) {
      console.warn('Supabase not configured, mock password update');
      return { error: null };
    }

    const accessToken = await getAccessToken()
    if (!accessToken) {
      return { error: new Error('Not authenticated') }
    }

    const { ok, data } = await authFetch('/auth/update-password', {
      method: 'POST',
      body: JSON.stringify({ password: newPassword, access_token: accessToken }),
    })

    if (!ok || data.error) {
      return { error: new Error(data.error || 'Failed to update password') }
    }

    return { error: null };
  }
}));

export default useAuthStore;
