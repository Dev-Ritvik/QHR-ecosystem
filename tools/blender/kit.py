"""Shared helpers for dressing the mansion with prepared kit pieces.

Imported by the live Blender session (via importlib.reload) so each MCP call
does not have to re-paste the same boilerplate.

Two hard-won rules encoded here:
  * bpy.ops.object.transform_apply does NOT stick over the MCP bridge, and
    object.dimensions / bound_box return stale cached values. Everything below
    therefore transforms mesh DATA directly and measures from me.vertices.
  * Repeated pieces are linked duplicates sharing one mesh datablock.
"""
import bpy, math, mathutils, bmesh

KIT = "C:/dev/Blender/out/kit/"


def box_uv(me, s=1.0):
    """Cheap triplanar-ish UV so textured materials have something to sample."""
    if me.uv_layers:
        return
    bm = bmesh.new(); bm.from_mesh(me)
    uv = bm.loops.layers.uv.new("UVMap")
    for f in bm.faces:
        n = f.normal
        for l in f.loops:
            c = l.vert.co
            if abs(n.z) >= abs(n.x) and abs(n.z) >= abs(n.y): u, v = c.x, c.y
            elif abs(n.x) >= abs(n.y): u, v = c.y, c.z
            else: u, v = c.x, c.z
            l[uv].uv = (u * s, v * s)
    bm.to_mesh(me); bm.free(); me.update()


def extents(me):
    xs = [v.co.x for v in me.vertices]; ys = [v.co.y for v in me.vertices]; zs = [v.co.z for v in me.vertices]
    return min(xs), max(xs), min(ys), max(ys), min(zs), max(zs)


def load_kit(name_glb, obj_name, mat=None, col=None):
    """Import a prepared GLB, bake its transform into the mesh, return one object."""
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=KIT + name_glb)
    new = [o for o in bpy.data.objects if o not in before]
    meshes = [o for o in new if o.type == 'MESH']
    for o in meshes:
        mw = o.matrix_world.copy(); o.parent = None; o.matrix_world = mw
    for o in meshes:
        o.data.transform(o.matrix_world); o.matrix_world = mathutils.Matrix.Identity(4)
    for o in new:
        if o.type != 'MESH':
            bpy.data.objects.remove(o, do_unlink=True)
    bpy.ops.object.select_all(action='DESELECT')
    for o in meshes:
        o.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    if len(meshes) > 1:
        bpy.ops.object.join()
    obj = bpy.context.view_layer.objects.active
    obj.name = obj_name; obj.data.name = obj_name + "_M"
    if mat:
        obj.data.materials.clear()
        obj.data.materials.append(bpy.data.materials[mat])
    if col:
        for c in list(obj.users_collection):
            c.objects.unlink(obj)
        col.objects.link(obj)
    return obj


def fit(obj, dx=None, dy=None, dz=None, anchor="bottom", uv=4.0):
    """Scale mesh data to the given extents (None = follow the uniform factor)
    and move the origin to bottom / centre / top."""
    me = obj.data
    x0, x1, y0, y1, z0, z1 = extents(me)
    ex, ey, ez = max(x1-x0, 1e-6), max(y1-y0, 1e-6), max(z1-z0, 1e-6)
    known = [(dx/ex) if dx else None, (dy/ey) if dy else None, (dz/ez) if dz else None]
    uni = next((k for k in known if k is not None), 1.0)
    sx, sy, sz = [k if k is not None else uni for k in known]
    me.transform(mathutils.Matrix.Diagonal((sx, sy, sz, 1.0))); me.update()
    x0, x1, y0, y1, z0, z1 = extents(me)
    zref = {"bottom": z0, "top": z1, "centre": (z0+z1)/2}[anchor]
    me.transform(mathutils.Matrix.Translation((-(x0+x1)/2, -(y0+y1)/2, -zref))); me.update()
    box_uv(me, uv)
    return [round(v, 3) for v in extents(me)]


def spin(obj, deg):
    """Rotate mesh data about Z - use when a rotated COPY of the master is needed."""
    obj.data.transform(mathutils.Matrix.Rotation(math.radians(deg), 4, 'Z'))
    obj.data.update()


