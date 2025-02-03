"use client"
import { Terminal } from './terminal';
import { Button } from "@/components/ui/button";
import { 
  FileText, 
  TrendingUp, 
  Shield, 
  Star, 
  Zap,
  ArrowRight
} from "lucide-react";
import Link from "next/link";
import { motion, Variants } from "framer-motion";

export default function HomePage() {
  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: { 
      opacity: 1, 
      transition: { 
        staggerChildren: 0.1,
        delayChildren: 0.2 
      } 
    }
  };

  const itemVariants: Variants = {
    hidden: { y: 20, opacity: 0 },
    visible: { 
      y: 0, 
      opacity: 1,
      transition: { 
        type: "spring", 
        stiffness: 100,
        damping: 12
      } 
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-black bg-gradient-to-br from-black via-[#0a0a0a] to-[#1a1a1a]">
      <div className="container mx-auto px-4 py-16 text-center flex-grow">
        <motion.div 
          className="max-w-5xl mx-auto space-y-16"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          <motion.section 
            className="space-y-8"
            variants={containerVariants}
          >
            <motion.h1 
              className="text-6xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-[#584235] via-[#B4916C] to-[#2C2420] animate-fade-in"
              variants={itemVariants}
            >
              Craft Your Perfect CV
            </motion.h1>
            <motion.p 
              className="text-2xl text-gray-300 max-w-3xl mx-auto animate-fade-in-up"
              variants={itemVariants}
            >
              Transform your career journey with our intelligent AI-powered CV optimization platform
            </motion.p>
          
            <motion.div 
              className="flex justify-center gap-4 animate-slide-in-right"
              variants={itemVariants}
            >
              <Button 
                asChild 
                size="lg" 
                className="group shadow-lg bg-[#584235] text-white hover:bg-[#2C2420] transition-all duration-base ease-default"
              >
                <Link href="/sign-up" className="flex items-center text-white">
                  Begin Your Journey 
                  <ArrowRight className="ml-2 group-hover:translate-x-1 transition-transform" />
                </Link>
              </Button>
              <Button 
                asChild 
                variant="outline" 
                size="lg" 
                className="shadow-lg border-2 border-[#B4916C] text-[#B4916C] hover:bg-[#2C2420] hover:text-white transition-all duration-300"
              >
                <Link href="/pricing">Explore Plans</Link>
              </Button>
            </motion.div>
          </motion.section>

          <motion.section 
            className="grid md:grid-cols-3 gap-8"
            variants={containerVariants}
          >
            {[
              { 
                icon: FileText, 
                title: "AI-Powered Document Analysis", 
                description: "Intelligent content analysis with automated scoring and format preservation",
                bgColor: "bg-[#2C2420]",
                textColor: "text-[#B4916C]"
              },
              { 
                icon: TrendingUp, 
                title: "Job-CV Matching System", 
                description: "Real-time CV optimization with percentage-based job compatibility scoring",
                bgColor: "bg-[#584235]",
                textColor: "text-[#E8DCC4]"
              },
              { 
                icon: Shield, 
                title: "Geospatial Integration", 
                description: "Location-based job mapping with interactive scoring visualization",
                bgColor: "bg-[#2C2420]",
                textColor: "text-[#B4916C]"
              }
            ].map(({ icon: Icon, title, description, bgColor, textColor }) => (
              <motion.div 
                key={title} 
                className={`${bgColor} p-6 rounded-lg shadow-md hover:shadow-xl transition-all duration-base ease-default group border border-gray-800 hover:border-gray-700`}
                variants={itemVariants}
              >
                <Icon 
                  className={`mx-auto mb-4 ${textColor} group-hover:scale-110 transition-all duration-300`} 
                  size={48} 
                />
                <h3 className={`text-2xl font-semibold mb-4 ${textColor}`}>{title}</h3>
                <p className={`${textColor} opacity-70 group-hover:opacity-100 transition-colors`}>{description}</p>
              </motion.div>
            ))}
          </motion.section>

          <motion.section 
            className="bg-gradient-to-br from-[#584235] to-[#2C2420] rounded-lg p-8 space-y-6 border border-[#B4916C]/20 shadow-md transition-all duration-base ease-default"
            variants={containerVariants}
          >
            <motion.h2 
              className="text-3xl font-bold text-[#E8DCC4]"
              variants={itemVariants}
            >
              Elevate Your Professional Journey
            </motion.h2>
            <motion.div 
              className="grid md:grid-cols-2 gap-6"
              variants={containerVariants}
            >
              {[
                { icon: Zap, text: "Format preservation during AI modifications" },
                { icon: Star, text: "Real-time CV scoring algorithm" },
                { icon: FileText, text: "Geographic job matching system" },
                { icon: TrendingUp, text: "Automated CV optimization" }
              ].map(({ icon: Icon, text }) => (
                <motion.div 
                  key={text} 
                  className="flex items-center gap-4 group animate-scroll-fade"
                  variants={itemVariants}
                >
                  <Icon className="text-[#B4916C] group-hover:rotate-6 transition-transform" />
                  <p className="text-[#E8DCC4] opacity-70 group-hover:opacity-100 transition-colors">{text}</p>
                </motion.div>
              ))}
            </motion.div>
          </motion.section>
        </motion.div>
      </div>

      <footer className="bg-[#2C2420] text-[#E8DCC4] py-12">
        <div className="container mx-auto px-4 text-center">
          <div className="flex justify-center space-x-6 mb-6">
            <a href="https://twitter.com/resumingai" target="_blank" rel="noopener noreferrer" className="text-[#B4916C] hover:text-white transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" className="fill-current">
                <path d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H1.474l8.6-9.83L0 1.154h7.594l5.243 6.932L18.901 1.153Zm-1.626 19.644h2.039L6.984 3.268H4.792L17.275 20.797Z"/>
              </svg>
            </a>
            <a href="https://linkedin.com/company/resuming" target="_blank" rel="noopener noreferrer" className="text-[#B4916C] hover:text-white transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" className="fill-current">
                <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.784 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"></path>
              </svg>
            </a>
            <a href="https://instagram.com/resuming" target="_blank" rel="noopener noreferrer" className="text-[#B4916C] hover:text-white transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" className="fill-current">
                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.148 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.148-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.197-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.948-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
              </svg>
            </a>
          </div>
          <p className="text-sm opacity-70">
            © 2025 Resuming. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
