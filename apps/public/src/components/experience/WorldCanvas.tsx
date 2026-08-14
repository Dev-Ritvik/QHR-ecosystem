'use client';

// apps/public/src/components/experience/WorldCanvas.tsx
//
// The persistent world. Mounted ONCE by the (experience) layout, which App
// Router never unmounts while navigating inside that segment — so the scene
// survives every route change and the camera simply eases to wherever the new
// route says it should stand.
//
// That is the whole surface system in one sentence: opening a page does not
// take you anywhere, it re-frames where you already are. No flight, no reload,
// no waiting, and the room is behind the text rather than a white page.
//
// Supersedes HallScene, which owned its own <Canvas>. Two canvases in one tree
// means two WebGL contexts, two GPU uploads of a 15MB model, and a camera that
// cannot be shared — so the scene had to move up to the layout.

import {
  Component,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { placeForRoute, type PlaceId } from '@estate/domain/experience/places';
import type { DeviceTier } from '@estate/domain/telemetry/device-tier';
import { HallModel } from './HallModel';
import { ExteriorModel } from './ExteriorModel';
import { useDeviceTier } from './useDeviceTier';
import { poseFor, setFor, type SceneSet } from './poses';
import { POSITION_CURVE, TARGET_CURVE, curveT, atmosphereAt } from './cameraPath';
import { useScrollProgress } from './useScrollProgress';
import { SceneFallback } from './SceneFallback';
import { telemetry } from '@/lib/telemetry/collector';

/**
 * Scrub, in seconds per unit of a pose's `ease` — the lag between where scroll
 * says the camera should be and where it actually is.
 *
 * 2.2 puts `arrival` (ease 1.4) at ~3.1s, matching the reference build's
 * scrub: 3 on its main scrubbed timeline. Deliberately heavy: the camera should
 * still be settling for a beat after the wheel stops. That trailing motion is
 * most of what separates a cinematic move from a scrollbar attached to a
 * viewport.
 */
const SCRUB = 2.2;

/** Metres of camera offset at full pointer deflection. Small on purpose - see
 *  the note at the call site. */
const PARALLAX = 0.42;

const STATION_RE = /^holo3d_(S[123])_/;

function stationOf(o: THREE.Object3D | null): string | null {
  let node: THREE.Object3D | null = o;
  while (node) {
    const m = STATION_RE.exec(node.name);
    if (m) return m[1];
    node = node.parent;
  }
  return null;
}

/** Eases the camera toward the current place. Damped rather than tweened so an
 *  interruption mid-move is graceful — a visitor who opens two surfaces quickly
 *  should not see the camera finish a journey they abandoned. */
/**
 * Free orbit camera, behind ?free=1.
 *
 * Every pose in poses.ts is a Blender coordinate converted by hand, and the
 * only way to tell a good one from one standing inside a wall is to stand
 * there and look. Judging that from a phone by editing constants and rebuilding
 * is a loop measured in minutes per guess.
 *
 * With this, the room can be flown around on the device and a working vantage
 * read straight off the console, which is where the poses should have come from
 * in the first place. Look-dev only; the scripted rig is what ships.
 */
function FreeCamera() {
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);

  useEffect(() => {
    let controls: OrbitControls | null = new OrbitControls(camera, gl.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.target.set(0, 1.5, 0);

    // Log on release rather than on change: a pose is only interesting once
    // the camera has stopped, and a per-frame log would bury it.
    const report = () => {
      const p = camera.position;
      const t = controls!.target;
      // eslint-disable-next-line no-console
      console.info(
        '[pose] position: [%s, %s, %s], target: [%s, %s, %s]',
        p.x.toFixed(2), p.y.toFixed(2), p.z.toFixed(2),
        t.x.toFixed(2), t.y.toFixed(2), t.z.toFixed(2),
      );
    };
    controls.addEventListener('end', report);

    return () => {
      controls?.removeEventListener('end', report);
      controls?.dispose();
      controls = null;
    };
  }, [camera, gl]);

  useFrame(() => {});
  return null;
}

function CameraRig({ place }: { place: PlaceId }) {
  const { camera, gl } = useThree();
  const target = useRef(new THREE.Vector3());
  const desired = useRef(new THREE.Vector3());
  const look = useRef(new THREE.Vector3());
  const scroll = useScrollProgress();

  // Normalised pointer, -1..1 on both axes. Fed to the parallax offset below.
  // Zeroed on leave so the camera returns to its scripted position rather than
  // holding whatever offset the cursor had when it left the window.
  const pointer = useRef(new THREE.Vector2(0, 0));
  useEffect(() => {
    const el = gl.domElement;
    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      pointer.current.set(
        ((e.clientX - r.left) / r.width) * 2 - 1,
        -(((e.clientY - r.top) / r.height) * 2 - 1),
      );
    };
    const onLeave = () => pointer.current.set(0, 0);
    // pointermove only, and only on a device with a real pointer. On touch the
    // finger IS the scroll, and offsetting the camera to it would fight the
    // gesture the whole way down the page.
    if (window.matchMedia('(pointer: fine)').matches) {
      window.addEventListener('pointermove', onMove, { passive: true });
      window.addEventListener('pointerout', onLeave);
    }
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerout', onLeave);
    };
  }, [gl]);

  // Scratch vectors, allocated once. Building a Vector3 inside useFrame is the
  // most common way an r3f scene ends up garbage-collecting mid-gesture, which
  // on a phone is a visible hitch rather than a statistic.
  const fromPos = useRef(new THREE.Vector3());
  const toPos = useRef(new THREE.Vector3());
  const fromLook = useRef(new THREE.Vector3());
  const toLook = useRef(new THREE.Vector3());

  const applyPose = useCallback(() => {
    const p = poseFor(place);
    fromPos.current.set(...p.position);
    fromLook.current.set(...p.target);
    if (p.to) {
      toPos.current.set(...p.to.position);
      toLook.current.set(...p.to.target);
    } else {
      // No scroll path: both ends identical, so progress has no effect and the
      // place is a still frame. Cheaper than branching every frame.
      toPos.current.copy(fromPos.current);
      toLook.current.copy(fromLook.current);
    }
  }, [place]);

  // Seed before the first frame. `target` otherwise starts at the world origin,
  // so the opening frames aim at the floor and swing up — a lurch on entry that
  // reads as a bug rather than a move.
  const seeded = useRef(false);
  if (!seeded.current) {
    applyPose();
    desired.current.copy(fromPos.current);
    look.current.copy(fromLook.current);
    target.current.copy(fromLook.current);
    seeded.current = true;
  }

  useEffect(applyPose, [applyPose]);

  useFrame((_, delta) => {
    const p = poseFor(place);

    // Where scroll says the camera should be, this instant.
    const t = scroll.current;
    if (p.path) {
      // Multi-point spline. curveT remaps the beats' uneven `at` values onto
      // the curve parameter, so scrolling to a beat lands ON the vantage that
      // was rendered and approved rather than near it.
      const u = curveT(t);
      POSITION_CURVE.getPoint(u, desired.current);
      TARGET_CURVE.getPoint(u, look.current);
    } else {
      desired.current.lerpVectors(fromPos.current, toPos.current, t);
      look.current.lerpVectors(fromLook.current, toLook.current, t);
    }

    // Cursor parallax. A few centimetres of camera offset across the whole
    // viewport — deliberately tiny. The scene is a backdrop that text sits on,
    // and a camera that swings to the pointer makes the copy above it feel
    // unstable. Enough to make the canvas feel alive to the hand, not enough to
    // be read as a control.
    if (pointer.current.lengthSq() > 0) {
      desired.current.x += pointer.current.x * PARALLAX;
      desired.current.y += pointer.current.y * PARALLAX * 0.6;
    }

    // Then damp toward it rather than snapping. Scroll is jittery — a trackpad
    // flick, a phone's momentum — and binding the camera rigidly to it makes
    // the room feel nervous. The damping is what turns scrolling into a move.
    //
    // Frame-rate independent: a fixed lerp factor would travel twice as far per
    // second at 120fps as at 60, which is how a move tuned on a desktop ends up
    // sluggish on the phones this has to serve.
    //
    // The time constant IS `scrub`. GSAP's scrub:3 means the tween takes ~3s to
    // catch up to where scroll says it should be, which is a first-order lag —
    // exactly this expression. It was ease/3, so `arrival` lagged by 0.47s:
    // fast enough that the camera arrived with the scroll rather than trailing
    // it, which is the "rigid, mechanical" reading. At SCRUB 2.2 the same pose
    // lags 3.1s and the room keeps moving after the wheel stops, which is the
    // whole effect.
    const k = 1 - Math.exp(-delta / Math.max(0.05, p.ease * SCRUB));
    camera.position.lerp(desired.current, k);
    target.current.lerp(look.current, k);
    camera.lookAt(target.current);
  });

  return null;
}

