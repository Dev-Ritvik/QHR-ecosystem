# Forensic visual audit — Quality Homes Reality

- **Site audited:** https://virtual-debug-thumbnails-vcr.trycloudflare.com/ (the build that went live behind this link at 22:04 IST on 9 October 2026)
- **Audit date:** 9 October 2026
- **Findings:** {{TOTAL}} verified, each with an evidence image in [ev/](ev/)

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

1. **The proof is broken.** The three plans the whole site points to are cropped brochure scans: a misspelt label, a pasted resort photograph, a child's face in a corner, one shown sideways ([[plan-images-broken]]). The legal pages are published drafts with about 27 bracketed placeholders ([[legal-drafts-live]]). The plot counts do not match the plans beside them ([[counts-mismatch]]).
2. **The picture does not survive a close look on an ordinary monitor.** Jagged edges everywhere ([[aa-none]]), black palms beside lit trees ([[palms-black]]), pediments that are wedges with nothing behind them ([[pediment-wedge]]), pink balusters and slab panelling in the hall ([[hall-pink-balusters]], [[hall-wainscot-slabs]]).
3. **The first 13 seconds are a blank dark screen**, and on a slow connection the curtain lifts onto words with no picture ([[load-dark-wait]], [[load-slow-line-empty]]).
4. **The film gives the three layouts the least time of anything in it** ([[pacing-tables]]).
5. **On a phone**, one stray tap leaves a column of chapter names lying across the film's text ([[phone-rail-tap]]), and the founder's portrait is cropped at the neck behind his own motto ([[phone-about-crop]]).
6. **Logo-crossing text on every inner page** on the first scroll ([[header-collision]]).

**What is genuinely good**, so the scores below are read in proportion: the unbroken move from the garden through the door into the hall; the idea of the layouts as models on tables in a room you walk into; the display typography; the discipline of the inner pages' grid (every page on the same three edges at 100, 895 and 1820 px); navigation between pages (a 0.37 s dip, no flash); and, on tonight's build, all nine chapter links landing where they should.

---

# 2. Total findings

{{COUNTS}}

---

# 3. Top 20 most important problems

| # | Issue | Where | Impact | Recommended fix |
|---|---|---|---|---|
| 1 | [[plan-images-broken]] The three plans are cropped, marked-up brochure scans | /projects, /gallery, layout pages, article | Destroys the site's central claim ("the plan is the proof") for buyer and jury alike | Clean, whole, upright originals from the client at print resolution |
| 2 | [[legal-drafts-live]] Legal pages are live drafts with placeholders | /privacy, /terms, /refund-policy | Disqualifying for a buyer; reads as an unfinished template | Final text from the client's lawyers, or withhold the pages |
| 3 | [[load-dark-wait]] 12–17 s of blank dark screen on every first visit | All pages, through the link | The whole first impression is an empty screen | A still under the curtain within 2 s; text pages should not wait for 3D |
| 4 | [[load-slow-line-empty]] Curtain lifts onto words with no picture on slow lines | Film and hall pages at 8 Mbit/s | The most broken-looking state, shown to the weakest connections | Hold the curtain for the first picture, or start from a still |
| 5 | [[aa-none]] No edge smoothing on any 3D frame | Film and every opening picture | Jagged, crawling balustrades on the client's own monitor | Turn on multisampling or add a smoothing pass |
| 6 | [[phone-rail-tap]] One tap leaves chapter names over the film's text | Every page on a phone | A second column of text across the copy on the main device | Shrink the touch area; close names on scroll |
| 7 | [[pacing-tables]] The three layouts get the least reading time | Film, 64–76% | The product cannot be read at a normal scroll | Lengthen the tables' word windows (not the camera) |
| 8 | [[header-collision]] Text scrolls through the logo | Every inner page, first scroll | The most visible layout fault in the reading pages | Fade the cue before the header |
| 9 | [[counts-mismatch]] Plot counts disagree with the plans | Film, /projects, layout pages | Undermines "counted in full" | Reconcile with the client's register |
| 10 | [[hall-wainscot-slabs]] Wainscot is flat floating slabs with light bleed | Hall, behind all three tables | The background of the product looks unfinished | Framed panelling, evenly lit, one timber |
| 11 | [[hall-pink-balusters]] Balusters and capitals are pink | Hall, 67–79% | The room's loudest colour error | Ivory or white plaster |
| 12 | [[palms-black]] Palms are black cut-outs beside lit trees | Film, 11–20% | The clearest "pasted in" tell outdoors | Light the palms with the scene |
| 13 | [[pediment-wedge]] Pediments are wedges with open backs | Film, 0%, 17%, 42% | The house reads as a stage flat | Close the pediments' sides and backs |
| 14 | [[portrait-nameplate-crossed]] Handrail crosses the founder's nameplate | Film, 80–84%; phone | Against the client's own request for the plate | Raise with the client; adjust rail or height |
| 15 | [[hall-star-frieze]] Frieze of floating six-pointed stars | Hall and eight pages' pictures | Generated-looking ornament behind the portrait | A plain frieze or a real moulding |
| 16 | [[copy-antithesis]] "This, not that" 37 times; site talks about itself | All inner pages | Recognisable machine-copy voice | Keep the best few; say the rest plainly |
| 17 | [[footer-two-designs]] and [[names-differ]] Two footers; pages with up to four names | Site-wide | The site contradicts itself on every page | One footer, one name per page |
| 18 | [[figures-oldstyle]] Headline numbers read "4o7" | Film count, /about, /projects, layout pages | The site's key statistics look like a font error | Lining figures for display numbers |
| 19 | [[plate-reuse]] 28 pages on about ten pictures; portrait on legal and 404 pages | All inner pages | Site feels smaller; wrong picture for the subject | A picture per subject |
| 20 | [[dpo-personal-email]] A personal Gmail as Data Protection Officer | /privacy, /cookie-policy | A placeholder gone live | The company's own contact |

---

# 4. All findings

Each finding is numbered once and keeps its number throughout this report. Evidence files are in [ev/](ev/).

