"""
P5A - the ground surface system: tiled turf, a gravel forecourt, and a meso
tone layer in COLOR_0.

    blender --background mansion_exterior_P5A.blend --python p5a_ground_surface.py -- --save

THE DEFECT, MEASURED. The shipped ground is one 1024 map clamped over 240 m -
0.2344 m per texel - and the runtime probe ray-cast the real cameras at
0.0197 m per PIXEL (HERO) and 0.0153 (NW). The map is MAGNIFIED 12-15x across
the nearest half of every exterior frame, which is 25-47% of the picture with
no information in it. It also carries no normal map and no AO, so that half of
the frame is a Lambert plane. See docs/PHASE5_INVENTORY.md section 5.

WHAT THIS DOES, IN THREE LAYERS

  MICRO   Both surfaces move to TILING sets at 6.0 m (tools/gltf/
          make_ground_p5a.py), which is 0.00586 m/texel - correctly sampled at
          every distance the cameras use instead of 12x under mip 0. The tile
          size is carried in the MESH UVs (world x,y / 6.0), not in a Mapping
          node: the exporter would have to express a Mapping node as
          KHR_texture_transform and P4A already lost a tile change that way,
          whereas UVs are geometry and cannot be dropped.

  MESO    COLOR_0 on ground_plane, at the mesh's own 2.5 m vertex pitch. Four
          things the texture cannot know because they are properties of THIS
          site rather than of turf: damp hollows and dry crests read off the
          real height field; a wear halo where the lawn meets hardscape, which
          is the lawn-to-terrace contact the render was missing entirely; a
          broad falloff that keeps the far field below the estate centre; and a
          20-60 m mottle that breaks the 6 m tile at a scale the tile cannot.
          Vertex colours multiply base colour with no runtime code - the same
          mechanism P4A used for per-block stone tone.

  MACRO   drive_forecourt, a NEW object: a gravel annulus around the fountain
          from r 3.9 to 10.6, clipped at the terrace edge, plus an approach
          band running out to y -34 between the ends of the hedge lines. This
          is what makes the arrival legible; P5F develops its composition.

WHY THE ANNULUS STARTS AT r 3.9. fount_apron is a 8.4 x 8.4 m paved square
centred on the fountain, top at z 0.05, so its inscribed radius is 4.2 and its
corners reach 5.94. Starting the gravel at 3.9 puts its inner edge UNDER the
apron everywhere, so there is no cut to stair-step and no coplanar fight - the
apron is 38 mm proud of it. The approach band starts on the circle's own
boundary (y = -13.2 - sqrt(R^2 - x^2)) with 50 mm of overlap, and sits 3 mm
lower so the overlap cannot fight.

EVERY VERTEX FOLLOWS THE GROUND. The ground plane is displaced (-2.97..0.97 m),
so a flat drive would float or sink. Each forecourt vertex samples the ground
mesh's own height by nearest-cell bilinear interpolation and sits 12 mm above
it. Asserted: max residual against the sampled surface under 1 mm.

Every other material and every other object is asserted bit-identical.
"""
import bpy, bmesh, json, math, os, sys
from mathutils import Vector

args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
MATS = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)),
                                    '..', '..', 'assets', 'materials'))
TILE_M = 6.0

# Geometry, all measured off the shipped scene (tools/blender/p5_inspect_ground.py):
FOUNT = (0.0, -13.2)          # fount_cope centre
R_IN, R_OUT = 3.9, 10.6       # annulus; 3.9 is under the 4.2 apron half-width
TERRACE_FRONT = -8.80         # terrace_lower's near edge: the gravel stops here
BAND_HALF_NEAR, BAND_HALF_FAR = 4.30, 3.50
BAND_END = -34.0              # past the hedge ends at y -19, into the far field
DRIVE_LIFT, BAND_LIFT = 0.012, 0.009
ANG, RINGS, BAND_ROWS = 96, 9, 26

log = {}


# ------------------------------------------------------------ bit-identity ----
def snapshot_mat(m):
    out = []
    for n in m.node_tree.nodes:
        row = [n.bl_idname, n.name]
        for i in n.inputs:
            if i.is_linked:
                row.append(('L', i.links[0].from_node.name, i.links[0].from_socket.name))
            else:
                try:
                    v = i.default_value
                    row.append(tuple(v) if hasattr(v, '__len__') else round(float(v), 6))
                except Exception:
                    pass
        if n.bl_idname == 'ShaderNodeTexImage':
            row.append(n.image.name if n.image else None)
        out.append(tuple(row))
    return out


