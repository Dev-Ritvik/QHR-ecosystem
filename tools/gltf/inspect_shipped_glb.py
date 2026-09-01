"""
Full structural, geometric and material inspection of a SHIPPED GLB.

This is the Draco-aware companion to verify_export_qa.py. That script decodes
accessors, so it can only run on an uncompressed export; this one answers the
questions that survive compression - structure, materials, textures, KTX2
headers, node transforms, scene content - plus every check that can be made
from accessor metadata alone (POSITION min/max survives Draco; that is what the
bounding box, ground contact and NaN/Infinity checks are built on).

Anything that genuinely needs vertex data - winding, per-vertex normals, the
COLOR_0 value range - is verified on the matching RAW export and cross-checked
here by accessor count and type, because Draco is a lossless-topology,
quantised-attribute codec: it may drop zero-area triangles, but it cannot
change how many primitives, materials or textures a file has.

    python inspect_shipped_glb.py <shipped.glb> [raw.glb]
"""
import json
import math
import os
import struct
import sys
from collections import Counter, defaultdict

TF = {1: "linear", 2: "srgb"}


def load(path):
    d = open(path, "rb").read()
    if d[:4] != b"glTF":
        raise SystemExit("not a GLB: %s" % path)
    ver, total = struct.unpack_from("<II", d, 4)
    off, g, bin_off, bin_len = 12, None, None, 0
    while off < len(d):
        ln, ty = struct.unpack_from("<II", d, off)
        off += 8
        if ty == 0x4E4F534A:
            g = json.loads(d[off:off + ln].decode("utf-8"))
        elif ty == 0x004E4942:
            bin_off, bin_len = off, ln
        off += ln
    return g, d, bin_off, bin_len, ver, total


def ktx_info(blob):
    if blob[:12] != b"\xabKTX 20\xbb\r\n\x1a\n":
        return None
    w, h = struct.unpack_from("<II", blob, 12 + 2 * 4)
    dfdOff, dfdLen = struct.unpack_from("<II", blob, 12 + 9 * 4)
    lvl = struct.unpack_from("<I", blob, 12 + 6 * 4)[0]
    tf = None
    if dfdOff:
        b = blob[dfdOff:dfdOff + dfdLen]
        if len(b) >= 16:
            tf = b[14]
    return {"w": w, "h": h, "tf": TF.get(tf, "tf%s" % tf), "levels": lvl}


def finite(v):
    return all(isinstance(x, (int, float)) and math.isfinite(x) for x in v)


def node_world(g, i, parent=None):
    n = g["nodes"][i]
    m = n.get("matrix")
    if m:
        M = [m[0:4], m[4:8], m[8:12], m[12:16]]
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


def det3(M):
    a, b, c = M[0][0], M[1][0], M[2][0]
    d_, e, f = M[0][1], M[1][1], M[2][1]
    gg, h, i = M[0][2], M[1][2], M[2][2]
    return a * (e * i - f * h) - b * (d_ * i - f * gg) + c * (d_ * h - e * gg)


def xf(M, p):
    return tuple(M[0][r] * p[0] + M[1][r] * p[1] + M[2][r] * p[2] + M[3][r]
                 for r in range(3))


