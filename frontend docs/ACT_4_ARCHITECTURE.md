# ACT IV: THE STANDOFF (75% - 100% SCROLL)
**Objective:** Force the psychological transition from passive observation to active acquisition through optical compression and acoustic silence.

## 1. Kinematics: The Final Aperture Push
*   **The Pause:** From 75%-82% scroll, the camera velocity is zero[cite: 11]. The user sits in the Sanctuary.
*   **The Dolly Push:** From 82%-94%, the camera follows a cubic Bezier trajectory toward a final architectural focal point (e.g., a narrow aperture framing the exterior)[cite: 11]. 
*   **Constant FOV:** The FOV remains static (or barely tightens from 38° to 37°)[cite: 9, 11]. This must feel like a physical body moving through space, not a digital zoom. The easing curve accelerates late and does *not* ease-out at the end; it is interrupted by the 100% threshold[cite: 9].

## 2. The Optical Collapse (UI Handoff)
*   **Radial Compression Shader:** Between 96% and 100% scroll, the 3D world does not fade. A custom post-processing shader radially compresses the luminance, crushing the edges of the screen into darkness[cite: 11].
*   **The 100% State:** At 100% scroll, only 5-8% of the final architectural focal point remains visible[cite: 11]. This blurred, dark remnant serves as the physical `background-image` for the Z-Index 999 Command Overlay[cite: 9].

## 3. The Acoustic Vacuum Snap
*   **The Pressure Build:** The interior sub-bass drone pitches downward (42Hz $\rightarrow$ 34Hz) while slightly increasing in amplitude to simulate crushing physical mass[cite: 11].
*   **The Severance:** At 98.5% scroll, the master drone gain is exponentially ramped to 0 over 120-180ms[cite: 11]. 
*   **The Silence:** The resulting 250ms of absolute dead silence creates an "attention vacuum" right before the UI becomes interactive, forcing focus onto the transaction[cite: 11].

## 4. The WebGL Suspension Protocol (Tier 1)
*   **GPU Freeze:** When the Command Overlay opens at 100% scroll, the unified ticker updates `<Canvas frameloop="never">`[cite: 9, 11]. 
*   **Retention:** We do *not* call `renderer.dispose()`[cite: 9, 11]. The canvas remains mounted but idle (`opacity: 0`, `pointer-events: none`)[cite: 9]. This drops GPU draw calls to zero, saving battery, but allows instant, stutter-free reactivation if the user closes the dossier and scrolls back up into Act III[cite: 9].

## 5. The Acquisition Dossier
*   **Typography & Tone:** The DOM overlay inherits the exact typography and spatial alignment of the 3D world[cite: 11]. No standard SaaS forms.
*   **Attribution:** The form submits the `syndicateSlug` and session data directly to the Next.js Server Action / Supabase API, bypassing any client-side trust assumptions for the final commission attribution[cite: 11].