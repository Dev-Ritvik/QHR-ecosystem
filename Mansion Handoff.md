Blender production handoff · one consolidated session

The Mansion Handoff
Every change HANDOFF.md asked for, executed against the master .blend, verified by parsing the exported GLBs rather than by eye.

Source mansion_exterior.blend
Blender 5.2.0
Backup mansion_exterior_PREHANDOFF_backup.blend
Exports out/web_handoff/
Scene triangles
1,731,847
▼ 1.28 M from 3,013,872
Brief items
9 delivered · 1 no-op
all verified in GLB
Exterior GLB
6.16 MB · 167 k tri
Draco level 6
Interior GLB
19.68 MB · 1.47 M tri
raw master — see step 1
The ten items
Numbered as the brief numbers them. Every claim below was checked against the exported .glb, not the viewport.

01
Royal project tables
Delivered
Ø1.15 m turned table, top at y 0.80, replacing the Ø0.58 m pedestal. Radially asymmetric by three devices: a sunburst walnut veneer, twelve brass strings, and a compass rose whose north point runs long — so any rotation is legible, not just multiples of 30°. Walnut with brass banding, restrained. 3,688 tri per station, one mesh instanced four times.

02
S3 + S4 hologram geometry
Delivered
S3 already existed in the blend but had never shipped. S4 cloned from the same recipe to identical local dimensions (x 5.641–6.249, y 1.207–1.687), including the 38° drafting rake and the inward yaw. Project identity is out of the material names: MAT_Holo3D_Plate_S1…S4. S4 ships dark — plate texture cleared and its title text blanked so it cannot leak S3's project name.

03
Stair carpet
Delivered
UV0 runs continuously along the flight — 8.078 m of arc projected onto the real stair profile, 7.34 repeats at the web's own 1.1 m tile. Lightmap moved to UV1 on all 27 pieces. Real Carpet013 wool (albedo/roughness/normal/AO) dyed deep oxblood, materially darker than the cream limestone. Binding strips got their own near-black tape material.

04
Stair architectural detailing
Delivered
The balustrade was not under-detailed — it was 4,499 tri per baluster and 40,000 per newel. Both shared meshes decimated (494 / 2,600), recovering 440 k triangles across 50 instances. The 24-tri handrail became a moulded ogee section. Brass arrived as stair rods in the tread angle: historically right for a carpeted stair, and not gaudy.

05
Roof
Delivered
10 tri → 3,746. Nine real slate courses per hip with a 26 mm overlap step and per-slate jitter, a 280 mm eaves overhang, and a lead deck. Now on its own MAT_Roof_Slate with the real slate PBR set, so the spire keeps MAT_Roof and the two tune apart.

06
Founder portrait
Delivered
The photograph was never missing — 3d assets/founder_portrait.jpg was bound all along. It was invisible because a transmission-1.0 glass pane sat 1 cm in front of it, showing the sky HDRI instead of the painting. Pane set to 0 with a specular sheen; photo cropped to head-and-shoulders, warm-graded, and resampled to 1024 × 1368 (divisible by 4 for Basis).

07
Exterior material quality
Delivered
Facade bevels at 12–14 mm on the walls, portico, terraces, entry and fountain so the stone has an edge to catch light. All of Priority 3 cleared: 84 objects had no UV map at all — the true cause of both the texCoord: -1 and the duplicate MAT_Stone_Cream. Roughness clamped from 1.05, and 25 materials taken off double-sided.

08
Exterior environment
Delivered
Real terrain: 18,432 tri, flat through the formal garden and undulating beyond, with a gravel forecourt, a drive on axis and lawn parterres driven by an authored zone mask. Hedges rebuilt as clipped yew with rounded crowns; cypress given proper foliage. Baked to a 4096 albedo so it survives glTF.

09
Front door
No-op by design
The brief conditions this on the portal needing independent door animation. It does not — there is no door animation anywhere in apps/public/src; the only hit is a lighting comment. Per the brief's own instruction, the architecture was not rebuilt. The door did receive the shared bevel pass.

