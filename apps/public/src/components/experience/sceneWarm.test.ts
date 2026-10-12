import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { HOLD_FRAMES, HOLD_LIFT_S, SKY_WAIT_MS, WARM_CEILING_MS, WARM_SETTLE_FRAMES, sceneWarm, stepHold } from './sceneWarm';

const src = (rel: string) => readFileSync(join(__dirname, rel), 'utf8').replace(/\r\n/g, '\n');

describe('nothing is drawn before its programs are built', () => {
  it('starts dark and not ready: a canvas says when it has a picture, never the other way', () => {
    expect(sceneWarm.ready).toBe(false);
    expect(sceneWarm.hold).toBe(1);
  });

  it('holds the dark whole while the set is not ready, however long that is', () => {
    let hold = 0.3;
    for (let i = 0; i < 600; i += 1) hold = stepHold(hold, false, 1 / 60);
    expect(hold).toBe(1);
    // …and it is whole again the frame a set stops being ready (a page that
    // stands in the other set), not eased back in
    expect(stepHold(0, false, 1 / 60)).toBe(1);
  });

  it('lets the dark go by degrees once the set is ready, in the time it says', () => {
    let hold = 1;
    let frames = 0;
    while (hold > 0 && frames < 1000) {
      const next = stepHold(hold, true, 1 / 60);
      expect(next).toBeLessThan(hold);
      hold = next;
      frames += 1;
    }
    expect(hold).toBe(0);
    expect(frames / 60).toBeGreaterThan(HOLD_LIFT_S - 0.05);
    expect(frames / 60).toBeLessThan(HOLD_LIFT_S + 0.05);
    // gone stays gone
    expect(stepHold(0, true, 1 / 60)).toBe(0);
  });

  it('is not moved by a frame with no time in it, or by one that took a second', () => {
    expect(stepHold(0.5, true, 0)).toBe(0.5);
    expect(stepHold(0.5, true, Number.NaN)).toBe(0.5);
    expect(stepHold(0.5, true, 1)).toBe(0);
  });

  it('gives a set that will not build twelve seconds, and then shows it as it is', () => {
    expect(WARM_CEILING_MS).toBeLessThanOrEqual(12000);
    expect(SKY_WAIT_MS).toBeLessThan(WARM_CEILING_MS);
    // the hall's own probe photographs the room over its first six frames on screen
    expect(HOLD_FRAMES).toBeGreaterThanOrEqual(6);
    expect(WARM_SETTLE_FRAMES).toBeGreaterThanOrEqual(3);
  });

  it('gates both sets in the canvas, and the curtain and the tier wait for it', () => {
    const canvas = src('WorldCanvas.tsx');
    // the estate: hidden until built, built under the scene's own lights
    expect(canvas).toContain("<group ref={exteriorGroup} visible={set === 'exterior' && exteriorWarm}>");
    expect(canvas).toContain('void warmProgramsUnder(gl, camera, group, scene).then(() => {');
    expect(canvas).toContain('if (scene.environment === null && performance.now() - t0 < SKY_WAIT_MS) {');
    // the hall on a page that shows it directly
    expect(canvas).toContain('<group visible={hallWarm}>');
    // its shadow map owes the estate a draw when it is SHOWN
    expect(canvas).toContain('estate={exteriorWarm ? exteriorRoot : null}');
    // the film's veil takes the hold; a still page's is written by the gate
    expect(canvas).toContain('shownVeil.current = Math.max(shownVeil.current, smooth01(sceneWarm.hold));');
    expect(canvas).toContain('veil.current.style.opacity = smooth01(sceneWarm.hold).toFixed(3);');
    // the hall's light leaves with the hall and takes nothing else's with it: the
    // sky's was wiped by a cleanup that ran late, and the estate was drawn unlit
    expect(canvas).toContain('if (scene.environment === mine) scene.environment = null;');
    expect(canvas).not.toMatch(/removeEventListener\('webglcontextrestored', onRestored\);\s*scene\.environment = null;/);
    // a page that stands in the hall does not fetch the estate
    expect(canvas).toContain("{onJourney || set === 'exterior' ? (");
    // THE CURTAIN WAITS FOR THE STILL, NOT FOR THE SCENE (the forensic audit,
    // #1 and #2): it is markup and a stylesheet rule, lifted by the document's
    // word that the still is in, and by the clock with no script at all
    const host = src('ExperienceCanvasHost.tsx');
    expect(host).toContain('className="scene-curtain fixed inset-0 z-[59] flex flex-col items-center justify-center"');
    expect(host).not.toContain("style.overflow = ");
    const css = src('../../app/globals.css');
    expect(css).toContain("html[data-still='in'] .scene-curtain,");
    expect(css).toMatch(/\.scene-curtain \{[^}]*animation: scene-curtain-out 900ms [^;]* 2500ms forwards;/);
    // what waits for the built scene says so on the document, and keeps a
    // layer every capture tool's wait can see
    expect(host).toContain("const next = sceneWarm.absent ? 'none' : sceneWarm.ready ? 'live' : 'wait';");
    expect(host).toContain('<div aria-hidden data-scene-pending="" className="pointer-events-none fixed inset-0 z-[60]" />');
    // and the still stands on the same hold the canvas's dark does
    const still = src('SceneStill.tsx');
    expect(still).toContain('const hold = sceneWarm.hold;');
    expect(still).toContain("const o = shown ? smooth01(hold).toFixed(3) : '0';");
    // the tier is measured on frames that draw the scene — under the still,
    // so the scene is first shown at the quality it will keep
    const tier = src('useDeviceTier.ts');
    expect(tier).toContain('if (!sceneWarm.drawing) return;');
    expect(tier).toContain('sceneWarm.tierSettled = true;');
    expect(canvas).toContain('sceneWarm.drawing = drawn.current > HOLD_FRAMES;');
    expect(canvas).toContain(
      'sceneWarm.drawing && (settledFrames.current > TIER_SETTLE_FRAMES || drawingMs.current > TIER_WAIT_MS);',
    );
    // and a canvas with no alpha: a lit window's depth is written negative,
    // and on a chain without the lens that was a hole in the picture
    expect(canvas).toContain('alpha: false,');
    expect(canvas).toContain('antialias: false,');
    // the edges are smoothed on the finished frame, by a pass that declares
    // only what it uses: the library's own declares depth, and on this chain
    // an effect that declares depth is an illegal blit on every frame (257
    // console messages in 3.5 s on the first build of it, 2026-10-10)
    const fx = src('PostFX.tsx');
    expect(fx).toContain('class EdgeSmoothingEffect extends SMAAEffect {');
    expect(fx).toContain('this.setAttributes(EffectAttribute.CONVOLUTION);');
    expect(fx).toContain('{smooth ? <EdgeSmoothing preset={SMAAPreset.HIGH} /> : <></>}');
    expect(fx).not.toMatch(/<SMAA\b/);
    // and the queue works harder while there is no picture to drop a frame from
    const queue = src('hallProbe.ts');
    expect(queue).toContain('const budget = sceneWarm.hold >= 1 ? WARM_BUDGET_HELD_MS : WARM_BUDGET_MS;');
  });
});
