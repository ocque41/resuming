"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useRouter } from "next/navigation";
import { Navbar } from "@/components/ui/navbar";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Calendar, Clock, ArrowLeft, Tag, Share, Bookmark, Heart } from "lucide-react";
import ReactMarkdown from 'react-markdown';
import { PremiumCard, PremiumCardContent } from "@/components/ui/premium-card";

// Import the blog posts data from the data file
import { blogPosts } from "../data";

export default function BlogPostPage() {
  const pathname = usePathname();
  const router = useRouter();
  const slug = pathname?.split('/').pop() || '';
  const [post, setPost] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [relatedPosts, setRelatedPosts] = useState<any[]>([]);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [hasLiked, setHasLiked] = useState(false);

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
      transition: {
        duration: 0.5,
        ease: [0.22, 1, 0.36, 1]
      }
    }
  };

  useEffect(() => {
    if (!slug) {
      setLoading(false);
      return;
    }

    // Find the post with the matching slug
    const currentPost = blogPosts.find(p => p.slug === slug);
    
    if (currentPost) {
      setPost(currentPost);
      // Initialize like count with a random number for demo purposes
      setLikeCount(Math.floor(Math.random() * 50) + 5);
      
      // Find related posts (same category, excluding current post)
      const related = blogPosts
        .filter(p => p.category === currentPost.category && p.id !== currentPost.id)
        .slice(0, 3); // Get up to 3 related posts
      
      setRelatedPosts(related);
    }
    
    setLoading(false);
  }, [slug]);

  const handleLike = () => {
    if (!hasLiked) {
      setLikeCount(prev => prev + 1);
      setHasLiked(true);
    } else {
      setLikeCount(prev => prev - 1);
      setHasLiked(false);
    }
  };

  const handleBookmark = () => {
    setIsBookmarked(!isBookmarked);
  };

  if (loading) {
    return (
      <div className="flex flex-col bg-[#050505] min-h-screen">
        <Navbar />
        <div className="flex justify-center items-center h-[70vh]">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#B4916C]"></div>
        </div>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="flex flex-col bg-[#050505] min-h-screen">
        <Navbar />
        <div className="flex flex-col justify-center items-center h-[70vh] px-4 text-center">
          <h1 className="text-3xl font-bold text-[#F9F6EE] mb-4 font-safiro">Article Not Found</h1>
          <p className="text-[#C5C2BA] mb-8 font-borna">The article you're looking for doesn't exist or has been moved.</p>
          <Link href="/blog">
            <Button className="bg-[#B4916C] text-[#050505] hover:bg-[#A3815B] transition font-safiro">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Blog
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col bg-[#050505] min-h-screen">
      <Navbar />
      
      {/* Back to Blog Link */}
      <div className="container mx-auto px-4 pt-24 pb-6">
        <Link href="/blog" className="inline-flex items-center text-[#B4916C] hover:text-[#F9F6EE] transition-colors font-borna">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Blog
        </Link>
      </div>
      
      {/* Hero Section */}
      <div className="w-full h-[60vh] relative mb-12">
        <div className="absolute inset-0 bg-gradient-to-t from-[#000000] via-[#000000]/60 to-[#000000]/30 z-10"></div>
        <img 
          src={post.image} 
          alt={post.title} 
          className="w-full h-full object-cover"
          onError={(e) => {
            e.currentTarget.src = post.fallbackImage;
          }}
        />
        <div className="absolute inset-0 z-20 flex flex-col justify-center items-center text-center px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="max-w-4xl"
          >
            <span className="inline-block bg-[#111111]/80 text-[#B4916C] px-3 py-1 rounded-lg text-sm mb-4 font-borna">
              {post.category}
            </span>
            <h1 className="text-3xl md:text-5xl font-bold text-[#F9F6EE] mb-6 font-safiro tracking-tight">{post.title}</h1>
            <div className="flex items-center justify-center text-sm text-[#C5C2BA] font-borna">
              <Calendar className="w-4 h-4 mr-2 text-[#B4916C]" />
              <span>{post.date}</span>
              <span className="mx-3">•</span>
              <Clock className="w-4 h-4 mr-2 text-[#B4916C]" />
              <span>{post.readTime}</span>
            </div>
          </motion.div>
        </div>
      </div>
      
      <motion.div 
        className="container mx-auto px-4 pb-16"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {/* Social sharing and actions */}
        <motion.div
          variants={itemVariants}
          className="flex justify-center mb-8"
        >
          <div className="flex gap-4 bg-[#111111] p-2 rounded-full border border-[#222222]">
            <button 
              onClick={handleLike}
              className={`flex items-center space-x-1 px-3 py-1 rounded-full font-borna text-sm transition-colors ${hasLiked ? 'text-[#F9F6EE] bg-[#B4916C]/20' : 'text-[#8A8782] hover:text-[#B4916C]'}`}
            >
              <Heart className={`h-4 w-4 ${hasLiked ? 'fill-[#B4916C] text-[#B4916C]' : ''}`} />
              <span>{likeCount}</span>
            </button>
            
            <button 
              onClick={handleBookmark}
              className={`flex items-center space-x-1 px-3 py-1 rounded-full font-borna text-sm transition-colors ${isBookmarked ? 'text-[#F9F6EE] bg-[#B4916C]/20' : 'text-[#8A8782] hover:text-[#B4916C]'}`}
            >
              <Bookmark className={`h-4 w-4 ${isBookmarked ? 'fill-[#B4916C] text-[#B4916C]' : ''}`} />
              <span>Save</span>
            </button>
            
            <button className="flex items-center space-x-1 px-3 py-1 rounded-full text-[#8A8782] hover:text-[#B4916C] font-borna text-sm transition-colors">
              <Share className="h-4 w-4" />
              <span>Share</span>
            </button>
          </div>
        </motion.div>
        
        {/* Article Content */}
        <div className="max-w-3xl mx-auto">
          <motion.article
            variants={itemVariants}
            className="prose prose-invert prose-lg max-w-none"
          >
            <PremiumCard className="p-8 mb-8 border border-[#222222] bg-[#111111] shadow-lg hover:border-[#333333] transition-all duration-300 rounded-xl overflow-hidden">
              <ReactMarkdown
                components={{
                  h1: ({ node, ...props }) => <h1 className="text-3xl md:text-4xl font-bold mt-12 mb-6 text-[#F9F6EE] font-safiro tracking-tight" {...props} />,
                  h2: ({ node, ...props }) => <h2 className="text-2xl md:text-3xl font-bold mt-10 mb-5 text-[#F9F6EE] font-safiro tracking-tight" {...props} />,
                  h3: ({ node, ...props }) => <h3 className="text-xl md:text-2xl font-bold mt-8 mb-4 text-[#F9F6EE] font-safiro tracking-tight" {...props} />,
                  p: ({ node, ...props }) => <p className="text-[#C5C2BA] mb-6 leading-relaxed font-borna" {...props} />,
                  ul: ({ node, ...props }) => <ul className="list-disc pl-6 mb-6 text-[#C5C2BA] font-borna" {...props} />,
                  ol: ({ node, ...props }) => <ol className="list-decimal pl-6 mb-6 text-[#C5C2BA] font-borna" {...props} />,
                  li: ({ node, ...props }) => <li className="text-[#C5C2BA] mb-2 font-borna" {...props} />,
                  a: ({ node, ...props }) => <a className="text-[#B4916C] hover:text-[#A3815B] transition-colors font-borna" {...props} />,
                  strong: ({ node, ...props }) => <strong className="font-bold text-[#F9F6EE] font-borna" {...props} />,
                  blockquote: ({ node, ...props }) => (
                    <blockquote className="border-l-4 border-[#B4916C] pl-4 italic text-[#8A8782] my-6 font-borna" {...props} />
                  ),
                  code: ({ node, ...props }) => (
                    <code className="bg-[#0A0A0A] px-1 py-0.5 rounded text-sm font-mono" {...props} />
                  ),
                  pre: ({ node, ...props }) => (
                    <pre className="bg-[#0A0A0A] p-4 rounded-lg overflow-x-auto my-6 text-sm font-mono" {...props} />
                  ),
                }}
              >
                {post.content || "This is a placeholder content for this article. The full content will be available soon."}
              </ReactMarkdown>
            </PremiumCard>
          </motion.article>
        </div>
      </motion.div>
      
      {/* Related Articles */}
      {relatedPosts.length > 0 && (
        <section className="bg-[#0A0A0A] py-16 border-t border-[#222222]">
          <div className="container mx-auto px-4">
            <motion.h2 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              viewport={{ once: true }}
              className="text-2xl font-bold text-[#F9F6EE] mb-8 text-center font-safiro tracking-tight"
            >
              Related <span className="text-[#B4916C]">Articles</span>
            </motion.h2>
            <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
              {relatedPosts.map((relatedPost, index) => (
                <motion.div 
                  key={relatedPost.id}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                  viewport={{ once: true }}
                  whileHover={{ y: -8 }}
                >
                  <Link href={`/blog/${relatedPost.slug}`}>
                    <PremiumCard className="h-full overflow-hidden group">
                      <div className="h-48 overflow-hidden">
                        <img 
                          src={relatedPost.image} 
                          alt={relatedPost.title} 
                          className="w-full h-full object-cover transition-transform group-hover:scale-105 duration-500"
                          onError={(e) => {
                            e.currentTarget.src = relatedPost.fallbackImage;
                          }}
                        />
                      </div>
                      <PremiumCardContent className="p-6">
                        <span className="text-[#B4916C] text-sm mb-2 font-borna">{relatedPost.category}</span>
                        <h3 className="text-xl font-bold text-[#F9F6EE] mb-3 group-hover:text-[#B4916C] transition-colors font-safiro tracking-tight">
                          {relatedPost.title}
                        </h3>
                        <p className="text-[#C5C2BA] mb-4 line-clamp-2 font-borna">
                          {relatedPost.excerpt}
                        </p>
                        <div className="flex items-center justify-between mt-auto">
                          <div className="flex items-center text-sm text-[#8A8782] font-borna">
                            <Calendar className="w-4 h-4 mr-2 text-[#666666]" />
                            <span>{relatedPost.date}</span>
                          </div>
                          <div className="text-[#B4916C] font-borna group-hover:translate-x-1 transition-transform duration-300">
                            Read more
                          </div>
                        </div>
                      </PremiumCardContent>
                    </PremiumCard>
                  </Link>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      )}
      
      {/* Footer */}
      <footer className="bg-[#050505] text-[#F9F6EE] py-12 border-t border-[#222222]">
        <div className="container mx-auto px-4 text-center">
          <div className="flex justify-center space-x-6 mb-6">
            <a
              href="#"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#8A8782] hover:text-[#B4916C] transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" className="fill-current">
                <path d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H1.474l8.6-9.83L0 1.154h7.594l5.243 6.932L18.901 1.153Z" />
              </svg>
            </a>
            <a
              href="#"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#8A8782] hover:text-[#B4916C] transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" className="fill-current">
                <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5Zm-11 19h-3v-11h3v11Zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.784 1.764-1.75 1.764Z" />
              </svg>
            </a>
            <a
              href="#"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#8A8782] hover:text-[#B4916C] transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" className="fill-current">
                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.148 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.148-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069Zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.197-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.948-.073Zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162Zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4Zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44Z" />
              </svg>
            </a>
          </div>
          <p className="text-sm text-[#8A8782] font-borna">© 2025 CV Optimizer. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
} 