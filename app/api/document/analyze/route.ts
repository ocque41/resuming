import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db/drizzle";
import { cvs } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

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
function generateMockAnalysisResult(documentId: string, fileName: string, type: string = "general") {
  console.log(`Generating mock analysis for document ${documentId}, file: ${fileName}, type: ${type}`);
  
  // Get file extension
  const fileExtension = fileName.split('.').pop()?.toLowerCase() || 'unknown';
  
  // Generate timestamp
  const timestamp = new Date().toISOString();
  
  // Base mock result structure
  const result = {
    documentId,
    fileName,
    analysisType: type,
    summary: `This ${fileExtension.toUpperCase()} document appears to be ${generateDescription(fileExtension)}. The content is well-structured and follows a logical flow. The document's length is appropriate for its purpose, and it includes all necessary sections.`,
    keyPoints: generateKeyPoints(fileExtension, type),
    recommendations: generateRecommendations(fileExtension, type),
    insights: generateInsights(),
    topics: generateTopics(fileExtension, type),
    entities: generateEntities(fileName, fileExtension),
    sentiment: generateSentiment(),
    languageQuality: {
      grammar: 85 + Math.floor(Math.random() * 10),
      spelling: 90 + Math.floor(Math.random() * 10),
      clarity: 80 + Math.floor(Math.random() * 15)
    },
    timeline: [
      { date: new Date(Date.now() - 86400000).toISOString(), event: "Document created" },
      { date: timestamp, event: "Analysis completed" }
    ],
    createdAt: timestamp
  };
  
  return result;
}

/**
 * Generate a description based on file type
 */
function generateDescription(fileExtension: string): string {
  switch (fileExtension) {
    case 'pdf':
      return 'a professional document with formatted text and embedded graphics';
    case 'docx':
    case 'doc':
      return 'a word processing document with structured content';
    case 'txt':
      return 'a simple text document with unformatted content';
    case 'csv':
      return 'a data file containing comma-separated values';
    case 'xlsx':
      return 'a spreadsheet with multiple tabs and formatted data';
    case 'pptx':
      return 'a presentation with slides and visual elements';
    default:
      return 'a document with standard formatting and content';
  }
}

/**
 * Generate key points based on file type and analysis type
 */
function generateKeyPoints(fileExtension: string, analysisType: string): string[] {
  const points = [
    "Document is well-structured with clear sections",
    "Content is presented in a logical and coherent manner",
    "Main ideas are supported with relevant details"
  ];
  
  if (analysisType === 'cv') {
    return [
      "Resume highlights key qualifications and experience",
      "Skills section effectively showcases relevant abilities",
      "Work history is presented in reverse chronological order",
      "Educational background is clearly stated"
    ];
  }
  
  if (fileExtension === 'pdf' || fileExtension === 'docx') {
    points.push("Formatting is consistent throughout the document");
    points.push("Headings and subheadings effectively organize the content");
  }
  
  return points;
}

/**
 * Generate recommendations based on file type and analysis type
 */
function generateRecommendations(fileExtension: string, analysisType: string): string[] {
  const recommendations = [
    "Consider adding more visual elements to enhance engagement",
    "Review for unnecessary technical jargon that might confuse readers"
  ];
  
  if (analysisType === 'cv') {
    return [
      "Consider quantifying achievements with specific metrics",
      "Add a brief professional summary at the beginning",
      "Tailor skills section to match job descriptions",
      "Include relevant certifications and professional development"
    ];
  }
  
  if (fileExtension === 'pdf' || fileExtension === 'docx') {
    recommendations.push("Ensure all images have alt text for accessibility");
    recommendations.push("Check that heading styles are used consistently");
  }
  
  return recommendations;
}

/**
 * Generate insights with random values
 */
