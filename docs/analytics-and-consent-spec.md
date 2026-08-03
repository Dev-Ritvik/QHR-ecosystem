# Spatial Analytics & Consent Architecture

Status: **proposal, pending client sign-off.** Supersedes `leadcapture.md` as the build
specification. `leadcapture.md` is retained as the original brief; §9 records which of its
items are deliberately not built, and why.

> **This is an engineering specification, not legal advice.** It is written to be defensible
> under India's Digital Personal Data Protection Act 2023. Have counsel review the consent
> notice text and the retention schedule before launch.

---

## 1. What this is for

Route genuinely qualified, deeply profiled leads to the correct branch of three, using signal a
2D site cannot produce. A visitor who spends 45 seconds at the Kartikeya hologram and 5 seconds
at Lucky Garden has told us something no form field will. That is the asset worth building.

The design constraint is that **every signal below is collected with consent**, and the product
still works — including the scoring and the routing.

---

## 2. Legal basis

The DPDP Act requires consent that is *free, specific, informed, unconditional and unambiguous,
given by clear affirmative action*, with a notice that precedes or accompanies the request, and
withdrawal that is as easy as granting. Practical consequences for this build:

- **No pre-ticked boxes. No "by continuing you agree". No implied consent from scrolling.**
- Analytics and marketing must be **separately** refusable from each other.
- Withdrawal must be reachable at any time and must actually stop collection.
- Data collected before consent is granted must not be retained or transmitted.
- **Under-18 visitors:** no behavioural tracking or targeted advertising. Our audience is adult
  property buyers, but the consent gate must not assume it.

Penalties in the Act's schedule run to ₹250 crore. Separately — and in practice sooner — Meta
and Google both prohibit receiving data gathered without valid consent; the realistic first
consequence of getting this wrong is **ad account termination**, which removes the retargeting
engine this spend is meant to power.

---

## 3. Consent architecture

### 3.1 Categories

| Category | Default | Refusable | Contents |
|---|---|---|---|
| **Essential** | on | no | Session id, CSRF, load balancing, 3D asset cache keys, scene state in IndexedDB |
| **Experience** | off | yes | Camera position restore, lighting/audio preference, last-visited place |
| **Analytics** | off | yes | All spatial telemetry in §4, first-party session stitching, Clarity/Hotjar |
| **Marketing** | off | yes | Meta / Google / LinkedIn pixels, server-side CAPI, cross-session retargeting |

Essential is genuinely essential — it carries no profiling and no identifier that outlives the
session. Everything else is off until affirmatively enabled.

### 3.2 The consent moment is part of the experience, not a banner

At this budget a grey cookie bar is a wasted opportunity and an opt-in killer. Consent is a
designed in-world moment: the camera settles, a panel resolves in the same material language as
the hologram callout cards, and it says plainly what is collected and what it buys the visitor
("so we can show you the plots you actually looked at, and skip the ones you didn't").

Three controls: **Accept all · Essential only · Choose**. Equal visual weight — a dark-patterned
"Essential only" is both unlawful and, at this level of finish, obvious.

Well-executed consent moments out-perform banners on opt-in. This is the one place where doing
the honest thing and doing the commercially optimal thing are the same move.

### 3.3 Storage and revocation

- Choice recorded in a first-party cookie `qhr_consent` (12 months) **and** mirrored server-side
  against the session id, so the server never has to trust the client.
- A persistent, reachable **Privacy** control re-opens the panel. Withdrawal takes effect on the
  next event dispatch — no queued events survive it.
- Consent version is stored with the choice. Changing the notice invalidates prior consent and
  re-prompts, rather than silently inheriting.

---

## 4. Event taxonomy

All events carry `session_id`, `consent_version`, `ts`, `place_id`. None carry direct identifiers
until the visitor submits a form (§6).

### 4.1 Spatial (the layer that justifies the project)

