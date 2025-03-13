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
  const educationPattern = /(?:education|qualifications|academic|educational background)[:\s]+(.*?)(?=\n\s*\n|\n(?:[A-Z][a-z]+\s*(?:&\s*)?)+:|\n\s*$)/is;
  const match = text.match(educationPattern);
  
  if (!match || !match[1]) return [];
  
  const educationSection = match[1];
  
  // Check if education is in a list format with bullet points
  const hasBulletPoints = /^[•\-\*\+\>\·\♦\■\□\◆\◇\○\●\★\☆]\s+/m.test(educationSection);
  
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
      
      // Extract year
      const yearMatch = cleanEntry.match(/(?:19|20)\d{2}(?:\s*[-–—]\s*(?:(?:19|20)\d{2}|present))?/);
      const year = yearMatch ? yearMatch[0] : '';
      
      // Extract GPA if available
      const gpaMatch = cleanEntry.match(/GPA\s*(?:of|:)?\s*([\d.]+)/i);
      const gpa = gpaMatch ? gpaMatch[1] : '';
      
      return {
        degree,
        institution,
        year,
        gpa
      };
    }).filter(entry => entry.degree.length > 0);
  } else {
    // Parse paragraph or line format
    const entries = educationSection.split(/\n(?=\d{4}|\d{2}\/\d{2}|\w+\s+\d{4}|[A-Z][a-z]+\s+University|[A-Z][a-z]+\s+College)/);
    
    return entries.map(entry => {
      // Extract degree
      const degreePattern = /(?:degree|diploma|certificate|bachelor|master|phd|doctorate|mba|bsc|ba|ma|ms)(?:'s)?(?:\s+(?:of|in))?\s+([^.,\n]+)/i;
      const degreeMatch = entry.match(degreePattern);
      const degree = degreeMatch ? degreeMatch[0] : '';
      
      // Extract institution
      const institutionPattern = /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\s+(?:University|College|Institute|School))/;
      const institutionMatch = entry.match(institutionPattern);
      const institution = institutionMatch ? institutionMatch[1] : '';
      
      // Extract location
      const locationPattern = /(?:located in|in)\s+([A-Z][a-z]+(?:[\s,]+[A-Z][a-z]+)*)/i;
      const locationMatch = entry.match(locationPattern);
      const location = locationMatch ? locationMatch[1] : '';
      
      // Extract year
      const yearPattern = /(?:19|20)\d{2}(?:\s*[-–—]\s*(?:(?:19|20)\d{2}|present))?/;
      const yearMatch = entry.match(yearPattern);
      const year = yearMatch ? yearMatch[0] : '';
      
      // Extract GPA if available
      const gpaPattern = /GPA\s*(?:of|:)?\s*([\d.]+)/i;
      const gpaMatch = entry.match(gpaPattern);
      const gpa = gpaMatch ? gpaMatch[1] : '';
      
      // Extract relevant courses if available
      const coursesPattern = /(?:relevant|key|major)\s+courses?(?:\s+include)?[:\s]+([^.]+)/i;
      const coursesMatch = entry.match(coursesPattern);
      const relevantCourses = coursesMatch ? 
        coursesMatch[1].split(/[,;]/).map(course => course.trim()).filter(course => course.length > 0) : 
        [];
      
      // Extract achievements if available
      const achievementsPattern = /(?:achievements|accomplishments|honors)[:\s]+([^.]+)/i;
      const achievementsMatch = entry.match(achievementsPattern);
      const achievements = achievementsMatch ? 
        achievementsMatch[1].split(/[,;]/).map(achievement => achievement.trim()).filter(achievement => achievement.length > 0) : 
        [];
      
      return {
        degree,
        institution,
        location,
        year,
        gpa,
        achievements,
        relevantCourses
      };
    }).filter(entry => entry.degree.length > 0 || entry.institution.length > 0);
  }
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
  // Try to find achievements/accomplishments section
  const achievementsPattern = /(?:achievements|accomplishments|key accomplishments|notable achievements)[:\s]+(.*?)(?=\n\s*\n|\n(?:[A-Z][a-z]+\s*(?:&\s*)?)+:|\n\s*$)/is;
  const match = text.match(achievementsPattern);
  
  if (!match || !match[1]) {
    // If no achievements section found, try to extract bullet points from experience section
    const experiencePattern = /(?:experience|work history|employment)[:\s]+(.*?)(?=\n\s*\n|\n(?:[A-Z][a-z]+\s*(?:&\s*)?)+:|\n\s*$)/is;
    const expMatch = text.match(experiencePattern);
    
    if (expMatch && expMatch[1]) {
      // Extract bullet points that look like achievements (contain action verbs and metrics)
      const bulletPoints = expMatch[1].split(/\n/).filter(line => 
        /^[•\-\*\+\>\·\♦\■\□\◆\◇\○\●\★\☆]\s*/.test(line) && 
        (/increased|improved|achieved|delivered|led|managed|created|developed|implemented/i.test(line) ||
         /\d+%|\$\d+|\d+ million|\d+ thousand/i.test(line))
      );
      
      return bulletPoints.map(point => 
        point.replace(/^[•\-\*\+\>\·\♦\■\□\◆\◇\○\●\★\☆]\s*/, '').trim()
      ).filter(achievement => achievement.length > 0);
    }
    
    return [];
  }
  
  return match[1]
    .split(/\n/)
    .map(achievement => achievement.replace(/^[•\-\*\+\>\·\♦\■\□\◆\◇\○\●\★\☆]\s*/, '').trim())
    .filter(achievement => achievement.length > 0);
};

