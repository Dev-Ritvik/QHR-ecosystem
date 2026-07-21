import { getRoleContext } from '@/server/session';
import { authedQuery } from '@/server/db';
import { userSettings } from '@estate/db/schema/core/user-settings';
import { coreSchema } from '@estate/db';
import { eq } from 'drizzle-orm';
import { UserSettingsForm } from '@/components/settings/UserSettingsForm';
import { redirect } from 'next/navigation';

export default async function ProfilePage() {
  const context = await getRoleContext();
  if (!context) redirect('/login');

  const { settings, user } = await authedQuery(context, async (tx) => {
    const settings = await tx.query.userSettings.findFirst({
      where: eq(userSettings.userId, context.userId)
    });
    const user = await tx.query.users.findFirst({
      where: eq(coreSchema.users.id, context.userId)
    });
    return { settings, user };
  });

  if (!user) return null;

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">My Profile</h1>
        <p className="text-muted-foreground mt-1">Manage your personal settings and notification preferences.</p>
      </div>

      <div className="bg-card border rounded-lg p-6 max-w-md space-y-2">
        <p className="text-sm">
          <span className="font-medium text-muted-foreground w-24 inline-block">Name:</span> 
          {user.name}
        </p>
        <p className="text-sm">
          <span className="font-medium text-muted-foreground w-24 inline-block">Phone:</span> 
          <span className="font-mono">{user.phone}</span>
        </p>
        <p className="text-sm">
          <span className="font-medium text-muted-foreground w-24 inline-block">Email:</span> 
          {user.email ? user.email : <span className="italic text-muted-foreground">Not set</span>}
        </p>
        <p className="text-sm">
          <span className="font-medium text-muted-foreground w-24 inline-block">Role:</span> 
          <span className="capitalize">{user.role}</span>
        </p>
      </div>

      <UserSettingsForm initialEmailDigest={settings?.emailDigest ?? false} />
    </div>
  );
}
