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
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { ProjectStation, tickStations, type StationProject } from './ProjectStation';
import { establishCopyGone, journeyState, tableCopyHold } from './journey';
import {
  clicksSuppressed,
  lockCanvasScroll,
  setCanvasTouchBase,
  stationControls,
  suppressClicks,
  type StationControl,
} from './stationControls';
import {
  STATION_ANCHORS,
  buildInteriorBeats,
  beatEmphasis,
  stationEmphasis,
  type InteriorBeat,
} from './interiorPath';
import { PortraitNameplate } from './PortraitNameplate';
import { PortraitBeam } from './PortraitBeam';
import { WindowLight } from './WindowLight';
import { hallEnv } from './HallModel';
import { registerHallRoot } from './doorPortal';
import { isShown, warmHallPrograms } from './hallProbe';
import { lensSubject } from './LensFocus';
import { HALL_CODA, HALL_READING, hallLight, houseKeys, houseLevelAt } from './hallLight';
import { MAP_TABLE, mapStage } from './mapTablePlan';
import {
  HEADER_BAND,
  codaFilter,
  codaFilterClear,
  headerBandReach,
  lensFilter,
  phoneRoomFilter,
  stationFilter,
  tableBandFilter,
} from './lensFilter';
import { copyPresence, copyZone, filmIsWide } from './copyZone';
import { stationStyle } from './stationStyle';

/**
 * The portrait, measured from the GLB.
 *
 * Since the hall was made imperial (imperial_hall_v7.py), portrait_canvas spans
 * x -1.31..1.31, y 5.20..8.87, with portrait_frame_outer at x -1.51..1.51,
 * y 5.00..9.07 and its back on the wall face at z -7.70 — a quarter larger than
 * before, hung on an arched walnut panel over the central landing (4.2 m up),
 * with portrait_rebate and portrait_glass around it, the nameplate below it
 * (PortraitNameplate.tsx) and a dedicated spot (LGT_portrait) that the bake
 * already contains.
 */
const PORTRAIT = {
  centre: [0, 7.035, -7.58] as [number, number, number],
  size: [3.02, 4.07, 0.3] as [number, number, number],
};

/** Materials whose emissive strength is driven by station emphasis. The
 *  hologram should be strongest when the camera is on it and fall back to a
 *  low idle glow otherwise — a room with four holograms all at full output
 *  reads as a server rack, not as a showroom. */
const HOLO_MATERIALS = /^MAT_Holo/;

/**
 * Emphasis every station holds on a page with no scroll choreography (/hall).
 * Chosen so a hologram's emissive lands exactly where the GLB shipped it
 * (0.6 + 0.6 x 0.667 = 1.0), which is how /hall looked before the interaction
 * layer was mounted there, and clears the ACTIVE gate so its hologram answers.
 * (It was 0.74 against the pre-old-money idle of 0.42 + 0.78e.)
 */
const STILL_EMPHASIS = 0.667;

/**
 * DRAG ANYWHERE IN THE ROOM TO TURN A TABLE.
 *
 * The client review turned a table from across the hall, got nothing, and only
 * found the rotation after walking up to it. A drag that starts on a table's own
 * proxy is still handled by the station; this picks up every horizontal drag
 * that starts anywhere else on the canvas while the visitor is inside, and hands
 * it to one table:
 *
 *   - the station the camera is on, when it has the camera's attention;
 *   - otherwise the table whose top projects nearest the point where the drag
 *     began, among the tables actually in front of the camera.
 *
 * It only claims a gesture once it is clearly horizontal (8 px, and wider than
 * tall), so a click still clicks and a vertical swipe still scrolls: the canvas
 * sits at touch-action pan-y while this is mounted. A drag it claims suppresses
 * the click r3f would report at its end, so letting go over a hologram or the
 * portrait does not open a page.
 */
