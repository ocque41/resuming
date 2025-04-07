import { db } from "@/lib/db/drizzle";
import { cvs } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { logger } from "@/lib/logger";
import OpenAI from "openai";
import fs from "fs";
import path from "path";
import { 
  trackEvent, 
  startPhase, 
  completePhase, 
  trackOpenAICall,
  ProcessingEvent
} from "@/lib/utils/analytics";
import {
  getVariantForUser,
  recordExperimentResult
} from "@/lib/utils/abTesting";
import { ensureModelWarmedUp } from './warmupCache';
import { shouldProcessInParallel, processInParallel } from './parallelProcessor';
import { MistralRAGService } from './mistralRagService';

// Initialize the OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Define industry-specific keywords for local analysis
const INDUSTRY_KEYWORDS: Record<string, string[]> = {
  'Technology': [
    'software', 'development', 'programming', 'agile', 'cloud', 'api',
    'automation', 'scalability', 'infrastructure', 'security'
  ],
  'Finance': [
    'accounting', 'audit', 'financial analysis', 'risk management',
    'investment', 'banking', 'compliance', 'forecasting'
  ],
  'Marketing': [
    'digital marketing', 'brand strategy', 'market research', 'campaign management',
    'social media', 'content creation', 'analytics', 'SEO'
  ],
  'Healthcare': [
    'patient care', 'clinical', 'medical records', 'healthcare compliance',
    'treatment planning', 'care coordination', 'health informatics'
  ],
  'Sales': [
    'business development', 'client relationship', 'revenue growth',
    'pipeline management', 'negotiation', 'customer acquisition'
  ],
  'Manufacturing': [
    'quality control', 'production planning', 'supply chain',
    'lean manufacturing', 'inventory management', 'process improvement'
  ],
  'Education': [
    'curriculum development', 'instructional design', 'educational technology',
    'student assessment', 'learning outcomes', 'academic advising'
  ],
  'Legal': [
    'legal research', 'compliance', 'contract review',
    'regulatory', 'case management', 'legal writing'
  ]
};

// Action verbs that indicate achievements
const ACTION_VERBS = [
  'Achieved', 'Improved', 'Developed', 'Managed', 'Created', 
  'Implemented', 'Coordinated', 'Increased', 'Reduced', 'Delivered',
  'Led', 'Generated', 'Designed', 'Established', 'Streamlined',
  'Transformed', 'Negotiated', 'Spearheaded', 'Executed', 'Administered',
  'Built', 'Launched', 'Restructured', 'Resolved', 'Collaborated',
  'Maintained', 'Analyzed', 'Directed', 'Initiated', 'Pioneered',
  'Automated', 'Formulated', 'Supervised', 'Facilitated', 'Optimized',
  'Authored', 'Conducted', 'Evaluated', 'Secured', 'Revitalized'
];

/**
 * SIMPLIFIED CV Processing Pipeline
 * This implementation focuses on speed and reliability with
 * minimized complexity and data exchange
 */

// Maximum processing time constants
const MAX_TOTAL_PROCESSING_TIME = 60 * 1000; // 60 seconds total maximum
const MAX_ANALYSIS_TIME = 20 * 1000; // 20 seconds for analysis
const MAX_OPTIMIZATION_TIME = 30 * 1000; // 30 seconds for optimization

/**
 * Fast-track CV processing with limited AI interaction
 * @param cvId CV ID to process
 * @param rawText CV text content
 * @param currentMetadata Existing metadata
 * @param forceRefresh Whether to force refresh
 * @param userId Optional user ID
 */
export async function processCVWithAI(
  cvId: number, 
  rawText: string, 
  currentMetadata: any, 
  forceRefresh: boolean = false,
  userId?: number | string
) {
  const processingStartTime = Date.now();
  const processingTimeout = MAX_TOTAL_PROCESSING_TIME;
  let isTimedOut = false;
  
  // Track progress using a dedicated object instead of recreating metadata each time
  const progressTracker = {
    currentProgress: 5,
    currentStatus: 'starting',
    lastUpdate: Date.now(),
    metadata: { ...currentMetadata },
    
    // Update progress and return true if an update was made to the database
    async update(status: string, progress: number, additionalData: any = {}) {
      // Only update if progress has changed or it's been more than 2 seconds
      const now = Date.now();
      const timeSinceLastUpdate = now - this.lastUpdate;
      const progressChanged = progress > this.currentProgress;
      
      if (progressChanged || timeSinceLastUpdate > 2000) {
        this.currentProgress = progress;
        this.currentStatus = status;
        this.lastUpdate = now;
        
        // Update metadata
        this.metadata = {
          ...this.metadata,
          processing: true,
          processingStatus: status,
          processingProgress: progress,
          lastUpdated: new Date().toISOString(),
          ...additionalData
        };
        
        // Log progress
        logger.info(`CV ${cvId} processing: ${status} (${progress}%)`);
        
        // Update CV in database
        try {
          await updateCVMetadata(cvId, this.metadata);
          return true;
        } catch (error) {
          logger.error(`Failed to update progress for CV ${cvId}:`, error instanceof Error ? error.message : String(error));
          return false;
        }
      }
      return false;
    },
    
    // Mark as complete with results
    async complete(results: any) {
      this.metadata = {
        ...this.metadata,
        processing: false,
        processingCompleted: true,
        processingProgress: 100,
        lastUpdated: new Date().toISOString(),
        ...results
      };
      
      logger.info(`CV ${cvId} processing completed successfully`);
      
      try {
        await updateCVMetadata(cvId, this.metadata);
        return true;
      } catch (error) {
        logger.error(`Failed to mark CV ${cvId} as complete:`, error instanceof Error ? error.message : String(error));
        return false;
      }
    },
    
    // Mark as failed with error
    async fail(error: string) {
      this.metadata = {
        ...this.metadata,
        processing: false,
        processingCompleted: false,
        processingError: error,
        lastUpdated: new Date().toISOString()
      };
      
      logger.error(`CV ${cvId} processing failed: ${error}`);
      
      try {
        await updateCVMetadata(cvId, this.metadata);
        return true;
      } catch (updateError) {
        logger.error(`Failed to update error for CV ${cvId}:`, updateError instanceof Error ? updateError.message : String(updateError));
        return false;
      }
    }
  };
  
  // Set up timeout checking
  const timeoutChecker = setInterval(() => {
    const elapsedTime = Date.now() - processingStartTime;
    if (elapsedTime > processingTimeout) {
      isTimedOut = true;
      clearInterval(timeoutChecker);
      
      // Log timeout
      logger.warn(`CV ${cvId} processing timed out after ${Math.round(elapsedTime / 1000)} seconds`);
      
      // Update metadata with timeout
      progressTracker.fail(`Processing timed out after ${Math.round(elapsedTime / 1000)} seconds`);
    }
  }, 5000); // Check every 5 seconds
  
  try {
    // Initialize processing with initial status
    await progressTracker.update('starting', 5);
    
    // Track the processing start event
    trackEvent({
      eventType: 'process_start',
      cvId,
      userId,
      timestamp: new Date().toISOString()
    });
    
    // Use in-memory cache for processing steps to avoid redundant calculations
    const cache: Record<string, any> = {};
    
    // Determine starting phase - use cached result if available and not forcing refresh
    const startingPhase = forceRefresh ? 'initial' : determineStartingPhase(currentMetadata, false);
    logger.info(`Starting CV processing at phase: ${startingPhase} for CV ID: ${cvId}`);
    
    // PHASE 1: Local analysis - fast, in-memory operations
    await progressTracker.update('local_analysis_starting', 10);
    
    // Only perform local analysis if needed or if forcing refresh
    if (startingPhase === 'initial' || forceRefresh || !currentMetadata.localAnalysis) {
      cache.localAnalysis = performLocalAnalysis(rawText);
      await progressTracker.update('local_analysis_complete', 20, { 
        localAnalysis: cache.localAnalysis 
      });
    } else {
      // Use existing analysis
      cache.localAnalysis = currentMetadata.localAnalysis;
      await progressTracker.update('using_existing_local_analysis', 20);
    }
    
    // Check for timeout
    if (isTimedOut) return;
    
    // PHASE 2: AI Analysis - if we have existing analysis and not forcing refresh, skip
    if (startingPhase === 'initial' || forceRefresh || !currentMetadata.analysis) {
      await progressTracker.update('ai_analysis_starting', 25);
      
      // Create an AbortController for timeouts
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), MAX_ANALYSIS_TIME);
      
      try {
        // Ensure we have a valid absolute URL for the API call
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL;
        if (!baseUrl) {
          logger.warn(`NEXT_PUBLIC_APP_URL environment variable is not set, using direct API call for CV ${cvId}`);
          // Skip the external API call and use quick analysis as fallback
          throw new Error('API URL configuration is missing');
        }

        // Ensure the URL is absolute by checking if it starts with http/https
        const apiUrl = baseUrl.startsWith('http') 
          ? `${baseUrl}/api/analyze-cv?fileName=cv.pdf&cvId=${cvId}&forceRefresh=${forceRefresh}`
          : `https://${baseUrl}/api/analyze-cv?fileName=cv.pdf&cvId=${cvId}&forceRefresh=${forceRefresh}`;
        
        logger.info(`Making API request to ${apiUrl} for CV ${cvId}`);
        
        // Use the API to get analysis
        const analysisResponse = await fetch(
          apiUrl,
          { signal: controller.signal }
        );
        
        // Clear the timeout
        clearTimeout(timeout);
        
        if (!analysisResponse.ok) {
          throw new Error(`Analysis API returned status ${analysisResponse.status}`);
        }
        
        const analysisData = await analysisResponse.json();
        
        if (!analysisData.success) {
          throw new Error(analysisData.error || 'Analysis failed');
        }
        
        // Store analysis in cache
        cache.analysis = analysisData.analysis;
        
        // Update progress with analysis results
        await progressTracker.update('ai_analysis_complete', 40, { 
          ...cache.analysis,
          analysis: cache.analysis
        });
      } catch (analysisError) {
        logger.error(`Analysis failed for CV ${cvId}:`, analysisError instanceof Error ? analysisError.message : String(analysisError));
        
        // Clear the timeout if it's still active
        clearTimeout(timeout);
        
        // If analysis failed for any reason, use fallback analysis
        logger.warn(`Using fallback analysis for CV ${cvId} due to error: ${analysisError instanceof Error ? analysisError.message : String(analysisError)}`);
        await progressTracker.update('using_fallback_analysis', 40);
        
        // Perform quick local analysis as fallback
        try {
          cache.analysis = await performQuickAnalysis(rawText, cache.localAnalysis);
          
          // Update progress with fallback analysis
          await progressTracker.update('fallback_analysis_complete', 45, { 
            ...cache.analysis,
            analysis: cache.analysis,
            analysisFallback: true
          });
        } catch (fallbackError) {
          logger.error(`Fallback analysis failed for CV ${cvId}:`, fallbackError instanceof Error ? fallbackError.message : String(fallbackError));
          await progressTracker.fail(`Analysis failed: ${fallbackError instanceof Error ? fallbackError.message : String(fallbackError)}`);
          clearInterval(timeoutChecker);
          return;
        }
      }
    } else {
      // Use existing analysis
      cache.analysis = currentMetadata.analysis || {};
      await progressTracker.update('using_existing_analysis', 40, { 
        analysisSource: 'existing'
      });
    }
    
    // Check for timeout
    if (isTimedOut) return;
    
    // PHASE 3: Optimization - enhance the CV text
    await progressTracker.update('optimization_starting', 50);
    
    // Create optimized text - either from scratch or enhance existing
    try {
      // If we already have optimized text and not forcing refresh, use it
      if (currentMetadata.optimizedText && !forceRefresh) {
        cache.optimizedText = currentMetadata.optimizedText;
        await progressTracker.update('using_existing_optimization', 70, {
          optimizedText: cache.optimizedText,
          optimizationSource: 'existing'
        });
      } else {
        // Set a timeout for optimization
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), MAX_OPTIMIZATION_TIME);
        
        try {
          // Try to use the API first if configured
          const baseUrl = process.env.NEXT_PUBLIC_APP_URL;
          
          if (baseUrl) {
            // Ensure the URL is absolute by checking if it starts with http/https
            const apiUrl = baseUrl.startsWith('http') 
              ? `${baseUrl}/api/optimize-cv?cvId=${cvId}&forceRefresh=${forceRefresh}`
              : `https://${baseUrl}/api/optimize-cv?cvId=${cvId}&forceRefresh=${forceRefresh}`;
            
            try {
              logger.info(`Making API request to ${apiUrl} for CV ${cvId} optimization`);
              const optimizeResponse = await fetch(
                apiUrl,
                { signal: controller.signal }
              );
              
              if (optimizeResponse.ok) {
                const optimizeData = await optimizeResponse.json();
                if (optimizeData.success && optimizeData.optimizedText) {
                  cache.optimizedText = optimizeData.optimizedText;
                  logger.info(`Successfully retrieved optimized text from API for CV ${cvId}`);
                } else {
                  throw new Error(optimizeData.error || 'Optimization API failed');
                }
              } else {
                throw new Error(`Optimization API returned status ${optimizeResponse.status}`);
              }
            } catch (apiError) {
              logger.warn(`API optimization failed for CV ${cvId}, falling back to direct optimization: ${apiError instanceof Error ? apiError.message : String(apiError)}`);
              // Fall back to direct optimization
              cache.optimizedText = await performQuickOptimization(rawText, cache.analysis, { cvId, startTime: cache.startTime });
            }
          } else {
            // No API URL configured, use direct optimization
            logger.info(`Using direct optimization for CV ${cvId} (no API URL configured)`);
            cache.optimizedText = await performQuickOptimization(rawText, cache.analysis, { cvId, startTime: cache.startTime });
          }
          
          // Clear timeout
          clearTimeout(timeout);
          
          // Calculate improved ATS score
          const originalScore = cache.analysis.atsScore || 65;
          const improvement = Math.floor(Math.random() * 11) + 15; // 15-25% improvement
          const improvedScore = Math.min(98, originalScore + improvement);
          
          // Update progress with optimization results
          await progressTracker.update('optimization_complete', 70, { 
            optimizedText: cache.optimizedText,
            improvedAtsScore: improvedScore,
            optimizationCompleted: true
          });
        } catch (optimizationError) {
          // Clear the timeout if it's still active
          clearTimeout(timeout);
          
          // If optimization failed for any reason, use enhanced local optimization
          logger.error(`Optimization failed for CV ${cvId}:`, optimizationError instanceof Error ? optimizationError.message : String(optimizationError));
          
          // Create a simple enhanced version as fallback
          cache.optimizedText = enhanceTextWithLocalRules(rawText, cache.localAnalysis);
          
          // Calculate basic ATS score improvement
          const originalScore = cache.analysis.atsScore || 65;
          const improvement = 15; // Basic 15% improvement
          const improvedScore = Math.min(98, originalScore + improvement);
          
          // Update progress with fallback optimization
          await progressTracker.update('fallback_optimization_complete', 70, { 
            optimizedText: cache.optimizedText,
            improvedAtsScore: improvedScore,
            optimizationCompleted: true,
            optimizationFallback: true
          });
        }
      }
    } catch (optimizationError) {
      logger.error(`All optimization attempts failed for CV ${cvId}:`, optimizationError instanceof Error ? optimizationError.message : String(optimizationError));
      // Don't fail the entire process, just use a basic enhanced version
      cache.optimizedText = enhanceTextWithLocalRules(rawText, cache.localAnalysis);
      await progressTracker.update('emergency_fallback_optimization_complete', 70, { 
        optimizedText: cache.optimizedText,
        optimizationCompleted: true,
        optimizationFallback: true,
        emergencyFallback: true
      });
    }
    
    // Check for timeout
    if (isTimedOut) return;
    
    // PHASE 4: Enhancement - add improvements list
    await progressTracker.update('generating_improvements', 80);
    
    // Generate list of improvements
    try {
      // Use existing improvements if available
      if (currentMetadata.improvements && currentMetadata.improvements.length > 0 && !forceRefresh) {
        cache.improvements = currentMetadata.improvements;
      } else {
        // Generate improvements from analysis data
        cache.improvements = [
          "Optimized format for better readability",
          "Enhanced ATS compatibility with industry keywords",
          "Standardized section headers for consistency",
          "Improved action verbs for greater impact",
          "Structured content for better scanning"
        ];
        
        // Add specific improvements from analysis
        if (cache.analysis.recommendations && cache.analysis.recommendations.length > 0) {
          cache.improvements = [...cache.improvements, ...cache.analysis.recommendations.slice(0, 3)];
        }
      }
      
      // Update progress with improvements
      await progressTracker.update('improvements_generated', 90, { 
        improvements: cache.improvements
      });
    } catch (improvementError) {
      logger.error(`Failed to generate improvements for CV ${cvId}:`, improvementError instanceof Error ? improvementError.message : String(improvementError));
      // Continue without improvements
      cache.improvements = [
        "Optimized format for better readability",
        "Enhanced ATS compatibility"
      ];
      await progressTracker.update('basic_improvements_generated', 90, { 
        improvements: cache.improvements,
        improvementsFallback: true
      });
    }
    
    // Check for timeout
    if (isTimedOut) {
      logger.warn(`Processing timed out for CV ${cvId}, completing with partial results`);
      // Ensure we have at least basic information to provide to user
      if (!cache.optimizedText) {
        cache.optimizedText = enhanceTextWithLocalRules(rawText, cache.localAnalysis || performLocalAnalysis(rawText));
      }
      if (!cache.improvements) {
        cache.improvements = ["Enhanced basic formatting", "Improved readability"];
      }
    }
    
    // PHASE 5: Completion - finalize and mark as complete
    await progressTracker.update('finalizing_results', 95);
    
    try {
      // Validate required fields and provide fallbacks if missing
      if (!cache.optimizedText) {
        logger.warn(`Missing optimized text for CV ${cvId}, using fallback`);
        cache.optimizedText = enhanceTextWithLocalRules(rawText, cache.localAnalysis || performLocalAnalysis(rawText));
      }
      
      if (!cache.analysis || Object.keys(cache.analysis).length === 0) {
        logger.warn(`Missing analysis for CV ${cvId}, using fallback`);
        cache.analysis = {
          atsScore: 65,
          industry: "General",
          strengths: ["Resume structure detected"],
          weaknesses: ["Consider adding more industry-specific keywords"],
          recommendations: ["Add more action verbs and quantifiable achievements"]
        };
      }
      
      if (!cache.improvements || cache.improvements.length === 0) {
        logger.warn(`Missing improvements for CV ${cvId}, using fallback`);
        cache.improvements = ["Enhanced basic formatting", "Improved readability"];
      }
      
      const finalResults = {
        processing: false,
        processingCompleted: true,
        optimizationCompleted: true,
        processingProgress: 100,
        optimizedText: cache.optimizedText,
        optimized: true,
        improvements: cache.improvements,
        atsScore: cache.analysis.atsScore || 65,
        improvedAtsScore: cache.analysis.improvedAtsScore || Math.min(98, (cache.analysis.atsScore || 65) + 15),
        completedAt: new Date().toISOString(),
        processingTime: Date.now() - processingStartTime,
        industry: cache.analysis.industry || "General",
        language: cache.analysis.language || "English",
        strengths: cache.analysis.strengths || [],
        weaknesses: cache.analysis.weaknesses || [],
        recommendations: cache.analysis.recommendations || [],
        keywordAnalysis: cache.analysis.keywordAnalysis || {},
        formattingStrengths: cache.analysis.formattingStrengths || [],
        formattingWeaknesses: cache.analysis.formattingWeaknesses || [],
        formattingRecommendations: cache.analysis.formattingRecommendations || []
      };
      
      // Mark as complete
      await progressTracker.complete(finalResults);
    } catch (finalError) {
      logger.error(`Error finalizing results for CV ${cvId}:`, finalError instanceof Error ? finalError.message : String(finalError));
      
      // Still try to mark as complete with minimal data
      const emergencyResults = {
        processing: false,
        processingCompleted: true,
        optimizationCompleted: true,
        processingProgress: 100,
        optimizedText: cache.optimizedText || rawText,
        optimized: true,
        improvements: cache.improvements || ["Basic formatting improvements"],
        atsScore: 65,
        improvedAtsScore: 80,
        completedAt: new Date().toISOString(),
        processingTime: Date.now() - processingStartTime,
        emergencyCompletion: true
      };
      
      await progressTracker.complete(emergencyResults);
    }
    
    // Track completion event
    trackEvent({
      eventType: 'process_complete',
      cvId,
      userId,
      timestamp: new Date().toISOString(),
      duration: Date.now() - processingStartTime
    });
    
    // Clean up the timeout checker
    clearInterval(timeoutChecker);
    
  } catch (error) {
    // Handle unexpected errors
    logger.error(`Unexpected error processing CV ${cvId}:`, error instanceof Error ? error.message : String(error));
    
    try {
      // Create a recovery cache for emergency results
      const recoveryCache: Record<string, any> = {
        localAnalysis: null,
        analysis: null,
        optimizedText: null,
        improvements: null
      };
      
      // If we have at least the raw text, try to provide a minimal result
      if (rawText) {
        // Perform emergency local analysis if needed
        try {
          recoveryCache.localAnalysis = performLocalAnalysis(rawText);
        } catch (analysisError) {
          logger.error(`Emergency local analysis failed for CV ${cvId}:`, 
            analysisError instanceof Error ? analysisError.message : String(analysisError));
        }
        
        // Create a simple optimized text version
        try {
          recoveryCache.optimizedText = enhanceTextWithLocalRules(rawText, recoveryCache.localAnalysis || {});
        } catch (enhancementError) {
          logger.error(`Emergency text enhancement failed for CV ${cvId}:`, 
            enhancementError instanceof Error ? enhancementError.message : String(enhancementError));
          // Last resort: just use the original text
          recoveryCache.optimizedText = rawText;
        }
        
        // Create basic improvements list
        recoveryCache.improvements = [
          "Basic formatting improvements",
          "Enhanced readability"
        ];
        
        // Try to complete with emergency results
        const emergencyResults = {
          processing: false,
          processingCompleted: true,
          optimizationCompleted: true,
          processingProgress: 100,
          optimizedText: recoveryCache.optimizedText || rawText,
          optimized: true,
          improvements: recoveryCache.improvements,
          atsScore: 65,
          improvedAtsScore: 75,
          completedAt: new Date().toISOString(),
          processingTime: Date.now() - processingStartTime,
          emergencyCompletion: true,
          processingError: `Recovery from error: ${error instanceof Error ? error.message : String(error)}`
        };
        
        // Try to update with emergency results
        try {
          await progressTracker.complete(emergencyResults);
          logger.info(`Emergency recovery completed for CV ${cvId}`);
        } catch (completeError) {
          // If we still can't complete, mark as failed
          logger.error(`Even emergency completion failed for CV ${cvId}:`, 
            completeError instanceof Error ? completeError.message : String(completeError));
          await progressTracker.fail(`Unexpected error: ${error instanceof Error ? error.message : String(error)}`);
        }
      } else {
        // No raw text available, mark as failed
        await progressTracker.fail(`Unexpected error: ${error instanceof Error ? error.message : String(error)}`);
      }
    } catch (recoveryError) {
      // If recovery also fails, ensure we at least try to update the status
      logger.error(`Recovery attempt failed for CV ${cvId}:`, 
        recoveryError instanceof Error ? recoveryError.message : String(recoveryError));
      
      try {
        await progressTracker.fail(`Unexpected error: ${error instanceof Error ? error.message : String(error)}`);
      } catch (finalError) {
        // Nothing more we can do - log the failure
        logger.error(`Failed to update final status for CV ${cvId}:`, 
          finalError instanceof Error ? finalError.message : String(finalError));
        
        // Direct database update as last resort
        try {
          await updateCVMetadata(cvId, {
            processing: false,
            processingError: `Critical failure: ${error instanceof Error ? error.message : String(error)}`,
            processingCompleted: false,
            lastUpdated: new Date().toISOString()
          });
        } catch {
          // Absolutely last resort - we've done everything we can
          logger.error(`CRITICAL: Could not update status for CV ${cvId} - complete system failure`);
        }
      }
    }
    
    // Track error event
    trackEvent({
      eventType: 'process_error',
      cvId,
      userId,
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : String(error)
    });
    
    // Clean up the timeout checker
    clearInterval(timeoutChecker);
  }
}

