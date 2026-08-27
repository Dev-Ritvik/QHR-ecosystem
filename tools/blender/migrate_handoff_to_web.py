"""
Flow the commissioned handoff work into the OPTIMIZED interior production source.

mansion_web.blend already carries the production decimations (chandelier 62k,
balusters 1200, newels 6000, KIT_column 10k) and the UVLightmap set on the 147
shell objects. That tuning is preserved untouched; this script only brings in
the new work and the correctness fixes.

Geometry is APPENDED from the master rather than regenerated, so the tables,
stair rods and S4 hologram are bit-identical to what was reviewed.

    blender --background mansion_web.blend --python migrate_handoff_to_web.py -- <master.blend>
"""
import bpy, os, sys, math, re
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:]
MASTER = argv[0]
D = bpy.data
scn = bpy.context.scene
COL = D.collections["COL_Interior"]
log = {}

# ---------------------------------------------------------------- 1. append
APPEND = []
for s in ("S1", "S2", "S3", "S4"):
    APPEND += [f"STATION_{s}", f"TURNTABLE_{s}",
               f"table_top_{s}", f"table_base_{s}", f"table_inlay_{s}"]
APPEND += ["HOLO_S4", "stair_rod_brass",
           "bal_rail_1", "bal_rail_-1", "bal_rail_L1", "bal_rail_L-1"]

# S4 hologram parts, named from the S3 set that already exists here
s3parts = [o.name[len("holo3d_S3_"):] for o in D.objects
           if o.name.startswith("holo3d_S3_")]
APPEND += [f"holo3d_S4_{p}" for p in s3parts]

existing = {o.name for o in D.objects}
want = [n for n in APPEND if n not in existing]
bpy.ops.wm.append(
    directory=os.path.join(MASTER, "Object") + os.sep,
    files=[{"name": n} for n in want],
    link=False, autoselect=True,
    use_recursive=True, do_reuse_local_id=False,
)
appended = [o.name for o in bpy.context.selected_objects]
log["appended"] = len(appended)
log["append_missing"] = [n for n in want if n not in {o.name for o in D.objects}]

# park everything appended in COL_Interior
for n in appended:
    o = D.objects.get(n)
    if not o:
        continue
    for c in list(o.users_collection):
        c.objects.unlink(o)
    COL.objects.link(o)

# ---------------------------------------------------- 2. retire the pedestal
removed = []
for o in [o for o in D.objects if o.name.startswith("pedestal_")]:
    removed.append(o.name)
    me = o.data
    D.objects.remove(o, do_unlink=True)
    if me and me.users == 0:
        D.meshes.remove(me)
log["pedestals_removed"] = len(removed)

# --------------------------------------- 3. re-parent the rig onto STATION_*
def reparent(child, parent):
    if not child or not parent:
        return None
    child.parent = parent
    child.matrix_parent_inverse = parent.matrix_world.inverted()
    return child.name

rig = []
for s in ("S1", "S2", "S3", "S4"):
    st = D.objects.get(f"STATION_{s}")
    rig.append(reparent(D.objects.get(f"HOLO_{s}"), st))
    rig.append(reparent(D.objects.get(f"projector_{s}"), st))
bpy.context.view_layer.update()
for s in ("S1", "S2", "S3", "S4"):
    p = D.objects.get(f"projector_{s}")
    rig.append(reparent(D.objects.get(f"projlens_{s}"), p))
bpy.context.view_layer.update()
log["reparented"] = [r for r in rig if r]

# ------------------------------------------------ 4. hologram material names
renames = {"MAT_Holo_Kartikeya": "MAT_Holo3D_Plate_S1",
           "MAT_Holo_LuckyGarden": "MAT_Holo3D_Plate_S2",
           "MAT_Holo_Gayatri": "MAT_Holo3D_Plate_S3"}
done = {}
for old, new in renames.items():
    m = D.materials.get(old)
    if m:
        dup = D.materials.get(new)
        if dup and dup is not m:
            for ob in D.objects:
                if ob.type == 'MESH' and ob.data:
                    for i, mm in enumerate(ob.data.materials):
                        if mm is dup:
                            ob.data.materials[i] = m
            D.materials.remove(dup)
        m.name = new
        done[old] = new
log["material_renames"] = done

