"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Loader2, Star } from "lucide-react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useManageSubscription } from "@/hooks/use-manage-subscription";

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

interface PricingCardProps {
  name: string;
  price: number;
  interval: string;
  features: string[];
  highlight: boolean;
  priceId?: string;
  tooltips?: Record<string, string>;
  animationDelay?: number;
  onCheckout: (priceId: string) => void;
  isCurrentPlan?: boolean;
  canManageSubscription?: boolean;
  onManageSubscription?: () => void;
  isManageLoading?: boolean;
}

interface ClientPricingPageProps {
  prices: StripePrice[];
  products: StripeProduct[];
}

export default function ClientPricingPage({ prices, products }: ClientPricingPageProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [subscriptionStatus, setSubscriptionStatus] = useState<string | null>(null);
  const [currentPlanName, setCurrentPlanName] = useState<string | null>(null);
  const [hasStripeSubscription, setHasStripeSubscription] = useState(false);
  const { openCustomerPortal, isLoading: isOpeningCustomerPortal } = useManageSubscription({
    fallbackPath: "/dashboard/pricing",
  });

  const canManageSubscription = hasStripeSubscription ||
    (subscriptionStatus !== null && subscriptionStatus !== "canceled" && subscriptionStatus !== "unpaid");

  useEffect(() => {
    let isMounted = true;

    const fetchSubscription = async () => {
      try {
        const response = await fetch("/api/user/subscription");
        if (!response.ok) {
          return;
        }

        const data = await response.json();

        if (!isMounted) {
          return;
        }

        const status = typeof data.subscriptionStatus === "string" ? data.subscriptionStatus : null;
        const planName = typeof data.planName === "string" ? data.planName : null;

        setSubscriptionStatus(status);
        setCurrentPlanName(planName);
        setHasStripeSubscription(Boolean(data?.stripeSubscriptionId));
      } catch (error) {
        console.error("Failed to load subscription status", error);
      }
    };

    fetchSubscription();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleManageSubscription = useCallback(async () => {
    if (!canManageSubscription) {
      toast({
        title: "No active subscription",
        description: "There is no active subscription to manage.",
        variant: "destructive",
      });
      return;
    }

    try {
      await openCustomerPortal();
    } catch (error) {
      console.error("Failed to open customer portal", error);
      toast({
        title: "Unable to open customer portal",
        description: "Please try again in a moment or contact support if the issue persists.",
        variant: "destructive",
      });
    }
  }, [canManageSubscription, openCustomerPortal, toast]);
  
  // Handle checkout client-side
  const handleCheckout = (priceId: string) => {
    // Redirect to the dashboard pricing page with the priceId
    router.push(`/dashboard/pricing?priceId=${priceId}`);
  };

  // Ensure we have fallbacks for all data
  const proProduct = products.find((product) => product.name === "Pro") || { id: "pro-fallback", name: "Pro" };
  const proPrice = prices.find((price) => price.productId === proProduct.id) || { id: "price_free", productId: proProduct.id, unitAmount: 0 };
  const isProCurrentPlan = (currentPlanName ?? "").toLowerCase() === "pro";

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { 
      opacity: 1,
      transition: { 
        staggerChildren: 0.2,
        delayChildren: 0.3
      }
    }
  };
  
  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: { duration: 0.5 }
    }
  };

  return (
    <div>
      <motion.div 
        className="max-w-5xl mx-auto space-y-16"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        <motion.section className="space-y-8" variants={itemVariants}>
          <h2 className="text-5xl md:text-6xl font-bold text-[#F9F6EE] font-safiro tracking-tight">
            Choose Your <span className="text-[#B4916C]">Premium</span> Plan
          </h2>
          <p className="text-xl text-[#C5C2BA] font-borna mt-4">
            Experience the full power of our platform
          </p>
          <p className="text-lg text-[#C5C2BA] font-borna">
            Upgrade or downgrade your plan anytime as your needs evolve.
          </p>
        </motion.section>

        <div className="grid md:grid-cols-2 gap-8 justify-center mb-8 max-w-4xl mx-auto">
          <PricingCard
            name="Pro"
            price={proPrice.unitAmount || 0}
            interval={proPrice.interval || "month"}
            features={["Optimize CV", "Document Analysis", "Job Description Generator", "CV to Job Match"]}
            highlight={false}
            priceId={proPrice.id}
            animationDelay={0.2}
            onCheckout={handleCheckout}
            isCurrentPlan={isProCurrentPlan}
            canManageSubscription={canManageSubscription}
            onManageSubscription={handleManageSubscription}
            isManageLoading={isOpeningCustomerPortal}
          />
        </div>

        <motion.div
          className="text-center mt-12 p-8 border border-[#222222] rounded-xl bg-[#111111]"
          variants={itemVariants}
        >
          <h3 className="text-2xl font-safiro text-[#F9F6EE] mb-4">Still have questions?</h3>
          <p className="text-[#C5C2BA] font-borna mb-6 max-w-2xl mx-auto">
            Our team is here to help you select the right plan for your needs. 
            Contact us for custom enterprise solutions or bulk discounts.
          </p>
          <a 
            href="/contact" 
            className="inline-flex items-center justify-center bg-transparent hover:bg-[#1A1A1A] text-[#B4916C] border border-[#B4916C] px-6 py-2 rounded-lg transition-all duration-300 h-12 font-medium"
          >
            Contact Sales
          </a>
        </motion.div>
      </motion.div>
    </div>
  );
}

