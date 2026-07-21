// apps/crm/src/server/publish.ts
import { eq, and, isNull, inArray, sql } from 'drizzle-orm';
import { DbType, CoreTransaction } from '@estate/db/client-core';
import { projects, units, unitLandDetails, unitCommercialDetails, unitLuxuryDetails, geometryVersions, unitGeometries, pois, media } from '@estate/db';
import { projectsPub, unitsPub, geometryPub, poisPub, mediaManifests } from '@estate/db';
import { getPresentationLabel } from '@estate/domain/unit-status/presentation-label';

export type PublishChecklist = {
  hero: string | null;
  narrative: string | null;
  geometry: string | null;
  pricing: string | null;
  approval: string | null;
};

export type PublishResult = 
  | { ok: true }
  | { ok: false; code: 'VALIDATION_FAILED'; checklist: PublishChecklist }
  | { ok: false; code: 'PERSIST_FAILED'; message: string };

/**
 * Validates the core project state against the FR-C28 publish gate rules.
 * Returns a complete checklist with errors for missing required projection fields.
 */
export async function checkPublishReadiness(db: DbType, projectId: string): Promise<{ ok: boolean, checklist: PublishChecklist }> {
  const project = await db.query.projects.findFirst({ where: eq(projects.id, projectId) });
  if (!project) throw new Error("Project not found");

  const checklist: PublishChecklist = {
    hero: null,
    narrative: null,
    geometry: null,
    pricing: null,
    approval: null,
  };

  const hero = await db.query.media.findFirst({
    where: and(eq(media.projectId, projectId), isNull(media.unitId), eq(media.kind, 'hero'))
  });
  if (!hero) checklist.hero = "A hero image is required.";

  if (!project.narrative || project.narrative.trim().length === 0) {
    checklist.narrative = "Project narrative text is required.";
  }

  // Geometry is OPTIONAL since the digitizer feature was removed (2026-07-19):
  // projects publish without plot geometry; when an active version exists its
  // unit polygons still project to the public map as before.

  if (project.assetClass === 'land') {
    if (!project.layoutType || !project.approvalNumber?.trim()) {
      checklist.approval = "Layout type and approval number are required for land projects.";
    }
  }
  // Non-land: RERA is OPTIONAL for publishing (owner decision 2026-07-18 —
  // luxury projects on Panchayat/Farmlands/Private Land layouts are common
  // and have no RERA registration). When present, rera_number still renders
  // as a badge on the public site.

  const projectUnits = await db.select().from(units).where(and(eq(units.projectId, projectId), isNull(units.archivedAt)));
  if (project.priceVisibility === 'public') {
    const missingPrice = projectUnits.some(u => !u.computedPricePaise && !u.overridePricePaise);
    if (missingPrice) {
      checklist.pricing = "Price visibility is public, but some units have no price. Set prices or change visibility to 'Price on Request'.";
    }
  }

  const ok = !Object.values(checklist).some(v => v !== null);
  return { ok, checklist };
}

/**
 * Pings the public site's webhook to invalidate the static rendering cache for the project.
 */
