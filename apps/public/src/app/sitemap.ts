import { MetadataRoute } from 'next';
import { db } from '@/lib/projection';
import { projectsPub, unitsPub } from '@estate/db/src/schema/projection';
import { eq } from 'drizzle-orm';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://example.com';
  
  // Fetch projects
  const projects = await db.select({
    id: projectsPub.projectId,
    slug: projectsPub.slug,
    updatedAt: projectsPub.updatedAt,
  }).from(projectsPub);
  
  // Fetch units mapped to project slugs
  const units = await db.select({
    projectSlug: projectsPub.slug,
    unitNumber: unitsPub.unitNumber,
    updatedAt: unitsPub.updatedAt,
  })
  .from(unitsPub)
  .innerJoin(projectsPub, eq(unitsPub.projectId, projectsPub.projectId));

  const sitemap: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
  ];

  for (const project of projects) {
    sitemap.push({
      url: `${baseUrl}/projects/${project.slug}`,
      lastModified: project.updatedAt || new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    });
  }

  for (const unit of units) {
    const unitSlug = encodeURIComponent(unit.unitNumber.toLowerCase().replace(/\s+/g, '-'));
    sitemap.push({
      url: `${baseUrl}/projects/${unit.projectSlug}/${unitSlug}`,
      lastModified: unit.updatedAt || new Date(),
      changeFrequency: 'daily',
      priority: 0.6,
    });
  }

  return sitemap;
}