# S4 must be data-disabled: dark plate, no leaked project name
for nm in ("MAT_Holo3D_Plate_S4", "MAT_Holo3D_Top_S4"):
    m = D.materials.get(nm)
    if not m or not m.use_nodes:
        continue
    for n in m.node_tree.nodes:
        if n.type == 'TEX_IMAGE':
            n.image = None
        if n.type == 'EMISSION':
            n.inputs['Strength'].default_value = 0.0
        if n.type == 'BSDF_PRINCIPLED' and 'Emission Strength' in n.inputs:
            n.inputs['Emission Strength'].default_value = 0.0
blanked = []
for o in [o for o in D.objects if o.name.startswith("holo3d_S4_")]:
    if o.type == 'FONT' and o.data:
        if o.data.users > 1:
            o.data = o.data.copy()
        o.data.body = ""
        blanked.append(o.name)
log["s4_text_blanked"] = len(blanked)

print("###STAGE1_OK###")
import json
print(json.dumps(log, indent=1)[:4000])

# ------------------------------------------------------- 5. the stair carpet
# UV0 runs continuously along the flight; UVLightmap is left exactly as the
# production bake wrote it, and stays the lightmap set.
TILE = 1.10
XMIN = -1.896
pts = [(0.612, 0.0)]
for N in range(12):
    y_r = 0.612 + 0.34 * N
    z_t = 0.236 + 0.22 * N
    pts.append((y_r, z_t))
    pts.append((y_r + 0.34, z_t))
pts.append((4.71, 2.777))
pts.append((5.93, 2.777))
seg = []
acc = 0.0
for i in range(len(pts) - 1):
    a = Vector(pts[i]); b = Vector(pts[i + 1]); L = (b - a).length
    seg.append((a, b, L, acc)); acc += L
TOTAL = acc

def arc_of(y, z):
    P = Vector((y, z)); best = None
    for a, b, L, a0 in seg:
        if L < 1e-9:
            continue
        dvec = b - a
        t = max(0.0, min(1.0, (P - a).dot(dvec) / (L * L)))
        q = a + dvec * t
        dist = (P - q).length_squared
        if best is None or dist < best[0]:
            best = (dist, a0 + t * L)
    return best[1]

runners = [o for o in D.objects if re.match(r'^(runner_|stair_landing_runner)', o.name)]
for o in runners:
    me = o.data
    if not me:
        continue
    uv0 = me.uv_layers.get("UVMap") or me.uv_layers.new(name="UVMap")
    mw = o.matrix_world
    for poly in me.polygons:
        for li in poly.loop_indices:
            w = mw @ me.vertices[me.loops[li].vertex_index].co
            uv0.data[li].uv = ((w.x - XMIN) / TILE, arc_of(w.y, w.z) / TILE)
    # the lightmap must never be the render UV for the PBR maps
    for l in me.uv_layers:
        l.active_render = (l.name != "UVLightmap")
log["runners_uv0"] = len(runners)
log["carpet_arc_m"] = round(TOTAL, 3)

CDIR = r"C:\dev\estate\assets\New assets\_x\Carpet013_2K-PNG"
def cimg(fn, nc=False):
    p = os.path.join(CDIR, fn)
    if not os.path.exists(p):
        return None
    key = "Carpet013_" + fn.split('_')[-1]
    i = D.images.get(key) or D.images.load(p)
    i.name = key
    if nc:
        i.colorspace_settings.name = 'Non-Color'
    return i

