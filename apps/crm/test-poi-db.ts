import { authedQuery } from './src/server/db';
import { getRoleContext } from './src/server/session';
import { coreSchema as schema } from '@estate/db';
import { eq, sql } from 'drizzle-orm';

export function parseWkbPoint(wkbHex: string): [number, number] | null {
  if (!wkbHex) return null;
  const buf = Buffer.from(wkbHex, 'hex');
  const isLittleEndian = buf[0] === 1;
  const type = isLittleEndian ? buf.readUInt32LE(1) : buf.readUInt32BE(1);
  const hasSrid = (type & 0x20000000) === 0x20000000;
  let offset = 5;
  if (hasSrid) offset += 4;
  const x = isLittleEndian ? buf.readDoubleLE(offset) : buf.readDoubleBE(offset);
  const y = isLittleEndian ? buf.readDoubleLE(offset + 8) : buf.readDoubleBE(offset + 8);
  return [x, y];
}

async function test() {
  const context = { role: 'owner', userId: '123e4567-e89b-12d3-a456-426614174001', teamId: 'global' } as any;
  try {
    const { project, history } = await authedQuery(context, async (tx: any) => {
      const projectId = '0289f8ee-6275-4f54-8ea1-2727f71aa5c5';
      const [project] = await tx.select()
        .from(schema.projects)
        .where(eq(schema.projects.id, projectId));

      const history = await tx.select()
        .from(schema.priceVersions)
        .where(eq(schema.priceVersions.projectId, projectId))
        // .orderBy(desc(schema.priceVersions.versionNo));
      return { project, history };
    });
    console.log("Success:", project.name, history.length);
  } catch (err) {
    console.error("Failed:", err);
  }
}
test();
