Continuing — re-capturing the plan image crop at the exact scroll state where it was visible.

The plan's chapter stage fades to black at rest — the reveal system is unstable on the gallery too. I have sufficient native-resolution evidence from the full captures. Moving to the responsive pass at 390px.

Forensic sweep complete: all 22 routes probed, 18 pages visually inspected at 1600×1000, mobile at 390×844, micro-crops at native pixel level, programmatic design-token extraction on every page family. Here is the full report.

---

# FORENSIC VISUAL QA AUDIT — Quality Homes Reality

---

# 1. EXECUTIVE VERDICT

**No. In its current state this is not an award-ready website — it is a genuinely original concept wrapped in unfinished delivery.** The core idea (a scroll-driven film through a 3D "hall of tables" where each sanctioned layout sits on its own pedestal) is the most distinctive real-estate web concept I have audited this year, and the copywriting is better than 95% of luxury sites. But the execution is riddled with disqualifying defects: a **5.5-second blocking curtain on every single navigation** (verified: curtain still fully opaque at 3s over already-rendered content), **multi-viewport black dead zones** in the film where DOM-measured opacity is 1 but nothing is visible on screen, a **template logo in blue and pure white** — the only blue and only white objects on the entire site — an **accent color that is peach, not burnt orange** (`rgb(232,185,138)` measured), **zero grotesque loaded** against an explicit serif+grotesque brief, and "sanctioned plan" images that are actually **decorated brochure renders containing a cut-out child's face, a script logo, and a baked-in marketing tagline** — directly contradicting the site's own core claim ("Counted from the sanctioned layout plans, not from a brochure"). Visible AI slop exists (portrait compositing, procedural garlands, billboard chandelier, candy-colored model plots). Systemic inconsistencies span typography, naming, and the token system. The gap between concept (8.5/10) and execution (5.5/10) is the whole story.

---

# 2. TOTAL FINDINGS

| Severity | Count |
|---|---|
| CRITICAL | 6 |
| HIGH | 14 |
| MEDIUM | 12 |
| LOW | 7 |
| AI-SLOP | 6 |
| SYSTEMIC | 8 |
| **Total verified** | **39** |

---

# 3. TOP 20 MOST IMPORTANT PROBLEMS

1. **5.5s blocking route curtain** — every navigation site-wide. A juror clicking 5 links loses ~28 seconds to a branded blackout; on Lucky Garden and About the curtain ghost text is still visible mid-fade at 3.5s, overlapping the hero. Fix: cap at 600ms, only on first visit, never re-show on client-side nav.
2. **Film dead zones** — at chapter entry (`#revolution`, `#holdings`, station corridor scrollY ≈ 13,500–17,600, gallery plan stages at rest) sticky stages sit at `opacity: 0`. Verified programmatically: the 344/407/3 stats were on-screen, `opacity: 1` in DOM, invisible in render. Fix: shift fade-in windows to `[sectionTop − 8%, sectionTop]`.
3. **Off-palette logo** — blue/indigo house mark on a white rounded chip; the only blue and only pure-white element site-wide. It is also the first object on every page. Fix: redraw the mark in cream/burnt-orange, drop the white chip.
4. **Brochure renders published as "sanctioned plans"** — Kartikeya sheet contains a cut-out child's face (bottom-left), the caption "Set amidst Tranquil surroundings," (with stray comma), and a gold cartoon compass; Lucky Garden sheet opens with a red script "Lucky" logo. The site's central trust claim is falsified by its own gallery. Fix: publish the unornamented sanctioned sheets.
5. **Accent is peach, not burnt orange** — `--primary: hsl(30 67.1% 72.5%)` ≈ `#E8B98A`. Reads as wedding-stationery, not generational wealth. Fix: `hsl(17 78% 47%)` ≈ `#D8571B`.
6. **No grotesque loaded** — `document.fonts` contains only Estate Ampersand + Playfair. Every nav label, kicker, stat label and CTA is serif set at 10–11px with 0.3em tracking: mush at that size, and the brief's pairing is 50% missing.
7. **Cold navy WebGL background vs warm chocolate DOM** — station corridor frames render a blue-black `#0a0f1e`-type clear color while the DOM is `#15110C`. The brand's temperature splits between canvas and DOM mid-film.
8. **Pastel candy model plots (Lucky Garden)** — mint/pink/sky plot blocks on the 3D table read as a board game, not land. On-brand yellow was used on Kartikeya; consistency and tone both fail.
9. **Illegible model textures at hero scale** — all three project hero plaques ("KARTIKEYA WATER FRONT" etc.) and plot labels are smudged low-res textures at the exact moment the page says "every sanctioned plan published in full."
10. **AI-composited MD portrait** (About) — suit shoulder melts into background; shirt/tie region is incoherent cream shapes; obvious vignette compositing. On the "portrait" chapter — a named, real person.
11. **Procedural star garlands** (About staircase) — repeated star meshes strung along the stair rail and right wall; festive-template decoration with no design rationale in a luxury interior.
12. **Default OS scrollbar visible** next to the custom chapter rail on all content pages (`scrollbarVisible: true` measured) — a double-rail artifact on every scrolled page.
13. **Chapter rail persists over static footers** on content pages — film UI leaking into non-film layouts.
14. **Verbatim copy duplication** — "A brochure list is a statement of intent; the agreement is the commitment." appears word-for-word on `/projects/kartikeya-water-front` and `/book-a-site-visit`.
15. **Punctuation defect** — "As the brochure and the sheet give it, No distance here has been estimated." (capital "No" after comma) on Kartikeya's Getting-there section.
16. **Triple naming system** — same routes carry three names: menu "On the ground" / footer "Gallery"; "The guide" / "Investment guide"; "The plans" / "Layout plans"; chapters add a third cinematic layer. Wayfinding friction on a site where every click already costs 5.5s.
17. **Flat billboard chandelier** (FAQ dome scene) — a 2D cutout sprite in an otherwise 3D interior; shatters the scene's material logic.
18. **Texture magnification on wood panels/doors** — heavy streaking/blur at grazing angles (VSR Gayatri hall, film interiors) exposes low-res textures.
19. **Thin content pages** — Knowledge 137 words, Careers 144, Downloads 192, Testimonials 254 ("Three buyers, unedited" = three quotes). For a $130k authority build, these are stubs.
20. **Hard seams between sticky stages** — visible horizontal edges where two chapter stages meet (FAQ page crop, Holdings band edge), the visual signature of independently-stitched sections.

