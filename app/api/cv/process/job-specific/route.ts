import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db/drizzle";
import { cvs } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { logger } from "@/lib/logger";
import OpenAI from "openai";

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
});

// Define metadata type for type checking
interface CVMetadata {
  processing?: boolean;
  processingStartTime?: string;
  processingStatus?: string;
  processingProgress?: number;
  processingCompleted?: boolean;
  optimized?: boolean;
  lastUpdated?: string;
  atsScore?: number;
  improvedAtsScore?: number;
  improvements?: string[];
  optimizedText?: string;
  jobSpecificOptimization?: {
    timestamp: string;
    jobDescription: string;
    keywords: string[];
    matchScore: number;
    keywordsMatched: string[];
    suggestedImprovements: string[];
  };
  [key: string]: any; // Allow additional properties
}

export async function POST(request: Request) {
  try {
    // Get user session
    const session = await getSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    // Parse request body
    const body = await request.json();
    const { cvId, jobDescription } = body;
    
    // Validate request
    if (!cvId) {
      return NextResponse.json({ error: "CV ID is required" }, { status: 400 });
    }
    
    if (!jobDescription || typeof jobDescription !== 'string' || jobDescription.trim().length < 10) {
      return NextResponse.json({ error: "Valid job description is required (minimum 10 characters)" }, { status: 400 });
    }
    
    // Get CV record
    const cvRecord = await db.query.cvs.findFirst({
      where: eq(cvs.id, cvId),
    });
    
    // Validate CV record
    if (!cvRecord) {
      return NextResponse.json({ error: "CV not found" }, { status: 404 });
    }
    
    if (cvRecord.userId !== session.user.id) {
      return NextResponse.json({ error: "Unauthorized to access this CV" }, { status: 403 });
    }
    
    // Parse metadata
    let metadata: CVMetadata = {};
    if (cvRecord.metadata) {
      try {
        metadata = JSON.parse(cvRecord.metadata as string);
      } catch (error) {
        logger.error(`Error parsing metadata for CV ID ${cvId}:`, error instanceof Error ? error.message : String(error));
      }
    }
    
    // Extract keywords from job description
    const keywords = await extractKeywordsFromJobDescription(jobDescription);
    
    // Optimize CV for job
    const optimizationResult = await optimizeCVForJob(cvRecord.rawText || "", jobDescription, keywords);
    
    // Update metadata with job-specific optimization
    metadata.jobSpecificOptimization = {
      timestamp: new Date().toISOString(),
      jobDescription,
      keywords,
      matchScore: optimizationResult.matchScore,
      keywordsMatched: optimizationResult.keywordsMatched,
      suggestedImprovements: optimizationResult.suggestedImprovements
    };
    
    metadata.lastUpdated = new Date().toISOString();
    
    // Update CV record with new metadata
    await db.update(cvs)
      .set({
        metadata: JSON.stringify(metadata)
      })
      .where(eq(cvs.id, cvId));
    
    // Return success response with optimized CV
    return NextResponse.json({
      success: true,
      message: "CV optimized for job successfully",
      optimizedText: optimizationResult.optimizedText,
      matchScore: optimizationResult.matchScore,
      keywordsMatched: optimizationResult.keywordsMatched,
      suggestedImprovements: optimizationResult.suggestedImprovements
    });
  } catch (error) {
    logger.error("Error in job-specific CV optimization:", error instanceof Error ? error.message : String(error));
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "An unknown error occurred" },
      { status: 500 }
    );
  }
}

/**
 * Extract keywords from job description
 */
async function extractKeywordsFromJobDescription(jobDescription: string): Promise<string[]> {
  try {
    // Use OpenAI to extract keywords from job description
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "You are a helpful assistant that extracts important keywords from job descriptions. Focus on skills, technologies, qualifications, and responsibilities. Return only a JSON array of strings with no additional text."
        },
        {
          role: "user",
          content: `Extract the most important keywords from this job description that a candidate should highlight in their CV:\n\n${jobDescription}`
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
    });
    
    // Parse the response to get keywords
    const content = response.choices[0]?.message?.content || "{}";
    const parsedContent = JSON.parse(content);
    
    if (Array.isArray(parsedContent.keywords)) {
      return parsedContent.keywords;
    }
    
    // Fallback to simple keyword extraction if AI fails
    return extractKeywordsManually(jobDescription);
    
  } catch (error) {
    logger.error("Error extracting keywords from job description:", error instanceof Error ? error.message : String(error));
    // Fallback to simple keyword extraction
    return extractKeywordsManually(jobDescription);
  }
}

