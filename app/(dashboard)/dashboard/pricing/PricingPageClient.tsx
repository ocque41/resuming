"use client";

import { Suspense } from "react";
import { Check, AlertTriangle } from "lucide-react";
import { PremiumCard, PremiumCardContent } from "@/components/ui/premium-card";
import { motion } from "framer-motion";
import dynamic from 'next/dynamic';
import PricingErrorBoundary from './PricingErrorBoundary';
import { PricingProvider } from './PricingContext';

// Dynamically import the client component
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

interface PricingPageClientProps {
  prices: StripePrice[];
  products: StripeProduct[];
  pricingError: string | null;
}

export default function PricingPageClient({ 
  prices, 
  products, 
  pricingError 
}: PricingPageClientProps) {
  // Ensure we have fallbacks for all data
  const proPlan = products.find((product) => product.name === "Pro") || 
    { id: "pro-fallback", name: "Pro" };
  
  const moonlightingPlan = products.find((product) => product.name === "Moonlighting") || 
    { id: "moonlighting-fallback", name: "Moonlighting" };
  
  const ceoPlan = products.find((product) => product.name === "CEO") || 
    { id: "ceo-fallback", name: "CEO" };

  const proPrice = prices.find((price) => price.productId === proPlan?.id) || 
    { id: "price_1QoUP9FYYYXM77wGBUVqTaiE", productId: "pro-fallback", unitAmount: 799 };
  
  const moonlightingPrice = prices.find((price) => price.productId === moonlightingPlan?.id) || 
    { id: "price-moonlighting-fallback", productId: "moonlighting-fallback", unitAmount: 1499 };
  
  const ceoPrice = prices.find((price) => price.productId === ceoPlan?.id) || 
    { id: "price_1QoYTrFYYYXM77wGffciG20i", productId: "ceo-fallback", unitAmount: 9999 };

  return (
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
  );
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
export function PricingPageSkeleton() {
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