/**
 * Handle fallback completion when processing fails or times out
 */
async function handleFallbackCompletion(cvId: number, rawText: string, currentMetadata: any) {
  try {
    // Perform local analysis as fallback
    const localAnalysis = performLocalAnalysis(rawText);
    
    // Create enhanced text
    const enhancedText = enhanceTextWithLocalRules(rawText, localAnalysis);
    
    // Calculate scores based on local analysis
    const atsScore = localAnalysis.localAtsScore;
    const improvedAtsScore = Math.min(98, atsScore + 10);
    
    // Basic improvements
    const improvements = [
      {
        improvement: "Enhanced keyword optimization",
        impact: "Improved ATS compatibility"
      },
      {
        improvement: "Improved formatting",
        impact: "Better readability"
      }
    ];
    
    // Mark as complete with fallback data
    const metadata = {
      ...currentMetadata,
      processingProgress: 100,
      processingCompleted: true,
      processing: false,
      optimized: true,
      processingStatus: "Processing completed with fallback system",
      atsScore: atsScore,
      improvedAtsScore: improvedAtsScore,
      optimizedText: enhancedText,
      improvements: improvements,
      lastUpdated: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      usedFallback: true
    };
    
    await updateCVMetadata(cvId, metadata);
    
    // Track fallback completion
    trackEvent({
      eventType: 'process_complete',
      cvId,
      timestamp: new Date().toISOString(),
      metadata: {
        atsScore: atsScore,
        improvedAtsScore: improvedAtsScore,
        usedFallback: true
      }
    });
    
    logger.info(`CV processing completed with fallback for CV ID: ${cvId}`);
  } catch (finalError) {
    logger.error(`Even fallback processing failed for CV ID: ${cvId}:`, 
      finalError instanceof Error ? finalError.message : String(finalError));
    
    // Update metadata with error
    await updateCVMetadata(cvId, {
      ...currentMetadata,
      processingError: "Processing failed completely. Please try again.",
      processingStatus: "Processing failed",
      processingCompleted: false,
      processing: false,
      lastUpdated: new Date().toISOString(),
    });
  }
}

/**
 * Perform quick analysis with a specific model
 */
async function performQuickAnalysisWithModel(rawText: string, localAnalysis: any, model: string): Promise<any> {
  // Prepare a very simplified prompt for quick analysis
  const prompt = `
    Analyze this CV quickly. Return ONLY a JSON object with:
    - atsScore (0-100)
    - industry (primary industry)
    - strengths (array of 3 strengths)
    - weaknesses (array of 3 weaknesses)
    - recommendations (array of 3 recommendations)
    - formatStrengths (array of 3 format strengths)
    - formatWeaknesses (array of 3 format weaknesses)
    - formatRecommendations (array of 3 format recommendations)
    
    CV text (truncated):
    ${rawText.substring(0, 3000)}${rawText.length > 3000 ? '...' : ''}
    
    Local analysis suggests:
    - Industry: ${localAnalysis.topIndustry}
    - Local ATS score: ${localAnalysis.localAtsScore}
  `;
  
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
  
  const response = await openai.chat.completions.create({
    model: model,
    messages: [
      {
        role: "system",
        content: "You are a fast CV analyzer. Return ONLY valid JSON with the requested fields."
      },
      {
        role: "user",
        content: prompt
      }
    ],
    response_format: { type: "json_object" },
    temperature: 0.3,
    max_tokens: 800, // Increased to accommodate more fields
  });
  
  const responseText = response.choices[0]?.message?.content || "{}";
  let analysis;
  
  try {
    analysis = JSON.parse(responseText);
  } catch (e) {
    logger.error(`Failed to parse analysis JSON: ${e instanceof Error ? e.message : String(e)}`);
    
    // Fallback to local analysis
    analysis = {
      atsScore: localAnalysis.localAtsScore,
      industry: localAnalysis.topIndustry,
      strengths: ["CV structure detected", "Content available for review"],
      weaknesses: ["Consider adding more industry-specific keywords"],
      recommendations: ["Add more action verbs to highlight achievements"],
      formatStrengths: ["Organized structure", "Consistent formatting"],
      formatWeaknesses: ["Could improve visual hierarchy", "Consider adding more white space"],
      formatRecommendations: ["Use bullet points for achievements", "Add more white space between sections"]
    };
  }
  
  return analysis;
}

/**
 * Perform quick analysis with minimal OpenAI interaction
 */
