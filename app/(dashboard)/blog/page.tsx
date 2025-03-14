"use client";

import { useState } from "react";
import { Navbar } from "@/components/ui/navbar";
import { Article, ArticleTitle, ArticleContent } from "@/components/ui/article";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Calendar, Clock, ArrowRight, Tag } from "lucide-react";

// Sample blog post data with categories - reduced to 3 articles
export const blogPosts = [
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
    title: "Planning & Use Cases: Your Career Journey Simplified",
    excerpt: "Discover our streamlined approach to career advancement: Upload → Analyze → Optimize → Apply. Learn how our platform transforms your professional documents and job search experience.",
    content: `# Planning & Use Cases: Your Career Journey Simplified

In today's competitive job market, having a strategic approach to your career development is essential. At Resuming, we've designed a seamless four-step process that transforms your professional documents and maximizes your job search success: **Upload → Analyze → Optimize → Apply**.

## Our Comprehensive Approach

### CV Analysis
Our custom-trained AI doesn't just scan your CV—it comprehensively reviews every element to extract meaningful insights and identify key improvement areas. The system evaluates:

- **Content relevance** to your target industry and roles
- **Keyword optimization** for Applicant Tracking Systems (ATS)
- **Achievement quantification** and impact demonstration
- **Skill representation** and gap identification
- **Structural coherence** and readability metrics

This deep analysis provides you with actionable intelligence about your CV's strengths and weaknesses, enabling targeted improvements that significantly enhance your job application success rate.

### CV Optimization
Based on the detailed analysis, our platform delivers personalized suggestions that transform your CV from adequate to exceptional. Our optimization tools:

- **Refine language** for maximum impact and clarity
- **Restructure content** to highlight your most relevant qualifications
- **Enhance keyword placement** to improve ATS compatibility
- **Balance visual elements** for optimal readability
- **Tailor content** to specific industries and positions

These targeted improvements ensure your CV stands out in today's competitive market, capturing the attention of both automated screening systems and human recruiters.

### Job Matching & Mapping
Our platform goes beyond document optimization to connect you directly with relevant opportunities. Our job matching system:

- **Analyzes your optimized CV** to identify your key qualifications and preferences
- **Scans thousands of job listings** to find positions aligned with your profile
- **Calculates compatibility scores** based on multiple factors
- **Presents curated job listings** ranked by match percentage
- **Displays opportunities on an interactive map** for location-based decision making

This integrated approach streamlines your job search process, helping you focus your efforts on positions where you have the highest likelihood of success.

## Try For Free
Experience the power of our platform with no commitment. Our free trial gives you access to:

- Basic CV analysis with key improvement areas identified
- Sample optimization suggestions
- Limited job matching functionality
- Interactive map exploration

Upgrade to our premium plans to unlock the full potential of our AI-powered career advancement tools.

## Use Cases
Our platform is designed to empower professionals at every stage of their career journey with actionable insights and tools.

### Recent Graduates
- Build a professional-quality CV from scratch
- Identify and showcase transferable skills from academic and extracurricular experiences
- Discover entry-level positions aligned with your qualifications and interests
- Gain competitive advantage in a challenging job market

### Mid-Career Professionals
- Optimize your CV to highlight progressive responsibility and achievement
- Identify skill gaps and development opportunities
- Explore lateral or advancement opportunities within your industry
- Evaluate potential career pivots based on your transferable skills

### Career Changers
- Reframe your experience to highlight relevant transferable skills
- Identify and address potential objections from recruiters
- Discover opportunities in your target industry that match your qualifications
- Build a compelling narrative that explains your career transition

### Executive Level
- Showcase strategic leadership and organizational impact
- Optimize executive summary and key achievements
- Target opportunities that align with your leadership style and expertise
- Enhance your professional brand across all documentation

## Resuming Mechanism
Our platform operates through a sophisticated mechanism designed to maximize your career success.

### Specialized Areas

#### Analyze PDF Document
Our system performs comprehensive analysis of your PDF CV, examining:
- Content quality and relevance
- Keyword optimization and ATS compatibility
- Achievement quantification and impact demonstration
- Structural coherence and visual presentation
- Industry alignment and position targeting

This analysis forms the foundation for all optimization recommendations and job matching.

#### Intelligent CV Optimization
Our AI-powered optimization engine delivers:
- Industry-specific keyword optimization based on current hiring trends
- Content restructuring to highlight your most relevant qualifications
- Language refinement for maximum impact and clarity
- Visual presentation improvements for optimal readability
- Tailored recommendations for specific target positions

#### Professional Development
Beyond immediate document optimization, our platform supports your ongoing career growth through:
- Knowledge on high-level CV building principles and best practices
- Skill gap analysis compared to your target roles and industries
- Structure and content analysis to identify areas for professional development
- Personalized learning recommendations to enhance your qualifications

## How It Works
Our platform's streamlined process makes career advancement simple and effective:

1. **Upload**: Submit your CV in PDF format through our secure interface.
2. **Analyze**: Receive detailed ATS compatibility scoring and comprehensive content analysis, including keyword optimization, structure evaluation, and impact assessment.
3. **Optimize**: With one click, transform your document into a structured, read-top-apply CV designed to maximize your chances of interview selection.

The entire process takes minutes, but the impact on your career can be transformative. Join thousands of professionals who have accelerated their career journey with our AI-powered platform.`,
    date: "May 15, 2025",
    readTime: "8 min read",
    image: "/articles/5.webp",
    fallbackImage: "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40",
    slug: "planning-use-cases",
    category: "Career Strategy"
  },
  {
    id: 3,
    title: "AI System: The Technology Behind Your Career Success",
    excerpt: "Discover how our advanced AI system identifies industry patterns, analyzes documents, and optimizes your professional materials to help you break through the 98% rejection barrier in today's competitive job market.",
    content: `# AI System: The Technology Behind Your Career Success

In today's hyper-competitive job market, the numbers tell a sobering story: between 98-99% of applications are filtered out before ever reaching a human interviewer. Only 1-2% of candidates successfully navigate the initial stages of the hiring process. Our AI system is designed to place you firmly within that successful minority.

## Industry Intelligence

### Catching Industry Context
Our AI system doesn't just read your CV—it understands it within the specific context of your target industry. This contextual intelligence allows the system to:

- **Identify target industry** by analyzing content patterns, terminology, and career progression
- **Apply industry-specific knowledge** to evaluate your document against sector expectations
- **Recognize specialized terminology** and its appropriate usage within your field
- **Understand industry-specific achievement metrics** and their significance
- **Detect misalignments** between your presentation and industry standards

This sophisticated industry recognition forms the foundation for all subsequent analysis and optimization, ensuring that recommendations are always relevant to your specific career context.

### Key Value Identification
What exactly is your target industry looking for in candidates? Our AI conducts deep analysis to determine:

- **High-value keywords** that signal relevance to recruiters and ATS systems
- **Essential skills and qualifications** that serve as screening criteria
- **Experience patterns** that correlate with successful hires
- **Presentation elements** that resonate with industry expectations

After consulting our extensive knowledge base and analyzing current metadata, our system generates a comprehensive profile of industry expectations—and how your CV measures against them.

## Breaking Through the 98% Barrier

The stark reality of modern hiring is that automated systems filter out the vast majority of applications before human eyes ever see them. Our AI system is specifically designed to help you overcome these barriers by:

- **Optimizing for ATS compatibility** to ensure your CV passes initial screening
- **Highlighting relevant keywords** in contextually appropriate ways
- **Structuring content** for maximum impact with both algorithms and human reviewers
- **Quantifying achievements** to demonstrate concrete value
- **Aligning your presentation** with industry-specific expectations

These targeted optimizations dramatically increase your chances of breaking through the initial screening process and reaching the interview stage.

## Comprehensive Career Support

Our AI system is designed to support your entire career journey, not just a single job application. The platform provides:

### Detailed Analytics
The system conducts an exhaustive analysis of your CV, examining:
- Industry alignment and keyword optimization
- Achievement quantification and impact demonstration
- Skill representation and gap identification
- Structural coherence and readability metrics
- ATS compatibility and potential screening flags

Each analysis is tailored to the specific industry your CV targets, ensuring that the insights you receive are directly relevant to your career goals.

### One-Click Optimization
Based on this detailed analytics, our system enables you to:
- Transform your CV with a single click
- Generate a professionally optimized document in seconds
- Receive a ready-to-apply CV tailored to industry standards
- Implement targeted improvements that address specific weaknesses
- Highlight your most relevant qualifications and experiences

The optimization process maintains your unique professional narrative while enhancing how that story is told to maximize impact.

## Comprehensive Suite of Tools

### CV Optimization
Our flagship service provides:
- Industry-specific CV analysis that identifies strengths and weaknesses
- Detailed metrics that quantify your document's effectiveness
- One-click optimization that transforms your CV into an ATS-friendly, recruiter-appealing document
- Before-and-after comparisons to visualize improvements
- Multiple export options for different application scenarios

This core functionality helps you create a CV that not only passes automated screening but also impresses human recruiters with its clarity, relevance, and impact.

### Document Generation
Our talk-to-edit model represents the cutting edge of AI document creation:
- Create professional documents from scratch with natural language instructions
- Transform existing documents with contextual understanding of your goals
- Generate industry-specific content that aligns with professional standards
- Produce ready-to-deliver documents for any professional purpose
- Maintain consistent voice and style across all your professional materials

This versatile tool extends beyond CVs to support all your professional documentation needs, from cover letters to project proposals.

### Document Analysis
Our comprehensive analysis tools provide:
- Detailed evaluation of any professional document
- Readability scoring and improvement suggestions
- Content relevance assessment for your target audience
- Structural analysis for optimal information presentation
- Competitive benchmarking against industry standards

The text analysis capabilities expand as needed to accommodate documents of any length, ensuring you receive thorough feedback regardless of content volume.

## The Technology Advantage

Our AI system represents the convergence of multiple advanced technologies:

- **Natural Language Processing** that understands the nuances of professional communication
- **Industry-Specific Training** that recognizes the unique requirements of different sectors
- **Pattern Recognition** that identifies effective presentation strategies
- **Contextual Understanding** that evaluates content within appropriate frameworks
- **Adaptive Learning** that continuously improves recommendations based on outcomes

This technological foundation enables our system to provide insights and optimizations that go far beyond generic CV advice, delivering truly personalized career advancement support.

## Measurable Results

The effectiveness of our AI system is demonstrated through concrete outcomes:

- **Interview Rate Increase**: Users report 3-5x improvement in interview invitation rates
- **Application Efficiency**: 80% reduction in time spent on document preparation
- **Job Match Quality**: 65% higher satisfaction with job placements
- **Career Progression**: 40% faster advancement compared to industry averages

These metrics reflect our system's ability to not just help you get past initial screenings, but to position you for long-term career success.

## Experience the Difference

In a job market where 98% of applications never reach human reviewers, our AI system provides the critical advantage needed to break through automated screening systems and capture the attention of hiring managers.

By combining industry intelligence, detailed analytics, and one-click optimization, we've created a platform that doesn't just improve your CV—it transforms your entire approach to career development.

Whether you're applying for your dream job, transitioning to a new industry, or simply ensuring your professional documents reflect your true capabilities, our AI system provides the tools and insights you need to succeed in today's challenging job market.`,
    date: "May 3, 2025",
    readTime: "9 min read",
    image: "/articles/7.webp",
    fallbackImage: "https://images.unsplash.com/photo-1551434678-e076c223a692",
    slug: "ai-system",
    category: "AI Technology"
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