import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, BorderStyle, TabStopPosition, TabStopType, UnderlineType, ShadingType, WidthType, Table, TableRow, TableCell } from "docx";

interface DocxGenerationOptions {
  title?: string;
  author?: string;
  subject?: string;
  keywords?: string[];
  description?: string;
}

/**
 * Generates a DOCX file from optimized CV text
 * @param cvText The optimized CV text to convert to DOCX
 * @param options Additional options for the DOCX document
 * @returns A Buffer containing the generated DOCX file
 */
export async function generateDocx(cvText: string, options: DocxGenerationOptions = {}): Promise<Buffer> {
  if (!cvText) {
    throw new Error('CV text is required');
  }

  try {
    // Default options
    const fileName = options.title || "Optimized_CV";
    const authorName = options.author || "CV Optimizer";
    
    // Parse the optimized text to identify sections
    const sections = parseOptimizedText(cvText);
    
    // Create paragraphs for each section
    const paragraphs: Paragraph[] = [];
    
    // Preferred section order
    const sectionOrder = ["header", "profile", "achievements", "goals", "skills", "languages", "education"] as const;
    
    // Process sections in the preferred order
    for (const sectionKey of sectionOrder) {
      const sectionContent = sections[sectionKey];
      
      if (!sectionContent || (Array.isArray(sectionContent) && sectionContent.length === 0)) {
        continue;
      }
      
      // Handle header section specially
      if (sectionKey === "header") {
        const headerText = sectionContent as string;
        const headerLines = headerText.split('\n').filter((line: string) => line.trim());
        
        if (headerLines.length > 0) {
          // First line is the name - make it prominent
          paragraphs.push(
            new Paragraph({
              text: headerLines[0],
              heading: HeadingLevel.HEADING_1,
              alignment: AlignmentType.CENTER,
            })
          );
          
          // Contact info on one line
          if (headerLines.length > 1) {
            const contactInfo = headerLines.slice(1).join(' | ');
            paragraphs.push(
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    text: contactInfo,
                    size: 20,
                  }),
                ],
                spacing: {
                  after: 200,
                },
              })
            );
          }
          
          // Add a separator line
          paragraphs.push(
            new Paragraph({
              border: {
                bottom: {
                  color: "999999",
                  space: 1,
                  style: BorderStyle.SINGLE,
                  size: 6,
                },
              },
              spacing: {
                after: 200,
              },
            })
          );
        }
        continue;
      }
      
      // Add section heading
      const sectionTitle = getSectionTitle(sectionKey);
      paragraphs.push(
        new Paragraph({
          text: sectionTitle,
          heading: HeadingLevel.HEADING_2,
          thematicBreak: true,
          spacing: {
            before: 240,
            after: 120,
          },
        })
      );
      
      // Handle different section types
      if (sectionKey === "achievements" || sectionKey === "goals") {
        // These are arrays of bullet points
        const items = sectionContent as string[];
        
        items.forEach((item: string) => {
          paragraphs.push(
            new Paragraph({
              bullet: {
                level: 0,
              },
              children: [
                new TextRun({
                  text: item,
                  size: 22,
                }),
              ],
              spacing: {
                after: 80,
              },
            })
          );
        });
      } else {
        // Regular text sections
        const contentText = sectionContent as string;
        const contentLines = contentText.split('\n').filter((line: string) => line.trim());
        
        contentLines.forEach((line: string) => {
          // Check if this line looks like a bullet point
          if (line.trim().startsWith('•') || line.trim().startsWith('-') || line.trim().startsWith('*')) {
            paragraphs.push(
              new Paragraph({
                bullet: {
                  level: 0,
                },
                children: [
                  new TextRun({
                    text: line.replace(/^[•\-*]\s*/, ''),
                    size: 22,
                  }),
                ],
                spacing: {
                  after: 80,
                },
              })
            );
          } else {
            paragraphs.push(
              new Paragraph({
                children: [
                  new TextRun({
                    text: line,
                    size: 22,
                  }),
                ],
                spacing: {
                  after: 80,
                },
              })
            );
          }
        });
      }
      
      // Add extra spacing after each section
      paragraphs.push(
        new Paragraph({
          spacing: {
            after: 200,
          },
        })
      );
    }
    
    // Create the document with the paragraphs
    const doc = new Document({
      creator: authorName,
      title: fileName,
      description: "Optimized CV generated by CV Optimizer",
      sections: [{
        properties: {},
        children: paragraphs,
      }],
    });
    
    // Generate the document as a buffer
    return await Packer.toBuffer(doc);
  } catch (error) {
    console.error("Error generating DOCX:", error);
    throw new Error("Failed to generate DOCX document");
  }
}

