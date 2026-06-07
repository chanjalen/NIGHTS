import type { MetadataRoute } from 'next';

// Allow crawling only on the production deployment. Vercel sets VERCEL_ENV to
// 'production' solely for the production branch (main); preview builds (develop ->
// dev.findyournights.com) get 'preview', so dev/preview are disallowed. Local
// dev (undefined) is treated as non-prod too.
export default function robots(): MetadataRoute.Robots {
  const isProd = process.env.VERCEL_ENV === 'production';
  return {
    rules: { userAgent: '*', ...(isProd ? { allow: '/' } : { disallow: '/' }) },
  };
}
