import { redirect } from "next/navigation";
import { getUser, getTeamForUser, getActivityLogs } from "@/lib/db/queries.server";
import { PremiumCard, PremiumCardContent, PremiumCardHeader, PremiumCardTitle } from "@/components/ui/premium-card";
import PremiumPageLayout from "@/components/PremiumPageLayout";
import AnalyticsWrapper from "@/components/analytics/AnalyticsWrapper.client";

export default async function AnalysisQualityPage() {
  const user = await getUser();
  if (!user) {
    redirect("/sign-in");
  }
  
  try {
    const teamData = await getTeamForUser(user.id);
    if (!teamData) {
      throw new Error("Team not found");
    }
    
    const activityLogs = await getActivityLogs();
    
    return (
      <PremiumPageLayout
        title="Analysis Quality Dashboard"
        subtitle="Track metrics and feedback for document analysis quality"
        backUrl="/dashboard"
        withGradientBackground
        withScrollIndicator
        animation="fade"
        teamData={teamData}
        activityLogs={activityLogs}
      >
        <div className="space-y-6 mb-6">
          <p className="text-[#C5C2BA] font-borna text-lg max-w-3xl">
            Monitor real-time metrics on document analysis quality, user feedback, and system performance
            to continuously improve our AI analysis capabilities.
          </p>
          
          <PremiumCard className="border border-[#222222] bg-[#111111] shadow-lg hover:border-[#333333] transition-all duration-300">
            <PremiumCardHeader>
              <PremiumCardTitle className="font-safiro text-[#F9F6EE]">
                Document Analysis <span className="text-[#B4916C]">Quality Metrics</span>
              </PremiumCardTitle>
              <p className="text-[#8A8782] font-borna mt-1">
                Real-time metrics on document analysis accuracy and performance
              </p>
            </PremiumCardHeader>
            
            <PremiumCardContent className="p-4 md:p-6">
              <AnalyticsWrapper />
            </PremiumCardContent>
          </PremiumCard>
        </div>
      </PremiumPageLayout>
    );
  } catch (error) {
    // Return an error message
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0A0A0A]">
        <div className="max-w-md p-6 bg-[#111111] border border-[#222222] rounded-md shadow-lg">
          <h2 className="text-xl text-[#F9F6EE] font-semibold mb-4">Error Loading Analytics</h2>
          <p className="text-[#C5C2BA]">
            There was an error loading the analysis quality dashboard. Please try again later or contact support.
          </p>
        </div>
      </div>
    );
  }
} 