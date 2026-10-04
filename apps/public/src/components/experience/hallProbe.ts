// apps/public/src/components/experience/hallProbe.ts
//
// THE HALL REFLECTS ITSELF.
//
// Until now every reflective surface in the hall — the marble floor, the walnut,
// the gilt, the chandelier's crystal — reflected RoomEnvironment: three's
// generic studio, a grey box with six white light panels. That is what the
// round white blotches on the walnut panels were (the studio's panels, mirrored
// in a wall they have nothing to do with), and it is why the floor read as grey
// stone rather than polished marble: it was reflecting grey.
//
// Worse, it was reflecting it at the wrong strength. three r173 overrides a
// material's own envMapIntensity with scene.environmentIntensity whenever the
// material's envMap is null (WebGLRenderer.setProgram), so every per-material
// gain the room was tuned with — walnut x9, gilt x9, marble x2.6, the unbaked
// ornament x6 — was silently replaced by the global 0.3. None of them ever
// applied.
//
// So the hall now gets a REFLECTION PROBE of itself, the way a real-time
// archviz engine lights a baked room:
//
//   1. On the first frame the hall is on screen, a cube camera photographs the
//      lit room from its centre (HALL_PROBE_AT) into a half-float cube, which
//      PMREM prefilters into the roughness chain. The capture is the room's own
//      radiance: its ivory walls, its chandelier, its portrait, its carpet.
//   2. Every hall material is handed that texture EXPLICITLY, so its own
//      envMapIntensity is honoured again (PROBE_GAIN).
//   3. Reflections are BOX-PROJECTED onto the room's inner faces (HALL_BOX). A
//      cube map is a picture of infinitely distant surroundings; a hall is 20m
//      across, and unprojected, the far wall's reflection slides across the
//      floor with the camera. Intersecting each reflected ray with the room's
//      box and sampling toward the hit point puts the reflection where the wall
//      actually is — the portrait lands in the floor in front of the stair, the
//      pilasters stand in the marble under themselves.
//   4. The bake stays in charge of DIFFUSE light. A lightmapped surface already
//      carries every bounce the room has; letting the probe (or the ambient
//      light) add diffuse on top counts the room twice, and a flat second copy
//      of the room's light over every wall and corner is exactly the milky,
//      low-contrast veil the hall has had. So on lightmapped surfaces the probe
//      contributes specular only, and the ambient contributes nothing. The
//      surfaces with no bake (the ornament, the panelling) take their diffuse
//      light from the probe, which is the room's own light seen from inside it.
//
// The patch is a ShaderChunk edit gated on a define (HALL_PROBE), the same
// pattern as softSunShadows.ts: nothing outside the hall compiles differently.

import * as THREE from 'three';
import { withFullHall } from './hallLight';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

/**
 * The room's INNER faces, three-space metres, measured from the GLB (see the
 * table at the top of interiorPath.ts): x -9.90..9.90, floor 0, the coffered
 * ceiling at 13.00 (the dome above it is left out: a box cannot hold it, and
 * little in the room reflects it), z -7.70 (the stair wall) .. 7.70 (the entry
 * wall).
 */
export const HALL_BOX = {
  min: [-9.9, 0.0, -7.7] as const,
  max: [9.9, 13.0, 7.7] as const,
};

/**
 * Where the probe stands. Eye height, on the long axis, in front of the stair
 * foot and clear of the chandelier (y 5.85..7.85): the one point in the room
 * that sees all four walls, the floor, the stair and the portrait at once.
 */
export const HALL_PROBE_AT = [0, 1.7, 1.6] as const;

/** Face size of the capture. PMREM's roughness chain tops out at 256, and a
 *  larger capture would be downsampled before a single reflection used it. */
const PROBE_PX = 256;

/** The layer the capture renders. Hall geometry and every light are enabled on
 *  it; the stage's hit proxies and the motes are not. */
export const HALL_LAYER = 7;

/**
 * Reflection gain per material, RELATIVE TO THE PROBE — 1.0 is the room's own
 * radiance, which is the physically honest value for a probe of the same room.
 * Anything not listed takes 1.0. Holograms take 0: they are light, not
 * surfaces, and a black additive plate that reflects the room renders as a grey
 * pane hanging behind the plan.
 */
