/**
 * Analyzes a CV's content to calculate scores and extract insights
 */
export async function analyzeCV(rawText: string): Promise<any> {
  try {
    // Get text content
    const textContent = rawText || "";
    
    // Check if we have any content to analyze
    if (!textContent || textContent.trim().length === 0) {
      return {
        error: "No text content to analyze",
        atsScore: 0,
        industry: "Unknown",
        skills: [],
        recommendations: [
          "Upload a CV with valid content",
          "Make sure your CV is properly formatted",
          "Try uploading a different file format"
        ]
      };
    }
    
    // Calculate ATS score based on actual content
    const baseScore = 50; // Starting point
    
    // Extract sections from CV
    const sections = extractSections(textContent);
    const keywords = extractKeywords(textContent);
    const industry = detectIndustry(textContent);
    
    // Analyze content and calculate score adjustments
    const lengthScore = Math.min(15, Math.floor(textContent.length / 500)); // Up to 15 points for length
    
    // Points for section completeness
    const sectionScore = calculateSectionScore(sections);
    
    // Points for keyword density and relevance
    const keywordScore = calculateKeywordScore(keywords, industry);
    
    // Total ATS score - cap at 98 to always leave room for improvement
    const atsScore = Math.min(98, baseScore + lengthScore + sectionScore + keywordScore);
    
    // Generate recommendations based on analysis
    const recommendations = generateRecommendations(sections, keywords, atsScore);
    
    // Create analysis result
    const analysis = {
      atsScore: atsScore,
      industry: industry,
      sectionBreakdown: sections,
      keywordAnalysis: keywords,
      recommendations: recommendations,
      strengths: identifyStrengths(sections, keywords),
      weaknesses: identifyWeaknesses(sections, keywords),
      analysisDate: new Date().toISOString()
    };
    
    return analysis;
  } catch (error) {
    console.error("Error analyzing CV:", error);
    return {
      error: "Failed to analyze CV",
      atsScore: 35,
      industry: "Unknown",
      recommendations: [
        "Try uploading a different file",
        "Check if the file is corrupted",
        "Contact support if the problem persists"
      ]
    };
  }
}

/**
 * Extracts sections from CV text
 */
function extractSections(text: string): Record<string, string> {
  const sectionMatches: Record<string, string> = {};
  
  // Common section headers to look for
  const sectionHeaders = [
    { name: "summary", patterns: ["summary", "profile", "professional summary", "objective", "about me"] },
    { name: "experience", patterns: ["experience", "work experience", "employment", "work history", "professional experience"] },
    { name: "education", patterns: ["education", "academic", "qualifications", "training", "degrees"] },
    { name: "skills", patterns: ["skills", "technical skills", "competencies", "expertise", "proficiencies"] },
    { name: "projects", patterns: ["projects", "personal projects", "key projects", "professional projects"] },
    { name: "certifications", patterns: ["certifications", "certificates", "licenses", "accreditations"] },
    { name: "languages", patterns: ["languages", "language proficiencies", "spoken languages"] },
    { name: "references", patterns: ["references", "professional references"] },
    { name: "awards", patterns: ["awards", "honors", "recognitions", "achievements"] },
    { name: "contact", patterns: ["contact", "contact information", "personal details", "personal information"] }
  ];
  
  // Simple section extraction based on headlines
  // In a real implementation, this would use more sophisticated NLP
  const lines = text.split(/\r?\n/);
  let currentSection = "";
  let sectionContent = "";
  
  for (const line of lines) {
    const cleanLine = line.trim().toLowerCase();
    
    // Check if this line is a section header
    let foundSection = false;
    for (const section of sectionHeaders) {
      for (const pattern of section.patterns) {
        if (cleanLine.includes(pattern) && (cleanLine.length < 50)) {
          // Save previous section if we were tracking one
          if (currentSection && sectionContent.trim()) {
            sectionMatches[currentSection] = sectionContent.trim();
          }
          
          // Start new section
          currentSection = section.name;
          sectionContent = "";
          foundSection = true;
          break;
        }
      }
      if (foundSection) break;
    }
    
    // If not a section header, add to current section
    if (!foundSection && currentSection) {
      sectionContent += line + "\n";
    } else if (!foundSection && !currentSection && line.trim()) {
      // Text before any recognized section - assume it's contact info or header
      if (!sectionMatches["contact"]) {
        sectionMatches["contact"] = line + "\n";
      } else {
        sectionMatches["contact"] += line + "\n";
      }
    }
  }
  
  // Save the last section
  if (currentSection && sectionContent.trim()) {
    sectionMatches[currentSection] = sectionContent.trim();
  }
  
  return sectionMatches;
}