10
Export correctness
Delivered · 1 step open
Draco level 6 confirmed in extensionsUsed. Zero negative texCoords, zero duplicate material names, UV0/UV1 intact on the runners, naming preserved, and the station hierarchy exported exactly as specified. Textures are KTX2-ready — correct colour spaces throughout — but the encode itself is still to run.

Station hierarchy, as shipped
Read back out of interior_hall_v6.glb. The projector sits outside the rotating root on all four stations, which was the point.

STATION_S1 ──┬── HOLO_S1
             ├── projector_S1 ── projlens_S1
             └── TURNTABLE_S1 ──┬── table_base_S1
                                ├── table_inlay_S1
                                └── table_top_S1

identical for S2, S3, S4          texCoord(-1): 0    duplicate names: 0
Triangle budget
All four are shared meshes, so a single decimation propagates to every instance. The saving is counted across instances, as the GPU sees it.

Mesh	Before	After	Users	Recovered
KIT_quoin_x_M · rustication	6,360	604	55	316,580
KIT_quoin_x_M.001 · rustication	6,360	604	43	247,508
KIT_finial_tip_M · gold caps	39,998	1,398	5	193,000
KIT_baluster_hi_M	4,499	494	54	216,270
KIT_newel_hi_M	40,000	2,600	6	224,400
lion_frieze_M	119,999	8,039	1	111,960
Latent bugs found along the way
None of these were in the brief. All three were producing visible faults.

ground_plane carried an unapplied 5× scale
Object scale was (5, 5, 1). Every ground-space boundary therefore landed five times too far out, which is why the forecourt refused to render no matter how the mask was authored. Scale applied; the mesh was already in true metres.

The portrait pane was hiding the portrait
MAT_PortraitGlass at transmission 1.0 in front of an opaque painting rendered the sky HDRI over the founder's face — and cost a full extra scene pass every frame. The brief flagged the cost; the visual consequence had not been connected to it.

84 objects shipped with no UV map
The brief reported texCoord: -1 and a duplicate MAT_Stone_Cream as two separate defects. They are one: the exporter splits a material when some meshes carry no UVs. Unwrapping all 84 at world scale resolved both at once.

What remains
Two pipeline steps I deliberately did not take unilaterally.

Decide where the interior master lives. Your documented rebuild chain exports the interior from mansion_web.blend, and that file holds the heavy-mesh decimations recorded in interior_hall.manifest.json (chandelier 260 k → 62 k, KIT_column 60 k → 10 k, and others). My interior work is in mansion_exterior.blend, which holds both collections. That is why the interior GLB above is 1.47 M triangles rather than the shipped 480 k — it is the raw master, not the optimised build. The changes need to flow through your bake, which I left alone because re-baking a 4096 atlas at 1800 samples is not a step to take on someone's behalf.
Run the KTX2 encode. ktx is on this machine; gltf-transform is not, and installing into your project was not mine to do. Every texture is already encode-ready — albedo sRGB, roughness and normal Non-Color, no colour-space mismatches anywhere in 57 images.
npm i -g @gltf-transform/cli
gltf-transform dedup  interior_hall_v6.glb _a.glb
gltf-transform prune  _a.glb _b.glb
gltf-transform copy   _b.glb ex/scene.gltf
python tools/gltf/encode_ktx2.py ex/scene.gltf
Files touched
Path	Change
C:\dev\Blender\mansion_exterior.blend	All model work. Saved; 237 MB.
…\mansion_exterior_PREHANDOFF_backup.blend	Snapshot taken before any change.
tools/blender/export_web.py	Patched to export the STATION_* / TURNTABLE_* / HOLO_* empties. Without it the rig flattens and the turntable is lost.
assets/brand/founder_portrait_graded.png	New — cropped, graded, 1024 × 1368.
assets/materials/_baked/	New — baked table and ground PBR sets.
assets/materials/ground_zones/zones.png	New — terrain zone mask.
out/web_handoff/*.glb	New — Draco exports of both collections.
Verified by parsing the exported GLB JSON chunk — hierarchy, UV sets, material names, texCoord indices and extensions read back from the shipped files.