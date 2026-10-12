// apps/public/src/components/experience/hallBytes.ts
//
// THE HALL'S BYTES: ASKED FOR ONCE, AND BEFORE ANYBODY IS WAITING FOR THEM.
//
// The hall is 26 MB, and the film asked for it when the page had been scrolled
// a third of the way down (journey.ts, PRELOAD_LEAD): on this machine that is
// a second's work and nobody had ever seen what it is on a connection.
//
// MEASURED through a public address (2026-10-09, a Cloudflare tunnel off this
// machine's own line, 13-28 Mbit/s; c12/audit_p1.mjs, `press:station-2`): a
// visitor who pressed a table's dot on the rail as the curtain lifted was
// shown that table's name on an empty dark frame for twelve seconds, and then
// on an empty NAVY one — the cut's dark gave up (doorway.ts, MAX_HOLD_MS) and
// lifted on the scene's bare clear colour, the hall still on its way. An
// audit of the film made by a script, which goes to each chapter by its
// anchor, called it "black voids and a lone progress rail" and "a cold navy",
// and for anybody who gets ahead of the download that is what it was.
//
// So:
//
//   ONE FETCH. Whoever wants the hall first asks here, and everybody after is
//   handed the same bytes: the film as soon as its first picture is up and
//   the line is free (WorldCanvas), and the model's own loader when the hall
//   is mounted (HallModel, which parses these bytes rather than fetching its
//   own). Not the browser's cache doing the sharing: a second request for a
//   file still arriving is made to wait on the first by one browser and sent
//   out beside it by another.
//
//   COUNTED. The bytes in hand are published, so the wait for the hall, where
//   there is one, is a hairline that fills (WorldCanvas, the veil) and not a
//   dark frame that might be broken.
//
// The hall's own readiness — parsed, uploaded, its programs built — is not
// this module's: sceneWarm.ts and the door (doorway.ts, hallReady) have it.

/** Where the hall's bytes are. */
export interface HallLoad {
  state: 'idle' | 'loading' | 'done' | 'failed';
  /** Bytes in hand. */
  received: number;
  /** Bytes in all: what the caller said, until the server or the last byte
   *  says otherwise. */
  total: number;
  /** When the last byte came, on the page's clock (ms); 0 until it has. */
  doneAt?: number;
}

export const hallLoad: HallLoad = { state: 'idle', received: 0, total: 0, doneAt: 0 };

let pending: Promise<ArrayBuffer> | null = null;

interface ConnectionHint {
  connection?: { saveData?: boolean; effectiveType?: string };
}

/**
 * Is this a line to fetch 26 MB down before anybody has asked for the hall?
 * Not for a visitor who has asked their browser to save data, and not on a
 * line the browser itself calls 2G: there the hall is fetched when the film
 * gets to it, as it always was. A browser that says nothing is taken at its
 * word.
 */
export function mayFetchAhead(
  nav: ConnectionHint | undefined = typeof navigator !== 'undefined' ? (navigator as ConnectionHint) : undefined,
): boolean {
  const c = nav?.connection;
  if (!c) return true;
  if (c.saveData) return false;
  return !/(^|-)2g$/.test(c.effectiveType ?? '');
}

/**
 * The hall's bytes. The first call fetches; every call while that is running,
 * and after it, is given the same answer. A fetch that fails is forgotten, so
 * the next caller tries again.
 *
 * `total` is the file's size as the build knows it (HallModel,
 * HALL_MODEL_BYTES): the server sends the file compressed and in chunks, with
 * no length, and the count needs something to be a share of.
 */
export function hallBytes(url: string, total: number, fetchImpl: typeof fetch = fetch): Promise<ArrayBuffer> {
  if (pending) return pending;
  hallLoad.state = 'loading';
  hallLoad.received = 0;
  hallLoad.total = total > 0 ? total : 0;
  hallLoad.doneAt = 0;

  const run = async (): Promise<ArrayBuffer> => {
    const res = await fetchImpl(url, { credentials: 'same-origin' });
    if (!res.ok) throw new Error(`the hall did not arrive: HTTP ${res.status}`);
    // A length the server gives is the file's only if nothing was done to the
    // body on the way: compressed, it is the length of something else.
    const length = Number(res.headers.get('content-length'));
    if (length > 0 && !res.headers.get('content-encoding')) hallLoad.total = length;
    if (!res.body) {
      const whole = await res.arrayBuffer();
      hallLoad.received = whole.byteLength;
      return whole;
    }
    const reader = res.body.getReader();
    const parts: Uint8Array[] = [];
    let n = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      parts.push(value);
      n += value.byteLength;
      hallLoad.received = n;
    }
    const out = new Uint8Array(n);
    let at = 0;
    for (const p of parts) {
      out.set(p, at);
      at += p.byteLength;
    }
    return out.buffer;
  };

  pending = run().then(
    (buf) => {
      hallLoad.state = 'done';
      hallLoad.received = buf.byteLength;
      hallLoad.total = buf.byteLength;
      hallLoad.doneAt = typeof performance !== 'undefined' ? performance.now() : 0;
      return buf;
    },
    (err) => {
      hallLoad.state = 'failed';
      pending = null;
      throw err;
    },
  );
  return pending;
}

/**
 * Let the bytes go: the model has been made from them and the parser keeps
 * what it needs. (What was learned stays: `hallLoad` still says done.)
 */
export function releaseHallBytes(): void {
  pending = null;
}

/** How much of the hall is in hand, 0..1; nothing before anybody has asked. */
export function hallBytesShare(load: HallLoad = hallLoad): number {
  if (load.state === 'done') return 1;
  if (load.state === 'idle' || !(load.total > 0)) return 0;
  return Math.min(1, Math.max(0, load.received / load.total));
}

/**
 * THE HAIRLINE'S LENGTH, 0..1, for a wait on the hall that has lasted
 * `waitedMs`.
 *
 * Nine-tenths of it is the bytes. The last tenth is the making of the room
 * from them (the parse, the textures, the programs, the tables' own models),
 * which has no count and on an integrated card takes some seconds: the line
 * creeps through most of that tenth on the clock, from the moment the last
 * byte came, and is closed by `ready`. Where there is no count of bytes
 * either — the fetch was never this module's, or its size is not known — the
 * line moves on the clock alone and never to its end: it reaches a half in
 * four seconds and goes on toward eight-tenths. A wait is never a line
 * standing still.
 */
export function hallWaitShare(
  waitedMs: number,
  ready: boolean,
  load: HallLoad = hallLoad,
  now: number = typeof performance !== 'undefined' ? performance.now() : 0,
): number {
  if (ready) return 1;
  const counted = load.state !== 'idle' && load.total > 0;
  if (counted) {
    if (load.state !== 'done') return 0.9 * hallBytesShare(load);
    const since = load.doneAt ? Math.max(0, now - load.doneAt) / 1000 : 0;
    return 0.9 + 0.08 * (1 - Math.exp(-since / 2.5));
  }
  const t = Math.max(0, waitedMs) / 1000;
  return 0.8 * (1 - Math.exp(-t / 4.1));
}

/** For a test, and for a document that is starting again. */
export function resetHallBytes(): void {
  pending = null;
  hallLoad.state = 'idle';
  hallLoad.received = 0;
  hallLoad.total = 0;
  hallLoad.doneAt = 0;
}
