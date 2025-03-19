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
 * @param industry The target industry
 * @param existingContent The current CV content
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