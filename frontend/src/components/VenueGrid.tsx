'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Search, X, SlidersHorizontal } from 'lucide-react';
import VenueCard from './VenueCard';
import RequestVenueForm from './RequestVenueForm';
import { useAuth } from '@/contexts/AuthContext';
import { buildVenueQuery, type VenueFilters, type CityStats } from '@/lib/api';
import { track } from '@/lib/analytics';
import type { Venue } from '@/types';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// Keep these in sync with the rating form's options in VenueActions.tsx — venue
// tags are aggregated from ratings, so a filter value that isn't a form option
// can never match. ("Other" is a freeform field, so it's not a filterable tag.)
const MUSIC_TAGS = ['Hip-Hop', 'EDM', 'R&B', 'Pop', 'Latin', 'Country'];
const CROWD_TAGS = ['Chill', 'Rowdy', 'College', 'Upscale', 'Local'];
const RATINGS: { v: number; label: string }[] = [
  { v: 3, label: '3.0+' },
  { v: 4, label: '4.0+' },
  { v: 4.5, label: '4.5+' },
];

interface VenueGridProps {
  cityName: string;
  stats: CityStats;
  initialVenues: Venue[];
  totalCount: number;
  citySlug: string;
}

export default function VenueGrid({
  cityName,
  stats,
  initialVenues,
  totalCount,
  citySlug,
}: VenueGridProps) {
  const { user } = useAuth();
  const neighborhoods = stats.neighborhoods ?? [];

  const [venues, setVenues] = useState<Venue[]>(initialVenues ?? []);
  const [count, setCount] = useState(totalCount);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [checkedInVenueId, setCheckedInVenueId] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Filter state (music / crowd / price are multi-select)
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [music, setMusic] = useState<string[]>([]);
  const [crowd, setCrowd] = useState<string[]>([]);
  const [price, setPrice] = useState<number[]>([]);
  const [minRating, setMinRating] = useState<number | null>(null);
  const [cover, setCover] = useState<'yes' | 'no' | null>(null);

  const filters: VenueFilters = useMemo(
    () => ({
      search: debouncedSearch,
      neighborhood: neighborhood || undefined,
      music_tag: music,
      crowd_tag: crowd,
      price_level: price,
      min_rating: minRating ?? undefined,
      cover: cover ?? undefined,
    }),
    [debouncedSearch, neighborhood, music, crowd, price, minRating, cover]
  );

  const filtersActive =
    !!debouncedSearch || !!neighborhood || music.length > 0 || crowd.length > 0 ||
    price.length > 0 || minRating !== null || cover !== null;

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    if (!user) return;
    fetch(`${API}/api/v1/checkins/?mine=1`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        const list: { venue: string }[] = data?.results ?? data ?? [];
        if (list.length > 0) setCheckedInVenueId(String(list[0].venue));
      })
      .catch(() => {});
  }, [user]);

  // Refetch from page 1 when filters change (skip first render — SSR data already shown).
  const didMount = useRef(false);
  useEffect(() => {
    if (!didMount.current) {
      didMount.current = true;
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetch(`${API}/api/v1/venues/?${buildVenueQuery(citySlug, 1, filters)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        setVenues(data.results ?? []);
        setCount(data.count ?? 0);
        setPage(1);
        // result_count: 0 on a real query = demand signal for venues/cities to seed.
        if (filters.search?.trim()) {
          track('search_performed', {
            query: filters.search.trim(),
            city_slug: citySlug,
            result_count: data.count ?? 0,
          });
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [filters, citySlug]);

  const hasMore = venues.length < count;

  const loadMore = useCallback(async () => {
    if (loading || !hasMore) return;
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/v1/venues/?${buildVenueQuery(citySlug, page + 1, filters)}`);
      if (res.ok) {
        const data = await res.json();
        setVenues((prev) => [...prev, ...(data.results ?? [])]);
        setPage((p) => p + 1);
      }
    } finally {
      setLoading(false);
    }
  }, [loading, hasMore, page, citySlug, filters]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) loadMore();
      },
      { rootMargin: '300px' }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadMore]);

  // Close the filter panel on Escape.
  useEffect(() => {
    if (!panelOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPanelOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [panelOpen]);

  const clearAll = () => {
    setSearch('');
    setNeighborhood('');
    setMusic([]);
    setCrowd([]);
    setPrice([]);
    setMinRating(null);
    setCover(null);
  };

  function toggleArr<T>(value: T, arr: T[], set: (v: T[]) => void) {
    set(arr.includes(value) ? arr.filter((x) => x !== value) : [...arr, value]);
  }

  // Active filters, rendered as removable pills next to the Filters button.
  const activePills: { key: string; label: string; remove: () => void }[] = [];
  if (neighborhood)
    activePills.push({ key: 'nb', label: neighborhood, remove: () => setNeighborhood('') });
  price.forEach((n) =>
    activePills.push({ key: `p-${n}`, label: '$'.repeat(n), remove: () => toggleArr(n, price, setPrice) })
  );
  if (minRating !== null)
    activePills.push({
      key: 'rating',
      label: `★ ${RATINGS.find((r) => r.v === minRating)?.label ?? `${minRating}+`}`,
      remove: () => setMinRating(null),
    });
  if (cover)
    activePills.push({
      key: 'cover',
      label: cover === 'no' ? 'No cover' : 'Has cover',
      remove: () => setCover(null),
    });
  music.forEach((t) =>
    activePills.push({ key: `m-${t}`, label: t, remove: () => toggleArr(t, music, setMusic) })
  );
  crowd.forEach((t) =>
    activePills.push({ key: `c-${t}`, label: t, remove: () => toggleArr(t, crowd, setCrowd) })
  );

  return (
    <>
      <div className="city-head">
        <div className="city-head-info">
          <h1 className="section-title city-head-name">{cityName}</h1>
          <div className="stats-row">
            <div className="stat-item">
              <span className="stat-value">{stats.venue_count}</span>
              <span className="stat-label">Venues</span>
            </div>
            {stats.avg_rating !== null && (
              <div className="stat-item">
                <span className="stat-value">
                  {stats.avg_rating.toFixed(1)}
                  <span className="stat-star">★</span>
                </span>
                <span className="stat-label">Avg Rating</span>
              </div>
            )}
            {stats.active_checkin_count > 0 && (
              <div className="stat-item">
                <span className="stat-value stat-value--live">{stats.active_checkin_count}</span>
                <span className="stat-label">Here Now</span>
              </div>
            )}
          </div>
        </div>

        <div className="search-input-wrapper city-head-search">
          <input
            type="text"
            className="search-input"
            placeholder={`Search venues in ${cityName}…`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search venues"
          />
          <span className="search-input-icon">
            <Search size={18} />
          </span>
        </div>
      </div>

      <div className="venue-filters">
        <div className="filter-bar">
          <button
            type="button"
            className={`filter-toggle${activePills.length ? ' has-active' : ''}`}
            onClick={() => setPanelOpen(true)}
            aria-haspopup="dialog"
            aria-expanded={panelOpen}
          >
            <SlidersHorizontal size={16} />
            Filters
            {activePills.length > 0 && (
              <span className="filter-count">{activePills.length}</span>
            )}
          </button>

          {activePills.map((pill) => (
            <button
              key={pill.key}
              type="button"
              className="active-pill"
              onClick={pill.remove}
              aria-label={`Remove filter ${pill.label}`}
            >
              {pill.label}
              <X size={12} />
            </button>
          ))}

          {filtersActive && (
            <button type="button" className="filter-clear-link" onClick={clearAll}>
              Clear all
            </button>
          )}
        </div>

        {panelOpen && (
          <div className="filter-backdrop" onClick={() => setPanelOpen(false)}>
            <div
              className="filter-panel"
              role="dialog"
              aria-modal="true"
              aria-label="Filter venues"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="filter-panel-head">
                <span className="filter-panel-title">Filters</span>
                <button
                  type="button"
                  className="filter-panel-close"
                  onClick={() => setPanelOpen(false)}
                  aria-label="Close filters"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="filter-panel-body">
                {neighborhoods.length > 0 && (
                  <label className="filter-group">
                    <span className="filter-label">Neighborhood</span>
                    <select
                      className="filter-select"
                      value={neighborhood}
                      onChange={(e) => setNeighborhood(e.target.value)}
                    >
                      <option value="">All</option>
                      {neighborhoods.map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </select>
                  </label>
                )}

                <div className="filter-group">
                  <span className="filter-label">Price</span>
                  <div className="chip-row">
                    {[1, 2, 3, 4].map((n) => (
                      <button
                        key={n}
                        type="button"
                        className={`chip${price.includes(n) ? ' active' : ''}`}
                        onClick={() => toggleArr(n, price, setPrice)}
                      >
                        {'$'.repeat(n)}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="filter-group">
                  <span className="filter-label">Rating</span>
                  <div className="chip-row">
                    {RATINGS.map((r) => (
                      <button
                        key={r.v}
                        type="button"
                        className={`chip${minRating === r.v ? ' active' : ''}`}
                        onClick={() => setMinRating(minRating === r.v ? null : r.v)}
                      >
                        ★ {r.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="filter-group">
                  <span className="filter-label">Cover</span>
                  <div className="chip-row">
                    <button
                      type="button"
                      className={`chip${cover === 'no' ? ' active' : ''}`}
                      onClick={() => setCover(cover === 'no' ? null : 'no')}
                    >
                      No cover
                    </button>
                    <button
                      type="button"
                      className={`chip${cover === 'yes' ? ' active' : ''}`}
                      onClick={() => setCover(cover === 'yes' ? null : 'yes')}
                    >
                      Has cover
                    </button>
                  </div>
                </div>

                <div className="filter-group">
                  <span className="filter-label">Music</span>
                  <div className="chip-row">
                    {MUSIC_TAGS.map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        className={`chip${music.includes(tag) ? ' active' : ''}`}
                        onClick={() => toggleArr(tag, music, setMusic)}
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="filter-group">
                  <span className="filter-label">Crowd</span>
                  <div className="chip-row">
                    {CROWD_TAGS.map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        className={`chip${crowd.includes(tag) ? ' active' : ''}`}
                        onClick={() => toggleArr(tag, crowd, setCrowd)}
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="filter-panel-foot">
                <button
                  type="button"
                  className="filter-foot-clear"
                  onClick={clearAll}
                  disabled={!filtersActive}
                >
                  Clear all
                </button>
                <button
                  type="button"
                  className="filter-apply"
                  onClick={() => setPanelOpen(false)}
                >
                  Show {count} {count === 1 ? 'result' : 'results'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {venues.length === 0 ? (
        <div className="empty-state">
          <p className="empty-state-title">
            {filtersActive ? 'No venues found.' : `No venues in ${cityName} yet.`}
          </p>
          <p>
            {filtersActive
              ? 'Try loosening your filters.'
              : 'Be the first to put it on the map.'}
          </p>
          {!filtersActive && (
            <RequestVenueForm citySlug={citySlug} cityName={cityName} />
          )}
        </div>
      ) : (
        <>
          <div className="grid-3">
            {venues.map((venue) => (
              <VenueCard
                key={venue.id}
                venue={venue}
                citySlug={citySlug}
                isCheckedIn={checkedInVenueId === venue.id}
              />
            ))}
          </div>

          <div ref={sentinelRef} style={{ height: 1 }} />

          {loading && <p className="venue-grid-status">Loading…</p>}

          {!hasMore && (
            <p className="venue-grid-status">
              {count} {count === 1 ? 'venue' : 'venues'}
              {filtersActive ? ' match' : ' total'}
            </p>
          )}
        </>
      )}
    </>
  );
}
