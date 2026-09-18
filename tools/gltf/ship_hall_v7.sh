#!/usr/bin/env bash
# Export and ship the extended hall (the client review's "bigger, taller, wider,
# and importantly longer" applied to the interior), from a baked .blend.
#
#   bash tools/gltf/ship_hall_v7.sh
#   BLEND=C:/dev/Blender/mansion_web_V7HALL.blend BAKE=<dir with lightmap_manifest.json> \
#     bash tools/gltf/ship_hall_v7.sh
#
# The bake comes first and is NOT run here, because it is the long step and it
# writes the manifest this reads:
#
#   blender --background mansion_web.blend --python tools/blender/extend_hall_v7.py -- OUT.blend
#   blender --background OUT.blend --python tools/blender/bake_lightmap.py -- BAKE 4096 512 1500 OUT.blend 2048
#
# Outputs:
#   apps/public/public/models/interior_hall.glb   what the site loads
#   and prints the bake's normalisation divisor, which HallModel.tsx carries as
#   LIGHTMAP_INTENSITY and interior_hall.manifest.json records.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
BLENDER="${BLENDER:-C:/Program Files/Blender Foundation/Blender 5.2/blender.exe}"
BLEND="${BLEND:-C:/dev/Blender/mansion_web_V7HALL.blend}"
BAKE="${BAKE:-C:/dev/Blender/_v7hall_bake}"
WORK="${WORK:-C:/dev/Blender/_v7hallout}"

test -f "$BAKE/lightmap_manifest.json" || { echo "no bake manifest in $BAKE"; exit 1; }

rm -rf "$WORK" && mkdir -p "$WORK/ex"
"$BLENDER" --background "$BLEND" --python "$ROOT/tools/blender/export_web_interior.py" \
  -- "$BAKE/lightmap_manifest.json" "$WORK/hall_raw.glb"
( cd "$WORK"
  gltf-transform dedup hall_raw.glb a.glb
  gltf-transform prune a.glb b.glb
  gltf-transform copy b.glb ex/scene.gltf
  python "$ROOT/tools/gltf/fix_ranges.py" ex/scene.gltf
  python "$ROOT/tools/gltf/optimize_textures.py" ex/scene.gltf 1024 4096 png
  # Every KTX2 level must be a multiple of four on both axes or the compressed
  # upload fails at runtime; the resize above can land on odd sizes.
  python "$ROOT/tools/gltf/round4_textures.py" ex/scene.gltf
  python "$ROOT/tools/gltf/encode_ktx2.py" ex/scene.gltf
  gltf-transform copy ex/scene.gltf k.glb
  gltf-transform draco k.glb interior_hall.glb )
cp "$WORK/interior_hall.glb" "$ROOT/apps/public/public/models/interior_hall.glb"
python - "$BAKE/lightmap_manifest.json" <<'PY'
import json, sys
m = json.load(open(sys.argv[1]))
print("LIGHTMAP_INTENSITY|%s|shell=%d objects|%d tris|drawn=%d tris"
      % (m["lightmap_scale"], len(m["shell_objects"]), m["shell_tris"], m["drawn_tris"]))
PY
ls -la "$ROOT/apps/public/public/models/interior_hall.glb"
