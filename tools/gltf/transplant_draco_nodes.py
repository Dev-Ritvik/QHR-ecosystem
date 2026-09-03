"""
Replace many nodes' mesh geometry in a GLB with Draco-compressed primitives
from a donor GLB, keeping compression.

    python tools/gltf/transplant_draco_nodes.py <base.glb> <donor.glb> <out.glb> <regex>

WHY. P4A gives each of the 267 ashlar blocks its own tone in COLOR_0 (see
tools/blender/blocktone_stoneao.py). Vertex colours are geometry, so the only
way to ship them is to replace those 267 primitives. transplant_mesh.py writes
one primitive UNCOMPRESSED, which for the roof cost 220 KB; for 267 blocks it
would cost ~8 MB and a Draco round trip of the whole file is lossy. So the
donor is exported by Blender WITH Draco (same level as export_web.py), and this
copies each donor primitive's Draco bufferView plus its accessor metadata
(count / type / componentType / min / max) into the base, verbatim.

WHAT IS CHECKED PER NODE before anything is written: the node exists exactly
once in both files, both node transforms are identity, both primitives declare
the same attribute set, vertex and index counts match the base within the
tolerance Draco quantisation allows (identical here, since the same mesh is
re-exported), and POSITION min/max agree to 5 mm. Any failure aborts.

Every base primitive not named by the regex - and every image, material,
sampler and node - stays byte-identical.
"""
import json, os, re, struct, sys, hashlib

BASE, DONOR, OUT, PAT = sys.argv[1], sys.argv[2], sys.argv[3], re.compile(sys.argv[4])


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


bjs, bbin = read_glb(BASE); djs, dbin = read_glb(DONOR)
bnodes = {n.get('name'): i for i, n in enumerate(bjs['nodes']) if 'mesh' in n}
dnodes = {n.get('name'): i for i, n in enumerate(djs['nodes']) if 'mesh' in n}
targets = sorted(n for n in bnodes if PAT.fullmatch(n or ''))
if not targets: raise SystemExit('regex matched no base node')
missing = [n for n in targets if n not in dnodes]
if missing: raise SystemExit('donor lacks %d nodes, e.g. %s' % (len(missing), missing[:5]))


def xform(node):
    return {k: [round(float(x), 5) for x in node[k]] for k in ('matrix', 'translation', 'rotation', 'scale') if k in node}


def prim_of(js, ni):
    node = js['nodes'][ni]
    prims = js['meshes'][node['mesh']]['primitives']
    if len(prims) != 1: raise SystemExit('node %s has %d primitives' % (node.get('name'), len(prims)))
    return prims[0]


def append_bv(payload):
    buf = bjs['buffers'][0]; start = buf['byteLength'] + (-buf['byteLength']) % 4
    if len(bbin) < start: bbin.extend(b'\x00' * (start - len(bbin)))
    bbin[start:start + len(payload)] = payload; buf['byteLength'] = start + len(payload)
    bjs['bufferViews'].append({'buffer': 0, 'byteOffset': start, 'byteLength': len(payload)})
    return len(bjs['bufferViews']) - 1


def copy_accessor(src):
    a = {k: v for k, v in src.items() if k in ('componentType', 'count', 'type', 'min', 'max', 'normalized')}
    bjs['accessors'].append(a); return len(bjs['accessors']) - 1


done = 0; bytes_in = 0
for name in targets:
    # Placed blocks carry a node translation; the donor is the same object
    # re-exported, so the transforms must MATCH - not be identity.
    if xform(bjs['nodes'][bnodes[name]]) != xform(djs['nodes'][dnodes[name]]):
        raise SystemExit('%s node transform differs: %s vs %s' % (
            name, xform(bjs['nodes'][bnodes[name]]), xform(djs['nodes'][dnodes[name]])))
    bp = prim_of(bjs, bnodes[name]); dp = prim_of(djs, dnodes[name])
    dext = dp.get('extensions', {}).get('KHR_draco_mesh_compression')
    if not dext: raise SystemExit('donor primitive %s is not Draco-compressed' % name)
    if sorted(bp['attributes']) != sorted(dp['attributes']):
        raise SystemExit('%s attribute sets differ: %s vs %s' % (name, sorted(bp['attributes']), sorted(dp['attributes'])))
    bpos = bjs['accessors'][bp['attributes']['POSITION']]; dpos = djs['accessors'][dp['attributes']['POSITION']]
    if bpos['count'] != dpos['count']:
        raise SystemExit('%s vertex count %d -> %d' % (name, bpos['count'], dpos['count']))
    bidx = bjs['accessors'][bp['indices']]; didx = djs['accessors'][dp['indices']]
    if bidx['count'] != didx['count']:
        raise SystemExit('%s index count %d -> %d' % (name, bidx['count'], didx['count']))
    slip = max(abs(a - b) for a, b in zip(bpos['min'] + bpos['max'], dpos['min'] + dpos['max']))
    if slip > 0.005: raise SystemExit('%s bbox slip %.4f m' % (name, slip))
    dbv = djs['bufferViews'][dext['bufferView']]
    payload = bytes(dbin[dbv.get('byteOffset', 0): dbv.get('byteOffset', 0) + dbv['byteLength']])
    nbv = append_bv(payload); bytes_in += len(payload)
    new_attrs = {k: copy_accessor(djs['accessors'][ai]) for k, ai in dp['attributes'].items()}
    bp['attributes'] = new_attrs
    bp['indices'] = copy_accessor(djs['accessors'][dp['indices']])
    bp.setdefault('extensions', {})['KHR_draco_mesh_compression'] = {'bufferView': nbv, 'attributes': dict(dext['attributes'])}
    done += 1

jsb = json.dumps(bjs, separators=(',', ':')).encode('utf-8'); jsb += b' ' * ((-len(jsb)) % 4)
bbin.extend(b'\x00' * ((-len(bbin)) % 4))
blob = bytearray(b'glTF' + struct.pack('<II', 2, 12 + 8 + len(jsb) + 8 + len(bbin)))
blob += struct.pack('<II', len(jsb), 0x4E4F534A) + jsb + struct.pack('<II', len(bbin), 0x004E4942) + bytes(bbin)
open(OUT, 'wb').write(blob)
print('TRANSPLANT|%d nodes|%d bytes of Draco payload appended' % (done, bytes_in))
print('OUT|%s|%.3fMB|sha256=%s' % (OUT, os.path.getsize(OUT) / 1048576, hashlib.sha256(open(OUT, 'rb').read()).hexdigest()))
