import {
  pgTable,
  serial,
  varchar,
  timestamp,
  integer,
  boolean,
  numeric,
  text,
  date,
  jsonb,
} from 'drizzle-orm/pg-core';

// ─── Activity Logs ────────────────────────────────────────────────
export const activityLogs = pgTable('activity_logs', {
  id:              serial('id').primaryKey(),
  employeeId:      varchar('employee_id', { length: 20 }).notNull(),
  department:      varchar('department', { length: 50 }),
  timestampIst:    timestamp('timestamp_ist', { withTimezone: true }).notNull(),
  weekNumber:      integer('week_number').notNull(),           // 1–4
  appUsed:         varchar('app_used', { length: 100 }),      // canonical name
  taskCategory:    varchar('task_category', { length: 100 }), // canonical name
  durationMin:     numeric('duration_min', { precision: 8, scale: 2 }).notNull(),
  isRepetitive:    boolean('is_repetitive').notNull(),
  rawIsRepetitive: varchar('raw_is_repetitive', { length: 30 }), // original value for audit
  ingestionFlags:  text('ingestion_flags').array().default([]),   // e.g. ['fixed_negative_duration']
  createdAt:       timestamp('created_at').defaultNow(),
});

// ─── Employees ────────────────────────────────────────────────────
export const employees = pgTable('employees', {
  employeeId:      varchar('employee_id', { length: 20 }).primaryKey(),
  fullName:        varchar('full_name', { length: 100 }),
  department:      varchar('department', { length: 50 }),
  role:            varchar('role', { length: 100 }),
  tenureYears:     numeric('tenure_years', { precision: 4, scale: 1 }),
  compAnnualInr:   numeric('comp_annual_inr', { precision: 14, scale: 2 }),
  compSource:      varchar('comp_source', { length: 20 }),     // 'annual_inr'|'hourly_inr'|'lpa'
  workingHoursDay: integer('working_hours_day').default(8),
  status:          varchar('status', { length: 20 }).default('active'), // 'active'|'terminated'
  terminatedOn:    date('terminated_on'),
  hasActivity:     boolean('has_activity').default(true),
  hasMetadata:     boolean('has_metadata').default(true),
  rawData:         jsonb('raw_data'),                          // original record for audit
});

// ─── Ingestion Runs ───────────────────────────────────────────────
export const ingestionRuns = pgTable('ingestion_runs', {
  id:                  serial('id').primaryKey(),
  runAt:               timestamp('run_at').defaultNow(),
  rowsActivityRaw:     integer('rows_activity_raw').default(0),
  rowsActivityClean:   integer('rows_activity_clean').default(0),
  rowsDropped:         integer('rows_dropped').default(0),
  rowsFixed:           integer('rows_fixed').default(0),
  rowsFlagged:         integer('rows_flagged').default(0),
  employeesNoMeta:     integer('employees_no_meta').default(0),
  metadataNoActivity:  integer('metadata_no_activity').default(0),
  duplicateEmployees:  integer('duplicate_employees').default(0),
  notes:               text('notes'),
});

// Inferred types
export type ActivityLog = typeof activityLogs.$inferSelect;
export type NewActivityLog = typeof activityLogs.$inferInsert;
export type Employee = typeof employees.$inferSelect;
export type NewEmployee = typeof employees.$inferInsert;
export type IngestionRun = typeof ingestionRuns.$inferSelect;
export type NewIngestionRun = typeof ingestionRuns.$inferInsert;
