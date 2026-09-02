"""
Recover base-colour multipliers the glTF exporter cannot carry.

    python tools/gltf/bake_lost_basecolor.py <in.glb> <out.glb>

THE DEFECT. Blender's glTF exporter reads a base-colour chain only through the
newer `ShaderNodeMix`. The legacy `ShaderNodeMixRGB` is invisible to it: when a
chain ends in one, the exporter walks past it, takes whichever image texture it
finds and writes `baseColorFactor [1,1,1,1]`. Every multiplier in between is
silently dropped, and nothing in the export log says so.

MAT_Roof_Slate ends in two of them:

    Image Texture -> MixRGB MULTIPLY Fac 1.0, Color2 = (0.82, 0.86, 0.94)
                  -> MixRGB MULTIPLY Fac 0.5, Color2 = roofslate_ao.png
                  -> Principled BSDF.Base Color

so the shipped slate was its raw texture, 1.31x too bright in linear light.
`fix_stone_material_export.py` had already converted the five MAT_Stone_*
materials for exactly this reason; the roof was never in its hardcoded list.

WHY BAKE RATHER THAN REWIRE. Converting the nodes to `ShaderNodeMix` fixes the
first multiplier only. glTF core PBR has one factor and one texture for base
colour, and no texture-times-texture: it cannot express `texture x AO map` at
all. `occlusionTexture` is not that operator either - it attenuates INDIRECT
light and leaves the albedo alone. The product has to be resolved before the
file is written, so it is resolved here.

  * MixRGB MULTIPLY at factor f is lerp(C1, C1*C2, f) = C1 * (1 - f + f*C2).
    f = 0.5 is HALF-strength AO. Baking the map at full strength would double
    the occlusion the author asked for.
  * The maths runs in LINEAR light, which is where the node graph evaluates.
    Base colours are sRGB-encoded, so they are decoded first and re-encoded
    after; the AO map is Non-Color and is already linear. Multiplying the
    encoded values, or writing the linear result into an sRGB slot, would be
    wrong in opposite directions and neither is subtle.
  * The source textures are never modified. The derived map is written beside
    them as <name>_export.png.

WHY A NEW IMAGE RATHER THAN AN OVERWRITE. MAT_Roof and MAT_Roof_Slate share the
slate base colour. MAT_Roof's graph has neither multiplier, so its export was
already faithful and darkening it would introduce the error this removes. A new
image and texture are appended and only MAT_Roof_Slate is repointed.

WHY A PATCH RATHER THAN A RE-EXPORT. Re-exporting rebuilds every mesh and
re-encodes all 26 textures, so every material moves and nothing is attributable.
This copies the source GLB and changes one texture pointer: geometry, Draco
payloads and the other images stay byte-identical. The encode is proven
like-for-like by CONTROL below - re-encoding the ORIGINAL texture through the
same resize and `ktx create` must reproduce the bytes already in the file.

Not applied here, and deliberately:

  MAT_Wood_Dark loses a multiplier too - `MIX` at Fac 0.68 against a constant
  (0.255, 0.165, 0.1) - but that one makes Blender's albedo 3.30x BRIGHTER than
  the shipped texture, while the runtime already renders that surface 3.2x
  brighter than Blender. The two errors point opposite ways. Baking it would
  take the doors from 41.0 luma to 76.5 against Blender's 12.9 and triple the
  error. The dominant term there is missing contact occlusion on a recessed
  door, not albedo, so the albedo is left alone.

  MAT_Roof_Slate ALSO loses its roughness remap: Blender feeds the roughness
  map through a Map Range to 0.42..0.82 and the exporter, which cannot express
  that node either, emitted the raw map with the default factor 1.0. 85.1% of
  the roof renders glossier than authored, floor 0.118 against 0.467. That is a
  separate slot and a separate change; it is measured in FIXLOG, not fixed here.
"""
import json, os, struct, subprocess, shutil, sys, hashlib
import numpy as np
from PIL import Image

