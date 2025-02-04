'use client';


export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col min-h-[calc(100dvh-68px)] max-w-7xl mx-auto w-full bg-black bg-gradient-to-br from-black via-[#0a0a0a] to-[#1a1a1a] text-white">
      <main className="flex-1 overflow-y-auto p-0 lg:p-4 pb-16">{children}</main>

    </div>
  );
}
