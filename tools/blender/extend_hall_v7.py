"""
Extend the hall by bays: wider, deeper, taller, with every feature kept.

    blender --background mansion_web.blend --python extend_hall_v7.py -- <out.blend>

Then bake and export as before, keeping mansion_web.blend untouched:

    blender --background <out.blend> --python bake_lightmap.py -- <outdir> 4096 512 1500 <out.blend> 2048
    blender --background <out.blend> --python export_web_interior.py -- <outdir>/lightmap_manifest.json <raw.glb>

WHAT THE CLIENT ASKED. "The mansion is congested - make it bigger, taller, wider,
and importantly longer, while preserving the features", for the exterior and the
hall both, extended by more bays rather than stretched. The hall's architecture
is a regular grid, which is what makes that possible without re-modelling it:

  side walls   pilasters every 2.4 m at y 0, +/-2.4, +/-4.8; panels and panel
               mouldings between them; a pair of sconces on every pilaster but
               the centre one; an anthemion frieze every 0.3227 m
  front/back   panels and mouldings either side of the door and the stair; a
               frieze every 0.32 m
  ceiling      a coffered grid with a cornice all round

So the room is extended the way it was built. Its shell (floor, ceiling, walls,
skirting, cornice, coffers) is re-proportioned from 15.0 x 10.6 x 6.4 m to
19.8 x 15.4 x 8.0 m, with the texture density of every stretched face kept, so
the marble and the plaster read at the scale they did. Each side wall gains a
bay at each end (pilaster, panel, moulding, a pair of sconces at y +/-7.2); the
front and back walls gain a panel bay at each end; the frieze runs on round the
longer walls on its own spacing. The pilaster orders are scaled whole with the
room's height, so the capitals keep their proportions. The staircase, the
portrait, the chandelier, the doors and the urns are scaled as whole
compositions, the four stations move out with the walls, and the bake lamps
follow the fixtures they stand in for.

Axes are Blender's: the entry door is on -y, the stair on +y, z up.
"""
import math
import sys

import bpy
from mathutils import Matrix, Vector

OUT = sys.argv[sys.argv.index("--") + 1]

OLD = {"x": 7.5, "y": 5.3, "z": 6.4}
NEW = {"x": 9.9, "y": 7.7, "z": 8.0}
KX, KY, KZ = NEW["x"] / OLD["x"], NEW["y"] / OLD["y"], NEW["z"] / OLD["z"]
DX, DY = NEW["x"] - OLD["x"], NEW["y"] - OLD["y"]
BAY = 2.4
# The pilaster faces stand 0.48 m off the side walls; scaled with the order they
# stand 0.60 m off, so what hangs on them comes 0.12 m further into the room.
PILASTER_FACE = OLD["x"] - 7.02
PILASTER_GROW = PILASTER_FACE * (KZ - 1.0)
# The frieze's own spacing, measured: 45 anthemions at 0.32 m on the front and
# back walls, 31 at 0.3227 m on the sides.
FRIEZE_X, FRIEZE_Y = 0.32, 4.84 / 15.0
FRIEZE_ADD = 7  # anthemions added at each end of each wall
URN_SCALE = 1.2
URN_AT = (4.7, 1.55)


def fx(x):
    return x * KX if abs(x) <= OLD["x"] else math.copysign(NEW["x"] + abs(x) - OLD["x"], x)


def fy(y):
    return y * KY if abs(y) <= OLD["y"] else math.copysign(NEW["y"] + abs(y) - OLD["y"], y)


def fz(z):
    return z * KZ if z <= OLD["z"] else NEW["z"] + (z - OLD["z"])


interior = bpy.data.collections["COL_Interior"]
objs = {o.name: o for o in interior.all_objects}
bpy.context.view_layer.update()


def bbox(o):
    if o.type != "MESH":
        t = o.matrix_world.translation
        return Vector(t), Vector(t)
    ws = [o.matrix_world @ Vector(c) for c in o.bound_box]
    return (Vector((min(v.x for v in ws), min(v.y for v in ws), min(v.z for v in ws))),
            Vector((max(v.x for v in ws), max(v.y for v in ws), max(v.z for v in ws))))


def face_gradients(pts, uvs):
    """World-space gradients of u and of v across one polygon (in its plane)."""
    n = len(pts)
    best, tri = 0.0, None
    for k in range(1, n - 1):
        a = (pts[k] - pts[0]).cross(pts[k + 1] - pts[0]).length
        if a > best:
            best, tri = a, (0, k, k + 1)
    if tri is None or best < 1e-10:
        return None
    i0, i1, i2 = tri
    e1, e2 = pts[i1] - pts[i0], pts[i2] - pts[i0]
    t = e1.normalized()
    b = e1.cross(e2).normalized().cross(t)
    a11, a12, a21, a22 = e1.dot(t), e1.dot(b), e2.dot(t), e2.dot(b)
    det = a11 * a22 - a12 * a21
    if abs(det) < 1e-12:
        return None
    grads = []
    for c in (0, 1):
        d1, d2 = uvs[i1][c] - uvs[i0][c], uvs[i2][c] - uvs[i0][c]
        g1 = (d1 * a22 - d2 * a12) / det
        g2 = (a11 * d2 - a21 * d1) / det
        grads.append(t * g1 + b * g2)
    return grads


