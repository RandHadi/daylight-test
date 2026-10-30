import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
export const planners = sqliteTable('planners', {
  userId: text('user_id').primaryKey(),
  payload: text('payload').notNull(),
  revision: integer('revision').notNull().default(1),
  updatedAt: integer('updated_at').notNull(),
});
