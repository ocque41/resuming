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
    <div className="min-h-screen bg-[#050505] text-white">
      <div className="max-w-3xl mx-auto px-6 sm:px-8 py-8 relative">
        {/* Back button - simple arrow */}
        <div className="absolute top-6 left-4">
          <Link 
            href="/dashboard" 
            className="inline-flex items-center justify-center h-10 w-10 rounded-full hover:bg-gray-800 text-gray-400 hover:text-[#B4916C] transition-colors"
            aria-label="Back to dashboard"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </div>
        
        <h1 className="text-2xl md:text-3xl font-extrabold mb-10 text-center mt-4">
          Optimize Your CV
        </h1>
        
        <div className="mt-6">
          <ErrorBoundaryWrapper>
            <OptimizationWorkflow cvs={formattedCvs} />
          </ErrorBoundaryWrapper>
        </div>
      </div>
    </div>
  );
} 