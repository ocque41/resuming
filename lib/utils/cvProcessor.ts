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
      const localAnalysis = await performLocalAnalysis(rawText);
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
    // Perform local analysis
    const localAnalysis = await performLocalAnalysis(rawText);
    
    // Calculate scores based on local analysis - using now the properties from localAnalysis
    const atsScore = localAnalysis.localAtsScore || 65;
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
      optimizedText: localAnalysis.optimizedText || rawText,
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
 * Performs local analysis on the CV text to extract structured information
 * This is used when RAG services are not available or to supplement them
 * @param cvText The raw CV text to analyze
 * @returns An object containing extracted information including experience entries
 */
export async function performLocalAnalysis(cvText: string) {
  try {
    // Extract sections from the CV text
    const sections = splitIntoSections(cvText);
    
    // Extract structured data from the sections
    const experienceEntries = extractExperienceEntries(sections);
    const skills = extractSkills(sections);
    const languageProficiency = extractLanguages(sections);
    
    // Calculate a local ATS score based on extracted data
    let localAtsScore = 65; // Base score
    
    // Adjust score based on experience entries
    if (experienceEntries.length > 0) {
      const experienceScore = Math.min(10, experienceEntries.length * 2);
      localAtsScore += experienceScore;
      
      // Check if experience entries have quantifiable achievements
      const hasQuantifiableAchievements = experienceEntries.some(entry => 
        entry.responsibilities.some(resp => 
          /\d+%|\d+x|\$\d+|\d+\s*million|\d+\s*k/i.test(resp)
        )
      );
      
      if (hasQuantifiableAchievements) {
        localAtsScore += 5;
      }
    }
    
    // Adjust score based on skills
    if (skills.length > 0) {
      const skillsScore = Math.min(10, skills.length);
      localAtsScore += skillsScore;
    }
    
    // Adjust score based on language proficiency
    if (languageProficiency.length > 0) {
      localAtsScore += 5;
    }
    
    // Cap the score at 95
    localAtsScore = Math.min(95, Math.max(30, localAtsScore));
    
    // Determine top industry based on skills and experience
    let topIndustry = 'General';
    const industryKeywords = {
      'Technology': ['software', 'developer', 'web', 'app', 'programming', 'java', 'python', 'javascript', 'react', 'angular', 'node', 'full-stack', 'frontend', 'backend', 'devops', 'cloud', 'aws', 'azure', 'it'],
      'Finance': ['finance', 'accounting', 'financial', 'investment', 'banking', 'loans', 'mortgage', 'audit', 'tax', 'budget', 'equity', 'portfolio', 'compliance', 'risk'],
      'Healthcare': ['health', 'medical', 'healthcare', 'patient', 'doctor', 'physician', 'nurse', 'hospital', 'clinic', 'therapy', 'pharmaceutical', 'dental', 'medicine'],
      'Marketing': ['marketing', 'digital', 'seo', 'sem', 'content', 'social media', 'campaign', 'brand', 'advertising', 'market research', 'analytics', 'engagement'],
      'Sales': ['sales', 'customer', 'account manager', 'business development', 'revenue', 'pipeline', 'client', 'leads', 'prospects', 'closing', 'negotiation', 'territory'],
      'Education': ['teaching', 'teacher', 'professor', 'instructor', 'curriculum', 'education', 'university', 'college', 'academic', 'faculty', 'student', 'course', 'classroom', 'learning'],
      'Engineering': ['engineering', 'engineer', 'mechanical', 'electrical', 'civil', 'chemical', 'industrial', 'product', 'design', 'manufacturing', 'CAD', 'technical', 'specifications'],
      'Human Resources': ['HR', 'human resources', 'recruitment', 'talent acquisition', 'hiring', 'onboarding', 'employee relations', 'benefits', 'compensation', 'training', 'development', 'retention'],
      'Legal': ['legal', 'lawyer', 'attorney', 'law', 'counsel', 'litigation', 'corporate', 'contract', 'compliance', 'regulatory', 'paralegal', 'judicial', 'legislation']
    };
    
    // Count industry keyword matches in the CV text
    const industryCounts: Record<string, number> = {};
    
    for (const [industry, keywords] of Object.entries(industryKeywords)) {
      industryCounts[industry] = 0;
      
      for (const keyword of keywords) {
        const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
        const matches = cvText.match(regex);
        if (matches) {
          industryCounts[industry] += matches.length;
        }
      }
    }
    
    // Find the industry with the most keyword matches
    let maxCount = 0;
    for (const [industry, count] of Object.entries(industryCounts)) {
      if (count > maxCount) {
        maxCount = count;
        topIndustry = industry;
      }
    }
    
    // Generate enhanced text based on local analysis
    const optimizedText = enhanceTextWithLocalRules(cvText, {
      experienceEntries,
      skills,
      languageProficiency,
      topIndustry
    });
    
    return {
      experienceEntries,
      skills,
      languageProficiency,
      localAtsScore,
      topIndustry,
      optimizedText
    };
  } catch (error) {
    console.error('Error in performLocalAnalysis:', error);
    return {
      experienceEntries: [],
      skills: [],
      languageProficiency: [],
      localAtsScore: 65,
      topIndustry: 'General',
      optimizedText: cvText
    };
  }
}

