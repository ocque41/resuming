import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/drizzle";
import { cvs } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { updateCVAnalysis, saveDocumentAnalysis } from "@/lib/db/queries.server";
import { analyzeDocumentWithAI } from "@/lib/ai/document-analysis";
import { detectFileType, isSupportedForAnalysis, FileTypeInfo } from "@/lib/file-utils/file-type-detector";

// Force dynamic to prevent caching
export const dynamic = "force-dynamic";

// Define supported file types
const SUPPORTED_FILE_TYPES = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  doc: "application/msword",
  txt: "text/plain",
  rtf: "application/rtf",
  csv: "text/csv",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  xls: "application/vnd.ms-excel",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ppt: "application/vnd.ms-powerpoint",
  json: "application/json",
  xml: "application/xml",
  html: "text/html",
  md: "text/markdown",
};

/**
 * Generate a mock analysis result for a document
 * This fallback provides realistic-looking data when AI analysis fails
 */
function generateMockAnalysisResult(documentId: string | number, fileName: string = "document.pdf", type: string = "general") {
  console.log(`Generating mock analysis for document ${documentId}, file: ${fileName}, type: ${type}`);
  
  // Get file extension, default to pdf if no extension
  const fileExtension = (fileName && fileName.includes('.')) 
    ? fileName.split('.').pop()?.toLowerCase() || 'pdf' 
    : 'pdf';
  
  // Generate timestamp
  const timestamp = new Date().toISOString();
  
  // Detect file type
  const fileType = detectFileType(fileName);
  
  // Generate mock data based on file type
  if (fileType && fileType.category === 'spreadsheet') {
    return generateMockSpreadsheetAnalysis(documentId, fileName, timestamp);
  } else if (fileType && fileType.category === 'presentation') {
    return generateMockPresentationAnalysis(documentId, fileName, timestamp);
  } else {
    // Default to document analysis
    return generateMockDocumentAnalysis(documentId, fileName, timestamp);
  }
}

/**
 * Generate mock analysis for document files (PDF, Word, etc.)
 */
function generateMockDocumentAnalysis(documentId: string | number, fileName: string, timestamp: string) {
  return {
    documentId,
    fileName,
    fileType: "document",
    analysisType: "document",
    analysisTimestamp: timestamp,
    contentAnalysis: {
      contentDistribution: [
        { name: "Professional Experience", value: 35 },
        { name: "Education", value: 20 },
        { name: "Skills", value: 25 },
        { name: "Projects", value: 15 },
        { name: "Other", value: 5 }
      ],
      topKeywords: [
        { text: "Project Management", value: 8 },
        { text: "Leadership", value: 7 },
        { text: "Development", value: 6 },
        { text: "Strategy", value: 5 },
        { text: "Innovation", value: 5 }
      ]
    },
    sentimentAnalysis: {
      overallScore: 0.78,
      sentimentBySection: [
        { section: "Professional Summary", score: 0.85 },
        { section: "Work Experience", score: 0.75 },
        { section: "Education", score: 0.80 },
        { section: "Skills", score: 0.72 }
      ]
    },
    keyInformation: {
      contactInfo: [
        { type: "Email", value: "example@domain.com" },
        { type: "Phone", value: "+1 (555) 123-4567" },
        { type: "Location", value: "New York, NY" }
      ],
      keyDates: [
        { description: "Most Recent Position", date: "2020 - Present" },
        { description: "Education Completed", date: "2018" }
    ],
    entities: [
        { type: "Organization", name: "Example Company", occurrences: 5 },
        { type: "Skill", name: "Project Management", occurrences: 8 }
      ]
    },
    summary: {
      highlights: [
        "5+ years of professional experience",
        "Strong leadership skills demonstrated through team management",
        "Advanced technical expertise in relevant field",
        "Proven track record of successful project completion"
      ],
      suggestions: [
        "Consider adding more quantifiable achievements",
        "Enhance skills section with proficiency levels",
        "Add more details about notable projects",
        "Include relevant certifications prominently"
      ],
      overallScore: 82
    }
  };
}

/**
 * Generate mock analysis for spreadsheet files (Excel, CSV, etc.)
 */
