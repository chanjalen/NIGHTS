'use client';

import { useState } from 'react';
import { Flag } from 'lucide-react';
import { getCsrfToken } from '@/contexts/AuthContext';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export default function RatingReportButton({ ratingId }: { ratingId: string }) {
  const [reported, setReported] = useState(false);

  const report = async () => {
    if (reported) return;
    if (!confirm('Report this review?')) return;
    try {
      const res = await fetch(`${API}/api/v1/ratings/${ratingId}/report/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCsrfToken() },
        credentials: 'include',
        body: JSON.stringify({}),
      });
      if (res.ok) setReported(true);
    } catch {
      /* ignore */
    }
  };

  return (
    <button
      type="button"
      className="rating-report"
      onClick={report}
      title={reported ? 'Reported' : 'Report review'}
      aria-label="Report review"
    >
      <Flag size={13} fill={reported ? 'currentColor' : 'none'} />
      <span>{reported ? 'Reported' : 'Report'}</span>
    </button>
  );
}
