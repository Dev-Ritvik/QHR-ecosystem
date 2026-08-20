# ACT III: THE SANCTUARY (50% - 75% SCROLL)
**Objective:** Breach the glass threshold, transition the optical/acoustic environment, and introduce the spatial Syndicate UI.

## 1. The Threshold State Machine
*   **Master Variable:** The physical signed distance between the camera and the glass plane dictates the state, not the raw scroll percentage[cite: 8].
*   **Phases:** Approach (distance > +0.8), Threshold (+0.8 to 0.0), Breach (0.0 to -0.8), Interior (-0.8 to -6), Settle (< -6)[cite: 8].
*   **Camera Kinematics:** A cubic Bezier path with a slight lateral (X-axis) drift to create interior parallax[cite: 8]. The FOV aggressively compresses from 44° to 37° to create intimate architectural scale[cite: 8]. Centripetal roll dies to 0° exactly at the threshold[cite: 8].

## 2. Photometric Adaptation & Glass Logic
*   **Exposure Lag:** The exterior EV is -0.7[cite: 8]. The target interior EV is +0.35[cite: 8]. The actual `toneMappingExposure` lags behind the target with a $\tau \approx 0.9–1.2$ second delay to simulate the eye hunting for light[cite: 8].
*   **Hierarchical Lighting:** We use 3-5 clustered 2700K point lights (not a global orange filter) to create warm pools of light on the walnut and marble[cite: 8]. 
*   **The Glass Shutter:** We do not hack the camera's `near` plane[cite: 8]. The glass utilizes a custom shader: as distance approaches zero, opacity drops to zero, aided by a 120-180ms post-processing optical "veil" (subtle bloom/luminance spike) to mask the geometric penetration[cite: 8].

## 3. The Syndicate UI Integration
*   **Spatial Reticles:** Interactive nodes are embedded directly into the interior geometry (e.g., wood panels, marble floors) using Drei's `<Html transform distanceFactor={7}>`[cite: 8]. 
*   **Minimalism:** The UI is purely typographic (e.g., `01 / SYNDICATE // MASTER OF BESPOKE MILLWORK`), occupying less than 8% of the viewport[cite: 8]. 
*   **Interaction:** Clicking a spatial node triggers the Zustand store, passing the specific partner's data to the Z-Index 999 Command Overlay (which pauses the WebGL timeline when opened)[cite: 8].

## 4. Acoustic Routing (The Vacuum)
*   **Exterior Attenuation:** The water and wind are not muted; they are exponentially low-passed (down to ~220Hz) to simulate acoustic isolation[cite: 8].
*   **The Vacuum:** At the exact moment of the breach, both exterior and interior gains are temporarily dipped to create an acoustic negative space[cite: 8].
*   **Interior Reverb:** A stereo `ConvolverNode` introduces a dense, treated room impulse response (RT60 $\approx$ 0.8–1.2s) with an 18-28ms `DelayNode` pre-delay to separate the dry signal from the room reflections[cite: 8].
*   **Sub-Bass Shift:** The 34Hz exterior drone shifts to a 42Hz interior resonance, maintaining the psychological tension but changing the acoustic enclosure[cite: 8].