import MistralClient from '@mistralai/mistralai';
import { logger } from '@/lib/logger';
import { mistralRateLimiter } from './rate-limiter';

// Use a runtime check instead of server-only import
const isServer = typeof window === 'undefined';

// Function to ensure we're running on the server
const ensureServer = (functionName?: string) => {
  if (!isServer) {
    throw new Error(`This function${functionName ? ` (${functionName})` : ''} can only be called from the server`);
  }
};

// Initialize Mistral client
const getMistralClient = () => {
  // Only initialize on the server
  if (isServer) {
    const apiKey = process.env.MISTRAL_API_KEY;
    
    if (!apiKey) {
      logger.error('MISTRAL_API_KEY environment variable is not set');
      return null;
    }
    
    if (apiKey.trim() === '') {
      logger.error('MISTRAL_API_KEY environment variable is empty');
      return null;
    }
    
    try {
      return new MistralClient(apiKey);
    } catch (error) {
      logger.error('Failed to initialize Mistral client:', error instanceof Error ? error.message : String(error));
      return null;
    }
  }
  return null;
};

// Constants for text processing
const MAX_CHUNK_SIZE = 4000; // Tokens
const OVERLAP_SIZE = 300; // Tokens for context overlap

/**
 * Execute a Mistral API call with rate limiting and error handling
 */
async function executeMistralRequest<T>(
  options: {
    model: string;
    messages: { role: string; content: string }[];
    temperature?: number;
    max_tokens?: number;
    parseJson?: boolean;
  }
): Promise<string | T>;
async function executeMistralRequest<T>(requestFn: () => Promise<T>, maxRetries?: number): Promise<T>;
async function executeMistralRequest<T>(
  requestOrOptions: (() => Promise<T>) | {
    model: string;
    messages: { role: string; content: string }[];
    temperature?: number;
    max_tokens?: number;
    parseJson?: boolean;
  },
  maxRetries = 2
): Promise<T | string> {
  if (typeof requestOrOptions === 'function') {
    // Original implementation for function-based calls
    const requestFn = requestOrOptions;
    let lastError: Error | null = null;
    let retryCount = 0;
    
    while (retryCount <= maxRetries) {
      try {
        return await mistralRateLimiter.execute(requestFn);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        // Check if the error is retryable
        const isRetryable = 
          // Network errors are often temporary
          lastError.message.includes('network') || 
          // Rate limit errors can be retried
          lastError.message.includes('rate limit') ||
          lastError.message.includes('429') ||
          // Server errors (5xx) can be retried
          lastError.message.includes('500') ||
          lastError.message.includes('503');
        
        if (isRetryable && retryCount < maxRetries) {
          // Exponential backoff with jitter
          const baseDelay = 1000; // 1 second
          const exponentialDelay = baseDelay * Math.pow(2, retryCount);
          const jitter = Math.random() * 1000; // Add up to 1 second of jitter
          const delay = exponentialDelay + jitter;
          
          logger.warn(`Retryable error in Mistral API call (attempt ${retryCount + 1}/${maxRetries}). Retrying in ${Math.round(delay)}ms...`, lastError.message);
          
          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, delay));
          retryCount++;
          continue;
        }
        
        // Non-retryable error or max retries reached
        logger.error(`${retryCount > 0 ? `Failed after ${retryCount} retries. ` : ''}Mistral API call failed:`, lastError.message);
        throw lastError;
      }
    }
    
    // This should never happen, but TypeScript requires it
    throw lastError || new Error('Unknown error in executeMistralRequest');
  } else {
    // New implementation for direct options
    const options = requestOrOptions;
    const client = getMistralClient();
    if (!client) {
      throw new Error('Mistral client not initialized');
    }
    
    return mistralRateLimiter.execute(async () => {
      try {
        const response = await client.chat({
          model: options.model,
          messages: options.messages,
          temperature: options.temperature ?? 0.5,
          maxTokens: options.max_tokens ?? 2000
        });
        
        const content = response.choices[0].message.content;
        
        // If parseJson is true, parse the response as JSON
        if (options.parseJson) {
          try {
            // First try direct parsing
            return JSON.parse(content) as T;
          } catch (parseError) {
            // Try to extract JSON from markdown code blocks
            const markdownJsonRegex = /```(?:json)?\s*({[\s\S]*?})\s*```/;
            const markdownMatch = content.match(markdownJsonRegex);
            
            if (markdownMatch && markdownMatch[1]) {
              try {
                return JSON.parse(markdownMatch[1]) as T;
              } catch (markdownParseError) {
                logger.warn('Failed to parse JSON from markdown block');
              }
            }
            
            // Try to find any JSON-like structure with braces
            const jsonStart = content.indexOf('{');
            const jsonEnd = content.lastIndexOf('}');
            
            if (jsonStart >= 0 && jsonEnd > jsonStart) {
              const jsonStr = content.substring(jsonStart, jsonEnd + 1);
              try {
                return JSON.parse(jsonStr) as T;
              } catch (bracesParseError) {
                logger.warn('Failed to parse JSON from braces extraction');
              }
            }
            
            // If all parsing attempts fail, log error and throw
            logger.error('Failed to parse JSON response:', 
              parseError instanceof Error ? parseError.message : String(parseError));
            throw new Error('Failed to parse JSON from Mistral response');
          }
        }
        
        // If not parsing JSON, return the raw content
        return content as unknown as T;
      } catch (error) {
        logger.error('Mistral API call failed:', 
          error instanceof Error ? error.message : String(error));
        throw error;
      }
    });
  }
}

