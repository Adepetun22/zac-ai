import { supabase } from '../config/supabase';

const normalizeBase = (url) => (url || '').replace(/\/$/, '').replace(/\/api$/i, '');

export function backendPath(path) {
  const base = normalizeBase(import.meta.env.VITE_BACKEND_URL);
  return base ? `${base}/api${path}` : `/api${path}`;
}

export async function getAccessToken() {
  if (!supabase) return null;
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token || null;
}

export async function authHeaders(extra = {}) {
  const token = await getAccessToken();
  return {
    ...extra,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export async function authFetch(path, options = {}) {
  const headers = await authHeaders(options.headers || {});
  return fetch(backendPath(path), { ...options, headers });
}