/**
 * Extract important keywords from CV text
 */
function extractKeywords(text: string): { [key: string]: number } {
  const keywords: { [key: string]: number } = {};
  
  // List of important keywords to look for
  const importantTerms = [
    // Skills
    "api", "javascript", "python", "java", "react", "node", "aws", "cloud", "devops", "docker", "kubernetes",
    "typescript", "sql", "nosql", "mongodb", "database", "angular", "vue", "frontend", "backend", "fullstack",
    "machine learning", "ai", "artificial intelligence", "data science", "data analysis", "big data",
    "agile", "scrum", "kanban", "project management", "jira", "git", "github", "ci/cd", "testing",
    "azure", "gcp", "serverless", "microservices", "spring", "design patterns", "oop", "functional programming",
    
    // Action verbs
    "developed", "implemented", "led", "managed", "created", "designed", "architected", "built", "deployed",
    "improved", "optimized", "reduced", "increased", "achieved", "delivered", "collaborated", "coordinated",
    
    // Education terms
    "bachelor", "master", "phd", "degree", "university", "college", "gpa", "honors", "thesis", 
    
    // Experience descriptions
    "team", "leadership", "responsible", "project", "customer", "client", "product", "production",
    "scalable", "performance", "security", "budget", "deadline", "milestone", "requirements"
  ];
  
  // Count occurrences of important terms
  // In a real implementation, this would use more sophisticated NLP
  const lowerText = text.toLowerCase();
  
  for (const term of importantTerms) {
    // Count occurrences with word boundaries
    const regex = new RegExp(`\\b${term}\\b`, 'gi');
    const matches = lowerText.match(regex);
    
    if (matches) {
      keywords[term] = matches.length;
    }
  }
  
  return keywords;
}

/**
 * Detect the industry based on CV content
 */
function detectIndustry(text: string): string {
  const lowerText = text.toLowerCase();
  
  // Industry indicators - simple keyword matching
  // In a real implementation, this would use more sophisticated NLP and ML
  const industries = [
    { name: "Software Development", keywords: ["software", "developer", "programming", "code", "java", "python", "javascript"] },
    { name: "Data Science", keywords: ["data science", "machine learning", "ml", "ai", "artificial intelligence", "analytics", "data mining"] },
    { name: "IT Operations", keywords: ["devops", "infrastructure", "sysadmin", "system administrator", "network", "cloud", "aws", "azure"] },
    { name: "Finance", keywords: ["finance", "financial", "accounting", "accountant", "investment", "banking", "trader", "stock"] },
    { name: "Healthcare", keywords: ["healthcare", "medical", "doctor", "nurse", "patient", "clinic", "hospital", "health"] },
    { name: "Marketing", keywords: ["marketing", "seo", "social media", "campaign", "brand", "digital marketing", "content marketing"] },
    { name: "Education", keywords: ["teacher", "professor", "education", "teaching", "academic", "school", "university", "curriculum"] },
    { name: "Engineering", keywords: ["engineering", "mechanical", "electrical", "civil", "structural", "engineer", "automotive"] },
    { name: "Design", keywords: ["design", "ux", "ui", "user experience", "graphic design", "product design", "user interface"] },
    { name: "Sales", keywords: ["sales", "account manager", "business development", "customer success", "revenue", "crm"] }
  ];
  
  // Count matches for each industry
  const industryCounts: Record<string, number> = {};
  
  for (const industry of industries) {
    let count = 0;
    for (const keyword of industry.keywords) {
      const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
      const matches = lowerText.match(regex);
      if (matches) {
        count += matches.length;
      }
    }
    industryCounts[industry.name] = count;
  }
  
  // Find industry with highest count
  let maxCount = 0;
  let detectedIndustry = "General";
  
  for (const [industry, count] of Object.entries(industryCounts)) {
    if (count > maxCount) {
      maxCount = count;
      detectedIndustry = industry;
    }
  }
  
  // If very few keywords matched, return "General"
  if (maxCount < 3) {
    detectedIndustry = "General";
  }
  
  return detectedIndustry;
}

