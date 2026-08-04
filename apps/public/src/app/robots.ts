import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  // Same rule as sitemap.ts: never guess the origin. A robots.txt pointing at
  // example.com/sitemap.xml tells every crawler the site has no sitemap.
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (!baseUrl) {
    throw new Error('NEXT_PUBLIC_SITE_URL is not set; robots.txt cannot name the sitemap.');
  }

  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/api/', '/_next/'],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