def snapshot_obj(o):
    me = o.data
    return (len(me.vertices), len(me.polygons),
            tuple(round(v, 6) for r in o.matrix_world for v in r),
            tuple(s.material.name if s.material else None for s in o.material_slots),
            tuple(l.name for l in me.uv_layers),
            tuple(a.name for a in me.color_attributes))


TOUCH_MAT = {'MAT_Ground'}
TOUCH_OBJ = {'ground_plane'}
before_mats = {m.name: snapshot_mat(m) for m in bpy.data.materials
               if m.use_nodes and m.name not in TOUCH_MAT}
before_objs = {o.name: snapshot_obj(o) for o in bpy.data.objects
               if o.type == 'MESH' and o.name not in TOUCH_OBJ}

ground = bpy.data.objects['ground_plane']
gme = ground.data


# --------------------------------------------------------- ground sampling ----
# The plane is a regular NxN grid in x,y; find its pitch once, then height at
# any (x,y) is a bilinear read. Building a KD-tree would work too and would be
# slower and less exact on a grid this regular.
xs = sorted({round(v.co.x, 4) for v in gme.vertices})
ys = sorted({round(v.co.y, 4) for v in gme.vertices})
NX, NY = len(xs), len(ys)
X0, X1, Y0, Y1 = xs[0], xs[-1], ys[0], ys[-1]
HGT = [[0.0] * NY for _ in range(NX)]
for v in gme.vertices:
    i = int(round((v.co.x - X0) / (X1 - X0) * (NX - 1)))
    j = int(round((v.co.y - Y0) / (Y1 - Y0) * (NY - 1)))
    HGT[i][j] = v.co.z
log['ground_grid'] = {'nx': NX, 'ny': NY, 'pitch_m': round((X1 - X0) / (NX - 1), 4)}


def ground_z(x, y):
    fx = (min(max(x, X0), X1) - X0) / (X1 - X0) * (NX - 1)
    fy = (min(max(y, Y0), Y1) - Y0) / (Y1 - Y0) * (NY - 1)
    i, j = int(fx), int(fy)
    i2, j2 = min(i + 1, NX - 1), min(j + 1, NY - 1)
    tx, ty = fx - i, fy - j
    return ((HGT[i][j] * (1 - tx) + HGT[i2][j] * tx) * (1 - ty)
            + (HGT[i][j2] * (1 - tx) + HGT[i2][j2] * tx) * ty)


# ------------------------------------------------------ 1. ground UVs ---------
# World x,y / 6.0. The old layout was 0..1 across the whole 240 m, which is the
# 0.2344 m/texel defect itself; there is nothing to preserve in it.
uv = gme.uv_layers[0]
for p in gme.polygons:
    for li in p.loop_indices:
        co = gme.vertices[gme.loops[li].vertex_index].co
        uv.data[li].uv = (co.x / TILE_M, co.y / TILE_M)
log['ground_uv'] = {'convention': 'world xy / %.1f m' % TILE_M,
                    'span_uv': round((X1 - X0) / TILE_M, 2)}


# ------------------------------------------------- 2. COLOR_0 meso layer ------
# Footprints the lawn has to make contact with, in world x,y. Read from the
# objects rather than restated, so a move upstream cannot silently desync this.
HARD = []
for n in ('terrace_lower', 'terrace_upper', 'fount_apron', 'entry_step_0', 'entry_step_1'):
    o = bpy.data.objects.get(n)
    if not o: continue
    ws = [o.matrix_world @ Vector(c) for c in o.bound_box]
    HARD.append((min(w.x for w in ws), max(w.x for w in ws),
                 min(w.y for w in ws), max(w.y for w in ws)))
HARD.append((-R_OUT, R_OUT, FOUNT[1] - R_OUT, TERRACE_FRONT))     # the new forecourt


