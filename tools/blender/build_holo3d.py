"""
Build the tilted, extruded hologram tables for S1 / S2.

Three things the client asked for, and why each is geometry rather than a
texture trick:

  1. Drafting tilt. A plan lying flat at z=1.445 is seen from eye level at a
     ~6 degree grazing angle - foreshortening crushes it to a line. Raked to
     38 degrees about its NEAR edge (so the near edge stays put and the far
     edge lifts), the same camera sees it at ~31 degrees. Five times the
     readable area, and the pedestal cap is never fouled.
  2. Real extrusion. Plot blocks, pads and landscape become prisms with top
     faces and side walls, so the display keeps a silhouette in profile.
     Roads are simply not built - they stay at plate level and read as the
     negative space between blocks, which is how a physical model works.
  3. Upright callouts. Labels live on world-vertical cards floating above the
     plan on leader lines, not baked into the floor texture. They are children
     of the station empty with the tilt cancelled out, so they stay upright
     and square to the approach vector however the table is posed.

    blender <file.blend> --python build_holo3d.py        (or exec via MCP)
"""
import bpy, bmesh, json, math, os, mathutils
from mathutils import Vector, Matrix
from mathutils.geometry import tessellate_polygon

ROOT = r"C:\dev\estate\assets\floorplans"
TILT = math.radians(38.0)
NEAR_Z = 1.200                     # near edge; low enough to sit ON its pedestal

# u,v are fractions of the SOURCE image with v measured from the top, because
# that is how they were read off the sheet.
STATIONS = {
    "S1": {
        "cells": "kartikeya_cells.json",
        "tex":   "kartikeya_holo_tex.png",
        "mat":   "MAT_Holo_Kartikeya",
        "wm": 1.020, "hm": 0.992,          # local X, local Y
        "at": (-5.95, -1.90), "yaw": math.radians(90.0),
        "title": ("KARTIKEYA WATER FRONT", "GATED PLOT DEVELOPMENT", 0.50, 0.03),
        "calls": [("LAKE", 0.90, 0.38), ("CLUB HOUSE", 0.30, 0.19),
                  ("PARK", 0.09, 0.71)],
    },
    "S2": {
        "cells": "lucky_cells.json",
        "tex":   "lucky_holo_tex.png",
        "mat":   "MAT_Holo_LuckyGarden",
        "wm": 1.100, "hm": 0.652,
        "at": (-4.60, 3.80), "yaw": 0.0,
        "title": ("LUCKY GARDEN", "KUMARAM VILLAGE  \u00b7  VIZIANAGARAM", 0.50, 0.04),
        "calls": [("FUTURE EXTENSION", 0.34, 0.33), ("RESORT", 0.83, 0.72)],
    },
}

sc = bpy.context.scene
COL = bpy.data.collections["COL_Interior"]


def purge(prefix):
    for o in [o for o in bpy.data.objects if o.name.startswith(prefix)]:
        bpy.data.objects.remove(o, do_unlink=True)


def link(o):
    for c in list(o.users_collection):
        c.objects.unlink(o)
    COL.objects.link(o)
    return o


# --------------------------------------------------------------------- shaders
PLATE_EMIT = 2.6                    # was 4.4 - grazing views stacked the
BLOCK_EMIT = 2.6                    # emissive layers and clipped to white


def load_tex(fname):
    path = os.path.join(ROOT, fname)
    for im in bpy.data.images:
        if im.filepath and os.path.normcase(bpy.path.abspath(im.filepath)) == \
                os.path.normcase(path):
            im.reload()
            return im
    return bpy.data.images.load(path, check_existing=True)


def retune_plate(mat_name, image):
    """Point the existing plate material at the re-masked artwork and take the
    emission down; the rims are what should carry the highlight now."""
    m = bpy.data.materials[mat_name]
    for n in m.node_tree.nodes:
        if n.type == 'TEX_IMAGE':
            n.image = image
            n.interpolation = 'Cubic'
        elif n.type == 'EMISSION':
            n.inputs['Strength'].default_value = PLATE_EMIT
    return m


