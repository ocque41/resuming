import { OpenAI } from "openai";
import { logger } from "@/lib/logger";
import { ensureModelWarmedUp } from "./warmupCache";
import { trackOpenAICall } from "./analytics";

/**
 * Parallel Processing System for CV Optimization
 * 
 * This module enables parallel processing of different sections of a CV,
 * improving throughput and reducing overall processing time for larger documents.
 */

export type CVSection = {
  id: string;
  name: string;
  content: string;
  optimized?: string;
  error?: string;
  processingTime?: number;
};

export type ParallelProcessingResult = {
  successful: boolean;
  sections: CVSection[];
  combinedResult: string;
  totalProcessingTime: number;
  sectionProcessingDetails: Record<string, {
    success: boolean;
    processingTime: number;
    model: string;
    errorMessage?: string;
  }>;
};

/**
 * Extracts sections from a CV for parallel processing
 * 
 * @param cvText The full text of the CV
 * @returns An array of CV sections
 */
export function extractSections(cvText: string): CVSection[] {
  const sections: CVSection[] = [];
  const lines = cvText.split('\n');
  
  // These are common section headers in CVs
  const sectionHeaders = [
    'PROFILE', 'SUMMARY', 'PROFESSIONAL SUMMARY', 'OBJECTIVE',
    'EXPERIENCE', 'WORK EXPERIENCE', 'EMPLOYMENT HISTORY', 'PROFESSIONAL EXPERIENCE',
    'EDUCATION', 'EDUCATIONAL BACKGROUND', 'ACADEMIC BACKGROUND',
    'SKILLS', 'TECHNICAL SKILLS', 'CORE COMPETENCIES', 'KEY SKILLS',
    'CERTIFICATIONS', 'CERTIFICATES', 'PROFESSIONAL CERTIFICATIONS',
    'LANGUAGES', 'LANGUAGE PROFICIENCY',
    'PROJECTS', 'KEY PROJECTS', 'PROFESSIONAL PROJECTS',
    'ACHIEVEMENTS', 'ACCOMPLISHMENTS', 'KEY ACHIEVEMENTS',
    'VOLUNTEER', 'VOLUNTEERING', 'VOLUNTEER EXPERIENCE',
    'PUBLICATIONS', 'RESEARCH', 'AWARDS', 'INTERESTS', 'HOBBIES'
  ];
  
  // Regex pattern for common section headers (all caps, followed by colon or newline)
  const headerPattern = new RegExp(`^\\s*(${sectionHeaders.join('|')})(:|\\s*$)`, 'i');
  
  // If we can't detect clear sections, use basic heuristics
  if (!lines.some(line => headerPattern.test(line))) {
    // Simplified section extraction - just divide the CV into parts
    const defaultSections = [
      { id: "header", name: "Header", startIndex: 0, endIndex: Math.min(10, lines.length) },
      { id: "experience", name: "Experience", startIndex: Math.min(10, lines.length), endIndex: Math.floor(lines.length * 0.7) },
      { id: "education", name: "Education", startIndex: Math.floor(lines.length * 0.7), endIndex: lines.length }
    ];
    
    for (const section of defaultSections) {
      sections.push({
        id: section.id,
        name: section.name,
        content: lines.slice(section.startIndex, section.endIndex).join('\n')
      });
    }
    
    return sections;
  }
  
  // Extract sections based on headers
  let currentSection: { id: string; name: string; content: string[] } | null = null;
  let headerIndex = 0;
  
  // Check if there's content before the first header
  const firstHeaderIndex = lines.findIndex(line => headerPattern.test(line));
  if (firstHeaderIndex > 0) {
    sections.push({
      id: `header`,
      name: "Header",
      content: lines.slice(0, firstHeaderIndex).join('\n')
    });
  }
  
  // Process line by line
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const headerMatch = headerPattern.exec(line);
    
    if (headerMatch) {
      // If we were building a section, add it to our list
      if (currentSection && currentSection.content.length > 0) {
        sections.push({
          id: currentSection.id,
          name: currentSection.name,
          content: currentSection.content.join('\n')
        });
      }
      
      // Start a new section
      const headerName = headerMatch[1].trim();
      const normalizedName = headerName
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '_');
      
      currentSection = {
        id: `${normalizedName}_${headerIndex++}`,
        name: headerName,
        content: [line]
      };
    } else if (currentSection) {
      // Add line to current section
      currentSection.content.push(line);
    }
  }
  
  // Add the last section if there is one
  if (currentSection && currentSection.content.length > 0) {
    sections.push({
      id: currentSection.id,
      name: currentSection.name,
      content: currentSection.content.join('\n')
    });
  }
  
  return sections;
}

/**
 * Determine if a CV should be processed in parallel based on its size and complexity
 * 
 * @param cvText The full text of the CV
 * @returns Boolean indicating whether parallel processing is recommended
 */
