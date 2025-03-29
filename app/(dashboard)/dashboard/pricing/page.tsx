import { redirect } from "next/navigation";
import { getUser, getTeamForUser, getActivityLogs } from "@/lib/db/queries.server";
import { AlertTriangle, ArrowLeft } from "lucide-react";
import { getStripePrices, getStripeProducts } from "@/lib/payments/stripe";
import PremiumPageLayout from "@/components/PremiumPageLayout";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Suspense } from "react";

// Import the client component for rendering the pricing UI
import PricingPageClient, { PricingPageSkeleton } from './PricingPageClient';
import UpgradeButton from './UpgradeButton';

// Define types for data
interface ActivityLog {
  id: number;
  action: string;
  timestamp: Date;
  ipAddress: string | null;
  userName: string | null;
  [key: string]: any;
}

// Create fallback data for static rendering
const fallbackPrices = [
  { id: "price_free", productId: "free-fallback", unitAmount: 0 },
  { id: "price-moonlighting-fallback", productId: "moonlighting-fallback", unitAmount: 1499 }
];

const fallbackProducts = [
  { id: "free-fallback", name: "Free" },
  { id: "moonlighting-fallback", name: "Moonlighting" }
];

// Revalidate prices every hour
export const revalidate = 3600;

export default async function DashboardPricingPage() {
  try {
    // Ensure user is authenticated
    const user = await getUser();
    if (!user) {
      redirect("/sign-in");
    }

    let teamData;
    try {
      teamData = await getTeamForUser(user.id);
      if (!teamData) {
        console.warn("Team not found, using fallback team data");
        teamData = { id: "fallback", name: "Your Team" };
      }
    } catch (error) {
      console.error("Error fetching team data:", error);
      teamData = { id: "fallback", name: "Your Team" };
    }
    
    let activityLogs: ActivityLog[] = [];
    try {
      activityLogs = await getActivityLogs();
    } catch (error) {
      console.error("Error fetching activity logs:", error);
    }
    
    // Safely fetch data with fallbacks
    let prices = [];
    let products = [];
    let pricingError = null;
    
    try {
      // Attempt to fetch real Stripe data
      const [fetchedPrices, fetchedProducts] = await Promise.all([
        getStripePrices(),
        getStripeProducts(),
      ]);
      
      // Only use fetched data if it's valid
      if (fetchedPrices && fetchedPrices.length > 0) {
        prices = fetchedPrices;
      } else {
        prices = fallbackPrices;
      }
      
      if (fetchedProducts && fetchedProducts.length > 0) {
        products = fetchedProducts;
      } else {
        products = fallbackProducts;
      }
    } catch (error) {
      console.error("Error fetching Stripe data:", error);
      // Use fallback data
      prices = fallbackPrices;
      products = fallbackProducts;
      pricingError = error instanceof Error ? error.message : "Failed to load pricing data";
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
        activityLogs={activityLogs}
        maxWidth="6xl"
      >
        <Suspense fallback={<PricingPageSkeleton />}>
          {/* Pass data to client component */}
          <PricingPageClient 
            prices={prices} 
            products={products} 
            pricingError={pricingError}
          />
        </Suspense>
        
        {/* Direct inline upgrade button as a fallback that should work regardless of components */}
        <div style={{
          position: 'relative',
          width: '100%',
          maxWidth: '600px',
          margin: '0 auto',
          marginTop: '20px',
          textAlign: 'center',
          padding: '10px',
          border: '2px solid #B4916C',
          borderRadius: '10px',
          background: '#0A0A0A',
          boxShadow: '0 4px 12px rgba(180, 145, 108, 0.3)'
        }}>
          <h3 style={{
            fontSize: '20px',
            fontWeight: 'bold',
            color: '#F9F6EE',
            marginBottom: '12px'
          }}>
            Upgrade to Moonlighting Plan
          </h3>
          <p style={{
            fontSize: '16px',
            color: '#C5C2BA',
            marginBottom: '16px'
          }}>
            Get access to all premium features for only $14.99/month
          </p>
          <Link href="/api/upgrade-direct?priceId=price_1R5vvRFYYYXM77wG8jVM2pGC">
            <Button className="bg-[#B4916C] hover:bg-[#A3815B] text-[#050505] px-8 py-3 text-xl font-bold rounded-lg">
              UPGRADE NOW
            </Button>
          </Link>
        </div>
        
        {/* Add a standalone upgrade button that will always be visible */}
        <UpgradeButton />
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