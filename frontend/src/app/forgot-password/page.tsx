'use client';

import { useState } from 'react';
import Link from 'next/link';
import { requestPasswordReset } from '@/lib/auth';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    // allauth intentionally returns the same response whether or not the email
    // exists (account-enumeration protection), so we always show "sent".
    await requestPasswordReset(email).catch(() => {});
    setBusy(false);
    setSent(true);
  }

  return (
    <main className="signin-page">
      <div className="signin-card">
        <Link href="/" className="signin-brand">Nights<span className="header-logo-dot">.</span></Link>

        {sent ? (
          <>
            <h1 className="signin-heading">Check your email</h1>
            <p className="signin-sub">
              If an account exists for {email}, we've sent a link to reset your
              password.
            </p>
            <Link href="/signin" className="auth-submit auth-submit-link">Back to login</Link>
          </>
        ) : (
          <>
            <h1 className="signin-heading">Reset your password</h1>
            <p className="signin-sub">
              Enter your email and we'll send you a link to set a new password.
            </p>
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
              <button type="submit" className="auth-submit" disabled={busy}>
                {busy ? 'Sending…' : 'Send reset link'}
              </button>
            </form>
            <Link href="/signin" className="auth-link">Back to login</Link>
          </>
        )}
      </div>
    </main>
  );
}
