// apps/public/src/components/experience/exteriorSurfaces.ts
//
// Age, on the surfaces that were new.
//
// THE REVIEW: "the stone facade uses a visibly repeating, tiled texture with
// zero weathering, dirt"; "the rigid geometric hedges lack individual leaf
// detail". Old money is not new: a real ashlar house is darker where the rain
// splashes back off the terrace, streaked under its sills, cleaner under the
// cornice, and no two stones of it are quite the same colour. All of it is
// drawn here in WORLD space, so none of it can repeat with the texture's tile:
//
//   STONE — rising damp and splash-back in the first metre and a half above
//   the ground, with a ragged upper edge; faint vertical rain streaking; two
//   octaves of broad variation (4 m, 13 m), warmer and cooler, that break the
//   tile's repeat at every distance the film holds.
//
//   ROOF SLATE — slate-to-slate value variation at a slate's size and broad
//   weathered patches, so the largest surface in the hero stops reading as one
//   grey sheet.
//
//   HEDGES — the box hedges were untextured boxes. Leaf-scale noise in colour
//   and in the normal (two octaves, 9 cm and 30 cm), darker and bluer at the
//   foot where the hedge shades itself, lighter at the clipped top. The box is
//   still a box — a clipped hedge is — but its surface now reads as leaves.

import * as THREE from 'three';

const NOISE = /* glsl */ `
float ageHash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float ageNoise(vec3 x) {
  vec3 i = floor(x), f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(ageHash(i), ageHash(i + vec3(1, 0, 0)), f.x), mix(ageHash(i + vec3(0, 1, 0)), ageHash(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(ageHash(i + vec3(0, 0, 1)), ageHash(i + vec3(1, 0, 1)), f.x), mix(ageHash(i + vec3(0, 1, 1)), ageHash(i + vec3(1, 1, 1)), f.x), f.y), f.z) * 2.0 - 1.0;
}
varying vec3 vAgeWorld;
`;

/**
 * The ashlar of the upper wall: where its courses start (the top of the base
 * course, tools/blender/build_estate_v7.py BASE_TOP), a course's height and a
 * stone's length, the joint's width, all metres; how far a joint darkens and
 * how far one stone's tone stands from the next.
 */
export const ASHLAR = { from: 0.9, course: 0.38, stone: 0.92, joint: 0.008, depth: 0.2, tone: 0.022 } as const;

// THE SECOND PASS OF AGE (the third art-direction critique, 2026-09-30: "The
// materials need to look tactile ... realistic roughness and subtle
// imperfections"; in its frames the facade still read as one flat beige). The
// first pass was measured too faint to survive the print at the hero's
// distance. Now, besides a stronger broad patina:
//
//   GRIME IN THE SHELTER. Where the rain does not wash — under the cornice's
//   projection, in every reveal, sill and return — stone darkens. The bake
//   already knows exactly where that is (bake_estate_ao_v7.py): its occlusion
//   is sampled here into the COLOUR, not only the sky light, so the shelter of
//   each moulding reads in sun as well as in shade.
//
//   STREAKS UNDER THE LEDGES. The house's two continuous ledges — the string
//   course (underside 4.80 m) and the entablature (8.50 m), build_estate_v7.py —
//   shed their dirt down the WALL below them in uneven dribbles, longest where
//   the ledge drips most. Not down the trim: measured on the hero, the
//   portico's beam sits in the band under the string course and took the
//   dribbles as a row of dashes along its face.
//
//   A RAGGED, GREENER DAMP LINE at the foot, where splash-back and lichen
//   live, and rougher stone wherever it is dirty.
//
//   THE ASHLAR'S JOINTS (the refinement brief, 2026-10-03: at the approach's
//   distance "the mansion reads as ... a game/CG asset"; its audits: stone
//   with "no surface"). The upper wall is dressed ashlar, and it was drawn as
//   one unbroken skin, which is render plaster. Dressed stone is laid: courses
//   ASHLAR.course high, stones ASHLAR.stone long, breaking joint from one
//   course to the next, with a joint a few millimetres wide between them and
//   no two stones cut from quite the same bed. So the joints are drawn in
//   WORLD space, as wide as they are and no wider (a joint narrower than a
//   pixel is drawn at its share of the pixel, so the courses fade with
//   distance instead of aliasing), and each stone takes its own tone, a
//   couple of per cent either way. The client once called a facade of
//   patchwork stones "a skin disease": that was nine per cent a stone under a
//   pebbled normal. This is the quiet version of the same true thing.
/**
 * THE COMPOUND WALL IS STONE TOO. It was the one stone surface on the estate
 * this file did not dress: a quarter-kilometre of one flat tone behind the
 * trees. The forensic audit of 2026-10-09 (#29): "A featureless white wall
 * runs dead straight across the frame behind the trees ... Expected: a wall
 * with piers, a coping and some weather." The piers and the coping are the
 * model's (tools/blender/build_estate_v7.py, build_compound_wall: a pier
 * every eight metres under one coping at `coping` metres). The weather is
 * the house's own, on a garden wall's terms: the broad patina, the damp and
 * the lichen of its first metre, and under the coping the dirt the coping
 * sheds, in dribbles `fall` metres long.
 */
