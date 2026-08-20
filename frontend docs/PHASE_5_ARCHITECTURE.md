# PHASE 5: THE SYNDICATE HUB & ZERO-TRUST VAULT
**Objective:** Establish persistent 3D spatial routing and a tamper-evident, server-authoritative lead generation backend.

## 1. Next.js Routing Architecture (Canvas Persistence)
*   **The Shell Layout:** The R3F `<Canvas>` is mounted exactly once inside `app/(experience)/layout.tsx`[cite: 14]. It acts as a persistent sibling to the Next.js `{children}`[cite: 14].
*   **Dynamic Routes:** `/syndicate/[slug]/page.tsx` is a Server Component[cite: 14]. It never renders 3D content directly; it only renders DOM overlays[cite: 14].
*   **Hydration Safety:** A zero-output Client Bridge (`return null`) receives the validated server data and writes the spatial target coordinates to Zustand[cite: 14].

## 2. Spatial Camera Hijacking
*   **Zustand Intent:** The global store holds `target: { position, lookAt }`[cite: 14]. It does not hold the Three.js camera object[cite: 14].
*   **Anchor Registry:** A hardcoded dictionary within the 3D application maps string keys (e.g., `home-theater`) to physical vectors[cite: 14]. 
*   **Delta-Aware Interpolation:** The camera physically glides to the target using frame-rate-independent exponential smoothing inside `useFrame`, keeping the motion fluid and anchored to the unified ticker[cite: 14].

## 3. The Zero-Trust Schema (Supabase PostgreSQL)
*   **Public vs. Private:** `syndicate_partners` is publicly readable via RLS[cite: 14]. `leads_vault`, `lead_dispatches`, and `audit_receipts` are strictly private; the browser has ZERO `SELECT`, `UPDATE`, or `DELETE` privileges[cite: 14].
*   **Server Authority:** The client initiates a request with a slug and an idempotency key (`client_intent_id`)[cite: 14]. The Edge Function performs a server-side lookup to resolve the actual `partner_id`[cite: 14].
*   **Append-Only Ledger:** The `audit_receipts` table utilizes a lightweight hash chain (hashing the previous receipt's hash)[cite: 14]. This provides tamper-evidence: history cannot be altered without breaking the cryptographic chain[cite: 14].

## 4. Dual Dispatch & Execution Order
*   **Commit First:** The Edge Function (`initiate-communique`) writes the lead and audit rows to PostgreSQL and commits the transaction immediately to establish the authoritative source of truth[cite: 14].
*   **Asynchronous Webhook:** A Supabase Database Webhook fires post-commit, triggering a secondary dispatch sequence[cite: 14].
*   **The Handoff:** The dispatch sequence simultaneously fires the canonical payload to the Partner's WhatsApp API and sends the immutable audit receipt (containing the SHA-256 hash) to the Platform Owner[cite: 14].