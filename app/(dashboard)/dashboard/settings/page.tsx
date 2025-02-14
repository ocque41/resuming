import { getTeamData } from '@/lib/db/server-team'; // Server-only module
import ActivityPage from '../activity/page';
import GeneralPage from '../general/page';
import SecurityPage from '../security/page';
import { InviteTeamMember } from '../invite-team';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import BillingButton from '../billing-button';
import { ArticleTitle } from '@/components/ui/article';

export default async function SettingsPage() {
  // Pass the required teamId
  const teamData = await getTeamData("yourTeamId");

  return (
    <section className="flex-1 p-4 lg:p-8 bg-black text-white min-h-screen">
      <header className="flex items-center justify-between p-4 lg:p-8 mx-auto max-w-md lg:max-w-2xl">
        <div className="flex items-center justify-between w-full">
          <ArticleTitle className="text-lg lg:text-2xl font-medium ml-4">
            User Settings
          </ArticleTitle>
          <a href="/dashboard" className="text-sm text-gray-500 hover:text-gray-700">
            Go Back
          </a>
        </div>
      </header>
      <div className="space-y-8 mx-auto max-w-md lg:max-w-2xl">
        <GeneralPage />
        <Card className="mx-auto max-w-md lg:max-w-lg">
          <CardHeader>
            <CardTitle className="text-base text-gray-400">Subscription</CardTitle>
          </CardHeader>
          <CardContent className="flex justify-center">
            <BillingButton />
          </CardContent>
        </Card>
        <Card className="mx-auto max-w-md lg:max-w-lg">
          <CardHeader>
            <CardTitle className="text-base text-gray-400">Invite Team Member</CardTitle>
          </CardHeader>
          <CardContent className="flex justify-center">
            <InviteTeamMember />
          </CardContent>
        </Card>
        <ActivityPage />
        <SecurityPage />
      </div>
    </section>
  );
}
