# PHASE 6: THE Z-AXIS COMMAND OVERLAY
**Objective:** Deploy 15+ corporate utility pages using Next.js Parallel Routes, ensuring zero GPU drain and absolute bundle segregation from the 3D timeline.

## 1. Next.js App Router Topology
*   **Intercepting Routes:** Utility pages (e.g., `app/(experience)/careers/page.tsx`) have a mirror intercepted route inside the parallel slot: `app/(experience)/@modal/(.)careers/page.tsx`[cite: 17]. 
*   **Default State:** `app/(experience)/@modal/default.tsx` returns `null` so the overlay is hidden by default[cite: 17].
*   **URL Authority:** Navigation is driven purely by the URL (via `router.push()`)[cite: 17]. The HUD content swaps dynamically while the root layout (and the WebGL Canvas) remains perfectly intact[cite: 17].

## 2. The Deterministic Freeze Lifecycle
*   **State Machine:** The transition is strictly sequenced: Request Open -> Capture Frame -> Stop Ticker -> Freeze WebGL -> Animate HUD[cite: 17].
*   **The Snapshot Compositor:** We capture a single static frame of the 3D scene and pass it to the DOM[cite: 17]. The WebGL canvas `<Canvas frameloop="demand">` stops receiving `invalidate()` calls[cite: 17].
*   **CSS Treatment:** The captured frame is applied as a CSS background to the HUD layer, scaled up (`transform: scale(1.035)`), blurred (`backdrop-filter: blur(18px)`), and darkened (`rgba(0,0,0,0.42)`)[cite: 17]. 

## 3. The Monolithic HUD Grid
*   **Spatial Shell:** The overlay is a full-screen CSS Grid (e.g., `grid-template-columns: minmax(240px, 0.28fr) minmax(0, 1fr)`)[cite: 17].
*   **Persistent Rail:** The left navigation directory remains permanently mounted while inside the HUD[cite: 17]. Clicking from "Careers" to "Contact" only re-renders the right-hand content pane[cite: 17].
*   **Acoustic Ducking:** Opening the HUD exponentially ramps the 42Hz Zimmer sub-bass drone down to near-silence over 50ms[cite: 17]. The world stops; the dossier remains.

## 4. Payload Splitting & Bundle Quarantine
*   **Server Components:** All 15 utility pages are fetched and rendered server-side[cite: 17]. They contain zero R3F/GSAP/Zustand imports to prevent bloating the client bundle[cite: 17].
*   **Lazy Loading:** Heavy media uses `next/image` with `loading="lazy"`[cite: 17]. Complex interactive islands (e.g., Investment Calculators) are quarantined using `next/dynamic({ ssr: false })`[cite: 17].