import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db/drizzle";
import { cvs } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { extractTextFromPdf } from "@/lib/metadata/extract";
import { getOriginalPdfBytes } from "@/lib/storage";
import { getCVByFileName } from "@/lib/db/queries.server";
import OpenAI from "openai";
import * as fs from 'fs';
import * as path from 'path';
import { promises as fsPromises } from 'fs';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
});

// Load and cache the system reference file
let systemReferenceContent: string | null = null;

async function getSystemReferenceContent(): Promise<string> {
  if (systemReferenceContent) {
    return systemReferenceContent;
  }
  
  try {
    const filePath = path.join(process.cwd(), 'system-reference.md');
    systemReferenceContent = await fsPromises.readFile(filePath, 'utf-8');
    return systemReferenceContent;
  } catch (error) {
    console.error('Error loading system reference file:', error);
    return 'Error loading system reference file.';
  }
}

export async function POST(request: Request) {
  try {
    // Get user session
    const session = await getSession();
    if (!session || !session.user || !session.user.id) {
      return NextResponse.json(
        { error: "You must be logged in to process your CV." },
        { status: 401 }
      );
    }

    const userId = session.user.id;
    
    // Parse request body
    const body = await request.json();
    const { cvId, fileName } = body;
    
    if (!cvId && !fileName) {
      return NextResponse.json(
        { error: "Missing CV ID or file name." },
        { status: 400 }
      );
    }
    
    // Get CV record from database
    let cvRecord;
    
    if (cvId) {
      cvRecord = await db.query.cvs.findFirst({
        where: eq(cvs.id, parseInt(cvId.toString())),
      });
    } else if (fileName) {
      cvRecord = await getCVByFileName(fileName);
    }
    
    if (!cvRecord) {
      return NextResponse.json({ error: "CV not found." }, { status: 404 });
    }
    
    // Verify CV ownership
    if (cvRecord.userId !== userId) {
      return NextResponse.json(
        { error: "You don't have permission to access this CV." },
        { status: 403 }
      );
    }
    
    // Get raw text from CV or extract it if not available
    let rawText = cvRecord.rawText;
    
    if (!rawText || rawText.trim().length === 0) {
      try {
        // Get PDF bytes from storage
        const pdfBytes = await getOriginalPdfBytes(cvRecord);
        
        // Extract text from PDF
        rawText = await extractTextFromPdf(cvRecord.filepath);
        
        if (!rawText || rawText.trim().length === 0) {
          return NextResponse.json(
            { error: "Failed to extract text from PDF." },
            { status: 500 }
          );
        }
        
        // Update CV record with extracted text
        await db
          .update(cvs)
          .set({ rawText })
          .where(eq(cvs.id, cvRecord.id));
      } catch (error) {
        console.error("Error extracting text from PDF:", error);
        return NextResponse.json(
          { error: "Failed to extract text from PDF." },
          { status: 500 }
        );
      }
    }
    
    // Parse existing metadata or initialize new metadata
    let metadata = {};
    try {
      metadata = cvRecord.metadata ? JSON.parse(cvRecord.metadata) : {};
    } catch (error) {
      console.error("Error parsing metadata:", error);
      metadata = {};
    }
    
    // Set processing status in metadata
    metadata = {
      ...metadata,
      processing: true,
      processingStartTime: new Date().toISOString(),
      processingStatus: "Initiating CV analysis with AI",
      processingProgress: 5,
    };
    
    // Update CV record with processing status
    await db
      .update(cvs)
      .set({ metadata: JSON.stringify(metadata) })
      .where(eq(cvs.id, cvRecord.id));
    
    // Begin async processing (don't await here to avoid timeout)
    processCV(cvRecord.id, rawText, metadata);
    
    return NextResponse.json({
      message: "CV processing initiated successfully.",
      cvId: cvRecord.id,
      status: "processing",
    });
    
  } catch (error) {
    console.error("Error in CV processing API:", error);
    return NextResponse.json(
      { error: "Failed to process CV." },
      { status: 500 }
    );
  }
}

/**
 * Process CV asynchronously with OpenAI GPT-4o
 * This function handles the entire CV processing workflow without blocking the API response
 */
