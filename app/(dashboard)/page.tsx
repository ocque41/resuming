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
                <Link href="/plans">Explore Plans</Link>
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
            <a href="https://github.com/resuming-ai" target="_blank" rel="noopener noreferrer" className="text-[#B4916C] hover:text-white transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" className="fill-current">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"></path>
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
