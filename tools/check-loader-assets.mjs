#!/usr/bin/env node
/**
 * Verify the Draco and Basis decoders in public/ match the ones three ships.
 *
 *   node tools/check-loader-assets.mjs
 *
 * ---------------------------------------------------------------------------
 * Why this exists
 * ---------------------------------------------------------------------------
 *
 * These decoders are copied out of node_modules by hand, so a `three` upgrade
 * silently desynchronises them. The failure is brutal to diagnose because the
 * error names neither the file nor the version:
 *
 *   LinkError: WebAssembly.instantiate(): Import #4 "a" "e":
 *              function import requires a callable
 *
 * That is what a mismatched pair produces. The .wasm and its JS glue are two
 * halves of one build — the glue declares the import table the module expects,
 * so a wrapper from a different Draco release offers the wrong shape and
 * instantiation fails. It reads like a corrupt binary and is not one.
 *
 * The trap that cost the most time: draco_decoder.wasm was byte-identical
 * while draco_wasm_wrapper.js was not, so a check of the .wasm alone reported
 * everything fine. Both halves must be compared, which is why this script
 * takes the whole set rather than a spot check.
 */

import { readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

// Resolve from apps/public, not from here. pnpm's node_modules is strict, so
// `three` is only reachable from the package that actually depends on it —
// resolving from the repo root throws MODULE_NOT_FOUND.
const require = createRequire(path.resolve('apps/public/package.json'));

// Walk up from the resolved entry point rather than resolving
// 'three/package.json' directly — three's "exports" map does not expose it,
// so asking for it throws ERR_PACKAGE_PATH_NOT_EXPORTED.
function packageRoot(entry) {
  let dir = path.dirname(entry);
  while (!existsSync(path.join(dir, 'package.json'))) {
    const up = path.dirname(dir);
    if (up === dir) throw new Error(`no package.json above ${entry}`);
    dir = up;
  }
  return dir;
}

const threeRoot = packageRoot(require.resolve('three'));
const libs = path.join(threeRoot, 'examples', 'jsm', 'libs');
const pub = path.join('apps', 'public', 'public');

const SETS = [
  { from: path.join(libs, 'draco'), to: path.join(pub, 'draco'),
    files: ['draco_decoder.js', 'draco_decoder.wasm', 'draco_wasm_wrapper.js'] },
  { from: path.join(libs, 'basis'), to: path.join(pub, 'basis'),
    files: ['basis_transcoder.js', 'basis_transcoder.wasm'] },
];

let bad = 0;
const version = JSON.parse(readFileSync(path.join(threeRoot, 'package.json'), 'utf8')).version;
console.log(`three ${version}\n`);

for (const set of SETS) {
  for (const f of set.files) {
    const a = path.join(set.from, f);
    const b = path.join(set.to, f);
    if (!existsSync(b)) {
      console.error(`  MISSING  ${b}`);
      bad += 1;
      continue;
    }
    const same = Buffer.compare(readFileSync(a), readFileSync(b)) === 0;
    console.log(`  ${same ? 'ok      ' : 'MISMATCH'} ${b}`);
    if (!same) bad += 1;
  }
}

if (bad) {
  console.error(
    `\n${bad} loader asset(s) out of sync with three ${version}.\n` +
      `Fix by copying them across:\n` +
      SETS.map((s) => `  cp ${s.from}/* ${s.to}/`).join('\n'),
  );
  process.exit(1);
}
console.log('\nAll loader assets match three.');
