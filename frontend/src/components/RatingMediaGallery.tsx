'use client';

import type { RatingMedia } from '@/types';

export default function RatingMediaGallery({ media }: { media: RatingMedia[] }) {
  // Only show finished media; hide processing/removed/failed.
  const visible = media.filter((m) => m.status === 'ready' && m.file_url);
  if (visible.length === 0) return null;

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
        </div>
      ))}
    </div>
  );
}
