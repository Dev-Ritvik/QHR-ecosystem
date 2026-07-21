"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createUnit, updateUnit } from "@/server/actions/units";
import { buildUnitPayload } from "@/lib/unit-payload";

type UnitFormProps = {
  projectId: string;
  assetClass: 'land' | 'commercial' | 'luxury_residential';
  initialData?: any;
  unitId?: string;
};

export function UnitForm({ projectId, assetClass, initialData, unitId }: UnitFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    let cleanedData: Record<string, unknown>;
    try {
      cleanedData = buildUnitPayload(new FormData(e.currentTarget));
    } catch (err: any) {
      setError(err.message || "Invalid form values");
      return;
    }

    startTransition(async () => {
      const res = unitId
        ? await updateUnit(projectId, unitId, cleanedData)
        : await createUnit(projectId, cleanedData);

      if (res.ok) {
        router.push(`/projects/${projectId}/units`);
        router.refresh();
      } else {
        setError(res.message);
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8 max-w-4xl">
      {error && (
        <div className="bg-red-50 text-red-600 p-3 rounded-md text-sm font-medium border border-red-200">
          {error}
        </div>
      )}

      {/* CORE FIELDS */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900 border-b border-gray-200 pb-2">Core Details</h3>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Unit Number *</label>
            <input name="unitNumber" defaultValue={initialData?.unitNumber} required className="mt-1 block w-full rounded-md border border-gray-300 p-2 shadow-sm focus:border-blue-500 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Facing</label>
            <select name="facing" defaultValue={initialData?.facing || ""} className="mt-1 block w-full rounded-md border border-gray-300 p-2 shadow-sm focus:border-blue-500 focus:ring-blue-500">
              <option value="">Unknown</option>
              <option value="north">North</option>
              <option value="south">South</option>
              <option value="east">East</option>
              <option value="west">West</option>
              <option value="north_east">North East</option>
              <option value="north_west">North West</option>
              <option value="south_east">South East</option>
              <option value="south_west">South West</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Road Width (m)</label>
            <select name="roadWidthM" defaultValue={initialData?.roadWidthM != null ? String(initialData.roadWidthM) : ""} className="mt-1 block w-full rounded-md border border-gray-300 p-2 shadow-sm focus:border-blue-500 focus:ring-blue-500">
              <option value="">Not specified</option>
              <option value="20">20 m</option>
              <option value="30">30 m</option>
              <option value="40">40 m</option>
              <option value="60">60 m</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Area (Sq Yd)</label>
            <input type="number" step="0.01" name="areaSqYd" defaultValue={initialData?.areaSqYd || ""} className="mt-1 block w-full rounded-md border border-gray-300 p-2 shadow-sm focus:border-blue-500 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Area (Sq Ft)</label>
            <input type="number" step="0.01" name="areaSqFt" defaultValue={initialData?.areaSqFt || ""} className="mt-1 block w-full rounded-md border border-gray-300 p-2 shadow-sm focus:border-blue-500 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Dimensions Label</label>
            <input name="dimensionsLabel" placeholder="e.g. 30x40" defaultValue={initialData?.dimensionsLabel || ""} className="mt-1 block w-full rounded-md border border-gray-300 p-2 shadow-sm focus:border-blue-500 focus:ring-blue-500" />
          </div>
          <div className="flex items-center pt-6">
            <input type="checkbox" name="isCorner" id="isCorner" defaultChecked={initialData?.isCorner} className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded" />
            <label htmlFor="isCorner" className="ml-2 block text-sm font-medium text-gray-700">Is Corner Plot</label>
          </div>
        </div>
      </div>

      {/* LAND DETAILS */}
      {assetClass === 'land' && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-900 border-b border-gray-200 pb-2">Land Specific Details</h3>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Survey Number *</label>
              <input name="surveyNumber" defaultValue={initialData?.surveyNumber} required className="mt-1 block w-full rounded-md border border-gray-300 p-2 shadow-sm focus:border-blue-500 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Subdivision Lineage</label>
              <input name="subdivisionLineage" defaultValue={initialData?.subdivisionLineage || ""} className="mt-1 block w-full rounded-md border border-gray-300 p-2 shadow-sm focus:border-blue-500 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Conversion Status</label>
              <select name="conversionStatus" defaultValue={initialData?.conversionStatus || "not_required"} className="mt-1 block w-full rounded-md border border-gray-300 p-2 shadow-sm focus:border-blue-500 focus:ring-blue-500">
                <option value="not_required">Not Required</option>
                <option value="pending">Pending</option>
                <option value="converted">Converted</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Extent Value</label>
              <input type="number" step="0.01" name="extentValue" defaultValue={initialData?.extentValue || ""} className="mt-1 block w-full rounded-md border border-gray-300 p-2 shadow-sm focus:border-blue-500 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Extent Unit</label>
              <select name="extentUnit" defaultValue={initialData?.extentUnit || ""} className="mt-1 block w-full rounded-md border border-gray-300 p-2 shadow-sm focus:border-blue-500 focus:ring-blue-500">
                <option value="">None</option>
                <option value="sq_yd">Sq Yd</option>
                <option value="sq_ft">Sq Ft</option>
                <option value="acre">Acre</option>
                <option value="gunta">Gunta</option>
                <option value="cent">Cent</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Approval Authority</label>
              <select name="approvalAuthority" defaultValue={initialData?.approvalAuthority || ""} className="mt-1 block w-full rounded-md border border-gray-300 p-2 shadow-sm focus:border-blue-500 focus:ring-blue-500">
                <option value="">None</option>
                <option value="dtcp">DTCP</option>
                <option value="hmda">HMDA</option>
                <option value="rera">RERA</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Approval Number</label>
              <input name="approvalNumber" defaultValue={initialData?.approvalNumber || ""} className="mt-1 block w-full rounded-md border border-gray-300 p-2 shadow-sm focus:border-blue-500 focus:ring-blue-500" />
            </div>
          </div>
        </div>
      )}

      {/* COMMERCIAL DETAILS */}
      {assetClass === 'commercial' && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-900 border-b border-gray-200 pb-2">Commercial Specific Details</h3>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">RERA Number</label>
              <input name="reraNumber" defaultValue={initialData?.reraNumber || ""} className="mt-1 block w-full rounded-md border border-gray-300 p-2 shadow-sm focus:border-blue-500 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Carpet Area (Sq Ft)</label>
              <input type="number" step="0.01" name="carpetAreaSqFt" defaultValue={initialData?.carpetAreaSqFt || ""} className="mt-1 block w-full rounded-md border border-gray-300 p-2 shadow-sm focus:border-blue-500 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Built Up Area (Sq Ft)</label>
              <input type="number" step="0.01" name="builtUpAreaSqFt" defaultValue={initialData?.builtUpAreaSqFt || ""} className="mt-1 block w-full rounded-md border border-gray-300 p-2 shadow-sm focus:border-blue-500 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Super Built Up Area (Sq Ft)</label>
              <input type="number" step="0.01" name="superBuiltUpAreaSqFt" defaultValue={initialData?.superBuiltUpAreaSqFt || ""} className="mt-1 block w-full rounded-md border border-gray-300 p-2 shadow-sm focus:border-blue-500 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Floor Number</label>
              <input type="number" name="floorNumber" defaultValue={initialData?.floorNumber || ""} className="mt-1 block w-full rounded-md border border-gray-300 p-2 shadow-sm focus:border-blue-500 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">FAR Context</label>
              <input name="farContext" defaultValue={initialData?.farContext || ""} className="mt-1 block w-full rounded-md border border-gray-300 p-2 shadow-sm focus:border-blue-500 focus:ring-blue-500" />
            </div>
            <div className="flex items-center pt-6">
              <input type="checkbox" name="isTenanted" id="isTenanted" defaultChecked={initialData?.isTenanted} className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded" />
              <label htmlFor="isTenanted" className="ml-2 block text-sm font-medium text-gray-700">Is Tenanted</label>
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700">Lease Terms (required if tenanted)</label>
              <input name="leaseTerms" defaultValue={initialData?.leaseTerms || ""} className="mt-1 block w-full rounded-md border border-gray-300 p-2 shadow-sm focus:border-blue-500 focus:ring-blue-500" />
            </div>
          </div>
        </div>
      )}

      {/* LUXURY RESIDENTIAL DETAILS */}
      {assetClass === 'luxury_residential' && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-900 border-b border-gray-200 pb-2">Luxury Residential Details</h3>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Configuration</label>
              <input name="configuration" placeholder="4BHK + Study" defaultValue={initialData?.configuration || ""} className="mt-1 block w-full rounded-md border border-gray-300 p-2 shadow-sm focus:border-blue-500 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Possession Status</label>
              <select name="possessionStatus" defaultValue={initialData?.possessionStatus || "under_construction"} className="mt-1 block w-full rounded-md border border-gray-300 p-2 shadow-sm focus:border-blue-500 focus:ring-blue-500">
                <option value="under_construction">Under Construction</option>
                <option value="near_possession">Near Possession</option>
                <option value="ready_to_move">Ready to Move</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">RERA Number</label>
              <input name="reraNumber" defaultValue={initialData?.reraNumber || ""} className="mt-1 block w-full rounded-md border border-gray-300 p-2 shadow-sm focus:border-blue-500 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">RERA Completion Date</label>
              <input type="date" name="reraCompletionDate" defaultValue={initialData?.reraCompletionDate || ""} className="mt-1 block w-full rounded-md border border-gray-300 p-2 shadow-sm focus:border-blue-500 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">OC Status</label>
              <select name="ocStatus" defaultValue={initialData?.ocStatus || "not_applied"} className="mt-1 block w-full rounded-md border border-gray-300 p-2 shadow-sm focus:border-blue-500 focus:ring-blue-500">
                <option value="not_applied">Not Applied</option>
                <option value="applied">Applied</option>
                <option value="received">Received</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">CC Status</label>
              <select name="ccStatus" defaultValue={initialData?.ccStatus || "not_applied"} className="mt-1 block w-full rounded-md border border-gray-300 p-2 shadow-sm focus:border-blue-500 focus:ring-blue-500">
                <option value="not_applied">Not Applied</option>
                <option value="applied">Applied</option>
                <option value="received">Received</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* PRICING OVERRIDE */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900 border-b border-gray-200 pb-2">Pricing Overrides</h3>
        <p className="text-sm text-gray-500 mb-2">Leave blank to use the active price version and computed premiums.</p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Override List Price (₹)</label>
            <input type="number" step="0.01" name="overridePriceRupees" defaultValue={initialData?.overridePricePaise ? Number(initialData.overridePricePaise) / 100 : ""} className="mt-1 block w-full rounded-md border border-gray-300 p-2 shadow-sm focus:border-blue-500 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Override Reason</label>
            <input name="overrideReason" defaultValue={initialData?.overrideReason || ""} className="mt-1 block w-full rounded-md border border-gray-300 p-2 shadow-sm focus:border-blue-500 focus:ring-blue-500" />
          </div>
        </div>
      </div>

      <div className="flex justify-end border-t border-gray-200 pt-4">
        <button type="submit" disabled={isPending} className="bg-blue-600 text-white font-medium px-5 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors">
          {isPending ? "Saving..." : "Save Unit"}
        </button>
      </div>
    </form>
  );
}
