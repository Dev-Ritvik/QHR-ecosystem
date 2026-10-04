"""
The imperial hall, refined: its columns stand on bases, and the stair's apron
has an architrave.

    blender --background mansion_web_V7IMP.blend --python refine_hall_v7.py -- <out.blend>

Then pack, bake and ship as the imperial hall was (see imperial_hall_v7.py).
The light is re-baked in two passes, the lamps and the sky, so their balance
can be set afterwards without baking again (rebake_hall_lightmap_v7.py,
tools/gltf/finish_hall_lightmap.py --save-float, tools/gltf/mix_hall_passes.py).

WHY (the refinement brief, 2026-10-03, and both audits behind it: "where
visible, refine flat/unfinished-looking interior surfaces with appropriate
architectural/material detail"). Seen at every table, where a column stands
beside the plan:

  THE BASES. Each column's shaft met its plinth through a twelve-sided cone
  fifteen centimetres high (pil_torus_*): a column with no base, on a chamfer.
  A column of this order stands on an Attic base — a torus, a scotia, a
  smaller torus, each with its fillet — and that moulding is the one piece of
  the order at eye level. They are lathed here, thirty-two segments round, to
  the same height and footprint, so nothing else in the room moves.

  THE SHAFTS are left as they are: twenty flutes, true. What was wrong with
  them was their LIGHT — the lightmap unwrap cut each shaft into strips whose
  edges stood as dark seams and stepped texels up the flutes. That is mended
  where it was made (bake_lightmap.py unrolls each shaft as one island).

  THE STAIR'S APRON. The walnut panel on the court's face of the landing sat
  in a bare block. It takes a moulded stone architrave, as the portrait's
  panel above it has.

Axes are Blender's: entry on -y, stair on +y, z up.
"""
import math
import sys

import bmesh
import bpy
from mathutils import Vector

OUT = sys.argv[sys.argv.index("--") + 1]

interior = bpy.data.collections["COL_Interior"]
# UV units per metre on the room's trim, as imperial_hall_v7.py measured it.
TRIM_DENSITY = 0.215
SEGMENTS = 32


def world_box(o):
    ws = [o.matrix_world @ Vector(c) for c in o.bound_box]
    lo = Vector((min(w.x for w in ws), min(w.y for w in ws), min(w.z for w in ws)))
    hi = Vector((max(w.x for w in ws), max(w.y for w in ws), max(w.z for w in ws)))
    return lo, hi


def arc(cx, cz, r, a0, a1, n):
    """Points on a circle in the (radius, height) plane, a0 to a1 in degrees."""
    out = []
    for k in range(n + 1):
        a = math.radians(a0 + (a1 - a0) * k / n)
        out.append((cx + r * math.cos(a), cz + r * math.sin(a)))
    return out


def attic_base(shaft_r, height):
    """The profile of an Attic base as (radius, z) from the plinth's top up to
    the shaft: lower torus, fillet, scotia, fillet, upper torus, fillet, and
    the apophyge into the shaft. `height` is the room it has; the classical
    base is half a diameter high and these have less, so the members keep
    their proportions to each other and give up some of their projection."""
    h = height
    r = shaft_r
    # heights of the members, as fractions of the whole
    t1, f1, sc, f2, t2, f3 = 0.34, 0.05, 0.22, 0.05, 0.24, 0.10
    z = 0.0
    prof = [(0.0, 0.0)]
    # lower torus: a half round, proud of the shaft by 0.26 r
    rt = t1 * h / 2
    prof += arc(r * 1.26 - rt, z + rt, rt, -90, 90, 8)
    z += t1 * h
    # fillet
    prof += [(r * 1.17, z), (r * 1.17, z + f1 * h)]
    z += f1 * h
    # scotia: a hollow between the fillets
    rs = sc * h / 2
    prof += [(r * 1.17 - rs * (1 - math.cos(math.radians(a))) * 0.9, z + rs - rs * math.cos(math.radians(a)) * 1.0)
             for a in (30, 60, 90, 120, 150)]
    z += sc * h
    prof += [(r * 1.13, z), (r * 1.13, z + f2 * h)]
    z += f2 * h
    # upper torus
    rt = t2 * h / 2
    prof += arc(r * 1.16 - rt, z + rt, rt, -90, 90, 6)
    z += t2 * h
    # the fillet under the shaft, and the apophyge (a quarter hollow) into it
    prof += [(r * 1.06, z), (r * 1.06, z + f3 * h * 0.4), (r * 1.02, z + f3 * h * 0.8), (r * 1.0, z + f3 * h)]
    prof.append((0.0, h))
    # no doubled points
    clean = [prof[0]]
    for p in prof[1:]:
        if abs(p[0] - clean[-1][0]) > 1e-5 or abs(p[1] - clean[-1][1]) > 1e-5:
            clean.append(p)
    return clean


