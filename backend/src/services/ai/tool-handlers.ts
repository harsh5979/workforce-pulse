import { db } from '../../config/db';
import { activityLogs, employees } from '../../db/schema';
import { sql, eq, and, desc } from 'drizzle-orm';
import { detectAnomalies } from '../analytics/anomaly.service';

export async function executeTool(name: string, args: any, user?: any) {
  switch (name) {
    case 'get_employee_analytics':
      return await handleGetEmployeeAnalytics(args);
    case 'get_department_analytics':
      return await handleGetDepartmentAnalytics(args);
    case 'get_category_metrics':
      return await handleGetCategoryMetrics();
    case 'get_weekly_trends':
      return await handleGetWeeklyTrends();
    case 'get_system_anomalies':
      return await handleGetSystemAnomalies();
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

async function handleGetEmployeeAnalytics(args: {
  employeeId?: string;
  fullName?: string;
  department?: string;
  page?: number;
  limit?: number;
}) {
  const page = Math.max(1, args.page ?? 1);
  const limit = Math.min(35, Math.max(1, args.limit ?? 35));
  const offset = (page - 1) * limit;

  // Case A: Query for a specific employeeId
  if (args.employeeId?.trim()) {
    const id = args.employeeId.trim().toUpperCase();
    const [emp] = await db
      .select()
      .from(employees)
      .where(eq(employees.employeeId, id));

    if (!emp) {
      return { status: 'not_found', message: `No employee found with ID "${id}"` };
    }

    const [stats] = await db
      .select({
        totalMins: sql<number>`COALESCE(SUM(CAST(${activityLogs.durationMin} AS DECIMAL)), 0)`,
        repMins: sql<number>`COALESCE(SUM(CASE WHEN ${activityLogs.isRepetitive} THEN CAST(${activityLogs.durationMin} AS DECIMAL) ELSE 0 END), 0)`,
      })
      .from(activityLogs)
      .where(eq(activityLogs.employeeId, id));

    const totalHrs = Number(stats.totalMins) / 60;
    const repHrs = Number(stats.repMins) / 60;
    const repSharePct = totalHrs > 0 ? (repHrs / totalHrs) * 100 : 0;

    let hourlyRate: number | null = null;
    let monthlyRepCost: number | null = null;

    if (emp.compAnnualInr) {
      hourlyRate = Number(emp.compAnnualInr) / (260 * (emp.workingHoursDay ?? 8));
      monthlyRepCost = Math.round(repHrs * (30 / 28) * hourlyRate);
    }

    // Top categories for this employee
    const categories = await db
      .select({
        category: activityLogs.taskCategory,
        totalHrs: sql<number>`SUM(CAST(${activityLogs.durationMin} AS DECIMAL)) / 60`,
        repHrs: sql<number>`SUM(CASE WHEN ${activityLogs.isRepetitive} THEN CAST(${activityLogs.durationMin} AS DECIMAL) ELSE 0 END) / 60`,
      })
      .from(activityLogs)
      .where(eq(activityLogs.employeeId, id))
      .groupBy(activityLogs.taskCategory)
      .orderBy(sql`SUM(CAST(${activityLogs.durationMin} AS DECIMAL)) DESC`)
      .limit(5);

    return {
      status: 'single',
      employee: {
        employeeId: emp.employeeId,
        fullName: emp.fullName,
        department: emp.department,
        role: emp.role,
        status: emp.status,
        totalHours: Math.round(totalHrs * 10) / 10,
        repetitiveHours: Math.round(repHrs * 10) / 10,
        repSharePct: Math.round(repSharePct * 10) / 10,
        hourlyRateInr: hourlyRate ? Math.round(hourlyRate) : null,
        monthlyRepCostInr: monthlyRepCost,
        topCategories: categories.map(c => ({
          category: c.category ?? 'Uncategorized',
          totalHours: Math.round(Number(c.totalHrs) * 10) / 10,
          repetitiveHours: Math.round(Number(c.repHrs) * 10) / 10,
          repSharePct: Number(c.totalHrs) > 0 ? Math.round((Number(c.repHrs) / Number(c.totalHrs)) * 1000) / 10 : 0,
        })),
      },
    };
  }

  // Case B: Query by employee name (fuzzy lookup with disambiguation)
  if (args.fullName?.trim()) {
    const searchName = args.fullName.trim().toLowerCase();
    const matches = await db
      .select()
      .from(employees)
      .where(sql`LOWER(${employees.fullName}) LIKE ${'%' + searchName + '%'}`);

    if (matches.length === 0) {
      return { status: 'not_found', message: `No employee matches the name "${args.fullName}"` };
    }

    if (matches.length > 1) {
      // Disambiguation payload
      return {
        status: 'multiple_matches',
        message: `I found ${matches.length} employees matching "${args.fullName}". Please select one:`,
        matches: matches.map(m => ({
          employeeId: m.employeeId,
          fullName: m.fullName,
          department: m.department,
          role: m.role,
        })),
      };
    }

    // Exact single match — forward parameters
    return await handleGetEmployeeAnalytics({ employeeId: matches[0].employeeId });
  }

  // Case C: List employees (Paginated with optional Department Filter)
  let query = db
    .select({
      employeeId: employees.employeeId,
      fullName: employees.fullName,
      department: employees.department,
      role: employees.role,
      totalMins: sql<number>`SUM(CAST(${activityLogs.durationMin} AS DECIMAL))`,
      repMins: sql<number>`SUM(CASE WHEN ${activityLogs.isRepetitive} THEN CAST(${activityLogs.durationMin} AS DECIMAL) ELSE 0 END)`,
    })
    .from(employees)
    .leftJoin(activityLogs, eq(employees.employeeId, activityLogs.employeeId));

  if (args.department?.trim()) {
    query = query.where(eq(employees.department, args.department.trim() as any)) as any;
  }

  const list = await query
    .groupBy(employees.employeeId, employees.fullName, employees.department, employees.role)
    .orderBy(sql`SUM(CASE WHEN ${activityLogs.isRepetitive} THEN CAST(${activityLogs.durationMin} AS DECIMAL) ELSE 0 END) DESC`)
    .limit(limit)
    .offset(offset);

  // Total count query
  let countQuery = db
    .select({ count: sql<number>`COUNT(DISTINCT ${employees.employeeId})` })
    .from(employees);

  if (args.department?.trim()) {
    countQuery = countQuery.where(eq(employees.department, args.department.trim() as any)) as any;
  }

  const [totalRes] = await countQuery;

  const totalCount = Number(totalRes?.count ?? 0);
  const hasMore = offset + limit < totalCount;

  const formattedList = list.map(item => {
    const tH = Number(item.totalMins || 0) / 60;
    const rH = Number(item.repMins || 0) / 60;
    return {
      employeeId: item.employeeId,
      fullName: item.fullName ?? 'Unknown',
      department: item.department ?? 'Unknown',
      role: item.role ?? 'Unknown',
      totalHours: Math.round(tH * 10) / 10,
      repetitiveHours: Math.round(rH * 10) / 10,
      repSharePct: tH > 0 ? Math.round((rH / tH) * 1000) / 10 : 0,
    };
  });

  return {
    status: 'list',
    page,
    limit,
    totalCount,
    hasMore,
    results: formattedList,
  };
}

async function handleGetDepartmentAnalytics(args: { department: string }) {
  const dept = args.department?.trim();
  if (!dept) {
    return { error: 'Department parameter is required' };
  }

  const [stats] = await db
    .select({
      totalMins: sql<number>`COALESCE(SUM(CAST(${activityLogs.durationMin} AS DECIMAL)), 0)`,
      repMins: sql<number>`COALESCE(SUM(CASE WHEN ${activityLogs.isRepetitive} THEN CAST(${activityLogs.durationMin} AS DECIMAL) ELSE 0 END), 0)`,
      empCount: sql<number>`COUNT(DISTINCT ${activityLogs.employeeId})`,
    })
    .from(activityLogs)
    .where(sql`LOWER(${activityLogs.department}) = LOWER(${dept})`);

  if (!stats || Number(stats.empCount) === 0) {
    return { status: 'not_found', message: `No recorded operational telemetry found for department "${dept}"` };
  }

  const totalHrs = Number(stats.totalMins) / 60;
  const repHrs = Number(stats.repMins) / 60;
  const repSharePct = totalHrs > 0 ? (repHrs / totalHrs) * 100 : 0;

  // Let's get top tasks in this department
  const categories = await db
    .select({
      category: activityLogs.taskCategory,
      totalHrs: sql<number>`SUM(CAST(${activityLogs.durationMin} AS DECIMAL)) / 60`,
      repHrs: sql<number>`SUM(CASE WHEN ${activityLogs.isRepetitive} THEN CAST(${activityLogs.durationMin} AS DECIMAL) ELSE 0 END) / 60`,
    })
    .from(activityLogs)
    .where(sql`LOWER(${activityLogs.department}) = LOWER(${dept})`)
    .groupBy(activityLogs.taskCategory)
    .orderBy(sql`SUM(CAST(${activityLogs.durationMin} AS DECIMAL)) DESC`)
    .limit(5);

  return {
    status: 'success',
    department: dept,
    headcount: Number(stats.empCount),
    totalHours: Math.round(totalHrs * 10) / 10,
    repetitiveHours: Math.round(repHrs * 10) / 10,
    repSharePct: Math.round(repSharePct * 10) / 10,
    topCategories: categories.map(c => ({
      category: c.category ?? 'Uncategorized',
      totalHours: Math.round(Number(c.totalHrs) * 10) / 10,
      repetitiveHours: Math.round(Number(c.repHrs) * 10) / 10,
      repSharePct: Number(c.totalHrs) > 0 ? Math.round((Number(c.repHrs) / Number(c.totalHrs)) * 1000) / 10 : 0,
    })),
  };
}

async function handleGetCategoryMetrics() {
  const catStats = await db
    .select({
      cat: activityLogs.taskCategory,
      totalMins: sql<number>`SUM(CAST(${activityLogs.durationMin} AS DECIMAL))`,
      repMins: sql<number>`SUM(CASE WHEN ${activityLogs.isRepetitive} THEN CAST(${activityLogs.durationMin} AS DECIMAL) ELSE 0 END)`,
    })
    .from(activityLogs)
    .groupBy(activityLogs.taskCategory)
    .where(sql`${activityLogs.taskCategory} IS NOT NULL`)
    .orderBy(sql`SUM(CAST(${activityLogs.durationMin} AS DECIMAL)) DESC`);

  const maxMins = Math.max(...catStats.map(c => Number(c.totalMins)));

  const categories = catStats.map(c => {
    const totH = Number(c.totalMins) / 60;
    const repH = Number(c.repMins) / 60;
    const repShare = totH > 0 ? repH / totH : 0;
    const volNorm = maxMins > 0 ? Number(c.totalMins) / maxMins : 0;
    const score = volNorm * 0.4 + repShare * 0.4 + 0.2;

    return {
      category: c.cat!,
      totalHours: Math.round(totH * 10) / 10,
      repetitiveHours: Math.round(repH * 10) / 10,
      repSharePct: Math.round(repShare * 1000) / 10,
      priorityScore: Math.round(score * 100) / 100,
    };
  });

  return {
    status: 'success',
    categories: categories.sort((a, b) => b.priorityScore - a.priorityScore),
  };
}

async function handleGetWeeklyTrends() {
  const weeklyStats = await db
    .select({
      dept: activityLogs.department,
      weekNumber: activityLogs.weekNumber,
      totalMins: sql<number>`SUM(CAST(${activityLogs.durationMin} AS DECIMAL))`,
      repMins: sql<number>`SUM(CASE WHEN ${activityLogs.isRepetitive} THEN CAST(${activityLogs.durationMin} AS DECIMAL) ELSE 0 END)`,
    })
    .from(activityLogs)
    .groupBy(activityLogs.department, activityLogs.weekNumber)
    .orderBy(activityLogs.department, activityLogs.weekNumber);

  // Group trends by department
  const trends: Record<string, Array<{ week: number; totalHours: number; repetitiveHours: number; repSharePct: number }>> = {};

  for (const row of weeklyStats) {
    const dept = row.dept ?? 'Unknown';
    if (!trends[dept]) trends[dept] = [];

    const totH = Number(row.totalMins) / 60;
    const repH = Number(row.repMins) / 60;
    const share = totH > 0 ? (repH / totH) * 100 : 0;

    trends[dept].push({
      week: row.weekNumber,
      totalHours: Math.round(totH * 10) / 10,
      repetitiveHours: Math.round(repH * 10) / 10,
      repSharePct: Math.round(share * 10) / 10,
    });
  }

  return {
    status: 'success',
    trends,
  };
}

async function handleGetSystemAnomalies() {
  const anomalies = await detectAnomalies();
  return {
    status: 'success',
    anomalies: anomalies.map(a => ({
      type: a.type,
      subject: a.subject,
      headline: a.headline,
      detail: a.detail,
      severity: a.severity,
      value: a.value,
      benchmark: a.benchmark,
    })),
  };
}
