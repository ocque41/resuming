// app/api/analyze-cv/route.ts
import { NextRequest } from "next/server";
import { db } from "@/lib/db/drizzle";
import { cvs } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { MistralRAGService } from "@/lib/utils/mistralRagService";
import { logger } from "@/lib/utils/logger";

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
        error: "Only PDF files are supported. Other file types are for applying to jobs.",
        success: false 
      }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Perform CV analysis to determine industry, language, and calculate ATS score
    const analysis = await analyzeCV(cvId, cvContent, String(cv.userId));
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
      language: analysis.language,
      industry: analysis.industry,
      keywordAnalysis: analysis.keywords,
      strengths: analysis.strengths,
      weaknesses: analysis.weaknesses,
      recommendations: analysis.recommendations,
      formattingStrengths: analysis.formatStrengths,
      formattingWeaknesses: analysis.formatWeaknesses,
      formattingRecommendations: analysis.formatRecommendations,
      skills: analysis.skills,
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
 * Analyzes the CV content and extracts key information
 * Enhanced with RAG for better analysis accuracy
 */
async function analyzeCV(cvId: string, cvText: string, currentUserId: string | number): Promise<any> {
  // Create initial analysis result to be populated with proper typing
  const analysis = {
    cvId,
    userId: currentUserId,
    atsScore: 0,
    industry: "",
    language: "en",
    keywords: [] as string[],
    keyRequirements: [] as string[],
    strengths: [] as string[],
    weaknesses: [] as string[],
    recommendations: [] as string[],
    formatStrengths: [] as string[],
    formatWeaknesses: [] as string[],
    formatRecommendations: [] as string[],
    metadata: {} as Record<string, any>,
    sections: {} as Record<string, string>,
    skills: [] as string[],
    createdAt: new Date(),
    updatedAt: new Date()
  };

  try {
    // Log the start of the analysis
    logger.info(`Starting CV analysis for CV ID: ${cvId}`);

    // Use the RAG service for enhanced analysis
    const ragService = new MistralRAGService();
    
    // Process the CV document
    await ragService.processCVDocument(cvText);
    
    // Extract skills using RAG
    const extractedSkills = await ragService.extractSkills();
    analysis.skills = extractedSkills.length > 0 ? extractedSkills : [];
    
    // Analyze CV format
    const formatAnalysis = await ragService.analyzeCVFormat();
    analysis.formatStrengths = formatAnalysis.strengths || [];
    analysis.formatWeaknesses = formatAnalysis.weaknesses || [];
    analysis.formatRecommendations = formatAnalysis.recommendations || [];
    
    // Basic section extraction
    const cvSections = extractSections(cvText);
    analysis.sections = cvSections;
    
    // Determine industry based on content
    const industryKeywords = {
      "IT & Software": ["software", "developer", "programming", "code", "web", "app", "IT", "tech", "computer"],
      "Finance": ["finance", "accounting", "financial", "budget", "investment", "banking", "tax", "audit"],
      "Healthcare": ["healthcare", "medical", "doctor", "nurse", "patient", "hospital", "clinical", "health"],
      "Marketing": ["marketing", "brand", "advertising", "market", "campaign", "social media", "content", "SEO"],
      "Engineering": ["engineering", "engineer", "mechanical", "electrical", "civil", "design", "CAD", "construction"],
      "Education": ["education", "teaching", "teacher", "professor", "academic", "school", "university", "student"],
      "Sales": ["sales", "selling", "business development", "revenue", "client", "account", "customer", "CRM"],
      "Human Resources": ["HR", "human resources", "recruiting", "talent", "hiring", "employee", "personnel"],
      "Legal": ["legal", "law", "attorney", "lawyer", "compliance", "regulation", "contract", "litigation"],
      "Consulting": ["consulting", "consultant", "advisor", "strategy", "business", "management", "solution"]
    };
    
    // Count industry keywords
    const industryCounts: Record<string, number> = {};
    Object.entries(industryKeywords).forEach(([industry, keywords]) => {
      industryCounts[industry] = 0;
      keywords.forEach(keyword => {
        const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
        const matches = cvText.match(regex);
        if (matches) {
          industryCounts[industry] += matches.length;
        }
      });
    });
    
    // Find the industry with the most keyword matches
    let maxCount = 0;
    let detectedIndustry = "General";
    
    Object.entries(industryCounts).forEach(([industry, count]) => {
      if (count > maxCount) {
        maxCount = count;
        detectedIndustry = industry;
      }
    });
    
    analysis.industry = detectedIndustry;
    
    // Extract key requirements and keywords using RAG
    const keyRequirements = await ragService.extractKeyRequirements();
    analysis.keyRequirements = keyRequirements;
    
    const keywords = await ragService.extractKeywords();
    analysis.keywords = keywords;
    
    // Calculate ATS score based on multiple factors
    let score = 50; // Base score

    // Add points for good structure (having key sections)
    const keySections = ["education", "experience", "skills", "summary"];
    let sectionPoints = 0;
    keySections.forEach(section => {
      if (cvSections[section]) {
        sectionPoints += 5;
      }
    });
    score += Math.min(sectionPoints, 20); // Max 20 points for sections
    
    // Add points for skills relevance
    const skillsPoints = Math.min(extractedSkills.length * 2, 15); // Max 15 points for skills
    score += skillsPoints;
    
    // Add/subtract points for formatting strengths/weaknesses
    score += Math.min(analysis.formatStrengths.length * 2, 10); // Max 10 points for format strengths
    score -= Math.min(analysis.formatWeaknesses.length * 2, 15); // Max -15 points for format weaknesses
    
    // Ensure score is between 0 and 100
    analysis.atsScore = Math.max(0, Math.min(100, Math.round(score)));
    
    // Generate strengths and weaknesses
    if (analysis.atsScore >= 70) {
      analysis.strengths.push("Strong overall ATS compatibility");
    } else if (analysis.atsScore < 50) {
      analysis.weaknesses.push("Poor overall ATS compatibility");
    }
    
    if (extractedSkills.length >= 8) {
      analysis.strengths.push("Good range of skills listed");
    } else {
      analysis.weaknesses.push("Limited skills listed");
    }
    
    if (cvSections.experience && cvSections.experience.length > 200) {
      analysis.strengths.push("Detailed work experience");
    } else if (!cvSections.experience || cvSections.experience.length < 100) {
      analysis.weaknesses.push("Insufficient work experience details");
    }
    
    if (cvSections.education) {
      analysis.strengths.push("Education section included");
    } else {
      analysis.weaknesses.push("Missing education section");
    }
    
    // Generate recommendations based on weaknesses
    if (analysis.weaknesses.includes("Limited skills listed")) {
      analysis.recommendations.push("Add more industry-relevant skills");
    }
    
    if (analysis.weaknesses.includes("Insufficient work experience details")) {
      analysis.recommendations.push("Expand work experience with quantifiable achievements");
    }
    
    if (analysis.weaknesses.includes("Missing education section")) {
      analysis.recommendations.push("Add an education section");
    }
    
    // Add more recommendations based on format weaknesses
    analysis.formatWeaknesses.forEach(weakness => {
      if (!analysis.recommendations.includes(`Fix formatting issue: ${weakness}`)) {
        analysis.recommendations.push(`Fix formatting issue: ${weakness}`);
      }
    });
    
    // Populate metadata for future use
    analysis.metadata = {
      sections: cvSections,
      skills: extractedSkills,
      industry: detectedIndustry,
      keywords: keywords,
      keyRequirements: keyRequirements
    };
    
    logger.info(`Completed CV analysis for CV ID: ${cvId} with ATS score: ${analysis.atsScore}`);
    return analysis;
  } catch (error) {
    // Log error and return basic analysis
    const errorForLog = error instanceof Error ? error : new Error(`Unknown error: ${String(error)}`);
    logger.error(`Error during CV analysis: ${errorForLog.message}`);
    
    // Perform basic analysis as fallback
    const basicAnalysis = performBasicAnalysis(cvText, cvId, String(currentUserId));
    return basicAnalysis;
  }
}

