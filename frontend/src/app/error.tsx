'use client';

// Route-level error boundary. Catches render/runtime errors thrown anywhere in
// the page tree (below the root layout) so users get a branded fallback instead
// of a blank screen or a raw stack trace. `reset` re-renders the segment.
import { useEffect } from 'react';
import Link from 'next/link';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surface to the browser console (and any attached error tracker) for
    // debugging; the user never sees the underlying message.
    console.error(error);
  }, [error]);

  return (
    <main className="signin-page">
      <div className="signin-card">
        <Link href="/" className="signin-brand">Nights<span className="header-logo-dot">.</span></Link>
        <h1 className="signin-heading">Something went wrong</h1>
        <p className="signin-sub">
          An unexpected error occurred. Try again, or head back home.
        </p>
        <button type="button" className="auth-submit" onClick={() => reset()}>
          Try again
        </button>
        <Link href="/" className="auth-submit auth-submit-link">Go home</Link>
      </div>
    </main>
  );
}