| Event | Payload | Signal |
|---|---|---|
| `place_enter` / `place_exit` | place id, dwell ms | Which of the ~7 world places hold attention |
| `camera_dwell` | place, camera xyz, target xyz, dwell ms | Sampled at 2 Hz, aggregated client-side into 5s buckets before dispatch |
| `node_focus` | mesh name, dwell ms | Raycast from cursor/touch into the scene — what they are actually scrutinising |
| `hologram_focus` | station (S1/S2/S3), parcel id, dwell ms | **The highest-value event we have.** Which township, which plot. |
| `hologram_parcel_select` | station, parcel id | Explicit intent on a specific plot |
| `media_open` | asset id, kind | Floor plan, gallery image, walkthrough |
| `cta_hover` | cta id, hover ms, followed_through bool | Interest coupled with hesitation |
| `route_open` / `route_close` | route id, dwell ms, scroll depth, pacing px/s | Surfaces opened over the 3D (§8) |

`hologram_focus` is worth calling out: because the plots are now real extruded geometry with
their own contours, a raycast returns an actual **parcel**, not a pixel on a texture. The
extrusion work already done is what makes plot-level intent tracking possible at all.

### 4.2 Session

`session_start` (referrer, UTM, viewport, device tier from §10 — **not** GPU model), `session_end`
(total dwell, places visited, max scroll), `form_start`, `form_submit`, `form_abandon` (field
count reached only — **no field values**, see §9).

### 4.3 Sampling

Telemetry must never cost frames. Events are buffered in-memory, aggregated, and flushed on a 10s
timer, on `visibilitychange`, and via `sendBeacon` on unload. Hard cap 40 events per flush.

---

## 5. Lead scoring (0–100)

Transparent and auditable — the sales floor must be able to see *why* a lead scored what it did,
and the visitor must be able to have it explained on request.

| Component | Max | Basis |
|---|---|---|
| Hologram engagement | 30 | Total dwell across stations, weighted to parcel-level focus |
| Depth of exploration | 20 | Distinct places entered × median dwell |
| Content consideration | 15 | Route dwell with slow pacing (reading, not skimming) |
| Explicit intent | 20 | Parcel select, floor-plan open, pricing view, site-visit interest |
| Return behaviour | 15 | Distinct sessions within 30 days (Analytics consent only) |

Threshold for immediate outbound: **75+**. Below 40, nurture only.

**Where consent is refused, the lead still scores** — on form content and explicit actions
alone, capped at 40. It is never zero and never blocked. Refusing analytics must not make a
buyer invisible to the sales floor.

---

## 6. Identity and stitching

The only identifier before a form submission is a **first-party, per-session id**. It is not a
fingerprint, it is not derived from hardware, and it does not survive a cleared cookie — by
design.

On `form_submit`, the session id is attached to the lead. The CRM then holds the visitor's
consented spatial history against their contact record: *which township, which parcels, how
long, how many visits*. That is the "Palantir-style dossier" the brief asks for, built from data
the person agreed to give.

Cross-session stitching (Analytics consent) uses the first-party cookie only. **No probabilistic
cross-device matching** — see §9.

---

## 7. Branch routing

1. **Interest-first:** the township with the highest weighted hologram dwell picks the branch
   that owns it. This is a stronger signal than geography and should dominate.
2. **Geo-IP** to city/region resolution only — never street-level — as a tiebreak.
3. **Explicit override:** if the visitor names a preferred branch or location in the form, that
   wins outright.

Routing is recorded with the reason, so misroutes are diagnosable rather than mysterious.

---

## 8. Data flow

```
browser ──first-party── /api/telemetry (our origin)
                              │
                              ├─→ our datastore (raw, retention §11)
                              ├─→ CRM lead enrichment (on stitch)
                              └─→ Meta / Google CAPI  [Marketing consent only]
```

