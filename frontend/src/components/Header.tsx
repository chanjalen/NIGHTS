'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Menu, X } from 'lucide-react';
import { useAuth, login } from '@/contexts/AuthContext';

const NAV_LINKS = [
  { href: '/', label: 'Home' },
  { href: '/popular-cities', label: 'Popular Cities' },
  { href: '/about', label: 'About' },
];

export default function Header() {
  const pathname = usePathname();
  const { user, loading } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  // Close the mobile menu whenever the route changes.
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  // Close the menu on a tap outside it. The effect attaches after the opening
  // click has finished bubbling, so it doesn't immediately re-close.
  useEffect(() => {
    if (!menuOpen) return;
    const close = () => setMenuOpen(false);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [menuOpen]);

  const authItem = !loading && (
    user ? (
      <Link href="/profile" className="header-profile-link" aria-label="Your profile">
        <div className="header-avatar">
          {(user.display_name || user.email).charAt(0)}
        </div>
      </Link>
    ) : (
      <button className="header-signin" onClick={login}>
        Sign In
      </button>
    )
  );

  return (
    <header className="header">
      <div className="container">
        <div className="header-inner">
          <Link href="/" className="header-logo">
            NIGHTS<span className="header-logo-dot">.</span>
          </Link>

          {/* Desktop nav */}
          <nav className="header-nav-wrap">
            <ul className="header-nav">
              {NAV_LINKS.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className={pathname === l.href ? 'active' : ''}>
                    {l.label}
                  </Link>
                </li>
              ))}
              <li>{authItem}</li>
            </ul>
          </nav>

          {/* Mobile hamburger */}
          <button
            className="header-menu-btn"
            onClick={() => setMenuOpen((o) => !o)}
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
          >
            {menuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {menuOpen && (
        <nav className="header-mobile-menu">
          {NAV_LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`header-mobile-link${pathname === l.href ? ' active' : ''}`}
            >
              {l.label}
            </Link>
          ))}
          <div className="header-mobile-divider" />
          {!loading &&
            (user ? (
              <Link href="/profile" className="header-mobile-link">
                Profile
              </Link>
            ) : (
              <button
                className="header-mobile-signin"
                onClick={() => {
                  setMenuOpen(false);
                  login();
                }}
              >
                Sign In
              </button>
            ))}
        </nav>
      )}
    </header>
  );
}