SRC, DST = sys.argv[1], sys.argv[2]
ASSETS = os.path.join(os.path.dirname(__file__), '..', '..', 'assets', 'materials')
ASSETS = os.path.abspath(ASSETS)
KTX = shutil.which('ktx') or r'C:\Program Files\KTX-Software\bin\ktx.exe'
if not os.path.exists(KTX) and not shutil.which('ktx'):
    raise SystemExit('ktx not found - install KTX-Software and put it on PATH')

# Pipeline constants. These are not free choices: optimize_textures.py caps the
# longest edge at 1024 with LANCZOS and saves PNG for the KTX2 path, and
# encode_ktx2.py encodes a baseColorTexture as ETC1S with the sRGB transfer
# function. The CONTROL below fails if either drifts.
MAXPX = 1024
KTX_BASECOLOR = ['--format', 'R8G8B8_SRGB', '--assign-tf', 'srgb',
                 '--generate-mipmap', '--encode', 'basis-lz', '--qlevel', '255']

MATERIAL = 'MAT_Roof_Slate'
TINT = np.array([0.82, 0.86, 0.94])   # MixRGB MULTIPLY, Fac 1.0
AO_FAC = 0.5                          # MixRGB MULTIPLY, Fac 0.5


def to_linear(u8):
    s = u8.astype(np.float64) / 255.0
    return np.where(s <= 0.04045, s / 12.92, ((s + 0.055) / 1.055) ** 2.4)


def to_srgb(lin):
    lin = np.clip(lin, 0.0, 1.0)
    s = np.where(lin <= 0.0031308, lin * 12.92, 1.055 * np.power(lin, 1 / 2.4) - 0.055)
    return np.clip(np.rint(s * 255.0), 0, 255).astype(np.uint8)


def pipeline_png(img, path):
    """Exactly what optimize_textures.py does to a colour map on the KTX2 path."""
    if max(img.size) > MAXPX:
        r = MAXPX / float(max(img.size))
        img = img.resize((max(1, int(img.width * r)), max(1, int(img.height * r))),
                         Image.LANCZOS)
    img.save(path, optimize=True)
    return path


def encode(png, ktx2):
    r = subprocess.run([KTX, 'create'] + KTX_BASECOLOR + [png, ktx2],
                       capture_output=True, text=True)
    if r.returncode != 0 or not os.path.exists(ktx2):
        raise SystemExit('ktx failed:\n' + r.stderr[-800:])
    return open(ktx2, 'rb').read()


def read_glb(path):
    b = open(path, 'rb').read()
    if b[:4] != b'glTF' or struct.unpack_from('<I', b, 4)[0] != 2:
        raise SystemExit('not a glTF 2.0 binary: ' + path)
    off, js, binb = 12, None, None
    while off < len(b):
        ln, ty = struct.unpack_from('<II', b, off)
        chunk = b[off + 8:off + 8 + ln]
        if ty == 0x4E4F534A:
            js = json.loads(chunk.decode('utf-8'))
        elif ty == 0x004E4942:
            binb = bytearray(chunk)
        off += 8 + ln
    if js is None or binb is None:
        raise SystemExit('missing JSON or BIN chunk')
    return js, binb


js, binb = read_glb(SRC)
work = os.path.join(os.path.dirname(os.path.abspath(DST)), '.bake_tmp')
os.makedirs(work, exist_ok=True)

# ---- bake ------------------------------------------------------------------
slate = os.path.join(ASSETS, 'roof_slate')
base = to_linear(np.asarray(Image.open(os.path.join(slate, 'basecolor.png')).convert('RGB')))
ao = np.asarray(Image.open(os.path.join(slate, 'ao.png')).convert('L'), np.float64) / 255.0
occ = (1.0 - AO_FAC) + AO_FAC * ao
out = base * TINT[None, None, :] * occ[..., None]
derived = os.path.join(slate, 'basecolor_export.png')
Image.fromarray(to_srgb(out)).save(derived, optimize=True)


def luma(a):
    return 0.2126 * a[..., 0] + 0.7152 * a[..., 1] + 0.0722 * a[..., 2]