def dupe(master, name, loc, col, rot=None, scale=None):
    o = bpy.data.objects.new(name, master.data)     # linked - shares the mesh
    o.location = loc
    if rot:
        o.rotation_euler = rot
    if scale:
        o.scale = scale
    col.objects.link(o)
    return o


def box(name, x0, x1, y0, y1, z0, z1, mat, col, uv=2.0):
    me = bpy.data.meshes.new(name)
    v = [(x0,y0,z0),(x1,y0,z0),(x1,y1,z0),(x0,y1,z0),(x0,y0,z1),(x1,y0,z1),(x1,y1,z1),(x0,y1,z1)]
    f = [(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)]
    me.from_pydata(v, [], f); me.validate(); me.update()
    box_uv(me, uv); me.materials.append(bpy.data.materials[mat])
    o = bpy.data.objects.new(name, me); col.objects.link(o)
    return o


def cyl(name, r0, r1, z0, z1, mat, col, seg=24, cx=0.0, cy=0.0):
    """Tapered drum - the workhorse for column shafts, plinths and finial bases."""
    me = bpy.data.meshes.new(name)
    verts, faces = [], []
    for i in range(seg):
        a = 2*math.pi*i/seg
        verts.append((cx + r0*math.cos(a), cy + r0*math.sin(a), z0))
    for i in range(seg):
        a = 2*math.pi*i/seg
        verts.append((cx + r1*math.cos(a), cy + r1*math.sin(a), z1))
    for i in range(seg):
        j = (i+1) % seg
        faces.append((i, j, seg+j, seg+i))
    faces.append(tuple(range(seg-1, -1, -1)))
    faces.append(tuple(range(seg, 2*seg)))
    me.from_pydata(verts, [], faces); me.validate(); me.update()
    bm = bmesh.new(); bm.from_mesh(me)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(me); bm.free(); me.update()
    box_uv(me, 2.0); me.materials.append(bpy.data.materials[mat])
    o = bpy.data.objects.new(name, me); col.objects.link(o)
    return o


def fluted_shaft(name, r0, r1, z0, z1, mat, col, flutes=20, depth=0.022, cx=0.0, cy=0.0):
    """Column shaft with classical fluting. A smooth drum reads as a plain tube
    under soft light; the grooves are what make a colonnade read as carved."""
    seg = flutes * 8
    verts, faces = [], []
    for k, (r, z) in enumerate(((r0, z0), (r1, z1))):
        for i in range(seg):
            a = 2*math.pi*i/seg
            rr = r - depth * (0.5 + 0.5*math.cos(flutes*a))
            verts.append((cx + rr*math.cos(a), cy + rr*math.sin(a), z))
    for i in range(seg):
        j = (i+1) % seg
        faces.append((i, j, seg+j, seg+i))
    faces.append(tuple(range(seg-1, -1, -1)))
    faces.append(tuple(range(seg, 2*seg)))
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], faces); me.validate(); me.update()
    bm = bmesh.new(); bm.from_mesh(me)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(me); bm.free()
    me.update()
    for p in me.polygons:
        p.use_smooth = True                      # smooth across the flute curve
    box_uv(me, 2.0); me.materials.append(bpy.data.materials[mat])
    o = bpy.data.objects.new(name, me); col.objects.link(o)
    return o


def multibox(name, boxes, mat, col, uv=2.0):
    """One mesh from many boxes - lets a whole window surround be a single
    datablock that can be linked-duplicated across every facade."""
    verts, faces = [], []
    for (x0, x1, y0, y1, z0, z1) in boxes:
        n = len(verts)
        verts += [(x0,y0,z0),(x1,y0,z0),(x1,y1,z0),(x0,y1,z0),
                  (x0,y0,z1),(x1,y0,z1),(x1,y1,z1),(x0,y1,z1)]
        faces += [(n+0,n+3,n+2,n+1),(n+4,n+5,n+6,n+7),(n+0,n+1,n+5,n+4),
                  (n+1,n+2,n+6,n+5),(n+2,n+3,n+7,n+6),(n+3,n+0,n+4,n+7)]
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], faces); me.validate(); me.update()
    box_uv(me, uv); me.materials.append(bpy.data.materials[mat])
    o = bpy.data.objects.new(name, me); col.objects.link(o)
    return o


