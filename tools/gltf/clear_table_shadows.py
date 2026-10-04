"""
Clear the station tables' footprints from the hall's lightmap floor.

    python clear_table_shadows.py <lightmap_final.png> <out.png>

Then encode (UASTC, see finish_hall_lightmap.py) and swap into image 3 of
interior_hall.glb with glb_replace_image.py.

WHY. The tables' feet were exported with their underside as a disc facing UP at
exactly the floor's height, and the bake saw it as a lid on the marble: under
each foot the floor atlas is pure black (value 0 over a 0.4 m disc), with the
tables' own shadow falling off round it to about a metre. At a distance the GPU
reads a coarser mip, which averages that black core into the texels around it,
so every table stood in a dark disc that reached past its foot — and the
station's additive floor glow, adding a fixed warm amount on top, turned it tan
("the bases of these stations must be fixed"). The tables also turn, and are
lit live since (HallModel.liveTurntables), so no baked shadow of theirs can be
right anyway. Their grounding is drawn at runtime (StationDressing's contact
shadow), where it can be soft and follow them.

So each table's footprint, out to FILL_R, is filled from the floor's light
around it (a Telea inpaint from the ring outside), leaving the oculus's pool and
the room's gradients running through where the table stands.

THE MAPPING. The floor's top face is one quad in the atlas (UVLightmap, read
from mansion_web_V7IMP.blend): u runs with Blender y, v with Blender x, 23.0
texels per metre on both. Rows are top-down, so row = (1 - v) * H.
"""
import sys

import cv2
import numpy as np
from PIL import Image

Image.MAX_IMAGE_PIXELS = None
SRC, DST = sys.argv[1], sys.argv[2]

# int_floor's top face, x -9.9..9.9 and y -7.7..7.7 (Blender), in the atlas.
U0, U1 = 0.0035244, 0.0901287          # y = -7.7 .. +7.7
V0, V1 = 0.3584158, 0.2470674          # x = -9.9 .. +9.9
# TURNTABLE_S1..S4, Blender x/y.
TABLES = {"S1": (-7.854, -2.7604), "S2": (-6.072, 5.5208), "S3": (7.854, 1.3075), "S4": (7.854, -4.9396)}
FILL_R = 1.0                            # metres: past the top's shadow (r 0.58) and its falloff

img = np.array(Image.open(SRC).convert("RGB"))
H, W, _ = img.shape
ppm = (U1 - U0) / 15.4 * W              # texels per metre
mask = np.zeros((H, W), np.uint8)
for name, (x, y) in TABLES.items():
    cx = (U0 + (y + 7.7) / 15.4 * (U1 - U0)) * W
    cy = (1 - (V0 + (x + 9.9) / 19.8 * (V1 - V0))) * H
    cv2.circle(mask, (int(round(cx)), int(round(cy))), int(round(FILL_R * ppm)), 255, -1)
    print("%s at texel (%.0f, %.0f), r %.0f px" % (name, cx, cy, FILL_R * ppm))
# The fill reads only the floor's own island: everything outside its quad is
# painted as known-and-far so the inpaint cannot pull another surface's light in.
x0, x1 = int(U0 * W) + 1, int(U1 * W) - 1
y0, y1 = int((1 - V0) * H) + 1, int((1 - V1) * H) - 1
floor = img[y0:y1, x0:x1].copy()
filled = cv2.inpaint(floor, mask[y0:y1, x0:x1], 12, cv2.INPAINT_TELEA)
# A light smoothing inside the fill only, so the inpaint's streaks cannot show.
soft = cv2.GaussianBlur(filled, (0, 0), 3)
m = mask[y0:y1, x0:x1][..., None] > 0
img[y0:y1, x0:x1] = np.where(m, soft, floor)
Image.fromarray(img).save(DST)
print("wrote", DST)
