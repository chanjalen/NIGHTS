'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';

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

const FEATURES = [
  { icon: '★', text: 'Rate bars from 1 to 5 stars' },
  { icon: '⚑', text: 'Check in and see who\'s out tonight' },
  { icon: '⌖', text: 'Discover the best spots in your city' },
];

export default function SignInPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

  useEffect(() => {
    if (!loading && user) {
      router.replace('/');
    }
  }, [user, loading, router]);

  if (loading) return null;

  return (
    <main className="signin-page">
      <div className="signin-card">
        <Link href="/" className="signin-brand">Nights<span className="header-logo-dot">.</span></Link>

        <h1 className="signin-heading">Discover the city's best bars</h1>
        <p className="signin-sub">
          The community-rated guide to nightlife — rate venues, check in with
          friends, and find where the night takes you.
        </p>

        <ul className="signin-features">
          {FEATURES.map((f) => (
            <li key={f.text} className="signin-feature">
              <span className="signin-feature-icon">{f.icon}</span>
              {f.text}
            </li>
          ))}
        </ul>

        <a href={`${API}/accounts/google/login/`} className="btn-google-signin">
          <GoogleLogo />
          Continue with Google
        </a>

        <p className="signin-terms">
          By continuing, you agree to our terms of service and privacy policy.
        </p>
      </div>
    </main>
  );
}
