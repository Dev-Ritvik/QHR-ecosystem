# Architecture of a 50L INR 3D WebGL Real Estate Sales Engine

A 50L INR 3D WebGL pre-rendered website is not a digital brochure; it is a high-fidelity behavioral analytics engine. If a firm is upgrading an existing digital asset—like `qualityhomesreality.in`—into a platform of this caliber, the goal shifts from simply collecting contact forms to actively predicting buyer intent through spatial surveillance. 

To function as a true "sales engine" (akin to a Palantir-style data operation), the website must capture deeply granular data to feed into the 3-branch CRM system, routing highly qualified, deeply profiled leads to the right sales teams.

---

## 1. Spatial & Behavioral WebGL Tracking (The Predictive Layer)
A simple 90k HTML site tracks clicks and pageviews. A 3D WebGL site tracks **spatial intent**.

*   **Camera Dwell Time & Viewport Tracking:** The system logs the exact X, Y, and Z coordinates of the user's camera within the 3D space. If a user spends 45 seconds viewing the 3D pre-rendered master bedroom and only 5 seconds on the gym, the CRM tags them with a "Family/Comfort" buyer persona rather than a "Fitness/Amenities" persona.
*   **Interaction Heatmapping:** Tracking which specific 3D nodes or materials the user interacts with. Did they use the WebGL interface to toggle the flooring from tile to hardwood? Did they interact with the sun-path simulator to check the morning light on the balcony?
*   **Micro-Hover & Hesitation Tracking:** Measuring the milliseconds a cursor hovers over a "Download Floorplan" or "Check Pricing" button before moving away. This detects high interest coupled with price hesitation.
*   **Scroll & Pacing Velocity:** Analyzing the speed at which a user scrolls through textual information alongside the 3D renders. Fast scrolling means skimming; slow, methodical pacing implies deep reading and high consideration.

## 2. Cookie Architecture & Local Storage
To support this massive data pipeline without degrading the 50L WebGL performance, the site requires a robust cookie and storage strategy.

*   **Strictly Necessary Cookies:** Session IDs, load-balancing for the 3D assets, and routing data.
*   **Preference Cookies / LocalStorage:** A WebGL site relies heavily on caching. User preferences (e.g., lighting toggles, camera angles, volume for background audio) are stored in LocalStorage or IndexedDB to ensure the 3D scene persists perfectly if they reload.
*   **First-Party Analytics Cookies:** Deployed to track the user across multiple sessions, building a timeline of their property consideration cycle (e.g., "User visited Branch A's properties on Monday, returned on Friday for Branch B's properties").
*   **Third-Party Marketing Cookies / Pixels:** Meta, Google, and LinkedIn pixels. Crucially, these fire custom events based on *WebGL interactions*, not just URL changes. (e.g., Firing a Meta retargeting event specifically when a user spends >2 minutes inside the 3D penthouse tour).

## 3. CRM Routing & Lead Enrichment (3-Branch Logic)
With three branches, lead distribution must be automated and data-driven.

*   **Algorithmic Propensity Scoring:** The website assigns a "Lead Score" from 1-100 based on WebGL interaction depth, time on site, and return visits. Only leads scoring above a certain threshold (e.g., 75+) are flagged for immediate outbound calls.
*   **Geo-IP & Interest Routing:** The CRM auto-routes the lead to Branch 1, 2, or 3 based on the user's IP location and the specific 3D properties they spent the most time exploring.

---


