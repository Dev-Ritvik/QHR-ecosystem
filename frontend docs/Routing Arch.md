# APEX ESTATE: SPATIAL ROUTING & ARCHITECTURE MAP
**Version:** 1.0.0
**Target Environment:** Next.js App Router + React Three Fiber
**Design Paradigm:** WebGL Cinematic Canvas vs. Z-Index Command Overlay

---

## 1. THE SPATIAL CORE (The WebGL Narrative Scroll)
*These are not traditional pages. These exist as physical waypoints along the Z-axis 3D camera timeline. The user scrolls through them seamlessly.*

*   **Act I: The Drop (Home)** - Introduces the brand, showcases featured projects, and directs visitors to key actions.[cite: 1]
*   **Act II: The Estate (Projects / Properties)** 
    *   Displays all residential and commercial projects with filtering options.[cite: 1]
    *   Lists individual plots, apartments, villas, and commercial units available for sale.[cite: 1]
*   **Act III: The Sanctuary (Project Details / Property Details)** 
    *   Provides complete information about a specific project, including gallery, amenities, pricing, and enquiry.[cite: 1]
    *   Shows specifications, location, pricing, floor plans, and downloadable brochure for a property.[cite: 1]
*   **Act IV: The Compass (Start Here)** - Helps visitors discover the right property based on their needs and budget.[cite: 1]

---

## 2. THE SYNDICATE HUB (Dynamic Routes)
*These are dedicated, individual Next.js Server Components. They retain the WebGL background but lock the camera to specific architectural elements to highlight the partners.*

*   **`/syndicate/[slug]`** - 14 dynamically generated dossiers for the bespoke craftsmen (e.g., Acoustics, Structural, Interiors, Automation).
*   **Encrypted Lead Vault** - The hidden API route and Supabase webhook that tracks undeniable attribution for the 14 partners.

---

## 3. THE COMMAND OVERLAY (The Z-Axis HUD)
*These pages live inside a sleek, glassmorphic UI drawer that slides over the blurred 3D canvas. Users access these via a persistent `[ DIRECTORY ]` button.*

### A. Intelligence & Advisory
*   **Investment Guide:** Educates buyers about real estate investing, financing, and legal processes.[cite: 1]
*   **Locations:** Highlights the areas where the company has projects and explains why each location is valuable.[cite: 1]
*   **Knowledge Center / Blog:** Publishes articles, market insights, buying tips, and company updates.[cite: 1]
*   **Downloads:** Provides brochures, master plans, price lists, and legal documents.[cite: 1]
*   **Gallery:** Displays project photos, videos, drone footage, and event highlights.[cite: 1]

### B. The Syndicate (Corporate Data)
*   **About Us:** Shares the company's story, vision, achievements, and leadership.[cite: 1]
*   **Why Choose Us:** Explains what differentiates the company from other developers.[cite: 1]
*   **Testimonials:** Features customer reviews, success stories, and client experiences.[cite: 1]
*   **Construction Updates:** Shares progress reports and milestone updates for ongoing projects.[cite: 1]
*   **Careers:** Advertises job openings and accepts employment applications.[cite: 1]

### C. Acquisition & Logistics
*   **Contact Us:** Offers enquiry forms, phone numbers, WhatsApp, email, and office locations.[cite: 1]
*   **Book a Site Visit:** Allows visitors to schedule a visit to a project directly online.[cite: 1]
*   **Branches:** Lists all three branch offices with maps, contact details, and local teams.[cite: 1]
*   **FAQs:** Answers common questions about projects, bookings, payments, and ownership.[cite: 1]
*   **Customer Login:** Redirects existing customers to the CRM/customer portal.[cite: 1]

---

## 4. THE EPILOGUE (Persistent Footer & Error Handling)
*Strictly utility. Kept out of the primary visual hierarchy to preserve the luxury aesthetic.*

*   **Sitemap:** Provides an index of all website pages.[cite: 1]
*   **Privacy Policy:** Explains how user data is collected and handled.[cite: 1]
*   **Terms & Conditions:** Defines the legal terms for using the website.[cite: 1]
*   **Cookie Policy:** Explains the website's use of cookies.[cite: 1]
*   **Refund & Cancellation Policy:** Describes refund and cancellation rules, if applicable.[cite: 1]
*   **404 Error Page:** Displays a helpful message when a page cannot be found.[cite: 1] (Customized as `SIGNAL LOST. RETURN TO APEX.`)