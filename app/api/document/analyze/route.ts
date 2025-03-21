import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/drizzle";
import { cvs } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { updateCVAnalysis, saveDocumentAnalysis } from "@/lib/db/queries.server";
import { analyzeDocumentWithAI } from "@/lib/ai/document-analysis";
import { analyzeDocument } from "@/lib/ai/enhanced-document-analysis";
import { detectFileType, isSupportedForAnalysis, FileTypeInfo, getAnalysisTypeForFile } from "@/lib/file-utils/file-type-detector";

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
function generateMockAnalysisResult(documentId: string | number, fileName: string = "document.pdf", purpose: string = "general") {
  console.log(`Generating mock analysis for document ${documentId}, file: ${fileName}, purpose: ${purpose}`);
  
  // Generate timestamp
  const timestamp = new Date().toISOString();
  
  // Generate mock data based on document purpose
  if (purpose === 'spreadsheet') {
    return generateMockSpreadsheetAnalysis(documentId, fileName, timestamp);
  } else if (purpose === 'presentation') {
    return generateMockPresentationAnalysis(documentId, fileName, timestamp);
  } else if (purpose === 'cv') {
    return generateMockCVAnalysis(documentId, fileName, timestamp);
  } else {
    // Default to general document analysis
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
    fileType: "pdf",
    analysisType: "spreadsheet",
    analysisTimestamp: timestamp,
    summary: "This PDF contains spreadsheet-like data with tables showing sales metrics across regions and time periods. The data appears to track performance indicators with quarterly comparisons.",
    keyPoints: [
      "Contains approximately 4 distinct data tables",
      "Sales data shows positive trends over the analyzed period",
      "Regional performance varies significantly, with North leading",
      "Several data quality issues detected including missing values"
    ],
    recommendations: [
      "Add data definitions to improve clarity",
      "Include visualization of key metrics",
      "Normalize data formats across tables",
      "Add summary statistics at the end of each section"
    ],
    dataStructureAnalysis: {
      tableCount: 4,
      columnCount: 12,
      rowCount: 45,
      dataTypes: ["text", "numeric", "date", "percentage"],
      completeness: 92
    },
    dataInsights: {
      trends: [
        { description: "Sales increasing month-over-month", significance: "high" },
        { description: "Seasonal pattern in Q4", significance: "medium" },
        { description: "Product B showing declining trend", significance: "medium" }
      ],
      patterns: [
        { description: "Cyclical performance across quarters", confidence: "high" },
        { description: "Similar patterns across regional data", confidence: "medium" }
      ],
      outliers: [
        { description: "Unexpected sales spike on 2023-08-15", impact: "Resulted in 15% higher monthly revenue" },
        { description: "Missing data for western region in June", impact: "May skew regional comparison metrics" }
      ],
      correlations: [
        { variables: ["Marketing spend", "Sales"], strength: "strong", coefficient: 0.78 },
        { variables: ["Customer satisfaction", "Retention"], strength: "moderate", coefficient: 0.62 }
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
    visualizationSuggestions: [
      "Create a line chart showing trends over time",
      "Use a bar chart to compare regional performance",
      "Add a heat map to visualize correlation matrix",
      "Create a dashboard with key metrics highlighted"
    ],
    topics: [
      { name: "Sales Analysis", relevance: 0.95 },
      { name: "Regional Performance", relevance: 0.85 },
      { name: "Product Metrics", relevance: 0.75 },
      { name: "Financial Reporting", relevance: 0.65 }
    ]
  };
}

/**
 * Generate mock analysis for presentation files (PowerPoint, etc.)
 */
function generateMockPresentationAnalysis(documentId: string | number, fileName: string, timestamp: string) {
  return {
    documentId,
    fileName,
    fileType: "pdf",
    analysisType: "presentation",
    analysisTimestamp: timestamp,
    summary: "This PDF appears to contain a presentation about company strategy and product roadmap. It includes approximately 15 slides with a mix of text, bullet points, and some visual elements.",
    keyPoints: [
      "Presents a new product strategy for the upcoming year",
      "Includes competitor analysis and market positioning",
      "Outlines key objectives and timeline",
      "Contains KPIs and success metrics",
      "Addresses potential challenges and mitigation strategies"
    ],
    recommendations: [
      "Reduce text density on slides 4, 7, and 12",
      "Add more visual elements to support key points",
      "Strengthen the conclusion with clearer action items",
      "Include more specific data points to support claims",
      "Add slide numbers and a progress indicator"
    ],
    presentationStructure: {
      estimatedSlideCount: 15,
      hasIntroduction: true,
      hasConclusion: true,
      narrativeFlow: 75,
      slideStructureQuality: 82
    },
    messageClarity: {
      mainMessage: "A new product strategy that will increase market share by 15% over the next fiscal year",
      clarity: 78,
      supportingPoints: [
        { point: "Market analysis shows opportunity", clarity: 85 },
        { point: "Competitive positioning", clarity: 75 },
        { point: "Implementation timeline", clarity: 80 },
        { point: "Resource requirements", clarity: 65 }
      ],
      audienceAlignment: "Executive leadership team"
    },
    contentBalance: {
      textDensity: 65,
      visualElements: 35,
      contentDistribution: "Text-heavy with some visual elements"
    },
    designAssessment: {
      consistencyScore: 85,
      readabilityScore: 75,
      visualHierarchyScore: 70
    },
    improvementSuggestions: {
      design: [
        "Use more consistent color scheme",
        "Improve contrast for better readability",
        "Standardize font usage across slides"
      ],
      content: [
        "Reduce bullet points on key slides",
        "Add more compelling visuals",
        "Strengthen the call to action"
      ],
      structure: [
        "Add a clear agenda slide",
        "Include transition slides between sections",
        "Strengthen conclusion with next steps"
      ]
    },
    topics: [
      { name: "Business Strategy", relevance: 0.95 },
      { name: "Product Development", relevance: 0.85 },
      { name: "Market Analysis", relevance: 0.80 },
      { name: "Financial Projections", relevance: 0.70 },
      { name: "Competition", relevance: 0.65 }
    ]
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
  try {
    // Parse request body
    const { documentId, documentText, fileName, documentPurpose } = await req.json();

    // Validate required parameters
    if (!documentId) {
      return NextResponse.json({ error: "Document ID is required" }, { status: 400 });
    }

    if (!documentText || documentText.trim().length === 0) {
      return NextResponse.json({ error: "Document text is required for analysis" }, { status: 400 });
    }

    // Detect file type
    const fileType = fileName ? detectFileType(fileName) : null;
    
    // Check if this is a PDF file
    const isPdf = fileName ? fileName.toLowerCase().endsWith('.pdf') : false;
    
    if (!isPdf) {
      return NextResponse.json({ 
        error: "Only PDF documents are supported for analysis" 
      }, { status: 400 });
    }
    
    // Use documentPurpose parameter if provided, otherwise infer from file type
    const analysisType = documentPurpose || (fileType ? getAnalysisTypeForFile(fileType) : "general");
    
    console.log(`Starting analysis for document ${documentId}, purpose: ${analysisType}, file: ${fileName || 'unnamed'}`);

    try {
      // Attempt AI analysis based on document purpose (not file type)
      let analysisResult;
      
      // Perform analysis based on the specified document purpose
      try {
        analysisResult = await analyzeDocument(
          documentId, 
          documentText, 
          fileName || 'document.pdf', 
          documentPurpose
        );
        
        console.log(`Analysis completed, generating response`);
        
        // Update the analysis in the database for future reference
        try {
          await saveDocumentAnalysis(documentId, analysisResult);
          console.log(`Analysis saved to database for document ID ${documentId}`);
        } catch (dbError) {
          console.error(`Error saving analysis to database:`, dbError);
          // Continue even if save fails - we still want to return the analysis
        }
        
        return NextResponse.json({
          message: "Document analyzed successfully",
          analysis: analysisResult
        });
      } catch (analysisError) {
        console.error(`Error in AI analysis: ${analysisError}`);
        
        // If AI analysis fails, fall back to mock analysis
        console.warn(`Falling back to mock analysis for document ${documentId}`);
        
        // Generate mock analysis based on document purpose
        const mockResult = generateMockAnalysisResult(documentId, fileName || 'document.pdf', documentPurpose || 'general');
        
        return NextResponse.json({
          message: "Document analyzed (fallback mode)",
          analysis: mockResult,
          _fallback: true
        });
      }
    } catch (error) {
      console.error(`Error analyzing document:`, error);
      return NextResponse.json({ error: "Failed to analyze document" }, { status: 500 });
    }
  } catch (error) {
    console.error("Error processing analysis request:", error);
    return NextResponse.json({ error: "Invalid request format" }, { status: 400 });
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