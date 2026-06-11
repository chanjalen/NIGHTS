import Link from 'next/link';
import Header from '@/components/Header';
import CitySearchForm from '@/components/CitySearchForm';
import LiveTicker from '@/components/LiveTicker';

export default function HomePage() {
  return (
    <>
      <Header />
      <main>
        <section className="hero">
          <div className="container">
            <div className="hero-inner">
              <h1 className="hero-tagline">
                <span>Find Your</span>
                <span className="accent-line">
                  Nights
                  {/* Neon-tube underline swoosh, flickers with the word. */}
                  <svg
                    className="neon-swoosh"
                    viewBox="0 0 320 32"
                    aria-hidden="true"
                  >
                    {/* Same tube treatment as the word: light core, red glow. */}
                    <path
                      d="M8 9 C 85 20, 240 19, 312 6"
                      fill="none"
                      stroke="#ff8e80"
                      strokeWidth="3"
                      strokeLinecap="round"
                    />
                  </svg>
                </span>
              </h1>

              <div className="hero-pitch">
                <p className="hero-desc">
                  <span>New city, no one to ask.</span>
                  <span>Here&apos;s where the night actually is.</span>
                </p>
                <CitySearchForm />
                <div className="hero-cta-row">
                  <Link href="/popular-cities" className="btn-ghost">
                    Browse all cities
                  </Link>
                </div>
              </div>
            </div>
          </div>

          <div className="hero-ticker">
            <LiveTicker />
          </div>
        </section>
      </main>
    </>
  );
}