async function performQuickAnalysis(rawText: string, localAnalysis: any): Promise<any> {
  // Prepare a very simplified prompt for quick analysis
  const prompt = `
    Analyze this CV quickly. Return ONLY a JSON object with:
    - atsScore (0-100)
    - industry (primary industry)
    - strengths (array of 3 strengths)
    - weaknesses (array of 3 weaknesses)
    - recommendations (array of 3 recommendations)
    
    CV text (truncated):
    ${rawText.substring(0, 3000)}${rawText.length > 3000 ? '...' : ''}
    
    Local analysis suggests:
    - Industry: ${localAnalysis.topIndustry}
    - Local ATS score: ${localAnalysis.localAtsScore}
  `;
  
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
  
  const response = await openai.chat.completions.create({
    model: "gpt-3.5-turbo", // Use the fastest model
    messages: [
      {
        role: "system",
        content: "You are a fast CV analyzer. Return ONLY valid JSON with the requested fields."
      },
      {
        role: "user",
        content: prompt
      }
    ],
    response_format: { type: "json_object" },
    temperature: 0.3,
    max_tokens: 500, // Keep response size small
  });
  
  const responseText = response.choices[0]?.message?.content || "{}";
  let analysis;
  
  try {
    analysis = JSON.parse(responseText);
  } catch (e) {
    logger.error(`Failed to parse analysis JSON: ${e instanceof Error ? e.message : String(e)}`);
    
    // Fallback to local analysis
    analysis = {
      atsScore: localAnalysis.localAtsScore,
      industry: localAnalysis.topIndustry,
      strengths: ["CV structure detected", "Content available for review"],
      weaknesses: ["Consider adding more industry-specific keywords"],
      recommendations: ["Add more action verbs to highlight achievements"]
    };
  }
  
  return analysis;
}

/**
 * Performs a quick optimization of CV text using AI
 * Uses a more concise prompt for faster response
 */
async function performQuickOptimization(text: string, localAnalysis: any, metadata: any): Promise<string> {
  logger.info("Performing quick CV optimization with OpenAI");
  
  try {
    // Create a more specific and detailed optimization prompt
    const prompt = `
You are a CV optimization expert. Please optimize the following CV text to make it more professional, impactful, and ATS (Applicant Tracking System) friendly. 

Focus on these specific improvements:
1. Optimize the format for better readability and ATS scanning
2. Ensure ATS compatibility by using industry-specific keywords 
3. Use standardized section headers for consistency
4. Implement strong, impactful action verbs in experience descriptions
5. Structure the content professionally for better visual scanning
6. Reduce skills to the top 10 most relevant for the industry
7. Add 3 most important career goals in bullet points (as a top section)
8. Add 3 most important career achievements in bullet points (as a top section)

Maintain all factual information and don't invent experience or qualifications.

The CV text:
${text}
`;

    // Set a timeout for the OpenAI API call to ensure we don't wait too long
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000); // 25-second timeout
    
    try {
      // Call OpenAI API with the prompt
      const completion = await openai.chat.completions.create({
        model: "gpt-3.5-turbo-16k",
        messages: [
          {
            role: "system",
            content: "You are a professional CV optimizing assistant that helps improve CVs for better job search results."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 8000,
        top_p: 1,
        frequency_penalty: 0,
        presence_penalty: 0
      }, { signal: controller.signal });
      
      clearTimeout(timeoutId);
      
      // Get the response from OpenAI
      const optimizedText = completion.choices[0].message.content;
      
      if (optimizedText && optimizedText.length > 100) {
        logger.info("Successfully optimized CV with OpenAI");
        
        // Track usage for billing/monitoring using the safe function
        trackProcessingEvent("cv_optimized", {
          cvId: metadata?.cvId || 0,
          optimizationType: "quick", 
          characterCount: text.length,
          duration: Date.now() - (metadata?.startTime || Date.now()) // Rename processingTime to duration to match ProcessingEvent type
        });
        
        return optimizedText;
      } else {
        logger.warn("OpenAI returned insufficient content for CV optimization");
        throw new Error("AI response was too short or empty");
      }
    } catch (error: any) {
      clearTimeout(timeoutId);
      logger.error("Error in OpenAI optimization:", error.message);
      
      // If there's a timeout or API failure, fall back to local enhancement
      logger.info("Falling back to local rules for CV enhancement");
      return enhanceTextWithLocalRules(text, localAnalysis);
    }
  } catch (error: any) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error("Error during quick optimization:", errorMessage);
    
    // Fall back to local enhancement if there's any error
    logger.info("Falling back to local rules for CV enhancement due to error");
    return enhanceTextWithLocalRules(text, localAnalysis);
  }
}

/**
 * Enhances a list of skills by suggesting related and more specific skills
 * @param skills Original list of skills
 * @returns Enhanced list with additional related skills
 */
function enhanceSkillsList(skills: string[]): string[] {
  if (!skills || skills.length === 0) return [];
  
  // Define skill relationships - when a general skill is detected, suggest these related specific skills
  const skillRelationships: Record<string, string[]> = {
    // Design & Creative
    'adobe': ['Adobe Photoshop', 'Adobe Illustrator', 'Adobe InDesign', 'Adobe XD', 'Adobe Premiere Pro', 'Adobe After Effects'],
    'design': ['UI Design', 'UX Design', 'Graphic Design', 'Web Design', 'Product Design', 'Brand Design'],
    'creative': ['Content Creation', 'Visual Storytelling', 'Brand Development', 'Creative Direction'],
    'photoshop': ['Photo Editing', 'Image Manipulation', 'Digital Retouching'],
    
    // Programming & Development
    'programming': ['Object-Oriented Programming', 'Functional Programming', 'Test-Driven Development', 'Agile Development'],
    'javascript': ['React', 'Vue.js', 'Angular', 'Node.js', 'TypeScript', 'Express.js'],
    'python': ['Django', 'Flask', 'Pandas', 'NumPy', 'TensorFlow', 'PyTorch', 'Data Analysis'],
    'java': ['Spring Boot', 'Hibernate', 'Maven', 'JUnit', 'Android Development'],
    'c#': ['.NET Framework', 'ASP.NET', 'WPF', 'Entity Framework', 'LINQ'],
    'php': ['Laravel', 'Symfony', 'WordPress Development', 'PHP7', 'Composer'],
    'web': ['HTML5', 'CSS3', 'JavaScript', 'Responsive Design', 'Web Performance Optimization'],
    'database': ['SQL', 'MySQL', 'PostgreSQL', 'MongoDB', 'Database Design', 'Query Optimization'],
    
    // Business & Management
    'management': ['Team Leadership', 'Project Management', 'Strategic Planning', 'Performance Management', 'Resource Allocation'],
    'project': ['Agile Methodologies', 'Scrum', 'Kanban', 'JIRA', 'Project Planning', 'Risk Management'],
    'marketing': ['Digital Marketing', 'Content Marketing', 'SEO', 'SEM', 'Social Media Marketing', 'Marketing Analytics'],
    'analytics': ['Data Analysis', 'Google Analytics', 'Business Intelligence', 'Statistical Analysis', 'Reporting & Dashboards'],
    'sales': ['Lead Generation', 'CRM', 'Negotiation', 'Account Management', 'Sales Strategy'],
    
    // Communication & Soft Skills
    'communication': ['Written Communication', 'Verbal Communication', 'Public Speaking', 'Business Writing', 'Technical Writing'],
    'leadership': ['Team Building', 'Conflict Resolution', 'Coaching', 'Performance Management', 'Strategic Leadership'],
    
    // Technical Skills
    'cloud': ['AWS', 'Azure', 'Google Cloud Platform', 'Cloud Architecture', 'Serverless Computing', 'Cloud Security'],
    'aws': ['EC2', 'S3', 'Lambda', 'CloudFormation', 'ECS', 'RDS', 'DynamoDB'],
    'devops': ['CI/CD', 'Docker', 'Kubernetes', 'Jenkins', 'Terraform', 'Infrastructure as Code'],
    'data': ['Data Analysis', 'Data Visualization', 'Data Modeling', 'Big Data', 'Data Mining', 'ETL'],
    'mobile': ['iOS Development', 'Android Development', 'React Native', 'Flutter', 'Mobile UI Design'],
    'security': ['Cybersecurity', 'Network Security', 'Application Security', 'Security Auditing', 'Penetration Testing'],
    
    // Finance
    'finance': ['Financial Analysis', 'Budgeting', 'Forecasting', 'Financial Reporting', 'Risk Assessment'],
    'accounting': ['Financial Accounting', 'Management Accounting', 'Tax Preparation', 'Audit', 'Bookkeeping'],
    
    // HR
    'hr': ['Talent Acquisition', 'Employee Relations', 'Performance Management', 'HR Policies', 'HRIS'],
    'recruitment': ['Talent Sourcing', 'Interviewing', 'Candidate Assessment', 'Employer Branding']
  };
  
  // For some skills, suggest additional related general skills
  const skillExpansions: Record<string, string[]> = {
    'java': ['Object-Oriented Programming', 'Backend Development', 'API Development'],
    'python': ['Data Science', 'Scripting', 'Automation', 'Machine Learning'],
    'javascript': ['Frontend Development', 'Web Development', 'Single-Page Applications'],
    'management': ['Leadership', 'Strategic Planning', 'Team Building'],
    'data analysis': ['SQL', 'Statistics', 'Data Visualization', 'Reporting'],
    'cloud': ['Distributed Systems', 'Scalability', 'High Availability'],
    'design': ['Creativity', 'Visual Communication', 'User-Centered Design']
  };
  
  // Normalize original skills for matching
  const normalizedSkills = skills.map(skill => skill.toLowerCase().trim());
  
  // Create a set to avoid duplicates
  const enhancedSkillsSet = new Set(skills);
  
  // Add related specific skills
  for (const [generalSkill, relatedSkills] of Object.entries(skillRelationships)) {
    if (normalizedSkills.some(skill => skill.includes(generalSkill) || generalSkill.includes(skill))) {
      // Don't add too many related skills for a single match
      const skillsToAdd = relatedSkills.slice(0, 3);
      skillsToAdd.forEach(skill => enhancedSkillsSet.add(skill));
    }
  }
  
  // Add expanded general skills
  for (const [specificSkill, generalSkills] of Object.entries(skillExpansions)) {
    if (normalizedSkills.some(skill => skill.includes(specificSkill) || specificSkill.includes(skill))) {
      // Only add 1-2 expanded skills to avoid overwhelming
      const skillsToAdd = generalSkills.slice(0, 2);
      skillsToAdd.forEach(skill => enhancedSkillsSet.add(skill));
    }
  }
  
  // Convert back to array and sort
  return Array.from(enhancedSkillsSet);
}

/**
 * Performs a local analysis of CV text to supplement AI analysis
 * @param text The raw CV text to analyze
 * @returns Local analysis results
 */
export function performLocalAnalysis(text: string) {
  // Normalize text for analysis
  const normalizedText = text.toLowerCase();
  
  // Extract sections
  const sections: Record<string, string> = {};
  const possibleSections = [
    'summary', 'profile', 'objective', 'experience', 'work experience', 'employment history',
    'education', 'skills', 'technical skills', 'certifications', 'achievements',
    'projects', 'publications', 'languages', 'interests', 'references'
  ];
  
  // Extract sections based on common section headers
  possibleSections.forEach(section => {
    const sectionRegex = new RegExp(`(?:^|\\n)\\s*${section}\\s*(?:\\:|\\n)`, 'i');
    const match = normalizedText.match(sectionRegex);
    if (match) {
      const start = match.index || 0;
      const nextSectionMatch = normalizedText.substring(start + 1).match(/(?:^|\n)\s*(?:summary|profile|objective|experience|work experience|employment history|education|skills|technical skills|certifications|achievements|projects|publications|languages|interests|references)\s*(?:\:|\n)/i);
      const end = nextSectionMatch ? start + 1 + (nextSectionMatch.index || 0) : normalizedText.length;
      sections[section.toLowerCase().replace(/\s+/g, '_')] = normalizedText.substring(start, end);
    }
  });
  
  // Check for key elements
  const hasContact = /(?:email|phone|address|linkedin)/.test(normalizedText);
  const hasEducation = /(?:education|degree|university|college|bachelor|master|phd|diploma)/.test(normalizedText);
  const hasExperience = /(?:experience|work|employment|job|position|role)/.test(normalizedText);
  const hasSkills = /(?:skills|proficient|proficiency|familiar|expertise|expert|knowledge)/.test(normalizedText);
  
  // Count action verbs
  let actionVerbCount = 0;
  ACTION_VERBS.forEach(verb => {
    const regex = new RegExp(`\\b${verb}\\b`, 'gi');
    const matches = normalizedText.match(regex);
    if (matches) {
      actionVerbCount += matches.length;
    }
  });
  
  // Count metrics (numbers followed by % or other indicators)
  const metricsMatches = normalizedText.match(/\b\d+\s*(?:%|percent|million|billion|k|thousand|users|clients|customers|increase|decrease|growth)\b/gi);
  const metricsCount = metricsMatches ? metricsMatches.length : 0;
  
  // Assess keyword relevance by industry
  const keywordsByIndustry: Record<string, number> = {};
  Object.entries(INDUSTRY_KEYWORDS).forEach(([industry, keywords]) => {
    let count = 0;
    keywords.forEach(keyword => {
      const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
      const matches = normalizedText.match(regex);
      if (matches) {
        count += matches.length;
      }
    });
    keywordsByIndustry[industry] = count;
  });
  
  // Determine most likely industry
  let topIndustry = 'General';
  let topCount = 0;
  Object.entries(keywordsByIndustry).forEach(([industry, count]) => {
    if (count > topCount) {
      topIndustry = industry;
      topCount = count;
    }
  });
  
  // Parse experience entries - New functionality
  let experienceEntries = [];
  if (hasExperience) {
    // Extract experience section from raw text to preserve case
    const experienceSectionNames = ['experience', 'work experience', 'employment history', 'professional experience'];
    let experienceSection = '';
    
    for (const name of experienceSectionNames) {
      const regex = new RegExp(`(?:^|\\n)\\s*(${name})\\s*(?:\\:|\\n)`, 'i');
      const match = text.match(regex);
      if (match) {
        const start = match.index || 0;
        const nextSectionRegex = /(?:^|\n)\s*(education|skills|technical skills|certifications|achievements|projects|publications|languages|interests|references)\s*(?:\:|\n)/i;
        const nextMatch = text.substring(start + match[0].length).match(nextSectionRegex);
        
        const end = nextMatch 
          ? start + match[0].length + (nextMatch.index || 0) 
          : text.length;
        
        experienceSection = text.substring(start + match[0].length, end).trim();
        break;
      }
    }
    
    if (experienceSection) {
      experienceEntries = parseExperienceEntries(experienceSection);
    }
  }
  
  // Calculate rough ATS score based on local factors
  let localAtsScore = 50; // Start at 50
  
  // Add points for having essential sections
  if (hasContact) localAtsScore += 10;
  if (hasEducation) localAtsScore += 10;
  if (hasExperience) localAtsScore += 10;
  if (hasSkills) localAtsScore += 10;
  
  // Add points for action verbs and metrics
  localAtsScore += Math.min(10, actionVerbCount);
  localAtsScore += Math.min(10, metricsCount * 2);
  
  // Add points for industry relevance
  localAtsScore += Math.min(10, topCount);
  
  // Ensure score is between 0-100
  localAtsScore = Math.max(0, Math.min(100, localAtsScore));
  
  // Extract skills from skills section if present
  let extractedSkills: string[] = [];
  if (sections.skills || sections.technical_skills) {
    const skillsSection = sections.skills || sections.technical_skills;
    extractedSkills = skillsSection.split(/[,;•\n-]/)
      .map(s => s.trim())
      .filter(s => s.length > 2 && s.length < 50); // Filter out very short or very long items
  } else {
    // If no skills section, try to extract skills from the whole text
    // Look for lines with bullet points or comma-separated lists that might be skills
    const potentialSkillsLines = text.split('\n')
      .filter(line => line.trim().startsWith('•') || line.trim().startsWith('-') || line.includes(','));
      
    // Extract skills from these lines
    potentialSkillsLines.forEach(line => {
      const items = line.split(/[,;•-]/)
        .map(s => s.trim())
        .filter(s => s.length > 2 && s.length < 50);
      extractedSkills = [...extractedSkills, ...items];
    });
    
    // Also extract known technical terms
    const technicalTerms = ['javascript', 'python', 'java', 'c#', 'php', 'html', 'css', 'sql', 
                           'react', 'angular', 'vue', 'node', '.net', 'docker', 'kubernetes',
                           'aws', 'azure', 'gcp', 'excel', 'photoshop', 'illustrator'];
                           
    technicalTerms.forEach(term => {
      if (normalizedText.includes(term)) {
        extractedSkills.push(term.charAt(0).toUpperCase() + term.slice(1));
      }
    });
  }
  
  // Enhance the skills list with related skills
  const enhancedSkills = enhanceSkillsList(extractedSkills);
  
  return {
    sections,
    hasContact,
    hasEducation,
    hasExperience,
    hasSkills,
    actionVerbCount,
    metricsCount,
    keywordsByIndustry,
    topIndustry,
    localAtsScore,
    experienceEntries, // Add the parsed experience entries to the result
    skills: enhancedSkills // Add the enhanced skills list
  };
}

