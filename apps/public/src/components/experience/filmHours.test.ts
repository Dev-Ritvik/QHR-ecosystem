// apps/public/src/components/experience/filmHours.test.ts
//
// The film's hours as contracts: golden until the layout, blue by the end of its
// words, midnight by the door's, with no step anywhere on the way.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { atmosphereAt } from './cameraPath';
import { CROSSOVER, DOOR_OUT, PAGE_REST_MS, PRELOAD_LEAD, followPageRest, pageAtRest } from './journey';
import { DIE_LAMPS, GLOWS, HEADLAMPS, LAMP_POOLS, RING_BOLLARDS, ROAD_LAMPS, STONE_AT_DUSK, WALK_BOLLARDS, WALL_LANTERNS, lampsOn } from './exteriorLamps';
import { HAZE_AIR } from './exteriorHaze';
import { HOURS, SKY_LIGHT, hourChoice, midnightAt, setHourChoice, skyLightAt, stepHourChoice, twilightAt } from './filmHours';
import { SKY_NIGHT_URL, SKY_TWILIGHT_URL, skyPlateUrl } from './SkyHours';

const read = (name: string) => readFileSync(join(__dirname, name), 'utf8').replace(/\r\n/g, '\n');

describe('the film’s hours', () => {
  it('leave the cover and the revolution as they are', () => {
    for (const leg of [0, 0.1, 0.3, 0.3875, 0.5, HOURS.twilight[0]]) {
      expect(twilightAt(leg)).toBe(0);
      expect(midnightAt(leg)).toBe(0);
    }
  });

  it('turn from golden to blue over the layout’s words, and are blue before they go', () => {
    // its words are up over leg 0.585 to 0.672 (journey.ts, COPY_SPAN)
    expect(twilightAt(0.59)).toBeLessThan(0.3);
    expect(twilightAt(0.655)).toBe(1);
    expect(HOURS.twilight[1]).toBeLessThan(0.672);
  });

  it('go from blue to midnight on the way to the door, whole when its line comes up', () => {
    expect(midnightAt(HOURS.twilight[1])).toBe(0);
    expect(HOURS.midnight[0]).toBeGreaterThanOrEqual(HOURS.twilight[1]);
    // "The door is open." comes up at leg 0.86
    expect(midnightAt(0.86)).toBe(1);
    expect(twilightAt(1)).toBe(1);
    expect(midnightAt(1)).toBe(1);
  });

  it('never step: a change of less than a scroll notch’s worth from one point to the next', () => {
    let e = 0;
    let n = 0;
    for (let leg = 0; leg <= 1; leg += 0.001) {
      const ne = twilightAt(leg);
      const nn = midnightAt(leg);
      expect(Math.abs(ne - e)).toBeLessThan(0.02);
      expect(Math.abs(nn - n)).toBeLessThan(0.02);
      expect(ne).toBeGreaterThanOrEqual(e);
      expect(nn).toBeGreaterThanOrEqual(n);
      e = ne;
      n = nn;
    }
  });

  it('are what the atmosphere reads, so the lights and the print share the clock', () => {
    for (const leg of [0, 0.55, 0.6, 0.64, 0.8, 1]) expect(atmosphereAt(leg).evening).toBe(twilightAt(leg));
    const world = read('WorldCanvas.tsx');
    // (through the visitor's own hour, which is the film's until it is pressed)
    expect(world).toContain("const hour = stepHourChoice(delta, a.evening, midnightAt(legS), film && day && holdTime === undefined);");
    expect(world).toContain('const nightBand = hour.night;');
    expect(world).toContain('const n = nightBand;');
  });

  it('hold a reflection at the sky’s strength between takes', () => {
    expect(skyLightAt(0, 0)).toBe(1);
    expect(skyLightAt(1, 0)).toBeCloseTo(SKY_LIGHT.twilight, 6);
    expect(skyLightAt(1, 1)).toBeCloseTo(SKY_LIGHT.midnight, 6);
    expect(SKY_LIGHT.midnight).toBeLessThan(SKY_LIGHT.twilight);
    expect(read('ExteriorModel.tsx')).toContain('scene.backgroundIntensity * skyLightAt(filmState.evening, filmState.night)');
  });
});

