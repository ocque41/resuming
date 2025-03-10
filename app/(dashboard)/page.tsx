"use client";

import { Navbar } from "@/components/ui/navbar";
import { Badge } from "@/components/ui/badge";
import { Article, ArticleTitle, ArticleContent } from "@/components/ui/article";
import { Button } from "@/components/ui/button";
import { motion, Variants } from "framer-motion";
import Link from "next/link";
import { FileText, Activity, MapPin, Check, ArrowRight, Diamond } from "lucide-react";

export default function HomePage() {
  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.15,
        delayChildren: 0.3,
        duration: 0.6,
        ease: "easeOut",
      },
    },
  };

  const itemVariants: Variants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: {
        type: "spring",
        stiffness: 80,
        damping: 15,
        duration: 0.8,
      },
    },
  };

  return (
    <div className="flex flex-col bg-[#050505]">
      {/* Navbar */}
      <Navbar />

      {/* Hero Section - Added more top padding to increase space */}
      <section className="relative min-h-screen flex items-center bg-black pt-32 pb-16">
        {/* Background overlay */}
        <div className="absolute inset-0 bg-[url('/hero-bg.jpg')] bg-cover bg-center opacity-30"></div>
        <div className="relative z-10 max-w-4xl mx-auto px-4 md:px-8 text-left space-y-6">
          {/* Badge above title */}
          <div>
            <Link href="https://chromad.vercel.app/docs/products/resuming">
              <Badge className="bg-[#B4916C] text-white">Documentation</Badge>
            </Link>
          </div>
          <Article>
            <ArticleTitle className="text-5xl md:text-7xl font-bold text-white">
              The Jobs Playground
            </ArticleTitle>
            <ArticleContent className="mt-4 text-xl md:text-2xl text-gray-300">
              AI-powered CV Analysis &amp; Optimization unlocking exclusive career opportunities.
            </ArticleContent>
            <div className="mt-8 flex flex-col md:flex-row gap-4 items-start">
              <Button
                asChild
                size="lg"
                className="bg-[#E8DCC4] text-black px-8 py-4 rounded-md hover:bg-[#FAF6ED]/90 transition"
              >
                <Link href="/sign-up">Try For Free</Link>
              </Button>
              <Button
                asChild
                variant="outline"
                size="lg"
                className="border border-[#2C2420] text-white px-8 py-4 rounded-md hover:bg-[#E8DCC4] transition"
              >
                <Link href="/pricing">Learn More</Link>
              </Button>
            </div>
          </Article>
          {/* Large Image Placeholder - Making it much bigger */}
          <div className="mt-12 flex justify-center">
            <div className="w-full max-w-5xl rounded-lg overflow-hidden shadow-2xl">
              <img 
                src="/mockups/mockup8.png" 
                alt="CV Optimizer Dashboard Preview" 
                className="w-full h-auto object-cover transform hover:scale-105 transition-transform duration-500"
              />
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section - Added more padding */}
      <section className="py-32 px-4">
        <div className="max-w-4xl mx-auto text-left space-y-12">
          <Article>
            <ArticleTitle className="text-3xl md:text-4xl font-bold text-white">
              How It Works
            </ArticleTitle>
            <ArticleContent className="mt-4 text-lg md:text-xl text-gray-300">
              Upload &rarr; Analyze &rarr; Optimize &rarr; Apply
            </ArticleContent>
          </Article>
          <motion.div
            className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-8"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            {/* Card 1: CV Analysis */}
            <motion.div
              className="bg-[#050505] p-6 rounded-lg shadow-md transition-all duration-base ease-default group border border-[#E8DCC4]"
              variants={itemVariants}
            >
              <div className="flex items-center gap-2">
                <FileText className="w-6 h-6 text-[#E8DCC4]" />
                <h3 className="text-xl font-semibold text-[#E8DCC4]">CV Analysis</h3>
              </div>
              {/* Animated divider placeholder */}
              <div className="my-2 h-1 w-16 bg-[#E8DCC4] animate-pulse"></div>
              <p className="text-gray-300">
                Our custom-trained AI reviews your CV to extract insights and identify key improvement areas.
              </p>
            </motion.div>
            {/* Card 2: CV Optimization */}
            <motion.div
              className="bg-[#050505] p-6 rounded-lg shadow-md transition-all duration-base ease-default group border border-[#E8DCC4]"
              variants={itemVariants}
            >
              <div className="flex items-center gap-2">
                <Activity className="w-6 h-6 text-[#E8DCC4]" />
                <h3 className="text-xl font-semibold text-[#E8DCC4]">CV Optimization</h3>
              </div>
              <div className="my-2 h-1 w-16 bg-[#E8DCC4] animate-pulse"></div>
              <p className="text-gray-300">
                Receive personalized suggestions that fine-tune your CV to stand out in today's competitive market.
              </p>
            </motion.div>
            {/* Card 3: Job Matching & Mapping */}
            <motion.div
              className="bg-[#050505] p-6 rounded-lg shadow-md transition-all duration-base ease-default group border border-[#E8DCC4]"
              variants={itemVariants}
            >
              <div className="flex items-center gap-2">
                <MapPin className="w-6 h-6 text-[#E8DCC4]" />
                <h3 className="text-xl font-semibold text-[#E8DCC4]">Job Matching &amp; Mapping</h3>
              </div>
              <div className="my-2 h-1 w-16 bg-[#E8DCC4] animate-pulse"></div>
              <p className="text-gray-300">
                Discover curated job listings with compatibility scores, and explore them on an interactive map.
              </p>
            </motion.div>
          </motion.div>
          {/* Try For Free Button for How It Works */}
          <div className="mt-8 flex justify-start">
            <Button
              asChild
              size="lg"
              className="bg-[#E8DCC4] text-black px-8 py-4 rounded-md hover:bg-[#FAF6ED]/90 transition"
            >
              <Link href="/sign-up">Try For Free</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Use Cases Section - Added more padding */}
      <section className="py-32 px-4 bg-[#050505]">
        <div className="max-w-4xl mx-auto text-left space-y-12">
          <Article>
            <ArticleTitle className="text-3xl md:text-4xl font-bold text-white">
              Use Cases
            </ArticleTitle>
            <ArticleContent className="mt-4 text-lg md:text-xl text-gray-300">
              Empowering your career journey with actionable insights.
            </ArticleContent>
          </Article>
          <motion.div
            className="mt-8 space-y-8"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            {/* Card 1: Resuming Mechanism */}
            <motion.div
              className="bg-[#050505] p-6 rounded-lg shadow-md transition-all duration-base ease-default group border border-[#E8DCC4]"
              variants={itemVariants}
            >
              <h3 className="text-xl font-semibold text-[#E8DCC4] mb-2">Resuming Mechanism</h3>
              <ArticleContent className="text-sm text-gray-300 mb-2">
                <strong>Specialized Areas</strong>
              </ArticleContent>
              <ul className="list-disc list-inside text-gray-300 mb-4">
                <li className="flex items-center gap-1">
                  <Check className="w-4 h-4 text-[#E8DCC4]" /> Analyze PDF Document
                </li>
                <li className="flex items-center gap-1">
                  <Check className="w-4 h-4 text-[#E8DCC4]" /> Compare To Perfect CVs
                </li>
                <li className="flex items-center gap-1">
                  <Check className="w-4 h-4 text-[#E8DCC4]" /> Wanted Job Description Injection
                </li>
              </ul>
              <ArticleContent className="text-sm text-gray-300 mb-2">
                <strong>Trained Model "Resuming"</strong>
              </ArticleContent>
              <ul className="list-disc list-inside text-gray-300">
                <li className="flex items-center gap-1">
                  <Check className="w-4 h-4 text-[#E8DCC4]" /> Knowledge On High Level CV Building
                </li>
                <li className="flex items-center gap-1">
                  <Check className="w-4 h-4 text-[#E8DCC4]" /> Job Compatibility Scoring
                </li>
                <li className="flex items-center gap-1">
                  <Check className="w-4 h-4 text-[#E8DCC4]" /> Customizable Path For Each User
                </li>
              </ul>
            </motion.div>
            {/* Card 2: Current Training Process */}
            <motion.div
              className="bg-[#050505] p-6 rounded-lg shadow-md transition-all duration-base ease-default group border border-[#E8DCC4]"
              variants={itemVariants}
            >
              <h3 className="text-xl font-semibold text-[#E8DCC4] mb-2">Current Training Process</h3>
              <ul className="list-disc list-inside text-gray-300">
                <li>
                  <strong>CV Industry Recognition:</strong> For less description injection and a more seamless path.
                </li>
                <li>
                  <strong>Analytics Suite:</strong> For users who want Resuming to guide their career choices.
                </li>
                <li>
                  <strong>Portfolio Optimization:</strong> Enhance and organize your portfolio to represent your best image, tailored for Artists and Finance professionals.
                </li>
              </ul>
            </motion.div>
          </motion.div>
          {/* Use Cases Section Button */}
          <div className="mt-8 flex justify-start">
            <Button
              asChild
              size="lg"
              className="bg-[#E8DCC4] text-[#050505] px-8 py-4 rounded-md hover:bg-[#FAF6ED]/90 transition"
            >
              <Link href="https://chromad.vercel.app/">Be There First</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#050505] text-[#E8DCC4] py-12">
        <div className="container mx-auto px-4 text-center">
          <div className="flex justify-center space-x-6 mb-6">
            <a
              href="https://twitter.com/resumingai"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#E8DCC4] hover:text-white transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" className="fill-current">
                <path d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H1.474l8.6-9.83L0 1.154h7.594l5.243 6.932L18.901 1.153Z" />
              </svg>
            </a>
            <a
              href="https://linkedin.com/company/resuming"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#E8DCC4] hover:text-white transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" className="fill-current">
                <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5Zm-11 19h-3v-11h3v11Zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.784 1.764-1.75 1.764Z" />
              </svg>
            </a>
            <a
              href="https://instagram.com/resuming"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#E8DCC4] hover:text-white transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" className="fill-current">
                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.148 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.148-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069Zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.197-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.948-.073Zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162Zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4Zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44Z" />
              </svg>
            </a>
          </div>
          <p className="text-sm opacity-70">© 2025 Resuming. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
