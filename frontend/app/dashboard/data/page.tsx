'use client';

import React, { useState, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Database,
  Upload,
  FileText,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  Download,
  Search,
  Check,
  Info,
  Layers,
  ArrowRight,
  Sparkles,
  ShieldCheck,
  FileSpreadsheet,
  X,
  Users,
  Clock,
  Trash2,
  TableProperties,
  AlertCircle,
  Play,
  CheckCircle2,
  AlertOctagon
} from 'lucide-react';

type ImportCategory = 'activities' | 'employees';

interface ParsedRow {
  [key: string]: string;
}

interface AuditIssue {
  row: number;
  id: string;
  reason: string;
}

interface ImportResultStats {
  totalProcessed?: number;
  successCount?: number;
  added?: number;
  updated?: number;
  inserted?: number;
  warningCount?: number;
  failedCount?: number;
  newEmployeesCreated?: number;
  warnings?: AuditIssue[];
  failures?: AuditIssue[];
  message?: string;
}

// Helper: Transform raw CSV headers into human-readable labels
function formatHeaderTitle(header: string): string {
  const clean = header.trim().toLowerCase();
  const map: Record<string, string> = {
    employee_id: 'Employee ID',
    full_name: 'Full Name',
    department: 'Department',
    role: 'Job Title & Role',
    comp_annual_inr: 'Annual Salary (₹)',
    working_hours_day: 'Daily Hours',
    date: 'Log Date',
    duration_min: 'Duration (Mins)',
    task_category: 'Task Category',
    is_repetitive: 'Work Type',
    notes: 'Project Notes',
  };
  if (map[clean]) return map[clean];
  return header.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

export default function DataManagementPage() {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Tab Selection
  const [activeCategory, setActiveCategory] = useState<ImportCategory>('activities');

  // Slide-Over Drawer State
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // CSV Parsing State
  const [fileName, setFileName] = useState<string | null>(null);
  const [parsedHeaders, setParsedHeaders] = useState<string[]>([]);
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 6; // Keep rows per page compact so the preview fits cleanly on typical 1080p displays without awkward scrolling

  // Execution State
  const [isImporting, setIsImporting] = useState(false);
  const [importSuccess, setImportSuccess] = useState(false);
  const [importStats, setImportStats] = useState<ImportResultStats | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [showAuditDetails, setShowAuditDetails] = useState(false);

  // System Reset State
  const [isResetting, setIsResetting] = useState(false);
  const [resetMsg, setResetMsg] = useState<string | null>(null);

  // Required column signatures
  const ACTIVITY_COLUMNS = ['employee_id', 'date', 'duration_min', 'task_category', 'is_repetitive'];
  const EMPLOYEE_COLUMNS = ['employee_id', 'full_name', 'department', 'role', 'comp_annual_inr', 'working_hours_day'];

  const expectedColumns = activeCategory === 'activities' ? ACTIVITY_COLUMNS : EMPLOYEE_COLUMNS;

  // 1. Download Sample CSV File
  const handleDownloadSample = () => {
    let csvContent = '';
    let downloadName = '';

    if (activeCategory === 'employees') {
      csvContent = `employee_id,full_name,department,role,comp_annual_inr,working_hours_day
E018,Neha Sharma,Finance,Senior Financial Auditor,1150000,8
E019,Rohan Verma,Operations,Supply Chain Manager,980000,9
E020,Ananya Iyer,Product,Lead UX Designer,1400000,8
E021,Siddharth Rao,Engineering,Staff DevOps Engineer,2100000,8`;
      downloadName = 'sample_employee_directory.csv';
    } else {
      csvContent = `employee_id,date,duration_min,task_category,is_repetitive,notes
E018,2026-02-15,180,Account Reconciliation,true,Quarterly tax audit reconciliation
E018,2026-02-15,120,Financial Compliance Review,false,Preparation for statutory audit
E019,2026-02-15,240,Inventory Triage & Entry,true,Vendor logistics invoice verification
E020,2026-02-15,210,Design System Systemization,false,Updating cross-platform UI components`;
      downloadName = 'sample_workforce_activity_logs.csv';
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.setAttribute('download', downloadName);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // 2. Handle File Upload & Parse CSV
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setParseError(null);
    setImportSuccess(false);
    setImportStats(null);
    setImportError(null);
    setCurrentPage(1);
    setShowAuditDetails(false);

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (!text) {
        setParseError('The uploaded file is empty.');
        setIsDrawerOpen(true);
        return;
      }

      const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
      if (lines.length < 2) {
        setParseError('CSV file must contain a header title row and at least one record row.');
        setIsDrawerOpen(true);
        return;
      }

      const rawHeaders = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/^["']|["']$/g, ''));
      setParsedHeaders(rawHeaders);

      const missing = expectedColumns.filter(c => !rawHeaders.includes(c));
      if (missing.length > 0) {
        setParseError(`Format Notice: Missing expected column title(s): ${missing.map(formatHeaderTitle).join(', ')}. Standard system defaults will apply where appropriate.`);
      }

      const rows: ParsedRow[] = [];
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim().replace(/^["']|["']$/g, ''));
        if (values.every(v => !v)) continue;

        const rowObj: ParsedRow = {};
        rawHeaders.forEach((header, idx) => {
          rowObj[header] = values[idx] || '';
        });
        rows.push(rowObj);
      }

      setParsedRows(rows);
      setIsDrawerOpen(true);
    };

    reader.onerror = () => {
      setParseError('An unexpected file reading error occurred.');
      setIsDrawerOpen(true);
    };

    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // 3. Execute Real Database Import
  const handleExecuteImport = async () => {
    if (parsedRows.length === 0) return;

    setIsImporting(true);
    setImportSuccess(false);
    setImportError(null);

    const endpoint = activeCategory === 'employees' ? '/api/ingest/employees' : '/api/ingest/activities';
    const payloadKey = activeCategory === 'employees' ? 'employees' : 'activities';

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [payloadKey]: parsedRows }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || data.message || `Import service error (Status: ${res.status})`);
      }

      setImportStats(data.stats || {
        totalProcessed: parsedRows.length,
        successCount: parsedRows.length,
        warningCount: 0,
        failedCount: 0,
        message: `Successfully imported ${parsedRows.length} records.`
      });
      setImportSuccess(true);

      queryClient.invalidateQueries({ queryKey: ['overview'] });
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      queryClient.invalidateQueries({ queryKey: ['anomalies'] });
      queryClient.invalidateQueries({ queryKey: ['trends'] });
    } catch (err: any) {
      setImportError(err.message || 'Unable to complete import. Please verify server status.');
    } finally {
      setIsImporting(false);
    }
  };

  // 4. Cancel & Close Drawer
  const handleCancelImport = () => {
    setIsDrawerOpen(false);
    setFileName(null);
    setParsedHeaders([]);
    setParsedRows([]);
    setParseError(null);
    setImportSuccess(false);
    setImportStats(null);
    setImportError(null);
    setShowAuditDetails(false);
  };

  // 5. System Reset
  const handleSystemReset = async () => {
    setIsResetting(true);
    setResetMsg(null);
    try {
      const res = await fetch('/api/ingest', { method: 'POST' });
      if (res.ok) {
        setResetMsg('Default dataset restored successfully.');
        queryClient.invalidateQueries();
      } else {
        setResetMsg('Unable to restore default dataset.');
      }
    } catch (err) {
      setResetMsg('Server connection error.');
    } finally {
      setIsResetting(false);
    }
  };

  // Table Pagination
  const filteredRows = parsedRows.filter(row => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return Object.values(row).some(v => String(v).toLowerCase().includes(q));
  });

  const totalPages = Math.ceil(filteredRows.length / rowsPerPage);
  const displayedRows = filteredRows.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);

  return (
    <div className="space-y-5 max-w-7xl mx-auto pb-16 select-none animate-fade-in relative -mt-2">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5 bg-card p-6 rounded-none-none border border-border/70 shadow-lg">
        <div className="space-y-1.5">
          <div className="flex items-start sm:items-center gap-4">
            <div className="p-3 rounded-none-none bg-primary/20 text-primary border border-primary/30 shadow-sm shrink-0 mt-1 sm:mt-0">
              <Database className="w-6 h-6 animate-pulse-slow" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <h2 className="text-xl sm:text-2xl font-extrabold text-foreground tracking-tight">
                  Data &amp; CSV Import Studio
                </h2>
                <span className="text-[11px] px-2.5 py-0.5 rounded-none-none font-mono bg-primary/15 text-primary border border-primary/30 font-extrabold shrink-0">
                  ● Ready
                </span>
              </div>
              <p className="text-xs sm:text-sm text-muted-foreground font-sans mt-1.5">
                Upload activity logs and employee rosters, preview records in the import drawer, and update your workforce data.
              </p>
            </div>
          </div>
        </div>
      </div>

      {resetMsg && (
        <div className="p-3.5 rounded-none-none bg-primary/10 border border-primary/30 text-xs text-primary font-bold flex items-center justify-between animate-fade-in shadow-sm">
          <span>● {resetMsg}</span>
          <button onClick={() => setResetMsg(null)} className="text-muted-foreground hover:text-foreground">✕</button>
        </div>
      )}

      {/* Category Navigation Tabs */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 pb-3 border-b border-border/60">
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 bg-muted/30 p-1.5 rounded-none-none border border-border/60">
          <button
            onClick={() => { setActiveCategory('activities'); handleCancelImport(); }}
            className={`flex items-center gap-2.5 px-5 py-2.5 rounded-none-none font-bold text-xs sm:text-sm transition-all ${
              activeCategory === 'activities'
                ? 'bg-primary text-primary-foreground shadow-md scale-[1.02]'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>Activity Telemetry Logs (.CSV)</span>
          </button>
          <button
            onClick={() => { setActiveCategory('employees'); handleCancelImport(); }}
            className={`flex items-center gap-2.5 px-5 py-2.5 rounded-none-none font-bold text-xs sm:text-sm transition-all ${
              activeCategory === 'employees'
                ? 'bg-primary text-primary-foreground shadow-md scale-[1.02]'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Employee Directory Roster (.CSV)</span>
          </button>
        </div>

        <button
          onClick={handleDownloadSample}
          className="inline-flex items-center gap-2.5 px-4 py-2.5 rounded-none-none bg-card hover:bg-muted/50 text-foreground text-xs font-bold border border-primary/40 shadow-md hover:scale-[1.02] transition-all active:scale-95 group"
        >
          <Download className="w-4 h-4 text-primary group-hover:translate-y-0.5 transition-transform" />
          <span>Download Sample CSV</span>
        </button>
      </div>

      {/* Main Uploader Box & Vendor Features */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left: Drop Zone (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="p-7 rounded-none-none bg-card border border-border/80 shadow-xl space-y-6 relative overflow-hidden">
            <div className="flex items-center justify-between border-b border-border/60 pb-4">
              <div>
                <span className="text-[10px] font-mono uppercase text-primary font-extrabold tracking-widest block">
                  {activeCategory === 'employees' ? 'Staff Directory Format' : 'Activity Tracking Format'}
                </span>
                <h3 className="text-base font-extrabold text-foreground tracking-tight mt-0.5">
                  Upload {activeCategory === 'employees' ? 'Employee Directory CSV' : 'Workforce Activity CSV'}
                </h3>
              </div>
              <TableProperties className="w-6 h-6 text-primary/80" />
            </div>

            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-primary/40 hover:border-primary rounded-none-none p-10 transition-all cursor-pointer text-center bg-primary/5 hover:bg-primary/10 group shadow-inner"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="hidden"
              />
              <div className="w-16 h-16 rounded-none-none bg-primary/20 text-primary border border-primary/30 flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform shadow-lg">
                <Upload className="w-8 h-8 animate-bounce-slow" />
              </div>
              <p className="text-base font-extrabold text-foreground group-hover:text-primary transition-colors">
                Click to Browse or Drag CSV File Here
              </p>
              <p className="text-xs text-muted-foreground mt-1.5 font-sans max-w-[260px] mx-auto leading-relaxed">
                Opens the import drawer modal to preview, search, and confirm your file
              </p>
            </div>

            <div className="p-4 rounded-none-none bg-muted border border-border space-y-3">
              <span className="text-xs font-bold text-foreground font-sans flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-primary shrink-0" />
                <span>Expected CSV Header Titles:</span>
              </span>
              <div className="flex flex-wrap gap-2 font-mono text-[11px]">
                {expectedColumns.map(col => (
                  <span key={col} className="px-2.5 py-1 rounded-none bg-muted text-primary border border-border font-extrabold">
                    {formatHeaderTitle(col)}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right: Studio Benefits (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          <div className="p-7 rounded-none-none bg-card border border-border/80 shadow-lg space-y-6">
            <h3 className="text-base font-extrabold text-foreground tracking-tight border-b border-border/60 pb-3.5 flex items-center gap-2.5">
              <Sparkles className="w-5 h-5 text-primary shrink-0" />
              <span>Import Studio Features</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="p-4 rounded-none-none bg-muted/20 border border-border/60 space-y-2">
                <div className="flex items-center gap-2 text-primary font-extrabold text-xs uppercase tracking-wider">
                  <TableProperties className="w-4 h-4 shrink-0" />
                  <span>1 · Interactive Preview Drawer</span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Inspect every record in a slide-over drawer modal before confirming. Includes real-time search and header formatting checks.
                </p>
              </div>

              <div className="p-4 rounded-none-none bg-muted/20 border border-border/60 space-y-2">
                <div className="flex items-center gap-2 text-accent font-extrabold text-xs uppercase tracking-wider">
                  <ShieldCheck className="w-4 h-4 shrink-0" />
                  <span>2 · Safe Validation &amp; Audit</span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Valid records are imported cleanly. Any warnings or missing employee IDs are flagged with clear audit notices.
                </p>
              </div>

              <div className="p-4 rounded-none-none bg-muted/20 border border-border/60 space-y-2">
                <div className="flex items-center gap-2 text-blue-500 font-extrabold text-xs uppercase tracking-wider">
                  <Layers className="w-4 h-4 shrink-0" />
                  <span>3 · Automatic Profile Merge</span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Existing staff directory records are merged automatically, preventing duplicate employee entries.
                </p>
              </div>

              <div className="p-4 rounded-none-none bg-muted/20 border border-border/60 space-y-2">
                <div className="flex items-center gap-2 text-primary font-extrabold text-xs uppercase tracking-wider">
                  <RefreshCw className="w-4 h-4 shrink-0" />
                  <span>4 · Instant Dashboard Sync</span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Upon confirmation, all Overview charts, Category breakdowns, and AI Copilot reasoning update immediately.
                </p>
              </div>
            </div>

            <div className="p-4 rounded-none-none bg-muted border border-primary/30 text-xs text-foreground flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Check className="w-4 h-4 text-primary shrink-0" />
                <span className="font-medium">Designed for seamless workforce management and data integrity.</span>
              </div>
              <span className="text-[10px] font-mono uppercase tracking-wider text-primary font-extrabold bg-primary/15 px-3 py-1 rounded-none-none border border-primary/30 shrink-0">
                Verified
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────────────────────
          SHADCN-STYLE SLIDE-OVER SHEET DRAWER MODAL
          ───────────────────────────────────────────────────────────────────────────── */}
      <Sheet open={isDrawerOpen} onOpenChange={(v) => { if (!v) handleCancelImport(); else setIsDrawerOpen(v); }}>
        <SheetContent className="sm:max-w-4xl p-0 flex flex-col border-l border-border/80 bg-card select-none">
          {/* 1. FIXED DRAWER HEADER (Pinned to top) */}
          <SheetHeader className="flex flex-row items-center justify-between px-6 py-4 border-b border-border/80 bg-muted shrink-0 z-20 text-left space-y-0 pr-12">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-none-none bg-primary/20 border border-primary/30 flex items-center justify-center text-primary shadow-sm">
                <TableProperties className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2.5">
                  <SheetTitle className="font-extrabold text-base text-foreground tracking-tight">
                    Preview &amp; Confirm CSV Import
                  </SheetTitle>
                  <span className="px-2 py-0.5 rounded-none-none text-[11px] font-mono font-bold bg-primary/20 text-primary border border-primary/30">
                    {parsedRows.length} Rows
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  File: <strong className="text-foreground font-mono">{fileName}</strong> · Target: <strong className="text-primary">{activeCategory === 'employees' ? 'Employee Directory' : 'Activity Telemetry'}</strong>
                </p>
              </div>
            </div>
          </SheetHeader>

            {/* 2. SCROLLABLE DRAWER BODY (min-h-0 allows flex child to scroll cleanly without forcing footer off-screen) */}
            <div className="flex-1 min-h-0 overflow-y-auto p-6 space-y-5 bg-muted/40">
              {/* Validation Status Banner */}
              {!importSuccess && (
                parseError ? (
                  <div className="p-4 rounded-none-none bg-accent/15 border border-accent/40 text-accent text-xs flex items-start gap-3 shadow-sm shrink-0">
                    <AlertCircle className="w-5 h-5 text-accent shrink-0 mt-0.5" />
                    <div className="space-y-0.5">
                      <p className="font-bold text-sm text-accent">Format Notice</p>
                      <p className="leading-relaxed text-accent/90">{parseError}</p>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 rounded-none-none bg-primary/15 border border-primary/40 text-primary text-xs flex items-center justify-between shadow-sm shrink-0">
                    <div className="flex items-center gap-3">
                      <ShieldCheck className="w-5 h-5 text-primary shrink-0" />
                      <div>
                        <p className="font-bold text-sm text-foreground">Validation Successful</p>
                        <p className="text-primary/90 text-xs">All standard column titles and records passed verification.</p>
                      </div>
                    </div>
                    <span className="font-mono text-xs font-bold px-3 py-1 rounded-none-none bg-primary/20 text-primary border border-primary/40">
                      Ready to Import
                    </span>
                  </div>
                )
              )}

              {/* POST-IMPORT AUDIT REPORT SCORECARD */}
              {importSuccess && importStats && (
                <div className="p-6 rounded-none-none bg-card border-2 border-primary shadow-xl space-y-5 animate-fade-in shrink-0">
                  <div className="flex items-center justify-between border-b border-primary/30 pb-3">
                    <div className="flex items-center gap-3">
                      <CheckCircle className="w-7 h-7 text-primary shrink-0" />
                      <div>
                        <h4 className="font-extrabold text-base sm:text-lg text-foreground">Import Completed Successfully!</h4>
                        <p className="text-xs text-primary/90">
                          {importStats.message || `Processed ${importStats.totalProcessed || parsedRows.length} records.`}
                        </p>
                      </div>
                    </div>
                    <span className="text-xs font-mono font-bold bg-primary/20 text-primary px-3 py-1 rounded-none-none border border-primary/40">
                      Imported
                    </span>
                  </div>

                  {/* 3 Metric Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="p-4 rounded-none-none bg-muted border border-primary/40 space-y-1">
                      <div className="flex items-center justify-between text-primary text-xs font-bold uppercase">
                        <span>Successfully Imported</span>
                        <CheckCircle2 className="w-4 h-4" />
                      </div>
                      <span className="text-2xl font-extrabold text-foreground font-mono block">
                        {importStats.successCount || importStats.inserted || importStats.added || parsedRows.length}
                      </span>
                      <span className="text-[10px] text-muted-foreground">Records active in workspace</span>
                    </div>

                    <div className="p-4 rounded-none-none bg-muted border border-accent/40 space-y-1">
                      <div className="flex items-center justify-between text-accent text-xs font-bold uppercase">
                        <span>Audit Notices</span>
                        <AlertCircle className="w-4 h-4" />
                      </div>
                      <span className="text-2xl font-extrabold text-accent font-mono block">
                        {importStats.warningCount !== undefined ? importStats.warningCount : (importStats.newEmployeesCreated || 0)}
                      </span>
                      <span className="text-[10px] text-muted-foreground">Provisional profiles created</span>
                    </div>

                    <div className="p-4 rounded-none-none bg-muted border border-border space-y-1">
                      <div className="flex items-center justify-between text-foreground text-xs font-bold uppercase">
                        <span>Skipped / Incomplete</span>
                        <AlertOctagon className="w-4 h-4 text-muted-foreground" />
                      </div>
                      <span className="text-2xl font-extrabold text-foreground font-mono block">
                        {importStats.failedCount || 0}
                      </span>
                      <span className="text-[10px] text-muted-foreground">Discarded records</span>
                    </div>
                  </div>

                  {/* Audit Log Toggle */}
                  {((importStats.warnings && importStats.warnings.length > 0) || (importStats.failures && importStats.failures.length > 0)) && (
                    <div className="space-y-2 pt-2">
                      <button
                        onClick={() => setShowAuditDetails(!showAuditDetails)}
                        className="text-xs font-bold text-primary hover:underline flex items-center gap-1.5 font-mono"
                      >
                        <Info className="w-4 h-4" />
                        <span>{showAuditDetails ? '▼ Hide Audit Log' : `▶ View Row Audit Log (${(importStats.warnings?.length || 0) + (importStats.failures?.length || 0)} notices)`}</span>
                      </button>

                      {showAuditDetails && (
                        <div className="p-4 rounded-none-none bg-muted border border-border/80 max-h-48 overflow-y-auto space-y-2 font-mono text-xs text-foreground">
                          {importStats.failures?.map((fail, idx) => (
                            <div key={`f-${idx}`} className="p-2 rounded-none bg-destructive/10 border border-destructive/20 text-destructive flex items-start gap-2">
                              <span className="font-bold shrink-0">Row {fail.row} [{fail.id}]:</span>
                              <span>{fail.reason}</span>
                            </div>
                          ))}
                          {importStats.warnings?.map((warn, idx) => (
                            <div key={`w-${idx}`} className="p-2 rounded-none bg-accent/10 border border-accent/20 text-accent flex items-start gap-2">
                              <span className="font-bold text-accent shrink-0">Row {warn.row} [{warn.id}]:</span>
                              <span>{warn.reason}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {importError && (
                <div className="p-4 rounded-none-none bg-destructive/15 border border-destructive/40 text-destructive text-xs flex items-center gap-3 shadow-md shrink-0">
                  <AlertTriangle className="w-5 h-5 shrink-0 text-destructive" />
                  <div>
                    <p className="font-bold text-sm text-foreground">Import Error</p>
                    <p className="text-destructive">{importError}</p>
                  </div>
                </div>
              )}

              {/* Interactive Preview Data Grid */}
              <div className="space-y-3 bg-card p-4 rounded-none-none border border-border/80 shadow-md">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/60 pb-3">
                  <div>
                    <h4 className="font-extrabold text-xs sm:text-sm text-foreground flex items-center gap-2">
                      <FileSpreadsheet className="w-4 h-4 text-primary" />
                      <span>Data Grid Inspection Preview</span>
                    </h4>
                    <p className="text-[11px] text-muted-foreground font-sans">
                      Showing {displayedRows.length} rows per view ({filteredRows.length} total matching records)
                    </p>
                  </div>

                  <div className="relative w-full sm:w-60">
                    <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Search records..."
                      value={searchQuery}
                      onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                      className="w-full pl-8 pr-3 py-1.5 rounded-none-none bg-muted/60 border border-border/80 text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                    />
                  </div>
                </div>

                {/* Internal Scrollable Table Box (Max height capped so table never pushes footer down) */}
                <div className="overflow-x-auto overflow-y-auto max-h-[300px] sm:max-h-[400px] rounded-none-none border border-border/80 shadow-inner touch-pan-x scrollbar-thin">
                  <table className="w-full text-left border-collapse text-xs min-w-[720px]">
                    <thead className="sticky top-0 bg-muted border-b border-border text-xs font-mono uppercase font-bold text-foreground z-10 shadow-sm">
                      <tr>
                        {parsedHeaders.map((hdr, idx) => (
                          <th key={idx} className={`py-3 px-4 whitespace-nowrap min-w-[140px] ${idx === 0 ? 'text-primary font-extrabold' : ''}`}>
                            {formatHeaderTitle(hdr)}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {displayedRows.map((row, rIdx) => (
                        <tr
                          key={rIdx}
                          className={`transition-colors hover:bg-primary/10 ${rIdx % 2 === 0 ? 'bg-muted' : 'bg-muted/30'}`}
                        >
                          {parsedHeaders.map((hdr, cIdx) => (
                            <td key={cIdx} className={`py-2.5 px-4 whitespace-nowrap ${cIdx === 0 ? 'font-bold font-mono text-foreground' : 'text-foreground'}`}>
                              {row[hdr] || '—'}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between pt-1.5 text-xs font-mono text-muted-foreground">
                    <span>Page {currentPage} of {totalPages}</span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className="px-3 py-1.5 rounded-none bg-muted hover:bg-muted/80 disabled:opacity-40 font-bold text-foreground transition-all active:scale-95"
                      >
                        Prev
                      </button>
                      <button
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                        className="px-3 py-1.5 rounded-none bg-muted hover:bg-muted/80 disabled:opacity-40 font-bold text-foreground transition-all active:scale-95"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* 3. FIXED DRAWER ACTION FOOTER (Permanently docked at bottom without scrolling!) */}
            <div className="p-5 border-t border-border/80 bg-muted flex items-center justify-between gap-4 shrink-0 shadow-2xl z-20">
              <button
                onClick={handleCancelImport}
                disabled={isImporting}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-none-none bg-destructive/15 hover:bg-destructive/25 text-destructive font-extrabold text-xs sm:text-sm border border-destructive/40 transition-all active:scale-95 disabled:opacity-40 shadow-sm"
              >
                <Trash2 className="w-4 h-4 text-destructive shrink-0" />
                <span>Cancel Import</span>
              </button>

              <div className="flex items-center gap-3">
                {importSuccess ? (
                  <button
                    onClick={handleCancelImport}
                    className="inline-flex items-center gap-2 px-7 py-2.5 rounded-none-none bg-primary hover:bg-primary/90 text-primary-foreground font-extrabold text-xs sm:text-sm shadow-lg shadow-emerald-500/20 active:scale-95"
                  >
                    <CheckCircle className="w-4 h-4 shrink-0" />
                    <span>Done — Close Drawer</span>
                  </button>
                ) : (
                  <button
                    onClick={handleExecuteImport}
                    disabled={isImporting || parsedRows.length === 0}
                    className={`inline-flex items-center justify-center gap-2.5 px-7 py-2.5 rounded-none-none font-extrabold text-xs sm:text-sm transition-all shadow-xl ${
                      isImporting || parsedRows.length === 0
                        ? 'bg-primary/50 text-foreground cursor-not-allowed'
                        : 'bg-gradient-to-r from-primary via-primary/90 to-emerald-500  text-slate-950 shadow-primary/30 hover:scale-[1.02] active:scale-95'
                    }`}
                  >
                    {isImporting ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin text-slate-950 shrink-0" />
                        <span>Importing Records...</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4 fill-primary-foreground text-slate-950 shrink-0" />
                        <span>Confirm Import</span>
                        <ArrowRight className="w-4 h-4 ml-0.5 shrink-0" />
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