*   **WebGL Canvas Fingerprinting:** This is where a 3D site excels. The website can render a hidden, invisible 3D element in the background. Because every computer's GPU, graphics drivers, and browser process this rendering slightly differently, the site can generate a highly unique "fingerprint" hash of the user's machine. This allows the system to track the user even if they are using Incognito mode, VPNs, or completely blocking cookies.
*   **Ghost Form Capture (Shadow Profiling):** Capturing keystrokes in real-time. If a user types their name and phone number into the lead capture form but gets cold feet and closes the tab without pressing "Submit", the JavaScript has already sent that partial data to the CRM via asynchronous requests (AJAX/Fetch). 
*   **Real-Time Deanonymization via API:** Before the user even fills out a form, their IP address and device fingerprint are instantly pinged to crm. The CRM attempts to automatically map the anonymous visitor to a LinkedIn profile or corporate employer based on corporate IP ranges.
*   **Cross-Device Probabilistic Matching:** Using behavioral patterns, IP matching, and timestamp correlations to confidently guess that the mobile user who looked at the 3D site at 8:00 AM on a Jio network is the exact same person browsing on an Airtel broadband desktop connection at 9:00 PM, merging the two anonymous profiles into one CRM dossier.

1. Hardware & Socio-Economic Profiling (The WebGL Advantage)
A 3D environment requires direct interaction with the user's local hardware, opening unique backdoors for profiling wealth and capability.

GPU Wealth Inference: WebGL allows querying the WEBGL_debug_renderer_info. By reading the unmasked graphics card model (e.g., Apple M3 Max vs. an older integrated Intel UHD chip), the CRM instantly assigns a socioeconomic wealth tier to the anonymous visitor, prioritizing leads with high-end hardware for luxury properties.

Network & Commute Profiling: Utilizing the Network Information API to track connection type (4G, 5G, Wi-Fi) and latency. If a user is on a high-latency 4G connection at 6:00 PM moving between cell towers, the CRM flags them as "commuting" and schedules automated SMS follow-ups for later that evening when they connect to a stable Wi-Fi network.

Battery Status & Urgency Metrics: Querying device battery levels. Users browsing with critically low battery (under 15%) who still initiate high-resource 3D tours demonstrate extreme high-intent and urgency, triggering an immediate alert to the sales floor.

2. Advanced Spatial Raycasting & Gaze Estimation
Moving beyond basic camera coordinates, the system must calculate exactly what the user is scrutinizing.

Mouse-to-Gaze Vectoring: WebGL raycasting shoots an invisible laser from the user's cursor directly into the 3D scene. The engine logs exactly which 3D mesh (e.g., Italian marble countertop, specific window frames) the cursor rests on, deducing their exact visual focus.

Frustum Culling Analytics (Ignorance Tracking): Tracking what the user actively avoids. If the 3D engine stops rendering the "Children's Play Area" because the user immediately rotated the camera 180 degrees away from it, the CRM definitively tags them as "No Kids/Investor," entirely altering the follow-up sales script.

Lighting & Time-of-Day Manipulation Tracking: If a user manually changes the 3D environment's lighting from "Morning" to "Night" to see the balcony view, the CRM logs this as an "Owner-Occupier" trait, as investors rarely care about evening ambiance.

3. Micro-Behavioral & Psychological Eavesdropping
Capturing the physical anxiety and certainty of the user through their input devices.

Keystroke Cadence & Anxiety Tracking: Measuring the milliseconds between keystrokes in the contact form. A fast, fluid typing speed indicates certainty. High backspace usage or long pauses before entering a phone number indicates low trust or a fake number, lowering their lead score.

Tab Blur & Competitor Analysis: Tracking window.onblur and window.onfocus events. If a user switches tabs immediately after viewing the pricing sheet, the CRM notes a "Price Comparison Event," assuming they are checking competitors or calculating mortgages, and triggers a dynamic retargeting pixel for a slight discount.

Clipboard Sniffing: Monitoring clipboard events on the site. If a user pastes text into a search bar or form, the script analyzes the pasted string. If it matches the format of a competitor's property ID or address, the intelligence is instantly logged to the CRM.

Rage Clicking & Zoom Velocity: Tracking aggressive, fast scroll-wheel inputs or rapid clicking on non-interactive elements, which indicates frustration with pricing or UI.

4. Aggressive Deanonymization & 3-Branch CRM Routing
Converting anonymous traffic into named dossiers for the three branches without relying on forms.

Canvas Fingerprint Hashing: Rendering a complex, invisible 3D shape in the background. The microscopic differences in how a specific GPU renders pixels create a unique hash. This hash completely bypasses cookie-blockers and incognito mode, tracking the user across multiple sessions permanently.