def stretch_vertices(o):
    """Shell pieces: re-proportion every vertex through the room map, and move
    each face's texture coordinates with it so the texel density in world space
    is what it was (the lightmap UV is left alone; the bake re-packs it)."""
    me = o.data.copy() if o.data.users > 1 else o.data
    o.data = me
    mw, inv = o.matrix_world.copy(), o.matrix_world.inverted()
    old = [mw @ v.co for v in me.vertices]
    new = [Vector((fx(w.x), fy(w.y), fz(w.z))) for w in old]
    for layer in me.uv_layers:
        if layer.name == "UVLightmap":
            continue
        for poly in me.polygons:
            loops = list(poly.loop_indices)
            verts = [me.loops[li].vertex_index for li in loops]
            uvs = [tuple(layer.data[li].uv) for li in loops]
            g = face_gradients([old[vi] for vi in verts], uvs)
            if g is None:
                continue
            for li, vi, uv in zip(loops, verts, uvs):
                d = new[vi] - old[vi]
                layer.data[li].uv = (uv[0] + g[0].dot(d), uv[1] + g[1].dot(d))
    for v, w in zip(me.vertices, new):
        v.co = inv @ w


def wall_shift(c):
    """Where a wall-mounted element's centre goes. Front- and back-wall pieces
    (|y| > 5.0) move out with their wall and keep their x; side-wall pieces
    (|x| > 6.0) move out with theirs and keep their y - so every bay stays
    where it was along its wall and the new bays are added at the ends.
    Free-standing pieces scale with the floor."""
    if abs(c.y) > 5.0:
        return c.x, c.y + math.copysign(DY, c.y)
    if abs(c.x) > 6.0:
        return c.x + math.copysign(DX, c.x), c.y
    return c.x * KX, c.y * KY


def move_mounted(o, dx=0.0):
    """Wall-mounted element: translate with its wall, stretch in z with the
    room (panel mouldings and the wainscot grow taller with the walls)."""
    lo, hi = bbox(o)
    c = (lo + hi) / 2
    x, y = wall_shift(c)
    zb = lo.z
    m = (Matrix.Translation((x + dx - c.x, y - c.y, fz(zb))) @ Matrix.Diagonal((1, 1, KZ, 1))
         @ Matrix.Translation((0, 0, -zb)))
    o.matrix_world = m @ o.matrix_world


def compose(o, pivot, scale, dest):
    P, D = Vector(pivot), Vector(dest)
    m = Matrix.Translation(D) @ Matrix.Diagonal((scale, scale, scale, 1)) @ Matrix.Translation(-P)
    o.matrix_world = m @ o.matrix_world


def move_order(o):
    """A pilaster's plinth, torus, shaft or capital: the whole order scaled with
    the room's height about the foot of its wall face, so a capital is a larger
    capital rather than a stretched one."""
    lo, hi = bbox(o)
    c = (lo + hi) / 2
    s = math.copysign(1.0, c.x)
    compose(o, (s * OLD["x"], c.y, 0.0), KZ, (s * NEW["x"], c.y, 0.0))


SCONCE_Z = 3.35  # the sconces' common centre; all their parts move together


def move_sconce(o):
    """Sconce parts and their bake lamps: onto the grown pilaster's face and up
    with the room, at their own size (the site replaces the brass with turned
    work measured from these plates)."""
    lo, hi = bbox(o)
    c = (lo + hi) / 2
    dx = math.copysign(DX - PILASTER_GROW, c.x)
    o.matrix_world = Matrix.Translation((dx, 0.0, fz(SCONCE_Z) - SCONCE_Z)) @ o.matrix_world


def duplicate(o, name, dx=0.0, dy=0.0, copy_data=False):
    n = o.copy()
    if copy_data and o.data is not None:
        n.data = o.data.copy()
    for col in o.users_collection:
        col.objects.link(n)
    n.matrix_world = Matrix.Translation((dx, dy, 0)) @ o.matrix_world
    n.name = name
    return n


def starts(o, *prefixes):
    return any(o.name.startswith(p) for p in prefixes)


def renamed(name, old, new):
    return name.replace(old, new, 1) if old in name else name + "_x"


