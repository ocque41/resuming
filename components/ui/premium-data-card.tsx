import React from "react";
import { motion, easeInOut } from "framer-motion";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";
import { colors } from "@/lib/design-tokens";

interface PremiumDataCardProps {
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  value?: string | number;
  trend?: number;
  trendLabel?: string;
  children?: React.ReactNode;
  className?: string;
  headerClassName?: string;
  contentClassName?: string;
  iconClassName?: string;
  variant?: "default" | "glass" | "elevated" | "minimal";
  size?: "sm" | "md" | "lg";
  withShimmer?: boolean;
  withFloatEffect?: boolean;
  animationDelay?: number;
}

/**
 * A premium card component for displaying data visualizations and statistics
 */
export default function PremiumDataCard({
  title,
  subtitle,
  icon: Icon,
  value,
  trend,
  trendLabel,
  children,
  className,
  headerClassName,
  contentClassName,
  iconClassName,
  variant = "default",
  size = "md",
  withShimmer = false,
  withFloatEffect = false,
  animationDelay = 0,
}: PremiumDataCardProps) {
  
  // Styles based on variant
  const variantStyles = {
    default: "bg-[#111111] border border-[#222222] shadow-md",
    glass: "backdrop-blur-md bg-[rgba(17,17,17,0.7)] border border-[rgba(34,34,34,0.7)]",
    elevated: "bg-[#111111] border border-[#333333] shadow-lg",
    minimal: "bg-[#0A0A0A] border border-[#1A1A1A]",
  };
  
  // Styles based on size
  const sizeStyles = {
    sm: "p-4",
    md: "p-5",
    lg: "p-6",
  };
  
  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { 
      opacity: 1, 
      y: 0, 
      transition: {
        duration: 0.5,
        ease: easeInOut,
        delay: animationDelay,
      }
    },
  };
  
  // Float animation for cards
  const floatAnimation = withFloatEffect ? {
    y: [0, -5, 0],
    transition: {
      duration: 5,
      repeat: Infinity,
      repeatType: "loop" as const,
      ease: "easeInOut",
    }
  } : {};
  
  // Display trend with arrow and color
  const renderTrend = () => {
    if (trend === undefined) return null;
    
    const isPositive = trend > 0;
    const isNeutral = trend === 0;
    
    const trendColor = isPositive 
      ? "text-[#4ADE80]" 
      : isNeutral 
      ? "text-[#8A8782]" 
      : "text-[#F5C2C2]";
      
    const TrendIcon = isPositive 
      ? TrendUpIcon 
      : isNeutral 
      ? TrendNeutralIcon 
      : TrendDownIcon;
    
    return (
      <div className={`flex items-center ${trendColor} text-sm font-borna ml-2`}>
        <TrendIcon className="mr-1" />
        <span>{Math.abs(trend)}%</span>
        {trendLabel && (
          <span className="text-[#8A8782] ml-1">{trendLabel}</span>
        )}
      </div>
    );
  };
  
  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      whileHover={withFloatEffect ? "hover" : undefined}
      className={cn(
        "rounded-xl overflow-hidden", 
        variantStyles[variant],
        className
      )}
    >
      {/* Shimmer effect */}
      {withShimmer && (
        <div 
          className="absolute inset-0 w-[200%] h-full bg-gradient-to-r from-transparent via-[rgba(255,255,255,0.05)] to-transparent animate-shimmer"
          style={{ backgroundSize: "200% 100%" }}
        />
      )}
      
      <div className={cn("flex items-center justify-between", sizeStyles[size], headerClassName)}>
        <div className="flex items-center">
          {Icon && (
            <div className={cn(
              "flex items-center justify-center h-10 w-10 rounded-xl mr-3 bg-[#0A0A0A] text-[#B4916C]",
              iconClassName
            )}>
              <Icon className="h-5 w-5" />
            </div>
          )}
          <div>
            <h3 className="text-base font-safiro font-medium text-[#F9F6EE]">
              {title}
            </h3>
            {subtitle && (
              <p className="text-xs text-[#8A8782] font-borna mt-0.5">
                {subtitle}
              </p>
            )}
          </div>
        </div>
        
        {value && (
          <div className="flex items-center">
            <span className="text-xl font-safiro font-semibold text-[#F9F6EE]">
              {value}
            </span>
            {renderTrend()}
          </div>
        )}
      </div>
      
      {children && (
        <div 
          className={cn(
            "relative z-10",
            size !== "sm" && "px-5 pb-5",
            size === "sm" && "px-4 pb-4",
            contentClassName
          )}
        >
          {children}
        </div>
      )}
    </motion.div>
  );
}

// Trend icons
const TrendUpIcon = ({ className = "" }) => (
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
    className={className}
  >
    <polyline points="22 7 13.5 15.5 8.5 10.5 2 17"></polyline>
    <polyline points="16 7 22 7 22 13"></polyline>
  </svg>
);

const TrendDownIcon = ({ className = "" }) => (
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
    className={className}
  >
    <polyline points="22 17 13.5 8.5 8.5 13.5 2 7"></polyline>
    <polyline points="16 17 22 17 22 11"></polyline>
  </svg>
);

const TrendNeutralIcon = ({ className = "" }) => (
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
    className={className}
  >
    <line x1="5" y1="12" x2="19" y2="12"></line>
  </svg>
);
 