describe('the lens on the way through the hours', () => {
  const stage = read('InteriorStage.tsx');

  it('stays the estate\u2019s until the hall has the frame, though the hall\u2019s stage is armed long before', () => {
    expect(stage).toContain("doorwayState.sceneLeg === 'interior' ||");
    expect(stage).toContain('if (hallsLens) lensFilter.top = mode === \'still\' ? 0 : HEADER_BAND.hall;');
    const guarded = stage.slice(stage.indexOf('if (hallsLens) {'), stage.indexOf('codaFilter(copyZone.lines'));
    for (const writer of ['stationFilter(', 'headerBandReach();', 'phoneRoomFilter(', 'tableBandFilter(']) {
      expect(guarded).toContain(writer);
    }
  });

  it('is handed back only when the way out by the door has ended, as the estate\u2019s own loop reads it', () => {
    const passage = "doorwayState.mode === 'running' && doorwayState.dir === 'exit' && doorwayState.style === 'through'";
    expect(stage).toContain(passage);
    expect(read('WorldCanvas.tsx')).toContain(passage);
  });
});

describe('the hall, which is not to stop a frame while the light is turning', () => {
  it('is armed before the light begins to move, a visitor who never stops included', () => {
    const at = (CROSSOVER - PRELOAD_LEAD) / DOOR_OUT;
    expect(at).toBeLessThan(HOURS.twilight[0] - 0.1);
    // (with no line of the orbit's chapter still up to jolt: lensFilter, COVER_SKY.off)
    expect(at).toBeGreaterThan(0.31);
  });

  it('is armed while the page stands still, if its bytes are already in hand', () => {
    const world = read('WorldCanvas.tsx');
    expect(world).toContain("const atRest = sceneWarm.ready && hallLoad.state === 'done' && pageAtRest(now);");
    expect(world).toContain('if ((journeyState.armed || atRest) && !armedOnce.current) {');
    expect(world).toContain('followPageRest(window.scrollY, now);');
  });

  it('knows a page at rest from one between two notches of the wheel', () => {
    followPageRest(100, 1000);
    expect(pageAtRest(1000 + PAGE_REST_MS - 1)).toBe(false);
    expect(pageAtRest(1000 + PAGE_REST_MS + 1)).toBe(true);
    followPageRest(100, 5000);
    expect(pageAtRest(5000)).toBe(true);
    followPageRest(101, 5000);
    expect(pageAtRest(5001)).toBe(false);
  });

  it('nor is the lantern\u2019s shadow: its first draw is under the still', () => {
    const lantern = read('PorticoLantern.tsx');
    expect(lantern).toContain('if (!shadowBuilt.current && sceneWarm.drawing) {');
    expect(lantern).toContain('l.shadow.needsUpdate = true;');
  });
});

describe('the blue hour on the land, as the reference measures', () => {
  const world = read('WorldCanvas.tsx');

  it('takes a slate fill, turns the greens to teal, and gives the door its own back by midnight', () => {
    expect(world).toContain("const FILL_EVENING = new THREE.Color('#7F97B0');");
    const grade = read('FilmGrade.tsx');
    expect(grade).toContain('greenHue: 0.2,');
    // and hands the night's greens on from the blue hour's, with no step
    expect(grade).toContain("hand('greenHue', ld('greenHueNight', NIGHT_GREENS.hue));");
    // a cool lean on what is dark and in the middle, at the blue hour alone
    expect(grade).toContain('const cool = e * (1 - n);');
    expect(grade).toContain('g *= mix(coolShade, vec3(1.0), smoothstep(0.2, 0.62, l));');
    // the fill, the sky's light and the rooms at the door, as they were measured
    const fill = Number(/const EVENING_FILL = ([\d.]+);/.exec(world)![1]);
    const loss = Number(/const NIGHT_FILL_LOSS = ([\d.]+);/.exec(world)![1]);
    expect(fill * (1 - loss)).toBeCloseTo(0.9, 1);
    const env = /const ENV_HOURS = \{ evening: ([\d.]+), night: ([\d.]+) \}/.exec(world)!;
    expect(Number(env[1]) * Number(env[2])).toBeCloseTo(0.036, 3);
    const glow = Number(/const WINDOW_EVENING_GLOW = ([\d.]+);/.exec(world)![1]);
    const back = Number(/const WINDOW_NIGHT_GLOW = (-?[\d.]+);/.exec(world)![1]);
    expect(glow + back).toBeCloseTo(0.72, 6);
  });

  it('holds the pale stone under the lawn until midnight', () => {
    for (const k of STONE_AT_DUSK) expect(k).toBeLessThan(1);
    const lamps = read('exteriorLamps.tsx');
    expect(lamps).toContain('reflectedLight.indirectDiffuse *= uStoneFill;');
    expect(lamps).toContain('const blue = filmState.evening * (1 - filmState.night);');
  });

  it('takes far things away by the air before any dissolve', () => {
    const haze = read('exteriorHaze.ts');
    expect(HAZE_AIR).toBeGreaterThan(0);
    expect(HAZE_AIR).toBeLessThan(1);
    expect(haze).toContain('#ifdef HAZE_FAR');
    expect(read('exteriorJungle.ts')).toContain('own.userData.far = true;');
  });

  it('takes the estate\u2019s wall off the frame with the layout', () => {
    const layout = read('exteriorLayout.ts');
    expect(layout).toContain('/^(estate_wall|helipad_)/.test(mesh.name)');
    expect(layout).toContain('own.userData.leave = true;');
  });

  it('brings the avenue\u2019s palms back through the frame as the reference has them, and dark', () => {
    const model = read('ExteriorModel.tsx');
    expect(model).toContain('hazeUniforms.uHazeBack.value = back;');
    expect(model).toContain('material.color.copy(colour).multiplyScalar(palmDark);');
    expect(read('exteriorHaze.ts')).toContain('< uHazeGround * ( 1.0 - uHazeBack ) ) discard;');
  });

  it('lights the fountain from within, pale, and the far rooms as panes of amber', () => {
    expect(read('exteriorWater.ts')).toContain('#if !defined(WATER_POOL) && !defined(WATER_PROBE)');
    expect(read('exteriorWindows.ts')).toContain('uRoomFar * 0.8);');
    expect(read('WorldCanvas.tsx')).toContain('roomUniforms.uRoomFar.value = roomsFar * e;');
  });

  it('has the mountains the reference has, in the blue hour\u2019s plate and the night\u2019s, and on the stars\u2019 skyline', () => {
    const grade = read('../../../../../tools/gltf/grade_sky_hours_v12.py');
    expect(grade).toContain('twilight = with_massifs(twilight,');
    expect(grade).toContain('night = with_massifs(night,');
    expect(grade).toContain('ridge = np.maximum(np.maximum(ridge_any, 0.0), prof)');
  });
});