MATLIB = "C:/dev/estate/assets/materials/"


def build_pbr(mat_name, folder, repeat_m=2.0, rough_mul=1.0, normal_strength=1.0,
              tone=None, tex_mix=1.0):
    """(Re)wire a material from a basecolor/roughness/normal/metallic map set.

    Uses OBJECT coordinates with BOX projection rather than UVs: several of these
    downloads ship unusable UVs, and box projection gives clean architectural
    tiling on every piece regardless. repeat_m is the tiling length in metres.
    """
    import os
    mat = bpy.data.materials.get(mat_name)
    if mat is None:
        mat = bpy.data.materials.new(mat_name)
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()

    out = nt.nodes.new("ShaderNodeOutputMaterial"); out.location = (760, 0)
    bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled"); bsdf.location = (440, 0)
    nt.links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])

    tc = nt.nodes.new("ShaderNodeTexCoord"); tc.location = (-760, 0)
    mp = nt.nodes.new("ShaderNodeMapping"); mp.location = (-560, 0)
    s = 1.0 / max(repeat_m, 1e-3)
    mp.inputs["Scale"].default_value = (s, s, s)
    nt.links.new(tc.outputs["Object"], mp.inputs["Vector"])

    def tex(fname, cs, y):
        path = os.path.join(folder, fname)
        if not os.path.exists(path):
            return None
        n = nt.nodes.new("ShaderNodeTexImage"); n.location = (-330, y)
        n.image = bpy.data.images.load(path, check_existing=True)
        n.image.colorspace_settings.name = cs
        n.projection = 'BOX'
        n.projection_blend = 0.3
        n.extension = 'REPEAT'
        nt.links.new(mp.outputs["Vector"], n.inputs["Vector"])
        return n

    bc = tex("basecolor.png", 'sRGB', 260)
    if bc:
        if tone is not None:
            # Blend toward a flat architectural tone: the scanned limestone and
            # plaster maps are far darker and browner than a cream interior wants,
            # so the map contributes grain while `tone` sets the actual colour.
            mix = nt.nodes.new("ShaderNodeMixRGB"); mix.location = (110, 260)
            mix.blend_type = 'MIX'
            mix.inputs["Fac"].default_value = tex_mix
            mix.inputs["Color1"].default_value = tone
            nt.links.new(bc.outputs["Color"], mix.inputs["Color2"])
            nt.links.new(mix.outputs["Color"], bsdf.inputs["Base Color"])
        else:
            nt.links.new(bc.outputs["Color"], bsdf.inputs["Base Color"])

    rg = tex("roughness.png", 'Non-Color', 20)
    if rg:
        m = nt.nodes.new("ShaderNodeMath"); m.location = (110, 20)
        m.operation = 'MULTIPLY'; m.inputs[1].default_value = rough_mul
        m.use_clamp = True
        nt.links.new(rg.outputs["Color"], m.inputs[0])
        nt.links.new(m.outputs["Value"], bsdf.inputs["Roughness"])

    mt = tex("metallic.png", 'Non-Color', -220)
    if mt:
        nt.links.new(mt.outputs["Color"], bsdf.inputs["Metallic"])

    nm = tex("normal.png", 'Non-Color', -460)
    if nm:
        nmap = nt.nodes.new("ShaderNodeNormalMap"); nmap.location = (110, -460)
        nmap.inputs["Strength"].default_value = normal_strength
        nt.links.new(nm.outputs["Color"], nmap.inputs["Color"])
        nt.links.new(nmap.outputs["Normal"], bsdf.inputs["Normal"])

    return {"material": mat_name, "maps": [n for n, v in
            (("basecolor", bc), ("roughness", rg), ("metallic", mt), ("normal", nm)) if v]}


def purge(*prefixes):
    n = 0
    for o in list(bpy.data.objects):
        if any(o.name.startswith(p) for p in prefixes):
            bpy.data.objects.remove(o, do_unlink=True); n += 1
    return n
