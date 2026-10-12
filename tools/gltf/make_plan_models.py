r"""
THE STATIONS' SITE MODELS: the printed face of each layout's model.

    python tools/gltf/make_plan_models.py [out_dir] [--png-only]

The refinement brief (2026-10-03, section E; ordered 2026-10-04): "Replace the
glowing/translucent sci-fi presentation with a tactile, architectural-model
treatment: physical/digital scale model, gallery object, matte architectural
material, wood/card/marble-like treatment ... The section should communicate
'beautiful way to understand land', not 'cool WebGL effect'." Its reference
standard is the film's own last frame, the map table: plaster on a dark ground
in a brass bezel.

The hall's file already carries each layout as a model: a plate, and every
plot of the sanctioned plan extruded from it (tools/blender/build_holo3d.py,
from assets/floorplans/<name>_cells.json). As a hologram those were drawn in
light, from the sanctioned sheet itself, and the sheet is a brochure: a logo, a
photograph of a resort, a child's face, plots in scarlet and cobalt. Light hid
that. A physical model cannot wear a brochure, so this draws the model's face
from the same two sources and nothing else:

  THE PLOTS, from the cells: ivory plaster, ONE colour (see CHROMA), a fine
  joint between neighbours, and the sheet's own ink - plot numbers, dimensions
  - engraved in sepia exactly where the sanctioned sheet puts it.
  THE OPEN LAND (green cells): a sage flock carrying the sheet's own detail
  quietly, its water in a grey-blue; and land held back, the same flock with
  nothing on it (clean_plan_cells.py: `plain`).
  EVERYTHING ELSE - roads, margins, the brochure's furniture - is the board:
  the hall's quarter-cut walnut (make_walnut_veneer.py) at a model's size,
  with the grain along the board's length, so the roads read as the channels
  between the blocks and the whole as a thing made of wood.
  It was first drawn as one dark lacquer, and a black field in a gilt frame,
  tilted to the eye with bright shapes on it, is a screen. The board takes a
  soft shade round every block (direction-free, because the model turns).

The model's own geometry is tools/blender/make_plan_model_geo.py's: solid
blocks from the same cells (the hall's were cut with a hole at every plot
number, for the light to show through), with UVs 0..1 across the sheet. So the
face is the sheet's own rectangle, at the size its ink can carry, each side a
multiple of four for the encoder.
"""
import json
import os
import subprocess
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
FLOOR = os.path.join(ROOT, 'assets', 'floorplans')
OUT = os.path.join(ROOT, 'apps', 'public', 'public', 'textures', 'plans')

# name: the face's size (the sheet's own proportions; kartikeya's sheet is
# 745 px across and is drawn at twice that, the others near their own size).
PLANS = {
    'kartikeya': (1488, 1448),
    'lucky': (2048, 1216),
    'gayatri': (2048, 1460),
}

IVORY = np.array([232, 225, 210], np.float32)
# The board: the veneer, a little down so the plaster stands off it.
BOARD_GAIN = 0.86
# The board's veneer is laid at this share of the size the hall's framing
# wears it, like the tray it lies in (StationModel.tsx, TRAY_VENEER; a test
# holds the two together). The forensic audit of 2026-10-09 (#37): "the grain
# is cartoon-large on the small objects ... Expected: grain scaled to each
# object, with the boards in a finer veneer than the wall." It was two
# crown-cut leaves of the wall's own sheet stretched across the whole board:
# a flame half a metre wide under a model whose plots are three centimetres.
BOARD_VENEER = 0.5
# Each board's own width in the hall, metres (interior_hall.glb,
# holo3d_S*_plate): what a pixel of its face is worth.
BOARD_WIDTH = {'kartikeya': 1.02, 'lucky': 1.10, 'gayatri': 1.10}
# The straight sheet: a leaf's width, and its length along the grain, metres
# (make_walnut_veneer.py).
LEAF_M, SHEET_M = 0.341, 1.364
# How far a block shades the board round it: the blur's radius as a share of
# the face's long side, and the depth of the shade at a block's foot.
SHADE = (0.008, 0.42)
# (98, 112, 88 until the paid audit of 2026-10-04, pass 8: "architectural
# artifact, not 3D infographic ... material integration, visual restraint".
# Under the room's warm key that sage printed as a bright leaf green, the one
# saturated colour on the table, with the sheet's own trees and paths drawn
# on it at a quarter of their contrast: a printed map let into a wooden
# model. A model-maker's landscape is a dull flock, greyer and deeper than
# life, and nothing is drawn on it.)
SAGE = np.array([84, 92, 76], np.float32)
SAGE_DETAIL = 0.08
WATER = np.array([84, 98, 106], np.float32)
STONE = np.array([172, 166, 152], np.float32)
INK = np.array([56, 46, 38], np.float32)
# How much of a plot's own printed hue its plaster keeps: NONE. It was 0.16,
# "which land is which is the plan's whole job"; but the sheets print no key,
# and the forensic audit of 2026-10-09 (#40) saw what a tint without one is:
# "the plots carry pastel tints with nothing to explain them ... Expected:
# plots in one colour unless a key is on the plaque." A plot the sheet marks
# still stands a little prouder (make_plan_model_geo.py, HEIGHT).
CHROMA = 0.0


