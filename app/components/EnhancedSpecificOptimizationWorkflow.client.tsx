/* use client */
'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, BorderStyle } from 'docx';
import { saveAs } from 'file-saver';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertCircle, RefreshCw, Clock, Info, Download, FileText, CheckCircle } from "lucide-react";
import { analyzeCVContent, optimizeCVForJob } from '@/app/lib/services/mistral.service';

interface EnhancedSpecificOptimizationWorkflowProps {
  cvs?: string[];
}

// Modern file dropdown component
function ModernFileDropdown({ 
  cvs, 
  onSelect, 
  selectedCVName 
}: { 
  cvs: string[]; 
  onSelect: (cvId: string, cvName: string) => void; 
  selectedCVName?: string | null; 
}) {
  const [open, setOpen] = useState(false);
  
  return (
    <div className="relative w-full">
      <button
        onClick={() => setOpen(!open)}
        className="w-full px-4 py-3 bg-[#050505] border border-gray-700 hover:border-[#B4916C] text-white rounded-md flex justify-between items-center transition-colors duration-200"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="truncate">{selectedCVName || "Select a CV"}</span>
        <svg 
          className={`h-5 w-5 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} 
          xmlns="http://www.w3.org/2000/svg" 
          viewBox="0 0 20 20" 
          fill="currentColor"
        >
          <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
        </svg>
      </button>
      
      {open && cvs.length > 0 && (
        <div className="absolute z-10 w-full mt-1 bg-[#050505] border border-gray-700 rounded-md shadow-lg max-h-60 overflow-auto">
          <ul className="py-1" role="listbox">
            {cvs.map((cv) => {
              const [name, id] = cv.split('|');
              return (
                <li 
                  key={id}
                  className="px-4 py-2 text-sm text-white hover:bg-[#1A1A1A] hover:text-[#B4916C] cursor-pointer"
                  role="option"
                  onClick={() => {
                    onSelect(id, name);
                    setOpen(false);
                  }}
                >
                  {name}
                </li>
              );
            })}
          </ul>
        </div>
      )}
      
      {open && cvs.length === 0 && (
        <div className="absolute z-10 w-full mt-1 bg-[#050505] border border-gray-700 rounded-md shadow-lg">
          <div className="px-4 py-3 text-sm text-gray-400">
            <p className="mb-2">No CVs available</p>
            <p className="text-xs">Please upload a CV in the General tab first, then return here to optimize it for a specific job.</p>
          </div>
        </div>
      )}
    </div>
  );
}

// Update the JobMatchAnalysis interface to include more detailed scoring dimensions
interface JobMatchAnalysis {
  score: number;
  matchedKeywords: { 
    keyword: string; 
    relevance: number;
    context?: string;
    frequency?: number; // How many times the keyword appears
    placement?: string; // Where in the CV the keyword appears (e.g., "profile", "skills", "achievements")
  }[];
  missingKeywords: { 
    keyword: string; 
    importance: number;
    suggestedPlacement?: string; // Where to add this keyword
  }[];
  recommendations: string[];
  skillGap: string;
  // Add new scoring dimensions
  dimensionalScores: {
    skillsMatch: number;
    experienceMatch: number;
    educationMatch: number;
    industryFit: number;
    overallCompatibility: number;
    keywordDensity: number; // New metric for keyword density
    formatCompatibility: number; // New metric for format compatibility
    contentRelevance: number; // New metric for content relevance
  };
  // Add detailed analysis text
  detailedAnalysis: string;
  // Add improvement potential
  improvementPotential: number;
  // Add section-specific analysis
  sectionAnalysis: {
    profile: { score: number; feedback: string };
    skills: { score: number; feedback: string };
    experience: { score: number; feedback: string };
    education: { score: number; feedback: string };
    achievements: { score: number; feedback: string };
  };
}

// Add a function to generate diverse achievements based on keywords
const generateAchievements = (keywords: string[]): string[] => {
  // Achievement templates with placeholders for keywords
  const achievementTemplates = [
    "Led initiatives to improve {keyword} processes, resulting in 30% increased efficiency and positive stakeholder feedback.",
    "Developed and implemented {keyword} strategies that reduced costs by 25% while maintaining quality standards.",
    "Spearheaded the adoption of new {keyword} methodologies, increasing team productivity by 40% over 6 months.",
    "Created comprehensive {keyword} documentation and training materials that improved onboarding time by 50%.",
    "Optimized {keyword} workflows through innovative approaches, leading to 35% reduction in turnaround time.",
    "Managed cross-functional {keyword} projects with budgets exceeding $500K, delivering all milestones on time and under budget.",
    "Recognized for excellence in {keyword}, receiving departmental award for outstanding contributions.",
    "Redesigned {keyword} systems that improved data accuracy by 45% and reduced manual processing time.",
    "Collaborated with stakeholders to enhance {keyword} capabilities, resulting in 28% improvement in customer satisfaction scores.",
    "Pioneered new {keyword} techniques that became standard practice across the organization."
  ];
  
  // Industry-specific achievement templates
  const industryAchievements = {
    // Technology-related keywords
    tech: [
      "Architected and implemented {keyword} solutions that scaled to support 200% business growth.",
      "Reduced system downtime by 75% through improved {keyword} monitoring and maintenance protocols.",
      "Migrated legacy systems to modern {keyword} platforms, improving performance by 60%."
    ],
    // Business/management keywords
    business: [
      "Exceeded {keyword} targets by 40% through strategic planning and team leadership.",
      "Negotiated {keyword} contracts resulting in $1.2M annual savings while improving service levels.",
      "Streamlined {keyword} operations by eliminating redundancies and optimizing resource allocation."
    ],
    // Creative/design keywords
    creative: [
      "Designed award-winning {keyword} materials that increased brand recognition by 45%.",
      "Created innovative {keyword} campaigns that generated 300% ROI and expanded market reach.",
      "Revitalized the {keyword} strategy, resulting in 65% increase in engagement metrics."
    ]
  };
  
  // Categorize keywords into industry groups
  const techKeywords = ['software', 'development', 'programming', 'code', 'technical', 'engineering', 'system', 'data', 'analysis', 'technology', 'infrastructure', 'network', 'security', 'cloud', 'database'];
  const businessKeywords = ['management', 'leadership', 'strategy', 'business', 'operations', 'project', 'financial', 'marketing', 'sales', 'client', 'customer', 'service', 'planning', 'budget', 'compliance'];
  const creativeKeywords = ['design', 'creative', 'content', 'writing', 'visual', 'brand', 'media', 'communication', 'presentation', 'graphic', 'video', 'production', 'storytelling', 'campaign'];
  
  // Select achievements based on keyword categories and ensure diversity
  const achievements: string[] = [];
  const usedTemplates = new Set<string>();
  
  // Process up to 5 keywords or all keywords if less than 5
  const keywordsToProcess = keywords.slice(0, Math.min(5, keywords.length));
  
  keywordsToProcess.forEach(keyword => {
    // Determine if this keyword fits into a specific industry category
    let categoryTemplates: string[] = [];
    
    if (techKeywords.some(tech => keyword.toLowerCase().includes(tech))) {
      categoryTemplates = industryAchievements.tech;
    } else if (businessKeywords.some(business => keyword.toLowerCase().includes(business))) {
      categoryTemplates = industryAchievements.business;
    } else if (creativeKeywords.some(creative => keyword.toLowerCase().includes(creative))) {
      categoryTemplates = industryAchievements.creative;
    }
    
    // Combine general templates with any category-specific ones
    const allTemplates = [...achievementTemplates, ...categoryTemplates];
    
    // Find a template we haven't used yet
    let template = '';
    for (let i = 0; i < allTemplates.length; i++) {
      const candidateTemplate = allTemplates[Math.floor(Math.random() * allTemplates.length)];
      if (!usedTemplates.has(candidateTemplate)) {
        template = candidateTemplate;
        usedTemplates.add(candidateTemplate);
        break;
      }
    }
    
    // If all templates have been used, just pick a random one
    if (!template) {
      template = allTemplates[Math.floor(Math.random() * allTemplates.length)];
    }
    
    // Replace the placeholder with the keyword
    const achievement = template.replace('{keyword}', keyword.toLowerCase());
    achievements.push(achievement);
  });
  
  return achievements;
};

interface StructuredCV {
  name: string;
  subheader: string;
  profile: string;
  experience: Array<{
    title: string;
    company: string;
    dates: string;
    responsibilities: string[];
  }>;
  education: Array<{
    degree: string;
    field: string;
    institution: string;
    year: string;
  }>;
  skills: {
    technical: string[];
    professional: string[];
  };
  achievements: string[];
}

// Add type definitions at the top of the file
interface ExperienceEntry {
  dates: string;
  title: string | null;
  company: string | null;
  responsibilities: string[];
}

interface EducationEntry {
  degree: string;
  field: string | null;
  institution: string | null;
  year: string | null;
}

interface SkillsData {
  technical: string[];
  professional: string[];
}

export default function EnhancedSpecificOptimizationWorkflow({ cvs = [] }: EnhancedSpecificOptimizationWorkflowProps) {
  // State for CV selection
  const [selectedCVId, setSelectedCVId] = useState<string | null>(null);
  const [selectedCVName, setSelectedCVName] = useState<string | null>(null);
  
  // State for job description
  const [jobDescription, setJobDescription] = useState('');
  
  // State for processing
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isProcessed, setIsProcessed] = useState<boolean>(false);
  const [processingProgress, setProcessingProgress] = useState<number>(0);
  const [processingStatus, setProcessingStatus] = useState<string | null>("");
  const [error, setError] = useState<string | null>(null);
  
  // State for UI views
  const [activeTab, setActiveTab] = useState('jobDescription');
  const [originalText, setOriginalText] = useState<string>("");
  const [optimizedText, setOptimizedText] = useState<string>("");
  const [showStructuredView, setShowStructuredView] = useState<boolean>(true);
  
  // State for job match analysis
  const [jobMatchAnalysis, setJobMatchAnalysis] = useState<JobMatchAnalysis>({
    score: 0,
    matchedKeywords: [],
    missingKeywords: [],
    recommendations: [],
    skillGap: "",
    dimensionalScores: {
      skillsMatch: 0,
      experienceMatch: 0,
      educationMatch: 0,
      industryFit: 0,
      overallCompatibility: 0,
      keywordDensity: 0,
      formatCompatibility: 0,
      contentRelevance: 0
    },
    detailedAnalysis: "",
    improvementPotential: 0,
    sectionAnalysis: {
      profile: { score: 0, feedback: "" },
      skills: { score: 0, feedback: "" },
      experience: { score: 0, feedback: "" },
      education: { score: 0, feedback: "" },
      achievements: { score: 0, feedback: "" }
    }
  });
  
  // State for processing too long detection
  const [processingTooLong, setProcessingTooLong] = useState<boolean>(false);
  
  // Add back the structuredCV state
  const [structuredCV, setStructuredCV] = useState<StructuredCV>({
    name: "",
    subheader: "",
    profile: "",
    experience: [],
    education: [],
    skills: {
      technical: [],
      professional: []
    },
    achievements: []
  });
  
  // Add new state variables
  const [jobMatchScore, setJobMatchScore] = useState<number>(0);
  const [recommendations, setRecommendations] = useState<string[]>([]);
  
  // Fetch original CV text
  const fetchOriginalText = useCallback(async (cvId: string) => {
    try {
      if (!cvId) return;
      
      const response = await fetch(`/api/cv/get-text?cvId=${cvId}`);
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.text) {
          setOriginalText(data.text);
          return data.text;
        }
      }
    } catch (error) {
      console.error("Error fetching original CV text:", error);
    }
    return "";
  }, []);
  
  // Handle CV selection
  const handleSelectCV = useCallback(async (cvId: string, cvName: string) => {
    setSelectedCVId(cvId);
    setSelectedCVName(cvName);
    console.log(`Selected CV: ${cvName} (ID: ${cvId})`);
    
    // Reset states when a new CV is selected
    setIsProcessed(false);
    setIsProcessing(false);
    setProcessingProgress(0);
    setProcessingStatus("");
    setError(null);
    
    // Fetch original text
    await fetchOriginalText(cvId);
  }, [fetchOriginalText]);
  
  // Process the CV for specific job
  const processCV = useCallback(async () => {
    if (!selectedCVId) {
      setError("Please select a CV first");
      return;
    }
    
    if (!jobDescription.trim()) {
      setError("Please enter a job description");
      return;
    }
    
    // Set processing state
    setIsProcessing(true);
    setIsProcessed(false);
    setProcessingProgress(0);
    setProcessingStatus("Starting job-specific optimization...");
    setError(null);
    
    try {
      console.log(`Processing CV: ${selectedCVName} (ID: ${selectedCVId}) for specific job`);
      
      // Simulate API call for job-specific optimization
      // In a real implementation, this would be an actual API call
      simulateProcessing();
      
    } catch (error) {
      console.error("Error optimizing CV for job:", error);
      setError(error instanceof Error ? error.message : "An unknown error occurred during optimization");
      setIsProcessing(false);
      setProcessingProgress(0);
    }
  }, [selectedCVId, selectedCVName, jobDescription]);
  
  // Simulate processing with progress updates
  const simulateProcessing = () => {
    let progress = 0;
    const interval = setInterval(() => {
      progress += Math.random() * 10;
      if (progress >= 100) {
        progress = 100;
        clearInterval(interval);
        
        // Generate optimized text based on job description
        const optimized = generateOptimizedText();
        setOptimizedText(optimized);
        
        // Generate structured CV
        generateStructuredCV(optimized, jobDescription);
        
        // Generate job match analysis on the optimized content
        analyzeJobMatch(optimized, jobDescription);
        
        // Complete processing
        setIsProcessing(false);
        setIsProcessed(true);
        setProcessingStatus("Optimization complete");
        setActiveTab('optimizedCV');
      }
      
      setProcessingProgress(Math.floor(progress));
      
      // Update status messages based on progress
      if (progress < 20) {
        setProcessingStatus("Analyzing job description...");
      } else if (progress < 40) {
        setProcessingStatus("Extracting key requirements...");
      } else if (progress < 60) {
        setProcessingStatus("Matching CV content to job requirements...");
      } else if (progress < 80) {
        setProcessingStatus("Optimizing CV content...");
      } else {
        setProcessingStatus("Finalizing optimized CV...");
      }
    }, 200);
    
    // Set timeout to show processing too long after 10 seconds
    setTimeout(() => {
      if (isProcessing) {
        setProcessingTooLong(true);
      }
    }, 10000);
  };
  
  // Generate optimized text based on job description
  const generateOptimizedText = () => {
    // Extract keywords from job description
    const jobKeywords = extractKeywords(jobDescription, true);
    const cvKeywords = extractKeywords(originalText);
    
    // Find missing keywords (keywords in job description but not in CV)
    const missingKeywords = jobKeywords.filter(jobKeyword => {
      return !cvKeywords.some(cvKeyword => {
        const jobKeywordLower = jobKeyword.toLowerCase();
        const cvKeywordLower = cvKeyword.toLowerCase();
        
        return cvKeywordLower === jobKeywordLower || 
               cvKeywordLower.includes(jobKeywordLower) || 
               jobKeywordLower.includes(cvKeywordLower);
      });
    });
    
    // Create a modified version of the original text that emphasizes these keywords
    let optimized = originalText;
    
    // Add a tailored professional summary that includes missing keywords
    const summaryKeywords = [...jobKeywords.slice(0, 3)];
    // Add some missing keywords to the summary if available
    if (missingKeywords.length > 0) {
      summaryKeywords.push(...missingKeywords.slice(0, 2));
    }
    
    const summary = `Experienced professional with expertise in ${summaryKeywords.join(', ')}, seeking to leverage my background in ${jobKeywords.slice(3, 5).join(' and ')} to excel in this role.`;
    
    // Replace or enhance the first paragraph (assuming it's the summary)
    const paragraphs = optimized.split('\n\n');
    if (paragraphs.length > 0) {
      paragraphs[0] = summary;
      optimized = paragraphs.join('\n\n');
    } else {
      optimized = summary + '\n\n' + optimized;
    }
    
    // Add achievements that incorporate missing keywords
    const achievementsSection = generateKeywordAchievements(missingKeywords);
    optimized += `\n\nKey Achievements:\n${achievementsSection}`;
    
    // Enhance skills section with job-specific keywords (including missing ones)
    const skillsSection = `\n\nKey Skills:\n• ${jobKeywords.join('\n• ')}`;
    optimized += skillsSection;
    
    // Add industry-specific experience section if needed
    const industryTerms = {
      tech: ['software', 'development', 'programming', 'code', 'technical', 'engineering', 'system', 'data', 'analysis', 'technology'],
      finance: ['finance', 'accounting', 'budget', 'financial', 'investment', 'banking', 'audit', 'tax', 'revenue', 'profit'],
      healthcare: ['health', 'medical', 'patient', 'clinical', 'hospital', 'care', 'treatment', 'doctor', 'nurse', 'therapy'],
      marketing: ['marketing', 'brand', 'campaign', 'market', 'customer', 'social media', 'digital', 'content', 'advertising', 'promotion']
    };
    
    // Detect the most likely industry from the job description
    let detectedIndustry = '';
    let highestIndustryScore = 0;
    
    for (const [industry, terms] of Object.entries(industryTerms)) {
      const score = terms.reduce((sum, term) => {
        const regex = new RegExp(term, 'gi');
        const matches = (jobDescription.match(regex) || []).length;
        return sum + matches;
      }, 0);
      
      if (score > highestIndustryScore) {
        highestIndustryScore = score;
        detectedIndustry = industry;
      }
    }
    
    // Add industry-specific experience if an industry was detected
    if (detectedIndustry) {
      const industryExperience = `\n\n${detectedIndustry.charAt(0).toUpperCase() + detectedIndustry.slice(1)} Industry Experience:\nLeveraged expertise in ${industryTerms[detectedIndustry as keyof typeof industryTerms].slice(0, 5).join(', ')} to deliver exceptional results in the ${detectedIndustry} sector.`;
      optimized += industryExperience;
    }
    
    return optimized;
  };
  
  // Add a helper function to generate achievements that incorporate missing keywords
  const generateKeywordAchievements = (keywords: string[]): string => {
    // Take up to 5 keywords to create achievements
    const keywordsToUse = keywords.slice(0, 5);
    
    // Detect industry to use industry-specific templates
    const industryTerms = {
      tech: ['software', 'development', 'programming', 'code', 'technical', 'engineering', 'system', 'data', 'analysis', 'technology'],
      finance: ['finance', 'accounting', 'budget', 'financial', 'investment', 'banking', 'audit', 'tax', 'revenue', 'profit'],
      healthcare: ['health', 'medical', 'patient', 'clinical', 'hospital', 'care', 'treatment', 'doctor', 'nurse', 'therapy'],
      marketing: ['marketing', 'brand', 'campaign', 'market', 'customer', 'social media', 'digital', 'content', 'advertising', 'promotion'],
      manufacturing: ['manufacturing', 'production', 'quality', 'assembly', 'operations', 'supply chain', 'lean', 'process', 'efficiency'],
      education: ['education', 'teaching', 'curriculum', 'learning', 'student', 'academic', 'training', 'instruction', 'assessment']
    };
    
    // Detect the most likely industry from the job description
    let detectedIndustry = '';
    let highestIndustryScore = 0;
    
    for (const [industry, terms] of Object.entries(industryTerms)) {
      const score = terms.reduce((sum, term) => {
        const regex = new RegExp(term, 'gi');
        const matches = (jobDescription.match(regex) || []).length;
        return sum + matches;
      }, 0);
      
      if (score > highestIndustryScore) {
        highestIndustryScore = score;
        detectedIndustry = industry;
      }
    }
    
    // Industry-specific achievement templates
    const industryTemplates: Record<string, string[]> = {
      tech: [
        "• Developed {keyword} solutions that improved system performance by 40%, resulting in enhanced user experience.",
        "• Led the implementation of {keyword} architecture that scaled to support 200% business growth.",
        "• Optimized {keyword} processes, reducing development time by 35% and improving code quality.",
        "• Created {keyword} documentation and training materials that reduced onboarding time by 50%.",
        "• Implemented {keyword} best practices that reduced system downtime by 75%."
      ],
      finance: [
        "• Developed {keyword} analysis that identified $1.2M in cost-saving opportunities.",
        "• Led {keyword} initiatives that improved financial reporting accuracy by 45%.",
        "• Implemented {keyword} controls that ensured 100% compliance with regulatory requirements.",
        "• Optimized {keyword} processes, reducing month-end close time by 30%.",
        "• Created {keyword} dashboards that improved executive decision-making capabilities."
      ],
      healthcare: [
        "• Implemented {keyword} protocols that improved patient satisfaction scores by 35%.",
        "• Developed {keyword} training programs that reduced error rates by 40%.",
        "• Led {keyword} initiatives that improved care coordination and reduced readmissions by 25%.",
        "• Optimized {keyword} workflows, increasing provider efficiency by 30%.",
        "• Created {keyword} documentation that ensured 100% compliance with healthcare regulations."
      ],
      marketing: [
        "• Developed {keyword} campaigns that increased customer engagement by 45%.",
        "• Led {keyword} initiatives that generated 30% increase in qualified leads.",
        "• Implemented {keyword} strategies that improved conversion rates by 25%.",
        "• Created {keyword} content that increased organic traffic by 60%.",
        "• Optimized {keyword} channels, resulting in 35% reduction in customer acquisition costs."
      ],
      manufacturing: [
        "• Implemented {keyword} processes that improved production efficiency by 35%.",
        "• Led {keyword} initiatives that reduced defect rates by 40%.",
        "• Developed {keyword} training programs that improved worker productivity by 25%.",
        "• Optimized {keyword} workflows, reducing production cycle time by 30%.",
        "• Created {keyword} documentation that ensured 100% compliance with safety regulations."
      ],
      education: [
        "• Developed {keyword} curriculum that improved student performance metrics by 30%.",
        "• Led {keyword} initiatives that increased student engagement and participation by 45%.",
        "• Implemented {keyword} methodologies that improved learning outcomes by 25%.",
        "• Created {keyword} assessment tools that provided more accurate measurement of student progress.",
        "• Optimized {keyword} resources, resulting in more efficient use of instructional time."
      ]
    };
    
    // Default templates for when no specific industry is detected
    const defaultTemplates = [
      "• Led initiatives to improve {keyword} processes, resulting in 30% increased efficiency.",
      "• Developed and implemented {keyword} strategies that reduced costs by 25%.",
      "• Spearheaded the adoption of new {keyword} methodologies, increasing productivity by 40%.",
      "• Created comprehensive {keyword} documentation that improved team performance.",
      "• Optimized {keyword} workflows through innovative approaches."
    ];
    
    // Select the appropriate templates based on detected industry
    const templates = detectedIndustry && industryTemplates[detectedIndustry] 
      ? industryTemplates[detectedIndustry] 
      : defaultTemplates;
    
    // Extract metrics from the CV to make achievements more realistic
    const metricPatterns = [
      /(\d+)%\s+(?:increase|improvement|reduction|decrease|growth)/gi,
      /(?:increased|improved|reduced|decreased|grew)\s+(?:by\s+)?(\d+)%/gi,
      /\$(\d+(?:\.\d+)?)\s*(?:million|m|k|thousand)/gi
    ];
    
    // Extract actual metrics from the original CV if available
    const extractedMetrics: string[] = [];
    metricPatterns.forEach(pattern => {
      let match;
      const originalTextLower = originalText.toLowerCase();
      while ((match = pattern.exec(originalTextLower)) !== null) {
        if (match[1]) {
          extractedMetrics.push(match[1]);
        }
      }
    });
    
    // Generate achievements for each keyword
    let achievements = '';
    keywordsToUse.forEach((keyword, index) => {
      if (index < templates.length) {
        // Replace the template placeholder with the keyword
        let achievement = templates[index].replace('{keyword}', keyword.toLowerCase());
        
        // If we have extracted metrics, use them to make the achievements more realistic
        if (extractedMetrics.length > index) {
          // Replace numeric values with actual metrics from the CV
          achievement = achievement.replace(/\d+%/, `${extractedMetrics[index]}%`);
        }
        
        achievements += achievement + '\n';
      }
    });
    
    return achievements;
  };
  
  // Enhance the extractKeywords function with more sophisticated NLP-like techniques
  const extractKeywords = (text: string, isJobDescription: boolean = false): string[] => {
    // More comprehensive list of common words to filter out
    const commonWords = [
      'and', 'the', 'a', 'an', 'in', 'on', 'at', 'to', 'for', 'with', 'by', 'of', 'as', 
      'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 
      'does', 'did', 'will', 'would', 'should', 'can', 'could', 'may', 'might', 'must',
      'that', 'this', 'these', 'those', 'it', 'its', 'we', 'our', 'you', 'your', 'they', 'their',
      'from', 'then', 'than', 'when', 'where', 'which', 'who', 'whom', 'whose', 'what', 'why', 'how',
      'all', 'any', 'both', 'each', 'few', 'more', 'most', 'some', 'such', 'no', 'nor', 'not', 'only',
      'own', 'same', 'so', 'than', 'too', 'very', 'just', 'but', 'however', 'therefore'
    ];
    
    // Industry-specific terms that should be recognized as important
    const industryTerms = [
      'experience', 'skills', 'knowledge', 'proficient', 'expert', 'familiar', 'degree',
      'certification', 'qualified', 'responsible', 'manage', 'develop', 'implement',
      'analyze', 'design', 'create', 'maintain', 'improve', 'optimize', 'lead', 'collaborate',
      'strategic', 'technical', 'professional', 'specialized', 'advanced', 'senior', 'junior',
      'entry-level', 'mid-level', 'executive', 'director', 'manager', 'supervisor', 'coordinator',
      'specialist', 'analyst', 'consultant', 'engineer', 'developer', 'architect', 'designer'
    ];
    
    // Identify multi-word phrases that are likely to be important
    const extractPhrases = (text: string): string[] => {
      const phrases: string[] = [];
      
      // Common phrase patterns in job descriptions and CVs
      const phrasePatterns = [
        /([A-Z][a-z]+\s[A-Z][a-z]+(?:\s[A-Z][a-z]+)?)/g, // Capitalized phrases like "Project Management"
        /([a-z]+\s(?:management|engineering|development|analysis|design|architecture|strategy|planning))/gi, // Domain-specific phrases
        /([0-9]+\+?\s(?:years|yrs)(?:\sof)?\s(?:experience|exp))/gi, // Experience requirements
        /((?:bachelor'?s?|master'?s?|phd|doctorate|mba|bs|ms|ba)(?:\sdegree)?(?:\sin\s[a-z\s]+)?)/gi, // Education requirements
        /((?:proficient|skilled|experienced|knowledgeable|expert)(?:\sin\s[a-z\s]+))/gi, // Skill descriptors
        /([a-z]+(?:-[a-z]+)+)/gi, // Hyphenated terms like "cross-functional"
      ];
      
      // Extract phrases using patterns
      phrasePatterns.forEach(pattern => {
        const matches = text.match(pattern);
        if (matches) {
          matches.forEach(match => {
            if (match.length > 5 && !commonWords.includes(match.toLowerCase())) {
              phrases.push(match.trim());
            }
          });
        }
      });
      
      return phrases;
    };
    
    // Extract sections for more targeted keyword extraction
    const extractSections = (text: string, isJobDescription: boolean): Record<string, string[]> => {
      const sections: Record<string, string[]> = {
        requirements: [],
        responsibilities: [],
        qualifications: [],
        skills: []
      };
      
      if (isJobDescription) {
        // Extract requirements section
        const requirementsMatch = text.match(/(?:requirements|qualifications|what you'll need|what you need|what we're looking for)(?::|.{0,10})\s*([\s\S]*?)(?:\n\n|\n[A-Z]|$)/i);
        if (requirementsMatch && requirementsMatch[1]) {
          const reqLines = requirementsMatch[1].split('\n').filter(line => line.trim().length > 0);
          sections.requirements = reqLines.map(line => {
            // Clean up bullet points and other markers
            return line.replace(/^[\s•\-\*\+\>\·\♦\■\□\◆\◇\○\●\★\☆]+/, '').trim();
          });
        }
        
        // Extract responsibilities section
        const responsibilitiesMatch = text.match(/(?:responsibilities|duties|what you'll do|role description|job description)(?::|.{0,10})\s*([\s\S]*?)(?:\n\n|\n[A-Z]|$)/i);
        if (responsibilitiesMatch && responsibilitiesMatch[1]) {
          const respLines = responsibilitiesMatch[1].split('\n').filter(line => line.trim().length > 0);
          sections.responsibilities = respLines.map(line => {
            return line.replace(/^[\s•\-\*\+\>\·\♦\■\□\◆\◇\○\●\★\☆]+/, '').trim();
          });
        }
        
        // Extract skills section
        const skillsMatch = text.match(/(?:skills|technical skills|required skills|key skills)(?::|.{0,10})\s*([\s\S]*?)(?:\n\n|\n[A-Z]|$)/i);
        if (skillsMatch && skillsMatch[1]) {
          const skillLines = skillsMatch[1].split('\n').filter(line => line.trim().length > 0);
          sections.skills = skillLines.map(line => {
            return line.replace(/^[\s•\-\*\+\>\·\♦\■\□\◆\◇\○\●\★\☆]+/, '').trim();
          });
        }
      }
      
      return sections;
    };
    
    // Extract words, including multi-word phrases for job descriptions
    let words: string[] = [];
    const phrases = extractPhrases(text);
    words = [...words, ...phrases];
    
    // Extract sections for more targeted keyword extraction
    const sections = extractSections(text, isJobDescription);
    
    if (isJobDescription) {
      // For job descriptions, prioritize keywords from specific sections
      Object.values(sections).forEach(sectionLines => {
        sectionLines.forEach(line => {
          // Extract key terms from each line
          const lineWords = line.toLowerCase()
            .replace(/[.,;:()\[\]{}]/g, ' ')
            .split(/\s+/)
            .filter(word => word.length > 3 && !commonWords.includes(word));
          
          words = [...words, ...lineWords];
        });
      });
      
      // Extract skills specifically mentioned with "proficient in" or similar phrases
      const skillPatterns = [
        /experience (?:in|with) ([\w\s]+?)(?:\.|\,|\;|\n|$)/gi,
        /knowledge of ([\w\s]+?)(?:\.|\,|\;|\n|$)/gi,
        /proficient (?:in|with) ([\w\s]+?)(?:\.|\,|\;|\n|$)/gi,
        /familiar (?:with) ([\w\s]+?)(?:\.|\,|\;|\n|$)/gi,
        /skills (?:in|with) ([\w\s]+?)(?:\.|\,|\;|\n|$)/gi,
        /expertise (?:in|with) ([\w\s]+?)(?:\.|\,|\;|\n|$)/gi
      ];
      
      // Extract multi-word skills
      skillPatterns.forEach(pattern => {
        let match;
        while ((match = pattern.exec(text)) !== null) {
          if (match[1] && match[1].trim().length > 3) {
            words.push(match[1].trim());
          }
        }
      });
    }
    
    // Also extract individual words
    const singleWords = text.toLowerCase()
      .replace(/[.,;:()\[\]{}]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 3 && !commonWords.includes(word));
    
    words = [...words, ...singleWords];
    
    // Count word frequency with special handling for industry terms
    const wordCount: Record<string, number> = {};
    words.forEach(word => {
      // Normalize the word
      const normalizedWord = word.toLowerCase().trim();
      
      // Skip common words and very short words
      if (normalizedWord.length <= 3 || commonWords.includes(normalizedWord)) {
        return;
      }
      
      // Give higher weight to industry terms and phrases
      let weight = 1;
      if (industryTerms.includes(normalizedWord)) {
        weight = 3; // Higher weight for industry terms
      } else if (normalizedWord.includes(' ')) {
        weight = 2; // Higher weight for multi-word phrases
      }
      
      // Add to count
      wordCount[normalizedWord] = (wordCount[normalizedWord] || 0) + weight;
    });
    
    // Sort by frequency and get top keywords
    const sortedKeywords = Object.entries(wordCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, isJobDescription ? 20 : 15) // Get more keywords for job descriptions
      .map(([word]) => {
        // Capitalize each word in multi-word phrases
        if (word.includes(' ')) {
          return word.split(' ')
            .map(w => w.charAt(0).toUpperCase() + w.slice(1))
            .join(' ');
        }
        return word.charAt(0).toUpperCase() + word.slice(1);
      });
    
    return sortedKeywords;
  };
  
  // Update the generateStructuredCV function to create a more interesting title
  const generateStructuredCV = async (cvText: string, jobDescription: string) => {
    try {
      // Extract name from CV
      const nameMatch = cvText.match(/^([A-Za-z\s]+)/);
      const name = nameMatch ? nameMatch[1].trim() : 'Professional CV';

      // Extract keywords from CV and job description
      const cvKeywords = extractKeywords(cvText);
      const jobKeywords = extractKeywords(jobDescription);

      // Generate subheader based on experience
      const experience = extractExperienceData(cvText);
      const yearsOfExp = calculateYearsOfExperience(experience);
      const subheader = experience && experience.length > 0 
        ? `${experience[0].title || 'Professional'} with ${yearsOfExp} years of experience`
        : jobKeywords[0] ? `Professional specializing in ${jobKeywords[0].toLowerCase()}` : 'Professional CV';

      // Generate profile
      const profile = generateProfile(cvText, jobDescription, jobKeywords, yearsOfExp);

      // Structure experience data
      const structuredExperience = experience || [{
        dates: 'Present',
        title: 'Professional',
        company: null,
        responsibilities: generateResponsibilities(jobKeywords)
      }];

      // Structure education data
      const education = extractEducationData(cvText) || [{
        degree: 'Bachelor\'s Degree',
        field: 'Business Administration',
        institution: 'University',
        year: 'Present'
      }];

      // Generate skills
      const technicalSkills = generateTechnicalSkills(jobKeywords);
      const professionalSkills = generateProfessionalSkills(jobKeywords);
      const skills = {
        technical: technicalSkills,
        professional: professionalSkills
      };

      // Generate achievements
      const achievements = generateAchievements(jobKeywords, structuredExperience);

      // Calculate job match score and generate recommendations
      const matchScore = calculateJobMatchScore(cvKeywords, jobKeywords);
      const recommendations = generateRecommendations(cvKeywords, jobKeywords, matchScore);

      // Set the job match score and recommendations
      setJobMatchScore(matchScore);
      setRecommendations(recommendations);

      return {
        name,
        subheader,
        profile,
        experience: structuredExperience,
        education,
        skills,
        achievements
      };
    } catch (error) {
      console.error('Error generating structured CV:', error);
      throw error;
    }
  };
  
  // Helper function to extract experience data
  const extractExperienceData = (cvText: string): ExperienceEntry[] | null => {
    // Split CV into sections
    const sections = cvText.split('\n\n').filter(section => section.trim().length > 0);
    
    // Find the experience section
    const experienceSection = sections.find(section => 
      section.toLowerCase().includes('experience') || 
      section.toLowerCase().includes('work history') ||
      section.toLowerCase().includes('employment')
    );
    
    if (!experienceSection) return null;
    
    // Extract individual experience entries
    const experienceEntries = experienceSection
      .split('\n')
      .filter(line => line.trim().length > 0)
      .map(line => {
        // Try to match date patterns
        const dateMatch = line.match(/(?:^|\n)(?:19|20)\d{2}\s*[-–—]\s*(?:19|20)\d{2}|(?:^|\n)(?:19|20)\d{2}\s*[-–—]\s*present/gi);
        
        if (dateMatch) {
          // This is likely a job entry
          const dates = dateMatch[0].trim();
          const titleMatch = line.match(/([^•\-\*\+\>\·\♦\■\□\◆\◇\○\●\★\☆]+?)(?:\s*[-–—]\s*|$)/);
          const title = titleMatch ? titleMatch[1].trim() : null;
          
          // Extract company name if present
          const companyMatch = line.match(/(?:at|with|for)\s+([^•\-\*\+\>\·\♦\■\□\◆\◇\○\●\★\☆]+?)(?:\s*[-–—]\s*|$)/i);
          const company = companyMatch ? companyMatch[1].trim() : null;
          
          // Extract responsibilities/achievements
          const responsibilities = line
            .split('\n')
            .filter(l => l.trim().startsWith('•') || l.trim().startsWith('-') || l.trim().startsWith('*'))
            .map(l => l.replace(/^[\s•\-\*\+\>\·\♦\■\□\◆\◇\○\●\★\☆]+/, '').trim())
            .filter(l => l.length > 0);
          
          return {
            dates,
            title,
            company,
            responsibilities
          };
        }
        
        return null;
      })
      .filter((entry): entry is ExperienceEntry => entry !== null && entry.dates !== null);
    
    return experienceEntries.length > 0 ? experienceEntries : null;
  };
  
  // Helper function to extract education data
  const extractEducationData = (cvText: string): EducationEntry[] | null => {
    // Split CV into sections
    const sections = cvText.split('\n\n').filter(section => section.trim().length > 0);
    
    // Find the education section
    const educationSection = sections.find(section => 
      section.toLowerCase().includes('education') || 
      section.toLowerCase().includes('qualifications') ||
      section.toLowerCase().includes('academic')
    );
    
    if (!educationSection) return null;
    
    // Extract education entries
    const educationEntries = educationSection
      .split('\n')
      .filter(line => line.trim().length > 0)
      .map(line => {
        // Try to match degree patterns
        const degreeMatch = line.match(/(?:Bachelor'?s|Master'?s|Ph\.?D|Associate'?s|MBA|B\.S\.|M\.S\.|B\.A\.|M\.A\.)/i);
        
        if (degreeMatch) {
          const degree = degreeMatch[0].trim();
          
          // Extract field of study if present
          const fieldMatch = line.match(/(?:in|of)\s+([^,.;]+)/i);
          const field = fieldMatch ? fieldMatch[1].trim() : null;
          
          // Extract institution if present
          const institutionMatch = line.match(/(?:from|at)\s+([^,.;]+)/i);
          const institution = institutionMatch ? institutionMatch[1].trim() : null;
          
          // Extract year if present
          const yearMatch = line.match(/(?:19|20)\d{2}/);
          const year = yearMatch ? yearMatch[0] : null;
          
          return {
            degree,
            field,
            institution,
            year
          };
        }
        
        return null;
      })
      .filter((entry): entry is EducationEntry => entry !== null && entry.degree !== null);
    
    return educationEntries.length > 0 ? educationEntries : null;
  };
  
  // Helper function to generate profile
  const generateProfile = (cvText: string, jobDescription: string, keywords: string[], yearsOfExp: number) => {
    const industryTerms = keywords.filter(k => k.toLowerCase().includes('industry') || k.toLowerCase().includes('sector'));
    const skillTerms = keywords.filter(k => k.toLowerCase().includes('skill') || k.toLowerCase().includes('expertise'));
    
    let profile = `Results-driven professional with ${yearsOfExp} years of experience`;
    
    if (industryTerms.length > 0) {
      profile += ` in ${industryTerms[0].toLowerCase()}`;
    }
    
    if (skillTerms.length > 0) {
      profile += `, specializing in ${skillTerms[0].toLowerCase()}`;
    }
    
    profile += `. Proven track record of delivering impactful solutions and driving business growth.`;
    
    return profile;
  };
  
  // Helper function to generate responsibilities
  const generateResponsibilities = (keywords: string[]): string[] => {
    const responsibilities: string[] = [];
    const actionVerbs = ['Led', 'Managed', 'Developed', 'Implemented', 'Designed', 'Created', 'Optimized', 'Improved'];
    const actionVerb = actionVerbs[Math.floor(Math.random() * actionVerbs.length)];
    
    keywords.slice(0, 3).forEach(keyword => {
      responsibilities.push(`${actionVerb} ${keyword.toLowerCase()} initiatives and projects`);
    });
    
    return responsibilities;
  };
  
  // Helper function to generate technical skills
  const generateTechnicalSkills = (keywords: string[]) => {
    const technicalSkills = keywords
      .filter(k => k.toLowerCase().includes('technology') || k.toLowerCase().includes('software') || k.toLowerCase().includes('tool'))
      .slice(0, 5);
    
    if (technicalSkills.length === 0) {
      return ['Project Management', 'Data Analysis', 'Technical Documentation', 'System Design', 'Quality Assurance'];
    }
    
    return technicalSkills;
  };
  
  // Helper function to generate professional skills
  const generateProfessionalSkills = (keywords: string[]) => {
    const professionalSkills = keywords
      .filter(k => k.toLowerCase().includes('management') || k.toLowerCase().includes('leadership') || k.toLowerCase().includes('communication'))
      .slice(0, 5);
    
    if (professionalSkills.length === 0) {
      return ['Team Leadership', 'Strategic Planning', 'Cross-functional Collaboration', 'Problem Solving', 'Communication'];
    }
    
    return professionalSkills;
  };
  
  // Helper function to generate achievements
  const generateAchievements = (keywords: string[], experience: any[]) => {
    const achievements = [];
  // Add a function to extract skills data from the CV
  const extractSkillsData = (cvText: string) => {
    // Split CV into sections
    const sections = cvText.split('\n\n').filter(section => section.trim().length > 0);
    
    // Find the skills section
    const skillsSection = sections.find(section => 
      section.toLowerCase().includes('skills') || 
      section.toLowerCase().includes('expertise') ||
      section.toLowerCase().includes('competencies')
    );
    
    if (!skillsSection) return null;
    
    // Extract skills from bullet points or comma-separated lists
    const skills = skillsSection
      .split('\n')
      .filter(line => line.trim().length > 0)
      .map(line => {
        const cleanLine = line.replace(/^[\s•\-\*\+\>\·\♦\■\□\◆\◇\○\●\★\☆]+/, '').trim();
        
        if (cleanLine.includes(',')) {
          // Handle comma-separated skills
          return cleanLine.split(',').map(s => s.trim()).filter(s => s.length > 0);
        } else if (cleanLine.length > 0) {
          // Handle single skill per line
          return [cleanLine];
        }
        
        return [];
      })
      .flat();
    
    return skills;
  };
  
  // Add a function to extract achievements data from the CV
  const extractAchievementsData = (cvText: string) => {
    // Split CV into sections
    const sections = cvText.split('\n\n').filter(section => section.trim().length > 0);
    
    // Find the achievements section
    const achievementsSection = sections.find(section => 
      section.toLowerCase().includes('achievements') || 
      section.toLowerCase().includes('accomplishments') ||
      section.toLowerCase().includes('highlights')
    );
    
    if (!achievementsSection) return null;
    
    // Extract achievements from bullet points
    const achievements = achievementsSection
      .split('\n')
      .filter(line => line.trim().length > 0)
      .map(line => {
        const cleanLine = line.replace(/^[\s•\-\*\+\>\·\♦\■\□\◆\◇\○\●\★\☆]+/, '').trim();
        return cleanLine.length > 0 ? cleanLine : null;
      })
      .filter(achievement => achievement !== null);
    
    return achievements;
  };
  
  // Helper function to calculate years of experience
  const calculateYearsOfExperience = (experience: ExperienceEntry[] | null): number => {
    if (!experience || experience.length === 0) return 0;
    
    const totalYears = experience.reduce((acc, entry) => {
      if (!entry.dates) return acc;
      
      const [startYear] = entry.dates.match(/(\d{4})/) || [];
      const [endYear] = entry.dates.match(/(?:-\s*)(\d{4})/) || [];
      
      if (!startYear) return acc;
      
      const start = parseInt(startYear);
      const end = endYear ? parseInt(endYear) : new Date().getFullYear();
      
      return acc + (end - start);
    }, 0);
    
    return Math.round(totalYears / 365); // Convert days to years
  };
  
  // Helper function to analyze job match
  const analyzeJobMatch = (cvKeywords: string[], jobKeywords: string[]) => {
    const matchedKeywords = cvKeywords.filter(k => jobKeywords.includes(k));
    const matchScore = Math.round((matchedKeywords.length / jobKeywords.length) * 100);
    const missingKeywords = jobKeywords.filter(k => !cvKeywords.includes(k));
    
    return {
      matchScore,
      matchedKeywords,
      missingKeywords
    };
  };
  
  // Helper function to calculate job match score
  const calculateJobMatchScore = (cvKeywords: string[], jobKeywords: string[]): number => {
    const matchedKeywords = cvKeywords.filter(k => jobKeywords.includes(k));
    return Math.round((matchedKeywords.length / jobKeywords.length) * 100);
  };
  
  // Helper function to generate recommendations
  const generateRecommendations = (cvKeywords: string[], jobKeywords: string[], matchScore: number): string[] => {
    const recommendations: string[] = [];
    const missingKeywords = jobKeywords.filter(k => !cvKeywords.includes(k));
    
    if (matchScore < 70) {
      recommendations.push(`Add more relevant keywords: ${missingKeywords.slice(0, 3).join(', ')}`);
    }
    
    if (matchScore < 50) {
      recommendations.push('Consider adding more specific achievements and metrics');
      recommendations.push('Include more industry-specific experience and skills');
    }
    
    return recommendations;
  };
  
  // Handle reset
  const handleResetProcessing = () => {
    setIsProcessing(false);
    setProcessingProgress(0);
    setProcessingStatus("");
    setProcessingTooLong(false);
    setError(null);
  };
  
  // Add missing functions at the top of the file
  const handleDownloadDocx = async () => {
    try {
      setProcessingStatus('Generating DOCX document...');
      
      // Create a new document
      const doc = new Document({
        sections: [{
          properties: {},
          children: [
            // Header
            new Paragraph({
              children: [
                new TextRun({
                  text: structuredCV.name,
                  bold: true,
                  size: 32,
                  font: 'Calibri'
                })
              ],
              spacing: {
                after: 200
              }
            }),
            
            // Subheader
            new Paragraph({
              children: [
                new TextRun({
                  text: structuredCV.subheader,
                  bold: true,
                  size: 24,
                  font: 'Calibri'
                })
              ],
              spacing: {
                after: 200
              }
            }),
            
            // Profile
            new Paragraph({
              children: [
                new TextRun({
                  text: 'Professional Profile',
                  bold: true,
                  size: 20,
                  font: 'Calibri'
                })
              ],
              spacing: {
                before: 400,
                after: 200
              }
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: structuredCV.profile,
                  size: 12,
                  font: 'Calibri'
                })
              ],
              spacing: {
                after: 200
              }
            }),
            
            // Experience
            new Paragraph({
              children: [
                new TextRun({
                  text: 'Professional Experience',
                  bold: true,
                  size: 20,
                  font: 'Calibri'
                })
              ],
              spacing: {
                before: 400,
                after: 200
              }
            }),
            ...structuredCV.experience.map(entry => [
              new Paragraph({
                children: [
                  new TextRun({
                    text: entry.title || '',
                    bold: true,
                    size: 14,
                    font: 'Calibri'
                  }),
                  new TextRun({
                    text: entry.company ? ` at ${entry.company}` : '',
                    bold: true,
                    size: 14,
                    font: 'Calibri'
                  })
                ],
                spacing: {
                  after: 100
                }
              }),
              new Paragraph({
                children: [
                  new TextRun({
                    text: entry.dates,
                    italics: true,
                    size: 12,
                    font: 'Calibri'
                  })
                ],
                spacing: {
                  after: 100
                }
              }),
              ...entry.responsibilities.map(resp => 
                new Paragraph({
                  children: [
                    new TextRun({
                      text: '• ',
                      size: 12,
                      font: 'Calibri'
                    }),
                    new TextRun({
                      text: resp,
                      size: 12,
                      font: 'Calibri'
                    })
                  ],
                  spacing: {
                    after: 100
                  }
                })
              )
            ]).flat(),
            
            // Education
            new Paragraph({
              children: [
                new TextRun({
                  text: 'Education',
                  bold: true,
                  size: 20,
                  font: 'Calibri'
                })
              ],
              spacing: {
                before: 400,
                after: 200
              }
            }),
            ...structuredCV.education.map(entry => 
              new Paragraph({
                children: [
                  new TextRun({
                    text: `${entry.degree}${entry.field ? ` in ${entry.field}` : ''}`,
                    bold: true,
                    size: 14,
                    font: 'Calibri'
                  }),
                  new TextRun({
                    text: entry.institution ? ` - ${entry.institution}` : '',
                    size: 14,
                    font: 'Calibri'
                  }),
                  new TextRun({
                    text: entry.year ? ` (${entry.year})` : '',
                    italics: true,
                    size: 12,
                    font: 'Calibri'
                  })
                ],
                spacing: {
                  after: 100
                }
              })
            ),
            
            // Skills
            new Paragraph({
              children: [
                new TextRun({
                  text: 'Skills',
                  bold: true,
                  size: 20,
                  font: 'Calibri'
                })
              ],
              spacing: {
                before: 400,
                after: 200
              }
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: 'Technical Skills: ',
                  bold: true,
                  size: 14,
                  font: 'Calibri'
                }),
                new TextRun({
                  text: structuredCV.skills.technical.join(', '),
                  size: 12,
                  font: 'Calibri'
                })
              ],
              spacing: {
                after: 100
              }
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: 'Professional Skills: ',
                  bold: true,
                  size: 14,
                  font: 'Calibri'
                }),
                new TextRun({
                  text: structuredCV.skills.professional.join(', '),
                  size: 12,
                  font: 'Calibri'
                })
              ],
              spacing: {
                after: 100
              }
            }),
            
            // Achievements
            new Paragraph({
              children: [
                new TextRun({
                  text: 'Key Achievements',
                  bold: true,
                  size: 20,
                  font: 'Calibri'
                })
              ],
              spacing: {
                before: 400,
                after: 200
              }
            }),
            ...structuredCV.achievements.map(achievement => 
              new Paragraph({
                children: [
                  new TextRun({
                    text: '• ',
                    size: 12,
                    font: 'Calibri'
                  }),
                  new TextRun({
                    text: achievement,
                    size: 12,
                    font: 'Calibri'
                  })
                ],
                spacing: {
                  after: 100
                }
              })
            )
          ]
        }]
      });

      // Generate the document
      const buffer = await Packer.toBuffer(doc);
      
      // Create a blob and download
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${structuredCV.name.replace(/\s+/g, '_')}_Optimized_CV.docx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      setProcessingStatus('Document generated successfully!');
    } catch (error) {
      console.error('Error generating DOCX:', error);
      setProcessingStatus('Error generating document. Please try again.');
    }
  };
  
  // Add missing functions
  const extractTechnicalSkills = (skills: SkillsData): string => {
    return skills.technical.join(', ');
  };

  const extractProfessionalSkills = (skills: SkillsData): string => {
    return skills.professional.join(', ');
  };

  const extractIndustrySkills = (skills: SkillsData): string => {
    // Combine both technical and professional skills for industry knowledge
    return [...skills.technical, ...skills.professional].join(', ');
  };
  
  return (
    <div className="bg-[#050505] text-white rounded-md border border-gray-700">
      {error && (
        <Alert className="mb-4 bg-destructive/10">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      
      {/* Processing indicator */}
      {isProcessing && (
        <div className="mb-4 p-4 border rounded-md bg-[#050505]">
          <h3 className="text-lg font-semibold">Processing CV for Job Match</h3>
          <p className="text-sm text-muted-foreground">
            {processingStatus || "Processing..."}. Might take a couple minutes, please wait for an accurate job-specific optimization.
          </p>
          <div className="w-full h-2 bg-secondary mt-2 rounded-full overflow-hidden">
            <div 
              className="h-full bg-primary transition-all duration-300 ease-in-out" 
              style={{ width: `${processingProgress || 0}%` }}
            />
          </div>
          <div className="flex justify-between items-center mt-1">
            <p className="text-sm">{processingProgress || 0}%</p>
            {processingTooLong && (
              <button
                onClick={handleResetProcessing}
                className="px-3 py-1 bg-red-900/30 hover:bg-red-800/50 text-red-300 border border-red-800 rounded-md flex items-center text-xs"
              >
                <RefreshCw className="w-3 h-3 mr-1" />
                Taking too long? Reset
              </button>
            )}
          </div>
        </div>
      )}
      
      <div className="flex justify-around mb-4 border-b border-gray-800">
        <button 
          onClick={() => setActiveTab('jobDescription')}
          className={`px-4 py-2 ${activeTab === 'jobDescription' ? 'border-b-2 border-[#B4916C]' : ''}`}
        >
          Job Description
        </button>
        <button 
          onClick={() => setActiveTab('optimizedCV')}
          className={`px-4 py-2 ${activeTab === 'optimizedCV' ? 'border-b-2 border-[#B4916C]' : ''}`}
          disabled={!isProcessed}
        >
          Optimized CV
        </button>
      </div>
      
      {activeTab === 'jobDescription' && (
        <div className="p-4 space-y-4">
          <div className="p-3 bg-[#0a0a0a] border border-gray-700 rounded-md text-sm">
            <h3 className="font-medium text-[#B4916C] mb-2">How Job-Specific Optimization Works</h3>
            <p className="mb-2 text-gray-300">This tool tailors your CV to match the specific requirements of a job posting, increasing your chances of getting past ATS systems and impressing recruiters.</p>
            <ol className="list-decimal pl-5 space-y-1 text-gray-300">
              <li>Select your existing CV from the dropdown</li>
              <li>Paste the complete job description</li>
              <li>Click "Optimize CV for This Job"</li>
              <li>Review your optimized CV and download it in DOCX format</li>
            </ol>
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-medium">Select your CV</label>
            <ModernFileDropdown 
              cvs={cvs} 
              onSelect={handleSelectCV} 
              selectedCVName={selectedCVName} 
            />
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-medium">Job Description</label>
            <textarea 
              className="w-full p-2 bg-[#050505] text-white border border-gray-700 rounded-md focus:border-[#B4916C] focus:ring-[#B4916C]"
              placeholder="Paste the complete job description here including requirements, responsibilities, and qualifications. The more details you provide, the better we can optimize your CV for this specific position."
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
              rows={8}
            />
          </div>
          
          <button 
            onClick={processCV}
            disabled={!selectedCVId || !jobDescription.trim() || isProcessing}
            className={`mt-2 px-4 py-2 rounded-md w-full ${
              !selectedCVId || !jobDescription.trim() || isProcessing 
                ? 'bg-gray-700 text-gray-400 cursor-not-allowed' 
                : 'bg-[#B4916C] text-black hover:bg-[#a3815b] transition-colors'
            }`}
          >
            {isProcessing ? "Optimizing..." : "Optimize CV for This Job"}
          </button>
          
          {!selectedCVId && (
            <p className="text-sm text-amber-400 mt-2">Please select a CV first</p>
          )}
          
          {selectedCVId && !jobDescription.trim() && (
            <p className="text-sm text-amber-400 mt-2">Please paste a job description</p>
          )}
          
          {selectedCVId && jobDescription.trim() && jobDescription.length < 100 && (
            <p className="text-sm text-amber-400 mt-2">For best results, paste a complete job description (at least 100 characters)</p>
          )}
        </div>
      )}
      
      {activeTab === 'optimizedCV' && isProcessed && (
        <div className="p-4">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">Job-Optimized CV</h3>
            <div className="flex space-x-2">
              <button
                onClick={() => setShowStructuredView(!showStructuredView)}
                className="px-3 py-1 bg-[#050505] border border-gray-700 hover:border-[#B4916C] rounded-md text-sm flex items-center"
              >
                {showStructuredView ? <FileText className="w-4 h-4 mr-1" /> : <Info className="w-4 h-4 mr-1" />}
                {showStructuredView ? "Show Raw Text" : "Show Structured View"}
              </button>
              <button
                onClick={handleDownloadDocx}
                disabled={isProcessing}
                className="px-3 py-1 bg-[#B4916C] text-black hover:bg-[#a3815b] rounded-md text-sm flex items-center"
              >
                <Download className="w-4 h-4 mr-1" />
                {isProcessing ? "Generating..." : "Download DOCX"}
              </button>
            </div>
          </div>
          
          {/* Job Match Analysis - Enhanced with more detailed metrics */}
          <div className="mb-6 p-4 bg-[#0a0a0a] border border-gray-700 rounded-md">
            <div className="flex flex-col space-y-4">
              {/* Success message for optimization */}
              <div className="p-3 border border-green-800 rounded bg-green-900/20 text-green-400">
                <h4 className="text-sm font-medium mb-1 flex items-center">
                  <CheckCircle className="w-4 h-4 mr-1" />
                  Optimization Complete
                </h4>
                <p className="text-sm">Your CV has been successfully optimized for this job position with a compatibility score of {jobMatchAnalysis.dimensionalScores.overallCompatibility}%.</p>
              </div>
              
              {/* Overall compatibility score */}
              <div>
                <div className="flex justify-between mb-2">
                  <span className="font-medium">Overall Job Compatibility</span>
                  <span className="font-bold">{jobMatchAnalysis.dimensionalScores.overallCompatibility}%</span>
                </div>
                <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-[#B4916C] transition-all duration-300 ease-in-out"
                    style={{ width: `${jobMatchAnalysis.dimensionalScores.overallCompatibility}%` }}
                  />
                </div>
              </div>
              
              {/* Multi-dimensional scores */}
              <div className="grid grid-cols-2 gap-4 mt-4">
                {/* Skills Match */}
                <div className="p-3 border border-gray-700 rounded bg-[#050505]">
                  <div className="flex justify-between mb-1">
                    <h4 className="text-sm font-medium">Skills Match</h4>
                    <span className="text-sm font-bold">{jobMatchAnalysis.dimensionalScores.skillsMatch}%</span>
                  </div>
                  <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-emerald-600 transition-all duration-300 ease-in-out"
                      style={{ width: `${jobMatchAnalysis.dimensionalScores.skillsMatch}%` }}
                    />
                  </div>
                </div>
                
                {/* Experience Match */}
                <div className="p-3 border border-gray-700 rounded bg-[#050505]">
                  <div className="flex justify-between mb-1">
                    <h4 className="text-sm font-medium">Experience Match</h4>
                    <span className="text-sm font-bold">{jobMatchAnalysis.dimensionalScores.experienceMatch}%</span>
                  </div>
                  <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-blue-600 transition-all duration-300 ease-in-out"
                      style={{ width: `${jobMatchAnalysis.dimensionalScores.experienceMatch}%` }}
                    />
                  </div>
                </div>
                
                {/* Education Match */}
                <div className="p-3 border border-gray-700 rounded bg-[#050505]">
                  <div className="flex justify-between mb-1">
                    <h4 className="text-sm font-medium">Education Match</h4>
                    <span className="text-sm font-bold">{jobMatchAnalysis.dimensionalScores.educationMatch}%</span>
                  </div>
                  <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-purple-600 transition-all duration-300 ease-in-out"
                      style={{ width: `${jobMatchAnalysis.dimensionalScores.educationMatch}%` }}
                    />
                  </div>
                </div>
                
                {/* Industry Fit */}
                <div className="p-3 border border-gray-700 rounded bg-[#050505]">
                  <div className="flex justify-between mb-1">
                    <h4 className="text-sm font-medium">Industry Fit</h4>
                    <span className="text-sm font-bold">{jobMatchAnalysis.dimensionalScores.industryFit}%</span>
                  </div>
                  <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-amber-600 transition-all duration-300 ease-in-out"
                      style={{ width: `${jobMatchAnalysis.dimensionalScores.industryFit}%` }}
                    />
                  </div>
                </div>
              </div>
              
              {/* New metrics */}
              <div className="grid grid-cols-3 gap-4 mt-2">
                {/* Keyword Density */}
                <div className="p-3 border border-gray-700 rounded bg-[#050505]">
                  <div className="flex justify-between mb-1">
                    <h4 className="text-sm font-medium">Keyword Density</h4>
                    <span className="text-sm font-bold">{jobMatchAnalysis.dimensionalScores.keywordDensity}%</span>
                  </div>
                  <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-teal-600 transition-all duration-300 ease-in-out"
                      style={{ width: `${jobMatchAnalysis.dimensionalScores.keywordDensity}%` }}
                    />
                  </div>
                </div>
                
                {/* Format Compatibility */}
                <div className="p-3 border border-gray-700 rounded bg-[#050505]">
                  <div className="flex justify-between mb-1">
                    <h4 className="text-sm font-medium">Format Compatibility</h4>
                    <span className="text-sm font-bold">{jobMatchAnalysis.dimensionalScores.formatCompatibility}%</span>
                  </div>
                  <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-indigo-600 transition-all duration-300 ease-in-out"
                      style={{ width: `${jobMatchAnalysis.dimensionalScores.formatCompatibility}%` }}
                    />
                  </div>
                </div>
                
                {/* Content Relevance */}
                <div className="p-3 border border-gray-700 rounded bg-[#050505]">
                  <div className="flex justify-between mb-1">
                    <h4 className="text-sm font-medium">Content Relevance</h4>
                    <span className="text-sm font-bold">{jobMatchAnalysis.dimensionalScores.contentRelevance}%</span>
                  </div>
                  <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-pink-600 transition-all duration-300 ease-in-out"
                      style={{ width: `${jobMatchAnalysis.dimensionalScores.contentRelevance}%` }}
                    />
                  </div>
                </div>
              </div>
              
              {/* Section-specific analysis */}
              <div className="mt-4">
                <h4 className="text-sm font-medium mb-2">Section Analysis</h4>
                <div className="grid grid-cols-1 gap-3">
                  {/* Profile Section */}
                  <div className="p-3 border border-gray-700 rounded bg-[#050505]">
                    <div className="flex justify-between mb-1">
                      <h4 className="text-sm font-medium">Professional Profile</h4>
                      <span className="text-sm font-bold">{jobMatchAnalysis.sectionAnalysis.profile.score}%</span>
                    </div>
                    <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden mb-2">
                      <div 
                        className="h-full bg-[#B4916C] transition-all duration-300 ease-in-out"
                        style={{ width: `${jobMatchAnalysis.sectionAnalysis.profile.score}%` }}
                      />
                    </div>
                    <p className="text-xs text-gray-300">{jobMatchAnalysis.sectionAnalysis.profile.feedback}</p>
                  </div>
                  
                  {/* Skills Section */}
                  <div className="p-3 border border-gray-700 rounded bg-[#050505]">
                    <div className="flex justify-between mb-1">
                      <h4 className="text-sm font-medium">Skills</h4>
                      <span className="text-sm font-bold">{jobMatchAnalysis.sectionAnalysis.skills.score}%</span>
                    </div>
                    <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden mb-2">
                      <div 
                        className="h-full bg-[#B4916C] transition-all duration-300 ease-in-out"
                        style={{ width: `${jobMatchAnalysis.sectionAnalysis.skills.score}%` }}
                      />
                    </div>
                    <p className="text-xs text-gray-300">{jobMatchAnalysis.sectionAnalysis.skills.feedback}</p>
                  </div>
                  
                  {/* Achievements Section */}
                  <div className="p-3 border border-gray-700 rounded bg-[#050505]">
                    <div className="flex justify-between mb-1">
                      <h4 className="text-sm font-medium">Achievements</h4>
                      <span className="text-sm font-bold">{jobMatchAnalysis.sectionAnalysis.achievements.score}%</span>
                    </div>
                    <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden mb-2">
                      <div 
                        className="h-full bg-[#B4916C] transition-all duration-300 ease-in-out"
                        style={{ width: `${jobMatchAnalysis.sectionAnalysis.achievements.score}%` }}
                      />
                    </div>
                    <p className="text-xs text-gray-300">{jobMatchAnalysis.sectionAnalysis.achievements.feedback}</p>
                  </div>
                </div>
              </div>
              
              {/* Optimization improvements */}
              <div className="p-3 border border-gray-700 rounded bg-[#050505] mt-4">
                <h4 className="text-sm font-medium mb-2">Optimization Improvements</h4>
                <ul className="list-disc pl-5 space-y-1 text-sm text-gray-300">
                  <li>Added relevant keywords to your professional profile</li>
                  <li>Created targeted achievements highlighting key skills</li>
                  <li>Enhanced skills section to match job requirements</li>
                  <li>Improved overall content alignment with position needs</li>
                  {jobMatchAnalysis.improvementPotential < 10 && (
                    <li>Achieved excellent job compatibility score</li>
                  )}
                </ul>
              </div>
              
              {/* Skill gap assessment - now shows positive assessment */}
              <div className="mt-2 p-3 border border-gray-700 rounded bg-[#050505]">
                <h4 className="text-sm font-medium mb-1">Optimization Assessment</h4>
                <p className="text-sm text-gray-300">{jobMatchAnalysis.skillGap}</p>
              </div>
              
              {/* Detailed analysis */}
              <div className="mt-2 p-3 border border-gray-700 rounded bg-[#050505]">
                <h4 className="text-sm font-medium mb-1 flex items-center">
                  <Info className="w-4 h-4 mr-1" />
                  Detailed Analysis
                </h4>
                <p className="text-sm text-gray-300">{jobMatchAnalysis.detailedAnalysis}</p>
              </div>
              
              {/* Matched Keywords - now presented as "Optimized Keywords" */}
              <div className="mt-2">
                <h4 className="text-sm font-medium mb-2">Optimized Keywords</h4>
                <div className="flex flex-wrap gap-2 mb-4">
                  {jobMatchAnalysis.matchedKeywords.map((item, index) => (
                    <div key={index} className="px-2 py-1 bg-[#B4916C]/20 text-[#B4916C] rounded-md text-sm flex items-center group relative">
                      <CheckCircle className="w-3 h-3 mr-1" />
                      {item.keyword}
                      {/* Add tooltip with context if available */}
                      {item.context && (
                        <div className="absolute bottom-full left-0 mb-2 w-64 p-2 bg-gray-800 rounded-md shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-opacity z-10 text-xs">
                          <p className="text-white">{item.context}</p>
                          <div className="absolute bottom-0 left-4 transform translate-y-1/2 rotate-45 w-2 h-2 bg-gray-800"></div>
                        </div>
                      )}
                      <span className="ml-1 text-xs text-gray-400">({item.relevance}%)</span>
                      {item.frequency && item.frequency > 1 && (
                        <span className="ml-1 text-xs text-green-400">×{item.frequency}</span>
                      )}
                    </div>
                  ))}
                  {jobMatchAnalysis.matchedKeywords.length === 0 && (
                    <p className="text-sm text-gray-400">No keyword matches found</p>
                  )}
                </div>
                
                {/* Only show missing keywords if there are any */}
                {jobMatchAnalysis.missingKeywords.length > 0 && (
                  <>
                    <h4 className="text-sm font-medium mb-2">Additional Optimization Opportunities</h4>
                    <div className="flex flex-wrap gap-2 mb-4">
                      {jobMatchAnalysis.missingKeywords.map((item, index) => (
                        <span key={index} className="px-2 py-1 bg-amber-900/20 text-amber-400 rounded-md text-sm flex items-center group relative">
                          {item.keyword}
                          <span className="ml-1 text-xs text-gray-400">({item.importance}%)</span>
                          {item.suggestedPlacement && (
                            <div className="absolute bottom-full left-0 mb-2 w-64 p-2 bg-gray-800 rounded-md shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-opacity z-10 text-xs">
                              <p className="text-white">Suggested placement: {item.suggestedPlacement}</p>
                              <div className="absolute bottom-0 left-4 transform translate-y-1/2 rotate-45 w-2 h-2 bg-gray-800"></div>
                            </div>
                          )}
                        </span>
                      ))}
                    </div>
                    <p className="text-sm text-gray-400 mt-1">These keywords could be further emphasized in your CV for even better results.</p>
                  </>
                )}
                
                {/* Recommendations - now presented as "Optimization Results" */}
                <h4 className="text-sm font-medium mb-2 mt-4">Optimization Results</h4>
                <ul className="list-disc pl-5 space-y-1 text-sm text-gray-300">
                  {jobMatchAnalysis.recommendations.map((rec, index) => (
                    <li key={index}>{rec}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
          
          {showStructuredView ? (
            <div className="bg-[#0a0a0a] p-4 rounded-md space-y-4 border border-gray-700">
              <div className="text-center mb-4">
                <h2 className="text-xl font-bold">{structuredCV.name.replace("CV ALE 2025.pdf", "").trim()}</h2>
                {structuredCV.subheader && (
                  <p className="text-sm text-gray-400 mt-1">{structuredCV.subheader}</p>
                )}
              </div>
              
              {/* Enhanced Professional Profile */}
              <div className="p-4 bg-[#0a0a0a] border border-gray-700 rounded-md">
                <h3 className="text-md font-semibold mb-3 text-[#B4916C]">Professional Profile</h3>
                <p className="text-white leading-relaxed">{structuredCV.profile}</p>
              </div>
              
              {/* Enhanced Key Achievements */}
              <div className="p-4 bg-[#0a0a0a] border border-gray-700 rounded-md">
                <h3 className="text-md font-semibold mb-3 text-[#B4916C]">Key Achievements</h3>
                <ul className="list-disc pl-5 space-y-2 text-white">
                  {structuredCV.achievements.map((achievement: string, index: number) => (
                    <li key={index} className="leading-relaxed">{achievement}</li>
                  ))}
                </ul>
              </div>
              
              {/* Enhanced Skills Section */}
              <div className="p-4 bg-[#0a0a0a] border border-gray-700 rounded-md">
                <h3 className="text-md font-semibold mb-3 text-[#B4916C]">Skills</h3>
                
                <div className="mb-3">
                  <h4 className="text-sm font-medium text-white mb-2">Technical Skills</h4>
                  <p className="text-gray-300">{extractTechnicalSkills(structuredCV.skills)}</p>
                </div>
                
                <div className="mb-3">
                  <h4 className="text-sm font-medium text-white mb-2">Professional Skills</h4>
                  <p className="text-gray-300">{extractProfessionalSkills(structuredCV.skills)}</p>
                </div>
                
                <div>
                  <h4 className="text-sm font-medium text-white mb-2">Industry Knowledge</h4>
                  <p className="text-gray-300">{extractIndustrySkills(structuredCV.skills)}</p>
                </div>
              </div>
              
              {/* Job Keyword Matches - renamed to "Optimized Keywords" */}
              <div className="p-4 bg-[#0a0a0a] border border-gray-700 rounded-md">
                <h3 className="text-md font-semibold mb-3 text-[#B4916C]">Optimized Keywords</h3>
                <div className="flex flex-wrap gap-2">
                  {structuredCV.skills.technical.concat(structuredCV.skills.professional).map((keyword: string, index: number) => (
                    <span key={index} className="px-2 py-1 bg-[#B4916C]/20 text-[#B4916C] rounded-md text-sm">
                      {keyword}
                    </span>
                  ))}
                </div>
              </div>
              
              {/* Education */}
              <div className="p-4 bg-[#0a0a0a] border border-gray-700 rounded-md">
                <h3 className="text-md font-semibold mb-3 text-[#B4916C]">Education</h3>
                <p className="text-white">{structuredCV.education.join(', ')}</p>
              </div>
            </div>
          ) : (
            <div className="bg-[#0a0a0a] p-4 rounded-md whitespace-pre-line border border-gray-700">
              {optimizedText}
            </div>
          )}
          
          <button
            onClick={() => setActiveTab('jobDescription')}
            className="mt-4 px-4 py-2 bg-[#050505] border border-gray-700 hover:border-[#B4916C] rounded-md transition-colors"
          >
            Back to Job Description
          </button>
        </div>
      )}
      
      {/* Add this section after the job match analysis section */}
      {jobMatchScore > 0 && (
        <div className="bg-[#0a0a0a] p-4 rounded-md space-y-4 border border-gray-700">
          <div className="flex items-center justify-between">
            <h3 className="text-md font-semibold text-[#B4916C]">AI Match Score</h3>
            <div className="flex items-center">
              <div className="w-24 h-2 bg-gray-700 rounded-full mr-2">
                <div 
                  className="h-full bg-[#B4916C] rounded-full transition-all duration-300"
                  style={{ width: `${jobMatchScore}%` }}
                />
              </div>
              <span className="text-sm text-white">{jobMatchScore}%</span>
            </div>
          </div>
          
          {recommendations.length > 0 && (
            <div>
              <h3 className="text-md font-semibold mb-2 text-[#B4916C]">AI Recommendations</h3>
              <ul className="space-y-2">
                {recommendations.map((recommendation, index) => (
                  <li key={index} className="flex items-start">
                    <span className="text-[#B4916C] mr-2">•</span>
                    <span className="text-sm text-white">{recommendation}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
} 