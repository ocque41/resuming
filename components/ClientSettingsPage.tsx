"use client";

import React, { Suspense, lazy } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import BillingButton from "app/(dashboard)/dashboard/billing-button";
import { ArticleTitle } from "@/components/ui/article";
import { InviteTeamMember } from "app/(dashboard)/dashboard/invite-team";
import ActivityLogClient from "@/components/ActivityLogClient";
import { ArrowLeft, DollarSign, Users, FileText, Shield, Activity } from "lucide-react";
import { SkeletonText, SkeletonCard } from "./ui/skeleton";
import ErrorBoundaryWrapper from "@/components/ErrorBoundaryWrapper";

// Dynamically import the pages with React.lazy
const GeneralPage = lazy(() => import("app/(dashboard)/dashboard/general/page"));
const SecurityPage = lazy(() => import("app/(dashboard)/dashboard/security/page"));

// Loading component for when the lazy loaded components are loading
const ComponentLoader = () => (
  <div className="space-y-4">
    <SkeletonText className="h-8 w-1/2" />
    <SkeletonCard className="h-52 w-full" />
    <SkeletonText className="h-4 w-full" />
    <SkeletonText className="h-4 w-3/4" />
  </div>
);

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
    <section className="flex-1 p-4 lg:p-8 bg-black text-white min-h-screen rounded-lg">
      <div className="space-y-8 mx-auto max-w-md lg:max-w-2xl">
        <header className="flex items-center justify-between mb-6">
          <div className="flex items-center justify-between w-full">
            <ArticleTitle className="text-lg lg:text-2xl font-medium text-[#B4916C]">
              User Settings
            </ArticleTitle>
            <button 
              onClick={onClose} 
              className="flex items-center px-4 py-2 rounded-md bg-black border border-[#B4916C]/20 text-[#B4916C] hover:bg-[#1D1D1D] transition-colors duration-200"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Go Back
            </button>
          </div>
        </header>

        <div className="flex items-center mb-4">
          <FileText className="h-5 w-5 text-[#B4916C] mr-2" />
          <h2 className="text-lg font-medium text-white">Account Information</h2>
        </div>
        <ErrorBoundaryWrapper>
          <Suspense fallback={<ComponentLoader />}>
            <GeneralPage />
          </Suspense>
        </ErrorBoundaryWrapper>
        
        <div className="flex items-center mb-4 mt-8">
          <DollarSign className="h-5 w-5 text-[#B4916C] mr-2" />
          <h2 className="text-lg font-medium text-white">Subscription</h2>
        </div>
        <Card className="border border-[#B4916C]/20 bg-black shadow-lg">
          <CardHeader className="pb-4">
            <CardTitle className="text-[#B4916C] text-lg">Manage Your Plan</CardTitle>
          </CardHeader>
          <CardContent className="flex justify-center p-6">
            <BillingButton />
          </CardContent>
        </Card>
        
        <div className="flex items-center mb-4 mt-8">
          <Users className="h-5 w-5 text-[#B4916C] mr-2" />
          <h2 className="text-lg font-medium text-white">Team Management</h2>
        </div>
        <Card className="border border-[#B4916C]/20 bg-black shadow-lg">
          <CardHeader className="pb-4">
            <CardTitle className="text-[#B4916C] text-lg">Invite Team Member</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <InviteTeamMember />
          </CardContent>
        </Card>
        
        <div className="flex items-center mb-4 mt-8">
          <Activity className="h-5 w-5 text-[#B4916C] mr-2" />
          <h2 className="text-lg font-medium text-white">Activity Log</h2>
        </div>
        <ActivityLogClient logs={activityLogs} />
        
        <div className="flex items-center mb-4 mt-8">
          <Shield className="h-5 w-5 text-[#B4916C] mr-2" />
          <h2 className="text-lg font-medium text-white">Security Settings</h2>
        </div>
        <ErrorBoundaryWrapper>
          <Suspense fallback={<ComponentLoader />}>
            <SecurityPage />
          </Suspense>
        </ErrorBoundaryWrapper>
      </div>
    </section>
  );
}