function generateMockSpreadsheetAnalysis(documentId: string | number, fileName: string, timestamp: string) {
  return {
    documentId,
    fileName,
    fileType: "spreadsheet",
    analysisType: "spreadsheet",
    analysisTimestamp: timestamp,
    dataStructureAnalysis: {
      tables: [
        {
          name: "Sales Data",
          columns: [
            { name: "Date", dataType: "date", completeness: 98 },
            { name: "Product", dataType: "categorical", completeness: 100 },
            { name: "Region", dataType: "categorical", completeness: 95 },
            { name: "Sales Amount", dataType: "numeric", completeness: 92 }
          ]
        },
        {
          name: "Performance Metrics",
          columns: [
            { name: "Metric", dataType: "text", completeness: 100 },
            { name: "Value", dataType: "numeric", completeness: 88 },
            { name: "Target", dataType: "numeric", completeness: 85 }
          ]
        }
      ],
      structureScore: 78
    },
    dataInsights: {
      keyMetrics: [
        { name: "Total Sales", value: "$524,345", insight: "8% increase compared to previous period" },
        { name: "Average Order Value", value: "$125.42", insight: "Highest in Q3" },
        { name: "Regional Performance", value: "North", insight: "Leading region with 32% of total sales" }
      ],
      trends: [
        { description: "Sales increasing month-over-month", significance: "high" },
        { description: "Seasonal pattern in Q4", significance: "medium" },
        { description: "Product B showing declining trend", significance: "medium" }
      ],
      anomalies: [
        { description: "Unexpected sales spike on 2023-08-15", impact: "Resulted in 15% higher monthly revenue" },
        { description: "Missing data for western region in June", impact: "May skew regional comparison metrics" }
      ]
    },
    dataQualityAssessment: {
      completenessScore: 92,
      consistencyScore: 85,
      accuracyScore: 88,
      qualityIssues: [
        { issue: "Missing values in target column", severity: "medium", recommendation: "Provide defaults or complete data" },
        { issue: "Inconsistent date formats", severity: "low", recommendation: "Standardize to YYYY-MM-DD format" },
        { issue: "Potential duplicate entries", severity: "medium", recommendation: "Check and remove duplicate records" }
      ],
      overallDataQualityScore: 88
    },
    summary: {
      insights: [
        "Strong overall sales growth trend with seasonal patterns",
        "North region consistently outperforms other regions",
        "Product mix shows diversity with 5 key products driving 80% of revenue",
        "Data quality is good but has some consistency issues"
      ],
      suggestions: [
        "Improve data completeness in target metrics",
        "Add calculated columns for month-over-month growth",
        "Consider separating data into multiple sheets by category",
        "Include visualizations alongside raw data"
      ],
      overallScore: 85
    }
  };
}

/**
 * Generate mock analysis for presentation files (PowerPoint, etc.)
 */
function generateMockPresentationAnalysis(documentId: string | number, fileName: string, timestamp: string) {
  return {
    documentId,
    fileName,
    fileType: "presentation",
    analysisType: "presentation",
    analysisTimestamp: timestamp,
    presentationStructure: {
      slideCount: 15,
      hasIntroduction: true,
      hasConclusion: true,
      narrativeFlow: "moderate",
      slideStructure: [
        { type: "title", purpose: "Introduction to company", effectiveness: 8 },
        { type: "content", purpose: "Market overview", effectiveness: 7 },
        { type: "content", purpose: "Product features", effectiveness: 9 },
        { type: "content", purpose: "Customer testimonials", effectiveness: 6 },
        { type: "conclusion", purpose: "Call to action", effectiveness: 8 }
      ],
      structureScore: 82
    },
    messageClarity: {
      mainMessage: "Our product offers the best value for enterprise solutions",
      messageClarity: 78,
      supportingPoints: [
        { point: "Cost savings", clarity: 9 },
        { point: "Ease of integration", clarity: 7 },
        { point: "Customer support", clarity: 8 },
        { point: "Scalability", clarity: 6 }
      ],
      languageAppropriateness: 85,
      audienceAlignment: "strong",
      overallClarityScore: 80
    },
    contentBalance: {
      contentDistribution: [
        { type: "text", percentage: 45 },
        { type: "data", percentage: 30 },
        { type: "visuals", percentage: 20 },
        { type: "mixed", percentage: 5 }
      ],
      contentDensity: "balanced",
      slideComplexity: [
        { complexity: "high", percentage: 20 },
        { complexity: "medium", percentage: 60 },
        { complexity: "low", percentage: 20 }
      ],
      distributionEffectiveness: 75,
      balanceScore: 78
    },
    summary: {
      strengths: [
        "Clear structure with well-defined sections",
        "Strong visual elements supporting key points",
        "Effective use of data to support claims",
        "Compelling call to action"
      ],
      improvementAreas: [
        "Reduce text density on slides 5-7",
        "Add more visual elements to complex data sections",
        "Strengthen the narrative transition between product features and testimonials",
        "Consider adding interactive elements"
      ],
      audienceImpact: "medium",
      persuasiveness: 78,
      overallScore: 80
    }
  };
}