/**
 * Calculate score based on section completeness
 */
function calculateSectionScore(sections: Record<string, string>): number {
  let score = 0;
  
  // Important sections with weighted scores
  const sectionScores = {
    'summary': 5,
    'experience': 10,
    'education': 7,
    'skills': 8,
    'projects': 5,
    'certifications': 3,
    'languages': 2,
    'awards': 2,
    'contact': 3
  };
  
  // Calculate content length score for each section
  for (const [section, content] of Object.entries(sections)) {
    if (section in sectionScores) {
      const sectionWeight = sectionScores[section as keyof typeof sectionScores];
      
      // Check if content is meaningful (more than just a few characters)
      if (content && content.length > 20) {
        // Award partial points based on content length up to maximum for section
        const contentScore = Math.min(sectionWeight, Math.floor(content.length / 100));
        score += contentScore;
      }
    }
  }
  
  return score;
}

/**
 * Calculate score based on keyword density and relevance
 */
function calculateKeywordScore(keywords: Record<string, number>, industry: string): number {
  let score = 0;
  const keywordCount = Object.keys(keywords).length;
  
  // Base score from number of unique keywords
  if (keywordCount >= 5) score += 2;
  if (keywordCount >= 10) score += 3;
  if (keywordCount >= 15) score += 5;
  if (keywordCount >= 20) score += 5;
  
  // Bonus for industry-relevant keywords
  const industryKeywords = getIndustrySpecificKeywords(industry);
  let relevantKeywordCount = 0;
  
  for (const keyword of Object.keys(keywords)) {
    if (industryKeywords.some(ik => keyword.includes(ik) || ik.includes(keyword))) {
      relevantKeywordCount++;
    }
  }
  
  // Add points for relevant keywords
  if (relevantKeywordCount >= 3) score += 3;
  if (relevantKeywordCount >= 7) score += 5;
  if (relevantKeywordCount >= 12) score += 7;
  
  return score;
}

/**
 * Get keywords that are important for a specific industry
 */
