import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PLACE_ROUTES, SURFACE_ROUTES, placeForRoute } from '@estate/domain/experience/places';
import { PROJECTS } from '@estate/domain/leads/branches';
import { JOURNEY_END, chapters } from './journey';
import { POSES } from './poses';
import { ESTATE_MODEL, HALL_MODEL, OUTSIDE_PLACES, modelForRoute } from './sceneModels';
import {
  CUTS,
  chapterAt,
  chapterKey,
  cutFor,
  cutsOf,
  isFilmPath,
  ownCut,
  pictureOf,
  placeKey,
  stillFor,
  stillKeyForRoute,
  type StillManifest,
} from './stills';
import manifest from './stills.manifest.json';

const src = (rel: string) => readFileSync(join(__dirname, rel), 'utf8').replace(/\r\n/g, '\n');

const M: StillManifest = {
  v: 'abc',
  keys: {
    'film-hero': CUTS.map((c) => c.id),
    'place-portrait': ['w27', 'u70', 'u59', 'u46'],
    'place-odd': ['w18', 'w13'],
  },
};

describe('which cut of a still a screen takes', () => {
  it('gives each of the screens the site is checked on its own cut', () => {
    const cut = (w: number, h: number) => ownCut(w, h).id;
    expect(cut(2560, 945)).toBe('w27');
    expect(cut(1920, 945)).toBe('w22');
    expect(cut(1536, 730)).toBe('w22');
    expect(cut(1366, 657)).toBe('w22');
    expect(cut(1280, 593)).toBe('w22');
    expect(cut(844, 390)).toBe('w22');
    expect(cut(1920, 1080)).toBe('w18');
    expect(cut(1440, 900)).toBe('w16');
    expect(cut(1024, 768)).toBe('w13');
    expect(cut(820, 1180)).toBe('u70');
    expect(cut(768, 1024)).toBe('u70');
    expect(cut(390, 664)).toBe('u59');
    expect(cut(360, 640)).toBe('u59');
    expect(cut(390, 844)).toBe('u46');
    expect(cut(412, 915)).toBe('u46');
  });

  it('never shows a screen a still narrower than itself while a wider one exists', () => {
    // a plate has one wide cut, the widest: every wide screen's
    for (const [w, h] of [[2560, 945], [1920, 945], [1920, 1080], [1440, 900], [1024, 768]]) {
      expect(cutFor('place-portrait', w, h, M)).toBe('w27');
    }
    expect(cutFor('place-portrait', 820, 1180, M)).toBe('u70');
    expect(cutFor('place-portrait', 390, 844, M)).toBe('u46');
    // the nearest wider, where a still lacks a screen's own
    expect(cutFor('place-odd', 1440, 900, M)).toBe('w18');
    expect(cutFor('place-odd', 1024, 768, M)).toBe('w13');
    // and the widest there is for a screen wider than them all
    expect(cutFor('place-odd', 2560, 945, M)).toBe('w18');
    expect(cutFor('no-such-still', 1920, 945, M)).toBeNull();
    expect(stillFor('film-hero', 1920, 945, M)).toBe('/stills/abc/film-hero.w22.webp');
  });

  it('lists a picture so the browser chooses, before any script, what the script would', () => {
    // Evaluate the <picture> as a browser does: the first source whose
    // proportion is met, else the image.
    const browser = (key: string, w: number, h: number) => {
      const pic = pictureOf(key, M)!;
      const aspect = w / h;
      for (const s of pic.sources) {
        const m = /min-aspect-ratio: (\d+)\/1000/.exec(s.media)!;
        if (aspect >= Number(m[1]) / 1000) return s.src;
      }
      return pic.src;
    };
    const screens: [number, number][] = [
      [3440, 1297], [2560, 945], [1920, 945], [1920, 1080], [1536, 730], [1440, 900], [1366, 657],
      [1280, 593], [1180, 750], [1024, 768], [900, 1000], [844, 390], [820, 1180], [768, 1024],
      [412, 915], [390, 844], [390, 664], [360, 640],
    ];
    for (const key of Object.keys(M.keys)) {
      for (const [w, h] of screens) {
        expect(browser(key, w, h), `${key} at ${w}x${h}`).toBe(stillFor(key, w, h, M));
      }
    }
    expect(pictureOf('no-such-still', M)).toBeNull();
  });
});

describe('which still a view is', () => {
  it('is the film cover on the film, and a page’s own place on a page', () => {
    expect(isFilmPath('/')).toBe(true);
    expect(isFilmPath('/site-home')).toBe(true);
    expect(isFilmPath('/start-here')).toBe(false);
    expect(stillKeyForRoute('/')).toBe('film-hero');
    expect(stillKeyForRoute('/about')).toBe('place-portrait');
    expect(stillKeyForRoute('/projects/lucky-garden')).toBe('place-window');
    // an address that is not a page stands in the hall
    expect(stillKeyForRoute('/no-such-page')).toBe(placeKey(placeForRoute('/no-such-page')));
  });

  it('follows the film by chapter, and has nothing for the dark last frame', () => {
    const list = chapters(3);
    expect(chapterAt(0, 3)).toBe('hero');
    for (const c of list) {
      expect(chapterAt((c.from + c.to) / 2, 3)).toBe(c.id);
      // where its copy is whole, it is that chapter's still
      expect(chapterAt((Math.max(0, c.copy.in[1]) + c.copy.out[0]) / 2, 3)).toBe(c.id);
    }
    expect(chapterAt(JOURNEY_END, 3)).toBe('city');
    expect(chapterAt(JOURNEY_END + 0.03, 3)).toBeNull();
    expect(chapterAt(Number.NaN, 3)).toBeNull();
  });
});

