---
tags: [data, etl, csv, pipeline, audit]
aliases: [Data Ingestion, ETL]
---
# Workforce Pulse — Data Ingestion & Hygiene Audit Report

This document records the exact programmatic procedures designed to resolve enterprise data inconsistencies, schema corruption, and dirty formatting within the input datasets (`employees.json` and `activity_logs.csv`).

---

## 1. Executive Summary of Ingestion Health

Our ingestion service (`backend/src/services/ingestion/joiner.ts`) processes multi-source raw logs through a strict validation, type-casting, and normalization pipeline before committing records to PostgreSQL via Drizzle ORM.

| Data Source | Primary Challenge | Solution Implemented | Status |
| :--- | :--- | :--- | :---: |
| **`activity_logs.csv`** | 11 Boolean variants, negative durations, 5 time formats | REGEX canonicalization, Date-FNS parsing, clamp/flag rules | ✅ Automated |
| **`employees.json`** | Mixed casing keys, duplicate IDs, varying compensation currencies | Defensive Zod/TypeScript resolution, active preference rules | ✅ Automated |

---

## 2. Activity Logs (`activity_logs.csv`) Hygiene Rules

### A. Boolean Canonicalization (`is_repetitive`)
Raw CSV entries exhibit high variance in user entered boolean text. Our ingestion filter maps these directly to strict SQL `BOOLEAN` types:
- **Truthy Domain**: `TRUE`, `true`, `True`, `1`, `yes`, `YES`, `Yes`, `y`, `Y`, `t`, `T` $\rightarrow$ **`true`**
- **Falsy Domain**: `FALSE`, `false`, `False`, `0`, `no`, `NO`, `No`, `n`, `N`, `f`, `F`, `na`, `NA`, `null`, `none`, `""` $\rightarrow$ **`false`**
*(Original text strings are preserved in `raw_is_repetitive` column for downstream legal or HR audit trails).*

### B. Timestamp & Timezone Normalization (`timestamp_ist`)
Timestamps appear across 5 conflicting formats. The parser dynamically tests and resolves formats into absolute UTC representations bound to Indian Standard Time (`Asia/Kolkata`):
1. **ISO 8601**: `2025-10-14T09:23:00Z`
2. **Standard SQL**: `2025-10-14 09:23:00`
3. **US Date-Time**: `10/14/2025 09:23:00` or `10/14/2025 09:23`
4. **Euro/IN Date-Time**: `14-10-2025 09:23`
*(Unparseable timestamps result in line rejection, incrementing `rows_dropped` counter).*

### C. Duration Anomalies & Clamping (`duration_min`)
- **Negative Durations (e.g., `-30`)**: Corrected immediately to `0`, flagged with `fixed_negative_duration` tag in the database to record automated intervention.
- **Extreme Outliers (e.g., `1200` min / 20 hours in single session)**: Retained for transparency but tagged with `flagged_outlier_duration` to trigger Z-score anomaly notices in the executive dashboard.

---

## 3. HRMS Metadata (`employees.json`) Hygiene Rules

### A. Schema & Casing Normalization
The HRMS JSON structure exhibits inconsistent casing between records (e.g., `employee_id` vs `EmployeeID`, `department` vs `Dept`). Our ingestor utilizes defensive fallback resolution:
```typescript
const employeeId = normalizeEmployeeId(getField(emp, 'employee_id', 'EmployeeID', 'employeeid', 'id'));
const department = String(getField(emp, 'department', 'Dept', 'dept', 'Department') ?? 'Unknown').trim();
```

### B. Duplicate Record Resolution (The `E007` Case)
When duplicate IDs occur within the source file (e.g., two entries for `E007`: "Meera Iyer" vs "M. Iyer"):
1. The ingestion pipeline records the conflict inside `ingestion_runs.notes`.
2. **Active vs Terminated**: If one entry is marked `status: terminated` and the other `active`, the active record supersedes the terminated one.
3. **Fidelity Resolution**: The record with higher field completeness (full name vs initials, complete compensation structures) is retained.

### C. Compensation Currency & Period Triangulation
Employees are remunerated via three completely different numerical frameworks:
- **`annual_inr`** (e.g., `1200000` $\rightarrow$ ₹12,00,000 / yr)
- **`lpa` (Lakhs Per Annum)** (e.g., `7.5` $\rightarrow$ multiplied by $100,000 = $ ₹7,50,000 / yr)
- **`hourly_inr`** (e.g., `750` $\rightarrow$ multiplied by $8\text{ hrs} \times 260\text{ days} = $ ₹15,60,000 / yr)

---

## 4. Cross-Reference Reconciliation (Orphan & Unmatched Records)

### A. Activity without HRMS Profile (`employees_no_meta`)
When an activity log references an ID (`EUNKNOWN`) absent from `employees.json`:
- A placeholder employee profile is constructed automatically in Postgres with `has_metadata = false`.
- Prevents foreign key constraint violations while highlighting unindexed personnel on the dashboard.

### B. HRMS Profile without Activity Logs (`metadata_no_activity`)
When an HRMS employee (`E016`, `E017`, or terminated staff like `E010` post-termination) logs zero tasks:
- The employee record is maintained with `has_activity = false`.
- Excluded from denominator in average organizational hour calculations to preserve mathematical accuracy.
