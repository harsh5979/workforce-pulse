import React from 'react';
import { BookOpen } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface CitationChipProps {
  reference: string;
  text: string;
}

export function CitationChip({ reference, text }: CitationChipProps) {
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex items-center gap-1 mx-1 px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20 text-[10px] font-mono font-medium cursor-help align-baseline hover:bg-primary/20 transition-colors">
            <BookOpen className="w-3 h-3" />
            {reference}
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs max-w-[200px] break-words">
          <p className="font-semibold text-primary/80 mb-1">Source Data</p>
          <p>{text}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
