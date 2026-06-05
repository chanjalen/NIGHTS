'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { resetPassword, firstError } from '@/lib/auth';

export default function ResetPasswordPage({ params }: { params: { key: string } }) {
  const { refetch } = useAuth();
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setBusy(true);
    try {
      const res = await resetPassword(decodeURIComponent(params.key), password);
      if (res.ok || res.status === 401) {
        setDone(true);
        if (res.body?.meta?.is_authenticated) {
          refetch();
          setTimeout(() => router.replace('/'), 1200);
        }
      } else {
        setError(firstError(res.body, 'This reset link is invalid or has expired.'));
      }
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

        {done ? (
          <>
            <h1 className="signin-heading">Password updated</h1>
            <p className="signin-sub">Your password has been changed. You can now log in.</p>
            <Link href="/signin" className="auth-submit auth-submit-link">Go to login</Link>
          </>
        ) : (
          <>
            <h1 className="signin-heading">Set a new password</h1>
            <p className="signin-sub">Choose a strong password you don't use elsewhere.</p>
            <form className="auth-form" onSubmit={handleSubmit}>
              <input
                className="auth-input"
                type="password"
                placeholder="New password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <input
                className="auth-input"
                type="password"
                placeholder="Confirm new password"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
              />
              {error && <p className="auth-error">{error}</p>}
              <button type="submit" className="auth-submit" disabled={busy}>
                {busy ? 'Saving…' : 'Update password'}
              </button>
            </form>
          </>
        )}
      </div>
    </main>
  );
}
