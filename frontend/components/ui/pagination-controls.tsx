'use client';

import React from 'react';
import { ChevronLeft, ChevronRight, MoreHorizontal } from 'lucide-react';

interface PaginationControlsProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  pageSizeOptions?: number[];
  itemLabel?: string;
}

export function PaginationControls({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [5, 10, 20, 50],
  itemLabel = 'entries',
}: PaginationControlsProps) {
  if (totalItems === 0) return null;

  const startIdx = (currentPage - 1) * pageSize + 1;
  const endIdx = Math.min(currentPage * pageSize, totalItems);

  // Helper to generate visible page numbers (max 5 buttons)
  const getPageNumbers = () => {
    const pages: (number | '...')[] = [];
    if (totalPages <= 5) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      if (currentPage <= 3) {
        pages.push(1, 2, 3, 4, '...', totalPages);
      } else if (currentPage >= totalPages - 2) {
        pages.push(1, '...', totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
      } else {
        pages.push(1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages);
      }
    }
    return pages;
  };

  return (
    <div className="border-t border-border/60 bg-muted/10 py-3.5 px-5 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
      {/* Left side: item counts & page size selector */}
      <div className="flex flex-wrap items-center gap-3 text-muted-foreground">
        <span>
          Showing <strong className="text-foreground font-mono font-medium">{startIdx}</strong> to{' '}
          <strong className="text-foreground font-mono font-medium">{endIdx}</strong> of{' '}
          <strong className="text-foreground font-mono font-medium">{totalItems}</strong> {itemLabel}
        </span>

        {onPageSizeChange && (
          <div className="flex items-center gap-1.5 border-l border-border/50 pl-3">
            <span>Show:</span>
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="bg-muted/40 border border-border/60 rounded-lg px-2 py-1 text-xs text-foreground focus:outline-none focus:border-primary transition-colors cursor-pointer font-mono font-medium"
            >
              {pageSizeOptions.map((size) => (
                <option key={size} value={size} className="bg-card text-foreground">
                  {size} / page
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Right side: navigation controls */}
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          disabled={currentPage <= 1}
          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-border/60 bg-muted/20 text-foreground font-medium hover:bg-muted/50 hover:border-primary/40 disabled:opacity-40 disabled:pointer-events-none transition-all"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Prev</span>
        </button>

        <div className="flex items-center gap-1">
          {getPageNumbers().map((page, idx) =>
            page === '...' ? (
              <span key={`ellipsis-${idx}`} className="px-1.5 py-1 text-muted-foreground">
                <MoreHorizontal className="w-4 h-4" />
              </span>
            ) : (
              <button
                key={page}
                onClick={() => onPageChange(page as number)}
                className={`w-7 h-7 rounded-lg font-mono text-xs font-semibold flex items-center justify-center transition-all ${
                  currentPage === page
                    ? 'bg-primary text-primary-foreground shadow-md shadow-primary/25 border border-primary'
                    : 'bg-muted/10 border border-border/40 text-muted-foreground hover:bg-muted/30 hover:text-foreground'
                }`}
              >
                {page}
              </button>
            )
          )}
        </div>

        <button
          onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage >= totalPages}
          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-border/60 bg-muted/20 text-foreground font-medium hover:bg-muted/50 hover:border-primary/40 disabled:opacity-40 disabled:pointer-events-none transition-all"
        >
          <span className="hidden sm:inline">Next</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
