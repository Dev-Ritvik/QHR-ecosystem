import { authedQuery } from './src/server/db';
import { getRoleContext } from './src/server/session';
import { coreSchema as schema } from '@estate/db';
import { eq } from 'drizzle-orm';

async function test() {
  const context = { role: 'owner', userId: '123e4567-e89b-12d3-a456-426614174001', teamId: 'global' } as any;
  try {
    const project = await authedQuery(context, async (tx: any) => {
      return tx.query.projects.findFirst({
        where: eq(schema.projects.id, '0289f8ee-6275-4f54-8ea1-2727f71aa5c5'),
      });
    });
    console.log("Success:", project);
  } catch (err) {
    console.error("Failed:", err);
  }
}
test();
