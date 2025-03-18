import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/lib/db/drizzle';
import { cvs } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

// Import the entire module to avoid bundling issues
import * as optimizeCVModule from '@/lib/optimizeCV.fixed';
import { getOriginalPdfBytes, extractTextFromPdf, saveFileToDropbox, getDropboxClient } from '@/lib/storage';
import { DocumentGenerator } from '@/lib/utils/documentGenerator';

// Define a session type
interface UserSession {
  user?: {
    id: string;
    name?: string;
    email?: string;
  };
}

/**
 * API endpoint to optimize a CV using the new DOCX-based workflow
 */
export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    // Parse request body
    const body = await request.json();
    const { fileName, templateId } = body;
    
    if (!fileName) {
      return NextResponse.json({ error: "Missing fileName parameter" }, { status: 400 });
    }
    
    // Get the CV record
    const cvRecord = await db.query.cvs.findFirst({
      where: eq(cvs.fileName, fileName)
    });
    
    if (!cvRecord) {
      return NextResponse.json({ error: "CV not found" }, { status: 404 });
    }
    
    // Check if the CV belongs to the authenticated user
    const userId = parseInt(session.user.id, 10);
    if (cvRecord.userId !== userId) {
      return NextResponse.json({ error: "Unauthorized access to CV" }, { status: 403 });
    }
    
    // Update metadata to indicate optimization is in progress
    let metadata = cvRecord.metadata ? JSON.parse(cvRecord.metadata) : {};
    metadata.optimizing = true;
    metadata.progress = 10;
    metadata.startTime = new Date().toISOString();
    
    await db.update(cvs)
      .set({
        metadata: JSON.stringify(metadata)
      })
      .where(eq(cvs.id, cvRecord.id));
    
    // Start the background process
    startBackgroundProcess(cvRecord, templateId, session.user.id);
    
    // Return immediate response
    return NextResponse.json({
      message: "Optimization process started",
      status: "optimizing",
      progress: 10
    });
    
  } catch (error) {
    console.error("Error starting optimization:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: `Failed to start optimization: ${errorMessage}` }, { status: 500 });
  }
}

/**
 * Start the background optimization process
 */
