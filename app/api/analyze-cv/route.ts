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
    
    // Initialize RAG service
    const ragService = new MistralRAGService();
    
    // Process the CV document
    await ragService.processCVDocument(rawText);
    
    // Extract skills
    logger.info(`Extracting skills for CV ID: ${cvId}`);
    try {
      const skills = await ragService.extractSkills();
      analysisResult.skills = skills;
      logger.info(`Extracted ${skills.length} skills for CV ID: ${cvId}`);
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
    
    // Ensure all arrays are populated
    ensureArraysArePopulated(analysisResult);
    
    // Add metadata
    analysisResult.metadata = {
      ...metadata,
      analysisTimestamp: new Date().toISOString(),
      analysisMethod: 'rag'
    };
    
    logger.info(`CV analysis complete for CV ID: ${cvId}`);
    return analysisResult;
  } catch (error) {
    logger.error(`Error in CV analysis for CV ID: ${cvId}: ${error instanceof Error ? error.message : String(error)}`);
    // Fall back to basic analysis
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
  logger.info(`Falling back to basic analysis for CV ID: ${cvId}`);
  
  // Create initial analysis result object
  const analysisResult: AnalysisResult = {
    cvId,
    userId,
    atsScore: 50, // Default score
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
    metadata: {},
    sections: [],
    skills: []
  };
  
  // Ensure all arrays are populated with defaults
  ensureArraysArePopulated(analysisResult);
  
  // Add metadata
  analysisResult.metadata = {
    ...metadata,
    analysisTimestamp: new Date().toISOString(),
    analysisMethod: 'basic'
  };
  
  logger.info(`Basic CV analysis complete for CV ID: ${cvId} with ATS score: ${analysisResult.atsScore}`);
  return analysisResult;
}
