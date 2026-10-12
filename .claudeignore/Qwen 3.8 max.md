# ART DIRECTION REVIEW — Quality Homes Realty WebGL Experience

**Evidence note:** The material I have is a sequence of rendered states (hero → orbit → `#revolution` → `#holdings` → `#approach` → portico push → foyer/`#station-2` → `#city` footer) captured at a deliberate ~1 notch/second scroll. Exact clock timestamps are not recoverable from the frames, so I anchor every observation to the state/URL and its ordinal position in the sequence, which is what matters for pacing judgement anyway.

---

## THE CHEAPNESS SIGNALS, BY PRIORITY

### CRITICAL

**C1 — The estate reads as a tabletop model, not as land.**
WHAT I SEE: A uniform milky fog band sitting at horizon height; a perfectly flat ground plane with machine-straight mowing stripes; palms and broadleaf trees as alpha-card cutouts with visible hard edges; a white boundary wall that is a flat ribbon and literally ends in mid-air at the left of the orbit frame; a tilt-shift-style blur softening the top and bottom of frame; a corner vignette on top of all of it.
WHY IT FEELS CHEAP: Every one of these cues is a cue of *miniature*. Fog-at-horizon + flat striped ground + cardboard foliage + edge blur is exactly the optical signature of a photographed diorama. For a plotted-layout developer whose entire commercial promise is "real ground, sanctioned plans," rendering the product as a toy model is not a style choice, it is a contradiction of the message. It also converts your WebGL effort into "a tech demo of a model" rather than "a place I could own."
PREMIUM TARGET: The same fog, the same orbit, the same estate — but the ground near camera carries real micro-relief, texture variation and edge darkening; the fog is colour-matched to the sky at the horizon so there is no grey band; the world edge is hidden by *designed foreground* (a hedge line, a terrace wall in frame) rather than by haze alone; the tilt-shift and vignette are removed or reduced to a whisper so the lens reads as a real camera at human height, not a macro lens over a maquette.

**C2 — There is no authored light script; each section is graded in a different world.**
WHAT I SEE: Hero = flat grey-green overcast milk. `#revolution` = slightly warmer grey. `#holdings` = pink-yellow sunset glow. `#approach` = dusk blue with warm door light. Foyer = flat cream ambient with no visible light source logic. Footer = black void with a spotlight. The sky dome itself is a smeary, banded cloud texture whose colour never agrees with the fog colour beneath it.
WHY IT FEELS CHEAP: Inexpensive experiences change mood per screen because each screen is built separately. Expensive experiences move through *one* continuous light — a single time-of-day arc that the camera travels through. Right now the hash changes and the planet changes. The viewer's subconscious reads five unrelated demos stitched with fades, which is the single strongest "student reel" signal in the piece.
PREMIUM TARGET: One colour script from first frame to last: e.g. late-afternoon haze at the hero, deepening gold through the orbit, true dusk at the door, interior lamplight continuing the same warmth, and the closing table lit by the same dawn/lamp family. Sky, fog, ground bounce and interior practicals all sample from that one ramp. The grade must feel like weather, not like a per-section filter.

**C3 — The thing you sell is the least art-directed object in the experience.**
WHAT I SEE: The sanctioned layout plans appear (a) as a small dark board half-cropped at the left edge of the foyer frame, unlit and unreadable, and (b) as a pale parchment inlay on the footer table whose lines and "BAY OF BENGAL" label are below legibility. The plot geometry on the boards is an unlabeled white/grey mass. Meanwhile the generic colonial mansion gets five consecutive camera beats.
WHY IT FEELS CHEAP: Attention is budget. Where the camera lingeringly orbits is what the brand claims matters. Right now the budget says: mansion diorama > founder portrait > your actual product. A visitor finishes this experience having seen a house they are not being sold and never having read a single plot. That inversion reads as amateurish regardless of render quality, because art direction *is* the discipline of pointing at the right thing.
PREMIUM TARGET: Keep the boards and the table — the concept is correct — but give each layout board a composed gallery beat: camera squares up to it, light rises on it, the plot mass becomes legible (open vs sold differentiated in material, not colour noise), the nameplate becomes readable at arm's length. The closing table map should show the two districts and three layouts as a designed cartographic object, because that inlay is your entire portfolio in one image.