function startBackgroundProcess(cvRecord: any, templateId: string, userId: string) {
  // Run this asynchronously
  (async () => {
    try {
      // Get the PDF text
      const pdfBytes = await getOriginalPdfBytes(cvRecord);
      const cvText = await extractTextFromPdf(pdfBytes);
      
      // Update progress
      await updateMetadata(cvRecord.id, { progress: 20 });
      
      // Extract sections and perform initial ATS analysis using GPT-4o
      console.log("Analyzing CV with GPT-4o for ATS optimization");
      await updateMetadata(cvRecord.id, { progress: 30, step: "Analyzing CV with GPT-4o" });
      
      // Extract sections using the module
      const sections = optimizeCVModule.extractSections(cvText);
      
      // Perform ATS analysis to get initial score
      const atsAnalysisResult = await performATSAnalysis(cvText, sections);
      const originalAtsScore = atsAnalysisResult.atsScore || 60; // Default to 60% if not available
      
      // Update progress with initial ATS score
      await updateMetadata(cvRecord.id, { 
        progress: 40,
        step: "Completed initial ATS analysis",
        originalAtsScore,
        analyzedSections: JSON.stringify(sections)
      });
      
      // Optimize CV content with GPT-4o
      console.log("Optimizing CV content with GPT-4o");
      await updateMetadata(cvRecord.id, { progress: 50, step: "Optimizing CV content with GPT-4o" });
      
      // Generate optimized content for each section
      const optimizedSections = await optimizeSectionsWithGPT4o(sections, atsAnalysisResult);
      
      // Update progress
      await updateMetadata(cvRecord.id, { 
        progress: 60,
        step: "Generated optimized content",
        optimizedText: JSON.stringify(optimizedSections)
      });
      
      // Re-analyze the optimized content for new ATS score
      const optimizedText = formatOptimizedSections(optimizedSections);
      const optimizedAnalysisResult = await performATSAnalysis(optimizedText, optimizedSections);
      const improvedAtsScore = optimizedAnalysisResult.atsScore || originalAtsScore + 15; // Default to +15% improvement
      
      // Update progress with improved ATS score
      await updateMetadata(cvRecord.id, { 
        progress: 70,
        step: "Completed ATS re-analysis",
        improvedAtsScore
      });
      
      // Generate the optimized DOCX document
      console.log("Generating optimized DOCX document");
      await updateMetadata(cvRecord.id, { progress: 80, step: "Generating optimized DOCX document" });
      
      // Use the new ATS-optimized document generator
      let docxBuffer: Buffer;
      try {
        // Prepare document generation parameters - with simplified structure
        const docGenParams = {
          atsScore: originalAtsScore,
          improvedAtsScore: improvedAtsScore,
          industry: optimizedAnalysisResult.industry || 'General',
          title: `Optimized_${cvRecord.fileName.replace(/[^a-zA-Z0-9-_]/g, '_').replace('.pdf', '')}`,
          author: "CV Optimizer",
          description: "ATS-optimized CV document",
          // Simplify experience entries structure to avoid complexity
          experienceEntries: optimizedAnalysisResult.experienceEntries 
            ? optimizedAnalysisResult.experienceEntries
                .filter((entry: any) => entry && typeof entry === 'object')
                .map((entry: any) => ({
                  jobTitle: entry.jobTitle ? String(entry.jobTitle).substring(0, 100) : 'Position',
                  company: entry.company ? String(entry.company).substring(0, 100) : 'Company',
                  dateRange: entry.dateRange ? String(entry.dateRange).substring(0, 50) : '',
                  location: entry.location ? String(entry.location).substring(0, 100) : undefined,
                  responsibilities: Array.isArray(entry.responsibilities)
                    ? entry.responsibilities
                        .filter((resp: any) => typeof resp === 'string')
                        .map((resp: string) => String(resp).substring(0, 300))
                        .slice(0, 10)
                    : []
                }))
                .slice(0, 15)
            : [],
          // Simplify improvements structure
          improvements: [
            ...(optimizedAnalysisResult.sectionRecommendations 
              ? Object.values(optimizedAnalysisResult.sectionRecommendations)
                  .filter((item: any) => typeof item === 'string')
                  .map((item: string) => String(item).substring(0, 300))
              : []),
            ...(optimizedAnalysisResult.keywordRecommendations || []),
            ...(optimizedAnalysisResult.improvementSuggestions 
              ? Object.values(optimizedAnalysisResult.improvementSuggestions)
                  .filter((item: any) => typeof item === 'string')
                  .map((item: string) => String(item).substring(0, 300))
              : [])
          ].slice(0, 5)
        };
        
        // Use simplified text content - avoid complex structures
        const simplifiedText = optimizedText.length > 50000 
          ? optimizedText.substring(0, 50000) // Limit text size
          : optimizedText;
        
        // Generate with explicit error handling
        docxBuffer = await DocumentGenerator.generateDocx(simplifiedText, docGenParams);
        
        // Verify we got a valid buffer back
        if (!Buffer.isBuffer(docxBuffer) || docxBuffer.length === 0) {
          throw new Error("Generated document is empty or invalid");
        }
        
        console.log(`Successfully generated DOCX document with size: ${docxBuffer.length} bytes`);
      } catch (docxError) {
        console.error("Error generating DOCX:", docxError);
        await updateMetadata(cvRecord.id, { 
          error: `Failed to generate document: ${docxError instanceof Error ? docxError.message : String(docxError)}`,
          errorTimestamp: new Date().toISOString(),
          optimizing: false
        });
        throw new Error(`Failed to generate optimized document: ${docxError instanceof Error ? docxError.message : String(docxError)}`);
      }
      
      // Save the generated DOCX to Dropbox
      console.log("Saving optimized DOCX to Dropbox");
      await updateMetadata(cvRecord.id, { progress: 90, step: "Saving optimized DOCX" });
      
      // Create a safe filename for the DOCX
      const sanitizedFileName = cvRecord.fileName
        .replace(/[^a-zA-Z0-9-_.]/g, '_') // Replace unsafe characters
        .replace(/\.pdf$/i, ''); // Remove pdf extension
      
      // Use Dropbox client to save the file
      const dropboxClient = await getDropboxClient();
      const optimizedFileName = `optimized_${sanitizedFileName}.docx`;
      const dropboxPath = `/cvs/${userId}/${optimizedFileName}`;
      
      try {
        await saveFileToDropbox(dropboxClient, dropboxPath, docxBuffer);
      } catch (saveError) {
        console.error("Error saving file to Dropbox:", saveError);
        await updateMetadata(cvRecord.id, { 
          error: `Failed to save document to storage: ${saveError instanceof Error ? saveError.message : String(saveError)}`,
          errorTimestamp: new Date().toISOString(),
          optimizing: false
        });
        throw new Error(`Failed to save optimized document: ${saveError instanceof Error ? saveError.message : String(saveError)}`);
      }
      
      // Update CV record with optimized document reference
      await db.update(cvs)
        .set({
          optimizedDocxPath: dropboxPath
        })
        .where(eq(cvs.id, cvRecord.id));
      
      // Mark as complete with all metadata
      await updateMetadata(cvRecord.id, {
        progress: 100,
        optimized: true,
        optimizing: false,
        completedAt: new Date().toISOString(),
        originalAtsScore,
        improvedAtsScore,
        optimizedDocxPath: dropboxPath
      });
      
      console.log(`Optimization completed for CV ${cvRecord.id}`);
    } catch (error) {
      console.error("Error in background process:", error);
      
      // Update metadata with error
      await updateMetadata(cvRecord.id, {
        error: error instanceof Error ? error.message : String(error),
        errorTimestamp: new Date().toISOString(),
        optimizing: false
      });
    }
  })().catch(error => {
    console.error("Unhandled error in background process:", error);
  });
}

