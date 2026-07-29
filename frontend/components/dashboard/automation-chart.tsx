'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { useFilterStore, useFilterParams } from '@/store/filter-store';
import { formatHours, formatPct } from '@/lib/formatters';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';

export function AutomationChart() {
  const params = useFilterParams();
  const { setCategory, category } = useFilterStore();

  const { data, isLoading } = useQuery({
    queryKey: ['categories-chart', params],
    queryFn: () => api.getCategories('task_category', params),
  });

  if (isLoading) {
    return <div className="glass-card h-80 animate-pulse bg-muted/15" />;
  }

  const chartData = (data ?? []).slice(0, 8).map((item: any) => ({
    name: item.name,
    Repetitive: item.repHours,
    Productive: Math.max(0, Math.round((item.totalHours - item.repHours) * 10) / 10),
    repShare: item.repShare,
    total: item.totalHours,
  }));

  return (
    <div className="glass-card p-6 border-border/60">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-base font-semibold text-foreground">Task Categories by Time Expenditure</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Compare repetitive vs productive hours across your workforce
          </p>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-primary inline-block" />
            <span className="text-muted-foreground">Repetitive (Automation Target)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-secondary/60 inline-block" />
            <span className="text-muted-foreground">Productive Work</span>
          </div>
        </div>
      </div>

      <div className="h-[300px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 25 }}>
            <XAxis
              dataKey="name"
              stroke="hsl(var(--muted-foreground))"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              angle={-20}
              textAnchor="end"
              interval={0}
            />
            <YAxis
              stroke="hsl(var(--muted-foreground))"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => `${v}h`}
            />
            <Tooltip
              content={({ active, payload, label }: any) => {
                if (!active || !payload || !payload.length) return null;
                const d = payload[0].payload;
                return (
                  <div className="bg-card p-3 rounded-lg border border-border shadow-xl text-xs space-y-1.5 min-w-[180px]">
                    <p className="font-semibold text-foreground border-b border-border/40 pb-1">{label}</p>
                    <div className="flex justify-between text-primary">
                      <span>Repetitive Hours:</span>
                      <span className="font-mono font-medium">{formatHours(d.Repetitive)}</span>
                    </div>
                    <div className="flex justify-between text-secondary">
                      <span>Productive Hours:</span>
                      <span className="font-mono font-medium">{formatHours(d.Productive)}</span>
                    </div>
                    <div className="flex justify-between text-amber-400 pt-1 border-t border-border/40 font-semibold">
                      <span>Repetitive Share:</span>
                      <span className="font-mono">{formatPct(d.repShare)}</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground italic pt-1">Click bar to filter dashboard</p>
                  </div>
                );
              }}
            />
            <Bar
              dataKey="Repetitive"
              stackId="a"
              fill="hsl(var(--primary))"
              radius={[0, 0, 0, 0]}
              className="cursor-pointer hover:opacity-80 transition-opacity"
              onClick={(d: any) => setCategory(category === d.name ? null : d.name)}
            />
            <Bar
              dataKey="Productive"
              stackId="a"
              fill="hsl(var(--secondary) / 0.5)"
              radius={[4, 4, 0, 0]}
              className="cursor-pointer hover:opacity-80 transition-opacity"
              onClick={(d: any) => setCategory(category === d.name ? null : d.name)}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