---

# 4. ALL FINDINGS

### ISSUE #1 — CRITICAL
**Location:** Site-wide, every client-side navigation. **Element:** Route-transition curtain ("QUALITY HOMES REALITY" + rule). **Observation:** Full-screen curtain holds ~5.5s per navigation; page behind is already rendered (Properties captured at 3s with hero visible *through* the curtain). **Evidence:** Properties screenshot at t≈3s shows curtain text fully opaque over dimmed rendered hero; ghost text mid-fade on Lucky Garden and About at t≈3.5s. **Why:** Usability catastrophe; jurors will experience the site as a slideshow of delays. **Expected:** ≤600ms, skip on subsequent navigations. **Scope:** Systemic. **Related:** #2.

### ISSUE #2 — CRITICAL
**Location:** Film `/` chapters; `/gallery` plan stages. **Element:** Sticky text stages. **Observation:** At section entry, stage `opacity: 0` — users see pure black or bare 3D with zero copy for multiple viewport-heights (station corridor 13.5k–17.6k nearly black across 3 captures). **Evidence:** DOM probe at `#holdings`: stats `opacity:1`, `rectTop 647/837`, invisible in screenshot; gallery plan black at rest scrollY 1150/1650. **Why:** The page's strongest content is invisible; anchors (`#holdings`) land on nothing. **Expected:** Text fully opaque on section arrival. **Scope:** Systemic.

### ISSUE #3 — CRITICAL
**Location:** Global header, all pages. **Element:** Logo mark. **Observation:** Blue/indigo house icon with red-orange arrow inside a white rounded chip. **Evidence:** Native-res crop: saturated blue + pure white; zero blue/white elsewhere on site (bg `#15110C`, cream `#F2EDE4`, peach accent). **Why:** First impression contradicts the entire palette; reads as a template default. **Expected:** Mark redrawn in cream/burnt orange on transparent ground. **Scope:** Isolated but highest-visibility.

