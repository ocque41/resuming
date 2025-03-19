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
  trackOpenAICall 
} from "@/lib/utils/analytics";
import {
  getVariantForUser,
  recordExperimentResult
} from "@/lib/utils/abTesting";
import { ensureModelWarmedUp } from './warmupCache';
import { shouldProcessInParallel, processInParallel } from './parallelProcessor';
import { MistralRAGService } from './mistralRagService';

// Define industry-specific keywords for local analysis
const INDUSTRY_KEYWORDS: Record<string, string[]> = {
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

// Action verbs that indicate achievements
const ACTION_VERBS = [
  'achieved', 'improved', 'increased', 'reduced', 'developed', 'implemented', 'created', 'managed',
  'led', 'designed', 'launched', 'delivered', 'generated', 'negotiated', 'secured', 'streamlined'
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
  try {
    // Track the overall processing start time
    const processingStartTime = Date.now();
    
    // Set initial processing status
    let updatedMetadata = {
      ...currentMetadata,
      processing: true,
      processingStartTime: new Date().toISOString(),
      processingStatus: 'starting',
      processingProgress: 5, // Start at 5% to show immediate progress
      lastUpdated: new Date().toISOString()
    };
    
    // Update CV metadata with initial status
    await updateCVMetadata(cvId, updatedMetadata);
    
    // Track the processing start event
    trackEvent({
      eventType: 'process_start',
      cvId,
      userId,
      timestamp: new Date().toISOString()
    });
    
    // Helper function to update progress
    const updateProgress = async (status: string, progress: number) => {
      logger.info(`Updating progress: ${status} (${progress}%)`);
      
      updatedMetadata = {
        ...updatedMetadata,
        processingStatus: status,
        processingProgress: progress,
        lastUpdated: new Date().toISOString()
      };
      
      await updateCVMetadata(cvId, updatedMetadata);
    };
    
    // Determine starting phase based on metadata and force refresh flag
    const determineStartingPhase = (metadata: any, forceRefresh: boolean): 'initial' | 'analysis' | 'optimization' | 'complete' => {
      if (forceRefresh) {
        return 'initial';
      }
      
      if (metadata.processingCompleted || metadata.optimized) {
        return 'complete';
      }
      
      if (metadata.analysis && metadata.atsScore) {
        return 'optimization';
      }
      
      return 'initial';
    };
    
    // Get existing analysis if available
    const getExistingAnalysis = async (cvId: number) => {
      try {
        const cv = await db.query.cvs.findFirst({
          where: eq(cvs.id, cvId)
        });
        
        if (cv && cv.metadata) {
          const metadata = JSON.parse(cv.metadata);
          if (metadata.atsScore && metadata.strengths && metadata.weaknesses) {
            return {
              atsScore: metadata.atsScore,
              industry: metadata.industry || 'General',
              strengths: metadata.strengths || [],
              weaknesses: metadata.weaknesses || [],
              recommendations: metadata.recommendations || [],
              formatStrengths: metadata.formattingStrengths || [],
              formatWeaknesses: metadata.formattingWeaknesses || [],
              formatRecommendations: metadata.formattingRecommendations || []
            };
          }
        }
        return null;
      } catch (error) {
        logger.error(`Error getting existing analysis: ${error instanceof Error ? error.message : String(error)}`);
        return null;
      }
    };
    
    try {
      // Determine starting phase
      const startingPhase = determineStartingPhase(currentMetadata, forceRefresh);
      logger.info(`Starting CV processing at phase: ${startingPhase} for CV ID: ${cvId}`);

      // Check if we have existing analysis data to use
      let existingAnalysis = null;
      if (startingPhase !== 'initial') {
        logger.info(`Looking for existing analysis data for CV ID: ${cvId}`);
        existingAnalysis = await getExistingAnalysis(cvId);
        
        if (existingAnalysis) {
          logger.info(`Found existing analysis data for CV ID ${cvId}`);
        } else {
          logger.info(`No existing analysis data found for CV ID: ${cvId}, starting from initial phase`);
        }
      }

      // Phase 1: Local analysis to get basic information
      await updateProgress('local_analysis_starting', 5);
      const localAnalysis = performLocalAnalysis(rawText);
      await updateProgress('local_analysis_complete', 10);

      trackEvent({
        eventType: 'checkpoint_reached',
        cvId,
        timestamp: new Date().toISOString(),
        phase: 'local_analysis'
      });

      // Phase 2: AI analysis of the CV
      let analysis;
      let enhancedText;
      
      if (startingPhase === 'initial' || startingPhase === 'analysis' || !existingAnalysis) {
        await updateProgress('analysis_starting', 15);
        // Get the system reference content (guidelines for analysis)
        const systemReference = await getSystemReferenceContent();
        
        // Use the existing analysis if available, or perform a new analysis
        if (existingAnalysis && startingPhase !== 'initial' && startingPhase !== 'analysis') {
          logger.info(`Using existing analysis data for CV ID: ${cvId}`);
          analysis = existingAnalysis;
          await updateProgress('analysis_loaded', 40);
        } else {
          logger.info(`Performing AI analysis for CV ID: ${cvId}`);
          
          // Update status
          await updateProgress('ai_analysis_in_progress', 20);
          
          // Set a timeout for the analysis
          let analysisPromise;
          
          // Try with Mistral first, then fallback to OpenAI if it fails
          try {
            // First try with RAG-based analysis
            logger.info(`Attempting RAG-based analysis for CV ID: ${cvId}`);
            await updateProgress('rag_analysis_in_progress', 25);
            
            // Create a promise for the analyze-cv API call
            const apiAnalysisPromise = fetch(`${process.env.NEXT_PUBLIC_APP_URL || ''}/api/analyze-cv?fileName=cv.pdf&cvId=${cvId}`)
              .then(response => {
                if (!response.ok) {
                  throw new Error(`API returned status ${response.status}`);
                }
                return response.json();
              })
              .then(data => {
                if (!data.success || !data.analysis) {
                  throw new Error('API returned unsuccessful response');
                }
                return data.analysis;
              });
            
            // Set a timeout for the API call
            const apiTimeoutPromise = new Promise((_, reject) => {
              setTimeout(() => reject(new Error('API analysis timed out')), 15000); // 15 seconds timeout
            });
            
            // Race the API call against the timeout
            analysis = await Promise.race([apiAnalysisPromise, apiTimeoutPromise]);
            logger.info(`Successfully completed RAG-based analysis for CV ID: ${cvId}`);
          } catch (ragError) {
            // Log the RAG error
            logger.error(`RAG-based analysis failed for CV ID: ${cvId}: ${ragError instanceof Error ? ragError.message : String(ragError)}`);
            
            // Fallback to quick analysis
            logger.info(`Falling back to quick analysis for CV ID: ${cvId}`);
            await updateProgress('quick_analysis_fallback', 30);
            
            // Try with GPT-4o-mini first, then fallback to GPT-3.5-turbo if it fails
            try {
              logger.info(`Attempting analysis with GPT-4o-mini for CV ID: ${cvId}`);
              analysisPromise = performQuickAnalysisWithModel(rawText, localAnalysis, "gpt-4o-mini");
            } catch (gpt4Error) {
              logger.error(`GPT-4o-mini analysis failed for CV ID: ${cvId}: ${gpt4Error instanceof Error ? gpt4Error.message : String(gpt4Error)}`);
              logger.info(`Falling back to GPT-3.5-turbo for CV ID: ${cvId}`);
              analysisPromise = performQuickAnalysis(rawText, localAnalysis);
            }
            
            const analysisTimeoutPromise = new Promise((_, reject) => {
              setTimeout(() => reject(new Error('Analysis timed out')), MAX_ANALYSIS_TIME);
            });
            
            // Perform AI analysis with timeout
            analysis = await Promise.race([analysisPromise, analysisTimeoutPromise]);
          }
          
          // Validate analysis results
          if (!analysis || !analysis.strengths || !analysis.weaknesses || !analysis.recommendations) {
            logger.warn(`Analysis results incomplete for CV ID: ${cvId}, using fallback values`);
            
            // Create fallback analysis with default values
            analysis = {
              atsScore: localAnalysis.localAtsScore || 65,
              industry: localAnalysis.topIndustry || 'General',
              strengths: ["Clear presentation of professional experience", "Includes contact information", "Lists relevant skills"],
              weaknesses: ["Could benefit from more quantifiable achievements", "May need more specific examples of skills application", "Consider adding more industry-specific keywords"],
              recommendations: ["Add measurable achievements with numbers and percentages", "Include more industry-specific keywords", "Ensure all experience is relevant to target positions"],
              formatStrengths: ["Organized structure", "Consistent formatting", "Clear section headings"],
              formatWeaknesses: ["Could improve visual hierarchy", "Consider adding more white space", "Ensure consistent alignment"],
              formatRecommendations: ["Use bullet points for achievements", "Add more white space between sections", "Ensure consistent date formatting"]
            };
          }
          
          // Update the metadata with analysis results
          updatedMetadata = {
            ...updatedMetadata,
            ...analysis,
            processingStatus: 'analysis_complete',
      processingProgress: 40,
            lastUpdated: new Date().toISOString()
          };
          await updateCVMetadata(cvId, updatedMetadata);
          
          await updateProgress('analysis_complete', 40);
          trackEvent({
            eventType: 'checkpoint_reached',
            cvId,
            timestamp: new Date().toISOString(),
            phase: 'analysis'
          });
        }
      } else {
        // Use the existing analysis from cache or previous processing
        analysis = existingAnalysis;
        logger.info(`Using existing analysis for CV ID: ${cvId}`);
        await updateProgress('analysis_loaded', 40);
      }

      // Phase 3: Optimization with AI
      if (startingPhase === 'initial' || startingPhase === 'analysis' || startingPhase === 'optimization') {
        logger.info(`Starting optimization for CV ID: ${cvId}`);
        
        // Update status
        await updateProgress('optimization_starting', 50);
        await updateProgress('optimization_in_progress', 60);
        
        // Set a timeout for the optimization
        const optimizationPromise = performQuickOptimization(rawText, analysis);
        const optimizationTimeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Optimization timed out')), MAX_OPTIMIZATION_TIME);
        });
        
        try {
          // Optimize the text with timeout
          enhancedText = await Promise.race([optimizationPromise, optimizationTimeoutPromise]);
          
          // Apply any local enhancement rules
          enhancedText = enhanceTextWithLocalRules(enhancedText as string, localAnalysis);
          
          // Update status
          updatedMetadata = {
            ...updatedMetadata,
            processingStatus: 'optimization_complete',
            processingProgress: 80,
            optimizedText: enhancedText,
            lastUpdated: new Date().toISOString()
          };
          await updateCVMetadata(cvId, updatedMetadata);
          await updateProgress('optimization_complete', 80);
          
          trackEvent({
            eventType: 'checkpoint_reached',
            cvId,
            timestamp: new Date().toISOString(),
            phase: 'optimization'
          });
        } catch (optimizationError) {
          logger.error(`Optimization timed out or failed for CV ID: ${cvId}`, 
            optimizationError instanceof Error ? optimizationError.message : String(optimizationError));
          
          // Use enhanced text with local rules as fallback
          enhancedText = enhanceTextWithLocalRules(rawText, localAnalysis);
          
          updatedMetadata = {
            ...updatedMetadata,
            processingStatus: 'optimization_fallback',
            processingProgress: 75,
            optimizedText: enhancedText,
            lastUpdated: new Date().toISOString()
          };
          await updateCVMetadata(cvId, updatedMetadata);
          await updateProgress('optimization_fallback', 75);
        }
      } else {
        enhancedText = currentMetadata.optimizedText || rawText;
        logger.info(`Using existing optimization for CV ID: ${cvId}`);
        await updateProgress('optimization_loaded', 80);
      }

      // Phase 4: Finalize
      logger.info(`Finalizing processing for CV ID: ${cvId}`);
      
      await updateProgress('finalizing', 90);
      
      updatedMetadata = {
        ...updatedMetadata,
        processing: false,
        processingCompleted: true,
        processingStatus: 'complete',
        processingProgress: 100,
        optimized: true,
        lastUpdated: new Date().toISOString()
      };
      await updateCVMetadata(cvId, updatedMetadata);
      await updateProgress('complete', 100);
      
      const totalDuration = Date.now() - processingStartTime;
      
      trackEvent({
        eventType: 'process_complete',
        cvId,
        userId,
        timestamp: new Date().toISOString(),
        duration: totalDuration
      });
      
      logger.info(`CV processing completed in ${totalDuration}ms for CV ID: ${cvId}`);
      
      return {
        success: true,
        message: 'CV processed successfully',
        metadata: updatedMetadata
      };
    } catch (error) {
      // Ensure error is properly typed for the logger
      const errorForLog = error instanceof Error 
        ? error 
        : new Error(typeof error === 'string' ? error : 'Unknown error during CV processing');
      
      logger.error(`Error processing CV ID: ${cvId}`, errorForLog);
      
      // Check if it's a timeout error
      const errorMessage = error instanceof Error ? error.message : String(error);
      const isTimeout = errorMessage.includes('timeout') || errorMessage.includes('timed out');
      
      // Update metadata with error information
      const updatedErrorMetadata = {
        ...currentMetadata,
        processing: false,
        processingStatus: 'error',
        processingError: errorMessage,
        processingProgress: 0,
        lastUpdated: new Date().toISOString()
      };
      
      await updateCVMetadata(cvId, updatedErrorMetadata);
      
      // Track the error event
      trackEvent({
        eventType: 'process_error',
        cvId,
        userId,
        timestamp: new Date().toISOString(),
        error: errorMessage || 'Unknown error',
        duration: Date.now() - processingStartTime
      });
      
      if (isTimeout) {
        return await handleFallbackCompletion(cvId, rawText, currentMetadata);
      }
      
      throw error;
    }
  } catch (error) {
    // Ensure error is properly typed for the logger
    const errorForLog = error instanceof Error 
      ? error 
      : new Error(typeof error === 'string' ? error : 'Unknown error in processCVWithAI');
    
    logger.error(`Unhandled error in processCVWithAI for CV ID: ${cvId}`, errorForLog);
    
    // Ensure CV metadata is updated to reflect the error
    const errorMetadata = {
      ...currentMetadata,
      processing: false,
      processingStatus: 'error',
      processingError: error instanceof Error ? error.message : 'Unknown error',
      processingProgress: 0,
      lastUpdated: new Date().toISOString()
    };
    
    await updateCVMetadata(cvId, errorMetadata);
    
    // Try fallback completion as a last resort
    try {
      return await handleFallbackCompletion(cvId, rawText, currentMetadata);
    } catch (fallbackError) {
      // If even fallback fails, return a failed result
      return {
        success: false,
        message: 'CV processing failed completely',
        error: error instanceof Error ? error.message : 'Unknown error',
        metadata: errorMetadata
      };
    }
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
 * Perform quick optimization of CV content
 * Enhanced with RAG using Mistral AI
 */
async function performQuickOptimization(rawText: string, analysis: any): Promise<string> {
  try {
    // Set a timeout for the optimization process
    const optimizationStartTime = Date.now();
    const OPTIMIZATION_TIMEOUT = 30000; // Increase to 30 seconds timeout
    
    // Log the start of optimization
    logger.info('Starting CV optimization process');
    
    // Initialize the RAG service with error handling
    logger.info('Initializing RAG service for CV optimization');
    let ragService: MistralRAGService;
    try {
      ragService = new MistralRAGService();
    } catch (initError) {
      logger.error('Failed to initialize RAG service:', 
        initError instanceof Error ? initError.message : String(initError));
      // Return enhanced text with local rules as fallback
      logger.info('Falling back to local enhancement rules due to RAG service initialization failure');
      return enhanceTextWithLocalRules(rawText, analysis);
    }
    
    // Process the CV document with timeout protection
    let documentProcessed = false;
    try {
      logger.info('Processing CV document with RAG service');
      // Add timeout for document processing
      const processingPromise = ragService.processCVDocument(rawText);
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('CV document processing timed out')), 20000); // Increase to 20 seconds
      });
      
      try {
        await Promise.race([processingPromise, timeoutPromise]);
        documentProcessed = true;
        logger.info('Successfully processed CV document with RAG service');
      } catch (processingError) {
        logger.warn('Error or timeout processing CV document with RAG service, continuing with optimization', 
          processingError instanceof Error ? processingError.message : String(processingError));
        // Continue with optimization even if document processing fails
      }
    } catch (processingError) {
      logger.warn('Error processing CV document with RAG service, falling back to direct optimization', 
                processingError instanceof Error ? processingError.message : String(processingError));
      // Continue with fallback optimization
    }
    
    // Determine language from analysis; default to English
    const language = analysis.language || "en";
    
    // Define optimization system prompt based on language
    const systemPrompts: Record<string, string> = {
      en: `You are a professional CV optimizer. Your task is to optimize the CV text for ATS compatibility.
Focus on:
1. Adding relevant keywords for the ${analysis.industry || 'specified'} industry
2. Using action verbs for achievements
3. Quantifying accomplishments
4. Maintaining original structure and information
5. Optimizing formatting for readability

Key weaknesses to address:
${analysis.weaknesses?.join(', ') || 'Improve overall ATS compatibility'}

Provide ONLY the optimized CV text, no explanations.`,
      es: `Eres un optimizador profesional de CV. Tu tarea es optimizar el texto del CV para la compatibilidad con ATS.
Enfócate en:
1. Agregar palabras clave relevantes para la industria de ${analysis.industry || 'especificada'}
2. Usar verbos de acción para describir logros
3. Cuantificar los logros con métricas
4. Mantener la estructura e información original
5. Optimizar el formato para mejorar la legibilidad

Aspectos a mejorar:
${analysis.weaknesses?.join(', ') || 'Mejorar la compatibilidad general con ATS'}

Proporciona ÚNICAMENTE el texto optimizado del CV, sin explicaciones.`,
      fr: `Vous êtes un optimiseur professionnel de CV. Votre tâche est d'optimiser le texte du CV pour la compatibilité ATS.
Concentrez-vous sur :
1. Ajouter des mots-clés pertinents pour le secteur de ${analysis.industry || 'spécifié'}
2. Utiliser des verbes d'action pour décrire les réalisations
3. Quantifier les accomplissements avec des métriques
4. Maintenir la structure et les informations originales
5. Optimiser le format pour une meilleure lisibilité

Points faibles à corriger :
${analysis.weaknesses?.join(', ') || 'Améliorer la compatibilité globale avec les ATS'}

Fournissez UNIQUEMENT le texte optimisé du CV, sans explications.`,
      de: `Sie sind ein professioneller Lebenslauf-Optimierer. Ihre Aufgabe ist es, den Lebenslauf für die ATS-Kompatibilität zu optimieren.
Konzentrieren Sie sich auf:
1. Hinzufügen relevanter Schlüsselwörter für die ${analysis.industry || 'angegebene'} Branche
2. Verwendung von Aktionsverben zur Beschreibung von Erfolgen
3. Quantifizierung der Leistungen mit Kennzahlen
4. Beibehaltung der ursprünglichen Struktur und Information
5. Optimierung des Formats zur Verbesserung der Lesbarkeit

Zu verbessernde Punkte:
${analysis.weaknesses?.join(', ') || 'Verbessern Sie die allgemeine ATS-Kompatibilität'}

Geben Sie NUR den optimierten Text des Lebenslaufs zurück, ohne Erklärungen.`
    };
    
    // Use the appropriate system prompt based on language
    const systemPrompt = systemPrompts[language] || systemPrompts["en"];
    
    // Craft the optimization query
    const optimizationQuery = `Optimize the following CV text for ATS compatibility in the ${analysis.industry || 'general'} industry:`;
    
    let optimizedText = '';
    
    // Try with RAG first with proper timeout handling
    if (documentProcessed) {
      logger.info('Attempting CV optimization with RAG');
      try {
        // Create a promise for the RAG optimization
        const ragOptimizationPromise = ragService.generateResponse(optimizationQuery, systemPrompt);
        
        // Create a timeout promise
        const ragTimeoutPromise = new Promise<string>((_, reject) => {
          setTimeout(() => reject(new Error('RAG optimization timed out')), OPTIMIZATION_TIMEOUT);
        });
        
        // Race the optimization against the timeout
        optimizedText = await Promise.race([ragOptimizationPromise, ragTimeoutPromise]);
        logger.info('RAG optimization returned text of length: ' + optimizedText.length);
        
        // Basic validation to ensure we got reasonable output
        if (optimizedText && optimizedText.length > rawText.length * 0.5) {
          logger.info('Successfully generated optimized CV content with RAG');
          
          // Check if we're taking too long overall
          if (Date.now() - optimizationStartTime > OPTIMIZATION_TIMEOUT) {
            logger.warn('Optimization process is taking too long, returning current result');
            return optimizedText;
          }
          
          return optimizedText;
        } else {
          logger.warn('Generated content too short or empty, falling back to direct optimization');
          throw new Error('Generated content validation failed');
        }
      } catch (error) {
        // Log the error and continue to fallback
        logger.warn('RAG optimization failed or timed out, falling back to direct API call', 
                  error instanceof Error ? error.message : String(error));
      }
    } else {
      logger.info('Document not processed, skipping RAG optimization and using direct API call');
    }
    
    // Fall back to direct OpenAI call if RAG fails or document wasn't processed
    try {
      logger.info('Attempting direct API optimization with OpenAI');
      
      // Initialize OpenAI client with error handling
      let openai: OpenAI;
      try {
        openai = new OpenAI({
          apiKey: process.env.OPENAI_API_KEY,
        });
      } catch (openaiInitError) {
        logger.error('Failed to initialize OpenAI client:', 
          openaiInitError instanceof Error ? openaiInitError.message : String(openaiInitError));
        // Return enhanced text with local rules as fallback
        logger.info('Falling back to local enhancement rules due to OpenAI client initialization failure');
        return enhanceTextWithLocalRules(rawText, analysis);
      }

      // Try GPT-4o-mini first for better quality
      try {
        logger.info('Attempting optimization with GPT-4o-mini');
        
        // Create a promise for the direct API optimization
        const directOptimizationPromise = openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content: "You are a fast CV optimizer. Return ONLY the optimized CV text, no explanations."
            },
            {
              role: "user",
              content: `Quickly optimize this CV for ATS compatibility. Focus on:
1. Adding relevant keywords for the ${analysis.industry || 'general'} industry
2. Using action verbs for achievements
3. Quantifying accomplishments
4. Maintaining original structure and information
5. Optimizing formatting for readability

Return ONLY the optimized CV text, no explanations.

CV text:
${rawText.substring(0, 4000)}${rawText.length > 4000 ? '...' : ''}

Key weaknesses to address:
${analysis.weaknesses?.join(', ') || 'Improve overall ATS compatibility'}`
            }
          ],
          temperature: 0.4,
          max_tokens: 4000,
        });
        
        // Create a timeout promise
        const directTimeoutPromise = new Promise<any>((_, reject) => {
          setTimeout(() => reject(new Error('Direct API optimization timed out')), 25000); // Increase to 25 seconds
        });
        
        // Race the direct optimization against the timeout
        const response = await Promise.race([directOptimizationPromise, directTimeoutPromise]);
        
        optimizedText = response.choices[0]?.message?.content || "";
        
        if (optimizedText && optimizedText.length > rawText.length * 0.5) {
          logger.info('Successfully generated optimized CV content with GPT-4o-mini');
          return optimizedText;
        } else {
          logger.warn('GPT-4o-mini response too short or empty, falling back to GPT-3.5-turbo');
          throw new Error('GPT-4o-mini response validation failed');
        }
      } catch (gpt4oError) {
        logger.warn('GPT-4o-mini optimization failed or timed out, falling back to GPT-3.5-turbo', 
          gpt4oError instanceof Error ? gpt4oError.message : String(gpt4oError));
        
        // Fall back to GPT-3.5-turbo
        logger.info('Attempting optimization with GPT-3.5-turbo');
        
        // Create a promise for the direct API optimization with GPT-3.5-turbo
        const fallbackOptimizationPromise = openai.chat.completions.create({
          model: "gpt-3.5-turbo",
          messages: [
            {
              role: "system",
              content: "You are a fast CV optimizer. Return ONLY the optimized CV text, no explanations."
            },
            {
              role: "user",
              content: `Quickly optimize this CV for ATS compatibility. Focus on:
1. Adding relevant keywords for the ${analysis.industry || 'general'} industry
2. Using action verbs for achievements
3. Quantifying accomplishments
4. Maintaining original structure and information
5. Optimizing formatting for readability

Return ONLY the optimized CV text, no explanations.

CV text:
${rawText.substring(0, 3000)}${rawText.length > 3000 ? '...' : ''}

Key weaknesses to address:
${analysis.weaknesses?.join(', ') || 'Improve overall ATS compatibility'}`
            }
          ],
          temperature: 0.4,
          max_tokens: 2000,
        });
        
        // Create a timeout promise
        const fallbackTimeoutPromise = new Promise<any>((_, reject) => {
          setTimeout(() => reject(new Error('Fallback API optimization timed out')), 20000);
        });
        
        // Race the fallback optimization against the timeout
        const fallbackResponse = await Promise.race([fallbackOptimizationPromise, fallbackTimeoutPromise]);
        
        optimizedText = fallbackResponse.choices[0]?.message?.content || "";
        
        if (optimizedText && optimizedText.length > 0) {
          logger.info('Successfully generated optimized CV content with GPT-3.5-turbo');
          return optimizedText;
        } else {
          throw new Error('Empty response from GPT-3.5-turbo');
        }
      }
    } catch (directApiError) {
      logger.error('All optimization attempts failed', 
        directApiError instanceof Error ? directApiError.message : String(directApiError));
      
      // Return enhanced text with local rules as final fallback
      logger.info('Falling back to local enhancement rules as final fallback');
      return enhanceTextWithLocalRules(rawText, analysis);
    }
  } catch (error) {
    // Handle any unexpected errors
    logger.error('Unexpected error in performQuickOptimization:', 
      error instanceof Error ? error.message : String(error));
    
    // Return enhanced text with local rules as final fallback
    return enhanceTextWithLocalRules(rawText, analysis);
  }
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
  
  // Parse experience entries from text to create structured data
  let experienceEntries = parseExperienceEntries(sections['experience'] || '');
  
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
    experienceEntries // Add the parsed experience entries to the result
  };
}