function useDragAnywhere(mode: 'journey' | 'still') {
  const gl = useThree((s) => s.gl);
  const camera = useThree((s) => s.camera);

  useEffect(() => {
    const el = gl.domElement;
    setCanvasTouchBase(el, 'pan-y');
    const P = new THREE.Vector3();

    let start: { id: number; x: number; y: number } | null = null;
    let claim: { ctl: StationControl; from: number } | null = null;

    const inside = () => mode === 'still' || journeyState.leg === 'interior';

    const pick = (x: number, y: number): StationControl | null => {
      let focus: StationControl | null = null;
      let focusE = 0.15;
      if (mode === 'journey') {
        for (const c of stationControls.values()) {
          if (c.turntable.current && c.emphasis.current >= focusE) {
            focus = c;
            focusE = c.emphasis.current;
          }
        }
        if (focus) return focus;
      }
      const r = el.getBoundingClientRect();
      let nearest: StationControl | null = null;
      let best = Infinity;
      for (const c of stationControls.values()) {
        if (!c.turntable.current) continue;
        P.copy(c.centre).project(camera);
        // Behind the camera, or well outside the frame: not a table anyone is
        // looking at.
        if (P.z > 1 || Math.abs(P.x) > 1.15 || Math.abs(P.y) > 1.15) continue;
        const sx = r.left + ((P.x + 1) / 2) * r.width;
        const sy = r.top + ((1 - P.y) / 2) * r.height;
        const d = Math.hypot(sx - x, sy - y);
        if (d < best) {
          best = d;
          nearest = c;
        }
      }
      return nearest;
    };

    const onDown = (e: PointerEvent) => {
      if (!inside() || !e.isPrimary) return;
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      start = { id: e.pointerId, x: e.clientX, y: e.clientY };
      claim = null;
    };

    const onMove = (e: PointerEvent) => {
      if (!start || e.pointerId !== start.id) return;
      if (!claim) {
        // A drag that began on a table's own proxy belongs to that station.
        for (const c of stationControls.values()) {
          if (c.proxyDrag.current) {
            start = null;
            return;
          }
        }
        const dx = e.clientX - start.x;
        const dy = e.clientY - start.y;
        if (Math.abs(dx) < 8 || Math.abs(dx) < Math.abs(dy) * 1.2) {
          // Clearly vertical: that is a scroll, not a turn. Let it go.
          if (Math.abs(dy) > 14) start = null;
          return;
        }
        const ctl = pick(start.x, start.y);
        const g = ctl?.turntable.current;
        if (!ctl || !g) {
          start = null;
          return;
        }
        claim = { ctl, from: g.rotation.y };
        ctl.held.current = true;
        ctl.spin.current = 0;
        el.setPointerCapture?.(e.pointerId);
        lockCanvasScroll(el, true);
        document.body.style.cursor = 'grabbing';
      }
      const g = claim.ctl.turntable.current;
      if (!g) return;
      // Same ratio as a drag on the table itself: ~260 px for a half turn.
      const next = claim.from + (e.clientX - start.x) * 0.006;
      claim.ctl.spin.current = next - g.rotation.y;
      g.rotation.y = next;
    };

    const onEnd = (e: PointerEvent) => {
      if (!start || e.pointerId !== start.id) return;
      if (claim) {
        el.releasePointerCapture?.(e.pointerId);
        claim.ctl.held.current = false;
        lockCanvasScroll(el, false);
        document.body.style.cursor = '';
        suppressClicks();
      }
      start = null;
      claim = null;
    };

    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onEnd);
    el.addEventListener('pointercancel', onEnd);
    return () => {
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onEnd);
      el.removeEventListener('pointercancel', onEnd);
      if (claim) claim.ctl.held.current = false;
      setCanvasTouchBase(el, '');
      document.documentElement.style.overscrollBehavior = '';
    };
  }, [gl, camera, mode]);
}

interface HoloTarget {
  mat: THREE.MeshStandardMaterial;
  /** The emissive intensity the GLB shipped, which is the top of the range. */
  base: number;
  station: string | null;
}

const HALL_DEV =
  typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('debug') === '1';

