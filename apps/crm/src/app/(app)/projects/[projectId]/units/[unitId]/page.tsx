// apps/crm/src/app/(app)/projects/[projectId]/units/[unitId]/page.tsx
import { authedQuery } from '@/server/db';
import { projects, units, holds, clients, users, documents, bookings } from '@estate/db';
import { eq, and, isNull, inArray, desc } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import { StatusBadge } from '@/components/units/StatusBadge';
import { TransitionDialog } from '@/components/units/TransitionDialog';
import { HoldDialog } from '@/components/units/HoldDialog';
import { BookUnitDialog } from '@/components/units/BookUnitDialog';
import { DocumentChecklist } from '@/components/documents/DocumentChecklist';
import Link from 'next/link';
import { getRoleContext } from '@/server/session';

export default async function UnitDetailPage({ params }: { params: { projectId: string, unitId: string } }) {
  const context = await getRoleContext();
  if (!context) notFound();

  const emptyResult = {
    project: null as any, unit: null as any, activeHold: null as any, existingDocs: [] as any[],
    booking: null as any, bookingDocs: [] as any[], clientList: [] as any[], agentList: [] as any[],
  };

  const { project, unit, activeHold, existingDocs, booking, bookingDocs, clientList, agentList } =
    await authedQuery(context, async (tx) => {
    const [project] = await tx.select().from(projects).where(eq(projects.id, params.projectId));
    if (!project) return emptyResult;

    const [unit] = await tx.select().from(units).where(eq(units.id, params.unitId));
    if (!unit) return { ...emptyResult, project };

    const [activeHold] = await tx.select({
        id: holds.id,
        expiresAt: holds.expiresAt,
        clientName: clients.name,
        agentName: users.name
      })
      .from(holds)
      .leftJoin(clients, eq(holds.clientId, clients.id))
      .leftJoin(users, eq(holds.createdById, users.id))
      .where(and(
        eq(holds.unitId, unit.id),
        eq(holds.status, 'active')
      ));

    const existingDocs = await tx.select()
      .from(documents)
      .where(and(
        eq(documents.unitId, unit.id),
        eq(documents.scope, 'unit'),
        isNull(documents.archivedAt)
      ));

    // The live deal on this unit: an active booking, or the converted one
    // for registered/sold units (cancelled/defaulted deals don't count).
    const [booking] = await tx.select({
        id: bookings.id,
        status: bookings.status,
        tokenAmountPaise: bookings.tokenAmountPaise,
        considerationPaise: bookings.considerationPaise,
        bookedOn: bookings.bookedOn,
        registeredOn: bookings.registeredOn,
        buyerName: clients.name,
        buyerPhone: clients.phone,
        agentName: users.name,
      })
      .from(bookings)
      .leftJoin(clients, eq(bookings.clientId, clients.id))
      .leftJoin(users, eq(bookings.agentId, users.id))
      .where(and(
        eq(bookings.unitId, unit.id),
        inArray(bookings.status, ['active', 'converted'])
      ))
      .orderBy(desc(bookings.createdAt))
      .limit(1);

    const bookingDocs = booking
      ? await tx.select()
          .from(documents)
          .where(and(
            eq(documents.bookingId, booking.id),
            eq(documents.scope, 'booking'),
            isNull(documents.archivedAt)
          ))
      : [];

    const clientList = await tx.select({ id: clients.id, name: clients.name, phone: clients.phone })
      .from(clients)
      .orderBy(clients.name);

    const agentList = await tx.select({ id: users.id, name: users.name })
      .from(users)
      .where(and(inArray(users.role, ['agent', 'owner']), isNull(users.deactivatedAt)))
      .orderBy(users.name);

    return { project, unit, activeHold, existingDocs, booking, bookingDocs, clientList, agentList };
  });

  if (!project || !unit) notFound();

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-8">
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
        <Link href="/projects" className="hover:underline">Projects</Link>
        <span>/</span>
        <Link href={`/projects/${project.id}`} className="hover:underline">{project.name}</Link>
        <span>/</span>
        <Link href={`/projects/${project.id}/units`} className="hover:underline">Inventory</Link>
        <span>/</span>
        <span className="text-foreground">{unit.unitNumber}</span>
      </div>

      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b pb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Unit {unit.unitNumber}</h1>
          <div className="flex items-center gap-3 mt-2">
            <StatusBadge status={unit.status} />
            <span className="text-muted-foreground text-sm">
              {project.name} • {project.assetClass.replace('_', ' ')}
            </span>
          </div>
        </div>
        <div className="flex gap-2">
          {unit.status === 'available' && (
            <HoldDialog unitId={unit.id} />
          )}
          <BookUnitDialog
            unitId={unit.id}
            unitStatus={unit.status}
            clients={clientList}
            agents={agentList}
            defaultAgentId={context.userId}
          />
          <TransitionDialog unitId={unit.id} currentStatus={unit.status} />
        </div>
      </header>

      {booking && (
        <section className="bg-blue-50 border border-blue-200 rounded-xl p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">
                {booking.status === 'converted' ? 'Sold To' : 'Booked By'}
              </p>
              <p className="text-xl font-bold text-blue-950 mt-1">{booking.buyerName}</p>
              <p className="text-sm text-blue-900">{booking.buyerPhone}</p>
            </div>
            <Link href={`/bookings/${booking.id}`} className="text-sm text-blue-700 underline shrink-0">
              Full booking →
            </Link>
          </div>
          <dl className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 text-sm">
            <div>
              <dt className="text-blue-700">Token Amount</dt>
              <dd className="font-semibold text-blue-950">₹{(Number(booking.tokenAmountPaise) / 100).toLocaleString('en-IN')}</dd>
            </div>
            <div>
              <dt className="text-blue-700">Sale Price</dt>
              <dd className="font-semibold text-blue-950">
                {booking.considerationPaise
                  ? `₹${(Number(booking.considerationPaise) / 100).toLocaleString('en-IN')}`
                  : 'List price'}
              </dd>
            </div>
            <div>
              <dt className="text-blue-700">Booking Date</dt>
              <dd className="font-semibold text-blue-950">{booking.bookedOn}</dd>
            </div>
            <div>
              <dt className="text-blue-700">Agent</dt>
              <dd className="font-semibold text-blue-950">{booking.agentName}</dd>
            </div>
          </dl>
          {booking.registeredOn && (
            <p className="text-xs text-blue-800 mt-3">Registered on {booking.registeredOn}</p>
          )}
        </section>
      )}

      {activeHold && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="font-semibold text-orange-900">Currently on Hold</p>
            <p className="text-sm text-orange-800 mt-1">
              For {activeHold.clientName} (by {activeHold.agentName}) • Expires: {new Date(activeHold.expiresAt).toLocaleString()}
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <section className="space-y-4">
          <h2 className="text-xl font-semibold">Unit Details</h2>
          <dl className="space-y-2 border rounded-xl p-4 bg-card">
            <div className="flex justify-between py-1 border-b last:border-0">
              <dt className="text-muted-foreground text-sm">Facing</dt>
              <dd className="font-medium text-sm capitalize">{unit.facing?.replace('_', ' ') || 'N/A'}</dd>
            </div>
            <div className="flex justify-between py-1 border-b last:border-0">
              <dt className="text-muted-foreground text-sm">Corner Unit</dt>
              <dd className="font-medium text-sm">{unit.isCorner ? 'Yes' : 'No'}</dd>
            </div>
            <div className="flex justify-between py-1 border-b last:border-0">
              <dt className="text-muted-foreground text-sm">Road Width</dt>
              <dd className="font-medium text-sm">{unit.roadWidthM ? `${unit.roadWidthM}m` : 'N/A'}</dd>
            </div>
            <div className="flex justify-between py-1 border-b last:border-0">
              <dt className="text-muted-foreground text-sm">Dimensions</dt>
              <dd className="font-medium text-sm">{unit.dimensionsLabel || 'N/A'}</dd>
            </div>
            <div className="flex justify-between py-1 border-b last:border-0">
              <dt className="text-muted-foreground text-sm">Area (Sq Yd)</dt>
              <dd className="font-medium text-sm">{unit.areaSqYd || 'N/A'}</dd>
            </div>
            <div className="flex justify-between py-1 border-b last:border-0">
              <dt className="text-muted-foreground text-sm">Area (Sq Ft)</dt>
              <dd className="font-medium text-sm">{unit.areaSqFt || 'N/A'}</dd>
            </div>
          </dl>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold">Pricing Status</h2>
          <div className="border rounded-xl p-4 bg-card h-[calc(100%-2.5rem)]">
            {unit.computedPricePaise ? (
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground">Computed List Price</p>
                  <p className="text-2xl font-bold">₹{(Number(unit.computedPricePaise) / 100).toLocaleString('en-IN')}</p>
                </div>
                {unit.overridePricePaise && (
                  <div>
                    <p className="text-sm text-orange-600 font-semibold">Manual Override Active</p>
                    <p className="text-xl font-bold text-orange-700">₹{(Number(unit.overridePricePaise) / 100).toLocaleString('en-IN')}</p>
                    <p className="text-xs text-muted-foreground mt-1 text-balance">Reason: {unit.overrideReason}</p>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground flex h-full items-center justify-center">
                No active price version assigned. Compute pricing from the project pricing tab.
              </p>
            )}
          </div>
        </section>
      </div>

      {booking && (
        <section className="space-y-4 pt-6">
          <h2 className="text-xl font-semibold">Booking Documents</h2>
          <p className="text-sm text-muted-foreground">
            Agreement, ID proof and payment receipts for this deal. Uploads land in secure storage and open via audited links.
          </p>
          <DocumentChecklist
            scope="booking"
            bookingId={booking.id}
            existingDocs={bookingDocs}
          />
        </section>
      )}

      <section className="space-y-4 pt-6">
        <h2 className="text-xl font-semibold">Legal & Compliance Documents</h2>
        <DocumentChecklist
          unitId={unit.id}
          projectId={project.id}
          assetClass={project.assetClass as any}
          existingDocs={existingDocs}
        />
      </section>
    </div>
  );
}
