/**
 * All number formatting utilities. ALWAYS use these — never format inline.
 */

/** Format INR in Indian numbering system: ₹1,23,456 */
export function formatINR(amount: number | null | undefined): string {
  if (amount == null || isNaN(amount)) return '₹—';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

/** Format hours with 1 decimal: 42.3 hrs */
export function formatHours(hours: number | null | undefined): string {
  if (hours == null || isNaN(hours)) return '—';
  return `${hours.toFixed(1)} hrs`;
}

/** Format percentage with 1 decimal: 67.8% */
export function formatPct(value: number | null | undefined): string {
  if (value == null || isNaN(value)) return '—';
  return `${value.toFixed(1)}%`;
}

/** Format count with commas: 1,234 */
export function formatCount(value: number | null | undefined): string {
  if (value == null || isNaN(value)) return '—';
  return new Intl.NumberFormat('en-IN').format(Math.round(value));
}

/** Compact INR for charts: ₹12L, ₹4.5K */
export function formatINRCompact(amount: number): string {
  if (amount >= 100_000) return `₹${(amount / 100_000).toFixed(1)}L`;
  if (amount >= 1_000)   return `₹${(amount / 1_000).toFixed(1)}K`;
  return `₹${Math.round(amount)}`;
}

/** Score to visual label */
export function scoreLabel(score: number): string {
  if (score >= 0.7) return 'Very High';
  if (score >= 0.5) return 'High';
  if (score >= 0.3) return 'Medium';
  return 'Low';
}