export function InteriorStage({
  root,
  projects,
  /** Progress along the INTERIOR leg only, 0..1. Owned by the caller, which is
   *  the only place that knows how the whole journey is divided. */
  legProgress,
  onOpen,
  mode = 'journey',
  stillLevel = HALL_READING,
}: {
  root: THREE.Object3D | null;
  projects: StationProject[];
  legProgress: React.MutableRefObject<number>;
  onOpen: (href: string) => void;
  /** 'journey' on the home page's scroll film; 'still' on /hall, where there is
   *  no choreography for a station to take emphasis from. */
  mode?: 'journey' | 'still';
  /** The house lights on a still (hallLight.hallReadingLevel): the reading
   *  level, and the room's own on the page that is the room. */
  stillLevel?: number;
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

  useDragAnywhere(mode);

  // THE STAGE IS SHOWN WHEN THE HALL IS. On the journey it mounts as the hall
  // arms, on the lawn, and its own pieces — the hit boxes, the portrait's light,
  // the nameplate — are not under the hall's hidden group: they drew outside
  // for the whole approach, and their first draw compiled the nameplate's
  // programs under the exterior's lights. MEASURED 1.4 s of getProgramInfoLog
  // in that frame, mid-scroll, for programs recompiled again at the door.
  // Instead they compile here as the hall arrives, under the hall's own light
  // state and off the main thread (hallProbe.ts, warmHallPrograms).
  const gl = useThree((s) => s.gl);
  const camera = useThree((s) => s.camera);
  const stage = useRef<THREE.Group>(null);
  useEffect(() => {
    if (!root || !stage.current) return;
    void warmHallPrograms(gl, camera, stage.current, hallEnv.stand);
    // And the stage is part of the hall the doorway shows (HallPortal).
    return registerHallRoot(stage.current);
  }, [root, gl, camera]);

  const portraitEmphasis = useRef(0);

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

  // ── THE PROJECTORS SIT ON THEIR TABLES ───────────────────────────────────
  //
  // Measured from the GLB: every table top is at y 0.80, and every projector_Sn
  // spans y 0.955..1.045 with its lens above - a 9 cm puck hanging 15.5 cm over
  // the table. The client review read it, correctly, as a second floating object
  // under the hologram. The hologram is meant to be the only thing in the air.
  //
  // So each projector is lowered until its base rests on its own table top,
  // measured per station from the loaded meshes rather than assumed. It stays
  // outside the turntable, as the rig was built: the client's own brief is that
  // only the table turns and the rest of the system holds still. Restored on
  // unmount, because the hall's node instances outlive this component.
  useEffect(() => {
    if (!root) return;
    root.updateMatrixWorld(true);
    const moved: { node: THREE.Object3D; y: number }[] = [];
    const box = new THREE.Box3();
    for (const a of STATION_ANCHORS) {
      const projector = root.getObjectByName(`projector_${a.id}`);
      const top = root.getObjectByName(`table_top_${a.id}`);
      if (!projector || !top) continue;
      const surface = box.setFromObject(top).max.y;
      const base = box.setFromObject(projector).min.y;
      const dy = surface - base;
      if (Math.abs(dy) < 0.002) continue;
      moved.push({ node: projector, y: projector.position.y });
      // STATION_Sn carries no rotation or scale, so a world offset is a local one.
      projector.position.y += dy;
      projector.updateMatrixWorld(true);
    }
    return () => {
      for (const m of moved) {
        m.node.position.y = m.y;
        m.node.updateMatrixWorld(true);
      }
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
    // /hall shows the room exactly as delivered; only the journey knows how many
    // projects are live.
    if (!root || mode === 'still') return;
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
  }, [root, projects.length, mode]);

  // The lens must not keep a subject this stage no longer draws.
  useEffect(
    () => () => {
      lensSubject.weight = 0;
    },
    [],
  );

  // THE HOUSE LIGHTS (hallLight.ts), keyed to the path and to how long each
  // chapter's copy is up: dim in the ivory room while its copy stands on the
  // plaster, up through the turn once that copy has gone, and up at each
  // table for as long as its copy stands. Between keys, eased.
  const keys = useMemo(
    () => houseKeys(beats, tableCopyHold(projects.length), establishCopyGone(projects.length)),
    [beats, projects.length],
  );

  useEffect(
    () => () => {
      hallLight.level = 1;
      mapStage.emphasis = 0;
      lensFilter.stops = 0;
      lensFilter.top = 0;
      codaFilterClear();
      headerBandReach();
    },
    [],
  );

  const stationWeights = useMemo<Record<string, number>>(() => ({}), []);
  /** How much of the establishing copy's filter is on, eased (0..1). */
  const establishNd = useRef(0);

  // ── THE ONE LOOP ─────────────────────────────────────────────────────────
  useFrame((_, delta) => {
    const s = legProgress.current;
    {
      // A still is a reading page: the house lights at a reading light
      // (readingLight.ts). The film sets its own level by where the camera is.
      let want = mode === 'still' ? stillLevel : houseLevelAt(keys, s);
      // The coda (WorldCanvas): past the film's end the house lights go down
      // round the map table, whose own light stays — and not to nothing: the
      // table stands on the court's stone to the last frame (HALL_CODA).
      if (mode !== 'still') want *= 1 - (1 - HALL_CODA) * journeyState.coda;
      // Look-dev only (?debug=1): window.__estateHall.level holds the house
      // lights at a level, so a beat's level can be judged on a running build
      // before it is written into hallLight.ts.
      if (HALL_DEV) {
        const dev = (window as unknown as { __estateHall?: { level?: number } }).__estateHall;
        if (dev && typeof dev.level === 'number') want = dev.level;
      }
      hallLight.level += (want - hallLight.level) * Math.min(1, delta * 3);
    }
    if (stage.current) stage.current.visible = isShown(root);

    for (const a of STATION_ANCHORS) {
      emphasis.current[a.id].current =
        mode === 'still' ? STILL_EMPHASIS : stationEmphasis(beats, s, a.id);
    }
    // The lens's edge at the tables whose copy stands on ivory (lensFilter).
    // The header's band across the top of the lens: on the film only (a
    // still's page has a bar behind its header).
    lensFilter.top = mode === 'still' ? 0 : HEADER_BAND.hall;
    if (mode === 'still') {
      lensFilter.stops = 0;
      codaFilterClear();
      headerBandReach();
    } else {
      // The lens's edge, for as long as the copy it is for is up: the weights
      // are the chapters' own opacities (copyZone), not the camera's beat —
      // the copy outlives the beat.
      for (const a of STATION_ANCHORS) stationWeights[a.id] = 0;
      stationWeights.portrait = 0;
      stationWeights.establish = 0;
      for (const p of copyZone.panes) {
        const m = /^station-(\d+)$/.exec(p.id);
        if (m) stationWeights[`S${m[1]}`] = copyPresence(p.weight);
        else if (p.id === 'portrait') stationWeights.portrait = copyPresence(p.weight);
        else if (p.id === 'establish') stationWeights.establish = copyPresence(p.weight);
      }
      // The establishing copy's half stop COMES ON, it does not appear: the
      // door lands the page where that copy is already a quarter up, and its
      // filter stood at full on the first frame inside — MEASURED, the lower
      // left of the picture forty per cent darker from one frame to the next.
      // A third of a second, either way.
      establishNd.current += (stationWeights.establish - establishNd.current) * Math.min(1, delta * 6);
      stationWeights.establish = establishNd.current;
      // The page's own question (copyZone.filmIsWide): a column down the left
      // of a wide frame, or across the top or foot of any other.
      const wide = filmIsWide(window.innerWidth, window.innerHeight);
      stationFilter(stationWeights, wide, window.innerWidth / Math.max(1, window.innerHeight));
      if (wide) headerBandReach();
      else {
        // The grad that rides with the reframed chapters' copy, and the
        // header's band down over the tables' (lensFilter.ts; phoneFraming.ts).
        phoneRoomFilter(copyZone.panes, delta);
        tableBandFilter(copyZone.panes, delta, stationStyle() === 'model');
      }
      // And the film's last light, for the colophon that comes up over it:
      // the lens closes down while any of its lines stands on the map table.
      codaFilter(copyZone.lines, mapStage.screen, delta, copyZone.remaining);
    }

    // The portrait's own beat, found by id: it is no longer the last beat of
    // the leg (see beatEmphasis).
    portraitEmphasis.current = mode === 'still' ? 0 : beatEmphasis(beats, s, 'portrait');
    // The map table's (MapTable.tsx): its pins are targets only while the film
    // is on it. /hall has no path, so there it is always on.
    mapStage.emphasis = mode === 'still' ? 1 : beatEmphasis(beats, s, 'map');

    // THE LENS SUBJECT (LensFocus): the station the camera is most on, or the
    // portrait once the climb begins. Squared, so the long lens only closes
    // down as the camera settles on a subject and the traverses stay sharp.
    // /hall has no choreography to take a subject from, so it stays sharp.
    if (mode === 'still') {
      lensSubject.weight = 0;
    } else {
      let best = 0;
      let subject: (typeof STATION_ANCHORS)[number] | null = null;
      for (const a of STATION_ANCHORS) {
        const e = emphasis.current[a.id].current;
        if (e > best) {
          best = e;
          subject = a;
        }
      }
      if (mapStage.emphasis > best && mapStage.emphasis > portraitEmphasis.current) {
        // The long lens on the table: the relief sharp, the court behind it
        // soft.
        lensSubject.point.set(MAP_TABLE.x, MAP_TABLE.topY + 0.03, MAP_TABLE.z);
        lensSubject.weight = mapStage.emphasis ** 2;
      } else if (portraitEmphasis.current > best) {
        lensSubject.point.set(...PORTRAIT.centre);
        lensSubject.weight = portraitEmphasis.current ** 2;
      } else if (subject) {
        lensSubject.point.set(subject.position[0], subject.holoY, subject.position[2]);
        lensSubject.weight = best ** 2;
      } else {
        lensSubject.weight = 0;
      }
    }

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
      // OLD-MONEY PASS: 0.42 -> 0.6 at idle. The plan now prints as a gilded
      // site model rather than a glow, and its solid blocks have a black base:
      // at 0.42 an unvisited station, seen across the room from the
      // establishing shot, read as a dark lump over its table. At 0.6 it is a
      // quiet gilt maquette, still clearly below the station being looked at.
      h.mat.emissiveIntensity = h.base * (0.6 + 0.6 * e);
    }

    // (The portrait has no light response. It had one: a warm additive plane
    // over the canvas that lifted as the camera arrived and again under the
    // pointer, and on hover it bleached the print to a pale ghost of itself.
    // The client had it taken off, 2026-10-01: "remove the hover effect on this
    // image". The portrait is still the way to the About page, and the pointer
    // still says so.)

    tickStations(delta);
  });

  // ── Portrait interaction ─────────────────────────────────────────────────
  const portraitEnter = useCallback((e: ThreeEvent<PointerEvent>) => {
    if (portraitEmphasis.current < 0.15) return;
    e.stopPropagation();
    document.body.style.cursor = 'pointer';
  }, []);

  const portraitLeave = useCallback((e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    document.body.style.cursor = '';
  }, []);

  const portraitClick = useCallback(
    (e: ThreeEvent<MouseEvent>) => {
      if (portraitEmphasis.current < 0.15 || clicksSuppressed()) return;
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

  // On the journey a station exists for each published project. On /hall every
  // delivered table turns, whether or not a project is published behind it.
  const stations =
    mode === 'still'
      ? STATION_ANCHORS.map((a, i) => ({ anchor: a, project: projects[i] ?? null }))
      : projects
          .slice(0, STATION_ANCHORS.length)
          .map((p, i) => ({ anchor: STATION_ANCHORS[i], project: p as StationProject | null }));

  return (
    <group ref={stage} visible={false}>
      {stations.map(({ anchor, project }) => (
        <ProjectStation
          key={anchor.id}
          root={root}
          anchor={anchor}
          project={project}
          emphasis={emphasis.current[anchor.id]}
          onOpen={openProject}
        />
      ))}

      {/* PORTRAIT — its hit volume.
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

      {/* THE NAMEPLATE — the client review asked for the portrait to carry
          "respect and authority", and the answer agreed was a nameplate with
          the name and title. Built here rather than in the GLB so the wording
          can change without a re-export and a re-bake. */}
      <PortraitNameplate />
      {/* The picture light's beam, made visible (PortraitBeam.tsx). */}
      <PortraitBeam />
      {/* The clerestory's light in the air (WindowLight.tsx). */}
      <WindowLight />
    </group>
  );
}