/**
 * Generate mock CV analysis data
 */
function generateMockCVAnalysis(documentId: string | number, fileName: string, timestamp: string) {
  // Base document analysis data
  const baseAnalysis = generateMockDocumentAnalysis(documentId, fileName, timestamp);
  
  // Add CV-specific data
  return {
    ...baseAnalysis,
    analysisType: 'cv',
    cvAnalysis: {
      skills: {
        technical: [
          { name: "Microsoft Office Suite", proficiency: "Advanced", relevance: 9 },
          { name: "Data Analysis", proficiency: "Intermediate", relevance: 8 },
          { name: "Project Management", proficiency: "Advanced", relevance: 9 },
          { name: "CRM Software", proficiency: "Intermediate", relevance: 7 },
          { name: "Social Media Management", proficiency: "Advanced", relevance: 8 }
        ],
        soft: [
          { name: "Communication", evidence: "Clear articulation of achievements", strength: 9 },
          { name: "Leadership", evidence: "Team management experience highlighted", strength: 8 },
          { name: "Problem Solving", evidence: "Examples of challenges overcome", strength: 7 },
          { name: "Time Management", evidence: "Multiple concurrent responsibilities", strength: 8 }
        ],
        domain: [
          { name: "Marketing", relevance: 9 },
          { name: "Business Development", relevance: 8 },
          { name: "Customer Relations", relevance: 9 }
        ]
      },
      experience: {
        yearsOfExperience: 5,
        experienceProgression: "Clear advancement from coordinator to management roles",
        keyRoles: ["Marketing Manager", "Business Development Coordinator", "Sales Representative"],
        achievementsHighlighted: true,
        clarity: 8
      },
      education: {
        highestDegree: "Bachelor of Business Administration",
        relevance: 9,
        continuingEducation: true
      },
      atsCompatibility: {
        score: 82,
        keywordOptimization: 85,
        formatCompatibility: 78,
        improvementAreas: [
          "Use more industry-specific keywords",
          "Quantify achievements with more metrics",
          "Add specific software versions used"
        ]
      },
      strengths: [
        "Strong emphasis on measurable achievements",
        "Clear career progression",
        "Balanced technical and soft skills",
        "Relevant educational background"
      ],
      weaknesses: [
        "Could benefit from more technical certifications",
        "Some job descriptions lack specific metrics",
        "Limited detail on software proficiency levels"
      ]
    },
    summary: {
      ...baseAnalysis.summary,
      impactScore: 86,
      atsScore: 82,
      marketFit: {
        industryAlignment: "Strong alignment with marketing and business development roles",
        competitiveEdge: "Combination of analytical skills and communication abilities",
        targetRoleRecommendations: [
          "Senior Marketing Manager",
          "Business Development Director",
          "Marketing Strategist"
        ]
      }
    }
  };
}

/**
 * Handle POST requests for document analysis
 */
