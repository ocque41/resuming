import { logger } from '@/lib/logger';
import { 
  OptimizationStage, 
  OptimizationState, 
  updateStage, 
  recordOptimizationError 
} from './progressiveOptimization';
import { retryWithExponentialBackoff } from '@/lib/utils/apiRateLimiter';
import { analyzeCVContent, isOpenAIAvailable, CVAnalysisResult } from './openai.service';

/**
 * Runs the analyze stage of the CV optimization process
 */
export async function runAnalyzeStage(
  userId: string,
  cvId: string,
  jobDescription: string,
  cvText: string,
  options: { aiService?: 'auto' | 'openai' } = {}
): Promise<OptimizationState> {
  logger.info(`Starting analyze stage for CV ${cvId}`);
  
  // Initialize state
  let state: OptimizationState = {
    userId,
    cvId,
    jobDescription,
    stage: OptimizationStage.NOT_STARTED,
    progress: 0,
    results: {},
    timestamp: Date.now(),
    lastUpdated: Date.now()
  };
  
  // Check if OpenAI is available
  const openaiAvailable = await isOpenAIAvailable();
  if (!openaiAvailable) {
    logger.error('OpenAI service is not available');
    return recordOptimizationError(
      userId,
      cvId,
      jobDescription,
      'OpenAI service is not available',
      OptimizationStage.ANALYZE_STARTED
    );
  }
  
  // Update state to indicate analysis has started
  state = updateStage(state, OptimizationStage.ANALYZE_STARTED);
  
  try {
    // Analyze the CV with OpenAI
    const analysisResult = await analyzeCVContent(cvText);
    
    // Extract skills from the analysis
    state = extractSkillsFromAnalysis(state, analysisResult.cvAnalysis);
    
    // Extract keywords from the analysis
    state = extractKeywordsFromAnalysis(state, jobDescription, analysisResult.cvAnalysis);
    
    // Extract key requirements
    state = extractRequirementsFromAnalysis(state, jobDescription, analysisResult.cvAnalysis);
    
    // Analyze format
    state = analyzeFormatFromAnalysis(state, analysisResult.cvAnalysis);
    
    // Analyze content
    state = analyzeContentFromAnalysis(state, analysisResult.cvAnalysis);
    
    // Determine industry
    state = determineIndustryFromAnalysis(state, analysisResult.cvAnalysis);
    
    // Detect language
    state = detectLanguageFromAnalysis(state, analysisResult.cvAnalysis);
    
    // Extract sections
    state = extractSectionsFromAnalysis(state, cvText, analysisResult.cvAnalysis);
    
    // Mark analysis as completed
    state = updateStage(state, OptimizationStage.ANALYZE_COMPLETED);
    
    logger.info(`Completed analyze stage for CV ${cvId}`);
    return state;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Error in analyze stage for CV ${cvId}: ${errorMessage}`);
    throw error;
  }
}

/**
 * Extract skills from OpenAI analysis
 */
function extractSkillsFromAnalysis(
  state: OptimizationState,
  analysis: CVAnalysisResult
): OptimizationState {
  try {
    // Combine technical and professional skills into a single array
    const skills = [
      ...(analysis.skills?.technical || []),
      ...(analysis.skills?.professional || [])
    ];
    
    return {
      ...state,
      results: {
        ...state.results,
        skills
      },
      progress: Math.min(100, state.progress + 10),
      lastUpdated: Date.now()
    };
  } catch (error) {
    logger.error('Error extracting skills:', error instanceof Error ? error.message : String(error));
    return state;
  }
}

/**
 * Extract keywords from OpenAI analysis
 */
function extractKeywordsFromAnalysis(
  state: OptimizationState,
  jobDescription: string,
  analysis: CVAnalysisResult
): OptimizationState {
  try {
    // Use skills as keywords for now
    const keywords = [
      ...(analysis.skills?.technical || []),
      ...(analysis.skills?.professional || [])
    ];
    
    return {
      ...state,
      results: {
        ...state.results,
        keywords
      },
      progress: Math.min(100, state.progress + 10),
      lastUpdated: Date.now()
    };
  } catch (error) {
    logger.error('Error extracting keywords:', error instanceof Error ? error.message : String(error));
    return state;
  }
}

/**
 * Extract requirements from OpenAI analysis
 */
function extractRequirementsFromAnalysis(
  state: OptimizationState,
  jobDescription: string,
  analysis: CVAnalysisResult
): OptimizationState {
  try {
    // For now, we'll use a simple approach
    const keyRequirements = analysis.recommendations || [];
    
    return {
      ...state,
      results: {
        ...state.results,
        keyRequirements
      },
      progress: Math.min(100, state.progress + 10),
      lastUpdated: Date.now()
    };
  } catch (error) {
    logger.error('Error extracting requirements:', error instanceof Error ? error.message : String(error));
    return state;
  }
}

/**
 * Analyze format from OpenAI analysis
 */
function analyzeFormatFromAnalysis(
  state: OptimizationState,
  analysis: CVAnalysisResult
): OptimizationState {
  try {
    const formatAnalysis = {
      strengths: analysis.formatStrengths || [],
      weaknesses: analysis.formatWeaknesses || [],
      recommendations: analysis.formatRecommendations || []
    };
    
    return {
      ...state,
      results: {
        ...state.results,
        formatAnalysis
      },
      progress: Math.min(100, state.progress + 10),
      lastUpdated: Date.now()
    };
  } catch (error) {
    logger.error('Error analyzing format:', error instanceof Error ? error.message : String(error));
    return state;
  }
}

/**
 * Analyze content from OpenAI analysis
 */
function analyzeContentFromAnalysis(
  state: OptimizationState,
  analysis: CVAnalysisResult
): OptimizationState {
  try {
    const contentAnalysis = {
      strengths: analysis.strengths || [],
      weaknesses: analysis.weaknesses || [],
      recommendations: analysis.recommendations || [],
      atsScore: analysis.atsScore || 0
    };
    
    return {
      ...state,
      results: {
        ...state.results,
        contentAnalysis
      },
      progress: Math.min(100, state.progress + 10),
      lastUpdated: Date.now()
    };
  } catch (error) {
    logger.error('Error analyzing content:', error instanceof Error ? error.message : String(error));
    return state;
  }
}

/**
 * Determine industry from OpenAI analysis
 */
function determineIndustryFromAnalysis(
  state: OptimizationState,
  analysis: CVAnalysisResult
): OptimizationState {
  try {
    const industry = analysis.industry || 'General';
    
    return {
      ...state,
      results: {
        ...state.results,
        industry
      },
      progress: Math.min(100, state.progress + 10),
      lastUpdated: Date.now()
    };
  } catch (error) {
    logger.error('Error determining industry:', error instanceof Error ? error.message : String(error));
    return state;
  }
}

/**
 * Detect language from OpenAI analysis
 */
function detectLanguageFromAnalysis(
  state: OptimizationState,
  analysis: CVAnalysisResult
): OptimizationState {
  try {
    const language = analysis.language || 'English';
    
    return {
      ...state,
      results: {
        ...state.results,
        language
      },
      progress: Math.min(100, state.progress + 10),
      lastUpdated: Date.now()
    };
  } catch (error) {
    logger.error('Error detecting language:', error instanceof Error ? error.message : String(error));
    return state;
  }
}

/**
 * Extract sections from OpenAI analysis
 */
function extractSectionsFromAnalysis(
  state: OptimizationState,
  cvText: string,
  analysis: CVAnalysisResult
): OptimizationState {
  try {
    const sections = analysis.sections || [];
    
    return {
      ...state,
      results: {
        ...state.results,
        sections
      },
      progress: Math.min(100, state.progress + 10),
      lastUpdated: Date.now()
    };
  } catch (error) {
    logger.error('Error extracting sections:', error instanceof Error ? error.message : String(error));
    return state;
  }
} 