/**
 * Parse experience entries from text to create structured data
 * @param experienceText Raw text from the experience section of a CV
 * @returns Array of structured experience entries
 */
export function parseExperienceEntries(experienceText: string) {
  // Initialize the array to store structured experience entries
  const experienceEntries: Array<{
    jobTitle: string;
    company: string;
    dateRange: string;
    location?: string;
    responsibilities: string[];
  }> = [];

  // If no text provided, return empty array
  if (!experienceText || typeof experienceText !== 'string') {
    return experienceEntries;
  }

  // Convert to string array if a string was passed
  const experienceLines = Array.isArray(experienceText) 
    ? experienceText 
    : experienceText.split('\n').filter(line => line.trim());
  
  // Common patterns to identify job entries
  const datePatterns = [
    /\b(Jan|January|Feb|February|Mar|March|Apr|April|May|Jun|June|Jul|July|Aug|August|Sep|Sept|September|Oct|October|Nov|November|Dec|December)\.?\s+\d{4}\s*(-|–|to|Till|until|present|current|now|\d{4})/i,
    /\b\d{4}\s*(-|–|to|Till|until)\s*(present|current|now|\d{4})/i,
    /\b(19|20)\d{2}\s*(-|–|to|Till|until|–|—)\s*(present|current|now|(19|20)\d{2})/i,
    /\b(0?[1-9]|1[0-2])\s*\/\s*\d{4}\s*(-|–|to|until|–|—)\s*((0?[1-9]|1[0-2])\s*\/\s*\d{4}|present|current|now)/i
  ];
  
  const companyPatterns = [
    /\b(at|with|for)\s+([A-Z][A-Za-z0-9\s\.,&]+?(Inc|LLC|Ltd|Limited|Corporation|Corp|GmbH|Co|Company|Group|International|Partners))/i,
    /([A-Z][A-Za-z0-9\s\.,&]+?(Inc|LLC|Ltd|Limited|Corporation|Corp|GmbH|Co|Company|Group|International|Partners))/i,
    /\b([A-Z][A-Za-z0-9\s\.,&]{2,})\b/
  ];
  
  const locationPatterns = [
    /\b([A-Z][a-z]+(\s[A-Z][a-z]+)*),\s*([A-Z]{2}|[A-Z][a-z]+(\s[A-Z][a-z]+)*)\b/,    // City, State or City, Country
    /\b([A-Z][a-z]+(\s[A-Z][a-z]+)*)\s*-\s*([A-Z][a-z]+(\s[A-Z][a-z]+)*|[A-Z]{2})\b/, // City - State/Country
    /\b(Remote|Virtual|Home[\s-]based|Telecommute|Work from home)\b/i                // Remote work indicators
  ];
  
  const titlePatterns = [
    /\b(Senior|Lead|Principal|Chief|Head|Junior|Associate)\s+([A-Z][a-z]+(\s[A-Z][a-z]+)*)\b/i,
    /\b(Developer|Engineer|Designer|Manager|Director|Coordinator|Specialist|Analyst|Architect|Consultant|Administrator|Officer)\b/i,
    /\b([A-Z][a-z]+(\s[A-Z][a-z]+)*)\s+(Developer|Engineer|Designer|Manager|Director|Coordinator|Specialist|Analyst|Architect|Consultant|Administrator|Officer)\b/i
  ];
  
  // Segment the text into potential job blocks
  let currentEntry: {
    jobTitle: string;
    company: string;
    dateRange: string;
    location?: string;
    responsibilities: string[];
    confidence: number; // Used for scoring the detection confidence
  } | null = null;
  
  let blocks: string[][] = [];
  let currentBlock: string[] = [];
  
  // Group lines into potential job blocks
  for (let i = 0; i < experienceLines.length; i++) {
    const line = experienceLines[i].trim();
    if (!line) continue;
    
    // Check if this line might be a new job entry header
    const hasDate = datePatterns.some(pattern => pattern.test(line));
    const mightBeTitle = titlePatterns.some(pattern => pattern.test(line)) && line.length < 80;
    const mightBeCompany = companyPatterns.some(pattern => pattern.test(line)) && line.length < 80;
    
    // If this line contains date patterns or looks like a new job title or company, it might start a new block
    if ((hasDate || mightBeTitle || mightBeCompany) && 
        (!currentBlock.length || // First block
         // Or previous block has content but this is clearly a new entry
         (currentBlock.length > 0 && (hasDate || 
                                     (mightBeTitle && !currentBlock.some(l => titlePatterns.some(p => p.test(l)))))))) {
      // Save current block if not empty
      if (currentBlock.length > 0) {
        blocks.push([...currentBlock]);
        currentBlock = [];
      }
      currentBlock.push(line);
    } 
    // For bullet points or regular lines, add to current block
    else if (currentBlock.length > 0) {
      currentBlock.push(line);
    }
    // If we're at the beginning and no strong pattern yet, start a block anyway
    else {
      currentBlock.push(line);
    }
  }
  
  // Add the last block if not empty
  if (currentBlock.length > 0) {
    blocks.push([...currentBlock]);
  }
  
  // Process each block to extract job details
  for (const block of blocks) {
    // Skip empty blocks
    if (block.length === 0) continue;
    
    currentEntry = {
      jobTitle: '',
      company: '',
      dateRange: '',
      location: '',
      responsibilities: [],
      confidence: 0 // Start with zero confidence
    };
    
    // First pass - identify clear patterns
    let headerLinesProcessed = new Set<number>();
    
    // Check for date ranges first - these are the most reliable indicators
    for (let i = 0; i < Math.min(5, block.length); i++) {
      const line = block[i];
      
      // Check for date patterns
      if (datePatterns.some(pattern => pattern.test(line))) {
        currentEntry.dateRange = line.trim();
        headerLinesProcessed.add(i);
        currentEntry.confidence += 30; // Strong indicator
        break; // Only use first date match for now
      }
    }
    
    // Check for job title
    for (let i = 0; i < Math.min(5, block.length); i++) {
      if (headerLinesProcessed.has(i)) continue;
      
      const line = block[i];
      if (titlePatterns.some(pattern => pattern.test(line)) && line.length < 80) {
        currentEntry.jobTitle = line.trim();
        headerLinesProcessed.add(i);
        currentEntry.confidence += 25;
        break;
      }
    }
    
    // Check for company name
    for (let i = 0; i < Math.min(5, block.length); i++) {
      if (headerLinesProcessed.has(i)) continue;
      
      const line = block[i];
      if (companyPatterns.some(pattern => pattern.test(line)) && line.length < 80) {
        currentEntry.company = line.trim();
        headerLinesProcessed.add(i);
        currentEntry.confidence += 25;
        break;
      }
    }
    
    // Check for location
    for (let i = 0; i < Math.min(5, block.length); i++) {
      if (headerLinesProcessed.has(i)) continue;
      
      const line = block[i];
      if (locationPatterns.some(pattern => pattern.test(line))) {
        currentEntry.location = line.trim();
        headerLinesProcessed.add(i);
        currentEntry.confidence += 15;
        break;
      }
    }
    
    // Second pass - try to infer unassigned fields from remaining header lines
    for (let i = 0; i < Math.min(5, block.length); i++) {
      if (headerLinesProcessed.has(i)) continue;
      
      const line = block[i].trim();
      
      // Skip bullet points in the header section
      if (line.startsWith('•') || line.startsWith('-') || line.startsWith('*') || 
          /^\d+\./.test(line)) continue;
      
      // If short line and no job title, likely a job title
      if (!currentEntry.jobTitle && line.length < 80) {
        currentEntry.jobTitle = line;
        headerLinesProcessed.add(i);
        currentEntry.confidence += 15;
        continue;
      }
      
      // If no company assigned yet, might be company
      if (!currentEntry.company && line.length < 80) {
        currentEntry.company = line;
        headerLinesProcessed.add(i);
        currentEntry.confidence += 10;
        continue;
      }
      
      // If no location yet, might be location
      if (!currentEntry.location && line.length < 80) {
        const containsComma = line.includes(',');
        if (containsComma) {
          currentEntry.location = line;
          headerLinesProcessed.add(i);
          currentEntry.confidence += 5;
        }
      }
    }
    
    // Collect responsibilities
    let foundResponsibilities = false;
    for (let i = 0; i < block.length; i++) {
      if (headerLinesProcessed.has(i)) continue;
      
      const line = block[i].trim();
      if (!line) continue;
      
      // Check if this is a bullet point or numbered list item
      const isBulletPoint = line.startsWith('•') || line.startsWith('-') || 
                           line.startsWith('*') || /^\d+\./.test(line);
      
      // If we find a bullet point, it's likely a responsibility
      if (isBulletPoint) {
        foundResponsibilities = true;
        const cleanLine = line.replace(/^[•\-*\d.]+\s*/, '').trim();
        if (cleanLine) {
          currentEntry.responsibilities.push(cleanLine);
          currentEntry.confidence += 2; // Each responsibility slightly increases confidence
        }
      }
      // Once we've started collecting bullet points, non-bullet text might still be part of responsibilities
      else if (foundResponsibilities && line.length > 10) {
        currentEntry.responsibilities.push(line);
      }
      // Otherwise if it's not a header and not a bullet point but looks like a sentence, add as responsibility
      else if (line.length > 20 && /[A-Z].*\.$/.test(line)) {
        currentEntry.responsibilities.push(line);
        foundResponsibilities = true;
      }
    }
    
    // If no responsibilities found but we have other header info, try to parse regular text as responsibilities
    if (currentEntry.responsibilities.length === 0 && 
        (currentEntry.jobTitle || currentEntry.company || currentEntry.dateRange)) {
      for (let i = 0; i < block.length; i++) {
        if (headerLinesProcessed.has(i)) continue;
        
        const line = block[i].trim();
        if (line.length > 15) { // If it's a longer line
          currentEntry.responsibilities.push(line);
        }
      }
    }
    
    // If we found date or title and company with some reasonable level of confidence, add to results
    if (currentEntry.confidence >= 35 && 
        (currentEntry.jobTitle || currentEntry.company) && 
        (currentEntry.dateRange || currentEntry.responsibilities.length > 0)) {
      const { confidence, ...entryWithoutConfidence } = currentEntry;
      experienceEntries.push(entryWithoutConfidence);
    }
  }
  
  // Sort experience entries by date (most recent first) if possible
  experienceEntries.sort((a, b) => {
    // Try to extract years from date ranges
    const getLatestYear = (dateRange: string): number => {
      const yearMatches = dateRange.match(/\b(19|20)\d{2}\b/g);
      if (yearMatches && yearMatches.length > 0) {
        // Get the largest (most recent) year
        return Math.max(...yearMatches.map(y => parseInt(y)));
      }
      // If "present" or "current", assume it's current
      if (/present|current|now/i.test(dateRange)) {
        return new Date().getFullYear();
      }
      return 0;
    };
    
    const yearA = getLatestYear(a.dateRange);
    const yearB = getLatestYear(b.dateRange);
    
    // Reverse sort - most recent first
    return yearB - yearA;
  });
  
  return experienceEntries;
}

