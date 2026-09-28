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
//   the plate   polished brass, engraved, beneath the frame and above the
//               landing, where the camera's climb up the court arrives
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
 * Reflection gains against the hall's own probe (hallProbe.ts). The 6 / 9 / 7
 * these materials carried were never applied — three r173 swaps a material's
 * own envMapIntensity for scene.environmentIntensity when it has no envMap of
 * its own — and against a probe of the room itself, 1 is the honest value.
 */
const NAMEPLATE_GAIN: Record<string, number> = { plate: 1.1 };

/** The probe's defines, and the depth write the hall's lens reads: without it
 *  the lens took the nameplate for background and softened it under a sharp
 *  portrait. */
const NAMEPLATE_DEFINES = { ...PROBE_DEFINES, ESTATE_FOCUS: '' };

export const FOUNDER = {
  /** The founder's name as it should be engraved, or null until supplied.
   *  Given by the client on 2026-09-18. */
  name: 'K. Bhaskara Rao' as string | null,
  title: 'Managing Director',
  company: 'Quality Homes Reality',
};

/**
 * Where the plate sits, from the imperial hall (imperial_hall_v7.py): the frame
 * spans x -1.51..1.51, y 5.00..9.07, its back on the wall face at z -7.70, on a
 * walnut panel whose face stands 3 cm proud of it; the landing is at y 4.20.
 * The plate hangs between the two, a quarter larger with the portrait.
 */
export const NAMEPLATE = {
  wallZ: -7.7,
  panelDepth: 0.03,
  frameBottom: 5.0,
  plate: { width: 1.95, height: 0.42, depth: 0.018, gap: 0.09 },
} as const;

function serifFamily(): string {
  if (typeof window === 'undefined') return 'Georgia, serif';
  const v = getComputedStyle(document.documentElement).getPropertyValue('--font-serif').trim();
  return v ? `${v}, Georgia, serif` : 'Georgia, serif';
}

/** Engraved brass, drawn once to a canvas. */
function drawPlate(canvas: HTMLCanvasElement) {
  const W = canvas.width;
  const H = canvas.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#b8913f');
  g.addColorStop(0.45, '#e9cc82');
  g.addColorStop(0.55, '#dcbb6c');
  g.addColorStop(1, '#a8802f');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  // Brushed grain.
  for (let i = 0; i < 900; i += 1) {
    const y = Math.random() * H;
    ctx.strokeStyle = `rgba(${Math.random() < 0.5 ? '255,245,210' : '90,64,20'},${0.04 + Math.random() * 0.05})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(Math.random() * W * 0.3, y);
    ctx.lineTo(W * (0.7 + Math.random() * 0.3), y + (Math.random() - 0.5) * 2);
    ctx.stroke();
  }
  // A double engraved border.
  const rule = (inset: number, width: number) => {
    ctx.strokeStyle = 'rgba(58,40,14,0.85)';
    ctx.lineWidth = width;
    ctx.strokeRect(inset, inset, W - inset * 2, H - inset * 2);
    ctx.strokeStyle = 'rgba(255,240,200,0.55)';
    ctx.lineWidth = 1;
    ctx.strokeRect(inset + width, inset + width, W - (inset + width) * 2, H - (inset + width) * 2);
  };
  rule(10, 3);
  rule(22, 1.5);

  const family = serifFamily();
  const engrave = (text: string, y: number, size: number, spacing: number, weight = 600) => {
    ctx.font = `${weight} ${size}px ${family}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const spaced = text.split('').join(String.fromCharCode(8202).repeat(spacing));
    ctx.fillStyle = 'rgba(255,238,196,0.7)';
    ctx.fillText(spaced, W / 2, y + 2);
    ctx.fillStyle = '#3b2a10';
    ctx.fillText(spaced, W / 2, y);
  };
  if (FOUNDER.name) {
    engrave(FOUNDER.name.toUpperCase(), H * 0.4, 84, 2);
    engrave(`${FOUNDER.title}  ·  ${FOUNDER.company}`.toUpperCase(), H * 0.74, 34, 3, 500);
  } else {
    engrave(FOUNDER.title.toUpperCase(), H * 0.42, 74, 3);
    engrave(FOUNDER.company.toUpperCase(), H * 0.74, 36, 4, 500);
  }
}

export function PortraitNameplate() {
  const { plate, wallZ, panelDepth, frameBottom } = NAMEPLATE;

  const plateTexture = useMemo(() => {
    if (typeof document === 'undefined') return null;
    const canvas = document.createElement('canvas');
    canvas.width = 1536;
    canvas.height = Math.round((1536 * plate.height) / plate.width);
    drawPlate(canvas);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    return tex;
  }, [plate.height, plate.width]);

  // Redraw once the web font has loaded, so the engraving is in the site's serif
  // and not in the fallback the canvas had when it first drew.
  useEffect(() => {
    if (!plateTexture || typeof document === 'undefined' || !document.fonts) return;
    let live = true;
    document.fonts.ready.then(() => {
      if (!live) return;
      drawPlate(plateTexture.image as HTMLCanvasElement);
      plateTexture.needsUpdate = true;
    });
    return () => {
      live = false;
    };
  }, [plateTexture]);

  useEffect(() => () => plateTexture?.dispose(), [plateTexture]);

  const group = useRef<THREE.Group>(null);
  useProbeBinding(group, (m) => NAMEPLATE_GAIN[m.name] ?? 1);

  const plateY = frameBottom - plate.gap - plate.height / 2;
  const plateZ = wallZ + panelDepth + plate.depth / 2 + 0.004;

  return (
    <group name="portrait_nameplate" ref={group}>
      {plateTexture ? (
        <mesh position={[0, plateY, plateZ]} name="portrait_plate">
          <boxGeometry args={[plate.width, plate.height, plate.depth]} />
          <meshStandardMaterial
            name="plate"
            map={plateTexture}
            color="#ffffff"
            roughness={0.32}
            metalness={0.55}
            defines={NAMEPLATE_DEFINES}
          />
        </mesh>
      ) : null}
    </group>
  );
}
