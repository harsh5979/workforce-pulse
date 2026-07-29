'use client';

import { Download, FileText, FileSpreadsheet } from 'lucide-react';
import { useState } from 'react';

export function ExportButton() {
  const handleOpenExecutiveSummary = () => {
    window.dispatchEvent(new CustomEvent('open-executive-summary'));
  };

  return (
    <div className="relative inline-block text-left">
      <button
        onClick={handleOpenExecutiveSummary}
        className="inline-flex items-center justify-center gap-2 w-8 h-8 sm:w-auto sm:h-auto sm:px-3 sm:py-1.5 rounded-lg text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-all border border-primary/20 shadow-sm"
        aria-label="Export Report"
      >
        <Download className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
        <span className="hidden sm:inline">Export Report</span>
      </button>
    </div>
  );
}
