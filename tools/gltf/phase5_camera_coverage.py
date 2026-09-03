"""
What each object is WORTH, in screen area, at the cameras the site actually uses.

    python tools/gltf/phase5_camera_coverage.py <shipped.glb> [--json out.json]

Phase 5 must not spend geometry or texture budget on things no camera sees, and
"it looks visible" is not a measurement. This projects every mesh node's world
bounding box through the exact camera the runtime builds at each beat and
reports the fraction of frame each one covers.

THE CAMERA IS REPRODUCED, NOT APPROXIMATED. cameraPath.ts drives a centripetal
Catmull-Rom through five beats and then pushes the AIM left along the camera's
own right vector by a per-beat frameOffset; WorldCanvas applies fov and a roll
about the view axis after lookAt. All of that is implemented here, and
POSITION_CURVE.getPoint at a control point returns that control point exactly,
so evaluating at the beats needs no curve at all - the curve is implemented
anyway so intermediate scroll positions can be sampled with the same code.

CAVEAT, STATED. A world-axis-aligned bounding box OVERSTATES a thin or diagonal
object (a cypress cone, the hedge run) and cannot see occlusion, so these
numbers rank and bound; they do not replace a runtime object-ID pass. They are
used here for exactly what they are good for: telling terrain from trim, and
proving that something is off-frame.
"""
import json, struct, sys, math, re
from collections import defaultdict

SRC = sys.argv[1]
OUT = sys.argv[sys.argv.index('--json') + 1] if '--json' in sys.argv else None
W, H = 1424, 900          # the Phase 4 capture size, kept identical

# ---- beats, transcribed from cameraPath.ts ---------------------------------
BEATS = [
    dict(name='HERO',   at=0.00, pos=(-20.0, 15.5, 27.0), tgt=(0.0, 4.1, 0.0),  fov=41, roll=0.0,    off=6.2),
    dict(name='WEST',   at=0.30, pos=(-26.0,  9.0,  2.0), tgt=(0.0, 4.6, 0.0),  fov=56, roll=-0.048, off=8.2),
    dict(name='NW',     at=0.58, pos=(-15.0,  8.4,-19.0), tgt=(0.0, 4.8, 0.0),  fov=52, roll=-0.036, off=6.4),
    dict(name='TURN',   at=0.82, pos=( -6.0, 12.2,-14.0), tgt=(0.0,12.0,-34.0), fov=46, roll=-0.012, off=4.2),
    dict(name='CONSTEL',at=1.00, pos=(  0.0, 16.0,-24.0), tgt=(0.0,16.0,-46.0), fov=38, roll=0.0,    off=2.6),
]


def sub(a, b): return (a[0] - b[0], a[1] - b[1], a[2] - b[2])
def add(a, b): return (a[0] + b[0], a[1] + b[1], a[2] + b[2])
def scl(a, k): return (a[0] * k, a[1] * k, a[2] * k)
def dot(a, b): return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
def cross(a, b): return (a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0])
def norm(a):
    l = math.sqrt(dot(a, a)) or 1.0
    return (a[0] / l, a[1] / l, a[2] / l)


def camera_basis(pos, tgt, off, roll):
    """three's lookAt basis, after the frameOffset nudge and the roll."""
    fwd = norm(sub(tgt, pos))
    right = norm(cross(fwd, (0.0, 1.0, 0.0)))
    aim = add(tgt, scl(right, -off))
    # three: z = normalize(eye - target); x = cross(up, z); y = cross(z, x)
    z = norm(sub(pos, aim))
    x = norm(cross((0.0, 1.0, 0.0), z))
    y = cross(z, x)
    if roll:                                    # rotateZ about the view axis
        c, s = math.cos(roll), math.sin(roll)
        x2 = add(scl(x, c), scl(y, s))
        y2 = add(scl(y, c), scl(x, -s))
        x, y = x2, y2
    return x, y, z


def project(p, pos, basis, fov):
    """-> (sx, sy, depth). depth > 0 is in front of the camera."""
    x, y, z = basis
    d = sub(p, pos)
    cx, cy, cz = dot(d, x), dot(d, y), dot(d, z)
    depth = -cz
    if depth <= 1e-4: return None
    ty = math.tan(math.radians(fov) / 2.0)
    tx = ty * (W / H)
    return ((cx / (depth * tx) * 0.5 + 0.5) * W, (0.5 - cy / (depth * ty) * 0.5) * H, depth)


# ---- GLB ---------------------------------------------------------------------
def load(path):
    d = open(path, 'rb').read()
    off, g = 12, None
    while off < len(d):
        ln, ty = struct.unpack_from('<II', d, off)
        if ty == 0x4E4F534A: g = json.loads(d[off + 8:off + 8 + ln].decode())
        off += 8 + ln
    return g


g = load(SRC)
nodes, meshes, accs, mats = g['nodes'], g['meshes'], g['accessors'], g['materials']

