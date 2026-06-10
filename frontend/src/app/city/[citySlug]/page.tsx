import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import Header from '@/components/Header';
import VenueGrid from '@/components/VenueGrid';
import { getCityBySlug, getCityStats, getVenuesPage } from '@/lib/api';

interface CityPageProps {
  params: { citySlug: string };
}

export async function generateMetadata({ params }: CityPageProps) {
  const city = await getCityBySlug(params.citySlug).catch(() => null);
  const name = city?.name ?? params.citySlug;
  return { title: `${name} Nightlife — Nights.` };
}

export default async function CityPage({ params }: CityPageProps) {
  const { citySlug } = params;
  const city = await getCityBySlug(citySlug).catch(() => null);

  if (!city) {
    const display = citySlug
      .split('-')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
    return (
      <>
        <Header />
        <main>
          <div className="container">
            <div style={{ paddingTop: '48px' }}>
              <Link href="/popular-cities" className="back-button">
                <ArrowLeft size={16} />
                All Cities
              </Link>
              <div className="empty-state">
                <p className="empty-state-title">City not found.</p>
                <p>We don&apos;t have <strong>{display}</strong> in our database yet.</p>
              </div>
            </div>
          </div>
        </main>
      </>
    );
  }

  const [stats, firstPage] = await Promise.all([
    getCityStats(citySlug).catch(() => ({ venue_count: 0, avg_rating: null, active_checkin_count: 0, neighborhoods: [] })),
    getVenuesPage(citySlug, 1).catch(() => ({ venues: [], count: 0, hasNext: false })),
  ]);

  return (
    <>
      <Header />
      <main>
        <div className="container">
          <div style={{ paddingTop: '48px', paddingBottom: '80px' }}>
            <Link href="/popular-cities" className="back-button">
              <ArrowLeft size={16} />
              All Cities
            </Link>

            <VenueGrid
              cityName={city.name}
              stats={stats}
              initialVenues={firstPage.venues ?? []}
              totalCount={firstPage.count ?? 0}
              citySlug={citySlug}
            />
          </div>
        </div>
      </main>
    </>
  );
}
