# ACT II: THE ARCHITECTURAL REVEAL (25% - 50% SCROLL)
**Objective:** Transition from vertical drop to a heavy horizontal orbit, utilizing foreground occlusion to reveal the water elements.

## 1. Kinematics: The Minimum-Jerk Orbit
*   **Timeline Authority:** GSAP does not tween camera coordinates. GSAP controls a normalized timeline variable `q` (0 to 1). A `CameraController` calculates positions per-frame based on `q`[cite: 5].
*   **Trajectory:** The camera performs a 60° sweep (0° to -62°) around the *visual center of gravity* of the pool, not the geometric center of the estate[cite: 5]. The movement follows a minimum-jerk trajectory for smooth acceleration/deceleration at the endpoints[cite: 5].
*   **Parallax Window:** The Y-axis (height) performs a broad asymmetric lift (e.g., 17 → 19 → 18) to allow the viewer to momentarily look *over* the foreground elements[cite: 5].
*   **Centripetal Bank:** The Z-axis roll is mathematically derived from the instantaneous angular velocity of the orbit[cite: 3, 5]. It is critically damped to lag slightly behind the motion[cite: 5], peaking at a maximum clamped angle of **2.4°**[cite: 5].

## 2. Geometry: Static CSG & High-Performance Fluids
*   **Sunken Lounge (CSG):** The `@react-three/csg` booleans (Base and Subtraction) are computed exactly once at build/mount[cite: 3, 5]. The result is cached as a static `BufferGeometry`[cite: 5]. No per-frame CSG recalculations[cite: 3, 5].
*   **Infinity Pool Mesh:** A single `PlaneGeometry` (128x64 segments)[cite: 5].
*   **Fluid Shader (Fragment & Vertex):** 
    *   3 low-amplitude Gerstner waves to create surface tension, not ocean waves[cite: 5].
    *   Normals are reconstructed via cross products of the displaced vertices[cite: 5].
    *   Reflections utilize Schlick Fresnel mixing with the procedural sky/environment[cite: 5].
    *   Caustics are faked using an animated, multi-scale Voronoi/cellular noise projected onto the surface[cite: 3, 5].

## 3. Spatial Typography & Hysteresis Occlusion
*   **Implementation:** Architectural data is embedded using Drei's `<Html transform>`[cite: 3, 5].
*   **Targeted Raycasting:** To protect the 60fps budget, occlusion raycasting is strictly limited to an explicit array of foreground limestone pillar refs (`occlude={[pillarsRef]}`)[cite: 3, 5]. It does not check the entire scene graph[cite: 3, 5].
*   **Hysteresis Layer:** A 100ms delay state is placed between the geometry intersection and the DOM opacity change[cite: 5]. This prevents rapid flickering when the camera grazes the exact edge of a pillar[cite: 5].

## 4. Acoustic Environment: Stochastic Fluid Noise
*   **Generator:** We avoid looping `.mp3` files[cite: 5]. The water sound is built from a dual-layer stochastic Web Audio graph: a low-passed Brown noise (water mass) and a band-passed Pink noise (edge fizz)[cite: 5].
*   **Non-Periodic Modulation:** Gain and filter cutoffs are modulated using three irrational-frequency LFOs (e.g., 0.17Hz, 0.29Hz, 0.43Hz) to prevent recognizable looping patterns[cite: 5].
*   **Spatialization:** Audio is routed through a `PannerNode` calculating the world-space distance from the camera to the nearest pool edge, shifting the acoustic field dynamically as the camera orbits[cite: 5].
*   **Drone Integration:** The Act I sub-bass drone is not stopped; its gain is smoothly ducked (attenuated) as the water presence increases[cite: 3, 5].