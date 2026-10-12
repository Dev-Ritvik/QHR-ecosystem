# Forensic visual audit — Quality Homes Reality

- **Site audited:** https://virtual-debug-thumbnails-vcr.trycloudflare.com/ (the build that went live behind this link at 22:04 IST on 9 October 2026)
- **Audit date:** 9 October 2026
- **Findings:** 119 verified, each with an evidence image in [ev/](ev/)

## What was inspected, and how

- **Every page:** the film on the home page, 27 inner pages and the "page not found" page, each top to bottom at four screen sizes (1920×945, 1366×657, 820×1180, 390×844). The film was also walked one wheel notch at a time at a fifth size (390×664).
- **About 2,500 captured frames**, with zoomed crops (2× to 8×) of every region that looked wrong.
- **Measured, not eyeballed:** the computed size, weight, spacing, colour and position of every piece of text, every control and every bordered box on every page, compared across pages.
- **States:** consent card, menu, hover, keyboard focus, the privacy panel, both forms (typed into, never sent), and a finger simulated on a phone.
- **First visit:** timed through the public link, and at simulated 8 Mbit/s and 20 Mbit/s.

**Two builds were seen today.** This morning's link served the build of 7 October; it has since been replaced. Tonight's build differs from it in eight files, all of them the film's loading logic. I checked that the film's loaded frames are identical between the two (74 of 74 steps, copy timing identical) and that no inner page, stylesheet, model or sentence changed. Every loading figure in this report was re-measured on tonight's build. What this morning's build did through the link (a headline on black for about 27 seconds, an empty hall for 30) is **not** reproduced tonight and is not counted.

**Not covered:** Safari, Firefox and real phones (everything was Chromium); frame rate on integrated graphics; sound; sending a form; the CRM; the brochure PDF. No screenshots came with the request, so the "examples" the brief mentions could not be used as a baseline.

