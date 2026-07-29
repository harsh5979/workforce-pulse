'use client';

import { useState } from 'react';
import { ExportButton } from '@/components/export/export-button';
import {
  Menu, X, Bot, Home, BarChart3, Users, TrendingUp,
  AlertTriangle, ChevronRight, ChevronDown, Sparkles, Cpu, Database,
  SlidersHorizontal, Building2, Calendar, RotateCcw,
  Check, Tag, LogOut,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useFilterStore } from '@/store/filter-store';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';

// ─── Static data ────────────────────────────────────────────────────────────
const DEPARTMENTS = [
  { id: 'Sales',      label: 'Sales & Business Dev' },
  { id: 'Finance',    label: 'Finance & Tax' },
  { id: 'Operations', label: 'Operations' },
  { id: 'CS',         label: 'Customer Success' },
  { id: 'HR',         label: 'HR & Talent' },
  { id: 'Marketing',  label: 'Marketing' },
];

const WEEKS = [
  { id: 1, label: 'Week 1 · Aug 01–07' },
  { id: 2, label: 'Week 2 · Aug 08–14' },
  { id: 3, label: 'Week 3 · Aug 15–21' },
  { id: 4, label: 'Week 4 · Aug 22–28' },
];

// ─── Page metadata ───────────────────────────────────────────────────────────
const PAGE_META: Record<string, { title: string; badge: string; badgeColor: string; sub: string }> = {
  '/dashboard/categories': {
    title: 'Category Analytics',
    badge: '● Task Taxonomy',
    badgeColor: 'bg-amber-500/15 text-amber-400 border-amber-500/25',
    sub: 'Breakdown of activity by work category across all departments',
  },
  '/dashboard/employees': {
    title: 'Employee Intelligence',
    badge: '● Per-Employee View',
    badgeColor: 'bg-blue-500/15 text-blue-400 border-blue-500/25',
    sub: 'Individual contributor workload, repetitive share & automation fit',
  },
  '/dashboard/trends': {
    title: 'Trend Analysis',
    badge: '● Weekly Trends',
    badgeColor: 'bg-violet-500/15 text-violet-400 border-violet-500/25',
    sub: '4-week rolling time-series of repetitive vs. productive work patterns',
  },
  '/dashboard/anomalies': {
    title: 'Anomaly Detection',
    badge: '● AI Flagged',
    badgeColor: 'bg-rose-500/15 text-rose-400 border-rose-500/25',
    sub: 'Statistically significant deviations from expected work distributions',
  },
};

const navItems = [
  { href: '/dashboard',            label: 'Overview',         icon: Home },
  { href: '/dashboard/categories', label: 'Categories',       icon: BarChart3 },
  { href: '/dashboard/employees',  label: 'Employees',        icon: Users },
  { href: '/dashboard/trends',     label: 'Trends',           icon: TrendingUp },
  { href: '/dashboard/anomalies',  label: 'Anomalies',        icon: AlertTriangle },
  { href: '/dashboard/data',       label: 'Data & CSV Import', icon: Database },
];

