"use client";

import { Badge } from "@/components/ui/badge";
import { Article, ArticleTitle, ArticleContent } from "@/components/ui/article";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { PageTransition } from "@/components/ui/page-transition";
import { MobileNavbar } from "@/components/ui/mobile-navbar";

// Animation variants
const fadeIn = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.6 } }
};

const fadeInUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { 
    opacity: 1, 
    y: 0, 
    transition: { 
      duration: 0.6,
      ease: "easeOut"
    } 
  }
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.2
    }
  }
};

export default function HomePage() {
  // State to track viewport height for mobile browsers
  const [viewportHeight, setViewportHeight] = useState("100vh");
  // State to track if we're on mobile
  const [isMobile, setIsMobile] = useState(false);

  // Handle viewport height for mobile browsers and prevent scrolling
  useEffect(() => {
    // Prevent scrolling
    document.body.style.overflow = "hidden";
    
    // Set viewport height correctly for mobile browsers
    const updateHeight = () => {
      setViewportHeight(`${window.innerHeight}px`);
      setIsMobile(window.innerWidth < 640);
    };
    
    // Initial update
    updateHeight();
    
    // Update on resize
    window.addEventListener("resize", updateHeight);
    
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("resize", updateHeight);
    };
  }, []);

  return (
    <PageTransition>
      <div 
        className="flex flex-col bg-[#050505] overflow-hidden font-borna"
        style={{ height: viewportHeight }}
      >
        {/* Use the MobileNavbar component */}
        <MobileNavbar />

        {/* Hero Section - With more space for navbar */}
        <section className="relative flex-1 flex items-center justify-center pt-16 sm:pt-8 md:pt-4">
          <div className="relative z-10 container mx-auto px-4 sm:px-6 lg:px-8 flex flex-col items-center justify-center h-full py-4 sm:py-6 md:py-8">
            <motion.div 
              className="max-h-full overflow-auto no-scrollbar flex flex-col items-center"
              variants={staggerContainer}
              initial="hidden"
              animate="visible"
            >
              {/* Badge above title */}
              <motion.div 
                className="mb-3 sm:mb-4 md:mb-6 mt-4 sm:mt-0"
                variants={fadeInUp}
              >
                <Link href="https://chromad.vercel.app/docs/products/resuming">
                  <Badge className="bg-[#B4916C] text-white">Documentation</Badge>
                </Link>
              </motion.div>
              
              <Article className="text-center max-w-3xl mx-auto">
                <motion.div variants={fadeInUp}>
                  <ArticleTitle className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-bold text-white font-safiro">
                    The Jobs Playground
                  </ArticleTitle>
                </motion.div>
                
                <motion.div variants={fadeInUp}>
                  <ArticleContent className="mt-2 sm:mt-3 md:mt-4 text-base sm:text-lg md:text-xl lg:text-2xl text-gray-300 font-borna">
                    AI-powered CV Analysis &amp; Optimization unlocking exclusive career opportunities.
                  </ArticleContent>
                </motion.div>
                
                <motion.div 
                  className="mt-4 sm:mt-5 md:mt-6 lg:mt-8 flex flex-col sm:flex-row gap-3 sm:gap-4 items-center justify-center"
                  variants={fadeInUp}
                >
                  <Button
                    asChild
                    size="lg"
                    className="bg-[#FFFFFF] text-[#050505] px-5 sm:px-6 md:px-8 py-2.5 sm:py-3 md:py-4 rounded-md hover:bg-[#B4916C]/90 transition w-full sm:w-auto text-sm sm:text-base font-borna"
                  >
                    <Link href="/sign-up">Try For Free</Link>
                  </Button>
                  <Button
                    asChild
                    variant="outline"
                    size="lg"
                    className="border border-white text-white px-5 sm:px-6 md:px-8 py-2.5 sm:py-3 md:py-4 rounded-md hover:bg-[#B4916C] transition w-full sm:w-auto text-sm sm:text-base font-borna"
                  >
                    <Link href="/pricing">Learn More</Link>
                  </Button>
                </motion.div>
              </Article>
              
              {/* Hero Image - Using 9.webp with animation */}
              <motion.div 
                className="mt-4 sm:mt-5 md:mt-6 lg:mt-8 w-full max-w-4xl px-4 flex justify-center"
                variants={fadeInUp}
              >
                <div className="w-full max-w-3xl rounded-xl overflow-hidden shadow-2xl">
                  <motion.img 
                    src="/9.webp" 
                    alt="CV Optimizer Hero" 
                    className="w-full h-auto max-h-[35vh] sm:max-h-[40vh] md:max-h-[45vh] lg:max-h-[50vh] object-contain rounded-xl"
                    whileHover={{ scale: 1.05 }}
                    transition={{ duration: 0.5 }}
                  />
                </div>
              </motion.div>
            </motion.div>
          </div>
        </section>

        {/* Mobile navbar visibility fix */}
        {isMobile && (
          <style jsx global>{`
            nav {
              display: block !important;
              visibility: visible !important;
              opacity: 1 !important;
            }
          `}</style>
        )}

        {/* Custom CSS for hiding scrollbars */}
        <style jsx global>{`
          .no-scrollbar {
            -ms-overflow-style: none;  /* IE and Edge */
            scrollbar-width: none;  /* Firefox */
          }
          .no-scrollbar::-webkit-scrollbar {
            display: none;  /* Chrome, Safari and Opera */
          }
        `}</style>
      </div>
    </PageTransition>
  );
}
