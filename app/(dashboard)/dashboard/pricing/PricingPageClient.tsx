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
  const freePlan = products.find((product) => product.name === "Pro") || 
    { id: "free-fallback", name: "Pro" };
  
  const moonlightingPlan = products.find((product) => product.name === "Moonlighting") || 
    { id: "moonlighting-fallback", name: "Moonlighting" };
  
  const freePrice = prices.find((price) => price.productId === freePlan?.id) || 
    { id: "price_free", productId: "free-fallback", unitAmount: 0 };
  
  const moonlightingPrice = prices.find((price) => price.productId === moonlightingPlan?.id) || 
    { id: "price_1R5vvRFYYYXM77wG8jVM2pGC", productId: "moonlighting-fallback", unitAmount: 1499 };

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
                <div className="grid md:grid-cols-2 gap-8 justify-center max-w-4xl mx-auto">
                  <PricingCardClient
                    name="Pro"
                    price={0}
                    interval="month"
                    features={[
                      "Optimize CV ⓘ",
                      "Document Analysis ⓘ",
                      "Job Description Generator ⓘ",
                      "CV to Job Match ⓘ",
                      "Job Opportunities ⓘ",
                    ]}
                    tooltips={{
                      "Optimize CV ⓘ": "Analyze & optimize for ATS",
                      "Document Analysis ⓘ": "Extract insights & visualize data",
                      "Job Description Generator ⓘ": "Create detailed job descriptions",
                      "CV to Job Match ⓘ": "Analyze CV against job descriptions",
                      "Job Opportunities ⓘ": "Discover the best jobs you can get now with your current CV",
                    }}
                    highlight={false}
                    priceId={freePrice?.id}
                    animationDelay={0.2}
                  />
                  <PricingCardClient
                    name="Moonlighting"
                    price={1499}
                    interval="month"
                    features={[
                      "Everything in Pro Plan ⓘ",
                      "Unlimited Access to Create Suite ⓘ",
                      "Access to Remin Agent ⓘ",
                    ]}
                    tooltips={{
                      "Everything in Pro Plan ⓘ": "All features from the Pro plan included",
                      "Unlimited Access to Create Suite ⓘ": "Unlimited access to the Create suite for advanced content creation",
                      "Access to Remin Agent ⓘ": "Access the unlimited power of \"Remin\" the most powerful Agent",
                    }}
                    highlight={true}
                    priceId="price_1R5vvRFYYYXM77wG8jVM2pGC"
                    animationDelay={0.3}
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