/**
 * Applies basic enhancements to text based on local analysis
 * Used as a fallback when AI optimization fails
 */
function enhanceTextWithLocalRules(text: string, localAnalysis: any): string {
  let enhancedText = text;
  
  // Simple enhancements:
  
  // 1. Add standard section headers if missing
  if (!text.match(/\b(summary|profile|objective)\b/i) && localAnalysis.hasContact) {
    enhancedText = "PROFILE\nExperienced professional with skills in " + 
      (localAnalysis.topIndustry || "the field") + ".\n\n" + enhancedText;
  }
  
  if (!text.match(/\b(skills|competencies|expertise)\b/i) && localAnalysis.hasSkills) {
    // Add skills section at the end if it doesn't exist
    enhancedText += "\n\nSKILLS\nProfessional expertise includes " + 
      (localAnalysis.topIndustry ? getIndustryKeywords(localAnalysis.topIndustry).join(", ") : "relevant skills");
  }
  
  // 2. Add action verbs to experience points
  if (localAnalysis.hasExperience) {
    const actionVerbs = [
      "Achieved", "Improved", "Developed", "Managed", "Created", 
      "Implemented", "Coordinated", "Increased", "Reduced", "Delivered"
    ];
    
    // Find bullet points or lines that don't start with action verbs
    const lines = enhancedText.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Check if line seems like a responsibility but doesn't start with an action verb
      if ((line.startsWith("•") || line.startsWith("-") || line.startsWith("*")) && 
          !ACTION_VERBS.some(verb => line.toLowerCase().includes(verb.toLowerCase()))) {
        
        // Add a random action verb
        const randomVerb = actionVerbs[Math.floor(Math.random() * actionVerbs.length)];
        lines[i] = lines[i].replace(/^([•\-\*]\s*)/, `$1${randomVerb} `);
      }
    }
    
    enhancedText = lines.join("\n");
  }
  
  // 3. Format dates consistently
  enhancedText = enhancedText.replace(/(\b\d{1,2}\/\d{1,2}\/\d{2,4}\b)/g, formatDate);
  
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
export function getIndustryKeywords(industry: string): string[] {
  const industryKeywords: Record<string, string[]> = {
    'Technology': [
      'Agile', 'Scrum', 'Software Development', 'APIs', 'Microservices', 'Cloud', 'AWS', 'Azure', 
      'DevOps', 'CI/CD', 'Python', 'JavaScript', 'TypeScript', 'React', 'Node.js', 'Java', 'Kubernetes',
      'Docker', 'Infrastructure as Code', 'System Architecture', 'Databases', 'SQL', 'NoSQL',
      'Machine Learning', 'Data Science', 'Artificial Intelligence', 'Full Stack', 'Front End',
      'Back End', 'Security', 'Git', 'GitHub', 'Version Control', 'Test-Driven Development',
      'RESTful APIs', 'GraphQL', 'Continuous Integration', 'Continuous Deployment'
    ],
    'Finance': [
      'Financial Analysis', 'Financial Reporting', 'Forecasting', 'Budgeting', 'Risk Management',
      'Compliance', 'Regulations', 'SEC', 'GAAP', 'IFRS', 'Accounting', 'CPA', 'Auditing', 'Taxation',
      'Tax Planning', 'Investment', 'Portfolio Management', 'Asset Management', 'Wealth Management',
      'Financial Planning', 'Financial Statements', 'Banking', 'Credit Analysis', 'Underwriting',
      'Financial Modeling', 'M&A', 'Mergers and Acquisitions', 'Valuation', 'Due Diligence',
      'Excel', 'Bloomberg', 'Capital Markets', 'Treasury', 'Cash Flow', 'Profit & Loss'
    ],
    'Healthcare': [
      'Patient Care', 'Electronic Medical Records', 'EMR', 'EHR', 'Healthcare Administration',
      'HIPAA', 'Clinical Experience', 'Medical Coding', 'Medical Billing', 'Health Informatics',
      'Telemedicine', 'Medical Research', 'Pharmaceuticals', 'Clinical Trials', 'FDA',
      'Quality Assurance', 'Quality Improvement', 'Patient Safety', 'Healthcare Policy',
      'Healthcare Compliance', 'Care Coordination', 'Patient Advocacy', 'Preventive Care',
      'Medical Devices', 'Diagnostics', 'Treatment Plans', 'Health Insurance', 'Medicare',
      'Medicaid', 'Healthcare Regulations', 'Biotechnology'
    ],
    'Marketing': [
      'Digital Marketing', 'SEO', 'SEM', 'Social Media Marketing', 'Content Marketing',
      'Email Marketing', 'Marketing Strategy', 'Market Research', 'Brand Management', 'Branding',
      'Campaign Management', 'Google Analytics', 'Facebook Ads', 'Google Ads', 'CRM',
      'Customer Relationship Management', 'Marketing Automation', 'Lead Generation',
      'Customer Acquisition', 'Marketing Analytics', 'Growth Hacking', 'Conversion Rate Optimization',
      'A/B Testing', 'Copywriting', 'Public Relations', 'Media Planning', 'Media Buying',
      'Product Marketing', 'Marketing Communications', 'Influencer Marketing'
    ],
    'Sales': [
      'Sales Strategy', 'Business Development', 'Account Management', 'Key Account Management',
      'Client Relationship Management', 'Lead Generation', 'Sales Funnel', 'Pipeline Management',
      'Closing Deals', 'Negotiation', 'Cold Calling', 'Prospecting', 'Customer Acquisition',
      'Sales Analytics', 'CRM Software', 'Salesforce', 'HubSpot', 'Sales Targets', 'Revenue Growth',
      'Upselling', 'Cross-selling', 'Solution Selling', 'Consultative Selling', 'Territory Management',
      'Channel Sales', 'Direct Sales', 'B2B Sales', 'B2C Sales', 'Enterprise Sales', 'SaaS Sales'
    ],
    'Education': [
      'Curriculum Development', 'Instructional Design', 'Classroom Management', 'Assessment',
      'Student Engagement', 'Education Technology', 'EdTech', 'Online Learning', 'E-Learning',
      'Distance Education', 'Learning Management Systems', 'LMS', 'Student Support', 'Special Education',
      'IEP', 'Differentiated Instruction', 'Educational Leadership', 'Education Policy',
      'Educational Research', 'Teaching Methods', 'Pedagogy', 'Professional Development',
      'Educational Assessment', 'Student Advising', 'Academic Advising', 'Student Success',
      'STEM Education', 'Higher Education', 'K-12', 'Early Childhood Education'
    ],
    'Engineering': [
      'Product Design', 'CAD', 'AutoCAD', 'SolidWorks', 'Mechanical Design', 'Electrical Design',
      'Civil Engineering', 'Structural Engineering', 'Engineering Analysis', 'Project Management',
      'Systems Engineering', 'Quality Control', 'Quality Assurance', 'Product Development',
      'Research and Development', 'R&D', 'Manufacturing Process', 'Process Improvement',
      'Engineering Documentation', 'Testing Procedures', 'Test Engineering', 'Technical Specifications',
      'Prototyping', 'Industrial Design', 'Sustainability', 'Energy Efficiency', 'Regulatory Compliance',
      'ISO Standards', 'Engineering Standards', 'Value Engineering'
    ],
    'Human Resources': [
      'Recruiting', 'Talent Acquisition', 'Sourcing', 'Interviewing', 'Onboarding', 'Employee Relations',
      'Performance Management', 'Employee Development', 'Training', 'Organizational Development',
      'Benefits Administration', 'Compensation', 'HRIS', 'HR Analytics', 'Succession Planning',
      'Employee Engagement', 'Diversity and Inclusion', 'D&I', 'Policy Development',
      'HR Compliance', 'Labor Relations', 'Conflict Resolution', 'Talent Management',
      'Workforce Planning', 'Retention Strategies', 'Employee Experience', 'HR Technology',
      'Payroll', 'Employer Branding', 'Culture Building'
    ],
    'Legal': [
      'Legal Research', 'Legal Writing', 'Case Management', 'Legal Analysis', 'Contract Review',
      'Contract Drafting', 'Litigation', 'Corporate Law', 'Intellectual Property', 'Patents',
      'Trademarks', 'Compliance', 'Regulatory Compliance', 'Legal Advising', 'Due Diligence',
      'Legal Documentation', 'Negotiation', 'Mediation', 'Arbitration', 'Legal Strategy',
      'Corporate Governance', 'Risk Assessment', 'Legal Ethics', 'Attorney-Client Privilege',
      'Legal Research Tools', 'Westlaw', 'LexisNexis', 'Legal Procedures', 'Paralegal Support',
      'E-Discovery'
    ],
    'Operations': [
      'Process Optimization', 'Workflow Management', 'Operational Efficiency', 'Continuous Improvement',
      'Lean Methodology', 'Six Sigma', 'Supply Chain Management', 'Logistics', 'Inventory Management',
      'Warehousing', 'Distribution', 'Procurement', 'Vendor Management', 'Quality Management',
      'Facilities Management', 'Safety Compliance', 'Risk Management', 'Business Continuity',
      'Crisis Management', 'Resource Planning', 'Capacity Planning', 'Production Planning',
      'Project Coordination', 'Change Management', 'Business Process Reengineering',
      'ERP Systems', 'SAP', 'Oracle', 'Operations Analysis', 'Metrics Tracking'
    ],
    'Project Management': [
      'Project Planning', 'Project Scheduling', 'Project Execution', 'Project Monitoring',
      'Project Closure', 'Agile', 'Scrum', 'Kanban', 'Waterfall', 'PRINCE2', 'PMP',
      'PMI', 'Budgeting', 'Resource Allocation', 'Risk Management', 'Stakeholder Management',
      'Communication Planning', 'Change Management', 'Project Documentation', 'Status Reporting',
      'MS Project', 'Jira', 'Asana', 'Trello', 'Gantt Charts', 'Critical Path Method',
      'Earned Value Management', 'Scope Management', 'Quality Management', 'Project Governance'
    ],
    'Customer Service': [
      'Customer Support', 'Client Relations', 'Problem Resolution', 'Complaint Handling',
      'Customer Satisfaction', 'Customer Experience', 'CX', 'Call Center Operations',
      'Help Desk Support', 'Technical Support', 'Customer Retention', 'Customer Feedback',
      'CRM Systems', 'Customer Engagement', 'Service Level Agreements', 'SLAs',
      'Quality Assurance', 'First Call Resolution', 'Customer Success', 'Omnichannel Support',
      'Live Chat Support', 'Email Support', 'Phone Support', 'Customer Onboarding',
      'Conflict Resolution', 'Client Communication', 'Support Ticket Management',
      'Knowledge Base', 'FAQ Development', 'Customer Training'
    ],
    'General': [
      'Leadership', 'Management', 'Communication', 'Team Building', 'Strategic Planning',
      'Problem Solving', 'Decision Making', 'Critical Thinking', 'Time Management',
      'Organization', 'Attention to Detail', 'Analytical Skills', 'Project Management',
      'Collaboration', 'Teamwork', 'Adaptability', 'Flexibility', 'Initiative', 'Innovation',
      'Creativity', 'Customer Focus', 'Results-Oriented', 'Multitasking', 'Relationship Building',
      'Interpersonal Skills', 'Verbal Communication', 'Written Communication', 'Presentation Skills',
      'Microsoft Office', 'Excel', 'Word', 'PowerPoint', 'Outlook'
    ]
  };
  
  // If industry doesn't match a known category or is undefined, return general keywords
  const normalizedIndustry = industry ? 
    Object.keys(industryKeywords).find(key => 
      key.toLowerCase() === industry.toLowerCase() || 
      industry.toLowerCase().includes(key.toLowerCase())
    ) : null;
  
  return normalizedIndustry ? 
    industryKeywords[normalizedIndustry] : 
    industryKeywords['General'];
}

