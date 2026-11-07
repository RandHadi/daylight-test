import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
export const planners = sqliteTable('planners', {
  userId: text('user_id').primaryKey(),
  payload: text('payload').notNull(),
  revision: integer('revision').notNull().default(1),
  updatedAt: integer('updated_at').notNull(),
});

// Provider credentials never live in the planner JSON or browser storage.
export const googleConnections = sqliteTable('google_connections', {
  userId: text('user_id').primaryKey(),
  encryptedTokens: text('encrypted_tokens').notNull(),
  email: text('email').notNull(),
  scopes: text('scopes').notNull(),
  calendars: text('calendars').notNull().default('[]'),
  selected: text('selected').notNull().default('[]'),
  revision: integer('revision').notNull().default(1),
  updatedAt: integer('updated_at').notNull(),
});
export const googleOAuthAttempts = sqliteTable('google_oauth_attempts', {
  stateHash: text('state_hash').primaryKey(),
  userId: text('user_id').notNull(),
  encryptedVerifier: text('encrypted_verifier').notNull(),
  mode: text('mode').notNull(),
  expiresAt: integer('expires_at').notNull(),
});
