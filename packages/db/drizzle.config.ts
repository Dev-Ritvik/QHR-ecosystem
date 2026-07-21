import { defineConfig } from 'drizzle-kit';
import { config } from 'dotenv';

config();

if (!process.env.DATABASE_URL_MIGRATIONS) {
  throw new Error('DATABASE_URL_MIGRATIONS is missing from .env');
}

export default defineConfig({
  schema: './src/schema/**/*.ts',
  out: './migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL_MIGRATIONS,
  },
});
