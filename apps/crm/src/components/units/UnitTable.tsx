"use client";

import Link from "next/link";
import { DeleteUnitButton } from "./DeleteUnitButton";
import { getOwnerStatusLabel } from "@estate/domain/src/unit-status/presentation-label";

type UnitTableProps = {
  projectId: string;
  units: any[];
};

export function UnitTable({ projectId, units }: UnitTableProps) {
  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden bg-white shadow-sm">
      <table className="w-full text-left text-sm">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="p-4 font-medium text-gray-600">Unit Number</th>
            <th className="p-4 font-medium text-gray-600">Status</th>
            <th className="p-4 font-medium text-gray-600">Area / Dimension</th>
            <th className="p-4 font-medium text-gray-600">Facing</th>
            <th className="p-4 font-medium text-gray-600">Price (Computed)</th>
            <th className="p-4 font-medium text-gray-600 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {units.map((unit) => {
            const pricePaise = unit.overridePricePaise || unit.computedPricePaise;
            const formattedPrice = pricePaise 
              ? `₹ ${(Number(pricePaise) / 100).toLocaleString('en-IN')}` 
              : '—';

            return (
              <tr key={unit.id} className="hover:bg-gray-50/50 transition-colors">
                <td className="p-4">
                  <Link href={`/projects/${projectId}/units/${unit.id}`} className="font-medium text-blue-600 hover:text-blue-800 hover:underline">
                    {unit.unitNumber}
                  </Link>
                  {unit.isCorner && <span className="ml-2 px-1.5 py-0.5 text-[10px] font-medium bg-purple-50 text-purple-700 border border-purple-200 rounded">Corner</span>}
                </td>
                <td className="p-4">
                  <span className="text-gray-700 font-medium">{getOwnerStatusLabel(unit.status)}</span>
                </td>
                <td className="p-4 text-gray-600">
                  {unit.dimensionsLabel || (unit.areaSqYd ? `${unit.areaSqYd} sq yd` : unit.areaSqFt ? `${unit.areaSqFt} sq ft` : '—')}
                </td>
                <td className="p-4 text-gray-600 capitalize">
                  {unit.facing?.replace(/_/g, ' ') || '—'}
                </td>
                <td className="p-4 text-gray-900 font-medium">
                  {formattedPrice}
                  {unit.overridePricePaise && <span className="ml-2 px-1.5 py-0.5 text-[10px] font-medium bg-amber-50 text-amber-700 border border-amber-200 rounded">Overridden</span>}
                </td>
                <td className="p-4 text-right whitespace-nowrap">
                  <Link
                    href={`/projects/${projectId}/units/${unit.id}/edit`}
                    className="text-sm font-medium text-blue-600 hover:text-blue-800 mr-4"
                  >
                    Edit
                  </Link>
                  <DeleteUnitButton projectId={projectId} unitId={unit.id} unitNumber={unit.unitNumber} />
                </td>
              </tr>
            );
          })}
          {units.length === 0 && (
            <tr>
              <td colSpan={6} className="p-8 text-center text-gray-500">
                No units found in this project inventory. Add a new unit to begin.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
