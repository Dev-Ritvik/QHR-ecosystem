// apps/crm/src/components/settings/DataExportPanel.tsx
'use client';

import { useState } from 'react';
import { exportLeadsCSV, exportDealsCSV, exportLedgerCSV } from '@/server/actions/export';

export function DataExportPanel() {
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string>('');

  const handleExport = async (
    type: string, 
    action: () => Promise<{ ok: true; data: string; filename: string } | { ok: false; message?: string }>
  ) => {
    setLoading(type);
    setError('');
    try {
      const res = await action();
      if (res.ok) {
        const blob = new Blob([res.data], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', res.filename);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      } else {
        setError(res.message || 'Export failed.');
      }
    } catch (err) {
      setError('An unexpected error occurred during export.');
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="bg-card border rounded-lg p-6 max-w-2xl space-y-6">
      <div>
        <h3 className="font-semibold text-lg">Data Exports</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Download CSV extracts of core system data. All exports are logged in the audit trail.
        </p>
      </div>

      {error && <p className="text-sm font-medium text-destructive">{error}</p>}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="border p-4 rounded-md flex flex-col justify-between space-y-4">
          <div>
            <h4 className="font-medium text-sm">Leads Database</h4>
            <p className="text-xs text-muted-foreground mt-1">Active pipeline, source data, and agent assignments.</p>
          </div>
          <button
            onClick={() => handleExport('leads', exportLeadsCSV)}
            disabled={loading !== null}
            className="w-full bg-secondary text-secondary-foreground px-3 py-2 rounded-md text-sm font-medium hover:bg-secondary/80 disabled:opacity-50 transition-colors"
          >
            {loading === 'leads' ? 'Exporting...' : 'Export Leads CSV'}
          </button>
        </div>

        <div className="border p-4 rounded-md flex flex-col justify-between space-y-4">
          <div>
            <h4 className="font-medium text-sm">Deals & Bookings</h4>
            <p className="text-xs text-muted-foreground mt-1">Bookings, associated units, consideration amounts, and status.</p>
          </div>
          <button
            onClick={() => handleExport('deals', exportDealsCSV)}
            disabled={loading !== null}
            className="w-full bg-secondary text-secondary-foreground px-3 py-2 rounded-md text-sm font-medium hover:bg-secondary/80 disabled:opacity-50 transition-colors"
          >
            {loading === 'deals' ? 'Exporting...' : 'Export Deals CSV'}
          </button>
        </div>

        <div className="border p-4 rounded-md flex flex-col justify-between space-y-4">
          <div>
            <h4 className="font-medium text-sm">Payment Ledger</h4>
            <p className="text-xs text-muted-foreground mt-1">Immutable transaction history across all bookings.</p>
          </div>
          <button
            onClick={() => handleExport('ledger', exportLedgerCSV)}
            disabled={loading !== null}
            className="w-full bg-secondary text-secondary-foreground px-3 py-2 rounded-md text-sm font-medium hover:bg-secondary/80 disabled:opacity-50 transition-colors"
          >
            {loading === 'ledger' ? 'Exporting...' : 'Export Ledger CSV'}
          </button>
        </div>
      </div>
    </div>
  );
}
