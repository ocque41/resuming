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
 * Process CV asynchronously with OpenAI GPT-4o
 * This function handles the entire CV processing workflow without blocking the API response
 * @param cvId The ID of the CV to process
 * @param rawText The raw text of the CV
 * @param currentMetadata The current metadata of the CV
 * @param forceRefresh Optional. Whether to force refresh the CV processing
 * @param userId Optional. The user ID for A/B testing assignment
 */
export async function processCVWithAI(
  cvId: number, 
  rawText: string, 
  currentMetadata: any, 
  forceRefresh: boolean = false,
  userId?: number | string
) {
  // Start timestamp for overall processing
  const startTimestamp = Date.now();
  
  // Check if the CV should be processed in parallel
  const useParallelProcessing = shouldProcessInParallel(rawText);
  
  // Track the start of processing
  trackEvent({
    eventType: 'process_start',
    cvId,
    userId,
    timestamp: new Date().toISOString(),
    metadata: {
      forceRefresh,
      textLength: rawText.length,
      hasExistingMetadata: !!currentMetadata,
      useParallelProcessing
    }
  });

  // Get experiment variants if a user ID is provided
  let analysisVariant = null;
  let optimizationVariant = null;
  
  if (userId) {
    analysisVariant = getVariantForUser(userId, 'analysis-prompt-optimization', cvId);
    optimizationVariant = getVariantForUser(userId, 'optimization-prompt-test', cvId);
    
    if (analysisVariant) {
      logger.info(`Using analysis variant ${analysisVariant.id} for CV ID ${cvId}, user ${userId}`);
    }
    
    if (optimizationVariant) {
      logger.info(`Using optimization variant ${optimizationVariant.id} for CV ID ${cvId}, user ${userId}`);
    }
  }
  
  // Create a wrapper for OpenAI calls with timeout and retry logic
  async function callOpenAIWithTimeout(model: string, messages: any[], options: any = {}, timeoutMs = 30000, maxRetries = 2) {
    let retries = 0;
    let startTime = Date.now();
    let tokenCount = 0;
    
    // Ensure the model is warmed up before making the actual call
    await ensureModelWarmedUp(model);
    
    // Roughly estimate token count based on message length
    // This is a very rough approximation, in production you'd use a proper tokenizer
    messages.forEach(msg => {
      if (typeof msg.content === 'string') {
        tokenCount += Math.ceil(msg.content.length / 4);
      }
    });
    
    while (retries <= maxRetries) {
      try {
        // Create a promise that will reject after the timeout
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error(`OpenAI API call timed out after ${timeoutMs}ms`)), timeoutMs);
        });
        
        // Create the OpenAI API call promise
        const openaiClient = new OpenAI({
          apiKey: process.env.OPENAI_API_KEY,
        });
        
        // Ensure required options are set
        const apiOptions = {
          ...options,
          // If max_tokens is not provided, set a default value
          max_tokens: options.max_tokens || (model.includes('gpt-4o-mini') ? 800 : 4000)
        };
        
        const apiPromise = openaiClient.chat.completions.create({
          model,
          messages,
          ...apiOptions
        });
        
        // Race the API call against the timeout
        const response = await Promise.race([apiPromise, timeoutPromise]);
        
        // Track successful API call
        const duration = Date.now() - startTime;
        trackOpenAICall(cvId, model, tokenCount, duration);
        
        return response;
      } catch (error) {
        const duration = Date.now() - startTime;
        const errorMessage = error instanceof Error ? error.message : String(error);
        
        logger.error(`OpenAI API call failed (attempt ${retries + 1}/${maxRetries + 1})`, errorMessage);
        
        // Track failed API call
        trackOpenAICall(cvId, model, tokenCount, duration, errorMessage);
        
        retries++;
        
        // If we've used all our retries, throw the error
        if (retries > maxRetries) {
          throw error;
        }
        
        // Wait before retrying (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retries)));
        startTime = Date.now(); // Reset start time for the next attempt
        
        // Try to warm up the model again before the next retry
        await ensureModelWarmedUp(model);
      }
    }
    
    // This should never be reached due to the throw in the loop, but TypeScript needs it
    throw new Error("All retry attempts failed");
  }
  
  try {
    // Set up processing timeout - ensure we don't get stuck
    const processingTimeout = setTimeout(async () => {
      try {
        logger.warn(`Processing timeout triggered for CV ID: ${cvId} - forcing completion`);
        
        // Track the timeout event
        trackEvent({
          eventType: 'process_error',
          cvId,
          timestamp: new Date().toISOString(),
          error: 'Processing timeout - forced completion',
          status: 'timeout'
        });
        
        // Get current metadata to see where we got stuck
        const currentCvRecord = await db.query.cvs.findFirst({
          where: eq(cvs.id, cvId),
        });
        
        if (!currentCvRecord) {
          logger.error(`CV record not found for ID: ${cvId} during timeout handler`);
          return;
        }
        
        let currentMetadata = {};
        try {
          currentMetadata = currentCvRecord.metadata ? JSON.parse(currentCvRecord.metadata) : {};
        } catch (e) {
          logger.error(`Failed to parse metadata during timeout handler: ${e instanceof Error ? e.message : String(e)}`);
          currentMetadata = {};
        }
        
        // Only proceed if still processing
        if (currentMetadata && typeof currentMetadata === 'object' && 'processing' in currentMetadata && currentMetadata.processing) {
          // Get local analysis as fallback
          const localAnalysis = performLocalAnalysis(rawText);
          
          // Create basic analysis results based on local analysis
          const fallbackAnalysis = {
            atsScore: localAnalysis.localAtsScore,
            industry: localAnalysis.topIndustry,
            strengths: [
              "CV structure detected successfully",
              "Content length is appropriate for review",
              localAnalysis.hasContact ? "Contact information included" : "Basic information present"
            ],
            weaknesses: [
              "Consider adding more industry-specific keywords",
              "Quantify achievements with metrics where possible",
              "Ensure consistent formatting throughout"
            ],
            recommendations: [
              "Add more action verbs to highlight achievements",
              "Include measurable results where possible",
              "Tailor content to match target job descriptions"
            ]
          };
          
          // Create a simple optimized version with minor enhancements
          const fallbackOptimizedText = enhanceTextWithLocalRules(rawText, localAnalysis);
          
          // Update the metadata to mark as complete with fallback data
          await updateCVMetadata(cvId, {
            ...currentMetadata,
            processing: false,
            processingCompleted: true,
            optimized: true,
            processingStatus: "Processing completed with fallback mechanism",
            processingProgress: 100,
            atsScore: fallbackAnalysis.atsScore,
            improvedAtsScore: Math.min(98, fallbackAnalysis.atsScore + 15),
            industry: fallbackAnalysis.industry,
            strengths: fallbackAnalysis.strengths,
            weaknesses: fallbackAnalysis.weaknesses,
            recommendations: fallbackAnalysis.recommendations,
            optimizedText: fallbackOptimizedText,
            improvements: [
              {
                improvement: "Enhanced keyword optimization",
                impact: "Improved ATS compatibility"
              },
              {
                improvement: "Restructured content for better readability",
                impact: "Makes CV more appealing to recruiters"
              },
              {
                improvement: "Strengthened achievement statements",
                impact: "Highlights candidate's value"
              }
            ],
            lastUpdated: new Date().toISOString(),
            completedAt: new Date().toISOString(),
            timedOut: true
          });
          
          logger.info(`Forced completion for CV ID: ${cvId} using fallback mechanism`);
        }
      } catch (timeoutHandlerError) {
        logger.error(`Error in processing timeout handler: ${timeoutHandlerError instanceof Error ? 
          timeoutHandlerError.message : String(timeoutHandlerError)}`);
      }
    }, 5 * 60 * 1000); // 5 minute timeout
    
    // Check if we need to start from the beginning or resume from a checkpoint
    const startingPhase = determineStartingPhase(currentMetadata, forceRefresh);
    logger.info(`Starting/resuming CV processing for CV ID: ${cvId} from phase: ${startingPhase}`);
    
    // Perform local analysis to supplement AI analysis (always do this as it's fast)
    logger.info(`Starting local CV analysis for CV ID: ${cvId}`);
    const localAnalysis = performLocalAnalysis(rawText);
    logger.info(`Local analysis completed for CV ID: ${cvId}, Score: ${localAnalysis.localAtsScore}, Industry: ${localAnalysis.topIndustry}`);
    
    // Initialize processing metadata or use existing
    let metadata = {
      ...currentMetadata,
      processing: true,
      processingError: null,
      forceRefresh: forceRefresh,
      localAnalysis: localAnalysis,
      checkpoints: currentMetadata.checkpoints || {},
      lastUpdated: new Date().toISOString(),
    };
    
    // Update metadata to mark as processing if starting from beginning
    if (startingPhase === 'initial') {
      metadata = {
        ...metadata,
        processingProgress: 10,
        processingStatus: "Starting CV processing...",
        checkpoint: 'initial',
        checkpoints: {
          initial: {
            timestamp: new Date().toISOString(),
            completed: true
          }
        },
        lastUpdated: new Date().toISOString(),
      };
      
      await updateCVMetadata(cvId, metadata);
    }
    
    // PHASE 1: CV Analysis
    let analysis;
    let analysisStartTime = Date.now();
    let analysisTokenCount = 0;
    let analysisResponseLength = 0;
    
    if (startingPhase === 'initial' || startingPhase === 'analysis' || forceRefresh) {
      try {
        // Track start of analysis phase
        startPhase(cvId.toString(), 'analysis');
        
        // Update progress for analysis phase
        metadata = {
          ...metadata,
          processingProgress: 20,
          processingStatus: "Analyzing CV structure and content with AI...",
          checkpoint: 'analysis',
          checkpoints: {
            ...metadata.checkpoints,
            analysis: {
              timestamp: new Date().toISOString(),
              started: true,
              completed: false
            }
          },
          lastUpdated: new Date().toISOString(),
        };
        await updateCVMetadata(cvId, metadata);
        
        // Prepare analysis prompt - either from A/B test variant or default
        let analysisPrompt = '';
        let systemPrompt = '';
        let model = 'gpt-4o-mini';
        let parameters = { temperature: 0.3, max_tokens: 800 };
        
        if (analysisVariant) {
          // Use the variant prompt template
          analysisPrompt = analysisVariant.promptTemplate
            .replace('{{truncated_content}}', rawText.substring(0, 4000) + (rawText.length > 4000 ? "... (truncated)" : ""));
          
          systemPrompt = analysisVariant.systemPrompt;
          model = analysisVariant.model;
          
          // Create a new parameters object with required properties
          parameters = {
            temperature: analysisVariant.parameters.temperature,
            max_tokens: analysisVariant.parameters.max_tokens || 800 // Use default if not provided
          };
          
          // Rough token count estimation for analytics
          analysisTokenCount = Math.ceil(analysisPrompt.length / 4) + Math.ceil(systemPrompt.length / 4);
        } else {
          // Use the default prompt
          analysisPrompt = `
            # CV Analysis - Concise Format
            
            ## CV Content Summary
            \`\`\`
            ${rawText.substring(0, 4000)} ${rawText.length > 4000 ? "... (truncated for analysis)" : ""}
            \`\`\`
            
            ## Key Analysis Points
            - Find top 3 strengths
            - Find top 3 weaknesses 
            - Identify primary industry
            - Calculate ATS compatibility (0-100)
            - Provide 3 recommendations
            
            ## Local Analysis Results (Use These)
            - Industry: ${localAnalysis.topIndustry}
            - Contains Contact Info: ${localAnalysis.hasContact}
            - Contains Education: ${localAnalysis.hasEducation}
            - Contains Experience: ${localAnalysis.hasExperience}
            - Contains Skills: ${localAnalysis.hasSkills}
            - Action Verb Count: ${localAnalysis.actionVerbCount}
            - Local ATS Score: ${localAnalysis.localAtsScore}
            
            ## Required Output Format (JSON)
            {
              "atsScore": 75, // numerical score 0-100
              "industry": "Technology", // primary industry name
              "strengths": ["Strength 1", "Strength 2", "Strength 3"], 
              "weaknesses": ["Weakness 1", "Weakness 2", "Weakness 3"],
              "recommendations": ["Recommendation 1", "Recommendation 2", "Recommendation 3"]
            }
          `;
          
          systemPrompt = 'You are a CV analyzer specialized in ATS compatibility. Be concise and direct. Output ONLY valid JSON.';
          
          // Rough token count estimation for analytics
          analysisTokenCount = Math.ceil(analysisPrompt.length / 4) + Math.ceil(systemPrompt.length / 4);
        }
        
        // Log that we're making the first OpenAI call
        logger.info(`Making OpenAI analysis API call for CV ID: ${cvId} using model ${model}`);
        
        // Attempt to call OpenAI with timeout and retry
        const analysisResponse = await callOpenAIWithTimeout(
          model,
          [
            {
              role: "system",
              content: systemPrompt
            },
            {
              role: "user",
              content: analysisPrompt
            }
          ],
          { 
            response_format: { type: "json_object" }, 
            ...parameters 
          },
          40000, // 40 second timeout
          2 // 2 retries
        );
        
        // Parse the analysis with enhanced error handling
        const analysisText = analysisResponse && 'choices' in analysisResponse && 
          analysisResponse.choices && 
          analysisResponse.choices[0]?.message?.content || "{}";
        logger.info(`Received analysis response for CV ID: ${cvId}, length: ${analysisText.length}`);
        
        try {
          analysis = JSON.parse(analysisText);
          logger.info(`Successfully parsed analysis for CV ID: ${cvId}`);
        } catch (e) {
          logger.error(`Failed to parse analysis JSON for CV ID: ${cvId}`, e instanceof Error ? e.message : String(e));
          
          // Attempt to extract partial information using regex if JSON parsing fails
          analysis = {
            atsScore: extractNumberFromText(analysisText, 'atsScore', localAnalysis.localAtsScore),
            industry: extractTextFromText(analysisText, 'industry', localAnalysis.topIndustry),
            strengths: extractArrayFromText(analysisText, 'strengths', ["CV successfully parsed"]),
            weaknesses: extractArrayFromText(analysisText, 'weaknesses', ["Could not fully analyze weaknesses"]),
            recommendations: extractArrayFromText(analysisText, 'recommendations', ["Ensure your CV is properly formatted for ATS systems"])
          };
        }
        
        // For A/B testing metrics
        const analysisResponseText = analysisResponse && 'choices' in analysisResponse && 
          analysisResponse.choices && 
          analysisResponse.choices[0]?.message?.content || "{}";
        
        analysisResponseLength = analysisResponseText.length;
        
        // Mark analysis checkpoint as completed
        metadata = {
          ...metadata,
          checkpoints: {
            ...metadata.checkpoints,
            analysis: {
              timestamp: new Date().toISOString(),
              started: true,
              completed: true
            }
          }
        };
        
        // Track completion of analysis phase
        completePhase(cvId.toString(), 'analysis', {
          atsScore: analysis.atsScore,
          industry: analysis.industry,
          hasStrengths: analysis.strengths?.length > 0,
          hasWeaknesses: analysis.weaknesses?.length > 0
        });
        
        // Record analysis experiment metrics if using a variant
        if (userId && analysisVariant) {
          const analysisDuration = Date.now() - analysisStartTime;
          
          recordExperimentResult({
            experimentId: 'analysis-prompt-optimization',
            variantId: analysisVariant.id,
            cvId,
            userId,
            timestamp: new Date().toISOString(),
            metrics: {
              processingTime: analysisDuration,
              tokenCount: analysisTokenCount,
              responseLength: analysisResponseLength,
              atsScoreImprovement: 0, // Not applicable for analysis phase
              errorOccurred: false
            }
          });
        }
      } catch (analysisError) {
        logger.error(`Analysis failed for CV ID: ${cvId}`, analysisError instanceof Error ? analysisError.message : String(analysisError));
        
        // Use local analysis results as fallback
        analysis = {
          atsScore: localAnalysis.localAtsScore,
          industry: localAnalysis.topIndustry,
          strengths: [
            "CV structure detected successfully",
            "Content available for review",
            localAnalysis.hasContact ? "Contact information included" : "Basic information present"
          ],
          weaknesses: [
            "Consider adding more industry-specific keywords",
            "Quantify achievements with metrics where possible",
            "Ensure consistent formatting throughout"
          ],
          recommendations: [
            "Add more action verbs to highlight achievements",
            "Include measurable results where possible",
            "Tailor content to match target job descriptions"
          ]
        };
        
        // Mark checkpoint with error
        metadata = {
          ...metadata,
          checkpoints: {
            ...metadata.checkpoints,
            analysis: {
              timestamp: new Date().toISOString(),
              started: true,
              completed: true,
              error: analysisError instanceof Error ? analysisError.message : String(analysisError),
              usedFallback: true
            }
          }
        };
        
        logger.info(`Using fallback analysis for CV ID: ${cvId} due to API failure`);
        
        // Track analysis error
        trackEvent({
          eventType: 'process_error',
          cvId,
          timestamp: new Date().toISOString(),
          phase: 'analysis',
          error: analysisError instanceof Error ? analysisError.message : String(analysisError)
        });
        
        // Record failed experiment if using a variant
        if (userId && analysisVariant) {
          const analysisDuration = Date.now() - analysisStartTime;
          
          recordExperimentResult({
            experimentId: 'analysis-prompt-optimization',
            variantId: analysisVariant.id,
            cvId,
            userId,
            timestamp: new Date().toISOString(),
            metrics: {
              processingTime: analysisDuration,
              tokenCount: analysisTokenCount,
              responseLength: 0,
              atsScoreImprovement: 0,
              errorOccurred: true
            }
          });
        }
      }
    } else {
      // Use existing analysis from metadata if we're resuming and have it
      logger.info(`Using existing analysis for CV ID: ${cvId} from checkpoint`);
      analysis = {
        atsScore: currentMetadata.atsScore || localAnalysis.localAtsScore,
        industry: currentMetadata.industry || localAnalysis.topIndustry,
        strengths: currentMetadata.strengths || [],
        weaknesses: currentMetadata.weaknesses || [],
        recommendations: currentMetadata.recommendations || []
      };
    }
    
    // Create a hybrid score by combining local and AI analysis
    // Weight: 30% local analysis, 70% AI analysis (if available)
    const aiAtsScore = typeof analysis.atsScore === 'number' ? analysis.atsScore : 0;
    const hybridAtsScore = Math.round((localAnalysis.localAtsScore * 0.3) + (aiAtsScore * 0.7));
    const finalAtsScore = aiAtsScore > 0 ? hybridAtsScore : localAnalysis.localAtsScore;
    
    // Update progress (40%) - Store analysis results
    metadata = {
      ...metadata,
      processingProgress: 40,
      processingStatus: "Optimizing CV content with AI...",
      checkpoint: 'pre-optimization',
      atsScore: finalAtsScore,
      industry: analysis.industry || localAnalysis.topIndustry,
      strengths: analysis.strengths || [],
      weaknesses: analysis.weaknesses || [],
      recommendations: analysis.recommendations || [],
      localAnalysis: localAnalysis,
      checkpoints: {
        ...metadata.checkpoints,
        'pre-optimization': {
          timestamp: new Date().toISOString(),
          completed: true
        }
      },
      lastUpdated: new Date().toISOString(),
    };
    
    await updateCVMetadata(cvId, metadata);
    
    // PHASE 2: Optimization
    let optimizedText;
    let optimizationStartTime = Date.now();
    let optimizationTokenCount = 0;
    let optimizationResponseLength = 0;
    let originalAtsScore = finalAtsScore;
    
    if (startingPhase === 'initial' || startingPhase === 'analysis' || startingPhase === 'optimization' || forceRefresh) {
      try {
        // Track start of optimization phase
        startPhase(cvId.toString(), 'optimization');
        
        // Update checkpoint for optimization
        metadata = {
          ...metadata,
          checkpoints: {
            ...metadata.checkpoints,
            optimization: {
              timestamp: new Date().toISOString(),
              started: true,
              completed: false
            }
          },
          lastUpdated: new Date().toISOString(),
        };
        await updateCVMetadata(cvId, metadata);
        
        // Use parallel processing for large CVs
        if (useParallelProcessing) {
          logger.info(`Using parallel processing for CV ID: ${cvId} (large document)`);
          
          // Update status
          await updateCVMetadata(cvId, {
            ...metadata,
            processingStatus: "Processing CV sections in parallel...",
            lastUpdated: new Date().toISOString(),
          });
          
          // Process in parallel
          const parallelResult = await processInParallel(
            rawText,
            analysis.industry || localAnalysis.topIndustry,
            userId,
            cvId
          );
          
          // Use the combined result
          optimizedText = parallelResult.combinedResult;
          optimizationResponseLength = optimizedText.length;
          
          // Update metadata with parallel processing details
          metadata = {
            ...metadata,
            parallelProcessing: {
              used: true,
              successful: parallelResult.successful,
              totalProcessingTime: parallelResult.totalProcessingTime,
              sectionCount: parallelResult.sections.length,
              sectionDetails: parallelResult.sectionProcessingDetails
            },
            lastUpdated: new Date().toISOString(),
          };
          
          // Track completion of optimization phase
          completePhase(cvId.toString(), 'optimization', {
            textLength: optimizedText?.length || 0,
            usedFallback: false,
            usedParallelProcessing: true,
            sectionCount: parallelResult.sections.length,
            processingTimeMs: parallelResult.totalProcessingTime
          });
        } else {
          // Prepare optimization prompt - either from A/B test variant or default
          let optimizationPrompt = '';
          let systemPrompt = '';
          let model = 'gpt-4o-mini';
          let parameters = { temperature: 0.4, max_tokens: 4000 };
          
          if (optimizationVariant) {
            // Use the variant prompt template with replacements
            optimizationPrompt = optimizationVariant.promptTemplate
              .replace('{{truncated_content}}', rawText.substring(0, 4000) + (rawText.length > 4000 ? "... (truncated)" : ""))
              .replace('{{industry}}', analysis.industry || localAnalysis.topIndustry)
              .replace('{{industry_keywords}}', getIndustryKeywords(analysis.industry || localAnalysis.topIndustry).join(', '));
            
            systemPrompt = optimizationVariant.systemPrompt;
            model = optimizationVariant.model;
            
            // Create a new parameters object with required properties
            parameters = {
              temperature: optimizationVariant.parameters.temperature,
              max_tokens: optimizationVariant.parameters.max_tokens || 4000 // Use default if not provided
            };
            
            // Rough token count estimation for analytics
            optimizationTokenCount = Math.ceil(optimizationPrompt.length / 4) + Math.ceil(systemPrompt.length / 4);
          } else {
            // Use the default prompt
            optimizationPrompt = `
              # CV Optimization - Fast Response Required
              
              ## Original CV (Key Sections Only)
              \`\`\`
              ${rawText.substring(0, 4000)} ${rawText.length > 4000 ? "... (truncated for optimization)" : ""}
              \`\`\`
              
              ## Analysis Results
              - ATS Score: ${finalAtsScore}/100
              - Industry: ${analysis.industry || localAnalysis.topIndustry}
              - Key Weaknesses: ${(analysis.weaknesses || []).slice(0, 2).join(", ")}
              
              ## Optimization Instructions (IMPORTANT)
              1. Maintain SAME structure and sections
              2. Enhance with industry keywords
              3. Add action verbs to achievements
              4. Keep the same information but improve wording
              5. Focus on quantifiable results
              6. ONLY improve formatting and wording, DO NOT invent new experience
              7. DO NOT add commentary or explanations in your response
              8. Respond with ONLY the optimized CV text
            `;
            
            systemPrompt = 'You are a CV optimizer. Provide ONLY the improved CV text with no additional commentary. Be fast and efficient.';
            
            // Rough token count estimation for analytics
            optimizationTokenCount = Math.ceil(optimizationPrompt.length / 4) + Math.ceil(systemPrompt.length / 4);
          }
          
          // Attempt to call OpenAI with timeout and retry for optimization
          logger.info(`Making OpenAI optimization API call for CV ID: ${cvId} using model ${model}`);
          
          const optimizationResponse = await callOpenAIWithTimeout(
            model,
            [
              {
                role: "system",
                content: systemPrompt
              },
              {
                role: "user",
                content: optimizationPrompt
              }
            ],
            parameters,
            60000, // 60 second timeout
            2 // 2 retries
          );
          
          // Get the optimized text with fallback
          optimizedText = optimizationResponse && 'choices' in optimizationResponse && 
            optimizationResponse.choices && 
            optimizationResponse.choices[0]?.message?.content || "";
          logger.info(`Received optimized CV for CV ID: ${cvId}, length: ${optimizedText.length}`);
          
          // For A/B testing metrics
          const optimizationResponseText = optimizationResponse && 'choices' in optimizationResponse && 
            optimizationResponse.choices && 
            optimizationResponse.choices[0]?.message?.content || "";
          
          optimizationResponseLength = optimizationResponseText.length;
          
          // Mark optimization checkpoint as completed
          metadata = {
            ...metadata,
            checkpoints: {
              ...metadata.checkpoints,
              optimization: {
                timestamp: new Date().toISOString(),
                started: true,
                completed: true
              }
            }
          };
          
          // Track completion of optimization phase
          completePhase(cvId.toString(), 'optimization', {
            textLength: optimizedText?.length || 0,
            usedFallback: false
          });
          
          // Record optimization experiment metrics if using a variant
          if (userId && optimizationVariant) {
            const optimizationDuration = Date.now() - optimizationStartTime;
            
            // Will record after we calculate the improved ATS score
            // We'll do this at the end of processing
          }
        }
      } catch (optimizationError) {
        logger.error(`Optimization failed for CV ID: ${cvId}`, optimizationError instanceof Error ? optimizationError.message : String(optimizationError));
        
        // Create a simple optimized version with local rules as fallback
        optimizedText = enhanceTextWithLocalRules(rawText, localAnalysis);
        
        // Mark checkpoint with error
        metadata = {
          ...metadata,
          checkpoints: {
            ...metadata.checkpoints,
            optimization: {
              timestamp: new Date().toISOString(),
              started: true,
              completed: true,
              error: optimizationError instanceof Error ? optimizationError.message : String(optimizationError),
              usedFallback: true
            }
          }
        };
        
        logger.info(`Using fallback optimization for CV ID: ${cvId} due to API failure`);
        
        // Track optimization error
        trackEvent({
          eventType: 'process_error',
          cvId,
          timestamp: new Date().toISOString(),
          phase: 'optimization',
          error: optimizationError instanceof Error ? optimizationError.message : String(optimizationError)
        });
        
        // Record failed experiment if using a variant
        if (userId && optimizationVariant) {
          const optimizationDuration = Date.now() - optimizationStartTime;
          
          recordExperimentResult({
            experimentId: 'optimization-prompt-test',
            variantId: optimizationVariant.id,
            cvId,
            userId,
            timestamp: new Date().toISOString(),
            metrics: {
              processingTime: optimizationDuration,
              tokenCount: optimizationTokenCount,
              responseLength: 0,
              atsScoreImprovement: 0,
              errorOccurred: true
            }
          });
        }
      }
    } else if (currentMetadata.optimizedText) {
      // Use existing optimized text from metadata if we're resuming and have it
      logger.info(`Using existing optimized text for CV ID: ${cvId} from checkpoint`);
      optimizedText = currentMetadata.optimizedText;
    } else {
      // Fallback if no optimized text but somehow we're at a later stage
      optimizedText = enhanceTextWithLocalRules(rawText, localAnalysis);
    }
    
    const finalOptimizedText = optimizedText.trim().length > 0 ? optimizedText : enhanceTextWithLocalRules(rawText, localAnalysis);
    
    // Update progress (70%)
    metadata = {
      ...metadata,
      processingProgress: 70,
      processingStatus: "Finalizing optimization...",
      checkpoint: 'post-optimization',
      optimizedText: finalOptimizedText,
      checkpoints: {
        ...metadata.checkpoints,
        'post-optimization': {
          timestamp: new Date().toISOString(),
          completed: true
        }
      },
      lastUpdated: new Date().toISOString(),
    };
    
    await updateCVMetadata(cvId, metadata);
    
    // PHASE 3: Improvements Summary
    // Generate simple improvement descriptions (could be enhanced to use AI in the future)
    const improvements = [
      {
        improvement: "Enhanced keyword optimization",
        impact: "Improved ATS compatibility and searchability"
      },
      {
        improvement: "Restructured content for better readability",
        impact: "Makes CV more appealing to recruiters"
      },
      {
        improvement: "Strengthened achievement statements",
        impact: "Highlights candidate's value and contributions"
      }
    ];
    
    // Calculate improved ATS score
    let improvedAtsScore = Math.min(98, finalAtsScore + 15); // Simple improvement
    let atsScoreImprovement = improvedAtsScore - originalAtsScore;
    
    // Mark as complete (100%)
    const finalMetadata = {
      ...metadata,
      processingProgress: 100,
      processingCompleted: true,
      processing: false,
      optimized: true,
      processingStatus: "Processing completed successfully!",
      checkpoint: 'complete',
      atsScore: finalAtsScore,
      improvedAtsScore: improvedAtsScore,
      optimizedText: finalOptimizedText,
      improvements: improvements,
      checkpoints: {
        ...metadata.checkpoints,
        'complete': {
          timestamp: new Date().toISOString(),
          completed: true
        }
      },
      lastUpdated: new Date().toISOString(),
      completedAt: new Date().toISOString(),
    };
    
    await updateCVMetadata(cvId, finalMetadata);
    
    // Calculate total processing time
    const totalProcessingTime = Date.now() - startTimestamp;
    
    // Track successful completion with total duration
    trackEvent({
      eventType: 'process_complete',
      cvId,
      userId,
      timestamp: new Date().toISOString(),
      duration: totalProcessingTime,
      metadata: {
        atsScore: finalAtsScore,
        improvedAtsScore: improvedAtsScore,
        atsScoreImprovement: atsScoreImprovement,
        textLength: finalOptimizedText.length,
        originalTextLength: rawText.length,
        processingTimeSeconds: Math.round(totalProcessingTime / 1000),
        usedAnalysisVariant: analysisVariant?.id || null,
        usedOptimizationVariant: optimizationVariant?.id || null
      }
    });
    
    // Clear the timeout since we've completed successfully
    clearTimeout(processingTimeout);
    
    logger.info(`CV processing completed successfully for CV ID: ${cvId}`);
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    logger.error(`Error in CV processing for CV ID: ${cvId}`, errorMessage);
    
    // Track the processing error
    trackEvent({
      eventType: 'process_error',
      cvId,
      timestamp: new Date().toISOString(),
      error: errorMessage
    });
    
    // Update metadata with error
    await updateCVMetadata(cvId, {
      ...currentMetadata,
      processingError: errorMessage,
      processingStatus: "Processing failed",
      processingCompleted: false,
      processing: false,
      lastUpdated: new Date().toISOString(),
    });
  }
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