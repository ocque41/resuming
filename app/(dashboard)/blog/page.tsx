"use client";

import { useState, useEffect } from "react";
import { Navbar } from "@/components/ui/navbar";
import { Article, ArticleTitle, ArticleContent } from "@/components/ui/article";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Calendar, Clock, ArrowRight, Search } from "lucide-react";

// Import blog posts from the data file
import { blogPosts } from "./data";

// Search placeholder suggestions
const searchPlaceholders = [
  "Search for CV optimization tips...",
  "Explore career advancement strategies...",
  "Discover AI-powered tools...",
  "Find document analysis techniques...",
  "Learn about job matching features..."
];

export default function BlogPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [currentPlaceholder, setCurrentPlaceholder] = useState(searchPlaceholders[0]);
  
  // Filter posts based on search term
  const filteredPosts = searchTerm === "" 
    ? blogPosts 
    : blogPosts.filter(post => 
        post.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
        post.excerpt.toLowerCase().includes(searchTerm.toLowerCase()) ||
        post.category.toLowerCase().includes(searchTerm.toLowerCase())
      );

  // Animate through placeholder text
  useEffect(() => {
    const interval = setInterval(() => {
      setPlaceholderIndex(prevIndex => {
        const nextIndex = (prevIndex + 1) % searchPlaceholders.length;
        setCurrentPlaceholder(searchPlaceholders[nextIndex]);
        return nextIndex;
      });
    }, 3000);
    
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col bg-[#050505] min-h-screen">
      <Navbar />
      
      <div className="container mx-auto px-4 pt-24 pb-16">
        <h1 className="text-4xl md:text-5xl font-bold text-white mb-8 text-center">Blogs & Articles</h1>
        <p className="text-gray-300 text-center max-w-2xl mx-auto mb-12">
          Explore our latest insights, tips, and strategies for optimizing your career journey and making the most of our AI-powered tools.
        </p>
        
        {/* Animated Search Bar */}
        <div className="flex justify-center mb-12">
          <motion.div 
            className="relative w-full max-w-md"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="relative">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-[#1A1A1A] text-white border border-[#333333] rounded-full py-3 px-5 pl-12 focus:outline-none focus:ring-2 focus:ring-[#B4916C] transition-all"
                placeholder={currentPlaceholder}
              />
              <AnimatePresence mode="wait">
                <motion.span
                  key={currentPlaceholder}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.5 }}
                  className="absolute inset-0 pointer-events-none"
                >
                  {/* This span is just for the animation */}
                </motion.span>
              </AnimatePresence>
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            </div>
          </motion.div>
        </div>
        
        {/* Featured Article */}
        {filteredPosts.length > 0 && (
          <div className="grid md:grid-cols-3 gap-8 mb-16">
            <div className="md:col-span-2">
              <Link href={`/blog/${filteredPosts[0].slug}`}>
                <motion.div 
                  className="group relative h-[400px] rounded-lg overflow-hidden"
                  whileHover={{ scale: 1.02 }}
                  transition={{ duration: 0.3 }}
                >
                  <div className="absolute inset-0 bg-black/50 z-10"></div>
                  <img 
                    src={filteredPosts[0].image} 
                    alt={filteredPosts[0].title} 
                    className="w-full h-full object-cover transition-transform group-hover:scale-105 duration-500"
                    onError={(e) => {
                      e.currentTarget.src = filteredPosts[0].fallbackImage;
                    }}
                  />
                  <div className="absolute inset-0 z-20 flex flex-col justify-end p-6">
                    <span className="inline-block bg-[#1A1A1A]/80 text-[#B4916C] px-3 py-1 rounded text-sm mb-4">
                      {filteredPosts[0].category}
                    </span>
                    <h2 className="text-2xl md:text-3xl font-bold text-white mb-3 group-hover:text-[#B4916C] transition-colors">
                      {filteredPosts[0].title}
                    </h2>
                    <p className="text-gray-300 mb-4">
                      {filteredPosts[0].excerpt}
                    </p>
                    <div className="flex items-center text-sm text-gray-400">
                      <Calendar className="w-4 h-4 mr-2" />
                      <span>{filteredPosts[0].date}</span>
                      <span className="mx-3">•</span>
                      <Clock className="w-4 h-4 mr-2" />
                      <span>{filteredPosts[0].readTime}</span>
                    </div>
                  </div>
                </motion.div>
              </Link>
            </div>
            
            {/* Side Articles */}
            <div className="space-y-6">
              {filteredPosts.slice(1, 3).map((post) => (
                <Link href={`/blog/${post.slug}`} key={post.id}>
                  <motion.div 
                    className="group flex flex-col h-[190px] bg-[#0A0A0A] rounded-lg overflow-hidden border border-[#1A1A1A] hover:border-[#B4916C] transition-colors"
                    whileHover={{ y: -5 }}
                    transition={{ duration: 0.3 }}
                  >
                    <div className="relative h-24 overflow-hidden">
                      <img 
                        src={post.image} 
                        alt={post.title} 
                        className="w-full h-full object-cover transition-transform group-hover:scale-105 duration-500"
                        onError={(e) => {
                          e.currentTarget.src = post.fallbackImage;
                        }}
                      />
                    </div>
                    <div className="p-4 flex-1 flex flex-col">
                      <span className="text-xs text-[#B4916C] mb-1">{post.category}</span>
                      <h3 className="text-white font-semibold mb-1 line-clamp-1 group-hover:text-[#B4916C] transition-colors">
                        {post.title}
                      </h3>
                      <div className="flex items-center text-xs text-gray-400 mt-auto">
                        <Calendar className="w-3 h-3 mr-1" />
                        <span>{post.date}</span>
                        <span className="mx-2">•</span>
                        <Clock className="w-3 h-3 mr-1" />
                        <span>{post.readTime}</span>
                      </div>
                    </div>
                  </motion.div>
                </Link>
              ))}
            </div>
          </div>
        )}
        
        {/* More Articles */}
        {filteredPosts.length > 3 && (
          <div>
            <h2 className="text-2xl font-bold text-white mb-8">More Articles</h2>
            <div className="grid md:grid-cols-3 gap-6">
              {filteredPosts.slice(3).map((post) => (
                <Link href={`/blog/${post.slug}`} key={post.id}>
                  <motion.div 
                    className="group bg-[#0A0A0A] rounded-lg overflow-hidden border border-[#1A1A1A] hover:border-[#B4916C] transition-colors"
                    whileHover={{ y: -5 }}
                    transition={{ duration: 0.3 }}
                  >
                    <div className="h-48 overflow-hidden">
                      <img 
                        src={post.image} 
                        alt={post.title} 
                        className="w-full h-full object-cover transition-transform group-hover:scale-105 duration-500"
                        onError={(e) => {
                          e.currentTarget.src = post.fallbackImage;
                        }}
                      />
                    </div>
                    <div className="p-6">
                      <span className="inline-block text-[#B4916C] text-sm mb-2">{post.category}</span>
                      <h3 className="text-xl font-bold text-white mb-3 group-hover:text-[#B4916C] transition-colors">
                        {post.title}
                      </h3>
                      <p className="text-gray-300 mb-4 line-clamp-2">
                        {post.excerpt}
                      </p>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center text-sm text-gray-400">
                          <Calendar className="w-4 h-4 mr-2" />
                          <span>{post.date}</span>
                          <span className="mx-3">•</span>
                          <Clock className="w-4 h-4 mr-2" />
                          <span>{post.readTime}</span>
                        </div>
                        <span className="text-[#B4916C] flex items-center group-hover:translate-x-1 transition-transform">
                          Read more <ArrowRight className="ml-1 w-4 h-4" />
                        </span>
                      </div>
                    </div>
                  </motion.div>
                </Link>
              ))}
            </div>
          </div>
        )}
        
        {/* No Results */}
        {filteredPosts.length === 0 && (
          <div className="text-center py-16">
            <h2 className="text-2xl font-bold text-white mb-4">No articles found</h2>
            <p className="text-gray-300 mb-8">Try adjusting your search terms or browse all our articles.</p>
            <Button 
              onClick={() => setSearchTerm("")}
              className="bg-[#B4916C] text-white hover:bg-[#B4916C]/90 transition"
            >
              View All Articles
            </Button>
          </div>
        )}
      </div>
      
      {/* Footer */}
      <footer className="bg-[#050505] border-t border-[#1A1A1A] py-12">
        <div className="container mx-auto px-4 text-center">
          <p className="text-gray-400 mb-6">© 2025 Resuming. All rights reserved.</p>
          <div className="flex justify-center space-x-6">
            <a href="#" className="text-gray-400 hover:text-[#B4916C] transition-colors">
              Terms
            </a>
            <a href="#" className="text-gray-400 hover:text-[#B4916C] transition-colors">
              Privacy
            </a>
            <a href="#" className="text-gray-400 hover:text-[#B4916C] transition-colors">
              Contact
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
} 