def build_carpet(mat, dye, lo, hi):
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial'); out.location = (760, 0)
    bs = nt.nodes.new('ShaderNodeBsdfPrincipled'); bs.location = (500, 0)
    nt.links.new(bs.outputs['BSDF'], out.inputs['Surface'])
    uvn = nt.nodes.new('ShaderNodeUVMap'); uvn.location = (-900, 0); uvn.uv_map = 'UVMap'
    def tex(fn, nc, y):
        im = cimg(fn, nc)
        if not im:
            return None
        n = nt.nodes.new('ShaderNodeTexImage'); n.location = (-660, y)
        n.image = im; n.extension = 'REPEAT'
        nt.links.new(uvn.outputs['UV'], n.inputs['Vector'])
        return n
    col = tex('Carpet013_2K-PNG_Color.png', False, 300)
    rgh = tex('Carpet013_2K-PNG_Roughness.png', True, 0)
    nrm = tex('Carpet013_2K-PNG_NormalGL.png', True, -300)
    ao = tex('Carpet013_2K-PNG_AmbientOcclusion.png', True, -600)
    if col:
        bw = nt.nodes.new('ShaderNodeRGBToBW'); bw.location = (-400, 340)
        nt.links.new(col.outputs['Color'], bw.inputs['Color'])
        lum = nt.nodes.new('ShaderNodeMapRange'); lum.location = (-220, 340)
        lum.inputs['To Min'].default_value = lo
        lum.inputs['To Max'].default_value = hi
        nt.links.new(bw.outputs['Val'], lum.inputs['Value'])
        tint = nt.nodes.new('ShaderNodeMixRGB'); tint.location = (0, 340)
        tint.blend_type = 'MULTIPLY'; tint.inputs['Fac'].default_value = 1.0
        tint.inputs['Color1'].default_value = (*dye, 1.0)
        nt.links.new(lum.outputs['Result'], tint.inputs['Color2'])
        last = tint
        if ao:
            am = nt.nodes.new('ShaderNodeMixRGB'); am.location = (220, 340)
            am.blend_type = 'MULTIPLY'; am.inputs['Fac'].default_value = 0.45
            nt.links.new(tint.outputs['Color'], am.inputs['Color1'])
            nt.links.new(ao.outputs['Color'], am.inputs['Color2'])
            last = am
        nt.links.new(last.outputs['Color'], bs.inputs['Base Color'])
    if rgh:
        mr = nt.nodes.new('ShaderNodeMapRange'); mr.location = (220, 0)
        mr.inputs['To Min'].default_value = 0.62
        mr.inputs['To Max'].default_value = 0.98
        nt.links.new(rgh.outputs['Color'], mr.inputs['Value'])
        nt.links.new(mr.outputs['Result'], bs.inputs['Roughness'])
    else:
        bs.inputs['Roughness'].default_value = 0.88
    if nrm:
        nm = nt.nodes.new('ShaderNodeNormalMap'); nm.location = (220, -300)
        nt.links.new(nrm.outputs['Color'], nm.inputs['Color'])
        nt.links.new(nm.outputs['Normal'], bs.inputs['Normal'])
    bs.inputs['Metallic'].default_value = 0.0
    mat.use_backface_culling = True

build_carpet(D.materials['MAT_Runner'], (0.1020, 0.0231, 0.0171), 0.55, 1.45)
bind = D.materials.get('MAT_Runner_Binding') or D.materials.new('MAT_Runner_Binding')
build_carpet(bind, (0.0290, 0.0125, 0.0098), 0.70, 1.15)
for o in [o for o in D.objects if o.name.startswith('runner_binding_')]:
    o.data.materials.clear()
    o.data.materials.append(bind)

# ---------------------------------------------- 6. portrait + the glass pane
PORTRAIT = r"C:\dev\estate\assets\brand\founder_portrait_graded.png"
mp = D.materials.get('MAT_Portrait')
if mp and mp.use_nodes and os.path.exists(PORTRAIT):
    img = D.images.get("founder_portrait_graded")
    if img is None:
        img = D.images.load(PORTRAIT)
        img.name = "founder_portrait_graded"
    img.source = 'FILE'; img.filepath = PORTRAIT
    img.colorspace_settings.name = 'sRGB'
    for n in mp.node_tree.nodes:
        if n.type == 'TEX_IMAGE':
            n.image = img
            n.extension = 'EXTEND'
    log["portrait"] = list(img.size)

# The pane refracts nothing, hides the painting, and costs a whole extra pass.
pg = D.materials.get('MAT_PortraitGlass')
if pg and pg.use_nodes:
    b = next((n for n in pg.node_tree.nodes if n.type == 'BSDF_PRINCIPLED'), None)
    if b:
        for k in ('Transmission Weight', 'Transmission'):
            if k in b.inputs:
                b.inputs[k].default_value = 0.0
        b.inputs['Base Color'].default_value = (0.02, 0.02, 0.022, 1.0)
        b.inputs['Roughness'].default_value = 0.06
        b.inputs['Metallic'].default_value = 0.0
        if 'Alpha' in b.inputs:
            b.inputs['Alpha'].default_value = 0.10
        pg.use_backface_culling = True
        log["portrait_glass_transmission"] = 0.0

mgw = D.materials.get('MAT_Glass_Window')
if mgw and mgw.use_nodes:
    b = next((n for n in mgw.node_tree.nodes if n.type == 'BSDF_PRINCIPLED'), None)
    if b:
        for k in ('Transmission Weight', 'Transmission'):
            if k in b.inputs:
                b.inputs[k].default_value = 0.0
        if 'Alpha' in b.inputs:
            b.inputs['Alpha'].default_value = 0.55
        b.inputs['Roughness'].default_value = 0.12

