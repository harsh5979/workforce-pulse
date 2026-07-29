import { db } from '../../config/db';
import { activityLogs, employees, ingestionRuns } from '../../db/schema';
import { sql, eq } from 'drizzle-orm';

export interface AIContext {
  datasetInfo: {
    totalEmployees: number;
    departments: string[];
    weeksSpanned: number;
    totalHours: number;
    totalRepetitiveHours: number;
    repetitiveSharePct: number;
  };
  headlineMetrics: {
    hoursRecoverablePerMonth: number;
    inrRecoverablePerMonth: number;
  };
  topRepetitiveEmployees: Array<{
    employeeId: string;
    name: string;
    department: string;
    role: string;
    repetitiveHours: number;
    totalHours: number;
    repSharePct: number;
    hourlyRateInr: number | null;
    monthlyRepCostInr: number | null;
  }>;
  departmentBreakdown: Array<{
    department: string;
    totalHours: number;
    repHours: number;
    repSharePct: number;
    employeeCount: number;
  }>;
  categoryBreakdown: Array<{
    category: string;
    totalHours: number;
    repHours: number;
    repSharePct: number;
    score: number;
  }>;
  weeklyEmployeeTrajectory: Array<{
    employeeId: string;
    name: string;
    department: string;
    weekNumber: number;
    totalHours: number;
    repHours: number;
    repSharePct: number;
  }>;
  employeeTaskCategoryBreakdown: Array<{
    employeeId: string;
    name: string;
    department: string;
    role: string;
    category: string;
    totalHours: number;
    repetitiveHours: number;
    monthlyRepCostInr: number | null;
  }>;
  anomalies: Array<{
    subject: string;
    type: string;
    headline: string;
    value: number;
  }>;
  generatedAt: string;
}

