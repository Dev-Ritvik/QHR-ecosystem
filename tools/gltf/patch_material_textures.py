"""
Manifest-driven material patch for a shipped GLB - the Phase 4 workhorse.

    python tools/gltf/patch_material_textures.py <base.glb> <manifest.json> <out.glb>

manifest.json:
{
  "MAT_Stone_Wall": {
    "baseColorTexture":         {"png": "assets/materials/_stone/limestone_basecolor.png"},
    "metallicRoughnessTexture": {"roughness_png": ".../limestone_roughness.png"},
    "normalTexture":            {"png": ".../limestone_normal.png", "scale": 0.85},
    "baseColorFactor": [0.7991, 0.7682, 0.7011, 1.0],
    "roughnessFactor": 1.0
  }
}

WHY THIS AND NOT A RE-EXPORT. Phase 2.5B established that the shipped file is
Draco + KTX2 and that a full pipeline run rebuilds all 381 meshes and 26+
textures at once, so nothing is attributable. This tool changes ONLY what the
manifest names: every other image, every accessor and the whole Draco payload
stay byte-identical, which is what lets a measurement be pinned to one change.

WHAT IT DOES PER SLOT. The PNG goes through the pipeline's own steps -
optimize_textures.py's LANCZOS resize to 1024 and encode_ktx2.py's `ktx create`
flags (ETC1S sRGB for base colour, ETC1S linear for metallicRoughness, UASTC
linear for normals) - and is appended as a NEW image + texture. The material
is repointed; the old image stays in the file (other materials may share it).
KHR_texture_transform on the old texture reference is carried across.

metallicRoughness packing follows what the exporter shipped and P2.5B decoded:
R=255 (unused), G=roughness, B=metallic (255 when there is no metallic map,
nulled by metallicFactor 0). A slot may give "roughness_png" and optionally
"metallic_png"; the tool packs them.

CONTROL. Before writing anything, for every material in the manifest, the
tool re-encodes the CURRENTLY bound source of any slot marked
"control_png" and asserts it reproduces the shipped bytes. That proves the
resize/encode path is the pipeline's, so the substitution is like-for-like.
Phase 2.5B did this per slot by hand; here it is part of the tool.

Colour spaces are never guessed: base colour is R8G8B8_SRGB/srgb, data maps
are R8G8B8_UNORM/linear, normals UASTC linear. Nothing is written if any check
fails.
"""
import json, os, struct, subprocess, shutil, sys, hashlib
from PIL import Image
import numpy as np

BASE, MANIFEST, OUT = sys.argv[1], sys.argv[2], sys.argv[3]
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
KTX = shutil.which('ktx') or r'C:\Program Files\KTX-Software\bin\ktx.exe'
if not os.path.exists(KTX) and not shutil.which('ktx'):
    raise SystemExit('ktx not found')
MAXPX = 1024
FLAGS = {
    'colour': ['--format', 'R8G8B8_SRGB', '--assign-tf', 'srgb', '--generate-mipmap',
               '--encode', 'basis-lz', '--qlevel', '255'],
    'data':   ['--format', 'R8G8B8_UNORM', '--assign-tf', 'linear', '--generate-mipmap',
               '--encode', 'basis-lz', '--qlevel', '255'],
    'normal': ['--format', 'R8G8B8_UNORM', '--assign-tf', 'linear', '--generate-mipmap',
               '--encode', 'uastc', '--zstd', '18'],
    # ETC1S for a normal map is normally the wrong trade: FIXLOG's v5etc1s
    # measurement found it quantises endpoints hard enough to facet visibly, and
    # every one of the twelve worst cells sat in the terrace paving - the only
    # large FLAT surface in shot. Foliage has no flat surface at all, which is
    # why P5J applies it there and nowhere else. Selected per slot with
    # "codec": "etc1s", never globally.
    'normal_etc1s': ['--format', 'R8G8B8_UNORM', '--assign-tf', 'linear', '--generate-mipmap',
                     '--encode', 'basis-lz', '--qlevel', '255', '--normal-mode'],
}
SLOT_KIND = {'baseColorTexture': 'colour', 'metallicRoughnessTexture': 'data',
             'normalTexture': 'normal', 'occlusionTexture': 'colour',
             'emissiveTexture': 'colour'}


