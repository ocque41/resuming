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
    <div className="container mx-auto py-6 max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">CV Optimization</h1>
          <p className="text-gray-400 mt-1">Analyze and optimize your CV for ATS compatibility</p>
        </div>
        <Link href="/dashboard" className="flex items-center text-gray-400 hover:text-white">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Dashboard
        </Link>
      </div>
      
      <ErrorBoundaryWrapper>
        <OptimizationWorkflow cvs={formattedCvs} />
      </ErrorBoundaryWrapper>
    </div>
  );
} 