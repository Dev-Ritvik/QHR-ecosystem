"""
Why did station S3 not reach the GLB?

    blender --background <blend> --python tools/blender/audit_stations.py

export_web_interior.py selects from COL_Interior and skips anything with
`hide_render` set or `visible_get()` false. Any one of those three conditions
silently drops a station, and the export reports success either way — which is
how a whole layout table went missing without anybody noticing until the model
was measured.

Read-only. Reports; changes nothing.
"""

import bpy

print("BLEND|%s" % bpy.data.filepath)

vl = bpy.context.view_layer
lcs = {}


def walk(lc, depth=0):
    lcs[lc.name] = lc
    for c in lc.children:
        walk(c, depth + 1)


walk(vl.layer_collection)

for tag in ("S1", "S2", "S3"):
    objs = [o for o in bpy.data.objects if ("holo3d_%s" % tag) in o.name]
    print("\nSTATION|%s objects=%d" % (tag, len(objs)))
    if not objs:
        continue

    n_hidden_render = sum(1 for o in objs if o.hide_render)
    n_invisible = 0
    for o in objs:
        try:
            n_invisible += 0 if o.visible_get() else 1
        except RuntimeError:
            n_invisible += 1
    cols = sorted({c.name for o in objs for c in o.users_collection})
    in_interior = sum(
        1 for o in objs if any(c.name == "COL_Interior" for c in o.users_collection)
    )

    print("  collections      : %s" % ", ".join(cols))
    print("  in COL_Interior  : %d / %d" % (in_interior, len(objs)))
    print("  hide_render set  : %d" % n_hidden_render)
    print("  not visible_get(): %d" % n_invisible)

    # Would the exporter take it?
    would = sum(
        1 for o in objs
        if any(c.name == "COL_Interior" for c in o.users_collection)
        and not o.hide_render
        and o.visible_get()
    )
    print("  EXPORTER WOULD TAKE: %d / %d" % (would, len(objs)))
    for o in objs[:4]:
        print("    e.g. %-34s hide_render=%s hide_viewport=%s cols=%s"
              % (o.name, o.hide_render, o.hide_viewport,
                 [c.name for c in o.users_collection]))

# Collection-level exclusion is the other way a whole branch vanishes: an
# excluded layer collection makes every object inside it report invisible.
print("\nLAYER COLLECTIONS (exclude / hide_viewport):")
for name, lc in sorted(lcs.items()):
    if lc.exclude or lc.hide_viewport:
        print("  %-28s exclude=%s hide_viewport=%s" % (name, lc.exclude, lc.hide_viewport))
print("  (only excluded/hidden shown)")
