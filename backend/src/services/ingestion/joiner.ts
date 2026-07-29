import { db } from '../../config/db';
import { activityLogs, employees, ingestionRuns } from '../../db/schema';
import { parseActivityCSV } from './activity-parser';
import { parseHRMSJson } from './hrms-parser';
import { logger } from '../../utils/logger';
import path from 'path';

const DATA_DIR = path.resolve(__dirname, '../../../../data');

export interface IngestionResult {
  success: boolean;
  stats: {
    rowsActivityRaw: number;
    rowsActivityClean: number;
    rowsDropped: number;
    rowsFixed: number;
    rowsFlagged: number;
    employeesNoMeta: number;
    metadataNoActivity: number;
    duplicateEmployees: number;
  };
  message: string;
}

export async function runIngestion(): Promise<IngestionResult> {
  logger.info('🚀 Starting data ingestion...');

  // ─── 1. Parse CSV ─────────────────────────────────────────────
  const activityPath = path.join(DATA_DIR, 'activity_logs.csv');
  const hrmsPath     = path.join(DATA_DIR, 'employees.json');

  const { rows: activityRows, stats: activityStats } = await parseActivityCSV(activityPath);
  logger.info(`📊 Activity parsed: ${activityStats.clean} clean / ${activityStats.raw} raw`);

  // ─── 2. Parse HRMS ────────────────────────────────────────────
  const hrmsResult = await parseHRMSJson(hrmsPath);
  logger.info(`👥 HRMS parsed: ${hrmsResult.employees.length} employees (${hrmsResult.stats.duplicateIds.length} duplicates resolved)`);

  // ─── 3. Cross-reference to set hasActivity / hasMetadata ─────
  const activityEmpIds = new Set(activityRows.map(r => r.employeeId));
  const hrmsEmpIds     = new Set(hrmsResult.employees.map(e => e.employeeId));

  let employeesNoMeta   = 0;  // in activity but not HRMS
  let metadataNoActivity = 0; // in HRMS but not activity

  // Mark employees missing from HRMS — add placeholder records
  const missingFromHRMS: string[] = [];
  for (const empId of activityEmpIds) {
    if (!hrmsEmpIds.has(empId)) {
      missingFromHRMS.push(empId);
      employeesNoMeta++;
    }
  }

  // Mark HRMS employees with no activity
  for (const emp of hrmsResult.employees) {
    if (!activityEmpIds.has(emp.employeeId)) {
      emp.hasActivity = false;
      metadataNoActivity++;
    }
  }

  // Add placeholder employee rows for those in activity but not in HRMS
  for (const empId of missingFromHRMS) {
    hrmsResult.employees.push({
      employeeId: empId,
      fullName: empId,
      department: null,
      role: null,
      tenureYears: null,
      compAnnualInr: null,
      compSource: null,
      workingHoursDay: 8,
      status: 'active',
      terminatedOn: null,
      hasActivity: true,
      hasMetadata: false,
      rawData: null,
    });
  }

  // ─── 4. Write to database ─────────────────────────────────────
  logger.info('💾 Writing to database...');

  // Clear existing data
  await db.delete(activityLogs);
  await db.delete(employees);

  // Insert employees first (FK constraint)
  if (hrmsResult.employees.length > 0) {
    await db.insert(employees).values(hrmsResult.employees);
    logger.info(`✅ Inserted ${hrmsResult.employees.length} employees`);
  }

  // Insert activity logs in batches of 100
  const BATCH_SIZE = 100;
  for (let i = 0; i < activityRows.length; i += BATCH_SIZE) {
    const batch = activityRows.slice(i, i + BATCH_SIZE);
    await db.insert(activityLogs).values(batch);
  }
  logger.info(`✅ Inserted ${activityRows.length} activity log rows`);

  // ─── 5. Record ingestion run ──────────────────────────────────
  const ingestionStats = {
    rowsActivityRaw:    activityStats.raw,
    rowsActivityClean:  activityStats.clean,
    rowsDropped:        activityStats.dropped,
    rowsFixed:          activityStats.fixed,
    rowsFlagged:        activityStats.flagged,
    employeesNoMeta,
    metadataNoActivity,
    duplicateEmployees: hrmsResult.stats.duplicateIds.length,
    notes: hrmsResult.stats.duplicateIds.length > 0
      ? `Duplicates resolved: ${hrmsResult.stats.duplicateIds.join(', ')}`
      : null,
  };

  await db.insert(ingestionRuns).values(ingestionStats);

  logger.info('✅ Ingestion complete', ingestionStats);

  return {
    success: true,
    stats: ingestionStats,
    message: 'Ingestion completed successfully',
  };
}
