import Activity from '../activity/page';
import General from '../general/page';
import Security from '../security/page';
import { TeamDataWithMembers } from '@/lib/db/schema';
import { InviteTeamMember } from '../invite-team';

export default function SettingsPage({ teamData }: { teamData: TeamDataWithMembers }) {
  return (
    <div className="p-4 lg:p-8">
      <h1 className="text-lg lg:text-2xl font-medium mb-6">Settings</h1>
      <General teamData={teamData} />
      <Activity teamData={teamData} />
      <Security teamData={teamData} />
      <InviteTeamMember teamData={teamData} />
    </div>
  );
}
