// apps/crm/src/components/units/StatusBadge.tsx
import { getOwnerStatusLabel } from "@estate/domain/src/unit-status/presentation-label";

export function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    available: "bg-green-100 text-green-800 border-green-200",
    on_hold: "bg-blue-100 text-blue-800 border-blue-200",
    booked: "bg-blue-100 text-blue-800 border-blue-200",
    registered: "bg-gray-100 text-gray-800 border-gray-200",
    sold: "bg-gray-100 text-gray-800 border-gray-200",
    not_for_sale: "bg-amber-100 text-amber-900 border-amber-300",
    mortgage: "bg-amber-100 text-amber-900 border-amber-300",
  };

  const className = colors[status] || "bg-gray-100 text-gray-800 border-gray-200";
  const label = getOwnerStatusLabel(status as any);

  return (
    <span className={`px-2.5 py-1 rounded-full text-xs font-medium border whitespace-nowrap ${className}`}>
      {label}
    </span>
  );
}