function getIndustrySpecificKeywords(industry: string): string[] {
  const keywordsByIndustry: Record<string, string[]> = {
    "Software Development": [
      "react", "angular", "vue", "javascript", "typescript", "java", "python", "go", "rust", "c#", "api",
      "microservices", "aws", "azure", "gcp", "cloud", "frontend", "backend", "full-stack", "agile", "ci/cd"
    ],
    "Data Science": [
      "python", "r", "sql", "nosql", "machine learning", "deep learning", "tensorflow", "pytorch", "pandas",
      "numpy", "statistics", "data mining", "data visualization", "big data", "hadoop", "spark", "etl"
    ],
    "IT Operations": [
      "devops", "sre", "kubernetes", "docker", "jenkins", "terraform", "ansible", "aws", "azure", "gcp",
      "linux", "windows", "networking", "security", "monitoring", "automation", "infrastructure as code"
    ],
    "Finance": [
      "accounting", "financial analysis", "investment", "portfolio", "risk management", "banking", "trading",
      "compliance", "regulatory", "sap", "quickbooks", "excel", "financial modeling", "forecasting"
    ],
    "Healthcare": [
      "patient care", "clinical", "medical", "ehrs", "hipaa", "healthcare compliance", "medical coding",
      "patient management", "clinical trials", "medical research", "treatment", "diagnosis"
    ],
    "Marketing": [
      "digital marketing", "seo", "sem", "ppc", "content marketing", "social media", "analytics", "cro",
      "brand management", "campaign management", "market research", "google analytics", "marketing automation"
    ],
    "Education": [
      "curriculum development", "instructional design", "teaching", "assessment", "student engagement",
      "classroom management", "educational technology", "lesson planning", "pedagogy", "e-learning"
    ],
    "Engineering": [
      "cad", "solidworks", "autocad", "design", "manufacturing", "product development", "mechanical", 
      "electrical", "civil", "structural", "simulation", "testing", "quality assurance"
    ],
    "Design": [
      "ui", "ux", "user experience", "adobe creative suite", "sketch", "figma", "visual design", "interaction design",
      "graphic design", "typography", "color theory", "wireframing", "prototyping", "usability testing"
    ],
    "Sales": [
      "account management", "business development", "crm", "salesforce", "negotiation", "relationship building",
      "sales pipeline", "lead generation", "closing", "sales strategy", "customer acquisition"
    ],
    "General": [
      "leadership", "management", "communication", "teamwork", "project management", "time management",
      "problem solving", "critical thinking", "collaboration", "organization", "customer service"
    ]
  };
  
  // Return keywords for the specified industry or general keywords if industry not found
  return keywordsByIndustry[industry] || keywordsByIndustry["General"];
}

/**
 * Generate recommendations based on CV analysis
 */
function generateRecommendations(sections: Record<string, string>, keywords: Record<string, number>, score: number): string[] {
  const recommendations: string[] = [];
  
  // Add recommendations based on missing sections
  const importantSections = ['summary', 'experience', 'education', 'skills'];
  for (const section of importantSections) {
    if (!sections[section] || sections[section].length < 50) {
      recommendations.push(`Add or expand your ${section} section`);
    }
  }
  
  // Add recommendations based on keyword density
  if (Object.keys(keywords).length < 10) {
    recommendations.push("Include more industry-specific keywords related to your target role");
  }
  
  // Add general recommendations based on score
  if (score < 70) {
    recommendations.push("Use concrete numbers and metrics to quantify achievements");
    recommendations.push("Focus on results rather than responsibilities");
    recommendations.push("Tailor your CV for specific job descriptions");
  }
  
  // Limit to 5 recommendations maximum
  return recommendations.slice(0, 5);
}

/**
 * Identify strengths in the CV
 */
function identifyStrengths(sections: Record<string, string>, keywords: Record<string, number>): string[] {
  const strengths: string[] = [];
  
  // Check for comprehensive sections
  if (sections['experience'] && sections['experience'].length > 300) {
    strengths.push("Detailed work experience");
  }
  
  if (sections['education'] && sections['education'].length > 100) {
    strengths.push("Strong educational background");
  }
  
  if (sections['skills'] && sections['skills'].length > 150) {
    strengths.push("Comprehensive skills section");
  }
  
  // Check for action verbs and keywords
  const actionVerbs = ["developed", "led", "managed", "implemented", "created", "designed", "improved"];
  let actionVerbCount = 0;
  
  for (const verb of actionVerbs) {
    if (keywords[verb] && keywords[verb] > 0) {
      actionVerbCount++;
    }
  }
  
  if (actionVerbCount >= 3) {
    strengths.push("Good use of action verbs");
  }
  
  if (Object.keys(keywords).length > 15) {
    strengths.push("Rich in relevant keywords");
  }
  
  return strengths;
}

