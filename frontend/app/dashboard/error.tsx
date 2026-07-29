'use client';

import { useEffect } from 'react';
import { AlertTriangle, RefreshCw, Server, ShieldAlert } from 'lucide-react';

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log error to console for diagnostic tracing
    console.error('Workforce Pulse Dashboard Error:', error);
  }, [error]);

  return (
    <div className="min-h-[70vh] flex items-center justify-center p-4">
      <div className="glass-card max-w-lg w-full p-8 border-danger/30 relative overflow-hidden animate-fade-in text-center">
        {/* Glowing backdrop accent */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-danger/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-primary/20 rounded-full blur-3xl pointer-events-none" />

        <div className="w-16 h-16 rounded-2xl bg-danger/10 border border-danger/25 flex items-center justify-center mx-auto mb-6 shadow-lg shadow-danger/10">
          <AlertTriangle className="w-8 h-8 text-red-400 animate-pulse" />
        </div>

        <h2 className="text-2xl font-bold text-foreground mb-2">
          Dashboard Connection Interrupted
        </h2>
        
        <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
          We experienced an interruption while fetching analytical metrics from the backend API server. This typically happens if the backend API (<code className="font-mono text-xs bg-muted/60 px-1.5 py-0.5 rounded text-primary">Port 5000</code>) is offline, restarting, or cannot communicate with the PostgreSQL database.
        </p>

        <div className="bg-muted/30 border border-border/50 rounded-xl p-4 text-left mb-6 space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
            <Server className="w-4 h-4 text-primary shrink-0" />
            <span>Quick Diagnostics & Resolution</span>
          </div>
          <ul className="text-xs text-muted-foreground list-disc list-inside space-y-1 pl-1">
            <li>Ensure your servers are active using <code className="font-mono text-primary bg-background/50 px-1 rounded">.\start-app.ps1</code> or Docker.</li>
            <li>Check that PostgreSQL is accessible on Port 5432 and seeded.</li>
            <li>If running locally, verify terminal logs in your backend API console.</li>
          </ul>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={() => reset()}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-all shadow-lg shadow-primary/25 active:scale-95"
          >
            <RefreshCw className="w-4 h-4 animate-spin-once" />
            Retry Connection & Reload
          </button>
          <button
            onClick={() => window.location.href = '/'}
            className="inline-flex items-center justify-center px-5 py-3 rounded-xl bg-muted text-muted-foreground font-medium text-sm hover:bg-muted/80 hover:text-foreground transition-all"
          >
            Return Home
          </button>
        </div>

        {error?.message && (
          <div className="mt-6 pt-4 border-t border-border/40 flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground/70 font-mono truncate">
            <ShieldAlert className="w-3.5 h-3.5 text-red-400/70 shrink-0" />
            <span className="truncate">Trace: {error.message}</span>
          </div>
        )}
      </div>
    </div>
  );
}
