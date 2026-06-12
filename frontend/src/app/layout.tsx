import type { Metadata, Viewport } from 'next';
import { Sacramento } from 'next/font/google';
import Script from 'next/script';
import './globals.css';
import { SITE_URL } from '@/lib/site';
import FluidBackground from '@/components/FluidBackground';
import Footer from '@/components/Footer';
import { AuthProvider } from '@/contexts/AuthContext';
import { PostHogProvider } from '@/components/PostHogProvider';

// The UI face is system Times New Roman (set as --font-display in
// globals.css), so the only webfont is the hero's neon script for "Nights"
// (see docs/b.png).
const sacramento = Sacramento({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-hero-script',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: 'Nights',
  description: 'Real ratings from people who were actually there. Find where to go tonight.',
  // Link previews (iMessage, Twitter/X, Reddit, Discord) show the logo.
  openGraph: {
    siteName: 'Find Your Nights',
    type: 'website',
    images: [{ url: '/logo.png', width: 1200, height: 1200 }],
  },
  twitter: {
    card: 'summary',
    images: ['/logo.png'],
  },
  // Belt-and-suspenders with robots.ts: emit <meta name="robots" content="noindex">
  // on every non-production deployment (dev/preview), so dev never gets indexed.
  ...(process.env.VERCEL_ENV !== 'production'
    ? { robots: { index: false, follow: false } }
    : {}),
  // AdSense site verification — renders <meta name="google-adsense-account"> in
  // <head> (where the crawler looks). Production only, same as the loader script.
  ...(process.env.VERCEL_ENV === 'production'
    ? { other: { 'google-adsense-account': 'ca-pub-4278335662102500' } }
    : {}),
};

// Explicit so mobile browsers always render at device width (1:1 scale) — and so
// users can still pinch-zoom for accessibility.
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // NOTE: intentionally NOT setting interactiveWidget. The default
  // ('resizes-visual') keeps the layout viewport full-height and only shrinks the
  // *visual* viewport for the keyboard — which is exactly what the chat page's
  // visualViewport sizing relies on. Forcing 'resizes-content' double-applies the
  // shrink and leaves a dead gap between the input bar and the keyboard.
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={sacramento.variable}>
      <body>
        {/* Google AdSense loader. Production only — never load ads on dev/preview
            so test traffic can't trip AdSense's invalid-activity detection. */}
        {process.env.VERCEL_ENV === 'production' && (
          <Script
            id="adsbygoogle-init"
            strategy="afterInteractive"
            crossOrigin="anonymous"
            src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-4278335662102500"
          />
        )}
        <FluidBackground />
        <AuthProvider>
          <PostHogProvider>{children}</PostHogProvider>
          <Footer />
        </AuthProvider>
      </body>
    </html>
  );
}
