// packages/db/src/seed/import-real-projects.ts
//
// Replaces the demo inventory with Quality Homes Reality's three real layouts.
//
// Run:  pnpm --filter @estate/db exec tsx src/seed/import-real-projects.ts
//
// ---------------------------------------------------------------------------
// Where the numbers come from
// ---------------------------------------------------------------------------
//
// Plot COUNTS are not invented and not copied from marketing material. They are
// the closed cells detected in the client's own approved layout sheets by
// tools/blender/make_holo3d.py, which are also the cells extruded into the 3D
// hall - so the website, the hologram and the CRM all count the same plots:
//
//   assets/floorplans/kartikeya_cells.json   113 plot
//   assets/floorplans/lucky_cells.json       118 plot + 63 plot_hot
//   assets/floorplans/gayatri_cells.json     113 plot
//
// `plot_hot` is the classifier's label for a plot the sheet has coloured in.
// Lucky Garden's sheet marks plot status that way. Which colour means sold and
// which means booked is in the sheet legend, which we have not transcribed, so
// those 63 are imported as `sold` rather than `available`.
//
// That direction is deliberate. Understating availability costs a phone call;
// overstating it means telling a buyer a plot is free when the client's own
// drawing says otherwise. Only one of those is recoverable.
//
// ---------------------------------------------------------------------------
// What is PROVISIONAL and must be replaced
// ---------------------------------------------------------------------------
//
// Plot NUMBERS are sequential 1..N. The sheets print real plot numbers, but the
// cell classifier reads geometry and never read them, so this numbering is a
// placeholder that happens to have the right cardinality. It must be replaced
// from the client's plot register before any agent quotes a plot number to a
// buyer. Nothing public exposes these - /properties publishes sizes only - so
// the exposure is limited to the CRM until then. Tracked in PROGRESS.md.
//
// Prices are absent by design: every project is `on_request`.

import { config } from 'dotenv';
import path from 'path';
import { sql } from 'drizzle-orm';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';

config({ path: path.resolve(__dirname, '../../.env') });

const url = process.env.DATABASE_URL_MIGRATIONS;
if (!url) {
  console.error('Set DATABASE_URL_MIGRATIONS in packages/db/.env');
  process.exit(1);
}

const client = postgres(url, { prepare: false });
const db = drizzle(client);

// Deterministic IDs so re-running replaces rather than duplicates.
const P = {
  kartikeya: '10000000-0000-4000-b000-000000000001',
  lucky: '10000000-0000-4000-b000-000000000002',
  gayatri: '10000000-0000-4000-b000-000000000003',
} as const;

interface PlotSpec {
  label: string; // dimensions as printed on the sheet
  sqYd: number;
  count: number;
}

interface ProjectSpec {
  id: string;
  slug: string;
  name: string;
  narrative: string;
  locality: string;
  city: string;
  state: string;
  layoutType: string;
  approvalNumber: string;
  reraNumber: string | null;
  amenities: string[];
  hero: string;
  plots: PlotSpec[];
  soldCount: number;
}

// 30x50 = 1500 sqft = 166.67 sqyd, etc. Sizes are printed on the approved
// plans; the mix per size is not, so the detected cell count is distributed
// across the published sizes rather than asserting a breakdown we cannot see.
const sqYd = (ft: number, ft2: number) => Math.round(((ft * ft2) / 9) * 100) / 100;

