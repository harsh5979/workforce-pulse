import { db } from '../../config/db';
import { activityLogs, employees } from '../../db/schema';
import { sql, eq, and } from 'drizzle-orm';

export async function getEmployeeList(filters: {
  department?: string;
  taskCategory?: string;
  week?: number;
} = {}) {
  const conditions: any[] = [];
  if (filters.department)   conditions.push(eq(activityLogs.department, filters.department));
  if (filters.taskCategory) conditions.push(eq(activityLogs.taskCategory, filters.taskCategory));
  if (filters.week)         conditions.push(eq(activityLogs.weekNumber, filters.week));

  const rows = await db
    .select({
      employeeId:    employees.employeeId,
      fullName:      employees.fullName,
      department:    employees.department,
      role:          employees.role,
      status:        employees.status,
      hasMetadata:   employees.hasMetadata,
      hasActivity:   employees.hasActivity,
      totalHours:    sql<number>`COALESCE(SUM(CAST(${activityLogs.durationMin} AS DECIMAL)) / 60, 0)`,
      repHours:      sql<number>`COALESCE(SUM(CASE WHEN ${activityLogs.isRepetitive} THEN CAST(${activityLogs.durationMin} AS DECIMAL) ELSE 0 END) / 60, 0)`,
      topApp:        sql<string>`(SELECT al2.app_used FROM activity_logs al2 WHERE al2.employee_id = ${employees.employeeId} GROUP BY al2.app_used ORDER BY SUM(CAST(al2.duration_min AS DECIMAL)) DESC LIMIT 1)`,
    })
    .from(employees)
    .leftJoin(activityLogs, and(
      eq(activityLogs.employeeId, employees.employeeId),
      ...(conditions as any[])
    ))
    .groupBy(employees.employeeId, employees.fullName, employees.department, employees.role, employees.status, employees.hasMetadata, employees.hasActivity)
    .orderBy(sql`COALESCE(SUM(CAST(${activityLogs.durationMin} AS DECIMAL)), 0) DESC`);

  return rows.map(r => ({
    employeeId: r.employeeId,
    fullName: r.fullName ?? r.employeeId,
    department: r.department ?? 'Unknown',
    role: r.role ?? 'Unknown',
    status: r.status,
    hasMetadata: r.hasMetadata,
    hasActivity: r.hasActivity,
    totalHours: Math.round(Number(r.totalHours) * 10) / 10,
    repHours: Math.round(Number(r.repHours) * 10) / 10,
    repShare: Number(r.totalHours) > 0
      ? Math.round((Number(r.repHours) / Number(r.totalHours)) * 1000) / 10
      : 0,
    topApp: r.topApp ?? null,
  }));
}

export async function getEmployeeProfile(employeeId: string) {
  const emp = await db
    .select()
    .from(employees)
    .where(eq(employees.employeeId, employeeId))
    .limit(1);

  if (!emp.length) return null;

  // Activity breakdown by category
  const categoryBreakdown = await db
    .select({
      category: activityLogs.taskCategory,
      totalHours: sql<number>`SUM(CAST(${activityLogs.durationMin} AS DECIMAL)) / 60`,
      repHours:   sql<number>`SUM(CASE WHEN ${activityLogs.isRepetitive} THEN CAST(${activityLogs.durationMin} AS DECIMAL) ELSE 0 END) / 60`,
    })
    .from(activityLogs)
    .where(eq(activityLogs.employeeId, employeeId))
    .groupBy(activityLogs.taskCategory)
    .orderBy(sql`SUM(CAST(${activityLogs.durationMin} AS DECIMAL)) DESC`);

  // Week-by-week for this employee
  const weeklyActivity = await db
    .select({
      week:      activityLogs.weekNumber,
      total:     sql<number>`SUM(CAST(${activityLogs.durationMin} AS DECIMAL)) / 60`,
      repHours:  sql<number>`SUM(CASE WHEN ${activityLogs.isRepetitive} THEN CAST(${activityLogs.durationMin} AS DECIMAL) ELSE 0 END) / 60`,
    })
    .from(activityLogs)
    .where(eq(activityLogs.employeeId, employeeId))
    .groupBy(activityLogs.weekNumber)
    .orderBy(activityLogs.weekNumber);

  // Peer comparison (same role) — total_hours_all_peers / peer_count / weeks
  const peerStats = emp[0].role ? await db
    .select({
      totalPeerMins: sql<number>`COALESCE(SUM(CAST(${activityLogs.durationMin} AS DECIMAL)), 0)`,
      peerCount:     sql<number>`COUNT(DISTINCT ${activityLogs.employeeId})`,
      weekCount:     sql<number>`COUNT(DISTINCT ${activityLogs.weekNumber})`,
    })
    .from(activityLogs)
    .leftJoin(employees, eq(activityLogs.employeeId, employees.employeeId))
    .where(and(
      eq(employees.role, emp[0].role),
      sql`${activityLogs.employeeId} != ${employeeId}`
    ))
    .limit(1) : [];

  return {
    employee: emp[0],
    categoryBreakdown: categoryBreakdown.map(c => ({
      category: c.category ?? 'Unknown',
      totalHours: Math.round(Number(c.totalHours) * 10) / 10,
      repHours: Math.round(Number(c.repHours) * 10) / 10,
      repShare: Number(c.totalHours) > 0
        ? Math.round((Number(c.repHours) / Number(c.totalHours)) * 1000) / 10
        : 0,
    })),
    weeklyActivity: weeklyActivity.map(w => ({
      week: w.week,
      label: `Week ${w.week}`,
      totalHours: Math.round(Number(w.total) * 10) / 10,
      repHours: Math.round(Number(w.repHours) * 10) / 10,
    })),
    peerAvgHours: (() => {
      if (!peerStats[0]) return null;
      const totalMins  = Number(peerStats[0].totalPeerMins);
      const peers      = Number(peerStats[0].peerCount);
      const weeks      = Number(peerStats[0].weekCount);
      if (peers === 0 || weeks === 0) return null;
      // Average weekly hours per peer
      return Math.round((totalMins / 60 / peers / Math.max(weeks / peers, 1)) * 10) / 10;
    })(),
  };
}
