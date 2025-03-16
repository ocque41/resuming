import { logger } from '@/lib/logger';
import { 
  OptimizationStage, 
  OptimizationState, 
  updateStage, 
  recordOptimizationError 
} from './progressiveOptimization';
import { MistralRAGService } from '@/lib/utils/mistralRagService';
import { retryWithExponentialBackoff } from '@/lib/utils/apiRateLimiter';

/**
 * Runs the analyze stage of the CV optimization process
 */
export async function runAnalyzeStage(
  userId: string,
  cvId: string,
  jobDescription: string,
  cvText: string
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
  
  // Initialize RAG service
  const ragService = new MistralRAGService();
  
  // Update state to indicate analysis has started
  state = updateStage(state, OptimizationStage.ANALYZE_STARTED);
  
  try {
    // Process the CV document
    await ragService.processCVDocument(cvText);
    
    // Extract skills
    state = await extractSkillsStep(userId, cvId, jobDescription, ragService, state);
    
    // Extract keywords
    state = await extractKeywordsStep(userId, cvId, jobDescription, ragService, state);
    
    // Extract key requirements
    state = await extractRequirementsStep(userId, cvId, jobDescription, ragService, state);
    
    // Analyze format
    state = await analyzeFormatStep(userId, cvId, jobDescription, ragService, state);
    
    // Analyze content
    state = await analyzeContentStep(userId, cvId, jobDescription, ragService, state);
    
    // Determine industry
    state = await determineIndustryStep(userId, cvId, jobDescription, ragService, state);
    
    // Detect language
    state = await detectLanguageStep(userId, cvId, jobDescription, ragService, state);
    
    // Extract sections
    state = await extractSectionsStep(userId, cvId, jobDescription, ragService, state, cvText);
    
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
 * Extract skills from the CV
 */
async function extractSkillsStep(
  userId: string,
  cvId: string,
  jobDescription: string,
  ragService: MistralRAGService,
  currentState: OptimizationState
): Promise<OptimizationState> {
  try {
    logger.info(`Extracting skills for CV ID: ${cvId}`);
    
    // Skip if we already have skills
    if (currentState.results.skills && currentState.results.skills.length > 0) {
      logger.info(`Skills already extracted for CV ID: ${cvId}`);
      return currentState;
    }
    
    // Extract skills
    const skills = await ragService.extractSkills();
    
    logger.info(`Extracted ${skills.length} skills for CV ID: ${cvId}`);
    
    // Update the state with the extracted skills
    return updateStage(
      currentState,
      OptimizationStage.SKILLS_EXTRACTED,
      { skills }
    );
  } catch (error) {
    // Log the error but continue with the process
    logger.error(`Error extracting skills: ${error instanceof Error ? error.message : String(error)}`);
    return updateStage(
      currentState,
      OptimizationStage.SKILLS_EXTRACTED,
      { skills: [] }
    );
  }
}

/**
 * Extracts keywords from the CV
 */
async function extractKeywordsStep(
  userId: string,
  cvId: string,
  jobDescription: string,
  ragService: MistralRAGService,
  currentState: OptimizationState
): Promise<OptimizationState> {
  logger.info(`Extracting keywords for CV ${cvId}`);
  
  try {
    // Extract keywords using the RAG service
    const keywords = await ragService.extractKeywords();
    
    // Update the state with the extracted keywords
    return updateStage(
      currentState,
      OptimizationStage.KEYWORDS_EXTRACTED,
      { keywords }
    );
  } catch (error) {
    // Log the error but continue with the process
    logger.error(`Error extracting keywords: ${error instanceof Error ? error.message : String(error)}`);
    return updateStage(
      currentState,
      OptimizationStage.KEYWORDS_EXTRACTED,
      { keywords: [] }
    );
  }
}

/**
 * Extracts key requirements from the job description
 */
async function extractRequirementsStep(
  userId: string,
  cvId: string,
  jobDescription: string,
  ragService: MistralRAGService,
  currentState: OptimizationState
): Promise<OptimizationState> {
  logger.info(`Extracting key requirements for CV ${cvId}`);
  
  try {
    // Extract key requirements using the RAG service
    const keyRequirements = await ragService.extractKeyRequirements();
    
    // Update the state with the extracted key requirements
    return updateStage(
      currentState,
      OptimizationStage.KEY_REQUIREMENTS_EXTRACTED,
      { keyRequirements }
    );
  } catch (error) {
    // Log the error but continue with the process
    logger.error(`Error extracting key requirements: ${error instanceof Error ? error.message : String(error)}`);
    return updateStage(
      currentState,
      OptimizationStage.KEY_REQUIREMENTS_EXTRACTED,
      { keyRequirements: [] }
    );
  }
}

/**
 * Analyze the CV format
 */
async function analyzeFormatStep(
  userId: string,
  cvId: string,
  jobDescription: string,
  ragService: MistralRAGService,
  currentState: OptimizationState
): Promise<OptimizationState> {
  logger.info(`Analyzing format for CV ${cvId}`);
  
  try {
    // Analyze the format using the RAG service
    const formatAnalysis = await ragService.analyzeCVFormat();
    
    // Update the state with the format analysis
    return updateStage(
      currentState,
      OptimizationStage.FORMAT_ANALYZED,
      { formatAnalysis }
    );
  } catch (error) {
    // Log the error but continue with the process
    logger.error(`Error analyzing format: ${error instanceof Error ? error.message : String(error)}`);
    return updateStage(
      currentState,
      OptimizationStage.FORMAT_ANALYZED,
      { formatAnalysis: { strengths: [], weaknesses: [], recommendations: [] } }
    );
  }
}

/**
 * Analyzes the content of the CV
 */
async function analyzeContentStep(
  userId: string,
  cvId: string,
  jobDescription: string,
  ragService: MistralRAGService,
  currentState: OptimizationState
): Promise<OptimizationState> {
  logger.info(`Analyzing content for CV ${cvId}`);
  
  try {
    // Analyze the content using the RAG service
    const contentAnalysis = await ragService.analyzeContent();
    
    // Update the state with the content analysis
    return updateStage(
      currentState,
      OptimizationStage.CONTENT_ANALYZED,
      { contentAnalysis }
    );
  } catch (error) {
    // Log the error but continue with the process
    logger.error(`Error analyzing content: ${error instanceof Error ? error.message : String(error)}`);
    return updateStage(
      currentState,
      OptimizationStage.CONTENT_ANALYZED,
      { contentAnalysis: { strengths: [], weaknesses: [], recommendations: [] } }
    );
  }
}

/**
 * Determines the industry of the CV
 */
async function determineIndustryStep(
  userId: string,
  cvId: string,
  jobDescription: string,
  ragService: MistralRAGService,
  currentState: OptimizationState
): Promise<OptimizationState> {
  logger.info(`Determining industry for CV ${cvId}`);
  
  try {
    // Determine the industry using the RAG service
    const industry = await ragService.determineIndustry();
    
    // Update the state with the determined industry
    return updateStage(
      currentState,
      OptimizationStage.INDUSTRY_DETERMINED,
      { industry }
    );
  } catch (error) {
    // Log the error but continue with the process
    logger.error(`Error determining industry: ${error instanceof Error ? error.message : String(error)}`);
    return updateStage(
      currentState,
      OptimizationStage.INDUSTRY_DETERMINED,
      { industry: 'Unknown' }
    );
  }
}

/**
 * Detect the language of the CV
 */
async function detectLanguageStep(
  userId: string,
  cvId: string,
  jobDescription: string,
  ragService: MistralRAGService,
  currentState: OptimizationState
): Promise<OptimizationState> {
  logger.info(`Detecting language for CV ${cvId}`);
  
  try {
    // Detect the language using the RAG service
    const language = await ragService.detectLanguage();
    
    // Update the state with the detected language
    return updateStage(
      currentState,
      OptimizationStage.LANGUAGE_DETECTED,
      { language }
    );
  } catch (error) {
    // Log the error but continue with the process
    logger.error(`Error detecting language: ${error instanceof Error ? error.message : String(error)}`);
    return updateStage(
      currentState,
      OptimizationStage.LANGUAGE_DETECTED,
      { language: 'English' }
    );
  }
}

/**
 * Extract sections from the CV
 */
async function extractSectionsStep(
  userId: string,
  cvId: string,
  jobDescription: string,
  ragService: MistralRAGService,
  currentState: OptimizationState,
  cvText?: string
): Promise<OptimizationState> {
  logger.info(`Extracting sections for CV ${cvId}`);
  
  try {
    // Create a timeout promise
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Section extraction timed out')), 20000); // 20 second timeout
    });
    
    // Create the extraction promise
    const extractionPromise = ragService.extractSections();
    
    // Race the extraction against the timeout
    const sections = await Promise.race([extractionPromise, timeoutPromise])
      .catch(error => {
        logger.warn(`Section extraction failed or timed out: ${error instanceof Error ? error.message : String(error)}`);
        
        // Return a fallback section structure
        if (cvText) {
          logger.info('Using fallback section extraction with regex');
          
          // Try to extract sections using regex as a fallback
          try {
            // Simple regex to identify potential sections
            const sectionRegex = /^(?:\s*)([\w\s&]+)(?:\s*)(?::|-)(?:\s*)/gm;
            const matches = [...cvText.matchAll(sectionRegex)];
            
            if (matches.length > 0) {
              const sections = [];
              
              for (let i = 0; i < matches.length; i++) {
                const match = matches[i];
                const sectionName = match[1].trim();
                const startIndex = match.index! + match[0].length;
                const endIndex = i < matches.length - 1 ? matches[i + 1].index! : cvText.length;
                const content = cvText.substring(startIndex, endIndex).trim();
                
                sections.push({ name: sectionName, content });
              }
              
              return sections;
            }
          } catch (regexError) {
            logger.error(`Regex fallback failed: ${regexError instanceof Error ? regexError.message : String(regexError)}`);
          }
          
          // If regex fails or finds no sections, return the whole text as one section
          return [{ name: 'Content', content: cvText }];
        }
        
        // If no CV text is available, return an empty array
        return [];
      });
    
    // Log the number of sections extracted
    logger.info(`Extracted ${sections.length} sections from CV ${cvId}`);
    
    // Update the state with the extracted sections
    return updateStage(
      currentState,
      OptimizationStage.SECTIONS_EXTRACTED,
      { sections }
    );
  } catch (error) {
    // Log the error but continue with the process
    logger.error(`Error extracting sections: ${error instanceof Error ? error.message : String(error)}`);
    
    // Use the CV text as a fallback
    const fallbackContent = cvText || 'No content available';
    
    // Log the error in the state's message property
    const updatedState = updateStage(
      currentState,
      OptimizationStage.SECTIONS_EXTRACTED,
      { 
        sections: [
          { 
            name: 'Content', 
            content: fallbackContent 
          }
        ]
      }
    );
    
    // Add error message to the state
    updatedState.error = `Section extraction failed: ${error instanceof Error ? error.message : String(error)}`;
    
    return updatedState;
  }
} 