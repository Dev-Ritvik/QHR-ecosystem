"""The cards' pictures: every page's own opening frame, cut to the shape a link is shared in.

    python scripts/stills/share.py <rawDir> [--quality 84] [--fresh]

Reads the same raw shots the stills are encoded from (<rawDir>/<key>.<cut>.png,
scripts/stills/shoot.mjs) and writes public/share/<key>.jpg at 1200 x 630 for
the film's cover and for every page's plate: what lib/share.ts names as a
page's og:image. A card is 1.905 wide to 1 tall, so each is cut from the shot
whose shape is nearest that (a desk's screen), from its middle.

Run from apps/public, after a shoot and with the encode: a page that is given a
new picture is given a new card with it. JPEG, not WebP: the messengers a link
is pasted into do not all read WebP.

--fresh, after a shoot of EVERY page: the cards this run did not write are
removed (a place that was renamed leaves its card behind otherwise, and the
folder is published as it stands).
"""
import io
import os
import sys

from PIL import Image

args = [a for a in sys.argv[1:] if not a.startswith('--')]
if not args:
    sys.exit(__doc__)
RAW = args[0]
QUALITY = int(sys.argv[sys.argv.index('--quality') + 1]) if '--quality' in sys.argv else 84
OUT = os.path.join('public', 'share')
W, H = 1200, 630
# Nearest a card's shape first: 1.85, 1.6, 2.2, 1.33, 2.7 to 1.
PREFER = ['w18', 'w16', 'w22', 'w13', 'w27']

shots = {}
for name in sorted(os.listdir(RAW)):
    if not name.endswith('.png'):
        continue
    key, cut, _ = name.rsplit('.', 2)
    shots.setdefault(key, {})[cut] = os.path.join(RAW, name)

os.makedirs(OUT, exist_ok=True)
total = 0
written = set()
for key in sorted(shots):
    # A card is a page's: the film's cover, and each plate. (The film's other
    # chapters have stills and no address of their own.)
    if not (key == 'film-hero' or key.startswith('place-')):
        continue
    cut = next((c for c in PREFER if c in shots[key]), None)
    if cut is None:
        print('no wide shot for', key)
        continue
    im = Image.open(shots[key][cut]).convert('RGB')
    want = W / H
    if im.width / im.height > want:
        w = round(im.height * want)
        x = (im.width - w) // 2
        im = im.crop((x, 0, x + w, im.height))
    else:
        h = round(im.width / want)
        y = (im.height - h) // 2
        im = im.crop((0, y, im.width, y + h))
    im = im.resize((W, H), Image.LANCZOS)
    buf = io.BytesIO()
    im.save(buf, 'JPEG', quality=QUALITY, optimize=True, progressive=True)
    io.open(os.path.join(OUT, key + '.jpg'), 'wb').write(buf.getvalue())
    written.add(key + '.jpg')
    total += len(buf.getvalue())
    print(f'{key}.jpg  from {cut}  {len(buf.getvalue()) // 1024} KB')
if '--fresh' in sys.argv:
    for name in sorted(os.listdir(OUT)):
        if name.endswith('.jpg') and name not in written:
            os.remove(os.path.join(OUT, name))
            print('removed', name)
print('cards:', len(written), ' total', total // 1024, 'KB')
