# Fixes to the forensic audit of 9 October 2026

Working record, in the audit's own fix order. Last updated 17 October 2026: all six phases done; what waits on the client is listed at the top and at the end.
The work up to 12 October is in commit bffbe07; what followed is not committed. "Before" pictures are the audit's own evidence in [ev/](ev/).

**Status words:** DONE (built and checked on screen or by measurement) · CODED (written, not yet checked on a build) · CLIENT (his to decide or supply; not built) · OPEN (not started).

## Where it stands

- All six phases are done, apart from what waits on the client (listed at the end). The Telugu typeface (#89) is left as it is, by the user's choice (24 October: no font fetched at build time).
- The public link still serves its older build, by the user's choice (24 October: this build needs more refinement before it goes behind the link).
- The local server (port 3001) is serving the latest build.
- The stills and the share cards are shot from the final build, at all eight screen shapes (192 pictures, 29 cards). Shoot them again after any change to the 3D picture (`scripts/stills/shoot.mjs`, then `encode.py --fresh` and `share.py --fresh`).
- The end-to-end suite passes on the final build, 53 of 53 (five of its tests rewritten to rules this work changed on purpose: see Phase 6).

## The 22 findings that carry a note

| Kind | Findings | What happens |
|---|---|---|
| His to decide or supply | #10, #33, #43, #46, #52, #53, #62, #70, #81, #83, #87, #92, #101 | Not built. |
| Note is history only; the fix is engineering | #1, #2, #21 (done), #58 (done), #7, #34, #42, #6 | Built or to be built. |
| Decided when reached | #36 wainscot | Built: see Phase 3. The room is no darker for it (the panelling is the old slabs' own brightness). |

**Correction to what I said at the start about #53 (headline figures).** I said the unnoted #99 would fix it. It does not: the $300 audit of 5 October asked in so many words to keep the old-style numerals, and the client kept that build. So the large statistics are unchanged and wait for him. The switch is one line (`--figure-nums` in `globals.css`).

Three findings outside the 22 touch his word:

- **#47** (the picture lamp). Only the lamp's own glowing strip is warmed; the light on the picture, the print and the lens are as he had them. Done (Phase 4, indoors).
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
| 2 | Curtain lifts on words with no picture | DONE | The curtain waits for the still, not the scene. At 8 Mbit/s the still holds until the live scene replaces it at 21 to 24 s, with no empty frame. /about likewise. Measured again on the final build (Phase 6). |
| 4 | 404 waits for the scene; empty tab title | DONE | The server now sends the whole page. Message and title present at 0.5 s; status still 404. |
| 3 | Dark wait after pressing a chapter | DONE | Each chapter has its own still, shown in place of the dark. Pressed the portrait's dot on a simulated 8 Mbit/s line, the film live on the cover: dark for under two seconds while that still arrives, then the portrait's still with its words, held until the hall was in (still loading at 30 s). It was 10 s and more of dark. |
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
| 96 | Type sizes and leadings | DONE | Measured on all 28 pages at 1920×945 on the final build: 42 text styles down to 19, in 13 sizes (10.75, 14.4, 16, 18, 22.5, 28.12, 35.16, 44.1, 63, 90.3 and 121.8, with the mark's own wordmark and the Telugu line, #89); one leading per size; one small-capital size (10.75 px). The reading sizes are the scale's own steps, an eighth up at 1,920 px (#74). At 1366×657, 20 styles in 11 sizes. A section's head stands at least 15% over the names under it on any screen (Phase 6). |
| 97 | Two body sizes a fraction apart | DONE | Running text is one size on every screen: 16 px for running text and 18 px for reading text on a phone (measured on all 28 pages at 390×844); past 1,600 px across the whole scale steps up together (#74). No two sizes a fraction apart anywhere. Measured again on the final build at all four sizes (Phase 6): no two sizes a fraction apart. (A page's lede had come to stand 0.6 px over its prose at 1920 once #74 stepped the reading type up; it is the reading size now.) |
| 98 | Three gilts, twelve ivories | DONE | Four strengths of ivory and two gilts, as named values. See the note above on the mark's wordmark. |
| 100 | Hover and state transitions | DONE | Measured on all 1,074 animated controls: two durations (0.3 s, 0.5 s) and one curve. Was four durations, three curves, 728 on the framework's default. |
| 108 | Four focus treatments | DONE | One ring. Tabbed through /about: all nine stops report the same outline (2 px gilt, 4 px clear; inside the edge on the full-width "Next" block). **My first build of it drew no ring at all** (a name clash with an existing value); caught on the capture, fixed, re-checked. |
| 105 | Consent card from a different kit | DONE | The site's own action style, ivory serif heading, 16 px text, the control's real name. Seen at 1920×945 and 390×844. |
| 106 | "Accept all" pre-focused | DONE | Focus lands on the card itself; no choice carries a ring; Enter chooses nothing. |
| 107 | Reopened panel says "Before you explore" and blurs | DONE | Titled "Privacy and data choices.", opens on the choices as they stand, no blur. |
| 109 | Browser's own date field | DONE | A drawn control: a line that says the day in words, opening a month of numerals. Tested by pointer and by keyboard (arrows, Page Up/Down, Enter, Escape); sends the same value as before. Nothing was submitted. Seen opened at 390×844: the month in the site's type, today marked, past days quiet. |
| 110 | "Evening" drops alone | DONE | Two and two beside the date; four on one line where the set has the form's width (/contact). |
| 111 | Two input sizes; resize grip | DONE | One size (25 px at 1920); the message field grows as it is written; no grip. |
| 60 | A borrowed ampersand | DONE | The site now writes "and" (a test holds every page to it) and the borrowed character is gone. This also answers the earlier audit that disliked the typeface's own ampersand. Two college names near VSR Gayatri Township are written with "and" for the same reason. |
| 78 | Heading full stops | DONE | Counted on all 28 pages at 390×844: every first- and second-level heading ends as a sentence does (135, one of them a question), no third-level heading does (41). |
| 95 | Share image, icons, theme colour, domain | DONE | Every page serves its own title, description, picture and address for sharing; favicon, touch icon, manifest and theme colour answer; the served files name one domain. The icons are the client's mark, untouched, on the ivory plate the header uses. **Which domain goes live is his to say**: the build takes it from one setting (currently the .in). The card pictures are cut from the final shoot. |
| 66 | 28 pages on about ten pictures; portrait on legal and 404 pages | DONE | Every page opens on a picture of its own (28 pages, 28 pictures; /start-here keeps the film's first frame by day). No portrait on the small print or the 404. A test holds "no two pages share a place". Seen at 1920×945, 1366×657, 820×1180 and 390×844. The list is below. |
| 67 | Pictures with no subject | DONE | /careers: the empty bench. /gallery: a model seen from above, as a plan. /testimonials: the pool terrace with its chairs and shades. The phone's middle band now shows the subject above the words (was "a screen of empty marble floor"). |
| 68 | Two opening heights, no rule on phones | DONE | One rule on every screen: a page that tells opens on a whole picture, a page that is used (form, list, small print) opens on a short one with its content in sight. On a phone a short opening is now its words under a measured band of picture; checked at 390×844 on all eleven short pages, and at 390×664 (six of them: the words under their band of picture, nothing over a title). |
| 69 | Layout pages' model and plaque out of focus | DONE | Cause found: inner pages in the hall were being focused with the exterior's lens rule. The model and its name plate are sharp on all three layout pages; seen at four sizes. They take the room's occlusion too now, as the film's hall does (Phase 6: a woven grain on the plaster where they had the estate's). |
| 71 | Founder's face cropped out of the phone's quotation band | DONE | Seen at 390×844 and 820×1180: his face stands above his motto. The portrait itself is untouched. |
| 72 | Shade stops 9 px short of the phone's right edge | DONE | The band's text block is now the screen's width, so its shade reaches both edges. Measured on /about's quotation band at 390×844: the shade runs to the last pixel; what is brighter at the edge is the rail's dots. |
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

### The house (#11, #7, #24, #32) and what was found beside them

Captures: `C:/dev/Blender/_capture_tools/out/fix1010/house/` (`film2` before, `film5` to `film8` after).

**One cause ran through most of the house's findings.** The 3D picture cannot be smoothed the way a game smooths it (the buffer that would do it carries the scene's depth instead), so any face of stone thinner than a pixel is drawn only where a pixel's centre happens to land on it: a row of dashes, dots or a streak. From the cover a pixel is about 4 cm of the house. So the fix, wherever it applied, was to build nothing thinner than a hand, and nothing small that faces the ground.

| # | Finding | Status | What was done / how checked |
|---|---|---|---|
| 11 | Flat yellow "gold" on four ornaments | DONE | The gilt no longer glows by itself: it is a metal that reflects the sky. The two balls under the portico's cornice and the corner urns are gone or are stone; gilding is kept on the roundel and the finials only. Seen on the cover and at the door frame: the roundel turns from light to shade round its circle. |
| 7 | Pediments are thin slabs with an open slot behind | DONE | Each pediment is a closed block that runs back to the roof, with returns at its feet. Measured at the film's 48%: black pixels on the pediment and entablature 1,010 before, 37 after. Seen from behind at the cover and the revolve: no slot. |
| 8 | Jet-black jagged line on the pediment's raking edge | DONE | The cause was a V-shaped groove between two eased blocks, baked black. The groove is gone and the line with it. Measured: the rake's underside is at brightness 14–19 (was 2–9), beside a tympanum at 38–56. |
| 9 | A dark break in one bay of the rear balustrade | DONE | Two causes, both fixed: a gap too narrow for a baluster is now a stone panel, and the urn behind that bay (which was drawing black) is lit like the other urns. |
| 23 | Wall lanterns read as black specks | DONE | They were never lanterns: they were small brackets under each window hood, casting a speck of shadow. Removed; the hood stands on its frame. |
| 24 | One window a flat corrugated sheet, its neighbours black voids | DONE | Drawn curtains now have uneven pleats and a parting, with the room showing in the gap. Unlit rooms keep their daylight through the sunset and lose it with the night, so at the film's 42% they read as dim rooms: upper panes at brightness 22 (were 16) beside a wall at 89. The cover by day is unchanged. |
| 25 | Streaky entablature and steps; dots on the column bases | DONE | The entablature and window hoods are rebuilt with bolder mouldings; the steps are plain blocks (their thin nosings were the streaks); the column base has no undercut ring (the dots were that ring, found by a ray through three of them). Seen at 1:1 at the film's 48% and 50%. |
| 32 | Capitals are a bowl with a thin plate; brass block for a handle | DONE | Tuscan capitals in the column's own stone, with an abacus a hand deep; turned door handles (a rose, a neck, an oval knob). The audit's third point, a woven texture on the stone at the door, was the contact pass's noise and is gone (see the stone, below; looked at again against the audit's own door frame in Phase 6). |
| 70 | Saloon car, close up | CLIENT | Unchanged: his call. |

Also fixed while there, not in the audit: the grove of palms behind the pool stood partly on the helipad; it is moved clear. The occlusion bake itself was rewritten so it can be re-run on a finished file, and so that faces buried inside other stone no longer bake black.

### The words (#84, #85, #86, #88, #93, and #94 from the micro list)

Measured the way the audit measured, on the pages as served (27 pages, main text only), with `_capture_tools/replay/c13/copy_audit.py`.

| # | Finding | Before | After | Status |
|---|---|---|---|---|
| 84 | "This, not that" sentences | 29 | 7 | DONE. Four are kept on purpose: the band on /why-us ("Check the number, not the logo."), and three plain statements of fact in the guide, the privacy notice and the terms. The other three are one phrase counted three times: "Draft — not yet in force". |
| 85 | Copy about the website; statements of what is missing | 59 and 111 | 7 and 51 | DONE. /why-us is five plain claims; its section listing what the site leaves out is gone. The remaining "not"s are ordinary sentences. |
| 86 | Sentences reused word for word | 50 | 1 | DONE. The one left is the head office's address. Each layout's facts are said once, on its own page, and linked to. |
| 88 | Three quotations that name other projects, undated | | | DONE as far as honesty allows: three quotations and one note saying which development each speaks of. No date or name has been invented. Dated accounts from buyers of these three layouts are his to supply (CLIENT). |
| 93 | "Do I need a WebGL-capable device?" | | | DONE: "Will this work on my phone?" |
| 94 | Hidden anti-spam field reads as page text | | | DONE: its label is gone from the page's text; the field still catches robots. Neither form was submitted. |
| 87 | Sections that announce their own absence | | | PARTLY, rest CLIENT. The sections titled "No photographs, and why", "Being written" and the empty record are removed, so no page announces what it lacks. The approval reference "Ask the branch" is shown only when there is a reference. Real photographs and references are his to supply. |
| 92 | Vision and mission paragraphs | | | CLIENT. His words; not rewritten. |

Total words on the site: 11,308 before, 9,147 after. Plot counts were checked to agree on every page that states them (113/113, 181/118, 113/113); they are still his register to confirm (#83).

### The stone, seen from where the film stands (12 October)

Found while checking the house at 1:1 on the cover, after the audit's own list was done. All of it is one family with the audit's #5, #8 and #25 ("thin features break into stair-steps and dotted lines"): the picture cannot be smoothed the usual way, so any face under a pixel wide that is darker or lighter than both its neighbours is drawn as a dot wherever a pixel's centre lands on it. A pixel is 4 cm of the house from the cover and 1.5 cm from the door. Each cause below was found by sending a ray through the offending pixels on the running build.

| What was seen | Cause | What was done |
|---|---|---|
| #32, third point: stone at the door has "a woven, cloth-like texture" | Not the stone. The contact-shadow pass takes twelve samples a pixel with nothing to average them, and on smooth stone its sampling noise is the only grain there is. | Dressed stone is left out of that pass (its shading is already baked into it, and the sun has its shadows). Measured on the portico's frieze at the closest outdoor frame: pixel-to-pixel deviation 3.45 before, 1.08 after. The car's contact shadow on the gravel is unchanged (46 against 46). |
| Rows of single black pixels across the ground-floor walls on the cover | The "channel joints" of the ground floor were slits 5.5 mm tall cut into the wall. | Removed. The wall's courses are the ones its material already draws, which fade with distance instead of dotting. |
| Dotted lines under the terrace's coping, the parapet's caps, the portico's cheek walls | Every edge of the dressed stone is eased by a centimetre; the eased faces that look down see no sky and are darker than both neighbours. | Edges that would look down are no longer eased. |
| A dotted pale line along the cornice under the pediment and along sunlit plinths | The same eased edges, where they look up into the sun. | The cornices and the parapet, nine metres up, are not eased at all. Lower down, where the inner pages stand three to five metres from the stone, each eased edge is shaded as the face beside it from a distance and as itself only when the camera is close enough to draw it. |
| Dashes between the corner blocks (quoins) | Joints 2.2 cm wide: half a pixel. | Joints 5 cm wide, which draw as lines. |
| Two rows of dashes under the right-hand slope of the front pediment | The cover's camera sees the undersides of that slope almost edge-on. | One splayed soffit under each slope, wide enough to draw, lit by the wall it leans over. |
| A dashed black line across the roof at the film's 14% | The roof's middle stood on a step of 8 cm. | One level. (The roof itself is #10, his decision; this only removes the step.) |
| Single dark pixels along the pool's coping at the film's 30% | The coping's visible edge is a plate two centimetres thick; easing its top arris left a one-centimetre face whose only neighbour in the occlusion bake was the buried face under it (7 parts in 100 of the sky, against 95 on the plate's top). A ray through the pixels named it; the atlas has it at 77 of 255. Three earlier guesses were wrong. | The coping is no longer eased: its edge lies against its own top and bakes as that. (The bake also now treats all-but-black as unbaked and fills it from beside.) Seen at 30%, before and after: the row of black pixels is gone. |

Measured on the cover, isolated dark pixels on the house: 417 before, 230 after the first rebuild; what is left is detail that should be there (the gaps between dentils and balusters, the quoins' joints, the undersides of urns). The car's trim at the cover draws as short dashes too: thin geometry on the generated car, four or five centimetres a pixel from there. It belongs with #70 (replacing the car is his call).

## Phase 4 — Visual consistency

### Outdoors (#12, #13, #15, #14, #6, #17, #16, #20, #29, #10, #25)

| # | Finding | Status | What was done / how checked |
|---|---|---|---|
| 12 | Palms are black silhouettes | DONE | Palms take the sun and the sky like every other tree, with light through the fronds and a lit trunk. Seen at the cover, 11%, 30% and 42%. Their green was too bright on the first try; taken down. |
| 13 | Fog swallows far trees while nearer palms have none | DONE | With the palms lit, the same air now takes palms, trees and the boundary wall by distance. Seen at the film's 30%: the palm avenue fades evenly from near to far; the far trees are warm, not mint. |
| 15 | Shaded stone turns grey-green | DONE | Cause: the sky's fill light was a blue that is as green as it is blue. Measured on the rear wall in shade: 85, 89, 86 before (green highest); 91, 88, 82 after, the lit stone's own hue, darker. |
| 14 | Yellow-green glow round the sun | DONE | The glow in the sky picture is turned from yellow to amber (a new plate, v10). Measured: hue 43° to 32° at the film's 30%, 34° to 28° at 42%. |
| 6 | The cover's sky is flat grey-brown | DONE | Cause: the cover looks down on the house, so its "sky" is the haze at the horizon under a neutral grey filter. The filter is now a slate one, cool at the top and clear by the tree line, with the horizon left warm on the sun's side. Measured on the band behind the headline: 98, 98, 95 before; 81, 91, 104 after (a slate, saturation 0.2, a tenth darker under the title). It is the cover's only, and is gone before the orbit's own clouds come in. **Touches his word:** see the note below. |
| 17 | The pool is three different things | DONE | See "Water" below. |
| 16 | The lawn is smooth at distance and blotchy close up | DONE | Mown bands are stronger (they were under two brightness levels from the cover), and the grass has grain at three sizes that fades out before it can shimmer. Seen at the cover and at the film's 48%: stripes and texture where there were soft blotches. |
| 20 | Loungers are wedges, parasols discs on pins | DONE | Loungers with a teak frame, a two-part cushion and a bolster; parasols with ribs, eight gores of cloth and a valance. Seen at 11%, 30% and 48%. |
| 29 | A featureless white wall with a dashed top | DONE | The wall has a wider coping (so its top is a line, not dashes) and weathering: a darker cap and run-off stains. Seen at the cover and the revolve; it also fades with the haze now (#13). At the far end of the park (the film's 17%) the coping's top is under a pixel and was still dashed; there it is shaded as the wall's face now (Phase 6). |
| 10 | The flat roof deck | CLIENT | His decision ("fully flat roof"). Not touched. |
| 25 | Portico entablature, steps, column bases | DONE | See the house, above. |

### Water (#17, and #27 from the micro list)

Every sheet of water is now drawn the same way (`exteriorWater.ts`): a dark mirror.

- **What was wrong, measured.** The pool held a photograph of its surroundings taken at one of three fixed moments and shown brighter than life (1.6 times). At the door frame it was still showing the sunset under a night sky: brightness 139 against the sky's 72. Its colour was a turquoise paint, the same at noon and dusk. The "noise texture with visible blocks" was the contact-shadow pass printing its sampling noise on the dark water of the overflow trough.
- **What it is now.** The pool and the canal each photograph their surroundings again every time the film's hour moves on a step, and show it at the sky's own strength, never more. The house, the terrace balustrade and the canal's hedges are placed in the reflection where a mirror would put them. The fountain's basin shows its own bowl and pedestal, and each basin shows the dark band under its rim. The reflection loses half its blue by nightfall, so the water sits in the dusk it is in.
- **Measured after:** pool at the cover 66, 81, 98 (was 56, 80, 101); at the film's 30% 52, 58, 64 beside a terrace at 65, 60, 59 (was 61, 80, 94: the "turquoise rectangle"); at the door frame 79, 88, 94 (was 121, 142, 157).
- **Seen:** the canal at 30% holds the house's dark reflection at its head and the hedge along its far side; the fountain at 42% shows its bowl in the basin; the trough is dark and clean.

### Small things outdoors (from the micro list)

| # | Finding | Status | What was done / how checked |
|---|---|---|---|
| 18 | Bollard lights on at noon; each a white square | DONE | Lamps are off by day and come on as the evening does (measured: strength 0 at the cover and at 11%, full at 30%). Each is a round post with a lamp head under a cap. The terrace's were a cyan; lit, they are the same warm white as the drive's. |
| 19 | Glass rail is a dotted line | DONE | A handrail a hand wide over the glass. Seen at the cover and at 30%: a continuous rail with its panels. |
| 22 | Shrubs black at the cover, red at the revolve | DONE | The bougainvillea takes less of the sun and more of the shade, and a little less colour: a deep rose in both. Seen at the cover and at 11%. |
| 26 | Dotted orange sparkle on the car's sill | DONE | The standard cure for sparkle on fine metal (the highlight is widened by how fast the surface turns within one pixel). Seen at the door frame: lines along the body where there were dots. |
| 27 | Fountain water a cream ellipse; basins flat grey mirrors | DONE | See "Water". |
| 30 | A palm, a parasol and a hedge cut by the cover's edges | DONE except one | The palm grove and the east hedge are moved out of the frame. The fountain bowl at the bottom edge would need the approved camera to move: CLIENT. |
| 119 | The orbit's two lines across the hedge's top | DONE | The caption stands on the lawn and leaves before the camera brings the hedge under it (it was leaving a notch and a half late). Seen at 11, 12, 13 and 14% at 1920×945. |
| 31 | Paragraph on the terrace rail; "Start here" on the paving | DONE | Both stand on the lawn above the terrace now, as one block: the paragraph's last word is 47 px clear of the rail and the cue ends 26 px over its corner, at 1920×945. Looked at on four more wide frames (1536×730, 1440×900, 1366×657, 1280×593): at 1280×593 the paragraph, set at the type's floor, took four lines and its last ran over "Start here". The paragraph now stands on its cue (set from the cue's foot, its measure never under the design's line length): three lines and a clear gap at 1280×593, and not a pixel moved at 1920. |
| 56 | Portrait headline changes colour mid-line | DONE | The gilt line begins a line: "for twenty years." stands alone in gilt under the two ivory lines. Seen at the film's 81.5%. |
| 57 | The count's parts in two orders | DONE | Figures first, then the heading, then the note, on every screen (seen at 390×844 and 820×1180 through the chapter). The type stands on a ground no brighter than a luma of 64 under its own letters: at least 8.9:1 on both. |

### Indoors (#47, #45, #44, #50, #51, #42, #49)

| # | Finding | Status | What was done / how checked |
|---|---|---|---|
| 47 | The picture lamp a flat bar with a pale-blue line | DONE | The tube is the colour of its light (a warm white). Only the tube: the light on the picture, the print and the lens are his and untouched. |
| 45 | Sconce flames pale blue-white under a warm glow | DONE | The flames were warm all along and printed white at forty times the print's white, then turned blue by the hall's balance. A strength at which their blue stays under the curve's shoulder: a cream flame in an amber glow, with a flame's shape. |
| 44 | Black wedges between the stair's stringer and its treads; a soft, swollen cap | DONE | The flights are arcs about one centre, and the cap the balusters stand on was modelled a centimetre behind the step ends, so each riser's end stood out of it as a black sliver and the steps' outline as a saw-tooth. Each cap's open face (outer and inner) is brought 12 mm proud of the step ends, and lit from the band under its top edge, which was always in the open (its lower part had been baked inside the steps). The level run across the landing is left as it is. A closed string with a clean arris. Seen close at the film's 75.9% and from the front at 77.3% and 78.7%: no slivers, no saw-tooth (hallStair.ts). |
| 50 | Navy stair carpet against a red rug | DONE | One carpet ink for both, the same hue taken down to a slate and a little deeper; each keeps its own weave and pattern. |
| 51 | The arched windows are flat cards | CLIENT | See the note on the three things that touch his word, above. |
| 42 | The darkest of the three tables | DONE | The second table's room under a site model is as bright as the other two: the wall behind the model at a luma of 186 to 200 where it was 119, the words keeping their ground by the lens's own edge (at least 4.8:1). |
| 49 | The map's list on the stair's saw-tooth; pins without names; a dotted rim highlight; black corners | DONE except the corners | The list stands on plain ground now that the stair's strings are closed (#44): under the list a smooth band, median luma 26. Each pin carries its layout's name on a plate of the hall's kind (gilt capitals on the dark of the tables' name plates), set over its head or beside it so no name lies on another or on another pin, at desk and phone sizes, and gone as the sign-off comes up. The rim's dotted line was the walnut's grain, laid from above, scattering on the rim's steep roll: the grain is kept to the flat top, and the roll's highlight is drawn a pixel wide. Bright points along the rim's front at the film's 89%: 78 before, 0 after. The corners are the hall's own vignette at dusk, the way into the dark ending he asked for: left. |

### Shading and pictures (#72, #54, #55, #71, #114, #113, #117, #65, #89, #74)

| # | Finding | Status | What was done / how checked |
|---|---|---|---|
| 72 | The band's shade stops 9 px short of a phone's right edge | DONE | See Phase 2. |
| 54 | The header's band ends in a visible edge on a tablet | DONE | On an upright frame the band falls over 30% of the frame outside (the grad a photographer sets on a bright sky): its foot is no longer seen and the land is untouched. Seen at 820×1180. |
| 55 | The shade behind a table's name on a phone | DONE | A longer fall under the name where a site model stands, so the shade is not a shape. Seen at 390×844 and 820×1180. |
| 71 | The founder's face cropped out of the phone's band | DONE | See Phase 2. |
| 114 | The house cut by the phone's right edge on the cover | DONE | A phone's cover lens a little wider (1.9) with its aim on the house (offset 0): both corners of the front in frame at 390×844. A tablet held upright, which held the whole front already, keeps its lens. |
| 113 | The dots over the house, over a tablet's building, and into the telephone number | DONE | On an upright frame the rail steps out of the picture once the film has been still for a moment (four seconds on arrival, then 1.6), and the first movement brings it back; a touch where it stands still opens the names. Seen at 390×844 on the cover, a table and the map, and on a tablet. A wide frame keeps it in view. |
| 117 | Things to press under 44 px | DONE | The header's two controls, the mark's link, the colophon's telephone number, the footer's small-print links and the forms' privacy link are 44 px tall on a touch screen. Measured on all 28 pages at 390×844: no control under 44 px tall. (The first measurement found the menu control at 33.6 px, its own rule later in the sheet winning over the touch rule, and the mark's link at its tile's 40 px; both fixed and measured again.) |
| 65 | Three plan blocks in three layouts | DONE | One layout on /gallery: each plan on a mount of one proportion, its actions beside it. |
| 89 | The Telugu line in an accidental typeface | NOT DONE (the user's choice) | A Telugu serif would have to be fetched (Noto Serif Telugu, through the site's own font loader at build time). The user chose on 24 October not to fetch it: the line stays in the system's own Telugu face. |
| 74 | Dark reading sections at 1920 | DONE | The reading type keeps the visitor's size up to a laptop's frame and, past 1,600 px across, steps up with the frame to an eighth larger at 1,920 (running text 18 px), heads and standfirsts with it, each at its own leading; measures are in characters, so the columns widen with it. Seen on six pages at 1920×945. |

**Three things here touch the client's word.** None reverses him, but he should know:

- **The cover's filter is slate, not neutral (#6).** His rule is that nothing is blurred or frosted behind text, with neutral darkening allowed. This is still only a darkening filter, with no blur; it is tinted. It is one setting to return to neutral.
- **The pool at sunset is less bright than the build he kept (#17).** The 5 October audit asked that the pool "pick up the sky and house" at sunset, and he kept that. It still does, more truthfully (the house is now actually in it), but it is a dark mirror, not a bright one. One number brings the brightness back.
- **The hall's windows (#51)** are not done, on purpose: what the audit asks for (glass with a faint sky and the lamps in it) is the version he sent back on 6 October, and the build holds his panes (audit300.test.ts). His to reopen.

## Phase 5 — Micro-polish

Those of the micro list not already in the tables above.

| # | Finding | Status | What was done / how checked |
|---|---|---|---|
| 38 | The table's rim faceted, the pedestal flat-sided | DONE | Each wandering ring of the turned top set to the middle of its wander (the gadroons read as a saw's edge), and the turnings shaded as a lathe leaves them; the tables keep their own meshes, veneer and light (hallTables.ts). |
| 48 | The nameplate's gilt edge stair-stepped; dashes on the panel to its right | DONE | The "stair-steps" were the plate's top faces, under a pixel, lit by the ceiling in the room's probe; they sit in the frame's shade, and are shaded so: bright pixels along the plate's top 43 before, 1 after. The plate, its lettering and the portrait are otherwise as they were. The panel's top inner edge draws as one line now (the edge smoothing, #5). |
| 64 | "Open at full size" opens a bare image | DONE | A plan opens in a viewer on its own page: zoom and pan by wheel, pinch, drag and keys, the whole sheet a key away. |
| 75 | Single-word last lines (49 on a desk, 30 on a phone) | DONE | Running text broken with its last lines in view, headings and option labels balanced, an index's names set as headings, the margin's heads 20 characters wide (room for "Vizianagaram district."), and four names held together where they broke. Counted on all 27 pages: 0 at 1920×945; at 390×844 the one left is a school's name broken at its own hyphen, its last line two words. Counted again on the final build, table cells included (Phase 6): none at 1920×945, 1366×657, 820×1180 or 390×844. |
| 76, 115 | A rule or a dot starting a line | DONE | The separator belongs to the item before it and is clipped at a line's start. |
| 77 | "Up to 12 months" wrapping in a narrow column | DONE | A table's short column keeps to one line. |
| 104 | The draft notice and the lists under it on two edges | DONE | One text edge. |
| 118 | A strip of the nameplate's letters at the top of the phone's map chapter | DONE | The phone's court and map frames stand their fronts higher (-0.1 and -0.2, from -0.22 and -0.3): from the film's 87.5% to its end the strip's brightest pixel is 20 to 24, where it was 64. The plate crosses the frame's edge once, on the way in, as anything the camera leaves does. |
| 101 | The ivory tile behind the mark | CLIENT | The mark is his. |

Also found and fixed in this phase, not in the audit:

- **A plot's size split across two lines** ("30′ ×" at the end of one line, "56′" on the next: /start-here at 1920, once the reading type stepped up). A size is written through one function now, with spaces either side of the sign that do not break.
- **The cover's paragraph over "Start here" at 1280×593** (see #31).

Also found in the re-audit's measurements, and fixed:

- **/cookie-policy widened a phone's page to 404 px.** The #77 fix held the "Lasts" column to one line everywhere, and on a phone, where a table's row is a block, "Deleted when you close the browser" ran 13 px off the screen. The column keeps to one line only where the table is a table (640 px and wider). Measured again at 390×844: nothing past the screen's edge.
- **/faqs wrote plot sizes as "30′×50′"**, its answer stripping the spaces from each size. It writes them as the layouts do now.
- **The map's pin names stood on pages' stills** (over the stair on /faqs, at the edge of /contact at 390×664), where the table is far off or behind something. They are the film's only, where the camera comes to the table.

## Phase 6 — Final pass

The audit's last three steps (its fix order, 23 to 25). The final build is `XvZYCE41IFs_IVPqZcqlK` on port 3001. Captures: `C:/dev/Blender/_capture_tools/out/fix1010/audit20/` to `audit25/`.

### 23. The audit's captures again, and every finding against its evidence

**The film, a wheel notch at a time** (the audit's own steps: a third of the frame a notch, 1.5 s a step), at 1920×945, 1366×657, 820×1180 and 390×844: 74, 74, 73 and 143 frames, no script error at any size, the only failed requests cancelled link prefetches (as in the audit). These four ran before this pass's own fixes, which were then checked on their own frames (the door at 53%, the far wall at 17%); the desktop walk was taken again after the first of them. At 390×664, the audit's fifth size, walked on the final build: 146 frames, no error, no failed request; the cover keeps the whole house, the map's names stand apart and go as the ending begins, and the sign-off rises under the lit table before the lens closes. Contact sheets beside the audit's own (`ev/70` to `ev/73`): every frame where the audit's sheet shows a defect shows the fix, and the frames between are as they were (the camera's path, the rooms' light and the ending are the approved ones).

**The audit's zoomed evidence, rectangle for rectangle.** Each zoom (`ev/11` to `ev/26`) was cut from one of the audit's own walk frames; each panel was found in its frame by template matching (`_capture_tools/replay/c13/evmatch.py`) and the same rectangle cut from the same step of the final walk. 55 panels, from fourteen sheets. What they show:

| Evidence | Findings | Final build |
|---|---|---|
| 11, cover: roof and front | #7, #8, #9, #11, #23 | Pediments closed; no black rake line; the balustrade's bay whole; no gold balls on the portico; the window brackets gone (see the note on the hoods' shadows below). |
| 12, cover: car, pool, trees | #17, #18, #19, #30, #31 | The pool a dark mirror; bollards dark by day; a handrail over the glass; the paragraph off the rail; the corner palm gone. |
| 13, the orbit at 11% | #20, #21, #22, #29 | Loungers and parasols rebuilt; no colour fringe; the shrubs one rose; the wall's top a coping. |
| 14, the orbit at 17% | #5, #7, #12, #15, #29 | Pediment closed; palms lit; shaded stone warm; quoin joints drawn as lines. The far wall's top was still a dashed line here: fixed in this pass (below). |
| 17, the approach at 42% | #7, #9, #10, #24 | No slot behind the pediment; the roof balustrade's gaps gone; curtains for the corrugated sheet. (#10, the flat roof: his.) |
| 18, the approach at 48% | #11, #16, #17, #18, #25, #26 | Pool, bollards, urn, portico, steps and column bases as fixed; the car's sill a line, not dots. |
| 19, the door at 53% | #11, #32 | Stone capitals; no weave on the shafts; a turned knob. |
| 20, first frame inside | #34, #36, #44, #50 | Balusters the walls' colour; the stair's string closed; panelling for slabs; the rug slate. |
| 22, 23, the second and third tables | #37, #38, #39, #40, #41, #42 | One walnut at its own scale; the rim turned; the boards' blanks and holes made good; the second room as bright as the others. |
| 24, the stair pass | #36, #44, #45 | Panelling with raised fields; the string closed. |
| 25, the portrait | #47, #48 | The lamp's tube warm (blue over red 1.06 before, 0.83 now); the plate's gilt edge one line. |
| 26, the map | #49 | Pins named; no dotted rim; no saw-tooth under the list (looked at again full size: the string behind the list and the heading is one smooth band). |

**The pages**, top to bottom with every text, control and box measured, as the audit measured them: all 28 at 1920×945, 1366×657, 820×1180 and 390×844 on the final build. No script error on any page; no page wider than its screen at any size (the few boxes past an edge are the rail's shade and the hairline lists' rules, cut away by design); the only failed requests are cancelled link prefetches. Type: 19 styles in 13 sizes at 1920×945 (the audit counted 42 in 15), 20 in 11 at 1366×657, 18 in 12 at 820×1180 and 17 in 10 at 390×844, and nowhere two sizes a fraction apart but the mark's own wordmark beside the reading size and the Telugu line (#96 and #89). Single-word last lines: none at any of the four sizes. Transitions: two durations and one curve over 1,186 animated properties. On a phone every thing to press is at least 44 px tall. The states, again on the final build at 1920×945 and 390×844: the consent card, the menu, hover, the focus ring, the privacy panel, both forms typed into and never sent, and a finger on the rail (a tap beside the dots does nothing; a tap on a dot opens the names, a choice closes them).

**First visit, on slow lines** (a simulated 8 and 20 Mbit/s with 80 ms of latency, 1920×945, the page as a visitor gets it):

| | Picture and words up | Live scene | The audit's build |
|---|---|---|---|
| The film, 8 Mbit/s | 1.9 s (its still) | 24 s, the still held until then | 15.5 s of dark, then words on an empty frame until about 22 s |
| /about, 8 Mbit/s | 1.7 s (the portrait's still) | after 40 s (the hall's 27 MB), the still held | words behind the curtain 14 s, the title on an empty frame from 17 s to 34–42 s |
| The film, 20 Mbit/s | 1.6 s | 13.8 s | curtain at 12.7 s |
| /about, 20 Mbit/s | 1.5 s | 20.8 s | — |

No frame of either page at either speed is empty: from the still's arrival to the live scene the frame is the same picture. (The dimming at 1.5 to 2 s is the consent card's own ground, there by design.)

**Found by the re-audit, and fixed:**

- **Two dark dots in the open front door.** The hall's own front doors, panelled for #36, have brass knobs; through the open door the hall is drawn with its front wall and door hidden, and the knobs were not hidden with them: two dark dots on the rug at the film's 53%, from the moment the door opens to the camera's passage through it. They go with the wall now (`doorPortal.ts`, `HALL_FRONT`). Seen gone at 1920.
- **A woven grain over the hall's plaster on every page that stands in the hall** (/about's plate at 1366×657 plainest). It was the screen-space occlusion's sampling noise: those pages had the estate's occlusion (two and a half metres of reach, at 1.25) instead of the room's (0.7 m, 0.6), and it had been hidden while they were out of focus; #69 brought them into focus. They have the room's occlusion now, as the film's hall does (`LensFocus.tsx`): the plaster's pixel-to-pixel deviation 2.24 before, 1.18 after.
- **The far boundary wall's top a dashed line at the film's 17%** (#29's own complaint, which the wider coping had cured at the cover but not a hundred metres off): the coping's top is half a pixel high there, and the piers' sides were dotted uprights. A face of that wall that is not its face is now shaded as its face while it is under a pixel or two across, and as itself nearer (`exteriorSurfaces.ts`, `BOUNDARY_FAR`, the house's eased-edge rule): brightest pixel along the far top 103, was 167; the cover's nearer wall keeps its coping line.
- **Two type sizes a fraction apart again, from #74.** Stepping the reading type up at 1,920 px put page prose at 22.5 px beside the page's lede at 23.1 (the lede was in the frame's unit). The lede and a window's gloss are now the reading text's own size on every screen (they already were on a phone), which also ends a laptop's lede being smaller than its prose (17 px under 19.9 at 1366×657).
- **A section's head the same size as the names under it, or smaller** (older than this work, and not in the audit's list): the heads are display type in the frame's unit and follow a short frame down; the names (an index's, a question, a step, a figure's unit) are reading type and do not. At 1366×657 a head measured 30.66 px over names of 30.89; at 1280×593 the names were the larger (30.46 under 27.67); a phone held upright had 26.07 under 26.91, and held on its side 28.3 under 24. Where a head comes down to its names they now take the step below their own (two steps on a frame 640 px high or less), and a quotation the head's own size; nothing is added to the scale. Over every window from a phone to a 21:9 monitor a head now stands at least 15% over its names (it was as little as 80%); at 1920×945 and on a tablet held upright nothing moves (`folio.css`, `--name`, `--quote`; `typeRoles.test.ts` sweeps the window sizes).
- **The three layout pages were shared with a starter kit's card** (#95). Every other page's card is cut from its own opening still; these three kept a picture drawn by a route left from the project's template: a grey sheet in a sans-serif, "Available Units", and the word ESTATE where the company's name belongs. On this machine that route could not even load its font, so the picture was broken. The route is gone and the three are carded like every other page, each with its own model on its table (`projects/[projectSlug]/page.tsx`, `share.test.ts`). Their description was the database's narrative, which still wrote sizes as "30x50 to 30x60 feet" (#90); it is the page's own lede now. Checked on the served pages: 28 of 28 with a title, a description, a picture and an address of their own, every picture answering.
- **Names in a list of names lost their first letters on a phone**, a side effect of #76's own fix (each such list is set a rule's width to the left, and that strip cut away, so that no rule begins a line). A name that wrapped began its second line in the strip: "echnology", "ential School", "ultural College" on /locations at 390×844. Each name's lines now begin where its text does (`folio.css`, `.folio-run`); seen whole on the phone.
- **Two pages with one description** (/gallery and /downloads, word for word). Each now says what it is, in its own lede's words; a test holds every page to a description of its own.
- **Single-word last lines left in tables, and in one legal paragraph** (#75). The rule that breaks running text with its last lines in view did not reach a table's cells: three of /cookie-policy's ended on "page.", "attention." and "here." on a phone, one at 1366×657. It reaches them now. Where the browser could not rebalance a line (one paragraph of /refund-policy at 1366×657, round a long name and a draft's placeholder, and one /cookie-policy cell on a tablet), the last two words are held together.

**Every link** in the served pages: 41 addresses, every one answering; 95 links to a section, every one landing on a section that is there.

**Found, and left, and why:**

- **The entrance rug at the door reads near-black.** It is as dark as it was in the audit's own frame (median luma 19 then, 18 now); only its hue changed, from oxblood to the slate #50 asked for, "deeper and less saturated". Lifting it would undo "deeper".
- **A small dark mark at the end of each first-floor window hood on the cover**, four or five pixels: the hood's end face in shade, and its shadow under it in the low sun (switched off, the sun's shadow takes half of it with it). The audit's "lanterns" (#23) were brackets twelve pixels tall beside each window and are gone; seen side by side at 1:1, what is left is the hood's own shade, and nearly invisible.
- **On the pages that stand close to the hall's walls** (/about's plate at 1920 is the plainest), a dotted line along one panel moulding's inner edge and a broken line under the frieze's cornice, at 1:1 faint. Both are faces narrower than a texel of the hall's baked light, which read stray texels. The cure is a re-bake of the hall's light with those faces given texels of their own: a change to the whole of the approved hall, not made.
- **The film's supporting lines and a page's prose at 1920×945**, 23.1 and 22.5 px: two systems on two different pages (the film's copy is set in the frame's unit, a page's reading text in the reader's own size), and only that close at that height of window.

**The stills and the cards**, shot from the final build at all eight screen shapes: 192 pictures (16 MB), 29 cards. **Unit tests** 645 of 645; types clean; lint clean (the eight old warnings). **The end-to-end suite**, run for the first time since 6 October: 48 of its 53 tests passed on the final build. The other five were each written for something this work changed on purpose, and each is rewritten to the rule as it now stands, its guarantee kept: the cover's line and cue stand together on the lawn (#31; the test held them at 71% on the terrace's rail and at the frame's foot on its paving, and now holds them at 64% and 81% on every wide frame, where they measure the same to the pixel's fraction); the phone's poster frame is read a frame and a half before the end, the film's colophon being half a frame longer since #58 (the suite's own "no line of the colophon ever stands on the lit table, at any size or scroll" passed throughout); the visit's day is asked of the drawn month (#109): no day chosen for the visitor, today marked, every day before it shut; a short opening on a phone holds no frame's height (#68); and the rail's keyboard test runs on a page of several sections (/why-us has one since #85, and a page of one section has no rail). Run again whole on the final build: 53 of 53.

### 24. Real devices

Not available here: no iPhone, no Android phone, no Safari. A laptop's integrated graphics was measured earlier in this work (#5: 78 to 81 frames a second outside at 1920×945, 106 to 121 inside). Not measured through the public link either: which build stands behind it is the user's to say.

### 25. The client's word

The findings that need him are in the table at the top and listed below, unchanged by this pass.

## For whoever picks this up

- Patch scripts and captures: `C:/dev/Blender/_capture_tools/out/fix1010/`.
- New tools in `_capture_tools/replay/c13/`: `fx_load.mjs` (first-visit timing), `fx_end.mjs` (film ending and menu), `fx_form.mjs` (the forms' controls; never submits), `gl_warn.mjs` (console messages while a scene draws), `find_text.py` (where a phrase is printed), `fx_header_pass.mjs`, `fx_touch_scroll.mjs`, `aa_ab.mjs`, `swap_probe.mjs`.
- New scripts in the app: `scripts/stills/shoot.mjs`, `encode.py`, `share.py` (stills and share cards), `scripts/brand/icons.mjs` (icons from the mark).
- Every capture tool waits on `html[data-scene="live"]`; the old scroll-lock wait is gone. A backup of the kit as it was is in `_capture_tools/replay_bak_1010`.
- The re-audit (Phase 6): `evmatch.py` (finds each panel of the audit's own evidence crops in the frame it was cut from, and cuts the same rectangle from a later frame), `meta_check.py` (every page's served title, description, share picture and address), both in `_capture_tools/replay/c13/`.
- The hall, looked at closely: `hall_dev.mjs` (an exact camera, a house-light level, a script run in the page; lossless frames) and `px.py` (crop, enlarge, measure) in `_capture_tools/replay/c13/`.
- The site models are made by three scripts, in this order: `tools/gltf/clean_plan_cells.py`, `tools/gltf/make_plan_models.py`, then `tools/blender/make_plan_model_geo.py` in headless Blender. The walnut is `tools/gltf/make_walnut_veneer.py`, encoded with `ktx create`.
- Stop the preview server before building, then start it again.
- Write any patch that contains a backslash or an apostrophe as a script file, never as a shell heredoc: a heredoc turned `\n` into a line break in a test file three times in this work.