/**
 * Extracts structured experience entries from the CV sections
 * @param sections The CV sections extracted from the text
 * @returns An array of experience entries with structured information
 */
function extractExperienceEntries(sections: Record<string, string>): Array<{
  jobTitle: string;
  company: string;
  dateRange: string;
  location?: string;
  responsibilities: string[];
}> {
  // Get the experience section text (check different possible names)
  const experienceText = sections['experience'] || 
                        sections['work experience'] || 
                        sections['employment history'] || 
                        sections['professional experience'] || '';
  
  if (!experienceText) {
    return [];
  }
  
  // Split into lines and process
  const lines = experienceText.split('\n');
  const entries: Array<{
    jobTitle: string;
    company: string;
    dateRange: string;
    location?: string;
    responsibilities: string[];
  }> = [];
  
  let currentEntry: {
    jobTitle: string;
    company: string;
    dateRange: string;
    location?: string;
    responsibilities: string[];
  } | null = null;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.length === 0) continue;
    
    // Check if this is likely a job title (short line, not a bullet point, not a date)
    if (line.length < 60 && !line.startsWith('•') && !line.startsWith('-') && 
        !line.startsWith('*') && i < lines.length - 1 && 
        !isDateRange(line)) {
      
      // If we've been processing an entry, add it to the list before starting a new one
      if (currentEntry && currentEntry.jobTitle && currentEntry.responsibilities.length > 0) {
        entries.push(currentEntry);
      }
      
      // Start a new entry
      if (!currentEntry || currentEntry.jobTitle) {
        currentEntry = {
          jobTitle: line,
          company: '',
          dateRange: '',
          responsibilities: []
        };
      } else if (!currentEntry.company) {
        currentEntry.company = line;
      } else if (!currentEntry.dateRange && isDateRange(line)) {
        currentEntry.dateRange = line;
      } else if (!currentEntry.location && containsLocationIndicator(line)) {
        currentEntry.location = line;
      } else {
        // Could be a responsibility that's not formatted as a bullet
        currentEntry.responsibilities.push(line);
      }
    } 
    // Check if this is a date range
    else if (currentEntry && !currentEntry.dateRange && isDateRange(line)) {
      currentEntry.dateRange = line;
    }
    // Check if this is a location
    else if (currentEntry && !currentEntry.location && containsLocationIndicator(line)) {
      currentEntry.location = line;
    }
    // Check if this is a bullet point for responsibilities
    else if (currentEntry && (line.startsWith('•') || line.startsWith('-') || line.startsWith('*'))) {
      currentEntry.responsibilities.push(line.substring(1).trim());
    }
    // Otherwise, it's likely a regular line of text describing responsibilities
    else if (currentEntry) {
      currentEntry.responsibilities.push(line);
    }
  }
  
  // Add the last entry if we were processing one
  if (currentEntry && currentEntry.jobTitle && currentEntry.responsibilities.length > 0) {
    entries.push(currentEntry);
  }
  
  return entries;
}

/**
 * Checks if a text string is likely a date range
 * @param text The text to check
 * @returns true if the text is likely a date range
 */
function isDateRange(text: string): boolean {
  // Look for common date range patterns
  const datePatterns = [
    /\b(19|20)\d{2}\s*(-|–|—|to)\s*(19|20)\d{2}\b/i, // YYYY-YYYY
    /\b(19|20)\d{2}\s*(-|–|—|to)\s*(present|current|now)\b/i, // YYYY-Present
    /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s*(19|20)\d{2}\s*(-|–|—|to)/i, // Month YYYY-
    /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s*\d{4}\b/i, // Month YYYY
  ];
  
  return datePatterns.some(pattern => pattern.test(text));
}

/**
 * Checks if a text string is likely a location
 * @param text The text to check
 * @returns true if the text is likely a location
 */
function containsLocationIndicator(text: string): boolean {
  // Look for location patterns
  const locationPatterns = [
    /\b(remote|on-site|hybrid)\b/i,
    /\b[A-Z][a-z]+,\s*[A-Z]{2}\b/, // City, STATE
    /\b[A-Z][a-z]+,\s*[A-Z][a-z]+\b/, // City, State
    /\b[A-Z]{2,3},\s*USA\b/, // STATE, USA
    /\bUnited States\b/,
    /\bUSA\b/,
    /\bLocation:/i,
    /\bBased in\b/i
  ];
  
  return locationPatterns.some(pattern => pattern.test(text));
}

/**
 * Extracts skills from CV sections
 * @param sections The CV sections
 * @returns Array of extracted skills
 */
