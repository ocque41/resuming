"use client";

import { Check, Star, ArrowRight, Loader2, AlertTriangle } from "lucide-react";
import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { usePricing } from './PricingContext';

interface PricingCardClientProps {
  name: string;
  price: number;
  interval: string;
  features: string[];
  highlight: boolean;
  priceId?: string;
  tooltips?: Record<string, string>;
  animationDelay?: number;
}

export default function PricingCardClient({
  name,
  price,
  interval,
  features,
  highlight,
  priceId,
  tooltips,
  animationDelay = 0
}: PricingCardClientProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCurrentPlan, setIsCurrentPlan] = useState(false);
  const { prices, products, error: pricingError } = usePricing();

  // Check if this is the user's current plan
  useEffect(() => {
    const checkCurrentPlan = async () => {
      try {
        const response = await fetch('/api/user/subscription');
        if (!response.ok) {
          throw new Error('Failed to fetch subscription details');
        }
        
        const data = await response.json();
        // Check if the current plan matches this card's plan
        setIsCurrentPlan(data.planName === name || 
          // Also check if this is the Pro plan and user has Free plan
          (name === "Pro" && data.planName === "Free"));
      } catch (err) {
        console.error('Error checking subscription:', err);
        // Default to Free plan if there's an error
        setIsCurrentPlan(name === "Pro");
      }
    };

    checkCurrentPlan();
  }, [name]);

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // If it's the current plan, no checkout needed
    if (isCurrentPlan) {
      return;
    }
    
    setIsLoading(true);
    setError(null);

    try {
      console.log('Initiating checkout for price ID:', priceId);
      
      // Create form data
      const formData = new FormData();
      formData.append('priceId', highlight ? 'price_1R5vvRFYYYXM77wG8jVM2pGC' : (priceId || ''));
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

  const cardVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: {
        duration: 0.5,
        delay: animationDelay,
        ease: [0.22, 1, 0.36, 1]
      }
    },
    hover: { 
      y: -8,
      transition: {
        duration: 0.3,
        ease: "easeOut"
      }
    }
  };

  return (
    <motion.div
      className={`rounded-xl overflow-hidden transition-all duration-300 ${
        highlight 
          ? "border border-[#B4916C] bg-[#0A0A0A]" 
          : "border border-[#222222] bg-[#111111]"
      }`}
      variants={cardVariants}
      initial="hidden"
      animate="visible"
      whileHover="hover"
    >
      <div className={`${
        highlight 
          ? "bg-gradient-to-r from-[#B4916C]/30 to-[#B4916C]/10" 
          : "bg-[#0D0D0D]"
        } py-6 px-6 relative overflow-hidden`}
      >
        {highlight && (
          <Star className="absolute top-3 right-3 h-5 w-5 text-[#B4916C]" />
        )}
        <h2 className="text-2xl font-bold font-safiro text-[#F9F6EE] mb-2 tracking-tight">
          {name}
          {highlight && (
            <>
              <span className="ml-2 text-xs bg-[#B4916C]/20 text-[#B4916C] px-2 py-1 rounded-full font-borna">
                Most Popular
              </span>
              <div className="mt-1 text-sm text-[#C5C2BA] font-borna">
                Upgrade from Pro to unlock all features
              </div>
            </>
          )}
        </h2>
        <p className="text-4xl font-bold font-safiro text-[#F9F6EE] mb-2 tracking-tight">
          {price === 0 ? (
            "FREE"
          ) : (
            <>
              ${(price || 0) / 100}
              <span className="text-xl font-normal text-[#8A8782] ml-1 font-borna">
                /{interval}
              </span>
            </>
          )}
        </p>
        
        {isCurrentPlan && (
          <div className="absolute top-0 right-0 mt-2 mr-2">
            <span className="bg-green-500/20 text-green-400 px-2 py-1 text-xs rounded-full font-borna">
              Current Plan
            </span>
          </div>
        )}
        
        {highlight && (
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
        )}
      </div>
      
      <div className="p-6 flex flex-col h-full">
        <ul className="space-y-4 flex-grow mb-8">
          {features.map((feature, index) => (
            <li key={index} className="flex items-start group relative">
              <div className={`h-5 w-5 mr-3 rounded-full flex items-center justify-center flex-shrink-0 ${
                highlight ? "text-[#B4916C] bg-[#B4916C]/10" : "text-[#8A8782] bg-[#222222]"
              }`}>
                <Check className="h-3 w-3" />
              </div>
              <span className="text-[#C5C2BA] font-borna text-sm">
                {feature.replace(" ⓘ", "")}
                {tooltips?.[feature] && (
                  <motion.span 
                    className="opacity-0 group-hover:opacity-100 absolute left-0 -top-12 w-64 bg-[#111111] border border-[#222222] text-[#8A8782] text-xs p-2 rounded-lg z-10 transition-opacity duration-200"
                    initial={{ opacity: 0, y: 10 }}
                    whileHover={{ opacity: 1, y: 0 }}
                  >
                    {tooltips[feature]}
                  </motion.span>
                )}
              </span>
            </li>
          ))}
        </ul>
        
        {error && (
          <div className="text-red-400 text-sm mb-4 p-3 bg-red-500/10 rounded-lg flex items-start border border-red-900/30">
            <AlertTriangle className="h-4 w-4 mr-2 mt-0.5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}
        
        <form onSubmit={handleCheckout} className="w-full mt-auto">
          <Button
            type="submit"
            disabled={isLoading || isCurrentPlan}
            className={`w-full font-medium font-safiro h-12 ${
              highlight
                ? "bg-[#B4916C] hover:bg-[#A3815B] text-[#050505] rounded-xl py-6 flex items-center justify-center transition-colors duration-300 text-base shadow-lg border-none"
                : "bg-[#222222] hover:bg-[#333333] text-[#F9F6EE] border border-[#333333]"
            }`}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : isCurrentPlan ? (
              "Current Plan"
            ) : (
              <>
                {highlight ? (
                  <>
                    <span className="font-safiro">Upgrade Now</span>
                    <motion.div
                      initial={{ x: 0 }}
                      whileHover={{ x: 4 }}
                      transition={{ duration: 0.2 }}
                    >
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </motion.div>
                  </>
                ) : (
                  "Select Plan"
                )}
              </>
            )}
          </Button>
        </form>
      </div>
    </motion.div>
  );
} 