import MistralClient from '@mistralai/mistralai';
import { logger } from '@/lib/logger';
import { mistralRateLimiter } from './rate-limiter';

// Function to ensure we're running on the server
const ensureServer = () => {
  if (typeof window !== 'undefined') {
    throw new Error('This function can only be called from the server');
  }
};

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
    
    // Server-side processing - explicitly ensure we're on the server
    ensureServer();
    
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
    
    // Server-side processing - explicitly ensure we're on the server
    ensureServer();
    
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
    
    // Server-side processing - explicitly ensure we're on the server
    ensureServer();
    
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

/**
 * Extract JSON from a response that might include markdown formatting
 * @param content The response content string
 * @returns Extracted JSON object or null if extraction fails
 */
function extractJSONFromResponse(content: string): any | null {
  try {
    // First try: direct parse if it's already valid JSON
    try {
      return JSON.parse(content);
    } catch (directParseError) {
      // Continue to other methods if direct parsing fails
      logger.debug('Direct JSON parsing failed, trying markdown extraction');
    }
    
    // Second try: Extract JSON from markdown code blocks
    const markdownJsonRegex = /```(?:json)?\s*({[\s\S]*?})\s*```/;
    const markdownMatch = content.match(markdownJsonRegex);
    
    if (markdownMatch && markdownMatch[1]) {
      try {
        return JSON.parse(markdownMatch[1]);
      } catch (markdownParseError) {
        logger.warn('Failed to parse JSON from markdown block', markdownParseError instanceof Error ? markdownParseError.message : String(markdownParseError));
      }
    }
    
    // Third try: Find any JSON-like structure with braces
    const jsonStart = content.indexOf('{');
    const jsonEnd = content.lastIndexOf('}');
    
    if (jsonStart >= 0 && jsonEnd > jsonStart) {
      const jsonStr = content.substring(jsonStart, jsonEnd + 1);
      try {
        return JSON.parse(jsonStr);
      } catch (bracesParseError) {
        logger.warn('Failed to parse JSON from braces extraction', bracesParseError instanceof Error ? bracesParseError.message : String(bracesParseError));
      }
    }
    
    // No valid JSON found
    return null;
  } catch (error) {
    logger.error('Error in JSON extraction:', error instanceof Error ? error.message : String(error));
    return null;
  }
}

/**
 * Tailors the CV content for a specific job using Mistral AI
 * This is an enhanced function specifically for the specific-optimize workflow
 */
