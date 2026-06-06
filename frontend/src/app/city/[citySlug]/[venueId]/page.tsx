import Link from 'next/link';
import { ArrowLeft, MapPin, Users } from 'lucide-react';
import Header from '@/components/Header';
import DecorativeBorder from '@/components/DecorativeBorder';
import StarRating from '@/components/StarRating';
import PriceLevel from '@/components/PriceLevel';
import VenueActions from '@/components/VenueActions';
import CleanUrl from '@/components/CleanUrl';
import RatingMediaGallery from '@/components/RatingMediaGallery';
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

function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

function formatDayVisited(day: string): string {
  return `Day Visited: ${day.charAt(0) + day.slice(1).toLowerCase()}`;
}

function RatingCard({ rating }: { rating: Rating }) {
  return (
    <div className={`rating-card${rating.is_own ? ' is-own' : ''}`}>
      <div className="rating-card-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <StarRating value={rating.overall} size={16} />
          <span className="rating-date">{formatDate(rating.created_at)}</span>
          {rating.day_of_week && (
            <span className="rating-meta" style={{ marginTop: 0 }}>
              {formatDayVisited(rating.day_of_week)}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {rating.is_own && <span className="rating-own-badge">Your review</span>}
          {rating.checkin_verified && (
            <span className="badge-verified">✓ Verified</span>
          )}
        </div>
      </div>

      {rating.comment && (
        <p className="rating-comment">{rating.comment}</p>
      )}

      {rating.media?.length > 0 && <RatingMediaGallery media={rating.media} />}

      {(rating.music_tags.length > 0 || rating.crowd_tags.length > 0) && (
        <div className="tags-row">
          {rating.music_tags.map((tag) => (
            <span key={tag} className="badge">
              {tag}
            </span>
          ))}
          {rating.crowd_tags.map((tag) => (
            <span key={tag} className="badge">
              {tag}
            </span>
          ))}
        </div>
      )}

      {rating.would_go_back !== null && (
        <div className="rating-footer">
          <span className={`rating-return ${rating.would_go_back ? 'yes' : 'no'}`}>
            {rating.would_go_back ? '↩ Would return' : '✕ Wouldn\'t return'}
          </span>
        </div>
      )}
    </div>
  );
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
                    <StarRating value={rating} size={22} />
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

            <DecorativeBorder />

            {/* Ratings Section */}
            <div style={{ paddingTop: '40px', paddingBottom: '80px' }}>
              <h2
                className="section-title"
                style={{ fontSize: '34px', marginBottom: '24px' }}
              >
                Ratings
              </h2>

              {ratings.length === 0 ? (
                <div className="empty-state" style={{ textAlign: 'left', padding: '40px 0' }}>
                  <p className="empty-state-title">No ratings yet.</p>
                  <p>Be the first to rate this venue.</p>
                </div>
              ) : (
                <div>
                  {ratings.map((r) => (
                    <RatingCard key={r.id} rating={r} />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
