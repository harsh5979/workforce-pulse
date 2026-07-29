'use client';

import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { useFilterStore, useFilterParams } from '@/store/filter-store';

import { formatHours, formatPct } from '@/lib/formatters';
import { Users, ChevronRight, CheckCircle, Search, ArrowUpDown, Loader2 } from 'lucide-react';
import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { PaginationControls } from '@/components/ui/pagination-controls';

export default function EmployeesPage() {
  const router = useRouter();
  const params = useFilterParams();
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sortBy, setSortBy] = useState<'fullName' | 'totalHours' | 'repHours' | 'repShare'>('repHours');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Tanstack Query with proper caching and smooth placeholder transitioning
  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['employees-list', params],
    queryFn: () => api.getEmployees(params),
    placeholderData: keepPreviousData,
    staleTime: 60 * 1000,
  });

  // Reset to page 1 whenever search filters or global department/week filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [search, JSON.stringify(params)]);

  // Memoized filtering and sorting
  const filteredAndSorted = useMemo(() => {
    const list = data ?? [];
    const filtered = list.filter((emp: any) =>
      emp.fullName?.toLowerCase().includes(search.toLowerCase()) ||
      emp.employeeId?.toLowerCase().includes(search.toLowerCase()) ||
      emp.department?.toLowerCase().includes(search.toLowerCase()) ||
      emp.role?.toLowerCase().includes(search.toLowerCase())
    );

    return filtered.sort((a: any, b: any) => {
      const valA = a[sortBy] ?? (typeof a[sortBy] === 'string' ? '' : 0);
      const valB = b[sortBy] ?? (typeof b[sortBy] === 'string' ? '' : 0);
      if (typeof valA === 'string' && typeof valB === 'string') {
        return sortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      return sortOrder === 'asc' ? valA - valB : valB - valA;
    });
  }, [data, search, sortBy, sortOrder]);

  // Paginate sliced data
  const totalItems = filteredAndSorted.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const paginatedEmployees = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredAndSorted.slice(start, start + pageSize);
  }, [filteredAndSorted, currentPage, pageSize]);

  const toggleSort = (column: 'fullName' | 'totalHours' | 'repHours' | 'repShare') => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder(column === 'fullName' ? 'asc' : 'desc');
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">


      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-lg font-bold text-foreground flex items-center gap-2">
              Workforce Employee Intelligence
              {isFetching && !isLoading && (
                <span className="inline-flex items-center gap-1 text-[11px] font-normal text-muted-foreground bg-muted/40 px-2 py-0.5 rounded-full border border-border/40">
                  <Loader2 className="w-3 h-3 animate-spin text-primary" />
                  Syncing...
                </span>
              )}
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Click on any candidate row or Inspect to view full individual analytics and activity charts
            </p>
          </div>
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-2.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, role, or ID..."
            className="w-full pl-9 pr-4 py-2 text-xs rounded-xl bg-card border border-border/70 text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all shadow-sm"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-2 text-xs text-muted-foreground hover:text-foreground font-semibold"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Main Employee Table Card */}
      <div className="bg-card border border-border/60 rounded-2xl shadow-xl overflow-hidden backdrop-blur-sm">
        {isLoading ? (
          <div className="py-24 flex flex-col items-center justify-center gap-3 text-muted-foreground">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-sm font-medium">Fetching employee activity records...</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-border/60 bg-muted/40 text-muted-foreground font-bold uppercase tracking-wider select-none">
                    <th
                      onClick={() => toggleSort('fullName')}
                      className="py-3.5 px-4 cursor-pointer hover:text-foreground transition-colors group"
                    >
                      <div className="flex items-center gap-1.5">
                        Employee Profile
                        <ArrowUpDown className="w-3 h-3 opacity-40 group-hover:opacity-100" />
                      </div>
                    </th>
                    <th className="py-3.5 px-4">Department & Role</th>
                    <th className="py-3.5 px-4 text-center">Data Sync Status</th>
                    <th
                      onClick={() => toggleSort('totalHours')}
                      className="py-3.5 px-4 text-right cursor-pointer hover:text-foreground transition-colors group"
                    >
                      <div className="flex items-center justify-end gap-1.5">
                        Total Logged
                        <ArrowUpDown className="w-3 h-3 opacity-40 group-hover:opacity-100" />
                      </div>
                    </th>
                    <th
                      onClick={() => toggleSort('repHours')}
                      className="py-3.5 px-4 text-right cursor-pointer hover:text-foreground transition-colors group"
                    >
                      <div className="flex items-center justify-end gap-1.5">
                        Repetitive Time
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
                    <th className="py-3.5 px-4 text-right">Top App</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {paginatedEmployees.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-16 text-center text-muted-foreground">
                        No matching employees found for your filter criteria.
                      </td>
                    </tr>
                  ) : (
                    paginatedEmployees.map((emp: any) => (
                      <tr
                        key={emp.employeeId}
                        onClick={() => router.push(`/dashboard/employees/${emp.employeeId}` as any)}
                        className="hover:bg-muted/40 transition-all cursor-pointer group select-none"
                        title={`Click to inspect detailed metrics for ${emp.fullName}`}
                      >
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center font-bold text-primary text-xs shrink-0 shadow-sm group-hover:bg-primary/30 transition-colors">
                              {emp.fullName?.slice(0, 2).toUpperCase() || 'E'}
                            </div>
                            <div>
                              <p className="font-bold text-foreground group-hover:text-primary transition-colors text-sm">
                                {emp.fullName}
                              </p>
                              <span className="text-[10px] font-mono text-muted-foreground">ID: {emp.employeeId}</span>
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <p className="font-semibold text-foreground text-xs">{emp.role}</p>
                          <p className="text-[11px] font-mono text-primary/80 uppercase">{emp.department}</p>
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 shadow-sm">
                            <CheckCircle className="w-3 h-3" />
                            Synced
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono font-semibold text-foreground tabular-nums text-sm">
                          {formatHours(emp.totalHours)}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono text-emerald-400 font-black tabular-nums text-sm">
                          {formatHours(emp.repHours)}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <span className="px-2.5 py-1 rounded-md bg-amber-500/15 text-amber-300 border border-amber-500/30 font-mono font-bold text-xs">
                            {formatPct(emp.repShare)}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right font-bold text-foreground font-mono">
                          {emp.topApp ?? '—'}
                        </td>
                        <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                          <Link
                            href={`/dashboard/employees/${emp.employeeId}` as any}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-primary/10 text-primary font-semibold hover:bg-primary/20 border border-primary/20 transition-all text-xs group-hover:bg-primary group-hover:text-primary-foreground shadow-sm"
                          >
                            <span>Inspect</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                          </Link>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Reusable Pagination Controls */}
            <PaginationControls
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={totalItems}
              pageSize={pageSize}
              onPageChange={(page) => setCurrentPage(page)}
              onPageSizeChange={(size) => {
                setPageSize(size);
                setCurrentPage(1);
              }}
            />
          </>
        )}
      </div>
    </div>
  );
}
