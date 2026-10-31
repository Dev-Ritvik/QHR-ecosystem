// apps/public/src/components/experience/exteriorSurvey.test.ts
//
// The cover's survey (the concept built 1:1, 2026-10-27) belongs to the cover:
// whole on its first frame, gone as the camera leaves it, and never inside.

import { describe, expect, it } from 'vitest';
import { SURVEY, SURVEY_PINS, surveyHeight, surveyOn, surveySheet } from './exteriorSurvey';

describe("the cover's survey", () => {
  it('is whole on the cover and gone by the camera’s first turn', () => {
    expect(surveyOn('exterior', 0)).toBe(1);
    expect(surveyOn('exterior', SURVEY.gone[1])).toBe(0);
    expect(surveyOn('exterior', 0.5)).toBe(0);
    expect(surveyOn('interior', 0)).toBe(0);
  });

  it('draws the same ground in the shader as here', () => {
    const sheet = surveySheet();
    const src = (sheet.material as unknown as { fragmentShader: string }).fragmentShader;
    expect(src).toContain('float surveyHeight(vec2 p)');
    expect(src).toContain(`/ ${SURVEY.interval.toFixed(3)}`);
    // a gentle lie: a few metres over the compound, no cliffs
    for (const [x, z] of [[0, 0], [40, -30], [-50, 60]]) expect(Math.abs(surveyHeight(x, z))).toBeLessThan(10);
  });

  it('pins its labels to the ground, and writes no depth', () => {
    for (const p of SURVEY_PINS) expect(p.at[1]).toBe(0);
    const sheet = surveySheet();
    expect(sheet.material).toMatchObject({ depthWrite: false, transparent: true });
  });
});