def mat_top(name, image):
    """Plan artwork on the block tops, with an alpha floor so an unsold
    (white, therefore fully transparent) plot still reads as a glass lid."""
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True
    m.blend_method = 'BLEND'
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial'); out.location = (600, 0)
    mix = nt.nodes.new('ShaderNodeMixShader');      mix.location = (400, 0)
    tr = nt.nodes.new('ShaderNodeBsdfTransparent'); tr.location = (200, 120)
    em = nt.nodes.new('ShaderNodeEmission');        em.location = (200, -80)
    tex = nt.nodes.new('ShaderNodeTexImage');       tex.location = (-200, 0)
    mx = nt.nodes.new('ShaderNodeMath');            mx.location = (0, -220)
    tex.image = image
    tex.interpolation = 'Cubic'
    em.inputs['Strength'].default_value = BLOCK_EMIT
    mx.operation = 'MAXIMUM'
    mx.inputs[1].default_value = 0.13
    nt.links.new(tex.outputs['Color'], em.inputs['Color'])
    nt.links.new(tex.outputs['Alpha'], mx.inputs[0])
    nt.links.new(mx.outputs[0], mix.inputs['Fac'])
    nt.links.new(tr.outputs[0], mix.inputs[1])
    nt.links.new(em.outputs[0], mix.inputs[2])
    nt.links.new(mix.outputs[0], out.inputs['Surface'])
    return m


def mat_side(name):
    """Side walls: transparent at the base, hot at the rim.

    The gradient rides a per-vertex 'rim' attribute rather than object Z,
    because the prisms are 6mm to 42mm tall and an absolute-height ramp would
    leave the low pads unlit. Raising it to a high power confines the bright
    band to the top few millimetres, which is what reads as an edge accent.
    """
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True
    m.blend_method = 'BLEND'
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial'); out.location = (700, 0)
    mix = nt.nodes.new('ShaderNodeMixShader');      mix.location = (500, 0)
    tr = nt.nodes.new('ShaderNodeBsdfTransparent'); tr.location = (300, 120)
    em = nt.nodes.new('ShaderNodeEmission');        em.location = (300, -100)
    ramp = nt.nodes.new('ShaderNodeValToRGB');      ramp.location = (60, -100)
    pw = nt.nodes.new('ShaderNodeMath');            pw.location = (60, 140)
    at = nt.nodes.new('ShaderNodeAttribute');       at.location = (-160, 0)
    at.attribute_name = "rim"
    pw.operation = 'POWER'
    pw.inputs[1].default_value = 9.0
    ramp.color_ramp.elements[0].position = 0.0
    ramp.color_ramp.elements[0].color = (0.030, 0.065, 0.080, 1)
    ramp.color_ramp.elements[1].position = 1.0
    ramp.color_ramp.elements[1].color = (1.0, 0.930, 0.800, 1)
    e = ramp.color_ramp.elements.new(0.74)
    e.color = (0.62, 0.66, 0.58, 1)
    # The rim has to out-run the plan artwork it sits on, or the extrusion
    # reads as a soft step instead of a lit edge.
    em.inputs['Strength'].default_value = 4.0
    nt.links.new(at.outputs['Color'], ramp.inputs['Fac'])
    nt.links.new(at.outputs['Color'], pw.inputs[0])
    nt.links.new(ramp.outputs['Color'], em.inputs['Color'])
    nt.links.new(pw.outputs[0], mix.inputs['Fac'])
    nt.links.new(tr.outputs[0], mix.inputs[1])
    nt.links.new(em.outputs[0], mix.inputs[2])
    nt.links.new(mix.outputs[0], out.inputs['Surface'])
    return m


