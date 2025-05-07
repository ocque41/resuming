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
  const [currentUserPlan, setCurrentUserPlan] = useState<string>('');
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
        setCurrentUserPlan(data.planName || 'Pro');
        setIsCurrentPlan(data.planName === name || (name === 'Pro' && data.planName === 'Free'));
      } catch (err) {
        console.error('Error checking subscription:', err);
        setCurrentUserPlan('Pro');
        setIsCurrentPlan(name === 'Pro');
      }
    };
    checkCurrentPlan();
  }, [name]);

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Regular plan checkout logic (for non-Moonlighting plans)
    // Don't return early if this is a downgrade from Moonlighting to Pro
    if (isCurrentPlan) {
      return;
    }
    
    setIsLoading(true);
    setError(null);

    try {
      console.log('Initiating checkout for:', name, 'Price ID:', priceId);
      
      // Create form data
      const formData = new FormData();
      formData.append('priceId', priceId || '');
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
      className={`rounded-xl overflow-hidden transition-all duration-300 border border-[#222222] bg-[#111111]`}
      variants={cardVariants}
      initial="hidden"
      animate="visible"
      whileHover="hover"
    >
      <div className="bg-[#0D0D0D] py-6 px-6 relative overflow-hidden">
        <h2 className="text-2xl font-bold font-safiro text-[#F9F6EE] mb-2 tracking-tight">{name}</h2>
        <p className="text-4xl font-bold font-safiro text-[#F9F6EE] mb-2 tracking-tight">
          {price === 0 ? (
            "FREE"
          ) : (
            <>
              ${price / 100}
              <span className="text-xl font-normal text-[#8A8782] ml-1 font-borna">/{interval}</span>
            </>
          )}
        </p>
        {isCurrentPlan && (
          <div className="absolute top-0 right-0 mt-2 mr-2">
            <span className="bg-green-500/20 text-green-400 px-2 py-1 text-xs rounded-full font-borna">Current Plan</span>
          </div>
        )}
      </div>
      <ul className="space-y-4 flex-grow mb-8">
        {features.map((feature, index) => (
          <li key={index} className="flex items-start group relative">
            <div className="h-5 w-5 mr-3 rounded-full flex items-center justify-center flex-shrink-0 text-[#8A8782] bg-[#222222]">
              <Check className="h-3 w-3" />
            </div>
            <span className="text-[#C5C2BA] font-borna text-sm">{feature}</span>
          </li>
        ))}
      </ul>
      <div className="w-full">
        <button
          onClick={() => {}}
          disabled
          className="w-full font-medium font-safiro h-12 bg-[#222222] text-[#F9F6EE] border border-[#333333] rounded-lg cursor-default"
        >{isCurrentPlan ? "Current Plan" : "Select Plan"}</button>
      </div>
    </motion.div>
  );
} 