**C4 — The 2D type layer is HTML floating on top of a video, not title design integrated with the frame.**
WHAT I SEE: Every overlay block is pinned to the same left column (~x=278) regardless of what the camera is showing. No scrim, no shadow, no relationship to the composition behind it. At `#holdings` the white statistics sit directly over the *brightest* area of the sunset fog — the lowest-contrast zone in the frame — exactly where the most important data must be read. The hero paragraph sits over busy foliage. At `#approach` the block jumps to centre-bottom, abandoning the left column without a system reason.
WHY IT FEELS CHEAP: Premium title sequences place type into the negative space of the composed frame; the type and the image are designed together, per frame. Here the type ignores the image entirely, which is the visual definition of "a template wrapped around a custom 3D experience."
PREMIUM TARGET: For each beat, choose the type position from the frame's own empty space (the fog band, the sky, the dark hedge mass), and protect legibility with composition first — dark ground behind light type, or light ground behind dark type — never with a generic overlay panel. The left column can remain your default voice, but it must be allowed to move when the frame demands it, and the move must feel deliberate.

### HIGH IMPACT

**H1 — The typographic system whispers, and uses one gesture for everything.**
WHAT I SEE: One serif family carries headline (~44px), body (~14px), stats, footer and legal. Headline line breaks are manual and unbalanced ("Land, in the / districts we come from" leaves a dead right half of the frame). The body paragraph breaks mid-sentence into a ragged three-line brick. The rule-plus-letterspaced-caps motif is reused identically for: scroll cue ("SCROLL"), entry cue ("START HERE"), CTA ("STEP INSIDE"), CTA ("ARRANGE A SITE VISIT"), and section link ("WHO WE ARE"). In the stats block, the gap between numeral and label shifts row to row.
WHY IT FEELS CHEAP: Luxury typography is confidence: one enormous, well-placed statement; a disciplined secondary voice; one — maximum two — ceremonial gestures. When the scroll hint, the primary CTA and the footer CTA all wear the same uniform, nothing is important, and the uniform itself becomes a tic. Small serif body copy over a 3D scene also reads as "default browser text I forgot to style."
PREMIUM TARGET: Keep the serif and the gold — the voice is right — but introduce real scale contrast (the hero statement should occupy the frame's upper third with authority), fix the measure so body copy sets in clean 2–3 line blocks with intentional breaks, align the stats as a true tabular unit with a hairline structure, and reserve the rule+caps gesture for exactly one class of action.

**H2 — A single, uniform low fidelity tier across all assets, with visible texture failures.**
WHAT I SEE: The roof reads as brown tile from one angle and as a magenta/purple swirling artifact from another (UV or texture bleed — unmistakably a bug in motion). Window glass at dusk is a flat emissive rectangle with no interior behind it. The black sedan is a toy-grade low-poly car present in every exterior beat. Urns are cones-in-cups; hedges are dark boxes with crumpled red blobs; the pool is a flat cyan plane with a white coping and no reflection; the marble floor is a blurry grey smear; the stair carpet is a noise pattern; the foyer frieze is a flat star decal strip; the portrait is a casual snapshot with a chair back visible behind the subject, mapped on a slightly glowing plane; the picture light is a bar with a glow sprite.
WHY IT FEELS CHEAP: Not because any single asset is bad, but because *nothing in the frame is allowed to be the hero detail*. Expensive CGI hides its budget by concentrating fidelity where the eye lands (threshold, hands-on surfaces, the product) and letting distance carry simplicity. Here fidelity is flat everywhere, so every glance lands on a tell — and the roof artifact is a tell that reads as broken, not stylized.
PREMIUM TARGET: Fix the roof material first (it is a defect, not a direction). Then create a fidelity hierarchy: the threshold, the door hardware, the boards, the table inlay and the portrait get real detail and real materials; the car, urns and distant foliage get simplified or removed rather than left at toy grade. Replace the snapshot portrait with a commissioned-style portrait — lit, cropped, backgrounded — because that face is your founder myth and currently it reads as a family photo pasted into a game.

**H3 — The camera demonstrates; it never directs.**
WHAT I SEE: A near-constant-velocity orbit and rise through the exterior beats; text fades in and out underneath it but the camera does not acknowledge the text. The push into the portico crops the pediment and columns at the frame edges and ends on a dark empty box containing one round table. The cut to the foyer lands on a symmetric stair but with the layout board pushed to the frame edge. The final state drops the camera into a black void around a table.
WHY IT FEELS CHEAP: A constant-velocity turntable with captions is the grammar of a demo reel. Directed sequences *hold*: the camera arrives at a composed frame, settles, lets the copy land, then moves. The absence of holds means the viewer never receives a single frame that feels like a commissioned photograph — and the portico push is worse than neutral, because the threshold promise ("The door is open.") pays off into visible emptiness.
PREMIUM TARGET: Same path, authored pacing: ease into 4–5 designed resting frames (the three-quarter estate view, the aerial over the actual layout ground, the squared-up threshold with depth visible inside, each board, the table), hold each while its copy reads, and move between holds with intention. The doorway must show depth — console, light pool on the floor, the stair beyond — so stepping inside is an invitation fulfilled.

**H4 — Interface debris in the nav.**
WHAT I SEE: A stray "…" element floating left of ENQUIRE in every state from the orbit onward; ENQUIRE carries a persistent underline; nav labels have no scrim and lose contrast over the bright fog at `#holdings`; the logo mark is a flat clip-art house badge with a pie-slice cut, stylistically unrelated to the rendered world.
WHY IT FEELS CHEAP: The ellipsis reads as an overflow bug shipped to production — the fastest possible trust-killer in a luxury context. The clip-art badge against a 3D estate says "logo bought separately from the experience."
PREMIUM TARGET: Remove the stray element; give the nav a legibility strategy tied to the grade (it may borrow the fog's own tone); redraw or restyle the mark so it belongs to the same world as the architecture — an engraved, linear, architectural emblem rather than a flat cartoon house.

**H5 — The ending abandons the world and collapses into default HTML.**
WHAT I SEE: After the foyer, the camera sits in a black vignette void containing a floating round table. Below it: three address columns of uneven width, two ragged rows of plain serif anchor links, a cramped legal line. No grid discipline, no hierarchy beyond bold headers, no ceremonial close, no brand sign-off.
WHY IT FEELS CHEAP: The last frame is the memory. Ending a cinematic walk with an unstyled link dump on black is ending a film with the credits typed in Notepad. The void also destroys the illusion that the table exists in the same house you just walked.
PREMIUM TARGET: Keep the table and keep the full footer content — but place the table in a real room (the foyer floor, lamplight, dawn through a door), make the inlay legible as the two districts, and set the footer on a true grid with a clear hierarchy: offices as composed columns, links as a disciplined index, and a final brand line that closes the piece the way the hero opened it.

### MEDIUM IMPACT

- **No contact grounding.** Planters, urns, balustrades, the car and the house itself meet the ground with hard lines and little or no ambient occlusion. Objects feel placed, not built. Premium target: occlusion and slight settlement everywhere something touches earth or stone.
- **Fog used as draw-distance cover rather than as atmosphere.** Distant trees float above the fog band instead of dissolving into it with aerial-perspective colour shift. Premium target: fog that tints by distance toward the sky colour, so depth reads as air, not as a wall.
- **Visible instance repetition.** Identical balusters, urns, windows and wall panels in unbroken rows with no variation, wear or dirt. Luxury CGI conceals repetition with subtle variation; here the rows read as a loop.
- **Interior light design absent.** The foyer is a cream box with uniform ambient; no pools of lamplight, no brass warmth, no shadow gradient on the walls. The portrait beat and the board beats lose all drama because nothing is lit *against* anything.
- **Accent gold undefined.** The gold appears at several different saturations and temperatures (logo "REALITY", the stats accent, rules, nameplate) so it never registers as a brand metal, only as occasional tinting.

### MICRO-POLISH (after the above)

- Letterspacing on caps labels is not optically consistent across sizes; "SCROLL" fades before "START HERE," orphaning the pair.
- The "START HERE" rule visually collides with the pool coping line behind it — an accidental alignment that reads as carelessness.
- Stats numerals and labels do not share a stable baseline grid; the "3 layouts" row sits optically loose.
- Footer link rows have irregular inter-item spacing; the legal line is cramped against them.
- The lantern glow sprite shows its halo edge; window mullions keep full thickness at distance, shimmering.
- The portrait nameplate type is below readable size — if it cannot be read, it should not be set.

---

## THE BIGGEST QUALITY KILLERS, RANKED

1. **The diorama read (C1 + tilt-shift + fog band + flat ground).** What I see: a model, not land. Why cheap: it contradicts the product and screams "render demo." Premium instead: a camera at human credibility in a place with air and ground. Preserve: the orbit, the fog mood, the estate layout itself.
2. **No continuous light script (C2).** What I see: five grades for five sections. Why cheap: separate demos stitched together. Premium instead: one time-of-day arc from hero to footer. Preserve: the dusk-at-the-door moment, which is your best light in the piece.
3. **The product is visually absent (C3).** What I see: boards cropped at frame edges, an unreadable table inlay. Why cheap: art direction that never points at what is being sold. Premium instead: legible, lit, composed layout beats. Preserve: the board-and-table concept entirely — it is the right idea, under-directed.
4. **Type floating over frame instead of composed into it (C4 + H1).** What I see: fixed left column, white stats over the brightest fog, one gesture for all CTAs. Why cheap: template-over-video. Premium instead: per-frame title composition with real scale confidence. Preserve: the copy voice — it is genuinely excellent ("We do not broker land…", "Counted from the sanctioned layout plans, not from a brochure") and the serif/gold identity direction.
5. **The camera never holds a composed frame (H3), and the threshold pays off into emptiness.** Why cheap: demo-reel grammar. Premium instead: rests, settles, and a doorway with depth. Preserve: the entire path — it is correct; only its pacing and its payoff frames need authorship.

---

## CHRONOLOGICAL AUDIT

**Hero (frames 1–2).** Works: the headline voice; the ambition of house + pool + palm tableau; the fog as mood. Cheap: milky horizon band; striped ground; cardboard palms at frame left; headline small and marooned in a dead right half; paragraph over foliage; pool cropped at the bottom edge; START HERE/SCROLL orphaning. Refine: compose the title into the fog band at confident scale; upgrade the near-camera ground and foliage zone; let the pool either be in frame properly or out. Do not change: the sentence, the left-voice default, the house's position in the lower right.

**Orbit reveal (frame 3).** Works: the rise communicates estate scale; clouds add drama. Cheap: boundary wall end-cap visible at left; scattered billboard trees; sky seam and banding; nav contrast loss; the stray ellipsis enters here. Refine: hide the world edge with designed foreground; match sky to fog; fix nav legibility. Do not change: the reveal intent.

**`#revolution` (frame 4).** Works: copy is the brand's spine, and it lands. Cheap: the roof's magenta swirl artifact; red hedge blobs; the copy block's vertical centre fights the house mass with no hold to read against. Refine: roof material; place the copy in the negative space above the hedge line; settle the camera. Do not change: the words.

**`#holdings` (frame 5).** Works: the honesty of "counted from the sanctioned layout plans" is a commercial masterstroke. Cheap: white stats over peak-brightness fog; the aerial angle is where the diorama read peaks — plane edges, floating trees, island-in-haze; grade unrelated to the previous section. Refine: this should be the data-hero beat — compose the camera so the *actual layout ground* is visible below, set type over a darker land mass, hold while the numbers land. Do not change: the statistic concept or its placement in the narrative.

**`#approach` (frames 6–7).** Works: the single most premium moment in the piece — dusk facade, warm door light, grounded car with real shadow, "The door is open." Cheap: emissive flat windows; the push crops pediment and columns and reveals an empty dark box with one table; lantern halo; top-edge blur. Refine: end the push on a squared threshold frame with interior depth (console, light pool, stair beyond); hold; then transition. Do not change: the dusk light, the sentence, the car's placement (but upgrade or remove the car model).

**Foyer / stations (frame 8).** Works: symmetric stair + lit founder portrait is a real composition and a real myth; the board concept is right. Cheap: board marginalized at frame edge, unlit, unreadable; snapshot portrait with chair back; stair carpet noise; flat cream ambient; star-frieze decal; edge blur; no continuity from the door we just entered. Refine: gallery beats per board (square up, light rise, legible plots, readable plate); commissioned portrait; lamplight design on walls and stair. Do not change: the symmetry, the portrait's centrality in the narrative, the stair as threshold.

**`#city` footer (frame 9).** Works: the round table as closing metaphor; complete, serious footer content. Cheap: black void + vignette; unreadable parchment inlay; ragged anchor-link rows; no grid, no sign-off; the experience ends by leaving its own world. Refine: place the table in a real lit room; legible district cartography; footer on a true grid with a closing brand line. Do not change: the table object or the content inventory.

**Transitions.** Exterior orbit → aerial → ground approach: large altitude swings per notch feel swoopy rather than travelled. Door → foyer: a continuity break (we were at the threshold; we arrive sideways inside). Foyer → footer: a break into nothingness. The hash changes behave like slides; the piece is five scenes with fades, not one walk. The fix is not more motion — it is holds, matched light, and threshold continuity.

---

## FINAL VIDEO VERDICT

**The single biggest temporal reason this does not feel expensive:** the camera moves at a demonstrative, near-constant velocity and never *holds a composed frame while copy reads*. Attention is never authored. The result is a turntable with captions — technically alive, directorially absent.

**The three most damaging moments:**
1. **The `#holdings` aerial** — the diorama read peaks (plane edges, floating trees) at the exact moment your most important data loses contrast against the brightest fog. The beat that should prove substance proves modelhood.
2. **The portico push** — "The door is open." is your best promise, and the camera's payoff frame is cropped columns around a dark empty box. The invitation is visibly unfunded.
3. **The drop into the footer void** — the world you built is abandoned for a black vignette and a link dump. The last memory of the brand is its least designed frame.

---

## AWWARDS-LEVEL READ

Genuinely strong dimensions: originality of concept (land → door → foyer → plans as one walk), copywriting voice, the dusk approach beat, the founder-portrait instinct, content completeness and commercial honesty. These are jury-respected qualities and they are rare.

The gap to exceptional work sits in: cohesion (one light, one palette ramp, one lens behaviour), typographic scale and per-frame placement, fidelity hierarchy and defect-free materials, motion authorship (holds and pays-offs rather than constant velocity), and finish (grounding, repetition concealment, nav cleanliness, footer grid). None of these require new ideas. All of them require discipline applied to the ideas you already have.

---

## 1. THE CORE PROBLEM

The experience is built like a demonstration of a model rather than a photograph of a place. Every major cheapness signal — the tilt-shift blur, the horizon fog band, the flat striped ground, the cardboard foliage, the constant-velocity orbit, the per-section grading — is a cue that tells the viewer "you are looking at a small object being rotated for inspection." That is the wrong cue for selling land.

Layered on top, the art direction never spends its attention budget on the product: the sanctioned layouts are glimpsed, cropped and unreadable, while a generic mansion receives five beats. And the 2D layer — one whispering serif, one reused gesture, type pinned to a column regardless of the frame — sits on the 3D like captions on a video.

None of this is a concept problem. The concept, the voice, the path and the moments are right. The gap is entirely in execution discipline: one light, one lens, composed frames, holds, legibility, and fidelity concentrated where the eye lands.

## 2. THE BIGGEST QUALITY KILLERS
The diorama read; the absent light script; the invisible product; type floating over frame; a camera that never holds. (Detailed and ranked above.)

## 3. WHAT MAKES IT LOOK EXPENSIVE (what this design needs more of)
Composed resting frames treated as photographs; a single continuous time-of-day arc; legibility protected by composition; fidelity concentrated at thresholds, hands-on surfaces and the product; grounding and occlusion; one defined brand metal; typographic scale confidence; ceremonial holds at each narrative beat.

## 4. WHAT TO PRESERVE
The walk concept (land → door → foyer → plans → map); the copy voice verbatim; the dusk approach light and "The door is open."; the symmetric stair with the founder portrait; the board-and-table concept; the statistics honesty; the serif + gold identity direction; the fog-as-atmosphere intent; the full footer content.

## 5. WHAT TO REMOVE OR REDUCE
The tilt-shift blur and heavy vignette; the stray nav ellipsis and stuck underline; the toy car (upgrade or cut); the roof artifact; the clip-art logo badge; the reused rule+caps gesture for every CTA; the black-void footer backdrop; edge-cropped, unlit board framing; instance repetition left bare; glow sprites with visible halos.

## 6. WHAT TO REFINISH
Ground and near-camera foliage material; fog-to-sky colour matching; window glass with interior depth; the doorway threshold interior; portrait photography; stair carpet and marble materials; board legibility and nameplates; table inlay cartography; footer grid and hierarchy; stats tabular alignment; nav legibility strategy.

## 7. THE "SAME DESIGN, EXPENSIVE VERSION"
Imagine the identical site: same orbit, same copy, same path, same boards, same table. But the light is one afternoon falling into dusk across the whole walk; the camera arrives and *settles* on four or five frames so well composed they could be the brand's print campaign; at each settle, type appears in the frame's own empty space at a scale that owns it; the fog is air, not a wall; the ground is earth; the door, when it opens, shows a lit hall with depth; each layout board is faced squarely and lit like a relic, its plots legible, its plate readable; and the experience closes not in a void but in the foyer at dawn, over a table map you can actually read, with a footer set like a document from a century-old firm. Nothing new added. Everything already there, finally directed.

## 8. FINAL ART-DIRECTION PRINCIPLE

**Every frame must survive being printed: one light, one lens, one composed subject — and no effect, asset or caption may contradict the claim that this is a real place, photographed, for sale.**