export const BOUNDARY = { coping: 2.3, fall: [0.45, 1.25], depth: 0.6 } as const;

/**
 * AND IT IS LAID (the brief of 2026-11-01: "perimeter stone walls"). The paid audit of
 * 2026-10-04 made it a weathered render, which from the cover was a long pale strip
 * with nothing in it. Coursed rubble: courses `course` metres high, each with its own
 * length of stone (`stone`, shortest and longest), a joint `joint` wide, each stone its
 * own tone. In the world, like the ashlar's, and put down as the courses shrink toward
 * a pixel; at the far end of the park the tone is all that is left of it.
 */
export const BOUNDARY_STONE = { course: 0.31, stone: [0.55, 1.05], joint: 0.014, tone: 0.3, depth: 0.5, from: 0.5, to: 1.2 } as const;

/**
 * THE FORECOURT'S SETTS (the same brief: "cobblestone driveways"; the forecourt itself
 * stays the polished stone the user's Feature 1 brief asked for, and these are its
 * edging and the car's bay: tools/blender/build_estate_v7.py, forecourt_setts). Granite,
 * `size` metres square, laid in running bond, a joint `joint` wide, each one its own
 * tone, and put down as they shrink toward a pixel.
 */
export const SETTS = { size: 0.11, joint: 0.009, tone: 0.34, depth: 0.62, from: 0.05, to: 0.13 } as const;

/**
 * THE COMPOUND WALL AT THE FAR END OF THE PARK. Its coping's top is 54 cm
 * across the wall and each pier stands 15 cm out of its face (the model,
 * build_compound_wall). From the orbit the far run is a hundred metres off
 * and seen six degrees from level: the coping's top is half a pixel high, and
 * this frame cannot be multisampled, so it was drawn only where a pixel's
 * centre fell on it — a bright dashed line along the wall's top, at a luma of
 * 150 to 167 over its face at 88, and the piers' sides dotted uprights (the
 * forensic re-audit, 17 October 2026, at the film's 17%, found by a ray
 * through the dashes: #29's "dashed top", which the coping had cured at the
 * cover and not that far off).
 *
 * So a face of the wall that is not its face — a coping's top, a pier's side
 * or cap — is shaded as the wall's face beside it while it is narrower across
 * the wall than a pixel or two (`from`, `to`, in pixels), and as itself once
 * the camera is near enough to draw it: the eased arrises of the house
 * (exteriorArris.ts), by the same reasoning. The runs lie along x and z, the
 * two side runs at x = ±`x` (the model's WALL_X), so a fragment knows from
 * where it stands which way the wall's face looks.
 */
export const BOUNDARY_FAR = { x: 72.0, coping: 0.54, proud: 0.15, from: 1.0, to: 2.0 } as const;

