// apps/public/src/components/experience/ExperienceCanvasHost.tsx
//
// The client boundary that lets a SERVER layout own the canvas.
//
// Why this file exists: `dynamic(..., { ssr: false })` is illegal inside a
// Server Component in the App Router. The (experience) layout must stay a
// Server Component (so its children can server-render for SEO), so the
// ssr:false import is quarantined here, in the smallest possible client leaf.
//
// WHAT A VISITOR SEES WHILE THE SCENE IS ON ITS WAY is this file's too:
//
//   the still   the view's own first frame, in the server's markup and so in
//               the first paint (SceneStill, stills.ts);
//   the curtain the house's name on its dark, for the second it takes that
//               still and the type to arrive — and never for the scene;
//   the mark    whether the scene is live, said on the document for anything
//               that has to wait for the real picture.
'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { SmoothScroll } from './SmoothScroll';
import { SceneStill } from './SceneStill';
import { coverGround, coverState } from './coverState';
import { modelForRoute } from './sceneModels';
import { sceneWarm } from './sceneWarm';

const ExperienceCanvas = dynamic(
  () => import('./WorldCanvas').then((m) => m.WorldCanvas),
  {
    ssr: false,
    loading: () => <div aria-hidden="true" className="fixed inset-0 z-0 bg-[#15110C]" />,
  },
);

/**
 * THE CURTAIN: the house's name over a hairline, on the page's own dark.
 *
 * IT WAITS FOR THE STILL, NOT FOR THE SCENE. It used to hold the page until
 * the model was in and built — twelve to seventeen seconds of this through a
 * public address, on every page (the forensic audit, #1), with a ceiling at
 * twelve that lifted on words over an empty frame when the line was slower
 * than that (#2). The first frame is a still now, in the markup beside this,
 * and the curtain lifts when it has arrived: `data-still` on the document,
 * written by a script in the markup (SceneStill, ANNOUNCE) — so it does not
 * wait for this bundle either. Its rules are in globals.css (THE CURTAIN):
 * the lift, and the two and a half seconds after which it lifts whatever has
 * or has not arrived, with no script at all.
 *
 * It no longer holds the page's scroll: what is under it is a page.
 *
 * Server-rendered, so it is on screen before any script runs; taken out of
 * the tree once it has gone. On a return within the document the scene is in
 * memory and it is not drawn.
 */
function Curtain() {
  const ground = coverGround(usePathname());
  return (
    <div
      aria-hidden
      data-scene-curtain=""
      className="scene-curtain fixed inset-0 z-[59] flex flex-col items-center justify-center"
      style={{ background: ground }}
    >
      <span className="t-micro text-[#F2EDE4]/[0.62]">Quality Homes Reality</span>
      <span className="relative mt-6 block h-px w-28 overflow-hidden bg-[#F2EDE4]/[0.12]">
        <span className="scene-curtain-line absolute inset-y-0 left-0 block w-full origin-left bg-[#E8B98A]/70" />
      </span>
    </div>
  );
}

/** As long as the curtain can stand (its stylesheet's ceiling and its fade),
 *  and a little: after this it is out of the tree. */
const CURTAIN_GONE_MS = 4200;

/**
 * WHETHER THE SCENE IS LIVE, said where a script outside the page can read it:
 * `data-scene` on the document is `wait` until what this page is a picture of
 * has been built and drawn (sceneWarm.ready), `live` from then, and `none`
 * where there will be no scene (no WebGL, or a scene that failed).
 *
 * And an element that stands for the wait. Every capture tool this project
 * has, and its end-to-end suite, waits for "no full-frame layer at z-59 or
 * z-60 that is not at opacity 0" before it looks at a page — which used to
 * mean the curtain had lifted on the built scene. The curtain lifts on a
 * still now, seconds before that, and a tool that shot then would be
 * measuring the still. So the wait keeps a layer of its own: nothing to see
 * and nothing to touch, there until the scene is live. It is in the server's
 * markup, so it cannot be missed by a check that runs before the script.
 */
function SceneMark() {
  const [state, setState] = useState<'wait' | 'live' | 'none'>('wait');
  useEffect(() => {
    let raf = 0;
    let last = '';
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const next = sceneWarm.absent ? 'none' : sceneWarm.ready ? 'live' : 'wait';
      if (next === last) return;
      last = next;
      document.documentElement.dataset.scene = next;
      setState(next);
    };
    tick();
    return () => {
      cancelAnimationFrame(raf);
      delete document.documentElement.dataset.scene;
    };
  }, []);
  if (state !== 'wait') return null;
  return <div aria-hidden data-scene-pending="" className="pointer-events-none fixed inset-0 z-[60]" />;
}

/**
 * THE MODEL, ASKED FOR WITH THE PAGE. The scene's script is what fetches the
 * model, and it is itself fetched after the page's — so on a connection the
 * 15 MB (or 26) began three to six seconds late (sceneModels.ts). Named here,
 * in the server's markup, it begins with the document: the same request the
 * loader will make (a fetch, same origin, no credentials beyond the origin's
 * own), so the loader takes it over and nothing is fetched twice. At the
 * lowest priority: the still, the type and the scripts are wanted first.
 *
 * Only for the document's first page. A page reached by a link is rendered
 * with the scene already running, and it asks for what it needs.
 */
function ModelAhead() {
  const [href] = useState(modelForRoute(usePathname() || '/'));
  return <link rel="preload" as="fetch" href={href} crossOrigin="anonymous" {...{ fetchpriority: 'low' }} />;
}

export function ExperienceCanvasHost() {
  const [curtain, setCurtain] = useState(() => !coverState.sceneInMemory);
  useEffect(() => {
    coverState.sceneInMemory = true;
    if (!curtain) return;
    const t = window.setTimeout(() => setCurtain(false), CURTAIN_GONE_MS);
    return () => window.clearTimeout(t);
    // Once, for the document: a curtain is not drawn twice.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <>
      <SmoothScroll />
      {curtain ? <ModelAhead /> : null}
      <ExperienceCanvas />
      <SceneStill />
      {curtain ? <Curtain /> : null}
      <SceneMark />
    </>
  );
}
