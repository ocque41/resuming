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
import FeatureCard from "@/components/FeatureCard";
import AnimatedContainer from "@/components/AnimatedContainer";

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
        <ArticleTitle className="text-md lg:text-xl font-safiro font-medium ml-2 text-[#F9F6EE]">
          Dashboard
        </ArticleTitle>
        <UserMenu teamData={teamData} activityLogs={activityLogs} />
      </header>
      
      <div className="flex flex-col space-y-6 mx-auto max-w-sm sm:max-w-md md:max-w-xl lg:max-w-2xl px-2 sm:px-4 md:px-6 pb-12">
        <AnimatedContainer animationType="slide" duration={0.4}>
          <Card className="border-[#222222] bg-[#111111] shadow-lg rounded-xl overflow-hidden">
            <CardHeader className="bg-[#0D0D0D] border-b border-[#222222] pb-4">
              <CardTitle className="text-xl font-safiro font-bold text-[#F9F6EE]">Your CV Collection</CardTitle>
            </CardHeader>
            <CardContent className="p-4 md:p-5">
              <Table className="w-full">
                <TableHeader>
                  <TableRow className="border-b border-[#222222]">
                    <TableHead className="text-[#F9F6EE] font-safiro font-semibold">Name</TableHead>
                    <TableHead className="text-[#F9F6EE] font-safiro font-semibold">ATS Score</TableHead>
                    <TableHead className="text-[#F9F6EE] font-safiro font-semibold">Optimized</TableHead>
                    <TableHead className="text-[#F9F6EE] font-safiro font-semibold">Actions</TableHead>
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
                      <TableRow key={cv.id} className="border-b border-[#222222] hover:bg-[#050505]">
                        <TableCell className="text-sm text-[#F9F6EE]/90 font-borna font-medium">
                          {cv.fileName}
                        </TableCell>
                        <TableCell className="text-sm">
                          {metadata?.atsScore ? (
                            <span className="px-2.5 py-1 bg-[#333333] rounded-lg text-[#F9F6EE] font-borna text-sm">
                              {metadata.atsScore}
                            </span>
                          ) : "-"}
                        </TableCell>
                        <TableCell className="text-sm">
                          {metadata?.optimized ? (
                            <span className="px-2.5 py-1 bg-[#0D3A22] rounded-lg text-emerald-400 font-borna text-sm">
                              Yes
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 bg-[#222222] rounded-lg text-[#F9F6EE]/50 font-borna text-sm">
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
        </AnimatedContainer>
        
        {/* CV Upload Area */}
        <AnimatedContainer animationType="slide" delay={0.2} duration={0.4}>
          <ErrorBoundaryWrapper>
            <div className="flex items-center mb-2">
              <Upload className="h-5 w-5 text-[#B4916C] mr-2" />
              <h2 className="text-lg font-safiro font-medium text-[#F9F6EE]">Upload New CV</h2>
            </div>
            <CVUploader />
          </ErrorBoundaryWrapper>
        </AnimatedContainer>
        
        {/* Feature Links */}
        <AnimatedContainer animationType="slide" delay={0.3} duration={0.4}>
          <h2 className="text-lg font-safiro font-medium text-[#F9F6EE] mb-3">Tools & Features</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FeatureCard 
              href="/dashboard/optimize"
              icon={BarChart2}
              title="Optimize CV"
              description="Analyze & optimize for ATS"
            />
            
            <FeatureCard 
              href="/dashboard/enhance"
              icon={FileText}
              title="Document Editor"
              description="Edit with AI assistance"
            />
            
            <FeatureCard 
              href="/dashboard/analyze"
              icon={PieChart}
              title="Document Analysis"
              description="Extract insights & visualize data"
            />
            
            <FeatureCard 
              href="/job-description"
              icon={FileText}
              title="Job Description Generator"
              description="Create detailed job descriptions"
            />
            
            <FeatureCard 
              href="/job-match"
              icon={BarChart2}
              title="CV to Job Match"
              description="Analyze CV against job descriptions"
            />
            
            <FeatureCard 
              href="/dashboard/jobs"
              icon={Briefcase}
              title="Find Matching Jobs"
              description="Discover jobs that match your CV"
              fullWidth
            />
          </div>
        </AnimatedContainer>
      </div>
    </>
  );
}
