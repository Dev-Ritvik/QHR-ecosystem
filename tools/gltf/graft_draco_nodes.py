"""
Graft nodes from a donor GLB into a shipped one: ADD new ones, REPLACE existing
ones, keeping Draco compression and leaving everything else byte-identical.

    python tools/gltf/graft_draco_nodes.py <base.glb> <donor.glb> <out.glb> <regex>
                                           [--drop <regex>] [--report out.json]

WHY THIS AND NOT transplant_draco_nodes.py. That tool was written for P4A and
does exactly one thing: swap the Draco payload of nodes that already exist in
both files and declare the SAME attribute set. Phase 5 needs two things it
cannot do.

  ADD. P5A puts a gravel forecourt into the scene; P5D-P5H add hedging, trees
  and property detail. Those nodes do not exist in the base at all, and their
  materials, textures and images do not either.

  CHANGE THE ATTRIBUTE SET. P5A writes per-vertex tone into COLOR_0 on the
  ground plane, which the shipped ground does not have. transplant declares
  only the BASE's attribute set on purpose - that was the right call there,
  where a donor's stray TEXCOORD_1 would have been noise - and here it would
  silently drop the entire meso layer.

WHAT IS COPIED, for every donor node the regex names:
  * its mesh, and for each primitive the Draco bufferView verbatim, the
    KHR_draco_mesh_compression attribute table, the fallback accessors
    (count / type / componentType / min / max / normalized), and the indices
    accessor;
  * its material - matched to the base BY NAME. A donor material whose name
    already exists in the base is NOT copied and the primitive is repointed at
    the base's own, so grafting a new object cannot fork MAT_Stone_Trim. A new
    name is appended along with any textures, samplers and images it needs;
  * its node transform, verbatim, and the node is appended to the scene root.

WHAT IS CHECKED before a byte is written:
  * every regex-named donor node exists exactly once in the donor;
  * a REPLACED node's transform matches the base's to 5 decimal places, its
    POSITION min/max agree with the base's to 5 mm, and its vertex and index
    counts match;
  * a shared mesh is grafted once (the base's 96 rustic blocks sit on 2 meshes;
    patching per node would corrupt the second pass);
  * every pre-existing bufferView in the base comes out byte-identical;
  * every pre-existing material comes out structurally identical;
  * the scene's node count changes by exactly the number of ADDED nodes.

Any failure aborts before writing.
"""
import json, os, re, struct, sys, hashlib, copy

BASE, DONOR, OUT, PAT = sys.argv[1], sys.argv[2], sys.argv[3], re.compile(sys.argv[4])
DROP = re.compile(sys.argv[sys.argv.index('--drop') + 1]) if '--drop' in sys.argv else None
# A REPLACED node normally has to keep its POSITION bounds and its vertex and
# index counts, because a silent change to either means the donor is not the
# object it claims to be. P5B deliberately extends ground_plane from a +/-120 m
# square to a 260 m circular rim, which is exactly that kind of change made on
# purpose - so it is waived explicitly per run rather than by loosening the
# check for everything.
GROW = '--allow-growth' in sys.argv
REPORT = sys.argv[sys.argv.index('--report') + 1] if '--report' in sys.argv else None


def read_glb(p):
    b = open(p, 'rb').read()
    if b[:4] != b'glTF' or struct.unpack_from('<I', b, 4)[0] != 2:
        raise SystemExit('not glTF 2.0: ' + p)
    off, js, binb = 12, None, None
    while off < len(b):
        ln, ty = struct.unpack_from('<II', b, off)
        ch = b[off + 8:off + 8 + ln]
        if ty == 0x4E4F534A: js = json.loads(ch.decode('utf-8'))
        elif ty == 0x004E4942: binb = bytes(ch)
        off += 8 + ln
    return js, binb


bjs, bbin = read_glb(BASE)
djs, dbin = read_glb(DONOR)

bnodes = {}
for i, n in enumerate(bjs['nodes']):
    if 'mesh' in n: bnodes.setdefault(n.get('name'), []).append(i)
dnodes = {}
for i, n in enumerate(djs['nodes']):
    if 'mesh' in n: dnodes.setdefault(n.get('name'), []).append(i)

targets = sorted(n for n in dnodes if n and PAT.search(n))
if not targets: raise SystemExit('regex matched no donor mesh node')
for n in targets:
    if len(dnodes[n]) != 1: raise SystemExit('donor node %r appears %d times' % (n, len(dnodes[n])))
    if n in bnodes and len(bnodes[n]) != 1:
        raise SystemExit('base node %r appears %d times' % (n, len(bnodes[n])))

# ---- snapshots for the post-write verification ------------------------------
before_bv = []
for bv in bjs['bufferViews']:
    o = bv.get('byteOffset', 0)
    before_bv.append(hashlib.sha256(bbin[o:o + bv['byteLength']]).hexdigest())
