'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { bulkCreateUnits } from '@/server/actions/units';
import { Button } from '@/components/ui/button';

interface BulkUnitFormProps {
  projectId: string;
  assetClass: 'land' | 'commercial' | 'luxury_residential';
}

export function BulkUnitForm({ projectId, assetClass }: BulkUnitFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ prefix: string; start: string; count: string }>({ prefix: 'A-', start: '101', count: '10' });

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const fd = new FormData(e.currentTarget);
    const payload: Record<string, unknown> = {
      prefix: fd.get('prefix') ?? '',
      startNumber: fd.get('startNumber'),
      count: fd.get('count'),
    };
    for (const key of ['facing', 'areaSqYd', 'areaSqFt', 'roadWidthM', 'surveyNumber']) {
      const value = fd.get(key);
      if (value) payload[key] = value;
    }

    const res = await bulkCreateUnits(projectId, payload);
    if (res.ok) {
      router.push(`/projects/${projectId}/units`);
      router.refresh();
    } else {
      setError(res.message || 'Failed to create units');
      setIsSubmitting(false);
    }
  }

  const start = parseInt(preview.start, 10);
  const count = parseInt(preview.count, 10);
  const previewText =
    !isNaN(start) && !isNaN(count) && count > 0
      ? `${preview.prefix}${start} … ${preview.prefix}${start + count - 1} (${count} units)`
      : '—';

  return (
    <form onSubmit={handleSubmit} className="space-y-5 bg-white p-6 rounded-lg border shadow-sm max-w-2xl">
      {error && <div className="bg-red-50 text-red-700 p-3 rounded-md text-sm">{error}</div>}

      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Number Prefix</label>
          <input
            name="prefix"
            value={preview.prefix}
            onChange={(e) => setPreview(p => ({ ...p, prefix: e.target.value }))}
            className="mt-1 block w-full rounded-md border border-gray-300 p-2 shadow-sm"
            placeholder="e.g. A-"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Start Number *</label>
          <input
            name="startNumber"
            type="number"
            min="0"
            required
            value={preview.start}
            onChange={(e) => setPreview(p => ({ ...p, start: e.target.value }))}
            className="mt-1 block w-full rounded-md border border-gray-300 p-2 shadow-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">How Many? *</label>
          <input
            name="count"
            type="number"
            min="1"
            max="200"
            required
            value={preview.count}
            onChange={(e) => setPreview(p => ({ ...p, count: e.target.value }))}
            className="mt-1 block w-full rounded-md border border-gray-300 p-2 shadow-sm"
          />
        </div>
      </div>

      <p className="text-sm text-gray-600 bg-gray-50 border rounded p-2">
        Will create: <span className="font-medium">{previewText}</span>
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Facing</label>
          <select name="facing" defaultValue="" className="mt-1 block w-full rounded-md border border-gray-300 p-2 shadow-sm">
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
          <label className="block text-sm font-medium text-gray-700">Area (Sq Yd)</label>
          <input name="areaSqYd" type="number" step="0.01" min="0" className="mt-1 block w-full rounded-md border border-gray-300 p-2 shadow-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Area (Sq Ft)</label>
          <input name="areaSqFt" type="number" step="0.01" min="0" className="mt-1 block w-full rounded-md border border-gray-300 p-2 shadow-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Road Width (m)</label>
          <select name="roadWidthM" defaultValue="" className="mt-1 block w-full rounded-md border border-gray-300 p-2 shadow-sm">
            <option value="">Not specified</option>
            <option value="20">20 m</option>
            <option value="30">30 m</option>
            <option value="40">40 m</option>
            <option value="60">60 m</option>
          </select>
        </div>
      </div>

      {assetClass === 'land' && (
        <div>
          <label className="block text-sm font-medium text-gray-700">Survey Number *</label>
          <p className="text-xs text-gray-500 mb-1">Applied to every generated plot — edit individual plots afterwards if they differ.</p>
          <input name="surveyNumber" required className="mt-1 block w-full rounded-md border border-gray-300 p-2 shadow-sm" />
        </div>
      )}

      <p className="text-xs text-gray-500">
        Shared values apply to every generated unit. {assetClass !== 'land' && 'Asset-class details start with defaults — edit individual units for configuration, RERA, etc.'}
        {' '}Prices are computed from the active price version, like single-unit creation.
      </p>

      <div className="flex items-center justify-end gap-3 border-t pt-4">
        <Link href={`/projects/${projectId}/units`} className="text-sm text-gray-500 hover:text-gray-900">Cancel</Link>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Creating…' : 'Create Units'}
        </Button>
      </div>
    </form>
  );
}