async function callRevalidate(projectSlug: string) {
  const url = process.env.PUBLIC_REVALIDATE_URL;
  const secret = process.env.PUBLIC_REVALIDATE_SECRET;
  if (url && secret) {
    try {
      await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${secret}`
        },
        body: JSON.stringify({ tag: `project-${projectSlug}` })
      });
    } catch (e) {
      console.error('Failed to revalidate public site:', e);
    }
  }
}

/**
 * Transforms core entities into denormalized projection tables (ADR-002, §4.3).
 * Must be executed inside a single transaction to prevent partial projection updates.
 */
export async function publishProject(db: DbType, projectId: string): Promise<PublishResult> {
  const { ok, checklist } = await checkPublishReadiness(db, projectId);
  if (!ok) {
    return { ok: false, code: 'VALIDATION_FAILED', checklist };
  }

  try {
    await db.transaction(async (tx: CoreTransaction) => {
      const project = await tx.query.projects.findFirst({ where: eq(projects.id, projectId) });
      if (!project) throw new Error("Project not found");

      const activeGeom = await tx.query.geometryVersions.findFirst({
        where: and(eq(geometryVersions.projectId, projectId), eq(geometryVersions.status, 'active'))
      });

      const projectUnits = await tx.select().from(units).where(and(eq(units.projectId, projectId), isNull(units.archivedAt)));
      
      let landDetails: any[] = [];
      let commDetails: any[] = [];
      let luxDetails: any[] = [];

      if (projectUnits.length > 0) {
        const unitIds = projectUnits.map(u => u.id);
        if (project.assetClass === 'land') {
          landDetails = await tx.select().from(unitLandDetails).where(inArray(unitLandDetails.unitId, unitIds));
        } else if (project.assetClass === 'commercial') {
          commDetails = await tx.select().from(unitCommercialDetails).where(inArray(unitCommercialDetails.unitId, unitIds));
        } else if (project.assetClass === 'luxury_residential') {
          luxDetails = await tx.select().from(unitLuxuryDetails).where(inArray(unitLuxuryDetails.unitId, unitIds));
        }
      }

      const projectMedia = await tx.select().from(media).where(eq(media.projectId, projectId));
      const projectPois = await tx.select().from(pois).where(and(eq(pois.projectId, projectId), isNull(pois.archivedAt)));

      let bbox: [number, number, number, number] | null = null;
      if (activeGeom) {
        // Derive BBOX from the unit geometry features via PostGIS directly
        // PostGIS lives in the extensions schema, which is NOT on crm_app's
        // search_path — the function must be schema-qualified (geom is
        // already a geometry column; no cast needed).
        const res = await tx.execute(sql`SELECT extensions.ST_Extent(geom) as ext FROM ${unitGeometries} WHERE geometry_version_id = ${activeGeom.id}`);
        const extStr = res[0]?.ext as string | undefined;
        if (extStr && extStr.startsWith('BOX(')) {
          const match = extStr.match(/BOX\(([-\d.]+) ([-\d.]+),\s*([-\d.]+) ([-\d.]+)\)/);
          if (match) {
            bbox = [
              parseFloat(match[1]),
              parseFloat(match[2]),
              parseFloat(match[3]),
              parseFloat(match[4]),
            ];
          }
        }
      }

      const availabilityPct = projectUnits.length > 0 
        ? (projectUnits.filter(u => u.status === 'available').length / projectUnits.length) * 100 
        : 0;

      const totalUnits = projectUnits.length;
      const availableUnits = projectUnits.filter(u => u.status === 'available').length;

      const badges: Array<{label: string, value: string}> = [];
      if (project.assetClass === 'land' && project.layoutType && project.approvalNumber) {
        badges.push({ label: `${project.layoutType.replace(/_/g, ' ').toUpperCase()} LP No.`, value: project.approvalNumber });
      } else if (project.reraNumber) {
        badges.push({ label: 'RERA No.', value: project.reraNumber });
      }

      // 1. CLEAR existing projection data (flush and replace)
      await tx.delete(mediaManifests).where(eq(mediaManifests.projectId, projectId));
      await tx.delete(poisPub).where(eq(poisPub.projectId, projectId));
      await tx.delete(geometryPub).where(eq(geometryPub.projectId, projectId));
      await tx.delete(unitsPub).where(eq(unitsPub.projectId, projectId));
      await tx.delete(projectsPub).where(eq(projectsPub.projectId, projectId));

      // 2. INSERT projectsPub
      const heroUrl = (projectMedia.find(m => m.kind === 'hero' && !m.unitId)?.variants as any)?.web?.url || '';
      await tx.insert(projectsPub).values({
        projectId: project.id,
        slug: project.slug,
        name: project.name,
        assetClass: project.assetClass as any,
        narrative: project.narrative!,
        locality: project.locality,
        city: project.city,
        badges,
        amenities: project.amenities,
        totalUnits,
        availableUnits,
        priceVisibility: project.priceVisibility,
        heroUrl,
        centroid: project.centroid,
        bbox,
        publishedAt: new Date(),
      });

      // 3. INSERT unitsPub
      if (projectUnits.length > 0) {
        const unitsPubVals = projectUnits.map(u => {
          const isPriceOnRequest = project.priceVisibility === 'on_request';
          const price = isPriceOnRequest ? null : (u.overridePricePaise ?? u.computedPricePaise);
          
          const classDetails: Array<{label: string, value: string}> = [];
          if (project.assetClass === 'land') {
            const d = landDetails.find(x => x.unitId === u.id);
            if (d) {
              classDetails.push({ label: 'Survey No.', value: d.surveyNumber });
              if (d.subdivisionLineage) classDetails.push({ label: 'Subdivision', value: d.subdivisionLineage });
              if (d.approvalAuthority) classDetails.push({ label: 'Approval', value: `${d.approvalAuthority.toUpperCase()} - ${d.approvalNumber || ''}` });
            }
          } else if (project.assetClass === 'commercial') {
            const d = commDetails.find(x => x.unitId === u.id);
            if (d) {
              if (d.carpetAreaSqFt) classDetails.push({ label: 'Carpet Area', value: `${d.carpetAreaSqFt} sq ft` });
              if (d.reraNumber) classDetails.push({ label: 'RERA No.', value: d.reraNumber });
            }
          } else if (project.assetClass === 'luxury_residential') {
            const d = luxDetails.find(x => x.unitId === u.id);
            if (d) {
              if (d.configuration) classDetails.push({ label: 'Configuration', value: d.configuration });
              if (d.possessionStatus) classDetails.push({ label: 'Possession', value: d.possessionStatus.replace(/_/g, ' ') });
            }
          }

          let presentationStatus = u.status;
          try {
            // @ts-expect-error Domain logic mapping
            presentationStatus = getPresentationLabel(u.status as any, availabilityPct, project.sellingFastThresholdPct, false) as any;
          } catch {
            presentationStatus = (u.status === 'registered' ? 'booked' : u.status) as any;
          }

          return {
            unitId: u.id,
            projectId: project.id,
            unitNumber: u.unitNumber,
            presentationStatus: presentationStatus as any,
            facing: u.facing?.replace(/_/g, ' '),
            isCorner: u.isCorner,
            roadWidthM: u.roadWidthM,
            areaSqYd: u.areaSqYd,
            areaSqFt: u.areaSqFt,
            dimensionsLabel: u.dimensionsLabel,
            classDetails,
            pricePaise: price,
            priceOnRequest: isPriceOnRequest,
            priceVersionId: u.priceVersionId,
          };
        });
        await tx.insert(unitsPub).values(unitsPubVals);
      }

      // 4. INSERT geometryPub
      if (activeGeom) {
        const unitGeoms = await tx.select().from(unitGeometries).where(eq(unitGeometries.geometryVersionId, activeGeom.id));
        const geomPubVals: any[] = [];
        
        if (activeGeom.boundaryGeom) {
          geomPubVals.push({
            projectId: project.id,
            featureType: 'boundary' as const,
            geom: activeGeom.boundaryGeom,
            properties: {},
            geometryVersionId: activeGeom.id,
          });
        }

        for (const ug of unitGeoms) {
          const u = projectUnits.find(x => x.id === ug.unitId);
          if (u) {
            geomPubVals.push({
              projectId: project.id,
              unitId: u.id,
              featureType: 'plot' as const,
              geom: ug.geom,
              properties: {
                plotNumber: u.unitNumber,
                edges: ug.edgeData,
                facing: u.facing
              },
              geometryVersionId: activeGeom.id,
            });
          }
        }

        if (geomPubVals.length > 0) {
          await tx.insert(geometryPub).values(geomPubVals);
        }
      }

      // 5. INSERT poisPub
      if (projectPois.length > 0) {
        const poisPubVals = projectPois.map(p => ({
          poiId: p.id,
          projectId: project.id,
          name: p.name,
          category: p.category.replace(/_/g, ' '),
          location: p.location,
          distanceM: p.distanceOverrideM ?? p.distanceM ?? 0,
          driveTimeMin: p.driveTimeOverrideMin ?? p.driveTimeMin,
          sortOrder: p.sortOrder,
        }));
        await tx.insert(poisPub).values(poisPubVals);
      }

      // 6. INSERT mediaManifests
      if (projectMedia.length > 0) {
        const mediaVals = projectMedia.map(m => ({
          id: m.id,
          projectId: project.id,
          unitId: m.unitId,
          kind: m.kind as any,
          altText: m.altText || project.name,
          sortOrder: m.sortOrder,
          variants: m.variants,
        }));
        await tx.insert(mediaManifests).values(mediaVals);
      }

      // 7. UPDATE core project publishedAt
      await tx.update(projects).set({ publishedAt: new Date() }).where(eq(projects.id, project.id));
    });

    // Fire off ISR flush asynchronously outside the transaction
    const projectSlug = await db.query.projects.findFirst({
      where: eq(projects.id, projectId),
      columns: { slug: true }
    });
    
    if (projectSlug) {
      await callRevalidate(projectSlug.slug);
    }

    return { ok: true };
  } catch (error) {
    console.error('Failed to publish project:', error);
    return { ok: false, code: 'PERSIST_FAILED', message: error instanceof Error ? error.message : 'Unknown error during publish' };
  }
}
