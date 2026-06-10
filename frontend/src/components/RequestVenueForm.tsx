'use client';

import { useState } from 'react';
import { useAuth, login, getCsrfToken } from '@/contexts/AuthContext';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export default function RequestVenueForm({
  citySlug,
  cityName,
  initialName = '',
}: {
  citySlug: string;
  cityName: string;
  initialName?: string;
}) {
  const { user, loading } = useAuth();
  const [name, setName] = useState(initialName);
  const [address, setAddress] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  if (loading) return null;

  if (done) {
    return (
      <div className="request-venue request-venue--done">
        <p className="request-venue-title">Thanks — request received! 🎉</p>
        <p className="request-venue-sub">
          We&apos;ll review <strong>{name || 'it'}</strong> and add it to {cityName} soon.
        </p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="request-venue">
        <p className="request-venue-title">Know a spot in {cityName}?</p>
        <p className="request-venue-sub">Sign in to request a venue be added.</p>
        <button className="request-venue-submit" onClick={() => login()}>
          Sign in to request
        </button>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setError('Please enter the venue name.'); return; }
    if (!address.trim()) { setError('Please enter the address.'); return; }
    setError('');
    setSubmitting(true);
    try {
      const res = await fetch(`${API}/api/v1/venues/requests/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCsrfToken() },
        credentials: 'include',
        body: JSON.stringify({
          city: citySlug,
          name: name.trim(),
          address: address.trim(),
          note: note.trim(),
        }),
      });
      if (res.ok) {
        setDone(true);
      } else {
        const data = await res.json().catch(() => ({}));
        setError((data.detail as string) || 'Something went wrong. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className="request-venue" onSubmit={handleSubmit}>
      <p className="request-venue-title">Know a spot in {cityName}?</p>
      <p className="request-venue-sub">Request a venue and we&apos;ll add it.</p>

      <input
        className="request-venue-input"
        placeholder="Venue name"
        value={name}
        maxLength={200}
        onChange={(e) => setName(e.target.value)}
      />
      <input
        className="request-venue-input"
        placeholder="Address"
        value={address}
        onChange={(e) => setAddress(e.target.value)}
      />
      <input
        className="request-venue-input"
        placeholder="Anything else? (optional)"
        value={note}
        maxLength={280}
        onChange={(e) => setNote(e.target.value)}
      />

      {error && <p className="request-venue-error">{error}</p>}

      <button type="submit" className="request-venue-submit" disabled={submitting}>
        {submitting ? 'Sending…' : 'Request venue'}
      </button>
    </form>
  );
}
