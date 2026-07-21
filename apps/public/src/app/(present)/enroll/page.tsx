import { EnrollClient } from './EnrollClient';

export default function EnrollPage() {
  if (process.env.NEXT_PUBLIC_DEVICE_ENROLLMENT_ENABLED !== 'true') {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-900 text-slate-400 font-mono text-sm">
        Device enrollment is disabled. Prices are globally visible.
      </div>
    );
  }

  return <EnrollClient />;
}
