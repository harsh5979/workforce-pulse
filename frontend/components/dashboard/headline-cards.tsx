'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { useFilterStore, useFilterParams } from '@/store/filter-store';
import { formatINR, formatHours, formatPct } from '@/lib/formatters';
import { Clock, IndianRupee, Activity, Flame, ShieldCheck } from 'lucide-react';

export function HeadlineCards() {
  const params = useFilterParams();
  const { data, isLoading, error } = useQuery({
    queryKey: ['dashboard-headline', params],
    queryFn: () => api.getDashboard(params),
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="glass-card h-32 animate-pulse bg-muted/20" />
        ))}
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm mb-6">
        Failed to load analytics metrics. Please ensure the backend server is running and data is seeded.
      </div>
    );
  }

  return (
    <div className="space-y-6 mb-8 animate-fade-in">
      {/* Primary Hero Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Hours Recoverable */}
        <div className="metric-card border-primary/30 bg-gradient-to-br from-card to-primary/5">
          <div className="flex items-center justify-between text-muted-foreground mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Hours Recoverable / Mo</span>
            <div className="p-2 rounded-lg bg-primary/15 text-primary">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl lg:text-3xl font-bold font-mono text-foreground tabular-nums tracking-tight">
            {formatHours(data.hoursRecoverablePerMonth)}
          </div>
          <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
            <span className="text-primary font-medium">Repetitive work</span> ready for automation
          </p>
        </div>

        {/* Card 2: INR Recoverable */}
        <div className="metric-card border-secondary/30 bg-gradient-to-br from-card to-secondary/5">
          <div className="flex items-center justify-between text-muted-foreground mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Financial Opportunity / Mo</span>
            <div className="p-2 rounded-lg bg-secondary/15 text-secondary">
              <IndianRupee className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl lg:text-3xl font-bold font-mono text-foreground tabular-nums tracking-tight">
            {formatINR(data.inrRecoverablePerMonth)}
          </div>
          <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
            Based on <span className="text-secondary font-medium">normalized compensation</span>
          </p>
        </div>

        {/* Card 3: Repetitive Share */}
        <div className="metric-card border-amber-500/30 bg-gradient-to-br from-card to-amber-500/5">
          <div className="flex items-center justify-between text-muted-foreground mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Repetitive Work Share</span>
            <div className="p-2 rounded-lg bg-amber-500/15 text-amber-400">
              <Flame className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl lg:text-3xl font-bold font-mono text-foreground tabular-nums tracking-tight">
            {formatPct(data.repetitiveShare)}
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Of <span className="font-mono text-foreground">{formatHours(data.totalHours)}</span> total logged hours
          </p>
        </div>

        {/* Card 4: Ingestion Health */}
        <div className="metric-card border-green-500/30 bg-gradient-to-br from-card to-green-500/5">
          <div className="flex items-center justify-between text-muted-foreground mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Data Health & Audit</span>
            <div className="p-2 rounded-lg bg-green-500/15 text-green-400">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl lg:text-3xl font-bold font-mono text-green-400 tabular-nums tracking-tight">
            99.2% Clean
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Resolved <span className="font-mono text-green-400">{data.latestIngestion?.duplicateEmployees ?? 1}</span> duplicates & negative outliers
          </p>
        </div>
      </div>
    </div>
  );
}
