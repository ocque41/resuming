import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db/drizzle";
import { cvs } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { logger } from "@/lib/logger";
import path from "path";
import { analyzeMistralAgent } from "@/lib/mistral/client";
import { extractDocumentContent, DocumentDetails } from "@/lib/document/extractor";
import { uploadFileToDropbox } from "@/lib/dropboxStorage";

export const dynamic = "force-dynamic";

// Supported content types for analysis
const SUPPORTED_CONTENT_TYPES = [
  'application/pdf', 
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // docx
  'text/plain',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // xlsx
  'application/vnd.openxmlformats-officedocument.presentationml.presentation' // pptx
];

export async function POST(request: NextRequest) {
  try {
    // Authenticate the user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Parse the request body
    const body = await request.json();
    const { documentId, analysisType = 'general' } = body;

    if (!documentId) {
      return NextResponse.json(
        { error: 'Document ID is required' },
        { status: 400 }
      );
    }

    logger.info(`Starting document analysis for document ID: ${documentId}, type: ${analysisType}`);

    // Fetch the document from the database
    const document = await db.query.cvs.findFirst({
      where: eq(cvs.id, parseInt(documentId)),
    });

    if (!document) {
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 }
      );
    }

    // Make sure the document belongs to the authenticated user
    if (document.userId !== parseInt(session.user.id)) {
      return NextResponse.json(
        { error: 'Unauthorized access to document' },
        { status: 403 }
      );
    }

    // If the document already has analysis results, return them
    let metadata: Record<string, any> = {};
    if (document.metadata) {
      try {
        metadata = JSON.parse(document.metadata);
        
        // Check if we already have analysis of the requested type
        if (metadata.analysis && metadata.analysis[analysisType]) {
          logger.info(`Returning cached analysis for document ID: ${documentId}, type: ${analysisType}`);
          
          return NextResponse.json({
            documentId,
            fileName: document.fileName,
            analysis: metadata.analysis[analysisType],
            cached: true
          });
        }
      } catch (parseError) {
        logger.error(`Error parsing document metadata: ${parseError}`);
      }
    }

    // Get document file type
    const fileExt = path.extname(document.fileName);
    const fileType = getFileTypeFromExtension(fileExt);
    
    // Get document content
    let documentContent = '';
    
    // If we already have raw text, use it
    if (document.rawText) {
      documentContent = document.rawText;
      logger.info(`Using existing raw text for document ID: ${documentId}`);
    } 
    // Otherwise, extract content from the document
    else {
      logger.info(`Extracting content from document ID: ${documentId}`);
      
      // Get path or URL to the document
      let documentPath = '';
      let documentUrl = '';
      
      if (document.filepath) {
        // If it's a Dropbox URL, convert to a direct download link
        if (document.filepath.includes('dropbox.com')) {
          // For now, we'll use the raw filepath
          documentUrl = document.filepath;
        } else {
          documentPath = document.filepath;
        }
      }
      
      if (!documentPath && !documentUrl) {
        return NextResponse.json(
          { error: 'Document file path not found' },
          { status: 404 }
        );
      }
      
      // Setup document details for extraction
      const documentDetails: DocumentDetails = {
        filePath: documentPath,
        fileUrl: documentUrl,
        fileName: document.fileName,
        fileType: fileType,
        fileSize: 0, // We don't have this information readily available
        fileExtension: fileExt
      };
      
      // Extract content from the document
      const extractionResult = await extractDocumentContent(documentDetails);
      
      if (!extractionResult.success) {
        logger.error(`Failed to extract content from document ID: ${documentId}, error: ${extractionResult.error}`);
        
        return NextResponse.json(
          { error: `Failed to extract document content: ${extractionResult.error}` },
          { status: 500 }
        );
      }
      
      documentContent = extractionResult.text;
      
      // If we don't have content, return an error
      if (!documentContent || documentContent.trim().length === 0) {
        return NextResponse.json(
          { error: 'No content could be extracted from the document' },
          { status: 400 }
        );
      }
    }
    
    // Analyze the document using Mistral AI
    logger.info(`Analyzing document ID: ${documentId} with Mistral AI`);
    
    const analysisResults = await analyzeMistralAgent(
      documentContent,
      {
        filename: document.fileName,
        fileType: fileType,
        fileSize: documentContent.length // Use text length as a proxy for file size
      },
      analysisType
    );
    
    // Update the document metadata with the analysis results
    if (!metadata.analysis) {
      metadata.analysis = {};
    }
    
    metadata.analysis[analysisType] = {
      ...analysisResults,
      analyzedAt: new Date().toISOString()
    };
    
    // Save the updated metadata
    await db.update(cvs)
      .set({
        metadata: JSON.stringify(metadata)
      })
      .where(eq(cvs.id, parseInt(documentId)));
    
    logger.info(`Document analysis completed for document ID: ${documentId}`);
    
    // Return the analysis results
    return NextResponse.json({
      documentId,
      fileName: document.fileName,
      analysis: metadata.analysis[analysisType],
      cached: false
    });
  } catch (error) {
    logger.error(`Error in document analysis: ${error}`);
    
    return NextResponse.json(
      { error: `Document analysis failed: ${error instanceof Error ? error.message : String(error)}` },
      { status: 500 }
    );
  }
}