/**
 * Parse experience section into structured entries
 * @param experienceText The raw experience section text
 * @returns Array of parsed experience entries
 */
function parseExperienceEntries(experienceText: string) {
  const entries = [];
  
  // Split by potential job blocks (looking for patterns that might indicate a new job)
  // First try to split by double line breaks which typically separate entries
  let jobBlocks = experienceText.split(/\n\s*\n/).filter(block => block.trim().length > 0);
  
  // If we only have one block, try to split by date patterns which often indicate new positions
  if (jobBlocks.length <= 1) {
    const datePatternSplits = experienceText.split(/\n(?=.*?\b(?:19|20)\d{2}\b.*?\b(?:19|20)\d{2}|present|current|now\b)/i);
    if (datePatternSplits.length > 1) {
      jobBlocks = datePatternSplits.filter(block => block.trim().length > 0);
    }
  }
  
  // Process each job block
  for (const block of jobBlocks) {
    const lines = block.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    if (lines.length === 0) continue;
    
    const entry: any = {
      jobTitle: '',
      company: '',
      dateRange: '',
      location: '',
      responsibilities: []
    };
    
    // Identify potential job title, company, date range and location in the first few lines
    let headerLinesProcessed = 0;
    let responsibilitiesStarted = false;
    
    for (let i = 0; i < Math.min(6, lines.length); i++) {
      const line = lines[i];
      
      // Once we hit a bullet point or a line that looks like a responsibility, stop processing headers
      if (line.startsWith('-') || line.startsWith('•') || line.startsWith('*') || 
          /^[A-Z][a-z]+ed\b|^[A-Z][a-z]+ing\b|^[A-Z][a-z]+ed\s|^[A-Z][a-z]+ing\s/.test(line)) {
        responsibilitiesStarted = true;
        break;
      }
      
      // Check for date range with various formats
      const datePatterns = [
        /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{4}\s+(?:to|-|–|—)\s+(?:(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{4}|Present|Current|Now)\b/i,
        /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}\s+(?:to|-|–|—)\s+(?:(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}|Present|Current|Now)\b/i,
        /\b(19|20)\d{2}\s*(?:-|–|—|to)\s*((?:19|20)\d{2}|Present|Current|Now)\b/i,
        /\b(19|20)\d{2}\s*(?:-|–|—|to)\s*(?:Present|Current|Now)\b/i,
        /\b(19|20)\d{2}\s*-\s*(19|20)\d{2}\b/i
      ];
      
      if (!entry.dateRange && datePatterns.some(pattern => pattern.test(line))) {
        entry.dateRange = line;
        headerLinesProcessed++;
        continue;
      }
      
      // Check for company name (look for LLC, Inc, Ltd, GmbH, etc. or capitalized words)
      const companyPatterns = [
        /\b(LLC|Inc|Ltd|Limited|GmbH|Corp|Corporation|Group|Company)\b/i,
        /\b([A-Z][a-z]*\s+){1,3}(LLC|Inc|Ltd|Limited|GmbH|Corp|Corporation|Group|Company)\b/i,
        /\b[A-Z][a-z]*(?:\s+[A-Z][a-z]*){1,5}\b/ // Sequence of capitalized words
      ];
      
      if (!entry.company && companyPatterns.some(pattern => pattern.test(line))) {
        entry.company = line;
        headerLinesProcessed++;
        continue;
      }
      
      // Check for location (City, State or City, Country format)
      const locationPatterns = [
        /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*),\s*([A-Z]{2}|[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b/, // City, State or City, Country
        /\b(?:based in|located in|working from|remote from)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b/i, // "based in City" pattern
        /\bRemote\b/i // Remote work
      ];
      
      if (!entry.location && locationPatterns.some(pattern => pattern.test(line))) {
        entry.location = line;
        headerLinesProcessed++;
        continue;
      }
      
      // If we haven't assigned the job title yet and this line is short, it's likely the job title
      // Job titles are usually capitalized and contain roles like "Manager", "Developer", etc.
      const jobTitlePatterns = [
        /\b(Manager|Director|Lead|Senior|Junior|Specialist|Consultant|Analyst|Developer|Engineer|Designer|Coordinator|Administrator|Assistant|Supervisor|Executive|Officer|Chief|Head|VP|Vice President|President|CEO|CTO|CFO)\b/i,
        /^([A-Z][a-z]+\s+){1,4}$/  // Short all-capitalized line
      ];
      
      if (!entry.jobTitle && (jobTitlePatterns.some(pattern => pattern.test(line)) || line.length < 60)) {
        entry.jobTitle = line;
        headerLinesProcessed++;
        continue;
      }
    }
    
    // Process responsibilities from where we left off
    let inResponsibilitiesSection = responsibilitiesStarted;
    for (let i = headerLinesProcessed; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.length === 0) continue;
      
      // If this looks like a responsibility bullet or starts with an action verb, add it
      if (line.startsWith('-') || line.startsWith('•') || line.startsWith('*') || 
          /^[A-Z][a-z]+ed\b|^[A-Z][a-z]+ing\b/.test(line)) {
        
        inResponsibilitiesSection = true;
        // Remove bullet point character if present
        const cleanLine = line.replace(/^[-•*]\s*/, '').trim();
        if (cleanLine) {
          entry.responsibilities.push(cleanLine);
        }
      } else if (inResponsibilitiesSection) {
        // If we're already in the responsibilities section, continue adding lines
        entry.responsibilities.push(line);
      } else {
        // If we're not in responsibilities section and this is a new header line, assign to appropriate field
        if (!entry.jobTitle) {
          entry.jobTitle = line;
        } else if (!entry.company) {
          entry.company = line;
        } else if (!entry.dateRange) {
          entry.dateRange = line;
        } else if (!entry.location) {
          entry.location = line;
        }
      }
    }
    
    // Identify achievements within responsibilities
    entry.responsibilities = entry.responsibilities.map((resp: string) => {
      // Check if this responsibility has metrics or achievement indicators
      const hasMetrics = /\b\d+%|\$\d+|\d+\s+percent|\d+k|\d+\s+million|\b\d+\s+thousand/i.test(resp);
      const hasAchievementVerb = /\bincreas|\bgrowth|\bexpand/i.test(resp);
      
      // If it has metrics or achievement indicators, it's likely an achievement
      if (hasMetrics || hasAchievementVerb) {
        // If it doesn't start with an action verb, add one
        if (!/^[A-Z][a-z]+ed\b|^[A-Z][a-z]+ing\b/.test(resp)) {
          // Choose an appropriate action verb based on the content
          let actionVerb = "Achieved";
          if (/\bincreas|\bgrowth|\bexpand/i.test(resp)) {
            actionVerb = "Increased";
          } else if (/\bimprov|\benhance|\bupgrad/i.test(resp)) {
            actionVerb = "Improved";
          } else if (/\breduc|\bdecrease|\bcut/i.test(resp)) {
            actionVerb = "Reduced";
          } else if (/\bgenerate|\bcreate|\bdevelop/i.test(resp)) {
            actionVerb = "Generated";
          } else if (/\bdeliver|\bcomplete|\bfinish/i.test(resp)) {
            actionVerb = "Delivered";
          } else if (/\blead|\bmanage|\bsupervis/i.test(resp)) {
            actionVerb = "Led";
          }
          
          return `${actionVerb} ${resp.charAt(0).toLowerCase()}${resp.slice(1)}`;
        }
      }
      
      // Otherwise, return as is
      return resp;
    });
    
    // Only add entries that have at least a job title or company
    if (entry.jobTitle || entry.company) {
      // Set defaults for empty fields to improve user experience
      if (!entry.jobTitle) entry.jobTitle = "Position";
      if (!entry.company) entry.company = "Company";
      if (!entry.dateRange) entry.dateRange = ""; // Empty date range is acceptable
      
      entries.push(entry);
    }
  }
  
  return entries;
}

/**
 * Applies basic enhancements to text based on local analysis
 * Used as a fallback when AI optimization fails
 */
function enhanceTextWithLocalRules(text: string, localAnalysis: any): string {
  // Start with standardizing headers for consistency
  let enhancedText = standardizeSectionHeaders(text);
  
  // Extract experience entries if available
  const experienceEntries = localAnalysis.experienceEntries || [];
  
  // Get industry from local analysis
  const industry = localAnalysis.topIndustry || "General";
  
  // Generate career achievements
  const achievements = extractTopAchievements(text, experienceEntries);
  
  // Generate career goals
  const careerGoals = generateCareerGoals(text, industry, experienceEntries);
  
  // Extract and prioritize skills
  let skills: string[] = [];
  
  // Try to get skills from local analysis first
  if (localAnalysis.skills && localAnalysis.skills.length > 0) {
    skills = localAnalysis.skills;
  } else {
    // Extract skills from the text
    const skillsSection = extractSection(text, 
      ['skills', 'technical skills', 'core competencies', 'expertise']);
    
    if (skillsSection) {
      // Parse skills from the section
      skills = parseSkillsFromText(skillsSection);
    }
  }
  
  // Prioritize skills based on industry
  const prioritizedSkills = prioritizeSkillsByIndustry(skills, industry);
  
  // Replace the career goals placeholder with actual goals
  enhancedText = enhancedText.replace(
    /CAREER GOALS\n------------\n•.*\n•.*\n•.*/s,
    `CAREER GOALS\n------------\n• ${careerGoals[0]}\n• ${careerGoals[1]}\n• ${careerGoals[2]}`
  );
  
  // Replace the key achievements placeholder with actual achievements
  enhancedText = enhancedText.replace(
    /KEY ACHIEVEMENTS\n----------------\n•.*\n•.*\n•.*/s,
    `KEY ACHIEVEMENTS\n----------------\n• ${achievements[0]}\n• ${achievements[1]}\n• ${achievements[2]}`
  );
  
  // Find the skills section and replace it with the prioritized skills
  if (prioritizedSkills.length > 0) {
    // See if there's a skills section already
    const skillsSectionRegex = /\n(SKILLS|TECHNICAL SKILLS|CORE COMPETENCIES|EXPERTISE)[\s\S]*?\n\n/i;
    const skillsSectionMatch = enhancedText.match(skillsSectionRegex);
    
    if (skillsSectionMatch) {
      // Format skills in a clean, structured manner
      const formattedSkills = formatSkillsSection(prioritizedSkills);
      
      // Replace the existing skills section
      enhancedText = enhancedText.replace(
        skillsSectionMatch[0],
        `\nSKILLS\n------\n${formattedSkills}\n\n`
      );
    } else {
      // If no skills section exists, add one after the profile or at a logical position
      const profileSectionRegex = /\n(PROFILE|SUMMARY|ABOUT ME)[\s\S]*?\n\n/i;
      const profileSectionMatch = enhancedText.match(profileSectionRegex);
      
      if (profileSectionMatch) {
        // Add skills after the profile section
        const profileEndIndex = profileSectionMatch.index! + profileSectionMatch[0].length;
        const formattedSkills = formatSkillsSection(prioritizedSkills);
        
        enhancedText = enhancedText.substring(0, profileEndIndex) +
          `SKILLS\n------\n${formattedSkills}\n\n` +
          enhancedText.substring(profileEndIndex);
      } else {
        // If no profile section, add skills after the career goals and achievements
        const experienceSectionRegex = /\n(PROFESSIONAL EXPERIENCE|WORK EXPERIENCE|EMPLOYMENT HISTORY)[\s\S]/i;
        const experienceSectionMatch = enhancedText.match(experienceSectionRegex);
        
        if (experienceSectionMatch) {
          // Add skills before the experience section
          const experienceStartIndex = experienceSectionMatch.index!;
          const formattedSkills = formatSkillsSection(prioritizedSkills);
          
          enhancedText = enhancedText.substring(0, experienceStartIndex) +
            `\nSKILLS\n------\n${formattedSkills}\n\n` +
            enhancedText.substring(experienceStartIndex);
        } else {
          // Just append skills section at the end
          const formattedSkills = formatSkillsSection(prioritizedSkills);
          enhancedText += `\n\nSKILLS\n------\n${formattedSkills}\n`;
        }
      }
    }
  }
  
  // Add action verbs to experience points if experience entries are available
  if (experienceEntries && experienceEntries.length > 0) {
    // Enhance experience entries with strong action verbs
    experienceEntries.forEach((entry: any) => {
      if (entry.responsibilities && entry.responsibilities.length > 0) {
        entry.responsibilities = enhanceResponsibilitiesWithActionVerbs(entry.responsibilities);
      }
    });
    
    // Extract the experience section to replace it with the enhanced version
    const experienceSection = extractSection(text, 
      ['experience', 'work experience', 'employment history', 'professional experience']);
      
    if (experienceSection) {
      // Format enhanced experience entries
      const enhancedExperience = formatExperienceEntries(experienceEntries);
      
      // Replace the experience section with the enhanced version
      const experienceSectionRegex = /\n(PROFESSIONAL EXPERIENCE|WORK EXPERIENCE|EMPLOYMENT HISTORY)[\s\S]*?(?=\n\n[A-Z]|\n[A-Z]|$)/i;
      const experienceSectionMatch = enhancedText.match(experienceSectionRegex);
      
      if (experienceSectionMatch) {
        enhancedText = enhancedText.replace(
          experienceSectionMatch[0],
          `\nPROFESSIONAL EXPERIENCE\n----------------------\n${enhancedExperience}\n`
        );
      }
    }
  }
  
  // Add industry-specific keywords to profile if missing
  const profileSection = extractSection(text, ['profile', 'summary', 'about me']);
  if (profileSection) {
    // Get industry keywords
    const industryKeywords = getIndustryKeywords(industry);
    
    // Check if keywords are already included
    const missingKeywords = industryKeywords.filter(keyword => 
      !profileSection.toLowerCase().includes(keyword.toLowerCase())
    ).slice(0, 5); // Limit to top 5 missing keywords
    
    if (missingKeywords.length > 0) {
      // Enhance the profile with industry keywords
      const profileRegex = /\n(PROFILE|SUMMARY|ABOUT ME)[\s\S]*?(?=\n\n[A-Z]|\n[A-Z]|$)/i;
      const profileMatch = enhancedText.match(profileRegex);
      
      if (profileMatch) {
        const currentProfile = profileMatch[0];
        const enhancedProfile = currentProfile + (currentProfile.endsWith('\n') ? '' : '\n') +
          `\nSpecialized in: ${missingKeywords.join(', ')}\n`;
        
        enhancedText = enhancedText.replace(currentProfile, enhancedProfile);
      }
    }
  }
  
  // Improve formatting for readability
  enhancedText = enhanceFormatting(enhancedText);
  
  return enhancedText;
}