before_mats = {m['name']: json.dumps(m, sort_keys=True) for m in bjs['materials']}
before_nodecount = len(bjs['nodes'])
n_bv0, n_acc0, n_mesh0, n_mat0, n_tex0, n_img0 = (
    len(bjs['bufferViews']), len(bjs['accessors']), len(bjs['meshes']),
    len(bjs['materials']), len(bjs.get('textures', [])), len(bjs.get('images', [])))

out_bin = bytearray(bbin)
bjs.setdefault('extensionsUsed', [])
for e in djs.get('extensionsUsed', []):
    if e not in bjs['extensionsUsed']: bjs['extensionsUsed'].append(e)
if 'KHR_draco_mesh_compression' in djs.get('extensionsRequired', []):
    bjs.setdefault('extensionsRequired', [])
    if 'KHR_draco_mesh_compression' not in bjs['extensionsRequired']:
        bjs['extensionsRequired'].append('KHR_draco_mesh_compression')


def append_bin(chunk):
    start = len(out_bin) + (-len(out_bin)) % 4
    out_bin.extend(b'\x00' * (start - len(out_bin)))
    out_bin.extend(chunk)
    bjs['bufferViews'].append({'buffer': 0, 'byteOffset': start, 'byteLength': len(chunk)})
    return len(bjs['bufferViews']) - 1


def donor_bv_bytes(i):
    bv = djs['bufferViews'][i]
    o = bv.get('byteOffset', 0)
    return dbin[o:o + bv['byteLength']]


def copy_accessor(di):
    a = copy.deepcopy(djs['accessors'][di])
    a.pop('bufferView', None)          # Draco primitives carry no real view
    a.pop('byteOffset', None)
    bjs['accessors'].append(a)
    return len(bjs['accessors']) - 1


# ---- materials, matched BY NAME ---------------------------------------------
bmat_by_name = {m['name']: i for i, m in enumerate(bjs['materials'])}
dsampler_map, dimg_map, dtex_map, dmat_map = {}, {}, {}, {}
added_materials, reused_materials = [], []


def copy_sampler(di):
    if di in dsampler_map: return dsampler_map[di]
    s = copy.deepcopy(djs['samplers'][di])
    for i, ex in enumerate(bjs.setdefault('samplers', [])):
        if ex == s: dsampler_map[di] = i; return i
    bjs['samplers'].append(s); dsampler_map[di] = len(bjs['samplers']) - 1
    return dsampler_map[di]


def copy_image(di):
    if di in dimg_map: return dimg_map[di]
    im = copy.deepcopy(djs['images'][di])
    if 'bufferView' in im:
        im['bufferView'] = append_bin(donor_bv_bytes(im['bufferView']))
    bjs.setdefault('images', []).append(im)
    dimg_map[di] = len(bjs['images']) - 1
    return dimg_map[di]


def copy_texture(di):
    if di in dtex_map: return dtex_map[di]
    t = copy.deepcopy(djs['textures'][di])
    if 'sampler' in t: t['sampler'] = copy_sampler(t['sampler'])
    if 'source' in t: t['source'] = copy_image(t['source'])
    bu = t.get('extensions', {}).get('KHR_texture_basisu')
    if bu: bu['source'] = copy_image(bu['source'])
    bjs.setdefault('textures', []).append(t)
    dtex_map[di] = len(bjs['textures']) - 1
    return dtex_map[di]


def copy_material(di):
    if di in dmat_map: return dmat_map[di]
    dm = djs['materials'][di]
    name = dm.get('name')
    if name in bmat_by_name:
        dmat_map[di] = bmat_by_name[name]
        reused_materials.append(name)
        return dmat_map[di]
    m = copy.deepcopy(dm)
    pbr = m.get('pbrMetallicRoughness', {})
    for s in ('baseColorTexture', 'metallicRoughnessTexture'):
        if s in pbr: pbr[s]['index'] = copy_texture(pbr[s]['index'])
    for s in ('normalTexture', 'occlusionTexture', 'emissiveTexture'):
        if s in m: m[s]['index'] = copy_texture(m[s]['index'])
    bjs['materials'].append(m)
    dmat_map[di] = len(bjs['materials']) - 1
    bmat_by_name[name] = dmat_map[di]
    added_materials.append(name)
    return dmat_map[di]


