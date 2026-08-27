'use client';

// apps/public/src/components/experience/InteriorStage.tsx
//
// Everything interactive inside the hall, and the single frame loop that drives
// it.
//
// The stations, the portrait and the hologram emphasis all need the same
// number — where the camera is on the interior leg — and all of them would
// otherwise install a useFrame of their own to get it. This owns one loop,
// computes the number once, and hands it out. That is the same correction
// already made for scroll in useScrollProgress.ts, applied to the layer above.
//
// WHAT IS AND IS NOT ACCESSIBLE HERE, STATED HONESTLY
//
// The canvas is aria-hidden, deliberately and correctly: it is a backdrop, and
// a screen reader should not be asked to narrate a camera move. So NOTHING in
// this file is reachable by keyboard, and pretending otherwise by bolting an
// <Html> focus target inside an aria-hidden subtree would be worse than not
// trying — it would be a focus stop that announces nothing.
//
// The keyboard and screen-reader equivalent is the DOM, which already carries
// it: every station's project is a real <a href="/projects/slug"> in the page
// beneath the canvas, in the same order the camera visits them, and the
// portrait's destination is the About link in the site header and footer. The
// 3D interactions are an enhancement over a page that works without them.

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { ProjectStation, tickStations, type StationProject } from './ProjectStation';
import {
  STATION_ANCHORS,
  buildInteriorBeats,
  stationEmphasis,
  type InteriorBeat,
} from './interiorPath';

/**
 * The portrait, measured from the GLB.
 *
 * portrait_canvas spans x -1.00..1.00, y 2.90..5.70, z -5.19..-5.16 — a 2.0 x
 * 2.8m canvas on the back wall above the landing, with portrait_frame_outer,
 * portrait_rebate and portrait_glass around it and a dedicated spot (LGT_
 * portrait) that the bake already contains.
 */
const PORTRAIT = {
  centre: [0, 4.3, -5.1] as [number, number, number],
  size: [2.3, 3.1, 0.24] as [number, number, number],
};

/** Materials whose emissive strength is driven by station emphasis. The
 *  hologram should be strongest when the camera is on it and fall back to a
 *  low idle glow otherwise — a room with four holograms all at full output
 *  reads as a server rack, not as a showroom. */
const HOLO_MATERIALS = /^MAT_Holo/;

interface HoloTarget {
  mat: THREE.MeshStandardMaterial;
  /** The emissive intensity the GLB shipped, which is the top of the range. */
  base: number;
  station: string | null;
}