const BOUNDARY_NORMAL = /* glsl */ `
#include <normal_fragment_maps>
#ifdef ESTATE_BOUNDARY
{
  // In the world's axes: the face's own normal (toward the eye), and across the wall.
  vec3 bw = vAgeWorld;
  vec3 bdx = dFdx(bw), bdy = dFdy(bw);
  vec3 bFace = normalize(cross(bdx, bdy));
  vec3 bAcross = abs(abs(bw.x) - ${BOUNDARY_FAR.x.toFixed(1)}) < 1.5 ? vec3(1.0, 0.0, 0.0) : vec3(0.0, 0.0, 1.0);
  if (abs(dot(bFace, bAcross)) < 0.5) {
    // how far across the wall a pixel reaches on this face, and so how many pixels the face is
    float bPerPx = max(max(abs(dot(bdx, bAcross)), abs(dot(bdy, bAcross))), 1.0e-5);
    float bBreadth = bFace.y > 0.5 ? ${BOUNDARY_FAR.coping.toFixed(2)} : ${BOUNDARY_FAR.proud.toFixed(2)};
    vec3 bWall = bAcross * (dot(cameraPosition - bw, bAcross) < 0.0 ? -1.0 : 1.0);
    normal = normalize(mix((viewMatrix * vec4(bWall, 0.0)).xyz, normal, smoothstep(${BOUNDARY_FAR.from.toFixed(1)}, ${BOUNDARY_FAR.to.toFixed(1)}, bBreadth / bPerPx)));
  }
}
#endif
`;