export const PROBE_GAIN: Readonly<Record<string, number>> = {
  MAT_MarbleFloor_LM: 1.0,
  MAT_MarbleFloor: 1.0,
  MAT_Wood_Dark: 1.0,
  MAT_Wood_Dark_LM: 1.0,
  MAT_Gold: 1.15,
  // the oculus ring, the one gilt surface the bake reaches (imperial hall)
  MAT_Gold_LM: 1.15,
  MAT_Table_Brass_LM: 1.1,
  // The tables' lacquered sunburst: at the grazing angles the station shots
  // look across it, a full reflection of the lit ceiling bleached the walnut
  // to grey stone. Half keeps the lacquer's sheen and the wood's colour.
  MAT_Table_Top_LM: 0.5,
  // The chandelier's drops: no transmission (HallModel.dressInterior), so their
  // sparkle is all reflection — a little more of the room than a flat surface.
  'Glass_Crystal_Kognaq_Simple.001': 1.6,
  // The portrait's glass carried the room at 2.4, at glass roughness, so the
  // chandelier and the picture light rode on it — and so did the windows,
  // across the sitter's face. The client had the reflection taken off
  // (2026-10-01; hallDetail.ts): museum glass, a breath of sheen and no
  // picture. The painting under it takes a little, for its varnish.
  MAT_PortraitGlass: 0.25,
  MAT_Portrait: 0.3,
};

const EMISSIVE_ONLY = /^MAT_Holo|^MAT_Hologram$/;

/** The defines a probed material carries. Stable strings, so every hall
 *  program shares one cache key per material kind. */
const vec3 = (v: readonly [number, number, number]) =>
  `vec3( ${v.map((n) => n.toFixed(4)).join(', ')} )`;
export const PROBE_DEFINES = {
  HALL_PROBE: '',
  HALL_BOX_MIN: vec3(HALL_BOX.min),
  HALL_BOX_MAX: vec3(HALL_BOX.max),
  HALL_PROBE_AT: vec3(HALL_PROBE_AT),
} as const;

let installed = false;

/**
 * Patch the physical shading chunks. Idempotent, and must run before the first
 * hall program compiles (HallModel calls it at module load).
 */
export function installHallProbe(): void {
  if (installed) return;
  installed = true;
  const C = THREE.ShaderChunk as unknown as Record<string, string>;

  // The varying, declared in both stages through `common`, which every
  // built-in shader includes at global scope.
  C.common += /* glsl */ `
#ifdef HALL_PROBE
	varying vec3 vHallWorld;
#endif
`;

  // Written in the vertex stage with its own transform chain, so it does not
  // depend on which features made worldpos_vertex compute `worldPosition`.
  C.worldpos_vertex += /* glsl */ `
#ifdef HALL_PROBE
	{
		vec4 hallWorld = vec4( transformed, 1.0 );
		#ifdef USE_BATCHING
			hallWorld = batchingMatrix * hallWorld;
		#endif
		#ifdef USE_INSTANCING
			hallWorld = instanceMatrix * hallWorld;
		#endif
		vHallWorld = ( modelMatrix * hallWorld ).xyz;
	}
#endif
`;

  // Box projection of the specular lookup.
  const SAMPLE = 'vec4 envMapColor = textureCubeUV( envMap, envMapRotation * reflectVec, roughness );';
  if (!C.envmap_physical_pars_fragment.includes(SAMPLE)) {
    throw new Error('[hallProbe] envmap_physical_pars_fragment changed; the box projection cannot be installed');
  }
  C.envmap_physical_pars_fragment = C.envmap_physical_pars_fragment
    .replace(
      '#ifdef USE_ENVMAP',
      /* glsl */ `#ifdef USE_ENVMAP

	#ifdef HALL_PROBE

		// Intersect the reflected ray with the room's inner box and return the
		// direction from the probe to the hit, which is where the cube map
		// actually photographed that surface.
		vec3 hallParallax( const in vec3 dir ) {
			vec3 d = normalize( dir );
			vec3 s = vec3( d.x >= 0.0 ? 1.0 : -1.0, d.y >= 0.0 ? 1.0 : -1.0, d.z >= 0.0 ? 1.0 : -1.0 );
			vec3 dd = s * max( abs( d ), vec3( 1e-4 ) );
			vec3 p = clamp( vHallWorld, HALL_BOX_MIN + 0.01, HALL_BOX_MAX - 0.01 );
			vec3 far = max( ( HALL_BOX_MAX - p ) / dd, ( HALL_BOX_MIN - p ) / dd );
			float t = min( min( far.x, far.y ), far.z );
			return p + d * t - HALL_PROBE_AT;
		}

	#endif`,
    )
    .replace(
      SAMPLE,
      /* glsl */ `#ifdef HALL_PROBE
				reflectVec = hallParallax( reflectVec );
			#endif
			${SAMPLE}`,
    );

  // A lightmapped surface takes no DIFFUSE light from the probe...
  const IBL_DIFFUSE = 'iblIrradiance += getIBLIrradiance( geometryNormal );';
  if (!C.lights_fragment_maps.includes(IBL_DIFFUSE)) {
    throw new Error('[hallProbe] lights_fragment_maps changed; the bake/probe split cannot be installed');
  }
  C.lights_fragment_maps = C.lights_fragment_maps.replace(
    IBL_DIFFUSE,
    /* glsl */ `#if !( defined( HALL_PROBE ) && defined( USE_LIGHTMAP ) )
			${IBL_DIFFUSE}
		#endif`,
  );

  // ...and none from the ambient light, which exists only for the surfaces the
  // bake never reached.
  const AMBIENT = 'vec3 irradiance = getAmbientLightIrradiance( ambientLightColor );';
  if (!C.lights_fragment_begin.includes(AMBIENT)) {
    throw new Error('[hallProbe] lights_fragment_begin changed; the ambient split cannot be installed');
  }
  C.lights_fragment_begin = C.lights_fragment_begin.replace(
    AMBIENT,
    /* glsl */ `${AMBIENT}
	#if defined( HALL_PROBE ) && defined( USE_LIGHTMAP )
		irradiance = vec3( 0.0 );
	#endif`,
  );
}