/** Camera sampling and raycast focus — the events the lead score leans on.
 *  Consent is enforced inside the collector, so there is no second gate here. */
function SpatialTelemetry({ place, tier }: { place: PlaceId; tier: DeviceTier }) {
  const { camera, scene, gl } = useThree();
  const ray = useRef(new THREE.Raycaster());
  const pointer = useRef(new THREE.Vector2(0, 0));
  const since = useRef(0);
  const focusStation = useRef<string | null>(null);
  const focusSince = useRef(0);

  // One place_enter/place_exit pair per place, not per route: opening a surface
  // read from the study does not mean you left it and came back.
  useEffect(() => {
    telemetry.push('place_enter', place, { tier });
    const enteredAt = Date.now();
    return () => {
      telemetry.push('place_exit', place, { dwellMs: Date.now() - enteredAt });
    };
  }, [place, tier]);

  useEffect(() => {
    const el = gl.domElement;
    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      pointer.current.set(
        ((e.clientX - r.left) / r.width) * 2 - 1,
        -((e.clientY - r.top) / r.height) * 2 + 1,
      );
    };
    // pointerdown as well as pointermove: on a phone the tap IS the focus, and
    // without it the highest-value events only ever fire on desktop.
    el.addEventListener('pointermove', onMove, { passive: true });
    el.addEventListener('pointerdown', onMove, { passive: true });
    return () => {
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerdown', onMove);
      if (focusStation.current) {
        telemetry.push('hologram_focus', place, {
          station: focusStation.current,
          dwellMs: Date.now() - focusSince.current,
        });
        focusStation.current = null;
      }
    };
  }, [gl, place]);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (t - since.current < 0.5) return;
    since.current = t;

    telemetry.sampleCamera(place, camera.position.x, camera.position.y, camera.position.z);

    ray.current.setFromCamera(pointer.current, camera);
    const hit = ray.current.intersectObjects(scene.children, true)[0];
    const station = stationOf(hit?.object ?? null);

    if (station !== focusStation.current) {
      if (focusStation.current) {
        telemetry.push('hologram_focus', place, {
          station: focusStation.current,
          dwellMs: Date.now() - focusSince.current,
        });
      }
      focusStation.current = station;
      focusSince.current = Date.now();
    }
  });

  return null;
}

