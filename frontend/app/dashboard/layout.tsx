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
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      <div className="flex flex-col flex-1 overflow-hidden">
        <Topbar />
        <main className={`flex-1 overflow-y-auto p-4 lg:p-6 ${isAiPage ? 'pb-4' : 'pb-24'} lg:pb-6 relative`}>
          <div className="max-w-screen-2xl mx-auto h-full">
            {children}
          </div>
        </main>
      </div>
      <AICopilot />
    </div>
  );
}