/**
 * Get missing keywords that should be added to a CV based on industry
 * @param cvText The CV text to analyze
 * @param industry The detected industry
 * @returns List of recommended keywords that are missing from the CV
 */
export function getMissingIndustryKeywords(cvText: string, industry: string): string[] {
  if (!cvText || !industry) {
    return [];
  }
  
  // Get all relevant keywords for the industry
  const industryKeywords = getIndustryKeywords(industry);
  
  // Normalize the CV text for comparison
  const normalizedText = cvText.toLowerCase();
  
  // Find keywords that don't appear in the CV
  const missingKeywords = industryKeywords.filter(keyword => {
    return !normalizedText.includes(keyword.toLowerCase());
  });
  
  // Sort by importance (we could enhance this with weighted keywords in the future)
  return missingKeywords.slice(0, 15); // Return top 15 missing keywords
}

/**
 * Generate suggestions for improving a CV based on industry-specific analysis
 * @param cvText The CV text to analyze
 * @param industry The detected industry
 * @returns Object containing suggestions and missing keywords
 */
export function generateIndustrySpecificSuggestions(
  cvText: string, 
  industry: string
): {
  missingSoftSkills: string[];
  missingHardSkills: string[];
  missingKeywords: string[];
  suggestions: string[];
} {
  // Default return structure
  const result = {
    missingSoftSkills: [] as string[],
    missingHardSkills: [] as string[],
    missingKeywords: [] as string[],
    suggestions: [] as string[]
  };
  
  if (!cvText || !industry) {
    return result;
  }
  
  // Get missing keywords
  const missingKeywords = getMissingIndustryKeywords(cvText, industry);
  
  // Define soft skills and hard skills for categorization
  const softSkills = [
    'Communication', 'Teamwork', 'Problem-Solving', 'Critical Thinking', 'Leadership',
    'Adaptability', 'Time Management', 'Creativity', 'Collaboration', 'Work Ethic',
    'Interpersonal Skills', 'Attention to Detail', 'Organization', 'Flexibility',
    'Customer Service', 'Decision Making', 'Conflict Resolution', 'Presentation Skills',
    'Emotional Intelligence', 'Negotiation', 'Strategic Planning', 'Mentoring'
  ];
  
  // Categorize missing keywords
  result.missingKeywords = missingKeywords;
  
  result.missingSoftSkills = missingKeywords.filter(keyword => 
    softSkills.some(skill => keyword.toLowerCase().includes(skill.toLowerCase()))
  );
  
  result.missingHardSkills = missingKeywords.filter(keyword => 
    !softSkills.some(skill => keyword.toLowerCase().includes(skill.toLowerCase()))
  );
  
  // Generate suggestions based on missing keywords
  if (missingKeywords.length > 0) {
    result.suggestions.push(
      `Consider adding these ${industry}-specific keywords to strengthen your CV: ${missingKeywords.slice(0, 5).join(', ')}.`
    );
  }
  
  if (result.missingSoftSkills.length > 0) {
    result.suggestions.push(
      `Highlight these soft skills relevant to ${industry}: ${result.missingSoftSkills.slice(0, 3).join(', ')}.`
    );
  }
  
  if (result.missingHardSkills.length > 0) {
    result.suggestions.push(
      `Showcase these technical skills valued in ${industry}: ${result.missingHardSkills.slice(0, 3).join(', ')}.`
    );
  }
  
  // Add industry-specific advice
  switch (industry.toLowerCase()) {
    case 'technology':
      result.suggestions.push('Include specific programming languages, frameworks, or tools you\'ve used.');
      result.suggestions.push('Quantify your impact with metrics like performance improvements or user growth.');
      break;
    case 'finance':
      result.suggestions.push('Highlight your knowledge of financial regulations and compliance standards.');
      result.suggestions.push('Include specific financial software or tools you\'re proficient with.');
      break;
    case 'healthcare':
      result.suggestions.push('Mention any certifications or specialized training relevant to healthcare.');
      result.suggestions.push('Emphasize patient care experience and knowledge of medical protocols.');
      break;
    case 'marketing':
      result.suggestions.push('Include metrics such as campaign ROI, audience growth, or conversion rates.');
      result.suggestions.push('Showcase your experience with specific marketing platforms and analytics tools.');
      break;
    case 'sales':
      result.suggestions.push('Quantify your achievements with sales figures, growth percentages, or revenue targets.');
      result.suggestions.push('Include specific CRM systems and sales methodologies you\'ve used.');
      break;
    default:
      result.suggestions.push('Quantify your achievements with specific metrics and results where possible.');
      result.suggestions.push('Tailor your CV for each application by highlighting relevant experience and skills.');
  }
  
  return result;
}

