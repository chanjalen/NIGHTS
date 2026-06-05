import type { Metadata } from 'next';
import { Bricolage_Grotesque } from 'next/font/google';
import './globals.css';
import FluidBackground from '@/components/FluidBackground';
import { AuthProvider } from '@/contexts/AuthContext';

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
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
