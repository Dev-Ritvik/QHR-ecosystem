"""
Replace one node's mesh geometry in a GLB with geometry from a donor GLB.

    python tools/gltf/transplant_mesh.py <base.glb> <donor.glb> <nodeName> <out.glb>

WHY THIS EXISTS. `mansion_roof` ships with 936 of its 1873 faces wound the wrong
way. Cycles does not care - it shades whichever side a ray lands on - so the
Blender render looks correct and the defect is invisible in the reference. glTF
materials carry `doubleSided`, and this one is `false` because the Blender
material has Backface Culling ON, so three.js culls exactly those faces and the
viewer sees straight through the roof to the wall behind it. At the hero camera
that is 8,684 pixels, 16.9% of the roof's screen area.

The fix belongs in the mesh, not the material: setting `doubleSided` would hide
the symptom while leaving the winding - and therefore the tangent basis the
normal map is sampled in - still mirrored on half the roof.

WHY A TRANSPLANT RATHER THAN A FULL RE-EXPORT. Re-exporting the scene rebuilds
all 381 meshes and re-encodes all 26 textures, so every material moves at once
and no measurement is attributable to the change under test. Worse, the shipped
file is Draco-compressed, and gltf-transform warns that decoding and re-encoding
is lossy - a full round trip would perturb geometry everywhere to fix one mesh.

So the donor primitive is written UNCOMPRESSED into the base file and only that
primitive drops KHR_draco_mesh_compression. Every other primitive keeps its
original Draco payload byte for byte, and the extension stays in
extensionsRequired because they still use it. The old Draco bufferView for the
replaced primitive is left in the buffer as dead bytes rather than reindexing
every accessor in the file to reclaim them.

The donor must be a single-node, single-primitive GLB exported with the same
flags export_web.py uses for geometry (export_apply, export_yup, no Draco), so
the vertex data lands in the same space. Both node transforms are checked to be
identity and the bounding boxes are compared before anything is written.
"""
import json, os, struct, sys

BASE, DONOR, NODE, OUT = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4]

CT = {5120: ('b', 1), 5121: ('B', 1), 5122: ('h', 2), 5123: ('H', 2),
      5125: ('I', 4), 5126: ('f', 4)}
NC = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4}


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
        raise SystemExit('missing JSON or BIN chunk: ' + path)
    return js, binb


def raw(js, binb, acc_i):
    """Return (bytes, componentType, type, count) for an accessor, de-strided."""
    a = js['accessors'][acc_i]
    bv = js['bufferViews'][a['bufferView']]
    fmt, sz = CT[a['componentType']]
    n = NC[a['type']]
    packed = sz * n
    stride = bv.get('byteStride') or packed
    base = bv.get('byteOffset', 0) + a.get('byteOffset', 0)
    if stride == packed:
        out = bytes(binb[base:base + packed * a['count']])
    else:
        out = b''.join(bytes(binb[base + k * stride: base + k * stride + packed])
                       for k in range(a['count']))
    return out, a['componentType'], a['type'], a['count'], a.get('min'), a.get('max')


base_js, base_bin = read_glb(BASE)
don_js, don_bin = read_glb(DONOR)

hit = [i for i, n in enumerate(base_js['nodes']) if n.get('name') == NODE]
if len(hit) != 1:
    raise SystemExit('expected exactly one node named %r in base, found %d' % (NODE, len(hit)))
bnode = base_js['nodes'][hit[0]]
bmesh = base_js['meshes'][bnode['mesh']]
if len(bmesh['primitives']) != 1:
    raise SystemExit('base mesh has %d primitives; this tool handles one'
                     % len(bmesh['primitives']))
bprim = bmesh['primitives'][0]

dhit = [i for i, n in enumerate(don_js['nodes']) if n.get('name') == NODE]
if len(dhit) != 1:
    raise SystemExit('expected exactly one node named %r in donor' % NODE)
dnode = don_js['nodes'][dhit[0]]
dmesh = don_js['meshes'][dnode['mesh']]
if len(dmesh['primitives']) != 1:
    raise SystemExit('donor mesh has %d primitives; this tool handles one'
                     % len(dmesh['primitives']))
dprim = dmesh['primitives'][0]

