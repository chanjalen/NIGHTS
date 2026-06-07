// Thin client for django-allauth's headless browser API. All calls use session
// cookies (credentials: 'include') and the CSRF token allauth/Django expect.
import { getCsrfToken } from '@/contexts/AuthContext';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
const HEADLESS = `${API}/api/v1/auth/browser/v1`;

export interface AuthResult {
  ok: boolean;
  status: number;
  // allauth returns { status, data?, errors?, meta? }
  body: any;
}

// Seed the csrftoken cookie (needed before any POST from an anonymous page).
async function ensureCsrf(): Promise<string> {
  let token = getCsrfToken();
  if (!token) {
    await fetch(`${API}/api/v1/accounts/csrf/`, { credentials: 'include' });
    token = getCsrfToken();
  }
  return token;
}

async function post(path: string, payload: Record<string, unknown>): Promise<AuthResult> {
  const csrf = await ensureCsrf();
  const res = await fetch(`${HEADLESS}${path}`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRFToken': csrf,
    },
    body: JSON.stringify(payload),
  });
  let body: any = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  return { ok: res.ok, status: res.status, body };
}

export function signup(email: string, password: string) {
  return post('/auth/signup', { email, password });
}

export function login(email: string, password: string) {
  return post('/auth/login', { email, password });
}

export function verifyEmail(key: string) {
  return post('/auth/email/verify', { key });
}

export function requestPasswordReset(email: string) {
  return post('/auth/password/request', { email });
}

// Password-less resend of the email-verification link (our own DRF endpoint,
// not allauth headless). Only needs the email, so it works even when the user
// has forgotten their password. Always returns a generic 200.
export async function resendVerification(email: string): Promise<AuthResult> {
  const csrf = await ensureCsrf();
  const res = await fetch(`${API}/api/v1/accounts/resend-verification/`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrf },
    body: JSON.stringify({ email }),
  });
  let body: any = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  return { ok: res.ok, status: res.status, body };
}

export function resetPassword(key: string, password: string) {
  return post('/auth/password/reset', { key, password });
}

export async function logout(): Promise<void> {
  const csrf = await ensureCsrf();
  await fetch(`${HEADLESS}/auth/session`, {
    method: 'DELETE',
    credentials: 'include',
    headers: { 'X-CSRFToken': csrf },
  });
}

// Pull a human-readable message out of an allauth error response.
export function firstError(body: any, fallback = 'Something went wrong.'): string {
  if (body?.errors?.length) return body.errors[0].message || fallback;
  return fallback;
}