def hull(ring):
    """Andrew's monotone chain: the convex hull of a ring, counter-clockwise."""
    pts = sorted(set((float(x), float(y)) for x, y in ring))
    if len(pts) < 3:
        return [tuple(p) for p in ring]

    def half(points):
        out = []
        for p in points:
            while len(out) >= 2 and (out[-1][0] - out[-2][0]) * (p[1] - out[-2][1]) - (out[-1][1] - out[-2][1]) * (p[0] - out[-2][0]) <= 0:
                out.pop()
            out.append(p)
        return out

    lower, upper = half(pts), half(pts[::-1])
    return lower[:-1] + upper[:-1]


def ring_area(ring):
    s = 0.0
    for i in range(len(ring)):
        x0, y0 = ring[i]
        x1, y1 = ring[(i + 1) % len(ring)]
        s += x0 * y1 - x1 * y0
    return abs(s) / 2.0


def plot_ring(cell):
    """A plot's outline, without the notches the sheet's lettering cut in it.

    The cells were traced from the sheet, and where a dimension is printed
    across the line between two plots ("30' X 56'") the tracing went round the
    letters: a bite out of each plot's edge, which in a model is a slot sawn
    in the block. A plot is a convex lot but for those bites, so its hull is
    its true outline - unless the hull adds more than an eighth to its area,
    which is a lot that really is L-shaped, and is kept as traced.
    """
    ring = [tuple(p) for p in cell['rings'][0]]
    # (`as_traced`: a block cut out of a larger cell by clean_plan_cells.py,
    # whose stepped outline is its own.)
    if cell['cat'] not in ('plot', 'plot_hot') or len(ring) < 4 or cell.get('as_traced'):
        return ring
    h = hull(ring)
    a = ring_area(ring)
    return h if a > 0 and ring_area(h) / a < 1.125 else ring


def luma(a):
    return 0.2126 * a[..., 0] + 0.7152 * a[..., 1] + 0.0722 * a[..., 2]


