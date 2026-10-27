"""The stills, encoded and listed (scripts/stills/shoot.mjs has the account).

    python scripts/stills/encode.py <rawDir> [--quality 78] [--sharpen 70] [--keep-old] [--fresh]

Reads <rawDir>/<key>.<cut>.png as the shooter wrote them, brings each down to
its cut's width, writes public/stills/<v>/<key>.<cut>.webp and the list the
site reads (src/components/experience/stills.manifest.json). <v> is a hash of
what was written, so the same pictures are the same address and anything new
is a new one: the folder is served to be kept for a year (next.config.mjs).

Run from apps/public. A raw folder that holds only some of the stills (a
re-shoot of one page) is MERGED over the set already published: every still
that was not re-shot is carried into the new folder as it is. `--fresh`
carries nothing: the raw folder is the whole set (after a place is renamed or
dropped, so that no still of a place that is gone is published).

AS SHARP AS THE PICTURE THAT REPLACES IT (the second forensic audit,
2026-10-24, #10: "as the still dissolves into the scene ... it comes up about a
fifth sharper"). A still is shot at twice the screen's density and brought
down, so its edges are averaged where the live frame's are drawn at the
screen's own size, and then compressed. Measured at 1920x945 against the live
frame at the camera's rest (c13/still_live), the live picture's edges were 1.3
to 1.8 times the still's; with an unsharp mask of radius 0.8 at `--sharpen`
70 after the resize, 1.07 to 1.4, and the two frames no further apart pixel
for pixel. 0 turns it off.
"""
import hashlib
import io
import json
import os
import shutil
import sys

from PIL import Image, ImageFilter

args = [a for a in sys.argv[1:] if not a.startswith('--')]
if not args:
    sys.exit(__doc__)
RAW = args[0]


def opt(name, fallback):
    flag = '--' + name
    if flag in sys.argv:
        i = sys.argv.index(flag)
        if i + 1 < len(sys.argv):
            return sys.argv[i + 1]
    return fallback


QUALITY = int(opt('quality', '78'))
SHARPEN = int(opt('sharpen', '70'))
PUBLIC = os.path.join('public', 'stills')
MANIFEST = os.path.join('src', 'components', 'experience', 'stills.manifest.json')

shoot = json.load(io.open(os.path.join(RAW, 'shoot.json'), encoding='utf-8'))
OUT_W = {c['id']: c['out'] for c in shoot['cuts']}

# What is published now, to carry over what was not shot again.
old = {'v': '0', 'keys': {}}
if os.path.exists(MANIFEST):
    old = json.load(io.open(MANIFEST, encoding='utf-8'))
old_dir = os.path.join(PUBLIC, old.get('v', '0'))

blobs = {}  # (key, cut) -> bytes
for name in sorted(os.listdir(RAW)):
    if not name.endswith('.png'):
        continue
    key, cut, _ = name.rsplit('.', 2)
    if cut not in OUT_W:
        print('skipped (no such cut):', name)
        continue
    im = Image.open(os.path.join(RAW, name)).convert('RGB')
    w = OUT_W[cut]
    if im.width != w:
        h = round(im.height * w / im.width)
        im = im.resize((w, h), Image.LANCZOS)
    if SHARPEN:
        im = im.filter(ImageFilter.UnsharpMask(radius=0.8, percent=SHARPEN, threshold=0))
    buf = io.BytesIO()
    im.save(buf, 'WEBP', quality=QUALITY, method=6)
    blobs[(key, cut)] = buf.getvalue()

carried = 0
for key, cuts in ({} if '--fresh' in sys.argv else old.get('keys', {})).items():
    for cut in cuts:
        if (key, cut) in blobs:
            continue
        src = os.path.join(old_dir, f'{key}.{cut}.webp')
        if os.path.exists(src):
            blobs[(key, cut)] = io.open(src, 'rb').read()
            carried += 1

if not blobs:
    sys.exit('nothing to encode in ' + RAW)

h = hashlib.sha1()
for (key, cut) in sorted(blobs):
    h.update(f'{key}.{cut}'.encode())
    h.update(blobs[(key, cut)])
v = h.hexdigest()[:10]

out_dir = os.path.join(PUBLIC, v)
os.makedirs(out_dir, exist_ok=True)
keys = {}
total = 0
for (key, cut) in sorted(blobs):
    io.open(os.path.join(out_dir, f'{key}.{cut}.webp'), 'wb').write(blobs[(key, cut)])
    keys.setdefault(key, []).append(cut)
    total += len(blobs[(key, cut)])

io.open(MANIFEST, 'w', encoding='utf-8', newline='\n').write(
    json.dumps({'v': v, 'keys': {k: keys[k] for k in sorted(keys)}}, indent=2) + '\n'
)

# One set is published at a time.
if '--keep-old' not in sys.argv:
    for name in os.listdir(PUBLIC):
        p = os.path.join(PUBLIC, name)
        if os.path.isdir(p) and name != v:
            shutil.rmtree(p)

n = len(blobs)
print(f'{n} stills ({carried} carried over), {total / 1e6:.1f} MB, mean {total / n / 1e3:.0f} kB -> {out_dir}')
big = sorted(((len(b), k) for k, b in blobs.items()), reverse=True)[:5]
print('largest:', ', '.join(f'{k[0]}.{k[1]} {s / 1e3:.0f} kB' for s, k in big))