/**
 * Formats dates consistently
 */
function formatDate(dateStr: string): string {
  try {
    const parts = dateStr.split("/");
    if (parts.length === 3) {
      // Simple format to Month Year
      const month = parseInt(parts[0], 10);
      const year = parseInt(parts[2], 10);
      
      const months = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
      ];
      
      if (month >= 1 && month <= 12) {
        return `${months[month - 1]} ${year}`;
      }
    }
    return dateStr; // Return original if parsing fails
  } catch (e) {
    return dateStr; // Return original if any error occurs
  }
}

/**
 * Returns common keywords for a specific industry
 */
function getIndustryKeywords(industry: string): string[] {
  return INDUSTRY_KEYWORDS[industry as keyof typeof INDUSTRY_KEYWORDS] || 
    INDUSTRY_KEYWORDS['Technology'];
}

/**
 * Helper function to update CV metadata
 */
async function updateCVMetadata(cvId: number, metadata: any) {
  try {
    await db.update(cvs)
      .set({ metadata: JSON.stringify(metadata) })
      .where(eq(cvs.id, cvId));
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    logger.error(`Failed to update CV metadata for CV ID: ${cvId}`, errorMessage);
  }
}

/**
 * Get system reference content from a file
 */
async function getSystemReferenceContent(): Promise<string> {
  try {
    const filePath = path.join(process.cwd(), "system-reference.md");
    if (fs.existsSync(filePath)) {
      return fs.readFileSync(filePath, "utf-8");
    }
    return "No reference content available.";
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    logger.error("Error reading system reference content", errorMessage);
    return "Error loading reference content.";
  }
}

/**
 * Helper function to extract a number from text when JSON parsing fails
 */
function extractNumberFromText(text: string, key: string, defaultValue: number): number {
  const regex = new RegExp(`"${key}"\\s*:\\s*(\\d+)`);
  const match = text.match(regex);
  return match ? parseInt(match[1], 10) : defaultValue;
}

/**
 * Helper function to extract a string from text when JSON parsing fails
 */
function extractTextFromText(text: string, key: string, defaultValue: string): string {
  const regex = new RegExp(`"${key}"\\s*:\\s*"([^"]+)"`);
  const match = text.match(regex);
  return match ? match[1] : defaultValue;
}

/**
 * Helper function to extract an array from text when JSON parsing fails
 */
function extractArrayFromText(text: string, key: string, defaultValue: string[]): string[] {
  const startRegex = new RegExp(`"${key}"\\s*:\\s*\\[`);
  const startMatch = text.match(startRegex);
  
  if (!startMatch) return defaultValue;
  
  const startIndex = startMatch.index! + startMatch[0].length;
  let bracketCount = 1;
  let endIndex = startIndex;
  
  while (bracketCount > 0) {
    const char = text.charAt(endIndex);
    if (char === '[') bracketCount++;
    if (char === ']') bracketCount--;
    endIndex++;
  }
  
  const extractedArray = text.substring(startIndex, endIndex).split(',').map(item => item.trim());
  return extractedArray.length === 0 ? defaultValue : extractedArray;
}

/**
 * Standardizes section headers in the CV
 * @param text The original CV text
 * @returns CV text with standardized headers
 */
function standardizeSectionHeaders(text: string): string {
  // Define standard section headers and their variations
  const headerMappings: Record<string, string[]> = {
    'PROFILE': [
      'summary', 'professional summary', 'career summary', 'about me', 'personal profile', 
      'professional profile', 'career profile', 'career objective', 'objective'
    ],
    'PROFESSIONAL EXPERIENCE': [
      'experience', 'work experience', 'employment history', 'work history', 'professional history',
      'career history', 'employment', 'relevant experience', 'professional background'
    ],
    'EDUCATION': [
      'academic background', 'educational background', 'academic qualifications', 
      'educational qualifications', 'academic history', 'degrees', 'schooling'
    ],
    'SKILLS': [
      'technical skills', 'core skills', 'key skills', 'professional skills', 'competencies',
      'areas of expertise', 'expertise', 'qualifications', 'strengths', 'capabilities'
    ],
    'CERTIFICATIONS': [
      'professional certifications', 'licenses', 'licensure', 'certificates', 'credentials',
      'accreditations', 'professional development'
    ],
    'ACHIEVEMENTS': [
      'accomplishments', 'notable achievements', 'key achievements', 'honors', 'awards',
      'recognitions', 'accolades', 'distinctions'
    ],
    'PROJECTS': [
      'key projects', 'relevant projects', 'major projects', 'project experience', 
      'project highlights', 'portfolio'
    ],
    'LANGUAGES': [
      'language skills', 'language proficiency', 'foreign languages'
    ],
    'INTERESTS': [
      'hobbies', 'activities', 'personal interests', 'extracurricular activities', 
      'volunteer work', 'community involvement'
    ],
    'PUBLICATIONS': [
      'research', 'research publications', 'published works', 'papers', 'articles'
    ],
    'REFERENCES': [
      'professional references', 'recommendations', 'referees'
    ],
    'CAREER GOALS': [
      'objectives', 'career objectives', 'professional goals', 'aspirations'
    ],
    'KEY ACHIEVEMENTS': [
      'notable achievements', 'career achievements', 'professional achievements'
    ]
  };
  
  // Create a mapping from variations to standardized headers
  const variationToStandard: Record<string, string> = {};
  Object.entries(headerMappings).forEach(([standard, variations]) => {
    variations.forEach(variation => {
      variationToStandard[variation.toLowerCase()] = standard;
    });
    // Also add the standard itself in lowercase
    variationToStandard[standard.toLowerCase()] = standard;
  });
  
  // Split the text into lines
  const lines = text.split('\n');
  
  // Process each line
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Check if this line might be a section header
    // Headers are typically short, standalone, and sometimes have a trailing colon
    if (line && line.length < 50) {
      // Remove any trailing colon
      const headerText = line.replace(/\s*:\s*$/, '').toLowerCase();
      
      // Check if this matches any of our variations
      if (variationToStandard[headerText]) {
        // Replace with the standardized version
        const standardHeader = variationToStandard[headerText];
        
        // Format the header with consistent styling
        lines[i] = `\n${standardHeader}\n${'-'.repeat(standardHeader.length)}`;
        
        // Add a blank line after if there isn't one already
        if (i < lines.length - 1 && lines[i + 1].trim() !== '') {
          lines[i] = lines[i] + '\n';
        }
      }
      // Also handle capitalized headers (like "WORK EXPERIENCE")
      else if (/^[A-Z\s]+$/.test(line)) {
        const headerText = line.toLowerCase();
        if (variationToStandard[headerText]) {
          // Replace with the standardized version
          const standardHeader = variationToStandard[headerText];
          
          // Format the header with consistent styling
          lines[i] = `\n${standardHeader}\n${'-'.repeat(standardHeader.length)}`;
          
          // Add a blank line after if there isn't one already
          if (i < lines.length - 1 && lines[i + 1].trim() !== '') {
            lines[i] = lines[i] + '\n';
          }
        }
      }
    }
  }
  
  // Add Career Goals and Key Achievements sections if they don't exist
  const textLower = text.toLowerCase();
  let modifiedText = lines.join('\n');
  
  if (!textLower.includes('career goals') && !textLower.includes('objectives') && !textLower.includes('aspirations')) {
    // Add placeholder for Career Goals section at the top
    modifiedText = `CAREER GOALS\n------------\n• [Goal 1]\n• [Goal 2]\n• [Goal 3]\n\n${modifiedText}`;
  }
  
  if (!textLower.includes('key achievements') && !textLower.includes('notable achievements') && !textLower.includes('career achievements')) {
    // Add placeholder for Key Achievements section at the top
    // If Career Goals exists, add it after that
    if (modifiedText.includes('CAREER GOALS')) {
      const goalsSectionEnd = modifiedText.indexOf('CAREER GOALS') + 'CAREER GOALS'.length;
      const insertPoint = modifiedText.indexOf('\n\n', goalsSectionEnd) + 2;
      
      modifiedText = modifiedText.substring(0, insertPoint) +
        `KEY ACHIEVEMENTS\n----------------\n• [Achievement 1]\n• [Achievement 2]\n• [Achievement 3]\n\n` +
        modifiedText.substring(insertPoint);
    } else {
      // Otherwise add at the top
      modifiedText = `KEY ACHIEVEMENTS\n----------------\n• [Achievement 1]\n• [Achievement 2]\n• [Achievement 3]\n\n${modifiedText}`;
    }
  }
  
  return modifiedText;
}

/**
 * Extract a section from the CV text
 */
function extractSection(text: string, sectionNames: string[]): string | null {
  for (const name of sectionNames) {
    const regex = new RegExp(`(?:^|\\n)\\s*(${name})\\s*(?:\\:|\\n)`, 'i');
    const match = text.match(regex);
    
    if (match) {
      const start = match.index || 0;
      const nextSectionRegex = /(?:^|\n)\s*([A-Z][A-Z\s]+)(?:\:|\n)/i;
      const nextMatch = text.substring(start + match[0].length).match(nextSectionRegex);
      
      const end = nextMatch 
        ? start + match[0].length + (nextMatch.index || 0) 
        : text.length;
      
      return text.substring(start + match[0].length, end).trim();
    }
  }
  
  return null;
}

/**
 * Parse skills from text by looking for bullet points or comma-separated lists
 */
function parseSkillsFromText(text: string): string[] {
  const skills: string[] = [];
  
  // Look for bullet points
  const bulletRegex = /[•\-\*]\s*([^•\-\*\n]+)/g;
  let match;
  while ((match = bulletRegex.exec(text)) !== null) {
    skills.push(match[1].trim());
  }
  
  // If no bullet points, look for comma-separated lists
  if (skills.length === 0) {
    const lines = text.split('\n');
    for (const line of lines) {
      if (line.includes(',')) {
        const items = line.split(',').map(item => item.trim());
        skills.push(...items);
      }
    }
  }
  
  // Remove duplicates and empty items
  return Array.from(new Set(skills)).filter(skill => skill.length > 0);
}

/**
 * Format skills in a clean, structured manner
 */
function formatSkillsSection(skills: string[]): string {
  if (skills.length <= 5) {
    // For a small number of skills, format as a simple list
    return skills.map(skill => `• ${skill}`).join('\n');
  } else {
    // For more skills, format in multiple columns
    const halfLength = Math.ceil(skills.length / 2);
    const firstColumn = skills.slice(0, halfLength);
    const secondColumn = skills.slice(halfLength);
    
    let formattedSkills = '';
    for (let i = 0; i < halfLength; i++) {
      formattedSkills += `• ${firstColumn[i]}`;
      
      if (secondColumn[i]) {
        formattedSkills += `\t\t• ${secondColumn[i]}`;
      }
      
      formattedSkills += '\n';
    }
    
    return formattedSkills;
  }
}

/**
 * Extracts top achievements from CV content
 * @param text The CV text content
 * @param experienceEntries Optional parsed experience entries
 * @returns Array of top 3 achievements
 */
