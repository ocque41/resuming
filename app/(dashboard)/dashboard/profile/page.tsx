import { redirect } from 'next/navigation';
import { getUser } from '@/lib/db/queries.server';
import { User } from '@/lib/db/schema';
import { auth } from '@/auth';
import ChangePasswordForm from './change-password-form';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

export default async function ProfilePage() {
  const user = (await getUser()) as User;

  if (!user) {
    redirect('/sign-in');
  }

  const session = await auth();
  const isAdmin = !!session?.user?.admin;

  return (
    <div className="max-w-4xl mx-auto py-12">
      <h1 className="text-2xl font-bold mb-8">Profile</h1>
      
      <div className="bg-[#0B0B0B] rounded-lg border border-[#222222] p-6 mb-8">
        <h2 className="text-xl font-semibold mb-4">Account Information</h2>
        <div className="grid gap-4">
          <div>
            <p className="text-[#999999] text-sm mb-1">Email</p>
            <p className="font-medium">{user.email}</p>
          </div>
          <div>
            <p className="text-[#999999] text-sm mb-1">Role</p>
            <p className="font-medium">{user.role}</p>
          </div>
          {isAdmin && (
            <div>
              <p className="text-[#999999] text-sm mb-1">Admin Status</p>
              <div className="flex items-center justify-between">
                <p className="font-medium flex items-center">
                  <span className="inline-block w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                  Administrator
                </p>
                <Link 
                  href="/admin" 
                  className="text-[#B4916C] hover:text-[#A3815B] transition-colors text-sm flex items-center"
                >
                  Admin Dashboard
                  <ArrowRight className="ml-1 h-3 w-3" />
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
      
      <ChangePasswordForm />
    </div>
  );
} 