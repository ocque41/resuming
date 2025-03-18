// app/api/analyze-cv/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { MistralRAGService } from '@/lib/utils/mistralRagService';
import { performLocalAnalysis } from '@/lib/utils/cvProcessor';
import { auth } from '@/auth';
import { db } from '@/lib/db/drizzle';
import { cvs } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { logger } from '@/lib/logger';
import { DocumentGenerator } from '@/lib/utils/documentGenerator';

// Define the structure of the analysis result
interface AnalysisResult {
  atsScore: number;
  language: string;
  industry: string;
  keywordAnalysis: {
    recommended: string[];
    missing: string[];
  };
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
  formatStrengths: string[];
  formatWeaknesses: string[];
  formatRecommendations: string[];
  skills: string[];
  sections?: string[] | Array<{ name: string; content: string }>;
  experienceEntries?: Array<{
    jobTitle: string;
    company: string;
    dateRange: string;
    location?: string;
    responsibilities: string[];
  }>;
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
    const analysis = await analyzeCV(cvContent, cvIdNumber);
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
      keywordAnalysis: analysis.keywordAnalysis,
      strengths: analysis.strengths,
      weaknesses: analysis.weaknesses,
      recommendations: analysis.recommendations,
      formattingStrengths: analysis.formatStrengths,
      formattingWeaknesses: analysis.formatWeaknesses,
      formattingRecommendations: analysis.formatRecommendations,
      skills: analysis.skills,
      experienceEntries: analysis.experienceEntries,
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
 * Analyze a CV using the RAG approach with Mistral AI
 */
export async function analyzeCV(rawText: string, cvId?: number): Promise<AnalysisResult> {
  try {
    logger.info('Starting CV analysis with RAG service');
    
    // Initialize RAG service
    const ragService = new MistralRAGService();
    
    // Prepare the analysis result
    const analysisResult: AnalysisResult = {
      atsScore: 0,
      language: 'en',
      industry: 'General',
      keywordAnalysis: {
        recommended: [],
        missing: []
      },
      strengths: [],
      weaknesses: [],
      recommendations: [],
      formatStrengths: [],
      formatWeaknesses: [],
      formatRecommendations: [],
      skills: [],
      sections: [],
      experienceEntries: []
    };
    
    // Perform local analysis to extract experience entries
    try {
      logger.info('Performing local analysis to extract structured data');
      const localAnalysis = await performLocalAnalysis(rawText);
      
      if (localAnalysis.experienceEntries && localAnalysis.experienceEntries.length > 0) {
        logger.info(`Extracted ${localAnalysis.experienceEntries.length} experience entries from CV`);
        analysisResult.experienceEntries = localAnalysis.experienceEntries;
      }
    } catch (localAnalysisError) {
      logger.error(`Error in local analysis: ${localAnalysisError instanceof Error ? localAnalysisError.message : String(localAnalysisError)}`);
      // Continue with RAG analysis even if local analysis fails
    }
    
    // Process the CV with the RAG service
    try {
      await ragService.processCVDocument(rawText);
    } catch (error) {
      logger.error(`Error processing CV with RAG service: ${error instanceof Error ? error.message : String(error)}`);
      // Fall back to basic analysis if RAG service fails
      return performBasicAnalysis(rawText, analysisResult);
    }
    
    // Get ATS score
    try {
      const atsScoreQuery = "What ATS (Applicant Tracking System) score would you give this CV on a scale of 0-100? Just return the number.";
      const atsScoreString = await ragService.generateResponse(atsScoreQuery);
      analysisResult.atsScore = parseInt(atsScoreString) || 0;
    } catch (error) {
      logger.error(`Error getting ATS score: ${error instanceof Error ? error.message : String(error)}`);
      analysisResult.atsScore = 65; // Fallback score
    }
    
    // Get language
    try {
      analysisResult.language = await ragService.detectLanguage();
    } catch (error) {
      logger.error(`Error detecting language: ${error instanceof Error ? error.message : String(error)}`);
      analysisResult.language = 'en'; // Default to English
    }
    
    // Get industry
    try {
      // Extract industry directly using ragService
      const industryQuery = "What industry is this CV for? Give a single word or short phrase answer.";
      const industry = await ragService.generateResponse(industryQuery);
      analysisResult.industry = industry.trim() || 'General';
    } catch (error) {
      logger.error(`Error extracting industry: ${error instanceof Error ? error.message : String(error)}`);
      analysisResult.industry = 'General'; // Default industry
    }
    
    // Get keyword analysis
    try {
      // Get keywords directly from ragService
      const keywordsQuery = `What are the 5 most important keywords for a CV in the ${analysisResult.industry} industry that are present in this CV?`;
      const missingKeywordsQuery = `What are 5 important keywords for a CV in the ${analysisResult.industry} industry that are missing from this CV?`;
      
      const presentKeywords = await ragService.generateResponse(keywordsQuery);
      const missingKeywords = await ragService.generateResponse(missingKeywordsQuery);
      
      // Process the responses into arrays
      const recommendedArray = presentKeywords
        .split(/[\n,]/)
        .map((k: string) => k.trim())
        .filter((k: string) => k.length > 0);
      
      const missingArray = missingKeywords
        .split(/[\n,]/)
        .map((k: string) => k.trim())
        .filter((k: string) => k.length > 0);
      
      analysisResult.keywordAnalysis = {
        recommended: recommendedArray,
        missing: missingArray
      };
    } catch (error) {
      logger.error(`Error analyzing keywords: ${error instanceof Error ? error.message : String(error)}`);
    }
    
    // Get strengths
    try {
      const strengthsQuery = "What are the 3 main strengths of this CV? Respond with a comma-separated list.";
      const strengthsResponse = await ragService.generateResponse(strengthsQuery);
      const strengths = strengthsResponse
        .split(/[\n,]/)
        .map((s: string) => s.trim())
        .filter((s: string) => s.length > 0);
      analysisResult.strengths = strengths;
    } catch (error) {
      logger.error(`Error getting strengths: ${error instanceof Error ? error.message : String(error)}`);
      analysisResult.strengths = ['Clear structure', 'Includes work experience', 'Contains contact information'];
    }
    
    // Get weaknesses
    try {
      const weaknessesQuery = "What are the 3 main weaknesses of this CV? Respond with a comma-separated list.";
      const weaknessesResponse = await ragService.generateResponse(weaknessesQuery);
      const weaknesses = weaknessesResponse
        .split(/[\n,]/)
        .map((w: string) => w.trim())
        .filter((w: string) => w.length > 0);
      analysisResult.weaknesses = weaknesses;
    } catch (error) {
      logger.error(`Error getting weaknesses: ${error instanceof Error ? error.message : String(error)}`);
      analysisResult.weaknesses = ['Could include more keywords', 'Consider quantifying achievements', 'Could highlight more skills'];
    }
    
    // Get recommendations
    try {
      const recommendationsQuery = "What are the 3 main recommendations to improve this CV? Respond with a comma-separated list.";
      const recommendationsResponse = await ragService.generateResponse(recommendationsQuery);
      const recommendations = recommendationsResponse
        .split(/[\n,]/)
        .map((r: string) => r.trim())
        .filter((r: string) => r.length > 0);
      analysisResult.recommendations = recommendations;
    } catch (error) {
      logger.error(`Error getting recommendations: ${error instanceof Error ? error.message : String(error)}`);
      analysisResult.recommendations = ['Add more industry-specific keywords', 'Quantify achievements with metrics', 'Emphasize relevant skills'];
    }
    
    // Get format strengths
    try {
      const formatStrengthsQuery = "What are the 3 main formatting strengths of this CV? Respond with a comma-separated list.";
      const formatStrengthsResponse = await ragService.generateResponse(formatStrengthsQuery);
      const formatStrengths = formatStrengthsResponse
        .split(/[\n,]/)
        .map((s: string) => s.trim())
        .filter((s: string) => s.length > 0);
      analysisResult.formatStrengths = formatStrengths;
    } catch (error) {
      logger.error(`Error getting format strengths: ${error instanceof Error ? error.message : String(error)}`);
      analysisResult.formatStrengths = ['Good section organization', 'Consistent formatting', 'Clear section headings'];
    }
    
    // Get format weaknesses
    try {
      const formatWeaknessesQuery = "What are the 3 main formatting weaknesses of this CV? Respond with a comma-separated list.";
      const formatWeaknessesResponse = await ragService.generateResponse(formatWeaknessesQuery);
      const formatWeaknesses = formatWeaknessesResponse
        .split(/[\n,]/)
        .map((w: string) => w.trim())
        .filter((w: string) => w.length > 0);
      analysisResult.formatWeaknesses = formatWeaknesses;
    } catch (error) {
      logger.error(`Error getting format weaknesses: ${error instanceof Error ? error.message : String(error)}`);
      analysisResult.formatWeaknesses = ['Could improve spacing', 'Consider more consistent date formats', 'bullet points could be more aligned'];
    }
    
    // Get format recommendations
    try {
      const formatRecommendationsQuery = "What are the 3 main formatting recommendations to improve this CV? Respond with a comma-separated list.";
      const formatRecommendationsResponse = await ragService.generateResponse(formatRecommendationsQuery);
      const formatRecommendations = formatRecommendationsResponse
        .split(/[\n,]/)
        .map((r: string) => r.trim())
        .filter((r: string) => r.length > 0);
      analysisResult.formatRecommendations = formatRecommendations;
    } catch (error) {
      logger.error(`Error getting format recommendations: ${error instanceof Error ? error.message : String(error)}`);
      analysisResult.formatRecommendations = ['Use more white space between sections', 'Standardize date formats', 'Use bullet points for achievements'];
    }
    
    // Get skills
    try {
      const skillsQuery = "What are the main professional skills mentioned in this CV? Respond with a comma-separated list.";
      const skillsResponse = await ragService.generateResponse(skillsQuery);
      const skills = skillsResponse
        .split(/[\n,]/)
        .map((s: string) => s.trim())
        .filter((s: string) => s.length > 0);
      analysisResult.skills = skills;
    } catch (error) {
      logger.error(`Error getting skills: ${error instanceof Error ? error.message : String(error)}`);
      // Fallback to empty array for skills
    }
    
    // If we have a CV ID, update the metadata
    if (cvId) {
      try {
        await updateCVMetadata(cvId, analysisResult);
      } catch (error) {
        logger.error(`Error updating CV metadata: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    
    return analysisResult;
  } catch (error) {
    logger.error(`Unexpected error in analyzeCV: ${error instanceof Error ? error.message : String(error)}`);
    
    // Create a new empty analysis result for the fallback
    const emptyResult: AnalysisResult = {
      atsScore: 0,
      language: 'en',
      industry: 'General',
      keywordAnalysis: {
        recommended: [],
        missing: []
      },
      strengths: [],
      weaknesses: [],
      recommendations: [],
      formatStrengths: [],
      formatWeaknesses: [],
      formatRecommendations: [],
      skills: [],
      sections: [],
      experienceEntries: []
    };
    
    // Fall back to basic analysis
    return performBasicAnalysis(rawText, emptyResult);
  }
}

/**
 * Performs a basic analysis when the comprehensive analysis fails
 * This is a fallback to ensure we return something useful even if the main analysis pipeline fails
 */
async function performBasicAnalysis(rawText: string, analysisResult: AnalysisResult): Promise<AnalysisResult> {
  logger.info('Performing basic analysis');
  
  // Create basic analysis result
  const basicAnalysisResult: AnalysisResult = {
    atsScore: 65, // Default score
    language: 'en',
    industry: 'General',
    keywordAnalysis: {
      recommended: [],
      missing: []
    },
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
    skills: [],
    sections: [],
    experienceEntries: []
  };
  
  // Perform local analysis to extract structured data if not already present
  if (!basicAnalysisResult.experienceEntries || basicAnalysisResult.experienceEntries.length === 0) {
    try {
      logger.info('Performing local analysis to extract structured data');
      const localAnalysis = await performLocalAnalysis(rawText);
      
      if (localAnalysis.experienceEntries && localAnalysis.experienceEntries.length > 0) {
        logger.info(`Extracted ${localAnalysis.experienceEntries.length} experience entries from CV`);
        basicAnalysisResult.experienceEntries = localAnalysis.experienceEntries;
      }
    } catch (localAnalysisError) {
      logger.error(`Error in local analysis: ${localAnalysisError instanceof Error ? localAnalysisError.message : String(localAnalysisError)}`);
      // Continue with basic analysis even if local analysis fails
    }
  }
  
  try {
    // Basic text analysis to extract sections and keywords
    const sections: Array<{ name: string; content: string }> = [];
    
    // Detect language (simple heuristic)
    if (/\b(trabajo|experiencia|habilidades|educación)\b/i.test(rawText)) {
      basicAnalysisResult.language = 'es';
    } else if (/\b(travail|expérience|compétences|éducation)\b/i.test(rawText)) {
      basicAnalysisResult.language = 'fr';
    } else if (/\b(arbeit|erfahrung|fähigkeiten|bildung)\b/i.test(rawText)) {
      basicAnalysisResult.language = 'de';
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
    basicAnalysisResult.sections = sections;
    
    // Extract basic skills list
    const skillsSection = sections.find(section => /SKILLS|COMPETENCIES|EXPERTISE/i.test(section.name));
    if (skillsSection) {
      const skills = skillsSection.content
        .split(/[,\n•·\-]/)
        .map(skill => skill.trim())
        .filter(skill => skill.length > 0 && skill.length < 30);
      
      basicAnalysisResult.skills = skills;
    }
    
    // Extract keywords based on common CV terms
    const keywordRegex = /\b(manage[dment]*|develop|implement|lead|create|design|optimize|improve|increase|strategic|communicate|coordinate|project|team|analysis|research|customer|client|sales|solution|technical|technology|problem[-\s]?solving)\b/gi;
    const keywordMatches = [...rawText.matchAll(keywordRegex)];
    
    const keywords = Array.from(new Set(keywordMatches.map(match => match[0].toLowerCase())));
    basicAnalysisResult.keywordAnalysis.recommended = keywords;
    basicAnalysisResult.keywordAnalysis.missing = [];
    
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
    
    basicAnalysisResult.industry = detectedIndustry;
    
    // Calculate a better score based on our basic analysis
    const scoreFactors = {
      sections: basicAnalysisResult.sections.length * 10, // More sections is better
      skills: Math.min(15, basicAnalysisResult.skills.length * 3), // More skills is better (up to a point)
      keywords: Math.min(15, basicAnalysisResult.keywordAnalysis.recommended.length), // More keywords is better (up to a point)
      bulletPoints: (rawText.match(/[•·\-]|\n\s*\d+\./g) || []).length // More bullet points is better
    };
    
    // Calculate ATS score with reasonable defaults
    const calculatedScore = calculateATSScore(
      scoreFactors.skills,
      scoreFactors.keywords,
      scoreFactors.sections,
      basicAnalysisResult.formatStrengths.length,
      basicAnalysisResult.formatWeaknesses.length
    );
    
    basicAnalysisResult.atsScore = calculatedScore;
    
  } catch (analysisError) {
    logger.error(`Error in basic analysis: ${analysisError instanceof Error ? analysisError.message : String(analysisError)}`);
    // Keep default values if analysis fails
  }
  
  // Merge basic analysis result with existing analysis result (avoid spreading undefined arrays)
  analysisResult.strengths = [...(basicAnalysisResult.strengths || []), ...(analysisResult.strengths || [])];
  analysisResult.weaknesses = [...(basicAnalysisResult.weaknesses || []), ...(analysisResult.weaknesses || [])];
  analysisResult.recommendations = [...(basicAnalysisResult.recommendations || []), ...(analysisResult.recommendations || [])];
  analysisResult.formatStrengths = [...(basicAnalysisResult.formatStrengths || []), ...(analysisResult.formatStrengths || [])];
  analysisResult.formatWeaknesses = [...(basicAnalysisResult.formatWeaknesses || []), ...(analysisResult.formatWeaknesses || [])];
  analysisResult.formatRecommendations = [...(basicAnalysisResult.formatRecommendations || []), ...(analysisResult.formatRecommendations || [])];
  analysisResult.skills = [...(basicAnalysisResult.skills || []), ...(analysisResult.skills || [])];
  // Don't try to spread sections if they're not compatible types
  if (!analysisResult.sections) {
    analysisResult.sections = basicAnalysisResult.sections || [];
  } else if (basicAnalysisResult.sections && Array.isArray(basicAnalysisResult.sections)) {
    // Only try to merge if both are arrays of the same type
    if (
      analysisResult.sections.length === 0 || 
      (typeof analysisResult.sections[0] === typeof basicAnalysisResult.sections[0])
    ) {
      // @ts-ignore - We've checked compatibility
      analysisResult.sections = [...analysisResult.sections, ...basicAnalysisResult.sections];
    }
  }
  // Don't try to spread experienceEntries if they're undefined
  if (!analysisResult.experienceEntries && basicAnalysisResult.experienceEntries) {
    analysisResult.experienceEntries = basicAnalysisResult.experienceEntries;
  } else if (basicAnalysisResult.experienceEntries) {
    analysisResult.experienceEntries = [
      ...(analysisResult.experienceEntries || []),
      ...basicAnalysisResult.experienceEntries
    ];
  }
  analysisResult.keywordAnalysis = {
    recommended: [
      ...(basicAnalysisResult.keywordAnalysis?.recommended || []),
      ...(analysisResult.keywordAnalysis?.recommended || [])
    ],
    missing: [
      ...(basicAnalysisResult.keywordAnalysis?.missing || []),
      ...(analysisResult.keywordAnalysis?.missing || [])
    ]
  };
  
  return analysisResult;
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
 * Update CV metadata
 */
async function updateCVMetadata(cvId: number, analysis: AnalysisResult) {
  try {
    // Get current CV
    const currentCV = await db.query.cvs.findFirst({
      where: eq(cvs.id, cvId)
    });
    
    if (!currentCV) {
      throw new Error(`CV with ID ${cvId} not found`);
    }
    
    // Parse current metadata
    const currentMetadata = currentCV.metadata ? JSON.parse(currentCV.metadata as string) : {};
    
    // Update metadata with analysis results
    const updatedMetadata = {
      ...currentMetadata,
      atsScore: analysis.atsScore,
      language: analysis.language,
      industry: analysis.industry,
      keywordAnalysis: analysis.keywordAnalysis,
      strengths: analysis.strengths,
      weaknesses: analysis.weaknesses,
      recommendations: analysis.recommendations,
      formatStrengths: analysis.formatStrengths,
      formatWeaknesses: analysis.formatWeaknesses,
      formatRecommendations: analysis.formatRecommendations,
      skills: analysis.skills,
      experienceEntries: analysis.experienceEntries,
      analyzedAt: new Date().toISOString(),
      analysis_status: 'complete'
    };
    
    // Update CV in database
    await db.update(cvs)
      .set({ metadata: JSON.stringify(updatedMetadata) })
      .where(eq(cvs.id, cvId));
    
    logger.info(`Updated metadata for CV ID: ${cvId}`);
  } catch (error) {
    logger.error(`Error updating CV metadata: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}
