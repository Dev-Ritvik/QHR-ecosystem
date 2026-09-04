"""
P5H - the entrance urns: finishing a detail the architecture already set up.

    blender --background mansion_exterior_P5H.blend --python p5h_entrance_urns.py -- --save

THIS IS NOT A PROP ADDED TO FILL SPACE. The entrance already has two pedestals
and nothing on them. `entry_cheek_-1` and `entry_cheek_1` are the flanking
blocks either side of the entry steps - x 2.500..3.000, y -6.800..-5.600, with a
flat top at z 0.600 - and they are, in plan and in section, step cheeks built to
carry something. At HERO they sit at 970 and 1138 px across a 1425 px frame,
unoccluded, 30.6 m from the eye. A classical entrance whose cheeks are bare is
an unfinished entrance, and that is what the frame currently shows.

THE ESTATE ALREADY HAS AN URN VOCABULARY, so this introduces no new visual
language. `finial_urn_0..3` stand on `finial_plinth_0..3` at the spire base in
MAT_Stone_Trim. The entrance pair is the same idea at the scale the ground floor
needs, in the same material, and it is deliberately a SIMPLER form than a
show-piece garden urn because of what the camera can resolve.

WHAT THE CAMERA CAN RESOLVE, WHICH IS WHAT DECIDED THE DESIGN.
tools/gltf/p5h_visibility.py projects the proposal through the runtime's own
five cameras before anything is modelled:

    beat    dist      m/px      H px    W px    in frame   occluded
    HERO   30.65    0.02451     35.1    18.8    yes        no
    WEST   24.93    0.02485     34.6    18.5    yes        no
    NW     28.97    0.02788     30.8    16.5    yes        by the mansion
    TURN   / CONSTEL                            behind the camera

So the WHOLE URN is 35 pixels tall and 19 wide at the frame the site opens on.
Every design decision below follows from that one number:

  * NO surface ornament. Gadrooning, fluting, handles, an acanthus collar - the
    things that make an urn look like an urn in a catalogue photograph - are
    1 to 2 px here. They would cost geometry and return sparkle. The brief is
    explicit that ornament which cannot be resolved must be removed, so it is
    not modelled in the first place.
  * The SILHOUETTE carries the whole read, so the form is a campana (bell)
    urn - widest at the mouth, drawn in to a narrow stem - because its widest
    part sits at the TOP, against the terrace and the sky, rather than against
    the pedestal where it would be lost. A lidded top closes the geometry with
    no interior to model, and a lidded urn is the standard estate gate form.
  * 16 RADIAL SEGMENTS, from the silhouette error rather than from habit. An
    n-gon approximating a circle of screen radius R deviates by R(1-cos(pi/n)).
    At R = 8.5 px: n=8 gives 0.65 px, n=12 gives 0.29 px, n=16 gives 0.16 px.
    Anti-aliasing resolves about 0.3 px, so 12 sits on the threshold and 16 is
    comfortably under it. The roof finial uses 24; that is not a constraint,
    it is a different generator on a 0.18 m object.

MATERIAL: MAT_Stone_Trim, REUSED BY NAME. No new material, no new texture, no
new image, no new shader program. It is the portico cornice's own material and
the roof finials' - which is precisely why an urn in it cannot read as a
foreign object. UVs are raw world coordinates box-projected by dominant face
axis, which is the convention every other trim object in this file uses
(`finial_urn_0` carries u = world x, v = world y/z) and which the material's
Mapping node scales by 0.8333 into a 1.2 m tile.

COLOR_0 IS NOT OPTIONAL HERE. MAT_Stone_Trim multiplies base colour by the
StoneAO colour attribute through a ShaderNodeMix (RGBA / MULTIPLY / Factor 1),
so a primitive without that attribute renders unmultiplied AND makes three's
GLTFLoader cache a SECOND material instance for the same glTF material - which
is exactly what P5C's `edging_hardscape` did (it is the only one of 37
MAT_Stone_Trim primitives in p5g with no COLOR_0). The urns are baked with
tools/blender/bake_ao_raycast.py, the same instrument and the same 0.40 floor
the rest of the stone uses, so they join the other 36 rather than forking.

BEDDED, NOT BALANCED. The die's underside is sunk 8 mm below the cheek's top
face. Two coincident faces at z 0.600 would z-fight over the whole die
footprint; 8 mm is also what a real setting bed is. The script asserts the die
footprint lies inside the cheek's FLAT top (the cheek is a chamfered box, so
"inside the bbox" is not sufficient) and that nothing floats.

Every other material and every other object is asserted bit-identical.
"""
import bpy, bmesh, json, math, os, sys
from mathutils import Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
# bake_ao_raycast defines constants and functions only - no module-level
# execution, verified before importing. P5A lost a locked source to a generator
# that regenerated its textures on import; that check is now mandatory.
import bake_ao_raycast as AO