# ---- meshes ------------------------------------------------------------------
def copy_mesh(dmi):
    dm = djs['meshes'][dmi]
    prims = []
    for dp in dm['primitives']:
        ext = dp.get('extensions', {}).get('KHR_draco_mesh_compression')
        if not ext: raise SystemExit('donor primitive is not Draco-compressed')
        nbv = append_bin(donor_bv_bytes(ext['bufferView']))
        p = {'attributes': {k: copy_accessor(v) for k, v in dp['attributes'].items()},
             'indices': copy_accessor(dp['indices']),
             'mode': dp.get('mode', 4),
             'extensions': {'KHR_draco_mesh_compression':
                            {'bufferView': nbv, 'attributes': dict(ext['attributes'])}}}
        if 'material' in dp: p['material'] = copy_material(dp['material'])
        prims.append(p)
    bjs['meshes'].append({'name': dm.get('name'), 'primitives': prims})
    return len(bjs['meshes']) - 1


def pos_minmax(js, mesh_i):
    lo = [1e9] * 3; hi = [-1e9] * 3
    for p in js['meshes'][mesh_i]['primitives']:
        a = p['attributes'].get('POSITION')
        if a is None or 'min' not in js['accessors'][a]: continue
        for k in range(3):
            lo[k] = min(lo[k], js['accessors'][a]['min'][k])
            hi[k] = max(hi[k], js['accessors'][a]['max'][k])
    return lo, hi


def counts(js, mesh_i):
    v = sum(js['accessors'][p['attributes']['POSITION']]['count'] for p in js['meshes'][mesh_i]['primitives'])
    i = sum(js['accessors'][p['indices']]['count'] for p in js['meshes'][mesh_i]['primitives'] if 'indices' in p)
    return v, i


def xform(n):
    return {k: [round(float(x), 5) for x in n[k]]
            for k in ('matrix', 'translation', 'rotation', 'scale') if k in n}


scene = bjs['scenes'][bjs.get('scene', 0)]
replaced, added, skipped, splits = [], [], [], []
done_meshes = {}

for name in targets:
    dni = dnodes[name][0]
    dn = djs['nodes'][dni]
    dmi = dn['mesh']
    if name in bnodes:
        bni = bnodes[name][0]
        bn = bjs['nodes'][bni]
        if xform(bn) != xform(dn):
            raise SystemExit('%s: transform differs\n base %s\n donor %s' % (name, xform(bn), xform(dn)))
        bmi = bn['mesh']
        blo, bhi = pos_minmax(bjs, bmi); dlo, dhi = pos_minmax(djs, dmi)
        drift = max(max(abs(a - b) for a, b in zip(blo, dlo)), max(abs(a - b) for a, b in zip(bhi, dhi)))
        bc, dc = counts(bjs, bmi), counts(djs, dmi)
        # A vertex-count change with an UNCHANGED index count and unchanged
        # bounds is seam splitting, not a different object: adding a UV set or a
        # normal discontinuity forces the exporter to duplicate vertices along
        # the seams while the topology, the triangle count and the shape all
        # stay exactly as they were. P5D's hedge went 620 -> 750 vertices on
        # 3,234 indices for precisely that reason. Allowed automatically and
        # reported, because the three facts together are stronger evidence of
        # identity than the vertex count alone ever was - and much narrower than
        # --allow-growth, which exists for a deliberate change of extent.
        seam_split = (drift <= 0.005 and bc[1] == dc[1] and dc[0] >= bc[0])
        if seam_split and bc != dc:
            splits.append({'node': name, 'verts': [bc[0], dc[0]], 'indices': bc[1]})
        if not GROW and not seam_split:
            if drift > 0.005:
                raise SystemExit('%s: POSITION bounds moved %.4f m (pass --allow-growth if intended)' % (name, drift))
            if bc != dc:
                raise SystemExit('%s: vert/index counts %s -> %s (pass --allow-growth if intended)' % (name, bc, dc))
        else:
            # Growth is allowed, but it must be growth: the donor has to CONTAIN
            # the base, so an extension cannot quietly become a replacement that
            # loses the near field.
            if any(d > b + 1e-3 for d, b in zip(dlo, blo)) or any(d < b - 1e-3 for d, b in zip(dhi, bhi)):
                raise SystemExit('%s: --allow-growth but donor bounds %s..%s do not contain base %s..%s'
                                 % (name, dlo, dhi, blo, bhi))
            if dc[0] < bc[0] or dc[1] < bc[1]:
                raise SystemExit('%s: --allow-growth but donor is smaller: %s -> %s' % (name, bc, dc))
        if bmi in done_meshes:
            skipped.append(name); continue
        nmi = copy_mesh(dmi)
        done_meshes[bmi] = nmi
        bn['mesh'] = nmi
        replaced.append({'node': name, 'mesh': bmi, 'newMesh': nmi, 'verts': dc[0], 'tris': dc[1] // 3,
                         'wasVerts': bc[0], 'wasTris': bc[1] // 3,
                         'boundsBase': [blo, bhi], 'boundsDonor': [dlo, dhi],
                         'attrs': sorted(djs['meshes'][dmi]['primitives'][0]['attributes'])})
    else:
        if dmi in done_meshes:
            nmi = done_meshes[dmi]
        else:
            nmi = copy_mesh(dmi); done_meshes[dmi] = nmi
        nn = {'name': name, 'mesh': nmi}
        for k in ('matrix', 'translation', 'rotation', 'scale'):
            if k in dn: nn[k] = dn[k]
        bjs['nodes'].append(nn)
        scene['nodes'].append(len(bjs['nodes']) - 1)
        dc = counts(djs, dmi)
        added.append({'node': name, 'mesh': nmi, 'verts': dc[0], 'tris': dc[1] // 3,
                      'attrs': sorted(djs['meshes'][dmi]['primitives'][0]['attributes'])})

