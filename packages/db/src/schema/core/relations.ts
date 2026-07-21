import { relations } from 'drizzle-orm';
import { users } from './auth';
import { projects } from './projects';
import { units } from './units';
import { clients } from './clients';
import { leads } from './leads';
import { holds } from './holds';
import { bookings } from './bookings';
import { documents } from './documents';
import { paymentLedger } from './payment-ledger';

// Drizzle relational-query definitions for every `with:` used in the apps.
// Without these, any `db.query.<table>.find*({ with: ... })` throws
// "Cannot read properties of undefined (reading 'referencedTable')".

export const bookingsRelations = relations(bookings, ({ one }) => ({
  unit: one(units, { fields: [bookings.unitId], references: [units.id] }),
  client: one(clients, { fields: [bookings.clientId], references: [clients.id] }),
  lead: one(leads, { fields: [bookings.leadId], references: [leads.id] }),
  agent: one(users, { fields: [bookings.agentId], references: [users.id] }),
}));

export const holdsRelations = relations(holds, ({ one }) => ({
  unit: one(units, { fields: [holds.unitId], references: [units.id] }),
  client: one(clients, { fields: [holds.clientId], references: [clients.id] }),
  lead: one(leads, { fields: [holds.leadId], references: [leads.id] }),
}));

export const documentsRelations = relations(documents, ({ one }) => ({
  project: one(projects, { fields: [documents.projectId], references: [projects.id] }),
  unit: one(units, { fields: [documents.unitId], references: [units.id] }),
  booking: one(bookings, { fields: [documents.bookingId], references: [bookings.id] }),
  client: one(clients, { fields: [documents.clientId], references: [clients.id] }),
}));

export const leadsRelations = relations(leads, ({ one }) => ({
  assignedAgent: one(users, { fields: [leads.assignedAgentId], references: [users.id] }),
  client: one(clients, { fields: [leads.clientId], references: [clients.id] }),
}));

export const paymentLedgerRelations = relations(paymentLedger, ({ one }) => ({
  booking: one(bookings, { fields: [paymentLedger.bookingId], references: [bookings.id] }),
}));

export const unitsRelations = relations(units, ({ one }) => ({
  project: one(projects, { fields: [units.projectId], references: [projects.id] }),
}));
