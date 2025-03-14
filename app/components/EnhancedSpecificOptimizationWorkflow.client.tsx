/* use client */
'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, BorderStyle, Table, TableRow, TableCell, WidthType, Header, Footer } from 'docx';
import { saveAs } from 'file-saver';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertCircle, RefreshCw, Clock, Info, Download, FileText, CheckCircle } from "lucide-react";
import { analyzeCVContent, optimizeCVForJob } from '@/lib/services/mistral.service';

// Type definitions
interface KeywordMatch {
  keyword: string;
  relevance: number;
  frequency: number;
  placement: string;
}

interface MissingKeyword {
  keyword: string;
  importance: number;
  suggestedPlacement: string;
}

interface ExperienceEntry {
  title?: string;
  startDate?: string;
  endDate?: string;
}

interface EducationEntry {
  degree: string;
  institution?: string;
  location?: string;
  year?: string;
  gpa?: string;
  achievements?: string[];
  relevantCourses?: string[];
}

interface SkillsData {
  technical: string[];
  professional: string[];
}

interface StructuredCV {
  name: string;
  subheader: string;
  profile: string;
  experience: ExperienceEntry[];
  education: EducationEntry[];
  skills: {
    technical: string[];
    professional: string[];
  };
  achievements: string[];
  goals: string[];
  languages: string[];
  contactInfo: {
    email?: string;
    phone?: string;
    location?: string;
    linkedin?: string;
    website?: string;
  };
}

interface JobMatchAnalysis {
  score: number;
  matchedKeywords: KeywordMatch[];
  missingKeywords: MissingKeyword[];
  recommendations: string[];
  skillGap: string;
  dimensionalScores: {
    skillsMatch: number;
    experienceMatch: number;
    educationMatch: number;
    industryFit: number;
    overallCompatibility: number;
    keywordDensity: number;
    formatCompatibility: number;
    contentRelevance: number;
  };
  detailedAnalysis: string;
  improvementPotential: number;
  sectionAnalysis: {
    profile: { score: number; feedback: string };
    skills: { score: number; feedback: string };
    experience: { score: number; feedback: string };
    education: { score: number; feedback: string };
    achievements: { score: number; feedback: string };
  };
}

interface EnhancedSpecificOptimizationWorkflowProps {
  cvs: {
    id: string;
    name: string;
  }[];
}

// Utility functions
const extractKeywords = (text: string, isJobDescription: boolean = false): string[] => {
  const commonWords = new Set([
    'the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'i', 'it', 'for', 'not', 'on', 'with', 'he', 'as', 'you',
    'do', 'at', 'this', 'but', 'his', 'by', 'from', 'they', 'we', 'say', 'her', 'she', 'or', 'an', 'will', 'my', 'one',
    'all', 'would', 'there', 'their', 'what', 'so', 'up', 'out', 'if', 'about', 'who', 'get', 'which', 'go', 'me'
  ]);

  // Split text into words and clean them
  const words = text.toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => 
      word.length > 2 && 
      !commonWords.has(word) &&
      !/^\d+$/.test(word)
    );

  // Count word frequency
  const wordFrequency = new Map<string, number>();
  words.forEach(word => {
    wordFrequency.set(word, (wordFrequency.get(word) || 0) + 1);
  });

  // Sort by frequency and get unique words
  const sortedWords = Array.from(wordFrequency.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([word]) => word);

  // For job descriptions, focus on requirement-related words
  if (isJobDescription) {
    const requirementIndicators = [
      'required', 'must', 'should', 'need', 'essential', 'necessary',
      'qualification', 'experience', 'skill', 'proficiency', 'knowledge'
    ];

    const requirements = sortedWords.filter(word =>
      requirementIndicators.some(indicator => text.toLowerCase().includes(`${indicator} ${word}`))
    );

    return [...new Set([...requirements, ...sortedWords])];
  }

  return [...new Set(sortedWords)];
};

const extractExperienceData = (text: string): ExperienceEntry[] => {
  const experiencePattern = /(?:experience|work history|employment)[:\s]+(.*?)(?=\n\s*\n|\n(?:[A-Z][a-z]+\s*(?:&\s*)?)+:|\n\s*$)/is;
  const match = text.match(experiencePattern);
  
  if (!match || !match[1]) return [];
  
  const experienceSection = match[1];
  const entries = experienceSection.split(/\n(?=\d{4}|\d{2}\/\d{2}|\w+\s+\d{4})/);
  
  return entries.map(entry => {
    const datePattern = /(\d{4}|\d{2}\/\d{2}|\w+\s+\d{4})\s*[-–—]\s*(\d{4}|\d{2}\/\d{2}|\w+\s+\d{4}|present)/i;
    const titlePattern = /(?:^|\n)([^-–—\n]+?)(?=\s*[-–—]|\s*\d{4}|\s*\d{2}\/\d{2}|\s*\w+\s+\d{4})/i;
    
    const dateMatch = entry.match(datePattern);
    const titleMatch = entry.match(titlePattern);
    
    return {
      title: titleMatch ? titleMatch[1].trim() : undefined,
      startDate: dateMatch ? dateMatch[1] : undefined,
      endDate: dateMatch ? dateMatch[2] : undefined
    };
  });
};

