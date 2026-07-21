"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteUnit } from "@/server/actions/units";

type DeleteUnitButtonProps = {
  projectId: string;
  unitId: string;
  unitNumber: string;
};

export function DeleteUnitButton({ projectId, unitId, unitNumber }: DeleteUnitButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleDelete = () => {
    setError(null);
    if (!confirm(
      `Delete unit ${unitNumber}? This cannot be undone.\n\n` +
      `Units referenced by holds, bookings, documents, or status history cannot be deleted.`
    )) return;

    startTransition(async () => {
      const res = await deleteUnit(projectId, unitId);
      if (res.ok) {
        router.refresh();
      } else {
        setError(res.message || "Failed to delete unit");
      }
    });
  };

  return (
    <span className="inline-flex flex-col items-end">
      <button
        type="button"
        onClick={handleDelete}
        disabled={isPending}
        className="text-sm font-medium text-red-600 hover:text-red-900 disabled:opacity-50"
      >
        {isPending ? "Deleting..." : "Delete"}
      </button>
      {error && (
        <span className="mt-1 max-w-xs text-right text-xs text-red-600" role="alert">
          {error}
        </span>
      )}
    </span>
  );
}
