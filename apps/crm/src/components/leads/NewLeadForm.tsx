'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createLead } from '@/server/actions/leads';
import { Button } from '@/components/ui/button';

const SOURCES = [
  { value: 'walk_in', label: 'Walk-in' },
  { value: 'website', label: 'Website' },
  { value: 'portal_99acres', label: '99acres' },
  { value: 'portal_magicbricks', label: 'MagicBricks' },
  { value: 'portal_housing', label: 'Housing.com' },
  { value: 'referral', label: 'Referral' },
  { value: 'channel_partner', label: 'Channel Partner' },
  { value: 'other', label: 'Other' },
];

export function NewLeadForm() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [issues, setIssues] = useState<Record<string, string[]>>({});

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    setIssues({});

    const fd = new FormData(e.currentTarget);
    const payload: Record<string, unknown> = {
      name: fd.get('name'),
      phone: fd.get('phone'),
      source: fd.get('source'),
      interests: [],
    };
    // Optional fields: omit when empty so zod .optional() applies
    for (const key of ['altPhone', 'email', 'sourceDetail', 'assetClassInterest', 'timelineExpectation']) {
      const value = fd.get(key);
      if (value) payload[key] = value;
    }

    const res = await createLead(payload as any);
    if (res.ok) {
      router.push('/leads');
      router.refresh();
    } else {
      if ('issues' in res && res.issues) setIssues(res.issues as any);
      setError(res.code === 'VALIDATION_FAILED' ? 'Please correct the highlighted fields.' : 'Failed to create lead.');
      setIsSubmitting(false);
    }
  }

  const fieldError = (key: string) => issues[key]?.[0];

  return (
    <form onSubmit={handleSubmit} className="space-y-5 bg-white p-6 rounded-lg border shadow-sm max-w-2xl">
      {error && <div className="bg-red-50 text-red-700 p-3 rounded-md text-sm">{error}</div>}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Name *</label>
          <input name="name" required className="mt-1 block w-full rounded-md border border-gray-300 p-2 shadow-sm" placeholder="Customer name" />
          {fieldError('name') && <p className="text-xs text-red-600 mt-1">{fieldError('name')}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Phone *</label>
          <input name="phone" required className="mt-1 block w-full rounded-md border border-gray-300 p-2 shadow-sm" placeholder="+919876543210" />
          {fieldError('phone') && <p className="text-xs text-red-600 mt-1">{fieldError('phone')}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Alternate Phone</label>
          <input name="altPhone" className="mt-1 block w-full rounded-md border border-gray-300 p-2 shadow-sm" placeholder="+91..." />
          {fieldError('altPhone') && <p className="text-xs text-red-600 mt-1">{fieldError('altPhone')}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Email</label>
          <input name="email" type="email" className="mt-1 block w-full rounded-md border border-gray-300 p-2 shadow-sm" />
          {fieldError('email') && <p className="text-xs text-red-600 mt-1">{fieldError('email')}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Source *</label>
          <select name="source" defaultValue="walk_in" className="mt-1 block w-full rounded-md border border-gray-300 p-2 shadow-sm">
            {SOURCES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Source Detail</label>
          <input name="sourceDetail" className="mt-1 block w-full rounded-md border border-gray-300 p-2 shadow-sm" placeholder="e.g. referred by Mr. Rao" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Interested In</label>
          <select name="assetClassInterest" defaultValue="" className="mt-1 block w-full rounded-md border border-gray-300 p-2 shadow-sm">
            <option value="">Not specified</option>
            <option value="land">Land / Plots</option>
            <option value="commercial">Commercial</option>
            <option value="luxury_residential">Luxury Residential</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Timeline Expectation</label>
          <input name="timelineExpectation" className="mt-1 block w-full rounded-md border border-gray-300 p-2 shadow-sm" placeholder="e.g. within 3 months" />
        </div>
      </div>

      <div className="flex items-center justify-end gap-3 border-t pt-4">
        <Link href="/leads" className="text-sm text-gray-500 hover:text-gray-900">Cancel</Link>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Creating...' : 'Create Lead'}
        </Button>
      </div>
    </form>
  );
}
