import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/db/queries.server";
import { mistralService, extractJsonFromMarkdown } from "@/lib/services/mistral.service";
import { logger } from "@/lib/logger";

// Define the expected shape of a job match analysis response
interface JobMatchAnalysis {
  overallMatchScore: number;
  strengths: string[];
  gaps: string[];
  matchedKeywords: string[];
  missingKeywords: string[];
  sectionAnalysis: Array<{ 
    section: string; 
    score: number; 
    comments: string;
  }>;
  dimensionalScores: {
    technicalSkills: number;
    experience: number;
    education: number;
    softSkills: number;
  };
  improvements: string[];
}

export async function POST(req: NextRequest) {
  try {
    // Check authentication
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse the request body
    const body = await req.json();
    const { cvText, jobDescription } = body;

    // Validate required parameters
    if (!cvText) {
      return NextResponse.json(
        { error: "CV text is required" },
        { status: 400 }
      );
    }

    if (!jobDescription) {
      return NextResponse.json(
        { error: "Job description is required" },
        { status: 400 }
      );
    }

    // Construct the prompt
    const prompt = `Analyze how well the following CV matches the provided job description.

CV:
---
${cvText}

Job Description:
---
${jobDescription}

Please provide a comprehensive analysis with the following sections:
1. Overall Match Score (as a percentage)
2. Strengths (areas where the CV aligns well with the job requirements)
3. Gaps (areas where the CV lacks required skills/experience)
4. Matched Keywords (important skills and qualifications mentioned in both the CV and job description)
5. Missing Keywords (important requirements from the job description not found in the CV)
6. Section Analysis (how well each section of the CV addresses job requirements)
7. Dimensional Scores (rate the following dimensions from 0-100):
   - Technical Skills Match
   - Experience Level Match
   - Education Requirements Match
   - Soft Skills Match
8. Improvements (specific recommendations to improve the CV for this job)

Format your response as a JSON object with the following structure:
{
  "overallMatchScore": number,
  "strengths": [string],
  "gaps": [string],
  "matchedKeywords": [string],
  "missingKeywords": [string],
  "sectionAnalysis": [{ "section": string, "score": number, "comments": string }],
  "dimensionalScores": {
    "technicalSkills": number,
    "experience": number,
    "education": number,
    "softSkills": number
  },
  "improvements": [string]
}`;

    try {
      // Use the new generateJSON method which handles JSON parsing internally
      const analysis = await mistralService.generateJSON<JobMatchAnalysis>({
        prompt,
        temperature: 0.3,
        max_tokens: 3000
      });
      
      // Return the analysis
      return NextResponse.json(analysis);
    } catch (parseError) {
      logger.error("Error parsing job match analysis result:", parseError instanceof Error ? parseError.message : String(parseError));
      
      // Fallback: Try to generate text and parse it manually as a last resort
      try {
        const rawResponse = await mistralService.generateText({
          prompt,
          temperature: 0.3,
          max_tokens: 3000,
          response_format: { type: "json_object" }
        });
        
        // Clean up response and handle potential markdown formatting
        const cleanedResponse = extractJsonFromMarkdown(rawResponse);
        const analysis = JSON.parse(cleanedResponse) as JobMatchAnalysis;
        
        logger.info("Successfully parsed job match analysis using fallback method");
        return NextResponse.json(analysis);
      } catch (fallbackError) {
        logger.error("Fallback parsing also failed:", fallbackError instanceof Error ? fallbackError.message : String(fallbackError));
        return NextResponse.json(
          { error: "Failed to parse job match analysis result" },
          { status: 500 }
        );
      }
    }
  } catch (error) {
    logger.error("Error analyzing job match", error instanceof Error ? error.message : String(error));
    return NextResponse.json(
      { error: "Failed to analyze job match" },
      { status: 500 }
    );
  }
} 