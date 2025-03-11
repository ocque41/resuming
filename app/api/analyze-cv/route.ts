// app/api/analyze-cv/route.ts
import { NextRequest } from "next/server";
import { db } from "@/lib/db/drizzle";
import { cvs } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

/**
 * GET /api/analyze-cv
 * Enhanced CV analysis API endpoint with proper ATS scoring
 */
export async function GET(request: NextRequest) {
  try {
    // Get fileName from URL params (required)
    const searchParams = request.nextUrl.searchParams;
    const fileName = searchParams.get("fileName");
    const cvId = searchParams.get("cvId");

    // Early validations with helpful error messages
    if (!fileName) {
      console.error("Missing fileName parameter in analyze-cv request");
      return new Response(JSON.stringify({ 
        error: "Missing fileName parameter",
        success: false 
      }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (!cvId) {
      console.error("Missing cvId parameter in analyze-cv request");
      return new Response(JSON.stringify({ 
        error: "Missing cvId parameter",
        success: false 
      }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    console.log(`Starting CV analysis for ${fileName} (ID: ${cvId})`);

    // Parse cvId to integer safely
    let cvIdNumber: number;
    try {
      cvIdNumber = parseInt(cvId);
      if (isNaN(cvIdNumber)) {
        throw new Error(`Invalid cvId: ${cvId} is not a number`);
      }
    } catch (parseError) {
      console.error(`Error parsing cvId: ${cvId}`, parseError);
      return new Response(JSON.stringify({ 
        error: `Invalid cvId: ${cvId} is not a valid number`,
        success: false 
      }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Fetch CV record with safety checks
    let cv;
    try {
      cv = await db.query.cvs.findFirst({
        where: eq(cvs.id, cvIdNumber)
      });
    } catch (dbError) {
      console.error(`Database error fetching CV ${cvId}:`, dbError);
      return new Response(JSON.stringify({ 
        error: "Database error while fetching CV",
        details: dbError instanceof Error ? dbError.message : "Unknown database error",
        success: false
      }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (!cv) {
      console.error(`CV not found: ${cvId}`);
      return new Response(JSON.stringify({ 
        error: "CV not found",
        success: false 
      }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Get CV content with null check
    const cvContent = cv.rawText || "";
    if (!cvContent || cvContent.trim() === "") {
      console.error(`CV content is empty for ID: ${cvId}`);
      return new Response(JSON.stringify({ 
        error: "CV content is empty",
        success: false 
      }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Perform CV analysis to determine industry and calculate ATS score
    const analysis = analyzeCV(cvContent);
    console.log(`Analysis completed for CV ${cvId} with ATS score: ${analysis.atsScore}`);

    // Merge with existing metadata (if any)
    let metadata = {};
    if (cv.metadata) {
      try {
        metadata = JSON.parse(cv.metadata);
      } catch (parseError) {
        console.error(`Error parsing existing metadata for CV ${cvId}:`, parseError);
        // Continue with empty metadata instead of failing
        metadata = {};
      }
    }

    // Create updated metadata with analysis results
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

    // Update CV record with metadata safely
    try {
      await db.update(cvs)
        .set({ metadata: JSON.stringify(updatedMetadata) })
        .where(eq(cvs.id, cvIdNumber));
      
      console.log(`Successfully updated metadata for CV ${cvId}`);
    } catch (updateError) {
      console.error(`Error updating metadata for CV ${cvId}:`, updateError);
      return new Response(JSON.stringify({ 
        error: "Failed to update CV metadata",
        details: updateError instanceof Error ? updateError.message : "Unknown database error",
        success: false
      }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Return analysis results
    return new Response(JSON.stringify({ 
      success: true, 
      analysis,
      message: "CV analyzed successfully"
    }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    // Log the detailed error
    console.error(`Unexpected error analyzing CV:`, error);
    
    // Provide a user-friendly response
    return new Response(JSON.stringify({ 
      error: "Failed to analyze CV", 
      details: error instanceof Error ? error.message : "Unknown error occurred",
      success: false
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

/**
 * Analyze CV content to determine industry and calculate ATS score
 * @param cvContent The CV content to analyze
 * @returns Analysis results including ATS score, industry, and recommendations
 */
function analyzeCV(cvContent: string) {
  // Normalize text for analysis
  const normalizedText = cvContent.toLowerCase();
  
  // Define industry keywords for detection
  const INDUSTRY_KEYWORDS: Record<string, string[]> = {
    "Technology": ["software", "development", "programming", "api", "cloud", "infrastructure", "data", "analytics", "frontend", "backend", "fullstack", "devops", "agile", "scrum", "jira", "git", "aws", "azure", "javascript", "python", "java", "c#", "react", "angular", "vue", "node"],
    "Finance": ["investment", "portfolio", "financial", "trading", "assets", "banking", "analysis", "compliance", "risk", "audit", "accounting", "budget", "forecast", "revenue", "profit", "loss", "balance sheet", "income statement", "cash flow", "equity", "debt", "credit", "loan", "mortgage"],
    "Healthcare": ["patient", "clinical", "medical", "health", "care", "treatment", "diagnostic", "therapy", "hospital", "doctor", "nurse", "physician", "surgeon", "pharmacy", "medication", "prescription", "diagnosis", "prognosis", "symptoms", "disease", "illness", "wellness", "recovery"],
    "Marketing": ["campaign", "brand", "market", "strategy", "audience", "content", "social", "media", "advertising", "promotion", "seo", "sem", "ppc", "conversion", "funnel", "engagement", "retention", "acquisition", "customer", "client", "demographic", "psychographic", "segmentation"],
    "Sales": ["sales", "revenue", "quota", "pipeline", "prospect", "lead", "opportunity", "close", "deal", "customer", "client", "account", "territory", "region", "market", "upsell", "cross-sell", "negotiation", "presentation", "proposal", "contract", "commission", "bonus"],
    "Human Resources": ["hr", "recruit", "talent", "acquisition", "onboarding", "training", "development", "performance", "review", "compensation", "benefits", "payroll", "employee", "retention", "engagement", "culture", "diversity", "inclusion", "compliance", "policy", "procedure"],
    "Operations": ["operations", "process", "procedure", "efficiency", "optimization", "logistics", "supply chain", "inventory", "warehouse", "distribution", "production", "manufacturing", "quality", "control", "assurance", "lean", "six sigma", "kaizen", "continuous improvement"],
    "Legal": ["legal", "law", "attorney", "counsel", "compliance", "regulation", "contract", "agreement", "negotiation", "litigation", "dispute", "resolution", "intellectual property", "patent", "trademark", "copyright", "privacy", "data protection", "gdpr", "ccpa"],
    "Education": ["education", "teaching", "learning", "student", "teacher", "professor", "instructor", "curriculum", "course", "class", "lecture", "seminar", "workshop", "training", "development", "assessment", "evaluation", "grading", "feedback", "pedagogy", "andragogy"],
    "Consulting": ["consulting", "advisor", "expert", "specialist", "solution", "problem", "analysis", "recommendation", "implementation", "strategy", "tactic", "plan", "project", "management", "client", "stakeholder", "deliverable", "milestone", "timeline", "budget"],
    "General": ["project", "management", "team", "business", "client", "service", "process", "solution", "communication", "collaboration", "leadership", "organization", "planning", "execution", "monitoring", "evaluation", "reporting", "presentation", "documentation"]
  };
  
  // Define action verbs for achievement detection
  const ACTION_VERBS = [
    "achieved", "improved", "trained", "managed", "created", "increased", "reduced", "negotiated",
    "developed", "led", "organized", "provided", "delivered", "generated", "implemented", "produced",
    "supervised", "coordinated", "established", "executed", "built", "designed", "launched", "streamlined",
    "accelerated", "accomplished", "administered", "advanced", "advised", "advocated", "analyzed", "assembled",
    "assessed", "attained", "authored", "balanced", "boosted", "budgeted", "calculated", "cataloged",
    "chaired", "clarified", "coached", "collaborated", "communicated", "compiled", "completed", "composed",
    "conceptualized", "conducted", "consolidated", "constructed", "consulted", "controlled", "converted", "convinced",
    "crafted", "cultivated", "customized", "decreased", "defined", "delegated", "demonstrated", "derived",
    "detected", "determined", "devised", "diagnosed", "directed", "discovered", "dispatched", "distributed",
    "diversified", "documented", "doubled", "drafted", "drove", "earned", "edited", "educated",
    "eliminated", "empowered", "enabled", "encouraged", "engineered", "enhanced", "enlarged", "enlisted",
    "ensured", "established", "estimated", "evaluated", "examined", "exceeded", "expanded", "expedited",
    "experimented", "explained", "explored", "facilitated", "finalized", "focused", "forecasted", "formulated",
    "fostered", "founded", "fulfilled", "gained", "gathered", "guided", "handled", "headed",
    "identified", "illustrated", "imagined", "influenced", "informed", "initiated", "innovated", "inspected",
    "inspired", "installed", "instituted", "instructed", "integrated", "interpreted", "interviewed", "introduced",
    "invented", "investigated", "judged", "justified", "leveraged", "licensed", "maintained", "marketed",
    "mastered", "maximized", "measured", "mediated", "mentored", "merged", "minimized", "modeled",
    "modernized", "modified", "monitored", "motivated", "navigated", "negotiated", "observed", "obtained",
    "operated", "optimized", "orchestrated", "ordered", "organized", "originated", "overhauled", "oversaw",
    "performed", "persuaded", "pioneered", "planned", "positioned", "prepared", "presented", "prioritized",
    "processed", "procured", "programmed", "projected", "promoted", "proposed", "protected", "proved",
    "provided", "publicized", "published", "purchased", "qualified", "quantified", "questioned", "raised",
    "rated", "reached", "realigned", "rebuilt", "received", "recommended", "reconciled", "recorded",
    "recruited", "redesigned", "reduced", "refined", "regulated", "rehabilitated", "reinforced", "rejuvenated",
    "related", "remodeled", "rendered", "renegotiated", "reorganized", "repaired", "replaced", "reported",
    "represented", "researched", "resolved", "responded", "restored", "restructured", "retrieved", "revamped",
    "revealed", "revitalized", "saved", "scheduled", "screened", "secured", "selected", "separated",
    "served", "shaped", "shared", "simplified", "simulated", "solved", "sorted", "spearheaded",
    "specified", "standardized", "stimulated", "strategized", "structured", "studied", "submitted", "substantiated",
    "succeeded", "suggested", "summarized", "supervised", "supported", "surpassed", "surveyed", "synthesized",
    "systematized", "tabulated", "targeted", "taught", "tested", "tracked", "trained", "transformed",
    "translated", "trimmed", "tripled", "troubleshot", "uncovered", "unified", "united", "updated",
    "upgraded", "used", "utilized", "validated", "valued", "verified", "visualized", "won", "worked", "wrote"
  ];
  
  // Check for key elements
  const hasContact = /(?:email|phone|address|linkedin)/.test(normalizedText);
  const hasEducation = /(?:education|degree|university|college|bachelor|master|phd|diploma)/.test(normalizedText);
  const hasExperience = /(?:experience|work|employment|job|position|role)/.test(normalizedText);
  const hasSkills = /(?:skills|proficient|proficiency|familiar|expertise|expert|knowledge)/.test(normalizedText);
  const hasSummary = /(?:summary|profile|objective|about)/.test(normalizedText);
  
  // Count action verbs
  let actionVerbCount = 0;
  const actionVerbMatches: Record<string, number> = {};
  
  ACTION_VERBS.forEach(verb => {
    const regex = new RegExp(`\\b${verb}\\b`, 'gi');
    const matches = normalizedText.match(regex);
    if (matches) {
      actionVerbCount += matches.length;
      actionVerbMatches[verb] = matches.length;
    }
  });
  
  // Count metrics (numbers followed by % or other indicators)
  const metricsMatches = normalizedText.match(/\b\d+\s*(?:%|percent|million|billion|k|thousand|users|clients|customers|increase|decrease|growth)\b/gi);
  const metricsCount = metricsMatches ? metricsMatches.length : 0;
  
  // Assess keyword relevance by industry
  const keywordsByIndustry: Record<string, number> = {};
  const keywordMatches: Record<string, number> = {};
  
  Object.entries(INDUSTRY_KEYWORDS).forEach(([industry, keywords]) => {
    let count = 0;
    keywords.forEach(keyword => {
      const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
      const matches = normalizedText.match(regex);
      if (matches) {
        count += matches.length;
        keywordMatches[keyword] = (keywordMatches[keyword] || 0) + matches.length;
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
  
  // Calculate ATS score based on multiple factors
  let atsScore = 50; // Start at 50
  
  // Add points for having essential sections (up to 20 points)
  if (hasContact) atsScore += 5;
  if (hasEducation) atsScore += 5;
  if (hasExperience) atsScore += 5;
  if (hasSkills) atsScore += 5;
  if (hasSummary) atsScore += 5;
  
  // Add points for action verbs (up to 15 points)
  atsScore += Math.min(15, Math.floor(actionVerbCount / 2));
  
  // Add points for metrics (up to 15 points)
  atsScore += Math.min(15, metricsCount * 3);
  
  // Add points for industry relevance (up to 15 points)
  atsScore += Math.min(15, topCount);
  
  // Ensure score is between 0-100
  atsScore = Math.max(0, Math.min(100, atsScore));
  
  // Sort keywords by frequency
  const sortedKeywords = Object.entries(keywordMatches)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .reduce((obj, [key, value]) => {
      obj[key] = value;
      return obj;
    }, {} as Record<string, number>);
  
  // Generate strengths
  const strengths = [];
  if (hasContact) strengths.push("Contact information is present");
  if (hasEducation) strengths.push("Education section is included");
  if (hasExperience) strengths.push("Work experience is detailed");
  if (hasSkills) strengths.push("Skills section is present");
  if (actionVerbCount > 5) strengths.push("Good use of action verbs");
  if (metricsCount > 0) strengths.push("Metrics are included to quantify achievements");
  
  // Generate weaknesses
  const weaknesses = [];
  if (!hasContact) weaknesses.push("Contact information could be clearer");
  if (!hasEducation) weaknesses.push("Education section could be enhanced");
  if (!hasExperience) weaknesses.push("Work experience section needs more detail");
  if (!hasSkills) weaknesses.push("Skills section is missing or incomplete");
  if (actionVerbCount < 5) weaknesses.push("Could use more action verbs");
  if (metricsCount === 0) weaknesses.push("No metrics used to quantify achievements");
  
  // Generate recommendations
  const recommendations = [];
  if (!hasContact || !hasEducation || !hasExperience || !hasSkills) {
    recommendations.push("Ensure all key sections are included: contact, summary, experience, education, and skills");
  }
  if (actionVerbCount < 5) {
    recommendations.push("Add more action verbs to describe achievements (e.g., achieved, implemented, led)");
  }
  if (metricsCount === 0) {
    recommendations.push("Quantify achievements with specific metrics and percentages where possible");
  }
  
  // Return analysis results
  return {
    atsScore,
    industry: topIndustry,
    keywordAnalysis: sortedKeywords,
    strengths: strengths.slice(0, 3),
    weaknesses: weaknesses.slice(0, 3),
    recommendations: recommendations.slice(0, 3),
    formattingStrengths: [
      "Contact information is present",
      "Section headers are clear",
      "Content length is appropriate"
    ],
    formattingWeaknesses: [
      "Format could be more consistent",
      "Could use more action verbs",
      "Content could be more focused"
    ],
    formattingRecommendations: [
      "Ensure all key sections are included: contact, summary, experience, education, and skills",
      "Add more action verbs to describe achievements (e.g., achieved, implemented, led)",
      "Use consistent formatting throughout the document"
    ]
  };
}
