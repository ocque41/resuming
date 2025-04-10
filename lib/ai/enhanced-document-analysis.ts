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
  documentType: string;
  documentId: string;
}>;

// Cache expiration: 24 hours by default, but configurable
const DEFAULT_CACHE_EXPIRY = 24 * 60 * 60 * 1000;
const analysisCache: AnalysisCache = new Map();

// Configure cache settings
interface CacheConfig {
  enabled: boolean;
  expiryTime: number; // milliseconds
  maxSize: number;    // maximum number of items in cache
}

// Default cache configuration
const cacheConfig: CacheConfig = {
  enabled: true,
  expiryTime: DEFAULT_CACHE_EXPIRY,
  maxSize: 100
};

/**
 * Configure the analysis cache
 */
export function configureAnalysisCache(config: Partial<CacheConfig>): void {
  Object.assign(cacheConfig, config);
  console.log(`Analysis cache configured: ${JSON.stringify(cacheConfig)}`);
  
  // If cache is disabled, clear it
  if (!cacheConfig.enabled) {
    clearAnalysisCache();
  }
}

/**
 * Clear the analysis cache completely
 */
export function clearAnalysisCache(): void {
  analysisCache.clear();
  console.log('Analysis cache cleared');
}

/**
 * Remove a specific item from the cache
 */
export function invalidateCacheItem(documentId: string, documentPurpose?: string): boolean {
  const keys = Array.from(analysisCache.keys());
  const keyPattern = documentPurpose 
    ? `${documentId}_${documentPurpose}`
    : `${documentId}`;
    
  let removed = false;
  
  for (const key of keys) {
    if (key.startsWith(keyPattern)) {
      analysisCache.delete(key);
      removed = true;
    }
  }
  
  if (removed) {
    console.log(`Cache invalidated for document: ${documentId}, purpose: ${documentPurpose || 'all'}`);
  }
  
  return removed;
}

/**
 * Creates a cache key for storing analysis results
 */
function createCacheKey(documentId: string, fileContent: string, purpose: string = 'general'): string {
  // Generate a content hash based on the first 1000 chars and the length
  const contentPreview = fileContent.substring(0, 1000).replace(/\s+/g, '');
  const contentLength = fileContent.length.toString();
  const contentHash = hashString(`${contentPreview}_${contentLength}`);
  return `${documentId}_${purpose}_${contentHash}`;
}

/**
 * Simple string hashing function
 */
function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(16);
}

/**
 * Manages the cache to ensure it doesn't exceed the maximum size
 */
function manageCache(): void {
  if (!cacheConfig.enabled || analysisCache.size <= cacheConfig.maxSize) {
    return;
  }
  
  // If cache exceeds max size, remove oldest entries
  const entries = Array.from(analysisCache.entries())
    .sort((a, b) => a[1].timestamp - b[1].timestamp);
  
  const toRemove = entries.slice(0, entries.length - cacheConfig.maxSize);
  
  for (const [key] of toRemove) {
    analysisCache.delete(key);
  }
  
  console.log(`Cache cleaned up: removed ${toRemove.length} oldest entries`);
}

/**
 * Get an item from the cache if it exists and is not expired
 */
function getCachedAnalysis(
  documentId: string, 
  documentText: string, 
  documentPurpose?: string
): AnalysisResult | null {
  if (!cacheConfig.enabled) {
    return null;
  }
  
  const cacheKey = createCacheKey(documentId, documentText, documentPurpose);
  const cached = analysisCache.get(cacheKey);
  
  // Return null if not in cache or expired
  if (!cached || (Date.now() - cached.timestamp > cacheConfig.expiryTime)) {
    return null;
  }
  
  console.log(`Cache hit for document ID: ${documentId}, purpose: ${documentPurpose || 'general'}`);
  return cached.result;
}

/**
 * Store an analysis result in the cache
 */
