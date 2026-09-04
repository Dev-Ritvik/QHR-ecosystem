"""
P5H visibility audit: what a PROPOSED object would be worth, before it exists.

    python tools/gltf/p5h_visibility.py <shipped.glb> [--json out.json]

WHY A SEPARATE TOOL. phase5_camera_coverage.py answers "what is each existing
node worth" by projecting nodes that are already in the file. P5H has to answer
the opposite question - is a candidate worth authoring AT ALL - and the mandate
is explicit that budget must not be spent on objects no camera resolves. So the
candidate is described here as a world-space box and pushed through the same
five cameras before a single vertex is modelled.

WHAT IS REPRODUCED. The camera is the runtime's, not an approximation: the beat
position and target from cameraPath.ts, the frameOffset applied to the AIM along
the camera's own right vector, the roll applied about the view axis after
lookAt, and the 1424x900 drawing buffer the Phase 4/5 captures use. This is the
same construction phase5_camera_coverage.py uses and it is deliberately
duplicated rather than imported, because that module executes its own GLB scan
at import time.

WHAT IS MEASURED, per candidate per camera:
  * distance from the eye, and the metres-per-pixel the camera resolves there;
  * the candidate's height and width IN PIXELS - the number that decides whether
    ornament survives;
  * its screen bounding box and the fraction of frame its projected box covers;
  * whether it is in frame at all, and by how much it misses if not;
  * a COARSE occlusion test: the segment eye->candidate is intersected against
    the world bounding boxes of the scene's large occluders, so an object hidden
    behind the mansion or the hedge is reported as such.

CAVEAT, STATED, AND IT IS THE SAME ONE phase5_camera_coverage.py CARRIES. A
world-axis-aligned box overstates a slender object, and a box-level occlusion
test both overstates occlusion (the mansion's bbox is not solid - it contains
the portico's air) and cannot see a thin occluder. These numbers SIZE a
candidate and prove when something is off-frame or plainly buried. They do not
replace the runtime object-id pass, which is run after the object exists and is
the acceptance measurement.
"""
import json, struct, sys, math, re

SRC = sys.argv[1]
OUT = sys.argv[sys.argv.index('--json') + 1] if '--json' in sys.argv else None
W, H = 1424, 900

BEATS = [
    dict(name='HERO',    at=0.00, pos=(-20.0, 15.5, 27.0), tgt=(0.0, 4.1, 0.0),  fov=41, roll=0.0,    off=6.2),
    dict(name='WEST',    at=0.30, pos=(-26.0,  9.0,  2.0), tgt=(0.0, 4.6, 0.0),  fov=56, roll=-0.048, off=8.2),
    dict(name='NW',      at=0.58, pos=(-15.0,  8.4, -19.0), tgt=(0.0, 4.8, 0.0), fov=52, roll=-0.036, off=6.4),
    dict(name='TURN',    at=0.82, pos=(-6.0, 12.2, -14.0), tgt=(0.0, 12.0, -34.0), fov=46, roll=-0.012, off=4.2),
    dict(name='CONSTEL', at=1.00, pos=(0.0, 16.0, -24.0), tgt=(0.0, 16.0, -46.0), fov=38, roll=0.0,    off=2.6),
]

# ---- the P5H candidates, in metres, world space -----------------------------
# Each is the SMALLEST box that contains the proposal, so nothing here flatters
# itself. The entrance pair is placed on the step cheeks the building already
# has: entry_cheek_-1/1 span x 2.5..3.0, z 5.60..6.80 with a flat top at
# y 0.600, which is a built pedestal standing empty.
CHEEK = dict(x0=2.500, x1=3.000, z0=5.600, z1=6.800, top=0.600)
CX = (CHEEK['x0'] + CHEEK['x1']) / 2.0
CZ = (CHEEK['z0'] + CHEEK['z1']) / 2.0

