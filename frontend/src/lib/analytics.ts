import posthog from 'posthog-js';

// Safe wrapper: no-ops when PostHog isn't configured (local dev / no key).
// Use for the NITE-specific funnel steps, e.g.:
//   track('search_performed', { query, result_count })   // result_count: 0 = demand signal
//   track('venue_viewed', { venue_id, city_slug })
//   track('checkin_created', { venue_id })
//   track('rating_submitted', { venue_id, stars })
//   track('chat_message_sent', { venue_id })
//   track('venue_saved', { venue_id })
export function track(event: string, props?: Record<string, unknown>) {
  if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return;
  posthog.capture(event, props);
}