const optimizeAchievements = (achievements: string[], jobDescription: string, jobKeywords: string[]): string[] => {
  if (achievements.length === 0) {
    return [];
  }
  
  // Extract important metrics and results from job description
  const metricPatterns = [
    /(?:track record of|history of|demonstrated|proven)\s+([^.]+)/gi,
    /(?:results|outcomes|success|impact)\s+([^.]+)/gi,
    /(?:metrics|kpis|targets|goals)\s+([^.]+)/gi
  ];
  
  let keyMetrics: string[] = [];
  metricPatterns.forEach(pattern => {
    const matches = [...jobDescription.matchAll(pattern)];
    matches.forEach(match => {
      if (match[1]) {
        keyMetrics.push(match[1].trim());
      }
    });
  });
  
  // Score achievements based on relevance to job description
  const scoredAchievements = achievements.map(achievement => {
    let score = 0;
    
    // Score based on keyword matches
    jobKeywords.forEach(keyword => {
      if (achievement.toLowerCase().includes(keyword.toLowerCase())) {
        score += 10;
      }
    });
    
    // Score based on metrics matches
    keyMetrics.forEach(metric => {
      if (achievement.toLowerCase().includes(metric.toLowerCase())) {
        score += 15;
      }
    });
    
    // Score based on containing numbers/percentages (quantifiable results)
    if (/\d+%|\$\d+|\d+ million|\d+ thousand/i.test(achievement)) {
      score += 20;
    }
    
    // Score based on action verbs
    const actionVerbs = ['led', 'managed', 'created', 'developed', 'implemented', 'increased', 'improved', 'reduced', 'achieved', 'delivered'];
    actionVerbs.forEach(verb => {
      if (achievement.toLowerCase().includes(verb)) {
        score += 5;
      }
    });
    
    return { achievement, score };
  });
  
  // Sort achievements by relevance score
  scoredAchievements.sort((a, b) => b.score - a.score);
  
  // Return top achievements (max 5)
  return scoredAchievements.slice(0, 5).map(item => item.achievement);
};

const extractGoals = (text: string): string[] => {
  const goalsPattern = /(?:goals|objectives|targets|career goals|professional goals)[:\s]+(.*?)(?=\n\s*\n|\n(?:[A-Z][a-z]+\s*(?:&\s*)?)+:|\n\s*$)/is;
  const match = text.match(goalsPattern);
  if (!match || !match[1]) return [];
  
  return match[1]
    .split(/\n/)
    .map(goal => goal.replace(/^[•\-\*\+\>\·\♦\■\□\◆\◇\○\●\★\☆]\s*/, '').trim())
    .filter(goal => goal.length > 0);
};

const optimizeGoals = (goals: string[], jobDescription: string, jobKeywords: string[]): string[] => {
  // If no goals provided, generate some based on job description
  if (goals.length === 0) {
    // Extract career path or growth opportunities from job description
    const careerPatterns = [
      /(?:career path|growth opportunities|advancement|progression)[:\s]+([^.]+)/gi,
      /(?:opportunity to|chance to|ability to)[:\s]+([^.]+)/gi,
      /(?:looking for candidates who|seeking individuals who)[:\s]+([^.]+)/gi
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
    
    // Generate goals based on career opportunities or job keywords
    if (careerOpportunities.length > 0) {
      return [
        `To leverage my expertise in ${jobKeywords.slice(0, 2).join(' and ')} to excel in this role`,
        `To contribute to ${careerOpportunities[0]}`,
        `To continuously develop skills in ${jobKeywords.slice(2, 4).join(' and ')}`
      ];
    } else {
      return [
        `To leverage my expertise in ${jobKeywords.slice(0, 2).join(' and ')} to excel in this role`,
        `To contribute to organizational success through applying my skills in ${jobKeywords.slice(2, 4).join(' and ')}`,
        `To continuously develop professional capabilities aligned with industry best practices`
      ];
    }
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
      return `${goal} with focus on ${relevantKeywords.join(' and ')}`;
    }
    
    return goal;
  });
  
  return optimizedGoals.slice(0, 3); // Return at most 3 goals
};

