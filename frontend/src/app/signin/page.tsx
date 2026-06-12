'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth, consumePostLoginNext } from '@/contexts/AuthContext';
import { login, signup, resendVerification, firstError } from '@/lib/auth';

function GoogleLogo() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
      <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
    </svg>
  );
}

type Mode = 'login' | 'signup';

export default function SignInPage() {
  const { user, loading, refetch } = useAuth();
  const router = useRouter();
  const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  // True once a login/signup attempt reveals the account exists but isn't
  // email-verified — unlocks the "resend verification link" action.
  const [pendingVerify, setPendingVerify] = useState(false);

  // Single post-auth exit point: every flow (email login, Google OAuth via
  // the backend's LOGIN_REDIRECT_URL) lands here once authenticated, then
  // bounces to wherever the user was before signing in.
  useEffect(() => {
    if (!loading && user) {
      router.replace(consumePostLoginNext());
    }
  }, [user, loading, router]);

  if (loading) return null;

  function switchMode(next: Mode) {
    setMode(next);
    setError('');
    setNotice('');
    setConfirm('');
    setPendingVerify(false);
  }

  // Password-less resend — needs only the email, so it works even if the user
  // has forgotten their password. Server caps sends to 1 per 3 min per account.
  async function handleResend() {
    if (!email) {
      setError('Enter your email above, then resend.');
      return;
    }
    setError('');
    setBusy(true);
    try {
      await resendVerification(email);
      setNotice(
        `If ${email} still needs verifying, a new link is on its way — check your ` +
        `inbox and spam. Links expire in 30 minutes.`
      );
    } catch {
      setError('Could not resend just now — please try again in a moment.');
    } finally {
      setBusy(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setNotice('');

    if (mode === 'signup' && password !== confirm) {
      setError('Passwords do not match.');
      return;
    }

    setBusy(true);
    try {
      const res = mode === 'login'
        ? await login(email, password)
        : await signup(email, password);

      // Logged in (verified user logging in). The auth-redirect effect above
      // navigates once refetch() populates the user, so it stays the single
      // consumer of the stored post-login destination.
      if (res.ok && res.body?.meta?.is_authenticated) {
        refetch();
        return;
      }

      // Accepted but a verification step is pending (401 with a flow).
      if (res.status === 401) {
        setPendingVerify(true);
        setNotice(
          mode === 'signup'
            ? `Almost there — we sent a verification link to ${email}. Click it, then log in.`
            : 'Please verify your email first. Check your inbox for the link we sent.'
        );
        return;
      }

      // Email already registered (incl. via Google) — point them to logging in.
      const taken = res.body?.errors?.some((e: any) => e.code === 'email_taken');
      if (taken) {
        setError('That email is already in use. Try logging in instead.');
        return;
      }

      setError(firstError(res.body, 'Could not complete that — please try again.'));
    } catch {
      setError('Network error — please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="signin-page">
      <div className="signin-card">
        <Link href="/" className="signin-brand">Nights<span className="header-logo-dot">.</span></Link>

        <h1 className="signin-heading">Discover the city's best bars</h1>
        <p className="signin-sub">
          The community-rated guide to nightlife — rate venues, check in with
          friends, and find where the night takes you.
        </p>

        <a href={`${API}/accounts/google/login/`} className="btn-google-signin">
          <GoogleLogo />
          Continue with Google
        </a>

        <div className="auth-divider"><span>or</span></div>

        <div className="auth-tabs">
          <button
            type="button"
            className={`auth-tab ${mode === 'login' ? 'is-active' : ''}`}
            onClick={() => switchMode('login')}
          >
            Log in
          </button>
          <button
            type="button"
            className={`auth-tab ${mode === 'signup' ? 'is-active' : ''}`}
            onClick={() => switchMode('signup')}
          >
            Sign up
          </button>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          <input
            className="auth-input"
            type="email"
            placeholder="Email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            className="auth-input"
            type="password"
            placeholder="Password"
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          {mode === 'signup' && (
            <input
              className="auth-input"
              type="password"
              placeholder="Confirm password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
            />
          )}

          {error && <p className="auth-error">{error}</p>}
          {notice && <p className="auth-notice">{notice}</p>}

          {pendingVerify && (
            <button
              type="button"
              className="auth-link"
              onClick={handleResend}
              disabled={busy}
            >
              Resend verification email
            </button>
          )}

          <button type="submit" className="auth-submit" disabled={busy}>
            {busy ? 'Please wait…' : mode === 'login' ? 'Log in' : 'Create account'}
          </button>
        </form>

        {mode === 'login' && (
          <Link href="/forgot-password" className="auth-link">Forgot password?</Link>
        )}

        <p className="signin-terms">
          By continuing, you agree to our terms of service and privacy policy.
        </p>
      </div>
    </main>
  );
}
