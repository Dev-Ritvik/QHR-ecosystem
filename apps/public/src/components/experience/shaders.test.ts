import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Guards the failure mode that silently disabled the terrain.
 *
 * Terrain.tsx declared `float flat = ...` in its vertex shader. `flat` is a
 * reserved interpolation qualifier in GLSL ES 3.00, and three compiles a
 * ShaderMaterial as `#version 300 es` on a WebGL2 context — it upgrades the
 * source rather than leaving it at GLSL1. So the vertex shader never compiled,
 * the program never linked, and every frame called useProgram against an
 * invalid program: a silent GL_INVALID_OPERATION twice per frame.
 *
 * Nothing caught it. three does not throw for a failed ShaderMaterial link on
 * that path, the draw call still counts toward renderer.info.render.calls, and
 * the geometry really is present at 321x321 — so audits that asked "does the
 * terrain exist" all got a yes while the home page rendered with no ground at
 * all, because ExteriorModel hides the GLB's ground_plane in favour of it.
 *
 * A compile test would need a GL context, which is far more machinery than the
 * bug needs. The bug is lexical: a reserved word used as an identifier. So this
 * reads the shader sources and checks exactly that, which is cheap, has no
 * runtime dependencies, and fails loudly the next time someone reaches for a
 * name like `sample`, `filter` or `buffer` inside a shader.
 */

const SHADER_FILES = ['Terrain.tsx', 'Motes.tsx', 'Constellation.tsx'];

/**
 * Reserved in GLSL ES 3.00 and therefore unusable as identifiers, but legal in
 * GLSL ES 1.00 — which is what makes them easy to write and hard to notice.
 * Not the full reserved list: these are the ones plausible as a variable name
 * in this codebase's shaders.
 */
const RESERVED = [
  'flat',
  'smooth',
  'noperspective',
  'centroid',
  'sample',
  'patch',
  'precise',
  'layout',
  'shared',
  'buffer',
  'filter',
  'active',
  'common',
  'partition',
  'resource',
  'input',
  'output',
  'subroutine',
  'invariant',
];

const TYPES = [
  'float',
  'int',
  'uint',
  'bool',
  'vec2',
  'vec3',
  'vec4',
  'ivec2',
  'ivec3',
  'ivec4',
  'mat2',
  'mat3',
  'mat4',
];

/** Strips // and /* *\/ comments so prose about "flat bedding planes" is ignored. */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
}

/** The contents of every `/* glsl *\/` tagged template literal in a file. */
function glslBlocks(source: string): string[] {
  const blocks: string[] = [];
  const re = /\/\* glsl \*\/\s*`([\s\S]*?)`/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source)) !== null) blocks.push(m[1]);
  return blocks;
}

function read(file: string): string {
  return readFileSync(join(__dirname, file), 'utf8');
}

describe('custom GLSL sources', () => {
  it.each(SHADER_FILES)('%s exposes shader blocks to scan', (file) => {
    const blocks = glslBlocks(read(file));
    // If this fails the extraction broke, and every assertion below would be
    // vacuously true — which is worse than the bug.
    expect(blocks.length).toBeGreaterThanOrEqual(2);
  });

  it.each(SHADER_FILES)(
    '%s declares no variable using a GLSL ES 3.00 reserved word',
    (file) => {
      const offences: string[] = [];

      for (const block of glslBlocks(read(file))) {
        const code = stripComments(block);
        for (const type of TYPES) {
          for (const word of RESERVED) {
            const re = new RegExp(`\\b${type}\\s+${word}\\b`);
            if (re.test(code)) offences.push(`${type} ${word}`);
          }
        }
      }

      expect(offences).toEqual([]);
    },
  );

  it.each(SHADER_FILES)('%s does not contain a stray backtick', (file) => {
    // A backtick inside these blocks terminates the JS template literal and
    // takes the whole module out with a syntax error. Learned the hard way
    // while documenting the fix above.
    for (const block of glslBlocks(read(file))) {
      expect(block).not.toContain('`');
    }
  });
});