def mat_flat(name, col, strength, alpha=1.0):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True
    m.blend_method = 'BLEND'
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial'); out.location = (400, 0)
    em = nt.nodes.new('ShaderNodeEmission');        em.location = (200, -60)
    em.inputs['Color'].default_value = (col[0], col[1], col[2], 1)
    em.inputs['Strength'].default_value = strength
    if alpha >= 1.0:
        nt.links.new(em.outputs[0], out.inputs['Surface'])
        return m
    mix = nt.nodes.new('ShaderNodeMixShader');      mix.location = (300, 0)
    tr = nt.nodes.new('ShaderNodeBsdfTransparent'); tr.location = (200, 120)
    mix.inputs['Fac'].default_value = alpha
    nt.links.new(tr.outputs[0], mix.inputs[1])
    nt.links.new(em.outputs[0], mix.inputs[2])
    nt.links.new(mix.outputs[0], out.inputs['Surface'])
    return m


# ------------------------------------------------------------------- geometry
def build_blocks(name, data, wm, hm, mtop, mside):
    """One mesh per station holding every prism: material 0 = tops, 1 = walls."""
    verts, faces, mats, rim, uvs = [], [], [], [], []

    def P(u, v, z):
        verts.append(((u - 0.5) * wm, (v - 0.5) * hm, z))
        rim.append(0.0)
        return len(verts) - 1

    for cell in data["cells"]:
        h = cell["h"]
        rings = [r for r in cell["rings"] if len(r) >= 3]
        holes = [r for r in cell.get("holes", []) if len(r) >= 3]
        if not rings:
            continue

        # ---- top face: tessellate_polygon takes the outer ring plus its holes
        # and returns triangles indexed into their concatenation, so holes come
        # out as real holes rather than needing a boolean.
        polys = [[Vector(((p[0] - 0.5) * wm, (p[1] - 0.5) * hm, 0.0)) for p in rings[0]]]
        for hl in holes:
            polys.append([Vector(((p[0] - 0.5) * wm, (p[1] - 0.5) * hm, 0.0)) for p in hl])
        flat = [p for poly in polys for p in poly]
        base = len(verts)
        for poly, src in zip(polys, [rings[0]] + holes):
            for p in src:
                P(p[0], p[1], h)
        for a in range(base, len(verts)):
            rim[a] = 1.0
        try:
            tris = tessellate_polygon(polys)
        except Exception:
            tris = []
        for t in tris:
            faces.append((base + t[0], base + t[1], base + t[2]))
            mats.append(0)

        # ---- side walls, one quad strip per ring
        off = base
        for src in [rings[0]] + holes:
            n = len(src)
            low = [P(p[0], p[1], 0.0) for p in src]
            for i in range(n):
                j = (i + 1) % n
                faces.append((low[i], low[j], off + j, off + i))
                mats.append(1)
            off += n

    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], faces)
    me.update()
    for p, mi in zip(me.polygons, mats):
        p.material_index = mi
    me.materials.append(mtop)
    me.materials.append(mside)

    uv = me.uv_layers.new(name="UVMap")
    for li, l in enumerate(me.loops):
        co = me.vertices[l.vertex_index].co
        uv.data[li].uv = (co.x / wm + 0.5, co.y / hm + 0.5)

    ca = me.color_attributes.new(name="rim", type='FLOAT_COLOR', domain='POINT')
    for i, r in enumerate(rim):
        ca.data[i].color = (r, r, r, 1.0)

    me.shade_flat()
    o = bpy.data.objects.new(name, me)
    return link(o)


def build_plate(name, wm, hm, mat):
    me = bpy.data.meshes.new(name)
    me.from_pydata([(-wm / 2, -hm / 2, 0), (wm / 2, -hm / 2, 0),
                    (wm / 2, hm / 2, 0), (-wm / 2, hm / 2, 0)], [], [(0, 1, 2, 3)])
    me.update()
    uv = me.uv_layers.new(name="UVMap")
    for li, l in enumerate(me.loops):
        co = me.vertices[l.vertex_index].co
        uv.data[li].uv = (co.x / wm + 0.5, co.y / hm + 0.5)
    me.materials.append(mat)
    o = bpy.data.objects.new(name, me)
    sol = o.modifiers.new("thk", 'SOLIDIFY')
    sol.thickness = 0.002
    sol.offset = 0.0
    return link(o)


