'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth, login, getCsrfToken } from '@/contexts/AuthContext';
import { track } from '@/lib/analytics';
import {
  MAX_FILES,
  MAX_VIDEO_SECONDS,
  kindOf,
  validateFile,
  videoDuration,
  uploadMedia,
  type MediaKind,
} from '@/lib/upload';

interface LocalMedia {
  file: File;
  url: string;
  kind: MediaKind;
}

const MUSIC_TAGS = ['Hip-Hop', 'EDM', 'R&B', 'Pop', 'Latin', 'Country', 'Other'];
const CROWD_TAGS = ['Chill', 'Rowdy', 'College', 'Upscale', 'Local', 'Other'];
const DAYS = [
  { v: 'MON', l: 'Mon' },
  { v: 'TUE', l: 'Tue' },
  { v: 'WED', l: 'Wed' },
  { v: 'THU', l: 'Thu' },
  { v: 'FRI', l: 'Fri' },
  { v: 'SAT', l: 'Sat' },
  { v: 'SUN', l: 'Sun' },
];

function StarPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="star-picker">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          className={`star-pick${n <= (hover || value) ? ' lit' : ''}`}
          onMouseEnter={() => setHover(n)}
          onMouseLeave={() => setHover(0)}
          onClick={() => onChange(n)}
          aria-label={`${n} star${n > 1 ? 's' : ''}`}
        >
          ★
        </button>
      ))}
    </div>
  );
}

