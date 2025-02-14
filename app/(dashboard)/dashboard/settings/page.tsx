import { getTeamData } from '@/lib/db/server-team'; // Server-only module
import ActivityPage from '../activity/page';
import GeneralPage from '../general/page';
import SecurityPage from '../security/page';
import { InviteTeamMember } from '../invite-team';

export default async function SettingsPage() {
  // Pass the required teamId
  const teamData = await getTeamData("yourTeamId");

  return (
    <section className="flex-1 p-4 lg:p-8 bg-black text-white min-h-screen">
      <header className="flex items-center justify-between p-4 lg:p-8 mx-auto max-w-md lg:max-w-2xl">
        <h1 className="text-lg lg:text-2xl font-medium text-orange-500">
          User Settings
        </h1>
      </header>
      <div className="space-y-8 mx-auto max-w-md lg:max-w-2xl">
        <GeneralPage />
        <SecurityPage />
        <InviteTeamMember />
        <ActivityPage />
      </div>
    </section>
  );
}
