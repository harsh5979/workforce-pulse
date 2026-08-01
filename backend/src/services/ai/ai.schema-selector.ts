import OpenAI from 'openai';
import { chatbotTools } from './tools';

// ── Selective tool schema injector ───────────────────────────────────────────
// Instead of sending all 5 tool schemas on every Step 1 call (~380 tokens),
// we detect the most likely tool from the user's message and send only that
// schema (~40–80 tokens).
//
// Token savings per request: ~305 tokens (from ~380 → ~75)
//
// Fallback: if the message is ambiguous, we return the employee analytics schema
// (the most commonly used tool). The LLM will either call it correctly or return
// a direct answer — both are safe outcomes.

// Individual schema references (indexed from chatbotTools array in tools.ts)
const [
  SCHEMA_EMPLOYEE,   // get_employee_analytics
  SCHEMA_DEPARTMENT, // get_department_analytics
  SCHEMA_CATEGORY,   // get_category_metrics
  SCHEMA_TRENDS,     // get_weekly_trends
  SCHEMA_ANOMALIES,  // get_system_anomalies
] = chatbotTools;

export function selectToolSchemas(
  message: string
): OpenAI.Chat.ChatCompletionTool[] {
  const m = message.toLowerCase();

  // Anomaly/outlier queries → get_system_anomalies
  if (/\b(anomal|outlier|unusual|abnormal|flagged)\b/.test(m))
    return [SCHEMA_ANOMALIES];

  // Category / automation ROI queries → get_category_metrics
  if (/\b(categor|automat|roi|priority|task\s*type|highest.{0,10}roi)\b/.test(m))
    return [SCHEMA_CATEGORY];

  // Weekly / trend queries → get_weekly_trends
  if (/\b(trend|week|weekly|over\s*time|progress)\b/.test(m))
    return [SCHEMA_TRENDS];

  // Dept-level analytics when no employee listing words present
  // e.g. "Finance overview" / "Sales stats" — NOT "list Finance employees"
  const hasDept   = /\b(sales|finance|ops|operations|cs|hr|marketing)\b/.test(m);
  const hasEmpList = /\b(employ|staff|list|all|top|people|worker)\b/.test(m);
  if (hasDept && !hasEmpList)
    return [SCHEMA_DEPARTMENT];

  // Default → employee analytics (covers most queries, also works as list)
  return [SCHEMA_EMPLOYEE];
}
