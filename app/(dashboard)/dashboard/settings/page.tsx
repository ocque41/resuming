import { Activity } from '../activity/page';
import { General } from '../general/page';
import { Security } from '../security/page';
import { InviteTeamMember } from '../invite-team';
import { Settings } from '../settings';

export default function SettingsPage() {
  return (
    <div className="p-4 lg:p-8">
      <h1 className="text-lg lg:text-2xl font-medium mb-6">Settings</h1>
      <General />
      <Activity />
      <Security />
      <InviteTeamMember />
      <Settings />
    </div>
  );
}