def read_glb(p):
    b = open(p, 'rb').read()
    if b[:4] != b'glTF' or struct.unpack_from('<I', b, 4)[0] != 2:
        raise SystemExit('not glTF 2.0: ' + p)
    off, js, binb = 12, None, None
    while off < len(b):
        ln, ty = struct.unpack_from('<II', b, off)
        ch = b[off + 8:off + 8 + ln]
        if ty == 0x4E4F534A: js = json.loads(ch.decode('utf-8'))
        elif ty == 0x004E4942: binb = bytearray(ch)
        off += 8 + ln
    return js, binb


def resize(img):
    if max(img.size) <= MAXPX: return img
    r = MAXPX / float(max(img.size))
    return img.resize((max(1, int(img.width * r)), max(1, int(img.height * r))), Image.LANCZOS)


def encode(img, kind, stem, work):
    png = os.path.join(work, stem + '.png'); k2 = os.path.join(work, stem + '.ktx2')
    img.save(png, optimize=True)
    r = subprocess.run([KTX, 'create'] + FLAGS[kind] + [png, k2], capture_output=True, text=True)
    if r.returncode != 0 or not os.path.exists(k2):
        raise SystemExit('ktx failed on %s:\n%s' % (stem, r.stderr[-600:]))
    return open(k2, 'rb').read()


def pack_mr(rough_png, metal_png=None):
    g = np.asarray(Image.open(abspath(rough_png)).convert('L'))
    b = np.asarray(Image.open(abspath(metal_png)).convert('L').resize(g.shape[::-1], Image.LANCZOS)) \
        if metal_png else np.full_like(g, 255)
    return Image.fromarray(np.dstack([np.full_like(g, 255), g, b]), 'RGB')


def abspath(p):
    return p if os.path.isabs(p) else os.path.join(ROOT, p)


js, binb = read_glb(BASE)
man = json.load(open(MANIFEST))
work = os.path.join(os.path.dirname(os.path.abspath(OUT)), '.patch_tmp'); os.makedirs(work, exist_ok=True)
mats = {m['name']: m for m in js['materials']}


def tex_image(ti):
    t = js['textures'][ti]
    return t, (t.get('extensions', {}).get('KHR_texture_basisu', {}) or {}).get('source', t.get('source'))


def shipped(img_i):
    bv = js['bufferViews'][js['images'][img_i]['bufferView']]
    o = bv.get('byteOffset', 0); return bytes(binb[o:o + bv['byteLength']])


def append_image(payload, name, proto):
    buf = js['buffers'][0]; start = buf['byteLength'] + (-buf['byteLength']) % 4
    if len(binb) < start: binb.extend(b'\x00' * (start - len(binb)))
    binb[start:start + len(payload)] = payload; buf['byteLength'] = start + len(payload)
    js['bufferViews'].append({'buffer': 0, 'byteOffset': start, 'byteLength': len(payload)})
    js['images'].append({'name': name, 'mimeType': 'image/ktx2', 'bufferView': len(js['bufferViews']) - 1})
    nt = {'extensions': {'KHR_texture_basisu': {'source': len(js['images']) - 1}}}
    if proto and 'sampler' in proto: nt['sampler'] = proto['sampler']
    js['textures'].append(nt); return len(js['textures']) - 1


log = []
# ---- controls first: nothing is written unless every one passes ----------
for mname, spec in man.items():
    if mname not in mats: raise SystemExit('material not in GLB: ' + mname)
    m = mats[mname]; pbr = m.setdefault('pbrMetallicRoughness', {})
    for slot, s in spec.items():
        if not isinstance(s, dict) or 'control_png' not in s: continue
        ref = pbr.get(slot) if slot in ('baseColorTexture', 'metallicRoughnessTexture') else m.get(slot)
        if not ref: raise SystemExit('%s.%s has no texture to control against' % (mname, slot))
        _, img_i = tex_image(ref['index'])
        kind = SLOT_KIND[slot]
        src = pack_mr(s['control_png']) if slot == 'metallicRoughnessTexture' else Image.open(abspath(s['control_png'])).convert('RGB')
        got = encode(resize(src), kind, 'ctrl_%s_%s' % (mname, slot), work)
        if got != shipped(img_i):
            raise SystemExit('CONTROL FAILED %s.%s: re-encode of %s does not reproduce shipped image %d '
                             '(%d vs %d bytes)' % (mname, slot, s['control_png'], img_i, len(got), len(shipped(img_i))))
        log.append('CONTROL|%s.%s|reproduces img%d|%s' % (mname, slot, img_i, hashlib.sha256(got).hexdigest()[:16]))

