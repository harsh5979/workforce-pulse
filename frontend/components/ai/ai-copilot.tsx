'use client';

import { Bot, Sparkles } from 'lucide-react';
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
      className="fixed bottom-6 right-6 z-40 flex items-center gap-2.5 px-4 py-3 rounded-2xl bg-gradient-to-r from-emerald-600 via-primary to-teal-600 text-white font-bold shadow-2xl hover:opacity-95 hover:scale-105 transition-all border border-white/20 active:scale-95 lg:hidden"
    >
      <Bot className="w-5 h-5 text-amber-300 animate-bounce shrink-0" />
      <span className="text-sm font-sans font-extrabold">AI Copilot</span>
      <Sparkles className="w-4 h-4 text-amber-200 shrink-0" />
    </button>
  );
}
