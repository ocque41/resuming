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
      <section className="relative flex-1 flex items-center justify-center">
        {/* Background image with better opacity control */}
        <div 
          className="absolute inset-0 bg-cover bg-center" 
          style={{ 
            backgroundImage: "url('/11.webp')", 
            opacity: 0.3
          }}
        ></div>
        
        <div className="relative z-10 container mx-auto px-4 sm:px-6 lg:px-8 flex flex-col items-center justify-center h-full py-4">
          <div className="max-h-full overflow-auto no-scrollbar flex flex-col items-center">
            {/* Badge above title */}
            <div className="mb-4 sm:mb-6">
              <Link href="https://chromad.vercel.app/docs/products/resuming">
                <Badge className="bg-[#050505] text-white">Documentation</Badge>
              </Link>
            </div>
            
            <Article className="text-center max-w-3xl mx-auto">
              <ArticleTitle className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-white">
                The Jobs Playground
              </ArticleTitle>
              <ArticleContent className="mt-2 sm:mt-4 text-lg sm:text-xl md:text-2xl text-gray-300">
                AI-powered CV Analysis &amp; Optimization unlocking exclusive career opportunities.
              </ArticleContent>
              
              <div className="mt-6 sm:mt-8 flex flex-col sm:flex-row gap-4 items-center justify-center">
                <Button
                  asChild
                  size="lg"
                  className="bg-[#FFFFFF] text-black px-6 sm:px-8 py-3 sm:py-4 rounded-md hover:bg-[#B4916C]/90 transition w-full sm:w-auto"
                >
                  <Link href="/sign-up">Try For Free</Link>
                </Button>
                <Button
                  asChild
                  variant="outline"
                  size="lg"
                  className="border border-[#050505] text-white px-6 sm:px-8 py-3 sm:py-4 rounded-md hover:bg-[#B4916C] transition w-full sm:w-auto"
                >
                  <Link href="/pricing">Learn More</Link>
                </Button>
              </div>
            </Article>
            
            {/* Dashboard Preview Image - Responsive sizing */}
            <div className="mt-6 sm:mt-8 w-full max-w-4xl px-4">
              <div className="rounded-lg overflow-hidden shadow-2xl">
                <img 
                  src="/mockups/mockup8.png" 
                  alt="CV Optimizer Dashboard Preview" 
                  className="w-full h-auto object-cover transform hover:scale-105 transition-transform duration-500"
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
