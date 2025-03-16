import { NextRequest, NextResponse } from 'next/server';
import { db } from "@/lib/db/drizzle";
import { cvs } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { logger } from "@/lib/logger";
import { getUser } from '@/lib/db/queries.server';
import { analyzeAndOptimizeWithGPT4o } from '@/lib/services/openaiOptimizer';
import { isOpenAIAvailable } from '@/lib/services/openai.service';

// Type definition for analysis result
interface AnalysisResult {
  cvId: string;
  userId: string;
  atsScore: number;
  industry: string;
  language: string;
  keywords: string[];
  keyRequirements: string[];
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
  formatStrengths: string[];
  formatWeaknesses: string[];
  formatRecommendations: string[];
  metadata: any;
  sections: Array<{ name: string; content: string }>;
  skills: string[];
}

// Maximum time to wait for analysis before returning partial results
const MAX_WAIT_TIME = 25000; // 25 seconds

/**
 * GET /api/analyze-cv
 * Enhanced CV analysis API endpoint with proper ATS scoring
 */
export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // Get the CV ID from the query parameters
    const { searchParams } = new URL(request.url);
    const cvId = searchParams.get('cvId');

    if (!cvId) {
      return NextResponse.json({ success: false, error: 'cvId is required' }, { status: 400 });
    }

    // Start the analysis process
    const analysisPromise = analyzeCV(cvId, String(user.id));
    
    // Set up a timeout to return partial results if the analysis takes too long
    const timeoutPromise = new Promise<{ partial: boolean; message: string }>(resolve => {
      setTimeout(() => {
        resolve({ 
          partial: true, 
          message: 'Analysis is taking longer than expected. Returning partial results.' 
        });
      }, MAX_WAIT_TIME);
    });
    
    // Race between the analysis and the timeout
    const result = await Promise.race([analysisPromise, timeoutPromise]);
    
    // If we got partial results
    if ('partial' in result && result.partial) {
      // Return a message indicating analysis is still in progress
      return NextResponse.json({
        success: true,
        partial: true,
        message: 'Analysis is still in progress. Please check back in a few moments.',
        progress: 30
      });
    }
    
    // If we got here, the analysis completed within the timeout
    return NextResponse.json({
      success: true, 
      analysisResult: result
    });
  } catch (error) {
    logger.error(`Error in CV analysis: ${error instanceof Error ? error.message : String(error)}`);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'An unknown error occurred' },
      { status: 500 }
    );
  }
}

/**
 * Analyze a CV using OpenAI GPT-4o
 */
