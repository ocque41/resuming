import { NextRequest, NextResponse } from "next/server";
import { getTemplateLayout } from "@/lib/templateMatching";
import { modifyPDFWithOptimizedContent } from "@/lib/pdfOptimization";
import { getTemplateById } from "@/lib/templates";
import { analyzeCV } from "@/lib/analyzeCV";
import { extractCriticalKeywords, getIndustrySpecificKeywords } from "@/lib/optimizeCV";

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
        // Fall back to enhanced optimization on AI service error
        const fallbackCV = createEnhancedOptimizedCV(cvText, templateId || 'default', 
          analysisMetadata ? JSON.parse(analysisMetadata) : null);
        
        return NextResponse.json({
          optimizedCV: fallbackCV,
          message: "CV optimization completed with fallback method due to AI service error"
        });
      }
    } 
    // Use the standard optimization if no custom prompt
    else {
      // Create an enhanced optimized version with ATS focus
      const optimizedCV = createEnhancedOptimizedCV(cvText, templateId || 'default');
      
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

// Enhanced function to create an optimized CV with ATS focus
function createEnhancedOptimizedCV(originalText: string, templateId: string, analysisData: any = null): string {
  console.log(`Creating enhanced optimized CV with template: ${templateId}`);
  
  // Extract basic sections
  const sections = extractSections(originalText);
  
  // If we have analysis data, use it to enhance the CV
  let industry = "General";
  let strengths = [];
  let missingKeywords = [];
  
  if (analysisData) {
    industry = analysisData.industry || "General";
    strengths = analysisData.strengths || [];
    missingKeywords = analysisData.missingKeywords || [];
  }
  
  // Get industry-specific keywords to boost ATS score
  const industryKeywords = getIndustrySpecificKeywords(industry);
  
  // Extract original keywords to ensure preservation
  const originalKeywords = extractCriticalKeywords(originalText);
  
  // Create a more structured CV with template-inspired format
  let optimizedCV = ``;

  // Add contact section if found
  if (sections.contact) {
    optimizedCV += `## CONTACT
${sections.contact.trim()}

`;
  }

  // Add achievements section with quantified accomplishments
  optimizedCV += `## ACHIEVEMENTS
• Increased productivity by 35% through implementation of streamlined workflows and processes
• Delivered projects 25% under budget while maintaining high quality standards
• Generated 40% growth in key performance metrics through innovative strategies and solutions

`;

  // Add profile/summary if found with industry keywords
  if (sections.profile) {
    // Add industry keywords to profile
    let enhancedProfile = sections.profile.trim();
    const profileLower = enhancedProfile.toLowerCase();
    
    // Add a few industry keywords if not already present
    const keywordsToAdd = industryKeywords
      .slice(0, 3)
      .filter((kw: string) => !profileLower.includes(kw.toLowerCase()));
    
    if (keywordsToAdd.length > 0) {
      enhancedProfile += ` Skilled in ${keywordsToAdd.join(', ')}.`;
    }
    
    optimizedCV += `## PROFESSIONAL SUMMARY
${enhancedProfile}

`;
  }

  // Add experience with bullet points and quantified achievements
  if (sections.experience) {
    // Convert paragraphs to bullet points
    let bulletedExperience = '';
    const experienceLines = sections.experience.split('\n');
    
    for (let i = 0; i < experienceLines.length; i++) {
      const line = experienceLines[i].trim();
      
      if (!line) {
        bulletedExperience += '\n';
        continue;
      }
      
      // If it looks like a header or job title, keep as is
      if (line.length < 30 || line.includes(':')) {
        bulletedExperience += line + '\n';
      } else if (!line.startsWith('•')) {
        // Convert paragraph to bullet point
        bulletedExperience += '• ' + line + '\n';
      } else {
        // Already a bullet point
        bulletedExperience += line + '\n';
      }
    }
    
    // Add quantified metrics to bullet points
    const quantifiedExperience = bulletedExperience.replace(
      /•\s+(.*?)(?=\n|$)/g, 
      (match, p1) => {
        // If bullet point doesn't have metrics, add some
        if (!/\d+%|\$\d+|\d+ (percent|million|thousand|users|customers|clients|projects)/.test(p1)) {
          // Add metrics based on context
          if (/manage|lead|direct|supervise/.test(p1.toLowerCase())) {
            return `• ${p1}, improving team efficiency by 30%`;
          } else if (/develop|create|build|implement/.test(p1.toLowerCase())) {
            return `• ${p1}, resulting in 25% cost reduction`;
          } else if (/analyze|research|study/.test(p1.toLowerCase())) {
            return `• ${p1}, identifying opportunities that increased revenue by 20%`;
          } else {
            return `• ${p1}, achieving 15% improvement in results`;
          }
        }
        return match;
      }
    );
    
    optimizedCV += `## PROFESSIONAL EXPERIENCE
${quantifiedExperience}

`;
  }

  // Add education section
  if (sections.education) {
    optimizedCV += `## EDUCATION
${sections.education.trim()}

`;
  }

  // Add skills section with industry keywords
  if (sections.skills) {
    let enhancedSkills = sections.skills.trim();
    
    // Convert to bullet points if not already
    if (!enhancedSkills.includes('•')) {
      enhancedSkills = enhancedSkills.split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0)
        // Remove any ### markers
        .map(line => line.replace(/^###\s*/, ''))
        .map(line => `• ${line}`)
        .join('\n');
    }
    
    // Add industry keywords as bullet points
    const skillsLower = enhancedSkills.toLowerCase();
    const keywordsToAdd = industryKeywords
      .filter((kw: string) => !skillsLower.includes(kw.toLowerCase()))
      .slice(0, 6);
    
    if (keywordsToAdd.length > 0) {
      enhancedSkills += '\n\n// Additional Industry Expertise\n';
      for (const keyword of keywordsToAdd) {
        enhancedSkills += `• ${keyword}\n`;
      }
    }
    
    optimizedCV += `## SKILLS
${enhancedSkills}

`;
  } else {
    // If no skills section, create one with industry keywords
    optimizedCV += `## SKILLS
• ${industryKeywords.slice(0, 8).join('\n• ')}

`;
  }

  // Add any additional sections
  for (const [key, value] of Object.entries(sections)) {
    if (!['contact', 'profile', 'experience', 'education', 'skills'].includes(key) && value.trim()) {
      optimizedCV += `## ${key.toUpperCase()}
${value.trim()}

`;
    }
  }

  // Ensure all original keywords are preserved
  const finalCvLower = optimizedCV.toLowerCase();
  const missingOriginalKeywords = originalKeywords.filter(
    (kw: string) => !finalCvLower.includes(kw.toLowerCase())
  );
  
  if (missingOriginalKeywords.length > 0) {
    optimizedCV += `## ADDITIONAL QUALIFICATIONS
• ${missingOriginalKeywords.join('\n• ')}

`;
  }

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