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
// THE READABILITY PROBLEM, SOLVED RATHER THAN AVOIDED
//
// These are sanctioned layout plans: documents a buyer has to read. The camera
// dives 10m and rolls 4 degrees while FOV warps to 68, and a document skewing
// through that is unreadable. So opacity is driven by how fast the camera is
// ACTUALLY moving, measured per frame rather than inferred from scroll:
//
//   camera moving fast  -> card fades toward 0, gets out of the way
//   camera settles      -> card comes up to full and can be read
//
// That is the fade the brief asked for, and measuring real speed rather than
// scroll delta means it also behaves correctly when the rig is still catching
// up after the wheel has stopped — which, with scrub, is most of the time.
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
 * Placed on the LEFT of the forecourt — the half of frame the camera aims away
 * from (see FRAME_OFFSET in WorldCanvas) — and stepped back along the approach
 * so the camera passes them in the order the page lists them. All three sit
 * clear of the mansion shell (x -9.55..9.55, z -5.55..6.10), the fountain
 * (centre z 13.2, r 3.1) and the hedge line at x -15.9.
 */
const ANCHORS: [number, number, number][] = [
  [-12.6, 3.4, 18.0],
  [-13.4, 3.1, 9.0],
  [-12.2, 3.6, 0.5],
];

/** Below this speed the card is fully legible; above it, gone. Metres/second
 *  of camera travel, tuned to the dive: the fast leg runs well past 12. */
const SPEED_FADE = 4.2;

function Card({
  card,
  anchor,
}: {
  card: SpatialCard;
  anchor: [number, number, number];
}) {
  const group = useRef<THREE.Group>(null);
  const el = useRef<HTMLDivElement>(null);

  const prev = useRef(new THREE.Vector3());
  const seeded = useRef(false);
  const shown = useRef(0);

  useFrame(({ camera }, delta) => {
    if (!seeded.current) {
      prev.current.copy(camera.position);
      seeded.current = true;
      return;
    }

    // Real camera speed, not scroll delta. With a scrub the camera keeps
    // travelling after the wheel stops, and a scroll-derived value would bring
    // the card up while the frame was still moving under it.
    const speed = camera.position.distanceTo(prev.current) / Math.max(delta, 1e-4);
    prev.current.copy(camera.position);

    // Also fade by how far off-axis the card is. At the bottom of the dive the
    // anchors are behind the camera, and a CSS3D node facing away still costs
    // layout and can catch a pointer.
    const toCard = group.current
      ? group.current.getWorldPosition(TMP).sub(camera.position).normalize()
      : null;
    const facing = toCard ? toCard.dot(camera.getWorldDirection(TMP2)) : 1;

    const wanted =
      facing < 0.15 ? 0 : Math.max(0, 1 - speed / SPEED_FADE);

    // Asymmetric damping: fade OUT quickly so the card is gone before it
    // becomes an unreadable smear, fade IN slowly so it arrives as the shot
    // settles rather than popping.
    const k = wanted < shown.current ? 0.22 : 0.055;
    shown.current += (wanted - shown.current) * k;

    if (el.current) {
      el.current.style.opacity = shown.current.toFixed(3);
      // Stop an invisible card swallowing clicks over the canvas.
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
