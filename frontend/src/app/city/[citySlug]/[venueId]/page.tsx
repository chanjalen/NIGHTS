import Link from 'next/link';
import { ArrowLeft, MapPin, Users } from 'lucide-react';
import Header from '@/components/Header';
import StarRating from '@/components/StarRating';
import PriceLevel from '@/components/PriceLevel';
import VenueActions from '@/components/VenueActions';
import CleanUrl from '@/components/CleanUrl';
import RatingsList from '@/components/RatingsList';
import { getVenue, getRatings } from '@/lib/api';
import { SITE_URL } from '@/lib/site';
import { Rating } from '@/types';

interface VenueDetailPageProps {
  params: { citySlug: string; venueId: string };
  searchParams?: { from?: string };
}

export async function generateMetadata({ params }: VenueDetailPageProps) {
  try {
    const venue = await getVenue(params.venueId);
    const rating = parseFloat(venue.overall_rating);
    const ratingPart = !isNaN(rating) && venue.total_ratings > 0
      ? `Rated ${rating.toFixed(1)}/5 from ${venue.total_ratings} ${venue.total_ratings === 1 ? 'rating' : 'ratings'}.`
      : 'See ratings, vibe, and who’s there tonight.';
    return {
      title: `${venue.name} — NITE`,
      description: `${venue.name}${venue.neighborhood ? ` in ${venue.neighborhood}` : ''}, ${venue.city_name}. ${ratingPart}`,
    };
  } catch {
    return { title: 'Venue — NITE' };
  }
}


export default async function VenueDetailPage({ params, searchParams }: VenueDetailPageProps) {
  const { citySlug, venueId } = params;
  const fromProfile = searchParams?.from === 'profile';

  let venue = null;
  let ratings: Rating[] = [];

  try {
    venue = await getVenue(venueId);
  } catch {
    // venue stays null → shows not-found
  }

  if (venue) {
    try {
      ratings = await getRatings(venueId);
    } catch {
      // ratings stays [] — venue still renders
    }
  }

  if (!venue) {
    return (
      <>
        {fromProfile && <CleanUrl params={['from']} />}
        <Header />
        <main>
          <div className="container">
            <div style={{ paddingTop: '48px' }}>
              {fromProfile ? (
                <Link href="/profile" className="back-button">
                  <ArrowLeft size={16} />
                  Profile
                </Link>
              ) : (
                <Link href={`/city/${citySlug}`} className="back-button">
                  <ArrowLeft size={16} />
                  Back
                </Link>
              )}
              <div className="empty-state">
                <p className="empty-state-title">Venue not found.</p>
                <p>This venue may have been removed or the link is invalid.</p>
              </div>
            </div>
          </div>
        </main>
      </>
    );
  }

  const rating = parseFloat(venue.overall_rating);
  const displayRating = isNaN(rating) ? null : rating.toFixed(1);

  // BarOrPub structured data → rich results (star snippets) in search.
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BarOrPub',
    name: venue.name,
    url: `${SITE_URL}/city/${citySlug}/${venueId}`,
    address: {
      '@type': 'PostalAddress',
      streetAddress: venue.address,
      addressLocality: venue.city_name,
    },
    geo: {
      '@type': 'GeoCoordinates',
      latitude: venue.lat,
      longitude: venue.lng,
    },
    ...(venue.photo_url ? { image: venue.photo_url } : {}),
    ...(venue.price_level ? { priceRange: '$'.repeat(venue.price_level) } : {}),
    ...(displayRating && venue.total_ratings > 0
      ? {
          aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: displayRating,
            ratingCount: venue.total_ratings,
            bestRating: 5,
            worstRating: 1,
          },
        }
      : {}),
  };

  return (
    <>
      <script
        type="application/ld+json"
        // Escape "<" so a venue name can't break out of the script tag.
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c'),
        }}
      />
      {fromProfile && <CleanUrl params={['from']} />}
      <Header />
      <main>
        <div className="container">
          <div style={{ paddingTop: '48px' }}>
            {fromProfile ? (
              <Link href="/profile" className="back-button">
                <ArrowLeft size={16} />
                Profile
              </Link>
            ) : (
              <Link href={`/city/${citySlug}`} className="back-button">
                <ArrowLeft size={16} />
                {venue.city_name}
              </Link>
            )}

            <div className="venue-header">
              <h1 className="venue-name">{venue.name}</h1>

              {/* Location row */}
              {(venue.neighborhood || venue.address) && (
                <div className="venue-meta-row">
                  <MapPin size={16} />
                  <span>
                    {[venue.neighborhood, venue.address]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </div>
              )}

              {/* Rating row */}
              <div className="venue-rating-row">
                {displayRating ? (
                  <>
                    <StarRating value={rating} size={22} />
                    <div>
                      <span className="venue-rating-big">{displayRating}</span>
                      <span
                        className="venue-rating-sub"
                        style={{ display: 'block', marginTop: '2px' }}
                      >
                        {venue.total_ratings}{' '}
                        {venue.total_ratings === 1 ? 'rating' : 'ratings'}
                      </span>
                    </div>
                  </>
                ) : (
                  <span className="venue-rating-sub">No ratings yet</span>
                )}

                {venue.active_checkin_count > 0 && (
                  <span className="checkin-pill">
                    <Users size={14} />
                    {venue.active_checkin_count} here now
                  </span>
                )}
              </div>

              {/* Price level */}
              {venue.price_level && (
                <div style={{ marginBottom: '20px' }}>
                  <PriceLevel level={venue.price_level} />
                </div>
              )}

              {/* Tags */}
              {(venue.music_tags.length > 0 || venue.crowd_tags.length > 0) && (
                <div className="tags-row">
                  {venue.music_tags.map((tag) => (
                    <span key={tag} className="badge badge-accent">
                      {tag}
                    </span>
                  ))}
                  {venue.crowd_tags.map((tag) => (
                    <span key={tag} className="badge">
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <VenueActions venueId={venueId} citySlug={citySlug} />

            {/* Ratings Section */}
            <RatingsList ratings={ratings} />
          </div>
        </div>
      </main>
    </>
  );
}
