// apps/public/src/lib/realtime.ts
import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Singleton client for the browser. 
// Uses anon key, granting projection-read-only access via RLS.
export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

/**
 * Custom hook to sync project units in real-time from the public projection.
 * Combines a Postgres subscription with a 30s polling fallback. (FR-PM9)
 */
export function useProjectRealtime<
  T extends { 
    unitId: string; 
    presentationStatus: string; 
    pricePaise?: bigint | null; 
    priceOnRequest?: boolean; 
  }
>(projectId: string, initialUnits: T[]): T[] {
  const [units, setUnits] = useState<T[]>(initialUnits);

  useEffect(() => {
    // Fails silently in environments where vars aren't set (e.g. build step), fulfilling NFR-PM11
    if (!supabase) return;

    // 1. Subscribe to Realtime channel on the projection schema
    const channel = supabase
      .channel(`project-${projectId}-updates`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'projection',
          table: 'units_pub',
          filter: `project_id=eq.${projectId}`
        },
        (payload: any) => {
          const updatedUnit = payload.new;
          setUnits((prev) =>
            prev.map((u) => {
              if (u.unitId !== updatedUnit.unit_id) return u;
              
              return {
                ...u,
                presentationStatus: updatedUnit.presentation_status,
                // Conditionally apply price updates to ensure structural preservation of the generic type
                ...(u.pricePaise !== undefined 
                  ? { pricePaise: updatedUnit.price_paise ? BigInt(updatedUnit.price_paise) : null } 
                  : {}),
                ...(u.priceOnRequest !== undefined 
                  ? { priceOnRequest: updatedUnit.price_on_request } 
                  : {})
              };
            })
          );
        }
      )
      .subscribe();

    // 2. 30s Polling Fallback to guarantee consistency
    const intervalId = setInterval(async () => {
      const { data, error } = await supabase
        .schema('projection')
        .from('units_pub')
        .select('unit_id, presentation_status, price_paise, price_on_request')
        .eq('project_id', projectId);

      if (!error && data) {
        setUnits((prev) => {
          let hasChanges = false;
          const next = prev.map((u) => {
            const fresh = data.find((d: any) => d.unit_id === u.unitId);
            if (!fresh) return u;

            const freshPricePaise = fresh.price_paise ? BigInt(fresh.price_paise) : null;
            const statusChanged = fresh.presentation_status !== u.presentationStatus;
            const priceChanged = u.pricePaise !== undefined && freshPricePaise !== u.pricePaise;
            const porChanged = u.priceOnRequest !== undefined && fresh.price_on_request !== u.priceOnRequest;

            if (statusChanged || priceChanged || porChanged) {
              hasChanges = true;
              return {
                ...u,
                presentationStatus: fresh.presentation_status,
                ...(u.pricePaise !== undefined ? { pricePaise: freshPricePaise } : {}),
                ...(u.priceOnRequest !== undefined ? { priceOnRequest: fresh.price_on_request } : {})
              };
            }
            return u;
          });
          return hasChanges ? next : prev;
        });
      }
    }, 30000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(intervalId);
    };
  }, [projectId]);

  return units;
}
