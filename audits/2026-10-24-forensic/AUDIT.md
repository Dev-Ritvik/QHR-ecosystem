# Forensic visual audit, second pass — Quality Homes Reality

- **Build audited:** branch `claude/forensic-audit` at `0c6d98a` (build `XvZYCE41IFs_IVPqZcqlK`), served from this machine at http://localhost:3001. This is the build the forensic fixes ended on.
- **Audit date:** 24 October 2026, fifteen days after the first pass ([the 9 October report](../2026-10-09-forensic/AUDIT.md), 119 findings).
- **Public link:** not used, and not running. It still serves an older build, by the user's choice. Nothing in this report was measured through it.
- **Findings:** 20 on this build: 13 found today and 7 carried over from 9 October, partly fixed. Another 16 from 9 October wait on the client, and one was declined by the user. The status of all 119 is in [Appendix B](#appendix-b--the-119-findings-of-9-october-one-by-one).

## What was inspected, and how

The same method, tools and screen sizes as on 9 October, so that the two passes can be compared step for step.

- **Every page:** the film on the home page, 27 inner pages and the "page not found" page, each top to bottom at 1920×945, 1366×657, 820×1180 and 390×844. The film walked one wheel notch at a time at those four sizes and at 390×664 (a phone with its browser bars): 74, 74, 73, 143 and 146 steps.
- **About 2,850 frames**, with crops enlarged 2× to 8× wherever something looked wrong. Every evidence panel from 9 October was cut again from the same step of today's walk, so each panel pairs 9 October with today (ba-01 to ba-15).
- **Measured, not eyeballed:** the computed size, weight, spacing, colour and position of every piece of text, every control, box and image on every page at four sizes. The contrast of every line of the film's words at six sizes, at the start, middle and end of each chapter's window, and of every line on the 28 opening pictures at five sizes. The copy's patterns, page titles, share cards and meta.
- **States:** the consent card, the menu, hover, keyboard focus, the privacy panel, both forms (typed into, never sent), and a finger on a phone's chapter dots.
- **First visit:** timed at 8 and 20 Mbit/s with 80 ms latency, on a desktop and a phone; a press on a chapter's dot; every chapter link; the 404 page.
- **Where to look:** every screen of every page is in the page strips, one set per size: [desktop](ev/60-pages-desktop-01.jpg) (60-), [phone](ev/61-pages-phone-01.jpg) (61-), [tablet](ev/62-pages-tablet-01.jpg) (62-) and [laptop](ev/63-pages-laptop-01.jpg) (63-). Every notch of the film is in the walk sheets: [desktop](ev/30-film-desktop-walk-1.jpg) (30-), [phone](ev/31-film-phone-walk-1.jpg) (31-), [short phone](ev/32-film-small-phone-walk-1.jpg) (32-), [tablet](ev/33-film-tablet-walk-1.jpg) (33-) and [laptop](ev/34-film-laptop-walk-1.jpg) (34-). The opening pictures at four sizes are in 40- to 43-.

**Left out as artefacts of the tools, not of the site:** the contrast test lists "Skip to content" on every frame (the link is hidden until a keyboard reaches it). The type analyser reports "plan itself ." and "GST ] ." where a link meets a full stop; the text itself has no space. The cookie table's group labels ("Analytics", "Marketing") sit on their own line by design.

**Not covered:** Safari, Firefox and real phones (everything was Chromium); frame rate on integrated graphics; sound; sending a form; the CRM; the brochure PDF.

**The fix ledger** ([FIXES.md](../2026-10-09-forensic/FIXES.md)) was read for what it claims, and each claim was checked on today's captures wherever a capture could show it. Its final figures hold: 19 type styles in 13 sizes at 1920, two transition durations and one curve, every control at least 44 px tall on a phone, a picture under the curtain within 1.5–1.9 s at 8 and 20 Mbit/s, 28 opening pictures, 29 share cards, and no script errors. Two claims do not quite hold: "one leading per size" (#20) and "no saw-tooth under the list": the stair string is smooth now, but the list still crosses it (#3).

**Lines marked "Note"** flag a finding that touches something the client has decided (the camera, the portrait, the approved hall), or that needs something only he can supply. They are reported because they are visible, not as advice to overrule him. The film's dark last frame is his own order and is not listed.

---

# 1. Executive verdict

**Does it currently look professionally finished?** Mostly, now. Of the 119 findings of 9 October, 94 are fixed and 10 partly fixed. On a 1920×945 screen at full size, the 3D picture now holds up: the edges are smoothed, the palms are lit, the pediments are closed, the hall is panelled, the models are whole and the sunset is warm. No page throws an error at any size, and on a slow line the first visit shows a picture within two seconds. What is left in the picture is small: dotted seams in the hall's baked light, and two props seen closer than they were made for. What is left on the pages is mostly the client's to supply.

**Does it look award-ready?** Not yet. A buyer or a juror would still stop at three things, and none of them can be fixed without the client. The plans are still cropped brochure scans: a misspelling, a pasted resort photograph, a child's photograph in one corner and one sheet on its side. The legal pages are still drafts, with 25 placeholders. The plot counts do not match the plans. Of what can be fixed without him, the founder's nameplate is the most visible: it is never whole while its chapter's words are up, and at the film's distance his name reads "BIIASKARA".

**Does it contain visible AI slop?** Much less. Twelve of the thirteen tells in the picture listed on 9 October are gone, and the thirteenth, the car, is no longer shown close (replacing it is the client's call). Two kinds remain in a new form. Two of the new opening pictures show props at a distance their finish does not survive: the /branches sconces and the /terms palms. And a quarter of the headings are built in one mould ("Three offices, three districts."). The film's own copy keeps three "this, not that" lines.

**Does it contain systemic inconsistencies?** Few, and small. The still and the live picture do not line up; road widths are written two ways; one address list keeps a dash; two near-identical leadings share the reading size. The type, colour, motion, focus, footer and naming systems hold across all 28 pages and four sizes.

**What is preventing it from feeling exceptional:**

1. **The proof.** The three plans, the legal drafts and the counts (9 Oct #62, #63, #81 and #83): all the client's to supply.
2. **The founder's nameplate** (#1).
3. **The three layouts still get the least time in the film** (9 Oct #52, waiting on the client), and the third table's place line now fails contrast against the hall's new pilaster (#8).
4. **Two new opening pictures show their props too close** (#15), and they are also those pages' share cards.
5. **The copy's new mould** (#18, #2).

**What is genuinely good**, so the scores below are read in proportion:

- the unbroken move from the garden through the door into the hall, now with a warm evening and lit palms;
- the site models on their tables, now whole and lit;
- a picture under the curtain within two seconds on an 8 Mbit/s line;
- every page opening on its own picture, all 267 to 283 of their lines passing contrast at five sizes;
- one footer, one name per page, one focus ring, one curve of motion;
- a phone's chapter dots that do what a finger means;
- every chapter link landing where it should.

---

# 2. Total findings

| Class | New today | Carried over, partly fixed | Total |
|---|---|---|---|
| CRITICAL | 0 | 0 | 0 |
| HIGH | 0 | 1 | 1 |
| MEDIUM | 2 | 0 | 2 |
| LOW | 9 | 5 | 14 |
| AI-SLOP | 2 | 1 | 3 |
| SYSTEMIC | 0 | 0 | 0 |
| **Total** | **13** | **7** | **20** |

By scope: 7 isolated, 9 repeated in several places, 4 systemic. 6 carry a note about a decision of the client or something only he can supply.

From 9 October and not counted above: 14 unchanged and waiting on the client, 2 partly done whose rest waits on him, and 1 declined by the user (all 17 are listed at the end of section 4).

The 119 findings of 9 October today:

| Status | Count |
|---|---|
| Fixed | 94 (26 measured, 66 seen on the captures, 2 taken from the fix ledger and not exercised) |
| Partly fixed (the rest is a finding of this pass, or waits on the client) | 10 |
| Unchanged, waiting on the client | 14 |
| Declined by the user | 1 |
| **Total** | **119** |

---

# 3. Top 20 most important problems

This pass's findings and the unchanged client items together, by what a buyer or a juror would see first.

| # | Issue | Where | Impact | Recommended fix |
|---|---|---|---|---|
| 1 | 9 Oct #62 The three plans are cropped, marked-up brochure scans (unchanged) | /projects, /gallery, /downloads, layout pages, article | The site's proof is still its weakest picture | Clean originals from the client |
| 2 | 9 Oct #81 The legal pages are drafts with 25 placeholders (unchanged) | /privacy, /terms, /refund-policy | Disqualifying for a buyer; reads as a template | Final text from the client's lawyers, or withhold the pages |
| 3 | 9 Oct #83 The plot counts disagree with the plans (unchanged) | Film, /projects, layout pages | "Counted in full" against plans that count otherwise | The client's register |
| 4 | #1 The founder's nameplate is never whole while its words are up, and reads "BIIASKARA" | Film, the portrait, every size | The most personal mistake the site can make | Heavier lettering now; the rail and camera with the client |
| 5 | 9 Oct #52 The three tables get the least reading time (unchanged) | Film, 64–76% | The product is the least readable thing in the film | Longer word windows (not the camera), with the client |
| 6 | 9 Oct #63 The article's plan figures are blurred crops (unchanged) | /knowledge/reading-a-layout-plan | A lesson in reading plans illustrated by unreadable plans | Clean originals |
| 7 | #8 14 line positions of the film's words under 4.5:1 | Film, table 3 on wide screens; table 1 sideways; map on a short phone | The lines that say where the land is | A denser shade on the pilaster, or the lines moved |
| 8 | #15 Two new opening pictures show props too close | /branches, /terms (and their share cards) | Flat brass, white flames, faceted palms at full screen | Wider views, or props finished for the close-up |
| 9 | #18 A quarter of the headings in one mould | All inner pages | Reads as formula | Plain headings; keep the mould for a few |
| 10 | #9 A pin plate sits on the note | Film, map, 390×664 | A collision in the closing chapter | Plates clear at every phone height |
| 11 | #2 Three "this, not that" lines in the film | Film | The first page keeps the voice the inner pages lost | Positive statements, with the client's agreement |
| 12 | 9 Oct #53 Headline figures read "4o7" (unchanged) | Film, /about, /projects, layout pages | The key numbers look like a font error | One setting (--figure-nums), with the client |
| 13 | 9 Oct #33 The first hall frame cuts the portrait at the eyes (unchanged) | Film, 57.5% | The room's centrepiece first seen as a fragment | With the client (camera) |
| 14 | 9 Oct #43 Stair passes on blank wall and balusters (unchanged) | Film, 67–69% and 75–79% | Empty frames between the product's moments | With the client (camera) |
| 15 | #10 The picture slides 3–16 px when the scene takes over | Every page, first visit | Gives away the still | Stills rendered from the live camera |
| 16 | #12 Dotted seams in the hall's baked light | Film and hall pages | A rendering tell, one behind a link | Re-bake, with the client |
| 17 | #16 Page words over the picture's lettering | /properties and /about on upright screens | Two lettering layers crossing | Crop the lettering clear |
| 18 | 9 Oct #88 and #92 Quotations for another project and company; stock mission (unchanged) | /testimonials, /about | Filler where proof should be | The client's material |
| 19 | #14 A black slot in the pool's corner | Film, cover | A hole in the most-shared frame | Close or draw the corner |
| 20 | #5 and #6 Two written forms left | /about; /properties and the guide | The last of six ways to write things | One form each |

---

# 4. All findings

Numbered #1 to #20 for this pass. A finding of 9 October is written "9 Oct #n". Evidence files are in [ev/](ev/).


## From 9 October: still visible, partly fixed

### ISSUE #1 — The founder's nameplate is never whole, and reads "BIIASKARA" at the film's distance

**Severity:** HIGH

**Since 9 October:** 9 Oct #46 and #48, partly fixed: the plate's gilt edge is one clean line, and the name now clears the rail at one notch.

**Location:** Film (/), the portrait chapter: 81.5% and 82.9% of the scroll at 1920×945, 82.9% at 1366×657, 82.1% on a phone (390×844).

**Element:** The founder's nameplate under the portrait, "K. BHASKARA RAO / MANAGING DIRECTOR".

**Observation:** While the chapter's words are up, the plate is never whole. At 81.5% the stair's balusters still stand across the name. At 82.9% the name is above the rail but the second line, his title, is behind the handrail, and the same at 1366×657. On a phone the balusters run through "MANAGING DIRECTOR". At the film's distance the H of BHASKARA also loses its crossbar, so at 1920 and 1366 the name reads "K. BIIASKARA RAO". On /about's opening picture, where the same plate is drawn larger, the lettering is correct.

**Visual evidence:** The plate enlarged 4× with hard pixels at 1920 (both notches) and 1366, the phone frame, and /about's opening for comparison. At film distance the crossbar is thinner than a pixel and drops out when the texture is filtered.

**Why it matters:** The client asked for this plate to be easy to read and to "create respect". A founder's surname that reads wrong, under his own portrait, is the most personal mistake the site can make.

**Expected behavior/design:** Lettering that holds at the film's distance (a heavier cut for the name, or a plate texture whose smaller sizes keep the crossbar), and both lines clear of the rail at the notch where the chapter's words are whole.

**Likely scope:** repeated

**Related issues:** #8, #12

**Note:** The portrait, its lamp and the camera are "fine, don't touch" by the client's word; the plate's legibility is his own request. The lettering's weight can be fixed without touching any of them; moving the rail or the camera needs his word.

**Evidence files:** [24-nameplate-at-film-distance-4x.jpg](ev/24-nameplate-at-film-distance-4x.jpg), [25-nameplate-two-notches-1920-4x.jpg](ev/25-nameplate-two-notches-1920-4x.jpg), [26-nameplate-phone-title-behind-rail.jpg](ev/26-nameplate-phone-title-behind-rail.jpg), [26b-nameplate-1366-title-behind-rail.jpg](ev/26b-nameplate-1366-title-behind-rail.jpg), [26c-nameplate-on-about-opening-4x.jpg](ev/26c-nameplate-on-about-opening-4x.jpg), [ba-13-portrait-lamp-nameplate.jpg](ev/ba-13-portrait-lamp-nameplate.jpg)

### ISSUE #2 — Three "this, not that" lines left in the film

**Severity:** AI-SLOP

**Since 9 October:** 9 Oct #84, fixed on the inner pages (37 turns down to 7, four kept on purpose); the film's own copy was not counted.

**Location:** Film (/): the orbit (11–14% of the scroll), the count (22–34%), the map (87–90%).

**Element:** The film's own lines.

**Observation:** Three of the film's lines are still built as "this, not that": "We do not broker land.", "Counted from the sanctioned layout plans, not from a brochure." and "A model of the two districts, not a survey: a pin marks a district, not a place on the ground."

**Visual evidence:** The film's text read from its source (site-home/page.tsx): 230 words, four sentences with a negation, three of them contrasts.

**Why it matters:** These are the first page's headline lines; the voice the inner pages were cleared of is still the first thing a visitor reads. Seriousness: low to medium.

**Expected behavior/design:** The positive statement in each place: "We develop our own land.", "Counted from the sanctioned layout plans.", "A pin marks the district."

**Likely scope:** repeated

**Related issues:** #18

**Note:** These lines were written before the paid audits; whether the client chose them is not recorded. Ask before rewriting.

**Evidence files:** [30-film-desktop-walk-1.jpg](ev/30-film-desktop-walk-1.jpg), [30-film-desktop-walk-4.jpg](ev/30-film-desktop-walk-4.jpg)

### ISSUE #3 — The map's list still crosses the stair string

**Severity:** LOW

**Since 9 October:** 9 Oct #49, partly fixed: the pins carry their names and the rim's dotted highlight is gone.

**Location:** Film (/), the map chapter, 87–90% of the scroll, the left half, at 1920×945 and 1366×657.

**Element:** The list of the three layouts beside the map table.

**Observation:** The list's lines still run across the pale stair string: "Water" and "Vizianagaram" stand on the string and the rest of each line on the dark stair, so every line crosses a light-dark edge as it did on 9 October. The string itself is now smooth, and contrast holds (no line under 4.5:1). What remains is the busy ground.

**Visual evidence:** 2× crops of the heading and the list, 9 October beside today: the same diagonal band behind the lines' right ends.

**Why it matters:** This is the film's closing statement of what the company holds, read across the brightest edge in the frame.

**Expected behavior/design:** The list on one ground: set further left, or the string under it taken down.

**Likely scope:** isolated

**Related issues:** #9

**Evidence files:** [28-map-heading-and-list-old-new-2x.jpg](ev/28-map-heading-and-list-old-new-2x.jpg), [ba-14-map-table.jpg](ev/ba-14-map-table.jpg)

### ISSUE #4 — Dark specks at the window hood ends on the cover

**Severity:** LOW

**Since 9 October:** 9 Oct #23, partly fixed: the brackets that read as lanterns are gone.

**Location:** Film (/), the cover (0%) and the orbit (11–17%), the first-floor window hoods.

**Element:** The ends of the window hoods.

**Observation:** A dark speck of 4–6 px sits at the end of each hood, and a dark wedge at the left end of the pedimented hood. The fix ledger reads them as the hood's end face in shade and its shadow in the low sun; at 1:1 on the cover they still read as a row of dark marks across the facade.

**Visual evidence:** Three hoods enlarged 6× from today's cover.

**Why it matters:** Small marks repeated along the most looked-at facade read as dirt or as a modelling fault.

**Expected behavior/design:** Ends that read as stone in shade: a lighter end face, or a softer shadow.

**Likely scope:** repeated

**Related issues:** #12, #14

**Note:** Found and left by the fixer in Phase 6, on the reading that it is shade.

**Evidence files:** [12-cover-window-hood-ends-6x.jpg](ev/12-cover-window-hood-ends-6x.jpg), [10-cover-1920.jpg](ev/10-cover-1920.jpg)

### ISSUE #5 — /about's office list keeps a dash before the PIN

**Severity:** LOW

**Since 9 October:** 9 Oct #59, fixed everywhere but this list.

**Location:** /about, "Where it works", the list of offices, at every size.

**Element:** The three office addresses.

**Observation:** /about still writes "Visakhapatnam – 530016", with a dash before the PIN, for all three offices; /branches, /contact, the footer and the legal pages write "Visakhapatnam 530016". At 1920×945 the "– 530016" falls alone onto the last line.

**Visual evidence:** 1920 crop of the list; the source puts `&ndash;` before the PIN (about/page.tsx, line 193).

**Why it matters:** The 9 October fix gave the site one address format; this list was missed, and its stub line is the kind of loose end 9 Oct #75 removed.

**Expected behavior/design:** The site's format, with the PIN kept on the town's line.

**Likely scope:** isolated

**Related issues:** #6

**Evidence files:** [49-about-office-line-dashed-pin-1920.jpg](ev/49-about-office-line-dashed-pin-1920.jpg)

### ISSUE #6 — Road widths written two ways

**Severity:** LOW

**Since 9 October:** 9 Oct #90, mostly fixed: six ways of writing a road width are down to two.

**Location:** /properties (the size table's last column) and /investment-guide, against the three layout pages, /projects, /locations, /faqs, the article on reading a plan, and /properties' own text.

**Element:** Road widths.

**Observation:** Plot sizes are written one way everywhere (30′ × 50′). Road widths are written two ways: with the prime, "40′ and 30′ roads" (13 times, on /properties and in the guide), and with "ft", "40 ft", "20 ft", "30 ft", "33 ft" (35 times, on eight pages). /properties uses both.

**Visual evidence:** The text of all 28 pages, every road width counted.

**Why it matters:** /properties is the page that compares the layouts; its table writes widths differently from the pages it links to and from its own paragraphs.

**Expected behavior/design:** One form for road widths across the site.

**Likely scope:** repeated

**Related issues:** #5, #20

**Evidence files:** [60-pages-desktop-11.jpg](ev/60-pages-desktop-11.jpg)

### ISSUE #7 — Three footer links narrower than 44 px on a phone

**Severity:** LOW

**Since 9 October:** 9 Oct #117, fixed in height: every control on a phone is at least 44 px tall.

**Location:** Every page on a phone (390×844), the footer's last row.

**Element:** The small-print links "Privacy", "Terms", "Cookies" and "Sitemap".

**Observation:** They are 44 px tall but narrower: "Terms" 33.6 px, "Privacy" 40.0 px, "Cookies" 42.5 px ("Sitemap" 44.0). Nothing else on any page is under 44 px either way.

**Visual evidence:** Every control's box measured on all 28 pages at 390×844: these three on every page, and nothing else.

**Why it matters:** Under the 44 × 44 px touch guidance (Apple; WCAG 2.5.5) but above WCAG 2.5.8's 24 px minimum: a polish item, not a failure.

**Expected behavior/design:** Each link's touch area 44 px wide with padding; the row's look unchanged.

**Likely scope:** systemic

**Related issues:** none

**Evidence files:** [61-pages-phone-01.jpg](ev/61-pages-phone-01.jpg)

## Found today: the film

### ISSUE #8 — The film's place lines under 4.5:1 against the hall's new pilaster

**Severity:** MEDIUM

**Location:** Film (/): the third table (VSR Gayatri Township, 74–76% of the scroll) at 1920×945 and 1366×657; the first and third tables on a phone held sideways (844×390); the map chapter on a short phone (390×664).

**Element:** The tables' place and count lines, and the map's note.

**Observation:** 14 line positions fall under the 4.5:1 contrast the film's copy is held to. At 1920×945 "Srikakulam" stands on the lit pilaster behind table 3 at 3.60:1 and 3.63:1, and "113 of 113 plots open" at 4.40:1. At 1366×657, "Srikakulam" 3.63:1 (twice), the count 4.40:1 and "Bayyannapeta, near Allinagaram" 4.47:1. At 844×390, table 1's "Vizianagaram" is 3.63 to 3.85:1 at all three positions, and table 3's place line 3.84 to 4.40:1. At 390×664 the map's note is 4.31:1. At 390×844 and 820×1180 every line passes.

**Visual evidence:** Each line measured on its own box against the clean frame (words hidden), at the brightest tenth of the ground, at the start, middle and end of its chapter's window, at six sizes: the film's own strict test (rests.mjs and pages_full.py). On 6 October the same test found nothing at nine sizes. Crop of table 3 at 1920: the place line over the pale pilaster.

**Why it matters:** These lines say where each layout is. The hall's new panelling and light put a pale pilaster behind them where the dark wainscot used to be.

**Expected behavior/design:** Every line of the film at 4.5:1 or better at every size: a denser shade behind the place lines where they cross the pilaster, or the lines set clear of it.

**Likely scope:** repeated

**Related issues:** #1, #9

**Note:** The test also lists "Skip to content" on every frame. That link is hidden until a keyboard reaches it and is not counted here.

**Evidence files:** [23-table3-three-positions-1920.jpg](ev/23-table3-three-positions-1920.jpg), [23b-table3-place-line-on-the-pilaster-2x.jpg](ev/23b-table3-place-line-on-the-pilaster-2x.jpg)

### ISSUE #9 — A pin plate sits on the map's note on a short phone

**Severity:** MEDIUM

**Location:** Film (/), the map chapter on a short phone (390×664), 84–87% of the scroll.

**Element:** The pins' name plates and the note above the map.

**Observation:** The "VSR GAYATRI TOWNSHIP" plate's top edge runs into the note's last line ("district, not a place on the ground."), and the "KARTIKEYA WATER FRONT" plate runs out to the chapter dots at the right edge. At 390×844 the plates and the note stand apart.

**Visual evidence:** The 390×664 walk at 85.7%: the plate's border crosses the last line of the note.

**Why it matters:** 390×664 is how a phone shows the page with its browser bars up. A label sitting on a line of text reads as a layout fault, in the chapter that closes the film.

**Expected behavior/design:** The plates clear of the note and of the dots at every phone height.

**Likely scope:** isolated

**Related issues:** #8, #3

**Evidence files:** [29-map-small-phone-pin-plate-on-note.jpg](ev/29-map-small-phone-pin-plate-on-note.jpg), [32-film-small-phone-walk-2.jpg](ev/32-film-small-phone-walk-2.jpg)

### ISSUE #10 — The picture slides when the live scene replaces the still

**Severity:** LOW

**Location:** Every inner page's opening picture and the film's cover, when the live scene takes over from the still: about 13 s into a first visit at 20 Mbit/s, 23 s at 8 Mbit/s, sooner on a fast line.

**Element:** The picture under the words.

**Observation:** The still and the live frame do not line up. As the still dissolves into the scene, the picture slides 3 to 11 px to the right on most pages (16 px on /knowledge) and up to 9 px vertically, and comes up about a fifth sharper. On /why-us the portico moves 10.8 px to the right between two frames of the same first visit.

**Visual evidence:** Each page's still file, placed as the page places it, against its live frame at 1920×945 (phase correlation on the picture's right half): a horizontal shift of 1 to 16 px on all 28 pages, always the same way. /why-us at 12.5 s and 15 s of a 20 Mbit/s visit: 10.8 px across and 0.7 px down, edges ×1.19 stronger. The film's cover moves 2 px.

**Why it matters:** A picture that nudges and sharpens seconds after it arrived gives away that it was two pictures. It happens on every first visit, while the visitor is reading the title.

**Expected behavior/design:** Stills rendered from the live camera at the size and crop they are shown at, so that the dissolve changes nothing but life.

**Likely scope:** systemic

**Related issues:** #11

**Evidence files:** [05-still-to-live-why-us-difference.jpg](ev/05-still-to-live-why-us-difference.jpg), [05b-still-to-live-portico-4x.jpg](ev/05b-still-to-live-portico-4x.jpg)

### ISSUE #11 — After a chapter press, its words arrive before its picture

**Severity:** LOW

**Location:** Film (/), the first 0.3 to 0.7 s after a press on a hall chapter's dot (tested on Lucky Garden at 20 Mbit/s).

**Element:** The chapter's words and the picture under them.

**Observation:** The words arrive before their picture: at 0.3 s "Lucky Garden / Kumaram Village, Garividi · Vizianagaram / 118 of 181 plots open" stand over the misty garden of the cover. By 0.7 s the table's still is in, and the live hall follows at 16 to 22 s with no dark wait (9 Oct #3 is fixed).

**Visual evidence:** Frames 300 ms and 700 ms after the press.

**Why it matters:** It is brief, but it is the first thing a visitor sees after choosing a layout.

**Expected behavior/design:** The words held back until the chapter's still is in.

**Likely scope:** isolated

**Related issues:** #10

**Evidence files:** [03-press-lucky-garden-20mbit.jpg](ev/03-press-lucky-garden-20mbit.jpg), [03b-press-300ms-words-over-the-garden.jpg](ev/03b-press-300ms-words-over-the-garden.jpg)

### ISSUE #12 — Dotted seams in the hall's baked light

**Severity:** LOW

**Location:** Film (/) and the hall's opening pictures: the stair's string and newel (73% of the scroll), a panel moulding behind table 1 (62%), the moulding behind "Who we are" at the portrait (83%).

**Element:** Thin faces in the hall's baked light.

**Observation:** Faces narrower than a texel of the baked light read as dotted or dashed lines at 1:1. The stair string that was closed for 9 Oct #44 now carries a row of dark dots along its length, and a black slot 3 to 4 px wide runs down the side of the newel post. A panel moulding's inner edge is still dashed, fainter than on 9 October. At the portrait, a broken dark line runs right behind the "WHO WE ARE" link.

**Visual evidence:** 3× and 6× crops, 9 October beside today: the string's dots came with the closed string; the moulding's dashes are the ones the fix ledger found and left.

**Why it matters:** Dotted lines on smooth plaster are a rendering tell, and one of them runs behind a link the visitor is asked to press.

**Expected behavior/design:** The thin faces given texels of their own in a re-bake, or left out of the baked light.

**Likely scope:** repeated

**Related issues:** #4, #17, #13

**Note:** The fix ledger left these because a re-bake touches the whole of the approved hall; it needs the client's agreement.

**Evidence files:** [21-stair-rods-and-string-old-new-3x.jpg](ev/21-stair-rods-and-string-old-new-3x.jpg), [22-stair-newel-slot-and-string-dots-6x.jpg](ev/22-stair-newel-slot-and-string-dots-6x.jpg), [20-hall-column-and-panel-moulding-old-new-3x.jpg](ev/20-hall-column-and-panel-moulding-old-new-3x.jpg), [27-portrait-link-on-a-dashed-line-3x.jpg](ev/27-portrait-link-on-a-dashed-line-3x.jpg)

### ISSUE #13 — Stair rods broken into white dashes

**Severity:** LOW

**Location:** Film (/), the stair pass, 72–74% of the scroll.

**Element:** The brass stair rods across the carpet.

**Observation:** Each rod breaks into segments with bright white dashes along it, and a white fleck sits in the middle of one tread. The same on 9 October; it was not reported then.

**Visual evidence:** 3× crop of the carpet, 9 October beside today.

**Why it matters:** Fine bright metal that breaks into dashes is the sparkle fault fixed on the car's sill (9 Oct #26).

**Expected behavior/design:** Continuous rods, with the car's treatment.

**Likely scope:** isolated

**Related issues:** #12

**Evidence files:** [21-stair-rods-and-string-old-new-3x.jpg](ev/21-stair-rods-and-string-old-new-3x.jpg)

### ISSUE #14 — A black slot at the pool's corner on the cover

**Severity:** LOW

**Location:** Film (/), the cover (0%), the pool at the lower left.

**Element:** The pool's near corner and its far edge.

**Observation:** At the near corner a black slot with a white block in it reads as a hole in the deck (about 20 × 12 px at 1920). Along the far edge the coping is doubled by a stepped dark line. Both were there on 9 October and were not reported.

**Visual evidence:** 5× crops of the cover, 9 October beside today.

**Why it matters:** Small, but in the cover: the frame everyone sees first and the one that gets shared.

**Expected behavior/design:** The corner closed, or drawn as what it is (an overflow, a step); one coping line.

**Likely scope:** isolated

**Related issues:** #4

**Evidence files:** [11-cover-pool-corner-and-far-edge-old-new-5x.jpg](ev/11-cover-pool-corner-and-far-edge-old-new-5x.jpg), [10-cover-1920.jpg](ev/10-cover-1920.jpg)

## Found today: the pages

### ISSUE #15 — Two new opening pictures show their props too close

**Severity:** AI-SLOP

**Location:** /branches (the opening picture, and its picture band halfway down) and /terms (the opening picture), at every size; both pictures are also those pages' share cards.

**Element:** The new opening pictures that bring props close.

**Observation:** /branches opens on two wall sconces on a blank wall, and its band fills half the screen with one of them: the brass is a flat ochre with no reflection of the room, and the flames are neutral white cones (their brightest pixels 201, 199, 195 and 216, 216, 211; a candle's core is warm). /terms opens on the palm avenue with the fronds at their nearest: faceted, flat-shaded leaves, a hard band of colour at the crown, and gate piers that are blank slabs.

**Visual evidence:** 2× crops of the sconces in the opening and in the band, and of the palms and piers; colour measured on the flames.

**Why it matters:** Giving each page its own picture was the right fix for 9 Oct #66. Two of the new pictures show props at a distance their finish was not made for, and these are the pictures that travel when the pages are shared. Seriousness: medium.

**Expected behavior/design:** Views that keep these props at the distance they were made for, or props finished for the close-up: brass that reflects, a flame with a warm core, palms with leaf detail.

**Likely scope:** repeated

**Related issues:** #17, #16

**Note:** The palms are among the five AI-generated models named on 9 October.

**Evidence files:** [44-branches-band-sconce-1920.jpg](ev/44-branches-band-sconce-1920.jpg), [44b-branches-opening-sconces-2x.jpg](ev/44b-branches-opening-sconces-2x.jpg), [46-terms-opening-palms-and-piers-2x.jpg](ev/46-terms-opening-palms-and-piers-2x.jpg), [56-share-cards-all-pages.jpg](ev/56-share-cards-all-pages.jpg)

### ISSUE #16 — Page words set over the picture's own lettering

**Severity:** LOW

**Location:** /properties on a phone (390×844) and a tablet (820×1180), the opening picture; /about on a phone, the opening picture.

**Element:** The page's first words over lettering in the picture.

**Observation:** On /properties the title "Six plot sizes, measured off the plans." is set across the plaque's engraved "VSR GAYATRI TOWNSHIP", so two sets of capitals cross. On /about the kicker "The company" stands against the founder's nameplate.

**Visual evidence:** Crops of both openings. Contrast holds (no failures in 267 to 283 lines of the opening pictures at five sizes); the composition does not.

**Why it matters:** Two layers of lettering crossing look unplanned, and each makes the other harder to read.

**Expected behavior/design:** The picture's lettering kept clear of the page's words on upright screens.

**Likely scope:** repeated

**Related issues:** #9, #15

**Evidence files:** [47-properties-phone-title-on-plaque.jpg](ev/47-properties-phone-title-on-plaque.jpg), [47b-properties-tablet-title-on-plaque.jpg](ev/47b-properties-tablet-title-on-plaque.jpg), [48-about-phone-kicker-on-nameplate.jpg](ev/48-about-phone-kicker-on-nameplate.jpg)

### ISSUE #17 — A black slit and striped shading in /branches' band on a tablet

**Severity:** LOW

**Location:** /branches on a tablet held upright (820×1180), the picture band halfway down.

**Element:** The wall panel at the foot of the band.

**Observation:** A black slit runs the width of a wall panel where it meets its bottom rail, and a patch of diagonal stripes (a shadow fault) sits in the panel's corner.

**Visual evidence:** The band at 1:1, and the striped patch at 5×.

**Why it matters:** A black line across a pale wall and striped shading both read as render errors.

**Expected behavior/design:** The panel closed onto its rail; the corner shaded smoothly.

**Likely scope:** isolated

**Related issues:** #12, #15

**Evidence files:** [45-branches-tablet-black-slit.jpg](ev/45-branches-tablet-black-slit.jpg), [45b-branches-tablet-hatched-shadow-5x.jpg](ev/45b-branches-tablet-hatched-shadow-5x.jpg)

### ISSUE #18 — A quarter of the headings built in one mould

**Severity:** AI-SLOP

**Location:** All inner pages, the first- and second-level headings.

**Element:** How the headings are built.

**Observation:** With the "this, not that" turns gone, one mould now carries the headings: a phrase, a comma, and a paired or counted phrase. 31 of the 123 distinct first- and second-level headings take it: "Twenty years, counted.", "Three layouts, counted.", "Three offices, three districts.", "Three addresses, one room.", "Three addresses, one telephone number.", "Two roles, both in sales.", "Two pieces, ten minutes.", "Which layout, and when.", "What we collect, and when.", "What it needs, and what it keeps.", "Whose sanction, and how to check it.", "The five, and where to check each." and 19 more.

**Visual evidence:** Headings read from all 28 pages at 1920×945.

**Why it matters:** A shape used on a quarter of the headings reads as a formula. That kind of repetition is how readers recognise generated copy, and it makes the pages sound alike. Seriousness: low to medium.

**Expected behavior/design:** Most headings saying plainly what the section holds ("The offices", "How to apply"), with the mould kept for the few places it earns.

**Likely scope:** systemic

**Related issues:** #2, #19

**Evidence files:** [60-pages-desktop-01.jpg](ev/60-pages-desktop-01.jpg), [60-pages-desktop-02.jpg](ev/60-pages-desktop-02.jpg), [60-pages-desktop-05.jpg](ev/60-pages-desktop-05.jpg)

### ISSUE #19 — The sign-off line said twice on two pages

**Severity:** LOW

**Location:** /book-a-site-visit and /sitemap.

**Element:** The sign-off line "The land is best seen from the land."

**Observation:** Every page closes on this line, which is the design. Two pages also use it higher up: as the quotation over /book-a-site-visit's picture band, and as the head note of /sitemap's last section, each a screen or two above the same line closing the page.

**Visual evidence:** The text of both pages at 1920×945 (at 3,719 and 5,667 px down /book-a-site-visit; at 4,113 and 5,160 px down /sitemap); page strips.

**Why it matters:** The line works as a sign-off because it is said once, at the end.

**Expected behavior/design:** Another line in those two places.

**Likely scope:** repeated

**Related issues:** #18

**Evidence files:** [60-pages-desktop-01.jpg](ev/60-pages-desktop-01.jpg), [60-pages-desktop-12.jpg](ev/60-pages-desktop-12.jpg)

### ISSUE #20 — Two leadings at the reading size

**Severity:** LOW

**Location:** All inner pages: the standfirst under each title, against the running text.

**Element:** Line spacing at the reading size.

**Observation:** The standfirst and the running text are the same size at two line spacings: 22.5 px on 32 and on 36 px at 1920×945; on a phone 18.06 px on 28 and on 28.89 px, two values under a pixel apart. Everywhere else one size has one leading, as the type clean-up intended.

**Visual evidence:** Computed styles of every text on the 28 pages at 1920×945 and 390×844.

**Why it matters:** Two settings that look almost alike are the near-duplicates that 9 Oct #96 removed elsewhere.

**Expected behavior/design:** One leading for the size, or a standfirst one step larger so that the difference is meant.

**Likely scope:** systemic

**Related issues:** #6

**Evidence files:** [60-pages-desktop-01.jpg](ev/60-pages-desktop-01.jpg)

## From 9 October: unchanged, waiting on the client

These are still visible on today's build. Each needs something only the client can supply or decide; none is counted in section 2's table. One more is the user's own decision.

| 9 Oct # | Then | Visible today | What it needs | Evidence |
|---|---|---|---|---|
| 62 | CRITICAL | The same three plan files (dated 4 August): Lucky Garden's "FUTURE EXTENTION" and the pasted resort photograph; a child's photograph in the corner of Kartikeya's sheet (on /gallery, beside "Look closer"); Gayatri's sheet on its side | Clean originals | [55-gallery-gayatri-plan-sideways.jpg](ev/55-gallery-gayatri-plan-sideways.jpg), [51-states-desktop-forms.jpg](ev/51-states-desktop-forms.jpg) |
| 81 | CRITICAL | 25 placeholders under "Draft — not yet in force": /privacy 5, /terms 9, /refund-policy 11 | Final legal text, registered name, RERA numbers | [60-pages-desktop-09.jpg](ev/60-pages-desktop-09.jpg), [60-pages-desktop-12.jpg](ev/60-pages-desktop-12.jpg) |
| 63 | HIGH | The article's four plan figures are crops of the same scans | Clean originals | [60-pages-desktop-07.jpg](ev/60-pages-desktop-07.jpg) |
| 83 | HIGH | 113, 181 and 113 plots (407), beside plans numbered to 101, 189 and 204 (as read on 7 October) | The plot register | [ba-05-count-figures.jpg](ev/ba-05-count-figures.jpg) |
| 52 | HIGH | Notch for notch as on 9 October: tables 1 and 2 whole for one notch at 1920, table 3 for none; the count for nine | His word on the words' timing (not the camera) | [30-film-desktop-walk-3.jpg](ev/30-film-desktop-walk-3.jpg) |
| 53 | MEDIUM | "344 407 3" in old-style figures on the film, /about, /projects and the layout pages; lining figures are one setting (`--figure-nums` in globals.css) | His word (the $300 audit asked to keep them) | [ba-05-count-figures.jpg](ev/ba-05-count-figures.jpg) |
| 33 | MEDIUM | The first frame through the door still shows the portrait's lower half, cut at the eyes | His word on the camera | [ba-09-hall-first-frame.jpg](ev/ba-09-hall-first-frame.jpg) |
| 43 | MEDIUM | Frames of blank wall and out-of-focus balusters between the tables (desktop 75.8%, tablet 76.5%, phone 76–80%) | His word on the camera | [33-film-tablet-walk-2.jpg](ev/33-film-tablet-walk-2.jpg), [31-film-phone-walk-3.jpg](ev/31-film-phone-walk-3.jpg) |
| 10 | MEDIUM | The flat roof deck | His decision ("fully flat") | [10-cover-1920.jpg](ev/10-cover-1920.jpg) |
| 88 | MEDIUM | Three undated quotations naming "Quality Homes Reality Services", "Eden Garden" and "Vizag", now with a note saying which development each speaks of | Dated accounts from buyers of these layouts | [60-pages-desktop-14.jpg](ev/60-pages-desktop-14.jpg) |
| 87 | MEDIUM | The sections announcing their own absence are gone (done); photographs and approval references are still missing | Photographs, approval references | — |
| 51 | LOW | The hall's arched windows are flat cards | His word | [30-film-desktop-walk-3.jpg](ev/30-film-desktop-walk-3.jpg) |
| 30 | LOW | The palm and the hedge are out of the cover (done); the fountain bowl is still cut by the bottom-right edge | The approved camera | [13-cover-zoom-2x.jpg](ev/13-cover-zoom-2x.jpg) |
| 101 | LOW | The mark's ivory tile in the header | The mark is his | [10-cover-1920.jpg](ev/10-cover-1920.jpg) |
| 70 | AI-SLOP | Gone from /why-us; the film's approach still shows the car at the door | His word on replacing it | [ba-07-approach-portico-car.jpg](ev/ba-07-approach-portico-car.jpg) |
| 92 | AI-SLOP | "India's leading and most trusted…", "world-class amenities, best-in-class security and unmatched value" on /about, set down as the company prints them | His words | [60-pages-desktop-01.jpg](ev/60-pages-desktop-01.jpg) |
| 89 | MEDIUM | The founder's motto in the system's own Telugu face | Declined by the user on 24 October; not raised again | — |

---

# 5. Systemic problems

What recurs in this pass. Each is far smaller than its 9 October counterpart.

| # | Recurring problem | How often | Findings |
|---|---|---|---|
| S1 | **Thin faces in the hall's baked light** | A row of dots on the stair string, a slot down the newel, dashes on a moulding, a broken line behind a link, a black slit on a tablet's band | #12, #17, #4 |
| S2 | **Props seen closer than they were made for** | The /branches sconces at half the screen, the /terms palms at full height, the stair rods at the stair pass | #15, #13 |
| S3 | **The film's words against the hall's new light** | 14 line positions under 4.5:1, at three of six sizes | #8 |
| S4 | **Words over words** | A title across a plaque's lettering, a kicker against the nameplate, a pin plate on the map's note, a list across the stair string | #16, #9, #3 |
| S5 | **Two pictures where there should be one** | The still and the live scene on every first visit; a chapter's words before its picture | #10, #11 |
| S6 | **The copy's mould** | 31 of 123 headings; three of the film's lines; one sign-off said twice on two pages | #18, #2, #19 |
| S7 | **Written forms not quite one** | Road widths 13 times with a prime and 35 with "ft"; one list with a dashed PIN; two leadings at the reading size | #6, #5, #20 |
| S8 | **What only the client can supply** | Plans, legal text, counts, buyers' accounts, photographs | 9 Oct #62, #63, #81, #83, #87, #88 |

---

# 6. AI-slop report

"AI slop" here means a visible tell, not a judgment of how something was made.

**Still visible**

| Element | Evidence | Finding |
|---|---|---|
| Sconces on /branches | Flat ochre brass with no reflection; neutral white flame cones; a blank wall; the page's share card | #15 |
| Palms on /terms, close up | Faceted fronds and a hard colour band at the crown (one of the five AI-generated models named on 9 October) | #15 |
| Stair rods | Broken into segments with white dashes | #13 |
| Dotted seams | A row of dots along the stair string; dashes along a moulding | #12 |
| One heading mould | 31 of 123 headings: "Three offices, three districts.", "Twenty years, counted.", "Which layout, and when." | #18 |
| "This, not that" in the film | "We do not broker land."; "…not from a brochure."; "…not a survey: a pin marks a district, not a place on the ground." | #2 |
| The car, close up | No longer on /why-us; still at the door in the film | 9 Oct #70 (the client's) |
| Stock mission phrases | "world-class amenities, best-in-class security and unmatched value" | 9 Oct #92 (the client's words) |

**Gone since 9 October** (each checked on today's frames): the star frieze; the flat yellow "gold"; one wood grain at three scales; the slab wainscot; the traced models' hole and blank slab; the wedge pediments; the corrugated window; the black palms; the wedge loungers and disc parasols; three kinds of water; the blue flames and lamp; the bowl capitals; colour fringe and floating motes. In the words: 30 of 37 "this, not that" turns, 31 of 38 sentences about the site itself, 53 of 54 repeated sentences, and the developer's question in the FAQ.

**What does not read as generated:** the typeface and its display setting, the header, the inner pages' grid, the forms, the menu, the consent card and privacy panel, the chapter dots, the hall and its tables at the film's distance, and the evening light.

---

# 7. Design-system inconsistencies

| Component | Expected pattern | Today | Locations | Severity |
|---|---|---|---|---|
| Type sizes | One scale | 13 sizes at 1920 (11 at 1366, 12 at 820, 10 at 390), 19 styles; the mark's wordmark at 16.8 px is part of the mark | Site-wide | Holds |
| Leading | One per size | One per size, except the reading size: 22.5 px on 32 and 36 at 1920; 18.06 px on 28 and 28.89 on a phone | Standfirst against running text | LOW #20 |
| Small capitals | One size and spacing | 10.75 px at 0.3 em at 1920; 10.41 px on a phone | Header and actions | Holds |
| Numerals | Lining for figures and tables | Lining in forms and tables; display figures old-style ("4o7") | Film count, /about, /projects, layout pages | MEDIUM, the client's (9 Oct #53) |
| Units | One written form | Plot sizes one form; road widths two (13 with a prime, 35 with "ft"); PINs one form except on /about | /properties, the guide; /about | LOW #6, #5 |
| Heading punctuation | One rule per level | First and second levels stopped, third not, on all 28 pages | Inner pages | Holds |
| Heading construction | Varied, plain | 31 of 123 headings in one comma mould | Inner pages | AI-SLOP #18 |
| Colour | Two gilts, a few ivories | Four ivory strengths, two gilts, and the mark's gilt: 7 text colours (16 on 9 October) | Site-wide | Holds |
| Motion | Two durations, one curve | 0.3 s and 0.5 s, one curve, over 1,186 transitions | All controls | Holds |
| Focus | One ring | 2 px gilt at 4 px on every stop | All pages | Holds |
| Form fields | One drawn style and size | One size; a drawn date control; no resize grip | Both forms | Holds |
| Touch targets | 44 × 44 px | All 44 px tall; three footer links 33.6–42.5 px wide | Every page on a phone | LOW #7 |
| Opening pictures | One per subject, one height rule | 28 pictures for 28 pages, two heights by rule; two show props too close | Inner pages | AI-SLOP #15 |
| Still and live picture | One picture | 1–16 px apart on all 28 pages; the live a fifth sharper | Every page, first visit | LOW #10 |
| Film copy contrast | 4.5:1 per line, every size | 14 line positions under, at 1920, 1366, 844×390 and 390×664 | Tables 1 and 3, the map | MEDIUM #8 |
| Opening pictures' contrast | 4.5:1 per line, every size | Every line passes at five sizes; the tightest ×1.44 over the threshold | 28 pages | Holds |
| Footer | One | One, on the film and on every page | Site-wide | Holds |
| Page names | One per page | One per page in the menu, footer, titles and 404 | Site-wide | Holds |
| Closing block | One label set | "Next" and "Back to"; the sign-off line twice on two pages | All pages; /book-a-site-visit, /sitemap | LOW #19 |

---

# 8. Awwwards readiness

Scores are for the build as it stands today, on the evidence above, beside the 9 October scores.

| Criterion | 9 Oct | Today | Why |
|---|---|---|---|
| Visual craft | 4 | **6 / 10** | The 3D picture now survives a close look at 1920: smoothed edges, lit palms, closed pediments, a panelled hall, whole models. Held back by the plans, which are still scans; by two props shown too close; and by dotted seams in the hall's light. |
| Art direction | 5 | **7 / 10** | A warm evening, a slate cover sky, one hall material system, and a picture chosen for each page's subject. The weak spots are two of those pictures and the heading mould. |
| Typography | 6 | **7 / 10** | One scale, 19 styles, one small-capital size, lining figures in tables and forms. Held back by the old-style display figures (the client's call) and a near-duplicate leading. |
| Composition | 5 | **6 / 10** | The film's words stand on plain ground nearly everywhere, and the reading pages fill the wide screen. Held back by words over lettering on two openings, a collision on a short phone, and the empty stair passes (the client's camera). |
| Consistency | 4 | **7 / 10** | Names, footers, focus, motion, colour and type now hold across 28 pages and four sizes. Two written forms and one leading remain. |
| Motion | 6 | **6 / 10** | The continuous camera and the move through the door are still the best things on the site. The tables' word timing is unchanged, and the still slides when the scene takes over. |
| Originality | 6 | **6 / 10** | The same idea: site models on tables in a hall you walk into. The execution no longer gets in its way, but the idea itself has not changed. |
| Technical polish | 4 | **7 / 10** | No errors at any size; a picture within two seconds on a slow line; working chapter links and press; a fixed phone rail. Against that: 14 contrast misses in the film's words, and the still-to-live slide. |
| Detail quality | 3 | **6 / 10** | 20 findings, 14 of them LOW, most visible only at 1:1 once pointed out. |
| **Overall award readiness** | 4 | **6 / 10** | The picture, the interface and the system are now at a professional standard. What holds the score here is mostly the client's: the plans, the legal pages and the counts. Of what remains to build, the nameplate is the most visible. |

---

# 9. Fix order

**Phase 1 — Critical defects (each needs the client)**

1. 9 Oct #62 and #63: clean originals of the three plans.
2. 9 Oct #81: final legal text, or the three pages withheld until it exists.
3. 9 Oct #83: the counts reconciled with the plot register.

**Phase 2 — Systemic design issues**

4. #8: the film's words back to 4.5:1 at every size, then the strict test run again at all nine sizes.
5. #10 and #11: stills rendered from the live camera at their shown size and crop, and the words held until their picture is in.
6. #6, #5, #20.

**Phase 3 — AI-slop removal**

7. #15: new views for /branches and /terms, or props finished for the close-up; their share cards re-shot with them.
8. #18, then #2 with the client's agreement, then #19.

**Phase 4 — Visual consistency**

9. #1: heavier lettering at once; the rail or the camera only with the client's word.
10. #16, #9, #3.
11. #12 and #17: a re-bake of the hall's light, which needs the client's agreement because it touches the approved hall.

**Phase 5 — Micro-polish**

12. #14, #4, #13, #7.

**Phase 6 — Final pass**

13. This audit's captures again at the five sizes, the film's strict contrast test at nine sizes, and the opening pictures at five. Then the first visit through the public link at 8 and 20 Mbit/s, once the user has put this build behind it.
14. Real devices this audit did not have: an iPhone in Safari, a mid-range Android phone, and a laptop on integrated graphics for frame rate.
15. The client's word on everything in Appendix A.

---

# Appendix A — Needs the client before anything can be built

| What | For which findings |
|---|---|
| Clean originals of the three sanctioned plans | 9 Oct #62, #63 |
| Final legal text: registered name and identifiers, RERA numbers, booking, payment and refund terms | 9 Oct #81 |
| The plot register, to reconcile the counts with the plans | 9 Oct #83 |
| Site photographs, approval references, dated accounts from buyers of these layouts | 9 Oct #87, #88 |
| His word on the camera and the portrait: the nameplate's rail, the first hall frame, the stair passes, the fountain at the cover's edge | #1, 9 Oct #33, #43, #30 |
| His word on the tables' word timing (not the camera) | 9 Oct #52 |
| His word on a re-bake of the approved hall's light | #12, #17 |
| His word on the film's own lines, the old-style figures, the flat roof, the hall windows, the car, the logo tile and the mission text | #2, 9 Oct #53, #10, #51, #70, #101, #92 |

# Appendix B — The 119 findings of 9 October, one by one

"Checked" says how each status was established today: **measured** (by numbers on today's captures), **seen** (on today's frames, beside 9 October's where a panel exists), or **ledger** (taken from the fix ledger and not exercised in this pass).

| 9 Oct # | Finding | Status | Checked | Today | Evidence |
|---|---|---|---|---|---|
| 1 | load-dark-wait | Fixed | measured | The curtain lifts on the still at 1.5–1.9 s at 8 and 20 Mbit/s (film, /about, /why-us, phone). | [01-load-8mbit-film-first-visit.jpg](ev/01-load-8mbit-film-first-visit.jpg), [02-load-8mbit-about-first-visit.jpg](ev/02-load-8mbit-about-first-visit.jpg) |
| 2 | load-slow-line-empty | Fixed | measured | At 8 Mbit/s the cover's still is up from 2.5 s until the scene goes live at 23 s. | [01-load-8mbit-film-first-visit.jpg](ev/01-load-8mbit-film-first-visit.jpg) |
| 3 | load-press-wait | Fixed | measured | The chapter's still is up 0.7 s after a press at 20 Mbit/s; no dark wait. The words come 0.3 s early: #11. | [03-press-lucky-garden-20mbit.jpg](ev/03-press-lucky-garden-20mbit.jpg) |
| 4 | load-404-curtain | Fixed | measured | Title and message at 0.3 s. | [04-404-first-five-seconds.jpg](ev/04-404-first-five-seconds.jpg) |
| 5 | aa-none | Fixed | seen | Smoothed edges in every before/after panel. | [ba-01-cover-roof-and-facade.jpg](ev/ba-01-cover-roof-and-facade.jpg), [ba-04-orbit-palms-pediment.jpg](ev/ba-04-orbit-palms-pediment.jpg) |
| 6 | cover-flat-sky | Fixed | measured | The band behind the headline: RGB 94, 95, 94 then; 79, 91, 106 (a slate) now. | [10-cover-1920.jpg](ev/10-cover-1920.jpg) |
| 7 | pediment-wedge | Fixed | seen | Closed. | [ba-06-approach-pediment-windows.jpg](ev/ba-06-approach-pediment-windows.jpg) |
| 8 | cover-pediment-seam | Fixed | seen | No black line on the raking edge. | [ba-01-cover-roof-and-facade.jpg](ev/ba-01-cover-roof-and-facade.jpg) |
| 9 | roof-balustrade-gap | Fixed | seen | The rear balustrade is continuous. | [ba-01-cover-roof-and-facade.jpg](ev/ba-01-cover-roof-and-facade.jpg) |
| 10 | roof-lid | Client | seen | Unchanged, by his decision ("fully flat"). | [10-cover-1920.jpg](ev/10-cover-1920.jpg) |
| 11 | gold-accents | Fixed | seen | The balls under the cornice and the column bands are gone; gilt on the roundel and finials reflects. | [ba-07-approach-portico-car.jpg](ev/ba-07-approach-portico-car.jpg), [ba-08-door-capitals.jpg](ev/ba-08-door-capitals.jpg) |
| 12 | palms-black | Fixed | measured | Palm foliage saturation at 11% of the film: 0.25 then, 0.50 now; lit like the trees beside them. | [ba-04-orbit-palms-pediment.jpg](ev/ba-04-orbit-palms-pediment.jpg) |
| 13 | fog-discontinuity | Fixed | seen | Palms, trees and wall fade with distance together. | [ba-04-orbit-palms-pediment.jpg](ev/ba-04-orbit-palms-pediment.jpg) |
| 14 | sunset-green | Fixed | measured | The glow's hue at the same four steps: 38° then, 31° now. | [30-film-desktop-walk-2.jpg](ev/30-film-desktop-walk-2.jpg) |
| 15 | stone-two-colours | Fixed | seen | Shaded stone is the lit stone, darker. | [ba-04-orbit-palms-pediment.jpg](ev/ba-04-orbit-palms-pediment.jpg) |
| 16 | lawn-plastic | Fixed | seen | Mown bands and grain. | [ba-07-approach-portico-car.jpg](ev/ba-07-approach-portico-car.jpg) |
| 17 | pool-inconsistent | Fixed | seen | One water. A black slot at the near corner was missed by both passes: #14. | [ba-03-orbit-11pct.jpg](ev/ba-03-orbit-11pct.jpg) |
| 18 | bollards-daylight | Fixed | seen | Off by day. | [ba-03-orbit-11pct.jpg](ev/ba-03-orbit-11pct.jpg) |
| 19 | glass-rail-dotted | Fixed | seen | A continuous handrail. | [ba-02-cover-pool-car-trees.jpg](ev/ba-02-cover-pool-car-trees.jpg) |
| 20 | loungers-primitives | Fixed | seen | Loungers with form; parasols on poles. | [ba-03-orbit-11pct.jpg](ev/ba-03-orbit-11pct.jpg) |
| 21 | colour-fringe | Fixed | seen | Gone. | [ba-03-orbit-11pct.jpg](ev/ba-03-orbit-11pct.jpg) |
| 22 | shrubs-blobs | Fixed | seen | A deep rose in sun and shade. | [ba-01-cover-roof-and-facade.jpg](ev/ba-01-cover-roof-and-facade.jpg) |
| 23 | wall-lanterns-specks | Partly | seen | The brackets are gone; dark specks at the hood ends remain: #4. | [12-cover-window-hood-ends-6x.jpg](ev/12-cover-window-hood-ends-6x.jpg) |
| 24 | window-curtain-card | Fixed | seen | A curtain, not a sheet. | [ba-06-approach-pediment-windows.jpg](ev/ba-06-approach-pediment-windows.jpg) |
| 25 | portico-banding | Fixed | seen | Clean entablature and steps. | [ba-07-approach-portico-car.jpg](ev/ba-07-approach-portico-car.jpg) |
| 26 | car-sparkle | Fixed | seen | Lines along the sill, not dots. | [ba-07-approach-portico-car.jpg](ev/ba-07-approach-portico-car.jpg) |
| 27 | fountain-flat | Fixed | seen | Water and basins read as such. | [ba-03-orbit-11pct.jpg](ev/ba-03-orbit-11pct.jpg) |
| 28 | motes-specks | Fixed | seen | Gone. | [30-film-desktop-walk-1.jpg](ev/30-film-desktop-walk-1.jpg) |
| 29 | wall-dashed | Fixed | seen | A continuous coping. | [ba-03-orbit-11pct.jpg](ev/ba-03-orbit-11pct.jpg) |
| 30 | cover-edge-crops | Partly | seen | The palm and the hedge are out of frame; the fountain bowl is still cut at the bottom right, which needs the approved camera (the client's). | [10-cover-1920.jpg](ev/10-cover-1920.jpg), [13-cover-zoom-2x.jpg](ev/13-cover-zoom-2x.jpg) |
| 31 | cover-copy-on-terrace | Fixed | seen | The paragraph and the cue stand on the lawn. | [ba-02-cover-pool-car-trees.jpg](ev/ba-02-cover-pool-car-trees.jpg) |
| 32 | door-capitals | Fixed | seen | Plain capitals; a round knob. | [ba-08-door-capitals.jpg](ev/ba-08-door-capitals.jpg) |
| 33 | hall-entry-portrait-cut | Client | seen | Unchanged: the first frame through the door cuts the portrait at the eyes. | [ba-09-hall-first-frame.jpg](ev/ba-09-hall-first-frame.jpg) |
| 34 | hall-pink-balusters | Fixed | seen | Ivory. | [ba-09-hall-first-frame.jpg](ev/ba-09-hall-first-frame.jpg), [ba-12-stair-pass.jpg](ev/ba-12-stair-pass.jpg) |
| 35 | hall-star-frieze | Fixed | seen | A plain frieze. | [30-film-desktop-walk-3.jpg](ev/30-film-desktop-walk-3.jpg) |
| 36 | hall-wainscot-slabs | Fixed | seen | Framed, raised panels. | [ba-12-stair-pass.jpg](ev/ba-12-stair-pass.jpg) |
| 37 | hall-wood-grain | Fixed | seen | One walnut at its own scale. | [ba-10-table-2.jpg](ev/ba-10-table-2.jpg) |
| 38 | table-rim-faceted | Fixed | seen | A turned rim. | [ba-11-table-3.jpg](ev/ba-11-table-3.jpg) |
| 39 | boards-three-woods | Fixed | seen | One timber. | [ba-10-table-2.jpg](ev/ba-10-table-2.jpg), [ba-11-table-3.jpg](ev/ba-11-table-3.jpg) |
| 40 | model-lucky-slab | Fixed | seen | Open ground in green; one ivory for plots. | [ba-10-table-2.jpg](ev/ba-10-table-2.jpg) |
| 41 | model-gayatri-artifacts | Fixed | seen | No hole, no beading. | [ba-11-table-3.jpg](ev/ba-11-table-3.jpg) |
| 42 | table2-dark-third | Fixed | measured | Mean frame brightness at table 2: 74 then, 104 now. | [ba-10-table-2.jpg](ev/ba-10-table-2.jpg) |
| 43 | stair-pan-empty | Client | seen | Unchanged: frames of blank wall and balusters between the tables. | [33-film-tablet-walk-2.jpg](ev/33-film-tablet-walk-2.jpg), [31-film-phone-walk-3.jpg](ev/31-film-phone-walk-3.jpg) |
| 44 | stair-stringer-gaps | Fixed | seen | The string is closed; it now carries a dotted seam: #12. | [ba-12-stair-pass.jpg](ev/ba-12-stair-pass.jpg), [22-stair-newel-slot-and-string-dots-6x.jpg](ev/22-stair-newel-slot-and-string-dots-6x.jpg) |
| 45 | sconce-blue | Fixed | measured | Bluish pixels in the stair-pass flames: 238 then, 48 now. At close range on /branches the flames are neutral white: #15. | [44b-branches-opening-sconces-2x.jpg](ev/44b-branches-opening-sconces-2x.jpg) |
| 46 | portrait-nameplate-crossed | Partly | seen | The name clears the rail at one notch; the title is behind it, and the name reads "BIIASKARA": #1. | [25-nameplate-two-notches-1920-4x.jpg](ev/25-nameplate-two-notches-1920-4x.jpg) |
| 47 | picture-lamp | Fixed | seen | A warm tube. | [ba-13-portrait-lamp-nameplate.jpg](ev/ba-13-portrait-lamp-nameplate.jpg) |
| 48 | nameplate-aliased | Partly | seen | The gilt edge is one line; the H's crossbar drops out at film distance: #1. | [24-nameplate-at-film-distance-4x.jpg](ev/24-nameplate-at-film-distance-4x.jpg) |
| 49 | map-copy-on-stair | Partly | seen | Pins named, rim clean; the list still crosses the stair string: #3. The corners were left. | [28-map-heading-and-list-old-new-2x.jpg](ev/28-map-heading-and-list-old-new-2x.jpg) |
| 50 | carpets-two-colours | Fixed | seen | One carpet ink. | [21-stair-rods-and-string-old-new-3x.jpg](ev/21-stair-rods-and-string-old-new-3x.jpg) |
| 51 | hall-windows-cards | Client | seen | Unchanged. | [30-film-desktop-walk-3.jpg](ev/30-film-desktop-walk-3.jpg) |
| 52 | pacing-tables | Client | measured | Unchanged notch for notch: table 3's words are never whole. | [30-film-desktop-walk-3.jpg](ev/30-film-desktop-walk-3.jpg), [31-film-phone-walk-3.jpg](ev/31-film-phone-walk-3.jpg) |
| 53 | figures-oldstyle | Client | seen | Unchanged ("4o7"); lining figures are one setting away (--figure-nums in globals.css). | [ba-05-count-figures.jpg](ev/ba-05-count-figures.jpg) |
| 54 | header-band-hard-edge | Fixed | seen | No edge on the tablet. | [33-film-tablet-walk-1.jpg](ev/33-film-tablet-walk-1.jpg) |
| 55 | station-band-hard-edge | Fixed | seen | No shape behind a table's name on the phone. | [31-film-phone-walk-3.jpg](ev/31-film-phone-walk-3.jpg) |
| 56 | headline-colour-midline | Fixed | seen | The colour changes at the line break. | [30-film-desktop-walk-4.jpg](ev/30-film-desktop-walk-4.jpg) |
| 57 | figures-above-heading | Fixed | seen | One order at every size. | [31-film-phone-walk-1.jpg](ev/31-film-phone-walk-1.jpg) |
| 58 | footer-two-designs | Fixed | seen | One footer. | [ba-15-footer.jpg](ev/ba-15-footer.jpg) |
| 59 | address-orphan | Partly | measured | One format, except /about's office list: #5. | [49-about-office-line-dashed-pin-1920.jpg](ev/49-about-office-line-dashed-pin-1920.jpg) |
| 60 | ampersand-substitute | Fixed | seen | "and" throughout. | [60-pages-desktop-01.jpg](ev/60-pages-desktop-01.jpg) |
| 61 | menu-enquire-thrice | Fixed | seen | Once. | [50-states-desktop-consent-menu-privacy.jpg](ev/50-states-desktop-consent-menu-privacy.jpg) |
| 62 | plan-images-broken | Client | seen | The same three files (dated 4 August): "FUTURE EXTENTION", the resort photograph, a child's photograph in a corner, one sheet on its side. | [55-gallery-gayatri-plan-sideways.jpg](ev/55-gallery-gayatri-plan-sideways.jpg), [51-states-desktop-forms.jpg](ev/51-states-desktop-forms.jpg) |
| 63 | plan-zoom-blur | Client | seen | Unchanged scans in the article. | [60-pages-desktop-07.jpg](ev/60-pages-desktop-07.jpg) |
| 64 | plan-full-size-raw | Fixed | ledger | A viewer, per the ledger; not exercised in this pass. |  |
| 65 | gallery-two-layouts | Fixed | seen | One mount style. | [60-pages-desktop-05.jpg](ev/60-pages-desktop-05.jpg) |
| 66 | plate-reuse | Fixed | measured | 28 pages, 28 pictures. | [40-openings-desktop-1.jpg](ev/40-openings-desktop-1.jpg), [40-openings-desktop-2.jpg](ev/40-openings-desktop-2.jpg) |
| 67 | plate-weak | Fixed | seen | The three named are fixed; two new pictures show props too close: #15. | [40-openings-desktop-1.jpg](ev/40-openings-desktop-1.jpg) |
| 68 | plate-heights | Fixed | measured | Two heights by one rule. | [40-openings-desktop-1.jpg](ev/40-openings-desktop-1.jpg) |
| 69 | layout-plate-blurred | Fixed | seen | In focus. | [40-openings-desktop-2.jpg](ev/40-openings-desktop-2.jpg) |
| 70 | car-melted | Client | seen | Gone from /why-us; still in the film's approach. | [ba-07-approach-portico-car.jpg](ev/ba-07-approach-portico-car.jpg) |
| 71 | phone-about-crop | Fixed | seen | The face whole. | [41-openings-phone-1.jpg](ev/41-openings-phone-1.jpg) |
| 72 | edge-strip | Fixed | ledger | Per the ledger; nothing visible at the edge on today's phone strips. | [61-pages-phone-01.jpg](ev/61-pages-phone-01.jpg) |
| 73 | header-collision | Fixed | seen | Words dissolve before the header on every page strip. | [60-pages-desktop-01.jpg](ev/60-pages-desktop-01.jpg) |
| 74 | sheets-empty | Fixed | seen | The reading type steps up at 1920. | [60-pages-desktop-01.jpg](ev/60-pages-desktop-01.jpg) |
| 75 | short-last-lines | Fixed | measured | None in running text at four sizes (the cookie table's group labels sit on their own line by design). |  |
| 76 | dash-lists-wrap | Fixed | seen | No rule begins a line. | [61-pages-phone-04.jpg](ev/61-pages-phone-04.jpg) |
| 77 | cookie-table-wrap | Fixed | seen | One line. | [60-pages-desktop-04.jpg](ev/60-pages-desktop-04.jpg) |
| 78 | heading-stops | Fixed | measured | First and second levels stopped, third not, on all 28 pages. |  |
| 79 | numbering-three | Fixed | seen | One style. | [60-pages-desktop-14.jpg](ev/60-pages-desktop-14.jpg) |
| 80 | closing-labels | Fixed | seen | "Next" and "Back to". | [60-pages-desktop-01.jpg](ev/60-pages-desktop-01.jpg) |
| 81 | legal-drafts-live | Client | measured | 25 placeholders (privacy 5, terms 9, refunds 11) under "Draft — not yet in force". | [60-pages-desktop-09.jpg](ev/60-pages-desktop-09.jpg), [60-pages-desktop-12.jpg](ev/60-pages-desktop-12.jpg) |
| 82 | dpo-personal-email | Fixed | seen | The company's own address, by the client's rule. | [60-pages-desktop-09.jpg](ev/60-pages-desktop-09.jpg) |
| 83 | counts-mismatch | Client | seen | Unchanged: 113, 181 and 113 (407). | [ba-05-count-figures.jpg](ev/ba-05-count-figures.jpg) |
| 84 | copy-antithesis | Partly | measured | Inner pages 37 then, 7 now; the film's three lines were not counted: #2. |  |
| 85 | copy-self-reference | Fixed | measured | 38 then, 7 now. |  |
| 86 | copy-repeated | Fixed | measured | 54 then, 1 now (the head office's address). |  |
| 87 | content-unfinished | Partly | seen | The sections announcing their own absence are gone; photographs and approval references are the client's to supply. |  |
| 88 | testimonials-other-names | Client | seen | A note now says which development each quote speaks of; dated accounts are the client's to supply. | [60-pages-desktop-14.jpg](ev/60-pages-desktop-14.jpg) |
| 89 | telugu-fallback | Declined | seen | Left as it is by the user's choice (24 October). |  |
| 90 | units-mixed | Partly | measured | Road widths two ways: #6. | [60-pages-desktop-11.jpg](ev/60-pages-desktop-11.jpg) |
| 91 | names-differ | Fixed | seen | One name a page. | [50-states-desktop-consent-menu-privacy.jpg](ev/50-states-desktop-consent-menu-privacy.jpg) |
| 92 | generic-mission | Client | seen | Unchanged, his words. | [60-pages-desktop-01.jpg](ev/60-pages-desktop-01.jpg) |
| 93 | faq-developer-question | Fixed | seen | "Will this work on my phone?" | [61-pages-phone-03.jpg](ev/61-pages-phone-03.jpg) |
| 94 | honeypot-text | Fixed | measured | The field is hidden; no label in the page's text. |  |
| 95 | meta-gaps | Fixed | measured | 28 pages, no problems; 29 share cards. | [56-share-cards-all-pages.jpg](ev/56-share-cards-all-pages.jpg) |
| 96 | type-scale-sprawl | Fixed | measured | 19 styles in 13 sizes at 1920 (42 in 15 then). One near-duplicate leading: #20. |  |
| 97 | body-two-sizes | Fixed | measured | One body size per screen. |  |
| 98 | colour-tokens | Fixed | measured | Seven text colours (16 then). |  |
| 99 | numerals-mixed | Fixed | seen | Lining in forms and tables. | [51-states-desktop-forms.jpg](ev/51-states-desktop-forms.jpg) |
| 100 | motion-values | Fixed | measured | Two durations, one curve over 1,186 transitions. |  |
| 101 | logo-plate-unique | Client | seen | The mark is his. | [10-cover-1920.jpg](ev/10-cover-1920.jpg) |
| 102 | header-shift | Fixed | seen | Still. | [50-states-desktop-consent-menu-privacy.jpg](ev/50-states-desktop-consent-menu-privacy.jpg) |
| 103 | menu-ghost | Fixed | seen | Opaque by 0.2 s. | [52-states-desktop-focus-and-menu-opening.jpg](ev/52-states-desktop-focus-and-menu-opening.jpg) |
| 104 | notice-box-offset | Fixed | seen | On the grid. | [60-pages-desktop-09.jpg](ev/60-pages-desktop-09.jpg) |
| 105 | consent-card | Fixed | seen | The site's own style. | [50-states-desktop-consent-menu-privacy.jpg](ev/50-states-desktop-consent-menu-privacy.jpg), [53-states-phone.jpg](ev/53-states-phone.jpg) |
| 106 | consent-autofocus | Fixed | measured | Focus on the card; no choice pre-selected. |  |
| 107 | consent-reopen | Fixed | seen | "Privacy and data choices." | [50-states-desktop-consent-menu-privacy.jpg](ev/50-states-desktop-consent-menu-privacy.jpg) |
| 108 | focus-states | Fixed | measured | One ring on every stop (2 px gilt, 4 px clear). | [52-states-desktop-focus-and-menu-opening.jpg](ev/52-states-desktop-focus-and-menu-opening.jpg) |
| 109 | form-date-native | Fixed | seen | A drawn control ("Any day"). | [60-pages-desktop-01.jpg](ev/60-pages-desktop-01.jpg) |
| 110 | form-time-wrap | Fixed | measured | Four options on one row at 1920. | [51-states-desktop-forms.jpg](ev/51-states-desktop-forms.jpg) |
| 111 | form-field-sizes | Fixed | measured | One field size. | [51-states-desktop-forms.jpg](ev/51-states-desktop-forms.jpg) |
| 112 | phone-rail-tap | Fixed | measured | A tap beside the dots does nothing; names opened on a dot close on choosing and stay closed. | [54-phone-finger-on-the-rail.jpg](ev/54-phone-finger-on-the-rail.jpg) |
| 113 | phone-rail-over-content | Fixed | seen | The rail steps out when the film is still. | [54-phone-finger-on-the-rail.jpg](ev/54-phone-finger-on-the-rail.jpg) |
| 114 | phone-hero-crop | Fixed | seen | Both corners of the front in frame. | [31-film-phone-walk-1.jpg](ev/31-film-phone-walk-1.jpg) |
| 115 | phone-station3-wrap | Fixed | seen | No rule begins a line. | [31-film-phone-walk-3.jpg](ev/31-film-phone-walk-3.jpg) |
| 116 | phone-footer-ragged | Fixed | seen | Even rows. | [61-pages-phone-01.jpg](ev/61-pages-phone-01.jpg) |
| 117 | phone-tap-targets | Partly | measured | Everything 44 px tall; three footer links narrower: #7. | [61-pages-phone-01.jpg](ev/61-pages-phone-01.jpg) |
| 118 | phone-nameplate-strip | Fixed | seen | No strip at the map chapter's top. | [31-film-phone-walk-4.jpg](ev/31-film-phone-walk-4.jpg) |
| 119 | revolve-copy-on-hedge | Fixed | seen | The caption stands on the lawn. | [ba-03-orbit-11pct.jpg](ev/ba-03-orbit-11pct.jpg) |

# Appendix C — Evidence index

108 images.

- [01-load-8mbit-film-first-visit.jpg](ev/01-load-8mbit-film-first-visit.jpg)
- [02-load-8mbit-about-first-visit.jpg](ev/02-load-8mbit-about-first-visit.jpg)
- [03-press-lucky-garden-20mbit.jpg](ev/03-press-lucky-garden-20mbit.jpg)
- [03b-press-300ms-words-over-the-garden.jpg](ev/03b-press-300ms-words-over-the-garden.jpg)
- [04-404-first-five-seconds.jpg](ev/04-404-first-five-seconds.jpg)
- [05-still-to-live-why-us-difference.jpg](ev/05-still-to-live-why-us-difference.jpg)
- [05b-still-to-live-portico-4x.jpg](ev/05b-still-to-live-portico-4x.jpg)
- [10-cover-1920.jpg](ev/10-cover-1920.jpg)
- [11-cover-pool-corner-and-far-edge-old-new-5x.jpg](ev/11-cover-pool-corner-and-far-edge-old-new-5x.jpg)
- [12-cover-window-hood-ends-6x.jpg](ev/12-cover-window-hood-ends-6x.jpg)
- [13-cover-zoom-2x.jpg](ev/13-cover-zoom-2x.jpg)
- [20-hall-column-and-panel-moulding-old-new-3x.jpg](ev/20-hall-column-and-panel-moulding-old-new-3x.jpg)
- [21-stair-rods-and-string-old-new-3x.jpg](ev/21-stair-rods-and-string-old-new-3x.jpg)
- [22-stair-newel-slot-and-string-dots-6x.jpg](ev/22-stair-newel-slot-and-string-dots-6x.jpg)
- [23-table3-three-positions-1920.jpg](ev/23-table3-three-positions-1920.jpg)
- [23b-table3-place-line-on-the-pilaster-2x.jpg](ev/23b-table3-place-line-on-the-pilaster-2x.jpg)
- [24-nameplate-at-film-distance-4x.jpg](ev/24-nameplate-at-film-distance-4x.jpg)
- [25-nameplate-two-notches-1920-4x.jpg](ev/25-nameplate-two-notches-1920-4x.jpg)
- [26-nameplate-phone-title-behind-rail.jpg](ev/26-nameplate-phone-title-behind-rail.jpg)
- [26b-nameplate-1366-title-behind-rail.jpg](ev/26b-nameplate-1366-title-behind-rail.jpg)
- [26c-nameplate-on-about-opening-4x.jpg](ev/26c-nameplate-on-about-opening-4x.jpg)
- [27-portrait-link-on-a-dashed-line-3x.jpg](ev/27-portrait-link-on-a-dashed-line-3x.jpg)
- [28-map-heading-and-list-old-new-2x.jpg](ev/28-map-heading-and-list-old-new-2x.jpg)
- [29-map-small-phone-pin-plate-on-note.jpg](ev/29-map-small-phone-pin-plate-on-note.jpg)
- [30-film-desktop-walk-1.jpg](ev/30-film-desktop-walk-1.jpg)
- [30-film-desktop-walk-2.jpg](ev/30-film-desktop-walk-2.jpg)
- [30-film-desktop-walk-3.jpg](ev/30-film-desktop-walk-3.jpg)
- [30-film-desktop-walk-4.jpg](ev/30-film-desktop-walk-4.jpg)
- [31-film-phone-walk-1.jpg](ev/31-film-phone-walk-1.jpg)
- [31-film-phone-walk-2.jpg](ev/31-film-phone-walk-2.jpg)
- [31-film-phone-walk-3.jpg](ev/31-film-phone-walk-3.jpg)
- [31-film-phone-walk-4.jpg](ev/31-film-phone-walk-4.jpg)
- [32-film-small-phone-walk-1.jpg](ev/32-film-small-phone-walk-1.jpg)
- [32-film-small-phone-walk-2.jpg](ev/32-film-small-phone-walk-2.jpg)
- [33-film-tablet-walk-1.jpg](ev/33-film-tablet-walk-1.jpg)
- [33-film-tablet-walk-2.jpg](ev/33-film-tablet-walk-2.jpg)
- [34-film-laptop-walk-1.jpg](ev/34-film-laptop-walk-1.jpg)
- [34-film-laptop-walk-2.jpg](ev/34-film-laptop-walk-2.jpg)
- [40-openings-desktop-1.jpg](ev/40-openings-desktop-1.jpg)
- [40-openings-desktop-2.jpg](ev/40-openings-desktop-2.jpg)
- [41-openings-phone-1.jpg](ev/41-openings-phone-1.jpg)
- [41-openings-phone-2.jpg](ev/41-openings-phone-2.jpg)
- [42-openings-tablet-1.jpg](ev/42-openings-tablet-1.jpg)
- [42-openings-tablet-2.jpg](ev/42-openings-tablet-2.jpg)
- [43-openings-laptop-1.jpg](ev/43-openings-laptop-1.jpg)
- [43-openings-laptop-2.jpg](ev/43-openings-laptop-2.jpg)
- [44-branches-band-sconce-1920.jpg](ev/44-branches-band-sconce-1920.jpg)
- [44b-branches-opening-sconces-2x.jpg](ev/44b-branches-opening-sconces-2x.jpg)
- [45-branches-tablet-black-slit.jpg](ev/45-branches-tablet-black-slit.jpg)
- [45b-branches-tablet-hatched-shadow-5x.jpg](ev/45b-branches-tablet-hatched-shadow-5x.jpg)
- [46-terms-opening-palms-and-piers-2x.jpg](ev/46-terms-opening-palms-and-piers-2x.jpg)
- [47-properties-phone-title-on-plaque.jpg](ev/47-properties-phone-title-on-plaque.jpg)
- [47b-properties-tablet-title-on-plaque.jpg](ev/47b-properties-tablet-title-on-plaque.jpg)
- [48-about-phone-kicker-on-nameplate.jpg](ev/48-about-phone-kicker-on-nameplate.jpg)
- [49-about-office-line-dashed-pin-1920.jpg](ev/49-about-office-line-dashed-pin-1920.jpg)
- [50-states-desktop-consent-menu-privacy.jpg](ev/50-states-desktop-consent-menu-privacy.jpg)
- [51-states-desktop-forms.jpg](ev/51-states-desktop-forms.jpg)
- [52-states-desktop-focus-and-menu-opening.jpg](ev/52-states-desktop-focus-and-menu-opening.jpg)
- [53-states-phone.jpg](ev/53-states-phone.jpg)
- [54-phone-finger-on-the-rail.jpg](ev/54-phone-finger-on-the-rail.jpg)
- [55-gallery-gayatri-plan-sideways.jpg](ev/55-gallery-gayatri-plan-sideways.jpg)
- [56-share-cards-all-pages.jpg](ev/56-share-cards-all-pages.jpg)
- [60-pages-desktop-01.jpg](ev/60-pages-desktop-01.jpg)
- [60-pages-desktop-02.jpg](ev/60-pages-desktop-02.jpg)
- [60-pages-desktop-03.jpg](ev/60-pages-desktop-03.jpg)
- [60-pages-desktop-04.jpg](ev/60-pages-desktop-04.jpg)
- [60-pages-desktop-05.jpg](ev/60-pages-desktop-05.jpg)
- [60-pages-desktop-06.jpg](ev/60-pages-desktop-06.jpg)
- [60-pages-desktop-07.jpg](ev/60-pages-desktop-07.jpg)
- [60-pages-desktop-08.jpg](ev/60-pages-desktop-08.jpg)
- [60-pages-desktop-09.jpg](ev/60-pages-desktop-09.jpg)
- [60-pages-desktop-10.jpg](ev/60-pages-desktop-10.jpg)
- [60-pages-desktop-11.jpg](ev/60-pages-desktop-11.jpg)
- [60-pages-desktop-12.jpg](ev/60-pages-desktop-12.jpg)
- [60-pages-desktop-13.jpg](ev/60-pages-desktop-13.jpg)
- [60-pages-desktop-14.jpg](ev/60-pages-desktop-14.jpg)
- [61-pages-phone-01.jpg](ev/61-pages-phone-01.jpg)
- [61-pages-phone-02.jpg](ev/61-pages-phone-02.jpg)
- [61-pages-phone-03.jpg](ev/61-pages-phone-03.jpg)
- [61-pages-phone-04.jpg](ev/61-pages-phone-04.jpg)
- [61-pages-phone-05.jpg](ev/61-pages-phone-05.jpg)
- [61-pages-phone-06.jpg](ev/61-pages-phone-06.jpg)
- [61-pages-phone-07.jpg](ev/61-pages-phone-07.jpg)
- [62-pages-tablet-01.jpg](ev/62-pages-tablet-01.jpg)
- [62-pages-tablet-02.jpg](ev/62-pages-tablet-02.jpg)
- [62-pages-tablet-03.jpg](ev/62-pages-tablet-03.jpg)
- [62-pages-tablet-04.jpg](ev/62-pages-tablet-04.jpg)
- [63-pages-laptop-01.jpg](ev/63-pages-laptop-01.jpg)
- [63-pages-laptop-02.jpg](ev/63-pages-laptop-02.jpg)
- [63-pages-laptop-03.jpg](ev/63-pages-laptop-03.jpg)
- [63-pages-laptop-04.jpg](ev/63-pages-laptop-04.jpg)
- [63-pages-laptop-05.jpg](ev/63-pages-laptop-05.jpg)
- [63-pages-laptop-06.jpg](ev/63-pages-laptop-06.jpg)
- [ba-01-cover-roof-and-facade.jpg](ev/ba-01-cover-roof-and-facade.jpg)
- [ba-02-cover-pool-car-trees.jpg](ev/ba-02-cover-pool-car-trees.jpg)
- [ba-03-orbit-11pct.jpg](ev/ba-03-orbit-11pct.jpg)
- [ba-04-orbit-palms-pediment.jpg](ev/ba-04-orbit-palms-pediment.jpg)
- [ba-05-count-figures.jpg](ev/ba-05-count-figures.jpg)
- [ba-06-approach-pediment-windows.jpg](ev/ba-06-approach-pediment-windows.jpg)
- [ba-07-approach-portico-car.jpg](ev/ba-07-approach-portico-car.jpg)
- [ba-08-door-capitals.jpg](ev/ba-08-door-capitals.jpg)
- [ba-09-hall-first-frame.jpg](ev/ba-09-hall-first-frame.jpg)
- [ba-10-table-2.jpg](ev/ba-10-table-2.jpg)
- [ba-11-table-3.jpg](ev/ba-11-table-3.jpg)
- [ba-12-stair-pass.jpg](ev/ba-12-stair-pass.jpg)
- [ba-13-portrait-lamp-nameplate.jpg](ev/ba-13-portrait-lamp-nameplate.jpg)
- [ba-14-map-table.jpg](ev/ba-14-map-table.jpg)
- [ba-15-footer.jpg](ev/ba-15-footer.jpg)
