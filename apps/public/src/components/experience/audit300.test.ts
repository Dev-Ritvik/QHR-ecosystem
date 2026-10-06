// apps/public/src/components/experience/audit300.test.ts
//
// The audit of 2026-10-05: what is kept of it outside the film's camera and
// the hall's light, which the client took back the next day (the continuous
// path and the lit room: cameraPath.test.ts, hallLight.test.ts). The page's
// markup is in filmStage.test.ts. This is the trees, the air and the water —
// and the hall's windows, which are the approved ones again.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { TREE_KINDS, treeSeed, treeVariation, varyTrees } from './exteriorTrees';
import { CONTACT_SHADOW, FOOTPRINTS, groundObjects } from './exteriorContact';
import { HAZE_FOOT_DEG, HORIZON_SKIRT, dressHaze, hazeUniforms, horizonSkirt } from './exteriorHaze';
import { HAZE_BAND_DEG, SKY_HAZE_BINS, setSkyHaze, skyHazeRing } from './skyHaze';
import { EVENING_PROBE } from './ExteriorModel';

const read = (p: string) => readFileSync(join(__dirname, p), 'utf8').replace(/\r\n/g, '\n');

describe("the hall's windows", () => {
  it('are the panes of the approved film: one pale dusk, lit, and not drawn darker', () => {
    // The audit of 2026-10-05 drew each pane as a view of an evening sky, dark
    // toward the zenith (hallGlass.ts), for a room it had re-lit as an
    // evening. The client asked for that room back as it was ("make the rooms
    // brighter like before the client disliked darkness"), and in the lit
    // room those panes were eight navy rectangles across the establishing
    // frame, where the approved ones are a pale slate dusk. They are the
    // approved panes: one emissive colour a pane, at its own strength.
    const src = read('HallModel.tsx');
    expect(src).toContain('mat.emissive.set(dusk.colour);');
    expect(src).toContain('mat.emissiveIntensity = dusk.strength;');
    expect(src).not.toMatch(/hallGlass|dressDuskGlass/);
  });
});

describe('no two neighbouring trees the same', () => {
  it('gives every tree its own proportions and lean, from where it stands', () => {
    const palm = TREE_KINDS.find((k) => k.re.test('veg_palm_avenue'))!;
    const m = new THREE.Matrix4();
    const seen = new Set<string>();
    let tallest = 0;
    let shortest = Infinity;
    for (let i = 0; i < 36; i += 1) {
      // the avenue: two rows down the drive
      const x = i % 2 ? 9 : -9;
      const z = 40 + Math.floor(i / 2) * 8;
      treeVariation(palm, x, z, m);
      const e = m.elements;
      // the foot stays where it was planted, and the trunk meets the ground upright
      const foot = new THREE.Vector3(0, 0, 0).applyMatrix4(m);
      expect(foot.length()).toBe(0);
      // a point up the trunk has moved sideways by its lean, and no further
      const top = new THREE.Vector3(0, 13.8, 0).applyMatrix4(m);
      const lean = Math.atan2(Math.hypot(top.x, top.z), top.y);
      expect(lean).toBeLessThanOrEqual(palm.lean + 1e-9);
      tallest = Math.max(tallest, e[5]);
      shortest = Math.min(shortest, e[5]);
      expect(e[5]).toBeGreaterThanOrEqual(1 - palm.height - 1e-9);
      expect(e[5]).toBeLessThanOrEqual(1 + palm.height + 1e-9);
      seen.add(`${e[0].toFixed(3)}|${e[5].toFixed(3)}|${top.x.toFixed(2)}|${top.z.toFixed(2)}`);
      // the same tree every load
      const again = treeVariation(palm, x, z, new THREE.Matrix4());
      expect(again.equals(m)).toBe(true);
    }
    // thirty-six palms, thirty-six trees
    expect(seen.size).toBe(36);
    expect(tallest - shortest).toBeGreaterThan(0.15);
    // a hash, not a pattern: neighbours are not in step
    expect(treeSeed(1, 2, 3)).not.toBe(treeSeed(2, 1, 3));
    for (let k = 0; k < 20; k += 1) {
      const s = treeSeed(k * 3.7, k * -2.1, k);
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThan(1);
    }
  });

  it('varies the instances the model carries, once, and tints the generated palms', () => {
    const geometry = new THREE.BoxGeometry(1, 10, 1);
    const mesh = new THREE.InstancedMesh(geometry, new THREE.MeshStandardMaterial(), 4);
    mesh.name = 'veg_palm_avenue';
    const before: THREE.Matrix4[] = [];
    for (let i = 0; i < 4; i += 1) {
      const m = new THREE.Matrix4().makeTranslation(i * 8, 0, i * 5);
      mesh.setMatrixAt(i, m);
      before.push(m.clone());
    }
    const root = new THREE.Group();
    root.add(mesh);
    expect(varyTrees(root)).toBe(4);
    const after = new THREE.Matrix4();
    for (let i = 0; i < 4; i += 1) {
      mesh.getMatrixAt(i, after);
      expect(after.equals(before[i])).toBe(false);
      // still standing where it stood
      expect(after.elements[12]).toBe(before[i].elements[12]);
      expect(after.elements[14]).toBe(before[i].elements[14]);
    }
    expect(mesh.instanceColor).not.toBeNull();
    // a second pass leaves them as they are
    expect(varyTrees(root)).toBe(0);
    // the shade trees have the foliage shader's own tint: no second one
    const shade = TREE_KINDS.find((k) => k.re.test('veg_tree_mango'))!;
    expect(shade.value).toBe(0);
  });
});