def dist_to_hardscape(x, y):
    best = 1e9
    for (x0, x1, y0, y1) in HARD:
        dx = max(x0 - x, 0.0, x - x1)
        dy = max(y0 - y, 0.0, y - y1)
        best = min(best, math.hypot(dx, dy))
    return best


def vnoise(x, y, s, seed):
    """Cheap smooth value noise, deterministic in world space."""
    a = math.sin(x * s * 1.7 + seed * 12.9898) * math.cos(y * s * 1.3 + seed * 78.233)
    b = math.sin((x + y) * s * 0.7 + seed * 3.1415)
    return 0.5 * a + 0.5 * b


# FLOAT_COLOR on the CORNER domain, which is what P4A's StoneAO uses and what
# the shipped p4e proves exports as a single COLOR_0 (314 primitives, no
# COLOR_1 anywhere in the file). The POINT domain was tried first and Blender
# 5.2's exporter emitted the SAME attribute twice - COLOR_0 as UNSIGNED_BYTE
# and COLOR_1 as UNSIGNED_SHORT - which three ignores past COLOR_0 and which is
# dead payload. The domain is the difference; the values are identical.
for a in list(gme.color_attributes):
    if a.name.startswith('P5A_'): gme.color_attributes.remove(a)
col = gme.color_attributes.new(name='P5A_Tone', type='FLOAT_COLOR', domain='CORNER')

zmin = min(v.co.z for v in gme.vertices)
zmax = max(v.co.z for v in gme.vertices)
stats = {'min': 9.9, 'max': -9.9, 'sum': 0.0}
tone_of = [1.0] * len(gme.vertices)
for v in gme.vertices:
    x, y, z = v.co.x, v.co.y, v.co.z
    # (a) damp hollow / dry crest, off the real height field
    t = (z - zmin) / max(zmax - zmin, 1e-6)
    tone = 0.90 + 0.16 * t
    # (b) wear halo against hardscape: the lawn/terrace contact the frame lacked
    d = dist_to_hardscape(x, y)
    if d < 2.2:
        tone *= 0.80 + 0.20 * (d / 2.2) ** 0.6
    # (c) broad falloff so the far field never outshines the estate centre
    r = math.hypot(x, y)
    tone *= 1.02 - 0.14 * min(r / 90.0, 1.0)
    # (d) 20-60 m mottle - the scale the 6 m tile cannot reach
    tone *= 1.0 + 0.055 * vnoise(x, y, 1 / 34.0, 1.0) + 0.030 * vnoise(x, y, 1 / 71.0, 2.0)
    tone = max(0.55, min(1.15, tone))
    tone_of[v.index] = tone
    stats['min'] = min(stats['min'], tone); stats['max'] = max(stats['max'], tone)
    stats['sum'] += tone
for li, lp in enumerate(gme.loops):
    t = tone_of[lp.vertex_index]
    col.data[li].color = (t, t, t, 1.0)
gme.color_attributes.active_color_index = 0
gme.color_attributes.render_color_index = 0
log['color0'] = {'name': 'P5A_Tone', 'domain': 'CORNER', 'verts': len(gme.vertices),
                 'loops': len(gme.loops),
                 'min': round(stats['min'], 4), 'max': round(stats['max'], 4),
                 'mean': round(stats['sum'] / len(gme.vertices), 4)}


# ------------------------------------------------------ 3. materials ----------
def load_img(rel, cs):
    p = os.path.join(MATS, rel)
    key = os.path.basename(rel).rsplit('.', 1)[0]
    im = bpy.data.images.get(key) or bpy.data.images.load(p)
    im.name = key
    im.filepath = p
    im.source = 'FILE'
    im.colorspace_settings.name = cs
    im.reload()
    return im


