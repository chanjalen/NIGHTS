import type { Metadata } from 'next';
import { Syne, Monoton, Sacramento, Alfa_Slab_One, Zilla_Slab } from 'next/font/google';
import './globals.css';
import FluidBackground from '@/components/FluidBackground';
import { AuthProvider } from '@/contexts/AuthContext';

// Clean sans, kept for the live ticker (the one element that doesn't use the retro script).
const syne = Syne({
  subsets: ['latin'],
  weight: ['700', '800'],
  variable: '--font-sans',
  display: 'swap',
});

// Neon-tube display fonts, used only for the decorative wall signs.
const monoton = Monoton({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-neon',
  display: 'swap',
});

const sacramento = Sacramento({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-neon-script',
  display: 'swap',
});

// Chunky beer-label slab — headlines, names, all display text (dive-bar feel).
const alfaSlab = Alfa_Slab_One({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-display',
  display: 'swap',
});

// Retro slab serif for body, labels, and inputs — readable, characterful, not sans.
const zillaSlab = Zilla_Slab({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-body',
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
    <html
      lang="en"
      className={`${syne.variable} ${monoton.variable} ${sacramento.variable} ${alfaSlab.variable} ${zillaSlab.variable}`}
    >
      <body>
        <FluidBackground />
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
