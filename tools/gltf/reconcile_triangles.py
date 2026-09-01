"""
Reconcile triangle counts between the raw export and the shipped GLB.

Two totals were in circulation - 179,664 and 179,397 - from two verifiers run
on two different files. A report must not carry two unexplained totals, so this
cross-tabulates every counting METHOD against every FILE and prints the matrix,
which separates "the verifiers disagree" from "the files differ".

METHODS
  A  per-node, indices only        what verify_final_glb.py does: walk every
                                   node in the file, sum indices.count/3, skip
                                   any primitive with no index accessor.
  B  per-mesh x reachable nodes    what verify_export_qa.py does: count each
                                   mesh once, multiply by the number of nodes
                                   that reach it from the scene root, fall back
                                   to POSITION/3 when unindexed.
  C  per-node, indices or POSITION strict per-node with the unindexed fallback,
                                   so A and B can be compared without the
                                   fallback confounding them.
  D  unique mesh triangles         no instancing at all - what the file stores.

Also reports unreachable nodes and meshes no node references, because those are
exactly where A and B are allowed to legitimately disagree.

    python reconcile_triangles.py <a.glb> [b.glb ...]
"""
import json
import os
import struct
import sys
from collections import defaultdict


def load(path):
    d = open(path, "rb").read()
    off, g = 12, None
    while off < len(d):
        ln, ty = struct.unpack_from("<II", d, off)
        off += 8
        if ty == 0x4E4F534A:
            g = json.loads(d[off:off + ln].decode("utf-8"))
        off += ln
    return g


def prim_tris(g, p, indices_only):
    ia = p.get("indices")
    if ia is not None:
        return g["accessors"][ia]["count"] // 3
    if indices_only:
        return 0
    return g["accessors"][p["attributes"]["POSITION"]]["count"] // 3


def reachable(g):
    nodes = g.get("nodes", [])
    seen = set()
    stack = list(g["scenes"][g.get("scene", 0)].get("nodes", []))
    while stack:
        i = stack.pop()
        if i in seen:
            continue
        seen.add(i)
        stack.extend(nodes[i].get("children", []))
    return seen


def run(path):
    g = load(path)
    nodes = g.get("nodes", [])
    meshes = g.get("meshes", [])
    reach = reachable(g)

    inst = defaultdict(int)          # mesh -> reachable node instances
    inst_all = defaultdict(int)      # mesh -> all node references
    for i, n in enumerate(nodes):
        if "mesh" not in n:
            continue
        inst_all[n["mesh"]] += 1
        if i in reach:
            inst[n["mesh"]] += 1

    A = sum(prim_tris(g, p, True)
            for n in nodes if "mesh" in n
            for p in meshes[n["mesh"]]["primitives"])
    C = sum(prim_tris(g, p, False)
            for n in nodes if "mesh" in n
            for p in meshes[n["mesh"]]["primitives"])
    B = 0
    for mi, m in enumerate(meshes):
        t = sum(prim_tris(g, p, False) for p in m["primitives"])
        B += t * max(1, inst[mi])
    D = sum(prim_tris(g, p, False) for m in meshes for p in m["primitives"])

    unindexed = [(mi, pi) for mi, m in enumerate(meshes)
                 for pi, p in enumerate(m["primitives"]) if "indices" not in p]
    no_node = [mi for mi in range(len(meshes)) if inst_all[mi] == 0]
    zero_reach = [mi for mi in range(len(meshes)) if inst_all[mi] and not inst[mi]]

    return {
        "file": os.path.basename(path),
        "mb": round(os.path.getsize(path) / 1048576.0, 2),
        "draco": "KHR_draco_mesh_compression" in g.get("extensionsUsed", []),
        "nodes": len(nodes), "nodes_reachable": len(reach),
        "nodes_unreachable": len(nodes) - len(reach),
        "meshes": len(meshes),
        "A_per_node_indices_only": A,
        "B_per_mesh_x_reachable": B,
        "C_per_node_with_fallback": C,
        "D_unique_mesh_triangles": D,
        "unindexed_primitives": len(unindexed),
        "meshes_no_node_references": len(no_node),
        "meshes_referenced_but_unreachable": len(zero_reach),
    }


if __name__ == "__main__":
    rows = [run(p) for p in sys.argv[1:]]
    keys = [k for k in rows[0] if k != "file"]
    w = max(len(k) for k in keys)
    print("%-*s | %s" % (w, "metric", " | ".join("%18s" % r["file"][:18] for r in rows)))
    print("-" * (w + 3 + 21 * len(rows)))
    for k in keys:
        print("%-*s | %s" % (w, k, " | ".join("%18s" % r[k] for r in rows)))
    if len(rows) == 2:
        print()
        for k in ("A_per_node_indices_only", "B_per_mesh_x_reachable",
                  "C_per_node_with_fallback", "D_unique_mesh_triangles"):
            print("delta %-28s %+d" % (k, rows[1][k] - rows[0][k]))