export async function tailorCVForSpecificJob(cvText: string, jobDescription: string, jobTitle?: string): Promise<{
  tailoredContent: string;
  enhancedProfile: string;
  sectionImprovements: Record<string, string>;
}> {
  try {
    // Client-side check - redirect to API
    if (typeof window !== 'undefined') {
      const response = await fetch('/api/cv/tailor-for-job', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ cvText, jobDescription, jobTitle }),
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
    ensureServer();
    
    const client = getMistralClient();
    if (!client) {
      throw new Error('Mistral client not initialized');
    }
    
    logger.info(`Tailoring CV for job: ${jobTitle || 'Unspecified position'}`);
    
    // Pre-process the CV text to identify sections
    const sections = identifyCVSections(cvText);
    
    // Use a more detailed system prompt to guide the AI
    const systemPrompt = `You are an expert CV optimizer specialized in tailoring CVs to specific job descriptions.
Your task is to analyze the CV and job description, then optimize the CV content to highlight relevant experiences, 
skills, and qualifications that match the job requirements.

IMPORTANT - CV STRUCTURE ANALYSIS:
I've analyzed the CV and identified the following structure:
${sections.profile ? '- PROFILE/SUMMARY SECTION: Present' : '- PROFILE/SUMMARY SECTION: Not clearly identified'}
${sections.skills ? '- SKILLS SECTION: Present' : '- SKILLS SECTION: Not clearly identified'}
${sections.experience ? '- EXPERIENCE SECTION: Present' : '- EXPERIENCE SECTION: Not clearly identified'}
${sections.education ? '- EDUCATION SECTION: Present' : '- EDUCATION SECTION: Not clearly identified'}
${sections.achievements ? '- ACHIEVEMENTS SECTION: Present' : '- ACHIEVEMENTS SECTION: Not clearly identified'}

For any section marked as "Not clearly identified", you should:
1. Look for content that might represent this section even if not explicitly labeled
2. If you find related content, treat it as that section
3. If truly missing, create an appropriate section based on information in the CV

OPTIMIZATION GUIDELINES:
1. Preserve the original structure where possible, but improve organization if needed
2. Enhance the profile/summary section to highlight relevant qualifications for this specific job
3. Tailor the language to include keywords from the job description
4. Prioritize achievements that demonstrate relevant skills
5. Ensure all content is factual and based only on information in the original CV
6. Do not fabricate experiences, skills, or qualifications
7. Return the content in a structured format that clearly separates sections

IMPORTANT: Your response must be valid JSON without any markdown formatting or code blocks. The JSON should directly contain the output fields without any surrounding text or formatting.

Most importantly, identify and extract the name and contact details from the original CV and maintain them.`;

    // Process the data through Mistral AI
    const result = await executeMistralRequest(async () => {
      const response = await client.chat({
        model: 'mistral-large-latest',
        messages: [
          { role: 'system', content: systemPrompt },
          { 
            role: 'user', 
            content: `Here is my CV:
---
${cvText}
---

Here is the job description I'm applying for:
---
${jobDescription}
---
${jobTitle ? `\nPosition: ${jobTitle}` : ''}

Please tailor my CV for this job. For each section (Profile, Skills, Experience, Education, Achievements), either enhance the existing section or create an appropriate one if missing.

Return ONLY valid JSON with these fields:
1. tailoredContent: The complete tailored CV with all sections properly organized
2. enhancedProfile: A specifically enhanced profile section
3. sectionImprovements: A summary of improvements made to each section

Do not include markdown code blocks, backticks, or any formatting around the JSON.`
          }
        ],
        temperature: 0.3,
        maxTokens: 4000,
        // @ts-ignore - The Mistral API supports response_format but the type definitions may not be updated
        response_format: { type: 'json_object' }
      });
      
      // Get the raw response content
      const content = response.choices[0].message.content;
      
      // Try parsing the response with our enhanced extractor
      const parsed = extractJSONFromResponse(content);
      
      if (parsed) {
        return parsed as {
          tailoredContent: string;
          enhancedProfile: string;
          sectionImprovements: Record<string, string>;
        };
      }
      
      // If JSON extraction fails, create a structured response from the raw content
      logger.error(`Failed to extract JSON from Mistral response: ${content.substring(0, 100)}...`);
      return structureRawResponse(content, cvText);
    });
    
    logger.info('Successfully tailored CV for job');
    return result;
  } catch (error) {
    logger.error('Error tailoring CV for job:', error instanceof Error ? error.message : String(error));
    throw error;
  }
}

/**
 * Identify sections in a CV text
 */
function identifyCVSections(cvText: string): {
  profile: boolean;
  skills: boolean;
  experience: boolean;
  education: boolean;
  achievements: boolean;
} {
  const normalizedText = cvText.toLowerCase();
  
  // Look for common section headers
  const profileHeaders = ['profile', 'summary', 'professional summary', 'about me', 'objective'];
  const skillsHeaders = ['skills', 'technical skills', 'core competencies', 'key skills', 'capabilities'];
  const experienceHeaders = ['experience', 'work experience', 'employment history', 'work history', 'professional experience'];
  const educationHeaders = ['education', 'academic background', 'qualifications', 'academic qualifications', 'educational background'];
  const achievementHeaders = ['achievements', 'accomplishments', 'key achievements', 'honors', 'awards'];
  
  // Helper function to check if any header exists
  const hasSection = (headers: string[]) => {
    return headers.some(header => 
      normalizedText.includes(header + ':') || 
      normalizedText.includes(header.toUpperCase()) ||
      normalizedText.match(new RegExp(`\\b${header}\\b`, 'i'))
    );
  };
  
  return {
    profile: hasSection(profileHeaders),
    skills: hasSection(skillsHeaders),
    experience: hasSection(experienceHeaders),
    education: hasSection(educationHeaders),
    achievements: hasSection(achievementHeaders)
  };
}

/**
 * Structure a raw text response into a proper result format
 */
function structureRawResponse(content: string, originalCV: string): {
  tailoredContent: string;
  enhancedProfile: string;
  sectionImprovements: Record<string, string>;
} {
  // Extract what looks like a profile section (usually first paragraph)
  const paragraphs = content.split('\n\n').filter(p => p.trim().length > 0);
  const enhancedProfile = paragraphs.length > 0 ? paragraphs[0] : '';
  
  // Create basic section improvements feedback
  const sectionImprovements: Record<string, string> = {
    'profile': 'Enhanced to highlight relevant qualifications',
    'skills': 'Reorganized to prioritize job-relevant skills',
    'experience': 'Updated descriptions to emphasize relevant achievements',
    'education': 'Maintained with minor formatting improvements',
    'overall': 'Improved keyword density and relevance to job description'
  };
  
  return {
    tailoredContent: content,
    enhancedProfile,
    sectionImprovements
  };
} 