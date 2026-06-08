import type { Metadata, Viewport } from 'next';
import { Bricolage_Grotesque } from 'next/font/google';
import './globals.css';
import FluidBackground from '@/components/FluidBackground';
import Footer from '@/components/Footer';
import { AuthProvider } from '@/contexts/AuthContext';
import { PostHogProvider } from '@/components/PostHogProvider';

// Single type family across the whole UI. Variable font (weights 200–800), so
// we omit `weight` to load the full axis. Exposed as --font-display; globals.css
// maps the other legacy font variables to it.
const bricolage = Bricolage_Grotesque({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Nights',
  description: 'Real ratings from people who were actually there. Find where to go tonight.',
  // Belt-and-suspenders with robots.ts: emit <meta name="robots" content="noindex">
  // on every non-production deployment (dev/preview), so dev never gets indexed.
  ...(process.env.VERCEL_ENV !== 'production'
    ? { robots: { index: false, follow: false } }
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
    <html lang="en" className={bricolage.variable}>
      <body>
        <FluidBackground />
        <AuthProvider>
          <PostHogProvider>{children}</PostHogProvider>
          <Footer />
        </AuthProvider>
      </body>
    </html>
  );
}
