'use client';

import { useState } from 'react';
import { enrollDevice } from '@/server/actions/devices';

export function EnrollDeviceModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const formData = new FormData(e.currentTarget);
    const data = {
      label: formData.get('label') as string,
      shortCode: formData.get('shortCode') as string,
    };

    const result = await enrollDevice(data);

    setIsSubmitting(false);
    if (result.ok) {
      setIsOpen(false);
    } else {
      setError('message' in result && result.message ? result.message : 'Validation failed. Check the short code length.');
    }
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="bg-slate-900 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-slate-800 transition-colors"
      >
        Connect TV / Presentation Device
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-5 border-b border-slate-100">
              <h3 className="text-lg font-semibold text-slate-900">Approve Presentation Device</h3>
              <p className="text-sm text-slate-500 mt-1">
                Enter the 6-character short code displayed on the TV screen to grant pricing access.
              </p>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6">
              <div className="space-y-4">
                <div>
                  <label htmlFor="shortCode" className="block text-sm font-medium text-slate-700 mb-1">
                    Short Code
                  </label>
                  <input
                    id="shortCode"
                    name="shortCode"
                    type="text"
                    required
                    maxLength={6}
                    placeholder="e.g. 8X4A9P"
                    className="w-full uppercase px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:ring-slate-900 focus:border-slate-900 uppercase font-mono tracking-widest"
                  />
                </div>

                <div>
                  <label htmlFor="label" className="block text-sm font-medium text-slate-700 mb-1">
                    Device Label
                  </label>
                  <input
                    id="label"
                    name="label"
                    type="text"
                    required
                    placeholder="e.g. Office TV - Reception"
                    className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:ring-slate-900 focus:border-slate-900"
                  />
                </div>

                {error && <p className="text-sm text-red-600">{error}</p>}
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 rounded-md border border-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 text-sm font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-md disabled:opacity-50"
                >
                  {isSubmitting ? 'Enrolling...' : 'Approve Device'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
