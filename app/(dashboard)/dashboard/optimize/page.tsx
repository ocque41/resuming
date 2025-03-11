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
  
  const userCVs = await getCVsForUser(user.id);
  const formattedCVs = userCVs.map((cv) => `${cv.fileName}|${cv.id}`);
  
  return (
    <div className="w-full max-w-[1400px] mx-auto px-2 sm:px-4 md:px-6">
      <div className="flex items-center mb-6">
        <Link 
          href="/dashboard" 
          className="text-[#B4916C] hover:text-[#9A7A5B] mr-4 flex items-center"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to Dashboard
        </Link>
        <h1 className="text-2xl md:text-3xl font-bold text-white">CV Optimization</h1>
      </div>
      
      <ErrorBoundaryWrapper>
        <OptimizationWorkflow cvs={formattedCVs} />
      </ErrorBoundaryWrapper>
    </div>
  );
} 