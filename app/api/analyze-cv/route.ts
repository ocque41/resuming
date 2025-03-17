// app/api/analyze-cv/route.ts
import { NextRequest } from "next/server";
import { db } from "@/lib/db/drizzle";
import { cvs } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { MistralRAGService } from "@/lib/utils/mistralRagService";
import { logger } from "@/lib/logger";

// Type definition for analysis result
interface AnalysisResult {
  cvId: string;
  userId: string | number;
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

/**
 * GET /api/analyze-cv
 * Enhanced CV analysis API endpoint with proper ATS scoring
 */
export async function GET(request: NextRequest) {
  try {
    // Get fileName from URL params (required)
    const searchParams = request.nextUrl.searchParams;
    const fileName = searchParams.get("fileName");
    const cvId = searchParams.get("cvId");

    // Early validations with helpful error messages
  if (!fileName) {
      console.error("Missing fileName parameter in analyze-cv request");
      return new Response(JSON.stringify({ 
        error: "Missing fileName parameter",
        success: false 
      }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (!cvId) {
      console.error("Missing cvId parameter in analyze-cv request");
      return new Response(JSON.stringify({ 
        error: "Missing cvId parameter",
        success: false 
      }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    console.log(`Starting CV analysis for ${fileName} (ID: ${cvId})`);

    // Parse cvId to integer safely
    let cvIdNumber: number;
    try {
      cvIdNumber = parseInt(cvId);
      if (isNaN(cvIdNumber)) {
        throw new Error(`Invalid cvId: ${cvId} is not a number`);
      }
    } catch (parseError) {
      console.error(`Error parsing cvId: ${cvId}`, parseError);
      return new Response(JSON.stringify({ 
        error: `Invalid cvId: ${cvId} is not a valid number`,
        success: false 
      }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Fetch CV record with safety checks
    let cv;
    try {
      cv = await db.query.cvs.findFirst({
        where: eq(cvs.id, cvIdNumber)
      });
    } catch (dbError) {
      console.error(`Database error fetching CV ${cvId}:`, dbError);
      return new Response(JSON.stringify({ 
        error: "Database error while fetching CV",
        details: dbError instanceof Error ? dbError.message : "Unknown database error",
        success: false
      }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (!cv) {
      console.error(`CV not found: ${cvId}`);
      return new Response(JSON.stringify({ 
        error: "CV not found",
        success: false 
      }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Get CV content with null check
    const cvContent = cv.rawText || "";
    if (!cvContent || cvContent.trim() === "") {
      console.error(`CV content is empty for ID: ${cvId}`);
      return new Response(JSON.stringify({ 
        error: "Only PDF files are supported. Other file types are for applying to jobs.",
        success: false 
      }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Perform CV analysis to determine industry, language, and calculate ATS score
    const analysis = await analyzeCV(cvId, String(cv.userId), cvContent, cv.metadata);
    console.log(`Analysis completed for CV ${cvId} with ATS score: ${analysis.atsScore}`);

    // Merge with existing metadata (if any)
    let metadata = {};
    if (cv.metadata) {
      try {
        metadata = JSON.parse(cv.metadata);
      } catch (parseError) {
        console.error(`Error parsing existing metadata for CV ${cvId}:`, parseError);
        // Continue with empty metadata instead of failing
        metadata = {};
      }
    }

    // Create updated metadata with analysis results
    const updatedMetadata = {
      ...metadata,
      atsScore: analysis.atsScore,
      language: analysis.language,
      industry: analysis.industry,
      keywordAnalysis: analysis.keywords,
      strengths: analysis.strengths,
      weaknesses: analysis.weaknesses,
      recommendations: analysis.recommendations,
      formattingStrengths: analysis.formatStrengths,
      formattingWeaknesses: analysis.formatWeaknesses,
      formattingRecommendations: analysis.formatRecommendations,
      skills: analysis.skills,
      analyzedAt: new Date().toISOString(),
      ready_for_optimization: true,
      analysis_status: 'complete'
    };

    // Update CV record with metadata safely
    try {
      await db.update(cvs)
        .set({ metadata: JSON.stringify(updatedMetadata) })
        .where(eq(cvs.id, cvIdNumber));
      
      console.log(`Successfully updated metadata for CV ${cvId}`);
    } catch (updateError) {
      console.error(`Error updating metadata for CV ${cvId}:`, updateError);
      return new Response(JSON.stringify({ 
        error: "Failed to update CV metadata",
        details: updateError instanceof Error ? updateError.message : "Unknown database error",
        success: false
      }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Return analysis results
    return new Response(JSON.stringify({ 
      success: true, 
      analysis,
      message: "CV analyzed successfully"
    }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    // Log the detailed error
    console.error(`Unexpected error analyzing CV:`, error);
    
    // Provide a user-friendly response
    return new Response(JSON.stringify({ 
      error: "Failed to analyze CV", 
      details: error instanceof Error ? error.message : "Unknown error occurred",
      success: false
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

/**
 * Analyzes a CV using the RAG service
 */
async function analyzeCV(cvId: string, userId: string, rawText: string, metadata: any): Promise<AnalysisResult> {
  logger.info(`Starting CV analysis for CV ID: ${cvId}`);
  
  try {
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
      metadata: {},
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
      return performBasicAnalysis(cvId, userId, rawText, metadata);
    }
    
    // Process the CV document with timeout protection
    try {
      logger.info(`Processing CV document for CV ID: ${cvId}`);
      logger.info(`Processing CV document with RAG service`);
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
    
    // Use the new comprehensive analysis method instead of multiple separate calls
    try {
      logger.info(`Starting comprehensive CV analysis for CV ID: ${cvId}`);
      const comprehensiveAnalysis = await ragService.analyzeCVComprehensive();
      
      // Map results to our analysis result object
      analysisResult.skills = comprehensiveAnalysis.skills;
      analysisResult.keywords = comprehensiveAnalysis.keywords;
      analysisResult.keyRequirements = comprehensiveAnalysis.keyRequirements;
      analysisResult.formatStrengths = comprehensiveAnalysis.formatAnalysis.strengths;
      analysisResult.formatWeaknesses = comprehensiveAnalysis.formatAnalysis.weaknesses;
      analysisResult.formatRecommendations = comprehensiveAnalysis.formatAnalysis.recommendations;
      analysisResult.strengths = comprehensiveAnalysis.contentAnalysis.strengths;
      analysisResult.weaknesses = comprehensiveAnalysis.contentAnalysis.weaknesses;
      analysisResult.recommendations = comprehensiveAnalysis.contentAnalysis.recommendations;
      analysisResult.industry = comprehensiveAnalysis.industry;
      analysisResult.language = comprehensiveAnalysis.language;
      analysisResult.sections = comprehensiveAnalysis.sections;
      
      logger.info(`Completed comprehensive CV analysis for CV ID: ${cvId}`);
    } catch (comprehensiveError) {
      logger.error(`Error performing comprehensive analysis for CV ID: ${cvId}: ${comprehensiveError instanceof Error ? comprehensiveError.message : String(comprehensiveError)}`);
      
      // Fall back to traditional analysis only if comprehensive analysis fails completely
      return performBasicAnalysis(cvId, userId, rawText, metadata);
    }
    
    // Calculate ATS score based on the analysis results
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
    } catch (scoreError) {
      logger.error(`Error calculating ATS score for CV ID: ${cvId}: ${scoreError instanceof Error ? scoreError.message : String(scoreError)}`);
      analysisResult.atsScore = 65; // Default decent score
    }
    
    // Make sure all arrays in the result are properly initialized
    ensureArraysArePopulated(analysisResult);
    
    // Update metadata with analysis timestamp
    analysisResult.metadata = {
      ...metadata,
      analyzedAt: new Date().toISOString()
    };
    
    logger.info(`Completed CV analysis for CV ID: ${cvId}`);
    return analysisResult;
  } catch (error) {
    logger.error(`Unexpected error during CV analysis for CV ID: ${cvId}: ${error instanceof Error ? error.message : String(error)}`);
    return performBasicAnalysis(cvId, userId, rawText, metadata);
  }
}

/**
 * Performs a basic analysis when the comprehensive analysis fails
 * This is a fallback to ensure we return something useful even if the main analysis pipeline fails
 */
async function performBasicAnalysis(cvId: string, userId: string, rawText: string, metadata: any): Promise<AnalysisResult> {
  logger.info(`Performing basic analysis for CV ID: ${cvId}`);
  
  // Create a basic analysis result with default values
  const basicResult: AnalysisResult = {
    cvId,
    userId,
    atsScore: 60, // Default moderate score
    industry: 'General',
    language: 'English',
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
      analyzedAt: new Date().toISOString(),
      analysisMethod: 'basic',
      fallbackReason: 'Advanced analysis failed'
    },
    sections: [],
    skills: []
  };
  
  try {
    // Extract skills using simple pattern matching
    const skillsPattern = /skills.*?:(.*?)(?:\n\n|\n[A-Z]|$)/si;
    const skillsMatch = rawText.match(skillsPattern);
    if (skillsMatch && skillsMatch[1]) {
      basicResult.skills = skillsMatch[1]
        .split(/[,|•]/)
        .map(skill => skill.trim())
        .filter(skill => skill.length > 0);
    }
    
    // Extract basic sections
    const sectionTitles = [
      'education', 'experience', 'skills', 'projects', 'certifications',
      'volunteering', 'languages', 'interests', 'references', 'summary'
    ];
    
    const extractedSections: Array<{ name: string; content: string }> = [];
    for (const title of sectionTitles) {
      const regex = new RegExp(`${title}[:\\s]*(.*?)(?=\\n\\s*(?:${sectionTitles.join('|')})[:\\s]|$)`, 'si');
      const match = rawText.match(regex);
      
      if (match && match[1]) {
        extractedSections.push({
          name: title.charAt(0).toUpperCase() + title.slice(1),
          content: match[1].trim()
        });
      }
    }
    basicResult.sections = extractedSections;
    
    // Extract keywords (simply words that appear multiple times)
    const words = rawText.toLowerCase().split(/\W+/).filter(w => w.length > 3);
    const wordCounts: Record<string, number> = {};
    words.forEach(word => {
      wordCounts[word] = (wordCounts[word] || 0) + 1;
    });
    
    basicResult.keywords = Object.entries(wordCounts)
      .filter(([_, count]) => count > 2)
      .map(([word, _]) => word)
      .slice(0, 15);
    
    // Add basic format analysis
    basicResult.formatStrengths.push('Document contains structured content');
    
    if (rawText.length < 300) {
      basicResult.formatWeaknesses.push('CV text is quite short');
      basicResult.formatRecommendations.push('Expand your CV with more details about your experience and skills');
    }
    
    if (!rawText.includes('@') || !rawText.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/)) {
      basicResult.formatWeaknesses.push('Contact information may be missing or incomplete');
      basicResult.formatRecommendations.push('Add your email address and other contact details');
    }
    
    // Add basic content analysis
    if (basicResult.skills.length > 5) {
      basicResult.strengths.push('Good number of skills listed');
    } else {
      basicResult.weaknesses.push('Limited number of skills mentioned');
      basicResult.recommendations.push('Expand your skills section with relevant technical and soft skills');
    }
    
    if (extractedSections.length > 3) {
      basicResult.strengths.push('CV has multiple sections which improves readability');
    } else {
      basicResult.weaknesses.push('CV has limited structure');
      basicResult.recommendations.push('Organize your CV into clear sections such as Summary, Experience, Education, and Skills');
    }
    
    // Ensure all arrays in the result are properly initialized
    ensureArraysArePopulated(basicResult);
    
    logger.info(`Completed basic analysis for CV ID: ${cvId}`);
    return basicResult;
  } catch (error) {
    logger.error(`Error in basic analysis for CV ID: ${cvId}: ${error instanceof Error ? error.message : String(error)}`);
    
    // Ensure all arrays are populated even if basic analysis fails
    ensureArraysArePopulated(basicResult);
    
    return basicResult;
  }
}

/**
 * Ensures that all array properties in the analysis result are initialized
 * This prevents null or undefined errors when clients access the result
 */
function ensureArraysArePopulated(result: AnalysisResult): void {
  // List of array properties that should be initialized
  const arrayProperties = [
    'skills', 'keywords', 'keyRequirements', 'sections',
    'strengths', 'weaknesses', 'recommendations',
    'formatStrengths', 'formatWeaknesses', 'formatRecommendations'
  ] as const;
  
  // Initialize any undefined or null arrays
  for (const prop of arrayProperties) {
    if (!Array.isArray(result[prop])) {
      // @ts-ignore - We know these properties should be arrays
      result[prop] = [];
    }
  }
  
  // Add some default recommendations if none exist
  if (result.recommendations.length === 0) {
    result.recommendations.push(
      'Include a clear professional summary at the top of your CV',
      'Quantify your achievements with specific metrics when possible',
      'Tailor your CV for each job application by highlighting relevant experience'
    );
  }
  
  // Add some default format recommendations if none exist
  if (result.formatRecommendations.length === 0) {
    result.formatRecommendations.push(
      'Use consistent formatting throughout your CV',
      'Keep your CV to 1-2 pages for most industries',
      'Use bullet points to make information more scannable'
    );
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
