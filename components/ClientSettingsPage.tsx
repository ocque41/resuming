// components/ClientSettingsDialogContent.tsx
"use client";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import BillingButton from "app/(dashboard)/dashboard/billing-button";
import { ArticleTitle } from "@/components/ui/article";
import { InviteTeamMember } from "app/(dashboard)/dashboard/invite-team";

// Import new client-presentational components
import ActivityLogClient from "@/components/ActivityLogClient";
import GeneralSettingsClient from "@/components/GeneralSettingsClient";
import SecuritySettingsClient from "@/components/SecuritySettingsClient";

interface ClientSettingsDialogContentProps {
  teamData: any;
  activityLogs: any[];
  generalSettings: any;
  securitySettings: any;
  onClose: () => void;
}

export default function ClientSettingsDialogContent({
  teamData,
  activityLogs,
  generalSettings,
  securitySettings,
  onClose,
}: ClientSettingsDialogContentProps) {
  return (
    <section className="flex-1 p-4 lg:p-8 bg-black text-white min-h-screen">
      <div className="space-y-8 mx-auto max-w-md lg:max-w-2xl">
        <header className="flex items-center justify-between p-4 lg:p-8">
          <div className="flex items-center justify-between w-full">
            <ArticleTitle className="text-lg lg:text-2xl font-medium ml-4">
              User Settings
            </ArticleTitle>
            <button onClick={onClose} className="text-sm text-gray-500 hover:text-gray-700">
              Go Back
            </button>
          </div>
        </header>
        <GeneralSettingsClient data={generalSettings} />
        <Card className="mt-4 mb-8 mx-auto max-w-md lg:max-w-2xl border-transparent">
          <CardHeader>
            <CardTitle className="text-base text-gray-400 text-center">Subscription</CardTitle>
          </CardHeader>
          <CardContent className="flex justify-center">
            <BillingButton />
          </CardContent>
        </Card>
        <Card className="mt-4 mb-8 mx-auto max-w-md lg:max-w-2xl border-transparent">
          <CardHeader>
            <CardTitle className="text-base text-gray-400 text-center">Invite Team Member</CardTitle>
          </CardHeader>
          <CardContent>
            <InviteTeamMember />
          </CardContent>
        </Card>
        <ActivityLogClient logs={activityLogs} />
        <SecuritySettingsClient data={securitySettings} />
      </div>
    </section>
  );
}
