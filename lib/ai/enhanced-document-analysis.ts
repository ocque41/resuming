/**
 * Enhanced Document Analysis Service
 * 
 * This service provides advanced document analysis using AI models to extract insights,
 * analyze content, and provide recommendations for various document types.
 */

import OpenAI from 'openai';
import { z } from 'zod';
import { 
  detectFileType, 
  getAnalysisTypeForFile, 
  FileTypeInfo 
} from '@/lib/file-utils/file-type-detector';
import { DocumentInsights, AnalysisResult, DocumentTopic } from '@/components/advanced-document-analyzer/types';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Cache for analysis results
type AnalysisCache = Map<string, {
  result: AnalysisResult;
  timestamp: number;
}>;

// Cache expiration: 24 hours
const CACHE_EXPIRY = 24 * 60 * 60 * 1000;
const analysisCache: AnalysisCache = new Map();

/**
 * Creates a cache key for storing analysis results
 */
function createCacheKey(documentId: string, fileContent: string, purpose: string = 'general'): string {
  // For a real implementation, use a proper hash function
  const contentPreview = fileContent.substring(0, 100).replace(/\s+/g, '');
  const contentLength = fileContent.length.toString();
  return `${documentId}_${purpose}_${contentPreview}_${contentLength}`;
}

/**
 * Specialized document type detection that goes beyond file extension
 * to analyze content patterns for more accurate type classification
 */
async function detectDocumentTypeFromContent(
  fileContent: string, 
  fileName: string
): Promise<string> {
  // First check file extension
  const fileType = detectFileType(fileName);
  
  // If clearly a CV, spreadsheet, or presentation by extension, return that
  if (fileType?.category === 'cv' || 
      fileType?.category === 'spreadsheet' || 
      fileType?.category === 'presentation') {
    return fileType.category;
  }

  // For documents that might need content-based classification
  try {
    const prompt = `
      Analyze this document content and determine what type of document it is.
      Respond with ONLY ONE of these categories: "cv", "report", "article", "letter", "legal", "academic", "presentation", "general".
      
      Document content begins:
      ${fileContent.substring(0, 2000)}
    `;

    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.1,
      max_tokens: 20
    });

    const documentType = response.choices[0].message.content?.trim().toLowerCase() || 'general';
    
    // Map the detected type to our system categories
    if (documentType === 'cv' || documentType === 'resume') {
      return 'cv';
    } else if (documentType === 'presentation') {
      return 'presentation';
    } else if (documentType === 'spreadsheet' || documentType === 'table') {
      return 'spreadsheet'; 
    } else {
      return 'document';
    }
  } catch (error) {
    console.error('Error detecting document type from content:', error);
    // Fall back to file extension based detection
    return fileType?.category || 'document';
  }
}

/**
 * Schema for validating the AI analysis output
 */
const analysisSchema = z.object({
  summary: z.string(),
  keyPoints: z.array(z.string()),
  recommendations: z.array(z.string()),
  insights: z.object({
    clarity: z.number().min(0).max(100),
    relevance: z.number().min(0).max(100),
    completeness: z.number().min(0).max(100),
    conciseness: z.number().min(0).max(100),
    structure: z.number().min(0).max(100),
    engagement: z.number().min(0).max(100),
    contentquality: z.number().min(0).max(100),
    overallScore: z.number().min(0).max(100),
  }),
  topics: z.array(z.object({
    name: z.string(),
    relevance: z.number().min(0).max(1)
  })),
  sentiment: z.object({
    overall: z.string(),
    score: z.number().min(0).max(1)
  }),
  languageQuality: z.object({
    grammar: z.number().min(0).max(100),
    spelling: z.number().min(0).max(100),
    readability: z.number().min(0).max(100),
    clarity: z.number().min(0).max(100),
    overall: z.number().min(0).max(100)
  }),
}).partial();

/**
 * Main function to analyze a document
 */
