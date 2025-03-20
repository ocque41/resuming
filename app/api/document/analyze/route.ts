import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/drizzle";
import { cvs } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { updateCVAnalysis } from "@/lib/db/queries.server";

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
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  json: "application/json",
  xml: "application/xml",
  html: "text/html",
  md: "text/markdown",
};

/**
 * Generate a mock analysis result for a document
 * This provides realistic-looking data for testing and demonstration
 */
function generateAnalysisResult(documentId: string | number, fileName: string = "document.pdf", type: string = "general") {
  console.log(`Generating analysis for document ${documentId}, file: ${fileName}, type: ${type}`);
  
  // Get file extension, default to pdf if no extension
  const fileExtension = (fileName && fileName.includes('.')) 
    ? fileName.split('.').pop()?.toLowerCase() || 'pdf' 
    : 'pdf';
  
  // Generate timestamp
  const timestamp = new Date().toISOString();
  
  // Base result structure
  return {
    documentId,
    fileName,
    analysisType: type,
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
        { text: "Innovation", value: 5 },
        { text: "Technology", value: 4 },
        { text: "Communication", value: 4 },
        { text: "Analysis", value: 3 },
        { text: "Collaboration", value: 3 },
        { text: "Results", value: 3 }
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
        { type: "Skill", name: "Project Management", occurrences: 8 },
        { type: "Location", name: "New York", occurrences: 3 },
        { type: "Degree", name: "Bachelor's Degree", occurrences: 2 }
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
    
    // Validate document ID
    if (!documentId) {
      console.error("Missing documentId in request");
      return NextResponse.json({ 
        error: "Document ID is required for analysis" 
      }, { status: 400 });
    }
    
    // Fetch document from database to get filename if not provided
    try {
      const document = await db.select().from(cvs).where(eq(cvs.id, Number(documentId))).limit(1);
      
      if (document && document.length > 0) {
        // Use filename from database if not provided in request
        if (!fileName) {
          fileName = document[0].fileName;
          console.log(`Retrieved fileName from database: ${fileName}`);
        }
      } else {
        console.error(`Document with ID ${documentId} not found in database`);
        return NextResponse.json({ 
          error: `Document with ID ${documentId} not found in database` 
        }, { status: 404 });
      }
    } catch (dbError) {
      console.error(`Database error when fetching document ${documentId}:`, dbError);
      // Continue with generic filename if database access fails
      if (!fileName) {
        console.log(`fileName is missing in request for document ID: ${documentId}, using generic name`);
        fileName = `document-${documentId}.pdf`;
      }
    }
    
    console.log(`Processing document analysis with ID: ${documentId}, fileName: ${fileName}`);
    
    // Simulate processing delay (1.5 seconds)
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Generate analysis result
    const result = generateAnalysisResult(documentId, fileName, type);
    
    // Store the analysis result in the database
    try {
      await updateCVAnalysis(Number(documentId), JSON.stringify(result));
      console.log(`Analysis saved to database for document ${documentId}`);
    } catch (saveError) {
      console.error(`Error saving analysis to database for document ${documentId}:`, saveError);
      // Continue despite save error - we'll still return the result to the client
    }
    
    console.log("Analysis completed successfully");
    
    // Return the analysis result with proper format for the client component
    return NextResponse.json({
      analysis: result
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
  
  return NextResponse.json({
    status: "Document analysis API is operational",
    supportedFileTypes: Object.keys(SUPPORTED_FILE_TYPES),
    mockSample: generateAnalysisResult("sample", "example.pdf")
  });
} 