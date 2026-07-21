import type { InferSelectModel, InferInsertModel } from 'drizzle-orm';

// Export RLS context wrapper + types (the ONLY public query API for core)
export { createAuthedCoreAccess, coreSchema } from './client-core';
export type { AppSession, CoreTransaction } from './client-core';

// Export projection factory (no RLS — public-facing read-only)
export * from './client-projection';

// Export core schemas for querying
export * from './schema/core/enums';
export * from './schema/core/auth';
export * from './schema/core/projects';
export * from './schema/core/price-versions';
export * from './schema/core/units';
export * from './schema/core/unit-details-land';
export * from './schema/core/unit-details-commercial';
export * from './schema/core/unit-details-luxury';
export * from './schema/core/clients';
export * from './schema/core/leads';
export * from './schema/core/lead-events';
export * from './schema/core/holds';
export * from './schema/core/bookings';
export * from './schema/core/unit-status-events';
export * from './schema/core/site-visits';
export * from './schema/core/documents';
export * from './schema/core/payment-ledger';
export * from './schema/core/commission-rules';
export * from './schema/core/commission-entries';
export * from './schema/core/commission-overrides';
export * from './schema/core/geometry-versions';
export * from './schema/core/unit-geometries';
export * from './schema/core/pois';
export * from './schema/core/audit-log';
export * from './schema/core/media';
export * from './schema/core/notifications';
export * from './schema/core/office-settings';
export * from './schema/core/user-settings';

// Export projection schemas
export { pubAssetClass, pubPresentationStatus, pubFeatureType, pubMediaKind } from './schema/projection/enums';
export * from './schema/projection/projects-pub';
export * from './schema/projection/units-pub';
export * from './schema/projection/geometry-pub';
export * from './schema/projection/pois-pub';
export * from './schema/projection/media-manifests';

// Export inferred types for end-to-end type safety (NFR-E2)
import { users } from './schema/core/auth';
import { projects } from './schema/core/projects';
import { units } from './schema/core/units';
import { leads } from './schema/core/leads';
import { holds } from './schema/core/holds';
import { bookings } from './schema/core/bookings';
import { paymentLedger } from './schema/core/payment-ledger';
import { media } from './schema/core/media';
import { notifications } from './schema/core/notifications';

import { projectsPub } from './schema/projection/projects-pub';
import { unitsPub } from './schema/projection/units-pub';
import { geometryPub } from './schema/projection/geometry-pub';

export type User = InferSelectModel<typeof users>;
export type NewUser = InferInsertModel<typeof users>;

export type Project = InferSelectModel<typeof projects>;
export type NewProject = InferInsertModel<typeof projects>;

export type Unit = InferSelectModel<typeof units>;
export type NewUnit = InferInsertModel<typeof units>;

export type Lead = InferSelectModel<typeof leads>;
export type NewLead = InferInsertModel<typeof leads>;

export type Hold = InferSelectModel<typeof holds>;
export type NewHold = InferInsertModel<typeof holds>;

export type Booking = InferSelectModel<typeof bookings>;
export type NewBooking = InferInsertModel<typeof bookings>;

export type PaymentLedgerEntry = InferSelectModel<typeof paymentLedger>;
export type NewPaymentLedgerEntry = InferInsertModel<typeof paymentLedger>;

export type Media = InferSelectModel<typeof media>;
export type NewMedia = InferInsertModel<typeof media>;

export type ProjectPub = InferSelectModel<typeof projectsPub>;
export type UnitPub = InferSelectModel<typeof unitsPub>;
export type GeometryPub = InferSelectModel<typeof geometryPub>;
export type Notification = InferSelectModel<typeof notifications>;

import { officeSettings } from './schema/core/office-settings';
import { userSettings } from './schema/core/user-settings';

export type OfficeSetting = InferSelectModel<typeof officeSettings>;
export type NewOfficeSetting = InferInsertModel<typeof officeSettings>;

export type UserSetting = InferSelectModel<typeof userSettings>;
export type NewUserSetting = InferInsertModel<typeof userSettings>;
