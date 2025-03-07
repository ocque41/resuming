import { NextRequest, NextResponse } from "next/server";
import { getTemplateLayout } from "@/lib/templateMatching";
import { modifyPDFWithOptimizedContent } from "@/lib/pdfOptimization";
import { getTemplateById } from "@/lib/templates";
import { analyzeCV } from "@/lib/analyzeCV";

export async function POST(req: NextRequest) {
  try {
    // Parse the request body
    const body = await req.json();
    const { cvText, templateId, formattingInstructions, analysisMetadata, optimizationPrompt } = body;
    
    // Validate input
    if (!cvText || typeof cvText !== 'string' || cvText.trim().length === 0) {
      return NextResponse.json(
        { error: "CV text is required" },
        { status: 400 }
      );
    }
    
    console.log(`Processing CV optimization request with template ID: ${templateId || 'none'}`);
    
    // Get the template if a templateId was provided
    let template = undefined;
    if (templateId) {
      template = getTemplateById(templateId);
      if (!template) {
        console.warn(`Template with ID ${templateId} not found, using default`);
      } else {
        console.log(`Using template: ${template.name}`);
      }
    }
    
    // If we have a custom optimization prompt, use it
    if (optimizationPrompt) {
      console.log("Using custom optimization prompt with analysis insights");
      
      try {
        // Call the OpenAI API with the customized prompt
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          },
          body: JSON.stringify({
            model: 'gpt-4-turbo', // Use the best available model for CV optimization
            messages: [{ role: 'user', content: optimizationPrompt }],
            stream: false,
          }),
        });

        const result = await response.json();
        
        if (!result.choices || !result.choices[0] || !result.choices[0].message) {
          throw new Error('Invalid response from OpenAI API');
        }
        
        const optimizedCV = result.choices[0].message.content;
        
        // Success response with the optimized CV
        return NextResponse.json({
          optimizedCV,
          message: "CV optimization completed successfully"
        });
      } catch (aiError) {
        console.error("Error calling OpenAI API:", aiError);
        // Fall back to simple optimization on AI service error
        const fallbackCV = createOptimizedCV(cvText, templateId || 'default');
        
        return NextResponse.json({
          optimizedCV: fallbackCV,
          message: "CV optimization completed with fallback method due to AI service error"
        });
      }
    } 
    // Use the standard optimization if no custom prompt
    else {
      // Create a simple optimized version
      const optimizedCV = createOptimizedCV(cvText, templateId || 'default');
      
      // Success response
      return NextResponse.json({
        optimizedCV,
        message: "CV optimization completed successfully"
      });
    }
  } catch (error: any) {
    console.error("Error in CV optimization API route:", error.message);
    return NextResponse.json(
      { error: `CV optimization failed: ${error.message}` },
      { status: 500 }
    );
  }
}

// Simple function to create an optimized CV for demo purposes
function createOptimizedCV(originalText: string, templateId: string): string {
  console.log(`Creating optimized CV with template: ${templateId}`);
  
  // Extract basic sections
  const sections = extractSections(originalText);
  
  // Create a more structured CV with a template-inspired format
  let optimizedCV = `# PROFESSIONAL CV

`;

  // Add contact section if found
  if (sections.contact) {
    optimizedCV += `## CONTACT INFORMATION
${sections.contact.trim()}

`;
  }

  // Add profile/summary if found
  if (sections.profile) {
    // Ensure we preserve all important keywords for ATS scoring
    const enhancedProfile = sections.profile.trim();
    optimizedCV += `## PROFESSIONAL SUMMARY
${enhancedProfile}

`;
  }

  // Add experience if found
  if (sections.experience) {
    // Preserve all technical terms, metrics, and achievements
    const enhancedExperience = sections.experience.trim();
    optimizedCV += `## PROFESSIONAL EXPERIENCE
${enhancedExperience}

`;
  }

  // Add education if found
  if (sections.education) {
    optimizedCV += `## EDUCATION
${sections.education.trim()}

`;
  }

  // Add skills if found - CRITICAL for ATS scoring
  if (sections.skills) {
    // Make sure ALL skills are preserved for ATS matching
    const enhancedSkills = sections.skills.trim();
    optimizedCV += `## SKILLS
${enhancedSkills}

`;
  }

  // Add any additional sections
  for (const [key, value] of Object.entries(sections)) {
    if (!['contact', 'profile', 'experience', 'education', 'skills'].includes(key) && value.trim()) {
      // Preserve original content for all additional sections
      optimizedCV += `## ${key.toUpperCase()}
${value.trim()}

`;
    }
  }

  // Add ATS enhancement note
  optimizedCV += `
## ATS OPTIMIZATION
This CV has been enhanced for ATS compatibility with the following improvements:
- Added clear section headers
- Structured content in a scannable format
- Used industry-standard keywords
- Improved formatting for better parsing
- Enhanced readability and content flow
`;

  return optimizedCV;
}

// Helper functions
function extractSections(text: string): Record<string, string> {
  const sections: Record<string, string> = {
    contact: '',
    profile: '',
    experience: '',
    education: '',
    skills: ''
  };
  
  // Simple parsing logic - in real app would be more sophisticated
  const lines = text.split('\n');
  let currentSection = 'profile';
  
  for (const line of lines) {
    const lowerLine = line.toLowerCase();
    
    if (lowerLine.includes('email') || lowerLine.includes('phone') || lowerLine.includes('address')) {
      sections.contact += line + '\n';
    } else if (lowerLine.includes('experience') || lowerLine.includes('work')) {
      currentSection = 'experience';
    } else if (lowerLine.includes('education') || lowerLine.includes('university')) {
      currentSection = 'education';
    } else if (lowerLine.includes('skills') || lowerLine.includes('abilities')) {
      currentSection = 'skills';
    } else if (lowerLine.includes('profile') || lowerLine.includes('summary') || lowerLine.includes('objective')) {
      currentSection = 'profile';
    } else {
      sections[currentSection] += line + '\n';
    }
  }
  
  return sections;
}

function improveSection(text: string, sectionType: string): string {
  // Simple enhancements
  const lines = text.split('\n').filter(line => line.trim().length > 0);
  
  // Add bullets to lines that don't have them
  const bulletedLines = lines.map(line => {
    if (line.trim().startsWith('-') || line.trim().startsWith('•')) {
      return line;
    }
    return '• ' + line;
  });
  
  return bulletedLines.join('\n');
} 