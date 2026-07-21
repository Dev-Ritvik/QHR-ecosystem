'use client';

import { useState, useTransition } from 'react';
import { updateClientKyc } from '@/server/actions/clients';

type KycFormProps = {
  clientId: string;
  panMasked?: string | null;
  aadhaarMasked?: string | null;
};

export function KycForm({ clientId, panMasked, aadhaarMasked }: KycFormProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = (formData: FormData) => {
    setError(''); 
    setSuccess('');
    
    const pan = formData.get('pan') as string;
    const aadhaar = formData.get('aadhaar') as string;
    
    if (!pan && !aadhaar) return;

    startTransition(async () => {
      const res = await updateClientKyc(clientId, { pan, aadhaar });
      if (res.ok) {
        setSuccess('KYC references securely masked and saved.');
      } else {
        setError('issues' in res && res.issues ? 'Validation failed: Check formats.' : ('message' in res && res.message ? res.message : 'Failed to update KYC'));
      }
    });
  };

  return (
    <div className="bg-card p-4 border rounded-md shadow-sm">
      <div className="mb-4 text-sm text-muted-foreground">
        <p>Current PAN: <span className="font-mono text-foreground">{panMasked || 'Not provided'}</span></p>
        <p>Current Aadhaar: <span className="font-mono text-foreground">{aadhaarMasked || 'Not provided'}</span></p>
      </div>
      
      <form action={handleSubmit} className="space-y-4 max-w-sm">
        <div>
          <label htmlFor="pan" className="block text-sm font-medium mb-1">Enter raw PAN to update (Masked on save)</label>
          <input 
            type="text" 
            id="pan" 
            name="pan" 
            placeholder="ABCDE1234F" 
            className="w-full border rounded-md p-2 text-sm uppercase" 
            disabled={isPending}
          />
        </div>
        
        <div>
          <label htmlFor="aadhaar" className="block text-sm font-medium mb-1">Enter raw Aadhaar to update</label>
          <input 
            type="text" 
            id="aadhaar" 
            name="aadhaar" 
            placeholder="123456789012" 
            className="w-full border rounded-md p-2 text-sm" 
            disabled={isPending}
          />
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}
        {success && <p className="text-sm text-green-600">{success}</p>}

        <button 
          type="submit" 
          disabled={isPending}
          className="bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium disabled:opacity-50"
        >
          {isPending ? 'Saving...' : 'Secure & Mask Identifiers'}
        </button>
      </form>
    </div>
  );
}
