"use client";

import { useState } from "react";
import { Navbar } from "@/components/ui/navbar";
import { Article, ArticleTitle, ArticleContent } from "@/components/ui/article";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Calendar, Clock, ArrowRight, Tag } from "lucide-react";

// Sample blog post data with categories - reduced to 3 articles
const blogPosts = [
  {
    id: 1,
    title: "The Jobs Playground",
    excerpt: "Explore all AI possibilities tailored for generating, editing and improving paper ready documents. Discover how our platform revolutionizes your career journey.",
    content: `In today's competitive job market, having the right tools at your disposal can make all the difference in your career journey. The Jobs Playground is your all-in-one solution for document creation, optimization, and career advancement.

Our platform offers a comprehensive suite of AI-powered tools designed to streamline your professional documentation needs and enhance your job search experience. Let's explore the key features that make The Jobs Playground an essential resource for professionals at any stage of their career.

## CV Collection and Management

Organize all your professional documents in one secure location. Our platform allows you to:
- Store multiple versions of your CV for different industries and positions
- Track document versions and changes over time
- Access your documents from anywhere, on any device
- Share your documents securely with potential employers

## CV Optimization

Stand out from the crowd with our AI-powered CV optimization tools:
- Receive personalized recommendations to enhance your CV's impact
- Identify and fix common CV mistakes that could be costing you interviews
- Optimize keyword placement for better ATS (Applicant Tracking System) performance
- Get industry-specific suggestions tailored to your target roles

## Document Generation

Create professional-quality documents in minutes:
- Generate tailored CVs for specific job applications
- Create compelling cover letters that complement your CV
- Develop professional portfolios to showcase your work
- Design presentation-ready documents for any professional purpose

## Document Analysis

Gain valuable insights through our advanced document analysis:
- Receive detailed feedback on your document's strengths and weaknesses
- Compare your CV against industry standards and best practices
- Identify skill gaps and opportunities for professional development
- Get readability scores and suggestions for improved clarity

## Job Opportunities

Find your next career move with our integrated job search tools:
- Discover job opportunities matched to your skills and experience
- Receive personalized job recommendations based on your profile
- Track application status and manage your job search efficiently
- Connect with potential employers directly through our platform

## Use Cases

The Jobs Playground is designed to support professionals across various scenarios:

- **Career Advancement**: Upgrade your CV to reflect your general career vision and goals
- **Targeted Applications**: Tailor your CV for specific job opportunities in seconds
- **Document Creation**: Generate any professional document for any task
- **Content Editing**: Edit existing documents to enhance their impact and effectiveness
- **Deep Analysis**: Run comprehensive analysis on any document for valuable insights
- **Job Matching**: Apply to positions with our intelligent job matching system
- **Visual Decision Making**: Utilize our List and Map views for easier decision-making processes

Whether you're a recent graduate entering the job market, a professional looking to change careers, or an executive aiming for advancement, The Jobs Playground provides the tools and resources you need to succeed in today's competitive landscape.

Start exploring the possibilities today and transform your career journey with the power of AI-driven document optimization and job search tools.`,
    date: "June 1, 2025",
    readTime: "7 min read",
    image: "/articles/1.webp",
    fallbackImage: "https://images.unsplash.com/photo-1486312338219-ce68d2c6f44d",
    slug: "jobs-playground",
    category: "Platform Overview"
  },
  {
    id: 2,
    title: "The Future of Work: Skills That Will Matter in 2026",
    excerpt: "Explore the emerging skills and competencies that employers will be looking for in the next year and how to develop them.",
    content: "The workplace is evolving at an unprecedented pace, driven by technological advancements, changing economic landscapes, and shifting social priorities. To stay competitive in this dynamic environment, professionals need to continuously adapt and develop new skills.",
    date: "May 15, 2025",
    readTime: "4 min read",
    image: "/blog/post-2.jpg",
    fallbackImage: "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40",
    slug: "future-skills",
    category: "Career Advice"
  },
  {
    id: 3,
    title: "How to Optimize Your LinkedIn Profile for Job Searches",
    excerpt: "A comprehensive guide to making your LinkedIn profile stand out to recruiters and algorithms in today's competitive job market.",
    content: "LinkedIn has become an essential platform for professional networking and job hunting. With over 740 million users worldwide, standing out from the crowd requires strategic optimization of your profile. This guide provides step-by-step instructions to enhance your LinkedIn presence.",
    date: "May 3, 2025",
    readTime: "6 min read",
    image: "/blog/post-3.jpg",
    fallbackImage: "https://images.unsplash.com/photo-1551434678-e076c223a692",
    slug: "linkedin-optimization",
    category: "Job Search"
  }
];

// Get unique categories
const categories = ["All", ...new Set(blogPosts.map(post => post.category))];

