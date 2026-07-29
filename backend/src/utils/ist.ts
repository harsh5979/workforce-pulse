import { fromZonedTime, toZonedTime, format } from 'date-fns-tz';
import { parse, isValid } from 'date-fns';

const IST = 'Asia/Kolkata';

// Attempt to parse a timestamp string in multiple formats → UTC Date
export function parseToIST(raw: string | null | undefined): Date | null {
  if (!raw || raw.trim() === '') return null;

  const str = raw.trim();

  // Try ISO 8601 first
  let d = new Date(str);
  if (isValid(d)) return d;

  // Try MM/DD/YYYY HH:mm:ss
  d = parse(str, 'MM/dd/yyyy HH:mm:ss', new Date());
  if (isValid(d)) return fromZonedTime(d, IST);

  // Try MM/DD/YYYY HH:mm
  d = parse(str, 'MM/dd/yyyy HH:mm', new Date());
  if (isValid(d)) return fromZonedTime(d, IST);

  // Try DD-MM-YYYY HH:mm
  d = parse(str, 'dd-MM-yyyy HH:mm', new Date());
  if (isValid(d)) return fromZonedTime(d, IST);

  // Try YYYY-MM-DD HH:mm:ss (without TZ — assume IST)
  d = parse(str, 'yyyy-MM-dd HH:mm:ss', new Date());
  if (isValid(d)) return fromZonedTime(d, IST);

  return null;
}

// Get week number (1-4) relative to dataset start date
export function getWeekNumber(date: Date, datasetStart: Date): number {
  const diffMs = date.getTime() - datasetStart.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  return Math.min(4, Math.floor(diffDays / 7) + 1);
}

// Format a Date in IST for display
export function formatIST(date: Date): string {
  return format(toZonedTime(date, IST), 'yyyy-MM-dd HH:mm:ss', { timeZone: IST });
}