def text_obj(name, body, size, mat, align='CENTER'):
    cu = bpy.data.curves.new(name, type='FONT')
    cu.body = body
    cu.size = size
    cu.align_x = align
    cu.align_y = 'CENTER'
    cu.space_character = 1.28          # tracked-out caps read as considered
    cu.extrude = 0.0004
    for path in (r"C:\Windows\Fonts\bahnschrift.ttf", r"C:\Windows\Fonts\segoeui.ttf"):
        if os.path.exists(path):
            try:
                cu.font = bpy.data.fonts.load(path, check_existing=True)
                break
            except Exception:
                pass
    cu.materials.append(mat)
    return link(bpy.data.objects.new(name, cu))


def quad(name, w, h, mat, z=0.0):
    me = bpy.data.meshes.new(name)
    me.from_pydata([(-w / 2, -h / 2, z), (w / 2, -h / 2, z),
                    (w / 2, h / 2, z), (-w / 2, h / 2, z)], [], [(0, 1, 2, 3)])
    me.update()
    me.materials.append(mat)
    return link(bpy.data.objects.new(name, me))


def leader(name, length, mat, r=0.0009):
    """Thin vertical rod from the plan up to the card."""
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=8, radius1=r, radius2=r,
                          depth=length)
    bmesh.ops.translate(bm, verts=bm.verts, vec=(0, 0, length / 2))
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me); bm.free()
    me.materials.append(mat)
    return link(bpy.data.objects.new(name, me))


# ----------------------------------------------------------------------- build
purge("holo3d_")
purge("HOLO_")
for n in ("holoplan_S1", "holoplan_S2"):
    if n in bpy.data.objects:
        bpy.data.objects.remove(bpy.data.objects[n], do_unlink=True)

M_SIDE = mat_side("MAT_Holo3D_Side")
M_GOLD = mat_flat("MAT_Holo3D_Rule", (1.0, 0.80, 0.50), 9.0)
M_TEXT = mat_flat("MAT_Holo3D_Text", (1.0, 0.955, 0.885), 5.2)
M_SUB = mat_flat("MAT_Holo3D_Sub", (0.72, 0.86, 0.90), 3.0)
M_CARD = mat_flat("MAT_Holo3D_Card", (0.014, 0.040, 0.048), 1.5, alpha=0.58)