/**
 * Performs a basic analysis of CV text when the advanced RAG analysis fails
 */
function performBasicAnalysis(cvText: string, cvId: string, userId: string): any {
  const basicAnalysis = {
    cvId,
    userId,
    atsScore: 50, // Default average score
    industry: "General",
    language: detectLanguage(cvText),
    keywords: [],
    keyRequirements: [],
    strengths: ["Basic CV structure detected"],
    weaknesses: ["Limited ATS optimization"],
    recommendations: ["Improve keyword usage for your industry", "Quantify achievements"],
    formatStrengths: [],
    formatWeaknesses: ["Basic formatting analysis unavailable"],
    formatRecommendations: ["Ensure consistent formatting"],
    metadata: {},
    sections: extractSections(cvText),
    skills: extractSkillsBasic(cvText),
    createdAt: new Date(),
    updatedAt: new Date()
  };
  
  // Basic metadata
  basicAnalysis.metadata = {
    sections: basicAnalysis.sections,
    skills: basicAnalysis.skills,
    industry: basicAnalysis.industry
  };
  
  return basicAnalysis;
}

/**
 * Extract skills using basic regex patterns
 */
function extractSkillsBasic(text: string): string[] {
  // Common skill keywords
  const commonSkills = [
    "JavaScript", "Python", "Java", "C#", "C++", "Ruby", "PHP", "SQL", "HTML", "CSS", 
    "React", "Angular", "Vue", "Node.js", "Express", "Django", "Flask", "Spring", 
    "AWS", "Azure", "GCP", "Docker", "Kubernetes", "Git", "CI/CD", "REST", "GraphQL",
    "Agile", "Scrum", "Project Management", "Team Leadership", "Communication", 
    "Problem Solving", "Critical Thinking", "Microsoft Office", "Excel", "PowerPoint",
    "Data Analysis", "Business Intelligence", "Marketing", "Sales", "Customer Service",
    "Financial Analysis", "Accounting", "HR Management", "Recruiting"
  ];
  
  const skills: string[] = [];
  
  // Extract skills from text
  commonSkills.forEach(skill => {
    const regex = new RegExp(`\\b${skill}\\b`, 'i');
    if (regex.test(text)) {
      skills.push(skill);
    }
  });
  
  return skills;
}

