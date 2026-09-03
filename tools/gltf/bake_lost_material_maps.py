"""
Recover material maps the glTF exporter cannot carry.

    python tools/gltf/bake_lost_material_maps.py <in.glb> <out.glb>

THE DEFECT CLASS. Blender's glTF exporter reads a shader chain only through the
node types it understands. Anything else in the path is walked past in silence:
the exporter takes whichever image texture it finds at the end and writes the
default factor, and nothing in the export log says a multiplier went missing.
MAT_Roof_Slate loses two chains this way, in two different slots.

  BASE COLOUR. Blender computes

      texture x (0.82, 0.86, 0.94) x (0.5 + 0.5 x AO)

  as two legacy `ShaderNodeMixRGB` nodes. Only the newer `ShaderNodeMix` is
  read, so the slate shipped as its raw texture with baseColorFactor
  [1,1,1,1] - 1.31x too bright in linear light. `fix_stone_material_export.py`
  had already converted the five MAT_Stone_* materials for this reason; the
  roof was never in its hardcoded list.

  ROUGHNESS. Blender feeds the roughness map through a `Map Range` node,
  0..1 -> 0.42..0.82, LINEAR interpolation and clamped. Map Range is not
  exportable either, so the raw map shipped with the default factor 1.0 and
  85.2% of the roof renders glossier than authored - floor 0.188 against
  0.489, and a ceiling of 1.000 against an authored hard limit of 0.82.

WHY BAKING, AND WHY THE FACTOR IS NOT ENOUGH ON ITS OWN.

  glTF gives base colour one factor and one texture, and no texture-times-
  texture, so `texture x AO map` cannot be written at all. `occlusionTexture`
  is not that operator: it attenuates INDIRECT light and leaves albedo alone.

  glTF roughness is `roughnessFactor x texture.G` - a pure MULTIPLY. Blender's
  remap is AFFINE, `0.42 + 0.40 x r`. No factor can produce the 0.42 floor, so
  a roughnessFactor alone is not a fix; the offset has to go into the texture.

  Which leaves a choice, settled by measurement rather than by taste. Writing
  the whole span into G with factor 1.0 costs precision (85 levels of 8-bit
  across 0.42..0.82) and, worse, lets ETC1S noise push the result to 0.847 -
  ABOVE the authored ceiling that Map Range's clamp makes hard. Normalising the
  texture and putting the ceiling in the factor keeps 104 levels and caps the
  result at 0.82 by construction. Measured against the float ideal, per texel:

      v5 as shipped              mean |err| 0.11218   max 0.309   -> 1.000
      factor 1.00, span in G     mean |err| 0.00869   max 0.135   -> 0.847
      factor 0.82, G normalised  mean |err| 0.00815   max 0.131   -> 0.820

  so ROUGHNESS_CEILING goes in the factor. VERIFY below re-checks this on every
  run and refuses to write a file that drifts.

  The remap is applied AFTER the pipeline resize, not before. It is affine and
  LANCZOS is linear with unit-sum weights, so the two orders agree in float -
  but resizing first keeps the full 8-bit range through the filter and only
  then compresses it, which is the more precise order.

WHY NEW IMAGES RATHER THAN OVERWRITES. MAT_Roof and MAT_Roof_Slate share BOTH
the slate base colour and the packed metallicRoughness image. MAT_Roof's graph
has neither base-colour multiplier, and its roughness Math node is MULTIPLY by
1.0 - an identity - so its export was already faithful in both slots and
editing the shared images would introduce the errors this removes. New images
are appended and only MAT_Roof_Slate is repointed.

WHY A PATCH RATHER THAN A RE-EXPORT. Re-exporting rebuilds every mesh and
re-encodes all 26 textures, so every material moves and nothing is
attributable. This copies the source GLB and changes two texture pointers:
geometry, Draco payloads and the other images stay byte-identical. Each encode
is proven like-for-like by CONTROL - re-encoding the ORIGINAL map through the
same resize and `ktx create` must reproduce the bytes already in the file.

Diagnosed and deliberately NOT applied:

  MAT_Wood_Dark loses a base-colour multiplier too - `MIX` at Fac 0.68 against
  a constant (0.255, 0.165, 0.1) - but that one makes Blender's albedo 3.30x
  BRIGHTER than the shipped texture, while the runtime already renders that
  surface 3.2x brighter than Blender. The two errors point opposite ways.
  Baking it would take the doors from 41.0 luma to 76.5 against Blender's 12.9
  and triple the error. The dominant term there is missing contact occlusion on
  a recessed door, not albedo. Its roughness Math node is MULTIPLY by 1.0, an
  identity, so that slot is already faithful.
"""
import json, os, struct, subprocess, shutil, sys, hashlib
import numpy as np
from PIL import Image

