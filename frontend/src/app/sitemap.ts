import type { MetadataRoute } from 'next';
import { getSitemapData } from '@/lib/api';
import { SITE_URL } from '@/lib/site';

// api.ts fetches are no-store, so this route is rendered per-request anyway;
// be explicit so a future caching change in api.ts doesn't freeze the sitemap
// at build time.
export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticEntries: MetadataRoute.Sitemap = [
    { url: SITE_URL, changeFrequency: 'daily', priority: 1 },
    { url: `${SITE_URL}/popular-cities`, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${SITE_URL}/about`, changeFrequency: 'monthly', priority: 0.3 },
    { url: `${SITE_URL}/privacy`, changeFrequency: 'yearly', priority: 0.1 },
  ];

  // If the API is unreachable, still serve the static pages rather than 500.
  const { cities, venues } = await getSitemapData().catch(() => ({
    cities: [],
    venues: [],
  }));

  const cityEntries: MetadataRoute.Sitemap = cities.map((slug) => ({
    url: `${SITE_URL}/city/${slug}`,
    changeFrequency: 'daily',
    priority: 0.8,
  }));

  const venueEntries: MetadataRoute.Sitemap = venues.map((venue) => ({
    url: `${SITE_URL}/city/${venue.city_slug}/${venue.id}`,
    changeFrequency: 'weekly',
    priority: 0.6,
  }));

  return [...staticEntries, ...cityEntries, ...venueEntries];
}
