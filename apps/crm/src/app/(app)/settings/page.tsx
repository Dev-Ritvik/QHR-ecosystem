import { authedQuery } from '@/server/db';
import { getRoleContext } from '@/server/session';
import { officeSettings } from '@estate/db/schema/core/office-settings';
import { OfficeSettingsForm } from '@/components/settings/OfficeSettingsForm';
import { SettingsNav } from '@/components/settings/SettingsNav';

export default async function SettingsPage() {
  const context = await getRoleContext();

  if (!context || context.role !== 'owner') {
    return <div className="p-6 text-destructive">Unauthorized. Owner access required.</div>;
  }

  const [settings] = await authedQuery(context, async (tx: any) => {
    return await tx.select().from(officeSettings).limit(1);
  });

  if (!settings) {
    throw new Error('Office settings singleton not found. Ensure migration 0010 ran.');
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-1">Manage office rules, users, and connected devices.</p>
      </div>

      <SettingsNav />

      <OfficeSettingsForm 
        holdMaxDurationDays={settings.holdMaxDurationDays}
        overdueEscalationDays={settings.overdueEscalationDays}
        defaultSellingFastThresholdPct={settings.defaultSellingFastThresholdPct}
      />
    </div>
  );
}