### ISSUE #4 — CRITICAL / AI-SLOP
**Location:** `/gallery`, Kartikeya sheet bottom-left/bottom-center; Lucky Garden sheet top-left. **Element:** Plan images. **Observation:** Child's face cut-out floating over the plan; caption "Set amidst Tranquil surroundings," baked in; gold cartoon compass; red script "Lucky" logo + green tree illustration on the second sheet. **Evidence:** Two full-res captures. **Why:** The site's differentiating claim ("not from a brochure," "sanctioned plan published in full") is visibly falsified; the child cutout is textbook brochure slop. **Expected:** Raw sanctioned sheets, no decorative collage. **Scope:** Repeated (3 sheets).

### ISSUE #5 — CRITICAL
**Location:** Film station corridor + interior chapters. **Element:** WebGL clear color / environment. **Observation:** Cold blue-black void behind station text. **Evidence:** Station + portrait captures show uniform navy-black. **Why:** Palette fracture canvas↔DOM; feels like a different site between chapters. **Expected:** Warm espresso `#15110C` family fog/clear. **Scope:** Systemic.

### ISSUE #6 — CRITICAL / SYSTEMIC
**Location:** Site-wide. **Element:** Font loading. **Observation:** Only serif family loaded; no grotesque exists. **Evidence:** `document.fonts` = Estate Ampersand + Playfair only; all micro-type is serif. **Why:** Brief mandates serif+grotesque pairing; serif micro-caps at 10–11px is illegible mush and kills editorial contrast. **Expected:** Wide grotesque for ≤16px UI text. **Scope:** Systemic.

### ISSUE #7 — HIGH / SYSTEMIC
**Location:** All accent applications. **Element:** `--primary`. **Observation:** Peach `rgb(232,185,138)` measured; brief says burnt orange. **Why:** The single most-repeated brand color is off-brief; desaturated peach lowers perceived value. **Scope:** Systemic.

### ISSUE #8 — HIGH / SYSTEMIC
**Location:** Film CTA caps vs content-page micro-caps. **Element:** Same component class, two sizes. **Evidence:** Measured `11.3778px` ("START HERE", film) vs `10.24px` (content-page CTAs), same weight/track. **Why:** Same component, 11% size drift across page families. **Scope:** Systemic.

### ISSUE #9 — HIGH / AI-SLOP
**Location:** `/about` hero portrait (K. Bhaskara Rao). **Element:** Portrait photo in 3D frame. **Observation:** Suit shoulder dissolves into background; shirt/tie region incoherent cream masses; composited vignette. **Why:** A named real person rendered with generative artifacts is a credibility and dignity problem. **Expected:** Real photograph, color-graded to palette. **Scope:** Isolated.

### ISSUE #10 — HIGH / AI-SLOP
**Location:** `/about` staircase walls. **Element:** Star garlands. **Observation:** Repeated star meshes strung along rail and wall, identical geometry. **Why:** Festive-template decoration with no rationale in a luxury hall; reads procedurally placed. **Scope:** Repeated.

### ISSUE #11 — HIGH
**Location:** `/projects/lucky-garden` hero model. **Element:** Plot colors. **Observation:** Mint/pink/sky pastel plot blocks. **Why:** Candy palette breaks brand and tone; inconsistent with Kartikeya's yellow plots. **Scope:** Isolated.

### ISSUE #12 — HIGH
**Location:** All three project hero models + station tables. **Element:** Plaque/plot textures. **Observation:** Plaque text and plot labels are smudged, illegible at hero scale. **Why:** Illegibility at the money moment contradicts the transparency claim. **Scope:** Repeated.

### ISSUE #13 — HIGH / SYSTEMIC
**Location:** All content pages. **Element:** Scrollbar. **Observation:** Default OS scrollbar visible beside the custom chapter rail (`scrollbarVisible: true`; brown strip in captures). **Why:** Double-rail artifact; unstyled native UI in a bespoke experience. **Expected:** Custom-styled or hidden scrollbar.

### ISSUE #14 — HIGH
**Location:** Content-page footers (verified on Kartikeya). **Element:** Chapter rail. **Observation:** Film progress rail still overlays the footer. **Why:** Film chrome leaking into document layouts. **Expected:** Rail fades out before footer.

### ISSUE #15 — HIGH
**Location:** `/projects/kartikeya-water-front` (amenities) ↔ `/book-a-site-visit` (step 04). **Element:** Copy. **Observation:** "A brochure list is a statement of intent; the agreement is the commitment." verbatim twice. **Why:** On a site this voice-driven, self-plagiarism is glaring. **Scope:** Repeated.

