import { AdminNav } from './components/admin-nav';
import { checkAuth, isAdmin } from '@/lib/auth/check-auth';
import { redirect } from 'next/navigation';

export const metadata = {
  title: 'Admin Dashboard',
  description: 'Admin dashboard for managing the application.',
};

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await checkAuth();
  const adminStatus = await isAdmin();
  
  // Check if user is authenticated and is admin
  if (!session || !adminStatus) {
    redirect('/');
  }

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="flex flex-col space-y-8 lg:flex-row lg:space-x-12 lg:space-y-0">
        <aside className="lg:w-full">
          <AdminNav />
          <main>{children}</main>
        </aside>
      </div>
    </div>
  );
} 