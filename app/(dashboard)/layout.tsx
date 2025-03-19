'use client';

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <section className="flex flex-col min-h-screen bg-black">
      {children}
    </section>
  );
}
