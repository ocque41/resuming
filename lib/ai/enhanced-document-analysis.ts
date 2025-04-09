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
    Analyze this document thoroughly to provide comprehensive, accurate, and actionable insights.
    
    Document: ${fileName}
    
    Content:
    ${documentText.substring(0, 15000)} // Limit to avoid token limits
    
    Provide a complete analysis with the following elements in a valid JSON structure:
    
    1. summary: A clear, concise summary (3-5 sentences) capturing the document's main purpose, audience, and key message
    
    2. keyPoints: Array of 5-7 key points extracted from the document, focusing on the most important information, ordered by importance
    
    3. recommendations: Array of 4-6 specific, actionable recommendations to improve the document, with each addressing a different aspect (e.g., structure, content, language, formatting)
    
    4. insights: Object containing numerical scores (0-100) for:
       - clarity: How clear and understandable the document is to its target audience
       - relevance: How relevant the content is to the document's apparent purpose
       - completeness: How comprehensive the document is for its purpose
       - conciseness: How efficient the document is in delivering its message
       - structure: How well-organized the document is (headings, paragraphs, logical flow)
       - engagement: How engaging and compelling the content is
       - contentquality: Overall quality of the information and arguments presented
       - overallScore: Weighted average of all scores, reflecting overall document quality
    
    5. topics: Array of topics covered in the document with relevance scores from 0-1, e.g. [{name: "Topic", relevance: 0.85}]
    
    6. sentiment: Object containing:
       - overall: One of ["positive", "negative", "neutral", "mixed"]
       - score: Decimal from 0-1 (0 = very negative, 0.5 = neutral, 1 = very positive)
    
    7. languageQuality: Object containing scores (0-100) for:
       - grammar: Grammatical correctness
       - spelling: Spelling accuracy
       - readability: How easy the text is to read (consider sentence length, word choice, etc.)
       - clarity: How clearly ideas are expressed
       - overall: Overall language quality
       
    8. documentStructure: Object describing:
       - sections: Array of main document sections identified
       - paragraphCount: Approximate number of paragraphs
       - hasExecutiveSummary: Boolean indicating if an executive summary/abstract is present
       - hasTOC: Boolean indicating if a table of contents is present
       - hasConclusion: Boolean indicating if a conclusion section is present
       
    9. contentGaps: Array of 2-4 missing elements that would strengthen the document
    
    10. audienceAnalysis: Object containing:
        - targetAudience: Identified target audience of the document
        - technicality: Score from 0-100 indicating technical complexity
        - audienceAppropriate: Boolean indicating if language and content match the apparent audience
        
    Respond with ONLY the JSON structure. Ensure it is valid JSON with no explanation text.
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
    You are an expert CV/resume analyst with experience in HR, recruitment, and career coaching across multiple industries.
    Your task is to thoroughly analyze this CV/resume and provide detailed, actionable insights to help the person improve it.
    
    Document: ${fileName}
    
    Content:
    ${documentText.substring(0, 15000)}
    
    Provide a comprehensive analysis with these elements in a valid JSON structure:
    
    1. summary: A concise summary (3-5 sentences) of the candidate's profile based on their CV
    
    2. keyPoints: Array of 5-7 strengths of this CV
    
    3. recommendations: Array of 5-7 specific, actionable recommendations to improve the CV, prioritized by impact
    
    4. insights: Object containing numerical scores (0-100) for:
       - clarity: How clear and well-organized the CV is
       - relevance: How well the content demonstrates relevant skills/experience
       - completeness: How comprehensive the CV is (includes all standard sections)
       - conciseness: How efficiently the CV presents information
       - impact: How well achievements and results are highlighted vs just responsibilities
       - keywords: How effectively industry-relevant keywords are incorporated
       - atsCompatibility: How well the CV would perform in ATS systems
       - overallScore: Weighted average of all scores
    
    5. cvSections: Object describing:
       - hasContactInfo: Boolean with assessment of contact information quality
       - hasProfile: Boolean with assessment of profile/summary section quality
       - hasExperience: Boolean with assessment of experience section quality
       - hasEducation: Boolean with assessment of education section quality
       - hasSkills: Boolean with assessment of skills section quality
       - hasAchievements: Boolean with assessment of achievements/projects quality
       - missingImportantSections: Array of important missing sections
    
    6. experienceAnalysis: Object containing:
       - jobTitles: Array of job titles extracted from the CV
       - companies: Array of company names extracted from the CV
       - experienceInYears: Estimated total years of experience
       - experienceRelevance: Score (0-100) for how relevant the experience appears
       - achievementsToResponsibilitiesRatio: Score (0-100) measuring achievement focus
       - actionVerbUsage: Score (0-100) for effective use of action verbs
       - quantifiedResults: Score (0-100) for use of metrics and quantified achievements
    
    7. skillsAnalysis: Object containing:
       - technicalSkills: Array of technical skills identified in the CV
       - softSkills: Array of soft skills identified in the CV
       - skillsGaps: Array of potentially missing skills based on the person's profile
       - industrySpecificSkills: Score (0-100) for relevant industry-specific skills
       - transferableSkills: Score (0-100) for transferable skills
    
    8. industryInsights: Object containing:
       - identifiedIndustry: Main industry this CV appears targeted for
       - industryAlignment: Score (0-100) for alignment with industry expectations
       - industryKeywords: Array of industry-specific keywords found in the CV
       - missingIndustryKeywords: Array of important industry keywords missing from the CV
       - recruitmentTrends: Brief insights on how this CV fits current recruitment trends
    
    9. atsAnalysis: Object containing:
       - atsCompatibilityScore: Score (0-100) for ATS readability
       - keywordOptimization: Score (0-100) for keyword optimization
       - formatIssues: Array of formatting issues that might affect ATS parsing
       - fileTypeConsiderations: Any considerations about the file format
       - improvementSuggestions: Array of specific suggestions to improve ATS compatibility
    
    10. visualPresentation: Object containing:
        - layoutScore: Score (0-100) for layout effectiveness
        - readabilityScore: Score (0-100) for overall readability
        - consistencyScore: Score (0-100) for formatting consistency
        - spacingScore: Score (0-100) for effective use of white space
        - improvementSuggestions: Array of suggestions to improve visual presentation

    Respond with ONLY the JSON structure. Ensure it is valid JSON with no explanation text.
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
 * Store user feedback for an analysis to improve future results
 */
