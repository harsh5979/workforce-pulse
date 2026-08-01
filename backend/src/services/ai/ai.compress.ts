// ── Tool result compressor ───────────────────────────────────────────────────
// Converts verbose JSON tool responses to compact pipe-delimited strings.
// Reduces tool message token count by 50–70% — critical since tool results
// are included in the Step 3 prompt context.
//
// Example: 15-employee list JSON (~500 tokens) → pipe table (~150 tokens)

export function compressToolResult(toolName: string, result: any): string {
  try {

    // ── get_employee_analytics ───────────────────────────────────────────────
    if (toolName === 'get_employee_analytics') {

      // Paginated list result
      if (result.status === 'list' && Array.isArray(result.results)) {
        const rows = result.results.map((e: any) =>
          `${e.employeeId}|${e.fullName}|${e.department}|${e.role}|${e.totalHours}h|${e.repetitiveHours}h|${e.repSharePct}%`
        ).join('\n');
        return `EmpID|Name|Dept|Role|TotalHrs|RepHrs|Rep%\n${rows}\ntotal:${result.totalCount} page:${result.page}`;
      }

      // Multiple fuzzy-name matches — user must clarify
      if (result.status === 'multiple_matches') {
        return `MULTIPLE_MATCHES: ${result.matches.map((m: any) =>
          `${m.employeeId}(${m.fullName},${m.department})`
        ).join(', ')}`;
      }
    }

    // ── get_department_analytics ─────────────────────────────────────────────
    if (toolName === 'get_department_analytics' && result.status === 'success') {
      const cats = (result.topCategories ?? []).map((c: any) =>
        `${c.category}:${c.totalHours}h/${c.repetitiveHours}h(${c.repSharePct}%)`
      ).join(' | ');
      return `dept:${result.department} staff:${result.headcount} total:${result.totalHours}h rep:${result.repetitiveHours}h(${result.repSharePct}%)\ncats: ${cats}`;
    }

    // ── get_category_metrics ─────────────────────────────────────────────────
    if (toolName === 'get_category_metrics' && result.status === 'success') {
      const rows = (result.categories ?? []).map((c: any) =>
        `${c.category}|${c.totalHours}h|${c.repetitiveHours}h|${c.repSharePct}%|${c.priorityScore}`
      ).join('\n');
      return `Category|TotalHrs|RepHrs|Rep%|Score\n${rows}`;
    }

    // ── get_weekly_trends ────────────────────────────────────────────────────
    if (toolName === 'get_weekly_trends' && result.status === 'success') {
      return Object.entries(result.trends ?? {}).map(([dept, weeks]: [string, any]) =>
        `${dept}: ${(weeks as any[]).map((w: any) => `W${w.week}:${w.repSharePct}%`).join(' ')}`
      ).join('\n');
    }

  } catch { /* fallback below */ }

  // Fallback: raw JSON (only for unknown/error responses)
  return JSON.stringify(result);
}
