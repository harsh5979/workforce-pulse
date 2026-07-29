'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { formatINR, formatHours, formatPct } from '@/lib/formatters';
import { ArrowLeft, User, Building, Briefcase, Clock, Flame, ShieldAlert, CheckCircle } from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import Link from 'next/link';

export default function EmployeeProfilePage() {
  const params = useParams();
  const id = (params?.id as string) ?? '';

  const { data, isLoading, error } = useQuery({
    queryKey: ['employee-profile', id],
    queryFn: () => api.getEmployee(id),
    enabled: Boolean(id),
  });

  if (isLoading) {
    return <div className="glass-card h-96 animate-pulse bg-muted/10" />;
  }

  if (error || !data) {
    return (
      <div className="p-6 text-center text-destructive bg-destructive/10 rounded-xl border border-destructive/20">
        Employee profile <code className="font-mono font-bold">{id}</code> not found or currently unreachable.
      </div>
    );
  }

  const { employee, categoryBreakdown, weeklyActivity, peerAvgHours } = data;

  return (
    <div className="space-y-6 animate-fade-in">
      <Link
        href={"/dashboard/employees" as any}
        className="inline-flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Back to Workforce List
      </Link>

      {/* Profile Header */}
      <div className="glass-card p-6 border-border/60 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 bg-gradient-to-r from-card via-card to-primary/10">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-primary/20 border border-primary/30 flex items-center justify-center font-bold text-2xl text-primary font-mono shadow-md">
            {employee.fullName?.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
              {employee.fullName}
              <span className="px-2 py-0.5 rounded-full text-[11px] bg-green-500/15 text-green-400 border border-green-500/30 font-normal">
                {employee.status}
              </span>
            </h1>
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-3">
              <span className="flex items-center gap-1">
                <Building className="w-3.5 h-3.5 text-muted-foreground/70" />
                {employee.department}
              </span>
              <span>·</span>
              <span className="flex items-center gap-1">
                <Briefcase className="w-3.5 h-3.5 text-muted-foreground/70" />
                {employee.role}
              </span>
              <span>·</span>
              <span className="font-mono">ID: {employee.employeeId}</span>
            </p>
          </div>
        </div>

        {/* Compensation Details */}
        <div className="flex items-center gap-4 bg-background/60 p-4 rounded-xl border border-border/50">
          <div>
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Normalized Comp</p>
            <p className="text-xl font-mono font-bold text-secondary tabular-nums">
              {formatINR(Number(employee.compAnnualInr))} / yr
            </p>
          </div>
          <div className="h-8 w-[1px] bg-border/60" />
          <div>
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Hours / Day</p>
            <p className="text-xl font-mono font-bold text-foreground tabular-nums">
              {employee.workingHoursDay ?? 8}h
            </p>
          </div>
        </div>
      </div>

      {/* Analytics Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Weekly Trend */}
        <div className="glass-card p-6 border-border/60">
          <h3 className="text-sm font-semibold mb-4">4-Week Activity Trajectory</h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={weeklyActivity ?? []} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={11} axisLine={false} tickLine={false} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}h`} />
                <Tooltip
                  content={({ active, payload, label }: any) => {
                    if (!active || !payload || !payload.length) return null;
                    return (
                      <div className="bg-card p-3 rounded-lg border border-border shadow-xl text-xs space-y-1">
                        <p className="font-semibold text-foreground">{label}</p>
                        <p className="text-secondary">Total Logged: <span className="font-mono font-bold">{formatHours(payload[0].value)}</span></p>
                        <p className="text-primary">Repetitive Time: <span className="font-mono font-bold">{formatHours(payload[1].value)}</span></p>
                      </div>
                    );
                  }}
                />
                <Line type="monotone" dataKey="totalHours" stroke="hsl(var(--secondary))" strokeWidth={2.5} dot={{ r: 4 }} />
                <Line type="monotone" dataKey="repHours" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Task Category Allocation */}
        <div className="glass-card p-6 border-border/60">
          <h3 className="text-sm font-semibold mb-4">Time Allocation by Category</h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={categoryBreakdown ?? []} layout="vertical" margin={{ top: 0, right: 10, left: 45, bottom: 0 }}>
                <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={11} tickFormatter={(v) => `${v}h`} />
                <YAxis type="category" dataKey="category" stroke="hsl(var(--muted-foreground))" fontSize={11} width={100} tickLine={false} />
                <Tooltip
                  content={({ active, payload, label }: any) => {
                    if (!active || !payload || !payload.length) return null;
                    const d = payload[0].payload;
                    return (
                      <div className="bg-card p-3 rounded-lg border border-border shadow-xl text-xs space-y-1">
                        <p className="font-semibold text-foreground">{label}</p>
                        <p className="text-primary">Repetitive Hours: <span className="font-mono font-bold">{formatHours(d.repHours)}</span></p>
                        <p className="text-secondary">Total Hours: <span className="font-mono font-bold">{formatHours(d.totalHours)}</span></p>
                        <p className="text-amber-400">Repetitive Share: <span className="font-mono font-bold">{formatPct(d.repShare)}</span></p>
                      </div>
                    );
                  }}
                />
                <Bar dataKey="repHours" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Peer Comparison Note */}
      <div className="p-4 rounded-xl bg-muted/20 border border-border/50 text-xs text-muted-foreground flex items-center justify-between">
        <span>
          💡 <strong className="text-foreground">Role Benchmark:</strong>{' '}
          {peerAvgHours !== null && peerAvgHours !== undefined && peerAvgHours > 0 ? (
            <>Peers in the <strong>{employee.role}</strong> position log an average of{' '}
            <code className="font-mono text-secondary">{formatHours(peerAvgHours)}</code> per week.</>
          ) : (
            <>No peer benchmark available — <strong>{employee.role}</strong> is the only employee in this role with activity data.</>
          )}
        </span>
      </div>
    </div>
  );
}