describe('the set of stills that is published', () => {
  const published = manifest as StillManifest;
  const routes = [
    ...Object.keys(PLACE_ROUTES),
    ...Object.keys(SURFACE_ROUTES),
    ...PROJECTS.map((p) => `/projects/${p.slug}`),
    '/no-such-page',
  ];

  it('has a still for every page of the site and every chapter of the film, on every kind of screen', () => {
    const keys = new Set<string>();
    for (const r of routes) keys.add(stillKeyForRoute(r));
    for (const c of chapters(PROJECTS.length)) keys.add(chapterKey(c.id));
    for (const key of keys) {
      const cuts = cutsOf(key, published).map((c) => c.id);
      expect(cuts.some((c) => c.startsWith('w')), `${key}: a wide still`).toBe(true);
      for (const u of ['u70', 'u59', 'u46']) expect(cuts, `${key}: ${u}`).toContain(u);
    }
    // the film's frames carry the lens's density: a cut for each band of screens
    for (const c of chapters(PROJECTS.length)) {
      expect(cutsOf(chapterKey(c.id), published).map((x) => x.id)).toEqual(CUTS.map((x) => x.id));
    }
  });

  it('is on disk, every file of it, and nothing of an older set beside it', () => {
    const dir = join(__dirname, '../../../public/stills', published.v);
    for (const [key, cuts] of Object.entries(published.keys)) {
      for (const cut of cuts) expect(existsSync(join(dir, `${key}.${cut}.webp`)), `${key}.${cut}`).toBe(true);
    }
  });

  it('is shot of the places the pages stand at (the shooter’s list is the site’s)', () => {
    const shooter = src('../../../scripts/stills/shoot.mjs');
    for (const r of routes.filter((x) => x !== '/no-such-page' && x !== '/')) {
      const place = placeForRoute(r);
      expect(shooter, `${place} is shot`).toMatch(new RegExp(`\\['${place}', '[^']+'\\]`));
    }
    // and each from a page that does stand there
    for (const m of shooter.matchAll(/\['([a-z]+)', '(\/[^']*)'\],/g)) {
      expect(placeForRoute(m[2]), m[2]).toBe(m[1]);
    }
  });
});

describe('the still and the live picture under it are one frame (the second forensic audit, #10)', () => {
  it('the camera holds its rest pose while a still or the dark is over it, and breathes in after', () => {
    const canvas = src('WorldCanvas.tsx');
    expect(canvas).toContain('sceneWarm.hold > 0 || stillShoot.current ? 0 :');
    // both kinds of life wait on it: the handheld drift and the lean to the pointer
    expect(canvas).toContain('* life;');
    expect(canvas).toMatch(/const amp = \(journeyState\.leg === 'interior' \? HANDHELD \* 0\.35 : HANDHELD\) \* life;/);
    expect(canvas).toMatch(/if \(!passage && pointer\.current\.lengthSq\(\) > 0 && life > 0\)/);
  });

  it('the stills are exposed at that rest pose', () => {
    const shooter = src('../../../scripts/stills/shoot.mjs');
    expect(shooter).toContain('window.__estateStillShoot = true;');
    expect(src('WorldCanvas.tsx')).toContain('__estateStillShoot === true');
  });
});

describe('the model a page asks for with its markup', () => {
  it('is the set its place is posed in', () => {
    for (const [place, pose] of Object.entries(POSES)) {
      expect(OUTSIDE_PLACES.includes(place as never), place).toBe(pose.set === 'exterior');
    }
    expect(modelForRoute('/')).toBe(ESTATE_MODEL);
    // the film as the server renders it (the middleware's rewrite)
    expect(modelForRoute('/site-home')).toBe(ESTATE_MODEL);
    expect(modelForRoute('/why-us')).toBe(ESTATE_MODEL);
    expect(modelForRoute('/about')).toBe(HALL_MODEL);
    expect(modelForRoute('/no-such-page')).toBe(HALL_MODEL);
  });

  it('is the address the loaders ask for', () => {
    expect(src('ExteriorModel.tsx')).toContain(`export const EXTERIOR_MODEL_URL = '${ESTATE_MODEL}';`);
    expect(src('HallModel.tsx')).toContain(`export const HALL_MODEL_URL = '${HALL_MODEL}';`);
    const host = src('ExperienceCanvasHost.tsx');
    expect(host).toContain('<link rel="preload" as="fetch" href={href} crossOrigin="anonymous"');
  });
});
