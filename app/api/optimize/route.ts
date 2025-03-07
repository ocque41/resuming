import { NextRequest, NextResponse } from "next/server";
import { getTemplateLayout } from "@/lib/templateMatching";
import { modifyPDFWithOptimizedContent } from "@/lib/pdfOptimization";
import { getTemplateById } from "@/lib/templates";
import { analyzeCV } from "@/lib/analyzeCV";
import { 
  extractCriticalKeywords, 
  getIndustrySpecificKeywords, 
  analyzeCVContent, 
  verifyContentPreservation 
} from "@/lib/optimizeCV";

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
    
    // Analyze the CV to identify strengths and weaknesses
    const analysisResults = analyzeCVContent(cvText);
    console.log(`CV Analysis completed: ${analysisResults.strengths.length} strengths, ${analysisResults.weaknesses.length} weaknesses identified`);
    
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
        
        // Verify content preservation
        const verification = verifyContentPreservation(cvText, optimizedCV);
        
        if (!verification.preserved) {
          console.warn(`AI optimization failed content preservation check. Score: ${verification.keywordScore}%. Using enhanced fallback.`);
          // Fall back to enhanced optimization
          const fallbackCV = createEnhancedOptimizedCV(cvText, templateId || 'default', analysisResults);
          
          return NextResponse.json({
            optimizedCV: fallbackCV,
            message: "CV optimization completed with enhanced fallback due to content preservation failure",
            analysis: analysisResults
          });
        }
        
        // Success response with the optimized CV
        return NextResponse.json({
          optimizedCV,
          message: "CV optimization completed successfully",
          analysis: analysisResults
        });
      } catch (aiError) {
        console.error("Error calling OpenAI API:", aiError);
        // Fall back to enhanced optimization on AI service error
        const fallbackCV = createEnhancedOptimizedCV(cvText, templateId || 'default', analysisResults);
        
        return NextResponse.json({
          optimizedCV: fallbackCV,
          message: "CV optimization completed with fallback method due to AI service error",
          analysis: analysisResults
        });
      }
    } 
    // Use the standard optimization if no custom prompt
    else {
      // Create an enhanced optimized version with ATS focus
      const optimizedCV = createEnhancedOptimizedCV(cvText, templateId || 'default', analysisResults);
      
      // Success response
      return NextResponse.json({
        optimizedCV,
        message: "CV optimization completed successfully",
        analysis: analysisResults
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
  let weaknesses = [];
  let improvementSuggestions = {};
  
  if (analysisData) {
    industry = analysisData.detectedIndustry || "General";
    strengths = analysisData.strengths || [];
    weaknesses = analysisData.weaknesses || [];
    improvementSuggestions = analysisData.improvementSuggestions || {};
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

  // First, extract any existing achievements from the original CV
  let achievementsContent = sections.achievements || '';
  
  // If there are no achievements or they're limited, generate some based on experience
  if (!achievementsContent || achievementsContent.length < 100) {
    // Extract quantified achievements from experience section
    const experienceText = sections.experience || '';
    const quantifiedPattern = /\b(\d+%|\d+\s*percent|\$\d+|\d+\s*million|\d+\s*billion|\d+\s*users|\d+\s*customers|\d+\s*clients|\d+\s*projects|\d+\s*times|\d+\s*days|\d+\s*months|\d+\s*years)\b/gi;
    
    // Find sentences with quantified achievements
    const sentences = experienceText.split(/[.!?]+/);
    const quantifiedSentences = sentences.filter(sentence => 
      quantifiedPattern.test(sentence) || 
      /\b(increased|decreased|improved|reduced|saved|generated|delivered|achieved)\b/i.test(sentence)
    );
    
    // If we found quantified sentences, use them as achievements
    if (quantifiedSentences.length > 0) {
      achievementsContent = quantifiedSentences
        .map(sentence => sentence.trim())
        .filter(sentence => sentence.length > 10)
        .map(sentence => `• ${sentence}`)
        .join('\n');
    }
    
    // If we still don't have achievements, generate some based on the industry
    if (!achievementsContent || achievementsContent.length < 100) {
      achievementsContent = `• Increased ${industry} productivity by 35% through implementation of streamlined workflows and processes
• Delivered projects 25% under budget while maintaining high quality standards
• Generated 40% growth in key performance metrics through innovative strategies and solutions`;
    }
  }
  
  // Add achievements section with quantified accomplishments
  optimizedCV += `## ACHIEVEMENTS
${achievementsContent}

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
        .map(line => {
          // Limit line length to prevent overflow
          if (line.length > 50) {
            return `• ${line.substring(0, 50)}...`;
          }
          return `• ${line}`;
        })
        .join('\n');
    }
    
    // Add industry keywords as bullet points
    const skillsLower = enhancedSkills.toLowerCase();
    const keywordsToAdd = industryKeywords
      .filter((kw: string) => !skillsLower.includes(kw.toLowerCase()))
      .slice(0, 4); // Limit to fewer keywords to prevent overflow
    
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
• ${industryKeywords.slice(0, 6).join('\n• ')}

`;
  }

  // Add languages section if present
  if (sections.languages) {
    optimizedCV += `## LANGUAGES
${sections.languages.trim()}

`;
  }

  // Add projects section if present
  if (sections.projects) {
    optimizedCV += `## PROJECTS
${sections.projects.trim()}

`;
  }

  // Add certifications section if present
  if (sections.certifications) {
    optimizedCV += `## CERTIFICATIONS
${sections.certifications.trim()}

`;
  }

  // Add any additional sections
  for (const [key, value] of Object.entries(sections)) {
    if (!['contact', 'profile', 'experience', 'education', 'skills', 'languages', 'projects', 'certifications', 'achievements'].includes(key) && value.trim()) {
      optimizedCV += `## ${key.toUpperCase()}
${value.trim()}

`;
    }
  }

  // Verify content preservation
  const verification = verifyContentPreservation(originalText, optimizedCV);
  
  if (!verification.preserved) {
    console.warn(`Content preservation check failed. Score: ${verification.keywordScore}%. Adding missing keywords.`);
    
    // Add missing keywords in a way that preserves the CV structure
    if (verification.missingItems.length > 0) {
      // Try to add missing keywords to the skills section
      if (optimizedCV.includes('## SKILLS')) {
        // Find the skills section and add missing keywords
        const skillsPattern = /## SKILLS\n([\s\S]*?)(?=\n##|$)/;
        const skillsMatch = optimizedCV.match(skillsPattern);
        
        if (skillsMatch) {
          const skillsSection = skillsMatch[1];
          const updatedSkillsSection = skillsSection + `\n\n### Additional Keywords:\n• ${verification.missingItems.map(item => item.trim()).join('\n• ')}\n`;
          
          optimizedCV = optimizedCV.replace(skillsPattern, `## SKILLS\n${updatedSkillsSection}`);
        }
      } else {
        // If no skills section, add one with missing keywords
        optimizedCV += `## ADDITIONAL KEYWORDS
• ${verification.missingItems.map(item => item.trim()).join('\n• ')}

`;
      }
    }
  }

  return optimizedCV;
}

// Helper functions
function extractSections(text: string): Record<string, string> {
  // Use the enhanced extractSections function from optimizeCV.ts
  return require("@/lib/optimizeCV").extractSections(text);
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