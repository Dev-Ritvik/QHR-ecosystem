import { execSync } from 'child_process';
import path from 'path';
import dotenv from 'dotenv';

async function globalSetup() {
  dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

  console.log('Running global setup to seed the database...');
  
  const seedScriptPath = path.resolve(__dirname, '../../../packages/db/src/seed/seed.ts');
  
  try {
    // Execute the TS script using tsx or ts-node. Assuming tsx is available in node_modules or via npx
    execSync(`pnpm dlx tsx "${seedScriptPath}"`, { stdio: 'inherit' });
    console.log('Database seeded successfully.');
  } catch (error) {
    console.error('Failed to seed the database:', error);
    throw error;
  }
}

export default globalSetup;
