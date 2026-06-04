'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { City } from '@/types';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export default function LiveTicker() {
  const [cities, setCities] = useState<City[]>([]);

  useEffect(() => {
    // Top 50 cities by venue count (server-ordered + paginated).
    fetch(`${API}/api/v1/cities/?page_size=50`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        const list: City[] = data?.results ?? (Array.isArray(data) ? data : []);
        setCities(list.filter((c) => c.venue_count > 0));
      })
      .catch(() => {});
  }, []);

  if (cities.length === 0) return null;

  // Duplicate the list so the marquee loops seamlessly.
  const loop = [...cities, ...cities];

  return (
    <div className="ticker" aria-label="Cities on NITE">
      <span className="ticker-tag">
        <span className="ticker-dot" />
        Live
      </span>
      <div className="ticker-viewport">
        <div className="ticker-track">
          {loop.map((city, i) => (
            <Link key={`${city.id}-${i}`} href={`/city/${city.slug}`} className="ticker-item">
              <span className="ticker-city">{city.name}</span>
              <span className="ticker-count">{city.venue_count.toLocaleString()} venues</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
