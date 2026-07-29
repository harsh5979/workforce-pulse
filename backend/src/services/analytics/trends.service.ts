import { db } from '../../config/db';
import { activityLogs, employees } from '../../db/schema';
import { sql, eq, and } from 'drizzle-orm';

export interface WeekTrend {
  week: number;
  label: string;
  totalHours: number;
  repHours: number;
  repShare: number;
  byCategory: Record<string, { hours: number; repShare: number }>;
}

export async function getWeekOverWeekTrend(filters: {
  department?: string;
  taskCategory?: string;
} = {}): Promise<WeekTrend[]> {
  const conditions: any[] = [];
  if (filters.department)   conditions.push(eq(activityLogs.department, filters.department));
  if (filters.taskCategory) conditions.push(eq(activityLogs.taskCategory, filters.taskCategory));

  // Top 5 categories overall
  const topCats = await db
    .select({ cat: activityLogs.taskCategory, total: sql<number>`SUM(CAST(${activityLogs.durationMin} AS DECIMAL))` })
    .from(activityLogs)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .groupBy(activityLogs.taskCategory)
    .orderBy(sql`SUM(CAST(${activityLogs.durationMin} AS DECIMAL)) DESC`)
    .limit(5);
  const topCatNames = topCats.map(c => c.cat).filter(Boolean) as string[];

  // Get week-level stats
  const weekStats = await db
    .select({
      week:        activityLogs.weekNumber,
      category:    activityLogs.taskCategory,
      totalMin:    sql<number>`SUM(CAST(${activityLogs.durationMin} AS DECIMAL))`,
      repMin:      sql<number>`SUM(CASE WHEN ${activityLogs.isRepetitive} THEN CAST(${activityLogs.durationMin} AS DECIMAL) ELSE 0 END)`,
    })
    .from(activityLogs)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .groupBy(activityLogs.weekNumber, activityLogs.taskCategory)
    .orderBy(activityLogs.weekNumber);

  // Group by week
  const weekMap = new Map<number, WeekTrend>();

  for (const row of weekStats) {
    if (!weekMap.has(row.week)) {
      weekMap.set(row.week, {
        week: row.week,
        label: `Week ${row.week}`,
        totalHours: 0,
        repHours: 0,
        repShare: 0,
        byCategory: {},
      });
    }

    const wt = weekMap.get(row.week)!;
    const totalHours = Number(row.totalMin) / 60;
    const repHours   = Number(row.repMin) / 60;
    wt.totalHours += totalHours;
    wt.repHours   += repHours;

    if (row.category && topCatNames.includes(row.category)) {
      wt.byCategory[row.category] = {
        hours: Math.round(totalHours * 10) / 10,
        repShare: totalHours > 0 ? Math.round((repHours / totalHours) * 1000) / 10 : 0,
      };
    }
  }

  // Calculate repShare per week
  const trends = Array.from(weekMap.values())
    .sort((a, b) => a.week - b.week)
    .map(wt => ({
      ...wt,
      totalHours: Math.round(wt.totalHours * 10) / 10,
      repHours:   Math.round(wt.repHours * 10) / 10,
      repShare: wt.totalHours > 0 ? Math.round((wt.repHours / wt.totalHours) * 1000) / 10 : 0,
    }));

  return trends;
}
