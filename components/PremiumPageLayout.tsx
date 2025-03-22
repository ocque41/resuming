"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { gradients, colors } from "@/lib/design-tokens";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { PremiumButton } from "./ui/premium-button";
import { useMediaQuery } from "@/hooks/use-media-query";
import UserMenu from "./UserMenu";

interface PremiumPageLayoutProps {
  title: string;
  subtitle?: string;
  backUrl?: string;
  headerExtra?: React.ReactNode;
  children: React.ReactNode;
  maxWidth?: "sm" | "md" | "lg" | "xl" | "2xl" | "3xl" | "4xl" | "5xl" | "6xl" | "full";
  animation?: "fade" | "slide" | "scale" | "none";
  animationDelay?: number;
  animationDuration?: number;
  withGradientBackground?: boolean;
  withScrollIndicator?: boolean;
  withFloatingBackButton?: boolean;
  toolbar?: React.ReactNode;
  activityLogs?: any[];
  teamData?: any;
}

/**
 * A premium page layout component with luxury aesthetic details and refined animations
 */
export default function PremiumPageLayout({
  title,
  subtitle,
  backUrl,
  headerExtra,
  children,
  maxWidth = "4xl",
  animation = "slide",
  animationDelay = 0.1,
  animationDuration = 0.5,
  withGradientBackground = false,
  withScrollIndicator = true,
  withFloatingBackButton = false,
  toolbar,
  activityLogs,
  teamData,
}: PremiumPageLayoutProps) {
  const [scrollProgress, setScrollProgress] = useState(0);
  const isMobile = useMediaQuery("(max-width: 768px)");

  // Handle scroll progress for the scroll indicator
  useEffect(() => {
    if (!withScrollIndicator) return;

    const handleScroll = () => {
      const totalHeight = document.body.scrollHeight - window.innerHeight;
      const progress = (window.scrollY / totalHeight) * 100;
      setScrollProgress(progress);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [withScrollIndicator]);

  // Animation variants for content
  const contentVariants = {
    hidden: {
      opacity: 0,
      y: animation === "slide" ? 20 : 0,
      scale: animation === "scale" ? 0.98 : 1,
    },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: {
        duration: animationDuration,
        ease: [0.22, 1, 0.36, 1],
        delay: animationDelay,
      },
    },
    exit: {
      opacity: 0,
      transition: {
        duration: 0.3,
        ease: [0.22, 1, 0.36, 1],
      },
    },
  };

  // Floating back button for mobile
  const floatingBackButton = withFloatingBackButton && backUrl && isMobile ? (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      className="fixed left-4 bottom-[20vh] z-50"
    >
      <Link href={backUrl} passHref>
        <PremiumButton
          variant="glass"
          size="icon"
          aria-label="Go back"
          className="rounded-full shadow-lg"
        >
          <ChevronLeft className="h-5 w-5" />
        </PremiumButton>
      </Link>
    </motion.div>
  ) : null;

  return (
    <>
      {/* Scroll progress indicator */}
      {withScrollIndicator && (
        <div 
          className="fixed top-0 left-0 z-50 h-0.5 bg-[#B4916C] transition-all duration-100"
          style={{ width: `${scrollProgress}%` }}
        />
      )}

      {/* Page container with optional gradient background */}
      <div 
        className={cn(
          "min-h-screen bg-[#050505] text-[#F9F6EE] pb-16",
          withGradientBackground && "bg-gradient-to-b from-[#050505] to-[#0A0A0A]"
        )}
      >
        {/* Header area */}
        <header className={cn(`max-w-${maxWidth} mx-auto px-4 sm:px-6 pt-8 pb-6 relative`)}>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-2">
            <div className="flex items-center">
              {backUrl && !withFloatingBackButton && (
                <Link 
                  href={backUrl} 
                  className="mr-3 flex items-center justify-center h-9 w-9 rounded-lg bg-[#111111] border border-[#222222] text-[#F9F6EE] hover:bg-[#161616] transition-colors"
                >
                  <ChevronLeft className="h-5 w-5" />
                </Link>
              )}
              
              <div>
                <h1 className="text-2xl md:text-3xl font-safiro font-medium text-[#F9F6EE] tracking-tight">
                  {title}
                </h1>
                {subtitle && (
                  <p className="text-[#C5C2BA] font-borna mt-1 text-sm md:text-base">
                    {subtitle}
                  </p>
                )}
              </div>
            </div>
            
            <div className="flex items-center space-x-4 relative ml-auto">
              {headerExtra}
              {teamData && activityLogs && (
                <UserMenu teamData={teamData} activityLogs={activityLogs} />
              )}
            </div>
          </div>
          
          {toolbar && (
            <div className="mt-6 bg-[#111111] border border-[#222222] rounded-lg p-2 flex items-center overflow-x-auto no-scrollbar">
              {toolbar}
            </div>
          )}
        </header>
        
        {/* Main content with animations */}
        <AnimatePresence mode="wait">
          <motion.main
            key={title} // Change key to force animation on page transitions
            variants={animation !== "none" ? contentVariants : undefined}
            initial={animation !== "none" ? "hidden" : undefined}
            animate={animation !== "none" ? "visible" : undefined}
            exit={animation !== "none" ? "exit" : undefined}
            className={`max-w-${maxWidth} mx-auto px-4 sm:px-6 relative`}
          >
            <div className="space-y-6">
              {children}
            </div>
          </motion.main>
        </AnimatePresence>
        
        {/* Floating back button for mobile */}
        {floatingBackButton}
      </div>
    </>
  );
} 