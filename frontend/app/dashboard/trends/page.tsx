'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { useFilterStore, useFilterParams } from '@/store/filter-store';
import { FilterBar } from '@/components/filters/filter-bar';
import { formatHours, formatPct } from '@/lib/formatters';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, AreaChart, Area } from 'recharts';
import { TrendingUp, ArrowUpRight, Flame, Calendar } from 'lucide-react';

export default function TrendsPage() {
  const params = useFilterParams();

  const { data, isLoading } = useQuery({
    queryKey: ['trends-list', params],
    queryFn: () => api.getTrends(params),
  });

  if (isLoading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <FilterBar />
        <div className="glass-card h-96 animate-pulse bg-muted/10" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <FilterBar />

      <div>
        <h1 className="text-lg font-bold text-foreground flex items-center gap-2">
          Week-over-Week Automation Trajectory
          <span className="px-2 py-0.5 rounded-full text-[11px] bg-primary/15 text-primary font-mono font-normal">
            4-Week Cohort
          </span>
        </h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Monitor shift in repetitive task accumulation over time to validate operational improvements
        </p>
      </div>

      {/* Big Area Chart for Trajectory */}
      <div className="glass-card p-6 border-border/60">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-sm font-semibold text-foreground">Repetitive vs Productive Volume Trend (Weeks 1–4)</h3>
        </div>

        <div className="h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data ?? []} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="colorRep" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="colorTot" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--secondary))" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="hsl(var(--secondary))" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={11} axisLine={false} tickLine={false} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}h`} />
              <Tooltip
                content={({ active, payload, label }: any) => {
                  if (!active || !payload || !payload.length) return null;
                  const d = payload[0].payload;
                  return (
                    <div className="bg-card p-3.5 rounded-xl border border-border shadow-2xl text-xs space-y-1.5">
                      <p className="font-bold text-foreground border-b border-border/40 pb-1 flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-primary" />
                        {label}
                      </p>
                      <div className="flex justify-between text-secondary">
                        <span>Total Logged Hours:</span>
                        <span className="font-mono font-bold">{formatHours(d.totalHours)}</span>
                      </div>
                      <div className="flex justify-between text-primary">
                        <span>Repetitive Work Time:</span>
                        <span className="font-mono font-bold">{formatHours(d.repHours)}</span>
                      </div>
                      <div className="flex justify-between text-amber-400 font-semibold pt-1 border-t border-border/40">
                        <span>Repetitive Share:</span>
                        <span className="font-mono">{formatPct(d.repShare)}</span>
                      </div>
                    </div>
                  );
                }}
              />
              <Area type="monotone" dataKey="totalHours" stroke="hsl(var(--secondary))" fillOpacity={1} fill="url(#colorTot)" strokeWidth={2.5} name="Total Hours" />
              <Area type="monotone" dataKey="repHours" stroke="hsl(var(--primary))" fillOpacity={1} fill="url(#colorRep)" strokeWidth={2.5} name="Repetitive Hours" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Summary Cards per week */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {(data ?? []).map((week: any) => (
          <div key={week.week} className="glass-card p-4 border-border/50 hover:border-primary/40 transition-colors">
            <p className="text-xs font-semibold text-muted-foreground uppercase">{week.label}</p>
            <p className="text-xl font-mono font-bold text-foreground mt-2 tabular-nums">
              {formatHours(week.totalHours)}
            </p>
            <div className="flex items-center justify-between text-xs mt-3 pt-2 border-t border-border/30">
              <span className="text-primary font-medium">{formatHours(week.repHours)} rep</span>
              <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 font-mono text-[11px] font-semibold">
                {formatPct(week.repShare)} share
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