export async function analyzeDocument(
  documentId: string,
  documentText: string,
  fileName: string,
  documentPurpose?: string
): Promise<AnalysisResult> {
  try {
    console.log(`Starting enhanced analysis for document: ${fileName} (ID: ${documentId}), purpose: ${documentPurpose || 'auto-detect'}`);
    
    // Check cache first - use document purpose in the cache key
    const cacheKey = createCacheKey(documentId, documentText, documentPurpose);
    const cached = analysisCache.get(cacheKey);
    
    if (cached && (Date.now() - cached.timestamp < CACHE_EXPIRY)) {
      console.log(`Using cached analysis result for ${fileName}`);
      return cached.result;
    }
    
    // If a purpose is provided, use that; otherwise detect from content
    let documentType: string;
    
    if (documentPurpose) {
      // Use the provided document purpose directly
      documentType = documentPurpose;
      console.log(`Using provided document purpose: ${documentType}`);
    } else {
      // Fall back to content-based detection
      documentType = await detectDocumentTypeFromContent(documentText, fileName);
      console.log(`Detected document type from content: ${documentType}`);
    }
    
    // Analyze based on document type/purpose
    let result: AnalysisResult;
    
    switch (documentType) {
      case 'cv':
        result = await analyzeCVDocument(documentId, documentText, fileName);
        break;
      case 'spreadsheet':
        result = await analyzeSpreadsheetDocument(documentId, documentText, fileName);
        break;
      case 'presentation':
        result = await analyzePresentationDocument(documentId, documentText, fileName);
        break;
      case 'scientific':
        result = await analyzeScientificDocument(documentId, documentText, fileName);
        break;
      default:
        result = await analyzeGeneralDocument(documentId, documentText, fileName);
        break;
    }
    
    // Ensure the analysis type matches the document purpose
    result.analysisType = documentType;
    
    // Cache the result
    analysisCache.set(cacheKey, {
      result,
      timestamp: Date.now()
    });
    
    console.log(`Analysis completed for document: ${fileName}, type: ${documentType}`);
    return result;
  } catch (error) {
    console.error(`Error analyzing document ${fileName}:`, error);
    throw new Error(`Failed to analyze document: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Analyze a general text document (reports, articles, letters)
 */
async function analyzeGeneralDocument(
  documentId: string, 
  documentText: string, 
  fileName: string
): Promise<AnalysisResult> {
  const prompt = `
    Analyze this document in detail and provide a comprehensive assessment.
    
    Document: ${fileName}
    
    Content:
    ${documentText.substring(0, 15000)} // Limit to avoid token limits
    
    Please provide a complete, detailed analysis with the following elements in a JSON structure:
    
    1. summary: A 3-5 sentence summary of what this document is about and its purpose
    2. keyPoints: 4-6 key points from the document content
    3. recommendations: 3-5 recommendations for improving the document
    4. insights: Numerical scores (0-100) for the following aspects:
       - clarity: How clear and understandable the document is
       - relevance: How relevant the content is to the document's apparent purpose
       - completeness: How complete and comprehensive the document is
       - conciseness: How concise and to-the-point the document is
       - structure: How well-structured the document is
       - engagement: How engaging the document is to read
       - contentquality: Overall quality of the content
       - overallScore: Overall document quality score
    5. topics: Array of topics in the document with relevance scores (0-1), e.g. [{name: "Topic", relevance: 0.85}]
    6. sentiment: Overall document sentiment as {overall: "positive/negative/neutral", score: decimal 0-1}
    7. languageQuality: Scores for {grammar, spelling, readability, clarity, overall} (0-100)
    
    Respond with ONLY the JSON structure.
  `;

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.2,
    response_format: { type: "json_object" }
  });

  try {
    const content = response.choices[0].message.content;
    const analysisData = content ? JSON.parse(content) : {};
    
    // Validate and normalize the result
    const result: AnalysisResult = {
      documentId,
      fileName,
      analysisType: 'general',
      summary: analysisData.summary || 'No summary available',
      keyPoints: Array.isArray(analysisData.keyPoints) ? analysisData.keyPoints : [],
      recommendations: Array.isArray(analysisData.recommendations) ? analysisData.recommendations : [],
      insights: analysisData.insights || {
        clarity: 50,
        relevance: 50,
        completeness: 50,
        conciseness: 50,
        structure: 50,
        engagement: 50,
        contentquality: 50,
        overallScore: 50
      },
      topics: Array.isArray(analysisData.topics) ? analysisData.topics : [],
      sentiment: analysisData.sentiment || { overall: 'neutral', score: 0.5 },
      languageQuality: analysisData.languageQuality || {
        grammar: 70,
        spelling: 70,
        readability: 70,
        clarity: 70,
        overall: 70
      },
      timestamp: new Date().toISOString(),
      createdAt: new Date().toISOString()
    };
    
    return result;
  } catch (error) {
    console.error('Error parsing AI response:', error);
    throw new Error('Failed to parse AI analysis response');
  }
}

/**
 * Analyze a CV/resume document with specialized metrics
 */
async function analyzeCVDocument(
  documentId: string, 
  documentText: string, 
  fileName: string
): Promise<AnalysisResult> {
  const prompt = `
    Analyze this CV/resume document in detail and provide a comprehensive assessment.
    
    Document: ${fileName}
    
    Content:
    ${documentText.substring(0, 15000)}
    
    Provide a detailed analysis with the following elements in JSON:
    
    1. summary: A 3-5 sentence summary of the candidate's background and qualifications
    2. keyPoints: 5-7 key strengths and qualifications from the CV
    3. recommendations: 4-6 specific suggestions to improve the CV
    4. insights: Numerical scores (0-100) for:
       - clarity: How clear and readable the CV is
       - relevance: How well tailored the content is for job applications
       - completeness: How comprehensive the information is
       - conciseness: How concise and focused the CV is
       - structure: How well-structured and organized the CV is
       - engagement: How engaging and interesting the CV is to read
       - contentquality: Overall quality of the content
       - overallScore: Overall CV quality score
    5. topics: Array of professional areas/skills with relevance scores (0-1)
    6. sentiment: Assessment of CV tone as {overall: "professional/casual/technical", score: decimal 0-1}
    7. languageQuality: Scores for {grammar, spelling, readability, clarity, overall} (0-100)
    8. cvAnalysis: {
       - skills: {
         technical: Array of {name: string, proficiency: string, relevance: number},
         soft: Array of {name: string, evidence: string, strength: number},
         domain: Array of {name: string, relevance: number}
       },
       - experience: {
         yearsOfExperience: number,
         experienceProgression: string,
         keyRoles: string[],
         achievementsHighlighted: boolean,
         clarity: number
       },
       - education: {
         highestDegree: string,
         relevance: number,
         continuingEducation: boolean
       },
       - atsCompatibility: {
         score: number,
         keywordOptimization: number,
         formatCompatibility: number,
         improvementAreas: string[]
       },
       - strengths: string[],
       - weaknesses: string[]
    }
    
    Respond with ONLY the JSON structure.
  `;

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.2,
    response_format: { type: "json_object" }
  });

  try {
    const content = response.choices[0].message.content;
    const analysisData = content ? JSON.parse(content) : {};
    
    // Create a properly structured result
    const result: AnalysisResult = {
      documentId,
      fileName,
      analysisType: 'cv',
      summary: analysisData.summary || 'No summary available',
      keyPoints: Array.isArray(analysisData.keyPoints) ? analysisData.keyPoints : [],
      recommendations: Array.isArray(analysisData.recommendations) ? analysisData.recommendations : [],
      insights: analysisData.insights || {
        clarity: 50,
        relevance: 50,
        completeness: 50,
        conciseness: 50,
        structure: 50,
        engagement: 50,
        contentquality: 50,
        overallScore: 50
      },
      topics: Array.isArray(analysisData.topics) ? analysisData.topics : [],
      sentiment: analysisData.sentiment || { overall: 'neutral', score: 0.5 },
      languageQuality: analysisData.languageQuality || {
        grammar: 70,
        spelling: 70,
        readability: 70,
        clarity: 70,
        overall: 70
      },
      cvAnalysis: analysisData.cvAnalysis,
      timestamp: new Date().toISOString(),
      createdAt: new Date().toISOString()
    };
    
    return result;
  } catch (error) {
    console.error('Error parsing CV analysis response:', error);
    throw new Error('Failed to parse CV analysis response');
  }
}

/**
 * Analyze a spreadsheet-like document (table data within PDFs)
 */
async function analyzeSpreadsheetDocument(
  documentId: string, 
  documentText: string, 
  fileName: string
): Promise<AnalysisResult> {
  const prompt = `
    You are a data analysis expert. This PDF document contains tabular or spreadsheet-like data.
    Your task is to extract and analyze this data as if it was originally a spreadsheet.
    
    Document: ${fileName}
    
    Content:
    ${documentText.substring(0, 15000)}
    
    Please provide a detailed analysis with these elements in a JSON structure:
    
    1. summary: A 3-5 sentence summary of what this data represents
    2. keyPoints: 4-6 key insights discovered from analyzing the data
    3. recommendations: 3-5 recommendations based on the data analysis
    4. dataStructureAnalysis: Information about the table structure including:
       - tableCount: How many tables were detected
       - columnCount: Estimated number of columns across all tables
       - rowCount: Estimated number of rows across all tables
       - dataTypes: Array of detected data types (text, numeric, date, etc.)
       - completeness: Score 0-100 rating how complete the data appears
    5. dataInsights: {
       - trends: Array of identified trends in the data
       - patterns: Array of notable patterns
       - outliers: Any data points that seem unusual or outliers
       - correlations: Any detected correlations between different data elements
    }
    6. dataQualityAssessment: {
       - completenessScore: 0-100
       - consistencyScore: 0-100
       - accuracyScore: 0-100 based on estimation
       - qualityIssues: Array of identified issues
       - overallDataQualityScore: 0-100
    }
    7. topics: Array of topics/categories present in the data with relevance scores (0-1)
    8. visualizationSuggestions: 3-5 recommendations for how to visualize this data
    
    Respond with ONLY the JSON structure. Be as detailed and thorough as possible in your analysis.
  `;

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.2,
    response_format: { type: "json_object" }
  });

  try {
    const content = response.choices[0].message.content;
    const analysisData = content ? JSON.parse(content) : {};
    
    // Construct the spreadsheet analysis result
    const result: AnalysisResult = {
      documentId,
      fileName,
      analysisType: 'spreadsheet',
      summary: analysisData.summary || 'No summary available',
      keyPoints: Array.isArray(analysisData.keyPoints) ? analysisData.keyPoints : [],
      recommendations: Array.isArray(analysisData.recommendations) ? analysisData.recommendations : [],
      insights: {
        clarity: 70,
        relevance: 75,
        completeness: analysisData.dataQualityAssessment?.completenessScore || 50,
        conciseness: 65,
        structure: 70,
        engagement: 60,
        contentquality: analysisData.dataQualityAssessment?.overallDataQualityScore || 50,
        overallScore: analysisData.dataQualityAssessment?.overallDataQualityScore || 50
      },
      dataStructureAnalysis: analysisData.dataStructureAnalysis || {
        tableCount: 0,
        columnCount: 0,
        rowCount: 0,
        dataTypes: [],
        completeness: 50
      },
      dataInsights: analysisData.dataInsights || {
        trends: [],
        patterns: [],
        outliers: [],
        correlations: []
      },
      dataQualityAssessment: analysisData.dataQualityAssessment || {
        completenessScore: 50,
        consistencyScore: 50,
        accuracyScore: 50,
        qualityIssues: [],
        overallDataQualityScore: 50
      },
      topics: Array.isArray(analysisData.topics) ? analysisData.topics : [],
      visualizationSuggestions: Array.isArray(analysisData.visualizationSuggestions) ? 
        analysisData.visualizationSuggestions : [],
      createdAt: new Date().toISOString()
    };
    
    return result;
  } catch (error) {
    console.error("Error parsing spreadsheet analysis response:", error);
    throw new Error("Failed to analyze spreadsheet data");
  }
}

/**
 * Analyze a presentation document (slide deck in PDF format)
 */
async function analyzePresentationDocument(
  documentId: string, 
  documentText: string, 
  fileName: string
): Promise<AnalysisResult> {
  const prompt = `
    You are a presentation and communication expert. This PDF document contains a presentation or slide deck.
    Your task is to analyze this content as if it was originally a presentation.
    
    Document: ${fileName}
    
    Content:
    ${documentText.substring(0, 15000)}
    
    Please provide a detailed analysis with these elements in a JSON structure:
    
    1. summary: A 3-5 sentence summary of what this presentation is about
    2. keyPoints: 4-6 key points or messages from the presentation
    3. recommendations: 3-5 recommendations for improving the presentation
    4. presentationStructure: {
       - estimatedSlideCount: Your best estimate of how many slides
       - hasIntroduction: Boolean - does it have a proper introduction?
       - hasConclusion: Boolean - does it have a proper conclusion?
       - narrativeFlow: Score 0-100 for how well the presentation flows
       - slideStructureQuality: Score 0-100 for structure quality
    }
    5. messageClarity: {
       - mainMessage: What appears to be the main message/purpose
       - clarity: Score 0-100 for how clear the main message is
       - supportingPoints: Array of supporting points and their clarity scores
       - audienceAlignment: Assessment of how well it targets its audience
    }
    6. contentBalance: {
       - textDensity: Score 0-100 (100 = too much text)
       - visualElements: Estimated amount of visual elements (0-100)
       - contentDistribution: Assessment of how well content is distributed
    }
    7. designAssessment: {
       - consistencyScore: 0-100 for design consistency
       - readabilityScore: 0-100 for text readability
       - visualHierarchyScore: 0-100 for visual hierarchy effectiveness
    }
    8. topics: Array of topics in the presentation with relevance scores (0-1)
    9. improvementSuggestions: Specific suggestions for improvement by category
    
    Respond with ONLY the JSON structure. Be as detailed and thorough as possible in your analysis.
  `;

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.2,
    response_format: { type: "json_object" }
  });

  try {
    const content = response.choices[0].message.content;
    const analysisData = content ? JSON.parse(content) : {};
    
    // Construct the presentation analysis result
    const result: AnalysisResult = {
      documentId,
      fileName,
      analysisType: 'presentation',
      summary: analysisData.summary || 'No summary available',
      keyPoints: Array.isArray(analysisData.keyPoints) ? analysisData.keyPoints : [],
      recommendations: Array.isArray(analysisData.recommendations) ? analysisData.recommendations : [],
      insights: {
        clarity: analysisData.messageClarity?.clarity || 65,
        relevance: 70,
        completeness: 65,
        conciseness: 70,
        structure: analysisData.presentationStructure?.slideStructureQuality || 60,
        engagement: 75,
        contentquality: 70,
        overallScore: (
          (analysisData.messageClarity?.clarity || 65) + 
          70 + 65 + 70 + 
          (analysisData.presentationStructure?.slideStructureQuality || 60) + 
          75 + 70
        ) / 7
      },
      presentationStructure: analysisData.presentationStructure || {
        estimatedSlideCount: 0,
        hasIntroduction: false,
        hasConclusion: false,
        narrativeFlow: 50,
        slideStructureQuality: 50
      },
      messageClarity: analysisData.messageClarity || {
        mainMessage: "Unclear from analysis",
        clarity: 50,
        supportingPoints: [],
        audienceAlignment: "Uncertain"
      },
      contentBalance: analysisData.contentBalance || {
        textDensity: 50,
        visualElements: 50,
        contentDistribution: "Mixed"
      },
      designAssessment: analysisData.designAssessment || {
        consistencyScore: 50,
        readabilityScore: 50,
        visualHierarchyScore: 50
      },
      topics: Array.isArray(analysisData.topics) ? analysisData.topics : [],
      improvementSuggestions: analysisData.improvementSuggestions || {},
      createdAt: new Date().toISOString()
    };
    
    return result;
  } catch (error) {
    console.error("Error parsing presentation analysis response:", error);
    throw new Error("Failed to analyze presentation data");
  }
}

/**
 * Analyze a scientific paper or research article
 */
async function analyzeScientificDocument(
  documentId: string, 
  documentText: string, 
  fileName: string
): Promise<AnalysisResult> {
  const prompt = `
    You are a scientific research expert. This PDF document contains a scientific paper or research article.
    Your task is to analyze this content thoroughly as a scientific publication.
    
    Document: ${fileName}
    
    Content:
    ${documentText.substring(0, 15000)}
    
    Please provide a detailed analysis with these elements in a JSON structure:
    
    1. summary: A 3-5 sentence summary of the research paper, covering objective, methodology, key findings, and significance
    2. keyPoints: 4-6 key findings or contributions from the research
    3. recommendations: 3-5 recommendations for improving or extending the research
    4. researchStructure: {
       - hasAbstract: Boolean - does it have a proper abstract?
       - hasIntroduction: Boolean - does it have a proper introduction?
       - hasMethodology: Boolean - does it have a clear methodology section?
       - hasResults: Boolean - does it have a results section?
       - hasDiscussion: Boolean - does it have a discussion section?
       - hasConclusion: Boolean - does it have a conclusion section?
       - hasReferences: Boolean - does it have a references section?
       - structureCompleteness: Score 0-100 for how complete the structure is
       - structureQuality: Score 0-100 for structure quality
    }
    5. researchQuality: {
       - methodologyRigor: Score 0-100 for how rigorous the methodology is
       - dataQuality: Score 0-100 for the quality of data presented
       - analysisDepth: Score 0-100 for depth of analysis
       - conclusionValidity: Score 0-100 for how well-supported the conclusions are
       - literatureReviewQuality: Score 0-100 for quality of literature review
       - originalityScore: Score 0-100 for how original the research is
       - impactPotential: Score 0-100 for potential impact in the field
       - overallQuality: Score 0-100 for overall research quality
    }
    6. citationAnalysis: {
       - estimatedCitationCount: Your best estimate of references/citations
       - recentReferences: Percentage of references from last 5 years (estimate)
       - selfCitations: Boolean - does it include self-citations?
       - keyReferences: Array of what appear to be key references
       - citationQuality: Score 0-100 for citation quality and relevance
    }
    7. contentAssessment: {
       - clarity: Score 0-100 for how clear the explanations are
       - technicalDepth: Score 0-100 for technical detail level
       - audienceLevel: Assessment of intended audience (e.g., "Expert", "Academic", "General academic")
       - jargonLevel: Assessment of specialized terminology use
       - graphicsQuality: Score 0-100 for quality of figures/tables
    }
    8. topics: Array of research topics/fields with relevance scores (0-1)
    9. researchGaps: Array of research gaps or limitations identified
    10. futureWorkSuggestions: Array of suggested future research directions
    
    Respond with ONLY the JSON structure. Be as detailed and thorough as possible in your analysis.
  `;

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.2,
    response_format: { type: "json_object" }
  });

  try {
    const content = response.choices[0].message.content;
    const analysisData = content ? JSON.parse(content) : {};
    
    // Construct the scientific paper analysis result
    const result: AnalysisResult = {
      documentId,
      fileName,
      analysisType: 'scientific',
      summary: analysisData.summary || 'No summary available',
      keyPoints: Array.isArray(analysisData.keyPoints) ? analysisData.keyPoints : [],
      recommendations: Array.isArray(analysisData.recommendations) ? analysisData.recommendations : [],
      insights: {
        clarity: analysisData.contentAssessment?.clarity || 70,
        relevance: analysisData.researchQuality?.impactPotential || 75,
        completeness: analysisData.researchStructure?.structureCompleteness || 65,
        conciseness: 70,
        structure: analysisData.researchStructure?.structureQuality || 65,
        engagement: 60,
        contentquality: analysisData.researchQuality?.overallQuality || 70,
        overallScore: analysisData.researchQuality?.overallQuality || 70
      },
      researchStructure: analysisData.researchStructure || {
        hasAbstract: true,
        hasIntroduction: true,
        hasMethodology: true,
        hasResults: true,
        hasDiscussion: true,
        hasConclusion: true,
        hasReferences: true,
        structureCompleteness: 70,
        structureQuality: 70
      },
      researchQuality: analysisData.researchQuality || {
        methodologyRigor: 65,
        dataQuality: 70,
        analysisDepth: 65,
        conclusionValidity: 70,
        literatureReviewQuality: 65,
        originalityScore: 60,
        impactPotential: 65,
        overallQuality: 65
      },
      citationAnalysis: analysisData.citationAnalysis || {
        estimatedCitationCount: 0,
        recentReferences: 0,
        selfCitations: false,
        keyReferences: [],
        citationQuality: 50
      },
      contentAssessment: analysisData.contentAssessment || {
        clarity: 70,
        technicalDepth: 65,
        audienceLevel: "Academic",
        jargonLevel: "Moderate",
        graphicsQuality: 60
      },
      topics: Array.isArray(analysisData.topics) ? analysisData.topics : [],
      researchGaps: Array.isArray(analysisData.researchGaps) ? analysisData.researchGaps : [],
      futureWorkSuggestions: Array.isArray(analysisData.futureWorkSuggestions) ? analysisData.futureWorkSuggestions : [],
      createdAt: new Date().toISOString()
    };
    
    return result;
  } catch (error) {
    console.error("Error parsing scientific paper analysis response:", error);
    throw new Error("Failed to analyze scientific paper");
  }
} 