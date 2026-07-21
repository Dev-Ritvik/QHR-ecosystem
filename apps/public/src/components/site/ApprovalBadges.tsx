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
        <div 
          key={idx} 
          className="inline-flex items-center space-x-2 bg-gray-50 border border-gray-200 px-3 py-2 rounded-sm"
        >
          <ShieldCheck className="w-4 h-4 text-gray-400" />
          <div className="flex flex-col">
            <span className="text-[10px] uppercase tracking-wider text-gray-500 font-medium leading-none mb-1">
              {badge.label}
            </span>
            <span className="text-sm font-medium text-gray-900 leading-none">
              {badge.value}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
