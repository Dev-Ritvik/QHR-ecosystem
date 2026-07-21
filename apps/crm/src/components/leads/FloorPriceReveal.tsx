// apps/crm/src/components/leads/FloorPriceReveal.tsx
'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { getLeadFloorPrice } from '@/server/actions/leads';
import { Eye, ShieldAlert } from 'lucide-react';
import { formatPaise } from '@estate/domain/src/money/format';

export function FloorPriceReveal({ leadId }: { leadId: string }) {
  const [isPending, startTransition] = useTransition();
  const [floorPrice, setFloorPrice] = useState<number | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  const handleReveal = () => {
    setError(null);
    startTransition(async () => {
      const res = await getLeadFloorPrice(leadId);
      if (res.ok) {
        setFloorPrice(res.data);
      } else {
        setError(res.code || 'Unauthorized or failed');
      }
    });
  };

  if (error) {
    return (
      <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-sm text-destructive flex items-center">
        <ShieldAlert className="w-4 h-4 mr-2" />
        {error}
      </div>
    );
  }

  if (floorPrice !== undefined) {
    return (
      <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg flex items-center justify-between">
        <div className="flex flex-col">
          <span className="text-xs font-semibold uppercase tracking-wider text-orange-800">Owner Floor Price</span>
          <span className="text-[10px] text-orange-600/70 mt-0.5">Read audited</span>
        </div>
        <span className="font-bold text-orange-900 text-lg">
          {floorPrice === null ? 'Not logged' : formatPaise(BigInt(floorPrice))}
        </span>
      </div>
    );
  }

  return (
    <Button 
      variant="outline" 
      className="w-full text-orange-700 border-orange-200 hover:bg-orange-50 hover:text-orange-800"
      onClick={handleReveal}
      disabled={isPending}
    >
      <Eye className="w-4 h-4 mr-2" />
      Reveal Floor Price (Audited Read)
    </Button>
  );
}
