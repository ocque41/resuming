"use client";

import { Suspense } from "react";
import { Check, AlertTriangle, Loader2, Star } from "lucide-react";
import { PremiumCard, PremiumCardContent } from "@/components/ui/premium-card";
import { motion } from "framer-motion";
import dynamic from 'next/dynamic';
import PricingErrorBoundary from './PricingErrorBoundary';
import { PricingProvider } from './PricingContext';
import { useState, useEffect } from "react";

// Dynamically import the Pro plan component (hidden by default)
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
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPlan, setCurrentPlan] = useState<string>('Pro');

  // Fetch user's current plan
  useEffect(() => {
    const fetchUserPlan = async () => {
      try {
        const response = await fetch('/api/user/subscription');
        if (response.ok) {
          const data = await response.json();
          setCurrentPlan(data.planName || 'Pro');
        }
      } catch (err) {
        console.error('Error fetching subscription:', err);
      }
    };
    fetchUserPlan();
  }, []);

  // Find Pro pricing data
  const proProduct = products.find((product) => product.name === "Pro") || { id: "pro-fallback", name: "Pro" };
  const proPrice =
    prices.find((price) => price.productId === proProduct.id) || {
      id: "price_pro_fallback",
      productId: proProduct.id,
      unitAmount: 0,
      interval: 'week'
    };

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
              </motion.p>
            </section>

            <PricingProvider prices={prices} products={products} error={pricingError}>
              <PricingErrorBoundary>
                <div className="grid gap-8 justify-center max-w-4xl mx-auto">
                  {/* Only Pro Plan Card */}
                  <motion.div
                    className="rounded-xl overflow-hidden transition-all duration-300 border border-[#222222] bg-[#111111]"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.2 }}
                    whileHover={{ y: -8, transition: { duration: 0.3, ease: "easeOut" } }}
                  >
                    <div className="bg-[#0D0D0D] py-6 px-6 relative overflow-hidden">
                      <h2 className="text-2xl font-bold font-safiro text-[#F9F6EE] mb-2 tracking-tight">Pro</h2>
                      <p className="text-4xl font-bold font-safiro text-[#F9F6EE] mb-2 tracking-tight">
                        {proPrice.unitAmount ? proPrice.unitAmount / 100 : 0}
                        <span className="text-xl font-normal text-[#8A8782] ml-1 font-borna">/{proPrice.interval}</span>
                      </p>
                      {currentPlan === "Pro" && (
                        <div className="absolute top-0 right-0 mt-2 mr-2">
                          <span className="bg-green-500/20 text-green-400 px-2 py-1 text-xs rounded-full font-borna">Current Plan</span>
                        </div>
                      )}
                    </div>
                    <div className="p-6 flex flex-col h-full">
                      <ul className="space-y-4 flex-grow mb-8">
                        {[
                          "Optimize CV (i)",
                          "Document Analysis (i)",
                          "Job Description Generator (i)",
                          "CV to Job Match (i)"
                        ].map((feature, index) => (
                          <li key={index} className="flex items-start group relative">
                            <div className="h-5 w-5 mr-3 rounded-full flex items-center justify-center flex-shrink-0 text-[#8A8782] bg-[#222222]">
                              <Check className="h-3 w-3" />
                            </div>
                            <span className="text-[#C5C2BA] font-borna text-sm">{feature.replace(" (i)", "")}</span>
                          </li>
                        ))}
                      </ul>
                      <div className="w-full">
                        <button
                          onClick={() => {} }
                          disabled
                          className="w-full font-medium font-safiro h-12 bg-[#222222] text-[#F9F6EE] border border-[#333333] rounded-lg cursor-default"
                        >{currentPlan === "Pro" ? "Current Plan" : "Select Plan"}</button>
                      </div>
                    </div>
                  </motion.div>
                </div>
              </PricingErrorBoundary>
            </PricingProvider>
          </div>
        </PremiumCardContent>
      </PremiumCard>
    </Suspense>
  );
}

// Page skeleton loader for the pricing page
export function PricingPageSkeleton() {
  return (
    <div className="animate-pulse space-y-8">
      <div className="h-12 bg-[#161616] rounded-lg w-3/4 mb-6"></div>
      <div className="h-6 bg-[#161616] rounded-lg w-1/2 mb-8"></div>
      <div className="grid gap-8">
        <PricingCardSkeleton />
      </div>
    </div>
  );
}

// Individual pricing card skeleton for loading state
function PricingCardSkeleton({ highlight = false }) {
  return (
    <div
      className={`rounded-xl overflow-hidden border ${
        highlight ? "border-[#B4916C] bg-[#0A0A0A]" : "border-[#222222] bg-[#111111]"
      }`}
    >
      <div
        className={`${
          highlight ? "bg-gradient-to-r from-[#B4916C]/30 to-[#B4916C]/10" : "bg-[#0D0D0D]"
        } py-6 px-6 relative`}
      >
        <div className="h-8 bg-[#161616] rounded-lg w-1/2 mb-3"></div>
        <div className="h-8 bg-[#161616] rounded-lg w-3/4"></div>
      </div>
      <div className="p-6 space-y-6">
        <div className="space-y-3">
          {[1, 2, 3, 4].map((j) => (
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

