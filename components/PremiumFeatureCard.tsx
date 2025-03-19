"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface PremiumFeatureCardProps {
  href: string;
  icon: LucideIcon;
  title: string;
  description: string;
  iconBgColor?: string;
  iconColor?: string;
  bgGradient?: boolean;
  accentBorder?: boolean;
  fullWidth?: boolean;
  animationDelay?: number;
  withShine?: boolean;
  withHoverScale?: boolean;
  withElevation?: boolean;
}

/**
 * A premium feature card component with luxury styling and animations
 */
export default function PremiumFeatureCard({
  href,
  icon: Icon,
  title,
  description,
  iconBgColor = "bg-[#0A0A0A]",
  iconColor = "text-[#B4916C]",
  bgGradient = false,
  accentBorder = false,
  fullWidth = false,
  animationDelay = 0,
  withShine = true,
  withHoverScale = true,
  withElevation = true,
}: PremiumFeatureCardProps) {
  const containerVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { 
      opacity: 1, 
      y: 0, 
      transition: {
        duration: 0.5,
        ease: [0.22, 1, 0.36, 1],
        delay: animationDelay,
      }
    },
    hover: { 
      y: withHoverScale ? -5 : 0,
      scale: withHoverScale ? 1.02 : 1,
      transition: {
        duration: 0.2,
        ease: "easeInOut"
      }
    }
  };
  
  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      whileHover="hover"
      className={cn("relative overflow-hidden", fullWidth ? "md:col-span-2" : "")}
    >
      {/* Accent border option */}
      {accentBorder && (
        <div className="absolute inset-0 p-[1px] bg-gradient-to-br from-[#333333] via-[#B4916C] to-[#333333] rounded-xl opacity-70"></div>
      )}
      
      {/* Card content */}
      <Link
        href={href}
        className={cn(
          "flex items-center justify-between p-5 rounded-xl relative overflow-hidden group",
          bgGradient 
            ? "bg-gradient-to-br from-[#111111] to-[#0A0A0A]" 
            : "bg-[#111111]",
          accentBorder ? "border-0" : "border border-[#222222]",
          withElevation ? "shadow-lg" : "",
          "transition-all duration-300"
        )}
      >
        {/* Shine effect */}
        {withShine && (
          <motion.div 
            className="absolute inset-0 w-[200px] h-full translate-x-[-100%] rotate-[30deg] bg-gradient-to-r from-transparent via-[rgba(255,255,255,0.05)] to-transparent"
            animate={{
              x: ["calc(-100%)", "calc(200%)"],
            }}
            transition={{
              duration: 1.5,
              ease: "easeInOut",
              repeat: Infinity,
              repeatDelay: 3,
            }}
          />
        )}
        
        <div className="flex items-center relative z-10">
          <div className={cn(
            "flex items-center justify-center h-12 w-12 rounded-xl mr-4",
            iconBgColor,
            iconColor,
            "shadow-md transition-all duration-300 group-hover:scale-110"
          )}>
            <Icon className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-base md:text-lg font-safiro font-semibold text-[#F9F6EE] mb-1 tracking-tight">
              {title}
            </h3>
            <p className="text-sm text-[#C5C2BA] font-borna leading-snug">
              {description}
            </p>
          </div>
        </div>
        
        <div className="w-8 h-8 flex items-center justify-center rounded-full bg-[#161616] text-[#B4916C] transition-transform duration-300 group-hover:translate-x-1">
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            width="16" 
            height="16" 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="2" 
            strokeLinecap="round" 
            strokeLinejoin="round"
          >
            <path d="m9 18 6-6-6-6"/>
          </svg>
        </div>
      </Link>
    </motion.div>
  );
} 