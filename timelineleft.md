Let me get the actual state rather than estimate from memory.

I dug into the actual repo state rather than estimating. Two live defects surfaced that change the picture, so those first.

## Two things broken right now

**1. Every project link on the pages I just shipped 404s.**

```
/projects/kartikeya-water-front   404
/projects/lucky-garden            404
/projects/vsr-gayatri-township    404
/projects/lucky-gardens           200   ← seed data
```

`/start-here` and `/properties` link to all three real projects. The projection database holds `the-azure-residences` (fictional) and `lucky-gardens` (a stale near-miss of the real name) — the three real layouts were never entered. My fault: I built content against project slugs that don't exist yet.

**2. The sitemap publishes fictional inventory and omits every real page.**

```xml
<loc>https://example.com/projects/the-azure-residences/b-501</loc>
```

`NEXT_PUBLIC_SITE_URL` is unset so the base is `example.com`, it enumerates 187 demo units, and not one of the 17 content pages is in it. If this shipped, Google would index a fake project and none of the real ones.

Both are Phase A below. Neither is hard; both are launch-blocking.

## Where we actually stand

| Area | State |
|---|---|
| Public routes | 26 files exist; **17 content routes complete**, 3 legal `noindex`, 3 still Slice-0 placeholder (`/about`, `/why-us`, `/site-home`) |
| CRM | 27 routes built |
| 3D hall | GLB shipped (14 MB, 0 validation errors), **never confirmed in a real browser** |
| Consent + telemetry | Complete and tested |
| Lead scoring/routing | Complete, 13 tests |
| Unit tests | 188 domain + 30 db, all green |
| **E2E** | **400 lines total.** `apps/public` has one real spec (56 lines, presentation flow). **`apps/crm` has 2 specs but no `playwright.config` — they cannot run at all** |
| Accessibility | **No tooling at all.** No axe, no keyboard audit |
| Performance | **No budget, no Lighthouse.** The 14 MB GLB has never been measured on a real phone |
| SEO surface | Root layout has **no metadata whatsoever** — no `metadataBase`, no default title, no OG image, no favicon |
| Error monitoring | Sentry configs exist, never verified against a real DSN |
| Branding | **No logo asset anywhere in the repo** |

Honest summary: **the substance is roughly 60% there, the finish is roughly 15%.** Everything a client notices in the first ten seconds — logo, favicon, the link preview when he WhatsApps it to someone — does not exist yet.

## Phases left

**A. Data truth** *(blocks the two defects, and `/properties` availability)*
Enter the three real projects and their plots into `core`, publish to `projection`, rewrite the sitemap to enumerate the real content routes, set `NEXT_PUBLIC_SITE_URL`.

**B. Content completion** — `/about`, `/why-us`, `/site-home` off placeholder; the three legal pages once documents land.

**C. Branding & logo** — the "special feel" request. Detail below.

**D. Design pass over every page** — the one you flagged. Build a shared design system first, then 20+ pages through it. Front-loaded: the first three pages buy the system, the rest go fast.

**E. Mobile optimisation** — mid-tier to flagship, including whether the hall is even viable on a 4 GB Android and what the fallback is.

**F. QA** — CRM Playwright config, real E2E coverage on the money paths (enquiry → score → route → CRM inbox), consent matrix, axe pass, Lighthouse budget, cross-browser, real-device testing.

**G. Pre-launch** — SEO surface, analytics IDs wired, legal pages un-`noindex`, staging environment, client UAT round.

**H. Handover** — runbook, credential transfer, CRM training for his agents, DNS cutover, warranty window.

## What I need from you, and when

