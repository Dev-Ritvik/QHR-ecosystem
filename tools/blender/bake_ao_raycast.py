"""
Ambient occlusion by hemisphere raycast, not by bpy.ops.object.bake.

WHY NOT THE BAKE OPERATOR. Cycles' AO bake returned results this scene's own
geometry contradicts. cupola_parapet_0 sits at z 7.60-7.96 with open sky above
it and nothing within a metre of its outer face; a hemisphere raycast measures
it 84% open. The operator baked it to 0.000 - on GPU and on CPU, selected alone
or with the set, and with the object's own duplicate hidden. That same duplicate
moved to z 8.60 baked to 0.88 and at z 13.00 to 1.00. Whatever the operator was
integrating at the original position, it was not the geometry that is there.

Rather than keep guessing at an opaque operator, this computes AO the way every
other geometric question in this project was settled: fire rays and see what
they hit. The occluder set is then explicit and auditable instead of being
whatever the render layer happened to contain - which is what produced the
original broken StoneAO, where a 480 x 480 x 56 m haze box enclosed the whole
building and drove every ray to a hit, leaving a flat 0.62 floor as the only
surviving signal.

TWO OCCLUDER SETS, because two different surfaces are being asked two different
questions.

    ARCH - architecture without the applied masonry. Used for every polygon
    small enough that a vertex attribute can actually resolve it: window
    reveals, sills, architraves, quoin bands, mouldings, cornice returns, the
    carved frieze. Their AO is an architectural fact and does not depend on
    which stone happens to sit beside them.

    FULL - architecture plus the 267 ashlar blocks and the rustic base. Built,
    measured, and deliberately NOT used. See below.

WHY THE MASONRY IS NOT AN OCCLUDER. It was the obvious idea: each facade field
is a single n-gon 95% hidden behind blocks, so the only part a camera sees is
the 18 mm joint, and one flat value for the whole face could carry the joint
shade. Measured with FULL, the four fields come out at 0.406 / 0.403 / 0.412 /
0.406 - all at the floor. But the south field n-gon also spans the smooth
entrance bay, which has no ashlar on it by design and measures 0.479 open
inside the portico. One flat value cannot be both a joint bottom and the front
door, and darkening the building's focal point by 60% to shade joints nobody
can resolve is the wrong trade.

It is also unnecessary. The runtime key is a shadow-casting directional at
10.6 degrees of elevation raking the facade: the 25 mm block relief and the
8 mm top chamfer separate under N.L on every lit face. Its shadow map is
2048 px over a 52 m box - 25 mm per texel - so the sun was never going to
resolve an 18 mm joint whatever AO did. What AO is actually for here is the
ambient fill the hemisphere light puts into recesses, and that lives on the
dense geometry: reveals, cornice returns, the portico soffit, the frieze.

THE BIG-FACE GUARD. Any polygon over BIG_POLY m2 is shaded flat, from the mean
openness of the points on it that are actually EXPOSED - a sample whose own
outward ray cannot clear 50 mm is buried and does not get a vote. Both halves
matter. Without flat shading, a 276 m2 terrace slab ramps between four corners
that are in a completely different condition from its interior. Without the
exposure filter, the west field averages in its own buried edges - the ones
under the terrace and behind the eaves - and lands at 0.643 instead of the
value its visible joints deserve. Four buried corners at 0 is precisely the
black-wall failure this has to avoid.

DETERMINISM. The direction set is generated once from a fixed Fibonacci lattice
and rotated per sample point by an angle hashed from that point's own rounded
coordinates. Same scene in, same numbers out, with no RNG state that has to be
consumed in a particular order.
"""
import bpy
import math
from mathutils import Vector
from mathutils.bvhtree import BVHTree

N_RAYS = 96
MAXDIST = 1.6           # metres - contact occlusion, not global darkening
FLOOR = 0.40            # darkest the AO multiply is allowed to go
BIG_POLY = 0.25         # m2 - above this a face is flat-shaded to its own mean
BIG_SAMPLES = 12        # minimum points used to shade a big face
BIG_USE_MASONRY = False  # see 'WHY THE MASONRY IS NOT AN OCCLUDER' above
NORMAL_BUCKET = 12.0    # loops sharing a vertex and a normal share one result

EXPOSED = 0.05          # metres a sample must clear outward to get a vote

# never an occluder: not architecture, or not shipped
CUT_PREFIX = ("cyp_", "hedge_", "REV_", "TEMP_", "SHOTCAM",
              "AO_TEST", "AO_SWEEP", "AO_PROBE")