function Rig({
  place,
  onTier,
}: {
  place: PlaceId;
  onTier: (t: DeviceTier) => void;
}) {
  const { tier } = useDeviceTier();
  useEffect(() => onTier(tier), [tier, onTier]);
  return (
    <>
      <CameraRig place={place} />
      <SpatialTelemetry place={place} tier={tier} />
    </>
  );
}

/** A GLB that fails to parse throws inside Suspense, where React swallows it and
 *  the tree never resolves — the scene sits on "loading" forever with nothing in
 *  the console. Invisible to the visitor, undiagnosable for us. */
class SceneBoundary extends Component<
  { children: ReactNode; onError: () => void },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: Error) {
    console.error('World scene failed to load:', error);
    this.props.onError();
  }
  render() {
    if (this.state.failed) return null;
    return this.props.children;
  }
}

function webglSupported(): boolean {
  if (typeof document === 'undefined') return false;
  try {
    return Boolean(document.createElement('canvas').getContext('webgl2'));
  } catch {
    return false;
  }
}

/**
 * Exposure budget for the hall.
 *
 * The bake was calibrated against a scene that had NO environment at all: the
 * drei preset it used to reference was fetched from a CDN our CSP blocks, so it
 * had failed silently since the day it was written. Adding a working
 * environment therefore added light the lightmap never accounted for, and the
 * first render on a real device came back blown to white.
 *
 * The lightmap is the diffuse lighting and it is already correct. The
 * environment exists for specular response on the metals, so it is dialled well
 * below 1 — high enough for a highlight to travel across brass, too low to lift
 * the whole room a second time.
 *
 * Each value is overridable from the query string (?exposure=&env=&ambient=)
 * because these can only honestly be judged on a phone, and a rebuild per guess
 * is a bad loop. Look-dev only; the defaults are what ships.
 */