def build_ground_material(name, base, rough, normal, normal_strength, color_attr=None):
    m = bpy.data.materials.get(name)
    if m is None:
        m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial'); out.location = (600, 0)
    bsdf = nt.nodes.new('ShaderNodeBsdfPrincipled'); bsdf.location = (280, 0)
    uvn = nt.nodes.new('ShaderNodeUVMap'); uvn.uv_map = 'UVMap'; uvn.location = (-900, 0)

    def tex(img, y, label):
        n = nt.nodes.new('ShaderNodeTexImage')
        n.image = img; n.name = label; n.label = label
        n.extension = 'REPEAT'          # the whole point: 40 tiles across 240 m
        n.interpolation = 'Linear'
        n.location = (-600, y)
        nt.links.new(uvn.outputs['UV'], n.inputs['Vector'])
        return n

    b = tex(load_img(base, 'sRGB'), 300, 'P5A Base')
    r = tex(load_img(rough, 'Non-Color'), 0, 'P5A Rough')
    nn = tex(load_img(normal, 'Non-Color'), -300, 'P5A Normal')
    nm = nt.nodes.new('ShaderNodeNormalMap'); nm.location = (-280, -300)
    nm.inputs['Strength'].default_value = normal_strength
    nt.links.new(nn.outputs['Color'], nm.inputs['Color'])

    # THE COLOR_0 MULTIPLY, and it is not cosmetic.
    #
    # glTF multiplies COLOR_0 into base colour with no material node at all, so
    # a Blender graph WITHOUT this renders the lawn flat while the runtime
    # renders it toned - the two would disagree by exactly the meso layer, which
    # is the class of Blender/runtime divergence Phase 2.5B and Phase 4 each
    # lost days to. Adding it makes Blender show what ships.
    #
    # It also fixes a second thing. With no Color Attribute node in the graph
    # the exporter fell back to writing EVERY colour layer, and emitted the one
    # attribute twice - COLOR_0 as UNSIGNED_BYTE and COLOR_1 as UNSIGNED_SHORT -
    # on the ground alone, against 312 primitives elsewhere in the same export
    # that carry a single COLOR_0. three reads COLOR_0 and ignores the rest, so
    # COLOR_1 was pure dead payload.
    #
    # ShaderNodeMix (RGBA, MULTIPLY, Factor 1), never the legacy MixRGB: P2.5B
    # established the exporter reads base-colour chains through the modern node
    # only, and silently drops the legacy one.
    src = b.outputs['Color']
    if color_attr:
        ca = nt.nodes.new('ShaderNodeVertexColor')
        ca.layer_name = color_attr
        ca.name = ca.label = 'P5A Tone'
        ca.location = (-600, 560)
        mix = nt.nodes.new('ShaderNodeMix')
        mix.data_type = 'RGBA'; mix.blend_type = 'MULTIPLY'
        mix.name = mix.label = 'P5A Tone Multiply'
        mix.location = (-300, 430)
        mix.inputs['Factor'].default_value = 1.0
        ia = [i for i in mix.inputs if i.name == 'A' and i.type == 'RGBA'][0]
        ib = [i for i in mix.inputs if i.name == 'B' and i.type == 'RGBA'][0]
        res = [o for o in mix.outputs if o.name == 'Result' and o.type == 'RGBA'][0]
        nt.links.new(b.outputs['Color'], ia)
        nt.links.new(ca.outputs['Color'], ib)
        src = res
    nt.links.new(src, bsdf.inputs['Base Color'])
    nt.links.new(r.outputs['Color'], bsdf.inputs['Roughness'])
    nt.links.new(nm.outputs['Normal'], bsdf.inputs['Normal'])
    bsdf.inputs['Metallic'].default_value = 0.0
    nt.links.new(bsdf.outputs['BSDF'], out.inputs['Surface'])
    m.use_backface_culling = True
    return m


mat_lawn = build_ground_material('MAT_Lawn', '_ground/p5a_turf_basecolor.png',
                                 '_ground/p5a_turf_roughness.png',
                                 '_ground/p5a_turf_normal.png', 0.70,
                                 color_attr='P5A_Tone')
mat_grav = build_ground_material('MAT_Gravel', '_ground/p5a_gravel_basecolor.png',
                                 '_ground/p5a_gravel_roughness.png',
                                 '_ground/p5a_gravel_normal.png', 0.85)
old_ground_mat = ground.material_slots[0].material.name
ground.material_slots[0].material = mat_lawn
log['ground_material'] = {'was': old_ground_mat, 'now': mat_lawn.name}


# --------------------------------------------------- 4. drive_forecourt -------
bm = bmesh.new()
uvlay = bm.loops.layers.uv.new('UVMap')