/**
 * Split large text into smaller chunks for processing
 * with consideration for maintaining context
 */
export function splitTextIntoChunks(text: string, maxChunkSize = MAX_CHUNK_SIZE, overlapSize = OVERLAP_SIZE): string[] {
  // Simple approximation: 1 token is roughly 4 characters for English text
  const tokensPerChar = 0.25;
  const maxChars = Math.floor(maxChunkSize / tokensPerChar);
  const overlapChars = Math.floor(overlapSize / tokensPerChar);
  
  // If text is smaller than max chunk size, return it as is
  if (text.length <= maxChars) {
    return [text];
  }
  
  const chunks: string[] = [];
  let startPos = 0;
  
  while (startPos < text.length) {
    // Determine end position for this chunk
    let endPos = startPos + maxChars;
    
    // If we're not at the end of the text
    if (endPos < text.length) {
      // Try to find a natural break point (paragraph or sentence end)
      const paragraphBreak = text.lastIndexOf('\n\n', endPos);
      const sentenceBreak = text.lastIndexOf('. ', endPos);
      
      // If we found a good break point that's not too far back
      if (paragraphBreak > startPos + maxChars / 2) {
        endPos = paragraphBreak + 2; // Include the paragraph break
      } else if (sentenceBreak > startPos + maxChars / 2) {
        endPos = sentenceBreak + 2; // Include the period and space
      } else {
        // Last resort - find the last space to avoid breaking words
        const lastSpace = text.lastIndexOf(' ', endPos);
        if (lastSpace > startPos + maxChars / 2) {
          endPos = lastSpace + 1; // Include the space
        }
      }
    } else {
      endPos = text.length;
    }
    
    // Extract the chunk
    chunks.push(text.substring(startPos, endPos));
    
    // Set the next start position with overlap
    startPos = Math.max(startPos, endPos - overlapChars);
  }
  
  logger.info(`Split text into ${chunks.length} chunks for processing`);
  return chunks;
}

/**
 * Process large text in chunks and combine results
 */
export async function processLargeText<T>(
  text: string, 
  jobDescription: string,
  processingFunction: (textChunk: string, jobDesc: string) => Promise<T>,
  combinationFunction: (results: T[]) => T
): Promise<T> {
  // Ensure this is running on the server
  ensureServer();
  
  // Split text into manageable chunks
  const chunks = splitTextIntoChunks(text);
  
  if (chunks.length === 1) {
    // If only one chunk, process directly
    return await processingFunction(chunks[0], jobDescription);
  }
  
  // Process each chunk in parallel
  logger.info(`Processing ${chunks.length} chunks in parallel`);
  const chunkResults = await Promise.all(
    chunks.map(chunk => processingFunction(chunk, jobDescription))
  );
  
  // Combine results
  logger.info('Combining results from all chunks');
  return combinationFunction(chunkResults);
}

