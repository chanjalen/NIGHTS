'use client';

import { useState } from 'react';
import { Flag } from 'lucide-react';
import { getCsrfToken } from '@/contexts/AuthContext';
import type { RatingMedia } from '@/types';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export default function RatingMediaGallery({
  media,
  allowReport = true,
}: {
  media: RatingMedia[];
  allowReport?: boolean;
}) {
  const [reported, setReported] = useState<Record<string, boolean>>({});

  // Only show finished media; hide processing/removed/failed.
  const visible = media.filter((m) => m.status === 'ready' && m.file_url);
  if (visible.length === 0) return null;

  const report = async (id: string) => {
    if (reported[id]) return;
    if (!confirm('Report this media as inappropriate?')) return;
    try {
      const res = await fetch(`${API}/api/v1/ratings/media/${id}/report/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCsrfToken() },
        credentials: 'include',
        body: JSON.stringify({}),
      });
      if (res.ok) setReported((r) => ({ ...r, [id]: true }));
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="rating-media-grid">
      {visible.map((m) => (
        <div key={m.id} className="rating-media-item">
          {m.media_type === 'image' ? (
            <a href={m.file_url} target="_blank" rel="noopener noreferrer">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={m.thumbnail_url || m.file_url}
                alt="Review media"
                loading="lazy"
                className="rating-media-thumb"
              />
            </a>
          ) : (
            <video
              src={m.file_url}
              poster={m.thumbnail_url || undefined}
              controls
              preload="none"
              className="rating-media-thumb"
            />
          )}
          {allowReport && (
            <button
              type="button"
              className="rating-media-report"
              onClick={() => report(m.id)}
              title={reported[m.id] ? 'Reported' : 'Report'}
              aria-label="Report media"
            >
              <Flag size={12} fill={reported[m.id] ? 'currentColor' : 'none'} />
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
