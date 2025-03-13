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
          content: `You are an expert CV and resume keyword analyzer specializing in ATS (Applicant Tracking Systems).
          
Your task is to extract the most important keywords from job descriptions that would help a CV pass through ATS filters and impress hiring managers.

Focus on extracting these types of keywords:
1. Hard skills (technical skills, software, tools, methodologies)
2. Soft skills (communication, leadership, problem-solving)
3. Industry-specific terminology and buzzwords
4. Required qualifications and certifications
5. Experience levels and job titles
6. Key responsibilities and deliverables

Return ONLY a JSON object with a single "keywords" property containing an array of strings.
Each keyword should be specific, relevant, and likely to be used in ATS filtering.
Aim for 15-25 keywords depending on the job description length and complexity.`
        },
        {
          role: "user",
          content: `Extract the most important keywords from this job description that a candidate should include in their CV to pass ATS filters and impress hiring managers:\n\n${jobDescription}`
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
    });
    
    // Parse the response to get keywords
    const content = response.choices[0]?.message?.content || "{}";
    const parsedContent = JSON.parse(content);
    
    if (Array.isArray(parsedContent.keywords) && parsedContent.keywords.length > 0) {
      // Filter out any non-string values and limit to 30 keywords max
      return parsedContent.keywords
        .filter((keyword: any) => typeof keyword === 'string')
        .map((keyword: string) => keyword.trim())
        .filter((keyword: string) => keyword.length > 0)
        .slice(0, 30);
    }
    
    // Fallback to simple keyword extraction if AI fails or returns empty array
    return extractKeywordsManually(jobDescription);
    
  } catch (error) {
    logger.error("Error extracting keywords from job description:", error instanceof Error ? error.message : String(error));
    // Fallback to simple keyword extraction
    return extractKeywordsManually(jobDescription);
  }
}

/**
 * Enhanced manual keyword extraction as fallback
 */
