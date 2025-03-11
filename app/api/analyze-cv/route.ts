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
        error: "Only PDF files are supported. Other file types are for applying to jobs.",
        success: false 
      }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Perform CV analysis to determine industry, language, and calculate ATS score
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
      language: analysis.language,
      industry: analysis.industry,
      keywordAnalysis: analysis.keywordAnalysis,
      strengths: analysis.strengths,
      weaknesses: analysis.weaknesses,
      recommendations: analysis.recommendations,
      formattingStrengths: analysis.formattingStrengths,
      formattingWeaknesses: analysis.formattingWeaknesses,
      formattingRecommendations: analysis.formattingRecommendations,
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
 * Analyze CV content to determine industry, language, and calculate ATS score
 * @param cvContent The CV content to analyze
 * @returns Analysis results including ATS score, industry, and recommendations
 */
function analyzeCV(cvContent: string) {
  const analysis: any = {};
  
  // Set default values
  analysis.strengths = [];
  analysis.weaknesses = [];
  analysis.recommendations = [];
  analysis.keywordAnalysis = {};
  analysis.skills = [];
  analysis.sectionBreakdown = {};
  
  // Detect language
  analysis.language = detectLanguage(cvContent);
  
  // Look for basic structure elements
  const hasContact = /(?:phone|tel|email|address|location)[:. ]?/i.test(cvContent);
  const hasEducation = /(?:education|university|college|degree|bachelor|master)[:. ]?/i.test(cvContent);
  const hasExperience = /(?:experience|work history|employment|job)[:. ]?/i.test(cvContent);
  const hasProfile = /(?:profile|summary|about me|objective)[:. ]?/i.test(cvContent);
  
  // Look for skills section and extract skills
  let skillsExtracted: string[] = [];
  
  // Try to find a skills section using different patterns
  const skillsRegex = /(?:skills|competencies|proficiencies|expertise|technologies|technical skills)[:\s]+((?:.+(?:\n|$))+)/i;
  const skillsMatch = cvContent.match(skillsRegex);
  
  if (skillsMatch && skillsMatch[1]) {
    const skillsContent = skillsMatch[1];
    
    // Extract skills from the skills section
    // Look for bullet points, commas, or other separators
    const bulletPointSkills = skillsContent.match(/[•\-\*][^\n•\-\*]*/g);
    if (bulletPointSkills) {
      skillsExtracted = bulletPointSkills.map(skill => 
        skill.replace(/^[•\-\*\s]+/, '').trim()
      ).filter(skill => skill.length > 1);
    } else {
      // Split by commas or new lines if no bullet points found
      skillsExtracted = skillsContent
        .split(/[,\n]/)
        .map(skill => skill.trim())
        .filter(skill => skill.length > 1 && !skill.match(/^[\d\.]+$/));
    }
  }
  
  // If no skills section found, try to extract skills from the content
  if (skillsExtracted.length === 0) {
    // Common technical skills
    const techSkillsPattern = /\b(?:java|python|javascript|typescript|react|node\.js|angular|vue\.js|c\+\+|html|css|sql|nosql|aws|azure|cloud|docker|kubernetes|terraform|git|agile|scrum|ml|ai|data science)\b/gi;
    const techMatches = cvContent.match(techSkillsPattern);
    
    // Common soft skills
    const softSkillsPattern = /\b(?:leadership|communication|teamwork|problem.solving|analytical|project management|time management|creativity|adaptability|collaboration)\b/gi;
    const softMatches = cvContent.match(softSkillsPattern);
    
    // Combine and deduplicate
    if (techMatches || softMatches) {
      const allSkills = [...(techMatches || []), ...(softMatches || [])];
      const uniqueSkills = [...new Set(allSkills.map(s => s.trim()))];
      skillsExtracted = uniqueSkills.filter(s => s.length > 2);
    }
  }
  
  // Ensure skills are non-empty and unique
  analysis.skills = [...new Set(skillsExtracted)].filter(Boolean);
  
  // Detect industry based on content keywords
  const industries = [
    'Technology', 'Finance', 'Healthcare', 'Education', 'Marketing',
    'Manufacturing', 'Retail', 'Consulting', 'Law', 'Engineering',
    'Media', 'Hospitality', 'Automotive', 'Agriculture', 'Energy',
    'Real Estate', 'Transportation', 'Telecommunications', 'Pharmaceutical'
  ];
  
  // Calculate industry scores based on keyword matches
  const industryScores = industries.map(industry => {
    const keywords = getIndustryKeywords(industry);
    const score = keywords.reduce((total, keyword) => {
      const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
      const matches = (cvContent.match(regex) || []).length;
      return total + matches;
    }, 0);
    return { industry, score };
  });
  
  // Find the industry with the highest score
  const topIndustry = industryScores.sort((a, b) => b.score - a.score)[0];
  analysis.industry = topIndustry.industry;
  
  // If we have industry information, sort skills by relevance to the industry
  if (analysis.industry && analysis.skills.length > 0) {
    // Get industry-specific keywords
    const industryKeywords = getIndustryKeywords(analysis.industry);
    
    // Sort skills by relevance to the industry
    analysis.skills.sort((a: string, b: string) => {
      // Higher score for skills that match industry keywords
      const aIsIndustryRelevant = industryKeywords.some(keyword => 
        a.toLowerCase().includes(keyword.toLowerCase())
      );
      const bIsIndustryRelevant = industryKeywords.some(keyword => 
        b.toLowerCase().includes(keyword.toLowerCase())
      );
      
      if (aIsIndustryRelevant && !bIsIndustryRelevant) return -1;
      if (!aIsIndustryRelevant && bIsIndustryRelevant) return 1;
      
      // If both are industry-relevant or both are not, secondary sort by length
      return a.length - b.length;
    });
  }
  
  // Calculate approximate ATS score
  let score = 60; // Base score
  
  // Add points for structure
  if (hasContact) score += 5;
  if (hasEducation) score += 5;
  if (hasExperience) score += 10;
  if (hasProfile) score += 5;
  
  // Look for action verbs and achievements
  const actionVerbsPattern = /\b(led|managed|developed|created|implemented|achieved|improved|increased|reduced|designed|launched|negotiated|delivered)\b/gi;
  const actionVerbs = cvContent.match(actionVerbsPattern) || [];
  const hasActionVerbs = actionVerbs.length > 0;
  
  if (hasActionVerbs) score += 5;
  
  // Check for measurable results
  const measurableResultsPattern = /\b(\d+%|\$\d+|increased|decreased|reduced|improved|by \d+)\b/gi;
  const measurableResults = cvContent.match(measurableResultsPattern) || [];
  const hasMeasurableResults = measurableResults.length > 0;
  
  if (hasMeasurableResults) score += 5;
  
  // Check length - too short might be an issue
  if (cvContent.length < 1500) score -= 10;
  
  // Cap the score at 100
  analysis.atsScore = Math.min(100, Math.max(1, score));
  
  // Generate strengths
  if (hasContact) analysis.strengths.push('Includes contact information');
  if (hasProfile) analysis.strengths.push('Includes a professional summary');
  if (hasExperience) analysis.strengths.push('Details work experience');
  if (hasEducation) analysis.strengths.push('Includes educational background');
  if (hasActionVerbs) analysis.strengths.push('Uses strong action verbs');
  if (hasMeasurableResults) analysis.strengths.push('Quantifies achievements with measurable results');
  if (analysis.skills.length > 0) analysis.strengths.push(`Includes ${analysis.skills.length} relevant skills`);
  
  // Generate weaknesses
  if (!hasContact) analysis.weaknesses.push('Missing contact information');
  if (!hasProfile) analysis.weaknesses.push('Missing professional summary');
  if (!hasExperience) analysis.weaknesses.push('Work experience section needs enhancement');
  if (!hasEducation) analysis.weaknesses.push('Educational background should be included');
  if (!hasActionVerbs) analysis.weaknesses.push('Needs stronger action verbs');
  if (!hasMeasurableResults) analysis.weaknesses.push('Should quantify achievements with metrics');
  if (cvContent.length < 1500) analysis.weaknesses.push('CV is too short, consider adding more details');
  if (analysis.skills.length < 5) analysis.weaknesses.push('Skills section needs enhancement with more relevant skills');
  
  // Generate recommendations
  if (!hasContact) analysis.recommendations.push('Add complete contact information including phone, email, and LinkedIn');
  if (!hasProfile) analysis.recommendations.push('Add a compelling professional summary that highlights your value proposition');
  if (!hasExperience) analysis.recommendations.push('Enhance work experience section with detailed responsibilities and achievements');
  if (!hasEducation) analysis.recommendations.push('Include your educational background with degrees, institutions, and graduation dates');
  if (!hasActionVerbs) analysis.recommendations.push('Use strong action verbs to describe your achievements');
  if (!hasMeasurableResults) analysis.recommendations.push('Quantify your achievements with specific numbers and percentages');
  if (analysis.skills.length < 5) analysis.recommendations.push('Expand your skills section with relevant technical and soft skills');
  
  // Return the analysis
  return analysis;
}

