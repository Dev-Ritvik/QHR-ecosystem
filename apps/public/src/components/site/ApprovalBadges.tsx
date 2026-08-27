// apps/public/src/components/site/ApprovalBadges.tsx
import { ShieldCheck } from 'lucide-react';

export type BadgeData = {
  label: string;
  value: string;
};

export function ApprovalBadges({ badges }: { badges: unknown }) {
  if (!Array.isArray(badges) || badges.length === 0) {
    return null;
  }

  const typedBadges = badges as BadgeData[];

  return (
    <div className="flex flex-wrap gap-4 mt-6">
      {typedBadges.map((badge, idx) => (
        // An approval is the highest-trust fact on a property page, so it is
        // given the accent rather than the grey it used to sit in — and the
        // dark palette the rest of the site uses, which this predated.
        <div
          key={idx}
          className="inline-flex items-center gap-2.5 rounded-sm border border-[#C08A5D]/25 bg-[#C08A5D]/[0.07] px-3.5 py-2.5"
        >
          <ShieldCheck className="h-4 w-4 shrink-0 text-[#C08A5D]" strokeWidth={1.5} />
          <div className="flex flex-col">
            <span className="t-eyebrow mb-1 leading-none text-[#F2EDE4]/50">
              {badge.label}
            </span>
            <span className="text-sm leading-none text-[#F2EDE4]">{badge.value}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