const extractEducationData = (text: string): EducationEntry[] => {
  // Try to find education section with various possible headers
  const educationSectionRegexes = [
    /(?:education|academic|educational|qualifications)[:\s]+(.*?)(?=\n\s*\n|\n(?:[A-Z][a-z]+\s*(?:&\s*)?)+:|\n\s*$)/is,
    /(?:academic\s+background|academic\s+qualifications|educational\s+background)[:\s]+(.*?)(?=\n\s*\n|\n(?:[A-Z][a-z]+\s*(?:&\s*)?)+:|\n\s*$)/is,
    /(?:degrees|diplomas|certifications|academic\s+credentials)[:\s]+(.*?)(?=\n\s*\n|\n(?:[A-Z][a-z]+\s*(?:&\s*)?)+:|\n\s*$)/is
  ];

  let educationSection = '';
  
  // Try each regex pattern until we find a match
  for (const regex of educationSectionRegexes) {
    const match = text.match(regex);
    if (match && match[1]) {
      educationSection = match[1].trim();
      break;
    }
  }
  
  if (!educationSection) {
    return [];
  }
  
  // Check if education section has bullet points
  const hasBulletPoints = /^[•\-\*\+\>\·\♦\■\□\◆\◇\○\●\★\☆]/m.test(educationSection);
  
  if (hasBulletPoints) {
    // Parse bullet point format
    const entries = educationSection.split(/\n(?=[•\-\*\+\>\·\♦\■\□\◆\◇\○\●\★\☆]\s+)/);
    
    return entries.map(entry => {
      // Clean up bullet point
      const cleanEntry = entry.replace(/^[•\-\*\+\>\·\♦\■\□\◆\◇\○\●\★\☆]\s*/, '').trim();
      
      // Extract degree
      const degreeMatch = cleanEntry.match(/([^,]+?)(?:,|$)/);
      const degree = degreeMatch ? degreeMatch[1].trim() : '';
      
      // Extract institution
      const institutionMatch = cleanEntry.match(/(?:from|at)\s+([^,]+)/i) || 
                              cleanEntry.match(/,\s*([^,]+?)(?:,|$)/);
      const institution = institutionMatch ? institutionMatch[1].trim() : '';
      
      // Extract location
      const locationMatch = cleanEntry.match(/(?:located in|in)\s+([A-Z][a-z]+(?:[\s,]+[A-Z][a-z]+)*)/i);
      const location = locationMatch ? locationMatch[1].trim() : '';
      
      // Extract year
      const yearMatch = cleanEntry.match(/(?:19|20)\d{2}(?:\s*[-–—]\s*(?:(?:19|20)\d{2}|present))?/);
      const year = yearMatch ? yearMatch[0] : '';
      
      // Extract GPA if available
      const gpaMatch = cleanEntry.match(/GPA\s*(?:of|:)?\s*([\d.]+)/i);
      const gpa = gpaMatch ? gpaMatch[1] : '';
      
      // Extract relevant courses if available
      const coursesMatch = cleanEntry.match(/(?:relevant|key|major)\s+courses?(?:\s+include)?[:\s]+([^.]+)/i);
      const relevantCourses = coursesMatch ? 
        coursesMatch[1].split(/[,;]/).map(course => course.trim()).filter(course => course.length > 0) : 
        [];
      
      // Extract achievements if available
      const achievementsMatch = cleanEntry.match(/(?:achievements|accomplishments|honors)[:\s]+([^.]+)/i);
      const achievements = achievementsMatch ? 
        achievementsMatch[1].split(/[,;]/).map(achievement => achievement.trim()).filter(achievement => achievement.length > 0) : 
        [];
      
      return {
        degree,
        institution,
        location,
        year,
        gpa,
        relevantCourses,
        achievements
      };
    }).filter(entry => entry.degree.length > 0);
  }
  
  // Parse paragraph format
  const entries = educationSection.split(/\n\s*\n/);
  
  return entries.map(entry => {
    // Extract degree
    const degreePatterns = [
      /(?:Bachelor|Master|PhD|Doctorate|MBA|BSc|BA|MA|MS|MSc|BBA|LLB|MD)(?:'s)?\s+(?:degree|diploma|certificate)?\s+(?:in|of)?\s+([^.,]+)/i,
      /(?:degree|diploma|certificate)\s+(?:in|of)\s+([^.,]+)/i,
      /([^.,]+?)\s+(?:degree|diploma|certificate)/i
    ];
    
    let degree = '';
    for (const pattern of degreePatterns) {
      const match = entry.match(pattern);
      if (match && match[1]) {
        degree = match[0].trim(); // Use the full match for the degree
        break;
      }
    }
    
    // If no degree found, try to extract the first line as degree
    if (!degree && entry.includes('\n')) {
      degree = entry.split('\n')[0].trim();
    }
    
    // Extract institution
    const institutionPatterns = [
      /(?:from|at|attended)\s+([A-Z][a-zA-Z\s&]+)(?:,|\s+in|\s+\(|\n|$)/i,
      /([A-Z][a-zA-Z\s&]+)(?:\s+University|\s+College|\s+Institute|\s+School)/i,
      /University\s+of\s+([A-Za-z\s&]+)(?:,|\s+in|\s+\(|\n|$)/i
    ];
    
    let institution = '';
    for (const pattern of institutionPatterns) {
      const match = entry.match(pattern);
      if (match) {
        institution = match[0].trim();
        break;
      }
    }
    
    // Extract location
    const locationPatterns = [
      /(?:located in|in)\s+([A-Z][a-z]+(?:[\s,]+[A-Z][a-z]+)*)/i,
      /(?:,\s+)([A-Z][a-z]+(?:[\s,]+[A-Z][a-z]+)*)(?:,|\s+\(|\n|$)/i
    ];
    
    let location = '';
    for (const pattern of locationPatterns) {
      const match = entry.match(pattern);
      if (match && match[1]) {
        location = match[1].trim();
        break;
      }
    }
    
    // Extract year
    const yearMatch = entry.match(/(?:19|20)\d{2}(?:\s*[-–—]\s*(?:(?:19|20)\d{2}|present))?/);
    const year = yearMatch ? yearMatch[0] : '';
    
    // Extract GPA if available
    const gpaMatch = entry.match(/GPA\s*(?:of|:)?\s*([\d.]+)/i);
    const gpa = gpaMatch ? gpaMatch[1] : '';
    
    // Extract relevant courses if available
    const coursesPatterns = [
      /(?:relevant|key|major)\s+courses?(?:\s+include)?[:\s]+([^.]+)/i,
      /courses?(?:\s+taken)?[:\s]+([^.]+)/i,
      /coursework(?:\s+includes?)?[:\s]+([^.]+)/i
    ];
    
    let relevantCourses: string[] = [];
    for (const pattern of coursesPatterns) {
      const match = entry.match(pattern);
      if (match && match[1]) {
        relevantCourses = match[1].split(/[,;]/).map(course => course.trim()).filter(course => course.length > 0);
        break;
      }
    }
    
    // Extract achievements if available
    const achievementsPatterns = [
      /(?:achievements|accomplishments|honors)[:\s]+([^.]+)/i,
      /(?:graduated|completed)\s+(?:with|as)\s+([^.]+)/i,
      /(?:dean's\s+list|honor\s+roll|cum\s+laude|magna\s+cum\s+laude|summa\s+cum\s+laude|with\s+honors|with\s+distinction)/i
    ];
    
    let achievements: string[] = [];
    for (const pattern of achievementsPatterns) {
      const match = entry.match(pattern);
      if (match) {
        if (match[1]) {
          achievements = match[1].split(/[,;]/).map(achievement => achievement.trim()).filter(achievement => achievement.length > 0);
        } else {
          // For patterns like dean's list that don't have a capture group
          achievements.push(match[0].trim());
        }
        break;
      }
    }
    
    // Look for bullet points that might be achievements
    const bulletAchievements = entry.split('\n')
      .filter(line => line.trim().startsWith('•') || line.trim().startsWith('-') || line.trim().startsWith('*'))
      .map(line => line.trim().replace(/^[•\-\*]\s*/, ''));
    
    // Filter for bullets that might be achievements
    const achievementKeywords = ['award', 'honor', 'scholarship', 'dean', 'recognition', 'achieved', 'graduated', 'cum laude', 'magna', 'summa', 'distinction', 'honors', 'first class'];
    
    const filteredBulletAchievements = bulletAchievements.filter(bullet => 
      achievementKeywords.some(keyword => 
        bullet.toLowerCase().includes(keyword.toLowerCase())
      )
    );
    
    if (filteredBulletAchievements.length > 0) {
      achievements = [...achievements, ...filteredBulletAchievements];
    }
    
    return {
      degree,
      institution,
      location,
      year,
      gpa,
      relevantCourses,
      achievements
    };
  }).filter(entry => entry.degree.length > 0 || entry.institution.length > 0);
};

const calculateYearsOfExperience = (experience: ExperienceEntry[]): number => {
  if (!experience || experience.length === 0) return 0;
  
  let totalYears = 0;
  const currentYear = new Date().getFullYear();
  
  experience.forEach((exp: ExperienceEntry) => {
    if (exp.startDate && exp.endDate) {
      const start = new Date(exp.startDate).getFullYear();
      const end = exp.endDate.toLowerCase() === 'present' ? 
        currentYear : 
        new Date(exp.endDate).getFullYear();
      
      totalYears += end - start;
    }
  });
  
  return totalYears;
};

const calculateSkillsMatch = (cvText: string, jobDescription: string): number => {
  const cvSkills = extractKeywords(cvText);
  const requiredSkills = extractKeywords(jobDescription);
  
  if (requiredSkills.length === 0) return 100;
  
  const matchedSkills = cvSkills.filter((skill: string) => 
    requiredSkills.some((req: string) => req.toLowerCase().includes(skill.toLowerCase()) || 
                               skill.toLowerCase().includes(req.toLowerCase()))
  );
  
  return Math.round((matchedSkills.length / requiredSkills.length) * 100);
};

const generateRecommendations = (cvKeywords: string[], jobKeywords: string[], overallScore: number): string[] => {
  const recommendations: string[] = [];
  
  // Missing keywords recommendations
  const missingKeywords = jobKeywords.filter(k => !cvKeywords.includes(k));
  if (missingKeywords.length > 0) {
    recommendations.push(`Consider adding these keywords: ${missingKeywords.join(', ')}`);
  }
  
  // Score-based recommendations
  if (overallScore < 50) {
    recommendations.push('Your CV needs significant improvements to match this job\'s requirements');
  } else if (overallScore < 70) {
    recommendations.push('Your CV could benefit from moderate improvements to better match this position');
  } else if (overallScore < 90) {
    recommendations.push('Your CV is a good match, but could be optimized further');
  }
  
  return recommendations;
};

// Modern file dropdown component
function ModernFileDropdown({ 
  cvs, 
  onSelect, 
  selectedCVName 
}: { 
  cvs: string[]; 
  onSelect: (cvId: string, cvName: string) => void; 
  selectedCVName?: string | null; 
}): JSX.Element {
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

// Update the analyzeJobMatch function
const analyzeJobMatch = (cvText: string, jobDescription: string): JobMatchAnalysis => {
  const cvKeywords = extractKeywords(cvText);
  const jobKeywords = extractKeywords(jobDescription);
  
  // Calculate keyword matches with relevance scores
  const matchedKeywords: KeywordMatch[] = cvKeywords
    .filter((keyword: string) => jobKeywords.includes(keyword))
    .map((keyword: string) => {
      const frequency = (cvText.match(new RegExp(keyword, 'gi')) || []).length;
      const placement = determineKeywordPlacement(cvText, keyword);
      const relevance = calculateKeywordRelevance(keyword, jobDescription, placement, frequency);
      
      return {
        keyword,
        relevance,
        frequency,
        placement
      };
    });

  // Calculate missing keywords with importance scores
  const missingKeywords: MissingKeyword[] = jobKeywords
    .filter((keyword: string) => !cvKeywords.includes(keyword))
    .map((keyword: string) => ({
      keyword,
      importance: calculateKeywordImportance(keyword, jobDescription),
      suggestedPlacement: suggestKeywordPlacement(keyword, jobDescription)
    }));

  // Calculate dimensional scores
  const skillsMatch = calculateSkillsMatch(cvText, jobDescription);
  const experienceMatch = calculateExperienceMatch(cvText, jobDescription);
  const educationMatch = calculateEducationMatch(cvText, jobDescription);
  const industryFit = calculateIndustryFit(cvText, jobDescription);
  const keywordDensity = calculateKeywordDensity(cvText, jobKeywords);
  const formatCompatibility = calculateFormatCompatibility(cvText);
  const contentRelevance = calculateContentRelevance(cvText, jobDescription);

  // Calculate overall compatibility score
  const overallCompatibility = Math.round(
    (skillsMatch * 0.25) +
    (experienceMatch * 0.25) +
    (educationMatch * 0.15) +
    (industryFit * 0.15) +
    (keywordDensity * 0.1) +
    (formatCompatibility * 0.05) +
    (contentRelevance * 0.05)
  );

  // Generate section analysis
  const sectionAnalysis = {
    profile: analyzeCVSection(cvText, 'profile', jobDescription),
    skills: analyzeCVSection(cvText, 'skills', jobDescription),
    experience: analyzeCVSection(cvText, 'experience', jobDescription),
    education: analyzeCVSection(cvText, 'education', jobDescription),
    achievements: analyzeCVSection(cvText, 'achievements', jobDescription)
  };

  // Calculate improvement potential
  const improvementPotential = 100 - overallCompatibility;

  // Generate recommendations
  const recommendations = generateRecommendations(cvKeywords, jobKeywords, overallCompatibility);

  // Generate detailed analysis
  const detailedAnalysis = generateDetailedAnalysis({
    matchedKeywords,
    missingKeywords,
    dimensionalScores: {
      skillsMatch,
      experienceMatch,
      educationMatch,
      industryFit,
      overallCompatibility,
      keywordDensity,
      formatCompatibility,
      contentRelevance
    },
    sectionAnalysis
  });

  return {
    score: overallCompatibility,
    matchedKeywords,
    missingKeywords,
    recommendations,
    skillGap: generateSkillGapAnalysis(missingKeywords),
    dimensionalScores: {
      skillsMatch,
      experienceMatch,
      educationMatch,
      industryFit,
      overallCompatibility,
      keywordDensity,
      formatCompatibility,
      contentRelevance
    },
    detailedAnalysis,
    improvementPotential,
    sectionAnalysis
  };
};

// Add helper functions for keyword analysis
const determineKeywordPlacement = (text: string, keyword: string): string => {
  const sections = {
    profile: /(?:profile|summary|objective)/i,
    experience: /(?:experience|work history|employment)/i,
    skills: /(?:skills|expertise|competencies)/i,
    education: /(?:education|qualifications|academic)/i,
    achievements: /(?:achievements|accomplishments)/i
  };

  for (const [section, pattern] of Object.entries(sections)) {
    const sectionMatch = text.match(pattern);
    if (sectionMatch && sectionMatch.index !== undefined) {
      const sectionStart = sectionMatch.index;
      const keywordMatch = text.slice(sectionStart).match(new RegExp(keyword, 'i'));
      if (keywordMatch) {
        return section;
      }
    }
  }

  return 'various';
};

const calculateKeywordRelevance = (
  keyword: string,
  jobDescription: string,
  placement: string,
  frequency: number
): number => {
  let relevance = 0;

  // Base relevance from frequency
  relevance += Math.min(frequency * 10, 30);

  // Relevance from job description emphasis
  const keywordEmphasis = (jobDescription.match(new RegExp(keyword, 'gi')) || []).length;
  relevance += Math.min(keywordEmphasis * 15, 40);

  // Placement bonus
  const placementScores: Record<string, number> = {
    profile: 20,
    skills: 25,
    experience: 30,
    achievements: 15,
    education: 10,
    various: 5
  };
  relevance += placementScores[placement] || 0;

  // Normalize to 0-100
  return Math.min(Math.round(relevance), 100);
};

const calculateKeywordImportance = (keyword: string, jobDescription: string): number => {
  let importance = 0;

  // Frequency in job description
  const frequency = (jobDescription.match(new RegExp(keyword, 'gi')) || []).length;
  importance += Math.min(frequency * 15, 45);

  // Position in job description
  const firstOccurrence = jobDescription.toLowerCase().indexOf(keyword.toLowerCase());
  if (firstOccurrence !== -1) {
    const positionScore = Math.max(0, 30 - Math.floor(firstOccurrence / 100));
    importance += positionScore;
  }

  // Context importance
  const requirementContext = new RegExp(`(required|must have|essential).*?${keyword}`, 'i');
  if (requirementContext.test(jobDescription)) {
    importance += 25;
  }

  return Math.min(Math.round(importance), 100);
};

const suggestKeywordPlacement = (keyword: string, jobDescription: string): string => {
  const contexts = {
    technical: /(technical|programming|software|development|engineering)/i,
    management: /(management|leadership|coordination|supervision)/i,
    business: /(business|strategy|planning|analysis)/i,
    soft: /(communication|interpersonal|teamwork|collaboration)/i
  };

  for (const [type, pattern] of Object.entries(contexts)) {
    if (pattern.test(keyword) || pattern.test(jobDescription)) {
      switch (type) {
        case 'technical': return 'skills section (technical)';
        case 'management': return 'experience section and profile';
        case 'business': return 'profile and achievements';
        case 'soft': return 'skills section (professional)';
        default: return 'skills section';
      }
    }
  }

  return 'skills section';
};

const calculateKeywordDensity = (text: string, keywords: string[]): number => {
  const words = text.toLowerCase().split(/\s+/).length;
  let keywordCount = 0;
  
  keywords.forEach(keyword => {
    const matches = text.match(new RegExp(keyword, 'gi'));
    if (matches) {
      keywordCount += matches.length;
    }
  });
  
  const density = (keywordCount / words) * 100;
  
  // Optimal density is between 1-3%
  if (density >= 1 && density <= 3) {
    return 100;
  } else if (density < 1) {
    return Math.round((density / 1) * 100);
  } else {
    return Math.round((3 / density) * 100);
  }
};

const calculateFormatCompatibility = (text: string): number => {
  let score = 0;
  
  // Check for clear section headers
  const hasHeaders = /(?:profile|summary|experience|education|skills|achievements)/gi.test(text);
  score += hasHeaders ? 30 : 0;
  
  // Check for bullet points
  const hasBullets = /(?:^|\n)\s*[•\-\*]\s+/m.test(text);
  score += hasBullets ? 20 : 0;
  
  // Check for consistent date formatting
  const hasConsistentDates = /(?:19|20)\d{2}\s*[-–—]\s*(?:(?:19|20)\d{2}|present)/gi.test(text);
  score += hasConsistentDates ? 20 : 0;
  
  // Check for appropriate length (between 300 and 1000 words)
  const wordCount = text.split(/\s+/).length;
  if (wordCount >= 300 && wordCount <= 1000) {
    score += 30;
  } else if (wordCount > 1000) {
    score += 15;
  } else {
    score += Math.round((wordCount / 300) * 30);
  }
  
  return score;
};

const calculateContentRelevance = (cvText: string, jobDescription: string): number => {
  const relevanceFactors = [
    {
      pattern: /(?:required|must have|essential).*?(?:skills|qualifications|experience)/gi,
      weight: 0.4
    },
    {
      pattern: /(?:responsibilities|duties|tasks)/gi,
      weight: 0.3
    },
    {
      pattern: /(?:preferred|desired|nice to have)/gi,
      weight: 0.2
    },
    {
      pattern: /(?:benefits|offer|provide)/gi,
      weight: 0.1
    }
  ];
  
  let totalScore = 0;
  let totalWeight = 0;
  
  relevanceFactors.forEach(({ pattern, weight }) => {
    const jobRequirements = jobDescription.match(pattern) || [];
    if (jobRequirements.length > 0) {
      const matchCount = jobRequirements.filter(req => 
        new RegExp(req.replace(/(?:required|must have|essential|preferred|desired)/gi, ''), 'i').test(cvText)
      ).length;
      
      totalScore += (matchCount / jobRequirements.length) * weight * 100;
      totalWeight += weight;
    }
  });
  
  return totalWeight > 0 ? Math.round(totalScore / totalWeight) : 50;
};

const analyzeCVSection = (
  cvText: string,
  section: string,
  jobDescription: string
): { score: number; feedback: string } => {
  const sectionPatterns: Record<string, RegExp> = {
    profile: /(?:profile|summary|objective)[:\s]+(.*?)(?=\n\s*\n|\n(?:[A-Z][a-z]+\s*(?:&\s*)?)+:|\n\s*$)/is,
    skills: /(?:skills|expertise|competencies)[:\s]+(.*?)(?=\n\s*\n|\n(?:[A-Z][a-z]+\s*(?:&\s*)?)+:|\n\s*$)/is,
    experience: /(?:experience|work history|employment)[:\s]+(.*?)(?=\n\s*\n|\n(?:[A-Z][a-z]+\s*(?:&\s*)?)+:|\n\s*$)/is,
    education: /(?:education|qualifications|academic)[:\s]+(.*?)(?=\n\s*\n|\n(?:[A-Z][a-z]+\s*(?:&\s*)?)+:|\n\s*$)/is,
    achievements: /(?:achievements|accomplishments)[:\s]+(.*?)(?=\n\s*\n|\n(?:[A-Z][a-z]+\s*(?:&\s*)?)+:|\n\s*$)/is
  };

  const sectionContent = cvText.match(sectionPatterns[section]);
  if (!sectionContent) {
    return {
      score: 0,
      feedback: `${section.charAt(0).toUpperCase() + section.slice(1)} section not found or not clearly defined.`
    };
  }

  const content = sectionContent[1];
  let score = 0;
  let feedback: string[] = [];

  // Check content length
  const words = content.split(/\s+/).length;
  if (words < 50) {
    score += 20;
    feedback.push("Consider expanding this section with more details.");
  } else if (words < 100) {
    score += 40;
    feedback.push("Good length, but could be enhanced with more specific details.");
  } else {
    score += 60;
    feedback.push("Excellent detailed content.");
  }

  // Check keyword relevance
  const jobKeywords = extractKeywords(jobDescription);
  const sectionKeywords = extractKeywords(content);
  const matchedKeywords = sectionKeywords.filter(k => jobKeywords.includes(k));
  
  const keywordScore = Math.round((matchedKeywords.length / jobKeywords.length) * 40);
  score += keywordScore;

  if (keywordScore < 20) {
    feedback.push("Add more relevant keywords from the job description.");
  } else if (keywordScore < 30) {
    feedback.push("Good keyword usage, consider adding a few more relevant terms.");
  } else {
    feedback.push("Excellent keyword optimization.");
  }

  return {
    score: Math.min(score, 100),
    feedback: feedback.join(" ")
  };
};

const generateDetailedAnalysis = (analysis: {
  matchedKeywords: KeywordMatch[];
  missingKeywords: MissingKeyword[];
  dimensionalScores: {
    skillsMatch: number;
    experienceMatch: number;
    educationMatch: number;
    industryFit: number;
    overallCompatibility: number;
    keywordDensity: number;
    formatCompatibility: number;
    contentRelevance: number;
  };
  sectionAnalysis: {
    profile: { score: number; feedback: string };
    skills: { score: number; feedback: string };
    experience: { score: number; feedback: string };
    education: { score: number; feedback: string };
    achievements: { score: number; feedback: string };
  };
}): string => {
  const {
    matchedKeywords,
    missingKeywords,
    dimensionalScores,
    sectionAnalysis
  } = analysis;

  const strengths: string[] = [];
  const improvements: string[] = [];

  // Analyze matched keywords
  if (matchedKeywords.length > 0) {
    strengths.push(`Strong alignment with ${matchedKeywords.length} key job requirements`);
  }

  // Analyze scores
  if (dimensionalScores.skillsMatch > 70) {
    strengths.push('Excellent skills match with job requirements');
  } else if (dimensionalScores.skillsMatch < 50) {
    improvements.push('Consider enhancing your skills section to better match job requirements');
  }

  if (dimensionalScores.experienceMatch > 70) {
    strengths.push('Experience level well-aligned with position requirements');
  } else if (dimensionalScores.experienceMatch < 50) {
    improvements.push('Your experience level might need to be better highlighted or enhanced');
  }

  if (dimensionalScores.industryFit > 70) {
    strengths.push('Strong industry alignment');
  } else if (dimensionalScores.industryFit < 50) {
    improvements.push('Consider emphasizing industry-specific experience and knowledge');
  }

  // Analyze sections
  Object.entries(sectionAnalysis).forEach(([section, analysis]) => {
    if (analysis.score > 70) {
      strengths.push(`Strong ${section} section: ${analysis.feedback}`);
    } else if (analysis.score < 50) {
      improvements.push(`${section.charAt(0).toUpperCase() + section.slice(1)} needs improvement: ${analysis.feedback}`);
    }
  });

  // Compile the analysis
  let analysisText = 'CV Analysis Summary:\n\n';
  
  if (strengths.length > 0) {
    analysisText += 'Strengths:\n- ' + strengths.join('\n- ') + '\n\n';
  }
  
  if (improvements.length > 0) {
    analysisText += 'Areas for Improvement:\n- ' + improvements.join('\n- ') + '\n\n';
  }
  
  if (missingKeywords.length > 0) {
    analysisText += `Consider incorporating these key terms: ${missingKeywords.map(k => k.keyword).join(', ')}`;
  }

  return analysisText;
};

const generateSkillGapAnalysis = (missingKeywords: MissingKeyword[]): string => {
  if (missingKeywords.length === 0) {
    return "Your CV demonstrates strong alignment with the job requirements.";
  }

  const criticalSkills = missingKeywords
    .filter(k => k.importance > 70)
    .map(k => k.keyword);
  
  const desiredSkills = missingKeywords
    .filter(k => k.importance <= 70)
    .map(k => k.keyword);

  let analysis = '';
  
  if (criticalSkills.length > 0) {
    analysis += `Critical skills to add: ${criticalSkills.join(', ')}. `;
  }
  
  if (desiredSkills.length > 0) {
    analysis += `Consider highlighting experience with: ${desiredSkills.join(', ')}.`;
  }

  return analysis;
};

// Add missing helper functions for job match analysis
const calculateExperienceMatch = (cvText: string, jobDescription: string): number => {
  let score = 0;
  
  // Required years of experience
  const reqYearsMatch = jobDescription.match(/(\d+)(?:\+)?\s*(?:years?|yrs?)\s*(?:of)?\s*experience/i);
  const reqYears = reqYearsMatch ? parseInt(reqYearsMatch[1]) : 0;
  
  const experience = extractExperienceData(cvText);
  const actualYears = calculateYearsOfExperience(experience);
  
  if (reqYears > 0) {
    score += Math.min((actualYears / reqYears) * 50, 50);
  } else {
    score += 50; // No specific requirement
  }
  
  // Role title match
  const roleMatch = jobDescription.match(/(?:position|role|job title|title):\s*([^.,:;\n]+)/i);
  if (roleMatch && experience) {
    const roleTitle = roleMatch[1].toLowerCase();
    const hasMatchingRole = experience.some(exp => 
      exp.title?.toLowerCase().includes(roleTitle) || 
      roleTitle.includes(exp.title?.toLowerCase() || '')
    );
    score += hasMatchingRole ? 50 : 25;
  } else {
    score += 25;
  }
  
  return Math.round(score);
};

const calculateEducationMatch = (cvText: string, jobDescription: string): number => {
  let score = 0;
  
  // Extract required education level
  const eduLevels = {
    phd: /(ph\.?d|doctorate)/i,
    masters: /(master'?s|mba|m\.s\.|m\.a\.)/i,
    bachelors: /(bachelor'?s|b\.s\.|b\.a\.)/i,
    associate: /(associate'?s|a\.s\.|a\.a\.)/i
  };
  
  const education = extractEducationData(cvText);
  if (!education) return 50; // Default score if no education section found
  
  // Find highest required education level
  let requiredLevel = '';
  for (const [level, pattern] of Object.entries(eduLevels)) {
    if (pattern.test(jobDescription)) {
      requiredLevel = level;
      break;
    }
  }
  
  // Find highest achieved education level
  let achievedLevel = '';
  for (const [level, pattern] of Object.entries(eduLevels)) {
    if (education.some(edu => pattern.test(edu.degree))) {
      achievedLevel = level;
      break;
    }
  }
  
  // Score based on education level match
  const levelScores: Record<string, number> = {
    phd: 100,
    masters: 80,
    bachelors: 60,
    associate: 40
  };
  
  if (!requiredLevel) {
    score = 80; // No specific requirement
  } else {
    const requiredScore = levelScores[requiredLevel] || 0;
    const achievedScore = levelScores[achievedLevel] || 0;
    score = achievedScore >= requiredScore ? 100 : Math.round((achievedScore / requiredScore) * 100);
  }
  
  return score;
};

const calculateIndustryFit = (cvText: string, jobDescription: string): number => {
  const industries = {
    technology: ['software', 'it', 'tech', 'digital', 'web', 'cloud', 'data'],
    finance: ['banking', 'finance', 'investment', 'accounting', 'trading'],
    healthcare: ['medical', 'health', 'clinical', 'patient', 'healthcare'],
    marketing: ['marketing', 'advertising', 'brand', 'media', 'content'],
    manufacturing: ['manufacturing', 'production', 'assembly', 'industrial'],
    consulting: ['consulting', 'advisory', 'strategy', 'business']
  };
  
  let bestMatch = { industry: '', score: 0 };
  
  for (const [industry, keywords] of Object.entries(industries)) {
    let industryScore = 0;
    
    // Check keyword presence
    keywords.forEach(keyword => {
      const jobMatches = (jobDescription.match(new RegExp(keyword, 'gi')) || []).length;
      const cvMatches = (cvText.match(new RegExp(keyword, 'gi')) || []).length;
      
      if (jobMatches > 0 && cvMatches > 0) {
        industryScore += 20;
      } else if (jobMatches > 0) {
        industryScore -= 10;
      }
    });
    
    if (industryScore > bestMatch.score) {
      bestMatch = { industry, score: industryScore };
    }
  }
  
  return Math.max(Math.min(bestMatch.score, 100), 0);
};

const extractName = (text: string): string => {
  // Try to find a name at the beginning of the document
  const namePattern = /^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/m;
  const match = text.match(namePattern);
  
  // If no match found at the beginning, try to find any capitalized name-like pattern
  if (!match) {
    const fallbackPattern = /([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2})/;
    const fallbackMatch = text.match(fallbackPattern);
    return fallbackMatch ? fallbackMatch[1] : 'Professional Resume';
  }
  
  return match[1];
};

const extractContactInfo = (text: string): StructuredCV['contactInfo'] => {
  const contactInfo: StructuredCV['contactInfo'] = {};
  
  // Extract email
  const emailPattern = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/;
  const emailMatch = text.match(emailPattern);
  if (emailMatch) {
    contactInfo.email = emailMatch[0];
  }
  
  // Extract phone number
  const phonePattern = /(?:\+\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/;
  const phoneMatch = text.match(phonePattern);
  if (phoneMatch) {
    contactInfo.phone = phoneMatch[0];
  }
  
  // Extract location (city, state/province, country)
  const locationPattern = /(?:^|\n)([A-Za-z\s]+,\s*[A-Za-z\s]+(?:,\s*[A-Za-z\s]+)?)/m;
  const locationMatch = text.match(locationPattern);
  if (locationMatch) {
    contactInfo.location = locationMatch[1].trim();
  }
  
  // Extract LinkedIn
  const linkedinPattern = /(?:linkedin\.com\/in\/|LinkedIn:?\s*)([A-Za-z0-9_-]+)/i;
  const linkedinMatch = text.match(linkedinPattern);
  if (linkedinMatch) {
    contactInfo.linkedin = linkedinMatch[1];
  }
  
  // Extract website
  const websitePattern = /(?:https?:\/\/)?(?:www\.)?([A-Za-z0-9][-A-Za-z0-9.]*\.[A-Za-z]{2,}(?:\/\S*)?)/i;
  const websiteMatch = text.match(websitePattern);
  if (websiteMatch && !websiteMatch[0].includes('linkedin.com')) {
    contactInfo.website = websiteMatch[0];
  }
  
  return contactInfo;
};

const generateStructuredCV = (cvText: string, jobDescription: string): StructuredCV => {
  const name = extractName(cvText);
  const subheader = extractSubheader(cvText);
  const profile = extractProfile(cvText);
  const experience = extractExperienceData(cvText);
  const education = extractEducationData(cvText);
  const technicalSkills = extractTechnicalSkills(cvText);
  const professionalSkills = extractProfessionalSkills(cvText);
  const achievements = extractAchievements(cvText);
  const goals = extractGoals(cvText);
  const languages = extractLanguages(cvText);
  const contactInfo = extractContactInfo(cvText);

  return {
    name,
    subheader,
    profile,
    experience,
    education,
    skills: {
      technical: technicalSkills,
      professional: professionalSkills
    },
    achievements,
    goals,
    languages,
    contactInfo
  };
};

const extractSubheader = (text: string): string => {
  const lines = text.split('\n');
  if (lines.length < 2) return '';
  
  const subheaderPattern = /^(?!(?:profile|summary|objective|experience|education|skills|achievements))[A-Za-z\s.,|&]+$/i;
  const subheaderLine = lines.slice(1, 3).find(line => subheaderPattern.test(line.trim()));
  
  return subheaderLine ? subheaderLine.trim() : '';
};

const extractProfile = (text: string): string => {
  // Try to find profile/summary/objective section
  const profilePattern = /(?:profile|summary|objective|about me)[:\s]+(.*?)(?=\n\s*\n|\n(?:[A-Z][a-z]+\s*(?:&\s*)?)+:|\n\s*$)/is;
  const match = text.match(profilePattern);
  
  if (!match || !match[1]) {
    // If no profile section found, try to extract the first paragraph as a profile
    const firstParagraphPattern = /^(?:[^\n]+\n){1,3}([^\n]+(?:\n[^\n]+){1,5})/;
    const firstParagraphMatch = text.match(firstParagraphPattern);
    return firstParagraphMatch ? firstParagraphMatch[1].trim() : '';
  }
  
  return match[1].trim();
};

const optimizeProfile = (profile: string, jobDescription: string, jobKeywords: string[]): string => {
  // If profile is empty, generate a new one
  if (!profile) {
    return `Experienced professional with expertise in ${jobKeywords.slice(0, 3).join(', ')}, seeking to leverage my skills in ${jobKeywords.slice(3, 5).join(' and ')} to excel in this role.`;
  }
  
  // Extract important job requirements
  const requirementPatterns = [
    /(?:required|must have|essential)[:\s]+([^.]+)/gi,
    /(?:seeking|looking for)[:\s]+([^.]+)/gi,
    /(?:responsibilities include|will be responsible for)[:\s]+([^.]+)/gi
  ];
  
  let keyRequirements: string[] = [];
  requirementPatterns.forEach(pattern => {
    const matches = [...jobDescription.matchAll(pattern)];
    matches.forEach(match => {
      if (match[1]) {
        keyRequirements.push(match[1].trim());
      }
    });
  });
  
  // If no key requirements found, use top keywords
  if (keyRequirements.length === 0) {
    keyRequirements = jobKeywords.slice(0, 3);
  }
  
  // Check if profile already contains key requirements
  const profileLower = profile.toLowerCase();
  const missingRequirements = keyRequirements.filter(req => 
    !profileLower.includes(req.toLowerCase())
  );
  
  // If profile already contains all key requirements, return it as is
  if (missingRequirements.length === 0) {
    return profile;
  }
  
  // Otherwise, enhance the profile with missing requirements
  let enhancedProfile = profile;
  
  // Add a sentence highlighting missing requirements if needed
  if (missingRequirements.length > 0) {
    enhancedProfile += ` Particularly skilled in ${missingRequirements.join(', ')}.`;
  }
  
  return enhancedProfile;
};

const extractTechnicalSkills = (text: string): string[] => {
  // Try multiple patterns to find technical skills section
  const technicalPatterns = [
    /(?:technical|programming|software|development|hard|computer)\s+skills[:\s]+(.*?)(?=\n\s*\n|\n(?:[A-Z][a-z]+\s*(?:&\s*)?)+:|\n\s*$)/is,
    /(?:skills|expertise|competencies)[:\s]+(.*?)(?=\n\s*\n|\n(?:[A-Z][a-z]+\s*(?:&\s*)?)+:|\n\s*$)/is
  ];
  
  let match = null;
  for (const pattern of technicalPatterns) {
    match = text.match(pattern);
    if (match && match[1]) break;
  }
  
  if (!match || !match[1]) return [];
  
  // Extract skills from the matched section
  const skillsText = match[1];
  
  // Try to detect if skills are in a list format
  const hasBulletPoints = /^[•\-\*\+\>\·\♦\■\□\◆\◇\○\●\★\☆]\s+/m.test(skillsText);
  
  if (hasBulletPoints) {
    // Extract skills from bullet points
    return skillsText
      .split(/\n/)
      .map(skill => skill.replace(/^[•\-\*\+\>\·\♦\■\□\◆\◇\○\●\★\☆]\s*/, '').trim())
      .filter(skill => skill.length > 0);
  } else {
    // Extract skills from comma/semicolon separated list
    return skillsText
      .split(/[,;]|\band\b/)
      .map(skill => skill.trim())
      .filter(skill => skill.length > 0);
  }
};

const extractProfessionalSkills = (text: string): string[] => {
  // Try multiple patterns to find professional skills section
  const professionalPatterns = [
    /(?:professional|soft|interpersonal|communication|people)\s+skills[:\s]+(.*?)(?=\n\s*\n|\n(?:[A-Z][a-z]+\s*(?:&\s*)?)+:|\n\s*$)/is
  ];
  
  let match = null;
  for (const pattern of professionalPatterns) {
    match = text.match(pattern);
    if (match && match[1]) break;
  }
  
  if (!match || !match[1]) {
    // If no dedicated professional skills section, try to extract from general skills
    const technicalSkills = extractTechnicalSkills(text);
    const professionalSkillKeywords = [
      'communication', 'leadership', 'teamwork', 'collaboration', 'problem-solving',
      'time management', 'adaptability', 'creativity', 'critical thinking', 'emotional intelligence',
      'negotiation', 'conflict resolution', 'presentation', 'customer service', 'decision making'
    ];
    
    return technicalSkills.filter(skill => 
      professionalSkillKeywords.some(keyword => 
        skill.toLowerCase().includes(keyword.toLowerCase())
      )
    );
  }
  
  // Extract skills from the matched section
  const skillsText = match[1];
  
  // Try to detect if skills are in a list format
  const hasBulletPoints = /^[•\-\*\+\>\·\♦\■\□\◆\◇\○\●\★\☆]\s+/m.test(skillsText);
  
  if (hasBulletPoints) {
    // Extract skills from bullet points
    return skillsText
      .split(/\n/)
      .map(skill => skill.replace(/^[•\-\*\+\>\·\♦\■\□\◆\◇\○\●\★\☆]\s*/, '').trim())
      .filter(skill => skill.length > 0);
  } else {
    // Extract skills from comma/semicolon separated list
    return skillsText
      .split(/[,;]|\band\b/)
      .map(skill => skill.trim())
      .filter(skill => skill.length > 0);
  }
};

const extractAchievements = (text: string): string[] => {
  // Try to find an achievements section with various possible headers
  const achievementSectionRegexes = [
    /(?:achievements|accomplishments|key\s+achievements|notable\s+achievements|major\s+accomplishments|key\s+results|significant\s+contributions)[:\s]+(.*?)(?=\n\s*\n|\n(?:[A-Z][a-z]+\s*(?:&\s*)?)+:|\n\s*$)/is,
    /(?:achievements|accomplishments)[:\s]+(.*?)(?=\n\s*\n|\n(?:[A-Z][a-z]+\s*(?:&\s*)?)+:|\n\s*$)/is,
    /(?:key\s+accomplishments|key\s+results)[:\s]+(.*?)(?=\n\s*\n|\n(?:[A-Z][a-z]+\s*(?:&\s*)?)+:|\n\s*$)/is,
    /(?:awards|honors|recognitions)[:\s]+(.*?)(?=\n\s*\n|\n(?:[A-Z][a-z]+\s*(?:&\s*)?)+:|\n\s*$)/is,
    /(?:key\s+achievements|major\s+achievements|significant\s+achievements)[:\s]+(.*?)(?=\n\s*\n|\n(?:[A-Z][a-z]+\s*(?:&\s*)?)+:|\n\s*$)/is
  ];

  let achievementsSection = '';
  
  // Try each regex pattern until we find a match
  for (const regex of achievementSectionRegexes) {
    const match = text.match(regex);
    if (match && match[1]) {
      achievementsSection = match[1].trim();
      break;
    }
  }
  
  // If no dedicated achievements section, try to extract achievements from experience section
  if (!achievementsSection) {
    const experienceRegexes = [
      /(?:experience|work\s+experience|professional\s+experience|employment|work\s+history)[:\s]+(.*?)(?=\n\s*\n|\n(?:[A-Z][a-z]+\s*(?:&\s*)?)+:|\n\s*$)/is,
      /(?:employment|career\s+history|professional\s+background)[:\s]+(.*?)(?=\n\s*\n|\n(?:[A-Z][a-z]+\s*(?:&\s*)?)+:|\n\s*$)/is
    ];
    
    let experienceSection = '';
    for (const regex of experienceRegexes) {
      const match = text.match(regex);
      if (match && match[1]) {
        experienceSection = match[1].trim();
        break;
      }
    }
    
    if (experienceSection) {
      // Look for achievement-related keywords in bullet points
      const achievementKeywords = [
        'achieved', 'increased', 'improved', 'reduced', 'saved', 'delivered',
        'launched', 'created', 'developed', 'implemented', 'led', 'managed',
        'award', 'recognition', 'success', 'exceeded', 'outperformed',
        'generated', 'boosted', 'grew', 'expanded', 'streamlined', 'optimized',
        'enhanced', 'transformed', 'pioneered', 'spearheaded', 'orchestrated',
        'revenue', 'profit', 'cost', 'efficiency', 'productivity', 'quality',
        'customer satisfaction', 'sales', 'growth', 'market share', 'ROI',
        '%', 'percent', 'million', 'thousand', 'billion', '$', '€', '£'
      ];
      
      // Split experience section into paragraphs (job entries)
      const experienceParagraphs = experienceSection.split(/\n\s*\n/);
      
      // For each job entry, extract bullet points that look like achievements
      const achievementBullets: string[] = [];
      
      experienceParagraphs.forEach(paragraph => {
        const bullets = paragraph.split('\n')
          .filter(line => line.trim().startsWith('•') || line.trim().startsWith('-') || line.trim().startsWith('*'))
          .map(line => line.trim().replace(/^[•\-\*]\s*/, ''));
        
        // Filter for bullets that contain achievement keywords or metrics
        const paragraphAchievements = bullets.filter(bullet => 
          achievementKeywords.some(keyword => 
            bullet.toLowerCase().includes(keyword.toLowerCase())
          ) || 
          // Look for metrics (numbers with % or currency symbols)
          /\d+%|\$\d+|\d+\s*(?:million|thousand|hundred|k|m|b|billion)/i.test(bullet)
        );
        
        achievementBullets.push(...paragraphAchievements);
      });
      
      if (achievementBullets.length > 0) {
        achievementsSection = achievementBullets.join('\n');
      }
    }
  }
  
  // Also check for achievements in the education section
  if (!achievementsSection || achievementsSection.trim().length === 0) {
    const educationRegexes = [
      /(?:education|academic|educational|qualifications)[:\s]+(.*?)(?=\n\s*\n|\n(?:[A-Z][a-z]+\s*(?:&\s*)?)+:|\n\s*$)/is,
      /(?:academic\s+background|academic\s+qualifications|educational\s+background)[:\s]+(.*?)(?=\n\s*\n|\n(?:[A-Z][a-z]+\s*(?:&\s*)?)+:|\n\s*$)/is
    ];
    
    let educationSection = '';
    for (const regex of educationRegexes) {
      const match = text.match(regex);
      if (match && match[1]) {
        educationSection = match[1].trim();
        break;
      }
    }
    
    if (educationSection) {
      // Look for achievements, honors, awards in education section
      const educationAchievementRegexes = [
        /(?:achievements|honors|awards|scholarships|dean's\s+list)[:\s]+(.*?)(?=\n\s*\n|\n(?:[A-Z][a-z]+\s*(?:&\s*)?)+:|\n\s*$)/is,
        /(?:academic\s+achievements|academic\s+honors|academic\s+awards)[:\s]+(.*?)(?=\n\s*\n|\n(?:[A-Z][a-z]+\s*(?:&\s*)?)+:|\n\s*$)/is
      ];
      
      for (const regex of educationAchievementRegexes) {
        const match = educationSection.match(regex);
        if (match && match[1]) {
          // If we already have some achievements, append these; otherwise set as achievements
          if (achievementsSection) {
            achievementsSection += '\n' + match[1].trim();
          } else {
            achievementsSection = match[1].trim();
          }
          break;
        }
      }
      
      // If still no achievements, look for bullet points in education section that might be achievements
      if (!achievementsSection || achievementsSection.trim().length === 0) {
        const educationBullets = educationSection.split('\n')
          .filter(line => line.trim().startsWith('•') || line.trim().startsWith('-') || line.trim().startsWith('*'))
          .map(line => line.trim().replace(/^[•\-\*]\s*/, ''));
        
        // Filter for bullets that might be achievements
        const achievementKeywords = ['award', 'honor', 'scholarship', 'dean', 'recognition', 'achieved', 'graduated', 'cum laude', 'magna', 'summa', 'distinction', 'honors', 'first class'];
        
        const educationAchievements = educationBullets.filter(bullet => 
          achievementKeywords.some(keyword => 
            bullet.toLowerCase().includes(keyword.toLowerCase())
          )
        );
        
        if (educationAchievements.length > 0) {
          if (achievementsSection) {
            achievementsSection += '\n' + educationAchievements.join('\n');
          } else {
            achievementsSection = educationAchievements.join('\n');
          }
        }
      }
    }
  }
  
  // Also check for achievements in the profile/summary section
  if (!achievementsSection || achievementsSection.trim().length === 0) {
    const profileRegexes = [
      /(?:profile|summary|about me|professional summary)[:\s]+(.*?)(?=\n\s*\n|\n(?:[A-Z][a-z]+\s*(?:&\s*)?)+:|\n\s*$)/is,
      /(?:career\s+profile|professional\s+profile|career\s+summary)[:\s]+(.*?)(?=\n\s*\n|\n(?:[A-Z][a-z]+\s*(?:&\s*)?)+:|\n\s*$)/is
    ];
    
    let profileSection = '';
    for (const regex of profileRegexes) {
      const match = text.match(regex);
      if (match && match[1]) {
        profileSection = match[1].trim();
        break;
      }
    }
    
    if (profileSection) {
      // Look for sentences that might contain achievements
      const sentences = profileSection.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 0);
      
      // Achievement indicators in profile
      const achievementKeywords = ['achieved', 'increased', 'improved', 'reduced', 'saved', 'delivered', 'award', 'recognition'];
      const metricsPattern = /\d+%|\$\d+|\d+\s*(?:million|thousand|hundred|k|m|b|billion)/i;
      
      const profileAchievements = sentences.filter(sentence => 
        achievementKeywords.some(keyword => sentence.toLowerCase().includes(keyword.toLowerCase())) ||
        metricsPattern.test(sentence)
      );
      
      if (profileAchievements.length > 0) {
        if (achievementsSection) {
          achievementsSection += '\n' + profileAchievements.join('\n');
        } else {
          achievementsSection = profileAchievements.join('\n');
        }
      }
    }
  }
  
  // Parse achievements into an array
  if (achievementsSection) {
    // Check if achievements are in bullet point format
    if (achievementsSection.includes('•') || achievementsSection.includes('-') || achievementsSection.includes('*')) {
      return achievementsSection.split('\n')
        .filter(line => line.trim().length > 0)
        .map(line => line.trim().replace(/^[•\-\*]\s*/, ''));
    } else {
      // If not in bullet points, split by sentences or semicolons
      return achievementsSection.split(/[.;]/)
        .filter(item => item.trim().length > 0)
        .map(item => item.trim());
    }
  }
  
  // If no achievements found, return empty array
  return [];
};

const optimizeAchievements = (achievements: string[], jobDescription: string, jobKeywords: string[]): string[] => {
  if (achievements.length === 0) {
    // If no achievements found, generate some based on job description
    return generateAchievementsFromJobDescription(jobDescription, jobKeywords);
  }
  
  // Extract achievement-related keywords from job description
  const jobAchievementKeywords = extractAchievementKeywordsFromJob(jobDescription);
  
  // Extract industry-specific terms from job description
  const industryTerms = extractIndustryTerms(jobDescription);
  
  // Extract metrics from job description (numbers, percentages, etc.)
  const metricPatterns = [
    /\d+%/g,                                // Percentages
    /\$\d+(?:[,.]\d+)?(?:\s*[kmbt])?/gi,    // Dollar amounts
    /\d+\s*(?:million|thousand|billion)/gi, // Large numbers
    /\d+\s*(?:x|times)/gi,                  // Multipliers
    /(?:increase|decrease|reduce|improve|enhance|boost|grow)\s+by\s+\d+/gi // Improvements
  ];
  
  const jobMetrics: string[] = [];
  metricPatterns.forEach(pattern => {
    const matches = [...jobDescription.matchAll(pattern)];
    matches.forEach(match => {
      if (match[0]) jobMetrics.push(match[0].toLowerCase());
    });
  });
  
  // Add job-specific keywords
  const allRelevantKeywords = [...new Set([...jobAchievementKeywords, ...jobKeywords, ...industryTerms])];
  
  // Score each achievement based on relevance to job
  const scoredAchievements = achievements.map(achievement => {
    // Count how many relevant keywords are in this achievement
    const keywordMatches = allRelevantKeywords.filter(keyword => 
      achievement.toLowerCase().includes(keyword.toLowerCase())
    ).length;
    
    // Calculate a relevance score (0-100)
    const relevanceScore = Math.min(100, (keywordMatches / Math.max(1, allRelevantKeywords.length * 0.3)) * 100);
    
    // Check if achievement contains quantifiable results
    const hasQuantifiableResults = /\d+%|\d+\s*(?:million|thousand|hundred|k|m|b|billion|x|times)|\$\d+/i.test(achievement);
    
    // Bonus points for quantifiable results
    const quantifiableBonus = hasQuantifiableResults ? 30 : 0;
    
    // Bonus for achievements that directly match job requirements
    const jobRequirementBonus = jobKeywords.some(keyword => 
      achievement.toLowerCase().includes(keyword.toLowerCase())
    ) ? 20 : 0;
    
    // Bonus for achievements with strong action verbs
    const actionVerbs = ['led', 'managed', 'developed', 'created', 'implemented', 'designed', 'launched', 'delivered', 'achieved', 'improved', 'increased', 'reduced', 'optimized'];
    const hasStrongVerb = actionVerbs.some(verb => 
      achievement.toLowerCase().includes(verb.toLowerCase())
    );
    const verbBonus = hasStrongVerb ? 15 : 0;
    
    // Final score
    const score = relevanceScore + quantifiableBonus + jobRequirementBonus + verbBonus;
    
    return {
      achievement,
      score,
      hasQuantifiableResults,
      keywordMatches,
      hasStrongVerb
    };
  });
  
  // Sort achievements by score (highest first)
  scoredAchievements.sort((a, b) => b.score - a.score);
  
  // Take top 5-7 achievements or all if less than 5
  const topAchievements = scoredAchievements.slice(0, Math.min(7, scoredAchievements.length));
  
  // Enhance achievements with quantifiable results if missing
  const enhancedAchievements = topAchievements.map(({ achievement, hasQuantifiableResults, keywordMatches, hasStrongVerb }) => {
    // If already has quantifiable results, return as is
    if (hasQuantifiableResults) {
      return achievement;
    }
    
    // Check if achievement already ends with a period
    const needsPeriod = !achievement.endsWith('.');
    
    // For achievements without quantifiable results, try to enhance them
    // by making them more specific and aligned with job requirements
    let enhancedAchievement = achievement;
    
    // If the achievement has good keyword matches but no metrics,
    // try to add a relevant metric from the job description
    if (keywordMatches >= 2 && jobMetrics.length > 0) {
      // Find a suitable metric that's not already in the achievement
      const suitableMetric = jobMetrics.find(metric => 
        !achievement.toLowerCase().includes(metric)
      );
      
      if (suitableMetric) {
        // Add the metric in a natural way
        if (/ed$/.test(achievement)) {
          // For past tense achievements, add "resulting in X" or "leading to X"
          enhancedAchievement += `, resulting in ${suitableMetric} improvement`;
        } else {
          // For other achievements, add "by X" or "with X"
          enhancedAchievement += ` by ${suitableMetric}`;
        }
      } else {
        // If no suitable metric from job description, add a generic one
        const genericMetrics = ['20%', '30%', '25%', '$100K', '40%', '15%'];
        const randomIndex = Math.floor(hashString(achievement) % genericMetrics.length);
        const genericMetric = genericMetrics[randomIndex];
        
        if (/ed$/.test(achievement)) {
          enhancedAchievement += `, resulting in ${genericMetric} improvement`;
        } else {
          enhancedAchievement += ` by ${genericMetric}`;
        }
      }
    }
    
    // If achievement doesn't have a strong action verb, add one
    if (!hasStrongVerb) {
      const actionVerbs = ['Led', 'Managed', 'Developed', 'Created', 'Implemented', 'Designed', 'Launched', 'Delivered', 'Achieved', 'Improved', 'Increased', 'Reduced', 'Optimized'];
      const randomIndex = Math.floor(hashString(achievement) % actionVerbs.length);
      const verb = actionVerbs[randomIndex];
      
      // Check if achievement starts with a capital letter (likely beginning of sentence)
      if (/^[A-Z]/.test(achievement)) {
        // Replace first word with action verb if it's not already an action verb
        if (!actionVerbs.some(v => achievement.toLowerCase().startsWith(v.toLowerCase()))) {
          const words = achievement.split(' ');
          words[0] = verb;
          enhancedAchievement = words.join(' ');
        }
      } else {
        // Add action verb at beginning
        enhancedAchievement = `${verb} ${achievement.charAt(0).toLowerCase()}${achievement.slice(1)}`;
      }
    }
    
    // Add period if needed
    if (needsPeriod) {
      enhancedAchievement += '.';
    }
    
    return enhancedAchievement;
  });
  
  return enhancedAchievements;
};

// Helper function to extract achievement-related keywords from job description
const extractAchievementKeywordsFromJob = (jobDescription: string): string[] => {
  const keywords: string[] = [];
  
  // Common achievement-related terms
  const achievementTerms = [
    'results', 'success', 'achievement', 'accomplishment', 'performance',
    'improve', 'increase', 'reduce', 'enhance', 'optimize', 'streamline',
    'growth', 'efficiency', 'productivity', 'quality', 'revenue', 'profit',
    'cost', 'saving', 'customer satisfaction', 'sales', 'market share',
    'ROI', 'KPI', 'metric', 'target', 'goal', 'objective', 'deadline',
    'budget', 'project', 'initiative', 'strategy', 'implementation',
    'development', 'innovation', 'leadership', 'management', 'team'
  ];
  
  // Check for achievement terms in job description
  achievementTerms.forEach(term => {
    if (jobDescription.toLowerCase().includes(term.toLowerCase())) {
      keywords.push(term);
    }
  });
  
  // Extract specific metrics mentioned in job description
  const metricPatterns = [
    /\d+%/g,                                // Percentages
    /\$\d+(?:[,.]\d+)?(?:\s*[kmbt])?/gi,    // Dollar amounts
    /\d+\s*(?:million|thousand|billion)/gi, // Large numbers
    /\d+\s*(?:x|times)/gi                   // Multipliers
  ];
  
  metricPatterns.forEach(pattern => {
    const matches = [...jobDescription.matchAll(pattern)];
    matches.forEach(match => {
      if (match[0]) keywords.push(match[0]);
    });
  });
  
  return keywords;
};

// Helper function to extract industry-specific terms from job description
const extractIndustryTerms = (jobDescription: string): string[] => {
  const industries = [
    'technology', 'IT', 'software', 'hardware', 'healthcare', 'medical',
    'finance', 'banking', 'investment', 'insurance', 'retail', 'e-commerce',
    'manufacturing', 'construction', 'engineering', 'education', 'teaching',
    'marketing', 'advertising', 'media', 'entertainment', 'hospitality',
    'tourism', 'food', 'beverage', 'pharmaceutical', 'biotech', 'telecom',
    'automotive', 'aerospace', 'defense', 'energy', 'oil', 'gas', 'renewable',
    'consulting', 'legal', 'real estate', 'transportation', 'logistics'
  ];
  
  const terms: string[] = [];
  
  // Check for industry terms in job description
  industries.forEach(industry => {
    if (jobDescription.toLowerCase().includes(industry.toLowerCase())) {
      terms.push(industry);
      
      // Add related terms based on industry
      switch (industry.toLowerCase()) {
        case 'technology':
        case 'it':
        case 'software':
          terms.push('agile', 'scrum', 'devops', 'cloud', 'saas', 'api', 'automation');
          break;
        case 'healthcare':
        case 'medical':
          terms.push('patient', 'clinical', 'treatment', 'care', 'health', 'medical');
          break;
        case 'finance':
        case 'banking':
        case 'investment':
          terms.push('portfolio', 'asset', 'client', 'financial', 'market', 'trading');
          break;
        case 'marketing':
        case 'advertising':
          terms.push('campaign', 'brand', 'digital', 'social media', 'content', 'seo');
          break;
        case 'manufacturing':
        case 'engineering':
          terms.push('production', 'quality', 'process', 'lean', 'six sigma', 'efficiency');
          break;
      }
    }
  });
  
  return terms;
};

// Helper function to generate achievements based on job description
const generateAchievementsFromJobDescription = (jobDescription: string, jobKeywords: string[]): string[] => {
  // Extract industry terms
  const industryTerms = extractIndustryTerms(jobDescription);
  const industry = industryTerms.length > 0 ? industryTerms[0] : 'business';
  
  // Extract metrics from job description
  const metricPatterns = [
    /\d+%/g,                                // Percentages
    /\$\d+(?:[,.]\d+)?(?:\s*[kmbt])?/gi,    // Dollar amounts
    /\d+\s*(?:million|thousand|billion)/gi, // Large numbers
  ];
  
  const jobMetrics: string[] = [];
  metricPatterns.forEach(pattern => {
    const matches = [...jobDescription.matchAll(pattern)];
    matches.forEach(match => {
      if (match[0]) jobMetrics.push(match[0].toLowerCase());
    });
  });
  
  // Default metrics if none found in job description
  const defaultMetrics = ['25%', '30%', '$100K', '40%', '15%', '20%'];
  
  // Templates for achievements with placeholders
  const templates = [
    "Increased {keyword} efficiency by {metric} through implementation of streamlined processes",
    "Reduced {keyword} costs by {metric} while maintaining quality standards",
    "Improved {keyword} performance by {metric} through strategic optimization initiatives",
    "Generated {revenue} in additional revenue through innovative {keyword} strategies",
    "Led a team of {number} professionals in {keyword}, resulting in {metric} growth",
    "Successfully delivered {number} {keyword} projects under budget, saving approximately {metric}",
    "Managed a {keyword} budget of {budget}, achieving {metric} ROI",
    "Implemented new {keyword} system that increased productivity by {metric}",
    "Spearheaded {keyword} initiative that resulted in {metric} client satisfaction improvement",
    "Developed {keyword} strategy that expanded market reach by {metric}"
  ];
  
  // Generate 3-5 achievements
  const achievements: string[] = [];
  const usedTemplates = new Set<number>();
  const usedKeywords = new Set<string>();
  
  // Use job keywords or default to industry terms
  const keywords = jobKeywords.length > 0 ? jobKeywords : 
                  industryTerms.length > 0 ? industryTerms : 
                  ['business', 'project', 'operational', 'team', 'customer'];
  
  // Generate up to 5 achievements
  while (achievements.length < 5 && usedTemplates.size < templates.length) {
    // Select a random template that hasn't been used yet
    let templateIndex: number;
    do {
      templateIndex = Math.floor(Math.random() * templates.length);
    } while (usedTemplates.has(templateIndex));
    
    usedTemplates.add(templateIndex);
    const template = templates[templateIndex];
    
    // Select a keyword that hasn't been used yet if possible
    let keyword: string;
    const availableKeywords = keywords.filter(k => !usedKeywords.has(k));
    
    if (availableKeywords.length > 0) {
      keyword = availableKeywords[Math.floor(Math.random() * availableKeywords.length)];
      usedKeywords.add(keyword);
    } else {
      // If all keywords have been used, just pick a random one
      keyword = keywords[Math.floor(Math.random() * keywords.length)];
    }
    
    // Select a metric
    const metric = jobMetrics.length > 0 ? 
                  jobMetrics[Math.floor(Math.random() * jobMetrics.length)] : 
                  defaultMetrics[Math.floor(Math.random() * defaultMetrics.length)];
    
    // Generate random values for other placeholders
    const revenue = ['$50K', '$100K', '$250K', '$500K', '$1M'][Math.floor(Math.random() * 5)];
    const number = ['5', '10', '15', '20', '25'][Math.floor(Math.random() * 5)];
    const budget = ['$100K', '$250K', '$500K', '$1M', '$2M'][Math.floor(Math.random() * 5)];
    
    // Replace placeholders in template
    let achievement = template
      .replace('{keyword}', keyword)
      .replace('{metric}', metric)
      .replace('{revenue}', revenue)
      .replace('{number}', number)
      .replace('{budget}', budget);
    
    achievements.push(achievement);
  }
  
  return achievements.slice(0, 3); // Return top 3 achievements
};

// Helper function to create a simple hash from a string
const hashString = (str: string): number => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
};

const extractGoals = (text: string): string[] => {
  // Try multiple patterns to find career goals section
  const goalsPatterns = [
    /(?:goals|objectives|targets|career goals|professional goals|career objectives|aspirations)[:\s]+(.*?)(?=\n\s*\n|\n(?:[A-Z][a-z]+\s*(?:&\s*)?)+:|\n\s*$)/is,
    /(?:career summary|professional summary)[:\s]+(.*?)(?=\n\s*\n|\n(?:[A-Z][a-z]+\s*(?:&\s*)?)+:|\n\s*$)/is,
    /(?:career interests|professional interests)[:\s]+(.*?)(?=\n\s*\n|\n(?:[A-Z][a-z]+\s*(?:&\s*)?)+:|\n\s*$)/is
  ];
  
  // Try each pattern until we find a match
  for (const pattern of goalsPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      return match[1]
        .split(/\n/)
        .map(goal => goal.replace(/^[•\-\*\+\>\·\♦\■\□\◆\◇\○\●\★\☆]\s*/, '').trim())
        .filter(goal => goal.length > 0);
    }
  }
  
  // If no dedicated goals section, try to extract goals from profile/summary section
  const profilePatterns = [
    /(?:profile|summary|about me|professional summary)[:\s]+(.*?)(?=\n\s*\n|\n(?:[A-Z][a-z]+\s*(?:&\s*)?)+:|\n\s*$)/is
  ];
  
  for (const pattern of profilePatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const profileText = match[1];
      
      // Look for goal-related statements in the profile
      const goalIndicators = [
        /(?:seeking|looking for|aiming for|goal is|aspire|aspiring|pursuing|desire to|interested in|passion for|committed to)/i,
        /(?:next step|next role|career growth|career advancement|professional development|long-term goal)/i
      ];
      
      // Split profile into sentences
      const sentences = profileText.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 0);
      
      // Filter sentences that look like goals
      const goalSentences = sentences.filter(sentence => 
        goalIndicators.some(indicator => indicator.test(sentence))
      );
      
      if (goalSentences.length > 0) {
        return goalSentences;
      }
    }
  }
  
  return [];
};

const optimizeGoals = (goals: string[], jobDescription: string, jobKeywords: string[]): string[] => {
  // If no goals provided, generate some based on job description
  if (goals.length === 0) {
    // Extract career path or growth opportunities from job description
    const careerPatterns = [
      /(?:career path|growth opportunities|advancement|progression)[:\s]+([^.]+)/gi,
      /(?:opportunity to|chance to|ability to)[:\s]+([^.]+)/gi,
      /(?:looking for candidates who|seeking individuals who)[:\s]+([^.]+)/gi,
      /(?:ideal candidate will|successful candidate will)[:\s]+([^.]+)/gi,
      /(?:you will|responsibilities include|role involves)[:\s]+([^.]+)/gi
    ];
    
    let careerOpportunities: string[] = [];
    careerPatterns.forEach(pattern => {
      const matches = [...jobDescription.matchAll(pattern)];
      matches.forEach(match => {
        if (match[1]) {
          careerOpportunities.push(match[1].trim());
        }
      });
    });
    
    // Extract company values or mission statements
    const companyValuePatterns = [
      /(?:our mission|our vision|our values|we value|we believe|company culture)[:\s]+([^.]+)/gi,
      /(?:we are|our team is|our company is)[:\s]+([^.]+)/gi
    ];
    
    let companyValues: string[] = [];
    companyValuePatterns.forEach(pattern => {
      const matches = [...jobDescription.matchAll(pattern)];
      matches.forEach(match => {
        if (match[1]) {
          companyValues.push(match[1].trim());
        }
      });
    });
    
    // Generate goals based on career opportunities, company values, or job keywords
    const generatedGoals: string[] = [];
    
    // Goal based on job title and skills
    if (jobKeywords.length >= 2) {
      generatedGoals.push(`To leverage my expertise in ${jobKeywords.slice(0, 2).join(' and ')} to excel in this role and contribute to organizational success`);
    }
    
    // Goal based on career opportunities
    if (careerOpportunities.length > 0) {
      generatedGoals.push(`To pursue opportunities to ${careerOpportunities[0].toLowerCase()}`);
    }
    
    // Goal based on company values
    if (companyValues.length > 0) {
      generatedGoals.push(`To work in an environment that values ${companyValues[0].toLowerCase()}`);
    }
    
    // Goal based on professional development
    if (jobKeywords.length >= 4) {
      generatedGoals.push(`To continuously develop and enhance my skills in ${jobKeywords.slice(2, 4).join(' and ')}`);
    }
    
    // Goal based on long-term career advancement
    generatedGoals.push(`To grow professionally in a role that offers increasing responsibility and challenges`);
    
    // Return the generated goals, ensuring we have at least 3
    return generatedGoals.slice(0, Math.min(3, generatedGoals.length));
  }
  
  // If goals exist, optimize them to align with job description
  const optimizedGoals = goals.map(goal => {
    // Check if goal already aligns with job keywords
    const goalLower = goal.toLowerCase();
    const alignedWithKeywords = jobKeywords.some(keyword => 
      goalLower.includes(keyword.toLowerCase())
    );
    
    // If already aligned, return as is
    if (alignedWithKeywords) {
      return goal;
    }
    
    // Otherwise, enhance the goal with relevant keywords
    const relevantKeywords = jobKeywords.filter(keyword => 
      !goalLower.includes(keyword.toLowerCase())
    ).slice(0, 2);
    
    if (relevantKeywords.length > 0) {
      // Check if goal ends with a period
      const needsPeriod = !goal.endsWith('.');
      
      // Add keywords in a natural way
      let enhancedGoal = goal;
      
      if (/to\s+[a-z]+/i.test(goal)) {
        // If goal starts with "To ...", add keywords at the end
        enhancedGoal += ` with focus on ${relevantKeywords.join(' and ')}`;
      } else if (/ing\b/.test(goal)) {
        // If goal contains a gerund (ing form), add keywords after it
        enhancedGoal += ` in ${relevantKeywords.join(' and ')}`;
      } else {
        // Otherwise, add keywords in a generic way
        enhancedGoal += ` to develop expertise in ${relevantKeywords.join(' and ')}`;
      }
      
      // Add period if needed
      if (needsPeriod) {
        enhancedGoal += '.';
      }
      
      return enhancedGoal;
    }
    
    return goal;
  });
  
  // Ensure we have at most 3 goals
  return optimizedGoals.slice(0, 3);
};

const extractLanguages = (text: string): string[] => {
  // Try multiple patterns to find languages section
  const languagePatterns = [
    /(?:languages|language skills|fluent in|proficient in|spoken languages)[:\s]+(.*?)(?=\n\s*\n|\n(?:[A-Z][a-z]+\s*(?:&\s*)?)+:|\n\s*$)/is,
    /(?:language proficiency|multilingual|bilingual|foreign languages)[:\s]+(.*?)(?=\n\s*\n|\n(?:[A-Z][a-z]+\s*(?:&\s*)?)+:|\n\s*$)/is,
    /(?:languages?|language\s+skills?|language\s+proficiency)[:\s]+(.*?)(?=\n\s*\n|\n(?:[A-Z][a-z]+\s*(?:&\s*)?)+:|\n\s*$)/is
  ];
  
  // Common languages to look for
  const commonLanguages = [
    'English', 'Spanish', 'French', 'German', 'Italian', 'Portuguese', 'Russian', 
    'Chinese', 'Japanese', 'Korean', 'Arabic', 'Hindi', 'Dutch', 'Swedish', 'Norwegian',
    'Danish', 'Finnish', 'Polish', 'Czech', 'Greek', 'Turkish', 'Hebrew', 'Thai', 
    'Vietnamese', 'Indonesian', 'Malay', 'Tagalog', 'Swahili', 'Mandarin', 'Cantonese',
    'Bengali', 'Urdu', 'Punjabi', 'Persian', 'Farsi', 'Ukrainian', 'Romanian', 'Hungarian'
  ];
  
  // Try each pattern until we find a match
  for (const pattern of languagePatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      // Split by common separators and clean up
      return match[1]
        .split(/[,;]|\n|(?:and\s+)/)
        .map(language => {
          // Extract language and proficiency level if available
          const langMatch = language.match(/([A-Za-z]+(?:\s+[A-Za-z]+)*)(?:\s*[-:]\s*|\s+\(|\s+)(native|fluent|proficient|intermediate|beginner|basic|advanced|business|conversational|c1|c2|b1|b2|a1|a2)/i);
          
          if (langMatch) {
            return `${langMatch[1].trim()} - ${langMatch[2].trim()}`;
          }
          
          // Check if it's just a language name without proficiency
          for (const commonLang of commonLanguages) {
            if (language.trim().toLowerCase() === commonLang.toLowerCase()) {
              return `${commonLang} - Proficient`;
            }
          }
          
          return language.trim();
        })
        .filter(language => language.length > 0);
    }
  }
  
  // If no dedicated languages section, try to extract languages from profile/summary section
  const profilePatterns = [
    /(?:profile|summary|about me|professional summary)[:\s]+(.*?)(?=\n\s*\n|\n(?:[A-Z][a-z]+\s*(?:&\s*)?)+:|\n\s*$)/is
  ];
  
  // Create a regex pattern to match common languages with optional proficiency indicators
  const languageRegex = new RegExp(`\\b(${commonLanguages.join('|')})\\b(?:\\s+(?:language|speaking|fluent|proficient|native|intermediate|beginner|basic|advanced|business|conversational|c1|c2|b1|b2|a1|a2))?`, 'gi');
  
  for (const pattern of profilePatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const profileText = match[1];
      
      // Look for language mentions in the profile
      const languageMentions = [...profileText.matchAll(languageRegex)];
      
      if (languageMentions.length > 0) {
        return languageMentions.map(mention => {
          const language = mention[1];
          // Check if proficiency is mentioned
          const proficiencyMatch = profileText.toLowerCase().includes(`${language.toLowerCase()} native`) || 
                                  profileText.toLowerCase().includes(`native ${language.toLowerCase()}`) ? 'Native' :
                                  profileText.toLowerCase().includes(`${language.toLowerCase()} fluent`) || 
                                  profileText.toLowerCase().includes(`fluent ${language.toLowerCase()}`) ? 'Fluent' :
                                  profileText.toLowerCase().includes(`${language.toLowerCase()} proficient`) || 
                                  profileText.toLowerCase().includes(`proficient ${language.toLowerCase()}`) ? 'Proficient' :
                                  'Proficient'; // Default to proficient
          
          return `${language} - ${proficiencyMatch}`;
        });
      }
    }
  }
  
  // Also check skills section for language mentions
  const skillsPatterns = [
    /(?:skills|technical skills|core competencies|competencies)[:\s]+(.*?)(?=\n\s*\n|\n(?:[A-Z][a-z]+\s*(?:&\s*)?)+:|\n\s*$)/is
  ];
  
  for (const pattern of skillsPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const skillsText = match[1];
      
      // Look for language mentions in the skills section
      const languageMentions = [...skillsText.matchAll(languageRegex)];
      
      if (languageMentions.length > 0) {
        return languageMentions.map(mention => {
          const language = mention[1];
          return `${language} - Proficient`;
        });
      }
    }
  }
  
  // Check entire text for language mentions with proficiency indicators
  const fullTextLanguages: string[] = [];
  
  for (const language of commonLanguages) {
    // Look for language mentions with proficiency indicators
    const languageRegexWithProficiency = new RegExp(`\\b${language}\\b\\s+(?:language|speaking)?\\s*(?:[-:])\\s*(native|fluent|proficient|intermediate|beginner|basic|advanced|business|conversational|c1|c2|b1|b2|a1|a2)`, 'i');
    const match = text.match(languageRegexWithProficiency);
    
    if (match) {
      fullTextLanguages.push(`${language} - ${match[1].charAt(0).toUpperCase() + match[1].slice(1)}`);
    } else if (text.toLowerCase().includes(language.toLowerCase())) {
      // If language is mentioned without proficiency, check surrounding context
      const lines = text.split('\n');
      for (const line of lines) {
        if (line.toLowerCase().includes(language.toLowerCase())) {
          // Check if line contains proficiency indicators
          const proficiencyMatch = line.match(/(native|fluent|proficient|intermediate|beginner|basic|advanced|business|conversational|c1|c2|b1|b2|a1|a2)/i);
          
          if (proficiencyMatch) {
            fullTextLanguages.push(`${language} - ${proficiencyMatch[1].charAt(0).toUpperCase() + proficiencyMatch[1].slice(1)}`);
            break;
          }
        }
      }
    }
  }
  
  if (fullTextLanguages.length > 0) {
    return fullTextLanguages;
  }
  
  return [];
};

const optimizeLanguages = (languages: string[], jobDescription: string): string[] => {
  if (languages.length === 0) {
    // If no languages found, check if job description mentions language requirements
    const jobLanguageRequirements = extractLanguageRequirementsFromJob(jobDescription);
    if (jobLanguageRequirements.length > 0) {
      // Return job-required languages with default proficiency
      return jobLanguageRequirements.map(lang => `${lang} - Proficient`);
    }
    return [];
  }
  
  // Standardize language proficiency levels
  const standardizedLanguages = languages.map(language => {
    // Check if language already has a proficiency level
    const proficiencyMatch = language.match(/([A-Za-z]+(?:\s+[A-Za-z]+)*)(?:\s*[-:]\s*|\s+\(|\s+)(native|fluent|proficient|intermediate|beginner|basic|advanced|business|conversational|c1|c2|b1|b2|a1|a2)/i);
    
    if (proficiencyMatch) {
      const lang = proficiencyMatch[1].trim();
      let level = proficiencyMatch[2].toLowerCase().trim();
      
      // Standardize proficiency levels
      if (['native', 'mother tongue', 'first language', 'c2'].includes(level)) {
        level = 'Native';
      } else if (['fluent', 'advanced', 'business', 'c1'].includes(level)) {
        level = 'Fluent';
      } else if (['proficient', 'professional', 'b2'].includes(level)) {
        level = 'Proficient';
      } else if (['intermediate', 'conversational', 'b1'].includes(level)) {
        level = 'Intermediate';
      } else if (['beginner', 'basic', 'elementary', 'a2', 'a1'].includes(level)) {
        level = 'Basic';
      }
      
      return `${lang} - ${level}`;
    }
    
    // If no proficiency level, assume proficient
    return `${language} - Proficient`;
  });
  
  // Extract language requirements from job description
  const jobLanguageRequirements = extractLanguageRequirementsFromJob(jobDescription);
  
  // Prioritize languages mentioned in job description
  const prioritizedLanguages = [...standardizedLanguages];
  prioritizedLanguages.sort((a, b) => {
    const langA = a.split('-')[0].trim().toLowerCase();
    const langB = b.split('-')[0].trim().toLowerCase();
    
    const aInJobDesc = jobLanguageRequirements.some(lang => lang.toLowerCase() === langA);
    const bInJobDesc = jobLanguageRequirements.some(lang => lang.toLowerCase() === langB);
    
    if (aInJobDesc && !bInJobDesc) return -1;
    if (!aInJobDesc && bInJobDesc) return 1;
    
    // If both or neither are in job description, prioritize by proficiency level
    const levelA = a.split('-')[1]?.trim().toLowerCase() || '';
    const levelB = b.split('-')[1]?.trim().toLowerCase() || '';
    
    const proficiencyOrder = ['native', 'fluent', 'proficient', 'intermediate', 'basic'];
    const aIndex = proficiencyOrder.indexOf(levelA);
    const bIndex = proficiencyOrder.indexOf(levelB);
    
    return aIndex - bIndex;
  });
  
  // Add any job-required languages that aren't already in the list
  jobLanguageRequirements.forEach(jobLang => {
    const jobLangLower = jobLang.toLowerCase();
    const exists = prioritizedLanguages.some(lang => 
      lang.split('-')[0].trim().toLowerCase() === jobLangLower
    );
    
    if (!exists) {
      prioritizedLanguages.push(`${jobLang} - Proficient`);
    }
  });
  
  return prioritizedLanguages;
};

// Helper function to extract language requirements from job description
const extractLanguageRequirementsFromJob = (jobDescription: string): string[] => {
  const commonLanguages = [
    'English', 'Spanish', 'French', 'German', 'Italian', 'Portuguese', 'Russian', 
    'Chinese', 'Japanese', 'Korean', 'Arabic', 'Hindi', 'Dutch', 'Swedish', 'Norwegian',
    'Danish', 'Finnish', 'Polish', 'Czech', 'Greek', 'Turkish', 'Hebrew', 'Thai', 
    'Vietnamese', 'Indonesian', 'Malay', 'Tagalog', 'Swahili', 'Mandarin', 'Cantonese'
  ];
  
  const languageRequirements: string[] = [];
  
  // Look for explicit language requirements
  const languagePatterns = [
    /(?:language|languages|fluent|proficient|speak|written|oral)\s+(?:in\s+)?([A-Za-z]+(?:\s+[A-Za-z]+)*)/gi,
    /([A-Za-z]+(?:\s+[A-Za-z]+)*)\s+(?:language|speaking)/gi,
    /(?:bilingual|multilingual)\s+(?:in\s+)?([A-Za-z]+(?:\s+[A-Za-z]+)*)/gi
  ];
  
  for (const pattern of languagePatterns) {
    const matches = [...jobDescription.matchAll(pattern)];
    for (const match of matches) {
      const language = match[1].trim();
      
      // Check if it's a common language
      const isCommonLanguage = commonLanguages.some(lang => 
        language.toLowerCase() === lang.toLowerCase()
      );
      
      if (isCommonLanguage && !languageRequirements.includes(language)) {
        languageRequirements.push(language);
      }
    }
  }
  
  // Also check for direct mentions of common languages
  for (const language of commonLanguages) {
    const languageRegex = new RegExp(`\\b${language}\\b`, 'i');
    if (languageRegex.test(jobDescription) && !languageRequirements.includes(language)) {
      languageRequirements.push(language);
    }
  }
  
  return languageRequirements;
};

const optimizeSkills = (
  technicalSkills: string[], 
  professionalSkills: string[], 
  jobDescription: string, 
  jobKeywords: string[]
): { technical: string[]; professional: string[] } => {
  // Extract technical skill requirements from job description
  const technicalRequirements: string[] = [];
  const technicalPatterns = [
    /(?:technical skills|technical requirements|technical qualifications)[:\s]+([^.]+)/gi,
    /(?:proficient in|experience with|knowledge of|familiarity with)[:\s]+([^.]+)/gi,
    /(?:technologies|tools|platforms|software|programming languages)[:\s]+([^.]+)/gi
  ];
  
  technicalPatterns.forEach(pattern => {
    const matches = [...jobDescription.matchAll(pattern)];
    matches.forEach(match => {
      if (match[1]) {
        // Split by common separators and add to requirements
        match[1].split(/[,;]|\band\b/).forEach(skill => {
          const trimmedSkill = skill.trim();
          if (trimmedSkill && !technicalRequirements.includes(trimmedSkill)) {
            technicalRequirements.push(trimmedSkill);
          }
        });
      }
    });
  });
  
  // Extract professional skill requirements from job description
  const professionalRequirements: string[] = [];
  const professionalPatterns = [
    /(?:soft skills|interpersonal skills|communication skills)[:\s]+([^.]+)/gi,
    /(?:ability to|capable of|skilled in)[:\s]+([^.]+)/gi,
    /(?:team player|team work|collaborate|communicate)[:\s]+([^.]+)/gi
  ];
  
  professionalPatterns.forEach(pattern => {
    const matches = [...jobDescription.matchAll(pattern)];
    matches.forEach(match => {
      if (match[1]) {
        // Split by common separators and add to requirements
        match[1].split(/[,;]|\band\b/).forEach(skill => {
          const trimmedSkill = skill.trim();
          if (trimmedSkill && !professionalRequirements.includes(trimmedSkill)) {
            professionalRequirements.push(trimmedSkill);
          }
        });
      }
    });
  });
  
  // If no specific requirements found, use job keywords
  if (technicalRequirements.length === 0) {
    technicalRequirements.push(...jobKeywords.filter(keyword => 
      !professionalRequirements.some(req => req.includes(keyword))
    ));
  }
  
  // Optimize technical skills
  let optimizedTechnical = [...technicalSkills];
  
  // Add missing technical skills from requirements (if any)
  technicalRequirements.forEach(req => {
    const hasMatchingSkill = optimizedTechnical.some(skill => 
      skill.toLowerCase().includes(req.toLowerCase()) || 
      req.toLowerCase().includes(skill.toLowerCase())
    );
    
    if (!hasMatchingSkill) {
      optimizedTechnical.push(req);
    }
  });
  
  // Optimize professional skills
  let optimizedProfessional = [...professionalSkills];
  
  // Add missing professional skills from requirements (if any)
  professionalRequirements.forEach(req => {
    const hasMatchingSkill = optimizedProfessional.some(skill => 
      skill.toLowerCase().includes(req.toLowerCase()) || 
      req.toLowerCase().includes(skill.toLowerCase())
    );
    
    if (!hasMatchingSkill) {
      optimizedProfessional.push(req);
    }
  });
  
  // Sort skills by relevance to job description
  optimizedTechnical.sort((a, b) => {
    const aRelevance = jobKeywords.filter(keyword => 
      a.toLowerCase().includes(keyword.toLowerCase())
    ).length;
    
    const bRelevance = jobKeywords.filter(keyword => 
      b.toLowerCase().includes(keyword.toLowerCase())
    ).length;
    
    return bRelevance - aRelevance;
  });
  
  optimizedProfessional.sort((a, b) => {
    const aRelevance = jobKeywords.filter(keyword => 
      a.toLowerCase().includes(keyword.toLowerCase())
    ).length;
    
    const bRelevance = jobKeywords.filter(keyword => 
      b.toLowerCase().includes(keyword.toLowerCase())
    ).length;
    
    return bRelevance - aRelevance;
  });
  
  return {
    technical: optimizedTechnical,
    professional: optimizedProfessional
  };
};

const optimizeEducation = (education: EducationEntry[], jobDescription: string, jobKeywords: string[]): EducationEntry[] => {
  if (education.length === 0) {
    return [];
  }
  
  // Extract education requirements from job description
  const educationRequirements = extractEducationRequirementsFromJob(jobDescription);
  
  // Score each education entry based on relevance to job
  const scoredEducation = education.map(entry => {
    let score = 0;
    
    // Check if degree matches job requirements
    if (entry.degree) {
      // Check for degree level match
      const degreeLevel = getDegreeLevel(entry.degree);
      const requiredLevel = getRequiredDegreeLevel(jobDescription);
      
      // Score based on degree level match
      if (degreeLevel >= requiredLevel) {
        // Bonus for exceeding required level, but not too much
        score += 20 + Math.min(10, (degreeLevel - requiredLevel) * 5);
      } else {
        // Penalty for not meeting required level
        score -= (requiredLevel - degreeLevel) * 10;
      }
      
      // Check for specific degree field match
      for (const requirement of educationRequirements) {
        if (entry.degree.toLowerCase().includes(requirement.toLowerCase())) {
          score += 25;
          break;
        }
      }
      
      // Check for keyword matches in degree
      const keywordMatches = jobKeywords.filter(keyword => 
        entry.degree.toLowerCase().includes(keyword.toLowerCase())
      ).length;
      
      score += keywordMatches * 5;
    }
    
    // Check if institution is mentioned in job description
    if (entry.institution) {
      if (jobDescription.toLowerCase().includes(entry.institution.toLowerCase())) {
        score += 15;
      }
      
      // Bonus for prestigious institutions
      const prestigiousInstitutions = [
        'harvard', 'stanford', 'mit', 'yale', 'princeton', 'oxford',
        'cambridge', 'caltech', 'berkeley', 'columbia', 'chicago', 'penn'
      ];
      
      if (prestigiousInstitutions.some(name => 
        entry.institution!.toLowerCase().includes(name)
      )) {
        score += 10;
      }
    }
    
    // Check for recency of education
    if (entry.year) {
      const yearMatch = entry.year.match(/(\d{4})/g);
      if (yearMatch) {
        const years = yearMatch.map(y => parseInt(y));
        const mostRecentYear = Math.max(...years);
        const currentYear = new Date().getFullYear();
        const yearsAgo = currentYear - mostRecentYear;
        
        // More recent education gets higher score
        if (yearsAgo <= 3) {
          score += 15;
        } else if (yearsAgo <= 7) {
          score += 10;
        } else if (yearsAgo <= 15) {
          score += 5;
        }
      }
    }
    
    // Bonus for high GPA
    if (entry.gpa) {
      const gpaValue = parseFloat(entry.gpa);
      if (gpaValue >= 3.7) {
        score += 15;
      } else if (gpaValue >= 3.5) {
        score += 10;
      } else if (gpaValue >= 3.0) {
        score += 5;
      }
    }
    
    // Bonus for relevant courses that match job keywords
    if (entry.relevantCourses && entry.relevantCourses.length > 0) {
      const relevantCourseMatches = entry.relevantCourses.filter(course => 
        jobKeywords.some(keyword => course.toLowerCase().includes(keyword.toLowerCase()))
      ).length;
      
      score += relevantCourseMatches * 5;
    }
    
    // Bonus for achievements that match job keywords
    if (entry.achievements && entry.achievements.length > 0) {
      const relevantAchievementMatches = entry.achievements.filter(achievement => 
        jobKeywords.some(keyword => achievement.toLowerCase().includes(keyword.toLowerCase()))
      ).length;
      
      score += relevantAchievementMatches * 5;
    }
    
    return { entry, score };
  });
  
  // Sort by score and return entries
  return scoredEducation
    .sort((a, b) => b.score - a.score)
    .map(({ entry }) => {
      // Enhance entry with relevant courses that match job keywords
      if (entry.relevantCourses && entry.relevantCourses.length > 0) {
        // Prioritize courses that match job keywords
        entry.relevantCourses.sort((a, b) => {
          const aMatches = jobKeywords.some(keyword => a.toLowerCase().includes(keyword.toLowerCase()));
          const bMatches = jobKeywords.some(keyword => b.toLowerCase().includes(keyword.toLowerCase()));
          
          if (aMatches && !bMatches) return -1;
          if (!aMatches && bMatches) return 1;
          return 0;
        });
        
        // Limit to top 5 most relevant courses
        entry.relevantCourses = entry.relevantCourses.slice(0, 5);
      }
      
      // Enhance entry with achievements that match job keywords
      if (entry.achievements && entry.achievements.length > 0) {
        // Prioritize achievements that match job keywords
        entry.achievements.sort((a, b) => {
          const aMatches = jobKeywords.some(keyword => a.toLowerCase().includes(keyword.toLowerCase()));
          const bMatches = jobKeywords.some(keyword => b.toLowerCase().includes(keyword.toLowerCase()));
          
          if (aMatches && !bMatches) return -1;
          if (!aMatches && bMatches) return 1;
          return 0;
        });
        
        // Limit to top 3 most relevant achievements
        entry.achievements = entry.achievements.slice(0, 3);
      }
      
      return entry;
    });
};

// Helper function to extract education requirements from job description
const extractEducationRequirementsFromJob = (jobDescription: string): string[] => {
  const requirements: string[] = [];
  
  // Look for degree requirements
  const degreePatterns = [
    /(?:degree|diploma|certificate)\s+(?:in|of)\s+([^.,]+)/gi,
    /(?:bachelor|master|phd|doctorate|mba|bsc|ba|ma|ms|msc|bba|llb|md)(?:'s)?\s+(?:degree|diploma|certificate)?\s+(?:in|of)?\s+([^.,]+)/gi,
    /(?:background|education|qualification)\s+(?:in|with)\s+([^.,]+)/gi
  ];
  
  for (const pattern of degreePatterns) {
    const matches = [...jobDescription.matchAll(pattern)];
    for (const match of matches) {
      if (match[1]) {
        requirements.push(match[1].trim());
      }
    }
  }
  
  // Look for specific fields of study
  const fieldPatterns = [
    /(?:study|studied|studies|major|majored)\s+(?:in|of)\s+([^.,]+)/gi,
    /(?:background|knowledge)\s+(?:in|of)\s+([^.,]+)/gi
  ];
  
  for (const pattern of fieldPatterns) {
    const matches = [...jobDescription.matchAll(pattern)];
    for (const match of matches) {
      if (match[1]) {
        requirements.push(match[1].trim());
      }
    }
  }
  
  // Common fields of study
  const commonFields = [
    'computer science', 'information technology', 'software engineering',
    'business administration', 'marketing', 'finance', 'accounting',
    'engineering', 'mechanical engineering', 'electrical engineering',
    'civil engineering', 'data science', 'mathematics', 'statistics',
    'economics', 'psychology', 'biology', 'chemistry', 'physics',
    'communications', 'journalism', 'english', 'history', 'political science',
    'international relations', 'law', 'medicine', 'nursing', 'pharmacy',
    'education', 'human resources', 'graphic design', 'architecture'
  ];
  
  // Check for common fields in job description
  for (const field of commonFields) {
    if (jobDescription.toLowerCase().includes(field)) {
      requirements.push(field);
    }
  }
  
  return [...new Set(requirements)]; // Remove duplicates
};

// Helper function to get degree level (0-4)
const getDegreeLevel = (degree: string): number => {
  const lowerDegree = degree.toLowerCase();
  
  if (lowerDegree.includes('phd') || 
      lowerDegree.includes('doctorate') || 
      lowerDegree.includes('doctoral')) {
    return 4;
  }
  
  if (lowerDegree.includes('master') || 
      lowerDegree.includes('mba') || 
      lowerDegree.includes('ms') || 
      lowerDegree.includes('ma') || 
      lowerDegree.includes('msc')) {
    return 3;
  }
  
  if (lowerDegree.includes('bachelor') || 
      lowerDegree.includes('ba') || 
      lowerDegree.includes('bs') || 
      lowerDegree.includes('bsc') || 
      lowerDegree.includes('bba') || 
      lowerDegree.includes('llb')) {
    return 2;
  }
  
  if (lowerDegree.includes('associate') || 
      lowerDegree.includes('diploma') || 
      lowerDegree.includes('certificate')) {
    return 1;
  }
  
  return 0; // Unknown or no degree
};

// Helper function to get required degree level from job description (0-4)
const getRequiredDegreeLevel = (jobDescription: string): number => {
  const lowerDesc = jobDescription.toLowerCase();
  
  // Check for PhD requirement
  if ((lowerDesc.includes('phd') || 
       lowerDesc.includes('doctorate') || 
       lowerDesc.includes('doctoral')) && 
      (lowerDesc.includes('required') || 
       lowerDesc.includes('requirement') || 
       lowerDesc.includes('must have'))) {
    return 4;
  }
  
  // Check for Master's requirement
  if ((lowerDesc.includes('master') || 
       lowerDesc.includes('mba') || 
       lowerDesc.includes('ms') || 
       lowerDesc.includes('ma') || 
       lowerDesc.includes('msc')) && 
      (lowerDesc.includes('required') || 
       lowerDesc.includes('requirement') || 
       lowerDesc.includes('must have'))) {
    return 3;
  }
  
  // Check for Bachelor's requirement
  if ((lowerDesc.includes('bachelor') || 
       lowerDesc.includes('ba') || 
       lowerDesc.includes('bs') || 
       lowerDesc.includes('bsc') || 
       lowerDesc.includes('undergraduate') || 
       lowerDesc.includes('college degree')) && 
      (lowerDesc.includes('required') || 
       lowerDesc.includes('requirement') || 
       lowerDesc.includes('must have'))) {
    return 2;
  }
  
  // Check for Associate's requirement
  if ((lowerDesc.includes('associate') || 
       lowerDesc.includes('diploma') || 
       lowerDesc.includes('certificate')) && 
      (lowerDesc.includes('required') || 
       lowerDesc.includes('requirement') || 
       lowerDesc.includes('must have'))) {
    return 1;
  }
  
  // Check for preferred but not required higher education
  if (lowerDesc.includes('phd') || lowerDesc.includes('doctorate')) {
    return 3; // Prefer PhD but might accept Master's
  }
  
  if (lowerDesc.includes('master') || lowerDesc.includes('mba') || 
      lowerDesc.includes('ms') || lowerDesc.includes('ma')) {
    return 2; // Prefer Master's but might accept Bachelor's
  }
  
  if (lowerDesc.includes('bachelor') || lowerDesc.includes('ba') || 
      lowerDesc.includes('bs') || lowerDesc.includes('bsc') || 
      lowerDesc.includes('undergraduate') || lowerDesc.includes('college degree')) {
    return 1; // Prefer Bachelor's but might accept less
  }
  
  return 0; // No specific education requirement mentioned
};

// Add generateOptimizedDocument function
const generateOptimizedDocument = async (content: string, name: string = 'CV', contactInfo?: StructuredCV['contactInfo'], structuredCV?: StructuredCV): Promise<Document> => {
  // Define brand color
  const brandColor = 'B4916C';
  
  // Get current date for footer
  const currentDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
  
  // Parse content into sections if structuredCV is not provided
  let sections: any = {};
  if (!structuredCV) {
    // Split content by section headers
    const sectionRegex = /^([A-Z][A-Z\s]+):\s*$/gm;
    const lines = content.split('\n');
    let currentSection = '';
    let sectionContent: string[] = [];
    
    // Define section order
    const sectionOrder = ['PROFILE', 'SKILLS', 'TECHNICAL SKILLS', 'PROFESSIONAL SKILLS', 'EXPERIENCE', 'EDUCATION', 'ACHIEVEMENTS', 'CAREER GOALS', 'LANGUAGES', 'REFERENCES'];
    
    // Initialize sections object
    sectionOrder.forEach(section => {
      sections[section] = [];
    });
    
    // Extract header (first few lines)
    let headerLines: string[] = [];
    let i = 0;
    while (i < lines.length && headerLines.length < 3) {
      const line = lines[i].trim();
      if (line && !line.match(sectionRegex)) {
        headerLines.push(line);
      } else {
        break;
      }
      i++;
    }
    
    // Process remaining lines
    for (; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      // Check if this is a section header
      const sectionMatch = line.match(/^([A-Z][A-Z\s]+):?\s*$/);
      if (sectionMatch) {
        currentSection = sectionMatch[1].trim();
        continue;
      }
      
      // Add content to current section
      if (currentSection && sections[currentSection] !== undefined) {
        sections[currentSection].push(line);
      }
    }
  } else {
    // Use the provided structuredCV
    sections = {
      'PROFILE': structuredCV.profile ? [structuredCV.profile] : [],
      'SKILLS': [],
      'TECHNICAL SKILLS': structuredCV.skills?.technical || [],
      'PROFESSIONAL SKILLS': structuredCV.skills?.professional || [],
      'EXPERIENCE': structuredCV.experience || [],
      'EDUCATION': structuredCV.education || [],
      'ACHIEVEMENTS': structuredCV.achievements || [],
      'CAREER GOALS': structuredCV.goals || [],
      'LANGUAGES': structuredCV.languages || []
    };
  }
  
  // Section icons (using Unicode characters)
  const sectionIcons = {
    'PROFILE': '👤',
    'SKILLS': '🔧',
    'TECHNICAL SKILLS': '💻',
    'PROFESSIONAL SKILLS': '📊',
    'EXPERIENCE': '💼',
    'EDUCATION': '🎓',
    'ACHIEVEMENTS': '🏆',
    'CAREER GOALS': '🎯',
    'LANGUAGES': '🌐',
    'REFERENCES': '📋'
  };
  
  // Create document
  const doc = new Document({
    sections: [{
      properties: {
        page: {
          margin: {
            top: 1000,
            right: 1000,
            bottom: 1000,
            left: 1000
          }
        }
      },
      children: [
        // Title
        new Paragraph({
          text: name,
          heading: HeadingLevel.HEADING_1,
          spacing: {
            after: 200
          },
          alignment: AlignmentType.CENTER,
          style: 'Title'
        }),
        
        // Contact information if available
        ...(contactInfo ? [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: {
              after: 200
            },
            children: [
              ...(contactInfo.email ? [
                new TextRun({
                  text: contactInfo.email,
                  style: 'ContactInfo'
                }),
                new TextRun({
                  text: ' | ',
                  style: 'ContactSeparator'
                })
              ] : []),
              ...(contactInfo.phone ? [
                new TextRun({
                  text: contactInfo.phone,
                  style: 'ContactInfo'
                }),
                new TextRun({
                  text: ' | ',
                  style: 'ContactSeparator'
                })
              ] : []),
              ...(contactInfo.location ? [
                new TextRun({
                  text: contactInfo.location,
                  style: 'ContactInfo'
                }),
                ...(contactInfo.linkedin || contactInfo.website ? [
                  new TextRun({
                    text: ' | ',
                    style: 'ContactSeparator'
                  })
                ] : [])
              ] : []),
              ...(contactInfo.linkedin ? [
                new TextRun({
                  text: contactInfo.linkedin,
                  style: 'ContactInfo'
                }),
                ...(contactInfo.website ? [
                  new TextRun({
                    text: ' | ',
                    style: 'ContactSeparator'
                  })
                ] : [])
              ] : []),
              ...(contactInfo.website ? [
                new TextRun({
                  text: contactInfo.website,
                  style: 'ContactInfo'
                })
              ] : [])
            ]
          })
        ] : []),
        
        // Add a horizontal line after header
        new Paragraph({
          children: [
            new TextRun({
              text: '',
              size: 16
            })
          ],
          border: {
            bottom: {
              color: brandColor,
              space: 1,
              style: BorderStyle.SINGLE,
              size: 8
            }
          },
          spacing: {
            after: 300
          }
        }),
        
        // Profile section
        ...(sections['PROFILE'] && sections['PROFILE'].length > 0 ? [
          new Paragraph({
            children: [
              new TextRun({
                text: `${sectionIcons['PROFILE']} Profile`,
                size: 28,
                bold: true,
                color: brandColor
              })
            ],
            spacing: {
              before: 400,
              after: 200
            },
            border: {
              bottom: {
                color: brandColor,
                space: 1,
                style: BorderStyle.SINGLE,
                size: 6
              }
            }
          }),
          ...sections['PROFILE'].map((paragraph: string) => 
            new Paragraph({
              text: paragraph,
              spacing: {
                before: 100,
                after: 100
              }
            })
          )
        ] : []),
        
        // Skills section
        ...((sections['TECHNICAL SKILLS'] && sections['TECHNICAL SKILLS'].length > 0) || 
           (sections['PROFESSIONAL SKILLS'] && sections['PROFESSIONAL SKILLS'].length > 0) ? [
          new Paragraph({
            children: [
              new TextRun({
                text: `${sectionIcons['SKILLS']} Skills`,
                size: 28,
                bold: true,
                color: brandColor
              })
            ],
            spacing: {
              before: 400,
              after: 200
            },
            border: {
              bottom: {
                color: brandColor,
                space: 1,
                style: BorderStyle.SINGLE,
                size: 6
              }
            }
          }),
          // Technical Skills
          ...(sections['TECHNICAL SKILLS'] && sections['TECHNICAL SKILLS'].length > 0 ? [
            new Paragraph({
              children: [
                new TextRun({
                  text: 'Technical Skills',
                  bold: true,
                  size: 24
                })
              ],
              spacing: {
                before: 200,
                after: 100
              }
            }),
            ...sections['TECHNICAL SKILLS'].map((skill: string) => 
              new Paragraph({
                children: [
                  new TextRun({
                    text: '• ',
                    bold: true,
                    color: brandColor
                  }),
                  new TextRun({
                    text: skill
                  })
                ],
                spacing: {
                  before: 80,
                  after: 80
                },
                indent: {
                  left: 360
                }
              })
            )
          ] : []),
          // Professional Skills
          ...(sections['PROFESSIONAL SKILLS'] && sections['PROFESSIONAL SKILLS'].length > 0 ? [
            new Paragraph({
              children: [
                new TextRun({
                  text: 'Professional Skills',
                  bold: true,
                  size: 24
                })
              ],
              spacing: {
                before: 200,
                after: 100
              }
            }),
            ...sections['PROFESSIONAL SKILLS'].map((skill: string) => 
              new Paragraph({
                children: [
                  new TextRun({
                    text: '• ',
                    bold: true,
                    color: brandColor
                  }),
                  new TextRun({
                    text: skill
                  })
                ],
                spacing: {
                  before: 80,
                  after: 80
                },
                indent: {
                  left: 360
                }
              })
            )
          ] : [])
        ] : []),
        
        // Experience section
        ...(sections['EXPERIENCE'] && sections['EXPERIENCE'].length > 0 ? [
          new Paragraph({
            children: [
              new TextRun({
                text: `${sectionIcons['EXPERIENCE']} Experience`,
                size: 28,
                bold: true,
                color: brandColor
              })
            ],
            spacing: {
              before: 400,
              after: 200
            },
            border: {
              bottom: {
                color: brandColor,
                space: 1,
                style: BorderStyle.SINGLE,
                size: 6
              }
            }
          }),
          ...(Array.isArray(sections['EXPERIENCE']) && sections['EXPERIENCE'].length > 0 ? 
            (structuredCV ? 
              // If we have structured experience data
              structuredCV.experience.map(exp => [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: exp.title || '',
                      bold: true,
                      size: 24
                    })
                  ],
                  spacing: {
                    before: 200,
                    after: 80
                  }
                }),
                new Paragraph({
                  children: [
                    new TextRun({
                      text: `${exp.startDate || ''} - ${exp.endDate || 'Present'}`,
                      italics: true,
                      size: 22,
                      color: '666666'
                    })
                  ],
                  spacing: {
                    before: 80,
                    after: 80
                  }
                })
              ]).flat() 
              : 
              // If we have unstructured experience data
              sections['EXPERIENCE'].map(line => 
                new Paragraph({
                  text: line,
                  spacing: {
                    before: 100,
                    after: 100
                  }
                })
              )
            ) : []
          )
        ] : []),
        
        // Education section
        ...(sections['EDUCATION'] && sections['EDUCATION'].length > 0 ? [
          new Paragraph({
            children: [
              new TextRun({
                text: `${sectionIcons['EDUCATION']} Education`,
                size: 28,
                bold: true,
                color: brandColor
              })
            ],
            spacing: {
              before: 400,
              after: 200
            },
            border: {
              bottom: {
                color: brandColor,
                space: 1,
                style: BorderStyle.SINGLE,
                size: 6
              }
            }
          }),
          ...(Array.isArray(sections['EDUCATION']) && sections['EDUCATION'].length > 0 ? 
            (structuredCV && structuredCV.education ? 
              // If we have structured education data
              structuredCV.education.map(edu => [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: edu.degree,
                      bold: true,
                      size: 24
                    }),
                    ...(edu.institution ? [
                      new TextRun({
                        text: `, ${edu.institution}`,
                        size: 24
                      })
                    ] : []),
                    ...(edu.location ? [
                      new TextRun({
                        text: `, ${edu.location}`,
                        size: 24,
                        italics: true
                      })
                    ] : [])
                  ],
                  spacing: {
                    before: 200,
                    after: 80
                  }
                }),
                ...(edu.year || edu.gpa ? [
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: [
                          edu.year,
                          edu.gpa ? `GPA: ${edu.gpa}` : null
                        ].filter(Boolean).join(', '),
                        italics: true,
                        size: 22,
                        color: '666666'
                      })
                    ],
                    spacing: {
                      before: 80,
                      after: 80
                    }
                  })
                ] : []),
                ...(edu.relevantCourses && edu.relevantCourses.length > 0 ? [
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: 'Relevant Courses: ',
                        bold: true,
                        size: 22
                      }),
                      new TextRun({
                        text: Array.isArray(edu.relevantCourses) ? edu.relevantCourses.join(', ') : edu.relevantCourses,
                        size: 22
                      })
                    ],
                    spacing: {
                      before: 80,
                      after: 80
                    },
                    indent: {
                      left: 360
                    }
                  })
                ] : []),
                ...(edu.achievements && edu.achievements.length > 0 ? [
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: 'Academic Achievements: ',
                        bold: true,
                        size: 22
                      })
                    ],
                    spacing: {
                      before: 80,
                      after: 40
                    },
                    indent: {
                      left: 360
                    }
                  }),
                  ...Array.isArray(edu.achievements) ? edu.achievements.map(achievement => 
                    new Paragraph({
                      children: [
                        new TextRun({
                          text: '• ',
                          bold: true,
                          color: brandColor
                        }),
                        new TextRun({
                          text: achievement,
                          ...(achievement.match(/\d+%|\d+\s*[kKmMbB]|\$\d+|increased|improved|reduced|saved|generated|delivered|achieved/) ? { bold: true } : {})
                        })
                      ],
                      spacing: {
                        before: 40,
                        after: 40
                      },
                      indent: {
                        left: 480
                      }
                    })
                  ) : []
                ] : [])
              ]).flat() 
              : 
              // If we have unstructured education data
              sections['EDUCATION'].map(line => 
                new Paragraph({
                  text: line,
                  spacing: {
                    before: 100,
                    after: 100
                  }
                })
              )
            ) : []
          )
        ] : []),
        
        // Achievements section
        ...(sections['ACHIEVEMENTS'] && sections['ACHIEVEMENTS'].length > 0 ? [
          new Paragraph({
            children: [
              new TextRun({
                text: `${sectionIcons['ACHIEVEMENTS']} Achievements`,
                size: 28,
                bold: true,
                color: brandColor
              })
            ],
            spacing: {
              before: 400,
              after: 200
            },
            border: {
              bottom: {
                color: brandColor,
                space: 1,
                style: BorderStyle.SINGLE,
                size: 6
              }
            }
          }),
          ...sections['ACHIEVEMENTS'].map((achievement: string) => 
            new Paragraph({
              children: [
                new TextRun({
                  text: '★ ',
                  bold: true,
                  color: brandColor
                }),
                new TextRun({
                  text: achievement,
                  // Make achievements with numbers/percentages bold to highlight quantifiable results
                  ...(achievement.match(/\d+%|\d+\s*[kKmMbB]|\$\d+|increased|improved|reduced|saved|generated|delivered|achieved/) ? { bold: true } : {})
                })
              ],
              spacing: {
                before: 120,
                after: 120
              },
              indent: {
                left: 360
              }
            })
          )
        ] : []),
        
        // Career Goals section
        ...(sections['CAREER GOALS'] && sections['CAREER GOALS'].length > 0 ? [
          new Paragraph({
            children: [
              new TextRun({
                text: `${sectionIcons['CAREER GOALS']} Career Goals`,
                size: 28,
                bold: true,
                color: brandColor
              })
            ],
            spacing: {
              before: 400,
              after: 200
            },
            border: {
              bottom: {
                color: brandColor,
                space: 1,
                style: BorderStyle.SINGLE,
                size: 6
              }
            }
          }),
          ...sections['CAREER GOALS'].map((goal: string) => 
            new Paragraph({
              children: [
                new TextRun({
                  text: '• ',
                  bold: true,
                  color: brandColor
                }),
                new TextRun({
                  text: goal
                })
              ],
              spacing: {
                before: 120,
                after: 120
              },
              indent: {
                left: 360
              }
            })
          )
        ] : []),
        
        // Languages section
        ...(sections['LANGUAGES'] && sections['LANGUAGES'].length > 0 ? [
          new Paragraph({
            children: [
              new TextRun({
                text: `${sectionIcons['LANGUAGES']} Languages`,
                size: 28,
                bold: true,
                color: brandColor
              })
            ],
            spacing: {
              before: 400,
              after: 200
            },
            border: {
              bottom: {
                color: brandColor,
                space: 1,
                style: BorderStyle.SINGLE,
                size: 6
              }
            }
          }),
          ...sections['LANGUAGES'].map((language: string) => {
            // Parse language string to extract proficiency if available
            const parts = language.split(/[:-]/);
            const languageName = parts[0].trim();
            const proficiency = parts.length > 1 ? parts[1].trim() : '';
            
            return new Paragraph({
              children: [
                new TextRun({
                  text: '• ',
                  bold: true,
                  color: brandColor
                }),
                new TextRun({
                  text: languageName,
                  bold: true
                }),
                ...(proficiency ? [
                  new TextRun({
                    text: ` - ${proficiency}`,
                    italics: true
                  })
                ] : [])
              ],
              spacing: {
                before: 120,
                after: 120
              },
              indent: {
                left: 360
              }
            });
          })
        ] : []),
        
        // Footer with date
        new Paragraph({
          children: [
            new TextRun({
              text: `${name} | ${currentDate}`,
              size: 18,
              color: '666666'
            })
          ],
          alignment: AlignmentType.CENTER,
          spacing: {
            before: 400
          },
          border: {
            top: {
              color: brandColor,
              space: 1,
              style: BorderStyle.SINGLE,
              size: 6
            }
          },
          pageBreakBefore: true
        })
      ]
    }],
    styles: {
      paragraphStyles: [
        {
          id: 'Title',
          name: 'Title',
          basedOn: 'Normal',
          next: 'Normal',
          run: {
            size: 36,
            bold: true,
            color: brandColor
          },
          paragraph: {
            spacing: { 
              after: 300,
              before: 300
            },
            alignment: AlignmentType.CENTER
          }
        },
        {
          id: 'ContactInfo',
          name: 'Contact Info',
          basedOn: 'Normal',
          next: 'Normal',
          run: {
            size: 20,
            color: '666666'
          }
        },
        {
          id: 'ContactSeparator',
          name: 'Contact Separator',
          basedOn: 'Normal',
          next: 'Normal',
          run: {
            size: 20,
            color: brandColor
          }
        },
        {
          id: 'SectionHeader',
          name: 'Section Header',
          basedOn: 'Normal',
          next: 'Normal',
          run: {
            size: 28,
            bold: true,
            color: brandColor
          },
          paragraph: {
            spacing: {
              before: 400,
              after: 200
            },
            border: {
              bottom: {
                color: brandColor,
                space: 1,
                style: BorderStyle.SINGLE,
                size: 6
              }
            }
          }
        },
        {
          id: 'SubsectionHeader',
          name: 'Subsection Header',
          basedOn: 'Normal',
          next: 'Normal',
          run: {
            size: 24,
            bold: true
          },
          paragraph: {
            spacing: {
              before: 200,
              after: 100
            }
          }
        },
        {
          id: 'BulletPoint',
          name: 'Bullet Point',
          basedOn: 'Normal',
          next: 'Normal',
          paragraph: {
            spacing: {
              before: 120,
              after: 120
            },
            indent: {
              left: 360
            }
          }
        }
      ]
    }
  });

  return doc;
};