/**
 * Detect the language of the CV content
 * Uses a simplified approach based on language-specific patterns
 * @param text The CV content
 * @returns ISO language code (en, es, fr, de)
 */
function detectLanguage(text: string): string {
  // Normalize and clean the text
  const normalizedText = text.toLowerCase();
  
  // Language-specific words with their frequencies
  const langPatterns: Record<string, string[]> = {
    "en": ["experience", "education", "skills", "summary", "profile", "job", "work", "about", "contact", "university", "college", "degree"],
    "es": ["experiencia", "educación", "habilidades", "resumen", "perfil", "trabajo", "empleo", "sobre", "contacto", "universidad", "licenciatura", "título"],
    "fr": ["expérience", "éducation", "compétences", "résumé", "profil", "travail", "emploi", "propos", "contact", "université", "diplôme", "formation"],
    "de": ["erfahrung", "bildung", "fähigkeiten", "zusammenfassung", "profil", "arbeit", "beschäftigung", "über", "kontakt", "universität", "studium", "abschluss"]
  };
  
  // Count occurrences of language-specific words
  const langScores: Record<string, number> = {
    "en": 0,
    "es": 0,
    "fr": 0,
    "de": 0
  };
  
  // Get word counts for each language
  Object.entries(langPatterns).forEach(([lang, patterns]) => {
    patterns.forEach(pattern => {
      const regex = new RegExp(`\\b${pattern}\\b`, 'gi');
      const matches = normalizedText.match(regex);
      if (matches) {
        langScores[lang] += matches.length;
      }
    });
  });
  
  // Determine the language with the highest score
  let detectedLang = "en"; // Default to English
  let highestScore = 0;
  
  Object.entries(langScores).forEach(([lang, score]) => {
    if (score > highestScore) {
      highestScore = score;
      detectedLang = lang;
    }
  });
  
  return detectedLang;
}