export async function buildAIContext(): Promise<AIContext> {
  // ─── Dataset info ─────────────────────────────────────────────
  const [totalStats] = await db
    .select({
      empCount:  sql<number>`COUNT(DISTINCT ${activityLogs.employeeId})`,
      totalMins: sql<number>`SUM(CAST(${activityLogs.durationMin} AS DECIMAL))`,
      repMins:   sql<number>`SUM(CASE WHEN ${activityLogs.isRepetitive} THEN CAST(${activityLogs.durationMin} AS DECIMAL) ELSE 0 END)`,
      maxWeek:   sql<number>`MAX(${activityLogs.weekNumber})`,
    })
    .from(activityLogs);

  const depts = await db
    .selectDistinct({ dept: activityLogs.department })
    .from(activityLogs)
    .where(sql`${activityLogs.department} IS NOT NULL`);

  const totalHrs   = Number(totalStats.totalMins) / 60;
  const repHrs     = Number(totalStats.repMins) / 60;
  const repShare   = totalHrs > 0 ? (repHrs / totalHrs) * 100 : 0;

  // ─── Per-employee stats joined with compensation ──────────────
  const empStats = await db
    .select({
      empId:      activityLogs.employeeId,
      fullName:   employees.fullName,
      department: employees.department,
      role:       employees.role,
      annualInr:  employees.compAnnualInr,
      workHours:  employees.workingHoursDay,
      totalMins:  sql<number>`SUM(CAST(${activityLogs.durationMin} AS DECIMAL))`,
      repMins:    sql<number>`SUM(CASE WHEN ${activityLogs.isRepetitive} THEN CAST(${activityLogs.durationMin} AS DECIMAL) ELSE 0 END)`,
    })
    .from(activityLogs)
    .leftJoin(employees, eq(activityLogs.employeeId, employees.employeeId))
    .groupBy(activityLogs.employeeId, employees.fullName, employees.department, employees.role, employees.compAnnualInr, employees.workingHoursDay)
    .orderBy(sql`SUM(CASE WHEN ${activityLogs.isRepetitive} THEN CAST(${activityLogs.durationMin} AS DECIMAL) ELSE 0 END) DESC`)
    .limit(25);

  const topRepEmployees = empStats.map(e => {
    const repH  = Number(e.repMins) / 60;
    const totH  = Number(e.totalMins) / 60;
    let hourlyRate: number | null = null;
    let monthlyCost: number | null = null;

    if (e.annualInr) {
      hourlyRate = Number(e.annualInr) / (260 * (e.workHours ?? 8));
      monthlyCost = Math.round(repH * (30 / 28) * hourlyRate);
    }

    return {
      employeeId: e.empId,
      name: e.fullName ?? e.empId,
      department: e.department ?? 'Unknown',
      role: e.role ?? 'Unknown',
      repetitiveHours: Math.round(repH * 10) / 10,
      totalHours: Math.round(totH * 10) / 10,
      repSharePct: totH > 0 ? Math.round((repH / totH) * 1000) / 10 : 0,
      hourlyRateInr: hourlyRate ? Math.round(hourlyRate) : null,
      monthlyRepCostInr: monthlyCost,
    };
  });

  // ─── Dept breakdown ───────────────────────────────────────────
  const deptStats = await db
    .select({
      dept:       activityLogs.department,
      totalMins:  sql<number>`SUM(CAST(${activityLogs.durationMin} AS DECIMAL))`,
      repMins:    sql<number>`SUM(CASE WHEN ${activityLogs.isRepetitive} THEN CAST(${activityLogs.durationMin} AS DECIMAL) ELSE 0 END)`,
      empCount:   sql<number>`COUNT(DISTINCT ${activityLogs.employeeId})`,
    })
    .from(activityLogs)
    .groupBy(activityLogs.department)
    .where(sql`${activityLogs.department} IS NOT NULL`)
    .orderBy(sql`SUM(CAST(${activityLogs.durationMin} AS DECIMAL)) DESC`);

  const departmentBreakdown = deptStats.map(d => {
    const totH = Number(d.totalMins) / 60;
    const repH = Number(d.repMins) / 60;
    return {
      department: d.dept!,
      totalHours: Math.round(totH * 10) / 10,
      repHours: Math.round(repH * 10) / 10,
      repSharePct: totH > 0 ? Math.round((repH / totH) * 1000) / 10 : 0,
      employeeCount: Number(d.empCount),
    };
  });

  // ─── Category breakdown ───────────────────────────────────────
  const catStats = await db
    .select({
      cat:       activityLogs.taskCategory,
      totalMins: sql<number>`SUM(CAST(${activityLogs.durationMin} AS DECIMAL))`,
      repMins:   sql<number>`SUM(CASE WHEN ${activityLogs.isRepetitive} THEN CAST(${activityLogs.durationMin} AS DECIMAL) ELSE 0 END)`,
    })
    .from(activityLogs)
    .groupBy(activityLogs.taskCategory)
    .where(sql`${activityLogs.taskCategory} IS NOT NULL`)
    .orderBy(sql`SUM(CAST(${activityLogs.durationMin} AS DECIMAL)) DESC`)
    .limit(12);

  const maxMins = Math.max(...catStats.map(c => Number(c.totalMins)));

  const categoryBreakdown = catStats.map(c => {
    const totH = Number(c.totalMins) / 60;
    const repH = Number(c.repMins) / 60;
    const repShare = totH > 0 ? repH / totH : 0;
    const volNorm  = maxMins > 0 ? Number(c.totalMins) / maxMins : 0;
    return {
      category: c.cat!,
      totalHours: Math.round(totH * 10) / 10,
      repHours: Math.round(repH * 10) / 10,
      repSharePct: Math.round(repShare * 1000) / 10,
      score: Math.round((volNorm * 0.4 + repShare * 0.4 + 0.2) * 1000) / 1000,
    };
  });

  // ─── Employee by Task Category & Compensation (for conversational queries) ───
  const empCatStats = await db
    .select({
      empId:      activityLogs.employeeId,
      fullName:   employees.fullName,
      department: employees.department,
      role:       employees.role,
      category:   activityLogs.taskCategory,
      annualInr:  employees.compAnnualInr,
      workHours:  employees.workingHoursDay,
      totalMins:  sql<number>`SUM(CAST(${activityLogs.durationMin} AS DECIMAL))`,
      repMins:    sql<number>`SUM(CASE WHEN ${activityLogs.isRepetitive} THEN CAST(${activityLogs.durationMin} AS DECIMAL) ELSE 0 END)`,
    })
    .from(activityLogs)
    .leftJoin(employees, eq(activityLogs.employeeId, employees.employeeId))
    .groupBy(activityLogs.employeeId, employees.fullName, employees.department, employees.role, activityLogs.taskCategory, employees.compAnnualInr, employees.workingHoursDay)
    .orderBy(sql`SUM(CASE WHEN ${activityLogs.isRepetitive} THEN CAST(${activityLogs.durationMin} AS DECIMAL) ELSE 0 END) DESC`)
    .limit(60);

    const employeeTaskCategoryBreakdown = empCatStats.map(ec => {
    const repH = Number(ec.repMins) / 60;
    const totH = Number(ec.totalMins) / 60;
    let monthlyCost: number | null = null;
    if (ec.annualInr) {
      const hourlyRate = Number(ec.annualInr) / (260 * (ec.workHours ?? 8));
      monthlyCost = Math.round(repH * (30 / 28) * hourlyRate);
    }
    return {
      employeeId: ec.empId,
      name: ec.fullName ?? ec.empId,
      department: ec.department ?? 'Unknown',
      role: ec.role ?? 'Unknown',
      category: ec.category ?? 'Uncategorized',
      totalHours: Math.round(totH * 10) / 10,
      repetitiveHours: Math.round(repH * 10) / 10,
      monthlyRepCostInr: monthlyCost,
    };
  });

  // Weekly employee progression to answer week-over-week trends cleanly without hallucination
  const weeklyEmpQuery = await db
    .select({
      empId: activityLogs.employeeId,
      fullName: employees.fullName,
      department: employees.department,
      weekNumber: activityLogs.weekNumber,
      totalMins: sql<number>`SUM(CAST(${activityLogs.durationMin} AS DECIMAL))`,
      repMins: sql<number>`SUM(CASE WHEN ${activityLogs.isRepetitive} THEN CAST(${activityLogs.durationMin} AS DECIMAL) ELSE 0 END)`,
    })
    .from(activityLogs)
    .leftJoin(employees, eq(activityLogs.employeeId, employees.employeeId))
    .groupBy(activityLogs.employeeId, employees.fullName, employees.department, activityLogs.weekNumber)
    .orderBy(activityLogs.employeeId, activityLogs.weekNumber);

  const weeklyEmployeeTrajectory = weeklyEmpQuery.map(w => {
    const tH = Number(w.totalMins) / 60;
    const rH = Number(w.repMins) / 60;
    const repPct = tH > 0 ? (rH / tH) * 100 : 0;
    return {
      employeeId: w.empId,
      name: w.fullName ?? w.empId,
      department: w.department ?? 'Unknown',
      weekNumber: w.weekNumber,
      totalHours: Math.round(tH * 10) / 10,
      repHours: Math.round(rH * 10) / 10,
      repSharePct: Math.round(repPct * 10) / 10,
    };
  });

  return {
    datasetInfo: {
      totalEmployees: Number(totalStats.empCount),
      departments: depts.map(d => d.dept!).filter(Boolean),
      weeksSpanned: Number(totalStats.maxWeek),
      totalHours: Math.round(totalHrs * 10) / 10,
      totalRepetitiveHours: Math.round(repHrs * 10) / 10,
      repetitiveSharePct: Math.round(repShare * 10) / 10,
    },
    headlineMetrics: {
      hoursRecoverablePerMonth: Math.round(repHrs * (30 / 28) * 10) / 10,
      inrRecoverablePerMonth: topRepEmployees.reduce((sum, e) => sum + (e.monthlyRepCostInr ?? 0), 0),
    },
    topRepetitiveEmployees: topRepEmployees,
    departmentBreakdown,
    categoryBreakdown,
    weeklyEmployeeTrajectory,
    employeeTaskCategoryBreakdown,
    anomalies: [],
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Ultra token-efficient Markdown Table generator for AI Prompt Context.
 * Reduces token consumption by 85%+ compared to raw verbose JSON.
 */
export async function buildCompactAIPrompt(): Promise<string> {
  const data = await buildAIContext();
  const lines: string[] = [];

  lines.push('### GLOBAL WORKFORCE METRICS');
  lines.push(`Staff Total: ${data.datasetInfo.totalEmployees} | Depts: ${data.datasetInfo.departments.join(', ')} | Weeks Monitored: ${data.datasetInfo.weeksSpanned}`);
  lines.push(`Total Logged Time: ${data.datasetInfo.totalHours}h | Repetitive Mechanical Work: ${data.datasetInfo.totalRepetitiveHours}h (${data.datasetInfo.repetitiveSharePct}%)`);
  lines.push(`Est. Recoverable Bandwidth: ${data.headlineMetrics.hoursRecoverablePerMonth} hrs/mo | Monthly INR Recovery Potential: ₹${data.headlineMetrics.inrRecoverablePerMonth.toLocaleString('en-IN')}/mo\n`);

  lines.push('### DEPARTMENTAL TOTALS (Dept | Total Hrs | Rep Hrs | Rep Share % | Staff Count)');
  for (const d of data.departmentBreakdown) {
    lines.push(`${d.department} | ${d.totalHours}h | ${d.repHours}h | ${d.repSharePct}% | ${d.employeeCount}`);
  }
  lines.push('');

  lines.push('### TOP AUTOMATION CATEGORIES (Category | Total Hrs | Rep Hrs | Rep Share % | Priority Index)');
  for (const c of data.categoryBreakdown) {
    lines.push(`${c.category} | ${c.totalHours}h | ${c.repHours}h | ${c.repSharePct}% | Score: ${c.score}`);
  }
  lines.push('');

  lines.push('### INDIVIDUAL EMPLOYEE ACTIVITY BREAKDOWN (Emp ID | Name | Dept | Role | Task Category | Rep Hours / Total Hours | Est. Monthly Cost INR)');
  // Take the most meaningful activity records (repHours > 0 or top tasks) to minimize tokens while keeping exact facts
  for (const item of data.employeeTaskCategoryBreakdown) {
    if (item.repetitiveHours > 0 || item.totalHours >= 2) {
      lines.push(`${item.employeeId} | ${item.name} | ${item.department} | ${item.role} | ${item.category} | ${item.repetitiveHours}h / ${item.totalHours}h | ₹${item.monthlyRepCostInr ? item.monthlyRepCostInr.toLocaleString('en-IN') : '0'}`);
    }
  }
  lines.push('');

  lines.push('### WEEK-OVER-WEEK EMPLOYEE TRAJECTORY (Emp ID | Name | Dept | Week | Total Hrs | Repetitive Hrs | Rep Share %)');
  for (const w of data.weeklyEmployeeTrajectory) {
    lines.push(`${w.employeeId} | ${w.name} | ${w.department} | Wk ${w.weekNumber} | ${w.totalHours}h | ${w.repHours}h | ${w.repSharePct}%`);
  }

  return lines.join('\n');
}
