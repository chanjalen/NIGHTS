'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';

export interface AuthUser {
  id: number;
  email: string;
  display_name: string;
  avatar_url: string | null;
  rating_count: number;
  checkin_count: number;
}

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  refetch: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  refetch: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(() => {
    setLoading(true);
    fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/v1/accounts/me/`, {
      credentials: 'include',
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setUser(data))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return (
    <AuthContext.Provider value={{ user, loading, refetch }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

export function getCsrfToken(): string {
  if (typeof document === 'undefined') return '';
  // Cookie name is env-driven so dev (csrftoken_dev) and prod (csrftoken) don't
  // collide under the shared .findyournights.com cookie domain.
  const name = process.env.NEXT_PUBLIC_CSRF_COOKIE_NAME || 'csrftoken';
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]+)`));
  return match ? match[1] : '';
}

// Where to send the user after they finish signing in. Stored in
// sessionStorage so it survives the full-page Google OAuth round trip; the
// /signin page is the single consumer (it's also the backend's
// LOGIN_REDIRECT_URL, so every auth flow lands there before bouncing back).
const NEXT_KEY = 'postLoginNext';

export function login(next?: string) {
  const target = next ?? window.location.pathname + window.location.search;
  try {
    sessionStorage.setItem(NEXT_KEY, target);
  } catch {}
  window.location.href = '/signin';
}

export function consumePostLoginNext(): string {
  try {
    const next = sessionStorage.getItem(NEXT_KEY);
    sessionStorage.removeItem(NEXT_KEY);
    // Internal paths only — never a full URL, so it can't open-redirect.
    // Must start with a single "/": browsers treat "//host" AND "/\host" as
    // protocol-relative URLs (backslashes normalize to slashes).
    if (next && /^\/(?![/\\])/.test(next)) return next;
  } catch {}
  return '/';
}

export async function logout() {
  // Use allauth's headless session-delete via a credentialed fetch rather than a
  // top-level form POST. A form POST to the API subdomain after the redirect-heavy
  // signup flow is sent with `Origin: null`, which Django's CSRF Origin check
  // rejects (403). A fetch always carries the page's real origin.
  const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
  let csrf = getCsrfToken();
  if (!csrf) {
    await fetch(`${API}/api/v1/accounts/csrf/`, { credentials: 'include' });
    csrf = getCsrfToken();
  }
  await fetch(`${API}/api/v1/auth/browser/v1/auth/session`, {
    method: 'DELETE',
    credentials: 'include',
    headers: { 'X-CSRFToken': csrf },
  }).catch(() => {});
  window.location.href = '/';
}
