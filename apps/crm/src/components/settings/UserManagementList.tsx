'use client';

import { useTransition } from 'react';
import { toggleUserStatus } from '@/server/actions/users';

type User = {
  id: string;
  name: string;
  phone: string;
  role: 'owner' | 'agent';
  isDeactivated: boolean;
};

export function UserManagementList({ users, currentUserId }: { users: User[], currentUserId: string }) {
  const [isPending, startTransition] = useTransition();

  const handleToggle = (userId: string, currentlyDeactivated: boolean) => {
    startTransition(async () => {
      await toggleUserStatus(userId, currentlyDeactivated ? 'active' : 'deactivated');
    });
  };

  return (
    <div className="border rounded-md overflow-hidden bg-card">
      <table className="w-full text-sm text-left">
        <thead className="bg-muted">
          <tr>
            <th className="px-4 py-3 font-medium">User</th>
            <th className="px-4 py-3 font-medium">Phone</th>
            <th className="px-4 py-3 font-medium">Role</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 font-medium text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {users.map(u => (
            <tr key={u.id} className={u.isDeactivated ? 'opacity-50 bg-muted/50' : ''}>
              <td className="px-4 py-3 font-medium">
                {u.name} {u.id === currentUserId && <span className="text-xs text-muted-foreground ml-2">(You)</span>}
              </td>
              <td className="px-4 py-3 text-muted-foreground">{u.phone}</td>
              <td className="px-4 py-3 capitalize">{u.role}</td>
              <td className="px-4 py-3">
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium capitalize 
                  ${u.isDeactivated ? 'bg-destructive/10 text-destructive' : 'bg-green-100 text-green-800'}`}>
                  {u.isDeactivated ? 'Deactivated' : 'Active'}
                </span>
              </td>
              <td className="px-4 py-3 text-right">
                {u.id !== currentUserId && (
                  <button 
                    onClick={() => handleToggle(u.id, u.isDeactivated)}
                    disabled={isPending}
                    className="text-xs font-medium text-muted-foreground hover:text-foreground hover:underline disabled:opacity-50"
                  >
                    {u.isDeactivated ? 'Reactivate' : 'Deactivate'}
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
