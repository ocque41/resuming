// app/(dashboard)/dashboard/page.tsx
import { redirect } from "next/navigation";
import { getUser, getTeamForUser, getCVsForUser, getActivityLogs } from "@/lib/db/queries.server";
import ErrorBoundaryWrapper from "@/components/ErrorBoundaryWrapper";
import DashboardClient from "@/components/DashboardClient";

// Add a CV type definition
interface CV {
  id: string;
  userId: string;
  fileName: string;
  filePath?: string;
  filepath?: string;
  createdAt: Date;
  rawText?: string | null;
  metadata?: any;
  [key: string]: any;
}

export default async function DashboardPage() {
  const user = await getUser();
  if (!user) {
    redirect("/sign-in");
  }
  
  const teamData = await getTeamForUser(user.id);
  if (!teamData) {
    throw new Error("Team not found");
  }
  
  const cvs = await getCVsForUser(user.id);
  const activityLogs = await getActivityLogs(); // For UserMenu

  // Get user display name
  const userName = user.name || 'User';

  return (
    <ErrorBoundaryWrapper>
      <DashboardClient 
        userName={userName}
        teamData={teamData}
        cvs={cvs}
        activityLogs={activityLogs}
      />
    </ErrorBoundaryWrapper>
  );
}
