"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Check, AlertTriangle } from "lucide-react";
import { motion } from "framer-motion";

interface DirectPricingStatusProps {
  initialPlan?: string;
}
export default function DirectPricingStatus({ initialPlan }: DirectPricingStatusProps) {
  const [currentPlan, setCurrentPlan] = useState<string>(initialPlan ?? "");
  const [isLoading, setIsLoading] = useState(false);
  const [isDowngrading, setIsDowngrading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [planDataFetched, setPlanDataFetched] = useState(!!initialPlan);

  // Fetch user's current plan if no initial plan was provided
  useEffect(() => {
    if (initialPlan) {
      // Plan info already available
      setPlanDataFetched(true);
      return;
    }

    const fetchUserPlan = async () => {
      try {
        const response = await fetch('/api/user/subscription');
        if (response.ok) {
          const data = await response.json();
          console.log('User plan data from API:', data);
          setCurrentPlan(data.planName || 'None');
        } else {
          console.error('Error response from subscription API:', response.status);
          const text = await response.text();
          console.error('Error response text:', text);
        }
      } catch (err) {
        console.error('Error fetching subscription:', err);
      } finally {
        setPlanDataFetched(true);
      }
    };

    fetchUserPlan();
  }, [initialPlan]);

  // Handle downgrade from Pro to free (not used but kept for completeness)
  const handleDowngrade = async () => {
    setIsDowngrading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/user/downgrade', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Failed to downgrade plan' }));
        throw new Error(errorData.message || 'Failed to downgrade plan');
      }

      const data = await response.json();
      if (data.success) {
        // Refresh the page to show updated plan status
        window.location.reload();
      } else {
        throw new Error(data.message || 'Failed to downgrade plan');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      console.error('Downgrade error:', err);
    } finally {
      setIsDowngrading(false);
    }
  };

  // Handle upgrade to Pro plan
  const handleUpgrade = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const proPriceId = process.env.NEXT_PUBLIC_STRIPE_PRO_PRICE_ID;
      if (!proPriceId) {
        throw new Error('Pro plan price ID not configured');
      }
      console.log('Initiating Pro checkout, Price ID:', proPriceId);
      
      // Create form data
      const formData = new FormData();
      formData.append('priceId', proPriceId);
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

  // If we haven't fetched plan data yet, show a loading state
  if (!planDataFetched) {
    return (
      <div className="flex flex-col items-center justify-center p-8 bg-black/20 rounded-xl">
        <Loader2 className="h-8 w-8 text-[#B4916C] animate-spin" />
        <p className="mt-4 text-[#F9F6EE] font-borna">Loading your subscription data...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-8 bg-black/20 rounded-xl border border-[#333333]">
      <div className="text-center mb-4">
        <h3 className="text-2xl font-bold text-[#F9F6EE] font-safiro mb-2">
          Your Current Plan: <span className="text-[#B4916C]">{currentPlan}</span>
        </h3>
        <p className="text-[#C5C2BA] font-borna">
          {currentPlan === "Pro"
            ? "You currently have access to all premium features."
            : "Upgrade to Pro to access all premium features."}
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        {/* Pro Plan Card */}
        <div className="rounded-xl overflow-hidden border border-[#222222] bg-[#111111]">
          <div className="bg-[#0D0D0D] py-6 px-6 relative">
            <h3 className="text-2xl font-bold text-[#F9F6EE] font-safiro mb-2">Pro Plan</h3>
            <p className="text-3xl font-bold text-[#F9F6EE] font-safiro">2.47<span className="text-lg ml-1">/week</span></p>
            {currentPlan === "Pro" && (
              <div className="absolute top-0 right-0 mt-2 mr-2">
                <span className="bg-green-500/20 text-green-400 px-2 py-1 text-xs rounded-full font-borna">
                  Current Plan
                </span>
              </div>
            )}
          </div>
          <ul className="space-y-4 mb-6">
            {[
              { name: "Optimize CV", desc: "Analyze & optimize for ATS (i)" },
              { name: "Document Analysis", desc: "Extract insights & visualize data (i)" },
              { name: "Job Description Generator", desc: "Create detailed job descriptions (i)" },
              { name: "CV to Job Match", desc: "Analyze CV against job descriptions (i)" }
            ].map((feature, i) => (
              <li key={i} className="flex items-start">
                <div className="h-5 w-5 mr-3 rounded-full flex items-center justify-center flex-shrink-0 text-[#8A8782] bg-[#222222] mt-0.5">
                  <Check className="h-3 w-3" />
                </div>
                <div>
                  <span className="text-[#C5C2BA] font-borna text-sm block">{feature.name}</span>
                  <span className="text-[#8A8782] font-borna text-xs block mt-0.5">{feature.desc}</span>
                </div>
              </li>
            ))}
          </ul>
          {currentPlan === "Pro" ? (
            <div className="w-full h-12 bg-[#222222] flex items-center justify-center text-green-400 border border-[#333333] rounded-md">
              Current Plan
            </div>
          ) : (
            <Button
              onClick={handleUpgrade}
              className="w-full font-medium h-12 bg-[#222222] hover:bg-[#333333] text-[#F9F6EE] border border-[#333333]"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Redirecting...
                </>
              ) : (
                'Select Plan'
              )}
            </Button>
          )}
        </div>
      </div>
      
      {error && (
        <div className="text-red-400 text-sm p-3 bg-red-500/10 rounded-lg flex items-start border border-red-900/30 mt-4">
          <AlertTriangle className="h-4 w-4 mr-2 mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}
      
      <div className="mt-4 text-[#8A8782] text-sm font-borna">
        <p>Need help with your subscription? Contact our support team.</p>
      </div>
    </div>
  );
} 