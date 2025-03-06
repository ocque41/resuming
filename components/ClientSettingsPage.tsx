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
    <section className="flex-1 p-4 lg:p-8 bg-[#050505] text-white min-h-screen rounded-lg">
      <div className="space-y-8 mx-auto max-w-md lg:max-w-2xl">
        <header className="flex items-center justify-between p-4 lg:p-8">
          <div className="flex items-center justify-between w-full">
            <ArticleTitle className="text-lg lg:text-2xl font-medium text-white">
              User Settings
            </ArticleTitle>
            <button 
              onClick={onClose} 
              className="px-4 py-2 rounded-md bg-[#B4916C]/10 text-[#B4916C] hover:bg-[#B4916C]/20 transition-colors duration-200"
            >
              Go Back
            </button>
          </div>
        </header>
        <GeneralPage />
        <Card className="mt-4 mb-8 mx-auto max-w-md lg:max-w-2xl border border-[#B4916C]/20 bg-[#050505] shadow-lg">
          <CardHeader className="bg-[#B4916C]/10 pb-4">
            <CardTitle className="text-xl font-bold text-white">Subscription</CardTitle>
          </CardHeader>
          <CardContent className="flex justify-center p-6">
            <BillingButton />
          </CardContent>
        </Card>
        <Card className="mt-4 mb-8 mx-auto max-w-md lg:max-w-2xl border border-[#B4916C]/20 bg-[#050505] shadow-lg">
          <CardHeader className="bg-[#B4916C]/10 pb-4">
            <CardTitle className="text-xl font-bold text-white">Invite Team Member</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <InviteTeamMember />
          </CardContent>
        </Card>
        <ActivityLogClient logs={activityLogs} />
        <SecurityPage />
      </div>
    </section>
  );
}
