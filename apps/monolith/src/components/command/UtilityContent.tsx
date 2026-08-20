// apps/monolith/src/components/command/UtilityContent.tsx
//
// The typeset body of every Command Overlay page — MASTER_SPEC §7.
//
// A SERVER component with zero R3F / GSAP / Zustand imports, which is the whole
// point of §7's bundle quarantine: fifteen utility pages must not drag the
// cinematic bundle into their payload. Verify with @next/bundle-analyzer if
// this ever grows an import.
//
// The `pending` notice is deliberately prominent rather than tucked away. A
// property page that quietly reads as complete while waiting on documents is
// how a misleading claim ships.

import type { UtilityPage } from '@/lib/utility-content';

export function UtilityContent({ page }: { page: UtilityPage }) {
  return (
    <article>
      <p className="t-mono text-ember">{page.title}</p>

      <h1 className="t-h2 mt-8 text-signal">{page.lede}</h1>

      {page.pending ? (
        <p className="t-body mt-8 border-l-2 border-ember/50 pl-5 text-ash">
          <span className="t-mono text-ember">Awaiting client documents.</span>{' '}
          This page is deliberately incomplete rather than filled with
          plausible-sounding copy. Nothing below is a claim we have not verified.
        </p>
      ) : null}

      <div className="mt-12 space-y-10">
        {page.sections.map((s, i) => (
          <section key={s.heading ?? i}>
            {s.heading ? (
              <h2 className="t-mono text-ash/70">{s.heading}</h2>
            ) : null}

            <div className={s.heading ? 'mt-4 space-y-4' : 'space-y-4'}>
              {s.body.map((p) => (
                <p key={p.slice(0, 24)} className="t-body max-w-prose text-ash">
                  {p}
                </p>
              ))}
            </div>

            {s.list ? (
              <ul className="mt-6 space-y-3">
                {s.list.map((item) => (
                  <li
                    key={item.slice(0, 24)}
                    className="t-body flex gap-4 text-ash"
                  >
                    <span aria-hidden className="text-ember">
                      —
                    </span>
                    <span className="max-w-prose">{item}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </section>
        ))}
      </div>
    </article>
  );
}