# ---- apply ----------------------------------------------------------------
for mname, spec in man.items():
    m = mats[mname]; pbr = m['pbrMetallicRoughness']
    for slot, s in spec.items():
        if slot in ('baseColorFactor', 'roughnessFactor', 'metallicFactor'):
            old = pbr.get(slot); pbr[slot] = s; log.append('FACTOR|%s.%s|%s -> %s' % (mname, slot, old, s)); continue
        if slot in ('emissiveFactor', 'doubleSided', 'alphaMode', 'alphaCutoff'):
            old = m.get(slot); m[slot] = s; log.append('PROP|%s.%s|%s -> %s' % (mname, slot, old, s)); continue
        if slot == 'uv_scale':
            log.append('UV|%s|KHR_texture_transform scale %s on patched slots' % (mname, s)); continue
        if slot not in SLOT_KIND: raise SystemExit('unknown slot ' + slot)
        if not isinstance(s, dict) or ('png' not in s and 'roughness_png' not in s): continue
        kind = SLOT_KIND[slot]
        if slot == 'normalTexture' and s.get('codec') == 'etc1s': kind = 'normal_etc1s'
        img = pack_mr(s['roughness_png'], s.get('metallic_png')) if slot == 'metallicRoughnessTexture' \
            else Image.open(abspath(s['png'])).convert('RGB')
        payload = encode(resize(img), kind, 'new_%s_%s' % (mname, slot), work)
        holder = pbr if slot in ('baseColorTexture', 'metallicRoughnessTexture') else m
        old_ref = holder.get(slot)
        proto, old_img = tex_image(old_ref['index']) if old_ref else (None, None)
        ti = append_image(payload, '%s_%s_p4' % (mname, slot.replace('Texture', '')), proto)
        new_ref = {'index': ti}
        if old_ref:
            for k in ('texCoord', 'extensions'):
                if k in old_ref: new_ref[k] = old_ref[k]
            if slot == 'normalTexture' and 'scale' in old_ref: new_ref['scale'] = old_ref['scale']
            if slot == 'occlusionTexture' and 'strength' in old_ref: new_ref['strength'] = old_ref['strength']
        if slot == 'normalTexture' and 'scale' in s: new_ref['scale'] = s['scale']
        if slot == 'occlusionTexture' and 'strength' in s: new_ref['strength'] = s['strength']
        # A material-level "uv_scale" mirrors Blender's Mapping scale as
        # KHR_texture_transform, using the exporter's own convention: the V
        # flip lands as offset [0, 1 - scale]. Phase 2.5B/P4A found the shipped
        # wall carried the OLD 3.33 m marble tile (scale 0.3003) - a tile change
        # in Blender is invisible to the runtime unless this is rewritten too.
        if 'uv_scale' in spec:
            sc = float(spec['uv_scale'])
            new_ref.setdefault('extensions', {})['KHR_texture_transform'] = {'offset': [0.0, 1.0 - sc], 'scale': [sc, sc]}
        holder[slot] = new_ref
        log.append('TEX|%s.%s|img%s -> img%d (%s, %d bytes)' % (mname, slot, old_img, len(js['images']) - 1, kind, len(payload)))

jsb = json.dumps(js, separators=(',', ':')).encode('utf-8'); jsb += b' ' * ((-len(jsb)) % 4)
binb.extend(b'\x00' * ((-len(binb)) % 4))
blob = bytearray(b'glTF' + struct.pack('<II', 2, 12 + 8 + len(jsb) + 8 + len(binb)))
blob += struct.pack('<II', len(jsb), 0x4E4F534A) + jsb + struct.pack('<II', len(binb), 0x004E4942) + bytes(binb)
open(OUT, 'wb').write(blob); shutil.rmtree(work, ignore_errors=True)
for l in log: print(l)
print('OUT|%s|%.3fMB|sha256=%s' % (OUT, os.path.getsize(OUT) / 1048576, hashlib.sha256(open(OUT, 'rb').read()).hexdigest()))
