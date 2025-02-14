import { getTeamData } from '@/lib/db/server-team'; // Server-only module
import ActivityPage from '../activity/page';
import GeneralPage from '../general/page';
import SecurityPage from '../security/page';
import { InviteTeamMember } from '../invite-team';

export default async function SettingsPage() {
  // Pass the required teamId
  const teamData = await getTeamData("yourTeamId");

  return (
    <section className="flex-1 p-4 lg:p-8 space-y-8">
      <h1 className="text-lg lg:text-2xl font-medium text-gray-900 mb-6">
        User Settings
      </h1>
      <GeneralPage />
      <SecurityPage />
      <InviteTeamMember />
      <ActivityPage />
    </section>
  );
}
