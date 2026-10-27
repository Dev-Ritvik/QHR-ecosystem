'use client';

// apps/public/src/components/experience/PortraitNameplate.tsx
//
// The founder's portrait, given the standing the client review asked for.
//
// THE REVIEW: the portrait above the stairs "needs respect and authority". The
// agreed answer was a nameplate with the name and title — the convention every
// boardroom and every old family house uses for the portrait of the person the
// place is named for. Two pieces, both built here rather than in the hall GLB so
// the wording can change without a re-export and a re-bake:
//
//   the mount   a walnut panel behind the frame, so the portrait hangs on a
//               place of honour instead of on plaster. Since the imperial hall
//               it is architecture, not an add-on: the arched walnut panel and
//               its architrave are in the GLB (imperial_hall_v7.py), so it is
//               lit by the bake like the rest of the wall
//   the plate   beneath the frame and above the landing, where the camera's
//               climb up the court arrives
//
// THE PLATE IS AN HONOUR BOARD NOW, NOT A BRASS TAG (the client, 2026-10-01:
// "the nameplate is not visible clearly kindly make it look elegant and it
// must create respect"). It was polished brass with the lettering engraved
// dark: under the picture light the brass printed as a pale bar, the engraving
// went with it, and the second line — title and company in one — stood about
// five pixels high from the landing. It is now what a club's or a college's
// board of names is: an ebonised field in a gilt moulding, the name in gilt
// capitals a third larger than it was, a rule and a lozenge, and the title
// alone under it, twice its old size. Dark takes the light without glare, so
// the lettering is the brightest thing on the plate from wherever it is seen.
//
// THE NAME IS NOT INVENTED. The site publishes the founder's title ("Managing
// Director", on /about) and the company; it does not publish the name. The plate
// carried only those two true lines until the client gave the name on
// 2026-09-18, and the fallback is kept: set FOUNDER.name to null and the plate
// goes back to title and company rather than to a guess.

import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useProbeBinding } from './HallModel';
import { PROBE_DEFINES } from './hallProbe';

/**
 * Reflection gains against the hall's own probe (hallProbe.ts): the gilt takes
 * the room as the hall's other gilt does; the ebonised field takes little, so
 * it stays dark under the lettering.
 */
const NAMEPLATE_GAIN: Record<string, number> = { plate_gilt: 1.15, plate_field: 0.35 };

/** The probe's defines, and the depth write the hall's lens reads: without it
 *  the lens took the nameplate for background and softened it under a sharp
 *  portrait. */
const NAMEPLATE_DEFINES = { ...PROBE_DEFINES, ESTATE_FOCUS: '' };

/**
 * THE PLATE'S TOP EDGE IS IN THE FRAME'S SHADE (the forensic audit of
 * 2026-10-09, #48: "The plate's gilt edge is stair-stepped"). The plate hangs
 * five centimetres under the frame's foot, and from the film's portrait beat
 * its top faces (two centimetres of gilt, under a pixel) are seen edge on. The
 * room's probe lit them with what is over them in the probe, the ceiling and
 * its lamps, and they printed as a broken line of pale dashes along the top of
 * the gilt (43 pixels brighter than the gilt in the band, measured at the
 * film's 81.5%; a ray through them found the plate). What is over them is the
 * frame's foot, so they are shaded as faces under it are: a quarter of their
 * light where they face up (`share`, of the light they would have; `from`,
 * `to`: the cosine with the vertical over which they go into it). The front of
 * the gilt, the lettering and the portrait are as they were. Measured after: 1.
 */
