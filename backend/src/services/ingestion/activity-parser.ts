import Papa from 'papaparse';
import fs from 'fs';
import path from 'path';
import { parseToIST, getWeekNumber } from '../../utils/ist';
import { canonicalizeApp, canonicalizeCategory } from '../../utils/canonical-maps';
import { NewActivityLog } from '../../db/schema';

// Truthy set for is_repetitive normalization
const TRUTHY_SET = new Set(['true', '1', 'yes', 'y', 't']);
const FALSY_SET  = new Set(['false', '0', 'no', 'n', 'f', 'na', 'null', 'none', '']);

export interface ParseResult {
  rows: NewActivityLog[];
  stats: {
    raw: number;
    clean: number;
    dropped: number;
    fixed: number;
    flagged: number;
  };
  datasetStart: Date;
  datasetEnd: Date;
}

export async function parseActivityCSV(filePath: string): Promise<ParseResult> {
  const csvText = fs.readFileSync(filePath, 'utf-8');

  const { data: rawRows } = Papa.parse(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim().toLowerCase().replace(/\s+/g, '_'),
  });

  const stats = { raw: rawRows.length, clean: 0, dropped: 0, fixed: 0, flagged: 0 };
  const cleanRows: NewActivityLog[] = [];
  const seenKeys = new Set<string>();
  const timestamps: Date[] = [];

  for (const raw of rawRows as Record<string, string>[]) {
    const flags: string[] = [];

    // ─── employee_id ───────────────────────────────────────────
    const employeeId = (raw.employee_id ?? raw.employeeid ?? '').trim();
    if (!employeeId) { stats.dropped++; continue; }

    // ─── timestamp ─────────────────────────────────────────────
    const tsRaw = raw.timestamp ?? raw.date ?? '';
    const parsedTs = parseToIST(tsRaw);
    if (!parsedTs) { stats.dropped++; continue; }
    timestamps.push(parsedTs);

    // ─── app_used ──────────────────────────────────────────────
    const appUsed = canonicalizeApp(raw.app_used);

    // ─── task_category ─────────────────────────────────────────
    const taskCategory = canonicalizeCategory(raw.task_category);
    if (!raw.task_category || raw.task_category.trim() === '') {
      flags.push('missing_task_category');
      stats.flagged++;
    }

    // ─── duration_minutes ──────────────────────────────────────
    const rawDur = raw.duration_minutes ?? raw.duration_min ?? '';
    let duration = parseFloat(rawDur);

    if (isNaN(duration) || rawDur.trim() === '') {
      stats.dropped++;
      continue; // blank duration → no signal value
    }

    if (duration < 0) {
      duration = 0;
      flags.push('fixed_negative_duration');
      stats.fixed++;
    } else if (duration === 0) {
      stats.dropped++;
      continue; // zero duration → no value
    } else if (duration > 960) {
      flags.push('flagged_outlier_duration');
      stats.flagged++;
    }

    // ─── is_repetitive ─────────────────────────────────────────
    const repRaw = (raw.is_repetitive ?? '').trim();
    const repKey = repRaw.toLowerCase();
    let isRepetitive: boolean;

    if (TRUTHY_SET.has(repKey)) {
      isRepetitive = true;
    } else if (FALSY_SET.has(repKey)) {
      isRepetitive = false;
    } else {
      isRepetitive = false; // conservative default
      flags.push('ambiguous_is_repetitive');
      stats.flagged++;
    }

    // ─── department ────────────────────────────────────────────
    const department = (raw.department ?? '').trim() || null;

    // ─── Dedup check ───────────────────────────────────────────
    const dedupKey = `${employeeId}|${parsedTs.toISOString()}|${appUsed}|${taskCategory}|${duration}`;
    if (seenKeys.has(dedupKey)) {
      stats.dropped++;
      continue;
    }
    seenKeys.add(dedupKey);

    if (flags.length > 0 && !flags.some(f => f.startsWith('fixed'))) {
      stats.flagged++;
    }

    cleanRows.push({
      employeeId,
      department,
      timestampIst: parsedTs,
      weekNumber: 1, // will be set after we know dataset start
      appUsed,
      taskCategory,
      durationMin: String(duration),
      isRepetitive,
      rawIsRepetitive: repRaw,
      ingestionFlags: flags,
    });

    stats.clean++;
  }

  // Assign week numbers now that we have dataset range
  const datasetStart = timestamps.length > 0
    ? new Date(Math.min(...timestamps.map(t => t.getTime())))
    : new Date();
  const datasetEnd = timestamps.length > 0
    ? new Date(Math.max(...timestamps.map(t => t.getTime())))
    : new Date();

  for (const row of cleanRows) {
    row.weekNumber = getWeekNumber(row.timestampIst as Date, datasetStart);
  }

  stats.dropped = stats.raw - stats.clean;

  return { rows: cleanRows, stats, datasetStart, datasetEnd };
}
