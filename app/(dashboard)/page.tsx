"use client";

import { Badge } from "@/components/ui/badge";
import { Article, ArticleTitle, ArticleContent } from "@/components/ui/article";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { PageTransition } from "@/components/ui/page-transition";
import { MobileNavbar } from "@/components/ui/mobile-navbar";

// Animation variants
const fadeIn = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.6 } }
};

const fadeInUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { 
    opacity: 1, 
    y: 0, 
    transition: { 
      duration: 0.6,
      ease: "easeOut"
    } 
  }
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.2
    }
  }
};

export default function HomePage() {
  // State to track viewport height for mobile browsers
  const [viewportHeight, setViewportHeight] = useState("100vh");
  // State to track if we're on mobile
  const [isMobile, setIsMobile] = useState(false);

  // Handle viewport height for mobile browsers and prevent scrolling
  useEffect(() => {
    // Prevent scrolling
    document.body.style.overflow = "hidden";
    
    // Set viewport height correctly for mobile browsers
    const updateHeight = () => {
      setViewportHeight(`${window.innerHeight}px`);
      setIsMobile(window.innerWidth < 640);
    };
    
    // Initial update
    updateHeight();
    
    // Update on resize
    window.addEventListener("resize", updateHeight);
    
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("resize", updateHeight);
    };
  }, []);

  return (
    <PageTransition>
      <div 
        className="flex flex-col bg-[#050505] overflow-hidden font-borna"
        style={{ height: viewportHeight }}
      >
        {/* WhatsApp preview fallback - uses standard meta tags in a specific way to hint to WhatsApp */}
        <div style={{ display: 'none' }}>
          <img 
            src={`https://resuming.ai/1.png?v=${Date.now()}`}
            alt="Resuming - The First Engineer-Recruiter AI Platform"
            width="1200" 
            height="630" 
          />
          <h1>Resuming - The First Engineer-Recruiter AI Platform</h1>
          <p>Designed for technical professionals and emerging talent alike. Optimize your career today with AI-powered tools.</p>
        </div>
        
        {/* JSON-LD structured data for SEO */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "SoftwareApplication",
              "name": "Resuming.ai",
              "description": "The first Engineer-Recruiter AI Platform designed for technical professionals and emerging talent.",
              "applicationCategory": "CareerApplication",
              "operatingSystem": "Web",
              "offers": {
                "@type": "Offer",
                "price": "0",
                "priceCurrency": "USD"
              },
              "aggregateRating": {
                "@type": "AggregateRating",
                "ratingValue": "4.8",
                "ratingCount": "256"
              },
              "featureList": [
                "AI-Powered Resume Optimization",
                "Document Analysis Suite",
                "CV to Job Matching",
                "Job Description Generator",
                "Skills Gap Analysis",
                "Technical Portfolio Optimization"
              ],
              "sameAs": [
                "https://twitter.com/resumingai",
                "https://linkedin.com/company/resumingai",
                "https://github.com/resumingai"
              ]
            })
          }}
        />
        
        {/* Organization structured data */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Organization",
              "name": "Resuming.ai",
              "url": "https://resuming.ai",
              "logo": "https://resuming.ai/white.png",
              "description": "The first Engineer-Recruiter AI Platform designed for technical professionals and emerging talent.",
              "sameAs": [
                "https://twitter.com/resumingai",
                "https://linkedin.com/company/resumingai",
                "https://github.com/resumingai"
              ]
            })
          }}
        />
        
        {/* WebApplication structured data */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebApplication",
              "name": "Resuming.ai",
              "applicationCategory": "CareerApplication",
              "operatingSystem": "All",
              "offers": {
                "@type": "Offer",
                "price": "0",
                "priceCurrency": "USD"
              },
              "screenshot": "https://resuming.ai/1.png",
              "softwareVersion": "2.0"
            })
          }}
        />

        {/* Hidden SEO text - Only visible to bots and AI crawlers */}
        <div className="sr-only" aria-hidden="true">
          <h2>Resuming.ai - The First Engineer-Recruiter AI Platform</h2>
          <p>
            Designed for technical professionals and emerging talent alike, our platform leverages advanced AI to perfect resumes, 
            analyze documents, and connect you with the right career opportunities.
          </p>
          
          {/* Platform Overview */}
          <section>
            <h3>Platform Overview</h3>
            <p>
              Resuming.ai is the first integrated Engineer-Recruiter AI Platform that bridges the gap between technical talent and career opportunities. 
              Built on state-of-the-art machine learning models and natural language processing capabilities, our platform offers a comprehensive suite 
              of tools for both job seekers and employers in the technical space.
            </p>
            <p>
              Our platform utilizes transformer-based neural networks, semantic analysis, and industry-specific training datasets to ensure 
              technical accuracy and relevance across all recommendations and optimizations. The core technology stack includes GPT-4 for 
              natural language understanding, specialized computer vision models for document parsing, and proprietary algorithms for matching 
              skills to opportunities.
            </p>
          </section>
          
          {/* Comprehensive Platform Features - Existing content with enhancements */}
          <section>
            <h3>Comprehensive Platform Features</h3>
            <ul>
              <li>
                <strong>AI-Powered Resume Optimization:</strong> Our cutting-edge AI analyzes your resume against industry standards,
                ATS systems, and specific job requirements to ensure maximum impact. Receive detailed feedback on content, formatting,
                keywords, and professional presentation to ensure your resume passes through automated screening systems. The system evaluates
                over 250 data points including keyword density, skill relevance, achievement quantification, and formatting consistency.
                Technical resume analysis supports specialized formats for software engineering, data science, cybersecurity, DevOps, and other
                technical domains.
              </li>
              <li>
                <strong>Document Analysis Suite:</strong> Leverage AI to extract insights from all your career documents, including 
                resumes, cover letters, job descriptions, and performance reviews. Our system identifies patterns, highlights key 
                achievements, and provides data-driven visualizations of your professional journey. The document analysis engine can parse 
                PDFs, Word documents, Google Docs, plain text, and even images of printed materials with 99.2% accuracy. Advanced semantic 
                understanding identifies technical competencies, project contributions, and leadership experiences even when not explicitly stated.
              </li>
              <li>
                <strong>CV to Job Matching:</strong> Our intelligent matching algorithm evaluates your resume against potential job 
                opportunities, providing a compatibility score and suggesting specific improvements to increase your chances of success 
                for particular positions. The matching system considers not only keyword alignment but also implicit skills, experience 
                equivalency, and potential for skill transfer between related domains. For engineers, the system can evaluate coding proficiency
                levels, framework experience, and system architecture knowledge based on project descriptions.
              </li>
              <li>
                <strong>Job Description Generator:</strong> Create precise, compelling job descriptions tailored to attract the right 
                candidates. Our AI helps employers articulate requirements, responsibilities, and qualifications with clarity and accuracy.
                The generator includes specialized templates for software development roles (frontend, backend, full-stack, mobile),
                data engineering positions, DevOps roles, QA engineers, technical product managers, and more. Each template incorporates
                industry best practices for inclusivity, clarity, and technical specificity.
              </li>
              <li>
                <strong>Remin AI Agent:</strong> Access our state-of-the-art AI agent for deep research, creative content generation, 
                technical assistance, and career guidance. Remin provides personalized support for complex professional challenges and 
                helps you stay competitive in today's dynamic job market. Remin integrates with GitHub, Stack Overflow, and other technical 
                platforms to provide contextualized career advice. The agent can perform programming language analysis, review code samples, 
                and suggest portfolio improvements specific to your technical specialty.
              </li>
              <li>
                <strong>Career Opportunity Marketplace:</strong> Discover exclusive job opportunities matched to your skills and experience. 
                Our platform connects technical professionals with employers seeking specialized talent, creating a direct pipeline to 
                relevant positions. The marketplace includes roles from startups to Fortune 500 companies across software engineering, 
                data science, cloud architecture, cybersecurity, AI/ML engineering, and emerging technologies like quantum computing and 
                blockchain development.
              </li>
              <li>
                <strong>Skills Gap Analysis:</strong> Identify areas for professional development based on current market demands and your 
                career goals. Receive personalized recommendations for upskilling and certification opportunities. Our analysis draws from
                real-time industry data, tracking trends in job requirements across 50+ technical disciplines. For each identified gap,
                receive curated learning resources including courses, documentation, projects, and certification paths tailored to your
                learning style and current proficiency level.
              </li>
              <li>
                <strong>Interview Preparation:</strong> Prepare for technical and behavioral interviews with AI-powered simulation and 
                feedback. Practice industry-specific questions and improve your communication of complex technical concepts. The system includes
                specialized modules for algorithmic problem-solving, system design interviews, pair programming simulations, and domain-specific
                technical assessments. For technical roles, practice explaining architecture decisions, debugging approaches, and performance
                optimization strategies.
              </li>
              <li>
                <strong>Technical Portfolio Optimization:</strong> Showcase your technical projects, contributions, and achievements 
                effectively. Our platform helps you highlight your technical expertise in a way that resonates with potential employers.
                Support for GitHub integration, project visualization, code quality metrics, and contribution analysis across open-source
                ecosystems. The system can identify your most impressive technical contributions and help frame them for maximum impact
                in your professional narrative.
              </li>
            </ul>
          </section>
          
          {/* Use Cases - Existing content with enhancements */}
          <section>
            <h3>Use Cases</h3>
            <ul>
              <li>
                <strong>Career Transition:</strong> Engineers looking to pivot to new roles or industries can leverage our platform to 
                reposition their skills and experience for different technical domains. Example: A Java backend developer successfully
                transitioning to cloud architecture by identifying transferable skills in distributed systems, API design, and service
                orchestration, then addressing knowledge gaps in specific cloud technologies.
              </li>
              <li>
                <strong>Technical Recruitment:</strong> Hiring managers and technical recruiters use our platform to craft precise job 
                descriptions, evaluate candidates efficiently, and identify the best technical talent. Case study: A fintech startup reduced
                time-to-hire for senior developers by 40% while improving retention rates through more accurate role and culture matching.
              </li>
              <li>
                <strong>Skill Development Planning:</strong> Professionals at all career stages can map their technical growth trajectory 
                based on market insights and personalized recommendations. Example pathway: A mid-level data analyst progressing to data
                scientist through structured learning in statistical modeling, machine learning algorithms, and experimental design, with
                milestone projects demonstrating applied knowledge.
              </li>
              <li>
                <strong>Technical Resume Refinement:</strong> Transform conventional resumes into powerful technical portfolios that 
                effectively communicate specialized skills and achievements. Success story: A DevOps engineer whose optimized resume
                highlighting infrastructure automation experience and quantified system reliability improvements led to interviews with
                five top tech companies.
              </li>
              <li>
                <strong>Job Market Navigation:</strong> Understand industry trends, salary benchmarks, and emerging technical roles to 
                make informed career decisions. Market insight: Tracking the growth of roles in MLOps, edge computing, and cybersecurity
                specializations, with geographic distribution of opportunities and compensation analysis.
              </li>
              <li>
                <strong>Technical Leadership Development:</strong> Support for engineers transitioning into technical leadership roles
                through competency assessment, leadership skill development, and management technique simulation. Our platform helps
                identify readiness for technical management and provides guided preparation for leading engineering teams effectively.
              </li>
              <li>
                <strong>Remote Work Optimization:</strong> Specialized tools for remote technical professionals to enhance virtual 
                collaboration, showcase distributed team contributions, and position themselves effectively for remote-first organizations.
                Includes remote work productivity frameworks and distributed team contribution metrics.
              </li>
              <li>
                <strong>Startup Technology Planning:</strong> Entrepreneurs and technical founders use our platform to map skill requirements
                for MVP development, identify critical technical hires, and create technology roadmaps aligned with business objectives.
                Includes frameworks for technology stack selection and technical co-founder evaluation.
              </li>
            </ul>
          </section>
          
          {/* Technology Stack */}
          <section>
            <h3>Technology Stack and Methodologies</h3>
            <p>
              Resuming.ai is built on a robust technical foundation that enables high-precision document analysis, intelligent matching, 
              and personalized recommendations:
            </p>
            <ul>
              <li>
                <strong>Natural Language Processing:</strong> Transformer-based models fine-tuned on technical documentation, job descriptions,
                and industry publications to understand specialized terminology across engineering disciplines.
              </li>
              <li>
                <strong>Computer Vision:</strong> Document parsing and formatting analysis through specialized CV models that understand
                resume structures, technical diagrams, and portfolio presentations.
              </li>
              <li>
                <strong>Knowledge Graph:</strong> Comprehensive relationship mapping between technical skills, tools, frameworks, and roles
                to power intelligent recommendations and identify non-obvious career pathways.
              </li>
              <li>
                <strong>Real-time Market Intelligence:</strong> Continuous analysis of technical job market trends through proprietary
                data pipelines processing millions of job postings, company announcements, and industry developments.
              </li>
              <li>
                <strong>Security and Privacy:</strong> SOC 2 compliant infrastructure with end-to-end encryption, anonymized analytics,
                and user-controlled data sharing permissions to ensure complete confidentiality of career information.
              </li>
            </ul>
          </section>
          
          {/* Integration Capabilities */}
          <section>
            <h3>Integration Capabilities</h3>
            <p>
              Resuming.ai seamlessly connects with your existing technical ecosystem:
            </p>
            <ul>
              <li>
                <strong>GitHub and Version Control:</strong> Analyze repositories, contribution patterns, and code quality metrics to
                enhance your technical profile with verified development experience.
              </li>
              <li>
                <strong>LinkedIn and Professional Networks:</strong> Synchronize career information, recommendations, and professional
                connections to maintain consistent presence across platforms.
              </li>
              <li>
                <strong>Learning Platforms:</strong> Track progress across technical courses, certifications, and learning pathways from
                providers like Coursera, Udemy, and specialized technical training providers.
              </li>
              <li>
                <strong>Technical Assessment Tools:</strong> Import results from coding challenges, technical assessments, and skill
                verification platforms to validate proficiency claims.
              </li>
              <li>
                <strong>ATS and Recruitment Systems:</strong> Bi-directional integration with applicant tracking systems for seamless
                application processes and enhanced candidate profiles.
              </li>
            </ul>
          </section>
          
          <section>
            <h3>Testimonials and Outcomes</h3>
            <p>
              Users of Resuming.ai have reported significant improvements in their technical career trajectories:
            </p>
            <ul>
              <li>Engineers report 3.5x more relevant job matches after optimization</li>
              <li>Technical recruiters find qualified candidates 40% faster</li>
              <li>62% of users receive interview invitations within two weeks of profile optimization</li>
              <li>Salary increases averaging 14% for users who leverage negotiation insights</li>
              <li>Technical teams report 35% improvement in candidate quality when using our platform for hiring</li>
            </ul>
          </section>
          
          <p>
            Leverage the power of Remin agent which provides you with state-of-the-art models and tools for deep research, creative 
            content generation, advanced technical tasks and much more to stay ahead in today's competitive landscape.
          </p>
          
          {/* Accessibility and Support */}
          <section>
            <h3>Accessibility and Support</h3>
            <p>
              Resuming.ai is designed to be accessible to all technical professionals:
            </p>
            <ul>
              <li>WCAG 2.1 AA compliant interface</li>
              <li>Multilingual support covering 14 languages commonly used in technical documentation</li>
              <li>24/7 technical support via chat, email, and video consultation</li>
              <li>Comprehensive documentation and self-service knowledge base</li>
              <li>Regular webinars and workshops on technical career development</li>
            </ul>
          </section>
          
          {/* Future Roadmap */}
          <section>
            <h3>Innovation Roadmap</h3>
            <p>
              Our continuing development focuses on expanding capabilities for technical professionals:
            </p>
            <ul>
              <li>Advanced technical skill assessment through interactive challenges</li>
              <li>Expanded support for emerging technical roles in quantum computing, robotics, and biotechnology</li>
              <li>Enhanced visualization of career progression paths with predictive analytics</li>
              <li>Peer mentorship matching within technical specialties</li>
              <li>Integrated technical project marketplace for portfolio development</li>
            </ul>
          </section>
        </div>

        {/* Use the MobileNavbar component */}
        <MobileNavbar />

        {/* Hero Section - With more space for navbar */}
        <section className="relative flex-1 flex items-center justify-center pt-16 sm:pt-8 md:pt-4">
          <div className="relative z-10 container mx-auto px-4 sm:px-6 lg:px-8 flex flex-col items-center justify-center h-full py-4 sm:py-6 md:py-8">
            <motion.div 
              className="max-h-full overflow-auto no-scrollbar flex flex-col items-center"
              variants={staggerContainer}
              initial="hidden"
              animate="visible"
            >
              <motion.div 
                className="mb-4 sm:mb-6 md:mb-8 mt-4 sm:mt-0"
                variants={fadeInUp}
              >
                <Link href="https://chromad.vercel.app/docs/products/resuming">
                  <Badge className="bg-[#1a1a1a] text-white glass-effect">Documentation</Badge>
                </Link>
              </motion.div>
              
              <Article className="text-center max-w-3xl mx-auto">
                <motion.div variants={fadeInUp}>
                  <ArticleTitle className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-bold text-white font-safiro">
                    The Work Playground
                  </ArticleTitle>
                </motion.div>
                
                <motion.div variants={fadeInUp}>
                  <ArticleContent className="mt-2 sm:mt-3 md:mt-4 text-base sm:text-lg md:text-xl lg:text-2xl text-gray-300 font-borna">
                    <p>The First Engineer - Recruiter AI Platform</p>
                    <p className="text-base sm:text-lg mt-2">
                      Designed for technical professionals and emerging talent
                    </p>
                  </ArticleContent>
                </motion.div>
                
                <motion.div 
                  className="mt-4 sm:mt-5 md:mt-6 lg:mt-8 flex flex-col sm:flex-row gap-3 sm:gap-4 items-center justify-center"
                  variants={fadeInUp}
                >
                  <Button
                    asChild
                    size="lg"
                    className="bg-white text-[#050505] px-5 sm:px-6 md:px-8 py-2.5 sm:py-3 md:py-4 rounded-md hover:bg-white/90 transition w-full sm:w-auto text-sm sm:text-base font-borna"
                  >
                    <Link href="/sign-up">Try For Free</Link>
                  </Button>
                  <Button
                    asChild
                    variant="outline"
                    size="lg"
                    className="border border-white/20 text-white px-5 sm:px-6 md:px-8 py-2.5 sm:py-3 md:py-4 rounded-md hover:bg-white/10 transition w-full sm:w-auto text-sm sm:text-base font-borna glass-effect"
                  >
                    <Link href="/pricing">Learn More</Link>
                  </Button>
                </motion.div>
              </Article>
              
              {/* Hero Image - Using 9.webp */}
              <motion.div 
                className="mt-4 sm:mt-5 md:mt-6 lg:mt-8 w-full max-w-4xl px-4 flex justify-center"
                variants={fadeInUp}
              >
                <div className="w-full max-w-3xl rounded-xl overflow-hidden shadow-2xl">
                  <motion.img 
                    src="/9.webp" 
                    alt="Resuming.ai - Engineer-Recruiter AI Platform" 
                    className="w-full h-auto max-h-[35vh] sm:max-h-[40vh] md:max-h-[45vh] lg:max-h-[50vh] object-contain rounded-xl"
                    whileHover={{ scale: 1.05 }}
                    transition={{ duration: 0.5 }}
                  />
                </div>
              </motion.div>
            </motion.div>
          </div>
        </section>

        {/* Combined styles for mobile navbar and scrollbar */}
        <style jsx global>{`
          /* Mobile navbar visibility fix */
          @media (max-width: 640px) {
            nav {
              display: block !important;
              visibility: visible !important;
              opacity: 1 !important;
            }
          }
          
          /* Hide scrollbar for Chrome, Safari and Opera */
          .no-scrollbar::-webkit-scrollbar {
            display: none;
          }
          
          /* Hide scrollbar for IE, Edge and Firefox */
          .no-scrollbar {
            -ms-overflow-style: none;  /* IE and Edge */
            scrollbar-width: none;  /* Firefox */
          }
        `}</style>
      </div>
    </PageTransition>
  );
}
