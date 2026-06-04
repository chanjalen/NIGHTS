'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Search } from 'lucide-react';
import { City } from '@/types';
import CityCard from './CityCard';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

function cityUrl(page: number, search: string) {
  const q = search.trim();
  return `${API}/api/v1/cities/?page=${page}${q ? `&search=${encodeURIComponent(q)}` : ''}`;
}

export default function CitiesGrid() {
  const [cities, setCities] = useState<City[]>([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Debounce the search box.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 250);
    return () => clearTimeout(t);
  }, [query]);

  // (Re)load page 1 whenever the (debounced) search changes.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(cityUrl(1, debouncedQuery))
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        setCities(data.results ?? []);
        setCount(data.count ?? 0);
        setPage(1);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [debouncedQuery]);

  const hasMore = cities.length < count;

  const loadMore = useCallback(async () => {
    if (loading || !hasMore) return;
    setLoading(true);
    try {
      const res = await fetch(cityUrl(page + 1, debouncedQuery));
      if (res.ok) {
        const data = await res.json();
        setCities((prev) => [...prev, ...(data.results ?? [])]);
        setPage((p) => p + 1);
      }
    } finally {
      setLoading(false);
    }
  }, [loading, hasMore, page, debouncedQuery]);

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

  return (
    <>
      <div style={{ marginBottom: '32px', maxWidth: '480px' }}>
        <div className="search-input-wrapper">
          <input
            type="text"
            className="search-input"
            placeholder="Search cities..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search cities"
          />
          <span className="search-input-icon">
            <Search size={18} />
          </span>
        </div>
      </div>

      {cities.length === 0 ? (
        <div className="empty-state">
          {loading ? (
            <p className="empty-state-title">Loading cities...</p>
          ) : debouncedQuery ? (
            <>
              <p className="empty-state-title">No cities match &ldquo;{debouncedQuery}&rdquo;.</p>
              <p>Try a different search term.</p>
            </>
          ) : (
            <p className="empty-state-title">No cities yet.</p>
          )}
        </div>
      ) : (
        <>
          <div className="grid-3" style={{ paddingBottom: '40px' }}>
            {cities.map((city) => (
              <CityCard key={city.id} city={city} />
            ))}
          </div>

          <div ref={sentinelRef} style={{ height: '1px' }} />

          <p
            style={{
              textAlign: 'center',
              color: 'var(--text-muted)',
              fontSize: '13px',
              paddingBottom: '80px',
            }}
          >
            {loading
              ? 'Loading more...'
              : `${count.toLocaleString()} ${count === 1 ? 'city' : 'cities'}`}
          </p>
        </>
      )}
    </>
  );
}