export function shouldProcessInParallel(cvText: string): boolean {
  // Simple heuristic: if the CV is large enough or has enough sections, process in parallel
  const sections = extractSections(cvText);
  const textLength = cvText.length;
  
  return textLength > 4000 || sections.length > 3;
}

/**
 * Process a section of a CV asynchronously with OpenAI
 * 
 * @param section The CV section to process
 * @param industry The industry for tailoring the optimization
 * @param model The OpenAI model to use
 * @param userId Optional user ID for tracking
 * @param cvId Optional CV ID for tracking
 * @returns The processed section with optimization
 */
async function processSectionWithAI(
  section: CVSection,
  industry: string,
  model: string = "gpt-4o-mini",
  userId?: string | number,
  cvId?: string | number
): Promise<CVSection> {
  const startTime = Date.now();
  const sectionId = section.id;
  const tokenCount = Math.ceil(section.content.length / 4);
  
  try {
    // Ensure the model is warmed up
    await ensureModelWarmedUp(model);
    
    // Create OpenAI client
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    
    // Prepare the prompt
    const prompt = `
      # CV Section Optimization
      
      ## Section: ${section.name}
      
      ## Content
      \`\`\`
      ${section.content}
      \`\`\`
      
      ## Target Industry: ${industry}
      
      ## Task
      Optimize this CV section to improve its ATS compatibility and impact. Focus on:
      1. Adding relevant industry keywords
      2. Enhancing achievement statements with metrics
      3. Using powerful action verbs
      4. Maintaining the original information and structure
      5. Optimizing formatting for readability
      
      ## Rules
      - DO NOT invent new experience or qualifications
      - DO NOT write explanations or commentary
      - Respond ONLY with the optimized section text
    `;
    
    // Process the section
    const response = await openai.chat.completions.create({
      model,
      messages: [
        {
          role: "system",
          content: "You are a CV section optimizer. Your task is to enhance a single section of a CV for ATS compatibility and impact. Respond only with the optimized content, no explanations."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.4,
      max_tokens: 2000,
    });
    
    // Get the optimized text
    const optimizedText = response.choices[0]?.message?.content || "";
    
    // Track the API call
    const duration = Date.now() - startTime;
    if (cvId) {
      trackOpenAICall(cvId, model, tokenCount, duration);
    }
    
    // Return the updated section
    return {
      ...section,
      optimized: optimizedText,
      processingTime: duration
    };
  } catch (error) {
    // Log the error
    logger.error(`Error processing section ${sectionId}:`, error instanceof Error ? error.message : String(error));
    
    // Track the API call (as failure)
    const duration = Date.now() - startTime;
    if (cvId) {
      trackOpenAICall(cvId, model, tokenCount, duration, error instanceof Error ? error.message : String(error));
    }
    
    // Return the section with error
    return {
      ...section,
      error: error instanceof Error ? error.message : String(error),
      processingTime: Date.now() - startTime
    };
  }
}

/**
 * Parallelly process sections of a CV for optimization
 * 
 * @param cvText The full text of the CV
 * @param industry The industry for tailoring the optimization
 * @param userId Optional user ID for tracking
 * @param cvId Optional CV ID for tracking
 * @returns The results of parallel processing
 */
export async function processInParallel(
  cvText: string,
  industry: string,
  userId?: string | number,
  cvId?: string | number
): Promise<ParallelProcessingResult> {
  const startTime = Date.now();
  const sections = extractSections(cvText);
  logger.info(`Processing CV in parallel with ${sections.length} sections`);
  
  // Process each section in parallel
  const processingPromises = sections.map(section => 
    processSectionWithAI(section, industry, "gpt-4o-mini", userId, cvId)
  );
  
  // Wait for all sections to be processed
  const processedSections = await Promise.all(processingPromises);
  
  // Generate result details
  const sectionProcessingDetails: Record<string, any> = {};
  processedSections.forEach(section => {
    sectionProcessingDetails[section.id] = {
      success: !section.error,
      processingTime: section.processingTime || 0,
      model: "gpt-4o-mini",
      errorMessage: section.error
    };
  });
  
  // Check if any sections failed
  const allSuccessful = processedSections.every(section => !section.error);
  
  // Combine the optimized sections
  let combinedResult = "";
  if (allSuccessful) {
    // Use optimized content if available, or original content as fallback
    combinedResult = processedSections
      .map(section => section.optimized || section.content)
      .join("\n\n");
  } else {
    // If there were errors, use a mix of optimized and original content
    combinedResult = processedSections
      .map(section => section.optimized || section.content)
      .join("\n\n");
    
    logger.warn("Some sections failed to process, using mixed optimized/original content");
  }
  
  // Calculate total processing time
  const totalProcessingTime = Date.now() - startTime;
  
  // Return the results
  return {
    successful: allSuccessful,
    sections: processedSections,
    combinedResult,
    totalProcessingTime,
    sectionProcessingDetails
  };
} 