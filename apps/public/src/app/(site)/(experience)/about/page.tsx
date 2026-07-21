// apps/public/src/app/(site)/(experience)/about/page.tsx
//
// Tier 1 node — server-rendered. NOTE: copy below is intentionally
// qualitative placeholder-tone (no invented years, counts, or awards).
// Replace with the owner's verified facts before launch.
import type { Metadata } from 'next';
import { NodePanel } from '@/components/experience/NodePanel';

export const metadata: Metadata = {
  title: 'About — The Residence',
  description:
    'A Visakhapatnam developer building for the long horizon: considered land, honest documentation, and architecture that ages well.',
};

export default function AboutPage() {
  return (
    <NodePanel
      eyebrow="Chapter I"
      title="Built for the long horizon"
      lede="We develop a small number of addresses in Visakhapatnam, and we would rather be known for how they age than for how quickly they sold."
      next={{ href: '/why-us', label: 'Why families choose us' }}
    >
      <p>
        Every plot we release carries its paperwork in the open: approvals, survey lineage,
        and the exact dimensions you are buying — published before you ask for them.
      </p>
      <p>
        The result is a quieter kind of confidence. You are not persuaded into a purchase;
        you are given enough to decide.
      </p>
    </NodePanel>
  );
}
