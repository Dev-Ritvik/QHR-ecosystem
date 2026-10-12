// apps/public/src/components/experience/exteriorDetails.test.ts
//
// Small things on the grounds, from the forensic audit of 2026-10-09: lamps
// that are lit when lamps are lit (#18), a car's chrome that is a line (#26),
// planting that is one colour in sun and in shade (#22), and stone with no
// weave on it (#32).

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CAR_SPECULAR, CONTACT_FREE_RE, LAMPS, WATER_SKY } from './ExteriorModel';
import { BLOOM_LIGHT, FOLIAGE_TINT, FOLIAGE_TRANSLUCENCY, foliageUniforms } from './exteriorFoliage';
import { ASHLAR } from './exteriorSurfaces';
import { ARRIS, ARRIS_ANCHOR, ARRIS_NORMAL, ARRIS_RE, arrisChunk } from './exteriorArris';

const read = (p: string) => readFileSync(join(__dirname, p), 'utf8').replace(/\r\n/g, '\n');
const model = read('ExteriorModel.tsx');

describe("the grounds' lamps", () => {
  it('come on with the evening: off by day, lit before the dusk is whole', () => {
    // "The bollard lights glow in full daylight ... Expected: lights that come
    // on with the evening and have a lamp shape and a soft glow."
    expect(LAMPS.from).toBeGreaterThan(0.1);
    expect(LAMPS.whole).toBeGreaterThan(LAMPS.from + 0.2);
    expect(LAMPS.whole).toBeLessThan(1);
    expect(model).toContain("const on = THREE.MathUtils.smoothstep(filmState.evening, ld('lampsFrom', LAMPS.from), ld('lampsWhole', LAMPS.whole));");
    expect(model).toContain('const want = l.full * on;');
  });

  it('are opal glass unlit and one warm white lit, the terrace like the drive', () => {
    const [r, g, b] = LAMPS.warm;
    // a lamp's warm white: red over green over blue (the terrace's were a cyan)
    expect(r).toBeGreaterThan(g);
    expect(g).toBeGreaterThan(b);
    // glass, by day: pale and all but neutral
    expect(Math.max(...LAMPS.glass) - Math.min(...LAMPS.glass)).toBeLessThan(0.12);
    expect(Math.min(...LAMPS.glass)).toBeGreaterThan(0.6);
    // every lamp material of the file, and each only once (drei shares the parse)
    expect(model).toContain('const LAMP_RE = /^MAT_Light_/;');
    expect(model).toContain('if (u.lampFull === undefined) {');
  });
});

describe("a car's brightwork", () => {
  it('is spread by how fast its mapped normal turns across a pixel, to a cap, over a floor', () => {
    // "A dotted line of orange sparkle runs along the car's sill ...
    // Expected: a continuous chrome strip."
    expect(CAR_SPECULAR.floor).toBeGreaterThan(0.1);
    expect(CAR_SPECULAR.floor).toBeLessThan(0.3);
    // a bonnet seen close stays glossy: the widening is capped
    expect(CAR_SPECULAR.cap).toBeLessThan(0.3);
    expect(CAR_SPECULAR.cap).toBeGreaterThan(0.1);
    expect(model).toContain('vec3 carDx = dFdx(normal), carDy = dFdy(normal);');
    expect(model).toContain('material.roughness = sqrt(clamp(carRough * carRough + carTurn, 0.0, 1.0));');
    // the generated cars only: the scripted stand-in is lacquered as it was
    expect(model).toContain('const CAR_MAPPED_RE = /^MAT_Car_(Saloon|Classic)/;');
    // and the hook is left for whoever dresses the material next
    expect(model).toContain("shader.fragmentShader.replace('#include <lights_physical_fragment>', CAR_SPECULAR_AA)");
  });
});

describe('the bougainvillea', () => {
  it('is one colour through the light: less of the sun, more of the shade, a little less of itself', () => {
    // "The shrubs are near-black noisy blobs at the cover and saturated red at
    // the revolve ... Expected: one planting colour that holds through the
    // light."
    expect(BLOOM_LIGHT.sun).toBeLessThan(1);
    expect(BLOOM_LIGHT.sun).toBeGreaterThan(0.5);
    expect(BLOOM_LIGHT.shade).toBeGreaterThan(1.5);
    expect(BLOOM_LIGHT.shade).toBeLessThan(3);
    expect(BLOOM_LIGHT.sat).toBeLessThan(0.62);
    expect(foliageUniforms.uBloomSun.value).toBe(BLOOM_LIGHT.sun);
    expect(foliageUniforms.uBloomShade.value).toBe(BLOOM_LIGHT.shade);
    expect(FOLIAGE_TINT).toContain(`diffuseColor.rgb, ${BLOOM_LIGHT.sat.toFixed(2)}) * vec3(0.62, 0.6, 0.66);`);
    // on its own cards only
    const at = FOLIAGE_TRANSLUCENCY.indexOf('#ifdef FOLIAGE_BLOOM');
    expect(at).toBeGreaterThan(0);
    const block = FOLIAGE_TRANSLUCENCY.slice(at, FOLIAGE_TRANSLUCENCY.indexOf('#endif', at));
    expect(block).toContain('reflectedLight.directDiffuse *= uBloomSun;');
    expect(block).toContain('reflectedLight.indirectDiffuse *= uBloomShade;');
  });
});

