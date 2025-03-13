import { redirect } from "next/navigation";
import { getUser, getCVsForUser } from "@/lib/db/queries.server";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import EnhancedSpecificOptimizationWorkflow from "../../components/EnhancedSpecificOptimizationWorkflow.client";

export default async function SpecificOptimizePage() {
  const user = await getUser();
  if (!user) {
    redirect("/sign-in");
  }

  // Fetch CVs for the user
  const cvs = await getCVsForUser(user.id);
  const formattedCvs = cvs.map((cv: any) => ({
    id: cv.id,
    name: cv.fileName
  }));
  
  return (
    <div className="min-h-screen bg-[#050505] text-white">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 relative">
        {/* Header with back button and title */}
        <header className="flex items-center mb-8">
          <Link 
            href="/dashboard" 
            className="flex items-center justify-center h-10 w-10 rounded-md bg-black hover:bg-[#1D1D1D] text-[#B4916C] mr-4 transition-colors"
            aria-label="Back to dashboard"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="text-2xl font-bold text-white">
            Specific CV Optimization
          </h1>
        </header>
        
        <EnhancedSpecificOptimizationWorkflow cvs={formattedCvs} />
      </div>
    </div>
  );
} 