def veneer(name, aw, ah, sheet):
    """The board: the quarter-cut sheet at a model's size, turned so the grain
    runs along the board's length, and repeated mirrored (an end match along
    the grain, a book match across it) as the hall lays it."""
    per_metre = aw / BOARD_WIDTH[name]
    turned = sheet.rotate(90, expand=True)  # the grain along x
    tw = max(4, round(SHEET_M * BOARD_VENEER * per_metre))
    th = max(4, round(2 * LEAF_M * BOARD_VENEER * per_metre))
    tile = np.asarray(turned.resize((tw, th), Image.LANCZOS)).astype(np.float32)
    rows = []
    for j in range(-(-ah // th)):
        row = [tile[:, ::-1] if i % 2 else tile for i in range(-(-aw // tw))]
        strip = np.concatenate(row, axis=1)
        rows.append(strip[::-1] if j % 2 else strip)
    return np.concatenate(rows, axis=0)[:ah, :aw] * BOARD_GAIN


def build(name, wood):
    aw, ah = PLANS[name]
    sheet = Image.open(os.path.join(FLOOR, f'{name}_holo_tex.png')).convert('RGB').resize((aw, ah), Image.LANCZOS)
    src = np.asarray(sheet).astype(np.float32)
    cells = json.load(open(os.path.join(FLOOR, f'{name}_model_cells.json')))['cells']

    # Which cell each pixel belongs to (0: the board). The cells are in the
    # model's own plan (y up, as build_holo3d.py laid its UVs); the sheet's rows
    # run down.
    label = Image.new('I', (aw, ah), 0)
    draw = ImageDraw.Draw(label)
    # Largest first, so a plot drawn inside the open land keeps its own pixels.
    order = sorted(range(len(cells)), key=lambda i: -cells[i].get('area', 0))
    for i in order:
        c = cells[i]
        draw.polygon([(x * aw, (1 - y) * ah) for x, y in plot_ring(c)], fill=i + 1)
        # A plot is solid (its holes are where the sheet prints its number, and
        # that number is engraved on it below); open land keeps its holes, which
        # are the plots and roads inside it.
        if c['cat'] in ('plot', 'plot_hot'):
            continue
        for hole in c.get('holes', []) or []:
            draw.polygon([(x * aw, (1 - y) * ah) for x, y in hole], fill=0)
    lab = np.asarray(label)

    out = veneer(name, aw, ah, wood)
    # The shade at the blocks' feet.
    solid = Image.fromarray(((lab > 0) * 255).astype(np.uint8))
    near = np.asarray(solid.filter(ImageFilter.GaussianBlur(SHADE[0] * max(aw, ah)))).astype(np.float32) / 255.0
    out *= (1.0 - SHADE[1] * np.clip(near * 1.6, 0.0, 1.0))[..., None]
    lum = luma(src)
    for i, c in enumerate(cells):
        m = lab == i + 1
        if not m.any():
            continue
        cat = c['cat']
        if cat in ('plot', 'plot_hot'):
            fill = np.array(c['rgb'], np.float32) * 255.0
            tint = IVORY + CHROMA * (fill - luma(fill))
            px = np.broadcast_to(np.clip(tint, 0, 255), (int(m.sum()), 3)).copy()
            # The sheet's ink: what is printed darker than the plot's own fill.
            med = float(np.median(lum[m]))
            ink = np.clip((med - lum[m] - 26.0) / 64.0, 0.0, 1.0)[:, None]
            px = px * (1 - 0.76 * ink) + INK * (0.76 * ink)
            out[m] = px
        elif cat == 'green' and c.get('plain'):
            # Land held back: the flock, and nothing of the sheet on it (the
            # sheet letters it).
            out[m] = SAGE * 0.94
        elif cat == 'green':
            s = src[m]
            l = lum[m][:, None]
            detail = np.clip(0.94 + SAGE_DETAIL * (l - float(np.mean(l))) / 110.0, 0.86, 1.04)
            px = SAGE * detail
            wet = ((s[:, 2] > s[:, 0] + 28) & (s[:, 2] > s[:, 1] + 6))[:, None]
            px = np.where(wet, WATER * np.clip(0.9 + 0.2 * (l - 150.0) / 100.0, 0.8, 1.1), px)
            out[m] = px
        else:
            out[m] = STONE

    img = Image.fromarray(np.clip(out, 0, 255).astype(np.uint8))
    # The joints: a fine line at every plot's edge, darker than its plaster.
    edge = ImageDraw.Draw(img)
    joint = tuple(int(v) for v in IVORY * 0.74)
    for c in cells:
        if c['cat'] not in ('plot', 'plot_hot'):
            continue
        pts = [(x * aw, (1 - y) * ah) for x, y in plot_ring(c)]
        edge.line(pts + [pts[0]], fill=joint, width=2)
    return img


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    out = args[0] if args else OUT
    os.makedirs(out, exist_ok=True)
    # The hall's veneer, made afresh beside the faces and thrown away after.
    scratch = os.path.join(out, '_veneer')
    subprocess.run([sys.executable, os.path.join(os.path.dirname(os.path.abspath(__file__)), 'make_walnut_veneer.py'), scratch], check=True)
    wood = Image.open(os.path.join(scratch, 'walnut_straight.png')).convert('RGB')
    wood.load()
    for f in os.listdir(scratch):
        os.remove(os.path.join(scratch, f))
    os.rmdir(scratch)
    for name in PLANS:
        img = build(name, wood)
        png = os.path.join(out, f'{name}_model.png')
        img.save(png)
        print(name, img.size, png)
        if '--png-only' in sys.argv:
            continue
        ktx = os.path.join(out, f'{name}_model.ktx2')
        subprocess.run(
            ['ktx', 'create', '--format', 'R8G8B8_SRGB', '--assign-tf', 'srgb', '--generate-mipmap',
             '--encode', 'uastc', '--uastc-quality', '2', '--uastc-rdo', '--uastc-rdo-l', '1.0', '--zstd', '18',
             png, ktx],
            check=True,
        )
        os.remove(png)
        print('  ->', ktx, os.path.getsize(ktx))


if __name__ == '__main__':
    main()