**Now — for Phase A (I'm blocked without it):**
- Confirm the three slugs are canonical: `kartikeya-water-front`, `lucky-garden`, `vsr-gayatri-township`
- **Should real plot inventory go into the CRM?** If the client wants live availability, his team must maintain it — that's a business commitment, not a technical one. If not, I keep `/properties` as-is.
- The production domain (`.com`? a new one?) — the sitemap and all canonicals need it

**Before Phase C — the logo brief.** "Special feel" is not actionable, and I'd rather you extract this in one conversation than trickle it. Ask him:
1. Does he want the **existing** logo elevated, or a new mark?
2. **The vector source.** An AI/SVG/EPS. A JPEG off the old site cannot be animated or printed. This is the single most likely thing to stall Phase C.
3. Where does it have to work? Site header, favicon, brochure, site board, WhatsApp DP, agent visiting card — each imposes different constraints
4. Any competitor mark he admires, and any he'd hate to resemble
5. Is the wordmark **"Quality Homes Reality"** exactly? (Note "Reality" — if that's a typo for "Realty" that has been live for years, changing it now is his call, not ours, and it affects every asset)

My read: he probably means motion and material — a mark that assembles on load, catches light, feels like brass on stone rather than a flat PNG. That's very achievable, and it's cheap once I have vector source. Without vector source it's impossible.

**Before Phase D:** whether he gets a **design approval round per page or one batch review**. Per-page approval roughly doubles the calendar time. Get him to commit to a review cadence.

**Before Phase G:** the analytics IDs, and the legal documents (already tracked, ~2026-08-10).

**Before Phase H:** who at his company owns the CRM after handover, and how many agents need training.

## Estimate

These are my working days. The wall-clock depends on your review cadence and his responsiveness.

| Phase | Working days | Note |
|---|---|---|
| A. Data truth | 1–2 | |
| B. Content completion | 2–3 | + client-blocked on legal docs |
| C. Branding & logo | 3–5 | **hard-blocked without vector source** |
| D. Design pass, 20+ pages | 12–18 | system first, then ~0.5 day/page |
| E. Mobile | 4–6 | |
| F. QA | 5–7 | |
| G. Pre-launch | 3–4 | |
| H. Handover | 2–3 | |
| **Total** | **32–48 working days** | |

**≈ 7 to 10 weeks** at a five-day week, assuming client dependencies arrive on the schedule above and Phase D runs in batch review.

Add roughly **2 weeks** if he wants per-page design approval. Add **1–2 weeks** if the logo needs redrawing from scratch because no vector exists.

The critical path is **Phase D**, not the client documents — those resolve in parallel. The one thing that could genuinely derail the timeline is logo source files, which is why it's the first thing worth asking him for.

Two recommendations. **Start Phase C discovery immediately**, even though it runs fourth — the answers take longest to arrive and the design system in Phase D should be built *around* the finished mark, not retrofitted to it. And **verify `/hall` on a real phone before Phase D**, not after: if 14 MB is unviable on a mid-tier Android, that changes what every page has to do, and finding out late would waste most of the design pass.

Want me to start on Phase A now? It's the smallest phase and it clears both live defects.



do phase A 

1. the 3 slugs are perfect 
2. yes they must go 
3. we will use the .in domain for it not the .com

for phase b

1. visit the 2 websites i mentioned (qualityhomesreality.in  & qualityhomesreality.com) these 2 sites have all the information u need in the about, why us and sitehome page also the same for careers page too 

for phase c 

1. he wants it elevated without losing the overall luxury feel of the website and not by making it flashy but the presence must be valuable 
2. the logo he sent me this file and i sent the same file to u as well 
3. all of them which u mentioned 
4. no 
5. yes the word mark is quality homes reality no changes 

for phase d 

1. the workflow is i will have a live 1 to 1 with the client and we will be building these in front of the client and each design we do goes to him and after his approval we move to the next one if he wants any changes we do it right there itself 

for phase E

1. the main focus of this website is to win sotd by awwwards and it is a non negotiable and to win that one of the main challenge is how well will the website run on a mobile phone when compared to a desktop or laptop 

for phase F 

1. i will do the testing and i will hire a team for QA testing off the freelancing market

for phase G 

1. you are an expert in that field so you know better than me so u have the green light 

for phase H 

1. we talk and do it together 


another important thing is rn remove all the placeholder projects in the database and add the new ones there i already sent u the brochures of the 3 projects 


however we did not mention about security in this big enterprise project and im sure we need to build it securely tell me if u can do it or shall i talk to a consultant and also tell me when is the last feasible phase we can do with out consulting him? so that i get time to prepare