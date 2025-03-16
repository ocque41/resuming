// app/api/analyze-cv/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { db } from "@/lib/db/drizzle";
import { cvs } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { MistralRAGService } from "@/lib/utils/mistralRagService";
import { logger } from "@/lib/logger";
import { getUser } from '@/lib/db/queries.server';
import { cachePartialResults, getCachedPartialResults } from '@/lib/services/cache.service';

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
    const fileName = searchParams.get('fileName');
    const cvId = searchParams.get('cvId');

    if (!fileName && !cvId) {
      return NextResponse.json({ success: false, error: 'fileName or cvId is required' }, { status: 400 });
    }

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
    
    // If we got partial results, check if we have any cached results
    if ('partial' in result && result.partial) {
      const partialResults = getCachedPartialResults(String(user.id), cvId, '');
      
      if (partialResults) {
        return NextResponse.json({
          success: true,
          partial: true,
          message: 'Returning partial results while analysis continues',
          analysisResult: partialResults,
          progress: partialResults.progress || 50
        });
      } else {
        // No partial results yet, but analysis is still running
        return NextResponse.json({
          success: true,
          partial: true,
          message: 'Analysis is still in progress. Please check back in a few moments.',
          progress: 30
        });
      }
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
 * Analyzes a CV using the RAG service
 */
async function analyzeCV(cvId: string, userId: string): Promise<AnalysisResult> {
  logger.info(`Starting CV analysis for CV ID: ${cvId}`);
  
  try {
    // Fetch CV record with safety checks
    let cv;
    try {
      cv = await db.query.cvs.findFirst({
        where: eq(cvs.id, parseInt(cvId))
      });
    } catch (dbError) {
      logger.error(`Database error fetching CV ${cvId}:`, dbError instanceof Error ? dbError.message : String(dbError));
      throw new Error("Database error while fetching CV");
    }

    if (!cv) {
      logger.error(`CV not found: ${cvId}`);
      throw new Error("CV not found");
    }

    // Get CV content
    const rawText = cv.rawText || '';

    if (!rawText || rawText.trim() === "") {
      logger.error(`CV content is empty for ID: ${cvId}`);
      throw new Error("Only PDF files are supported. Other file types are for applying to jobs.");
    }

    // Create initial analysis result object
    const analysisResult: AnalysisResult = {
      cvId,
      userId,
      atsScore: 0,
      industry: '',
      language: '',
      keywords: [],
      keyRequirements: [],
      strengths: [],
      weaknesses: [],
      recommendations: [],
      formatStrengths: [],
      formatWeaknesses: [],
      formatRecommendations: [],
      metadata: cv.metadata || {},
      sections: [],
      skills: []
    };
    
    // Initialize RAG service with error handling
    let ragService: MistralRAGService;
    try {
      ragService = new MistralRAGService();
      logger.info(`Successfully initialized RAG service for CV ID: ${cvId}`);
    } catch (initError) {
      logger.error(`Failed to initialize RAG service for CV ID: ${cvId}: ${initError instanceof Error ? initError.message : String(initError)}`);
      return performBasicAnalysis(cvId, userId, rawText, analysisResult.metadata);
    }
    
    // Process the CV document with timeout protection
    try {
      logger.info(`Processing CV document for CV ID: ${cvId}`);
      const processingPromise = ragService.processCVDocument(rawText);
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('CV document processing timed out')), 20000); // 20 seconds timeout
      });
      
      await Promise.race([processingPromise, timeoutPromise]);
      logger.info(`Successfully processed CV document for CV ID: ${cvId}`);
    } catch (processingError) {
      logger.error(`Error processing CV document for CV ID: ${cvId}: ${processingError instanceof Error ? processingError.message : String(processingError)}`);
      // Continue with analysis but note that it might be incomplete
      logger.warn(`Continuing with potentially incomplete analysis for CV ID: ${cvId}`);
    }
    
    // Extract skills
    logger.info(`Extracting skills for CV ID: ${cvId}`);
    try {
      const skills = await ragService.extractSkills();
      analysisResult.skills = skills;
      logger.info(`Extracted ${skills.length} skills for CV ID: ${cvId}`);
      
      // Store partial results after each major step
      cachePartialResults(String(userId), cvId, '', {
        ...analysisResult,
        progress: 20
      });
    } catch (error) {
      logger.error(`Error extracting skills for CV ID: ${cvId}: ${error instanceof Error ? error.message : String(error)}`);
      analysisResult.skills = [];
    }
    
    // Extract keywords
    logger.info(`Extracting keywords for CV ID: ${cvId}`);
    try {
      const keywords = await ragService.extractKeywords();
      analysisResult.keywords = keywords;
      logger.info(`Extracted ${keywords.length} keywords for CV ID: ${cvId}`);
      
      // Update partial results
      cachePartialResults(String(userId), cvId, '', {
        ...analysisResult,
        progress: 35
      });
    } catch (error) {
      logger.error(`Error extracting keywords for CV ID: ${cvId}: ${error instanceof Error ? error.message : String(error)}`);
      analysisResult.keywords = [];
    }
    
    // Extract key requirements
    logger.info(`Extracting key requirements for CV ID: ${cvId}`);
    try {
      const keyRequirements = await ragService.extractKeyRequirements();
      analysisResult.keyRequirements = keyRequirements;
      logger.info(`Extracted ${keyRequirements.length} key requirements for CV ID: ${cvId}`);
      
      // Update partial results
      cachePartialResults(String(userId), cvId, '', {
        ...analysisResult,
        progress: 50
      });
    } catch (error) {
      logger.error(`Error extracting key requirements for CV ID: ${cvId}: ${error instanceof Error ? error.message : String(error)}`);
      analysisResult.keyRequirements = [];
    }
    
    // Analyze CV format
    logger.info(`Analyzing CV format for CV ID: ${cvId}`);
    try {
      const formatAnalysis = await ragService.analyzeCVFormat();
      analysisResult.formatStrengths = formatAnalysis.strengths;
      analysisResult.formatWeaknesses = formatAnalysis.weaknesses;
      analysisResult.formatRecommendations = formatAnalysis.recommendations;
      logger.info(`Format analysis complete for CV ID: ${cvId}: ${formatAnalysis.strengths.length} strengths, ${formatAnalysis.weaknesses.length} weaknesses, ${formatAnalysis.recommendations.length} recommendations`);
      
      // Update partial results
      cachePartialResults(String(userId), cvId, '', {
        ...analysisResult,
        progress: 65
      });
    } catch (error) {
      logger.error(`Error analyzing CV format for CV ID: ${cvId}: ${error instanceof Error ? error.message : String(error)}`);
      analysisResult.formatStrengths = [];
      analysisResult.formatWeaknesses = [];
      analysisResult.formatRecommendations = [];
    }
    
    // Analyze CV content
    logger.info(`Analyzing CV content for CV ID: ${cvId}`);
    try {
      const contentAnalysis = await ragService.analyzeContent();
      analysisResult.strengths = contentAnalysis.strengths;
      analysisResult.weaknesses = contentAnalysis.weaknesses;
      analysisResult.recommendations = contentAnalysis.recommendations;
      logger.info(`Content analysis complete for CV ID: ${cvId}: ${contentAnalysis.strengths.length} strengths, ${contentAnalysis.weaknesses.length} weaknesses, ${contentAnalysis.recommendations.length} recommendations`);
      
      // Update partial results
      cachePartialResults(String(userId), cvId, '', {
        ...analysisResult,
        progress: 80
      });
    } catch (error) {
      logger.error(`Error analyzing CV content for CV ID: ${cvId}: ${error instanceof Error ? error.message : String(error)}`);
      analysisResult.strengths = [];
      analysisResult.weaknesses = [];
      analysisResult.recommendations = [];
    }
    
    // Determine industry based on keyword matches
    logger.info(`Determining industry for CV ID: ${cvId}`);
    try {
      const industry = await ragService.determineIndustry();
      analysisResult.industry = industry;
      logger.info(`Determined industry for CV ID: ${cvId}: ${industry}`);
    } catch (error) {
      logger.error(`Error determining industry for CV ID: ${cvId}: ${error instanceof Error ? error.message : String(error)}`);
      analysisResult.industry = 'General';
    }
    
    // Detect language
    logger.info(`Detecting language for CV ID: ${cvId}`);
    try {
      const language = await ragService.detectLanguage();
      analysisResult.language = language;
      logger.info(`Detected language for CV ID: ${cvId}: ${language}`);
      
      // Update partial results
      cachePartialResults(String(userId), cvId, '', {
        ...analysisResult,
        progress: 90
      });
    } catch (error) {
      logger.error(`Error detecting language for CV ID: ${cvId}: ${error instanceof Error ? error.message : String(error)}`);
      analysisResult.language = 'English';
    }
    
    // Extract sections
    logger.info(`Extracting sections for CV ID: ${cvId}`);
    try {
      const sections = await ragService.extractSections();
      analysisResult.sections = sections;
      logger.info(`Extracted ${sections.length} sections for CV ID: ${cvId}`);
    } catch (error) {
      logger.error(`Error extracting sections for CV ID: ${cvId}: ${error instanceof Error ? error.message : String(error)}`);
      analysisResult.sections = [];
    }
    
    // Calculate ATS score
    logger.info(`Calculating ATS score for CV ID: ${cvId}`);
    try {
      const atsScore = calculateATSScore(
        analysisResult.skills.length,
        analysisResult.keywords.length,
        analysisResult.sections.length,
        analysisResult.formatStrengths.length,
        analysisResult.formatWeaknesses.length
      );
      analysisResult.atsScore = atsScore;
      logger.info(`Calculated ATS score for CV ID: ${cvId}: ${atsScore}`);
    } catch (error) {
      logger.error(`Error calculating ATS score for CV ID: ${cvId}: ${error instanceof Error ? error.message : String(error)}`);
      analysisResult.atsScore = 50; // Default score
    }
    
    // Check if we have enough data for a valid analysis
    const hasValidAnalysis = 
      analysisResult.skills.length > 0 &&
      analysisResult.keywords.length > 0 &&
      analysisResult.strengths.length > 0 &&
      analysisResult.weaknesses.length > 0 &&
      analysisResult.recommendations.length > 0 &&
      analysisResult.formatStrengths.length > 0 &&
      analysisResult.formatWeaknesses.length > 0 &&
      analysisResult.formatRecommendations.length > 0;
    
    if (!hasValidAnalysis) {
      logger.warn(`Incomplete analysis results for CV ID: ${cvId}, falling back to ensure all arrays are populated`);
    }
    
    // Ensure all arrays are populated
    ensureArraysArePopulated(analysisResult);
    
    // Add metadata
    analysisResult.metadata = {
      ...analysisResult.metadata,
      analysisTimestamp: new Date().toISOString(),
      analysisMethod: 'rag',
      analysisComplete: true
    };
    
    // Final update to partial results with 100% progress
    cachePartialResults(String(userId), cvId, '', {
      ...analysisResult,
      progress: 100
    });
    
    // Update CV metadata in database
    try {
      const updatedMetadata = {
        ...analysisResult.metadata,
        lastAnalyzed: new Date().toISOString(),
        atsScore: analysisResult.atsScore,
        industry: analysisResult.industry,
        language: analysisResult.language
      };
      
      await db.update(cvs)
        .set({ metadata: JSON.stringify(updatedMetadata) })
        .where(eq(cvs.id, parseInt(cvId)));
      
      logger.info(`Successfully updated metadata for CV ${cvId}`);
    } catch (updateError) {
      logger.error(`Error updating metadata for CV ${cvId}:`, 
        updateError instanceof Error ? updateError.message : String(updateError));
      throw new Error("Failed to update CV metadata");
    }
    
    logger.info(`CV analysis complete for CV ID: ${cvId}`);
    return analysisResult;
  } catch (error) {
    logger.error(`Error in CV analysis for CV ID: ${cvId}: ${error instanceof Error ? error.message : String(error)}`);
    // Fall back to basic analysis
    logger.info(`Falling back to basic analysis for CV ID: ${cvId}`);
    
    // Fetch CV record again if needed
    let rawText = '';
    let metadata = {};
    
    try {
      const cv = await db.query.cvs.findFirst({
        where: eq(cvs.id, parseInt(cvId))
      });
      
      if (cv) {
        rawText = cv.rawText || '';
        metadata = cv.metadata || {};
      }
    } catch (dbError) {
      logger.error(`Database error fetching CV ${cvId} for fallback:`, 
        dbError instanceof Error ? dbError.message : String(dbError));
    }
    
    return performBasicAnalysis(cvId, userId, rawText, metadata);
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
    logger.warn(`Using default strengths for CV ID: ${result.cvId}`);
  }
  
  if (!result.weaknesses || result.weaknesses.length === 0) {
    result.weaknesses = defaultWeaknesses;
    logger.warn(`Using default weaknesses for CV ID: ${result.cvId}`);
  }
  
  if (!result.recommendations || result.recommendations.length === 0) {
    result.recommendations = defaultRecommendations;
    logger.warn(`Using default recommendations for CV ID: ${result.cvId}`);
  }
  
  if (!result.formatStrengths || result.formatStrengths.length === 0) {
    result.formatStrengths = defaultFormatStrengths;
    logger.warn(`Using default format strengths for CV ID: ${result.cvId}`);
  }
  
  if (!result.formatWeaknesses || result.formatWeaknesses.length === 0) {
    result.formatWeaknesses = defaultFormatWeaknesses;
    logger.warn(`Using default format weaknesses for CV ID: ${result.cvId}`);
  }
  
  if (!result.formatRecommendations || result.formatRecommendations.length === 0) {
    result.formatRecommendations = defaultFormatRecommendations;
    logger.warn(`Using default format recommendations for CV ID: ${result.cvId}`);
  }
  
  if (!result.keywords || result.keywords.length === 0) {
    result.keywords = defaultKeywords;
    logger.warn(`Using default keywords for CV ID: ${result.cvId}`);
  }
  
  if (!result.keyRequirements || result.keyRequirements.length === 0) {
    result.keyRequirements = defaultKeyRequirements;
    logger.warn(`Using default key requirements for CV ID: ${result.cvId}`);
  }
  
  if (!result.sections || result.sections.length === 0) {
    result.sections = defaultSections;
    logger.warn(`Using default sections for CV ID: ${result.cvId}`);
  }
  
  if (!result.skills || result.skills.length === 0) {
    result.skills = defaultSkills;
    logger.warn(`Using default skills for CV ID: ${result.cvId}`);
  }
  
  // Ensure industry and language are set
  if (!result.industry || result.industry.trim() === '') {
    result.industry = 'General';
    logger.warn(`Using default industry for CV ID: ${result.cvId}`);
  }
  
  if (!result.language || result.language.trim() === '') {
    result.language = 'English';
    logger.warn(`Using default language for CV ID: ${result.cvId}`);
  }
}