const extractLanguages = (text: string): string[] => {
  const languagesPattern = /(?:languages|language skills|fluent in|proficient in|spoken languages)[:\s]+(.*?)(?=\n\s*\n|\n(?:[A-Z][a-z]+\s*(?:&\s*)?)+:|\n\s*$)/is;
  const match = text.match(languagesPattern);
  if (!match || !match[1]) return [];
  
  // Split by common separators and clean up
  return match[1]
    .split(/[,;]|\n|(?:and\s+)/)
    .map(language => {
      // Extract language and proficiency level if available
      const langMatch = language.match(/([A-Za-z]+(?:\s+[A-Za-z]+)*)(?:\s*[-:]\s*|\s+\()(native|fluent|proficient|intermediate|beginner|basic|advanced|business|conversational)/i);
      
      if (langMatch) {
        return `${langMatch[1].trim()} - ${langMatch[2].trim()}`;
      }
      
      return language.trim();
    })
    .filter(language => language.length > 0);
};

const optimizeLanguages = (languages: string[], jobDescription: string): string[] => {
  if (languages.length === 0) {
    return [];
  }
  
  // Extract language requirements from job description
  const languageRequirements: string[] = [];
  const languagePatterns = [
    /(?:language|languages|fluent|proficient|speak|written|oral)\s+(?:in\s+)?([A-Za-z]+(?:\s+[A-Za-z]+)*)/gi,
    /([A-Za-z]+(?:\s+[A-Za-z]+)*)\s+(?:language|speaking)/gi
  ];
  
  languagePatterns.forEach(pattern => {
    const matches = [...jobDescription.matchAll(pattern)];
    matches.forEach(match => {
      if (match[1] && !['skills', 'requirements', 'qualifications', 'proficiency'].includes(match[1].toLowerCase())) {
        languageRequirements.push(match[1].trim());
      }
    });
  });
  
  // If no language requirements found, return original languages
  if (languageRequirements.length === 0) {
    return languages;
  }
  
  // Reorder languages to prioritize required languages
  const prioritizedLanguages = [...languages];
  prioritizedLanguages.sort((a, b) => {
    const aIsRequired = languageRequirements.some(req => 
      a.toLowerCase().includes(req.toLowerCase())
    );
    const bIsRequired = languageRequirements.some(req => 
      b.toLowerCase().includes(req.toLowerCase())
    );
    
    if (aIsRequired && !bIsRequired) return -1;
    if (!aIsRequired && bIsRequired) return 1;
    return 0;
  });
  
  // Enhance language proficiency for required languages if needed
  return prioritizedLanguages.map(language => {
    const isRequired = languageRequirements.some(req => 
      language.toLowerCase().includes(req.toLowerCase())
    );
    
    if (isRequired) {
      // Check if proficiency level is already specified
      const hasLevel = /[-:]\s*(native|fluent|proficient|intermediate|beginner|basic|advanced|business|conversational)/i.test(language);
      
      if (!hasLevel) {
        // Add a high proficiency level for required languages
        return `${language} - Proficient`;
      }
      
      // Upgrade intermediate/basic to proficient for required languages
      return language.replace(/(intermediate|beginner|basic)/i, 'Proficient');
    }
    
    return language;
  });
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

// Add generateOptimizedDocument function
const generateOptimizedDocument = async (content: string, name: string = 'Optimized CV', contactInfo?: StructuredCV['contactInfo'], structuredCV?: StructuredCV): Promise<Document> => {
  // Define brand color
  const brandColor = 'B4916C';
  
  // Get current date for footer
  const currentDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
  
  // Parse content into sections
  const sections: { [key: string]: string } = {};
  let currentSection = '';
  let currentContent: string[] = [];
  
  // Split content by lines
  const lines = content.split('\n');
  
  // Extract sections
  lines.forEach(line => {
    // Check if line is a section header
    const sectionMatch = line.match(/^([A-Z][A-Za-z\s]+):$/);
    
    if (sectionMatch) {
      // If we have a previous section, save it
      if (currentSection && currentContent.length > 0) {
        sections[currentSection] = currentContent.join('\n');
      }
      
      // Start new section
      currentSection = sectionMatch[1].trim();
      currentContent = [];
    } else if (currentSection) {
      // Add line to current section
      currentContent.push(line);
    }
  });
  
  // Add the last section
  if (currentSection && currentContent.length > 0) {
    sections[currentSection] = currentContent.join('\n');
  }
  
  // Define section order
  const sectionOrder = [
    'Profile',
    'Skills',
    'Technical Skills',
    'Professional Skills',
    'Experience',
    'Education',
    'Achievements',
    'Career Goals',
    'Languages',
    'References'
  ];
  
  // Define section icons (using Unicode characters)
  const sectionIcons: { [key: string]: string } = {
    'Profile': '👤 ',
    'Skills': '🔧 ',
    'Technical Skills': '💻 ',
    'Professional Skills': '🤝 ',
    'Experience': '📋 ',
    'Education': '🎓 ',
    'Achievements': '🏆 ',
    'Career Goals': '🎯 ',
    'Languages': '🌐 ',
    'References': '📞 '
  };
  
  // Create custom bullet points
  const customBullet = (text: string, level: number = 0): Paragraph => {
    const bulletSymbols = ['•', '○', '▪', '▫'];
    const symbol = bulletSymbols[level % bulletSymbols.length];
    const indent = level * 360;
    
    return new Paragraph({
      children: [
        new TextRun({
          text: symbol + ' ',
          bold: true,
          color: brandColor
        }),
        new TextRun({
          text: text
        })
      ],
      spacing: {
        before: 80,
        after: 80
      },
      indent: {
        left: indent
      }
    });
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
      headers: {
        default: new Header({
          children: [
            new Paragraph({
              text: '',
              style: 'Header'
            })
          ]
        })
      },
      footers: {
        default: new Footer({
          children: [
            new Paragraph({
              children: [
                new TextRun({
                  text: `${name} | Optimized CV | ${currentDate}`,
                  size: 18,
                  color: '666666'
                })
              ],
              alignment: AlignmentType.CENTER,
              style: 'Footer'
            })
          ]
        })
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
        
        // Contact information header if available
        ...(contactInfo ? [
          new Paragraph({
            children: [
              new TextRun({
                text: '',
                break: 1
              })
            ]
          }),
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
                  text: `LinkedIn: ${contactInfo.linkedin}`,
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
          }),
          new Paragraph({
            thematicBreak: true,
            spacing: {
              after: 300
            }
          })
        ] : []),
        
        // Add each section in order
        ...sectionOrder.flatMap(sectionName => {
          if (sections[sectionName]) {
            // Special handling for Experience section if structured data is available
            if (sectionName === 'Experience' && structuredCV && structuredCV.experience && structuredCV.experience.length > 0) {
              return [
                // Section header with icon
                new Paragraph({
                  children: [
                    new TextRun({
                      text: sectionIcons[sectionName] || '',
                      size: 28
                    }),
                    new TextRun({
                      text: sectionName,
                      size: 28,
                      bold: true,
                      color: brandColor
                    })
                  ],
                  heading: HeadingLevel.HEADING_2,
                  spacing: {
                    before: 400,
                    after: 200
                  },
                  thematicBreak: true,
                  style: 'Heading2'
                }),
                
                // Format experience entries
                ...structuredCV.experience.flatMap(exp => {
                  const paragraphs = [];
                  
                  // Job title and company
                  paragraphs.push(
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
                    })
                  );
                  
                  // Dates
                  if (exp.startDate || exp.endDate) {
                    paragraphs.push(
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
                    );
                  }
                  
                  // Extract responsibilities from the section content
                  const expContent = sections[sectionName];
                  const jobSection = expContent.split(/\n\n/).find(section => 
                    section.includes(exp.title || '') || 
                    (exp.startDate && section.includes(exp.startDate))
                  );
                  
                  if (jobSection) {
                    const responsibilities = jobSection
                      .split('\n')
                      .filter(line => line.trim().startsWith('•'))
                      .map(line => line.trim().replace(/^•\s*/, ''));
                    
                    responsibilities.forEach(resp => {
                      paragraphs.push(customBullet(resp, 1));
                    });
                  }
                  
                  return paragraphs;
                })
              ];
            }
            // Special handling for Education section if structured data is available
            else if (sectionName === 'Education' && structuredCV && structuredCV.education && structuredCV.education.length > 0) {
              return [
                // Section header with icon
                new Paragraph({
                  children: [
                    new TextRun({
                      text: sectionIcons[sectionName] || '',
                      size: 28
                    }),
                    new TextRun({
                      text: sectionName,
                      size: 28,
                      bold: true,
                      color: brandColor
                    })
                  ],
                  heading: HeadingLevel.HEADING_2,
                  spacing: {
                    before: 400,
                    after: 200
                  },
                  thematicBreak: true,
                  style: 'Heading2'
                }),
                
                // Format education entries
                ...structuredCV.education.flatMap(edu => {
                  const paragraphs = [];
                  
                  // Degree and institution
                  paragraphs.push(
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
                        ] : [])
                      ],
                      spacing: {
                        before: 200,
                        after: 80
                      },
                      style: 'EducationDegree'
                    })
                  );
                  
                  // Year and GPA
                  const yearGpaText = [
                    edu.year,
                    edu.gpa ? `GPA: ${edu.gpa}` : null
                  ].filter(Boolean).join(', ');
                  
                  if (yearGpaText) {
                    paragraphs.push(
                      new Paragraph({
                        children: [
                          new TextRun({
                            text: yearGpaText,
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
                    );
                  }
                  
                  // Relevant courses
                  if (edu.relevantCourses && edu.relevantCourses.length > 0) {
                    paragraphs.push(
                      new Paragraph({
                        children: [
                          new TextRun({
                            text: 'Relevant Courses: ',
                            bold: true,
                            size: 22
                          })
                        ],
                        spacing: {
                          before: 80,
                          after: 40
                        }
                      })
                    );
                    
                    edu.relevantCourses.forEach(course => {
                      paragraphs.push(customBullet(course, 1));
                    });
                  }
                  
                  // Achievements
                  if (edu.achievements && edu.achievements.length > 0) {
                    paragraphs.push(
                      new Paragraph({
                        children: [
                          new TextRun({
                            text: 'Achievements: ',
                            bold: true,
                            size: 22
                          })
                        ],
                        spacing: {
                          before: 80,
                          after: 40
                        }
                      })
                    );
                    
                    edu.achievements.forEach(achievement => {
                      paragraphs.push(customBullet(achievement, 1));
                    });
                  }
                  
                  return paragraphs;
                })
              ];
            }
            // Special handling for Skills section
            else if ((sectionName === 'Skills' || sectionName === 'Technical Skills' || sectionName === 'Professional Skills') && 
                     structuredCV && structuredCV.skills) {
              const skillsToShow = sectionName === 'Technical Skills' ? 
                structuredCV.skills.technical : 
                (sectionName === 'Professional Skills' ? 
                  structuredCV.skills.professional : 
                  [...structuredCV.skills.technical, ...structuredCV.skills.professional]);
              
              if (skillsToShow.length === 0) return [];
              
              return [
                // Section header with icon
                new Paragraph({
                  children: [
                    new TextRun({
                      text: sectionIcons[sectionName] || '',
                      size: 28
                    }),
                    new TextRun({
                      text: sectionName,
                      size: 28,
                      bold: true,
                      color: brandColor
                    })
                  ],
                  heading: HeadingLevel.HEADING_2,
                  spacing: {
                    before: 400,
                    after: 200
                  },
                  thematicBreak: true,
                  style: 'Heading2'
                }),
                
                // Skills in a table format (3 columns)
                new Table({
                  width: {
                    size: 100,
                    type: WidthType.PERCENTAGE
                  },
                  rows: Array(Math.ceil(skillsToShow.length / 3))
                    .fill(0)
                    .map((_, rowIndex) => {
                      return new TableRow({
                        children: Array(3)
                          .fill(0)
                          .map((_, colIndex) => {
                            const skillIndex = rowIndex * 3 + colIndex;
                            const skill = skillsToShow[skillIndex];
                            
                            return new TableCell({
                              children: skill ? [
                                new Paragraph({
                                  children: [
                                    new TextRun({
                                      text: '• ',
                                      color: brandColor,
                                      bold: true
                                    }),
                                    new TextRun({
                                      text: skill
                                    })
                                  ]
                                })
                              ] : [new Paragraph({})],
                              borders: {
                                top: { style: BorderStyle.NONE },
                                bottom: { style: BorderStyle.NONE },
                                left: { style: BorderStyle.NONE },
                                right: { style: BorderStyle.NONE }
                              }
                            });
                          })
                      });
                    })
                })
              ];
            }
            // Special handling for Languages section
            else if (sectionName === 'Languages' && structuredCV && structuredCV.languages && structuredCV.languages.length > 0) {
              return [
                // Section header with icon
                new Paragraph({
                  children: [
                    new TextRun({
                      text: sectionIcons[sectionName] || '',
                      size: 28
                    }),
                    new TextRun({
                      text: sectionName,
                      size: 28,
                      bold: true,
                      color: brandColor
                    })
                  ],
                  heading: HeadingLevel.HEADING_2,
                  spacing: {
                    before: 400,
                    after: 200
                  },
                  thematicBreak: true,
                  style: 'Heading2'
                }),
                
                // Languages in a table format (2 columns)
                new Table({
                  width: {
                    size: 100,
                    type: WidthType.PERCENTAGE
                  },
                  rows: Array(Math.ceil(structuredCV.languages.length / 2))
                    .fill(0)
                    .map((_, rowIndex) => {
                      return new TableRow({
                        children: Array(2)
                          .fill(0)
                          .map((_, colIndex) => {
                            const langIndex = rowIndex * 2 + colIndex;
                            const language = structuredCV.languages[langIndex];
                            
                            return new TableCell({
                              children: language ? [
                                new Paragraph({
                                  children: [
                                    new TextRun({
                                      text: '🗣️ ',
                                      size: 20
                                    }),
                                    new TextRun({
                                      text: language
                                    })
                                  ]
                                })
                              ] : [new Paragraph({})],
                              borders: {
                                top: { style: BorderStyle.NONE },
                                bottom: { style: BorderStyle.NONE },
                                left: { style: BorderStyle.NONE },
                                right: { style: BorderStyle.NONE }
                              }
                            });
                          })
                      });
                    })
                })
              ];
            }
            // Special handling for Achievements section
            else if (sectionName === 'Achievements' && structuredCV && structuredCV.achievements && structuredCV.achievements.length > 0) {
              return [
                // Section header with icon
                new Paragraph({
                  children: [
                    new TextRun({
                      text: sectionIcons[sectionName] || '',
                      size: 28
                    }),
                    new TextRun({
                      text: sectionName,
                      size: 28,
                      bold: true,
                      color: brandColor
                    })
                  ],
                  heading: HeadingLevel.HEADING_2,
                  spacing: {
                    before: 400,
                    after: 200
                  },
                  thematicBreak: true,
                  style: 'Heading2'
                }),
                
                // Achievements as bullet points
                ...structuredCV.achievements.map(achievement => customBullet(achievement))
              ];
            }
            else {
              return [
                // Section header with icon
                new Paragraph({
                  children: [
                    new TextRun({
                      text: sectionIcons[sectionName] || '',
                      size: 28
                    }),
                    new TextRun({
                      text: sectionName,
                      size: 28,
                      bold: true,
                      color: brandColor
                    })
                  ],
                  heading: HeadingLevel.HEADING_2,
                  spacing: {
                    before: 400,
                    after: 200
                  },
                  thematicBreak: true,
                  style: 'Heading2'
                }),
                
                // Section content - handle bullet points
                ...sections[sectionName].split('\n').map(line => {
                  const bulletMatch = line.match(/^[•\-\*\+\>\·\♦\■\□\◆\◇\○\●\★\☆]\s+(.+)$/);
                  
                  if (bulletMatch) {
                    // This is a bullet point
                    return customBullet(bulletMatch[1]);
                  } else if (line.trim().startsWith('  ')) {
                    // This is a sub-bullet or indented content
                    return customBullet(line.trim().replace(/^  /, ''), 1);
                  } else {
                    // Regular paragraph
                    return new Paragraph({
                      children: [
                        new TextRun({
                          text: line
                        })
                      ],
                      spacing: {
                        before: 100,
                        after: 100
                      },
                      style: 'Normal'
                    });
                  }
                })
              ];
            }
          }
          return [];
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
          id: 'Heading2',
          name: 'Heading 2',
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
                size: 1
              }
            }
          }
        },
        {
          id: 'BulletPoint',
          name: 'Bullet Point',
          basedOn: 'Normal',
          next: 'Normal',
          run: {
            size: 24
          },
          paragraph: {
            spacing: { 
              before: 100, 
              after: 100 
            }
          }
        },
        {
          id: 'SubBulletPoint',
          name: 'Sub Bullet Point',
          basedOn: 'Normal',
          next: 'Normal',
          run: {
            size: 24,
            italics: true
          },
          paragraph: {
            spacing: { 
              before: 80, 
              after: 80 
            },
            indent: {
              left: 720
            }
          }
        },
        {
          id: 'Normal',
          name: 'Normal',
          next: 'Normal',
          run: {
            size: 24
          },
          paragraph: {
            spacing: { 
              before: 100, 
              after: 100 
            }
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
          id: 'ExperienceBullet',
          name: 'Experience Bullet',
          basedOn: 'BulletPoint',
          next: 'Normal',
          run: {
            size: 22
          },
          paragraph: {
            spacing: { 
              before: 80, 
              after: 80 
            },
            indent: {
              left: 360
            }
          }
        },
        {
          id: 'EducationDegree',
          name: 'Education Degree',
          basedOn: 'Normal',
          next: 'Normal',
          run: {
            size: 24,
            bold: true
          },
          paragraph: {
            spacing: { 
              before: 200, 
              after: 80 
            }
          }
        },
        {
          id: 'EducationCourses',
          name: 'Education Courses',
          basedOn: 'Normal',
          next: 'Normal',
          run: {
            size: 22
          },
          paragraph: {
            spacing: { 
              before: 80, 
              after: 80 
            },
            indent: {
              left: 360
            }
          }
        },
        {
          id: 'EducationAchievements',
          name: 'Education Achievements',
          basedOn: 'Normal',
          next: 'Normal',
          run: {
            size: 22
          },
          paragraph: {
            spacing: { 
              before: 80, 
              after: 80 
            },
            indent: {
              left: 360
            }
          }
        },
        {
          id: 'Header',
          name: 'Header',
          basedOn: 'Normal',
          next: 'Normal',
          run: {
            size: 18,
            color: '666666'
          },
          paragraph: {
            spacing: { 
              before: 100, 
              after: 100 
            },
            alignment: AlignmentType.RIGHT
          }
        },
        {
          id: 'Footer',
          name: 'Footer',
          basedOn: 'Normal',
          next: 'Normal',
          run: {
            size: 18,
            color: '666666'
          },
          paragraph: {
            spacing: { 
              before: 100, 
              after: 100 
            },
            alignment: AlignmentType.CENTER
          }
        }
      ]
    }
  });

  return doc;
};

