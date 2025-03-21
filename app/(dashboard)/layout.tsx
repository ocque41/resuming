import React from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getUser } from '@/lib/db/queries.server';
import ErrorBoundaryWrapper from '@/components/ErrorBoundaryWrapper';
import { DashboardNav } from '@/components/ui/dashboard-nav';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Check if user is authenticated
  const user = await getUser();
  
  // If no user is authenticated, redirect to login
  if (!user) {
    redirect('/login');
  }
  
  return (
    <div className="min-h-screen bg-[#050505] text-[#F9F6EE] flex">
      {/* Sidebar */}
      <div className="hidden lg:flex lg:w-64 border-r border-[#222222] p-6 flex-col">
        <div className="font-safiro text-xl font-bold mb-8">Resuming</div>
        <ErrorBoundaryWrapper>
          <DashboardNav />
        </ErrorBoundaryWrapper>
      </div>
      
      {/* Main Content */}
      <div className="flex-1 min-h-screen">
        <ErrorBoundaryWrapper>
          <main className="p-6 lg:p-8">
            {children}
          </main>
        </ErrorBoundaryWrapper>
      </div>
    </div>
  );
}
