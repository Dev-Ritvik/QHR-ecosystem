import { authedQuery } from '@/server/db';
import { getRoleContext } from '@/server/session';
import { coreSchema as core } from '@estate/db';
import { UserManagementList } from '@/components/settings/UserManagementList';
import { InviteUserDialog } from '@/components/settings/InviteUserDialog';
import { SettingsNav } from '@/components/settings/SettingsNav';

export default async function UserManagementPage() {
  const context = await getRoleContext();

  if (!context || context.role !== 'owner') {
    return <div className="p-6 text-destructive">Unauthorized. Owner access required.</div>;
  }

  const allUsers = await authedQuery(context, async (tx: any) => {
    return await tx.query.users.findMany({
      orderBy: (u: any, { asc }: any) => [asc(u.name)]
    });
  });

  const serializedUsers = allUsers.map((u: any) => ({
    id: u.id,
    name: u.name,
    phone: u.phone,
    role: u.role,
    isDeactivated: u.deactivatedAt !== null
  }));

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-1">Manage office rules, users, and connected devices.</p>
      </div>

      <SettingsNav />

      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-lg font-medium">Team Members</h2>
            <p className="text-sm text-muted-foreground">Invite agents or deactivate former employees.</p>
          </div>
          <InviteUserDialog />
        </div>

        <UserManagementList users={serializedUsers} currentUserId={context.userId} />
      </div>
    </div>
  );
}