export interface AnalysisFeedback {
  documentId: string;
  analysisType: string;
  rating: number; // 1-5 star rating
  feedbackText?: string; // Optional detailed feedback
  inaccuracies?: string[]; // List of specific inaccuracies
  suggestions?: string[]; // Suggestions for improvement
  userId?: string; // Optional user ID for tracking
  timestamp?: string; // ISO string timestamp when feedback was submitted
}

// In-memory store for feedback (in a production app, this would be in a database)
const analysisFeedback: AnalysisFeedback[] = [];

/**
 * Submit feedback for an analysis
 */
export async function submitAnalysisFeedback(feedback: AnalysisFeedback): Promise<boolean> {
  try {
    // Validate the feedback
    if (!feedback.documentId || !feedback.analysisType || feedback.rating < 1 || feedback.rating > 5) {
      console.error('Invalid feedback data:', feedback);
      return false;
    }
    
    // Add timestamp
    const feedbackWithTimestamp = {
      ...feedback,
      timestamp: new Date().toISOString()
    };
    
    // Store the feedback (in memory for now)
    analysisFeedback.push(feedbackWithTimestamp);
    
    console.log(`Feedback received for document ${feedback.documentId}, rating: ${feedback.rating}`);
    
    // If rating is low, invalidate the cache for this document+type
    if (feedback.rating <= 2) {
      invalidateCacheItem(feedback.documentId, feedback.analysisType);
      console.log(`Cache invalidated due to low rating for document ${feedback.documentId}`);
    }
    
    // In a real application, you would store this in a database
    // and periodically analyze feedback to improve the system
    
    return true;
  } catch (error) {
    console.error('Error submitting feedback:', error);
    return false;
  }
}

