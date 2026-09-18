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
  useMemo,
  useRef,
  useState,
} from 'react';
import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { placeForRoute, type PlaceId } from '@estate/domain/experience/places';
import type { DeviceTier } from '@estate/domain/telemetry/device-tier';
import { HallModel } from './HallModel';
import { ExteriorModel } from './ExteriorModel';
import { useDeviceTier } from './useDeviceTier';
import { poseFor, setFor, type SceneSet } from './poses';
import {
  exteriorPoseAt,
  atmosphereAt,
  lensAt,
  CONSTELLATION,
  CONSTELLATION_RADIUS,
  FILM_SHARE,
} from './cameraPath';
import {
  ScrollProgressDriver,
  readScrollProgress,
  scrollExtent,
  syncScrollProgress,
  useScrollProgress,
} from './useScrollProgress';
import { SceneFallback } from './SceneFallback';
import { PostFX } from './PostFX';
import { Motes } from './Motes';
import { useSceneCards } from './useSceneCards';
import { telemetry } from '@/lib/telemetry/collector';
import {
  buildInteriorBeats,
  interiorCurves,
  interiorCurveT,
  interiorLensAt,
  CHAPTER_WEIGHTS,
} from './interiorPath';
import { CROSSOVER, journeyState, readJourney } from './journey';
import { cancelDive, diveProgress, diveState, prefersReducedMotion } from './dive';
import {
  CUT_MS,
  DOORWAY,
  cancelDoorway,
  doorwayState,
  noteDoorwayInput,
  setDoorwayHost,
  stepDoorway,
  whiteGradient,
} from './doorway';
import { ExteriorDoorway } from './DoorwayRig';
import { lenisInstance } from './SmoothScroll';
import { Constellation } from './Constellation';
import { InteriorStage } from './InteriorStage';
import { CityField } from './CityField';
import { veiledPush } from '@/components/site/RouteVeil';

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
// Was 2.2, which put `arrival` (ease 1.4) at a 3.1s lag. Stacked on top of
// Lenis's own lerp 0.1 that is a COMPOUND delay - two first-order lags in
// series - and the result drags rather than sweeps. Lenis already supplies the
// smoothing; the rig only needs enough to absorb frame jitter.
const SCRUB = 0.12;

/** Metres of camera offset at full pointer deflection. Small on purpose - see
 *  the note at the call site. */
const PARALLAX = 0.42;

/**
 * Metres the aim is pushed LEFT of the subject, in CAMERA space.
 *
 * A world-space target offset cannot do this. The camera orbits from theta -8
 * to 90, so screen-left starts as -x and ends as +z: any fixed world offset
 * that frames correctly at the hero has rotated to the wrong side of frame by
 * the footer. Offsetting along the camera's own right vector holds the building
 * in the right 60% for the WHOLE orbit, which is what the DOM's 40vw column
 * requires — the typography must never touch the architecture.
 */
const FRAME_OFFSET = 7.4;

// RectAreaLight renders black without this — it needs its BRDF lookup textures
// initialised before any such light is constructed. Module scope so it runs
// exactly once regardless of how many lights mount.
RectAreaLightUniformsLib.init();

// THE SWING EASE now lives in cameraPath.ts (SWING, exteriorSwing), with its
// history, beside the beats it paces — the approach chapter gave the exterior
// leg two curves, and the ease has to know where one hands over to the other.

/** Extra intensity on the entry bay's area light with the front doors fully
 *  open and lit — the spill from the doorway onto the portico and the steps. */
const PORTICO_GLOW = 7;

const UP = new THREE.Vector3(0, 1, 0);

/** One scratch vector for the dive's endpoint. Module-level because the frame
 *  loop must not allocate. */
const TMP = new THREE.Vector3();

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