describe('the land dissolves into the sky behind it', () => {
  it('fogs each fragment toward the sky on its own line of sight, and keeps the frame\'s colour until the plate is read', () => {
    const src = read('exteriorHaze.ts');
    expect(src).toContain('vec3 hazeDir = normalize( ( vec4( -vViewPosition, 0.0 ) * viewMatrix ).xyz );');
    expect(src).toContain('vec3 hazeColour = mix( fogColor, texture2D( uHazeRing, hazeUv ).rgb * uHazeGain, uHazeOn );');
    // the foot is read inside the band the frame's one colour is the mean of
    expect(HAZE_FOOT_DEG).toBeGreaterThan(HAZE_BAND_DEG[0]);
    expect(HAZE_FOOT_DEG).toBeLessThan(HAZE_BAND_DEG[1]);
    // a material that has no view position keeps three's fog
    const root = new THREE.Group();
    const lit = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial());
    const flat = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial());
    const unfogged = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial({ fog: false }));
    root.add(lit, flat, unfogged);
    expect(dressHaze(root)).toBe(1);
    expect(dressHaze(root)).toBe(0);
    expect(hazeUniforms.uHazeRing.value).toBe(skyHazeRing());
    // its program is its own: two materials with different shaders never share a key
    const a = new THREE.MeshStandardMaterial();
    a.onBeforeCompile = () => undefined;
    const b = new THREE.MeshStandardMaterial();
    b.onBeforeCompile = (s) => {
      s.fragmentShader += '// b';
    };
    const pair = new THREE.Group();
    pair.add(new THREE.Mesh(new THREE.BoxGeometry(), a), new THREE.Mesh(new THREE.BoxGeometry(), b));
    dressHaze(pair);
    expect(a.customProgramCacheKey()).not.toBe(b.customProgramCacheKey());
  });

  it('is a ring of texels round the compass, written when the plate is', () => {
    const table = new Float32Array(SKY_HAZE_BINS * 3).fill(0.5);
    table[0] = 1;
    setSkyHaze(table);
    const ring = skyHazeRing();
    expect(ring.image.width).toBe(SKY_HAZE_BINS);
    expect(ring.wrapS).toBe(THREE.RepeatWrapping);
    expect(ring.colorSpace).toBe(THREE.SRGBColorSpace);
    const data = ring.image.data as Uint8Array;
    expect(data[0]).toBe(255);
    expect(data[4]).toBeGreaterThan(180); // 0.5 linear is 188 in sRGB
    expect(data[4]).toBeLessThan(195);
    setSkyHaze(null);
  });

  it('ends the land in the air the sky begins in: a skirt round the horizon, inside the far plane', () => {
    const root = new THREE.Group();
    const skirt = horizonSkirt(root);
    expect(horizonSkirt(root)).toBe(skirt);
    expect(HORIZON_SKIRT.radius).toBeLessThan(400); // CLIP.exterior.far
    expect(HORIZON_SKIRT.over).toBeGreaterThan(0);
    expect(HORIZON_SKIRT.whole).toBeLessThan(0);
    // under the land's end from the film's highest frame: thirty metres up, the ground gone at 400 m
    expect(HORIZON_SKIRT.under).toBeLessThan((-Math.atan(30 / 330) * 180) / Math.PI);
    const mat = skirt.material as THREE.ShaderMaterial;
    expect(mat.depthWrite).toBe(false);
    expect(mat.transparent).toBe(true);
    expect(mat.uniforms.uHazeGain).toBe(hazeUniforms.uHazeGain);
    expect(skirt.renderOrder).toBeLessThan(0);
    expect(read('ExteriorModel.tsx')).toContain('ring.parent.worldToLocal(ring.position.copy(state.camera.position));');
  });
});

