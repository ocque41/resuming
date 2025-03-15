"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useRouter } from "next/navigation";
import { Navbar } from "@/components/ui/navbar";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { motion } from "framer-motion";
import { Calendar, Clock, ArrowLeft, Tag } from "lucide-react";
import ReactMarkdown from 'react-markdown';

// Import the blog posts data from the data file
import { blogPosts } from "../data";

export default function BlogPostPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params?.slug as string;
  const [post, setPost] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [relatedPosts, setRelatedPosts] = useState<any[]>([]);

  useEffect(() => {
    if (!slug) {
      setLoading(false);
      return;
    }

    // Find the post with the matching slug
    const currentPost = blogPosts.find(p => p.slug === slug);
    
    if (currentPost) {
      setPost(currentPost);
      
      // Find related posts (same category, excluding current post)
      const related = blogPosts
        .filter(p => p.category === currentPost.category && p.id !== currentPost.id)
        .slice(0, 2); // Get up to 2 related posts
      
      setRelatedPosts(related);
    }
    
    setLoading(false);
  }, [slug]);

  if (loading) {
    return (
      <div className="flex flex-col bg-[#050505] min-h-screen">
        <Navbar />
        <div className="flex justify-center items-center h-[70vh]">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#E8DCC4]"></div>
        </div>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="flex flex-col bg-[#050505] min-h-screen">
        <Navbar />
        <div className="flex flex-col justify-center items-center h-[70vh] px-4 text-center">
          <h1 className="text-3xl font-bold text-white mb-4">Article Not Found</h1>
          <p className="text-gray-300 mb-8">The article you're looking for doesn't exist or has been moved.</p>
          <Link href="/blog">
            <Button className="bg-[#E8DCC4] text-black hover:bg-[#FAF6ED]/90 transition">
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
        <Link href="/blog" className="inline-flex items-center text-[#E8DCC4] hover:text-white transition-colors">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Blog
        </Link>
      </div>
      
      {/* Hero Section */}
      <div className="w-full h-[50vh] relative mb-12">
        <div className="absolute inset-0 bg-black/50 z-10"></div>
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
            <span className="inline-block bg-[#1A1A1A]/80 text-[#E8DCC4] px-3 py-1 rounded text-sm mb-4">
              {post.category}
            </span>
            <h1 className="text-3xl md:text-5xl font-bold text-white mb-6">{post.title}</h1>
            <div className="flex items-center justify-center text-sm text-gray-300">
              <Calendar className="w-4 h-4 mr-2" />
              <span>{post.date}</span>
              <span className="mx-3">•</span>
              <Clock className="w-4 h-4 mr-2" />
              <span>{post.readTime}</span>
            </div>
          </motion.div>
        </div>
      </div>
      
      {/* Article Content */}
      <div className="container mx-auto px-4 pb-16">
        <div className="max-w-3xl mx-auto">
          <motion.article
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="prose prose-invert prose-lg max-w-none"
          >
            <ReactMarkdown
              components={{
                h1: ({ node, ...props }) => <h1 className="text-3xl md:text-4xl font-bold mt-12 mb-6" {...props} />,
                h2: ({ node, ...props }) => <h2 className="text-2xl md:text-3xl font-bold mt-10 mb-5" {...props} />,
                h3: ({ node, ...props }) => <h3 className="text-xl md:text-2xl font-bold mt-8 mb-4" {...props} />,
                p: ({ node, ...props }) => <p className="text-gray-300 mb-6 leading-relaxed" {...props} />,
                ul: ({ node, ...props }) => <ul className="list-disc pl-6 mb-6" {...props} />,
                ol: ({ node, ...props }) => <ol className="list-decimal pl-6 mb-6" {...props} />,
                li: ({ node, ...props }) => <li className="text-gray-300 mb-2" {...props} />,
                a: ({ node, ...props }) => <a className="text-[#E8DCC4] hover:text-white transition-colors" {...props} />,
                strong: ({ node, ...props }) => <strong className="font-bold text-white" {...props} />,
                blockquote: ({ node, ...props }) => (
                  <blockquote className="border-l-4 border-[#E8DCC4] pl-4 italic text-gray-400 my-6" {...props} />
                ),
                code: ({ node, ...props }) => (
                  <code className="bg-[#1A1A1A] px-1 py-0.5 rounded text-sm font-mono" {...props} />
                ),
                pre: ({ node, ...props }) => (
                  <pre className="bg-[#1A1A1A] p-4 rounded-lg overflow-x-auto my-6 text-sm font-mono" {...props} />
                ),
              }}
            >
              {post.content}
            </ReactMarkdown>
          </motion.article>
        </div>
      </div>
      
      {/* Related Articles */}
      {relatedPosts.length > 0 && (
        <section className="bg-[#0A0A0A] py-16">
          <div className="container mx-auto px-4">
            <h2 className="text-2xl font-bold text-white mb-8 text-center">Related Articles</h2>
            <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
              {relatedPosts.map((relatedPost) => (
                <motion.div 
                  key={relatedPost.id}
                  className="bg-[#0A0A0A] rounded-lg overflow-hidden shadow-lg hover:shadow-xl transition-shadow border border-[#1A1A1A]"
                  whileHover={{ y: -5 }}
                  transition={{ duration: 0.3 }}
                >
                  <div className="h-48 overflow-hidden">
                    <img 
                      src={relatedPost.image} 
                      alt={relatedPost.title} 
                      className="w-full h-full object-cover transition-transform hover:scale-105 duration-500"
                      onError={(e) => {
                        e.currentTarget.src = relatedPost.fallbackImage;
                      }}
                    />
                  </div>
                  <div className="p-6">
                    <div className="flex items-center text-sm text-gray-400 mb-3">
                      <Calendar className="w-4 h-4 mr-2" />
                      <span>{relatedPost.date}</span>
                      <span className="mx-2">•</span>
                      <Clock className="w-4 h-4 mr-2" />
                      <span>{relatedPost.readTime}</span>
                    </div>
                    <h3 className="text-xl font-bold text-white mb-3">
                      {relatedPost.title}
                    </h3>
                    <p className="text-gray-300 mb-4 line-clamp-2">
                      {relatedPost.excerpt}
                    </p>
                    <Link href={`/blog/${relatedPost.slug}`} className="text-[#E8DCC4] hover:text-white flex items-center group">
                      Read more <ArrowLeft className="ml-2 w-4 h-4 rotate-180 transition-transform group-hover:translate-x-1" />
                    </Link>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      )}
      
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