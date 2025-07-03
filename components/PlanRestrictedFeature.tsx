"use client";

import { useState, ReactNode } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Lock, ArrowRight } from "lucide-react";

interface PlanRestrictedFeatureProps {
  children: ReactNode;
  planName?: string | null;
  requiredPlan: string;
  title?: string;
  description?: string;
  className?: string;
  overlayClassName?: string;
  buttonText?: string;
}

/**
 * A component that restricts access to features based on the user's plan.
 * If the user doesn't have the required plan, it shows a blur overlay with a CTA to upgrade.
 */
export default function PlanRestrictedFeature({
  children,
  planName,
  requiredPlan,
  title = "Upgrade to Pro",
  description = "This feature requires the Pro plan. Upgrade now to access it.",
  className = "",
  overlayClassName = "",
  buttonText = "Upgrade Now"
}: PlanRestrictedFeatureProps) {
  const router = useRouter();
  const [isHovered, setIsHovered] = useState(false);
  
  // Convert planName to lowercase for case-insensitive comparison
  const normalizedPlanName = planName?.toLowerCase() || "";
  const normalizedRequiredPlan = requiredPlan.toLowerCase();
  
  // Check if user has access to this feature
  // Users must have the Pro plan for all gated features
  const hasAccess =
    normalizedPlanName === normalizedRequiredPlan && normalizedPlanName !== "";
  
  const handleUpgradeClick = () => {
    router.push("/dashboard/pricing");
  };
  
  return (
    <div className={`relative group ${className}`}>
      {children}
      
      <AnimatePresence>
        {!hasAccess && (
          <motion.div
            className={`absolute inset-0 z-10 flex items-center justify-center bg-[#050505]/80 backdrop-blur-[3px] rounded-xl overflow-hidden ${overlayClassName}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            onClick={handleUpgradeClick}
          >
            <motion.div 
              className="flex flex-col items-center text-center p-6 max-w-xs cursor-pointer"
              whileHover={{ scale: 1.05 }}
              initial={{ y: 10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.3, delay: 0.1 }}
            >
              <div className="bg-[#B4916C]/20 p-3 rounded-full mb-4">
                <Lock className="h-6 w-6 text-[#B4916C]" />
              </div>
              <h3 className="text-xl font-bold text-[#F9F6EE] font-safiro mb-2">{title}</h3>
              <p className="text-[#C5C2BA] font-borna text-sm mb-4">{description}</p>
              
              <motion.button
                className="flex items-center justify-center px-4 py-2 bg-[#B4916C] text-[#050505] rounded-lg font-safiro text-sm font-medium"
                whileHover={{ 
                  backgroundColor: "#A3815B",
                  transition: { duration: 0.2 } 
                }}
                whileTap={{ scale: 0.98 }}
              >
                {buttonText}
                <ArrowRight className="ml-2 h-4 w-4" />
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
} 