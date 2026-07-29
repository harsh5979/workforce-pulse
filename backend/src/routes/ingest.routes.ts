import { Router } from 'express';
import { runIngestion } from '../services/ingestion/joiner';
import { logger } from '../utils/logger';
import { db } from '../config/db';
import { activityLogs, employees } from '../db/schema';
import { eq, inArray } from 'drizzle-orm';
import fs from 'fs/promises';
import path from 'path';

const router = Router();
const DATA_DIR = path.resolve(__dirname, '../../../../data');

// Default system-wide re-ingestion
router.post('/', async (req, res) => {
  try {
    logger.info('Ingestion triggered via API');
    const result = await runIngestion();
    res.json(result);
  } catch (err: any) {
    logger.error('Ingestion failed:', err);
    res.status(500).json({ error: err.message });
  }
});

// Real-time custom CSV import: Employees (HRMS Records)
router.post('/employees', async (req, res) => {
  try {
    const { employees: payload } = req.body;
    if (!Array.isArray(payload) || payload.length === 0) {
      return res.status(400).json({ success: false, message: 'Invalid or empty employee payload.' });
    }

    logger.info(`Received custom CSV import for ${payload.length} employee records`);
    let added = 0;
    let updated = 0;
    const warnings: Array<{ row: number; id: string; reason: string }> = [];
    const failures: Array<{ row: number; id: string; reason: string }> = [];

    // Fetch existing employees from DB
    const existingRows = await db.select({ id: employees.employeeId }).from(employees);
    const existingIds = new Set(existingRows.map(r => r.id));

    const toInsert: any[] = [];

    payload.forEach((item: any, index: number) => {
      const rowNum = index + 1;
      const empId = String(item.employee_id || '').trim().toUpperCase();
      if (!empId || empId === 'UNDEFINED' || empId === 'NULL') {
        failures.push({ row: rowNum, id: 'N/A', reason: 'Missing required Primary Key: employee_id. Row discarded.' });
        return;
      }

      const fullName = String(item.full_name || empId).trim();
      if (!item.full_name) {
        warnings.push({ row: rowNum, id: empId, reason: 'Missing full_name field; defaulted to Employee ID string.' });
      }

      const department = item.department ? String(item.department).trim() : 'General';
      const role = item.role ? String(item.role).trim() : 'Staff Operations';
      
      // Validate salary
      let compAnnualInr: string | null = null;
      if (item.comp_annual_inr !== undefined && item.comp_annual_inr !== null && item.comp_annual_inr !== '') {
        const cleaned = String(item.comp_annual_inr).replace(/[^0-9.]/g, '');
        const parsed = parseFloat(cleaned);
        if (!isNaN(parsed) && parsed >= 0) {
          compAnnualInr = parsed.toFixed(2);
        } else {
          warnings.push({ row: rowNum, id: empId, reason: `Unparseable or negative annual compensation (${item.comp_annual_inr}); assigned NULL.` });
        }
      }

      // Validate working hours
      let workingHoursDay = 8;
      if (item.working_hours_day !== undefined && item.working_hours_day !== '') {
        const parsedHours = parseInt(item.working_hours_day);
        if (!isNaN(parsedHours) && parsedHours >= 2 && parsedHours <= 16) {
          workingHoursDay = parsedHours;
        } else {
          warnings.push({ row: rowNum, id: empId, reason: `Daily working hours (${item.working_hours_day}h) out of standard boundaries (2h-16h); reset to standard 8h.` });
        }
      }

      const empData = {
        employeeId: empId,
        fullName,
        department,
        role,
        compAnnualInr,
        workingHoursDay,
        status: 'active',
        hasActivity: true,
        hasMetadata: true,
      };

      if (existingIds.has(empId)) {
        toInsert.push({ ...empData, _action: 'update', rowNum });
      } else {
        toInsert.push({ ...empData, _action: 'insert', rowNum });
        existingIds.add(empId);
      }
    });

    // Process valid records against PostgreSQL
    const newItems: any[] = [];
    for (const item of toInsert) {
      if (item._action === 'update') {
        try {
          await db.update(employees)
            .set({
              fullName: item.fullName,
              department: item.department,
              role: item.role,
              compAnnualInr: item.compAnnualInr,
              workingHoursDay: item.workingHoursDay,
              hasMetadata: true,
            })
            .where(eq(employees.employeeId, item.employeeId));
          updated++;
        } catch (dbErr: any) {
          failures.push({ row: item.rowNum, id: item.employeeId, reason: `Database update failure: ${dbErr.message}` });
        }
      } else {
        const { _action, rowNum, ...cleanItem } = item;
        newItems.push(cleanItem);
      }
    }

    if (newItems.length > 0) {
      try {
        await db.insert(employees).values(newItems);
        added = newItems.length;
      } catch (insertErr: any) {
        // Fallback row-by-row to catch specific failing constraint
        for (const single of newItems) {
          try {
            await db.insert(employees).values([single]);
            added++;
          } catch (e: any) {
            failures.push({ row: 0, id: single.employeeId, reason: `DB insert constraint violation: ${e.message}` });
          }
        }
      }
    }

    // Persist additions/updates to employees.json on disk for long-term consistency
    try {
      const hrmsPath = path.join(DATA_DIR, 'employees.json');
      const fileData = await fs.readFile(hrmsPath, 'utf-8');
      const hrmsJson = JSON.parse(fileData);
      const itemsList = Array.isArray(hrmsJson) ? hrmsJson : (hrmsJson.employees || []);
      const diskMap = new Map<string, any>(itemsList.map((e: any) => [e.employeeId || e.employee_id, e]));

      toInsert.forEach((item: any) => {
        const id = item.employeeId;
        const record = diskMap.get(id) || { employeeId: id, status: 'active' };
        record.employeeId = id;
        record.fullName = item.fullName;
        record.department = item.department;
        record.role = item.role;
        if (item.compAnnualInr) record.compAnnualInr = item.compAnnualInr;
        record.workingHoursDay = item.workingHoursDay;
        diskMap.set(id, record);
      });

      const newJsonContent = Array.isArray(hrmsJson) ? Array.from(diskMap.values()) : { ...hrmsJson, employees: Array.from(diskMap.values()) };
      await fs.writeFile(hrmsPath, JSON.stringify(newJsonContent, null, 2), 'utf-8');
    } catch (diskErr) {
      logger.warn('Could not update employees.json on disk during CSV import:', diskErr);
    }

    const totalSuccess = added + updated;
    res.json({
      success: true,
      stats: {
        totalProcessed: payload.length,
        successCount: totalSuccess,
        added,
        updated,
        warningCount: warnings.length,
        failedCount: failures.length,
        warnings,
        failures,
        message: `Processed ${payload.length} records: ${totalSuccess} successful (${added} created, ${updated} updated), ${failures.length} failed/skipped, ${warnings.length} warnings logged.`,
      },
    });
  } catch (err: any) {
    logger.error('Custom employee import failed:', err);
    res.status(500).json({ success: false, error: err.message || 'Database error during employee import.' });
  }
});

