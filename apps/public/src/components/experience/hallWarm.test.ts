// apps/public/src/components/experience/hallWarm.test.ts
//
// The hall's program warm-up as a contract (hallProbe.ts, warmHallPrograms):
// what it compiles, on what, within what budget, and when the door may open.
// Against a stand-in renderer that records what it is asked to compile and
// reports each program's readiness as the test says.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { hallWarmIdle, warmHallPrograms } from './hallProbe';

type FakeProgram = { isReady: () => boolean; getUniforms: () => void };

function fakeRenderer(opts: { costMs?: number; parallel?: boolean } = {}) {
  const compiled: { material: THREE.Material; on: THREE.Object3D }[] = [];
  const ready = new Map<THREE.Material, boolean>();
  const introduced: THREE.Material[] = [];
  const uploaded: THREE.Texture[] = [];
  const programs = new Map<THREE.Material, Map<string, FakeProgram>>();
  let clock = 0;
  const gl = {
    getRenderTarget: () => null,
    getActiveCubeFace: () => 0,
    getActiveMipmapLevel: () => 0,
    setRenderTarget: () => {},
    extensions: { has: () => opts.parallel ?? true },
    initTexture: (t: THREE.Texture) => uploaded.push(t),
    compile(object: THREE.Object3D) {
      const out = new Set<THREE.Material>();
      object.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (!mesh.isMesh) return;
        const m = mesh.material as THREE.Material;
        compiled.push({ material: m, on: Object.getPrototypeOf(o) as THREE.Object3D });
        clock += opts.costMs ?? 0;
        if (!programs.has(m)) {
          programs.set(m, new Map([['p', { isReady: () => ready.get(m) ?? true, getUniforms: () => introduced.push(m) }]]));
        }
        out.add(m);
      });
      return out;
    },
    properties: { get: (m: THREE.Material) => ({ programs: programs.get(m) }) },
  };
  return { gl: gl as unknown as THREE.WebGLRenderer, compiled, ready, introduced, uploaded, now: () => clock };
}

let frames: FrameRequestCallback[] = [];
function flush(n = 1) {
  for (let i = 0; i < n; i += 1) {
    const due = frames;
    frames = [];
    for (const cb of due) cb(0);
  }
}
const settled = () => new Promise((r) => setTimeout(r, 0));

function mesh(material: THREE.Material, parent: THREE.Object3D) {
  const m = new THREE.Mesh(new THREE.BufferGeometry(), material);
  parent.add(m);
  return m;
}

