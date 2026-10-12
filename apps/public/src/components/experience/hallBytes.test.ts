import { afterEach, describe, expect, it } from 'vitest';
import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import {
  hallBytes,
  hallBytesShare,
  hallLoad,
  hallWaitShare,
  mayFetchAhead,
  releaseHallBytes,
  resetHallBytes,
  type HallLoad,
} from './hallBytes';

// The hall's bytes are asked for once and early, and the wait for the hall is
// said (hallBytes.ts has the account: a press on the rail as the curtain
// lifted was twelve seconds of dark and then a navy void, through a public
// address).

const src = (rel: string) => readFileSync(join(__dirname, rel), 'utf8').replace(/\r\n/g, '\n');

/** A response that arrives in pieces, as the hall does. */
function inPieces(sizes: number[], init: ResponseInit = {}): Response {
  let i = 0;
  const body = new ReadableStream<Uint8Array>({
    pull(c) {
      if (i < sizes.length) c.enqueue(new Uint8Array(sizes[i++]).fill(7));
      else c.close();
    },
  });
  return new Response(body, init);
}

afterEach(() => resetHallBytes());

describe('the hall is fetched once, by whoever asks first', () => {
  it('gives every caller the same bytes from one request', async () => {
    let asked = 0;
    const fetcher = (async () => {
      asked += 1;
      return inPieces([4, 6, 2]);
    }) as unknown as typeof fetch;
    const film = hallBytes('/models/hall.glb', 12, fetcher);
    const loader = hallBytes('/models/hall.glb', 12, fetcher);
    expect(loader).toBe(film);
    const [a, b] = await Promise.all([film, loader]);
    expect(asked).toBe(1);
    expect(a).toBe(b);
    expect(a.byteLength).toBe(12);
    expect(new Uint8Array(a).every((v) => v === 7)).toBe(true);
    // ...and a caller who comes after it has arrived
    expect(await hallBytes('/models/hall.glb', 12, fetcher)).toBe(a);
    expect(asked).toBe(1);
  });

  it('counts the bytes as they arrive, against the size it was told', async () => {
    const seen: number[] = [];
    let step: (() => void) | null = null;
    const fetcher = (async () => {
      let i = 0;
      const sizes = [25, 25, 50];
      const body = new ReadableStream<Uint8Array>({
        async pull(c) {
          seen.push(hallBytesShare());
          if (i < sizes.length) {
            await new Promise<void>((r) => {
              step = r;
              queueMicrotask(r);
            });
            c.enqueue(new Uint8Array(sizes[i++]));
          } else c.close();
        },
      });
      return new Response(body, { headers: { 'content-encoding': 'gzip', 'content-length': '31' } });
    }) as unknown as typeof fetch;
    expect(hallLoad.state).toBe('idle');
    const p = hallBytes('/models/hall.glb', 100, fetcher);
    expect(hallLoad.state).toBe('loading');
    await p;
    void step;
    // nothing, a quarter, a half, all of it
    expect(seen[0]).toBe(0);
    expect(seen).toContain(0.25);
    expect(seen).toContain(0.5);
    expect(hallLoad.state).toBe('done');
    expect(hallBytesShare()).toBe(1);
    // a compressed body's length is not the file's: the size it was told stood
    expect(Math.max(...seen)).toBeLessThanOrEqual(1);
  });

  it('takes the length the server gives when nothing was done to the body', async () => {
    const fetcher = (async () => inPieces([10, 10], { headers: { 'content-length': '20' } })) as unknown as typeof fetch;
    const p = hallBytes('/models/hall.glb', 999, fetcher);
    await p;
    expect(hallLoad.total).toBe(20);
  });

  it('forgets a fetch that failed, so the next caller tries again', async () => {
    let asked = 0;
    const fetcher = (async () => {
      asked += 1;
      if (asked === 1) return new Response('no', { status: 503 });
      return inPieces([8]);
    }) as unknown as typeof fetch;
    await expect(hallBytes('/models/hall.glb', 8, fetcher)).rejects.toThrow(/503/);
    expect(hallLoad.state).toBe('failed');
    const again = await hallBytes('/models/hall.glb', 8, fetcher);
    expect(again.byteLength).toBe(8);
    expect(asked).toBe(2);
  });

  it('lets the bytes go once the model is made, and still says they came', async () => {
    let asked = 0;
    const fetcher = (async () => {
      asked += 1;
      return inPieces([5]);
    }) as unknown as typeof fetch;
    await hallBytes('/models/hall.glb', 5, fetcher);
    releaseHallBytes();
    expect(hallLoad.state).toBe('done');
    expect(hallBytesShare()).toBe(1);
    // a loader whose cache was emptied asks again, and is answered
    await hallBytes('/models/hall.glb', 5, fetcher);
    expect(asked).toBe(2);
  });

  it('is not fetched ahead for a visitor saving data, or on a line the browser calls 2G', () => {
    expect(mayFetchAhead(undefined)).toBe(true);
    expect(mayFetchAhead({})).toBe(true);
    expect(mayFetchAhead({ connection: { effectiveType: '4g' } })).toBe(true);
    expect(mayFetchAhead({ connection: { effectiveType: '3g' } })).toBe(true);
    expect(mayFetchAhead({ connection: { saveData: true, effectiveType: '4g' } })).toBe(false);
    expect(mayFetchAhead({ connection: { effectiveType: '2g' } })).toBe(false);
    expect(mayFetchAhead({ connection: { effectiveType: 'slow-2g' } })).toBe(false);
  });
});

