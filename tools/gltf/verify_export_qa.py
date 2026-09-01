"""
Export QA: read the GLB and check what actually shipped.

verify_final_glb.py answers "is the container well formed" - KTX2 headers,
texCoord validity, Draco, extension use. This answers the other half: is the
CONTENT right. It decodes accessors, so run it on an UNCOMPRESSED export
(GLTF_RAW=1); Draco moves the vertex data into an extension where none of the
per-vertex checks below can reach it.

Checks, in the order the directive asks for them:
    materials, textures, UVs, normals, vertex colours, AO, node transforms,
    geometry, draw calls, missing assets, scale, origin, transparency.

The vertex-colour check is the one that matters most here. StoneAO ships as
COLOR_0 and glTF multiplies it into base colour with no runtime code, so a
single mesh that lost the attribute renders at full brightness beside its
neighbours, and a single mesh whose values decoded wrong renders black. Both
are invisible in Blender and obvious in a browser.

    python verify_export_qa.py <a.glb> [b.glb ...]
"""
import json
import math
import os
import struct
import sys
from collections import Counter, defaultdict

CT = {5120: ("b", 1), 5121: ("B", 1), 5122: ("h", 2),
      5123: ("H", 2), 5125: ("I", 4), 5126: ("f", 4)}
NCOMP = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4, "MAT4": 16}


def load(path):
    d = open(path, "rb").read()
    off, g, bin_off = 12, None, None
    while off < len(d):
        ln, ty = struct.unpack_from("<II", d, off)
        off += 8
        if ty == 0x4E4F534A:
            g = json.loads(d[off:off + ln].decode("utf-8"))
        elif ty == 0x004E4942:
            bin_off = off
        off += ln
    return g, d, bin_off


def read_accessor(g, d, bin_off, ai):
    a = g["accessors"][ai]
    n = a["count"]
    ncomp = NCOMP[a["type"]]
    fmt, size = CT[a["componentType"]]
    if "bufferView" not in a:
        return [tuple([0] * ncomp)] * n
    bv = g["bufferViews"][a["bufferView"]]
    base = bin_off + bv.get("byteOffset", 0) + a.get("byteOffset", 0)
    stride = bv.get("byteStride") or ncomp * size
    out = []
    for i in range(n):
        o = base + i * stride
        out.append(struct.unpack_from("<" + fmt * ncomp, d, o))
    return out


def norm_val(v, ct):
    if ct == 5121:
        return v / 255.0
    if ct == 5123:
        return v / 65535.0
    return v


def mat_of(g, i):
    return g.get("materials", [])[i].get("name", "material_%d" % i) if i is not None else None


