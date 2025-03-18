import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/lib/db/drizzle';
import { cvs, users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getDropboxClient } from '@/lib/dropboxAdmin';
import { DocumentGenerator } from '@/lib/utils/documentGenerator';

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
async function updateMetadata(cvId: string, updates: Record<string, any>): Promise<void> {
  const id = parseInt(cvId, 10);
  if (isNaN(id)) {
    console.error(`Invalid CV ID: ${cvId}`);
    return;
  }
  
  try {
    const cvRecord = await db.query.cvs.findFirst({
      where: eq(cvs.id, id)
    });
    
    if (!cvRecord) {
      console.error(`CV not found for ID: ${id}`);
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
      console.error(`Failed to serialize metadata for CV ${id}:`, jsonError);
      throw new Error('Unable to serialize metadata');
    }
    
    // Update the database
    await db.update(cvs)
      .set({
        metadata: JSON.stringify(updatedMetadata)
      })
      .where(eq(cvs.id, id));
      
    console.log(`Updated metadata for CV ${id}:`, Object.keys(sanitizedUpdates));
  } catch (error) {
    console.error(`Failed to update metadata for CV ${id}:`, error);
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
    await updateMetadata(cvId, {
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
  let docGenParams: any = {
    author: options.name || "CV Optimizer User",
    title: `${options.name || 'Optimized'} - CV`,
    description: "ATS Optimized CV from CV Optimizer",
    atsScore: options.originalAtsScore || existingAnalysis?.atsScore || 0,
    improvedAtsScore: options.improvedAtsScore || existingAnalysis?.improvedAtsScore || 0,
    industry: options.industry || "General",
    template: options.template || "professional" // Using the template system
  };

  // Process improvements made to the CV
  const recommendations = existingAnalysis?.recommendations || [];
  if (Array.isArray(recommendations) && recommendations.length > 0) {
    docGenParams.improvements = recommendations
      .filter(rec => typeof rec === 'string' && rec.trim())
      .slice(0, 5); // Limit to top 5 to avoid overloading the document
  }

  try {
    // Extract experience entries for structured CV format
    if (existingAnalysis?.experienceEntries && Array.isArray(existingAnalysis.experienceEntries)) {
      // Format experience entries for document generator
      docGenParams.experienceEntries = existingAnalysis.experienceEntries.map((entry: any) => {
        return {
          jobTitle: entry.jobTitle || "",
          company: entry.company || "",
          dateRange: entry.dateRange || "",
          location: entry.location || "",
          responsibilities: Array.isArray(entry.responsibilities) 
            ? entry.responsibilities.filter((resp: any) => typeof resp === 'string' && resp.trim())
            : []
        };
      }).filter((entry: any) => entry.jobTitle && entry.company);
    }
    
    console.log(`Generating DOCX document for CV ${cvId} with template: ${docGenParams.template}`);
    let docBuffer: Buffer;
    
    try {
      // Try to generate the document with all parameters
      docBuffer = await DocumentGenerator.generateDocx(optimizedText, docGenParams);
      
      // Verify the buffer is valid and has a reasonable size
      if (!Buffer.isBuffer(docBuffer) || docBuffer.length === 0) {
        throw new Error('Generated an empty document buffer');
      }
      
      console.log(`Successfully generated DOCX document of ${docBuffer.length} bytes`);
      
      // If document is suspiciously small, retry with minimal parameters
      if (docBuffer.length < 1000) {
        console.warn('Document size suspiciously small, retrying with minimal parameters');
        docBuffer = await DocumentGenerator.generateDocx(optimizedText, { 
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
      // Fallback to most simple document generation possible
      console.log('Attempting fallback document generation');
      docBuffer = await DocumentGenerator.generateDocx(optimizedText, { 
        title: 'Optimized CV',
        template: 'minimal'
      });
      
      if (!Buffer.isBuffer(docBuffer) || docBuffer.length === 0) {
        throw new Error('Failed to generate document even with fallback approach');
      }
    }

    // Get the file path where we will save the file
    const fileName = `${cvId}_optimized_${Date.now()}.docx`;
    console.log('Saving optimized CV to Dropbox:', fileName);

    // Save to Dropbox
    const dropboxPath = `/optimized/${fileName}`;
    const dropboxLink = await saveFileToDropbox(docBuffer, dropboxPath);

    if (!dropboxLink) {
      throw new Error('Failed to get shareable link from Dropbox');
    }

    console.log('File saved to Dropbox successfully:', dropboxPath);

    // Create a record in the database
    const docMetadata = {
      userId,
      cvId, 
      fileName,
      fileType: 'docx',
      filePath: dropboxPath,
      downloadUrl: dropboxLink,
      status: 'completed',
      meta: {
        template: docGenParams.template,
        industry: docGenParams.industry,
        atsScore: docGenParams.atsScore,
        improvedAtsScore: docGenParams.improvedAtsScore,
        timestamp: new Date().toISOString()
      }
    };

    // Update the document in the database
    await updateMetadata(cvId, {
      optimizedDocUrl: dropboxLink,
      optimizedDocStatus: 'completed',
      optimizedDocFilePath: dropboxPath,
      optimizedDocTimestamp: new Date().toISOString(),
      optimizedDocTemplate: docGenParams.template
    });

    console.log('Document metadata updated in database');
    return {
      success: true,
      fileUrl: dropboxLink,
      filePath: dropboxPath,
      fileName: fileName,
      template: docGenParams.template
    };
  } catch (error) {
    console.error('Error in background process:', error);
    
    // Update the metadata to show the failure
    await updateMetadata(cvId, {
      optimizedDocStatus: 'failed',
      optimizedDocError: error instanceof Error ? error.message : String(error),
      optimizedDocTimestamp: new Date().toISOString()
    });
    
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
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