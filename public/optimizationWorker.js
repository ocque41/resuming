// Web Worker for CV optimization heavy computations

// Use the new CV analyzer for analysis
function analyzeCV(cvText) {
  // Simulate heavy computation
  console.log('Worker: Analyzing CV content...');
  
  // Parse the CV text
  const sections = extractSections(cvText);
  
  // Calculate ATS score - use dynamic calculation
  const atsScore = calculateATSScore(sections, cvText);
  
  // Find keywords
  const keywords = extractKeywords(sections, cvText);
  
  // Detect industry based on content
  const industry = detectIndustry(cvText);
  
  // Identify strengths and weaknesses
  const strengths = identifyStrengths(sections, keywords, cvText);
  const weaknesses = identifyWeaknesses(sections, keywords, cvText);
  
  // Return analysis results
  return {
    atsScore,
    keywords,
    sections,
    industry,
    strengths,
    weaknesses,
    recommendations: generateRecommendations(sections, keywords, atsScore),
    analysisComplete: true
  };
}

// Function to extract sections from CV text
function extractSections(text) {
  const sectionMatches = {};
  
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
  
  // Extract sections by looking for headings
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

// Extract keywords from CV content
function extractKeywords(sections, fullText) {
  const keywords = {};
  
  // Use full text if available, otherwise concatenate sections
  const textToAnalyze = fullText || Object.values(sections).join(" ");
  
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
  const lowerText = textToAnalyze.toLowerCase();
  
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

// Calculate ATS score based on content
function calculateATSScore(sections, fullText) {
  // Base score
  let score = 50;
  
  // Check content length
  const textLength = fullText ? fullText.length : Object.values(sections).join(" ").length;
  const lengthScore = Math.min(15, Math.floor(textLength / 500));
  score += lengthScore;
  
  // Score section completeness
  const sectionScore = calculateSectionScore(sections);
  score += sectionScore;
  
  // Score keywords
  const keywords = extractKeywords(sections, fullText);
  const keywordScore = calculateKeywordScore(keywords);
  score += keywordScore;
  
  // Cap at 98 to always leave room for improvement
  return Math.min(98, score);
}

// Calculate section completeness score
function calculateSectionScore(sections) {
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
      const sectionWeight = sectionScores[section];
      
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

// Calculate keyword score
function calculateKeywordScore(keywords) {
  let score = 0;
  const keywordCount = Object.keys(keywords).length;
  
  // Base score from number of unique keywords
  if (keywordCount >= 5) score += 2;
  if (keywordCount >= 10) score += 3;
  if (keywordCount >= 15) score += 5;
  if (keywordCount >= 20) score += 5;
  
  return score;
}

// Detect industry from CV content
function detectIndustry(text) {
  const lowerText = text.toLowerCase();
  
  // Industry indicators - simple keyword matching
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
  const industryCounts = {};
  
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
  
  for (const industry in industryCounts) {
    if (industryCounts[industry] > maxCount) {
      maxCount = industryCounts[industry];
      detectedIndustry = industry;
    }
  }
  
  // If very few keywords matched, return "General"
  if (maxCount < 3) {
    detectedIndustry = "General";
  }
  
  return detectedIndustry;
}

// Generate recommendations based on analysis
function generateRecommendations(sections, keywords, score) {
  const recommendations = [];
  
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

// Identify CV strengths
function identifyStrengths(sections, keywords, fullText) {
  const strengths = [];
  
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

// Identify CV weaknesses
function identifyWeaknesses(sections, keywords, fullText) {
  const weaknesses = [];
  
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

// Function that performs the CV optimization
function optimizeCV(data) {
  const { cvText, template } = data;
  console.log('Worker: Optimizing CV...');
  
  // First, analyze the CV
  const analysis = analyzeCV(cvText);
  
  // Optimize the CV sections
  const optimizedSections = {};
  for (const [section, content] of Object.entries(analysis.sections)) {
    // Apply template and optimize each section
    optimizedSections[section] = optimizeSection(section, content, template);
  }
  
  // Generate improved version
  const optimizedText = generateOptimizedCV(optimizedSections, template);
  
  // Simulate improved ATS score - increase by 15-25% but cap at 98%
  const originalScore = analysis.atsScore;
  const improvedScore = Math.min(98, Math.floor(originalScore * (1 + (Math.random() * 0.1 + 0.15))));
  
  return {
    originalText: cvText,
    optimizedText: optimizedText,
    originalScore: originalScore,
    improvedScore: improvedScore,
    analysis: analysis,
    template: template
  };
}

// Helper function to optimize individual sections
function optimizeSection(sectionName, content, template) {
  // Just return the original content - in a real implementation, this would apply
  // templates, formatting, and content improvements
  return content;
}

// Generate optimized CV text
function generateOptimizedCV(sections, template) {
  // In a real implementation, this would combine the sections in the right order
  // and apply template-specific formatting
  const sectionOrder = [
    'contact',
    'summary',
    'experience',
    'education',
    'skills',
    'projects',
    'certifications',
    'languages',
    'awards',
    'references'
  ];
  
  // Combine sections in order
  let result = '';
  for (const section of sectionOrder) {
    if (sections[section]) {
      // Add section heading
      result += `## ${section.toUpperCase()}\n\n`;
      result += sections[section] + '\n\n';
    }
  }
  
  return result;
}

// Listen for messages from the main thread
self.onmessage = function(e) {
  console.log('Worker: Message received from main script');
  
  const { action, data } = e.data;
  
  switch (action) {
    case 'analyze':
      const analysisResult = analyzeCV(data.cvText);
      self.postMessage({ action: 'analysisComplete', result: analysisResult });
      break;
      
    case 'optimize':
      const optimizationResult = optimizeCV(data);
      self.postMessage({ action: 'optimizationComplete', result: optimizationResult });
      break;
      
    default:
      self.postMessage({ action: 'error', error: 'Unknown action' });
  }
}; 