type Probed = THREE.MeshStandardMaterial & { __hallProbe?: boolean };

/**
 * Give every hall material the probe texture explicitly, with its gain, and the
 * box-projection defines. `env` is a stand-in until the capture exists; it must
 * be a 256-face PMREM like the capture, so swapping one for the other changes no
 * program parameter and costs no recompile.
 *
 * Returns the materials, for the swap.
 */
export function prepareHallProbe(root: THREE.Object3D, env: THREE.Texture): THREE.MeshStandardMaterial[] {
  const out: THREE.MeshStandardMaterial[] = [];
  const seen = new Set<THREE.Material>();
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      const mat = m as Probed;
      if (!mat || seen.has(mat) || !mat.isMeshStandardMaterial) continue;
      seen.add(mat);
      mat.envMap = env;
      if (EMISSIVE_ONLY.test(mat.name)) {
        mat.envMapIntensity = 0;
      } else {
        mat.envMapIntensity = PROBE_GAIN[mat.name] ?? 1;
        if (!mat.__hallProbe) {
          mat.defines = { ...(mat.defines ?? {}), ...PROBE_DEFINES };
          mat.__hallProbe = true;
        }
      }
      mat.needsUpdate = true;
      out.push(mat);
    }
  });
  return out;
}

/**
 * THE ROOM CUBE, made once per renderer and shared: the interior's
 * scene.environment, dusk's outside, and the hall probe's stand-in were three
 * identical RoomEnvironment PMREMs. It is the stand-in's shape the capture must
 * match: fromScene always renders a 256 face, which is PROBE_PX.
 *
 * Made once because the first fromScene() is not a render but a stall. It draws
 * RoomEnvironment's materials and PMREM's blur with programs used for the first
 * time, and a program's first use waits for its compile (three reads its info
 * log): MEASURED 1.3 s of getProgramInfoLog in the frame the hall armed, the
 * visitor mid-scroll on the lawn. WorldCanvas asks for the cube as the canvas
 * mounts, under the preloader, and every later caller gets it for nothing.
 *
 * THE GENERATOR IS KEPT, and run once through fromCubemap as well. The probe's
 * capture filters through the same two programs, blur and cubemap, and a
 * disposed generator takes them with it — MEASURED 190 ms of first use inside
 * the capture, at the door. Kept, they are compiled and introduced by the time
 * anything is captured. It holds one 768x1024 half-float work target.
 *
 * A lost context takes the cube's contents (a render target has no CPU copy to
 * re-upload from); the next caller after that rebuilds both. Never dispose
 * either; they live as long as the renderer.
 */
