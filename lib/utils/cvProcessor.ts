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
  
  // Find patterns that match work experience
  const experienceSection = Object.keys(sections).find(key => 
    key.includes('experience') || key.includes('employment'));

  // Extract formatted experience entries if experience section exists
  let experienceEntries: Array<{
    jobTitle: string;
    company: string;
    dateRange: string;
    location?: string;
    responsibilities: string[];
  }> = [];

  if (experienceSection && sections[experienceSection]) {
    experienceEntries = parseExperienceEntries(sections[experienceSection]);
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
 * Parse and extract structured experience entries from CV text
 * @param experienceText Raw experience section text
 * @returns Array of structured experience entries
 */
export function parseExperienceEntries(experienceText: string) {
  // If the input is an array, join it into a string
  const text = Array.isArray(experienceText) ? experienceText.join('\n') : experienceText;
  
  // Initialize the result array
  const entries: Array<{
    jobTitle: string;
    company: string;
    dateRange: string;
    location?: string;
    responsibilities: string[];
  }> = [];
  
  // Split text into potential job blocks
  // Look for patterns that likely indicate the start of a new job entry
  const jobBlockPattern = /(?:^|\n)(?:\s*|\d+\.\s*)((?:[A-Z][a-z]+\s+)*[A-Z][a-z]+|[A-Z\s]+)(?:\s+at|,|\s+\-|\s+–|\s+—|\n|\s+\()/;
  const blocks = text.split(jobBlockPattern).filter(block => block.trim().length > 0);
  
  // Group blocks into pairs (potential job title followed by details)
  for (let i = 0; i < blocks.length - 1; i += 2) {
    const potentialJobTitle = blocks[i].trim();
    const detailsBlock = blocks[i + 1] || '';
    
    // Skip if this doesn't look like a valid job block
    if (!potentialJobTitle || !detailsBlock) continue;
    
    // Initialize entry with the potential job title
    const entry = {
      jobTitle: potentialJobTitle,
      company: '',
      dateRange: '',
      location: '',
      responsibilities: [] as string[]
    };
    
    // Split the details into lines for further processing
    const lines = detailsBlock.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    
    // Enhanced date range detection with multiple formats
    const dateRangePatterns = [
      /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* (\d{4})\s*(?:-|–|—|to)\s*(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* (\d{4}|Present|Current|Now)\b/i,
      /\b(January|February|March|April|May|June|July|August|September|October|November|December) (\d{4})\s*(?:-|–|—|to)\s*(January|February|March|April|May|June|July|August|September|October|November|December) (\d{4}|Present|Current|Now)\b/i,
      /\b(\d{1,2})\/(\d{4})\s*(?:-|–|—|to)\s*(\d{1,2})\/(\d{4}|Present|Current|Now)\b/i,
      /\b(\d{4})\s*(?:-|–|—|to)\s*(\d{4}|Present|Current|Now)\b/i,
      /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* (\d{4})\s*(?:-|–|—|to)\s*(Present|Current|Now)\b/i,
      /\b(\d{4})\s*(?:-|–|—|to)\s*(Present|Current|Now)\b/i,
      /\b(Since|From) (\d{4})\b/i,
      /\b(\d{4})\s*-\s*(\d{2})\b/ // Handles format like "2018-20"
    ];
    
    // Process first few lines to identify company, date range, and location
    let companyFound = false;
    let dateRangeFound = false;
    let locationFound = false;
    let responsibilitiesStartIndex = 0;
    
    for (let j = 0; j < Math.min(5, lines.length); j++) {
      const line = lines[j];
      
      // Skip processing if line is very short (likely not meaningful)
      if (line.length < 2) continue;
      
      // Check for date ranges first
      if (!dateRangeFound) {
        let dateMatch = null;
        for (const pattern of dateRangePatterns) {
          dateMatch = line.match(pattern);
          if (dateMatch) break;
        }
        
        if (dateMatch) {
          entry.dateRange = line;
          dateRangeFound = true;
          responsibilitiesStartIndex = j + 1;
          continue;
        }
      }
      
      // Check for company names
      if (!companyFound) {
        // Company patterns: look for LLC, Inc, Ltd, Company, or other indicators
        const companyPatterns = [
          /\b(at|with)\s+((?:[A-Z][a-z]*\s*)+(?:LLC|Inc|Ltd|Limited|GmbH|Corp|Corporation|Group|Company|Co|Team|Agency|Associates|Partners|Consultants|Services|Solutions))\b/i,
          /\b((?:[A-Z][a-z]*\s*)+(?:LLC|Inc|Ltd|Limited|GmbH|Corp|Corporation|Group|Company|Co))\b/i,
          /\b([A-Z][a-z]*(?:\s+[A-Z][a-z]*)+)\b/
        ];
        
        let companyMatch = null;
        for (const pattern of companyPatterns) {
          companyMatch = line.match(pattern);
          if (companyMatch) {
            // Use group 2 if it exists (for patterns with "at" or "with"), otherwise use group 1
            entry.company = companyMatch[2] || companyMatch[1];
            companyFound = true;
            responsibilitiesStartIndex = j + 1;
            break;
          }
        }
        
        // If we found a company, continue to next line
        if (companyFound) continue;
      }
      
      // Check for locations (City, State or City, Country format)
      if (!locationFound) {
        const locationPatterns = [
          /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*),\s*([A-Z]{2}|[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b/,
          /\b(Remote|Work from Home|Hybrid|Global|Nationwide|International)\b/i
        ];
        
        let locationMatch = null;
        for (const pattern of locationPatterns) {
          locationMatch = line.match(pattern);
          if (locationMatch) {
            entry.location = locationMatch[0];
            locationFound = true;
            responsibilitiesStartIndex = j + 1;
            break;
          }
        }
        
        // If we found a location, continue to next line
        if (locationFound) continue;
      }
      
      // If the line contains a bullet point or starts with a standard prefix, it's likely a responsibility
      if (line.startsWith('•') || line.startsWith('-') || line.startsWith('*') || 
          line.match(/^\d+\.\s/) || line.match(/^[\u2022\u2023\u25E6\u2043\u2219]/)) {
        responsibilitiesStartIndex = j;
        break;
      }
      
      // If we haven't identified this line yet, but it's short, it could be the company name
      if (!companyFound && line.length < 60) {
        entry.company = line;
        companyFound = true;
        responsibilitiesStartIndex = j + 1;
      }
    }
    
    // Process responsibilities (all remaining lines)
    let currentResponsibility = '';
    for (let j = responsibilitiesStartIndex; j < lines.length; j++) {
      const line = lines[j];
      
      // Skip if line is very short (likely not meaningful)
      if (line.length < 2) continue;
      
      // Check if this line starts a new responsibility with a bullet or number
      const isBulletPoint = line.startsWith('•') || line.startsWith('-') || line.startsWith('*') || 
                           line.match(/^\d+\.\s/) || line.match(/^[\u2022\u2023\u25E6\u2043\u2219]/);
      
      if (isBulletPoint) {
        // Save previous responsibility if exists
        if (currentResponsibility) {
          entry.responsibilities.push(currentResponsibility);
        }
        
        // Start new responsibility (removing the bullet)
        currentResponsibility = line.replace(/^[•\-*\d\.\u2022\u2023\u25E6\u2043\u2219]+\s*/, '').trim();
      } else {
        // This is a continuation of the current responsibility
        if (currentResponsibility) {
          currentResponsibility += ' ' + line;
        } else {
          // If we don't have a current responsibility, start one
          currentResponsibility = line;
        }
      }
    }
    
    // Add the last responsibility if it exists
    if (currentResponsibility) {
      entry.responsibilities.push(currentResponsibility);
    }
    
    // Do some cleanup to ensure reasonable values
    
    // If no company was found but we have a job title, try to extract the company from the job title
    if (!entry.company && entry.jobTitle.includes(' at ')) {
      const parts = entry.jobTitle.split(' at ');
      if (parts.length >= 2) {
        entry.jobTitle = parts[0].trim();
        entry.company = parts[1].trim();
      }
    }
    
    // If no date range was found, try to find it in the responsibilities
    if (!entry.dateRange && entry.responsibilities.length > 0) {
      for (const pattern of dateRangePatterns) {
        for (let i = 0; i < entry.responsibilities.length; i++) {
          const match = entry.responsibilities[i].match(pattern);
          if (match) {
            entry.dateRange = match[0];
            entry.responsibilities.splice(i, 1); // Remove this from responsibilities
            break;
          }
        }
        if (entry.dateRange) break;
      }
    }
    
    // Clean up titles and add entry if it has required fields
    if (entry.jobTitle || entry.company) {
      // Clean up job title (remove "at Company" if it exists)
      entry.jobTitle = entry.jobTitle.replace(/\s+at\s+.*$/, '');
      
      // Add to entries
      entries.push(entry);
    }
  }
  
  // If no entries were found with the block approach, try a fallback method
  if (entries.length === 0) {
    // Look for lines that likely contain job titles
    const lines = text.split('\n');
    let currentEntry: any = null;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.length === 0) continue;
      
      // If this line looks like a job title (capitalized words, not too long, not a bullet point)
      const isLikelyJobTitle = /^[A-Z][a-zA-Z\s\-\,\&]*$/.test(line) && 
                               line.length < 50 && 
                               !line.startsWith('•') && !line.startsWith('-') && !line.startsWith('*');
      
      if (isLikelyJobTitle) {
        // Save previous entry if exists
        if (currentEntry && (currentEntry.jobTitle || currentEntry.company)) {
          entries.push(currentEntry);
        }
        
        // Start new entry
        currentEntry = {
          jobTitle: line,
          company: '',
          dateRange: '',
          location: '',
          responsibilities: []
        };
      } else if (currentEntry) {
        // Date detection
        const datePatterns = [
          /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* (\d{4})\s*(?:-|–|—|to)\s*(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* (\d{4}|Present|Current|Now)\b/i,
          /\b(\d{4})\s*(?:-|–|—|to)\s*(\d{4}|Present|Current|Now)\b/i
        ];
        
        let isDateLine = false;
        for (const pattern of datePatterns) {
          if (pattern.test(line)) {
            currentEntry.dateRange = line;
            isDateLine = true;
            break;
          }
        }
        
        // If this isn't a date and looks like a company (short line, after job title)
        if (!isDateLine && !currentEntry.company && line.length < 60 && 
            !/^[•\-*\d\.\u2022\u2023\u25E6\u2043\u2219]/.test(line)) {
          currentEntry.company = line;
        } 
        // Otherwise, this is likely a responsibility
        else if (!isDateLine) {
          // Clean bullet points if they exist
          const cleanLine = line.replace(/^[•\-*\d\.\u2022\u2023\u25E6\u2043\u2219]+\s*/, '').trim();
          if (cleanLine) {
            currentEntry.responsibilities.push(cleanLine);
          }
        }
      }
    }
    
    // Add the last entry if it exists
    if (currentEntry && (currentEntry.jobTitle || currentEntry.company)) {
      entries.push(currentEntry);
    }
  }
  
  // Final cleanup pass
  entries.forEach(entry => {
    // If there are no responsibilities, check if there's a block of text in the company field that could be split
    if (entry.responsibilities.length === 0 && entry.company && entry.company.length > 100) {
      const sentences = entry.company.split(/[\.!\?]/).filter(s => s.trim().length > 0);
      if (sentences.length > 1) {
        // First sentence might be the company
        entry.company = sentences[0].trim();
        // Rest could be responsibilities
        entry.responsibilities = sentences.slice(1).map(s => s.trim() + '.');
      }
    }
    
    // Ensure every entry has at least one responsibility
    if (entry.responsibilities.length === 0) {
      entry.responsibilities = ['Responsibilities not specified.'];
    }
  });
  
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
 * Suggests industry-specific keywords that can be used to enhance a CV
 * @param industry The detected industry
 * @param existingKeywords Array of keywords already in the CV
 * @param count Number of keywords to suggest
 * @returns Array of suggested keywords
 */
export function suggestIndustryKeywords(industry: string, existingKeywords: string[] = [], count: number = 10): string[] {
  // Convert industry to lowercase for case-insensitive comparison
  const industryLower = industry.toLowerCase();
  
  // Initialize industry keyword map
  const industryKeywords: Record<string, string[]> = {
    'technology': [
      // Technical skills
      'agile', 'algorithms', 'api', 'aws', 'azure', 'backend', 'cloud', 'continuous integration',
      'css', 'data structures', 'database', 'devops', 'docker', 'frontend', 'full-stack', 'git',
      'html', 'java', 'javascript', 'kubernetes', 'linux', 'machine learning', 'microservices',
      'mongodb', 'mysql', 'node.js', 'nosql', 'object-oriented', 'php', 'postgresql', 'python',
      'react', 'rest', 'ruby', 'scala', 'scrum', 'sql', 'swift', 'typescript', 'unit testing',
      'vue.js', 'web services',
      
      // Soft skills for tech
      'analytical thinking', 'collaboration', 'communication', 'problem-solving', 'teamwork'
    ],
    
    'finance': [
      // Technical finance terms
      'accounting', 'analysis', 'audit', 'budget', 'business development', 'capital', 'cash flow',
      'compliance', 'corporate finance', 'cost reduction', 'credit', 'equity', 'financial analysis',
      'financial modeling', 'financial reporting', 'forecasting', 'gaap', 'hedge', 'investment',
      'liquidity', 'mergers & acquisitions', 'portfolio management', 'profit', 'revenue growth',
      'risk management', 'securities', 'stock', 'taxation', 'treasury', 'valuation', 'venture capital',
      
      // Software used in finance
      'bloomberg', 'excel', 'hyperion', 'quickbooks', 'sap', 'tableau'
    ],
    
    'healthcare': [
      // Medical terms
      'clinical', 'compliance', 'diagnosis', 'documentation', 'electronic health records', 'ehr',
      'healthcare informatics', 'hipaa', 'medical coding', 'medical records', 'patient care',
      'quality improvement', 'treatment planning',
      
      // Healthcare specialties
      'cardiology', 'emergency medicine', 'family practice', 'geriatrics', 'internal medicine',
      'neurology', 'obstetrics', 'oncology', 'pediatrics', 'psychiatry', 'radiology', 'surgery',
      
      // Healthcare technologies
      'cerner', 'epic', 'meditech'
    ],
    
    'marketing': [
      // Marketing specialties
      'a/b testing', 'adwords', 'affiliate marketing', 'analytics', 'brand management',
      'content marketing', 'conversion rate optimization', 'copywriting', 'crm', 'digital marketing',
      'direct marketing', 'email marketing', 'google analytics', 'growth hacking', 'inbound marketing',
      'lead generation', 'market research', 'marketing automation', 'marketing strategy',
      'media planning', 'ppc', 'product marketing', 'public relations', 'seo', 'sem', 'social media',
      'user experience',
      
      // Marketing tools
      'adobe creative suite', 'canva', 'constant contact', 'facebook ads', 'google ads',
      'hootsuite', 'hubspot', 'mailchimp', 'marketo', 'salesforce'
    ],
    
    'sales': [
      // Sales skills and methods
      'account management', 'b2b', 'b2c', 'business development', 'client acquisition',
      'client relationship management', 'closing techniques', 'cold calling', 'contract negotiation',
      'cross-selling', 'customer acquisition', 'customer retention', 'direct sales', 'enterprise sales',
      'forecasting', 'inside sales', 'key account management', 'lead generation', 'negotiation',
      'outside sales', 'pipeline management', 'prospecting', 'quota achievement', 'relationship building',
      'revenue growth', 'sales cycle', 'sales presentations', 'sales strategy', 'solution selling',
      'territory management', 'upselling',
      
      // Sales tools
      'crm', 'hubspot', 'outreach', 'salesforce', 'zoho'
    ],
    
    'education': [
      // Teaching methods and skills
      'classroom management', 'curriculum design', 'differentiated instruction',
      'e-learning', 'google classroom', 'instructional design', 'lesson planning',
      'performance assessment', 'remote learning', 'student engagement', 'student evaluation',
      
      // Educational theories
      'bloom\'s taxonomy', 'constructivism', 'inquiry-based learning', 'project-based learning',
      'social-emotional learning',
      
      // Education technologies
      'blackboard', 'canvas lms', 'moodle', 'smartboard', 'virtual classroom'
    ],
    
    'engineering': [
      // General engineering
      'autocad', 'cad', 'design', 'feasibility studies', 'iso standards', 'project management',
      'quality assurance', 'quality control', 'regulations', 'safety compliance', 'solidworks',
      'technical specifications',
      
      // Specific engineering fields
      'automation', 'circuits', 'civil', 'electrical', 'environmental', 'hydraulics',
      'industrial', 'manufacturing', 'mechanical', 'mechatronics', 'power systems',
      'process improvement', 'product development', 'robotics', 'structural',
      'thermodynamics'
    ],
    
    'human resources': [
      // HR functions
      'benefits administration', 'compensation', 'conflict resolution', 'employee engagement',
      'employee relations', 'hris', 'labor relations', 'onboarding', 'performance management',
      'personnel management', 'recruitment', 'succession planning', 'talent acquisition',
      'talent management', 'training & development', 'workforce planning',
      
      // HR certifications
      'phr', 'sphr', 'shrm-cp', 'shrm-scp',
      
      // HR technologies
      'adp', 'bamboo hr', 'paycom', 'workday'
    ],
    
    'legal': [
      // Legal specialties
      'administrative law', 'bankruptcy', 'civil litigation', 'compliance', 'contract law',
      'corporate law', 'criminal law', 'employment law', 'environmental law', 'estate planning',
      'family law', 'intellectual property', 'international law', 'litigation', 'mergers & acquisitions',
      'patent law', 'real estate law', 'regulatory compliance', 'tax law',
      
      // Legal skills
      'brief writing', 'case management', 'client counseling', 'contract drafting',
      'legal research', 'legal writing', 'negotiations', 'trial advocacy',
      
      // Legal technologies
      'clio', 'lexisnexis', 'relativity', 'westlaw'
    ],
    
    // Default/general keywords (used when no specific industry is matched)
    'general': [
      'administration', 'budget management', 'client relations', 'collaboration', 'communication',
      'critical thinking', 'leadership', 'management', 'microsoft office', 'organization',
      'problem-solving', 'project management', 'research', 'resource allocation', 'strategic planning',
      'team building', 'teamwork', 'time management'
    ]
  };
  
  // Add subspecialties within Technology
  industryKeywords['frontend development'] = [
    ...industryKeywords['technology'],
    'accessibility', 'animation', 'bootstrap', 'cross-browser compatibility', 'css3', 'ejs',
    'gatsby', 'html5', 'javascript frameworks', 'material ui', 'mobile-first design', 'next.js',
    'progressive web apps', 'react hooks', 'redux', 'responsive design', 'sass', 'svg',
    'tailwind css', 'ui/ux', 'web performance optimization', 'web standards', 'webpack'
  ];
  
  industryKeywords['backend development'] = [
    ...industryKeywords['technology'],
    'api design', 'authentication', 'caching', 'database optimization', 'django', 'express',
    'flask', 'graphql', 'jwt', 'laravel', 'load balancing', 'logging', 'messaging queues',
    'middleware', 'mvc', 'oauth', 'orm', 'performance optimization', 'rest apis', 'ruby on rails',
    'security', 'server configuration', 'spring boot', 'symfony', 'web servers'
  ];
  
  industryKeywords['data science'] = [
    ...industryKeywords['technology'],
    'a/b testing', 'big data', 'clustering', 'data analysis', 'data cleansing', 'data mining',
    'data modeling', 'data visualization', 'deep learning', 'etl', 'hadoop', 'jupyter notebooks',
    'keras', 'machine learning algorithms', 'natural language processing', 'neural networks',
    'pandas', 'predictive modeling', 'python', 'r', 'regression analysis', 'scikit-learn',
    'spark', 'statistical analysis', 'tensorflow'
  ];
  
  // First, try to match the exact industry name
  let keywordsForIndustry = industryKeywords[industryLower] || [];
  
  // If no exact match, try to find the closest industry
  if (keywordsForIndustry.length === 0) {
    // Check for partial matches
    for (const [key, keywords] of Object.entries(industryKeywords)) {
      if (industryLower.includes(key) || key.includes(industryLower)) {
        keywordsForIndustry = keywords;
        break;
      }
    }
  }
  
  // If still no match, use general keywords
  if (keywordsForIndustry.length === 0) {
    keywordsForIndustry = industryKeywords['general'];
  }
  
  // Filter out keywords that already exist in the CV
  const existingKeywordsLower = existingKeywords.map(k => k.toLowerCase());
  const filteredKeywords = keywordsForIndustry.filter(keyword => 
    !existingKeywordsLower.includes(keyword.toLowerCase())
  );
  
  // Return requested number of keywords
  return filteredKeywords.slice(0, count);
}

/**
 * Analyzes a CV to extract existing keywords and suggest industry-specific improvements
 * @param text The raw CV text
 * @param industry The detected industry
 * @returns Analysis with existing keywords and suggestions
 */
export function analyzeKeywords(text: string, industry: string): {
  existingKeywords: string[];
  missingSuggestedKeywords: string[];
  recommendedPlacements: Record<string, string>;
} {
  // Normalize text for consistent processing
  const normalizedText = text.toLowerCase();
  
  // Extract existing keywords from the text
  const existingKeywords: string[] = [];
  const commonKeywords = [
    // Leadership and management
    'leadership', 'management', 'supervision', 'team lead', 'director', 'executive',
    
    // Skills
    'analysis', 'development', 'implementation', 'design', 'planning', 'strategy',
    
    // Action verbs
    'achieved', 'built', 'created', 'delivered', 'developed', 'implemented', 'improved',
    'increased', 'launched', 'managed', 'optimized', 'reduced', 'streamlined'
  ];
  
  // Check for common keywords in the CV text
  commonKeywords.forEach(keyword => {
    if (normalizedText.includes(keyword.toLowerCase())) {
      existingKeywords.push(keyword);
    }
  });
  
  // Extract industry-specific terms already in use
  const industryTerms = suggestIndustryKeywords(industry, [], 100);
  industryTerms.forEach(term => {
    if (normalizedText.includes(term.toLowerCase())) {
      existingKeywords.push(term);
    }
  });
  
  // Suggest missing industry-specific keywords
  const suggestedKeywords = suggestIndustryKeywords(industry, existingKeywords, 10);
  
  // Generate recommendations for keyword placement
  const recommendedPlacements: Record<string, string> = {};
  suggestedKeywords.forEach(keyword => {
    // Determine the best section for this keyword
    if (/\b(software|programming|language|framework|tool)\b/i.test(keyword)) {
      recommendedPlacements[keyword] = 'Include in Skills section';
    } else if (/\b(analysis|developed|managed|improved|created|led)\b/i.test(keyword)) {
      recommendedPlacements[keyword] = 'Include in Experience section as an achievement';
    } else if (/\b(certified|certification|license|qualification)\b/i.test(keyword)) {
      recommendedPlacements[keyword] = 'Include in Certifications or Education section';
    } else {
      recommendedPlacements[keyword] = 'Include in Profile summary and Skills section';
    }
  });
  
  return {
    existingKeywords,
    missingSuggestedKeywords: suggestedKeywords,
    recommendedPlacements
  };
}

/**
 * Enhances a CV by transforming simple responsibility statements into quantified achievements
 * @param responsibilities Array of responsibility statements to enhance
 * @param industry The industry for context-appropriate enhancements
 * @returns Enhanced achievements with metrics and results
 */
export function enhanceResponsibilitiesToAchievements(
  responsibilities: string[],
  industry: string = 'general'
): string[] {
  if (!responsibilities || responsibilities.length === 0) {
    return [];
  }
  
  const enhancedAchievements: string[] = [];
  
  // Patterns to identify responsibilities that can be enhanced
  const enhanceablePatterns = [
    { 
      pattern: /\b(manage|lead|supervise|oversee|direct|coordinate)\b/i, 
      type: 'leadership' 
    },
    { 
      pattern: /\b(develop|create|design|build|implement|launch|establish)\b/i, 
      type: 'creation' 
    },
    { 
      pattern: /\b(improve|enhance|optimize|streamline|upgrade|modernize)\b/i, 
      type: 'improvement' 
    },
    { 
      pattern: /\b(analyze|research|study|investigate|assess|evaluate)\b/i, 
      type: 'analysis' 
    },
    { 
      pattern: /\b(increase|grow|expand|raise|boost|accelerate)\b/i, 
      type: 'growth' 
    },
    { 
      pattern: /\b(reduce|decrease|cut|minimize|lower|shrink)\b/i, 
      type: 'reduction' 
    },
    { 
      pattern: /\b(collaborate|work|partner|liaise|engage|interact)\b/i, 
      type: 'collaboration' 
    },
    { 
      pattern: /\b(train|mentor|coach|teach|instruct|educate)\b/i, 
      type: 'training' 
    },
    { 
      pattern: /\b(support|assist|help|aid|enable|facilitate)\b/i, 
      type: 'support' 
    },
    { 
      pattern: /\b(generate|produce|deliver|provide|supply|offer)\b/i, 
      type: 'delivery' 
    }
  ];
  
  // Process each responsibility and enhance it
  responsibilities.forEach(responsibility => {
    // Skip empty responsibilities
    if (!responsibility || responsibility.trim().length === 0) {
      return;
    }
    
    // Check if this already looks like an achievement (contains metrics)
    const hasMetrics = /\b\d+%|\$\d+|\d+ percent|increased by|reduced by|improved by|generated|saved\b/i.test(responsibility);
    if (hasMetrics) {
      // Already quantified, keep as is
      enhancedAchievements.push(responsibility);
      return;
    }
    
    // Find what type of responsibility this is
    let matchedType = '';
    for (const { pattern, type } of enhanceablePatterns) {
      if (pattern.test(responsibility)) {
        matchedType = type;
        break;
      }
    }
    
    // If we couldn't categorize this responsibility, keep it as is
    if (!matchedType) {
      enhancedAchievements.push(responsibility);
      return;
    }
    
    // Otherwise, generate a more impressive-sounding achievement
    // For simplicity, we'll just append a metric
    const metrics = [
      "improving efficiency by 20%",
      "reducing costs by 15%",
      "increasing customer satisfaction by 25%",
      "generating an additional $50K in revenue",
      "saving approximately 10 hours per week",
      "enhancing team productivity by 30%"
    ];
    
    const randomMetric = metrics[Math.floor(Math.random() * metrics.length)];
    const enhancedAchievement = `${responsibility}, ${randomMetric}`;
    
    enhancedAchievements.push(enhancedAchievement);
  });
  
  return enhancedAchievements;
}

/**
 * Enhances responsibility statements with quantified metrics to make them more impressive
 * @param responsibilities Array of responsibility statements
 * @returns Array of enhanced achievement statements
 */
export function enhanceResponsibilities(responsibilities: string[]): string[] {
  if (!responsibilities || responsibilities.length === 0) {
    return [];
  }
  
  const enhancedAchievements: string[] = [];
  
  // Define patterns to match common responsibility verbs
  const patterns = [
    { regex: /\b(manage|lead|direct|oversee|supervise)\b/i, metrics: ["team efficiency by 25%", "productivity by 30%", "department output by 20%"] },
    { regex: /\b(develop|create|design|build|implement)\b/i, metrics: ["system performance by 40%", "user adoption by 35%", "process efficiency by 28%"] },
    { regex: /\b(reduce|decrease|minimize|lower)\b/i, metrics: ["costs by 15%", "processing time by 30%", "error rates by 45%", "overhead by 22%"] },
    { regex: /\b(increase|improve|enhance|optimize|grow)\b/i, metrics: ["sales by 20%", "customer satisfaction by 35%", "performance by 25%", "retention by 18%"] },
    { regex: /\b(coordinate|collaborate|partner)\b/i, metrics: ["project delivery time by 15%", "cross-team efficiency by 25%", "stakeholder satisfaction by 30%"] },
    { regex: /\b(train|mentor|coach|teach)\b/i, metrics: ["team capabilities, resulting in 20% productivity improvement", "staff performance, achieving 22% higher output", "new employees, reducing onboarding time by 35%"] },
    { regex: /\b(analyze|review|assess|evaluate)\b/i, metrics: ["identifying $45K in annual savings", "uncovering 30% efficiency improvement opportunities", "revealing key insights that increased ROI by 25%"] }
  ];
  
  responsibilities.forEach(responsibility => {
    // Skip if empty or already contains metrics
    if (!responsibility || responsibility.trim().length === 0) {
      return;
    }
    
    // Check if already contains metrics/quantifiable information
    if (/\b\d+%|\$\d+K|\$\d+,\d+|\d+ percent|increased by|reduced by|improved by|generated|saved\b/i.test(responsibility)) {
      enhancedAchievements.push(responsibility);
      return;
    }
    
    // Try to match with patterns
    let enhanced = false;
    for (const { regex, metrics } of patterns) {
      if (regex.test(responsibility)) {
        const randomMetric = metrics[Math.floor(Math.random() * metrics.length)];
        // Check if the responsibility ends with punctuation
        const needsComma = !/[.,;:!?]$/.test(responsibility.trim());
        enhancedAchievements.push(`${responsibility.trim()}${needsComma ? ', improving ' : ' Improved '}${randomMetric}.`);
        enhanced = true;
        break;
      }
    }
    
    // If no pattern matched, keep as is
    if (!enhanced) {
      enhancedAchievements.push(responsibility);
    }
  });
  
  return enhancedAchievements;
}

/**
 * Detects the industry and subspecialty from CV text
 * @param text The raw CV text to analyze
 * @returns Object containing detected industry and subspecialty
 */
export function detectIndustryAndSubspecialty(text: string): { 
  industry: string; 
  subspecialty: string | null;
  confidence: number;
} {
  // Normalize text for consistent matching
  const normalizedText = text.toLowerCase();
  
  // Industry definitions with their keywords and confidence weights
  const industries = [
    {
      name: 'Technology',
      weight: 0,
      keywords: [
        {term: 'software', weight: 10},
        {term: 'developer', weight: 10},
        {term: 'engineer', weight: 8},
        {term: 'programming', weight: 10},
        {term: 'code', weight: 8},
        {term: 'agile', weight: 6},
        {term: 'scrum', weight: 6},
        {term: 'devops', weight: 8},
        {term: 'cloud', weight: 7},
        {term: 'aws', weight: 7},
        {term: 'azure', weight: 7},
        {term: 'git', weight: 6},
        {term: 'product', weight: 3},
        {term: 'application', weight: 5},
        {term: 'web', weight: 6},
        {term: 'mobile', weight: 6},
        {term: 'architecture', weight: 5},
        {term: 'infrastructure', weight: 6},
        {term: 'security', weight: 4},
        {term: 'network', weight: 4}
      ],
      subspecialties: [
        {
          name: 'Frontend Development',
          keywords: ['javascript', 'html', 'css', 'react', 'angular', 'vue', 'typescript', 'frontend', 'front-end', 'ui', 'ux', 'interface', 'responsive', 'web design', 'spa', 'dom']
        },
        {
          name: 'Backend Development',
          keywords: ['backend', 'back-end', 'server', 'api', 'database', 'sql', 'nosql', 'java', 'python', 'c#', '.net', 'node.js', 'php', 'ruby', 'go', 'rest', 'graphql', 'microservices']
        },
        {
          name: 'Full Stack Development',
          keywords: ['full stack', 'fullstack', 'backend', 'frontend', 'devops', 'database', 'api', 'web', 'ui', 'ux']
        },
        {
          name: 'DevOps',
          keywords: ['devops', 'jenkins', 'kubernetes', 'docker', 'ci/cd', 'continuous integration', 'continuous deployment', 'container', 'infrastructure', 'automation', 'pipeline', 'terraform', 'ansible']
        },
        {
          name: 'Data Science',
          keywords: ['data science', 'machine learning', 'ml', 'ai', 'artificial intelligence', 'data mining', 'big data', 'analytics', 'statistical', 'python', 'r', 'pandas', 'tensorflow', 'sklearn', 'data visualization', 'predictive', 'modeling']
        },
        {
          name: 'Cybersecurity',
          keywords: ['security', 'cyber', 'penetration testing', 'pentest', 'infosec', 'compliance', 'vulnerability', 'encryption', 'firewall', 'threat', 'assessment', 'audit', 'risk', 'authentication']
        },
        {
          name: 'Mobile Development',
          keywords: ['mobile', 'android', 'ios', 'swift', 'kotlin', 'react native', 'flutter', 'app development', 'mobile app', 'smartphone', 'tablet', 'responsive']
        }
      ]
    },
    {
      name: 'Finance',
      weight: 0,
      keywords: [
        {term: 'finance', weight: 10},
        {term: 'financial', weight: 10},
        {term: 'accounting', weight: 10},
        {term: 'investment', weight: 9},
        {term: 'banking', weight: 9},
        {term: 'bank', weight: 7},
        {term: 'asset', weight: 7},
        {term: 'portfolio', weight: 7},
        {term: 'budget', weight: 6},
        {term: 'fiscal', weight: 8},
        {term: 'revenue', weight: 5},
        {term: 'profit', weight: 5},
        {term: 'cash flow', weight: 8},
        {term: 'tax', weight: 7},
        {term: 'audit', weight: 8},
        {term: 'cpa', weight: 10},
        {term: 'chartered', weight: 8},
        {term: 'capital', weight: 6},
        {term: 'equity', weight: 7},
        {term: 'stock', weight: 5}
      ],
      subspecialties: [
        {
          name: 'Corporate Finance',
          keywords: ['corporate finance', 'financial planning', 'forecasting', 'budgeting', 'financial analysis', 'financial reporting', 'fpa', 'treasurer', 'capital structure', 'mergers', 'acquisitions', 'm&a']
        },
        {
          name: 'Investment Banking',
          keywords: ['investment banking', 'ibd', 'ib', 'capital markets', 'deal', 'transaction', 'pitch', 'ipo', 'valuation', 'dcf', 'lbo', 'm&a']
        },
        {
          name: 'Asset Management',
          keywords: ['asset management', 'portfolio', 'investment', 'fund', 'hedge fund', 'private equity', 'venture capital', 'wealth management', 'securities', 'trading', 'broker']
        },
        {
          name: 'Accounting',
          keywords: ['accounting', 'accountant', 'cpa', 'bookkeeping', 'audit', 'tax', 'gaap', 'ifrs', 'financial reporting', 'financial statements', 'general ledger', 'accounts payable', 'accounts receivable']
        }
      ]
    },
    {
      name: 'Healthcare',
      weight: 0,
      keywords: [
        {term: 'healthcare', weight: 10},
        {term: 'health', weight: 7},
        {term: 'medical', weight: 10},
        {term: 'clinical', weight: 10},
        {term: 'patient', weight: 10},
        {term: 'doctor', weight: 10},
        {term: 'physician', weight: 10},
        {term: 'nurse', weight: 10},
        {term: 'hospital', weight: 10},
        {term: 'clinic', weight: 9},
        {term: 'care', weight: 6},
        {term: 'therapy', weight: 7},
        {term: 'treatment', weight: 7},
        {term: 'diagnosis', weight: 8},
        {term: 'pharmaceutical', weight: 9},
        {term: 'medicine', weight: 8},
        {term: 'dental', weight: 8},
        {term: 'pharmacy', weight: 8},
        {term: 'health insurance', weight: 7},
        {term: 'ehr', weight: 7}
      ],
      subspecialties: [
        {
          name: 'Clinical Practice',
          keywords: ['doctor', 'physician', 'nurse', 'clinical', 'patient care', 'diagnosis', 'treatment', 'medical', 'practitioner', 'primary care', 'specialist']
        },
        {
          name: 'Healthcare Administration',
          keywords: ['healthcare administration', 'hospital administration', 'health services', 'healthcare management', 'medical director', 'healthcare operations', 'practice management']
        },
        {
          name: 'Pharmaceutical',
          keywords: ['pharmaceutical', 'pharma', 'drug', 'clinical trial', 'research', 'development', 'r&d', 'regulatory', 'fda', 'medicine', 'therapeutic']
        },
        {
          name: 'Health Information Technology',
          keywords: ['health it', 'health information', 'ehr', 'emr', 'electronic medical record', 'healthcare technology', 'healthcare software', 'medical informatics']
        }
      ]
    },
    {
      name: 'Marketing',
      weight: 0,
      keywords: [
        {term: 'marketing', weight: 10},
        {term: 'brand', weight: 8},
        {term: 'digital marketing', weight: 10},
        {term: 'seo', weight: 9},
        {term: 'sem', weight: 9},
        {term: 'content', weight: 6},
        {term: 'social media', weight: 8},
        {term: 'campaign', weight: 8},
        {term: 'advertising', weight: 9},
        {term: 'market research', weight: 9},
        {term: 'analytics', weight: 5},
        {term: 'audience', weight: 7},
        {term: 'engagement', weight: 6},
        {term: 'conversion', weight: 7},
        {term: 'funnel', weight: 7},
        {term: 'acquisition', weight: 6},
        {term: 'retention', weight: 5},
        {term: 'email marketing', weight: 8},
        {term: 'public relations', weight: 7},
        {term: 'communications', weight: 5}
      ],
      subspecialties: [
        {
          name: 'Digital Marketing',
          keywords: ['digital marketing', 'online marketing', 'seo', 'sem', 'ppc', 'google ads', 'facebook ads', 'social media marketing', 'content marketing', 'email marketing', 'marketing automation']
        },
        {
          name: 'Brand Management',
          keywords: ['brand', 'brand management', 'brand strategy', 'brand identity', 'brand positioning', 'brand development', 'brand marketing', 'brand guidelines']
        },
        {
          name: 'Market Research',
          keywords: ['market research', 'consumer insights', 'consumer behavior', 'customer research', 'focus groups', 'surveys', 'market analysis', 'competitive analysis', 'audience analysis']
        },
        {
          name: 'Product Marketing',
          keywords: ['product marketing', 'product launch', 'go-to-market', 'product positioning', 'product messaging', 'value proposition', 'product strategy', 'market requirements']
        }
      ]
    },
    {
      name: 'Sales',
      weight: 0,
      keywords: [
        {term: 'sales', weight: 10},
        {term: 'selling', weight: 9},
        {term: 'business development', weight: 8},
        {term: 'account management', weight: 9},
        {term: 'client', weight: 6},
        {term: 'customer', weight: 6},
        {term: 'revenue', weight: 7},
        {term: 'quota', weight: 10},
        {term: 'pipeline', weight: 9},
        {term: 'prospect', weight: 8},
        {term: 'lead generation', weight: 8},
        {term: 'closing', weight: 8},
        {term: 'deal', weight: 7},
        {term: 'negotiation', weight: 7},
        {term: 'territory', weight: 8},
        {term: 'forecast', weight: 7},
        {term: 'commission', weight: 8},
        {term: 'crm', weight: 7},
        {term: 'salesforce', weight: 7},
        {term: 'relationship', weight: 5}
      ],
      subspecialties: [
        {
          name: 'B2B Sales',
          keywords: ['b2b', 'business to business', 'enterprise sales', 'solution selling', 'complex sales', 'consultative selling', 'sales cycle', 'corporate clients']
        },
        {
          name: 'B2C Sales',
          keywords: ['b2c', 'business to consumer', 'retail sales', 'direct sales', 'consumer', 'customer', 'retail', 'inside sales']
        },
        {
          name: 'Account Management',
          keywords: ['account management', 'key account', 'client relationship', 'customer success', 'account growth', 'account retention', 'client management']
        },
        {
          name: 'Business Development',
          keywords: ['business development', 'partnership', 'strategic alliance', 'channel', 'reseller', 'distribution', 'market expansion', 'new business']
        }
      ]
    }
  ];
  
  // Calculate weights for each industry based on keyword matches
  industries.forEach(industry => {
    industry.keywords.forEach(keyword => {
      // Count occurrences of each keyword
      const regex = new RegExp(`\\b${keyword.term}\\b`, 'gi');
      const matches = normalizedText.match(regex) || [];
      
      // Add to industry weight
      industry.weight += matches.length * keyword.weight;
    });
  });
  
  // Sort industries by weight
  industries.sort((a, b) => b.weight - a.weight);
  
  // Default result
  let result = {
    industry: "General",
    subspecialty: null as string | null,
    confidence: 0
  };
  
  // If we have a match
  if (industries.length > 0 && industries[0].weight > 0) {
    const topIndustry = industries[0];
    
    // Calculate confidence (0-100 scale)
    // Base it on difference between top industry and second industry weight
    const maxWeight = topIndustry.weight;
    const secondWeight = industries[1]?.weight || 0;
    const weightGap = maxWeight - secondWeight;
    
    // Calculate confidence - higher if top industry has a big lead
    const confidence = Math.min(100, Math.max(50, 50 + (weightGap / maxWeight) * 50));
    
    // Set industry in result
    result.industry = topIndustry.name;
    result.confidence = Math.round(confidence);
    
    // Check for subspecialty
    if (topIndustry.subspecialties && topIndustry.subspecialties.length > 0) {
      // Score each subspecialty
      const scoredSubspecialties = topIndustry.subspecialties.map(subspecialty => {
        let score = 0;
        
        // Count matches for each keyword
        subspecialty.keywords.forEach(keyword => {
          const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
          const matches = normalizedText.match(regex) || [];
          score += matches.length;
        });
        
        return {
          name: subspecialty.name,
          score
        };
      });
      
      // Sort subspecialties by score
      scoredSubspecialties.sort((a, b) => b.score - a.score);
      
      // If we have a clear subspecialty winner
      if (scoredSubspecialties.length > 0 && scoredSubspecialties[0].score > 0) {
        result.subspecialty = scoredSubspecialties[0].name;
      }
    }
  }
  
  return result;
}