describe('the wait for the hall is a hairline that fills', () => {
  const at = (received: number, total = 100, state: HallLoad['state'] = 'loading'): HallLoad => ({ state, received, total });

  it('is nine-tenths bytes, and closed only by the room being ready', () => {
    expect(hallWaitShare(5000, false, at(0))).toBe(0);
    expect(hallWaitShare(5000, false, at(50))).toBeCloseTo(0.45, 6);
    expect(hallWaitShare(5000, false, at(100))).toBeCloseTo(0.9, 6);
    // all of it in hand is not the room made: the last tenth creeps on the
    // clock from the last byte, and only `ready` closes it
    const done: HallLoad = { state: 'done', received: 100, total: 100, doneAt: 1000 };
    expect(hallWaitShare(5000, false, done, 1000)).toBeCloseTo(0.9, 6);
    let last = 0.9;
    for (const now of [1500, 2500, 5000, 12000, 60000]) {
      const v = hallWaitShare(5000, false, done, now);
      expect(v).toBeGreaterThan(last);
      expect(v).toBeLessThan(0.98);
      last = v;
    }
    expect(hallWaitShare(0, true, at(3))).toBe(1);
  });

  it('never runs backwards as the bytes come', () => {
    let last = -1;
    for (let r = 0; r <= 100; r += 5) {
      const v = hallWaitShare(1000, false, at(r));
      expect(v).toBeGreaterThanOrEqual(last);
      last = v;
    }
  });

  it('moves on the clock where nothing is counted, and never to its end', () => {
    const idle: HallLoad = { state: 'idle', received: 0, total: 0 };
    expect(hallWaitShare(0, false, idle)).toBe(0);
    let last = 0;
    for (const ms of [500, 1000, 2000, 4000, 8000, 20000, 120000]) {
      const v = hallWaitShare(ms, false, idle);
      expect(v).toBeGreaterThan(last);
      expect(v).toBeLessThan(0.8);
      last = v;
    }
    // about a half in four seconds
    expect(hallWaitShare(4000, false, idle)).toBeGreaterThan(0.45);
    expect(hallWaitShare(4000, false, idle)).toBeLessThan(0.55);
    // a size nobody knows is not a count either
    expect(hallWaitShare(4000, false, at(10, 0))).toBeCloseTo(hallWaitShare(4000, false, idle), 9);
    expect(hallWaitShare(4000, true, idle)).toBe(1);
  });
});