function cacheAnalysisResult(
  documentId: string, 
  documentText: string, 
  result: AnalysisResult, 
  documentPurpose?: string
): void {
  if (!cacheConfig.enabled) {
    return;
  }
  
  const cacheKey = createCacheKey(documentId, documentText, documentPurpose);
  
  analysisCache.set(cacheKey, {
    result,
    timestamp: Date.now(),
    documentType: documentPurpose || 'general',
    documentId
  });
  
  manageCache();
  console.log(`Cached analysis for document ID: ${documentId}, purpose: ${documentPurpose || 'general'}`);
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
      fileType?.category === 'presentation' ||
      fileType?.category === 'scientific') {
    return fileType.category;
  }

  // Content-based detection patterns
  const patterns = {
    cv: [
      /resum[eé]/i, 
      /work experience/i, 
      /education/i, 
      /skills/i, 
      /employment/i, 
      /professional summary/i,
      /career objective/i
    ],
    spreadsheet: [
      /table \d+/i, 
      /(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec).+(q[1-4])/i,
      /\b(total|sum|average|mean|median|min|max)\b/i,
      /\brow\b.+\bcolumn\b/i,
      /\d+\.\d+%/g,  // Percentage patterns
      /\$\s*\d+[,\d]*\.\d+/g  // Currency patterns
    ],
    presentation: [
      /slide \d+/i, 
      /presentation/i, 
      /agenda/i, 
      /next slide/i,
      /thank you.+questions/i,
      /\bintroduction\b.+\bconclusion\b/i
    ],
    scientific: [
      /abstract/i, 
      /introduction/i, 
      /methodology/i, 
      /results/i, 
      /discussion/i, 
      /conclusion/i,
      /references/i,
      /et al\./i,
      /p.value/i,
      /figure \d+/i,
      /table \d+/i
    ]
  };

  // Check content patterns first for quick determination
  let detectedType = 'general';
  let maxMatches = 2; // Threshold of matches needed

  for (const [type, regexPatterns] of Object.entries(patterns)) {
    let matches = 0;
    for (const pattern of regexPatterns) {
      if (pattern.test(fileContent)) {
        matches++;
      }
    }
    
    // If we exceed our match threshold, assign this type
    if (matches > maxMatches) {
      detectedType = type;
      maxMatches = matches; // Update so we need more matches to change type
    }
  }

  // If we already detected a type from patterns, return it
  if (detectedType !== 'general') {
    console.log(`Document type detected from content patterns: ${detectedType}`);
    return detectedType;
  }

  // For more ambiguous documents, use AI classification
  try {
    const prompt = `
      Analyze this document content and determine what type of document it is.
      
      Document content begins:
      ---
      ${fileContent.substring(0, 3000)}
      ---
      
      Based on the content, classify this document into EXACTLY ONE of these categories:
      - "cv": If it's a resume, CV, or professional bio
      - "spreadsheet": If it contains primarily tabular data, financial figures, or numerical data tables
      - "presentation": If it appears to be slides, has bullet points structure, or presentation format
      - "scientific": If it's a research paper, academic article, or scientific report
      - "general": For all other document types (reports, articles, letters, etc.)
      
      Respond with ONLY the category name, nothing else.
    `;

    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.1,
      max_tokens: 20
    });

    const aiDocumentType = response.choices[0].message.content?.trim().toLowerCase() || 'general';
    console.log(`AI-based document type detection result: ${aiDocumentType}`);
    
    // Use the AI determination if it's valid
    if (['cv', 'spreadsheet', 'presentation', 'scientific', 'general'].includes(aiDocumentType)) {
      return aiDocumentType;
    }
  } catch (error) {
    console.error('Error in AI-based document type detection:', error);
    // Continue with fallback approach
  }
  
  // Fall back to file extension based detection or general
  return fileType?.category || 'general';
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
    const cachedResult = getCachedAnalysis(documentId, documentText, documentPurpose);
    if (cachedResult) {
      return cachedResult;
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
    cacheAnalysisResult(documentId, documentText, result, documentType);
    
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
    You are an expert document analyst with training in linguistics, content strategy, and professional writing.
    Your task is to perform a comprehensive, detailed analysis of this document that provides genuine, accurate, and actionable insights.
    
    Document: ${fileName}
    
    Content:
    ${documentText.substring(0, 15000)} // Limit to avoid token limits
    
    IMPORTANT: You MUST analyze the ACTUAL CONTENT provided above. DO NOT generate generic placeholder analysis or examples.
    
    Provide a complete analysis with the following elements in a valid JSON structure:
    
    1. summary: A detailed, evidence-based summary (4-6 sentences) capturing the document's specific purpose, intended audience, key messages, and notable strengths/weaknesses based on the actual content provided
    
    2. keyPoints: Array of 5-8 specific key points extracted directly from the document content, focusing on the most important information, ordered by importance. These must reference actual content from the document.
    
    3. recommendations: Array of 5-7 specific, actionable recommendations to improve the document, with each addressing a different aspect (structure, content, language, formatting) based on actual deficiencies in the provided content
    
    4. insights: Object containing numerical scores (0-100) for:
       - clarity: How clear and understandable the document is to its target audience
       - relevance: How relevant the content is to the document's apparent purpose
       - completeness: How comprehensive the document is for its purpose
       - conciseness: How efficient the document is in delivering its message
       - structure: How well-organized the document is (headings, paragraphs, logical flow)
       - engagement: How engaging and compelling the content is
       - contentquality: Overall quality of the content and information provided
       - overallScore: Weighted average of the above scores
    
    5. topics: Array of objects, each with a 'name' (string) representing a main topic in the document and 'relevance' (number 0-1) indicating how central that topic is to the document
    
    6. sentiment: Object with 'overall' (string: positive, negative, neutral, or mixed) and 'score' (number 0-1, higher means more positive)
    
    7. languageQuality: Object with scores (0-100) for:
       - grammar: Quality of grammar usage
       - spelling: Accuracy of spelling
       - readability: How easy it is to read and understand (consider sentence length, jargon, etc.)
       - clarity: How clearly ideas are expressed
       - overall: Overall language quality
    
    Return ONLY the JSON. Make sure scores accurately reflect the actual content quality. DO NOT give artificially high scores.
  `;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2,
      response_format: { type: "json_object" }
    });

    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error('Empty response from OpenAI');
    }
    
    const analysisData = JSON.parse(content);
    
    // Validate the analysis data against our schema
    // This will throw an error if required fields are missing
    try {
      const parsedData = analysisSchema.safeParse(analysisData);
      if (!parsedData.success) {
        console.warn('Schema validation warnings:', parsedData.error);
        // Continue with partial data
      }
    } catch (validationError) {
      console.warn('Validation error:', validationError);
      // Continue with the data we have
    }
    
    // Build the full result
    const result: AnalysisResult = {
      documentId,
      fileName,
      fileType: 'pdf', // Assuming PDF as mentioned in the route restrictions
      analysisType: 'general',
      analysisTimestamp: new Date().toISOString(),
      
      // Include all analysis data
      ...analysisData,
      
      // Add default values for required fields if missing
      summary: analysisData.summary || 'No summary available',
      keyPoints: analysisData.keyPoints || [],
      recommendations: analysisData.recommendations || [],
      insights: analysisData.insights || {
        clarity: 0,
        relevance: 0,
        completeness: 0,
        conciseness: 0,
        structure: 0,
        engagement: 0,
        contentquality: 0,
        overallScore: 0
      },
      topics: analysisData.topics || [],
      sentiment: analysisData.sentiment || { overall: 'neutral', score: 0.5 },
      
      // Ensure proper formatting for UI components
      contentAnalysis: {
        contentDistribution: analysisData.documentStructure?.sections?.map((section: string, index: number) => ({
          name: section,
          value: Math.floor(100 / (analysisData.documentStructure?.sections?.length || 1))
        })) || [],
        topKeywords: analysisData.topics?.slice(0, 5).map((topic: any) => ({
          text: topic.name,
          value: Math.floor(topic.relevance * 10)
        })) || []
      },
      
      sentimentAnalysis: {
        overallScore: analysisData.sentiment?.score || 0.5,
        sentimentBySection: []
      },
      
      keyInformation: {
        entities: [],
        keyDates: [],
        contactInfo: []
      }
    };
    
    return result;
  } catch (error) {
    console.error('Error in general document analysis:', error);
    throw new Error(`Failed to analyze document: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Analyze a CV/Resume document with specialized insights
 */
async function analyzeCVDocument(
  documentId: string, 
  documentText: string, 
  fileName: string
): Promise<AnalysisResult> {
  const prompt = `
    You are an expert CV and resume analyst with specialized training in hiring, recruitment, HR processes, and ATS (Applicant Tracking Systems).
    Your task is to perform a comprehensive, accurate analysis of this CV that provides genuinely helpful insights.
    
    CV Document: ${fileName}
    
    Content:
    ${documentText.substring(0, 15000)} // Limit to avoid token limits
    
    IMPORTANT: You MUST analyze the ACTUAL CV CONTENT provided above. DO NOT generate generic placeholder analysis or examples.
    
    Analyze this CV completely and return a valid JSON with these elements:
    
    1. summary: A detailed, evidence-based summary (4-6 sentences) of the candidate's profile, including experience level, key qualifications, notable strengths/weaknesses, and overall impression based on the actual CV content
    
    2. relevantJobTitles: Array of 4-6 specific job titles this candidate appears qualified for based on their actual experience and skills
    
    3. atsCompatibility: Object with:
       - score: Number 0-100 indicating how well this CV would perform in ATS scanning
       - issues: Array of specific ATS issues found in this exact CV (formatting, keywords, structure issues)
       - improvements: Array of specific suggestions to improve ATS compatibility
    
    4. skills: Object with:
       - technical: Array of all technical skills mentioned in the CV
       - soft: Array of all soft skills mentioned in the CV
       - missing: Array of 3-5 relevant skills that are commonly expected but missing from this CV based on their career path
       - topSkills: Array of 5 most impressive/relevant skills they possess
    
    5. keywords: Object with:
       - present: Array of effective keywords found in the CV
       - missing: Array of 5-8 specific keywords that should be added based on their career profile
       - analysis: Short analysis of keyword optimization
    
    6. experience: Object with:
       - experienceLevel: String (entry, mid-level, senior, executive)
       - yearsOfExperience: Number (estimated from content)
       - gapAnalysis: Analysis of any employment gaps
       - achievementFocus: Score 0-100 on how well experience focuses on achievements vs duties
       - improvementSuggestions: Array of specific suggestions to improve experience section
    
    7. strengths: Array of 4-6 specific strengths of this CV, with explanations
    
    8. weaknesses: Array of 4-6 specific weaknesses of this CV, with explanations
    
    9. improvementSuggestions: Array of 6-10 specific, actionable suggestions to improve this exact CV, ordered by importance
    
    10. format: Object with:
        - structure: Score 0-100 on CV structure/organization
        - clarity: Score 0-100 on visual clarity
        - readability: Score 0-100 on how readable the CV is
        - improvements: Array of formatting improvement suggestions
    
    11. impactScore: Number 0-100 representing the overall impact and effectiveness of this exact CV
    
    Return ONLY the JSON with no additional text. Make sure scores accurately reflect the actual content quality. DO NOT give artificially high scores.
  `;

  try {
    // Use GPT-4o for better analysis quality
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2,
      response_format: { type: "json_object" }
    });

    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error('Empty response from OpenAI');
    }
    
    const analysisData = JSON.parse(content);
    
    // Extract the identified industry for more targeted insights if needed
    const industry = analysisData.industryInsights?.identifiedIndustry || 'general';
    console.log(`Detected industry from CV: ${industry}`);
    
    // Build the full result with properly formatted data for the UI
    const result: AnalysisResult = {
      documentId,
      fileName,
      fileType: 'pdf',
      analysisType: 'cv',
      analysisTimestamp: new Date().toISOString(),
      
      // Include all core analysis data
      ...analysisData,
      
      // Ensure required fields have values
      summary: analysisData.summary || 'No summary available',
      keyPoints: analysisData.keyPoints || [],
      recommendations: analysisData.recommendations || [],
      
      // Format insights for consistency
      insights: {
        clarity: analysisData.insights?.clarity || 0,
        relevance: analysisData.insights?.relevance || 0,
        completeness: analysisData.insights?.completeness || 0,
        conciseness: analysisData.insights?.conciseness || 0,
        impact: analysisData.insights?.impact || 0,
        keywords: analysisData.insights?.keywords || 0,
        atsCompatibility: analysisData.insights?.atsCompatibility || 0,
        overallScore: analysisData.insights?.overallScore || 0
      },
      
      // Create content analysis for UI components
      contentAnalysis: {
        contentDistribution: [
          { name: "Contact & Profile", value: 10 },
          { name: "Experience", value: 40 },
          { name: "Skills", value: 25 },
          { name: "Education", value: 15 },
          { name: "Other", value: 10 }
        ],
        topKeywords: [
          ...(analysisData.industryInsights?.industryKeywords || []).slice(0, 5).map((keyword: string) => ({
            text: keyword,
            value: Math.floor(Math.random() * 5) + 5 // Random value between 5-10 for visualization
          }))
        ]
      },
      
      // Create standardized sections for UI components
      cvAnalysis: {
        experienceScore: analysisData.experienceAnalysis?.experienceRelevance || 0,
        skillsScore: analysisData.skillsAnalysis?.industrySpecificSkills || 0,
        atsScore: analysisData.atsAnalysis?.atsCompatibilityScore || 0,
        presentationScore: analysisData.visualPresentation?.layoutScore || 0,
        industryFit: analysisData.industryInsights?.industryAlignment || 0,
        experienceYears: analysisData.experienceAnalysis?.experienceInYears || 0,
        technicalSkills: analysisData.skillsAnalysis?.technicalSkills || [],
        softSkills: analysisData.skillsAnalysis?.softSkills || [],
        missingKeywords: analysisData.industryInsights?.missingIndustryKeywords || [],
        atsIssues: analysisData.atsAnalysis?.formatIssues || [],
        industryInsights: analysisData.industryInsights?.recruitmentTrends || ""
      },
      
      // Additional standardized sections
      keyInformation: {
        contactInfo: [],
        keyDates: [],
        entities: [
          ...(analysisData.experienceAnalysis?.companies || []).map((company: string) => ({
            type: "Organization",
            name: company,
            occurrences: 1
          })),
          ...(analysisData.skillsAnalysis?.technicalSkills || []).map((skill: string) => ({
            type: "Skill",
            name: skill,
            occurrences: 1
          }))
        ]
      }
    };
    
    return result;
  } catch (error) {
    console.error('Error in CV document analysis:', error);
    throw new Error(`Failed to analyze CV: ${error instanceof Error ? error.message : String(error)}`);
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

/**
 * Type for user feedback on document analysis
 */
export interface AnalysisFeedback {
  id?: string;
  documentId: string;
  userId: string;
  analysisType: string;
  rating: number; // 1-5 scale
  feedbackText?: string;
  createdAt?: string;
}

// In-memory storage for feedback (would be replaced by database in production)
const feedbackStorage: AnalysisFeedback[] = [];

/**
 * Submit feedback for a document analysis
 */
export async function submitAnalysisFeedback(feedback: AnalysisFeedback): Promise<boolean> {
  try {
    // Add timestamp and ID if not provided
    const fullFeedback: AnalysisFeedback = {
      ...feedback,
      id: feedback.id || `feedback_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      createdAt: feedback.createdAt || new Date().toISOString()
    };
    
    // In a real app, save to database
    feedbackStorage.push(fullFeedback);
    
    console.log(`Feedback submitted for document ${feedback.documentId}, type: ${feedback.analysisType}, rating: ${feedback.rating}`);
    
    // Use the feedback to improve the AI model (in a real app)
    // This could involve storing the feedback for later model retraining
    
    return true;
  } catch (error) {
    console.error('Error submitting feedback:', error);
    return false;
  }
}

/**
 * Get feedback statistics
 */
export function getFeedbackStats(): Record<string, {count: number, averageRating: number}> {
  // Group feedback by analysis type
  const statsByType: Record<string, {count: number, totalRating: number}> = {};
  
  // Calculate stats
  for (const feedback of feedbackStorage) {
    if (!statsByType[feedback.analysisType]) {
      statsByType[feedback.analysisType] = { count: 0, totalRating: 0 };
    }
    
    statsByType[feedback.analysisType].count++;
    statsByType[feedback.analysisType].totalRating += feedback.rating;
  }
  
  // Convert to average ratings
  const result: Record<string, {count: number, averageRating: number}> = {};
  for (const [type, stats] of Object.entries(statsByType)) {
    result[type] = {
      count: stats.count,
      averageRating: stats.count > 0 ? stats.totalRating / stats.count : 0
    };
  }
  
  return result;
}

/**
 * Get all feedback for a particular document
 */
export function getDocumentFeedback(documentId: string): AnalysisFeedback[] {
  return feedbackStorage.filter(feedback => feedback.documentId === documentId);
}

/**
 * Use feedback to improve analysis caching
 * Prioritize caching of high-rated analyses
 */
export function improveAnalysisCachingWithFeedback(): void {
  // Analyze feedback to improve caching strategy
  const feedbackStats = getFeedbackStats();
  
  // Example: Adjust cache config based on feedback
  const avgOverallRating = Object.values(feedbackStats).reduce(
    (sum, stat) => sum + stat.averageRating * stat.count, 
    0
  ) / Math.max(1, feedbackStorage.length);
  
  // If overall feedback is positive, we can extend cache time
  if (avgOverallRating >= 4.0) {
    cacheConfig.expiryTime = 7 * 24 * 60 * 60 * 1000; // 7 days
    console.log('Cache expiry extended to 7 days based on positive feedback');
  } else if (avgOverallRating >= 3.0) {
    cacheConfig.expiryTime = 3 * 24 * 60 * 60 * 1000; // 3 days
    console.log('Cache expiry set to 3 days based on moderate feedback');
  } else {
    cacheConfig.expiryTime = 1 * 24 * 60 * 60 * 1000; // 1 day
    console.log('Cache expiry reduced to 1 day based on mixed feedback');
  }
} 