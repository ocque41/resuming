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
function createCacheKey(documentId: string, fileContent: string): string {
  // For a real implementation, use a proper hash function
  const contentPreview = fileContent.substring(0, 100).replace(/\s+/g, '');
  const contentLength = fileContent.length.toString();
  return `${documentId}_${contentPreview}_${contentLength}`;
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
  fileName: string
): Promise<AnalysisResult> {
  try {
    console.log(`Starting enhanced analysis for document: ${fileName} (ID: ${documentId})`);
    
    // Check cache first
    const cacheKey = createCacheKey(documentId, documentText);
    const cached = analysisCache.get(cacheKey);
    
    if (cached && (Date.now() - cached.timestamp < CACHE_EXPIRY)) {
      console.log(`Using cached analysis result for ${fileName}`);
      return cached.result;
    }
    
    // Detect document type using both file extension and content
    const documentType = await detectDocumentTypeFromContent(documentText, fileName);
    console.log(`Detected document type: ${documentType}`);
    
    // Analyze based on document type
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
      default:
        result = await analyzeGeneralDocument(documentId, documentText, fileName);
        break;
    }
    
    // Cache the result
    analysisCache.set(cacheKey, {
      result,
      timestamp: Date.now()
    });
    
    console.log(`Analysis completed for document: ${fileName}`);
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
 * Analyze a spreadsheet document
 */
async function analyzeSpreadsheetDocument(
  documentId: string, 
  documentText: string, 
  fileName: string
): Promise<AnalysisResult> {
  const prompt = `
    Analyze this spreadsheet data and provide a comprehensive assessment.
    
    Document: ${fileName}
    
    Content (tabular data converted to text):
    ${documentText.substring(0, 15000)}
    
    Provide a detailed analysis with these JSON elements:
    
    1. summary: A 3-5 sentence summary of what this spreadsheet contains and its purpose
    2. keyPoints: 4-6 key observations about the data
    3. recommendations: 3-5 recommendations for improving the spreadsheet
    4. insights: Numerical scores (0-100) for:
       - clarity: How clear and understandable the data organization is
       - relevance: How relevant the data is to its apparent purpose
       - completeness: How complete the dataset appears to be
       - conciseness: How efficiently the data is organized
       - structure: How well-structured the spreadsheet is
       - engagement: How effectively the data tells a story
       - contentquality: Overall quality of the data
       - overallScore: Overall spreadsheet quality score
    5. topics: Array of data categories/themes with relevance scores (0-1)
    6. spreadsheetAnalysis: {
       - dataStructure: Assessment of how data is organized,
       - dataQuality: {completeness, consistency, accuracy} scores,
       - insights: Key metrics and patterns identified,
       - anomalies: Any outliers or unusual patterns detected
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
      analysisType: 'spreadsheet',
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
      spreadsheetAnalysis: analysisData.spreadsheetAnalysis,
      timestamp: new Date().toISOString(),
      createdAt: new Date().toISOString()
    };
    
    return result;
  } catch (error) {
    console.error('Error parsing spreadsheet analysis response:', error);
    throw new Error('Failed to parse spreadsheet analysis response');
  }
}

/**
 * Analyze a presentation document
 */
async function analyzePresentationDocument(
  documentId: string, 
  documentText: string, 
  fileName: string
): Promise<AnalysisResult> {
  const prompt = `
    Analyze this presentation document and provide a comprehensive assessment.
    
    Document: ${fileName}
    
    Content:
    ${documentText.substring(0, 15000)}
    
    Provide a detailed analysis with these JSON elements:
    
    1. summary: A 3-5 sentence summary of the presentation's content and purpose
    2. keyPoints: 4-6 key messages from the presentation
    3. recommendations: 3-5 recommendations for improving the presentation
    4. insights: Numerical scores (0-100) for:
       - clarity: How clear the presentation message is
       - relevance: How relevant the content is to the apparent audience
       - completeness: How thorough the presentation is
       - conciseness: How concise and focused the presentation is
       - structure: How well-structured the presentation flow is
       - engagement: How engaging the presentation is
       - contentquality: Overall quality of the content
       - overallScore: Overall presentation quality score
    5. topics: Array of presentation topics with relevance scores (0-1)
    6. sentiment: Overall presentation tone
    7. presentationAnalysis: {
       - slideStructure: Assessment of slide organization and flow,
       - messageClarity: How clear the core message is,
       - visualBalance: Assessment of text vs. visuals,
       - audienceEngagement: Factors that engage or lose audience interest
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
      analysisType: 'presentation',
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
      presentationAnalysis: analysisData.presentationAnalysis,
      timestamp: new Date().toISOString(),
      createdAt: new Date().toISOString()
    };
    
    return result;
  } catch (error) {
    console.error('Error parsing presentation analysis response:', error);
    throw new Error('Failed to parse presentation analysis response');
  }
} 