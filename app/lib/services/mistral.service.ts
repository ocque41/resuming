import MistralClient from '@mistralai/mistralai';
import 'server-only';
import { logger } from '@/lib/logger';
import { mistralRateLimiter } from './rate-limiter';

// Initialize Mistral client
const getMistralClient = () => {
  // Only initialize on the server
  if (typeof window === 'undefined') {
    return new MistralClient(process.env.MISTRAL_API_KEY || '');
  }
  return null;
};

// Constants for text processing
const MAX_CHUNK_SIZE = 4000; // Tokens
const OVERLAP_SIZE = 300; // Tokens for context overlap

/**
 * Execute a Mistral API call with rate limiting and error handling
 */
async function executeMistralRequest<T>(requestFn: () => Promise<T>): Promise<T> {
  try {
    return await mistralRateLimiter.execute(requestFn);
  } catch (error) {
    logger.error('Rate-limited Mistral API call failed:', error instanceof Error ? error.message : String(error));
    throw error;
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
    if (typeof window !== 'undefined') {
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
    
    // Server-side processing
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

      return await executeMistralRequest(async () => {
        const response = await client.chat({
          model: 'mistral-large-latest',
          messages: [
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.1,
          maxTokens: 2000
        });

        try {
          return JSON.parse(response.choices[0].message.content);
        } catch (parseError) {
          logger.error('Error parsing Mistral response:', parseError instanceof Error ? parseError.message : String(parseError));
          throw new Error('Failed to parse CV analysis result');
        }
      });
    };
    
    // Function to combine multiple chunk results
    const combineResults = (results: CVAnalysisResult[]): CVAnalysisResult => {
      if (results.length === 0) return {
        experience: [],
        education: [],
        skills: { technical: [], professional: [] },
        achievements: [],
        profile: ''
      };
      
      if (results.length === 1) return results[0];
      
      // Combine all parts
      const combined: CVAnalysisResult = {
        experience: [],
        education: [],
        skills: { technical: [], professional: [] },
        achievements: [],
        profile: results[0].profile // Use the profile from the first chunk
      };
      
      // Merge experience entries (avoiding duplicates by checking title+company)
      const experienceMap = new Map<string, typeof combined.experience[0]>();
      results.forEach(result => {
        result.experience.forEach(exp => {
          const key = `${exp.title}|${exp.company}`;
          if (!experienceMap.has(key)) {
            experienceMap.set(key, exp);
          }
        });
      });
      combined.experience = Array.from(experienceMap.values());
      
      // Merge education entries (avoiding duplicates by checking degree+institution)
      const educationMap = new Map<string, typeof combined.education[0]>();
      results.forEach(result => {
        result.education.forEach(edu => {
          const key = `${edu.degree}|${edu.institution}`;
          if (!educationMap.has(key)) {
            educationMap.set(key, edu);
          }
        });
      });
      combined.education = Array.from(educationMap.values());
      
      // Merge unique skills
      const technicalSkills = new Set<string>();
      const professionalSkills = new Set<string>();
      results.forEach(result => {
        result.skills.technical.forEach(skill => technicalSkills.add(skill));
        result.skills.professional.forEach(skill => professionalSkills.add(skill));
      });
      combined.skills.technical = Array.from(technicalSkills);
      combined.skills.professional = Array.from(professionalSkills);
      
      // Merge unique achievements
      const achievements = new Set<string>();
      results.forEach(result => {
        result.achievements.forEach(achievement => achievements.add(achievement));
      });
      combined.achievements = Array.from(achievements);
      
      return combined;
    };
    
    // If CV is short, process directly
    if (cvText.length < 5000) {
      return await processChunk(cvText);
    }
    
    // For longer CVs, use the chunk processing mechanism
    return await processLargeText<CVAnalysisResult>(
      cvText,
      '', // Not needed for CV analysis
      async (chunk, _) => processChunk(chunk),
      combineResults
    );
  } catch (error) {
    logger.error('Error analyzing CV with Mistral AI:', error instanceof Error ? error.message : String(error));
    throw new Error('Failed to analyze CV content');
  }
}

export async function optimizeCVForJob(cvText: string, jobDescription: string): Promise<{
  optimizedContent: string;
  matchScore: number;
  recommendations: string[];
}> {
  try {
    // Client-side check - redirect to API
    if (typeof window !== 'undefined') {
      const response = await fetch('/api/cv/optimize-local', {
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
      
      return data.result;
    }
    
    // Server-side processing
    const client = getMistralClient();
    if (!client) {
      throw new Error('Mistral client not initialized');
    }
    
    // Function to process a single chunk
    const processChunk = async (textChunk: string, jobDesc: string): Promise<{
      optimizedContent: string;
      matchScore: number;
      recommendations: string[];
    }> => {
      const prompt = `Optimize the following CV for the given job description. Provide:
      1. Optimized CV content with relevant keywords and phrases
      2. Match score (0-100)
      3. List of recommendations for improvement

      CV Text:
      ${textChunk}

      Job Description:
      ${jobDesc}

      Format the response as JSON with the following structure:
      {
        "optimizedContent": string,
        "matchScore": number,
        "recommendations": string[]
      }`;

      return await executeMistralRequest(async () => {
        const response = await client.chat({
          model: 'mistral-large-latest',
          messages: [
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.2,
          maxTokens: 3000
        });

        try {
          return JSON.parse(response.choices[0].message.content);
        } catch (parseError) {
          logger.error('Error parsing Mistral response:', parseError instanceof Error ? parseError.message : String(parseError));
          throw new Error('Failed to parse CV optimization result');
        }
      });
    };
    
    // Function to combine multiple chunk results
    const combineResults = (results: Array<{
      optimizedContent: string;
      matchScore: number;
      recommendations: string[];
    }>): {
      optimizedContent: string;
      matchScore: number;
      recommendations: string[];
    } => {
      if (results.length === 0) return {
        optimizedContent: '',
        matchScore: 0,
        recommendations: []
      };
      
      if (results.length === 1) return results[0];
      
      // Combine optimized content from all chunks
      const combinedContent = results.map(r => r.optimizedContent).join('\n\n');
      
      // Average match scores
      const avgScore = results.reduce((sum, r) => sum + r.matchScore, 0) / results.length;
      
      // Collect unique recommendations
      const uniqueRecommendations = new Set<string>();
      results.forEach(result => {
        result.recommendations.forEach(rec => uniqueRecommendations.add(rec));
      });
      
      return {
        optimizedContent: combinedContent,
        matchScore: Math.round(avgScore),
        recommendations: Array.from(uniqueRecommendations)
      };
    };
    
    // For both short and long CVs, use the chunk processing
    return await processLargeText(
      cvText,
      jobDescription,
      processChunk,
      combineResults
    );
  } catch (error) {
    logger.error('Error optimizing CV with Mistral AI:', error instanceof Error ? error.message : String(error));
    throw new Error('Failed to optimize CV for job');
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

export async function analyzeJobMatch(cvText: string, jobDescription: string): Promise<JobMatchAnalysisResult> {
  try {
    // Client-side check - redirect to API
    if (typeof window !== 'undefined') {
      const response = await fetch('/api/cv/job-match-analysis', {
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
    
    // Server-side processing
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

    return await executeMistralRequest(async () => {
      const response = await client.chat({
        model: 'mistral-large-latest',
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.1,
        maxTokens: 3000
      });

      // Parse the JSON response
      try {
        return JSON.parse(response.choices[0].message.content);
      } catch (parseError) {
        logger.error('Error parsing Mistral response:', parseError instanceof Error ? parseError.message : String(parseError));
        throw new Error('Failed to parse analysis result');
      }
    });
  } catch (error) {
    logger.error('Error analyzing job match with Mistral AI:', error instanceof Error ? error.message : String(error));
    throw new Error('Failed to analyze job match');
  }
} 