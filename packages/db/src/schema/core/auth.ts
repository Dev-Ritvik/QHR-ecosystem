import { sql } from 'drizzle-orm';
import { uuid, text, varchar, timestamp, uniqueIndex, index, check, integer, boolean } from 'drizzle-orm/pg-core';
import { core, userRole, createdAt, updatedAt } from './enums';

export const users = core.table(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    phone: varchar('phone', { length: 16 }).notNull(),
    email: varchar('email', { length: 320 }),
    role: userRole('role').notNull().default('agent'),
    deactivatedAt: timestamp('deactivated_at', { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => ({
    phoneLiveUq: uniqueIndex('users_phone_live_uq').on(t.phone).where(sql`deactivated_at IS NULL`),
    emailLiveUq: uniqueIndex('users_email_live_uq').on(t.email).where(sql`deactivated_at IS NULL AND email IS NOT NULL`),
    phoneFormat: check('users_phone_format', sql`phone ~ '^\\+[1-9][0-9]{7,14}$'`),
  }),
);

export const sessions = core.table(
  'sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    token: text('token').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    ipAddress: varchar('ip_address', { length: 45 }),
    userAgent: text('user_agent'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => ({
    tokenUq: uniqueIndex('sessions_token_uq').on(t.token),
    userIdx: index('sessions_user_idx').on(t.userId),
    expiryFuture: check('sessions_expiry_future', sql`expires_at > created_at`),
  }),
);

// Better Auth tables (shapes match the live core.accounts/verifications/passkeys
// tables verified 2026-07-16; ids are text with a gen_random_uuid() default).
export const accounts = core.table('accounts', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  idToken: text('id_token'),
  accessTokenExpiresAt: timestamp('access_token_expires_at', { withTimezone: true }),
  refreshTokenExpiresAt: timestamp('refresh_token_expires_at', { withTimezone: true }),
  scope: text('scope'),
  password: text('password'),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const verifications = core.table('verifications', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const passkeys = core.table('passkeys', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()`),
  name: text('name'),
  publicKey: text('public_key').notNull(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  credentialId: text('credential_id').notNull(),
  counter: integer('counter').notNull(),
  deviceType: text('device_type').notNull(),
  backedUp: boolean('backed_up').notNull(),
  transports: text('transports'),
  createdAt: createdAt(),
});

export const presentationDevices = core.table(
  'presentation_devices',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    label: text('label').notNull(),
    tokenHash: text('token_hash').notNull(),
    scopes: text('scopes').array().notNull().default(sql`ARRAY['projection:read','prices:read']`),
    approvedById: uuid('approved_by_id').notNull().references(() => users.id),
    approvedAt: timestamp('approved_at', { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => ({
    tokenUq: uniqueIndex('presentation_devices_token_uq').on(t.tokenHash)
  }),
);
