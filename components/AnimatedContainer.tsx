"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";

interface AnimatedContainerProps {
  children: React.ReactNode;
  animationType?: "fade" | "slide" | "scale";
  delay?: number;
  duration?: number;
  className?: string;
}

/**
 * A reusable animated container component for adding subtle transitions
 */
export default function AnimatedContainer({
  children,
  animationType = "fade",
  delay = 0.1,
  duration = 0.5,
  className = "",
}: AnimatedContainerProps) {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient) {
    // Server-side or initial render
    return <div className={className}>{children}</div>;
  }

  const animationVariants = {
    fade: {
      initial: { opacity: 0 },
      animate: { opacity: 1, transition: { duration, delay } },
    },
    slide: {
      initial: { opacity: 0, y: 20 },
      animate: { opacity: 1, y: 0, transition: { duration, delay } },
    },
    scale: {
      initial: { opacity: 0, scale: 0.95 },
      animate: { opacity: 1, scale: 1, transition: { duration, delay } },
    },
  };

  const selectedAnimation = animationVariants[animationType];

  return (
    <motion.div
      initial={selectedAnimation.initial}
      animate={selectedAnimation.animate}
      className={className}
    >
      {children}
    </motion.div>
  );
} 