describe('as it is wired', () => {
  it('knows the size of the file it counts against', () => {
    const model = src('HallModel.tsx');
    const said = Number((/export const HALL_MODEL_BYTES = ([\d_]+);/.exec(model) ?? [])[1]?.replace(/_/g, ''));
    const file = statSync(join(__dirname, '../../../public/models/interior_hall.glb')).size;
    // (Re-export the hall and this is the number to change.)
    expect(said, 'HALL_MODEL_BYTES is the size of public/models/interior_hall.glb').toBe(file);
  });

  it('is what the hall is parsed from, and only the hall', () => {
    const model = src('HallModel.tsx');
    // one loader serves every model on the site: by address, or the estate
    // is handed the hall
    expect(model).toContain('if (url !== HALL_MODEL_URL) {');
    expect(model).toContain('own(url, onLoad as never, onProgress, onError as never);');
    expect(model).toContain('readHallFromBytes(loader as unknown as GLTFLoader);');
    // the curtain reads the loading manager: it is told what it would have been
    expect(model).toContain('manager.itemStart(url);');
    expect(model.match(/manager\.itemEnd\(url\);/g)!.length).toBeGreaterThanOrEqual(2);
    expect(model).toContain('releaseHallBytes();');
  });

  it('is asked for by the film when its first picture is built, and not by a page', () => {
    const canvas = src('WorldCanvas.tsx');
    expect(canvas).toContain('if (!onJourney || !exteriorWarm || !mayFetchAhead()) return;');
    expect(canvas).toContain('hallBytes(HALL_MODEL_URL, HALL_MODEL_BYTES).catch(() => undefined);');
  });

  it('holds the dark over a hall that is not there, on the film as on a page', () => {
    const canvas = src('WorldCanvas.tsx');
    // latched on the door's own word, kept by a passage in flight
    expect(canvas).toContain('if (idle.current >= WARM_SETTLE_FRAMES || (passage && doorwayState.hallReady)) filmHall.current = true;');
    // quiet is: in, built, and nothing still on its way (the tables' models come after the room)
    expect(canvas).toContain('const quiet = hallRoot !== null && hallWarmIdle() && !useProgress.getState().active;');
    expect(canvas).toContain('if (stillHall && !hallWarm && idle.current >= WARM_SETTLE_FRAMES) onHallWarm();');
    expect(canvas).toContain("set === 'exterior' ? exteriorWarm : stillHall ? hallWarm : filmHall.current || passage;");
    // the film's hall is no longer waved through
    expect(canvas).not.toContain('!stillHall || hallWarm');
    // and the ceiling shows it as it is, as it does a page's
    expect(canvas).toContain('else filmHall.current = true;');
  });

  it('has nothing behind the hall but the page own dark', () => {
    const canvas = src('WorldCanvas.tsx');
    expect(canvas).toContain("const HALL_GROUND = '#15110C';");
    expect(canvas).toContain("new THREE.Color(set === 'exterior' ? GRADE_BG[grade] : HALL_GROUND)");
    expect(canvas).toContain("style={{ background: set === 'exterior' ? GRADE_BG[look.grade] : HALL_GROUND }}");
    // the night's navy is the estate's dusk grade and nothing inside
    expect(canvas).not.toMatch(/: GRADE_BG\.dusk\b(?! , 34)/);
  });

  it('says a wait on the veil itself, with the curtain hairline', () => {
    const canvas = src('WorldCanvas.tsx');
    expect(canvas).toContain('data-scene-wait=""');
    expect(canvas).toContain('const show = !built && held.current > WAIT_SAID_AFTER_MS;');
    // a wait is longer than a cut
    const doorway = src('doorway.ts');
    const close = Number((/export const CUT_CLOSE_MS = (\d+);/.exec(doorway) ?? [])[1]);
    const lift = Number((/export const CUT_MS = (\d+);/.exec(doorway) ?? [])[1]);
    const said = Number((/const WAIT_SAID_AFTER_MS = (\d+);/.exec(canvas) ?? [])[1]);
    expect(said).toBeGreaterThan(close + lift);
  });

  it('lands every chapter address where the chapter speaks', () => {
    const page = src('../../app/(site)/(experience)/site-home/page.tsx');
    expect(page).toContain('...anchor(c),');
    expect(page).toContain("if (c.id === 'hero') return {};");
    expect(page).toContain('const wait = Math.max(0, c.copy.in[1] - c.from) * TRACK_VH;');
    expect(page).toContain('return { scrollMarginTop: `calc(${(-wait).toFixed(2)}vh - 2px)` };');
    // and the address read on load, where the browser's own jump was lost
    const url = src('ChapterUrl.tsx');
    expect(url).toContain('Math.round(target.copy.in[1] * maxScroll()) + 2');
  });
});
