// app/api/analyze-cv/route.ts
import { NextRequest } from "next/server";
import { db } from "@/lib/db/drizzle";
import { cvs } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { MistralRAGService } from "@/lib/utils/mistralRagService";
import { logger } from "@/lib/utils/logger";

// Type definition for analysis result
interface AnalysisResult {
  cvId: string;
  userId: string | number;
  atsScore: number;
  industry: string;
  language: string;
  keywords: string[];
  keyRequirements: string[];
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
  formatStrengths: string[];
  formatWeaknesses: string[];
  formatRecommendations: string[];
  metadata: Record<string, any>;
  sections: Record<string, string>;
  skills: string[];
  createdAt: Date;
  updatedAt: Date;
}

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
async function analyzeCV(cvId: string, cvText: string, currentUserId: string | number): Promise<AnalysisResult> {
  try {
    logger.info(`Starting CV analysis for CV ID: ${cvId}`);
    
    // Create initial result object with default values
    const result: AnalysisResult = {
      cvId: cvId,
      userId: currentUserId,
      atsScore: 0,
      industry: "Unknown",
      language: "en",
      keywords: [],
      keyRequirements: [],
      strengths: [],
      weaknesses: [],
      recommendations: [],
      formatStrengths: [],
      formatWeaknesses: [],
      formatRecommendations: [],
      metadata: {},
      sections: {},
      skills: [],
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Start RAG processing
    logger.info(`Initializing RAG service for CV ID: ${cvId}`);
    const ragService = new MistralRAGService();
    
    // Process the document
    try {
      logger.info(`Processing document for CV ID: ${cvId}`);
      await ragService.processCVDocument(cvText);
      logger.info(`Document processing complete for CV ID: ${cvId}`);
    } catch (error) {
      logger.error(`Error processing document: ${error instanceof Error ? error.message : String(error)}`);
      logger.info(`Falling back to basic analysis for CV ID: ${cvId}`);
      return performBasicAnalysis(cvText, cvId, currentUserId.toString());
    }
    
    // Extract skills
    try {
      logger.info(`Extracting skills for CV ID: ${cvId}`);
      const skills = await ragService.extractSkills();
      result.skills = skills;
      logger.info(`Extracted ${skills.length} skills for CV ID: ${cvId}`);
    } catch (error) {
      logger.warn(`Error extracting skills: ${error instanceof Error ? error.message : String(error)}`);
    }
    
    // Extract keywords with retry mechanism
    try {
      logger.info(`Extracting keywords for CV ID: ${cvId}`);
      let retries = 0;
      const MAX_RETRIES = 2;
      
      while (retries <= MAX_RETRIES) {
        try {
          const keywords = await ragService.extractKeywords();
          if (keywords && keywords.length > 0) {
            result.keywords = keywords;
            logger.info(`Successfully extracted ${keywords.length} keywords for CV ID: ${cvId}`);
            break;
          } else {
            throw new Error("Empty keywords response");
          }
        } catch (keywordError) {
          retries++;
          if (retries <= MAX_RETRIES) {
            logger.warn(`Retry ${retries}/${MAX_RETRIES} for keyword extraction`);
            await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second before retry
          } else {
            logger.error(`Failed to extract keywords after ${MAX_RETRIES} retries`);
            // Use fallback keywords
            result.keywords = ["Communication skills", "Problem solving", "Team work", "Leadership", "Project management"];
          }
        }
      }
    } catch (error) {
      logger.warn(`Error extracting keywords: ${error instanceof Error ? error.message : String(error)}`);
      result.keywords = ["Communication skills", "Problem solving", "Team work", "Leadership", "Project management"];
    }
    
    // Extract key requirements
    try {
      logger.info(`Extracting key requirements for CV ID: ${cvId}`);
      const keyRequirements = await ragService.extractKeyRequirements();
      result.keyRequirements = keyRequirements;
      logger.info(`Extracted ${keyRequirements.length} key requirements for CV ID: ${cvId}`);
    } catch (error) {
      logger.warn(`Error extracting key requirements: ${error instanceof Error ? error.message : String(error)}`);
    }
    
    // Analyze CV format with retry mechanism
    try {
      logger.info(`Analyzing CV format for CV ID: ${cvId}`);
      let retries = 0;
      const MAX_RETRIES = 2;
      
      while (retries <= MAX_RETRIES) {
        try {
          const formatAnalysis = await ragService.analyzeCVFormat();
          
          // Verify we got useful results
          if (formatAnalysis && 
              formatAnalysis.strengths.length > 0 && 
              formatAnalysis.weaknesses.length > 0 && 
              formatAnalysis.recommendations.length > 0) {
            
            result.formatStrengths = formatAnalysis.strengths;
            result.formatWeaknesses = formatAnalysis.weaknesses;
            result.formatRecommendations = formatAnalysis.recommendations;
            
            logger.info(`Successfully analyzed CV format: ${formatAnalysis.strengths.length} strengths, ${formatAnalysis.weaknesses.length} weaknesses, ${formatAnalysis.recommendations.length} recommendations`);
            break;
          } else {
            throw new Error("Incomplete format analysis response");
          }
        } catch (formatError) {
          retries++;
          if (retries <= MAX_RETRIES) {
            logger.warn(`Retry ${retries}/${MAX_RETRIES} for format analysis`);
            await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second before retry
          } else {
            logger.error(`Failed to analyze format after ${MAX_RETRIES} retries`);
            // Use fallback format analysis
            result.formatStrengths = ["Clear section organization", "Consistent formatting"];
            result.formatWeaknesses = ["Could improve visual hierarchy", "Layout could be more ATS-friendly"];
            result.formatRecommendations = ["Use bullet points for key achievements", "Add more white space"];
          }
        }
      }
    } catch (error) {
      logger.warn(`Error analyzing CV format: ${error instanceof Error ? error.message : String(error)}`);
      // Provide fallback format analysis
      result.formatStrengths = ["Clear section organization", "Consistent formatting"];
      result.formatWeaknesses = ["Could improve visual hierarchy", "Layout could be more ATS-friendly"];
      result.formatRecommendations = ["Use bullet points for key achievements", "Add more white space"];
    }
    
    // Determine industry based on skill matches
    const industryKeywords = {
      "IT & Software": ["software", "developer", "programming", "javascript", "python", "java", "web", "frontend", "backend", "fullstack", "database"],
      "Finance": ["finance", "accounting", "financial", "investment", "banking", "analyst", "portfolio", "trading", "risk management"],
      "Healthcare": ["healthcare", "medical", "clinical", "patient", "doctor", "nurse", "care", "health", "hospital"],
      "Marketing": ["marketing", "digital marketing", "social media", "content", "seo", "sem", "advertising", "brand", "market research"],
      "Sales": ["sales", "business development", "account management", "customer", "revenue", "closing", "pipeline", "leads", "negotiation"]
    };
    
    // Count industry keyword matches
    const industryCounts: Record<string, number> = {};
    const normalizedText = cvText.toLowerCase();
    
    for (const [industry, keywords] of Object.entries(industryKeywords)) {
      industryCounts[industry] = keywords.reduce((count, keyword) => {
        return count + (normalizedText.includes(keyword.toLowerCase()) ? 1 : 0);
      }, 0);
    }
    
    // Determine the most likely industry
    let maxCount = 0;
    let detectedIndustry = "General";
    
    for (const [industry, count] of Object.entries(industryCounts)) {
      if (count > maxCount) {
        maxCount = count;
        detectedIndustry = industry;
      }
    }
    
    result.industry = detectedIndustry;
    
    // Detect language
    try {
      const detectedLanguage = detectLanguage(cvText);
      result.language = detectedLanguage;
    } catch (error) {
      logger.warn(`Error detecting language: ${error instanceof Error ? error.message : String(error)}`);
    }
    
    // Extract sections
    try {
      result.sections = extractSections(cvText);
    } catch (error) {
      logger.warn(`Error extracting sections: ${error instanceof Error ? error.message : String(error)}`);
    }
    
    // Calculate ATS score based on various factors
    const hasSummary = result.sections["summary"] || result.sections["profile"] || result.sections["objective"];
    const hasExperience = result.sections["experience"] || result.sections["work experience"] || result.sections["employment history"];
    const hasEducation = result.sections["education"];
    const hasSkills = result.sections["skills"] || result.sections["technical skills"];
    
    let atsScore = 50; // Base score
    
    // Adjust based on key sections
    if (hasSummary) atsScore += 5;
    if (hasExperience) atsScore += 10;
    if (hasEducation) atsScore += 5;
    if (hasSkills) atsScore += 10;
    
    // Adjust based on keyword count
    atsScore += Math.min(10, result.keywords.length);
    
    // Adjust based on format analysis
    atsScore -= Math.min(10, result.formatWeaknesses.length * 2);
    
    // Ensure score stays within reasonable bounds
    atsScore = Math.max(30, Math.min(90, atsScore));
    
    result.atsScore = atsScore;
    
    // Set metadata with sections info
    result.metadata = {
      hasSummary,
      hasExperience,
      hasEducation,
      hasSkills,
      sectionCount: Object.keys(result.sections).length
    };
    
    logger.info(`Completed analysis for CV ID: ${cvId} with ATS score: ${atsScore}`);
    
    return result;
  } catch (error) {
    logger.error(`Error analyzing CV ID ${cvId}: ${error instanceof Error ? error.message : String(error)}`);
    // Return basic analysis as fallback
    return performBasicAnalysis(cvText, cvId, currentUserId.toString());
  }
}

/**
 * Performs a basic analysis of CV text when the advanced RAG analysis fails
 */
function performBasicAnalysis(cvText: string, cvId: string, userId: string): AnalysisResult {
  // Log that we're falling back to basic analysis
  logger.info(`Performing basic analysis for CV ID: ${cvId} as RAG analysis failed`);
  
  // Extract basic information
  const detectedLanguage = detectLanguage(cvText);
  const sections = extractSections(cvText);
  const extractedSkills = extractSkillsBasic(cvText);
  
  // Determine industry based on content (simplified version)
  const industryKeywords = {
    "IT & Software": ["software", "developer", "programming", "code", "web", "app", "IT", "tech", "computer"],
    "Finance": ["finance", "accounting", "financial", "budget", "investment", "banking"],
    "Healthcare": ["healthcare", "medical", "doctor", "nurse", "patient", "hospital"],
    "Marketing": ["marketing", "brand", "advertising", "market", "campaign", "social media"],
    "Engineering": ["engineering", "engineer", "mechanical", "electrical", "civil", "design"],
    "Education": ["education", "teaching", "teacher", "professor", "academic", "school"],
    "Sales": ["sales", "selling", "business development", "revenue", "client", "customer"],
    "Human Resources": ["HR", "human resources", "recruiting", "talent", "hiring", "employee"]
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
  
  // Create basic format analysis
  const basicFormatStrengths = [
    "Basic document structure detected",
    "Sections appear to be separated appropriately"
  ];
  
  const basicFormatWeaknesses = [
    "May need better formatting for ATS compatibility",
    "Could benefit from clearer section headings", 
    "Visual hierarchy could be improved"
  ];
  
  const basicFormatRecommendations = [
    "Use clear section headings (e.g., Experience, Education, Skills)",
    "Organize information in bullet points for better readability",
    "Ensure consistent formatting throughout the document"
  ];
  
  // Extract top keywords from the CV text
  const extractKeywordsBasic = (text: string): string[] => {
    const commonKeywords = [
      "Project Management", "Leadership", "Communication", "Team Work", 
      "Problem Solving", "Strategic Planning", "Analysis", "Research",
      "Development", "Design", "Implementation", "Testing", "Customer Service",
      "Sales", "Marketing", "Finance", "Operations", "Management"
    ];
    
    const foundKeywords: string[] = [];
    
    commonKeywords.forEach(keyword => {
      const regex = new RegExp(`\\b${keyword}\\b`, 'i');
      if (regex.test(text)) {
        foundKeywords.push(keyword);
      }
    });
    
    // Add skills as keywords too
    return [...foundKeywords, ...extractedSkills.slice(0, 5)];
  };
  
  // Extract basic key requirements
  const extractRequirementsBasic = (text: string): string[] => {
    const requirements = [];
    
    if (text.match(/\b(degree|bachelor|master|phd|mba)\b/i)) {
      requirements.push("Higher education degree");
    }
    
    if (text.match(/\b(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s+(year|yr)[s]?\b/i)) {
      requirements.push("Several years of professional experience");
    }
    
    if (text.match(/\b(lead|manage|direct|supervise)\b/i)) {
      requirements.push("Leadership experience");
    }
    
    if (text.match(/\b(certification|certified|license|diploma)\b/i)) {
      requirements.push("Professional certification or license");
    }
    
    // Add default requirements if we didn't find enough
    if (requirements.length < 3) {
      requirements.push("Relevant industry experience");
      requirements.push("Technical proficiency in field-specific tools");
    }
    
    return requirements;
  };
  
  // Extract basic keywords and requirements
  const keywords = extractKeywordsBasic(cvText);
  const keyRequirements = extractRequirementsBasic(cvText);
  
  // Calculate a basic ATS score (30-70 range for basic analysis)
  let atsScore = 50; // Base score
  
  // Add points for having key sections
  const keySections = ["education", "experience", "skills", "summary"];
  let sectionPoints = 0;
  keySections.forEach(section => {
    if (sections[section]) {
      sectionPoints += 3;
    }
  });
  atsScore += sectionPoints;
  
  // Add points for skills
  atsScore += Math.min(extractedSkills.length, 10);
  
  // Ensure score is in 30-70 range for basic analysis
  atsScore = Math.max(30, Math.min(70, atsScore));
  
  // Create basic strengths and weaknesses
  const strengths = ["Basic CV structure detected"];
  const weaknesses = ["Limited ATS optimization"];
  
  if (extractedSkills.length >= 5) {
    strengths.push("Multiple skills identified");
  } else {
    weaknesses.push("Limited skills identified");
  }
  
  if (sections.experience) {
    strengths.push("Work experience section detected");
  } else {
    weaknesses.push("Work experience section may be missing or unclear");
  }
  
  // Create basic recommendations
  const recommendations = [
    "Add more industry-specific keywords",
    "Quantify achievements with measurable results",
    "Ensure all essential sections are clearly labeled"
  ];
  
  // Create and return the basic analysis result
  const basicAnalysis: AnalysisResult = {
    cvId,
    userId,
    atsScore, 
    industry: detectedIndustry,
    language: detectedLanguage,
    keywords,
    keyRequirements,
    strengths,
    weaknesses,
    recommendations,
    formatStrengths: basicFormatStrengths,
    formatWeaknesses: basicFormatWeaknesses,
    formatRecommendations: basicFormatRecommendations,
    metadata: {
      sections,
      skills: extractedSkills,
      industry: detectedIndustry,
      keywords,
      keyRequirements,
      formatAnalysis: {
        strengths: basicFormatStrengths,
        weaknesses: basicFormatWeaknesses,
        recommendations: basicFormatRecommendations
      },
      language: detectedLanguage,
      atsScore
    },
    sections,
    skills: extractedSkills,
    createdAt: new Date(),
    updatedAt: new Date()
  };
  
  logger.info(`Completed basic analysis for CV ID: ${cvId} with ATS score: ${basicAnalysis.atsScore}`);
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