const STONE = /* glsl */ `
#include <color_fragment>
float estateGrime = 0.0;
{
  vec3 w = vAgeWorld;
  #ifdef ESTATE_ASHLAR
  {
    // Which way the wall runs: along x on the fronts, along z on the flanks
    // (the face's own normal, from the world position's derivatives).
    vec3 fn = abs(cross(dFdx(w), dFdy(w)));
    float along = fn.z > fn.x ? w.x : w.z;
    float cy = (w.y - ${ASHLAR.from.toFixed(2)}) / ${ASHLAR.course.toFixed(4)};
    float course = floor(cy);
    float tt = along / ${ASHLAR.stone.toFixed(2)} + 0.5 * mod(course, 2.0);
    float fy = fract(cy), fx = fract(tt);
    float dh = min(fy, 1.0 - fy) * ${ASHLAR.course.toFixed(4)};
    float dv = min(fx, 1.0 - fx) * ${ASHLAR.stone.toFixed(2)};
    float px = max(length(fwidth(w)), 1.0e-4);
    float half_ = ${(ASHLAR.joint / 2).toFixed(4)};
    float joint = clamp((half_ + 0.5 * px - min(dh, dv)) / px, 0.0, 1.0);
    // A level wall only: no courses on a sill's top or a soffit.
    float upright = 1.0 - smoothstep(0.2, 0.5, fn.y / max(fn.x + fn.y + fn.z, 1.0e-6));
    float stone = ageHash(vec3(course, floor(tt), fn.z > fn.x ? 1.0 : 2.0));
    float seen = 1.0 - smoothstep(0.25, 0.6, px / ${ASHLAR.course.toFixed(4)});
    diffuseColor.rgb *= 1.0 + ${ASHLAR.tone.toFixed(3)} * (stone * 2.0 - 1.0) * seen * upright;
    diffuseColor.rgb *= 1.0 - ${ASHLAR.depth.toFixed(2)} * joint * upright;
  }
  #endif
  // Broad patina, warmer and cooler, stone to stone.
  float m1 = ageNoise(w / 4.0), m2 = ageNoise(w / 13.0 + 7.1);
  diffuseColor.rgb *= 1.0 + 0.1 * m1 + 0.07 * m2;
  diffuseColor.rgb *= mix(vec3(0.95, 0.985, 1.04), vec3(1.05, 1.0, 0.92), 0.5 + 0.5 * m2);
  // Grime in the shelter, from the baked occlusion.
  #ifdef USE_AOMAP
    float shelter = 1.0 - texture2D(aoMap, vAoMapUv).r;
    estateGrime = max(estateGrime, smoothstep(0.06, 0.5, shelter) * (0.8 + 0.2 * m1));
  #endif
  // Streaks under the string course and the entablature: a dribble per few
  // centimetres of ledge, each its own length.
  #ifndef ESTATE_TRIM
  {
    float lane = ageNoise(vec3((w.x + w.z) * 3.4, 0.0, (w.x - w.z) * 3.4));
    float fall = 0.9 + 1.1 * (0.5 + 0.5 * lane);
    float below = 0.0;
    float d1 = 4.8 - w.y;
    float d2 = 8.5 - w.y;
    if (d1 > 0.0 && d1 < 2.6) below = max(below, 1.0 - smoothstep(0.05, fall, d1));
    if (d2 > 0.0 && d2 < 2.6) below = max(below, 1.0 - smoothstep(0.05, fall * 1.15, d2));
    float dribble = smoothstep(-0.25, 0.55, ageNoise(vec3((w.x + w.z) * 6.5, w.y * 0.6, (w.x - w.z) * 6.5)));
    estateGrime = max(estateGrime, below * dribble * 0.6);
  }
  #endif
  // THE COMPOUND WALL, LAID IN COURSES (BOUNDARY_STONE, below).
  #ifdef ESTATE_BOUNDARY
  {
    vec3 fn = abs(cross(dFdx(w), dFdy(w)));
    float along = fn.z > fn.x ? w.x : w.z;
    float cy = w.y / ${BOUNDARY_STONE.course.toFixed(3)};
    float course = floor(cy);
    float len = mix(${BOUNDARY_STONE.stone[0].toFixed(2)}, ${BOUNDARY_STONE.stone[1].toFixed(2)}, ageHash(vec3(course, 3.1, 7.7)));
    float tt = along / len + 7.3 * ageHash(vec3(course, 1.9, 2.3));
    float fy = fract(cy), fx = fract(tt);
    float dh = min(fy, 1.0 - fy) * ${BOUNDARY_STONE.course.toFixed(3)};
    float dv = min(fx, 1.0 - fx) * len;
    float px = max(length(fwidth(w)), 1.0e-4);
    float joint = clamp((${(BOUNDARY_STONE.joint / 2).toFixed(4)} + 0.5 * px - min(dh, dv)) / px, 0.0, 1.0);
    float upright = 1.0 - smoothstep(0.2, 0.5, fn.y / max(fn.x + fn.y + fn.z, 1.0e-6));
    float stone = ageHash(vec3(course, floor(tt), 1.0));
    float seen = 1.0 - smoothstep(${BOUNDARY_STONE.from.toFixed(2)}, ${BOUNDARY_STONE.to.toFixed(2)}, px / ${BOUNDARY_STONE.course.toFixed(3)});
    diffuseColor.rgb *= 1.0 + ${BOUNDARY_STONE.tone.toFixed(2)} * (stone * 2.0 - 1.0) * upright * max(seen, 0.2);
    diffuseColor.rgb *= mix(vec3(0.95, 0.98, 1.03), vec3(1.05, 1.0, 0.92), ageHash(vec3(floor(tt), course, 9.0)));
    diffuseColor.rgb *= 1.0 - ${BOUNDARY_STONE.depth.toFixed(2)} * joint * upright * seen;
  }
  // UNDER ITS OWN COPING (BOUNDARY, below): the same dribbles, from the one ledge it has.
  {
    float lane = ageNoise(vec3((w.x + w.z) * 3.4, 0.0, (w.x - w.z) * 3.4));
    float fall = ${BOUNDARY.fall[0].toFixed(2)} + ${(BOUNDARY.fall[1] - BOUNDARY.fall[0]).toFixed(2)} * (0.5 + 0.5 * lane);
    float d = ${BOUNDARY.coping.toFixed(2)} - w.y;
    float below = d > 0.0 ? 1.0 - smoothstep(0.03, fall, d) : 0.0;
    float dribble = smoothstep(-0.25, 0.55, ageNoise(vec3((w.x + w.z) * 6.5, w.y * 0.6, (w.x - w.z) * 6.5)));
    estateGrime = max(estateGrime, below * dribble * ${BOUNDARY.depth.toFixed(2)});
  }
  #endif
  // Faint rain streaking over the whole face.
  float streak = ageNoise(vec3((w.x + w.z) * 2.2, w.y * 0.12, (w.x - w.z) * 2.2));
  diffuseColor.rgb *= 1.0 - 0.07 * smoothstep(0.2, 0.9, streak);
  // Grime is darker and a little cooler, never black.
  diffuseColor.rgb *= mix(vec3(1.0), vec3(0.7, 0.69, 0.67), estateGrime);
  // Rising damp and splash-back, with a ragged top, greener at the foot.
  float edge = 1.25 + 0.45 * ageNoise(vec3(w.x + w.z, 0.0, w.z - w.x) * 0.9);
  float damp = 1.0 - smoothstep(0.1, edge, w.y);
  diffuseColor.rgb *= mix(vec3(1.0), vec3(0.74, 0.75, 0.69), damp);
  estateGrime = max(estateGrime, damp * 0.7);
}
`;

