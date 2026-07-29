/**
 * Normalize compensation to annual INR regardless of source format.
 * Supports: annual_inr, hourly_inr, lpa (lakhs per annum)
 */
export function normalizeToAnnualINR(
  value: number | null | undefined,
  unit: 'annual_inr' | 'hourly_inr' | 'lpa' | 'unknown'
): { annualInr: number; source: string } | null {
  if (value == null || value <= 0) return null;

  switch (unit) {
    case 'annual_inr':
      return { annualInr: value, source: 'annual_inr' };
    case 'hourly_inr':
      // 8 hours/day × 260 working days/year
      return { annualInr: value * 8 * 260, source: 'hourly_inr' };
    case 'lpa':
      // Lakhs per annum → INR
      return { annualInr: value * 100_000, source: 'lpa' };
    default:
      // Guess: if > 50,000 → likely annual INR; if < 5,000 → likely hourly; else LPA
      if (value > 100_000) return { annualInr: value, source: 'annual_inr_guessed' };
      if (value < 5_000)   return { annualInr: value * 8 * 260, source: 'hourly_inr_guessed' };
      return { annualInr: value * 100_000, source: 'lpa_guessed' };
  }
}

/**
 * Parse working hours from string or object formats
 * "9-18" → 9 hours/day
 * {"start": "09:00", "end": "18:00"} → 9 hours/day
 */
export function parseWorkingHours(raw: unknown): number {
  if (typeof raw === 'number') return raw;
  if (typeof raw === 'string') {
    // "9-18" format
    const match = raw.match(/^(\d{1,2})-(\d{2})$/);
    if (match) {
      return parseInt(match[2]) - parseInt(match[1]);
    }
    // "8" or "8h"
    const num = parseFloat(raw);
    if (!isNaN(num) && num > 0 && num <= 24) return num;
  }
  if (typeof raw === 'object' && raw !== null) {
    const obj = raw as Record<string, string>;
    if (obj.start && obj.end) {
      const [sh, sm = '0'] = obj.start.split(':');
      const [eh, em = '0'] = obj.end.split(':');
      const startMins = parseInt(sh) * 60 + parseInt(sm);
      const endMins   = parseInt(eh) * 60 + parseInt(em);
      return (endMins - startMins) / 60;
    }
  }
  return 8; // safe default
}
