"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { motion, HTMLMotionProps } from "framer-motion";

interface MicroCardProps extends Omit<HTMLMotionProps<"div">, "size"> {
  variant?: "default" | "gradient" | "glass" | "custom" | "premium";
  size?: "sm" | "md" | "lg";
}

// Create a motion div component
const MotionDiv = motion.div;

const MicroCard = React.forwardRef<HTMLDivElement, MicroCardProps>(
  ({ className, variant = "default", size = "md", ...props }, ref) => {
    // Size variants
    const sizes = {
      sm: "h-8 w-8",
      md: "h-10 w-10",
      lg: "h-12 w-12",
    };
    
    // Style variants
    const variants = {
      default:
        "rounded-full border border-[#222222] bg-[#111111] text-[#F9F6EE] shadow-lg hover:shadow-xl hover:border-[#333333] transition-all duration-300",
      gradient:
        "rounded-full bg-gradient-to-br from-[#B4916C] via-[#A3815B] to-[#8A6A4A] border border-[#B4916C]/30 shadow-lg hover:shadow-xl hover:from-[#A3815B] hover:to-[#B4916C] transition-all duration-300",
      glass:
        "rounded-full bg-[#111111]/80 backdrop-blur-lg border border-[#222222] shadow-lg hover:shadow-xl hover:bg-[#161616]/80 hover:border-[#333333] transition-all duration-300",
      custom:
        "rounded-full border border-[#B4916C]/30 bg-[#B4916C] text-[#050505] shadow-lg hover:shadow-xl hover:bg-[#A3815B] transition-all duration-300",
      premium:
        "rounded-full bg-gradient-to-br from-[#B4916C] to-[#8A6A4A] border-2 border-[#F9F6EE]/10 shadow-lg hover:shadow-xl hover:border-[#F9F6EE]/20 transition-all duration-300",
    };

    return (
      <MotionDiv 
        ref={ref} 
        className={cn(variants[variant], sizes[size], className)} 
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        {...props} 
      />
    );
  }
);

MicroCard.displayName = "MicroCard";

export { MicroCard };
