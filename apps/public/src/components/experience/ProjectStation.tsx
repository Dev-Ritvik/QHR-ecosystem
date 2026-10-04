'use client';

// apps/public/src/components/experience/ProjectStation.tsx
//
// One station, driven by one project. Four stations in the model, N published
// projects in the database, one component — never <Project1 />, <Project2 />.
//
// WHAT THIS DOES NOT DO: create geometry, or rearrange it. The final Blender
// delivery ships the rig this component needs, already assembled:
//
//   STATION_Sn
//    ├── HOLO_Sn                       (the floating plan)
//    ├── projector_Sn                  (stationary — deliberately outside)
//    │    └── projlens_Sn
//    └── TURNTABLE_Sn                  <- the only thing that rotates
//         ├── table_base_Sn
//         ├── table_inlay_Sn
//         └── table_top_Sn
//
// So the job here is to find `TURNTABLE_Sn` and turn it. Nothing else.
//
// WHAT THIS FILE USED TO DO, AND WHY IT NO LONGER DOES
//
// The previous interior GLB had NO hierarchy — all 504 nodes were children of
// the scene root, with world positions baked into the vertices. There was no
// turntable to rotate and no pivot at the table's axis, so this component built
// one: it created a Group at the measured station centre and `attach()`ed five
// `pedestal_*` meshes into it, preserving world transforms across the
// re-parent, and reversed the whole operation on unmount.
//
// That was a workaround for a missing rig, and the rig now exists. Every line
// of it is deleted rather than kept "just in case", because a re-parent that
// silently no-ops when its target names are absent is the kind of code that
// looks like it is working right up until someone wonders why the table does
// not turn.
//
// Two more things went with it:
//
//   * The runtime marquetry texture. The old pedestal was a lathe-turned drum —
//     rotationally symmetric, so turning it changed not one pixel. This file
//     drew a sixteen-wedge rosette onto a canvas and projected disc UVs onto
//     the inlay so the rotation had something to read against. The delivered
//     table is asymmetric in GEOMETRY (sunburst veneer, twelve brass strings,
//     and a compass rose whose north point runs long), so the rotation is
//     legible at any angle without help.
//
//   * `projectDiscUVs`. It existed only to feed that texture.
//
// The interaction model itself — pointer capture, scroll lock, inertia, idle
// drift, the separate hologram target — is unchanged and was verified working
// against the previous asset. Only the thing being rotated has changed.

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useThree, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import type { StationAnchor } from './interiorPath';
import { StationDressing, type StationDetails } from './StationDressing';
import { StationModel } from './StationModel';
import { stationStyle } from './stationStyle';
import {
  clicksSuppressed,
  lockCanvasScroll,
  stationControls,
  suppressClicks,
} from './stationControls';

export interface StationProject {
  slug: string;
  name: string;
  locality: string;
  city: string;
}

/**
 * Per-station frame callbacks, keyed by station id.
 *
 * A module-level map rather than a useFrame inside each station: r3f runs every
 * subscriber in its own callback, and four stations each installing one is four
 * closures per frame to do a few radians of arithmetic. The parent runs them
 * all from the single loop it already has.
 */
const tickRefs = new Map<string, (delta: number) => void>();

export function tickStations(delta: number) {
  for (const fn of tickRefs.values()) fn(delta);
}

/**
 * Table geometry, measured from the delivered GLB rather than assumed.
 *
 * `table_top_S1` spans x −8.42..−7.27 around a station centre of −7.85 (the
 * stations moved out with the walls when the hall was extended; the tables
 * themselves are unchanged, being the room's human scale): a
 * radius of 0.575, so Ø1.15 m. Its upper surface sits at y 0.80, with
 * `table_inlay_S1` coplanar at 0.80 and `table_base_S1` running 0.00..0.75.
 *
 * These replace 0.96 / r 0.34 — the old Ø0.58 m pedestal. Getting them wrong
 * matters for more than looks: the drag proxy is what the pointer actually
 * hits, so a proxy sized to the old drum would leave two thirds of the visible
 * table dead to the cursor.
 */
const TABLE_TOP = 0.8;
const TABLE_RADIUS = 0.6;

/**
 * How much of the camera's attention a station needs before it accepts input.
 *
 * The point of the gate is that a hologram behind the camera must not be a
 * click target — not that the visitor has to catch a precise scroll position.
 * It was 0.35, which was far too tight: MEASURED mid-chapter, with the plan
 * filling a third of the frame and the cursor correctly showing a pointer,
 * emphasis was 0.37. A visitor a few pixels of scroll either way would have
 * seen the affordance and had the click do nothing.
 */
const ACTIVE = 0.15;

