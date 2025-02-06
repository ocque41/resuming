import Activity from '../activity/page';
import General from '../general/page';
import Security from '../security/page';
import { InviteTeamMember } from '../invite-team';
import { TeamDataWithMembers } from '@/lib/db/schema';
import { getTeamData } from '../settings';

export default async function SettingsPage() {
  const teamData: TeamDataWithMembers = await getTeamData("yourTeamId");
  return (
    <div className="p-4 lg:p-8">
      <h1 className="text-lg lg:text-2xl font-medium mb-6">Settings</h1>
      <General />
      <Activity />
      <Security />
      <InviteTeamMember />
    </div>
  );
}
