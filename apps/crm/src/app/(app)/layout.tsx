import { AppShell } from '@/components/shell/AppShell';
import { RoleProvider } from '@/components/shell/RoleContext';
import { GlobalSearch } from '@/components/shell/GlobalSearch';
import { NotificationBell } from '@/components/shell/NotificationBell';
import { getSession } from '@/server/session';
import { redirect } from 'next/navigation';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) {
    redirect('/login');
  }

  const roleCtx = {
    userId: session.user.id,
    role: (session.user as any).role as "owner" | "agent",
    name: session.user.name
  };

  return (
    <RoleProvider value={roleCtx}>
      <AppShell>
        <div className="flex items-center justify-end gap-4 mb-6">
          <NotificationBell />
          <GlobalSearch />
        </div>
        {children}
      </AppShell>
    </RoleProvider>
  );
}
