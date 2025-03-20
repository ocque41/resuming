import OpenAI from 'openai';
import { detectFileType, getAnalysisTypeForFile } from '@/lib/file-utils/file-type-detector';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Simple in-memory cache for analysis results
// Key is MD5 hash of document text, value is analysis result
type AnalysisCache = {
  [key: string]: {
    result: any;
    timestamp: number;
  }
};

// Cache expiration time: 24 hours in milliseconds
const CACHE_EXPIRY = 24 * 60 * 60 * 1000;

// In-memory cache object
const analysisCache: AnalysisCache = {};

/**
 * Generate a simple hash of the text for use as a cache key
 * This is a simple implementation - for production, use a proper MD5/SHA hash
 */
function generateCacheKey(text: string, fileName: string): string {
  // Use first 100 chars + file name + length as a simple cache key
  // For production, use a proper hashing function
  const prefix = text.substring(0, 100).replace(/\s+/g, '');
  const fileNameKey = fileName.replace(/\s+/g, '').toLowerCase();
  const lengthKey = text.length.toString();
  return `${prefix}_${fileNameKey}_${lengthKey}`;
}

/**
 * Store analysis result in cache
 */
function cacheAnalysisResult(text: string, fileName: string, result: any): void {
  const cacheKey = generateCacheKey(text, fileName);
  analysisCache[cacheKey] = {
    result,
    timestamp: Date.now()
  };
  console.log(`Cached analysis result for ${fileName} with key ${cacheKey}`);
}

/**
 * Get cached analysis result if available and not expired
 */
function getCachedAnalysis(text: string, fileName: string): any | null {
  const cacheKey = generateCacheKey(text, fileName);
  const cached = analysisCache[cacheKey];
  
  if (!cached) {
    console.log(`No cached analysis found for ${fileName}`);
    return null;
  }
  
  // Check if cache is expired
  if (Date.now() - cached.timestamp > CACHE_EXPIRY) {
    console.log(`Cached analysis for ${fileName} is expired, removing from cache`);
    delete analysisCache[cacheKey];
    return null;
  }
  
  console.log(`Using cached analysis for ${fileName}`);
  return cached.result;
}

/**
 * Main function to analyze a document using AI
 * @param documentText The raw text content of the document
 * @param fileName The name of the document file
 * @returns Structured analysis result
 */