# ---- 1. re-proportion the room
STRETCH = ("int_floor", "int_ceiling", "int_wall_", "int_skirt_", "int_cornice_", "coffer_")
ORDER = ("pilaster_", "pil_plinth_", "pil_torus_", "capital_")
MOUNTED = ("wallpanel", "wallmould", "anth_")
SCONCE = ("sconce_", "LGT_sconce_")
STAIR = ("stair_", "runner_", "bal_", "newel_", "LGT_stair_wash")
PORTRAIT = ("portrait_", "piclight_", "LGT_portrait")
counts = {"stretch": 0, "order": 0, "mounted": 0, "sconce": 0, "stair": 0, "portrait": 0, "other": 0}
untouched = []
for o in list(objs.values()):
    if o.parent is not None and o.parent.name in objs:
        continue  # children ride with their parents (the station rig)
    if o.matrix_world.translation.z < -20:
        continue  # kit masters parked under the floor
    if o.type == "MESH" and starts(o, *STRETCH):
        stretch_vertices(o); counts["stretch"] += 1
    elif starts(o, *ORDER):
        move_order(o); counts["order"] += 1
    elif starts(o, "wallmould_b"):
        # the back wall's mouldings step out 0.2 m to clear the wider stair
        lo, hi = bbox(o)
        move_mounted(o, dx=math.copysign(0.2, (lo.x + hi.x) / 2)); counts["mounted"] += 1
    elif starts(o, *MOUNTED):
        move_mounted(o); counts["mounted"] += 1
    elif starts(o, *SCONCE):
        move_sconce(o); counts["sconce"] += 1
    elif starts(o, *STAIR):
        # the whole flight, from the old back wall, a quarter larger, onto the new one
        compose(o, (0, OLD["y"], 0), KZ, (0, NEW["y"], 0)); counts["stair"] += 1
    elif starts(o, *PORTRAIT):
        # hung higher on the taller wall, over a landing that is now 3.45 m up,
        # with room beneath it for the nameplate the site adds
        compose(o, (0, OLD["y"], 2.75), 1.05, (0, NEW["y"], 3.95)); counts["portrait"] += 1
    elif starts(o, "chandelier", "LGT_chandelier"):
        compose(o, (0, -0.6, 6.25), 1.3, (0, fy(-0.6), 7.85)); counts["other"] += 1
    elif starts(o, "ceiling_rosette"):
        compose(o, (0, -0.6, OLD["z"]), 1.3, (0, fy(-0.6), NEW["z"])); counts["other"] += 1
    elif starts(o, "int_doors", "int_door_arch"):
        compose(o, (0, -OLD["y"], 0), 1.15, (0, -NEW["y"], 0)); counts["other"] += 1
    elif starts(o, "STATION_"):
        t = o.matrix_world.translation
        o.matrix_world = Matrix.Translation((t.x * KX - t.x, t.y * KY - t.y, 0)) @ o.matrix_world; counts["other"] += 1
    elif starts(o, "dress_urn_") and not o.name.endswith("_master"):
        # urn and plinth scaled together about the plinth's foot, beside the stair foot
        plinth = objs.get("dress_urn_plinth_" + o.name.rsplit("_", 1)[-1])
        lo, hi = bbox(plinth)
        c = (lo + hi) / 2
        s = math.copysign(1.0, c.x)
        compose(o, (c.x, c.y, 0.0), URN_SCALE, (s * URN_AT[0], URN_AT[1], 0.0)); counts["other"] += 1
    elif starts(o, "dress_bench"):
        lo, hi = bbox(o)
        c = (lo + hi) / 2
        o.matrix_world = Matrix.Translation((c.x * KX - c.x, c.y * KY - c.y, 0)) @ o.matrix_world; counts["other"] += 1
    elif starts(o, "dress_rug"):
        compose(o, (-0.3, -2.2, 0), 1.35, (-0.3 * KX, -2.2 * KY, 0)); counts["other"] += 1
    elif starts(o, "LGT_entry_key"):
        t = o.matrix_world.translation
        o.matrix_world = Matrix.Translation((t.x * KX - t.x, -NEW["y"] + 0.3 - t.y, fz(t.z) - t.z)) @ o.matrix_world; counts["other"] += 1
    elif starts(o, "INT_HAZE"):
        o.matrix_world = Matrix.Diagonal((KX, KY, KZ, 1)) @ o.matrix_world; counts["other"] += 1
    else:
        untouched.append(o.name)
print("MOVED|%s" % counts)
print("UNTOUCHED|%s" % ",".join(sorted(untouched)))
bpy.context.view_layer.update()