/**
 * Get aggregated feedback statistics by document type
 */
export function getFeedbackStats(): Record<string, {
  avgRating: number;
  count: number;
  recentTrend: 'improving' | 'declining' | 'stable';
}> {
  // Group feedback by analysis type
  const groupedFeedback: Record<string, AnalysisFeedback[]> = {};
  
  for (const feedback of analysisFeedback) {
    if (!groupedFeedback[feedback.analysisType]) {
      groupedFeedback[feedback.analysisType] = [];
    }
    groupedFeedback[feedback.analysisType].push(feedback);
  }
  
  // Calculate stats for each type
  const stats: Record<string, any> = {};
  
  for (const [type, feedbacks] of Object.entries(groupedFeedback)) {
    // Calculate average rating
    const avgRating = feedbacks.reduce((sum, fb) => sum + fb.rating, 0) / feedbacks.length;
    
    // Calculate recent trend
    const recentFeedbacks = feedbacks
      .sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''))
      .slice(0, Math.min(5, feedbacks.length));
      
    const recentAvgRating = recentFeedbacks.reduce((sum, fb) => sum + fb.rating, 0) / recentFeedbacks.length;
    
    const recentTrend = 
      recentAvgRating > avgRating + 0.3 ? 'improving' :
      recentAvgRating < avgRating - 0.3 ? 'declining' : 'stable';
    
    stats[type] = {
      avgRating: parseFloat(avgRating.toFixed(2)),
      count: feedbacks.length,
      recentTrend
    };
  }
  
  return stats;
}

/**
 * Use feedback to adjust analysis prompts for better results
 * This would be called periodically to improve the system
 */
export async function improveSysPromptFromFeedback(analysisType: string): Promise<string> {
  // Get all feedback for this analysis type
  const typeFeedbacks = analysisFeedback.filter(fb => fb.analysisType === analysisType);
  
  if (typeFeedbacks.length < 5) {
    console.log(`Not enough feedback for ${analysisType} analysis to improve prompts`);
    return ''; // Not enough feedback yet
  }
  
  // Extract common themes from feedback
  const allInaccuracies = typeFeedbacks.flatMap(fb => fb.inaccuracies || []);
  const allSuggestions = typeFeedbacks.flatMap(fb => fb.suggestions || []);
  const allFeedbackTexts = typeFeedbacks.map(fb => fb.feedbackText).filter(Boolean);
  
  // Create a summary for an LLM to analyze
  const feedbackSummary = `
    Analysis Type: ${analysisType}
    Average Rating: ${typeFeedbacks.reduce((sum, fb) => sum + fb.rating, 0) / typeFeedbacks.length}
    Number of Feedback Items: ${typeFeedbacks.length}
    
    Common Inaccuracies:
    ${allInaccuracies.slice(0, 10).join('\n- ')}
    
    Improvement Suggestions:
    ${allSuggestions.slice(0, 10).join('\n- ')}
    
    Sample Feedback:
    ${allFeedbackTexts.slice(0, 5).join('\n\n')}
  `;
  
  try {
    // Use OpenAI to generate improved system prompt
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: "You are an AI assistant that helps improve analysis prompts based on user feedback." },
        { role: "user", content: `Based on the following feedback for our ${analysisType} analysis system, suggest improvements to our system prompt to make the analysis more accurate and useful.\n\n${feedbackSummary}` }
      ],
      temperature: 0.7,
      max_tokens: 1000
    });
    
    const improvedPrompt = response.choices[0].message.content || '';
    
    console.log(`Generated improved system prompt for ${analysisType} analysis based on feedback`);
    return improvedPrompt;
    
    // In a real application, you would store this improved prompt
    // and use it for future analyses
  } catch (error) {
    console.error('Error generating improved prompt:', error);
    return '';
  }
} 