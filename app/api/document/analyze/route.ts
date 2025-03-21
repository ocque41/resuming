import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/drizzle";
import { cvs } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { updateCVAnalysis, saveDocumentAnalysis } from "@/lib/db/queries.server";
import { analyzeDocumentWithAI } from "@/lib/ai/document-analysis";
import { analyzeDocument } from "@/lib/ai/enhanced-document-analysis";
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
 * Main API handler for document analysis
 */
export async function POST(req: NextRequest) {
  console.log("Document analysis API: POST request received");
  
  try {
    // Parse the request body
    const body = await req.json();
    let { documentId, documentText, fileName, analysisType = "general" } = body;
    
    // Validate input
    if (!documentId) {
      console.error("Missing document ID in request");
      return NextResponse.json({ error: "Document ID is required" }, { status: 400 });
    }
    
    // If documentText is not provided, try to fetch it from the database
    if (!documentText) {
      console.log(`Document text not provided, attempting to fetch from database for document ID: ${documentId}`);
      
      try {
        const docRecord = await db.query.cvs.findFirst({
          where: eq(cvs.id, parseInt(documentId)),
        });
        
        if (!docRecord) {
          console.error(`Document with ID ${documentId} not found in database`);
          return NextResponse.json({ error: "Document not found" }, { status: 404 });
        }
        
        // Use the raw text from the database
        documentText = docRecord.rawText || "";
        
        // If we don't have a filename, use the one from the database
        if (!fileName && docRecord.fileName) {
          fileName = docRecord.fileName;
        }
        
        console.log(`Retrieved document text from database, length: ${documentText.length} characters`);
        
        // If we still don't have document text, return an error
        if (!documentText || documentText.length === 0) {
          console.error("Retrieved document has no text content");
          return NextResponse.json({ 
            error: "The document has no text content for analysis. Try re-uploading the document with proper text content."
          }, { status: 400 });
        }
      } catch (dbError) {
        console.error(`Error fetching document from database: ${dbError instanceof Error ? dbError.message : String(dbError)}`);
        return NextResponse.json({ 
          error: "Failed to retrieve document content. Please try again later."
        }, { status: 500 });
      }
    }
    
    // Validate document text after potential fetch
    if (!documentText) {
      console.error("Missing document text in request and unable to fetch it");
      return NextResponse.json({ 
        error: "Document text is required for analysis. Please ensure the document contains extractable text."
      }, { status: 400 });
    }
    
    // Trim excessive document text to prevent token limit issues
    if (documentText.length > 100000) {
      console.log(`Document text is very large (${documentText.length} chars), trimming to 100,000 chars to prevent token issues`);
      documentText = documentText.substring(0, 100000);
    }
    
    console.log(`Processing analysis request for document ID: ${documentId}, file: ${fileName || 'unknown'}, type: ${analysisType}, text length: ${documentText.length}`);
    
    // Check file type support if fileName is provided
    if (fileName) {
      const fileType = detectFileType(fileName);
      if (fileType && !isSupportedForAnalysis(fileType)) {
        console.warn(`Unsupported file type for analysis: ${fileType.name}`);
        return NextResponse.json({
          error: `File type ${fileType.name} is not currently supported for analysis. Please use PDF, DOCX, or TXT files.`
        }, { status: 400 });
      }
    }
    
    // Perform analysis
    let result;
    try {
      // Use the enhanced document analysis service
      result = await analyzeDocument(documentId.toString(), documentText, fileName || 'document.pdf');
      
      console.log(`Analysis completed successfully for document ${documentId}`);
      
      // Store analysis results in database if we have a numeric document ID (CV record)
      if (!isNaN(Number(documentId))) {
        try {
          await saveDocumentAnalysis(Number(documentId), result);
          console.log(`Analysis results saved to database for document ${documentId}`);
        } catch (dbError) {
          console.error(`Failed to save analysis to database: ${dbError instanceof Error ? dbError.message : String(dbError)}`);
          // Continue even if database save fails - we'll still return results to client
        }
      }
      
      return NextResponse.json(result);
    } catch (analysisError) {
      console.error("Error during document analysis:", analysisError);
      
      // If OpenAI API is down or rate-limited, provide a more helpful error
      const errorMessage = analysisError instanceof Error ? analysisError.message : String(analysisError);
      
      if (errorMessage.includes('rate limit') || errorMessage.includes('capacity')) {
        return NextResponse.json({ 
          error: "The AI service is currently busy. Please try again in a few minutes."
        }, { status: 429 });
      }
      
      // If an error occurs during analysis, don't return a mock - let the client know the analysis failed
      return NextResponse.json({ 
        error: "Failed to analyze document: " + errorMessage
      }, { status: 500 });
    }
  } catch (error) {
    console.error("Error in document analysis API:", error);
    return NextResponse.json({
      error: "Failed to process document analysis request",
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

/**
 * Simple health check endpoint
 */
export async function GET() {
  console.log("Document analysis API: GET request received");
  
  return NextResponse.json({
    status: "Document analysis API is operational",
    supported_file_types: Object.keys(SUPPORTED_FILE_TYPES),
    version: "2.0.0" // Update version to reflect enhanced capabilities
  });
} 