function generateInsights() {
  return [
    { name: "Content Quality", value: 75 + Math.floor(Math.random() * 20) },
    { name: "Structure", value: 80 + Math.floor(Math.random() * 15) },
    { name: "Clarity", value: 70 + Math.floor(Math.random() * 25) },
    { name: "Engagement", value: 65 + Math.floor(Math.random() * 30) }
  ];
}

/**
 * Generate topics based on file type and analysis type
 */
function generateTopics(fileExtension: string, analysisType: string) {
  if (analysisType === 'cv') {
    return [
      { name: "Professional Experience", relevance: 0.95 },
      { name: "Technical Skills", relevance: 0.85 },
      { name: "Education", relevance: 0.75 },
      { name: "Achievements", relevance: 0.70 }
    ];
  }
  
  // Default topics based on file extension
  switch (fileExtension) {
    case 'pdf':
    case 'docx':
    case 'doc':
      return [
        { name: "Document Structure", relevance: 0.90 },
        { name: "Content Organization", relevance: 0.85 },
        { name: "Information Presentation", relevance: 0.80 },
        { name: "Subject Matter", relevance: 0.75 }
      ];
    case 'xlsx':
    case 'csv':
      return [
        { name: "Data Analysis", relevance: 0.95 },
        { name: "Numerical Information", relevance: 0.90 },
        { name: "Statistical Overview", relevance: 0.85 },
        { name: "Metrics Evaluation", relevance: 0.75 }
      ];
    default:
      return [
        { name: "General Information", relevance: 0.85 },
        { name: "Key Concepts", relevance: 0.80 },
        { name: "Primary Focus Areas", relevance: 0.75 }
      ];
  }
}

/**
 * Generate entities based on file name and type
 */
function generateEntities(fileName: string, fileExtension: string) {
  const entities = [
    { name: fileName, type: "DOCUMENT", mentions: 1 }
  ];
  
  // Add some random generic entities
  const genericEntities = [
    { name: "Company", type: "ORGANIZATION", mentions: 3 },
    { name: "Project", type: "WORK_OF_ART", mentions: 2 },
    { name: "John Doe", type: "PERSON", mentions: 2 },
    { name: "United States", type: "LOCATION", mentions: 1 },
    { name: "2023", type: "DATE", mentions: 4 }
  ];
  
  // Add 2-4 random generic entities
  const numberOfEntities = 2 + Math.floor(Math.random() * 3);
  for (let i = 0; i < numberOfEntities; i++) {
    entities.push(genericEntities[i]);
  }
  
  return entities;
}

/**
 * Generate sentiment analysis with random values
 */
function generateSentiment() {
  // Calculate random scores
  const overallScore = Math.random() * 0.8 - 0.4; // Range from -0.4 to 0.4
  
  // Determine sentiment label based on score
  let overallSentiment;
  if (overallScore > 0.2) {
    overallSentiment = "positive";
  } else if (overallScore < -0.2) {
    overallSentiment = "negative";
  } else {
    overallSentiment = "neutral";
  }
  
  // Generate random sections with sentiments
  const sections = ["Introduction", "Main Content", "Conclusion"];
  const sentimentBySection = sections.map(section => {
    const score = Math.random() * 0.8 - 0.4;
    let sentiment;
    if (score > 0.2) {
      sentiment = "positive";
    } else if (score < -0.2) {
      sentiment = "negative";
    } else {
      sentiment = "neutral";
    }
    
    return {
      section,
      sentiment,
      score
    };
  });
  
  return {
    overall: overallSentiment,
    score: overallScore,
    sentimentBySection
  };
}

/**
 * Handle POST requests
 */
