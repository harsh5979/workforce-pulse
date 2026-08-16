'use client';

import { Cpu } from 'lucide-react';
import { usePathname } from 'next/navigation';

/**
 * Floating AI Copilot button — clean, no label clutter.
 * Navigates to the dedicated /dashboard/ai page instead of opening a slide-over.
 */
export function AICopilot() {
  const pathname = usePathname();

  // Navigate to the dedicated AI page instead of a modal
  const handleNavigate = () => {
    window.location.href = '/dashboard/ai';
  };

  if (pathname === '/dashboard/ai') return null;


  return (
    <button
      onClick={handleNavigate}
      aria-label="Open AI Workforce Copilot"
      className="fixed bottom-6 right-6 z-40 flex items-center gap-2.5 px-6 py-3.5 rounded-full bg-primary text-primary-foreground font-bold shadow-2xl hover:opacity-90 hover:-translate-y-1 transition-all border border-primary/50 active:scale-95"
    >
      <Cpu className="w-5 h-5 shrink-0" />
      <span className="text-sm font-sans font-extrabold tracking-wide uppercase">AI Copilot</span>
    </button>
  );
}
