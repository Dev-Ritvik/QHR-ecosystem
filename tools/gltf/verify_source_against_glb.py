"""
Prove a source PNG on disk is still the one a shipped GLB was built from.

    python tools/gltf/verify_source_against_glb.py <glb> <image-name>=<png> [...]

WHY THIS EXISTS. assets/ is gitignored (1.9 GB of source art), so `git status`
cannot tell you whether a generator has quietly rewritten a texture that a
locked candidate depends on. The GLB is the authority: it carries the KTX2 the
material actually samples. This runs the PNG through the pipeline's own resize
and encode - the same steps patch_material_textures.py uses - and compares the
result to the bytes in the file. Identical means the source is intact; a
mismatch means the source has drifted and the GLB is now the only correct copy.

This is the same control patch_material_textures.py applies per slot; it is
factored out here so it can be run on its own, after the fact, on any source.
"""
import json, os, struct, subprocess, shutil, sys, hashlib, tempfile
from PIL import Image

GLB = sys.argv[1]
PAIRS = [a.split('=', 1) for a in sys.argv[2:]]
KTX = shutil.which('ktx') or r'C:\Program Files\KTX-Software\bin\ktx.exe'
MAXPX = 1024
FLAGS = {
    'colour': ['--format', 'R8G8B8_SRGB', '--assign-tf', 'srgb', '--generate-mipmap',
               '--encode', 'basis-lz', '--qlevel', '255'],
    'data':   ['--format', 'R8G8B8_UNORM', '--assign-tf', 'linear', '--generate-mipmap',
               '--encode', 'basis-lz', '--qlevel', '255'],
    'normal': ['--format', 'R8G8B8_UNORM', '--assign-tf', 'linear', '--generate-mipmap',
               '--encode', 'uastc', '--zstd', '18'],
}


def read_glb(p):
    b = open(p, 'rb').read()
    off, js, binb = 12, None, None
    while off < len(b):
        ln, ty = struct.unpack_from('<II', b, off)
        ch = b[off + 8:off + 8 + ln]
        if ty == 0x4E4F534A: js = json.loads(ch.decode('utf-8'))
        elif ty == 0x004E4942: binb = ch
        off += 8 + ln
    return js, binb


def kind_of(js, img_i):
    """Which encode profile this image was written with, from how it is bound."""
    for m in js['materials']:
        pbr = m.get('pbrMetallicRoughness', {})
        slots = [('baseColorTexture', pbr.get('baseColorTexture')),
                 ('metallicRoughnessTexture', pbr.get('metallicRoughnessTexture')),
                 ('normalTexture', m.get('normalTexture')),
                 ('occlusionTexture', m.get('occlusionTexture')),
                 ('emissiveTexture', m.get('emissiveTexture'))]
        for name, ref in slots:
            if not ref: continue
            t = js['textures'][ref['index']]
            src = (t.get('extensions', {}).get('KHR_texture_basisu', {}) or {}).get('source', t.get('source'))
            if src == img_i:
                return {'normalTexture': 'normal', 'metallicRoughnessTexture': 'data'}.get(name, 'colour')
    return None


def encode(png, kind, metallic_png=None):
    im = Image.open(png)
    tmp = tempfile.mkdtemp()
    src = os.path.join(tmp, 'src.png')
    if max(im.size) > MAXPX:
        s = MAXPX / max(im.size)
        im = im.resize((max(1, round(im.width * s)), max(1, round(im.height * s))), Image.LANCZOS)
    if kind == 'data':
        # A metallicRoughness slot is PACKED, not a grey image: the exporter
        # shipped R=255 (unused), G=roughness, B=metallic, and metallicFactor 0
        # nulls B where there is no metal map. Comparing a plain L->RGB encode
        # of the roughness PNG against that reads as drift when nothing has
        # drifted, so the packing is reproduced here exactly as
        # patch_material_textures.py writes it.
        import numpy as np
        g = np.asarray(im.convert('L'))
        b = np.full_like(g, 255)
        if metallic_png:
            mi = Image.open(metallic_png)
            if mi.size != im.size: mi = mi.resize(im.size, Image.LANCZOS)
            b = np.asarray(mi.convert('L'))
        im = Image.fromarray(np.stack([np.full_like(g, 255), g, b], -1), 'RGB')
    im.convert('RGB').save(src)
    k2 = os.path.join(tmp, 'out.ktx2')
    r = subprocess.run([KTX, 'create'] + FLAGS[kind] + [src, k2], capture_output=True, text=True)
    if r.returncode != 0:
        raise SystemExit('ktx failed: ' + r.stderr[:400])
    return open(k2, 'rb').read()


js, binb = read_glb(GLB)
names = {im.get('name'): i for i, im in enumerate(js['images'])}
fail = 0
for pair in PAIRS:
    name, png = pair
    metallic = None
    if '+' in png:                      # "rough.png+metal.png" for a packed slot
        png, metallic = png.split('+', 1)
    if name not in names:
        print('MISSING  image %r is not in %s' % (name, os.path.basename(GLB))); fail += 1; continue
    i = names[name]
    bv = js['bufferViews'][js['images'][i]['bufferView']]
    shipped = binb[bv.get('byteOffset', 0):bv.get('byteOffset', 0) + bv['byteLength']]
    kind = kind_of(js, i)
    got = encode(png, kind, metallic)
    ok = got == shipped
    print('%-8s %-40s %-7s shipped %7d B sha %s' % ('MATCH' if ok else 'DRIFT', name, kind,
          len(shipped), hashlib.sha256(shipped).hexdigest()[:16]))
    if not ok:
        print('%-8s %-40s %-7s re-enc  %7d B sha %s   <- SOURCE HAS DRIFTED'
              % ('', os.path.basename(png), '', len(got), hashlib.sha256(got).hexdigest()[:16]))
        fail += 1
raise SystemExit(fail and 1 or 0)
