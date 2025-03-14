"use client";

import { Navbar } from "@/components/ui/navbar";
import { Article, ArticleTitle, ArticleContent } from "@/components/ui/article";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { motion } from "framer-motion";
import { Calendar, Clock, ArrowRight } from "lucide-react";

export default function BlogPage() {
  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.3,
      },
    },
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: {
        type: "spring",
        stiffness: 80,
        damping: 15,
      },
    },
  };

  return (
    <div className="flex flex-col bg-[#050505] min-h-screen">
      {/* Navbar */}
      <Navbar />

      {/* Blog Header Section */}
      <motion.section 
        className="pt-24 pb-16 px-4"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <div className="max-w-6xl mx-auto">
          <Article>
            <ArticleTitle className="text-4xl md:text-5xl font-bold text-white text-center mb-6">
              Resuming Blog
            </ArticleTitle>
            <ArticleContent className="text-xl text-gray-300 text-center max-w-3xl mx-auto">
              Insights, guides, and expert advice to help you optimize your career journey and make the most of your professional potential.
            </ArticleContent>
          </Article>
        </div>
      </motion.section>

      {/* Featured Article */}
      <motion.section 
        className="py-12 px-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2, duration: 0.8 }}
      >
        <div className="max-w-6xl mx-auto">
          <motion.div 
            className="bg-[#0A0A0A] rounded-xl overflow-hidden shadow-xl"
            whileHover={{ scale: 1.01 }}
            transition={{ duration: 0.3 }}
          >
            <div className="grid md:grid-cols-2 gap-6">
              <div className="h-64 md:h-auto relative overflow-hidden">
                <motion.img 
                  src="/blog/featured-post.jpg" 
                  alt="Featured post" 
                  className="w-full h-full object-cover"
                  initial={{ scale: 1.1 }}
                  animate={{ scale: 1 }}
                  transition={{ duration: 1.5 }}
                  onError={(e) => {
                    e.currentTarget.src = "https://images.unsplash.com/photo-1486312338219-ce68d2c6f44d";
                  }}
                />
              </div>
              <div className="p-8 flex flex-col justify-center">
                <div className="flex items-center text-sm text-gray-400 mb-4">
                  <Calendar className="w-4 h-4 mr-2" />
                  <span>June 12, 2025</span>
                  <span className="mx-2">•</span>
                  <Clock className="w-4 h-4 mr-2" />
                  <span>5 min read</span>
                </div>
                <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">
                  How AI is Revolutionizing the Job Application Process
                </h2>
                <p className="text-gray-300 mb-6">
                  Discover how artificial intelligence is transforming the way candidates apply for jobs and how employers screen applications, making the process more efficient and effective for everyone involved.
                </p>
                <Button
                  asChild
                  variant="outline"
                  className="self-start border border-[#E8DCC4] text-[#E8DCC4] hover:bg-[#E8DCC4] hover:text-black transition-colors"
                >
                  <Link href="/blog/ai-revolutionizing-job-applications" className="flex items-center">
                    Read more <ArrowRight className="ml-2 w-4 h-4" />
                  </Link>
                </Button>
              </div>
            </div>
          </motion.div>
        </div>
      </motion.section>

      {/* Blog Posts Grid */}
      <section className="py-16 px-4">
        <div className="max-w-6xl mx-auto">
          <motion.h2 
            className="text-3xl font-bold text-white mb-12"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
          >
            Latest Articles
          </motion.h2>
          
          <motion.div 
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            {/* Blog Post 1 */}
            <motion.div 
              className="bg-[#0A0A0A] rounded-lg overflow-hidden shadow-lg hover:shadow-xl transition-shadow"
              variants={itemVariants}
              whileHover={{ y: -5 }}
              transition={{ duration: 0.3 }}
            >
              <div className="h-48 overflow-hidden">
                <img 
                  src="/blog/post-1.jpg" 
                  alt="Blog post" 
                  className="w-full h-full object-cover transition-transform hover:scale-105 duration-500"
                  onError={(e) => {
                    e.currentTarget.src = "https://images.unsplash.com/photo-1499750310107-5fef28a66643";
                  }}
                />
              </div>
              <div className="p-6">
                <div className="flex items-center text-sm text-gray-400 mb-3">
                  <Calendar className="w-4 h-4 mr-2" />
                  <span>May 28, 2025</span>
                  <span className="mx-2">•</span>
                  <Clock className="w-4 h-4 mr-2" />
                  <span>3 min read</span>
                </div>
                <h3 className="text-xl font-bold text-white mb-3">
                  10 CV Mistakes That Are Costing You Interviews
                </h3>
                <p className="text-gray-300 mb-4">
                  Learn about the common CV mistakes that recruiters flag as red flags and how to avoid them to increase your interview chances.
                </p>
                <Link href="/blog/cv-mistakes" className="text-[#E8DCC4] hover:text-white flex items-center group">
                  Read more <ArrowRight className="ml-2 w-4 h-4 transition-transform group-hover:translate-x-1" />
                </Link>
              </div>
            </motion.div>

            {/* Blog Post 2 */}
            <motion.div 
              className="bg-[#0A0A0A] rounded-lg overflow-hidden shadow-lg hover:shadow-xl transition-shadow"
              variants={itemVariants}
              whileHover={{ y: -5 }}
              transition={{ duration: 0.3 }}
            >
              <div className="h-48 overflow-hidden">
                <img 
                  src="/blog/post-2.jpg" 
                  alt="Blog post" 
                  className="w-full h-full object-cover transition-transform hover:scale-105 duration-500"
                  onError={(e) => {
                    e.currentTarget.src = "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40";
                  }}
                />
              </div>
              <div className="p-6">
                <div className="flex items-center text-sm text-gray-400 mb-3">
                  <Calendar className="w-4 h-4 mr-2" />
                  <span>May 15, 2025</span>
                  <span className="mx-2">•</span>
                  <Clock className="w-4 h-4 mr-2" />
                  <span>4 min read</span>
                </div>
                <h3 className="text-xl font-bold text-white mb-3">
                  The Future of Work: Skills That Will Matter in 2026
                </h3>
                <p className="text-gray-300 mb-4">
                  Explore the emerging skills and competencies that employers will be looking for in the next year and how to develop them.
                </p>
                <Link href="/blog/future-skills" className="text-[#E8DCC4] hover:text-white flex items-center group">
                  Read more <ArrowRight className="ml-2 w-4 h-4 transition-transform group-hover:translate-x-1" />
                </Link>
              </div>
            </motion.div>

            {/* Blog Post 3 */}
            <motion.div 
              className="bg-[#0A0A0A] rounded-lg overflow-hidden shadow-lg hover:shadow-xl transition-shadow"
              variants={itemVariants}
              whileHover={{ y: -5 }}
              transition={{ duration: 0.3 }}
            >
              <div className="h-48 overflow-hidden">
                <img 
                  src="/blog/post-3.jpg" 
                  alt="Blog post" 
                  className="w-full h-full object-cover transition-transform hover:scale-105 duration-500"
                  onError={(e) => {
                    e.currentTarget.src = "https://images.unsplash.com/photo-1551434678-e076c223a692";
                  }}
                />
              </div>
              <div className="p-6">
                <div className="flex items-center text-sm text-gray-400 mb-3">
                  <Calendar className="w-4 h-4 mr-2" />
                  <span>May 3, 2025</span>
                  <span className="mx-2">•</span>
                  <Clock className="w-4 h-4 mr-2" />
                  <span>6 min read</span>
                </div>
                <h3 className="text-xl font-bold text-white mb-3">
                  How to Optimize Your LinkedIn Profile for Job Searches
                </h3>
                <p className="text-gray-300 mb-4">
                  A comprehensive guide to making your LinkedIn profile stand out to recruiters and algorithms in today's competitive job market.
                </p>
                <Link href="/blog/linkedin-optimization" className="text-[#E8DCC4] hover:text-white flex items-center group">
                  Read more <ArrowRight className="ml-2 w-4 h-4 transition-transform group-hover:translate-x-1" />
                </Link>
              </div>
            </motion.div>

            {/* Blog Post 4 */}
            <motion.div 
              className="bg-[#0A0A0A] rounded-lg overflow-hidden shadow-lg hover:shadow-xl transition-shadow"
              variants={itemVariants}
              whileHover={{ y: -5 }}
              transition={{ duration: 0.3 }}
            >
              <div className="h-48 overflow-hidden">
                <img 
                  src="/blog/post-4.jpg" 
                  alt="Blog post" 
                  className="w-full h-full object-cover transition-transform hover:scale-105 duration-500"
                  onError={(e) => {
                    e.currentTarget.src = "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2";
                  }}
                />
              </div>
              <div className="p-6">
                <div className="flex items-center text-sm text-gray-400 mb-3">
                  <Calendar className="w-4 h-4 mr-2" />
                  <span>April 22, 2025</span>
                  <span className="mx-2">•</span>
                  <Clock className="w-4 h-4 mr-2" />
                  <span>5 min read</span>
                </div>
                <h3 className="text-xl font-bold text-white mb-3">
                  Mastering the Virtual Interview: Tips from Hiring Managers
                </h3>
                <p className="text-gray-300 mb-4">
                  Insider advice from hiring managers on how to prepare for and excel in virtual interviews in the post-pandemic job market.
                </p>
                <Link href="/blog/virtual-interview-tips" className="text-[#E8DCC4] hover:text-white flex items-center group">
                  Read more <ArrowRight className="ml-2 w-4 h-4 transition-transform group-hover:translate-x-1" />
                </Link>
              </div>
            </motion.div>

            {/* Blog Post 5 */}
            <motion.div 
              className="bg-[#0A0A0A] rounded-lg overflow-hidden shadow-lg hover:shadow-xl transition-shadow"
              variants={itemVariants}
              whileHover={{ y: -5 }}
              transition={{ duration: 0.3 }}
            >
              <div className="h-48 overflow-hidden">
                <img 
                  src="/blog/post-5.jpg" 
                  alt="Blog post" 
                  className="w-full h-full object-cover transition-transform hover:scale-105 duration-500"
                  onError={(e) => {
                    e.currentTarget.src = "https://images.unsplash.com/photo-1522202176988-66273c2fd55f";
                  }}
                />
              </div>
              <div className="p-6">
                <div className="flex items-center text-sm text-gray-400 mb-3">
                  <Calendar className="w-4 h-4 mr-2" />
                  <span>April 10, 2025</span>
                  <span className="mx-2">•</span>
                  <Clock className="w-4 h-4 mr-2" />
                  <span>4 min read</span>
                </div>
                <h3 className="text-xl font-bold text-white mb-3">
                  Career Switching in 2025: A Strategic Approach
                </h3>
                <p className="text-gray-300 mb-4">
                  Practical strategies for professionals looking to pivot their careers in today's rapidly evolving job landscape.
                </p>
                <Link href="/blog/career-switching" className="text-[#E8DCC4] hover:text-white flex items-center group">
                  Read more <ArrowRight className="ml-2 w-4 h-4 transition-transform group-hover:translate-x-1" />
                </Link>
              </div>
            </motion.div>

            {/* Blog Post 6 */}
            <motion.div 
              className="bg-[#0A0A0A] rounded-lg overflow-hidden shadow-lg hover:shadow-xl transition-shadow"
              variants={itemVariants}
              whileHover={{ y: -5 }}
              transition={{ duration: 0.3 }}
            >
              <div className="h-48 overflow-hidden">
                <img 
                  src="/blog/post-6.jpg" 
                  alt="Blog post" 
                  className="w-full h-full object-cover transition-transform hover:scale-105 duration-500"
                  onError={(e) => {
                    e.currentTarget.src = "https://images.unsplash.com/photo-1552664730-d307ca884978";
                  }}
                />
              </div>
              <div className="p-6">
                <div className="flex items-center text-sm text-gray-400 mb-3">
                  <Calendar className="w-4 h-4 mr-2" />
                  <span>March 28, 2025</span>
                  <span className="mx-2">•</span>
                  <Clock className="w-4 h-4 mr-2" />
                  <span>7 min read</span>
                </div>
                <h3 className="text-xl font-bold text-white mb-3">
                  Salary Negotiation Tactics That Actually Work
                </h3>
                <p className="text-gray-300 mb-4">
                  Evidence-based approaches to negotiating your salary and benefits package that can significantly increase your compensation.
                </p>
                <Link href="/blog/salary-negotiation" className="text-[#E8DCC4] hover:text-white flex items-center group">
                  Read more <ArrowRight className="ml-2 w-4 h-4 transition-transform group-hover:translate-x-1" />
                </Link>
              </div>
            </motion.div>
          </motion.div>
          
          {/* Load More Button */}
          <motion.div 
            className="mt-12 text-center"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8, duration: 0.5 }}
          >
            <Button
              variant="outline"
              className="border border-[#E8DCC4] text-[#E8DCC4] hover:bg-[#E8DCC4] hover:text-black transition-colors px-8 py-2"
            >
              Load More Articles
            </Button>
          </motion.div>
        </div>
      </section>

      {/* Newsletter Section with animation */}
      <motion.section 
        className="py-16 px-4 bg-[#0A0A0A]"
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.8 }}
      >
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-white mb-4">Stay Updated</h2>
          <p className="text-gray-300 mb-8 max-w-2xl mx-auto">
            Subscribe to our newsletter to receive the latest career insights, CV optimization tips, and exclusive content directly to your inbox.
          </p>
          <motion.div 
            className="flex flex-col sm:flex-row gap-4 justify-center max-w-lg mx-auto"
            initial={{ y: 20, opacity: 0 }}
            whileInView={{ y: 0, opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2, duration: 0.5 }}
          >
            <input
              type="email"
              placeholder="Your email address"
              className="px-4 py-3 bg-[#1A1A1A] text-white border border-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-[#E8DCC4] flex-grow"
            />
            <Button className="bg-[#E8DCC4] text-black hover:bg-[#FAF6ED]/90 transition px-6">
              Subscribe
            </Button>
          </motion.div>
        </div>
      </motion.section>

      {/* Footer */}
      <footer className="bg-[#050505] text-[#E8DCC4] py-12">
        <div className="container mx-auto px-4 text-center">
          <div className="flex justify-center space-x-6 mb-6">
            <a
              href="https://x.com/chromadai"
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
              href="https://www.instagram.com/resuming_ai/"
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