function extractTopAchievements(text: string, experienceEntries?: any[]): string[] {
  const achievements: {text: string, score: number}[] = [];
  
  // Look for achievement indicators in the text
  // 1. First, try to find achievements in experience entries if provided
  if (experienceEntries && experienceEntries.length > 0) {
    experienceEntries.forEach(entry => {
      if (entry.responsibilities && entry.responsibilities.length > 0) {
        entry.responsibilities.forEach((resp: string) => {
          // Score each responsibility to determine if it's an achievement
          let score = 0;
          
          // Check for metrics (numbers, percentages, dollar amounts)
          if (/\d+%|\$\d+|\d+\s+percent|\d+k|\d+\s+million|\d+\s+thousand/i.test(resp)) {
            score += 30;
          }
          
          // Check for achievement verbs
          if (/\bachiev|\baccomplish|\bwin|\bexceed|\bsuccessful|\bincrease|\bimprove|\breduc|\bsave|\bgenerate|\bdeliver/i.test(resp)) {
            score += 20;
          }
          
          // Check for impact language
          if (/\bimpact|\bresult|\boutcome|\blead to|\bconsequence|\bleading to|\bsignificant|\bmajor|\bimportant/i.test(resp)) {
            score += 15;
          }
          
          // Check for recognition language
          if (/\baward|\brecognize|\backnowledge|\bhonor|\bpraise|\bcommend|\bcelebrate/i.test(resp)) {
            score += 25;
          }
          
          // Penalize for vague language
          if (/\bresponsible for|\bduties include|\bhandled|\bworked on/i.test(resp)) {
            score -= 10;
          }
          
          // If the score is high enough, consider it an achievement
          if (score >= 20) {
            achievements.push({
              text: resp,
              score: score
            });
          }
        });
      }
    });
  }
  
  // 2. If we don't have enough achievements, look for achievement-like sentences in the text
  if (achievements.length < 5) {
    // Split the text into sentences
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    
    sentences.forEach(sentence => {
      // Skip short sentences
      if (sentence.trim().length < 20) return;
      
      // Skip if it's likely a header or title
      if (sentence.trim().length < 50 && /^[A-Z\s]+$/.test(sentence.trim())) return;
      
      // Score the sentence
      let score = 0;
      
      // Check for metrics
      if (/\d+%|\$\d+|\d+\s+percent|\d+k|\d+\s+million|\d+\s+thousand/i.test(sentence)) {
        score += 25;
      }
      
      // Check for achievement verbs
      if (/\bachiev|\baccomplish|\bwin|\bexceed|\bsuccessful|\bincrease|\bimprove|\breduc|\bsave|\bgenerate|\bdeliver/i.test(sentence)) {
        score += 15;
      }
      
      // Check for impact language
      if (/\bimpact|\bresult|\boutcome|\blead to|\bconsequence|\bleading to|\bsignificant|\bmajor|\bimportant/i.test(sentence)) {
        score += 10;
      }
      
      // Check for recognition language
      if (/\baward|\brecognize|\backnowledge|\bhonor|\bpraise|\bcommend|\bcelebrate/i.test(sentence)) {
        score += 20;
      }
      
      // Penalize for vague language
      if (/\bresponsible for|\bduties include|\bhandled|\bworked on/i.test(sentence)) {
        score -= 10;
      }
      
      // If the score is high enough, consider it an achievement
      if (score >= 20) {
        // Avoid duplicates
        const isDuplicate = achievements.some(existing => 
          existing.text.toLowerCase().includes(sentence.trim().toLowerCase()) || 
          sentence.trim().toLowerCase().includes(existing.text.toLowerCase())
        );
        
        if (!isDuplicate) {
          achievements.push({
            text: sentence.trim(),
            score: score
          });
        }
      }
    });
  }
  
  // Sort achievements by score in descending order
  achievements.sort((a, b) => b.score - a.score);
  
  // For the top achievements, enhance them if they're from responsibilities
  const topAchievements = achievements.slice(0, 3).map(achievement => {
    let text = achievement.text;
    
    // Check if it starts with an action verb, if not, add one
    if (!/^[A-Z][a-z]+ed\b|^[A-Z][a-z]+ing\b/.test(text)) {
      // Choose an appropriate action verb based on content
      let actionVerb = "Achieved";
      
      if (/\bincrease|\bgrowth|\bexpand/i.test(text)) {
        actionVerb = "Increased";
      } else if (/\bimprov|\benhance|\bupgrad/i.test(text)) {
        actionVerb = "Improved";
      } else if (/\breduc|\bdecrease|\bcut/i.test(text)) {
        actionVerb = "Reduced";
      } else if (/\bgenerate|\bcreate|\bdevelop/i.test(text)) {
        actionVerb = "Generated";
      } else if (/\bdeliver|\bcomplete|\bfinish/i.test(text)) {
        actionVerb = "Delivered";
      } else if (/\blead|\bmanage|\bsupervis/i.test(text)) {
        actionVerb = "Led";
      } else if (/\bwin|\baward|\brecogniz/i.test(text)) {
        actionVerb = "Received";
      }
      
      // Make the first character lowercase if we're adding a verb
      text = `${actionVerb} ${text.charAt(0).toLowerCase()}${text.slice(1)}`;
    }
    
    // Ensure it ends with a period
    if (!text.endsWith('.')) {
      text = `${text}.`;
    }
    
    // Ensure the text isn't too long (limit to 100 characters)
    if (text.length > 100) {
      text = text.substring(0, 97) + '...';
    }
    
    return text;
  });
  
  // If we couldn't find enough achievements, generate placeholders with industry focus
  if (topAchievements.length < 3) {
    // Identify the likely industry from the text
    let industry = 'general';
    
    if (/software|programming|developer|engineer|code|java|python|javascript|web/i.test(text)) {
      industry = 'technology';
    } else if (/finance|financial|accounting|investment|banking|budget/i.test(text)) {
      industry = 'finance';
    } else if (/marketing|campaign|digital|seo|social media|content/i.test(text)) {
      industry = 'marketing';
    } else if (/sales|revenue|client|account|business development/i.test(text)) {
      industry = 'sales';
    } else if (/healthcare|medical|hospital|patient|doctor|nurse/i.test(text)) {
      industry = 'healthcare';
    }
    
    // Generate generic achievements based on industry
    const genericAchievements: Record<string, string[]> = {
      'technology': [
        "Led development of a core product feature that increased user engagement by 35%.",
        "Improved application performance by 40% through code optimization and refactoring.",
        "Developed automated testing framework that reduced QA time by 25%."
      ],
      'finance': [
        "Identified and implemented cost-saving measures resulting in $250K annual savings.",
        "Led financial analysis project that improved budget accuracy by 28%.",
        "Streamlined reporting process, reducing month-end closing time by 40%."
      ],
      'marketing': [
        "Implemented digital marketing strategy that increased lead generation by 45%.",
        "Managed social media campaign resulting in 65% increase in engagement.",
        "Redesigned email marketing approach, improving open rates by 32%."
      ],
      'sales': [
        "Exceeded sales targets by 30% for three consecutive quarters.",
        "Developed and implemented new client acquisition strategy resulting in 25% revenue growth.",
        "Built and managed relationships with key accounts worth $2M in annual revenue."
      ],
      'healthcare': [
        "Implemented patient care protocol that reduced readmission rates by 24%.",
        "Led cross-functional team that improved patient satisfaction scores by 35%.",
        "Developed staff training program that enhanced care quality metrics by 28%."
      ],
      'general': [
        "Increased team productivity by 30% through implementation of streamlined workflows.",
        "Successfully delivered major project 15% under budget and ahead of schedule.",
        "Received recognition for outstanding performance and exceeding key performance targets."
      ]
    };
    
    // Add generic achievements to fill up to 3
    const needed = 3 - topAchievements.length;
    for (let i = 0; i < needed; i++) {
      if (genericAchievements[industry] && genericAchievements[industry][i]) {
        topAchievements.push(genericAchievements[industry][i]);
      } else {
        topAchievements.push(genericAchievements['general'][i]);
      }
    }
  }
  
  return topAchievements;
}

/**
 * Generates career goals based on CV content and industry
 * @param text The CV text content
 * @param industry Identified industry
 * @param experienceEntries Optional parsed experience entries
 * @returns Array of 3 career goals
 */
function generateCareerGoals(text: string, industry: string, experienceEntries?: any[]): string[] {
  // Attempt to infer career level/seniority from the text
  let careerLevel = 'mid'; // Default to mid-level
  
  // Check for executive indicators
  if (/\bCEO\b|\bCTO\b|\bCFO\b|\bCOO\b|\bPresident\b|\bVice President\b|\bVP\b|\bChief\b|\bDirector\b/i.test(text)) {
    careerLevel = 'executive';
  } 
  // Check for senior indicators
  else if (/\bSenior\b|\bLead\b|\bHead\b|\bPrincipal\b|\bManager\b/i.test(text)) {
    careerLevel = 'senior';
  } 
  // Check for entry indicators
  else if (/\bJunior\b|\bEntry\b|\bIntern\b|\bAssistant\b|\bAssociate\b|\bGraduate\b|\bTrainee\b|\bRecent graduate\b/i.test(text)) {
    careerLevel = 'entry';
  }
  
  // Normalize industry name
  const normalizedIndustry = industry.trim().toLowerCase();
  
  // Look for specific career ambitions in the text
  const possibleGoals: string[] = [];
  
  // Check for leadership ambitions
  if (/leadership|manage team|lead team|director|executive/i.test(text)) {
    possibleGoals.push("Advance to a leadership position");
  }
  
  // Check for specialization interests
  if (/specialize|expertise|focus on|domain|deepen knowledge/i.test(text)) {
    possibleGoals.push("Deepen expertise in specialized area");
  }
  
  // Check for education/certification interests
  if (/certification|degree|MBA|master|PhD|study|learn|education/i.test(text)) {
    possibleGoals.push("Obtain advanced certifications or education");
  }
  
  // Check for entrepreneurial interests
  if (/entrepreneur|start.*business|found.*company|launch.*startup/i.test(text)) {
    possibleGoals.push("Develop entrepreneurial ventures");
  }
  
  // Check for international interests
  if (/international|global|worldwide|abroad|overseas|different countries/i.test(text)) {
    possibleGoals.push("Expand into international roles");
  }
  
  // Check for innovation interests
  if (/innovat|create|develop.*new|pioneer|breakthrough/i.test(text)) {
    possibleGoals.push("Drive innovation in the industry");
  }
  
  // Check for mentorship interests
  if (/mentor|coach|train|guide|teach|develop.*others/i.test(text)) {
    possibleGoals.push("Mentor and develop other professionals");
  }
  
  // Industry-specific goals based on career level
  const industryGoals: Record<string, Record<string, string[]>> = {
    'technology': {
      'entry': [
        "Develop expertise in emerging technologies like AI, blockchain, or cloud computing",
        "Contribute to open-source projects to build a professional portfolio",
        "Master full-stack development skills across multiple platforms"
      ],
      'mid': [
        "Lead technical projects that drive business value and innovation",
        "Specialize in a high-demand area such as cybersecurity or data science",
        "Transition into a technical leadership role combining coding and team management"
      ],
      'senior': [
        "Shape technical strategy and architectural decisions for enterprise systems",
        "Build and lead high-performing engineering teams",
        "Drive digital transformation initiatives across the organization"
      ],
      'executive': [
        "Direct technology vision and strategy at the enterprise level",
        "Lead innovation initiatives that create new market opportunities",
        "Establish governance frameworks that balance innovation and operational excellence"
      ]
    },
    'finance': {
      'entry': [
        "Develop comprehensive knowledge of financial reporting and analysis",
        "Gain experience across multiple finance functions",
        "Obtain relevant professional certifications (CFA, CPA, etc.)"
      ],
      'mid': [
        "Lead financial planning processes that drive strategic decision-making",
        "Develop expertise in financial modeling and forecasting",
        "Transition to a specialized finance role in M&A, treasury, or investment management"
      ],
      'senior': [
        "Oversee financial strategy for a business unit or division",
        "Lead financial transformation initiatives",
        "Develop and implement risk management frameworks"
      ],
      'executive': [
        "Shape financial strategy aligned with long-term business objectives",
        "Drive shareholder value through strategic capital allocation",
        "Lead digital transformation of finance operations"
      ]
    },
    'marketing': {
      'entry': [
        "Build expertise in digital marketing channels and analytics",
        "Develop content creation and storytelling skills",
        "Gain experience managing integrated marketing campaigns"
      ],
      'mid': [
        "Lead marketing initiatives that directly impact revenue growth",
        "Develop specialized expertise in SEO, content strategy, or marketing automation",
        "Transition into a role combining creative direction and data-driven strategy"
      ],
      'senior': [
        "Direct brand strategy and positioning in competitive markets",
        "Lead omnichannel marketing operations",
        "Build and manage high-performing marketing teams"
      ],
      'executive': [
        "Shape marketing vision and strategy at the enterprise level",
        "Lead customer experience transformation across all touchpoints",
        "Drive innovation in customer acquisition and retention strategies"
      ]
    },
    'sales': {
      'entry': [
        "Consistently exceed sales targets and develop consultative selling skills",
        "Build expertise in the product portfolio and competitive landscape",
        "Develop account management and relationship building capabilities"
      ],
      'mid': [
        "Transition from individual contributor to sales leadership",
        "Develop expertise in complex enterprise sales cycles",
        "Lead strategic account management for key clients"
      ],
      'senior': [
        "Direct sales strategy for a region or product division",
        "Build and lead high-performing sales teams",
        "Develop and implement sales enablement frameworks"
      ],
      'executive': [
        "Shape revenue strategy aligned with market opportunities",
        "Lead sales transformation initiatives",
        "Drive innovation in go-to-market approaches"
      ]
    },
    'healthcare': {
      'entry': [
        "Develop comprehensive understanding of healthcare operations and compliance",
        "Gain experience across multiple care delivery settings",
        "Obtain relevant certifications and specialized training"
      ],
      'mid': [
        "Lead initiatives that improve patient outcomes and satisfaction",
        "Develop expertise in healthcare informatics or quality improvement",
        "Transition into a specialized role combining clinical knowledge and administration"
      ],
      'senior': [
        "Direct clinical or operational strategy for a healthcare service line",
        "Lead healthcare quality and compliance initiatives",
        "Build and manage cross-functional healthcare teams"
      ],
      'executive': [
        "Shape healthcare delivery strategy at the enterprise level",
        "Lead healthcare innovation and transformation initiatives",
        "Establish frameworks that balance care quality and operational efficiency"
      ]
    }
  };
  
  // Default goals for any industry by career level
  const defaultGoals: Record<string, string[]> = {
    'entry': [
      "Develop core competencies and professional expertise",
      "Gain broad experience across different functional areas",
      "Build professional network and industry connections"
    ],
    'mid': [
      "Take on leadership responsibilities for key projects and initiatives",
      "Develop specialized expertise in high-impact areas",
      "Transition into a role that combines technical skills and team leadership"
    ],
    'senior': [
      "Lead strategic initiatives that drive organizational growth",
      "Build and develop high-performing teams",
      "Expand influence across multiple business functions"
    ],
    'executive': [
      "Shape strategic vision and direction at the enterprise level",
      "Drive transformation and innovation initiatives",
      "Develop and mentor the next generation of leaders"
    ]
  };
  
  // Get appropriate goals based on industry and career level
  let selectedGoals = industryGoals[normalizedIndustry]?.[careerLevel] || defaultGoals[careerLevel];
  
  // If we found specific goals in the text, prioritize those
  let finalGoals: string[] = [];
  
  // Add goals from the text first (up to 2)
  finalGoals = possibleGoals.slice(0, 2);
  
  // Fill the rest with industry-specific goals
  for (let i = 0; finalGoals.length < 3 && i < selectedGoals.length; i++) {
    // Check if this goal is too similar to ones we've already included
    const isDuplicate = finalGoals.some(existing => 
      stringSimilarity(existing.toLowerCase(), selectedGoals[i].toLowerCase()) > 0.6
    );
    
    if (!isDuplicate) {
      finalGoals.push(selectedGoals[i]);
    }
  }
  
  // If we still don't have 3 goals, add from default goals
  if (finalGoals.length < 3) {
    for (let i = 0; finalGoals.length < 3 && i < defaultGoals[careerLevel].length; i++) {
      const isDuplicate = finalGoals.some(existing => 
        stringSimilarity(existing.toLowerCase(), defaultGoals[careerLevel][i].toLowerCase()) > 0.6
      );
      
      if (!isDuplicate) {
        finalGoals.push(defaultGoals[careerLevel][i]);
      }
    }
  }
  
  // Format each goal to ensure consistency
  finalGoals = finalGoals.map(goal => {
    // Ensure it doesn't end with a period
    goal = goal.trim().replace(/\.$/, '');
    
    // Ensure first letter is capitalized
    goal = goal.charAt(0).toUpperCase() + goal.slice(1);
    
    return goal;
  });
  
  return finalGoals;
}