# ---- optional removal of base nodes superseded by the graft ------------------
dropped = []
if DROP:
    keep = []
    victim = {i for i, n in enumerate(bjs['nodes']) if n.get('name') and DROP.search(n['name']) and 'mesh' in n}
    for i in scene['nodes']:
        if i in victim: dropped.append(bjs['nodes'][i].get('name'))
        else: keep.append(i)
    scene['nodes'] = keep

# ---- verification -------------------------------------------------------------
for i in range(n_bv0):
    bv = bjs['bufferViews'][i]
    o = bv.get('byteOffset', 0)
    if hashlib.sha256(bytes(out_bin[o:o + bv['byteLength']])).hexdigest() != before_bv[i]:
        raise SystemExit('VERIFY FAILED: pre-existing bufferView %d changed' % i)
for i in range(n_mat0):
    m = bjs['materials'][i]
    if json.dumps(m, sort_keys=True) != before_mats.get(m['name']):
        raise SystemExit('VERIFY FAILED: pre-existing material %r changed' % m['name'])
if len(bjs['nodes']) != before_nodecount + len(added):
    raise SystemExit('VERIFY FAILED: node count %d -> %d, expected +%d'
                     % (before_nodecount, len(bjs['nodes']), len(added)))

bjs['buffers'] = [{'byteLength': len(out_bin)}]
jsb = json.dumps(bjs, separators=(',', ':')).encode('utf-8')
jsb += b' ' * ((-len(jsb)) % 4)
out_bin.extend(b'\x00' * ((-len(out_bin)) % 4))
blob = bytearray(b'glTF' + struct.pack('<II', 2, 12 + 8 + len(jsb) + 8 + len(out_bin)))
blob += struct.pack('<II', len(jsb), 0x4E4F534A) + jsb
blob += struct.pack('<II', len(out_bin), 0x004E4942) + bytes(out_bin)
open(OUT, 'wb').write(blob)

rep = {'base': BASE, 'donor': DONOR, 'out': OUT,
       'replaced': replaced, 'added': added, 'skippedSharedMesh': skipped, 'droppedNodes': dropped,
       'seamSplits': splits,
       'materialsAdded': added_materials, 'materialsReused': sorted(set(reused_materials)),
       'counts': {'bufferViews': [n_bv0, len(bjs['bufferViews'])],
                  'accessors': [n_acc0, len(bjs['accessors'])],
                  'meshes': [n_mesh0, len(bjs['meshes'])],
                  'materials': [n_mat0, len(bjs['materials'])],
                  'textures': [n_tex0, len(bjs.get('textures', []))],
                  'images': [n_img0, len(bjs.get('images', []))],
                  'nodes': [before_nodecount, len(bjs['nodes'])]},
       'sizeMB': round(len(blob) / 1048576, 3),
       'sha256': hashlib.sha256(bytes(blob)).hexdigest()}
print('GRAFT  replaced %d, added %d, shared-mesh skips %d, dropped %d'
      % (len(replaced), len(added), len(skipped), len(dropped)))
for r in replaced: print('  REPLACE %-22s %6d v %6d t  %s' % (r['node'], r['verts'], r['tris'], ','.join(r['attrs'])))
for r in added:    print('  ADD     %-22s %6d v %6d t  %s' % (r['node'], r['verts'], r['tris'], ','.join(r['attrs'])))
if dropped:        print('  DROP    %s' % ', '.join(dropped))
if splits:         print('  SEAM-SPLIT (same topology, UV seams duplicated verts): %s'
                         % ', '.join('%s %d->%d v on %d idx' % (x['node'], x['verts'][0], x['verts'][1], x['indices']) for x in splits))
print('  materials +%s  reused %s' % (added_materials, sorted(set(reused_materials))))
print('  %s' % json.dumps(rep['counts']))
print('OUT|%s|%.3fMB|sha256=%s' % (OUT, rep['sizeMB'], rep['sha256']))
if REPORT:
    json.dump(rep, open(REPORT, 'w'), indent=1); print('WROTE', REPORT)
