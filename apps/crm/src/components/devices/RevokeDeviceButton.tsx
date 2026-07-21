'use client';

import { useState } from 'react';
import { revokeDevice } from '@/server/actions/devices';

export function RevokeDeviceButton({ id }: { id: string }) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleRevoke = async () => {
    if (!confirm('Are you sure you want to revoke this device? It will immediately lose pricing access.')) {
      return;
    }

    setIsSubmitting(true);
    await revokeDevice(id);
    setIsSubmitting(false);
  };

  return (
    <button
      onClick={handleRevoke}
      disabled={isSubmitting}
      className="text-sm font-medium text-red-600 hover:text-red-700 disabled:opacity-50 px-3 py-1 rounded hover:bg-red-50 transition-colors"
    >
      {isSubmitting ? 'Revoking...' : 'Revoke'}
    </button>
  );
}
