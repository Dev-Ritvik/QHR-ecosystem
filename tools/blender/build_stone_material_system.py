"""
Build the exterior stone material system and assign it semantically.

WHAT THIS REPLACES
    One MAT_Stone_Cream carried 145 objects - walls, rustication, cornices,
    terraces, steps, fountain, finials - all sampling a granular conglomerate
    scan. Everything therefore read as the same aggregate surface with no
    architectural hierarchy.

THE FIVE STONE MATERIALS
    MAT_Stone_Wall    coursed ashlar, 405mm courses, 22mm joints
    MAT_Stone_Rustic  darker weathered stone surface for the base blocks
    MAT_Stone_Trim    dressed/carved stone, no coursing, cleaner and smoother
    MAT_Stone_Paving  900mm slabs, restrained joints, flatter
    MAT_Stone_Steps   cleanest stone, tread wear, for the entrance

    Roof, gold, wood, glass and vegetation are already separate and are left
    exactly as they are.

WHY THE UVs ARE RE-PROJECTED
    Measured metres-per-UV ranged from 0.07 to 7.9 across the stone objects, so
    a single tiling scale could not give every surface the same course height.
    Every stone object is re-projected as a world-axis box at exactly 1 UV unit
    per metre, with V on world Z for vertical faces - which is also what keeps
    courses horizontal and continuous around all four facades. Geometry is not
    touched; only the UV layer is rewritten.

CONTACT AO
    Cycles AO is baked to a vertex colour layer and multiplied into base colour,
    then darkened toward the ground so dirt gathers at the base and in recesses.
    Vertex colours ride out as COLOR_0, which glTF multiplies into base colour
    with no runtime code required.

    blender --background mansion_exterior.blend --python build_stone_material_system.py
"""
import bpy, os, json, math

D = bpy.data
scn = bpy.context.scene
vl = bpy.context.view_layer
STONE = r"C:\dev\estate\assets\materials\_stone"

# key -> (metres one tile spans, roughness scalar, normal strength)
SETS = {
    "wall":   {"tile": 3.24, "nrm": 1.00},
    "rustic": {"tile": 1.10, "nrm": 1.00},
    "trim":   {"tile": 1.20, "nrm": 0.85},
    "paving": {"tile": 3.60, "nrm": 0.90},
    "steps":  {"tile": 2.40, "nrm": 0.90},
}
MATNAME = {"wall": "MAT_Stone_Wall", "rustic": "MAT_Stone_Rustic",
           "trim": "MAT_Stone_Trim", "paving": "MAT_Stone_Paving",
           "steps": "MAT_Stone_Steps"}


def img(fn, non_color):
    p = os.path.join(STONE, fn)
    key = os.path.splitext(fn)[0]
    i = D.images.get(key)
    if i is None:
        i = D.images.load(p)
        i.name = key
    i.source = 'FILE'; i.filepath = p
    i.colorspace_settings.name = 'Non-Color' if non_color else 'sRGB'
    return i


def build_material(key):
    cfg = SETS[key]
    name = MATNAME[key]
    m = D.materials.get(name) or D.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial'); out.location = (760, 0)
    bs = nt.nodes.new('ShaderNodeBsdfPrincipled'); bs.location = (500, 0)
    nt.links.new(bs.outputs['BSDF'], out.inputs['Surface'])

    uv = nt.nodes.new('ShaderNodeUVMap'); uv.location = (-1000, 0)
    uv.uv_map = 'UVMap'
    mp = nt.nodes.new('ShaderNodeMapping'); mp.location = (-820, 0)
    s = 1.0 / cfg["tile"]          # UVs are 1 unit per metre
    mp.inputs['Scale'].default_value = (s, s, 1.0)
    nt.links.new(uv.outputs['UV'], mp.inputs['Vector'])

    def tex(suffix, non_color, y):
        n = nt.nodes.new('ShaderNodeTexImage'); n.location = (-560, y)
        n.image = img("%s_%s.png" % (key, suffix), non_color)
        n.extension = 'REPEAT'
        nt.links.new(mp.outputs['Vector'], n.inputs['Vector'])
        return n

    bc = tex("basecolor", False, 300)
    rg = tex("roughness", True, 0)
    nm = tex("normal", True, -300)

    # contact AO / ground dirt rides in a vertex colour layer
    ca = nt.nodes.new('ShaderNodeVertexColor'); ca.location = (-560, 560)
    ca.layer_name = 'StoneAO'
    mix = nt.nodes.new('ShaderNodeMixRGB'); mix.location = (-260, 380)
    mix.blend_type = 'MULTIPLY'
    mix.inputs['Fac'].default_value = 1.0
    nt.links.new(bc.outputs['Color'], mix.inputs['Color1'])
    nt.links.new(ca.outputs['Color'], mix.inputs['Color2'])
    nt.links.new(mix.outputs['Color'], bs.inputs['Base Color'])

    nt.links.new(rg.outputs['Color'], bs.inputs['Roughness'])
    nmap = nt.nodes.new('ShaderNodeNormalMap'); nmap.location = (-260, -300)
    nmap.inputs['Strength'].default_value = cfg["nrm"]
    nt.links.new(nm.outputs['Color'], nmap.inputs['Color'])
    nt.links.new(nmap.outputs['Normal'], bs.inputs['Normal'])

    bs.inputs['Metallic'].default_value = 0.0
    m.use_backface_culling = True
    return m


