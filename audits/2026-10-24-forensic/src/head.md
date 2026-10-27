# Forensic visual audit, second pass — Quality Homes Reality

- **Build audited:** branch `claude/forensic-audit` at `0c6d98a` (build `XvZYCE41IFs_IVPqZcqlK`), served from this machine at http://localhost:3001. This is the build the forensic fixes ended on.
- **Audit date:** 24 October 2026, fifteen days after the first pass ([the 9 October report](../2026-10-09-forensic/AUDIT.md), 119 findings).
- **Public link:** not used, and not running. It still serves an older build, by the user's choice. Nothing in this report was measured through it.
- **Findings:** {{TOTAL}} on this build: {{NEW}} found today and {{CARRIED}} carried over from 9 October, partly fixed. Another 16 from 9 October wait on the client, and one was declined by the user. The status of all 119 is in [Appendix B](#appendix-b--the-119-findings-of-9-october-one-by-one).

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

**The fix ledger** ([FIXES.md](../2026-10-09-forensic/FIXES.md)) was read for what it claims, and each claim was checked on today's captures wherever a capture could show it. Its final figures hold: 19 type styles in 13 sizes at 1920, two transition durations and one curve, every control at least 44 px tall on a phone, a picture under the curtain within 1.5–1.9 s at 8 and 20 Mbit/s, 28 opening pictures, 29 share cards, and no script errors. Two claims do not quite hold: "one leading per size" ([[leading-two-at-reading-size]]) and "no saw-tooth under the list": the stair string is smooth now, but the list still crosses it ([[map-list-on-string]]).

**Lines marked "Note"** flag a finding that touches something the client has decided (the camera, the portrait, the approved hall), or that needs something only he can supply. They are reported because they are visible, not as advice to overrule him. The film's dark last frame is his own order and is not listed.

---

# 1. Executive verdict

**Does it currently look professionally finished?** Mostly, now. Of the 119 findings of 9 October, {{FIXED}} are fixed and {{PARTLY}} partly fixed. On a 1920×945 screen at full size, the 3D picture now holds up: the edges are smoothed, the palms are lit, the pediments are closed, the hall is panelled, the models are whole and the sunset is warm. No page throws an error at any size, and on a slow line the first visit shows a picture within two seconds. What is left in the picture is small: dotted seams in the hall's baked light, and two props seen closer than they were made for. What is left on the pages is mostly the client's to supply.

**Does it look award-ready?** Not yet. A buyer or a juror would still stop at three things, and none of them can be fixed without the client. The plans are still cropped brochure scans: a misspelling, a pasted resort photograph, a child's photograph in one corner and one sheet on its side. The legal pages are still drafts, with 25 placeholders. The plot counts do not match the plans. Of what can be fixed without him, the founder's nameplate is the most visible: it is never whole while its chapter's words are up, and at the film's distance his name reads "BIIASKARA".

**Does it contain visible AI slop?** Much less. Twelve of the thirteen tells in the picture listed on 9 October are gone, and the thirteenth, the car, is no longer shown close (replacing it is the client's call). Two kinds remain in a new form. Two of the new opening pictures show props at a distance their finish does not survive: the /branches sconces and the /terms palms. And a quarter of the headings are built in one mould ("Three offices, three districts."). The film's own copy keeps three "this, not that" lines.

**Does it contain systemic inconsistencies?** Few, and small. The still and the live picture do not line up; road widths are written two ways; one address list keeps a dash; two near-identical leadings share the reading size. The type, colour, motion, focus, footer and naming systems hold across all 28 pages and four sizes.

**What is preventing it from feeling exceptional:**

1. **The proof.** The three plans, the legal drafts and the counts (9 Oct #62, #63, #81 and #83): all the client's to supply.
2. **The founder's nameplate** ([[nameplate-still-crossed]]).
3. **The three layouts still get the least time in the film** (9 Oct #52, waiting on the client), and the third table's place line now fails contrast against the hall's new pilaster ([[table3-copy-aa]]).
4. **Two new opening pictures show their props too close** ([[plate-props-close]]), and they are also those pages' share cards.
5. **The copy's new mould** ([[heads-comma-pairs]], [[film-copy-negation]]).

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

{{COUNTS}}

From 9 October and not counted above: 14 unchanged and waiting on the client, 2 partly done whose rest waits on him, and 1 declined by the user (all 17 are listed at the end of section 4).

The 119 findings of 9 October today:

{{STATUS_COUNTS}}

---

# 3. Top 20 most important problems

This pass's findings and the unchanged client items together, by what a buyer or a juror would see first.

| # | Issue | Where | Impact | Recommended fix |
|---|---|---|---|---|
| 1 | 9 Oct #62 The three plans are cropped, marked-up brochure scans (unchanged) | /projects, /gallery, /downloads, layout pages, article | The site's proof is still its weakest picture | Clean originals from the client |
| 2 | 9 Oct #81 The legal pages are drafts with 25 placeholders (unchanged) | /privacy, /terms, /refund-policy | Disqualifying for a buyer; reads as a template | Final text from the client's lawyers, or withhold the pages |
| 3 | 9 Oct #83 The plot counts disagree with the plans (unchanged) | Film, /projects, layout pages | "Counted in full" against plans that count otherwise | The client's register |
| 4 | [[nameplate-still-crossed]] The founder's nameplate is never whole while its words are up, and reads "BIIASKARA" | Film, the portrait, every size | The most personal mistake the site can make | Heavier lettering now; the rail and camera with the client |
| 5 | 9 Oct #52 The three tables get the least reading time (unchanged) | Film, 64–76% | The product is the least readable thing in the film | Longer word windows (not the camera), with the client |
| 6 | 9 Oct #63 The article's plan figures are blurred crops (unchanged) | /knowledge/reading-a-layout-plan | A lesson in reading plans illustrated by unreadable plans | Clean originals |
| 7 | [[table3-copy-aa]] 14 line positions of the film's words under 4.5:1 | Film, table 3 on wide screens; table 1 sideways; map on a short phone | The lines that say where the land is | A denser shade on the pilaster, or the lines moved |
| 8 | [[plate-props-close]] Two new opening pictures show props too close | /branches, /terms (and their share cards) | Flat brass, white flames, faceted palms at full screen | Wider views, or props finished for the close-up |
| 9 | [[heads-comma-pairs]] A quarter of the headings in one mould | All inner pages | Reads as formula | Plain headings; keep the mould for a few |
| 10 | [[map-pin-plate-on-note]] A pin plate sits on the note | Film, map, 390×664 | A collision in the closing chapter | Plates clear at every phone height |
| 11 | [[film-copy-negation]] Three "this, not that" lines in the film | Film | The first page keeps the voice the inner pages lost | Positive statements, with the client's agreement |
| 12 | 9 Oct #53 Headline figures read "4o7" (unchanged) | Film, /about, /projects, layout pages | The key numbers look like a font error | One setting (--figure-nums), with the client |
| 13 | 9 Oct #33 The first hall frame cuts the portrait at the eyes (unchanged) | Film, 57.5% | The room's centrepiece first seen as a fragment | With the client (camera) |
| 14 | 9 Oct #43 Stair passes on blank wall and balusters (unchanged) | Film, 67–69% and 75–79% | Empty frames between the product's moments | With the client (camera) |
| 15 | [[still-live-shift]] The picture slides 3–16 px when the scene takes over | Every page, first visit | Gives away the still | Stills rendered from the live camera |
| 16 | [[lightmap-seams]] Dotted seams in the hall's baked light | Film and hall pages | A rendering tell, one behind a link | Re-bake, with the client |
| 17 | [[titles-on-gilt-lettering]] Page words over the picture's lettering | /properties and /about on upright screens | Two lettering layers crossing | Crop the lettering clear |
| 18 | 9 Oct #88 and #92 Quotations for another project and company; stock mission (unchanged) | /testimonials, /about | Filler where proof should be | The client's material |
| 19 | [[pool-corner-slot]] A black slot in the pool's corner | Film, cover | A hole in the most-shared frame | Close or draw the corner |
| 20 | [[pin-dash-about]] and [[feet-two-ways]] Two written forms left | /about; /properties and the guide | The last of six ways to write things | One form each |

---

# 4. All findings

Numbered #1 to #{{TOTAL}} for this pass. A finding of 9 October is written "9 Oct #n". Evidence files are in [ev/](ev/).

