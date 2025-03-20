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
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getDocumentById } from '@/lib/db/document.server';

export const dynamic = "force-dynamic";

// Supported content types for analysis with appropriate file extensions
const SUPPORTED_FILE_TYPES = {
  'pdf': 'application/pdf',
  'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'doc': 'application/msword',
  'txt': 'text/plain',
  'rtf': 'application/rtf',
  'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'xls': 'application/vnd.ms-excel',
  'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'ppt': 'application/vnd.ms-powerpoint',
  'csv': 'text/csv',
  'json': 'application/json',
  'xml': 'application/xml',
  'html': 'text/html',
  'htm': 'text/html'
};

// Mock analysis result for development purposes
const MOCK_ANALYSIS_RESULT = {
  documentId: 0,
  summary: "This document is a comprehensive report detailing quarterly financial performance with insights on revenue growth, expense management, and future projections. It provides analysis of market trends and includes recommendations for strategic initiatives.",
  keyPoints: [
    "Revenue increased by 12% compared to previous quarter",
    "Operating expenses were reduced by 8% through efficiency improvements",
    "Customer acquisition cost decreased while retention rate improved",
    "New product line contributed 15% to overall revenue"
  ],
  recommendations: [
    "Consider expanding marketing efforts in the APAC region based on growth indicators",
    "Restructure the pricing model for enterprise clients to improve retention",
    "Invest more resources in developing the mobile application features",
    "Create more detailed customer case studies to support sales efforts"
  ],
  insights: {
    clarity: 78,
    relevance: 85,
    completeness: 72,
    conciseness: 65,
    overallScore: 75
  },
  topics: [
    { topic: "Financial Performance", relevance: 0.92 },
    { topic: "Market Analysis", relevance: 0.78 },
    { topic: "Strategic Planning", relevance: 0.65 },
    { topic: "Operational Efficiency", relevance: 0.58 },
    { topic: "Customer Insights", relevance: 0.45 }
  ],
  entities: [
    { name: "Global Markets Division", type: "organization" },
    { name: "Asia-Pacific", type: "location" },
    { name: "Enterprise Solutions", type: "product" },
    { name: "Q3 2023", type: "date" },
    { name: "John Reynolds", type: "person" }
  ],
  sentiment: {
    overall: "Positive",
    score: 0.42
  },
  languageQuality: {
    grammar: 92,
    spelling: 97,
    readability: 78,
    overall: 89
  },
  timestamp: new Date().toISOString()
};

// Helper function to determine file type from extension
function getFileTypeFromExtension(fileName: string): string {
  const extension = fileName.split('.').pop()?.toLowerCase() || '';
  return SUPPORTED_FILE_TYPES[extension as keyof typeof SUPPORTED_FILE_TYPES] || 'application/octet-stream';
}

// Mock analysis result generator that takes file type into account
function generateMockAnalysisResult(documentId: string | number, fileName: string, analysisType = 'general') {
  const extension = fileName.split('.').pop()?.toLowerCase() || '';
  const currentTime = new Date().toISOString();
  
  // Base mock result
  const mockResult = {
    documentId: Number(documentId),
    summary: `This appears to be a ${extension.toUpperCase()} document named "${fileName}". The document has been analyzed using ${analysisType} analysis.`,
    keyPoints: [
      "Document successfully processed",
      `File identified as ${extension.toUpperCase()} format`,
      `Analysis performed using ${analysisType} analysis mode`
    ],
    recommendations: [
      "Consider using a more specific analysis type for better results",
      "Upload additional documents for comparative analysis",
      "Review the document metadata for accuracy"
    ],
    insights: {
      clarity: Math.floor(Math.random() * 20) + 70, // 70-90
      relevance: Math.floor(Math.random() * 20) + 70, // 70-90
      completeness: Math.floor(Math.random() * 20) + 70, // 70-90
      conciseness: Math.floor(Math.random() * 20) + 70, // 70-90
      overallScore: Math.floor(Math.random() * 20) + 70 // 70-90
    },
    topics: generateMockTopics(extension),
    entities: generateMockEntities(extension, fileName),
    sentiment: {
      overall: "Positive",
      score: (Math.random() * 0.4 + 0.6) // 0.6-1.0
    },
    languageQuality: {
      grammar: Math.floor(Math.random() * 15) + 80, // 80-95
      spelling: Math.floor(Math.random() * 15) + 80, // 80-95
      readability: Math.floor(Math.random() * 15) + 80, // 80-95
      overall: Math.floor(Math.random() * 15) + 80 // 80-95
    },
    timeline: generateMockTimeline(),
    timestamp: currentTime
  };
  
  // Customize based on analysis type
  if (analysisType === 'cv') {
    mockResult.summary = `This document appears to be a resume or CV in ${extension.toUpperCase()} format. It includes information about professional experience, skills, and education.`;
    mockResult.topics = [
      { topic: "Professional Experience", relevance: 0.95 },
      { topic: "Technical Skills", relevance: 0.87 },
      { topic: "Education", relevance: 0.82 },
      { topic: "Projects", relevance: 0.75 },
      { topic: "Certifications", relevance: 0.68 }
    ];
  } else if (analysisType === 'report') {
    mockResult.summary = `This document appears to be a business report in ${extension.toUpperCase()} format. It contains data analysis, findings, and recommendations for business operations.`;
    mockResult.topics = [
      { topic: "Financial Analysis", relevance: 0.93 },
      { topic: "Market Research", relevance: 0.85 },
      { topic: "Business Strategy", relevance: 0.82 },
      { topic: "Operational Metrics", relevance: 0.78 },
      { topic: "Risk Assessment", relevance: 0.70 }
    ];
  }
  
  return mockResult;
}