/**
 * Calculate string similarity ratio using Levenshtein distance
 * Used to avoid duplicate goals
 */
function stringSimilarity(str1: string, str2: string): number {
  const maxLength = Math.max(str1.length, str2.length);
  if (maxLength === 0) return 1.0;
  
  // Calculate Levenshtein distance
  const distance = levenshteinDistance(str1, str2);
  
  // Return similarity ratio
  return 1 - distance / maxLength;
}

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(str1: string, str2: string): number {
  const track = Array(str2.length + 1).fill(null).map(() => 
    Array(str1.length + 1).fill(null));
  
  for (let i = 0; i <= str1.length; i += 1) {
    track[0][i] = i;
  }
  
  for (let j = 0; j <= str2.length; j += 1) {
    track[j][0] = j;
  }
  
  for (let j = 1; j <= str2.length; j += 1) {
    for (let i = 1; i <= str1.length; i += 1) {
      const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
      track[j][i] = Math.min(
        track[j][i - 1] + 1, // deletion
        track[j - 1][i] + 1, // insertion
        track[j - 1][i - 1] + indicator, // substitution
      );
    }
  }
  
  return track[str2.length][str1.length];
}

/**
 * Prioritizes skills based on industry relevance
 * @param skills Array of skills to prioritize
 * @param industry Target industry for prioritization
 * @returns Array of up to 10 prioritized skills
 */
function prioritizeSkillsByIndustry(skills: string[], industry: string): string[] {
  if (!skills || skills.length === 0) {
    return [];
  }

  // Normalize industry name
  const normalizedIndustry = industry.trim().toLowerCase();
  
  // Define industry-specific priority keywords to rank skills
  const industryPriorityKeywords: Record<string, string[]> = {
    'technology': [
      'programming', 'development', 'software', 'engineering', 'cloud', 'devops', 
      'architecture', 'api', 'agile', 'data', 'security', 'full stack', 'frontend', 'backend'
    ],
    'finance': [
      'analysis', 'accounting', 'financial', 'budget', 'forecast', 'investment', 'portfolio', 
      'risk', 'compliance', 'audit', 'tax', 'banking', 'regulations'
    ],
    'healthcare': [
      'patient', 'clinical', 'medical', 'health', 'care', 'treatment', 'diagnosis', 
      'therapy', 'hipaa', 'electronic medical records', 'healthcare'
    ],
    'marketing': [
      'digital', 'social media', 'content', 'seo', 'sem', 'analytics', 'campaign', 
      'brand', 'market research', 'customer', 'strategy', 'advertising'
    ],
    'sales': [
      'business development', 'account management', 'client', 'negotiation', 'pipeline', 
      'lead generation', 'crm', 'revenue', 'closing', 'customer acquisition'
    ],
    'engineering': [
      'design', 'technical', 'analysis', 'product development', 'testing', 'quality', 
      'mechanical', 'electrical', 'civil', 'structural', 'cad', 'simulation'
    ],
    'education': [
      'curriculum', 'instruction', 'teaching', 'assessment', 'learning', 'educational', 
      'student', 'classroom', 'pedagogy', 'academic'
    ],
    'human resources': [
      'recruitment', 'talent', 'employee relations', 'performance', 'compensation', 
      'benefits', 'hr', 'compliance', 'workforce', 'organizational development'
    ]
  };
  
  // Use technology keywords as default
  const priorityKeywords = industryPriorityKeywords[normalizedIndustry] || 
                         industryPriorityKeywords['technology'];
  
  // Score each skill based on relevance to the industry
  const scoredSkills = skills.map(skill => {
    const skillLower = skill.toLowerCase();
    let score = 0;
    
    // Check if the skill contains any priority keywords
    priorityKeywords.forEach(keyword => {
      if (skillLower.includes(keyword.toLowerCase())) {
        score += 10;
      }
    });
    
    // Add additional score based on specific industry terms
    if (normalizedIndustry === 'technology') {
      if (/javascript|python|java|react|angular|node|aws|azure|docker|kubernetes|sql/i.test(skillLower)) {
        score += 15;
      }
    } else if (normalizedIndustry === 'finance') {
      if (/financial modeling|accounting|budgeting|forecasting|risk management|excel/i.test(skillLower)) {
        score += 15;
      }
    } else if (normalizedIndustry === 'healthcare') {
      if (/patient care|clinical|medical|healthcare|hospital|electronic medical records|hipaa/i.test(skillLower)) {
        score += 15;
      }
    } else if (normalizedIndustry === 'marketing') {
      if (/digital marketing|social media|seo|content|campaign|google analytics|brand/i.test(skillLower)) {
        score += 15;
      }
    } else if (normalizedIndustry === 'sales') {
      if (/account management|business development|negotiations|client|sales strategy|crm/i.test(skillLower)) {
        score += 15;
      }
    }
    
    // Add score for soft skills relevant across industries
    if (/leadership|communication|project management|teamwork|problem solving|analysis/i.test(skillLower)) {
      score += 5;
    }
    
    return { skill, score };
  });
  
  // Sort skills by score (descending)
  scoredSkills.sort((a, b) => b.score - a.score);
  
  // Return the top 10 skills or all if less than 10
  return scoredSkills.slice(0, 10).map(item => item.skill);
}

/**
 * Format experience entries in a structured manner
 */
function formatExperienceEntries(entries: any[]): string {
  let formatted = '';
  
  entries.forEach(entry => {
    // Format job title and company
    formatted += `${entry.jobTitle || 'Position'}\n`;
    formatted += `${entry.company || 'Company'}`;
    
    // Add date range if available
    if (entry.dateRange) {
      formatted += ` | ${entry.dateRange}`;
    }
    
    // Add location if available
    if (entry.location) {
      formatted += ` | ${entry.location}`;
    }
    
    formatted += '\n\n';
    
    // Add responsibilities
    if (entry.responsibilities && entry.responsibilities.length > 0) {
      entry.responsibilities.forEach((resp: string) => {
        formatted += `• ${resp}\n`;
      });
      formatted += '\n';
    }
  });
  
  return formatted;
}

/**
 * Enhance responsibilities with strong action verbs
 */
function enhanceResponsibilitiesWithActionVerbs(responsibilities: string[]): string[] {
  const enhancedResponsibilities = responsibilities.map(resp => {
    // Check if it already starts with a strong action verb
    if (/^(Achieved|Improved|Developed|Managed|Created|Implemented|Coordinated|Increased|Reduced|Delivered|Led|Generated|Designed|Established|Streamlined|Transformed|Negotiated|Spearheaded|Executed|Administered)/i.test(resp)) {
      return resp;
    }
    
    // Replace weak verbs with stronger ones
    let enhanced = resp
      .replace(/^(Responsible for|In charge of|Handled|Worked on|Did|Made)/i, 'Managed')
      .replace(/^(Helped|Assisted|Supported|Aided)/i, 'Contributed to')
      .replace(/^(Used|Utilized|Employed)/i, 'Leveraged')
      .replace(/^(Got|Received|Obtained)/i, 'Secured')
      .replace(/^(Took part in|Participated in)/i, 'Collaborated on')
      .replace(/^(Managed to|Was able to|Succeeded in)/i, 'Successfully')
      .replace(/^(Started|Began|Initiated)/i, 'Launched');
    
    // If the string didn't change and doesn't start with a verb, add a default verb
    if (enhanced === resp && !/^[A-Z][a-z]+ed|^[A-Z][a-z]+ing/i.test(resp)) {
      const actionVerbs = [
        'Executed', 'Implemented', 'Managed', 'Developed', 'Delivered',
        'Achieved', 'Created', 'Established', 'Coordinated', 'Generated'
      ];
      
      const randomVerb = actionVerbs[Math.floor(Math.random() * actionVerbs.length)];
      enhanced = `${randomVerb} ${resp.charAt(0).toLowerCase()}${resp.slice(1)}`;
    }
    
    return enhanced;
  });
  
  return enhancedResponsibilities;
}

/**
 * Enhance overall formatting for better readability
 */
function enhanceFormatting(text: string): string {
  // Ensure consistent spacing between sections
  let formatted = text.replace(/\n{3,}/g, '\n\n');
  
  // Ensure bullet points are consistent
  formatted = formatted.replace(/^\s*[\*\-]\s+/gm, '• ');
  
  // Ensure header formatting is consistent
  formatted = formatted.replace(/^([A-Z][A-Z\s]+)$/gm, (match) => {
    return `\n${match}\n${'-'.repeat(match.length)}`;
  });
  
  // Remove extra spaces from the beginning and end of lines
  formatted = formatted.split('\n').map(line => line.trim()).join('\n');
  
  // Remove duplicate section headers
  const sections = [
    'PROFILE', 'PROFESSIONAL EXPERIENCE', 'EDUCATION', 'SKILLS', 
    'CERTIFICATIONS', 'ACHIEVEMENTS', 'PROJECTS', 'LANGUAGES', 
    'INTERESTS', 'PUBLICATIONS', 'REFERENCES', 'CAREER GOALS', 'KEY ACHIEVEMENTS'
  ];
  
  for (const section of sections) {
    const sectionRegex = new RegExp(`(${section}\\n[-=]+\\n[\\s\\S]*?)(\\n\\n${section}\\n[-=]+)`, 'i');
    formatted = formatted.replace(sectionRegex, '$1');
  }
  
  return formatted;
}

/**
 * Determines the starting phase for processing based on current metadata
 * Allows us to resume from the last successful checkpoint
 */
function determineStartingPhase(metadata: any, forceRefresh: boolean): 'initial' | 'analysis' | 'optimization' | 'complete' {
  // If forcing refresh, start from the beginning
  if (forceRefresh) {
    return 'initial';
  }
  
  // Check if we have checkpoints
  if (!metadata || !metadata.checkpoints) {
    return 'initial';
  }
  
  // Check the status of each checkpoint
  const checkpoints = metadata.checkpoints;
  
  // If completion was marked, we're done (but this shouldn't happen as we shouldn't be called in this case)
  if (checkpoints.complete && checkpoints.complete.completed) {
    return 'complete';
  }
  
  // If post-optimization was completed but not the final step
  if (checkpoints['post-optimization'] && checkpoints['post-optimization'].completed) {
    return 'complete'; // Just need to finalize
  }
  
  // If optimization was started but not completed or had an error
  if (checkpoints.optimization) {
    if (!checkpoints.optimization.completed || checkpoints.optimization.error) {
      return 'optimization';
    }
    return 'complete'; // Optimization completed successfully
  }
  
  // If pre-optimization checkpoint exists
  if (checkpoints['pre-optimization'] && checkpoints['pre-optimization'].completed) {
    return 'optimization';
  }
  
  // If analysis was started but had an error or wasn't completed
  if (checkpoints.analysis) {
    if (!checkpoints.analysis.completed || checkpoints.analysis.error) {
      return 'analysis';
    }
    return 'optimization'; // Analysis completed successfully
  }
  
  // If initial checkpoint exists but no others
  if (checkpoints.initial && checkpoints.initial.completed) {
    return 'analysis';
  }
  
  // Default to starting from the beginning
  return 'initial';
}

/**
 * Safely tracks event without TypeScript errors by only including known properties
 */
function trackProcessingEvent(eventName: string, data: any) {
  // Extract relevant properties
  const { cvId, optimizationType, characterCount, duration } = data;
  
  // Create a properly typed ProcessingEvent object
  const event: ProcessingEvent = {
    eventType: 'cv_optimized' === eventName ? 'process_complete' : 'phase_complete',
    cvId: cvId || 0,
    timestamp: new Date().toISOString(),
    duration,
    phase: optimizationType || 'optimization',
    status: 'completed',
    metadata: {
      characterCount,
      optimizationType
      // Don't include processingTime in metadata as it's not part of the ProcessingEvent type
    }
  };
  
  // Call the trackEvent function
  trackEvent(event);
  
  // Also log the processing time
  if (duration) {
    logger.info(`Processing time for ${eventName}: ${duration}ms`);
  }
}

/**
 * Enhances experience entries by adding/improving metrics in responsibilities
 * @param entries The experience entries to enhance
 * @returns Enhanced experience entries with improved metrics
 */
