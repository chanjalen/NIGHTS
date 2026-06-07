import Link from 'next/link';
import { ArrowLeft, MapPin, Users } from 'lucide-react';
import Header from '@/components/Header';
import StarRating from '@/components/StarRating';
import PriceLevel from '@/components/PriceLevel';
import VenueActions from '@/components/VenueActions';
import CleanUrl from '@/components/CleanUrl';
import RatingsList from '@/components/RatingsList';
import { getVenue, getRatings } from '@/lib/api';
import { Rating } from '@/types';

interface VenueDetailPageProps {
  params: { citySlug: string; venueId: string };
  searchParams?: { from?: string };
}

export async function generateMetadata({ params }: VenueDetailPageProps) {
  try {
    const venue = await getVenue(params.venueId);
    return { title: `${venue.name} — NITE` };
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
