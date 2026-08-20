# PHASE 7: THE EPILOGUE (COMPLIANCE & ERRORS)
**Objective:** Integrate mandatory legal, compliance, and error-handling layers without breaking the ₹50 Lakh luxury aesthetic or the WebGL performance budget.

## 1. The Legal Perimeter (Anti-Footer)
*   **Primary Access:** All legal pages (Privacy, Terms, Cookies) are routed through the identical Phase 6 Command Overlay (`app/@modal/privacy/page.tsx`)[cite: 20].
*   **The Micro-Rail:** A permanent `fixed` element sits at `bottom: 2rem` with 9px, highly-tracked typography[cite: 15]. It uses `mix-blend-mode: difference` to ensure legibility across all cinematic lighting states without requiring custom colors[cite: 15]. 
*   **Climax Muting:** During the Act IV standoff (90%-100% scroll), the opacity of this legal rail mathematically fades to 0 to eliminate all distractions[cite: 15].

## 2. Terminal Consent (Cookie Clearance)
*   **The Intercept:** The cookie prompt appears *before* the Act I ignition sequence[cite: 15, 20].
*   **UI/UX:** Styled as a minimal security terminal[cite: 15, 20]. `[ AUTHORIZE ]` and `[ ESSENTIAL ONLY ]` are given exactly equal visual weight to comply with strict DPDP/GDPR guidelines[cite: 15].
*   **Execution:** No non-essential scripts (e.g., analytics) load until the Zustand consent state is resolved to `granted`[cite: 15].

## 3. The 404 Easter Egg (Brutalist Fallback)
*   **Architecture:** `not-found.tsx` is a pure DOM layer[cite: 20]. A global Zustand override (`isErrorState: true`) completely prevents the `<Canvas>` from mounting or requesting GPU context[cite: 15, 20].
*   **The Visual:** Pitch black screen. Raw monospace typography: `SIGNAL LOST. 404. RETURN TO APEX.`[cite: 20]. 
*   **The Fake 3D Effect:** A single red CSS `radial-gradient` acts as a mock cinematic light source, costing zero render budget while maintaining the project's visual identity[cite: 20].