const roomCubes = new WeakMap<
  THREE.WebGLRenderer,
  { target: THREE.WebGLRenderTarget; pmrem: THREE.PMREMGenerator; stale: boolean }
>();

function roomHeld(gl: THREE.WebGLRenderer) {
  const held = roomCubes.get(gl);
  if (held && !held.stale) return held;
  if (!held) {
    gl.domElement.addEventListener('webglcontextlost', () => {
      const lost = roomCubes.get(gl);
      if (lost) lost.stale = true;
    });
  }
  held?.target.dispose();
  held?.pmrem.dispose();
  const pmrem = new THREE.PMREMGenerator(gl);
  const room = new RoomEnvironment();
  const target = pmrem.fromScene(room, 0.04);
  room.dispose?.();
  const primer = new THREE.WebGLCubeRenderTarget(PROBE_PX, { type: THREE.HalfFloatType, generateMipmaps: false });
  const prev = gl.getRenderTarget();
  const face = gl.getActiveCubeFace();
  const mip = gl.getActiveMipmapLevel();
  gl.setRenderTarget(primer);
  gl.clear();
  gl.setRenderTarget(prev, face, mip);
  pmrem.fromCubemap(primer.texture).dispose();
  primer.dispose();
  const next = { target, pmrem, stale: false };
  roomCubes.set(gl, next);
  return next;
}

/** The renderer's shared PMREM generator (see roomHeld): its programs are
 *  compiled and introduced under the preloader, so a later filter — the pool's
 *  probe (poolProbe.ts) — costs its draws and nothing more. */
export function sharedPmrem(gl: THREE.WebGLRenderer): THREE.PMREMGenerator {
  return roomHeld(gl).pmrem;
}

export function roomCube(gl: THREE.WebGLRenderer): THREE.WebGLRenderTarget {
  return roomHeld(gl).target;
}

/**
 * WARM THE HALL'S PROGRAMS WHILE IT IS STILL HIDDEN.
 *
 * The hall is loaded early and kept invisible until the door, so every one of
 * its ~70 programs used to compile on the frame the passage swapped sets: a
 * measured 2.4 s synchronous stall inside the one transition the film is built
 * around (and its E2E check for "the light fills the frame" read 0 because the
 * white peak was never drawn).
 *
 * three's compile() walks hidden objects too, but it keys every program on the
 * state at the moment it runs, and three parts of that state are not the
 * hall's while the visitor is outside:
 *
 *   lights       the exterior's sun, hemisphere and fills are mounted outside;
 *                the hall renders under exactly one AmbientLight and the
 *                portrait's SpotLight (no shadows). A stand-in scene with those
 *                two supplies the light state.
 *   environment  materials without an envMap of their own take the scene's; the
 *                hall's is a 256-face PMREM, so the stand-in carries one.
 *   target       the composer renders into its own buffer, so the hall's
 *                programs are compiled without tone mapping and with linear
 *                output. Binding any render target for the call reproduces that;
 *                compiled against the screen, every program would be the wrong
 *                variant and the door would stall anyway.
 *
 * With KHR_parallel_shader_compile (Chrome, Edge, Safari 17+) the compiles run
 * off the main thread and the promise resolves when they are ready.
 *
 * ONE OR TWO A FRAME. Building a program is not free even when the driver
 * compiles it elsewhere: three assembles the source, resolves its chunks and
 * unrolls its loops on the main thread, ~4.5 ms for a hall material — MEASURED
 * 186 ms for the room's ~40 in the single call this used to be, one dropped
 * run of frames on the lawn. So every caller joins one queue per renderer, and
 * each frame spends at most WARM_BUDGET_MS of it. A warm still unfinished when
 * the door arrives costs only what the old way cost.
 *
 * AND INTRODUCED. A compiled program is still not free to draw with the first
 * time: three's first use reads its info logs and its uniform table, calls that
 * wait on the GPU process. At the door they queued behind the probe capture's
 * draws — MEASURED 416 ms of getProgramInfoLog in the capture, every program
 * already compiled. So the queue also makes that first call itself, for each
 * program as it finishes compiling, inside the same budget.
 *
 * Each distinct material (per kind of mesh it is on) is compiled once, on a
 * childless stand-in for a mesh that still wears it: compile() walks whatever
 * it is handed, and a mesh's material can change before its turn (a station
 * swaps its lens for an invisible one; a remount disposes a clone). A material
 * no mesh in the scene wears any more is skipped; compiling a disposed one
 * would re-acquire a program nothing ever releases.
 */
