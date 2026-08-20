
# ACT I: THE DROP (0% - 25% SCROLL)
**Objective:** Transition from absolute void to architectural recognition.

## 1. The Perceptual Timeline & State
*   **The Descent Arc:** 0–4% (Void), 4–10% (Drop), 10–18% (Scale Reveal), 18–25% (Final Recognition)[cite: 2].
*   **The Ticker Core:** GSAP drives Lenis, triggering `R3F.invalidate()` on a `frameloop="demand"`[cite: 2].
*   **Performance Budget:** Sub-100 draw calls, capped DPR, and a maximum of 4 dynamic lights[cite: 2].

## 2. Spatial Physics & Kinematics
*   **Camera Translation:** A compound descent utilizing a Y-axis drop, Z-axis penetration, and a subtle $4.5$-unit lateral X-drift[cite: 2].
*   **FOV Warp:** Expanding from $28^\circ$ to $49^\circ$ before settling at $41^\circ$ to create optical volume[cite: 2].
*   **Physical Mass:** A clamped $0.18^\circ$ micro-roll during the dive[cite: 2], utilizing a $1.8$-unit downward arrest to establish heavy kinetic weight[cite: 2].

## 3. Optical Pipeline & Exposure
*   **Adaptation:** A calculated exposure shift from $-2.4\text{ EV}$ to $-0.7\text{ EV}$ as the camera drops[cite: 2].
*   **Lighting Falloff:** A single directional light ($1.2$ intensity)[cite: 2] modeling inverse-square physical attenuation $E = \frac{I}{4 \pi d^2}$[cite: 2].
*   **Post-Processing:** ACES Filmic Tone Mapping, a clamped Bloom threshold ($0.92$), subtle Vignette, Chromatic Aberration ($<0.001$ offset), and monochromatic grain[cite: 2].

## 4. The Acoustic Engine
*   **Ignition:** A stark `[ ENTER ]` UI gesture on pure black to initialize the `AudioContext`[cite: 2].
*   **Frequency Modulation:** A 32–38Hz sub-bass layer[cite: 2] decaying smoothly via $f(t) = f_0 \cdot e^{-\lambda t}$[cite: 2], coupled with velocity-derived audio gain[cite: 2].
*   **Tactile Impact:** A 35–60ms low-frequency impulse at $u \approx 0.72$[cite: 2] tied to a micro-drop in visual exposure[cite: 2].