/**
 * WHAT FACES THE SKY IS WEATHERED. The trim is honed (ExteriorModel, POLISH:
 * a soft sheen of the sky down every shaft and moulding), and a honed face
 * that lies level under a low sun, seen from the far side of it, is a mirror
 * at a grazing angle: on the revolve (leg 0.26 to 0.34, the sun 14 degrees up
 * behind the house) the top of every roof balustrade rail and pedestal cap
 * printed as a white strip, 2,458 pixels of the 1920 frame above a luma of
 * 225 — strip lighting along a parapet. MEASURED on the running build: with
 * the trim's roughness at full they are gone (289 pixels, the stone sunlit
 * and warm), and with the sun off there are none, so it is the sun's glint
 * and nothing in the stone's own light.
 *
 * A coping, a rail's top and a sill take the rain, the frost and the lichen
 * first; no mason's finish survives a season on them. So a face that looks at
 * the sky is as rough as weathered stone, by its own slope (`from`..`to` of
 * the face's upward share), and every upright face keeps its hone.
 */
export const SKY_FACE = { from: 0.5, to: 0.85, rough: 0.94 } as const;

// Dirty stone is matte: roughness follows the grime and the patina. The face's
// own normal is taken from the world position's derivatives, which point at
// the eye: a soffit seen from below looks down, and is left alone.
const STONE_ROUGH = /* glsl */ `
#include <roughnessmap_fragment>
roughnessFactor = clamp(roughnessFactor + 0.16 * estateGrime + 0.05 * ageNoise(vAgeWorld / 4.0), 0.04, 1.0);
{
  vec3 faceUp = normalize(cross(dFdx(vAgeWorld), dFdy(vAgeWorld)));
  float toSky = smoothstep(${SKY_FACE.from.toFixed(2)}, ${SKY_FACE.to.toFixed(2)}, faceUp.y);
  roughnessFactor = mix(roughnessFactor, max(roughnessFactor, ${SKY_FACE.rough.toFixed(2)}), toSky);
}
`;

/**
 * A SOFFIT IS LIT FROM BELOW, AND WHAT STANDS BELOW IT IS LIT STONE.
 *
 * The forensic audit of 2026-10-09 (#8): "A jet-black jagged line runs along
 * the pediment's sloping edge where two surfaces meet ... darker than any
 * shadow in the frame ... A pure black line on a sunlit stone house reads as
 * a modelling gap. Expected: a closed joint with a soft contact shadow."
 * Found on the running build by a ray through the black pixels of the
 * approach: they are the undersides of the raking cornice and of its bed
 * moulding, two pixels of each, at a luma of 5 against the 50 to 75 of the
 * mouldings either side.
 *
 * A face that looks down has one light in this picture: the hemisphere's
 * ground colour, "what the land throws back up under the soffits"
 * (WorldCanvas). The baked occlusion then took three quarters of that away
 * (0.2 to 0.3 on those undersides), because seen from a soffit most of the
 * world below IS shut out: by the cornice a hand under it. But that cornice
 * is not a hole in the light. It is pale stone in the same sun, nearer than
 * the lawn and brighter, and it is where a real soffit's light comes from.
 * Occlusion is the sky not reaching in (ExteriorModel, AO_STRENGTH), which
 * stays true at full strength; the bounce from below is not the sky.
 *
 * So on a baked face that looks down, the share of the ground's light that
 * the occlusion took is put back, by how squarely the face looks down: all of
 * it under a level soffit, none of it on a wall. Measured on the approach
 * with the occlusion off altogether, that is the most it can come to: the
 * same undersides at a luma of 24, a shadow line and not a gap.
 */
export const BOUNCE_UNDER_COVER = 1.0;

