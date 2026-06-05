'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { verifyEmail } from '@/lib/auth';

type Status = 'verifying' | 'success' | 'error';

export default function VerifyEmailPage({ params }: { params: { key: string } }) {
  const { refetch } = useAuth();
  const router = useRouter();
  const [status, setStatus] = useState<Status>('verifying');
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return; // guard React strict-mode double-invoke
    ran.current = true;

    verifyEmail(decodeURIComponent(params.key)).then((res) => {
      if (res.ok || res.status === 401) {
        // 200 = verified (and often logged in); 401 = verified, needs login.
        setStatus('success');
        if (res.body?.meta?.is_authenticated) {
          refetch();
          setTimeout(() => router.replace('/'), 1200);
        }
      } else {
        setStatus('error');
      }
    }).catch(() => setStatus('error'));
  }, [params.key, refetch, router]);

  return (
    <main className="signin-page">
      <div className="signin-card">
        <Link href="/" className="signin-brand">Nights<span className="header-logo-dot">.</span></Link>

        {status === 'verifying' && (
          <>
            <h1 className="signin-heading">Verifying…</h1>
            <p className="signin-sub">Hang tight while we confirm your email.</p>
          </>
        )}

        {status === 'success' && (
          <>
            <h1 className="signin-heading">Email verified</h1>
            <p className="signin-sub">You're all set. Log in to start exploring the night.</p>
            <Link href="/signin" className="auth-submit auth-submit-link">Go to login</Link>
          </>
        )}

        {status === 'error' && (
          <>
            <h1 className="signin-heading">Link expired</h1>
            <p className="signin-sub">
              This verification link is invalid or has expired. Try logging in to
              request a new one.
            </p>
            <Link href="/signin" className="auth-submit auth-submit-link">Back to login</Link>
          </>
        )}
      </div>
    </main>
  );
}
