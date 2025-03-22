"use client";

import { motion } from "framer-motion";
import { Mail, CheckCircle, AlertTriangle } from "lucide-react";
import NewsletterForm from "@/components/NewsletterForm";

interface NewsletterSectionProps {
  title?: string;
  description?: string;
  className?: string;
  animationDelay?: number;
}

export default function NewsletterSection({
  title = "Stay Updated",
  description = "Subscribe to our newsletter to get the latest updates on optimizing your resume and career advice.",
  className = "",
  animationDelay = 0.2
}: NewsletterSectionProps) {
  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: animationDelay
      }
    }
  };

  const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 }
  };

  return (
    <motion.section
      variants={container}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-100px" }}
      className={`py-12 px-4 sm:px-6 md:px-8 bg-[#0B0B0B] border border-[#222222] rounded-2xl ${className}`}
    >
      <div className="max-w-4xl mx-auto">
        <motion.div variants={item} className="flex items-center justify-center mb-6">
          <div className="bg-[#B4916C]/20 p-3 rounded-full">
            <Mail className="h-6 w-6 text-[#B4916C]" />
          </div>
        </motion.div>
        
        <motion.h2
          variants={item}
          className="text-2xl md:text-3xl font-bold text-center text-[#F9F6EE] mb-4 font-safiro"
        >
          {title}
        </motion.h2>
        
        <motion.p
          variants={item}
          className="text-[#C5C2BA] text-center mb-8 max-w-2xl mx-auto font-borna"
        >
          {description}
        </motion.p>
        
        <motion.div variants={item} className="max-w-xl mx-auto mb-8">
          <NewsletterForm 
            placeholder="Your email address" 
            buttonText="Subscribe"
          />
        </motion.div>
        
        <motion.div
          variants={item}
          className="grid md:grid-cols-3 gap-6 max-w-3xl mx-auto"
        >
          <div className="bg-[#111111] rounded-xl p-6 border border-[#222222] hover:border-[#333333] transition-all duration-300">
            <CheckCircle className="h-6 w-6 text-[#B4916C] mb-4" />
            <h3 className="text-lg font-bold text-[#F9F6EE] mb-2 font-safiro">Expert Advice</h3>
            <p className="text-sm text-[#C5C2BA] font-borna">Get career tips and resume optimization advice from industry experts.</p>
          </div>
          
          <div className="bg-[#111111] rounded-xl p-6 border border-[#222222] hover:border-[#333333] transition-all duration-300">
            <AlertTriangle className="h-6 w-6 text-[#B4916C] mb-4" />
            <h3 className="text-lg font-bold text-[#F9F6EE] mb-2 font-safiro">Latest Updates</h3>
            <p className="text-sm text-[#C5C2BA] font-borna">Be the first to know about new features and improvements to our tools.</p>
          </div>
          
          <div className="bg-[#111111] rounded-xl p-6 border border-[#222222] hover:border-[#333333] transition-all duration-300">
            <Mail className="h-6 w-6 text-[#B4916C] mb-4" />
            <h3 className="text-lg font-bold text-[#F9F6EE] mb-2 font-safiro">Industry Trends</h3>
            <p className="text-sm text-[#C5C2BA] font-borna">Receive insights on the latest hiring trends and what employers are looking for.</p>
          </div>
        </motion.div>
      </div>
    </motion.section>
  );
} 