/**
 * AND A GABLE'S SOFFIT IS LIT BY THE TYMPANUM IT LEANS OVER.
 *
 * Each raking cornice ends underneath in one splayed soffit now (the model,
 * build_pediments: the two undersides it had were drawn from the cover as two
 * rows of dashes). It is a face of some size, and with the ground's light
 * alone it printed at a luma of 28 beside a tympanum at 171: from the cover a
 * heavy shadow, and from the orbit's side of the house, where the far rake's
 * soffit is seen almost square on, a dark triangle with the roundel half in
 * it. A soffit that leans over a wall is lit by that wall: the tympanum under
 * it stands in the sun or in the sky's light a hand away, and is pale stone.
 *
 * So above the cornice the house's walls end at (`from`, metres: the model's
 * CORNICE_TOP), a baked face that looks down AND leans out of its front takes
 * a share of the light the wall under it stands in: the sun as it falls on
 * that front, and the sky's and the ground's light on an upright face, off
 * stone of the house's colour (`stone`). The gables stand on the two fronts,
 * which face along z, so the wall under a soffit is the front its normal
 * leans out of along z. (Not the way the soffit leans as a whole: a raking
 * soffit leans down its rake as well, and the first build of this took that
 * for the wall's facing and lit the far rake by a sun it does not see: 4 of
 * luma.) By how squarely it looks down, and nothing on a soffit that does
 * not lean out. No cornice of the house below that height is touched: their
 * undersides are as they were measured and approved.
 */
export const GABLE_BOUNCE = { from: 9.42, share: 0.35, stone: [0.6, 0.55, 0.46] } as const;

const STONE_BOUNCE = /* glsl */ `
#include <aomap_fragment>
#if defined( USE_AOMAP ) && ( NUM_HEMI_LIGHTS > 0 )
{
  // Both in view space: the face's own normal, and which way is up.
  float under = saturate( -dot( geometryNormal, hemisphereLights[ 0 ].direction ) );
  vec3 fromBelow = hemisphereLights[ 0 ].groundColor * ( 0.5 + 0.5 * under );
  reflectedLight.indirectDiffuse += ${BOUNCE_UNDER_COVER.toFixed(2)} * ( 1.0 - ambientOcclusion ) * under * fromBelow * BRDF_Lambert( material.diffuseColor );
  #if NUM_DIR_LIGHTS > 0
  if ( vAgeWorld.y > ${GABLE_BOUNCE.from.toFixed(2)} && under > 0.0 ) {
    // In the world's own axes: the fronts face along z.
    vec3 gableN = inverseTransformDirection( geometryNormal, viewMatrix );
    float gableLean = abs( gableN.z );
    if ( gableLean > 0.08 ) {
      vec3 gableSun = inverseTransformDirection( directionalLights[ 0 ].direction, viewMatrix );
      vec3 gableWall = directionalLights[ 0 ].color * saturate( sign( gableN.z ) * gableSun.z )
        + 0.5 * ( hemisphereLights[ 0 ].skyColor + hemisphereLights[ 0 ].groundColor );
      reflectedLight.indirectDiffuse += ${GABLE_BOUNCE.share.toFixed(2)} * under * smoothstep( 0.08, 0.25, gableLean ) * gableWall * vec3( ${GABLE_BOUNCE.stone.map((v) => v.toFixed(2)).join(', ')} ) * BRDF_Lambert( material.diffuseColor );
    }
  }
  #endif
}
#endif
`;

const SLATE = /* glsl */ `
#include <color_fragment>
{
  vec3 w = vAgeWorld;
  float slate = ageHash(floor(vec3(w.x * 2.6, w.y * 3.6, w.z * 2.6)));
  float weather = ageNoise(w / 6.0);
  diffuseColor.rgb *= (0.88 + 0.24 * slate) * (1.0 + 0.1 * weather);
  diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(1.06, 1.04, 0.92), 0.4 * smoothstep(0.3, 0.9, weather));
}
`;

/**
 * THE WALKS ROUND THE HOUSE ARE PAVED (the user's reference of 2026-11-01: "paved stone
 * walkways around the courtyard"). The podium's walk and the rear walk to the canal are
 * the one mesh with the forecourt (build_estate_v7.py, drive_forecourt), and were its
 * polished dark stone: a dark sheet at the foot of the house. The forecourt stays polished
 * (the user's Feature 1 brief); these are laid in flags, `flag` metres in running bond,
 * each its own tone, by where they stand. In the world, like the ashlar.
 */
export const WALK = { flag: [0.6, 0.3] as const, joint: 0.012, tone: 0.2, depth: 0.55, colour: [0.46, 0.41, 0.34] as const, rough: 0.84 } as const;