def lathe_mesh(name, profile, centre, z0, material):
    """A lathe of `profile` (radius, z) round the vertical through `centre`,
    with UV0 round and up it at the trim's density."""
    bm = bmesh.new()
    rings = []
    for r, z in profile:
        if r < 1e-6:
            rings.append([bm.verts.new((centre[0], centre[1], z0 + z))])
        else:
            rings.append([bm.verts.new((centre[0] + r * math.cos(2 * math.pi * s / SEGMENTS),
                                        centre[1] + r * math.sin(2 * math.pi * s / SEGMENTS), z0 + z))
                          for s in range(SEGMENTS)])
    uv = bm.loops.layers.uv.new("UVMap")
    run = [0.0]
    for k in range(1, len(profile)):
        run.append(run[-1] + math.hypot(profile[k][0] - profile[k - 1][0], profile[k][1] - profile[k - 1][1]))
    for k in range(len(rings) - 1):
        a, b = rings[k], rings[k + 1]
        for s in range(SEGMENTS):
            s2 = (s + 1) % SEGMENTS
            if len(a) == 1 and len(b) == 1:
                continue
            if len(a) == 1:
                f = bm.faces.new((a[0], b[s2], b[s]))
                us = ((s + 0.5), (s + 1), s)
                vs = (run[k], run[k + 1], run[k + 1])
            elif len(b) == 1:
                f = bm.faces.new((a[s], a[s2], b[0]))
                us = (s, (s + 1), (s + 0.5))
                vs = (run[k], run[k], run[k + 1])
            else:
                f = bm.faces.new((a[s], a[s2], b[s2], b[s]))
                us = (s, s + 1, s + 1, s)
                vs = (run[k], run[k], run[k + 1], run[k + 1])
            girth = 2 * math.pi * max(profile[k][0], profile[k + 1][0], 0.05)
            for loop, u, v in zip(f.loops, us, vs):
                loop[uv].uv = (u / SEGMENTS * girth * TRIM_DENSITY, v * TRIM_DENSITY)
            f.smooth = True
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    me.materials.append(material)
    try:
        me.set_sharp_from_angle(angle=math.radians(38.0))
    except Exception:
        pass
    return me


def box_mesh(name, lo, hi, material):
    x0, y0, z0 = lo
    x1, y1, z1 = hi
    v = [(x0, y0, z0), (x1, y0, z0), (x1, y1, z0), (x0, y1, z0), (x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1)]
    f = [(0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)]
    me = bpy.data.meshes.new(name)
    me.from_pydata(v, [], f)
    me.materials.append(material)
    uv = me.uv_layers.new(name="UVMap")
    for poly in me.polygons:
        n = poly.normal
        ax = max(range(3), key=lambda i: abs(n[i]))
        a, b = [(1, 2), (0, 2), (0, 1)][ax]
        for li in poly.loop_indices:
            co = me.vertices[me.loops[li].vertex_index].co
            uv.data[li].uv = (co[a] * TRIM_DENSITY, co[b] * TRIM_DENSITY)
    me.update()
    o = bpy.data.objects.new(name, me)
    interior.objects.link(o)
    return o


# ------------------------------------------------------------- 1. the bases
bases = 0
for o in list(interior.all_objects):
    if o.type != "MESH" or not o.name.startswith("pil_torus_"):
        continue
    shaft = bpy.data.objects.get("pilaster_" + o.name[len("pil_torus_"):])
    plinth = bpy.data.objects.get("pil_plinth_" + o.name[len("pil_torus_"):])
    if shaft is None or plinth is None:
        print("REFINE|skip %s: no shaft or plinth" % o.name)
        continue
    slo, shi = world_box(shaft)
    plo, phi = world_box(plinth)
    centre = ((slo.x + shi.x) / 2, (slo.y + shi.y) / 2)
    # The shaft's own foot radius: its lowest ring, to the arris.
    foot = [shaft.matrix_world @ v.co for v in shaft.data.vertices]
    zmin = min(w.z for w in foot)
    ring = [w for w in foot if w.z < zmin + 1e-3]
    shaft_r = max(math.hypot(w.x - centre[0], w.y - centre[1]) for w in ring)
    z0, z1 = phi.z, zmin
    # The base may not overhang its plinth.
    half_plinth = min(phi.x - plo.x, phi.y - plo.y) / 2
    if shaft_r * 1.26 > half_plinth:
        print("REFINE|%s: base %.3f over a plinth of %.3f" % (o.name, shaft_r * 1.26, half_plinth))
    material = o.data.materials[0] if o.data.materials else bpy.data.materials["MAT_Trim_Cream"]
    old = o.data
    o.data = lathe_mesh(old.name, attic_base(shaft_r, z1 - z0), centre, z0, material)
    # The mesh is in world space now: the object carries no transform.
    o.matrix_world.identity()
    if old.users == 0:
        bpy.data.meshes.remove(old)
    bases += 1
print("REFINE|bases %d" % bases)

# ------------------------------------------------- 2. the apron's architrave
panel = bpy.data.objects.get("stair_apron_panel")
if panel is not None:
    lo, hi = world_box(panel)
    trim = bpy.data.materials["MAT_Trim_Cream"]
    face = lo.y                      # the panel's face toward the entry
    w, proud = 0.11, 0.045          # the architrave's width and projection
    y0, y1 = face - proud, face + 0.02
    pieces = [
        ((lo.x - w, y0, lo.z - 0.02), (lo.x, y1, hi.z + w)),          # left
        ((hi.x, y0, lo.z - 0.02), (hi.x + w, y1, hi.z + w)),          # right
        ((lo.x, y0, hi.z), (hi.x, y1, hi.z + w)),                     # head
        # the inner bead, a step back from the face
        ((lo.x, face - 0.018, lo.z), (lo.x + 0.03, y1, hi.z)),
        ((hi.x - 0.03, face - 0.018, lo.z), (hi.x, y1, hi.z)),
        ((lo.x + 0.03, face - 0.018, hi.z - 0.03), (hi.x - 0.03, y1, hi.z)),
        # a cap over the head, so the frame ends in a moulding and not an edge
        ((lo.x - w - 0.03, y0 - 0.025, hi.z + w), (hi.x + w + 0.03, y1, hi.z + w + 0.05)),
    ]
    for k, (a, b) in enumerate(pieces):
        box_mesh("stair_apron_frame_%d" % k, a, b, trim)
    print("REFINE|apron frame %d pieces" % len(pieces))

bpy.ops.wm.save_as_mainfile(filepath=OUT)
print("REFINE|saved", OUT)
