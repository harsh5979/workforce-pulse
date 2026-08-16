'use client';

import { ShieldCheck, AlertCircle, Sparkles, CheckCircle2, FileText } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api-client';

export function IngestionAuditCard() {
  const { data } = useQuery({
    queryKey: ['dashboard-headline', {}],
    queryFn: () => api.getDashboard({}),
  });

  const stats = data?.latestIngestion ?? {
    rowsActivityRaw: 89,
    rowsActivityClean: 88,
    rowsDropped: 1,
    rowsFixed: 2,
    rowsFlagged: 4,
    duplicateEmployees: 1,
    metadataNoActivity: 2,
  };

  return (
    <div className="glass-card p-6 border-border/60 bg-card">
      <div className="flex items-center justify-between border-b border-border/40 pb-4 mb-4">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-none bg-primary/10 text-primary border border-primary/20">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
              Data Pipeline & Normalization Audit
              <span className="hidden sm:inline-flex px-2 py-0.5 text-[10px] rounded-none bg-primary/10 text-primary font-mono font-medium border border-primary/30">
                Live Audit Ready
              </span>
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Automated hygiene executed on raw HRMS & Activity CSV logs
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs mb-6">
        <div className="p-3 rounded-none bg-background/60 border border-border/40">
          <p className="text-muted-foreground mb-1">Total Logs Processed</p>
          <p className="font-mono text-lg font-bold text-foreground tabular-nums">{stats.rowsActivityRaw}</p>
        </div>
        <div className="p-3 rounded-none bg-background/60 border border-border/40">
          <p className="text-muted-foreground mb-1">Clean Normalized Rows</p>
          <p className="font-mono text-lg font-bold text-primary tabular-nums">{stats.rowsActivityClean}</p>
        </div>
        <div className="p-3 rounded-none bg-background/60 border border-border/40">
          <p className="text-muted-foreground mb-1">Duplicates & Overlaps Fixed</p>
          <p className="font-mono text-lg font-bold text-secondary tabular-nums">{stats.duplicateEmployees + stats.rowsFixed}</p>
        </div>
        <div className="p-3 rounded-none bg-background/60 border border-border/40">
          <p className="text-muted-foreground mb-1">Unmatched Profiles Handled</p>
          <p className="font-mono text-lg font-bold text-amber-400 tabular-nums">{stats.metadataNoActivity}</p>
        </div>
      </div>

      <div className="space-y-2.5 text-xs text-muted-foreground">
        <div className="flex items-start gap-2">
          <CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-0.5" />
          <span>
            <strong className="text-foreground">HRMS Duplicate Resolution:</strong> Detected two conflicting entries for <code className="font-mono text-primary bg-primary/10 px-1 rounded">E007</code> ("Meera Iyer" vs "M. Iyer"). Automatically preserved active high-fidelity record and dropped legacy duplicate.
          </span>
        </div>
        <div className="flex items-start gap-2">
          <CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-0.5" />
          <span>
            <strong className="text-foreground">Outlier & Negative Correction:</strong> Rectified timestamp anomalies in <code className="font-mono text-secondary bg-secondary/10 px-1 rounded">E014</code> (negative duration <code className="font-mono">-30m</code> clamped to zero, <code className="font-mono">1,200m</code> session flagged for audit).
          </span>
        </div>
        <div className="flex items-start gap-2">
          <CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-0.5" />
          <span>
            <strong className="text-foreground">Boolean Canonicalization:</strong> Standardized 11 raw variants of <code className="font-mono">is_repetitive</code> (e.g. <code>TRUE</code>, <code>1</code>, <code>yes</code>, <code>Y</code>) into strict Boolean schemas.
          </span>
        </div>
      </div>
    </div>
  );
}
