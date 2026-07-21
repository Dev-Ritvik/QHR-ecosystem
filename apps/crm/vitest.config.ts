import { defineConfig } from 'vitest/config';
import path from 'path';

const domainSrc = path.resolve(__dirname, '../../packages/domain/src');

export default defineConfig({
  resolve: {
    // Mirrors tsconfig.json "paths". Order matters: more specific first.
    alias: [
      { find: '@estate/db', replacement: path.resolve(__dirname, '../../packages/db/src/index.ts') },
      { find: /^@estate\/domain\/src\/(.*)$/, replacement: `${domainSrc}/$1` },
      { find: /^@estate\/domain\/(.*)$/, replacement: `${domainSrc}/$1` },
      { find: /^@\//, replacement: `${path.resolve(__dirname, './src')}/` },
    ],
  },
  test: {
    include: ['src/**/*.test.ts'],
    testTimeout: 30000,
    hookTimeout: 30000,
  },
});
