'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth, login } from '@/contexts/AuthContext';

export default function Header() {
  const pathname = usePathname();
  const { user, loading } = useAuth();

  return (
    <header className="header">
      <div className="container">
        <div className="header-inner">
          <Link href="/" className="header-logo">
            NIGHTS<span className="header-logo-dot">.</span>
          </Link>
          <nav>
            <ul className="header-nav">
              <li>
                <Link href="/" className={pathname === '/' ? 'active' : ''}>
                  Home
                </Link>
              </li>
              <li>
                <Link
                  href="/popular-cities"
                  className={pathname === '/popular-cities' ? 'active' : ''}
                >
                  Popular Cities
                </Link>
              </li>
              <li>
                <Link
                  href="/about"
                  className={pathname === '/about' ? 'active' : ''}
                >
                  About
                </Link>
              </li>

              {!loading && (
                <li>
                  {user ? (
                    <Link
                      href="/profile"
                      className="header-profile-link"
                      aria-label="Your profile"
                    >
                      <div className="header-avatar">
                        {(user.display_name || user.email).charAt(0)}
                      </div>
                    </Link>
                  ) : (
                    <button className="header-signin" onClick={login}>
                      Sign In
                    </button>
                  )}
                </li>
              )}
            </ul>
          </nav>
        </div>
      </div>
    </header>
  );
}