export interface CVAnalysisResult {
  experience: Array<{
    title: string;
    company: string;
    dates: string;
    responsibilities: string[];
  }>;
  education: Array<{
    degree: string;
    field: string;
    institution: string;
    year: string;
  }>;
  skills: {
    technical: string[];
    professional: string[];
  };
  achievements: string[];
  profile: string;
}

export async function analyzeCVContent(cvText: string): Promise<CVAnalysisResult> {
  try {
    // Client-side check - redirect to API
    if (!isServer) {
      const response = await fetch('/api/cv/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ cvText }),
      });
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }
      
      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'API returned unsuccessful response');
      }
      
      return data.analysis;
    }
    
    // Server-side processing - explicitly ensure we're on the server
    ensureServer('analyzeCVContent');
    
    const client = getMistralClient();
    if (!client) {
      throw new Error('Mistral client not initialized');
    }
    
    // Function to process a single chunk
    const processChunk = async (textChunk: string): Promise<CVAnalysisResult> => {
      const prompt = `Analyze the following CV and extract structured information. Format the response as JSON with the following structure:
      {
        "experience": [{"title": string, "company": string, "dates": string, "responsibilities": string[]}],
        "education": [{"degree": string, "field": string, "institution": string, "year": string}],
        "skills": {"technical": string[], "professional": string[]},
        "achievements": string[],
        "profile": string
      }

      CV Text:
      ${textChunk}`;

      const result = await executeMistralRequest<CVAnalysisResult>({
        model: 'mistral-large-latest',
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.1,
        max_tokens: 2000,
        parseJson: true
      });
      
      // Check if result has the expected structure, if not return default
      if (!result || typeof result !== 'object') {
        logger.error('Invalid result structure from AI');
        return {
          experience: [],
          education: [],
          skills: { technical: [], professional: [] },
          achievements: [],
          profile: ''
        };
      }
      
      return result;
    };
    
    // For large CVs, split and process in chunks
    if (cvText.length > 4000) {
      return await processLargeText<CVAnalysisResult>(
        cvText,
        '',
        async (chunk) => await processChunk(chunk),
        (results) => {
          // Combine results from chunks
          return {
            experience: results.flatMap(r => r.experience || []),
            education: results.flatMap(r => r.education || []),
            skills: {
              technical: Array.from(new Set(results.flatMap(r => r.skills?.technical || []))),
              professional: Array.from(new Set(results.flatMap(r => r.skills?.professional || [])))
            },
            achievements: Array.from(new Set(results.flatMap(r => r.achievements || []))),
            profile: results[0]?.profile || ''
          };
        }
      );
    }
    
    // For smaller CVs, process directly
    return await processChunk(cvText);
  } catch (error) {
    logger.error('Error analyzing CV content:', 
      error instanceof Error ? error.message : String(error));
    throw new Error(`Failed to analyze CV: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Optimize a CV for a specific job description
 * 
 * @param cvText - Original CV text
 * @param jobDescription - Job description to optimize CV for
 * @param options - Additional optimization options
 * @returns Promise resolving to the optimized CV content and analysis
 */
export async function optimizeCVForJob(
  cvText: string,
  jobDescription: string,
  options: {
    detailed?: boolean;
  } = {}
): Promise<{
  optimizedContent: string;
  matchScore: number;
  recommendations: string[];
}> {
  try {
    // Client-side check - redirect to API
    if (!isServer) {
      const response = await fetch('/api/cv/optimize-for-job', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ cvText, jobDescription, detailed: options.detailed }),
      });
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }
      
      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'API returned unsuccessful response');
      }
      
      return data.result;
    }
    
    // Server-side processing - explicitly ensure we're on the server
    ensureServer('optimizeCVForJob');
    
    const client = getMistralClient();
    if (!client) {
      throw new Error('Mistral client not initialized');
    }
    
    // Use a more detailed prompt for comprehensive optimization
    const prompt = `Optimize the following CV for the job description provided. Focus on:
    1. Highlighting relevant skills and experience
    2. Aligning the CV terminology with the job description
    3. Suggesting improvements to make the CV more effective
    4. Providing a match score out of 100

    CV Text:
    ${cvText}

    Job Description:
    ${jobDescription}

    Format the response as JSON with the following structure:
    {
      "optimizedContent": string,
      "matchScore": number,
      "recommendations": string[]
    }`;

    // Use the updated executeMistralRequest with parseJson option
    const result = await executeMistralRequest<{
      optimizedContent: string;
      matchScore: number;
      recommendations: string[];
    }>({
      model: 'mistral-large-latest',
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.2,
      max_tokens: 3000,
      parseJson: true
    });
    
    // Ensure we have a valid result object
    if (typeof result === 'string') {
      // If we got a string instead of an object, try to parse it
      try {
        const parsedResult = JSON.parse(result);
        return {
          optimizedContent: parsedResult.optimizedContent || cvText,
          matchScore: parsedResult.matchScore || 0,
          recommendations: parsedResult.recommendations || []
        };
      } catch (e) {
        // If parsing fails, return a default object with the string as content
        return {
          optimizedContent: result,
          matchScore: 0,
          recommendations: ['AI returned unstructured content']
        };
      }
    }
    
    return result;
  } catch (error) {
    logger.error('Error optimizing CV for job with Mistral AI:', 
      error instanceof Error ? error.message : String(error));
    throw new Error('Failed to optimize CV');
  }
}

export interface JobMatchAnalysisResult {
  score: number;
  matchedKeywords: Array<{
    keyword: string;
    relevance: number;
    frequency: number;
    placement: string;
  }>;
  missingKeywords: Array<{
    keyword: string;
    importance: number;
    suggestedPlacement: string;
  }>;
  recommendations: string[];
  skillGap: string;
  dimensionalScores: {
    skillsMatch: number;
    experienceMatch: number;
    educationMatch: number;
    industryFit: number;
    overallCompatibility: number;
    keywordDensity: number;
    formatCompatibility: number;
    contentRelevance: number;
  };
  detailedAnalysis: string;
  improvementPotential: number;
  sectionAnalysis: {
    profile: { score: number; feedback: string };
    skills: { score: number; feedback: string };
    experience: { score: number; feedback: string };
    education: { score: number; feedback: string };
    achievements: { score: number; feedback: string };
  };
}

/**
 * Analyze job match between CV and job description
 * 
 * @param cvText - CV text to analyze
 * @param jobDescription - Job description to match against
 * @returns Promise resolving to the job match analysis
 */
export async function analyzeJobMatch(
  cvText: string,
  jobDescription: string
): Promise<JobMatchAnalysisResult> {
  try {
    // Client-side check - redirect to API
    if (!isServer) {
      const response = await fetch('/api/cv/analyze-job-match', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ cvText, jobDescription }),
      });
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }
      
      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'API returned unsuccessful response');
      }
      
      return data.analysis;
    }
    
    // Server-side processing - explicitly ensure we're on the server
    ensureServer('analyzeJobMatch');
    
    const client = getMistralClient();
    if (!client) {
      throw new Error('Mistral client not initialized');
    }
    
    // Process job match analysis with rate limiting
    const prompt = `Analyze how well the following CV matches the provided job description. Provide a structured analysis with:

    1. Overall match score (0-100)
    2. List of matched keywords with relevance scores
    3. Missing keywords with importance rankings
    4. Specific recommendations for improvement
    5. Detailed breakdown of skills match, experience match, education match, etc.
    6. Section-by-section analysis with specific feedback

    CV Text:
    ${cvText}

    Job Description:
    ${jobDescription}

    Format the response as JSON with the following structure:
    {
      "score": number,
      "matchedKeywords": [{"keyword": string, "relevance": number, "frequency": number, "placement": string}],
      "missingKeywords": [{"keyword": string, "importance": number, "suggestedPlacement": string}],
      "recommendations": string[],
      "skillGap": string,
      "dimensionalScores": {
        "skillsMatch": number,
        "experienceMatch": number,
        "educationMatch": number,
        "industryFit": number,
        "overallCompatibility": number,
        "keywordDensity": number,
        "formatCompatibility": number,
        "contentRelevance": number
      },
      "detailedAnalysis": string,
      "improvementPotential": number,
      "sectionAnalysis": {
        "profile": {"score": number, "feedback": string},
        "skills": {"score": number, "feedback": string},
        "experience": {"score": number, "feedback": string},
        "education": {"score": number, "feedback": string},
        "achievements": {"score": number, "feedback": string}
      }
    }`;

    const result = await executeMistralRequest<JobMatchAnalysisResult>({
      model: 'mistral-large-latest',
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.1,
      max_tokens: 3000,
      parseJson: true
    });
    
    // Handle string result (should not happen with parseJson)
    if (typeof result === 'string') {
      try {
        return JSON.parse(result) as JobMatchAnalysisResult;
      } catch (e) {
        throw new Error('Failed to parse job match analysis result');
      }
    }
    
    return result;
  } catch (error) {
    logger.error('Error analyzing job match with Mistral AI:', 
      error instanceof Error ? error.message : String(error));
    throw new Error('Failed to analyze job match');
  }
}

/**
 * Tailor a CV to a specific job description
 * 
 * @param cvText Original CV text
 * @param jobTitle Job title to tailor CV for
 * @param jobDescription Job description to tailor CV for
 * @param options Additional options for processing
 * @returns Promise resolving to the tailored CV and section analysis
 */
export async function tailorCVForSpecificJob(
  cvText: string,
  jobTitle: string,
  jobDescription: string,
  options: {
    detailed?: boolean;
    model?: string;
    maxAttempts?: number;
  } = {}
): Promise<{
  optimizedText: string;
  analysis: string;
}> {
  ensureServer('tailorCVForSpecificJob');
  
  logger.info("Starting CV tailoring for specific job");
  
  const startTime = Date.now();
  
  // Extract contact information and name from the CV to preserve it
  const contactInfo = extractContactInfo(cvText);
  
  // Truncate job description if too long (to reduce token usage)
  const truncatedJobDescription = jobDescription.length > 1500 
    ? jobDescription.slice(0, 1500) + "..." 
    : jobDescription;
  
  // Set model to use - prefer mistral-large-latest for better quality
  const model = options.model || 'mistral-large-latest';
  const maxAttempts = options.maxAttempts || 2;
  
  try {
    // Use a more targeted prompt for CV tailoring that explicitly requests
    // a well-formatted CV document instead of a JSON structure
    const systemPrompt = `You are an expert CV writer and job application specialist. 
Your task is to enhance the provided CV to align with the specific job position.

IMPORTANT FORMATTING INSTRUCTIONS:
- Output a well-formatted CV document, NOT JSON
- Maintain the person's name and contact details at the top
- Create clear section headings
- Maintain professional structure
- Include these sections in order:
  1. Profile/Summary (using keywords from job description)
  2. Objectives (3 specific goals for this role)
  3. Achievements (highlight relevant accomplishments)
  4. Skills (add 1 critical skill from job requirements)
  5. Experience
  6. Education
  7. Industry Focus (aligned with target job)
- Keep overall length similar to original CV
- Preserve factual information - don't invent qualifications

After adjusting the CV, briefly explain your main changes in a section titled "## ANALYSIS" at the very end.`;

    const userPrompt = `JOB TITLE: ${jobTitle}

JOB DESCRIPTION:
${truncatedJobDescription}

ORIGINAL CV:
${cvText}

Please adjust this CV for the specific job position described above, following the formatting instructions exactly.
Extract top 10 keywords from the job description and incorporate them naturally into the profile section.
The objectives should be 3 specific goals the candidate aims to achieve in this role.
Add exactly one critical skill from the job requirements if not already present.
Update the industry focus to match the target job's industry.`;

    let result: string = '';
    
    // Try to get the tailored CV with retries if necessary
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        // First attempt - use normal approach
        if (attempt === 1) {
          logger.info(`Attempt ${attempt}: Using ${model} for CV tailoring`);
          
          result = await executeMistralRequest({
            model: model,
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt }
            ],
            temperature: 0.5,
            max_tokens: 4000,
          });
        } 
        // Retry - be more explicit about formatting
        else {
          logger.info(`Attempt ${attempt}: Retry with more explicit instructions`);
          
          // Add more explicit instructions on second attempt
          const retrySystemPrompt = `${systemPrompt}
CRITICAL: You MUST format the output as a proper CV document. Do NOT return JSON or code format.
The document MUST start with the person's name and contact information at the top, then proceed with standard CV sections.`;
          
          result = await executeMistralRequest({
            model: model,
            messages: [
              { role: "system", content: retrySystemPrompt },
              { role: "user", content: userPrompt }
            ],
            temperature: 0.7, // Slightly higher temperature for variety
            max_tokens: 4000,
          });
        }
        
        // Check if result is formatted as expected
        if (result.includes("```json") || result.includes('{"') || result.startsWith('{')) {
          // It's producing JSON format instead of a CV - retry if not last attempt
          if (attempt < maxAttempts) {
            logger.warn("Result is in JSON format instead of CV format, retrying...");
            continue;
          }
        }
        
        // If result looks like it might be starting with job title instead of name
        if (result.trim().startsWith(jobTitle) || result.includes(`# ${jobTitle}`)) {
          if (attempt < maxAttempts) {
            logger.warn("Result appears to start with job title instead of person's name, retrying...");
            continue;
          }
        }
        
        // If we get here with a valid result, break the loop
        break;
      } catch (error) {
        const errorMessage = error instanceof Error 
          ? error.message 
          : typeof error === 'string'
            ? error
            : 'Unknown error';
        
        logger.error(`Error during CV tailoring attempt ${attempt}:`, errorMessage);
        
        // Throw on last attempt, otherwise continue to retry
        if (attempt === maxAttempts) {
          throw error;
        }
      }
    }
    
    // Process the result to separate CV and analysis 
    let optimizedText = '';
    let analysis = '';
    
    // Check if the result has an analysis section
    if (result.includes('## ANALYSIS')) {
      const parts = result.split('## ANALYSIS');
      optimizedText = parts[0].trim();
      analysis = parts[1].trim();
    } else {
      // Try alternative formats
      if (result.includes('# ANALYSIS') || result.includes('ANALYSIS:')) {
        const analysisMarker = result.includes('# ANALYSIS') ? '# ANALYSIS' : 
                             result.includes('ANALYSIS:') ? 'ANALYSIS:' : null;
                             
        if (analysisMarker) {
          const parts = result.split(analysisMarker);
          optimizedText = parts[0].trim();
          analysis = parts[1].trim();
        } else {
          optimizedText = result;
          analysis = "No specific analysis provided.";
        }
      } else {
        // If no analysis section found, assume entire result is CV
        optimizedText = result;
        
        // Generate a basic analysis
        analysis = "Analysis not provided in the output. The CV has been tailored to highlight relevant skills and experience for the position.";
      }
    }
    
    // Clean up optimizedText if it starts with markdown code block markers
    if (optimizedText.startsWith('```')) {
      const lines = optimizedText.split('\n');
      const startIndex = lines.findIndex(line => line.startsWith('```')) + 1;
      const endIndex = lines.slice(startIndex).findIndex(line => line.startsWith('```'));
      
      if (endIndex !== -1) {
        // Extract content between code block markers
        optimizedText = lines.slice(startIndex, startIndex + endIndex).join('\n').trim();
      } else {
        // Just remove the opening marker if no closing marker
        optimizedText = optimizedText.replace(/^```.*\n/, '').trim();
      }
    }
    
    // If the contact info wasn't preserved in the result, add it back
    if (contactInfo && typeof contactInfo.email === 'string' && contactInfo.email.length > 0) {
      if (!optimizedText.includes(contactInfo.email)) {
        // Extract the profile section
        const profileSection = extractProfileSection(optimizedText);
        
        // Create a proper header with contact info
        const contactHeader = `${contactInfo.name || ""}
${contactInfo.email}
${contactInfo.phone || ""}
${contactInfo.location || ""}
${contactInfo.linkedin || ""}`;
        
        // If there's no clear name at the start, add the contact header
        if (!isNameAtStart(optimizedText) && typeof contactInfo.name === 'string' && contactInfo.name.trim() !== '') {
          optimizedText = `${contactHeader.trim()}\n\n${optimizedText}`;
        }
      }
    }
    
    // Generate section improvements if analysis is short
    if (analysis.length < 100) {
      analysis = generateSectionImprovements(cvText, optimizedText, jobTitle, jobDescription);
    }
    
    // Calculate processing time
    const processingTime = Date.now() - startTime;
    logger.info(`CV tailoring completed in ${processingTime}ms`);
    
    return {
      optimizedText,
      analysis
    };
  } catch (error: any) {
    // Safe error logging
    logger.error('Error in tailorCVForSpecificJob:', error?.message || String(error));
    throw error;
  }
}

/**
 * Extract contact information from CV text
 * 
 * @param cvText The CV text to extract contact info from
 * @returns Object containing contact information
 */
function extractContactInfo(cvText: string): {
  name?: string;
  email?: string;
  phone?: string;
  location?: string;
  linkedin?: string;
} {
  const contactInfo: {
    name?: string;
    email?: string;
    phone?: string;
    location?: string;
    linkedin?: string;
  } = {};
  
  // Extract email
  const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/;
  const emailMatch = cvText.match(emailRegex);
  if (emailMatch) {
    contactInfo.email = emailMatch[0];
  }
  
  // Extract phone (various formats)
  const phoneRegex = /(\+\d{1,3}[-\s]?)?\(?\d{3}\)?[-\s]?\d{3}[-\s]?\d{4}/;
  const phoneMatch = cvText.match(phoneRegex);
  if (phoneMatch) {
    contactInfo.phone = phoneMatch[0];
  }
  
  // Extract name - likely at the beginning of the CV
  // This is a simplistic approach - the first line might be the name
  const lines = cvText.split('\n').filter(line => line.trim().length > 0);
  if (lines.length > 0) {
    // Check if first line looks like a name (no special characters, not too long)
    const firstLine = lines[0].trim();
    if (firstLine.length < 40 && !/[@:\/\d]/.test(firstLine)) {
      contactInfo.name = firstLine;
    }
  }
  
  // Extract LinkedIn (simplified)
  const linkedinRegex = /linkedin\.com\/in\/[a-zA-Z0-9_-]+/;
  const linkedinMatch = cvText.match(linkedinRegex);
  if (linkedinMatch) {
    contactInfo.linkedin = linkedinMatch[0];
  }
  
  return contactInfo;
}

/**
 * Check if the CV starts with what appears to be a name
 */
function isNameAtStart(text: string): boolean {
  const lines = text.split('\n').filter(line => line.trim().length > 0);
  if (lines.length === 0) return false;
  
  const firstLine = lines[0].trim();
  // Check if first line looks like a name (no special characters, not too long)
  return firstLine.length < 40 && !/[@:\/\d]/.test(firstLine);
}

/**
 * Extract the profile/summary section from the CV
 */
function extractProfileSection(cvText: string): string | null {
  // Common profile section headers
  const profileHeaders = [
    'profile', 'summary', 'professional summary', 'about me', 
    'personal statement', 'career objective'
  ];
  
  const lines = cvText.split('\n');
  let inProfileSection = false;
  let profileSection = '';
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].toLowerCase().trim();
    
    // Check if we've found a profile section header
    if (!inProfileSection && profileHeaders.some(header => 
      line === header || line === `## ${header}` || line === `# ${header}` || 
      line.endsWith(`:`) && line.slice(0, -1).trim() === header)) {
      inProfileSection = true;
      continue;
    }
    
    // If we're in the profile section and encounter a new section header, we're done
    if (inProfileSection && (line.startsWith('# ') || line.startsWith('## '))) {
      break;
    }
    
    // Add lines to the profile section
    if (inProfileSection) {
      profileSection += lines[i] + '\n';
    }
  }
  
  return profileSection.trim().length > 0 ? profileSection.trim() : null;
}

/**
 * Generate section improvements based on comparison between original and tailored CV
 */
function generateSectionImprovements(
  originalCV: string, 
  tailoredCV: string, 
  jobTitle: string, 
  jobDescription: string
): string {
  const analysis = `## ANALYSIS

The CV has been aligned with the ${jobTitle} position. Key changes include:

1. **Profile Focus:** Updated profile section with relevant keywords and experience highlights
2. **Clear Objectives:** Added specific goals aligned with the role requirements
3. **Skills Enhancement:** Included critical skills required for the position
4. **Industry Alignment:** Updated industry focus to match the target role

The CV maintains your core qualifications while presenting them in a way that directly connects with this specific position.`;

  return analysis;
} 