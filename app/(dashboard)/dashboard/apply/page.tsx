import { redirect } from "next/navigation";
import { getUser, getTeamForUser } from "@/lib/db/queries.server";
import { AlertTriangle } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Suspense } from "react";
import ApplyPageClient from "./ApplyPageClient";

interface TeamData {
  teamMembers: {
    team?: {
      planName?: string;
      id: number;
      usageBasedPricing?: boolean;
      [key: string]: any;
    };
    user: {
      id: any;
      name: any;
      email: any;
    }[];
    [key: string]: any;
  }[];
  [key: string]: any;
}

export default async function DashboardApplyPage() {
  try {
    // Get current user
    const user = await getUser();
    if (!user) {
      redirect('/sign-in');
    }

    // Get team data for the user
    const teamData = user ? await getTeamForUser(user.id) as unknown as TeamData : null;
    
    // Check if user has usage-based pricing enabled
    const hasUsageBasedPricing = teamData?.teamMembers?.[0]?.team?.usageBasedPricing || false;
    
    return (
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-[#F9F6EE] font-safiro mb-6">Apply to Jobs with AI</h1>
        <p className="text-lg text-[#C5C2BA] font-borna mb-8">
          Let our AI agent apply to LinkedIn jobs that match your CV. Each job application costs $0.99.
        </p>
        
        <Suspense fallback={<div className="animate-pulse bg-[#222] h-64 rounded-xl"></div>}>
          <ApplyPageClient hasUsageBasedPricing={hasUsageBasedPricing} />
        </Suspense>
      </div>
    );
  } catch (error) {
    console.error("Error rendering dashboard apply page:", error);
    
    // Fallback UI in case of any error
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#050505] text-[#F9F6EE] p-6">
        <AlertTriangle className="h-12 w-12 text-[#B4916C] mb-4" />
        <h1 className="text-3xl font-bold mb-4 text-[#F9F6EE] font-safiro">Apply to Jobs</h1>
        <p className="text-lg text-[#C5C2BA] font-borna mb-8 text-center max-w-md">
          We're experiencing some technical difficulties. Please try again later or contact support.
        </p>
        <Link 
          href="/dashboard" 
          className="inline-flex items-center justify-center bg-[#B4916C] hover:bg-[#A3815B] text-[#050505] px-6 py-2 rounded-lg transition-all duration-300 h-12 font-medium"
        >
          Return to Dashboard
        </Link>
      </div>
    );
  }
} 