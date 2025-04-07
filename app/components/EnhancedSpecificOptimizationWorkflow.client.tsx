/* use client */
'use client';

import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, BorderStyle, Table, TableRow, TableCell, WidthType, Header, Footer } from 'docx';
import { saveAs } from 'file-saver';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertCircle, RefreshCw, Clock, Info, Download, FileText, CheckCircle, AlertTriangle, ChevronDown, Briefcase } from "lucide-react";
import { analyzeCVContent, optimizeCVForJob } from '@/lib/services/mistral.service';
import { tailorCVForJob as origTailorCVForJob, getIndustryOptimizationGuidance } from '@/app/lib/services/tailorCVService';
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

// Add industry insights to the interface
interface IndustryInsights {
  industry: string;
  keySkills: string[];
  suggestedMetrics: string[];
  formatGuidance: string;
  salaryRange?: string;
  tips?: string;
}

// Add a type interface for the tailoring API response
interface TailoringResult {
  tailoredContent: string;
  enhancedProfile: string;
  sectionImprovements: Record<string, string>;
  success: boolean;
  error?: string;
  industryInsights?: {
    industry: string;
    keySkills: string[];
    suggestedMetrics: string[];
    formatGuidance: string;
    salaryRange?: string;
    tips?: string;
  };
}

