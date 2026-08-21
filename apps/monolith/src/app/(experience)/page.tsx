// apps/monolith/src/app/(experience)/page.tsx
//
// THE SCROLL TRACK — MASTER_SPEC §3.4, §5, L7.
//
// A Server Component. Every fact here is in the served HTML, which is what
// crawlers, no-JS readers and Tier D get (§10). The 3D layer annotates this
// content; it never replaces it.
//
// 1000vh desktop, four Acts at 250vh each. The length is not padding — it is
// half of the L7 ratio:
//
//     camera arc (1,772m) / 10 viewports = 177 m per viewport   (min 12)
//
// asserted by scripts/path-check.mjs. The failure that gate prevents already
// shipped once on apps/public: a track lengthened 6x while the camera path
// stayed the same length, and the camera was reported as completely dead while
// moving perfectly correctly.
//
// ─────────────────────────────────────────────────────────────────────────────
// THE SURFACE IS AN INSTRUMENT, NOT A PAGE
//
// This used to open on a 4.76rem display headline set flush left across half
// the viewport. At that size type stops annotating the frame and starts
// competing with it — and what it competed with was the only thing the visitor
// came to see. It also read as a template: a big sans headline over a hero is
// the single most generic arrangement on the web.
//
// Everything below is now one monospace face at small rungs, uppercase, tracked
// hard, aligned to a hairline column. Nothing is larger than it needs to be to
// be read. The rules are the composition; the type is the label.
//
// The FACTS are unchanged. Sanction numbers, plot dimensions and branch roles
// stay in the served HTML exactly as they were — the presentation is being
// rebuilt, not the content, and every one of these is a claim the client can be
// held to (§7 note on the Consumer Protection Act).

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'The Monolith at Dusk — Quality Homes Reality',
  description:
    'Approved plotted layouts, plantation farmland and villas across the '
    + 'Visakhapatnam–Vizianagaram–Srikakulam corridor. VMRDA, RERA and SUDA sanctioned.',
};

/**
 * One Act. 250vh of track with its panel pinned at a readable height.
 *
 * The panel is held LEFT and capped at 34vw so the camera keeps the right two
 * thirds as an unobstructed stage. Capping by grid span alone is not enough —
 * a span is a fraction of the CONTAINER, so on a wide monitor six of twelve
 * columns falls well short of a third of the viewport while on a narrow one it
 * overruns. The stage is measured in viewport width, so the panel has to be.
 */
function Act({
  index,
  eyebrow,
  title,
  body,
  meta,
}: {
  index: string;
  eyebrow: string;
  title: string;
  body: string;
  meta?: { label: string; value: string }[];
}) {
  return (
    <section className="mx-auto grid min-h-[250vh] max-w-7xl grid-cols-12 px-6 md:px-10">
      <div className="col-span-12 md:col-span-5 md:max-w-[34vw]">
        <div className="sticky top-[26vh] py-[8vh]">
          {/* Act marker. The index is the only ember on the surface. */}
          <p className="t-hud flex items-baseline gap-5 text-ash/60">
            <span className="text-ember">{index}</span>
            <span aria-hidden className="h-px w-8 bg-white/20" />
            <span>{eyebrow}</span>
          </p>

          <h2 className="t-h1 mt-9 max-w-[22ch] text-signal">{title}</h2>

          <p className="t-body mt-7 max-w-[46ch] text-ash/75">{body}</p>

          {meta ? (
            <dl className="rule mt-11 border-t pt-6">
              {meta.map((m) => (
                <div
                  key={m.label}
                  className="rule flex items-baseline justify-between gap-8 border-b py-3 last:border-b-0"
                >
                  <dt className="t-hud text-ash/60">{m.label}</dt>
                  <dd className="t-hud text-signal">{m.value}</dd>
                </div>
              ))}
            </dl>
          ) : null}
        </div>
      </div>
    </section>
  );
}

export default function NarrativePage() {
  return (
    <main className="pb-[10vh]">
      {/* ACT I — THE CORRIDOR. Opens on a detail, not a vista: the camera is
          28° and inches from a survey stone, so the first frame is abstract.
          Scale is withheld until q 0.10, and the surface withholds it too —
          there is no headline here to announce what is about to be revealed. */}
      <section className="mx-auto grid min-h-[250vh] max-w-7xl grid-cols-12 px-6 md:px-10">
        <div className="col-span-12 md:col-span-5 md:max-w-[34vw]">
          <div className="sticky top-[26vh] py-[8vh]">
            <p className="t-hud flex items-baseline gap-5 text-ash/60">
              <span className="text-ember">I</span>
              <span aria-hidden className="h-px w-8 bg-white/20" />
              <span>The corridor</span>
            </p>

            <h1 className="t-display mt-9 max-w-[18ch] text-signal">
              Land, in the districts we come from
            </h1>

            <p className="t-body mt-7 max-w-[46ch] text-ash/75">
              Approved layouts, plantation farmland and villas across the
              Visakhapatnam&ndash;Vizianagaram&ndash;Srikakulam corridor.
            </p>

            <dl className="rule mt-11 border-t pt-6">
              {[
                { label: 'In the field', value: '20 years' },
                { label: 'Branch offices', value: 'Three' },
                { label: 'Sanction numbers', value: 'Published in full' },
              ].map((m) => (
                <div
                  key={m.label}
                  className="rule flex items-baseline justify-between gap-8 border-b py-3 last:border-b-0"
                >
                  <dt className="t-hud text-ash/60">{m.label}</dt>
                  <dd className="t-hud text-signal">{m.value}</dd>
                </div>
              ))}
            </dl>

            <p className="t-hud mt-12 text-ash/45">[ Scroll to descend ]</p>
          </div>
        </div>
      </section>

      <Act
        index="II"
        eyebrow="The land"
        title="The plan, drawn on the ground it describes"
        body="Residential plots at 30×50, 30×56 and 30×60. Plantation parcels
              under avocado, mango, sapota and mahogany. The survey grid you see
              rising is the layout as sanctioned — not an artist's impression."
        meta={[
          { label: 'Kartikeya Water Front', value: 'VMRDA · RERA' },
          { label: 'VSR Gayatri Township', value: 'SUDA F.L.P. 10/2025' },
          { label: 'Lucky Garden', value: 'Garividi · plantation' },
        ]}
      />

      <Act
        index="III"
        eyebrow="The threshold"
        title="The house you would build on it"
        body="A model duplex villa on a sanctioned layout — the same one a buyer
              walks into on a site visit. Ground-floor garden, gated community,
              underground drainage, 40ft blacktop roads."
        meta={[
          { label: 'Location', value: 'Poosapatirega' },
          { label: 'Roads', value: '40ft & 33ft' },
          { label: 'Security', value: '24×7 CCTV' },
        ]}
      />

      <Act
        index="IV"
        eyebrow="The standoff"
        title="Rates from the office that holds the site"
        body="Prices are quoted by the branch that owns the layout, not by a
              form. Tell us which district and which size, and the office that
              holds it will answer."
        meta={[
          { label: 'Visakhapatnam', value: 'Head office' },
          { label: 'Vizianagaram', value: 'Branch' },
          { label: 'Srikakulam', value: 'Branch' },
        ]}
      />

      {/* The closing stretch carries no copy. The camera finishes its push at
          the aperture here and the frame is allowed to be the only thing on
          screen before the Command Overlay takes it. */}
      <div id="directory" aria-hidden className="min-h-[60vh]" />
    </main>
  );
}
