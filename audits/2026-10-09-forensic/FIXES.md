# Fixes to the forensic audit of 9 October 2026

Working record, in the audit's own fix order. Last updated 10 October 2026 (late evening), part-way through Phase 3.
Nothing is committed. "Before" pictures are the audit's own evidence in [ev/](ev/).

**Status words:** DONE (built and checked on screen or by measurement) · CODED (written, not yet checked on a build) · CLIENT (his to decide or supply; not built) · OPEN (not started).

## Where it stands

- Phase 1 is done apart from what waits on the client. Phase 2 is done. Phase 3: the hall and the three site models are done; the house and the words are next.
- The local server (port 3001) is serving the latest build.
- The stills were shot at 3 of the 8 screen shapes, as a trial (re-shot for the new pictures on the evening of 10 October). A full shoot is still owed, and must be repeated after any later change to the 3D picture; the share-card pictures are cut from the same shots. One unit test fails until then, on purpose.
- The end-to-end suite has not been run on any of this.

## The 22 findings that carry a note

| Kind | Findings | What happens |
|---|---|---|
| His to decide or supply | #10, #33, #43, #46, #52, #53, #62, #70, #81, #83, #87, #92, #101 | Not built. |
| Note is history only; the fix is engineering | #1, #2, #21 (done), #58 (done), #7, #34, #42, #6 | Built or to be built. |
| Decided when reached | #36 wainscot | Built: see Phase 3. The room is no darker for it (the panelling is the old slabs' own brightness). |

**Correction to what I said at the start about #53 (headline figures).** I said the unnoted #99 would fix it. It does not: the $300 audit of 5 October asked in so many words to keep the old-style numerals, and the client kept that build. So the large statistics are unchanged and wait for him. The switch is one line (`--figure-nums` in `globals.css`).

Three findings outside the 22 touch his word:

- **#47** (the picture lamp). Only the lamp's own glowing strip is to be warmed; the light on the picture is to be left alone. Not started.
- **#98** (three gilts). Two are now one system. The third is the word "Reality" beside the mark. I left it: his order is that the logo is never changed, and I read the words beside the mark as part of it. It is one colour value if he wants it brought into line.
- **#96** (type sizes). The words "Quality Homes" beside the mark are still their own size (16.8 px) for the same reason.

## Phase 1 — Critical defects

| # | Finding | Status | What was done / how checked |
|---|---|---|---|
| 62, 63 | Plans are cropped brochure scans | CLIENT | Needs clean originals. |
| 81 | Legal pages are drafts | CLIENT | Needs final text. |
| 82 | A personal Gmail as Data Protection Officer | DONE | Replaced with the company address on /privacy and /cookie-policy. A named officer is still his to supply. |
| 83 | Plot counts disagree with the plans | CLIENT | Needs his register. |
| 1 | 12–17 s of dark curtain | DONE | Every page and film chapter opens on a still of its own first frame. Measured at a simulated 8 Mbit/s: picture and words up at 1.5–1.9 s (was 15.5 s). |
| 2 | Curtain lifts on words with no picture | DONE | The curtain waits for the still, not the scene. At 8 Mbit/s the still holds until the live scene replaces it at about 21 s, with no empty frame. /about likewise. |
| 4 | 404 waits for the scene; empty tab title | DONE | The server now sends the whole page. Message and title present at 0.5 s; status still 404. |
| 3 | Dark wait after pressing a chapter | CODED | Each chapter has its own still, shown in place of the dark. Not yet tested by pressing a chapter on a slow line. |
| 112 | One tap leaves chapter names over the text | DONE | Touch area 30 px wide (was 186). Tested with touch only on the film and /about: a tap beside the dots does nothing; names opened on a dot close on scroll. |
| 73 | Text scrolls through the logo | DONE | A plate's words dissolve before they reach the header. Checked on /gallery and a layout page at 1920×945 and /about on a phone. |
| 52 | Tables get the least reading time | CLIENT | |

Also found and fixed while checking #1: for two seconds after the scene first appeared (and permanently on mid-tier devices) every lit window of the house was a pale hole. The canvas is now opaque, and the scene is only revealed once the device's graphics tier has settled.

## Phase 2 — Systemic design issues