describe('dressed stone and the contact pass', () => {
  it('leaves every dressed-stone material out of the pass, baked or not, and nothing else', () => {
    // "The stone of the arch and soffit carries a woven, cloth-like texture at
    // this range." The weave was the contact pass's sampling noise, which has
    // nothing to hide in on smooth stone.
    const stone = [
      'MAT_Stone_Wall_AO',
      'MAT_Stone_Trim_AO',
      'MAT_Stone_Trim_AOG',
      'MAT_Stone_Trim',
      'MAT_Stone_Rustic_AO',
      'MAT_Stone_Steps_AO',
      'MAT_Stone_Terrace_AO',
      'MAT_Stone_Flags_AOG',
      'MAT_Stone_Boundary',
    ];
    for (const name of stone) expect(CONTACT_FREE_RE.test(name), name).toBe(true);
    // what has a grain of its own keeps the pass, and so its contact
    const grained = ['MAT_Gravel_AOG', 'MAT_Lawn_AOG', 'MAT_Soil_AOG', 'MAT_Hedge', 'MAT_Teak', 'MAT_Fabric', 'MAT_Car_Saloon', 'MAT_Roof_Lead_AO'];
    for (const name of grained) expect(CONTACT_FREE_RE.test(name), name).toBe(false);
    // by the mark a lamp carries: an occluder still, and not itself occluded
    expect(model).toContain("mat.defines = { ...(mat.defines ?? {}), ESTATE_EMITTER: '' };");
    const lens = read('LensFocus.tsx');
    expect(lens).toContain('if (aoStrength > 0.001 && z0 < 9.0e3 && inputColor.a > 0.0) ao = contactAO(uv, z0);');
    expect(lens).toContain('float aoDepth(vec4 c) { float a = abs(c.a); return abs(a - 1.0) < 1.0e-3 ? 1.0e4 : a; }');
    // and it is done where the estate is dressed, after its depth is marked
    const at = model.indexOf('markFocusDepth(root);');
    expect(at).toBeGreaterThan(0);
    expect(model.indexOf('leaveStoneOutOfContact(root);')).toBeGreaterThan(at);
  });
});

