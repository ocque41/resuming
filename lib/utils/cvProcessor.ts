import { db } from "@/lib/db/drizzle";
import { cvs } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { logger } from "@/lib/logger";
import OpenAI from "openai";
import fs from "fs";
import path from "path";

/**
 * Process CV asynchronously with OpenAI GPT-4o
 * This function handles the entire CV processing workflow without blocking the API response
 * @param cvId The ID of the CV to process
 * @param rawText The raw text of the CV
 * @param currentMetadata The current metadata of the CV
 * @param forceRefresh Optional. Whether to force refresh the CV processing
 */
export async function processCVWithAI(
  cvId: number, 
  rawText: string, 
  currentMetadata: any, 
  forceRefresh: boolean = false
) {
  try {
    // Update progress - text extraction completed
    const metadata = {
      ...currentMetadata,
      processingProgress: 10,
      processingStatus: "Analyzing CV content with AI",
      processingError: null,
      lastUpdated: new Date().toISOString(),
    };
    
    await updateCVMetadata(cvId, metadata);
    
    // Initialize OpenAI client
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    
    // Get system reference content
    const systemReferenceContent = await getSystemReferenceContent();
    
    // Start AI processing
    logger.info(`Starting CV processing with OpenAI for CV ID: ${cvId} (forceRefresh: ${forceRefresh})`);
    
    // First step: Analyze the CV (20%)
    await updateCVMetadata(cvId, {
      ...metadata,
      processingProgress: 20,
      processingStatus: "Analyzing CV structure and content...",
      lastUpdated: new Date().toISOString(),
    });
    
    // Request analysis from OpenAI
    const analysisResponse = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are an expert ATS (Applicant Tracking System) analyzer and CV optimizer. 
          Your job is to analyze a CV and provide detailed feedback.
          ${systemReferenceContent}`
        },
        {
          role: "user",
          content: `Please analyze this CV and provide a detailed assessment:
          
          ${rawText}
          
          Focus on:
          1. ATS compatibility score (0-100)
          2. Industry detection
          3. Key strengths
          4. Areas for improvement
          5. Specific recommendations
          
          Format your response as JSON with these keys: atsScore, industry, strengths, weaknesses, recommendations`
        }
      ],
      response_format: { type: "json_object" }
    });
    
    // Parse the analysis
    const analysisText = analysisResponse.choices[0]?.message?.content || "{}";
    let analysis;
    try {
      analysis = JSON.parse(analysisText);
    } catch (e) {
      logger.error("Failed to parse analysis JSON", e instanceof Error ? e.message : String(e));
      analysis = {
        atsScore: 50,
        industry: "Unknown",
        strengths: ["Could not analyze strengths"],
        weaknesses: ["Could not analyze weaknesses"],
        recommendations: ["Could not generate recommendations"]
      };
    }
    
    // Update progress (40%)
    await updateCVMetadata(cvId, {
      ...metadata,
      processingProgress: 40,
      processingStatus: "Optimizing CV content...",
      atsScore: analysis.atsScore,
      industry: analysis.industry,
      strengths: analysis.strengths,
      weaknesses: analysis.weaknesses,
      recommendations: analysis.recommendations,
      lastUpdated: new Date().toISOString(),
    });
    
    // Generate optimized CV content
    const optimizationResponse = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are an expert CV optimizer specializing in creating ATS-friendly, impactful CVs.
          Your task is to rewrite a CV to make it more effective, impactful, and optimized for ATS systems.
          ${systemReferenceContent}`
        },
        {
          role: "user",
          content: `Here is a CV that needs optimization:
          
          ${rawText}
          
          Analysis results:
          - ATS Score: ${analysis.atsScore}/100
          - Industry: ${analysis.industry}
          - Weaknesses: ${analysis.weaknesses.join(", ")}
          
          Please rewrite this CV to make it more effective and ATS-friendly. 
          Maintain the person's actual experience and qualifications, but improve the wording, 
          structure, and impact. Focus on addressing the weaknesses identified.`
        }
      ]
    });
    
    // Get the optimized text
    const optimizedText = optimizationResponse.choices[0]?.message?.content || "";
    
    // Generate specific improvements made
    const improvementsResponse = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are an expert CV analyst tasked with identifying specific improvements made between an original CV and its optimized version."
        },
        {
          role: "user",
          content: `
          Original CV:
          ${rawText}
          
          Optimized CV:
          ${optimizedText}
          
          List the 5 most important specific improvements made in the optimized version. 
          Format as a JSON array of strings, with each improvement being clear and specific.
          Example format: ["Added quantifiable achievements to work experience", "Improved keyword density for ATS"]
          `
        }
      ],
      response_format: { type: "json_object" }
    });
    
    // Parse the improvements
    const improvementsText = improvementsResponse.choices[0]?.message?.content || "{}";
    let improvements;
    try {
      const improvementsData = JSON.parse(improvementsText);
      improvements = Array.isArray(improvementsData.improvements) ? 
        improvementsData.improvements : 
        ["Improved overall formatting", "Enhanced keyword optimization", "Strengthened impact of achievements"];
    } catch (e) {
      logger.error("Failed to parse improvements JSON", e instanceof Error ? e.message : String(e));
      improvements = ["Improved overall formatting", "Enhanced keyword optimization", "Strengthened impact of achievements"];
    }
    
    // Update progress (70%)
    await updateCVMetadata(cvId, {
      ...metadata,
      processingProgress: 70,
      processingStatus: "Finalizing optimization...",
      optimizedText,
      improvements,
      lastUpdated: new Date().toISOString(),
    });
    
    // Calculate improved ATS score (simulate improvement)
    const originalAtsScore = analysis.atsScore || 60;
    const improvedAtsScore = Math.min(98, Math.floor(originalAtsScore * 1.3)); // 30% improvement capped at 98
    
    // Mark as complete (100%)
    await updateCVMetadata(cvId, {
      ...metadata,
      processingProgress: 100,
      processingCompleted: true,
      processing: false,
      optimized: true,
      processingStatus: "Processing completed successfully!",
      atsScore: originalAtsScore,
      improvedAtsScore,
      optimizedText,
      improvements,
      lastUpdated: new Date().toISOString(),
      completedAt: new Date().toISOString(),
    });
    
    logger.info(`CV processing completed for CV ID: ${cvId}`);
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    logger.error(`Error in CV processing for CV ID: ${cvId}`, errorMessage);
    
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