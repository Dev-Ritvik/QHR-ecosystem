"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createPriceVersion } from "@/server/actions/pricing";
import { computePrice } from "@estate/domain/src/pricing/compute";

type RateBasis = "per_sq_yd" | "per_sq_ft" | "lump_sum";

const FACING_OPTIONS = [
  { value: "north", label: "North" },
  { value: "south", label: "South" },
  { value: "east", label: "East" },
  { value: "west", label: "West" },
  { value: "north_east", label: "North East" },
  { value: "north_west", label: "North West" },
  { value: "south_east", label: "South East" },
  { value: "south_west", label: "South West" },
];

type FacingRow = { facing: string; pct: string };

export function PriceVersionForm({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [baseRate, setBaseRate] = useState<string>("15000");
  const [rateBasis, setRateBasis] = useState<RateBasis>("per_sq_yd");
  const [reason, setReason] = useState<string>("");
  const [cornerPct, setCornerPct] = useState<string>("5");
  const [facingRows, setFacingRows] = useState<FacingRow[]>([
    { facing: "east", pct: "2" },
    { facing: "north", pct: "1" },
  ]);

  // Builds the same premiums structure the domain engine consumes
  // ({ corner_pct, facing: { direction: pct } }) from the labeled inputs.
  const buildPremiums = () => {
    const premiums: { corner_pct?: number; facing?: Record<string, number> } = {};
    const corner = parseFloat(cornerPct);
    if (!isNaN(corner) && corner !== 0) premiums.corner_pct = corner;

    const facing: Record<string, number> = {};
    for (const row of facingRows) {
      const pct = parseFloat(row.pct);
      if (row.facing && !isNaN(pct) && pct !== 0) facing[row.facing] = pct;
    }
    if (Object.keys(facing).length > 0) premiums.facing = facing;
    return premiums;
  };

  const updateFacingRow = (index: number, patch: Partial<FacingRow>) => {
    setFacingRows(rows => rows.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  };

  // Preview State
  const [previewArea, setPreviewArea] = useState<string>("150");
  const [previewIsCorner, setPreviewIsCorner] = useState<boolean>(false);
  const [previewFacing, setPreviewFacing] = useState<string>("");
  const [previewRoadWidth, setPreviewRoadWidth] = useState<string>("");

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    const baseRatePaise = Math.floor(parseFloat(baseRate) * 100);

    startTransition(async () => {
      const res = await createPriceVersion(projectId, {
        rateBasis,
        baseRatePaise,
        reason,
        premiums: buildPremiums()
      });

      if (res.ok) {
        setReason(""); 
        router.refresh();
      } else {
        setError(res.message);
      }
    });
  };

  // Safe preview calculation
  let previewPrice = BigInt(0);
  let previewError = null;

  try {
    const premiums = buildPremiums();
    const baseRatePaise = BigInt(Math.floor(parseFloat(baseRate || "0") * 100));
    
    // Explicitly casting strings to correct types for computePrice domain logic
    const result = computePrice(
      baseRatePaise, 
      rateBasis, 
      premiums,
      {
        areaSqYd: rateBasis === 'per_sq_yd' ? parseFloat(previewArea || "0") : undefined,
        areaSqFt: rateBasis === 'per_sq_ft' ? parseFloat(previewArea || "0") : undefined,
        isCorner: previewIsCorner,
        facing: previewFacing ? (previewFacing as any) : undefined,
        roadWidthM: previewRoadWidth ? parseFloat(previewRoadWidth) : undefined
      }
    );
    previewPrice = result.computedPricePaise;
  } catch (err: any) {
    previewError = "Invalid JSON or preview parameters.";
  }

  const formattedPreview = `₹ ${(Number(previewPrice) / 100).toLocaleString('en-IN')}`;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-md text-sm font-medium border border-red-200">
            {error}
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Base Rate (₹)</label>
            <input 
              type="number" 
              step="0.01" 
              value={baseRate}
              onChange={(e) => setBaseRate(e.target.value)}
              required 
              className="mt-1 block w-full rounded-md border border-gray-300 p-2 shadow-sm focus:border-blue-500 focus:ring-blue-500" 
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Rate Basis</label>
            <select 
              value={rateBasis}
              onChange={(e) => setRateBasis(e.target.value as RateBasis)}
              className="mt-1 block w-full rounded-md border border-gray-300 p-2 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            >
              <option value="per_sq_yd">Per Sq Yd</option>
              <option value="per_sq_ft">Per Sq Ft</option>
              <option value="lump_sum">Lump Sum</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Reason for Change (Required)</label>
          <input 
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            required 
            placeholder="e.g. Festival offer ended, Road widened"
            className="mt-1 block w-full rounded-md border border-gray-300 p-2 shadow-sm focus:border-blue-500 focus:ring-blue-500" 
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Corner Plot Premium (%)</label>
          <p className="text-xs text-gray-500 mb-2">Added to the base price for corner units. Leave 0 for none.</p>
          <input
            type="number"
            step="0.1"
            min="0"
            value={cornerPct}
            onChange={(e) => setCornerPct(e.target.value)}
            className="mt-1 block w-32 rounded-md border border-gray-300 p-2 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Facing Premiums</label>
          <p className="text-xs text-gray-500 mb-2">Percentage added for units facing a given direction.</p>
          <div className="space-y-2">
            {facingRows.map((row, index) => (
              <div key={index} className="flex items-center gap-2">
                <select
                  value={row.facing}
                  onChange={(e) => updateFacingRow(index, { facing: e.target.value })}
                  className="block w-40 rounded-md border border-gray-300 p-2 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                >
                  {FACING_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
                <div className="relative">
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={row.pct}
                    onChange={(e) => updateFacingRow(index, { pct: e.target.value })}
                    className="block w-24 rounded-md border border-gray-300 p-2 pr-7 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-sm text-gray-400">%</span>
                </div>
                <button
                  type="button"
                  onClick={() => setFacingRows(rows => rows.filter((_, i) => i !== index))}
                  className="text-sm font-medium text-red-600 hover:text-red-800"
                  aria-label={`Remove facing premium ${index + 1}`}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => {
              const used = new Set(facingRows.map(r => r.facing));
              const next = FACING_OPTIONS.find(o => !used.has(o.value));
              setFacingRows(rows => [...rows, { facing: next?.value ?? "north", pct: "1" }]);
            }}
            className="mt-2 text-sm font-medium text-blue-600 hover:text-blue-800"
          >
            + Add Facing Premium
          </button>
        </div>

        <button 
          type="submit" 
          disabled={isPending} 
          className="w-full bg-blue-600 text-white font-medium px-5 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {isPending ? "Activating..." : "Activate New Price Version"}
        </button>
      </form>

      {/* Preview Section */}
      <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
        <h3 className="text-lg font-bold text-gray-900 mb-4">Preview Calculator</h3>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Area ({rateBasis === "per_sq_yd" ? "Sq Yd" : "Sq Ft"})</label>
            <input 
              type="number" 
              value={previewArea}
              onChange={(e) => setPreviewArea(e.target.value)}
              disabled={rateBasis === "lump_sum"}
              className="mt-1 block w-full rounded-md border border-gray-300 p-2 shadow-sm disabled:bg-gray-100" 
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Facing</label>
              <select 
                value={previewFacing}
                onChange={(e) => setPreviewFacing(e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 p-2 shadow-sm"
              >
                <option value="">Any</option>
                <option value="east">East</option>
                <option value="north">North</option>
                <option value="west">West</option>
                <option value="south">South</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Road Width (m)</label>
              <input 
                type="number" 
                value={previewRoadWidth}
                onChange={(e) => setPreviewRoadWidth(e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 p-2 shadow-sm" 
              />
            </div>
          </div>

          <div className="flex items-center">
            <input 
              type="checkbox" 
              id="isCornerPreview"
              checked={previewIsCorner}
              onChange={(e) => setPreviewIsCorner(e.target.checked)}
              className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <label htmlFor="isCornerPreview" className="ml-2 block text-sm text-gray-700">
              Is Corner Plot
            </label>
          </div>

          <div className="mt-6 pt-4 border-t border-gray-200">
            <p className="text-sm text-gray-500 mb-1">Calculated List Price</p>
            {previewError ? (
              <p className="text-red-600 font-medium text-sm">{previewError}</p>
            ) : (
              <p className="text-3xl font-bold text-gray-900">{formattedPreview}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
