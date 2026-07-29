'use client';

import { useState, useRef, useEffect } from 'react';
import { useFilterStore } from '@/store/filter-store';
import { Filter, X, Building2, Calendar, RotateCcw, Tag, Check, ChevronDown, SlidersHorizontal, MoreHorizontal, CheckCircle2 } from 'lucide-react';

const DEPARTMENTS = [
  { id: 'Sales', label: 'Sales & Business Dev', count: 4 },
  { id: 'Finance', label: 'Financial Accounting & Tax', count: 3 },
  { id: 'Operations', label: 'General Operations', count: 3 },
  { id: 'CS', label: 'Customer Success & Support', count: 2 },
  { id: 'HR', label: 'Human Resources & Talent', count: 2 },
  { id: 'Marketing', label: 'Growth & Brand Marketing', count: 2 },
];

const WEEKS = [
  { id: 1, label: 'Week 1 • Aug 01 – Aug 07' },
  { id: 2, label: 'Week 2 • Aug 08 – Aug 14' },
  { id: 3, label: 'Week 3 • Aug 15 – Aug 21' },
  { id: 4, label: 'Week 4 • Aug 22 – Aug 28' },
];

export function FilterBar() {
  const { department, week, category, setDepartment, setWeek, setCategory, clearAll } = useFilterStore();
  
  // Dropdown Popover States
  const [openDropdown, setOpenDropdown] = useState<'dept' | 'week' | 'mobile' | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const activeFilterCount = (department ? 1 : 0) + (week ? 1 : 0) + (category ? 1 : 0);
  const hasFilters = activeFilterCount > 0;

  // Close dropdowns when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpenDropdown(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className="relative z-30 mb-6 select-none animate-fade-in">
      {/* Shadcn Enterprise Toolbar (Compact, exactly 1 row on Desktop, clean wrap on Mobile) */}
      <div className="flex items-center justify-between gap-2 p-2 sm:p-2.5 rounded-xl bg-card/90 border border-border/80 shadow-md backdrop-blur-md">
        
        {/* Left Indicator */}
        <div className="flex items-center gap-2 px-2 shrink-0">
          <div className="p-1.5 rounded-lg bg-primary/15 text-primary border border-primary/20">
            <SlidersHorizontal className="w-3.5 h-3.5" />
          </div>
          <span className="text-xs font-bold text-foreground uppercase tracking-wider hidden md:inline">
            Filters
          </span>
          {hasFilters && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/20 text-primary border border-primary/30 text-[11px] font-mono font-black animate-pulse-slow">
              {activeFilterCount} Active
            </span>
          )}
        </div>

        {/* Desktop & Tablet Dropdown Triggers (Hidden on smallest mobile screens in favor of More dots menu) */}
        <div className="hidden sm:flex items-center gap-2 flex-1 justify-end">
          
          {/* Department Dropdown Button */}
          <div className="relative">
            <button
              onClick={() => setOpenDropdown(openDropdown === 'dept' ? null : 'dept')}
              className={`inline-flex items-center justify-between gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all border shadow-xs min-w-[150px] ${
                department
                  ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40 font-extrabold shadow-sm'
                  : 'bg-muted/40 text-foreground hover:bg-muted/70 border-border/70 hover:border-primary/40'
              }`}
            >
              <div className="flex items-center gap-2 truncate">
                <Building2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span className="truncate">{department || 'All Departments'}</span>
              </div>
              <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground transition-transform duration-200 shrink-0 ${openDropdown === 'dept' ? 'rotate-180' : ''}`} />
            </button>

            {/* Department Shadcn Popover Menu */}
            {openDropdown === 'dept' && (
              <div className="absolute left-0 mt-2 w-64 rounded-xl bg-card border border-border/90 shadow-2xl py-1.5 z-50 animate-scale-in">
                <div className="px-3 py-2 border-b border-border/50 text-[11px] font-bold text-muted-foreground uppercase tracking-wider flex items-center justify-between">
                  <span>Select Cohort</span>
                  <span>{DEPARTMENTS.length} Depts</span>
                </div>
                
                <div className="max-h-64 overflow-y-auto p-1 space-y-0.5">
                  <button
                    onClick={() => { setDepartment(null); setOpenDropdown(null); }}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                      department === null ? 'bg-primary/20 text-primary font-bold' : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                    }`}
                  >
                    <span>All Departments</span>
                    {department === null && <CheckCircle2 className="w-4 h-4 text-primary" />}
                  </button>
                  {DEPARTMENTS.map((d) => {
                    const isSelected = department === d.id;
                    return (
                      <button
                        key={d.id}
                        onClick={() => { setDepartment(isSelected ? null : d.id); setOpenDropdown(null); }}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs transition-colors ${
                          isSelected
                            ? 'bg-emerald-500/20 text-emerald-300 font-extrabold border border-emerald-500/30'
                            : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground font-medium'
                        }`}
                      >
                        <div className="flex items-center gap-2 text-left truncate">
                          <span className="truncate">{d.id}</span>
                        </div>
                        <span className="text-[10px] font-mono opacity-70 ml-2">
                          {isSelected ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : `${d.count} emps`}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Week Timeline Dropdown Button */}
          <div className="relative">
            <button
              onClick={() => setOpenDropdown(openDropdown === 'week' ? null : 'week')}
              className={`inline-flex items-center justify-between gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all border shadow-xs min-w-[135px] ${
                week !== null
                  ? 'bg-primary/20 text-primary border-primary/40 font-extrabold shadow-sm'
                  : 'bg-muted/40 text-foreground hover:bg-muted/70 border-border/70 hover:border-primary/40'
              }`}
            >
              <div className="flex items-center gap-2 truncate">
                <Calendar className="w-3.5 h-3.5 text-primary shrink-0" />
                <span>{week ? `Week ${week}` : 'All Weeks (1–4)'}</span>
              </div>
              <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground transition-transform duration-200 shrink-0 ${openDropdown === 'week' ? 'rotate-180' : ''}`} />
            </button>

            {/* Week Shadcn Popover Menu */}
            {openDropdown === 'week' && (
              <div className="absolute right-0 mt-2 w-56 rounded-xl bg-card border border-border/90 shadow-2xl py-1.5 z-50 animate-scale-in">
                <div className="px-3 py-2 border-b border-border/50 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                  Filter Audit Period
                </div>
                
                <div className="p-1 space-y-0.5">
                  <button
                    onClick={() => { setWeek(null); setOpenDropdown(null); }}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                      week === null ? 'bg-primary/20 text-primary font-bold' : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                    }`}
                  >
                    <span>All Weeks (Complete Q3)</span>
                    {week === null && <CheckCircle2 className="w-4 h-4 text-primary" />}
                  </button>
                  {WEEKS.map((w) => {
                    const isSelected = week === w.id;
                    return (
                      <button
                        key={w.id}
                        onClick={() => { setWeek(isSelected ? null : w.id); setOpenDropdown(null); }}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs transition-colors ${
                          isSelected
                            ? 'bg-primary/25 text-primary font-black border border-primary/40'
                            : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground font-medium'
                        }`}
                      >
                        <span>{w.label}</span>
                        {isSelected && <Check className="w-3.5 h-3.5 text-primary" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Task Category Tag (if clicked from chart) */}
          {category && (
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/15 text-amber-300 border border-amber-500/35 text-xs font-mono font-bold animate-scale-in shadow-sm">
              <Tag className="w-3.5 h-3.5 text-amber-400" />
              <span className="max-w-[120px] truncate">{category}</span>
              <button
                onClick={() => setCategory(null)}
                className="ml-1 p-0.5 rounded-md hover:bg-amber-500/30 text-amber-300"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Mobile Filter Button with Icon and Three Dots (Tailored for Phone devices) */}
        <div className="sm:hidden flex items-center gap-2 flex-1 justify-end">
          <button
            onClick={() => setOpenDropdown(openDropdown === 'mobile' ? null : 'mobile')}
            className={`flex items-center justify-between gap-2 px-3.5 py-2 rounded-xl text-xs font-bold border w-full sm:w-auto transition-all ${
              hasFilters
                ? 'bg-gradient-to-r from-primary/25 via-emerald-500/20 to-primary/20 text-foreground border-primary/50 shadow-md'
                : 'bg-muted/50 text-muted-foreground border-border/70 hover:text-foreground'
            }`}
          >
            <div className="flex items-center gap-2">
              <Filter className="w-3.5 h-3.5 text-primary" />
              <span>{hasFilters ? `Filtered (${activeFilterCount})` : 'Filter Data'}</span>
            </div>
            <MoreHorizontal className="w-4 h-4 opacity-70" />
          </button>
        </div>

        {/* Reset Action Bar */}
        {hasFilters && (
          <button
            onClick={clearAll}
            className="p-2 sm:px-3 sm:py-2 rounded-xl bg-destructive/15 text-destructive-foreground hover:bg-destructive/25 border border-destructive/30 font-semibold text-xs transition-all shadow-sm flex items-center gap-1.5 shrink-0"
            title="Reset All Filters"
          >
            <RotateCcw className="w-3.5 h-3.5 animate-spin-once shrink-0" />
            <span className="hidden lg:inline">Reset</span>
          </button>
        )}
      </div>

      {/* Mobile All-In-One Filter Popover Menu (Opened by Three Dots) */}
      {openDropdown === 'mobile' && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-card border border-border/90 rounded-2xl shadow-2xl p-4 z-50 space-y-4 sm:hidden animate-scale-in">
          <div className="flex items-center justify-between border-b border-border/50 pb-2.5">
            <span className="text-xs font-extrabold text-foreground uppercase tracking-wider flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4 text-primary" /> Select Filter Options
            </span>
            <button onClick={() => setOpenDropdown(null)} className="p-1 text-muted-foreground hover:text-foreground">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Dept selector inside mobile menu */}
          <div>
            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-emerald-400" /> Department Cohort
            </p>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                onClick={() => { setDepartment(null); setOpenDropdown(null); }}
                className={`p-2 rounded-xl text-xs font-semibold text-left border ${
                  department === null ? 'bg-primary/20 text-primary font-extrabold border-primary/40' : 'bg-muted/30 text-muted-foreground border-border/50'
                }`}
              >
                All Depts
              </button>
              {DEPARTMENTS.map(d => (
                <button
                  key={d.id}
                  onClick={() => { setDepartment(department === d.id ? null : d.id); setOpenDropdown(null); }}
                  className={`p-2 rounded-xl text-xs font-semibold text-left border truncate ${
                    department === d.id ? 'bg-emerald-500/20 text-emerald-300 font-extrabold border-emerald-500/40' : 'bg-muted/30 text-muted-foreground border-border/50'
                  }`}
                >
                  {d.id}
                </button>
              ))}
            </div>
          </div>

          {/* Week selector inside mobile menu */}
          <div>
            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-primary" /> Audit Timeline
            </p>
            <div className="grid grid-cols-3 gap-1.5">
              <button
                onClick={() => { setWeek(null); setOpenDropdown(null); }}
                className={`p-2 rounded-xl text-xs font-semibold text-center border ${
                  week === null ? 'bg-primary/20 text-primary font-extrabold border-primary/40' : 'bg-muted/30 text-muted-foreground border-border/50'
                }`}
              >
                All Weeks
              </button>
              {WEEKS.map(w => (
                <button
                  key={w.id}
                  onClick={() => { setWeek(week === w.id ? null : w.id); setOpenDropdown(null); }}
                  className={`p-2 rounded-xl text-xs font-mono font-semibold text-center border ${
                    week === w.id ? 'bg-primary/25 text-primary font-black border-primary/40' : 'bg-muted/30 text-muted-foreground border-border/50'
                  }`}
                >
                  W{w.id}
                </button>
              ))}
            </div>
          </div>

          {hasFilters && (
            <button
              onClick={() => { clearAll(); setOpenDropdown(null); }}
              className="w-full py-2.5 rounded-xl bg-destructive/20 text-destructive-foreground font-bold text-xs flex items-center justify-center gap-2 border border-destructive/30"
            >
              <RotateCcw className="w-4 h-4" /> Reset All Active Filters
            </button>
          )}
        </div>
      )}
    </div>
  );
}