/**
 * Simple manual keyword extraction as fallback
 */
function extractKeywordsManually(text: string): string[] {
  // Common job-related keywords to look for
  const commonKeywords = [
    'management', 'leadership', 'development', 'marketing', 'sales', 'finance',
    'accounting', 'human resources', 'hr', 'operations', 'project management',
    'research', 'analysis', 'data', 'software', 'engineering', 'design',
    'customer service', 'communication', 'healthcare', 'education', 'technology',
    'it', 'programming', 'web development', 'mobile', 'cloud', 'ai', 'machine learning',
    'blockchain', 'cybersecurity', 'networking', 'database', 'sql', 'python', 'java',
    'javascript', 'react', 'angular', 'vue', 'node', 'aws', 'azure', 'gcp'
  ];
  
  // Convert text to lowercase for case-insensitive matching
  const lowerText = text.toLowerCase();
  
  // Find matches
  const matches = commonKeywords.filter(keyword => 
    lowerText.includes(keyword.toLowerCase())
  );
  
  // Extract additional potential keywords (words that appear multiple times)
  const words = lowerText.split(/\s+/);
  const wordCounts: Record<string, number> = {};
  
  words.forEach(word => {
    // Only consider words of reasonable length
    if (word.length > 4 && word.length < 20) {
      wordCounts[word] = (wordCounts[word] || 0) + 1;
    }
  });
  
  // Get words that appear multiple times
  const frequentWords = Object.entries(wordCounts)
    .filter(([word, count]) => count > 2 && !commonKeywords.includes(word))
    .map(([word]) => word)
    .slice(0, 10); // Limit to top 10
  
  // Combine common keywords and frequent words
  return [...new Set([...matches, ...frequentWords])].slice(0, 20); // Limit to top 20 unique keywords
}

/**
 * Optimize CV for a specific job
 */
async function optimizeCVForJob(
  cvText: string, 
  jobDescription: string, 
  keywords: string[]
): Promise<{
  optimizedText: string;
  matchScore: number;
  keywordsMatched: string[];
  suggestedImprovements: string[];
}> {
  try {
    const openai = new OpenAI();
    
    // Calculate initial match score based on keyword presence
    const keywordsMatched: string[] = [];
    const cvTextLower = cvText.toLowerCase();
    
    keywords.forEach(keyword => {
      if (cvTextLower.includes(keyword.toLowerCase())) {
        keywordsMatched.push(keyword);
      }
    });
    
    // Calculate initial match score
    const initialMatchScore = Math.min(
      Math.round((keywordsMatched.length / Math.max(keywords.length, 1)) * 100),
      100
    );
    
    // Use OpenAI to optimize the CV
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are a professional CV optimizer. Your task is to optimize a CV for a specific job description.
          
          Follow these guidelines:
          1. Maintain the original structure and sections of the CV
          2. Highlight relevant skills and experiences that match the job description
          3. Use industry-standard terminology from the job description
          4. Ensure the CV remains factual and truthful - do not invent experiences or skills
          5. Keep the same formatting style (bullet points, paragraphs, etc.)
          6. Identify keywords from the job description that are already present in the CV
          7. Suggest improvements to better match the job requirements
          8. Calculate a match score between the CV and job description
          
          Return your response as a JSON object with the following properties:
          - optimizedText: the optimized CV text
          - matchScore: a number between 0-100 representing how well the optimized CV matches the job
          - keywordsMatched: an array of keywords from the job description found in the CV
          - suggestedImprovements: an array of specific suggestions to further improve the CV`
        },
        {
          role: "user",
          content: `Here is the CV to optimize:
          
          ${cvText}
          
          Here is the job description:
          
          ${jobDescription}
          
          Here are some key keywords identified from the job description:
          ${keywords.join(", ")}
          
          Please optimize this CV for the job description, highlight relevant skills, and provide a match score, keywords matched, and suggested improvements.`
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
    });
    
    const result = JSON.parse(response.choices[0].message.content || "{}");
    
    return {
      optimizedText: result.optimizedText || cvText,
      matchScore: result.matchScore || initialMatchScore,
      keywordsMatched: result.keywordsMatched || keywordsMatched,
      suggestedImprovements: result.suggestedImprovements || []
    };
  } catch (error) {
    console.error("Error optimizing CV for job:", error);
    // Return original text with basic match data if optimization fails
    return {
      optimizedText: cvText,
      matchScore: 0,
      keywordsMatched: [],
      suggestedImprovements: ["Failed to generate optimization suggestions."]
    };
  }
} 