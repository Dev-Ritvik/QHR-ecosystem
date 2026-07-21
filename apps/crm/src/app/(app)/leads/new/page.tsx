import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getRoleContext } from '@/server/session';
import { NewLeadForm } from '@/components/leads/NewLeadForm';

export default async function NewLeadPage() {
  const context = await getRoleContext();
  if (!context) redirect('/login');

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/leads" className="text-gray-500 hover:text-gray-900 transition-colors">
          &larr; Back to Leads
        </Link>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">New Lead</h1>
          <p className="text-muted-foreground mt-1">Enter a lead from a phone call or walk-in. It will be assigned to you.</p>
        </div>
      </div>

      <NewLeadForm />
    </div>
  );
}
