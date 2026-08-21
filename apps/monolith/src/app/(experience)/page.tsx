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

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'The Monolith at Dusk — Quality Homes Reality',
  description:
    'Approved plotted layouts, plantation farmland and villas across the '
    + 'Visakhapatnam–Vizianagaram–Srikakulam corridor. VMRDA, RERA and SUDA sanctioned.',
};

/** One Act. 250vh of track with its copy pinned at a readable height.
 *
 *  Copy is held to the LEFT and capped at 40vw so the camera keeps the right
 *  60% as an unobstructed stage. Capping by grid span alone is not enough —
 *  a span is a fraction of the CONTAINER, and on a wide monitor six of twelve
 *  columns falls well short of 40% of the viewport while on a narrow one it
 *  overruns. The stage is measured in viewport width, so the copy has to be. */
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
    <section className="mx-auto grid min-h-[250vh] max-w-7xl grid-cols-12 px-6">
      <div className="col-span-12 md:col-span-6 md:max-w-[40vw]">
        <div className="sticky top-[22vh] py-[8vh]">
          <p className="t-mono flex items-baseline gap-4 text-ash">
            <span className="text-ember">{index}</span>
            <span>{eyebrow}</span>
          </p>

          <h2 className="t-h1 mt-8 text-signal">{title}</h2>

          <p className="t-body mt-6 max-w-md text-ash">{body}</p>

          {meta ? (
            <dl className="mt-10 space-y-3 border-t border-white/10 pt-6">
              {meta.map((m) => (
                <div key={m.label} className="flex items-baseline justify-between gap-8">
                  <dt className="t-mono text-ash">{m.label}</dt>
                  <dd className="t-mono text-signal">{m.value}</dd>
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
          Scale is withheld until q 0.10. */}
      <section className="mx-auto grid min-h-[250vh] max-w-7xl grid-cols-12 px-6">
        <div className="col-span-12 md:col-span-6 md:max-w-[40vw]">
          <div className="sticky top-[24vh] py-[10vh]">
            <p className="t-mono text-ember">Quality Homes Reality</p>

            <h1 className="t-display mt-10 text-signal">
              Land, in the districts
              <br />
              we come from
            </h1>

            <p className="t-lede mt-8 max-w-lg text-ash">
              Approved layouts, plantation farmland and villas across the
              Visakhapatnam&ndash;Vizianagaram&ndash;Srikakulam corridor.
            </p>

            <p className="t-body mt-6 max-w-md text-ash/70">
              Twenty years in the field, three branch offices, and every
              sanction number published in full. Scroll to descend.
            </p>

            <div className="mt-14 flex items-center gap-4">
              <span className="t-mono text-ash/60">Scroll</span>
              <span aria-hidden className="h-10 w-px bg-white/15" />
            </div>
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
          { label: 'Roads', value: "40ft & 33ft" },
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
