// apps/public/src/lib/projection.ts
import { eq, sql } from 'drizzle-orm';
import { createProjectionClient } from '@estate/db/client-projection';
import { projectsPub, unitsPub, geometryPub, poisPub, mediaManifests } from '@estate/db/src/schema/projection';

export const db = createProjectionClient(process.env.DATABASE_URL!);

export async function getPublishedProjects() {
  return db.select().from(projectsPub);
}

export async function getProjects() {
  const data = await db.select().from(projectsPub);
  return data;
}

export async function getProjectBySlug(slug: string) {
  const [project] = await db.select().from(projectsPub).where(eq(projectsPub.slug, slug));
  return project || null;
}

export async function getUnitsByProjectId(projectId: string) {
  const data = await db.select().from(unitsPub).where(eq(unitsPub.projectId, projectId));
  return data;
}

export async function getGeometryByProjectId(projectId: string) {
  return db.select().from(geometryPub).where(eq(geometryPub.projectId, projectId));
}

export async function getMediaByProjectId(projectId: string) {
  return db.select().from(mediaManifests).where(eq(mediaManifests.projectId, projectId));
}

export async function getPoisByProjectId(projectId: string) {
  return db
    .select()
    .from(poisPub)
    .where(eq(poisPub.projectId, projectId))
    .orderBy(poisPub.sortOrder);
}

// ───────────────────────────────────────────────────────────────────────────
// Marketing-site readers (2026-07-20). Additive — everything above is the
// presentation-mode contract and is intentionally untouched.
//
// Conventions (see BACKEND_CONTRACT_FINAL.md):
// - bigint money columns are cast to ::text in SQL and surface as
//   `string | null` (paise). Never parseFloat them; BigInt(value) is safe.
// - All PostGIS calls are schema-qualified `extensions.*` (migration 0020
//   grants projection_reader USAGE on that schema).
// - Geometry is serialized server-side to GeoJSON via ST_AsGeoJSON — raw
//   WKB never crosses into components.
// ───────────────────────────────────────────────────────────────────────────

export interface ProjectUnitSummary {
  projectId: string;
  slug: string;
  name: string;
  assetClass: 'land' | 'commercial' | 'luxury_residential';
  unitCount: number;
  availableCount: number;
  /** min/max over priced units only (paise, stringified bigint); null when every unit is price-on-request or none priced */
  minPricePaise: string | null;
  maxPricePaise: string | null;
  /** true when at least one unit hides its price */
  hasPriceOnRequest: boolean;
  minAreaSqYd: number | null;
  maxAreaSqYd: number | null;
  minAreaSqFt: number | null;
  maxAreaSqFt: number | null;
}

/** Per-project aggregates for Start Here / listing cards. One row per published project. */
export async function getProjectUnitSummaries(): Promise<ProjectUnitSummary[]> {
  const rows = await db.execute(sql`
    SELECT
      p.project_id                                   AS "projectId",
      p.slug                                         AS "slug",
      p.name                                         AS "name",
      p.asset_class                                  AS "assetClass",
      count(u.unit_id)::int                          AS "unitCount",
      count(u.unit_id) FILTER (WHERE u.presentation_status IN ('available','selling_fast'))::int
                                                     AS "availableCount",
      min(u.price_paise) FILTER (WHERE NOT u.price_on_request)::text
                                                     AS "minPricePaise",
      max(u.price_paise) FILTER (WHERE NOT u.price_on_request)::text
                                                     AS "maxPricePaise",
      bool_or(u.price_on_request)                    AS "hasPriceOnRequest",
      min(u.area_sq_yd)::float8                      AS "minAreaSqYd",
      max(u.area_sq_yd)::float8                      AS "maxAreaSqYd",
      min(u.area_sq_ft)::float8                      AS "minAreaSqFt",
      max(u.area_sq_ft)::float8                      AS "maxAreaSqFt"
    FROM projection.projects_pub p
    LEFT JOIN projection.units_pub u ON u.project_id = p.project_id
    GROUP BY p.project_id, p.slug, p.name, p.asset_class
    ORDER BY p.name
  `);
  return rows as unknown as ProjectUnitSummary[];
}

