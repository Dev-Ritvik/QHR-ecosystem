// apps/crm/src/components/audit/DiffViewer.tsx
'use client';

export function DiffViewer({ before, after }: { before: any, after: any }) {
  const b = before && typeof before === 'object' ? before : {};
  const a = after && typeof after === 'object' ? after : {};

  const allKeys = Array.from(new Set([...Object.keys(b), ...Object.keys(a)]));

  if (allKeys.length === 0) {
    return <span className="text-muted-foreground italic text-xs">No data payload</span>;
  }

  return (
    <div className="bg-muted/30 rounded-md p-3 space-y-1.5 text-xs font-mono overflow-x-auto border">
      {allKeys.map(key => {
        const oldVal = b[key];
        const newVal = a[key];
        const isRemoved = oldVal !== undefined && newVal === undefined;
        const isAdded = oldVal === undefined && newVal !== undefined;
        const isChanged = oldVal !== undefined && newVal !== undefined && JSON.stringify(oldVal) !== JSON.stringify(newVal);
        const isUnchanged = oldVal !== undefined && newVal !== undefined && JSON.stringify(oldVal) === JSON.stringify(newVal);

        const formatVal = (v: any) => typeof v === 'object' ? JSON.stringify(v) : String(v);

        if (isUnchanged) {
          return (
            <div key={key} className="text-muted-foreground flex gap-3 opacity-60">
              <span className="w-3 shrink-0"> </span>
              <span className="w-28 shrink-0 truncate font-semibold">{key}:</span>
              <span className="truncate">{formatVal(oldVal)}</span>
            </div>
          );
        }

        return (
          <div key={key} className="flex flex-col space-y-0.5">
            {(isRemoved || isChanged) && (
              <div className="text-destructive bg-destructive/10 flex gap-3 rounded px-1 py-0.5">
                <span className="w-3 shrink-0 text-center">-</span>
                <span className="w-28 shrink-0 truncate font-semibold">{key}:</span>
                <span className="break-all">{formatVal(oldVal)}</span>
              </div>
            )}
            {(isAdded || isChanged) && (
              <div className="text-green-700 bg-green-100 flex gap-3 rounded px-1 py-0.5">
                <span className="w-3 shrink-0 text-center">+</span>
                <span className="w-28 shrink-0 truncate font-semibold">{key}:</span>
                <span className="break-all">{formatVal(newVal)}</span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
