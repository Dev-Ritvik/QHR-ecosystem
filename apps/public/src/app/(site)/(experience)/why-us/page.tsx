// apps/public/src/app/(site)/(experience)/why-us/page.tsx
//
// Tier 1 node — server-rendered. Copy is qualitative placeholder-tone;
// replace with the owner's verified proof points before launch.
import type { Metadata } from 'next';
import { NodePanel } from '@/components/experience/NodePanel';

export const metadata: Metadata = {
  title: 'Why Choose Us — The Residence',
  description:
    'Transparent documentation, published pricing logic, and inventory status you can verify — the reasons families choose us in Visakhapatnam.',
};

export default function WhyUsPage() {
  return (
    <NodePanel
      eyebrow="Chapter II"
      title="Proof, not persuasion"
      lede="Three commitments we hold to on every address we open — each one verifiable before you speak to anyone."
      next={{ href: '/about', label: 'Back to the beginning' }}
    >
      <p>
        <span className="text-[#E8B98A]">Documentation first.</span> Approval numbers and
        survey details are published on the plot itself, not produced on request.
      </p>
      <p>
        <span className="text-[#E8B98A]">Honest availability.</span> Status is drawn live
        from our records — what you see is what remains, at the moment you look.
      </p>
      <p>
        <span className="text-[#E8B98A]">Pricing you can follow.</span> Rates are computed
        from a published basis, so a corner plot costs more for a reason you can read.
      </p>
    </NodePanel>
  );
}
