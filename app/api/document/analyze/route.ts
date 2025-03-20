import { NextRequest, NextResponse } from "next/server";

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
    summary: `This ${fileExtension.toUpperCase()} document appears to be a professional document with structured content. The document follows standard formatting conventions and includes all expected sections.`,
    keyPoints: [
      "Document is well-structured with clear sections",
      "Content is presented in a logical and coherent manner",
      "Main ideas are supported with relevant details",
      "Formatting is consistent throughout the document"
    ],
    recommendations: [
      "Consider adding more visual elements to enhance engagement",
      "Review for unnecessary technical jargon that might confuse readers",
      "Ensure all images have alt text for accessibility",
      "Check that heading styles are used consistently"
    ],
    insights: [
      { name: "Content Quality", value: 85 },
      { name: "Structure", value: 90 },
      { name: "Clarity", value: 82 },
      { name: "Engagement", value: 78 }
    ],
    topics: [
      { name: "Document Structure", relevance: 0.95 },
      { name: "Content Organization", relevance: 0.85 },
      { name: "Information Presentation", relevance: 0.80 },
      { name: "Subject Matter", relevance: 0.75 }
    ],
    entities: [
      { name: fileName || "Document", type: "DOCUMENT", mentions: 1 },
      { name: "Company", type: "ORGANIZATION", mentions: 3 },
      { name: "Project", type: "WORK_OF_ART", mentions: 2 },
      { name: "John Doe", type: "PERSON", mentions: 2 }
    ],
    sentiment: {
      overall: "neutral",
      score: 0.2,
      sentimentBySection: [
        { section: "Introduction", sentiment: "positive", score: 0.6 },
        { section: "Main Content", sentiment: "neutral", score: 0.1 },
        { section: "Conclusion", sentiment: "positive", score: 0.5 }
      ]
    },
    languageQuality: {
      grammar: 88,
      spelling: 92,
      clarity: 85,
      readability: 80,
      overall: 86
    },
    timeline: [
      { date: "2023-01-15", event: "Document created" },
      { date: timestamp, event: "Analysis completed" }
    ],
    createdAt: timestamp
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
    
    // If fileName is missing, use a generic name based on document ID
    if (!fileName) {
      console.log(`fileName is missing in request for document ID: ${documentId}, using generic name`);
      fileName = `document-${documentId}.pdf`;
    }
    
    console.log(`Processing document analysis with ID: ${documentId}, fileName: ${fileName}`);
    
    // Simulate processing delay (1.5 seconds)
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Generate analysis result
    const result = generateAnalysisResult(documentId, fileName, type);
    console.log("Analysis completed successfully");
    
    return NextResponse.json(result);
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