/**
 * Detect language of CV text
 */
function detectLanguage(text: string): string {
  const englishWords = ["experience", "education", "skills", "summary", "work"];
  const spanishWords = ["experiencia", "educación", "habilidades", "resumen", "trabajo"];
  const frenchWords = ["expérience", "éducation", "compétences", "résumé", "travail"];
  const germanWords = ["erfahrung", "ausbildung", "fähigkeiten", "zusammenfassung", "arbeit"];
  
  const countMatches = (words: string[]): number => {
    let count = 0;
    words.forEach(word => {
      const regex = new RegExp(`\\b${word}\\b`, 'i');
      if (regex.test(text)) {
        count++;
      }
    });
    return count;
  };
  
  const enCount = countMatches(englishWords);
  const esCount = countMatches(spanishWords);
  const frCount = countMatches(frenchWords);
  const deCount = countMatches(germanWords);
  
  const counts = [
    { lang: "en", count: enCount },
    { lang: "es", count: esCount },
    { lang: "fr", count: frCount },
    { lang: "de", count: deCount }
  ];
  
  counts.sort((a, b) => b.count - a.count);
  
  return counts[0].count > 0 ? counts[0].lang : "en";
}

/**
 * Extract sections from CV text with proper typing
 */
function extractSections(text: string): Record<string, string> {
  const sections: Record<string, string> = {};
  
  // Extract sections using regular expressions and handle null results
  const educationMatch = text.match(/education|university|college|degree|bachelor|master/i);
  sections.education = educationMatch ? educationMatch[0] : "";
  
  const experienceMatch = text.match(/experience|work history|employment|job/i);
  sections.experience = experienceMatch ? experienceMatch[0] : "";
  
  const skillsMatch = text.match(/skills|competencies|abilities|qualifications/i);
  sections.skills = skillsMatch ? skillsMatch[0] : "";
  
  const summaryMatch = text.match(/summary|about me|objective|career objective/i);
  sections.summary = summaryMatch ? summaryMatch[0] : "";
  
  return sections;
}
