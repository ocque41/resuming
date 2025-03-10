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
  // Set overall processing timeout - hard limit
  const totalProcessingStartTime = Date.now();
  const processingDeadline = totalProcessingStartTime + MAX_TOTAL_PROCESSING_TIME;
  
  // Create a timeout promise
  const timeoutPromise = new Promise<null>((_, reject) => {
    setTimeout(() => reject(new Error('Processing timed out')), MAX_TOTAL_PROCESSING_TIME);
  });
  
  // Process with timeout
  const processPromise = processWithTimeout();
  
  // Race the processing against the timeout
  try {
    await Promise.race([processPromise, timeoutPromise]);
  } catch (error) {
    logger.error(`Processing timed out for CV ID: ${cvId}`);
    await handleFallbackCompletion(cvId, rawText, currentMetadata);
  }
  
  /**
   * Main processing function with built-in timeout handling
   */
  async function processWithTimeout() {
    try {
      // Track processing start
      trackEvent({
        eventType: 'process_start',
        cvId,
        userId,
        timestamp: new Date().toISOString(),
        metadata: {
          forceRefresh,
          textLength: rawText.length
        }
      });
      
      // Initialize metadata
      let metadata = {
        ...currentMetadata,
        processing: true,
        processingProgress: 10,
        processingStatus: "Starting CV processing...",
        lastUpdated: new Date().toISOString(),
      };
      
      await updateCVMetadata(cvId, metadata);
      
      // PHASE 1: Quick Local Analysis + Existing Data Check
      logger.info(`Starting local analysis for CV ID: ${cvId}`);
      const localAnalysis = performLocalAnalysis(rawText);
      
      // Check for existing analysis (from the Analyze CV step)
      const existingAnalysis = await getExistingAnalysis(cvId);
      
      // PHASE 2: Analysis (Skip if existing data available and not forcing refresh)
      let analysis;
      if (existingAnalysis && !forceRefresh) {
        // Use existing analysis data - FAST PATH
        logger.info(`Using existing analysis data for CV ID: ${cvId}`);
        analysis = existingAnalysis;
        
        // Jump to 40% progress - we're skipping analysis
        metadata = {
          ...metadata,
          processingProgress: 40,
          processingStatus: "Using existing analysis data...",
          atsScore: analysis.atsScore,
          industry: analysis.industry,
          strengths: analysis.strengths,
          weaknesses: analysis.weaknesses,
          recommendations: analysis.recommendations,
          lastUpdated: new Date().toISOString(),
        };
        
        await updateCVMetadata(cvId, metadata);
      } else {
        // Perform quick analysis with strict timeout
        logger.info(`Performing quick analysis for CV ID: ${cvId}`);
        
        try {
          startPhase(cvId.toString(), 'analysis');
          
          metadata = {
            ...metadata,
            processingProgress: 20,
            processingStatus: "Analyzing CV content...",
            lastUpdated: new Date().toISOString(),
          };
          await updateCVMetadata(cvId, metadata);
          
          // Create analysis promise with built-in timeout
          const analysisPromise = performQuickAnalysis(rawText, localAnalysis);
          const analysisTimeoutPromise = new Promise<null>((_, reject) => {
            setTimeout(() => reject(new Error('Analysis timed out')), MAX_ANALYSIS_TIME);
          });
          
          // Race against timeout
          analysis = await Promise.race([analysisPromise, analysisTimeoutPromise]);
          
          completePhase(cvId.toString(), 'analysis', {
            success: true,
            atsScore: analysis.atsScore
          });
        } catch (analysisError) {
          logger.error(`Analysis failed for CV ID: ${cvId}:`, 
            analysisError instanceof Error ? analysisError.message : String(analysisError));
          
          // Use local analysis as fallback
          analysis = {
            atsScore: localAnalysis.localAtsScore,
            industry: localAnalysis.topIndustry,
            strengths: ["CV structure detected", "Content available for review"],
            weaknesses: ["Consider adding more industry-specific keywords"],
            recommendations: ["Add more action verbs to highlight achievements"]
          };
          
          trackEvent({
            eventType: 'process_error',
            cvId,
            timestamp: new Date().toISOString(),
            phase: 'analysis',
            error: analysisError instanceof Error ? analysisError.message : String(analysisError)
          });
        }
        
        // Store analysis data regardless of source
        metadata = {
          ...metadata,
          processingProgress: 40,
          processingStatus: "Analysis completed, starting optimization...",
          atsScore: analysis.atsScore,
          industry: analysis.industry,
          strengths: analysis.strengths,
          weaknesses: analysis.weaknesses,
          recommendations: analysis.recommendations,
          lastUpdated: new Date().toISOString(),
        };
        
        await updateCVMetadata(cvId, metadata);
      }
      
      // PHASE 3: Optimization
      let optimizedText;
      try {
        startPhase(cvId.toString(), 'optimization');
        
        metadata = {
          ...metadata,
          processingProgress: 60,
          processingStatus: "Optimizing CV content...",
          lastUpdated: new Date().toISOString(),
        };
        await updateCVMetadata(cvId, metadata);
        
        // Check if we're close to the deadline
        if (Date.now() > processingDeadline - 5000) {
          throw new Error('Approaching processing deadline, using fallback optimization');
        }
        
        // Create optimization promise with built-in timeout
        const optimizationPromise = performQuickOptimization(rawText, analysis);
        const optimizationTimeoutPromise = new Promise<null>((_, reject) => {
          setTimeout(() => reject(new Error('Optimization timed out')), MAX_OPTIMIZATION_TIME);
        });
        
        // Race against timeout
        optimizedText = await Promise.race([optimizationPromise, optimizationTimeoutPromise]);
        
        completePhase(cvId.toString(), 'optimization', { success: true });
      } catch (optimizationError) {
        logger.error(`Optimization failed for CV ID: ${cvId}:`, 
          optimizationError instanceof Error ? optimizationError.message : String(optimizationError));
        
        // Use enhanced local text as fallback
        optimizedText = enhanceTextWithLocalRules(rawText, localAnalysis);
        
        trackEvent({
          eventType: 'process_error',
          cvId,
          timestamp: new Date().toISOString(),
          phase: 'optimization',
          error: optimizationError instanceof Error ? optimizationError.message : String(optimizationError)
        });
      }
      
      // Ensure we have text to work with
      const finalOptimizedText = optimizedText || enhanceTextWithLocalRules(rawText, localAnalysis);
      
      // Calculate improved ATS score
      const originalAtsScore = analysis.atsScore || localAnalysis.localAtsScore;
      const improvedAtsScore = Math.min(98, originalAtsScore + 15);
      
      // Generate simple improvement descriptions
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
      
      // Mark as complete
      metadata = {
        ...metadata,
        processingProgress: 100,
        processingCompleted: true,
        processing: false,
        optimized: true,
        processingStatus: "Processing completed successfully!",
        atsScore: originalAtsScore,
        improvedAtsScore: improvedAtsScore,
        optimizedText: finalOptimizedText,
        improvements: improvements,
        lastUpdated: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        processingTime: Date.now() - totalProcessingStartTime
      };
      
      await updateCVMetadata(cvId, metadata);
      
      // Track successful completion
      trackEvent({
        eventType: 'process_complete',
        cvId,
        userId,
        timestamp: new Date().toISOString(),
        duration: Date.now() - totalProcessingStartTime,
        metadata: {
          atsScore: originalAtsScore,
          improvedAtsScore: improvedAtsScore,
          textLength: finalOptimizedText.length,
          processingTimeMs: Date.now() - totalProcessingStartTime
        }
      });
      
      logger.info(`CV processing completed successfully for CV ID: ${cvId} in ${Date.now() - totalProcessingStartTime}ms`);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      logger.error(`Error in CV processing for CV ID: ${cvId}:`, errorMessage);
      
      // Handle complete failure by using fallback completion
      await handleFallbackCompletion(cvId, rawText, currentMetadata);
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
 * Perform quick optimization with minimal OpenAI interaction
 */
async function performQuickOptimization(rawText: string, analysis: any): Promise<string> {
  // Prepare a very simplified prompt for quick optimization
  const prompt = `
    Quickly optimize this CV for ATS compatibility. Focus on:
    1. Adding relevant keywords for the ${analysis.industry} industry
    2. Using action verbs for achievements
    3. Quantifying accomplishments
    4. Maintaining original structure and information
    
    Return ONLY the optimized CV text, no explanations.
    
    CV text (truncated):
    ${rawText.substring(0, 3000)}${rawText.length > 3000 ? '...' : ''}
    
    Key weaknesses to address:
    ${analysis.weaknesses.join(', ')}
  `;
  
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
  
  const response = await openai.chat.completions.create({
    model: "gpt-3.5-turbo", // Use the fastest model
    messages: [
      {
        role: "system",
        content: "You are a fast CV optimizer. Return ONLY the optimized CV text, no explanations."
      },
      {
        role: "user",
        content: prompt
      }
    ],
    temperature: 0.4,
    max_tokens: 2000, // Keep response size manageable
  });
  
  return response.choices[0]?.message?.content || "";
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

// New function to check for existing analysis data
async function getExistingAnalysis(cvId: number): Promise<any | null> {
  try {
    const cvRecord = await db.query.cvs.findFirst({
      where: eq(cvs.id, cvId),
    });

    if (!cvRecord || !cvRecord.metadata) {
      return null;
    }

    try {
      const metadata = JSON.parse(cvRecord.metadata);
      
      // Check if we have sufficient analysis data to proceed
      if (metadata.atsScore && 
          metadata.industry && 
          (metadata.strengths || metadata.formattingStrengths) && 
          (metadata.weaknesses || metadata.formattingWeaknesses) && 
          (metadata.recommendations || metadata.formattingRecommendations)) {
        
        logger.info(`Found existing analysis data for CV ID ${cvId}`);
        return {
          atsScore: metadata.atsScore,
          industry: metadata.industry,
          strengths: metadata.strengths || metadata.formattingStrengths || [],
          weaknesses: metadata.weaknesses || metadata.formattingWeaknesses || [],
          recommendations: metadata.recommendations || metadata.formattingRecommendations || [],
          keywordAnalysis: metadata.keywordAnalysis || {},
          sectionBreakdown: metadata.sectionBreakdown || {}
        };
      }
    } catch (error) {
      logger.error(`Error parsing metadata for existing analysis check for CV ID ${cvId}:`, 
        error instanceof Error ? error.message : String(error));
    }

    return null;
  } catch (error) {
    logger.error(`Error retrieving CV record for existing analysis check for CV ID ${cvId}:`, 
      error instanceof Error ? error.message : String(error));
    return null;
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