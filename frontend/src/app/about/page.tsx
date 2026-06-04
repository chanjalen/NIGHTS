import Header from '@/components/Header';
import DecorativeBorder from '@/components/DecorativeBorder';

export const metadata = {
  title: 'About — NITE',
};

export default function AboutPage() {
  return (
    <>
      <Header />
      <main>
        <div className="container">
          <div className="page-title-section">
            <h1 className="section-title">About Nights</h1>
            <DecorativeBorder />
          </div>
          <div style={{ maxWidth: '640px', paddingBottom: '80px' }}>
            <p style={{ color: 'var(--text-dim)', fontSize: '16px', lineHeight: '1.75', marginBottom: '20px' }}>
              NITE is a city-first bar and nightlife discovery platform — think
              Rate My Professors, but for the places you actually want to spend
              your nights.
            </p>
            <p style={{ color: 'var(--text-dim)', fontSize: '16px', lineHeight: '1.75', marginBottom: '20px' }}>
              Every rating on NITE is tied to a real visit. We verify check-ins
              so you know exactly which reviews come from people who were
              actually there.
            </p>
            <p style={{ color: 'var(--text-dim)', fontSize: '16px', lineHeight: '1.75' }}>
              Find your night.
            </p>
          </div>
        </div>
      </main>
    </>
  );
}
