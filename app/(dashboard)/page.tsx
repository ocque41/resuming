"use client";

import { Navbar } from "@/components/ui/navbar";
import { Badge } from "@/components/ui/badge";
import { Article, ArticleTitle, ArticleContent } from "@/components/ui/article";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useEffect, useState } from "react";

export default function HomePage() {
  // State to track viewport height for mobile browsers
  const [viewportHeight, setViewportHeight] = useState("100vh");

  // Handle viewport height for mobile browsers and prevent scrolling
  useEffect(() => {
    // Prevent scrolling
    document.body.style.overflow = "hidden";
    
    // Set viewport height correctly for mobile browsers
    const updateHeight = () => {
      setViewportHeight(`${window.innerHeight}px`);
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
    <div 
      className="flex flex-col bg-[#050505] overflow-hidden"
      style={{ height: viewportHeight }}
    >
      {/* Navbar */}
      <Navbar />

      {/* Hero Section */}
      <section className="relative flex-1 flex items-center justify-center pt-8 sm:pt-4 md:pt-0">
        <div className="relative z-10 container mx-auto px-4 sm:px-6 lg:px-8 flex flex-col items-center justify-center h-full py-4 sm:py-6 md:py-8">
          <div className="max-h-full overflow-auto no-scrollbar flex flex-col items-center">
            {/* Badge above title */}
            <div className="mb-3 sm:mb-4 md:mb-6 mt-0">
              <Link href="https://chromad.vercel.app/docs/products/resuming">
                <Badge className="bg-[#FFFFFF] text-[#050505]">Documentation</Badge>
              </Link>
            </div>
            
            <Article className="text-center max-w-3xl mx-auto">
              <ArticleTitle className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-bold text-white">
                The Jobs Playground
              </ArticleTitle>
              <ArticleContent className="mt-2 sm:mt-3 md:mt-4 text-base sm:text-lg md:text-xl lg:text-2xl text-gray-300">
                AI-powered CV Analysis &amp; Optimization unlocking exclusive career opportunities.
              </ArticleContent>
              
              <div className="mt-4 sm:mt-5 md:mt-6 lg:mt-8 flex flex-col sm:flex-row gap-3 sm:gap-4 items-center justify-center">
                <Button
                  asChild
                  size="lg"
                  className="bg-[#FFFFFF] text-[#050505] px-5 sm:px-6 md:px-8 py-2.5 sm:py-3 md:py-4 rounded-md hover:bg-[#090909]/90 transition w-full sm:w-auto text-sm sm:text-base"
                >
                  <Link href="/sign-up">Try For Free</Link>
                </Button>
                <Button
                  asChild
                  variant="outline"
                  size="lg"
                  className="border border-white text-white px-5 sm:px-6 md:px-8 py-2.5 sm:py-3 md:py-4 rounded-md hover:bg-[#090909] transition w-full sm:w-auto text-sm sm:text-base"
                >
                  <Link href="/pricing">Learn More</Link>
                </Button>
              </div>
            </Article>
            
            {/* Hero Image - Fully responsive with standard img tag and rounded corners */}
            <div className="mt-4 sm:mt-5 md:mt-6 lg:mt-8 w-full max-w-4xl px-4 flex justify-center">
              <div className="w-full max-w-3xl rounded-xl overflow-hidden shadow-2xl">
                <img 
                  src="/11.webp" 
                  alt="CV Optimizer Hero" 
                  className="w-full h-auto max-h-[35vh] sm:max-h-[40vh] md:max-h-[45vh] lg:max-h-[50vh] object-contain transform hover:scale-105 transition-transform duration-500 rounded-xl"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

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
  );
}