const LOOK: Record<SceneSet, { exposure: number; env: number; ambient: number }> = {
  interior: {
    // 0.6. Two corrections in, and the second overshot.
    //
    // 1.0 blew the room to white. 0.32 was derived as the reciprocal of the
    // 4.66x lightmap gain, which is right in isolation and wrong in context: it
    // was set at the same time as a scrim that darkens the middle of the frame
    // by another ~54%. Multiplied together the room disappeared, and the home
    // page looked like it had no 3D in it at all. Two fixes for one symptom,
    // each reasonable alone, compounding into the opposite failure.
    //
    // The lightmap is multiplied by 4.66 to restore the range the bake was
    // normalised out of, so the scene arrives at the tone mapper carrying
    // values around 4-5, not 0-1. ACES then maps ~4.0 to almost pure white.
    // Exposure is the reciprocal of that gain.
    //
    // There is no bloom or post-processing in this scene to blame, and ACES was
    // already configured. It was arithmetic.
    exposure: 0.6,
    /** scene.environmentIntensity — specular response only, never a light source. */
    env: 0.1,
    /** Lifts the instanced ornament, which carries no lightmap. Nothing more. */
    ambient: 0.12,
  },
  exterior: {
    // Unit exposure, because there is no lightmap gain to undo here. The
    // interior's 0.6 exists solely to cancel a 4.66x multiplier that this set
    // does not have; applying it out here would darken the facade for no
    // reason. Different model, different grade — which is why the look budget
    // is keyed by set rather than shared.
    exposure: 1.0,
    /** Higher than the interior: the glass and the fountain water are
     *  transmissive and have nothing to refract without an environment. */
    env: 0.45,
    /** Low. The sky comes from the hemisphere light, which is directional
     *  enough to keep the underside of the cornice from going flat. */
    ambient: 0.06,
  },
};

/**
 * Clip planes, per set.
 *
 * The exterior ground plane is 450m square and the camera stands 30m out, so
 * the interior's far:60 would cut the lawn off mid-frame and clip the spire on
 * approach. Near moves out to 0.5 to buy back some of the depth precision that
 * a 1200:1 range costs — there is nothing within half a metre of an outdoor
 * camera that stands on an open axis.
 */
const CLIP: Record<SceneSet, { near: number; far: number }> = {
  interior: { near: 0.1, far: 60 },
  exterior: { near: 0.5, far: 600 },
};