const PROJECTS: ProjectSpec[] = [
  {
    id: P.kartikeya,
    slug: 'kartikeya-water-front',
    name: 'Kartikeya Water Front',
    narrative:
      'An approved plotted layout at Poosapatirega in Vizianagaram district, laid out on 40-foot and 30-foot blacktop roads with street lighting and open space reserved to the sanctioned plan. Plots run from 30x50 to 30x60 feet.',
    locality: 'Poosapatirega',
    city: 'Vizianagaram',
    state: 'Andhra Pradesh',
    layoutType: 'vmrda',
    approvalNumber: 'VMRDA approved layout',
    reraNumber: null,
    amenities: ['40ft blacktop roads', '30ft internal roads', 'street lighting', 'underground drainage', 'avenue plantation'],
    hero: '/gallery/kartikeya-layout.jpg',
    plots: [
      { label: "30' x 50'", sqYd: sqYd(30, 50), count: 38 },
      { label: "30' x 56'", sqYd: sqYd(30, 56), count: 37 },
      { label: "30' x 60'", sqYd: sqYd(30, 60), count: 38 },
    ],
    soldCount: 0,
  },
  {
    id: P.lucky,
    slug: 'lucky-garden',
    name: 'Lucky Garden',
    narrative:
      'A plotted layout at Kumaram village near Garividi in Vizianagaram district, on 20-foot internal roads, with a future extension held to the west of the sanctioned area. Plots run 15x60 and 18x60 feet.',
    locality: 'Kumaram Village, Garividi',
    city: 'Vizianagaram',
    state: 'Andhra Pradesh',
    layoutType: 'panchayat',
    approvalNumber: 'See approval block on the sanctioned layout plan',
    reraNumber: null,
    amenities: ['20ft internal roads', 'demarcated plots', 'future extension reserved'],
    hero: '/gallery/lucky-garden-layout.jpg',
    plots: [
      { label: "15' x 60'", sqYd: sqYd(15, 60), count: 91 },
      { label: "18' x 60'", sqYd: sqYd(18, 60), count: 90 },
    ],
    soldCount: 63, // the status-coloured cells on the sheet
  },
  {
    id: P.gayatri,
    slug: 'vsr-gayatri-township',
    name: 'VSR Gayatri Township',
    narrative:
      'A SUDA-approved township layout at Bayyannapeta near Allinagaram in Srikakulam district, laid out on 40-foot internal roads throughout, with uniform 60x30 foot plots.',
    locality: 'Bayyannapeta, near Allinagaram',
    city: 'Srikakulam',
    state: 'Andhra Pradesh',
    layoutType: 'suda',
    approvalNumber: 'F.L.P. No. 10/2025/1178/DTCP/DPMS',
    reraNumber: null,
    amenities: ['40ft internal roads', 'SUDA approved', 'open space to sanctioned plan'],
    hero: '/gallery/gayatri-layout.jpg',
    plots: [{ label: "60' x 30'", sqYd: sqYd(60, 30), count: 113 }],
    soldCount: 0,
  },
];