// ─── Filter popover ──────────────────────────────────────────────────────────────────────
function FilterPopover() {
  const { department, week, category, setDepartment, setWeek, setCategory, clearAll } = useFilterStore();
  const [open, setOpen] = useState(false);
  // Both sections open by default; user can collapse individually
  const [openSections, setOpenSections] = useState<string[]>(['dept', 'week']);

  const activeCount = (department ? 1 : 0) + (week ? 1 : 0) + (category ? 1 : 0);
  const hasFilters = activeCount > 0;

  const toggleSection = (id: string) =>
    setOpenSections((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      {/* Trigger */}
      <PopoverTrigger asChild>
        <button
          className={[
            'relative inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all',
            hasFilters
              ? 'bg-primary/20 text-primary border-primary/40 shadow-sm'
              : 'bg-muted/50 text-muted-foreground border-border/60 hover:bg-muted hover:text-foreground',
          ].join(' ')}
          aria-label="Open filters"
        >
          <SlidersHorizontal className="w-3.5 h-3.5 shrink-0" />
          <span className="hidden sm:inline">Filters</span>
          {hasFilters && (
            <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-primary text-primary-foreground text-[10px] font-black ml-0.5">
              {activeCount}
            </span>
          )}
        </button>
      </PopoverTrigger>

      {/* Panel */}
      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-72 p-0 bg-card border border-border/80 shadow-2xl rounded-2xl overflow-hidden flex flex-col"
        style={{ maxHeight: 'min(480px, calc(100vh - 80px))' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/60 bg-muted/40">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-3.5 h-3.5 text-primary" />
            <span className="text-xs font-bold text-foreground uppercase tracking-wider">Filter Data</span>
          </div>
          {hasFilters && (
            <button
              onClick={() => clearAll()}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-destructive hover:text-destructive/80 transition-colors"
            >
              <RotateCcw className="w-3 h-3" />
              Reset all
            </button>
          )}
        </div>

        {/* Accordion body — scrollable */}
        <div className="divide-y divide-border/50 overflow-y-auto flex-1 overscroll-contain">

          {/* ── DEPARTMENT accordion ── */}
          <div>
            <button
              onClick={() => toggleSection('dept')}
              className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-muted/40 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Building2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span className="text-[11px] font-bold text-foreground uppercase tracking-wider">Department</span>
                {department && (
                  <span className="px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-mono font-bold border border-emerald-500/30 truncate max-w-[80px]">
                    {department}
                  </span>
                )}
              </div>
              <ChevronDown
                className={`w-3.5 h-3.5 text-muted-foreground transition-transform duration-200 shrink-0 ${
                  openSections.includes('dept') ? 'rotate-180' : ''
                }`}
              />
            </button>

            {openSections.includes('dept') && (
              <div className="px-2 pb-2 space-y-0.5">
                <button
                  onClick={() => setDepartment(null)}
                  className={[
                    'w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-colors',
                    department === null
                      ? 'bg-primary/20 text-primary font-bold'
                      : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
                  ].join(' ')}
                >
                  <span>All Departments</span>
                  {department === null && <Check className="w-3.5 h-3.5 shrink-0" />}
                </button>
                {DEPARTMENTS.map((d) => {
                  const active = department === d.id;
                  return (
                    <button
                      key={d.id}
                      onClick={() => setDepartment(active ? null : d.id)}
                      className={[
                        'w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs transition-colors',
                        active
                          ? 'bg-emerald-500/20 text-emerald-300 font-extrabold border border-emerald-500/30'
                          : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground font-medium',
                      ].join(' ')}
                    >
                      <span>{d.label}</span>
                      {active && <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── AUDIT WEEK accordion ── */}
          <div>
            <button
              onClick={() => toggleSection('week')}
              className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-muted/40 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Calendar className="w-3.5 h-3.5 text-primary shrink-0" />
                <span className="text-[11px] font-bold text-foreground uppercase tracking-wider">Audit Week</span>
                {week && (
                  <span className="px-1.5 py-0.5 rounded-full bg-primary/20 text-primary text-[10px] font-mono font-bold border border-primary/30">
                    W{week}
                  </span>
                )}
              </div>
              <ChevronDown
                className={`w-3.5 h-3.5 text-muted-foreground transition-transform duration-200 shrink-0 ${
                  openSections.includes('week') ? 'rotate-180' : ''
                }`}
              />
            </button>

            {openSections.includes('week') && (
              <div className="px-2 pb-2 space-y-0.5">
                <button
                  onClick={() => setWeek(null)}
                  className={[
                    'w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-colors',
                    week === null
                      ? 'bg-primary/20 text-primary font-bold'
                      : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
                  ].join(' ')}
                >
                  <span>All Weeks (Q3 Complete)</span>
                  {week === null && <Check className="w-3.5 h-3.5 shrink-0" />}
                </button>
                {WEEKS.map((w) => {
                  const active = week === w.id;
                  return (
                    <button
                      key={w.id}
                      onClick={() => setWeek(active ? null : w.id)}
                      className={[
                        'w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs transition-colors',
                        active
                          ? 'bg-primary/25 text-primary font-black border border-primary/40'
                          : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground font-medium',
                      ].join(' ')}
                    >
                      <span className="font-mono">{w.label}</span>
                      {active && <Check className="w-3.5 h-3.5 text-primary shrink-0" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── CATEGORY TAG (from chart click) ── */}
          {category && (
            <div className="px-4 py-3">
              <p className="flex items-center gap-1.5 text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-2">
                <Tag className="w-3 h-3 text-amber-400" />
                Category Filter
              </p>
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/15 border border-amber-500/30">
                <span className="text-xs font-mono font-bold text-amber-300 flex-1 truncate">{category}</span>
                <button
                  onClick={() => setCategory(null)}
                  className="p-0.5 rounded hover:bg-amber-500/30 text-amber-300 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {hasFilters && (
          <div className="px-4 py-2.5 bg-muted/30 border-t border-border/60 text-[11px] text-muted-foreground font-mono flex items-center justify-between">
            <span>{activeCount} filter{activeCount > 1 ? 's' : ''} active</span>
            <button
              onClick={() => { clearAll(); setOpen(false); }}
              className="text-destructive hover:text-destructive/80 font-semibold transition-colors"
            >
              Clear &amp; close
            </button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

// ─── Main Topbar ──────────────────────────────────────────────────────────────
export function Topbar() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  // Pages where filter should NOT appear
  const noUtilPages = ['/dashboard/ai', '/dashboard/data'];
  const showFilter = !noUtilPages.includes(pathname);

  return (
    <>
      <header className="flex items-center justify-between min-h-[3.5rem] py-2 px-4 sm:px-6 border-b border-border/60 bg-card/70 backdrop-blur-md shrink-0 shadow-sm sticky top-0 z-40 select-none gap-3">

        {/* Left — hamburger + page title */}
        <div className="flex items-center gap-3 min-w-0">
          {/* Mobile hamburger */}
          <button
            onClick={() => setIsMobileMenuOpen(true)}
            className="lg:hidden p-2 rounded-xl bg-muted/60 text-foreground hover:bg-muted hover:text-primary border border-border/60 shadow-sm transition-all active:scale-95 shrink-0"
            title="Open Navigation Drawer"
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Page title block */}
          {pathname === '/dashboard/ai' ? (
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center shrink-0">
                <Cpu className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-sm font-extrabold text-foreground tracking-tight">AI Workforce Copilot</h1>
                  <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 text-[10px] font-mono font-bold border border-emerald-500/25">
                    ● Grounded
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground truncate">Live PostgreSQL telemetry · Multi-turn context</p>
              </div>
            </div>
          ) : pathname === '/dashboard/data' ? (
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-primary/20 border border-primary/30 flex items-center justify-center shrink-0">
                <Database className="w-4 h-4 text-primary" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-sm font-extrabold text-foreground tracking-tight">Data &amp; CSV Management Studio</h1>
                  <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/15 text-primary text-[10px] font-mono font-bold border border-primary/25">
                    ● Schema &amp; ETL Ready
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground truncate">CSV uploads · Schema normalization · Real-time sync</p>
              </div>
            </div>
          ) : PAGE_META[pathname] ? (
            <div className="min-w-0 hidden sm:block">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-sm font-extrabold text-foreground tracking-tight">{PAGE_META[pathname].title}</h1>
                <span className={`hidden md:inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border ${PAGE_META[pathname].badgeColor}`}>
                  {PAGE_META[pathname].badge}
                </span>
              </div>
            </div>
          ) : (
            <div className="min-w-0 hidden sm:block">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-sm font-extrabold text-foreground tracking-tight">Workforce Pulse Dashboard</h1>
                <span className="hidden md:inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/15 text-primary text-[10px] font-mono font-bold border border-primary/25">
                  ● Live Telemetry
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Right — filter icon + export button */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Filter popover — hidden on AI and Data pages */}
          {showFilter && <FilterPopover />}
          {/* Export — overview only */}
          {(pathname === '/dashboard' || pathname === '/') && <ExportButton />}
        </div>
      </header>

      {/* ── Mobile / Tablet slide-over nav drawer ── */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-black/75 backdrop-blur-sm animate-fade-in"
            onClick={() => setIsMobileMenuOpen(false)}
          />
          <aside className="relative w-72 max-w-[80vw] bg-card border-r border-border/80 shadow-2xl h-full flex flex-col z-10 animate-slide-in-right overflow-hidden select-none">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-5 border-b border-border/60 bg-gradient-to-b from-card to-card/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-slate-900 border border-primary/20 flex items-center justify-center shadow-md overflow-hidden">
                  <img src="/workforce.svg" alt="Workforce Pulse Logo" className="w-full h-full object-cover" />
                </div>
                <div>
                  <p className="font-extrabold text-sm text-foreground tracking-tight">Workforce Pulse</p>
                  <p className="text-[10px] uppercase tracking-widest font-mono font-semibold text-primary/90 mt-0.5 flex items-center gap-1">
                    <Sparkles className="w-2.5 h-2.5" /> AI Intelligence
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsMobileMenuOpen(false)}
                className="p-2 rounded-xl bg-muted text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Nav links */}
            <nav className="px-3 py-4 space-y-2 overflow-y-auto">
              <p className="px-3 pb-1 text-[10px] font-bold font-mono uppercase tracking-wider text-muted-foreground/80">
                Navigation Hub
              </p>
              {navItems.map((item) => {
                const isActive =
                  item.href === '/dashboard'
                    ? pathname === '/dashboard' || pathname === '/'
                    : pathname === item.href || pathname.startsWith(item.href + '/');
                return (
                  <Link
                    key={item.href}
                    href={item.href as any}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={`flex items-center justify-between px-4 py-3.5 rounded-xl font-semibold text-sm transition-all duration-200 relative ${
                      isActive
                        ? 'bg-gradient-to-r from-primary/25 via-primary/10 to-transparent text-foreground font-extrabold shadow-md border-l-4 border-primary pl-4'
                        : 'text-muted-foreground hover:bg-muted/40 hover:text-foreground border-l-4 border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-3.5">
                      <div className={`p-2 rounded-xl transition-colors ${isActive ? 'bg-primary/20 text-primary shadow-sm' : 'bg-muted/30 text-muted-foreground'}`}>
                        <item.icon className="w-4 h-4 shrink-0" />
                      </div>
                      <span className={isActive ? 'text-primary font-bold tracking-wide' : ''}>{item.label}</span>
                    </div>
                    {isActive && <ChevronRight className="w-4 h-4 text-primary shrink-0" />}
                  </Link>
                );
              })}
            </nav>

            {/* AI Copilot in drawer */}
            <div className="px-3 pb-2">
              <div className="border-t border-border/40 pt-3 mb-1.5">
                <p className="px-3 text-[10px] font-bold font-mono uppercase tracking-wider text-muted-foreground/80 mb-1">AI Layer</p>
              </div>
              <Link
                href={'/dashboard/ai' as any}
                onClick={() => setIsMobileMenuOpen(false)}
                className={`flex items-center justify-between px-4 py-3.5 rounded-xl font-semibold text-sm transition-all duration-200 relative ${
                  pathname === '/dashboard/ai'
                    ? 'bg-gradient-to-r from-emerald-500/25 via-emerald-500/10 to-transparent text-foreground font-extrabold shadow-md border-l-4 border-emerald-500 pl-4'
                    : 'text-muted-foreground hover:bg-muted/40 hover:text-foreground border-l-4 border-transparent'
                }`}
              >
                <div className="flex items-center gap-3.5">
                  <div className={`p-2 rounded-xl transition-colors ${pathname === '/dashboard/ai' ? 'bg-emerald-500/20 text-emerald-400 shadow-sm' : 'bg-muted/30 text-muted-foreground'}`}>
                    <Cpu className="w-4 h-4 shrink-0" />
                  </div>
                  <div>
                    <span className={pathname === '/dashboard/ai' ? 'text-emerald-400 font-bold tracking-wide block' : 'block'}>AI Copilot</span>
                    <span className="text-[10px] font-mono text-muted-foreground/70">Grounded · Multi-turn</span>
                  </div>
                </div>
                {pathname === '/dashboard/ai'
                  ? <ChevronRight className="w-4 h-4 text-emerald-400 shrink-0" />
                  : <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-mono font-bold border border-emerald-500/30">AI</span>
                }
              </Link>
            </div>

            {/* Sign out button */}
            <div className="px-3 pb-3 mt-auto">
              <button
                onClick={async () => {
                  await fetch('/api/auth/logout', { method: 'POST' });
                  setIsMobileMenuOpen(false);
                  router.push('/login');
                  router.refresh();
                }}
                className="flex items-center gap-3 w-full px-4 py-3 rounded-xl font-semibold text-sm transition-all duration-200 text-muted-foreground hover:bg-red-500/10 hover:text-red-400 border border-transparent hover:border-red-500/20"
              >
                <div className="flex items-center gap-3.5">
                  <div className="p-2 rounded-xl transition-colors bg-muted/30 text-muted-foreground">
                    <LogOut className="w-4 h-4 shrink-0" />
                  </div>
                  <span>Sign out</span>
                </div>
              </button>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-border/60 bg-slate-950/50 m-3 rounded-2xl border">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-mono text-muted-foreground">Mobile Shell</span>
                <span className="text-emerald-400 font-mono font-semibold">● Responsive</span>
              </div>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
