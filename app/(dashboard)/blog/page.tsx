"use client";

import { useState, useEffect, useRef } from "react";
import { Navbar } from "@/components/ui/navbar";
import { Article, ArticleTitle, ArticleContent } from "@/components/ui/article";
import { Button } from "@/components/ui/button";
import { PremiumCard, PremiumCardContent } from "@/components/ui/premium-card";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Calendar, Clock, ArrowRight, Search, Filter, X, Bookmark } from "lucide-react";

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

// Categories for filtering
const categories = [
  "All",
  ...Array.from(new Set(blogPosts.map(post => post.category)))
];

export default function BlogPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [currentPlaceholder, setCurrentPlaceholder] = useState(searchPlaceholders[0]);
  const [inputWidth, setInputWidth] = useState("300px"); 
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [showFilters, setShowFilters] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [savedPosts, setSavedPosts] = useState<number[]>([]);
  
  // Simulate loading state
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 800);
    
    return () => clearTimeout(timer);
  }, []);
  
  // Toggle save post
  const toggleSavePost = (postId: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    setSavedPosts(prev => 
      prev.includes(postId) 
        ? prev.filter(id => id !== postId) 
        : [...prev, postId]
    );
  };
  
  // Filter posts based on search term and category
  const filteredPosts = blogPosts.filter(post => {
    const matchesSearch = searchTerm === "" || 
      post.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
      post.excerpt.toLowerCase().includes(searchTerm.toLowerCase()) ||
      post.category.toLowerCase().includes(searchTerm.toLowerCase());
      
    const matchesCategory = selectedCategory === "All" || post.category === selectedCategory;
    
    return matchesSearch && matchesCategory;
  });

  // Animation variants
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
    hidden: { opacity: 0, y: 20 },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: { duration: 0.5 }
    }
  };

  // Animate through placeholder text and adjust width
  useEffect(() => {
    const interval = setInterval(() => {
      setPlaceholderIndex(prevIndex => {
        const nextIndex = (prevIndex + 1) % searchPlaceholders.length;
        setCurrentPlaceholder(searchPlaceholders[nextIndex]);
        
        // Calculate approximate width based on text length
        const baseWidth = 60;
        const charWidth = 8; 
        const textWidth = searchPlaceholders[nextIndex].length * charWidth;
        const newWidth = Math.max(300, baseWidth + textWidth);
        
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
      const newWidth = Math.max(300, baseWidth + textWidth);
      setInputWidth(`${newWidth}px`);
    } else {
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
      
      {isLoading ? (
        // Loading state
        <div className="container mx-auto px-4 py-24 flex flex-col items-center justify-center min-h-[80vh]">
          <motion.div
            animate={{ 
              rotate: 360,
              scale: [1, 1.1, 1]
            }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
            className="w-16 h-16 mb-8 relative"
          >
            <div className="absolute inset-0 rounded-full border-t-2 border-[#B4916C] opacity-75"></div>
            <div className="absolute inset-0 rounded-full border-l-2 border-transparent opacity-75"></div>
            <div className="absolute inset-0 rounded-full border-b-2 border-[#B4916C] opacity-50"></div>
            <div className="absolute inset-0 rounded-full border-r-2 border-transparent opacity-50"></div>
          </motion.div>
          <p className="text-[#C5C2BA] font-borna">Loading articles...</p>
        </div>
      ) : (
        <motion.div 
          className="container mx-auto px-4 pt-24 pb-16"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          <motion.h1 
            className="text-4xl md:text-5xl font-bold text-[#F9F6EE] mb-8 text-center font-safiro tracking-tight"
            variants={itemVariants}
          >
            Blogs & <span className="text-[#B4916C]">Articles</span>
          </motion.h1>
          <motion.p 
            className="text-[#C5C2BA] text-center max-w-2xl mx-auto mb-12 font-borna"
            variants={itemVariants}
          >
            Explore our latest insights, tips, and strategies for optimizing your career journey and making the most of our AI-powered tools.
          </motion.p>
          
          {/* Search and Filter Bar */}
          <motion.div 
            className="flex flex-col md:flex-row justify-center items-center gap-4 mb-12"
            variants={itemVariants}
          >
            {/* Animated Search Bar */}
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
                {searchTerm && (
                  <button 
                    onClick={() => setSearchTerm("")}
                    className="absolute right-4 top-1/2 transform -translate-y-1/2 text-[#8A8782] hover:text-[#B4916C] transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </motion.div>
            </motion.div>
            
            {/* Filter Button */}
            <motion.button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 bg-[#111111] border ${showFilters ? 'border-[#B4916C] text-[#B4916C]' : 'border-[#222222] text-[#8A8782] hover:text-[#B4916C] hover:border-[#333333]'} rounded-full py-3 px-5 transition-all font-borna`}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <Filter className="w-4 h-4" />
              <span>{showFilters ? 'Hide Filters' : 'Show Filters'}</span>
            </motion.button>
          </motion.div>
          
          {/* Category Filters */}
          <AnimatePresence>
            {showFilters && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3 }}
                className="overflow-hidden mb-8"
              >
                <div className="flex flex-wrap gap-2 justify-center">
                  {categories.map(category => (
                    <motion.button
                      key={category}
                      onClick={() => setSelectedCategory(category)}
                      className={`px-4 py-2 rounded-full text-sm font-borna transition-all ${
                        selectedCategory === category 
                          ? 'bg-[#B4916C] text-[#050505]' 
                          : 'bg-[#111111] text-[#8A8782] hover:bg-[#1A1A1A] hover:text-[#C5C2BA]'
                      }`}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      {category}
                    </motion.button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          
          {/* Featured Article */}
          {filteredPosts.length > 0 && (
            <motion.div 
              className="grid md:grid-cols-3 gap-8 mb-16"
              variants={itemVariants}
            >
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
                      <div className="flex justify-between items-start mb-3">
                        <span className="inline-block bg-[#111111]/80 text-[#B4916C] px-3 py-1 rounded-lg text-sm font-borna">
                          {filteredPosts[0].category}
                        </span>
                        <button 
                          onClick={(e) => toggleSavePost(filteredPosts[0].id, e)}
                          className={`p-2 rounded-full bg-[#111111]/60 ${
                            savedPosts.includes(filteredPosts[0].id) ? 'text-[#B4916C]' : 'text-[#8A8782]'
                          } hover:text-[#B4916C] transition-colors`}
                        >
                          <Bookmark className={`w-4 h-4 ${
                            savedPosts.includes(filteredPosts[0].id) ? 'fill-[#B4916C]' : ''
                          }`} />
                        </button>
                      </div>
                      
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
                      className="group flex flex-col h-[190px] bg-[#111111] rounded-xl overflow-hidden border border-[#222222] hover:border-[#B4916C] transition-colors relative"
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
                        <button 
                          onClick={(e) => toggleSavePost(post.id, e)}
                          className={`absolute top-2 right-2 p-1.5 rounded-full bg-[#111111]/60 ${
                            savedPosts.includes(post.id) ? 'text-[#B4916C]' : 'text-[#8A8782]'
                          } hover:text-[#B4916C] transition-colors z-10`}
                        >
                          <Bookmark className={`w-3 h-3 ${
                            savedPosts.includes(post.id) ? 'fill-[#B4916C]' : ''
                          }`} />
                        </button>
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
            </motion.div>
          )}
          
          {/* More Articles */}
          {filteredPosts.length > 3 && (
            <motion.div variants={itemVariants}>
              <h2 className="text-2xl font-bold text-[#F9F6EE] mb-8 font-safiro tracking-tight flex items-center">
                <span className="w-8 h-px bg-[#B4916C] mr-3"></span>
                More Articles
                <span className="w-8 h-px bg-[#B4916C] ml-3"></span>
              </h2>
              <div className="grid md:grid-cols-3 gap-6">
                {filteredPosts.slice(3).map((post, index) => (
                  <motion.div
                    key={post.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ 
                      duration: 0.5, 
                      delay: 0.2 + (index * 0.1),
                      ease: [0.22, 1, 0.36, 1]
                    }}
                  >
                    <Link href={`/blog/${post.slug}`}>
                      <motion.div 
                        whileHover={{ y: -5 }}
                        transition={{ duration: 0.3 }}
                        className="group overflow-hidden h-full"
                      >
                        <PremiumCard className="h-full">
                          <div className="h-48 overflow-hidden relative">
                            <img 
                              src={post.image} 
                              alt={post.title} 
                              className="w-full h-full object-cover transition-transform group-hover:scale-105 duration-500"
                              onError={(e) => {
                                e.currentTarget.src = post.fallbackImage;
                              }}
                            />
                            <button 
                              onClick={(e) => toggleSavePost(post.id, e)}
                              className={`absolute top-3 right-3 p-1.5 rounded-full bg-[#111111]/60 ${
                                savedPosts.includes(post.id) ? 'text-[#B4916C]' : 'text-[#8A8782]'
                              } hover:text-[#B4916C] transition-colors z-10`}
                            >
                              <Bookmark className={`w-4 h-4 ${
                                savedPosts.includes(post.id) ? 'fill-[#B4916C]' : ''
                              }`} />
                            </button>
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
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}
          
          {/* No Results */}
          {filteredPosts.length === 0 && (
            <motion.div 
              className="text-center py-16"
              variants={itemVariants}
            >
              <h2 className="text-2xl font-bold text-[#F9F6EE] mb-4 font-safiro">No articles found</h2>
              <p className="text-[#C5C2BA] mb-8 font-borna">Try adjusting your search terms or browse all our articles.</p>
              <Button 
                onClick={() => {
                  setSearchTerm("");
                  setSelectedCategory("All");
                }}
                className="bg-[#B4916C] text-[#050505] hover:bg-[#A3815B] transition font-safiro"
              >
                View All Articles
              </Button>
            </motion.div>
          )}
        </motion.div>
      )}
      
      {/* Footer */}
      <footer className="bg-[#0A0A0A] border-t border-[#222222] py-12 mt-auto">
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