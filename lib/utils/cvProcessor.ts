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
import { analyzeAndOptimizeWithGPT4o } from '@/lib/services/openaiOptimizer';
import { isOpenAIAvailable } from '@/lib/services/openai.service';

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
          
          try {
            // Check if OpenAI is available
            const openaiAvailable = await isOpenAIAvailable();
            if (!openaiAvailable) {
              throw new Error('OpenAI service is not available');
            }
            
            logger.info(`Attempting OpenAI analysis for CV ID: ${cvId}`);
            await updateProgress('openai_analysis_in_progress', 25);
            
            // Create a promise for the analyze-cv API call
            const apiAnalysisPromise = fetch(`${process.env.NEXT_PUBLIC_APP_URL || ''}/api/analyze-cv?fileName=cv.pdf&cvId=${cvId}`)
              .then(response => {
                if (!response.ok) {
                  throw new Error(`API returned status ${response.status}`);
                }
                return response.json();
              })
              .then(data => {
                if (!data.success || !data.analysisResult) {
                  throw new Error('API returned unsuccessful response');
                }
                return data.analysisResult;
              });
            
            // Set a timeout for the API call
            const apiTimeoutPromise = new Promise((_, reject) => {
              setTimeout(() => reject(new Error('API analysis timed out')), 15000); // 15 seconds timeout
            });
            
            // Race the API call against the timeout
            analysis = await Promise.race([apiAnalysisPromise, apiTimeoutPromise]);
            logger.info(`Successfully completed OpenAI analysis for CV ID: ${cvId}`);
          } catch (openaiError) {
            // Log the OpenAI error
            logger.error(`OpenAI analysis failed for CV ID: ${cvId}: ${openaiError instanceof Error ? openaiError.message : String(openaiError)}`);
            
            // Fallback to local analysis with basic enhancement
            logger.info(`Falling back to local analysis for CV ID: ${cvId}`);
            await updateProgress('fallback_analysis_in_progress', 30);
            
            // Perform a quick local analysis
            analysis = {
              atsScore: localAnalysis.localAtsScore || 65, // Default score
              industry: localAnalysis.topIndustry || 'General',
              strengths: ["Clear presentation of professional experience", "Includes contact information", "Lists relevant skills"],
              weaknesses: ["Could benefit from more quantifiable achievements", "May need more specific examples of skills application", "Consider adding more industry-specific keywords"],
              recommendations: [
                'Add more quantifiable achievements',
                'Include more industry-specific keywords',
                'Ensure your CV is tailored to each job application'
              ],
              formatStrengths: ["Organized structure", "Consistent formatting", "Clear section headings"],
              formatWeaknesses: ["Could improve visual hierarchy", "Consider adding more white space", "Ensure consistent alignment"],
              formatRecommendations: [
                'Use bullet points for achievements',
                'Ensure consistent formatting throughout',
                'Use a clean, professional layout'
              ]
            };
            
            logger.info(`Completed fallback analysis for CV ID: ${cvId}`);
          }
          
          await updateProgress('analysis_complete', 40);
        }
        
        // Store the analysis in the metadata
        updatedMetadata = {
          ...updatedMetadata,
          analysis,
          atsScore: analysis.atsScore,
          industry: analysis.industry,
          strengths: analysis.strengths,
          weaknesses: analysis.weaknesses,
          recommendations: analysis.recommendations,
          formattingStrengths: analysis.formatStrengths,
          formattingWeaknesses: analysis.formatWeaknesses,
          formattingRecommendations: analysis.formatRecommendations,
          lastUpdated: new Date().toISOString()
        };
        
        await updateCVMetadata(cvId, updatedMetadata);
        
        trackEvent({
          eventType: 'checkpoint_reached',
          cvId,
          timestamp: new Date().toISOString(),
          phase: 'analysis'
        });
      } else {
        // Use existing analysis from metadata
        analysis = {
          atsScore: currentMetadata.atsScore,
          industry: currentMetadata.industry,
          strengths: currentMetadata.strengths,
          weaknesses: currentMetadata.weaknesses,
          recommendations: currentMetadata.recommendations,
          formatStrengths: currentMetadata.formattingStrengths,
          formatWeaknesses: currentMetadata.formattingWeaknesses,
          formatRecommendations: currentMetadata.formattingRecommendations
        };
        
        await updateProgress('using_existing_analysis', 40);
      }
      
      // Phase 3: Optimize the CV with AI
      if (startingPhase !== 'complete') {
        await updateProgress('optimization_starting', 45);
        
        try {
          // Check if OpenAI is available
          const openaiAvailable = await isOpenAIAvailable();
          if (!openaiAvailable) {
            throw new Error('OpenAI service is not available');
          }
          
          logger.info(`Starting CV optimization with OpenAI for CV ID: ${cvId}`);
          await updateProgress('openai_optimization_in_progress', 50);
          
          // Set a timeout for the optimization
          const optimizationPromise = analyzeAndOptimizeWithGPT4o(rawText, "Perform optimization");
          const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Optimization timed out')), MAX_OPTIMIZATION_TIME);
          });
          
          // Race the optimization against the timeout
          const optimizationResult = await Promise.race([optimizationPromise, timeoutPromise]) as {
            optimizedContent: string;
            matchScore: number;
            recommendations: string[];
            cvAnalysis: any;
          };
          
          // Extract the optimized text
          enhancedText = optimizationResult.optimizedContent;
          
          logger.info(`Successfully completed OpenAI optimization for CV ID: ${cvId}`);
          await updateProgress('optimization_complete', 85);
        } catch (error) {
          // Log the error
          logger.error(`OpenAI optimization failed for CV ID: ${cvId}: ${error instanceof Error ? error.message : String(error)}`);
          
          // Fallback to local enhancement
          logger.info(`Falling back to local enhancement for CV ID: ${cvId}`);
          await updateProgress('fallback_optimization_in_progress', 60);
          
          // Enhance the text with local rules
          enhancedText = enhanceTextWithLocalRules(rawText, localAnalysis);
          
          logger.info(`Completed fallback enhancement for CV ID: ${cvId}`);
          await updateProgress('fallback_optimization_complete', 85);
        }
        
        // Store the optimized text
        updatedMetadata = {
          ...updatedMetadata,
          optimized: true,
          optimizedText: enhancedText,
          optimizationCompleted: true,
          optimizationCompletedAt: new Date().toISOString(),
          lastUpdated: new Date().toISOString()
        };
        
        await updateCVMetadata(cvId, updatedMetadata);
        
        trackEvent({
          eventType: 'checkpoint_reached',
          cvId,
          timestamp: new Date().toISOString(),
          phase: 'optimization'
        });
      } else {
        // Use existing optimized text
        enhancedText = currentMetadata.optimizedText;
        await updateProgress('using_existing_optimization', 85);
      }
      
      // Phase 4: Finalize processing
      await updateProgress('finalizing', 90);
      
      // Calculate processing time
      const processingEndTime = Date.now();
      const processingTimeMs = processingEndTime - processingStartTime;
      
      // Update final metadata
      updatedMetadata = {
        ...updatedMetadata,
        processing: false,
        processingCompleted: true,
        processingCompletedAt: new Date().toISOString(),
        processingTime: processingTimeMs,
        processingStatus: 'completed',
        processingProgress: 100,
        lastUpdated: new Date().toISOString()
      };
      
      await updateCVMetadata(cvId, updatedMetadata);
      
      // Track the processing completion event
      trackEvent({
        eventType: 'process_complete',
        cvId,
        userId,
        timestamp: new Date().toISOString(),
        duration: processingTimeMs
      });
      
      logger.info(`CV processing completed for CV ID: ${cvId} in ${processingTimeMs}ms`);
      
      return {
        success: true,
        cvId,
        analysis,
        enhancedText,
        processingTime: processingTimeMs
      };
    } catch (error) {
      // Handle any errors in the processing pipeline
      logger.error(`Error in CV processing pipeline for CV ID: ${cvId}: ${error instanceof Error ? error.message : String(error)}`);
      
      // Update metadata with error information
      updatedMetadata = {
        ...updatedMetadata,
        processing: false,
        processingError: true,
        processingErrorMessage: error instanceof Error ? error.message : String(error),
        processingStatus: 'error',
        lastUpdated: new Date().toISOString()
      };
      
      await updateCVMetadata(cvId, updatedMetadata);
      
      // Track the error event
      trackEvent({
        eventType: 'process_error',
        cvId,
        userId,
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : String(error)
      });
      
      return {
        success: false,
        cvId,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  } catch (outerError) {
    // Handle any errors outside the main try/catch block
    logger.error(`Critical error in CV processing for CV ID: ${cvId}: ${outerError instanceof Error ? outerError.message : String(outerError)}`);
    
    return {
      success: false,
      cvId,
      error: outerError instanceof Error ? outerError.message : String(outerError)
    };
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
 * Perform quick analysis with OpenAI
 */
async function performQuickAnalysis(rawText: string, localAnalysis: any): Promise<any> {
  try {
    // Check if OpenAI is available
    const openaiAvailable = await isOpenAIAvailable();
    if (!openaiAvailable) {
      throw new Error('OpenAI service is not available');
    }
    
    // Use OpenAI for analysis
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are a fast CV analyzer. Return ONLY valid JSON with the requested fields."
        },
        {
          role: "user",
          content: `
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
          `
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
      max_tokens: 800,
    });
    
    const responseText = response.choices[0]?.message?.content || "{}";
    let analysis;
    
    try {
      analysis = JSON.parse(responseText);
    } catch (e) {
      logger.error(`Failed to parse analysis JSON: ${e instanceof Error ? e.message : String(e)}`);
      
      // Return the local analysis as fallback
      return {
        atsScore: localAnalysis.localAtsScore || 65,
        industry: localAnalysis.topIndustry || 'General',
        strengths: ["Clear presentation of professional experience", "Includes contact information", "Lists relevant skills"],
        weaknesses: ["Could benefit from more quantifiable achievements", "May need more specific examples of skills application", "Consider adding more industry-specific keywords"],
        recommendations: [
          'Add more quantifiable achievements',
          'Include more industry-specific keywords',
          'Ensure your CV is tailored to each job application'
        ],
        formatStrengths: ["Organized structure", "Consistent formatting", "Clear section headings"],
        formatWeaknesses: ["Could improve visual hierarchy", "Consider adding more white space", "Ensure consistent alignment"],
        formatRecommendations: [
          'Use bullet points for achievements',
          'Ensure consistent formatting throughout',
          'Use a clean, professional layout'
        ]
      };
    }
    
    return analysis;
  } catch (error) {
    logger.error(`Error in quick analysis: ${error instanceof Error ? error.message : String(error)}`);
    
    // Return the local analysis as fallback
    return {
      atsScore: localAnalysis.localAtsScore || 65,
      industry: localAnalysis.topIndustry || 'General',
      strengths: ["Clear presentation of professional experience", "Includes contact information", "Lists relevant skills"],
      weaknesses: ["Could benefit from more quantifiable achievements", "May need more specific examples of skills application", "Consider adding more industry-specific keywords"],
      recommendations: [
        'Add more quantifiable achievements',
        'Include more industry-specific keywords',
        'Ensure your CV is tailored to each job application'
      ],
      formatStrengths: ["Organized structure", "Consistent formatting", "Clear section headings"],
      formatWeaknesses: ["Could improve visual hierarchy", "Consider adding more white space", "Ensure consistent alignment"],
      formatRecommendations: [
        'Use bullet points for achievements',
        'Ensure consistent formatting throughout',
        'Use a clean, professional layout'
      ]
    };
  }
}

/**
 * Perform quick optimization with OpenAI
 */
async function performQuickOptimization(rawText: string, analysis: any): Promise<string> {
  try {
    // Check if OpenAI is available
    const openaiAvailable = await isOpenAIAvailable();
    if (!openaiAvailable) {
      throw new Error('OpenAI service is not available');
    }
    
    // Use OpenAI for optimization
    const result = await analyzeAndOptimizeWithGPT4o(rawText, "Perform optimization");
    return result.optimizedContent;
  } catch (error) {
    logger.error(`Error in quick optimization: ${error instanceof Error ? error.message : String(error)}`);
    
    // Return enhanced text with local rules as fallback
    return enhanceTextWithLocalRules(rawText, analysis);
  }
}

/**
 * Performs a local analysis of CV text to supplement AI analysis
 * @param text The raw CV text to analyze
 * @returns Local analysis results
 */
function performLocalAnalysis(text: string) {
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
    localAtsScore
  };
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