// apps/public/src/components/experience/coverLeaves.ts
//
// THE COVER'S NEAR LEAVES (the concept the user asked to be built 1:1,
// 2026-10-27): broad leaves across the frame's bottom-left corner, close to
// the lens and out of its focus, dark against the lawn, as a camera standing
// in the forest's edge would have them. The paid audit of 2026-10-04 had
// asked for "a true foreground element to frame the house" and it was left
// for want of a lower camera; the concept puts it in the frame, so here it is,
// without moving the camera: leaves a metre from the lens.
//
// Painted once, here, into a texture (no file to fetch): a spray of leaf
// shapes from the corner, each darker toward its base with a light rim along
// its upper edge, blurred as a lens blurs what is a metre away. Stood each
// frame in front of the camera over the frame's corner; as the camera leaves
// the cover they slide out of the corner and fade (COVER_LEAVES.gone), as
// leaves the camera rose past would.
//
// Under the estate's root (exteriorJungle's way): the warm-up builds its one
// program with the rest.

import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { journeyState } from './journey';
import { keepDepthAlpha } from './LensFocus';

export const COVER_LEAVES = {
  /** The corner they cover, in the frame's own units (0..1 from its left and
   *  its foot), past its edges a little. */
  rect: { x0: -0.05, x1: 0.37, y0: -0.07, y1: 0.36 } as const,
  /** Metres in front of the lens. */
  depth: 1.2,
  /** Gone over this much of the exterior leg, and how far they slide. */
  gone: [0.004, 0.06] as const,
  slide: 0.22,
  /** The blur, in texture pixels (of 1024). */
  blur: 9,
} as const;

/** The leaves, painted: a canvas, or null where there is no document. */
function paintLeaves(): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null;
  const W = 1024;
  const H = 1024;
  const sharp = document.createElement('canvas');
  sharp.width = W;
  sharp.height = H;
  const g = sharp.getContext('2d');
  if (!g) return null;
  // a stream of numbers, the same every time
  let seed = 1847;
  const rnd = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  const leaf = (x: number, y: number, len: number, wid: number, ang: number, value: number) => {
    g.save();
    g.translate(x, y);
    g.rotate(ang);
    g.beginPath();
    g.moveTo(0, 0);
    g.bezierCurveTo(len * 0.22, -wid, len * 0.72, -wid * 0.86, len, 0);
    g.bezierCurveTo(len * 0.72, wid * 0.86, len * 0.22, wid, 0, 0);
    const shade = g.createLinearGradient(0, -wid, len * 0.3, wid);
    const v = value;
    shade.addColorStop(0, `rgb(${Math.round(70 * v)}, ${Math.round(84 * v)}, ${Math.round(40 * v)})`);
    shade.addColorStop(0.45, `rgb(${Math.round(34 * v)}, ${Math.round(46 * v)}, ${Math.round(20 * v)})`);
    shade.addColorStop(1, `rgb(${Math.round(14 * v)}, ${Math.round(20 * v)}, ${Math.round(9 * v)})`);
    g.fillStyle = shade;
    g.fill();
    // the rib
    g.strokeStyle = `rgba(${Math.round(96 * v)}, ${Math.round(104 * v)}, ${Math.round(58 * v)}, 0.55)`;
    g.lineWidth = Math.max(1.5, wid * 0.05);
    g.beginPath();
    g.moveTo(0, 0);
    g.quadraticCurveTo(len * 0.5, -wid * 0.12, len * 0.97, 0);
    g.stroke();
    g.restore();
  };
  // stems from the corner (the canvas's bottom-left), fanning up and right
  for (let i = 0; i < 15; i += 1) {
    const t = i / 14;
    const ang = -Math.PI * (0.06 + 0.42 * t) + (rnd() - 0.5) * 0.24;
    const reach = 260 + rnd() * 420;
    const bx = -40 + rnd() * 160;
    const by = H + 40 - rnd() * 120;
    const x = bx + Math.cos(ang) * reach * 0.35;
    const y = by + Math.sin(ang) * reach * 0.35;
    leaf(x, y, reach, reach * (0.24 + rnd() * 0.12), ang + (rnd() - 0.5) * 0.5, 0.7 + rnd() * 0.6);
  }
  const out = document.createElement('canvas');
  out.width = W;
  out.height = H;
  const o = out.getContext('2d');
  if (!o) return sharp;
  o.filter = `blur(${COVER_LEAVES.blur}px)`;
  o.drawImage(sharp, 0, 0);
  return out;
}

let shared: { mesh: THREE.Mesh; texture: THREE.Texture } | null = null;

/** The leaves' quad (made once): a unit square, placed each frame. */
export function coverLeavesMesh(): THREE.Mesh | null {
  if (shared) return shared.mesh;
  const canvas = paintLeaves();
  if (!canvas) return null;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 1;
  const material = new THREE.MeshBasicMaterial({
    name: 'MAT_Cover_Leaves',
    map: texture,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    fog: false,
    toneMapped: true,
  });
  keepDepthAlpha(material);
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), material);
  mesh.name = 'cover_leaves';
  mesh.frustumCulled = false;
  mesh.renderOrder = 1000;
  mesh.matrixAutoUpdate = false;
  shared = { mesh, texture };
  return mesh;
}

const M = new THREE.Matrix4();
const P = new THREE.Matrix4();
const Q0 = new THREE.Quaternion();
const S = new THREE.Vector3();
const T = new THREE.Vector3();

/** How much of the leaves is on, and how far they have slid, at this point
 *  of the exterior leg. */
export function coverLeavesAt(leg: 'exterior' | 'interior', legProgress: number, film = true): { on: number; slid: number } {
  if (leg !== 'exterior' || !film) return { on: 0, slid: 1 };
  const [a, b] = COVER_LEAVES.gone;
  const k = Math.min(1, Math.max(0, (legProgress - a) / (b - a)));
  const e = k * k * (3 - 2 * k);
  return { on: 1 - e, slid: e };
}

/** Stand the leaves in front of the camera, each frame. Renders nothing. */
export function CoverLeaves() {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  useFrame((state) => {
    const mesh = shared?.mesh;
    if (!mesh || !mesh.parent) return;
    const { on, slid } = coverLeavesAt(journeyState.leg, journeyState.legProgress, !!journeyState.film);
    mesh.visible = on > 0.002;
    if (!mesh.visible) return;
    (mesh.material as THREE.MeshBasicMaterial).opacity = on;
    const r = COVER_LEAVES.rect;
    const d = COVER_LEAVES.depth;
    const h = d * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const w = h * camera.aspect;
    const drop = COVER_LEAVES.slide * slid;
    // the rect in view space, at depth d (x right, y up, looking down -z)
    const x0 = (r.x0 - drop) * 2 - 1;
    const x1 = (r.x1 - drop) * 2 - 1;
    const y0 = (r.y0 - drop) * 2 - 1;
    const y1 = (r.y1 - drop) * 2 - 1;
    const sway = Math.sin(state.clock.elapsedTime * 0.6) * 0.004;
    T.set(((x0 + x1) / 2) * w, ((y0 + y1) / 2 + sway) * h, -d);
    S.set(((x1 - x0) / 2) * w * 2, ((y1 - y0) / 2) * h * 2, 1);
    M.compose(T, Q0, S);
    // into the world through the camera, then into the parent's space
    M.premultiply(camera.matrixWorld);
    P.copy(mesh.parent.matrixWorld).invert();
    mesh.matrix.multiplyMatrices(P, M);
    mesh.matrixWorldNeedsUpdate = true;
  });
  return null;
}
