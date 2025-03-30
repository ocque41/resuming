"use client";

import React, { useState, useCallback, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, RefreshCw, Clock, Info, Download, FileText, ChevronDown } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { cacheDocument, getCachedDocument, clearCachedDocument, getCacheAge } from "@/lib/cache/documentCache";
import { toast } from "@/hooks/use-toast";

// Modern SimpleFileDropdown component
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
        className="w-full px-4 py-3.5 bg-[#111111] border border-[#222222] hover:border-[#B4916C] text-[#F9F6EE] rounded-lg flex justify-between items-center transition-colors duration-200 font-borna"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="truncate">{selectedCVName || "Select a CV"}</span>
        <ChevronDown 
          className={`h-5 w-5 text-[#B4916C] transition-transform duration-300 ${open ? 'rotate-180' : ''}`}
        />
      </button>
      
      {open && cvs.length > 0 && (
        <div className="absolute z-10 w-full mt-1 bg-[#111111] border border-[#222222] rounded-lg shadow-xl max-h-60 overflow-auto animate-fade-in">
          <ul className="py-1" role="listbox">
            {cvs.map((cv) => {
              const [name, id] = cv.split('|');
              return (
                <li 
                  key={id}
                  className="px-4 py-3 text-sm text-[#F9F6EE] hover:bg-[#1A1A1A] hover:text-[#B4916C] cursor-pointer transition-colors duration-150 font-borna"
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
        <div className="absolute z-10 w-full mt-1 bg-[#111111] border border-[#222222] rounded-lg shadow-xl animate-fade-in">
          <div className="px-4 py-3 text-sm text-[#F9F6EE]/50 font-borna">No CVs available</div>
        </div>
      )}
    </div>
  );
}

// Interface for the component props
interface EnhancedOptimizeCVCardProps {
  cvs?: string[]; // Format: "filename|id"
}

// Component implementation
export default function EnhancedOptimizeCVCard({ cvs = [] }: EnhancedOptimizeCVCardProps) {
  // State for CV selection
  const [selectedCV, setSelectedCV] = useState<string | null>(null);
  const [selectedCVId, setSelectedCVId] = useState<string | null>(null);
  const [selectedCVName, setSelectedCVName] = useState<string | null>(null);
  
  // State for processing
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isProcessed, setIsProcessed] = useState<boolean>(false);
  const [processingProgress, setProcessingProgress] = useState<number>(0);
  const [processingStatus, setProcessingStatus] = useState<string | null>("");
  const [error, setError] = useState<string | null>(null);
  
  // State for ATS scores
  const [originalAtsScore, setOriginalAtsScore] = useState<number>(0);
  const [improvedAtsScore, setImprovedAtsScore] = useState<number>(0);
  
  // State for UI views
  const [originalText, setOriginalText] = useState<string>("");
  const [optimizedText, setOptimizedText] = useState<string>("");
  const [processedText, setProcessedText] = useState<string>("");
  const [structuredCV, setStructuredCV] = useState<{
    header: string;
    profile: string;
    achievements: string[];
    goals: string[];
    skills: string;
    languages: string;
    education: string;
    experience: Array<{
      jobTitle: string;
      company: string;
      dateRange: string;
      location?: string;
      responsibilities: string[];
    }>;
    industry?: string;
  }>({
    header: "",
    profile: "",
    achievements: [],
    goals: [],
    skills: "",
    languages: "",
    education: "",
    experience: [],
    industry: ""
  });
  const [showStructuredView, setShowStructuredView] = useState<boolean>(true);
  const [improvements, setImprovements] = useState<Array<string | { improvement: string; impact?: string }>>([]);
  
  // State for DOCX download
  const [isDownloadingDocx, setIsDownloadingDocx] = useState<boolean>(false);
  
  // State for status polling
  const [statusPollingEnabled, setStatusPollingEnabled] = useState<boolean>(false);
  const [statusPollingInterval, setStatusPollingInterval] = useState<number>(1000);
  
  // State for processing too long detection
  const [processingTooLong, setProcessingTooLong] = useState<boolean>(false);
  
  // Auto-select first CV if available
  useEffect(() => {
    if (cvs.length > 0 && !selectedCVId) {
      const [name, id] = cvs[0].split('|');
      handleSelectCV(id, name);
    }
  }, [cvs]);
  
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
  
  // Handle CV selection with fetching original text
  const handleSelectCV = useCallback(async (cvId: string, cvName: string) => {
    setSelectedCVId(cvId);
    setSelectedCVName(cvName);
    setSelectedCV(`${cvName}|${cvId}`);
    console.log(`Selected CV: ${cvName} (ID: ${cvId})`);
    
    // Reset states when a new CV is selected
    setIsProcessed(false);
    setIsProcessing(false);
    setProcessingProgress(0);
    setProcessingStatus("");
    setError(null);
    
    // Fetch original text
    await fetchOriginalText(cvId);
    
    // Start polling for status
    setStatusPollingEnabled(true);
    setStatusPollingInterval(1000);
  }, [fetchOriginalText]);
  
  // Process the CV
  const processCV = useCallback(async (forceRefresh: boolean = false) => {
    if (!selectedCVId) {
      setError("Please select a CV first");
      return;
    }
    
    // Set processing state
    setIsProcessing(true);
    setIsProcessed(false);
    setProcessingProgress(0);
    setProcessingStatus("Starting optimization...");
    setError(null);
    
    try {
      console.log(`Processing CV: ${selectedCVName} (ID: ${selectedCVId}), force refresh: ${forceRefresh}`);
      
      // Start the optimization process
      const response = await fetch('/api/cv/process', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          cvId: selectedCVId,
          forceRefresh: forceRefresh
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(errorData.error || `Failed to optimize CV: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || "Optimization failed");
      }
      
      // Start polling for status
      setStatusPollingEnabled(true);
      setStatusPollingInterval(1000);
      
    } catch (error) {
      console.error("Error optimizing CV:", error);
      setError(error instanceof Error ? error.message : "An unknown error occurred during optimization");
      setIsProcessing(false);
      setProcessingProgress(0);
      setStatusPollingEnabled(false);
    }
  }, [selectedCVId, selectedCVName]);
  
  // Handle reset
  const handleResetProcessing = useCallback(async () => {
    try {
      // Reset processing state
      setProcessingStatus('selecting');
      setProcessingProgress(0);
      
      // If we have a CV ID, call the API to cancel processing
      if (selectedCVId) {
        const response = await fetch(`/api/cv/process/cancel?cvId=${selectedCVId}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          }
        });
        
        if (!response.ok) {
          throw new Error('Failed to cancel processing');
        }
      }
      
      // Clear any existing error
      setError(null);
      
      // Restart the process
      if (selectedCVId) {
        const retryResponse = await fetch(`/api/cv/process`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cvId: selectedCVId, forceRefresh: true }),
        });
        
        if (retryResponse.ok) {
          setStatusPollingEnabled(true);
          setStatusPollingInterval(1000);
        }
      }
    } catch (error) {
      console.error('Error resetting processing:', error);
      setError('Failed to reset processing. Please try again.');
    }
  }, [selectedCVId]);
  
  // Process optimized text to remove edit words and asterisks
  const processOptimizedText = (text: string) => {
    if (!text) return "";
    
    // Remove edit words and asterisks
    const editWords = ["Developed", "Achieved", "Implemented", "Created", "Managed", "Led", "Designed", "Built", "Executed", "Improved"];
    let processed = text;
    
    // Remove asterisks
    processed = processed.replace(/\*/g, "");
    
    // Remove edit words
    editWords.forEach(word => {
      const regex = new RegExp(`\\b${word}\\b`, "gi");
      processed = processed.replace(regex, "");
    });
    
    return processed;
  };
  
  // Helper function to extract keywords from text
  const extractKeywords = (text: string): string[] => {
    // Common skill/industry keywords to look for
    const commonKeywords = [
      'management', 'leadership', 'development', 'marketing', 'sales', 'finance',
      'accounting', 'human resources', 'hr', 'operations', 'project management',
      'research', 'analysis', 'data', 'software', 'engineering', 'design',
      'customer service', 'communication', 'healthcare', 'education', 'technology',
      'it', 'programming', 'web development', 'mobile', 'cloud', 'ai', 'machine learning',
      'blockchain', 'cybersecurity', 'networking', 'database', 'sql', 'python', 'java',
      'javascript', 'react', 'angular', 'vue', 'node', 'aws', 'azure', 'gcp'
    ];
    
    // Convert text to lowercase for case-insensitive matching
    const lowerText = text.toLowerCase();
    
    // Find matches
    return commonKeywords.filter(keyword => 
      lowerText.includes(keyword.toLowerCase())
    ).slice(0, 5); // Return top 5 matches
  };
  
  // Simple deterministic hash function for strings
  const hashString = (str: string): number => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
  };
  
  // Deterministic random number generator based on a seed
  const seededRandom = (seed: number, max: number, min: number = 0): number => {
    const x = Math.sin(seed) * 10000;
    const result = x - Math.floor(x); // Value between 0 and 1
    return Math.floor(result * (max - min + 1)) + min;
  };
  
  // Helper function to generate quantified achievements based on keywords
  const generateQuantifiedAchievements = (keywords: string[]): string[] => {
    const achievements: string[] = [];
    
    // Create a seed from the keywords for deterministic generation
    const keywordSeed = hashString(keywords.join(''));
    
    // Templates for achievements with placeholders for keywords and metrics
    const templates = [
      "Increased {keyword} efficiency by {percent}% through implementation of streamlined processes",
      "Reduced {keyword} costs by {percent}% while maintaining quality standards",
      "Improved {keyword} performance by {percent}% through strategic optimization initiatives",
      "Generated {amount}k in additional revenue through innovative {keyword} strategies",
      "Led a team of {number} professionals in {keyword}, resulting in {percent}% growth",
      "Successfully delivered {number} {keyword} projects under budget, saving approximately {percent}%",
      "Managed a {keyword} budget of ${amount}k, achieving {percent}% ROI",
      "Implemented new {keyword} system that increased productivity by {percent}%",
      "Spearheaded {keyword} initiative that resulted in {percent}% client satisfaction improvement",
      "Developed {keyword} strategy that expanded market reach by {percent}%"
    ];
    
    // Use available keywords or default to generic terms
    const terms = keywords.length > 0 ? keywords : ['business', 'project', 'operational', 'team', 'customer'];
    
    // Generate 5 unique achievements
    const usedTemplates = new Set<number>();
    
    for (let i = 0; i < 5 && usedTemplates.size < templates.length; i++) {
      // Select a template deterministically based on the seed and current index
      const templateSeed = keywordSeed + (i * 1000);
      let templateIndex = seededRandom(templateSeed, templates.length - 1);
      
      // If we've already used this template, try to find another one
      let attempts = 0;
      while (usedTemplates.has(templateIndex) && attempts < templates.length) {
        templateIndex = (templateIndex + 1) % templates.length;
        attempts++;
      }
      
      if (usedTemplates.has(templateIndex)) {
        continue; // Skip if we can't find an unused template
      }
      
      usedTemplates.add(templateIndex);
      
      // Select a keyword deterministically
      const keywordIndex = seededRandom(templateSeed + 1, terms.length - 1);
      const keyword = terms[keywordIndex];
      
      // Generate deterministic metrics
      const percent = seededRandom(templateSeed + 2, 30, 10); // 10-40%
      const amount = seededRandom(templateSeed + 3, 500, 100); // 100-600k
      const number = seededRandom(templateSeed + 4, 15, 5); // 5-20
      
      // Fill in the template
      let achievement = templates[templateIndex]
        .replace('{keyword}', keyword)
        .replace('{percent}', percent.toString())
        .replace('{amount}', amount.toString())
        .replace('{number}', number.toString());
      
      achievements.push(achievement);
    }
    
    return achievements;
  };
  
  // Helper function to generate quantified goals based on keywords
  const generateQuantifiedGoals = (keywords: string[]): string[] => {
    // Create a seed from the keywords for deterministic generation
    const keywordSeed = hashString(keywords.join(''));
    
    // Templates for goals with placeholders for keywords and metrics
    const templates = [
      "Seeking to leverage expertise in {keyword1} and {keyword2} to drive business growth of {percent}% within the next fiscal year",
      "Aiming to increase organizational efficiency by approximately {percent}% through implementation of best practices in {keyword1}",
      "Planning to expand professional network by connecting with {number}+ industry leaders in {keyword1} sector",
      "Targeting a {percent}% improvement in {keyword1} processes through application of {keyword2} methodologies",
      "Working toward achieving {number} professional certifications in {keyword1} to enhance expertise and value delivery",
      "Setting a goal to reduce {keyword1} operational costs by {percent}% while maintaining quality standards",
      "Striving to develop {number} innovative solutions in {keyword1} that will generate measurable business impact"
    ];
    
    const goals: string[] = [];
    const usedTemplates = new Set<number>();
    
    // Ensure we have at least 3 keywords to work with
    const workingKeywords = [...keywords];
    while (workingKeywords.length < 3) {
      const defaultKeywords = ['management', 'leadership', 'innovation', 'technology', 'communication'];
      const index = seededRandom(keywordSeed + workingKeywords.length, defaultKeywords.length - 1);
      workingKeywords.push(defaultKeywords[index]);
    }
    
    // Generate 3 unique goals
    for (let i = 0; i < 3 && usedTemplates.size < templates.length; i++) {
      // Select a template deterministically
      const templateSeed = keywordSeed + (i * 1000);
      let templateIndex = seededRandom(templateSeed, templates.length - 1);
      
      // If we've already used this template, try to find another one
      let attempts = 0;
      while (usedTemplates.has(templateIndex) && attempts < templates.length) {
        templateIndex = (templateIndex + 1) % templates.length;
        attempts++;
      }
      
      if (usedTemplates.has(templateIndex)) {
        continue; // Skip if we can't find an unused template
      }
      
      usedTemplates.add(templateIndex);
      
      // Select keywords deterministically
      const keyword1Index = seededRandom(templateSeed + 1, workingKeywords.length - 1);
      const keyword1 = workingKeywords[keyword1Index];
      
      let keyword2Index = seededRandom(templateSeed + 2, workingKeywords.length - 1);
      // Ensure we don't use the same keyword twice if possible
      if (keyword2Index === keyword1Index && workingKeywords.length > 1) {
        keyword2Index = (keyword2Index + 1) % workingKeywords.length;
      }
      const keyword2 = workingKeywords[keyword2Index];
      
      // Generate deterministic metrics
      const percent = seededRandom(templateSeed + 3, 25, 15); // 15-40%
      const number = seededRandom(templateSeed + 4, 10, 5); // 5-15
      
      // Fill in the template
      let goal = templates[templateIndex]
        .replace('{keyword1}', keyword1)
        .replace('{keyword2}', keyword2)
        .replace('{percent}', percent.toString())
        .replace('{number}', number.toString());
      
      goals.push(goal);
    }
    
    return goals;
  };
  
  // Helper function to ensure a text has quantified metrics
  const ensureQuantifiedMetrics = (text: string): string => {
    // Check if the text already has metrics (numbers, percentages)
    if (/\d+%|\$\d+|\d+ percent|\d+k|\d+ million|\d+ thousand/i.test(text)) {
      return text; // Already has metrics
    }
    
    // Create a deterministic seed from the text
    const textSeed = hashString(text);
    
    // Add metrics based on the content
    if (/increase|improve|enhance|grow|boost/i.test(text)) {
      const percent = seededRandom(textSeed, 30, 15); // 15-45%
      return text + ` by approximately ${percent}%`;
    } else if (/reduce|decrease|lower|minimize|cut/i.test(text)) {
      const percent = seededRandom(textSeed, 20, 10); // 10-30%
      return text + ` by approximately ${percent}%`;
    } else if (/manage|lead|direct|supervise/i.test(text)) {
      const number = seededRandom(textSeed, 15, 5); // 5-20
      return text + ` a team of ${number} professionals`;
    } else if (/deliver|complete|finish|accomplish/i.test(text)) {
      const number = seededRandom(textSeed, 10, 3); // 3-13
      return text + ` ${number} major projects`;
    } else if (/save|cost|budget|expense/i.test(text)) {
      const amount = seededRandom(textSeed, 200, 50); // $50-250k
      return text + ` approximately $${amount}k`;
    } else {
      // Generic metric for other types of content
      const percent = seededRandom(textSeed, 25, 15); // 15-40%
      return text + `, resulting in approximately ${percent}% improvement`;
    }
  };
  
  // Structure the CV into sections with memoization
  const structureCV = useMemo(() => {
    return (text: string) => {
      if (!text) {
        const emptyStructure = {
          header: "",
          profile: "",
          achievements: [] as string[],
          goals: [] as string[],
          skills: "",
          languages: "",
          education: "",
          experience: [] as Array<{
            jobTitle: string;
            company: string;
            dateRange: string;
            location?: string;
            responsibilities: string[];
          }>,
          industry: ""
        };
        return emptyStructure;
      }
      
      const sections = {
        header: "",
        profile: "",
        achievements: [] as string[],
        goals: [] as string[],
        skills: "",
        languages: "",
        education: "",
        experience: [] as Array<{
          jobTitle: string;
          company: string;
          dateRange: string;
          location?: string;
          responsibilities: string[];
        }>,
        industry: ""
      };
      
      const improvements: string[] = [];
      
      // Split text into lines and paragraphs
      const lines = text.split('\n').filter(line => line.trim() !== "");
      const paragraphs = text.split('\n\n').filter(para => para.trim() !== "");
      
      // Extract header (first 2-3 lines typically contain name and contact info)
      if (lines.length > 0) {
        sections.header = lines.slice(0, Math.min(3, lines.length)).join('\n');
      }
      
      // First, try to identify explicit section headers in the text
      let currentSection = "";
      let sectionContent: string[] = [];
      let experienceContent: string[] = []; // To store experience/work history content
      let educationContent: string[] = []; // To store education content
      
      // Define regex patterns for section identification
      const profilePatterns = [/^(PROFILE|SUMMARY|ABOUT ME|PROFESSIONAL SUMMARY|CAREER OBJECTIVE)/i];
      const achievementsPatterns = [/^(ACHIEVEMENTS|ACCOMPLISHMENTS|KEY ACCOMPLISHMENTS|MAJOR ACHIEVEMENTS)/i];
      const goalsPatterns = [/^(GOALS|OBJECTIVES|CAREER GOALS|PROFESSIONAL GOALS|ASPIRATIONS)/i];
      const skillsPatterns = [/^(SKILLS|TECHNICAL SKILLS|COMPETENCIES|CORE COMPETENCIES|KEY SKILLS|EXPERTISE)/i];
      const languagesPatterns = [/^(LANGUAGES|LANGUAGE PROFICIENCY|LANGUAGE SKILLS)/i];
      const educationPatterns = [/^(EDUCATION|ACADEMIC BACKGROUND|EDUCATIONAL QUALIFICATIONS|ACADEMIC QUALIFICATIONS)/i];
      const experiencePatterns = [/^(EXPERIENCE|WORK EXPERIENCE|EMPLOYMENT HISTORY|PROFESSIONAL EXPERIENCE|WORK HISTORY)/i];
      
      // Process each line to identify sections
      for (let i = 3; i < lines.length; i++) {
        const line = lines[i].trim();
        
        // Check for section headers using the defined patterns
        const isProfileSection = profilePatterns.some(pattern => pattern.test(line));
        const isAchievementsSection = achievementsPatterns.some(pattern => pattern.test(line));
        const isGoalsSection = goalsPatterns.some(pattern => pattern.test(line));
        const isSkillsSection = skillsPatterns.some(pattern => pattern.test(line));
        const isLanguagesSection = languagesPatterns.some(pattern => pattern.test(line));
        const isEducationSection = educationPatterns.some(pattern => pattern.test(line));
        const isExperienceSection = experiencePatterns.some(pattern => pattern.test(line));
        
        // Determine the current section based on the line content
        if (isProfileSection) {
          currentSection = "profile";
          sectionContent = [];
          continue;
        } else if (isAchievementsSection) {
          currentSection = "achievements";
          sectionContent = [];
          continue;
        } else if (isGoalsSection) {
          currentSection = "goals";
          sectionContent = [];
          continue;
        } else if (isSkillsSection) {
          currentSection = "skills";
          sectionContent = [];
          continue;
        } else if (isLanguagesSection) {
          currentSection = "languages";
          sectionContent = [];
          continue;
        } else if (isEducationSection) {
          currentSection = "education";
          sectionContent = [];
          continue;
        } else if (isExperienceSection) {
          currentSection = "experience";
          sectionContent = [];
          continue;
        } else if (/^[A-Z\s]{2,}:?$/i.test(line) || /^[A-Z\s]{2,}$/i.test(line)) {
          // This looks like a new section header we don't explicitly handle
          currentSection = "";
          continue;
        }
        
        // Add content to the current section
        if (currentSection) {
          if (currentSection === "achievements" || currentSection === "goals") {
            // For achievements and goals, each line is a separate item
            if (line.trim()) {
              // Check if line starts with a bullet point, if not add one
              const cleanLine = line.replace(/^[-•*]\s*/, "").trim();
              if (cleanLine) {
                if (currentSection === "achievements") {
                  sections.achievements.push(cleanLine);
                } else {
                  sections.goals.push(cleanLine);
                }
              }
            }
          } else if (currentSection === "experience") {
            // Store experience content for later processing
            experienceContent.push(line);
          } else if (currentSection === "education") {
            // Store education content
            educationContent.push(line);
          } else {
            // For other sections, accumulate text
            sectionContent.push(line);
            
            if (currentSection === "profile") {
              sections.profile = sectionContent.join(' ');
            } else if (currentSection === "skills") {
              sections.skills = sectionContent.join('\n');
            } else if (currentSection === "languages") {
              sections.languages = sectionContent.join('\n');
            }
          }
        } else if (!currentSection && i >= 3) {
          // If we haven't identified a section yet but we're past the header,
          // try to infer the section based on content
          
          // Check if this line looks like a bullet point (might be an achievement or skill)
          if (line.startsWith('•') || line.startsWith('-') || line.startsWith('*')) {
            // Look for achievement indicators (numbers, percentages, results)
            if (/\d+%|\bincreased\b|\bimproved\b|\breduced\b|\bgenerated\b|\bsaved\b|\bdelivered\b/i.test(line)) {
              const cleanLine = line.replace(/^[-•*]\s*/, "").trim();
              sections.achievements.push(cleanLine);
            } else {
              // Assume it's a skill if not clearly an achievement
              if (!sections.skills) {
                sections.skills = line;
              } else {
                sections.skills += '\n' + line;
              }
            }
          } else if (/education|university|college|degree|diploma|bachelor|master|phd|certification/i.test(line)) {
            // This line seems related to education
            if (!sections.education) {
              sections.education = line;
            } else {
              sections.education += '\n' + line;
            }
          } else if (/language|fluent|proficient|native|beginner|intermediate|advanced/i.test(line)) {
            // This line seems related to languages
            if (!sections.languages) {
              sections.languages = line;
            } else {
              sections.languages += '\n' + line;
            }
          } else {
            // Default to profile for unclassified content
            if (!sections.profile) {
              sections.profile = line;
            } else {
              sections.profile += ' ' + line;
            }
          }
        }
      }
      
      // Process and structure experience content
      if (experienceContent.length > 0) {
        // Try to parse experience entries
        sections.experience = parseExperienceEntries(experienceContent);
        
        // Extract achievements from experience section if they're empty
        if (sections.achievements.length === 0) {
          // Look for bullet points with achievement indicators
          const achievementLines = experienceContent.filter(line => {
            const trimmed = line.trim();
            return (trimmed.startsWith('•') || trimmed.startsWith('-') || trimmed.startsWith('*')) && 
                  /\d+%|\bincreased\b|\bimproved\b|\breduced\b|\bgenerated\b|\bsaved\b|\bdelivered\b|\bmanaged\b|\bled\b|\bsuccessfully\b/i.test(trimmed);
          });
          
          // Extract clean achievement text
          achievementLines.forEach(line => {
            const cleanLine = line.replace(/^[-•*]\s*/, "").trim();
            if (cleanLine && !sections.achievements.includes(cleanLine)) {
              sections.achievements.push(cleanLine);
            }
          });
          
          // If we still don't have enough achievements, generate some with metrics
          if (sections.achievements.length < 3) {
            const experienceText = experienceContent.join('\n');
            const keywords = extractKeywords(experienceText);
            const generatedAchievements = generateQuantifiedAchievements(keywords);
            
            // Add generated achievements until we have at least 3
            for (let i = 0; i < generatedAchievements.length && sections.achievements.length < 3; i++) {
              sections.achievements.push(generatedAchievements[i]);
            }
          }
          
          // Ensure all achievements have quantifiable metrics
          sections.achievements = sections.achievements.map(achievement => 
            ensureQuantifiedMetrics(achievement)
          );
          
          // Limit to top 3-5 achievements
          sections.achievements = sections.achievements.slice(0, 5);
        }
      }
      
      // If education section is empty but we have education content, use it
      if (!sections.education && educationContent.length > 0) {
        sections.education = educationContent.join('\n');
      }
      
      // Ensure all sections have content or provide improvement suggestions
      if (!sections.profile || sections.profile.length < 50) {
        if (!sections.profile) {
          sections.profile = "Professional profile information not provided.";
        }
        improvements.push("Add a comprehensive professional profile summary (100-150 words)");
      }
      
      if (sections.achievements.length === 0) {
        improvements.push("Add 3-5 quantifiable achievements with specific metrics (e.g., 'Increased sales by 20%')");
      } else if (sections.achievements.length < 3) {
        improvements.push(`Add ${3 - sections.achievements.length} more quantifiable achievements with metrics`);
      }
      
      if (sections.goals.length === 0) {
        improvements.push("Add 2-3 clear career goals with specific objectives");
      } else if (sections.goals.length < 2) {
        improvements.push(`Add ${2 - sections.goals.length} more career goals with specific objectives`);
      }
      
      if (!sections.skills) {
        sections.skills = "Skills information not provided.";
        improvements.push("Add relevant technical and soft skills for your target position");
      }
      
      // Update state with the structured CV and improvements
      setImprovements(improvements);
      
      // Try to detect industry from content
      const industries = {
        'Technology': /\b(software|developer|web|app|programming|java|python|javascript|react|angular|node|full[-\s]?stack|front[-\s]?end|back[-\s]?end|devops|cloud|aws|azure|it)\b/i,
        'Finance': /\b(finance|accounting|financial|investment|banking|loans|mortgage|audit|tax|budget|equity|portfolio|compliance|risk)\b/i,
        'Healthcare': /\b(health|medical|healthcare|patient|doctor|physician|nurse|hospital|clinic|therapy|pharmaceutical|dental|medicine)\b/i,
        'Marketing': /\b(marketing|digital|seo|sem|content|social media|campaign|brand|advertising|market research|analytics|engagement)\b/i,
        'Sales': /\b(sales|customer|account manager|business development|revenue|pipeline|client|leads|prospects|closing|negotiation|territory)\b/i,
        'Education': /\b(teaching|teacher|professor|instructor|curriculum|education|university|college|academic|faculty|student|course|classroom|learning)\b/i,
        'Engineering': /\b(engineering|engineer|mechanical|electrical|civil|chemical|industrial|product|design|manufacturing|CAD|technical|specifications)\b/i,
        'Human Resources': /\b(HR|human resources|recruitment|talent acquisition|hiring|onboarding|employee relations|benefits|compensation|training|development|retention)\b/i,
        'Legal': /\b(legal|lawyer|attorney|law|counsel|litigation|corporate|contract|compliance|regulatory|paralegal|judicial|legislation)\b/i
      };
      
      // Determine the industry with the most matches
      let maxMatches = 0;
      const fullText = text.toLowerCase();
      for (const [industry, pattern] of Object.entries(industries)) {
        const matches = (fullText.match(pattern) || []).length;
        if (matches > maxMatches) {
          maxMatches = matches;
          sections.industry = industry;
        }
      }
      
      // Default to 'General' if no strong match
      if (maxMatches === 0) {
        sections.industry = 'General';
      }
      
      return sections;
    };
  }, []);
  
  /**
   * Parse experience content into structured entries
   */
  const parseExperienceEntries = (experienceLines: string[]) => {
    const entries: Array<{
      jobTitle: string;
      company: string;
      dateRange: string;
      location?: string;
      responsibilities: string[];
    }> = [];
    
    // Group the lines into potential job blocks
    let currentLines: string[] = [];
    let blocks: string[][] = [];
    
    // Split by empty lines or potential job title lines (short lines that might be job titles)
    for (let i = 0; i < experienceLines.length; i++) {
      const line = experienceLines[i].trim();
      
      // Check if this line might be a new job entry start
      const isPotentialJobTitle = line.length > 0 && 
                                 line.length < 60 && 
                                 !line.startsWith('•') && 
                                 !line.startsWith('-') && 
                                 !line.startsWith('*') &&
                                 !/^\s*\d+\./.test(line);
      
      const containsYear = /\b(19|20)\d{2}\b/.test(line);
      
      // If the line is empty or looks like a job title or contains a year, it might be a new block
      if (line.length === 0 || (isPotentialJobTitle && (containsYear || currentLines.length === 0))) {
        if (currentLines.length > 0) {
          blocks.push([...currentLines]);
          currentLines = [];
        }
        
        if (line.length > 0) {
          currentLines.push(line);
        }
      } else {
        currentLines.push(line);
      }
    }
    
    // Add the last block if there's anything
    if (currentLines.length > 0) {
      blocks.push([...currentLines]);
    }
    
    // Process each block to extract job details
    for (const block of blocks) {
      if (block.length === 0) continue;
      
      const entry = {
        jobTitle: '',
        company: '',
        dateRange: '',
        location: '',
        responsibilities: [] as string[]
      };
      
      // Try to identify job title, company, and date
      let headerLinesProcessed = 0;
      for (let i = 0; i < Math.min(5, block.length); i++) {
        const line = block[i];
        
        // Check for date range (years like 2015-2020 or Jan 2015 - Dec 2020)
        if (/\b(19|20)\d{2}\b.*?(?:\b(19|20)\d{2}\b|present|current|now\b)/i.test(line)) {
          entry.dateRange = line;
          headerLinesProcessed++;
          continue;
        }
        
        // Check for company name (often has LLC, Inc, Ltd, GmbH, etc.)
        if (/\b(LLC|Inc|Ltd|Limited|GmbH|Corp|Corporation|Group|Company)\b/i.test(line)) {
          entry.company = line;
          headerLinesProcessed++;
          continue;
        }
        
        // Check for location (City, State or City, Country format)
        if (/\b([A-Z][a-z]+(\s[A-Z][a-z]+)*,\s*[A-Z]{2}|[A-Z][a-z]+(\s[A-Z][a-z]+)*,\s*[A-Z][a-z]+)\b/.test(line)) {
          entry.location = line;
          headerLinesProcessed++;
          continue;
        }
        
        // If we haven't assigned the job title yet and this line is short, it's likely the job title
        if (!entry.jobTitle && line.length < 60) {
          entry.jobTitle = line;
          headerLinesProcessed++;
          continue;
        }
        
        // If we haven't assigned the company yet and this line is short, it might be the company
        if (!entry.company && line.length < 60) {
          entry.company = line;
          headerLinesProcessed++;
          continue;
        }
        
        // If this is a bullet point, it's part of responsibilities
        if (line.startsWith('-') || line.startsWith('•') || line.startsWith('*')) {
          entry.responsibilities.push(line.substring(1).trim());
          continue;
        }
        
        // If none of the above, it might be just a plain responsibility line
        entry.responsibilities.push(line);
      }
      
      // Process remaining lines as responsibilities
      for (let i = Math.min(5, block.length); i < block.length; i++) {
        const line = block[i].trim();
        if (line.length === 0) continue;
        
        if (line.startsWith('-') || line.startsWith('•') || line.startsWith('*')) {
          entry.responsibilities.push(line.substring(1).trim());
        } else {
          entry.responsibilities.push(line);
        }
      }
      
      // Only add entries that have at least a job title or company
      if (entry.jobTitle || entry.company) {
        entries.push(entry);
      }
    }
    
    return entries;
  };
  
  // Process optimized text when it changes
  useEffect(() => {
    if (optimizedText) {
      const processed = processOptimizedText(optimizedText);
      setProcessedText(processed);
      
      // Use a small timeout to debounce the structuring operation
      // This prevents multiple rapid updates that could cause UI flickering
      const timeoutId = setTimeout(() => {
        const structured = structureCV(processed);
        setStructuredCV(structured);
      }, 100);
      
      return () => clearTimeout(timeoutId);
    }
  }, [optimizedText, structureCV]);
  
  // Format structured CV as text
  const formatStructuredCV = () => {
    if (!structuredCV) return "";
    
    let formattedText = "";
    
    // Follow the exact order: Header, Profile, Experience, Achievements, Goals, Skills, Languages, Education
    
    // Header
    if (structuredCV.header) {
      formattedText += structuredCV.header + "\n\n";
    }
    
    // Profile
    if (structuredCV.profile) {
      formattedText += "PROFILE\n" + structuredCV.profile + "\n\n";
    }
    
    // Experience
    if (structuredCV.experience && structuredCV.experience.length > 0) {
      formattedText += "EXPERIENCE\n";
      
      structuredCV.experience.forEach(exp => {
        // Format job title and company
        if (exp.jobTitle) {
          formattedText += exp.jobTitle + "\n";
        }
        
        if (exp.company) {
          formattedText += exp.company + "\n";
        }
        
        // Format date range and location
        if (exp.dateRange) {
          formattedText += exp.dateRange + "\n";
        }
        
        if (exp.location) {
          formattedText += exp.location + "\n";
        }
        
        // Format responsibilities
        if (exp.responsibilities && exp.responsibilities.length > 0) {
          exp.responsibilities.forEach(responsibility => {
            formattedText += "• " + responsibility + "\n";
          });
        }
        
        formattedText += "\n";
      });
    }
    
    // Achievements
    if (structuredCV.achievements.length > 0) {
      formattedText += "ACHIEVEMENTS\n";
      structuredCV.achievements.forEach(achievement => {
        formattedText += "• " + achievement + "\n";
      });
      formattedText += "\n";
    }
    
    // Goals
    if (structuredCV.goals.length > 0) {
      formattedText += "GOALS\n";
      structuredCV.goals.forEach(goal => {
        formattedText += "• " + goal + "\n";
      });
      formattedText += "\n";
    }
    
    // Skills
    if (structuredCV.skills) {
      formattedText += "SKILLS\n";
      // Check if skills are already in bullet point format
      const skillLines = structuredCV.skills.split('\n');
      skillLines.forEach(skill => {
        if (skill.trim().startsWith('•') || skill.trim().startsWith('-') || skill.trim().startsWith('*')) {
          formattedText += skill + "\n";
        } else {
          formattedText += "• " + skill + "\n";
        }
      });
      formattedText += "\n";
    }
    
    // Languages
    if (structuredCV.languages) {
      formattedText += "LANGUAGES\n";
      // Check if languages are already in bullet point format
      const languageLines = structuredCV.languages.split('\n');
      languageLines.forEach(language => {
        if (language.trim().startsWith('•') || language.trim().startsWith('-') || language.trim().startsWith('*')) {
          formattedText += language + "\n";
        } else {
          formattedText += "• " + language + "\n";
        }
      });
      formattedText += "\n";
    }
    
    // Education
    if (structuredCV.education) {
      formattedText += "EDUCATION\n";
      // Check if education entries are already in bullet point format
      const educationLines = structuredCV.education.split('\n');
      educationLines.forEach(education => {
        if (education.trim().startsWith('•') || education.trim().startsWith('-') || education.trim().startsWith('*')) {
          formattedText += education + "\n";
        } else {
          formattedText += "• " + education + "\n";
        }
      });
    }
    
    return formattedText;
  };
  
  // Polling mechanism for process status
  useEffect(() => {
    let timeoutId: NodeJS.Timeout | null = null;
    
    const checkStatus = async () => {
      if (!statusPollingEnabled || !selectedCVId) return;
      
      try {
        const response = await fetch(`/api/cv/process/status?cvId=${selectedCVId}`);
        
        if (response.ok) {
          const data = await response.json();
          
          if (data.processing) {
            // Still processing
            setIsProcessing(true);
            setProcessingStatus(data.step || "Processing...");
            setProcessingProgress(data.progress || 0);
        
        // Check if processing is stuck
            if (data.isStuck) {
              console.warn(`Processing appears stuck at ${data.progress}% for ${data.stuckMinutes} minutes`);
              
              // If stuck for more than 3 minutes, show error and offer retry
              if (data.stuckMinutes > 3) {
                setError(`Processing appears stuck at ${data.progress}%. You can wait or try again.`);
              }
            } else {
              // Clear error if processing is moving again
              setError(null);
            }
            
            // Continue polling, but back off if progress is slow
            const newInterval = data.progress > 80 ? 1000 :
                               data.progress > 60 ? 2000 :
                               data.progress > 40 ? 3000 : 2000;
            
            setStatusPollingInterval(newInterval);
            timeoutId = setTimeout(checkStatus, newInterval);
          } else if (data.isComplete) {
            // Processing completed
          setIsProcessing(false);
            setIsProcessed(true);
            setProcessingStatus("Processing completed");
            setProcessingProgress(100);
            setStatusPollingEnabled(false);
            
            // Update state with optimization results
          if (data.optimizedText) {
            setOptimizedText(data.optimizedText);
              // Process the optimized text
              setProcessedText(processOptimizedText(data.optimizedText));
          }
          
          if (data.improvements) {
            setImprovements(data.improvements);
          }
          
            if (data.atsScore) {
              setOriginalAtsScore(data.atsScore);
            }
            
            if (data.improvedAtsScore) {
              setImprovedAtsScore(data.improvedAtsScore);
            }
          } else if (data.error) {
            // Processing encountered an error
            setIsProcessing(false);
            setError(`Processing error: ${data.error}`);
            setStatusPollingEnabled(false);
      } else {
            // Not processing or idle
            setIsProcessing(false);
            setProcessingStatus("");
            setProcessingProgress(0);
            
            // Stop polling if nothing is happening
            if (!data.processing && !data.isComplete) {
              setStatusPollingEnabled(false);
            }
          }
        } else {
          // Stop polling on error
          setStatusPollingEnabled(false);
          setError("Error checking processing status");
        }
      } catch (err) {
        console.error("Error checking CV processing status:", err);
        setStatusPollingEnabled(false);
      }
    };
    
    if (statusPollingEnabled) {
      timeoutId = setTimeout(checkStatus, statusPollingInterval);
    }
    
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [statusPollingEnabled, statusPollingInterval, selectedCVId, processOptimizedText]);
  
  // Add a useEffect to detect when processing is taking too long
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    
    if (isProcessing && processingStatus) {
      // Set a timeout to show the reset button after 30 seconds
      timeoutId = setTimeout(() => {
        setProcessingTooLong(true);
      }, 30000); // 30 seconds
    } else {
      // Clear processing too long flag when not processing
      setProcessingTooLong(false);
    }
    
    // Clean up the timeout when the component unmounts or status changes
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [isProcessing, processingStatus]);
  
  // Handle DOCX download
  const handleDownloadDocx = async () => {
    if (!selectedCVId) {
      toast({
        title: "No CV selected",
        description: "Please select a CV to download",
        variant: "destructive",
      });
      return;
    }

    if (!processedText && !optimizedText) {
      toast({
        title: "No optimized content",
        description: "Please optimize your CV first",
        variant: "destructive",
      });
      return;
    }

    setIsDownloadingDocx(true);

    try {
      // Always use the formatted structured CV for the DOCX to ensure proper formatting
      const textToUse = formatStructuredCV();
      
      if (!textToUse) {
        toast({
          title: "Error preparing document",
          description: "Could not format CV content properly",
          variant: "destructive",
        });
        setIsDownloadingDocx(false);
        return;
      }
      
      // Prepare metadata to include in the document generation
      const metadata = {
        atsScore: originalAtsScore,
        improvedAtsScore: improvedAtsScore,
        improvements: improvements,
        experienceEntries: structuredCV.experience,
        industry: structuredCV.industry || ''
      };
      
      const response = await fetch("/api/cv/generate-docx", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          cvId: selectedCVId,
          optimizedText: textToUse,
          metadata: metadata
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate DOCX file');
      }
      
      const data = await response.json();
      
      if (!data.success || !data.docxBase64) {
        throw new Error('Failed to generate DOCX file');
      }
      
      // Create a download link for the DOCX file
      const linkSource = `data:application/vnd.openxmlformats-officedocument.wordprocessingml.document;base64,${data.docxBase64}`;
      const downloadLink = document.createElement('a');
      downloadLink.href = linkSource;
      
      // Use a more professional filename format
      const timestamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0];
      const cleanCVName = selectedCVName?.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9]/g, '_') || 'optimized';
      downloadLink.download = `${cleanCVName}_CV_${timestamp}.docx`;
      
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
      
      toast({
        title: "DOCX file downloaded",
        description: "Your optimized CV has been downloaded as a DOCX file",
        variant: "default",
      });
      
      console.log('DOCX file downloaded successfully');
    } catch (error) {
      console.error('Error downloading DOCX:', error);
      toast({
        title: "Download failed",
        description: error instanceof Error ? error.message : 'An unknown error occurred',
        variant: "destructive",
      });
    } finally {
      setIsDownloadingDocx(false);
    }
  };

  return (
    <Card className="w-full border border-[#222222] bg-[#111111] rounded-xl shadow-md overflow-hidden">
      <CardHeader className="bg-[#0D0D0D] border-b border-[#222222] px-5 py-4">
        <CardTitle className="text-xl font-safiro text-[#F9F6EE] flex items-center gap-2">
          <FileText className="w-5 h-5 text-[#B4916C]" />
          <span>Optimize Your CV</span>
        </CardTitle>
        <CardDescription className="text-[#F9F6EE]/60 font-borna mt-1">
          Enhance your CV for better ATS compatibility and readability
        </CardDescription>
      </CardHeader>
      
      <CardContent className="p-5">
        {/* CV Selection */}
        <div className="mb-6">
          <div className="mb-3 text-[#F9F6EE]/70 text-sm font-borna">Select a CV to optimize</div>
          <ModernFileDropdown 
            cvs={cvs} 
            onSelect={handleSelectCV} 
            selectedCVName={selectedCVName}
          />
        </div>
        
        {/* Error Display */}
        {error && (
          <Alert className="mb-5 bg-[#1a0505] border border-[#3d1a1a] text-[#f5c2c2] rounded-lg">
            <AlertCircle className="h-4 w-4 mr-2 text-red-400" />
            <AlertDescription className="font-borna">
              {error}
              <Button 
                variant="outline" 
                size="sm" 
                className="mt-3 bg-[#2a0808] hover:bg-[#3a0a0a] border-[#4d1a1a] text-[#f5c2c2] font-borna transition-colors duration-200" 
                onClick={() => processCV(true)}
              >
                Retry
              </Button>
            </AlertDescription>
          </Alert>
        )}
        
        {/* Processing Indicator */}
        {isProcessing && (
          <div className="mb-6 p-5 rounded-xl bg-[#0D0D0D] border border-[#222222] shadow-md animate-fade-in-up">
            <div className="flex flex-col">
              <div className="flex items-center mb-3">
                <RefreshCw className="h-5 w-5 mr-3 text-[#B4916C] animate-spin" />
                <div>
                  <h3 className="text-[#F9F6EE] font-safiro">{processingStatus || "Optimizing your CV..."}</h3>
                  <p className="text-[#F9F6EE]/60 text-sm font-borna mt-1">This may take a minute as our AI enhances your document</p>
                </div>
              </div>
              
              <div className="mb-4">
                <div className="relative w-full h-1.5 bg-[#222222] rounded-full overflow-hidden">
                  <div
                    className="absolute top-0 left-0 h-full bg-[#B4916C] transition-all duration-300 ease-in-out"
                    style={{ width: `${processingProgress}%` }}
                  />
                </div>
                <div className="flex justify-between mt-2">
                  <span className="text-xs text-[#F9F6EE]/50 font-borna">{processingProgress}% complete</span>
                  
                  {processingTooLong && (
                    <button
                      onClick={() => processCV(true)}
                      className="px-3 py-1.5 bg-[#1a1a1a] hover:bg-[#222222] text-[#B4916C] border border-[#333333] rounded-md flex items-center text-xs transition-colors duration-200 font-borna"
                    >
                      <RefreshCw className="w-3 h-3 mr-1.5" />
                      Taking too long? Reset
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* Start Optimization Button */}
        {!isProcessing && !isProcessed && selectedCVId && (
          <div className="mb-6">
            <Button
              onClick={() => processCV(false)}
              disabled={isProcessing || !selectedCVId}
              className="w-full bg-[#B4916C] hover:bg-[#A27D59] text-[#050505] font-safiro py-3 h-12 rounded-lg transition-colors duration-200"
            >
              Start Optimization
            </Button>
            <p className="text-[#F9F6EE]/50 text-sm mt-3 font-borna text-center">
              Our AI will optimize your CV to improve ATS compatibility and readability
            </p>
          </div>
        )}
        
        {/* Results Section */}
        {isProcessed && (
          <div className="animate-fade-in-up">
            {/* Score Comparison */}
            <div className="mb-6 grid grid-cols-1 gap-4">
              <div className="p-5 rounded-xl bg-[#0D0D0D] border border-[#222222] shadow-md">
                <h3 className="text-[#F9F6EE] font-safiro mb-2">ATS Score</h3>
                <div className="flex items-center">
                  <span className="text-3xl font-bold font-safiro" style={{ 
                    color: originalAtsScore > 80 
                      ? '#4ade80' 
                      : originalAtsScore > 60 
                        ? '#facc15' 
                        : '#f87171'
                  }}>
                    {originalAtsScore}%
                  </span>
                </div>
              </div>
            </div>

            {/* CV Content */}
            <div className="mb-6 rounded-xl bg-[#0D0D0D] border border-[#222222] shadow-md overflow-hidden">
              <div className="p-5">
                <h3 className="text-[#F9F6EE] font-safiro mb-4 flex items-center">
                  <FileText className="text-[#B4916C] w-5 h-5 mr-2" />
                  Optimization Results
                </h3>
                
                {/* View Toggle */}
                <div className="flex items-center justify-end mb-5">
                  <div className="flex items-center bg-[#111111] rounded-lg p-1">
                    <button
                      onClick={() => setShowStructuredView(false)}
                      className={`px-3 py-1.5 text-sm rounded-lg transition-colors duration-200 font-borna ${
                        !showStructuredView 
                          ? 'bg-[#B4916C] text-[#050505]' 
                          : 'bg-transparent text-[#F9F6EE]/60 hover:text-[#F9F6EE]'
                      }`}
                    >
                      Raw Text
                    </button>
                    <button
                      onClick={() => setShowStructuredView(true)}
                      className={`px-3 py-1.5 text-sm rounded-lg transition-colors duration-200 font-borna ${
                        showStructuredView 
                          ? 'bg-[#B4916C] text-[#050505]' 
                          : 'bg-transparent text-[#F9F6EE]/60 hover:text-[#F9F6EE]'
                      }`}
                    >
                      Structured View
                    </button>
                  </div>
                </div>
                
                {/* Content Display */}
                <div className="mb-5">
                  {showStructuredView ? (
                    <div className="bg-[#111111] p-5 rounded-lg">
                      {/* Header */}
                      {structuredCV.header && (
                        <div className="mb-6 text-center border-b border-[#222222] pb-4">
                          <div className="text-[#F9F6EE] font-safiro text-xl">{structuredCV.header.split('\n')[0]}</div>
                          {structuredCV.header.split('\n').length > 1 && (
                            <div className="text-[#F9F6EE]/60 text-sm mt-1 font-borna">
                              {structuredCV.header.split('\n').slice(1).join(' | ')}
                            </div>
                          )}
                        </div>
                      )}
                      
                      {/* Profile */}
                      {structuredCV.profile && (
                        <div className="mb-6">
                          <h6 className="text-[#B4916C] font-safiro mb-3 uppercase tracking-wider text-sm">Profile</h6>
                          <div className="text-[#F9F6EE]/80 text-sm leading-relaxed font-borna">
                            {structuredCV.profile}
                          </div>
                        </div>
                      )}
                      
                      {/* Experience */}
                      {structuredCV.experience && structuredCV.experience.length > 0 && (
                        <div className="mb-6">
                          <h6 className="text-[#B4916C] font-safiro mb-3 uppercase tracking-wider text-sm">Experience</h6>
                          <div className="text-[#F9F6EE]/80 text-sm font-borna">
                            {structuredCV.experience.map((exp, index) => (
                              <div key={index} className="mb-4">
                                {exp.jobTitle && (
                                  <span className="text-[#B4916C] font-safiro">{exp.jobTitle}</span>
                                )}
                                {exp.company && (
                                  <span className="text-[#F9F6EE]/60"> at {exp.company}</span>
                                )}
                                {exp.dateRange && (
                                  <span className="text-[#F9F6EE]/60"> ({exp.dateRange})</span>
                                )}
                                {exp.location && (
                                  <span className="text-[#F9F6EE]/60"> in {exp.location}</span>
                                )}
                                {exp.responsibilities && exp.responsibilities.length > 0 && (
                                  <ul className="list-disc pl-5 space-y-1.5 text-[#F9F6EE]/70 text-sm mt-2">
                                    {exp.responsibilities.map((responsibility, responsibilityIndex) => (
                                      <li key={responsibilityIndex}>{responsibility}</li>
                                    ))}
                                  </ul>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {/* Achievements */}
                      {structuredCV.achievements.length > 0 && (
                        <div className="mb-6 bg-[#0A0A0A] p-4 rounded-lg border-l-2 border-[#B4916C]">
                          <h6 className="text-[#B4916C] font-safiro mb-3 uppercase tracking-wider text-sm">Achievements</h6>
                          <ul className="space-y-3">
                            {structuredCV.achievements.map((achievement, index) => (
                              <li key={index} className="flex items-start">
                                <span className="text-[#B4916C] mr-2 mt-1">•</span>
                                <span className="text-[#F9F6EE]/80 text-sm font-borna">{achievement}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      
                      {/* Goals */}
                      {structuredCV.goals.length > 0 && (
                        <div className="mb-6 bg-[#0A0A0A] p-4 rounded-lg border-l-2 border-[#B4916C]">
                          <h6 className="text-[#B4916C] font-safiro mb-3 uppercase tracking-wider text-sm">Goals</h6>
                          <ul className="space-y-3">
                            {structuredCV.goals.map((goal, index) => (
                              <li key={index} className="flex items-start">
                                <span className="text-[#B4916C] mr-2 mt-1">•</span>
                                <span className="text-[#F9F6EE]/80 text-sm font-borna">{goal}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      
                      {/* Skills */}
                      {structuredCV.skills && (
                        <div className="mb-6">
                          <h6 className="text-[#B4916C] font-safiro mb-3 uppercase tracking-wider text-sm">Skills</h6>
                          <div className="text-[#F9F6EE]/80 text-sm font-borna">
                            {structuredCV.skills.split('\n').map((skill, index) => (
                              <div key={index} className="mb-1.5">
                                {skill.startsWith('•') || skill.startsWith('-') || skill.startsWith('*') ? (
                                  <div className="flex items-start">
                                    <span className="text-[#B4916C] mr-2">•</span>
                                    <span>{skill.replace(/^[-•*]\s*/, '')}</span>
                                  </div>
                                ) : (
                                  <span>{skill}</span>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {/* Languages */}
                      {structuredCV.languages && (
                        <div className="mb-6">
                          <h6 className="text-[#B4916C] font-safiro mb-3 uppercase tracking-wider text-sm">Languages</h6>
                          <div className="text-[#F9F6EE]/80 text-sm font-borna">
                            {structuredCV.languages.split('\n').map((language, index) => (
                              <div key={index} className="mb-1.5">
                                {language.startsWith('•') || language.startsWith('-') || language.startsWith('*') ? (
                                  <div className="flex items-start">
                                    <span className="text-[#B4916C] mr-2">•</span>
                                    <span>{language.replace(/^[-•*]\s*/, '')}</span>
                                  </div>
                                ) : (
                                  <span>{language}</span>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {/* Education */}
                      {structuredCV.education && (
                        <div className="mb-2">
                          <h6 className="text-[#B4916C] font-safiro mb-3 uppercase tracking-wider text-sm">Education</h6>
                          <div className="text-[#F9F6EE]/80 text-sm font-borna">
                            {structuredCV.education.split('\n').map((education, index) => (
                              <div key={index} className="mb-1.5">
                                {education.startsWith('•') || education.startsWith('-') || education.startsWith('*') ? (
                                  <div className="flex items-start">
                                    <span className="text-[#B4916C] mr-2">•</span>
                                    <span>{education.replace(/^[-•*]\s*/, '')}</span>
                                  </div>
                                ) : (
                                  <span>{education}</span>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {/* Improvement Suggestions */}
                      {improvements.length > 0 && (
                        <div className="mt-6 border-t border-[#222222] pt-4">
                          <h6 className="text-[#F9F6EE] font-safiro mb-3">Suggested Improvements</h6>
                          <ul className="list-disc pl-5 space-y-2 text-[#F9F6EE]/70 text-sm font-borna">
                            {improvements.map((improvement, index) => (
                              <li key={index}>
                                {typeof improvement === 'object' && improvement !== null 
                                  ? (improvement.improvement || 'Improvement needed') + 
                                    (improvement.impact ? ` - Impact: ${improvement.impact}` : '')
                                  : improvement}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="bg-[#111111] p-5 rounded-lg">
                      <h5 className="text-[#F9F6EE] font-safiro mb-3">Optimized Content</h5>
                      <div className="text-[#F9F6EE]/80 whitespace-pre-wrap text-sm max-h-96 overflow-y-auto p-4 bg-[#0A0A0A] rounded-lg border border-[#222222] font-borna">
                        {formatStructuredCV() || processedText || optimizedText || "No optimized content available yet."}
                      </div>
                    </div>
                  )}
                </div>
                
                {/* Download DOCX Button */}
                <Button
                  onClick={handleDownloadDocx}
                  disabled={isDownloadingDocx || !optimizedText}
                  className="w-full bg-[#111111] hover:bg-[#1A1A1A] text-[#F9F6EE] border border-[#222222] mb-4 h-12 font-safiro transition-colors duration-200"
                >
                  {isDownloadingDocx ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Generating DOCX...
                    </>
                  ) : (
                    <>
                      <Download className="h-4 w-4 mr-2" />
                      Download as DOCX
                    </>
                  )}
                </Button>
                
                <Button
                  onClick={handleResetProcessing}
                  className="w-full bg-transparent hover:bg-[#111111] text-[#F9F6EE]/60 hover:text-[#F9F6EE] border border-[#222222] h-10 font-borna transition-colors duration-200 text-sm"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Start Over
                </Button>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
} 