**Lines marked "Note"** flag a finding that touches something the client has already decided (the camera's path, the bright hall, the logo, the flat roof, the portrait), or that needs something only he can supply. Those are reported because the audit asks for everything visible; they are not recommendations to overrule him. The film's dark last frame is his own order and is not listed as a defect.

---

# 1. Executive verdict

**Does it currently look professionally finished?** No. The interface is close: one typeface held everywhere, a consistent header and page grid, clean page-to-page transitions, no script errors on any of 28 pages at four sizes and no failed requests beyond a few cancelled prefetches. The 3D picture and the content are not finished, and those are what the site is made of.

**Does it look award-ready?** No.

**Does it contain visible AI slop?** Yes, in three places. The hall's ornament and materials (a frieze of floating stars, flat slab panelling, one wood grain at three scales, pink plaster). The house's decoration (flat yellow "gold" balls and bands with no architectural reason). And the writing: 37 "this, not that" constructions, 38 sentences about the website itself, 54 sentences reused word for word.

**Does it contain systemic inconsistencies?** Yes, nine: no edge smoothing on any 3D frame; two different footers; eight pages with two to four names each; six ways of writing a road width; four numeral styles; fifteen type sizes; three golds and twelve greys; four transition speeds; and 28 pages opening on about ten pictures.

**What is preventing it from feeling exceptional:**

1. **The proof is broken.** The three plans the whole site points to are cropped brochure scans: a misspelt label, a pasted resort photograph, a child's face in a corner, one shown sideways (#62). The legal pages are published drafts with about 27 bracketed placeholders (#81). The plot counts do not match the plans beside them (#83).
2. **The picture does not survive a close look on an ordinary monitor.** Jagged edges everywhere (#5), black palms beside lit trees (#12), pediments that are wedges with nothing behind them (#7), pink balusters and slab panelling in the hall (#34, #36).
3. **The first 13 seconds are a blank dark screen**, and on a slow connection the curtain lifts onto words with no picture (#1, #2).
4. **The film gives the three layouts the least time of anything in it** (#52).
5. **On a phone**, one stray tap leaves a column of chapter names lying across the film's text (#112), and the founder's portrait is cropped at the neck behind his own motto (#71).
6. **Logo-crossing text on every inner page** on the first scroll (#73).

**What is genuinely good**, so the scores below are read in proportion: the unbroken move from the garden through the door into the hall; the idea of the layouts as models on tables in a room you walk into; the display typography; the discipline of the inner pages' grid (every page on the same three edges at 100, 895 and 1820 px); navigation between pages (a 0.37 s dip, no flash); and, on tonight's build, all nine chapter links landing where they should.

---

# 2. Total findings

| Class | Count |
|---|---|
| CRITICAL | 2 |
| HIGH | 14 |
| MEDIUM | 44 |
| LOW | 41 |
| AI-SLOP | 9 |
| SYSTEMIC | 9 |
| **Total** | **119** |

By scope: 44 isolated, 36 repeated in several places, 39 systemic. 22 findings carry a note: a decision of the client that they touch, something only he can supply, or where an element came from.

Each finding has one class. A finding classed AI-SLOP or SYSTEMIC also has a seriousness, which is stated in its "Why it matters".

---

# 3. Top 20 most important problems

| # | Issue | Where | Impact | Recommended fix |
|---|---|---|---|---|
| 1 | #62 The three plans are cropped, marked-up brochure scans | /projects, /gallery, layout pages, article | Destroys the site's central claim ("the plan is the proof") for buyer and jury alike | Clean, whole, upright originals from the client at print resolution |
| 2 | #81 Legal pages are live drafts with placeholders | /privacy, /terms, /refund-policy | Disqualifying for a buyer; reads as an unfinished template | Final text from the client's lawyers, or withhold the pages |
| 3 | #1 12–17 s of blank dark screen on every first visit | All pages, through the link | The whole first impression is an empty screen | A still under the curtain within 2 s; text pages should not wait for 3D |
| 4 | #2 Curtain lifts onto words with no picture on slow lines | Film and hall pages at 8 Mbit/s | The most broken-looking state, shown to the weakest connections | Hold the curtain for the first picture, or start from a still |
| 5 | #5 No edge smoothing on any 3D frame | Film and every opening picture | Jagged, crawling balustrades on the client's own monitor | Turn on multisampling or add a smoothing pass |
| 6 | #112 One tap leaves chapter names over the film's text | Every page on a phone | A second column of text across the copy on the main device | Shrink the touch area; close names on scroll |
| 7 | #52 The three layouts get the least reading time | Film, 64–76% | The product cannot be read at a normal scroll | Lengthen the tables' word windows (not the camera) |
| 8 | #73 Text scrolls through the logo | Every inner page, first scroll | The most visible layout fault in the reading pages | Fade the cue before the header |
| 9 | #83 Plot counts disagree with the plans | Film, /projects, layout pages | Undermines "counted in full" | Reconcile with the client's register |
| 10 | #36 Wainscot is flat floating slabs with light bleed | Hall, behind all three tables | The background of the product looks unfinished | Framed panelling, evenly lit, one timber |
| 11 | #34 Balusters and capitals are pink | Hall, 67–79% | The room's loudest colour error | Ivory or white plaster |
| 12 | #12 Palms are black cut-outs beside lit trees | Film, 11–20% | The clearest "pasted in" tell outdoors | Light the palms with the scene |
| 13 | #7 Pediments are wedges with open backs | Film, 0%, 17%, 42% | The house reads as a stage flat | Close the pediments' sides and backs |
| 14 | #46 Handrail crosses the founder's nameplate | Film, 80–84%; phone | Against the client's own request for the plate | Raise with the client; adjust rail or height |
| 15 | #35 Frieze of floating six-pointed stars | Hall and eight pages' pictures | Generated-looking ornament behind the portrait | A plain frieze or a real moulding |
| 16 | #84 "This, not that" 37 times; site talks about itself | All inner pages | Recognisable machine-copy voice | Keep the best few; say the rest plainly |
| 17 | #58 and #91 Two footers; pages with up to four names | Site-wide | The site contradicts itself on every page | One footer, one name per page |
| 18 | #53 Headline numbers read "4o7" | Film count, /about, /projects, layout pages | The site's key statistics look like a font error | Lining figures for display numbers |
| 19 | #66 28 pages on about ten pictures; portrait on legal and 404 pages | All inner pages | Site feels smaller; wrong picture for the subject | A picture per subject |
| 20 | #82 A personal Gmail as Data Protection Officer | /privacy, /cookie-policy | A placeholder gone live | The company's own contact |

---

# 4. All findings

Each finding is numbered once and keeps its number throughout this report. Evidence files are in [ev/](ev/).


## A. First visit and loading

### ISSUE #1 — The loading curtain (dark ground, the words "Quality Homes Reality" at abou…

**Severity:** HIGH

**Location:** Every page, first visit. Film (/) and inner pages, through the public link, 1920×945.

**Element:** The loading curtain (dark ground, the words "Quality Homes Reality" at about 10 px and 62% strength, a 112 px hairline).

**Observation:** A first-time visitor looks at a near-black screen for 12 to 17 seconds before anything of the site is shown. Measured through the link tonight: film 13.5 s, /why-us 11–14 s, /hall 14–17 s. On this machine with no network in the way it is 6.8 s for the film and 3.6–7.2 s for inner pages.

**Visual evidence:** Frames at 0.3, 0.8, 1.5, 2.5, 4, 6, 8 and 10 s are identical dark frames (mean brightness 18 of 255); the first picture is in the 12.5 s frame. The link runs over this machine's own line, but the wait is not the link's doing: at a simulated 20 Mbit/s with no link in the way the film's curtain still takes 12.7 s.

**Why it matters:** The first quarter-minute is the whole judgment for a jury member and for a buyer on a phone. The curtain itself carries no picture, no mark and no sense of progress beyond a hairline most people will not notice, so it reads as a site that has not loaded.

**Expected behavior/design:** Something of the site within two seconds: a still of the house under the curtain, or the page's words first with the picture arriving behind them. Text pages (legal, FAQ, sitemap, 404) should not wait on a 3D scene at all.

**Likely scope:** systemic

**Related issues:** #2, #3, #4

**Note:** The wait is the download: the two models are 15.1 MB (estate) and 25.9 MB (hall). Lighter models or a first still are engineering choices, not design changes.

**Evidence files:** [01-link-first-13-seconds.jpg](ev/01-link-first-13-seconds.jpg), [02-link-inner-pages-timed.jpg](ev/02-link-inner-pages-timed.jpg)

### ISSUE #2 — The moment the curtain lifts

**Severity:** HIGH

**Location:** Film (/), first visit on a slow connection (simulated 8 Mbit/s, 80 ms latency, 1920×945).

**Element:** The moment the curtain lifts.

**Observation:** The curtain has a 12-second ceiling and lifts whether or not the house has arrived. At 8 Mbit/s it lifts onto the headline, the supporting lines, the header and the chapter dots standing on an empty black frame. The house appears several seconds later.

**Visual evidence:** Frames at 15 s and 18 s: headline and copy on black, mean brightness 13.6 and 13.8; a small hairline alone in the middle of the frame. The frame taken at about 22 s has the house (brightness 104). At 20 Mbit/s the picture is present when the curtain lifts (12.7 s). An inner page that stands in the hall is worse: /about at 8 Mbit/s holds its words behind the curtain for about 14 s, then shows the title on an empty dark frame from 17 s until the portrait arrives between 34 s and 42 s.

**Why it matters:** Words about land floating on black, with a dotted rail and no picture, is the single most "broken" state the site can show, and it is shown to exactly the visitors with the weakest connections (mobile data in the districts the site is about).

**Expected behavior/design:** The curtain should hold until the first picture is ready, or the first frame should be a still photograph of the cover that the live scene replaces.

**Likely scope:** systemic

**Related issues:** #1

**Note:** This morning's build showed this state through the link for about 27 seconds and an empty hall for 30; tonight's build (live since 22:04) no longer does at the link's present speed. The ceiling that causes it is unchanged.

**Evidence files:** [04-slow-line-8mbit-curtain-lifts-on-empty-frame.jpg](ev/04-slow-line-8mbit-curtain-lifts-on-empty-frame.jpg), [05-slow-line-8mbit-about-page-words-without-picture.jpg](ev/05-slow-line-8mbit-about-page-words-without-picture.jpg)

### ISSUE #3 — The cut to a chapter whose room has not finished arriving

**Severity:** MEDIUM

**Location:** Film (/), a press on a hall chapter's dot (tested: "Lucky Garden") immediately after the curtain lifts, through the link.

**Element:** The cut to a chapter whose room has not finished arriving.

**Observation:** The frame goes dark and stays dark for 12 to 16 seconds, showing the table's name, two small lines and a hairline, before the table appears.

**Visual evidence:** Twelve timed frames: dark from 0.7 s to 12 s (brightness 12), table present at 16 s (brightness 66). The hairline shows from 2.0 s.

**Why it matters:** The wait is honest but long, and the frame it waits on is nearly empty. The chapter names stay printed down the right edge for the whole wait because the pointer is resting where it pressed.

**Expected behavior/design:** Hold the previous picture (or a still of the destination) under the name instead of black; keep the wait under about five seconds by loading the hall's tables first.

**Likely scope:** isolated

**Related issues:** #1

**Evidence files:** [03-link-press-chapter-dot-wait.jpg](ev/03-link-press-chapter-dot-wait.jpg)

### ISSUE #4 — The "page not found" page

**Severity:** MEDIUM

**Location:** Any address that does not exist (tested /no-such-page), every screen size.

**Element:** The "page not found" page.

**Observation:** The page answers with the correct 404 status but shows the "Loading the scene" curtain for about five seconds before telling the visitor the page is not there. Its browser-tab title is empty.

**Visual evidence:** Frames at 1.2 s and 3.4 s are the curtain; the "That page isn't here." page is up at 6 s. The document title reads as an empty string at every size.

**Why it matters:** A visitor who followed a dead link waits for a 3D scene to load in order to be told there is nothing here; the empty tab title looks like an unfinished template.

**Expected behavior/design:** The message at once, with the picture arriving behind it; a title such as "Page not found — Quality Homes Reality".

**Likely scope:** isolated

**Related issues:** #1, #95

**Evidence files:** [41-404-loader-then-page.jpg](ev/41-404-loader-then-page.jpg)

## B. The film, outside the house

### ISSUE #5 — Every thin edge in the 3D picture

**Severity:** SYSTEMIC

**Location:** Film (/), every exterior and hall frame, and the picture at the top of every inner page. Worst on a 1920×1080 screen at 100% scaling.

**Element:** Every thin edge in the 3D picture: balusters, cornices, glazing bars, the compound wall's top, plaque edges.

**Observation:** The picture is drawn with no edge smoothing. Thin features break into stair-steps and dotted lines, and they crawl as the camera moves.

**Visual evidence:** Cover zoom: every baluster on the roof and terrace is a column of square steps. Revolve zoom: the cornice and the compound wall's top edge are dashed white lines. The post-processing chain is set to zero multisampling (PostFX.tsx line 177), so the canvas's own anti-aliasing never reaches the final frame.

**Why it matters:** Jagged, shimmering edges are the first thing that separates a real-time scene from a rendered film, and they sit on the house's most repeated detail. On the client's own 1920×1080 monitor it is at its worst; phones at 2× and 3× hide most of it.

**Expected behavior/design:** Smoothed edges at 1× screens (multisampling on the composer or a final SMAA pass), checked on the integrated graphics card for cost.

**Likely scope:** systemic

**Related issues:** #8, #29, #19, #48

**Evidence files:** [11-cover-zoom-roof-facade.jpg](ev/11-cover-zoom-roof-facade.jpg), [14-revolve-zoom-pediment-black-palms.jpg](ev/14-revolve-zoom-pediment-black-palms.jpg)

### ISSUE #6 — The sky behind the headline

**Severity:** MEDIUM

**Location:** Film (/), cover, 0% of the scroll, the upper third of the frame.

**Element:** The sky behind the headline.

**Observation:** The opening frame's sky is a flat grey-brown overcast with almost no colour, darkened further by the band under the header. The film's best skies come later; the frame everyone sees first has its dullest.

**Visual evidence:** Mean colour of the sky's upper band: RGB 109, 104, 97, saturation 0.11 (0.04 at 11% of the scroll). The brightest and most saturated thing in the frame is the house wall.

**Why it matters:** The cover is the screenshot that gets shared and judged. Its sky reads as a murky ground for type instead of a place.

**Expected behavior/design:** A cover sky with a readable light direction and some colour, while keeping the headline legible.

**Likely scope:** isolated

**Related issues:** #14

**Note:** The cover's camera angle and the type's position are approved; this is about the sky's grade only.

**Evidence files:** [10-cover-1920.jpg](ev/10-cover-1920.jpg)

### ISSUE #7 — The two triangular pediments above the roofline

**Severity:** HIGH

**Location:** Film (/), cover (0%), revolve (17%), approach (42%); both pediments.

**Element:** The two triangular pediments above the roofline.

**Observation:** From the camera's high angles the pediments are thin triangular slabs standing on the parapet with a lean-to board roof behind them. From behind, each is a ramp leaning on the balustrade with an open black slot under it.

**Visual evidence:** Revolve zoom: the pediment is a wedge with open sides. Approach zoom: both pediment backs are exposed, each with a black rectangular gap beneath.

**Why it matters:** A pediment is the front of a roof; here there is no roof behind it, and the film's own camera flies above and behind to show that. It makes the house read as a stage flat.

**Expected behavior/design:** Pediments with closed sides and a back that meets the roof, or camera heights that never see behind them.

**Likely scope:** repeated

**Related issues:** #10

**Note:** The flat roof is the client's own order (2026-10-01) and the cover's bird's-eye angle is in the storyboard; the fix is in how the pediments are closed, not in removing either.

**Evidence files:** [14-revolve-zoom-pediment-black-palms.jpg](ev/14-revolve-zoom-pediment-black-palms.jpg), [17-approach-zoom-roof-windows.jpg](ev/17-approach-zoom-roof-windows.jpg), [11-cover-zoom-roof-facade.jpg](ev/11-cover-zoom-roof-facade.jpg)

### ISSUE #8 — The raking edge of the side pediment

**Severity:** LOW

**Location:** Film (/), cover (0%), the side pediment at the roof's left.

**Element:** The raking edge of the side pediment.

**Observation:** A jet-black jagged line runs along the pediment's sloping edge where two surfaces meet.

**Visual evidence:** Cover zoom, top-left panel: a saw-toothed black seam along the slope, darker than any shadow in the frame.

**Why it matters:** A pure black line on a sunlit stone house reads as a modelling gap.

**Expected behavior/design:** A closed joint with a soft contact shadow.

**Likely scope:** isolated

**Related issues:** #5

**Evidence files:** [11-cover-zoom-roof-facade.jpg](ev/11-cover-zoom-roof-facade.jpg)

### ISSUE #9 — One bay of the roof balustrade

**Severity:** LOW

**Location:** Film (/), cover (0%), rear roof balustrade, left of centre.

**Element:** One bay of the roof balustrade.

**Observation:** One bay of the rear balustrade shows a dark irregular break where the balusters should continue.

**Visual evidence:** Cover zoom, top-left panel, about a third of the way along the rear rail.

**Why it matters:** A single broken bay in a repeated run is exactly the kind of detail a slow look finds.

**Expected behavior/design:** An unbroken run of balusters.

**Likely scope:** isolated

**Related issues:** none

**Evidence files:** [11-cover-zoom-roof-facade.jpg](ev/11-cover-zoom-roof-facade.jpg)

### ISSUE #10 — The flat roof deck

**Severity:** MEDIUM

**Location:** Film (/), cover (0%) and approach (38–44%).

**Element:** The flat roof deck.

**Observation:** The roof is a single flat dark-brown plane with faint parallel lines. At 42% of the scroll it fills about two fifths of the frame with nothing on it.

**Visual evidence:** Approach frame at 42.5%: the deck spans the frame's middle; the only features are the two exposed pediment backs.

**Why it matters:** The largest surface in the frame is the least detailed one.

**Expected behavior/design:** Either a deck with believable roof furniture (lead rolls that read at this distance, a roof light, gutters, access hatch) or a lower camera here.

**Likely scope:** repeated

**Related issues:** #7

**Note:** A fully flat roof is the client's order; this is about its surface, and about how long the camera looks down on it.

**Evidence files:** [17-approach-zoom-roof-windows.jpg](ev/17-approach-zoom-roof-windows.jpg), [70-film-desktop-walk-3.jpg](ev/70-film-desktop-walk-3.jpg)

### ISSUE #11 — The yellow "gold" details

**Severity:** AI-SLOP

**Location:** Film (/), cover (0%), approach (48%), door (53%).

**Element:** The yellow "gold" details: balls under the portico cornice's corners, bands round the tops of the columns, the roundel in the pediment, the finials.

**Observation:** Four different ornaments share one flat ochre-yellow with no reflection, and two of them (the balls under the cornice corners, the bands on plain columns) have no architectural reason to be there.

**Visual evidence:** Approach zoom: a yellow sphere sits under each end of the cornice. Door zoom: a flat yellow band wraps each plain column under a bowl-shaped capital.

**Why it matters:** Untextured yellow standing in for gilding, applied to objects that do not belong to the order of the building, is what generated decoration looks like. Gilding on a stone house is the cheapest-looking way to say "luxury".

**Expected behavior/design:** Remove the spheres and bands; if gilding stays, keep it to the roundel and finials with a real metal response.

**Likely scope:** repeated

**Related issues:** #32

**Evidence files:** [18-approach-zoom-pool-portico-lawn-car.jpg](ev/18-approach-zoom-pool-portico-lawn-car.jpg), [19-door-zoom.jpg](ev/19-door-zoom.jpg)

### ISSUE #12 — The palm trees

**Severity:** HIGH

**Location:** Film (/), revolve and sunset, 11–20% of the scroll; also phone and tablet.

**Element:** The palm trees.

**Observation:** The palms render as pure black silhouettes with hard, stair-stepped fronds and black trunks, standing on a sunlit lawn next to broadleaf trees that are fully lit.

**Visual evidence:** Revolve zoom, lower-left panel: four black palms beside a bright green tree, both in the same light. Tablet frame at 15.8%: the same.

**Why it matters:** Two kinds of tree under one sun, one lit and one black, tells the eye that two different asset sets were dropped into the scene. It is the clearest "pasted in" tell in the film.

**Expected behavior/design:** Palms lit by the same sun and sky as everything else, with translucent fronds against the light.

**Likely scope:** repeated

**Related issues:** #13

**Evidence files:** [14-revolve-zoom-pediment-black-palms.jpg](ev/14-revolve-zoom-pediment-black-palms.jpg), [66-tablet-film-header-band-white-sky.jpg](ev/66-tablet-film-header-band-white-sky.jpg)

### ISSUE #13 — The haze over the grounds

**Severity:** MEDIUM

**Location:** Film (/), cover (0%) and figures chapter (22–34%).

**Element:** The haze over the grounds.

**Observation:** Trees a little further off dissolve into a pale band of fog while palms only slightly nearer are solid black, and the white compound wall runs through both at full strength.

**Visual evidence:** Sunset frames at 22.7% and 29.7%: a mint-white fog swallows the far trees; the palm row in front of it has no haze on it at all.

**Why it matters:** Haze that does not fall off with distance looks like a fog card, not air.

**Expected behavior/design:** One atmosphere: everything loses contrast with distance at the same rate.

**Likely scope:** repeated

**Related issues:** #12

**Evidence files:** [15-sunset-three-frames.jpg](ev/15-sunset-three-frames.jpg), [10-cover-1920.jpg](ev/10-cover-1920.jpg)

### ISSUE #14 — The glow round the sun

**Severity:** MEDIUM

**Location:** Film (/), sunset, 17–40% of the scroll; strongest on a phone at 38–40%.

**Element:** The glow round the sun.

**Observation:** The sky round the sun is yellow-green instead of warm gold.

**Visual evidence:** Sampled glow colour: RGB 217, 199, 148 and 198, 179, 128, hue 44°, saturation 0.32–0.36. On the phone frames at 38–40% the upper sky reads chartreuse.

**Why it matters:** A green cast in a sunset is a grading error the eye notices before it can name it; it makes the stone look sickly.

**Expected behavior/design:** A sun glow between amber and rose, with the green taken out of the grade.

**Likely scope:** repeated

**Related issues:** #6

**Evidence files:** [15-sunset-three-frames.jpg](ev/15-sunset-three-frames.jpg), [71-film-phone-walk-2.jpg](ev/71-film-phone-walk-2.jpg)

### ISSUE #15 — The house's stone in shade

**Severity:** MEDIUM

**Location:** Film (/), revolve, 14–20% of the scroll.

**Element:** The house's stone in shade.

**Observation:** The shaded elevation turns a cold grey-green while the sunlit side stays warm ivory, so the house looks like two buildings joined at the corner.

**Visual evidence:** Revolve zoom, upper panels: the flank is grey-green; the pediment face beside it is cream.

**Why it matters:** Shade on limestone is warmer and bluer-grey, never green; the shift reads as a wrong material.

**Expected behavior/design:** Shaded stone that is the same stone, darker and slightly cooler.

**Likely scope:** repeated

**Related issues:** none

**Evidence files:** [14-revolve-zoom-pediment-black-palms.jpg](ev/14-revolve-zoom-pediment-black-palms.jpg)

### ISSUE #16 — The lawn

**Severity:** MEDIUM

**Location:** Film (/), cover (0%) and approach (48%).

**Element:** The lawn.

**Observation:** At distance the lawn is a smooth, untextured dark green with soft parallel shadow bands. Close up it is a blotchy low-resolution cloud pattern with no blades.

**Visual evidence:** Cover: flat green planes. Approach zoom, lower-left panel: soft green blotches.

**Why it matters:** Grass covers a third of most exterior frames; a plastic lawn sets the level for everything on it.

**Expected behavior/design:** Mown stripes or fine grass detail that holds at both distances.

**Likely scope:** repeated

**Related issues:** none

**Evidence files:** [10-cover-1920.jpg](ev/10-cover-1920.jpg), [18-approach-zoom-pool-portico-lawn-car.jpg](ev/18-approach-zoom-pool-portico-lawn-car.jpg)

### ISSUE #17 — The swimming pool's water

**Severity:** MEDIUM

**Location:** Film (/), cover (0%), figures (30%), approach (48%).

**Element:** The swimming pool's water.

**Observation:** The pool is three different things in three chapters: a flat grey-blue sheet with no reflection, then a saturated turquoise rectangle in a muted dusk scene, then a low-resolution noise texture with visible blocks.

**Visual evidence:** Sampled water colour: RGB 57, 82, 102 at the cover; 26, 36, 42 at 22.7%; 62, 78, 90 at 29.7%; 48, 62, 63 at 48%. Approach zoom: blocky pixels on the water's surface.

**Why it matters:** Water is where real-time scenes are judged; here it never reflects the house beside it and changes character between chapters.

**Expected behavior/design:** One water treatment that reflects sky and house and holds its colour relationship to the scene through the evening.

**Likely scope:** repeated

**Related issues:** none

**Evidence files:** [12-cover-zoom-car-pool-trees.jpg](ev/12-cover-zoom-car-pool-trees.jpg), [15-sunset-three-frames.jpg](ev/15-sunset-three-frames.jpg), [18-approach-zoom-pool-portico-lawn-car.jpg](ev/18-approach-zoom-pool-portico-lawn-car.jpg)

### ISSUE #18 — The small lights round the pool and along the drive

**Severity:** LOW

**Location:** Film (/), cover (0%), figures (22–34%), approach (48%).

**Element:** The small lights round the pool and along the drive.

**Observation:** The bollard lights glow in full daylight, and close up each is a pure white square.

**Visual evidence:** Cover zoom: lit bollards beside the pool at midday. Approach zoom: two white squares on the terrace.

**Why it matters:** Lights on at noon and lamps drawn as squares are small continuity errors that add up to "game level".

**Expected behavior/design:** Lights that come on with the evening and have a lamp shape and a soft glow.

**Likely scope:** repeated

**Related issues:** none

**Evidence files:** [12-cover-zoom-car-pool-trees.jpg](ev/12-cover-zoom-car-pool-trees.jpg), [18-approach-zoom-pool-portico-lawn-car.jpg](ev/18-approach-zoom-pool-portico-lawn-car.jpg)

### ISSUE #19 — The glass balustrade round the pool

**Severity:** LOW

**Location:** Film (/), cover (0%) and approach (48%), the pool terrace.

**Element:** The glass balustrade round the pool.

**Observation:** At the cover the rail is a dotted line; close up it is a row of black posts with nothing between them.

**Visual evidence:** Cover zoom, pool panel: a dashed line along the terrace edge. Approach zoom: posts only.

**Why it matters:** Glass that cannot be seen reads as a missing object.

**Expected behavior/design:** A visible top rail and a faint reflection in the panels.

**Likely scope:** isolated

**Related issues:** #5

**Evidence files:** [12-cover-zoom-car-pool-trees.jpg](ev/12-cover-zoom-car-pool-trees.jpg)

### ISSUE #20 — Sun loungers and parasols

**Severity:** MEDIUM

**Location:** Film (/), revolve, 11% of the scroll, the pool terrace.

**Element:** Sun loungers and parasols.

**Observation:** The loungers are boxy wedges and the parasols are flat grey discs on pins, each with a white dot at its centre.

**Visual evidence:** Revolve zoom, loungers panel.

**Why it matters:** Placeholder furniture beside a carefully moulded balustrade shows two levels of finish in one frame.

**Expected behavior/design:** Loungers with a frame and cushion, parasols with ribs and cloth, or none at all.

**Likely scope:** repeated

**Related issues:** none

**Evidence files:** [13-revolve-zoom-loungers-fringe.jpg](ev/13-revolve-zoom-loungers-fringe.jpg)

### ISSUE #21 — High-contrast edges

**Severity:** MEDIUM

**Location:** Film (/), all exterior frames, toward the frame's edges.

**Element:** High-contrast edges: columns, the car, the drive's kerb.

**Observation:** Magenta and teal fringes follow bright edges, strongest toward the corners.

**Visual evidence:** Revolve zoom, car panel: purple pixels along the column and the car's outline. Approach zoom: a teal line along the gravel's curve.

**Why it matters:** At this strength on an un-smoothed picture the fringe reads as a rendering fault, not as a lens.

**Expected behavior/design:** Remove it, or reduce it until it is invisible on a still.

**Likely scope:** systemic

**Related issues:** #5

**Note:** The effect was added on an earlier audit's request ("subtle chromatic aberration"); at 1× screens it is not subtle.

**Evidence files:** [13-revolve-zoom-loungers-fringe.jpg](ev/13-revolve-zoom-loungers-fringe.jpg), [18-approach-zoom-pool-portico-lawn-car.jpg](ev/18-approach-zoom-pool-portico-lawn-car.jpg)

### ISSUE #22 — The crimson shrubs along the terraces

**Severity:** LOW

**Location:** Film (/), cover (0%), revolve (11%), approach (48%).

**Element:** The crimson shrubs along the terraces.

**Observation:** The shrubs are near-black noisy blobs at the cover and saturated red at the revolve.

**Visual evidence:** Cover zoom, facade panel; approach zoom, pool panel.

**Why it matters:** Planting that changes from black to red between chapters looks unconsidered.

**Expected behavior/design:** One planting colour that holds through the light.

**Likely scope:** repeated

**Related issues:** none

**Evidence files:** [11-cover-zoom-roof-facade.jpg](ev/11-cover-zoom-roof-facade.jpg), [18-approach-zoom-pool-portico-lawn-car.jpg](ev/18-approach-zoom-pool-portico-lawn-car.jpg)

### ISSUE #23 — Wall lanterns

**Severity:** LOW

**Location:** Film (/), cover (0%), first-floor wall beside the windows.

**Element:** Wall lanterns.

**Observation:** The lanterns read as small black specks on the stone.

**Visual evidence:** Cover zoom, roof-right panel, between the first-floor windows.

**Why it matters:** Unreadable objects look like dirt on the picture.

**Expected behavior/design:** Lanterns large enough to read, or removed at this distance.

**Likely scope:** isolated

**Related issues:** none

**Evidence files:** [11-cover-zoom-roof-facade.jpg](ev/11-cover-zoom-roof-facade.jpg)

### ISSUE #24 — One first-floor window

**Severity:** MEDIUM

**Location:** Film (/), approach, 42% of the scroll, first floor of the flank.

**Element:** One first-floor window.

**Observation:** One window is filled edge to edge with a flat corrugated grey sheet while its neighbours are black voids.

**Visual evidence:** Approach zoom, flank-windows panel: the third window from the left.

**Why it matters:** One odd window in a row of identical ones is a classic generated-facade tell.

**Expected behavior/design:** Consistent glazing: every window either shows a dim room or a curtain with folds and a gap.

**Likely scope:** isolated

**Related issues:** none

**Evidence files:** [17-approach-zoom-roof-windows.jpg](ev/17-approach-zoom-roof-windows.jpg)

### ISSUE #25 — The portico's entablature, steps and the wall to its right

**Severity:** MEDIUM

**Location:** Film (/), approach, 48% of the scroll, the portico.

**Element:** The portico's entablature, steps and the wall to its right.

**Observation:** Streaky horizontal bands run across the entablature and the steps; the wall's edge to the right of the portico is a zipper of jagged steps; black dots stipple the column bases.

**Visual evidence:** Approach zoom, portico panel.

**Why it matters:** This is the frame held longest before the door, under the line "The door is open."

**Expected behavior/design:** Clean stone courses and a straight wall edge.

**Likely scope:** isolated

**Related issues:** none

**Evidence files:** [18-approach-zoom-pool-portico-lawn-car.jpg](ev/18-approach-zoom-pool-portico-lawn-car.jpg)

### ISSUE #26 — The saloon car

**Severity:** LOW

**Location:** Film (/), approach, 48% of the scroll, the forecourt.

**Element:** The saloon car.

**Observation:** A dotted line of orange sparkle runs along the car's sill, as if a row of small lights were set into it.

**Visual evidence:** Approach zoom, car panel.

**Why it matters:** A stray highlight on a hero prop.

**Expected behavior/design:** A continuous chrome strip.

**Likely scope:** isolated

**Related issues:** #70

**Evidence files:** [18-approach-zoom-pool-portico-lawn-car.jpg](ev/18-approach-zoom-pool-portico-lawn-car.jpg)

### ISSUE #27 — The fountain basin and the parterre's water basins

**Severity:** LOW

**Location:** Film (/), approach (42%) and revolve (11%).

**Element:** The fountain basin and the parterre's water basins.

**Observation:** The fountain's water is a flat cream ellipse and the parterre basins are flat grey mirrors.

**Visual evidence:** Approach zoom, coupe-fountain panel.

**Why it matters:** More water that does not behave like water.

**Expected behavior/design:** Dark water with a reflection and a rim shadow.

**Likely scope:** repeated

**Related issues:** none

**Evidence files:** [17-approach-zoom-roof-windows.jpg](ev/17-approach-zoom-roof-windows.jpg)

### ISSUE #28 — The floating dust motes

**Severity:** LOW

**Location:** Film (/), exterior frames.

**Element:** The floating dust motes.

**Observation:** On a still the motes are scattered white specks over the car and the lawn.

**Visual evidence:** Approach zoom, coupe-fountain panel: white dots over the shadow.

**Why it matters:** Screenshots are how the site will be judged and shared; on them the motes look like sensor dust.

**Expected behavior/design:** Fewer, softer, or none outdoors.

**Likely scope:** systemic

**Related issues:** none

**Evidence files:** [17-approach-zoom-roof-windows.jpg](ev/17-approach-zoom-roof-windows.jpg)

### ISSUE #29 — The compound wall behind the trees

**Severity:** MEDIUM

**Location:** Film (/), cover (0%), revolve (11–20%).

**Element:** The compound wall behind the trees.

**Observation:** A featureless white wall runs dead straight across the frame behind the trees, with its top edge drawn as a dashed line.

**Visual evidence:** Cover: a pale band between the lawn and the fog. Revolve zoom: dashed white edge.

**Why it matters:** It is the brightest horizontal in several frames and has no detail at all.

**Expected behavior/design:** A wall with piers, a coping and some weather, or planting in front of it.

**Likely scope:** repeated

**Related issues:** #5

**Evidence files:** [10-cover-1920.jpg](ev/10-cover-1920.jpg), [14-revolve-zoom-pediment-black-palms.jpg](ev/14-revolve-zoom-pediment-black-palms.jpg)

### ISSUE #30 — A palm at the left edge, a parasol at the bottom right, a hedge at the right

**Severity:** LOW

**Location:** Film (/), cover (0%), the frame's edges.

**Element:** A palm at the left edge, a parasol at the bottom right, a hedge at the right.

**Observation:** Three objects are cut by the frame: a dark palm by the left edge, a parasol by the bottom edge, a box hedge by the right edge.

**Visual evidence:** The cover at 1920×945.

**Why it matters:** Objects half in the frame on a composed opening shot read as accidents.

**Expected behavior/design:** Either in or out.

**Likely scope:** isolated

**Related issues:** none

**Evidence files:** [10-cover-1920.jpg](ev/10-cover-1920.jpg)

### ISSUE #31 — The supporting paragraph and the "Start here" cue

**Severity:** MEDIUM

**Location:** Film (/), cover (0%), lower-left of the frame.

**Element:** The supporting paragraph and the "Start here" cue.

**Observation:** The paragraph's last line sits exactly on the pool terrace's rail, and "Start here" stands on the terrace paving among the lit bollards.

**Visual evidence:** The cover at 1920×945: "Every sanctioned plan published in full." touches the rail line; the cue's hairline runs down into the terrace.

**Why it matters:** Type that just touches an object looks unplaced; type should clear a line or sit clearly across it.

**Expected behavior/design:** The paragraph a line higher, clear of the rail; the cue on plain ground.

**Likely scope:** isolated

**Related issues:** none

**Evidence files:** [10-cover-1920.jpg](ev/10-cover-1920.jpg), [12-cover-zoom-car-pool-trees.jpg](ev/12-cover-zoom-car-pool-trees.jpg)

## C. The film, at the door and inside the hall

### ISSUE #32 — The portico columns' capitals, the stone beside the door, the door handle

**Severity:** MEDIUM

**Location:** Film (/), the doorway, 53% of the scroll, both columns beside the door.

**Element:** The portico columns' capitals, the stone beside the door, the door handle.

**Observation:** Each capital is a plain turned bowl with a thin square plate set diagonally on top, one corner pointing at the camera. The stone of the arch and soffit carries a woven, cloth-like texture at this range. The door handle is a plain brass block.

**Visual evidence:** Door zoom: bowl capital with a yellow band under it; crosshatched stone on the arch; a rectangular handle.

**Why it matters:** This is the closest the camera ever comes to the house, and it is where the classical detail runs out.

**Expected behavior/design:** A proper capital (Tuscan or Ionic to match the house), stone that reads as stone at arm's length, a turned handle.

**Likely scope:** isolated

**Related issues:** #11

**Evidence files:** [19-door-zoom.jpg](ev/19-door-zoom.jpg)

### ISSUE #33 — The founder's portrait as the camera comes through the door

**Severity:** MEDIUM

**Location:** Film (/), first frame inside the hall, 57.5% of the scroll, top centre.

**Element:** The founder's portrait as the camera comes through the door.

**Observation:** The first thing inside is the lower half of the founder's portrait, cut by the top of the frame, out of focus, under the header's dark band.

**Visual evidence:** Hall first-frame zoom, top-left panel: the face cropped at the eyes.

**Why it matters:** The portrait is the room's centrepiece and the client is particular about it; its first appearance is a blurred half.

**Expected behavior/design:** A first frame that holds the portrait whole, or does not show it until it can.

**Likely scope:** isolated

**Related issues:** #46

**Note:** The camera's path is the client's approved one and is not to be re-cut on an audit's word; raise this with him before touching it.

**Evidence files:** [20-hall-first-frame-zoom.jpg](ev/20-hall-first-frame-zoom.jpg)

### ISSUE #34 — The stair's balusters, their square plinths, and the column capitals

**Severity:** HIGH

**Location:** Film (/), the hall, most visible 67–79% of the scroll; every inner page whose picture shows the stair.

**Element:** The stair's balusters, their square plinths, and the column capitals.

**Observation:** The balusters, plinths and capitals render pink beside ivory walls.

**Visual evidence:** Lit baluster faces average RGB 210, 194, 179 (red 17 above green); the wall beside them is 232, 228, 217 (red 4 above green). Stair zoom: rows of pink balusters on pink cubes.

**Why it matters:** Pink plaster in an "ivory, old money" room is the hall's loudest colour error, and the camera passes within a metre of it twice.

**Expected behavior/design:** Balusters in the wall's own ivory or in painted white, with the same warmth as the walls.

**Likely scope:** systemic

**Related issues:** #35

**Note:** The hall's brightness is the client's order; this is about the tint of three materials, not the light level.

**Evidence files:** [24-stair-pan-zoom.jpg](ev/24-stair-pan-zoom.jpg), [20-hall-first-frame-zoom.jpg](ev/20-hall-first-frame-zoom.jpg)

### ISSUE #35 — The frieze under the cornice

**Severity:** AI-SLOP

**Location:** Film (/), the hall, 58–62% and 80–84% of the scroll; the opening pictures of /about and of the seven pages that open on the portrait above the stair.

**Element:** The frieze under the cornice.

**Observation:** The frieze is a row of six-pointed stars, pink-mauve, standing off the wall with a shadow under each.

**Visual evidence:** Frieze zoom: evenly spaced star cut-outs on both walls; on the portrait frame the "Who we are" link sits directly on them.

**Why it matters:** A classical frieze carries triglyphs, swags, a key or a running moulding. A band of floating stars belongs to no order of architecture and reads as an ornament generated to fill a strip. It is in the background of the founder's portrait.

**Expected behavior/design:** A plain frieze or a real running ornament in the wall's own colour.

**Likely scope:** systemic

**Related issues:** #34

**Evidence files:** [21-hall-frieze-stars-lamp-nameplate.jpg](ev/21-hall-frieze-stars-lamp-nameplate.jpg), [25-portrait-nameplate-lamp-zoom.jpg](ev/25-portrait-nameplate-lamp-zoom.jpg)

### ISSUE #36 — The dark wood panels along the lower walls

**Severity:** HIGH

**Location:** Film (/), the hall, every table (64–76%); the opening pictures of /projects, /properties, /gallery, /careers and the three layout pages.

**Element:** The dark wood panels along the lower walls.

**Observation:** The wainscot is a set of flat dark slabs fixed proud of the wall with no frame, rail or moulding, hanging above the skirting with a gap. Several are half washed pale grey and half black where the baked light bleeds across them; the one behind the first table has a horizontal crease; they read red-mahogany at the third table and brown elsewhere.

**Visual evidence:** Hall first-frame zoom, lower-left panel: a slab split pale and black. Stair zoom, lower-right panel: a slab floating above the skirting. Tablet /gallery: one slab fills the left quarter of the frame as a flat brown rectangle.

**Why it matters:** These panels are the background of all three layout tables, which is to say of the product.

**Expected behavior/design:** Framed panelling with stiles, rails and a dado, lit evenly, in one timber.

**Likely scope:** systemic

**Related issues:** #37

**Note:** An earlier audit's walnut wainscot was removed with its dark room at the client's word; what is on screen now is what remains, and it is unfinished.

**Evidence files:** [20-hall-first-frame-zoom.jpg](ev/20-hall-first-frame-zoom.jpg), [24-stair-pan-zoom.jpg](ev/24-stair-pan-zoom.jpg), [68-tablet-gallery-plate.jpg](ev/68-tablet-gallery-plate.jpg)

### ISSUE #37 — The wood grain on the wainscot, the model boards and the tables

**Severity:** AI-SLOP

**Location:** Film (/), the hall's tables (64–76%), and the layout pages' opening pictures.

**Element:** The wood grain on the wainscot, the model boards and the tables.

**Observation:** One procedural grain at one scale is used on a three-metre wall panel, a 60 cm board and a table top, so the grain is cartoon-large on the small objects.

**Visual evidence:** Table 3 zoom: the same looping cathedral grain on the panel behind and on the board.

**Why it matters:** Repeated texture at the wrong scale is a standard marker of generated material.

**Expected behavior/design:** Grain scaled to each object, with the boards in a finer veneer than the wall.

**Likely scope:** systemic

**Related issues:** #36, #39

**Evidence files:** [23-table3-zoom.jpg](ev/23-table3-zoom.jpg), [22-table2-zoom.jpg](ev/22-table2-zoom.jpg)

### ISSUE #38 — The round table's rim and pedestal

**Severity:** LOW

**Location:** Film (/), the three tables (66%, 70%, 74%).

**Element:** The round table's rim and pedestal.

**Observation:** The rim is visibly faceted and the turned pedestal has flat sides.

**Visual evidence:** Table 3 zoom, bottom panel.

**Why it matters:** Round things that are not round are noticed at the size the tables are shown.

**Expected behavior/design:** Smooth rims and turnings.

**Likely scope:** repeated

**Related issues:** none

**Evidence files:** [23-table3-zoom.jpg](ev/23-table3-zoom.jpg)

### ISSUE #39 — The three model boards

**Severity:** MEDIUM

**Location:** Film (/), tables 1, 2 and 3 (66%, 70%, 74%).

**Element:** The three model boards.

**Observation:** Three boards of the same design are three different woods: warm brown, near-black espresso, orange-brown.

**Visual evidence:** Desktop walk sheets 4 and 5; phone key frames.

**Why it matters:** The three tables are meant to be one set; they look like three props from different sources.

**Expected behavior/design:** One timber and one finish for all three.

**Likely scope:** repeated

**Related issues:** #37

**Evidence files:** [70-film-desktop-walk-5.jpg](ev/70-film-desktop-walk-5.jpg), [61-phone-film-key-frames.jpg](ev/61-phone-film-key-frames.jpg)

### ISSUE #40 — The Lucky Garden site model

**Severity:** MEDIUM

**Location:** Film (/), table 2 (70%); /projects/lucky-garden opening picture.

**Element:** The Lucky Garden site model.

**Observation:** Half the model is one blank pale slab, and the plots carry pastel tints with nothing to explain them.

**Visual evidence:** Table 2 zoom, model panel.

**Why it matters:** The model's largest feature is a blank. The tints come from the source sheet, which itself prints no key.

**Expected behavior/design:** The "future extension" shown as open ground in the board's own flock, and plots in one colour unless a key is on the plaque.

**Likely scope:** isolated

**Related issues:** #62

**Evidence files:** [22-table2-zoom.jpg](ev/22-table2-zoom.jpg)

### ISSUE #41 — The VSR Gayatri Township site model

**Severity:** AI-SLOP

**Location:** Film (/), table 3 (74%); /projects/vsr-gayatri-township opening picture.

**Element:** The VSR Gayatri Township site model.

**Observation:** The green open-space block has a plus-shaped hole in it, and the white strips round the plots have lumpy, beaded edges.

**Visual evidence:** Table 3 zoom, model panel: a cross cut out of the green; bead-like bumps along the strips.

**Why it matters:** Both are the marks of a drawing traced automatically (a symbol and a row of tree icons read as geometry), which is what "procedurally imperfect" looks like.

**Expected behavior/design:** Clean blocks: a whole green, straight verges.

**Likely scope:** isolated

**Related issues:** #62

**Evidence files:** [23-table3-zoom.jpg](ev/23-table3-zoom.jpg)

### ISSUE #42 — The shading behind the table's name

**Severity:** MEDIUM

**Location:** Film (/), table 2, 70% of the scroll, the frame's left third.

**Element:** The shading behind the table's name.

**Observation:** The left third of the frame is near black and the wall behind the model is a muddy grey, not ivory.

**Visual evidence:** Table 2 frame at 70%; the frame after a chapter press shows the same.

**Why it matters:** The client has sent back dark rooms three times; this is the darkest of the three tables.

**Expected behavior/design:** Enough shade for the words and no more, falling off before the model.

**Likely scope:** repeated

**Related issues:** #55

**Note:** Client's standing order: the hall's rooms stay bright.

**Evidence files:** [22-table2-zoom.jpg](ev/22-table2-zoom.jpg), [03-link-press-chapter-dot-wait.jpg](ev/03-link-press-chapter-dot-wait.jpg)

### ISSUE #43 — The camera's passes along the stair

**Severity:** MEDIUM

**Location:** Film (/), between the tables and the portrait, 67–69% and 75–79% of the scroll; phone at 76.6%.

**Element:** The camera's passes along the stair.

**Observation:** For several notches the frame is filled with out-of-focus balusters and blank wall; on a phone one frame is nothing but wall and a sconce.

**Visual evidence:** Stair zoom; phone key frames, fourth frame.

**Why it matters:** These are the frames between the product's three moments, and they show the hall's weakest surfaces closest.

**Expected behavior/design:** Passes that keep a subject in frame.

**Likely scope:** repeated

**Related issues:** #52

**Note:** The camera path is client-approved; an observation for him, not an instruction to re-cut.

**Evidence files:** [24-stair-pan-zoom.jpg](ev/24-stair-pan-zoom.jpg), [61-phone-film-key-frames.jpg](ev/61-phone-film-key-frames.jpg)

### ISSUE #44 — The stair's outer stringer

**Severity:** MEDIUM

**Location:** Film (/), the stair pan, 67% of the scroll, centre-left.

**Element:** The stair's outer stringer.

**Observation:** A black wedge-shaped gap opens at every step between the stringer and the treads, and the baluster plinths stand on a soft, swollen cap.

**Visual evidence:** Stair zoom, upper-left panel.

**Why it matters:** Gaps you can see through in a stone stair are modelling holes.

**Expected behavior/design:** A closed stringer with a crisp cap.

**Likely scope:** isolated

**Related issues:** none

**Evidence files:** [24-stair-pan-zoom.jpg](ev/24-stair-pan-zoom.jpg)

### ISSUE #45 — The wall sconces' flames

**Severity:** LOW

**Location:** Film (/), the hall (67–77%).

**Element:** The wall sconces' flames.

**Observation:** The flames are pale blue-white while the light they throw on the wall is warm.

**Visual evidence:** Stair zoom, sconce panel.

**Why it matters:** A lamp and its light in different colours.

**Expected behavior/design:** Warm flames.

**Likely scope:** repeated

**Related issues:** #47

**Evidence files:** [24-stair-pan-zoom.jpg](ev/24-stair-pan-zoom.jpg)

### ISSUE #46 — The founder's nameplate under the portrait

**Severity:** HIGH

**Location:** Film (/), the portrait, 80–84% of the scroll, lower centre; phone at 82–84%.

**Element:** The founder's nameplate under the portrait.

**Observation:** The stair's handrail crosses the nameplate. "K. BHASKARA RAO" is cut by the rail, and the line under it (his title) is hidden. On a phone the plate is dark behind the rail and becomes readable only as the chapter's words are fading.

**Visual evidence:** Portrait zoom, nameplate panel: the rail runs through the plate's lower half. Phone walk sheet 3, frames 112–116.

**Why it matters:** The client's own note on this plate was that it must be easy to read and "must create respect". At the film's portrait moment it is half covered.

**Expected behavior/design:** A camera height or rail position at which the whole plate is clear while the chapter's words are up.

**Likely scope:** repeated

**Related issues:** #33, #71

**Note:** The portrait, its lamp and lens are "fine, don't touch" by the client's word; the plate's legibility is his own request. Raise the conflict with him.

**Evidence files:** [25-portrait-nameplate-lamp-zoom.jpg](ev/25-portrait-nameplate-lamp-zoom.jpg), [71-film-phone-walk-3.jpg](ev/71-film-phone-walk-3.jpg)

### ISSUE #47 — The picture lamp and its light on the frame

**Severity:** MEDIUM

**Location:** Film (/), the portrait, 81% of the scroll, above the frame.

**Element:** The picture lamp and its light on the frame.

**Observation:** The lamp is a flat bar with a pale-blue glowing line, while the light on the picture is amber. The pool of light on the frame has stepped, polygonal edges.

**Visual evidence:** Portrait zoom, picture-lamp panel.

**Why it matters:** The lamp is in the centre of the film's most personal frame.

**Expected behavior/design:** A warm lamp with a soft, round fall of light.

**Likely scope:** isolated

**Related issues:** #45, #48

**Evidence files:** [25-portrait-nameplate-lamp-zoom.jpg](ev/25-portrait-nameplate-lamp-zoom.jpg)

### ISSUE #48 — The nameplate's gilt moulding and the wall panel to its right

**Severity:** LOW

**Location:** Film (/), the portrait, 81% of the scroll.

**Element:** The nameplate's gilt moulding and the wall panel to its right.

**Observation:** The plate's gilt edge is stair-stepped, and a row of dark dashes runs along the top inner edge of the wall panel at the right.

**Visual evidence:** Portrait zoom, nameplate and panel panels.

**Why it matters:** Small, but on the one object the client asked to be dignified.

**Expected behavior/design:** Smooth edges; no stray marks on the panel.

**Likely scope:** isolated

**Related issues:** #5

**Evidence files:** [25-portrait-nameplate-lamp-zoom.jpg](ev/25-portrait-nameplate-lamp-zoom.jpg)

### ISSUE #49 — The list of the three layouts beside the map table

**Severity:** MEDIUM

**Location:** Film (/), the map table, 87–90% of the scroll, left half.

**Element:** The list of the three layouts beside the map table.

**Observation:** The list's lines run across the stair's saw-tooth outline, the map's pins carry no labels, the table's rim highlight is a dotted line, and the frame's corners are black.

**Visual evidence:** Map zoom, list and table panels.

**Why it matters:** The closing statement of the film sits on a busy edge, and the map it points at cannot be read.

**Expected behavior/design:** The list on plain ground; pins that can be told apart.

**Likely scope:** isolated

**Related issues:** none

**Evidence files:** [26-map-table-zoom.jpg](ev/26-map-table-zoom.jpg)

### ISSUE #50 — The stair carpet and the entrance rug

**Severity:** LOW

**Location:** Film (/), the hall's first frames (57–60%) and stair passes.

**Element:** The stair carpet and the entrance rug.

**Observation:** A saturated navy stair carpet stands against a red entrance rug in an ivory room.

**Visual evidence:** Hall first-frame zoom; /projects opening picture.

**Why it matters:** Two saturated carpets fight the "ivory, old money" brief.

**Expected behavior/design:** One carpet colour, deeper and less saturated.

**Likely scope:** repeated

**Related issues:** none

**Evidence files:** [20-hall-first-frame-zoom.jpg](ev/20-hall-first-frame-zoom.jpg), [32-all-opening-frames-desktop.jpg](ev/32-all-opening-frames-desktop.jpg)

### ISSUE #51 — The arched windows high on the walls

**Severity:** LOW

**Location:** Film (/), the hall's first frames (58–60%).

**Element:** The arched windows high on the walls.

**Observation:** The panes are flat slate-blue cards with no depth, glazing reflection or view.

**Visual evidence:** Desktop walk sheet 4, frames 41–42.

**Why it matters:** Windows are where a room meets the world outside it; here they are stickers.

**Expected behavior/design:** Glass with a faint sky and a reflection of the room's lamps.

**Likely scope:** repeated

**Related issues:** none

**Evidence files:** [70-film-desktop-walk-4.jpg](ev/70-film-desktop-walk-4.jpg)

## D. The film's words, pacing and controls

### ISSUE #52 — How long each chapter's words stay whole

**Severity:** HIGH

**Location:** Film (/), the whole scroll, every screen size (measured at one wheel notch, a third of the screen, per step).

**Element:** How long each chapter's words stay whole.

**Observation:** The three layouts get the least reading time in the film. The first and second tables' names are whole for one notch each; the third table's name is never whole at any sampled notch (0.81 at most on a desktop, 0.58 on a tablet, 0.93 on a phone). The count ("344 / 407 / 3") holds for nine notches and the closing footer for nine.

**Visual evidence:** Per-notch record at 1920×945: cover 4, "We do not broker land" 3, the count 9, the door 5, "Each layout stands on its own table" 1, table 1: 1, table 2: 1, table 3: 0, portrait 2, map 3, footer 9. The same pattern at 1366×657, 820×1180 and on the phone.

**Why it matters:** A buyer scrolling at an ordinary pace cannot read the name, place and count of the layouts the site exists to sell.

**Expected behavior/design:** Longer windows for the three tables' words. This is a change to when the words fade, not to the camera.

**Likely scope:** systemic

**Related issues:** #43

**Note:** The client's rule is that the camera never stops or slows. The words' windows can be widened without touching it.

**Evidence files:** [70-film-desktop-walk-5.jpg](ev/70-film-desktop-walk-5.jpg), [71-film-phone-walk-2.jpg](ev/71-film-phone-walk-2.jpg)

### ISSUE #53 — The large figures

**Severity:** MEDIUM

**Location:** Film (/), the count, 22–34% of the scroll; /about, /projects and the three layout pages' first sections.

**Element:** The large figures: 344, 407, 3; 20, 5,000, 12, 8; 113, 113, 3, 40.

**Observation:** The display figures are set in old-style numerals, so the zero is the height of a small letter, the 3 and 4 hang below the line and the 6 and 8 rise above it. "407" reads as "4o7" and a row of four figures looks vertically misaligned.

**Visual evidence:** Figures zoom: "407" with a small round zero; "3", "407", "344", "6" on four different heights.

**Why it matters:** Old-style figures belong in running text. As stand-alone statistics at 120 px they look like a font error, and these are the site's headline numbers.

**Expected behavior/design:** Lining figures for display statistics and tables.

**Likely scope:** systemic

**Related issues:** #99

**Note:** This is set deliberately in the stylesheet; it is a choice to revisit, not a bug.

**Evidence files:** [16-old-style-figures.jpg](ev/16-old-style-figures.jpg)

### ISSUE #54 — The dark band under the header

**Severity:** MEDIUM

**Location:** Film (/), 15–17% of the scroll on a tablet (820×1180) and a phone; top of the frame.

**Element:** The dark band under the header.

**Observation:** Over a bright sky the band under the header ends in a visible edge: a dark grey strip across a near-white sky.

**Visual evidence:** Tablet frame at 15.8%: a grey band about a tenth of the frame deep over a bleached sky.

**Why it matters:** A shade that can be seen as a shape is a panel, which the site's own rules forbid.

**Expected behavior/design:** A band that follows the sky's brightness, or a sky that is not bleached under it.

**Likely scope:** repeated

**Related issues:** #55

**Evidence files:** [66-tablet-film-header-band-white-sky.jpg](ev/66-tablet-film-header-band-white-sky.jpg)

### ISSUE #55 — The shade behind the table's name on a phone

**Severity:** MEDIUM

**Location:** Film (/), tables 1 and 2 on a phone (66% and 71% of the scroll), about a quarter of the way down the frame.

**Element:** The shade behind the table's name on a phone.

**Observation:** The dark band behind the name ends in a hard horizontal line across the whole frame, with the bright wall directly under it.

**Visual evidence:** Phone key frames 2 and 3.

**Why it matters:** It reads as a dark box across the top of the picture.

**Expected behavior/design:** A soft fall-off over a longer distance.

**Likely scope:** repeated

**Related issues:** #54, #42

**Evidence files:** [61-phone-film-key-frames.jpg](ev/61-phone-film-key-frames.jpg)

### ISSUE #56 — The headline "The name on the sanction letters has been the same for twenty…

**Severity:** LOW

**Location:** Film (/), the portrait chapter, 81% of the scroll.

**Element:** The headline "The name on the sanction letters has been the same for twenty years."

**Observation:** The gilt half of the headline begins in the middle of the third line: "same" is ivory and "for twenty years." is gilt on the same line. Every other headline changes colour at a line break.

**Visual evidence:** Portrait frame at 81.5%.

**Why it matters:** The two-tone headline is the site's signature device; one of them breaks its own rule.

**Expected behavior/design:** The colour change at the line break.

**Likely scope:** isolated

**Related issues:** none

**Evidence files:** [70-film-desktop-walk-5.jpg](ev/70-film-desktop-walk-5.jpg)

### ISSUE #57 — The order of the count's parts

**Severity:** LOW

**Location:** Film (/), the count, 22–34% of the scroll, wide screens.

**Element:** The order of the count's parts.

**Observation:** On wide screens the three figures stand above the chapter's heading, with the explanation under it; on a phone and tablet the heading comes first.

**Visual evidence:** Sunset frames; tablet figures frame.

**Why it matters:** The same chapter reads in two orders on two devices.

**Expected behavior/design:** One order.

**Likely scope:** isolated

**Related issues:** none

**Evidence files:** [15-sunset-three-frames.jpg](ev/15-sunset-three-frames.jpg), [67-tablet-film-figures.jpg](ev/67-tablet-film-figures.jpg)

### ISSUE #58 — The closing footer

**Severity:** SYSTEMIC

**Location:** The foot of the film (/) against the foot of every other page.

**Element:** The closing footer.

**Observation:** The site has two different footers. The film's has a 134 px sign-off, office labels in tracked capitals, 13 px links and twelve page links in two rows with four legal links. Every other page's has a 63 px sign-off, office labels in small sentence-case gilt, 16 px links and eighteen page links in four titled columns with five legal links.

**Visual evidence:** Measured: sign-off 134.4 px against 63 px; "HEAD OFFICE" 10.75 px capitals in #F1D0A6 against "Head office" 16 px in #E8B98A; link text 13.44 px against 16 px; the film's footer has no link to the layouts, the offices, the hall, the enquiry page or the sitemap.

**Why it matters:** The footer is the one component every visitor sees on every page, and on the home page it is a different component.

**Expected behavior/design:** One footer, or the film's footer as an evident variation of the same one (same labels, same link set, same names).

**Likely scope:** systemic

**Related issues:** #91

**Note:** The film's last frame was composed for its twelve links; changing the set means re-checking that frame.

**Evidence files:** [27-footer-film-vs-inner.jpg](ev/27-footer-film-vs-inner.jpg)

### ISSUE #59 — The Vizianagaram office's address

**Severity:** LOW

**Location:** Every footer; /about, /branches, /contact.

**Element:** The Vizianagaram office's address.

**Observation:** The address breaks so that its last line is "– 535002" alone, beginning with the dash.

**Visual evidence:** Footer comparison, office panel; the same in the film's footer.

**Why it matters:** A line that starts with a dash is a small typesetting error repeated on every page.

**Expected behavior/design:** Keep the town and its PIN together; no dash before a PIN at a line start.

**Likely scope:** systemic

**Related issues:** #75

**Evidence files:** [27-footer-film-vs-inner.jpg](ev/27-footer-film-vs-inner.jpg)

### ISSUE #60 — The ampersand

**Severity:** LOW

**Location:** Every page's footer ("Privacy & data choices"); page titles; /locations; the legal pages.

**Element:** The ampersand.

**Observation:** The "&" is deliberately taken from a different font installed on the visitor's device (Georgia, Times New Roman, Noto Serif or another), so it is larger and heavier than the letters round it and differs from device to device.

**Visual evidence:** Footer zoom: an oversized swash "&" in a 13 px line. The stylesheet maps that one character to local fonts.

**Why it matters:** One character in another typeface is the definition of an accidental font substitution, even when it is on purpose.

**Expected behavior/design:** The typeface's own ampersand, or the word "and".

**Likely scope:** systemic

**Related issues:** none

**Evidence files:** [27-footer-film-vs-inner.jpg](ev/27-footer-film-vs-inner.jpg)

### ISSUE #61 — The ways to enquire offered on one screen

**Severity:** LOW

**Location:** The open menu, every page.

**Element:** The ways to enquire offered on one screen.

**Observation:** "Enquire" appears three times on the open menu: in the header, in the fourth column and in the row at the foot.

**Visual evidence:** Menu screenshot.

**Why it matters:** Repetition where a single clear action would do.

**Expected behavior/design:** Once.

**Likely scope:** isolated

**Related issues:** #102

**Evidence files:** [52-menu-open.jpg](ev/52-menu-open.jpg)

## E. The plans and the inner pages' pictures

### ISSUE #62 — The three layout plans, which the site calls "the sanctioned drawing" and s…

**Severity:** CRITICAL

**Location:** /projects, /gallery, /downloads, the three layout pages, the article on reading a plan. The three files in /gallery/.

**Element:** The three layout plans, which the site calls "the sanctioned drawing" and says are "published in full".

**Observation:** None of the three is a clean drawing. Lucky Garden's sheet prints "FUTURE EXTENTION" (misspelt), "ARIVIDI - VIZIANAGARAM" with the first letter cut off, a logo cut by the left edge, an aerial photograph of a resort pasted over the plan, and an area table cut by the bottom edge. Kartikeya's is a crop of a brochure page with part of a child's photograph in the bottom-left corner and cut-off caption text ("Set amidst tranquil surroundings,"). Gayatri's is shown turned on its side so every label reads vertically, with a road label cut mid-word, a stray red letter fragment at the right edge, "40' FEET WIDE ROAD", and the village spelt "Bayannapeta" where the site writes "Bayyannapeta".

**Visual evidence:** The source images are 1600 px wide JPEGs (1600×1557, 1600×948, 1600×1140) with visible sharpening halos. On /projects the child's face and the cut caption are on screen at the plan's corner.

**Why it matters:** The site's whole argument is that the plan is the proof. The proof is three cropped brochure scans with a spelling mistake, a pasted stock-style photograph and a stranger's child in the corner. This is the most damaging thing on the site for a buyer and for a jury.

**Expected behavior/design:** The actual sanctioned sheets, whole, upright, re-scanned or exported at print resolution, with nothing pasted over them.

**Likely scope:** systemic

**Related issues:** #63, #83, #40

**Note:** These are the client's supplied materials; the fix needs clean originals from him.

**Evidence files:** [39-project-page-kartikeya.jpg](ev/39-project-page-kartikeya.jpg), [40-article-reading-a-layout-plan.jpg](ev/40-article-reading-a-layout-plan.jpg), [57-rail-hover-forms-plan-hover.jpg](ev/57-rail-hover-forms-plan-hover.jpg)

### ISSUE #63 — The close-ups of the plans

**Severity:** HIGH

**Location:** /knowledge/reading-a-layout-plan, four figures.

**Element:** The close-ups of the plans.

**Observation:** The close-ups are the same 1600 px images enlarged 2.3 times. Road names and plot dimensions are smeared and blocky.

**Visual evidence:** Figure zoom: "40' WIDE ROAD" is soft, the dimension figures beside the plot numbers cannot be read.

**Why it matters:** The article says "the width is printed in each road" beside a picture in which it cannot be read.

**Expected behavior/design:** Close-ups cut from a high-resolution original.

**Likely scope:** repeated

**Related issues:** #62

**Evidence files:** [31-plan-detail-zoomed-2.3x.jpg](ev/31-plan-detail-zoomed-2.3x.jpg), [40-article-reading-a-layout-plan.jpg](ev/40-article-reading-a-layout-plan.jpg)

### ISSUE #64 — "Open at full size"

**Severity:** LOW

**Location:** /gallery, /projects, the three layout pages.

**Element:** "Open at full size".

**Observation:** The control opens the bare JPEG in a new browser tab, with no way back to the site, and the "full size" is the same 1600 px image already on the page. Its label is a square dark chip found nowhere else on the site.

**Visual evidence:** Link target: the image file itself, in a new tab.

**Why it matters:** "Full size" promises more than the page shows and delivers the same picture without the site round it.

**Expected behavior/design:** A viewer inside the page with zoom and pan over a high-resolution sheet.

**Likely scope:** repeated

**Related issues:** #62

**Evidence files:** [57-rail-hover-forms-plan-hover.jpg](ev/57-rail-hover-forms-plan-hover.jpg)

### ISSUE #65 — The three plan blocks

**Severity:** MEDIUM

**Location:** /gallery.

**Element:** The three plan blocks.

**Observation:** The same component is laid out two ways on one page: the first plan has its picture on the left and its lists on the right; the second and third have the picture full width with the lists underneath. The text column also starts one pixel further right in the second and third blocks (1027 px against 1026 px).

**Visual evidence:** Measured left edges; /gallery screens.

**Why it matters:** A component that changes shape with its content looks assembled, not designed.

**Expected behavior/design:** One layout for all three, with plan pictures cropped to a common proportion.

**Likely scope:** isolated

**Related issues:** none

**Evidence files:** [38-inner-reading-screens.jpg](ev/38-inner-reading-screens.jpg)

### ISSUE #66 — Which picture each page opens on

**Severity:** SYSTEMIC

**Location:** The opening picture of all 28 pages.

**Element:** Which picture each page opens on.

**Observation:** Seven pages open on the same view of the founder's portrait above the stair (the hall, privacy, terms, refunds, cookies, the sitemap and the 404 page). Four open on the same dome and chandelier (the guide, knowledge, the article, questions). Two share the map table, two the stair rail. Several pages then repeat their own opening picture as the band halfway down (/properties, /locations, /projects and the three layout pages).

**Visual evidence:** Montage of all 28 opening frames.

**Why it matters:** The founder's face over "If a purchase does not go ahead." and over "That page isn't here." is a mismatch of subject and picture. Twenty-eight pages drawing on about ten views makes the site feel smaller than it is.

**Expected behavior/design:** A picture chosen for each page's subject; no portrait on legal and error pages.

**Likely scope:** systemic

**Related issues:** #67

**Evidence files:** [32-all-opening-frames-desktop.jpg](ev/32-all-opening-frames-desktop.jpg), [33-all-opening-frames-phone.jpg](ev/33-all-opening-frames-phone.jpg)

### ISSUE #67 — The opening pictures

**Severity:** MEDIUM

**Location:** /careers, /gallery, /testimonials; /properties on a phone.

**Element:** The opening pictures.

**Observation:** /careers opens on a blank brown door. /gallery opens on a wall, a rug and the slab wainscot. /testimonials opens on a corner of the roof. On a phone /properties' middle band is a full screen of empty marble floor.

**Visual evidence:** Montages; phone /properties band.

**Why it matters:** These are full-screen pictures with no subject.

**Expected behavior/design:** A subject for each: people's place for careers, the plans for the gallery, a human trace for testimonials.

**Likely scope:** repeated

**Related issues:** #66, #36

**Evidence files:** [32-all-opening-frames-desktop.jpg](ev/32-all-opening-frames-desktop.jpg), [65-phone-properties-window.jpg](ev/65-phone-properties-window.jpg), [68-tablet-gallery-plate.jpg](ev/68-tablet-gallery-plate.jpg)

### ISSUE #68 — The height of the opening picture

**Severity:** MEDIUM

**Location:** All inner pages, desktop and tablet.

**Element:** The height of the opening picture.

**Observation:** Seventeen pages open on a full-screen picture and eleven on a short one that shows the next section in the first screen (careers, knowledge, questions, contact, downloads, the four legal pages, the sitemap and the 404 page). On a phone all are full height.

**Visual evidence:** Desktop and tablet montages.

**Why it matters:** Two opening proportions with no visible rule.

**Expected behavior/design:** One rule the visitor can sense: full for story pages, short for utility pages, applied the same on every device.

**Likely scope:** systemic

**Related issues:** none

**Evidence files:** [32-all-opening-frames-desktop.jpg](ev/32-all-opening-frames-desktop.jpg), [34-all-opening-frames-tablet.jpg](ev/34-all-opening-frames-tablet.jpg)

### ISSUE #69 — The model and its plaque behind the page's title

**Severity:** MEDIUM

**Location:** The three layout pages, opening picture.

**Element:** The model and its plaque behind the page's title.

**Observation:** The model and its name plaque are out of focus, so the layout's own name on its own plaque cannot be read, and a blurred white pilaster crosses the top of the frame.

**Visual evidence:** Zoom of the Kartikeya page's opening picture: the plaque's letters are smudges.

**Why it matters:** The picture's subject is the one thing not sharp.

**Expected behavior/design:** The model in focus beside the title.

**Likely scope:** repeated

**Related issues:** none

**Evidence files:** [43-layout-page-model-and-plaque-out-of-focus.jpg](ev/43-layout-page-model-and-plaque-out-of-focus.jpg), [39-project-page-kartikeya.jpg](ev/39-project-page-kartikeya.jpg)

### ISSUE #70 — The saloon car, close up

**Severity:** AI-SLOP

**Location:** /why-us, the opening picture and the picture band under "Check the number, not the logo."; the film's approach.

**Element:** The saloon car, close up.

**Observation:** At the distance /why-us shows it, the car's surface is melted: the grille's bars are uneven and wavy, the chrome trim round the windows and along the body is lumpy, the headlamps are soft blobs and the roofline wobbles.

**Visual evidence:** Car zoom from the /why-us band: no two grille bars are the same width or straight.

**Why it matters:** Wavy chrome and a melted grille are the signature of a generated 3D model. /why-us opens on this car and then enlarges it under a headline about checking details.

**Expected behavior/design:** A cleanly modelled car, or the car kept at the distance at which it holds.

**Likely scope:** repeated

**Related issues:** #26, #12

**Note:** The car is one of five models made for the forecourt with an AI model generator (Tripo) and supplied for this build, along with the coupe, the two palms and the lantern. Replacing it is the project owner's call.

**Evidence files:** [42-whyus-car-closeup.jpg](ev/42-whyus-car-closeup.jpg)

### ISSUE #71 — The founder's portrait

**Severity:** HIGH

**Location:** /about on a phone (390×844), the opening picture and the quotation band.

**Element:** The founder's portrait.

**Observation:** In the quotation band the portrait is cropped at the neck: the visitor sees a jacket, a nameplate and no face behind the founder's own words. On the opening picture the page's small label is printed across the nameplate.

**Visual evidence:** Phone /about frames.

**Why it matters:** A headless portrait of the founder behind his motto is the opposite of the respect the client asked for.

**Expected behavior/design:** The face in the band, the label clear of the plate.

**Likely scope:** isolated

**Related issues:** #46

**Evidence files:** [63-phone-about-quote-window.jpg](ev/63-phone-about-quote-window.jpg), [62-phone-about-plate.jpg](ev/62-phone-about-plate.jpg)

### ISSUE #72 — The shade over the band's picture

**Severity:** LOW

**Location:** /about on a phone (390×844), the quotation band, right edge of the screen.

**Element:** The shade over the band's picture.

**Observation:** The shade that dims the picture behind the founder's motto stops about nine pixels short of the right edge, so a bright stripe of un-dimmed picture runs down the edge of the screen for the height of the band.

**Visual evidence:** Measured with touch only, nothing hovered: the last 9 px of the screen average 71–90 in brightness against 30–48 just inside them and 26 further in. The opening picture on the same page has no such strip.

**Why it matters:** A bright seam down the edge of a full-width picture is a clipping error, on the founder's own page.

**Expected behavior/design:** The shade to the edge of the screen.

**Likely scope:** isolated

**Related issues:** #71

**Evidence files:** [64-phone-edge-strip.jpg](ev/64-phone-edge-strip.jpg), [63-phone-about-quote-window.jpg](ev/63-phone-about-quote-window.jpg)

## F. Inner pages: layout and components

### ISSUE #73 — The small capital-letter cue at the foot of the opening picture, passing un…

**Severity:** HIGH

**Location:** Every inner page, just after the first scroll, top-left; all screen sizes.

**Element:** The small capital-letter cue at the foot of the opening picture, passing under the fixed header.

**Observation:** The header is transparent over the opening picture, so the cue's letters scroll up through the wordmark and print across it. On the layout pages two cues pass through.

**Visual evidence:** /gallery: "TIKEYA WATER FRONT" printed over "Quality Homes / REALITY". /why-us: "FIVE". Phone /about: "FIGURES". Phone /properties: "RY SIZE".

**Why it matters:** Text running through the logo on every page, on the first scroll, is the most visible layout fault in the reading pages.

**Expected behavior/design:** The cue fading before it reaches the header, or the header taking its ground a little earlier.

**Likely scope:** systemic

**Related issues:** none

**Evidence files:** [30-header-text-collision.jpg](ev/30-header-text-collision.jpg)

### ISSUE #74 — The dark reading sections

**Severity:** MEDIUM

**Location:** Every inner page at 1920×945.

**Element:** The dark reading sections.

**Observation:** On a wide screen the content column is 925 px in a 1920 px frame and many screens are more than half empty dark ground: a heading at the left, a few lines at the right, nothing else.

**Visual evidence:** Montage of every page's second screen.

**Why it matters:** Emptiness can be luxury when it frames something; here it surrounds 16 and 20 px text and reads as an unfilled template.

**Expected behavior/design:** Larger type or a picture, drawing or figure in the empty half of the longer sections.

**Likely scope:** systemic

**Related issues:** none

**Evidence files:** [36-all-second-screens-desktop.jpg](ev/36-all-second-screens-desktop.jpg), [38-inner-reading-screens.jpg](ev/38-inner-reading-screens.jpg)

### ISSUE #75 — Paragraphs and headings whose last line is one word

**Severity:** LOW

**Location:** Inner pages, all sizes (49 on a desktop, 30 on a phone).

**Element:** Paragraphs and headings whose last line is one word.

**Observation:** Headings break with one word alone ("Poosapatirega, Vizianagaram / district.", "Three buyers, / unedited."); paragraphs end on "ask.", "for.", "there.", "about."; form options end with "Srikakulam" alone.

**Visual evidence:** Measured per text block: 49 short last lines at 1920 px wide.

**Why it matters:** Single-word last lines are what careful typesetting removes first.

**Expected behavior/design:** Balanced headings and no single-word last lines in short paragraphs.

**Likely scope:** systemic

**Related issues:** #59

**Evidence files:** [39-project-page-kartikeya.jpg](ev/39-project-page-kartikeya.jpg)

### ISSUE #76 — Lists set on one line with a short rule between items

**Severity:** LOW

**Location:** /about (Values), /locations (the lists of places), the layout pages (landmarks).

**Element:** Lists set on one line with a short rule between items.

**Observation:** When the list wraps, the rule starts the next line.

**Visual evidence:** /about: "— Transparency" begins the second line.

**Why it matters:** A separator at the start of a line reads as a stray dash.

**Expected behavior/design:** Break before the item, not before the rule, or set the list as a column.

**Likely scope:** repeated

**Related issues:** none

**Evidence files:** [39-project-page-kartikeya.jpg](ev/39-project-page-kartikeya.jpg)

### ISSUE #77 — The last column

**Severity:** LOW

**Location:** /cookie-policy, both tables, the "Lasts" column.

**Element:** The last column.

**Observation:** "Up to 12 months" wraps to two lines in a narrow column while the wide middle column has room to spare.

**Visual evidence:** Nine cells with "months" alone on a second line.

**Why it matters:** A table whose narrowest column is the one that wraps.

**Expected behavior/design:** Column widths set by content.

**Likely scope:** isolated

**Related issues:** none

**Evidence files:** [38-inner-reading-screens.jpg](ev/38-inner-reading-screens.jpg)

### ISSUE #78 — Full stops on headings

**Severity:** MEDIUM

**Location:** All inner pages.

**Element:** Full stops on headings.

**Observation:** Every page title ends with a full stop. Second-level headings do on 80 occasions and do not on 32 (mostly the legal pages, sometimes beside one that does). Third-level headings never do.

**Visual evidence:** Counted across 28 pages; on /privacy "Who is responsible" has none and "What we collect, and when." has one.

**Why it matters:** The full stop is part of the site's voice; applied unevenly it looks like two writers.

**Expected behavior/design:** One rule per level.

**Likely scope:** systemic

**Related issues:** none

**Evidence files:** [37-privacy-draft-placeholders.jpg](ev/37-privacy-draft-placeholders.jpg)

### ISSUE #79 — How ordered things are numbered

**Severity:** LOW

**Location:** The menu, /why-us, everywhere else.

**Element:** How ordered things are numbered.

**Observation:** The menu numbers its parts I to IV in roman capitals; /why-us numbers its five points 01 to 05; no other list or sequence on the site is numbered.

**Visual evidence:** Menu screenshot; /why-us screens.

**Why it matters:** Two numbering styles and one unnumbered default is one style too many.

**Expected behavior/design:** One convention, or none.

**Likely scope:** systemic

**Related issues:** none

**Evidence files:** [52-menu-open.jpg](ev/52-menu-open.jpg)

### ISSUE #80 — The small label above the next page's name

**Severity:** LOW

**Location:** The closing link at the foot of every inner page.

**Element:** The small label above the next page's name.

**Observation:** The same block is labelled "Next" on most pages, "Also" on the legal pages, "Back to" on the article and "The next layout" on layout pages.

**Visual evidence:** Page text of all 28 pages.

**Why it matters:** Minor, but it is one component speaking four ways.

**Expected behavior/design:** Keep, if each is deliberate; otherwise one label.

**Likely scope:** systemic

**Related issues:** none

**Evidence files:** [36-all-second-screens-desktop.jpg](ev/36-all-second-screens-desktop.jpg)

## G. Words and facts

### ISSUE #81 — The legal pages

**Severity:** CRITICAL

**Location:** /privacy, /terms, /refund-policy.

**Element:** The legal pages.

**Observation:** All three are published as drafts. Each carries a box reading "Draft — not yet in force … must be confirmed … before this page is published", and about twenty-seven highlighted placeholders in square brackets across the three: [REGISTERED NAME, CIN / GST], [RETENTION PERIOD FOR LEAD RECORDS], [RESPONSE PERIOD], [BOOKING TERMS], [PAYMENT TERMS], [LIABILITY CLAUSE], [GOVERNING LAW AND COURTS], [PRE-AGREEMENT CANCELLATION TERMS], [REFUND CONTACT AND EMAIL], "Last updated: [DATE ON PUBLICATION]" and more.

**Visual evidence:** /privacy 5 placeholders, /terms about 10, /refund-policy about 12, each highlighted in tan on the page.

**Why it matters:** A refund policy made of placeholders on a site that takes enquiries for land is disqualifying for a buyer and reads as an unfinished template to anyone else. The footer links to all three from every page.

**Expected behavior/design:** Final text from the client's lawyers, or the pages withheld until there is.

**Likely scope:** repeated

**Related issues:** #82

**Note:** Needs the client; nothing here can be written on his behalf.

**Evidence files:** [37-privacy-draft-placeholders.jpg](ev/37-privacy-draft-placeholders.jpg)

### ISSUE #82 — The named contact for data protection

**Severity:** HIGH

**Location:** /privacy and /cookie-policy.

**Element:** The named contact for data protection.

**Observation:** Both pages name an individual and a personal Gmail address as the company's Data Protection Officer and the contact for written enquiries.

**Visual evidence:** "Data Protection Officer: Dev Ritvik, devritvik70@gmail.com."

**Why it matters:** A developer's personal mailbox as a company's statutory contact is a placeholder that has gone live.

**Expected behavior/design:** The company's own named officer and address.

**Likely scope:** repeated

**Related issues:** #81

**Evidence files:** [37-privacy-draft-placeholders.jpg](ev/37-privacy-draft-placeholders.jpg)

### ISSUE #83 — The plot counts

**Severity:** HIGH

**Location:** Film (/) count and tables; /projects, /properties, /hall, /start-here, /construction-updates and the layout pages.

**Element:** The plot counts.

**Observation:** The site says 113, 181 and 113 plots (407 "drawn on their plans"), with two layouts at "113 plots, all open". The plans published beside those numbers are numbered to 101, 189 and 204. The film's line under the totals is "Counted from the sanctioned layout plans, not from a brochure."

**Visual evidence:** /projects: "407 plots drawn on their plans". The sheets' own numbering was read on 7 October (101, 189 with joined and split plots, 204 with amenity plots) and was not re-counted for this audit.

**Why it matters:** A buyer who does what the site tells him to do, read the plan, finds that the plan and the count disagree, under a headline about counting in full.

**Expected behavior/design:** Counts that match the sheets, or wording that says where the count comes from.

**Likely scope:** systemic

**Related issues:** #62

**Note:** Already an open question with the client (his plot register against the published sheets).

**Evidence files:** [16-old-style-figures.jpg](ev/16-old-style-figures.jpg), [39-project-page-kartikeya.jpg](ev/39-project-page-kartikeya.jpg)

### ISSUE #84 — The sentence pattern "this, not that"

**Severity:** AI-SLOP

**Location:** All inner pages; heaviest on /why-us (8) and /investment-guide (7).

**Element:** The sentence pattern "this, not that".

**Observation:** The copy leans on one construction: "Proof, not persuasion." "The approved plan, not an impression." "Offices in the district, not a call centre." "Check the number, not the logo." "The airport is a real change, not a talking point." "Not a starting price, not a range, not a rate per square yard." There are 37 of these and "rather than" turns in about 11,500 words, and most section headings are two-beat aphorisms ("The plan is the promise. The land is the proof." "Three, because three are real." "A brochure persuades. A plan is submitted.").

**Visual evidence:** Counted from the text of all 28 pages.

**Why it matters:** Contrast-by-negation and paired aphorisms at this density are the most recognisable signature of machine-written marketing copy. One is a voice; thirty-seven is a tic.

**Expected behavior/design:** Keep the three or four strongest; say the rest plainly.

**Likely scope:** systemic

**Related issues:** #85, #86

**Evidence files:** [36-all-second-screens-desktop.jpg](ev/36-all-second-screens-desktop.jpg)

### ISSUE #85 — Copy about the website and about what it does not contain

**Severity:** AI-SLOP

**Location:** All inner pages; heaviest on /why-us, /construction-updates, /testimonials, /gallery.

**Element:** Copy about the website and about what it does not contain.

**Observation:** The pages talk about themselves ("this site", "this page", "this website": 38 times) and about what is missing (31 statements such as "No photographs, and why.", "None has been made yet.", "No price is published on this site", "What this site does not say."). /why-us has a whole section listing what the site leaves out.

**Visual evidence:** Counted from the text of all 28 pages.

**Why it matters:** A site that explains its own honesty and its own gaps at length reads as written to a brief about trust instead of by a company with things to show.

**Expected behavior/design:** State the fact once where a buyer needs it; cut the commentary.

**Likely scope:** systemic

**Related issues:** #84, #87

**Evidence files:** [36-all-second-screens-desktop.jpg](ev/36-all-second-screens-desktop.jpg)

### ISSUE #86 — Sentences reused word for word

**Severity:** AI-SLOP

**Location:** Across the inner pages.

**Element:** Sentences reused word for word.

**Observation:** 54 sentences of nine words or more appear on two or more pages. "A brochure list is a statement of intent; the agreement is the commitment." is on four pages. The band "The plan is the promise. The land is the proof." is on four. Each layout's description is repeated on three.

**Visual evidence:** Counted from the text of all 28 pages.

**Why it matters:** Reused sentences are what a template leaves behind.

**Expected behavior/design:** Say each thing in one place and link to it.

**Likely scope:** systemic

**Related issues:** #84

**Evidence files:** [36-all-second-screens-desktop.jpg](ev/36-all-second-screens-desktop.jpg)

### ISSUE #87 — Sections that announce their own absence

**Severity:** MEDIUM

**Location:** /knowledge, /gallery, /construction-updates, the layout pages' approval section.

**Element:** Sections that announce their own absence.

**Observation:** /knowledge lists three articles "not yet good enough". /gallery has a section titled "No photographs, and why." /construction-updates says of its record "None has been made yet." The Kartikeya page's section "Whose sanction, and how to check it." gives the reference as "Ask the branch".

**Visual evidence:** Page text.

**Why it matters:** Four pages are, in substance, notices that the content is not there.

**Expected behavior/design:** Publish when there is something to publish; until then leave the page or section out of the menu.

**Likely scope:** repeated

**Related issues:** #85

**Note:** Each waits on something the client has not supplied (photographs, approval references).

**Evidence files:** [38-inner-reading-screens.jpg](ev/38-inner-reading-screens.jpg)

### ISSUE #88 — The three quotations

**Severity:** MEDIUM

**Location:** /testimonials.

**Element:** The three quotations.

**Observation:** The quotations name "Quality Homes Reality Services", a development called "Eden Garden" and "Vizag"; none mentions the three layouts on sale, and the page's own text says so. They are undated.

**Visual evidence:** Page text.

**Why it matters:** Praise for another project under another company name does not support this site's offer, and the page's long explanation of that draws attention to it.

**Expected behavior/design:** Dated accounts from buyers of these layouts, or a shorter page.

**Likely scope:** isolated

**Related issues:** none

**Evidence files:** [32-all-opening-frames-desktop.jpg](ev/32-all-opening-frames-desktop.jpg)

### ISSUE #89 — The Telugu line

**Severity:** MEDIUM

**Location:** /about, the founder's motto.

**Element:** The Telugu line.

**Observation:** No Telugu typeface is loaded; the line falls to whatever the device has. On Windows that is a plain sans-serif in a page set entirely in a serif, at a different size (46.6 px) and line height from the heading style it uses.

**Visual evidence:** The loaded fonts list contains only the site's one family; the stylesheet names "Noto Serif Telugu, Nirmala UI, Gautami" with no font file behind them.

**Why it matters:** The founder's own words, in his own language, are the one line on the site set in an accidental typeface.

**Expected behavior/design:** A Telugu serif loaded with the page and sized to sit with the English.

**Likely scope:** isolated

**Related issues:** none

**Evidence files:** [63-phone-about-quote-window.jpg](ev/63-phone-about-quote-window.jpg)

### ISSUE #90 — How measurements are written

**Severity:** SYSTEMIC

**Location:** All pages that state sizes.

**Element:** How measurements are written.

**Observation:** The same things are written many ways. Plot sizes: "30′ × 50′" on most pages and "30′×50′" on /faqs and the article. Road widths: "40-foot", "40 feet", "40ft", "40′", "forty-foot" and "30 by 60". Areas: "sq yd", "square yards", "Square yards". PIN codes: "– 530016" on most pages and "530 016" on the legal pages. Security: "24×7 CCTV" on one page and "CCTV round the clock" on others.

**Visual evidence:** Counted from page text: 54 multiplication signs with and without spaces; six ways of writing a road width.

**Why it matters:** A site whose claim is exactness should write a foot the same way twice.

**Expected behavior/design:** One style sheet for units, applied everywhere.

**Likely scope:** systemic

**Related issues:** #99

**Evidence files:** [38-inner-reading-screens.jpg](ev/38-inner-reading-screens.jpg)

### ISSUE #91 — What each page is called

**Severity:** SYSTEMIC

**Location:** The menu, the film's footer, the inner footer, browser-tab titles, the 404 page's list.

**Element:** What each page is called.

**Observation:** Eight pages have two to four names. /downloads is "Downloads" (menu and tab), "Layout plans" (film footer), "Take the plans with you" (inner footer) and "The approved plans" (404). /gallery is "The plans", "Gallery" and "The plans, full size". /investment-guide is "The guide", "Investment guide", "Buying land here" and "Buying land in north coastal Andhra". /testimonials is "What buyers say", "Testimonials" and "In their words". /contact is "Enquire", "Contact", "Talk to the office" and "Ask about a layout". Also "Locations" and "Where the sites are"; "The Hall" and "The hall"; "Refunds" and "Cancellation & Refunds".

**Visual evidence:** Compared link text, tab titles and headings for every route.

**Why it matters:** A visitor cannot be sure two links go to the same place.

**Expected behavior/design:** One name per page (a short form for the menu is fine if it is the same short form everywhere).

**Likely scope:** systemic

**Related issues:** #58

**Evidence files:** [52-menu-open.jpg](ev/52-menu-open.jpg), [27-footer-film-vs-inner.jpg](ev/27-footer-film-vs-inner.jpg)

### ISSUE #92 — The vision and mission paragraphs

**Severity:** AI-SLOP

**Location:** /about, "What the company says it is for."

**Element:** The vision and mission paragraphs.

**Observation:** "India's leading and most trusted real estate enterprise", "global-standard residential properties", "world-class amenities, best-in-class security and unmatched value".

**Visual evidence:** Page text.

**Why it matters:** These are the stock phrases the rest of the site is written to avoid; set in the site's largest body type they read as filler.

**Expected behavior/design:** Shorter, or one concrete sentence in their place.

**Likely scope:** isolated

**Related issues:** none

**Note:** The page says these are the company's own printed words; cutting them is the client's call.

**Evidence files:** [36-all-second-screens-desktop.jpg](ev/36-all-second-screens-desktop.jpg)

### ISSUE #93 — The question "Do I need a WebGL-capable device to use this site?"

**Severity:** LOW

**Location:** /faqs, "About this site".

**Element:** The question "Do I need a WebGL-capable device to use this site?"

**Observation:** A buyer's FAQ asks a developer's question in a developer's words.

**Visual evidence:** Page text.

**Why it matters:** No land buyer asks this; it is the build talking about itself.

**Expected behavior/design:** "Will this work on my phone?" or nothing.

**Likely scope:** isolated

**Related issues:** none

**Evidence files:** [38-inner-reading-screens.jpg](ev/38-inner-reading-screens.jpg)

### ISSUE #94 — The hidden anti-spam field

**Severity:** LOW

**Location:** /contact, /book-a-site-visit, the three layout pages.

**Element:** The hidden anti-spam field.

**Observation:** The words "Leave this field empty" are hidden only by transparency, so they are part of the page's text: they appear when the page is copied, read in reader mode or summarised.

**Visual evidence:** Present in every form page's extracted text, between the form's heading and its first question.

**Why it matters:** An instruction with no visible field looks like a bug to anyone who meets it.

**Expected behavior/design:** Hide it from text extraction as well as from sight.

**Likely scope:** repeated

**Related issues:** none

**Evidence files:** [55-enquiry-form-filled.jpg](ev/55-enquiry-form-filled.jpg)

### ISSUE #95 — Share image, icons, tab title

**Severity:** LOW

**Location:** Site-wide, the page's information for browsers and sharing.

**Element:** Share image, icons, tab title.

**Observation:** 25 of 28 pages, including the home page, have no share image or share title, so a link pasted into WhatsApp shows no picture. There is no favicon.ico, no touch icon and no theme colour. The 404 page has no title. The site's files name two different domains (.in and .com).

**Visual evidence:** Read from each page's head; /favicon.ico and /apple-touch-icon.png answer 404.

**Why it matters:** For a site sold by sharing a link, the shared card is the first impression.

**Expected behavior/design:** A share image per page (the cover frame at least), a full icon set, one domain.

**Likely scope:** systemic

**Related issues:** #4

**Evidence files:** [41-404-loader-then-page.jpg](ev/41-404-loader-then-page.jpg)

## H. The design system

### ISSUE #96 — The type system

**Severity:** SYSTEMIC

**Location:** All pages at 1920×945 (measured on 28 pages and the film).

**Element:** The type system: sizes, line heights, letter spacing.

**Observation:** One typeface is used well, but its settings have multiplied. There are 15 text sizes on the inner pages (10.24, 10.75, 12.8, 16, 16.8, 20, 23.1, 25, 31.25, 31.67, 44.1, 46.62, 63, 90.3, 121.8 px) and two more on the film's footer (13.44 and 134.4 px); 42 distinct combinations of size, weight, spacing and leading; 13 letter-spacing values; six different line heights at 20 px (27, 29, 30, 31, 32, 32.4) and eight at 16 px. The small capitals come in two sizes a half-pixel apart: 10.75 px in the header and 10.24 px on every other control.

**Visual evidence:** Computed styles of every text element on every page.

**Why it matters:** The eye cannot name a 0.5 px or a 1 px difference in leading, but it reads the sum as "assembled". An authored system has seven or eight sizes and one leading per size.

**Expected behavior/design:** A scale of about eight sizes, one line height for each, one small-capital size.

**Likely scope:** systemic

**Related issues:** #97, #99

**Evidence files:** [36-all-second-screens-desktop.jpg](ev/36-all-second-screens-desktop.jpg)

### ISSUE #97 — Body text

**Severity:** MEDIUM

**Location:** All inner pages at 1366×657, 820×1180 and 390×844.

**Element:** Body text.

**Observation:** Below the widest screens two almost identical body sizes share each page: 15.93 px and 16 px on a laptop (913 and 648 uses), 15.43 and 16 on a tablet, 15.03 and 16 on a phone. On the laptop the small capitals also split into 10.05 and 10.25 px.

**Visual evidence:** Computed styles at each size.

**Why it matters:** Part of the text follows a fluid scale and part is fixed, so neighbouring paragraphs differ by a fraction of a pixel to a full pixel.

**Expected behavior/design:** All body text on the one scale.

**Likely scope:** systemic

**Related issues:** #96

**Evidence files:** [35-all-opening-frames-laptop-1366.jpg](ev/35-all-opening-frames-laptop-1366.jpg)

### ISSUE #98 — The gilt and ivory colours

**Severity:** SYSTEMIC

**Location:** All pages.

**Element:** The gilt and ivory colours.

**Observation:** There are three gilts in use (#E8B98A on labels and links, #F1D0A6 on the gilt half of headings and on the film footer's labels, #D9B07A on the word "Reality" in the logo line) and twelve strengths of ivory text between 62% and 94% (62, 72, 74, 76, 78, 80, 82, 84, 86, 88, 90, 94). The consent card's heading is a cool grey-white (249, 250, 251) that appears nowhere else.

**Visual evidence:** Computed colours of every text element.

**Why it matters:** Three near-identical golds and a dozen near-identical greys are what a palette looks like before it has been edited.

**Expected behavior/design:** Two gilts at most (text and display), three or four ivory strengths, no cool white.

**Likely scope:** systemic

**Related issues:** #105

**Evidence files:** [27-footer-film-vs-inner.jpg](ev/27-footer-film-vs-inner.jpg), [50-consent-card.jpg](ev/50-consent-card.jpg)

### ISSUE #99 — The style of numerals

**Severity:** SYSTEMIC

**Location:** All pages with numbers.

**Element:** The style of numerals.

**Observation:** Four numeral settings are in use: lining proportional in most text, lining tabular in tables, old-style proportional in the display statistics and in form fields, old-style tabular in the film's fact lines. A typed telephone number shows small old-style zeros ("+91 98480 00000"). The units beside the big figures are three sizes ("years", "lakh sq yd", a smaller "ft").

**Visual evidence:** Computed numeral settings on every element containing a digit: 315, 24, 20 and 20 uses.

**Why it matters:** Numbers are the content of this site; they should look like one set.

**Expected behavior/design:** Lining figures for statistics, tables and form fields; old-style, if kept, in running text only.

**Likely scope:** systemic

**Related issues:** #53, #90

**Evidence files:** [16-old-style-figures.jpg](ev/16-old-style-figures.jpg), [55-enquiry-form-filled.jpg](ev/55-enquiry-form-filled.jpg)

### ISSUE #100 — Hover and state transitions

**Severity:** SYSTEMIC

**Location:** All controls on all pages.

**Element:** Hover and state transitions.

**Observation:** Four durations (0.15, 0.3, 0.35 and 0.5 s) and three easing curves are in use. Of about 970 controls that animate, 728 still carry the styling framework's default 0.15 s curve; the site's own slow-out curve appears on 119; the rest use plain "ease".

**Visual evidence:** Computed transition values of every link and button.

**Why it matters:** Motion is part of a design system; here most of it is the framework's default.

**Expected behavior/design:** Two durations and one curve, set once.

**Likely scope:** systemic

**Related issues:** none

**Evidence files:** [54-hover-and-focus-states.jpg](ev/54-hover-and-focus-states.jpg)

### ISSUE #101 — The ivory tile behind the mark

**Severity:** LOW

**Location:** Header, every page.

**Element:** The ivory tile behind the mark.

**Observation:** The mark sits on a small ivory tile with a 3 px corner radius and a four-layer drop shadow. It is the only rounded, shadowed, light object on the site; everything else is square, flat and dark.

**Visual evidence:** Computed: radius 3 px on 28 elements (the tile only); its shadow is one of four shadow recipes on the site.

**Why it matters:** The tile reads as an app icon dropped onto an editorial page.

**Expected behavior/design:** A ground for the mark that belongs to the page (a square ivory plate with a hairline, or the page's own dark with the mark's colours adjusted for it).

**Likely scope:** systemic

**Related issues:** none

**Note:** The mark itself is the client's and is never to be changed; the tile is the build's choice of ground and is his to approve.

**Evidence files:** [30-header-text-collision.jpg](ev/30-header-text-collision.jpg)

### ISSUE #102 — The "Enquire" link

**Severity:** LOW

**Location:** Header, every page, when the menu opens.

**Element:** The "Enquire" link.

**Observation:** "Enquire" jumps five pixels to the left when the menu opens, because "Close" is wider than "Menu".

**Visual evidence:** Measured: the word spans 1644–1706 px at rest and 1639–1701 px with the menu open.

**Why it matters:** Chrome that moves when it should hold still.

**Expected behavior/design:** A fixed width for the menu control.

**Likely scope:** isolated

**Related issues:** #61

**Evidence files:** [52-menu-open.jpg](ev/52-menu-open.jpg)

### ISSUE #103 — The menu's ground

**Severity:** LOW

**Location:** The open menu.

**Element:** The menu's ground.

**Observation:** The menu's ground is slightly see-through, so a dim ghost of the page behind it (on /about, the founder's portrait) lies under the list, with link text crossing it. The four columns hold 6, 5, 4 and 3 items, leaving the lower right of the screen empty.

**Visual evidence:** Menu screenshot on /about.

**Why it matters:** A faint face behind a list of links looks like a rendering leftover.

**Expected behavior/design:** An opaque ground, or a deliberate picture.

**Likely scope:** isolated

**Related issues:** none

**Evidence files:** [52-menu-open.jpg](ev/52-menu-open.jpg), [53-menu-zoom.jpg](ev/53-menu-zoom.jpg)

### ISSUE #104 — The draft notice box and the bulleted lists under it

**Severity:** LOW

**Location:** /privacy, /terms, /refund-policy.

**Element:** The draft notice box and the bulleted lists under it.

**Observation:** The notice's text starts at 919.5 px and the bulleted list's text at 916 px, in the same column.

**Visual evidence:** Measured left edges.

**Why it matters:** A 3.5 px step between two blocks in one column.

**Expected behavior/design:** One text edge.

**Likely scope:** isolated

**Related issues:** none

**Evidence files:** [37-privacy-draft-placeholders.jpg](ev/37-privacy-draft-placeholders.jpg)

## I. Controls and their states

### ISSUE #105 — The consent card

**Severity:** MEDIUM

**Location:** First visit, every page.

**Element:** The consent card.

**Observation:** The card does not use the site's own components. Its three choices are outlined boxes (the only boxed buttons on the site; every other action is a hairline and capitals), its heading is tracked capitals in a cool white, and its text is the smallest body copy anywhere (12.8 px at 72%). It says "the experience" and points to "the Privacy link", which the footer calls "Privacy & data choices".

**Visual evidence:** Consent screenshot; computed styles of its buttons and text.

**Why it matters:** It is the first designed object a visitor meets and it comes from a different kit.

**Expected behavior/design:** The site's own action style, ivory heading, readable text, the control's real name.

**Likely scope:** isolated

**Related issues:** #98, #106

**Evidence files:** [50-consent-card.jpg](ev/50-consent-card.jpg)

### ISSUE #106 — "Accept all"

**Severity:** MEDIUM

**Location:** First visit, every page.

**Element:** "Accept all".

**Observation:** "Accept all" is focused when the card opens, so it alone carries a gilt ring and pressing Enter accepts all tracking.

**Visual evidence:** Consent screenshot: a second outline round the first button only.

**Why it matters:** It makes the tracking choice look like the recommended one, on a site whose copy is about not doing that.

**Expected behavior/design:** No choice pre-selected, or focus on "Essential only".

**Likely scope:** isolated

**Related issues:** #105

**Evidence files:** [50-consent-card.jpg](ev/50-consent-card.jpg)

### ISSUE #107 — The panel the control opens

**Severity:** LOW

**Location:** Footer, "Privacy & data choices", every page.

**Element:** The panel the control opens.

**Observation:** The control reopens the first-visit card under its first-visit title, "Before you explore", and blurs the page behind it. Nothing else on the site blurs.

**Visual evidence:** Screenshot after pressing the control at the foot of /projects.

**Why it matters:** A returning visitor changing a setting is greeted as a new one; the blur is a one-off effect.

**Expected behavior/design:** A title that says what the panel is; the same dimming the rest of the site uses.

**Likely scope:** isolated

**Related issues:** #105

**Evidence files:** [51-privacy-control-reopens-consent.jpg](ev/51-privacy-control-reopens-consent.jpg)

### ISSUE #108 — The visible focus on links and buttons

**Severity:** MEDIUM

**Location:** All pages, keyboard use.

**Element:** The visible focus on links and buttons.

**Observation:** Four different focus treatments exist. The cue on the opening picture, the index rows and the full-width "Next" block show focus by a colour change alone, with no ring. The footer's main action has a 1 px gilt outline set 6 px off. The chapter dots have a ring. The consent buttons have the browser's outline.

**Visual evidence:** Tabbed through /about: nine stops recorded with their computed outlines.

**Why it matters:** Focus is a state like hover and should belong to the same system; colour alone is also hard to see.

**Expected behavior/design:** One focus ring for everything.

**Likely scope:** systemic

**Related issues:** #106

**Evidence files:** [54-hover-and-focus-states.jpg](ev/54-hover-and-focus-states.jpg)

### ISSUE #109 — The date field

**Severity:** MEDIUM

**Location:** /book-a-site-visit, "A day that suits you".

**Element:** The date field.

**Observation:** The field is the browser's own: "dd-mm-yyyy" in the browser's layout, the browser's calendar icon, and a bright blue selection on the day when focused.

**Visual evidence:** Visit form zoom.

**Why it matters:** Every other field is drawn in the site's style; this one is the operating system's.

**Expected behavior/design:** A styled date control, or three plain fields.

**Likely scope:** isolated

**Related issues:** none

**Evidence files:** [56-visit-form-date-and-wrapped-option.jpg](ev/56-visit-form-date-and-wrapped-option.jpg)

### ISSUE #110 — The four time options

**Severity:** LOW

**Location:** /book-a-site-visit, "Time of day", at 1920 px wide.

**Element:** The four time options.

**Observation:** "Any time", "Morning" and "Afternoon" sit on one line and "Evening" drops alone to a second.

**Visual evidence:** Visit form zoom.

**Why it matters:** One orphaned option in a set of four.

**Expected behavior/design:** Four on one line or two and two.

**Likely scope:** isolated

**Related issues:** none

**Evidence files:** [56-visit-form-date-and-wrapped-option.jpg](ev/56-visit-form-date-and-wrapped-option.jpg)

### ISSUE #111 — The text fields

**Severity:** LOW

**Location:** /contact, /book-a-site-visit, the layout pages' forms.

**Element:** The text fields.

**Observation:** The name and telephone fields are set at 25 px and the message field at 20 px, and the message field shows the browser's grey resize handle in its corner.

**Visual evidence:** Computed sizes; form screenshot.

**Why it matters:** Two input sizes in one form, and a system widget in a drawn form.

**Expected behavior/design:** One input size; no resize handle.

**Likely scope:** repeated

**Related issues:** none

**Evidence files:** [55-enquiry-form-filled.jpg](ev/55-enquiry-form-filled.jpg)

## J. Phone and tablet

### ISSUE #112 — The column of chapter dots at the right edge

**Severity:** HIGH

**Location:** Film (/) and every inner page on a touch screen (tested at 390×844).

**Element:** The column of chapter dots at the right edge.

**Observation:** The dots have an invisible touch area 186 px wide and about 200 px tall over the middle of the screen. One tap anywhere in it opens the list of chapter names over the page's text. If the visitor then scrolls, the names stay printed over the film's headline and figures until they tap somewhere else.

**Visual evidence:** Touch test: untouched, no names; after one tap in the invisible area, eleven names over the copy; after two scrolls, names still over the picture and over "344 / 407"; cleared only by a tap elsewhere.

**Why it matters:** On a phone, a stray thumb leaves a second column of text lying across the film's words. Most of this site's buyers will see it on a phone.

**Expected behavior/design:** A touch area no wider than the dots; names that close when the page scrolls.

**Likely scope:** systemic

**Related issues:** #113

**Evidence files:** [60-phone-rail-tap-sequence.jpg](ev/60-phone-rail-tap-sequence.jpg)

### ISSUE #113 — The eleven dots

**Severity:** MEDIUM

**Location:** Film (/) on a phone and a tablet.

**Element:** The eleven dots.

**Observation:** The dots run down over the house on the cover and over the building's right side on a tablet, and at the film's end the telephone number runs into the dots' ring at the right edge.

**Visual evidence:** Phone key frames; phone walk sheet 3, frame 132.

**Why it matters:** Chrome lying on the subject, and text touching chrome.

**Expected behavior/design:** Dots clear of the picture's subject and of text.

**Likely scope:** repeated

**Related issues:** #112

**Evidence files:** [61-phone-film-key-frames.jpg](ev/61-phone-film-key-frames.jpg), [71-film-phone-walk-3.jpg](ev/71-film-phone-walk-3.jpg)

### ISSUE #114 — The house

**Severity:** MEDIUM

**Location:** Film (/), cover on a phone (390×844).

**Element:** The house.

**Observation:** The house is cut by the right edge of the screen: its right wing and part of the portico are out of frame.

**Visual evidence:** Phone key frames, first frame.

**Why it matters:** The opening picture on the most-used device does not show the whole house.

**Expected behavior/design:** The whole front in frame.

**Likely scope:** isolated

**Related issues:** none

**Evidence files:** [61-phone-film-key-frames.jpg](ev/61-phone-film-key-frames.jpg)

### ISSUE #115 — The place line under "VSR Gayatri Township"

**Severity:** LOW

**Location:** Film (/), table 3 on a phone.

**Element:** The place line under "VSR Gayatri Township".

**Observation:** The line wraps so that the second line begins with the separator dot: "· Srikakulam".

**Visual evidence:** Phone walk sheet 3, frame 102.

**Why it matters:** A separator starting a line.

**Expected behavior/design:** Break before the place name, without the dot.

**Likely scope:** isolated

**Related issues:** #76

**Evidence files:** [71-film-phone-walk-3.jpg](ev/71-film-phone-walk-3.jpg)

### ISSUE #116 — The twelve page links and the legal row

**Severity:** LOW

**Location:** Film (/), the footer on a phone.

**Element:** The twelve page links and the legal row.

**Observation:** The twelve links wrap as four, two, four, two, and the legal row wraps into three uneven lines.

**Visual evidence:** Phone walk sheet 3, last frame.

**Why it matters:** The film's last screen on a phone looks unset.

**Expected behavior/design:** Two even columns, or the inner pages' footer.

**Likely scope:** isolated

**Related issues:** #58

**Evidence files:** [71-film-phone-walk-3.jpg](ev/71-film-phone-walk-3.jpg)

### ISSUE #117 — The size of things to press

**Severity:** MEDIUM

**Location:** All pages on a phone.

**Element:** The size of things to press.

**Observation:** The footer's legal links are 20 px tall, the footer's telephone number 28 px, the header's "Enquire" and "Menu" 34 px, and the "privacy notice" link inside each form 18 px.

**Visual evidence:** Measured boxes on 28 pages at 390×844.

**Why it matters:** Below about 44 px a thumb misses; the telephone number is the thing a buyer most wants to press.

**Expected behavior/design:** At least 44 px of height for every press target.

**Likely scope:** systemic

**Related issues:** none

**Evidence files:** [71-film-phone-walk-3.jpg](ev/71-film-phone-walk-3.jpg)

### ISSUE #118 — The founder's nameplate

**Severity:** LOW

**Location:** Film (/), the map chapter on a phone, 88–91% of the scroll, top of the frame.

**Element:** The founder's nameplate.

**Observation:** A thin strip of the nameplate's gilt letters shows at the very top of the frame, under the header, for three notches.

**Visual evidence:** Phone walk sheet 3, frames 120–124.

**Why it matters:** A sliver of lettering at the frame's edge.

**Expected behavior/design:** In or out.

**Likely scope:** isolated

**Related issues:** none

**Evidence files:** [71-film-phone-walk-3.jpg](ev/71-film-phone-walk-3.jpg)

### ISSUE #119 — The supporting lines

**Severity:** LOW

**Location:** Film (/), "We do not broker land.", 11–14% of the scroll, bottom-left.

**Element:** The supporting lines.

**Observation:** The two supporting lines sit across the top of the hedge and shrubs at the foot of the frame.

**Visual evidence:** Desktop walk sheet 1, frames 8–10.

**Why it matters:** Small text on a busy, dark-and-light edge.

**Expected behavior/design:** A line higher, on the lawn.

**Likely scope:** isolated

**Related issues:** #31

**Evidence files:** [70-film-desktop-walk-1.jpg](ev/70-film-desktop-walk-1.jpg)


---

# 5. Systemic problems

These recur across the site. Fixing each at its source clears many findings at once.

| # | Recurring problem | How often | Findings |
|---|---|---|---|
| S1 | **No edge smoothing on the 3D picture** | Every film frame and all 28 opening pictures on 1× screens | #5, #8, #29, #19, #48 |
| S2 | **Two standards of asset in one scene** | Palms against trees; placeholder furniture against moulded stone; three different waters | #12, #13, #20, #17, #27, #16 |
| S3 | **The hall's materials** | Pink on three families of element; slab panelling behind all three tables and in seven pages' pictures; one grain at three scales; a star frieze on both walls | #34, #36, #37, #35, #39 |
| S4 | **Shades that show as shapes** | Header band on tablet and phone; table band on phone; table 2's dark third; a shade that stops short of the screen edge on /about | #54, #55, #42, #72 |
| S5 | **Type settings have multiplied** | 15 sizes (17 with the film's footer), 42 distinct styles, 13 letter-spacings, six leadings at one size; two body sizes below 1920 px | #96, #97 |
| S6 | **Numbers and units written many ways** | Four numeral styles; six ways to write a road width; two PIN formats; three unit sizes beside figures | #99, #53, #90 |
| S7 | **The site names things inconsistently** | Eight pages with two to four names; two footers with different link sets; four labels on the closing block; three numbering styles | #91, #58, #80, #79 |
| S8 | **Unedited colour tokens** | Three gilts, twelve ivory strengths, one cool white | #98 |
| S9 | **Motion left at framework defaults** | 728 of about 970 control transitions; four durations, three curves | #100 |
| S10 | **Few pictures for many pages** | 28 pages on about ten views; seven on the portrait; 17 full-height and 11 short | #66, #67, #68 |
| S11 | **The copy's mannerisms** | 37 "this, not that"; 38 self-references; 31 statements of absence; 54 repeated sentences in 11,500 words | #84, #85, #86 |
| S12 | **Loose line endings** | 49 single-word or stub last lines on a desktop, 30 on a phone; dashes and separators starting lines | #75, #59, #76, #115 |
| S13 | **Content that is not there yet** | Three legal drafts (about 27 placeholders); four sections that announce their own absence; three unusable plan images | #81, #87, #62, #82 |
| S14 | **Controls from more than one kit** | Four focus treatments; a consent card in its own style; a browser-native date field; two input sizes | #108, #105, #109, #111 |
| S15 | **The first visit** | 12–17 s of dark on every page through the link; a 12 s ceiling that can lift on nothing | #1, #2, #3, #4 |
| S16 | **Chrome over content on touch screens** | Chapter dots over the house, over text, with an oversized invisible touch area; press targets under 44 px | #112, #113, #117 |

---

# 6. AI-slop report

Everything that reads as generated, procedural or synthetic, with the evidence. "AI slop" here means a visible tell, not a judgment of how it was made.

**In the picture**

| Element | Evidence | Finding |
|---|---|---|
| Star frieze in the hall | Evenly spaced six-pointed stars standing off the wall with shadows; belongs to no classical order | #35 |
| Yellow "gold" on the house | Flat ochre spheres under the cornice corners and bands on plain columns; no reflection, no architectural reason | #11 |
| One wood grain everywhere | The same looping grain at the same scale on a 3 m panel, a 60 cm board and a table top | #37 |
| Slab wainscot | Unframed flat panels proud of the wall, half pale and half black where baked light bleeds across | #36 |
| Traced site models | A plus-shaped hole in a green block; beaded edges on verges; a blank slab for half a model | #41, #40 |
| Pediments with nothing behind | Wedges with open sides and a black slot beneath, on a house with no roof behind them | #7 |
| The odd window | One window in a row filled with a corrugated sheet | #24 |
| Black palms | A second asset set under different lighting, standing in the same sun | #12 |
| The car, close up | Wavy grille bars, lumpy chrome, blob headlamps | #70 |
| Placeholder furniture | Wedge loungers, disc parasols with a white dot | #20 |
| Water that changes character | Grey sheet, turquoise rectangle, blocky noise, cream ellipse | #17, #27 |
| Lamps and their light in different colours | Blue flames and a blue lamp line throwing amber light | #45, #47 |
| Bowl capitals and woven stone | Capitals that are turned bowls under a diagonal plate; stone with a cloth texture | #32 |

**In the words**

| Element | Evidence | Finding |
|---|---|---|
| Contrast by negation | "Proof, not persuasion." and 36 more; paired aphorisms as section headings | #84 |
| A site about itself | 38 uses of "this site / page / website"; 31 statements of what is absent; a section listing what the site leaves out | #85 |
| Reused sentences | 54 sentences on two or more pages; one closing band on four | #86 |
| Stock mission phrases | "world-class amenities, best-in-class security and unmatched value" | #92 |
| The build talking | "Do I need a WebGL-capable device to use this site?" in a buyer's FAQ | #93 |

**In the system**

| Element | Evidence | Finding |
|---|---|---|
| Near-identical pictures | Seven pages on one view of the portrait, four on one view of the dome; pages repeating their own opening picture halfway down | #66 |
| Decoration added because it could be | Colour fringing and floating motes that read as faults on a still | #21, #28 |

**Known provenance.** Five objects in the scene are AI-generated models (the saloon, the coupe, the royal palm, the coconut palm and the portico lantern's body). The car close-up and the black palms are where that shows.

**What does not read as generated:** the typeface and display setting, the header, the chapter dots as an idea, the inner pages' grid and the forms' layout. These look designed.

---

# 7. Design-system inconsistencies

| Component | Expected pattern | Actual variations | Locations | Severity |
|---|---|---|---|---|
| Type sizes | About eight sizes on one scale | 15 sizes on inner pages, 17 with the film's footer; 42 distinct styles | Site-wide | SYSTEMIC #96 |
| Body text | One size per screen width | 15.93 and 16 px together on a laptop; 15.43/16 tablet; 15.03/16 phone | Inner pages below 1920 px | MEDIUM #97 |
| Line height | One per size | Six at 20 px (27 to 32.4), eight at 16 px, four at 25 px, four at 31.25 px | Inner pages | SYSTEMIC #96 |
| Small capitals | One size and spacing | 10.75 px in the header, 10.24 px on actions; 10.05 and 10.25 px on a laptop | Header against every action | SYSTEMIC #96 |
| Numerals | Lining for figures and tables | Lining proportional, lining tabular, old-style proportional, old-style tabular | Statistics, tables, forms, film | SYSTEMIC #99 |
| Display statistics | Even height | Old-style: "407" with a small zero; 3 and 4 below the line | Film count, /about, /projects, layout pages | MEDIUM #53 |
| Units | One written form | 30′ × 50′ and 30′×50′; 40-foot, 40 feet, 40ft, 40′, forty-foot; sq yd and square yards; two PIN formats | All pages with sizes | SYSTEMIC #90 |
| Heading punctuation | One rule per level | Titles always stopped; second-level 80 with and 32 without; third-level never | Inner pages, worst on legal pages | MEDIUM #78 |
| Two-tone headline | Colour changes at a line break | One changes mid-line | Film, portrait chapter | LOW #56 |
| Actions (buttons) | Hairline and small capitals | The same, except three outlined boxes on the consent card | Consent card | MEDIUM #105 |
| Focus | One ring | Colour only; 1 px outline at 6 px; ring on dots; browser outline | All pages | MEDIUM #108 |
| Form fields | One drawn style and size | 25 px inputs, 20 px message field, a browser-native date field, a browser resize handle | Both forms | MEDIUM #109, LOW #111 |
| Cards and boxes | Square, flat, hairline | Logo tile with 3 px radius and a four-layer shadow; a square dark chip on plans; a tan-edged notice box | Header; plan pictures; legal pages | LOW #101, #64 |
| Icons | One drawn set | Menu lines, a close cross and a speaker in one style; the calendar icon is the browser's; the "next" arrow is a typed character | Header; visit form; closing block | LOW #109 |
| Borders | One hairline strength | Ivory at 13% (461 uses), 30%, 32% and 50%; solid gilt | Inner pages, tables, forms | LOW |
| Corner radii | Square | 0, 1 px, 2 px, 3 px and round | Marks, plan pictures, logo tile, dots | LOW #101 |
| Shadows | None, or one | Four recipes | Logo tile, dots, plan pictures | LOW |
| Spacing and edges | Content on 100 / 895 / 1820 px | Held on every page; 1 px drift on /gallery, 3.5 px on legal notices | /gallery, legal pages | LOW #65, #104 |
| Opening pictures | A picture for each subject, one height rule | About ten views for 28 pages; 17 full-height, 11 short | Inner pages | SYSTEMIC #66, MEDIUM #68 |
| Picture shading | Invisible | Hard-edged bands; a shade that stops 9 px short of the screen edge | Film on phone and tablet; /about on a phone | MEDIUM #54, #55; LOW #72 |
| Motion | Two durations, one curve | 0.15, 0.3, 0.35, 0.5 s; three curves; 728 controls on the framework default | All controls | SYSTEMIC #100 |
| Colour | Two gilts, a few ivories | Three gilts, twelve ivory strengths, a cool white | Site-wide; consent card | SYSTEMIC #98 |
| Header | Fixed | "Enquire" moves 5 px when the menu opens; text passes through the wordmark | Every page | LOW #102, HIGH #73 |
| Footer | One | Two designs with different sizes, labels and link sets | Film against every other page | SYSTEMIC #58 |
| Page names | One per page | Eight pages with two to four names | Menu, footers, titles, 404 | SYSTEMIC #91 |
| Section layouts | One layout per component | Plan block laid out two ways; closing block with four labels; three numbering styles | /gallery; all pages; menu and /why-us | MEDIUM #65, LOW #80, #79 |
| Chapter dots | Clear of content, thumb-sized target | Over the house and text on small screens; a 186 px invisible touch area | Phone and tablet | HIGH #112 |

---

# 8. Awwwards readiness

Scores are for the site as it stands tonight, on the evidence above.

| Criterion | Score | Why |
|---|---|---|
| Visual craft | **4 / 10** | The interface is carefully made. The 3D picture, which fills every screen, is not: no edge smoothing, black palms, wedge pediments, pink plaster, slab panelling, three kinds of water. The plans are scans. |
| Art direction | **5 / 10** | There is a clear idea (an ivory house you walk into, the layouts as models on tables) and a held palette. It is undercut by the hall's pink and stars, a dull cover sky, a green sunset and pictures chosen without regard to their page's subject. |
| Typography | **6 / 10** | One family, a confident display setting, contrast that has clearly been measured. Marked down for old-style headline figures, 15 sizes, two footers and loose line endings. |
| Composition | **5 / 10** | The cover, the door and the map table are composed. The passes between tables are blank wall and balusters; text sits on rails and hedges; the reading pages are half empty at 1920 px. |
| Consistency | **4 / 10** | The grid is consistent. Names, units, numerals, footers, focus states, colours and motion are not. |
| Motion | **6 / 10** | The continuous camera and the move through the door are the best things on the site. The words' timing works against the product, and most control transitions are framework defaults. |
| Originality | **6 / 10** | Site models on tables in a hall is a real idea, and the film has a point of view. The execution of the hall holds it back from being memorable for the right reason. |
| Technical polish | **4 / 10** | No errors, clean navigation and correct chapter links. Against that: 41 MB of models, 13 s of dark on a first visit, an empty-frame state on slow lines, jagged edges, and a touch defect on phones. |
| Detail quality | **3 / 10** | This audit found 119 verified defects, most of them small and most of them visible without zooming once pointed out. |
| **Overall award readiness** | **4 / 10** | The concept and the interface would hold up in front of a jury. The 3D picture's finish, the state of the plans and legal pages, and the first 13 seconds would not. |

---

# 9. Fix order

**Phase 1 — Critical defects (what a buyer or juror would stop at)**

1. #62 and #63: clean originals of all three plans. *Needs the client.*
2. #81 and #82: final legal text and a company contact, or take the three pages out of the footer until there is. *Needs the client.*
3. #83: reconcile the counts with the sheets. *Needs the client's register.*
4. #2 and #1: a still under the curtain; no ceiling that lifts on nothing; text pages that do not wait on 3D. Then #4 and #3.
5. #112: the touch area and the names that stay open.
6. #73: text through the logo on every inner page.
7. #52: longer word windows at the three tables.

**Phase 2 — Systemic design issues**

8. #5 (and with it #21, #28).
9. #58, #91, #80, #79.
10. #99, #53, #90.
11. #96, #97, #98, #100.
12. #108, #105, #106, #107, #109, #111, #110.
13. #66, #68, #67, #69.
14. #78, #95.

**Phase 3 — AI-slop removal**

15. The hall: #35, #36, #34, #37, #39.
16. The house: #11, #7, #24, #32, #70.
17. The models: #41, #40.
18. The words: #84, #85, #86, #92, #93, #87, #88.

**Phase 4 — Visual consistency**

19. Outdoors: #12, #13, #15, #14, #6, #17, #16, #20, #29, #10, #25.
20. Indoors: #47, #45, #44, #50, #51, #42, #49.
21. Shading and pictures: #72, #54, #55, #71, #114, #113, #117, #65, #89, #74.

**Phase 5 — Micro-polish**

22. #8, #9, #18, #19, #22, #23, #26, #27, #30, #31, #119, #38, #48, #56, #57, #59, #60, #61, #102, #103, #101, #104, #75, #76, #77, #64, #94, #115, #116, #118.

**Phase 6 — Final pass**

23. Re-run this audit's captures at the five sizes and through the link at 8 and 20 Mbit/s; every finding above re-checked against its evidence image.
24. Real devices this audit did not have: an iPhone in Safari, a mid-range Android phone, a laptop on integrated graphics for frame rate.
25. The client's word on the findings marked "Note": #52, #46, #33, #43, #10, #101, #53, #92.

---

# Appendix A — Needs the client before anything can be built

| What | For which findings |
|---|---|
| Clean originals of the three sanctioned plans | #62, #63, #40 |
| Final legal text, registered name, a company data-protection contact | #81, #82 |
| The plot register, to reconcile counts with the sheets | #83 |
| Site photographs, approval references, dated buyer accounts | #87, #88 |
| His view on the camera-related observations and the nameplate | #46, #33, #43, #52 |

# Appendix B — Evidence index

68 images.

- [01-link-first-13-seconds.jpg](ev/01-link-first-13-seconds.jpg)
- [02-link-inner-pages-timed.jpg](ev/02-link-inner-pages-timed.jpg)
- [03-link-press-chapter-dot-wait.jpg](ev/03-link-press-chapter-dot-wait.jpg)
- [04-slow-line-8mbit-curtain-lifts-on-empty-frame.jpg](ev/04-slow-line-8mbit-curtain-lifts-on-empty-frame.jpg)
- [05-slow-line-8mbit-about-page-words-without-picture.jpg](ev/05-slow-line-8mbit-about-page-words-without-picture.jpg)
- [10-cover-1920.jpg](ev/10-cover-1920.jpg)
- [11-cover-zoom-roof-facade.jpg](ev/11-cover-zoom-roof-facade.jpg)
- [12-cover-zoom-car-pool-trees.jpg](ev/12-cover-zoom-car-pool-trees.jpg)
- [13-revolve-zoom-loungers-fringe.jpg](ev/13-revolve-zoom-loungers-fringe.jpg)
- [14-revolve-zoom-pediment-black-palms.jpg](ev/14-revolve-zoom-pediment-black-palms.jpg)
- [15-sunset-three-frames.jpg](ev/15-sunset-three-frames.jpg)
- [16-old-style-figures.jpg](ev/16-old-style-figures.jpg)
- [17-approach-zoom-roof-windows.jpg](ev/17-approach-zoom-roof-windows.jpg)
- [18-approach-zoom-pool-portico-lawn-car.jpg](ev/18-approach-zoom-pool-portico-lawn-car.jpg)
- [19-door-zoom.jpg](ev/19-door-zoom.jpg)
- [20-hall-first-frame-zoom.jpg](ev/20-hall-first-frame-zoom.jpg)
- [21-hall-frieze-stars-lamp-nameplate.jpg](ev/21-hall-frieze-stars-lamp-nameplate.jpg)
- [22-table2-zoom.jpg](ev/22-table2-zoom.jpg)
- [23-table3-zoom.jpg](ev/23-table3-zoom.jpg)
- [24-stair-pan-zoom.jpg](ev/24-stair-pan-zoom.jpg)
- [25-portrait-nameplate-lamp-zoom.jpg](ev/25-portrait-nameplate-lamp-zoom.jpg)
- [26-map-table-zoom.jpg](ev/26-map-table-zoom.jpg)
- [27-footer-film-vs-inner.jpg](ev/27-footer-film-vs-inner.jpg)
- [30-header-text-collision.jpg](ev/30-header-text-collision.jpg)
- [31-plan-detail-zoomed-2.3x.jpg](ev/31-plan-detail-zoomed-2.3x.jpg)
- [32-all-opening-frames-desktop.jpg](ev/32-all-opening-frames-desktop.jpg)
- [33-all-opening-frames-phone.jpg](ev/33-all-opening-frames-phone.jpg)
- [34-all-opening-frames-tablet.jpg](ev/34-all-opening-frames-tablet.jpg)
- [35-all-opening-frames-laptop-1366.jpg](ev/35-all-opening-frames-laptop-1366.jpg)
- [36-all-second-screens-desktop.jpg](ev/36-all-second-screens-desktop.jpg)
- [37-privacy-draft-placeholders.jpg](ev/37-privacy-draft-placeholders.jpg)
- [38-inner-reading-screens.jpg](ev/38-inner-reading-screens.jpg)
- [39-project-page-kartikeya.jpg](ev/39-project-page-kartikeya.jpg)
- [40-article-reading-a-layout-plan.jpg](ev/40-article-reading-a-layout-plan.jpg)
- [41-404-loader-then-page.jpg](ev/41-404-loader-then-page.jpg)
- [42-whyus-car-closeup.jpg](ev/42-whyus-car-closeup.jpg)
- [43-layout-page-model-and-plaque-out-of-focus.jpg](ev/43-layout-page-model-and-plaque-out-of-focus.jpg)
- [50-consent-card.jpg](ev/50-consent-card.jpg)
- [51-privacy-control-reopens-consent.jpg](ev/51-privacy-control-reopens-consent.jpg)
- [52-menu-open.jpg](ev/52-menu-open.jpg)
- [53-menu-zoom.jpg](ev/53-menu-zoom.jpg)
- [54-hover-and-focus-states.jpg](ev/54-hover-and-focus-states.jpg)
- [55-enquiry-form-filled.jpg](ev/55-enquiry-form-filled.jpg)
- [56-visit-form-date-and-wrapped-option.jpg](ev/56-visit-form-date-and-wrapped-option.jpg)
- [57-rail-hover-forms-plan-hover.jpg](ev/57-rail-hover-forms-plan-hover.jpg)
- [60-phone-rail-tap-sequence.jpg](ev/60-phone-rail-tap-sequence.jpg)
- [61-phone-film-key-frames.jpg](ev/61-phone-film-key-frames.jpg)
- [62-phone-about-plate.jpg](ev/62-phone-about-plate.jpg)
- [63-phone-about-quote-window.jpg](ev/63-phone-about-quote-window.jpg)
- [64-phone-edge-strip.jpg](ev/64-phone-edge-strip.jpg)
- [65-phone-properties-window.jpg](ev/65-phone-properties-window.jpg)
- [66-tablet-film-header-band-white-sky.jpg](ev/66-tablet-film-header-band-white-sky.jpg)
- [67-tablet-film-figures.jpg](ev/67-tablet-film-figures.jpg)
- [68-tablet-gallery-plate.jpg](ev/68-tablet-gallery-plate.jpg)
- [70-film-desktop-walk-1.jpg](ev/70-film-desktop-walk-1.jpg)
- [70-film-desktop-walk-2.jpg](ev/70-film-desktop-walk-2.jpg)
- [70-film-desktop-walk-3.jpg](ev/70-film-desktop-walk-3.jpg)
- [70-film-desktop-walk-4.jpg](ev/70-film-desktop-walk-4.jpg)
- [70-film-desktop-walk-5.jpg](ev/70-film-desktop-walk-5.jpg)
- [70-film-desktop-walk-6.jpg](ev/70-film-desktop-walk-6.jpg)
- [70-film-desktop-walk-7.jpg](ev/70-film-desktop-walk-7.jpg)
- [71-film-phone-walk-1.jpg](ev/71-film-phone-walk-1.jpg)
- [71-film-phone-walk-2.jpg](ev/71-film-phone-walk-2.jpg)
- [71-film-phone-walk-3.jpg](ev/71-film-phone-walk-3.jpg)
- [72-film-tablet-walk-1.jpg](ev/72-film-tablet-walk-1.jpg)
- [72-film-tablet-walk-2.jpg](ev/72-film-tablet-walk-2.jpg)
- [73-film-laptop-1366-walk-1.jpg](ev/73-film-laptop-1366-walk-1.jpg)
- [73-film-laptop-1366-walk-2.jpg](ev/73-film-laptop-1366-walk-2.jpg)