export default function EnhancedSpecificOptimizationWorkflow({ cvs = [] }: EnhancedSpecificOptimizationWorkflowProps): JSX.Element {
  const [selectedCVId, setSelectedCVId] = useState<string | null>(null);
  const [selectedCVName, setSelectedCVName] = useState<string | null>(null);
  const [originalText, setOriginalText] = useState<string | null>(null);
  const [optimizedText, setOptimizedText] = useState<string | null>(null);
  const [jobDescription, setJobDescription] = useState<string>('');
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [isOptimizing, setIsOptimizing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [processingStatus, setProcessingStatus] = useState<string | null>(null);
  const [jobMatchAnalysis, setJobMatchAnalysis] = useState<JobMatchAnalysis | null>(null);
  const [isGeneratingDocument, setIsGeneratingDocument] = useState<boolean>(false);
  
  // Additional state variables for processing
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isProcessed, setIsProcessed] = useState<boolean>(false);
  const [processingProgress, setProcessingProgress] = useState<number>(0);
  const [activeTab, setActiveTab] = useState('jobDescription');
  const [processingTooLong, setProcessingTooLong] = useState<boolean>(false);

  // Add state for error messages
  const [documentError, setDocumentError] = useState<string | null>(null);

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
        const optimizedText = generateOptimizedText(originalText || '', jobDescription);
        setOptimizedText(optimizedText);
        
        // Generate structured CV
        generateStructuredCV(optimizedText, jobDescription);
        
        // Generate job match analysis on the optimized content
        const analysis = analyzeJobMatch(optimizedText, jobDescription);
        setJobMatchAnalysis(analysis);
        
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
  const generateOptimizedText = (originalText: string, jobDescription: string): string => {
    if (!originalText || !jobDescription) {
      return originalText;
    }
    
    // Extract job keywords
    const jobKeywords = extractKeywords(jobDescription, true);
    
    // Extract and optimize profile
    const profile = extractProfile(originalText);
    const optimizedProfileText = optimizeProfile(profile, jobDescription, jobKeywords);
    
    // Extract and optimize skills
    const technicalSkills = extractTechnicalSkills(originalText);
    const professionalSkills = extractProfessionalSkills(originalText);
    const optimizedSkillsData = optimizeSkills(technicalSkills, professionalSkills, jobDescription, jobKeywords);
    
    // Extract and optimize achievements
    const achievements = extractAchievements(originalText);
    const optimizedAchievements = optimizeAchievements(achievements, jobDescription, jobKeywords);
    
    // Extract and optimize goals
    const goals = extractGoals(originalText);
    const optimizedGoals = goals.length > 0 ? optimizeGoals(goals, jobDescription, jobKeywords) : [];
    
    // Extract and optimize languages
    const languages = extractLanguages(originalText);
    const optimizedLanguages = languages.length > 0 ? optimizeLanguages(languages, jobDescription) : [];
    
    // Extract and optimize education
    const education = extractEducationData(originalText);
    const optimizedEducation = education.length > 0 ? optimizeEducation(education, jobDescription, jobKeywords) : [];
    
    // Extract and optimize experience
    const experienceEntries = extractExperienceData(originalText);
    
    // Extract name and contact info for header
    const name = extractName(originalText);
    const contactInfo = extractContactInfo(originalText);
    
    // Create a well-structured optimized text with clear section headers
    let optimizedText = '';
    
    // Add header section (name and contact info)
    optimizedText += `${name}\n`;
    
    // Add contact info if available
    const contactLines = [];
    if (contactInfo.email) contactLines.push(contactInfo.email);
    if (contactInfo.phone) contactLines.push(contactInfo.phone);
    if (contactInfo.location) contactLines.push(contactInfo.location);
    if (contactInfo.linkedin) contactLines.push(contactInfo.linkedin);
    if (contactInfo.website) contactLines.push(contactInfo.website);
    
    if (contactLines.length > 0) {
      optimizedText += `${contactLines.join(' | ')}\n`;
    }
    
    optimizedText += '\n';
    
    // Add profile section with clear header
    optimizedText += `PROFILE:\n${optimizedProfileText}\n\n`;
    
    // Add skills section with clear header and subsections
    optimizedText += `SKILLS:\n`;
    
    if (optimizedSkillsData.technical.length > 0) {
      optimizedText += `Technical Skills:\n`;
      optimizedSkillsData.technical.forEach(skill => {
        optimizedText += `• ${skill}\n`;
      });
      optimizedText += '\n';
    }
    
    if (optimizedSkillsData.professional.length > 0) {
      optimizedText += `Professional Skills:\n`;
      optimizedSkillsData.professional.forEach(skill => {
        optimizedText += `• ${skill}\n`;
      });
      optimizedText += '\n';
    }
    
    // Add experience section if available in original text
    if (experienceEntries.length > 0) {
      optimizedText += `EXPERIENCE:\n`;
      experienceEntries.forEach(exp => {
        if (exp.title) optimizedText += `${exp.title}\n`;
        if (exp.startDate || exp.endDate) {
          const dateRange = `${exp.startDate || ''} - ${exp.endDate || 'Present'}`;
          optimizedText += `${dateRange}\n`;
        }
        optimizedText += '\n';
      });
    }
    
    // Add education section with clear header
    if (optimizedEducation.length > 0) {
      optimizedText += `EDUCATION:\n`;
      optimizedEducation.forEach(edu => {
        let eduLine = edu.degree;
        if (edu.institution) eduLine += `, ${edu.institution}`;
        if (edu.location) eduLine += `, ${edu.location}`;
        optimizedText += `${eduLine}\n`;
        
        let details = [];
        if (edu.year) details.push(edu.year);
        if (edu.gpa) details.push(`GPA: ${edu.gpa}`);
        
        if (details.length > 0) {
          optimizedText += `${details.join(', ')}\n`;
        }
        
        if (edu.relevantCourses && edu.relevantCourses.length > 0) {
          optimizedText += `Relevant Courses:\n`;
          edu.relevantCourses.forEach(course => {
            optimizedText += `• ${course}\n`;
          });
        }
        
        if (edu.achievements && edu.achievements.length > 0) {
          optimizedText += `Academic Achievements:\n`;
          edu.achievements.forEach(achievement => {
            optimizedText += `• ${achievement}\n`;
          });
        }
        
        optimizedText += '\n';
      });
    }
    
    // Add achievements section with clear header
    if (optimizedAchievements.length > 0) {
      optimizedText += `ACHIEVEMENTS:\n`;
      optimizedText += `Key accomplishments relevant to the position:\n`;
      optimizedAchievements.forEach(achievement => {
        // Check if achievement contains quantifiable results to highlight them
        const hasQuantifiableResults = /\d+%|\d+\s*(?:million|thousand|hundred|k|m|b|billion|x|times)|\$\d+/i.test(achievement);
        
        if (hasQuantifiableResults) {
          // Use a star symbol for achievements with metrics to make them stand out
          optimizedText += `★ ${achievement}\n`;
        } else {
          optimizedText += `• ${achievement}\n`;
        }
      });
      optimizedText += '\n';
    }
    
    // Add goals section with clear header if present in original
    if (optimizedGoals.length > 0) {
      optimizedText += `CAREER GOALS:\n`;
      optimizedText += `Professional objectives aligned with the position:\n`;
      optimizedGoals.forEach(goal => {
        optimizedText += `• ${goal}\n`;
      });
      optimizedText += '\n';
    }
    
    // Add languages section with clear header if present in original
    if (optimizedLanguages.length > 0) {
      optimizedText += `LANGUAGES:\n`;
      optimizedText += `Language proficiency relevant to the role:\n`;
      optimizedLanguages.forEach(language => {
        // Format language entries consistently
        const parts = language.split('-').map(part => part.trim());
        if (parts.length === 2) {
          optimizedText += `• ${parts[0]} - ${parts[1]}\n`;
        } else {
          optimizedText += `• ${language}\n`;
        }
      });
      optimizedText += '\n';
    }
    
    return optimizedText;
  };

  // Add download document handler
  const handleDownloadDocument = async () => {
    if (!optimizedText) {
      setDocumentError("No optimized text available. Please optimize your CV first.");
      return;
    }
    
    setIsGeneratingDocument(true);
    setDocumentError(null);
    
    try {
      console.log("Starting document generation...");
      
      // Get CV name without file extension
      const cvName = selectedCVName 
        ? selectedCVName.replace(/\.\w+$/, '') 
        : 'CV';
      
      // Use API-based document generation
      if (!selectedCVId) {
        throw new Error('No CV selected for document generation');
      }
      
      console.log(`Generating document for CV ID: ${selectedCVId}`);
      
      try {
        // First, try to generate the document locally for better formatting
        try {
          console.log("Attempting local document generation for better formatting...");
          
          // Generate structured CV data from optimized text
          const structuredCV = generateStructuredCV(optimizedText, jobDescription);
          
          // Further enhance the structured data for better document formatting
          const enhancedStructuredCV = {
            ...structuredCV,
            education: structuredCV.education.map(edu => {
              // Parse relevant courses if they're in string format
              let relevantCourses: string[] = [];
              if (edu.relevantCourses) {
                if (typeof edu.relevantCourses === 'string') {
                  relevantCourses = (edu.relevantCourses as string).split(',').map((course: string) => course.trim());
                } else if (Array.isArray(edu.relevantCourses)) {
                  relevantCourses = edu.relevantCourses;
                }
              }
              
              // Parse achievements if they're in string format
              let achievements: string[] = [];
              if (edu.achievements) {
                if (typeof edu.achievements === 'string') {
                  achievements = (edu.achievements as string).split(/[•\-*]\s*/).filter(Boolean).map((achievement: string) => achievement.trim());
                } else if (Array.isArray(edu.achievements)) {
                  achievements = edu.achievements;
                }
              }
              
              return {
                ...edu,
                relevantCourses,
                achievements
              };
            }),
            achievements: structuredCV.achievements.map(achievement => {
              // Highlight quantifiable achievements
              const hasQuantifiableResults = /\d+%|\d+\s*(?:million|thousand|hundred|k|m|b|billion|x|times)|\$\d+|increased|improved|reduced|saved|generated|delivered|achieved/i.test(achievement);
              return achievement;
            }),
            languages: structuredCV.languages.map(language => {
              // Ensure consistent formatting for languages
              const parts = language.split(/[:-]/).map(part => part.trim());
              if (parts.length === 2) {
                return `${parts[0]} - ${parts[1]}`;
              }
              return language;
            })
          };
          
          // Generate the document with enhanced formatting
          const doc = await generateOptimizedDocument(optimizedText, cvName, enhancedStructuredCV.contactInfo, enhancedStructuredCV);
          
          // Convert to blob
          const blob = await Packer.toBlob(doc);
          
          // Save the file
          saveAs(blob, `${cvName}.docx`);
          
          console.log("Local document generation successful");
          setIsGeneratingDocument(false);
          return;
        } catch (localGenError) {
          console.warn("Local document generation failed, falling back to API method:", localGenError);
        }
        
        // Method 1: Try using the POST API to get base64 data
        const response = await fetch('/api/cv/generate-docx', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            cvId: selectedCVId,
            optimizedText: optimizedText
          }),
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          let errorMessage = 'Failed to generate DOCX file via API';
          
          try {
            const errorData = JSON.parse(errorText);
            errorMessage = errorData.error || errorMessage;
          } catch (e) {
            console.error("Error parsing error response:", e);
          }
          
          throw new Error(errorMessage);
        }
        
        const data = await response.json();
        console.log("Document generation API response received");
        
        if (!data.success || !data.docxBase64) {
          console.error("API response missing docxBase64 data:", data);
          throw new Error('Failed to generate DOCX file: No data received from server');
        }
        
        console.log(`Received base64 data of length: ${data.docxBase64.length}`);
        
        try {
          // Method 1a: Try using data URL approach first
          const linkSource = `data:application/vnd.openxmlformats-officedocument.wordprocessingml.document;base64,${data.docxBase64}`;
          const downloadLink = document.createElement('a');
          downloadLink.href = linkSource;
          downloadLink.download = `${cvName}.docx`;
          
          // Append to the document, click, and remove
          document.body.appendChild(downloadLink);
          downloadLink.click();
          document.body.removeChild(downloadLink);
          
          console.log("Download completed using data URL approach");
        } catch (downloadError) {
          console.warn("Data URL download failed, trying file-saver approach:", downloadError);
          
          // Method 1b: Fallback to file-saver approach
          try {
            // Convert base64 to blob
            const byteCharacters = atob(data.docxBase64);
            const byteNumbers = new Array(byteCharacters.length);
            
            for (let i = 0; i < byteCharacters.length; i++) {
              byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            
            const byteArray = new Uint8Array(byteNumbers);
            const blob = new Blob([byteArray], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
            
            // Use file-saver to save the blob
            saveAs(blob, `${cvName}.docx`);
            
            console.log("Download completed using file-saver approach");
          } catch (fileSaverError) {
            console.error("Both download methods failed, trying direct download:", fileSaverError);
            throw fileSaverError; // Propagate to try the next method
          }
        }
      } catch (apiError) {
        console.warn("API-based download methods failed, trying direct download:", apiError);
        
        // Method 2: Direct download using GET request
        try {
          console.log("Attempting direct download via GET request");
          
          // Create a hidden iframe to trigger the download
          const iframe = document.createElement('iframe');
          iframe.style.display = 'none';
          document.body.appendChild(iframe);
          
          // Set the iframe source to the download URL
          iframe.src = `/api/cv/download-optimized-docx?cvId=${selectedCVId}`;
          
          // Remove the iframe after a delay
          setTimeout(() => {
            document.body.removeChild(iframe);
          }, 5000);
          
          console.log("Direct download initiated");
          
          // Show a message to the user
          setDocumentError("If the download doesn't start automatically, please check your browser's download manager or try again.");
        } catch (directDownloadError) {
          console.error("All download methods failed:", directDownloadError);
          throw new Error("Failed to download document: All download methods failed");
        }
      }
      
      setIsGeneratingDocument(false);
    } catch (error) {
      console.error('Error generating document:', error);
      setDocumentError(`Failed to generate document: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setIsGeneratingDocument(false);
    }
  };

  return (
    <div className="w-full max-w-6xl mx-auto">
      {/* File selection */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-2">Select CV</h3>
        <ModernFileDropdown 
          cvs={cvs.map(cv => `${cv.name}|${cv.id}`)}
          onSelect={handleSelectCV}
          selectedCVName={selectedCVName}
        />
      </div>

      {/* Job description input */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-2">Job Description</h3>
        <textarea
          className="w-full h-48 p-4 bg-[#050505] border border-gray-700 rounded-md text-white resize-none focus:border-[#B4916C] focus:ring-1 focus:ring-[#B4916C] focus:outline-none"
          placeholder="Paste the job description here..."
          value={jobDescription}
          onChange={(e) => setJobDescription(e.target.value)}
        />
      </div>

      {/* Process button */}
      <div className="mb-6">
        <button
          onClick={processCV}
          disabled={isProcessing || !selectedCVId || !jobDescription.trim()}
          className={`w-full py-3 rounded-md font-semibold transition-colors duration-200 ${
            isProcessing || !selectedCVId || !jobDescription.trim()
              ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
              : 'bg-[#B4916C] text-white hover:bg-[#A37F5C]'
          }`}
        >
          {isProcessing ? 'Processing...' : 'Optimize CV for Job'}
        </button>
      </div>

      {/* Processing status */}
      {isProcessing && (
        <div className="mb-6 p-4 border border-gray-700 rounded-md">
          <div className="flex items-center mb-2">
            <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
            <span>{processingStatus || 'Processing...'}</span>
          </div>
          <div className="w-full h-2 bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-[#B4916C] transition-all duration-300"
              style={{ width: `${processingProgress}%` }}
            />
          </div>
          <div className="mt-1 text-sm text-gray-400">
            {processingProgress}% complete
          </div>
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="mb-6 p-4 border border-red-800 bg-red-900/20 rounded-md text-red-200">
          <div className="flex items-center">
            <AlertCircle className="w-4 h-4 mr-2" />
            <span>{error}</span>
          </div>
        </div>
      )}

      {/* Results */}
      {isProcessed && (
        <div className="space-y-6">
          {/* Job match score */}
          {jobMatchAnalysis && (
            <div className="mt-8 space-y-6">
              <div className="bg-[#0D0D0D] rounded-lg p-6 border border-[#1D1D1D]">
                <h3 className="text-xl font-semibold mb-4">Job Match Analysis</h3>
                
                <div className="flex items-center mb-6">
                  <div className="w-32 h-32 rounded-full flex items-center justify-center border-4 border-[#B4916C] mr-6">
                    <span className="text-3xl font-bold text-[#B4916C]">{jobMatchAnalysis.score}%</span>
                  </div>
                  
                  <div className="flex-1">
                    <h4 className="text-lg font-medium mb-2">Match Score</h4>
                    <p className="text-gray-400 mb-4">
                      Your CV is {jobMatchAnalysis.score < 50 ? 'not well' : jobMatchAnalysis.score < 70 ? 'somewhat' : 'well'} aligned with this job description.
                    </p>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-gray-400">Skills Match</p>
                        <div className="w-full bg-gray-700 rounded-full h-2 mt-1">
                          <div className="bg-[#B4916C] h-2 rounded-full" style={{ width: `${jobMatchAnalysis.dimensionalScores.skillsMatch}%` }}></div>
                        </div>
                      </div>
                      <div>
                        <p className="text-sm text-gray-400">Experience Match</p>
                        <div className="w-full bg-gray-700 rounded-full h-2 mt-1">
                          <div className="bg-[#B4916C] h-2 rounded-full" style={{ width: `${jobMatchAnalysis.dimensionalScores.experienceMatch}%` }}></div>
                        </div>
                      </div>
                      <div>
                        <p className="text-sm text-gray-400">Education Match</p>
                        <div className="w-full bg-gray-700 rounded-full h-2 mt-1">
                          <div className="bg-[#B4916C] h-2 rounded-full" style={{ width: `${jobMatchAnalysis.dimensionalScores.educationMatch}%` }}></div>
                        </div>
                      </div>
                      <div>
                        <p className="text-sm text-gray-400">Keyword Density</p>
                        <div className="w-full bg-gray-700 rounded-full h-2 mt-1">
                          <div className="bg-[#B4916C] h-2 rounded-full" style={{ width: `${jobMatchAnalysis.dimensionalScores.keywordDensity}%` }}></div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <h4 className="text-lg font-medium mb-2">Recommendations</h4>
                    <ul className="list-disc pl-5 space-y-1 text-gray-300">
                      {jobMatchAnalysis.recommendations.map((rec, index) => (
                        <li key={index}>{rec}</li>
                      ))}
                    </ul>
                  </div>
                  
                  <div>
                    <h4 className="text-lg font-medium mb-2">Matched Keywords</h4>
                    <div className="flex flex-wrap gap-2">
                      {jobMatchAnalysis.matchedKeywords.map((keyword, index) => (
                        <span 
                          key={index} 
                          className="px-2 py-1 bg-[#1D1D1D] rounded text-sm"
                          style={{ 
                            backgroundColor: `rgba(180, 145, 108, ${keyword.relevance / 100})`,
                            color: keyword.relevance > 50 ? '#000' : '#fff'
                          }}
                        >
                          {keyword.keyword}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Optimized CV */}
          <div className="p-6 border border-gray-700 rounded-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold">Optimized CV</h3>
              <div className="flex gap-2">
                <button
                  onClick={handleDownloadDocument}
                  className="flex items-center px-4 py-2 bg-[#B4916C] text-white rounded-md hover:bg-[#A37F5C] transition-colors"
                  disabled={!optimizedText || isGeneratingDocument}
                >
                  {isGeneratingDocument ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4 mr-2" />
                      Download DOCX
                    </>
                  )}
                </button>
              </div>
            </div>
            {documentError && (
              <Alert className="mb-4 bg-destructive/10">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{documentError}</AlertDescription>
              </Alert>
            )}
            <div className="whitespace-pre-wrap font-mono text-sm bg-[#050505] p-4 rounded-md border border-gray-700">
              {optimizedText}
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 