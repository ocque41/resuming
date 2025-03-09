// app/(dashboard)/dashboard/page.tsx
import { redirect } from "next/navigation";
import { getUser, getTeamForUser, getCVsForUser, getActivityLogs } from "@/lib/db/queries.server";
import { ArticleTitle } from "@/components/ui/article";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import AnalyzeCVCard from "@/components/AnalyzeCVCard.client";
import OptimizeCVCard from "@/components/OptimizeCVCard.client";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import DashboardClientWrapper from "@/components/dashboard-client-wrapper";
import DeleteCVButton from "@/components/delete-cv";
import UserMenu from "@/components/UserMenu";
import ActionsDropdown from "@/components/ActionsDropdown";
import Link from "next/link";
import { ArrowRight, Diamond, Eye, ChevronRight } from "lucide-react";
import JobsCard from "@/components/JobsCard.client";
import ErrorBoundaryWrapper from "@/components/ErrorBoundaryWrapper";

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

  // Map CVs to match the expected JobsCardCV interface
  const mappedCVs = cvs.map(cv => ({
    ...cv,
    id: cv.id.toString(),
    userId: cv.userId.toString(),
    metadata: cv.metadata ? JSON.parse(cv.metadata) : undefined
  }));

  return (
    <>
      <header className="flex items-center justify-between p-4 mx-auto max-w-sm sm:max-w-md md:max-w-xl lg:max-w-2xl">
        <ArticleTitle className="text-md lg:text-xl font-medium ml-2 text-white">
          Dashboard
        </ArticleTitle>
        <UserMenu teamData={teamData} activityLogs={activityLogs} />
      </header>
      
      <div className="flex flex-col space-y-6 mx-auto max-w-sm sm:max-w-md md:max-w-xl lg:max-w-2xl px-2 sm:px-4 md:px-6 pb-12">
        <Card className="border border-[#B4916C]/20 bg-black shadow-lg">
          <CardHeader className="bg-black pb-4">
            <CardTitle className="text-xl font-bold text-[#B4916C]">Your CV Collection</CardTitle>
          </CardHeader>
          <CardContent className="p-4 md:p-6">
            <Table className="w-full">
              <TableHeader>
                <TableRow className="border-b border-[#B4916C]/20">
                  <TableHead className="text-[#B4916C] font-semibold">Name</TableHead>
                  <TableHead className="text-[#B4916C] font-semibold">ATS Score</TableHead>
                  <TableHead className="text-[#B4916C] font-semibold">Optimized</TableHead>
                  <TableHead className="text-[#B4916C] font-semibold">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cvs.map((cv: any) => {
                  let metadata = null;
                  try {
                    metadata = cv.metadata ? JSON.parse(cv.metadata) : null;
                  } catch (err) {
                    console.error("Error parsing metadata:", err);
                  }
                  return (
                    <TableRow key={cv.id} className="border-b border-gray-800 hover:bg-[#B4916C]/5">
                      <TableCell className="text-sm text-gray-300 font-medium">
                        {cv.fileName}
                      </TableCell>
                      <TableCell className="text-sm">
                        {metadata?.atsScore ? (
                          <span className="px-2 py-1 bg-[#B4916C]/10 rounded-full text-[#B4916C] font-medium text-sm">
                            {metadata.atsScore}
                          </span>
                        ) : "-"}
                      </TableCell>
                      <TableCell className="text-sm">
                        {metadata?.optimized ? (
                          <span className="px-2 py-1 bg-green-500/10 rounded-full text-green-500 font-medium text-sm">
                            Yes
                          </span>
                        ) : (
                          <span className="px-2 py-1 bg-gray-500/10 rounded-full text-gray-500 font-medium text-sm">
                            No
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <ActionsDropdown cv={cv} />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        
        <ErrorBoundaryWrapper>
          <OptimizeCVCard 
            cvs={cvs.map((cv: any) => `${cv.fileName}|${cv.id}`)}
          />
        </ErrorBoundaryWrapper>
        
        <ErrorBoundaryWrapper>
          <JobsCard cvs={mappedCVs} />
        </ErrorBoundaryWrapper>
        
        <ErrorBoundaryWrapper>
          <AnalyzeCVCard cvs={cvs.map((cv) => cv.fileName)} />
        </ErrorBoundaryWrapper>
        
        {/* Link to Enhanced CV Page */}
        <Link 
          href="/dashboard/enhance" 
          className="flex items-center justify-between p-4 md:p-6 bg-black border border-[#B4916C]/20 rounded-lg shadow-lg hover:bg-[#1D1D1D] transition-colors"
        >
          <div className="flex items-center">
            <div className="flex items-center justify-center h-10 w-10 rounded-full bg-[#B4916C]/10 text-[#B4916C] mr-3">
              <Eye className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base md:text-lg font-medium text-[#B4916C]">Enhanced CV Preview</h3>
              <p className="text-sm text-gray-400">Professional styling with custom formatting</p>
            </div>
          </div>
          <ChevronRight className="h-5 w-5 text-[#B4916C]" />
        </Link>
      </div>
    </>
  );
}