args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []

# ---- placement, from the cheeks themselves ----------------------------------
CHEEK = {-1: 'entry_cheek_-1', 1: 'entry_cheek_1'}
BED = 0.008            # metres the die is sunk into the cheek
DIE_H = 0.170          # exposed height of the square die
DIE_HALF = 0.170       # half-width  -> 0.340 square
SEG = 16               # radial segments; see the header
MAT = 'MAT_Stone_Trim'

# Campana profile, (height above the die top, radius). 14 points, 13 rings.
# Max radius 0.200 -> 0.400 m diameter: it oversails the 0.340 die by 30 mm a
# side, which is the correct classical relationship, and leaves 50 mm of the
# 0.500 m cheek visible either side.
PROFILE = [
    (0.000, 0.100),   # foot plate, bedded on the die
    (0.035, 0.100),   # foot plate top - a 35 mm straight
    (0.070, 0.066),   # stem waist, the narrowest point
    (0.140, 0.092),   # flare out of the stem
    (0.225, 0.140),   # bowl, lower
    (0.310, 0.172),
    (0.400, 0.190),
    (0.465, 0.195),   # mouth spring
    (0.520, 0.190),   # drawn in under the rim
    (0.550, 0.200),   # RIM, oversailing
    (0.585, 0.192),   # rim top
    (0.630, 0.150),   # lid springing
    (0.665, 0.090),   # lid
    (0.690, 0.000),   # apex, closed
]
URN_H = DIE_H + PROFILE[-1][0]        # 0.860 m above the cheek

log = {'seg': SEG, 'profile_points': len(PROFILE), 'urn_height_m': round(URN_H, 4)}


def snap_mat(m):
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


def snap_obj(o):
    me = o.data
    ca = me.color_attributes.get('StoneAO')
    return (len(me.vertices), len(me.polygons),
            tuple(round(v, 6) for r in o.matrix_world for v in r),
            tuple(s.material.name if s.material else None for s in o.material_slots),
            tuple(round(float(x), 5) for i in range(len(ca.data)) for x in ca.data[i].color) if ca else None)


NEW = {'urn_entry_-1', 'urn_entry_1'}
before_mats = {m.name: snap_mat(m) for m in bpy.data.materials if m.use_nodes}
before_objs = {o.name: snap_obj(o) for o in bpy.data.objects if o.type == 'MESH'}

# ---- 1. the cheeks: measure the FLAT top, do not assume the bbox ------------
# entry_cheek_* is a chamfered box (24 verts / 26 polys), so its bounding box
# top is wider than the flat face an urn can actually stand on.
flat_tops = {}
for side, nm in CHEEK.items():
    o = bpy.data.objects[nm]
    ws = [o.matrix_world @ v.co for v in o.data.vertices]
    ztop = max(w.z for w in ws)
    top = [w for w in ws if abs(w.z - ztop) < 1e-5]
    assert len(top) >= 4, '%s: no flat top face (%d verts at z max)' % (nm, len(top))
    flat_tops[side] = {
        'z': round(ztop, 5),
        'x': [round(min(w.x for w in top), 5), round(max(w.x for w in top), 5)],
        'y': [round(min(w.y for w in top), 5), round(max(w.y for w in top), 5)],
        'cx': round(sum(w.x for w in top) / len(top), 5),
        'cy': round(sum(w.y for w in top) / len(top), 5),
    }
log['cheek_flat_tops'] = flat_tops