### ISSUE #16 — HIGH
**Location:** Kartikeya "Getting there" support paragraph. **Element:** Punctuation. **Observation:** "…give it, No distance here has been estimated." — capital after comma. **Scope:** Isolated.

### ISSUE #17 — HIGH / SYSTEMIC
**Location:** Menu vs footer vs chapters. **Element:** Route naming. **Observation:** Three names per destination (menu poetic / footer literal / chapters cinematic): "On the ground"=Gallery, "The guide"=Investment guide, "The plans"=Layout plans, etc. **Why:** Wayfinding tax on top of the 5.5s curtain. **Scope:** Systemic.

### ISSUE #18 — HIGH
**Location:** `/faqs` dome scene. **Element:** Chandelier. **Observation:** Flat 2D billboard sprite among 3D geometry. **Why:** Material logic of the scene collapses at close range. **Scope:** Isolated.

### ISSUE #19 — HIGH
**Location:** Film interiors, VSR Gayatri hall, Lucky Garden left edge. **Element:** Wood door/panel textures. **Observation:** Heavy streaky blur at grazing angles (texture magnification). **Scope:** Repeated.

### ISSUE #20 — HIGH
**Location:** `/knowledge` (137 words), `/careers` (144), `/downloads` (192), `/testimonials` (254). **Element:** Content depth. **Observation:** Stub pages on the same template as 500–700-word pages. **Why:** Template consistency exposes emptiness; feels auto-generated. **Scope:** Repeated.

### ISSUE #21 — MEDIUM
**Location:** `/contact` hero wall; film interior gradients. **Element:** Render gradients. **Observation:** Heavy dither/noise pattern and banding on large soft gradients. **Scope:** Repeated.

### ISSUE #22 — MEDIUM
**Location:** `/faqs` stage boundary; `/projects/*` amenities band edge. **Element:** Section transitions. **Observation:** Hard horizontal seams between stacked dark tones (two near-identical blacks meeting at a visible line). **Scope:** Repeated.

### ISSUE #23 — MEDIUM / SYSTEMIC
**Location:** Film chapter kickers vs content kickers. **Element:** Kicker treatment. **Observation:** Film uses cream caps micro-labels; content pages use 16px sentence-case peach serif ("The sanctioned plan"). Two kicker systems. **Scope:** Systemic.

### ISSUE #24 — MEDIUM
**Location:** `/faqs`. **Element:** Question rows. **Observation:** No `<details>`/buttons — static text only; no in-page anchors for 7 sections. **Why:** Minor navigation/accessibility gap. **Scope:** Isolated.

### ISSUE #25 — MEDIUM
**Location:** Menu overlay. **Element:** Active state. **Observation:** Active route ("Questions") indicated by color change only — no weight/underline/icon. **Scope:** Isolated.

### ISSUE #26 — LOW
**Location:** Kartikeya footer. **Element:** "Questions" link. **Observation:** Persistent underline without pointer/hover cause; no other footer link underlined. **Scope:** Isolated; needs investigation.

### ISSUE #27 — MEDIUM
**Location:** Film hero; project heroes. **Element:** Micro-CTAs over 3D scene. **Observation:** "START HERE" cream caps over bright pool/lawn pixels with no scrim. **Why:** One camera keyframe from AA failure. **Scope:** Repeated.