// Helper function to generate mock topics based on file type
function generateMockTopics(fileExtension: string) {
  const baseTopics = [
    { topic: "Document Structure", relevance: 0.9 },
    { topic: "Content Organization", relevance: 0.85 },
    { topic: "Information Flow", relevance: 0.8 }
  ];
  
  switch (fileExtension) {
    case 'pdf':
    case 'docx':
      return [
        ...baseTopics,
        { topic: "Textual Analysis", relevance: 0.75 },
        { topic: "Visual Elements", relevance: 0.7 }
      ];
    case 'xlsx':
    case 'csv':
      return [
        ...baseTopics,
        { topic: "Data Visualization", relevance: 0.78 },
        { topic: "Numerical Analysis", relevance: 0.72 }
      ];
    case 'pptx':
      return [
        ...baseTopics,
        { topic: "Presentation Style", relevance: 0.82 },
        { topic: "Visual Impact", relevance: 0.76 }
      ];
    default:
      return baseTopics;
  }
}

// Helper function to generate mock entities
function generateMockEntities(fileExtension: string, fileName: string) {
  const baseEntities = [
    { name: fileName, type: "Document", count: 1 }
  ];
  
  // Add some plausible entities based on file type
  switch (fileExtension) {
    case 'pdf':
    case 'docx':
      return [
        ...baseEntities,
        { name: "John Smith", type: "Person", count: 3 },
        { name: "Microsoft Corporation", type: "Organization", count: 2 },
        { name: "New York City", type: "Location", count: 1 },
        { name: "January 2023", type: "Date", count: 2 }
      ];
    case 'xlsx':
    case 'csv':
      return [
        ...baseEntities,
        { name: "Q1 2023", type: "Date", count: 4 },
        { name: "Revenue", type: "Metric", count: 5 },
        { name: "North America", type: "Location", count: 2 },
        { name: "Sales Department", type: "Organization", count: 3 }
      ];
    default:
      return baseEntities;
  }
}

// Helper function to generate mock timeline
function generateMockTimeline() {
  const currentYear = new Date().getFullYear();
  
  return [
    {
      period: `January ${currentYear}`,
      entity: "Document Creation"
    },
    {
      period: `March ${currentYear}`,
      entity: "First Revision"
    },
    {
      period: `June ${currentYear}`,
      entity: "Second Revision"
    },
    {
      period: `September ${currentYear}`,
      entity: "Final Update"
    }
  ];
}

export async function POST(req: NextRequest) {
  try {
    console.log('Document analysis API route called');
    
    // Parse request body
    let body;
    try {
      body = await req.json();
      console.log('Request body successfully parsed:', body);
    } catch (error) {
      console.error('Failed to parse request body:', error);
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }
    
    const { documentId, type = 'general', fileName } = body;
    console.log('Document ID:', documentId, 'Analysis type:', type, 'Filename:', fileName);

    if (!documentId) {
      console.log('Missing documentId in request');
      return NextResponse.json({ error: 'Document ID is required' }, { status: 400 });
    }
    
    if (!fileName) {
      console.log('Missing fileName in request');
      return NextResponse.json({ error: 'File name is required for analysis' }, { status: 400 });
    }
    
    // Check if file type is supported
    const fileExtension = fileName.split('.').pop()?.toLowerCase() || '';
    const supportedExtensions = Object.keys(SUPPORTED_FILE_TYPES);
    
    if (!supportedExtensions.includes(fileExtension)) {
      console.error(`Unsupported file type: ${fileExtension}`);
      return NextResponse.json({ 
        error: `File type "${fileExtension}" is not supported for analysis. Supported types: ${supportedExtensions.join(', ')}` 
      }, { status: 400 });
    }

    try {
      // In a real implementation, we'd get the document from the database and analyze it
      // For now, we'll generate a mock analysis based on the file name and type
      console.log('Generating mock analysis for document:', documentId, 'type:', type, 'filename:', fileName);
      
      // Simulate processing delay
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Generate mock analysis result
      const mockResult = generateMockAnalysisResult(documentId, fileName, type);
      
      console.log('Analysis completed successfully, returning results');
      
      return NextResponse.json(mockResult);
    } catch (processingError) {
      console.error('Error processing document:', processingError);
      return NextResponse.json({ error: 'Failed to process document' }, { status: 500 });
    }
  } catch (error) {
    console.error('Unhandled error in document analysis endpoint:', error);
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    );
  }
}

// Add a simple GET method for testing API route registration
export async function GET(req: NextRequest) {
  return NextResponse.json({
    status: 'ok',
    message: 'Document analyzer API route is working',
    supportedMethods: ['POST'],
    supportedFileTypes: Object.keys(SUPPORTED_FILE_TYPES),
    instructions: 'Send a POST request with documentId, type (optional), and fileName in the request body',
    timestamp: new Date().toISOString()
  });
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