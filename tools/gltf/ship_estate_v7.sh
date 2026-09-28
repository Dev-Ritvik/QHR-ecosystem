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

if [ -z "${SKIP_BUILD:-}" ]; then
  python "$ROOT/tools/gltf/make_estate_textures_v7.py" "$ROOT/assets/materials/_v7"
  # AFTER the procedural textures, whose flat leaf clusters it replaces: the
  # foliage cards rendered from modelled leaves (albedo + normal per species).
  "$BLENDER" --background --python "$ROOT/tools/blender/render_foliage_v7.py" -- "$ROOT/assets/materials/_v7" "" 1024 96
  # The shade trees from Poly Haven's CC0 scans (downloaded to C:/dev/Blender/
  # _polyhaven; ~360 MB, not in the repo). Without them the build falls back to
  # the procedural trees.
  if [ -d "${PH_DIR:-C:/dev/Blender/_polyhaven}/jacaranda_tree" ]; then
    "$BLENDER" --background --python "$ROOT/tools/blender/ph_trees_v7.py" -- "${PH_DIR:-C:/dev/Blender/_polyhaven}" "$ROOT/assets/materials/_v7" "${PH_DIR:-C:/dev/Blender/_polyhaven}/ph_trees_web.blend" 96
  fi
  "$BLENDER" --background --python "$ROOT/tools/blender/build_estate_v7.py" -- "$BLEND" arch land lux
fi
# Ambient occlusion: the architecture atlas and the top-down ground map, baked
# into the .blend (images packed, UV2 and the _AO/_AOG materials wired) so the
# export below carries them. ~15 minutes on a laptop GPU at full size.
if [ -z "${SKIP_AO:-}" ]; then
  "$BLENDER" --background "$BLEND" --python "$ROOT/tools/blender/bake_estate_ao_v7.py" -- "${AO_WORK:-C:/dev/Blender/_v7ao}"
fi

rm -rf "$WORK" && mkdir -p "$WORK/ex"
"$BLENDER" --background "$BLEND" --python "$ROOT/tools/blender/export_estate_v7.py" -- "$WORK/estate_raw.glb"
( cd "$WORK"
  gltf-transform dedup estate_raw.glb a.glb
  gltf-transform prune a.glb b.glb
  gltf-transform copy b.glb ex/scene.gltf
  python "$ROOT/tools/gltf/fix_estate_materials_v7.py" ex/scene.gltf
  python "$ROOT/tools/gltf/resize_estate_textures_v7.py" ex/scene.gltf
  python "$ROOT/tools/gltf/encode_ktx2.py" ex/scene.gltf
  gltf-transform copy ex/scene.gltf k.glb
  gltf-transform draco k.glb exterior_estate_v7.glb )
cp "$WORK/exterior_estate_v7.glb" "$ROOT/apps/public/public/models/exterior_estate_v7.glb"
python "$ROOT/tools/gltf/estate_bounds_v7.py" "$WORK/b.glb" "$ROOT/apps/public/src/components/experience/estateBounds.ts"
ls -la "$ROOT/apps/public/public/models/exterior_estate_v7.glb"
