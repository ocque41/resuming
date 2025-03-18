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
    // Default options
    const fileName = options.title || "Optimized_CV";
    const authorName = options.author || "CV Optimizer";
    
    // Parse the optimized text to identify sections
    const sections = parseOptimizedText(cvText);
    
    // Create paragraphs for each section
    const paragraphs: Paragraph[] = [];
    
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
        const headerLines = headerText.split('\n').filter((line: string) => line.trim());
        
        if (headerLines.length > 0) {
          // First line is the name - make it prominent
          paragraphs.push(
            new Paragraph({
              text: headerLines[0],
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

      // Handle experience section
      if (sectionKey === "experience") {
        // Check if we have structured experience entries from analysis
        if (options.experienceEntries && options.experienceEntries.length > 0) {
          // Render each experience entry in a structured format
          options.experienceEntries.forEach((entry, index) => {
            // Job title and company
            paragraphs.push(
              new Paragraph({
                children: [
                  new TextRun({
                    text: entry.jobTitle,
                    bold: true,
                    size: 22,
                  }),
                  new TextRun({
                    text: " | ",
                    size: 22,
                  }),
                  new TextRun({
                    text: entry.company,
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
            paragraphs.push(
              new Paragraph({
                children: [
                  new TextRun({
                    text: entry.dateRange,
                    size: 20,
                    color: "666666",
                  }),
                  ...(entry.location ? [
                    new TextRun({
                      text: " | " + entry.location,
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
            
            // Responsibilities as bullet points
            if (entry.responsibilities && entry.responsibilities.length > 0) {
              entry.responsibilities.forEach(resp => {
                paragraphs.push(
                  new Paragraph({
                    bullet: {
                      level: 0,
                    },
                    children: [
                      new TextRun({
                        text: resp,
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
          });
        } else {
          // Fallback to unstructured experience text
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
        
        // Add extra spacing after experience section
        paragraphs.push(
          new Paragraph({
            spacing: {
              after: 240,
            },
          })
        );
        
        continue;
      }
      
      // Handle different section types
      if (sectionKey === "achievements" || sectionKey === "goals") {
        // These are arrays of bullet points
        const items = sectionContent as string[];
        
        // Add a brief introduction for these sections
        if (sectionKey === "achievements") {
          paragraphs.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: "Key professional accomplishments with measurable results:",
                  italics: true,
                  size: 22,
                }),
              ],
              spacing: {
                after: 120,
              },
            })
          );
        } else if (sectionKey === "goals") {
          paragraphs.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: "Professional objectives and career aspirations:",
                  italics: true,
                  size: 22,
                }),
              ],
              spacing: {
                after: 120,
              },
            })
          );
        }
        
        // Add each item as a bullet point
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
                after: 100,
                line: 360,
                lineRule: "auto",
              },
            })
          );
        });
        
        // Add extra spacing after these important sections
        paragraphs.push(
          new Paragraph({
            spacing: {
              after: 240,
            },
          })
        );
      } else if (sectionKey === "skills") {
        // Check if we have skill keywords
        if (options.industry) {
          // Add industry tag at the top of skills section
          paragraphs.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: "Industry: ",
                  italics: true,
                  size: 22,
                }),
                new TextRun({
                  text: options.industry,
                  bold: true,
                  size: 22,
                  color: "#B4916C",
                }),
              ],
              spacing: {
                after: 120,
              },
            })
          );
        }
        
        // Regular text sections
        const contentText = sectionContent as string;
        const contentLines = contentText.split('\n').filter((line: string) => line.trim());
        
        // For skills section, create a nicely formatted list
        const skillRegex = /^[•\-*]\s*(.+)$/;
        const skills: string[] = [];
        
        contentLines.forEach((line: string) => {
          const match = line.match(skillRegex);
          if (match) {
            skills.push(match[1].trim());
          } else if (line.includes(',')) {
            // Line with comma-separated skills
            const commaSkills = line.split(',').map(s => s.trim()).filter(s => s);
            skills.push(...commaSkills);
          } else {
            // Regular line, might be a skill
            skills.push(line.trim());
          }
        });
        
        // Create a grid of skills (3 columns)
        const skillRows = [];
        const numCols = 3;
        
        for (let i = 0; i < skills.length; i += numCols) {
          const rowSkills = skills.slice(i, i + numCols);
          const row = new TableRow({
            children: rowSkills.map(skill => 
              new TableCell({
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: skill,
                        size: 22,
                      }),
                    ],
                    spacing: {
                      after: 40,
                    },
                  }),
                ],
                width: {
                  size: 33,
                  type: WidthType.PERCENTAGE,
                },
                margins: {
                  top: 40,
                  bottom: 40,
                  left: 80,
                  right: 80,
                },
              })
            ),
          });
          
          skillRows.push(row);
        }
        
        const skillsTable = new Table({
          rows: skillRows,
          width: {
            size: 100,
            type: WidthType.PERCENTAGE,
          },
          borders: {
            top: { style: BorderStyle.NONE },
            bottom: { style: BorderStyle.NONE },
            left: { style: BorderStyle.NONE },
            right: { style: BorderStyle.NONE },
            insideHorizontal: { style: BorderStyle.NONE },
            insideVertical: { style: BorderStyle.NONE },
          },
        });
        
        // Add the table to the document
        paragraphs.push(new Paragraph({ children: [skillsTable] }));
        
        // Add extra spacing after skills section
        paragraphs.push(
          new Paragraph({
            spacing: {
              after: 240,
            },
          })
        );
      } else {
        // Regular text sections
        const contentText = sectionContent as string;
        const contentLines = contentText.split('\n').filter((line: string) => line.trim());
        
        // For profile section, format as a paragraph
        if (sectionKey === "profile") {
          paragraphs.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: contentLines.join(' '),
                  size: 22,
                }),
              ],
              spacing: {
                after: 240,
                line: 360,
                lineRule: "auto",
              },
            })
          );
        } else {
          // For other sections, process line by line
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
                    after: 80,
                    line: 360,
                    lineRule: "auto",
                  },
                })
              );
            }
          });
        }
      }
      
      // Add extra spacing after each section
      paragraphs.push(
        new Paragraph({
          spacing: {
            after: 240,
          },
        })
      );
    }
    
    // Add footer with ATS score if provided
    if (options.atsScore !== undefined || options.improvedAtsScore !== undefined) {
      const scoreText = options.improvedAtsScore !== undefined
        ? `Original ATS Score: ${options.atsScore || 0} | Improved ATS Score: ${options.improvedAtsScore}`
        : `ATS Score: ${options.atsScore || 0}`;
        
      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text: scoreText,
              size: 18,
              color: "999999",
            }),
          ],
          alignment: AlignmentType.CENTER,
          spacing: {
            before: 240,
          },
          border: {
            top: {
              color: "#DDDDDD",
              space: 1,
              style: BorderStyle.SINGLE,
              size: 4,
            },
          },
        })
      );
      
      // Add a small branding note
      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text: "Generated by CV Optimizer",
              size: 16,
              color: "BBBBBB",
            }),
          ],
          alignment: AlignmentType.CENTER,
          spacing: {
            before: 120,
          },
        })
      );
    }
    
    // Create the document with the paragraphs
    const doc = new Document({
      creator: authorName,
      title: fileName,
      description: "Optimized CV generated by CV Optimizer",
      styles: {
        paragraphStyles: [
          {
            id: "Heading1",
            name: "Heading 1",
            basedOn: "Normal",
            next: "Normal",
            quickFormat: true,
            run: {
              size: 32,
              bold: true,
              color: "000000",
            },
            paragraph: {
              spacing: {
                after: 120,
              },
            },
          },
        ],
      },
      sections: [{
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