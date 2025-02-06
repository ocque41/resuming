

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {

  return (
    <div className="flex flex-col min-h-screen w-full bg-black bg-gradient-to-br from-black via-[#0a0a0a] to-[#1a1a1a] text-white">
      <header className="flex justify-between items-center p-4 lg:p-8">
      </header>
      <main className="flex-1 overflow-y-auto px-4 py-2 mt-4">{children}</main>
    </div>
  );
}
