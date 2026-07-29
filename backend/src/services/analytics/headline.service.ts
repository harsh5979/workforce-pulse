import { db } from '../../config/db';
import { activityLogs, employees, ingestionRuns } from '../../db/schema';
import { sql, eq, and, inArray, isNotNull } from 'drizzle-orm';

export interface HeadlineMetrics {
  hoursRecoverablePerMonth: number;
  inrRecoverablePerMonth: number;
  totalRepetitiveHours: number;
  totalHours: number;
  repetitiveShare: number;
  datasetDays: number;
  employeeBreakdown: Array<{
    employeeId: string;
    fullName: string | null;
    repetitiveHours: number;
    hourlyRateInr: number | null;
    monthlyRecoverableInr: number | null;
  }>;
  latestIngestion: {
    rowsActivityRaw: number;
    rowsActivityClean: number;
    rowsDropped: number;
    rowsFixed: number;
    rowsFlagged: number;
    employeesNoMeta: number;
    metadataNoActivity: number;
    duplicateEmployees: number;
  } | null;
}

export async function getHeadlineMetrics(filters: {
  department?: string;
  taskCategory?: string;
  week?: number;
} = {}): Promise<HeadlineMetrics> {
  // Build WHERE conditions
  const conditions: unknown[] = [];
  if (filters.department)   conditions.push(eq(activityLogs.department, filters.department));
  if (filters.taskCategory) conditions.push(eq(activityLogs.taskCategory, filters.taskCategory));
  if (filters.week)         conditions.push(eq(activityLogs.weekNumber, filters.week));

  // Get dataset date range
  const dateRange = await db
    .select({
      minTs: sql<string>`MIN(${activityLogs.timestampIst})`,
      maxTs: sql<string>`MAX(${activityLogs.timestampIst})`,
    })
    .from(activityLogs);

  const minDate = dateRange[0]?.minTs ? new Date(dateRange[0].minTs) : new Date();
  const maxDate = dateRange[0]?.maxTs ? new Date(dateRange[0].maxTs) : new Date();
  const datasetDays = Math.max(1, Math.ceil((maxDate.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24)));

  // Get per-employee repetitive stats joined with compensation
  const empStats = await db
    .select({
      employeeId: activityLogs.employeeId,
      fullName: employees.fullName,
      compAnnualInr: employees.compAnnualInr,
      workingHoursDay: employees.workingHoursDay,
      totalMinutes: sql<number>`SUM(CAST(${activityLogs.durationMin} AS DECIMAL))`,
      repMinutes: sql<number>`SUM(CASE WHEN ${activityLogs.isRepetitive} THEN CAST(${activityLogs.durationMin} AS DECIMAL) ELSE 0 END)`,
    })
    .from(activityLogs)
    .leftJoin(employees, eq(activityLogs.employeeId, employees.employeeId))
    .where(conditions.length > 0 ? and(...(conditions as any[])) : undefined)
    .groupBy(activityLogs.employeeId, employees.fullName, employees.compAnnualInr, employees.workingHoursDay);

  let totalHoursRaw = 0;
  let totalRepHoursRaw = 0;
  let inrRecoverable = 0;

  const employeeBreakdown = empStats.map(e => {
    const repHours = (Number(e.repMinutes) / 60);
    const totalHours = (Number(e.totalMinutes) / 60);
    totalHoursRaw += totalHours;
    totalRepHoursRaw += repHours;

    let hourlyRate: number | null = null;
    let monthlyRecoverable: number | null = null;

    if (e.compAnnualInr) {
      const annualInr = Number(e.compAnnualInr);
      const workHours = e.workingHoursDay ?? 8;
      hourlyRate = annualInr / (260 * workHours);
      const monthlyRepHours = repHours * (30 / datasetDays);
      monthlyRecoverable = monthlyRepHours * hourlyRate;
      inrRecoverable += monthlyRecoverable;
    }

    return {
      employeeId: e.employeeId,
      fullName: e.fullName ?? null,
      repetitiveHours: Math.round(repHours * 10) / 10,
      hourlyRateInr: hourlyRate ? Math.round(hourlyRate) : null,
      monthlyRecoverableInr: monthlyRecoverable ? Math.round(monthlyRecoverable) : null,
    };
  });

  const hoursPerMonth = totalRepHoursRaw * (30 / datasetDays);

  // Get latest ingestion run stats
  const lastRun = await db
    .select()
    .from(ingestionRuns)
    .orderBy(sql`${ingestionRuns.runAt} DESC`)
    .limit(1);

  return {
    hoursRecoverablePerMonth: Math.round(hoursPerMonth * 10) / 10,
    inrRecoverablePerMonth: Math.round(inrRecoverable),
    totalRepetitiveHours: Math.round(totalRepHoursRaw * 10) / 10,
    totalHours: Math.round(totalHoursRaw * 10) / 10,
    repetitiveShare: totalHoursRaw > 0 ? Math.round((totalRepHoursRaw / totalHoursRaw) * 1000) / 10 : 0,
    datasetDays,
    employeeBreakdown,
    latestIngestion: lastRun[0] ? {
      rowsActivityRaw: lastRun[0].rowsActivityRaw ?? 0,
      rowsActivityClean: lastRun[0].rowsActivityClean ?? 0,
      rowsDropped: lastRun[0].rowsDropped ?? 0,
      rowsFixed: lastRun[0].rowsFixed ?? 0,
      rowsFlagged: lastRun[0].rowsFlagged ?? 0,
      employeesNoMeta: lastRun[0].employeesNoMeta ?? 0,
      metadataNoActivity: lastRun[0].metadataNoActivity ?? 0,
      duplicateEmployees: lastRun[0].duplicateEmployees ?? 0,
    } : null,
  };
}