export function warmHallPrograms(
  gl: THREE.WebGLRenderer,
  camera: THREE.Camera,
  object: THREE.Object3D,
  env: THREE.Texture | null,
): Promise<void> {
  const stage = new THREE.Scene();
  stage.environment = env;
  stage.add(new THREE.AmbientLight());
  const spot = new THREE.SpotLight();
  stage.add(spot, spot.target);
  return warmProgramsUnder(gl, camera, object, stage);
}

/**
 * The same queue, for anything first drawn in the middle of a move: its
 * programs built and introduced ahead of the frame that needs them, under the
 * light state of `stage` — which for a thing of the estate's own pass is the
 * scene itself (the doorway's two panels, DoorwayRig: each compiled on the
 * frame the door began to open, MEASURED, a held frame at the start of the one
 * move that must not have one).
 */
export function warmProgramsUnder(
  gl: THREE.WebGLRenderer,
  camera: THREE.Camera,
  object: THREE.Object3D,
  stage: THREE.Scene,
): Promise<void> {
  const byKey = new Map<string, WarmItem>();
  object.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!(mesh.isMesh || (o as THREE.Points).isPoints || (o as THREE.Line).isLine || (o as THREE.Sprite).isSprite)) return;
    if (!mesh.material) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const key = `${mats.map((m) => m.id).join('/')}|${warmKind(mesh)}`;
    const item = byKey.get(key);
    if (item) item.meshes.push(o);
    else byKey.set(key, { material: mesh.material, meshes: [o] });
  });

  warmPending += 1;
  return new Promise((resolve) => {
    const jobs = warmJobs.get(gl) ?? [];
    warmJobs.set(gl, jobs);
    const done = () => {
      warmPending -= 1;
      resolve();
    };
    jobs.push({ camera, stage, items: [...byKey.values()], built: new Set(), resolve: done });
    if (jobs.length === 1) requestAnimationFrame(() => pumpWarm(gl));
  });
}

/** Per frame, the main-thread time the warm queue may spend. */
const WARM_BUDGET_MS = 4;

type WarmItem = { material: THREE.Material | THREE.Material[]; meshes: THREE.Object3D[] };

type WarmJob = {
  camera: THREE.Camera;
  stage: THREE.Scene;
  items: WarmItem[];
  /** Built, and not yet introduced to three. */
  built: Set<THREE.Material>;
  resolve: () => void;
};

type WarmProgram = { isReady?: () => boolean; getUniforms: () => unknown };

const warmJobs = new WeakMap<THREE.WebGLRenderer, WarmJob[]>();

let warmPending = 0;

/**
 * True when no warm is queued or unfinished. The door passage holds its white
 * until this is (WorldCanvas, HallReadiness): a visitor who scrolls to the door
 * within a second of the hall arriving would otherwise meet the rest of its
 * programs compiling on their first draw — MEASURED 5.3 s in one frame when a
 * fast scroll beat the warm to the door — where a held white costs nothing.
 */
export function hallWarmIdle(): boolean {
  return warmPending === 0;
}

/** What besides the material decides a program: instancing, skinning, morphs,
 *  shadows received, and which vertex attributes the geometry carries. */
