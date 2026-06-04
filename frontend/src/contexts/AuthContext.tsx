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
  const match = document.cookie.match(/csrftoken=([^;]+)/);
  return match ? match[1] : '';
}

export function login() {
  window.location.href = '/signin';
}

export function logout() {
  const form = document.createElement('form');
  form.method = 'POST';
  form.action = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/accounts/logout/`;
  const csrf = document.createElement('input');
  csrf.type = 'hidden';
  csrf.name = 'csrfmiddlewaretoken';
  csrf.value = getCsrfToken();
  form.appendChild(csrf);
  document.body.appendChild(form);
  form.submit();
}