async function main() {
  const keep = PROJECTS.map((p) => p.id);

  // -------------------------------------------------------------------------
  // 1. Remove the demo inventory
  // -------------------------------------------------------------------------
  // Deleting from core first: projection rows are a derived copy, so anything
  // left there without a core parent is unreachable by the publish pipeline and
  // would linger in the sitemap forever.
  const doomed = await db.execute(sql`
    SELECT id, slug FROM core.projects WHERE id NOT IN ${sql`(${sql.join(keep.map((k) => sql`${k}::uuid`), sql`, `)})`}
  `);
  if (doomed.length) {
    console.log('Removing demo projects:', doomed.map((r: any) => r.slug).join(', '));
  }

  // Refuse to delete anything a real person has transacted against. A project
  // with a booking is not obviously demo data, and dropping one silently could
  // take a payment record with it.
  //
  // Two separate gates, because they fail for different reasons:
  //
  //   * a ledger entry is money. There is no flag for that - the run stops and
  //     a human decides.
  //   * a booking with no ledger entry is a workflow artifact. Removing it is
  //     still a deletion, so it needs --delete-demo-bookings said out loud
  //     rather than being inferred from the absence of money.
  const ALLOW_BOOKING_DELETE = process.argv.includes('--delete-demo-bookings');

  for (const row of doomed as any[]) {
    const [c] = (await db.execute(sql`
      SELECT
        (SELECT count(*) FROM core.bookings b JOIN core.units u ON u.id = b.unit_id WHERE u.project_id = ${row.id}::uuid)::int AS bookings,
        (SELECT count(*) FROM core.holds h    JOIN core.units u ON u.id = h.unit_id  WHERE u.project_id = ${row.id}::uuid)::int AS holds,
        (SELECT count(*) FROM core.payment_ledger pl
           JOIN core.bookings b ON b.id = pl.booking_id
           JOIN core.units u ON u.id = b.unit_id
          WHERE u.project_id = ${row.id}::uuid)::int AS ledger
    `)) as any[];

    if (c.ledger > 0) {
      throw new Error(
        `Refusing to delete project ${row.slug}: ${c.ledger} payment ledger entr(ies) are attached to its ` +
          `bookings. That is money, and the ledger is append-only by design. Resolve this by hand.`,
      );
    }
    if ((c.bookings > 0 || c.holds > 0) && !ALLOW_BOOKING_DELETE) {
      throw new Error(
        `Refusing to delete project ${row.slug}: it has ${c.bookings} booking(s) and ${c.holds} hold(s), ` +
          `though no payment ledger entries. If these are development artifacts, re-run with ` +
          `--delete-demo-bookings.`,
      );
    }
  }

  await db.transaction(async (tx) => {
    const notOurs = sql`(${sql.join(keep.map((k) => sql`${k}::uuid`), sql`, `)})`;

    // Projection is a pure derived copy — safe to clear wholesale.
    await tx.execute(sql`DELETE FROM projection.media_manifests`);
    await tx.execute(sql`DELETE FROM projection.pois_pub`);
    await tx.execute(sql`DELETE FROM projection.geometry_pub`);
    await tx.execute(sql`DELETE FROM projection.units_pub`);
    await tx.execute(sql`DELETE FROM projection.projects_pub`);

    // Core, in dependency order. Only core.media, the three unit_*_details
    // tables and site_visit_leads cascade; everything else is ON DELETE NO
    // ACTION, so the order below is load-bearing rather than defensive. It was
    // derived from pg_constraint, not from guessing until the errors stopped.
    //
    // A site visit belongs to an agent and a lead, not to a project — it
    // reaches units only through its stops. So drop the stops pointing at
    // doomed units and leave the visits alone; deleting an agent's calendar
    // entry because a demo project went away would be wrong.
    const doomedUnits = sql`(SELECT id FROM core.units WHERE project_id NOT IN ${notOurs})`;
    const doomedBookings = sql`(SELECT b.id FROM core.bookings b JOIN core.units u ON u.id = b.unit_id WHERE u.project_id NOT IN ${notOurs})`;

    await tx.execute(sql`DELETE FROM core.commission_entries WHERE booking_id IN ${doomedBookings}`);
    await tx.execute(sql`DELETE FROM core.payment_ledger     WHERE booking_id IN ${doomedBookings}`);
    await tx.execute(sql`DELETE FROM core.documents          WHERE booking_id IN ${doomedBookings}`);
    await tx.execute(sql`DELETE FROM core.unit_status_events WHERE unit_id IN ${doomedUnits}`);
    await tx.execute(sql`DELETE FROM core.bookings           WHERE unit_id IN ${doomedUnits}`);
    await tx.execute(sql`DELETE FROM core.holds              WHERE unit_id IN ${doomedUnits}`);
    await tx.execute(sql`DELETE FROM core.site_visit_units   WHERE unit_id IN ${doomedUnits}`);
    await tx.execute(sql`DELETE FROM core.lead_events        WHERE unit_id IN ${doomedUnits}`);
    await tx.execute(sql`DELETE FROM core.lead_interests     WHERE unit_id IN ${doomedUnits}`);
    await tx.execute(sql`DELETE FROM core.unit_geometries    WHERE unit_id IN ${doomedUnits}`);
    await tx.execute(sql`DELETE FROM core.documents          WHERE unit_id IN ${doomedUnits}`);
    await tx.execute(sql`DELETE FROM core.units              WHERE project_id NOT IN ${notOurs}`);

    await tx.execute(sql`DELETE FROM core.lead_interests   WHERE project_id NOT IN ${notOurs}`);
    await tx.execute(sql`DELETE FROM core.commission_rules WHERE project_id NOT IN ${notOurs}`);
    await tx.execute(sql`DELETE FROM core.documents        WHERE project_id NOT IN ${notOurs}`);
    await tx.execute(sql`DELETE FROM core.geometry_versions WHERE project_id NOT IN ${notOurs}`);
    await tx.execute(sql`DELETE FROM core.price_versions   WHERE project_id NOT IN ${notOurs}`);
    await tx.execute(sql`DELETE FROM core.pois             WHERE project_id NOT IN ${notOurs}`);
    await tx.execute(sql`DELETE FROM core.projects         WHERE id NOT IN ${notOurs}`);

    // -----------------------------------------------------------------------
    // 2. Insert the three real layouts
    // -----------------------------------------------------------------------
    const [owner] = (await tx.execute(sql`
      SELECT id FROM core.users WHERE role = 'owner' ORDER BY created_at LIMIT 1
    `)) as any[];
    if (!owner) throw new Error('No owner user in core.users to attribute these projects to.');

    for (const p of PROJECTS) {
      // Re-runnable: clear this project's own rows first. Same ordering
      // constraint as above. A re-run after the CRM has touched these units
      // will trip an FK rather than silently discarding a booking — which is
      // the behaviour we want from a script that reimports inventory.
      const mine = sql`(SELECT id FROM core.units WHERE project_id = ${p.id}::uuid)`;
      await tx.execute(sql`DELETE FROM core.unit_status_events WHERE unit_id IN ${mine}`);
      await tx.execute(sql`DELETE FROM core.lead_interests     WHERE unit_id IN ${mine}`);
      await tx.execute(sql`DELETE FROM core.unit_land_details  WHERE unit_id IN ${mine}`);
      await tx.execute(sql`DELETE FROM core.media    WHERE project_id = ${p.id}::uuid`);
      await tx.execute(sql`DELETE FROM core.units    WHERE project_id = ${p.id}::uuid`);
      await tx.execute(sql`DELETE FROM core.lead_interests WHERE project_id = ${p.id}::uuid`);
      await tx.execute(sql`DELETE FROM core.projects WHERE id = ${p.id}::uuid`);

      await tx.execute(sql`
        INSERT INTO core.projects
          (id, slug, name, asset_class, narrative, locality, city, state,
           layout_type, approval_number, rera_number, amenities,
           price_visibility, published_at, created_by_id)
        VALUES
          (${p.id}::uuid, ${p.slug}, ${p.name}, 'land', ${p.narrative},
           ${p.locality}, ${p.city}, ${p.state},
           ${p.layoutType}::core.layout_type, ${p.approvalNumber}, ${p.reraNumber},
           ${JSON.stringify(p.amenities.map((label) => ({ label })))}::jsonb,
           'on_request', now(), ${owner.id}::uuid)
      `);

      // The publish gate requires a hero, and site photography still does not
      // exist. The approved layout plan stands in — the real drawing rather
      // than stock imagery, the same rule /gallery follows.
      //
      // It must be a RASTER. This previously pointed at the layout PDF, which
      // a browser cannot render inside an <img>, so every project card on the
      // home page fell back to showing its alt text. The publish gate only
      // checks that a hero row exists, not that the file is displayable, so
      // nothing caught it until a card was looked at.
      await tx.execute(sql`
        INSERT INTO core.media (project_id, kind, status, storage_path, variants, alt_text, uploaded_by_id)
        VALUES (${p.id}::uuid, 'hero', 'ready', ${p.hero},
                ${JSON.stringify({ web: { url: p.hero } })}::jsonb,
                ${'Approved layout plan for ' + p.name}, ${owner.id}::uuid)
      `);

      // Units. Sequential numbering — see the PROVISIONAL note in the header.
      let n = 0;
      let sold = 0;
      for (const spec of p.plots) {
        for (let i = 0; i < spec.count; i++) {
          n += 1;
          const status = sold < p.soldCount ? (sold++, 'sold') : 'available';
          await tx.execute(sql`
            INSERT INTO core.units
              (project_id, unit_number, status, area_sq_yd, area_sq_ft, dimensions_label)
            VALUES
              (${p.id}::uuid, ${String(n)}, ${status}::core.unit_status,
               ${spec.sqYd}, ${spec.sqYd * 9}, ${spec.label})
          `);
        }
      }
      console.log(`  ${p.slug}: ${n} plots (${p.soldCount} sold)`);
    }
  });

  const after = await db.execute(sql`SELECT slug, name FROM core.projects ORDER BY slug`);
  console.log('\ncore.projects now:', (after as any[]).map((r) => r.slug).join(', '));
  console.log('Projection is empty — publish each project from the CRM, or run publish-real-projects.ts');
  await client.end();
}

main().catch(async (e) => {
  console.error(e);
  await client.end();
  process.exit(1);
});
