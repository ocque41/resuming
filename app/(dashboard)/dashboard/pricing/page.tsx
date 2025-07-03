import { redirect } from "next/navigation";
import { getUser, getTeamForUser, getActivityLogs } from "@/lib/db/queries.server";
import { AlertTriangle, ArrowLeft } from "lucide-react";
import { getStripePrices, getStripeProducts } from "@/lib/payments/stripe";
import PremiumPageLayout from "@/components/PremiumPageLayout";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Suspense } from "react";
import PricingPageSkeleton from "./PricingPageSkeleton";
import PricingPageClient from "./PricingPageClient";
import DirectPricingStatus from "./DirectPricingStatus";

// Define types for data
interface ActivityLog {
  id: number;
  action: string;
  timestamp: Date;
  ipAddress: string | null;
  userName: string | null;
  [key: string]: any;
}

// Define team data structure based on the error message
interface TeamData {
  teamMembers: {
    team?: {
      planName?: string;
      id: number;
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

// Create fallback data for static rendering
const fallbackPrices = [
  { id: "price_pro_fallback", productId: "pro-fallback", unitAmount: 247, interval: 'week' }
];

const fallbackProducts = [
  { id: "pro-fallback", name: "Pro" }
];

// Revalidate prices every hour
export const revalidate = 3600;

export default async function DashboardPricingPage() {
  try {
    // Get current user
    const user = await getUser();
    if (!user) {
      redirect('/sign-in');
    }

    // Get required data for the page
    const teamData = user ? await getTeamForUser(user.id) as unknown as TeamData : null;
    
    // Get activity logs for the team menu if available
    let activityLogs: ActivityLog[] = [];
    try {
      activityLogs = await getActivityLogs() as ActivityLog[];
    } catch (error) {
      console.error("Error fetching activity logs:", error);
    }
    
    // Log the team plan data to see what's being provided to the client
    console.log("Server-side team data:", {
      planName: teamData?.teamMembers?.[0]?.team?.planName,
      userId: user.id,
      hasTeam: !!teamData
    });
    
    // Safely fetch data with fallbacks
    let pricingError = null;
    let prices = [];
    let products = [];
    
    try {
      const [pricesData, productsData] = await Promise.all([
        getStripePrices(),
        getStripeProducts()
      ]);
      
      prices = pricesData;
      products = productsData;
    } catch (error) {
      console.error("Error fetching pricing data:", error);
      pricingError = String(error);
    }

    return (
      <PremiumPageLayout
        title="Upgrade Your Plan"
        subtitle="Choose the plan that fits your needs"
        backUrl="/dashboard"
        withGradientBackground
        withScrollIndicator
        animation="fade"
        teamData={teamData}
        activityLogs={activityLogs as ActivityLog[]}
        maxWidth="6xl"
      >
        <Suspense fallback={<PricingPageSkeleton />}>
          {/* Use our new direct status component */}
          <DirectPricingStatus />
          
          {/* Hidden for debugging - old component 
          <PricingPageClient 
            prices={prices} 
            products={products} 
            pricingError={pricingError}
          />
          */}
        </Suspense>
      </PremiumPageLayout>
    );
  } catch (error) {
    console.error("Error rendering dashboard pricing page:", error);
    // Fallback UI in case of any error
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#050505] text-[#F9F6EE] p-6">
        <AlertTriangle className="h-12 w-12 text-[#B4916C] mb-4" />
        <h1 className="text-3xl font-bold mb-4 text-[#F9F6EE] font-safiro">Pricing Plans</h1>
        <p className="text-lg text-[#C5C2BA] font-borna mb-8 text-center max-w-md">
          We're experiencing some technical difficulties. Please try again later or contact support.
        </p>
        <Link 
          href="/dashboard" 
          className="inline-flex items-center justify-center bg-[#B4916C] hover:bg-[#A3815B] text-[#050505] px-6 py-2 rounded-lg transition-all duration-300 h-12 font-medium"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Return to Dashboard
        </Link>
      </div>
    );
  }
} 