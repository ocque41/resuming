import { redirect } from 'next/navigation';
import { Settings } from './settings';
import { ArticleTitle } from '@/components/ui/article';
import { getTeamForUser, getUser } from '@/lib/db/queries';

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
      <header className="flex justify-between items-center p-4 lg:p-8">
        <ArticleTitle className="text-lg lg:text-2xl font-medium">Dashboard</ArticleTitle>
        <a href="/dashboard/settings">
          <img src="/icons/detectiv.svg" alt="Detectiv Icon" className="h-8 w-8 lg:h-12 lg:w-12 filter invert" />
        </a>
      </header>
      <SettingsPage teamData={teamData} />
    </>
  );
}
