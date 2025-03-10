import { redirect } from "next/navigation";
import { getUser, getTeamForUser, getCVsForUser } from "@/lib/db/queries.server";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import Link from "next/link";
import { ArrowLeft, BarChart2, FileText } from "lucide-react";
import AnalyzeCVCard from "@/components/AnalyzeCVCard.client";
import EnhancedOptimizeCVCard from "@/components/EnhancedOptimizeCVCard.client";
import ErrorBoundaryWrapper from "@/components/ErrorBoundaryWrapper";
import OptimizationWorkflow from "@/components/OptimizationWorkflow.client";

export default async function OptimizePage() {
  const user = await getUser();
  if (!user) {
    redirect("/sign-in");
  }
  
  const teamData = await getTeamForUser(user.id);
  if (!teamData) {
    throw new Error("Team not found");
  }
  
  const cvs = await getCVsForUser(user.id);
  const formattedCvs = cvs.map((cv: any) => `${cv.fileName}|${cv.id}`);
  
  return (
    <>
      <header className="flex items-center justify-between p-4 mx-auto max-w-sm sm:max-w-md md:max-w-xl lg:max-w-2xl">
        <div className="flex items-center">
          <Link 
            href="/dashboard" 
            className="flex items-center justify-center h-8 w-8 rounded-md bg-black hover:bg-[#1D1D1D] text-[#B4916C] mr-4 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <h1 className="text-lg lg:text-xl font-medium text-white">
            Optimize Your CV
          </h1>
        </div>
      </header>
      
      <div className="flex flex-col space-y-6 mx-auto max-w-sm sm:max-w-md md:max-w-xl lg:max-w-2xl px-2 sm:px-4 md:px-6 pb-12">
        <Card className="border border-[#B4916C]/20 bg-black shadow-lg">
          <CardHeader>
            <CardTitle className="text-xl font-bold text-[#B4916C]">CV Optimization Suite</CardTitle>
            <CardDescription className="text-gray-400">
              Analyze and optimize your CV to maximize your chances of landing interviews
            </CardDescription>
          </CardHeader>
          
          <CardContent className="p-4 md:p-6">
            <p className="mb-6 text-gray-300">
              Our AI-powered tools help you understand your CV's strengths and weaknesses, 
              optimize for ATS systems, and create professionally formatted documents that stand out 
              to recruiters and hiring managers.
            </p>
            
            <ErrorBoundaryWrapper>
              <OptimizationWorkflow cvs={formattedCvs} />
            </ErrorBoundaryWrapper>
          </CardContent>
        </Card>
      </div>
    </>
  );
} 