import { redirect } from "next/navigation";
import { getUser, getTeamForUser, getActivityLogs } from "@/lib/db/queries.server";
import JobMatchAnalysisVisualizer from "../../components/JobMatchAnalysisVisualizer.client";
import PremiumPageLayout from "@/components/PremiumPageLayout";

export default async function JobMatchPage() {
  // Get user data
  const user = await getUser();
  if (!user) {
    redirect("/sign-in");
  }
  
  // Get team data and activity logs
  const teamData = await getTeamForUser(user.id);
  if (!teamData) {
    throw new Error("Team not found");
  }
  
  const activityLogs = await getActivityLogs();
  
  return (
    <PremiumPageLayout
      title="CV to Job Match"
      subtitle="Analyze how well your CV matches a specific job description"
      backUrl="/dashboard"
      withGradientBackground
      withScrollIndicator
      animation="fade"
      teamData={teamData}
      activityLogs={activityLogs}
    >
      <JobMatchAnalysisVisualizer />
    </PremiumPageLayout>
  );
} 