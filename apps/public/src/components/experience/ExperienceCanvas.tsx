// apps/public/src/components/experience/ExperienceCanvas.tsx
//
// SLICE 0 / STEP 2 — the persistence skeleton, not the art.
//
// This proves the load-bearing claim of FRONTEND_ARCHITECTURE §3.1: a WebGL
// canvas mounted in a route-GROUP layout survives navigation between pages in
// that segment, because App Router re-renders only page.tsx. If that holds, the
// camera/scene can own continuous state across "page changes" — the whole
// cinematic-flight model depends on it.
//
// The on-screen probe is the evidence:
//   • CTX  — a uid minted once per WebGL context creation. Must NOT change
//            when navigating /about ↔ /why-us. If it changes, the context was
//            destroyed and recreated → architecture invalidated.
//   • GEN  — how many contexts have been created this page-load.
//   • CLOCK— r3f clock elapsed time. Must run continuously across navigation.
// The drifting copper orb is the same proof, visually: its position is derived
// from the clock, so a remount would visibly snap it back to its origin.
'use client';

import { Canvas, useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import type { Mesh } from 'three';
import { Perf } from 'r3f-perf';

/**
 * Module scope deliberately: this state must outlive React component
 * instances so a remount is detectable rather than invisible.
 */
const probe = {
  generation: 0,
  uid: '—',
};

type ProbeRefs = {
  ctx: React.RefObject<HTMLSpanElement>;
  gen: React.RefObject<HTMLSpanElement>;
  clock: React.RefObject<HTMLSpanElement>;
};

function VoidScene({ refs }: { refs: ProbeRefs }) {
  const orb = useRef<Mesh>(null);
  const tick = useRef(0);

  useFrame((state) => {
    const t = state.clock.elapsedTime;

    if (orb.current) {
      // Motion derived purely from the clock — no React state, no allocations.
      orb.current.position.x = Math.sin(t * 0.32) * 2.6;
      orb.current.position.z = Math.cos(t * 0.32) * 2.6;
      orb.current.position.y = 0.85 + Math.sin(t * 0.7) * 0.14;
    }

    // Update the probe ~6×/sec by writing textContent directly. Using React
    // state here would re-render the tree containing <Canvas> 6×/sec — the
    // exact per-frame-churn discipline the architecture's budget calls for.
    tick.current += 1;
    if (tick.current % 10 === 0) {
      if (refs.clock.current) refs.clock.current.textContent = `${t.toFixed(1)}s`;
      if (refs.ctx.current) refs.ctx.current.textContent = probe.uid;
      if (refs.gen.current) refs.gen.current.textContent = String(probe.generation);
    }
  });

  return (
    <>
      <color attach="background" args={['#0A1120']} />
      <fog attach="fog" args={['#060A14', 6, 26]} />

      <ambientLight intensity={0.12} />
      <pointLight position={[0, 2.6, 0]} intensity={14} color="#E8B98A" distance={16} decay={2} />

      {/* Placeholder for the black-glass floor (real reflection lands in Slice 0 proper) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.4, 0]} receiveShadow={false}>
        <planeGeometry args={[80, 80]} />
        <meshStandardMaterial color="#0B1424" metalness={0.92} roughness={0.3} />
      </mesh>

      {/* Clock-derived drifting ember — the visual persistence tell */}
      <mesh ref={orb}>
        <sphereGeometry args={[0.2, 32, 32]} />
        <meshStandardMaterial
          color="#C08A5D"
          emissive="#C08A5D"
          emissiveIntensity={2.4}
          toneMapped={false}
        />
      </mesh>

      {process.env.NODE_ENV === 'development' && <Perf position="bottom-right" />}
    </>
  );
}

export function ExperienceCanvas() {
  const refs: ProbeRefs = {
    ctx: useRef<HTMLSpanElement>(null),
    gen: useRef<HTMLSpanElement>(null),
    clock: useRef<HTMLSpanElement>(null),
  };

  return (
    <>
      <div className="fixed inset-0 z-0" aria-hidden="true">
        <Canvas
          camera={{ position: [0, 1.4, 6], fov: 45 }}
          dpr={[1, 2]}
          gl={{ antialias: true, powerPreference: 'high-performance' }}
          onCreated={({ gl }) => {
            probe.generation += 1;
            probe.uid = Math.random().toString(36).slice(2, 8).toUpperCase();
            // Context loss must be observable, never silent (architecture §12).
            gl.domElement.addEventListener('webglcontextlost', (e) => {
              e.preventDefault();
              console.warn('[ExperienceCanvas] WebGL context lost');
            });
          }}
        >
          <VoidScene refs={refs} />
        </Canvas>
      </div>

      {/* Temporary instrumentation — removed once Step 2 is signed off. */}
      <div
        data-testid="persistence-probe"
        className="pointer-events-none fixed bottom-4 left-4 z-50 rounded-md border border-[#C08A5D]/25 bg-[#060A14]/80 px-3 py-2 font-mono text-[11px] leading-relaxed text-[#E8B98A] backdrop-blur-sm"
      >
        <div>
          CTX <span ref={refs.ctx} data-testid="probe-ctx">—</span>
        </div>
        <div>
          GEN <span ref={refs.gen} data-testid="probe-gen">0</span>
        </div>
        <div>
          CLOCK <span ref={refs.clock} data-testid="probe-clock">0.0s</span>
        </div>
      </div>
    </>
  );
}