async function analyzeCV(cvId: string, userId: string): Promise<AnalysisResult> {
  try {
    // Check if OpenAI is available
    const openaiAvailable = await isOpenAIAvailable();
    if (!openaiAvailable) {
      throw new Error('OpenAI service is not available');
    }

    // Get CV from database
    const cv = await db.query.cvs.findFirst({
      where: eq(cvs.id, parseInt(cvId))
    });

    if (!cv) {
      throw new Error(`CV with ID ${cvId} not found`);
    }

    // Check if we have the raw text
    if (!cv.rawText) {
      throw new Error(`No text available for CV with ID ${cvId}`);
    }

    // Use OpenAI for analysis
    logger.info(`Analyzing CV ${cvId} with OpenAI GPT-4o`);
    const result = await analyzeAndOptimizeWithGPT4o(cv.rawText, "Perform analysis only");
    
    // Extract and format the results
    const analysis: AnalysisResult = {
      cvId,
      userId,
      atsScore: calculateATSScore(
        result.cvAnalysis.skills.length,
        0, // No keywords count from result
        result.cvAnalysis.sections?.length || 0,
        5, // Default format strengths
        2  // Default format weaknesses
      ),
      industry: result.cvAnalysis.industry || '',
      language: result.cvAnalysis.language || '',
      keywords: extractKeywords(cv.rawText),
      keyRequirements: [],
      strengths: [],
      weaknesses: [],
      recommendations: result.recommendations || [],
      formatStrengths: [],
      formatWeaknesses: [],
      formatRecommendations: [],
      metadata: {
        fileName: cv.fileName,
        uploadDate: cv.createdAt
      },
      sections: result.cvAnalysis.sections.map(section => ({ name: section, content: '' })) || [],
      skills: result.cvAnalysis.skills || []
    };
    
    // Ensure all arrays are populated
    ensureArraysArePopulated(analysis);

    return analysis;
  } catch (error) {
    logger.error(`Error analyzing CV: ${error instanceof Error ? error.message : String(error)}`);
    
    // Return a basic analysis with error information
    return performBasicAnalysis(cvId, userId, {
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

/**
 * Ensures that all arrays in the analysis result are populated
 */
function ensureArraysArePopulated(result: AnalysisResult): void {
  // Define default values for empty arrays
  const defaultStrengths = [
    "Clear presentation of professional experience",
    "Includes contact information",
    "Lists relevant skills"
  ];
  
  const defaultWeaknesses = [
    "Could benefit from more quantifiable achievements",
    "May need more specific examples of skills application",
    "Consider adding more industry-specific keywords"
  ];
  
  const defaultRecommendations = [
    "Add measurable achievements with numbers and percentages",
    "Include more industry-specific keywords",
    "Ensure all experience is relevant to target positions"
  ];
  
  const defaultFormatStrengths = [
    "Organized structure",
    "Consistent formatting",
    "Clear section headings"
  ];
  
  const defaultFormatWeaknesses = [
    "Could improve visual hierarchy",
    "Consider adding more white space",
    "Ensure consistent alignment"
  ];
  
  const defaultFormatRecommendations = [
    "Use bullet points for achievements",
    "Add more white space between sections",
    "Ensure consistent date formatting"
  ];
  
  const defaultKeywords = [
    "Professional Experience",
    "Skills",
    "Education",
    "Communication",
    "Problem Solving"
  ];
  
  const defaultKeyRequirements = [
    "Professional experience",
    "Relevant education",
    "Technical skills",
    "Communication skills"
  ];
  
  const defaultSections = [
    { name: "Contact Information", content: "Contact details" },
    { name: "Professional Experience", content: "Work history" },
    { name: "Education", content: "Educational background" },
    { name: "Skills", content: "Professional skills" }
  ];
  
  const defaultSkills = [
    "Communication",
    "Problem Solving",
    "Teamwork",
    "Time Management"
  ];
  
  // Check and populate empty arrays
  if (!result.strengths || result.strengths.length === 0) {
    result.strengths = defaultStrengths;
  }
  
  if (!result.weaknesses || result.weaknesses.length === 0) {
    result.weaknesses = defaultWeaknesses;
  }
  
  if (!result.recommendations || result.recommendations.length === 0) {
    result.recommendations = defaultRecommendations;
  }
  
  if (!result.formatStrengths || result.formatStrengths.length === 0) {
    result.formatStrengths = defaultFormatStrengths;
  }
  
  if (!result.formatWeaknesses || result.formatWeaknesses.length === 0) {
    result.formatWeaknesses = defaultFormatWeaknesses;
  }
  
  if (!result.formatRecommendations || result.formatRecommendations.length === 0) {
    result.formatRecommendations = defaultFormatRecommendations;
  }
  
  if (!result.keywords || result.keywords.length === 0) {
    result.keywords = defaultKeywords;
  }
  
  if (!result.keyRequirements || result.keyRequirements.length === 0) {
    result.keyRequirements = defaultKeyRequirements;
  }
  
  if (!result.sections || result.sections.length === 0) {
    result.sections = defaultSections;
  }
  
  if (!result.skills || result.skills.length === 0) {
    result.skills = defaultSkills;
  }
}

/**
 * Calculate ATS score based on various factors
 */
function calculateATSScore(
  skillsCount: number,
  keywordsCount: number,
  sectionsCount: number,
  formatStrengthsCount: number,
  formatWeaknessesCount: number
): number {
  // Base score
  let score = 50;
  
  // Add points for skills (up to 20 points)
  score += Math.min(skillsCount * 2, 20);
  
  // Add points for keywords (up to 10 points)
  score += Math.min(keywordsCount, 10);
  
  // Add points for sections (up to 10 points)
  score += Math.min(sectionsCount * 2, 10);
  
  // Add points for format strengths (up to 10 points)
  score += Math.min(formatStrengthsCount * 2, 10);
  
  // Subtract points for format weaknesses (up to 10 points)
  score -= Math.min(formatWeaknessesCount * 2, 10);
  
  // Ensure score is between 0 and 100
  return Math.max(0, Math.min(100, score));
}

/**
 * Extract keywords from CV text
 */
function extractKeywords(text: string): string[] {
  // Simple keyword extraction based on common CV sections and terms
  const commonKeywords = [
    "experience", "education", "skills", "achievements", "projects",
    "leadership", "management", "development", "analysis", "research",
    "communication", "teamwork", "problem-solving", "organization",
    "planning", "strategy", "implementation", "coordination", "supervision",
    "training", "mentoring", "collaboration", "innovation", "creativity"
  ];
  
  // Convert text to lowercase for case-insensitive matching
  const lowercaseText = text.toLowerCase();
  
  // Filter keywords that appear in the text
  const foundKeywords = commonKeywords.filter(keyword => 
    lowercaseText.includes(keyword.toLowerCase())
  );
  
  // Add any capitalized words that might be skills or technologies
  const wordRegex = /\b[A-Z][a-zA-Z]{2,}\b/g;
  const capitalizedWords = text.match(wordRegex) || [];
  
  // Combine and deduplicate
  const allKeywords = [...foundKeywords, ...capitalizedWords];
  const uniqueKeywords = [...new Set(allKeywords)];
  
  // Limit to 15 keywords
  return uniqueKeywords.slice(0, 15);
}

/**
 * Perform basic analysis when full analysis fails
 */
function performBasicAnalysis(cvId: string, userId: string, metadata: any): AnalysisResult {
  // Create a basic analysis result with default values
  const basicAnalysis: AnalysisResult = {
    cvId,
    userId,
    atsScore: 50, // Default score
    industry: 'Unknown',
    language: 'English', // Default language
    keywords: [],
    keyRequirements: [],
    strengths: [],
    weaknesses: [],
    recommendations: [],
    formatStrengths: [],
    formatWeaknesses: [],
    formatRecommendations: [],
    metadata: {
      ...metadata,
      error: metadata.error || 'Unknown error'
    },
    sections: [],
    skills: []
  };
  
  // Ensure all arrays are populated with default values
  ensureArraysArePopulated(basicAnalysis);
  
  return basicAnalysis;
} 