beforeEach(() => {
  frames = [];
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    frames.push(cb);
    return frames.length;
  });
});
afterEach(() => {
  flush(50);
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const camera = new THREE.PerspectiveCamera();

describe('the hall warm-up', () => {
  it('compiles each material once, on a mesh that still wears it', () => {
    const { gl, compiled } = fakeRenderer();
    const scene = new THREE.Scene();
    const lens = new THREE.MeshStandardMaterial({ name: 'MAT_Hologram' });
    const s1 = mesh(lens, scene);
    const s4 = mesh(lens, scene);
    void warmHallPrograms(gl, camera, scene, null);
    // A station swaps its lens for an invisible one before the queue gets to it;
    // the fourth, with no project, keeps the hologram and still needs it.
    s1.material = new THREE.MeshBasicMaterial({ name: 'hidden' });
    flush();
    expect(compiled.map((c) => (c.material as THREE.Material).name)).toEqual(['MAT_Hologram']);
    expect(compiled[0].on).toBe(s4);
  });

  it('skips a material no mesh in the scene wears any more', () => {
    const { gl, compiled } = fakeRenderer();
    const scene = new THREE.Scene();
    const gone = mesh(new THREE.MeshStandardMaterial({ name: 'clone' }), scene);
    void warmHallPrograms(gl, camera, scene, null);
    scene.remove(gone);
    flush();
    expect(compiled).toHaveLength(0);
  });

  it('hands compile() a childless stand-in, so nothing is built twice', () => {
    const { gl, compiled } = fakeRenderer();
    const scene = new THREE.Scene();
    const box = mesh(new THREE.MeshStandardMaterial({ name: 'box' }), scene);
    mesh(new THREE.MeshStandardMaterial({ name: 'brass' }), box);
    void warmHallPrograms(gl, camera, scene, null);
    flush();
    expect(compiled.map((c) => c.material.name).sort()).toEqual(['box', 'brass']);
  });

  it('spends a bounded slice of each frame', () => {
    const r = fakeRenderer({ costMs: 3 });
    vi.spyOn(performance, 'now').mockImplementation(r.now);
    const scene = new THREE.Scene();
    for (let i = 0; i < 5; i += 1) mesh(new THREE.MeshStandardMaterial({ name: `m${i}` }), scene);
    void warmHallPrograms(r.gl, camera, scene, null);
    flush();
    // 4 ms a frame at 3 ms a program: two, then the frame is over.
    expect(r.compiled).toHaveLength(2);
    flush(2);
    expect(r.compiled).toHaveLength(5);
  });

  it('holds the door until every program is compiled and introduced', async () => {
    const { gl, ready, introduced } = fakeRenderer();
    const scene = new THREE.Scene();
    const floor = new THREE.MeshStandardMaterial({ name: 'MAT_MarbleFloor_LM' });
    mesh(floor, scene);
    ready.set(floor, false);
    let done = false;
    void warmHallPrograms(gl, camera, scene, null).then(() => {
      done = true;
    });
    expect(hallWarmIdle()).toBe(false);
    flush(3);
    await settled();
    expect(done).toBe(false);
    expect(introduced).toHaveLength(0);
    ready.set(floor, true);
    flush();
    await settled();
    expect(introduced).toEqual([floor]);
    expect(done).toBe(true);
    expect(hallWarmIdle()).toBe(true);
  });

  it('leaves first use to the door where compiles cannot be asked about', async () => {
    const { gl, introduced } = fakeRenderer({ parallel: false });
    const scene = new THREE.Scene();
    mesh(new THREE.MeshStandardMaterial({ name: 'm' }), scene);
    const warm = warmHallPrograms(gl, camera, scene, null);
    flush();
    await warm;
    expect(introduced).toHaveLength(0);
  });

  it('abandons a warm that fails outright, so the door never waits on it', async () => {
    const { gl } = fakeRenderer();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    (gl as unknown as { properties: unknown }).properties = {
      get: () => {
        throw new Error('context lost');
      },
    };
    const scene = new THREE.Scene();
    mesh(new THREE.MeshStandardMaterial({ name: 'm' }), scene);
    const warm = warmHallPrograms(gl, camera, scene, null);
    flush(2);
    await warm;
    expect(hallWarmIdle()).toBe(true);
  });

  it("uploads each material's textures once, and only ones with pixels", () => {
    const { gl, uploaded } = fakeRenderer();
    const scene = new THREE.Scene();
    const walnut = new THREE.DataTexture(new Uint8Array(4), 1, 1);
    const decoding = new THREE.Texture();
    const probe = new THREE.WebGLRenderTarget(4, 4).texture;
    mesh(new THREE.MeshStandardMaterial({ name: 'a', map: walnut, roughnessMap: decoding }), scene);
    mesh(new THREE.MeshStandardMaterial({ name: 'b', map: walnut, envMap: probe }), scene);
    void warmHallPrograms(gl, camera, scene, null);
    flush();
    expect(uploaded).toEqual([walnut]);
  });

  it('keeps going past a material that will not compile', async () => {
    const r = fakeRenderer();
    const scene = new THREE.Scene();
    const bad = new THREE.MeshStandardMaterial({ name: 'bad' });
    mesh(bad, scene);
    mesh(new THREE.MeshStandardMaterial({ name: 'good' }), scene);
    const compile = r.gl.compile.bind(r.gl);
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    (r.gl as unknown as { compile: typeof compile }).compile = (o, c, s) => {
      if ((o as THREE.Mesh).material === bad) throw new Error('link failed');
      return compile(o, c, s);
    };
    const warm = warmHallPrograms(r.gl, camera, scene, null);
    flush(2);
    await warm;
    expect(r.compiled.map((c) => c.material.name)).toEqual(['good']);
  });
});
