import { NextRequest, NextResponse } from "next/server";
import { getTemplateLayout } from "@/lib/templateMatching";
import { modifyPDFWithOptimizedContent } from "@/lib/pdfOptimization";
import { getTemplateById } from "@/lib/templates";
import { analyzeCV } from "@/lib/analyzeCV";
import { 
  extractCriticalKeywords, 
  getIndustrySpecificKeywords, 
  analyzeCVContent, 
  verifyContentPreservation,
  extractSections,
  calculateATSScore
} from "@/lib/optimizeCV.fixed";
import { standardizeCV } from "@/lib/cv-formatter";

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
    
    // Calculate original ATS score - ensure we're using the same calculation method
    const originalAtsScore = calculateATSScore(cvText, false);
    console.log(`Original ATS Score: ${originalAtsScore}`);
    
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
        
        // Calculate improved ATS score with isOptimized=true
        const improvedAtsScore = calculateATSScore(optimizedCV, true);
        console.log(`Improved ATS score: ${improvedAtsScore} (Original: ${originalAtsScore})`);
        
        if (!verification.preserved) {
          console.warn(`AI optimization failed content preservation check. Score: ${verification.keywordScore}%. Using enhanced fallback.`);
          // Fall back to enhanced optimization
          const fallbackCV = createEnhancedOptimizedCV(cvText, templateId || 'default', analysisResults);
          
          // Calculate fallback ATS score
          const fallbackAtsScore = calculateATSScore(fallbackCV, true);
          console.log(`Fallback ATS score: ${fallbackAtsScore} (Original: ${originalAtsScore})`);
          
          return NextResponse.json({
            optimizedCV: fallbackCV,
            message: "CV optimization completed with enhanced fallback due to content preservation failure",
            analysis: {
              ...analysisResults,
              atsScore: originalAtsScore, // Ensure consistent ATS score in analysis
              originalAtsScore,
              improvedAtsScore: fallbackAtsScore
            }
          });
        }
        
        // Success response with the optimized CV
        return NextResponse.json({
            optimizedCV,
            message: "CV optimization completed successfully",
            analysis: {
              ...analysisResults,
              atsScore: originalAtsScore, // Ensure consistent ATS score in analysis
              originalAtsScore,
              improvedAtsScore
            }
        });
      } catch (aiError) {
        console.error("Error calling OpenAI API:", aiError);
        // Fall back to enhanced optimization on AI service error
        const fallbackCV = createEnhancedOptimizedCV(cvText, templateId || 'default', analysisResults);
        
        // Calculate fallback ATS score
        const fallbackAtsScore = calculateATSScore(fallbackCV, true);
        console.log(`Fallback ATS score: ${fallbackAtsScore} (Original: ${originalAtsScore})`);
        
        return NextResponse.json({
            optimizedCV: fallbackCV,
            message: "CV optimization completed with fallback method due to AI service error",
            analysis: {
              ...analysisResults,
              atsScore: originalAtsScore, // Ensure consistent ATS score in analysis
              originalAtsScore,
              improvedAtsScore: fallbackAtsScore
            }
        });
      }
    } 
    // Use the standard optimization if no custom prompt
    else {
      // Create an enhanced optimized version with ATS focus
      const optimizedCV = createEnhancedOptimizedCV(cvText, templateId || 'default', analysisResults);
      
      // Calculate improved ATS score with isOptimized=true flag
      const improvedAtsScore = calculateATSScore(optimizedCV, true);
      console.log(`Improved ATS score: ${improvedAtsScore} (Original: ${originalAtsScore})`);
      
      // Success response
      return NextResponse.json({
        optimizedCV,
        message: "CV optimization completed successfully",
        analysis: {
          ...analysisResults,
          atsScore: originalAtsScore, // Ensure consistent ATS score in analysis
          originalAtsScore,
          improvedAtsScore
        }
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
    
    console.log(`Analysis data: Industry=${industry}, Strengths=${strengths.length}, Weaknesses=${weaknesses.length}`);
  }
  
  // Get industry-specific keywords to boost ATS score
  const industryKeywords = getIndustrySpecificKeywords(industry);
  
  // Extract original keywords to ensure preservation
  const originalKeywords = extractCriticalKeywords(originalText);
  
  // Create a more structured CV with template-inspired format and ATS best practices
  // Use standard section headers that ATS can recognize
  let optimizedCV = ``;

  // Add contact section if found - place at top for ATS recognition
  if (sections.contact) {
    optimizedCV += `## CONTACT INFORMATION
${sections.contact.trim()}

`;
  }

  // Add professional summary or profile for ATS keyword optimization
  if (sections.profile || sections.summary) {
    const profileText = sections.profile || sections.summary || '';
    // Enhance with industry keywords if needed
    let enhancedProfile = profileText;
    
    // ATS optimization - add important industry keywords if they don't exist
    const missingKeywords = industryKeywords
      .slice(0, 5)
      .filter(keyword => !profileText.toLowerCase().includes(keyword.toLowerCase()));
    
    if (missingKeywords.length > 0) {
      enhancedProfile += `\n\nProficient in ${missingKeywords.join(', ')}.`;
    }
    
    optimizedCV += `## PROFESSIONAL SUMMARY
${enhancedProfile.trim()}

`;
  } else {
    // Create a summary if none exists - important for ATS
    optimizedCV += `## PROFESSIONAL SUMMARY
Experienced ${industry} professional with a proven track record of delivering results. Skilled in ${industryKeywords.slice(0, 5).join(', ')}.

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
  
  // Add achievements section with quantified accomplishments - important for ATS
  optimizedCV += `## KEY ACHIEVEMENTS
${achievementsContent}

`;

  // Add professional experience with consistent formatting - critical for ATS parsing
  if (sections.experience || sections["work experience"] || sections["employment history"]) {
    const experienceContent = sections.experience || sections["work experience"] || sections["employment history"] || '';
    
    // Ensure consistent date formatting for ATS
    const dateStandardized = standardizeDates(experienceContent);
    
    // Ensure bullet points for each responsibility/achievement
    const bulletedExperience = ensureBulletPoints(dateStandardized);
    
    // Add industry-specific keywords in experience if missing
    const keywordEnhanced = enhanceWithKeywords(bulletedExperience, industryKeywords);
    
    optimizedCV += `## PROFESSIONAL EXPERIENCE
${keywordEnhanced}

`;
  }

  // Add skills section formatted as ATS-friendly bullet points
  if (sections.skills || sections["technical skills"] || sections.competencies) {
    const skillsContent = sections.skills || sections["technical skills"] || sections.competencies || '';
    
    // Format skills as bullet points and organize categories
    const formattedSkills = formatSkillsForATS(skillsContent, industryKeywords);
    
    optimizedCV += `## SKILLS
${formattedSkills}

`;
  } else {
    // Create skills section if none exists - critical for ATS
    optimizedCV += `## SKILLS
• ${industryKeywords.slice(0, 10).join('\n• ')}

`;
  }

  // Add education with consistent formatting - important for ATS
  if (sections.education || sections["academic background"]) {
    const educationContent = sections.education || sections["academic background"] || '';
    
    // Format education section with consistent date formats
    const formattedEducation = standardizeDates(educationContent);
    
    optimizedCV += `## EDUCATION
${formattedEducation}

`;
  }

  // Add additional sections if present in the original
  if (sections.certifications) {
    optimizedCV += `## CERTIFICATIONS
${sections.certifications}

`;
  }

  if (sections.languages) {
    optimizedCV += `## LANGUAGES
${sections.languages}

`;
  }

  return optimizedCV;
}

// Helper function to standardize date formats for ATS parsing
function standardizeDates(text: string): string {
  // Replace various date formats with consistent MM/YYYY format
  return text.replace(
    /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* (\d{4})\b/gi,
    (match, month, year) => {
      const monthMap: Record<string, string> = {
        'jan': '01', 'feb': '02', 'mar': '03', 'apr': '04', 'may': '05', 'jun': '06',
        'jul': '07', 'aug': '08', 'sep': '09', 'oct': '10', 'nov': '11', 'dec': '12'
      };
      const monthKey = month.toLowerCase().substring(0, 3);
      return `${monthMap[monthKey]}/${year}`;
    }
  );
}

// Helper function to ensure all items have bullet points
function ensureBulletPoints(text: string): string {
  // Split into paragraphs
  const paragraphs = text.split(/\n\s*\n/);
  
  return paragraphs.map(paragraph => {
    // Skip short lines (likely headers/titles)
    if (paragraph.length < 30) return paragraph;
    
    // Split into lines
    const lines = paragraph.split('\n');
    
    return lines.map(line => {
      line = line.trim();
      if (!line) return '';
      
      // If not already a bullet point and not a short title/header
      if (!line.startsWith('•') && !line.startsWith('-') && !line.startsWith('*') && line.length > 30) {
        return `• ${line}`;
      }
      
      return line;
    }).join('\n');
  }).join('\n\n');
}

// Helper function to enhance content with industry keywords
function enhanceWithKeywords(text: string, keywords: string[]): string {
  const textLower = text.toLowerCase();
  const missingKeywords = keywords
    .slice(0, 5)
    .filter(keyword => !textLower.includes(keyword.toLowerCase()));
  
  if (missingKeywords.length === 0) return text;
  
  // Add missing keywords in a natural way
  return text + `\n\n• Demonstrated proficiency in ${missingKeywords.join(', ')} throughout professional career.`;
}

// Helper function to format skills for ATS readability
function formatSkillsForATS(skillsText: string, industryKeywords: string[]): string {
  // Ensure skills are in bullet point format
  let skills = skillsText.trim();
  
  // If skills aren't already in bullet points, convert them
  if (!skills.includes('•') && !skills.includes('-') && !skills.includes('*')) {
    // Check if comma-separated
    if (skills.includes(',')) {
      skills = skills.split(',')
        .map(skill => skill.trim())
        .filter(skill => skill.length > 0)
        .map(skill => `• ${skill}`)
        .join('\n');
    } else {
      // Assume line-separated
      skills = skills.split('\n')
        .map(skill => skill.trim())
        .filter(skill => skill.length > 0)
        .map(skill => skill.startsWith('•') ? skill : `• ${skill}`)
        .join('\n');
    }
  }
  
  // Add missing industry keywords as skills if not present
  const skillsLower = skills.toLowerCase();
  const missingKeywords = industryKeywords
    .slice(0, 7)
    .filter(keyword => !skillsLower.includes(keyword.toLowerCase()));
  
  if (missingKeywords.length > 0) {
    skills += '\n' + missingKeywords.map(keyword => `• ${keyword}`).join('\n');
  }
  
  return skills;
}

// Helper functions
function extractSectionsLocally(text: string): Record<string, string> {
  const sections: Record<string, string> = {};
  
  // Common section headers to look for
  const sectionHeaders = [
    'profile', 'summary', 'about me',
    'objective', 'career goal', 
    'experience', 'work experience', 'professional experience', 'employment history',
    'education', 'academic background',
    'skills', 'technical skills', 'competencies',
    'achievements', 'accomplishments',
    'languages', 'certifications',
    'projects', 'publications', 'references'
  ];
  
  // Convert text to lowercase for case-insensitive matching
  const lowerText = text.toLowerCase();
  
  // Find each section
  for (let i = 0; i < sectionHeaders.length; i++) {
    const currentHeader = sectionHeaders[i];
    const nextHeader = i < sectionHeaders.length - 1 ? sectionHeaders[i + 1] : '';
    
    // Look for the current header
    const headerIndex = lowerText.indexOf(currentHeader);
    if (headerIndex >= 0) {
      // Found a header, now find the end of this section
      const startPos = headerIndex + currentHeader.length;
      let endPos = text.length;
      
      // If there's a next header, find it
      if (nextHeader) {
        const nextHeaderIndex = lowerText.indexOf(nextHeader, startPos);
        if (nextHeaderIndex >= 0) {
          endPos = nextHeaderIndex;
        }
      }
      
      // Extract the section content
      const content = text.substring(startPos, endPos).trim();
      const normalizedHeader = normalizeHeader(currentHeader);
      
      // Only add if there's actual content
      if (content.length > 0 && !sections[normalizedHeader]) {
        sections[normalizedHeader] = content;
      }
    }
  }
  
  return sections;
}

/**
 * Normalizes section headers to a standard format
 */
function normalizeHeader(header: string): string {
  if (/profile|summary|about me/i.test(header)) {
    return 'profile';
  } else if (/objective|career goal/i.test(header)) {
    return 'objective';
  } else if (/experience|work|professional|employment/i.test(header)) {
    return 'experience';
  } else if (/education|academic/i.test(header)) {
    return 'education';
  } else if (/skills|competencies/i.test(header)) {
    return 'skills';
  } else if (/achievements|accomplishments/i.test(header)) {
    return 'achievements';
  } else if (/languages/i.test(header)) {
    return 'languages';
  } else if (/certifications/i.test(header)) {
    return 'certifications';
  } else if (/projects/i.test(header)) {
    return 'projects';
  } else if (/publications/i.test(header)) {
    return 'publications';
  } else if (/references/i.test(header)) {
    return 'references';
  } else {
    return header.toLowerCase().replace(/\s+/g, '_');
  }
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