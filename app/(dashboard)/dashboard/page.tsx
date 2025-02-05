import { redirect } from 'next/navigation';
import { Settings } from './settings';
import { getTeamForUser, getUser } from '@/lib/db/queries';
import { NativeModules } from 'react-native';

const { DashboardNavigationManager } = NativeModules;

export default async function SettingsPage() {
  const user = await getUser();

  if (!user) {
    redirect('/sign-in');
  }

  const teamData = await getTeamForUser(user.id);

  if (!teamData) {
    throw new Error('Team not found');
  }

  // Example usage of the native module
  DashboardNavigationManager.showNavigation();

  return <Settings teamData={teamData} />;
}