function extractSkills(sections: Record<string, string>): string[] {
  // Get the skills section (check different possible names)
  const skillsText = sections['skills'] || 
                    sections['technical skills'] || 
                    sections['core competencies'] || 
                    sections['competencies'] || '';
  
  if (!skillsText) {
    return [];
  }
  
  // Split and clean up skills
  const skills: string[] = [];
  const lines = skillsText.split('\n');
  
  for (const line of lines) {
    const trimmedLine = line.trim();
    if (trimmedLine.length === 0) continue;
    
    // Try to handle different formats of skills sections
    
    // Check if this is a bullet point
    if (trimmedLine.startsWith('•') || trimmedLine.startsWith('-') || trimmedLine.startsWith('*')) {
      skills.push(trimmedLine.substring(1).trim());
    }
    // Check if this line contains comma-separated skills
    else if (trimmedLine.includes(',')) {
      const skillsInLine = trimmedLine.split(',').map(s => s.trim()).filter(s => s.length > 0);
      skills.push(...skillsInLine);
    }
    // Otherwise add the whole line as a single skill
    else {
      skills.push(trimmedLine);
    }
  }
  
  return skills;
}

/**
 * Extracts language proficiency information
 * @param sections The CV sections
 * @returns Array of language proficiency entries
 */
function extractLanguages(sections: Record<string, string>): Array<{
  language: string;
  proficiency?: string;
}> {
  // Get the languages section (check different possible names)
  const languagesText = sections['languages'] || 
                        sections['language proficiency'] || 
                        sections['language skills'] || '';
  
  if (!languagesText) {
    return [];
  }
  
  // Parse languages
  const languages: Array<{
    language: string;
    proficiency?: string;
  }> = [];
  
  const lines = languagesText.split('\n');
  for (const line of lines) {
    const trimmedLine = line.trim();
    if (trimmedLine.length === 0) continue;
    
    // Check for common formats of language entries
    const colonIndex = trimmedLine.indexOf(':');
    const dashIndex = trimmedLine.indexOf('-');
    const commaIndex = trimmedLine.indexOf(',');
    const parenthesisIndex = trimmedLine.indexOf('(');
    
    let separatorIndex = -1;
    let separator = '';
    
    if (colonIndex > 0) {
      separatorIndex = colonIndex;
      separator = ':';
    } else if (dashIndex > 0 && trimmedLine.charAt(dashIndex-1) === ' ' && trimmedLine.charAt(dashIndex+1) === ' ') {
      separatorIndex = dashIndex;
      separator = '-';
    } else if (commaIndex > 0) {
      separatorIndex = commaIndex;
      separator = ',';
    } else if (parenthesisIndex > 0) {
      separatorIndex = parenthesisIndex;
      separator = '(';
    }
    
    if (separatorIndex > 0) {
      // Split line into language and proficiency
      const language = trimmedLine.substring(0, separatorIndex).trim();
      let proficiency = '';
      
      if (separator === '(') {
        const closingIndex = trimmedLine.indexOf(')', separatorIndex);
        proficiency = closingIndex > 0 
          ? trimmedLine.substring(separatorIndex + 1, closingIndex).trim()
          : trimmedLine.substring(separatorIndex + 1).trim();
      } else {
        proficiency = trimmedLine.substring(separatorIndex + 1).trim();
      }
      
      languages.push({ language, proficiency });
    } else {
      // Just a language name
      languages.push({ language: trimmedLine });
    }
  }
  
  return languages;
}

/**
 * Splits the CV text into separate sections based on common headers
 * @param cvText The full CV text
 * @returns An object containing the text of each identified section
 */
function splitIntoSections(cvText: string): Record<string, string> {
  const sections: Record<string, string> = {};
  
  // Define common section headers to look for
  const sectionHeaders = {
    'header': /^(?!.*(experience|education|skills|languages|profile|summary|objective))/i,
    'profile': /\b(profile|summary|about me|professional summary|objective)\b/i,
    'experience': /\b(experience|work experience|employment history|professional experience)\b/i,
    'education': /\b(education|educational background|academic qualifications|academic background)\b/i,
    'skills': /\b(skills|technical skills|core competencies|competencies|expertise)\b/i,
    'languages': /\b(languages|language proficiency|language skills)\b/i,
    'certifications': /\b(certifications|certificates|qualifications|professional development)\b/i,
    'projects': /\b(projects|key projects|professional projects)\b/i,
    'references': /\b(references|testimonials)\b/i
  };
  
  // Split the CV text into lines
  const lines = cvText.split('\n');
  
  // Initialize a variable to track the current section
  let currentSection = 'header';
  sections[currentSection] = '';
  
  // Identify sections and extract their content
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.length === 0) {
      // Add an empty line to the current section
      sections[currentSection] += '\n';
      continue;
    }
    
    // Check if this line contains a section header
    let foundNewSection = false;
    for (const [sectionName, pattern] of Object.entries(sectionHeaders)) {
      if (sectionName !== 'header' && pattern.test(line) && line.length < 50) {
        // Found a new section
        currentSection = sectionName;
        if (!sections[currentSection]) {
          sections[currentSection] = '';
        }
        foundNewSection = true;
        break;
      }
    }
    
    if (!foundNewSection) {
      // Add the line to the current section
      if (sections[currentSection].length > 0 && !sections[currentSection].endsWith('\n')) {
        sections[currentSection] += '\n';
      }
      sections[currentSection] += line;
    }
  }
  
  // Clean up sections
  for (const sectionName in sections) {
    sections[sectionName] = sections[sectionName].trim();
  }
  
  return sections;
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