# ---- 2. new bays, cloned from the outermost bays now that the walls have moved
added = []
for o in list(interior.all_objects):
    if o.type not in {"MESH", "LIGHT"} or o.matrix_world.translation.z < -20:
        continue
    if o.parent is not None:
        continue
    lo, hi = bbox(o)
    c = (lo + hi) / 2
    lightmapped = starts(o, "pilaster_", "pil_plinth_", "pil_torus_", "wallmould")
    side = abs(c.x) > 8.4 and abs(c.y) < 6.5
    front_back = abs(c.y) > 6.5
    sy, sx = math.copysign(1.0, c.y), math.copysign(1.0, c.x)
    # side walls: the bays at |y| 4.8 (orders, sconces) and 3.6 (panels, mouldings) repeat outward
    if side and starts(o, *ORDER, *SCONCE) and abs(abs(c.y) - 4.8) < 0.3:
        added.append(duplicate(o, renamed(o.name, "4.8", "7.2"), dy=sy * BAY, copy_data=lightmapped))
    elif side and starts(o, "wallpanel_", "wallmould_") and not starts(o, "wallpanel_f", "wallmould_b", "wallmould_f") \
            and abs(abs(c.y) - 3.6) < 0.3:
        added.append(duplicate(o, renamed(o.name, "3.6", "6.0"), dy=sy * BAY, copy_data=lightmapped))
    # back wall: one more moulding at each end, on the stepped-out spacing
    elif front_back and starts(o, "wallmould_b") and abs(abs(c.x) - 6.4) < 0.3:
        added.append(duplicate(o, renamed(o.name, "6.2", "8.6"), dx=sx * 2.2, copy_data=True))
    # front wall: one more panel and moulding at each end, aligned on x 8.0
    elif front_back and starts(o, "wallmould_f") and abs(abs(c.x) - 5.6) < 0.2:
        added.append(duplicate(o, renamed(o.name, "5.6", "8.0"), dx=sx * 2.4, copy_data=True))
    elif front_back and starts(o, "wallpanel_f") and abs(abs(c.x) - 5.4) < 0.2:
        added.append(duplicate(o, renamed(o.name, "5.4", "8.0"), dx=sx * 2.6))
    # the frieze runs on round the longer walls, on its own spacing
    elif starts(o, "anth_y") and abs(c.y) > 4.84 - (FRIEZE_ADD - 0.5) * FRIEZE_Y:
        added.append(duplicate(o, o.name + "_x", dy=sy * FRIEZE_ADD * FRIEZE_Y))
    elif starts(o, "anth_x") and abs(c.x) > 7.04 - (FRIEZE_ADD - 0.5) * FRIEZE_X:
        added.append(duplicate(o, o.name + "_x", dx=sx * FRIEZE_ADD * FRIEZE_X))
kinds = {}
for n in added:
    k = n.name.split("_")[0]
    kinds[k] = kinds.get(k, 0) + 1
print("BAYS|added=%d|%s" % (len(added), kinds))
bpy.context.view_layer.update()

# The bigger volume needs more light from the fixtures that fill it.
for name, k in (("LGT_chandelier", 1.6), ("LGT_stair_wash", 1.5), ("LGT_portrait", 1.2), ("LGT_entry_key", 1.4)):
    L = bpy.data.objects.get(name)
    if L and L.type == "LIGHT":
        L.data.energy *= k

bpy.context.view_layer.update()


def union(prefix):
    lo = Vector((1e9, 1e9, 1e9))
    hi = -lo
    n = 0
    for o in interior.all_objects:
        if o.matrix_world.translation.z > -20 and o.name.startswith(prefix) and o.type in {"MESH", "LIGHT"}:
            a, b = bbox(o)
            lo = Vector(map(min, lo, a))
            hi = Vector(map(max, hi, b))
            n += 1
    return n, tuple(round(v, 3) for v in lo), tuple(round(v, 3) for v in hi)


for p in ("int_", "int_doors", "int_door_arch", "stair_step", "stair_landing", "bal_plinth", "bal_rail",
          "newel_bot", "newel_mid", "portrait_frame_outer", "piclight_", "chandelier", "ceiling_rosette",
          "dress_urn_0", "dress_urn_1", "dress_urn_plinth", "dress_bench", "dress_rug_border", "pilaster_",
          "capital_", "pil_plinth", "sconce_plate", "sconce_cup", "wallpanel_", "wallpanel_f", "wallmould_b",
          "wallmould_f", "anth_x", "anth_y", "coffer_", "LGT_"):
    print("BOX|%s|%s|%s|%s" % ((p,) + union(p)))
for s in ("S1", "S2", "S3", "S4"):
    print("STATION|%s|%s" % (s, tuple(round(v, 3) for v in objs["STATION_" + s].matrix_world.translation)))
for L in ("LGT_chandelier", "LGT_portrait", "LGT_stair_wash", "LGT_entry_key"):
    ob = bpy.data.objects.get(L)
    if ob:
        print("LAMP|%s|%s|energy=%.1f" % (L, tuple(round(v, 3) for v in ob.matrix_world.translation), ob.data.energy))
bpy.ops.wm.save_as_mainfile(filepath=OUT, copy=False)
print("SAVED|%s" % OUT)
