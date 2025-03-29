"use client";

import { Suspense } from "react";
import { Check, AlertTriangle, ArrowRight, Loader2, Star } from "lucide-react";
import { PremiumCard, PremiumCardContent } from "@/components/ui/premium-card";
import { motion } from "framer-motion";
import dynamic from 'next/dynamic';
import PricingErrorBoundary from './PricingErrorBoundary';
import { PricingProvider } from './PricingContext';
import { useState } from "react";
import { Button } from "@/components/ui/button";

// Dynamically import the Pro plan component
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
  
  // Ensure we have fallbacks for all data
  const freePlan = products.find((product) => product.name === "Pro") || 
    { id: "free-fallback", name: "Pro" };
  
  const moonlightingPlan = products.find((product) => product.name === "Moonlighting") || 
    { id: "moonlighting-fallback", name: "Moonlighting" };
  
  const freePrice = prices.find((price) => price.productId === freePlan?.id) || 
    { id: "price_free", productId: "free-fallback", unitAmount: 0 };
  
  const moonlightingPrice = prices.find((price) => price.productId === moonlightingPlan?.id) || 
    { id: "price_1R5vvRFYYYXM77wG8jVM2pGC", productId: "moonlighting-fallback", unitAmount: 1499 };
    
  // Handle Moonlighting plan checkout
  const handleMoonlightingCheckout = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Always use the hardcoded Moonlighting price ID
      const moonlightingPriceId = "price_1R5vvRFYYYXM77wG8jVM2pGC";
      console.log('Initiating Moonlighting checkout, Price ID:', moonlightingPriceId);
      
      // Create form data
      const formData = new FormData();
      formData.append('priceId', moonlightingPriceId);
      formData.append('returnUrl', '/dashboard');

      // Submit form to server action
      const response = await fetch('/api/stripe/checkout', {
        method: 'POST',
        body: formData,
        headers: {
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Failed to initiate checkout' }));
        throw new Error(errorData.message || 'Failed to initiate checkout');
      }

      const data = await response.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error('No checkout URL returned');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      console.error('Checkout error:', err);
    } finally {
      setIsLoading(false);
    }
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
                  
                  {/* Custom Moonlighting Card with hardcoded upgrade button */}
                  <motion.div
                    className="rounded-xl overflow-hidden transition-all duration-300 border border-[#B4916C] bg-[#0A0A0A]"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.3 }}
                    whileHover={{ y: -8, transition: { duration: 0.3, ease: "easeOut" } }}
                  >
                    <div className="bg-gradient-to-r from-[#B4916C]/30 to-[#B4916C]/10 py-6 px-6 relative overflow-hidden">
                      <Star className="absolute top-3 right-3 h-5 w-5 text-[#B4916C]" />
                      
                      <h2 className="text-2xl font-bold font-safiro text-[#F9F6EE] mb-2 tracking-tight">
                        Moonlighting
                        <span className="ml-2 text-xs bg-[#B4916C]/20 text-[#B4916C] px-2 py-1 rounded-full font-borna">
                          Most Popular
                        </span>
                        <div className="mt-1 text-sm text-[#C5C2BA] font-borna">
                          Upgrade from Pro to unlock all features
                        </div>
                      </h2>
                      
                      <p className="text-4xl font-bold font-safiro text-[#F9F6EE] mb-2 tracking-tight">
                        $14.99
                        <span className="text-xl font-normal text-[#8A8782] ml-1 font-borna">
                          /month
                        </span>
                      </p>
                      
                      <div className="absolute inset-0 opacity-20 overflow-hidden pointer-events-none">
                        <motion.div
                          className="absolute h-[200%] w-[25%] bg-white top-[-120%] left-[-10%] transform rotate-45 blur-lg"
                          animate={{
                            left: ["0%", "120%"],
                          }}
                          transition={{
                            repeat: Infinity,
                            repeatDelay: 3,
                            duration: 2.5,
                            ease: "easeInOut",
                          }}
                        />
                      </div>
                    </div>
                    
                    <div className="p-6 flex flex-col h-full">
                      <ul className="space-y-4 mb-4">
                        {["Everything in Pro Plan ⓘ", "Unlimited Access to Create Suite ⓘ", "Access to Remin Agent ⓘ"].map((feature, index) => (
                          <li key={index} className="flex items-start group relative">
                            <div className="h-5 w-5 mr-3 rounded-full flex items-center justify-center flex-shrink-0 text-[#B4916C] bg-[#B4916C]/10">
                              <Check className="h-3 w-3" />
                            </div>
                            <span className="text-[#C5C2BA] font-borna text-sm">
                              {feature.replace(" ⓘ", "")}
                            </span>
                          </li>
                        ))}
                      </ul>
                      
                      <div className="text-center mb-3 text-[#B4916C] font-borna">
                        <p>Get access to all premium features today</p>
                      </div>
                      
                      {/* SIMPLE MOONLIGHTING UPGRADE BUTTON */}
                      <div className="mb-4">
                        <button
                          onClick={handleMoonlightingCheckout}
                          disabled={isLoading}
                          style={{
                            width: '100%',
                            padding: '16px 12px',
                            backgroundColor: '#B4916C',
                            color: '#050505',
                            borderRadius: '8px',
                            fontWeight: 'bold',
                            fontSize: '20px',
                            cursor: 'pointer',
                            border: 'none',
                            boxShadow: '0 4px 10px rgba(0, 0, 0, 0.2)'
                          }}
                        >
                          {isLoading ? "Processing..." : "Upgrade"}
                        </button>
                      </div>
                      
                      {error && (
                        <div className="text-red-400 text-sm mb-4 p-3 bg-red-500/10 rounded-lg flex items-start border border-red-900/30">
                          <AlertTriangle className="h-4 w-4 mr-2 mt-0.5 flex-shrink-0" />
                          <span>{error}</span>
                        </div>
                      )}
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