import { pgSchema } from 'drizzle-orm/pg-core';

export const projection = pgSchema('projection');

export const pubAssetClass = projection.enum('pub_asset_class', ['land', 'commercial', 'luxury_residential']);
export const pubPresentationStatus = projection.enum('pub_presentation_status', [
  'available', 'selling_fast', 'on_hold', 'booked', 'sold', 'not_for_sale',
]);
export const pubFeatureType = projection.enum('pub_feature_type', [
  'plot', 'boundary', 'road', 'amenity', 'massing',
]);
export const pubMediaKind = projection.enum('pub_media_kind', ['hero', 'gallery', 'plan', 'og_image']);