# ------------------------------------------------- 7. UV / material hygiene
fixes = {"uv_linked": 0, "culled": 0, "urn_uv_removed": 0,
         "rough_clamped": [], "boxed": 0}

# every image texture must resolve to a real UV set, or glTF gets texCoord -1
for m in D.materials:
    if not m.use_nodes:
        continue
    nt = m.node_tree
    uvn = None
    for t in [n for n in nt.nodes if n.type == 'TEX_IMAGE' and n.image]:
        if t.inputs['Vector'].links:
            continue
        if uvn is None:
            uvn = nt.nodes.new('ShaderNodeUVMap')
            uvn.location = (t.location.x - 260, t.location.y)
            uvn.uv_map = 'UVMap'
        nt.links.new(uvn.outputs['UV'], t.inputs['Vector'])
        fixes["uv_linked"] += 1

# the urns carry five identical UV sets with textures bound to 1..3
for nm in ('dress_urn_0', 'dress_urn_1', 'dress_urn_master'):
    o = D.objects.get(nm)
    if not o or not o.data:
        continue
    me = o.data
    while len(me.uv_layers) > 1:
        extra = [l for l in me.uv_layers if l.name not in ('UVMap', 'UVLightmap')]
        if not extra:
            break
        me.uv_layers.remove(extra[0]); fixes["urn_uv_removed"] += 1
for m in D.materials:
    if not m.use_nodes:
        continue
    for n in m.node_tree.nodes:
        if n.type == 'UVMAP' and n.uv_map.startswith('UVMap.'):
            n.uv_map = 'UVMap'

# roughnessFactor must not exceed 1.0
for m in D.materials:
    if not m.use_nodes:
        continue
    for n in m.node_tree.nodes:
        if n.type == 'MATH' and n.operation == 'MULTIPLY':
            if any(l.to_socket.name == 'Roughness' for l in n.outputs[0].links):
                if not n.inputs[1].links and n.inputs[1].default_value > 1.0:
                    fixes["rough_clamped"].append([m.name, round(n.inputs[1].default_value, 3)])
                    n.inputs[1].default_value = 1.0

# stop shipping everything two-sided
KEEP = re.compile(r'(glass|hedge|haze|water|flame|foliage|leaf|curtain|holo|piclight|window)', re.I)
for m in D.materials:
    if KEEP.search(m.name):
        m.use_backface_culling = False
    else:
        if not m.use_backface_culling:
            fixes["culled"] += 1
        m.use_backface_culling = True

# objects with no UV at all are what split MAT_Stone_Cream and produced tc -1
def box_uv(o, scale=2.0):
    me = o.data
    uvl = me.uv_layers.new(name="UVMap")
    mw = o.matrix_world
    m3 = mw.to_3x3()
    for poly in me.polygons:
        n = m3 @ poly.normal
        ax = max(range(3), key=lambda i: abs(n[i]))
        for li in poly.loop_indices:
            w = mw @ me.vertices[me.loops[li].vertex_index].co
            if ax == 0:   u, v = w.y, w.z
            elif ax == 1: u, v = w.x, w.z
            else:         u, v = w.x, w.y
            uvl.data[li].uv = (u / scale, v / scale)

for o in D.objects:
    if o.type != 'MESH' or not o.data or not o.data.vertices:
        continue
    if len(o.data.uv_layers) == 0:
        box_uv(o); fixes["boxed"] += 1
log["hygiene"] = fixes

# ------------------------------------------------------------------ 8. save
def tris(o):
    return sum(len(p.vertices) - 2 for p in o.data.polygons) if o.type == 'MESH' and o.data else 0
log["interior_tris"] = sum(tris(o) for o in COL.objects)
log["interior_objs"] = len(COL.objects)
log["shell_with_lightmap"] = len([o for o in D.objects
                                  if o.type == 'MESH' and o.data
                                  and "UVLightmap" in o.data.uv_layers])
DST = r"C:\dev\Blender\mansion_web.blend"
bpy.ops.wm.save_as_mainfile(filepath=DST, compress=False)
log["saved"] = DST
print("###RESULT###")
import json
print(json.dumps(log, indent=1)[:6000])
print("###DONE###")
