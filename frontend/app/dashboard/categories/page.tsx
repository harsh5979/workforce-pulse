'use client';

import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { useFilterStore, useFilterParams } from '@/store/filter-store';

import { formatHours, formatPct } from '@/lib/formatters';
import { useState, useEffect, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { CHART_COLORS } from '@/lib/constants';
import { BarChart3, AppWindow, Building2, Search, ArrowUpDown, Loader2 } from 'lucide-react';
import { PaginationControls } from '@/components/ui/pagination-controls';

export default function CategoriesPage() {
  const [groupBy, setGroupBy] = useState<'task_category' | 'app_used' | 'department'>('task_category');
  const params = useFilterParams();
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(8);
  const [sortBy, setSortBy] = useState<'name' | 'totalHours' | 'repHours' | 'repShare'>('repHours');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Tanstack Query with keepPreviousData for smooth transitions across groupby switches & filtering
  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['categories-list', groupBy, params],
    queryFn: () => api.getCategories(groupBy, params),
    placeholderData: keepPreviousData,
    staleTime: 60 * 1000,
  });

  // Reset pagination to page 1 on filter or groupBy changes
  useEffect(() => {
    setCurrentPage(1);
  }, [groupBy, search, JSON.stringify(params)]);

  // Filter and sort items
  const filteredAndSorted = useMemo(() => {
    const list = data ?? [];
    const filtered = list.filter((item: any) =>
      item.name?.toLowerCase().includes(search.toLowerCase())
    );

    return filtered.sort((a: any, b: any) => {
      const valA = a[sortBy] ?? 0;
      const valB = b[sortBy] ?? 0;
      if (typeof valA === 'string' && typeof valB === 'string') {
        return sortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      return sortOrder === 'asc' ? valA - valB : valB - valA;
    });
  }, [data, search, sortBy, sortOrder]);

  // Paginate sliced data
  const totalItems = filteredAndSorted.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredAndSorted.slice(start, start + pageSize);
  }, [filteredAndSorted, currentPage, pageSize]);

  const toggleSort = (column: 'name' | 'totalHours' | 'repHours' | 'repShare') => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder(column === 'name' ? 'asc' : 'desc');
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-lg font-bold text-foreground flex items-center gap-2">
            Activity Breakdown & Taxonomy
            {isFetching && !isLoading && (
              <span className="inline-flex items-center gap-1 text-[11px] font-normal text-muted-foreground bg-muted/40 px-2 py-0.5 rounded-full border border-border/40">
                <Loader2 className="w-3 h-3 animate-spin text-primary" />
                Updating...
              </span>
            )}
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Analyze time allocation across standardized task classifications, software applications, and departments
          </p>
        </div>

        {/* Group By Selector & Search */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative w-full sm:w-56">
            <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter classifications..."
              className="w-full bg-muted/30 border border-border/60 rounded-xl pl-8 pr-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors"
            />
          </div>

          <div className="flex items-center gap-1 bg-muted/30 p-1 rounded-xl border border-border/50">
            <button
              onClick={() => setGroupBy('task_category')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
                groupBy === 'task_category' ? 'bg-primary text-primary-foreground shadow-md' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              Task Category
            </button>
            <button
              onClick={() => setGroupBy('app_used')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
                groupBy === 'app_used' ? 'bg-primary text-primary-foreground shadow-md' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <AppWindow className="w-3.5 h-3.5" />
              App Used
            </button>
            <button
              onClick={() => setGroupBy('department')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
                groupBy === 'department' ? 'bg-primary text-primary-foreground shadow-md' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              Department
            </button>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="glass-card h-96 animate-pulse bg-muted/10" />
      ) : (
        <>
          {/* Chart Overview (Top 8 for visual cleanliness) */}
          <div className="glass-card p-6 border-border/60">
            <h3 className="text-sm font-semibold mb-4 text-foreground flex items-center justify-between">
              <span>Repetitive vs Productive Volume Comparison</span>
              <span className="text-xs font-normal text-muted-foreground">Showing top visual classifications</span>
            </h3>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={(filteredAndSorted ?? []).slice(0, 8)} layout="vertical" margin={{ top: 5, right: 30, left: 60, bottom: 5 }}>
                  <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={11} tickFormatter={(v) => `${v}h`} />
                  <YAxis type="category" dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={11} width={110} tickLine={false} />
                  <Tooltip
                    content={({ active, payload, label }: any) => {
                      if (!active || !payload || !payload.length) return null;
                      const d = payload[0].payload;
                      return (
                        <div className="bg-card p-3 rounded-lg border border-border shadow-lg text-xs space-y-1">
                          <p className="font-semibold text-foreground border-b border-border/40 pb-1">{label}</p>
                          <p className="text-primary">Repetitive Hours: <span className="font-mono font-bold">{formatHours(d.repHours)}</span></p>
                          <p className="text-secondary">Total Hours: <span className="font-mono font-bold">{formatHours(d.totalHours)}</span></p>
                          <p className="text-amber-400 font-semibold">Repetitive Share: <span className="font-mono">{formatPct(d.repShare)}</span></p>
                        </div>
                      );
                    }}
                  />
                  <Bar dataKey="repHours" name="Repetitive Hours" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]}>
                    {(filteredAndSorted ?? []).slice(0, 8).map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Paginated & Sortable Tabular Analysis */}
          <div className="glass-card overflow-x-auto border-border/60 touch-pan-x scrollbar-thin">
            <table className="w-full text-left border-collapse text-xs min-w-[600px]">
              <thead>
                <tr className="border-b border-border bg-muted/20 text-muted-foreground uppercase tracking-wider font-semibold select-none">
                  <th
                    onClick={() => toggleSort('name')}
                    className="py-3.5 px-4 cursor-pointer hover:text-foreground transition-colors group"
                  >
                    <div className="flex items-center gap-1.5">
                      Classification Name
                      <ArrowUpDown className="w-3 h-3 opacity-40 group-hover:opacity-100" />
                    </div>
                  </th>
                  <th className="py-3.5 px-4 text-right">Total Logs</th>
                  <th
                    onClick={() => toggleSort('totalHours')}
                    className="py-3.5 px-4 text-right cursor-pointer hover:text-foreground transition-colors group"
                  >
                    <div className="flex items-center justify-end gap-1.5">
                      Total Duration
                      <ArrowUpDown className="w-3 h-3 opacity-40 group-hover:opacity-100" />
                    </div>
                  </th>
                  <th
                    onClick={() => toggleSort('repHours')}
                    className="py-3.5 px-4 text-right cursor-pointer hover:text-foreground transition-colors group"
                  >
                    <div className="flex items-center justify-end gap-1.5">
                      Repetitive Duration
                      <ArrowUpDown className="w-3 h-3 opacity-40 group-hover:opacity-100" />
                    </div>
                  </th>
                  <th
                    onClick={() => toggleSort('repShare')}
                    className="py-3.5 px-4 text-right cursor-pointer hover:text-foreground transition-colors group"
                  >
                    <div className="flex items-center justify-end gap-1.5">
                      Repetitive Share
                      <ArrowUpDown className="w-3 h-3 opacity-40 group-hover:opacity-100" />
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {paginatedRows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-muted-foreground">
                      No categories match your search criteria.
                    </td>
                  </tr>
                ) : (
                  paginatedRows.map((row: any) => (
                    <tr key={row.name} className="hover:bg-muted/30 transition-colors">
                      <td className="py-3.5 px-4 font-semibold text-foreground flex items-center gap-2.5">
                        <span className="w-2 h-2 rounded-full bg-primary inline-block shrink-0" />
                        {row.name}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono text-muted-foreground tabular-nums">{row.count}</td>
                      <td className="py-3.5 px-4 text-right font-mono text-foreground tabular-nums font-medium">{formatHours(row.totalHours)}</td>
                      <td className="py-3.5 px-4 text-right font-mono text-primary tabular-nums font-bold">{formatHours(row.repHours)}</td>
                      <td className="py-3.5 px-4 text-right">
                        <span className="px-2.5 py-1 rounded-full bg-primary/10 text-primary border border-primary/20 font-mono font-medium">
                          {formatPct(row.repShare)}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>

            {/* Pagination Controls */}
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
              pageSizeOptions={[5, 8, 15, 25]}
              itemLabel="classifications"
            />
          </div>
        </>
      )}
    </div>
  );
}
