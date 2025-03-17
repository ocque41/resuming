// app/(dashboard)/dashboard/page.tsx
import { redirect } from "next/navigation";
import { getUser, getTeamForUser, getCVsForUser, getActivityLogs } from "@/lib/db/queries.server";
import { ArticleTitle } from "@/components/ui/article";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import DeleteCVButton from "@/components/delete-cv";
import UserMenu from "@/components/UserMenu";
import ActionsDropdown from "@/components/ActionsDropdown";
import Link from "next/link";
import { 
  ArrowRight, Eye, ChevronRight, BarChart2, 
  FileText, Briefcase, Upload, PieChart 
} from "lucide-react";
import ErrorBoundaryWrapper from "@/components/ErrorBoundaryWrapper";
import CVUploader from "@/components/CVUploader.client";

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
        
        {/* CV Upload Area */}
        <ErrorBoundaryWrapper>
          <div className="flex items-center mb-2">
            <Upload className="h-5 w-5 text-[#B4916C] mr-2" />
            <h2 className="text-lg font-medium text-white">Upload New CV</h2>
          </div>
          <CVUploader />
        </ErrorBoundaryWrapper>
        
        {/* Feature Links */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Optimize CV Link */}
          <Link 
            href="/dashboard/optimize" 
            className="flex items-center justify-between p-4 md:p-6 bg-black border border-[#B4916C]/20 rounded-lg shadow-lg hover:bg-[#1D1D1D] transition-colors"
          >
            <div className="flex items-center">
              <div className="flex items-center justify-center h-10 w-10 rounded-full bg-[#B4916C]/10 text-[#B4916C] mr-3">
                <BarChart2 className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base md:text-lg font-medium text-[#B4916C]">Optimize CV</h3>
                <p className="text-sm text-gray-400">Analyze & optimize for ATS</p>
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-[#B4916C]" />
          </Link>
          
          {/* Document Editor Link */}
          <Link 
            href="/dashboard/enhance" 
            className="flex items-center justify-between p-4 md:p-6 bg-black border border-[#B4916C]/20 rounded-lg shadow-lg hover:bg-[#1D1D1D] transition-colors"
          >
            <div className="flex items-center">
              <div className="flex items-center justify-center h-10 w-10 rounded-full bg-[#B4916C]/10 text-[#B4916C] mr-3">
                <FileText className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base md:text-lg font-medium text-[#B4916C]">Document Editor</h3>
                <p className="text-sm text-gray-400">Edit with AI assistance</p>
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-[#B4916C]" />
          </Link>
          
          {/* Document Analysis Link */}
          <Link 
            href="/dashboard/analyze" 
            className="flex items-center justify-between p-4 md:p-6 bg-black border border-[#B4916C]/20 rounded-lg shadow-lg hover:bg-[#1D1D1D] transition-colors"
          >
            <div className="flex items-center">
              <div className="flex items-center justify-center h-10 w-10 rounded-full bg-[#B4916C]/10 text-[#B4916C] mr-3">
                <PieChart className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base md:text-lg font-medium text-[#B4916C]">Document Analysis</h3>
                <p className="text-sm text-gray-400">Extract insights & visualize data</p>
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-[#B4916C]" />
          </Link>
          
          {/* Job Description Generator Link - NEW */}
          <Link 
            href="/job-description" 
            className="flex items-center justify-between p-4 md:p-6 bg-black border border-[#B4916C]/20 rounded-lg shadow-lg hover:bg-[#1D1D1D] transition-colors"
          >
            <div className="flex items-center">
              <div className="flex items-center justify-center h-10 w-10 rounded-full bg-[#B4916C]/10 text-[#B4916C] mr-3">
                <FileText className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base md:text-lg font-medium text-[#B4916C]">Job Description Generator</h3>
                <p className="text-sm text-gray-400">Create detailed job descriptions</p>
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-[#B4916C]" />
          </Link>
          
          {/* Job Match Analysis Link - NEW */}
          <Link 
            href="/job-match" 
            className="flex items-center justify-between p-4 md:p-6 bg-black border border-[#B4916C]/20 rounded-lg shadow-lg hover:bg-[#1D1D1D] transition-colors"
          >
            <div className="flex items-center">
              <div className="flex items-center justify-center h-10 w-10 rounded-full bg-[#B4916C]/10 text-[#B4916C] mr-3">
                <BarChart2 className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base md:text-lg font-medium text-[#B4916C]">CV to Job Match</h3>
                <p className="text-sm text-gray-400">Analyze CV against job descriptions</p>
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-[#B4916C]" />
          </Link>
          
          {/* Job Matching Link */}
          <Link 
            href="/dashboard/jobs" 
            className="flex items-center justify-between p-4 md:p-6 bg-black border border-[#B4916C]/20 rounded-lg shadow-lg hover:bg-[#1D1D1D] transition-colors md:col-span-2"
          >
            <div className="flex items-center">
              <div className="flex items-center justify-center h-10 w-10 rounded-full bg-[#B4916C]/10 text-[#B4916C] mr-3">
                <Briefcase className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base md:text-lg font-medium text-[#B4916C]">Find Matching Jobs</h3>
                <p className="text-sm text-gray-400">Discover jobs that match your CV</p>
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-[#B4916C]" />
          </Link>
        </div>
      </div>
    </>
  );
}
