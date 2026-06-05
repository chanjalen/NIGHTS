import Header from '@/components/Header';
import DecorativeBorder from '@/components/DecorativeBorder';

export const metadata = {
  title: 'About — Nights',
};

export default function AboutPage() {
  return (
    <>
      <Header />
      <main>
        <div className="container">
          <div className="page-title-section">
            <h1 className="section-title">
              <span>About</span>
              <span className="accent-line">Nights</span>
            </h1>
            <DecorativeBorder />
          </div>
          <div style={{ maxWidth: '640px', paddingBottom: '80px' }}>
            <p style={{ color: 'var(--text-dim)', fontSize: '16px', lineHeight: '1.75', marginBottom: '20px' }}>
              Nights is a city-first bar and nightlife discovery platform — Search the city you want to explore, then find a venue that fits your vibe.
            </p>
            <p style={{ color: 'var(--text-dim)', fontSize: '16px', lineHeight: '1.75', marginBottom: '20px' }}>
              Every rating on Nights is tied to a real person. Verified check-ins come from users that went to THAT venue. Check-in live and chat with everyone else who's also there with you!
            </p>
            <p style={{ color: 'var(--text-dim)', fontSize: '16px', lineHeight: '1.75' }}>
              Find your nights.
            </p>
          </div>
        </div>
      </main>
    </>
  );
}