export interface PublishedUnitRow {
  unitId: string;
  projectId: string;
  projectSlug: string;
  projectName: string;
  locality: string | null;
  city: string | null;
  assetClass: 'land' | 'commercial' | 'luxury_residential';
  unitNumber: string;
  presentationStatus: 'available' | 'selling_fast' | 'on_hold' | 'booked' | 'sold' | 'not_for_sale';
  facing: string | null;
  isCorner: boolean;
  roadWidthM: number | null;
  areaSqYd: number | null;
  areaSqFt: number | null;
  dimensionsLabel: string | null;
  classDetails: Array<{ label: string; value: string }>;
  /** paise, stringified bigint; null when priceOnRequest */
  pricePaise: string | null;
  priceOnRequest: boolean;
}

/** Every unit across every published project — the /properties browser. */
export async function getAllPublishedUnits(): Promise<PublishedUnitRow[]> {
  const rows = await db.execute(sql`
    SELECT
      u.unit_id             AS "unitId",
      u.project_id          AS "projectId",
      p.slug                AS "projectSlug",
      p.name                AS "projectName",
      p.locality            AS "locality",
      p.city                AS "city",
      p.asset_class         AS "assetClass",
      u.unit_number         AS "unitNumber",
      u.presentation_status AS "presentationStatus",
      u.facing              AS "facing",
      u.is_corner           AS "isCorner",
      u.road_width_m::float8 AS "roadWidthM",
      u.area_sq_yd::float8  AS "areaSqYd",
      u.area_sq_ft::float8  AS "areaSqFt",
      u.dimensions_label    AS "dimensionsLabel",
      u.class_details       AS "classDetails",
      u.price_paise::text   AS "pricePaise",
      u.price_on_request    AS "priceOnRequest"
    FROM projection.units_pub u
    JOIN projection.projects_pub p ON p.project_id = u.project_id
    ORDER BY p.name, u.unit_number
  `);
  return rows as unknown as PublishedUnitRow[];
}

export interface LocalityGroup {
  locality: string | null;
  city: string | null;
  projectCount: number;
  totalAvailableUnits: number;
  poiCount: number;
  projects: Array<{
    slug: string;
    name: string;
    assetClass: 'land' | 'commercial' | 'luxury_residential';
    availableUnits: number;
    heroUrl: string;
    /** GeoJSON Point { type:'Point', coordinates:[lng,lat] } or null */
    centroid: { type: 'Point'; coordinates: [number, number] } | null;
  }>;
}

/** Projects grouped by (locality, city) for the /locations page. */
export async function getLocalities(): Promise<LocalityGroup[]> {
  const rows = await db.execute(sql`
    SELECT
      p.locality                                       AS "locality",
      p.city                                           AS "city",
      count(*)::int                                    AS "projectCount",
      sum(p.available_units)::int                      AS "totalAvailableUnits",
      (SELECT count(*)::int
         FROM projection.pois_pub poi
         JOIN projection.projects_pub p2 ON p2.project_id = poi.project_id
        WHERE p2.locality IS NOT DISTINCT FROM p.locality
          AND p2.city IS NOT DISTINCT FROM p.city)   AS "poiCount",
      json_agg(json_build_object(
        'slug', p.slug,
        'name', p.name,
        'assetClass', p.asset_class,
        'availableUnits', p.available_units,
        'heroUrl', p.hero_url,
        'centroid', extensions.ST_AsGeoJSON(p.centroid)::json
      ) ORDER BY p.name)                               AS "projects"
    FROM projection.projects_pub p
    GROUP BY p.locality, p.city
    ORDER BY p.city NULLS LAST, p.locality NULLS LAST
  `);
  return rows as unknown as LocalityGroup[];
}

export interface SiteMediaRow {
  id: string;
  projectId: string;
  projectSlug: string;
  projectName: string;
  unitId: string | null;
  kind: 'hero' | 'gallery' | 'plan' | 'og_image';
  altText: string;
  sortOrder: number;
  variants: {
    presentation_4k?: { url: string; width: number; height: number };
    web?: { url: string; width: number; height: number };
    thumb?: { url: string; width: number; height: number };
  };
}