describe('the sky at each hour', () => {
  const sky = read('SkyHours.tsx');
  const haze = read('skyHaze.ts');

  it('dissolves over the day’s plate on the same hills, on the film only', () => {
    expect(sky).toContain('float over = 1.0 - (1.0 - uSkyDusk) * (1.0 - uSkyNoonOn);');
    expect(sky).toContain('gl_FragColor = vec4(c, over);');
    expect(sky).toContain('texture2D(uSkyTwilight, uv).rgb, texture2D(uSkyNight, uv).rgb, uSkyMidnight');
    expect(read('WorldCanvas.tsx')).toContain('{onJourney ? <SkyHours film /> : null}');
  });

  it('stands behind everything and leaves the frame’s depth alone', () => {
    expect(sky).toContain('gl_Position = p.xyww;');
    expect(sky).toContain('keepDepthAlpha(material);');
    expect(sky).toContain('depthWrite: false');
    // before the horizon's skirt
    expect(sky).toContain('m.renderOrder = -11;');
  });

  it('builds its program under the warm-up, whatever the hour', () => {
    expect(sky).toContain('material.visible = false;');
    expect(sky).toContain('.visible = e > 0.001 || noon > 0.001;');
    // the hour's plates are uploaded on arrival, not on first use
    expect(sky).toContain('gl.initTexture(tex);');
  });

  it('keeps its stars over the hills', () => {
    expect(sky).toContain('float clear = smoothstep(ridge');
    expect(sky).toContain('texture2D(uSkyRidge, vec2(u, 0.5)).r');
  });

  it('takes half-size plates on a small screen or a small machine', () => {
    expect(skyPlateUrl(SKY_TWILIGHT_URL, 1920, 8)).toBe(SKY_TWILIGHT_URL);
    expect(skyPlateUrl(SKY_TWILIGHT_URL, 390, 8)).toContain('_2k.');
    expect(skyPlateUrl(SKY_NIGHT_URL, 1920, 4)).toContain('_2k.');
    expect(skyPlateUrl(SKY_NIGHT_URL, 1920)).toBe(SKY_NIGHT_URL);
  });

  it('hands the golden hour’s air back when the film is left', () => {
    expect(sky).toContain('followSkyHour(0, 0);');
  });

  it('takes the land’s air with it', () => {
    expect(haze).toContain('export function followSkyHour(e: number, n: number, noon = 0): void');
    expect(sky).toContain('followSkyHour(e, n, noon);');
    expect(read('WorldCanvas.tsx')).toContain('const sky = plated ? 1 :');
  });
});

