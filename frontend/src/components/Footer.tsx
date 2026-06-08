'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const FOOTER_LINKS = [
  { href: '/about', label: 'About' },
  { href: '/privacy', label: 'Privacy Policy' },
];

export default function Footer() {
  const pathname = usePathname();

  // The chat page is a full-height, keyboard-driven view that must not have a
  // footer pinned below its layout. Bail there; render everywhere else.
  if (pathname?.endsWith('/chat')) return null;

  // The home page has a fixed live-ticker pinned to the viewport bottom. Add a
  // modifier so the footer reserves space and isn't hidden behind it.
  const isHome = pathname === '/';

  return (
    <footer className={`footer${isHome ? ' footer--home' : ''}`}>
      <div className="container">
        <div className="footer-inner">
          <Link href="/" className="footer-logo">
            NIGHTS<span className="footer-logo-dot">.</span>
          </Link>

          <nav className="footer-nav">
            {FOOTER_LINKS.map((l) => (
              <Link key={l.href} href={l.href}>
                {l.label}
              </Link>
            ))}
          </nav>

          <p className="footer-tagline">
            &copy; {new Date().getFullYear()} Nights
            <span className="footer-tagline-extra"> — Find your nights.</span>
          </p>
        </div>
      </div>
    </footer>
  );
}
