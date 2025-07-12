import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  BarChart2, FileText, PieChart, Briefcase, 
  Settings, Menu, X, ChevronRight
} from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  description?: string;
}

/**
 * Premium mobile navigation component with luxury styling
 */
export default function MobileNavigation() {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();
  
  // Main navigation items
  const navItems: NavItem[] = [
    {
      href: "/dashboard",
      label: "Dashboard",
      icon: FileText,
      description: "Overview of your CV collection",
    },
    {
      href: "/dashboard/optimize",
      label: "Optimize CV",
      icon: BarChart2,
      description: "Analyze & optimize for ATS",
    },
    {
      href: "/dashboard/enhance",
      label: "Document Editor",
      icon: FileText,
      description: "Edit with AI assistance",
    },
    {
      href: "/dashboard/document-analyzer",
      label: "Document Analyzer",
      icon: PieChart,
      description: "Analyze documents with Mistral AI",
    },
    {
      href: "/dashboard/analyze",
      label: "Document Analysis",
      icon: PieChart,
      description: "Extract insights & visualize data",
    },
    {
      href: "/job-description",
      label: "Job Description Generator",
      icon: FileText,
      description: "Create detailed job descriptions",
    },
    {
      href: "/job-match",
      label: "CV to Job Match",
      icon: BarChart2,
      description: "Analyze CV against job descriptions",
    },
    {
      href: "/settings",
      label: "Settings",
      icon: Settings,
      description: "Manage your account and preferences",
    },
  ];
  
  // Animation variants
  const menuVariants = {
    closed: {
      opacity: 0,
      x: "100%",
      transition: {
        duration: 0.3,
      }
    },
    open: {
      opacity: 1,
      x: 0,
      transition: {
        duration: 0.4,
        staggerChildren: 0.05,
        delayChildren: 0.1,
      }
    }
  };
  
  const itemVariants = {
    closed: { 
      opacity: 0, 
      x: 20 
    },
    open: { 
      opacity: 1, 
      x: 0,
      transition: {
        duration: 0.3,
      }
    }
  };
  
  const overlayVariants = {
    closed: { 
      opacity: 0,
      transition: {
        duration: 0.3
      }
    },
    open: { 
      opacity: 1,
      transition: {
        duration: 0.3
      }
    }
  };
  
  const buttonVariants = {
    initial: { scale: 1 },
    tap: { scale: 0.95 },
    hover: { scale: 1.05 }
  };
  
  return (
    <>
      {/* Mobile menu trigger button - fixed at bottom right */}
      <motion.button
        className="fixed right-5 bottom-5 z-50 h-12 w-12 rounded-full bg-[#111111] border border-[#333333] text-[#F9F6EE] shadow-lg flex items-center justify-center"
        onClick={() => setIsOpen(!isOpen)}
        variants={buttonVariants}
        initial="initial"
        whileTap="tap"
        whileHover="hover"
        aria-label={isOpen ? "Close menu" : "Open menu"}
      >
        {isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </motion.button>
      
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Overlay/backdrop */}
            <motion.div
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
              initial="closed"
              animate="open"
              exit="closed"
              variants={overlayVariants}
              onClick={() => setIsOpen(false)}
            />
            
            {/* Navigation menu */}
            <motion.div
              className="fixed inset-y-0 right-0 w-[85%] max-w-xs bg-[#0A0A0A] border-l border-[#222222] shadow-xl z-50 p-5 overflow-y-auto"
              initial="closed"
              animate="open"
              exit="closed"
              variants={menuVariants}
            >
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-xl font-safiro font-medium text-[#F9F6EE]">Menu</h2>
                <motion.button
                  className="rounded-lg p-2 text-[#F9F6EE] hover:bg-[#111111]"
                  onClick={() => setIsOpen(false)}
                  variants={buttonVariants}
                  initial="initial"
                  whileTap="tap"
                  whileHover="hover"
                  aria-label="Close menu"
                >
                  <X className="h-5 w-5" />
                </motion.button>
              </div>
              
              <nav className="space-y-3">
                {navItems.map((item) => {
                  const isActive = pathname === item.href;
                  
                  return (
                    <motion.div
                      key={item.href}
                      variants={itemVariants}
                    >
                      <Link 
                        href={item.href}
                        onClick={() => setIsOpen(false)}
                        className={cn(
                          "flex items-center justify-between p-3.5 rounded-lg transition-colors",
                          isActive ? 
                            "bg-[#111111] border border-[#222222] shadow-sm" : 
                            "hover:bg-[#0F0F0F]"
                        )}
                      >
                        <div className="flex items-center">
                          <div className={cn(
                            "flex items-center justify-center h-9 w-9 rounded-lg mr-3",
                            isActive ? "bg-[#050505] text-[#B4916C]" : "bg-[#161616] text-[#8A8782]"
                          )}>
                            <item.icon className="h-5 w-5" />
                          </div>
                          <div>
                            <span className={cn(
                              "text-sm font-safiro font-medium block",
                              isActive ? "text-[#F9F6EE]" : "text-[#C5C2BA]"
                            )}>
                              {item.label}
                            </span>
                            {item.description && (
                              <span className="text-xs text-[#8A8782] font-borna mt-0.5 line-clamp-1">
                                {item.description}
                              </span>
                            )}
                          </div>
                        </div>
                        
                        <ChevronRight className={cn(
                          "h-4 w-4 transition-colors",
                          isActive ? "text-[#B4916C]" : "text-[#444444]"
                        )} />
                      </Link>
                    </motion.div>
                  );
                })}
              </nav>
              
              <div className="mt-10 pt-6 border-t border-[#1A1A1A]">
                <div className="bg-[#111111] border border-[#222222] rounded-lg p-4">
                  <div className="flex items-center">
                    <div className="h-8 w-8 rounded-full bg-[#161616] flex items-center justify-center">
                      <span className="text-sm font-safiro text-[#B4916C]">CV</span>
                    </div>
                    <div className="ml-3">
                      <p className="text-sm font-safiro font-medium text-[#F9F6EE]">CV Optimizer</p>
                      <p className="text-xs text-[#8A8782] font-borna">v1.0.0</p>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
} 