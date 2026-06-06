'use client';

import { useEffect, Suspense } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import posthog from 'posthog-js';
import { PostHogProvider as PHProvider } from 'posthog-js/react';
import { useAuth } from '@/contexts/AuthContext';

const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;

// Initialise once, client-side only. No key (e.g. local dev) = no-op.
if (typeof window !== 'undefined' && POSTHOG_KEY) {
  posthog.init(POSTHOG_KEY, {
    // Events go to our own domain (/ingest), reverse-proxied to PostHog by the
    // Next rewrites in next.config.js — beats ad-blockers. ui_host keeps links
    // to the PostHog app (e.g. from the toolbar) pointing at the real console.
    api_host: '/ingest',
    ui_host: 'https://us.posthog.com',
    // We capture pageviews manually below so App Router client navigations
    // (which don't trigger a full load) are tracked.
    capture_pageview: false,
    capture_pageleave: true,
    person_profiles: 'identified_only', // don't burn the free quota on anon-only profiles
    session_recording: {
      // Privacy: never record what users type (passwords, emails, chat drafts).
      maskAllInputs: true,
    },
  });
}

// Chat rooms contain other users' private messages, so we never record replays
// there. Matches /city/<slug>/<venueId>/chat.
function isPrivatePath(pathname: string) {
  return pathname.endsWith('/chat');
}

// Fires a $pageview on every route change. Reads search params, so it must live
// inside <Suspense> (Next requirement for useSearchParams).
function PageviewTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!POSTHOG_KEY) return;
    // Pause session recording on private (chat) routes, resume elsewhere.
    if (isPrivatePath(pathname)) {
      posthog.stopSessionRecording();
    } else {
      posthog.startSessionRecording();
    }
    let url = window.origin + pathname;
    const qs = searchParams.toString();
    if (qs) url += `?${qs}`;
    posthog.capture('$pageview', { $current_url: url });
  }, [pathname, searchParams]);

  return null;
}

// Ties events to the logged-in user so funnels/retention work across sessions.
function Identifier() {
  const { user } = useAuth();

  useEffect(() => {
    if (!POSTHOG_KEY) return;
    if (user) {
      posthog.identify(String(user.id), {
        email: user.email,
        display_name: user.display_name,
        rating_count: user.rating_count,
        checkin_count: user.checkin_count,
      });
    }
  }, [user]);

  return null;
}

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  if (!POSTHOG_KEY) return <>{children}</>;
  return (
    <PHProvider client={posthog}>
      <Suspense fallback={null}>
        <PageviewTracker />
      </Suspense>
      <Identifier />
      {children}
    </PHProvider>
  );
}