/**
 * Get file type from extension
 */
function getFileTypeFromExtension(extension: string): string {
  extension = extension.toLowerCase();
  
  const fileTypeMap: Record<string, string> = {
    '.pdf': 'application/pdf',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.xls': 'application/vnd.ms-excel',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.ppt': 'application/vnd.ms-powerpoint',
    '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    '.txt': 'text/plain',
    '.csv': 'text/csv',
    '.json': 'application/json',
    '.xml': 'application/xml',
    '.html': 'text/html',
    '.htm': 'text/html',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.zip': 'application/zip',
    '.rtf': 'application/rtf',
    '.md': 'text/markdown'
  };
  
  return fileTypeMap[extension] || 'application/octet-stream';
}

// Mock function to analyze document content
// In a real implementation, this would use NLP libraries, ML models, etc.
async function analyzeDocument(text: string, fileName: string) {
  // Simulate processing time to make it feel more realistic
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Make basic document stats based on text length and file name
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  const charCount = text.length;
  const paragraphCount = text.split(/\n\s*\n/).filter(Boolean).length;
  const fileExtension = fileName.split('.').pop()?.toLowerCase() || '';
  
  // Extract keywords (simplified implementation)
  const words = text.toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter(word => word.length > 3);
  
  const wordFrequency: Record<string, number> = {};
  for (const word of words) {
    wordFrequency[word] = (wordFrequency[word] || 0) + 1;
  }
  
  const topKeywords = Object.entries(wordFrequency)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([text, value]) => ({ text, value }));
  
  // Simulate content distribution based on file extension and word patterns
  const contentDistribution = generateContentDistribution(fileExtension, text);
  
  // Simulate sentiment analysis
  const sentimentScores = generateSentimentScores(text);
  
  // Extract entities (organizations, people, locations, etc.)
  const keyEntities = extractEntities(text);
  
  // Generate document timeline
  const timeline = generateTimeline(text);
  
  // Generate skill assessment
  const skills = extractSkills(text);
  
  // Generate summary and insights
  const summary = generateSummary(text, fileName);
  const strengths = generateStrengths(text);
  const improvements = generateImprovements(text);
  const readabilityScore = Math.floor(Math.random() * 15) + 85; // 85-100 range
  
  return {
    metadata: {
      fileName,
      wordCount,
      charCount,
      paragraphCount,
      fileType: fileExtension,
      analysisDate: new Date().toISOString()
    },
    contentAnalysis: {
      contentDistribution,
      topKeywords
    },
    sentimentAnalysis: {
      overallScore: +(Math.random() * 0.4 + 0.6).toFixed(2), // 0.6-1.0 range
      sentimentBySection: sentimentScores,
      emotionalTone: {
        professional: Math.floor(Math.random() * 30) + 60, // 60-90%
        confident: Math.floor(Math.random() * 20) + 10, // 10-30%
        innovative: Math.floor(Math.random() * 15) + 5, // 5-20%
        cautious: Math.floor(Math.random() * 10) + 1 // 1-11%
      }
    },
    keyInformation: {
      entities: keyEntities,
      timeline,
      skills
    },
    summary: {
      text: summary,
      strengths,
      improvements,
      readability: {
        score: readabilityScore,
        sentenceStructure: pickRandomReadabilityScore(),
        vocabulary: pickRandomReadabilityScore(),
        grammar: pickRandomReadabilityScore(),
        formatting: pickRandomReadabilityScore()
      }
    }
  };
}

