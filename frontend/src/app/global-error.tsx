'use client';

// Last-resort boundary for errors thrown in the root layout itself. It replaces
// the whole document, so it must render its own <html>/<body> and pull in global
// styles (the root layout — and its font/providers — is gone at this point).
import { useEffect } from 'react';
import './globals.css';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body>
        <main className="signin-page">
          <div className="signin-card">
            <span className="signin-brand">Nights<span className="header-logo-dot">.</span></span>
            <h1 className="signin-heading">Something went wrong</h1>
            <p className="signin-sub">
              An unexpected error occurred. Please try again.
            </p>
            <button type="button" className="auth-submit" onClick={() => reset()}>
              Try again
            </button>
            <a href="/" className="auth-submit auth-submit-link">Go home</a>
          </div>
        </main>
      </body>
    </html>
  );
}