CUT_NAME = {"EXT_HAZE", "INT_HAZE"}
CUT_COLL = ("COL_Interior", "COL_REVIEW_TEMP", "COL_REVIEW_ASHLAR")
# the applied masonry: an occluder for FULL, not for ARCH
MASONRY_PREFIX = ("ashlar_", "rustic_")
MASONRY_COLL = ("COL_Ashlar_West", "COL_Ashlar_East", "COL_Ashlar_North",
                "COL_Ashlar_South", "COL_Ashlar_West_KIT", "COL_Ashlar_East_KIT",
                "COL_Ashlar_North_KIT", "COL_Ashlar_South_KIT")
# the parked kit masters live at z -50 and are never an occluder of anything
PARKED_Z = -40.0

_DIRS = None
_BVH = None
_ARCH = None
_FULL = None


def _fibonacci_hemisphere(n):
    """Cosine-weighted directions in tangent space, z = up. Deterministic."""
    out = []
    ga = math.pi * (3.0 - math.sqrt(5.0))
    for i in range(n):
        u = (i + 0.5) / n
        r = math.sqrt(u)
        z = math.sqrt(max(0.0, 1.0 - u))
        th = ga * i
        out.append((r * math.cos(th), r * math.sin(th), z))
    return out


def is_masonry(o):
    if o.name.startswith(MASONRY_PREFIX):
        return True
    return any(c.name in MASONRY_COLL for c in o.users_collection)


def is_occluder(o, with_masonry):
    if o.type != 'MESH' or o.hide_render or not o.data.vertices:
        return False
    if o.name in CUT_NAME or o.name.startswith(CUT_PREFIX):
        return False
    if any(c.name in CUT_COLL for c in o.users_collection):
        return False
    if o.matrix_world.translation.z < PARKED_Z:
        return False
    if is_masonry(o) and not with_masonry:
        return False
    return True


def _bvh(with_masonry):
    dg = bpy.context.evaluated_depsgraph_get()
    verts, faces, names = [], [], []
    for o in bpy.data.objects:
        if not is_occluder(o, with_masonry):
            continue
        names.append(o.name)
        ev = o.evaluated_get(dg)
        me = ev.to_mesh()
        off = len(verts)
        mw = o.matrix_world
        verts.extend([mw @ v.co for v in me.vertices])
        for p in me.polygons:
            vs = [i + off for i in p.vertices]
            for k in range(1, len(vs) - 1):
                faces.append((vs[0], vs[k], vs[k + 1]))
        ev.to_mesh_clear()
    tree = BVHTree.FromPolygons(verts, faces, all_triangles=True, epsilon=0.0)
    return tree, {"occluders": len(names), "verts": len(verts), "tris": len(faces),
                  "names": sorted(names)}


def build():
    """Build both occluder trees. Returns a manifest of what went into each."""
    global _DIRS, _ARCH, _FULL, _BVH
    _DIRS = _fibonacci_hemisphere(N_RAYS)
    _ARCH, ma = _bvh(False)
    _FULL, mf = _bvh(True)
    _BVH = _ARCH
    return {"arch": {k: ma[k] for k in ("occluders", "tris")},
            "full": {k: mf[k] for k in ("occluders", "tris")},
            "masonry_added": mf["occluders"] - ma["occluders"],
            "arch_names": ma["names"]}


def openness(p, n):
    """Fraction of the cosine-weighted hemisphere above p that reaches MAXDIST."""
    n = n.normalized()
    t = Vector((0.0, 0.0, 1.0)).cross(n)
    if t.length < 1e-6:
        t = Vector((1.0, 0.0, 0.0)).cross(n)
    t.normalize()
    b = n.cross(t)
    h = ((int(p.x * 977.0) * 73856093) ^ (int(p.y * 977.0) * 19349663)
         ^ (int(p.z * 977.0) * 83492791))
    a = ((h & 0xFFFF) / 65536.0) * 2.0 * math.pi
    ca, sa = math.cos(a), math.sin(a)
    o = p + n * 1e-4
    miss = 0
    for (dx, dy, dz) in _DIRS:
        d = t * (dx * ca - dy * sa) + b * (dx * sa + dy * ca) + n * dz
        if _BVH.ray_cast(o, d, MAXDIST)[0] is None:
            miss += 1
    return miss / float(N_RAYS)


# barycentric weights, low-discrepancy, biased away from the triangle edges so a
# sample never lands exactly on a seam between two faces
_BARY = [(0.333, 0.334, 0.333), (0.600, 0.220, 0.180), (0.200, 0.620, 0.180),
         (0.200, 0.200, 0.600), (0.460, 0.460, 0.080), (0.080, 0.460, 0.460),
         (0.460, 0.080, 0.460), (0.740, 0.130, 0.130), (0.130, 0.740, 0.130),
         (0.130, 0.130, 0.740), (0.280, 0.440, 0.280), (0.440, 0.280, 0.280)]


