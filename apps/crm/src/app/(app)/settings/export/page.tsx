// apps/crm/src/app/(app)/settings/export/page.tsx
import { getRoleContext } from '@/server/session';
import { SettingsNav } from '@/components/settings/SettingsNav';
import { DataExportPanel } from '@/components/settings/DataExportPanel';

export default async function DataExportPage() {
  const context = await getRoleContext();

  if (!context || context.role !== 'owner') {
    return <div className="p-6 text-destructive">Unauthorized. Owner access required.</div>;
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-1">Manage office rules, users, and connected devices.</p>
      </div>

      <SettingsNav />

      <DataExportPanel />
    </div>
  );
}
