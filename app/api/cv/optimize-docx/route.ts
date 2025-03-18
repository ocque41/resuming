import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/lib/db/drizzle';
import { cvs, users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getDropboxClient } from '@/lib/dropboxAdmin';
import { DocumentGenerator } from '@/lib/utils/documentGenerator';
import { Document, Paragraph, HeadingLevel, Packer } from 'docx';

// Define types
interface User {
  id: string;
  name?: string;
  email?: string;
}

/**
 * Save file to Dropbox and return a shareable link
 */
async function saveFileToDropbox(buffer: Buffer, path: string): Promise<string | null> {
  try {
    const dbx = getDropboxClient();
    
    // Upload the file
    await dbx.filesUpload({
      path: path,
      contents: buffer,
      mode: { ".tag": "overwrite" }
    });
    
    console.log(`File uploaded to Dropbox at: ${path}`);
    
    // Create a shared link
    const sharedLinkResponse = await dbx.sharingCreateSharedLinkWithSettings({
      path: path,
      settings: {
        requested_visibility: { ".tag": "public" }
      }
    });
    
    console.log('Created shared link for file');
    return sharedLinkResponse.result.url;
  } catch (error) {
    console.error('Error in saveFileToDropbox:', error);
    return null;
  }
}

/**
 * Get CV by ID from the database
 */
async function getCvById(cvId: string): Promise<any | null> {
  const id = parseInt(cvId, 10);
  if (isNaN(id)) {
    return null;
  }
  
  try {
    return await db.query.cvs.findFirst({
      where: eq(cvs.id, id)
    });
  } catch (error) {
    console.error(`Error retrieving CV with ID ${id}:`, error);
    return null;
  }
}

/**
 * Get user by email from the database
 */
async function getUserByEmail(email: string): Promise<any | null> {
  if (!email) {
    return null;
  }
  
  try {
    const user = await db.query.users.findFirst({
      where: eq(users.email, email)
    });
    return user;
  } catch (error) {
    console.error(`Error retrieving user with email ${email}:`, error);
    return null;
  }
}

/**
 * Update the metadata for a CV
 */
