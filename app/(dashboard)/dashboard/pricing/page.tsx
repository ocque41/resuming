import { redirect } from "next/navigation";
import { getUser, getTeamForUser, getActivityLogs } from "@/lib/db/queries.server";
import { Check, ArrowLeft, Star, AlertTriangle } from "lucide-react";
import { getStripePrices, getStripeProducts } from "@/lib/payments/stripe";
import { ArticleTitle } from "@/components/ui/article";
import { PremiumCard, PremiumCardHeader, PremiumCardTitle, PremiumCardContent } from "@/components/ui/premium-card";
import PremiumPageLayout from "@/components/PremiumPageLayout";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { Suspense } from "react";
import dynamic from 'next/dynamic';

// Import our error boundary and context for pricing components
import PricingErrorBoundary from './PricingErrorBoundary';
import { PricingProvider } from './PricingContext';

// Dynamically import the client component to avoid server/client boundary issues
const PricingCardClient = dynamic(
  () => import('./PricingCardClient'),
  { 
    ssr: false,
    loading: () => <PricingCardSkeleton highlight={false} /> 
  }
);

// Define types for Stripe data
interface StripePrice {
  id: string;
  productId: string;
  unitAmount: number | null;
  currency?: string;
  interval?: string;
  trialPeriodDays?: number | null;
}

interface StripeProduct {
  id: string;
  name: string;
}

// Define type for activity logs
interface ActivityLog {
  id: number;
  action: string;
  timestamp: Date;
  ipAddress: string | null;
  userName: string | null;
  [key: string]: any;
}

// Create fallback data for static rendering
const fallbackPrices: StripePrice[] = [
  { id: "price_1QoUP9FYYYXM77wGBUVqTaiE", productId: "pro-fallback", unitAmount: 799 },
  { id: "price-moonlighting-fallback", productId: "moonlighting-fallback", unitAmount: 1499 },
  { id: "price_1QoYTrFYYYXM77wGffciG20i", productId: "ceo-fallback", unitAmount: 9999 }
];