/**
 * Parse the optimized text into structured sections
 */
function parseOptimizedText(text: string): {
  header: string;
  profile: string;
  achievements: string[];
  goals: string[];
  skills: string;
  languages: string;
  education: string;
} {
  // Default structure
  const sections = {
    header: "",
    profile: "",
    achievements: [] as string[],
    goals: [] as string[],
    skills: "",
    languages: "",
    education: ""
  };
  
  // Check if the text is already in a structured format
  if (text.includes("PROFILE") || text.includes("ACHIEVEMENTS") || text.includes("GOALS")) {
    // Split text into lines
    const lines = text.split('\n').filter(line => line.trim() !== "");
    
    // Extract header (first 2-3 lines typically contain name and contact info)
    if (lines.length > 0) {
      sections.header = lines.slice(0, Math.min(3, lines.length)).join('\n');
    }
    
    // Process remaining lines to identify sections
    let currentSection = "";
    let sectionContent: string[] = [];
    
    for (let i = 3; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Check for section headers
      const isProfileSection = /^(PROFILE|SUMMARY|ABOUT ME)/i.test(line);
      const isAchievementsSection = /^(ACHIEVEMENTS|ACCOMPLISHMENTS)/i.test(line);
      const isGoalsSection = /^(GOALS|OBJECTIVES)/i.test(line);
      const isSkillsSection = /^(SKILLS|TECHNICAL SKILLS|COMPETENCIES)/i.test(line);
      const isLanguagesSection = /^(LANGUAGES|LANGUAGE PROFICIENCY)/i.test(line);
      const isEducationSection = /^(EDUCATION|ACADEMIC BACKGROUND)/i.test(line);
      
      if (isProfileSection) {
        currentSection = "profile";
        sectionContent = [];
        continue;
      } else if (isAchievementsSection) {
        currentSection = "achievements";
        sectionContent = [];
        continue;
      } else if (isGoalsSection) {
        currentSection = "goals";
        sectionContent = [];
        continue;
      } else if (isSkillsSection) {
        currentSection = "skills";
        sectionContent = [];
        continue;
      } else if (isLanguagesSection) {
        currentSection = "languages";
        sectionContent = [];
        continue;
      } else if (isEducationSection) {
        currentSection = "education";
        sectionContent = [];
        continue;
      } else if (/^[A-Z\s]{2,}:?$/i.test(line) || /^[A-Z\s]{2,}$/i.test(line)) {
        // This looks like a new section header we don't explicitly handle
        currentSection = "";
        continue;
      }
      
      // Add content to current section
      if (currentSection) {
        if (currentSection === "achievements" || currentSection === "goals") {
          // For achievements and goals, each line is a separate item
          if (line.trim()) {
            // Check if line starts with a bullet point, if not add one
            const cleanLine = line.replace(/^[-•*]\s*/, "").trim();
            if (cleanLine) {
              if (currentSection === "achievements") {
                sections.achievements.push(cleanLine);
              } else {
                sections.goals.push(cleanLine);
              }
            }
          }
        } else {
          // For other sections, accumulate text
          sectionContent.push(line);
          
          if (currentSection === "profile") {
            sections.profile = sectionContent.join(' ');
          } else if (currentSection === "skills") {
            sections.skills = sectionContent.join('\n');
          } else if (currentSection === "languages") {
            sections.languages = sectionContent.join('\n');
          } else if (currentSection === "education") {
            sections.education = sectionContent.join('\n');
          }
        }
      } else if (!currentSection && i >= 3) {
        // If we haven't identified a section yet but we're past the header,
        // assume it's part of the profile
        if (!sections.profile) {
          sections.profile = line;
        } else {
          sections.profile += ' ' + line;
        }
      }
    }
  } else {
    // Unstructured text - try to extract basic information
    const lines = text.split('\n').filter(line => line.trim() !== "");
    
    // First few lines are likely the header
    if (lines.length > 0) {
      sections.header = lines.slice(0, Math.min(3, lines.length)).join('\n');
      
      // Rest is profile
      if (lines.length > 3) {
        sections.profile = lines.slice(3).join('\n');
      }
    }
  }
  
  return sections;
}

/**
 * Get the display title for a section
 */
function getSectionTitle(sectionKey: string): string {
  const titles: Record<string, string> = {
    profile: "PROFILE",
    achievements: "ACHIEVEMENTS",
    goals: "GOALS",
    skills: "SKILLS",
    languages: "LANGUAGES",
    education: "EDUCATION"
  };
  
  return titles[sectionKey] || sectionKey.toUpperCase();
} 