function warmKind(o: THREE.Mesh): string {
  const m = o as THREE.Mesh & {
    isInstancedMesh?: boolean;
    isSkinnedMesh?: boolean;
    isBatchedMesh?: boolean;
    instanceColor?: unknown;
  };
  const attrs = o.geometry ? Object.keys(o.geometry.attributes).sort().join(',') : '';
  // An instanced mesh that colours its instances is a program of its own: the
  // map table's pin heads and stems wear one material, and warmed as one kind
  // the heads' compiled on the first frame the door stood open (MEASURED).
  const instanced = m.isInstancedMesh ? (m.instanceColor ? 'ic' : 'i') : '';
  return `${instanced}${m.isSkinnedMesh ? 's' : ''}${m.isBatchedMesh ? 'b' : ''}${o.morphTargetInfluences ? 'm' : ''}${o.receiveShadow ? 'r' : ''}:${attrs}`;
}

/**
 * AND ITS TEXTURES UPLOADED. three sends a texture to the GPU the first time a
 * draw binds it, so the hall's maps all went up inside the probe capture's
 * first face: MEASURED 98 ms of upload in the door's longest frame, once every
 * program was already warm. initTexture() does the same upload now, with the
 * material that needs it, inside the same per-frame budget. Only textures with
 * their pixels in hand: a map still decoding would be uploaded empty.
 */
const uploaded = new WeakSet<THREE.Texture>();

function uploadTextures(gl: THREE.WebGLRenderer, m: THREE.Material): void {
  const seen: THREE.Texture[] = [];
  for (const v of Object.values(m)) if ((v as THREE.Texture)?.isTexture) seen.push(v as THREE.Texture);
  const uniforms = (m as THREE.ShaderMaterial).uniforms;
  if (uniforms) for (const u of Object.values(uniforms)) if ((u?.value as THREE.Texture)?.isTexture) seen.push(u.value);
  for (const t of seen) {
    if (uploaded.has(t) || t.isRenderTargetTexture || !t.image) continue;
    uploaded.add(t);
    gl.initTexture(t);
  }
}

function inScene(o: THREE.Object3D): boolean {
  let n: THREE.Object3D = o;
  while (n.parent) n = n.parent;
  return (n as THREE.Scene).isScene === true;
}

function pumpWarm(gl: THREE.WebGLRenderer): void {
  const jobs = warmJobs.get(gl);
  if (!jobs?.length) return;
  try {
    tickWarm(gl, jobs);
  } catch (err) {
    // Whatever went wrong, the oldest job is abandoned rather than retried
    // forever: its programs compile on first use, as they did before any of
    // this, and the door stops waiting for it.
    console.warn('[hall_warm] abandoned a warm', err);
    jobs.shift()?.resolve();
  } finally {
    if (jobs.length) requestAnimationFrame(() => pumpWarm(gl));
  }
}

function tickWarm(gl: THREE.WebGLRenderer, jobs: WarmJob[]): void {
  const t0 = performance.now();
  const spent = () => performance.now() - t0 >= WARM_BUDGET_MS;

  // BUILD, oldest job first, against a bound target (see the note on `target`).
  let target: THREE.WebGLRenderTarget | null = null;
  const prev = gl.getRenderTarget();
  const face = gl.getActiveCubeFace();
  const mip = gl.getActiveMipmapLevel();
  try {
    for (const job of jobs) {
      while (job.items.length && !spent()) {
        const item = job.items.shift()!;
        const wearer = item.meshes.find((o) => (o as THREE.Mesh).material === item.material && inScene(o));
        if (!wearer) continue;
        const lone = Object.create(wearer) as THREE.Object3D;
        lone.children = [];
        if (!target) {
          target = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType });
          gl.setRenderTarget(target);
        }
        // One bad material must not stop the queue: the door waits on it.
        try {
          for (const m of gl.compile(lone, job.camera, job.stage)) {
            job.built.add(m);
            uploadTextures(gl, m);
          }
        } catch (err) {
          console.warn('[hall_warm] skipped a material that would not compile', err);
        }
      }
      if (spent()) break;
    }
  } finally {
    if (target) {
      gl.setRenderTarget(prev, face, mip);
      target.dispose();
    }
  }

  introduceWarm(gl, jobs, spent);
}

