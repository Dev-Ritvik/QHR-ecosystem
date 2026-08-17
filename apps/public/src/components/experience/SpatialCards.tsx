'use client';

// apps/public/src/components/experience/SpatialCards.tsx
//
// The layout plans, anchored in the 3D scene instead of pasted over it.
//
// drei's <Html transform> renders a real DOM node into a CSS3D layer whose
// matrix is driven by the object's world transform, so the card genuinely
// scales, skews and banks with the camera. It is still selectable, still
// readable by a screen reader, and still a real <img> — which a texture on a
// quad would not be.
//
// THE READABILITY PROBLEM
//
// These are sanctioned layout plans: documents a buyer has to read, while the
// camera dives 10m and rolls 4 degrees with FOV warping to 68.
//
// Opacity is driven by DISTANCE from the camera, not by camera speed. Speed was
// the obvious signal and the wrong one: a visitor who stops to read brings the
// camera to rest, so the value that decided legibility went to zero at exactly
// the moment legibility mattered. Distance depends only on where the camera is,
// so it is stable whether or not anything is moving — a card is legible when
// the camera is near it, and gone when it is not.
//
// The DOM copies in the page remain, visually hidden. They are what a crawler
// and a no-JS reader get: <Html> content is client-only and would otherwise
// take the three published projects out of the served markup entirely.

import { useMemo, useRef } from 'react';
import { Html } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export interface SpatialCard {
  slug: string;
  name: string;
  locality: string;
  city: string;
  available: number | null;
  soldOut: boolean;
}

/**
 * Where each plan hangs, in world metres.
 *
 * DISTRIBUTED ALONG THE TRACK, not clustered. The first version put all three
 * within 18m of each other on the LEFT of the forecourt (x -12 to -13), which
 * is the side the hero column occupies and the side the camera aims away from —
 * so they piled up behind the typography and read as broken.
 *
 * These are spread across 34 metres of z (24 -> -10) on the +x side, which is
 * where the camera actually travels (beats run x 2.5 -> 12 -> 17 -> 7 -> 15.5)
 * and the half of frame the building occupies. The camera now passes them one
 * at a time, in the order the page lists them, and none of them shares screen
 * space with the left 40vw the copy holds.
 *
 * Outside the hedge line at x 15.9 on purpose: these are floating UI, not
 * geometry, and standing them beyond the planting keeps them clear of the
 * cypresses rather than intersecting them.
 */
const ANCHORS: [number, number, number][] = [
  [24.0, 8.5, 24.0],
  [27.0, 5.5, 8.0],
  [21.0, 3.0, -10.0],
];

/**
 * The legibility band, in metres from the camera.
 *
 * Fully opaque between NEAR_FULL and FAR_FULL, fading out on both sides: too
 * close and the card fills the frame and hides the building it annotates, too
 * far and it is unreadable anyway and only adds clutter.
 */
const NEAR_FADE = 4.5;
const NEAR_FULL = 9.0;
const FAR_FULL = 26.0;
const FAR_FADE = 44.0;

/** GLSL smoothstep, since this is the same ease used in the shaders. */
function smoothstep(e0: number, e1: number, x: number) {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}

