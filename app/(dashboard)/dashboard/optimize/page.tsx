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
    <div className="min-h-screen bg-black text-white p-4">
      <div className="max-w-sm mx-auto my-8">
        <h1 className="text-2xl mb-4 text-center">Optimize Your CV</h1>
        <OptimizationWorkflow cvs={formattedCvs} />
      </div>
    </div>
  );
} 