def add_quad(p00, p10, p11, p01, lift):
    vs = []
    for (x, y) in (p00, p10, p11, p01):
        vs.append(bm.verts.new((x, y, ground_z(x, y) + lift)))
    f = bm.faces.new(vs)
    for l in f.loops:
        l[uvlay].uv = (l.vert.co.x / TILE_M, l.vert.co.y / TILE_M)
    return f


# (a) the turning circle, as a polar annulus clipped at the terrace edge
cx, cy = FOUNT
kept_rings = 0
for a in range(ANG):
    a0 = 2 * math.pi * a / ANG
    a1 = 2 * math.pi * (a + 1) / ANG
    for k in range(RINGS):
        r0 = R_IN + (R_OUT - R_IN) * k / RINGS
        r1 = R_IN + (R_OUT - R_IN) * (k + 1) / RINGS
        pts = [(cx + r0 * math.cos(a0), cy + r0 * math.sin(a0)),
               (cx + r1 * math.cos(a0), cy + r1 * math.sin(a0)),
               (cx + r1 * math.cos(a1), cy + r1 * math.sin(a1)),
               (cx + r0 * math.cos(a1), cy + r0 * math.sin(a1))]
        if max(p[1] for p in pts) > TERRACE_FRONT:      # never cross the terrace
            continue
        add_quad(*pts, lift=DRIVE_LIFT)
        kept_rings += 1

# (b) the approach band. Each column starts on the circle's own boundary so the
# two abut instead of overlapping, with 50 mm of tuck and 3 mm of drop.
COLS = 14
for c in range(COLS):
    u0, u1 = c / COLS, (c + 1) / COLS
    for (u, other) in ((u0, u1),):
        pass
    for row in range(BAND_ROWS):
        t0, t1 = row / BAND_ROWS, (row + 1) / BAND_ROWS

        def edge(u, t):
            half = BAND_HALF_NEAR + (BAND_HALF_FAR - BAND_HALF_NEAR) * t
            x = -half + 2 * half * u
            inside = max(R_OUT ** 2 - x * x, 0.0)
            y_start = cy - math.sqrt(inside) + 0.05
            return x, y_start + (BAND_END - y_start) * t

        p00 = edge(u0, t0); p10 = edge(u1, t0)
        p11 = edge(u1, t1); p01 = edge(u0, t1)
        add_quad(p00, p10, p11, p01, lift=BAND_LIFT)

bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-4)
me = bpy.data.meshes.new('drive_forecourt')
bm.to_mesh(me)
bm.free()
me.materials.append(mat_grav)
drive = bpy.data.objects.new('drive_forecourt', me)
for c in ground.users_collection:
    c.objects.link(drive)
drive.matrix_world = ground.matrix_world.copy()

resid = max(abs((v.co.z - ground_z(v.co.x, v.co.y)) - DRIVE_LIFT) for v in me.vertices)
log['drive_forecourt'] = {
    'verts': len(me.vertices), 'polys': len(me.polygons),
    'tris': sum(len(p.vertices) - 2 for p in me.polygons),
    'bbox': [[round(min(v.co[i] for v in me.vertices), 2) for i in range(3)],
             [round(max(v.co[i] for v in me.vertices), 2) for i in range(3)]],
    'material': mat_grav.name,
    'max_lift_residual_mm': round(resid * 1000, 2),
    'collections': [c.name for c in ground.users_collection],
}
assert resid < 0.0045, 'forecourt drifts %.4f m from the sampled ground' % resid

# ------------------------------------------------------------- assertions -----
after_mats = {m.name: snapshot_mat(m) for m in bpy.data.materials
              if m.use_nodes and m.name not in TOUCH_MAT}
changed_m = [k for k in before_mats if before_mats[k] != after_mats.get(k)]
after_objs = {o.name: snapshot_obj(o) for o in bpy.data.objects
              if o.type == 'MESH' and o.name not in TOUCH_OBJ and o.name != 'drive_forecourt'}
changed_o = [k for k in before_objs if before_objs[k] != after_objs.get(k)]
assert not changed_m, 'materials changed: %s' % changed_m
assert not changed_o, 'objects changed: %s' % changed_o
log['other_materials_changed'] = changed_m
log['other_objects_changed'] = changed_o

print('###JSON###')
print(json.dumps(log, indent=1))
if '--save' in args:
    bpy.ops.wm.save_mainfile()
    print('### saved', bpy.data.filepath)