CLASS = [
    ('terrain',  r'^ground_plane$'),
    ('hedge',    r'^hedge_'),
    ('cypress',  r'^cyp_'),
    ('fountain', r'^fount'),
    ('terrace',  r'^terrace_'),
    ('steps',    r'^entry_'),
    ('roof',     r'^(mansion_roof|roof_peak|spire_|finial_|cupola_)'),
    ('masonry',  r'^(ashlar_|rustic_)'),
    ('mansion',  r'^(mansion_|portico_|arch|door|lion_)'),
]


def classify(n):
    for k, p in CLASS:
        if re.match(p, n): return k
    return 'other'


def mat_of(n):
    if 'matrix' in n:
        m = n['matrix']
        return [[m[0], m[4], m[8], m[12]], [m[1], m[5], m[9], m[13]], [m[2], m[6], m[10], m[14]], [0, 0, 0, 1]]
    t = n.get('translation', [0, 0, 0]); r = n.get('rotation', [0, 0, 0, 1]); s = n.get('scale', [1, 1, 1])
    x, y, z, w = r
    R = [[1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
         [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
         [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)]]
    return [[R[i][j] * s[j] for j in range(3)] + [t[i]] for i in range(3)] + [[0, 0, 0, 1]]


def mm(a, b): return [[sum(a[i][k] * b[k][j] for k in range(4)) for j in range(4)] for i in range(4)]
def ap(m, p): return tuple(sum(m[i][j] * p[j] for j in range(3)) + m[i][3] for i in range(3))


items = []
I4 = [[1 if i == j else 0 for j in range(4)] for i in range(4)]


def walk(i, par):
    n = nodes[i]; wm = mm(par, mat_of(n))
    if 'mesh' in n:
        lo = [1e9] * 3; hi = [-1e9] * 3; tris = 0; mset = set()
        for p in meshes[n['mesh']]['primitives']:
            tris += accs[p['indices']]['count'] // 3 if 'indices' in p else 0
            if 'material' in p: mset.add(mats[p['material']].get('name'))
            a = p['attributes'].get('POSITION')
            if a is None or 'min' not in accs[a]: continue
            mn, mx = accs[a]['min'], accs[a]['max']
            for c in range(8):
                q = ap(wm, [mn[0] if c & 1 else mx[0], mn[1] if c & 2 else mx[1], mn[2] if c & 4 else mx[2]])
                for k in range(3):
                    lo[k] = min(lo[k], q[k]); hi[k] = max(hi[k], q[k])
        if lo[0] < 1e8:
            items.append(dict(name=n.get('name', ''), cls=classify(n.get('name', '')),
                              tris=tris, mats=sorted(mset), lo=lo, hi=hi))
    for c in n.get('children', []): walk(c, wm)


for r in g['scenes'][g.get('scene', 0)]['nodes']: walk(r, I4)

FRAME = float(W * H)
report = {}
for b in BEATS:
    basis = camera_basis(b['pos'], b['tgt'], b['off'], b['roll'])
    per = defaultdict(lambda: dict(cover=0.0, on=0, off=0, tris=0, near=1e9, far=0.0, names=[]))
    rows = []
    for it in items:
        pts = [project((it['lo'][0] if c & 1 else it['hi'][0],
                        it['lo'][1] if c & 2 else it['hi'][1],
                        it['lo'][2] if c & 4 else it['hi'][2]), b['pos'], basis, b['fov']) for c in range(8)]
        vis = [p for p in pts if p]
        d = per[it['cls']]
        d['tris'] += it['tris']
        if not vis:
            d['off'] += 1; continue
        x0 = max(0.0, min(p[0] for p in vis)); x1 = min(float(W), max(p[0] for p in vis))
        y0 = max(0.0, min(p[1] for p in vis)); y1 = min(float(H), max(p[1] for p in vis))
        a = max(0.0, x1 - x0) * max(0.0, y1 - y0)
        if a <= 0:
            d['off'] += 1; continue
        d['on'] += 1; d['cover'] += a
        d['near'] = min(d['near'], min(p[2] for p in vis)); d['far'] = max(d['far'], max(p[2] for p in vis))
        if len(d['names']) < 6: d['names'].append(it['name'])
        rows.append((a / FRAME, it['name'], it['cls'], min(p[2] for p in vis)))
    report[b['name']] = {k: {**v, 'cover_pct': 100.0 * v['cover'] / FRAME} for k, v in per.items()}
    print('=== %s  pos=%s fov=%d  (%dx%d) ===' % (b['name'], b['pos'], b['fov'], W, H))
    print('%-9s %5s %5s %9s %9s %8s  %s' % ('CLASS', 'ON', 'OFF', 'TRIS', 'BBOXAREA', 'NEAR m', 'example'))
    for k, v in sorted(per.items(), key=lambda x: -x[1]['cover']):
        print('%-9s %5d %5d %9d %8.1f%% %8.1f  %s'
              % (k, v['on'], v['off'], v['tris'], 100.0 * v['cover'] / FRAME,
                 v['near'] if v['near'] < 1e8 else -1, ', '.join(v['names'][:3])))
    big = sorted(rows, reverse=True)[:6]
    print('  largest single objects: ' + ', '.join('%s %.1f%% @%.0fm' % (n, 100 * a, d) for a, n, c, d in big))
    print()

if OUT:
    json.dump(report, open(OUT, 'w'), indent=1)
    print('WROTE', OUT)
