import ClientSettingsPage from './settings-component';
import { getTeamData } from '@/lib/db/server-team'; // Server-only module

export default async function SettingsPage() {
  // Pass the required teamId
  const teamData = await getTeamData("yourTeamId");
  return <ClientSettingsPage teamData={teamData} />;
}