const optimizeEducation = (education: EducationEntry[], jobDescription: string, jobKeywords: string[]): EducationEntry[] => {
  if (education.length === 0) {
    return [];
  }
  
  // Extract education requirements from job description
  const educationRequirements: string[] = [];
  const educationPatterns = [
    /(?:degree|diploma|certificate)\s+(?:in|of)\s+([^.]+)/gi,
    /(?:bachelor|master|phd|doctorate|mba|bsc|ba|ma|ms)(?:'s)?\s+(?:degree\s+)?(?:in|of)?\s+([^.]+)/gi,
    /(?:education|qualification)(?:\s+requirements?)?[:\s]+([^.]+)/gi
  ];
  
  educationPatterns.forEach(pattern => {
    const matches = [...jobDescription.matchAll(pattern)];
    matches.forEach(match => {
      if (match[1]) {
        educationRequirements.push(match[1].trim());
      }
    });
  });
  
  // Score education entries based on relevance to job requirements
  const scoredEducation = education.map(entry => {
    let score = 0;
    
    // Score based on degree relevance to job requirements
    educationRequirements.forEach(req => {
      if (entry.degree.toLowerCase().includes(req.toLowerCase())) {
        score += 30;
      }
    });
    
    // Score based on degree relevance to job keywords
    jobKeywords.forEach(keyword => {
      if (entry.degree.toLowerCase().includes(keyword.toLowerCase())) {
        score += 20;
      }
      
      // Also check relevant courses if available
      if (entry.relevantCourses) {
        entry.relevantCourses.forEach(course => {
          if (course.toLowerCase().includes(keyword.toLowerCase())) {
            score += 10;
          }
        });
      }
    });
    
    // Bonus for recent education
    if (entry.year) {
      const yearMatch = entry.year.match(/(\d{4})/g);
      if (yearMatch && yearMatch.length > 0) {
        const mostRecentYear = Math.max(...yearMatch.map(y => parseInt(y)));
        const currentYear = new Date().getFullYear();
        const yearDiff = currentYear - mostRecentYear;
        
        if (yearDiff < 5) {
          score += 15;
        } else if (yearDiff < 10) {
          score += 10;
        } else {
          score += 5;
        }
      }
    }
    
    // Bonus for high GPA
    if (entry.gpa) {
      const gpaValue = parseFloat(entry.gpa);
      if (gpaValue >= 3.5) {
        score += 15;
      } else if (gpaValue >= 3.0) {
        score += 10;
      } else if (gpaValue >= 2.5) {
        score += 5;
      }
    }
    
    return { entry, score };
  });
  
  // Sort by relevance score
  scoredEducation.sort((a, b) => b.score - a.score);
  
  // Enhance education entries with relevant courses if missing
  return scoredEducation.map(({ entry }) => {
    // If no relevant courses and we have job keywords, add some based on job requirements
    if ((!entry.relevantCourses || entry.relevantCourses.length === 0) && jobKeywords.length > 0) {
      const fieldOfStudy = entry.degree.replace(/(?:bachelor|master|phd|doctorate|mba|bsc|ba|ma|ms)(?:'s)?\s+(?:degree\s+)?(?:in|of)?\s+/i, '');
      
      // Generate relevant courses based on job keywords and field of study
      const suggestedCourses = jobKeywords
        .filter(keyword => keyword.length > 3)
        .slice(0, 3)
        .map(keyword => `Advanced ${keyword.charAt(0).toUpperCase() + keyword.slice(1)} in ${fieldOfStudy}`);
      
      if (suggestedCourses.length > 0) {
        entry.relevantCourses = suggestedCourses;
      }
    }
    
    return entry;
  });
};

export default function EnhancedSpecificOptimizationWorkflow({ cvs = [] }: EnhancedSpecificOptimizationWorkflowProps): JSX.Element {
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
    achievements: [],
    goals: [],
    languages: [],
    contactInfo: {}
  });
  
  // Add new state variables
  const [jobMatchScore, setJobMatchScore] = useState<number>(0);
  const [recommendations, setRecommendations] = useState<string[]>([]);
  const [keywordMatches, setKeywordMatches] = useState<KeywordMatch[]>([]);
  
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
        const optimizedText = generateOptimizedText(originalText, jobDescription);
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
    // Extract keywords from job description
    const jobKeywords = extractKeywords(jobDescription, true);
    const cvKeywords = extractKeywords(originalText);
    
    // Find missing keywords (keywords in job description but not in CV)
    const missingKeywords = jobKeywords.filter((jobKeyword: string) => {
      return !cvKeywords.some((cvKeyword: string) => {
        const jobKeywordLower = jobKeyword.toLowerCase();
        const cvKeywordLower = cvKeyword.toLowerCase();
        
        return cvKeywordLower === jobKeywordLower || 
               cvKeywordLower.includes(jobKeywordLower) || 
               jobKeywordLower.includes(cvKeywordLower);
      });
    });
    
    // Extract structured data from CV
    const structuredCV = generateStructuredCV(originalText, jobDescription);
    
    // Optimize profile
    const optimizedProfile = optimizeProfile(structuredCV.profile, jobDescription, jobKeywords);
    
    // Optimize achievements
    const optimizedAchievements = optimizeAchievements(structuredCV.achievements, jobDescription, jobKeywords);
    
    // Optimize goals
    const optimizedGoals = optimizeGoals(structuredCV.goals, jobDescription, jobKeywords);
    
    // Optimize languages
    const optimizedLanguages = optimizeLanguages(structuredCV.languages, jobDescription);
    
    // Optimize skills
    const optimizedSkills = optimizeSkills(
      structuredCV.skills.technical,
      structuredCV.skills.professional,
      jobDescription,
      jobKeywords
    );
    
    // Optimize education
    const optimizedEducation = optimizeEducation(structuredCV.education, jobDescription, jobKeywords);
    
    // Create a modified version of the original text
    let optimized = originalText;
    
    // Replace or enhance the profile section
    const profilePattern = /(?:profile|summary|objective|about me)[:\s]+(.*?)(?=\n\s*\n|\n(?:[A-Z][a-z]+\s*(?:&\s*)?)+:|\n\s*$)/is;
    const profileMatch = optimized.match(profilePattern);
    
    if (profileMatch && profileMatch.index !== undefined) {
      // Replace existing profile
      optimized = optimized.substring(0, profileMatch.index) + 
                  `Profile: ${optimizedProfile}` + 
                  optimized.substring(profileMatch.index + profileMatch[0].length);
    } else {
      // Add profile at the beginning if it doesn't exist
      optimized = `Profile: ${optimizedProfile}\n\n` + optimized;
    }
    
    // Replace or enhance the skills section
    if (optimizedSkills.technical.length > 0 || optimizedSkills.professional.length > 0) {
      const technicalSkillsPattern = /(?:technical|programming|software|development|hard|computer)\s+skills[:\s]+(.*?)(?=\n\s*\n|\n(?:[A-Z][a-z]+\s*(?:&\s*)?)+:|\n\s*$)/is;
      const professionalSkillsPattern = /(?:professional|soft|interpersonal|communication|people)\s+skills[:\s]+(.*?)(?=\n\s*\n|\n(?:[A-Z][a-z]+\s*(?:&\s*)?)+:|\n\s*$)/is;
      const generalSkillsPattern = /(?:skills|expertise|competencies)[:\s]+(.*?)(?=\n\s*\n|\n(?:[A-Z][a-z]+\s*(?:&\s*)?)+:|\n\s*$)/is;
      
      // Format skills sections
      const formattedTechnicalSkills = optimizedSkills.technical.length > 0 ? 
        `Technical Skills:\n${optimizedSkills.technical.map(s => `• ${s}`).join('\n')}` : '';
      
      const formattedProfessionalSkills = optimizedSkills.professional.length > 0 ? 
        `Professional Skills:\n${optimizedSkills.professional.map(s => `• ${s}`).join('\n')}` : '';
      
      // Check for existing skills sections
      const technicalMatch = optimized.match(technicalSkillsPattern);
      const professionalMatch = optimized.match(professionalSkillsPattern);
      const generalMatch = optimized.match(generalSkillsPattern);
      
      if (technicalMatch && technicalMatch.index !== undefined) {
        // Replace existing technical skills
        optimized = optimized.substring(0, technicalMatch.index) + 
                    formattedTechnicalSkills + 
                    optimized.substring(technicalMatch.index + technicalMatch[0].length);
      } else if (generalMatch && generalMatch.index !== undefined && optimizedSkills.technical.length > 0) {
        // Replace general skills with technical and professional
        let replacement = formattedTechnicalSkills;
        if (optimizedSkills.professional.length > 0) {
          replacement += '\n\n' + formattedProfessionalSkills;
        }
        
        optimized = optimized.substring(0, generalMatch.index) + 
                    replacement + 
                    optimized.substring(generalMatch.index + generalMatch[0].length);
      } else if (optimizedSkills.technical.length > 0) {
        // Add technical skills if they don't exist
        optimized = optimized + '\n\n' + formattedTechnicalSkills;
      }
      
      // Handle professional skills separately if not already handled
      if (professionalMatch && professionalMatch.index !== undefined) {
        // Replace existing professional skills
        optimized = optimized.substring(0, professionalMatch.index) + 
                    formattedProfessionalSkills + 
                    optimized.substring(professionalMatch.index + professionalMatch[0].length);
      } else if (!generalMatch && optimizedSkills.professional.length > 0 && !optimized.includes(formattedProfessionalSkills)) {
        // Add professional skills if they don't exist and weren't added with technical skills
        optimized = optimized + '\n\n' + formattedProfessionalSkills;
      }
    }
    
    // Replace or enhance the education section
    if (optimizedEducation.length > 0) {
      const educationPattern = /(?:education|qualifications|academic|educational background)[:\s]+(.*?)(?=\n\s*\n|\n(?:[A-Z][a-z]+\s*(?:&\s*)?)+:|\n\s*$)/is;
      const educationMatch = optimized.match(educationPattern);
      
      // Format education entries
      const formattedEducation = `Education:\n${optimizedEducation.map(edu => {
        let entry = `• ${edu.degree}`;
        if (edu.institution) entry += `, ${edu.institution}`;
        if (edu.location) entry += `, ${edu.location}`;
        if (edu.year) entry += ` (${edu.year})`;
        if (edu.gpa) entry += `, GPA: ${edu.gpa}`;
        
        // Add relevant courses if available
        if (edu.relevantCourses && edu.relevantCourses.length > 0) {
          entry += `\n  Relevant Courses: ${edu.relevantCourses.join(', ')}`;
        }
        
        // Add achievements if available
        if (edu.achievements && edu.achievements.length > 0) {
          entry += `\n  Achievements: ${edu.achievements.join(', ')}`;
        }
        
        return entry;
      }).join('\n\n')}`;
      
      if (educationMatch && educationMatch.index !== undefined) {
        // Replace existing education section
        optimized = optimized.substring(0, educationMatch.index) + 
                    formattedEducation + 
                    optimized.substring(educationMatch.index + educationMatch[0].length);
      } else {
        // Add education section if it doesn't exist
        optimized = optimized + '\n\n' + formattedEducation;
      }
    }
    
    // Replace or enhance the achievements section
    if (optimizedAchievements.length > 0) {
      const achievementsPattern = /(?:achievements|accomplishments|key accomplishments|notable achievements)[:\s]+(.*?)(?=\n\s*\n|\n(?:[A-Z][a-z]+\s*(?:&\s*)?)+:|\n\s*$)/is;
      const achievementsMatch = optimized.match(achievementsPattern);
      
      const formattedAchievements = `Achievements:\n${optimizedAchievements.map(a => `• ${a}`).join('\n')}`;
      
      if (achievementsMatch && achievementsMatch.index !== undefined) {
        // Replace existing achievements
        optimized = optimized.substring(0, achievementsMatch.index) + 
                    formattedAchievements + 
                    optimized.substring(achievementsMatch.index + achievementsMatch[0].length);
      } else {
        // Add achievements after profile if they don't exist
        const sections = optimized.split(/\n\s*\n/);
        if (sections.length > 1) {
          sections.splice(1, 0, formattedAchievements);
          optimized = sections.join('\n\n');
        } else {
          optimized = optimized + '\n\n' + formattedAchievements;
        }
      }
    }
    
    // Replace or enhance the goals section
    if (optimizedGoals.length > 0) {
      const goalsPattern = /(?:goals|objectives|targets|career goals|professional goals)[:\s]+(.*?)(?=\n\s*\n|\n(?:[A-Z][a-z]+\s*(?:&\s*)?)+:|\n\s*$)/is;
      const goalsMatch = optimized.match(goalsPattern);
      
      const formattedGoals = `Career Goals:\n${optimizedGoals.map(g => `• ${g}`).join('\n')}`;
      
      if (goalsMatch && goalsMatch.index !== undefined) {
        // Replace existing goals
        optimized = optimized.substring(0, goalsMatch.index) + 
                    formattedGoals + 
                    optimized.substring(goalsMatch.index + goalsMatch[0].length);
      } else {
        // Add goals after achievements or profile
        optimized = optimized + '\n\n' + formattedGoals;
      }
    }
    
    // Replace or enhance the languages section
    if (optimizedLanguages.length > 0) {
      const languagesPattern = /(?:languages|language skills|fluent in|proficient in|spoken languages)[:\s]+(.*?)(?=\n\s*\n|\n(?:[A-Z][a-z]+\s*(?:&\s*)?)+:|\n\s*$)/is;
      const languagesMatch = optimized.match(languagesPattern);
      
      const formattedLanguages = `Languages:\n${optimizedLanguages.map(l => `• ${l}`).join('\n')}`;
      
      if (languagesMatch && languagesMatch.index !== undefined) {
        // Replace existing languages
        optimized = optimized.substring(0, languagesMatch.index) + 
                    formattedLanguages + 
                    optimized.substring(languagesMatch.index + languagesMatch[0].length);
      } else {
        // Add languages after goals, achievements or profile
        optimized = optimized + '\n\n' + formattedLanguages;
      }
    }
    
    return optimized;
  };

  // Add download document handler
  const handleDownloadDocument = useCallback(async () => {
    if (!optimizedText) return;

    try {
      setProcessingStatus("Generating document...");
      
      // Extract structured data from optimized text
      const structuredCV = generateStructuredCV(optimizedText, jobDescription);
      
      // Generate document with contact info and structured CV
      const doc = await generateOptimizedDocument(
        optimizedText, 
        selectedCVName || undefined,
        structuredCV.contactInfo,
        structuredCV
      );
      
      // Generate blob
      const buffer = await Packer.toBlob(doc);
      
      // Save file
      saveAs(buffer, `${selectedCVName ? selectedCVName.replace(/\.[^/.]+$/, '') : 'CV'}_Optimized.docx`);
      
      setProcessingStatus(null);
    } catch (error) {
      console.error("Error generating document:", error);
      setError("Failed to generate document. Please try again.");
    }
  }, [optimizedText, selectedCVName, jobDescription]);

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
          <div className="p-6 border border-gray-700 rounded-md">
            <h3 className="text-xl font-semibold mb-4">Job Match Analysis</h3>
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm text-gray-400">Match Score</p>
                <p className="text-3xl font-bold">{jobMatchAnalysis.score}%</p>
              </div>
              <div className="w-16 h-16 relative">
                {/* Add a circular progress indicator here */}
              </div>
            </div>
            
            {/* Dimensional scores */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div>
                <p className="text-sm text-gray-400">Skills Match</p>
                <p className="text-lg font-semibold">{jobMatchAnalysis.dimensionalScores.skillsMatch}%</p>
              </div>
              <div>
                <p className="text-sm text-gray-400">Experience Match</p>
                <p className="text-lg font-semibold">{jobMatchAnalysis.dimensionalScores.experienceMatch}%</p>
              </div>
              <div>
                <p className="text-sm text-gray-400">Education Match</p>
                <p className="text-lg font-semibold">{jobMatchAnalysis.dimensionalScores.educationMatch}%</p>
              </div>
              <div>
                <p className="text-sm text-gray-400">Industry Fit</p>
                <p className="text-lg font-semibold">{jobMatchAnalysis.dimensionalScores.industryFit}%</p>
              </div>
            </div>

            {/* Recommendations */}
            <div className="mb-6">
              <h4 className="text-lg font-semibold mb-2">Recommendations</h4>
              <ul className="space-y-2">
                {jobMatchAnalysis.recommendations.map((recommendation, index) => (
                  <li key={index} className="flex items-start">
                    <Info className="w-4 h-4 mr-2 mt-1 text-[#B4916C]" />
                    <span>{recommendation}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Keyword matches */}
            <div className="mb-6">
              <h4 className="text-lg font-semibold mb-2">Keyword Matches</h4>
              <div className="flex flex-wrap gap-2">
                {jobMatchAnalysis.matchedKeywords.map((match, index) => (
                  <div
                    key={index}
                    className="px-3 py-1 bg-[#B4916C]/20 border border-[#B4916C]/30 rounded-full text-sm"
                  >
                    {match.keyword}
                  </div>
                ))}
              </div>
            </div>

            {/* Missing keywords */}
            {jobMatchAnalysis.missingKeywords.length > 0 && (
              <div>
                <h4 className="text-lg font-semibold mb-2">Missing Keywords</h4>
                <div className="flex flex-wrap gap-2">
                  {jobMatchAnalysis.missingKeywords.map((keyword, index) => (
                    <div
                      key={index}
                      className="px-3 py-1 bg-red-900/20 border border-red-800/30 rounded-full text-sm"
                    >
                      {keyword.keyword}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Optimized CV */}
          <div className="p-6 border border-gray-700 rounded-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold">Optimized CV</h3>
              <div className="flex gap-2">
                <button
                  onClick={handleDownloadDocument}
                  className="flex items-center px-4 py-2 bg-[#B4916C] text-white rounded-md hover:bg-[#A37F5C] transition-colors"
                  disabled={!optimizedText}
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download DOCX
                </button>
              </div>
            </div>
            <div className="whitespace-pre-wrap font-mono text-sm bg-[#050505] p-4 rounded-md border border-gray-700">
              {optimizedText}
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 