'use client';

import { useState } from 'react';
import { ArrowUpDown } from 'lucide-react';
import StarRating from '@/components/StarRating';
import RatingMediaGallery from '@/components/RatingMediaGallery';
import RatingReportButton from '@/components/RatingReportButton';
import { Rating } from '@/types';

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
          {!rating.is_own && <RatingReportButton ratingId={rating.id} />}
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

export default function RatingsList({ ratings }: { ratings: Rating[] }) {
  const [sort, setSort] = useState<'desc' | 'asc'>('desc');

  const sorted = [...ratings].sort((a, b) =>
    sort === 'desc' ? b.overall - a.overall : a.overall - b.overall
  );

  return (
    <div style={{ paddingTop: '40px', paddingBottom: '80px' }}>
      <div className="ratings-head">
        <h2 className="section-title" style={{ fontSize: '34px', margin: 0 }}>
          Ratings
        </h2>
        <button
          type="button"
          className="ratings-sort"
          onClick={() => setSort((s) => (s === 'desc' ? 'asc' : 'desc'))}
          aria-label={`Sort by rating, currently ${sort === 'desc' ? 'highest first' : 'lowest first'}`}
        >
          <ArrowUpDown size={14} />
          {sort === 'desc' ? 'Highest first' : 'Lowest first'}
        </button>
      </div>

      {ratings.length === 0 ? (
        <div className="empty-state" style={{ textAlign: 'left', padding: '40px 0' }}>
          <p className="empty-state-title">No ratings yet.</p>
          <p>Be the first to rate this venue.</p>
        </div>
      ) : (
        <div>
          {sorted.map((r) => (
            <RatingCard key={r.id} rating={r} />
          ))}
        </div>
      )}
    </div>
  );
}
