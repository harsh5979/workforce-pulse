'use client';

import { useState, useEffect } from 'react';

import { HeadlineCards } from '@/components/dashboard/headline-cards';
import { AutomationChart } from '@/components/dashboard/automation-chart';
import { TopAutomationRankingList } from '@/components/dashboard/top-automation-ranking-list';
import { IngestionAuditCard } from '@/components/dashboard/ingestion-audit-card';
import { ExecutiveSummaryModal } from '@/components/dashboard/executive-summary-modal';
import { FileText, Sparkles, Download, ArrowRight, ShieldCheck } from 'lucide-react';

export default function DashboardPage() {
  const [isSummaryOpen, setIsSummaryOpen] = useState(false);

  // Listen for the custom event fired by the Topbar Export button
  useEffect(() => {
    const handleOpen = () => setIsSummaryOpen(true);
    window.addEventListener('open-executive-summary', handleOpen);
    return () => window.removeEventListener('open-executive-summary', handleOpen);
  }, []);

  return (
    <div className="space-y-6 animate-fade-in">


      {/* Executive Summary Download CTA Bar */}
      <div className="glass-card p-4 border border-primary/30 bg-card flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-md group">
        <div className="flex items-start sm:items-center gap-3.5">
          <div className="p-2.5 rounded-none bg-primary/20 text-primary border border-primary/30 shadow-sm shrink-0 mt-1 sm:mt-0">
            <FileText className="w-5 h-5 animate-pulse-slow" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="text-sm sm:text-base font-extrabold text-foreground group-hover:text-primary transition-colors tracking-tight">
                Live Executive Summary Report Studio
              </span>
              
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1.5 font-sans leading-relaxed">
              Generate a high-resolution 1-page PDF or PNG summary of headline KPIs and top-5 automation opportunities based on your active filters.
            </p>
          </div>
        </div>

        <button
          onClick={() => setIsSummaryOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-none bg-primary text-primary-foreground font-semibold hover:opacity-95 transition-all text-xs shadow-lg shadow-primary/25 self-start sm:self-center shrink-0"
        >
          <Sparkles className="w-4 h-4" />
          Open Executive Summary
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Hero Metrics (Hours & INR Recoverable) */}
      <HeadlineCards />

      {/* Primary Analytical Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7">
          <AutomationChart />
        </div>
        <div className="lg:col-span-5">
          <TopAutomationRankingList />
        </div>
      </div>

      {/* Data Ingestion Transparency Section */}
      <div className="pt-2">
        <IngestionAuditCard />
      </div>

      {/* Executive Summary Download Modal */}
      <ExecutiveSummaryModal
        isOpen={isSummaryOpen}
        onClose={() => setIsSummaryOpen(false)}
      />
    </div>
  );
}