export async function analyzeDocumentWithAI(documentText: string, fileName: string): Promise<any> {
  try {
    console.log(`Starting AI analysis for document: ${fileName}`);
    
    // Check if we have a cached result for this document
    const cachedResult = getCachedAnalysis(documentText, fileName);
    if (cachedResult) {
      console.log(`Using cached analysis for ${fileName}`);
      return cachedResult;
    }
    
    // Detect file type to determine appropriate analysis method
    const fileType = detectFileType(fileName);
    const analysisType = getAnalysisTypeForFile(fileType);
    
    console.log(`Detected file type: ${fileType?.name || 'Unknown'}, using analysis type: ${analysisType}`);
    
    // Choose appropriate analysis method based on file type
    let result;
    switch (analysisType) {
      case 'spreadsheet':
        result = await analyzeSpreadsheet(documentText, fileName);
        break;
      case 'presentation':
        result = await analyzePresentation(documentText, fileName);
        break;
      case 'cv':
        // New specialized CV analysis for resumes and CVs
        result = await analyzeCV(documentText, fileName);
        break;
      case 'document':
      default:
        result = await analyzeTextDocument(documentText, fileName);
        break;
    }
    
    console.log(`Completed AI analysis for document: ${fileName}`);
    
    // Cache the result for future use
    cacheAnalysisResult(documentText, fileName, result);
    
    return result;
  } catch (error) {
    console.error('Error in AI document analysis:', error);
    throw new Error(`Failed to analyze document with AI: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Analyzes a text document (PDF, DOC, etc.)
 * @param documentText The document text content
 * @param fileName The document file name
 * @returns Document analysis result
 */
async function analyzeTextDocument(documentText: string, fileName: string): Promise<any> {
  // Run different analysis tasks in parallel for efficiency
  const [
    contentAnalysis,
    sentimentAnalysis,
    keyInformation,
    summarization
  ] = await Promise.all([
    generateContentAnalysis(documentText),
    generateSentimentAnalysis(documentText),
    extractKeyInformation(documentText),
    generateSummary(documentText)
  ]);
  
  // Combine all analyses into a single structured result
  return {
    fileName,
    analysisTimestamp: new Date().toISOString(),
    analysisType: 'document',
    contentAnalysis,
    sentimentAnalysis,
    keyInformation,
    summary: summarization
  };
}

/**
 * Analyzes a spreadsheet file
 * @param documentText The text extracted from the spreadsheet
 * @param fileName The spreadsheet file name
 * @returns Spreadsheet-specific analysis result
 */
async function analyzeSpreadsheet(documentText: string, fileName: string): Promise<any> {
  // For spreadsheets, we focus on data patterns and structure analysis
  const [
    dataStructureAnalysis,
    dataInsights,
    dataQualityAssessment,
    summarization
  ] = await Promise.all([
    analyzeSpreadsheetStructure(documentText),
    extractSpreadsheetInsights(documentText),
    assessDataQuality(documentText),
    generateSpreadsheetSummary(documentText)
  ]);
  
  return {
    fileName,
    analysisTimestamp: new Date().toISOString(),
    analysisType: 'spreadsheet',
    dataStructureAnalysis,
    dataInsights,
    dataQualityAssessment,
    summary: summarization
  };
}

/**
 * Analyzes a presentation file
 * @param documentText The text extracted from the presentation
 * @param fileName The presentation file name
 * @returns Presentation-specific analysis result
 */
async function analyzePresentation(documentText: string, fileName: string): Promise<any> {
  // For presentations, we focus on slide structure, messaging, and visual balance
  const [
    presentationStructure,
    messageClarity,
    contentBalance,
    summarization
  ] = await Promise.all([
    analyzePresentationStructure(documentText),
    assessPresentationClarity(documentText),
    analyzeContentDistribution(documentText),
    generatePresentationSummary(documentText)
  ]);
  
  return {
    fileName,
    analysisTimestamp: new Date().toISOString(),
    analysisType: 'presentation',
    presentationStructure,
    messageClarity,
    contentBalance,
    summary: summarization
  };
}

/**
 * Analyzes the content structure and keywords of a document
 */
async function generateContentAnalysis(text: string): Promise<any> {
  const prompt = `
    Analyze this document text and provide:
    1. Content distribution - what percentage of the document is dedicated to different sections 
       (e.g., Professional Experience, Education, Skills, etc.)
    2. Top 10 most important keywords with their relative importance score (1-10)
    
    Respond with only valid JSON in this exact format:
    {
      "contentDistribution": [
        {"name": "Category name", "value": percentage_number}
      ],
      "topKeywords": [
        {"text": "keyword", "value": importance_score_number}
      ]
    }
    
    Document text:
    ${text.substring(0, 15000)} // Limit text length for token constraints
  `;
  
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.3,
    response_format: { type: "json_object" }
  });
  
  try {
    const content = response.choices[0]?.message?.content || "{}";
    return JSON.parse(content);
  } catch (error) {
    console.error('Error parsing content analysis:', error);
    return {
      contentDistribution: [
        { name: "Other", value: 100 }
      ],
      topKeywords: [
        { text: "Error", value: 1 }
      ]
    };
  }
}

/**
 * Analyzes the sentiment and tone of a document
 */
async function generateSentimentAnalysis(text: string): Promise<any> {
  const prompt = `
    Perform sentiment analysis on this document. 
    For a CV/resume, professional tone, confidence, clarity, and achievement-focused language are considered positive.
    Vague descriptions, passive voice, and lack of specific achievements are considered negative.
    
    Provide:
    1. An overall sentiment score from 0 to 1 (where 1 is extremely positive)
    2. Sentiment scores for each major section of the document
    
    Respond with only valid JSON in this exact format:
    {
      "overallScore": number,
      "sentimentBySection": [
        {"section": "section_name", "score": number}
      ]
    }
    
    Document text:
    ${text.substring(0, 15000)}
  `;
  
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.3,
    response_format: { type: "json_object" }
  });
  
  try {
    const content = response.choices[0]?.message?.content || "{}";
    return JSON.parse(content);
  } catch (error) {
    console.error('Error parsing sentiment analysis:', error);
    return {
      overallScore: 0.5,
      sentimentBySection: [
        { section: "Document", score: 0.5 }
      ]
    };
  }
}

/**
 * Extracts key information elements from a document
 */
async function extractKeyInformation(text: string): Promise<any> {
  const prompt = `
    Extract the following key information from this document (likely a CV/resume):
    1. Contact information (email, phone, location)
    2. Key dates (employment periods, education completion)
    3. Named entities (organizations, skills, locations, degrees)
    
    Respond with only valid JSON in this exact format:
    {
      "contactInfo": [
        {"type": "type_name", "value": "extracted_value"}
      ],
      "keyDates": [
        {"description": "description", "date": "date_value"}
      ],
      "entities": [
        {"type": "entity_type", "name": "entity_name", "occurrences": number}
      ]
    }
    
    Document text:
    ${text.substring(0, 15000)}
  `;
  
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.2,
    response_format: { type: "json_object" }
  });
  
  try {
    const content = response.choices[0]?.message?.content || "{}";
    return JSON.parse(content);
  } catch (error) {
    console.error('Error parsing key information extraction:', error);
    return {
      contactInfo: [],
      keyDates: [],
      entities: []
    };
  }
}

/**
 * Generates a summary of the document with highlights and suggestions
 */
async function generateSummary(text: string): Promise<any> {
  const prompt = `
    Provide a comprehensive summary of this document (likely a CV/resume):
    1. 4-5 key highlights - the strongest points of the document
    2. 4-5 improvement suggestions - specific ways the document could be improved
    3. An overall score from 0-100 based on clarity, completeness, impact, and relevance
    
    Respond with only valid JSON in this exact format:
    {
      "highlights": ["highlight1", "highlight2", ...],
      "suggestions": ["suggestion1", "suggestion2", ...],
      "overallScore": number
    }
    
    Document text:
    ${text.substring(0, 15000)}
  `;
  
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.4,
    response_format: { type: "json_object" }
  });
  
  try {
    const content = response.choices[0]?.message?.content || "{}";
    return JSON.parse(content);
  } catch (error) {
    console.error('Error parsing summary generation:', error);
    return {
      highlights: ["Error generating highlights"],
      suggestions: ["Error generating suggestions"],
      overallScore: 50
    };
  }
}

/**
 * Analyzes the structure of a spreadsheet
 */
async function analyzeSpreadsheetStructure(text: string): Promise<any> {
  const prompt = `
    Analyze this spreadsheet text content and determine its structure:
    1. Identify tables, columns, and potential headers
    2. Determine data types in different columns (numeric, date, text, categorical)
    3. Identify any patterns in the data organization
    
    Respond with only valid JSON in this exact format:
    {
      "tables": [
        {
          "name": "inferred_table_name",
          "columns": [
            {
              "name": "column_name",
              "dataType": "numeric|date|text|categorical",
              "completeness": percent_complete
            }
          ]
        }
      ],
      "structureScore": number_from_0_to_100
    }
    
    Spreadsheet content:
    ${text.substring(0, 15000)}
  `;
  
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.3,
    response_format: { type: "json_object" }
  });
  
  try {
    const content = response.choices[0]?.message?.content || "{}";
    return JSON.parse(content);
  } catch (error) {
    console.error('Error parsing spreadsheet structure analysis:', error);
    return {
      tables: [],
      structureScore: 50
    };
  }
}

/**
 * Extracts data insights from a spreadsheet
 */
async function extractSpreadsheetInsights(text: string): Promise<any> {
  const prompt = `
    Review this spreadsheet content and extract key insights:
    1. Identify trends, patterns, or relationships in the data
    2. Find potential outliers or anomalies
    3. Determine the main purpose or focus of the data
    
    Respond with only valid JSON in this exact format:
    {
      "keyMetrics": [
        {"name": "metric_name", "value": "metric_value", "insight": "insight_about_metric"}
      ],
      "trends": [
        {"description": "trend_description", "significance": "high|medium|low"}
      ],
      "anomalies": [
        {"description": "anomaly_description", "impact": "description_of_impact"}
      ]
    }
    
    Spreadsheet content:
    ${text.substring(0, 15000)}
  `;
  
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.4,
    response_format: { type: "json_object" }
  });
  
  try {
    const content = response.choices[0]?.message?.content || "{}";
    return JSON.parse(content);
  } catch (error) {
    console.error('Error parsing spreadsheet insights:', error);
    return {
      keyMetrics: [],
      trends: [],
      anomalies: []
    };
  }
}

/**
 * Assesses data quality in a spreadsheet
 */
async function assessDataQuality(text: string): Promise<any> {
  const prompt = `
    Assess the quality of data in this spreadsheet:
    1. Completeness - are there missing values?
    2. Consistency - are there inconsistencies in formatting or values?
    3. Accuracy - are there potential errors or suspicious values?
    
    Respond with only valid JSON in this exact format:
    {
      "completenessScore": number_from_0_to_100,
      "consistencyScore": number_from_0_to_100,
      "accuracyScore": number_from_0_to_100,
      "qualityIssues": [
        {"issue": "description_of_issue", "severity": "high|medium|low", "recommendation": "how_to_fix"}
      ],
      "overallDataQualityScore": number_from_0_to_100
    }
    
    Spreadsheet content:
    ${text.substring(0, 15000)}
  `;
  
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.3,
    response_format: { type: "json_object" }
  });
  
  try {
    const content = response.choices[0]?.message?.content || "{}";
    return JSON.parse(content);
  } catch (error) {
    console.error('Error parsing data quality assessment:', error);
    return {
      completenessScore: 50,
      consistencyScore: 50,
      accuracyScore: 50,
      qualityIssues: [],
      overallDataQualityScore: 50
    };
  }
}

/**
 * Generates a summary for a spreadsheet
 */
async function generateSpreadsheetSummary(text: string): Promise<any> {
  const prompt = `
    Provide a comprehensive summary of this spreadsheet:
    1. 3-5 key insights from the data
    2. 3-5 improvement suggestions for data organization or presentation
    3. An overall score from 0-100 based on data quality, organization, and usefulness
    
    Respond with only valid JSON in this exact format:
    {
      "insights": ["insight1", "insight2", ...],
      "suggestions": ["suggestion1", "suggestion2", ...],
      "overallScore": number_from_0_to_100
    }
    
    Spreadsheet content:
    ${text.substring(0, 15000)}
  `;
  
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.4,
    response_format: { type: "json_object" }
  });
  
  try {
    const content = response.choices[0]?.message?.content || "{}";
    return JSON.parse(content);
  } catch (error) {
    console.error('Error parsing spreadsheet summary:', error);
    return {
      insights: ["Error generating insights"],
      suggestions: ["Error generating suggestions"],
      overallScore: 50
    };
  }
}

/**
 * Analyzes the structure of a presentation
 */
async function analyzePresentationStructure(text: string): Promise<any> {
  const prompt = `
    Analyze this presentation text content and determine its structure:
    1. Identify slides and their logical flow
    2. Determine if there's a clear introduction, body, and conclusion
    3. Assess the narrative structure and storytelling elements
    
    Respond with only valid JSON in this exact format:
    {
      "slideCount": estimated_number_of_slides,
      "hasIntroduction": boolean,
      "hasConclusion": boolean,
      "narrativeFlow": "strong|moderate|weak",
      "slideStructure": [
        {"type": "title|content|conclusion|other", "purpose": "slide_purpose", "effectiveness": number_from_0_to_10}
      ],
      "structureScore": number_from_0_to_100
    }
    
    Presentation content:
    ${text.substring(0, 15000)}
  `;
  
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.3,
    response_format: { type: "json_object" }
  });
  
  try {
    const content = response.choices[0]?.message?.content || "{}";
    return JSON.parse(content);
  } catch (error) {
    console.error('Error parsing presentation structure analysis:', error);
    return {
      slideCount: 0,
      hasIntroduction: false,
      hasConclusion: false,
      narrativeFlow: "weak",
      slideStructure: [],
      structureScore: 50
    };
  }
}

/**
 * Assesses the clarity of messaging in a presentation
 */
async function assessPresentationClarity(text: string): Promise<any> {
  const prompt = `
    Assess the clarity of messaging in this presentation:
    1. Identify the main message or call to action
    2. Evaluate the clarity of supporting points
    3. Determine if the language is appropriate for the intended audience
    
    Respond with only valid JSON in this exact format:
    {
      "mainMessage": "identified_main_message",
      "messageClarity": number_from_0_to_100,
      "supportingPoints": [
        {"point": "identified_point", "clarity": number_from_0_to_10}
      ],
      "languageAppropriateness": number_from_0_to_100,
      "audienceAlignment": "strong|moderate|weak",
      "overallClarityScore": number_from_0_to_100
    }
    
    Presentation content:
    ${text.substring(0, 15000)}
  `;
  
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.3,
    response_format: { type: "json_object" }
  });
  
  try {
    const content = response.choices[0]?.message?.content || "{}";
    return JSON.parse(content);
  } catch (error) {
    console.error('Error parsing presentation clarity assessment:', error);
    return {
      mainMessage: "Unable to identify main message",
      messageClarity: 50,
      supportingPoints: [],
      languageAppropriateness: 50,
      audienceAlignment: "moderate",
      overallClarityScore: 50
    };
  }
}

/**
 * Analyzes the distribution of content in a presentation
 */
async function analyzeContentDistribution(text: string): Promise<any> {
  const prompt = `
    Analyze how content is distributed in this presentation:
    1. Determine the balance between text, data references, and visual elements
    2. Identify content-heavy vs. minimalist slides
    3. Assess whether the content distribution serves the presentation's purpose
    
    Respond with only valid JSON in this exact format:
    {
      "contentDistribution": [
        {"type": "text|data|visuals|mixed", "percentage": percentage_value}
      ],
      "contentDensity": "high|balanced|low",
      "slideComplexity": [
        {"complexity": "high|medium|low", "percentage": percentage_value}
      ],
      "distributionEffectiveness": number_from_0_to_100,
      "balanceScore": number_from_0_to_100
    }
    
    Presentation content:
    ${text.substring(0, 15000)}
  `;
  
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.3,
    response_format: { type: "json_object" }
  });
  
  try {
    const content = response.choices[0]?.message?.content || "{}";
    return JSON.parse(content);
  } catch (error) {
    console.error('Error parsing content distribution analysis:', error);
    return {
      contentDistribution: [
        { type: "text", percentage: 100 }
      ],
      contentDensity: "medium",
      slideComplexity: [
        { complexity: "medium", percentage: 100 }
      ],
      distributionEffectiveness: 50,
      balanceScore: 50
    };
  }
}

/**
 * Generates a summary for a presentation
 */
async function generatePresentationSummary(text: string): Promise<any> {
  const prompt = `
    Provide a comprehensive summary of this presentation:
    1. 3-5 key strengths of the presentation
    2. 3-5 improvement suggestions
    3. An overall score from 0-100 based on structure, clarity, and content balance
    
    Respond with only valid JSON in this exact format:
    {
      "strengths": ["strength1", "strength2", ...],
      "improvementAreas": ["improvement1", "improvement2", ...],
      "audienceImpact": "high|medium|low",
      "persuasiveness": number_from_0_to_100,
      "overallScore": number_from_0_to_100
    }
    
    Presentation content:
    ${text.substring(0, 15000)}
  `;
  
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.4,
    response_format: { type: "json_object" }
  });
  
  try {
    const content = response.choices[0]?.message?.content || "{}";
    return JSON.parse(content);
  } catch (error) {
    console.error('Error parsing presentation summary:', error);
    return {
      strengths: ["Error generating strengths"],
      improvementAreas: ["Error generating improvement areas"],
      audienceImpact: "medium",
      persuasiveness: 50,
      overallScore: 50
    };
  }
}

/**
 * Specialized analysis for CV/resume documents
 * @param documentText The CV/resume text content
 * @param fileName The document file name
 * @returns CV-specific analysis result
 */
async function analyzeCV(documentText: string, fileName: string): Promise<any> {
  // Run specialized CV analysis tasks in parallel for efficiency
  const [
    contentAnalysis,
    sentimentAnalysis,
    keyInformation,
    cvSpecificAnalysis,
    summarization
  ] = await Promise.all([
    generateContentAnalysis(documentText),
    generateSentimentAnalysis(documentText),
    extractKeyInformation(documentText),
    analyzeCVSpecifics(documentText),
    generateCVSummary(documentText)
  ]);
  
  // Combine all analyses into a single structured result with CV-specific data
  return {
    fileName,
    analysisTimestamp: new Date().toISOString(),
    analysisType: 'cv',
    contentAnalysis,
    sentimentAnalysis,
    keyInformation,
    cvAnalysis: cvSpecificAnalysis,
    summary: summarization
  };
}

/**
 * Analyzes CV-specific elements like skills, experience, and ATS compatibility
 */
async function analyzeCVSpecifics(text: string): Promise<any> {
  const prompt = `
    Perform a detailed analysis of this CV/resume with focus on:
    1. Skills assessment - identify technical, soft, and domain-specific skills with proficiency estimates
    2. Experience evaluation - analyze experience depth, relevance, and progression
    3. Education assessment - evaluate educational qualifications and relevance
    4. ATS compatibility - analyze how well the CV would perform with Applicant Tracking Systems
    5. Strengths and weaknesses - identify 3-5 key strengths and areas for improvement
    
    Respond with only valid JSON in this exact format:
    {
      "skills": {
        "technical": [{"name": "skill_name", "proficiency": "level", "relevance": number}],
        "soft": [{"name": "skill_name", "evidence": "brief_evidence", "strength": number}],
        "domain": [{"name": "domain_skill", "relevance": number}]
      },
      "experience": {
        "yearsOfExperience": number,
        "experienceProgression": "description",
        "keyRoles": ["role1", "role2"],
        "achievementsHighlighted": boolean,
        "clarity": number
      },
      "education": {
        "highestDegree": "degree_name",
        "relevance": number,
        "continuingEducation": boolean
      },
      "atsCompatibility": {
        "score": number,
        "keywordOptimization": number,
        "formatCompatibility": number,
        "improvementAreas": ["area1", "area2"]
      },
      "strengths": ["strength1", "strength2", "strength3"],
      "weaknesses": ["weakness1", "weakness2", "weakness3"]
    }
    
    Document text:
    ${text.substring(0, 15000)}
  `;
  
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.3,
    response_format: { type: "json_object" }
  });
  
  try {
    const content = response.choices[0]?.message?.content || "{}";
    return JSON.parse(content);
  } catch (error) {
    console.error('Error parsing CV specifics analysis:', error);
    return {
      skills: {
        technical: [{ name: "Error retrieving skills", proficiency: "unknown", relevance: 0 }],
        soft: [],
        domain: []
      },
      experience: {
        yearsOfExperience: 0,
        experienceProgression: "Unable to determine",
        keyRoles: [],
        achievementsHighlighted: false,
        clarity: 0
      },
      education: {
        highestDegree: "Unknown",
        relevance: 0,
        continuingEducation: false
      },
      atsCompatibility: {
        score: 50,
        keywordOptimization: 50,
        formatCompatibility: 50,
        improvementAreas: ["Unable to analyze ATS compatibility"]
      },
      strengths: ["Unable to determine strengths"],
      weaknesses: ["Unable to determine areas for improvement"]
    };
  }
}

/**
 * Generates CV-specific summary including ATS score and improvement recommendations
 */
async function generateCVSummary(text: string): Promise<any> {
  const prompt = `
    Generate a comprehensive summary of this CV/resume with:
    1. Overall assessment score (0-100)
    2. Key highlights - strongest elements of the CV
    3. Impact score - how effectively the CV communicates impact/achievements (0-100)
    4. ATS compatibility score - how well the CV would perform with ATS systems (0-100)
    5. Improvement suggestions - specific, actionable recommendations to enhance the CV
    6. Market fit - assessment of how well the CV positions the candidate in the market
    
    Respond with only valid JSON in this exact format:
    {
      "overallScore": number,
      "highlights": ["highlight1", "highlight2", "highlight3"],
      "impactScore": number,
      "atsScore": number,
      "suggestions": ["suggestion1", "suggestion2", "suggestion3", "suggestion4", "suggestion5"],
      "marketFit": {
        "industryAlignment": "description",
        "competitiveEdge": "description",
        "targetRoleRecommendations": ["role1", "role2", "role3"]
      }
    }
    
    Document text:
    ${text.substring(0, 15000)}
  `;
  
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.3,
    response_format: { type: "json_object" }
  });
  
  try {
    const content = response.choices[0]?.message?.content || "{}";
    return JSON.parse(content);
  } catch (error) {
    console.error('Error parsing CV summary:', error);
    return {
      overallScore: 50,
      highlights: ["Unable to determine highlights"],
      impactScore: 50,
      atsScore: 50,
      suggestions: ["Unable to generate improvement suggestions"],
      marketFit: {
        industryAlignment: "Unable to determine",
        competitiveEdge: "Unable to determine",
        targetRoleRecommendations: ["Unable to generate role recommendations"]
      }
    };
  }
} 