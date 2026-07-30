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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5 bg-gradient-to-r from-card/95 via-card/85 to-slate-900 p-6 rounded-2xl border border-border/70 shadow-lg">
        <div className="space-y-1.5">
          <div className="flex items-start sm:items-center gap-4">
            <div className="p-3 rounded-2xl bg-primary/20 text-primary border border-primary/30 shadow-sm shrink-0 mt-1 sm:mt-0">
              <Database className="w-6 h-6 animate-pulse-slow" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <h2 className="text-xl sm:text-2xl font-extrabold text-foreground tracking-tight">
                  Data &amp; CSV Import Studio
                </h2>
                <span className="text-[11px] px-2.5 py-0.5 rounded-full font-mono bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-extrabold shrink-0">
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
        <div className="p-3.5 rounded-xl bg-primary/10 border border-primary/30 text-xs text-primary font-bold flex items-center justify-between animate-fade-in shadow-sm">
          <span>● {resetMsg}</span>
          <button onClick={() => setResetMsg(null)} className="text-muted-foreground hover:text-foreground">✕</button>
        </div>
      )}

      {/* Category Navigation Tabs */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 pb-3 border-b border-border/60">
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 bg-muted/30 p-1.5 rounded-2xl border border-border/60">
          <button
            onClick={() => { setActiveCategory('activities'); handleCancelImport(); }}
            className={`flex items-center gap-2.5 px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all ${
              activeCategory === 'activities'
                ? 'bg-gradient-to-r from-primary via-primary/90 to-emerald-500 text-slate-950 shadow-md scale-[1.02]'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>Activity Telemetry Logs (.CSV)</span>
          </button>
          <button
            onClick={() => { setActiveCategory('employees'); handleCancelImport(); }}
            className={`flex items-center gap-2.5 px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all ${
              activeCategory === 'employees'
                ? 'bg-gradient-to-r from-primary via-primary/90 to-emerald-500 text-slate-950 shadow-md scale-[1.02]'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Employee Directory Roster (.CSV)</span>
          </button>
        </div>

        <button
          onClick={handleDownloadSample}
          className="inline-flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-card hover:bg-muted/50 text-foreground text-xs font-bold border border-primary/40 shadow-md hover:scale-[1.02] transition-all active:scale-95 group"
        >
          <Download className="w-4 h-4 text-primary group-hover:translate-y-0.5 transition-transform" />
          <span>Download Sample CSV</span>
        </button>
      </div>

      {/* Main Uploader Box & Vendor Features */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left: Drop Zone (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="p-7 rounded-2xl bg-gradient-to-b from-card to-card/80 border border-border/80 shadow-xl space-y-6 relative overflow-hidden">
            <div className="flex items-center justify-between border-b border-border/60 pb-4">
              <div>
                <span className="text-[10px] font-mono uppercase text-emerald-400 font-extrabold tracking-widest block">
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
              className="border-2 border-dashed border-primary/40 hover:border-primary rounded-2xl p-10 transition-all cursor-pointer text-center bg-primary/5 hover:bg-primary/10 group shadow-inner"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="hidden"
              />
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/30 to-emerald-500/20 text-primary border border-primary/30 flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform shadow-lg">
                <Upload className="w-8 h-8 animate-bounce-slow" />
              </div>
              <p className="text-base font-extrabold text-foreground group-hover:text-primary transition-colors">
                Click to Browse or Drag CSV File Here
              </p>
              <p className="text-xs text-muted-foreground mt-1.5 font-sans max-w-[260px] mx-auto leading-relaxed">
                Opens the import drawer modal to preview, search, and confirm your file
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800/90 space-y-3">
              <span className="text-xs font-bold text-slate-200 font-sans flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Expected CSV Header Titles:</span>
              </span>
              <div className="flex flex-wrap gap-2 font-mono text-[11px]">
                {expectedColumns.map(col => (
                  <span key={col} className="px-2.5 py-1 rounded bg-slate-900 text-emerald-300 border border-slate-700 font-extrabold">
                    {formatHeaderTitle(col)}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right: Studio Benefits (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          <div className="p-7 rounded-2xl bg-card border border-border/80 shadow-lg space-y-6">
            <h3 className="text-base font-extrabold text-foreground tracking-tight border-b border-border/60 pb-3.5 flex items-center gap-2.5">
              <Sparkles className="w-5 h-5 text-emerald-400 shrink-0" />
              <span>Import Studio Features</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="p-4 rounded-xl bg-muted/20 border border-border/60 space-y-2">
                <div className="flex items-center gap-2 text-primary font-extrabold text-xs uppercase tracking-wider">
                  <TableProperties className="w-4 h-4 shrink-0" />
                  <span>1 · Interactive Preview Drawer</span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Inspect every record in a slide-over drawer modal before confirming. Includes real-time search and header formatting checks.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-muted/20 border border-border/60 space-y-2">
                <div className="flex items-center gap-2 text-amber-400 font-extrabold text-xs uppercase tracking-wider">
                  <ShieldCheck className="w-4 h-4 shrink-0" />
                  <span>2 · Safe Validation &amp; Audit</span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Valid records are imported cleanly. Any warnings or missing employee IDs are flagged with clear audit notices.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-muted/20 border border-border/60 space-y-2">
                <div className="flex items-center gap-2 text-sky-400 font-extrabold text-xs uppercase tracking-wider">
                  <Layers className="w-4 h-4 shrink-0" />
                  <span>3 · Automatic Profile Merge</span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Existing staff directory records are merged automatically, preventing duplicate employee entries.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-muted/20 border border-border/60 space-y-2">
                <div className="flex items-center gap-2 text-emerald-400 font-extrabold text-xs uppercase tracking-wider">
                  <RefreshCw className="w-4 h-4 shrink-0" />
                  <span>4 · Instant Dashboard Sync</span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Upon confirmation, all Overview charts, Category breakdowns, and AI Copilot reasoning update immediately.
                </p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-950 border border-emerald-500/30 text-xs text-slate-300 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="font-medium">Designed for seamless workforce management and data integrity.</span>
              </div>
              <span className="text-[10px] font-mono uppercase tracking-wider text-emerald-400 font-extrabold bg-emerald-500/15 px-3 py-1 rounded-md border border-emerald-500/30 shrink-0">
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
          <SheetHeader className="flex flex-row items-center justify-between px-6 py-4 border-b border-border/80 bg-slate-950 shrink-0 z-20 text-left space-y-0 pr-12">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center text-primary shadow-sm">
                <TableProperties className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2.5">
                  <SheetTitle className="font-extrabold text-base text-foreground tracking-tight">
                    Preview &amp; Confirm CSV Import
                  </SheetTitle>
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-mono font-bold bg-primary/20 text-primary border border-primary/30">
                    {parsedRows.length} Rows
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  File: <strong className="text-white font-mono">{fileName}</strong> · Target: <strong className="text-emerald-400">{activeCategory === 'employees' ? 'Employee Directory' : 'Activity Telemetry'}</strong>
                </p>
              </div>
            </div>
          </SheetHeader>

            {/* 2. SCROLLABLE DRAWER BODY (min-h-0 allows flex child to scroll cleanly without forcing footer off-screen) */}
            <div className="flex-1 min-h-0 overflow-y-auto p-6 space-y-5 bg-slate-950/40">
              {/* Validation Status Banner */}
              {!importSuccess && (
                parseError ? (
                  <div className="p-4 rounded-xl bg-amber-500/15 border border-amber-500/40 text-amber-200 text-xs flex items-start gap-3 shadow-sm shrink-0">
                    <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                    <div className="space-y-0.5">
                      <p className="font-bold text-sm text-amber-300">Format Notice</p>
                      <p className="leading-relaxed text-amber-200/90">{parseError}</p>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-xs flex items-center justify-between shadow-sm shrink-0">
                    <div className="flex items-center gap-3">
                      <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
                      <div>
                        <p className="font-bold text-sm text-white">Validation Successful</p>
                        <p className="text-emerald-300/90 text-xs">All standard column titles and records passed verification.</p>
                      </div>
                    </div>
                    <span className="font-mono text-xs font-bold px-3 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                      Ready to Import
                    </span>
                  </div>
                )
              )}

              {/* POST-IMPORT AUDIT REPORT SCORECARD */}
              {importSuccess && importStats && (
                <div className="p-6 rounded-2xl bg-gradient-to-b from-emerald-950/80 via-slate-900/90 to-card border-2 border-emerald-500 shadow-xl space-y-5 animate-fade-in shrink-0">
                  <div className="flex items-center justify-between border-b border-emerald-500/30 pb-3">
                    <div className="flex items-center gap-3">
                      <CheckCircle className="w-7 h-7 text-emerald-400 shrink-0" />
                      <div>
                        <h4 className="font-extrabold text-base sm:text-lg text-white">Import Completed Successfully!</h4>
                        <p className="text-xs text-emerald-300/90">
                          {importStats.message || `Processed ${importStats.totalProcessed || parsedRows.length} records.`}
                        </p>
                      </div>
                    </div>
                    <span className="text-xs font-mono font-bold bg-emerald-500/20 text-emerald-300 px-3 py-1 rounded-lg border border-emerald-500/40">
                      Imported
                    </span>
                  </div>

                  {/* 3 Metric Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="p-4 rounded-xl bg-slate-950/80 border border-emerald-500/40 space-y-1">
                      <div className="flex items-center justify-between text-emerald-400 text-xs font-bold uppercase">
                        <span>Successfully Imported</span>
                        <CheckCircle2 className="w-4 h-4" />
                      </div>
                      <span className="text-2xl font-extrabold text-white font-mono block">
                        {importStats.successCount || importStats.inserted || importStats.added || parsedRows.length}
                      </span>
                      <span className="text-[10px] text-slate-400">Records active in workspace</span>
                    </div>

                    <div className="p-4 rounded-xl bg-slate-950/80 border border-amber-500/40 space-y-1">
                      <div className="flex items-center justify-between text-amber-400 text-xs font-bold uppercase">
                        <span>Audit Notices</span>
                        <AlertCircle className="w-4 h-4" />
                      </div>
                      <span className="text-2xl font-extrabold text-amber-300 font-mono block">
                        {importStats.warningCount !== undefined ? importStats.warningCount : (importStats.newEmployeesCreated || 0)}
                      </span>
                      <span className="text-[10px] text-slate-400">Provisional profiles created</span>
                    </div>

                    <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-700/80 space-y-1">
                      <div className="flex items-center justify-between text-slate-300 text-xs font-bold uppercase">
                        <span>Skipped / Incomplete</span>
                        <AlertOctagon className="w-4 h-4 text-slate-400" />
                      </div>
                      <span className="text-2xl font-extrabold text-slate-200 font-mono block">
                        {importStats.failedCount || 0}
                      </span>
                      <span className="text-[10px] text-slate-400">Discarded records</span>
                    </div>
                  </div>

                  {/* Audit Log Toggle */}
                  {((importStats.warnings && importStats.warnings.length > 0) || (importStats.failures && importStats.failures.length > 0)) && (
                    <div className="space-y-2 pt-2">
                      <button
                        onClick={() => setShowAuditDetails(!showAuditDetails)}
                        className="text-xs font-bold text-emerald-300 hover:underline flex items-center gap-1.5 font-mono"
                      >
                        <Info className="w-4 h-4" />
                        <span>{showAuditDetails ? '▼ Hide Audit Log' : `▶ View Row Audit Log (${(importStats.warnings?.length || 0) + (importStats.failures?.length || 0)} notices)`}</span>
                      </button>

                      {showAuditDetails && (
                        <div className="p-4 rounded-xl bg-slate-950 border border-border/80 max-h-48 overflow-y-auto space-y-2 font-mono text-xs text-slate-300">
                          {importStats.failures?.map((fail, idx) => (
                            <div key={`f-${idx}`} className="p-2 rounded bg-rose-500/10 border border-rose-500/20 text-rose-300 flex items-start gap-2">
                              <span className="font-bold shrink-0">Row {fail.row} [{fail.id}]:</span>
                              <span>{fail.reason}</span>
                            </div>
                          ))}
                          {importStats.warnings?.map((warn, idx) => (
                            <div key={`w-${idx}`} className="p-2 rounded bg-amber-500/10 border border-amber-500/20 text-amber-200 flex items-start gap-2">
                              <span className="font-bold text-amber-300 shrink-0">Row {warn.row} [{warn.id}]:</span>
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
                <div className="p-4 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-200 text-xs flex items-center gap-3 shadow-md shrink-0">
                  <AlertTriangle className="w-5 h-5 shrink-0 text-rose-400" />
                  <div>
                    <p className="font-bold text-sm text-white">Import Error</p>
                    <p className="text-rose-200">{importError}</p>
                  </div>
                </div>
              )}

              {/* Interactive Preview Data Grid */}
              <div className="space-y-3 bg-card p-4 rounded-2xl border border-border/80 shadow-md">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/60 pb-3">
                  <div>
                    <h4 className="font-extrabold text-xs sm:text-sm text-foreground flex items-center gap-2">
                      <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
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
                      className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-muted/60 border border-border/80 text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                    />
                  </div>
                </div>

                {/* Internal Scrollable Table Box (Max height capped so table never pushes footer down) */}
                <div className="overflow-x-auto overflow-y-auto max-h-[300px] sm:max-h-[400px] rounded-xl border border-border/80 shadow-inner touch-pan-x scrollbar-thin">
                  <table className="w-full text-left border-collapse text-xs min-w-[720px]">
                    <thead className="sticky top-0 bg-slate-900 border-b border-border text-xs font-mono uppercase font-bold text-slate-300 z-10 shadow-sm">
                      <tr>
                        {parsedHeaders.map((hdr, idx) => (
                          <th key={idx} className={`py-3 px-4 whitespace-nowrap min-w-[140px] ${idx === 0 ? 'text-emerald-400 font-extrabold' : ''}`}>
                            {formatHeaderTitle(hdr)}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {displayedRows.map((row, rIdx) => (
                        <tr
                          key={rIdx}
                          className={`transition-colors hover:bg-primary/10 ${rIdx % 2 === 0 ? 'bg-slate-950/50' : 'bg-slate-900/30'}`}
                        >
                          {parsedHeaders.map((hdr, cIdx) => (
                            <td key={cIdx} className={`py-2.5 px-4 whitespace-nowrap ${cIdx === 0 ? 'font-bold font-mono text-white' : 'text-slate-200'}`}>
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
                        className="px-3 py-1.5 rounded bg-muted hover:bg-muted/80 disabled:opacity-40 font-bold text-foreground transition-all active:scale-95"
                      >
                        Prev
                      </button>
                      <button
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                        className="px-3 py-1.5 rounded bg-muted hover:bg-muted/80 disabled:opacity-40 font-bold text-foreground transition-all active:scale-95"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* 3. FIXED DRAWER ACTION FOOTER (Permanently docked at bottom without scrolling!) */}
            <div className="p-5 border-t border-border/80 bg-slate-950 flex items-center justify-between gap-4 shrink-0 shadow-2xl z-20">
              <button
                onClick={handleCancelImport}
                disabled={isImporting}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 font-extrabold text-xs sm:text-sm border border-rose-500/40 transition-all active:scale-95 disabled:opacity-40 shadow-sm"
              >
                <Trash2 className="w-4 h-4 text-rose-400 shrink-0" />
                <span>Cancel Import</span>
              </button>

              <div className="flex items-center gap-3">
                {importSuccess ? (
                  <button
                    onClick={handleCancelImport}
                    className="inline-flex items-center gap-2 px-7 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-400 hover:from-emerald-400 hover:to-emerald-300 text-slate-950 font-extrabold text-xs sm:text-sm shadow-lg shadow-emerald-500/20 active:scale-95"
                  >
                    <CheckCircle className="w-4 h-4 shrink-0" />
                    <span>Done — Close Drawer</span>
                  </button>
                ) : (
                  <button
                    onClick={handleExecuteImport}
                    disabled={isImporting || parsedRows.length === 0}
                    className={`inline-flex items-center justify-center gap-2.5 px-7 py-2.5 rounded-xl font-extrabold text-xs sm:text-sm transition-all shadow-xl ${
                      isImporting || parsedRows.length === 0
                        ? 'bg-primary/50 text-white cursor-not-allowed'
                        : 'bg-gradient-to-r from-primary via-primary/90 to-emerald-500 hover:from-primary hover:to-emerald-400 text-slate-950 shadow-primary/30 hover:scale-[1.02] active:scale-95'
                    }`}
                  >
                    {isImporting ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin text-slate-950 shrink-0" />
                        <span>Importing Records...</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4 fill-slate-950 text-slate-950 shrink-0" />
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