describe('the estate’s lamps', () => {
  it('are off by day and up by the time the sky is blue', () => {
    expect(lampsOn(0)).toBe(0);
    expect(lampsOn(0.2)).toBe(0);
    expect(lampsOn(0.9)).toBe(1);
    let last = 0;
    for (let t = 0; t <= 1; t += 0.01) {
      expect(lampsOn(t)).toBeGreaterThanOrEqual(last);
      last = lampsOn(t);
    }
  });

  it('leave the forecourt in front of the door dark, as the reference has it', () => {
    // the door's lens: nothing of the ring's within the frame on the axis
    for (const [x, , z] of RING_BOLLARDS) {
      if (z < 30) expect(Math.abs(x)).toBeGreaterThan(12);
    }
    // nor across the avenue's mouth
    for (const [x, , z] of RING_BOLLARDS) {
      if (z > 30) expect(Math.abs(x)).toBeGreaterThan(5);
    }
  });

  it('are the reference’s: lanterns on the front, a lamp on each die, the car’s lights on', () => {
    expect(WALL_LANTERNS).toHaveLength(4);
    expect(DIE_LAMPS).toHaveLength(2);
    expect(HEADLAMPS).toHaveLength(2);
    expect(GLOWS.length).toBe(RING_BOLLARDS.length + WALK_BOLLARDS.length + ROAD_LAMPS.length + 2 + 4 + 2);
    expect(LAMP_POOLS.length).toBeGreaterThan(RING_BOLLARDS.length);
    // the model has the lanterns where the lamps' light stands (build_estate_v7.py)
    const build = read('../../../../../tools/blender/build_estate_v7.py');
    for (const [x, y] of WALL_LANTERNS) expect(build).toContain(`(${x}, ${y.toFixed(2)},`);
  });

  it('are the road’s only while the road is', () => {
    const glows = GLOWS.filter((g) => g.layout === 1);
    expect(glows).toHaveLength(ROAD_LAMPS.length);
    expect(read('exteriorLamps.tsx')).toContain('mix(1.0, uLayoutOn, aLayout)');
  });

  it('build their programs under the warm-up too', () => {
    const lamps = read('exteriorLamps.tsx');
    expect(lamps).toContain('material.visible = false;');
    expect(read('WorldCanvas.tsx')).toContain('<EstateLamps />');
  });

  it('leave the frame’s depth alone', () => {
    const lamps = read('exteriorLamps.tsx');
    expect(lamps).toContain('blendSrcAlpha: THREE.ZeroFactor');
    expect(lamps).toContain('blendDstAlpha: THREE.OneFactor');
  });
});

describe('the visitor’s own hour', () => {
  const settle = (filmE: number, filmN: number, own = true) => {
    let out = { evening: 0, night: 0, noon: 0 };
    for (let i = 0; i < 600; i += 1) out = stepHourChoice(1 / 60, filmE, filmN, own);
    return { ...out };
  };
  const reset = () => {
    setHourChoice('film');
    hourChoice.noonReady = false;
    settle(0, 0);
  };

  it('is the film’s, exactly, for anyone who never presses', () => {
    reset();
    for (const leg of [0, 0.3, 0.6, 0.64, 0.8, 0.95]) {
      const out = stepHourChoice(1 / 60, twilightAt(leg), midnightAt(leg), true);
      expect(out.evening).toBe(twilightAt(leg));
      expect(out.night).toBe(midnightAt(leg));
      expect(out.noon).toBe(0);
    }
  });

  it('holds the estate at the hour asked for, wherever the film has got to', () => {
    reset();
    setHourChoice('night');
    expect(settle(0, 0)).toMatchObject({ evening: 1, night: 1, noon: 0 });
    setHourChoice('golden');
    expect(settle(1, 1)).toMatchObject({ evening: 0, night: 0, noon: 0 });
    reset();
  });

  it('goes to noon only once the sky has a plate to go to', () => {
    reset();
    setHourChoice('day');
    expect(settle(0, 0).noon).toBe(0);
    hourChoice.noonReady = true;
    expect(settle(0, 0).noon).toBe(1);
    reset();
    expect(settle(0, 0).noon).toBe(0);
  });

  it('dissolves there and back, with no step, and says the sun is moving while it does', () => {
    reset();
    setHourChoice('night');
    let last = 0;
    let moving = false;
    for (let i = 0; i < 90; i += 1) {
      const { evening } = stepHourChoice(1 / 60, 0, 0, true);
      expect(evening - last).toBeLessThan(0.05);
      last = evening;
      moving = moving || hourChoice.moving;
    }
    expect(moving).toBe(true);
    reset();
    expect(hourChoice.moving).toBe(false);
  });

  it('is the film’s alone: a page that holds the film’s frame takes no notice', () => {
    reset();
    setHourChoice('night');
    expect(settle(0, 0, false)).toMatchObject({ evening: 0, night: 0 });
    reset();
  });
});
