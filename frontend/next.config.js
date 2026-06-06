/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Reverse-proxy PostHog through our own domain (/ingest) so ad-blockers, which
  // block *.i.posthog.com directly, can't drop analytics events. The browser only
  // ever talks to findyournights.com; Vercel forwards to PostHog server-side.
  skipTrailingSlashRedirect: true, // PostHog's ingestion API relies on trailing slashes
  async rewrites() {
    return [
      {
        source: '/ingest/static/:path*',
        destination: 'https://us-assets.i.posthog.com/static/:path*',
      },
      {
        source: '/ingest/:path*',
        destination: 'https://us.i.posthog.com/:path*',
      },
    ];
  },
  async headers() {
    // The email-verification and password-reset pages carry a sensitive key in
    // the URL path. Without this, any cross-origin request from those pages
    // could leak the full URL (incl. the key) via the Referer header.
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
      {
        source: '/verify-email/:path*',
        headers: [{ key: 'Referrer-Policy', value: 'no-referrer' }],
      },
      {
        source: '/reset-password/:path*',
        headers: [{ key: 'Referrer-Policy', value: 'no-referrer' }],
      },
    ];
  },
};

module.exports = nextConfig;
