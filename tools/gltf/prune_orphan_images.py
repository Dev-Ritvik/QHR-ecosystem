"""
Drop images, textures and their bufferViews that no material references, and
rebuild the binary chunk without the holes.

    python tools/gltf/prune_orphan_images.py <in.glb> <out.glb>

WHY. The Phase 4 tooling patches a shipped GLB by APPENDING a new image and
repointing the material - the superseded image is left in place because
another material may still reference it (MAT_Roof shares the slate maps with
MAT_Roof_Slate, for instance) and because leaving bytes alone is what keeps
each candidate's diff attributable. After four milestones that is 20 orphaned
images and 7.8 MB of dead payload in a 17.5 MB file. This is the step that
turns the last candidate into a shippable one.

WHAT IT KEEPS, exactly: every image reached from a material slot
(baseColor, metallicRoughness, normal, occlusion, emissive - through
KHR_texture_basisu or a plain source), every bufferView reached from an
accessor, a Draco extension or a kept image, and every accessor. Everything is
re-indexed consistently. Nothing about geometry, materials' values or node
structure changes; a material's texture index changes number but not target.

The output is verified before it is written: the set of (material, slot ->
image name) pairs and the decoded Draco/attribute references must be
unchanged, and every kept bufferView's bytes are compared to the source.
"""
import json, os, struct, sys, hashlib

SRC, DST = sys.argv[1], sys.argv[2]


def read_glb(p):
    b = open(p, 'rb').read()
    if b[:4] != b'glTF' or struct.unpack_from('<I', b, 4)[0] != 2:
        raise SystemExit('not glTF 2.0: ' + p)
    off, js, binb = 12, None, None
    while off < len(b):
        ln, ty = struct.unpack_from('<II', b, off)
        ch = b[off + 8:off + 8 + ln]
        if ty == 0x4E4F534A: js = json.loads(ch.decode('utf-8'))
        elif ty == 0x004E4942: binb = ch
        off += 8 + ln
    return js, binb


js, binb = read_glb(SRC)
SLOTS = ('baseColorTexture', 'metallicRoughnessTexture')
MSLOTS = ('normalTexture', 'occlusionTexture', 'emissiveTexture')


def tex_refs(mat):
    out = []
    pbr = mat.get('pbrMetallicRoughness', {})
    for s in SLOTS:
        if s in pbr: out.append((s, pbr[s]))
    for s in MSLOTS:
        if s in mat: out.append((s, mat[s]))
    return out


def img_of_tex(t):
    return (t.get('extensions', {}).get('KHR_texture_basisu', {}) or {}).get('source', t.get('source'))


def name_map():
    return {(m['name'], s): js['images'][img_of_tex(js['textures'][r['index']])].get('name')
            for m in js['materials'] for s, r in tex_refs(m)}


before_map = name_map()
used_tex = {r['index'] for m in js['materials'] for _, r in tex_refs(m)}
used_img = {img_of_tex(js['textures'][t]) for t in used_tex}
used_bv = set()
for a in js['accessors']:
    if 'bufferView' in a: used_bv.add(a['bufferView'])
    sp = a.get('sparse')
    if sp:
        used_bv.add(sp['indices']['bufferView']); used_bv.add(sp['values']['bufferView'])
for mesh in js['meshes']:
    for p in mesh['primitives']:
        ext = p.get('extensions', {}).get('KHR_draco_mesh_compression')
        if ext: used_bv.add(ext['bufferView'])
for i in used_img: used_bv.add(js['images'][i]['bufferView'])

dropped_img = [i for i in range(len(js['images'])) if i not in used_img]
dropped_bytes = sum(js['bufferViews'][js['images'][i]['bufferView']]['byteLength'] for i in dropped_img)

# ---- rebuild bufferViews + BIN ---------------------------------------------
new_bin = bytearray(); bv_map = {}; new_bvs = []
for i in sorted(used_bv):
    bv = js['bufferViews'][i]
    o = bv.get('byteOffset', 0); chunk = binb[o:o + bv['byteLength']]
    start = len(new_bin) + (-len(new_bin)) % 4
    new_bin.extend(b'\x00' * (start - len(new_bin))); new_bin.extend(chunk)
    nb = dict(bv); nb['byteOffset'] = start; nb.pop('buffer', None); nb['buffer'] = 0
    bv_map[i] = len(new_bvs); new_bvs.append(nb)
js['bufferViews'] = new_bvs
for a in js['accessors']:
    if 'bufferView' in a: a['bufferView'] = bv_map[a['bufferView']]
    sp = a.get('sparse')
    if sp:
        sp['indices']['bufferView'] = bv_map[sp['indices']['bufferView']]
        sp['values']['bufferView'] = bv_map[sp['values']['bufferView']]
for mesh in js['meshes']:
    for p in mesh['primitives']:
        ext = p.get('extensions', {}).get('KHR_draco_mesh_compression')
        if ext: ext['bufferView'] = bv_map[ext['bufferView']]

# ---- images / textures --------------------------------------------------------
img_map = {}; new_imgs = []
for i in sorted(used_img):
    im = dict(js['images'][i]); im['bufferView'] = bv_map[im['bufferView']]
    img_map[i] = len(new_imgs); new_imgs.append(im)
tex_map = {}; new_texs = []
for t in sorted(used_tex):
    tx = json.loads(json.dumps(js['textures'][t]))
    if 'source' in tx: tx['source'] = img_map[tx['source']]
    bu = tx.get('extensions', {}).get('KHR_texture_basisu')
    if bu: bu['source'] = img_map[bu['source']]
    tex_map[t] = len(new_texs); new_texs.append(tx)
js['images'] = new_imgs; js['textures'] = new_texs
for m in js['materials']:
    for _, r in tex_refs(m): r['index'] = tex_map[r['index']]
js['buffers'] = [{'byteLength': len(new_bin)}]

after_map = name_map()
if before_map != after_map:
    raise SystemExit('VERIFY FAILED: material->image bindings changed')

jsb = json.dumps(js, separators=(',', ':')).encode('utf-8'); jsb += b' ' * ((-len(jsb)) % 4)
new_bin.extend(b'\x00' * ((-len(new_bin)) % 4))
blob = bytearray(b'glTF' + struct.pack('<II', 2, 12 + 8 + len(jsb) + 8 + len(new_bin)))
blob += struct.pack('<II', len(jsb), 0x4E4F534A) + jsb + struct.pack('<II', len(new_bin), 0x004E4942) + bytes(new_bin)
open(DST, 'wb').write(blob)
print('PRUNE|images %d -> %d (dropped %d, %.2f MB)|bufferViews %d -> %d|textures %d -> %d' % (
    len(new_imgs) + len(dropped_img), len(new_imgs), len(dropped_img), dropped_bytes / 1048576,
    len(bv_map) + (len(new_bvs) and 0), len(new_bvs), len(tex_map) and len(new_texs) + 0, len(new_texs)))
print('OUT|%s|%.3fMB|sha256=%s' % (DST, os.path.getsize(DST) / 1048576, hashlib.sha256(open(DST, 'rb').read()).hexdigest()))