function introduceWarm(gl: THREE.WebGLRenderer, jobs: WarmJob[], spent: () => boolean): void {
  // INTRODUCE each program as it finishes compiling. isReady() asks without
  // blocking (KHR_parallel_shader_compile); getUniforms() is three's first use,
  // cached from then on. Without the extension there is no asking: the first
  // use would wait out the whole compile on the lawn, so it is left to the door
  // and its veil, as before.
  const parallel = gl.extensions.has('KHR_parallel_shader_compile');
  for (const job of jobs) {
    if (!parallel) job.built.clear();
    for (const m of job.built) {
      if (spent()) break;
      const programs = (gl.properties.get(m) as { programs?: Map<string, WarmProgram> }).programs;
      let waiting = false;
      for (const program of programs?.values() ?? []) {
        if (program.isReady && !program.isReady()) waiting = true;
        else program.getUniforms();
      }
      if (!waiting) job.built.delete(m);
    }
  }

  for (let i = jobs.length - 1; i >= 0; i -= 1) {
    const job = jobs[i];
    if (job.items.length || job.built.size) continue;
    jobs.splice(i, 1);
    job.resolve();
  }
}

/** True when the object and every ancestor are visible, i.e. it will draw. */
export function isShown(o: THREE.Object3D | null): boolean {
  for (let n = o; n; n = n.parent) if (!n.visible) return false;
  return !!o;
}

/**
 * Photograph the hall from HALL_PROBE_AT and prefilter it — ONE FACE A FRAME.
 *
 * Renders only HALL_LAYER — the hall itself — with every light in the scene
 * enabled on that layer for the duration, so the capture's light state, and
 * therefore every program it uses, is the main render's own: no shader compiles
 * for the capture. The background is dropped for the same renders, so an
 * opening in the shell cannot photograph the sky into the room.
 *
 * Six renders of a 614k-triangle room are not one frame's work: all at once,
 * the capture was the longest frame of the door passage. Spread over the next
 * six, under the same veil, each is a sixth of it, and the room shows with the
 * stand-in until the seventh, when the filtered probe replaces it. `step()`
 * renders the next face and returns the probe after the last.
 */
export type HallProbeCapture = {
  step: () => THREE.WebGLRenderTarget | null;
  cancel: () => void;
};

export function beginHallProbe(
  gl: THREE.WebGLRenderer,
  scene: THREE.Scene,
  root: THREE.Object3D,
): HallProbeCapture {
  const cube = new THREE.WebGLCubeRenderTarget(PROBE_PX, {
    type: THREE.HalfFloatType,
    generateMipmaps: false,
  });
  const camera = new THREE.CubeCamera(0.05, 60, cube);
  camera.position.set(HALL_PROBE_AT[0], HALL_PROBE_AT[1], HALL_PROBE_AT[2]);
  camera.layers.set(HALL_LAYER);
  camera.updateMatrixWorld(true);
  // What CubeCamera.update() does first, for faces rendered one at a time.
  if (camera.coordinateSystem !== gl.coordinateSystem) {
    camera.coordinateSystem = gl.coordinateSystem;
    camera.updateCoordinateSystem();
  }
  const faces = camera.children as THREE.Camera[];
  root.traverse((o) => o.layers.enable(HALL_LAYER));
  let face = 0;

  return {
    step() {
      const lit: THREE.Object3D[] = [];
      // (Not the exterior's lights: with the door open on the hall
      // (HallPortal) they are in the scene too, and they are no part of the
      // room. Whoever mounts them marks them `outside`.)
      scene.traverse((o) => {
        if ((o as THREE.Light).isLight && !o.layers.isEnabled(HALL_LAYER) && !o.userData.outside) {
          o.layers.enable(HALL_LAYER);
          lit.push(o);
        }
      });
      const background = scene.background;
      scene.background = null;
      const prev = gl.getRenderTarget();
      const prevFace = gl.getActiveCubeFace();
      const prevMip = gl.getActiveMipmapLevel();
      try {
        gl.setRenderTarget(cube, face);
        // At full house light: the dimmer scales what the probe reflects too.
        withFullHall(() => gl.render(scene, faces[face]));
      } finally {
        gl.setRenderTarget(prev, prevFace, prevMip);
        scene.background = background;
        for (const o of lit) o.layers.disable(HALL_LAYER);
      }
      face += 1;
      if (face < 6) return null;
      const target = roomHeld(gl).pmrem.fromCubemap(cube.texture);
      cube.dispose();
      return target;
    },
    cancel() {
      cube.dispose();
    },
  };
}
