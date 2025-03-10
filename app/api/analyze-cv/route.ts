// app/api/analyze-cv/route.ts
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { cvs } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { logger } from "@/lib/logger";

/**
 * GET /api/analyze-cv
 * Streamlined CV analysis API endpoint
 */
export async function GET(request: NextRequest) {
  try {
    // Get fileName from URL params (required)
    const searchParams = request.nextUrl.searchParams;
    const fileName = searchParams.get("fileName");
    const cvId = searchParams.get("cvId");

    // Early validations
    if (!fileName) {
      return new Response(JSON.stringify({ error: "Missing fileName parameter" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (!cvId) {
      return new Response(JSON.stringify({ error: "Missing cvId parameter" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    logger.info(`Starting CV analysis for ${fileName} (ID: ${cvId})`);

    // Fetch CV record
    const cv = await db.query.cv.findFirst({
      where: eq(cvs.id, parseInt(cvId))
    });

    if (!cv) {
      logger.error(`CV not found: ${cvId}`);
      return new Response(JSON.stringify({ error: "CV not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Get CV content
    const cvContent = cv.content;
    if (!cvContent) {
      logger.error(`CV content not found for ID: ${cvId}`);
      return new Response(JSON.stringify({ error: "CV content not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Perform fast local analysis - use the same function from cvProcessor
    // Instead of importing a separate file, we'll define it inline here for simplicity
    const localAnalysis = performLocalAnalysis(cvContent);
    logger.info(`Local analysis completed for CV ID: ${cvId}, Score: ${localAnalysis.localAtsScore}`);

    // Transform to expected format
    const formattedStrengths = generateFormattingStrengths(localAnalysis);
    const formattedWeaknesses = generateFormattingWeaknesses(localAnalysis);
    const formattedRecommendations = generateFormattingRecommendations(localAnalysis);

    // Prepare analysis data
    const analysis = {
      atsScore: localAnalysis.localAtsScore,
      industry: localAnalysis.topIndustry,
      keywordAnalysis: localAnalysis.keywordsByIndustry,
      strengths: [
        "CV structure detected successfully",
        localAnalysis.hasContact ? "Contact information included" : "Basic information present",
        localAnalysis.hasSkills ? "Skills section detected" : "Content available for review"
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
      ],
      formattingStrengths: formattedStrengths,
      formattingWeaknesses: formattedWeaknesses, 
      formattingRecommendations: formattedRecommendations,
    };

    // Merge with existing metadata (if any)
    let metadata = {};
    if (cv.metadata) {
      try {
        metadata = JSON.parse(cv.metadata);
      } catch (e) {
        logger.error(`Error parsing existing metadata: ${e instanceof Error ? e.message : String(e)}`);
        metadata = {};
      }
    }

    // Create updated metadata
    const updatedMetadata = {
      ...metadata,
      atsScore: analysis.atsScore,
      industry: analysis.industry,
      keywordAnalysis: analysis.keywordAnalysis,
      strengths: analysis.strengths,
      weaknesses: analysis.weaknesses,
      recommendations: analysis.recommendations,
      formattingStrengths: analysis.formattingStrengths,
      formattingWeaknesses: analysis.formattingWeaknesses,
      formattingRecommendations: analysis.formattingRecommendations,
      analyzedAt: new Date().toISOString(),
      ready_for_optimization: true,
      analysis_status: 'complete'
    };

    // Update CV record with metadata
    await db.update(cvs)
      .set({ metadata: JSON.stringify(updatedMetadata) })
      .where(eq(cvs.id, parseInt(cvId)));

    logger.info(`Metadata updated for CV ${fileName} (ID: ${cvId})`);

    // Return analysis results
    return new Response(JSON.stringify({ 
      success: true, 
      analysis,
      message: "CV analyzed successfully"
    }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    logger.error(`Error analyzing CV: ${error instanceof Error ? error.message : String(error)}`);
    return new Response(JSON.stringify({ error: "Failed to analyze CV", details: error instanceof Error ? error.message : String(error) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

// Define a simplified version of performLocalAnalysis inline
// This is a subset of the full implementation from cvProcessor
function performLocalAnalysis(text: string) {
  // Define action verbs and industry keywords
  const ACTION_VERBS = [
    "achieved", "improved", "trained", "managed", "created", "increased", "reduced", "negotiated",
    "developed", "led", "organized", "provided", "delivered", "generated", "implemented", "produced",
    "supervised", "coordinated", "established", "executed", "built", "designed", "launched", "streamlined"
  ];
  
  const INDUSTRY_KEYWORDS: Record<string, string[]> = {
    "Technology": ["software", "development", "programming", "api", "cloud", "infrastructure", "data", "analytics"],
    "Finance": ["investment", "portfolio", "financial", "trading", "assets", "banking", "analysis", "compliance"],
    "Healthcare": ["patient", "clinical", "medical", "health", "care", "treatment", "diagnostic", "therapy"],
    "Marketing": ["campaign", "brand", "market", "strategy", "audience", "content", "social", "media"],
    "General": ["project", "management", "team", "business", "client", "service", "process", "solution"]
  };

  // Normalize text for analysis
  const normalizedText = text.toLowerCase();
  
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
  
  // Return analysis results
  return {
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
 * Generate formatting strengths based on CV analysis
 */
function generateFormattingStrengths(analysis: any): string[] {
  const strengths = [];

  if (analysis.hasContact) strengths.push("Contact information is present");
  if (analysis.hasEducation) strengths.push("Education section is included");
  if (analysis.hasExperience) strengths.push("Work experience is detailed");
  if (analysis.hasSkills) strengths.push("Skills section is present");
  if (analysis.actionVerbCount > 5) strengths.push("Good use of action verbs");
  if (analysis.metricsCount > 0) strengths.push("Metrics are included to quantify achievements");

  // Add generic strengths if needed to ensure at least 3
  while (strengths.length < 3) {
    if (!strengths.includes("Professional format detected")) {
      strengths.push("Professional format detected");
    } else if (!strengths.includes("Content length is appropriate")) {
      strengths.push("Content length is appropriate");
    } else if (!strengths.includes("Section headers are clear")) {
      strengths.push("Section headers are clear");
    } else {
      break;
    }
  }

  return strengths;
}

/**
 * Generate formatting weaknesses based on CV analysis
 */
function generateFormattingWeaknesses(analysis: any): string[] {
  const weaknesses = [];

  if (!analysis.hasContact) weaknesses.push("Contact information could be clearer");
  if (!analysis.hasEducation) weaknesses.push("Education section could be enhanced");
  if (!analysis.hasExperience) weaknesses.push("Work experience section needs more detail");
  if (!analysis.hasSkills) weaknesses.push("Skills section is missing or incomplete");
  if (analysis.actionVerbCount < 5) weaknesses.push("Could use more action verbs");
  if (analysis.metricsCount === 0) weaknesses.push("No metrics used to quantify achievements");

  const topIndustry = analysis.topIndustry;
  if (analysis.keywordsByIndustry[topIndustry] < 5) {
    weaknesses.push(`Could include more ${topIndustry} industry keywords`);
  }

  // Add generic weaknesses if needed to ensure at least 3
  while (weaknesses.length < 3) {
    if (!weaknesses.includes("Format could be more consistent")) {
      weaknesses.push("Format could be more consistent");
    } else if (!weaknesses.includes("Section headers could be more prominent")) {
      weaknesses.push("Section headers could be more prominent");
    } else if (!weaknesses.includes("Content could be more focused")) {
      weaknesses.push("Content could be more focused");
    } else {
      break;
    }
  }

  return weaknesses;
}

/**
 * Generate formatting recommendations based on CV analysis
 */
function generateFormattingRecommendations(analysis: any): string[] {
  const recommendations = [];

  if (!analysis.hasContact || !analysis.hasEducation || !analysis.hasExperience || !analysis.hasSkills) {
    recommendations.push("Ensure all key sections are included: contact, summary, experience, education, and skills");
  }

  if (analysis.actionVerbCount < 5) {
    recommendations.push("Add more action verbs to describe achievements (e.g., achieved, implemented, led)");
  }

  if (analysis.metricsCount === 0) {
    recommendations.push("Quantify achievements with specific metrics and percentages where possible");
  }

  const topIndustry = analysis.topIndustry;
  if (analysis.keywordsByIndustry[topIndustry] < 5) {
    recommendations.push(`Include more ${topIndustry} industry keywords to improve ATS compatibility`);
  }

  // Add generic recommendations if needed to ensure at least 3
  while (recommendations.length < 3) {
    if (!recommendations.includes("Use consistent formatting throughout the document")) {
      recommendations.push("Use consistent formatting throughout the document");
    } else if (!recommendations.includes("Make section headers clear and prominent")) {
      recommendations.push("Make section headers clear and prominent");
    } else if (!recommendations.includes("Keep content concise and focused on achievements")) {
      recommendations.push("Keep content concise and focused on achievements");
    } else {
      break;
    }
  }

  return recommendations;
}