/**
 * Legibility scrim, per set — and much lighter outside than it used to be.
 *
 * The review was right that a heavy DOM gradient is a band-aid, and the fix it
 * asked for is the one applied here: the contrast is now made in WebGL. The
 * exterior renders at dusk against a #0A1120 sky, with fog from 34m matched to
 * that same colour. The top of the frame is therefore GENUINELY dark — it is
 * sky, not an overlay — and the distance behind the building falls away on its
 * own. So the exterior's top stop drops from 0.80 to 0.28 and the radial pass
 * is nearly gone.
 *
 * It is not deleted, and claiming otherwise would be dishonest. The bottom
 * eighth still darkens, because the lawn in the near field is a mid-value
 * surface and the footer sits directly on it; no amount of scene lighting fixes
 * white text on a lit lawn without also ruining the lawn. That residue is the
 * honest minimum, not a substitute for grading the scene.
 *
 * The interior keeps the heavier pass. It is a lightmapped room with bright
 * marble and brass and no sky to sit copy against.
 *
 * Deliberately NOT frosted panels behind each block. Glassmorphism reads as
 * 2021 SaaS and fights the material language of the rest of this build: it
 * announces the UI instead of letting the scene hold it. Cinema has put titles
 * over image for a century with a graded scrim.
 */
const SCRIM: Record<SceneSet, { linear: string; radial: string }> = {
  exterior: {
    linear:
      'linear-gradient(to bottom, rgba(6,10,20,0.28) 0%, rgba(6,10,20,0) 18%, rgba(6,10,20,0) 62%, rgba(6,10,20,0.82) 100%)',
    radial:
      'radial-gradient(130% 88% at 50% 42%, rgba(6,10,20,0) 0%, rgba(6,10,20,0) 62%, rgba(6,10,20,0.22) 100%)',
  },
  interior: {
    linear:
      'linear-gradient(to bottom, rgba(6,10,20,0.80) 0%, rgba(6,10,20,0.10) 22%, rgba(6,10,20,0.10) 58%, rgba(6,10,20,0.88) 100%)',
    radial:
      'radial-gradient(126% 82% at 50% 44%, rgba(6,10,20,0) 0%, rgba(6,10,20,0.12) 58%, rgba(6,10,20,0.46) 100%)',
  },
};

function useLook(set: SceneSet) {
  const base = LOOK[set];
  const [override, setOverride] = useState<Partial<typeof base>>({});
  const [free, setFree] = useState(false);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const num = (k: string) => {
      const v = parseFloat(q.get(k) ?? '');
      return Number.isFinite(v) ? v : undefined;
    };
    setFree(q.get('free') === '1');
    // Only keys actually present in the query string override, so switching
    // sets still picks up that set's defaults for everything untouched.
    const next: Partial<typeof base> = {};
    const e = num('exposure'); if (e !== undefined) next.exposure = e;
    const v = num('env'); if (v !== undefined) next.env = v;
    const a = num('ambient'); if (a !== undefined) next.ambient = a;
    setOverride(next);
  }, []);

  return { ...base, ...override, free };
}

/**
 * Dusk key light for the exterior.
 *
 * The facade has no baked lighting, so without this it is flat cream paint. A
 * single low warm key raking from the front-left is what gives the portico
 * columns their relief and separates the cornice from the wall behind it.
 *
 * The fog is doing real work beyond atmosphere: it is what the client asked for
 * when they said the contrast should be fixed in WebGL rather than with a DOM
 * gradient. Matched to the background colour, it fades the 450m ground plane
 * into the sky so the scene stops being a diorama on a table, and it darkens
 * everything past the building — which is exactly the part of the frame the
 * headings sit over.
 */
