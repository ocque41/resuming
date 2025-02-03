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
              className="text-6xl font-bold tracking-tight text-white animate-fade-in"
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
                className="group shadow-lg bg-white text-black hover:bg-gray-100 transition-all duration-base ease-default"
              >
                <Link href="/sign-up" className="flex items-center">
                  Begin Your Journey 
                  <ArrowRight className="ml-2 group-hover:translate-x-1 transition-transform" />
                </Link>
              </Button>
              <Button 
                asChild 
                variant="outline" 
                size="lg" 
                className="shadow-lg border-2 border-gray-700 text-white hover:bg-gray-800 transition-all duration-300"
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
                description: "Intelligent content analysis with automated scoring and format preservation" 
              },
              { 
                icon: TrendingUp, 
                title: "Job-CV Matching System", 
                description: "Real-time CV optimization with percentage-based job compatibility scoring" 
              },
              { 
                icon: Shield, 
                title: "Geospatial Integration", 
                description: "Location-based job mapping with interactive scoring visualization" 
              }
            ].map(({ icon: Icon, title, description }) => (
              <motion.div 
                key={title} 
                className="bg-[#111827] p-6 rounded-lg shadow-md hover:shadow-xl transition-all duration-base ease-default group border border-gray-800 hover:border-gray-700"
                variants={itemVariants}
              >
                <Icon 
                  className="mx-auto mb-4 text-white group-hover:scale-110 transition-all duration-300" 
                  size={48} 
                />
                <h3 className="text-2xl font-semibold mb-4 text-white">{title}</h3>
                <p className="text-gray-400 group-hover:text-gray-200 transition-colors">{description}</p>
              </motion.div>
            ))}
          </motion.section>

          <motion.section 
            className="bg-[#111827] rounded-lg p-8 space-y-6 border border-gray-800 shadow-md transition-all duration-base ease-default"
            variants={containerVariants}
          >
            <motion.h2 
              className="text-3xl font-bold text-white"
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
                  <Icon className="text-white group-hover:rotate-6 transition-transform" />
                  <p className="text-gray-300 group-hover:text-white transition-colors">{text}</p>
                </motion.div>
              ))}
            </motion.div>
          </motion.section>
        </motion.div>
      </div>
    </div>
  );
}
