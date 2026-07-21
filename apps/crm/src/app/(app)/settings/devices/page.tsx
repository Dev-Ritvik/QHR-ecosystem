import { authedQuery } from '@/server/db';
import { coreSchema as schema } from '@estate/db';
import { desc, eq } from 'drizzle-orm';
import { EnrollDeviceModal } from '@/components/devices/EnrollDeviceModal';
import { RevokeDeviceButton } from '@/components/devices/RevokeDeviceButton';
import { getRoleContext } from '@/server/session';

export default async function DevicesSettingsPage() {
  const context = await getRoleContext();
  if (!context) {
    return <div className="p-8 text-center">Not authenticated</div>;
  }

  const devices = await authedQuery(context, async (tx: any) => {
    return await tx.select({
      id: schema.presentationDevices.id,
      label: schema.presentationDevices.label,
      approvedAt: schema.presentationDevices.approvedAt,
      lastSeenAt: schema.presentationDevices.lastSeenAt,
      revokedAt: schema.presentationDevices.revokedAt,
      approvedByName: schema.users.name,
    })
    .from(schema.presentationDevices)
    .leftJoin(schema.users, eq(schema.presentationDevices.approvedById, schema.users.id))
    .orderBy(desc(schema.presentationDevices.createdAt));
  });

  return (
    <div className="max-w-5xl mx-auto py-8 px-4">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Presentation Devices</h1>
          <p className="text-slate-500 mt-1">
            Manage active office displays authorized to show pricing information.
          </p>
        </div>
        <EnrollDeviceModal />
      </div>

      <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
        {devices.length === 0 ? (
          <div className="p-8 text-center text-slate-500">
            No presentation devices are currently enrolled.
          </div>
        ) : (
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-3 font-medium text-slate-600">Device Label</th>
                <th className="px-6 py-3 font-medium text-slate-600">Status</th>
                <th className="px-6 py-3 font-medium text-slate-600">Approved By</th>
                <th className="px-6 py-3 font-medium text-slate-600">Approved At</th>
                <th className="px-6 py-3 font-medium text-slate-600">Last Seen</th>
                <th className="px-6 py-3 font-medium text-slate-600 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {devices.map((device: any) => {
                const isActive = !device.revokedAt;
                
                return (
                  <tr key={device.id} className={!isActive ? 'bg-slate-50 opacity-75' : ''}>
                    <td className="px-6 py-4 font-medium text-slate-900">
                      {device.label}
                    </td>
                    <td className="px-6 py-4">
                      {isActive ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-800">
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-800">
                          Revoked
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-slate-600">
                      {device.approvedByName || 'Unknown'}
                    </td>
                    <td className="px-6 py-4 text-slate-600">
                      {device.approvedAt?.toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-slate-600">
                      {device.lastSeenAt ? device.lastSeenAt.toLocaleDateString() : 'Never'}
                    </td>
                    <td className="px-6 py-4 text-right">
                      {isActive && <RevokeDeviceButton id={device.id} />}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
