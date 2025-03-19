"use client";

import { useState, useEffect } from "react";
import { Navbar } from "@/components/ui/navbar";
import { Article, ArticleTitle, ArticleContent } from "@/components/ui/article";
import { Button } from "@/components/ui/button";
import { PremiumCard, PremiumCardContent } from "@/components/ui/premium-card";
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
  const [inputWidth, setInputWidth] = useState("300px"); // Default width
  
  // Filter posts based on search term
  const filteredPosts = searchTerm === "" 
    ? blogPosts 
    : blogPosts.filter(post => 
        post.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
        post.excerpt.toLowerCase().includes(searchTerm.toLowerCase()) ||
        post.category.toLowerCase().includes(searchTerm.toLowerCase())
      );

  // Animate through placeholder text and adjust width
  useEffect(() => {
    const interval = setInterval(() => {
      setPlaceholderIndex(prevIndex => {
        const nextIndex = (prevIndex + 1) % searchPlaceholders.length;
        setCurrentPlaceholder(searchPlaceholders[nextIndex]);
        
        // Calculate approximate width based on text length
        // Base width + character count * approximate character width
        const baseWidth = 60; // For padding, icon, etc.
        const charWidth = 8; // Approximate width per character in pixels
        const textWidth = searchPlaceholders[nextIndex].length * charWidth;
        const newWidth = Math.max(300, baseWidth + textWidth); // Minimum 300px
        
        setInputWidth(`${newWidth}px`);
        return nextIndex;
      });
    }, 3000);
    
    return () => clearInterval(interval);
  }, []);

  // Adjust width when typing
  useEffect(() => {
    if (searchTerm) {
      const baseWidth = 60;
      const charWidth = 8;
      const textWidth = searchTerm.length * charWidth;
      const newWidth = Math.max(300, baseWidth + textWidth); // Minimum 300px
      setInputWidth(`${newWidth}px`);
    } else {
      // When empty, use the current placeholder width
      const baseWidth = 60;
      const charWidth = 8;
      const textWidth = currentPlaceholder.length * charWidth;
      const newWidth = Math.max(300, baseWidth + textWidth);
      setInputWidth(`${newWidth}px`);
    }
  }, [searchTerm, currentPlaceholder]);

  return (
    <div className="flex flex-col bg-[#050505] min-h-screen text-[#F9F6EE]">
      <Navbar />
      
      <div className="container mx-auto px-4 pt-24 pb-16">
        <h1 className="text-4xl md:text-5xl font-bold text-[#F9F6EE] mb-8 text-center font-safiro tracking-tight">Blogs & Articles</h1>
        <p className="text-[#C5C2BA] text-center max-w-2xl mx-auto mb-12 font-borna">
          Explore our latest insights, tips, and strategies for optimizing your career journey and making the most of our AI-powered tools.
        </p>
        
        {/* Animated Search Bar */}
        <div className="flex justify-center mb-12">
          <motion.div 
            className="relative"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            style={{ width: inputWidth }}
          >
            <motion.div 
              className="relative"
              animate={{ width: inputWidth }}
              transition={{ duration: 0.5, ease: "easeInOut" }}
            >
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-[#111111] text-[#F9F6EE] border border-[#222222] rounded-full py-3 px-5 pl-12 focus:outline-none focus:ring-2 focus:ring-[#B4916C] transition-all font-borna"
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
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-[#8A8782] w-5 h-5" />
            </motion.div>
          </motion.div>
        </div>
        
        {/* Featured Article */}
        {filteredPosts.length > 0 && (
          <div className="grid md:grid-cols-3 gap-8 mb-16">
            <div className="md:col-span-2">
              <Link href={`/blog/${filteredPosts[0].slug}`}>
                <motion.div 
                  className="group relative h-[400px] rounded-xl overflow-hidden"
                  whileHover={{ scale: 1.02 }}
                  transition={{ duration: 0.3 }}
                >
                  <div className="absolute inset-0 bg-gradient-to-t from-[#000000] via-[#00000080] to-transparent z-10"></div>
                  <img 
                    src={filteredPosts[0].image} 
                    alt={filteredPosts[0].title} 
                    className="w-full h-full object-cover transition-transform group-hover:scale-105 duration-500"
                    onError={(e) => {
                      e.currentTarget.src = filteredPosts[0].fallbackImage;
                    }}
                  />
                  <div className="absolute inset-0 z-20 flex flex-col justify-end p-6">
                    <span className="inline-block bg-[#111111]/80 text-[#B4916C] px-3 py-1 rounded-lg text-sm mb-4 font-borna">
                      {filteredPosts[0].category}
                    </span>
                    <h2 className="text-2xl md:text-3xl font-bold text-[#F9F6EE] mb-3 group-hover:text-[#B4916C] transition-colors font-safiro tracking-tight">
                      {filteredPosts[0].title}
                    </h2>
                    <p className="text-[#C5C2BA] mb-4 font-borna">
                      {filteredPosts[0].excerpt}
                    </p>
                    <div className="flex items-center text-sm text-[#8A8782] font-borna">
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
                    className="group flex flex-col h-[190px] bg-[#111111] rounded-xl overflow-hidden border border-[#222222] hover:border-[#B4916C] transition-colors"
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
                      <span className="text-xs text-[#B4916C] mb-1 font-borna">{post.category}</span>
                      <h3 className="text-[#F9F6EE] font-semibold mb-1 line-clamp-1 group-hover:text-[#B4916C] transition-colors font-safiro">
                        {post.title}
                      </h3>
                      <div className="flex items-center text-xs text-[#8A8782] mt-auto font-borna">
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
            <h2 className="text-2xl font-bold text-[#F9F6EE] mb-8 font-safiro tracking-tight">More Articles</h2>
            <div className="grid md:grid-cols-3 gap-6">
              {filteredPosts.slice(3).map((post) => (
                <Link href={`/blog/${post.slug}`} key={post.id}>
                  <motion.div 
                    whileHover={{ y: -5 }}
                    transition={{ duration: 0.3 }}
                    className="group overflow-hidden h-full"
                  >
                    <PremiumCard className="h-full">
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
                      <PremiumCardContent className="p-6">
                        <span className="inline-block text-[#B4916C] text-sm mb-2 font-borna">{post.category}</span>
                        <h3 className="text-xl font-bold text-[#F9F6EE] mb-3 group-hover:text-[#B4916C] transition-colors font-safiro tracking-tight">
                          {post.title}
                        </h3>
                        <p className="text-[#C5C2BA] mb-4 line-clamp-2 font-borna">
                          {post.excerpt}
                        </p>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center text-sm text-[#8A8782] font-borna">
                            <Calendar className="w-4 h-4 mr-2" />
                            <span>{post.date}</span>
                            <span className="mx-3">•</span>
                            <Clock className="w-4 h-4 mr-2" />
                            <span>{post.readTime}</span>
                          </div>
                          <motion.span 
                            className="text-[#B4916C] flex items-center font-borna"
                            whileHover={{ x: 5 }}
                          >
                            Read more <ArrowRight className="ml-1 w-4 h-4" />
                          </motion.span>
                        </div>
                      </PremiumCardContent>
                    </PremiumCard>
                  </motion.div>
                </Link>
              ))}
            </div>
          </div>
        )}
        
        {/* No Results */}
        {filteredPosts.length === 0 && (
          <div className="text-center py-16">
            <h2 className="text-2xl font-bold text-[#F9F6EE] mb-4 font-safiro">No articles found</h2>
            <p className="text-[#C5C2BA] mb-8 font-borna">Try adjusting your search terms or browse all our articles.</p>
            <Button 
              onClick={() => setSearchTerm("")}
              className="bg-[#B4916C] text-[#050505] hover:bg-[#A3815B] transition font-safiro"
            >
              View All Articles
            </Button>
          </div>
        )}
      </div>
      
      {/* Footer */}
      <footer className="bg-[#0A0A0A] border-t border-[#222222] py-12">
        <div className="container mx-auto px-4 text-center">
          <p className="text-[#8A8782] mb-6 font-borna">© 2025 CV Optimizer. All rights reserved.</p>
          <div className="flex justify-center space-x-6">
            <a href="/terms" className="text-[#8A8782] hover:text-[#B4916C] transition-colors font-borna">
              Terms
            </a>
            <a href="/privacy" className="text-[#8A8782] hover:text-[#B4916C] transition-colors font-borna">
              Privacy
            </a>
            <a href="/contact" className="text-[#8A8782] hover:text-[#B4916C] transition-colors font-borna">
              Contact
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
} 