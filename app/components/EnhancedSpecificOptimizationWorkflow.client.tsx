/* use client */
'use client';

import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, BorderStyle, Table, TableRow, TableCell, WidthType, Header, Footer } from 'docx';
import { saveAs } from 'file-saver';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertCircle, RefreshCw, Clock, Info, Download, FileText, CheckCircle } from "lucide-react";
import { analyzeCVContent, optimizeCVForJob } from '@/lib/services/mistral.service';
import { useToast } from "@/hooks/use-toast";
import JobMatchDetailedAnalysis from './JobMatchDetailedAnalysis';
import { downloadDocument, withDownloadTimeout, generateDocumentWithRetry } from '../utils/documentUtils';
import DocumentGenerationProgress from './DocumentGenerationProgress';
import DocumentDownloadStatus from './DocumentDownloadStatus';

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

const generateRecommendations = (
  cvKeywords: string[], 
  jobKeywords: string[], 
  matchedKeywords: KeywordMatch[], 
  missingKeywords: MissingKeyword[],
  overallCompatibility: number,
  sectionAnalysis: Record<string, { score: number; feedback: string }>
): string[] => {
  const recommendations: string[] = [];
  
  // Basic recommendations based on overall score
  if (overallCompatibility < 50) {
    recommendations.push("Your CV needs significant improvements to match this job's requirements.");
  } else if (overallCompatibility < 70) {
    recommendations.push("Your CV shows moderate alignment with this job. Consider the following improvements to strengthen your application.");
  } else {
    recommendations.push("Your CV is well-aligned with this job. Consider these minor adjustments to perfect your application.");
  }
  
  // Keyword-based recommendations
  if (missingKeywords.length > 0) {
    const criticalMissing = missingKeywords.filter(k => k.importance > 70);
    if (criticalMissing.length > 0) {
      recommendations.push(`Add these critical keywords to your CV: ${criticalMissing.slice(0, 5).map(k => k.keyword).join(', ')}.`);
    }
  }
  
  // Section-specific recommendations
  Object.entries(sectionAnalysis).forEach(([section, analysis]) => {
    if (analysis.score < 50) {
      recommendations.push(`Improve your ${section} section: ${analysis.feedback}`);
    }
  });
  
  // Format and structure recommendations
  if (matchedKeywords.length > 0) {
    const lowRelevanceKeywords = matchedKeywords.filter(k => k.relevance < 50);
    if (lowRelevanceKeywords.length > 3) {
      recommendations.push("Emphasize your matching skills more prominently in relevant sections.");
    }
  }
  
  // Add specific recommendations for common issues
  if (sectionAnalysis.skills.score < 70) {
    recommendations.push("Structure your skills section with clear categories and highlight job-relevant skills first.");
  }
  
  if (sectionAnalysis.experience.score < 70) {
    recommendations.push("Quantify your achievements in the experience section with specific metrics and results.");
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

// Add this utility function at the top of the file, after imports
const escapeRegExp = (string: string): string => {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

// Update the analyzeJobMatch function
const analyzeJobMatch = (cvText: string, jobDescription: string): JobMatchAnalysis => {
  const cvKeywords = extractKeywords(cvText);
  const jobKeywords = extractKeywords(jobDescription, true);
  
  // Find keywords that match in the CV
  const matchedKeywords: KeywordMatch[] = [];
  jobKeywords.forEach(keyword => {
    try {
      const escapedKeyword = escapeRegExp(keyword);
      const frequency = (cvText.match(new RegExp(escapedKeyword, 'gi')) || []).length;
      if (frequency > 0) {
        const placement = determineKeywordPlacement(cvText, escapedKeyword);
        const relevance = calculateKeywordRelevance(keyword, jobDescription, placement, frequency);
        matchedKeywords.push({ keyword, relevance, frequency, placement });
      }
    } catch (e) {
      // Fallback to simple string match if regex fails
      if (cvText.toLowerCase().includes(keyword.toLowerCase())) {
        matchedKeywords.push({ 
          keyword, 
          relevance: 70, // Default relevance score
          frequency: 1,  // At least one occurrence
          placement: 'Unknown' 
        });
      }
    }
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

  // Calculate overall compatibility score with weighted components
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
  const recommendations = generateRecommendations(cvKeywords, jobKeywords, matchedKeywords, missingKeywords, overallCompatibility, sectionAnalysis);

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

  // Generate skill gap analysis with categorization
  const skillGap = generateEnhancedSkillGapAnalysis(missingKeywords, jobDescription);

  return {
    score: overallCompatibility,
    matchedKeywords,
    missingKeywords,
    recommendations,
    skillGap,
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

// Update determineKeywordPlacement
const determineKeywordPlacement = (text: string, keyword: string): string => {
  try {
    const escapedKeyword = escapeRegExp(keyword);
    const sectionNames = ['summary', 'profile', 'experience', 'skills', 'education', 'achievements'];
    
    for (const section of sectionNames) {
      const sectionStart = text.toLowerCase().indexOf(section.toLowerCase());
      if (sectionStart !== -1) {
        const keywordMatch = text.slice(sectionStart).match(new RegExp(escapedKeyword, 'i'));
        if (keywordMatch) {
          return section.charAt(0).toUpperCase() + section.slice(1);
        }
      }
    }
    return 'Other';
  } catch (e) {
    return 'Other'; // Fallback if regex fails
  }
};

// Update calculateKeywordRelevance
const calculateKeywordRelevance = (
  keyword: string,
  jobDescription: string,
  placement: string,
  frequency: number
): number => {
  try {
    const escapedKeyword = escapeRegExp(keyword);
    // Base relevance score
    let relevance = 70;
    
    // Adjust based on frequency of the keyword in the job description
    const keywordEmphasis = (jobDescription.match(new RegExp(escapedKeyword, 'gi')) || []).length;
    relevance += Math.min(keywordEmphasis * 2, 10); // Max +10 for emphasis
    
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
    return Math.min(Math.max(relevance, 30), 100); // Keep within 30-100 range
  } catch (e) {
    return 70; // Default relevance if regex fails
  }
};

// Update calculateKeywordImportance
const calculateKeywordImportance = (keyword: string, jobDescription: string): number => {
  try {
    const escapedKeyword = escapeRegExp(keyword);
    // Base importance score
    let importance = 70;
    
    // Check frequency
    const frequency = (jobDescription.match(new RegExp(escapedKeyword, 'gi')) || []).length;
    importance += Math.min(frequency * 2, 10); // Max +10 for frequency
    
    // Check if it's in a requirement context
    const requirementContext = new RegExp(`(required|must have|essential).*?${escapedKeyword}`, 'i');
    if (requirementContext.test(jobDescription)) {
      importance += 10;
    }
    
    // Context importance
    const positionContext = new RegExp(`${escapedKeyword}.*?(?:position|role|job title|title)`, 'i');
    if (positionContext.test(jobDescription)) {
      importance += 10;
    }
    
    return Math.min(Math.max(importance, 30), 100); // Keep within 30-100 range
  } catch (e) {
    return 70; // Default importance if regex fails
  }
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

// Update calculateKeywordDensity
const calculateKeywordDensity = (text: string, keywords: string[]): number => {
  try {
    const words = text.toLowerCase().match(/\b\w+\b/g) || [];
    const totalWords = words.length;
    
    if (totalWords === 0) return 0;
    
    let keywordCount = 0;
    
    keywords.forEach(keyword => {
      try {
        const escapedKeyword = escapeRegExp(keyword);
        const matches = text.match(new RegExp(escapedKeyword, 'gi'));
        keywordCount += matches ? matches.length : 0;
      } catch (e) {
        // Fallback to simple string counting if regex fails
        let count = 0;
        let pos = text.toLowerCase().indexOf(keyword.toLowerCase());
        while (pos !== -1) {
          count++;
          pos = text.toLowerCase().indexOf(keyword.toLowerCase(), pos + 1);
        }
        keywordCount += count;
      }
    });
    
    // Calculate density as a percentage
    const density = (keywordCount / totalWords) * 100;
    
    // Normalize to a 0-100 score
    return Math.min(Math.max(density * 5, 0), 100); // Scale up, but cap at 100
  } catch (e) {
    return 50; // Default score if calculation fails
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

// Update calculateContentRelevance
const calculateContentRelevance = (cvText: string, jobDescription: string): number => {
  try {
    // Extract important keywords from the job description (focused on responsibilities, requirements)
    const jobKeywords = extractKeywords(jobDescription, true);
    
    // Count how many of these keywords appear in the CV
    let matchCount = 0;
    
    jobKeywords.forEach(keyword => {
      try {
        const escapedKeyword = escapeRegExp(keyword);
        const jobMatches = (jobDescription.match(new RegExp(escapedKeyword, 'gi')) || []).length;
        const cvMatches = (cvText.match(new RegExp(escapedKeyword, 'gi')) || []).length;
        
        // If the keyword appears more often in the CV than in the job description, it's a strong match
        if (cvMatches >= jobMatches && jobMatches > 0) {
          matchCount += 2;
        } else if (cvMatches > 0) {
          matchCount += 1;
        }
      } catch (e) {
        // Fallback to simple includes check
        if (cvText.toLowerCase().includes(keyword.toLowerCase())) {
          matchCount += 1;
        }
      }
    });
    
    // Calculate score based on the percentage of matched keywords
    const relevanceScore = (matchCount / (jobKeywords.length * 2)) * 100;
    
    return Math.min(Math.max(relevanceScore, 0), 100);
  } catch (e) {
    return 50; // Default score if calculation fails
  }
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

// Enhanced skill gap analysis with categorization
const generateEnhancedSkillGapAnalysis = (missingKeywords: MissingKeyword[], jobDescription: string): string => {
  if (missingKeywords.length === 0) {
    return "Your CV demonstrates strong alignment with the job requirements. No significant skill gaps were identified.";
  }

  // Categorize missing skills
  const technicalSkills = missingKeywords
    .filter(k => isTechnicalSkill(k.keyword))
    .sort((a, b) => b.importance - a.importance);
  
  const softSkills = missingKeywords
    .filter(k => isSoftSkill(k.keyword))
    .sort((a, b) => b.importance - a.importance);
  
  const domainSkills = missingKeywords
    .filter(k => !isTechnicalSkill(k.keyword) && !isSoftSkill(k.keyword))
    .sort((a, b) => b.importance - a.importance);

  // Build the analysis
  let analysis = 'Based on the job description, the following skill gaps were identified:\n\n';
  
  if (technicalSkills.length > 0) {
    const criticalTech = technicalSkills.filter(k => k.importance > 70).map(k => k.keyword);
    const desiredTech = technicalSkills.filter(k => k.importance <= 70).map(k => k.keyword);
    
    analysis += 'Technical Skills:\n';
    if (criticalTech.length > 0) {
      analysis += `- Critical: ${criticalTech.join(', ')}\n`;
    }
    if (desiredTech.length > 0) {
      analysis += `- Desired: ${desiredTech.join(', ')}\n`;
    }
    analysis += '\n';
  }
  
  if (softSkills.length > 0) {
    analysis += `Soft Skills: ${softSkills.map(k => k.keyword).join(', ')}\n\n`;
  }
  
  if (domainSkills.length > 0) {
    analysis += `Domain Knowledge: ${domainSkills.map(k => k.keyword).join(', ')}\n\n`;
  }
  
  // Add recommendations based on the most important missing skills
  const topMissingSkills = missingKeywords
    .sort((a, b) => b.importance - a.importance)
    .slice(0, 3);
  
  if (topMissingSkills.length > 0) {
    analysis += 'Priority Recommendations:\n';
    topMissingSkills.forEach(skill => {
      analysis += `- Add "${skill.keyword}" to your ${skill.suggestedPlacement}\n`;
    });
  }

  return analysis;
};

// Helper functions for skill categorization
const isTechnicalSkill = (keyword: string): boolean => {
  const technicalPatterns = [
    /\b(?:programming|software|development|engineering|code|coding|algorithm|database|api|framework|library|tool|technology|platform|system|infrastructure|architecture|design pattern|methodology|protocol)\b/i,
    /\b(?:java|python|javascript|typescript|c\+\+|c#|ruby|php|swift|kotlin|go|rust|scala|html|css|sql|nosql|react|angular|vue|node|express|django|flask|spring|laravel|docker|kubernetes|aws|azure|gcp|git|ci\/cd|jenkins|terraform|ansible)\b/i,
    /\b(?:machine learning|artificial intelligence|data science|big data|cloud computing|devops|security|networking|blockchain|iot|mobile|web|frontend|backend|fullstack|qa|testing|automation)\b/i
  ];
  
  return technicalPatterns.some(pattern => pattern.test(keyword));
};

const isSoftSkill = (keyword: string): boolean => {
  const softSkillPatterns = [
    /\b(?:communication|teamwork|leadership|management|problem.solving|critical.thinking|creativity|innovation|adaptability|flexibility|time.management|organization|planning|prioritization|decision.making|conflict.resolution|negotiation|persuasion|presentation|interpersonal|collaboration|emotional.intelligence)\b/i,
    /\b(?:customer.service|client.relations|mentoring|coaching|training|teaching|facilitation|coordination|delegation|supervision|motivation|initiative|proactive|detail.oriented|analytical|strategic|agile|scrum|kanban|lean)\b/i
  ];
  
  return softSkillPatterns.some(pattern => pattern.test(keyword));
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
  // Try to find profile/summary/objective section with more pattern variations
  // Expanded pattern to catch more profile section headers
  const profilePattern = /(?:profile|summary|objective|about(?:\s+me)?|professional\s+summary|personal\s+statement|career\s+profile|bio|introduction)[:\s]+(.*?)(?=\n\s*\n|\n(?:[A-Z][a-z]+\s*(?:&\s*)?)+(?:\s*:|$)|\n\s*$)/is;
  
  const match = text.match(profilePattern);
  
  if (match && match[1] && match[1].trim().length > 10) {
    // Found a valid profile section with reasonable content
    return match[1].trim();
  }
  
  // Secondary pattern for profiles that might be formatted differently
  const secondaryProfilePattern = /^(?:[^\n]*?\b(?:profile|summary|about|professional)\b[^\n]*?\n+)([^\n]+(?:\n[^\n]+){1,5})/i;
  const secondaryMatch = text.match(secondaryProfilePattern);
  
  if (secondaryMatch && secondaryMatch[1] && secondaryMatch[1].trim().length > 10) {
    return secondaryMatch[1].trim();
  }
  
  // If no profile section found, try to extract the first substantive paragraph as a profile
  // Avoid capturing just contact information or short headers
  const firstParagraphPattern = /(?:^|\n\n)([^:\n]{20,}(?:\n[^:\n]{10,}){0,5})/;
  const firstParagraphMatch = text.match(firstParagraphPattern);
  
  if (firstParagraphMatch && firstParagraphMatch[1] && firstParagraphMatch[1].trim().length > 30) {
    // Ensure we have a substantive paragraph (at least 30 chars)
    return firstParagraphMatch[1].trim();
  }
  
  // Last resort: check for an initial paragraph after a short header that might be a name
  const nameFollowedByProfile = /^[^\n]{2,30}\n+([^\n]{20,}(?:\n[^\n]{10,}){0,3})/;
  const nameProfileMatch = text.match(nameFollowedByProfile);
  
  if (nameProfileMatch && nameProfileMatch[1]) {
    return nameProfileMatch[1].trim();
  }
  
  // If all else fails, return empty string
  return '';
};

const optimizeProfile = (profile: string, jobDescription: string, jobKeywords: string[]): string => {
  if (!profile || profile.trim().length === 0) {
    return 'Experienced professional with a proven track record of success, seeking to leverage skills and expertise to excel in a new challenging role.';
  }

  // Clean the profile
  let cleanedProfile = profile.trim();
  
  // Make keyword matching case-insensitive
  const lowercaseKeywords = jobKeywords.map(keyword => keyword.toLowerCase());

  // Check if the profile mentions main keywords
  const containsKeywords = lowercaseKeywords.some(keyword => 
    cleanedProfile.toLowerCase().includes(keyword)
  );

  if (containsKeywords) {
    // Profile already has relevant keywords, just make minor enhancements
    // Ensure it ends with proper punctuation
    if (!cleanedProfile.endsWith('.') && !cleanedProfile.endsWith('!') && !cleanedProfile.endsWith('?')) {
      cleanedProfile += '.';
    }
    
    return cleanedProfile;
  } else {
    // Profile needs more job-specific context
    // Extract job title from description if possible
    const titleMatch = jobDescription.match(/(?:seeking|looking for|hiring|position for)(?: a| an)? ([^\.]+)/i);
    const jobTitle = titleMatch ? titleMatch[1].trim() : "professional role";
    
    // Enhance the profile with job-specific context
    let enhancedProfile = cleanedProfile;
    
    // Ensure it ends with proper punctuation before adding our enhancement
    if (!enhancedProfile.endsWith('.') && !enhancedProfile.endsWith('!') && !enhancedProfile.endsWith('?')) {
      enhancedProfile += '.';
    }
    
    // Add job-specific enhancement
    enhancedProfile += ` Seeking to leverage expertise in ${lowercaseKeywords.slice(0, 3).join(', ')} to excel as a ${jobTitle}.`;
    
    return enhancedProfile;
  }
};

const extractTechnicalSkills = (text: string): string[] => {
  // Initialize arrays for both original and validated skills
  const originalSkills: string[] = [];
  const validatedSkills: string[] = [];

  // Common technical skill keywords to validate against
  const commonTechnicalSkillKeywords = [
    'programming', 'software', 'development', 'language', 'framework', 'tool', 'platform',
    'system', 'database', 'cloud', 'architecture', 'design', 'analysis', 'testing', 'deployment',
    'devops', 'security', 'network', 'infrastructure', 'algorithm', 'data', 'frontend', 'backend',
    'fullstack', 'mobile', 'web', 'api', 'automation', 'scripting', 'configuration', 'management',
    'monitoring', 'optimization', 'performance', 'scalability', 'reliability', 'maintenance',
    'javascript', 'python', 'java', 'c#', 'c++', 'ruby', 'php', 'typescript', 'go', 'rust', 'swift',
    'kotlin', 'scala', 'perl', 'bash', 'powershell', 'sql', 'nosql', 'react', 'angular', 'vue',
    'node', 'express', 'django', 'flask', 'spring', 'laravel', 'rails', 'asp.net', '.net',
    'aws', 'azure', 'gcp', 'docker', 'kubernetes', 'terraform', 'jenkins', 'git', 'ci/cd',
    'agile', 'scrum', 'kanban', 'jira', 'confluence', 'bitbucket', 'github', 'gitlab',
    'rest', 'graphql', 'soap', 'microservices', 'serverless', 'blockchain', 'ai', 'ml',
    'deep learning', 'nlp', 'computer vision', 'big data', 'hadoop', 'spark', 'kafka',
    'elasticsearch', 'mongodb', 'mysql', 'postgresql', 'oracle', 'sql server', 'redis',
    'html', 'css', 'sass', 'less', 'bootstrap', 'tailwind', 'material-ui', 'webpack',
    'babel', 'npm', 'yarn', 'linux', 'unix', 'windows', 'macos', 'ios', 'android'
  ];

  // Helper function to escape special regex characters in a string
  const escapeRegExp = (string: string): string => {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  };

  // Function to validate if a string is likely a technical skill
  const isLikelyTechnicalSkill = (skill: string): boolean => {
    const lowerSkill = skill.toLowerCase();
    
    // Check if it contains any common technical skill keywords
    if (commonTechnicalSkillKeywords.some(keyword => 
      lowerSkill.includes(keyword.toLowerCase()) || 
      keyword.toLowerCase().includes(lowerSkill)
    )) {
      return true;
    }
    
    // Check if it's a programming language, framework, or tool (typically single words or short phrases)
    if (lowerSkill.length > 1 && lowerSkill.length < 20 && /^[a-z0-9\.\+\#\-\_]+$/i.test(lowerSkill)) {
      return true;
    }
    
    // Check for common technical skill patterns
    if (/^[a-z0-9]+ (development|programming|engineering|design|architecture|administration|security)$/i.test(lowerSkill)) {
      return true;
    }
    
    return false;
  };

  // Try multiple patterns to find technical skills section
  const technicalPatterns = [
    /(?:technical|programming|software|development|hard|computer)\s+skills[:\s]+(.*?)(?=\n\s*\n|\n(?:[A-Z][a-z]+\s*(?:&\s*)?)+:|\n\s*$)/is,
    /(?:skills|expertise|competencies)[:\s]+(.*?)(?=\n\s*\n|\n(?:[A-Z][a-z]+\s*(?:&\s*)?)+:|\n\s*$)/is
  ];
  
  // First, try to find a dedicated technical skills section
  let match = null;
  for (const pattern of technicalPatterns) {
    match = text.match(pattern);
    if (match && match[1]) break;
  }
  
  if (match && match[1]) {
    const skillsText = match[1];
    
    // Try to detect if skills are in a list format
    const hasBulletPoints = /^[•\-\*\+\>\·\♦\■\□\◆\◇\○\●\★\☆]\s+/m.test(skillsText);
    
    if (hasBulletPoints) {
      // Extract skills from bullet points
      originalSkills.push(...skillsText
        .split(/\n/)
        .map(skill => skill.replace(/^[•\-\*\+\>\·\♦\■\□\◆\◇\○\●\★\☆]\s*/, '').trim())
        .filter(skill => skill.length > 0));
    } else {
      // Extract skills from comma/semicolon separated list
      originalSkills.push(...skillsText
        .split(/[,;]|\band\b/)
        .map(skill => skill.trim())
        .filter(skill => skill.length > 0));
    }
  }

  // Also look for technical skills throughout the text
  const lines = text.split('\n');
  for (const line of lines) {
    const trimmedLine = line.trim();
    
    // Skip lines that are clearly not skill-related
    if (trimmedLine.length < 3 || /^(?:name|email|phone|address|summary|profile):/i.test(trimmedLine)) {
      continue;
    }
    
    // Look for technical skill keywords in the line
    commonTechnicalSkillKeywords.forEach(keyword => {
      try {
        // Escape special regex characters in the keyword
        const escapedKeyword = escapeRegExp(keyword);
        const regex = new RegExp(`\\b${escapedKeyword}\\b`, 'i');
        if (regex.test(trimmedLine)) {
          // Extract the skill and surrounding context
          const skillRegex = new RegExp(`(?:\\b\\w+\\s+)?${escapedKeyword}(?:\\s+\\w+\\b)?`, 'i');
          const skillMatch = trimmedLine.match(skillRegex);
          if (skillMatch && !originalSkills.includes(skillMatch[0])) {
            originalSkills.push(skillMatch[0]);
          }
        }
      } catch (e) {
        // In case of regex error, try a simple string match instead
        if (trimmedLine.toLowerCase().includes(keyword.toLowerCase()) && !originalSkills.includes(keyword)) {
          originalSkills.push(keyword);
        }
      }
    });
  }

  // Validate and clean up the skills
  originalSkills.forEach(skill => {
    const cleanedSkill = skill.trim();
    if (cleanedSkill && !validatedSkills.includes(cleanedSkill)) {
      if (isLikelyTechnicalSkill(cleanedSkill)) {
        validatedSkills.push(cleanedSkill);
      }
    }
  });

  return validatedSkills;
};

const extractProfessionalSkills = (text: string): string[] => {
  // Initialize arrays for both original and validated skills
  const originalSkills: string[] = [];
  const validatedSkills: string[] = [];

  // Common professional skill keywords to validate against
  const commonProfessionalSkillKeywords = [
    'communication', 'leadership', 'teamwork', 'problem-solving', 'critical thinking',
    'time management', 'organization', 'adaptability', 'flexibility', 'creativity',
    'interpersonal', 'negotiation', 'conflict resolution', 'decision making', 'emotional intelligence',
    'presentation', 'public speaking', 'writing', 'listening', 'customer service',
    'project management', 'strategic planning', 'analytical', 'research', 'attention to detail',
    'multitasking', 'prioritization', 'collaboration', 'mentoring', 'coaching',
    'facilitation', 'delegation', 'motivation', 'persuasion', 'networking',
    'relationship building', 'cultural awareness', 'diversity', 'inclusion', 'empathy',
    'patience', 'resilience', 'self-motivation', 'initiative', 'integrity',
    'ethics', 'professionalism', 'accountability', 'reliability', 'resourcefulness'
  ];

  // Reusing the escapeRegExp function defined in extractTechnicalSkills
  const escapeRegExp = (string: string): string => {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  };

  // Function to validate if a string is likely a professional skill
  const isLikelyProfessionalSkill = (skill: string): boolean => {
    const lowerSkill = skill.toLowerCase();
    
    // Check if it contains any common professional skill keywords
    if (commonProfessionalSkillKeywords.some(keyword => 
      lowerSkill.includes(keyword.toLowerCase()) || 
      keyword.toLowerCase().includes(lowerSkill)
    )) {
      return true;
    }
    
    // Check for common professional skill patterns
    if (/^(strong|excellent|effective|advanced) [a-z]+ (skills|abilities|capabilities)$/i.test(lowerSkill)) {
      return true;
    }
    
    // Check for other professional skill indicators
    if (/leadership|management|communication|teamwork|collaboration/i.test(lowerSkill)) {
      return true;
    }
    
    return false;
  };

  // Try multiple patterns to find professional skills section
  const professionalPatterns = [
    /(?:soft|professional|interpersonal|personal|communication)\s+skills[:\s]+(.*?)(?=\n\s*\n|\n(?:[A-Z][a-z]+\s*(?:&\s*)?)+:|\n\s*$)/is,
    /(?:competencies|abilities|capabilities)[:\s]+(.*?)(?=\n\s*\n|\n(?:[A-Z][a-z]+\s*(?:&\s*)?)+:|\n\s*$)/is
  ];
  
  // First, try to find a dedicated professional skills section
  let match = null;
  for (const pattern of professionalPatterns) {
    match = text.match(pattern);
    if (match && match[1]) break;
  }
  
  if (match && match[1]) {
    const skillsText = match[1];
    
    // Try to detect if skills are in a list format
    const hasBulletPoints = /^[•\-\*\+\>\·\♦\■\□\◆\◇\○\●\★\☆]\s+/m.test(skillsText);
    
    if (hasBulletPoints) {
      // Extract skills from bullet points
      originalSkills.push(...skillsText
        .split(/\n/)
        .map(skill => skill.replace(/^[•\-\*\+\>\·\♦\■\□\◆\◇\○\●\★\☆]\s*/, '').trim())
        .filter(skill => skill.length > 0));
    } else {
      // Extract skills from comma/semicolon separated list
      originalSkills.push(...skillsText
        .split(/[,;]|\band\b/)
        .map(skill => skill.trim())
        .filter(skill => skill.length > 0));
    }
  }

  // Also look for professional skills throughout the text
  const lines = text.split('\n');
  for (const line of lines) {
    const trimmedLine = line.trim();
    
    // Skip lines that are clearly not skill-related
    if (trimmedLine.length < 3 || /^(?:name|email|phone|address|summary|profile):/i.test(trimmedLine)) {
      continue;
    }
    
    // Look for professional skill keywords in the line
    commonProfessionalSkillKeywords.forEach(keyword => {
      try {
        // Escape special regex characters in the keyword
        const escapedKeyword = escapeRegExp(keyword);
        const regex = new RegExp(`\\b${escapedKeyword}\\b`, 'i');
        if (regex.test(trimmedLine)) {
          // Extract the skill and surrounding context
          const skillRegex = new RegExp(`(?:\\b\\w+\\s+)?${escapedKeyword}(?:\\s+\\w+\\b)?`, 'i');
          const skillMatch = trimmedLine.match(skillRegex);
          if (skillMatch && !originalSkills.includes(skillMatch[0])) {
            originalSkills.push(skillMatch[0]);
          }
        }
      } catch (e) {
        // In case of regex error, try a simple string match instead
        if (trimmedLine.toLowerCase().includes(keyword.toLowerCase()) && !originalSkills.includes(keyword)) {
          originalSkills.push(keyword);
        }
      }
    });
  }

  // Validate and clean up the skills
  originalSkills.forEach(skill => {
    const cleanedSkill = skill.trim();
    if (cleanedSkill && !validatedSkills.includes(cleanedSkill)) {
      if (isLikelyProfessionalSkill(cleanedSkill)) {
        validatedSkills.push(cleanedSkill);
      }
    }
  });

  return validatedSkills;
};

const extractAchievements = (text: string): string[] => {
  // Try multiple patterns to find achievements section
  const achievementPatterns = [
    /(?:achievements|accomplishments|awards|honors|recognitions)[:\s]+(.*?)(?=\n\s*\n|\n(?:[A-Z][a-z]+\s*(?:&\s*)?)+:|\n\s*$)/is,
    /(?:key accomplishments|notable achievements|significant contributions)[:\s]+(.*?)(?=\n\s*\n|\n(?:[A-Z][a-z]+\s*(?:&\s*)?)+:|\n\s*$)/is
  ];
  
  let match = null;
  for (const pattern of achievementPatterns) {
    match = text.match(pattern);
    if (match && match[1]) break;
  }
  
  if (!match || !match[1]) {
    // If no dedicated section, try to extract achievements from experience sections
    const experienceMatches = text.match(/(?:experience|work experience|employment|professional experience)[:\s]+(.*?)(?=\n\s*\n|\n(?:[A-Z][a-z]+\s*(?:&\s*)?)+:|\n\s*$)/is);
    
    if (experienceMatches && experienceMatches[1]) {
      const experienceText = experienceMatches[1];
      
      // Look for achievement indicators in bullet points
      const achievementIndicators = [
        /increased|improved|reduced|saved|achieved|awarded|recognized|led|managed|developed|created|implemented|launched|designed|established|negotiated|secured|won|exceeded/i
      ];
      
      const achievements: string[] = [];
      
      // Extract bullet points that look like achievements
      const bulletPoints = experienceText.split(/\n/).filter(line => 
        /^[•\-\*\+\>\·\♦\■\□\◆\◇\○\●\★\☆]\s+/.test(line)
      );
      
      bulletPoints.forEach(point => {
        const cleanPoint = point.replace(/^[•\-\*\+\>\·\♦\■\□\◆\◇\○\●\★\☆]\s*/, '').trim();
        if (achievementIndicators.some(indicator => indicator.test(cleanPoint))) {
          achievements.push(cleanPoint);
        }
      });
      
      return achievements;
    }
    
    return [];
  }
  
  // Extract achievements from the matched section
  const achievementsText = match[1];
  
  // Try to detect if achievements are in a list format
  const hasBulletPoints = /^[•\-\*\+\>\·\♦\■\□\◆\◇\○\●\★\☆]\s+/m.test(achievementsText);
  
  if (hasBulletPoints) {
    // Extract achievements from bullet points
    return achievementsText
      .split(/\n/)
      .map(achievement => achievement.replace(/^[•\-\*\+\>\·\♦\■\□\◆\◇\○\●\★\☆]\s*/, '').trim())
      .filter(achievement => achievement.length > 0);
  } else {
    // Extract achievements from paragraph format
    return achievementsText
      .split(/\.\s+/)
      .map(achievement => achievement.trim().replace(/\.$/, '') + '.')
      .filter(achievement => achievement.length > 3);
  }
};

const extractGoals = (text: string): string[] => {
  // Try multiple patterns to find goals section
  const goalPatterns = [
    /(?:goals|objectives|career goals|professional goals|aspirations)[:\s]+(.*?)(?=\n\s*\n|\n(?:[A-Z][a-z]+\s*(?:&\s*)?)+:|\n\s*$)/is,
    /(?:seeking|looking for|aiming for|targeting)[:\s]+(.*?)(?=\n\s*\n|\n(?:[A-Z][a-z]+\s*(?:&\s*)?)+:|\n\s*$)/is
  ];
  
  let match = null;
  for (const pattern of goalPatterns) {
    match = text.match(pattern);
    if (match && match[1]) break;
  }
  
  // If no dedicated section, try to extract goals from profile/summary
  if (!match || !match[1]) {
    const profileMatches = text.match(/(?:profile|summary|about me|professional summary)[:\s]+(.*?)(?=\n\s*\n|\n(?:[A-Z][a-z]+\s*(?:&\s*)?)+:|\n\s*$)/is);
    
    if (profileMatches && profileMatches[1]) {
      const profileText = profileMatches[1];
      
      // Look for goal indicators in profile
      const goalIndicators = [
        /seeking|looking for|aiming|goal|objective|aspire|hope to|plan to|intend to|desire to/i
      ];
      
      const goals: string[] = [];
      
      // Extract sentences that look like goals
      const sentences = profileText.split(/\.\s+/);
      
      sentences.forEach(sentence => {
        const cleanSentence = sentence.trim().replace(/\.$/, '') + '.';
        if (goalIndicators.some(indicator => indicator.test(cleanSentence))) {
          goals.push(cleanSentence);
        }
      });
      
      return goals;
    }
    
    return [];
  }
  
  // Extract goals from the matched section
  const goalsText = match[1];
  
  // Try to detect if goals are in a list format
  const hasBulletPoints = /^[•\-\*\+\>\·\♦\■\□\◆\◇\○\●\★\☆]\s+/m.test(goalsText);
  
  if (hasBulletPoints) {
    // Extract goals from bullet points
    return goalsText
      .split(/\n/)
      .map(goal => goal.replace(/^[•\-\*\+\>\·\♦\■\□\◆\◇\○\●\★\☆]\s*/, '').trim())
      .filter(goal => goal.length > 0);
  } else {
    // Extract goals from paragraph format
    return goalsText
      .split(/\.\s+/)
      .map(goal => goal.trim().replace(/\.$/, '') + '.')
      .filter(goal => goal.length > 3);
  }
};

const extractLanguages = (text: string): string[] => {
  // Try multiple patterns to find languages section
  const languagePatterns = [
    /(?:languages|language skills|language proficiency)[:\s]+(.*?)(?=\n\s*\n|\n(?:[A-Z][a-z]+\s*(?:&\s*)?)+:|\n\s*$)/is,
    /(?:fluent in|proficient in|speak|written and verbal)[:\s]+(.*?)(?=\n\s*\n|\n(?:[A-Z][a-z]+\s*(?:&\s*)?)+:|\n\s*$)/is
  ];
  
  let match = null;
  for (const pattern of languagePatterns) {
    match = text.match(pattern);
    if (match && match[1]) break;
  }
  
  if (!match || !match[1]) return [];
  
  // Extract languages from the matched section
  const languagesText = match[1];
  
  // Try to detect if languages are in a list format
  const hasBulletPoints = /^[•\-\*\+\>\·\♦\■\□\◆\◇\○\●\★\☆]\s+/m.test(languagesText);
  
  let extractedLanguages: string[] = [];
  
  if (hasBulletPoints) {
    // Extract languages from bullet points
    extractedLanguages = languagesText
      .split(/\n/)
      .map(language => language.replace(/^[•\-\*\+\>\·\♦\■\□\◆\◇\○\●\★\☆]\s*/, '').trim())
      .filter(language => language.length > 0);
  } else {
    // Extract languages from comma/semicolon separated list
    extractedLanguages = languagesText
      .split(/[,;]|\band\b/)
      .map(language => language.trim())
      .filter(language => language.length > 0);
  }
  
  // Common language names to validate against
  const commonLanguages = [
    'english', 'spanish', 'french', 'german', 'italian', 'portuguese', 'russian', 'chinese',
    'mandarin', 'cantonese', 'japanese', 'korean', 'arabic', 'hindi', 'bengali', 'punjabi',
    'urdu', 'turkish', 'dutch', 'swedish', 'norwegian', 'danish', 'finnish', 'polish',
    'czech', 'slovak', 'hungarian', 'romanian', 'bulgarian', 'greek', 'hebrew', 'thai',
    'vietnamese', 'indonesian', 'malay', 'tagalog', 'filipino', 'swahili', 'zulu', 'xhosa',
    'afrikaans', 'amharic', 'armenian', 'azerbaijani', 'basque', 'belarusian', 'bosnian',
    'catalan', 'croatian', 'esperanto', 'estonian', 'georgian', 'gujarati', 'haitian',
    'hausa', 'icelandic', 'igbo', 'irish', 'javanese', 'kannada', 'kazakh', 'khmer',
    'kurdish', 'kyrgyz', 'lao', 'latin', 'latvian', 'lithuanian', 'luxembourgish',
    'macedonian', 'malagasy', 'malayalam', 'maltese', 'maori', 'marathi', 'mongolian',
    'nepali', 'pashto', 'persian', 'farsi', 'sanskrit', 'serbian', 'sesotho', 'sinhala',
    'slovenian', 'somali', 'sundanese', 'tajik', 'tamil', 'telugu', 'ukrainian', 'uzbek',
    'welsh', 'yiddish', 'yoruba'
  ];
  
  // Filter out non-language entries
  return extractedLanguages.filter(language => {
    const lowerLanguage = language.toLowerCase();
    
    // Check if it contains a common language name
    return commonLanguages.some(lang => 
      lowerLanguage.includes(lang) || 
      // Handle proficiency levels
      /\b(native|fluent|proficient|intermediate|beginner|basic|advanced|business|conversational)\b/i.test(lowerLanguage)
    );
  });
};

// Function to optimize achievements based on job description
const optimizeAchievements = (achievements: string[], jobDescription: string, jobKeywords: string[]): string[] => {
  if (achievements.length === 0) return [];
  
  // Score achievements based on relevance to job description
  const scoredAchievements = achievements.map(achievement => {
    let score = 0;
    
    // Check for keyword matches
    jobKeywords.forEach(keyword => {
      if (achievement.toLowerCase().includes(keyword.toLowerCase())) {
        score += 2;
      }
    });
    
    // Check for quantifiable results
    if (/\d+%|\d+ percent|increased|decreased|reduced|improved|saved|generated/i.test(achievement)) {
      score += 3;
    }
    
    // Check for leadership indicators
    if (/led|managed|supervised|directed|coordinated|spearheaded|initiated/i.test(achievement)) {
      score += 2;
    }
    
    // Check for innovation indicators
    if (/developed|created|designed|implemented|launched|established|pioneered/i.test(achievement)) {
      score += 2;
    }
    
    return { achievement, score };
  });
  
  // Sort by score (highest first)
  scoredAchievements.sort((a, b) => b.score - a.score);
  
  // Return top achievements (max 5)
  return scoredAchievements.slice(0, 5).map(item => item.achievement);
};

// Function to optimize goals based on job description
const optimizeGoals = (goals: string[], jobDescription: string, jobKeywords: string[]): string[] => {
  if (goals.length === 0) return [];
  
  // Score goals based on relevance to job description
  const scoredGoals = goals.map(goal => {
    let score = 0;
    
    // Check for keyword matches
    jobKeywords.forEach(keyword => {
      if (goal.toLowerCase().includes(keyword.toLowerCase())) {
        score += 2;
      }
    });
    
    // Check for alignment with common job objectives
    if (/growth|advancement|development|learning|contribute|impact|value|success/i.test(goal)) {
      score += 2;
    }
    
    // Check for specificity
    if (/specific|particular|certain|definite|precise/i.test(goal)) {
      score += 1;
    }
    
    return { goal, score };
  });
  
  // Sort by score (highest first)
  scoredGoals.sort((a, b) => b.score - a.score);
  
  // Return top goals (max 3)
  return scoredGoals.slice(0, 3).map(item => item.goal);
};

// Function to optimize languages based on job description
const optimizeLanguages = (languages: string[], jobDescription: string): string[] => {
  if (languages.length === 0) return [];
  
  // Extract language requirements from job description
  const languageRequirements: string[] = [];
  const languagePatterns = [
    /(?:language requirements|language skills|fluent in|proficient in)[:\s]+([^.]+)/gi,
    /(?:ability to speak|ability to write|ability to communicate in)[:\s]+([^.]+)/gi
  ];
  
  languagePatterns.forEach(pattern => {
    const matches = [...jobDescription.matchAll(pattern)];
    matches.forEach(match => {
      if (match[1]) {
        // Split by common separators and add to requirements
        match[1].split(/[,;]|\band\b/).forEach(lang => {
          const trimmedLang = lang.trim();
          if (trimmedLang && !languageRequirements.includes(trimmedLang)) {
            languageRequirements.push(trimmedLang);
          }
        });
      }
    });
  });
  
  // Score languages based on relevance to job description
  const scoredLanguages = languages.map(language => {
    let score = 0;
    
    // Check for exact matches with requirements
    languageRequirements.forEach(req => {
      if (language.toLowerCase().includes(req.toLowerCase()) || 
          req.toLowerCase().includes(language.toLowerCase())) {
        score += 3;
      }
    });
    
    // Check for proficiency level
    if (/native|fluent|proficient|advanced|business/i.test(language)) {
      score += 2;
    } else if (/intermediate/i.test(language)) {
      score += 1;
    }
    
    // English is almost always valuable
    if (/english/i.test(language)) {
      score += 2;
    }
    
    return { language, score };
  });
  
  // Sort by score (highest first)
  scoredLanguages.sort((a, b) => b.score - a.score);
  
  // Return all languages, prioritized by relevance
  return scoredLanguages.map(item => item.language);
};

// Function to optimize skills based on job description
const optimizeSkills = (
  technicalSkills: string[],
  professionalSkills: string[],
  jobDescription: string,
  jobKeywords: string[]
): SkillsData => {
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
  
  // Optimize technical skills - start with original CV skills
  let optimizedTechnical = [...technicalSkills];
  
  // Add missing technical skills from requirements
  technicalRequirements.forEach(req => {
    const hasMatchingSkill = optimizedTechnical.some(skill => 
      skill.toLowerCase().includes(req.toLowerCase()) || 
      req.toLowerCase().includes(skill.toLowerCase())
    );
    
    if (!hasMatchingSkill) {
      optimizedTechnical.push(req);
    }
  });
  
  // Optimize professional skills - start with original CV skills
  let optimizedProfessional = [...professionalSkills];
  
  // Add missing professional skills from requirements
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
  
  // Limit the number of skills to a reasonable amount
  const maxSkills = 15;
  optimizedTechnical = optimizedTechnical.slice(0, maxSkills);
  optimizedProfessional = optimizedProfessional.slice(0, maxSkills);
  
  return {
    technical: optimizedTechnical,
    professional: optimizedProfessional
  };
};

// Function to optimize education based on job description
const optimizeEducation = (
  education: EducationEntry[],
  jobDescription: string,
  jobKeywords: string[]
): EducationEntry[] => {
  if (education.length === 0) return [];
  
  // Extract education requirements from job description
  const educationRequirements: string[] = [];
  const educationPatterns = [
    /(?:education requirements|qualifications|degree)[:\s]+([^.]+)/gi,
    /(?:bachelor'?s|master'?s|phd|doctorate|degree|certification)[:\s]+([^.]+)/gi
  ];
  
  educationPatterns.forEach(pattern => {
    const matches = [...jobDescription.matchAll(pattern)];
    matches.forEach(match => {
      if (match[1]) {
        // Split by common separators and add to requirements
        match[1].split(/[,;]|\band\b|\bor\b/).forEach(req => {
          const trimmedReq = req.trim();
          if (trimmedReq && !educationRequirements.includes(trimmedReq)) {
            educationRequirements.push(trimmedReq);
          }
        });
      }
    });
  });
  
  // Optimize each education entry
  return education.map(edu => {
    // Create a copy of the education entry to modify
    const optimizedEdu: EducationEntry = { ...edu };
    
    // Check if we need to highlight relevant courses based on job keywords
    if (edu.relevantCourses && Array.isArray(edu.relevantCourses)) {
      // Score each course based on relevance to job description
      const scoredCourses = edu.relevantCourses.map(course => {
        let score = 0;
        
        // Check for keyword matches
        jobKeywords.forEach(keyword => {
          if (course.toLowerCase().includes(keyword.toLowerCase())) {
            score += 2;
          }
        });
        
        // Check for matches with education requirements
        educationRequirements.forEach(req => {
          if (course.toLowerCase().includes(req.toLowerCase())) {
            score += 3;
          }
        });
        
        return { course, score };
      });
      
      // Sort by score (highest first)
      scoredCourses.sort((a, b) => b.score - a.score);
      
      // Take top courses (max 5)
      optimizedEdu.relevantCourses = scoredCourses.slice(0, 5).map(item => item.course);
    }
    
    // Check if we need to highlight achievements based on job keywords
    if (edu.achievements && Array.isArray(edu.achievements)) {
      // Score each achievement based on relevance to job description
      const scoredAchievements = edu.achievements.map(achievement => {
        let score = 0;
        
        // Check for keyword matches
        jobKeywords.forEach(keyword => {
          if (achievement.toLowerCase().includes(keyword.toLowerCase())) {
            score += 2;
          }
        });
        
        // Check for quantifiable results
        if (/\d+%|\d+ percent|increased|decreased|reduced|improved|saved|generated/i.test(achievement)) {
          score += 3;
        }
        
        // Check for leadership indicators
        if (/led|managed|supervised|directed|coordinated|spearheaded|initiated/i.test(achievement)) {
          score += 2;
        }
        
        return { achievement, score };
      });
      
      // Sort by score (highest first)
      scoredAchievements.sort((a, b) => b.score - a.score);
      
      // Take top achievements (max 3)
      optimizedEdu.achievements = scoredAchievements.slice(0, 3).map(item => item.achievement);
    }
    
    return optimizedEdu;
  });
};

// Add generateOptimizedDocument function
const generateOptimizedDocument = async (content: string, name: string = 'CV', contactInfo?: StructuredCV['contactInfo'], structuredCV?: StructuredCV): Promise<Document> => {
  try {
    // Define brand color
    const brandColor = 'B4916C';
    
    // Get current date for footer
    const currentDate = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    
    // Define section order
    const sectionOrder = [
      'HEADER',
      'PROFILE', 
      'SUMMARY',
      'ACHIEVEMENTS',
      'GOALS', 
      'CAREER GOALS',
      'LANGUAGES',
      'SKILLS', 
      'TECHNICAL SKILLS', 
      'PROFESSIONAL SKILLS',
      'EDUCATION',
      'EXPERIENCE'
    ] as const;
    
    type SectionName = typeof sectionOrder[number];
    
    // Parse content into sections if structuredCV is not provided
    let sections: Record<SectionName, string[]> = {} as Record<SectionName, string[]>;
    
    if (!structuredCV) {
      // Initialize sections object
      sectionOrder.forEach(section => {
        sections[section] = [];
      });
      
      // Split content by section headers
      const sectionRegex = /^([A-Z][A-Z\s]+):\s*$/gm;
      const lines = content.split('\n');
      let currentSection = '';
      let sectionContent: string[] = [];
      
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
          // If we were processing a section, save it
          if (currentSection && sectionContent.length > 0) {
            sections[currentSection as SectionName] = sectionContent;
          }
          
          currentSection = sectionMatch[1].trim();
          sectionContent = [];
          continue;
        }
        
        // Add content to current section
        if (currentSection) {
          sectionContent.push(line);
        }
      }
      
      // Save the last section
      if (currentSection && sectionContent.length > 0) {
        sections[currentSection as SectionName] = sectionContent;
      }
    } else {
      // Use the provided structuredCV
      sections = {
        'HEADER': [structuredCV.name, ...(contactInfo ? [
          [
            contactInfo.email,
            contactInfo.phone,
            contactInfo.location
          ].filter(Boolean).join(' | '),
          [
            contactInfo.linkedin,
            contactInfo.website
          ].filter(Boolean).join(' | ')
        ] : [])],
        'PROFILE': [structuredCV.profile],
        'SUMMARY': [structuredCV.subheader],
        'ACHIEVEMENTS': structuredCV.achievements,
        'GOALS': structuredCV.goals,
        'CAREER GOALS': [],
        'LANGUAGES': structuredCV.languages.map(lang => `• ${lang}`),
        'SKILLS': [],
        'TECHNICAL SKILLS': structuredCV.skills.technical.map(skill => `• ${skill}`),
        'PROFESSIONAL SKILLS': structuredCV.skills.professional.map(skill => `• ${skill}`),
        'EDUCATION': structuredCV.education.map(edu => {
          const parts = [];
          if (edu.degree) parts.push(edu.degree);
          if (edu.institution) parts.push(edu.institution);
          if (edu.location) parts.push(edu.location);
          
          const mainLine = parts.join(', ');
          const subLines = [];
          
          if (edu.year || edu.gpa) {
            subLines.push([
              edu.year,
              edu.gpa ? `GPA: ${edu.gpa}` : null
            ].filter(Boolean).join(', '));
          }
          
          if (edu.relevantCourses && edu.relevantCourses.length > 0) {
            subLines.push('Relevant Courses:');
            subLines.push(...edu.relevantCourses.map(course => `• ${course}`));
          }
          
          if (edu.achievements && edu.achievements.length > 0) {
            subLines.push('Achievements:');
            subLines.push(...edu.achievements.map(achievement => `• ${achievement}`));
          }
          
          return [mainLine, ...subLines];
        }).flat(),
        'EXPERIENCE': structuredCV.experience.map(exp => {
          const parts = [];
          if (exp.title) parts.push(exp.title);
          if (exp.startDate || exp.endDate) {
            parts.push(`${exp.startDate || ''} - ${exp.endDate || 'Present'}`);
          }
          return parts;
        }).flat()
      } as Record<SectionName, string[]>;
    }
    
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
          ...(sections['HEADER'] ? [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: {
                after: 200
              },
              children: sections['HEADER'].map((line: string, index: number, array: string[]) => [
                new TextRun({
                  text: line,
                  style: 'ContactInfo'
                }),
                ...(index < array.length - 1 ? [
                  new TextRun({
                    text: ' | ',
                    style: 'ContactSeparator'
                  })
                ] : [])
              ]).flat()
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
          
          // Add each section in order
          ...sectionOrder.flatMap((sectionName: SectionName) => {
            // Skip empty sections
            if (!sections[sectionName] || sections[sectionName].length === 0) {
              return [];
            }
            
            const paragraphs = [];
            
            // Add section header (except for Header section)
            if (sectionName !== 'HEADER') {
              paragraphs.push(
                new Paragraph({
                  children: [
                    new TextRun({
                      text: sectionName,
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
                })
              );
            }
            
            // Add section content
            const content = sections[sectionName];
            if (Array.isArray(content)) {
              content.forEach(item => {
                if (typeof item === 'string') {
                  // Check if item is a bullet point
                  if (item.startsWith('•') || item.startsWith('-') || item.startsWith('*')) {
                    paragraphs.push(
                      new Paragraph({
                        children: [
                          new TextRun({
                            text: '• ',
                            bold: true,
                            color: brandColor
                          }),
                          new TextRun({
                            text: item.replace(/^[•\-*]\s*/, '')
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
                    );
                  } else {
                    paragraphs.push(
                      new Paragraph({
                        text: item,
                        spacing: {
                          before: 120,
                          after: 120
                        }
                      })
                    );
                  }
                }
              });
            }
            
            return paragraphs;
          }),
          
          // Footer
          new Paragraph({
            children: [
              new TextRun({
                text: `${name} | ${currentDate}`,
                size: 20,
                color: '666666'
              })
            ],
            spacing: {
              before: 400
            },
            alignment: AlignmentType.CENTER,
            border: {
              top: {
                color: brandColor,
                space: 1,
                style: BorderStyle.SINGLE,
                size: 6
              }
            }
          })
        ]
      }]
    });
    
    return doc;
  } catch (error) {
    console.error('Error generating document:', error);
    throw new Error(`Failed to generate document: ${error instanceof Error ? error.message : String(error)}`);
  }
};

export default function EnhancedSpecificOptimizationWorkflow({ cvs = [] }: EnhancedSpecificOptimizationWorkflowProps): JSX.Element {
  const { toast } = useToast();
  const [selectedCVId, setSelectedCVId] = useState<string>('');
  const [selectedCVName, setSelectedCVName] = useState<string>('');
  const [originalText, setOriginalText] = useState<string | null>(null);
  const [optimizedText, setOptimizedText] = useState<string | null>(null);
  const [jobDescription, setJobDescription] = useState<string>('');
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [isOptimizing, setIsOptimizing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [documentError, setDocumentError] = useState<string | null>(null);
  const [jobMatchAnalysis, setJobMatchAnalysis] = useState<JobMatchAnalysis | null>(null);
  const [isGeneratingDocument, setIsGeneratingDocument] = useState<boolean>(false);
  
  // Processing state variables
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isProcessed, setIsProcessed] = useState<boolean>(false);
  const [processingProgress, setProcessingProgress] = useState<number>(0);
  const [processingStatus, setProcessingStatus] = useState<string>('');
  const [activeTab, setActiveTab] = useState('jobDescription');
  const [processingTooLong, setProcessingTooLong] = useState<boolean>(false);
  const [activeAnalysisTab, setActiveAnalysisTab] = useState('keywords');
  
  const [structuredCV, setStructuredCV] = useState<StructuredCV | null>(null);

  // Add a new state variable for document caching
  const [cachedDocument, setCachedDocument] = useState<{
    doc: Document | null;
    blob: Blob | null;
    text: string | null;
    timestamp: number;
    url?: string; // Add optional url property
  }>({
    doc: null,
    blob: null,
    text: null,
    timestamp: 0
  });

  // Add jobTitle state variable
  const [jobTitle, setJobTitle] = useState<string>('');

  // Add these state variables
  const [isDownloading, setIsDownloading] = useState<boolean>(false);
  const [isDownloadComplete, setIsDownloadComplete] = useState<boolean>(false);

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
      
      // Simulate processing with progress updates
      const simulateProcessing = () => {
        let progress = 0;
        const interval = setInterval(() => {
          // More granular progress updates based on current progress
          const increment = progress < 60 ? Math.random() * 5 :  // Faster at start
                           progress < 80 ? Math.random() * 3 :   // Slower in middle
                           progress < 95 ? Math.random() * 1 :   // Very slow near end
                           Math.random() * 0.5;                  // Extremely slow at final stage
          
          progress += increment;
          
          // Set intermediate progress updates
          setProcessingProgress(Math.floor(progress));
          
          // Update status messages
          if (progress < 15) {
            setProcessingStatus("Analyzing job description and requirements...");
          } else if (progress < 30) {
            setProcessingStatus("Extracting key skills and qualifications...");
          } else if (progress < 45) {
            setProcessingStatus("Analyzing CV content and structure...");
          } else if (progress < 60) {
            setProcessingStatus("Matching CV content to job requirements...");
          } else if (progress < 75) {
            setProcessingStatus("Optimizing CV sections and formatting...");
          } else if (progress < 85) {
            setProcessingStatus("Enhancing content relevance...");
          } else if (progress < 95) {
            setProcessingStatus("Finalizing optimizations...");
          } else {
            setProcessingStatus("Completing final adjustments...");
          }
          
          // If we've reached 100%, complete the process
          if (progress >= 100) {
            clearInterval(interval);
            completeOptimization();
          }
        }, 500); // Update interval
        
        // Run the actual optimization process
        actualOptimizationProcess();
        
        // Set multiple timeouts for progressive warnings
        setTimeout(() => {
          if (isProcessing) {
            setProcessingStatus(prevStatus => `${prevStatus} (Still processing...)`);
          }
        }, 15000); // 15 seconds
        
        setTimeout(() => {
          if (isProcessing) {
            setProcessingStatus(prevStatus => `${prevStatus} (Almost there...)`);
          }
        }, 25000); // 25 seconds
        
        setTimeout(() => {
          if (isProcessing) {
            setProcessingTooLong(true);
            setProcessingStatus(prevStatus => 
              prevStatus ? 
                (prevStatus.includes("taking longer") 
                  ? prevStatus 
                  : `${prevStatus} (This is taking longer than usual, but please wait...)`)
                : "Processing is taking longer than usual, please wait..."
            );
          }
        }, 30000); // 30 seconds
        
        // Cleanup function
        return () => {
          clearInterval(interval);
        };
      };

      // Actual optimization process using Mistral AI
      const actualOptimizationProcess = async () => {
        try {
          if (!originalText || !jobDescription) {
            throw new Error("Missing original CV text or job description");
          }
          
          // Step 1: Call Mistral API to optimize the CV
          const optimizationResult = await optimizeCVForJob(originalText, jobDescription);
          
          if (!optimizationResult || !optimizationResult.optimizedContent) {
            throw new Error("Failed to optimize CV content");
          }
          
          // Store the optimized text for use later
          setOptimizedText(optimizationResult.optimizedContent);
          
          // Step 2: Extract job title from job description
          const jobTitleMatch = jobDescription.match(/(?:job title|position|role|job)[:\s]+([^\n.]+)/i);
          if (jobTitleMatch && jobTitleMatch[1]) {
            setJobTitle(jobTitleMatch[1].trim());
          }
          
          // Step 3: Generate job match analysis
          const analysis = analyzeJobMatch(optimizationResult.optimizedContent, jobDescription);
          setJobMatchAnalysis(analysis);
          
          // Step 4: Generate structured CV from optimized text
          const structured = generateStructuredCV(optimizationResult.optimizedContent, jobDescription);
          setStructuredCV(structured);
          
        } catch (error) {
          console.error("Error in CV optimization process:", error);
          
          // If API fails, fallback to client-side optimization
          try {
            console.log("API optimization failed, falling back to client-side optimization");
            
            // Generate optimized text based on job description
            const optimizedText = generateOptimizedText(originalText || '', jobDescription);
            setOptimizedText(optimizedText);
            
            // Generate structured CV
            const structuredCV = generateStructuredCV(optimizedText, jobDescription);
            setStructuredCV(structuredCV);
            
            // Generate job match analysis on the optimized content
            const analysis = analyzeJobMatch(optimizedText, jobDescription);
            setJobMatchAnalysis(analysis);
          } catch (fallbackError) {
            console.error("Fallback optimization also failed:", fallbackError);
            setError("Failed to optimize CV: " + (fallbackError instanceof Error ? fallbackError.message : String(fallbackError)));
          }
        }
      };
      
      // Complete the optimization process
      const completeOptimization = () => {
        // If we haven't set optimized text yet (API calls failed), do it now
        if (!optimizedText && originalText) {
          const generatedText = generateOptimizedText(originalText, jobDescription);
          setOptimizedText(generatedText);
          
          // Generate job match analysis if not already done
          if (!jobMatchAnalysis) {
            const analysis = analyzeJobMatch(generatedText, jobDescription);
            setJobMatchAnalysis(analysis);
          }
        }
        
        // Complete processing
        setIsProcessing(false);
        setIsProcessed(true);
        setProcessingStatus("Optimization complete");
        setActiveTab('optimizedCV');
      };
      
      // Simulate processing with progress updates
      simulateProcessing();
      
    } catch (error) {
      console.error("Error optimizing CV for job:", error);
      setError(error instanceof Error ? error.message : "An unknown error occurred during optimization");
      setIsProcessing(false);
      setProcessingProgress(0);
    }
  }, [selectedCVId, selectedCVName, jobDescription, originalText]);
  
  // Generate optimized text based on job description
  const generateOptimizedText = (originalText: string, jobDescription: string): string => {
    try {
      // Extract job keywords for optimization
      const jobKeywords = extractKeywords(jobDescription);
      
      // Extract and optimize the different sections
      const profile = extractProfile(originalText);
      let optimizedProfile = optimizeProfile(profile, jobDescription, jobKeywords);
      
      // Format the profile for better parsing - ensure it has a clear header and proper spacing
      // Break long profile into digestible sentences for better document formatting
      let formattedProfile = "PROFILE:\n";
      
      // Break profile into sentences for better readability
      const profileSentences = optimizedProfile.split(/(?<=[.!?])\s+/);
      formattedProfile += profileSentences.join('\n') + '\n\n';
      
      // Extract and optimize other sections
      const achievements = extractAchievements(originalText);
      const optimizedAchievements = optimizeAchievements(achievements, jobDescription, jobKeywords);
      
      // Extract and optimize goals
      const goals = extractGoals(originalText);
      const optimizedGoals = optimizeGoals(goals, jobDescription, jobKeywords);
      
      // Extract and optimize languages (preserve original order but enhance descriptions)
      const languages = extractLanguages(originalText);
      const optimizedLanguages = languages.length > 0 ? optimizeLanguages(languages, jobDescription) : [];
      
      // Extract and optimize skills (preserve original skills and add relevant missing ones)
      const technicalSkills = extractTechnicalSkills(originalText);
      const professionalSkills = extractProfessionalSkills(originalText);
      const optimizedSkillsData = optimizeSkills(technicalSkills, professionalSkills, jobDescription, jobKeywords);
      
      // Extract and optimize education (preserve original data but highlight relevant aspects)
      const education = extractEducationData(originalText);
      const optimizedEducation = education.length > 0 ? optimizeEducation(education, jobDescription, jobKeywords) : [];
      
      // Extract and preserve experience (will be placed at the end)
      const experienceEntries = extractExperienceData(originalText);
      
      // Extract name and contact info for header
      const name = extractName(originalText);
      const contactInfo = extractContactInfo(originalText);
      
      // Create a well-structured optimized text with clear section headers
      let optimizedText = '';
      
      // 1. HEADER: Add header section (name and contact info)
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
      
      // 2. PROFILE: Add profile section with clear header
      optimizedText += `PROFILE:\n${formattedProfile}`;
      
      // 3. SUMMARY: Add one sentence summary of role scope
      optimizedText += `SUMMARY:\n${extractSubheader(originalText)}\n\n`;
      
      // 4. ACHIEVEMENTS: Add achievements section with clear header
      if (optimizedAchievements.length > 0) {
        optimizedText += `ACHIEVEMENTS:\n`;
        optimizedAchievements.forEach(achievement => {
          // Check if achievement contains quantifiable results
          const hasQuantifiableResults = /\d+%|\d+\s*(?:million|thousand|hundred|k|m|b|billion|x|times)|\$\d+|increased|improved|reduced|saved|generated/i.test(achievement);
          
          if (hasQuantifiableResults) {
            // Use a star symbol for achievements with metrics to make them stand out
            optimizedText += `★ ${achievement}\n`;
          } else {
            optimizedText += `• ${achievement}\n`;
          }
        });
        optimizedText += '\n';
      }
      
      // 5. GOALS: Add goals section with clear header
      if (optimizedGoals.length > 0) {
        optimizedText += `GOALS:\n`;
        optimizedGoals.forEach(goal => {
          optimizedText += `• ${goal}\n`;
        });
        optimizedText += '\n';
      }
      
      // 6. LANGUAGES: Add languages section with clear header
      if (optimizedLanguages.length > 0) {
        optimizedText += `LANGUAGES:\n`;
        optimizedLanguages.forEach(language => {
          // Format language entries consistently
          const parts = language.split(/[:-]/).map(part => part.trim());
          if (parts.length === 2) {
            optimizedText += `• ${parts[0]} - ${parts[1]}\n`;
          } else {
            optimizedText += `• ${language}\n`;
          }
        });
        optimizedText += '\n';
      }
      
      // 7. SKILLS: Add skills section with clear header and subsections
      optimizedText += `SKILLS:\n`;
      
      if (optimizedSkillsData.technical.length > 0) {
        optimizedText += `Technical Skills:\n`;
        optimizedSkillsData.technical.forEach((skill: string) => {
          optimizedText += `• ${skill}\n`;
        });
        optimizedText += '\n';
      }
      
      if (optimizedSkillsData.professional.length > 0) {
        optimizedText += `Professional Skills:\n`;
        optimizedSkillsData.professional.forEach((skill: string) => {
          optimizedText += `• ${skill}\n`;
        });
        optimizedText += '\n';
      }
      
      // 8. EDUCATION: Add education section with clear header
      if (optimizedEducation.length > 0) {
        optimizedText += `EDUCATION:\n`;
        optimizedEducation.forEach((edu: EducationEntry) => {
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
            edu.relevantCourses.forEach((course: string) => {
              optimizedText += `• ${course}\n`;
            });
          }
          
          if (edu.achievements && edu.achievements.length > 0) {
            optimizedText += `Academic Achievements:\n`;
            edu.achievements.forEach((achievement: string) => {
              optimizedText += `• ${achievement}\n`;
            });
          }
          
          optimizedText += '\n';
        });
      }
      
      // 9. EXPERIENCE: Add experience section at the end if available in original text
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
      
      return optimizedText;
    } catch (error) {
      console.error("Error generating optimized text:", error);
      return "An error occurred while generating optimized text.";
    }
  };

  const showToast = useCallback(({ title, description, duration }: { title: string; description: string; duration: number }) => {
    toast({
      title,
      description,
      duration,
    });
  }, [toast]);

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
      
      // Check if CV ID is available
      if (!selectedCVId) {
        throw new Error('No CV selected for document generation');
      }
      
      console.log(`Generating document for CV ID: ${selectedCVId}`);
      
      // Try multiple approaches to generate and download the document
      let downloadSuccess = false;
      let lastError = null;
      
      // Approach 1: Local document generation
      if (!downloadSuccess) {
        try {
          console.log("Attempting local document generation...");
          
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
          
          // Save the file using file-saver
          saveAs(new Blob([blob]), `${cvName}.docx`);
          
          console.log("Local document generation successful");
          downloadSuccess = true;
        } catch (localGenError) {
          console.warn("Local document generation failed:", localGenError);
          lastError = localGenError;
        }
      }
      
      // Approach 2: API-based document generation with base64 encoding
      if (!downloadSuccess) {
        try {
          console.log("Attempting API-based document generation...");
          
          // Try specific API endpoint first
          try {
            const specificResponse = await fetch('/api/cv/specific-generate-docx', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                cvId: selectedCVId,
                optimizedText: optimizedText
              }),
            });
            
            if (specificResponse.ok) {
              const specificData = await specificResponse.json();
              
              if (specificData.success && specificData.docxBase64) {
                console.log(`Received specific API base64 data of length: ${specificData.docxBase64.length}`);
                
                try {
                  // Try using data URL approach
                  const linkSource = `data:application/vnd.openxmlformats-officedocument.wordprocessingml.document;base64,${specificData.docxBase64}`;
                  const downloadLink = document.createElement('a');
                  downloadLink.href = linkSource;
                  downloadLink.download = `${cvName}.docx`;
                  
                  // Append to the document, click, and remove
                  document.body.appendChild(downloadLink);
                  downloadLink.click();
                  document.body.removeChild(downloadLink);
                  
                  console.log("Specific API download completed using data URL approach");
                  downloadSuccess = true;
                } catch (dataUrlError) {
                  console.warn("Data URL download failed, trying file-saver approach:", dataUrlError);
                  
                  // Fallback to file-saver approach
                  try {
                    // Convert base64 to blob
                    const byteCharacters = atob(specificData.docxBase64);
                    const byteNumbers = new Array(byteCharacters.length);
                    
                    for (let i = 0; i < byteCharacters.length; i++) {
                      byteNumbers[i] = byteCharacters.charCodeAt(i);
                    }
                    
                    const byteArray = new Uint8Array(byteNumbers);
                    const blob = new Blob([byteArray], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
                    
                    // Use file-saver to save the blob
                    saveAs(blob, `${cvName}.docx`);
                    
                    console.log("Specific API download completed using file-saver approach");
                    downloadSuccess = true;
                  } catch (fileSaverError) {
                    console.error("Both download methods failed for specific API:", fileSaverError);
                    lastError = fileSaverError;
                  }
                }
              } else {
                console.warn("Specific API response missing docxBase64 data:", specificData);
                lastError = new Error('Specific API response missing docxBase64 data');
              }
            } else {
              console.warn("Specific API request failed, trying enhanced API");
              lastError = new Error('Specific API request failed');
            }
          } catch (specificApiError) {
            console.warn("Specific API error:", specificApiError);
            lastError = specificApiError;
          }
          
          // If specific API failed, try the enhanced DOCX generation API
          if (!downloadSuccess) {
            try {
              const enhancedResponse = await fetch('/api/cv/generate-enhanced-docx', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  cvId: selectedCVId,
                  optimizedText: optimizedText,
                  forceRefresh: true
                }),
              });
              
              if (enhancedResponse.ok) {
                const enhancedData = await enhancedResponse.json();
                
                if (enhancedData.success && enhancedData.docxBase64) {
                  console.log(`Received enhanced base64 data of length: ${enhancedData.docxBase64.length}`);
                  
                  try {
                    // Try using data URL approach
                    const linkSource = `data:application/vnd.openxmlformats-officedocument.wordprocessingml.document;base64,${enhancedData.docxBase64}`;
                    const downloadLink = document.createElement('a');
                    downloadLink.href = linkSource;
                    downloadLink.download = `${cvName}.docx`;
                    
                    // Append to the document, click, and remove
                    document.body.appendChild(downloadLink);
                    downloadLink.click();
                    document.body.removeChild(downloadLink);
                    
                    console.log("Enhanced API download completed using data URL approach");
                    downloadSuccess = true;
                  } catch (dataUrlError) {
                    console.warn("Data URL download failed, trying file-saver approach:", dataUrlError);
                    
                    // Fallback to file-saver approach
                    try {
                      // Convert base64 to blob
                      const byteCharacters = atob(enhancedData.docxBase64);
                      const byteNumbers = new Array(byteCharacters.length);
                      
                      for (let i = 0; i < byteCharacters.length; i++) {
                        byteNumbers[i] = byteCharacters.charCodeAt(i);
                      }
                      
                      const byteArray = new Uint8Array(byteNumbers);
                      const blob = new Blob([byteArray], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
                      
                      // Use file-saver to save the blob
                      saveAs(blob, `${cvName}.docx`);
                      
                      console.log("Enhanced API download completed using file-saver approach");
                      downloadSuccess = true;
                    } catch (fileSaverError) {
                      console.error("Both download methods failed for enhanced API:", fileSaverError);
                      lastError = fileSaverError;
                    }
                  }
                } else {
                  console.warn("Enhanced API response missing docxBase64 data:", enhancedData);
                  lastError = new Error('Enhanced API response missing docxBase64 data');
                }
              } else {
                const errorText = await enhancedResponse.text();
                console.error("Enhanced API request failed:", errorText);
                lastError = new Error(`Enhanced API request failed: ${errorText}`);
              }
            } catch (enhancedApiError) {
              console.warn("Enhanced API error:", enhancedApiError);
              lastError = enhancedApiError;
            }
          }
          
          // If both specific and enhanced APIs failed, try the standard API
          if (!downloadSuccess) {
            try {
              console.log("Trying standard API as last resort");
              
              // Fall back to standard API
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
              
              if (response.ok) {
                const data = await response.json();
                
                if (data.success && data.docxBase64) {
                  console.log(`Received standard base64 data of length: ${data.docxBase64.length}`);
                  
                  try {
                    // Try using data URL approach
                    const linkSource = `data:application/vnd.openxmlformats-officedocument.wordprocessingml.document;base64,${data.docxBase64}`;
                    const downloadLink = document.createElement('a');
                    downloadLink.href = linkSource;
                    downloadLink.download = `${cvName}.docx`;
                    
                    // Append to the document, click, and remove
                    document.body.appendChild(downloadLink);
                    downloadLink.click();
                    document.body.removeChild(downloadLink);
                    
                    console.log("Standard API download completed using data URL approach");
                    downloadSuccess = true;
                  } catch (dataUrlError) {
                    console.warn("Data URL download failed, trying file-saver approach:", dataUrlError);
                    
                    // Fallback to file-saver approach
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
                      
                      console.log("Standard API download completed using file-saver approach");
                      downloadSuccess = true;
                    } catch (fileSaverError) {
                      console.error("Both download methods failed for standard API:", fileSaverError);
                      lastError = fileSaverError;
                    }
                  }
                } else {
                  console.warn("Standard API response missing docxBase64 data:", data);
                  lastError = new Error('Standard API response missing docxBase64 data');
                }
              } else {
                const errorText = await response.text();
                console.error("Standard API request failed:", errorText);
                lastError = new Error(`Standard API request failed: ${errorText}`);
              }
            } catch (standardApiError) {
              console.warn("Standard API error:", standardApiError);
              lastError = standardApiError;
            }
          }
        } catch (apiError) {
          console.warn("All API-based download methods failed:", apiError);
          lastError = apiError;
        }
      }
      
      // Approach 3: Direct download using GET request
      if (!downloadSuccess) {
        try {
          console.log("Attempting direct download via GET request");
          
          // Create a hidden iframe to trigger the download
          const iframe = document.createElement('iframe');
          iframe.style.display = 'none';
          document.body.appendChild(iframe);
          
          // Set the iframe source to the download URL with a timestamp to prevent caching
          const timestamp = new Date().getTime();
          iframe.src = `/api/cv/download-optimized-docx?cvId=${selectedCVId}&t=${timestamp}`;
          
          // Remove the iframe after a delay
          setTimeout(() => {
            document.body.removeChild(iframe);
          }, 5000);
          
          console.log("Direct download initiated");
          
          // Show a message to the user
          setDocumentError("If the download doesn't start automatically, please check your browser's download manager or try again.");
          downloadSuccess = true;
        } catch (directDownloadError) {
          console.error("Direct download method failed:", directDownloadError);
          lastError = directDownloadError;
        }
      }
      
      // If all approaches failed, throw an error
      if (!downloadSuccess) {
        throw new Error(lastError instanceof Error ? lastError.message : "All download methods failed");
      }
      
      setIsGeneratingDocument(false);
    } catch (error) {
      console.error('Error generating document:', error);
      setDocumentError(`Failed to generate document: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setIsGeneratingDocument(false);
    }
  };

  // Add a function to validate document content
  const validateDocument = (doc: any): { isValid: boolean; error?: string } => {
    try {
      // Check if document exists
      if (!doc) {
        return { isValid: false, error: "Document is null or undefined" };
      }
      
      // Check if document has sections
      if (!doc.sections || !Array.isArray(doc.sections) || doc.sections.length === 0) {
        return { isValid: false, error: "Document has no sections" };
      }
      
      // Check if first section has children
      const firstSection = doc.sections[0];
      if (!firstSection.children || !Array.isArray(firstSection.children) || firstSection.children.length === 0) {
        return { isValid: false, error: "Document's first section has no children" };
      }
      
      // Check if there are paragraphs in the children
      const hasParagraphs = firstSection.children.some((child: any) => 
        child && typeof child === 'object' && child.constructor && child.constructor.name === 'Paragraph'
      );
      
      if (!hasParagraphs) {
        return { isValid: false, error: "Document doesn't contain any paragraphs" };
      }
      
      // Check if document has at least some minimum content
      const totalChildren = doc.sections.reduce(
        (count: number, section: any) => count + (section.children ? section.children.length : 0), 
        0
      );
      
      if (totalChildren < 5) {
        return { isValid: false, error: "Document has insufficient content (less than 5 elements)" };
      }
      
      // Document passed all validation checks
      return { isValid: true };
    } catch (error) {
      console.error("Error validating document:", error);
      return { 
        isValid: false, 
        error: `Document validation error: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  };

  // Modify the generateDocument function to use caching
  const generateDocument = async () => {
    if (isGeneratingDocument || !optimizedText) {
      setDocumentError("No optimized content available. Please optimize your CV first.");
      return;
    }
    
    setIsGeneratingDocument(true);
    setProcessingProgress(0);
    setProcessingStatus("Starting document generation...");
    setDocumentError(null);
    setIsDownloading(false);
    setIsDownloadComplete(false);
    
    try {
      // Step 1: Prepare document data
      setProcessingProgress(10);
      setProcessingStatus("Preparing document data...");
      await new Promise(resolve => setTimeout(resolve, 500)); // UI feedback delay
      
      // Step 2: Structure CV content
      setProcessingProgress(30);
      setProcessingStatus("Structuring CV content...");
      await new Promise(resolve => setTimeout(resolve, 500)); // UI feedback delay
      
      // Step 3: Generate document
      setProcessingProgress(50);
      setProcessingStatus("Generating document...");
      
      // Use our retry mechanism for document generation
      const generateDocumentFn = () => fetch('/api/cv/specific-generate-docx', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          cvId: selectedCVId,
          optimizedText: (() => {
            // Clean the optimized text
            const cleanedText = cleanOptimizedText(optimizedText);
            
            // Log for debugging
            console.log("Sections in optimized text:");
            cleanedText.split('\n').forEach(line => {
              if (line.trim().match(/^[A-Z][A-Z\s]+:$/)) {
                console.log(`Found section: ${line.trim()}`);
              }
            });
            
            return cleanedText;
          })(),
          jobDescription: jobDescription || '',
          jobTitle: jobTitle || '',
        }),
      });
      
      console.log("Calling the specific-generate-docx API with:", {
        cvId: selectedCVId,
        optimizedTextLength: optimizedText.length,
        hasJobDescription: !!jobDescription,
        jobTitle: jobTitle || 'Not provided'
      });
      
      // Generate document with retry mechanism
      let documentResponse;
      try {
        documentResponse = await generateDocumentFn();
        
        if (!documentResponse.ok) {
          throw new Error(`API returned status: ${documentResponse.status}`);
        }
        
        const jsonResponse = await documentResponse.json();
        console.log("Received API response:", jsonResponse);
        
        if (!jsonResponse.success) {
          throw new Error(jsonResponse.error || "API returned unsuccessful response");
        }
        
        if (!jsonResponse.docxBase64 && !jsonResponse.downloadUrl) {
          throw new Error("API response missing both docxBase64 and downloadUrl");
        }
        
        // Create a blob from the base64 string
        const byteCharacters = atob(jsonResponse.docxBase64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
        
        // Step 4: Prepare for download
        setProcessingProgress(80);
        setProcessingStatus("Preparing for download...");
        
        // Cache the document for manual download
        setCachedDocument({
          doc: null,
          blob: blob,
          text: optimizedText,
          url: URL.createObjectURL(blob),
          timestamp: Date.now()
        });
        
        // Step 5: Download document
        setProcessingProgress(90);
        setProcessingStatus("Downloading document...");
        setIsDownloading(true);
        
        // Get CV name without file extension
        const cvName = selectedCVName 
          ? selectedCVName.replace(/\.\w+$/, '') 
          : 'CV';
        const filename = `${cvName}_optimized.docx`;
        
        // Attempt to download with timeout
        const downloadSuccess = await withDownloadTimeout(
          async () => await downloadDocument(blob, filename),
          10000 // 10 second timeout
        );
        
        // Always mark as complete, even if download fails
        setProcessingProgress(100);
        setIsDownloading(false);
        
        if (downloadSuccess) {
          setIsDownloadComplete(true);
          setProcessingStatus("Document generated and downloaded successfully!");
          showToast({
            title: "Success!",
            description: "Your optimized CV has been generated and downloaded successfully.",
            duration: 5000
          });
        } else {
          // If automatic download failed but we have the document cached
          setProcessingStatus("Document generated successfully. Manual download available.");
          setDocumentError("Automatic download failed. Please use the manual download button below.");
        }
      } catch (apiError) {
        console.error("API error:", apiError);
        setProcessingProgress(0);
        setProcessingStatus("Document generation failed");
        setDocumentError(`API error: ${apiError instanceof Error ? apiError.message : String(apiError)}`);
        
        // Try again with a direct approach
        try {
          setProcessingStatus("Trying alternative method...");
          
          const response = await fetch('/api/cv/generate-docx', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              cvId: selectedCVId,
              optimizedText: (() => {
                // Clean the optimized text
                const cleanedText = cleanOptimizedText(optimizedText);
                
                // Log for debugging
                console.log("Sections in optimized text:");
                cleanedText.split('\n').forEach(line => {
                  if (line.trim().match(/^[A-Z][A-Z\s]+:$/)) {
                    console.log(`Found section: ${line.trim()}`);
                  }
                });
                
                return cleanedText;
              })(),
              jobDescription: jobDescription || '',
              jobTitle: jobTitle || '',
            }),
          });
          
          if (response.ok) {
            const data = await response.json();
            
            if (data.success && data.docxBase64) {
              // Create a blob from base64
              const byteCharacters = atob(data.docxBase64);
              const byteNumbers = new Array(byteCharacters.length);
              for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
              }
              const byteArray = new Uint8Array(byteNumbers);
              const blob = new Blob([byteArray], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
              
              // Cache the document
              setCachedDocument({
                doc: null,
                blob: blob,
                text: optimizedText,
                url: URL.createObjectURL(blob),
                timestamp: Date.now()
              });
              
              // Get CV name
              const cvName = selectedCVName 
                ? selectedCVName.replace(/\.\w+$/, '') 
                : 'CV';
              const filename = `${cvName}_optimized.docx`;
              
              // Try to download
              const downloadSuccess = await downloadDocument(blob, filename);
              
              if (downloadSuccess) {
                setIsDownloadComplete(true);
                setProcessingStatus("Document generated and downloaded successfully (fallback method)!");
                setDocumentError(null);
              } else {
                setProcessingStatus("Document generated successfully. Manual download available.");
                setDocumentError("Automatic download failed. Please use the manual download button below.");
              }
            } else {
              throw new Error("Fallback API returned no docxBase64 data");
            }
          } else {
            throw new Error(`Fallback API returned status: ${response.status}`);
          }
        } catch (fallbackError) {
          console.error("Fallback method failed:", fallbackError);
          setDocumentError(`Document generation failed after multiple attempts. Please try again later or contact support. (${fallbackError instanceof Error ? fallbackError.message : String(fallbackError)})`);
        }
      }
    } catch (error) {
      console.error("Document generation error:", error);
      
      setProcessingProgress(0);
      setProcessingStatus("Document generation failed");
      setDocumentError(`Failed to generate document: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsGeneratingDocument(false);
    }
  };

  // Add a function for manual document download
  const handleManualDownload = async () => {
    if (!cachedDocument?.blob) {
      setDocumentError("No document available for download. Please generate a document first.");
      return;
    }
    
    setIsDownloading(true);
    setDocumentError(null);
    
    try {
      // Get CV name without file extension
      const cvName = selectedCVName 
        ? selectedCVName.replace(/\.\w+$/, '') 
        : 'CV';
      const filename = `${cvName}_optimized.docx`;
      
      // Use our utility function for download
      const downloadSuccess = await downloadDocument(cachedDocument.blob, filename);
      
      setIsDownloading(false);
      
      if (downloadSuccess) {
        setIsDownloadComplete(true);
        setDocumentError(null);
        setProcessingStatus("Document downloaded successfully!");
      } else {
        setDocumentError("Download failed. Please try again or use a different browser.");
      }
    } catch (error) {
      console.error("Manual download error:", error);
      setIsDownloading(false);
      setDocumentError(`Download failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  // Add a handler for the generate document button
  const handleGenerateDocument = () => {
    generateDocument();
  };

  // Clean up optimized text to ensure proper section parsing
  const cleanOptimizedText = (text: string): string => {
    if (!text) return '';
    
    // Split text into lines
    const lines = text.split('\n');
    const cleanedLines = [];
    let currentSection = '';
    let hasProfileSection = false;
    
    // Process each line
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Skip empty lines at the beginning
      if (cleanedLines.length === 0 && line === '') continue;
      
      // Check if this line is a section header - expanded to match more variations
      const sectionMatch = line.match(/^(PROFILE|SUMMARY|ABOUT ME|PROFESSIONAL SUMMARY|PERSONAL STATEMENT|EXPERIENCE|WORK EXPERIENCE|EDUCATION|SKILLS|TECHNICAL SKILLS|PROFESSIONAL SKILLS|LANGUAGES|ACHIEVEMENTS|REFERENCES)(:|\s-)?$/i);
      
      if (sectionMatch) {
        // Found a section header
        currentSection = sectionMatch[1].toUpperCase();
        
        // Check if we found a profile section
        if (/^(PROFILE|SUMMARY|ABOUT ME|PROFESSIONAL SUMMARY|PERSONAL STATEMENT)$/i.test(currentSection)) {
          hasProfileSection = true;
        }
        
        // Add the cleaned section header
        cleanedLines.push(`${currentSection}:`);
      } else {
        // Not a section header, add the line as is
        cleanedLines.push(line);
      }
    }
    
    // If no profile section was found, try to extract one from the first substantive content
    if (!hasProfileSection) {
      // Look through first few lines to see if there's content that could be a profile
      let profileContent = '';
      for (let i = 0; i < Math.min(20, lines.length); i++) {
        const line = lines[i].trim();
        if (line.length > 50 && 
            !line.includes('@') && 
            !line.includes('http') && 
            !/^[A-Z\s]+:$/i.test(line)) {
          profileContent = line;
          break;
        }
      }
      
      if (profileContent) {
        // Insert a profile section at the beginning (after any contact info that might exist)
        let insertIndex = 0;
        // Skip past any contact info (first few short lines)
        while (insertIndex < cleanedLines.length && 
               (cleanedLines[insertIndex].length < 30 || 
                cleanedLines[insertIndex].includes('@') || 
                cleanedLines[insertIndex].includes('http'))) {
          insertIndex++;
        }
        
        // Insert profile section
        cleanedLines.splice(insertIndex, 0, 'PROFILE:', profileContent, '');
        console.log('Added missing PROFILE section with extracted content');
      }
    }
    
    return cleanedLines.join('\n');
  };

  // Return the component's JSX
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

      {/* Rest of your component UI */}
    </div>
  );
} // Close the component function
