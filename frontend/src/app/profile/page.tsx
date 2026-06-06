'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Star, MapPin, Heart } from 'lucide-react';
import Header from '@/components/Header';
import StarRating from '@/components/StarRating';
import RatingMediaGallery from '@/components/RatingMediaGallery';
import type { RatingMedia } from '@/types';
import { useAuth, logout } from '@/contexts/AuthContext';

interface ProfileRating {
  id: string;
  venue_id: string;
  venue_name: string;
  city_slug: string;
  city_name: string;
  city_state: string;
  overall: number;
  day_of_week: string | null;
  music_tags: string[];
  crowd_tags: string[];
  would_go_back: boolean | null;
  comment: string | null;
  media: RatingMedia[];
  checkin_verified: boolean;
  created_at: string;
}

interface ProfileVisit {
  venue_id: string;
  venue_name: string;
  city_slug: string;
  city_name: string;
  count: number;
}

interface ProfileSaved {
  venue_id: string;
  venue_name: string;
  city_slug: string;
  city_name: string;
  neighborhood: string | null;
  overall_rating: string;
  total_ratings: number;
}

interface ProfileData {
  ratings: ProfileRating[];
  visits: ProfileVisit[];
  saved: ProfileSaved[];
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function formatDayVisited(day: string): string {
  return `Day Visited: ${day.charAt(0) + day.slice(1).toLowerCase()}`;
}

export default function ProfilePage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

  const [data, setData] = useState<ProfileData | null>(null);
  const [fetching, setFetching] = useState(true);
  const [tab, setTab] = useState<'reviews' | 'visits' | 'saved'>('reviews');

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace('/signin');
      return;
    }
    fetch(`${API}/api/v1/accounts/profile/`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d) setData(d); })
      .finally(() => setFetching(false));
  }, [user, loading, API, router]);

  if (loading || fetching) {
    return (
      <>
        <Header />
        <main><div className="container" style={{ paddingTop: 48 }}><p className="venue-rating-sub">Loading…</p></div></main>
      </>
    );
  }

  if (!data) return null;

  const { ratings, visits, saved } = data;

  return (
    <>
      <Header />
      <main>
        <div className="container" style={{ paddingTop: 48, paddingBottom: 80 }}>

          {/* Profile header */}
          <div className="profile-hero">
            <div className="profile-avatar-lg">
              {(user?.display_name || user?.email || '?').charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="profile-name-row">
                <h1 className="profile-name">{user?.display_name || user?.email}</h1>
                <button className="btn-signout" onClick={logout}>
                  Sign Out
                </button>
              </div>
              <div className="profile-stats-row">
                <span className="profile-stat">
                  <Star size={14} />
                  {ratings.length} {ratings.length === 1 ? 'review' : 'reviews'}
                </span>
                <span className="profile-stat">
                  <MapPin size={14} />
                  {visits.reduce((s, v) => s + v.count, 0)} check-ins
                </span>
                <span className="profile-stat">
                  <Heart size={14} />
                  {saved.length} saved
                </span>
              </div>
            </div>
          </div>

          {/* Tab bar */}
          <div className="profile-tabs" role="tablist">
            <button
              role="tab"
              aria-selected={tab === 'reviews'}
              className={`profile-tab${tab === 'reviews' ? ' active' : ''}`}
              onClick={() => setTab('reviews')}
            >
              Your Reviews
              <span className="profile-tab-count">{ratings.length}</span>
            </button>
            <button
              role="tab"
              aria-selected={tab === 'visits'}
              className={`profile-tab${tab === 'visits' ? ' active' : ''}`}
              onClick={() => setTab('visits')}
            >
              Places Visited
              <span className="profile-tab-count">{visits.length}</span>
            </button>
            <button
              role="tab"
              aria-selected={tab === 'saved'}
              className={`profile-tab${tab === 'saved' ? ' active' : ''}`}
              onClick={() => setTab('saved')}
            >
              Saved
              <span className="profile-tab-count">{saved.length}</span>
            </button>
          </div>

          {/* Your Reviews */}
          {tab === 'reviews' && (
            <section role="tabpanel">
              {ratings.length === 0 ? (
                <p className="venue-rating-sub">No reviews yet.</p>
              ) : (
                <div>
                  {ratings.map((r) => (
                    <div key={r.id} className="rating-card">
                      <div className="rating-card-header">
                        <div>
                          <div style={{ marginBottom: 8 }}>
                            <Link
                              href={`/city/${r.city_slug}/${r.venue_id}?from=profile`}
                              className="profile-venue-link"
                            >
                              {r.venue_name}
                            </Link>
                            <span className="rating-meta" style={{ marginTop: 0 }}>
                              {' - '}{r.city_name}, {r.city_state}
                            </span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                            <StarRating value={r.overall} size={16} />
                            <span className="rating-date">{formatDate(r.created_at)}</span>
                            {r.day_of_week && (
                              <span className="rating-meta" style={{ marginTop: 0 }}>
                                {formatDayVisited(r.day_of_week)}
                              </span>
                            )}
                          </div>
                        </div>
                        {r.checkin_verified && (
                          <span className="badge-verified">✓ Verified</span>
                        )}
                      </div>

                      {r.comment && (
                        <p className="rating-comment">{r.comment}</p>
                      )}

                      {r.media?.length > 0 && (
                        <RatingMediaGallery media={r.media} />
                      )}

                      {(r.music_tags.length > 0 || r.crowd_tags.length > 0) && (
                        <div className="tags-row">
                          {r.music_tags.map((t) => (
                            <span key={t} className="badge badge-accent">{t}</span>
                          ))}
                          {r.crowd_tags.map((t) => (
                            <span key={t} className="badge">{t}</span>
                          ))}
                        </div>
                      )}

                      {r.would_go_back !== null && (
                        <div className="rating-footer">
                          <span className={`rating-return ${r.would_go_back ? 'yes' : 'no'}`}>
                            {r.would_go_back ? '↩ Would return' : '✕ Wouldn\'t return'}
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* Places Visited */}
          {tab === 'visits' && (
            <section role="tabpanel">
              {visits.length === 0 ? (
                <p className="venue-rating-sub">No check-ins yet.</p>
              ) : (
                <div className="visit-list">
                  {visits.map((v) => (
                    <Link
                      key={v.venue_id}
                      href={`/city/${v.city_slug}/${v.venue_id}?from=profile`}
                      className="visit-item"
                    >
                      <span className="visit-name">{v.venue_name}</span>
                      <span className="visit-count">{v.count}</span>
                    </Link>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* Saved */}
          {tab === 'saved' && (
            <section role="tabpanel">
              {saved.length === 0 ? (
                <p className="venue-rating-sub">
                  No saved venues yet. Tap “♡ Save” on a venue to keep it here for later.
                </p>
              ) : (
                <div className="saved-grid">
                  {saved.map((s) => {
                    const r = parseFloat(s.overall_rating);
                    const display = isNaN(r) ? null : r.toFixed(1);
                    return (
                      <Link
                        key={s.venue_id}
                        href={`/city/${s.city_slug}/${s.venue_id}?from=profile`}
                        className="saved-card"
                      >
                        <span className="saved-name">{s.venue_name}</span>
                        <span className="saved-meta">
                          {[s.neighborhood, s.city_name].filter(Boolean).join(' · ')}
                        </span>
                        <span className="saved-rating">
                          {display ? (
                            <>
                              <Star size={13} /> {display}
                              <span className="saved-count">
                                ({s.total_ratings})
                              </span>
                            </>
                          ) : (
                            'No ratings yet'
                          )}
                        </span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </section>
          )}

        </div>
      </main>
    </>
  );
}