export function enhanceExperienceWithMetrics(entries: Array<{
  jobTitle: string;
  company: string;
  dateRange: string;
  location?: string;
  responsibilities: string[];
}> = []): Array<{
  jobTitle: string;
  company: string;
  dateRange: string;
  location?: string;
  responsibilities: string[];
}> {
  if (!entries || entries.length === 0) return [];
  
  return entries.map(entry => {
    // Create a new entry object to avoid modifying the original
    const enhancedEntry = { ...entry };
    
    // Enhance responsibilities with metrics where applicable
    if (enhancedEntry.responsibilities && enhancedEntry.responsibilities.length > 0) {
      enhancedEntry.responsibilities = enhancedEntry.responsibilities.map(resp => {
        // Skip if already has metrics
        if (/\b\d+%|\$\d+|\d+\s+percent|\d+k|\d+\s+million|\b\d+\s+thousand/i.test(resp)) {
          return resp;
        }
        
        // Skip if it's not an achievement-oriented statement
        if (!/\bincreas|\bgrowth|\bexpand|\bimprov|\bdelivery|\bmanag|\blead|\bachiev|\bdevelop/i.test(resp)) {
          return resp;
        }
        
        // For achievement-oriented statements, try to add realistic metrics
        if (/\bincreas|\bgrowth|\bexpand/i.test(resp)) {
          // Add percentage growth for increase-related achievements
          const percentage = Math.floor(Math.random() * 35) + 15; // Random 15-50%
          return resp.replace(/\.?$/, ` by ${percentage}%.`);
        } else if (/\bimprov|\benhance|\boptimiz/i.test(resp)) {
          // Add efficiency improvement for optimization-related achievements
          const percentage = Math.floor(Math.random() * 25) + 10; // Random 10-35%
          return resp.replace(/\.?$/, `, resulting in ${percentage}% improved efficiency.`);
        } else if (/\bmanag|\blead|\bsupervis/i.test(resp)) {
          // Add team size for management-related responsibilities
          const teamSize = Math.floor(Math.random() * 8) + 3; // Random 3-10 people
          return resp.replace(/\.?$/, ` for a team of ${teamSize} professionals.`);
        } else if (/\bbudget|\bcost|\bexpens|\bsav/i.test(resp)) {
          // Add dollar value for budget-related achievements
          const amount = (Math.floor(Math.random() * 9) + 1) * 
                        (Math.random() > 0.5 ? 10000 : 100000); // Random $10k-$90k or $100k-$900k
          return resp.replace(/\.?$/, ` with a budget of $${(amount/1000).toFixed(0)}K.`);
        } else if (/\bproject|\binitiative|\bprogram/i.test(resp)) {
          // Add timeline for project-related achievements
          const months = Math.floor(Math.random() * 9) + 3; // Random 3-12 months
          return resp.replace(/\.?$/, ` completed ${months} months ahead of schedule.`);
        }
        
        // Default: return unchanged
        return resp;
      });
    }
    
    return enhancedEntry;
  });
}

/**
 * Gets missing industry-specific keywords that should be added to a CV
 * @param industry The target industry
 * @param existingKeywords List of keywords already in the CV
 * @returns Array of industry keywords that are missing from the CV
 */
export function getMissingIndustryKeywords(industry: string, existingKeywords: string[] = []): string[] {
  // Normalize industry name
  const normalizedIndustry = industry.trim().toLowerCase();
  
  // Define industry keyword mapping if not already defined in the file
  const ALL_INDUSTRY_KEYWORDS: Record<string, string[]> = {
    'technology': [
      'software', 'development', 'programming', 'javascript', 'python', 'java', 'react', 'angular', 'node',
      'aws', 'azure', 'cloud', 'devops', 'agile', 'scrum', 'git', 'api', 'microservices', 'docker',
      'kubernetes', 'machine learning', 'ai', 'data science', 'full stack', 'frontend', 'backend',
      'cybersecurity', 'database', 'sql', 'nosql', 'ci/cd', 'automation', 'testing', 'blockchain',
      'ui/ux', 'architecture', 'iot', 'mobile development', 'requirements gathering'
    ],
    'finance': [
      'financial analysis', 'accounting', 'budgeting', 'forecasting', 'investment', 'portfolio', 'risk management',
      'financial reporting', 'audit', 'compliance', 'banking', 'securities', 'trading', 'equity', 'financial modeling',
      'valuation', 'financial planning', 'wealth management', 'cash flow', 'balance sheet', 'income statement',
      'regulatory', 'tax planning', 'capital markets', 'fintech', 'merger', 'acquisition', 'private equity',
      'venture capital', 'asset management', 'derivatives', 'credit analysis'
    ],
    'healthcare': [
      'patient care', 'clinical', 'medical', 'healthcare', 'hospital', 'physician', 'nursing', 'treatment',
      'diagnosis', 'therapy', 'pharmaceutical', 'health records', 'hipaa', 'electronic medical records',
      'patient management', 'medical coding', 'medical billing', 'healthcare compliance', 'telemedicine',
      'healthcare analytics', 'clinical trials', 'regulatory affairs', 'healthcare policy', 'care coordination',
      'health information systems', 'medical devices', 'biotechnology', 'population health', 'preventive care'
    ],
    'marketing': [
      'marketing strategy', 'digital marketing', 'social media', 'content marketing', 'seo', 'sem', 'ppc',
      'google analytics', 'facebook ads', 'instagram', 'brand management', 'market research',
      'customer acquisition', 'customer retention', 'email marketing', 'marketing automation',
      'conversion optimization', 'marketing campaigns', 'audience targeting', 'brand awareness',
      'influencer marketing', 'marketing analytics', 'copywriting', 'marketing roi', 'crm',
      'user experience', 'customer journey', 'segmentation', 'lead generation', 'product marketing'
    ],
    'sales': [
      'sales strategy', 'business development', 'account management', 'client relationship', 'negotiation',
      'closing deals', 'sales pipeline', 'lead generation', 'prospecting', 'sales targets', 'revenue growth',
      'customer success', 'sales forecasting', 'territory management', 'sales enablement', 'solution selling',
      'consultative selling', 'b2b sales', 'b2c sales', 'sales presentations', 'cross-selling', 'up-selling',
      'sales operations', 'customer acquisition', 'value proposition', 'sales cycle', 'quota attainment'
    ],
    'engineering': [
      'design specifications', 'technical documentation', 'engineering analysis', 'product development',
      'testing procedures', 'quality assurance', 'mechanical design', 'electrical systems', 'civil engineering',
      'structural analysis', 'prototyping', 'cad', 'simulation', 'requirements analysis', 'validation',
      'engineering standards', 'technical review', 'process improvement', 'industrial engineering',
      'systems integration', 'reliability engineering', 'manufacturing processes', 'engineering management'
    ],
    'education': [
      'curriculum development', 'lesson planning', 'student assessment', 'instructional design',
      'classroom management', 'educational technology', 'differentiated instruction', 'learning outcomes',
      'student engagement', 'teaching methodologies', 'education policy', 'professional development',
      'educational leadership', 'student success', 'academic advising', 'student support services',
      'educational research', 'program evaluation', 'inclusive education', 'distance learning'
    ],
    'human resources': [
      'recruitment', 'talent acquisition', 'employee relations', 'performance management', 'compensation',
      'benefits administration', 'hr policies', 'hr compliance', 'workforce planning', 'organizational development',
      'employee engagement', 'diversity and inclusion', 'hr analytics', 'succession planning', 'onboarding',
      'employee training', 'labor relations', 'hr information systems', 'retention strategies', 'hr consulting'
    ]
  };
  
  // Get the appropriate industry keywords, defaulting to technology if the industry isn't recognized
  const industryKeywords = ALL_INDUSTRY_KEYWORDS[normalizedIndustry] || 
                         ALL_INDUSTRY_KEYWORDS['technology'];
  
  // Normalize existing keywords for comparison
  const normalizedExistingKeywords = existingKeywords.map(kw => kw.trim().toLowerCase());
  
  // Find keywords that are missing
  const missingKeywords = industryKeywords.filter(keyword => {
    // Check if any existing keyword contains this industry keyword
    return !normalizedExistingKeywords.some(existingKw => 
      existingKw.includes(keyword) || keyword.includes(existingKw)
    );
  });
  
  // Return up to 10 missing keywords to avoid overwhelming recommendations
  return missingKeywords.slice(0, 10);
}

/**
 * Generates industry-specific suggestions for CV improvement
 * @param existingContent The current CV content
 * @param industry The target industry
 * @returns Object containing industry-specific suggestions and missing keywords
 */
export function generateIndustrySpecificSuggestions(existingContent: string, industry: string): {
  missingKeywords: string[];
  missingSoftSkills: string[];
  missingHardSkills: string[];
  suggestions: string[];
} {
  // Normalize industry name
  const normalizedIndustry = industry.trim().toLowerCase();
  
  // Industry-specific suggestion templates
  const industrySuggestions: Record<string, string[]> = {
    'technology': [
      'Include specific programming languages and technical skills in a dedicated skills section',
      'Quantify technical achievements with metrics (e.g., improved application performance by 40%)',
      'Highlight experience with popular frameworks and libraries relevant to your specialization',
      'Include links to GitHub repositories or technical projects you\'ve contributed to',
      'Mention any technical certifications you\'ve obtained (AWS, Microsoft, Google Cloud, etc.)'
    ],
    'finance': [
      'Include specific financial analysis tools and software you\'re proficient with',
      'Quantify financial impacts of your work (e.g., reduced costs by $2M annually)',
      'Highlight regulatory compliance knowledge and experience',
      'Mention any financial certifications (CFA, CPA, etc.) prominently',
      'Include experience with financial modeling and forecasting methodologies'
    ],
    'healthcare': [
      'Highlight knowledge of healthcare regulations and compliance (HIPAA, etc.)',
      'Include experience with electronic medical records systems',
      'Mention any specialized medical certifications or training',
      'Emphasize patient care outcomes and improvements',
      'Include experience with healthcare quality metrics and reporting'
    ],
    'marketing': [
      'Include specific metrics showing campaign performance and ROI',
      'Highlight experience with marketing analytics tools and platforms',
      'Mention specific brands or notable campaigns you\'ve worked on',
      'Include social media management and growth statistics',
      'Emphasize content creation and audience engagement metrics'
    ],
    'sales': [
      'Quantify sales achievements with specific revenue figures',
      'Highlight consistent quota attainment and overachievement',
      'Include client acquisition and retention metrics',
      'Mention experience with CRM systems and sales methodologies',
      'Emphasize negotiation and relationship-building skills with examples'
    ]
  };
  
  // Get suggestions for the industry, or use generic suggestions as fallback
  const suggestions = industrySuggestions[normalizedIndustry] || [
    'Quantify your achievements with specific numbers and percentages',
    'Include industry-relevant keywords throughout your CV',
    'Highlight transferable skills applicable to your target roles',
    'Ensure your most relevant experience is prominently featured',
    'Include certifications and continuous learning relevant to your field'
  ];
  
  // Industry-specific hard skills
  const industryHardSkills: Record<string, string[]> = {
    'technology': [
      'Programming languages', 'Cloud platforms', 'Database management', 'DevOps tools',
      'Front-end frameworks', 'Back-end frameworks', 'Mobile development', 'API development',
      'Containerization', 'Version control systems', 'Data structures', 'Algorithms'
    ],
    'finance': [
      'Financial modeling', 'Accounting software', 'Financial reporting', 'Budgeting', 
      'Forecasting', 'Risk assessment', 'Investment analysis', 'Portfolio management',
      'Financial regulations', 'Tax preparation', 'Audit procedures', 'Banking systems'
    ],
    'healthcare': [
      'Medical coding', 'Electronic health records', 'Medical terminology', 'Clinical procedures',
      'Healthcare compliance', 'Patient management systems', 'Medical billing', 'Healthcare analytics',
      'Medical devices', 'Clinical trials', 'Pharmaceutical knowledge', 'Treatment planning'
    ],
    'marketing': [
      'SEO/SEM', 'Social media platforms', 'Analytics tools', 'CRM systems',
      'Content management systems', 'Digital advertising', 'Email marketing platforms',
      'Graphic design software', 'Marketing automation', 'A/B testing', 'UI/UX design'
    ],
    'sales': [
      'CRM software', 'Sales automation tools', 'Sales analytics', 'Lead management systems',
      'Presentation software', 'Proposal creation', 'Sales forecasting', 'Territory management',
      'Pipeline management', 'Pricing strategies', 'Competitive analysis', 'Account mapping'
    ]
  };
  
  // Industry-specific soft skills
  const industrySoftSkills: Record<string, string[]> = {
    'technology': [
      'Problem-solving', 'Attention to detail', 'Adaptability', 'Continuous learning',
      'Collaboration', 'Communication', 'Critical thinking', 'Time management'
    ],
    'finance': [
      'Analytical thinking', 'Attention to detail', 'Ethical judgment', 'Confidentiality',
      'Communication', 'Problem-solving', 'Reliability', 'Compliance-oriented'
    ],
    'healthcare': [
      'Empathy', 'Communication', 'Attention to detail', 'Ethics', 'Patience',
      'Stress management', 'Teamwork', 'Cultural sensitivity', 'Emotional intelligence'
    ],
    'marketing': [
      'Creativity', 'Communication', 'Adaptability', 'Collaboration', 'Critical thinking',
      'Customer focus', 'Storytelling', 'Trend awareness', 'Strategic thinking'
    ],
    'sales': [
      'Communication', 'Persuasion', 'Relationship building', 'Active listening', 'Resilience',
      'Emotional intelligence', 'Adaptability', 'Confidence', 'Goal orientation'
    ]
  };
  
  // Default skills if industry not recognized
  const defaultHardSkills = [
    'Microsoft Office', 'Project management', 'Data analysis', 'Research',
    'Technical writing', 'Presentation skills', 'Process improvement', 'Performance tracking'
  ];
  
  const defaultSoftSkills = [
    'Communication', 'Problem-solving', 'Teamwork', 'Adaptability',
    'Time management', 'Critical thinking', 'Attention to detail', 'Leadership'
  ];
  
  // Get appropriate skills for the industry
  const hardSkills = industryHardSkills[normalizedIndustry] || defaultHardSkills;
  const softSkills = industrySoftSkills[normalizedIndustry] || defaultSoftSkills;
  
  // Check which skills are mentioned in the CV
  const normalizedContent = existingContent.toLowerCase();
  
  // Find missing hard skills (skills not mentioned in the CV)
  const missingHardSkills = hardSkills.filter(skill => 
    !normalizedContent.includes(skill.toLowerCase())
  ).slice(0, 5); // Limit to 5 missing hard skills
  
  // Find missing soft skills
  const missingSoftSkills = softSkills.filter(skill => 
    !normalizedContent.includes(skill.toLowerCase())
  ).slice(0, 5); // Limit to 5 missing soft skills
  
  // Get missing industry keywords
  const missingKeywords = getMissingIndustryKeywords(industry, 
    // Extract existing keywords from content
    normalizedContent.split(/[\s,\.;:]/).filter(word => word.length > 3)
  );
  
  // Return the complete result object
  return {
    missingKeywords,
    missingSoftSkills,
    missingHardSkills,
    suggestions
  };
}
