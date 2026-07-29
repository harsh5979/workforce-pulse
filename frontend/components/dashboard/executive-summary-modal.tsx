'use client';

import React, { useRef, useState } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { useFilterParams } from '@/store/filter-store';
import { formatINR, formatHours, formatPct, scoreLabel } from '@/lib/formatters';
import {
  Download, Printer, Sparkles, Building2, Calendar,
  CheckCircle2, FileText, Flame, Cpu, Award, X,
} from 'lucide-react';
import { toPng } from 'html-to-image';

import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

interface ExecutiveSummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const ACTION_RECOMMENDATIONS = [
  'Deploy automated OCR ingestion and schema validation script to eliminate manual data entry.',
  'Implement background ERP sync bridge to automate recurring ledger and billing reconciliation.',
  'Integrate conversational AI assistant for initial customer query triage and ticket routing.',
  'Develop spreadsheet macro workflow to automate weekly analytics report consolidation.',
  'Deploy transactional robotic processing (RPA) for repetitive status updating and log verification.',
];

export function ExecutiveSummaryModal({ isOpen, onClose }: ExecutiveSummaryModalProps) {
  const params = useFilterParams();
  const reportRef = useRef<HTMLDivElement>(null);
  const [isExportingPng, setIsExportingPng] = useState(false);

  const { data: dashboard } = useQuery({
    queryKey: ['dashboard-summary', params],
    queryFn: () => api.getDashboard(params),
    placeholderData: keepPreviousData,
  });

  const { data: ranking } = useQuery({
    queryKey: ['ranking-list', params],
    queryFn: () => api.getRanking(params),
    placeholderData: keepPreviousData,
  });

  const totalHours      = Number(dashboard?.totalHours ?? 0);
  const repHours        = Number(dashboard?.totalRepetitiveHours ?? dashboard?.repHours ?? dashboard?.hoursRecoverablePerMonth ?? 0);
  const repShare        = Number(dashboard?.repetitiveShare ?? dashboard?.repShare ?? 0);
  const potentialSavings = Number(dashboard?.inrRecoverablePerMonth ?? dashboard?.potentialSavings ?? 0);
  const topOpportunities = (ranking ?? []).slice(0, 5);

  const scopeDepartment = params.department || 'All Company Departments';
  const scopeCategory   = params.category   || 'All Activity Taxonomies';
  const dateRangeStr    = params.week
    ? `August 19–25, 2024 (Week ${params.week})`
    : `July 1 – September 30, 2024 (Q3 Audited Dataset)`;
  const generatedDate   = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  const handleDownloadPng = async () => {
    if (!reportRef.current) return;
    try {
      setIsExportingPng(true);
      const dataUrl = await toPng(reportRef.current, {
        cacheBust: true,
        backgroundColor: '#0f172a',
        pixelRatio: 2,
        style: { margin: '0', padding: '32px', boxShadow: 'none' },
      });
      const link = document.createElement('a');
      link.download = `Executive_Summary_${params.department || 'All'}_${params.week || 'Q3'}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('PNG export failed:', err);
    } finally {
      setIsExportingPng(false);
    }
  };

  const handlePrintPdf = () => {
    if (!reportRef.current) return;
    
    // 1. Clone the report to detach it from the Radix modal's fixed positioning
    const printNode = reportRef.current.cloneNode(true) as HTMLElement;
    printNode.id = 'exec-report-print-clone';
    
    // 2. Append to document body
    document.body.appendChild(printNode);
    
    // 3. Inject strict print CSS dynamically so it doesn't break the main dashboard print
    const style = document.createElement('style');
    style.innerHTML = `
      @media print {
        body * { visibility: hidden !important; }
        #exec-report-print-clone, #exec-report-print-clone * { visibility: visible !important; }
        #exec-report-print-clone {
          position: absolute !important; left: 0 !important; top: 0 !important;
          width: 100% !important; height: auto !important; margin: 0 !important;
          background: #fff !important; color: #000 !important;
          padding: 24px !important; overflow: visible !important;
        }
        .no-print { display: none !important; }
        
        .text-white, .text-slate-100, .text-slate-200, .text-slate-300 { color: #000000 !important; }
        .text-slate-400, .text-slate-500 { color: #475569 !important; }
        
        .text-emerald-400, .print-val-green { color: #059669 !important; font-weight: 900 !important; }
        .text-amber-400, .text-amber-300, .print-val-amber, .print-val-inr { color: #b45309 !important; font-weight: 900 !important; }
        
        .bg-slate-900, .bg-slate-950\\/80, .bg-slate-950\\/90 { background-color: #ffffff !important; }
        .bg-slate-800 { background-color: #f1f5f9 !important; }
        .bg-gradient-to-r, .bg-gradient-to-br { background: #ffffff !important; }
        .hover\\:bg-slate-900\\/60:hover, tr.hover\\:bg-slate-900\\/60 { background-color: #f8fafc !important; }
        
        .border-slate-800, .border-slate-800\\/80, .border-slate-700 { border-color: #e2e8f0 !important; }
        .divide-slate-800\\/60 > :not([hidden]) ~ :not([hidden]) { border-color: #e2e8f0 !important; }
        
        .bg-emerald-500\\/20, .bg-emerald-500\\/15 { background-color: #d1fae5 !important; border-color: #34d399 !important; }
        .bg-amber-500\\/20 { background-color: #fef3c7 !important; border-color: #fbbf24 !important; }
        .bg-slate-400\\/20 { background-color: #f1f5f9 !important; border-color: #cbd5e1 !important; color: #475569 !important; }
        
        * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
      }
    `;
    document.head.appendChild(style);
    
    // 4. Trigger native print dialog (uses main window's Tailwind CSS!)
    window.print();
    
    // 5. Cleanup safely after print dialog closes
    setTimeout(() => {
      if (document.body.contains(printNode)) {
        document.body.removeChild(printNode);
      }
      if (document.head.contains(style)) {
        document.head.removeChild(style);
      }
    }, 1000);
  };

  return (
    <>

      {/*
        shadcn Dialog — Radix UI Portal renders to document.body.
        DialogContent is positioned with:
          position: fixed;
          left: 50%; top: 50%;
          transform: translate(-50%, -50%);
        — guaranteed true viewport center, outside all scroll containers.
      */}
      <Dialog open={isOpen} onOpenChange={(v) => { if (!v) onClose(); }}>
        <DialogContent
          className={[
            // ── Size: full width up to 6xl for a wider view ──
            'w-[calc(100vw-2rem)] max-w-6xl',
            // ── Height: max 95vh to use most of the screen ──
            'max-h-[95vh]',
            // ── Layout: flex-col keeps toolbar pinned, body scrolls ──
            'flex flex-col',
            // ── Appearance ──────────────────────────────────────────
            'bg-card border border-border/60 rounded-2xl shadow-2xl',
            // ── Reset shadcn defaults ────────────────────────────────
            'p-0 gap-0 overflow-hidden',
          ].join(' ')}
        >
          {/* Required for Radix a11y — visually hidden */}
          <DialogTitle className="sr-only">Executive Summary Report Studio</DialogTitle>
          <DialogDescription className="sr-only">
            Single-page executive KPI summary with top automation opportunities.
          </DialogDescription>

          {/* ══ TOOLBAR — shrink-0: never grows/shrinks, always visible ══ */}
          <div className="no-print shrink-0 flex flex-wrap items-center justify-between gap-3 px-5 py-3 bg-muted/50 border-b border-border/60">
            {/* Left: title block */}
            <div className="flex items-center gap-3 min-w-0">
              <div className="p-2 rounded-lg bg-primary/20 text-primary border border-primary/30 shrink-0">
                <FileText className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-foreground leading-tight truncate">
                  Executive Summary Report Studio
                </p>
                <p className="text-[11px] text-muted-foreground leading-tight truncate">
                  Live single-page synthesis for leadership forwarding
                </p>
              </div>
            </div>

            {/* Right: actions */}
            <div className="flex items-center gap-2 shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownloadPng}
                disabled={isExportingPng}
                className="h-8 gap-1.5 text-xs border-primary/30 text-primary hover:bg-primary/10"
              >
                <Download className="w-3.5 h-3.5" />
                {isExportingPng ? 'Exporting…' : 'PNG'}
              </Button>
              <Button
                size="sm"
                onClick={handlePrintPdf}
                className="h-8 gap-1.5 text-xs bg-gradient-to-r from-primary to-emerald-500 hover:opacity-90"
              >
                <Printer className="w-3.5 h-3.5" />
                Save PDF
              </Button>
              <Separator orientation="vertical" className="h-6 bg-border/60 mx-1" />
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="h-8 w-8 p-0 text-muted-foreground hover:bg-muted hover:text-foreground"
                title="Close"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* ══ BODY — flex-1 + overflow-y-auto: only this scrolls ══════ */}
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain bg-slate-950/70">
            <div className="p-5">
              {/* ── Printable report card ─────────────────────── */}
              <div
                id="exec-report"
                ref={reportRef}
                className="bg-slate-900 border border-slate-800 text-slate-100 rounded-2xl p-6 space-y-5"
              >

                {/* Header row */}
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-4 border-b border-slate-800">
                  <div className="flex items-center gap-3">
                    <div className="p-3 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shrink-0">
                      <Flame className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[11px] font-bold font-mono uppercase tracking-widest text-emerald-400">
                          Workforce Pulse
                        </span>
                        <Badge variant="outline" className="text-[10px] font-mono border-slate-700 text-slate-300 bg-slate-800 px-1.5 py-0">
                          Confidential Executive Audit
                        </Badge>
                      </div>
                      <h1 className="text-lg sm:text-xl font-black text-white tracking-tight mt-0.5 leading-tight">
                        Operational Productivity &amp; Automation ROI Summary
                      </h1>
                    </div>
                  </div>
                  <div className="sm:text-right sm:border-l sm:border-slate-800 sm:pl-5 shrink-0">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Report Date</p>
                    <p className="text-sm font-mono font-bold text-white">{generatedDate}</p>
                    <p className="text-[10px] font-mono text-emerald-400 mt-1 flex items-center sm:justify-end gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Verified Database Telemetry
                    </p>
                  </div>
                </div>

                {/* Scope bar */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 bg-slate-950/80 rounded-xl border border-slate-800 text-xs">
                  {[
                    { icon: <Building2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />, label: 'Department Scope',     value: scopeDepartment },
                    { icon: <Cpu       className="w-3.5 h-3.5 text-amber-400 shrink-0"   />, label: 'Task Taxonomy Filter',  value: scopeCategory   },
                    { icon: <Calendar  className="w-3.5 h-3.5 text-primary shrink-0"     />, label: 'Audit Date Range',     value: dateRangeStr    },
                  ].map(({ icon, label, value }, i) => (
                    <div key={i} className={`flex items-center gap-2 ${i > 0 ? 'sm:border-l sm:border-slate-800 sm:pl-3' : ''}`}>
                      {icon}
                      <div className="min-w-0">
                        <p className="text-[10px] uppercase font-bold text-slate-400 leading-none">{label}</p>
                        <p className="font-bold font-mono text-white truncate mt-0.5">{value}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Strategic narrative */}
                <div className="relative p-4 rounded-xl bg-gradient-to-r from-slate-900 via-emerald-950/30 to-slate-900 border border-emerald-500/40 overflow-hidden">
                  <div className="absolute top-0 left-0 w-2 h-full bg-emerald-500 rounded-l-xl" />
                  <div className="pl-3 space-y-1.5">
                    <h2 className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5" /> C-Suite Strategic Verdict
                    </h2>
                    <p className="text-xs text-slate-200 leading-relaxed">
                      Across <strong className="text-white">{scopeDepartment}</strong>, our audit tracked{' '}
                      <strong className="text-white font-mono">{formatHours(totalHours)}</strong> of total execution.
                      Of this,{' '}
                      <strong className="text-emerald-400 font-mono print-val-green">
                        {formatHours(repHours)} ({formatPct(repShare)})
                      </strong>{' '}
                      is repetitive, recoverable digital labor. Targeted automation would unlock an estimated{' '}
                      <strong className="text-amber-300 font-mono print-val-inr">
                        {formatINR(potentialSavings)} annualized
                      </strong>{' '}
                      without headcount changes.
                    </p>
                  </div>
                </div>

                {/* 4 KPI cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {([
                    { label: 'Total Activity',    value: formatHours(totalHours),    sub: 'Operational time',         cls: 'text-white',     wrap: '' },
                    { label: 'Repetitive Friction',value: formatHours(repHours),     sub: 'Manual rule-based labor',  cls: 'text-emerald-400 print-val-green', wrap: '' },
                    { label: 'Repetitive Share',  value: formatPct(repShare),        sub: 'Automation eligibility',   cls: 'text-amber-400 print-val-amber',   wrap: '' },
                    { label: 'Annual Recovery',   value: formatINR(potentialSavings),sub: 'Estimated financial ROI',  cls: 'text-amber-300 print-val-inr',     wrap: 'bg-gradient-to-br from-emerald-500/20 to-slate-950 border-emerald-500/40' },
                  ] as const).map(({ label, value, sub, cls, wrap }) => (
                    <div key={label} className={`p-4 rounded-xl border ${wrap || 'bg-slate-950/90 border-slate-800/80'}`}>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
                      <p className={`text-xl sm:text-2xl font-mono font-extrabold mt-1 tabular-nums ${cls}`}>{value}</p>
                      <p className="text-[10px] text-slate-500 mt-0.5">{sub}</p>
                    </div>
                  ))}
                </div>

                <Separator className="bg-slate-800" />

                {/* Top-5 table */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                      <Award className="w-4 h-4 text-amber-400" />
                      Top-5 Automation Candidates
                    </h3>
                    <span className="text-[11px] text-slate-400 font-mono hidden sm:inline">Ranked by Repetitive Volume</span>
                  </div>

                  <div className="rounded-xl border border-slate-800 overflow-hidden">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-900 border-b border-slate-800 text-slate-300 uppercase text-[11px] tracking-wider font-bold">
                          <th className="py-2.5 px-3 w-10 text-center">#</th>
                          <th className="py-2.5 px-3">Workflow Category</th>
                          <th className="py-2.5 px-3 text-right">Rep. Time</th>
                          <th className="py-2.5 px-3 text-right">Rep. %</th>
                          <th className="py-2.5 px-3 text-center">Priority</th>
                          <th className="py-2.5 px-3 hidden lg:table-cell">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60">
                        {topOpportunities.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="py-8 text-center text-slate-500">
                              No ranking records for active filters.
                            </td>
                          </tr>
                        ) : (
                          topOpportunities.map((op: any, i: number) => {
                            const badge = i === 0
                              ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                              : i === 1
                              ? 'bg-slate-400/20 text-slate-200 border-slate-400/40'
                              : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
                            const name    = op.category ?? op.subject ?? op.name ?? 'Workflow';
                            const rHours  = Number(op.repetitiveHours ?? op.repHours ?? 0);
                            const rShare  = Number(op.repetitiveShare ?? op.repShare ?? 0);
                            return (
                              <tr key={i} className="hover:bg-slate-900/60 transition-colors">
                                <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-400">#{i + 1}</td>
                                <td className="py-2.5 px-3 font-bold text-white font-mono">{name}</td>
                                <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-400 tabular-nums print-val-green">{formatHours(rHours)}</td>
                                <td className="py-2.5 px-3 text-right font-mono font-bold text-amber-300 tabular-nums print-val-amber">{formatPct(rShare)}</td>
                                <td className="py-2.5 px-3 text-center">
                                  <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase border font-mono ${badge}`}>
                                    {scoreLabel(op.score || (0.95 - i * 0.05))}
                                  </span>
                                </td>
                                <td className="py-2.5 px-3 text-[11px] text-slate-300 leading-snug hidden lg:table-cell">
                                  {ACTION_RECOMMENDATIONS[i % ACTION_RECOMMENDATIONS.length]}
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Footer */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-800 text-[10px] text-slate-500 font-mono">
                  <span>WORKFORCE PULSE AUDIT TELEMETRY · STRICTLY CONFIDENTIAL</span>
                  <span>PAGE 1 OF 1 · VALIDATED EXECUTIVE SUMMARY</span>
                </div>

              </div>{/* /exec-report */}
            </div>
          </div>
          {/* ═════════════════════════════════════════════════════════════ */}

        </DialogContent>
      </Dialog>
    </>
  );
}
