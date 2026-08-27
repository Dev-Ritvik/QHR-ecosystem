// apps/public/src/components/site/UnitSpecs.tsx
import React from 'react';
import { formatAreaSqFt, formatAreaSqYd } from '@/lib/format';
import { InferSelectModel } from 'drizzle-orm';
import { unitsPub } from '@estate/db/src/schema/projection';

type UnitPub = InferSelectModel<typeof unitsPub>;

export function UnitSpecs({ unit }: { unit: UnitPub }) {
  const classDetails = Array.isArray(unit.classDetails) 
    ? (unit.classDetails as Array<{ label: string; value: string }>) 
    : [];

  const areaDisplay = [formatAreaSqYd(unit.areaSqYd), formatAreaSqFt(unit.areaSqFt)]
    .filter(Boolean)
    .join(' / ');

  const commonSpecs = [
    { label: 'Dimensions', value: unit.dimensionsLabel || '-' },
    { label: 'Area', value: areaDisplay || '-' },
    { label: 'Facing', value: unit.facing || '-' },
    { label: 'Road Width', value: unit.roadWidthM ? `${unit.roadWidthM} m` : '-' },
    { label: 'Corner Plot', value: unit.isCorner ? 'Yes' : 'No' },
  ];

  const allSpecs = [...commonSpecs, ...classDetails];

  return (
    // A specification table is the densest factual thing on the site, so it is
    // ruled rather than boxed: hairlines on the site's own palette instead of
    // the white card this used to be. Numbers are tabular so the two columns
    // align down the page rather than wandering with the digits.
    <div className="overflow-hidden rounded-sm border border-white/10">
      <div className="grid grid-cols-1 divide-y divide-white/10 sm:grid-cols-2 sm:divide-y-0 sm:divide-x [&>div:nth-child(n+3)]:border-t [&>div:nth-child(n+3)]:border-white/10">
        {allSpecs.map((spec, idx) => (
          <SpecItem key={idx} label={spec.label} value={spec.value} />
        ))}
      </div>
    </div>
  );
}

function SpecItem({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col justify-center px-5 py-4">
      <span className="t-eyebrow mb-1.5 text-[#F2EDE4]/50">{label}</span>
      <span
        className="text-[15px] text-[#F2EDE4]"
        style={{ fontVariantNumeric: 'tabular-nums' }}
      >
        {value}
      </span>
    </div>
  );
}
