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
import { Environment } from '@react-three/drei';
import * as THREE from 'three';
import { placeForRoute, type PlaceId } from '@estate/domain/experience/places';
import type { DeviceTier } from '@estate/domain/telemetry/device-tier';
import { HallModel } from './HallModel';
import { useDeviceTier } from './useDeviceTier';
import { poseFor } from './poses';
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
function CameraRig({ place }: { place: PlaceId }) {
  const { camera } = useThree();
  const target = useRef(new THREE.Vector3());
  const desired = useRef(new THREE.Vector3());
  const look = useRef(new THREE.Vector3());

  useEffect(() => {
    const p = poseFor(place);
    desired.current.set(...p.position);
    look.current.set(...p.target);
  }, [place]);

  useFrame((_, delta) => {
    const p = poseFor(place);
    // Frame-rate independent damping: a fixed lerp factor would move twice as
    // fast at 120fps as at 60, which is how a move tuned on a desktop ends up
    // feeling sluggish on the phones this has to serve.
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

export function WorldCanvas() {
  const pathname = usePathname() || '/';
  const place = placeForRoute(pathname);
  const [tier, setTier] = useState<DeviceTier>('mid');
  const [failed, setFailed] = useState(false);
  const [supported, setSupported] = useState<boolean | null>(null);

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
          gl={{ antialias: tier !== 'low', powerPreference: 'high-performance' }}
          camera={{ position: [4.2, 1.65, -4.6], fov: 45, near: 0.1, far: 60 }}
        >
          <color attach="background" args={['#0A1120']} />
          {/* GI is baked into the lightmap. A real-time rig would double-count
              it; this only lifts the instanced ornament, which carries no
              lightmap because instancing and per-placement UVs are exclusive. */}
          <ambientLight intensity={0.35} />
          <Suspense fallback={null}>
            <HallModel />
            {/* Metals need something to reflect or they read as flat paint. */}
            <Environment preset="apartment" background={false} />
          </Suspense>
          <Rig place={place} onTier={onTier} />
        </Canvas>
      </SceneBoundary>
    </div>
  );
}