All telemetry is first-party to our own origin, then relayed server-side. To be explicit about
why, since the original brief framed this differently: server-side relay is used here for
**reliability, payload control and keeping third-party JS out of the render loop** — not to
bypass ad-blockers. Consent state is enforced at the server boundary, so a blocked client-side
pixel and a refused consent produce the same result: nothing is sent.

### Schema additions required

`core.leads` currently has no scoring or telemetry link. Needed:

- `lead_score smallint`, `lead_score_breakdown jsonb`, `routed_branch_id`, `routing_reason text`
- new `core.visitor_sessions` — session id, consent state + version, first/last seen, UTM,
  device tier, aggregate dwell
- new `core.session_events` — the §4 taxonomy, partitioned by month for the retention job
- `core.leads.session_id` nullable FK

RLS must extend to these: agents see only sessions stitched to their own leads; raw unstitched
telemetry is owner-scope only.

---

## 9. Deliberately not built

Recorded so the decision is explicit and does not resurface as an oversight.

| Item in `leadcapture.md` | Why not |
|---|---|
| Ghost form capture / shadow profiling | Transmits name and phone of someone who chose not to submit. Collection without consent, of data actively withheld. |
| Clipboard sniffing | Reads arbitrary personal content never directed at the site. |
| Canvas fingerprinting to defeat incognito/VPN/blockers | The stated purpose is circumventing the visitor's expressed choice. |
| CAPI as ad-blocker evasion | Server-side relay is retained (§8); evasion as its *purpose* is not. |
| Keystroke cadence / anxiety inference | Covert psychological profiling from input timing. |
| IP → LinkedIn / employer deanonymisation pre-opt-in | Identifies a named individual with no consent. |
| GPU "wealth tier"; frustum-culling family-status inference | Discriminatory profiling on inferred sensitive attributes. `WEBGL_debug_renderer_info` is also increasingly restricted. |
| Battery Status API | Removed from the browsers in our target range. Would not work regardless. |
| Probabilistic cross-device matching | Merges profiles of people who never consented to being linked. |

Retained from the brief because they are legitimate: dynamic phone-number injection, first-party
analytics, all three ad pixels, session replay, CRM attribution cookies, propensity scoring,
geo-IP routing, live-chat triggers, server-side CAPI.

---

## 10. Mobile

Target is mid-tier to flagship. Device tier is decided by **measured frame time over the first
90 frames plus `deviceMemory` and `hardwareConcurrency`** — never by GPU model string, which §9
rules out and which browsers are restricting anyway.

| Tier | Experience | Telemetry |
|---|---|---|
| High | Full interactive WebGL | Full §4 |
| Mid | Pre-rendered spine; interactive at the hologram tables and plot selection | Full §4; `camera_dwell` becomes sequence-frame dwell |
| Low / no WebGL | Cinematic stills + standard routes | Route and CTA events only |

`hologram_focus` and `hologram_parcel_select` — the two highest-value events — must survive on
**every** tier, including low. The scoring model depends on them, and they are the reason plot
geometry was extruded rather than painted.

---

## 11. Retention and visitor rights

- Raw `session_events`: **13 months**, then aggregate and drop the raw rows.
- Unstitched sessions (no form submitted): **90 days**.
- Stitched sessions: follow the lead's retention.
- Withdrawal stops collection immediately and deletes unstitched telemetry for that session.
- **Access / correction / erasure / grievance** must be servable — DPDP grants these. Erasure has
  to reach `session_events`, not just the lead row, which is why the FK in §8 matters.
- Name a Data Protection Officer and publish the contact. Required, and cheap to do.

---

## 12. Build order

1. Consent architecture and the in-world panel — **nothing else may ship first**; collecting
   before this exists is the exposure we are avoiding.
2. Telemetry collector, schema, RLS.
3. Spatial events (place, camera, hologram) — the differentiator, and the reason for the spend.
4. Scoring + branch routing.
5. Pixels and CAPI behind Marketing consent.
6. Retention job and the rights endpoints.

bh 10 b 823 c  