def build_urn(name, cx, cy, ztop):
    """One mesh: a square die plus a lathe, joined. One node, one draw call."""
    bm = bmesh.new()
    uvl = bm.loops.layers.uv.new('UVMap')

    z0 = ztop - BED
    z1 = ztop + DIE_H

    # --- the die, a plain box -------------------------------------------
    d = DIE_HALF
    corners = [(cx - d, cy - d), (cx + d, cy - d), (cx + d, cy + d), (cx - d, cy + d)]
    lo = [bm.verts.new((x, y, z0)) for x, y in corners]
    hi = [bm.verts.new((x, y, z1)) for x, y in corners]
    faces = [bm.faces.new([lo[3], lo[2], lo[1], lo[0]])]          # bottom
    for k in range(4):
        k2 = (k + 1) % 4
        faces.append(bm.faces.new([lo[k], lo[k2], hi[k2], hi[k]]))
    die_top = bm.faces.new(hi)
    faces.append(die_top)
    for f in faces:
        f.smooth = False

    # --- the lathe ------------------------------------------------------
    rings = []
    for (h, r) in PROFILE:
        if r <= 1e-6:
            rings.append(None)
            continue
        ring = []
        for s in range(SEG):
            a = 2.0 * math.pi * s / SEG
            ring.append(bm.verts.new((cx + r * math.cos(a), cy + r * math.sin(a), z1 + h)))
        rings.append(ring)

    # close the underside of the foot plate so the mesh is watertight
    c0 = bm.verts.new((cx, cy, z1 + PROFILE[0][0]))
    for s in range(SEG):
        f = bm.faces.new([c0, rings[0][(s + 1) % SEG], rings[0][s]])
        f.smooth = False

    lathe = []
    for i in range(len(PROFILE) - 1):
        a, b = rings[i], rings[i + 1]
        if b is None:                                   # closing fan to the apex
            apex = bm.verts.new((cx, cy, z1 + PROFILE[i + 1][0]))
            for s in range(SEG):
                lathe.append(bm.faces.new([a[s], a[(s + 1) % SEG], apex]))
            continue
        for s in range(SEG):
            s2 = (s + 1) % SEG
            lathe.append(bm.faces.new([a[s], a[s2], b[s2], b[s]]))
    for f in lathe:
        f.smooth = True

    # --- UVs: world coordinates, box-projected by dominant face axis -----
    # The convention every trim object in this file uses. MAT_Stone_Trim's
    # Mapping node scales by 0.8333, so 1 UV unit = 1 m and the tile is 1.2 m.
    bm.normal_update()
    for f in bm.faces:
        n = f.normal
        ax = max(range(3), key=lambda i: abs(n[i]))
        for l in f.loops:
            co = l.vert.co
            u, v = (co.y, co.z) if ax == 0 else ((co.x, co.z) if ax == 1 else (co.x, co.y))
            l[uvl].uv = (u, v)

    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    me.materials.append(bpy.data.materials[MAT])
    ob = bpy.data.objects.new(name, me)
    for c in bpy.data.objects[CHEEK[1]].users_collection:
        c.objects.link(ob)
    return ob


made = {}
for side, nm in CHEEK.items():
    ft = flat_tops[side]
    name = 'urn_entry_%d' % side
    ob = build_urn(name, ft['cx'], ft['cy'], ft['z'])
    me = ob.data
    ws = [ob.matrix_world @ v.co for v in me.vertices]
    made[name] = {
        'verts': len(me.vertices), 'polys': len(me.polygons),
        'tris': sum(len(p.vertices) - 2 for p in me.polygons),
        'material': MAT, 'reused_existing_material': True,
        'world_min': [round(min(w[i] for w in ws), 4) for i in range(3)],
        'world_max': [round(max(w[i] for w in ws), 4) for i in range(3)],
        'centre_xy': [ft['cx'], ft['cy']],
        'bed_depth_mm': BED * 1000,
    }
    # the die footprint must sit inside the cheek's FLAT top, not just its bbox
    assert ft['x'][0] <= ft['cx'] - DIE_HALF and ft['cx'] + DIE_HALF <= ft['x'][1], \
        '%s die overhangs the cheek flat top in x' % name
    assert ft['y'][0] <= ft['cy'] - DIE_HALF and ft['cy'] + DIE_HALF <= ft['y'][1], \
        '%s die overhangs the cheek flat top in y' % name
    # nothing coplanar with the cheek top
    assert abs(min(w.z for w in ws) - ft['z']) > 1e-4, '%s die base is coplanar with the cheek' % name
log['objects'] = made

# symmetry is a requirement, so it is asserted rather than eyeballed
a, b = made['urn_entry_-1'], made['urn_entry_1']
assert abs(a['centre_xy'][0] + b['centre_xy'][0]) < 1e-6, 'urns are not symmetric about x=0'
assert abs(a['centre_xy'][1] - b['centre_xy'][1]) < 1e-6, 'urns are not on one line in y'
assert a['tris'] == b['tris'], 'the pair is not identical'
log['symmetric_about_x0'] = True

# ---- 2. StoneAO, by the same raycast the rest of the stone uses -------------
# Built AFTER the urns exist so each one occludes itself and is occluded by its
# cheek, the steps and the terrace.
AO.build()
log['ao'] = AO.run(sorted(NEW))

# ---- 3. controls ------------------------------------------------------------
after_mats = {m.name: snap_mat(m) for m in bpy.data.materials if m.use_nodes}
after_objs = {o.name: snap_obj(o) for o in bpy.data.objects
              if o.type == 'MESH' and o.name not in NEW}
cm = [k for k in before_mats if before_mats[k] != after_mats.get(k)]
co = [k for k in before_objs if before_objs[k] != after_objs.get(k)]
assert not cm, 'materials changed: %s' % cm
assert not co, 'objects changed: %s' % co
log['other_materials_changed'] = cm
log['other_objects_changed'] = co
log['new_materials'] = [k for k in after_mats if k not in before_mats]
assert not log['new_materials'], 'a new material appeared: %s' % log['new_materials']

print('###JSON###')
print(json.dumps(log, indent=1))
if '--save' in args:
    bpy.ops.wm.save_mainfile()
    print('### saved', bpy.data.filepath)