function ExteriorLighting({ driveByScroll }: { driveByScroll: boolean }) {
  const scene = useThree((s) => s.scene);
  const scroll = useScrollProgress();
  const key = useRef<THREE.DirectionalLight>(null);

  useEffect(() => {
    const prev = scene.fog;
    scene.fog = new THREE.Fog('#0A1120', 34, 190);
    return () => {
      scene.fog = prev;
    };
  }, [scene]);

  // Atmosphere travels with the camera. The path drops from 30m out to 9m and
  // rises to 6.8m on the way, and a fixed fog band tuned for the wide
  // establishing shot is simply wrong by the time the camera is under the
  // portico — the building would sit in haze at the exact moment it should be
  // most present. Fog closes from 34..190 to 14..95 and the key lifts as the
  // camera arrives.
  useFrame(() => {
    if (!driveByScroll) return;
    const a = atmosphereAt(scroll.current);
    const fog = scene.fog as THREE.Fog | null;
    if (fog && (fog as THREE.Fog).isFog) {
      fog.near = a.near;
      fog.far = a.far;
    }
    if (key.current) key.current.intensity = a.key;
  });

  return (
    <>
      {/* Warm, low, front-left. Angled off the entry axis so the elevation is
          lit across rather than head-on, which would flatten it again. */}
      <directionalLight ref={key} position={[-42, 30, 52]} intensity={2.3} color="#FFD7B0" />
      {/* Cool fill from the sky, warm bounce from the ground. Cheaper than a
          second key and it keeps the shadowed side from reading as black. */}
      <hemisphereLight args={['#5C7099', '#1A1512', 0.55]} />
    </>
  );
}

/** Clip planes have to be pushed onto the live camera and the projection matrix
 *  rebuilt; passing them to <Canvas> only seeds the first one. */
function CameraClipping({ set }: { set: SceneSet }) {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  useEffect(() => {
    camera.near = CLIP[set].near;
    camera.far = CLIP[set].far;
    camera.updateProjectionMatrix();
  }, [camera, set]);
  return null;
}

/**
 * Exposure, applied on every change rather than once at creation.
 *
 * <Canvas onCreated> fires a single time for the life of the canvas, and this
 * canvas deliberately never unmounts — that is the whole reason the experience
 * is a route group. So an exposure set there is the FIRST route's exposure
 * forever. With two sets that need 1.0 and 0.6, navigating from the lawn to the
 * hall would have carried 1.0 onto a surface already multiplied by 4.66, which
 * is the exact blown-to-white failure this project has been rejected for once.
 */
function Exposure({ value }: { value: number }) {
  const gl = useThree((s) => s.gl);
  useEffect(() => {
    gl.toneMappingExposure = value;
  }, [gl, value]);
  return null;
}

/**
 * Reflection environment for the metals, generated on the GPU at runtime.
 *
 * This replaces drei's <Environment preset="apartment" />, which is not a local
 * asset: the preset names an HDRI that drei fetches from raw.githack.com. Our
 * CSP does not allow that host and must not — so on a phone the request was
 * refused, the rejection went unhandled, and it took the whole Canvas down with
 * it. The hall showed its "could not load" fallback while the actual model was
 * fine. An external dependency for a decorative reflection is a bad trade even
 * when it works; it puts a third-party CDN on the critical path of the scene.
 *
 * RoomEnvironment ships inside three, costs one render into a 256px cube, and
 * for an interior it is the more correct choice anyway — it is a box of emissive
 * panels, which is what this room actually is.
 *
 * The generated target is disposed on unmount. PMREM targets are float cube
 * maps and leaking one per navigation would be a real cost on a phone.
 */
function RoomEnvironmentMap({ intensity }: { intensity: number }) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);

  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const room = new RoomEnvironment();
    const target = pmrem.fromScene(room, 0.04);
    scene.environment = target.texture;

    return () => {
      scene.environment = null;
      target.dispose();
      room.dispose?.();
      pmrem.dispose();
    };
  }, [gl, scene]);

  // Separate effect: retuning intensity must not rebuild the cube map.
  useEffect(() => {
    scene.environmentIntensity = intensity;
  }, [scene, intensity]);

  return null;
}