/**
 * Calculates an ATS score based on various factors
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
  
  // Add points for skills (up to 10 points)
  score += Math.min(skillsCount, 10);
  
  // Add points for keywords (up to 10 points)
  score += Math.min(keywordsCount / 2, 10);
  
  // Add points for sections (up to 10 points)
  score += Math.min(sectionsCount * 2, 10);
  
  // Add points for format strengths (up to 10 points)
  score += Math.min(formatStrengthsCount * 2, 10);
  
  // Subtract points for format weaknesses (up to 10 points)
  score -= Math.min(formatWeaknessesCount, 10);
  
  // Ensure score is between 30 and 95
  score = Math.max(30, Math.min(score, 95));
  
  // Round to nearest integer
  return Math.round(score);
}

/**
 * Performs a basic analysis of CV text when the advanced RAG analysis fails
 */
function performBasicAnalysis(cvId: string, userId: string, rawText: string, metadata: any): AnalysisResult {
  // Log that we're falling back to basic analysis
  logger.info(`Performing basic analysis for CV ID: ${cvId}`);
  
  // Create initial analysis result with default values
  const analysisResult: AnalysisResult = {
    cvId,
    userId,
    atsScore: 65, // Default ATS score
    industry: "General",
    language: "English", // Default to English
    keywords: [],
    keyRequirements: [],
    strengths: [],
    weaknesses: [],
    recommendations: [],
    formatStrengths: [],
    formatWeaknesses: [],
    formatRecommendations: [],
    metadata: {},
    sections: [],
    skills: []
  };
  
  try {
    // Detect language using simple regex patterns
    if (/\b(the|and|is|in|to|for|with|that|this|from|by|on|are|have|has|was|were|will|would|could|should|can)\b/gi.test(rawText)) {
      analysisResult.language = "English";
    } else if (/\b(el|la|los|las|un|una|unos|unas|y|en|de|con|por|para|que|este|esta|estos|estas|ese|esa|esos|esas)\b/gi.test(rawText)) {
      analysisResult.language = "Spanish";
    } else if (/\b(le|la|les|des|un|une|et|en|de|avec|pour|que|qui|ce|cette|ces|il|elle|ils|elles|nous|vous)\b/gi.test(rawText)) {
      analysisResult.language = "French";
    } else if (/\b(der|die|das|den|dem|ein|eine|einer|eines|und|in|mit|für|von|zu|auf|bei|aus|nach|vor)\b/gi.test(rawText)) {
      analysisResult.language = "German";
    }
    
    // Extract sections based on common section headers
    const sectionHeaders = [
      'summary', 'profile', 'objective', 'experience', 'work experience', 'employment history',
      'education', 'skills', 'technical skills', 'certifications', 'achievements',
      'projects', 'publications', 'languages', 'interests', 'references'
    ];
    
    const sections: Array<{ name: string; content: string }> = [];
    const normalizedText = rawText.toLowerCase();
    
    sectionHeaders.forEach(header => {
      const regex = new RegExp(`(?:^|\\n)\\s*${header}\\s*(?:\\:|\\n)`, 'i');
      const match = normalizedText.match(regex);
      
      if (match && match.index !== undefined) {
        const startIndex = match.index;
        
        // Find the next section header
        let endIndex = normalizedText.length;
        for (const nextHeader of sectionHeaders) {
          if (nextHeader === header) continue;
          
          const nextRegex = new RegExp(`(?:^|\\n)\\s*${nextHeader}\\s*(?:\\:|\\n)`, 'i');
          const nextMatch = normalizedText.substring(startIndex + match[0].length).match(nextRegex);
          
          if (nextMatch && nextMatch.index !== undefined) {
            const nextStartIndex = startIndex + match[0].length + nextMatch.index;
            if (nextStartIndex < endIndex) {
              endIndex = nextStartIndex;
            }
          }
        }
        
        // Extract the section content
        const content = rawText.substring(startIndex, endIndex).trim();
        if (content) {
          sections.push({
            name: header.charAt(0).toUpperCase() + header.slice(1),
            content
          });
        }
      }
    });
    
    analysisResult.sections = sections;
    
    // Extract skills from a predefined list of common skills
    const commonSkills = [
      'communication', 'teamwork', 'leadership', 'problem solving', 'critical thinking',
      'time management', 'organization', 'adaptability', 'creativity', 'attention to detail',
      'project management', 'customer service', 'research', 'analytical skills', 'negotiation',
      'javascript', 'python', 'java', 'c++', 'c#', 'react', 'angular', 'vue', 'node.js',
      'html', 'css', 'sql', 'nosql', 'aws', 'azure', 'gcp', 'docker', 'kubernetes',
      'excel', 'word', 'powerpoint', 'photoshop', 'illustrator', 'marketing', 'sales',
      'accounting', 'finance', 'hr', 'operations', 'strategy', 'consulting', 'data analysis'
    ];
    
    const skills: string[] = [];
    commonSkills.forEach(skill => {
      const regex = new RegExp(`\\b${skill}\\b`, 'i');
      if (regex.test(rawText)) {
        skills.push(skill.charAt(0).toUpperCase() + skill.slice(1));
      }
    });
    
    // Ensure we have at least some skills
    if (skills.length === 0) {
      skills.push('Communication', 'Problem Solving', 'Teamwork', 'Time Management');
    }
    
    analysisResult.skills = skills;
    
    // Determine industry based on keyword matches
    const industryKeywords: Record<string, string[]> = {
      'Technology': [
        'software', 'development', 'programming', 'javascript', 'python', 'java', 'react', 'angular', 'node',
        'aws', 'azure', 'cloud', 'devops', 'agile', 'scrum', 'git', 'api', 'microservices', 'docker',
        'kubernetes', 'machine learning', 'ai', 'data science', 'full stack', 'frontend', 'backend'
      ],
      'Finance': [
        'financial analysis', 'accounting', 'budgeting', 'forecasting', 'investment', 'portfolio', 'risk management',
        'financial reporting', 'audit', 'compliance', 'banking', 'securities', 'trading', 'equity', 'financial modeling'
      ],
      'Healthcare': [
        'patient care', 'clinical', 'medical', 'healthcare', 'hospital', 'physician', 'nursing', 'treatment',
        'diagnosis', 'therapy', 'pharmaceutical', 'health records', 'hipaa', 'electronic medical records',
        'patient management', 'medical coding', 'medical billing', 'healthcare compliance'
      ],
      'Marketing': [
        'marketing strategy', 'digital marketing', 'social media', 'content marketing', 'seo', 'sem', 'ppc',
        'google analytics', 'facebook ads', 'instagram', 'brand management', 'market research',
        'customer acquisition', 'customer retention', 'email marketing', 'marketing automation'
      ],
      'Sales': [
        'sales strategy', 'business development', 'account management', 'client relationship', 'negotiation',
        'closing deals', 'sales pipeline', 'lead generation', 'prospecting', 'sales targets', 'revenue growth'
      ]
    };
    
    let topIndustry = 'General';
    let topCount = 0;
    
    Object.entries(industryKeywords).forEach(([industry, keywords]) => {
      let count = 0;
      keywords.forEach(keyword => {
        const regex = new RegExp(`\\b${keyword}\\b`, 'i');
        if (regex.test(rawText)) {
          count++;
        }
      });
      
      if (count > topCount) {
        topCount = count;
        topIndustry = industry;
      }
    });
    
    analysisResult.industry = topIndustry;
    
    // Extract keywords
    const extractedKeywords: string[] = [];
    const potentialKeywords = [
      ...industryKeywords[topIndustry] || [],
      'experience', 'skills', 'education', 'project', 'achievement', 'certification',
      'leadership', 'management', 'communication', 'teamwork', 'problem solving'
    ];
    
    potentialKeywords.forEach(keyword => {
      const regex = new RegExp(`\\b${keyword}\\b`, 'i');
      if (regex.test(rawText) && !extractedKeywords.includes(keyword)) {
        extractedKeywords.push(keyword.charAt(0).toUpperCase() + keyword.slice(1));
      }
    });
    
    // Ensure we have at least some keywords
    if (extractedKeywords.length < 5) {
      const defaultKeywords = ['Professional Experience', 'Skills', 'Education', 'Communication', 'Problem Solving'];
      defaultKeywords.forEach(keyword => {
        if (!extractedKeywords.includes(keyword)) {
          extractedKeywords.push(keyword);
        }
      });
    }
    
    analysisResult.keywords = extractedKeywords.slice(0, 15); // Limit to 15 keywords
    
    // Extract key requirements
    const keyRequirements = [
      'Professional experience',
      'Relevant education',
      'Technical skills',
      'Communication skills',
      'Problem-solving abilities'
    ];
    
    analysisResult.keyRequirements = keyRequirements;
    
    // Basic format analysis
    const formatStrengths = [
      'Organized structure',
      'Clear section headings',
      'Consistent formatting'
    ];
    
    const formatWeaknesses = [
      'Could improve visual hierarchy',
      'Consider adding more white space',
      'Ensure consistent alignment'
    ];
    
    const formatRecommendations = [
      'Use bullet points for achievements',
      'Add more white space between sections',
      'Ensure consistent date formatting'
    ];
    
    analysisResult.formatStrengths = formatStrengths;
    analysisResult.formatWeaknesses = formatWeaknesses;
    analysisResult.formatRecommendations = formatRecommendations;
    
    // Basic content analysis
    const strengths = [
      'Includes relevant professional information',
      'Presents qualifications clearly',
      'Demonstrates professional background'
    ];
    
    const weaknesses = [
      'Could benefit from more quantifiable achievements',
      'May need more specific examples of skills application',
      'Consider adding more industry-specific keywords'
    ];
    
    const recommendations = [
      'Add measurable achievements with numbers and percentages',
      'Include more industry-specific keywords',
      'Ensure all experience is relevant to target positions'
    ];
    
    analysisResult.strengths = strengths;
    analysisResult.weaknesses = weaknesses;
    analysisResult.recommendations = recommendations;
    
    // Calculate ATS score
    const hasContact = /(?:email|phone|address|linkedin)/i.test(rawText);
    const hasEducation = /(?:education|degree|university|college|bachelor|master|phd|diploma)/i.test(rawText);
    const hasExperience = /(?:experience|work|employment|job|position|role)/i.test(rawText);
    const hasSkills = /(?:skills|proficient|proficiency|familiar|expertise|expert|knowledge)/i.test(rawText);
    
    let atsScore = 65; // Start with a default score
    
    // Add points for key sections
    if (hasContact) atsScore += 5;
    if (hasEducation) atsScore += 5;
    if (hasExperience) atsScore += 10;
    if (hasSkills) atsScore += 5;
    
    // Add points for extracted data
    atsScore += Math.min(skills.length, 5);
    atsScore += Math.min(extractedKeywords.length / 2, 5);
    
    // Ensure score is between 30 and 95
    atsScore = Math.max(30, Math.min(atsScore, 95));
    analysisResult.atsScore = Math.round(atsScore);
    
    // Ensure all arrays are populated
    ensureArraysArePopulated(analysisResult);
    
    // Add metadata
    analysisResult.metadata = {
      ...metadata,
      analysisMethod: "basic",
      analysisTimestamp: new Date().toISOString()
    };
    
    logger.info(`Basic analysis completed for CV ID: ${cvId}`);
    
    return analysisResult;
  } catch (error) {
    logger.error(`Error in basic analysis for CV ID: ${cvId}: ${error instanceof Error ? error.message : String(error)}`);
    
    // Ensure all arrays are populated with defaults
    ensureArraysArePopulated(analysisResult);
    
    // Add metadata
    analysisResult.metadata = {
      ...metadata,
      analysisMethod: "basic_fallback",
      analysisTimestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : String(error)
    };
    
    logger.info(`Basic fallback analysis completed for CV ID: ${cvId}`);
    
    return analysisResult;
  }
}
