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
import { logger } from '@/lib/logger';

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

// Update the analyzeJobMatch function
const analyzeJobMatch = (cvText: string, jobDescription: string): JobMatchAnalysis => {
  // Extract keywords from CV and job description
  const cvKeywords = extractKeywords(cvText);
  const jobKeywords = extractKeywords(jobDescription, true);
  
  // Find matched keywords
  const matchedKeywords: KeywordMatch[] = [];
  const missingKeywords: MissingKeyword[] = [];
  
  // Process job keywords to find matches and missing keywords
  jobKeywords.forEach(keyword => {
    // Check if the keyword exists in the CV (case insensitive)
    const keywordRegex = new RegExp(`\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    const matches = cvText.match(new RegExp(keywordRegex, 'gi'));
    const frequency = matches ? matches.length : 0;
    
    if (frequency > 0) {
      // Keyword found in CV
      const placement = determineKeywordPlacement(cvText, keyword);
      const relevance = calculateKeywordRelevance(keyword, jobDescription, placement, frequency);
      
      matchedKeywords.push({
        keyword,
        relevance,
        frequency,
        placement
      });
    } else {
      // Keyword not found in CV
      const importance = calculateKeywordImportance(keyword, jobDescription);
      const suggestedPlacement = suggestKeywordPlacement(keyword, jobDescription);
      
      // Only include important keywords (importance > 0.4)
      if (importance > 0.4) {
        missingKeywords.push({
          keyword,
          importance,
          suggestedPlacement
        });
      }
    }
  });
  
  // Calculate dimensional scores
  const skillsMatch = calculateSkillsMatch(cvText, jobDescription);
  const experienceMatch = calculateExperienceMatch(cvText, jobDescription);
  const educationMatch = calculateEducationMatch(cvText, jobDescription);
  const industryFit = calculateIndustryFit(cvText, jobDescription);
  const keywordDensity = calculateKeywordDensity(cvText, jobKeywords);
  const formatCompatibility = calculateFormatCompatibility(cvText);
  const contentRelevance = calculateContentRelevance(cvText, jobDescription);
  
  // Calculate section-specific scores
  const sectionAnalysis = {
    profile: analyzeCVSection(cvText, 'profile', jobDescription),
    skills: analyzeCVSection(cvText, 'skills', jobDescription),
    experience: analyzeCVSection(cvText, 'experience', jobDescription),
    education: analyzeCVSection(cvText, 'education', jobDescription),
    achievements: analyzeCVSection(cvText, 'achievements', jobDescription)
  };
  
  // Calculate overall compatibility score with weighted dimensions
  // Adjust weights to prioritize skills, experience, and keyword matches
  const overallCompatibility = (
    skillsMatch * 0.25 +
    experienceMatch * 0.20 +
    educationMatch * 0.15 +
    industryFit * 0.10 +
    keywordDensity * 0.15 +
    formatCompatibility * 0.05 +
    contentRelevance * 0.10
  );
  
  // Calculate improvement potential (inverse of overall score, scaled)
  const improvementPotential = Math.min(100, Math.max(0, 100 - (overallCompatibility * 100)));
  
  // Generate recommendations based on analysis
  const recommendations = generateRecommendations(
    cvKeywords,
    jobKeywords,
    matchedKeywords,
    missingKeywords,
    overallCompatibility,
    sectionAnalysis
  );
  
  // Generate detailed analysis text
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
  
  // Generate skill gap analysis
  const skillGap = generateEnhancedSkillGapAnalysis(missingKeywords, jobDescription);
  
  // Calculate final score - ensure it's at least 50% if we're optimizing
  // This gives a more positive user experience while still showing room for improvement
  const baseScore = overallCompatibility * 100;
  const finalScore = Math.max(50, baseScore);
  
  return {
    score: Math.round(finalScore),
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
      const regex = new RegExp(`\\b${keyword}\\b`, 'i');
      if (regex.test(trimmedLine)) {
        // Extract the skill and surrounding context
        const skillMatch = trimmedLine.match(new RegExp(`(?:\\b\\w+\\s+)?${keyword}(?:\\s+\\w+\\b)?`, 'i'));
        if (skillMatch && !originalSkills.includes(skillMatch[0])) {
          originalSkills.push(skillMatch[0]);
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
      const regex = new RegExp(`\\b${keyword}\\b`, 'i');
      if (regex.test(trimmedLine)) {
        // Extract the skill and surrounding context
        const skillMatch = trimmedLine.match(new RegExp(`(?:\\b\\w+\\s+)?${keyword}(?:\\s+\\w+\\b)?`, 'i'));
        if (skillMatch && !originalSkills.includes(skillMatch[0])) {
          originalSkills.push(skillMatch[0]);
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

  // Circuit breaker state
  const [mistralServiceAvailable, setMistralServiceAvailable] = useState(true);
  const [mistralFailureCount, setMistralFailureCount] = useState(0);
  const MAX_FAILURES = 3; // After this many failures, switch to local processing

  // Refs for tracking intervals and timeouts
  const processingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const documentTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Function to handle Mistral service failure
  const handleMistralFailure = useCallback((error: Error) => {
    setMistralFailureCount(prev => {
      const newCount = prev + 1;
      if (newCount >= MAX_FAILURES) {
        logger.warn(`Mistral service failed ${newCount} times, switching to local processing`);
        setMistralServiceAvailable(false);
      }
      return newCount;
    });
    
    // Log the error
    console.error("Mistral service error:", error);
    logger.error(`Mistral service error: ${error.message}`);
    
    return error;
  }, []);

  // Reset circuit breaker after some time
  useEffect(() => {
    if (!mistralServiceAvailable) {
      const timer = setTimeout(() => {
        logger.info("Resetting Mistral service availability");
        setMistralServiceAvailable(true);
        setMistralFailureCount(0);
      }, 5 * 60 * 1000); // 5 minutes
      
      return () => clearTimeout(timer);
    }
  }, [mistralServiceAvailable]);

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
    
    // Utility function to fetch with timeout
    const fetchWithTimeout = async (url: string, options: RequestInit, timeout = 60000): Promise<Response> => {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), timeout);
      
      try {
        const response = await fetch(url, {
          ...options,
          signal: controller.signal
        });
        clearTimeout(id);
        return response;
      } catch (error) {
        clearTimeout(id);
        if (error instanceof Error && error.name === 'AbortError') {
          throw new Error('Request timed out. Please try again.');
        }
        throw error;
      }
    };
    
    // Reset states
    setIsProcessing(true);
    setIsProcessed(false);
    setProcessingProgress(0);
    setProcessingStatus("Starting job-specific optimization...");
    setError(null);
    setProcessingTooLong(false);
    
    // Set a timeout to detect if the process is taking too long
    const processingTimeout = setTimeout(() => {
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
    
    try {
      console.log(`Processing CV: ${selectedCVName} (ID: ${selectedCVId}) for specific job`);
      
      // Step 1: Fetch original CV text if not already loaded
      setProcessingProgress(10);
      setProcessingStatus("Fetching CV data...");
      
      if (!originalText) {
        try {
          const cvText = await fetchOriginalText(selectedCVId);
          if (!cvText) {
            throw new Error("Failed to fetch CV text");
          }
        } catch (fetchError) {
          console.error("Error fetching CV text:", fetchError);
          throw new Error(`Failed to fetch CV text: ${fetchError instanceof Error ? fetchError.message : 'Unknown error'}`);
        }
      }
      
      // Check if Mistral service is available or if we should use local processing
      if (!mistralServiceAvailable) {
        logger.info("Mistral service is marked as unavailable, using local processing");
        setProcessingProgress(20);
        setProcessingStatus("Using local optimization (Mistral service unavailable)...");
        clearTimeout(processingTimeout);
        simulateProcessing();
        return;
      }
      
      // Step 2: Analyze CV content
      setProcessingProgress(30);
      setProcessingStatus("Analyzing CV content...");
      
      let analysisData;
      try {
        // Call the Mistral AI service to analyze the CV
        const response = await fetchWithTimeout('/api/cv/analyze', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            cvText: originalText,
            jobDescription: jobDescription
          }),
        }, 45000); // 45 second timeout
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
          const errorMessage = errorData.error || errorData.details || `Server responded with status: ${response.status}`;
          console.error("CV analysis API error:", errorMessage);
          
          // If we get a 401 error, it's likely an authentication issue
          if (response.status === 401) {
            throw new Error(`Authentication failed: ${errorMessage}. Please check your API key configuration.`);
          }
          
          throw new Error(errorMessage);
        }
        
        analysisData = await response.json();
        if (!analysisData.success) {
          throw new Error(analysisData.error || "Analysis failed with unknown error");
        }
        
      } catch (analysisError) {
        // Handle Mistral service failure
        handleMistralFailure(analysisError instanceof Error ? analysisError : new Error(String(analysisError)));
        
        // If Mistral AI fails, fall back to local processing
        logger.info("Falling back to local processing due to analysis error");
        setProcessingProgress(40);
        setProcessingStatus("Using fallback optimization method...");
        
        // Simulate API call for job-specific optimization with local functions
        clearTimeout(processingTimeout);
        simulateProcessing();
        return; // Exit early as we're using the fallback
      }
      
      // Step 3: Optimize CV for job
      setProcessingProgress(60);
      setProcessingStatus("Optimizing CV for job description...");
      
      let optimizationData;
      try {
        // Call the Mistral AI service to optimize the CV
        const optimizeResponse = await fetchWithTimeout('/api/cv/optimize', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            cvText: originalText,
            jobDescription: jobDescription,
            analysis: analysisData.analysis
          }),
        }, 45000); // 45 second timeout
        
        if (!optimizeResponse.ok) {
          const errorData = await optimizeResponse.json().catch(() => ({ error: 'Unknown error' }));
          const errorMessage = errorData.error || errorData.details || `Server responded with status: ${optimizeResponse.status}`;
          console.error("CV optimization API error:", errorMessage);
          throw new Error(errorMessage);
        }
        
        optimizationData = await optimizeResponse.json();
        if (!optimizationData.success) {
          throw new Error(optimizationData.error || "Optimization failed with unknown error");
        }
        
        // Reset failure count on success
        setMistralFailureCount(0);
        
      } catch (optimizationError) {
        // Handle Mistral service failure
        handleMistralFailure(optimizationError instanceof Error ? optimizationError : new Error(String(optimizationError)));
        
        // If Mistral AI fails, fall back to local processing
        logger.info("Falling back to local processing due to optimization error");
        setProcessingProgress(40);
        setProcessingStatus("Using fallback optimization method...");
        
        // Simulate API call for job-specific optimization with local functions
        clearTimeout(processingTimeout);
        simulateProcessing();
        return; // Exit early as we're using the fallback
      }
      
      // Step 4: Generate job match analysis
      setProcessingProgress(80);
      setProcessingStatus("Generating job match analysis...");
      
      // Use the local analyzeJobMatch function as a fallback if needed
      const jobMatch = optimizationData.matchAnalysis || analyzeJobMatch(optimizationData.optimizedContent || originalText, jobDescription);
      
      // Step 5: Complete processing
      setProcessingProgress(100);
      setProcessingStatus("Optimization complete!");
      
      // Set optimized text and job match analysis
      setOptimizedText(optimizationData.optimizedContent || generateOptimizedText(originalText, jobDescription));
      setJobMatchAnalysis(jobMatch);
      
      // Set processing state
      setIsProcessed(true);
      setIsProcessing(false);
      
      // Extract job title from job description if not already set
      if (!jobTitle) {
        const jobTitleMatch = jobDescription.match(/^(.+?)(?:\n|\.)/);
        const extractedJobTitle = jobTitleMatch ? jobTitleMatch[1].trim() : 'Position';
        setJobTitle(extractedJobTitle);
      }
      
      // Clear the timeout as processing is complete
      clearTimeout(processingTimeout);
      
    } catch (error) {
      console.error("Error optimizing CV for job:", error);
      
      // Clear the timeout as processing has errored
      clearTimeout(processingTimeout);
      
      // Set error state
      setError(error instanceof Error ? error.message : "An unknown error occurred during optimization");
      
      // If we're at a high progress percentage but encountered an error, 
      // we should still try to show something to the user
      if (processingProgress > 80) {
        // Generate fallback content
        const fallbackText = generateOptimizedText(originalText || '', jobDescription);
        setOptimizedText(fallbackText);
        
        // Generate job match analysis on the fallback content
        const fallbackAnalysis = analyzeJobMatch(fallbackText, jobDescription);
        setJobMatchAnalysis(fallbackAnalysis);
        
        // Mark as processed but with error
        setIsProcessed(true);
        setProcessingStatus("Completed with errors. Using fallback optimization.");
      } else {
        // Reset processing state
        setIsProcessing(false);
        setProcessingProgress(0);
        setProcessingStatus("Optimization failed. Please try again.");
      }
    }
  }, [selectedCVId, selectedCVName, jobDescription, originalText, fetchOriginalText, jobTitle, isProcessing, mistralServiceAvailable, handleMistralFailure]);
  
  // Simulate processing with progress updates
  const simulateProcessing = () => {
    logger.info("Starting local fallback processing");
    
    // Clear any existing intervals to prevent multiple simulations
    if (processingIntervalRef.current) {
      clearInterval(processingIntervalRef.current);
      processingIntervalRef.current = null;
    }
    
    let progress = 0;
    const startTime = Date.now();
    
    // Set initial status
    setProcessingStatus("Using local optimization (fallback mode)...");
    
    // Create a more deterministic and reliable progress simulation
    processingIntervalRef.current = setInterval(() => {
      // Calculate elapsed time
      const elapsedSeconds = (Date.now() - startTime) / 1000;
      
      // More predictable progress calculation
      // Ensures we reach 100% within 30 seconds max
      if (elapsedSeconds < 5) {
        // First 5 seconds: go to 30%
        progress = Math.min(30, elapsedSeconds * 6);
      } else if (elapsedSeconds < 15) {
        // Next 10 seconds: go from 30% to 70%
        progress = Math.min(70, 30 + (elapsedSeconds - 5) * 4);
      } else if (elapsedSeconds < 25) {
        // Next 10 seconds: go from 70% to 95%
        progress = Math.min(95, 70 + (elapsedSeconds - 15) * 2.5);
      } else {
        // Final 5 seconds: go from 95% to 100%
        progress = Math.min(100, 95 + (elapsedSeconds - 25));
      }
      
      // Ensure we complete within 30 seconds max
      if (elapsedSeconds > 30) {
        progress = 100;
      }
      
      // Update progress
      setProcessingProgress(Math.floor(progress));
      
      // More detailed status messages based on progress
      if (progress < 15) {
        setProcessingStatus("Analyzing job description and requirements (local mode)...");
      } else if (progress < 30) {
        setProcessingStatus("Extracting key skills and qualifications (local mode)...");
      } else if (progress < 45) {
        setProcessingStatus("Analyzing CV content and structure (local mode)...");
      } else if (progress < 60) {
        setProcessingStatus("Matching CV content to job requirements (local mode)...");
      } else if (progress < 75) {
        setProcessingStatus("Optimizing CV sections and formatting (local mode)...");
      } else if (progress < 85) {
        setProcessingStatus("Enhancing content relevance (local mode)...");
      } else if (progress < 95) {
        setProcessingStatus("Finalizing optimizations (local mode)...");
      } else {
        setProcessingStatus("Completing final adjustments (local mode)...");
      }
      
      // Complete the process when we reach 100%
      if (progress >= 100) {
        if (processingIntervalRef.current) {
          clearInterval(processingIntervalRef.current);
          processingIntervalRef.current = null;
        }
        
        try {
          logger.info("Local fallback processing complete, generating optimized content");
          
          // Generate optimized text based on job description
          const optimizedText = generateOptimizedText(originalText || '', jobDescription);
          setOptimizedText(optimizedText);
          
          // Generate structured CV
          const structuredCV = generateStructuredCV(optimizedText, jobDescription);
          
          // Generate job match analysis on the optimized content
          const analysis = analyzeJobMatch(optimizedText, jobDescription);
          setJobMatchAnalysis(analysis);
          
          // Complete processing
          setIsProcessing(false);
          setIsProcessed(true);
          setProcessingStatus("Optimization complete (using local processing)");
          setActiveTab('optimizedCV');
          
          logger.info("Local fallback processing successfully completed");
        } catch (error) {
          logger.error("Error in local fallback processing:", error instanceof Error ? error.message : String(error));
          
          // Even if there's an error, try to show something
          setError("Error in local processing. Showing partial results.");
          setIsProcessing(false);
          setIsProcessed(true);
          
          // Generate a simple fallback if everything else fails
          const simpleOptimizedText = `
PROFILE:
Professional with experience in relevant fields seeking a position that matches my skills and qualifications.

SKILLS:
• Communication
• Problem Solving
• Teamwork
• Adaptability
• Time Management

EXPERIENCE:
• Previous relevant positions with demonstrated success
• Collaborated with teams to achieve goals
• Implemented solutions to improve processes

EDUCATION:
• Relevant degree or certification
`;
          
          setOptimizedText(simpleOptimizedText);
          setJobMatchAnalysis({
            score: 65,
            matchedKeywords: [],
            missingKeywords: [],
            recommendations: ["Consider adding more specific skills related to the job description"],
            skillGap: "Some skills from the job description may be missing from your CV",
            dimensionalScores: {
              skillsMatch: 0.65,
              experienceMatch: 0.65,
              educationMatch: 0.65,
              industryFit: 0.65,
              overallCompatibility: 0.65,
              keywordDensity: 0.65,
              formatCompatibility: 0.65,
              contentRelevance: 0.65
            },
            detailedAnalysis: "This is a fallback analysis due to processing errors.",
            improvementPotential: 35,
            sectionAnalysis: {
              profile: { score: 0.65, feedback: "Consider enhancing your profile section" },
              skills: { score: 0.65, feedback: "Add more relevant skills" },
              experience: { score: 0.65, feedback: "Highlight relevant experience" },
              education: { score: 0.65, feedback: "Emphasize relevant education" },
              achievements: { score: 0.65, feedback: "Add specific achievements" }
            }
          });
        }
      }
    }, 500);
    
    // Return a cleanup function
    return () => {
      if (processingIntervalRef.current) {
        clearInterval(processingIntervalRef.current);
        processingIntervalRef.current = null;
      }
    };
  };
  
  // Generate optimized text based on job description
  const generateOptimizedText = (originalText: string | null, jobDescription: string): string => {
    // This is a placeholder for the actual AI-powered optimization
    // In a real implementation, this would call an API to optimize the CV
    
    // Use empty string if originalText is null
    const cvText = originalText || '';
    
    // Extract job title from job description (first line or first sentence)
    const jobTitleMatch = jobDescription.match(/^(.+?)(?:\n|\.)/);
    const extractedJobTitle = jobTitleMatch ? jobTitleMatch[1].trim() : 'Position';
    
    // Set job title if it's not already set
    if (!jobTitle) {
      setJobTitle(extractedJobTitle);
    }
    
    // Create a structured format for the optimized CV
    const optimizedContent = `
PROFILE:
Experienced professional with a strong background in ${extractKeywords(jobDescription, true).slice(0, 3).join(', ')}. Proven track record of delivering results in ${extractKeywords(jobDescription, true).slice(3, 6).join(', ')}. Seeking to leverage my skills and experience to excel as a ${extractedJobTitle}.

ACHIEVEMENTS:
• Successfully implemented solutions that increased efficiency by 30% in previous roles
• Recognized for outstanding performance and dedication to excellence
• Collaborated effectively with cross-functional teams to achieve organizational goals

GOALS:
• To contribute my expertise in ${extractKeywords(jobDescription, true).slice(0, 2).join(' and ')} to help achieve company objectives
• To continuously develop my skills and knowledge in ${extractKeywords(jobDescription, true).slice(2, 4).join(' and ')}
• To build strong relationships with colleagues and stakeholders to foster a collaborative work environment

SKILLS:
${extractKeywords(cvText).filter(keyword => 
  extractKeywords(jobDescription, true).includes(keyword)
).slice(0, 10).map(skill => `• ${skill}`).join('\n')}

EDUCATION:
${extractEducationData(cvText).map(edu => 
  `• ${edu.degree}, ${edu.institution || 'Institution'}${edu.year ? `, ${edu.year}` : ''}`
).join('\n')}

EXPERIENCE:
${extractExperienceData(cvText).map(exp => 
  `• ${exp.title || 'Professional'}${exp.startDate && exp.endDate ? ` (${exp.startDate} - ${exp.endDate})` : ''}`
).join('\n')}

LANGUAGES:
${extractLanguages(cvText).map(lang => `• ${lang}`).join('\n')}
`;
    
    return optimizedContent;
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

  // Modify the generateDocument function to use caching and add fallback mechanisms
  const generateDocument = async () => {
    if (isGeneratingDocument || !optimizedText) {
      console.log("Cannot generate document: already generating or no optimized text");
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
      
      // Log the parameters being sent to the API
      console.log("Sending to API:", {
        cvId: selectedCVId,
        optimizedTextLength: optimizedText ? optimizedText.length : 0,
        jobDescriptionLength: jobDescription ? jobDescription.length : 0,
        jobTitle: jobTitle || ''
      });
      
      // Use our retry mechanism for document generation
      const generateDocumentFn = () => fetch('/api/cv/specific-generate-docx', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          cvId: selectedCVId,
          optimizedText,
          jobDescription: jobDescription || '',
          jobTitle: jobTitle || '',
        }),
      });
      
      // Generate document with retry mechanism
      let response;
      try {
        response = await generateDocumentFn();
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
          throw new Error(errorData.error || `Server responded with status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (!data.success) {
          throw new Error(data.error || 'Failed to generate document');
        }
        
        // Step 4: Prepare for download
        setProcessingProgress(80);
        setProcessingStatus("Preparing for download...");
        
        // If we have a download URL, create a blob from it
        if (data.downloadUrl) {
          // Extract the base64 data from the data URL
          const base64Data = data.downloadUrl.split(',')[1];
          
          // Convert base64 to blob
          const binaryString = window.atob(base64Data);
          const bytes = new Uint8Array(binaryString.length);
          
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          
          const documentBlob = new Blob([bytes], { 
            type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' 
          });
          
          // Cache the document for manual download
          setCachedDocument({
            doc: null,
            blob: documentBlob,
            text: optimizedText,
            url: URL.createObjectURL(documentBlob),
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
            async () => await downloadDocument(documentBlob, filename),
            10000 // 10 second timeout
          );
          
          // Always mark as complete, even if download fails
          setProcessingProgress(100);
          setIsDownloading(false);
          
          if (downloadSuccess) {
            setIsDownloadComplete(true);
            setProcessingStatus("Document generated and downloaded successfully!");
          } else {
            // If automatic download failed but we have the document cached
            setProcessingStatus("Document generated successfully. Manual download available.");
            setDocumentError("Automatic download failed. Please use the manual download button below.");
          }
        } else {
          throw new Error('No download URL received from server');
        }
      } catch (error) {
        console.error("Error generating document:", error);
        throw error;
      }
    } catch (error) {
      console.error("Document generation error:", error);
      
      setProcessingProgress(0);
      setProcessingStatus("Document generation failed");
      setDocumentError(`Failed to generate document: ${error instanceof Error ? error.message : 'Unknown error'}`);
      
      // Show a more user-friendly error message
      toast({
        title: "Document Generation Failed",
        description: "We couldn't generate your document. Please try again or contact support if the problem persists.",
        variant: "destructive"
      });
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
    if (isGeneratingDocument || !optimizedText) {
      return;
    }
    
    // Start document generation
    generateDocument();
  };

  // Add a function to retry document generation
  const handleRetryGeneration = () => {
    // Reset document generation state
    setIsGeneratingDocument(false);
    setProcessingProgress(0);
    setProcessingStatus("");
    setDocumentError(null);
    setIsDownloading(false);
    setIsDownloadComplete(false);
    
    // Start document generation again
    generateDocument();
  };

  // Reset the optimization process
  const resetOptimization = useCallback(() => {
    setIsProcessing(false);
    setIsProcessed(false);
    setProcessingProgress(0);
    setProcessingStatus("");
    setError(null);
    setProcessingTooLong(false);
    setOptimizedText("");
    setJobMatchAnalysis(null);
    setCachedDocument({ doc: null, blob: null, text: null, timestamp: Date.now() });
    setIsGeneratingDocument(false);
    setIsDownloading(false);
    setIsDownloadComplete(false);
    setDocumentError(null);
  }, []);

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
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-xl font-semibold">Job Match Analysis</h3>
                  
                  {/* Add Generate DOCX button here */}
                  <Button
                    onClick={handleGenerateDocument}
                    disabled={isGeneratingDocument || !optimizedText}
                    className="bg-[#B4916C] hover:bg-[#A3815B] text-white"
                  >
                    {isGeneratingDocument ? (
                      <>
                        <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <FileText className="mr-2 h-4 w-4" />
                        Generate DOCX
                      </>
                    )}
                  </Button>
                </div>
                
                {/* Document Generation Progress */}
                {(isGeneratingDocument || processingProgress > 0) && (
                  <DocumentGenerationProgress 
                    isGenerating={isGeneratingDocument}
                    progress={processingProgress || 0}
                    status={processingStatus || ''}
                    processingTooLong={processingTooLong}
                    onRetry={handleRetryGeneration}
                    onCancel={() => {
                      setIsGeneratingDocument(false);
                      setProcessingProgress(0);
                      setProcessingStatus("");
                    }}
                  />
                )}
                
                {/* Document Download Status */}
                {(isDownloading || isDownloadComplete || documentError) && (
                  <DocumentDownloadStatus
                    isGeneratingDocument={isGeneratingDocument}
                    isDownloading={isDownloading}
                    isDownloadComplete={isDownloadComplete}
                    documentError={documentError}
                    processingStatus={processingStatus}
                    processingProgress={processingProgress}
                    onManualDownload={handleManualDownload}
                    onRetry={handleRetryGeneration}
                  />
                )}
                
                {/* Overall Score Section */}
                <div className="flex flex-col md:flex-row items-start gap-6 mt-4">
                  <div className="w-full md:w-1/3 bg-[#050505] rounded-lg p-4 border border-gray-800">
                    <h4 className="text-lg font-medium mb-3">Overall Match</h4>
                    <div className="flex flex-col items-center">
                      <div className="flex items-baseline">
                        <span className="text-4xl font-bold" style={{ 
                          color: 
                            jobMatchAnalysis.score >= 80 ? 'rgb(34, 197, 94)' : 
                            jobMatchAnalysis.score >= 60 ? 'rgb(234, 179, 8)' : 
                            'rgb(239, 68, 68)'
                        }}>
                          {jobMatchAnalysis.score}%
                        </span>
                        <div className="w-16 h-16 relative">
                          <svg viewBox="0 0 36 36" className="w-full h-full">
                            <path
                              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                              fill="none"
                              stroke="#444"
                              strokeWidth="2"
                              strokeDasharray="100, 100"
                            />
                            <path
                              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                              fill="none"
                              stroke={
                                jobMatchAnalysis.score >= 80 ? 'rgb(34, 197, 94)' : 
                                jobMatchAnalysis.score >= 60 ? 'rgb(234, 179, 8)' : 
                                'rgb(239, 68, 68)'
                              }
                              strokeWidth="2"
                              strokeDasharray={`${jobMatchAnalysis.score}, 100`}
                            />
                          </svg>
                        </div>
                      </div>
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
            
            {/* Document Generation Progress/Error */}
            {isGeneratingDocument && (
              <div className="mb-4 p-3 bg-[#121212] border border-[#B4916C]/30 rounded-md">
                <div className="flex items-center mb-2">
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin text-[#B4916C]" />
                  <span className="text-sm font-medium">
                    {documentError && documentError.includes('(') && documentError.includes('%') 
                      ? documentError 
                      : "Generating document..."}
                  </span>
                </div>
                <Progress 
                  value={documentError && documentError.includes('(') && documentError.includes('%')
                    ? parseInt(documentError.match(/\((\d+)%\)/)?.[1] || "0") 
                    : 0} 
                  className="h-1.5" 
                />
              </div>
            )}
            
            {/* Document Error (when not generating) */}
            {!isGeneratingDocument && documentError && (
              <Alert className="mb-4 bg-destructive/10">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription dangerouslySetInnerHTML={{ __html: documentError }} />
              </Alert>
            )}
            
            <div className="whitespace-pre-wrap font-mono text-sm bg-[#050505] p-4 rounded-md border border-gray-700">
              {optimizedText}
            </div>
          </div>
        </div>
      )}

      {/* Document Generation Section - More prominent */}
      {isProcessed && !isGeneratingDocument && (
        <div className="mt-6 p-6 border border-[#B4916C]/30 rounded-lg bg-[#0D0D0D]">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-semibold text-white">Generate Document</h3>
            <span className={`px-3 py-1 text-xs rounded-full ${
              isDownloadComplete ? 'bg-green-500/20 text-green-500' : 'bg-[#B4916C]/20 text-[#B4916C]'
            }`}>
              {isDownloadComplete ? 'Complete' : 'Ready'}
            </span>
          </div>
          
          <p className="text-gray-300 mb-6">
            Your CV has been optimized for the job description. Generate a professionally formatted DOCX document that you can download and use for your application.
          </p>
          
          <Button
            onClick={handleGenerateDocument}
            disabled={isGeneratingDocument || !optimizedText}
            className="w-full bg-[#B4916C] hover:bg-[#A3815C] text-white py-6"
            size="lg"
          >
            {isDownloadComplete ? (
              <>
                <Download className="mr-2 h-5 w-5" />
                Download Document Again
              </>
            ) : (
              <>
                <FileText className="mr-2 h-5 w-5" />
                Generate & Download DOCX
              </>
            )}
          </Button>
          
          {/* Document Generation Tips */}
          <div className="mt-4 p-4 border border-gray-800 rounded-md bg-black/30">
            <h4 className="flex items-center text-sm font-medium mb-2 text-gray-300">
              <Info className="h-4 w-4 mr-2 text-[#B4916C]" />
              Document Generation Tips
            </h4>
            <ul className="text-xs text-gray-400 space-y-1 list-disc pl-5">
              <li>The generated document will include all sections from your optimized CV</li>
              <li>Document generation may take up to 30 seconds for complex CVs</li>
              <li>If generation fails, try again or use a different browser</li>
              <li>For best results, ensure your CV has clear section headers</li>
            </ul>
          </div>
        </div>
      )}

      {/* Document Generation Progress */}
      {(isGeneratingDocument || processingProgress > 0) && (
        <DocumentGenerationProgress 
          isGenerating={isGeneratingDocument}
          progress={processingProgress || 0}
          status={processingStatus || ''}
          processingTooLong={processingTooLong}
          onRetry={handleRetryGeneration}
          onCancel={() => {
            setIsGeneratingDocument(false);
            setProcessingProgress(0);
            setProcessingStatus("");
          }}
        />
      )}
      
      {/* Document Download Status */}
      {(isDownloading || isDownloadComplete || documentError) && (
        <DocumentDownloadStatus
          isGeneratingDocument={isGeneratingDocument}
          isDownloading={isDownloading}
          isDownloadComplete={isDownloadComplete}
          documentError={documentError}
          processingStatus={processingStatus}
          processingProgress={processingProgress}
          onManualDownload={handleManualDownload}
          onRetry={handleRetryGeneration}
        />
      )}
      
      {/* Document Generation Progress Display */}
      {isGeneratingDocument && (
        <div className="mt-4 p-4 border border-gray-700 rounded-md bg-gray-800/50">
          <p className="text-sm text-gray-400 mb-2">
            Please wait while we generate your optimized document. This may take a few moments.
          </p>
          
          {processingProgress > 0 && processingProgress < 100 && processingProgress === processingProgress && (
            <div className="text-xs text-gray-500">
              <p>Generating a document with all your optimized content...</p>
            </div>
          )}
        </div>
      )}
      
      {/* Document Error with Manual Download Option */}
      {documentError && !isGeneratingDocument && (
        <div className="mt-4 p-4 border border-red-800/50 rounded-md bg-red-900/20">
          <h3 className="text-lg font-medium mb-2 text-red-400">Document Generation Issue</h3>
          <p className="text-sm text-gray-300 mb-3">{documentError}</p>
          
          {cachedDocument?.blob && (
            <div className="space-y-2">
              <button
                onClick={handleManualDownload}
                className="w-full px-4 py-3 bg-[#B4916C] text-white rounded-md hover:bg-[#A3815B] transition-colors flex items-center justify-center font-medium"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Download Document Manually
              </button>
              <p className="text-xs text-gray-400 text-center">
                Click the button above to download your document. If this doesn't work, please try again in a different browser.
              </p>
            </div>
          )}
        </div>
      )}
      
      {/* Manual Download Button - Always show when there's a cached document */}
      {cachedDocument?.blob && !documentError && !isGeneratingDocument && (
        <div className="mt-4 p-4 border border-gray-700 rounded-md bg-gray-800/50">
          <h3 className="text-lg font-medium mb-2 text-gray-200">Document Ready</h3>
          <p className="text-sm text-gray-300 mb-3">Your document has been generated and is ready for download.</p>
          
          <button
            onClick={handleManualDownload}
            className="w-full px-4 py-2 bg-[#B4916C] text-white rounded-md hover:bg-[#A3815B] transition-colors flex items-center justify-center"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Download Document
          </button>
        </div>
      )}
      
      {/* Document Generation Tips */}
      {!isGeneratingDocument && !cachedDocument?.blob && (
        <div className="mt-4 p-4 border border-gray-700 rounded-md bg-gray-800/50">
          <h4 className="flex items-center text-sm font-medium mb-2 text-gray-300">
            <Info className="h-4 w-4 mr-2 text-blue-400" />
            Document Generation Tips
          </h4>
          <ul className="text-xs text-gray-400 space-y-1 list-disc pl-5">
            <li>The generated document will include all sections from your optimized CV</li>
            <li>Document generation may take up to 30 seconds for complex CVs</li>
            <li>If generation fails, try again or use a different browser</li>
            <li>For best results, ensure your CV has clear section headers</li>
          </ul>
        </div>
      )}

      {/* Reset Button - Show when there's an error or process is stuck */}
      {(error || processingTooLong) && (
        <div className="mt-4">
          <Button
            onClick={resetOptimization}
            variant="outline"
            className="w-full border-red-700 text-red-500 hover:bg-red-900/20"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Reset and Try Again
          </Button>
          <p className="text-xs text-gray-400 mt-2 text-center">
            {error ? 
              "An error occurred during optimization. Click above to reset and try again." : 
              "The process seems to be taking too long. You can reset and try again."}
          </p>
        </div>
      )}
    </div>
  );
} 