SRC, DST = sys.argv[1], sys.argv[2]
ASSETS = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..',
                                      'assets', 'materials'))
KTX = shutil.which('ktx') or r'C:\Program Files\KTX-Software\bin\ktx.exe'
if not os.path.exists(KTX) and not shutil.which('ktx'):
    raise SystemExit('ktx not found - install KTX-Software and put it on PATH')

# Pipeline constants. Not free choices: optimize_textures.py caps the longest
# edge at 1024 with LANCZOS and saves PNG on the KTX2 path, and encode_ktx2.py
# encodes colour slots sRGB and data slots linear, ETC1S either way. The
# CONTROL for each slot fails if any of this drifts.
MAXPX = 1024
KTX_COLOUR = ['--format', 'R8G8B8_SRGB', '--assign-tf', 'srgb',
              '--generate-mipmap', '--encode', 'basis-lz', '--qlevel', '255']
KTX_DATA = ['--format', 'R8G8B8_UNORM', '--assign-tf', 'linear',
            '--generate-mipmap', '--encode', 'basis-lz', '--qlevel', '255']

MATERIAL = 'MAT_Roof_Slate'
TINT = np.array([0.82, 0.86, 0.94])   # MixRGB MULTIPLY, Fac 1.0
AO_FAC = 0.5                          # MixRGB MULTIPLY, Fac 0.5
ROUGH_FLOOR, ROUGH_CEIL = 0.42, 0.82  # Map Range To Min / To Max, LINEAR, clamped
SLATE = os.path.join(ASSETS, 'roof_slate')


def to_linear(u8):
    s = u8.astype(np.float64) / 255.0
    return np.where(s <= 0.04045, s / 12.92, ((s + 0.055) / 1.055) ** 2.4)


def to_srgb(lin):
    lin = np.clip(lin, 0.0, 1.0)
    s = np.where(lin <= 0.0031308, lin * 12.92, 1.055 * np.power(lin, 1 / 2.4) - 0.055)
    return np.clip(np.rint(s * 255.0), 0, 255).astype(np.uint8)


def luma(a):
    return 0.2126 * a[..., 0] + 0.7152 * a[..., 1] + 0.0722 * a[..., 2]


def resize(img):
    """The pipeline's own resize, from optimize_textures.py."""
    if max(img.size) <= MAXPX:
        return img
    r = MAXPX / float(max(img.size))
    return img.resize((max(1, int(img.width * r)), max(1, int(img.height * r))),
                      Image.LANCZOS)


def encode(img, flags, stem, work):
    png = os.path.join(work, stem + '.png')
    ktx2 = os.path.join(work, stem + '.ktx2')
    img.save(png, optimize=True)
    r = subprocess.run([KTX, 'create'] + flags + [png, ktx2],
                       capture_output=True, text=True)
    if r.returncode != 0 or not os.path.exists(ktx2):
        raise SystemExit('ktx failed on %s:\n%s' % (stem, r.stderr[-800:]))
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

mat = next((m for m in js['materials'] if m['name'] == MATERIAL), None)
if mat is None:
    raise SystemExit('material not found: ' + MATERIAL)
pbr = mat['pbrMetallicRoughness']


def image_of(tex_index):
    t = js['textures'][tex_index]
    return t, (t.get('extensions', {}).get('KHR_texture_basisu', {}) or {}).get(
        'source', t.get('source'))


