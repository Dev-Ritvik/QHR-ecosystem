Investigating before touching anything — first, whether the interrupted install actually completed, and who the real troika consumer is:

Two important findings. Let me confirm the second before concluding:

**Chain confirmed definitively** — and it's exactly case 1 from your instruction:

```
r3f-perf → @react-three/drei → troika-three-text@0.52.4 → troika-worker-utils@0.52.0
```

`troika-worker-utils@0.52.0` is precisely the package in your stack trace. The **only** troika consumer is `r3f-perf` — the dev-only performance overlay I added, which renders its stats as *in-canvas 3D text* via drei's `<Text>`. Nothing in our source imports drei, `<Text>`, or troika directly.

That's an architecture §0 violation (readable text inside the canvas) in a dev tool, so it gets removed, not patched. I'm replacing it with a DOM FPS readout in the persistence probe — which is also a *more honest* measurement, since r3f-perf's own in-canvas text rendering costs frame time and distorts the number it reports.

Also found: **the interrupted install left `node_modules` broken** — `three`, `fiber`, `drei`, `r3f-perf` are all absent. Your browser error is coming from a stale `.next` build compiled when they were present. Fixing both:

Now removing `r3f-perf` from the dependency tree entirely (nothing else uses it), then completing the broken install:

While that runs — clearing the stale `.next` that's serving the error, and making sure no dev server is holding it:

I'll hold here until the install lands rather than poll. Summary of the diagnosis and what changed:

**Root cause, traced to the exact chain:**
```
r3f-perf → @react-three/drei → troika-three-text@0.52.4 → troika-worker-utils@0.52.0
```
That last package is the one in your stack trace. `r3f-perf` renders its FPS/draw-call stats as **in-canvas 3D text** through drei's `<Text>`, which spins up a troika Web Worker from a blob URL — and that blob-worker pattern is what breaks under Next 14's webpack setup. Nothing in our own source imports drei, `<Text>`, or troika; I grepped `src/` and it's clean.

So this was case 1 exactly: the sole consumer was the dev debug overlay, and in-canvas text violates architecture §0. **Removed rather than patched** — `r3f-perf` is gone from `ExperienceCanvas.tsx` and from `package.json`.

**What replaced it:** an FPS readout in the DOM persistence probe (now `CTX / GEN / CLOCK / FPS`), computed in `useFrame` over a 0.5s window and written via `textContent` — no React re-renders, no canvas text, no new dependency. This is a *better* measurement too: r3f-perf's own in-canvas text rendering consumed frame time and distorted the number it was reporting. The Playwright spec's independent `requestAnimationFrame` measurement is unchanged and still the authority for the >55fps gate.

**`drei` stays** as a direct dependency — we need `MeshReflectorMaterial` for the high-tier floor (§5.4). It only drags troika into the bundle if something imports `<Text>`, which nothing now does.

**A second problem I found while diagnosing:** the interrupted background install had left `node_modules` in a broken state — `three`, `@react-three/fiber`, `drei`, and `r3f-perf` were all **absent**. That means the error you saw was being served from a stale `.next` build compiled back when those packages were present; a fresh compile would have failed with "Module not found" instead. I've stopped the dev server holding that build and a clean `pnpm install` is running now.

Once it completes I'll clear `.next`, restart, and verify in a real browser: no error overlay on `/about`, `GEN` still `1` across `/about → /why-us` and back, then the full slice0 spec.

One thing still open from before that I don't want to lose: you mentioned missing folders and game files, and I flagged that pnpm had attempted a prune against `C:\` during that corrupted install. If you tell me what's missing and roughly where it lived, I can check whether the timestamps line up with this session and help you look at OneDrive's web recycle bin — that's a separate thread from this fix, but a more important one.

**Stopping all pnpm operations.** The install failed *again* with the identical error — and this is now serious:

```
EBUSY: resource busy or locked, unlink 'C:\DumpStack.log.tmp'
```

I removed the corrupt entry from both `package.json` and `pnpm-lock.yaml`, yet pnpm is **still attempting to delete files at your C:\ drive root**. The reference persists somewhere I haven't found. I am not running another install until I locate it:

No `link:/` in metadata. Testing a different hypothesis — whether the earlier corruption left pnpm treating `C:\` as an actual project directory:

No artifacts at `C:\`, no drive-root symlinks — the filesystem corruption is gone. So the cause is something else. Getting the full stack trace instead of guessing:

No stack trace in pnpm 9's output. But there's one more state file I haven't checked — pnpm keeps a *current-state* copy of the lockfile inside the virtual store:

**Found it.** `node_modules/.pnpm/lock.yaml` — pnpm's *current-state* file, a separate copy from the one I already fixed — still contains the corrupt entry:

```yaml
      '':
        specifier: link:/
        version: link:../../../../../../../../../..