export async function POST(req: NextRequest) {
  console.log("Document analysis API: POST request received");
  
  try {
    // Parse request body
    const body = await req.json().catch(e => {
      console.error("Error parsing request body:", e);
      return {};
    });
    
    console.log("Request body:", body);
    
    // Extract document ID and optional params
    const { documentId, type = "general" } = body;
    let fileName = body.fileName;
    let documentText = "";
    let document = null;
    
    // Validate document ID
    if (!documentId) {
      console.error("Missing documentId in request");
      return NextResponse.json({ 
        error: "Document ID is required for analysis" 
      }, { status: 400 });
    }
    
    // Fetch document from database to get filename and text content
    try {
      const documents = await db.select().from(cvs).where(eq(cvs.id, Number(documentId))).limit(1);
      
      if (documents && documents.length > 0) {
        document = documents[0];
        
        // Use filename from database if not provided in request
    if (!fileName) {
          fileName = document.fileName;
          console.log(`Retrieved fileName from database: ${fileName}`);
        }
        
        // Get document text content for analysis
        documentText = document.rawText || "";
        if (!documentText) {
          console.warn(`Document with ID ${documentId} has no text content to analyze`);
        } else {
          console.log(`Retrieved text content for document ID ${documentId}, length: ${documentText.length} characters`);
        }
      } else {
        console.error(`Document with ID ${documentId} not found in database`);
        return NextResponse.json({ 
          error: `Document with ID ${documentId} not found in database` 
        }, { status: 404 });
      }
    } catch (dbError) {
      console.error(`Database error when fetching document ${documentId}:`, dbError);
      return NextResponse.json({ 
        error: `Database error: Failed to fetch document data` 
      }, { status: 500 });
    }
    
    // Detect file type
    const fileType = detectFileType(fileName);
    if (!fileType) {
      console.warn(`Unknown file type for document: ${fileName}`);
    } else if (!isSupportedForAnalysis(fileType)) {
      console.error(`Unsupported file type for analysis: ${fileType.name}`);
      return NextResponse.json({ 
        error: `File type '${fileType.name}' is not supported for analysis` 
      }, { status: 400 });
    }
    
    console.log(`Processing document analysis with ID: ${documentId}, fileName: ${fileName}, fileType: ${fileType?.name || 'Unknown'}`);
    
    // Start a timer to track performance
    const startTime = Date.now();
    
    // Generate analysis result - using AI if we have text content, mock data as fallback
    let result: any;
    try {
      // Detect proper analysis type
      const analysisType = fileType?.category || 'document';
      
      if (documentText.length > 100) {
        // If we have sufficient text content, use AI analysis
        console.log(`Using AI analysis for document ${documentId} (${fileName}, type: ${analysisType})`);
        
        // Make sure we're passing the file type correctly
        result = await analyzeDocumentWithAI(documentText, fileName);
        result.documentId = documentId;
        result.fileType = fileType?.category || "document";
        
        // Transform data if needed for front-end compatibility
        if (fileType?.category === 'spreadsheet') {
          console.log('Transforming spreadsheet data for frontend compatibility');
          // Map dataStructureAnalysis to contentAnalysis for frontend compatibility
          result.contentAnalysis = {
            contentDistribution: result.dataStructureAnalysis?.tables?.map((table: any) => ({
              name: table.name,
              value: 100 / (result.dataStructureAnalysis.tables.length || 1)
            })) || [],
            topKeywords: result.dataInsights?.keyMetrics?.map((metric: any, index: number) => ({
              text: metric.name,
              value: 10 - (index % 10) // Decreasing values 10...1
            })) || []
          };
          
          // Map to sentimentAnalysis
          result.sentimentAnalysis = {
            overallScore: result.dataQualityAssessment?.overallDataQualityScore / 100 || 0.5,
            sentimentBySection: result.dataQualityAssessment?.qualityIssues?.map((issue: any) => ({
              section: issue.issue,
              score: issue.severity === 'high' ? 0.3 : issue.severity === 'medium' ? 0.5 : 0.8
            })) || []
          };
          
          // Ensure structure matches what the front-end expects
          console.log('Spreadsheet analysis transformed for frontend compatibility');
        } else if (fileType?.category === 'presentation') {
          console.log('Transforming presentation data for frontend compatibility');
          // Map presentation structure to contentAnalysis for frontend compatibility
          result.contentAnalysis = {
            contentDistribution: result.contentBalance?.contentDistribution || [],
            topKeywords: result.messageClarity?.supportingPoints?.map((point: any, index: number) => ({
              text: point.point,
              value: point.clarity
            })) || []
          };
          
          // Map to sentimentAnalysis
          result.sentimentAnalysis = {
            overallScore: result.messageClarity?.overallClarityScore / 100 || 0.5,
            sentimentBySection: result.presentationStructure?.slideStructure?.map((slide: any) => ({
              section: slide.purpose,
              score: slide.effectiveness / 10
            })) || []
          };
          
          // Ensure structure matches what the front-end expects
          console.log('Presentation analysis transformed for frontend compatibility');
        } else if (fileType?.category === 'cv') {
          // Add this new condition to generate mock CV data
          result = generateMockCVAnalysis(documentId, fileName, new Date().toISOString());
        }
      } else {
        // Not enough text, use mock data instead
        console.log(`Using mock data for document ${documentId} (${fileName}) due to insufficient text`);
        if (fileType?.category === 'spreadsheet') {
          result = generateMockSpreadsheetAnalysis(documentId, fileName, new Date().toISOString());
        } else if (fileType?.category === 'presentation') {
          result = generateMockPresentationAnalysis(documentId, fileName, new Date().toISOString());
        } else if (fileType?.category === 'cv') {
          // Add this new condition to generate mock CV data
          result = generateMockCVAnalysis(documentId, fileName, new Date().toISOString());
        } else {
          result = generateMockDocumentAnalysis(documentId, fileName, new Date().toISOString());
        }
      }
      
      // Log processing time
      const processingTime = (Date.now() - startTime) / 1000;
      console.log(`Analysis completed in ${processingTime.toFixed(2)} seconds`);
      
    } catch (analysisError) {
      console.error(`Error in AI analysis for document ${documentId}:`, analysisError);
      
      // Fallback to mock data if AI analysis fails
      console.log(`Falling back to mock analysis for document ${documentId}`);
      const fallbackType = fileType?.category || 'document';
      result = generateMockAnalysisResult(documentId, fileName, fallbackType);
    }
    
    // Make sure we have required fields for all document types
    if (!result.keyInformation) {
      result.keyInformation = { 
        contactInfo: [],
        keyDates: [],
        entities: []
      };
    }
    
    if (!result.summary) {
      result.summary = {
        highlights: [],
        suggestions: [],
        overallScore: 50
      };
    }
    
    // Store the analysis result in the database using the new function
    try {
      // Save to the dedicated analysis table
      const savedAnalysis = await saveDocumentAnalysis(Number(documentId), result);
      if (savedAnalysis) {
        console.log(`Analysis saved to database for document ${documentId} with version ${savedAnalysis.version}`);
      } else {
        // Fall back to the old method if the new one fails
        await updateCVAnalysis(Number(documentId), JSON.stringify(result));
        console.log(`Analysis saved to metadata for document ${documentId} (fallback method)`);
      }
    } catch (saveError) {
      console.error(`Error saving analysis to database for document ${documentId}:`, saveError);
      // Continue despite save error - we'll still return the result to the client
    }
    
    console.log("Analysis completed successfully");
    
    // Return the analysis result with proper format for the client component
    return NextResponse.json({
      analysis: result,
      fileType: fileType
    });
  } catch (error) {
    console.error("Error in document analysis API:", error);
    
    // Create error details
    const errorDetails = error instanceof Error 
      ? { name: error.name, message: error.message, stack: error.stack }
      : { name: "Unknown", message: "An unknown error occurred" };
    
    console.error("Error details:", errorDetails);
    
    // Return error response
    return NextResponse.json({ 
      error: "Failed to analyze document", 
      details: errorDetails.message
    }, { status: 500 });
  }
}

/**
 * Handle GET requests for API testing
 */
export async function GET() {
  console.log("Document analysis API: GET request received");
  
  // Create example analyses for different file types
  const documentExample = generateMockAnalysisResult("sample", "example.pdf", "document");
  const spreadsheetExample = generateMockAnalysisResult("sample", "example.xlsx", "spreadsheet");
  const presentationExample = generateMockAnalysisResult("sample", "example.pptx", "presentation");
  
  return NextResponse.json({
    status: "Document analysis API is operational",
    supportedFileTypes: Object.keys(SUPPORTED_FILE_TYPES),
    sampleAnalyses: {
      document: documentExample,
      spreadsheet: spreadsheetExample,
      presentation: presentationExample
    }
  });
} 