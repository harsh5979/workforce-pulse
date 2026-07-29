import { db } from '../../config/db';
import { activityLogs, employees } from '../../db/schema';
import { sql, eq, and } from 'drizzle-orm';

export interface RankedCategory {
  category: string;
  score: number;
  totalHours: number;
  repetitiveHours: number;
  repetitiveShare: number;
  employeeCount: number;
  employeeConcentration: number;
  volumeNorm: number;
  rank: number;
}

export async function getAutomationRanking(filters: {
  department?: string;
  week?: number;
} = {}): Promise<RankedCategory[]> {
  const conditions: any[] = [];
  if (filters.department) conditions.push(eq(activityLogs.department, filters.department));
  if (filters.week)       conditions.push(eq(activityLogs.weekNumber, filters.week));

  // Get total employee count for concentration calc
  const totalEmpResult = await db
    .select({ count: sql<number>`COUNT(DISTINCT ${activityLogs.employeeId})` })
    .from(activityLogs);
  const totalEmployees = Number(totalEmpResult[0]?.count ?? 1);

  // Get per-category stats
  const catStats = await db
    .select({
      category: activityLogs.taskCategory,
      totalMinutes: sql<number>`SUM(CAST(${activityLogs.durationMin} AS DECIMAL))`,
      repMinutes: sql<number>`SUM(CASE WHEN ${activityLogs.isRepetitive} THEN CAST(${activityLogs.durationMin} AS DECIMAL) ELSE 0 END)`,
      employeeCount: sql<number>`COUNT(DISTINCT ${activityLogs.employeeId})`,
    })
    .from(activityLogs)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .groupBy(activityLogs.taskCategory)
    .having(sql`${activityLogs.taskCategory} IS NOT NULL`);

  const maxHours = Math.max(...catStats.map(c => Number(c.totalMinutes)));

  const ranked: RankedCategory[] = catStats
    .filter(c => c.category)
    .map(c => {
      const totalHours     = Number(c.totalMinutes) / 60;
      const repHours       = Number(c.repMinutes) / 60;
      const repShare       = totalHours > 0 ? repHours / totalHours : 0;
      const empConc        = totalEmployees > 0 ? Number(c.employeeCount) / totalEmployees : 0;
      const volumeNorm     = maxHours > 0 ? Number(c.totalMinutes) / maxHours : 0;

      // Score formula: volume 40% + rep share 40% + emp concentration 20%
      const score = (volumeNorm * 0.40) + (repShare * 0.40) + (empConc * 0.20);

      return {
        category: c.category!,
        score: Math.round(score * 1000) / 1000,
        totalHours: Math.round(totalHours * 10) / 10,
        repetitiveHours: Math.round(repHours * 10) / 10,
        repetitiveShare: Math.round(repShare * 1000) / 10,
        employeeCount: Number(c.employeeCount),
        employeeConcentration: Math.round(empConc * 1000) / 10,
        volumeNorm: Math.round(volumeNorm * 1000) / 10,
        rank: 0,
      };
    })
    .sort((a, b) => b.score - a.score)
    .map((item, idx) => ({ ...item, rank: idx + 1 }));

  return ranked;
}

export async function getCategoryBreakdown(
  groupBy: 'task_category' | 'app_used' | 'department',
  filters: { department?: string; week?: number; taskCategory?: string } = {}
) {
  const conditions: any[] = [];
  if (filters.department)   conditions.push(eq(activityLogs.department, filters.department));
  if (filters.week)         conditions.push(eq(activityLogs.weekNumber, filters.week));
  if (filters.taskCategory) conditions.push(eq(activityLogs.taskCategory, filters.taskCategory));

  const col = groupBy === 'task_category'
    ? activityLogs.taskCategory
    : groupBy === 'app_used'
    ? activityLogs.appUsed
    : activityLogs.department;

  const result = await db
    .select({
      name:       col,
      totalHours: sql<number>`SUM(CAST(${activityLogs.durationMin} AS DECIMAL)) / 60`,
      repHours:   sql<number>`SUM(CASE WHEN ${activityLogs.isRepetitive} THEN CAST(${activityLogs.durationMin} AS DECIMAL) ELSE 0 END) / 60`,
      count:      sql<number>`COUNT(*)`,
    })
    .from(activityLogs)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .groupBy(col)
    .orderBy(sql`SUM(CAST(${activityLogs.durationMin} AS DECIMAL)) DESC`)
    .limit(20);

  return result
    .filter(r => r.name)
    .map(r => ({
      name: r.name!,
      totalHours: Math.round(Number(r.totalHours) * 10) / 10,
      repHours: Math.round(Number(r.repHours) * 10) / 10,
      repShare: Number(r.totalHours) > 0
        ? Math.round((Number(r.repHours) / Number(r.totalHours)) * 1000) / 10
        : 0,
      count: Number(r.count),
    }));
}