function PricingCard({
  name,
  price,
  interval,
  features,
  highlight,
  priceId,
  tooltips,
  animationDelay = 0,
  onCheckout,
  isCurrentPlan = false,
  canManageSubscription = false,
  onManageSubscription,
  isManageLoading = false
}: PricingCardProps) {
  const cardVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: {
        duration: 0.5,
        delay: animationDelay
      }
    },
    hover: { 
      y: -8,
      transition: {
        duration: 0.3
      }
    }
  };

  return (
    <motion.div
      className={`rounded-xl overflow-hidden transition-all duration-300 flex flex-col ${
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
            <span className="ml-2 text-xs bg-[#B4916C]/20 text-[#B4916C] px-2 py-1 rounded-full font-borna">
              Most Popular
            </span>
          )}
        </h2>
        <p className="text-4xl font-bold font-safiro text-[#F9F6EE] mb-2 tracking-tight">
          {(price || 0) / 100}
          <span className="text-xl font-normal text-[#8A8782] ml-1 font-borna">
            /{interval}
          </span>
        </p>

        {isCurrentPlan && (
          <div className="mt-4 space-y-3 rounded-lg border border-[#222222] bg-[#111111]/80 p-4">
            <p className="text-sm text-[#C5C2BA] font-borna">
              Your Current Plan: <span className="text-[#F9F6EE] font-semibold">{name}</span>
            </p>
            <Button
              onClick={() => onManageSubscription?.()}
              disabled={!canManageSubscription || isManageLoading}
              variant="outline"
              className="w-full justify-center border-[#333333] bg-[#111111] text-[#F9F6EE] hover:bg-[#1A1A1A]"
            >
              {isManageLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Opening portal...
                </>
              ) : (
                "Cancel my plan"
              )}
            </Button>
            <p className="text-xs text-[#8A8782] font-borna">
              Manage your billing details anytime through the Stripe customer portal.
            </p>
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
      
      <div className="p-6 flex-grow flex flex-col h-full">
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
        <motion.button
          onClick={() => {
            if (isCurrentPlan) {
              return;
            }

            onCheckout(priceId || "");
          }}
          disabled={isCurrentPlan}
          className={`w-full font-medium px-4 py-3 rounded-lg transition-all duration-300 font-safiro h-12 ${
            highlight
              ? "bg-[#B4916C] hover:bg-[#A3815B] text-[#050505]"
              : "bg-[#222222] hover:bg-[#333333] text-[#F9F6EE] border border-[#333333]"
          } ${isCurrentPlan ? "cursor-not-allowed opacity-60" : ""}`}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          {isCurrentPlan ? "Current Plan" : highlight ? "Upgrade Now" : "Select Plan"}
        </motion.button>
      </div>
    </motion.div>
  );
} 