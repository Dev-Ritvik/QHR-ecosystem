// apps/crm/src/components/units/TransitionDialog.tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { transitionUnitStatusAction } from "@/server/actions/units";
import { LEGAL_TRANSITIONS } from "@estate/domain/src/unit-status/machine";
import { StatusBadge } from "./StatusBadge";

type TransitionDialogProps = {
  unitId: string;
  currentStatus: string;
};

export function TransitionDialog({ unitId, currentStatus }: TransitionDialogProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // 'not_for_sale' stays legal internally (legacy/DB compat) but is retired
  // from the owner UI — the client's 4-state model has no such option.
  // 'booked' goes through the detailed booking form (BookUnitDialog), which
  // creates the real booking entity; a bare status flip would strand the unit
  // in 'booked' with no buyer, no token amount and no commission basis.
  const legalTransitions = (LEGAL_TRANSITIONS[(currentStatus || 'initial') as keyof typeof LEGAL_TRANSITIONS] || [])
    .filter((st) => st !== 'not_for_sale' && st !== 'booked');

  if (legalTransitions.length === 0) {
    return <StatusBadge status={currentStatus} />;
  }

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    const toStatus = formData.get("toStatus") as string;
    const reason = formData.get("reason") as string;
    const holdId = formData.get("holdId") as string;
    const clientId = formData.get("clientId") as string;

    startTransition(async () => {
      const res = await transitionUnitStatusAction(unitId, toStatus, { reason, holdId, clientId });
      if (res.ok) {
        setIsOpen(false);
        router.refresh();
      } else {
        setError(res.message);
      }
    });
  };

  return (
    <>
      <button 
        type="button" 
        onClick={() => setIsOpen(true)} 
        className="inline-flex items-center gap-2 hover:opacity-80 transition-opacity"
        title="Change Status"
      >
        <StatusBadge status={currentStatus} />
        <span className="text-xs text-blue-600 underline">Change</span>
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Change Unit Status</h2>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="text-sm text-red-600 bg-red-50 p-3 rounded border border-red-200">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700">Current Status</label>
                <div className="mt-2">
                  <StatusBadge status={currentStatus} />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">New Status</label>
                <p className="text-xs text-gray-500 mb-2">Note: &apos;booked&apos; and &apos;on_hold&apos; are typically driven by deal creation workflows and require linking those entities.</p>
                <select 
                  name="toStatus" 
                  required 
                  className="mt-1 block w-full rounded-md border border-gray-300 p-2 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                >
                  <option value="">Select new status...</option>
                  {legalTransitions.map((st: string) => (
                    <option key={st} value={st}>{st.replace(/_/g, ' ')}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Reason</label>
                <input 
                  name="reason" 
                  className="mt-1 block w-full rounded-md border border-gray-300 p-2 shadow-sm focus:border-blue-500 focus:ring-blue-500" 
                  placeholder="Required for manual overrides" 
                />
              </div>

              <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-200">
                <button 
                  type="button" 
                  onClick={() => setIsOpen(false)} 
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={isPending} 
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {isPending ? "Saving..." : "Confirm Transition"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
