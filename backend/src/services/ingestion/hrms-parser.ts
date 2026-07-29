import fs from 'fs';
import { normalizeToAnnualINR, parseWorkingHours } from '../../utils/compensation';
import { NewEmployee } from '../../db/schema';

export interface HRMSParseResult {
  employees: NewEmployee[];
  stats: {
    total: number;
    duplicateIds: string[];
    terminatedCount: number;
  };
}

function getField(obj: Record<string, unknown>, ...keys: string[]): unknown {
  for (const key of keys) {
    if (obj[key] !== undefined && obj[key] !== null) return obj[key];
  }
  return null;
}

function normalizeEmployeeId(id: unknown): string | null {
  if (typeof id === 'string') return id.trim().toUpperCase();
  if (typeof id === 'number') return String(id);
  return null;
}

export async function parseHRMSJson(filePath: string): Promise<HRMSParseResult> {
  const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

  // Handle wrapped format: { data: { employees: [...] } } or direct array
  let rawEmployees: unknown[] = [];
  if (Array.isArray(raw)) {
    rawEmployees = raw;
  } else if (raw.data?.employees) {
    rawEmployees = raw.data.employees;
  } else if (raw.employees) {
    rawEmployees = raw.employees;
  } else {
    throw new Error('Cannot locate employee array in HRMS JSON');
  }

  const seenIds = new Map<string, NewEmployee>();
  const duplicateIds: string[] = [];
  let terminatedCount = 0;

  for (const emp of rawEmployees as Record<string, unknown>[]) {
    // ─── employee_id (try both casing variants) ──────────────
    const rawId = getField(emp, 'employee_id', 'EmployeeID', 'employeeid', 'id');
    const employeeId = normalizeEmployeeId(rawId);
    if (!employeeId) continue;

    // ─── department (try both key names) ─────────────────────
    const department = String(
      getField(emp, 'department', 'Dept', 'dept', 'Department') ?? 'Unknown'
    ).trim();

    // ─── role (flat or nested under meta) ────────────────────
    const meta = emp.meta as Record<string, unknown> | null;
    const role = String(
      getField(emp, 'role', 'Role') ?? meta?.role ?? 'Unknown'
    ).trim();

    // ─── tenure ──────────────────────────────────────────────
    const tenureRaw = getField(emp, 'tenure', 'tenure_years', 'Tenure');
    const tenureYears = tenureRaw != null ? String(parseFloat(String(tenureRaw)) || 0) : null;

    // ─── compensation ─────────────────────────────────────────
    const compObj = emp.compensation as Record<string, unknown> | null ?? emp;
    let compResult = null;

    if (compObj?.annual_inr)  compResult = normalizeToAnnualINR(Number(compObj.annual_inr), 'annual_inr');
    else if (compObj?.hourly_inr) compResult = normalizeToAnnualINR(Number(compObj.hourly_inr), 'hourly_inr');
    else if (compObj?.lpa)    compResult = normalizeToAnnualINR(Number(compObj.lpa), 'lpa');
    else {
      const compValue = Number(getField(emp, 'salary', 'compensation', 'comp') ?? 0);
      compResult = normalizeToAnnualINR(compValue, 'unknown');
    }

    // ─── working_hours ────────────────────────────────────────
    const whRaw = getField(emp, 'working_hours', 'workingHours', 'work_hours');
    const workingHoursDay = parseWorkingHours(whRaw);

    // ─── status ───────────────────────────────────────────────
    const status = String(getField(emp, 'status', 'Status') ?? 'active').toLowerCase();
    const terminatedOn = (emp.terminated_on ?? emp.terminatedOn) as string | null;
    if (status === 'terminated' || terminatedOn) terminatedCount++;

    // ─── name ─────────────────────────────────────────────────
    const fullName = String(
      getField(emp, 'name', 'full_name', 'fullName', 'employee_name') ?? employeeId
    ).trim();

    const normalizedEmployee: NewEmployee = {
      employeeId,
      fullName,
      department,
      role,
      tenureYears,
      compAnnualInr: compResult ? String(compResult.annualInr) : null,
      compSource: compResult?.source ?? null,
      workingHoursDay,
      status: status === 'terminated' ? 'terminated' : 'active',
      terminatedOn: terminatedOn ?? null,
      hasActivity: true,   // will be updated by joiner
      hasMetadata: true,
      rawData: emp,
    };

    // ─── Duplicate handling ───────────────────────────────────
    if (seenIds.has(employeeId)) {
      duplicateIds.push(employeeId);
      const existing = seenIds.get(employeeId)!;
      // Keep active over terminated; otherwise keep first seen
      if (existing.status === 'terminated' && normalizedEmployee.status === 'active') {
        seenIds.set(employeeId, normalizedEmployee);
      }
    } else {
      seenIds.set(employeeId, normalizedEmployee);
    }
  }

  return {
    employees: Array.from(seenIds.values()),
    stats: {
      total: rawEmployees.length,
      duplicateIds,
      terminatedCount,
    },
  };
}