def shipped_bytes(img_index):
    bv = js['bufferViews'][js['images'][img_index]['bufferView']]
    o = bv.get('byteOffset', 0)
    return bytes(binb[o:o + bv['byteLength']])


def control(name, img_index, rebuilt, flags, stem):
    got = encode(rebuilt, flags, stem, work)
    want = shipped_bytes(img_index)
    if got != want:
        raise SystemExit(
            'CONTROL FAILED (%s): re-encoding the original map does not reproduce\n'
            'the bytes in %s (%d vs %d). The resize or ktx settings above no longer\n'
            'match the pipeline that built it, so the substitution would not be\n'
            'like-for-like. Fix that before trusting this output.' % (
                name, os.path.basename(SRC), len(got), len(want)))
    print('CONTROL|%s|original re-encode reproduces shipped bytes|sha256=%s'
          % (name, hashlib.sha256(got).hexdigest()[:32]))


# ---- BASE COLOUR -----------------------------------------------------------
bc_tex_i = pbr['baseColorTexture']['index']
bc_t, bc_img_i = image_of(bc_tex_i)
bc_src = Image.open(os.path.join(SLATE, 'basecolor.png')).convert('RGB')
control('baseColor', bc_img_i, resize(bc_src), KTX_COLOUR, 'ctrl_bc')

base = to_linear(np.asarray(bc_src))
ao = np.asarray(Image.open(os.path.join(SLATE, 'ao.png')).convert('L'), np.float64) / 255.0
# MixRGB MULTIPLY at factor f is lerp(C1, C1*C2, f) = C1 * (1 - f + f*C2).
# f = 0.5 is HALF-strength AO; baking the map at full strength would double the
# occlusion the author asked for.
occ = (1.0 - AO_FAC) + AO_FAC * ao
baked = base * TINT[None, None, :] * occ[..., None]
bc_derived = os.path.join(SLATE, 'basecolor_export.png')
Image.fromarray(to_srgb(baked)).save(bc_derived, optimize=True)
print('BAKE|baseColor|tint_luma=%.4f|occ_mean=%.4f|linear x%.4f'
      % (float(luma(TINT.reshape(1, 1, 3))[0, 0]), occ.mean(),
         luma(baked).mean() / luma(base).mean()))
bc_new = encode(resize(Image.open(bc_derived).convert('RGB')), KTX_COLOUR, 'new_bc', work)

# ---- ROUGHNESS -------------------------------------------------------------
mr_tex_i = pbr['metallicRoughnessTexture']['index']
mr_t, mr_img_i = image_of(mr_tex_i)
if 'roughnessFactor' in pbr and pbr['roughnessFactor'] != 1.0:
    raise SystemExit('unexpected roughnessFactor %r - the remap below assumes the '
                     'exporter left it at the 1.0 default' % pbr['roughnessFactor'])
rough = np.asarray(Image.open(os.path.join(SLATE, 'roughness.png')).convert('L'))
# Blender packs the unused ORM channels white and nulls them with the factors:
# metallicFactor is 0 so B is inert, and there is no occlusionTexture so R is
# unused. Verified by decoding the shipped image, whose R and B are both 255.
def pack(g):
    return Image.fromarray(np.dstack([np.full_like(g, 255), g, np.full_like(g, 255)]), 'RGB')

control('metallicRoughness', mr_img_i, resize(pack(rough)), KTX_DATA, 'ctrl_mr')

g = np.asarray(resize(pack(rough)))[..., 1].astype(np.float64) / 255.0
ideal = ROUGH_FLOOR + (ROUGH_CEIL - ROUGH_FLOOR) * g
g_new = np.clip(np.rint((ideal / ROUGH_CEIL) * 255.0), 0, 255).astype(np.uint8)
mr_derived = os.path.join(SLATE, 'metallicroughness_export.png')
pack(g_new).save(mr_derived, optimize=True)
mr_new = encode(pack(g_new), KTX_DATA, 'new_mr', work)

# VERIFY the representation end to end, through the actual encoder, before the
# file is written. Transcodes what will ship and compares it to the float ideal.
probe = os.path.join(work, 'verify_mr.ktx2')
open(probe, 'wb').write(mr_new)
r = subprocess.run([KTX, 'extract', '--level', '0', probe,
                    os.path.join(work, 'verify_mr.png')], capture_output=True, text=True)