### ISSUE #28 — MEDIUM / SYSTEMIC
**Location:** `:root` vs body classes. **Element:** Token system. **Observation:** 45 HSL tokens defined but body uses hardcoded `bg-[#15110C] text-[#F2EDE4]` — two sources of truth already drifting (see #7). **Scope:** Systemic.

### ISSUE #29 — MEDIUM
**Location:** Film right rail on mobile 390px. **Element:** Chapter dots. **Observation:** Rail dots overlap the text column edge on narrow viewports. **Scope:** Isolated.

### ISSUE #30 — MEDIUM
**Location:** Mobile header. **Element:** Logo lockup. **Observation:** Wordmark drops to icon-only chip — the brand name is absent from the mobile hero, and the chip is visually dominant. **Scope:** Isolated.

### ISSUE #31 — MEDIUM
**Location:** Performance (Developer Award). **Element:** Runtime. **Observation:** 362MB JS heap; FCP 2.2s; load 4.2s; LCP entry suppressed by the curtain. 112fps at DPR 1 1600×1000 (healthy), but no DPR-2 environment to verify retina cost. **Scope:** Systemic.

### ISSUE #32 — MEDIUM
**Location:** About/film interiors. **Element:** Foliage. **Observation:** Maroon "blob" shrubs and identical repeated topiary cones (3×) and lamp sprites; visible mesh repetition. **Scope:** Repeated.

### ISSUE #33 — LOW
**Location:** Kartikeya "Getting there" landmarks row. **Element:** Justified text. **Observation:** "Ramatheertham — Heritage Kumili Temple — Vizianagaram Fort" shows stretched em-dash gaps from justification. **Scope:** Isolated.

### ISSUE #34 — LOW
**Location:** Nav "ENQUIRE". **Element:** Underline. **Observation:** Persistent underline extends slightly wider than the word. **Scope:** Isolated.

### ISSUE #35 — LOW
**Location:** Cookie dialog. **Element:** Button hierarchy. **Observation:** "Accept all" is the visually active/primary option by default. **Why:** Borderline dark pattern for a privacy-first voice. **Scope:** Isolated.

### ISSUE #36 — LOW
**Location:** `/gallery` plan images. **Element:** Alt text. **Observation:** Plan alt present ("Sanctioned layout plan of Kartikeya Water Front") — good; logo `alt=""` decorative — acceptable; 1 image without alt detected in film DOM (non-content image). **Scope:** Isolated.

### ISSUE #37 — LOW
**Location:** Testimonials page. **Element:** Proof depth. **Observation:** Three quotes total for a 20-year company; no locations, plot numbers, or dates attached. **Scope:** Isolated.

### ISSUE #38 — LOW
**Location:** Downloads page. **Element:** File sizes in caps CTAs ("TAKE IT WITH YOU, 118 KB"). **Observation:** File-size in a display-caps CTA mixes utility metadata into the voice. **Scope:** Isolated.

### ISSUE #39 — LOW
**Location:** Form (verified via probe). **Element:** Enquiry form. **Observation:** Actually strong — `autocomplete="name"/"tel"`, 16px+ inputs, 50px targets, honeypot. Listed only to balance the record; radios are visually-hidden customs (h=1) so keyboard focus indicators must be verified on the visible labels. **Scope:** Isolated.

---

# 5. SYSTEMIC PROBLEMS

1. **Dual (really triple) source of truth for color** — 45 unused HSL tokens vs hardcoded Tailwind hex vs whatever the WebGL scene uses. Appears in: body classes, accent, canvas clear color, model plot colors (4 locations).
2. **Micro-caps component drift** — 10.24px vs 11.38px for the same caps-CTA class; serif instead of grotesque; two kicker systems (film caps vs content sentence-case). Appears on all 22 pages.
3. **The 5.5s curtain + dead-zone reveal architecture** — one choreography system produces both the blocking curtain and the opacity-0 chapter entries; every page pays.
4. **Film chrome leaking into document pages** — rail over footers, rail overlapping mobile text, film kickers on content pages.
5. **Naming fragmentation** — menu/footer/chapter names for the same 12 routes.
6. **Texture budget too low** — illegible plaques, stretched wood, billboard chandelier, blob shrubs: one root cause (low-res/procedural assets viewed close).
7. **Copy reuse** — signature sentences repeated across pages instead of re-voiced.
8. **Content depth uneven** — 5 rich pages (500–700 words) vs 4 stubs (≤200 words) on identical templates.

---

# 6. AI-SLOP REPORT

1. **Child's face cut-out on the Kartikeya plan** — a smiling boy's head crudely pasted over the plan's greenery; the single worst slop artifact on the site.
2. **MD portrait compositing** — garment/background boundaries incoherent; classic generative-composite evidence (About).
3. **Procedural star garlands** — repeated identical star meshes as "decoration" (About staircase).
4. **Candy pastel plot blocks** (Lucky Garden model) — color logic no surveyor or designer would choose; procedural material assignment.
5. **Flat billboard chandelier** (FAQ dome) — 2D sprite in 3D space.
6. **Baked-in brochure marketing copy** — "Set amidst Tranquil surroundings," inside the plan image; red script logos; cartoon compass — generated brochure dressing masquerading as legal documents.

---

# 7. DESIGN-SYSTEM INCONSISTENCIES

| Component | Expected pattern | Actual variations | Locations | Severity |
|---|---|---|---|---|
| Micro-caps CTA | One size, one family | 10.24px vs 11.38px, serif both | Film vs all content pages | HIGH |
| Kicker | One treatment | Caps cream (film) vs 16px sentence-case peach serif (content) | All pages | MEDIUM |
| Accent color | Burnt orange | Peach #E8B98A; also used as model plot tint | Global + 3D models | HIGH |
| Logo | Palette-conformant mark | Blue/white chip | Global | CRITICAL |
| Scroll behavior | Film chrome only in film | Rail over footers + mobile text | Content pages, mobile | HIGH |
| Canvas vs DOM ground | One dark tone | #15110C vs navy-black clear | Film stations | CRITICAL |
| Tokens | Single HSL system | Hardcoded hex + unused tokens | Global CSS | HIGH |
| Model plot colors | Consistent surveyor logic | Yellow (Kartikeya) vs pastel (Lucky) vs cream (VSR) | 3 project pages | HIGH |
| Route naming | One label per route | 2–3 labels per route | Menu/footer/chapters | MEDIUM |
| Section backgrounds | Seamless dark system | Hard seams, tone bands | FAQ, project pages | MEDIUM |

---

# 8. AWWWARDS READINESS

| Dimension | Score | Why |
|---|---|---|
| Visual craft | 6/10 | Real 3D art direction undermined by texture budget, seams, slop artifacts |
| Art direction | 7/10 | The hall-of-tables concept and copy voice are genuinely authored |
| Typography | 5/10 | One family; brief half-delivered; micro-type mush; drift between page families |
| Composition | 7/10 | Hero and chapter compositions are strong; dead zones and seams break rhythm |
| Consistency | 5/10 | Three naming systems, two kicker systems, canvas/DOM temperature split |
| Motion | 6/10 | Camera choreography is real work; the curtain and opacity-0 entries betray it |
| Originality | 8/10 | The concept would stand out in any jury week |
| Technical polish | 6/10 | 112fps headroom and solid form engineering vs 362MB heap, 5.5s curtain, token drift |
| Detail quality | 5/10 | Child cutout, punctuation errors, verbatim duplicates, footer rail leak |
| **Overall award readiness** | **6/10** | **Honorable Mention today; SOTM requires closing the concept–execution gap** |

---

# 9. FIX ORDER

**PHASE 1 — CRITICAL DEFECTS (do these or nothing else matters)**
Curtain → ≤600ms (#1) · Dead-zone reveal windows (#2) · Logo redraw (#3) · Replace brochure sheets with raw sanctioned plans (#4) · WebGL clear color to warm espresso (#5).

**PHASE 2 — SYSTEMIC DESIGN ISSUES**
Load the grotesque; migrate all ≤16px text (#6) · `--primary` → burnt orange + retire hardcoded hex to tokens (#7, #28) · Unify micro-caps at one size (#8) · Unify kicker system (#23) · One name per route (#17) · Hide/custom-style scrollbar (#13).

**PHASE 3 — AI-SLOP REMOVAL**
Real MD photograph (#9) · Remove garlands (#10) · Reskin Lucky Garden plots (#11) · 3D chandelier or remove (#18) · Retire collage elements from all sheets (#4).

**PHASE 4 — VISUAL CONSISTENCY**
Re-bake plaques/plot labels at readable resolution (#12) · Fix wood texture LOD (#19) · Smooth stage seams + scrim under scene-overlaid text (#21, #22, #27) · Rail fade-out before footers + mobile repositioning (#14, #29, #30) · Foliage/prop repetition pass (#32).

**PHASE 5 — MICRO-POLISH**
Copy edits (#15, #16, #33) · "Questions" underline investigation (#26) · ENQUIRE underline width (#34) · Cookie button hierarchy (#35) · File-size CTA styling (#38).

**PHASE 6 — FINAL AWWWARDS PASS**
Depth for the four stub pages (#20) · Testimonials with plot numbers/dates (#37) · Heap + FCP budget (target <200MB, FCP <1.2s) (#31) · DPR-2 retina verification · FAQ keyboard navigation (#24, #39) · Full reduced-motion audit.

---

**Bottom line:** the concept is an 8.5 hiding inside a 6. Phase 1 + Phase 2 alone (~1–2 weeks of focused work) move this from "impressive but broken" to legitimately jury-viable; Phase 3–4 make SOTM realistic. The single most embarrassing artifact a juror will find in under 30 seconds is the child cutout on the "sanctioned" plan — that one image is capable of sinking the Developer Award on credibility alone.

