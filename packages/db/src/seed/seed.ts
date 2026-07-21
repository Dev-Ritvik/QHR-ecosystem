import { createProjectionClient } from '../client-projection';
import { projectsPub, unitsPub, geometryPub, poisPub, mediaManifests } from '../schema/projection';
import { config } from 'dotenv';
import path from 'path';

config({ path: path.resolve(__dirname, '../../.env') });

async function seed() {
  // GUARD: this script DELETES and replaces projection data. It must never
  // default to the production connection strings (DATABASE_URL_MIGRATIONS /
  // DATABASE_URL). Seeding requires an explicit, dedicated target.
  const seedUrl = process.env.DATABASE_URL_SEED;
  if (!seedUrl || seedUrl.includes('<')) {
    console.error(
      'Refusing to seed: set DATABASE_URL_SEED in packages/db/.env to a ' +
        'dedicated seed/staging database (a postgres-role URL — the table ' +
        'owner bypasses RLS for seeding without disabling it).',
    );
    process.exit(1);
  }
  const db = createProjectionClient(seedUrl);

  console.log('Seeding demo dataset...');

  // NOTE: no ALTER TABLE ... DISABLE ROW LEVEL SECURITY here. The seed
  // connects as the postgres role (table owner), which bypasses non-FORCE
  // RLS natively — policies stay intact for projection_reader/crm_app.

  // Clean existing
  await db.delete(unitsPub);
  await db.delete(projectsPub);

  // 3 Projects
  const p1 = '11111111-1111-1111-1111-111111111111';
  const p2 = '22222222-2222-2222-2222-222222222222';
  const p3 = '33333333-3333-3333-3333-333333333333';

  await db.insert(projectsPub).values([
    {
      projectId: p1,
      slug: 'test-project',
      name: 'Test Project',
      assetClass: 'land',
      narrative: 'A test project narrative.',
      locality: 'Locality',
      city: 'City',
      totalUnits: 100,
      availableUnits: 50,
      priceVisibility: 'public',
      heroUrl: 'https://example.com/hero.jpg',
      publishedAt: new Date(),
    },
    {
      projectId: p2,
      slug: 'luxury-villas',
      name: 'Luxury Villas',
      assetClass: 'luxury_residential',
      narrative: 'Luxury living.',
      locality: 'Westside',
      city: 'City',
      totalUnits: 50,
      availableUnits: 10,
      priceVisibility: 'public',
      heroUrl: 'https://example.com/hero2.jpg',
      publishedAt: new Date(),
    },
    {
      projectId: p3,
      slug: 'budget-apartments',
      name: 'Budget Apartments',
      assetClass: 'commercial',
      narrative: 'Affordable homes.',
      locality: 'Eastside',
      city: 'City',
      totalUnits: 50,
      availableUnits: 50,
      priceVisibility: 'on_request',
      heroUrl: 'https://example.com/hero3.jpg',
      publishedAt: new Date(),
    }
  ]);

  // Generate ~200 units for Test Project
  const units = [];
  for (let i = 1; i <= 200; i++) {
    units.push({
      unitId: `00000000-0000-0000-0000-${i.toString().padStart(12, '0')}`,
      projectId: p1,
      unitNumber: `${100 + i}`,
      presentationStatus: i % 2 === 0 ? 'available' : 'sold' as any,
      priceOnRequest: false,
      pricePaise: 1000000000n, // 1 crore
      areaSqYd: 100 + (i % 50),
    });
  }

  await db.insert(unitsPub).values(units);

  console.log('Seed completed successfully!');
  process.exit(0);
}

seed().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});
