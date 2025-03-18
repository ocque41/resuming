import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, BorderStyle, TabStopPosition, TabStopType, UnderlineType, ShadingType, WidthType, Table, TableRow, TableCell, ImageRun } from "docx";

interface DocxGenerationOptions {
  title?: string;
  author?: string;
  subject?: string;
  keywords?: string[];
  description?: string;
  atsScore?: number;
  improvedAtsScore?: number;
  improvements?: string[];
  experienceEntries?: Array<{
    jobTitle: string;
    company: string;
    dateRange: string;
    location?: string;
    responsibilities: string[];
  }>;
  industry?: string;
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
    console.log("Starting DOCX generation with text length:", cvText.length);
    
    // Default options
    const fileName = options.title || "Optimized_CV";
    const authorName = options.author || "CV Optimizer";
    
    // Sanitize text input to remove any problematic characters
    cvText = sanitizeTextForDocx(cvText);
    
    // Parse the optimized text to identify sections
    const sections = parseOptimizedText(cvText);
    
    // Create paragraphs for each section
    const paragraphs: Paragraph[] = [];
    
    // Add document metadata
    const documentSettings = {
      title: fileName,
      description: "Generated with CV Optimizer",
      creator: authorName,
      subject: options.subject || "Optimized CV Document",
      keywords: options.keywords?.join(", ") || "CV, Resume, Professional",
      externalStyles: [],
      numbering: {
        config: [
          {
            reference: "bulletList",
            levels: [
              {
                level: 0,
                format: "bullet" as const,
                text: "•",
                alignment: AlignmentType.LEFT,
                style: {
                  paragraph: {
                    indent: { left: 720, hanging: 360 },
                  },
                },
              },
            ],
          },
        ],
      },
    };
    
    // Preferred section order - strictly follow this order
    const sectionOrder = ["header", "profile", "experience", "achievements", "goals", "skills", "languages", "education"] as const;
    
