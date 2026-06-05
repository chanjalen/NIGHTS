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
                <span className="accent-line">Night</span>
              </h1>

              <div className="hero-pitch">
                <p className="hero-desc">
                  New city, no one to ask. Here&apos;s where the night
                  actually is.
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