CANDIDATES = [
    dict(key='urn_W', note='entrance urn, west cheek',
         cx=-CX, cz=CZ, y0=CHEEK['top'], h=0.86, w=0.46),
    dict(key='urn_E', note='entrance urn, east cheek',
         cx=+CX, cz=CZ, y0=CHEEK['top'], h=0.86, w=0.46),
    # Rejected hypotheses are measured too, so the rejection is evidence.
    dict(key='gate_pier_W', note='gate pier at the drive mouth (P5F hypothesis)',
         cx=-6.0, cz=32.0, y0=0.0, h=2.20, w=0.80),
    dict(key='lamp_drive_W', note='path lamp, forecourt kerb west',
         cx=-7.5, cz=16.0, y0=0.0, h=1.10, w=0.22),
    dict(key='lamp_step_W', note='path lamp, foot of the entry steps west',
         cx=-3.9, cz=7.4, y0=0.40, h=1.10, w=0.22),
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
    fwd = norm(sub(tgt, pos))
    right = norm(cross(fwd, (0.0, 1.0, 0.0)))
    aim = add(tgt, scl(right, -off))
    z = norm(sub(pos, aim))
    x = norm(cross((0.0, 1.0, 0.0), z))
    y = cross(z, x)
    if roll:
        c, s = math.cos(roll), math.sin(roll)
        x, y = add(scl(x, c), scl(y, s)), add(scl(y, c), scl(x, -s))
    return x, y, z


def project(p, pos, basis, fov):
    bx, by, bz = basis
    d = sub(p, pos)
    cx, cy, cz = dot(d, bx), dot(d, by), dot(d, bz)
    depth = -cz
    if depth <= 1e-4:
        return None
    ty = math.tan(math.radians(fov) / 2.0)
    tx = ty * (W / H)
    return ((cx / (depth * tx) * 0.5 + 0.5) * W, (0.5 - cy / (depth * ty) * 0.5) * H, depth)


def m_per_px(depth, fov):
    """Vertical metres per pixel a perspective camera resolves at `depth`."""
    return 2.0 * depth * math.tan(math.radians(fov) / 2.0) / H


# ---- GLB, for the occluder set ----------------------------------------------
def load(path):
    d = open(path, 'rb').read()
    off, g = 12, None
    while off < len(d):
        ln, ty = struct.unpack_from('<II', d, off)
        if ty == 0x4E4F534A:
            g = json.loads(d[off + 8:off + 8 + ln].decode())
        off += 8 + ln
    return g


g = load(SRC)
nodes, meshes, accs = g['nodes'], g['meshes'], g['accessors']


def node_matrix(n):
    if 'matrix' in n:
        m = n['matrix']
        return [[m[0], m[4], m[8], m[12]], [m[1], m[5], m[9], m[13]],
                [m[2], m[6], m[10], m[14]], [0, 0, 0, 1]]
    t = n.get('translation', [0, 0, 0])
    r = n.get('rotation', [0, 0, 0, 1])
    s = n.get('scale', [1, 1, 1])
    x, y, z, w = r
    R = [[1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
         [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
         [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)]]
    return [[R[i][j] * s[j] for j in range(3)] + [t[i]] for i in range(3)] + [[0, 0, 0, 1]]


def mul(A, B):
    return [[sum(A[i][k] * B[k][j] for k in range(4)) for j in range(4)] for i in range(4)]


bboxes = {}


def walk(idx, P):
    n = nodes[idx]
    Wm = mul(P, node_matrix(n))
    if 'mesh' in n:
        lo, hi = [1e9] * 3, [-1e9] * 3
        for pr in meshes[n['mesh']]['primitives']:
            a = accs[pr['attributes']['POSITION']]
            mn, mx = a['min'], a['max']
            for c in range(8):
                p = [mn[0] if c & 1 else mx[0], mn[1] if c & 2 else mx[1], mn[2] if c & 4 else mx[2]]
                wp = [sum(Wm[i][j] * p[j] for j in range(3)) + Wm[i][3] for i in range(3)]
                for i in range(3):
                    lo[i] = min(lo[i], wp[i])
                    hi[i] = max(hi[i], wp[i])
        bboxes[n.get('name', 'n%d' % idx)] = (lo, hi)
    for c in n.get('children', []):
        walk(c, Wm)


I = [[1 if i == j else 0 for j in range(4)] for i in range(4)]
for s in g['scenes'][g.get('scene', 0)]['nodes']:
    walk(s, I)

# The occluder set: the things big and solid enough to hide a 0.9 m object.
# ground_plane is EXCLUDED - its bbox is 520 m across and would swallow every
# ray, and a ground plane cannot occlude something standing on it.
OCC = re.compile(r'^(ashlar_|rustic_|mansion_|portico_|hedge_|cyp_|terrace_|arch(back|glass)_|door)')
occluders = [(k, v) for k, v in bboxes.items() if OCC.match(k)]


def seg_hits_box(p0, p1, lo, hi, shrink=0.0):
    """Slab test. `shrink` pulls the box in, so a ray grazing a bbox corner that
    contains mostly air is not counted as an occlusion."""
    tmin, tmax = 0.0, 1.0
    d = sub(p1, p0)
    for i in range(3):
        a, b = lo[i] + shrink, hi[i] - shrink
        if b < a:
            a = b = (lo[i] + hi[i]) / 2.0
        if abs(d[i]) < 1e-9:
            if p0[i] < a or p0[i] > b:
                return False
            continue
        t0, t1 = (a - p0[i]) / d[i], (b - p0[i]) / d[i]
        if t0 > t1:
            t0, t1 = t1, t0
        tmin, tmax = max(tmin, t0), min(tmax, t1)
        if tmin > tmax:
            return False
    return True


rows = []
print('P5H VISIBILITY AUDIT   %s   %dx%d' % (SRC.replace('\\', '/').split('/')[-1], W, H))
print('candidate boxes are the SMALLEST box containing the proposal.\n')

for c in CANDIDATES:
    print('== %-14s %s' % (c['key'], c['note']))
    print('   box  x %+.3f..%+.3f  y %.3f..%.3f  z %+.3f..%+.3f'
          % (c['cx'] - c['w'] / 2, c['cx'] + c['w'] / 2, c['y0'], c['y0'] + c['h'],
             c['cz'] - c['w'] / 2, c['cz'] + c['w'] / 2))
    print('   %-8s %7s %8s %8s %8s %9s  %-9s %s'
          % ('beat', 'dist', 'm/px', 'H px', 'W px', 'cover %', 'in-frame', 'occluders'))
    for b in BEATS:
        basis = camera_basis(b['pos'], b['tgt'], b['off'], b['roll'])
        corners = []
        for sx in (-1, 1):
            for sz in (-1, 1):
                for sy in (0, 1):
                    corners.append((c['cx'] + sx * c['w'] / 2, c['y0'] + sy * c['h'],
                                    c['cz'] + sz * c['w'] / 2))
        pts = [project(p, b['pos'], basis, b['fov']) for p in corners]
        if any(p is None for p in pts):
            print('   %-8s  BEHIND CAMERA' % b['name'])
            continue
        xs = [p[0] for p in pts]
        ys = [p[1] for p in pts]
        centre = (c['cx'], c['y0'] + c['h'] / 2, c['cz'])
        pc = project(centre, b['pos'], basis, b['fov'])
        dist = math.sqrt(dot(sub(centre, b['pos']), sub(centre, b['pos'])))
        mpp = m_per_px(pc[2], b['fov'])
        hpx, wpx = c['h'] / mpp, c['w'] / mpp
        x0, x1 = max(0.0, min(xs)), min(float(W), max(xs))
        y0, y1 = max(0.0, min(ys)), min(float(H), max(ys))
        vis = (x1 > x0) and (y1 > y0)
        cover = ((x1 - x0) * (y1 - y0) / (W * H) * 100.0) if vis else 0.0
        if vis:
            inf = 'yes'
        else:
            dx = max(0.0, max(min(xs) - W, -max(xs)))
            dy = max(0.0, max(min(ys) - H, -max(ys)))
            inf = 'NO %.0fpx' % max(dx, dy)
        hits = [k for k, (lo, hi) in occluders if seg_hits_box(b['pos'], centre, lo, hi, 0.02)]
        hs = ('%d: %s' % (len(hits), ','.join(sorted(hits)[:3]))) if hits else '-'
        print('   %-8s %7.2f %8.5f %8.1f %8.1f %9.4f  %-9s %s'
              % (b['name'], dist, mpp, hpx, wpx, cover, inf, hs))
        rows.append(dict(candidate=c['key'], beat=b['name'], dist=round(dist, 3),
                         m_per_px=round(mpp, 6), h_px=round(hpx, 1), w_px=round(wpx, 1),
                         cover_pct=round(cover, 4), in_frame=vis, occluders=sorted(hits)))
    print()

if OUT:
    json.dump(dict(src=SRC, w=W, h=H, candidates=CANDIDATES, rows=rows), open(OUT, 'w'), indent=1)
    print('wrote', OUT)