const WALK_COLOUR = /* glsl */ `
#include <color_fragment>
float estateWalk = 0.0;
{
  vec3 w = vAgeWorld;
  estateWalk = max(step(abs(w.x), 17.5) * step(abs(w.z), 12.3), step(abs(w.x), 3.9) * step(w.z, -12.3) * step(-17.7, w.z));
  if (estateWalk > 0.5) {
    vec2 p = w.xz / vec2(${WALK.flag.map((v) => v.toFixed(2)).join(', ')});
    float row = floor(p.y);
    vec2 q = vec2(p.x + 0.5 * mod(row, 2.0), p.y);
    vec2 id = floor(q), f = fract(q);
    vec2 d = min(f, 1.0 - f) * vec2(${WALK.flag.map((v) => v.toFixed(2)).join(', ')});
    float px = max(length(fwidth(w.xz)), 1.0e-4);
    float joint = clamp((${(WALK.joint / 2).toFixed(4)} + 0.5 * px - min(d.x, d.y)) / px, 0.0, 1.0);
    float seen = 1.0 - smoothstep(0.08, 0.24, px);
    vec3 flag = vec3(${WALK.colour.map((v) => v.toFixed(2)).join(', ')});
    flag *= 1.0 + ${WALK.tone.toFixed(2)} * (ageHash(vec3(id, 3.0)) * 2.0 - 1.0) * max(seen, 0.3);
    flag *= mix(vec3(0.98, 0.99, 1.02), vec3(1.03, 1.0, 0.94), ageHash(vec3(id, 8.0)));
    flag *= 1.0 - ${WALK.depth.toFixed(2)} * joint * seen;
    diffuseColor.rgb = flag;
  }
}
`;

const WALK_ROUGH = /* glsl */ `
#include <roughnessmap_fragment>
roughnessFactor = mix(roughnessFactor, ${WALK.rough.toFixed(2)}, estateWalk);
`;

const SETT_COLOUR = /* glsl */ `
#include <color_fragment>
{
  vec2 g = vAgeWorld.xz;
  vec2 p = g / ${SETTS.size.toFixed(3)};
  float row = floor(p.y);
  vec2 q = vec2(p.x + 0.5 * mod(row, 2.0), p.y);
  vec2 id = floor(q), f = fract(q);
  vec2 d = min(f, 1.0 - f) * ${SETTS.size.toFixed(3)};
  float px = max(length(fwidth(g)), 1.0e-4);
  float joint = clamp((${(SETTS.joint / 2).toFixed(4)} + 0.5 * px - min(d.x, d.y)) / px, 0.0, 1.0);
  float seen = 1.0 - smoothstep(${SETTS.from.toFixed(2)}, ${SETTS.to.toFixed(2)}, px);
  diffuseColor.rgb *= 1.0 + ${SETTS.tone.toFixed(2)} * (ageHash(vec3(id, 3.0)) * 2.0 - 1.0) * seen;
  diffuseColor.rgb *= mix(vec3(1.0), vec3(0.95, 0.92, 0.88), ageHash(vec3(id, 8.0)));
  diffuseColor.rgb *= 1.0 - ${SETTS.depth.toFixed(2)} * joint * seen;
}
`;

const HEDGE_COLOUR = /* glsl */ `
#include <color_fragment>
{
  vec3 w = vAgeWorld;
  float leaf = ageNoise(w / 0.09), clump = ageNoise(w / 0.3 + 3.3), broad = ageNoise(w / 3.0);
  diffuseColor.rgb *= 0.78 + 0.22 * leaf + 0.18 * clump + 0.08 * broad;
  // Holes between leaves read as darker, bluer shade.
  diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.55, 0.62, 0.7), smoothstep(0.35, 0.8, -leaf) * 0.8);
  // Shaded at the foot, lit at the clipped top.
  diffuseColor.rgb *= mix(0.72, 1.0, smoothstep(0.0, 0.45, w.y)) * (1.0 + 0.12 * smoothstep(0.35, 0.9, w.y));
}
`;