export const PLATE_TOP_SHADE = { share: 0.25, from: 0.5, to: 0.9 } as const;
const PLATE_TOP_GLSL = /* glsl */ `
{
  vec3 plateUp = normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz);
  outgoingLight *= 1.0 - ${(1 - PLATE_TOP_SHADE.share).toFixed(2)} * smoothstep(${PLATE_TOP_SHADE.from.toFixed(2)}, ${PLATE_TOP_SHADE.to.toFixed(2)}, dot(normal, plateUp));
}
#include <opaque_fragment>
`;
function shadeTopEdge(shader: { fragmentShader: string }): void {
  shader.fragmentShader = shader.fragmentShader.replace('#include <opaque_fragment>', PLATE_TOP_GLSL);
}
const plateTopKey = () => 'portrait-plate-top-shade';

export const FOUNDER = {
  /** The founder's name as it should be lettered, or null until supplied.
   *  Given by the client on 2026-09-18. */
  name: 'K. Bhaskara Rao' as string | null,
  title: 'Managing Director',
  company: 'Quality Homes Reality',
};

/**
 * Where the plate sits, from the imperial hall (imperial_hall_v7.py): the frame
 * spans x -1.51..1.51, y 5.00..9.07, its back on the wall face at z -7.70, on a
 * walnut panel whose face stands 3 cm proud of it; the landing is at y 4.20.
 * The plate hangs between the two. `width` and `height` are the whole object,
 * moulding and all; `moulding` is the gilt's width round the field.
 */
export const NAMEPLATE = {
  wallZ: -7.7,
  panelDepth: 0.03,
  frameBottom: 5.0,
  // Hung close under the frame's foot, as a frame's own tablet is: its lowest
  // edge has to be seen over the landing's rail from the portrait beat
  // (portraitNameplate.test.ts), and 5 cm lower it was not.
  plate: { width: 2.24, height: 0.49, depth: 0.022, gap: 0.05, moulding: 0.034 },
} as const;

/** The lettering, in metres on the plate (cap heights), and its gilt. */
export const LETTERING = { name: 0.118, title: 0.052, rule: 0.36 } as const;
/** The size, in pixels, the lettering's optical cut is taken at: about the
 *  film's own size for the name (see `letter`). */
export const OPTICAL_PX = 14;
/** And how much heavier than that cut it is set: a stroke of its own gilt
 *  round each letter, as a share of the capital's height. */
export const EMBOLDEN = 0.03;
const GILT = { light: '#F6E2A6', mid: '#DDB65C', deep: '#A97E2C' } as const;

function serifFamily(): string {
  if (typeof window === 'undefined') return 'Georgia, serif';
  const v = getComputedStyle(document.documentElement).getPropertyValue('--font-serif').trim();
  return v ? `${v}, Georgia, serif` : 'Georgia, serif';
}

