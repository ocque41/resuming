"use client";

import { Navbar } from "@/components/ui/navbar";
import { useEffect, useState } from "react";

export function MobileNavbar() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    // Check if we're on mobile
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 640);
    };
    
    // Initial check
    checkMobile();
    
    // Check on resize
    window.addEventListener("resize", checkMobile);
    
    return () => {
      window.removeEventListener("resize", checkMobile);
    };
  }, []);

  return (
    <div className={`sticky top-0 z-50 w-full bg-[#050505] shadow-md ${isMobile ? 'block' : ''}`}>
      <div className={isMobile ? 'block !important' : ''}>
        <Navbar />
      </div>
      
      {/* Mobile-specific styles */}
      {isMobile && (
        <style jsx global>{`
          nav {
            display: block !important;
            visibility: visible !important;
            opacity: 1 !important;
          }
        `}</style>
      )}
    </div>
  );
} 