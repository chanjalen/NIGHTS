import Link from 'next/link';
import { notFound } from 'next/navigation';
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

  // Real 404 (via the app not-found boundary) so unknown city URLs don't get
  // indexed as soft 404s.
  if (!city) notFound();

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