export function InteriorStage({
  root,
  projects,
  /** Progress along the INTERIOR leg only, 0..1. Owned by the caller, which is
   *  the only place that knows how the whole journey is divided. */
  legProgress,
  onOpen,
}: {
  root: THREE.Object3D | null;
  projects: StationProject[];
  legProgress: React.MutableRefObject<number>;
  onOpen: (href: string) => void;
}) {
  const beats: InteriorBeat[] = useMemo(
    () => buildInteriorBeats(projects.length),
    [projects.length],
  );

  // One ref per station, written by the loop below and read by the station.
  // Refs rather than state for the usual reason: this changes every frame and
  // must never re-render the tree.
  const emphasis = useRef<Record<string, { current: number }>>({});
  for (const a of STATION_ANCHORS) {
    if (!emphasis.current[a.id]) emphasis.current[a.id] = { current: 0 };
  }

  const portraitEmphasis = useRef(0);
  const portraitHover = useRef(0);
  const portraitFrame = useRef<THREE.Mesh | null>(null);

  // ── Collect the hologram materials once per load ─────────────────────────
  const holos = useRef<HoloTarget[]>([]);
  useEffect(() => {
    if (!root) {
      holos.current = [];
      return;
    }
    const found: HoloTarget[] = [];
    const seen = new Set<THREE.Material>();
    root.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const m = mesh.material;
      const list = Array.isArray(m) ? m : [m];
      for (const mat of list) {
        if (!mat || !HOLO_MATERIALS.test(mat.name)) continue;
        const std = mat as THREE.MeshStandardMaterial;
        if (seen.has(std)) continue;
        seen.add(std);
        // The station is read from the MATERIAL name, not the node name.
        //
        // This was the other way round, and it was wrong. MAT_Holo3D_Side,
        // _Card and _Rule are SHARED by all four stations' plans, so keying off
        // the mesh assigned each shared material to whichever station happened
        // to be traversed first — and then drove every station's extrusion
        // sides and leader lines from that one station's emphasis. With the
        // camera on Lucky Garden, its leader lines were following Kartikeya.
        //
        // Only the per-station materials carry a suffix (MAT_Holo3D_Plate_S2,
        // MAT_Holo3D_Top_S2). Everything else is genuinely shared and is driven
        // below by the strongest emphasis, which is the honest answer for a
        // material that belongs to no single station.
        const suffix = /_(S[1-4])$/.exec(std.name);
        found.push({
          mat: std,
          base: std.emissiveIntensity ?? 1,
          station: suffix ? suffix[1] : null,
        });
      }
    });
    holos.current = found;
    return () => {
      // Put the shipped values back. drei caches the parsed GLTF and shares
      // material instances across mounts, so leaving these at whatever the last
      // frame wrote would make a remount start mid-fade.
      for (const h of found) h.mat.emissiveIntensity = h.base;
      holos.current = [];
    };
  }, [root]);

  // ── STATIONS WITH NO PROJECT ─────────────────────────────────────────────
  //
  // Four stations ship; three projects are published. The delivery disables the
  // fourth at source as far as it can — MAT_Holo3D_Plate_S4 is alphaMode MASK
  // with a base alpha of 0, and MAT_Holo3D_Top_S4 carries no emissive — so S4
  // cannot leak S3's name or plan. That is the correctness half, and it is done.
  //
  // It is not the whole picture. Parsing the file shows holo3d_S4_blocks also
  // uses MAT_Holo3D_Side (emissive white at strength 4) for its extrusion
  // sides, and all twelve of its annotation meshes use MAT_Holo3D_Rule
  // (strength 9). Those three materials are SHARED with S1..S3, so the artist
  // could not darken them for S4 without darkening the three live stations too.
  // Left alone, the fourth table would carry a glowing, blank, project-shaped
  // hologram — which is precisely the "accidentally broken" read the brief
  // rules out.
  //
  // Only the runtime knows how many projects are published, so only the runtime
  // can resolve this. The whole HOLO_Sn subtree is hidden for any station
  // without data. What remains is the table, the projector and its lens: a real
  // piece of furniture with a projector that is simply not switched on, which is
  // the architectural breathing point the brief asks for rather than an error
  // state. Publish a fourth project and it lights up with no code change.
  useEffect(() => {
    if (!root) return;
    const hidden: THREE.Object3D[] = [];
    for (let i = projects.length; i < STATION_ANCHORS.length; i += 1) {
      const holo = root.getObjectByName(`HOLO_${STATION_ANCHORS[i].id}`);
      if (holo && holo.visible) {
        holo.visible = false;
        hidden.push(holo);
      }
    }
    return () => {
      for (const h of hidden) h.visible = true;
    };
  }, [root, projects.length]);

  // ── THE ONE LOOP ─────────────────────────────────────────────────────────
  useFrame((_, delta) => {
    const s = legProgress.current;

    for (const a of STATION_ANCHORS) {
      emphasis.current[a.id].current = stationEmphasis(beats, s, a.id);
    }

    // The portrait is the last beat, so its emphasis is simply how far into the
    // final leg the viewer is.
    const portraitBeat = beats[beats.length - 1];
    const prev = beats[beats.length - 2];
    const from = prev ? prev.at : 0.85;
    portraitEmphasis.current = Math.min(
      1,
      Math.max(0, (s - from) / Math.max(1e-3, portraitBeat.at - from)),
    );

    // Hologram output. A station's plan sits at a low idle and lifts to the
    // strength the GLB shipped as the camera arrives, so the room has one
    // subject at a time.
    //
    // Materials with no station (the shared rules and cards) track the strongest
    // station, so the leader lines brighten with whichever plan is active
    // instead of flickering between four.
    let strongest = 0;
    for (const a of STATION_ANCHORS) {
      strongest = Math.max(strongest, emphasis.current[a.id].current);
    }
    for (const h of holos.current) {
      const e = h.station ? (emphasis.current[h.station]?.current ?? 0) : strongest;
      // MEASURED, not guessed. At an idle floor of 0.28 the plan's base plate
      // sat at emissiveIntensity 0.73 against a room exposed at 1.0, and read
      // in a real frame as a black rectangle on the table rather than as a
      // projection — verified by reading the live material off the scene graph
      // while the camera stood between two stations.
      //
      // 0.42 keeps an unvisited plan present without competing, and the peak
      // now goes slightly ABOVE the strength the GLB shipped so the active
      // station is unambiguously the brightest thing in frame. Still under the
      // bloom threshold: this is a projection, not a lamp.
      h.mat.emissiveIntensity = h.base * (0.42 + 0.78 * e);
    }

    // Portrait: a light response rather than a scale. The frame's emissive lifts
    // as the camera arrives, and again on hover — the picture catching more of
    // its own spot, which is what a portrait under a gallery light does when you
    // step toward it.
    const fr = portraitFrame.current;
    if (fr) {
      const mat = fr.material as THREE.MeshBasicMaterial;
      const want = portraitEmphasis.current * (0.1 + 0.5 * portraitHover.current);
      mat.opacity += (want - mat.opacity) * Math.min(1, delta * 6);
    }

    tickStations(delta);
  });

  // ── Portrait interaction ─────────────────────────────────────────────────
  const portraitEnter = useCallback((e: ThreeEvent<PointerEvent>) => {
    if (portraitEmphasis.current < 0.15) return;
    e.stopPropagation();
    portraitHover.current = 1;
    document.body.style.cursor = 'pointer';
  }, []);

  const portraitLeave = useCallback((e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    portraitHover.current = 0;
    document.body.style.cursor = '';
  }, []);

  const portraitClick = useCallback(
    (e: ThreeEvent<MouseEvent>) => {
      if (portraitEmphasis.current < 0.15) return;
      e.stopPropagation();
      document.body.style.cursor = '';
      onOpen('/about');
    },
    [onOpen],
  );

  const openProject = useCallback(
    (slug: string) => onOpen(`/projects/${slug}`),
    [onOpen],
  );

  return (
    <>
      {projects.map((p, i) =>
        i < STATION_ANCHORS.length ? (
          <ProjectStation
            key={p.slug}
            root={root}
            anchor={STATION_ANCHORS[i]}
            project={p}
            emphasis={emphasis.current[STATION_ANCHORS[i].id]}
            onOpen={openProject}
          />
        ) : null,
      )}

      {/* PORTRAIT — hit volume and light response.
          The hit box stands 12cm proud of the wall so a click near the frame
          edge still lands; the canvas itself is only 3cm deep. */}
      <mesh
        position={PORTRAIT.centre}
        onClick={portraitClick}
        onPointerOver={portraitEnter}
        onPointerOut={portraitLeave}
      >
        <boxGeometry args={PORTRAIT.size} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      {/* The response itself: a soft warm plane just in front of the canvas,
          additively blended. Not a scale, not an outline — the brief is
          explicit that hover should read as light and focus rather than as a
          CSS transform, and additive light over a painting is what a gallery
          does. depthWrite off so it never occludes the frame it sits on. */}
      <mesh ref={portraitFrame} position={[0, 4.3, -5.08]} renderOrder={2}>
        <planeGeometry args={[2.5, 3.35]} />
        <meshBasicMaterial
          color="#F2D9A8"
          transparent
          opacity={0}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </mesh>
    </>
  );
}