// Utility functions
const extractKeywords = (text: string, isJobDescription: boolean = false): string[] => {
  const commonWords = new Set([
    'the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'i', 'it', 'for', 'not', 'on', 'with', 'he', 'as', 'you',
    'do', 'at', 'this', 'but', 'his', 'by', 'from', 'they', 'we', 'say', 'her', 'she', 'or', 'an', 'will', 'my', 'one',
    'all', 'would', 'there', 'their', 'what', 'so', 'up', 'out', 'if', 'about', 'who', 'get', 'which', 'go', 'me',
    'our', 'us', 'your', 'has', 'had', 'was', 'were', 'is', 'are', 'been', 'being', 'have', 'having', 'do', 'does',
    'did', 'doing', 'can', 'could', 'should', 'may', 'might', 'must', 'shall', 'will', 'would', 'year', 'years',
    'month', 'months', 'day', 'days', 'use', 'using', 'like', 'well', 'very', 'just', 'also', 'any', 'some', 'such'
  ]);

  // Enhanced job description specific keywords to focus on
  const importanceIndicators = [
    'required', 'must', 'should', 'need', 'essential', 'necessary', 'mandatory', 'critical',
    'crucial', 'important', 'key', 'core', 'primary', 'significant', 'vital', 'fundamental'
  ];

  const skillIndicators = [
    'skill', 'skills', 'proficiency', 'proficient', 'expertise', 'expert', 'experience',
    'experienced', 'knowledge', 'ability', 'capable', 'competency', 'competent',
    'familiar', 'understanding', 'mastery', 'qualification', 'qualified'
  ];

  // Extract phrases (2-3 word combinations that might be important)
  const extractPhrases = (input: string): string[] => {
    const words = input.toLowerCase()
      .replace(/[^\w\s-]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 1);
    
    const phrases = [];
    
    // Extract 2-word phrases
    for (let i = 0; i < words.length - 1; i++) {
      if (!commonWords.has(words[i]) || !commonWords.has(words[i+1])) {
        phrases.push(`${words[i]} ${words[i+1]}`);
      }
    }
    
    // Extract 3-word phrases for technical concepts
    for (let i = 0; i < words.length - 2; i++) {
      // Only include 3-word phrases if at least one word is not common
      if (!commonWords.has(words[i]) || !commonWords.has(words[i+1]) || !commonWords.has(words[i+2])) {
        phrases.push(`${words[i]} ${words[i+1]} ${words[i+2]}`);
      }
    }
    
    return phrases;
  };
  
  // Extract single keywords
  const extractSingleKeywords = (input: string): Map<string, number> => {
    const wordFrequency = new Map<string, number>();
    
    const words = input.toLowerCase()
      .replace(/[^\w\s-]/g, ' ')
      .split(/\s+/)
      .filter(word => 
        word.length > 2 && 
        !commonWords.has(word) &&
        !/^\d+$/.test(word)
      );
    
    words.forEach(word => {
      wordFrequency.set(word, (wordFrequency.get(word) || 0) + 1);
    });
    
    return wordFrequency;
  };

  // For job descriptions, focus on requirement-related words and phrases
  if (isJobDescription) {
    const lines = text.split('\n');
    const requirementLines = lines.filter(line => 
      importanceIndicators.some(indicator => line.toLowerCase().includes(indicator)) ||
      skillIndicators.some(indicator => line.toLowerCase().includes(indicator))
    );
    
    // Join requirement lines for focused processing
    const requirementText = requirementLines.join(' ');
    
    // Extract specific requirements with importance weighting
    const weightedKeywords = new Map<string, number>();
    
    // Process each line to extract keywords with weights
    lines.forEach(line => {
      const lineLower = line.toLowerCase();
      let lineWeight = 1;
      
      // Increase weight for lines with importance indicators
      if (importanceIndicators.some(indicator => lineLower.includes(indicator))) {
        lineWeight += 2;
      }
      
      // Increase weight for lines with skill indicators
      if (skillIndicators.some(indicator => lineLower.includes(indicator))) {
        lineWeight += 1;
      }
      
      // Extract words from this line and add them with appropriate weight
      const lineWords = extractSingleKeywords(line);
      lineWords.forEach((count, word) => {
        weightedKeywords.set(word, (weightedKeywords.get(word) || 0) + (count * lineWeight));
      });
      
      // Add phrases with higher weight as they're more specific
      const linePhrases = extractPhrases(line);
      linePhrases.forEach(phrase => {
        if (phrase.length > 5) { // Only consider meaningful phrases (not just two small words)
          weightedKeywords.set(phrase, (weightedKeywords.get(phrase) || 0) + (lineWeight * 1.5));
        }
      });
    });
    
    // Extract phrases from the entire text to catch important multi-word terms
    const allPhrases = extractPhrases(text);
    allPhrases.forEach(phrase => {
      // If a phrase appears in a bullet point or after a colon, increase its weight
      const phraseRegex = new RegExp(`[•\\-\\*:]\\s*${phrase}|${phrase}\\s*:`, 'i');
      if (phraseRegex.test(text)) {
        weightedKeywords.set(phrase, (weightedKeywords.get(phrase) || 0) + 2);
      } else {
        weightedKeywords.set(phrase, (weightedKeywords.get(phrase) || 0) + 1);
      }
    });
    
    // Extract tech skills specifically - they often have special characters
    const techSkillPattern = /(?:frameworks?|languages?|tools?|technologies|stacks?|platforms?|systems?|software|environments?|databases?)(?:\s+(?:like|such as|including|e\.g\.)\s+|:\s*)([^.!?]+)/gi;
    let match;
    while ((match = techSkillPattern.exec(text)) !== null) {
      if (match[1]) {
        const techList = match[1].split(/(?:[,;]|\s+and\s+|\s+or\s+)/);
        techList.forEach(tech => {
          const cleanTech = tech.trim().toLowerCase().replace(/[^\w\s-./+#]+/g, '');
          if (cleanTech && cleanTech.length > 1) {
            weightedKeywords.set(cleanTech, (weightedKeywords.get(cleanTech) || 0) + 3); // Higher weight for tech skills
          }
        });
      }
    }
    
    // Sort by weight and convert to array
    const sortedKeywords = Array.from(weightedKeywords.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([word]) => word);
    
    // Remove duplicates (e.g., if "machine learning" and "learning" are both present, keep only "machine learning")
    const filteredKeywords = sortedKeywords.filter((keyword, idx) => {
      // Skip if this keyword is already processed
      if (keyword === null) return false;
      
      // Check if this keyword is part of any longer keyword with higher priority
      for (let i = 0; i < idx; i++) {
        if (sortedKeywords[i] !== null && sortedKeywords[i].includes(keyword)) {
          return false;
        }
      }
      
      // Check if this keyword contains any keywords with lower priority
      for (let i = idx + 1; i < sortedKeywords.length; i++) {
        if (sortedKeywords[i] !== null && keyword.includes(sortedKeywords[i])) {
          sortedKeywords[i] = null as unknown as string; // Mark as processed
        }
      }
      
      return true;
    }).filter(Boolean) as string[]; // Remove nulls
    
    return filteredKeywords;
  }
  
  // For CV content, use a simpler approach focusing on frequency
  const wordFrequency = extractSingleKeywords(text);
  
  // Sort by frequency and get unique words
  const sortedWords = Array.from(wordFrequency.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([word]) => word);

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
        className="w-full px-4 py-3.5 bg-[#050505] border border-[#333333] hover:border-[#B4916C] text-[#F9F6EE] rounded-lg flex justify-between items-center transition-colors duration-200 font-borna"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="truncate">{selectedCVName || "Select a CV"}</span>
        <ChevronDown
          className={`h-5 w-5 text-[#F9F6EE] transition-transform duration-300 ${open ? 'rotate-180' : ''}`}
        />
      </button>
      
      {open && cvs.length > 0 && (
        <div className="absolute z-10 w-full mt-1 bg-[#050505] border border-[#333333] rounded-lg shadow-xl max-h-60 overflow-auto animate-fade-in">
          <ul className="py-1" role="listbox">
            {cvs.map((cv) => {
              const [name, id] = cv.split('|');
              return (
                <li 
                  key={id}
                  className="px-4 py-3 text-sm text-[#F9F6EE] hover:bg-[#111111] hover:text-[#B4916C] cursor-pointer transition-colors duration-150 font-borna"
                  role="option"
                  onClick={() => { setOpen(false); onSelect(id.trim(), name.trim()); }}
                >
                  {name.trim()}
                </li>
              );
            })}
          </ul>
        </div>
      )}
      
      {open && cvs.length === 0 && (
        <div className="absolute z-10 w-full mt-1 bg-[#050505] border border-[#333333] rounded-lg shadow-xl animate-fade-in">
          <div className="px-4 py-3 text-sm text-[#F9F6EE]/50 font-borna">No CVs available</div>
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
  // Extract important job requirements and key phrases
  const extractKeyPhrases = (text: string): string[] => {
    const phrases: string[] = [];
    
    // Look for key requirement statements
  const requirementPatterns = [
      /(?:required|must have|essential|you will need)[:\s]+([^.;]+[.;])/gi,
      /(?:seeking|looking for)[:\s]+([^.;]+[.;])/gi,
      /(?:responsibilities include|will be responsible for|the role involves)[:\s]+([^.;]+[.;])/gi,
      /(?:ideal candidate|you will|you should)[:\s]+([^.;]+[.;])/gi
    ];
    
  requirementPatterns.forEach(pattern => {
      const matches = [...text.matchAll(pattern)];
    matches.forEach(match => {
        if (match[1] && match[1].trim().length > 10) {
          phrases.push(match[1].trim());
      }
    });
  });
  
    // Look for sentences containing key career terms
    const careerTerms = ['experience', 'background', 'expertise', 'skills', 'knowledge', 'qualifications'];
    careerTerms.forEach(term => {
      const termPattern = new RegExp(`[^.;]+\\b${term}\\b[^.;]+[.;]`, 'gi');
      const matches = [...text.matchAll(termPattern)];
      matches.forEach(match => {
        if (match[0] && match[0].trim().length > 15 && !phrases.includes(match[0].trim())) {
          phrases.push(match[0].trim());
        }
      });
    });
    
    return phrases;
  };
  
  // Generate a new profile if none exists or it's very short
  if (!profile || profile.length < 50) {
    const keyPhrases = extractKeyPhrases(jobDescription);
    const topKeywords = jobKeywords.slice(0, 5);
    
    // Create a compelling profile using job phrases and keywords
    return `Experienced professional with a strong background in ${topKeywords.slice(0, 3).join(', ')}. ${
      keyPhrases.length > 0 
        ? `Skilled in ${keyPhrases[0].toLowerCase().replace(/^i am |^i have |^you will |^the ideal candidate |^seeking |^looking for /i, '')}` 
        : `Seeking to leverage expertise in ${topKeywords.join(', ')} to excel in this role.`
    } Demonstrated ability to ${
      keyPhrases.length > 1 
        ? keyPhrases[1].toLowerCase().replace(/^i am |^i have |^you will |^the ideal candidate |^seeking |^looking for /i, '') 
        : `deliver results and contribute to team success through strong ${topKeywords.slice(3, 5).join(' and ')} skills.`
    }`;
  }
  
  // If profile exists but needs enhancement
  const keyPhrases = extractKeyPhrases(jobDescription);
  const profileLower = profile.toLowerCase();
  
  // Check if the profile already mentions key job requirements
  let containsKeyJobTerms = false;
  for (const keyword of jobKeywords.slice(0, 5)) {
    if (profileLower.includes(keyword.toLowerCase())) {
      containsKeyJobTerms = true;
      break;
    }
  }
  
  // If profile already contains key job terms, just return it with minor enhancement
  if (containsKeyJobTerms && profile.length > 100) {
    // Only add a minor enhancement if the profile is already strong
    return profile;
  }
  
  // Profile needs significant enhancement
  // Keep the original profile but add job-specific enhancements
  let enhancedProfile = profile.trim();
  
  // Make sure the profile ends with appropriate punctuation
  if (!/[.;!?]$/.test(enhancedProfile)) {
    enhancedProfile += '.';
  }
  
  // Add a sentence highlighting job-specific skills
  const jobSpecificAddition = ` Offers particular expertise in ${jobKeywords.slice(0, 3).join(', ')}`;
  
  // Add key job phrase if available
  if (keyPhrases.length > 0) {
    const keyPhrase = keyPhrases[0].toLowerCase()
      .replace(/^i am |^i have |^you will |^the ideal candidate |^seeking |^looking for /i, '')
      .replace(/\.$/, '');
      
    enhancedProfile += `${jobSpecificAddition} with demonstrated ability to ${keyPhrase}.`;
  } else {
    enhancedProfile += `${jobSpecificAddition}.`;
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
  
  // If no dedicated skills section found, try to extract technical skills from the entire document
  if (originalSkills.length === 0) {
    // Look for technical terms throughout the document
    const allPotentialSkills = text.split(/[,;\n]/)
      .map(item => item.trim())
      .filter(item => item.length > 0 && item.length < 30);
    
    allPotentialSkills.forEach(skill => {
      if (isLikelyTechnicalSkill(skill)) {
        originalSkills.push(skill);
      }
    });
  }
  
  // Validate the skills to ensure they're actually technical
  validatedSkills.push(...originalSkills.filter(skill => isLikelyTechnicalSkill(skill)));
  
  // Deduplicate and trim the list
  return [...new Set(validatedSkills)];
};

const extractProfessionalSkills = (text: string): string[] => {
  // Initialize the skills array
  const professionalSkills: string[] = [];
  
  // Common professional/soft skill keywords
  const commonProfessionalSkills = [
    'communication', 'teamwork', 'leadership', 'organization', 'time management',
    'problem solving', 'critical thinking', 'decision making', 'flexibility', 'adaptability',
    'interpersonal', 'negotiation', 'conflict resolution', 'presentation', 'public speaking',
    'customer service', 'client relations', 'project management', 'strategic planning',
    'team building', 'mentoring', 'coaching', 'supervision', 'creativity', 'innovation',
    'analytical thinking', 'research', 'writing', 'editing', 'attention to detail',
    'multitasking', 'prioritization', 'stress management', 'work ethic', 'professionalism',
    'collaboration', 'cultural awareness', 'emotional intelligence', 'self-motivation',
    'persuasion', 'networking', 'facilitation', 'active listening', 'empathy'
  ];
  
  // Function to check if a skill is likely a professional skill
  const isLikelyProfessionalSkill = (skill: string): boolean => {
    const lowerSkill = skill.toLowerCase();
    
    // Check if it's in our common list or contains common soft skill keywords
    if (commonProfessionalSkills.some(keyword => 
      lowerSkill.includes(keyword.toLowerCase()) || 
      keyword.toLowerCase().includes(lowerSkill)
    )) {
      return true;
    }
    
    // Check for common professional skill patterns
    if (/^(?:strong|excellent|effective|advanced)\s+[a-z]+(?:\s+[a-z]+)?(?:\s+skills)?$/i.test(lowerSkill)) {
      return true;
    }
    
    return false;
  };
  
  // Try to find soft skills/professional skills section
  const professionalPatterns = [
    /(?:soft|professional|interpersonal|personal|core|key)\s+skills[:\s]+(.*?)(?=\n\s*\n|\n(?:[A-Z][a-z]+\s*(?:&\s*)?)+:|\n\s*$)/is,
    /(?:skills|competencies)[:\s]+(.*?)(?=\n\s*\n|\n(?:[A-Z][a-z]+\s*(?:&\s*)?)+:|\n\s*$)/is
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
      const bulletSkills = skillsText
        .split(/\n/)
        .map(skill => skill.replace(/^[•\-\*\+\>\·\♦\■\□\◆\◇\○\●\★\☆]\s*/, '').trim())
        .filter(skill => skill.length > 0);
      
      // Add skills that seem like professional skills
      professionalSkills.push(...bulletSkills.filter(isLikelyProfessionalSkill));
    } else {
      // Extract skills from comma/semicolon separated list
      const listSkills = skillsText
        .split(/[,;]|\band\b/)
        .map(skill => skill.trim())
        .filter(skill => skill.length > 0);
      
      // Add skills that seem like professional skills
      professionalSkills.push(...listSkills.filter(isLikelyProfessionalSkill));
    }
  }
  
  // If no professional skills found, try to extract from entire document
  if (professionalSkills.length === 0) {
    // Look for professional skill terms throughout the document
    commonProfessionalSkills.forEach(skill => {
      if (text.toLowerCase().includes(skill.toLowerCase())) {
        professionalSkills.push(skill);
      }
    });
  }
  
  // Deduplicate and trim the list
  return [...new Set(professionalSkills)];
};

const extractAchievements = (text: string): string[] => {
  const achievements: string[] = [];
  
  // Try to find achievements section with various possible headers
  const achievementPatterns = [
    /(?:achievements|accomplishments|honors|awards|recognitions)[:\s]+(.*?)(?=\n\s*\n|\n(?:[A-Z][a-z]+\s*(?:&\s*)?)+:|\n\s*$)/is
  ];
  
  // Try each pattern to find achievements section
  let match = null;
  for (const pattern of achievementPatterns) {
    match = text.match(pattern);
    if (match && match[1]) break;
  }
  
  if (match && match[1]) {
    const achievementsText = match[1];
    
    // Check if achievements are in bullet point format
    const hasBulletPoints = /^[•\-\*\+\>\·\♦\■\□\◆\◇\○\●\★\☆]\s+/m.test(achievementsText);
    
    if (hasBulletPoints) {
      // Extract achievements from bullet points
      achievements.push(...achievementsText
        .split(/\n/)
        .map(achievement => achievement.replace(/^[•\-\*\+\>\·\♦\■\□\◆\◇\○\●\★\☆]\s*/, '').trim())
        .filter(achievement => achievement.length > 0));
    } else {
      // Extract achievements from paragraph or line format
      achievements.push(...achievementsText
        .split(/(?:\.|\n)/)
        .map(achievement => achievement.trim())
        .filter(achievement => achievement.length > 0));
    }
  } else {
    // If no dedicated section found, try to find achievement-like statements in experience
    const experiencePattern = /(?:experience|work history|employment)[:\s]+(.*?)(?=\n\s*\n|\n(?:[A-Z][a-z]+\s*(?:&\s*)?)+:|\n\s*$)/is;
    const expMatch = text.match(experiencePattern);
    
    if (expMatch && expMatch[1]) {
      const experienceText = expMatch[1];
      
      // Look for achievement indicators like metrics, numbers, percentages, awards
      const achievementIndicators = [
        /increased|improved|reduced|saved|boosted|achieved|won|awarded|recognized|delivered|developed|launched|implemented|led|managed|created|designed|orchestrated/i,
        /\d+%|\$\d+|\d+ percent|million|billion|thousand/i,
        /(?:team|employee|project) of the (?:month|year|quarter)/i,
        /successfully|effectively|efficiently/i
      ];
      
      // Split experience into bullet points or sentences
      const experienceItems = experienceText.includes('•') 
        ? experienceText.split(/\n/)
        : experienceText.split(/\./).map(s => s.trim()).filter(s => s.length > 0);
      
      // Filter for items that seem like achievements
      for (const item of experienceItems) {
        if (achievementIndicators.some(indicator => indicator.test(item))) {
          // Clean up the item and add it as an achievement
          const cleanItem = item
            .replace(/^[•\-\*\+\>\·\♦\■\□\◆\◇\○\●\★\☆]\s*/, '')
            .trim();
          
          if (cleanItem.length > 15) {  // Only include substantive achievements
            achievements.push(cleanItem);
          }
        }
      }
    }
  }
  
  // Limit to reasonable number of achievements
  return achievements.slice(0, 10);
};

const extractGoals = (text: string): string[] => {
  const goals: string[] = [];
  
  // Try to find goals or objectives section
  const goalPatterns = [
    /(?:goals|objectives|aspirations|career goals|career objectives)[:\s]+(.*?)(?=\n\s*\n|\n(?:[A-Z][a-z]+\s*(?:&\s*)?)+:|\n\s*$)/is,
    /(?:seeking|looking for|aim to|aiming to|intend to)[:\s]+(.*?)(?=\n\s*\n|\n(?:[A-Z][a-z]+\s*(?:&\s*)?)+:|\n\s*$)/is
  ];
  
  // Try each pattern to find goals section
  let match = null;
  for (const pattern of goalPatterns) {
    match = text.match(pattern);
    if (match && match[1]) break;
  }
  
  if (match && match[1]) {
    const goalsText = match[1];
    
    // Check if goals are in bullet point format
    const hasBulletPoints = /^[•\-\*\+\>\·\♦\■\□\◆\◇\○\●\★\☆]\s+/m.test(goalsText);
    
    if (hasBulletPoints) {
      // Extract goals from bullet points
      goals.push(...goalsText
        .split(/\n/)
        .map(goal => goal.replace(/^[•\-\*\+\>\·\♦\■\□\◆\◇\○\●\★\☆]\s*/, '').trim())
        .filter(goal => goal.length > 0));
    } else {
      // Extract goals from paragraph format, splitting by sentences
      goals.push(...goalsText
        .split(/\./)
        .map(goal => goal.trim())
        .filter(goal => goal.length > 0));
    }
  } else {
    // If no dedicated goals section, try to extract from profile/summary
    const profilePattern = /(?:profile|summary|objective|about)[:\s]+(.*?)(?=\n\s*\n|\n(?:[A-Z][a-z]+\s*(?:&\s*)?)+:|\n\s*$)/is;
    const profileMatch = text.match(profilePattern);
    
    if (profileMatch && profileMatch[1]) {
      const profileText = profileMatch[1];
      
      // Look for goal-oriented statements
      const goalIndicators = [
        /seeking|looking for|aim|aspire|goal|objective|career|advancement|growth|develop|expand|improve/i,
        /hope to|plan to|intend to|want to|desire to/i
      ];
      
      // Split by sentences
      const sentences = profileText.split(/\./).map(s => s.trim()).filter(s => s.length > 0);
      
      // Filter for goal-like statements
      for (const sentence of sentences) {
        if (goalIndicators.some(indicator => indicator.test(sentence))) {
          goals.push(sentence);
        }
      }
    }
  }
  
  // If still no goals found, create a generic one based on the document
  if (goals.length === 0) {
    // Try to extract key skills or experience for a generic goal
    const technicalSkills = extractTechnicalSkills(text);
    const experiences = extractExperienceData(text);
    
    if (technicalSkills.length > 0 && experiences.length > 0) {
      const recentTitle = experiences[0]?.title || 'professional';
      const topSkills = technicalSkills.slice(0, 3).join(', ');
      
      goals.push(`Seeking to leverage expertise in ${topSkills} and experience as a ${recentTitle} to contribute to company growth and success.`);
    } else {
      goals.push('Seeking to utilize skills and experience to contribute to organizational success while pursuing professional growth opportunities.');
    }
  }
  
  return goals.slice(0, 3); // Limit to a reasonable number of goals
};

const extractLanguages = (text: string): string[] => {
  // Try to find language section
  const languagePatterns = [
    /(?:languages|language proficiency|language skills)[:\s]+(.*?)(?=\n\s*\n|\n(?:[A-Z][a-z]+\s*(?:&\s*)?)+:|\n\s*$)/is
  ];
  
  let languages: string[] = [];
  
  // Try to find dedicated language section
  let match = null;
  for (const pattern of languagePatterns) {
    match = text.match(pattern);
    if (match && match[1]) break;
  }
  
  if (match && match[1]) {
    const languagesText = match[1];
    
    // Check if languages are in bullet point format
    const hasBulletPoints = /^[•\-\*\+\>\·\♦\■\□\◆\◇\○\●\★\☆]\s+/m.test(languagesText);
    
    if (hasBulletPoints) {
      // Extract languages from bullet points
      languages = languagesText
        .split(/\n/)
        .map(lang => lang.replace(/^[•\-\*\+\>\·\♦\■\□\◆\◇\○\●\★\☆]\s*/, '').trim())
        .filter(lang => lang.length > 0);
    } else {
      // Extract languages from comma/semicolon separated list
      languages = languagesText
        .split(/[,;]|\band\b/)
        .map(lang => lang.trim())
        .filter(lang => lang.length > 0);
    }
  } else {
    // If no language section found, try to extract from bullet points or lists in the document
    const bulletPoints = text.match(/(?:^|\n)[•\-\*\+\>\·\♦\■\□\◆\◇\○\●\★\☆]\s+([^\n]+)/g) || [];
    
    // Common language names to validate against
    const commonLanguages = [
      'english', 'spanish', 'french', 'german', 'italian', 'portuguese', 'russian', 
      'mandarin', 'chinese', 'japanese', 'korean', 'arabic', 'hindi', 'bengali', 
      'punjabi', 'dutch', 'swedish', 'norwegian', 'danish', 'finnish', 'polish', 
      'czech', 'slovak', 'hungarian', 'romanian', 'bulgarian', 'greek', 'turkish',
      'hebrew', 'thai', 'vietnamese', 'indonesian', 'malay', 'tagalog', 'filipino'
    ];
    
    // Check bullet points for language mentions
    for (const bullet of bulletPoints) {
      const bulletText = bullet.toLowerCase();
      for (const language of commonLanguages) {
        if (bulletText.includes(language)) {
          // Extract the full language entry (might include proficiency level)
          const cleanBullet = bullet
            .replace(/^[•\-\*\+\>\·\♦\■\□\◆\◇\○\●\★\☆]\s*/, '')
            .trim();
          languages.push(cleanBullet);
          break; // Move to next bullet point after finding a language
        }
      }
    }
    
    // If still no languages found, check for language mentions in the whole text
    if (languages.length === 0) {
      // Look for patterns like "Fluent in Spanish" or "Native English speaker"
      const languageMentions = [
        /(?:fluent|proficient|native|bilingual|conversational|intermediate|advanced|basic)\s+(?:in\s+)?([a-z]+)/gi,
        /([a-z]+)\s+(?:speaker|proficiency|fluency)/gi
      ];
      
      for (const pattern of languageMentions) {
        const matches = [...text.matchAll(pattern)];
        for (const match of matches) {
          if (match[1] && commonLanguages.includes(match[1].toLowerCase())) {
            languages.push(match[0]);
          }
        }
      }
    }
    
    // Filter out non-language entries
    languages = languages.filter(entry => 
      commonLanguages.some(language => 
        entry.toLowerCase().includes(language)
      )
    );
  }
  
  // Deduplicate
  return [...new Set(languages)];
};

// Wrapper for tailorCVForJob to match the component's usage
const tailorCVForJob = async ({
  cvId,
  cvName,
  jobTitle,
  jobDescription,
  originalText
}: {
  cvId: string;
  cvName: string;
  jobTitle: string;
  jobDescription: string;
  originalText: string;
}) => {
  // Call the original function with the expected parameters
  return origTailorCVForJob(
    originalText,
    jobDescription,
    jobTitle,
    parseInt(cvId)
  );
};

// Main component implementation
const EnhancedSpecificOptimizationWorkflow: React.FC<EnhancedSpecificOptimizationWorkflowProps> = ({ cvs }) => {
  // State management
  const [selectedCVId, setSelectedCVId] = useState<string>('');
  const [selectedCVName, setSelectedCVName] = useState<string>('');
  const [jobTitle, setJobTitle] = useState<string>('');
  const [jobDescription, setJobDescription] = useState<string>('');
  const [originalText, setOriginalText] = useState<string>('');
  const [optimizedText, setOptimizedText] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [processingStatus, setProcessingStatus] = useState<string | null>(null);
  const [processingProgress, setProcessingProgress] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [matchAnalysis, setMatchAnalysis] = useState<JobMatchAnalysis | null>(null);
  const [showDetailedAnalysis, setShowDetailedAnalysis] = useState<boolean>(false);
  const [completedOptimization, setCompletedOptimization] = useState<boolean>(false);
  const [tailoringResult, setTailoringResult] = useState<TailoringResult | null>(null);
  
  // Document generation states
  const [isGeneratingDocument, setIsGeneratingDocument] = useState<boolean>(false);
  const [documentGenerationProgress, setDocumentGenerationProgress] = useState<number>(0);
  const [documentGenerationStatus, setDocumentGenerationStatus] = useState<string>('');
  const [documentDownloadUrl, setDocumentDownloadUrl] = useState<string | null>(null);
  const [documentDownloadRequested, setDocumentDownloadRequested] = useState<boolean>(false);
  const [documentDownloadError, setDocumentDownloadError] = useState<string | null>(null);
  
  const { toast } = useToast();
  
  // Fetch original CV text when CV is selected
  const handleCVChange = (cvId: string, cvName: string) => {
    setSelectedCVId(cvId);
    setSelectedCVName(cvName);
    setOptimizedText(null);
    setCompletedOptimization(false);
    setTailoringResult(null);
    setMatchAnalysis(null);
    setError(null);
    
    if (cvId) {
      fetchOriginalText(cvId);
    }
  };
  
  const fetchOriginalText = async (cvId: string) => {
    try {
      const response = await fetch(`/api/cv/${cvId}/content`);
      if (!response.ok) {
        throw new Error('Failed to fetch CV content');
      }
      const data = await response.json();
      setOriginalText(data.content);
    } catch (error) {
      setError('Error fetching CV content');
      console.error('Error fetching CV content:', error);
    }
  };
  
  const handleOptimize = async () => {
    if (!selectedCVId || !jobDescription) {
      setError('Please select a CV and enter a job description');
      return;
    }
    
    setIsProcessing(true);
    setProcessingStatus('Analyzing job description...');
    setProcessingProgress(10);
    setError(null);
    setOptimizedText(null);
    setMatchAnalysis(null);
    setCompletedOptimization(false);
    setTailoringResult(null);
    
    try {
      // Analyze match first
      setProcessingStatus('Analyzing CV compatibility with job...');
      setProcessingProgress(30);
      const match = analyzeJobMatch(originalText, jobDescription);
      setMatchAnalysis(match);
      
      // Then optimize based on job description
      setProcessingStatus('Tailoring CV for job...');
      setProcessingProgress(50);
      
      const tailorResponse = await tailorCVForJob({
        cvId: selectedCVId,
        cvName: selectedCVName,
        jobTitle: jobTitle || 'Specified Position',
        jobDescription,
        originalText
      });
      
      if (tailorResponse.error) {
        throw new Error(tailorResponse.error);
      }
      
      setTailoringResult(tailorResponse);
      setOptimizedText(tailorResponse.tailoredContent);
      
      // Update status based on industry if available
      if (tailorResponse.industryInsights?.industry) {
        setProcessingStatus(`Optimizing for ${tailorResponse.industryInsights?.industry || 'General'} industry...`);
      }
      
      setProcessingProgress(100);
      setCompletedOptimization(true);
      
      toast({
        title: "Optimization Complete",
        description: "Your CV has been tailored for the job description.",
      });
    } catch (error) {
      console.error('Optimization error:', error);
      setError('Failed to optimize CV. Please try again.');
    } finally {
      setIsProcessing(false);
      setProcessingStatus(null);
    }
  };
  
  const generateDocument = async () => {
    if (!optimizedText) {
      setDocumentDownloadError('No optimized content to generate document from');
      return;
    }
    
    setIsGeneratingDocument(true);
    setDocumentGenerationProgress(0);
    setDocumentGenerationStatus('Preparing document...');
    setDocumentDownloadUrl(null);
    setDocumentDownloadError(null);
    
    try {
      // Update status during document generation
      const updateProgress = (progress: number, status: string) => {
        setDocumentGenerationProgress(progress);
        setDocumentGenerationStatus(status);
      };
      
      // Make API call to generate document
      const response = await fetch('/api/cv/generate-document', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: optimizedText,
          fileName: `${selectedCVName}_Optimized`,
        }),
      });
      
      if (!response.ok) {
        throw new Error(`Failed to generate document: ${response.status}`);
      }
      
      const result = await response.json();
      
      if (result.success) {
        setDocumentDownloadUrl(result.downloadUrl);
        setDocumentGenerationStatus('Document ready for download');
        setDocumentGenerationProgress(100);
      } else {
        throw new Error(result.error || 'Failed to generate document');
      }
    } catch (error) {
      console.error('Document generation error:', error);
      setDocumentDownloadError('Failed to generate document. Please try again.');
      setDocumentGenerationStatus('Document generation failed');
    } finally {
      setIsGeneratingDocument(false);
    }
  };
  
  const downloadGeneratedDocument = async () => {
    if (!documentDownloadUrl) {
      setDocumentDownloadError('No document URL available');
      return;
    }
    
    setDocumentDownloadRequested(true);
    
    try {
      // Create a blob from the download URL
      const response = await fetch(documentDownloadUrl);
      if (!response.ok) {
        throw new Error('Failed to fetch document');
      }
      
      const blob = await response.blob();
      
      // Use the downloadDocument utility with the blob
      const success = await downloadBlob(blob, `${selectedCVName}_Optimized.docx`);
      
      if (!success) {
        throw new Error('Failed to download document');
      }
      
      setDocumentDownloadRequested(false);
      toast({
        title: "Download Complete",
        description: "Your optimized CV has been downloaded.",
      });
    } catch (error) {
      console.error('Download error:', error);
      setDocumentDownloadError('Failed to download document. Please try again.');
      setDocumentDownloadRequested(false);
    }
  };
  
  return (
    <div className="space-y-6">
      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-[#F9F6EE] mb-2">Select CV</label>
          <select
            value={selectedCVId}
            onChange={(e) => {
              const cvId = e.target.value;
              const cv = cvs.find(cv => cv.id === cvId);
              handleCVChange(cvId, cv ? cv.name : '');
            }}
            className="w-full px-4 py-3.5 bg-[#050505] border border-[#333333] hover:border-[#B4916C] text-[#F9F6EE] rounded-lg flex justify-between items-center transition-colors duration-200 font-borna"
          >
            <option value="">Select a CV</option>
            {cvs.map((cv) => (
              <option key={cv.id} value={cv.id}>
                {cv.name}
              </option>
            ))}
          </select>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-[#F9F6EE] mb-2">Job Title</label>
          <input
            type="text"
            value={jobTitle}
            onChange={(e) => setJobTitle(e.target.value)}
            placeholder="Enter job title"
            className="w-full px-4 py-3.5 bg-[#050505] border border-[#333333] hover:border-[#B4916C] text-[#F9F6EE] rounded-lg transition-colors duration-200 font-borna"
          />
        </div>
      </div>
      
      <div>
        <label className="block text-sm font-medium text-[#F9F6EE] mb-2">Job Description</label>
        <textarea
          value={jobDescription}
          onChange={(e) => setJobDescription(e.target.value)}
          placeholder="Paste job description here"
          rows={10}
          className="w-full px-4 py-3.5 bg-[#050505] border border-[#333333] hover:border-[#B4916C] text-[#F9F6EE] rounded-lg transition-colors duration-200 font-borna resize-none"
        />
      </div>
      
      <div>
        <Button
          onClick={handleOptimize}
          disabled={isProcessing || !selectedCVId || !jobDescription}
          className="bg-[#B4916C] hover:bg-[#A38060] text-black font-medium py-3 px-8 rounded-lg transition-colors duration-200 flex items-center gap-2 font-borna"
        >
          {isProcessing ? (
            <>
              <RefreshCw className="h-4 w-4 animate-spin" />
              Optimizing...
            </>
          ) : (
            <>Tailor CV for This Job</>
          )}
        </Button>
      </div>
      
      {isProcessing && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-[#F9F6EE]/70">{processingStatus}</span>
            <span className="text-sm text-[#F9F6EE]/70">{processingProgress}%</span>
          </div>
          <Progress value={processingProgress} className="h-2 bg-[#222222]" />
        </div>
      )}
      
      {error && (
        <Alert variant="destructive" className="bg-red-900/20 border border-red-800 text-red-100">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      
      {matchAnalysis && (
        <div className="mt-6 p-6 bg-[#111111] border border-[#333333] rounded-lg">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-bold text-[#F9F6EE] font-safiro">Job Match Analysis</h3>
            <div className="flex items-center space-x-2">
              <span className="text-[#F9F6EE]/70 text-sm">Match Score:</span>
              <span className={`text-lg font-bold ${
                matchAnalysis.score > 70 ? 'text-green-400' : 
                matchAnalysis.score > 50 ? 'text-yellow-400' : 'text-red-400'
              }`}>
                {matchAnalysis.score}%
              </span>
            </div>
          </div>
          
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <h4 className="text-[#F9F6EE] font-medium mb-2">Key Strengths</h4>
              <ul className="space-y-1">
                {matchAnalysis.matchedKeywords.slice(0, 5).map((keyword, index) => (
                  <li key={index} className="text-sm text-[#F9F6EE]/70">
                    <span className="text-green-400">✓</span> {keyword.keyword}
                  </li>
                ))}
              </ul>
            </div>
            
            <div>
              <h4 className="text-[#F9F6EE] font-medium mb-2">Missing Keywords</h4>
              <ul className="space-y-1">
                {matchAnalysis.missingKeywords.slice(0, 5).map((keyword, index) => (
                  <li key={index} className="text-sm text-[#F9F6EE]/70">
                    <span className="text-yellow-400">→</span> {keyword.keyword}
                  </li>
                ))}
              </ul>
            </div>
          </div>
          
          <div className="mt-4">
            <h4 className="text-[#F9F6EE] font-medium mb-2">Recommendations</h4>
            <ul className="space-y-1">
              {matchAnalysis.recommendations.slice(0, 3).map((rec, index) => (
                <li key={index} className="text-sm text-[#F9F6EE]/70">
                  <span className="text-blue-400">•</span> {rec}
                </li>
              ))}
            </ul>
          </div>
          
          <div className="mt-4">
            <Button
              onClick={() => setShowDetailedAnalysis(!showDetailedAnalysis)}
              variant="outline"
              className="text-[#F9F6EE]/70 border-[#333333] hover:bg-[#222222] hover:text-[#F9F6EE] transition-colors duration-200 text-sm"
            >
              {showDetailedAnalysis ? 'Hide Detailed Analysis' : 'Show Detailed Analysis'}
            </Button>
          </div>
          
          {showDetailedAnalysis && (
            <div className="mt-4">
              <JobMatchDetailedAnalysis jobMatchAnalysis={matchAnalysis} />
            </div>
          )}
        </div>
      )}
      
      {completedOptimization && optimizedText && (
        <div className="mt-8 space-y-6">
          <div className="p-6 bg-[#111111] border border-[#333333] rounded-lg">
            <h3 className="text-xl font-bold text-[#F9F6EE] mb-4 font-safiro">Optimized CV</h3>
            
            {tailoringResult?.industryInsights && (
              <div className="mb-6 p-4 bg-[#1A1A1A] rounded-lg">
                <h4 className="text-[#F9F6EE] font-medium mb-2">{tailoringResult.industryInsights.industry} Industry Insights</h4>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <h5 className="text-sm text-[#F9F6EE]/70 mb-1">Key Skills</h5>
                    <p className="text-sm text-[#F9F6EE]">{tailoringResult.industryInsights.keySkills?.join(', ') || 'Not specified'}</p>
                  </div>
                  <div>
                    <h5 className="text-sm text-[#F9F6EE]/70 mb-1">Suggested Metrics</h5>
                    <p className="text-sm text-[#F9F6EE]">{tailoringResult.industryInsights.suggestedMetrics?.join(', ') || 'Not specified'}</p>
                  </div>
                </div>
                <div className="mt-3">
                  <h5 className="text-sm text-[#F9F6EE]/70 mb-1">Format Guidance</h5>
                  <p className="text-sm text-[#F9F6EE]">{tailoringResult.industryInsights.formatGuidance || 'Not specified'}</p>
                </div>
              </div>
            )}
            
            <div className="bg-[#050505] border border-[#333333] rounded-lg p-4">
              <pre className="text-[#F9F6EE]/90 whitespace-pre-wrap font-borna text-sm">
                {optimizedText}
              </pre>
            </div>
            
            <div className="mt-6 flex flex-wrap gap-3">
              <Button
                onClick={generateDocument}
                disabled={isGeneratingDocument}
                className="bg-[#B4916C] hover:bg-[#A38060] text-black font-medium py-2 px-4 rounded-lg transition-colors duration-200 flex items-center gap-2 text-sm font-borna"
              >
                {isGeneratingDocument ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <FileText className="h-4 w-4" />
                    Generate Document
                  </>
                )}
              </Button>
              
              {documentDownloadUrl && (
                <Button
                  onClick={downloadGeneratedDocument}
                  disabled={documentDownloadRequested}
                  className="bg-green-700 hover:bg-green-600 text-white font-medium py-2 px-4 rounded-lg transition-colors duration-200 flex items-center gap-2 text-sm font-borna"
                >
                  {documentDownloadRequested ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      Downloading...
                    </>
                  ) : (
                    <>
                      <Download className="h-4 w-4" />
                      Download Document
                    </>
                  )}
                </Button>
              )}
            </div>
            
            {isGeneratingDocument && (
              <DocumentGenerationProgress
                progress={documentGenerationProgress}
                status={documentGenerationStatus}
                error={documentDownloadError}
                isGenerating={isGeneratingDocument}
              />
            )}
            
            {documentDownloadUrl && !isGeneratingDocument && (
              <DocumentDownloadStatus
                isDownloading={documentDownloadRequested}
                isDownloadComplete={!!documentDownloadUrl && !documentDownloadRequested}
                error={documentDownloadError}
                onManualDownload={downloadGeneratedDocument}
              />
            )}
          </div>
          
          {tailoringResult?.enhancedProfile && (
            <div className="p-6 bg-[#111111] border border-[#333333] rounded-lg">
              <h3 className="text-xl font-bold text-[#F9F6EE] mb-4 font-safiro">Enhanced Professional Profile</h3>
              <div className="bg-[#050505] border border-[#333333] rounded-lg p-4">
                <p className="text-[#F9F6EE]/90 font-borna text-sm">{tailoringResult.enhancedProfile}</p>
              </div>
            </div>
          )}
          
          {tailoringResult?.sectionImprovements && Object.keys(tailoringResult.sectionImprovements).length > 0 && (
            <div className="p-6 bg-[#111111] border border-[#333333] rounded-lg">
              <h3 className="text-xl font-bold text-[#F9F6EE] mb-4 font-safiro">Section Improvements</h3>
              <div className="space-y-4">
                {Object.entries(tailoringResult.sectionImprovements).map(([section, improvement]) => (
                  <div key={section} className="bg-[#050505] border border-[#333333] rounded-lg p-4">
                    <h4 className="text-[#F9F6EE] font-medium mb-2 capitalize">{section}</h4>
                    <p className="text-[#F9F6EE]/90 font-borna text-sm">{improvement}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default EnhancedSpecificOptimizationWorkflow;

// Helper function for download
const downloadBlob = async (blob: Blob, fileName: string): Promise<boolean> => {
  try {
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    
    // Clean up
    setTimeout(() => {
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    }, 100);
    
    return true;
  } catch (error) {
    console.error('Download error:', error);
    return false;
  }
};