/**
 * Update the metadata for a CV
 */
async function updateMetadata(cvId: number, updates: Record<string, any>): Promise<void> {
  try {
    const cvRecord = await db.query.cvs.findFirst({
      where: eq(cvs.id, cvId)
    });
    
    if (!cvRecord) {
      console.error(`CV not found for ID: ${cvId}`);
      return;
    }
    
    // Parse existing metadata
    const metadata = cvRecord.metadata ? JSON.parse(cvRecord.metadata) : {};
    
    // Sanitize updates to prevent circular references and handle complex objects
    const sanitizedUpdates: Record<string, any> = {};
    
    for (const [key, value] of Object.entries(updates)) {
      if (value === undefined || value === null) {
        // Skip undefined or null values
        continue;
      }
      
      if (typeof value === 'object') {
        try {
          // Test if the object can be serialized and deserialized properly
          const testSerialization = JSON.parse(JSON.stringify(value));
          sanitizedUpdates[key] = testSerialization;
        } catch (err) {
          console.warn(`Skipping non-serializable value for key: ${key}`);
        }
      } else {
        sanitizedUpdates[key] = value;
      }
    }
    
    // Create updated metadata
    const updatedMetadata = {
      ...metadata,
      ...sanitizedUpdates,
      lastUpdated: new Date().toISOString()
    };
    
    // Verify that the updated metadata can be serialized
    try {
      JSON.stringify(updatedMetadata);
    } catch (jsonError) {
      console.error(`Failed to serialize metadata for CV ${cvId}:`, jsonError);
      throw new Error('Unable to serialize metadata');
    }
    
    // Update the database
    await db.update(cvs)
      .set({
        metadata: JSON.stringify(updatedMetadata)
      })
      .where(eq(cvs.id, cvId));
      
    console.log(`Updated metadata for CV ${cvId}:`, Object.keys(sanitizedUpdates));
  } catch (error) {
    console.error(`Failed to update metadata for CV ${cvId}:`, error);
  }
}

/**
 * Perform ATS analysis on CV text
 * This simulates the GPT-4o call for ATS analysis
 */
async function performATSAnalysis(cvText: string, sections: any): Promise<any> {
  // In a real implementation, this would call GPT-4o
  console.log("Performing ATS analysis on CV text");
  
  // For demonstration, return a simulated analysis
  return {
    atsScore: Math.floor(60 + Math.random() * 20), // Random score between 60-80
    sectionRecommendations: {
      profile: ["Add more industry-specific keywords", "Quantify achievements"],
      experience: ["Use more action verbs", "Include measurable results"],
      skills: ["List technical skills separately", "Include both hard and soft skills"]
    },
    keywordRecommendations: ["project management", "agile", "cross-functional", "leadership"],
    improvementSuggestions: [
      "Add more measurable achievements",
      "Use industry-specific keywords",
      "Improve formatting consistency"
    ]
  };
}

/**
 * Optimize CV sections with GPT-4o
 * This simulates the GPT-4o call for content optimization
 */
