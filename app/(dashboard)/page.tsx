"use client"

import { createClient } from "@/utils/supabase/client";
import { Button } from "@/components/ui/button";
import { 
  FileText, 
  TrendingUp, 
  Shield, 
  Star, 
  Zap,
  ArrowRight
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { MainNav } from "@/components/main-nav";
import { useScrollAnimation } from "@/hooks/use-scroll-animation";
import { motion } from "framer-motion";
import { Logo } from "@/components/ui/logo";

export default function Home() {
  const supabase = createClient();
  const isSupabaseConnected = true; // Always true for client-side

  useScrollAnimation();

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { 
      opacity: 1, 
      transition: { 
        staggerChildren: 0.1,
        delayChildren: 0.2 
      } 
    }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { 
      y: 0, 
      opacity: 1,
      transition: { 
        type: "spring", 
        stiffness: 100,
        damping: 12  // Added damping for smoother animation
      } 
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <MainNav />
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
              className="text-6xl font-bold tracking-tight bg-gradient-to-r from-primary via-secondary to-tertiary bg-clip-text text-transparent dark:from-primary dark:via-secondary dark:to-tertiary animate-fade-in"
              variants={itemVariants}
            >
              Craft Your Perfect CV
            </motion.h1>
            <motion.p 
              className="text-2xl text-muted-foreground dark:text-primary-foreground/80 max-w-3xl mx-auto animate-fade-in-up"
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
                className="group shadow-lg bg-gradient-to-r from-primary to-secondary hover:from-primary/90 hover:to-secondary/90 text-primary-foreground transition-all duration-base ease-default dark:shadow-dark-mode"
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
                className="shadow-lg border-2 border-primary/80 hover:bg-tertiary/10 hover:border-secondary transition-all duration-300 dark:border-primary/60"
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
            ].map(({ icon: Icon, title, description }, index) => (
              <motion.div 
                key={title} 
                className="bg-gradient-to-br from-background via-surface to-tertiary/5 p-6 rounded-lg shadow-md hover:shadow-xl hover:bg-tertiary/10 transition-all duration-base ease-default group border border-primary/20 hover:border-primary/40 dark:border-primary/30 dark:hover:border-primary/50"
                variants={itemVariants}
              >
                <Icon 
                  className="mx-auto mb-4 text-primary group-hover:scale-110 group-hover:text-secondary transition-all duration-300 dark:text-primary-foreground" 
                  size={48} 
                />
                <h3 className="text-2xl font-semibold mb-4 bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent dark:from-primary-foreground dark:to-secondary-foreground dark:text-transparent">{title}</h3>
                <p className="text-muted-foreground group-hover:text-foreground dark:text-muted-foreground/80 dark:group-hover:text-primary-foreground transition-colors">{description}</p>
              </motion.div>
            ))}
          </motion.section>

          <motion.section 
            className="bg-gradient-to-br from-background via-surface to-tertiary/5 rounded-lg p-8 space-y-6 border border-primary/20 hover:border-primary/40 shadow-md transition-all duration-base ease-default dark:border-primary/30 dark:hover:border-primary/50"
            variants={containerVariants}
          >
            <motion.h2 
              className="text-3xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent dark:from-primary-foreground dark:via-secondary-foreground dark:to-tertiary"
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
              ].map(({ icon: Icon, text },) => (
                <motion.div 
                  key={text} 
                  className="flex items-center gap-4 group animate-scroll-fade"
                  variants={itemVariants}
                >
                  <Icon className="text-primary group-hover:rotate-6 transition-transform dark:text-primary-foreground" />
                  <p className="group-hover:text-primary/80 transition-colors">{text}</p>
                </motion.div>
              ))}
            </motion.div>
          </motion.section>
        </motion.div>
      </div>
      <footer className="w-full border-t border-primary/20 py-16 bg-gradient-to-br from-background via-surface to-tertiary/5 dark:border-primary/30">
        <div className="container mx-auto px-4 grid md:grid-cols-3 gap-8 items-start">
          {/* Logo Section */}
          <motion.div 
            className="flex flex-col items-center"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <Link href="/" className="mb-4 group">
              <Logo width={120} height={120} />
            </Link>
            <p className="text-sm text-muted-foreground">
              © {new Date().getFullYear()} Resuming
            </p>
          </motion.div>

          {/* Navigation Links */}
          <motion.div 
            className="flex flex-col items-center space-y-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
          >
            <h4 className="text-lg font-semibold mb-2 text-primary">Quick Links</h4>
            {[
              { href: "/plans", text: "Plans" },
              { href: "/mobile", text: "Mobile App" },
              { href: "/contact", text: "Contact" }
            ].map(({ href, text }) => (
              <Link 
                key={href}
                href={href} 
                className="text-sm hover:text-primary/80 transition-colors group flex items-center"
              >
                {text}
                <ArrowRight className="ml-1 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" size={16} />
              </Link>
            ))}
          </motion.div>

          {/* Theme Switcher */}
          <motion.div 
            className="flex flex-col items-center"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
          >
            <h4 className="text-lg font-semibold mb-2 text-primary">Preferences</h4>
            <ThemeSwitcher />
          </motion.div>
        </div>
      </footer>
    </div>
  );
}
