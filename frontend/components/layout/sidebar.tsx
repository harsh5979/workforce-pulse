'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { BarChart3, Users, TrendingUp, AlertTriangle, Bot, Home, ChevronRight, Sparkles, Cpu, Database, LogOut } from 'lucide-react';

const navItems = [
  { href: '/dashboard',            label: 'Overview',      icon: Home },
  { href: '/dashboard/categories', label: 'Categories',    icon: BarChart3 },
  { href: '/dashboard/employees',  label: 'Employees',     icon: Users },
  { href: '/dashboard/trends',     label: 'Trends',        icon: TrendingUp },
  { href: '/dashboard/anomalies',  label: 'Anomalies',     icon: AlertTriangle },
  { href: '/dashboard/data',       label: 'Data & CSV Import',  icon: Database },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  const isActive = (href: string) =>
    href === '/dashboard'
      ? pathname === '/dashboard' || pathname === '/'
      : pathname === href || pathname.startsWith(href + '/');

  const isAIActive = pathname === '/dashboard/ai';

  return (
    <aside className="hidden lg:flex flex-col w-64 border-r border-border/60 bg-card/80 backdrop-blur-md shrink-0 shadow-lg select-none">
      {/* Brand Header */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-border/60 bg-gradient-to-b from-card to-card/50">
        <div className="w-10 h-10 rounded-xl bg-slate-900 border border-primary/20 flex items-center justify-center shadow-md shrink-0 overflow-hidden">
          <img src="/workforce.svg" alt="Workforce Pulse Logo" className="w-full h-full object-cover" />
        </div>
        <div>
          <div className="flex items-center gap-1.5">
            <p className="font-extrabold text-sm text-foreground tracking-tight">Workforce Pulse</p>
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping-once" title="Live System Active" />
          </div>
          <p className="text-[10px] uppercase tracking-widest font-mono font-semibold text-primary/90 mt-0.5 flex items-center gap-1">
            <Sparkles className="w-2.5 h-2.5" /> AI Intelligence
          </p>
        </div>
      </div>

      {/* Analytics Navigation */}
      <nav className="px-3 py-4 space-y-1.5 overflow-y-auto">
        <p className="px-3 pb-1 text-[10px] font-bold font-mono uppercase tracking-wider text-muted-foreground/80">
          Analytics Hub
        </p>

        {navItems.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href as any}
              className={`flex items-center justify-between px-3.5 py-3 rounded-xl font-medium text-sm transition-all group duration-200 relative overflow-hidden ${
                active
                  ? 'bg-gradient-to-r from-primary/25 via-primary/10 to-transparent text-foreground font-bold shadow-md border-l-4 border-primary pl-4'
                  : 'text-muted-foreground hover:bg-muted/40 hover:text-foreground border-l-4 border-transparent'
              }`}
            >
              {active && <div className="absolute inset-0 bg-primary/5 pointer-events-none" />}
              <div className="flex items-center gap-3 relative z-10">
                <div className={`p-1.5 rounded-lg transition-colors ${
                  active
                    ? 'bg-primary/20 text-primary shadow-sm'
                    : 'bg-muted/30 text-muted-foreground group-hover:text-primary group-hover:bg-primary/10'
                }`}>
                  <item.icon className="w-4 h-4 shrink-0" />
                </div>
                <span className={active ? 'text-primary font-bold tracking-wide' : ''}>{item.label}</span>
              </div>
              {active && <ChevronRight className="w-4 h-4 text-primary shrink-0 relative z-10 animate-fade-in" />}
            </Link>
          );
        })}
      </nav>

      {/* AI Copilot Standalone Section */}
      <div className="px-3 pb-3">
        <div className="border-t border-border/40 pt-3 mb-2">
          <p className="px-3 pb-1 text-[10px] font-bold font-mono uppercase tracking-wider text-muted-foreground/80">
            AI Layer
          </p>
        </div>

        <Link
          href={'/dashboard/ai' as any}
          className={`flex items-center justify-between px-3.5 py-3.5 rounded-xl font-medium text-sm transition-all group duration-200 relative overflow-hidden ${
            isAIActive
              ? 'bg-gradient-to-r from-emerald-500/25 via-emerald-500/10 to-transparent text-foreground font-bold shadow-md border-l-4 border-emerald-500 pl-4'
              : 'text-muted-foreground hover:bg-muted/40 hover:text-foreground border-l-4 border-transparent'
          }`}
        >
          {isAIActive && <div className="absolute inset-0 bg-emerald-500/5 pointer-events-none" />}
          <div className="flex items-center gap-3 relative z-10">
            <div className={`p-1.5 rounded-lg transition-colors ${
              isAIActive
                ? 'bg-emerald-500/20 text-emerald-400 shadow-sm'
                : 'bg-muted/30 text-muted-foreground group-hover:text-emerald-400 group-hover:bg-emerald-500/10'
            }`}>
              <Cpu className="w-4 h-4 shrink-0" />
            </div>
            <div>
              <span className={`block leading-tight ${isAIActive ? 'text-emerald-400 font-bold' : ''}`}>
                AI Copilot
              </span>
              <span className="text-[10px] font-mono text-muted-foreground/70 leading-tight">Grounded · Multi-turn</span>
            </div>
          </div>
          {isAIActive
            ? <ChevronRight className="w-4 h-4 text-emerald-400 shrink-0 relative z-10 animate-fade-in" />
            : <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-mono font-bold border border-emerald-500/30 shrink-0">AI</span>
          }
        </Link>
      </div>

      {/* Logout Action */}
      <div className="px-3 pb-3 mt-auto">
        <button
          onClick={async () => {
            await fetch('/api/auth/logout', { method: 'POST' });
            router.push('/login');
            router.refresh();
          }}
          className="flex items-center gap-3 w-full px-3.5 py-2.5 rounded-xl text-xs font-medium text-muted-foreground hover:bg-red-500/10 hover:text-red-400 transition-colors border border-transparent hover:border-red-500/20"
        >
          <LogOut className="w-4 h-4 shrink-0" />
          <span>Sign out</span>
        </button>
      </div>

    </aside>
  );
}
