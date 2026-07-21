'use client';

import { useState, useTransition } from 'react';
import { inviteUser } from '@/server/actions/users';

export function InviteUserDialog() {
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');

    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await inviteUser({
        name: formData.get('name') as string,
        phone: formData.get('phone') as string,
        email: (formData.get('email') as string) || undefined,
        role: formData.get('role') as 'owner' | 'agent',
      });

      if (res.ok) {
        setIsOpen(false);
      } else {
        setError(res.issues ? 'Validation failed. Ensure E.164 phone format (+91...).' : res.message || 'Failed to invite user');
      }
    });
  };

  return (
    <>
      <button 
        onClick={() => setIsOpen(true)}
        className="bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium hover:bg-primary/90 transition-colors"
      >
        Invite User
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-background rounded-lg shadow-lg w-full max-w-md p-6">
            <h2 className="text-lg font-semibold mb-4">Invite New User</h2>

            {error && <p className="text-sm text-destructive mb-4">{error}</p>}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Name</label>
                <input type="text" name="name" required className="w-full border p-2 rounded-md text-sm" />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Phone (E.164)</label>
                <input type="text" name="phone" placeholder="+919876543210" required className="w-full border p-2 rounded-md text-sm" />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Email (Optional)</label>
                <input type="email" name="email" className="w-full border p-2 rounded-md text-sm" />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Role</label>
                <select name="role" required className="w-full border p-2 rounded-md text-sm bg-background">
                  <option value="agent">Agent</option>
                  <option value="owner">Owner</option>
                </select>
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button 
                  type="button" 
                  onClick={() => setIsOpen(false)}
                  disabled={isPending}
                  className="px-4 py-2 text-sm font-medium hover:underline disabled:opacity-50"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={isPending}
                  className="bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium disabled:opacity-50"
                >
                  {isPending ? 'Inviting...' : 'Send Invite'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
