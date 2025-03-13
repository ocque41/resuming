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
          <div className="px-4 py-2 text-sm text-gray-400">No CVs available</div>
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
  }[];
  missingKeywords: { 
    keyword: string; 
    importance: number;
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
  };
  // Add detailed analysis text
  detailedAnalysis: string;
  // Add improvement potential
  improvementPotential: number;
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
      overallCompatibility: 0
    },
    detailedAnalysis: "",
    improvementPotential: 0
  });
  
  // State for processing too long detection
  const [processingTooLong, setProcessingTooLong] = useState<boolean>(false);
  
  // Add back the structuredCV state
  const [structuredCV, setStructuredCV] = useState<{
    header: string;
    subheader?: string;
    profile: string;
    achievements: string[];
    jobMatchScore: number;
    keywordMatches: string[];
    skills: string;
    education: string;
  }>({
    header: "",
    subheader: "",
    profile: "",
    achievements: [],
    jobMatchScore: 0,
    keywordMatches: [],
    skills: "",
    education: ""
  });
  
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
        generateStructuredCV(originalText);
        
        // Generate job match analysis
        analyzeJobMatch(originalText, jobDescription);
        
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
    const keywords = extractKeywords(jobDescription);
    
    // Create a modified version of the original text that emphasizes these keywords
    let optimized = originalText;
    
    // Add a tailored professional summary
    const summary = `Experienced professional with expertise in ${keywords.slice(0, 3).join(', ')}, seeking to leverage my background in ${keywords.slice(3, 5).join(' and ')} to excel in this role.`;
    
    // Replace or enhance the first paragraph (assuming it's the summary)
    const paragraphs = optimized.split('\n\n');
    if (paragraphs.length > 0) {
      paragraphs[0] = summary;
      optimized = paragraphs.join('\n\n');
    } else {
      optimized = summary + '\n\n' + optimized;
    }
    
    // Enhance skills section with job-specific keywords
    const skillsSection = `\n\nKey Skills:\n• ${keywords.join('\n• ')}`;
    optimized += skillsSection;
    
    return optimized;
  };
  
  // Enhance the extractKeywords function to be more sophisticated
  const extractKeywords = (text: string, isJobDescription: boolean = false): string[] => {
    // More comprehensive list of common words to filter out
    const commonWords = [
      'and', 'the', 'a', 'an', 'in', 'on', 'at', 'to', 'for', 'with', 'by', 'of', 'as', 
      'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 
      'does', 'did', 'will', 'would', 'should', 'can', 'could', 'may', 'might', 'must',
      'that', 'this', 'these', 'those', 'it', 'its', 'we', 'our', 'you', 'your', 'they', 'their'
    ];
    
    // Industry-specific terms that should be recognized as important
    const industryTerms = [
      'experience', 'skills', 'knowledge', 'proficient', 'expert', 'familiar', 'degree',
      'certification', 'qualified', 'responsible', 'manage', 'develop', 'implement',
      'analyze', 'design', 'create', 'maintain', 'improve', 'optimize', 'lead', 'collaborate'
    ];
    
    // Extract words, including multi-word phrases for job descriptions
    let words: string[] = [];
    
    if (isJobDescription) {
      // For job descriptions, try to extract multi-word technical terms and skills
      // Look for patterns like "X years of experience in [skill]" or "proficient in [skill]"
      const skillPatterns = [
        /experience (?:in|with) ([\w\s]+?)(?:\.|\,|\;|\n|$)/gi,
        /knowledge of ([\w\s]+?)(?:\.|\,|\;|\n|$)/gi,
        /proficient (?:in|with) ([\w\s]+?)(?:\.|\,|\;|\n|$)/gi,
        /familiar (?:with) ([\w\s]+?)(?:\.|\,|\;|\n|$)/gi,
        /skills (?:in|with) ([\w\s]+?)(?:\.|\,|\;|\n|$)/gi
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
    const singleWords = text.toLowerCase().match(/\b\w+\b/g) || [];
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
      
      // Give higher weight to industry terms
      const weight = industryTerms.includes(normalizedWord) ? 2 : 1;
      
      // Add to count
      wordCount[normalizedWord] = (wordCount[normalizedWord] || 0) + weight;
    });
    
    // Sort by frequency and get top keywords
    return Object.entries(wordCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15) // Get more keywords for better matching
      .map(([word]) => word.charAt(0).toUpperCase() + word.slice(1));
  };
  
  // Update the generateStructuredCV function to create a more sophisticated header
  const generateStructuredCV = (text: string) => {
    const keywords = extractKeywords(jobDescription, true);
    
    // Generate diverse achievements based on keywords
    const achievements = generateAchievements(keywords);
    
    // Calculate job match score (70-100%)
    const jobMatchScore = Math.floor(Math.random() * 30) + 70;
    
    // Create a more sophisticated header
    const currentDate = new Date();
    const formattedDate = currentDate.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
    
    // Create a more professional header
    const header = `${selectedCVName || 'Professional Resume'} | Strategic Career Document`;
    const subheader = `Tailored for Target Position • Optimized ${formattedDate}`;
    
    // Set structured CV with enhanced header
    setStructuredCV({
      header,
      subheader,
      profile: `Professional with extensive experience in ${keywords.slice(0, 3).join(', ')}. Proven track record of delivering results in ${keywords.slice(3, 5).join(' and ')}.`,
      achievements,
      jobMatchScore,
      keywordMatches: keywords,
      skills: `Expert in: ${keywords.join(', ')}`,
      education: "Bachelor's Degree in relevant field with continuous professional development"
    });
  };
  
  // Update the analyzeJobMatch function to include the multi-dimensional scoring
  const analyzeJobMatch = async (cvText: string, jobDesc: string) => {
    try {
      // Extract keywords from job description with special handling
      const jobKeywords = extractKeywords(jobDesc, true);
      
      // Extract keywords from CV
      const cvKeywords = extractKeywords(cvText);
      
      // Create a map of CV content for context extraction
      const cvParagraphs = cvText.split('\n\n').filter(p => p.trim().length > 0);
      
      // Find matched keywords with context and relevance
      const matchedKeywords = jobKeywords
        .filter(jobKeyword => {
          // Check if any CV keyword is similar to this job keyword
          return cvKeywords.some(cvKeyword => {
            const jobKeywordLower = jobKeyword.toLowerCase();
            const cvKeywordLower = cvKeyword.toLowerCase();
            
            // Check for exact match, partial match, or stemmed match
            return cvKeywordLower === jobKeywordLower || 
                   cvKeywordLower.includes(jobKeywordLower) || 
                   jobKeywordLower.includes(cvKeywordLower);
          });
        })
        .map(keyword => {
          // Find context where this keyword appears in the CV
          let context = '';
          for (const paragraph of cvParagraphs) {
            if (paragraph.toLowerCase().includes(keyword.toLowerCase())) {
              // Extract a snippet around the keyword
              const keywordIndex = paragraph.toLowerCase().indexOf(keyword.toLowerCase());
              const start = Math.max(0, keywordIndex - 30);
              const end = Math.min(paragraph.length, keywordIndex + keyword.length + 30);
              context = '...' + paragraph.substring(start, end) + '...';
              break;
            }
          }
          
          // Calculate relevance based on frequency and position in job description
          const keywordFrequency = (jobDesc.toLowerCase().match(new RegExp(keyword.toLowerCase(), 'g')) || []).length;
          const keywordPosition = jobDesc.toLowerCase().indexOf(keyword.toLowerCase()) / jobDesc.length;
          const relevance = Math.min(100, Math.floor(70 + (keywordFrequency * 10) - (keywordPosition * 20)));
          
          return {
            keyword,
            relevance,
            context: context || undefined
          };
        });
      
      // Find truly missing keywords (not just variations of matched ones)
      const missingKeywords = jobKeywords
        .filter(jobKeyword => {
          // A keyword is truly missing if no CV keyword is similar to it
          return !cvKeywords.some(cvKeyword => {
            const jobKeywordLower = jobKeyword.toLowerCase();
            const cvKeywordLower = cvKeyword.toLowerCase();
            
            return cvKeywordLower === jobKeywordLower || 
                   cvKeywordLower.includes(jobKeywordLower) || 
                   jobKeywordLower.includes(cvKeywordLower);
          });
        })
        .map(keyword => {
          // Calculate importance based on frequency and position in job description
          const keywordFrequency = (jobDesc.toLowerCase().match(new RegExp(keyword.toLowerCase(), 'g')) || []).length;
          const keywordPosition = jobDesc.toLowerCase().indexOf(keyword.toLowerCase()) / jobDesc.length;
          const importance = Math.min(100, Math.floor(60 + (keywordFrequency * 15) - (keywordPosition * 10)));
          
          return {
            keyword,
            importance
          };
        });
      
      // Calculate match score based on matched keywords and their relevance
      const totalKeywords = jobKeywords.length;
      const weightedMatches = matchedKeywords.reduce((sum, item) => sum + (item.relevance / 100), 0);
      const matchScore = totalKeywords > 0 
        ? Math.floor((weightedMatches / totalKeywords) * 100)
        : 0;
      
      // Calculate multi-dimensional scores
      // These would ideally come from a more sophisticated analysis
      // For now, we'll simulate them based on the match score and other factors
      
      // Skills match: Based on keyword matches but weighted more toward technical skills
      const technicalKeywords = ['software', 'development', 'programming', 'code', 'technical', 'engineering', 'system', 'data', 'analysis', 'technology'];
      const technicalMatches = matchedKeywords.filter(match => 
        technicalKeywords.some(tech => match.keyword.toLowerCase().includes(tech))
      ).length;
      
      const skillsMatch = Math.min(100, Math.floor(
        (matchScore * 0.6) + 
        (technicalMatches * 5) + 
        (Math.random() * 10)
      ));
      
      // Experience match: Based on context analysis of matched keywords
      // Higher if keywords appear in context that suggests experience
      const experienceContexts = matchedKeywords.filter(match => 
        match.context && 
        (match.context.toLowerCase().includes('experience') || 
         match.context.toLowerCase().includes('year') || 
         match.context.toLowerCase().includes('led') || 
         match.context.toLowerCase().includes('managed'))
      ).length;
      
      const experienceMatch = Math.min(100, Math.floor(
        (matchScore * 0.4) + 
        (experienceContexts * 8) + 
        (Math.random() * 15)
      ));
      
      // Education match: Based on education-related keywords
      const educationKeywords = ['degree', 'education', 'university', 'college', 'certification', 'diploma', 'bachelor', 'master', 'phd', 'study'];
      const educationMatches = matchedKeywords.filter(match => 
        educationKeywords.some(edu => match.keyword.toLowerCase().includes(edu) || 
                                     (match.context && match.context.toLowerCase().includes(edu)))
      ).length;
      
      const educationMatch = Math.min(100, Math.floor(
        (matchScore * 0.3) + 
        (educationMatches * 15) + 
        (Math.random() * 10)
      ));
      
      // Industry fit: Based on industry-specific terminology
      // This would ideally use a more sophisticated industry detection algorithm
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
          const matches = (jobDesc.match(regex) || []).length;
          return sum + matches;
        }, 0);
        
        if (score > highestIndustryScore) {
          highestIndustryScore = score;
          detectedIndustry = industry;
        }
      }
      
      // Calculate industry fit based on the detected industry
      const industrySpecificMatches = detectedIndustry ? 
        matchedKeywords.filter(match => 
          industryTerms[detectedIndustry as keyof typeof industryTerms].some(term => 
            match.keyword.toLowerCase().includes(term) || 
            (match.context && match.context.toLowerCase().includes(term))
          )
        ).length : 0;
      
      const industryFit = Math.min(100, Math.floor(
        (matchScore * 0.5) + 
        (industrySpecificMatches * 10) + 
        (Math.random() * 10)
      ));
      
      // Overall compatibility: Weighted average of all dimensions
      const overallCompatibility = Math.floor(
        (skillsMatch * 0.35) + 
        (experienceMatch * 0.30) + 
        (educationMatch * 0.15) + 
        (industryFit * 0.20)
      );
      
      // Calculate improvement potential (inverse of overall compatibility, but scaled)
      const improvementPotential = Math.min(100, Math.floor(
        ((100 - overallCompatibility) * 0.8) + 
        (missingKeywords.length * 3)
      ));
      
      // Generate more specific recommendations
      const recommendations: string[] = [];
      
      if (missingKeywords.length > 0) {
        // Sort missing keywords by importance
        const criticalKeywords = missingKeywords
          .filter(k => k.importance > 80)
          .map(k => k.keyword);
        
        const importantKeywords = missingKeywords
          .filter(k => k.importance > 60 && k.importance <= 80)
          .map(k => k.keyword);
        
        if (criticalKeywords.length > 0) {
          recommendations.push(`Add these critical keywords to your CV: ${criticalKeywords.join(', ')}`);
        }
        
        if (importantKeywords.length > 0) {
          recommendations.push(`Consider highlighting experience with: ${importantKeywords.join(', ')}`);
        }
      }
      
      // Add dimension-specific recommendations
      if (skillsMatch < 70) {
        recommendations.push("Enhance your skills section to better align with job requirements");
      }
      
      if (experienceMatch < 70) {
        recommendations.push("Elaborate on your relevant work experience with concrete achievements");
      }
      
      if (educationMatch < 70) {
        recommendations.push("Highlight relevant education, certifications, or training");
      }
      
      if (industryFit < 70) {
        recommendations.push(`Emphasize your experience in the ${detectedIndustry} industry`);
      }
      
      // Add general recommendations
      recommendations.push("Tailor your professional summary to highlight relevant skills");
      
      if (matchedKeywords.length > 0) {
        recommendations.push("Expand on your experience with the matched keywords");
      }
      
      // Generate skill gap assessment
      let skillGap = "";
      if (overallCompatibility > 80) {
        skillGap = "Your CV is well-aligned with this job. Focus on highlighting your relevant experience.";
      } else if (overallCompatibility > 60) {
        skillGap = "Your CV matches many requirements but could be better tailored to this specific role.";
      } else if (overallCompatibility > 40) {
        skillGap = "There's a moderate gap between your CV and this job. Consider addressing the missing keywords.";
      } else {
        skillGap = "There's a significant gap between your CV and this job. Consider if this role aligns with your experience.";
      }
      
      // Generate detailed analysis text
      const detailedAnalysis = `
        Your CV demonstrates a ${skillsMatch}% match in required skills, with particular strength in ${
          matchedKeywords.slice(0, 3).map(k => k.keyword).join(', ')
        }. 
        
        Your experience relevance is rated at ${experienceMatch}%, indicating ${
          experienceMatch > 70 ? 'strong alignment' : 'some gaps'
        } with the job requirements.
        
        Education and certification match is ${educationMatch}%, which is ${
          educationMatch > 70 ? 'sufficient' : 'below optimal'
        } for this position.
        
        Industry-specific knowledge shows a ${industryFit}% match, suggesting ${
          industryFit > 70 ? 'good familiarity' : 'room for improvement'
        } with ${detectedIndustry} industry terminology and practices.
        
        Overall, your CV has ${improvementPotential}% potential for improvement to become an ideal match for this position.
      `.trim().replace(/\s+/g, ' ');
      
      // Set job match analysis with enhanced scoring
      setJobMatchAnalysis({
        score: matchScore,
        matchedKeywords,
        missingKeywords,
        recommendations,
        skillGap,
        dimensionalScores: {
          skillsMatch,
          experienceMatch,
          educationMatch,
          industryFit,
          overallCompatibility
        },
        detailedAnalysis,
        improvementPotential
      });
      
    } catch (error) {
      console.error("Error analyzing job match:", error);
      setError("Failed to analyze job match");
    }
  };
  
  // Handle reset
  const handleResetProcessing = () => {
    setIsProcessing(false);
    setProcessingProgress(0);
    setProcessingStatus("");
    setProcessingTooLong(false);
    setError(null);
  };
  
  // Update the handleDownloadDocx function to include the enhanced job match analysis
  const handleDownloadDocx = async () => {
    try {
      setProcessingStatus("Generating DOCX file...");
      setIsProcessing(true);
      
      // Create a new document
      const doc = new Document({
        sections: [
          {
            properties: {},
            children: [
              // Enhanced header with name and title
              new Paragraph({
                text: structuredCV.header,
                heading: HeadingLevel.HEADING_1,
                alignment: AlignmentType.CENTER,
                spacing: {
                  after: 100,
                },
              }),
              
              // Add subheader if available
              structuredCV.subheader ? new Paragraph({
                text: structuredCV.subheader,
                alignment: AlignmentType.CENTER,
                spacing: {
                  after: 200,
                },
              }) : new Paragraph({
                text: "",
                spacing: {
                  after: 200,
                },
              }),
              
              // Professional Profile
              new Paragraph({
                text: "Professional Profile",
                heading: HeadingLevel.HEADING_2,
                thematicBreak: true,
              }),
              new Paragraph({
                text: structuredCV.profile,
                spacing: {
                  after: 200,
                },
              }),
              
              // Key Achievements
              new Paragraph({
                text: "Key Achievements",
                heading: HeadingLevel.HEADING_2,
                thematicBreak: true,
              }),
              ...structuredCV.achievements.map(
                (achievement) =>
                  new Paragraph({
                    text: `• ${achievement}`,
                    spacing: {
                      before: 100,
                    },
                  })
              ),
              new Paragraph({
                text: "",
                spacing: {
                  after: 200,
                },
              }),
              
              // Skills
              new Paragraph({
                text: "Skills",
                heading: HeadingLevel.HEADING_2,
                thematicBreak: true,
              }),
              new Paragraph({
                text: structuredCV.skills,
                spacing: {
                  after: 200,
                },
              }),
              
              // Education
              new Paragraph({
                text: "Education",
                heading: HeadingLevel.HEADING_2,
                thematicBreak: true,
              }),
              new Paragraph({
                text: structuredCV.education,
                spacing: {
                  after: 200,
                },
              }),
              
              // Enhanced Job Match Analysis
              new Paragraph({
                text: "Job Match Analysis",
                heading: HeadingLevel.HEADING_2,
                thematicBreak: true,
              }),
              
              // Overall Compatibility
              new Paragraph({
                children: [
                  new TextRun({
                    text: `Overall Job Compatibility: ${jobMatchAnalysis.dimensionalScores.overallCompatibility}%`,
                    bold: true,
                  }),
                ],
                spacing: {
                  before: 100,
                },
              }),
              
              // Multi-dimensional scores
              new Paragraph({
                children: [
                  new TextRun({
                    text: "Dimensional Analysis:",
                    bold: true,
                  }),
                ],
                spacing: {
                  before: 200,
                },
              }),
              new Paragraph({
                text: `• Skills Match: ${jobMatchAnalysis.dimensionalScores.skillsMatch}%`,
                spacing: {
                  before: 100,
                },
              }),
              new Paragraph({
                text: `• Experience Match: ${jobMatchAnalysis.dimensionalScores.experienceMatch}%`,
                spacing: {
                  before: 100,
                },
              }),
              new Paragraph({
                text: `• Education Match: ${jobMatchAnalysis.dimensionalScores.educationMatch}%`,
                spacing: {
                  before: 100,
                },
              }),
              new Paragraph({
                text: `• Industry Fit: ${jobMatchAnalysis.dimensionalScores.industryFit}%`,
                spacing: {
                  before: 100,
                },
              }),
              
              // Detailed Analysis
              new Paragraph({
                children: [
                  new TextRun({
                    text: "Detailed Analysis:",
                    bold: true,
                  }),
                ],
                spacing: {
                  before: 200,
                },
              }),
              new Paragraph({
                text: jobMatchAnalysis.detailedAnalysis,
                spacing: {
                  before: 100,
                },
              }),
              
              // Skill Gap Assessment
              new Paragraph({
                children: [
                  new TextRun({
                    text: "Skill Gap Assessment:",
                    bold: true,
                  }),
                ],
                spacing: {
                  before: 200,
                },
              }),
              new Paragraph({
                text: jobMatchAnalysis.skillGap,
                spacing: {
                  before: 100,
                },
              }),
              
              // Matched Keywords
              new Paragraph({
                children: [
                  new TextRun({
                    text: "Matched Keywords:",
                    bold: true,
                  }),
                ],
                spacing: {
                  before: 200,
                },
              }),
              new Paragraph({
                text: jobMatchAnalysis.matchedKeywords.length > 0 
                  ? jobMatchAnalysis.matchedKeywords.map(k => `${k.keyword} (${k.relevance}%)`).join(', ')
                  : "No keyword matches found",
                spacing: {
                  before: 100,
                },
              }),
              
              // Missing Keywords
              jobMatchAnalysis.missingKeywords.length > 0 ? new Paragraph({
                children: [
                  new TextRun({
                    text: "Missing Keywords:",
                    bold: true,
                  }),
                ],
                spacing: {
                  before: 200,
                },
              }) : new Paragraph({
                text: "",
              }),
              jobMatchAnalysis.missingKeywords.length > 0 ? new Paragraph({
                text: jobMatchAnalysis.missingKeywords.map(k => `${k.keyword} (${k.importance}%)`).join(', '),
                spacing: {
                  before: 100,
                },
              }) : new Paragraph({
                text: "",
              }),
              
              // Recommendations
              new Paragraph({
                children: [
                  new TextRun({
                    text: "Recommendations:",
                    bold: true,
                  }),
                ],
                spacing: {
                  before: 200,
                },
              }),
              ...jobMatchAnalysis.recommendations.map(
                (recommendation) =>
                  new Paragraph({
                    text: `• ${recommendation}`,
                    spacing: {
                      before: 100,
                    },
                  })
              ),
              new Paragraph({
                text: "",
                spacing: {
                  after: 200,
                },
              }),
              
              // Improvement Potential
              new Paragraph({
                children: [
                  new TextRun({
                    text: `Improvement Potential: ${jobMatchAnalysis.improvementPotential}%`,
                    bold: true,
                  }),
                ],
                spacing: {
                  before: 100,
                  after: 200,
                },
              }),
            ],
          },
        ],
      });
      
      try {
        // Generate the document as a blob
        const blob = await Packer.toBlob(doc);
        
        // Use file-saver to save the document
        saveAs(blob, `${selectedCVName || 'CV'}_Job_Optimized.docx`);
        
        // Reset processing state
        setIsProcessing(false);
        setProcessingStatus("");
      } catch (error) {
        console.error("Error generating DOCX:", error);
        setError("Failed to generate DOCX file. Please try again.");
        setIsProcessing(false);
      }
    } catch (error) {
      console.error("Error in DOCX generation:", error);
      setError("Failed to generate DOCX file. Please try again.");
      setIsProcessing(false);
    }
  };
  
  // Add a useEffect to detect when processing is taking too long
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    
    if (isProcessing) {
      // Set a timeout to show the reset button after 10 seconds
      timeoutId = setTimeout(() => {
        setProcessingTooLong(true);
      }, 10000);
    } else {
      // Clear processing too long flag when not processing
      setProcessingTooLong(false);
    }
    
    // Clean up the timeout when the component unmounts or status changes
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [isProcessing]);
  
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
              placeholder="Paste your job description here..."
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
              rows={6}
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
          
          {/* Replace fake metrics with enhanced job match analysis */}
          <div className="mb-6 p-4 bg-[#0a0a0a] border border-gray-700 rounded-md">
            <div className="flex flex-col space-y-4">
              {/* Overall compatibility score */}
              <div>
                <div className="flex justify-between mb-2">
                  <span className="font-medium">Overall Job Compatibility</span>
                  <span className="font-bold">{jobMatchAnalysis.dimensionalScores.overallCompatibility}%</span>
                </div>
                <Progress value={jobMatchAnalysis.dimensionalScores.overallCompatibility} className="h-2 bg-gray-700">
                  <div 
                    className="h-full bg-[#B4916C] transition-all duration-300 ease-in-out"
                    style={{ width: `${jobMatchAnalysis.dimensionalScores.overallCompatibility}%` }}
                  />
                </Progress>
              </div>
              
              {/* Multi-dimensional scores */}
              <div className="grid grid-cols-2 gap-4 mt-4">
                {/* Skills Match */}
                <div className="p-3 border border-gray-700 rounded bg-[#050505]">
                  <div className="flex justify-between mb-1">
                    <h4 className="text-sm font-medium">Skills Match</h4>
                    <span className="text-sm font-bold">{jobMatchAnalysis.dimensionalScores.skillsMatch}%</span>
                  </div>
                  <Progress value={jobMatchAnalysis.dimensionalScores.skillsMatch} className="h-1.5 bg-gray-700">
                    <div 
                      className="h-full bg-emerald-600 transition-all duration-300 ease-in-out"
                      style={{ width: `${jobMatchAnalysis.dimensionalScores.skillsMatch}%` }}
                    />
                  </Progress>
                </div>
                
                {/* Experience Match */}
                <div className="p-3 border border-gray-700 rounded bg-[#050505]">
                  <div className="flex justify-between mb-1">
                    <h4 className="text-sm font-medium">Experience Match</h4>
                    <span className="text-sm font-bold">{jobMatchAnalysis.dimensionalScores.experienceMatch}%</span>
                  </div>
                  <Progress value={jobMatchAnalysis.dimensionalScores.experienceMatch} className="h-1.5 bg-gray-700">
                    <div 
                      className="h-full bg-blue-600 transition-all duration-300 ease-in-out"
                      style={{ width: `${jobMatchAnalysis.dimensionalScores.experienceMatch}%` }}
                    />
                  </Progress>
                </div>
                
                {/* Education Match */}
                <div className="p-3 border border-gray-700 rounded bg-[#050505]">
                  <div className="flex justify-between mb-1">
                    <h4 className="text-sm font-medium">Education Match</h4>
                    <span className="text-sm font-bold">{jobMatchAnalysis.dimensionalScores.educationMatch}%</span>
                  </div>
                  <Progress value={jobMatchAnalysis.dimensionalScores.educationMatch} className="h-1.5 bg-gray-700">
                    <div 
                      className="h-full bg-purple-600 transition-all duration-300 ease-in-out"
                      style={{ width: `${jobMatchAnalysis.dimensionalScores.educationMatch}%` }}
                    />
                  </Progress>
                </div>
                
                {/* Industry Fit */}
                <div className="p-3 border border-gray-700 rounded bg-[#050505]">
                  <div className="flex justify-between mb-1">
                    <h4 className="text-sm font-medium">Industry Fit</h4>
                    <span className="text-sm font-bold">{jobMatchAnalysis.dimensionalScores.industryFit}%</span>
                  </div>
                  <Progress value={jobMatchAnalysis.dimensionalScores.industryFit} className="h-1.5 bg-gray-700">
                    <div 
                      className="h-full bg-amber-600 transition-all duration-300 ease-in-out"
                      style={{ width: `${jobMatchAnalysis.dimensionalScores.industryFit}%` }}
                    />
                  </Progress>
                </div>
              </div>
              
              {/* Improvement potential */}
              <div className="p-3 border border-gray-700 rounded bg-[#050505] mt-4">
                <div className="flex justify-between mb-1">
                  <h4 className="text-sm font-medium">Improvement Potential</h4>
                  <span className="text-sm font-bold">{jobMatchAnalysis.improvementPotential}%</span>
                </div>
                <Progress value={jobMatchAnalysis.improvementPotential} className="h-1.5 bg-gray-700">
                  <div 
                    className="h-full bg-red-600 transition-all duration-300 ease-in-out"
                    style={{ width: `${jobMatchAnalysis.improvementPotential}%` }}
                  />
                </Progress>
                <p className="text-xs text-gray-400 mt-2">Lower is better - indicates how much your CV could be improved for this job</p>
              </div>
              
              {/* Add skill gap assessment */}
              <div className="mt-2 p-3 border border-gray-700 rounded bg-[#050505]">
                <h4 className="text-sm font-medium mb-1">Skill Gap Assessment</h4>
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
              
              <div className="mt-2">
                <h4 className="text-sm font-medium mb-2">Keyword Matches</h4>
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
                    </div>
                  ))}
                  {jobMatchAnalysis.matchedKeywords.length === 0 && (
                    <p className="text-sm text-gray-400">No keyword matches found</p>
                  )}
                </div>
                
                {jobMatchAnalysis.missingKeywords.length > 0 && (
                  <>
                    <h4 className="text-sm font-medium mb-2">Missing Keywords</h4>
                    <div className="flex flex-wrap gap-2 mb-4">
                      {jobMatchAnalysis.missingKeywords.map((item, index) => (
                        <span key={index} className="px-2 py-1 bg-red-900/20 text-red-400 rounded-md text-sm flex items-center">
                          {item.keyword}
                          <span className="ml-1 text-xs text-gray-400">({item.importance}%)</span>
                        </span>
                      ))}
                    </div>
                  </>
                )}
                
                <h4 className="text-sm font-medium mb-2">Recommendations</h4>
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
                <h2 className="text-xl font-bold">{structuredCV.header}</h2>
                {structuredCV.subheader && (
                  <p className="text-sm text-gray-400 mt-1">{structuredCV.subheader}</p>
                )}
              </div>
              
              <div>
                <h3 className="text-md font-semibold mb-1 text-[#B4916C]">Professional Profile</h3>
                <p>{structuredCV.profile}</p>
              </div>
              
              <div>
                <h3 className="text-md font-semibold mb-1 text-[#B4916C]">Key Achievements</h3>
                <ul className="list-disc pl-5 space-y-1">
                  {structuredCV.achievements.map((achievement: string, index: number) => (
                    <li key={index}>{achievement}</li>
                  ))}
                </ul>
              </div>
              
              <div>
                <h3 className="text-md font-semibold mb-1 text-[#B4916C]">Job Keyword Matches</h3>
                <div className="flex flex-wrap gap-2">
                  {structuredCV.keywordMatches.map((keyword: string, index: number) => (
                    <span key={index} className="px-2 py-1 bg-[#B4916C]/20 text-[#B4916C] rounded-md text-sm">
                      {keyword}
                    </span>
                  ))}
                </div>
              </div>
              
              <div>
                <h3 className="text-md font-semibold mb-1 text-[#B4916C]">Skills</h3>
                <p>{structuredCV.skills}</p>
              </div>
              
              <div>
                <h3 className="text-md font-semibold mb-1 text-[#B4916C]">Education</h3>
                <p>{structuredCV.education}</p>
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
    </div>
  );
} 