/**
 * Identify weaknesses in the CV
 */
function identifyWeaknesses(sections: Record<string, string>, keywords: Record<string, number>): string[] {
  const weaknesses: string[] = [];
  
  // Check for missing or weak sections
  if (!sections['summary'] || sections['summary'].length < 100) {
    weaknesses.push("Missing or weak professional summary");
  }
  
  if (!sections['skills'] || sections['skills'].length < 100) {
    weaknesses.push("Skills section could be more comprehensive");
  }
  
  // Check for keyword diversity
  if (Object.keys(keywords).length < 10) {
    weaknesses.push("Limited industry-specific keywords");
  }
  
  // Check for action verbs
  const actionVerbs = ["developed", "led", "managed", "implemented", "created", "designed", "improved"];
  let actionVerbCount = 0;
  
  for (const verb of actionVerbs) {
    if (keywords[verb] && keywords[verb] > 0) {
      actionVerbCount++;
    }
  }
  
  if (actionVerbCount < 3) {
    weaknesses.push("Limited use of action verbs");
  }
  
  return weaknesses;
}

/**
 * Get insights about ATS optimization for a specific industry
 */
export function getIndustrySpecificAtsInsights(industry: string): string {
  const insights: Record<string, string> = {
    "Software Development": 
      "For software development roles, highlight your programming languages, frameworks, and development methodologies. Include specific projects and technologies you've worked with, as ATS systems often scan for specific technical keywords like React, Python, Java, or AWS.",
    
    "Data Science": 
      "Data Science CVs should emphasize your technical stack (Python, R, SQL), machine learning algorithms you're familiar with, and data visualization tools. Include specific metrics about projects where you've applied these skills to solve business problems.",
    
    "IT Operations": 
      "IT Operations roles typically look for expertise in specific tools and systems. Highlight your experience with cloud platforms (AWS, Azure, GCP), container orchestration (Kubernetes, Docker), and automation tools. Include certifications prominently.",
    
    "Finance": 
      "Financial industry ATS systems typically scan for specific financial qualifications, regulatory knowledge, and software proficiency. Include relevant certifications (CPA, CFA, etc.) and experience with financial systems like SAP, Oracle, or specific accounting software.",
    
    "Healthcare": 
      "Healthcare CVs should include relevant certifications, knowledge of healthcare regulations (HIPAA, etc.), and experience with EHR/EMR systems. Use the specific terminology related to your healthcare specialty to pass ATS screenings.",
    
    "Marketing": 
      "Marketing CVs should highlight metrics and results from campaigns, expertise with specific marketing tools (Google Analytics, HubSpot, etc.), and knowledge of different marketing channels. Include specific metrics that demonstrate your impact.",
    
    "Education": 
      "Education industry CVs should emphasize teaching methodologies, curriculum development experience, and student outcomes. Include relevant certifications, specific subjects taught, and educational technologies you're familiar with.",
    
    "Engineering": 
      "Engineering CVs should highlight technical skills, software proficiency (CAD, etc.), project management methodologies, and certifications. Include specific types of projects you've worked on and any specialized engineering knowledge.",
    
    "Design": 
      "Design role ATS systems often scan for specific design tools (Adobe Suite, Sketch, Figma), methodologies (UX research, user testing), and types of projects. Include a link to your portfolio and highlight specific design challenges you've solved.",
    
    "Sales": 
      "Sales CVs should emphasize quantifiable achievements, target attainment, and CRM expertise. Include specific metrics like percentage of quota achieved, revenue generated, and client acquisition numbers to pass ATS screenings.",
    
    "General": 
      "To improve your ATS score, include relevant keywords from the job description, ensure proper formatting without special characters, and prioritize common section headers like 'Experience,' 'Skills,' and 'Education.' Quantify achievements where possible."
  };
  
  return insights[industry] || insights["General"];
} 