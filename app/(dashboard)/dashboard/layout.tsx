'use client';

import { BottomNav } from '@/components/ui/bottom-nav';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col min-h-[calc(100dvh-68px)] container-xl mx-auto w-full rice-paper-bg">
      {/* Main content */}
      <main className="flex-1 overflow-y-auto px-4 py-8 lg:px-8 lg:py-12">
        <div className="max-w-screen-xl mx-auto">
          {children}
        </div>
      </main>

      {/* Bottom Navigation */}
      <BottomNav 
        className="fixed bottom-0 left-0 right-0 bg-[#FAF6ED] border-t border-[#584235]/10 shadow-lg lg:hidden" 
        size="sm"
      />
    </div>
  );
}