export function WorldCanvas() {
  const pathname = usePathname() || '/';
  const place = placeForRoute(pathname);
  const [tier, setTier] = useState<DeviceTier>('mid');
  const [failed, setFailed] = useState(false);
  const [supported, setSupported] = useState<boolean | null>(null);
  // Which model this route needs. '/' is 'arrival', which is now OUTSIDE.
  const set = setFor(place);
  const look = useLook(set);

  // Probed on mount, not during render, so server and first client render agree.
  useEffect(() => setSupported(webglSupported()), []);
  const onTier = useCallback((t: DeviceTier) => setTier(t), []);
  const onError = useCallback(() => setFailed(true), []);

  if (supported === false || failed) {
    return (
      <div aria-hidden="true" className="fixed inset-0 z-0">
        <SceneFallback reason={supported === false ? 'unsupported' : 'error'} />
      </div>
    );
  }

  return (
    // aria-hidden and non-interactive: the world is the backdrop, and every
    // word a screen reader needs is in the DOM layer above it.
    <div aria-hidden="true" className="fixed inset-0 z-0 bg-[#0A1120]">
      <SceneBoundary onError={onError}>
        <Canvas
          // A 3x phone screen renders 9x the pixels for no perceptible gain on
          // a scene this dark, and it is the single biggest mobile cost.
          dpr={[1, tier === 'high' ? 2 : 1.5]}
          gl={{
            antialias: tier !== 'low',
            powerPreference: 'high-performance',
            // Stated rather than left to the default. The room is lit almost
            // entirely by a baked lightmap at 4.66x, so exposure is the one
            // knob that moves the whole image, and it should be visible here
            // next to the rest of the look budget instead of implied.
            toneMapping: THREE.ACESFilmicToneMapping,
          }}
          onCreated={({ gl }) => {
            gl.toneMappingExposure = look.exposure;
          }}
          // Seeded on the exterior axis, because that is where the site opens.
          // CameraRig takes over on the first frame; this only avoids one frame
          // rendered from the old interior default while it settles.
          camera={{ position: [0, 1.65, 30], fov: 45, ...CLIP.exterior }}
        >
          <color attach="background" args={['#0A1120']} />
          <CameraClipping set={set} />
          <Exposure value={look.exposure} />
          {/* Inside: GI is baked into the lightmap, so a real-time rig would
              double-count it and this only lifts the instanced ornament, which
              carries no lightmap because instancing and per-placement UVs are
              exclusive. Outside: kept very low, because the sky is the
              hemisphere light and a flat ambient would cancel the relief the
              key light exists to create. */}
          <ambientLight intensity={look.ambient} />
          {set === 'exterior' && <ExteriorLighting driveByScroll={poseFor(place).path === true} />}
          <Suspense fallback={null}>
            {/* One set at a time. Both are ~2.3MB and 15MB respectively, and
                holding the hall in memory while standing on the lawn buys
                nothing — drei caches the parse, so coming back is instant. */}
            {set === 'exterior' ? <ExteriorModel /> : <HallModel />}
            {/* Metals need something to reflect or they read as flat paint;
                outside, the glass and fountain water need it to refract. */}
            <RoomEnvironmentMap intensity={look.env} />
          </Suspense>
          {look.free ? <FreeCamera /> : <Rig place={place} onTier={onTier} />}
        </Canvas>
      </SceneBoundary>

      {/*
        The scrim, now carrying far less of the load — see SCRIM above.
        pointer-events-none: this must never intercept a tap meant for the
        canvas beneath or the copy above.
      */}
      <div
        className="pointer-events-none absolute inset-0 z-[1]"
        style={{ background: SCRIM[set].linear }}
      />
      <div
        className="pointer-events-none absolute inset-0 z-[1]"
        style={{ background: SCRIM[set].radial }}
      />
    </div>
  );
}
