'use client';

// apps/public/src/components/experience/HallScene.tsx
//
// The interactive hall. Mounts the baked model, measures the device, and emits
// the spatial telemetry the lead score depends on.
//
// The lighting here is deliberately thin: global illumination is BAKED into the
// lightmap, so adding a rig of real-time lights would double-count it and wash
// the room out. What remains is a low ambient to lift the parts that carry no
// lightmap (the instanced ornament) and an environment for the metals — a metal
// with nothing to reflect renders as flat paint.

import { Component, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Environment, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { HallModel } from './HallModel';
import { useDeviceTier } from './useDeviceTier';
import { telemetry } from '@/lib/telemetry/collector';
import { SceneFallback } from './SceneFallback';
import type { DeviceTier } from '@estate/domain/telemetry/device-tier';

const PLACE_ID = 'hall';

/** Names come from the Blender build: holo3d_S1_blocks / S2 / S3. */
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

/** Camera sampling + raycast focus. Both are consent-gated inside the collector,
 *  so there is no second gate to keep in sync here. */
function SpatialTelemetry({ tier }: { tier: DeviceTier }) {
  const { camera, scene, gl } = useThree();
  const ray = useRef(new THREE.Raycaster());
  const pointer = useRef(new THREE.Vector2(0, 0));
  const since = useRef(0);
  const focusStation = useRef<string | null>(null);
  const focusSince = useRef(0);

  useEffect(() => {
    telemetry.push('place_enter', PLACE_ID, { tier });
    const enteredAt = Date.now();
    const el = gl.domElement;

    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      pointer.current.set(
        ((e.clientX - r.left) / r.width) * 2 - 1,
        -((e.clientY - r.top) / r.height) * 2 + 1,
      );
    };
    // Touch counts: on mobile the tap point IS the focus, and without this the
    // highest-value events would only ever fire on desktop.
    el.addEventListener('pointermove', onMove, { passive: true });
    el.addEventListener('pointerdown', onMove, { passive: true });

    return () => {
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerdown', onMove);
      // Close any open focus before leaving, or its dwell is lost entirely.
      if (focusStation.current) {
        telemetry.push('hologram_focus', PLACE_ID, {
          station: focusStation.current,
          dwellMs: Date.now() - focusSince.current,
        });
      }
      telemetry.push('place_exit', PLACE_ID, { dwellMs: Date.now() - enteredAt });
    };
  }, [gl, tier]);

  useFrame((state) => {
    // Camera at ~2Hz; the collector aggregates into 5s buckets before dispatch.
    const t = state.clock.elapsedTime;
    if (t - since.current >= 0.5) {
      since.current = t;
      telemetry.sampleCamera(
        PLACE_ID,
        camera.position.x,
        camera.position.y,
        camera.position.z,
      );

      ray.current.setFromCamera(pointer.current, camera);
      const hit = ray.current.intersectObjects(scene.children, true)[0];
      const station = stationOf(hit?.object ?? null);

      if (station !== focusStation.current) {
        if (focusStation.current) {
          telemetry.push('hologram_focus', PLACE_ID, {
            station: focusStation.current,
            dwellMs: Date.now() - focusSince.current,
          });
        }
        focusStation.current = station;
        focusSince.current = Date.now();
      }
    }
  });

  return null;
}

function Rig({ onTier }: { onTier: (t: DeviceTier, settled: boolean) => void }) {
  const { tier, settled } = useDeviceTier();
  useEffect(() => onTier(tier, settled), [tier, settled, onTier]);
  return <SpatialTelemetry tier={tier} />;
}

/** A GLB that fails to parse throws inside Suspense, where React swallows it
 *  and the tree simply never resolves — the scene sits on "loading" forever with
 *  nothing in the console. That is the worst possible failure mode: invisible to
 *  the visitor and undiagnosable for us. This turns it into both. */
class SceneBoundary extends Component<
  { children: ReactNode; onError: (e: Error) => void },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: Error) {
    console.error('Hall scene failed to load:', error);
    this.props.onError(error);
  }
  render() {
    if (this.state.failed) return <SceneFallback reason="error" />;
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

export function HallScene() {
  const [tier, setTier] = useState<DeviceTier>('mid');
  const [info, setInfo] = useState<{ promoted: number; meshes: number; tris: number } | null>(null);
  const [failed, setFailed] = useState(false);
  // Probe once on mount rather than during render, so the server and the first
  // client render agree and hydration does not mismatch.
  const [supported, setSupported] = useState<boolean | null>(null);
  useEffect(() => setSupported(webglSupported()), []);

  const onError = useCallback(() => setFailed(true), []);

  const onTier = useCallback((t: DeviceTier) => setTier(t), []);

  const onSelect = useCallback((e: { object: THREE.Object3D }) => {
    const station = stationOf(e.object);
    if (station) {
      telemetry.push('hologram_parcel_select', PLACE_ID, { station });
    }
  }, []);

  // Every hook above this line, unconditionally: an early return placed before
  // them changes the hook order between renders and React tears the component
  // down. Caught by react-hooks/rules-of-hooks, which is why the lint gate on
  // this app was worth setting up.
  if (supported === false || failed) {
    return (
      <div className="relative h-[70vh] w-full">
        <SceneFallback reason={supported === false ? 'unsupported' : 'error'} />
      </div>
    );
  }

  return (
    <div className="relative h-[70vh] w-full bg-neutral-950">
      <SceneBoundary onError={onError}>
      <Canvas
        // Cap DPR: a 3x phone screen renders 9x the pixels for no perceptible
        // gain on a scene this dark, and it is the single biggest mobile cost.
        dpr={[1, tier === 'high' ? 2 : 1.5]}
        gl={{ antialias: tier !== 'low', powerPreference: 'high-performance' }}
        camera={{ position: [4.2, 1.65, -4.6], fov: 45, near: 0.1, far: 60 }}
        onPointerMissed={undefined}
      >
        <color attach="background" args={['#0b0b0c']} />

        {/* GI is baked; this only lifts the instanced ornament, which carries
            no lightmap because instancing and per-placement UVs are exclusive. */}
        <ambientLight intensity={0.35} />
        <Suspense fallback={null}>
          <HallModel onReady={setInfo} />
          {/* Metals need something to reflect. Without this the gold reads as
              flat paint regardless of how correct the material is. */}
          <Environment preset="apartment" background={false} />
        </Suspense>

        <Rig onTier={onTier} />
        <OrbitControls
          target={[0, 1.5, 0]}
          maxPolarAngle={Math.PI / 2.05}
          minDistance={1.5}
          maxDistance={12}
          enableDamping
        />
        <group onClick={onSelect} />
      </Canvas>
      </SceneBoundary>

      {/* Load state, and a readable statement of what actually arrived. */}
      <div className="pointer-events-none absolute bottom-3 left-3 font-mono text-[10px] uppercase tracking-widest text-neutral-500">
        {info
          ? `tier ${tier} · ${info.meshes} meshes · ${info.tris.toLocaleString()} tris · ${info.promoted} lightmapped`
          : 'loading hall…'}
      </div>
    </div>
  );
}
