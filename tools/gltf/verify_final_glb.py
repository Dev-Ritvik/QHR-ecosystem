"""
Verify the shipped GLBs by reading the files themselves - not the Blender scene.

Decodes every embedded KTX2 header for real pixel dimensions and transfer
function, resolves each material's texture bindings by name, and checks the
station rig, UV sets, texCoord validity and extension use.

    python verify_final_glb.py <a.glb> [b.glb ...]
"""
import json, struct, os, sys, collections

TF = {1: "linear", 2: "srgb"}


def load(p):
    d = open(p, "rb").read()
    off, g, binc = 12, None, None
    while off < len(d):
        ln, ty = struct.unpack_from("<II", d, off); off += 8
        if ty == 0x4E4F534A:
            g = json.loads(d[off:off+ln].decode("utf-8"))
        elif ty == 0x004E4942:
            binc = off
        off += ln
    return g, d, binc


def ktx_info(blob):
    """(width, height, transferFunction) from a KTX2 header + DFD."""
    if blob[:12] != b"\xabKTX 20\xbb\r\n\x1a\n":
        return None
    w, h = struct.unpack_from("<II", blob, 12 + 2 * 4)
    dfdOff, dfdLen = struct.unpack_from("<II", blob, 12 + 9 * 4)
    tf = None
    if dfdOff:
        b = blob[dfdOff:dfdOff+dfdLen]
        if len(b) >= 16:
            tf = b[14]
    return w, h, TF.get(tf, "tf%s" % tf)


def slots(m):
    pbr = m.get("pbrMetallicRoughness", {})
    return [("baseColorTexture", pbr.get("baseColorTexture")),
            ("metallicRoughnessTexture", pbr.get("metallicRoughnessTexture")),
            ("normalTexture", m.get("normalTexture")),
            ("occlusionTexture", m.get("occlusionTexture")),
            ("emissiveTexture", m.get("emissiveTexture"))]


def run(path):
    g, d, bo = load(path)
    nodes = g.get("nodes", []); names = [n.get("name", "") for n in nodes]
    idx = {n: i for i, n in enumerate(names)}
    meshes = g.get("meshes", []); mats = g.get("materials", [])
    imgs = g.get("images", []); tex = g.get("textures", [])
    used = g.get("extensionsUsed", []); req = g.get("extensionsRequired", [])

    tri = 0
    for n in nodes:
        if "mesh" not in n:
            continue
        for p in meshes[n["mesh"]]["primitives"]:
            ia = p.get("indices")
            if ia is not None:
                tri += g["accessors"][ia]["count"] // 3

    # decode every image header
    info = {}
    for i, im in enumerate(imgs):
        if "bufferView" not in im:
            continue
        bv = g["bufferViews"][im["bufferView"]]
        st = bo + bv.get("byteOffset", 0)
        r = ktx_info(d[st:st+bv["byteLength"]])
        info[i] = {"name": im.get("name"), "mime": im.get("mimeType"),
                   "wh": (r[0], r[1]) if r else None,
                   "tf": r[2] if r else None,
                   "div4": (r[0] % 4 == 0 and r[1] % 4 == 0) if r else None}

    def src_of(ti):
        t = tex[ti]
        s = t.get("source")
        if s is None:
            s = t.get("extensions", {}).get("KHR_texture_basisu", {}).get("source")
        return s

    neg = 0
    aniso = []
    for m in mats:
        for nm, s in slots(m):
            if s and s.get("texCoord", 0) < 0:
                neg += 1
        if "KHR_materials_anisotropy" in m.get("extensions", {}):
            aniso.append(m.get("name"))
    mn = [m.get("name") for m in mats]
    dup = sorted({x for x in mn if mn.count(x) > 1})
    bad4 = [v for v in info.values() if v["div4"] is False]

    print("\n" + "=" * 70)
    print(os.path.basename(path))
    print("=" * 70)
    print("  size                 %.2f MB" % (os.path.getsize(path) / 1048576))
    print("  drawn triangles      %s" % format(tri, ","))
    print("  nodes / meshes       %d / %d" % (len(nodes), len(meshes)))
    print("  Draco                used=%s required=%s" % (
        "KHR_draco_mesh_compression" in used, "KHR_draco_mesh_compression" in req))
    print("  KTX2                 used=%s required=%s  images=%d  mime=%s" % (
        "KHR_texture_basisu" in used, "KHR_texture_basisu" in req, len(imgs),
        sorted({i.get("mimeType") for i in imgs})))
    print("  negative texCoord    %d" % neg)
    print("  duplicate mat names  %d %s" % (len(dup), dup if dup else ""))
    print("  anisotropy materials %s" % (aniso if aniso else "none"))
    print("  NON-multiple-of-4    %d %s" % (len(bad4), [b["name"] for b in bad4]))
    print("  every image dims:")
    for i in sorted(info):
        v = info[i]
        print("      %-28s %5dx%-5d div4=%-5s %s" % (
            (v["name"] or "?")[:28], v["wh"][0], v["wh"][1], v["div4"], v["tf"]))

    # named bindings the brief calls out
    want = {"MAT_Holo3D_Plate_S1": "kartikeya", "MAT_Holo3D_Plate_S2": "lucky",
            "MAT_Holo3D_Plate_S3": "gayatri", "MAT_Portrait": "founder"}
    hits = {}
    for m in mats:
        nmm = m.get("name")
        if nmm not in want:
            continue
        for slot, s in slots(m):
            if not s:
                continue
            si = src_of(s["index"])
            if si is None or si not in info:
                continue
            hits.setdefault(nmm, []).append((slot, info[si]["name"], info[si]["wh"],
                                             info[si]["div4"]))
    if hits:
        print("  brief-critical bindings:")
        for k in ("MAT_Holo3D_Plate_S1", "MAT_Holo3D_Plate_S2",
                  "MAT_Holo3D_Plate_S3", "MAT_Portrait"):
            if k in hits:
                for slot, iname, wh, ok in hits[k]:
                    print("      %-22s %-18s -> %-26s %sx%s div4=%s" % (
                        k, slot, iname, wh[0], wh[1], ok))
            elif k in want:
                print("      %-22s NOT PRESENT" % k)

    if "STATION_S1" in idx:
        print("  station rig:")
        for s in ("S1", "S2", "S3", "S4"):
            st = idx.get("STATION_" + s)
            ch = [names[c] for c in nodes[st].get("children", [])] if st is not None else None
            tt = idx.get("TURNTABLE_" + s)
            tch = [names[c] for c in nodes[tt].get("children", [])] if tt is not None else None
            print("      STATION_%s -> %s" % (s, ch))
            print("          TURNTABLE_%s -> %s   projector outside=%s" % (
                s, tch, ("projector_" + s) in (ch or [])))


for p in sys.argv[1:]:
    run(p)
