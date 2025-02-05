import { redirect } from 'next/navigation';
import { Settings } from './settings';
import { getTeamForUser, getUser } from '@/lib/db/queries';
import { DashboardTopNav } from '@/components/ui/dashboard-top-nav';

export default async function SettingsPage() {
  const user = await getUser();

  if (!user) {
    redirect('/sign-in');
  }

  const teamData = await getTeamForUser(user.id);

  if (!teamData) {
    throw new Error('Team not found');
  }


  return (
    <>
      <DashboardTopNav />
      <Settings teamData={teamData} />
    </>
  );
}
