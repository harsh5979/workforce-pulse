'use client';

import { usePathname } from 'next/navigation';
import { Sidebar } from '@/components/layout/sidebar';
import { Topbar } from '@/components/layout/topbar';
import { AICopilot } from '@/components/ai/ai-copilot';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isAiPage = pathname === '/dashboard/ai';

  return (
    <div className="flex h-full overflow-hidden bg-background">
      <Sidebar />
      <div className="flex flex-col flex-1 overflow-hidden">
        <Topbar />
        <main className={`flex-1 relative ${isAiPage ? 'overflow-hidden p-0 sm:p-3 lg:p-6 flex flex-col min-h-0' : 'overflow-y-auto p-4 lg:p-6 pb-24 lg:pb-6'}`}>
          <div className={`max-w-screen-2xl mx-auto w-full ${isAiPage ? 'h-full flex flex-col min-h-0' : 'min-h-full'}`}>
            {children}
          </div>
        </main>
      </div>
      <AICopilot />
    </div>
  );
}