export default function VenueActions({ venueId, citySlug }: { venueId: string; citySlug: string }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

  const [checkedIn, setCheckedIn] = useState(false);
  const [checkinLoading, setCheckinLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const [overall, setOverall] = useState(0);
  const [dayOfWeek, setDayOfWeek] = useState('');
  const [priceLevel, setPriceLevel] = useState<number | null>(null);
  const [musicTags, setMusicTags] = useState<string[]>([]);
  const [customMusic, setCustomMusic] = useState('');
  const [crowdTags, setCrowdTags] = useState<string[]>([]);
  const [customCrowd, setCustomCrowd] = useState('');
  const [hasCover, setHasCover] = useState<boolean | null>(null);
  const [coverAmount, setCoverAmount] = useState('');
  const [wouldGoBack, setWouldGoBack] = useState<boolean | null>(null);
  const [comment, setComment] = useState('');
  const [media, setMedia] = useState<LocalMedia[]>([]);
  const [uploadPct, setUploadPct] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const addFiles = async (fileList: FileList | null) => {
    if (!fileList) return;
    setError('');
    const incoming = Array.from(fileList);
    if (media.length + incoming.length > MAX_FILES) {
      setError(`You can attach at most ${MAX_FILES} files.`);
      return;
    }
    const next: LocalMedia[] = [];
    for (const file of incoming) {
      const err = validateFile(file);
      if (err) { setError(err); return; }
      const kind = kindOf(file)!;
      if (kind === 'video') {
        try {
          const dur = await videoDuration(file);
          if (dur > MAX_VIDEO_SECONDS + 0.5) {
            setError(`Videos must be ${MAX_VIDEO_SECONDS} seconds or less.`);
            return;
          }
        } catch {
          setError('Could not read that video.');
          return;
        }
      }
      next.push({ file, url: URL.createObjectURL(file), kind });
    }
    setMedia((m) => [...m, ...next]);
  };

  const removeMedia = (idx: number) => {
    setMedia((m) => {
      const target = m[idx];
      if (target) URL.revokeObjectURL(target.url);
      return m.filter((_, i) => i !== idx);
    });
  };

  // On mount, check if the current user is already checked in here
  useEffect(() => {
    if (!user) return;
    fetch(`${API}/api/v1/checkins/?venue=${venueId}`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data) return;
        const list: { user_id: number }[] = data.results ?? data ?? [];
        if (list.some((c) => c.user_id === user.id)) {
          setCheckedIn(true);
        }
      })
      .catch(() => {});
  }, [user, venueId, API]);

  // On mount, check whether the current user has saved this venue
  useEffect(() => {
    if (!user) return;
    fetch(`${API}/api/v1/saved/?venue=${venueId}`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data) return;
        const list = data.results ?? data ?? [];
        if (list.length > 0) setSaved(true);
      })
      .catch(() => {});
  }, [user, venueId, API]);

  const handleToggleSave = async () => {
    if (!user) { login(); return; }
    setSaveLoading(true);
    const wasSaved = saved;
    try {
      const res = wasSaved
        ? await fetch(`${API}/api/v1/saved/${venueId}/`, {
            method: 'DELETE',
            headers: { 'X-CSRFToken': getCsrfToken() },
            credentials: 'include',
          })
        : await fetch(`${API}/api/v1/saved/`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-CSRFToken': getCsrfToken(),
            },
            credentials: 'include',
            body: JSON.stringify({ venue: venueId }),
          });
      if (res.ok) setSaved(!wasSaved);
    } finally {
      setSaveLoading(false);
    }
  };

  const handleCheckin = async () => {
    if (!user) { login(); return; }
    setCheckinLoading(true);
    try {
      const res = await fetch(`${API}/api/v1/checkins/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': getCsrfToken(),
        },
        credentials: 'include',
        body: JSON.stringify({ venue: venueId }),
      });
      if (res.ok) {
        track('checkin_created', { venue_id: venueId, city_slug: citySlug });
        setCheckedIn(true);
        router.refresh();
      }
    } finally {
      setCheckinLoading(false);
    }
  };

  const handleCheckout = async () => {
    setCheckinLoading(true);
    try {
      const res = await fetch(`${API}/api/v1/checkins/checkout/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': getCsrfToken(),
        },
        credentials: 'include',
      });
      if (res.ok) {
        setCheckedIn(false);
        router.refresh();
      }
    } finally {
      setCheckinLoading(false);
    }
  };

  const toggleTag = (tag: string, list: string[], setter: (v: string[]) => void) => {
    setter(list.includes(tag) ? list.filter((t) => t !== tag) : [...list, tag]);
  };

  // After posting a review with media, poll until the async processing finishes
  // (image resize / video transcode) so it shows up without a manual reload.
  const pollForMedia = async (ratingId: string, expected: number) => {
    for (let i = 0; i < 10; i++) {
      await new Promise((r) => setTimeout(r, 1500));
      try {
        const res = await fetch(`${API}/api/v1/ratings/?venue=${venueId}`, {
          credentials: 'include',
          cache: 'no-store',
        });
        if (!res.ok) continue;
        const data = await res.json();
        const list: { id: string; media?: unknown[] }[] = data.results ?? data ?? [];
        const mine = list.find((r) => r.id === ratingId);
        if (mine && (mine.media?.length ?? 0) >= expected) {
          router.refresh();
          return;
        }
      } catch {
        /* keep polling */
      }
    }
    router.refresh(); // give up after ~15s and refresh anyway
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!overall) { setError('Please select your overall rating.'); return; }
    if (!dayOfWeek) { setError('Please select the day you visited.'); return; }
    if (!priceLevel) { setError('Please select a price level.'); return; }
    if (!musicTags.length) { setError('Please select at least one music vibe.'); return; }
    if (musicTags.includes('Other') && !customMusic.trim()) {
      setError('Please describe the music for "Other".'); return;
    }
    if (!crowdTags.length) { setError('Please select at least one crowd vibe.'); return; }
    if (crowdTags.includes('Other') && !customCrowd.trim()) {
      setError('Please describe the crowd for "Other".'); return;
    }
    if (hasCover === null) { setError('Please answer whether there was a cover charge.'); return; }
    if (hasCover && !coverAmount) { setError('Please enter the cover amount.'); return; }
    if (wouldGoBack === null) { setError('Please answer "Would you return?"'); return; }
    setError('');
    setSubmitting(true);

    // "Other" is a UI marker; replace it with the user's typed value.
    const finalMusicTags = musicTags.filter((t) => t !== 'Other');
    if (musicTags.includes('Other')) {
      finalMusicTags.push(customMusic.trim());
    }

    const finalCrowdTags = crowdTags.filter((t) => t !== 'Other');
    if (crowdTags.includes('Other')) {
      finalCrowdTags.push(customCrowd.trim());
    }

    const body: Record<string, unknown> = {
      venue: venueId,
      overall,
      would_go_back: wouldGoBack,
      music_tags: finalMusicTags,
      crowd_tags: finalCrowdTags,
      has_cover: hasCover ?? false,
    };
    if (dayOfWeek) body.day_of_week = dayOfWeek;
    if (priceLevel) body.price_level = priceLevel;
    if (hasCover && coverAmount) body.cover_amount = parseFloat(coverAmount);
    if (comment.trim()) body.comment = comment.trim();

    try {
      // Upload any attached media to S3 first, then send the keys with the rating.
      if (media.length) {
        setUploadPct(0);
        try {
          body.media_keys = await uploadMedia(
            API,
            media.map((m) => m.file),
            setUploadPct,
          );
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Upload failed.');
          setUploadPct(null);
          setSubmitting(false);
          return;
        }
        setUploadPct(null);
      }

      const res = await fetch(`${API}/api/v1/ratings/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': getCsrfToken(),
        },
        credentials: 'include',
        body: JSON.stringify(body),
      });

      if (res.ok) {
        const created = await res.json().catch(() => null);
        const mediaCount = (body.media_keys as string[] | undefined)?.length ?? 0;
        track('rating_submitted', {
          venue_id: venueId,
          stars: overall,
          has_media: mediaCount > 0,
        });
        media.forEach((m) => URL.revokeObjectURL(m.url));
        setMedia([]);
        setSubmitted(true);
        setShowModal(false);
        if (created?.id && mediaCount > 0) {
          // Media is processed async; poll until it's ready, then refresh so
          // it appears without the user having to reload.
          pollForMedia(created.id, mediaCount);
        } else {
          router.refresh();
        }
      } else {
        const data = await res.json().catch(() => ({}));
        setError((data.detail as string) || 'Something went wrong. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return null;

  return (
    <>
      <div className="venue-actions">
        <button
          className={`btn-rate${submitted ? ' is-rated' : ''}`}
          onClick={() => {
            if (!user) { login(); return; }
            if (!submitted) setShowModal(true);
          }}
          disabled={submitted}
        >
          {submitted ? '✓ Rated' : 'Rate This Venue'}
        </button>
        <button
          className={`btn-save${saved ? ' is-saved' : ''}`}
          onClick={handleToggleSave}
          disabled={saveLoading}
          aria-pressed={saved}
        >
          {saved ? '♥ Saved' : '♡ Save'}
        </button>
        {checkedIn ? (
          <button
            className="btn-checkout"
            onClick={handleCheckout}
            disabled={checkinLoading}
          >
            {checkinLoading ? 'Leaving…' : 'Check Out'}
          </button>
        ) : (
          <button
            className="btn-checkin"
            onClick={handleCheckin}
            disabled={checkinLoading}
          >
            {checkinLoading ? 'Checking in…' : "I'm Here Now"}
          </button>
        )}
        {checkedIn && (
          <Link href={`/city/${citySlug}/${venueId}/chat`} className="btn-chat">
            Chat Room
          </Link>
        )}
      </div>

      {showModal && (
        <div
          className="modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowModal(false);
          }}
        >
          <div className="modal" role="dialog" aria-modal="true">
            <div className="modal-head">
              <span className="modal-title">Rate This Venue</span>
              <button
                type="button"
                className="modal-close"
                onClick={() => setShowModal(false)}
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="rf">
              <div className="rf-group">
                <label className="rf-label">
                  Overall Rating <span className="rf-required">*</span>
                </label>
                <StarPicker value={overall} onChange={setOverall} />
              </div>

              <div className="rf-group">
                <label className="rf-label">
                  Day Visited <span className="rf-required">*</span>
                </label>
                <div className="chip-row">
                  {DAYS.map((d) => (
                    <button
                      key={d.v}
                      type="button"
                      className={`chip${dayOfWeek === d.v ? ' active' : ''}`}
                      onClick={() => setDayOfWeek(dayOfWeek === d.v ? '' : d.v)}
                    >
                      {d.l}
                    </button>
                  ))}
                </div>
              </div>

              <div className="rf-group">
                <label className="rf-label">
                  Price Level <span className="rf-required">*</span>
                </label>
                <div className="chip-row">
                  {[1, 2, 3, 4].map((n) => (
                    <button
                      key={n}
                      type="button"
                      className={`chip${priceLevel === n ? ' active' : ''}`}
                      onClick={() => setPriceLevel(priceLevel === n ? null : n)}
                    >
                      {'$'.repeat(n)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="rf-group">
                <label className="rf-label">
                  Music Vibe <span className="rf-required">*</span>
                </label>
                <div className="chip-row">
                  {MUSIC_TAGS.map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      className={`chip${musicTags.includes(tag) ? ' active' : ''}`}
                      onClick={() => toggleTag(tag, musicTags, setMusicTags)}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
                {musicTags.includes('Other') && (
                  <input
                    type="text"
                    className="rf-input"
                    placeholder="What kind of music?"
                    maxLength={50}
                    value={customMusic}
                    onChange={(e) => setCustomMusic(e.target.value)}
                    style={{ marginTop: '10px' }}
                  />
                )}
              </div>

              <div className="rf-group">
                <label className="rf-label">
                  Crowd Vibe <span className="rf-required">*</span>
                </label>
                <div className="chip-row">
                  {CROWD_TAGS.map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      className={`chip${crowdTags.includes(tag) ? ' active' : ''}`}
                      onClick={() => toggleTag(tag, crowdTags, setCrowdTags)}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
                {crowdTags.includes('Other') && (
                  <input
                    type="text"
                    className="rf-input"
                    placeholder="Describe the crowd"
                    maxLength={50}
                    value={customCrowd}
                    onChange={(e) => setCustomCrowd(e.target.value)}
                    style={{ marginTop: '10px' }}
                  />
                )}
              </div>

              <div className="rf-group">
                <label className="rf-label">
                  Cover Charge <span className="rf-required">*</span>
                </label>
                <div className="chip-row">
                  <button
                    type="button"
                    className={`chip${hasCover === true ? ' active' : ''}`}
                    onClick={() => setHasCover(hasCover === true ? null : true)}
                  >
                    Yes
                  </button>
                  <button
                    type="button"
                    className={`chip${hasCover === false ? ' active' : ''}`}
                    onClick={() => setHasCover(hasCover === false ? null : false)}
                  >
                    No
                  </button>
                </div>
                {hasCover && (
                  <input
                    type="number"
                    className="rf-input"
                    placeholder="Amount (e.g. 20)"
                    min="0"
                    step="0.01"
                    value={coverAmount}
                    onChange={(e) => setCoverAmount(e.target.value)}
                    style={{ marginTop: '10px' }}
                  />
                )}
              </div>

              <div className="rf-group">
                <label className="rf-label">
                  Would You Return? <span className="rf-required">*</span>
                </label>
                <div className="chip-row">
                  <button
                    type="button"
                    className={`chip${wouldGoBack === true ? ' active' : ''}`}
                    onClick={() => setWouldGoBack(wouldGoBack === true ? null : true)}
                  >
                    Yes
                  </button>
                  <button
                    type="button"
                    className={`chip${wouldGoBack === false ? ' active' : ''}`}
                    onClick={() => setWouldGoBack(wouldGoBack === false ? null : false)}
                  >
                    No
                  </button>
                </div>
              </div>

              <div className="rf-group">
                <label className="rf-label">Comment</label>
                <textarea
                  className="rf-textarea"
                  placeholder="Share your experience… (optional)"
                  maxLength={280}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  rows={3}
                />
                <div className="rf-char">{comment.length} / 280</div>
              </div>

              <div className="rf-group">
                <label className="rf-label">Photos / Videos</label>
                {media.length > 0 && (
                  <div className="media-preview-grid">
                    {media.map((m, i) => (
                      <div key={m.url} className="media-preview">
                        {m.kind === 'image' ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={m.url} alt="" className="media-preview-thumb" />
                        ) : (
                          <video src={m.url} className="media-preview-thumb" muted />
                        )}
                        {m.kind === 'video' && <span className="media-preview-badge">▶</span>}
                        <button
                          type="button"
                          className="media-preview-remove"
                          onClick={() => removeMedia(i)}
                          aria-label="Remove"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                {media.length < MAX_FILES && (
                  <label className="media-add-btn">
                    + Add photos or videos
                    <input
                      type="file"
                      accept="image/*,video/*"
                      multiple
                      hidden
                      onChange={(e) => {
                        addFiles(e.target.files);
                        e.target.value = '';
                      }}
                    />
                  </label>
                )}
                <div className="rf-char">
                  {media.length} / {MAX_FILES} · videos up to {MAX_VIDEO_SECONDS}s
                </div>
              </div>

              {error && <p className="rf-error">{error}</p>}

              <button type="submit" className="rf-submit" disabled={submitting}>
                {uploadPct !== null
                  ? `Uploading… ${uploadPct}%`
                  : submitting
                    ? 'Submitting…'
                    : 'Submit Rating'}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