describe('the pool at sunset, and what stands on the terrace', () => {
  it("gives the water an evening's photograph between the day's and the night's", () => {
    // "At sunset the pool is a flat teal surface": the morning's probe was put
    // out to fifteen per cent as evening fell and nothing took its place.
    expect(EVENING_PROBE.take).toBeGreaterThan(EVENING_PROBE.whole);
    expect(EVENING_PROBE.whole).toBeGreaterThan(EVENING_PROBE.from);
    expect(EVENING_PROBE.gain).toBeGreaterThan(1);
    expect(EVENING_PROBE.ease).toBeGreaterThan(0.5);
    const src = read('ExteriorModel.tsx');
    expect(src).toContain('st.eveningCapture ??= beginPoolProbe(gl, scene, st.at, st.water);');
    expect(src).toContain("const want = night ? 'night' : evening ? 'evening' : 'day';");
  });

  it('lays a margin of shade under each planter and block, once', () => {
    // eight planters, the two blocks at the steps, the parterre's urn
    expect(FOOTPRINTS).toHaveLength(11);
    for (const f of FOOTPRINTS) {
      expect(f.half[0]).toBeGreaterThan(0.2);
      expect(f.half[1]).toBeGreaterThan(0.2);
      expect(f.y).toBeGreaterThanOrEqual(0);
    }
    const root = new THREE.Group();
    const mesh = groundObjects(root)!;
    expect(mesh).not.toBeNull();
    expect(groundObjects(root)).toBeNull();
    const pos = mesh.geometry.getAttribute('position');
    expect(pos.count).toBe(FOOTPRINTS.length * 4);
    // each quad reaches past its footprint by the shadow's reach, just over the surface
    for (let i = 0; i < FOOTPRINTS.length; i += 1) {
      const f = FOOTPRINTS[i];
      let minX = Infinity;
      let maxX = -Infinity;
      for (let k = 0; k < 4; k += 1) {
        minX = Math.min(minX, pos.getX(i * 4 + k));
        maxX = Math.max(maxX, pos.getX(i * 4 + k));
        expect(pos.getY(i * 4 + k)).toBeGreaterThan(f.y);
        expect(pos.getY(i * 4 + k)).toBeLessThan(f.y + 0.02);
      }
      expect(maxX - minX).toBeCloseTo((f.half[0] + CONTACT_SHADOW.reach) * 2, 4);
    }
    expect((mesh.material as THREE.Material).depthWrite).toBe(false);
  });
});
