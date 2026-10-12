
# Road-label corrections. Runs inside edit.py (uses src, img, W, H, np, cv2).
from PIL import Image, ImageDraw, ImageFont
FONT = r'C:\Windows\Fonts\arial.ttf'; EM = 120; SS = 4
font = ImageFont.truetype(FONT, EM)

def render(text):
    w = int(font.getlength(text)) + 40
    im = Image.new('L', (w, EM + 60), 0)
    ImageDraw.Draw(im).text((20, 20), text, font=font, fill=255)
    return np.array(im)

def glyphs(box):
    """letter-sized red components of an existing label, in reading order (bottom to top)"""
    x0, y0, x1, y1 = box; roi = src[y0:y1, x0:x1].astype(int)
    m = ((roi[..., 2] > 150) & (roi[..., 1] < 140) & (roi[..., 0] < 140)).astype(np.uint8)
    n, lab, st, cen = cv2.connectedComponentsWithStats(m, connectivity=8)
    out = []
    for i in range(1, n):
        if st[i, 4] >= 90 and 12 <= st[i, 2] <= 28 and 12 <= st[i, 3] <= 28:
            ys, xs = np.nonzero(lab == i)
            out.append(np.c_[xs + x0, ys + y0].astype(float))
    out.sort(key=lambda p: -p[:, 1].mean())
    return out

def colour_of(g):
    px = np.vstack(g).astype(int); v = src[px[:, 1], px[:, 0]].astype(int)
    core = v[(v[:, 2] > 200) & (v[:, 1] < 45) & (v[:, 0] < 45)]
    return np.median(core, axis=0)

def paste(A, r, colour):
    ys, xs = np.nonzero(r > 0)
    c = np.array([[xs.min(), ys.min()], [xs.max(), ys.min()], [xs.max(), ys.max()], [xs.min(), ys.max()]], float)
    q = (A[:, :2] @ c.T).T + A[:, 2]
    x0, y0 = np.floor(q.min(0)).astype(int) - 2; x1, y1 = np.ceil(q.max(0)).astype(int) + 3
    B = A.copy(); B[:, 2] -= [x0, y0]; B[:, 2] += 0.5; B *= SS; B[:, 2] -= 0.5      # supersampled window
    a = cv2.warpAffine(r, B, ((x1 - x0) * SS, (y1 - y0) * SS), flags=cv2.INTER_LINEAR)
    a = cv2.resize(a, (x1 - x0, y1 - y0), interpolation=cv2.INTER_AREA).astype(float) / 255
    al = a[..., None]
    img[y0:y1, x0:x1] = (img[y0:y1, x0:x1] * (1 - al) + np.array(colour) * al).round().astype(np.uint8)

def frame(g):
    """reading direction d, glyph-down direction nrm, and image px per render px, from the label itself"""
    cen = np.array([p.mean(0) for p in g])
    c = cen.mean(0); u, sv, vt = np.linalg.svd(cen - c, full_matrices=False); d = vt[0]
    if d[1] > 0: d = -d
    nrm = np.array([-d[1], d[0]])
    allp = np.vstack(g); t = (allp - c) @ d
    r = render("PROPOSED 20' ROAD"); xs = np.nonzero(r > 128)[1]
    k = (t.max() - t.min() + 1) / (xs.max() + 1 - xs.min())
    return d, nrm, k

def swap_digit(box, index=8, new='3'):
    g = glyphs(box); assert len(g) == 14, len(g)      # PROPOSED 2 0 ROAD (the apostrophe is too small to count)
    d, nrm, k = frame(g)
    old = g[index]
    # erase exactly the old digit (its own pixels plus their soft edge)
    m = np.zeros((H, W), np.uint8); m[old[:, 1].astype(int), old[:, 0].astype(int)] = 1
    m = cv2.dilate(m, np.ones((7, 7), np.uint8)) > 0
    img[m] = 255
    # new digit, centred on the old one's box in the label's own frame
    r = render(new); ys, xs = np.nonzero(r > 128)
    rc = np.array([(xs.min() + xs.max()) / 2, (ys.min() + ys.max()) / 2])
    t = old @ d; s_ = old @ nrm
    ic = d * (t.min() + t.max()) / 2 + nrm * (s_.min() + s_.max()) / 2
    A = np.array([[k * d[0], k * nrm[0], 0], [k * d[1], k * nrm[1], 0]], float)
    A[:, 2] = ic - A[:, :2] @ rc
    paste(A, r, colour_of(g))
    print('label at', box, 'angle', round(float(np.degrees(np.arctan2(-d[1], d[0]))), 2), 'scale', round(float(k), 4),
          'old digit h', round(float(s_.max() - s_.min() + 1), 1), 'new digit h', round(float(k * (ys.max() + 1 - ys.min())), 1))
    return d, nrm, k, colour_of(g)

L1 = (955, 1385, 1075, 1690)     # along the road beside plots 1-4
L2 = (3212, 760, 3262, 1066)     # between the 162&163 and 164&165 columns
swap_digit(L1)
d, nrm, k, col = swap_digit(L2)
# new label in the strip east of plots 182-189: same size, direction and colour as the neighbouring road labels
r = render("PROPOSED 30' ROAD"); ys, xs = np.nonzero(r > 128)
rc = np.array([(xs.min() + xs.max()) / 2, (ys.min() + ys.max()) / 2])
A = np.array([[k * d[0], k * nrm[0], 0], [k * d[1], k * nrm[1], 0]], float)
A[:, 2] = np.array([3697.0, 953.0]) - A[:, :2] @ rc
paste(A, r, col)
