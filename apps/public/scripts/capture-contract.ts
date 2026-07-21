/**
 * Contract capture runner: imports the REAL projection readers and executes
 * them against the live database over the app's own projection_reader
 * connection. Output is pasted verbatim into BACKEND_CONTRACT_FINAL.md.
 *
 * Run: pnpm dlx tsx apps/public/scripts/capture-contract.ts   (from repo root)
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

const envFile = readFileSync(path.resolve(__dirname, '../.env.local'), 'utf8');
for (const line of envFile.split(/\r?\n/)) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
}

async function main() {
  const p = await import('../src/lib/projection');

  const dump = (label: string, value: unknown) => {
    console.log(`\n===== ${label} =====`);
    console.log(JSON.stringify(value, (_k, v) => (typeof v === 'bigint' ? `${v.toString()}n(BIGINT)` : v), 1));
  };

  const summaries = await p.getProjectUnitSummaries();
  dump('getProjectUnitSummaries() — full output', summaries);

  const units = await p.getAllPublishedUnits();
  dump(`getAllPublishedUnits() — ${units.length} rows, first 2 + one priced Azure row`, [
    units[0],
    units[1],
    units.find((u) => u.projectSlug === 'the-azure-residences' && !u.priceOnRequest),
  ]);

  const localities = await p.getLocalities();
  dump('getLocalities() — full output', localities);

  const media = await p.getAllMedia();
  dump(`getAllMedia() — ${media.length} rows, first 2`, media.slice(0, 2));

  const azure = await p.getProjectBySlug('the-azure-residences');
  if (!azure) throw new Error('azure project missing');
  const mapData = await p.getProjectMapData(azure.projectId);
  dump('getProjectMapData(azure) — full output', mapData);

  const lucky = await p.getProjectBySlug('lucky-gardens');
  if (lucky) {
    const luckyMap = await p.getProjectMapData(lucky.projectId);
    dump('getProjectMapData(lucky-gardens) — centroid/bbox/feature+poi counts', {
      centroid: luckyMap.centroid,
      bbox: luckyMap.bbox,
      featureCount: luckyMap.features.length,
      poiCount: luckyMap.pois.length,
      firstPoi: luckyMap.pois[0] ?? null,
    });
  }

  // Legacy-reader caveat proof for the contract doc: what the OLD readers
  // return for geometry columns (raw WKB hex, not GeoJSON).
  const legacy = await p.getProjectBySlug('the-azure-residences');
  dump('LEGACY getProjectBySlug().centroid (raw driver value — DO NOT feed to MapLibre)', {
    centroidType: typeof legacy?.centroid,
    centroidPreview: String(legacy?.centroid).slice(0, 40) + '…',
  });

  process.exit(0);
}

main().catch((e) => {
  console.error('RUNNER FAILED:', e);
  process.exit(1);
});