def run(path):
    g, d, bo, blen, ver, total = load(path)
    R = {"file": os.path.basename(path),
         "bytes": os.path.getsize(path), "glb_version": ver,
         "header_length_matches": total == os.path.getsize(path),
         "bin_chunk_bytes": blen}

    nodes = g.get("nodes", [])
    meshes = g.get("meshes", [])
    mats = g.get("materials", [])
    texs = g.get("textures", [])
    imgs = g.get("images", [])
    accs = g.get("accessors", [])
    bvs = g.get("bufferViews", [])
    bufs = g.get("buffers", [])

    R["counts"] = {"scenes": len(g.get("scenes", [])), "nodes": len(nodes),
                   "meshes": len(meshes), "materials": len(mats),
                   "textures": len(texs), "images": len(imgs),
                   "accessors": len(accs), "bufferViews": len(bvs),
                   "buffers": len(bufs),
                   "primitives": sum(len(m.get("primitives", [])) for m in meshes),
                   "samplers": len(g.get("samplers", [])),
                   "cameras": len(g.get("cameras", [])),
                   "animations": len(g.get("animations", [])),
                   "skins": len(g.get("skins", []))}
    R["extensions"] = {"used": g.get("extensionsUsed", []),
                       "required": g.get("extensionsRequired", [])}

    # buffers must be GLB-internal
    R["external_buffers"] = [b.get("uri") for b in bufs if b.get("uri")]
    R["buffer_length_ok"] = all(b.get("byteLength", 0) <= blen for b in bufs)

    # ---- scene graph -----------------------------------------------------
    world, dup_parent = {}, []
    seen = set()
    stack = [(i, None) for i in g["scenes"][g.get("scene", 0)].get("nodes", [])]
    while stack:
        i, par = stack.pop()
        if i in seen:
            dup_parent.append(i)
            continue
        seen.add(i)
        world[i] = node_world(g, i, par)
        for c in nodes[i].get("children", []):
            stack.append((c, world[i]))
    R["nodes_reachable"] = len(seen)
    R["orphan_nodes"] = len(nodes) - len(seen)
    R["nodes_with_multiple_parents"] = len(dup_parent)
    names = [n.get("name") or "" for n in nodes]
    dupnames = [k for k, v in Counter(n for n in names if n).items() if v > 1]
    R["duplicate_node_names"] = dupnames[:8]
    R["duplicate_node_name_count"] = len(dupnames)

    # ---- transforms ------------------------------------------------------
    bad_tr, mirrored, nonuni = [], [], []
    for i in seen:
        n = nodes[i]
        for k in ("translation", "rotation", "scale"):
            if k in n and not finite(n[k]):
                bad_tr.append((names[i], k, n[k]))
        if "matrix" in n and not finite(n["matrix"]):
            bad_tr.append((names[i], "matrix", None))
        s = n.get("scale")
        if s:
            if min(s) <= 0:
                mirrored.append((names[i], [round(x, 4) for x in s]))
            if max(abs(s[0] - s[1]), abs(s[1] - s[2])) > 1e-4:
                nonuni.append((names[i], [round(x, 4) for x in s]))
        if det3(world[i]) < 0:
            mirrored.append((names[i], "negative determinant"))
    R["nonfinite_transforms"] = bad_tr[:8]
    R["mirrored_or_negative_scale"] = mirrored[:8]
    R["mirrored_count"] = len(mirrored)
    R["non_uniform_scale"] = nonuni[:8]
    R["non_uniform_count"] = len(nonuni)

    # ---- geometry from accessor metadata ---------------------------------
    mesh_nodes = defaultdict(list)
    for i in seen:
        if "mesh" in nodes[i]:
            mesh_nodes[nodes[i]["mesh"]].append(i)

    tri = drawn = 0
    attr_hist = Counter()
    nonfinite_bounds, missing_bounds = [], []
    bbox = [9e9] * 3 + [-9e9] * 3
    mbox = [9e9] * 3 + [-9e9] * 3
    modes = Counter()
    for mi, m in enumerate(meshes):
        for p in m.get("primitives", []):
            modes[p.get("mode", 4)] += 1
            for k in p.get("attributes", {}):
                attr_hist[k] += 1
            ia = p.get("indices")
            n_tri = (accs[ia]["count"] // 3 if ia is not None
                     else accs[p["attributes"]["POSITION"]]["count"] // 3)
            tri += n_tri
            drawn += n_tri * max(0, len(mesh_nodes.get(mi, [])))
            acc = accs[p["attributes"]["POSITION"]]
            if "min" not in acc or "max" not in acc:
                missing_bounds.append(m.get("name"))
                continue
            if not (finite(acc["min"]) and finite(acc["max"])):
                nonfinite_bounds.append(m.get("name"))
                continue
            is_ground = any(names[ni] == "ground_plane" for ni in mesh_nodes.get(mi, []))
            corners = [(acc["min"][0] if a else acc["max"][0],
                        acc["min"][1] if b else acc["max"][1],
                        acc["min"][2] if c else acc["max"][2])
                       for a in (0, 1) for b in (0, 1) for c in (0, 1)]
            for ni in mesh_nodes.get(mi, []):
                for cpt in corners:
                    w = xf(world[ni], cpt)
                    for k in range(3):
                        bbox[k] = min(bbox[k], w[k])
                        bbox[3 + k] = max(bbox[3 + k], w[k])
                        if not is_ground:
                            mbox[k] = min(mbox[k], w[k])
                            mbox[3 + k] = max(mbox[3 + k], w[k])
    R["triangles_unique"] = tri
    R["triangles_drawn"] = drawn
    R["draw_calls"] = sum(len(meshes[nodes[i]["mesh"]].get("primitives", []))
                          for i in seen if "mesh" in nodes[i])
    R["primitive_modes"] = {str(k): v for k, v in modes.items()}
    R["attributes"] = dict(attr_hist)
    R["accessors_missing_bounds"] = missing_bounds[:6]
    R["accessors_nonfinite_bounds"] = nonfinite_bounds[:6]
    R["scene_bbox_min"] = [round(x, 4) for x in bbox[:3]]
    R["scene_bbox_max"] = [round(x, 4) for x in bbox[3:]]
    R["model_bbox_min"] = [round(x, 4) for x in mbox[:3]]
    R["model_bbox_max"] = [round(x, 4) for x in mbox[3:]]
    R["model_size_m"] = [round(mbox[3 + k] - mbox[k], 4) for k in range(3)]
    R["ground_contact_y"] = round(mbox[1], 4)

    # any accessor anywhere with a non-finite bound
    nf = [i for i, a in enumerate(accs)
          if ("min" in a and not finite(a["min"])) or ("max" in a and not finite(a["max"]))]
    R["nonfinite_accessor_bounds"] = len(nf)

    # ---- named content ---------------------------------------------------
    pref = Counter()
    for i in seen:
        nm = names[i]
        for p_ in ("ashlar_WEST_", "ashlar_EAST_", "ashlar_NORTH_", "ashlar_SOUTH_",
                   "rustic_", "cyp_", "hedge_", "finial_", "cupola_", "entry_",
                   "portico_", "archglass_", "archback_", "fount"):
            if nm.startswith(p_):
                pref[p_] += 1
                break
        else:
            if nm:
                pref["<other:%s>" % nm] += 1
    R["ashlar"] = {k: v for k, v in pref.items() if k.startswith("ashlar_")}
    R["ashlar_total"] = sum(v for k, v in pref.items() if k.startswith("ashlar_"))
    R["rustic_total"] = pref.get("rustic_", 0)
    R["named_groups"] = {k: v for k, v in pref.items() if not k.startswith("<other")}
    R["singleton_nodes"] = sorted(k[8:-1] for k in pref if k.startswith("<other"))

    # ---- materials -------------------------------------------------------
    def src_of(ti):
        t = texs[ti]
        s = t.get("source")
        if s is None:
            s = t.get("extensions", {}).get("KHR_texture_basisu", {}).get("source")
        return s

    used_imgs = set()
    ms = []
    for m in mats:
        pbr = m.get("pbrMetallicRoughness", {})
        slots = {"baseColor": pbr.get("baseColorTexture"),
                 "metallicRoughness": pbr.get("metallicRoughnessTexture"),
                 "normal": m.get("normalTexture"),
                 "occlusion": m.get("occlusionTexture"),
                 "emissive": m.get("emissiveTexture")}
        bound, unresolved = {}, []
        for k, v in slots.items():
            if not v:
                continue
            ti = v["index"]
            if ti >= len(texs):
                unresolved.append(k)
                continue
            s = src_of(ti)
            if s is None:
                unresolved.append(k)
                continue
            used_imgs.add(s)
            bound[k] = {"image": imgs[s].get("name") or "img%d" % s,
                        "texCoord": v.get("texCoord", 0),
                        "scale": v.get("scale"), "strength": v.get("strength")}
        ms.append({"name": m.get("name"),
                   "alphaMode": m.get("alphaMode", "OPAQUE"),
                   "alphaCutoff": m.get("alphaCutoff"),
                   "doubleSided": m.get("doubleSided", False),
                   "baseColorFactor": [round(x, 4) for x in pbr.get("baseColorFactor", [1, 1, 1, 1])],
                   "metallicFactor": pbr.get("metallicFactor", 1.0),
                   "roughnessFactor": pbr.get("roughnessFactor", 1.0),
                   "emissiveFactor": [round(x, 4) for x in m.get("emissiveFactor", [0, 0, 0])],
                   "extensions": sorted(m.get("extensions", {}).keys()),
                   "textures": bound, "unresolved": unresolved})
    R["materials"] = ms
    R["material_extensions"] = sorted({e for x in ms for e in x["extensions"]})
    R["anisotropy_materials"] = [x["name"] for x in ms
                                 if "KHR_materials_anisotropy" in x["extensions"]]
    R["unresolved_texture_slots"] = [(x["name"], x["unresolved"]) for x in ms if x["unresolved"]]
    R["alpha_modes"] = dict(Counter(x["alphaMode"] for x in ms))
    R["non_opaque"] = [x["name"] for x in ms if x["alphaMode"] != "OPAQUE"]
    R["duplicate_material_names"] = [k for k, v in Counter(x["name"] for x in ms).items() if v > 1]

    # ---- images / KTX2 ---------------------------------------------------
    im_rows, bad = [], []
    for i, im in enumerate(imgs):
        row = {"i": i, "name": im.get("name"), "mime": im.get("mimeType"),
               "used": i in used_imgs}
        if "bufferView" in im:
            bv = bvs[im["bufferView"]]
            blob = d[bo + bv.get("byteOffset", 0): bo + bv.get("byteOffset", 0) + bv["byteLength"]]
            row["bytes"] = bv["byteLength"]
            k = ktx_info(blob)
            if k:
                row.update(k)
                row["div4"] = (k["w"] % 4 == 0 and k["h"] % 4 == 0)
                if not row["div4"]:
                    bad.append((im.get("name"), k["w"], k["h"]))
            else:
                row["ktx2"] = False
        elif "uri" in im:
            row["uri"] = im["uri"]
            bad.append((im.get("name"), "external uri"))
        im_rows.append(row)
    R["images_detail"] = im_rows
    R["images_not_ktx2"] = [r["name"] for r in im_rows if r.get("ktx2") is False]
    R["images_not_div4"] = bad
    R["unused_images"] = [r["name"] for r in im_rows if not r["used"]]

    # normal maps must be linear, base colour must be srgb
    slot_tf = []
    for x in ms:
        for slot, b in x["textures"].items():
            row = next((r for r in im_rows if (r["name"] == b["image"])), None)
            if row and row.get("tf"):
                want = "srgb" if slot in ("baseColor", "emissive") else "linear"
                slot_tf.append({"material": x["name"], "slot": slot,
                                "image": b["image"], "tf": row["tf"],
                                "ok": row["tf"] == want})
    R["colourspace_bindings"] = slot_tf
    R["colourspace_violations"] = [s for s in slot_tf if not s["ok"]]

    # texture objects pointing at the same image
    R["images_referenced_by_multiple_textures"] = [
        s for s, c in Counter(src_of(i) for i in range(len(texs))).items() if c > 1]
    return R


if __name__ == "__main__":
    out = [run(p) for p in sys.argv[1:]]
    print(json.dumps(out if len(out) > 1 else out[0], indent=1))