for tag, n in (('base', bnode), ('donor', dnode)):
    moved = [k for k in ('matrix', 'translation', 'rotation', 'scale') if k in n]
    if moved:
        raise SystemExit('%s node %r carries a transform %s; the transplant assumes '
                         'both are identity so the donor lands in the same space'
                         % (tag, NODE, moved))

if sorted(bprim['attributes']) != sorted(dprim['attributes']):
    raise SystemExit('attribute sets differ: base %s vs donor %s'
                     % (sorted(bprim['attributes']), sorted(dprim['attributes'])))

_, _, _, _, bmin, bmax = raw(base_js, base_bin, bprim['attributes']['POSITION']) \
    if base_js['accessors'][bprim['attributes']['POSITION']].get('bufferView') is not None \
    else (None, None, None, None,
          base_js['accessors'][bprim['attributes']['POSITION']].get('min'),
          base_js['accessors'][bprim['attributes']['POSITION']].get('max'))
dacc = don_js['accessors'][dprim['attributes']['POSITION']]
dmin, dmax = dacc.get('min'), dacc.get('max')
if bmin and dmin:
    slip = max(abs(a - b) for a, b in zip(bmin + bmax, dmin + dmax))
    print('CHECK|bbox agreement base vs donor: %.6f m' % slip)
    if slip > 0.005:
        raise SystemExit('donor bounding box differs from base by %.4f m - that is a '
                         'different mesh, not a re-orientation of the same one' % slip)


def append(payload, target=None):
    start = len(base_bin) + (-len(base_bin)) % 4
    base_bin.extend(b'\x00' * (start - len(base_bin)))
    base_bin.extend(payload)
    bv = {'buffer': 0, 'byteOffset': start, 'byteLength': len(payload)}
    if target is not None:
        bv['target'] = target
    base_js['bufferViews'].append(bv)
    return len(base_js['bufferViews']) - 1


new_attrs = {}
for name, ai in sorted(dprim['attributes'].items()):
    data, ctype, atype, count, amin, amax = raw(don_js, don_bin, ai)
    bv = append(data, 34962)                       # ARRAY_BUFFER
    acc = {'bufferView': bv, 'componentType': ctype, 'count': count, 'type': atype}
    if amin is not None:
        acc['min'], acc['max'] = amin, amax        # required for POSITION
    base_js['accessors'].append(acc)
    new_attrs[name] = len(base_js['accessors']) - 1
    print('COPY|%-12s %s/%d count=%d  %d bytes' % (name, atype, ctype, count, len(data)))

idata, ictype, iatype, icount, _, _ = raw(don_js, don_bin, dprim['indices'])
ibv = append(idata, 34963)                          # ELEMENT_ARRAY_BUFFER
base_js['accessors'].append({'bufferView': ibv, 'componentType': ictype,
                             'count': icount, 'type': iatype})
new_idx = len(base_js['accessors']) - 1
print('COPY|%-12s %s/%d count=%d (%d tris)  %d bytes'
      % ('INDICES', iatype, ictype, icount, icount // 3, len(idata)))

old_draco = bprim.get('extensions', {}).pop('KHR_draco_mesh_compression', None)
if not bprim.get('extensions'):
    bprim.pop('extensions', None)
bprim['attributes'] = new_attrs
bprim['indices'] = new_idx

base_js['buffers'][0]['byteLength'] = len(base_bin)
jsb = json.dumps(base_js, separators=(',', ':')).encode('utf-8')
jsb += b' ' * ((-len(jsb)) % 4)
base_bin.extend(b'\x00' * ((-len(base_bin)) % 4))
blob = bytearray(b'glTF' + struct.pack('<II', 2, 12 + 8 + len(jsb) + 8 + len(base_bin)))
blob += struct.pack('<II', len(jsb), 0x4E4F534A) + jsb
blob += struct.pack('<II', len(base_bin), 0x004E4942) + bytes(base_bin)
open(OUT, 'wb').write(blob)

import hashlib
print('PATCH|%s: draco bufferView %s dropped for this primitive only'
      % (NODE, old_draco['bufferView'] if old_draco else 'n/a'))
print('OUT|%s|%.3fMB|sha256=%s' % (OUT, os.path.getsize(OUT) / 1048576.0,
                                   hashlib.sha256(open(OUT, 'rb').read()).hexdigest()))
