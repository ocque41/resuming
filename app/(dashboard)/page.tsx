"use client";

import { Navbar } from "@/components/ui/navbar";
import { Badge } from "@/components/ui/badge";
import { Article, ArticleTitle, ArticleContent } from "@/components/ui/article";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, TrendingUp, Shield, Check } from "lucide-react";
import { GradientCard } from "@/components/ui/gradient-card";
import { motion, Variants } from "framer-motion";
import Link from "next/link";

export default function HomePage() {
  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.15,
        delayChildren: 0.3,
        duration: 0.6,
        ease: "easeOut"
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
        stiffness: 80,
        damping: 15,
        duration: 0.8
      }
    }
  };

  return (
    <div className="flex flex-col bg-[#050505]">
      {/* Navbar */}
      <Navbar />

      {/* Hero Section */}
      <section className="relative flex items-center bg-black pt-2">
        {/* Background overlay */}
        <div className="absolute inset-0 bg-[url('/hero-bg.jpg')] bg-cover bg-center opacity-30"></div>
        <div className="relative z-10 max-w-4xl mx-auto px-4 md:px-8 text-left">
          {/* Badge above title with link */}
          <div className="mb-2">
            <Link href="https://chromad.vercel.app/docs/products/resuming">
              <Badge variant="outline">Documentation -&gt;</Badge>
            </Link>
          </div>
          <Article>
            <ArticleTitle className="text-5xl md:text-7xl font-bold text-white">
              The Jobs Playground
            </ArticleTitle>
            <ArticleContent className="mt-4 text-xl md:text-2xl text-gray-300">
              AI-powered CV Analysis &amp; Optimization unlocking exclusive career opportunities.
            </ArticleContent>
            <div className="mt-8 flex flex-col md:flex-row gap-4">
              <Button
                asChild
                size="lg"
                className="bg-[#584235] text-white px-8 py-4 rounded-md hover:bg-[#584235]/90 transition"
              >
                <Link href="/sign-up">Try For Free</Link>
              </Button>
              <Button
                asChild
                variant="outline"
                size="lg"
                className="border border-[#2C2420] text-[#2C2420] px-8 py-4 rounded-md hover:bg-[#2C2420] hover:text-white transition"
              >
                <Link href="/pricing">Learn More</Link>
              </Button>
            </div>
          </Article>
          {/* Image placeholder below buttons */}
          <div className="mt-8 w-full max-w-md h-64 bg-gray-300 rounded-lg"></div>
        </div>
      </section>

      {/* Products Section */}
      <section className="min-h-[100dvh] flex items-center justify-center px-4 py-8">
        <motion.div
          className="w-full max-w-7xl mx-auto py-16"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          <Article className="mb-6 text-center">
            <ArticleTitle className="text-2xl md:text-3xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-[#584235] via-[#B4916C] to-[#2C2420]">
              Products
            </ArticleTitle>
          </Article>
          <GradientCard className="mx-auto flex flex-col justify-center bg-[#1A1614]/80 backdrop-blur-lg border border-[#E8DCC4]">
            <Tabs defaultValue="pro" className="w-full max-w-4xl mx-auto">
              <TabsList className="grid w-full grid-cols-3 bg-[#2C2420]">
                <TabsTrigger value="pro" className="text-[#B4916C] data-[state=active]:bg-[#584235] data-[state=active]:text-white">
                  Pro
                </TabsTrigger>
                <TabsTrigger value="moonlighting" className="text-[#B4916C] data-[state=active]:bg-[#584235] data-[state=active]:text-white">
                  Moonlighting
                </TabsTrigger>
                <TabsTrigger value="ceo" className="text-[#B4916C] data-[state=active]:bg-[#584235] data-[state=active]:text-white">
                  CEO
                </TabsTrigger>
              </TabsList>
              <TabsContent value="pro">
                <article className="uk-article text-center space-y-6 p-8">
                  <h3 className="text-3xl font-semibold text-[#B4916C]">Pro Plan</h3>
                  <p className="text-xl text-[#E8DCC4]">$7.99/month</p>
                  <p className="uk-article-meta text-[#B4916C]/80">
                    Perfect for professionals starting their career journey
                  </p>
                  <div className="uk-article-content space-y-4 max-w-2xl mx-auto text-[#E8DCC4]">
                    <p>
                      The Pro Plan is designed for individuals who are actively seeking new opportunities and want to optimize their CV for better results.
                    </p>
                    <ul className="space-y-4 max-w-md mx-auto text-left">
                      <li className="flex items-center text-[#B4916C]">
                        <Check className="mr-2" /> 20 CV uploads/month
                      </li>
                      <li className="flex items-center text-[#B4916C]">
                        <Check className="mr-2" /> 10 ATS analyses/month
                      </li>
                      <li className="flex items-center text-[#B4916C]">
                        <Check className="mr-2" /> 7 Optimizations/month
                      </li>
                    </ul>
                  </div>
                  <div className="mt-8 flex justify-center">
                    <Button asChild variant="secondary" className="bg-[#050505]">
                      <Link href="/pricing">Details</Link>
                    </Button>
                  </div>
                </article>
              </TabsContent>
              <TabsContent value="moonlighting">
                <article className="uk-article text-center space-y-6 p-8">
                  <h3 className="text-3xl font-semibold text-[#B4916C]">Moonlighting Plan</h3>
                  <p className="text-xl text-[#E8DCC4]">$14.99/month</p>
                  <p className="uk-article-meta text-[#B4916C]/80">
                    Ideal for professionals managing multiple career paths
                  </p>
                  <div className="uk-article-content space-y-4 max-w-2xl mx-auto text-[#E8DCC4]">
                    <p>
                      The Moonlighting Plan caters to professionals who maintain multiple career tracks or frequently apply to different types of positions.
                    </p>
                    <ul className="space-y-4 max-w-md mx-auto text-left">
                      <li className="flex items-center text-[#B4916C]">
                        <Check className="mr-2" /> Unlimited CV uploads/month
                      </li>
                      <li className="flex items-center text-[#B4916C]">
                        <Check className="mr-2" /> 20 ATS analyses/month
                      </li>
                      <li className="flex items-center text-[#B4916C]">
                        <Check className="mr-2" /> 15 Optimizations/month
                      </li>
                    </ul>
                  </div>
                  <div className="mt-8 flex justify-center">
                    <Button asChild variant="secondary" className="bg-[#050505]">
                      <Link href="/pricing">Details</Link>
                    </Button>
                  </div>
                </article>
              </TabsContent>
              <TabsContent value="ceo">
                <article className="uk-article text-center space-y-6 p-8">
                  <h3 className="text-3xl font-semibold text-[#B4916C]">CEO Plan</h3>
                  <p className="text-xl text-[#E8DCC4]">$99.99/month</p>
                  <p className="uk-article-meta text-[#B4916C]/80">
                    For executives and leaders aiming for top positions
                  </p>
                  <div className="uk-article-content space-y-4 max-w-2xl mx-auto text-[#E8DCC4]">
                    <p>
                      The CEO Plan is our premium offering for executives and senior professionals. With unlimited access to all features and our job guarantee, this plan ensures you'll secure the high-level position you deserve.
                    </p>
                    <ul className="space-y-4 max-w-md mx-auto text-left">
                      <li className="flex items-center text-[#B4916C]">
                        <Check className="mr-2" /> Unlimited Everything
                      </li>
                      <li className="flex items-center text-[#B4916C]">
                        <Check className="mr-2" /> Early access to features
                      </li>
                      <li className="flex items-center text-[#B4916C]">
                        <Check className="mr-2" /> The Position You Desire In 3 Months or Money Back Guaranteed
                      </li>
                    </ul>
                  </div>
                  <div className="mt-8 flex justify-center">
                    <Button asChild variant="secondary" className="bg-[#050505]">
                      <Link href="/pricing">Details</Link>
                    </Button>
                  </div>
                </article>
              </TabsContent>
            </Tabs>
            <div className="mt-8 flex justify-center">
              {/* Additional Buttons if needed */}
            </div>
          </GradientCard>
        </motion.div>
      </section>

      {/* Additional Content Section */}
      <div className="container mx-auto px-4 py-16">
        <motion.div
          className="max-w-7xl mx-auto space-y-16"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          <motion.section className="grid md:grid-cols-3 gap-8" variants={containerVariants}>
            {[
              {
                icon: FileText,
                title: "AI-Powered Document Analysis",
                description: "Intelligent content analysis with automated scoring and format preservation",
                bgColor: "bg-[#2C2420]",
                textColor: "text-[#B4916C]",
              },
              {
                icon: TrendingUp,
                title: "Job-CV Matching System",
                description: "Real-time CV optimization with percentage-based job compatibility scoring",
                bgColor: "bg-[#584235]",
                textColor: "text-[#E8DCC4]",
              },
              {
                icon: Shield,
                title: "Geospatial Integration",
                description: "Location-based job mapping with interactive scoring visualization",
                bgColor: "bg-[#2C2420]",
                textColor: "text-[#B4916C]",
              },
            ].map(({ icon: Icon, title, description, bgColor, textColor }) => (
              <motion.div
                key={title}
                className={`${bgColor} p-6 rounded-lg shadow-md hover:shadow-xl transition-all duration-base ease-default group border border-[#E8DCC4] hover:border-[#E8DCC4]`}
                variants={itemVariants}
              >
                <Icon className={`mx-auto mb-4 ${textColor} group-hover:scale-110 transition-all duration-300`} size={48} />
                <h3 className={`text-2xl font-semibold mb-4 ${textColor}`}>{title}</h3>
                <p className={`${textColor} opacity-70 group-hover:opacity-100 transition-colors`}>
                  {description}
                </p>
              </motion.div>
            ))}
          </motion.section>
        </motion.div>
      </div>

      {/* Footer */}
      <footer className="bg-[#050505] text-[#E8DCC4] py-12 mt-16">
        <div className="container mx-auto px-4 text-center">
          <div className="flex justify-center space-x-6 mb-6">
            <a
              href="https://twitter.com/resumingai"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#B4916C] hover:text-white transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" className="fill-current">
                <path d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H1.474l8.6-9.83L0 1.154h7.594l5.243 6.932L18.901 1.153Z" />
              </svg>
            </a>
            <a
              href="https://linkedin.com/company/resuming"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#B4916C] hover:text-white transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" className="fill-current">
                <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5Zm-11 19h-3v-11h3v11Zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.784 1.764-1.75 1.764Z" />
              </svg>
            </a>
            <a
              href="https://instagram.com/resuming"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#B4916C] hover:text-white transition-colors"
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
