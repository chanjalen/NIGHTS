import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import Header from '@/components/Header';

export default function NotFound() {
  return (
    <>
      <Header />
      <main>
        <div className="container">
          <div style={{ paddingTop: '48px' }}>
            <Link href="/" className="back-button">
              <ArrowLeft size={16} />
              Home
            </Link>
            <div className="empty-state">
              <p className="empty-state-title">Page not found.</p>
              <p>This page doesn&apos;t exist or may have been removed.</p>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