def node_world(g, i, parent=None):
    n = g["nodes"][i]
    m = n.get("matrix")
    if m:
        M = [m[0:4], m[4:8], m[8:12], m[12:16]]      # column-major
    else:
        t = n.get("translation", [0, 0, 0])
        r = n.get("rotation", [0, 0, 0, 1])
        s = n.get("scale", [1, 1, 1])
        x, y, z, w = r
        R = [[1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
             [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
             [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)]]
        M = [[R[0][0] * s[0], R[1][0] * s[0], R[2][0] * s[0], 0.0],
             [R[0][1] * s[1], R[1][1] * s[1], R[2][1] * s[1], 0.0],
             [R[0][2] * s[2], R[1][2] * s[2], R[2][2] * s[2], 0.0],
             [t[0], t[1], t[2], 1.0]]
    if parent is None:
        return M
    out = [[0.0] * 4 for _ in range(4)]
    for c in range(4):
        for r in range(4):
            out[c][r] = sum(M[c][k] * parent[k][r] for k in range(4))
    return out


def xform(M, p):
    return tuple(M[0][r] * p[0] + M[1][r] * p[1] + M[2][r] * p[2] + M[3][r]
                 for r in range(3))


def run(path):
    g, d, bin_off = load(path)
    R = {"file": os.path.basename(path), "mb": round(os.path.getsize(path) / 1048576.0, 2)}
    nodes = g.get("nodes", [])
    meshes = g.get("meshes", [])
    mats = g.get("materials", [])
    imgs = g.get("images", [])
    texs = g.get("textures", [])
    R["extensions"] = {"used": g.get("extensionsUsed", []),
                       "required": g.get("extensionsRequired", [])}
    draco = "KHR_draco_mesh_compression" in R["extensions"]["used"]
    R["draco"] = draco

    # ---- node graph, transforms, draw calls -------------------------------
    world = {}
    stack = [(i, None) for i in g["scenes"][g.get("scene", 0)].get("nodes", [])]
    order = []
    while stack:
        i, par = stack.pop()
        M = node_world(g, i, par)
        world[i] = M
        order.append(i)
        for c in nodes[i].get("children", []):
            stack.append((c, M))
    R["nodes"] = len(nodes)
    R["nodes_reached"] = len(world)
    R["orphan_nodes"] = len(nodes) - len(world)
    R["meshes"] = len(meshes)
    prims = sum(len(m.get("primitives", [])) for m in meshes)
    R["mesh_primitives"] = prims
    R["draw_calls"] = sum(len(meshes[nodes[i]["mesh"]].get("primitives", []))
                          for i in world if "mesh" in nodes[i])

    odd = []
    for i in world:
        n = nodes[i]
        s = n.get("scale")
        if s and (abs(s[0] - s[1]) > 1e-4 or abs(s[1] - s[2]) > 1e-4):
            odd.append((n.get("name", i), "non-uniform", [round(x, 4) for x in s]))
        if s and min(s) < 0:
            odd.append((n.get("name", i), "negative", [round(x, 4) for x in s]))
    R["odd_scales"] = odd[:10]
    R["odd_scale_count"] = len(odd)

    # ---- geometry, UVs, normals, vertex colours ---------------------------
    tri = 0
    drawn = 0
    attrs = Counter()
    vc = defaultdict(lambda: {"prims": 0, "min": 9e9, "max": -9e9, "sum": 0.0,
                              "n": 0, "type": None, "alpha_min": 9e9})
    no_vc = defaultdict(int)
    uv_range = [9e9, -9e9]
    bad_normals = 0
    normals_checked = 0
    uv_sampled = 0
    bbox = [9e9] * 3 + [-9e9] * 3
    mbox = [9e9] * 3 + [-9e9] * 3      # everything except the 240 m ground plane

    mesh_nodes = defaultdict(list)
    for i in world:
        if "mesh" in nodes[i]:
            mesh_nodes[nodes[i]["mesh"]].append(i)

    for mi, m in enumerate(meshes):
        for p in m.get("primitives", []):
            a = p.get("attributes", {})
            for k in a:
                attrs[k] += 1
            mname = mat_of(g, p.get("material"))
            if draco:
                continue
            npos = g["accessors"][a["POSITION"]]["count"]
            n_tri = (g["accessors"][p["indices"]]["count"] // 3
                     if "indices" in p else npos // 3)
            tri += n_tri
            # DRAWN triangles counts every node that instances the mesh. The
            # 267 ashlar blocks share 78 meshes, so a per-mesh total under-
            # reports the frame by everything the instancing saved.
            drawn += n_tri * max(1, len(mesh_nodes.get(mi, [])))
            # bbox in world space, via every node that instances this mesh
            acc = g["accessors"][a["POSITION"]]
            is_ground = any((nodes[ni].get("name") or "") == "ground_plane"
                            for ni in mesh_nodes.get(mi, []))
            if "min" in acc and "max" in acc:
                corners = [(acc["min"][0] if bx else acc["max"][0],
                            acc["min"][1] if by else acc["max"][1],
                            acc["min"][2] if bz else acc["max"][2])
                           for bx in (0, 1) for by in (0, 1) for bz in (0, 1)]
                for ni in mesh_nodes.get(mi, []):
                    for c in corners:
                        w = xform(world[ni], c)
                        for k in range(3):
                            bbox[k] = min(bbox[k], w[k])
                            bbox[3 + k] = max(bbox[3 + k], w[k])
                            if not is_ground:
                                mbox[k] = min(mbox[k], w[k])
                                mbox[3 + k] = max(mbox[3 + k], w[k])
            if "COLOR_0" in a:
                acc0 = g["accessors"][a["COLOR_0"]]
                vals = read_accessor(g, d, bin_off, a["COLOR_0"])
                e = vc[mname]
                e["prims"] += 1
                e["type"] = "%s/%s" % (acc0["type"], acc0["componentType"])
                step = max(1, len(vals) // 400)
                for v in vals[::step]:
                    r = norm_val(v[0], acc0["componentType"])
                    e["min"] = min(e["min"], r)
                    e["max"] = max(e["max"], r)
                    e["sum"] += r
                    e["n"] += 1
                    if len(v) > 3:
                        e["alpha_min"] = min(e["alpha_min"],
                                             norm_val(v[3], acc0["componentType"]))
            else:
                no_vc[mname] += 1
            if "TEXCOORD_0" in a:
                acc1 = g["accessors"][a["TEXCOORD_0"]]
                if "min" in acc1 and "max" in acc1:
                    uv_range[0] = min(uv_range[0], min(acc1["min"]))
                    uv_range[1] = max(uv_range[1], max(acc1["max"]))
                elif uv_sampled < 40:
                    uv_sampled += 1
                    uvs = read_accessor(g, d, bin_off, a["TEXCOORD_0"])
                    for u in uvs[::max(1, len(uvs) // 300)]:
                        uv_range[0] = min(uv_range[0], u[0], u[1])
                        uv_range[1] = max(uv_range[1], u[0], u[1])
            if "NORMAL" in a and normals_checked < 6:
                normals_checked += 1
                ns = read_accessor(g, d, bin_off, a["NORMAL"])
                for v in ns[::max(1, len(ns) // 200)]:
                    L = math.sqrt(v[0] ** 2 + v[1] ** 2 + v[2] ** 2)
                    if abs(L - 1.0) > 0.02:
                        bad_normals += 1

    R["triangles_unique"] = tri
    R["triangles_drawn"] = drawn
    R["attributes"] = dict(attrs)
    R["uv0_range"] = [round(uv_range[0], 3), round(uv_range[1], 3)] if uv_range[0] < 9e8 else None
    R["non_unit_normals_sampled"] = bad_normals
    if bbox[0] < 9e8:
        R["bbox_min"] = [round(x, 3) for x in bbox[:3]]
        R["bbox_max"] = [round(x, 3) for x in bbox[3:]]
        R["size_m"] = [round(bbox[3 + k] - bbox[k], 3) for k in range(3)]
        R["ground_y"] = round(bbox[1], 3)
        R["centre_xz"] = [round((bbox[0] + bbox[3]) / 2, 3),
                          round((bbox[2] + bbox[5]) / 2, 3)]
    if mbox[0] < 9e8:
        R["model_size_m"] = [round(mbox[3 + k] - mbox[k], 3) for k in range(3)]
        R["model_min"] = [round(x, 3) for x in mbox[:3]]
        R["model_max"] = [round(x, 3) for x in mbox[3:]]

    R["vertex_colours"] = {k: {"prims": v["prims"], "type": v["type"],
                               "min": round(v["min"], 4), "max": round(v["max"], 4),
                               "mean": round(v["sum"] / v["n"], 4),
                               "alpha_min": (round(v["alpha_min"], 3)
                                             if v["alpha_min"] < 9e8 else None)}
                           for k, v in sorted(vc.items())}
    R["prims_without_COLOR_0"] = dict(no_vc)

    # ---- materials, textures, transparency, missing assets ----------------
    ms = []
    referenced = set()
    for i, m in enumerate(mats):
        pbr = m.get("pbrMetallicRoughness", {})
        slots = {"base": pbr.get("baseColorTexture"),
                 "mr": pbr.get("metallicRoughnessTexture"),
                 "normal": m.get("normalTexture"),
                 "occlusion": m.get("occlusionTexture"),
                 "emissive": m.get("emissiveTexture")}
        bound = {}
        for k, v in slots.items():
            if not v:
                continue
            t = texs[v["index"]]
            src = t.get("source")
            if src is None:
                ext = t.get("extensions", {}).get("KHR_texture_basisu")
                src = ext.get("source") if ext else None
            if src is not None:
                referenced.add(src)
            bound[k] = {"image": (imgs[src].get("name") or "img%d" % src) if src is not None else None,
                        "texCoord": v.get("texCoord", 0)}
        ms.append({"name": m.get("name", "material_%d" % i),
                   "alphaMode": m.get("alphaMode", "OPAQUE"),
                   "alphaCutoff": m.get("alphaCutoff"),
                   "doubleSided": m.get("doubleSided", False),
                   "baseColorFactor": [round(x, 3) for x in pbr.get("baseColorFactor", [1, 1, 1, 1])],
                   "metallic": pbr.get("metallicFactor", 1.0),
                   "roughness": pbr.get("roughnessFactor", 1.0),
                   "emissive": [round(x, 3) for x in m.get("emissiveFactor", [0, 0, 0])],
                   "textures": bound})
    R["materials"] = ms
    R["transparent_materials"] = [m["name"] for m in ms if m["alphaMode"] != "OPAQUE"]
    R["images"] = len(imgs)
    R["unreferenced_images"] = sorted(
        (imgs[i].get("name") or "img%d" % i) for i in range(len(imgs)) if i not in referenced)
    broken = []
    for i, im in enumerate(imgs):
        if "bufferView" not in im and "uri" not in im:
            broken.append(im.get("name") or "img%d" % i)
        if "uri" in im and not im["uri"].startswith("data:"):
            p = os.path.join(os.path.dirname(path), im["uri"])
            if not os.path.exists(p):
                broken.append(im["uri"])
    R["missing_images"] = broken
    return R


def show(R):
    print("=" * 70)
    print(R["file"], " ", R["mb"], "MB")
    print("=" * 70)
    for k in ("nodes", "nodes_reached", "orphan_nodes", "meshes", "mesh_primitives",
              "draw_calls", "triangles_unique", "triangles_drawn", "draco",
              "odd_scale_count", "uv0_range", "non_unit_normals_sampled", "images",
              "size_m", "model_size_m", "model_min", "model_max",
              "ground_y", "centre_xz"):
        if k in R:
            print("  %-26s %s" % (k, R[k]))
    print("  extensions used         ", R["extensions"]["used"])
    print("  extensions required     ", R["extensions"]["required"])
    print("  transparent materials   ", R["transparent_materials"])
    print("  missing images          ", R["missing_images"] or "none")
    print("  unreferenced images     ", R["unreferenced_images"] or "none")
    if R.get("odd_scales"):
        print("  odd scales              ", R["odd_scales"])
    print("  -- COLOR_0 by material --")
    for k, v in R["vertex_colours"].items():
        print("     %-22s prims=%-4d %-14s min=%.3f mean=%.3f max=%.3f a=%s"
              % (k, v["prims"], v["type"], v["min"], v["mean"], v["max"], v["alpha_min"]))
    if R["prims_without_COLOR_0"]:
        print("  -- primitives WITHOUT COLOR_0 --")
        for k, v in sorted(R["prims_without_COLOR_0"].items()):
            print("     %-22s %d" % (k, v))
    print("  -- materials --")
    for m in R["materials"]:
        print("     %-22s %-7s ds=%-5s m=%.2f r=%.2f  %s"
              % (m["name"], m["alphaMode"], m["doubleSided"],
                 m["metallic"], m["roughness"],
                 ",".join("%s->%s(uv%d)" % (k, v["image"], v["texCoord"])
                          for k, v in m["textures"].items())))


if __name__ == "__main__":
    for p in sys.argv[1:]:
        show(run(p))