async function updateMetadata(updates: { cvId: number; [key: string]: any }): Promise<void> {
  const { cvId, ...otherUpdates } = updates;
  if (isNaN(cvId)) {
    console.error(`Invalid CV ID: ${cvId}`);
    return;
  }
  
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
    
    for (const [key, value] of Object.entries(otherUpdates)) {
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
 * API endpoint to optimize a CV using the new DOCX-based workflow
 */
export async function POST(req: Request) {
  try {
    const session = await auth();
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const user = await getUserByEmail(session.user.email);
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const requestData = await req.json();
    const { cvId, optimizedText, template } = requestData;
    
    if (!cvId) {
      return NextResponse.json({ error: 'CV ID is required' }, { status: 400 });
    }
    
    if (!optimizedText) {
      return NextResponse.json({ error: 'Optimized text is required' }, { status: 400 });
    }
    
    // Get the CV data
    const cv = await getCvById(cvId);
    
    if (!cv) {
      return NextResponse.json({ error: 'CV not found' }, { status: 404 });
    }
    
    // Check if the CV belongs to the user
    if (cv.userId !== user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Get the analysis data
    const analysisResult = cv.analysisResult;
    
    if (!analysisResult) {
      return NextResponse.json({ error: 'CV has not been analyzed yet' }, { status: 400 });
    }
    
    // Validate template value
    const validTemplates = ['professional', 'modern', 'minimal', 'creative'];
    const selectedTemplate = validTemplates.includes(template) ? template : 'professional';
    
    // Update metadata
    await updateMetadata({
      cvId: parseInt(cvId),
      userId: user.id,
      optimizedDocStatus: 'processing',
      optimizedDocTimestamp: new Date().toISOString(),
      optimizedDocTemplate: selectedTemplate
    });
    
    // Create parameters
    const options = {
      name: cv.name || 'Optimized CV',
      originalAtsScore: analysisResult.atsScore,
      improvedAtsScore: analysisResult.improvedAtsScore,
      industry: analysisResult.industry || 'General',
      template: selectedTemplate
    };
    
    // Start processing in the background
    void startBackgroundProcess(user.id, cvId, optimizedText, analysisResult, options);
    
    return NextResponse.json({
      success: true,
      message: 'DOCX generation started',
      template: selectedTemplate,
      status: 'processing'
    });
  } catch (error) {
    console.error('Error in optimize-docx route:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error occurred' },
      { status: 500 }
    );
  }
}

/**
 * Start the background optimization process
 */
async function startBackgroundProcess(userId: string, cvId: string, optimizedText: string, optimizedAnalysisResult: any, options: any = {}) {
  const existingAnalysis = optimizedAnalysisResult;

  try {
    console.log(`Starting background process to generate DOCX for CV ${cvId}`);
    
    // Add diagnostic logging for the input
    console.log(`Text length: ${optimizedText?.length || 0} characters`);
    console.log(`Using template: ${options.template || 'professional'}`);
    
    // Prepare document generation parameters with safe defaults
    const docGenParams: any = {
      title: options.name || 'Optimized CV',
      atsScore: typeof existingAnalysis?.atsScore === 'number' ? existingAnalysis.atsScore : 0,
      improvedAtsScore: typeof existingAnalysis?.improvedAtsScore === 'number' ? existingAnalysis.improvedAtsScore : 0,
      industry: typeof existingAnalysis?.industry === 'string' ? existingAnalysis.industry : 'General',
      template: typeof options.template === 'string' ? options.template : 'professional',
      improvements: Array.isArray(existingAnalysis?.improvements) 
        ? existingAnalysis.improvements.filter((imp: any) => typeof imp === 'string')
        : []
    };

    // Extract experience entries for structured CV format if available
    if (existingAnalysis?.experienceEntries && Array.isArray(existingAnalysis.experienceEntries)) {
      // Format experience entries for document generator
      docGenParams.experienceEntries = existingAnalysis.experienceEntries
        .filter((entry: any) => typeof entry === 'object' && entry !== null)
        .map((entry: any) => {
          return {
            jobTitle: typeof entry.jobTitle === 'string' ? entry.jobTitle : "",
            company: typeof entry.company === 'string' ? entry.company : "",
            dateRange: typeof entry.dateRange === 'string' ? entry.dateRange : "",
            location: typeof entry.location === 'string' ? entry.location : "",
            responsibilities: Array.isArray(entry.responsibilities) 
              ? entry.responsibilities.filter((resp: any) => typeof resp === 'string' && resp.trim())
              : []
          };
        })
        .filter((entry: any) => entry.jobTitle && entry.company);
      
      console.log(`Prepared ${docGenParams.experienceEntries.length} structured experience entries`);
    }
    
    // Sanitize the CV text to remove problematic characters
    const sanitizedText = optimizedText
      .replace(/[^\x20-\x7E\r\n\t]/g, '') // Remove all non-ASCII and control characters
      .replace(/\u2028/g, '\n') // Replace line separator with newline
      .replace(/\u2029/g, '\n\n') // Replace paragraph separator with double newline
      .replace(/[\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]/g, ' ') // Replace special space characters
      .replace(/\n{3,}/g, '\n\n') // Replace excessive newlines
      .substr(0, 30000); // Limit text size to prevent memory issues
      
    console.log(`Sanitized text: ${sanitizedText.length} characters`);
    
    // Generate the DOCX document
    console.log(`Generating DOCX document for CV ${cvId} with template: ${docGenParams.template}`);
    let docBuffer: Buffer;
    
    try {
      // Try to generate the document with all parameters
      docBuffer = await DocumentGenerator.generateDocx(sanitizedText, docGenParams);
      
      // Verify the buffer is valid and has a reasonable size
      if (!Buffer.isBuffer(docBuffer) || docBuffer.length === 0) {
        throw new Error('Generated an empty document buffer');
      }
      
      console.log(`Successfully generated DOCX document of ${docBuffer.length} bytes`);
      
      // If document is suspiciously small, retry with minimal parameters
      if (docBuffer.length < 1000) {
        console.warn('Document size suspiciously small, retrying with minimal parameters');
        docBuffer = await DocumentGenerator.generateDocx(sanitizedText, { 
          title: 'Optimized CV',
          template: 'minimal'
        });
        
        if (!Buffer.isBuffer(docBuffer) || docBuffer.length === 0) {
          throw new Error('Failed to generate document even with minimal parameters');
        }
        
        console.log(`Retry successful, generated DOCX of ${docBuffer.length} bytes`);
      }
    } catch (docError) {
      console.error('Error generating DOCX document:', docError);
      
      // Log data about the error
      console.error(`Error type: ${docError instanceof Error ? docError.constructor.name : typeof docError}`);
      if (docError instanceof Error && docError.stack) {
        console.error(`Stack trace: ${docError.stack}`);
      }
      
      // Fallback to most simple document generation possible
      console.log('Attempting fallback document generation with bare minimum formatting');
      
      try {
        // Create a minimal text-only document with extremely simplified formatting
        const simplifiedText = sanitizedText
          .replace(/[^\x20-\x7E\n]/g, '') // Even more aggressive filtering - ASCII only
          .replace(/\n{2,}/g, '\n\n'); // Normalize line breaks
        
        // Create the document with absolute minimal styling
        const doc = new Document({
          sections: [{
            properties: {},
            children: [
              new Paragraph({
                text: "Optimized CV",
                heading: HeadingLevel.HEADING_1
              }),
              new Paragraph({
                text: simplifiedText.substring(0, 15000) // Limit length further
              })
            ]
          }]
        });
        
        docBuffer = await Packer.toBuffer(doc);
        
        if (!Buffer.isBuffer(docBuffer) || docBuffer.length === 0) {
          throw new Error('Failed to generate even simple fallback document');
        }
        
        console.log(`Generated simplified fallback document of ${docBuffer.length} bytes`);
      } catch (fallbackError) {
        console.error('Fatal error generating document:', fallbackError);
        
        // Update metadata to show failure
        await updateMetadata({ 
          cvId: parseInt(cvId), 
          userId, 
          optimizedDocStatus: 'failed',
          optimizedDocError: 'Document generation failed due to technical issues'
        });
        
        return;
      }
    }

    // Get the file path where we will save the file
    const fileName = `${cvId}_optimized_${Date.now()}.docx`;
    console.log('Saving optimized CV to Dropbox:', fileName);

    try {
      // Save to Dropbox
      const dropboxPath = `/optimized/${fileName}`;
      const dropboxLink = await saveFileToDropbox(docBuffer, dropboxPath);
      
      if (!dropboxLink) {
        throw new Error('Failed to get shareable link from Dropbox');
      }
      
      console.log(`Successfully saved document to Dropbox: ${dropboxPath}`);

      // Update the CV metadata with the Dropbox link
      await updateMetadata({ 
        cvId: parseInt(cvId), 
        userId, 
        docxBase64: docBuffer.toString('base64'),
        dropboxLink,
        optimizedDocxPath: dropboxPath,
        optimizedText,
        // Only include valid metadata properties to prevent serialization issues
        atsScore: docGenParams.atsScore,
        improvedAtsScore: docGenParams.improvedAtsScore,
        industry: docGenParams.industry,
        template: docGenParams.template,
        improvements: docGenParams.improvements,
        optimizedDocStatus: 'completed',
        optimizedDocTimestamp: new Date().toISOString()
      });

      console.log(`Completed optimization process for CV ${cvId}`);
    } catch (saveError) {
      console.error('Error saving document to Dropbox:', saveError);
      
      // Update metadata to show failure but include the base64 data for direct download
      await updateMetadata({ 
        cvId: parseInt(cvId), 
        userId, 
        docxBase64: docBuffer.toString('base64'),
        optimizedDocStatus: 'completed_local', // Completed but only local download available
        optimizedDocTimestamp: new Date().toISOString(),
        optimizedDocError: 'Document saved locally but Dropbox upload failed'
      });
    }
  } catch (error) {
    console.error(`Background process error for CV ${cvId}:`, error);
    // Here you would update the CV status to reflect the error
    await updateMetadata({ 
      cvId: parseInt(cvId), 
      userId, 
      optimizedDocStatus: 'failed',
      optimizedDocError: error instanceof Error ? error.message : 'Unknown error during CV optimization'
    });
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