// components/ClientSettingsDialogContent.tsx
"use client";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import BillingButton from "app/(dashboard)/dashboard/billing-button";
import { ArticleTitle } from "@/components/ui/article";
import { InviteTeamMember } from "app/(dashboard)/dashboard/invite-team";
import GeneralPage from "app/(dashboard)/dashboard/general/page";
import SecurityPage from "app/(dashboard)/dashboard/security/page";
import ActivityLogClient from "@/components/ActivityLogClient";

interface ClientSettingsDialogContentProps {
  teamData: any;
  activityLogs: any[];
  onClose: () => void;
}

export default function ClientSettingsDialogContent({
  teamData,
  activityLogs,
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
        <GeneralPage />
        <Card className="mt-4 mb-8 mx-auto max-w-md lg:max-w-2xl border border-[#B4916C] border-[1px]">
          <CardHeader>
            <CardTitle className="text-base text-gray-400 text-center">Subscription</CardTitle>
          </CardHeader>
          <CardContent className="flex justify-center">
            <BillingButton />
          </CardContent>
        </Card>
        <Card className="mt-4 mb-8 mx-auto max-w-md lg:max-w-2xl border border-[#B4916C] border-[1px]">
          <CardHeader>
            <CardTitle className="text-base text-gray-400 text-center">Invite Team Member</CardTitle>
          </CardHeader>
          <CardContent>
            <InviteTeamMember />
          </CardContent>
        </Card>
        <ActivityLogClient logs={activityLogs} />
        <SecurityPage />
      </div>
    </section>
  );
}
