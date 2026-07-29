import { db } from '../../config/db';
import { activityLogs, employees } from '../../db/schema';
import { sql, eq, and } from 'drizzle-orm';

export interface Anomaly {
  id: string;
  type: 'high_volume' | 'low_volume' | 'high_repetitive_dept' | 'zero_productive' | 'spike';
  subject: string;
  subjectType: 'employee' | 'department' | 'category';
  headline: string;
  detail: string;
  severity: 'high' | 'medium' | 'low';
  zScore?: number;
  value: number;
  benchmark: number;
}

export async function detectAnomalies(): Promise<Anomaly[]> {
  const anomalies: Anomaly[] = [];

  // ─── Z-score: employee hours per week vs department mean ─────
  const empWeekStats = await db
    .select({
      empId:    activityLogs.employeeId,
      dept:     activityLogs.department,
      week:     activityLogs.weekNumber,
      total:    sql<number>`SUM(CAST(${activityLogs.durationMin} AS DECIMAL)) / 60`,
      repHours: sql<number>`SUM(CASE WHEN ${activityLogs.isRepetitive} THEN CAST(${activityLogs.durationMin} AS DECIMAL) ELSE 0 END) / 60`,
    })
    .from(activityLogs)
    .groupBy(activityLogs.employeeId, activityLogs.department, activityLogs.weekNumber);

  // Group by dept+week and compute z-scores
  const deptWeekGroups = new Map<string, number[]>();
  for (const row of empWeekStats) {
    const key = `${row.dept ?? 'Unknown'}|${row.week}`;
    if (!deptWeekGroups.has(key)) deptWeekGroups.set(key, []);
    deptWeekGroups.get(key)!.push(Number(row.total));
  }

  for (const row of empWeekStats) {
    const key = `${row.dept ?? 'Unknown'}|${row.week}`;
    const group = deptWeekGroups.get(key) ?? [];
    if (group.length < 2) continue;

    const mean = group.reduce((a, b) => a + b, 0) / group.length;
    const std  = Math.sqrt(group.reduce((sum, v) => sum + (v - mean) ** 2, 0) / group.length);
    if (std === 0) continue;

    const z = (Number(row.total) - mean) / std;
    if (Math.abs(z) > 2.0) {
      const isHigh = z > 0;
      anomalies.push({
        id: `zscore-${row.empId}-w${row.week}`,
        type: isHigh ? 'high_volume' : 'low_volume',
        subject: row.empId,
        subjectType: 'employee',
        headline: `${row.empId} logged ${isHigh ? 'abnormally high' : 'very low'} hours in Week ${row.week}`,
        detail: `${Math.round(Number(row.total) * 10) / 10}h logged vs dept avg ${Math.round(mean * 10) / 10}h (z-score: ${Math.round(z * 100) / 100})`,
        severity: Math.abs(z) > 3 ? 'high' : 'medium',
        zScore: Math.round(z * 100) / 100,
        value: Math.round(Number(row.total) * 10) / 10,
        benchmark: Math.round(mean * 10) / 10,
      });
    }
  }

  // ─── Department with >80% repetitive share ───────────────────
  const deptRepShare = await db
    .select({
      dept:     activityLogs.department,
      repShare: sql<number>`SUM(CASE WHEN ${activityLogs.isRepetitive} THEN CAST(${activityLogs.durationMin} AS DECIMAL) ELSE 0 END) / NULLIF(SUM(CAST(${activityLogs.durationMin} AS DECIMAL)), 0) * 100`,
    })
    .from(activityLogs)
    .groupBy(activityLogs.department)
    .having(sql`${activityLogs.department} IS NOT NULL`);

  for (const row of deptRepShare) {
    const share = Number(row.repShare ?? 0);
    if (share > 80) {
      anomalies.push({
        id: `high-rep-dept-${row.dept}`,
        type: 'high_repetitive_dept',
        subject: row.dept ?? 'Unknown',
        subjectType: 'department',
        headline: `${row.dept} has ${Math.round(share)}% repetitive task share`,
        detail: `${Math.round(share)}% of all logged hours in ${row.dept} are repetitive tasks — highest automation opportunity department.`,
        severity: share > 90 ? 'high' : 'medium',
        value: Math.round(share * 10) / 10,
        benchmark: 80,
      });
    }
  }

  // Sort by severity
  const severityOrder = { high: 0, medium: 1, low: 2 };
  return anomalies
    .sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity])
    .slice(0, 10); // Return top 10 anomalies
}
