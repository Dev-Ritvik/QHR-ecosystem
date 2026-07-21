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
    <div className="bg-white border border-gray-200 rounded-sm overflow-hidden">
      <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x border-b border-gray-200 [&>div:nth-child(n+3)]:border-t">
        {allSpecs.map((spec, idx) => (
          <SpecItem key={idx} label={spec.label} value={spec.value} />
        ))}
      </div>
    </div>
  );
}

function SpecItem({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="px-5 py-4 flex flex-col justify-center">
      <span className="text-[10px] uppercase tracking-widest text-gray-500 font-bold mb-1">
        {label}
      </span>
      <span className="text-base font-medium text-gray-900">
        {value}
      </span>
    </div>
  );
}