export default function BlogPage() {
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");

  // Filter posts based on category and search query
  const filteredPosts = blogPosts.filter(post => {
    const matchesCategory = selectedCategory === "All" || post.category === selectedCategory;
    const matchesSearch = post.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          post.excerpt.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

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

  // Featured post is the first one
  const featuredPost = blogPosts[0];

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
          
          {/* Category Pills */}
          <div className="flex flex-wrap justify-center gap-2 mt-10">
            {categories.map((category) => (
              <motion.button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`px-4 py-2 rounded-full text-sm transition-colors ${
                  selectedCategory === category
                    ? "bg-[#E8DCC4] text-black font-medium"
                    : "bg-[#1A1A1A] text-gray-300 hover:bg-[#252525]"
                }`}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                {category}
              </motion.button>
            ))}
          </div>
        </div>
      </motion.section>

      {/* Main Content Area with Featured Article and Side Articles */}
      <div className="px-4 pb-16">
        <div className="max-w-6xl mx-auto grid lg:grid-cols-12 gap-8">
          {/* Featured Article - Takes 8 columns on desktop, full width on mobile */}
          <motion.div 
            className="lg:col-span-8"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8 }}
          >
            <div className="bg-[#0A0A0A] rounded-xl overflow-hidden shadow-xl">
              <div className="relative h-80 md:h-96 overflow-hidden">
                <img 
                  src={blogPosts[0].image} 
                  alt={blogPosts[0].title} 
                  className="w-full h-full object-cover transition-transform hover:scale-105 duration-700"
                  onError={(e) => {
                    e.currentTarget.src = blogPosts[0].fallbackImage;
                  }}
                />
                <div className="absolute top-4 left-4">
                  <span className="bg-[#E8DCC4] text-black px-3 py-1 rounded-full text-sm font-medium">
                    {blogPosts[0].category}
                  </span>
                </div>
              </div>
              <div className="p-6 md:p-8">
                <div className="flex items-center text-sm text-gray-400 mb-4">
                  <Calendar className="w-4 h-4 mr-2" />
                  <span>{blogPosts[0].date}</span>
                  <span className="mx-2">•</span>
                  <Clock className="w-4 h-4 mr-2" />
                  <span>{blogPosts[0].readTime}</span>
                </div>
                <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">
                  {blogPosts[0].title}
                </h2>
                <p className="text-gray-300 mb-6 text-lg leading-relaxed">
                  {blogPosts[0].excerpt}
                </p>
                <div className="text-gray-300 mb-6 line-clamp-4 leading-relaxed">
                  {blogPosts[0].content.split('\n\n')[0]}
                </div>
                <div className="flex justify-between items-center">
                  <Link href={`/blog/${blogPosts[0].slug}`} className="inline-flex items-center bg-[#E8DCC4] text-black px-4 py-2 rounded-md hover:bg-[#FAF6ED]/90 transition group">
                    Read full article <ArrowRight className="ml-2 w-4 h-4 transition-transform group-hover:translate-x-1" />
                  </Link>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Side Articles - Takes 4 columns on desktop, full width on mobile */}
          <motion.div 
            className="lg:col-span-4"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            <h3 className="text-xl font-bold text-white mb-6">More Articles</h3>
            <div className="space-y-6">
              {blogPosts.slice(1).map((post) => (
                <motion.div 
                  key={post.id}
                  className="bg-[#0A0A0A] rounded-lg overflow-hidden shadow-lg hover:shadow-xl transition-shadow"
                  variants={itemVariants}
                  whileHover={{ y: -5 }}
                  transition={{ duration: 0.3 }}
                >
                  <div className="h-40 overflow-hidden">
                    <img 
                      src={post.image} 
                      alt={post.title} 
                      className="w-full h-full object-cover transition-transform hover:scale-105 duration-500"
                      onError={(e) => {
                        e.currentTarget.src = post.fallbackImage;
                      }}
                    />
                  </div>
                  <div className="p-4">
                    <div className="flex items-center text-xs text-gray-400 mb-2">
                      <Calendar className="w-3 h-3 mr-1" />
                      <span>{post.date}</span>
                      <span className="mx-1">•</span>
                      <Clock className="w-3 h-3 mr-1" />
                      <span>{post.readTime}</span>
                    </div>
                    <h3 className="text-lg font-bold text-white mb-2">
                      {post.title}
                    </h3>
                    <p className="text-gray-300 text-sm mb-3 line-clamp-2">
                      {post.excerpt}
                    </p>
                    <Link href={`/blog/${post.slug}`} className="text-[#E8DCC4] hover:text-white text-sm flex items-center group">
                      Read more <ArrowRight className="ml-1 w-3 h-3 transition-transform group-hover:translate-x-1" />
                    </Link>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>

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