function CameraRig({ place, stationCount }: { place: PlaceId; stationCount: number }) {
  const { camera, gl } = useThree();

  // The interior half of the journey. Rebuilt only when the number of published
  // projects changes, which in practice is never during a session — but the
  // beat list is derived from data and pretending otherwise is how a path ends
  // up hardcoded to whatever was in the database the day it was written.
  const interior = useMemo(() => {
    const beats = buildInteriorBeats(stationCount);
    return { beats, ...interiorCurves(beats) };
  }, [stationCount]);
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
  const fwd = useRef(new THREE.Vector3());
  const right = useRef(new THREE.Vector3());
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

  // A DIVE IS INTERRUPTIBLE. Any scroll cancels it — the visitor has changed
  // their mind and the camera belongs to the film again — and it is cancelled
  // on unmount so a canvas rebuilt on the next route cannot inherit a move
  // whose destination is in another scene.
  useEffect(() => {
    const onScroll = () => cancelDive();
    window.addEventListener('wheel', onScroll, { passive: true });
    window.addEventListener('touchmove', onScroll, { passive: true });
    window.addEventListener('keydown', onScroll);
    return () => {
      window.removeEventListener('wheel', onScroll);
      window.removeEventListener('touchmove', onScroll);
      window.removeEventListener('keydown', onScroll);
      cancelDive();
    };
  }, []);

  useFrame((_, delta) => {
    const p = poseFor(place);

    // Where scroll says the camera should be, this instant.
    const t = scroll.current;
    // How far the aim is pushed left of the subject at this instant. Read from
    // the active leg rather than from a constant — see CameraBeat.frameOffset.
    let offset = FRAME_OFFSET;

    if (p.path) {
      // TWO LEGS, ONE TRACK.
      //
      // The journey crosses two models with separate origins, so there is no
      // single curve that spans it. `journeyState` says which leg is live and
      // how far into it; each leg then runs exactly the same machinery it ran
      // when it was the only one.
      //
      // ONE continuous ease PER LEG.
      //
      // The ease was applied per SEGMENT once, which was wrong for the reason
      // an inOut ease has zero derivative at both ends: easing each segment
      // drove the velocity to zero at every waypoint and the camera braked at
      // all five beats. Applying it once across a leg leaves the velocity
      // continuous everywhere inside it. It now comes to rest at four points
      // rather than two — the start and end of each leg — and those are
      // exactly the two moments the veil is closed, so the stop is invisible.
      if (journeyState.leg === 'interior') {
        const s = journeyState.legProgress;
        // RAW leg progress, not SWING(s). The interior eases per SEGMENT inside
        // interiorCurveT — see the note there — so a second global ease on top
        // would compound into a curve that arrives at every station late and
        // leaves it late, and would break the exact correspondence between a
        // beat and the DOM chapter laid out on the same weight.
        const u = interiorCurveT(interior.beats, s);
        interior.position.getPoint(u, desired.current);
        interior.target.getPoint(u, look.current);
        // Inside, the copy column is over a wall rather than over sky, and the
        // subject is a table 2.4m away rather than a building 28m away. A 7.4m
        // aim offset at that distance would point the camera at the skirting
        // beside the station. Small and fixed.
        offset = 0.55;
      } else {
        const s = journeyState.legProgress;
        exteriorPoseAt(s, desired.current, look.current);
        offset = lensAt(s).frameOffset;
      }
    } else {
      desired.current.lerpVectors(fromPos.current, toPos.current, t);
      look.current.lerpVectors(fromLook.current, toLook.current, t);
    }

    // THE DIVE. A selected beacon overrides the scroll pose for the length of
    // the move, blending from where the camera actually was when the visitor
    // chose it toward a stand-off short of the marker.
    //
    // It writes `desired`/`look` rather than the camera directly, so the same
    // first-order damping below carries it and the move inherits the film's own
    // weight instead of arriving as a second, harder motion. The frame offset
    // is closed out over the same curve: the copy column is on its way out and
    // the subject should end centred.
    const dive = diveProgress(performance.now());
    if (dive !== null) {
      desired.current.set(...diveState.fromPos).lerp(TMP.set(...diveState.toPos), dive);
      look.current.set(...diveState.fromTarget).lerp(TMP.set(...diveState.toTarget), dive);
      offset *= 1 - dive;
    }

    // FRAME THE SUBJECT RIGHT. Aim left of the target along the camera's own
    // right vector, so the building sits in the right 60% and the left 40%
    // stays clear for the hero column. Recomputed every frame because the
    // right vector rotates with the orbit.
    fwd.current.subVectors(look.current, desired.current).normalize();
    right.current.crossVectors(fwd.current, UP).normalize();
    look.current.addScaledVector(right.current, -offset);

    const cam = camera as THREE.PerspectiveCamera;
    const lens = p.path
      ? journeyState.leg === 'interior'
        ? interiorLensAt(interior.beats, journeyState.legProgress)
        : lensAt(journeyState.legProgress)
      : null;

    // THE DOORWAY. A passage through the front door owns the camera for its
    // length (doorway.ts has the whole account). It runs on its own clock, not
    // the scroll, because acceleration is a shape in time.
    //
    // Near side — the model the camera is leaving — blends from where the camera
    // ACTUALLY was when the passage began (captured here on its first frame, so a
    // parallax offset or an unsettled scroll starts the move from the frame on
    // screen) to a point through the doorway. Far side — after the swap — blends
    // from a point outside the other model's doorway onto the pose the scroll
    // gives on this very frame, which is what makes the hand-back exact: when
    // the clock reaches 1 the override and the film are the same pose.
    let doorFov: number | null = null;
    let rollScale = 1;
    const door = doorwayState;
    const passage = p.path && door.mode === 'running';
    if (passage) {
      const c = door.channels;
      if (!door.captured) {
        door.fromPos = [camera.position.x, camera.position.y, camera.position.z];
        door.fromLook = [target.current.x, target.current.y, target.current.z];
        door.fromFov = cam.fov;
        door.captured = true;
      }
      const entering = door.dir === 'enter';
      if (c.side === 'near') {
        const pass = entering ? DOORWAY.exteriorPass : DOORWAY.hallPass;
        const gaze = entering ? DOORWAY.exteriorGaze : DOORWAY.hallGaze;
        desired.current.set(...door.fromPos).lerp(TMP.set(...pass), c.leave);
        look.current.set(...door.fromLook).lerp(TMP.set(...gaze), c.aim);
        doorFov = door.fromFov + (DOORWAY.warpFov - door.fromFov) * c.warp;
        rollScale = 1 - c.aim;
      } else {
        const start = entering ? DOORWAY.hallStart : DOORWAY.exteriorStart;
        const gaze = entering ? DOORWAY.hallGaze : DOORWAY.exteriorGaze;
        TMP.copy(desired.current);
        desired.current.set(...start).lerp(TMP, c.arrive);
        TMP.copy(look.current);
        look.current.set(...gaze).lerp(TMP, c.settle);
        const live = lens ? lens.fov : cam.fov;
        doorFov = live + (DOORWAY.warpFov - live) * c.warp;
        rollScale = c.settle;
      }
    }

    // Cursor parallax. A few centimetres of camera offset across the whole
    // viewport — deliberately tiny. The scene is a backdrop that text sits on,
    // and a camera that swings to the pointer makes the copy above it feel
    // unstable. Enough to make the canvas feel alive to the hand, not enough to
    // be read as a control.
    //
    // Off during a passage: a camera flying through a doorway that also leans
    // toward the cursor is two moves at once.
    if (!passage && pointer.current.lengthSq() > 0) {
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
    // A DIVE OVERRIDES THE SCRUB, and it has to. The film's lag is 3.1s by
    // design — that is what makes scrolling feel like a move — and a 620ms dive
    // fed through it moves the camera 9% of the way before the veil closes.
    // MEASURED: on a busy machine the dive travelled 0.15m in its first 220ms,
    // which is pointer-parallax scale, i.e. a dive the visitor cannot see. A
    // 0.11s constant lands it inside the handoff while still damping the
    // pointer jitter the raw pose carries.
    //
    // A PASSAGE, AND A CUT, BYPASS IT. The doorway's curves are already the
    // motion, eased to the millisecond, and a lag laid over them would round the
    // acceleration off into the same soft move the review rejected. A cut — a
    // crossing nobody made by hand — places the camera outright: damping from
    // one model's coordinates to the other's would fly it through the walls of
    // both, under a dip from black that is too short to hide it.
    const tau = diveState.active ? 0.11 : Math.max(0.05, p.ease * SCRUB);
    const placed = passage || (p.path && door.snap);
    if (door.snap) door.snap = false;
    const k = placed ? 1 : 1 - Math.exp(-delta / tau);
    camera.position.lerp(desired.current, k);
    target.current.lerp(look.current, k);
    camera.lookAt(target.current);

    if (lens) {
      // FOV WARP. 50 at the top, 68 through the dive, 44 crossing the fountain.
      // Widening on the fast leg stretches the near geometry and exaggerates
      // parallax, which the eye reads as speed; narrowing on arrival compresses
      // the facade and settles the shot. Only touched when it has actually
      // changed — updateProjectionMatrix rebuilds the matrix and dirties every
      // frustum test downstream, so calling it unconditionally every frame is
      // real cost for nothing.
      const fov = doorFov ?? lens.fov;
      if (Math.abs(cam.fov - fov) > 0.01) {
        cam.fov = fov;
        cam.updateProjectionMatrix();
      }

      // BANK. Applied AFTER lookAt, in the camera's own space — lookAt writes
      // the full orientation with zero roll, so any roll set before it is
      // discarded. rotateZ post-multiplies about the view axis, which leans the
      // horizon into the turn instead of skewing the aim off the subject.
      const roll = lens.roll * rollScale;
      if (roll !== 0) camera.rotateZ(roll);
    }
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

  /**
   * The only objects this raycast can ever report.
   *
   * It used to call intersectObjects(scene.children, true) — the entire scene
   * root, recursively, with no layer mask and no bounds: 240 nodes outside and
   * 519 inside, twice a second, on every device including the phones this build
   * exists to serve. All of that to answer one question the name regex above
   * already scopes, which is "is the pointer over a hologram station?".
   *
   * So the candidates are resolved once and cached. The rescan is keyed on the
   * scene's top-level child count, which is what actually changes when a model
   * streams in or a set is swapped — an O(1) check per tick instead of a
   * traversal, and a traversal only on the frames where the scene really did
   * change shape.
   *
   * The reported value is unchanged: hits outside a station subtree always
   * resolved to null anyway, so the exterior — where there are no stations at
   * all — now does no raycasting instead of doing 240 nodes of it for a result
   * that was always null.
   */
  const targets = useRef<THREE.Object3D[]>([]);
  const lastChildCount = useRef(-1);

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

    // Refresh the candidate set only when the scene actually changed shape.
    if (scene.children.length !== lastChildCount.current) {
      lastChildCount.current = scene.children.length;
      const found: THREE.Object3D[] = [];
      scene.traverse((o) => {
        if (STATION_RE.test(o.name)) found.push(o);
      });
      targets.current = found;
    }

    let station: string | null = null;
    if (targets.current.length > 0) {
      ray.current.setFromCamera(pointer.current, camera);
      const hit = ray.current.intersectObjects(targets.current, true)[0];
      station = stationOf(hit?.object ?? null);
    }

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
  stationCount,
  onTier,
}: {
  place: PlaceId;
  stationCount: number;
  onTier: (t: DeviceTier) => void;
}) {
  const { tier } = useDeviceTier();
  useEffect(() => onTier(tier), [tier, onTier]);
  return (
    <>
      <CameraRig place={place} stationCount={stationCount} />
      <SpatialTelemetry place={place} tier={tier} />
    </>
  );
}

/**
 * Publishes the journey state once per frame, and tells React when the leg has
 * actually changed.
 *
 * Mounted immediately after <ScrollProgressDriver>, which matters: r3f runs
 * same-priority subscribers in registration order, so everything downstream
 * reads a leg computed from a scroll value sampled earlier in the SAME frame
 * rather than one frame stale. A one-frame lag here would show up as the model
 * swapping a frame before or after the veil closes, which is the one place in
 * the sequence where a single frame is visible.
 *
 * `onLeg` fires only on a real transition, so crossing the threshold costs one
 * React render for the whole journey rather than one per frame.
 */
function JourneyDriver({
  active,
  onLeg,
  onArmed,
  reveal,
  interiorLeg,
  cityReveal,
  cityFrom,
  veil,
}: {
  active: boolean;
  onLeg: (leg: 'exterior' | 'interior') => void;
  onArmed: () => void;
  /** Constellation presence, 0..1. */
  reveal: React.MutableRefObject<number>;
  /** Interior leg progress, 0..1, for the stage. */
  interiorLeg: React.MutableRefObject<number>;
  /** District field presence, 0..1. */
  cityReveal: React.MutableRefObject<number>;
  /** Leg progress at which the city chapter opens. */
  cityFrom: number;
  /** The blackout element. Written directly rather than through state. */
  veil: React.RefObject<HTMLDivElement>;
}) {
  const scroll = useScrollProgress();
  const lastLeg = useRef(journeyState.leg);
  const armedOnce = useRef(false);
  const shownVeil = useRef(0);

  // Read once and on change rather than per frame: matchMedia is not free, and
  // the setting changes about never.
  const reduced = useRef(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => {
      reduced.current = mq.matches;
    };
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  // A passage must never outlive the film it belongs to: leaving the journey
  // mid-passage — a navigation, a route with no path — releases the page and
  // clears the white, and so does the canvas going away.
  useEffect(() => {
    if (!active) {
      cancelDoorway();
      paintDoorway();
    }
    return () => {
      cancelDoorway();
      paintDoorway();
    };
  }, [active]);

  useEffect(() => {
    if (active) return;
    // Off the journey (any route that is not a path pose), the state must be
    // inert rather than stale: a visitor who scrolls the About page should not
    // leave the interior leg armed behind them.
    journeyState.leg = 'exterior';
    journeyState.legProgress = 0;
    journeyState.veil = 0;
    journeyState.armed = false;
    reveal.current = 0;
    interiorLeg.current = 0;
    cityReveal.current = 0;
    if (veil.current) veil.current.style.opacity = '0';
  }, [active, reveal, interiorLeg, cityReveal, veil]);

  useFrame(() => {
    if (!active) return;
    const now = performance.now();
    // FIRST, before the journey is read: the doorway can move the scroll. It
    // holds the page at the door the moment a passage starts — so the leg does
    // not flip under a camera that is still outside — and lands it inside at
    // the swap. Everything below then reads where the page now is.
    stepDoorway(now);
    paintDoorway();
    readJourney(scroll.current, journeyState);

    if (journeyState.armed && !armedOnce.current) {
      armedOnce.current = true;
      onArmed();
    }
    if (journeyState.leg !== lastLeg.current) {
      lastLeg.current = journeyState.leg;
      onLeg(journeyState.leg);
    }

    // THE CONSTELLATION'S CHAPTER. Dark through the hero and the revolution,
    // igniting as the crane rises onto it, extinguished by the veil. The
    // thresholds are the ones journey.chapters() gives the DOM, so the copy
    // beside the sphere arrives with the sphere rather than near it.
    //
    // 0.60/0.32 -> 0.58/0.20, AND THAT IS A DEFECT FIX, NOT A TASTE CHANGE.
    //
    // The old ramp reached full strength at legProgress 0.92. The veil starts
    // closing at document scroll 0.424, which is legProgress 0.922. So the
    // constellation was at full strength for 0.002 of the leg — measured on the
    // shipped build, reveal read 0.215 at the chapter's own opening, 0.726 at
    // its MIDPOINT, and 0.977 four fifths of the way through. The object the
    // chapter is named after was never once seen at strength in a held frame.
    //
    // 0.58..0.78 lights it during the crane and holds it lit for the whole of
    // the frame the visitor actually stops on.
    //
    // Those numbers are on the FILM's clock, which is now the first FILM_SHARE
    // of the leg (cameraPath.ts). The approach then carries the sphere down the
    // flank with it — it crowns the house the camera is circling — and lets it
    // go as the camera turns onto the axis, where it would only be a glow above
    // the top of frame. No veil term: the sphere is out long before the door.
    const s = journeyState.legProgress;
    if (journeyState.leg === 'exterior') {
      const film = Math.min(1, s / FILM_SHARE);
      const approach = Math.max(0, (s - FILM_SHARE) / (1 - FILM_SHARE));
      reveal.current = smooth01((film - 0.58) / 0.2) * (1 - smooth01((approach - 0.55) / 0.3));
    } else {
      reveal.current = 0;
    }

    interiorLeg.current = journeyState.leg === 'interior' ? s : 0;

    // THE DISTRICT FIELD'S CHAPTER, on the same construction as the
    // constellation's and with the same lesson applied: it reaches full
    // strength BEFORE the beat it belongs to, not at the end of the leg. The
    // city beat lands at legProgress 1.0, which is document scroll 0.90 —
    // JOURNEY_END, where the footer is already arriving — so a ramp that
    // finished there would finish behind the credits, exactly as the
    // constellation's did behind the veil.
    //
    // cityFrom is derived from the chapter weights rather than written out, so
    // publishing a fourth project moves the field with the film instead of
    // leaving it lit a chapter early.
    // 0.62 of the chapter, not all of it. The city BEAT lands at legProgress
    // 1.0 — document scroll 0.90, JOURNEY_END — so a ramp that finished with
    // the chapter would reach full strength on the last frame of the film with
    // the footer already arriving over it. Lit by 62% of the way in, the field
    // is at strength while the camera is still settling onto the threshold,
    // which is also the better order: the land opens, then the camera arrives.
    cityReveal.current =
      journeyState.leg === 'interior'
        ? smooth01((s - cityFrom) / Math.max(1e-3, (1 - cityFrom) * 0.62))
        : 0;

    // THE VEIL, written straight to the DOM.
    //
    // Not React state, and not a WebGL pass. State would re-render the whole
    // canvas tree at scroll frequency. A full-screen shader pass would sit
    // INSIDE the composer, so it would be tone-mapped and bloomed on its way
    // out — a black rectangle that bloom cannot ignite is still a rectangle
    // that costs a pass, and the one thing this element must do perfectly is
    // reach true black at the swap.
    //
    // Damped rather than assigned, so a fast scrub through the crossover still
    // closes and opens the veil over a few frames instead of strobing.
    //
    // SCRUBBED ONLY UNDER REDUCED MOTION. Everyone else goes through the door
    // (doorway.ts), and a black veil drawn over the approach would dim the very
    // frame the visitor is walking toward. What remains for them is the CUT: a
    // crossing nobody made by hand places the camera, and this dips from black
    // over it so a model swap is never a bare hard cut.
    if (reduced.current) {
      shownVeil.current += (journeyState.veil - shownVeil.current) * 0.35;
    } else {
      const since = now - doorwayState.cutAt;
      shownVeil.current = since >= 0 && since < CUT_MS ? (1 - since / CUT_MS) ** 2 : 0;
    }
    if (veil.current) {
      const v = shownVeil.current;
      veil.current.style.opacity = v.toFixed(3);
      // Nothing behind a closed veil can be clicked. Without this a hologram
      // the visitor cannot see is still a live target under the cursor.
      veil.current.style.pointerEvents = v > 0.6 ? 'auto' : 'none';
    }
  });

  return null;
}

/** Clamped smoothstep on an already-normalised input. */
function smooth01(x: number): number {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
}

/**
 * The page-side surfaces the doorway draws on: the white layer, the canvas
 * frame it blurs, and the renderer whose exposure it lifts. Registered by the
 * components that own them; painted by the journey driver every frame.
 *
 * Module-level like the rest of the journey's per-frame state, and for the same
 * reason — written at frame rate, so it must never pass through React.
 *
 * THE WHITE LAYER EXISTS ONLY WHILE A PASSAGE RUNS, and that is a defect fix.
 * It was a permanent portal at the end of <body>, and MEASURED in the keyboard
 * E2E case, its mere presence broke the skip link: after the consent dialog
 * unmounts, Chrome resumes sequential focus from where the dialog was, and with
 * a node after that point Tab searched forward, found nothing focusable, and
 * left the document — the first Tab on the page focused nothing. Removing the
 * node, or never adding it, restores Tab to the skip link; hiding it did not.
 * So the layer is created at the start of a passage and removed at its end, and
 * the state the tests read lives on <html data-doorway>, which is always there.
 */
const doorwaySurfaces = {
  white: null as HTMLDivElement | null,
  frame: null as HTMLDivElement | null,
  gl: null as THREE.WebGLRenderer | null,
  /** The exposure ColorPipeline set, which the passage multiplies. */
  exposure: 1,
  /** CSS blur costs a full-screen filter pass; phones do without it. */
  blur: true,
  // Last written values, so an idle frame writes nothing to the DOM.
  paintedBackground: '',
  paintedFilter: '',
  paintedState: '',
  exposureDirty: false,
};

function paintDoorway() {
  const st = doorwayState;
  const c = st.channels;
  const s = doorwaySurfaces;
  const running = st.mode === 'running';

  const state = running ? st.dir : 'idle';
  const background = running && c.white > 0.0005 ? whiteGradient(c.whiteShape, c.white) : 'none';

  if (running && !s.white) {
    // z-index 75: over the header (40), the skip link (50) and the preloader
    // (60), under the route veil (80), which must always be able to close over
    // anything. Over the header and the copy on purpose — a passage into light
    // with a navigation bar printed across it is a web page, not a doorway.
    // Pointer events on: nothing may be clicked through the light, and the page
    // underneath is held still for the whole passage.
    const el = document.createElement('div');
    el.setAttribute('aria-hidden', 'true');
    el.style.cssText =
      'position:fixed;inset:0;z-index:75;pointer-events:auto;touch-action:none;' +
      'background:none;opacity:0;transition:none';
    document.body.appendChild(el);
    s.white = el;
    s.paintedBackground = '';
  }
  if (s.white) {
    if (!running) {
      s.white.remove();
      s.white = null;
      s.paintedBackground = '';
    } else if (background !== s.paintedBackground) {
      s.white.style.background = background;
      s.white.style.opacity = background === 'none' ? '0' : '1';
      s.paintedBackground = background;
    }
  }

  const root = document.documentElement;
  if (state !== s.paintedState) {
    root.dataset.doorway = state;
    s.paintedState = state;
  }
  const coverage = running ? c.white.toFixed(3) : '0';
  if (root.dataset.doorwayCoverage !== coverage) root.dataset.doorwayCoverage = coverage;

  if (s.frame) {
    const px = running && s.blur ? c.blur * DOORWAY.blurPx : 0;
    const filter = px > 0.05 ? `blur(${px.toFixed(2)}px)` : '';
    if (filter !== s.paintedFilter) {
      s.frame.style.filter = filter;
      // A CSS blur averages the edge pixels with transparency beyond the
      // element, so on its own it rings the frame with the page's navy — seen
      // in a captured frame as a dark vignette the passage never asked for.
      // Scaling the layer by a little more than the blur radius puts that soft
      // edge off screen.
      s.frame.style.transform = filter
        ? `scale(${(1 + (4 * px) / Math.max(1, window.innerHeight)).toFixed(4)})`
        : '';
      s.paintedFilter = filter;
    }
  }

  if (s.gl) {
    if (running) {
      s.gl.toneMappingExposure = s.exposure * c.exposure;
      s.exposureDirty = true;
    } else if (s.exposureDirty) {
      s.gl.toneMappingExposure = s.exposure;
      s.exposureDirty = false;
    }
  }
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
    // Unity, same as outside — and the previous 0.6 was treating a symptom.
    //
    // Every earlier value here (1.0, then 0.32, then 0.6) was an attempt to
    // dim a room that was blowing out, on the theory that the 4.66x lightmap
    // gain was arriving at the tone mapper too hot. That theory was never
    // tested, and it was wrong.
    //
    // MEASURED at the verified `hall` pose: setting lightMapIntensity to 1.0
    // changed the frame's mean luminance by nothing at all. So did clamping
    // every emissive. What actually blew the room out was the ten punctual
    // lights the GLB carries, at intensities up to 41307 — see
    // stripBakedLights() in HallModel. With those gone the same frame is 0%
    // clipped, and 0.6 is simply 40% too dark: it leaves 13.4% of the frame
    // crushed below luma 8, against 11.2% at unity.
    //
    // So there is nothing left to compensate for. The lightmap gain is the
    // bake's own normalisation divisor, the scene is otherwise lit by a low
    // ambient, and the honest exposure for that is 1.0.
    //
    // THE CLIENT REVIEW MOVED ALL THREE, and for a reason unity never saw. At
    // 1.0 / 0.1 / 0.12 the room was correctly exposed for the textures it had —
    // granite trims, damp grey plaster, black panelling — and the review called
    // that room "cheap" and "worn out". hallFinish.ts now paints it what the
    // approved Cycles renders show: ivory, walnut, white marble, gilt. A light
    // room under a dark grade is a grey room, so the grade follows the finishes:
    //
    //   exposure 1.0  -> 1.35  the ivory reads ivory; above ~1.5 the lightmapped
    //                          stair stringer clips to paper white
    //   env      0.1  -> 0.3   the walnut, the gilt and the marble are the
    //                          surfaces that make a room look expensive, and all
    //                          three live on reflection
    //   ambient  0.12 -> 0.4   the unbaked joinery (balusters, newels, panelling)
    //                          otherwise sits a stop below the baked walls
    exposure: 1.35,
    /** scene.environmentIntensity — the polish on the walnut, gilt and marble. */
    env: 0.3,
    /** Lifts the joinery and ornament, which carry no lightmap, to the walls. */
    ambient: 0.4,
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
  // far 600 -> 400. The exported ground was a 450m plane and the far plane had
  // to clear its corners; the delivered terrain spans +/-120m, so the furthest
  // visible geometry from any point on the camera path is under 200m. A 1200:1
  // depth range was buying nothing but z-fighting risk on the slate courses.
  exterior: { near: 0.5, far: 400 },
};

/**
 * Legibility scrim, per set — and much lighter outside than it used to be.
 *
 * The review was right that a heavy DOM gradient is a band-aid, and the fix it
 * asked for is the one applied here: the contrast is now made in WebGL. These
 * exterior stops were tuned against the DUSK grade, which renders on a #0A1120
 * sky with fog from 34m matched to that same colour — the top of the frame is
 * genuinely dark there because it is sky, not an overlay. So the exterior's
 * top stop drops from 0.80 to 0.28 and the radial pass is nearly gone.
 *
 * Daylight is now the default and does NOT have that dark sky, so this pass
 * alone is not enough for it. It is topped up by DAYLIGHT_COLUMN_SCRIM below,
 * which is scoped to the left column so the building is never dimmed. These
 * stops are deliberately left as they are: they still serve the dusk rollback,
 * and widening them would darken a frame that the daylight grade exists to
 * open up.
 *
 * It is not deleted, and claiming otherwise would be dishonest. The bottom
 * eighth still darkens, because the lawn in the near field is a mid-value
 * surface and the footer sits directly on it; no amount of scene lighting fixes
 * white text on a lit lawn without also ruining the lawn. That residue is the
 * honest minimum, not a substitute for grading the scene.
 *
 * The interior used to keep the heavier pass; since the finishes changed it
 * keeps a warm, local one — see the interior entry.
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
  // Warm, and a fraction of what it was. The navy 0.80/0.88 bands were tuned for
  // the dark hall; over the ivory room they read as grime at the top and bottom
  // of every frame. The copy now gets a soft warm pool under the left column,
  // where it sits, instead of a whole-frame darkening.
  interior: {
    linear:
      'linear-gradient(to bottom, rgba(18,12,8,0.42) 0%, rgba(18,12,8,0) 15%, rgba(18,12,8,0) 72%, rgba(18,12,8,0.42) 100%)',
    radial:
      'radial-gradient(60% 55% at 18% 52%, rgba(18,12,8,0.5) 0%, rgba(18,12,8,0.3) 45%, rgba(18,12,8,0) 100%)',
  },
};

/**
 * The extra pass the DAYLIGHT grade needs, and only that grade.
 *
 * Daylight lights the band the hero copy sits in, so the vertical SCRIM above
 * — authored against a navy dusk sky — stops being enough on its own. This
 * buys the contrast back.
 *
 * It is paid on the LEFT COLUMN rather than the whole frame, because the copy
 * occupies x 160..606 of 1440 and the mansion sits from roughly x 700 — a
 * full-width band would buy contrast by dimming the very building the grade
 * exists to reveal. Fading out by 52% keeps the architecture untouched.
 *
 * MEASURED, production build, 1440x900 hero, against a BACKDROP PLATE: the
 * same frame re-rendered with the glyphs set transparent, so the background is
 * read rather than estimated from between the letterforms. Ratios are computed
 * on the alpha-composited text colour. "typical" is the median backdrop under
 * the run of copy, "worst" its 95th percentile.
 *
 *                        DUSK typ/worst    DAYLIGHT typ/worst   AA needs
 *   H1 (66px)             12.87 / 7.26       7.53 / 5.62          3.0
 *   body copy (16.8px)     4.29 / 3.89       4.69 / 3.86          4.5
 *   gold link (13.4px)     5.33 / 4.21       5.35 / 4.81          4.5
 *   secondary link         3.55 / 3.23       3.72 / 3.37          4.5
 *   eyebrow                5.49 / 5.47       3.69 / 2.93          4.5
 *
 * Read that honestly, because an earlier revision of this comment did not:
 * DUSK IS NOT CLEAN EITHER. Body copy at 4.29 and the secondary link at 3.55
 * already miss AA on the shipping grade; that is a pre-existing defect of the
 * 0.55/0.70 alpha type over a lit lawn, not something daylight introduced.
 *
 * With this scrim, daylight is BETTER than dusk on body copy, gold and the
 * secondary link, and materially worse on exactly one element: the eyebrow,
 * 5.49 -> 3.69, which sits high in the frame where the column scrim has
 * already faded and the dusk sky used to be near-black.
 *
 * So the grade fork does not turn an accessible page into an inaccessible one.
 * Both grades owe the same fix — the alpha-dimmed small type needs opacity,
 * not more scrim — and that is a typography change outside this pass.
 */
const DAYLIGHT_COLUMN_SCRIM =
  'linear-gradient(to right, rgba(6,10,20,0.38) 0%, rgba(6,10,20,0.34) 30%, rgba(6,10,20,0) 52%, rgba(6,10,20,0) 100%)';

/**
 * EXTERIOR GRADE — daylight (ships) or dusk (?grade=dusk).
 *
 * The exterior has two defensible art directions and the brief names both:
 * masterprompt.md:428 asks for "premium dusk/evening or editorial daylight
 * grade depending on what works best with the actual asset". Dusk shipped
 * first and most lighting comments in this file were written against it.
 * DAYLIGHT IS NOW THE DEFAULT, because it is measurably closer to the
 * approved Blender render of the asset we actually ship.
 *
 * The decision was made on rendered images, not on asset values. Raw canvas
 * (DOM scrims hidden, so the comparison is lighting only) against the
 * REV_HERO ground truth, mean luma per region:
 *
 *                  Blender      dusk           daylight
 *     facade         115.4      95.2  (-20.2)   123.9  (+8.5)
 *     roof slate     111.9      81.8  (-30.1)   113.6  (+1.7)
 *     terrace        134.6     120.1  (-14.5)   165.6 (+31.0)
 *     lawn            99.3      73.6  (-25.7)   100.1  (+0.8)
 *     fountain        63.8      40.5  (-23.3)    56.6  (-7.2)
 *     background      53.9      12.8  (-41.1)    99.1 (+45.2)
 *     spire           95.1      63.2  (-31.9)   103.7  (+8.6)
 *     ----------------------------------------------------------
 *     RMS luma error            27.9             21.4
 *
 * and the limestone itself, which is the whole point of the asset:
 *
 *     Blender  H 36.1  S 0.133  L 0.436
 *     dusk     H 32.4  S 0.160  L 0.362   darker, more saturated
 *     daylight H 34.1  S 0.150  L 0.469   closest on all three
 *
 * Daylight wins five regions of seven and every architectural surface. Two
 * residual gaps are KNOWN and are not fixed here: the terrace runs +31 hot
 * (its paving tint was tuned under dusk) and the flat sky runs +45 hot where
 * Blender has a dark HDRI treeline. Both are follow-ups, not blockers.
 *
 * DERIVED, NOT INVENTED. Every value below was fitted by measuring the live
 * framebuffer against a 1424x900 render from Blender's REV_HERO camera — the
 * same camera as the site hero, proven by matching loc/lens/fov.
 *
 *   sun azimuth/elevation   read from SUN_KEY's own rotation (55.1, 0, 63.9),
 *                           i.e. 34.9 degrees elevation, converted Blender
 *                           (x,y,z) -> three (x,z,-y).
 *   tone mapping            UNCHANGED. ACES beat AgX in every row of the grid;
 *                           swapping the view transform alone moves the frame
 *                           only 63.9 -> 69.2 (+8%) and is not the cause.
 *   environment + sky       the dominant lever, worth +128% on frame mean.
 *
 * Scoped to the exterior by construction, not by a flag: <ExteriorLighting>
 * and this background only mount for set === 'exterior', and LOOK is already
 * per-set, so the interior cannot see any of it.
 */
export type Grade = 'dusk' | 'daylight';

/** Sky/clear colour per grade. Dusk's is also the fog colour. */
const GRADE_BG: Record<Grade, string> = { dusk: '#0A1120', daylight: '#9FB9D2' };

/** Exterior LOOK deltas for daylight. Dusk (the rollback) is LOOK.exterior unmodified. */
const GRADE_LOOK: Record<Grade, Partial<(typeof LOOK)['exterior']>> = {
  dusk: {},
  // env 0.7 -> 0.25, ambient 0.2 -> 0.02. See GRADE_RIG: these two plus the
  // hemisphere are the FILL, and the fill was the whole reason the frame read
  // as game-engine lighting.
  daylight: { exposure: 0.75, env: 0.25, ambient: 0.02 },
};

/**
 * Key and hemisphere, per grade, and swept from the query string like the rest.
 *
 * These were hard-coded inside <ExteriorLighting> until the parity audit needed
 * to sweep the FILL independently of the KEY. They live here for the same
 * reason exposure/env/ambient do — a look can only honestly be judged on the
 * real page, and a rebuild per guess is a bad loop.
 */
const GRADE_RIG: Record<Grade, { key: number; hemi: number }> = {
  dusk: { key: 2.3, hemi: 0.36 },
  // KEY UP, FILL DOWN. The first daylight grade matched the reference's
  // AVERAGE brightness and still read as a game engine, because average
  // brightness is not what makes a render look lit — structure is.
  //
  // Measured over the building region only (sky, lawn and terrace excluded),
  // the shipped daylight grade against the approved render:
  //
  //                        Blender    before     after
  //     mean                 104.1     126.4      99.9
  //     p05  (shadow)         46.9      73.1      49.3
  //     p95  (lit)           159.7     193.4     159.2
  //     p95/p05 contrast      3.36      2.62      3.19
  //     share below L40        2.5%      0.0%      2.7%
  //     share below L70       16.7%      4.0%     15.8%
  //
  // The line that mattered is "share below L40: 0.0%". NOT ONE PIXEL of the
  // building was genuinely dark. hemi 0.8 + ambient 0.2 + env 0.7 put a floor
  // under every shadow in the scene, so recesses, reveals and the shaded
  // elevation all bottomed out at the same lifted value and the architecture
  // lost its planes. That is what "uniformly illuminated" is, numerically.
  //
  // Dropping the fill roughly 4x and taking the key from 3.0 to 5.9 keeps the
  // lit facade at the same place it already matched (p95 159.2 against 159.7)
  // while letting the shadows fall to where the reference puts them.
  // V7: 5.9 -> 3.4. 5.9 was fitted to a 14-degree sun BEHIND the house, lighting
  // edges and roof; the v7 sun is high and in front (see the key light), lands
  // square on the facade, and at 5.9 blew the limestone to paper white.
  daylight: { key: 3.4, hemi: 0.18 },
};

function useLook(set: SceneSet) {
  const [grade, setGrade] = useState<Grade>('daylight');
  const base = {
    ...LOOK[set],
    ...(set === 'exterior' ? GRADE_LOOK[grade] : {}),
    ...GRADE_RIG[grade],
  };
  const [override, setOverride] = useState<Partial<typeof base>>({});
  const [free, setFree] = useState(false);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const num = (k: string) => {
      const v = parseFloat(q.get(k) ?? '');
      return Number.isFinite(v) ? v : undefined;
    };
    setFree(q.get('free') === '1');
    // Daylight ships; ?grade=dusk is the rollback and the look-dev A/B.
    setGrade(q.get('grade') === 'dusk' ? 'dusk' : 'daylight');
    // Only keys actually present in the query string override, so switching
    // sets still picks up that set's defaults for everything untouched.
    const next: Partial<typeof base> = {};
    const e = num('exposure'); if (e !== undefined) next.exposure = e;
    const v = num('env'); if (v !== undefined) next.env = v;
    const a = num('ambient'); if (a !== undefined) next.ambient = a;
    const k = num('key'); if (k !== undefined) next.key = k;
    const hm = num('hemi'); if (hm !== undefined) next.hemi = hm;
    setOverride(next);
  }, []);

  return { ...base, ...override, free, grade };
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
/**
 * The daylight fog band, and the values evening interpolates it toward.
 *
 * DAY_FOG is the shipped pair, lifted out of the constructor so the frame loop
 * and the effect cannot drift apart about what "no evening yet" means.
 *
 * Neither colour is picked. HAZE_DAY is DAYLIGHT_HAZE — the mean of the
 * approved Blender render across the band just above its own horizon. HAZE_NIGHT
 * is GRADE_BG.dusk, the navy the preloader, the crossover veil and the interior
 * clear colour already share, so the land settles into the film's own night
 * rather than into a third colour invented for this chapter.
 *
 * KEY_EVENING is the daylight key reddened. A sun at 15m against an 80m throw
 * is a sun near the horizon, and its light has come through enough air to lose
 * its blue; the shipped #FFF0DB is that sun at noon.
 */
// V7: [60, 220] -> [110, 520], evening 150 -> 300. The old pair was set for a
// 19 m house on +/-120 m of terrain, where it had to bury the terrain's edge by
// 150 m; the estate is 1.6x larger, its horizon is a planted belt 80-180 m out,
// and at the old pair that belt arrived as a milky wall across the top of the
// hero.
const DAY_FOG: readonly [number, number] = [110, 520];
const EVENING_FOG_FAR = 300;
/** Emissive strength of the curtained windows at full evening (see ExteriorLighting). */
const WINDOW_EVENING_GLOW = 0.7;
/** Aerial-perspective colour, sampled from the approved render's own horizon band. */
// V7: the painted sky's horizon haze, so the tree belt fades into the sky it
// stands against rather than into the olive of the old meadow hills.
const DAYLIGHT_HAZE = '#C3CCC9';
const HAZE_DAY = new THREE.Color(DAYLIGHT_HAZE);
/**
 * The film's navy, LIFTED — and lifted by measurement rather than by eye.
 *
 * GRADE_BG.dusk (#0A1120) is the right hue and the wrong value here, because it
 * is authored as a CLEAR COLOUR and a clear colour is not tone-mapped. Fog is.
 * Put through this pipeline — sRGB to linear on construction, ACES, exposure
 * 0.75 — #0A1120 rendered the far landscape at [7,10,10]: not night air, a
 * black stripe, and the one artefact the brief names outright as forbidden.
 *
 * #131E33 is the same hue at roughly 3x the linear value, which lands the
 * hazed distance around [22,27,34] — darker than the sky above it, lighter
 * than nothing, and continuous with both.
 */
const HAZE_NIGHT = new THREE.Color('#131E33');
const KEY_DAY = new THREE.Color('#FFF0DB');
const KEY_EVENING = new THREE.Color('#FFC489');

function ExteriorLighting({
  driveByScroll,
  grade,
  keyIntensity,
  hemiIntensity,
}: {
  driveByScroll: boolean;
  grade: Grade;
  keyIntensity: number;
  hemiIntensity: number;
}) {
  const day = grade === 'daylight';
  const scene = useThree((s) => s.scene);
  const key = useRef<THREE.DirectionalLight>(null);
  const hemi = useRef<THREE.HemisphereLight>(null);
  const entry = useRef<THREE.RectAreaLight>(null);
  // The curtained windows, found once the estate has loaded (see the evening
  // glow below). Re-scanned on a slow cadence until they exist.
  const windowGlow = useRef<{ mats: THREE.MeshStandardMaterial[]; nextScan: number }>({ mats: [], nextScan: 0 });

  useEffect(() => {
    const prev = scene.fog;
    // Dusk: the original band, matched to the navy sky.
    //
    // Daylight: FOG IS BACK, for a different reason than dusk's. Dusk uses it
    // to darken the frame behind the headings. Daylight needs it because the
    // ground plane is finite and ends in a dead-straight edge against the
    // environment behind it — the single thing that most gave the frame away
    // as a diorama once the background became real landscape. The reference
    // has aerial perspective doing that job.
    //
    // #5E6147 is not chosen, it is SAMPLED: the mean of the approved render
    // across the band just above its own horizon (y 150..190, full width).
    //
    // 60..220 is set so the BUILDING IS NEVER TOUCHED. Its front face is 28m
    // from the hero camera and its far corner ~50m, both inside the near
    // plane, so the architecture renders completely unfogged and only ground
    // beyond it carries haze. 90..300 was tried first and was measurably
    // pointless: the plane's far edge sits ~130m out, which that band fogged
    // by 19%, and the edge stayed as hard as it was.
    scene.fog = day
      ? new THREE.Fog(DAYLIGHT_HAZE, DAY_FOG[0], DAY_FOG[1])
      : new THREE.Fog(GRADE_BG.dusk, 34, 190);
    return () => {
      scene.fog = prev;
    };
  }, [scene, day]);

  // Atmosphere travels with the camera. The path drops from 30m out to 9m and
  // rises to 6.8m on the way, and a fixed fog band tuned for the wide
  // establishing shot is simply wrong by the time the camera is under the
  // portico — the building would sit in haze at the exact moment it should be
  // most present. Fog closes from 34..190 to 14..95 and the key lifts as the
  // camera arrives.
  // scene.backgroundIntensity is a global the evening fall below writes every
  // frame, so it has to be handed back on unmount — a route that leaves the
  // journey mid-chapter would otherwise inherit a sky at 10%.
  useEffect(
    () => () => {
      scene.backgroundIntensity = 1;
    },
    [scene],
  );

  useFrame(() => {
    // THE DOORWAY'S LIGHT ON THE PORTICO. When the front doors open, the light
    // behind them has to land on something or it reads as a lamp inside a box:
    // the entry bay's own area light — already sized to the opening and already
    // facing out of it — carries it onto the columns, the steps and the
    // fountain. An existing light, so a passage adds no light to the scene and
    // recompiles no shader.
    if (entry.current) {
      entry.current.intensity =
        (day ? 0.25 : 2.2) + doorwayState.channels.exteriorGlow * PORTICO_GLOW;
    }

    if (!driveByScroll) return;

    // LEG progress, not document scroll — and that is a fix, not a detail.
    //
    // BEATS[].at are fractions of the EXTERIOR LEG, which is the first part of
    // the document (journey.ts, CROSSOVER). The camera has always read them
    // that way: the rig calls exteriorPoseAt(legProgress) and lensAt(legProgress).
    // This call read `scroll.current`, which is DOCUMENT scroll, so the
    // atmosphere has been sampling the path at less than half the parameter the
    // camera was at — at the constellation beat, where legProgress is 1.0, it
    // was reading 0.42 and returning the values authored for the revolution.
    //
    // It went unseen because it was unreachable: the daylight branch returned
    // before this line, and daylight is what ships. It is live now, so it is
    // correct now. Clamped to 1 past the crossover, so the last exterior frame
    // before the cut is the fully-fallen one rather than a rewind.
    const legS =
      journeyState.leg === 'exterior' ? journeyState.legProgress : 1;
    const a = atmosphereAt(legS);
    const fog = scene.fog as THREE.Fog | null;

    if (!day) {
      if (fog && fog.isFog) {
        fog.near = a.near;
        fog.far = a.far;
      }
      if (key.current) key.current.intensity = a.key;
      return;
    }

    // ── EVENING, across the last exterior chapter only ────────────────────
    //
    // Every line here is IDENTITY at evening 0, which is every frame of the
    // hero, the quarter and the three-quarter — the three vantages the Phase 5
    // daylight grade was fitted against. Nothing about those frames moves.
    //
    // What it is for: the film cuts from this exterior into a candlelit hall,
    // and the constellation it is cutting through is additive light. Additive
    // light over a sunlit equirect sky cannot be seen — measured, the shipped
    // 12m sphere over a bright cloud bank read as dust. Letting the sun go down
    // over the last chapter fixes the cut and the sphere at once, with no
    // change to either.
    const e = a.evening;

    if (fog && fog.isFog) {
      // near stays at 60 throughout: the building's nearest corner is 39.8m
      // from the final eye, so the architecture is never touched at any point
      // in the fall. Only the far plane closes, and it closes because the
      // authored terrain STOPS at +/-120m and its edge is 149m from that eye —
      // a dead-straight line across the frame at 22% haze. 150 takes the same
      // edge to 89%.
      fog.near = DAY_FOG[0];
      fog.far = DAY_FOG[1] + (EVENING_FOG_FAR - DAY_FOG[1]) * e;
      fog.color.copy(HAZE_DAY).lerp(HAZE_NIGHT, e);
    }

    // The KEY SURVIVES. This is the difference between evening falling and the
    // lights going out: the sky and the land drop away while the building keeps
    // a warm light on it, which is the magic-hour architectural shot and the
    // register the whole film is in. Down 35%, and warmed — a sun near the
    // horizon is reddened by the air it is coming through, so this is the same
    // physics the fog is.
    if (key.current) {
      key.current.intensity = keyIntensity * (1 - 0.35 * e);
      key.current.color.copy(KEY_DAY).lerp(KEY_EVENING, e);
    }
    // The FILL DIES. The hemisphere is sky light, and there is no sky left to
    // fill with. This is what lets the shadowed elevation go dark enough for
    // the sphere above it to read.
    if (hemi.current) hemi.current.intensity = hemiIntensity * (1 - 0.78 * e);

    // The photographic environment recedes rather than being replaced. It keeps
    // its cloud structure and its hill silhouettes at a tenth of the luminance,
    // which is what dusk looks like — and it means the frame still has real
    // landscape in it rather than a flat colour where a landscape was.
    scene.backgroundIntensity = 1 - 0.9 * e;

    // THE ROOMS LIGHT UP AS EVENING FALLS. Every window of the v7 house is glass
    // over a drawn curtain (MAT_Window_Interior); by day the curtain is cream in
    // the shade of the reveal, and as the approach turns to dusk it glows warm,
    // so the house the camera walks up to at night is one with its lamps on.
    // Emissive colour is set by the grade (applyGrade); only the strength
    // follows the evening here.
    const glow = windowGlow.current;
    if (!glow.mats.length && performance.now() > glow.nextScan) {
      glow.nextScan = performance.now() + 1500;
      const found = new Set<THREE.MeshStandardMaterial>();
      scene.traverse((o) => {
        const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
        if (m && !Array.isArray(m) && m.name === 'MAT_Window_Interior' && m.emissive) found.add(m);
      });
      glow.mats = [...found];
    }
    for (const m of glow.mats) m.emissiveIntensity = WINDOW_EVENING_GLOW * e;
  });

  return (
    <>
      {/* DUAL-TONE. The previous rig was warm key plus neutral hemisphere, which
          is why the frame read as flat: every surface sat somewhere on one
          warm ramp, so nothing separated the building from the air around it.
          Now the two ends of the palette actively disagree — warm amber on the
          lit face, cool slate everywhere else — and the elevation reads as
          form rather than as a lit picture of form. */}

      {/* THE SUN, RELOCATED TO A BACKLIGHT.

          It sat at (-42, 30, 52): high, and on the SAME side of the building as
          the camera for the entire orbit. That lit the facade head-on and flat,
          and it put any scattering pass keyed to it behind the lens, where
          nothing can be seen — which is why god rays were impossible rather
          than merely unbuilt.

          Then it went to (-58, 13, -44), which put the disc on the SAME side of
          frame as the hero column and washed the white type out — a contrast
          failure, not a look.

          Now (30, 15, -80): deep behind the RIGHT of the mansion. From the hero
          the sight line to it crosses the building's plane at x ~8.2, inside
          the +/-9.55 shell, so the architecture occludes the disc and the rays
          break around its silhouette. Everything on the left of frame — where
          the typography lives — falls into shadow, which is what the copy needs
          to sit on. Deeper and hotter in colour because a sun at 15m against an
          80m throw is a sun near the horizon.

          The shadow box moves with it — an ortho frustum aimed from the old
          position would now be pointing at nothing. */}
      <directionalLight
        ref={key}
        // Daylight puts the sun where Blender's SUN_KEY actually is: rotation
        // (55.1, 0, 63.9) resolves to 34.9 degrees elevation, which converts to
        // three-space (0.737, 0.572, 0.361) and out to 89m. Its colour is
        // SUN_KEY's own (1, 0.93, 0.84).
        // RECOVERED FROM SOURCE, not fitted. mansion_exterior_AO-MATERIAL
        // (the locked state, 267 ashlar, the one v5 was exported from) has
        // SUN_KEY at rotation (76, 0, -118) with energy 4.0 and colour
        // (1, 0.94, 0.86). Resolving local -Z through Rz*Rx gives a travel
        // direction of (+0.857, -0.456, -0.242), so the direction TO the sun
        // is (-0.857, +0.456, +0.242) - an elevation of 14 degrees, not the
        // 34.9 a previous pass used. Converted (x,y,z)->(x,z,-y) and taken out
        // to 89m that is [-76.2, 21.5, -40.5].
        // V7: daylight moves to a high front-left sun, on the bearing the
        // painted sky's glow is drawn at, so the hero and the approach see the
        // lit faces of the house and the palms throw their shadows across the
        // lawns. Dusk's is the old bearing grown with the estate.
        position={day ? [-60, 52, 58] : [48, 24, -128]}
        intensity={keyIntensity}
        color={day ? '#FFF0DB' : '#FFB264'}
        castShadow
        shadow-mapSize={[2048, 2048]}
        // Tight ortho box around the building. The default frustum spans the
        // whole scene including a 450m ground plane, which spreads 2048px
        // across ~450m and gives shadows the resolution of a thumbnail.
        shadow-camera-left={-48}
        shadow-camera-right={48}
        shadow-camera-top={48}
        shadow-camera-bottom={-40}
        shadow-camera-near={1}
        shadow-camera-far={240}
        shadow-bias={-0.0006}
        shadow-normalBias={0.03}
      />

      {/* Cool counter-key from behind-right, no shadows.
          ---------------------------------------------------------------------
          0.85 -> 0.30, because it was not doing the job it was written for.

          This was authored as a RIM — "catches the cornice, the balustrade and
          the spire against the navy". At the hero camera it catches none of
          them. Isolated at runtime by sampling the framebuffer at each element
          with the light at 0.85, 0.30 and 0:

            parapet    163.5 / 163.2 / 163.0     no contribution
            cornice    139.6 / 139.6 / 139.6     none
            finial      59.9 /  59.9 /  59.9     none
            cupola     143.9 / 143.0 / 142.5     1%
            ROOF DECK  113.7 /  96.1 /  84.4     the whole of it

          The reason is geometric: at 22.6 degrees of elevation this light grazes
          every vertical face in frame and lands square on the one horizontal
          one. So its entire effect was to flood the roof — the building's
          largest continuous surface, and the one with the least detail — with
          #7FB4D6 until it read [104, 116, 125]: blue by 21 points, and at 113.7
          nearly as bright as the key-lit facade at 121.3. That is why the roof
          read as flat blue-grey plastic rather than as slate.

          At 0.30 the roof reads [94, 97, 99] — a warm-neutral slate holding a
          trace of cool sky, which is what a dusk roof actually does — and the
          hierarchy resolves: lit facade 121 > shaded facade 98 > roof 96 >
          lawn 72. Nothing else in the frame moves; facade, spire, cornice and
          parapet are identical to three significant figures.

          VERIFIED at the revolution beat too, where this light is closest to
          being a real rim: dropping it to 0.30 moves the back of the building
          by under 4% and the frame mean by 1.1 (56.6 -> 55.5). It is not
          carrying that shot either. */}
      {/* Off in daylight: it exists to keep a dusk silhouette off the navy,
          and with a lit sky and a 0.8 hemisphere it only flattens the roof. */}
      <directionalLight position={[34, 22, -40]} intensity={day ? 0 : 0.3} color="#7FB4D6" />

      {/* PHYSICAL SPILL FROM THE WINDOWS.

          Emissive materials in three light NOTHING — there is no GI in a
          real-time forward renderer, so the glowing reveals were self-lit
          stickers and the stone around them stayed black. That is exactly the
          "neon sticker" read. These are the light those windows actually cast.

          Positioned just OUTSIDE the facade planes rather than inside the
          rooms, so the falloff lands on the wall face, the entry steps and the
          fountain instead of on the back of a reveal nobody sees. `distance` is
          tight on every one: an unbounded point light is evaluated against
          every lit fragment in the scene, and five of those would cost more
          than the building.

          INTENSITY DROPPED 80%. Raising these to ~2.5x to "pay for" decay was
          wrong: MeshStandardMaterial accumulates them in scene-linear space,
          and the sum was arriving at the ACES curve far past the point where it
          still has roll-off left, so the facade clipped to white and took the
          limestone texture with it. Tone mapping cannot rescue a value that
          entered the buffer already blown. These are a warm architectural wash
          now, not a floodlight.

          decay={2} on all remaining lights is physically correct inverse-square falloff —
          intensity / d^2 — which is why they needed roughly 2.5x the raw
          intensity to reach the same surfaces. Under-decayed light is what
          makes a source read as a sticker rather than as illumination.

          NOTE for the "floating glowing dots" observation: a THREE.PointLight
          has NO geometry and cannot be seen. There are no helpers in this tree
          and never were. The visible discs are the emissive window reveals
          crossing the bloom threshold, plus the GodRays sun disc — the only
          added mesh, and one the pass requires. Both are addressed above and
          below rather than by deleting a helper that does not exist. */}
      {/* RectAreaLight planes aligned INSIDE the archways, replacing the front
          point lights. A point light radiates in every direction from a
          singularity, which is why its falloff on a flat facade reads as a
          circular hotspot — a sticker. A rect area light is a lit RECTANGLE:
          it throws the shape of the opening onto the stone and the steps, which
          is what a real window does.

          rotation-y turns each one to face out along +z. They are not visible
          geometry — a RectAreaLight has no mesh — so nothing new appears in
          frame. */}
      {/* ALL BUT EXTINGUISHED IN DAYLIGHT.

          Everything this rig is for is an argument about darkness — an unlit
          wall through the back of the orbit, a facade with nowhere to catch
          light, reveals that read as stickers because the stone around them is
          black. At midday the sun and a 0.7 environment do that work, and a
          warm interior wash on a sunlit limestone wall reads as exactly what
          the reference does not show: lamps on at noon.

          Not zero. 0.25 on the entry bay alone keeps the portico from going
          flat where the roof overhangs it, which is the one place the key
          genuinely cannot reach. The side and fountain lights go out entirely —
          in daylight both surfaces are lit by the sky. */}
      {/* V7: at the new frontispiece — the arched windows either side of the
          door under the portico, and the door itself, 0.35 m out from the
          wall face at z 8.40. */}
      <rectAreaLight
        position={[-2.95, 2.6, 8.75]} width={1.4} height={2.9}
        intensity={day ? 0 : 1.8} color="#FFAA55"
      />
      <rectAreaLight
        ref={entry}
        position={[0, 2.3, 8.75]} width={2.6} height={3.4}
        intensity={day ? 0.25 : 2.2} color={day ? '#FFE2C4' : '#FFB068'}
      />
      <rectAreaLight
        position={[2.95, 2.6, 8.75]} width={1.4} height={2.9}
        intensity={day ? 0 : 1.8} color="#FFAA55"
      />
      {/* The side elevation — what the camera faces from theta 70 onward.
          Without it the last third of the orbit plays against an unlit wall. */}
      <pointLight
        position={[14.4, 2.8, 0]} intensity={day ? 0 : 5.6}
        distance={22} decay={2} color="#FFAA55"
      />
      {/* Uplight on the fountain, so the centre of the composition has a source
          of its own rather than borrowing from the windows either side. */}
      <pointLight
        position={[0, 1.3, 30]} intensity={day ? 0 : 4.4}
        distance={14} decay={2} color="#FFC98A"
      />

      {/* Cool sky, warm ground bounce. Keeps the shadowed side from reading as
          black without lifting it toward the key's colour. */}
      {/* 0.5 -> 0.36. The hemisphere fills every upward-facing surface, and the
          largest upward-facing surface in the scene is now 18,432 triangles of
          authored terrain rather than a plane graded to near-black in code. At
          0.5 it lifted the ground to the same value as the lit facade and the
          architecture stopped separating from its site. */}
      {/* ref, because the evening fall writes .intensity every frame. args are
          CONSTRUCTOR arguments — driving the fall through them would rebuild
          the light sixty times a second. */}
      <hemisphereLight
        ref={hemi}
        args={
          day
            ? ['#BBD2E8', '#5C5A48', hemiIntensity]
            : ['#4A6B96', '#1A1512', hemiIntensity]
        }
      />
    </>
  );
}

/**
 * The one real-time light in the hall, and why there is exactly one.
 *
 * THE ROOM IS BAKED, AND THAT IS CORRECT. interior_hall.glb ships ten punctual
 * lights — a chandelier at 41,307 cd, a portrait spot at 10,327, and eight
 * sconces at 870 — and the lightmap is a bake OF THOSE LIGHTS. stripBakedLights()
 * removes them because leaving them in double-counts every one, and measured,
 * they took the frame to blown white. None of that changes here: the walls, the
 * marble, the ceiling and the stair are lit by the bake and stay lit by the bake.
 *
 * WHAT THE BAKE DOES NOT DELIVER IS FOCAL HIERARCHY. Measured on the shipped
 * establishing frame at 1440x900, by region mean luminance:
 *
 *     left wall      99.8        balustrade     89.5
 *     right wall     80.3        portrait       56.2
 *     stair tread    44.5        floor          26.3
 *
 * The brightest things in the shot are the WALLPAPER, and the founder's
 * portrait — the destination of the entire interior sequence, and the surface
 * the brief hangs the About page on — renders darker than the plaster it is
 * mounted on. That is the hierarchy inverted, and no amount of exposure fixes
 * it because exposure moves both.
 *
 * So: one spot, at the fixture that is already modelled above the frame
 * (`piclight_shade`, world [0, 5.95, -5.02]), reusing LGT_portrait's own
 * authored cone (outer 0.9076 rad) and colour. It is bounded by `distance` so
 * it cannot spill down the stair, and it casts no shadow — a depth pass for one
 * picture light is not a trade worth making.
 */
const PORTRAIT_LIGHT = {
  // V7: LGT_portrait's own place, carried with the portrait when the hall was
  // extended — hung 1.28m higher and 2.4m further back, 5% larger.
  position: [0, 7.24, -7.41] as [number, number, number],
  aim: [0, 5.42, -7.64] as [number, number, number],
  angle: 0.9076,
  colour: '#FFE6C6',
};

function InteriorLighting() {
  const spot = useRef<THREE.SpotLight>(null);
  const aim = useRef<THREE.Object3D>(null);

  // three does not update a SpotLight's target for you, and a target that is
  // not in the scene keeps an identity matrixWorld — which would aim this at
  // the room's origin, i.e. at the middle of the floor.
  useEffect(() => {
    if (spot.current && aim.current) spot.current.target = aim.current;
  }, []);

  return (
    <>
      <object3D ref={aim} position={PORTRAIT_LIGHT.aim} />
      <spotLight
        ref={spot}
        position={PORTRAIT_LIGHT.position}
        angle={PORTRAIT_LIGHT.angle}
        penumbra={0.6}
        decay={2}
        // `distance` is NOT a soft bound in three — it is a windowing term,
        // pow(1 - d/cutoff, decay), applied on top of the inverse square. At a
        // 5m cutoff the portrait sits 1.9m out and lost 62% of the light to the
        // window alone, which is why the first intensity did almost nothing.
        // 12m puts the window at 0.71 here and still leaves the stair foot, 6m
        // away, at under 3% of the portrait's illumination.
        distance={12}
        intensity={40}
        color={PORTRAIT_LIGHT.colour}
      />
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
 * Transmission buffer resolution, per tier.
 *
 * three renders the whole opaque scene a SECOND time into
 * `_transmissionRenderTarget` whenever any material has transmission > 0, and
 * `transmissionResolutionScale` is the supported lever on how big that target
 * is. Measured on this scene: the transmission pass costs +212 draw calls /
 * +496k triangles outside and +320 calls / +307k triangles inside — roughly a
 * doubling of the frame in both sets.
 *
 * The draw calls are inherent (the scene genuinely has to be re-rendered), but
 * the FILL is not, and fill is what a phone actually runs out of. At 0.5 the
 * buffer is a quarter of the pixels. That is safe here because the buffer is
 * only ever read back through a refraction lookup that is already blurred by
 * material roughness — measured mean luminance was identical (250.07 at both
 * 1.0 and 0.5) with zero GL errors.
 *
 * High tier keeps 1.0: it has the headroom, and the chandelier crystal
 * (transmission 1.0, roughness 0.02) is the one surface where a sharp
 * refraction is worth paying for.
 */
const TRANSMISSION_SCALE: Record<DeviceTier, number> = {
  high: 1.0,
  mid: 0.5,
  low: 0.5,
};

/**
 * The renderer's colour pipeline, with exactly ONE writer.
 *
 * WHY THIS IS A COMPONENT AND NOT A <Canvas gl={...}> PROP
 *
 * It was a prop, and that made tone mapping non-deterministic, because two
 * things were fighting over `gl.toneMapping`:
 *
 *   1. r3f re-applies the `gl` prop on every re-render of <Canvas>. Its
 *      `configure()` compares the config's VALUES against the live renderer and
 *      calls applyProps on any mismatch — a stable object identity does not
 *      help, because the mismatch is what triggers it.
 *   2. @react-three/postprocessing's <EffectComposer> sets
 *      `gl.toneMapping = NoToneMapping` in a mount effect with deps [gl], so it
 *      fires exactly once and never again.
 *
 * MEASURED consequence: a cold load rendered with NoToneMapping (the composer
 * mounts after the renderer is configured, so it wins), and any client-side
 * navigation flipped it back to ACESFilmic (WorldCanvas re-renders, so r3f
 * wins). The same URL rendered two different ways depending on how the visitor
 * arrived. Worse, on the cold path `toneMappingExposure` was inert too: three
 * only compiles the exposure multiply into a material when
 * `toneMapping !== NoToneMapping`, so the whole documented exposure budget
 * below was doing nothing.
 *
 * The fix is not to fight harder, it is to end the contest. `toneMapping` is
 * gone from the `gl` prop, so r3f has no opinion about it, and this is the only
 * place in the app that assigns it. It is mounted AFTER <PostFX>, so on the
 * commit where the composer mounts this effect runs last; and `tier` is in the
 * dep list because changing tier remounts the composer, which would otherwise
 * re-assert NoToneMapping behind our back.
 */
function ColorPipeline({ exposure, tier }: { exposure: number; tier: DeviceTier }) {
  const gl = useThree((s) => s.gl);
  useEffect(() => {
    // Stated rather than inherited. r3f already defaults to sRGB, but the
    // pipeline should not depend on a library default staying put.
    gl.outputColorSpace = THREE.SRGBColorSpace;
    gl.toneMapping = THREE.ACESFilmicToneMapping;
    gl.toneMappingExposure = exposure;
    gl.transmissionResolutionScale = TRANSMISSION_SCALE[tier];
    // The doorway lifts exposure through its peak — the eye adjusting to the
    // light — as a MULTIPLE of this value, so it has to know what this value is.
    doorwaySurfaces.gl = gl;
    doorwaySurfaces.exposure = exposure;
    doorwaySurfaces.blur = tier !== 'low';
  }, [gl, exposure, tier]);
  useEffect(
    () => () => {
      if (doorwaySurfaces.gl === gl) doorwaySurfaces.gl = null;
    },
    [gl],
  );
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
    let target: THREE.WebGLRenderTarget | null = null;

    const build = () => {
      const pmrem = new THREE.PMREMGenerator(gl);
      const room = new RoomEnvironment();
      const next = pmrem.fromScene(room, 0.04);
      room.dispose?.();
      pmrem.dispose();
      target?.dispose();
      target = next;
      scene.environment = next.texture;
    };

    build();

    // REBUILD ON RESTORE. Everything else in this scene survives a lost context
    // on its own: three calls preventDefault(), no-ops render() while the
    // context is gone, and rebuilds its GL state in onContextRestore, after
    // which geometries and textures re-upload lazily from the CPU copies they
    // still hold. VERIFIED by forcing a loss/restore — the frame came back
    // byte-identical at 641 draw calls / 628,429 triangles.
    //
    // This is the one thing that cannot come back by itself. A PMREM cube is a
    // render target: `isRenderTargetTexture` with no CPU mipmaps, so there is
    // nothing to re-upload FROM, and the effect that generated it has deps
    // [gl, scene] — neither of which changes across a restore, so it would
    // never re-run. The result was a silent failure rather than a visible one:
    // the room looked correct while every metal, the glass and the fountain
    // water quietly lost their specular response and read as flat paint.
    //
    // three registers its own restore listener when the renderer is
    // constructed, so it runs before this one and the GL state is already
    // rebuilt by the time we generate.
    const canvas = gl.domElement;
    const onRestored = () => build();
    canvas.addEventListener('webglcontextrestored', onRestored);

    return () => {
      canvas.removeEventListener('webglcontextrestored', onRestored);
      scene.environment = null;
      target?.dispose();
      target = null;
    };
  }, [gl, scene]);

  // Separate effect: retuning intensity must not rebuild the cube map.
  useEffect(() => {
    scene.environmentIntensity = intensity;
  }, [scene, intensity]);

  return null;
}

/**
 * Sky, per grade.
 *
 * Dusk is a flat #0A1120 and stays flat: it is night air, it carries the fog
 * colour, and there is nothing in it to graduate.
 *
 * Daylight uses THE ACTUAL REFERENCE ENVIRONMENT — assets/hdri/
 * 199_hdrmaps_com_free_2K.exr, the same file Blender's W_HDRI world is built
 * on — baked to an equirectangular JPEG and assigned to scene.background.
 *
 * WHY THIS REPLACED A RUNTIME GRADIENT. The gradient before it was fitted to
 * the reference's vertical luma profile and matched it well, but it was still
 * a smooth ramp and read as one. Two things a ramp cannot do:
 *
 *   1. There is NO SKY IN THIS SHOT. The hero is a 3/4 bird's eye and the
 *      whole 41-degree frame sits below the horizon, so what reads as a dark
 *      band at the top is the HDRI's forested hills, with sunlit meadow below.
 *      That is landscape, and it has silhouette. A ramp has none.
 *   2. A 2D background is a fullscreen quad and does not move with the camera.
 *      The journey ORBITS the building, so a painted ramp sits frozen behind a
 *      turning scene. An equirect background parallaxes correctly, which is
 *      also what Blender is doing.
 *
 * ORIENTATION NEEDS NO OFFSET, and that is derived, not dialled in. Blender
 * maps an equirect world with u = -atan2(y, x)/2pi + 0.5, v = asin(z)/pi + 0.5;
 * three uses u = atan2(z, x)/2pi + 0.5, v = asin(y)/pi + 0.5. Under this
 * project's Blender->three axis convention (x, y, z) -> (x, z, -y), three's u
 * becomes atan2(-y, x)/2pi + 0.5, and atan2(-y, x) == -atan2(y, x). Identical
 * mapping, so the environment lands in the same place in both renderers.
 *
 * BACKGROUND ONLY. scene.environment remains the separately generated cube
 * map, so this changes what is BEHIND the building and contributes nothing to
 * how it is lit. The two are deliberately different objects: the lighting
 * environment is tuned for the metals and the glass, and binding this to it
 * would silently re-light every material in the scene.
 */
// V7: SKY ONLY. The meadow HDRI above carried forested hills and a village on
// its horizon, which the client review called "cheap" and "a slum". The estate
// now supplies its own horizon (a planted berm and tree belt), so the panorama
// is painted by tools/gltf/make_sky_v7.py: tropical blue, horizon haze matched
// by DAYLIGHT_HAZE, a sun glow on the daylight key's bearing, soft cumulus.
const SKY_EQUIRECT_URL = '/textures/sky_estate_v7_4k.jpg';

function SkyBackground({ set, grade }: { set: SceneSet; grade: Grade }) {
  const scene = useThree((s) => s.scene);
  const [env, setEnv] = useState<THREE.Texture | null>(null);
  const wants = set === 'exterior' && grade === 'daylight';

  useEffect(() => {
    if (!wants) return;
    let dead = false;
    new THREE.TextureLoader().load(
      SKY_EQUIRECT_URL,
      (tex) => {
        if (dead) {
          tex.dispose();
          return;
        }
        tex.mapping = THREE.EquirectangularReflectionMapping;
        tex.colorSpace = THREE.SRGBColorSpace;
        setEnv(tex);
      },
      undefined,
      // A missing or refused background must not take the scene down: the flat
      // colour below is a complete fallback, not a placeholder.
      () => {},
    );
    return () => {
      dead = true;
    };
  }, [wants]);

  useEffect(() => {
    const prev = scene.background;
    scene.background =
      wants && env
        ? env
        : new THREE.Color(set === 'exterior' ? GRADE_BG[grade] : GRADE_BG.dusk);
    return () => {
      scene.background = prev;
    };
  }, [scene, env, wants, set, grade]);

  useEffect(() => () => env?.dispose(), [env]);

  return null;
}

export function WorldCanvas() {
  const pathname = usePathname() || '/';
  const place = placeForRoute(pathname);
  const sceneCards = useSceneCards((st) => st.cards);
  const [tier, setTier] = useState<DeviceTier>('mid');
  const [failed, setFailed] = useState(false);
  const [supported, setSupported] = useState<boolean | null>(null);

  // THE JOURNEY, and the one thing about it that has to live in React state.
  //
  // Everywhere else the journey is a mutable module object read inside
  // useFrame, because it changes every frame and must never re-render. But
  // WHICH MODEL IS MOUNTED is a tree-shape decision, and that is React's job.
  // So the leg is mirrored into state by <JourneyDriver>, which fires exactly
  // twice per visit — once when the interior is armed for loading, once when
  // the crossover is passed.
  const onJourney = poseFor(place).path === true;
  const [leg, setLeg] = useState<SceneSet>('exterior');
  const [interiorArmed, setInteriorArmed] = useState(false);

  // Which model this route needs.
  //
  // For every route except the journey this is what it always was: a pure
  // function of the place. On the journey it is a function of SCROLL, because
  // the home page now crosses from the forecourt into the hall partway down
  // and the route never changes while it does.
  const set: SceneSet = onJourney ? leg : setFor(place);
  const look = useLook(set);

  // Reset when leaving the journey, so navigating away mid-interior and coming
  // back does not open the home page standing in the hall.
  useEffect(() => {
    if (!onJourney) setLeg('exterior');
  }, [onJourney]);

  const onLeg = useCallback((l: 'exterior' | 'interior') => setLeg(l), []);

  // What the scene is ACTUALLY showing, once React has committed it. The
  // doorway will not clear its white until this names the far model and the
  // scene has drawn it (doorway.ts, FAR_FRAMES).
  useEffect(() => {
    doorwayState.sceneLeg = set;
  }, [set]);
  const onArmed = useCallback(() => setInteriorArmed(true), []);

  // The loaded hall, handed up so the interaction layer can adopt its
  // pedestals. State rather than a ref because <InteriorStage> has to re-run
  // its surgery when it arrives, and a ref would not tell it that it had.
  const [hallRoot, setHallRoot] = useState<THREE.Object3D | null>(null);
  /** The loaded exterior, for the front doors to adopt. */
  const [exteriorRoot, setExteriorRoot] = useState<THREE.Object3D | null>(null);

  // The doorway holds its white for a hall that has not finished loading, so
  // it has to know when the hall has.
  useEffect(() => {
    doorwayState.hallReady = hallRoot !== null;
  }, [hallRoot]);

  // THE DOORWAY'S HOLD ON THE PAGE. Registered here because this is the client
  // component that already owns both ends of it — the scroll library and the
  // published scroll value — and doorway.ts is kept free of either so its
  // choreography can be tested as arithmetic.
  useEffect(() => {
    const coarse = window.matchMedia('(pointer: coarse)');
    setDoorwayHost({
      progress: () => {
        syncScrollProgress();
        return readScrollProgress();
      },
      jumpTo: (p) => {
        const y = Math.round(Math.min(1, Math.max(0, p)) * scrollExtent());
        if (lenisInstance) lenisInstance.scrollTo(y, { immediate: true, force: true });
        else window.scrollTo(0, y);
        syncScrollProgress();
      },
      hold: (on) => {
        if (lenisInstance) {
          if (on) lenisInstance.stop();
          else lenisInstance.start();
        }
        // Lenis stops the wheel and the touch gesture, but not the momentum a
        // phone carries after the finger lifts; only the document refusing to
        // scroll stops that. Not on a desktop, where hiding the scrollbar would
        // shift the whole page sideways by its width.
        if (coarse.matches) document.documentElement.style.overflow = on ? 'hidden' : '';
      },
      glideTo: (p, seconds, done) => {
        const y = Math.round(Math.min(1, Math.max(0, p)) * scrollExtent());
        if (!lenisInstance) {
          window.scrollTo(0, y);
          done();
          return;
        }
        lenisInstance.scrollTo(y, {
          duration: seconds,
          easing: (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2),
          lock: true,
          onComplete: () => done(),
        });
      },
      canAnimate: () => lenisInstance !== null && !prefersReducedMotion(),
    });

    // A crossing only becomes a passage if the visitor made it. The scroll keys
    // are the ones a browser scrolls with; anything else is typing.
    const SCROLL_KEYS = new Set([
      'ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', 'Home', 'End', ' ', 'Spacebar',
    ]);
    const onGesture = () => noteDoorwayInput(performance.now());
    const onKey = (e: KeyboardEvent) => {
      if (!SCROLL_KEYS.has(e.key)) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      // While the page is held, a scroll key must not scroll it underneath the
      // passage either — Lenis does not intercept the keyboard.
      if (doorwayState.mode === 'running') {
        e.preventDefault();
        return;
      }
      noteDoorwayInput(performance.now());
    };
    window.addEventListener('wheel', onGesture, { passive: true });
    window.addEventListener('touchmove', onGesture, { passive: true });
    window.addEventListener('keydown', onKey, { capture: true });
    return () => {
      window.removeEventListener('wheel', onGesture);
      window.removeEventListener('touchmove', onGesture);
      window.removeEventListener('keydown', onKey, { capture: true });
      cancelDoorway();
      setDoorwayHost(null);
    };
  }, []);

  const onFrame = useCallback((el: HTMLDivElement | null) => {
    doorwaySurfaces.frame = el;
    doorwaySurfaces.paintedFilter = '';
  }, []);

  // Per-frame channels out of the journey. Refs, not state, for the usual
  // reason — these change 60 times a second and re-rendering the canvas tree on
  // each one would undo everything the scroll driver exists to avoid.
  const constellationReveal = useRef(0);
  const interiorLeg = useRef(0);
  /** The district field's chapter presence. Its own channel rather than a
   *  threshold on interiorLeg, because the field has to be dark for the whole
   *  interior and only ignite on the last chapter. */
  const cityReveal = useRef(0);
  const veilRef = useRef<HTMLDivElement>(null);

  // Three published projects, three stations. The count drives the interior
  // camera path, the station components and the DOM chapters, all from the same
  // number — see the note in interiorPath.buildInteriorBeats about why this is
  // not four.
  const stationCount = Math.min(4, sceneCards.length);

  /**
   * Leg progress at which the district field's chapter opens.
   *
   * Derived from CHAPTER_WEIGHTS and the station count rather than written as a
   * number, because buildInteriorBeats renormalises the leg by exactly this sum
   * — so a fourth published project moves the chapter and this moves with it.
   * The alternative is the failure journey.ts already records: the same
   * constant in two files, edited in one of them.
   */
  const cityFrom = useMemo(() => {
    const W = CHAPTER_WEIGHTS;
    const span = W.establish + stationCount * W.station + W.portrait + W.city;
    return (W.establish + stationCount * W.station + W.portrait) / span;
  }, [stationCount]);

  /**
   * The published projects, in the shape the district field's layout reads.
   *
   * Same store the hologram tables bind to, so a beacon and a plan can never
   * disagree about what is published — and `total` is carried because the
   * beacon's SIZE is its unit count, which is the one piece of real magnitude
   * these three projects have.
   */
  const cityProjects = useMemo(
    () =>
      sceneCards.map((c) => ({
        slug: c.slug,
        name: c.name,
        locality: c.locality,
        city: c.city,
        totalUnits: c.total ?? 0,
        availableUnits: c.available ?? 0,
        soldOut: c.soldOut,
      })),
    [sceneCards],
  );

  /** Clicking a hologram or the portrait is a real navigation. Routed rather
   *  than location-assigned so the App Router transition is a client one and
   *  the canvas — and therefore the camera — survives it.
   *
   *  Through the veil, and through the SAME veil a link click uses. A hologram
   *  and a link in the page beneath it lead to the same project page; if one
   *  dissolves and the other cuts, the 3D reads as a separate toy bolted onto
   *  the site rather than as part of it.
   *
   *  The router moved with it: RouteVeil owns the only useRouter on this path
   *  now, and under reduced motion it still calls router.push — it simply does
   *  not dissolve. A second router here would have been two code paths to the
   *  same page. The hard-navigation fallback inside veiledPush is for the case
   *  where the veil is not mounted at all, which on this site cannot happen:
   *  it lives in the (site) layout above every route that has a canvas. */
  const openHref = useCallback((href: string) => veiledPush(href), []);

  // Probed on mount, not during render, so server and first client render agree.
  useEffect(() => setSupported(webglSupported()), []);
  const onTier = useCallback((t: DeviceTier) => setTier(t), []);
  const onError = useCallback(() => setFailed(true), []);

  if (supported === false || failed) {
    return (
      <>
        {/* The one thing a screen reader should hear about this, said once.
            The panel below is the BACKDROP — it stands in for the canvas, and
            the layout renders the real page on top of it at z-10, so it is not
            a place to repeat navigation that already exists above it. */}
        <p role="status" className="sr-only">
          {supported === false
            ? 'The interactive view is not available on this device. Everything it shows is on this page.'
            : 'The interactive view could not load. Everything it shows is on this page.'}
        </p>
        <div
          aria-hidden="true"
          className="pointer-events-none fixed inset-0 z-0 bg-[#0A1120]"
        >
          <SceneFallback reason={supported === false ? 'unsupported' : 'error'} />
        </div>
      </>
    );
  }

  return (
    // aria-hidden and non-interactive: the world is the backdrop, and every
    // word a screen reader needs is in the DOM layer above it.
    // Behind the canvas, and it must agree with <color attach="background">
    // below — otherwise the frame the GLB has not painted yet shows navy under
    // a daylight scene. Same rule, same source of truth.
    <div
      ref={onFrame}
      aria-hidden="true"
      className="fixed inset-0 z-0"
      style={{ background: set === 'exterior' ? GRADE_BG[look.grade] : GRADE_BG.dusk }}
    >
      <SceneBoundary onError={onError}>
        <Canvas
          // Soft shadow maps, and only on tiers that can afford the extra
          // depth pass. The key light's shadow is what puts the portico
          // columns ONTO the facade rather than beside it, which is most of
          // the architectural presence in the frame.
          shadows={tier === 'low' ? false : { type: THREE.PCFSoftShadowMap }}
          // A 3x phone screen renders 9x the pixels for no perceptible gain on
          // a scene this dark, and it is the single biggest mobile cost.
          dpr={[1, tier === 'high' ? 2 : 1.5]}
          // DELIBERATELY no toneMapping / toneMappingExposure here. r3f
          // re-applies this object on every re-render, and the postprocessing
          // composer writes toneMapping once on mount — between them the value
          // was non-deterministic. <ColorPipeline> below is the single owner;
          // see the note on that component.
          gl={{
            antialias: tier !== 'low',
            powerPreference: 'high-performance',
          }}
          // Seeded on the exterior axis, because that is where the site opens.
          // CameraRig takes over on the first frame; this only avoids one frame
          // rendered from the old interior default while it settles.
          camera={{ position: [0, 1.65, 30], fov: 45, ...CLIP.exterior }}
        >
          <SkyBackground set={set} grade={look.grade} />
          {/* FIRST, so every reader below samples a value written earlier in
              the same frame. One driver replaces the three identical
              scroll/resize/ResizeObserver + useFrame sets that CameraRig,
              ExteriorLighting and Terrain each used to install. */}
          <ScrollProgressDriver />
          {/* SECOND. Reads the value written on the line above, in the same
              frame, and publishes the leg every consumer below branches on. */}
          <JourneyDriver
            active={onJourney}
            onLeg={onLeg}
            onArmed={onArmed}
            reveal={constellationReveal}
            interiorLeg={interiorLeg}
            cityReveal={cityReveal}
            cityFrom={cityFrom}
            veil={veilRef}
          />
          <CameraClipping set={set} />
          {/* Inside: GI is baked into the lightmap, so a real-time rig would
              double-count it and this only lifts the instanced ornament, which
              carries no lightmap because instancing and per-placement UVs are
              exclusive. Outside: kept very low, because the sky is the
              hemisphere light and a flat ambient would cancel the relief the
              key light exists to create. */}
          <ambientLight intensity={look.ambient} />
          {set === 'exterior' && (
            <>
              <ExteriorLighting
                driveByScroll={poseFor(place).path === true}
                grade={look.grade}
                keyIntensity={look.key}
                hemiIntensity={look.hemi}
              />
              {/* Halved on low tier: the field is atmosphere, and a phone
                  should get thinner air rather than no air. */}
              <Motes count={tier === 'low' ? 1100 : 2400} />
              {/* <Terrain /> IS DELIBERATELY ABSENT.
                  It drew procedural karst relief because the exported
                  ground_plane was a flat, untextured, pure-white 450m square —
                  840 triangles the review correctly called "a primitive grey
                  plane". The final delivery replaces it with 18,432 triangles
                  of authored terrain spanning +/-120m: undulating beyond the
                  formal garden, flat through it, with a gravel forecourt, a
                  drive on axis and lawn parterres driven by a baked zone mask.
                  Drawing a procedural approximation over that would be a worse
                  landscape rendered twice. The component is kept in the tree
                  for reference but is no longer mounted. */}
              {/* THE CONSTELLATION. Mounted with the exterior because it lives
                  in that model's coordinate space, but faded by its own chapter
                  rather than by the leg — it has to be dark through the hero
                  and the revolution and only ignite as the camera turns onto
                  it. Halved on low tier: a phone gets a thinner constellation,
                  not a missing one. */}
              {onJourney ? (
                <Constellation
                  position={CONSTELLATION}
                  radius={CONSTELLATION_RADIUS}
                  reveal={constellationReveal}
                  density={tier === 'low' ? 0.45 : 1}
                />
              ) : null}
            </>
          )}
          <Suspense fallback={null}>
            {/* BOTH SETS, once the journey has armed the interior.

                This used to be strictly one at a time, and the reasoning was
                sound while the two were different ROUTES: holding a 15MB model
                in memory to stand on a lawn you cannot walk off buys nothing.
                The journey changes the premise. The hall is now four fifths of
                a scroll away from the forecourt with no navigation in between,
                so loading it at the crossover would put a multi-second Draco
                and KTX2 stall exactly where the transition is meant to be a
                dissolve.

                So it is mounted early and hidden. `visible={false}` on the
                wrapper skips the whole subtree at render — three.js tests
                visibility before it culls, so an invisible group costs a
                traversal and no draw calls — while the parse, the transcode and
                the GPU upload have all already happened by the time the veil
                closes over them.

                Off the journey, the old behaviour is unchanged. */}
            <group visible={set === 'exterior'}>
              <ExteriorModel grade={look.grade} onRoot={setExteriorRoot} />
              {/* The front doors, cut into two leaves that can open. Closed,
                  they are the shipped geometry exactly; only a passage through
                  the doorway moves them. */}
              <ExteriorDoorway root={exteriorRoot} />
            </group>
            {/* ITS OWN SUSPENSE BOUNDARY, and that is a defect fix.

                When the hall is armed mid-film, HallModel suspends while its
                15MB parse runs — and a component that suspends during an
                update makes React HIDE everything already shown inside the
                same boundary; r3f's hideInstance does it by setting
                `visible = false`. With one boundary around both sets, arming
                the hall switched the whole exterior off: MEASURED from the
                live scene at the front door, `mansion_walls` was invisible for
                the six seconds the hall took to load, leaving the sky and the
                motes on screen where the house had been. Nested, the only
                thing a loading hall can hide is itself — which is already
                hidden. */}
            <Suspense fallback={null}>
              {onJourney ? (
                interiorArmed ? (
                  <group visible={set === 'interior'}>
                    <HallModel onRoot={setHallRoot} />
                  </group>
                ) : null
              ) : set === 'interior' ? (
                <HallModel onRoot={setHallRoot} />
              ) : null}
            </Suspense>
            {/* Metals need something to reflect or they read as flat paint;
                outside, the glass and fountain water need it to refract. */}
            <RoomEnvironmentMap intensity={look.env} />
          </Suspense>
          {/* The picture light over the founder's portrait — the only real-time
              light in a room that is otherwise entirely baked. See the note on
              the component for why there is exactly one. */}
          {set === 'interior' ? <InteriorLighting /> : null}
          {/* The interactive layer inside the hall: the turntables, the
              holograms and the portrait. Mounted only on the journey — /hall
              and /projects hold a still frame and have no scroll choreography
              for a station to take its emphasis from. */}
          {onJourney && interiorArmed ? (
            <InteriorStage
              root={hallRoot}
              projects={sceneCards}
              legProgress={interiorLeg}
              onOpen={openHref}
            />
          ) : null}
          {/* /hall is inside the mansion too. It has no scroll film, so the
              stage runs 'still': every table turns from anywhere in the room,
              the projectors sit on their tables, and the holograms hold the
              strength the GLB shipped. */}
          {!onJourney && set === 'interior' ? (
            <InteriorStage
              root={hallRoot}
              projects={sceneCards}
              legProgress={interiorLeg}
              onOpen={openHref}
              mode="still"
            />
          ) : null}
          {/* THE DISTRICT FIELD, beyond the entry doors. Mounted with the
              interior because it lives in the hall's coordinate space and is
              framed by the hall's own opening; dark, and off the raycaster's
              list, for every chapter but the last. */}
          {onJourney && interiorArmed ? (
            <CityField
              projects={cityProjects}
              reveal={cityReveal}
              root={hallRoot}
              onOpen={(slug) => openHref(`/projects/${slug}`)}
              tier={tier}
            />
          ) : null}
          {look.free ? (
            <FreeCamera />
          ) : (
            <Rig place={place} stationCount={stationCount} onTier={onTier} />
          )}
          {/* LAST child on purpose: r3f's EffectComposer wraps whatever the
              scene rendered, so it has to mount after the content it filters.
              Skipped entirely in free-camera look-dev, where an unfiltered
              frame is the whole point of the mode. */}
          {!look.free && <PostFX tier={tier} />}
          {/* LAST, and after PostFX on purpose. React runs sibling effects in
              render order, so mounting the colour pipeline here means it is the
              final writer on the same commit that mounts the composer — which
              is the whole reason tone mapping is now deterministic. */}
          <ColorPipeline exposure={look.exposure} tier={tier} />
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
      {set === 'exterior' && look.grade === 'daylight' && (
        <div
          className="pointer-events-none absolute inset-0 z-[1]"
          style={{ background: DAYLIGHT_COLUMN_SCRIM }}
        />
      )}

      {/*
        THE THRESHOLD.

        The last metre of the approach and the first moment inside, as one
        blackout. This is where the exterior model is exchanged for the interior
        one, and the only reason that exchange is invisible is that this element
        is at full opacity while it happens.

        It is NOT a fade to a colour that happens to be dark: #05080F is the
        same value the fog resolves to at the end of the approach, so the frame
        does not shift hue as it closes. A slight warm bias at the centre — the
        light from a door that is still open — keeps it from reading as a
        browser tab that stopped painting.

        z-[2], above both scrim layers and above the canvas, below the page
        content at z-10. The page's own copy stays legible through the
        transition, which is what stops the passage feeling like a stall.
      */}
      <div
        ref={veilRef}
        className="absolute inset-0 z-[2]"
        style={{
          opacity: 0,
          pointerEvents: 'none',
          background:
            'radial-gradient(120% 90% at 50% 56%, #0B1220 0%, #05080F 46%, #04060B 100%)',
          // No CSS transition: the opacity is written every frame from the
          // scroll position, and a transition on top of that is a second lag in
          // series with the damping already applied to it.
          transition: 'none',
          willChange: 'opacity',
        }}
      />
    </div>
  );
}