log = []
for key, S in STATIONS.items():
    data = json.load(open(os.path.join(ROOT, S["cells"])))
    wm, hm = S["wm"], S["hm"]
    ax, ay = S["at"]

    # Pivot about the NEAR edge: raise the empty by half the tilted depth so
    # the near edge lands exactly where the old flat plate sat.
    emp = bpy.data.objects.new("HOLO_%s" % key, None)
    emp.empty_display_size = 0.12
    link(emp)
    emp.location = (ax, ay, NEAR_Z + (hm / 2.0) * math.sin(TILT))
    emp.rotation_euler = (TILT, 0.0, S["yaw"])

    img = load_tex(S["tex"])
    mtop = mat_top("MAT_Holo3D_Top_%s" % key, img)
    mplate = retune_plate(S["mat"], img)

    plate = build_plate("holo3d_%s_plate" % key, wm, hm, mplate)
    blocks = build_blocks("holo3d_%s_blocks" % key, data, wm, hm, mtop, M_SIDE)
    for o in (plate, blocks):
        o.parent = emp

    # world-up expressed in the empty's local frame, for lifting cards
    up = Vector((0.0, math.sin(TILT), math.cos(TILT)))
    upright = math.radians(90.0) - TILT

    # Nudge along the card's own normal, not local Z, so the text clears the
    # pane by the same hair whatever the rake angle is.
    face = Vector((0.0, -math.cos(TILT), math.sin(TILT)))

    def place(o, u, vimg, lift, zbase=0.0):
        p = Vector(((u - 0.5) * wm, ((1.0 - vimg) - 0.5) * hm, zbase)) + up * lift
        o.parent = emp
        o.location = p
        o.rotation_euler = (upright, 0.0, 0.0)
        return p

    def card(tag, title, sub, u, vimg, lift, tsize, w):
        # The rod is modelled along its own +Z, so it needs the station tilt
        # cancelled - not the 90 degree stand-up the flat cards get - or it
        # lies down across the plan instead of rising from it.
        rod = leader("holo3d_%s_%s_leader" % (key, tag), lift, M_GOLD)
        rod.parent = emp
        rod.location = ((u - 0.5) * wm, ((1.0 - vimg) - 0.5) * hm, 0.004)
        rod.rotation_euler = (-TILT, 0.0, 0.0)

        dot = quad("holo3d_%s_%s_dot" % (key, tag), 0.010, 0.010, M_GOLD)
        dot.parent = emp
        dot.location = ((u - 0.5) * wm, ((1.0 - vimg) - 0.5) * hm, 0.004)

        h = tsize * (3.4 if sub else 2.3)
        pane = quad("holo3d_%s_%s_card" % (key, tag), w, h, M_CARD)
        place(pane, u, vimg, lift + h / 2.0)

        t = text_obj("holo3d_%s_%s_title" % (key, tag), title, tsize, M_TEXT)
        place(t, u, vimg, lift + h / 2.0 + (tsize * 0.55 if sub else 0.0))
        t.location += face * 0.0016

        rule = quad("holo3d_%s_%s_rule" % (key, tag), w * 0.42, 0.0011, M_GOLD)
        place(rule, u, vimg, lift + h / 2.0 - (tsize * 0.30 if sub else tsize * 0.85))
        rule.location += face * 0.0016

        if sub:
            s = text_obj("holo3d_%s_%s_sub" % (key, tag), sub, tsize * 0.46, M_SUB)
            place(s, u, vimg, lift + h / 2.0 - tsize * 0.95)
            s.location += face * 0.0016

    ttl, sub, tu, tv = S["title"]
    card("title", ttl, sub, tu, tv, 0.300, 0.0300, max(len(ttl), 22) * 0.0196)
    for i, (label, u, v) in enumerate(S["calls"]):
        card("c%d" % i, label, None, u, v, 0.140, 0.0170,
             max(len(label), 6) * 0.0142)

    nblk = len(blocks.data.polygons)
    log.append("%s|cells=%d|faces=%d|near_z=%.3f|far_z=%.3f" % (
        key, len(data["cells"]), nblk, NEAR_Z, NEAR_Z + hm * math.sin(TILT)))

# The projector cones read as opaque white slabs and were hidden earlier; the
# raked plate now needs them even less.
for n in ("holobeam_S1", "holobeam_S2", "holobeam_S3", "holobeam_S4"):
    if n in bpy.data.objects:
        bpy.data.objects[n].hide_render = True
        bpy.data.objects[n].hide_viewport = True

# Pre-existing defect, fixed while in here: these three inlays were authored in
# world space and then ALSO given the pedestal's yaw, so they were rotated a
# second time and ended up on the open floor. S2 (yaw 0) was unaffected.
moved = []
for n in ("pedestal_inlay_S1", "pedestal_inlay_S3", "pedestal_inlay_S4"):
    o = bpy.data.objects.get(n)
    if o and abs(o.rotation_euler.z) > 1e-4:
        o.rotation_euler = (0.0, 0.0, 0.0)
        moved.append(n)

result = {"stations": log, "inlays_fixed": moved}
print("BUILD|" + " ; ".join(log))