print('BAKE|%s|tint_luma=%.4f|occ_mean=%.4f|linear x%.4f' % (
    MATERIAL, float(luma(TINT.reshape(1, 1, 3))[0, 0]), occ.mean(),
    luma(out).mean() / luma(base).mean()))

# ---- CONTROL: the same encode on the ORIGINAL must reproduce the shipped bytes
tex_i = None
for m in js['materials']:
    if m['name'] == MATERIAL:
        tex_i = m['pbrMetallicRoughness']['baseColorTexture']['index']
if tex_i is None:
    raise SystemExit('material not found: ' + MATERIAL)
t = js['textures'][tex_i]
img_i = (t.get('extensions', {}).get('KHR_texture_basisu', {}) or {}).get('source',
                                                                          t.get('source'))
bv = js['bufferViews'][js['images'][img_i]['bufferView']]
shipped = bytes(binb[bv.get('byteOffset', 0):bv.get('byteOffset', 0) + bv['byteLength']])

ctrl = encode(pipeline_png(Image.open(os.path.join(slate, 'basecolor.png')).convert('RGB'),
                           os.path.join(work, 'control.png')),
              os.path.join(work, 'control.ktx2'))
if ctrl != shipped:
    raise SystemExit(
        'CONTROL FAILED: re-encoding the original texture does not reproduce the\n'
        'bytes in %s (%d vs %d bytes). The resize or ktx settings above no longer\n'
        'match the pipeline that built it, so the substitution would not be\n'
        'like-for-like. Fix that before trusting this output.' % (
            os.path.basename(SRC), len(ctrl), len(shipped)))
print('CONTROL|original re-encode reproduces shipped bytes|sha256=%s' %
      hashlib.sha256(ctrl).hexdigest()[:32])

new = encode(pipeline_png(Image.open(derived).convert('RGB'),
                          os.path.join(work, 'fixed.png')),
             os.path.join(work, 'fixed.ktx2'))

# ---- patch -----------------------------------------------------------------
buf = js['buffers'][0]
start = buf['byteLength'] + (-buf['byteLength']) % 4
if len(binb) < start:
    binb.extend(b'\x00' * (start - len(binb)))
binb[start:start + len(new)] = new
buf['byteLength'] = start + len(new)

bv_i = len(js['bufferViews'])
js['bufferViews'].append({'buffer': 0, 'byteOffset': start, 'byteLength': len(new)})
new_img = len(js['images'])
js['images'].append({'name': 'roofslate_basecolor_export', 'mimeType': 'image/ktx2',
                     'bufferView': bv_i})
new_tex = len(js['textures'])
nt = {'extensions': {'KHR_texture_basisu': {'source': new_img}}}
if 'sampler' in t:
    nt['sampler'] = t['sampler']
for k, v in t.get('extensions', {}).items():
    if k != 'KHR_texture_basisu':
        nt['extensions'][k] = v
js['textures'].append(nt)
for m in js['materials']:
    if m['name'] == MATERIAL:
        m['pbrMetallicRoughness']['baseColorTexture']['index'] = new_tex

jsb = json.dumps(js, separators=(',', ':')).encode('utf-8')
jsb += b' ' * ((-len(jsb)) % 4)
binb.extend(b'\x00' * ((-len(binb)) % 4))
blob = bytearray(b'glTF' + struct.pack('<II', 2, 12 + 8 + len(jsb) + 8 + len(binb)))
blob += struct.pack('<II', len(jsb), 0x4E4F534A) + jsb
blob += struct.pack('<II', len(binb), 0x004E4942) + bytes(binb)
open(DST, 'wb').write(blob)
shutil.rmtree(work, ignore_errors=True)

print('PATCH|%s -> tex%d (image %d); MAT_Roof still on tex%d' %
      (MATERIAL, new_tex, new_img, tex_i))
print('OUT|%s|%.3fMB|sha256=%s' % (
    DST, os.path.getsize(DST) / 1048576.0,
    hashlib.sha256(open(DST, 'rb').read()).hexdigest()))