/** All media across published projects — /gallery and /downloads (kind='plan'). */
export async function getAllMedia(): Promise<SiteMediaRow[]> {
  const rows = await db.execute(sql`
    SELECT
      m.id          AS "id",
      m.project_id  AS "projectId",
      p.slug        AS "projectSlug",
      p.name        AS "projectName",
      m.unit_id     AS "unitId",
      m.kind        AS "kind",
      m.alt_text    AS "altText",
      m.sort_order  AS "sortOrder",
      m.variants    AS "variants"
    FROM projection.media_manifests m
    JOIN projection.projects_pub p ON p.project_id = m.project_id
    ORDER BY p.name, m.kind, m.sort_order
  `);
  return rows as unknown as SiteMediaRow[];
}

export interface ProjectMapData {
  /** GeoJSON Point or null — real map centre (never [0,0]) */
  centroid: { type: 'Point'; coordinates: [number, number] } | null;
  /** [minLng, minLat, maxLng, maxLat] or null — currently null for all live projects */
  bbox: [number, number, number, number] | null;
  /** Ready-to-use GeoJSON FeatureCollection features (plots carry presentationStatus/plotNumber) */
  features: Array<{
    type: 'Feature';
    id: string;
    geometry: Record<string, unknown>;
    properties: Record<string, unknown> & {
      featureType: 'plot' | 'boundary' | 'road' | 'amenity' | 'massing';
      unitId?: string | null;
      plotNumber?: string | null;
      presentationStatus?: string | null;
    };
  }>;
  /** GeoJSON point features for POI markers, ordered by sortOrder */
  pois: Array<{
    type: 'Feature';
    id: string;
    geometry: { type: 'Point'; coordinates: [number, number] };
    properties: {
      name: string;
      category: string;
      distanceM: number;
      driveTimeMin: number | null;
      sortOrder: number;
    };
  }>;
}

/**
 * Everything the site map needs, serialized server-side to GeoJSON via
 * extensions.ST_AsGeoJSON — fixes the raw-WKB-into-MapLibre defect. When
 * `features` is empty (geometry_pub currently has 0 rows for every live
 * project) the map is a location/connectivity view: centroid + POIs only.
 */
export async function getProjectMapData(projectId: string): Promise<ProjectMapData> {
  const [projRows, geomRows, poiRows] = await Promise.all([
    db.execute(sql`
      SELECT extensions.ST_AsGeoJSON(centroid)::json AS "centroid", bbox AS "bbox"
      FROM projection.projects_pub WHERE project_id = ${projectId}
    `),
    db.execute(sql`
      SELECT
        g.id                                    AS "id",
        g.unit_id                               AS "unitId",
        g.feature_type                          AS "featureType",
        extensions.ST_AsGeoJSON(g.geom)::json   AS "geometry",
        g.properties                            AS "properties",
        u.unit_number                           AS "plotNumber",
        u.presentation_status                   AS "presentationStatus"
      FROM projection.geometry_pub g
      LEFT JOIN projection.units_pub u ON u.unit_id = g.unit_id
      WHERE g.project_id = ${projectId}
    `),
    db.execute(sql`
      SELECT
        poi_id                                       AS "poiId",
        name, category,
        extensions.ST_AsGeoJSON(location)::json      AS "location",
        distance_m::float8                           AS "distanceM",
        drive_time_min::float8                       AS "driveTimeMin",
        sort_order::int                              AS "sortOrder"
      FROM projection.pois_pub
      WHERE project_id = ${projectId}
      ORDER BY sort_order
    `),
  ]);

  const proj = (projRows as unknown as Array<{ centroid: any; bbox: any }>)[0];

  return {
    centroid: proj?.centroid ?? null,
    bbox: (proj?.bbox as ProjectMapData['bbox']) ?? null,
    features: (geomRows as unknown as any[]).map((g) => ({
      type: 'Feature' as const,
      id: g.id,
      geometry: g.geometry,
      properties: {
        ...(g.properties ?? {}),
        featureType: g.featureType,
        unitId: g.unitId,
        plotNumber: g.plotNumber,
        presentationStatus: g.presentationStatus,
      },
    })),
    pois: (poiRows as unknown as any[]).map((p) => ({
      type: 'Feature' as const,
      id: p.poiId,
      geometry: p.location,
      properties: {
        name: p.name,
        category: p.category,
        distanceM: p.distanceM,
        driveTimeMin: p.driveTimeMin,
        sortOrder: p.sortOrder,
      },
    })),
  };
}
