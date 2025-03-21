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

// This would come from your database in a real application
const getMockCVs = () => [
  {
    id: 'cv-1',
    name: 'Software Developer CV.pdf',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString(), // 2 days ago
  },
  {
    id: 'cv-2',
    name: 'Product Manager Resume.pdf',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7).toISOString(), // 7 days ago
  },
];

// This would come from your database in a real application
const getMockActivityLogs = () => [
  {
    id: 'log-1',
    action: 'created',
    resource: 'CV',
    resourceId: 'cv-1',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString(),
    userId: 'user-1',
  },
  {
    id: 'log-2',
    action: 'analyzed',
    resource: 'CV',
    resourceId: 'cv-1',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 1).toISOString(),
    userId: 'user-1',
  },
  {
    id: 'log-3',
    action: 'created',
    resource: 'CV',
    resourceId: 'cv-2',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7).toISOString(),
    userId: 'user-1',
  },
  {
    id: 'log-4',
    action: 'updated',
    resource: 'profile',
    resourceId: 'profile-1',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 12).toISOString(),
    userId: 'user-1',
  },
  {
    id: 'log-5',
    action: 'email',
    resource: 'verification',
    resourceId: 'email-1',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
    userId: 'user-1',
  },
];

// This would come from your database in a real application
const getMockTeamData = () => ({
  id: 'team-1',
  planName: 'Basic', // Options: Free, Basic, Pro, Enterprise
  created: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString(),
  updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString(),
  billingCycle: 'monthly',
});

export default async function DashboardPage() {
  // Get the current authenticated user
  const user = await getUser();
  
  // If no user is authenticated, redirect to login
  if (!user) {
    redirect('/login');
  }
  
  // In a real application, these would come from your database
  const cvs = getMockCVs();
  const activityLogs = getMockActivityLogs();
  const teamData = getMockTeamData();
  
  return (
    <ErrorBoundaryWrapper>
      <DashboardClient 
        userName={user.name || 'User'}
        teamData={teamData}
        cvs={cvs}
        activityLogs={activityLogs}
      />
    </ErrorBoundaryWrapper>
  );
}
