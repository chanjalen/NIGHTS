import { City, Venue, VenueDetail, Rating } from '@/types';

// API_URL is server-side only (Docker internal: http://api:8000).
// NEXT_PUBLIC_API_URL is used in the browser (http://localhost:8000).
const BASE_URL =
  process.env.API_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  'http://localhost:8000';

const defaultOptions: RequestInit = { cache: 'no-store' };

type MaybePagedResponse<T> = T[] | { results: T[] };

function unwrap<T>(data: MaybePagedResponse<T>): T[] {
  return Array.isArray(data) ? data : (data.results ?? []);
}

export interface CityStats {
  venue_count: number;
  avg_rating: number | null;
  active_checkin_count: number;
  neighborhoods: string[];
}

export interface VenuePage {
  venues: Venue[];
  count: number;
  hasNext: boolean;
}

export async function getCities(): Promise<City[]> {
  const res = await fetch(`${BASE_URL}/api/v1/cities/`, defaultOptions);
  if (!res.ok) throw new Error(`Failed to fetch cities: ${res.status}`);
  return unwrap<City>(await res.json());
}

export async function getCityBySlug(slug: string): Promise<City | null> {
  const res = await fetch(`${BASE_URL}/api/v1/cities/${slug}/`, defaultOptions);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Failed to fetch city: ${res.status}`);
  return res.json();
}

export async function getCityStats(slug: string): Promise<CityStats> {
  const res = await fetch(`${BASE_URL}/api/v1/cities/${slug}/stats/`, defaultOptions);
  if (!res.ok) throw new Error(`Failed to fetch city stats: ${res.status}`);
  return res.json();
}

export interface VenueFilters {
  search?: string;
  neighborhood?: string;
  music_tag?: string[];
  crowd_tag?: string[];
  price_level?: number[];
  min_rating?: number;
  cover?: 'yes' | 'no';
}

export function buildVenueQuery(citySlug: string, page = 1, filters: VenueFilters = {}): string {
  const p = new URLSearchParams({ city: citySlug, page: String(page) });
  if (filters.search?.trim()) p.set('search', filters.search.trim());
  if (filters.neighborhood) p.set('neighborhood', filters.neighborhood);
  (filters.music_tag ?? []).forEach((t) => p.append('music_tag', t));
  (filters.crowd_tag ?? []).forEach((t) => p.append('crowd_tag', t));
  (filters.price_level ?? []).forEach((n) => p.append('price_level', String(n)));
  if (filters.min_rating) p.set('min_rating', String(filters.min_rating));
  if (filters.cover) p.set('cover', filters.cover);
  return p.toString();
}

export async function getVenuesPage(
  citySlug: string,
  page = 1,
  filters: VenueFilters = {}
): Promise<VenuePage> {
  const res = await fetch(
    `${BASE_URL}/api/v1/venues/?${buildVenueQuery(citySlug, page, filters)}`,
    defaultOptions
  );
  if (!res.ok) throw new Error(`Failed to fetch venues: ${res.status}`);
  const data = await res.json();
  return {
    venues: data.results ?? [],
    count: data.count ?? 0,
    hasNext: !!data.next,
  };
}

export async function getVenue(id: string): Promise<VenueDetail> {
  const res = await fetch(`${BASE_URL}/api/v1/venues/${id}/`, defaultOptions);
  if (!res.ok) throw new Error(`Failed to fetch venue: ${res.status}`);
  return res.json();
}

export async function getRatings(venueId: string): Promise<Rating[]> {
  // Forward the caller's session cookie so the API can flag the user's own
  // rating (is_own). Ratings are otherwise anonymous. Server-only import:
  // getRatings is called from server components.
  const { cookies } = await import('next/headers');
  const cookieHeader = cookies().toString();
  const res = await fetch(`${BASE_URL}/api/v1/ratings/?venue=${venueId}`, {
    ...defaultOptions,
    headers: cookieHeader ? { Cookie: cookieHeader } : {},
  });
  if (!res.ok) throw new Error(`Failed to fetch ratings: ${res.status}`);
  return unwrap<Rating>(await res.json());
}