mats = {k: build_material(k) for k in SETS}

# ------------------------------------------------------- classification ----
def classify(n):
    if n == 'mansion_walls':
        return 'wall'
    if n.startswith('rustic_') or n.startswith('KIT_quoin'):
        return 'rustic'
    if n.startswith('entry_step') or n.startswith('entry_cheek'):
        return 'steps'
    if n in ('terrace_upper', 'terrace_lower', 'fount_apron', 'fount_floor'):
        return 'paving'
    if (n.startswith(('portico_', 'cupola_', 'finial_', 'fountain_', 'fount_'))
            or n in ('spire_plinth', 'lion_frieze')):
        return 'trim'
    return None


col = D.collections['COL_Exterior']
old = D.materials.get('MAT_Stone_Cream')
targets = []
for o in col.objects:
    if o.type != 'MESH' or not o.data or not o.data.vertices:
        continue
    if old is None or old not in list(o.data.materials):
        continue
    k = classify(o.name)
    if k is None:
        k = 'trim'          # anything unforeseen defaults to dressed stone
    targets.append((o, k))

# ------------------------------------------------ world-scale box UVs ------
def box_uv(o, scale=1.0):
    me = o.data
    uvl = me.uv_layers.get('UVMap') or me.uv_layers.new(name='UVMap')
    mw = o.matrix_world
    m3 = mw.to_3x3()
    for poly in me.polygons:
        n = m3 @ poly.normal
        ax = max(range(3), key=lambda i: abs(n[i]))
        for li in poly.loop_indices:
            w = mw @ me.vertices[me.loops[li].vertex_index].co
            if ax == 0:    u, v = w.y, w.z      # +-X faces: V is world Z
            elif ax == 1:  u, v = w.x, w.z      # +-Y faces: V is world Z
            else:          u, v = w.x, w.y      # horizontal: plan projection
            uvl.data[li].uv = (u / scale, v / scale)


done_meshes = set()
counts = {}
for o, k in targets:
    if o.data.name not in done_meshes:
        box_uv(o, 1.0)
        done_meshes.add(o.data.name)
    o.data.materials.clear()
    o.data.materials.append(mats[k])
    counts[k] = counts.get(k, 0) + 1

print("###ASSIGN###")
print(json.dumps({"assigned": counts, "objects": len(targets),
                  "meshes_reuved": len(done_meshes)}))

# ------------------------------------------------- baked contact / dirt ----
# Subtle, per the brief: AO darkens recesses and the ground line, and a height
# ramp adds the dirt that always collects at the base of a building. Both ride
# in one vertex colour layer so they cost no texture space and no runtime code.
prev_engine = scn.render.engine
scn.render.engine = 'CYCLES'
try:
    scn.cycles.device = 'GPU'
except Exception:
    pass
scn.cycles.samples = 12
scn.cycles.use_denoising = False
try:
    scn.render.bake.target = 'VERTEX_COLORS'
except Exception:
    pass

AO_FLOOR = 0.62        # how dark AO is allowed to go
DIRT_STRENGTH = 0.30   # extra darkening at the ground line
DIRT_TOP = 1.70        # metres above which no ground dirt is applied

def smoothstep(e0, e1, x):
    t = max(0.0, min(1.0, (x - e0) / (e1 - e0)))
    return t * t * (3 - 2 * t)

baked, failed = 0, []
for o, k in targets:
    me = o.data
    if me.color_attributes.get('StoneAO') is None:
        me.color_attributes.new('StoneAO', 'FLOAT_COLOR', 'CORNER')
    me.color_attributes.active_color = me.color_attributes['StoneAO']

for ob in vl.objects:
    ob.select_set(False)
sel = []
for o, k in targets:
    if o.visible_get():
        o.select_set(True); sel.append(o)
if sel:
    vl.objects.active = sel[0]
    try:
        bpy.ops.object.bake(type='AO', use_clear=True)
        baked = len(sel)
    except Exception as e:
        failed.append(str(e))

# fold in the ground-dirt ramp and lift AO so it stays subtle
for o, k in targets:
    me = o.data
    a = me.color_attributes.get('StoneAO')
    if a is None:
        continue
    mw = o.matrix_world
    for poly in me.polygons:
        for li in poly.loop_indices:
            z = (mw @ me.vertices[me.loops[li].vertex_index].co).z
            c = a.data[li].color
            ao = AO_FLOOR + (1.0 - AO_FLOOR) * max(0.0, min(1.0, c[0]))
            dirt = 1.0 - DIRT_STRENGTH * (1.0 - smoothstep(0.0, DIRT_TOP, z))
            v = ao * dirt
            # dirt is warm-grey, not neutral black
            a.data[li].color = (v, v * 0.992, v * 0.978, 1.0)

scn.render.engine = prev_engine
bpy.ops.wm.save_mainfile()
print("###BAKE###")
print(json.dumps({"ao_baked_objects": baked, "errors": failed[:3],
                  "materials": sorted(MATNAME.values()),
                  "saved": D.filepath}))