// Helper functions for document analysis
function generateContentDistribution(fileType: string, text: string) {
  // Create simulated distribution based on file type
  switch (fileType) {
    case 'pdf':
    case 'docx':
      // CV or resume type content
      return [
        { name: 'Professional Experience', value: Math.floor(Math.random() * 10) + 30 }, // 30-40%
        { name: 'Skills & Technologies', value: Math.floor(Math.random() * 10) + 20 }, // 20-30%
        { name: 'Education', value: Math.floor(Math.random() * 10) + 10 }, // 10-20% 
        { name: 'Personal Details', value: Math.floor(Math.random() * 5) + 5 }, // 5-10%
        { name: 'Other Information', value: Math.floor(Math.random() * 10) + 10 } // 10-20%
      ];
    case 'xlsx':
      // Spreadsheet type content
      return [
        { name: 'Numerical Data', value: Math.floor(Math.random() * 15) + 45 }, // 45-60%
        { name: 'Headers & Labels', value: Math.floor(Math.random() * 10) + 20 }, // 20-30%
        { name: 'Formulas', value: Math.floor(Math.random() * 10) + 10 }, // 10-20%
        { name: 'Metadata', value: Math.floor(Math.random() * 5) + 5 } // 5-10%
      ];
    case 'pptx':
      // Presentation type content
      return [
        { name: 'Slide Text', value: Math.floor(Math.random() * 10) + 35 }, // 35-45%
        { name: 'Visual Elements', value: Math.floor(Math.random() * 10) + 25 }, // 25-35%
        { name: 'Headers & Titles', value: Math.floor(Math.random() * 10) + 15 }, // 15-25%
        { name: 'Metadata', value: Math.floor(Math.random() * 5) + 5 } // 5-10%
      ];
    default:
      // Generic document
      return [
        { name: 'Main Content', value: Math.floor(Math.random() * 15) + 40 }, // 40-55%
        { name: 'Headers & Sections', value: Math.floor(Math.random() * 10) + 15 }, // 15-25%
        { name: 'Supporting Details', value: Math.floor(Math.random() * 10) + 15 }, // 15-25%
        { name: 'Metadata', value: Math.floor(Math.random() * 5) + 5 }, // 5-10%
        { name: 'Other', value: Math.floor(Math.random() * 5) + 5 } // 5-10%
      ];
  }
}

function generateSentimentScores(text: string) {
  const sections = ['Introduction', 'Experience', 'Education', 'Skills', 'Projects', 'References'];
  return sections.map(section => ({
    section,
    score: +(Math.random() * 0.3 + 0.7).toFixed(2) // 0.7-1.0 range
  }));
}

function extractEntities(text: string) {
  // Simplified entity extraction - would use NLP in real implementation
  const commonOrganizations = [
    'Google', 'Microsoft', 'Amazon', 'Apple', 'Facebook', 'IBM', 
    'Stanford University', 'MIT', 'Harvard',
    'Tech Innovations Inc.', 'Global Solutions Ltd.'
  ];
  
  const commonLocations = [
    'San Francisco', 'New York', 'Boston', 'Seattle', 'London', 
    'California', 'Texas', 'Massachusetts'
  ];
  
  const commonSkills = [
    'JavaScript', 'Python', 'React', 'Machine Learning', 'Project Management',
    'Data Analysis', 'Cloud Infrastructure', 'AWS', 'DevOps'
  ];
  
  const entities = [];
  
  // Add 2-4 random organizations
  for (let i = 0; i < Math.floor(Math.random() * 3) + 2; i++) {
    const org = commonOrganizations[Math.floor(Math.random() * commonOrganizations.length)];
    entities.push({
      type: 'Organization',
      name: org,
      count: Math.floor(Math.random() * 4) + 1 // 1-5 mentions
    });
  }
  
  // Add 1-3 random locations
  for (let i = 0; i < Math.floor(Math.random() * 3) + 1; i++) {
    const location = commonLocations[Math.floor(Math.random() * commonLocations.length)];
    entities.push({
      type: 'Location',
      name: location,
      count: Math.floor(Math.random() * 3) + 1 // 1-4 mentions
    });
  }
  
  // Add 3-6 random skills
  for (let i = 0; i < Math.floor(Math.random() * 4) + 3; i++) {
    const skill = commonSkills[Math.floor(Math.random() * commonSkills.length)];
    entities.push({
      type: 'Skill',
      name: skill,
      count: Math.floor(Math.random() * 5) + 1 // 1-6 mentions
    });
  }
  
  // Add random person
  entities.push({
    type: 'Person',
    name: 'John Smith',
    count: Math.floor(Math.random() * 3) + 1 // 1-4 mentions
  });
  
  // Add random date
  entities.push({
    type: 'Date',
    name: 'January 2022',
    count: Math.floor(Math.random() * 2) + 1 // 1-3 mentions
  });
  
  return entities;
}

