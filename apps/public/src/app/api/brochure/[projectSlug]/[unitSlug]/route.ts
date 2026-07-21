// apps/public/src/app/api/brochure/[projectSlug]/[unitSlug]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { chromium } from 'playwright';
import { db } from '@/lib/projection';
import { projectsPub, unitsPub } from '@estate/db';
import { eq, and } from 'drizzle-orm';

/**
 * FR-W6 / NFR-D5: Serverless PDF generation for unit brochures.
 * Uses Playwright to render the unit detail page in print mode.
 * The output is cached at the edge indefinitely until the priceVersionId changes.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ projectSlug: string; unitSlug: string }> }
) {
  const { projectSlug, unitSlug } = await params;

  // 1. Verify unit exists and get price version for cache validation
  const results = await db
    .select({
      unitId: unitsPub.unitId,
      priceVersionId: unitsPub.priceVersionId,
    })
    .from(unitsPub)
    .innerJoin(projectsPub, eq(unitsPub.projectId, projectsPub.projectId))
    .where(
      and(
        eq(projectsPub.slug, projectSlug),
        eq(unitsPub.unitNumber, unitSlug)
      )
    )
    .limit(1);

  if (results.length === 0) {
    return NextResponse.json({ error: 'Unit not found' }, { status: 404 });
  }

  const unit = results[0];
  
  // 2. Setup rendering URL
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
  const targetUrl = `${baseUrl}/projects/${projectSlug}/${unitSlug}`;

  try {
    // 3. Launch headless browser
    const browser = await chromium.launch({
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      headless: true
    });

    const page = await browser.newPage();
    
    // Explicitly set media to print so Next.js/Tailwind resolves print variants before render
    await page.emulateMedia({ media: 'print' });
    
    // Wait for network to be idle to ensure MapLibre tiles and fonts have finished loading
    await page.goto(targetUrl, { waitUntil: 'networkidle' });

    // 4. Generate PDF
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '1cm', right: '1cm', bottom: '1cm', left: '1cm' }
    });

    await browser.close();

    // 5. Return PDF with aggressive edge caching based on price version (NFR-D5)
    return new NextResponse(pdfBuffer as any, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="Brochure-${projectSlug}-${unitSlug}.pdf"`,
        'Cache-Control': 'public, max-age=31536000, immutable',
        'ETag': `"${unit.priceVersionId || 'no-price'}"`
      }
    });
  } catch (error) {
    console.error('Brochure PDF generation failed:', error);
    return NextResponse.json({ error: 'Failed to generate brochure' }, { status: 500 });
  }
}