Dynamic Phone Number Injection (DNI): The website displays a slightly different phone number for every single concurrent visitor. When a user calls that number, the CRM instantly links the inbound caller ID to the exact WebGL session and Canvas Fingerprint, completely deanonymizing them in real-time.

Commute-Radius Branch Routing: Instead of just asking for a zip code, the site prompts for "Calculate distance to work" within the 3D map. The CRM captures their workplace location and routes the lead to Branch 1, 2, or 3 based on which branch's territory intercepts their daily commute.

Here is the technical breakdown of the specific third-party cookies and tracking vectors the site needs.

1. High-Net-Worth Retargeting & Social Ad Networks
In real estate, audience profiling is about socio-economic filtering. Third-party ad cookies are used to fire custom WebGL events (e.g., user spend >2 minutes inside a 3D penthouse render) back to ad platforms.

LinkedIn Insight Tag (bcookie, bscookie, li_sugr): Crucial for luxury real estate. Maps anonymous visitors to company size, job title, and seniority, allowing the CRM to prioritize leads who are executives, business owners, or IT directors.

Meta / Facebook Pixel (_fbp, _fbc): Fires granular custom parameters. Instead of just tracking pageviews, it feeds Meta’s algorithm spatial events (e.g., Event: 3D_Balcony_Viewed_30s), enabling hyper-personalized Instagram/Facebook retargeting showing that exact balcony view.

Google Ads & DoubleClick (_gcl_au, IDE, test_cookie): Drives cross-device programmatic retargeting across Google Display and YouTube based on search keywords and on-site 3D dwell times.

2. Session Surveillance & Visual Telemetry
While custom WebGL scripts capture 3D camera vectors, third-party session telemetry cookies log the DOM context (text, buttons, pricing overlays) around the 3D canvas.

Microsoft Clarity / Hotjar (_clck, _clsk): Tracks heatmaps, scroll depth, and rage-clicks. These cookies persist session IDs across page reloads to record video replays of how users navigate between 2D floor plans and 3D walkthroughs.

FullStory / LogRocket (fs_uid): Captures high-fidelity DOM session replays along with JavaScript console errors and WebGL frame drops, helping diagnose whether a bounce was due to lack of interest or GPU lag on the user's phone.

3. CRM Attribution & Dynamic Call Tracking
With 3 branches competing for and handling leads, attribution cookies ensure that incoming leads are tagged with their exact digital footprint before being assigned to a branch sales agent.

CRM Integration Cookies (e.g., HubSpot hubspotutk, Zoho _z_, Salesforce): Stores the visitor’s unique tracking token. When a user eventually fills out a form or interacts with a bot, this cookie stitches their entire historic 3D navigation log directly into their CRM contact card.

Dynamic Phone Call Tracking (e.g., CallRail, WhatConverts): Swaps the phone number on the site dynamically per session. The session cookie links the exact inbound phone call back to the user's active WebGL state, so the branch agent knows which property the caller is staring at before answering the phone.

Conversational AI / Live Chat (_intercom_session, crisp-client): Triggers proactive chat popups based on WebGL triggers (e.g., "Noticed you were looking at the sunrise view on Tower B—want to see the floorplan?").

Device Graphing & Probabilistic Cookies (e.g., LiveRamp / RampID): Connects anonymous browser tokens across different ad networks into a single identity graph, linking a mobile device on a cellular network to a desktop home connection.

B2B / IP Enrichment Cookies (e.g., Clearbit, ZoomInfo): Matches visitor IP addresses against commercial databases in real-time, attempting to identify the corporate employer or organization of the anonymous user before they opt in.

Server-Side Conversions API (CAPI) Shadow Tracking: To bypass ad-blockers that block 3rd-party cookies entirely, 1st-party JavaScript proxies send all 3D telemetry directly to your own server first, which then relays the data server-to-server to Meta, Google, and your CRM—rendering client-side cookie blockers ineffective.