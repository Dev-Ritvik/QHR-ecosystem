"""Replace one image's bytes inside a GLB, re-packing the binary chunk.

    python glb_replace_image.py in.glb out.glb <image_index> <new_file>

Used to swap a re-baked lightmap into interior_hall.glb (image 3, the atlas in
the occlusion slot) without re-exporting the model: every other buffer view is
copied byte for byte, re-aligned to 8 bytes, and the JSON's offsets and the
buffer length are rewritten to match.
"""
import json, struct, sys

src, dst, idx, newf = sys.argv[1], sys.argv[2], int(sys.argv[3]), sys.argv[4]
b = open(src, 'rb').read()
assert b[:4] == b'glTF'
off = 12
chunks = []
while off < len(b):
    ln, typ = struct.unpack_from('<I4s', b, off); off += 8
    chunks.append((typ, b[off:off + ln])); off += ln
doc = json.loads(chunks[0][1].decode('utf-8'))
bin_ = chunks[1][1]
assert len(doc['buffers']) == 1

new_bytes = open(newf, 'rb').read()
target_bv = doc['images'][idx]['bufferView']
views = doc['bufferViews']
order = sorted(range(len(views)), key=lambda i: views[i].get('byteOffset', 0))
out = bytearray()
for i in order:
    v = views[i]
    data = new_bytes if i == target_bv else bin_[v.get('byteOffset', 0): v.get('byteOffset', 0) + v['byteLength']]
    while len(out) % 8:
        out.append(0)
    v['byteOffset'] = len(out)
    v['byteLength'] = len(data)
    out += data
while len(out) % 4:
    out.append(0)
doc['buffers'][0]['byteLength'] = len(out)
js = json.dumps(doc, separators=(',', ':')).encode('utf-8')
while len(js) % 4:
    js += b' '
total = 12 + 8 + len(js) + 8 + len(out)
with open(dst, 'wb') as f:
    f.write(struct.pack('<4sII', b'glTF', 2, total))
    f.write(struct.pack('<I4s', len(js), b'JSON')); f.write(js)
    f.write(struct.pack('<I4s', len(out), b'BIN\x00')); f.write(out)
print('wrote', dst, total, 'bytes; image', idx, 'now', len(new_bytes), 'bytes')
