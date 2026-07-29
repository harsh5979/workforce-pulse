'use client';

import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { AlertTriangle, ShieldAlert, CheckCircle, ArrowRight, Search, Loader2, Filter } from 'lucide-react';
import { formatHours, formatPct } from '@/lib/formatters';
import Link from 'next/link';
import { useState, useEffect, useMemo } from 'react';
import { PaginationControls } from '@/components/ui/pagination-controls';

export default function AnomaliesPage() {
  const [severityFilter, setSeverityFilter] = useState<'all' | 'high' | 'medium'>('all');
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);

  // Tanstack Query with keepPreviousData for smooth filter switching
  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['anomalies-list'],
    queryFn: () => api.getAnomalies(),
    placeholderData: keepPreviousData,
    staleTime: 60 * 1000,
  });

  // Reset to page 1 on search or filter change
  useEffect(() => {
    setCurrentPage(1);
  }, [severityFilter, search]);

  const anomalies = data ?? [];

  // Filter and search anomalies
  const filteredAnomalies = useMemo(() => {
    return anomalies.filter((a: any) => {
      const matchesSeverity = severityFilter === 'all' || a.severity === severityFilter;
      const matchesSearch =
        a.headline?.toLowerCase().includes(search.toLowerCase()) ||
        a.detail?.toLowerCase().includes(search.toLowerCase()) ||
        a.subject?.toLowerCase().includes(search.toLowerCase()) ||
        a.type?.toLowerCase().includes(search.toLowerCase());
      return matchesSeverity && matchesSearch;
    });
  }, [anomalies, severityFilter, search]);

  // Paginate sliced items
  const totalItems = filteredAnomalies.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const paginatedAnomalies = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredAnomalies.slice(start, start + pageSize);
  }, [filteredAnomalies, currentPage, pageSize]);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/40 pb-5">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-red-500/15 text-red-400 border border-red-500/30 shadow-sm shrink-0">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-foreground flex items-center gap-2">
              Automated Anomaly Detection
              {isFetching && !isLoading && (
                <span className="inline-flex items-center gap-1 text-[11px] font-normal text-muted-foreground bg-muted/40 px-2 py-0.5 rounded-full border border-border/40">
                  <Loader2 className="w-3 h-3 animate-spin text-red-400" />
                  Scanning...
                </span>
              )}
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Z-score statistics and threshold alerting to spot abnormal workloads and extreme repetitive ratios
            </p>
          </div>
        </div>

        {/* Search & Severity Filter Bar */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search anomalies by ID, details..."
              className="w-full bg-muted/30 border border-border/60 rounded-xl pl-8 pr-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-red-400/50 transition-colors"
            />
          </div>

          <div className="flex items-center gap-1 bg-muted/30 p-1 rounded-xl border border-border/50">
            <button
              onClick={() => setSeverityFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                severityFilter === 'all' ? 'bg-muted/80 text-foreground font-semibold shadow-sm border border-border/60' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              All Alerts
            </button>
            <button
              onClick={() => setSeverityFilter('high')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
                severityFilter === 'high' ? 'bg-red-500/20 text-red-400 font-semibold shadow-sm border border-red-500/30' : 'text-muted-foreground hover:text-red-400'
              }`}
            >
              High
            </button>
            <button
              onClick={() => setSeverityFilter('medium')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
                severityFilter === 'medium' ? 'bg-amber-500/20 text-amber-400 font-semibold shadow-sm border border-amber-500/30' : 'text-muted-foreground hover:text-amber-400'
              }`}
            >
              Medium
            </button>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="glass-card h-96 animate-pulse bg-muted/10" />
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div
              onClick={() => setSeverityFilter(severityFilter === 'high' ? 'all' : 'high')}
              className={`glass-card p-5 border-l-4 border-l-red-500 cursor-pointer transition-all hover:translate-y-[-2px] ${severityFilter === 'high' ? 'ring-2 ring-red-500/30 bg-red-500/5' : ''}`}
            >
              <p className="text-xs font-semibold text-muted-foreground uppercase flex items-center justify-between">
                <span>High Severity Alerts</span>
                {severityFilter === 'high' && <span className="text-[10px] text-red-400 font-bold">ACTIVE FILTER</span>}
              </p>
              <p className="text-2xl font-mono font-bold text-red-400 mt-1 tabular-nums">
                {anomalies.filter((a: any) => a.severity === 'high').length}
              </p>
              <p className="text-xs text-muted-foreground mt-2">Requires immediate HR & Operations review</p>
            </div>

            <div
              onClick={() => setSeverityFilter(severityFilter === 'medium' ? 'all' : 'medium')}
              className={`glass-card p-5 border-l-4 border-l-amber-500 cursor-pointer transition-all hover:translate-y-[-2px] ${severityFilter === 'medium' ? 'ring-2 ring-amber-500/30 bg-amber-500/5' : ''}`}
            >
              <p className="text-xs font-semibold text-muted-foreground uppercase flex items-center justify-between">
                <span>Medium Severity Warnings</span>
                {severityFilter === 'medium' && <span className="text-[10px] text-amber-400 font-bold">ACTIVE FILTER</span>}
              </p>
              <p className="text-2xl font-mono font-bold text-amber-400 mt-1 tabular-nums">
                {anomalies.filter((a: any) => a.severity === 'medium').length}
              </p>
              <p className="text-xs text-muted-foreground mt-2">Candidates for targeted workflow automation</p>
            </div>

            <div
              onClick={() => setSeverityFilter('all')}
              className="glass-card p-5 border-l-4 border-l-green-500 cursor-pointer transition-all hover:translate-y-[-2px]"
            >
              <p className="text-xs font-semibold text-muted-foreground uppercase">Normal Operations</p>
              <p className="text-2xl font-mono font-bold text-green-400 mt-1 tabular-nums">12 Profiles</p>
              <p className="text-xs text-muted-foreground mt-2">Working within standard 2σ threshold</p>
            </div>
          </div>

          <div className="space-y-4 pt-2">
            <h3 className="text-sm font-semibold text-foreground flex items-center justify-between">
              <span className="flex items-center gap-2">
                Flagged Incidents & Opportunities
                <span className="text-xs text-muted-foreground font-normal">
                  (Showing {paginatedAnomalies.length} of {totalItems} filtered records)
                </span>
              </span>
            </h3>

            {paginatedAnomalies.length === 0 ? (
              <div className="glass-card p-12 text-center text-muted-foreground flex flex-col items-center justify-center space-y-2 border-border/60">
                <CheckCircle className="w-8 h-8 text-green-400" />
                <p className="font-medium text-foreground">No matching anomaly records found</p>
                <p className="text-xs">Try adjusting your keyword search or switching severity tab filters.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {paginatedAnomalies.map((anomaly: any) => {
                  const isHigh = anomaly.severity === 'high';
                  const badgeStyle = isHigh
                    ? 'bg-red-500/15 text-red-400 border-red-500/30'
                    : 'bg-amber-500/15 text-amber-400 border-amber-500/30';

                  return (
                    <div
                      key={anomaly.id}
                      className="glass-card p-5 border-border/60 hover:border-primary/40 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 group"
                    >
                      <div className="flex items-start gap-4">
                        <div className={`p-2.5 rounded-xl mt-0.5 shrink-0 ${isHigh ? 'bg-red-500/10 text-red-400' : 'bg-amber-500/10 text-amber-400'}`}>
                          <AlertTriangle className="w-5 h-5" />
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase border ${badgeStyle}`}>
                              {anomaly.severity} severity
                            </span>
                            <span className="text-[11px] font-mono text-muted-foreground uppercase">
                              Type: {anomaly.type?.replace(/_/g, ' ')}
                            </span>
                          </div>
                          <h4 className="text-base font-semibold text-foreground group-hover:text-primary transition-colors">
                            {anomaly.headline}
                          </h4>
                          <p className="text-xs text-muted-foreground max-w-2xl leading-relaxed">
                            {anomaly.detail}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 self-end md:self-center shrink-0">
                        {anomaly.zScore && (
                          <div className="text-right">
                            <p className="text-[10px] text-muted-foreground uppercase">Statistical Z-Score</p>
                            <p className="font-mono font-bold text-sm text-foreground">{anomaly.zScore} σ</p>
                          </div>
                        )}

                        {anomaly.subjectType === 'employee' ? (
                          <Link
                            href={`/dashboard/employees/${anomaly.subject}` as any}
                            className="inline-flex items-center gap-1 px-3 py-2 rounded-xl bg-primary/10 text-primary hover:bg-primary/20 text-xs font-medium transition-all"
                          >
                            Inspect Profile
                            <ArrowRight className="w-3.5 h-3.5" />
                          </Link>
                        ) : (
                          <Link
                            href={"/dashboard/categories" as any}
                            className="inline-flex items-center gap-1 px-3 py-2 rounded-xl bg-secondary/10 text-secondary hover:bg-secondary/20 text-xs font-medium transition-all"
                          >
                            View Department
                            <ArrowRight className="w-3.5 h-3.5" />
                          </Link>
                        )}
                      </div>
                    </div>
                  );
                })}

                <div className="glass-card overflow-hidden border-border/60">
                  <PaginationControls
                    currentPage={currentPage}
                    totalPages={totalPages}
                    totalItems={totalItems}
                    pageSize={pageSize}
                    onPageChange={(p) => setCurrentPage(p)}
                    onPageSizeChange={(size) => {
                      setPageSize(size);
                      setCurrentPage(1);
                    }}
                    pageSizeOptions={[5, 10, 15]}
                    itemLabel="anomalies"
                  />
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