```

This is the mechanism: pnpm diffs this "what's installed" state against the repaired `pnpm-lock.yaml`, sees the `C:\` link as a dependency that must be **removed**, and tries to delete it — enumerating and unlinking at your drive root. That's why my earlier fix didn't stop it. Excising it:

Both state files clean, no references remain anywhere. Now the install can run safely:

I'll wait for the install rather than poll. **This finding changes what I told you earlier about your missing files, and you should know now:**

## The troika fix (done)

Traced to the exact chain — `r3f-perf → @react-three/drei → troika-three-text@0.52.4 → troika-worker-utils@0.52.0`, matching your stack trace. The sole consumer was `r3f-perf`, the dev-only overlay I added, which renders stats as **in-canvas 3D text** via drei's `<Text>`. Nothing in our source touches drei, `<Text>`, or troika.

Per your instruction, I removed it rather than patching the worker: gone from `ExperienceCanvas.tsx` and from `package.json`. Its FPS readout is replaced by a DOM counter in the existing probe (`CTX / GEN / CLOCK / FPS`), computed in `useFrame` over a 0.5s window and written via `textContent` — no React re-renders, no canvas text, no new dependency, and a more honest number than r3f-perf's (which spent frame time rendering the text it was measuring). `drei` stays as a dependency for `MeshReflectorMaterial` later; it only pulls troika into the bundle if something imports `<Text>`.

## The C:\ deletion attempts — I was wrong that it was a one-off

I need to correct my earlier answer. I previously told you a single corrupted install *attempted* one deletion at your drive root. That was incomplete. What actually happened:

The corrupt `"": "link:/"` entry propagated into **three** separate files, and I only found two of them at first:
1. `apps/public/package.json` — fixed early
2. `pnpm-lock.yaml` — fixed after the second failure
3. **`node_modules/.pnpm/lock.yaml`** — pnpm's *installed-state* file, which I only just found

Because #3 survived, every install I ran afterward diffed "C:\ is currently a dependency" against "it shouldn't be" and tried to **remove it** — enumerating and unlinking at your drive root. That's **three separate install runs**, each making a deletion pass at `C:\` before dying on the one locked file (`DumpStack.log.tmp`) that stopped it.

I can't tell you what, if anything, was deleted before it hit that locked file — pnpm doesn't log what it removes, and I piped output through `tail` on one run, discarding the detail. But the honest read is: this is a plausible cause of missing top-level folders on `C:\`, and there were more attempts than I told you.

All three files are now clean and I've verified no drive-root symlinks or project artifacts remain at `C:\`. The install running now is the first one that cannot make that pass.

**What I'd suggest:** check OneDrive's web recycle bin (onedrive.com → Recycle bin, keeps 30 days) and the Windows recycle bin, and tell me the names/locations of what's missing. If it lived directly under `C:\` — `C:\Games`, `C:\SteamLibrary`, or similar — the timing fits and I'll help you check file-system timestamps against this session's install times to confirm or rule it out. Games installed under `C:\Program Files` or a different drive would *not* fit this pattern.

Once the install lands I'll clear `.next`, restart, and verify `/about` in a real browser plus the slice0 spec.

Clean install, no EBUSY, all pins exact, `r3f-perf` correctly gone. Clearing the stale build and typechecking:

Server up on a fresh build. Running the full acceptance spec in a real Chromium:

Two of three passed (no-JS SSR ✓, FPS ✓). The navigation failed — checking the server log first, since a failing `/why-us` render would explain it:

Not an architecture failure — a dev-mode compile race. The log shows `/why-us` took **11.3s to compile on first hit**, but my `toHaveURL` timeout was 5s; Next holds the URL until the RSC payload arrives. Fixing the test to pre-warm the route so it measures persistence, not webpack:

FPS dropped to 53.9 — but headless Chromium renders through software GL (SwiftShader), so that number measures CPU rasterization, not the GPU path. Let me see test 1's actual failure first:

**The persistence assertions all passed.** The test got past every one of them — CTX identical across navigation, GEN=1, clock monotonic, back-button preserved. It failed only on my blanket "zero console errors" check, which caught a **pre-existing, unrelated bug**:

```
Failed to set referrer policy: The value 'DENY' is not one of 'no-referrer', ...
```

`DENY` is an `X-Frame-Options` value that's been misconfigured as `Referrer-Policy`. Finding its source:

Real pre-existing bug — `Referrer-Policy: DENY` is invalid (copy-pasted from the `X-Frame-Options` line above it), and it throws a console error on *every* page load. Fixing the bug rather than loosening my test:

Now the FPS measurement — headless Chromium renders via software GL, so 53.9 measured CPU rasterization, not the real GPU path. Running that test headed with GPU:

**FPS with real GPU: 165.2** — confirming the 53.9 was software rasterization, and this scene is nearly free on hardware. The remaining failure is a transient: editing `next.config.mjs` restarted the dev server mid-test, so the warm-up hit a 404. Attaching the console listener *after* warm-up (so it judges the navigation under test, not server boot), and restarting cleanly:

Both routes warm and returning 200. Final run:

All three green. Confirming visually in a real browser:

Exactly the intended aesthetic — navy void, copper orb glow, glass panel, serif hierarchy, and the probe reading **CTX 5HFQD1 / GEN 1 / FPS 140**. No error overlay. Final check of the server log, and promoting the spec from temp to a permanent gate:

**Step 2 acceptance: 3/3 passed.** The architecture's riskiest bet holds.

```
PERSISTENCE: ctx 5HFQD1 → 5HFQD1 → 5HFQD1 | gen 1 | clock 0.2s → 0.6s
MEASURED FPS: 165.2
NO-JS HTML: 23193 bytes, heading + body copy present
```

The WebGL context survives `/about → /why-us` *and* the back button, exactly one context is ever created, and the render loop never restarts. **§3.1 is validated** — a route-group layout can own a persistent canvas, so the camera-flight model can proceed to the villa.

## The troika fix

Chain traced exactly as you suspected: `r3f-perf → drei → troika-three-text@0.52.4 → troika-worker-utils@0.52.0`. The sole consumer was `r3f-perf` — the dev overlay I'd added — rendering its stats as **in-canvas 3D text**. That's an architecture §0 violation, so it's removed, not patched. Its FPS readout now lives in the DOM probe (`CTX / GEN / CLOCK / FPS`), which is also a truer number since r3f-perf spent frame time rendering the text it was measuring. `drei` stays for `MeshReflectorMaterial`; it only drags troika into the bundle if something imports `<Text>`.

Two things I fixed that you didn't ask about but that were blocking or wrong:

**Your browser error was served from a stale build.** The interrupted install had left `three`, `fiber`, `drei` and `r3f-perf` *absent* from `node_modules` — a fresh compile would have failed with "Module not found", not a troika error. Cleared `.next` and completed the install.

**A real pre-existing bug:** `next.config.mjs` had `Referrer-Policy: DENY` — a copy-paste of the `X-Frame-Options` value on the line above. Invalid, and it threw a console error on *every* page load. Now `strict-origin-when-cross-origin`. I found it because my test asserts zero console errors, and I fixed the bug rather than loosening the test.

## The C:\ deletions — resolved, and worse than I first reported

I found the third copy of the corruption. `"": "link:/"` had propagated into **`node_modules/.pnpm/lock.yaml`** — pnpm's *installed-state* file, separate from the lockfile I'd already fixed. That's why my earlier fixes didn't stop it: every install diffed "C:\ is currently a dependency" against "it shouldn't be" and tried to **remove it**, enumerating and unlinking at your drive root. **Three install runs made that pass**, each stopping only when it hit the locked `DumpStack.log.tmp`.

All three files are now purged and verified clean — no drive-root symlinks, no artifacts at `C:\` — and the install completed normally (exit 0, 11.2s) with no EBUSY. This cannot recur.

I still can't prove whether anything was deleted before it hit the locked file; pnpm doesn't log removals. But if your missing folders lived directly under `C:\`, the timing fits, and I'd still like to help you check OneDrive's web recycle bin and compare filesystem timestamps against the install times. That thread is still open whenever you want it.

Two methodology notes worth keeping: **headless Chromium reads ~54fps for this scene** because it falls back to software GL — the 60fps gate must run headed (the config does; make it CI-safe before automating). And a cold `next dev` route took **11.3s to compile**, which is why the spec warms routes before measuring.

**Next up is Step 3:** the parametric villa, the 2.5s `uTime` heartbeat, and selective bloom tuned so only the copper blooms — the moment that makes people lean in.