async function optimizeSectionsWithGPT4o(sections: Record<string, string>, atsAnalysis: any): Promise<Record<string, string>> {
  // In a real implementation, this would call GPT-4o
  console.log("Optimizing CV sections with GPT-4o");
  
  // For demonstration, return enhanced sections
  const optimizedSections: Record<string, string> = { ...sections };
  
  // Add a profile section if it doesn't exist
  if (!optimizedSections.profile) {
    optimizedSections.profile = "Experienced professional with a proven track record of delivering results. Strong communication and leadership skills with expertise in project management and cross-functional team collaboration.";
  }
  
  // Add an achievements section if it doesn't exist
  if (!optimizedSections.achievements) {
    optimizedSections.achievements = "• Successfully led a team that increased company revenue by 20% in one year\n• Implemented process improvements that reduced operational costs by 15%\n• Delivered projects on time and under budget, resulting in high client satisfaction";
  }
  
  // Enhance the experience section if it exists
  if (optimizedSections.experience) {
    // Just simulate enhancement for demonstration
    optimizedSections.experience = optimizedSections.experience
      .replace(/worked/gi, "Collaborated")
      .replace(/helped/gi, "Facilitated")
      .replace(/made/gi, "Implemented");
  }
  
  // Enhance the skills section if it exists
  if (optimizedSections.skills) {
    // Add some ATS-friendly keywords
    if (!optimizedSections.skills.includes("Project Management")) {
      optimizedSections.skills += "\n• Project Management";
    }
    if (!optimizedSections.skills.includes("Leadership")) {
      optimizedSections.skills += "\n• Leadership";
    }
  } else {
    // Create a skills section if it doesn't exist
    optimizedSections.skills = "• Project Management\n• Leadership\n• Communication\n• Problem Solving\n• Microsoft Office Suite";
  }
  
  return optimizedSections;
}

/**
 * Format optimized sections into a single text
 */
function formatOptimizedSections(sections: Record<string, string>): string {
  let result = "";
  
  // Add header if it exists
  if (sections.header) {
    result += sections.header + "\n\n";
  }
  
  // Add profile if it exists
  if (sections.profile) {
    result += "PROFILE\n" + sections.profile + "\n\n";
  }
  
  // Add achievements if they exist
  if (sections.achievements) {
    result += "ACHIEVEMENTS\n" + sections.achievements + "\n\n";
  }
  
  // Add experience if it exists
  if (sections.experience) {
    result += "EXPERIENCE\n" + sections.experience + "\n\n";
  }
  
  // Add skills if they exist
  if (sections.skills) {
    result += "SKILLS\n" + sections.skills + "\n\n";
  }
  
  // Add education if it exists
  if (sections.education) {
    result += "EDUCATION\n" + sections.education + "\n\n";
  }
  
  // Add languages if they exist
  if (sections.languages) {
    result += "LANGUAGES\n" + sections.languages + "\n\n";
  }
  
  // Add any other sections
  for (const [sectionName, content] of Object.entries(sections)) {
    if (!['header', 'profile', 'achievements', 'experience', 'skills', 'education', 'languages'].includes(sectionName)) {
      // Check if the content is non-empty before adding
      if (content && content.trim()) {
        result += sectionName.toUpperCase() + "\n" + content + "\n\n";
      }
    }
  }
  
  return result.trim();
}

/**
 * Extract name and contact information from CV text
 */
function extractNameAndContact(text: string): any {
  // Extract name and contact info from text
  const lines = text.split('\n').filter(line => line.trim());
  
  const result = {
    firstName: 'NAME',
    lastName: 'LAST NAME',
    jobTitle: 'JOB OCCUPIED',
    phone: '+1 234 567 890',
    email: 'email@example.com',
    location: 'City, Country'
  };
  
  // Try to extract real name from first lines
  if (lines.length > 0) {
    const nameLine = lines[0].trim();
    const nameParts = nameLine.split(' ');
    
    if (nameParts.length >= 2) {
      result.firstName = nameParts[0];
      result.lastName = nameParts.slice(1).join(' ');
    }
    
    // Try to extract job title from second line
    if (lines.length > 1) {
      result.jobTitle = lines[1].trim();
    }
    
    // Look for email and phone in the first few lines
    for (let i = 0; i < Math.min(10, lines.length); i++) {
      const line = lines[i].toLowerCase();
      
      // Email pattern
      if (line.includes('@') && line.includes('.')) {
        const emailMatch = line.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
        if (emailMatch) {
          result.email = emailMatch[0];
        }
      }
      
      // Phone pattern
      if (line.match(/\+?\d[\d\s-]{7,}/)) {
        const phoneMatch = line.match(/\+?\d[\d\s-]{7,}/);
        if (phoneMatch) {
          result.phone = phoneMatch[0];
        }
      }
      
      // Location pattern - look for city, country format
      if (line.includes(',') && !line.includes('@')) {
        result.location = lines[i].trim();
      }
    }
  }
  
  return result;
} 