    // Process sections in the preferred order
    for (const sectionKey of sectionOrder) {
      const sectionContent = sections[sectionKey];
      
      if (!sectionContent || (Array.isArray(sectionContent) && sectionContent.length === 0)) {
        continue;
      }
      
      // Handle header section specially
      if (sectionKey === "header") {
        const headerText = sectionContent as string;
        const headerLines = headerText.split('\n')
          .filter((line: string) => line.trim())
          .map((line: string) => line.trim());
        
        if (headerLines.length > 0) {
          // First line is the name - make it prominent
          paragraphs.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: headerLines[0],
                  size: 40,
                  bold: true,
                  color: "2D5597"
                })
              ],
              heading: HeadingLevel.HEADING_1,
              alignment: AlignmentType.CENTER,
              spacing: {
                after: 120,
              },
              border: {
                bottom: {
                  color: "#B4916C",
                  space: 1,
                  style: BorderStyle.SINGLE,
                  size: 8,
                },
              },
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
                    color: "666666",
                  }),
                ],
                spacing: {
                  after: 240,
                },
              })
            );
          }
          
          // Add extra spacing after header
          paragraphs.push(
            new Paragraph({
              spacing: {
                after: 240,
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
          children: [
            new TextRun({
              text: sectionTitle,
              bold: true,
              size: 24,
              color: "#B4916C",
            }),
          ],
          spacing: {
            before: 240,
            after: 120,
          },
          border: {
            bottom: {
              color: "#DDDDDD",
              space: 1,
              style: BorderStyle.SINGLE,
              size: 4,
            },
          },
        })
      );

      // Handle experience section with structured data if available
      if (sectionKey === "experience" && options.experienceEntries && options.experienceEntries.length > 0) {
        // Render each experience entry in a structured format
        options.experienceEntries.forEach((entry, index) => {
          // Ensure all fields are valid strings
          const jobTitle = (entry.jobTitle || '').trim();
          const company = (entry.company || '').trim();
          const dateRange = (entry.dateRange || '').trim();
          const location = entry.location ? entry.location.trim() : '';
          
          // Only proceed if we have at least a job title
          if (jobTitle) {
            // Job title and company
            paragraphs.push(
              new Paragraph({
                children: [
                  new TextRun({
                    text: jobTitle,
                    bold: true,
                    size: 22,
                  }),
                  new TextRun({
                    text: company ? " | " : "",
                    size: 22,
                  }),
                  new TextRun({
                    text: company,
                    italics: true,
                    size: 22,
                  }),
                ],
                spacing: {
                  before: 120,
                  after: 40,
                },
              })
            );
            
            // Date range and location
            if (dateRange || location) {
              paragraphs.push(
                new Paragraph({
                  children: [
                    new TextRun({
                      text: dateRange,
                      size: 20,
                      color: "666666",
                    }),
                    ...(location ? [
                      new TextRun({
                        text: dateRange ? " | " : "",
                        size: 20,
                        color: "666666",
                      }),
                      new TextRun({
                        text: location,
                        size: 20,
                        color: "666666",
                      })
                    ] : []),
                  ],
                  spacing: {
                    after: 80,
                  },
                })
              );
            }
            
            // Responsibilities as bullet points
            if (entry.responsibilities && entry.responsibilities.length > 0) {
              entry.responsibilities.forEach(resp => {
                if (resp && resp.trim()) {
                  paragraphs.push(
                    new Paragraph({
                      bullet: {
                        level: 0,
                      },
                      children: [
                        new TextRun({
                          text: resp.trim(),
                          size: 22,
                        }),
                      ],
                      spacing: {
                        after: 40,
                        line: 360,
                        lineRule: "auto",
                      },
                    })
                  );
                }
              });
            }
            
            // Add extra spacing between entries
            if (index < (options.experienceEntries?.length ?? 0) - 1) {
              paragraphs.push(
                new Paragraph({
                  spacing: {
                    after: 120,
                  },
                })
              );
            }
          }
        });
      } else {
        // Generic section handling
        const contentText = typeof sectionContent === 'string' 
          ? sectionContent 
          : Array.isArray(sectionContent) ? sectionContent.join('\n') : '';
          
        const contentLines = contentText.split('\n')
          .filter((line: string) => line.trim() !== "")
          .map((line: string) => line.trim());
        
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
                    text: line.replace(/^[•\-*]\s*/, '').trim(),
                    size: 22,
                  }),
                ],
                spacing: {
                  after: 40,
                  line: 360,
                  lineRule: "auto",
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
                  after: 40,
                  line: 360,
                  lineRule: "auto",
                },
              })
            );
          }
        });
      }
      
      // Add extra spacing after section
      paragraphs.push(
        new Paragraph({
          spacing: {
            after: 120,
          },
        })
      );
    }
    
    // Add ATS improvement section if data is available
    if (options.atsScore !== undefined && options.improvedAtsScore !== undefined) {
      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text: "ATS OPTIMIZATION SUMMARY",
              bold: true,
              size: 24,
              color: "#B4916C",
            }),
          ],
          spacing: {
            before: 240,
            after: 120,
          },
          border: {
            bottom: {
              color: "#DDDDDD",
              space: 1,
              style: BorderStyle.SINGLE,
              size: 4,
            },
          },
        })
      );
      
      // ATS Score improvement
      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `Original ATS Score: ${Math.round(options.atsScore)}% → Improved: ${Math.round(options.improvedAtsScore)}%`,
              size: 22,
              bold: true,
            }),
          ],
          spacing: {
            after: 120,
          },
        })
      );
      
      // Improvements
      if (options.improvements && options.improvements.length > 0) {
        paragraphs.push(
          new Paragraph({
            children: [
              new TextRun({
                text: "Key Improvements:",
                size: 22,
                bold: true,
              }),
            ],
            spacing: {
              after: 40,
            },
          })
        );
        
        options.improvements.forEach(improvement => {
          if (improvement && improvement.trim()) {
            paragraphs.push(
              new Paragraph({
                bullet: {
                  level: 0,
                },
                children: [
                  new TextRun({
                    text: improvement.trim(),
                    size: 22,
                  }),
                ],
                spacing: {
                  after: 40,
                  line: 360,
                  lineRule: "auto",
                },
              })
            );
          }
        });
      }
    }
    
    // Create document with the content
    const doc = new Document({
      creator: authorName,
      description: documentSettings.description,
      title: documentSettings.title,
      subject: documentSettings.subject,
      keywords: documentSettings.keywords,
      styles: {
        paragraphStyles: [
          {
            id: "Heading1",
            name: "Heading 1",
            basedOn: "Normal",
            next: "Normal",
            run: {
              font: "Calibri",
              size: 40,
              bold: true,
              color: "2D5597",
            },
            paragraph: {
              spacing: {
                after: 240,
              },
            },
          },
          {
            id: "Heading2",
            name: "Heading 2",
            basedOn: "Normal",
            next: "Normal",
            run: {
              font: "Calibri",
              size: 26,
              bold: true,
              color: "2D5597",
            },
            paragraph: {
              spacing: {
                before: 240,
                after: 120,
              },
            },
          },
          {
            id: "Normal",
            name: "Normal",
            next: "Normal",
            run: {
              font: "Calibri",
              size: 22,
              color: "000000",
            },
            paragraph: {
              spacing: {
                line: 276,
                before: 0,
                after: 0,
              },
            },
          },
        ],
        default: {
          document: {
            run: {
              font: "Calibri",
              size: 22,
            },
            paragraph: {
              spacing: {
                line: 276,
                before: 0,
                after: 0,
              },
            },
          },
        },
      },
      numbering: documentSettings.numbering,
      sections: [
        {
          properties: {
            page: {
              margin: {
                top: 1000,
                right: 1000,
                bottom: 1000,
                left: 1000,
              },
            },
          },
          children: paragraphs,
        },
      ],
    });
    
    console.log("Document created successfully, packing to buffer...");
    
    // Generate buffer with error handling
    try {
      const buffer = await Packer.toBuffer(doc);
      console.log(`Successfully generated DOCX buffer of size: ${buffer.length} bytes`);
      return buffer;
    } catch (packError) {
      console.error("Error packing document to buffer:", packError);
      throw new Error(`Failed to create DOCX file: ${packError instanceof Error ? packError.message : String(packError)}`);
    }
  } catch (error) {
    console.error("Error generating document:", error);
    throw new Error(`Failed to generate CV document: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Sanitize text input to prevent docx generation issues
 */
function sanitizeTextForDocx(text: string): string {
  // Replace problematic characters that might cause docx corruption
  return text
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, '') // Remove control characters
    .replace(/\u00A0/g, ' ') // Replace non-breaking spaces with regular spaces
    .replace(/[\u2018\u2019]/g, "'") // Replace smart quotes
    .replace(/[\u201C\u201D]/g, '"') // Replace smart double quotes
    .replace(/[\u2013\u2014]/g, '-') // Replace em/en dashes
    .replace(/\u2026/g, '...') // Replace ellipsis
    .replace(/[^\x20-\x7E\u00A0-\u00FF\u0100-\u017F\u0180-\u024F\u0370-\u03FF\u0400-\u04FF\u2000-\u206F\u2200-\u22FF]/g, '') // Allow basic Latin, Latin-1 Supplement, Latin Extended-A/B, Greek, Cyrillic, General Punctuation, Mathematical Operators
    .replace(/\t/g, '    '); // Replace tabs with spaces
}

/**
 * Parse the optimized text into structured sections
 */
function parseOptimizedText(text: string): {
  header: string;
  profile: string;
  experience: string;
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
    experience: "",
    achievements: [] as string[],
    goals: [] as string[],
    skills: "",
    languages: "",
    education: ""
  };
  
  // Check if the text is already in a structured format with section headers
  if (text.includes("PROFILE") || text.includes("EXPERIENCE") || text.includes("ACHIEVEMENTS") || 
      text.includes("Profile") || text.includes("Experience") || text.includes("Achievements")) {
    
    // Define regex patterns for section identification
    const profilePatterns = [/^(PROFILE|SUMMARY|ABOUT ME|PROFESSIONAL SUMMARY|CAREER OBJECTIVE|Profile|Summary)/i];
    const experiencePatterns = [/^(EXPERIENCE|EMPLOYMENT|WORK HISTORY|PROFESSIONAL EXPERIENCE|Experience|Work History)/i];
    const achievementsPatterns = [/^(ACHIEVEMENTS|ACCOMPLISHMENTS|KEY ACCOMPLISHMENTS|MAJOR ACHIEVEMENTS|Achievements)/i];
    const goalsPatterns = [/^(GOALS|OBJECTIVES|CAREER GOALS|PROFESSIONAL GOALS|ASPIRATIONS|Goals)/i];
    const skillsPatterns = [/^(SKILLS|TECHNICAL SKILLS|COMPETENCIES|CORE COMPETENCIES|KEY SKILLS|EXPERTISE|Skills)/i];
    const languagesPatterns = [/^(LANGUAGES|LANGUAGE PROFICIENCY|LANGUAGE SKILLS|Languages)/i];
    const educationPatterns = [/^(EDUCATION|ACADEMIC BACKGROUND|EDUCATIONAL QUALIFICATIONS|ACADEMIC QUALIFICATIONS|Education)/i];
    
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
      
      // Check for section headers using the defined patterns
      const isProfileSection = profilePatterns.some(pattern => pattern.test(line));
      const isExperienceSection = experiencePatterns.some(pattern => pattern.test(line));
      const isAchievementsSection = achievementsPatterns.some(pattern => pattern.test(line));
      const isGoalsSection = goalsPatterns.some(pattern => pattern.test(line));
      const isSkillsSection = skillsPatterns.some(pattern => pattern.test(line));
      const isLanguagesSection = languagesPatterns.some(pattern => pattern.test(line));
      const isEducationSection = educationPatterns.some(pattern => pattern.test(line));
      
      if (isProfileSection) {
        currentSection = "profile";
        sectionContent = [];
        continue;
      } else if (isExperienceSection) {
        currentSection = "experience";
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
            sections.profile = sectionContent.join('\n');
          } else if (currentSection === "experience") {
            sections.experience = sectionContent.join('\n');
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
          sections.profile += '\n' + line;
        }
      }
    }
  } else {
    // Unstructured text - try to extract basic information
    const lines = text.split('\n').filter(line => line.trim() !== "");
    
    // First few lines are likely the header
    if (lines.length > 0) {
      sections.header = lines.slice(0, Math.min(3, lines.length)).join('\n');
      
      // Look for experience section markers
      const experienceIndex = lines.findIndex((line, index) => 
        index > 2 && /experience|employment|work history/i.test(line)
      );
      
      if (experienceIndex !== -1) {
        // Found experience section
        const skillsIndex = lines.findIndex((line, index) => 
          index > experienceIndex && /skills|competencies|expertise/i.test(line)
        );
        
        const educationIndex = lines.findIndex((line, index) => 
          index > experienceIndex && /education|academic|qualifications/i.test(line)
        );
        
        // Determine the end of the experience section
        const experienceEndIndex = Math.min(
          skillsIndex !== -1 ? skillsIndex : lines.length,
          educationIndex !== -1 ? educationIndex : lines.length
        );
        
        // Extract experience section
        sections.experience = lines.slice(experienceIndex + 1, experienceEndIndex).join('\n');
        
        // Extract profile (between header and experience)
        if (experienceIndex > 3) {
          sections.profile = lines.slice(3, experienceIndex).join('\n');
        }
        
        // Extract skills section if found
        if (skillsIndex !== -1) {
          const skillsEndIndex = educationIndex !== -1 && educationIndex > skillsIndex
            ? educationIndex
            : lines.length;
            
          sections.skills = lines.slice(skillsIndex + 1, skillsEndIndex).join('\n');
        }
        
        // Extract education section if found
        if (educationIndex !== -1) {
          sections.education = lines.slice(educationIndex + 1).join('\n');
        }
      } else {
        // No clear sections - treat everything after header as profile
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
    experience: "EXPERIENCE",
    achievements: "ACHIEVEMENTS",
    goals: "GOALS",
    skills: "SKILLS",
    languages: "LANGUAGES",
    education: "EDUCATION"
  };
  
  return titles[sectionKey] || sectionKey.toUpperCase();
} 