const fallbackProducts: StripeProduct[] = [
  { id: "pro-fallback", name: "Pro" },
  { id: "moonlighting-fallback", name: "Moonlighting" },
  { id: "ceo-fallback", name: "CEO" }
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
    let prices: StripePrice[] = [];
    let products: StripeProduct[] = [];
    let pricingError: string | null = null;
    
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

    // Ensure we have fallbacks for all data
    const proPlan = products.find((product) => product.name === "Pro") || fallbackProducts[0];
    const moonlightingPlan = products.find((product) => product.name === "Moonlighting") || fallbackProducts[1];
    const ceoPlan = products.find((product) => product.name === "CEO") || fallbackProducts[2];

    const proPrice = prices.find((price) => price.productId === proPlan?.id) || fallbackPrices[0];
    const moonlightingPrice = prices.find((price) => price.productId === moonlightingPlan?.id) || fallbackPrices[1];
    const ceoPrice = prices.find((price) => price.productId === ceoPlan?.id) || fallbackPrices[2];

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
          <PremiumCard className="mb-8 border border-[#222222] bg-[#0D0D0D]">
            <PremiumCardContent className="px-6 py-8">
              <div className="max-w-5xl mx-auto space-y-8">
                <section className="space-y-6">
                  <motion.h2 
                    className="text-4xl font-bold font-safiro text-[#F9F6EE] tracking-tight"
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                  >
                    Choose Your <span className="text-[#B4916C]">Premium</span> Plan
                  </motion.h2>
                  <motion.p 
                    className="text-lg text-[#C5C2BA] font-borna"
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.1 }}
                  >
                    Upgrade your subscription to unlock more features and capabilities.
                    Change plans as you grow.
                  </motion.p>
                </section>

                <PricingProvider 
                  prices={prices} 
                  products={products}
                  error={pricingError}
                >
                  <PricingErrorBoundary>
                    <div className="grid md:grid-cols-3 gap-8 justify-center">
                      <PricingCardClient
                        name="Pro"
                        price={proPrice?.unitAmount || 799}
                        interval="month"
                        features={[
                          "20 CV uploads/month ⓘ",
                          "10 ATS analyses/month ⓘ",
                          "7 Optimizations/month ⓘ",
                          "Priority 2 in AI processing ⓘ",
                        ]}
                        tooltips={{
                          "20 CV uploads/month ⓘ": "Upload up to 20 different CVs each month",
                          "10 ATS analyses/month ⓘ": "Get ATS compatibility analysis for 10 CVs monthly",
                          "7 Optimizations/month ⓘ": "Receive AI-powered optimization suggestions 7 times per month",
                          "Priority 2 in AI processing ⓘ": "Your requests are processed with priority level 2",
                        }}
                        highlight={false}
                        priceId={proPrice?.id}
                        animationDelay={0.2}
                      />
                      <PricingCardClient
                        name="Moonlighting"
                        price={moonlightingPrice?.unitAmount || 1499}
                        interval="month"
                        features={[
                          "Unlimited CV uploads/month ⓘ",
                          "20 ATS analyses/month ⓘ",
                          "15 Optimizations/month ⓘ",
                          "Access to Analytics Suite ⓘ",
                        ]}
                        tooltips={{
                          "Unlimited CV uploads/month ⓘ": "Upload as many CVs as you need without any monthly limits",
                          "20 ATS analyses/month ⓘ": "Get detailed analysis of how your CV performs against ATS systems",
                          "15 Optimizations/month ⓘ": "AI-powered suggestions to improve your CV structure and content",
                          "Access to Analytics Suite ⓘ": "Advanced metrics and insights about your CV performance",
                        }}
                        highlight={true}
                        priceId={moonlightingPrice?.id}
                        animationDelay={0.3}
                      />
                      <PricingCardClient
                        name="CEO"
                        price={ceoPrice?.unitAmount || 9999}
                        interval="month"
                        features={[
                          "Unlimited CV uploads ⓘ",
                          "Unlimited ATS analyses ⓘ",
                          "Unlimited Optimizations ⓘ",
                          "Access to Analytics Suite ⓘ",
                          "Early access to new features ⓘ",
                        ]}
                        tooltips={{
                          "Unlimited CV uploads ⓘ": "No monthly limit on CV uploads",
                          "Unlimited ATS analyses ⓘ": "Analyze your CVs against ATS systems as many times as you need",
                          "Unlimited Optimizations ⓘ": "Get unlimited AI-powered optimization suggestions",
                          "Access to Analytics Suite ⓘ": "Full access to advanced analytics and insights",
                          "Early access to new features ⓘ": "Be the first to try new platform features",
                        }}
                        highlight={false}
                        priceId={ceoPrice?.id}
                        animationDelay={0.4}
                      />
                    </div>
                  </PricingErrorBoundary>
                </PricingProvider>
              </div>
            </PremiumCardContent>
          </PremiumCard>
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

// Individual pricing card skeleton for loading state
function PricingCardSkeleton({ highlight = false }) {
  return (
    <div 
      className={`rounded-xl overflow-hidden border ${
        highlight 
          ? "border-[#B4916C] bg-[#0A0A0A]" 
          : "border-[#222222] bg-[#111111]"
      }`}
    >
      <div className={`${
        highlight 
          ? "bg-gradient-to-r from-[#B4916C]/30 to-[#B4916C]/10" 
          : "bg-[#0D0D0D]"
        } py-6 px-6 relative`}
      >
        <div className="h-8 bg-[#161616] rounded-lg w-1/2 mb-3"></div>
        <div className="h-8 bg-[#161616] rounded-lg w-3/4"></div>
      </div>
      <div className="p-6 space-y-6">
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((j) => (
            <div key={j} className="h-5 bg-[#161616] rounded-lg flex items-center">
              <div className="h-4 w-4 bg-[#222222] rounded-full mr-3"></div>
              <div className="h-4 bg-[#161616] rounded-lg w-full"></div>
            </div>
          ))}
        </div>
        <div className="h-10 bg-[#161616] rounded-lg w-full"></div>
      </div>
    </div>
  );
}

// Page skeleton loader for the pricing page
function PricingPageSkeleton() {
  return (
    <div className="animate-pulse space-y-8">
      <div className="h-12 bg-[#161616] rounded-lg w-3/4 mb-6"></div>
      <div className="h-6 bg-[#161616] rounded-lg w-1/2 mb-8"></div>
      
      <div className="grid md:grid-cols-3 gap-8">
        <PricingCardSkeleton />
        <PricingCardSkeleton highlight={true} />
        <PricingCardSkeleton />
      </div>
    </div>
  );
} 