/**
 * Get industry-specific keywords for a given industry
 * @param industry The industry to get keywords for
 * @returns Array of keywords relevant to the industry
 */
function getIndustryKeywords(industry: string): string[] {
  const industryKeywordsMap: Record<string, string[]> = {
    'Technology': [
      'software', 'development', 'programming', 'code', 'java', 'python', 'javascript',
      'react', 'angular', 'node', 'cloud', 'aws', 'azure', 'devops', 'agile', 'scrum',
      'frontend', 'backend', 'fullstack', 'mobile', 'app', 'web', 'data', 'analytics',
      'ai', 'machine learning', 'security', 'network', 'database', 'sql', 'nosql'
    ],
    'Finance': [
      'banking', 'investment', 'financial', 'accounting', 'audit', 'tax', 'budget',
      'forecast', 'revenue', 'profit', 'loss', 'cash flow', 'balance sheet', 'equity',
      'asset', 'liability', 'portfolio', 'risk', 'compliance', 'regulatory', 'trading',
      'securities', 'stocks', 'bonds', 'derivatives', 'hedge', 'capital', 'market'
    ],
    'Healthcare': [
      'medical', 'clinical', 'healthcare', 'patient', 'doctor', 'nurse', 'hospital',
      'treatment', 'therapy', 'diagnosis', 'care', 'health', 'pharmaceutical', 'drug',
      'medicine', 'surgery', 'physician', 'practitioner', 'wellness', 'rehabilitation',
      'insurance', 'regulatory', 'compliance', 'ehr', 'electronic health record'
    ],
    'Education': [
      'teaching', 'learning', 'education', 'school', 'student', 'classroom', 'curriculum',
      'instruction', 'assessment', 'evaluation', 'pedagogy', 'academic', 'faculty',
      'professor', 'teacher', 'principal', 'administration', 'course', 'degree', 'grade',
      'university', 'college', 'research', 'scholarship', 'lecture', 'study'
    ],
    'Marketing': [
      'marketing', 'advertising', 'brand', 'campaign', 'strategy', 'digital', 'social media',
      'content', 'seo', 'sem', 'ppc', 'lead generation', 'conversion', 'analytics', 'market',
      'consumer', 'customer', 'audience', 'target', 'demographic', 'segmentation', 'engagement',
      'promotion', 'public relations', 'communications', 'creative', 'design'
    ],
    'Manufacturing': [
      'manufacturing', 'production', 'factory', 'assembly', 'quality', 'control', 'operations',
      'supply chain', 'logistics', 'inventory', 'procurement', 'lean', 'six sigma', 'process',
      'improvement', 'efficiency', 'automation', 'machinery', 'equipment', 'materials',
      'product', 'fabrication', 'engineering', 'industrial', 'safety', 'compliance'
    ],
    'Retail': [
      'retail', 'sales', 'customer', 'merchandising', 'inventory', 'store', 'e-commerce',
      'omnichannel', 'pos', 'point of sale', 'consumer', 'product', 'pricing', 'promotion',
      'display', 'layout', 'shopping', 'buyer', 'purchasing', 'supply chain', 'logistics',
      'distribution', 'fulfillment', 'brand', 'marketing', 'customer service'
    ],
    'Consulting': [
      'consulting', 'advisor', 'strategy', 'solution', 'client', 'engagement', 'project',
      'management', 'business', 'analysis', 'process', 'improvement', 'transformation',
      'change', 'implementation', 'recommendation', 'assessment', 'stakeholder', 'deliverable',
      'benchmark', 'best practice', 'framework', 'methodology', 'expertise'
    ],
    'Law': [
      'legal', 'law', 'attorney', 'lawyer', 'counsel', 'litigation', 'contract', 'compliance',
      'regulatory', 'statute', 'legislation', 'corporate', 'intellectual property', 'patent',
      'trademark', 'copyright', 'negotiation', 'dispute', 'resolution', 'mediation', 'arbitration',
      'court', 'judge', 'prosecution', 'defense', 'client'
    ],
    'Engineering': [
      'engineering', 'design', 'development', 'technical', 'specifications', 'prototype',
      'testing', 'validation', 'mechanical', 'electrical', 'civil', 'chemical', 'software',
      'industrial', 'biomedical', 'environmental', 'materials', 'structural', 'systems',
      'project', 'cad', 'simulation', 'analysis', 'quality', 'safety'
    ],
    'Media': [
      'media', 'content', 'publishing', 'broadcast', 'production', 'journalism', 'reporter',
      'editor', 'writer', 'creative', 'film', 'television', 'radio', 'digital', 'social media',
      'advertising', 'marketing', 'audience', 'engagement', 'streaming', 'entertainment',
      'news', 'story', 'editorial', 'podcast', 'video'
    ],
    'Hospitality': [
      'hospitality', 'hotel', 'restaurant', 'food', 'beverage', 'tourism', 'travel',
      'accommodation', 'guest', 'service', 'catering', 'event', 'planning', 'management',
      'operations', 'housekeeping', 'front desk', 'reservation', 'concierge', 'chef',
      'culinary', 'dining', 'entertainment', 'leisure', 'recreation'
    ],
    'Automotive': [
      'automotive', 'vehicle', 'car', 'truck', 'manufacturing', 'assembly', 'engineering',
      'design', 'production', 'dealership', 'sales', 'service', 'maintenance', 'repair',
      'parts', 'components', 'engine', 'transmission', 'safety', 'testing', 'quality',
      'supply chain', 'logistics', 'inventory', 'warranty'
    ],
    'Agriculture': [
      'agriculture', 'farming', 'crop', 'livestock', 'production', 'cultivation', 'harvest',
      'soil', 'irrigation', 'fertilization', 'pesticide', 'organic', 'sustainable', 'farm',
      'management', 'agribusiness', 'food', 'processing', 'distribution', 'supply chain',
      'equipment', 'machinery', 'seed', 'breeding', 'genetics'
    ],
    'Energy': [
      'energy', 'power', 'electricity', 'generation', 'distribution', 'transmission', 'utility',
      'renewable', 'solar', 'wind', 'hydroelectric', 'geothermal', 'biomass', 'oil', 'gas',
      'coal', 'nuclear', 'sustainability', 'efficiency', 'conservation', 'grid', 'storage',
      'carbon', 'emissions', 'climate'
    ],
    'Real Estate': [
      'real estate', 'property', 'development', 'construction', 'commercial', 'residential',
      'leasing', 'rental', 'sales', 'broker', 'agent', 'buyer', 'seller', 'investment',
      'management', 'appraisal', 'valuation', 'mortgage', 'financing', 'zoning', 'planning',
      'land', 'building', 'renovation', 'maintenance'
    ],
    'Transportation': [
      'transportation', 'logistics', 'shipping', 'freight', 'cargo', 'distribution', 'supply chain',
      'warehouse', 'inventory', 'fleet', 'vehicle', 'truck', 'rail', 'maritime', 'air', 'port',
      'terminal', 'transit', 'route', 'scheduling', 'operations', 'delivery', 'tracking',
      'safety', 'compliance'
    ],
    'Telecommunications': [
      'telecommunications', 'telecom', 'network', 'infrastructure', 'wireless', 'mobile',
      'broadband', 'internet', 'data', 'voice', 'service', 'provider', 'operator', 'carrier',
      'equipment', 'technology', 'fiber', 'satellite', 'spectrum', 'regulatory', 'compliance',
      '5g', '4g', 'lte', 'voip', 'communications'
    ],
    'Pharmaceutical': [
      'pharmaceutical', 'pharma', 'drug', 'medicine', 'development', 'research', 'clinical',
      'trial', 'fda', 'regulatory', 'compliance', 'manufacturing', 'quality', 'control',
      'assurance', 'safety', 'efficacy', 'patient', 'healthcare', 'biotechnology', 'therapy',
      'treatment', 'disease', 'diagnosis', 'medical'
    ]
  };
  
  // Return keywords for the specified industry, or generic business keywords if not found
  return industryKeywordsMap[industry] || [
    'management', 'leadership', 'strategy', 'project', 'team', 'client', 'customer',
    'service', 'business', 'communication', 'analysis', 'planning', 'implementation',
    'development', 'coordination', 'organization', 'administration', 'operation',
    'budget', 'report', 'presentation', 'meeting', 'collaboration', 'problem-solving'
  ];
}