/** The ebonised field and its gilt lettering, drawn once to a canvas. */
function drawPlate(canvas: HTMLCanvasElement, fieldHeight: number) {
  const W = canvas.width;
  const H = canvas.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  /** Canvas pixels to a metre of plate. */
  const px = H / fieldHeight;

  // Ebony: all but black, a shade warmer at its heart than at its edges.
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#120d09');
  g.addColorStop(0.5, '#1a130d');
  g.addColorStop(1, '#100b08');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  // The grain of a French-polished board: long, faint, along its length.
  for (let i = 0; i < 520; i += 1) {
    const y = Math.random() * H;
    ctx.strokeStyle = `rgba(${Math.random() < 0.5 ? '70,52,34' : '0,0,0'},${0.05 + Math.random() * 0.06})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(Math.random() * W * 0.4, y);
    ctx.lineTo(W * (0.6 + Math.random() * 0.4), y + (Math.random() - 0.5) * 3);
    ctx.stroke();
  }

  const gilt = (y0: number, y1: number) => {
    const s = ctx.createLinearGradient(0, y0, 0, y1);
    s.addColorStop(0, GILT.light);
    s.addColorStop(0.55, GILT.mid);
    s.addColorStop(1, GILT.deep);
    return s;
  };

  // A gilt line let into the field, inside the moulding.
  const inset = Math.round(0.03 * px);
  ctx.strokeStyle = GILT.mid;
  ctx.globalAlpha = 0.85;
  ctx.lineWidth = Math.max(2, Math.round(0.0045 * px));
  ctx.strokeRect(inset, inset, W - inset * 2, H - inset * 2);
  ctx.globalAlpha = 1;

  const family = serifFamily();
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  /**
   * One line of capitals, letter-spaced, centred, its caps `cap` metres high.
   *
   * CUT FOR THE SIZE IT IS SEEN AT (the second forensic audit, 2026-10-24,
   * #1: "at the film's distance the H of BHASKARA loses its crossbar, so the
   * name reads K. BIIASKARA RAO"). Playfair has an optical-size axis, and a
   * canvas follows it as a page does: the name was set at the texture's 157 px,
   * so it took the face's display cut, whose crossbars are hairlines — a
   * forty-fifth of the cap, and a quarter of a pixel once the plate is
   * minified to the film's fifteen-pixel capitals. So each line is set at
   * OPTICAL_PX, about the size the film shows it at, and scaled up to fill the
   * plate: the face's text cut, its crossbars and serifs drawn to hold at that
   * size; and a little heavier (EMBOLDEN). Measured in the canvas: the H's
   * crossbar 8.5% of the cap, from 2.2% (over a pixel at the film's size, from
   * a third of one).
   */
  const letter = (text: string, baseline: number, cap: number, tracking: number, weight: number, maxWidth: number) => {
    // Playfair's capitals stand 0.708 of the em; the line is laid out at the
    // optical size and drawn at `k` times it.
    let k = (cap * px) / 0.708 / OPTICAL_PX;
    ctx.font = `${weight} ${OPTICAL_PX}px ${family}`;
    const gap = OPTICAL_PX * tracking;
    const widths = [...text].map((c) => ctx.measureText(c).width);
    const total = widths.reduce((a, b) => a + b, 0) + gap * (text.length - 1);
    if (total * k > maxWidth) k = maxWidth / total;
    const cap0 = OPTICAL_PX * 0.708;
    ctx.save();
    ctx.translate((W - total * k) / 2, baseline);
    ctx.scale(k, k);
    // Raised gilt: a shade under each letter, then the leaf.
    const chars = [...text];
    ctx.lineJoin = 'round';
    ctx.lineWidth = cap0 * EMBOLDEN;
    const draw = (dx: number, dy: number) => {
      let x = 0;
      for (let i = 0; i < chars.length; i += 1) {
        ctx.fillText(chars[i], x + dx, dy);
        ctx.strokeText(chars[i], x + dx, dy);
        x += widths[i] + gap;
      }
    };
    ctx.fillStyle = ctx.strokeStyle = 'rgba(0,0,0,0.75)';
    draw(cap0 * 0.03, cap0 * 0.045);
    ctx.fillStyle = ctx.strokeStyle = gilt(-cap0, 0);
    draw(0, 0);
    ctx.restore();
  };

  /** A rule with a lozenge at its middle, between the two lines. */
  const rule = (y: number, width: number) => {
    const half = (width * px) / 2;
    const d = 0.011 * px;
    ctx.strokeStyle = GILT.mid;
    ctx.lineWidth = Math.max(2, Math.round(0.004 * px));
    ctx.beginPath();
    ctx.moveTo(W / 2 - half, y);
    ctx.lineTo(W / 2 - d * 2.2, y);
    ctx.moveTo(W / 2 + d * 2.2, y);
    ctx.lineTo(W / 2 + half, y);
    ctx.stroke();
    ctx.fillStyle = gilt(y - d, y + d);
    ctx.beginPath();
    ctx.moveTo(W / 2, y - d);
    ctx.lineTo(W / 2 + d, y);
    ctx.lineTo(W / 2, y + d);
    ctx.lineTo(W / 2 - d, y);
    ctx.closePath();
    ctx.fill();
  };

  const maxWidth = W - inset * 2 - 0.1 * px;
  const first = FOUNDER.name ?? FOUNDER.title;
  const second = FOUNDER.name ? FOUNDER.title : FOUNDER.company;
  // The block (name, rule, title) centred in the field's height.
  const gapAbove = 0.062 * px;
  const gapBelow = 0.07 * px;
  const block = LETTERING.name * px + gapAbove + gapBelow + LETTERING.title * px;
  const top = (H - block) / 2;
  const nameBase = top + LETTERING.name * px;
  letter(first.toUpperCase(), nameBase, LETTERING.name, 0.085, 650, maxWidth);
  rule(nameBase + gapAbove, LETTERING.rule);
  letter(second.toUpperCase(), nameBase + gapAbove + gapBelow + LETTERING.title * px, LETTERING.title, 0.34, 550, maxWidth);
}

export function PortraitNameplate() {
  const { plate, wallZ, panelDepth, frameBottom } = NAMEPLATE;
  const fieldWidth = plate.width - plate.moulding * 2;
  const fieldHeight = plate.height - plate.moulding * 2;

  const plateTexture = useMemo(() => {
    if (typeof document === 'undefined') return null;
    const canvas = document.createElement('canvas');
    canvas.width = 2048;
    canvas.height = Math.round((2048 * fieldHeight) / fieldWidth);
    drawPlate(canvas, fieldHeight);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    return tex;
  }, [fieldHeight, fieldWidth]);

  // Redraw once the web font has loaded, so the lettering is in the site's serif
  // and not in the fallback the canvas had when it first drew.
  useEffect(() => {
    if (!plateTexture || typeof document === 'undefined' || !document.fonts) return;
    let live = true;
    document.fonts.ready.then(() => {
      if (!live) return;
      drawPlate(plateTexture.image as HTMLCanvasElement, fieldHeight);
      plateTexture.needsUpdate = true;
    });
    return () => {
      live = false;
    };
  }, [plateTexture, fieldHeight]);

  useEffect(() => () => plateTexture?.dispose(), [plateTexture]);

  const group = useRef<THREE.Group>(null);
  useProbeBinding(group, (m) => NAMEPLATE_GAIN[m.name] ?? 1);

  const plateY = frameBottom - plate.gap - plate.height / 2;
  const backZ = wallZ + panelDepth + 0.004;
  // The moulding in two steps: a flat outer band, and a narrower bead standing
  // proud of it round the field.
  const outerDepth = plate.depth * 0.6;
  const bead = plate.moulding * 0.42;

  return (
    <group name="portrait_nameplate" ref={group} position={[0, plateY, 0]}>
      <mesh position={[0, 0, backZ + outerDepth / 2]} name="portrait_plate">
        <boxGeometry args={[plate.width, plate.height, outerDepth]} />
        <meshStandardMaterial
          name="plate_gilt"
          color="#C7A250"
          roughness={0.34}
          metalness={1}
          defines={NAMEPLATE_DEFINES}
          onBeforeCompile={shadeTopEdge}
          customProgramCacheKey={plateTopKey}
        />
      </mesh>
      <mesh position={[0, 0, backZ + plate.depth / 2]} name="portrait_plate_bead">
        <boxGeometry args={[fieldWidth + bead * 2, fieldHeight + bead * 2, plate.depth]} />
        <meshStandardMaterial
          name="plate_gilt"
          color="#D4B160"
          roughness={0.28}
          metalness={1}
          defines={NAMEPLATE_DEFINES}
          onBeforeCompile={shadeTopEdge}
          customProgramCacheKey={plateTopKey}
        />
      </mesh>
      {plateTexture ? (
        <mesh position={[0, 0, backZ + plate.depth + 0.0015]} name="portrait_plate_field">
          <planeGeometry args={[fieldWidth, fieldHeight]} />
          <meshStandardMaterial
            name="plate_field"
            map={plateTexture}
            color="#ffffff"
            roughness={0.5}
            metalness={0}
            defines={NAMEPLATE_DEFINES}
          />
        </mesh>
      ) : null}
    </group>
  );
}