function Card({
  card,
  anchor,
}: {
  card: SpatialCard;
  anchor: [number, number, number];
}) {
  const group = useRef<THREE.Group>(null);
  const el = useRef<HTMLDivElement>(null);

  const shown = useRef(0);

  useFrame(({ camera }) => {
    if (!group.current) return;

    // DISTANCE, not speed.
    //
    // Speed was the wrong signal and the criticism is right about why: when a
    // visitor stops to READ, the camera settles and speed goes to zero — so the
    // card's opacity was determined by the thing that stops happening exactly
    // when it matters most. Worse, with a scrub the camera keeps drifting after
    // the wheel stops, so the value was still moving while the page was still.
    //
    // Distance is stable: it depends only on where the camera IS, so a card is
    // legible whenever the camera is near it and gone when it is not,
    // regardless of whether anything is moving.
    const d = group.current.getWorldPosition(TMP).distanceTo(camera.position);

    // Full through the near band, falling off beyond it. Also fades when very
    // close, because a card the camera is about to pass through fills the frame
    // and blocks the architecture it is meant to annotate.
    const near = 1 - smoothstep(NEAR_FADE, NEAR_FULL, d);
    const far = 1 - smoothstep(FAR_FULL, FAR_FADE, d);
    let wanted = Math.min(near, far);

    // Behind the camera: a CSS3D node facing away still costs layout and can
    // catch a pointer, and no distance band alone excludes it.
    const toCard = group.current.getWorldPosition(TMP).sub(camera.position).normalize();
    if (toCard.dot(camera.getWorldDirection(TMP2)) < 0.15) wanted = 0;

    // Symmetric damping now. The asymmetry existed to hide speed-driven
    // flicker; with a stable signal it is just lag.
    shown.current += (wanted - shown.current) * 0.10;

    if (el.current) {
      el.current.style.opacity = shown.current.toFixed(3);
      el.current.style.pointerEvents = shown.current > 0.5 ? 'auto' : 'none';
    }
  });

  return (
    <group ref={group} position={anchor}>
      <Html
        transform
        // Metres per CSS pixel. The card is authored at 420px wide and should
        // occupy ~5m of world, so the whole thing is scaled rather than every
        // dimension being guessed in world units.
        distanceFactor={9}
        // Occluded by the building: walking behind the mansion should hide it,
        // which is the entire point of anchoring it in space.
        occlude="blending"
        style={{ transition: 'none' }}
      >
        <div
          ref={el}
          style={{
            width: 420,
            opacity: 0,
            // GLASS. backdrop-filter over a CSS3D layer composites against what
            // is painted behind it, so the karst and the facade genuinely show
            // through rather than being faked with a flat tint.
            backdropFilter: 'blur(20px) brightness(0.72)',
            WebkitBackdropFilter: 'blur(20px) brightness(0.72)',
            background: 'rgba(10, 17, 32, 0.42)',
            border: '1px solid rgba(242, 237, 228, 0.16)',
            padding: '22px 24px 24px',
            color: '#F2EDE4',
            fontFamily: 'Georgia, "Times New Roman", serif',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
              justifyContent: 'space-between',
              gap: 16,
            }}
          >
            <span
              style={{
                fontSize: 11,
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                color: 'rgba(242,237,228,0.45)',
              }}
            >
              Plotted development
            </span>
            {card.available !== null && !card.soldOut ? (
              <span
                style={{
                  fontSize: 11,
                  letterSpacing: '0.16em',
                  textTransform: 'uppercase',
                  color: '#E8B98A',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {card.available} available
              </span>
            ) : null}
          </div>

          <h3 style={{ margin: '14px 0 0', fontSize: 30, fontWeight: 400, lineHeight: 1.06 }}>
            {card.name}
          </h3>
          <p style={{ margin: '8px 0 0', fontSize: 14, color: 'rgba(242,237,228,0.6)' }}>
            {card.locality} &middot; {card.city}
          </p>

          <a
            href={`/projects/${card.slug}`}
            style={{
              display: 'inline-block',
              marginTop: 22,
              fontSize: 11,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              color: '#E8B98A',
              textDecoration: 'none',
              borderBottom: '1px solid rgba(232,185,138,0.4)',
              paddingBottom: 3,
            }}
          >
            See the plan
          </a>
        </div>
      </Html>
    </group>
  );
}

const TMP = new THREE.Vector3();
const TMP2 = new THREE.Vector3();

export function SpatialCards({ cards }: { cards: SpatialCard[] }) {
  const shown = useMemo(() => cards.slice(0, ANCHORS.length), [cards]);
  return (
    <>
      {shown.map((c, i) => (
        <Card key={c.slug} card={c} anchor={ANCHORS[i]} />
      ))}
    </>
  );
}