const HEDGE_NORMAL = /* glsl */ `
#include <normal_fragment_maps>
{
  vec3 w = vAgeWorld;
  float e = 0.03;
  vec3 g = vec3(ageNoise((w + vec3(e, 0, 0)) / 0.09) - ageNoise((w - vec3(e, 0, 0)) / 0.09),
                ageNoise((w + vec3(0, e, 0)) / 0.09) - ageNoise((w - vec3(0, e, 0)) / 0.09),
                ageNoise((w + vec3(0, 0, e)) / 0.09) - ageNoise((w - vec3(0, 0, e)) / 0.09));
  float fw = length(fwidth(w));
  float keep = 1.0 - smoothstep(0.03, 0.12, fw);
  normal = normalize(normal + (viewMatrix * vec4(g * 0.9 * keep, 0.0)).xyz);
}
`;

type Kind = 'stone' | 'slate' | 'hedge' | 'setts' | 'drive';
const RULES: { re: RegExp; kind: Kind }[] = [
  { re: /^MAT_Stone_(Wall|Trim|Rustic|Boundary)(_AOG?)?$/, kind: 'stone' },
  { re: /^MAT_Roof(_Slate)?(_AO)?$/, kind: 'slate' },
  { re: /^MAT_Hedge$/, kind: 'hedge' },
  { re: /^MAT_Setts(_AOG)?$/, kind: 'setts' },
  { re: /^MAT_Drive_Polished(_AOG)?$/, kind: 'drive' },
];

/** Dress the estate's stone, roof and hedges. Returns how many per kind. */
export function dressSurfaces(root: THREE.Object3D): Record<Kind, number> {
  const count: Record<Kind, number> = { stone: 0, slate: 0, hedge: 0, setts: 0, drive: 0 };
  const done = new Set<THREE.Material>();
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      const mat = m as THREE.MeshStandardMaterial & { __aged?: boolean };
      if (!mat || mat.__aged || done.has(mat)) continue;
      const rule = RULES.find((r) => r.re.test(mat.name));
      if (!rule) continue;
      mat.__aged = true;
      done.add(mat);
      count[rule.kind] += 1;
      const kind = rule.kind;
      // The trim takes the stone's age but not the wall's ledge streaks.
      if (kind === 'stone' && /Trim/.test(mat.name)) mat.defines = { ...(mat.defines ?? {}), ESTATE_TRIM: '' };
      // The compound wall: none of the house's ledges, and one of its own.
      if (kind === 'stone' && /Boundary/.test(mat.name)) {
        mat.defines = { ...(mat.defines ?? {}), ESTATE_TRIM: '', ESTATE_BOUNDARY: '' };
      }
      // And the wall alone is laid in courses: the trim is carved, the base is
      // rusticated in its own geometry.
      if (kind === 'stone' && /Wall/.test(mat.name)) mat.defines = { ...(mat.defines ?? {}), ESTATE_ASHLAR: '' };
      const prev = mat.onBeforeCompile;
      mat.onBeforeCompile = (shader, renderer) => {
        prev.call(mat, shader, renderer);
        shader.vertexShader = shader.vertexShader
          .replace('void main() {', 'varying vec3 vAgeWorld;\nvoid main() {')
          .replace(
            '#include <begin_vertex>',
            `#include <begin_vertex>
             vAgeWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;`,
          );
        let frag = shader.fragmentShader.replace('void main() {', `${NOISE}\nvoid main() {`);
        if (kind === 'stone') {
          frag = frag
            .replace('#include <color_fragment>', STONE)
            .replace('#include <roughnessmap_fragment>', STONE_ROUGH)
            .replace('#include <normal_fragment_maps>', BOUNDARY_NORMAL)
            .replace('#include <aomap_fragment>', STONE_BOUNCE);
        }
        if (kind === 'slate') frag = frag.replace('#include <color_fragment>', SLATE);
        if (kind === 'setts') frag = frag.replace('#include <color_fragment>', SETT_COLOUR);
        if (kind === 'drive') {
          frag = frag.replace('#include <color_fragment>', WALK_COLOUR).replace('#include <roughnessmap_fragment>', WALK_ROUGH);
        }
        if (kind === 'hedge') {
          frag = frag
            .replace('#include <color_fragment>', HEDGE_COLOUR)
            .replace('#include <normal_fragment_maps>', HEDGE_NORMAL);
        }
        shader.fragmentShader = frag;
      };
      // Per kind; three still keys the aoMap/normalMap variants apart by
      // their own parameters.
      mat.customProgramCacheKey = () => `estate-aged-${kind}`;
      mat.needsUpdate = true;
    }
  });
  return count;
}
