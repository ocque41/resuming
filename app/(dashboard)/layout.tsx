'use client';

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <section className="flex flex-col min-h-screen bg-black">
      <main className="flex-grow">
        {children}
      </main>
    </section>
  );
}