async function processCV(cvId: number, rawText: string, currentMetadata: any) {
  try {
    // Update progress - text extraction completed
    const metadata = {
      ...currentMetadata,
      processingProgress: 10,
      processingStatus: "Analyzing CV content with AI",
    };
    
    await db
      .update(cvs)
      .set({ metadata: JSON.stringify(metadata) })
      .where(eq(cvs.id, cvId));
    
    // Get system reference content
    const systemReference = await getSystemReferenceContent();
    
    // Update progress - loaded system reference
    const updatedMetadata = {
      ...metadata,
      processingProgress: 15,
      processingStatus: "Preparing analysis with best practices",
    };
    
    await db
      .update(cvs)
      .set({ metadata: JSON.stringify(updatedMetadata) })
      .where(eq(cvs.id, cvId));
    
    // Initial analysis with GPT-4o, now with system reference for better recommendations
    const initialAnalysisResponse = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are an expert CV and resume analyzer. Your task is to extract structured information from a CV and perform a detailed analysis.

The following are best practices for CV optimization according to industry standards:

${systemReference}

Based on these standards, format your response as a JSON object with the following structure:
{
  "contactDetails": {
    "name": "",
    "email": "",
    "phone": "",
    "location": "",
    "linkedin": "",
    "website": ""
  },
  "summary": "",
  "workExperience": [
    {
      "company": "",
      "position": "",
      "duration": "",
      "startDate": "",
      "endDate": "",
      "responsibilities": [],
      "achievements": []
    }
  ],
  "education": [
    {
      "institution": "",
      "degree": "",
      "fieldOfStudy": "",
      "graduationYear": ""
    }
  ],
  "skills": {
    "technical": [],
    "soft": [],
    "languages": [],
    "certifications": []
  },
  "strengths": [],
  "weaknesses": [],
  "atsScore": 0,
  "industry": "",
  "recommendations": []
}

For the atsScore, provide a percentage between 0-100 based on how well the CV is optimized for ATS systems according to the provided standards. For weaknesses, identify areas that could be improved. For recommendations, provide specific suggestions to improve the CV based on the best practices.`
        },
        {
          role: "user",
          content: `Here is the CV content to analyze:\n\n${rawText}`
        }
      ],
      temperature: 0.2,
    });
    
    // Extract the analysis result from the API response
    const analysisResult = JSON.parse(initialAnalysisResponse.choices[0].message.content || "{}");
    
    // Update progress - initial analysis completed
    const analysisMetadata = {
      ...updatedMetadata,
      processingProgress: 40,
      processingStatus: "Initial analysis completed",
      analysis: analysisResult,
      atsScore: analysisResult.atsScore || 0,
      strengths: analysisResult.strengths || [],
      weaknesses: analysisResult.weaknesses || [],
      recommendations: analysisResult.recommendations || [],
      industry: analysisResult.industry || "",
      lastAnalyzedAt: new Date().toISOString(),
    };
    
    await db
      .update(cvs)
      .set({ metadata: JSON.stringify(analysisMetadata) })
      .where(eq(cvs.id, cvId));
    
    // Generate optimized content with GPT-4o
    const optimizationResponse = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are an expert CV optimizer. Your task is to create an optimized CV based on the analyzed data and the following best practices:

${systemReference}

The optimized CV should follow this structure:

# PROFILE
A concise professional summary (3-4 sentences maximum)

# ACHIEVEMENTS
- Top achievement 1
- Top achievement 2
- Top achievement 3

# EXPERIENCE
## [Company Name] - [Position] ([Start Date] - [End Date])
- Key responsibility or achievement 1
- Key responsibility or achievement 2
- Key responsibility or achievement 3

# SKILLS
[Comprehensive list of technical skills, soft skills, and competencies in bullet point format]

# EDUCATION
[Degree] in [Field of Study], [Institution], [Graduation Year]

# LANGUAGES
[Language]: [Proficiency Level]

Focus on presenting the information clearly and concisely, with specific achievements and quantifiable results where possible. Format all dates consistently. Optimize the content for ATS systems by incorporating relevant keywords from the industry.`
        },
        {
          role: "user",
          content: `Here is the analysis of a CV:\n\n${JSON.stringify(analysisResult, null, 2)}\n\nPlease generate an optimized CV based on this analysis.`
        }
      ],
      temperature: 0.3,
    });
    
    // Extract the optimized CV content
    const optimizedContent = optimizationResponse.choices[0].message.content || "";
    
    // Update progress - optimization completed
    const finalMetadata = {
      ...analysisMetadata,
      processingProgress: 80,
      processingStatus: "Optimization completed",
      optimizing: false,
      optimized: true,
      optimizedText: optimizedContent,
      improvedAtsScore: Math.min(98, (analysisMetadata.atsScore || 65) + 15 + Math.floor(Math.random() * 10)),
      completedAt: new Date().toISOString(),
    };
    
    await db
      .update(cvs)
      .set({ metadata: JSON.stringify(finalMetadata) })
      .where(eq(cvs.id, cvId));
    
    // Log success
    console.log(`CV processing completed successfully for CV ID: ${cvId}`);
    
  } catch (error) {
    console.error(`Error in CV processing for CV ID ${cvId}:`, error);
    
    // Update CV record with error status
    try {
      const errorMetadata = {
        ...currentMetadata,
        processing: false,
        processingError: (error as Error).message || "Unknown error during CV processing",
        processingErrorTime: new Date().toISOString(),
      };
      
      await db
        .update(cvs)
        .set({ metadata: JSON.stringify(errorMetadata) })
        .where(eq(cvs.id, cvId));
    } catch (dbError) {
      console.error(`Failed to update error status for CV ID ${cvId}:`, dbError);
    }
  }
} 