if r.returncode != 0:
    raise SystemExit('ktx extract failed:\n' + r.stderr[-800:])
got = ROUGH_CEIL * np.asarray(Image.open(os.path.join(work, 'verify_mr.png')
                                          ).convert('RGB'))[..., 1].astype(np.float64) / 255.0
err = np.abs(got - ideal)
print('BAKE|roughness|MapRange %.2f..%.2f -> roughnessFactor %.2f x normalised G'
      % (ROUGH_FLOOR, ROUGH_CEIL, ROUGH_CEIL))
print('VERIFY|roughness|mean|err| %.5f  rms %.5f  max %.5f  range %.3f..%.3f '
      '(ideal %.3f..%.3f)' % (err.mean(), float(np.sqrt((err * err).mean())), err.max(),
                              got.min(), got.max(), ideal.min(), ideal.max()))
if err.mean() > 0.02 or got.max() > ROUGH_CEIL + 1e-9:
    raise SystemExit('VERIFY FAILED: the encoded roughness does not reproduce the '
                     'authored remap (mean |err| %.5f, max value %.5f against a '
                     'ceiling of %.2f).' % (err.mean(), got.max(), ROUGH_CEIL))

# ---- patch -----------------------------------------------------------------
def append_image(payload, name, proto_tex):
    buf = js['buffers'][0]
    start = buf['byteLength'] + (-buf['byteLength']) % 4
    if len(binb) < start:
        binb.extend(b'\x00' * (start - len(binb)))
    binb[start:start + len(payload)] = payload
    buf['byteLength'] = start + len(payload)
    bv_i = len(js['bufferViews'])
    js['bufferViews'].append({'buffer': 0, 'byteOffset': start,
                              'byteLength': len(payload)})
    img_i = len(js['images'])
    js['images'].append({'name': name, 'mimeType': 'image/ktx2', 'bufferView': bv_i})
    tex_i = len(js['textures'])
    nt = {'extensions': {'KHR_texture_basisu': {'source': img_i}}}
    if 'sampler' in proto_tex:
        nt['sampler'] = proto_tex['sampler']
    for k, v in proto_tex.get('extensions', {}).items():
        if k != 'KHR_texture_basisu':
            nt['extensions'][k] = v
    js['textures'].append(nt)
    return img_i, tex_i


bc_img_new, bc_tex_new = append_image(bc_new, 'roofslate_basecolor_export', bc_t)
mr_img_new, mr_tex_new = append_image(mr_new, 'roofslate_metallicroughness_export', mr_t)
pbr['baseColorTexture']['index'] = bc_tex_new
pbr['metallicRoughnessTexture']['index'] = mr_tex_new
pbr['roughnessFactor'] = ROUGH_CEIL

jsb = json.dumps(js, separators=(',', ':')).encode('utf-8')
jsb += b' ' * ((-len(jsb)) % 4)
binb.extend(b'\x00' * ((-len(binb)) % 4))
blob = bytearray(b'glTF' + struct.pack('<II', 2, 12 + 8 + len(jsb) + 8 + len(binb)))
blob += struct.pack('<II', len(jsb), 0x4E4F534A) + jsb
blob += struct.pack('<II', len(binb), 0x004E4942) + bytes(binb)
open(DST, 'wb').write(blob)
shutil.rmtree(work, ignore_errors=True)

print('PATCH|%s baseColor tex%d -> tex%d, metallicRoughness tex%d -> tex%d, '
      'roughnessFactor %.2f' % (MATERIAL, bc_tex_i, bc_tex_new, mr_tex_i, mr_tex_new,
                                ROUGH_CEIL))
print('PATCH|MAT_Roof still on tex%d / tex%d' % (bc_tex_i, mr_tex_i))
print('OUT|%s|%.3fMB|sha256=%s' % (DST, os.path.getsize(DST) / 1048576.0,
                                   hashlib.sha256(open(DST, 'rb').read()).hexdigest()))