// Real-time custom CSV import: Activity Logs Telemetry
router.post('/activities', async (req, res) => {
  try {
    const { activities: payload } = req.body;
    if (!Array.isArray(payload) || payload.length === 0) {
      return res.status(400).json({ success: false, message: 'Invalid or empty activity log payload.' });
    }

    logger.info(`Received custom CSV import for ${payload.length} activity log entries`);

    const warnings: Array<{ row: number; id: string; reason: string }> = [];
    const failures: Array<{ row: number; id: string; reason: string }> = [];

    // 1. Fetch existing employees from DB to check references
    const existingEmps = await db.select({ id: employees.employeeId }).from(employees);
    const existingEmpSet = new Set(existingEmps.map(e => e.id));

    // 2. Fetch existing activity logs to prevent duplicates
    const existingLogsRows = await db.select({
      id: activityLogs.id,
      employeeId: activityLogs.employeeId,
      timestampIst: activityLogs.timestampIst,
      taskCategory: activityLogs.taskCategory,
    }).from(activityLogs);
    
    const existingLogsMap = new Map<string, number>();
    existingLogsRows.forEach(l => {
      const d = new Date(l.timestampIst);
      const dStr = !isNaN(d.getTime()) ? d.toISOString().split('T')[0] : '';
      existingLogsMap.set(`${l.employeeId}_${dStr}_${l.taskCategory}`, l.id);
    });

    const logsToInsert: any[] = [];
    const logsToUpdate: any[] = [];
    const csvAppendLines: string[] = [];
    const missingEmpsToCreate: Map<string, any> = new Map();

    payload.forEach((row: any, index: number) => {
      const rowNum = index + 1;
      const empId = String(row.employee_id || '').trim().toUpperCase();
      
      // Critical Validation: Missing employee ID
      if (!empId || empId === 'UNDEFINED' || empId === 'NULL') {
        failures.push({ row: rowNum, id: 'N/A', reason: 'Missing employee_id reference. Record discarded.' });
        return;
      }

      // Critical Validation: Duration check
      const rawDur = parseFloat(row.duration_min);
      if (isNaN(rawDur) || rawDur <= 0 || rawDur > 1440) {
        failures.push({ row: rowNum, id: empId, reason: `Invalid task duration (${row.duration_min} min). Duration must be strictly > 0 and <= 1440 min (24h). Row skipped.` });
        return;
      }

      // Warning Validation: Unregistered Employee ID in HRMS Directory
      if (!existingEmpSet.has(empId) && !missingEmpsToCreate.has(empId)) {
        warnings.push({ row: rowNum, id: empId, reason: `Employee ID (${empId}) is unregistered in HRMS directory. Auto-provisioning provisional tracking profile.` });
        missingEmpsToCreate.set(empId, {
          employeeId: empId,
          fullName: `Provisional Staff (${empId})`,
          department: 'Uncategorized Operations',
          role: 'External / Provisional Personnel',
          workingHoursDay: 8,
          status: 'active',
          hasActivity: true,
          hasMetadata: false,
        });
      }

      const dateStr = String(row.date || new Date().toISOString().split('T')[0]).trim();
      const taskCat = String(row.task_category || 'General Administration').trim();
      const isRep = String(row.is_repetitive || '').trim().toLowerCase() === 'true' || String(row.is_repetitive) === '1' || String(row.is_repetitive).toLowerCase() === 'yes';
      const notes = row.notes ? String(row.notes).trim() : '';

      const dateObj = new Date(dateStr);
      const dayOfMonth = !isNaN(dateObj.getTime()) ? dateObj.getDate() : 15;
      const weekNum = Math.min(4, Math.max(1, Math.ceil(dayOfMonth / 7)));

      // Duplicate detection
      const dStr = !isNaN(dateObj.getTime()) ? dateObj.toISOString().split('T')[0] : '';
      const uniqueKey = `${empId}_${dStr}_${taskCat}`;
      
      const recordData = {
        employeeId: empId,
        taskCategory: taskCat,
        durationMin: String(rawDur),
        isRepetitive: isRep,
        timestampIst: !isNaN(dateObj.getTime()) ? dateObj : new Date(),
        weekNumber: weekNum,
      };

      const existingId = existingLogsMap.get(uniqueKey);
      if (existingId) {
        logsToUpdate.push({ id: existingId, ...recordData });
      } else {
        logsToInsert.push(recordData);
        // Mark as inserted to prevent duplicates within the same upload from being inserted twice
        // (we just map it to a dummy id so subsequent rows in same upload update it? Or just skip)
        existingLogsMap.set(uniqueKey, -1); 
      }

      csvAppendLines.push(`${empId},${dateStr},${rawDur},${taskCat},${isRep},${notes}`);
    });

    // Auto-create provisional employees to guarantee foreign key integrity
    const autoCreatedList = Array.from(missingEmpsToCreate.values());
    if (autoCreatedList.length > 0) {
      try {
        await db.insert(employees).values(autoCreatedList).onConflictDoNothing();
        logger.info(`Auto-created ${autoCreatedList.length} provisional employee records during telemetry import`);
      } catch (e: any) {
        logger.warn(`Failed to insert provisional employees: ${e.message}`);
      }
    }

    // Insert new activity logs in batches of 100
    const BATCH_SIZE = 100;
    let totalInserted = 0;
    for (let i = 0; i < logsToInsert.length; i += BATCH_SIZE) {
      const batch = logsToInsert.slice(i, i + BATCH_SIZE);
      try {
        await db.insert(activityLogs).values(batch);
        totalInserted += batch.length;
      } catch (err: any) {
        logger.warn(`Batch insert failed, falling back to row-by-row. Error: ${err.message}`);
        for (const single of batch) {
          try {
            await db.insert(activityLogs).values([single]);
            totalInserted++;
          } catch (e: any) {
            failures.push({ row: 0, id: single.employeeId, reason: `DB insert error: ${e.message}` });
          }
        }
      }
    }

    // Process Updates
    let totalUpdated = 0;
    for (const update of logsToUpdate) {
      if (update.id === -1) {
        // Was a duplicate within the same upload, skip updating since it hasn't been committed yet
        continue;
      }
      try {
        await db.update(activityLogs)
          .set({
            durationMin: update.durationMin,
            isRepetitive: update.isRepetitive,
          })
          .where(eq(activityLogs.id, update.id));
        totalUpdated++;
      } catch (err: any) {
        failures.push({ row: 0, id: update.employeeId, reason: `DB update error: ${err.message}` });
      }
    }

    // Append clean records to activity_logs.csv on disk
    try {
      if (csvAppendLines.length > 0) {
        const actPath = path.join(DATA_DIR, 'activity_logs.csv');
        await fs.appendFile(actPath, '\n' + csvAppendLines.join('\n'), 'utf-8');
      }
    } catch (diskErr) {
      logger.warn('Could not append to activity_logs.csv on disk:', diskErr);
    }

    res.json({
      success: true,
      stats: {
        totalProcessed: payload.length,
        successCount: totalInserted + totalUpdated,
        added: totalInserted,
        updated: totalUpdated,
        warningCount: warnings.length,
        failedCount: failures.length,
        newEmployeesCreated: autoCreatedList.length,
        warnings,
        failures,
        message: `Pipeline finished: ${totalInserted} telemetry logs committed cleanly, ${totalUpdated} updated, ${failures.length} failed/skipped rows, ${warnings.length} audit warnings generated.`,
      },
    });
  } catch (err: any) {
    logger.error('Custom activity import failed:', err);
    res.status(500).json({ success: false, error: err.message || 'Database error during activity log import.' });
  }
});

export default router;

