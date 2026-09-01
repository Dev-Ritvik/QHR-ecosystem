"""
Visible-surface facade survey — the authoritative geometric method.

WHY THIS EXISTS. Three different measurements of the west wall gave three
different answers, each precise-looking and each wrong:

    bounding box        x +/-8.05, y -6.10..5.55   (entrance block, corner returns)
    face-centre cluster y -5.05..5.04              (right, but I dismissed it)
    vertex extent       y -5.55..5.55              (wrong; those vertices are on
                                                    the entrance flank, which also
                                                    faces west)

mansion_walls is ONE mesh for the entire building. Any method that groups faces
by normal or reads extents cannot tell "this facade" from "another part of the
same mesh that happens to point the same way". Only asking what a camera would
actually see answers that.

So: fire rays inward from outside the building on a dense grid, record the
frontmost surface, and keep only the samples where the winner is mansion_walls.
That set IS the paintable wall, by definition. Openings, projecting sills,
architraves, eaves and applied bronze all remove themselves automatically,
because at those samples something else is in front.

WHAT IS HIDDEN DURING THE SURVEY, and why:
    COL_Interior      never exported with the exterior
    COL_Ashlar_*      the thing being placed; it must not occlude its own datum
    vegetation, haze  occluders that are not architecture
    terrace, rustic   ground works; they hide the wall's lowest courses, which is
                      handled separately by starting the field above them

WHAT IS KEPT: roof, gold, glass, trim, entrance. Those are real exterior
occluders and the survey needs to see them win.

Writes one JSON per facade: a list of (h, z, object, depth, nx, ny, nz).
"""
import bpy
import json
import os
from mathutils import Vector

OUT = r"C:\Users\DEVRIT~1\AppData\Local\Temp\claude\C--dev-estate\05c976ed-fa0e-4226-990b-1e9cde51c862\scratchpad"

HIDE_COLL = ("COL_Interior",)
HIDE_OBJ = ("EXT_HAZE", "hedge_l", "hedge_b", "hedge_r",
            "terrace_lower", "terrace_upper", "ground_plane")
HIDE_PREFIX = ("cyp_", "rustic_")

# facade -> (axis, outward sign, nominal plane, horizontal sweep)
SPEC = {
    "WEST":  ('x', -1, -7.50, (-6.60, 6.60)),
    "EAST":  ('x', +1, +7.50, (-6.60, 6.60)),
    "SOUTH": ('y', -1, -5.00, (-8.80, 8.80)),
    "NORTH": ('y', +1, +5.00, (-8.80, 8.80)),
}

FAR = 40.0


def _hide(state):
    lc = {c.name: c for c in bpy.context.view_layer.layer_collection.children}
    for n in HIDE_COLL:
        if n in lc:
            lc[n].exclude = state
    for c in lc:
        if c.startswith("COL_Ashlar"):
            lc[c].exclude = state
    for o in bpy.data.objects:
        if o.name in HIDE_OBJ or o.name.startswith(HIDE_PREFIX):
            o.hide_viewport = state
    bpy.context.view_layer.update()


def survey(name, hstep=0.04, zstep=0.04, z0=0.15, z1=6.40):
    """Fire the grid. Returns raw samples; caller is responsible for hiding."""
    axis, sign, nom, (h0, h1) = SPEC[name]
    dg = bpy.context.evaluated_depsgraph_get()
    scn = bpy.context.scene
    if axis == 'x':
        d = Vector((1, 0, 0)) if sign < 0 else Vector((-1, 0, 0))
    else:
        d = Vector((0, 1, 0)) if sign < 0 else Vector((0, -1, 0))

    rows = []
    z = z0
    while z <= z1 + 1e-9:
        h = h0
        while h <= h1 + 1e-9:
            if axis == 'x':
                o = Vector((-FAR if sign < 0 else FAR, h, z))
            else:
                o = Vector((h, -FAR if sign < 0 else FAR, z))
            hit, loc, nrm, idx, ob, _ = scn.ray_cast(dg, o, d)
            if hit:
                depth = loc.x if axis == 'x' else loc.y
                rows.append((round(h, 3), round(z, 3), ob.name, round(depth, 4),
                             round(nrm.x, 2), round(nrm.y, 2), round(nrm.z, 2)))
            else:
                rows.append((round(h, 3), round(z, 3), None, None, 0.0, 0.0, 0.0))
            h += hstep
        z += zstep
    return rows


def run(names=("WEST", "EAST", "SOUTH", "NORTH"), **kw):
    os.makedirs(OUT, exist_ok=True)
    stats = {}
    _hide(True)
    try:
        for n in names:
            rows = survey(n, **kw)
            json.dump(rows, open(os.path.join(OUT, "survey_%s.json" % n), "w"))
            from collections import Counter
            c = Counter(r[2] for r in rows)
            stats[n] = {"rays": len(rows), "wall": c.get("mansion_walls", 0),
                        "top": c.most_common(6)}
    finally:
        _hide(False)
    return stats
