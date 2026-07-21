// apps/crm/src/components/units/HoldDialog.tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createHold, extendHold, releaseHold } from "@/server/actions/holds";

type HoldDialogProps = {
  unitId: string;
  activeHold?: any; 
};

export function HoldDialog({ unitId, activeHold }: HoldDialogProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleCreate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    
    const data = {
      clientName: formData.get("clientName") as string,
      clientPhone: formData.get("clientPhone") as string,
      durationDays: parseInt(formData.get("durationDays") as string, 10),
      reason: formData.get("reason") as string,
    };

    startTransition(async () => {
      const res = await createHold(unitId, data);
      if (res.ok) {
        setIsOpen(false);
        router.refresh();
      } else {
        setError(res.message);
      }
    });
  };

  const handleExtend = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!activeHold) return;
    setError(null);
    
    const formData = new FormData(e.currentTarget);
    const data = {
      additionalDays: parseInt(formData.get("additionalDays") as string, 10),
      reason: formData.get("reason") as string,
    };

    startTransition(async () => {
      const res = await extendHold(activeHold.id, data);
      if (res.ok) {
        setIsOpen(false);
        router.refresh();
      } else {
        setError(res.message);
      }
    });
  };

  const handleRelease = () => {
    if (!activeHold) return;
    if (!confirm("Are you sure you want to release this hold? The unit will become available immediately.")) return;
    
    startTransition(async () => {
      const res = await releaseHold(activeHold.id, "Manually released");
      if (res.ok) {
        setIsOpen(false);
        router.refresh();
      } else {
        alert(res.message);
      }
    });
  };

  return (
    <>
      <button 
        type="button" 
        onClick={() => setIsOpen(true)} 
        className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
          activeHold 
            ? "bg-yellow-100 text-yellow-800 hover:bg-yellow-200 border border-yellow-200"
            : "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50"
        }`}
      >
        {activeHold ? "Manage Hold" : "Place on Hold"}
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
            
            <div className="flex justify-between items-center mb-4 border-b border-gray-100 pb-3">
              <h2 className="text-xl font-bold text-gray-900">
                {activeHold ? "Manage Active Hold" : "Place Unit on Hold"}
              </h2>
            </div>
            
            {error && (
              <div className="mb-4 text-sm text-red-600 bg-red-50 p-3 rounded border border-red-200">
                {error}
              </div>
            )}

            {!activeHold ? (
              <form onSubmit={handleCreate} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Client Name *</label>
                  <input name="clientName" required className="mt-1 block w-full rounded-md border border-gray-300 p-2 shadow-sm focus:border-blue-500 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Client Phone (E.164) *</label>
                  <input name="clientPhone" required placeholder="+919876543210" pattern="^\+[1-9][0-9]{7,14}$" title="Must be E.164 format, starting with +" className="mt-1 block w-full rounded-md border border-gray-300 p-2 shadow-sm focus:border-blue-500 focus:ring-blue-500" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Duration (Days)</label>
                    <input type="number" name="durationDays" defaultValue={7} min={1} max={30} required className="mt-1 block w-full rounded-md border border-gray-300 p-2 shadow-sm focus:border-blue-500 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Reason</label>
                    <input name="reason" placeholder="Optional notes" className="mt-1 block w-full rounded-md border border-gray-300 p-2 shadow-sm focus:border-blue-500 focus:ring-blue-500" />
                  </div>
                </div>

                <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-200">
                  <button type="button" onClick={() => setIsOpen(false)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors">
                    Cancel
                  </button>
                  <button type="submit" disabled={isPending} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors">
                    {isPending ? "Holding..." : "Confirm Hold"}
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-6">
                <div className="bg-gray-50 rounded p-4 text-sm text-gray-700 border border-gray-200">
                  <p><strong>Starts At:</strong> {new Date(activeHold.startsAt).toLocaleString()}</p>
                  <p><strong>Expires At:</strong> {new Date(activeHold.expiresAt).toLocaleString()}</p>
                </div>

                <form onSubmit={handleExtend} className="space-y-4">
                  <h3 className="font-semibold text-gray-900 border-b pb-1">Extend Hold</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Additional Days</label>
                      <input type="number" name="additionalDays" min={1} max={30} defaultValue={7} required className="mt-1 block w-full rounded-md border border-gray-300 p-2 shadow-sm focus:border-blue-500 focus:ring-blue-500" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Reason</label>
                      <input name="reason" placeholder="Optional notes" className="mt-1 block w-full rounded-md border border-gray-300 p-2 shadow-sm focus:border-blue-500 focus:ring-blue-500" />
                    </div>
                  </div>
                  <div className="flex justify-end gap-3">
                    <button type="submit" disabled={isPending} className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors">
                      {isPending ? "Extending..." : "Extend"}
                    </button>
                  </div>
                </form>

                <div className="border-t border-gray-200 pt-4 flex justify-between items-center">
                  <button type="button" onClick={() => setIsOpen(false)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors">
                    Close
                  </button>
                  <button type="button" onClick={handleRelease} disabled={isPending} className="px-4 py-2 text-sm font-medium text-red-700 bg-red-100 border border-red-200 rounded-md hover:bg-red-200 disabled:opacity-50 transition-colors">
                    {isPending ? "Processing..." : "Release Hold Now"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
