import Link from 'next/link';
import { Users } from 'lucide-react';
import { Venue } from '@/types';
import StarRating from './StarRating';
import PriceLevel from './PriceLevel';

interface VenueCardProps {
  venue: Venue;
  citySlug: string;
  isCheckedIn?: boolean;
}

export default function VenueCard({ venue, citySlug, isCheckedIn }: VenueCardProps) {
  const rating = parseFloat(venue.overall_rating);
  const displayRating = isNaN(rating) ? null : rating.toFixed(1);
  const shownMusicTags = venue.music_tags.slice(0, 2);
  const shownCrowdTags = venue.crowd_tags.slice(0, 2);

  return (
    <Link href={`/city/${citySlug}/${venue.id}`} className="card">
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
        <div className="venue-card-name" style={{ marginBottom: 0 }}>{venue.name}</div>
        {isCheckedIn && <span className="badge-here">Here</span>}
      </div>
      {venue.neighborhood && (
        <div className="venue-card-neighborhood">{venue.neighborhood}</div>
      )}

      <div className="venue-card-rating-row">
        {displayRating ? (
          <>
            <span className="venue-card-rating-num">{displayRating}</span>
            <StarRating value={rating} size={15} />
          </>
        ) : (
          <span className="venue-card-rating-count">No ratings yet</span>
        )}
        <span className="venue-card-rating-count">
          {venue.total_ratings} {venue.total_ratings === 1 ? 'rating' : 'ratings'}
        </span>
      </div>

      <div className="venue-card-footer">
        <PriceLevel level={venue.price_level} />

        {venue.active_checkin_count > 0 && (
          <span className="checkin-pill" style={{ fontSize: '12px', padding: '3px 10px' }}>
            <Users size={12} />
            {venue.active_checkin_count} here now
          </span>
        )}
      </div>

      {(shownMusicTags.length > 0 || shownCrowdTags.length > 0) && (
        <div className="tags-row">
          {shownMusicTags.map((tag) => (
            <span key={tag} className="badge badge-accent">
              {tag}
            </span>
          ))}
          {shownCrowdTags.map((tag) => (
            <span key={tag} className="badge">
              {tag}
            </span>
          ))}
        </div>
      )}
    </Link>
  );
}
