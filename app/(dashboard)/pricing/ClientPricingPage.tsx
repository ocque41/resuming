"use client";

import { Check, Star } from "lucide-react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";

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
}

interface ClientPricingPageProps {
  prices: StripePrice[];
  products: StripeProduct[];
}

export default function ClientPricingPage({ prices, products }: ClientPricingPageProps) {
  const router = useRouter();
  
  // Handle checkout client-side
  const handleCheckout = (priceId: string) => {
    // Redirect to the dashboard pricing page with the priceId
    router.push(`/dashboard/pricing?priceId=${priceId}`);
  };

  // Ensure we have fallbacks for all data
  const proPlan = products.find((product) => product.name === "Pro") || { id: "pro-fallback", name: "Pro" };
  const moonlightingPlan = products.find((product) => product.name === "Moonlighting") || { id: "moonlighting-fallback", name: "Moonlighting" };
  const ceoPlan = products.find((product) => product.name === "CEO") || { id: "ceo-fallback", name: "CEO" };

  const proPrice = prices.find((price) => price.productId === proPlan?.id) || { unitAmount: 799, id: "price_1QoUP9FYYYXM77wGBUVqTaiE", productId: proPlan.id };
  const moonlightingPrice = prices.find((price) => price.productId === moonlightingPlan?.id) || { unitAmount: 1499, id: "price-moonlighting-fallback", productId: moonlightingPlan.id };
  const ceoPrice = prices.find((price) => price.productId === ceoPlan?.id) || { unitAmount: 9999, id: "price_1QoYTrFYYYXM77wGffciG20i", productId: ceoPlan.id };

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
    <>
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
            Enjoy a 1-day free trial to experience the full power of our platform
          </p>
          <p className="text-lg text-[#C5C2BA] font-borna">
            Upgrade or downgrade your plan anytime as your needs evolve.
          </p>
        </motion.section>

        <div className="grid md:grid-cols-3 gap-8 justify-center mb-8">
          <PricingCard
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
            priceId="price_1QoUP9FYYYXM77wGBUVqTaiE"
            animationDelay={0.2}
            onCheckout={handleCheckout}
          />
          <PricingCard
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
            onCheckout={handleCheckout}
          />
          <PricingCard
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
            priceId="price_1QoYTrFYYYXM77wGffciG20i"
            animationDelay={0.4}
            onCheckout={handleCheckout}
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
    </>
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
  onCheckout
}: PricingCardProps) {
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
            <span className="ml-2 text-xs bg-[#B4916C]/20 text-[#B4916C] px-2 py-1 rounded-full font-borna">
              Most Popular
            </span>
          )}
        </h2>
        <p className="text-4xl font-bold font-safiro text-[#F9F6EE] mb-2 tracking-tight">
          ${(price || 0) / 100}
          <span className="text-xl font-normal text-[#8A8782] ml-1 font-borna">
            /{interval}
          </span>
        </p>
        
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
      
      <div className="p-6">
        <ul className="space-y-4 mb-8">
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
          onClick={() => onCheckout(priceId || "")}
          className={`w-full font-medium px-4 py-3 rounded-lg transition-all duration-300 font-safiro ${
            highlight
              ? "bg-[#B4916C] hover:bg-[#A3815B] text-[#050505]"
              : "bg-[#222222] hover:bg-[#333333] text-[#F9F6EE] border border-[#333333]"
          }`}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          {highlight ? "Upgrade Now" : "Select Plan"}
        </motion.button>
      </div>
    </motion.div>
  );
} 