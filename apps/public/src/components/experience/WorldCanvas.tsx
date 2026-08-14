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
import { useDeviceTier } from './useDeviceTier';
import { poseFor } from './poses';
import { useScrollProgress } from './useScrollProgress';
import { SceneFallback } from './SceneFallback';
import { telemetry } from '@/lib/telemetry/collector';

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
  const { camera } = useThree();
  const target = useRef(new THREE.Vector3());
  const desired = useRef(new THREE.Vector3());
  const look = useRef(new THREE.Vector3());
  const scroll = useScrollProgress();

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
    desired.current.lerpVectors(fromPos.current, toPos.current, t);
    look.current.lerpVectors(fromLook.current, toLook.current, t);

    // Then damp toward it rather than snapping. Scroll is jittery — a trackpad
    // flick, a phone's momentum — and binding the camera rigidly to it makes
    // the room feel nervous. The damping is what turns scrolling into a move.
    //
    // Frame-rate independent: a fixed lerp factor would travel twice as far per
    // second at 120fps as at 60, which is how a move tuned on a desktop ends up
    // sluggish on the phones this has to serve.
    const k = 1 - Math.exp(-delta / Math.max(0.05, p.ease / 3));
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
const LOOK = {
  // 0.32, not 1.0. This is the number that was blowing the room to white.
  //
  // The lightmap is multiplied by 4.66 to restore the range the bake was
  // normalised out of, so the scene arrives at the tone mapper carrying values
  // around 4-5, not 0-1. ACES then maps ~4.0 to almost pure white. Exposure is
  // the reciprocal of that gain, so it belongs near 1/4.66 - not at the default
  // nobody had reconsidered after the lightmap intensity was chosen.
  //
  // There is no bloom or post-processing in this scene to blame, and ACES was
  // already configured. It was arithmetic.
  exposure: 0.32,
  /** scene.environmentIntensity — specular response only, never a light source. */
  env: 0.1,
  /** Lifts the instanced ornament, which carries no lightmap. Nothing more. */
  ambient: 0.12,
};

function useLook() {
  const [look, setLook] = useState(LOOK);
  const [free, setFree] = useState(false);
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const num = (k: string, d: number) => {
      const v = parseFloat(q.get(k) ?? '');
      return Number.isFinite(v) ? v : d;
    };
    setFree(q.get('free') === '1');
    setLook({
      exposure: num('exposure', LOOK.exposure),
      env: num('env', LOOK.env),
      ambient: num('ambient', LOOK.ambient),
    });
  }, []);
  return { ...look, free };
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
  const look = useLook();

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
          camera={{ position: [4.2, 1.65, -4.6], fov: 45, near: 0.1, far: 60 }}
        >
          <color attach="background" args={['#0A1120']} />
          {/* GI is baked into the lightmap. A real-time rig would double-count
              it; this only lifts the instanced ornament, which carries no
              lightmap because instancing and per-placement UVs are exclusive. */}
          <ambientLight intensity={look.ambient} />
          <Suspense fallback={null}>
            <HallModel />
            {/* Metals need something to reflect or they read as flat paint. */}
            <RoomEnvironmentMap intensity={look.env} />
          </Suspense>
          {look.free ? <FreeCamera /> : <Rig place={place} onTier={onTier} />}
        </Canvas>
      </SceneBoundary>

      {/*
        The scrim. Copy has to stay legible whatever the camera is looking at,
        and the room cannot be trusted to be dark behind any particular line.

        Deliberately NOT frosted panels behind each block. Glassmorphism reads
        as 2021 SaaS and fights the material language of the rest of this build:
        it announces the UI instead of letting the room hold it. Cinema has been
        putting titles over image for a century with a graded scrim, and that is
        what this is — dense where the copy sits, open through the middle so the
        room is never boxed in.

        Two gradients, not one wash. A flat overlay costs the same contrast
        everywhere and flattens the depth that justifies having a 3D room at
        all. The vertical pass protects the top and bottom thirds where headings
        and footers live; the radial pass keeps the centre clear.

        pointer-events-none: this must never intercept a tap meant for the
        canvas beneath or the copy above.
      */}
      <div
        className="pointer-events-none absolute inset-0 z-[1]"
        style={{
          background:
            'linear-gradient(to bottom, rgba(6,10,20,0.86) 0%, rgba(6,10,20,0.34) 24%, rgba(6,10,20,0.34) 60%, rgba(6,10,20,0.94) 100%)',
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 z-[1]"
        style={{
          background:
            'radial-gradient(122% 78% at 50% 44%, rgba(6,10,20,0) 0%, rgba(6,10,20,0.30) 60%, rgba(6,10,20,0.70) 100%)',
        }}
      />
    </div>
  );
}
