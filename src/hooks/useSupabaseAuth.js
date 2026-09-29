import { useEffect } from 'react';
import useAuthStore from '../store/authStore';

/**
 * Lightweight auth hook that mirrors the previous Supabase-based API.
 *
 * All credential operations are now proxied through the backend via the auth
 * store — this hook delegates to it so callers never hit the Supabase client
 * directly for auth.
 *
 * @deprecated Prefer importing `useAuthStore` directly.
 */
export const useSupabaseAuth = () => {
  const { user, isAuthenticated, isLoading, signIn, signUp, signOut, initAuth } = useAuthStore();

  useEffect(() => {
    // Prime the auth store on mount (reads persisted session from localStorage).
    initAuth();
  }, [initAuth]);

  return {
    session: isAuthenticated ? { user } : null,
    user,
    loading: isLoading,
    signUp: (email, password, name) => signUp(email, password, name),
    signIn: (email, password) => signIn(email, password),
    signOut,
    isAuthenticated,
  };
};
