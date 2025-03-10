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
    <div className="min-h-screen bg-black text-white">
      <div className="px-4 py-4 max-w-md mx-auto">
        {/* Back button */}
        <div className="mb-6 flex items-center">
          <Link 
            href="/dashboard" 
            className="flex items-center text-gray-400 hover:text-[#B4916C] transition-colors"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            <span>Back to Dashboard</span>
          </Link>
        </div>
        
        <h1 className="text-xl md:text-2xl font-bold mb-4 text-center">Optimize Your CV</h1>
        
        <ErrorBoundaryWrapper>
          <OptimizationWorkflow cvs={formattedCvs} />
        </ErrorBoundaryWrapper>
      </div>
    </div>
  );
} 