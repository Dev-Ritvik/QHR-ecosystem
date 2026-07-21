import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

// Import all projection schema definitions
import * as projectsPub from './schema/projection/projects-pub';
import * as unitsPub from './schema/projection/units-pub';
import * as geometryPub from './schema/projection/geometry-pub';
import * as poisPub from './schema/projection/pois-pub';
import * as mediaManifests from './schema/projection/media-manifests';

export const projectionSchema = {
  ...projectsPub,
  ...unitsPub,
  ...geometryPub,
  ...poisPub,
  ...mediaManifests,
};

/**
 * Creates a Drizzle client authenticated as the `projection_reader` role.
 * Has SELECT access on the `projection` schema ONLY. Zero grants on `core`.
 * Used exclusively by apps/public.
 * Maps to NFR-S1 / ADR-002.
 */
export function createProjectionClient(connectionString: string) {
  const client = postgres(connectionString, { prepare: false });
  return drizzle(client, { schema: projectionSchema });
}