function extractKeywordsManually(text: string): string[] {
  // Common job-related keywords by category
  const commonKeywords = {
    technical: [
      'software', 'development', 'programming', 'engineering', 'data', 'analysis',
      'python', 'java', 'javascript', 'typescript', 'react', 'angular', 'vue', 'node',
      'aws', 'azure', 'gcp', 'cloud', 'devops', 'ci/cd', 'docker', 'kubernetes',
      'sql', 'nosql', 'database', 'api', 'rest', 'graphql', 'microservices',
      'machine learning', 'ai', 'artificial intelligence', 'deep learning', 'nlp',
      'blockchain', 'cybersecurity', 'networking', 'infrastructure', 'architecture'
    ],
    business: [
      'management', 'leadership', 'strategy', 'operations', 'project management',
      'product management', 'agile', 'scrum', 'kanban', 'lean', 'six sigma',
      'marketing', 'sales', 'business development', 'customer success',
      'finance', 'accounting', 'budget', 'forecasting', 'analysis',
      'human resources', 'hr', 'recruitment', 'talent acquisition'
    ],
    soft_skills: [
      'communication', 'teamwork', 'collaboration', 'problem-solving',
      'critical thinking', 'analytical', 'creativity', 'innovation',
      'adaptability', 'flexibility', 'time management', 'organization',
      'leadership', 'mentoring', 'coaching', 'conflict resolution'
    ],
    industry: [
      'healthcare', 'finance', 'banking', 'insurance', 'retail', 'e-commerce',
      'manufacturing', 'logistics', 'supply chain', 'transportation',
      'education', 'government', 'non-profit', 'consulting',
      'media', 'entertainment', 'advertising', 'marketing',
      'technology', 'telecommunications', 'aerospace', 'automotive'
    ],
    qualifications: [
      'bachelor', 'master', 'phd', 'mba', 'certification', 'license',
      'pmp', 'cpa', 'cfa', 'aws certified', 'azure certified', 'google certified',
      'scrum master', 'product owner', 'six sigma', 'itil', 'prince2'
    ]
  };
  
  // Flatten the categories into a single array
  const allCommonKeywords = Object.values(commonKeywords).flat();
  
  // Convert text to lowercase for case-insensitive matching
  const lowerText = text.toLowerCase();
  
  // Find matches from common keywords
  const matches = allCommonKeywords.filter(keyword => 
    lowerText.includes(keyword.toLowerCase())
  );
  
  // Extract n-grams (1-3 words) from the text
  const words = lowerText
    .replace(/[^\w\s]/g, ' ') // Replace punctuation with spaces
    .split(/\s+/)
    .filter(word => word.length > 2); // Only consider words with more than 2 characters
  
  // Generate word counts for single words
  const wordCounts: Record<string, number> = {};
  words.forEach(word => {
    if (word.length > 3 && word.length < 20) {
      wordCounts[word] = (wordCounts[word] || 0) + 1;
    }
  });
  
  // Generate bigrams and trigrams (2-word and 3-word phrases)
  const phrases: Record<string, number> = {};
  for (let i = 0; i < words.length - 1; i++) {
    // Bigrams
    if (words[i].length > 2 && words[i+1].length > 2) {
      const bigram = `${words[i]} ${words[i+1]}`;
      phrases[bigram] = (phrases[bigram] || 0) + 1;
    }
    
    // Trigrams
    if (i < words.length - 2 && words[i].length > 2 && words[i+1].length > 2 && words[i+2].length > 2) {
      const trigram = `${words[i]} ${words[i+1]} ${words[i+2]}`;
      phrases[trigram] = (phrases[trigram] || 0) + 1;
    }
  }
  
  // Get frequent single words (appearing more than once)
  const frequentWords = Object.entries(wordCounts)
    .filter(([word, count]) => count > 1 && !matches.includes(word))
    .sort((a, b) => b[1] - a[1])
    .map(([word]) => word)
    .slice(0, 15);
  
  // Get frequent phrases (appearing more than once)
  const frequentPhrases = Object.entries(phrases)
    .filter(([phrase, count]) => count > 1 && !matches.includes(phrase))
    .sort((a, b) => b[1] - a[1])
    .map(([phrase]) => phrase)
    .slice(0, 10);
  
  // Combine all keywords and remove duplicates
  const combinedKeywords = [...new Set([...matches, ...frequentWords, ...frequentPhrases])];
  
  // Limit to 25 keywords maximum
  return combinedKeywords.slice(0, 25);
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
          content: `You are a professional CV optimizer specializing in ATS optimization and job-specific tailoring. Your task is to optimize a CV for a specific job description.
          
          Follow these guidelines:
          1. Maintain the original structure and sections of the CV (Header, Profile, Achievements, Goals, Skills, Languages, Education)
          2. Highlight relevant skills and experiences that match the job description
          3. Use industry-standard terminology and exact keywords from the job description
          4. Ensure the CV remains factual and truthful - enhance existing content but do not invent experiences or skills
          5. Keep the same formatting style (bullet points, paragraphs, etc.)
          6. For each achievement, ensure it includes quantifiable metrics (numbers, percentages, etc.)
          7. Tailor the Profile section to emphasize experience and skills relevant to the job
          8. Reorder Skills to prioritize those most relevant to the job description
          9. Ensure all sections have proper content - no "Not specified" or empty sections
          
          For ATS optimization:
          - Use exact keyword matches from the job description
          - Include industry-specific terminology
          - Use standard section headings
          - Incorporate keywords naturally throughout the CV
          - Use simple formatting that ATS systems can parse easily
          
          Format the CV with clear section headings using markdown format:
          
          # PROFILE
          [Profile content here]
          
          # ACHIEVEMENTS
          - [Achievement 1 with metrics]
          - [Achievement 2 with metrics]
          - [Achievement 3 with metrics]
          
          # EXPERIENCE
          ## [Company Name] - [Position] ([Duration])
          - [Responsibility 1]
          - [Responsibility 2]
          - [Responsibility 3]
          
          ## [Company Name] - [Position] ([Duration])
          - [Responsibility 1]
          - [Responsibility 2]
          - [Responsibility 3]
          
          # SKILLS
          - [Skill 1]
          - [Skill 2]
          - [Skill 3]
          
          # EDUCATION
          ## [Degree]
          [Institution], [Year]
          
          # LANGUAGES
          [Language 1]: [Proficiency]
          [Language 2]: [Proficiency]
          
          Return your response as a JSON object with the following properties:
          - optimizedText: the complete optimized CV text with all sections properly formatted as shown above
          - matchScore: a number between 0-100 representing how well the optimized CV matches the job
          - keywordsMatched: an array of keywords from the job description found in the CV, with context about where and how they're used
          - suggestedImprovements: an array of specific, actionable suggestions to further improve the CV for this job`
        },
        {
          role: "user",
          content: `Here is the CV to optimize:
          
          ${cvText}
          
          Here is the job description:
          
          ${jobDescription}
          
          Here are some key keywords identified from the job description:
          ${keywords.join(", ")}
          
          Please optimize this CV for the job description, highlight relevant skills, and provide a detailed match score, keywords matched with context, and specific actionable improvements.`
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.5,
    });
    
    const result = JSON.parse(response.choices[0].message.content || "{}");
    
    // Ensure we have valid data for each field
    const optimizedText = result.optimizedText || cvText;
    const matchScore = typeof result.matchScore === 'number' ? result.matchScore : initialMatchScore;
    
    // Process keywords matched to ensure they're in the right format
    let processedKeywordsMatched = keywordsMatched;
    if (Array.isArray(result.keywordsMatched)) {
      processedKeywordsMatched = result.keywordsMatched.map((item: any) => {
        if (typeof item === 'string') return item;
        if (typeof item === 'object' && item !== null && 'keyword' in item) return item.keyword;
        return String(item);
      });
    }
    
    // Ensure suggestions are strings
    let processedSuggestions: string[] = [];
    if (Array.isArray(result.suggestedImprovements)) {
      processedSuggestions = result.suggestedImprovements.map((item: any) => String(item));
    }
    
    // If we don't have enough suggestions, generate some basic ones
    if (processedSuggestions.length < 3) {
      const basicSuggestions = [
        "Add more quantifiable achievements with specific metrics",
        "Include more keywords from the job description in your Profile section",
        "Highlight specific technical skills that match the job requirements",
        "Tailor your Goals section to align with the company's mission",
        "Reorganize your Skills section to prioritize those most relevant to this position"
      ];
      
      // Add basic suggestions until we have at least 3
      while (processedSuggestions.length < 3) {
        const suggestion = basicSuggestions[processedSuggestions.length % basicSuggestions.length];
        if (!processedSuggestions.includes(suggestion)) {
          processedSuggestions.push(suggestion);
        }
      }
    }
    
    // Ensure the optimized text has proper section headings
    let formattedText = optimizedText;
    
    // Check if the text already has markdown headings
    if (!formattedText.includes("# PROFILE") && !formattedText.includes("# ACHIEVEMENTS")) {
      // Try to add section headings
      const sections = [
        { name: "PROFILE", regex: /^(.*?)(?=\n\n|$)/s },
        { name: "ACHIEVEMENTS", regex: /(?:^|\n)(?:•|-|\*)\s+.*?(?:\n(?:•|-|\*)\s+.*?)*(?=\n\n|$)/s },
        { name: "EXPERIENCE", regex: /(?:^|\n)(?:Company|Work|Employment).*?(?:\n(?:•|-|\*)\s+.*?)*(?=\n\n|$)/s },
        { name: "SKILLS", regex: /(?:^|\n)(?:Skills|Competencies|Technical).*?(?:\n(?:•|-|\*)\s+.*?)*(?=\n\n|$)/s },
        { name: "EDUCATION", regex: /(?:^|\n)(?:Education|Degree|University|College).*?(?=\n\n|$)/s },
        { name: "LANGUAGES", regex: /(?:^|\n)(?:Languages|Language).*?(?=\n\n|$)/s }
      ];
      
      let newText = formattedText;
      for (const section of sections) {
        const match = newText.match(section.regex);
        if (match && match.index !== undefined) {
          const beforeMatch = newText.substring(0, match.index);
          const matchContent = match[0];
          const afterMatch = newText.substring(match.index + matchContent.length);
          
          // Only add heading if it's not already there
          if (!matchContent.includes(`# ${section.name}`)) {
            newText = beforeMatch + `\n\n# ${section.name}\n\n` + matchContent + afterMatch;
          }
        }
      }
      
      formattedText = newText;
    }
    
    return {
      optimizedText: formattedText,
      matchScore,
      keywordsMatched: processedKeywordsMatched,
      suggestedImprovements: processedSuggestions
    };
  } catch (error) {
    logger.error("Error optimizing CV for job:", error instanceof Error ? error.message : String(error));
    
    // Return original text with basic match data if optimization fails
    return {
      optimizedText: cvText,
      matchScore: 0,
      keywordsMatched: [],
      suggestedImprovements: [
        "Failed to generate optimization suggestions due to an error.",
        "Try to include more keywords from the job description in your CV.",
        "Ensure your achievements include quantifiable metrics (numbers, percentages).",
        "Tailor your profile section to highlight experience relevant to this job."
      ]
    };
  }
} 