export function ProjectStation({
  root,
  anchor,
  project,
  emphasis,
  onOpen,
}: {
  /** The loaded hall scene. Read-only — nothing is re-parented. */
  root: THREE.Object3D | null;
  anchor: StationAnchor;
  /** Null for a table with no published project behind it: it still turns,
   *  but its hologram opens nothing. */
  project: StationProject | null;
  /** 0..1 — how much the camera is on this station right now. A ref, so this
   *  component never re-renders at scroll frequency. */
  emphasis: React.MutableRefObject<number>;
  onOpen: (slug: string) => void;
}) {
  const gl = useThree((s) => s.gl);
  const [cx, , cz] = anchor.position;
  /** A site model on a stand, or the plan projected in light (stationStyle.ts). */
  const style = stationStyle();

  const turntable = useRef<THREE.Object3D | null>(null);
  /** Where the drag started, and the table's angle at that moment. */
  const drag = useRef<{ x: number; from: number } | null>(null);
  /** Angular velocity carried after release, so the table coasts to rest. */
  const spin = useRef(0);
  const hovering = useRef(false);
  /** True while any drag holds this table - its own proxy's, or one picked up
   *  from elsewhere in the room by useDragAnywhere. */
  const held = useRef(false);
  /** Pointer travel of the current proxy drag, so a real drag suppresses the
   *  click r3f would otherwise also report. */
  const travel = useRef(0);

  // ── Bind to the exported turntable ───────────────────────────────────────
  //
  // A lookup, not surgery. If the node is missing the station simply does not
  // rotate — and says so once, rather than failing silently, because a missing
  // TURNTABLE_Sn means the export lost the rig and that is worth knowing.
  useEffect(() => {
    if (!root) {
      turntable.current = null;
      return;
    }
    const node = root.getObjectByName(`TURNTABLE_${anchor.id}`) ?? null;
    if (!node) {
      // eslint-disable-next-line no-console
      console.warn(
        '[station] TURNTABLE_%s not found in the hall model — the table will not rotate. ' +
          'The export must preserve the STATION_*/TURNTABLE_* empties (see tools/blender/export_web.py).',
        anchor.id,
      );
    }
    turntable.current = node;
    return () => {
      // Leave the rig exactly as loaded. drei caches the parse and shares it
      // across mounts, so a rotation left applied here would persist into the
      // next mount as a table that starts at a random angle.
      if (node) node.rotation.y = 0;
      turntable.current = null;
    };
  }, [root, anchor.id]);

  // ── DRAG TO ROTATE ───────────────────────────────────────────────────────
  //
  // Pointer capture on the proxy, so a drag that leaves the small on-screen
  // area of the table still tracks — without it the table stops turning the
  // moment the cursor crosses onto the wall behind it, which reads as the
  // interaction breaking.
  //
  // The page must not scroll while a drag is in progress. Scroll drives the
  // camera on this page, so a wheel or a swipe during a drag would move the
  // viewer away from the table they are holding.
  const setScrollLock = useCallback(
    (locked: boolean) => lockCanvasScroll(gl.domElement, locked),
    [gl],
  );

  // NO EMPHASIS GATE ON THE DRAG. It was gated on the camera's attention like the
  // hologram click, and that is why a table would not turn until the camera was
  // nearly on it. A pointer that lands on a table is unambiguous about which
  // table it means, from any distance; only the CLICK that navigates keeps its
  // gate, because a hologram behind the camera must never open a page.
  const onDown = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      if (!turntable.current) return;
      e.stopPropagation();
      (e.target as Element | null)?.setPointerCapture?.(e.pointerId);
      drag.current = { x: e.clientX, from: turntable.current.rotation.y };
      held.current = true;
      travel.current = 0;
      spin.current = 0;
      setScrollLock(true);
      document.body.style.cursor = 'grabbing';
    },
    [setScrollLock],
  );

  const onMove = useCallback((e: ThreeEvent<PointerEvent>) => {
    const d = drag.current;
    const g = turntable.current;
    if (!d || !g) return;
    e.stopPropagation();
    // Radians per pixel. 0.006 puts a half-turn at ~260px of travel, which is
    // roughly a thumb's width on a phone and a comfortable wrist on a mouse.
    const next = d.from + (e.clientX - d.x) * 0.006;
    travel.current = Math.max(travel.current, Math.abs(e.clientX - d.x));
    spin.current = next - g.rotation.y;
    g.rotation.y = next;
  }, []);

  const endDrag = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      if (!drag.current) return;
      e.stopPropagation();
      (e.target as Element | null)?.releasePointerCapture?.(e.pointerId);
      drag.current = null;
      held.current = false;
      if (travel.current > 6) suppressClicks();
      setScrollLock(false);
      document.body.style.cursor = hovering.current ? 'grab' : '';
    },
    [setScrollLock],
  );

  // Inertia and idle drift, driven from the parent's frame loop via this ref so
  // the station does not register a useFrame of its own per instance.
  const tick = useCallback(
    (delta: number) => {
      const g = turntable.current;
      if (!g || drag.current || held.current) return;
      if (Math.abs(spin.current) > 1e-5) {
        // Coast, then settle. Exponential decay rather than a fixed step so the
        // slowdown is frame-rate independent.
        g.rotation.y += spin.current;
        spin.current *= Math.exp(-delta * 3.2);
      } else if (style === 'hologram') {
        // Idle: a very slow turn while the camera is on this station, so the
        // table advertises that it moves before anyone touches it. Stops when
        // the camera leaves, so an off-screen table is not burning frames.
        // Under the projection only: a site model turns with its table
        // (StationModel), and a model someone is reading holds still.
        g.rotation.y += delta * 0.055 * emphasis.current;
      }
    },
    [emphasis, style],
  );

  // Registered in an effect, not during render: a render-phase side effect runs
  // twice under StrictMode and leaves a stale closure in the map on the first
  // pass.
  useEffect(() => {
    tickRefs.set(anchor.id, tick);
    return () => {
      tickRefs.delete(anchor.id);
    };
  }, [anchor.id, tick]);

  // Publish this table to input that starts elsewhere in the room.
  useEffect(() => {
    stationControls.set(anchor.id, {
      id: anchor.id,
      centre: new THREE.Vector3(cx, TABLE_TOP, cz),
      turntable,
      spin,
      emphasis,
      proxyDrag: drag,
      held,
    });
    return () => {
      stationControls.delete(anchor.id);
    };
  }, [anchor.id, cx, cz, emphasis]);

  // ── HOVER / CURSOR ───────────────────────────────────────────────────────
  const enter = useCallback(
    (cursor: string) => (e: ThreeEvent<PointerEvent>) => {
      if (emphasis.current < ACTIVE) return;
      e.stopPropagation();
      hovering.current = true;
      document.body.style.cursor = cursor;
    },
    [emphasis],
  );
  // The grab affordance follows the drag, which is no longer gated.
  const grabCursor = useCallback((e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    hovering.current = true;
    if (!drag.current) document.body.style.cursor = 'grab';
  }, []);
  const leave = useCallback((e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    hovering.current = false;
    if (!drag.current) document.body.style.cursor = '';
  }, []);

  const slug = project?.slug ?? null;
  const openProject = useCallback(
    (e: ThreeEvent<MouseEvent>) => {
      if (!slug || emphasis.current < ACTIVE || clicksSuppressed()) return;
      e.stopPropagation();
      document.body.style.cursor = '';
      onOpen(slug);
    },
    [emphasis, onOpen, slug],
  );

  // Hologram hit volume. Sized from the delivered plan: `holo3d_S1_blocks`
  // occupies roughly 0.8 x 0.6 x 1.05 with its annotation cards reaching a
  // little wider, so this is generous by a few centimetres — the target should
  // be comfortable at the scale the camera holds it.
  const holoBox = useMemo<[number, number, number]>(() => [1.05, 0.8, 1.3], []);

  return (
    <group position={[cx, 0, cz]}>
      {/* The projector, its beam and the hologram's words (StationDressing).
          Sceneless: it dresses nodes inside the hall, so its position here
          is irrelevant. The store's cards carry the plot counts beside the
          fields StationProject names. */}
      {style === 'hologram' ? (
        <StationDressing
          root={root}
          anchor={anchor}
          project={project as StationDetails | null}
          emphasis={emphasis}
        />
      ) : (
        <StationModel
          root={root}
          anchor={anchor}
          project={project as (StationDetails & { slug?: string }) | null}
          turntable={turntable}
        />
      )}
      {/* TABLE PROXY — the drag surface.
          A proxy rather than the table meshes themselves: raycasting 3,688
          triangles on every pointer move to decide whether a drag started is
          real cost for an answer a cylinder gives exactly. `visible={false}`
          would remove it from the raycast entirely, so it is transparent with
          depthWrite off instead. */}
      <mesh
        // Named so the interaction can be AIMED AT and therefore verified. The
        // proxy is invisible and unnamed by nature, so an end-to-end test had
        // nothing to target and was reduced to projecting the TURNTABLE node
        // and hoping the ray landed — which it did not, because the turntable's
        // origin sits on the floor and its top edge only grazes the cylinder.
        // A name costs nothing and turns "the table turns" into something that
        // can be asserted rather than assumed.
        name={`station_drag_${anchor.id}`}
        position={[0, TABLE_TOP / 2, 0]}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onPointerOver={grabCursor}
        onPointerOut={leave}
      >
        <cylinderGeometry args={[TABLE_RADIUS, TABLE_RADIUS, TABLE_TOP, 20]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      {/* HOLOGRAM PROXY — the click target that opens the project.
          Separate from the table on purpose: dragging the table must not
          navigate, and clicking the plan must not spin the table.
          Anchored to this station's own HOLO_Sn height, which differs per
          station (1.505 / 1.401 / 1.441 / 1.441) — a single shared constant
          would leave three of the four targets misaligned with their plan. */}
      <mesh
        name={`station_holo_${anchor.id}`}
        position={[0, anchor.holoY, 0]}
        onClick={openProject}
        onPointerOver={slug ? enter('pointer') : undefined}
        onPointerOut={leave}
      >
        <boxGeometry args={holoBox} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  );
}
