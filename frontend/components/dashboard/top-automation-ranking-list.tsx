'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { useFilterStore, useFilterParams } from '@/store/filter-store';
import { formatHours, formatPct, scoreLabel } from '@/lib/formatters';
import { Flame, ArrowUpRight, Users, Trophy } from 'lucide-react';
import Link from 'next/link';

export function TopAutomationRankingList() {
  const params = useFilterParams();
  const { data, isLoading } = useQuery({
    queryKey: ['automation-ranking', params],
    queryFn: () => api.getRanking(params),
  });

  if (isLoading) {
    return <div className="glass-card h-80 animate-pulse bg-muted/15" />;
  }

  const ranking = (data ?? []).slice(0, 5);

  return (
    <div className="glass-card p-6 border-border/60">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-amber-500/15 text-amber-400 border border-amber-500/30">
            <Trophy className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-foreground">Top Automation Priorities</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Ranked by composite score (40% Volume, 40% Repetitive Share, 20% Employee Reach)
            </p>
          </div>
        </div>
        <Link
          href={"/dashboard/categories" as any}
          className="text-xs text-primary hover:underline inline-flex items-center gap-1"
        >
          View all categories
          <ArrowUpRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      <div className="space-y-3">
        {ranking.map((item: any) => {
          const priority = scoreLabel(item.score);
          const badgeColor =
            priority === 'Very High' || priority === 'High'
              ? 'bg-red-500/15 text-red-400 border-red-500/30'
              : 'bg-amber-500/15 text-amber-400 border-amber-500/30';

          return (
            <div
              key={item.category}
              className="flex items-center justify-between p-3.5 rounded-xl bg-card hover:bg-muted/40 border border-border/40 transition-colors group"
            >
              <div className="flex items-center gap-3.5 min-w-[200px]">
                <div className="w-7 h-7 rounded-full bg-muted/60 flex items-center justify-center font-mono text-xs font-semibold text-muted-foreground group-hover:bg-primary/20 group-hover:text-primary transition-colors">
                  #{item.rank}
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
                    {item.category}
                  </p>
                  <div className="flex items-center gap-2 mt-1 text-[11px] text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Users className="w-3 h-3 text-muted-foreground/70" />
                      {item.employeeCount} staff
                    </span>
                    <span>·</span>
                    <span>Total {formatHours(item.totalHours)}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-6">
                <div className="text-right hidden sm:block">
                  <p className="text-xs font-mono font-bold text-foreground tabular-nums">
                    {formatHours(item.repetitiveHours)}
                  </p>
                  <p className="text-[10px] text-muted-foreground">Repetitive Time</p>
                </div>

                <div className="text-right">
                  <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${badgeColor} inline-flex items-center gap-1`}>
                    <Flame className="w-3 h-3" />
                    {formatPct(item.repetitiveShare)}
                  </span>
                  <p className="text-[10px] text-muted-foreground mt-1 text-right font-mono">
                    Score: {item.score}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