/**
 * Enhance the CV's ATS compatibility by adding industry-specific keywords
 * @param cvText The CV text to enhance
 * @param industry The detected industry
 * @returns Enhanced CV text with industry-specific keywords
 */
export function enhanceWithIndustryKeywords(cvText: string, industry: string): string {
  if (!cvText || !industry) {
    return cvText;
  }
  
  // Get recommendations for the CV
  const recommendations = generateIndustrySpecificSuggestions(cvText, industry);
  
  // If no missing keywords, return original text
  if (recommendations.missingKeywords.length === 0) {
    return cvText;
  }
  
  // Try to identify the skills section to enhance it
  const lines = cvText.split('\n');
  const skillSectionIndex = lines.findIndex(line => 
    /^SKILLS|^EXPERTISE|^COMPETENCIES|^TECHNICAL SKILLS/i.test(line.trim())
  );
  
  // If we found a skills section, enhance it
  if (skillSectionIndex >= 0) {
    // Find the end of the skills section (next section header or end of document)
    let endOfSkillsSection = lines.length;
    for (let i = skillSectionIndex + 1; i < lines.length; i++) {
      if (/^[A-Z\s]{2,}:?$/i.test(lines[i].trim()) || /^[A-Z\s]{2,}$/i.test(lines[i].trim())) {
        endOfSkillsSection = i;
        break;
      }
    }
    
    // Get the most relevant missing keywords (limit to 5)
    const keywordsToAdd = recommendations.missingKeywords.slice(0, 5);
    
    // Add keywords to the skills section
    let addedKeywords = '';
    keywordsToAdd.forEach(keyword => {
      // Format as bullet points if the section uses them
      const useBullets = lines.slice(skillSectionIndex, endOfSkillsSection).some(line => 
        line.trim().startsWith('•') || line.trim().startsWith('-') || line.trim().startsWith('*')
      );
      
      if (useBullets) {
        addedKeywords += `• ${keyword}\n`;
      } else {
        addedKeywords += `${keyword}, `;
      }
    });
    
    // Remove trailing comma and space for non-bullet format
    if (addedKeywords.endsWith(', ')) {
      addedKeywords = addedKeywords.slice(0, -2);
    }
    
    // Insert the keywords before the end of the skills section
    if (addedKeywords) {
      const newLines = [...lines];
      
      // If bullet format, add each on a new line
      if (addedKeywords.includes('•')) {
        newLines.splice(endOfSkillsSection, 0, addedKeywords);
      } 
      // Otherwise, find the last non-empty line in the skills section and append
      else {
        let lastLineIndex = endOfSkillsSection - 1;
        while (lastLineIndex > skillSectionIndex && !newLines[lastLineIndex].trim()) {
          lastLineIndex--;
        }
        
        if (lastLineIndex > skillSectionIndex) {
          newLines[lastLineIndex] += ' ' + addedKeywords;
        } else {
          newLines.splice(skillSectionIndex + 1, 0, addedKeywords);
        }
      }
      
      return newLines.join('\n');
    }
  }
  
  // If we couldn't identify or modify the skills section, add a new one
  if (skillSectionIndex < 0) {
    const keywordsToAdd = recommendations.missingKeywords.slice(0, 8);
    const newSkillsSection = `
SKILLS
• ${keywordsToAdd.join('\n• ')}
`;
    return cvText + newSkillsSection;
  }
  
  // If we couldn't enhance the CV, return the original
  return cvText;
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
  
  for (let i = startIndex; i < text.length; i++) {
    if (text[i] === '[') bracketCount++;
    if (text[i] === ']') bracketCount--;
    
    if (bracketCount === 0) {
      endIndex = i;
      break;
    }
  }
  
  if (bracketCount !== 0) return defaultValue;
  
  const arrayText = text.substring(startIndex, endIndex);
  const items = arrayText.split(',').map(item => {
    const trimmed = item.trim();
    // Remove quotes if present
    return trimmed.startsWith('"') && trimmed.endsWith('"') 
      ? trimmed.substring(1, trimmed.length - 1) 
      : trimmed;
  }).filter(item => item.length > 0);
  
  return items.length > 0 ? items : defaultValue;
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
 * Enhances responsibilities in experience entries by adding quantifiable metrics
 * @param experienceEntries Array of experience entries to enhance
 * @returns Enhanced experience entries with quantifiable metrics
 */
export function enhanceExperienceWithMetrics(experienceEntries: Array<{
  jobTitle: string;
  company: string;
  dateRange: string;
  location?: string;
  responsibilities: string[];
}>): Array<{
  jobTitle: string;
  company: string;
  dateRange: string;
  location?: string;
  responsibilities: string[];
}> {
  if (!experienceEntries || !Array.isArray(experienceEntries) || experienceEntries.length === 0) {
    return experienceEntries;
  }
  
  // Clone to avoid modifying original
  const enhancedEntries = JSON.parse(JSON.stringify(experienceEntries));
  
  // Define quantification patterns to check if a responsibility already has metrics
  const quantificationPatterns = [
    /\d+%/,                           // Percentage
    /\$\d+[kmbt]?/i,                  // Dollar amounts
    /\d+ (people|employees|team members|clients|customers|users)/i, // Count of people
    /increased|improved|reduced|generated|saved|delivered|achieved/i, // Action verbs often with metrics
    /\d+ (years|months|weeks|days)/i, // Time periods
    /\d+x/i,                          // Multiplier (e.g., 3x)
    /million|billion|thousand/i,      // Large numbers
    /\d+\+/,                          // Numbers with plus
    /top \d+%/i                       // Top percentiles
  ];
  
  // Metric templates for different job functions
  const metricTemplates: Record<string, string[]> = {
    'sales': [
      'increased sales by {15-30}%',
      'generated ${50-500}k in revenue',
      'exceeded targets by {10-25}%',
      'acquired {10-50}+ new clients',
      'expanded customer base by {15-35}%',
      'reduced churn by {10-25}%',
      'improved conversion rate by {5-20}%'
    ],
    'marketing': [
      'increased website traffic by {25-75}%',
      'improved conversion rates by {10-30}%',
      'generated {1000-5000}+ leads',
      'grew social media following by {20-50}%',
      'reduced cost per acquisition by {15-35}%',
      'increased engagement by {20-40}%',
      'boosted email open rates by {10-25}%'
    ],
    'engineering': [
      'reduced load time by {20-50}%',
      'improved system efficiency by {15-30}%',
      'decreased bugs by {30-70}%',
      'automated {3-10}+ routine processes',
      'maintained {99.5-99.9}% uptime',
      'reduced technical debt by {20-40}%',
      'implemented solutions used by {1000-10000}+ users'
    ],
    'project_management': [
      'delivered {3-10}+ projects on time and under budget',
      'managed team of {5-20}+ members',
      'reduced project completion time by {15-30}%',
      'saved ${10-100}k through process improvements',
      'improved team productivity by {20-40}%',
      'successful delivery rate of {95-99}%',
      'managed budgets exceeding ${100-1000}k'
    ],
    'operations': [
      'streamlined processes resulting in {15-30}% efficiency gains',
      'reduced operational costs by {10-25}%',
      'improved quality metrics by {20-40}%',
      'decreased turnaround time by {25-50}%',
      'implemented changes saving ${50-250}k annually',
      'increased output by {20-35}%',
      'improved customer satisfaction ratings by {15-30}%'
    ],
    'customer_service': [
      'maintained {90-98}% customer satisfaction rate',
      'reduced average response time by {20-40}%',
      'handled {50-200}+ inquiries daily',
      'improved first-call resolution by {15-30}%',
      'decreased escalation rate by {25-50}%',
      'contributed to {10-25}% increase in retention',
      'resolved {95-99}% of issues within SLA'
    ],
    'human_resources': [
      'reduced turnover by {15-30}%',
      'recruited {20-100}+ new employees',
      'improved employee satisfaction by {15-35}%',
      'decreased time-to-hire by {20-40}%',
      'implemented programs resulting in {10-25}% productivity increase',
      'managed benefits for {50-500}+ employees',
      'achieved {90-98}% training completion rate'
    ],
    'finance': [
      'reduced costs by {10-20}%',
      'identified ${50-500}k in savings',
      'improved forecast accuracy by {15-30}%',
      'reduced month-end close by {2-5} days',
      'managed budget of ${1-10}M',
      'automated {3-10}+ financial processes',
      'achieved {99-100}% compliance rate'
    ],
    'general': [
      'increased efficiency by {15-30}%',
      'reduced costs by {10-25}%',
      'improved quality by {20-40}%',
      'managed team of {3-15}+ people',
      'delivered results {10-30}% above expectations',
      'completed projects {5-20}% under budget',
      'served {50-500}+ customers/clients'
    ]
  };
  
  // Add metrics to responsibilities that don't have them
  for (const entry of enhancedEntries) {
    // Try to determine job function from job title
    let jobFunction = 'general';
    const normalizedTitle = entry.jobTitle.toLowerCase();
    
    if (/sales|account|business development|revenue|client|customer success/i.test(normalizedTitle)) {
      jobFunction = 'sales';
    } else if (/market|brand|content|seo|sem|growth|campaign/i.test(normalizedTitle)) {
      jobFunction = 'marketing';
    } else if (/engineer|developer|architect|programming|coder|software|tech/i.test(normalizedTitle)) {
      jobFunction = 'engineering';
    } else if (/project|program|product|scrum|agile/i.test(normalizedTitle)) {
      jobFunction = 'project_management';
    } else if (/operations|process|supply chain|logistics|procurement/i.test(normalizedTitle)) {
      jobFunction = 'operations';
    } else if (/customer service|support|success|experience|care/i.test(normalizedTitle)) {
      jobFunction = 'customer_service';
    } else if (/hr|human resource|recruit|talent|personnel/i.test(normalizedTitle)) {
      jobFunction = 'human_resources';
    } else if (/finance|accounting|financial|budget|controller|cfo/i.test(normalizedTitle)) {
      jobFunction = 'finance';
    }
    
    // Get relevant metric templates
    const templates = metricTemplates[jobFunction] || metricTemplates.general;
    
    // Process each responsibility
    if (entry.responsibilities && Array.isArray(entry.responsibilities)) {
      for (let i = 0; i < entry.responsibilities.length; i++) {
        const responsibility = entry.responsibilities[i];
        
        // Skip if already has metrics
        const hasMetrics = quantificationPatterns.some(pattern => pattern.test(responsibility));
        if (hasMetrics) continue;
        
        // Make sure the responsibility is not too short or already enhanced
        if (responsibility.length < 15 || responsibility.includes('resulting in')) continue;
        
        // Get a random metric template
        const template = templates[Math.floor(Math.random() * templates.length)];
        
        // Extract a random number within the range specified in the template
        // e.g., {15-30} becomes a random number between 15 and 30
        const metricsWithRandomNumbers = template.replace(/\{(\d+)-(\d+)\}/g, (match, min, max) => {
          const randomValue = Math.floor(Math.random() * (parseInt(max) - parseInt(min) + 1)) + parseInt(min);
          return randomValue.toString();
        });
        
        // Enhance the responsibility with metrics if it doesn't end with a period
        // We want to add "resulting in X" or "leading to X"
        const conjunction = Math.random() > 0.5 ? 'resulting in' : 'leading to';
        
        // Only enhance if it makes sense (the responsibility should be a complete sentence)
        // and it should not already have metrics or be too generic
        if (responsibility.trim().endsWith('.')) {
          // Remove the period and add the metrics
          entry.responsibilities[i] = responsibility.trim().slice(0, -1) + ', ' + conjunction + ' ' + metricsWithRandomNumbers + '.';
        } else {
          // Add a comma and the metrics
          entry.responsibilities[i] = responsibility.trim() + ', ' + conjunction + ' ' + metricsWithRandomNumbers + '.';
        }
      }
    }
  }
  
  return enhancedEntries;
}