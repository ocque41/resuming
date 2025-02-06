'use client';

import { ArticleTitle } from '@/components/ui/article';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {

  return (
    <div className="flex flex-col min-h-screen w-full bg-black bg-gradient-to-br from-black via-[#0a0a0a] to-[#1a1a1a] text-white">
      <header className="flex justify-between items-center p-4 lg:p-8">
        <ArticleTitle className="text-lg lg:text-2xl font-medium">Dashboard</ArticleTitle>
        <img src="/icons/detectiv.svg" alt="Detectiv Icon" className="h-8 w-8 lg:h-12 lg:w-12" />
      </header>
      <main className="flex-1 overflow-y-auto px-4 py-2 mt-4">{children}</main>
    </div>
  );
}