def _face_samples(me, poly, mw, k):
    """Points spread over a polygon's interior, in world space.

    Allocated across the fan triangles BY AREA. Taking the first k barycentric
    points of the first triangle - which is what the first version did - sampled
    a 57 m2 facade inside one small corner sliver of it.
    """
    vs = [mw @ me.vertices[i].co for i in poly.vertices]
    tris = []
    total = 0.0
    for t in range(1, len(vs) - 1):
        a, b, c = vs[0], vs[t], vs[t + 1]
        ar = (b - a).cross(c - a).length * 0.5
        tris.append((ar, a, b, c))
        total += ar
    if total <= 0.0:
        return [sum(vs, Vector()) / len(vs)]
    pts = []
    for (ar, a, b, c) in tris:
        n_t = max(1, int(round(k * ar / total)))
        for i in range(n_t):
            wa, wb, wc = _BARY[i % len(_BARY)]
            # jitter deterministically between repeats so they do not stack
            if i >= len(_BARY):
                s = 0.13 * ((i // len(_BARY)) % 3 + 1)
                wa, wb, wc = wa * (1 - s) + s / 3, wb * (1 - s) + s / 3, wc * (1 - s) + s / 3
            pts.append(a * wa + b * wb + c * wc)
    return pts


def _big_face_ao(me, poly, mw, n):
    """Mean openness over the EXPOSED points of a big face."""
    tree = _FULL if BIG_USE_MASONRY else _ARCH
    k = max(BIG_SAMPLES, min(96, int(4 + poly.area * 1.5)))
    pts = _face_samples(me, poly, mw, k)
    exposed = [p for p in pts if tree.ray_cast(p + n * 1e-4, n, EXPOSED)[0] is None]
    use = exposed or pts                      # nothing exposed: face is invisible
    ao = sum(openness(p, n) for p in use) / len(use)
    return ao, len(exposed), len(pts)


def run(obj_names, attr="StoneAO", floor=FLOOR):
    """Compute and write AO for the named objects. Returns per-object stats."""
    global _BVH
    stats = {}
    for name in obj_names:
        o = bpy.data.objects.get(name)
        if o is None or o.type != 'MESH':
            continue
        me = o.data
        a = me.color_attributes.get(attr)
        if a is None:
            a = me.color_attributes.new(attr, 'FLOAT_COLOR', 'CORNER')
        me.color_attributes.active_color = a
        mw = o.matrix_world
        m3 = mw.to_3x3()
        cache = {}
        vals = []
        nbig = 0
        nexp = 0
        _BVH = _ARCH
        for poly in me.polygons:
            n = (m3 @ poly.normal).normalized()
            if poly.area > BIG_POLY:
                nbig += 1
                ao, ne, _np = _big_face_ao(me, poly, mw, n)
                nexp += (1 if ne else 0)
                v = floor + (1.0 - floor) * ao
                for li in poly.loop_indices:
                    a.data[li].color = (v, v, v, 1.0)
                    vals.append(v)
                continue
            key_n = (round(n.x * NORMAL_BUCKET), round(n.y * NORMAL_BUCKET),
                     round(n.z * NORMAL_BUCKET))
            for li in poly.loop_indices:
                vi = me.loops[li].vertex_index
                key = (vi, key_n)
                ao = cache.get(key)
                if ao is None:
                    ao = openness(mw @ me.vertices[vi].co, n)
                    cache[key] = ao
                v = floor + (1.0 - floor) * ao
                a.data[li].color = (v, v, v, 1.0)
                vals.append(v)
        me.update()
        vals.sort()
        stats[name] = {"loops": len(vals), "rays": len(cache) * N_RAYS,
                       "big_faces": nbig, "big_exposed": nexp,
                       "min": round(vals[0], 3),
                       "p05": round(vals[len(vals) // 20], 3),
                       "med": round(vals[len(vals) // 2], 3),
                       "max": round(vals[-1], 3),
                       "mean": round(sum(vals) / len(vals), 3)}
    return stats


def flat(obj_names, value=1.0, attr="StoneAO"):
    """Give shared-mesh objects a neutral attribute so COLOR_0 stays uniform."""
    done = set()
    for name in obj_names:
        o = bpy.data.objects.get(name)
        if o is None or o.type != 'MESH' or o.data.name in done:
            continue
        done.add(o.data.name)
        me = o.data
        a = (me.color_attributes.get(attr)
             or me.color_attributes.new(attr, 'FLOAT_COLOR', 'CORNER'))
        me.color_attributes.active_color = a
        for i in range(len(me.loops)):
            a.data[i].color = (value, value, value, 1.0)
        me.update()
    return len(done)