| # | Finding | Status | What was done / how checked |
|---|---|---|---|
| 5 | No edge smoothing | DONE | Smoothing pass on 1× screens. Before/after zooms taken. Integrated card at 1920×945: 78–81 fps outside (84–88 without), 106–121 inside. **My first build of this logged a WebGL warning on every frame** (257 console messages in 3.5 s; the audit's run had none). Fixed and re-checked: 0 messages on the film, /about, a layout page and /hall, with the same smoothing. |
| 21 | Colour fringe | DONE | Pass removed. |
| 28 | Dust motes | DONE | Removed. |
| 58 | Two footers | DONE | Same offices, same four parts, same 18 pages, same legal links in both. The film's last frame checked at seven sizes (1920×945, 1536×730, 1440×900, 1366×657, 1280×593, 820×1180, 390×844): the lit table is clear of the footer on every wide frame. |
| 91 | Pages with up to four names | DONE | One name a page, used by the menu, both footers, the 404 list and every tab title. |
| 80 | Four labels on the closing block | DONE | "Next" and "Back to" only. |
| 79 | Two numbering styles | DONE | Roman numerals removed from the menu. |
| 61, 102, 103 | Enquire three times; Enquire jumps; see-through menu | DONE | Checked on the open menu at 1920×945. |
| 116 | Phone footer wraps unevenly | DONE | Parts two and two; legal row in three even lines. On a tablet held upright the last control now takes its own line from the left edge (coded after the last check). |
| 99 | Four numeral styles | DONE | Form fields and every tabular figure are lining. Seen on a typed telephone number. Display statistics unchanged (see #53). |
| 53 | Headline figures read "4o7" | CLIENT | See the correction above. |
| 90, 59 | Measurements written six ways; dash before a PIN | DONE | One style, held by a test over every page: "40 ft", "30′ × 50′", "sq yd" (with or without a figure), no dash before a PIN. A big figure and its unit now have a real space between them. |
| 96 | Type sizes and leadings | DONE | Measured on all 28 pages at 1920×945: 42 text styles down to 21; one leading per size; one small-capital size (10.75 px). Sizes in use: 10.75, 12.8, 16, 20, 23.1, 25, 31.25, 44.1, 63, 90.3, 121.8, plus the mark's own wordmark and the Telugu line (#89, open). |
| 97 | Two body sizes a fraction apart | CODED | Running text is one size on every screen. Measured at 1920 only so far; laptop, tablet and phone still to measure. |
| 98 | Three gilts, twelve ivories | DONE | Four strengths of ivory and two gilts, as named values. See the note above on the mark's wordmark. |
| 100 | Hover and state transitions | DONE | Measured on all 1,074 animated controls: two durations (0.3 s, 0.5 s) and one curve. Was four durations, three curves, 728 on the framework's default. |
| 108 | Four focus treatments | DONE | One ring. Tabbed through /about: all nine stops report the same outline (2 px gilt, 4 px clear; inside the edge on the full-width "Next" block). **My first build of it drew no ring at all** (a name clash with an existing value); caught on the capture, fixed, re-checked. |
| 105 | Consent card from a different kit | DONE | The site's own action style, ivory serif heading, 16 px text, the control's real name. Seen at 1920×945. Phone not yet looked at. |
| 106 | "Accept all" pre-focused | DONE | Focus lands on the card itself; no choice carries a ring; Enter chooses nothing. |
| 107 | Reopened panel says "Before you explore" and blurs | DONE | Titled "Privacy and data choices.", opens on the choices as they stand, no blur. |
| 109 | Browser's own date field | DONE | A drawn control: a line that says the day in words, opening a month of numerals. Tested by pointer and by keyboard (arrows, Page Up/Down, Enter, Escape); sends the same value as before. Nothing was submitted. Phone not yet looked at. |
| 110 | "Evening" drops alone | DONE | Two and two beside the date; four on one line where the set has the form's width (/contact). |
| 111 | Two input sizes; resize grip | DONE | One size (25 px at 1920); the message field grows as it is written; no grip. |
| 60 | A borrowed ampersand | DONE | The site now writes "and" (a test holds every page to it) and the borrowed character is gone. This also answers the earlier audit that disliked the typeface's own ampersand. Two college names near VSR Gayatri Township are written with "and" for the same reason. |
| 78 | Heading full stops | DONE in code | Every second-level heading ends as a sentence does; third-level never. Not yet re-counted on a build. |
| 95 | Share image, icons, theme colour, domain | DONE | Every page serves its own title, description, picture and address for sharing; favicon, touch icon, manifest and theme colour answer; the served files name one domain. The icons are the client's mark, untouched, on the ivory plate the header uses. **Which domain goes live is his to say**: the build takes it from one setting (currently the .in). The card pictures are from the trial stills and will be re-cut with the final shoot. |
| 66 | 28 pages on about ten pictures; portrait on legal and 404 pages | DONE | Every page opens on a picture of its own (28 pages, 28 pictures; /start-here keeps the film's first frame by day). No portrait on the small print or the 404. A test holds "no two pages share a place". Seen at 1920×945, 1366×657, 820×1180 and 390×844. The list is below. |
| 67 | Pictures with no subject | DONE | /careers: the empty bench. /gallery: a model seen from above, as a plan. /testimonials: the pool terrace with its chairs and shades. The phone's middle band now shows the subject above the words (was "a screen of empty marble floor"). |
| 68 | Two opening heights, no rule on phones | DONE | One rule on every screen: a page that tells opens on a whole picture, a page that is used (form, list, small print) opens on a short one with its content in sight. On a phone a short opening is now its words under a measured band of picture; checked at 390×844 on all eleven short pages. 390×664 not yet looked at. |
| 69 | Layout pages' model and plaque out of focus | DONE | Cause found: inner pages in the hall were being focused with the exterior's lens rule. The model and its name plate are sharp on all three layout pages; seen at four sizes. |
| 71 | Founder's face cropped out of the phone's quotation band | DONE | Seen at 390×844 and 820×1180: his face stands above his motto. The portrait itself is untouched. |
| 72 | Shade stops 9 px short of the phone's right edge | DONE in code | The band's text block is now the screen's width, so its shade reaches both edges. Not yet measured at the edge. |
| 70 | Saloon car, close up | CLIENT (part done) | Replacing the car is his call. Meanwhile /why-us no longer shows it close: the page opens under the portico and its band is the door and lantern. The film's own approach is unchanged. |

### The opening pictures, page by page (#66)

| Page | Opens on | Its band, if it has one |
|---|---|---|
| /start-here | The house from the air (the film's first frame, by day) | |
| /projects | Two tables along the wall, each with its layout | The second table alone |
| /properties | A model close enough to read the plot sizes | The same model from table height, along its roads |
| /locations | The map table from above | Across the map's relief, close |
| /gallery | A model from above, as a plan, with its name plate | |
| /downloads | A layout's name plate, with its plots above it | |
| /construction-updates | The estate from above and behind | The front of the house from the parterre |
| /about | The founder's portrait | The portrait, closer |
| /why-us | Under the portico, looking up | The front door and its lantern |
| /testimonials | The pool terrace: chairs, shades, water | |
| /branches | Three lamps lit along the hall's wall | One lamp |
| /careers | The empty bench in the hall | |
| /investment-guide | The dome | The chandelier from directly beneath |
| /knowledge | The chandelier against the attic windows | |
| /knowledge/reading-a-layout-plan | A model from beside and above | The same model from over it |
| /faqs | The stair from its foot | |
| /contact | The room from where you would stand to talk | |
| /book-a-site-visit | The front door from the drive | The palm avenue, the house at its end |
| /hall | The whole room, with the stair and portrait | |
| Three layout pages | Each layout's own model on its table | The model from above |
| /privacy | The front door from inside, shut | |
| /terms | The gate and the avenue | |
| /refund-policy | The house from behind, down its canal | |
| /cookie-policy | The urn by the door | |
| /sitemap | The estate from directly above | |
| 404 | The hall's fourth table, with nothing on it | |

Two things to know about these:

- **/privacy on a phone** was weak while the door was a flat brown slab. It is now a pair of panelled doors with knobs (Phase 3, #36) and reads as a door.
- **Found while composing them: the mouse was steering the camera off its subject.** The camera leans toward the pointer by an amount sized for the house seen from the drive. On a close-up it turned the picture away altogether when the pointer sat in a corner. On inner pages the lean is now in proportion to how far away the subject is. The film is unchanged.

Also changed, because the notice's wording changed: the stored consent version is now 2, so anyone who answered the old card is asked once more.

## Phase 3 — AI slop

Before/after captures of the hall: `C:/dev/Blender/_capture_tools/out/fix1010/hall/` (`before/`, `after2/`, and the film walk in `film3/`).

| # | Finding | Status | What was done / how checked |
|---|---|---|---|
| 34 | Pink balusters, plinths and capitals | DONE | Cause found: everything the bake does not reach was lit by a picture of the whole room (walnut, navy carpet, gilt), and that mixture is mauve. Those surfaces now take the same amount of light in the colour the walls are lit by. Measured (red over green, green over blue): a baluster was +14, +17; it is +4, +14, between the wall beside it (+7, +17) and the pilaster under a capital (+4, +10). Seen in the film at the stair. The light level is unchanged. |
| 35 | Frieze of floating stars | DONE | A plain frieze. The star plaques are put away, and the dark star each had left baked on the wall behind it is covered by a strip lit with the wall's own light from just below. Seen close up and in the film's portrait frames: plain plaster, no seam. |
| 36 | Wainscot is flat floating slabs | DONE | The slabs are gone. In their place: framed panelling built as joinery (stiles, rails, raised panels in two tiers, a moulded base, a dado rail), one continuous run along each side wall and either side of the doors. Even light, one timber, no gap over the skirting, no mirror wash. **Two things this uncovered and fixed:** the slabs had left black marks baked into the column shafts (each shaft now carries its own clean light over that height), and the entrance doors were one flat board (now two panelled leaves with brass knobs, which also answers the weak /privacy picture noted above). Seen at 1920×945 in the film at all three tables, and on /privacy, /gallery and a layout page on a phone. |
| 37 | One wood grain at three scales | DONE | The walnut is redrawn at the timber's real size (fine rings, long flames, a third-of-a-metre leaf) in two cuts: crown-cut for panels, straight-grained for frames. Each surface is laid in metres, so nothing is stretched: the model boards and their trays wear the straight grain at half size. The arch behind the portrait keeps its approved tone. |
| 39 | Three boards, three woods | DONE | One timber, one finish, one tone on all three, matched to the wall panelling (board 86, 67, 43 against the panel's 87, 58, 34). The second table's room is dimmer by the film's own lighting, so its board is a shade darker, but it is plainly the same wood. Seen side by side. |
| 41 | Gayatri model: plus-shaped hole, beaded verges | DONE | The park is whole. The hedge round the site is a low green band with straight sides (it had been built as white plaster, bush by bush). The corner lawn and the strip beside the last row are green too, as the plan prints them. A stray crumb at the lawn's corner is removed. |
| 40 | Lucky Garden model: blank slab, unexplained tints | DONE | The future extension is open ground in the same green as the other boards' open land, with nothing lettered on it. All plots are one ivory on all three boards. A white diagonal slab at the board's left edge, which was the approach road traced as a plot, is removed. |

Also done here, not in the audit: the column capitals had black holes in their leaves at close range (a fault in the model's faces, not its colour). They are now drawn from both sides, which closes most of them.

**Found while fixing #41, for the client (belongs with #62 and #83):** the Gayatri model does not show every plot on its own plan. The tracing it was built from missed plots 1 to 12, 36 to 45 and about a dozen others, and the site says "113 plots" where the plan numbers run past 180. I have not added plots by guesswork. It needs the clean plan and the plot register.

## Phases 3 (rest) to 6

OPEN: the house (#11, #7, #24, #32), the words (#84, #85, #86, #93, #88), outdoors, indoors, shading and pictures, micro-polish, and the final re-audit.

## For whoever picks this up

- Patch scripts and captures: `C:/dev/Blender/_capture_tools/out/fix1010/`.
- New tools in `_capture_tools/replay/c13/`: `fx_load.mjs` (first-visit timing), `fx_end.mjs` (film ending and menu), `fx_form.mjs` (the forms' controls; never submits), `gl_warn.mjs` (console messages while a scene draws), `find_text.py` (where a phrase is printed), `fx_header_pass.mjs`, `fx_touch_scroll.mjs`, `aa_ab.mjs`, `swap_probe.mjs`.
- New scripts in the app: `scripts/stills/shoot.mjs`, `encode.py`, `share.py` (stills and share cards), `scripts/brand/icons.mjs` (icons from the mark).
- Every capture tool waits on `html[data-scene="live"]`; the old scroll-lock wait is gone. A backup of the kit as it was is in `_capture_tools/replay_bak_1010`.
- The hall, looked at closely: `hall_dev.mjs` (an exact camera, a house-light level, a script run in the page; lossless frames) and `px.py` (crop, enlarge, measure) in `_capture_tools/replay/c13/`.
- The site models are made by three scripts, in this order: `tools/gltf/clean_plan_cells.py`, `tools/gltf/make_plan_models.py`, then `tools/blender/make_plan_model_geo.py` in headless Blender. The walnut is `tools/gltf/make_walnut_veneer.py`, encoded with `ktx create`.
- Stop the preview server before building, then start it again.
- Write any patch that contains a backslash or an apostrophe as a script file, never as a shell heredoc: a heredoc turned `\n` into a line break in a test file three times in this work.