describe('stone at the distance the film sees it from', () => {
  // The frame cannot be multisampled (its alpha is the scene's depth), so a
  // face thinner than a pixel that is darker than both its neighbours is drawn
  // as a dot wherever a pixel's centre falls on it. A pixel is 4 cm of the
  // house from the cover and 1.5 cm from the door. Four hundred isolated dark
  // pixels stood on the house at the cover; a ray through each named these.
  const build = readFileSync(join(__dirname, '../../../../../tools/blender/build_estate_v7.py'), 'utf8').replace(/\r\n/g, '\n');

  it('cuts no slit into the wall: its courses are the ones the material draws', () => {
    expect(build).not.toContain('cutter_object(f"rust_{k}"');
    expect(build).not.toContain('cutter_object("rust_edge"');
    expect(build).toContain("THE GROUND FLOOR'S COURSES ARE NOT CUT INTO THE WALL");
    // drawn from the same height the slits began at, each joint at its share of a pixel
    expect(ASHLAR.from).toBe(0.9);
    expect(build).toContain('BASE_TOP = 0.9 ');
    const surfaces = read('exteriorSurfaces.ts');
    expect(surfaces).toContain('float joint = clamp((half_ + 0.5 * px - min(dh, dv)) / px, 0.0, 1.0);');
  });

  it('eases no arris whose chamfer would look down', () => {
    expect(build).toContain('if (a.normal + b.normal).normalized().z < -0.25:');
    // and counts what it leaves sharp, so a build log shows the rule at work
    expect(build).toContain('"left sharp (would look down)", looks_down');
  });

  it('gives the quoins a joint a pixel wide from the cover', () => {
    const m = /p, q, gap = ([\d.]+), ([\d.]+), ([\d.]+)/.exec(build);
    expect(m).not.toBeNull();
    const gap = Number(m![3]);
    // taken off each block: the joint is twice it, and a pixel is 4 cm
    expect(2 * gap).toBeGreaterThanOrEqual(0.045);
    expect(2 * gap).toBeLessThanOrEqual(0.06);
  });

  it('eases only what a camera stands near, and ships each chamfer as the face beside it', () => {
    // An arris that looks up and toward the sun is brighter than both its
    // faces: under a pixel wide it was a dotted pale line. Nine metres up and
    // more, no camera is ever near: no easing there at all.
    const table = /ARRISES = \{([^}]+)\}/.exec(build);
    expect(table).not.toBeNull();
    const eased = [...table![1].matchAll(/"(\w+)": ([\d.]+)/g)].map((m) => [m[1], Number(m[2])] as const);
    const names = eased.map(([n]) => n);
    for (const far of ['mansion_bands', 'mansion_parapet', 'mansion_acroteria', 'mansion_pediments']) expect(names).not.toContain(far);
    for (const near of ['portico_trim', 'portico_steps', 'podium_walls', 'hardscape_kerbs']) expect(names).toContain(near);
    // nor the pool's coping: what shows of it is a plate two centimetres
    // thick, and an eased edge left its side with no face to take its
    // occlusion from but the buried one under it
    expect(names).not.toContain('pool_coping');
    // every chamfer of the table is wider than the pixel at which it turns to its own facet
    for (const [, width] of eased) expect(width).toBeGreaterThan(ARRIS.near * 1.5);
    // the model gives each chamfer its larger neighbour's normal
    expect(build).toContain('worn = wear_neighbour_normals(me, chamfers)');
    expect(build).toContain('me.normals_split_custom_set(normals)');
  });

  it('turns a chamfer to its own facet only when a pixel is finer than it', () => {
    // 1.5 cm a pixel at the door and 4 cm from the cover: the neighbour's
    // normal, whole. 3 to 5 mm on the pages that stand by the portico: its own.
    expect(ARRIS.far).toBeLessThan(0.015);
    expect(ARRIS.near).toBeGreaterThanOrEqual(0.003);
    expect(ARRIS.near).toBeLessThan(ARRIS.far);
    // a chamfer between square faces is 45 degrees off the normal it wears;
    // turned work is within a few degrees of its facets
    expect(ARRIS.apart).toBeLessThan(Math.cos((30 * Math.PI) / 180) + 0.04);
    expect(ARRIS.apart).toBeGreaterThan(Math.cos((45 * Math.PI) / 180) + 0.05);
    expect(ARRIS_NORMAL).toContain('vec3 arrisFacet = normalize( cross( dFdx( vViewPosition ), dFdy( vViewPosition ) ) );');
    expect(ARRIS_NORMAL).toContain(`smoothstep( ${ARRIS.near.toFixed(4)}, ${ARRIS.far.toFixed(4)}, arrisPx )`);
    // it reads the normal where three reads it, before the normal map's frame is built on it
    const chunk = arrisChunk();
    expect(chunk).toContain(ARRIS_NORMAL);
    expect(chunk.indexOf(ARRIS_NORMAL)).toBeLessThan(chunk.indexOf('getTangentFrame'));
    expect(chunk.split(ARRIS_ANCHOR).length).toBe(2);
    expect(() => arrisChunk('vec3 normal = vNormal;')).toThrow();
    // on every dressed stone, and where the estate is dressed
    for (const name of ['MAT_Stone_Trim', 'MAT_Stone_Steps_AO', 'MAT_Stone_Rustic_AO', 'MAT_Stone_Terrace_AO']) expect(ARRIS_RE.test(name)).toBe(true);
    expect(model).toContain('dressArrises(root);');
  });

  it('closes the hollow under each raking cornice with one soffit that leans out', () => {
    const m = /SOFFIT_DROP = ([\d.]+)/.exec(build);
    expect(m).not.toBeNull();
    const drop = Number(m![1]);
    // from the slab's front edge (58 cm out) back to the tympanum's face (22 cm in)
    const lean = (Math.atan2(drop, 0.58 + 0.22) * 180) / Math.PI;
    expect(lean).toBeGreaterThan(12);
    expect(lean).toBeLessThan(30);
    expect(build).toContain('rake_pt(s * half, overhang, base), rake_pt(0.0, overhang, base + run),');
  });
});

describe('water and the sky', () => {
  it('mirrors the sky at the strength it is shown, with no gain', () => {
    expect(WATER_SKY).toBe(1);
    expect(model).toContain("const shown = scene.backgroundIntensity * ld('waterSky', WATER_SKY);");
  });
});
