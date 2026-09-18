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
//   the mount   a walnut panel with a gilt fillet, set on the wall behind the
//               frame, so the portrait hangs on a place of honour instead of on
//               plaster like the mouldings either side of it
//   the plate   polished brass, engraved, beneath the frame and above the
//               landing, where the camera's climb up the stair arrives
//
// THE NAME IS NOT INVENTED. The site publishes the founder's title ("Managing
// Director", on /about) and the company; it does not publish the name. The plate
// carried only those two true lines until the client gave the name on
// 2026-09-18, and the fallback is kept: set FOUNDER.name to null and the plate
// goes back to title and company rather than to a guess.

import { useEffect, useMemo } from 'react';
import * as THREE from 'three';

export const FOUNDER = {
  /** The founder's name as it should be engraved, or null until supplied.
   *  Given by the client on 2026-09-18. */
  name: 'K. Bhaskara Rao' as string | null,
  title: 'Managing Director',
  company: 'Quality Homes Reality',
};

/**
 * Where the pieces sit, from the extended hall (extend_hall_v7.py): the frame
 * spans x -1.21..1.21, y 3.95..7.21, its back on the wall face at z -7.70; the
 * landing is at y 3.45 and the cornice begins at 7.45.
 */
export const NAMEPLATE = {
  wallZ: -7.7,
  frameBottom: 3.95,
  mount: { width: 3.4, bottom: 3.47, top: 7.38, depth: 0.03 },
  plate: { width: 1.56, height: 0.34, depth: 0.018, gap: 0.08 },
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
  const { mount, plate, wallZ, frameBottom } = NAMEPLATE;

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

  const mountH = mount.top - mount.bottom;
  const plateY = frameBottom - plate.gap - plate.height / 2;
  const mountZ = wallZ + mount.depth / 2 + 0.002;
  const plateZ = wallZ + mount.depth + plate.depth / 2 + 0.004;

  return (
    <group name="portrait_nameplate">
      <mesh position={[0, mount.bottom + mountH / 2, mountZ]} name="portrait_mount">
        <boxGeometry args={[mount.width, mountH, mount.depth]} />
        <meshStandardMaterial color="#4a2d1a" roughness={0.3} metalness={0} envMapIntensity={6} />
      </mesh>
      {/* the gilt fillet round the mount */}
      {[
        [0, mount.top - 0.03, mount.width, 0.035],
        [0, mount.bottom + 0.03, mount.width, 0.035],
        [-mount.width / 2 + 0.03, mount.bottom + mountH / 2, 0.035, mountH],
        [mount.width / 2 - 0.03, mount.bottom + mountH / 2, 0.035, mountH],
      ].map(([x, y, w, h], i) => (
        <mesh key={i} position={[x, y, mountZ + mount.depth / 2 + 0.006]}>
          <boxGeometry args={[w, h, 0.012]} />
          <meshStandardMaterial color="#e2bd72" roughness={0.35} metalness={0.7} envMapIntensity={9} />
        </mesh>
      ))}
      {plateTexture ? (
        <mesh position={[0, plateY, plateZ]} name="portrait_plate">
          <boxGeometry args={[plate.width, plate.height, plate.depth]} />
          <meshStandardMaterial
            map={plateTexture}
            color="#ffffff"
            roughness={0.32}
            metalness={0.55}
            envMapIntensity={7}
          />
        </mesh>
      ) : null}
    </group>
  );
}
