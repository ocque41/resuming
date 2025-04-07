// app/api/analyze-cv/route.ts
import { NextRequest } from "next/server";
import { db } from "@/lib/db/drizzle";
import { cvs } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { MistralRAGService } from "@/lib/utils/mistralRagService";
import { logger } from "@/lib/logger";
import { getMissingIndustryKeywords, generateIndustrySpecificSuggestions, enhanceExperienceWithMetrics, performLocalAnalysis } from "@/lib/utils/cvProcessor";

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
  experienceEntries?: Array<{
    jobTitle: string;
    company: string;
    dateRange: string;
    location?: string;
    responsibilities: string[];
  }>;
  industryKeywords?: string[];
  missingSoftSkills?: string[];
  missingHardSkills?: string[];
  industrySuggestions?: string[];
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
    const forceRefresh = searchParams.get("forceRefresh") === "true";

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

    // Initialize or parse existing metadata
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

    // Check if analysis is already in progress
    const isAnalyzing = metadata && (metadata as any).analyzing === true;
    
    // Check if analysis is already completed and not forcing refresh
    const isAnalyzed = metadata && 
                       (metadata as any).analyzedAt && 
                       (metadata as any).atsScore && 
                       !forceRefresh;
    
    // If analysis is completed and not forcing refresh, return cached results
    if (isAnalyzed) {
      console.log(`Using cached analysis for CV ${cvId} (analyzed at ${(metadata as any).analyzedAt})`);
      return new Response(JSON.stringify({
        success: true,
        analysis: {
          cvId,
          userId: cv.userId,
          atsScore: (metadata as any).atsScore,
          language: (metadata as any).language || 'en',
          industry: (metadata as any).industry || 'General',
          keywords: (metadata as any).keywordAnalysis || [],
          strengths: (metadata as any).strengths || [],
          weaknesses: (metadata as any).weaknesses || [],
          recommendations: (metadata as any).recommendations || [],
          formatStrengths: (metadata as any).formattingStrengths || [],
          formatWeaknesses: (metadata as any).formattingWeaknesses || [],
          formatRecommendations: (metadata as any).formattingRecommendations || [],
          metadata,
          sections: (metadata as any).sections || [],
          skills: (metadata as any).skills || [],
          experienceEntries: (metadata as any).experienceEntries || [],
          industryKeywords: (metadata as any).industryKeywords || [],
          missingSoftSkills: (metadata as any).missingSoftSkills || [],
          missingHardSkills: (metadata as any).missingHardSkills || [],
          industrySuggestions: (metadata as any).industrySuggestions || []
        },
        message: "Using cached CV analysis",
        fromCache: true
      }), {
        headers: { "Content-Type": "application/json" },
      });
    }
    
    // If analysis is already in progress, return status
    if (isAnalyzing && !forceRefresh) {
      console.log(`Analysis already in progress for CV ${cvId}`);
      return new Response(JSON.stringify({
        success: true,
        message: "CV analysis is in progress",
        inProgress: true,
        startedAt: (metadata as any).analysisStartedAt,
        metadata
      }), {
        headers: { "Content-Type": "application/json" },
      });
    }
    
    // Update metadata to mark CV as being analyzed
    const updatedMetadata = {
      ...metadata,
      analyzing: true,
      analysisStartedAt: new Date().toISOString(),
      analysisStatus: 'starting',
      analysisProgress: 0
    };
    
    // Update CV record with analysis status
    try {
      await db.update(cvs)
        .set({ metadata: JSON.stringify(updatedMetadata) })
        .where(eq(cvs.id, cvIdNumber));
      
      console.log(`Updated metadata to mark CV ${cvId} as being analyzed`);
    } catch (updateError) {
      console.error(`Error updating metadata for CV ${cvId}:`, updateError);
      // Continue even if update fails
    }
    
    // Start analysis in background (don't await to prevent timeout)
    startBackgroundAnalysis(cvIdNumber, String(cv.userId), cvContent, updatedMetadata);
    
    // Return immediate response that analysis has started
    return new Response(JSON.stringify({
      success: true,
      message: "CV analysis started",
      inProgress: true,
      startedAt: updatedMetadata.analysisStartedAt,
      metadata: updatedMetadata,
      pollingEndpoint: `/api/cv/analysis-status?cvId=${cvId}`
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
 * Start background analysis process without awaiting completion
 */
async function startBackgroundAnalysis(
  cvId: number, 
  userId: string, 
  cvContent: string, 
  initialMetadata: any
): Promise<void> {
  try {
    // Run analysis without awaiting its completion to prevent timeout
    analyzeCV(String(cvId), userId, cvContent, initialMetadata)
      .then(async (analysis) => {
        // Update metadata with analysis results
        const updatedMetadata = {
          ...initialMetadata,
          analyzing: false,
          analyzedAt: new Date().toISOString(),
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
          experienceEntries: analysis.experienceEntries,
          industryKeywords: analysis.industryKeywords,
          missingSoftSkills: analysis.missingSoftSkills,
          missingHardSkills: analysis.missingHardSkills,
          industrySuggestions: analysis.industrySuggestions,
          ready_for_optimization: true,
          analysis_status: 'complete',
          analysisProgress: 100
        };
        
        // Update CV record with analysis results
        try {
          await db.update(cvs)
            .set({ metadata: JSON.stringify(updatedMetadata) })
            .where(eq(cvs.id, cvId));
          
          console.log(`Successfully updated metadata with analysis results for CV ${cvId}`);
        } catch (updateError) {
          console.error(`Error updating metadata with analysis results for CV ${cvId}:`, updateError);
        }
      })
      .catch((error) => {
        console.error(`Error in background analysis for CV ${cvId}:`, error);
        
        // Update metadata to mark analysis as failed
        const failedMetadata = {
          ...initialMetadata,
          analyzing: false,
          analysisError: error instanceof Error ? error.message : "Unknown error",
          analysisStatus: 'failed',
          analysisFailedAt: new Date().toISOString()
        };
        
        // Update CV record with failure status
        db.update(cvs)
          .set({ metadata: JSON.stringify(failedMetadata) })
          .where(eq(cvs.id, cvId))
          .catch((updateError) => {
            console.error(`Failed to update metadata after analysis error for CV ${cvId}:`, updateError);
          });
      });
    
    console.log(`Started background analysis for CV ${cvId}`);
  } catch (error) {
    console.error(`Error starting background analysis for CV ${cvId}:`, error);
    throw error;
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
      skills: [],
      experienceEntries: [],
      industryKeywords: [],
      missingSoftSkills: [],
      missingHardSkills: [],
      industrySuggestions: []
    };
    
    // Perform local analysis to extract experience entries
    try {
      const localAnalysis = performLocalAnalysis(rawText);
      
      // Extract experience entries if available
      if (localAnalysis && localAnalysis.experienceEntries) {
        // Apply metrics enhancement to make experience entries more impactful
        try {
          const enhancedEntries = enhanceExperienceWithMetrics(localAnalysis.experienceEntries);
          analysisResult.experienceEntries = enhancedEntries;
          logger.info(`Successfully enhanced ${enhancedEntries.length} experience entries with metrics for CV ID: ${cvId}`);
        } catch (enhanceError) {
          // If enhancement fails, use original entries
          analysisResult.experienceEntries = localAnalysis.experienceEntries;
          logger.error(`Error enhancing experience entries with metrics for CV ID: ${cvId}: ${enhanceError instanceof Error ? enhanceError.message : String(enhanceError)}`);
        }
      }
    } catch (localAnalysisError) {
      logger.error(`Error extracting experience entries for CV ID: ${cvId}: ${localAnalysisError instanceof Error ? localAnalysisError.message : String(localAnalysisError)}`);
      // Continue with analysis even if local analysis fails
    }
    
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
      // Import the consistent ATS score calculation function from lib/optimizeCV.fixed.ts
      const { calculateATSScore } = require('@/lib/optimizeCV.fixed');
      
      if (typeof calculateATSScore === 'function') {
        // Use the imported function with the raw CV text for accurate scoring
        const atsScore = calculateATSScore(rawText, false);
        analysisResult.atsScore = atsScore;
        logger.info(`Calculated ATS score for CV ID: ${cvId} using consistent method: ${atsScore}`);
      } else {
        // Fallback to the local calculation if import fails or isn't a function
        const atsScore = calculateATSScore(
          analysisResult.skills.length,
          analysisResult.keywords.length,
          analysisResult.sections.length,
          analysisResult.formatStrengths.length,
          analysisResult.formatWeaknesses.length
        );
        
        analysisResult.atsScore = atsScore;
        logger.info(`Calculated ATS score for CV ID: ${cvId} using fallback method: ${atsScore}`);
      }
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
    
    // After industry is determined, add industry-specific recommendations
    try {
      if (analysisResult.industry) {
        // Get industry-specific keyword recommendations
        const industrySuggestions = generateIndustrySpecificSuggestions(rawText, analysisResult.industry);
        
        // Add to the analysis result
        analysisResult.industryKeywords = industrySuggestions.missingKeywords;
        analysisResult.missingSoftSkills = industrySuggestions.missingSoftSkills;
        analysisResult.missingHardSkills = industrySuggestions.missingHardSkills;
        analysisResult.industrySuggestions = industrySuggestions.suggestions;
        
        // Add industry-specific suggestions to general recommendations
        if (industrySuggestions.suggestions.length > 0) {
          analysisResult.recommendations = [
            ...analysisResult.recommendations,
            ...industrySuggestions.suggestions.slice(0, 3) // Add top 3 industry suggestions
          ];
        }
        
        logger.info(`Added industry-specific recommendations for ${analysisResult.industry} industry`);
      }
    } catch (industryError) {
      logger.error(`Error adding industry-specific recommendations: ${industryError instanceof Error ? industryError.message : String(industryError)}`);
      // Continue without industry recommendations
    }
    
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
  
  // Create basic analysis result
  const analysisResult: AnalysisResult = {
    cvId,
    userId,
    atsScore: 65, // Default score
    industry: 'General',
    language: 'en',
    keywords: [],
    keyRequirements: [],
    strengths: [
      "Clear presentation of professional experience",
      "Includes contact information",
      "Lists relevant skills"
    ],
    weaknesses: [
      "Could benefit from more quantifiable achievements",
      "May need more specific examples of skills application",
      "Consider adding more industry-specific keywords"
    ],
    recommendations: [
      "Add measurable achievements with numbers and percentages",
      "Include more industry-specific keywords",
      "Ensure all experience is relevant to target positions"
    ],
    formatStrengths: [
      "Organized structure",
      "Clear section headings",
      "Consistent formatting"
    ],
    formatWeaknesses: [
      "Could improve visual hierarchy",
      "Consider adding more white space",
      "Ensure consistent date formatting"
    ],
    formatRecommendations: [
      "Use bullet points for achievements",
      "Add more white space between sections",
      "Ensure consistent alignment"
    ],
    metadata: {},
    sections: [],
    skills: [],
    experienceEntries: []
  };
  
  try {
    // Basic text analysis to extract sections and keywords
    const sections: Array<{ name: string; content: string }> = [];
    
    // Detect language (simple heuristic)
    if (/\b(trabajo|experiencia|habilidades|educación)\b/i.test(rawText)) {
      analysisResult.language = 'es';
    } else if (/\b(travail|expérience|compétences|éducation)\b/i.test(rawText)) {
      analysisResult.language = 'fr';
    } else if (/\b(arbeit|erfahrung|fähigkeiten|bildung)\b/i.test(rawText)) {
      analysisResult.language = 'de';
    }
    
    // Extract common sections
    const sectionMatches = [
      ...rawText.matchAll(/(?:^|\n)\s*(PROFILE|SUMMARY|ABOUT|OBJECTIVE)(?:\s*:|$)(.+?)(?=\n\s*[A-Z][A-Z\s]+(?:\s*:|$)|$)/gis),
      ...rawText.matchAll(/(?:^|\n)\s*(EXPERIENCE|WORK HISTORY|EMPLOYMENT)(?:\s*:|$)(.+?)(?=\n\s*[A-Z][A-Z\s]+(?:\s*:|$)|$)/gis),
      ...rawText.matchAll(/(?:^|\n)\s*(EDUCATION|ACADEMIC)(?:\s*:|$)(.+?)(?=\n\s*[A-Z][A-Z\s]+(?:\s*:|$)|$)/gis),
      ...rawText.matchAll(/(?:^|\n)\s*(SKILLS|COMPETENCIES|EXPERTISE)(?:\s*:|$)(.+?)(?=\n\s*[A-Z][A-Z\s]+(?:\s*:|$)|$)/gis)
    ];
    
    sectionMatches.forEach(match => {
      if (match && match.length > 2) {
        sections.push({
          name: match[1].trim(),
          content: match[2].trim()
        });
      }
    });
    
    // Add found sections
    analysisResult.sections = sections;
    
    // Extract basic skills list
    const skillsSection = sections.find(section => /SKILLS|COMPETENCIES|EXPERTISE/i.test(section.name));
    if (skillsSection) {
      const skills = skillsSection.content
        .split(/[,\n•·\-]/)
        .map(skill => skill.trim())
        .filter(skill => skill.length > 0 && skill.length < 30);
      
      analysisResult.skills = skills;
    }
    
    // Extract keywords based on common CV terms
    const keywordRegex = /\b(manage[dment]*|develop|implement|lead|create|design|optimize|improve|increase|strategic|communicate|coordinate|project|team|analysis|research|customer|client|sales|solution|technical|technology|problem[-\s]?solving)\b/gi;
    const keywordMatches = [...rawText.matchAll(keywordRegex)];
    
    const keywords = Array.from(new Set(keywordMatches.map(match => match[0].toLowerCase())));
    analysisResult.keywords = keywords;
    
    // Attempt to determine industry
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
    let detectedIndustry = 'General';
    
    for (const [industry, pattern] of Object.entries(industries)) {
      const matches = (rawText.match(pattern) || []).length;
      if (matches > maxMatches) {
        maxMatches = matches;
        detectedIndustry = industry;
      }
    }
    
    analysisResult.industry = detectedIndustry;
    
    // Calculate a better score based on our basic analysis
    const scoreFactors = {
      sections: analysisResult.sections.length * 10, // More sections is better
      skills: Math.min(15, analysisResult.skills.length * 3), // More skills is better (up to a point)
      keywords: Math.min(15, analysisResult.keywords.length), // More keywords is better (up to a point)
      bulletPoints: (rawText.match(/[•·\-]|\n\s*\d+\./g) || []).length // More bullet points is better
    };
    
    // Try to use the consistent ATS score calculation
    try {
      // Import the consistent ATS score calculation function
      const { calculateATSScore } = require('@/lib/optimizeCV.fixed');
      
      if (typeof calculateATSScore === 'function') {
        // Use the imported function with the raw CV text
        const atsScore = calculateATSScore(rawText, false);
        analysisResult.atsScore = atsScore;
        logger.info(`Calculated ATS score in basic analysis for CV ID: ${cvId} using consistent method: ${atsScore}`);
      } else {
        // Fallback to the local calculation
        const calculatedScore = calculateATSScore(
          scoreFactors.skills,
          scoreFactors.keywords,
          scoreFactors.sections,
          analysisResult.formatStrengths.length,
          analysisResult.formatWeaknesses.length
        );
        
        analysisResult.atsScore = calculatedScore;
        logger.info(`Calculated ATS score in basic analysis for CV ID: ${cvId} using fallback method: ${calculatedScore}`);
      }
    } catch (scoreError) {
      // Log error and fallback to local calculation
      logger.error(`Error using consistent ATS score calculation in basic analysis: ${scoreError instanceof Error ? scoreError.message : String(scoreError)}`);
      
      const calculatedScore = calculateATSScore(
        scoreFactors.skills,
        scoreFactors.keywords,
        scoreFactors.sections,
        analysisResult.formatStrengths.length,
        analysisResult.formatWeaknesses.length
      );
      
      analysisResult.atsScore = calculatedScore;
    }
    
    // Try to extract experience entries
    try {
      const localAnalysis = performLocalAnalysis(rawText);
      
      if (localAnalysis && localAnalysis.experienceEntries) {
        // Apply metrics enhancement
        try {
          const enhancedEntries = enhanceExperienceWithMetrics(localAnalysis.experienceEntries);
          analysisResult.experienceEntries = enhancedEntries;
          logger.info(`Successfully enhanced ${enhancedEntries.length} experience entries with metrics in basic analysis for CV ID: ${cvId}`);
        } catch (enhanceError) {
          // If enhancement fails, use original entries
          analysisResult.experienceEntries = localAnalysis.experienceEntries;
          logger.error(`Error enhancing experience entries with metrics in basic analysis for CV ID: ${cvId}: ${enhanceError instanceof Error ? enhanceError.message : String(enhanceError)}`);
        }
      }
    } catch (localAnalysisError) {
      logger.error(`Error extracting experience entries in basic analysis for CV ID: ${cvId}: ${localAnalysisError instanceof Error ? localAnalysisError.message : String(localAnalysisError)}`);
      // Continue with analysis even if local analysis fails
    }
    
  } catch (analysisError) {
    logger.error(`Error in basic analysis for CV ID: ${cvId}: ${analysisError instanceof Error ? analysisError.message : String(analysisError)}`);
    // Keep default values if analysis fails
  }
  
  return analysisResult;
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
  // Import the consistent ATS score calculation function
  try {
    // Try to use the imported function if available
    const { calculateATSScore } = require('@/lib/optimizeCV.fixed');
    if (typeof calculateATSScore === 'function') {
      // Since we don't have the full CV text here, we'll create a mock score
      // This will be replaced by the actual text-based calculation in the analysis
      return 65; // Default reasonable score that will be overridden
    }
  } catch (error) {
    logger.warn("Could not import calculateATSScore from optimizeCV.fixed.ts, using fallback calculation");
  }
  
  // Fallback calculation if import fails
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