export async function POST(req: NextRequest) {
  console.log("Document analysis API: POST request received");
  
  try {
    // Parse request body
    const body = await req.json();
    console.log("Request body:", body);
    
    // Validate required fields
    const { documentId, type } = body;
    let fileName = body.fileName;
    
    if (!documentId) {
      console.error("Missing documentId in request");
      return NextResponse.json({ error: "Document ID is required for analysis" }, { status: 400 });
    }
    
    // If fileName is missing, try to fetch it from the database
    if (!fileName) {
      console.log(`fileName is missing in request, attempting to fetch from database for document ID: ${documentId}`);
      
      try {
        // Get auth session to check user permissions
        const session = await auth();
        if (!session?.user?.id) {
          console.error("Unauthorized access attempt");
          return NextResponse.json({ error: "Authentication required" }, { status: 401 });
        }
        
        // Convert string to number if needed
        const numericDocId = typeof documentId === 'string' ? parseInt(documentId, 10) : documentId;
        
        // Directly query the database instead of using the helper function
        console.log(`Querying database directly for document ID ${numericDocId}`);
        const document = await db.query.cvs.findFirst({
          where: eq(cvs.id, numericDocId),
        });
        
        if (!document) {
          console.error(`Document not found with ID: ${documentId}`);
          return NextResponse.json({ error: "Document not found" }, { status: 404 });
        }
        
        // Check if this document belongs to the authenticated user
        if (document.userId !== parseInt(session.user.id)) {
          console.error(`User ${session.user.id} does not have permission to access document ${documentId}`);
          return NextResponse.json({ error: "You don't have permission to access this document" }, { status: 403 });
        }
        
        // Get the fileName from the document
        fileName = document.fileName;
        
        if (!fileName) {
          console.error(`Document ${documentId} exists but has no fileName in the database`);
          return NextResponse.json({ error: "Document has no fileName in the database" }, { status: 400 });
        }
        
        console.log(`Successfully retrieved fileName '${fileName}' from database for document ID: ${documentId}`);
      } catch (dbError) {
        console.error("Error fetching document from database:", dbError);
        
        // More detailed error reporting
        const errorDetails = dbError instanceof Error ? {
          name: dbError.name,
          message: dbError.message,
          stack: dbError.stack
        } : 'Unknown database error';
        
        console.error("Detailed error information:", errorDetails);
        
        return NextResponse.json({ 
          error: "Failed to retrieve document information",
          details: dbError instanceof Error ? dbError.message : "Unknown database error"
        }, { status: 500 });
      }
    }
    
    // Now we should have a fileName, either from the request or from the database
    if (!fileName) {
      console.error("Missing fileName in request and could not retrieve from database");
      return NextResponse.json({ error: "File name is required for analysis" }, { status: 400 });
    }
    
    // Check if file type is supported
    const fileExtension = fileName.split('.').pop()?.toLowerCase();
    if (!fileExtension || !Object.keys(SUPPORTED_FILE_TYPES).includes(fileExtension)) {
      console.error(`Unsupported file type: ${fileExtension}`);
      return NextResponse.json({ 
        error: `Unsupported file type: .${fileExtension}`,
        supportedTypes: Object.keys(SUPPORTED_FILE_TYPES)
      }, { status: 400 });
    }
    
    console.log(`Processing document analysis for ID: ${documentId}, file: ${fileName}, type: ${type || 'general'}`);
    
    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Generate mock analysis result
    const result = generateMockAnalysisResult(documentId, fileName, type);
    console.log("Analysis completed successfully");
    
    return NextResponse.json(result);
  } catch (error) {
    console.error("Error in document analysis API:", error);
    
    // More detailed error reporting
    const errorDetails = error instanceof Error ? {
      name: error.name,
      message: error.message,
      stack: error.stack
    } : 'Unknown error';
    
    console.error("Detailed error information:", errorDetails);
    
    // Return error response
    return NextResponse.json({ 
      error: "Failed to analyze document",
      details: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 });
  }
}

/**
 * Handle GET requests (for testing the API)
 */
export async function GET() {
  console.log("Document analysis API: GET request received");
  
  return NextResponse.json({
    message: "Document analysis API is working. Please use POST method with documentId, fileName, and type parameters.",
    supportedFileTypes: Object.keys(SUPPORTED_FILE_TYPES)
  });
} 