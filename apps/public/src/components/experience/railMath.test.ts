// apps/public/src/components/experience/railMath.test.ts
//
// The rail's one promise is that it says where you are, and its second is that
// a press on a dot takes you there by a way the camera can follow. Both are
// arithmetic, and held here.

import { describe, expect, it } from 'vitest';
import { RAIL_END, railCurrent, railGlideSeconds, railMove, railPosition, type RailStop } from './railMath';
import { CROSSOVER, JOURNEY_END, chapters } from './journey';

const stop = (id: string, from: number, at: number): RailStop => ({ id, label: id, from, at });

describe('where the marker stands', () => {
  const stops = [stop('a', 0, 0), stop('b', 0.2, 0.25), stop('c', 0.5, 0.6), stop('d', 0.9, 1)];

  it('stands on a dot exactly where a press on that dot lands', () => {
    stops.forEach((s, i) => expect(railPosition(stops, s.at)).toBe(i));
  });

  it('travels evenly between two dots, by the places their presses land', () => {
    expect(railPosition(stops, 0.125)).toBeCloseTo(0.5, 9);
    expect(railPosition(stops, 0.425)).toBeCloseTo(1.5, 9);
    expect(railPosition(stops, 0.8)).toBeCloseTo(2.5, 9);
  });

  it('never leaves the rail: before the first dot it is on it, past the last it is on that', () => {
    expect(railPosition(stops, -5)).toBe(0);
    expect(railPosition(stops, 0)).toBe(0);
    expect(railPosition(stops, 1)).toBe(3);
    expect(railPosition(stops, 40)).toBe(3);
    expect(railPosition([], 0.4)).toBe(0);
    expect(railPosition([stop('only', 0, 0)], 0.7)).toBe(0);
  });

  it('only ever moves forward as the page does', () => {
    let last = -1;
    for (let p = -0.1; p <= 1.2; p += 0.004) {
      const at = railPosition(stops, p);
      expect(at).toBeGreaterThanOrEqual(last);
      last = at;
    }
  });

  it('does not divide by nothing where two stops land on the same place', () => {
    const twins = [stop('a', 0, 0), stop('b', 0.3, 0.3), stop('c', 0.3, 0.3), stop('d', 0.6, 0.6)];
    for (let p = 0; p <= 0.7; p += 0.01) expect(Number.isFinite(railPosition(twins, p))).toBe(true);
  });
});

describe('which stop is the current one', () => {
  const stops = [stop('a', 0, 0), stop('b', 0.2, 0.25), stop('c', 0.5, 0.6)];

  it('is the last stop whose own beginning has been reached', () => {
    expect(railCurrent(stops, 0)).toBe(0);
    expect(railCurrent(stops, 0.19)).toBe(0);
    expect(railCurrent(stops, 0.2)).toBe(1);
    expect(railCurrent(stops, 0.49)).toBe(1);
    expect(railCurrent(stops, 0.5)).toBe(2);
    expect(railCurrent(stops, 9)).toBe(2);
  });

  it('is the first stop before anything has begun', () => {
    expect(railCurrent(stops, -1)).toBe(0);
    expect(railCurrent([], 0.5)).toBe(0);
  });
});

describe('how a press is answered on the film', () => {
  const door = 0.42;

  it('glides to a neighbour on the same side of the front door', () => {
    expect(railMove(0, 1, 0.05, 0.12, door)).toBe('glide');
    expect(railMove(5, 4, 0.7, 0.62, door)).toBe('glide');
    expect(railMove(3, 3, 0.5, 0.5, door)).toBe('glide');
  });

  it('cuts to anything further: a sprung camera would go there in a straight line', () => {
    expect(railMove(0, 2, 0.05, 0.2, door)).toBe('cut');
    expect(railMove(9, 4, 0.95, 0.6, door)).toBe('cut');
  });

  it('cuts across the door even between neighbours: the two sides are two models', () => {
    expect(railMove(3, 4, 0.4, 0.45, door)).toBe('cut');
    expect(railMove(4, 3, 0.45, 0.4, door)).toBe('cut');
  });

  it('takes a glide between a second and four, however near or far', () => {
    expect(railGlideSeconds(0)).toBe(1.1);
    expect(railGlideSeconds(1)).toBe(1.1);
    expect(railGlideSeconds(6)).toBeCloseTo(2.52, 9);
    expect(railGlideSeconds(-6)).toBeCloseTo(2.52, 9);
    expect(railGlideSeconds(400)).toBe(4.2);
  });
});

describe("the film's own stops", () => {
  // As the film's page builds them: a stop a chapter, landing where the
  // chapter's copy is whole, and one more for the colophon past the film's end.
  const beat = chapters(3);
  const stops: RailStop[] = [
    ...beat.map((c) => ({
      id: c.id,
      label: c.id,
      from: c.id === 'hero' ? 0 : c.from,
      at: c.id === 'hero' ? 0 : c.copy.in[1] + 0.0004,
    })),
    { id: 'visit', label: 'The visit', from: JOURNEY_END, at: RAIL_END },
  ];

  it('has a stop for every chapter and one for the way out', () => {
    expect(stops.length).toBe(beat.length + 1);
    expect(new Set(stops.map((s) => s.id)).size).toBe(stops.length);
    expect(stops[stops.length - 1].at).toBe(RAIL_END);
  });

  it('lands each press inside the chapter it names, in order down the page', () => {
    const film = stops.slice(0, -1);
    for (let i = 0; i < film.length; i += 1) {
      const next = i + 1 < film.length ? film[i + 1].from : JOURNEY_END;
      expect(film[i].at, film[i].id).toBeGreaterThanOrEqual(film[i].from);
      expect(film[i].at, film[i].id).toBeLessThan(next);
      if (i > 0) expect(film[i].at).toBeGreaterThan(film[i - 1].at);
    }
  });

  it('has the front door between two of its stops, so a press across it is a cut', () => {
    const film = stops.slice(0, -1);
    const outside = film.filter((s) => s.at < CROSSOVER).length;
    expect(outside).toBeGreaterThan(1);
    expect(outside).toBeLessThan(film.length);
    expect(railMove(outside - 1, outside, film[outside - 1].at, film[outside].at, CROSSOVER)).toBe('cut');
  });
});
