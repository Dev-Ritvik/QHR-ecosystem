#!/usr/bin/env bash
# Build, export and ship the v7 estate, end to end.
#
#   bash tools/gltf/ship_estate_v7.sh            # full: textures, build, AO bake, export, ship, bounds
#   SKIP_BUILD=1 bash tools/gltf/ship_estate_v7.sh   # re-bake, re-export and ship an existing .blend
#   SKIP_BUILD=1 SKIP_AO=1 bash tools/gltf/ship_estate_v7.sh   # re-export only (the bake is in the .blend)
#
# Outputs:
#   C:/dev/Blender/mansion_estate_V7.blend            the source scene
#   apps/public/public/models/exterior_estate_v7.glb  what the site loads
#   apps/public/src/components/experience/estateBounds.ts   measured solids for the tests
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
BLENDER="${BLENDER:-C:/Program Files/Blender Foundation/Blender 5.2/blender.exe}"
BLEND="${BLEND:-C:/dev/Blender/mansion_estate_V7.blend}"
WORK="${WORK:-C:/dev/Blender/_v7out}"
GI_WORK="${GI_WORK:-C:/dev/Blender/_v7gi}"

if [ -z "${SKIP_BUILD:-}" ]; then
  python "$ROOT/tools/gltf/make_estate_textures_v7.py" "$ROOT/assets/materials/_v7"
  # AFTER the procedural textures, whose turf it replaces: the lawn from a
  # photograph of grass (the meadow HDRI the user supplied on 2026-10-27, in
  # "Royal audit", not in the repo). Without it the synthesised turf stands.
  LAWN_HDRI="${LAWN_HDRI:-$ROOT/Royal audit/189_hdrmaps_com_free_2K.exr}"
  if [ -f "$LAWN_HDRI" ]; then
    python "$ROOT/tools/gltf/make_lawn_hdri_v7.py" "$LAWN_HDRI" "$ROOT/assets/materials/_v7"
  fi
  # AFTER the procedural textures, whose flat leaf clusters it replaces: the
  # foliage cards rendered from modelled leaves (albedo + normal per species).
  "$BLENDER" --background --python "$ROOT/tools/blender/render_foliage_v7.py" -- "$ROOT/assets/materials/_v7" "" 1024 96
  # AFTER the procedural textures too: the stone, the flags and the gravel from
  # Poly Haven's CC0 scans (C:/dev/Blender/_polyhaven/textures, not in the
  # repo). Without them the synthesised stone stands and the build lays paving
  # where the gravel and the flags would be.
  if [ -f "${PH_DIR:-C:/dev/Blender/_polyhaven}/textures/floor_pebbles_01_diff_2k.jpg" ]; then
    python "$ROOT/tools/gltf/ph_surfaces_v7.py" "${PH_DIR:-C:/dev/Blender/_polyhaven}/textures" "$ROOT/assets/materials/_v7"
  fi
  # The shade trees from Poly Haven's CC0 scans (downloaded to C:/dev/Blender/
  # _polyhaven; ~360 MB, not in the repo). Without them the build falls back to
  # the procedural trees.
  if [ -d "${PH_DIR:-C:/dev/Blender/_polyhaven}/jacaranda_tree" ]; then
    "$BLENDER" --background --python "$ROOT/tools/blender/ph_trees_v7.py" -- "${PH_DIR:-C:/dev/Blender/_polyhaven}" "$ROOT/assets/materials/_v7" "${PH_DIR:-C:/dev/Blender/_polyhaven}/ph_trees_web.blend" 96
  fi
  # The trees grown from a branch hierarchy (grow_trees_v7.py, the refinement
  # brief of 2026-10-27): the canal's globe, the belt's mango, banyan and
  # tamarind and the coconut palm, each to its model in Royal audit; leaf
  # atlases from the scans' photographed leaves, a tileable Poly Haven bark
  # (PH_DIR/bark, not in the repo). Without them the canal's rows keep the
  # Tripo globe, the belt its scans and the groves the Tripo coconut.
  if [ -d "${PH_DIR:-C:/dev/Blender/_polyhaven}/bark" ]; then
    "$BLENDER" --background --python "$ROOT/tools/blender/grow_trees_v7.py" -- "$ROOT/assets/materials/_v7" "C:/dev/Blender/_trees/grown_trees_web.blend"
  fi
  # The fountain's fish refined from the client's generated betta (the same
  # brief; Royal audit, not in the repo). Without it the build places the
  # Tripo library's copy.
  FISH_SRC="${FISH_SRC:-$ROOT/Royal audit/betta fish 3d model.glb}"
  if [ -f "$FISH_SRC" ]; then
    "$BLENDER" --background --factory-startup --python "$ROOT/tools/blender/refine_fish_v7.py" -- "$FISH_SRC" "C:/dev/Blender/_fish/fish_web.blend"
  fi
  # The client's generated models (Tripo, saved to <repo>/tripo; not in the
  # repo): each one that is there is sized, lightened and filed in a library
  # the build places from. Without them the scripted cars stand.
  if ls "${TRIPO_DIR:-$ROOT/tripo}"/*.glb >/dev/null 2>&1; then
    "$BLENDER" --background --factory-startup --python "$ROOT/tools/blender/tripo_assets_v7.py" -- "${TRIPO_DIR:-$ROOT/tripo}" "C:/dev/Blender/_tripo/tripo_web.blend"
  fi
  "$BLENDER" --background --python "$ROOT/tools/blender/build_estate_v7.py" -- "$BLEND" arch land lux
fi
# Ambient occlusion: the architecture atlas and the top-down ground map, baked
# into the .blend (images packed, UV2 and the _AO/_AOG materials wired) so the
# export below carries them. ~15 minutes on a laptop GPU at full size.
if [ -z "${SKIP_AO:-}" ]; then
  "$BLENDER" --background "$BLEND" --python "$ROOT/tools/blender/bake_estate_ao_v7.py" -- "${AO_WORK:-C:/dev/Blender/_v7ao}"
  # The bounced light, the lamps and the rest of the sky (the brief of 2026-11-01), on the
  # same UV2, so after it. Its two atlases stay on disk: they are not in the .blend, and
  # attach_gi_maps.py below puts them in the file after the resize.
  mkdir -p "$GI_WORK"
  "$BLENDER" --background "$BLEND" --python "$ROOT/tools/blender/bake_estate_gi_v7.py" -- "$GI_WORK"
fi

rm -rf "$WORK" && mkdir -p "$WORK/ex"
"$BLENDER" --background "$BLEND" --python "$ROOT/tools/blender/export_estate_v7.py" -- "$WORK/estate_raw.glb"
( cd "$WORK"
  gltf-transform dedup estate_raw.glb a.glb
  gltf-transform prune a.glb b.glb
  gltf-transform copy b.glb ex/scene.gltf
  python "$ROOT/tools/gltf/fix_estate_materials_v7.py" ex/scene.gltf
  python "$ROOT/tools/gltf/resize_estate_textures_v7.py" ex/scene.gltf
  python "$ROOT/tools/gltf/attach_gi_maps.py" ex/scene.gltf "$GI_WORK/gi_arch.png" "$GI_WORK/gi_ground.png"
  python "$ROOT/tools/gltf/encode_ktx2.py" ex/scene.gltf
  gltf-transform copy ex/scene.gltf k.glb
  # (Positions at 16 bits, not Draco's 14: the ground runs 1.8 km and at 14
  # bits its vertices sat on an 11 cm grid, which brought the lawn up through
  # the forecourt laid 4 cm over it. +0.13 MB.)
  gltf-transform draco k.glb exterior_estate_v7.glb --quantize-position 16 )
cp "$WORK/exterior_estate_v7.glb" "$ROOT/apps/public/public/models/exterior_estate_v7.glb"
python "$ROOT/tools/gltf/estate_bounds_v7.py" "$WORK/b.glb" "$ROOT/apps/public/src/components/experience/estateBounds.ts"
ls -la "$ROOT/apps/public/public/models/exterior_estate_v7.glb"