function generateTimeline(text: string) {
  const currentYear = new Date().getFullYear();
  
  // Generate a semi-realistic timeline going back 10-15 years
  return [
    {
      period: `January ${currentYear - Math.floor(Math.random() * 3)} - Present`,
      entity: 'Tech Innovations Inc.'
    },
    {
      period: `March ${currentYear - Math.floor(Math.random() * 3) - 4} - December ${currentYear - Math.floor(Math.random() * 3) - 1}`,
      entity: 'Global Solutions Ltd.'
    },
    {
      period: `September ${currentYear - Math.floor(Math.random() * 3) - 8} - May ${currentYear - Math.floor(Math.random() * 3) - 5}`,
      entity: 'Stanford University'
    },
    {
      period: `June ${currentYear - Math.floor(Math.random() * 3) - 10}`,
      entity: 'First Industry Award'
    }
  ];
}

function extractSkills(text: string) {
  const allSkills = [
    { name: 'JavaScript', level: 'Advanced', score: 85 },
    { name: 'Machine Learning', level: 'Intermediate', score: 65 },
    { name: 'Project Management', level: 'Expert', score: 95 },
    { name: 'Python', level: 'Advanced', score: 80 },
    { name: 'Cloud Infrastructure', level: 'Intermediate', score: 60 },
    { name: 'React', level: 'Advanced', score: 85 },
    { name: 'Data Analysis', level: 'Advanced', score: 75 },
    { name: 'SQL', level: 'Intermediate', score: 70 },
    { name: 'AWS', level: 'Advanced', score: 80 },
    { name: 'DevOps', level: 'Intermediate', score: 65 }
  ];
  
  // Return 5-8 random skills
  return allSkills.sort(() => Math.random() - 0.5).slice(0, Math.floor(Math.random() * 4) + 5);
}

function generateSummary(text: string, fileName: string) {
  // Create a generic summary based on file name
  const fileType = fileName.split('.').pop()?.toLowerCase();
  
  if (fileType === 'pdf' || fileType === 'docx') {
    return `This document appears to be a professional resume or CV highlighting a technology professional's experience and skills. It includes sections on work history, education, and technical competencies. The document is well-structured and maintains a professional tone throughout, with clear descriptions of roles and achievements.`;
  }
  
  return `This ${fileType} document contains structured information that appears to be related to professional qualifications, work history, or technical data. The content is organized into distinct sections and includes various elements typical of formal documentation. The text maintains a consistent tone and formatting throughout.`;
}

function generateStrengths(text: string) {
  const allStrengths = [
    'Strong quantifiable achievements with clear metrics',
    'Excellent balance of technical and management skills',
    'Clear progression of responsibilities through career',
    'Well-organized structure with logical section ordering',
    'Effective use of action verbs and specific terminology',
    'Comprehensive skill set relevant to industry standards',
    'Good mix of hard and soft skills throughout the document',
    'Consistent formatting and professional presentation'
  ];
  
  // Return 3-5 random strengths
  return allStrengths.sort(() => Math.random() - 0.5).slice(0, Math.floor(Math.random() * 3) + 3);
}

function generateImprovements(text: string) {
  const allImprovements = [
    'Consider adding more industry-specific keywords',
    'Expand on collaborative projects and team leadership',
    'Add more details on specific technologies used in projects',
    'Quantify achievements with more specific metrics and results',
    'Include relevant certifications or professional development',
    'Optimize formatting for better visual hierarchy',
    'Consider more concise phrasing in some sections',
    'Add more context to technical terminology for broader audience'
  ];
  
  // Return 3-4 random improvements
  return allImprovements.sort(() => Math.random() - 0.5).slice(0, Math.floor(Math.random() * 2) + 3);
}

function pickRandomReadabilityScore() {
  const scores = ['Excellent', 'Very Good', 'Good', 'Professional', 'Clear', 'Perfect', 'Consistent'];
  return scores[Math.floor(Math.random() * scores.length)];
} 