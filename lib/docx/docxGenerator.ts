import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, BorderStyle, TabStopPosition, TabStopType, UnderlineType, ShadingType, WidthType, Table, TableRow, TableCell } from "docx";

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
    
    // Add Experience section from experienceEntries if provided in options
    if (options.experienceEntries && options.experienceEntries.length > 0) {
      // Add experience section heading
      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text: "EXPERIENCE",
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
      
      // Format each experience entry
      formatExperienceEntries(paragraphs, options.experienceEntries);
      
      // Add extra spacing after experience section
      paragraphs.push(
        new Paragraph({
          spacing: {
            after: 240,
          },
        })
      );
    }
    
    // Add industry-specific section if provided
    if (options.industry) {
      // Add industry insights heading
      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `INDUSTRY INSIGHTS: ${options.industry.toUpperCase()}`,
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
      
      // Add industry-specific content based on the industry
      const industryContent = getIndustryContent(options.industry);
      
      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text: industryContent,
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
  
  // Check if the text is already in a structured format with section headers
  if (text.includes("PROFILE") || text.includes("ACHIEVEMENTS") || text.includes("GOALS") || 
      text.includes("Profile") || text.includes("Achievements") || text.includes("Goals")) {
    
    // Define regex patterns for section identification
    const profilePatterns = [/^(PROFILE|SUMMARY|ABOUT ME|PROFESSIONAL SUMMARY|CAREER OBJECTIVE|Profile|Summary)/i];
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
      const isAchievementsSection = achievementsPatterns.some(pattern => pattern.test(line));
      const isGoalsSection = goalsPatterns.some(pattern => pattern.test(line));
      const isSkillsSection = skillsPatterns.some(pattern => pattern.test(line));
      const isLanguagesSection = languagesPatterns.some(pattern => pattern.test(line));
      const isEducationSection = educationPatterns.some(pattern => pattern.test(line));
      
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

/**
 * Format experience entries into paragraphs
 * @param paragraphs Array of paragraphs to append to
 * @param entries Experience entries to format
 */
function formatExperienceEntries(paragraphs: Paragraph[], entries: Array<{
  jobTitle: string;
  company: string;
  dateRange: string;
  location?: string;
  responsibilities: string[];
}>): void {
  entries.forEach((entry, index) => {
    // Job Title (bold)
    paragraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text: entry.jobTitle,
            bold: true,
            size: 24,
          }),
        ],
        spacing: {
          before: index > 0 ? 240 : 120,
          after: 60,
        },
      })
    );
    
    // Company
    paragraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text: entry.company,
            italics: true,
            size: 22,
          }),
        ],
        spacing: {
          after: 60,
        },
      })
    );
    
    // Date Range & Location (on same line if both exist)
    const dateLocationText = entry.location 
      ? `${entry.dateRange} | ${entry.location}`
      : entry.dateRange;
    
    if (dateLocationText) {
      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text: dateLocationText,
              size: 20,
              color: "666666",
            }),
          ],
          spacing: {
            after: 120,
          },
        })
      );
    }
    
    // Responsibilities as bullet points
    if (entry.responsibilities && entry.responsibilities.length > 0) {
      entry.responsibilities.forEach(responsibility => {
        paragraphs.push(
          new Paragraph({
            bullet: {
              level: 0,
            },
            children: [
              new TextRun({
                text: responsibility,
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
      });
    }
  });
}

/**
 * Get industry-specific content for the document
 * @param industry The industry name
 * @returns A paragraph of industry-specific content
 */
function getIndustryContent(industry: string): string {
  const industryContents: Record<string, string> = {
    'Technology': 'The technology sector values professionals who demonstrate a strong technical foundation combined with innovative problem-solving abilities. Highlighting specific technical skills, successful projects, and measurable achievements will strengthen your position as a candidate in this competitive field.',
    'Finance': 'Financial sector employers seek candidates with analytical skills, attention to detail, and demonstrated ability to work with complex financial data. Quantifying your achievements with specific metrics and highlighting relevant certifications will maximize your impact with potential employers.',
    'Healthcare': 'The healthcare industry values professionals who balance technical expertise with compassion and patient-focused care. Emphasizing your experience with specific medical systems, compliance knowledge, and interpersonal skills will enhance your appeal to healthcare employers.',
    'Marketing': 'Marketing professionals should demonstrate creativity, analytical capabilities, and results-driven achievements. Your CV effectively showcases your ability to develop and execute successful marketing strategies with measurable outcomes.',
    'Sales': 'Sales professionals should emphasize revenue generation, relationship building, and consistent achievement of targets. Quantifying your accomplishments with specific sales figures and growth percentages will strengthen your appeal to potential employers.',
    'Education': 'In education, employers value subject matter expertise, teaching methodology knowledge, and the ability to engage diverse learners. Highlighting your experience with specific educational frameworks and student success outcomes enhances your candidacy.',
    'Engineering': 'Engineering employers seek candidates with strong technical skills, problem-solving abilities, and project experience. Detailing specific engineering challenges you have overcome and technologies you have mastered strengthens your position in this field.',
    'Human Resources': 'HR professionals should demonstrate people management skills, compliance knowledge, and strategic thinking. Your experience in developing and implementing HR initiatives that positively impact organizational culture and performance is valuable to potential employers.',
    'Legal': 'Legal sector employers value attention to detail, analytical thinking, and specialized knowledge of relevant legal domains. Highlighting your experience with specific types of cases or legal procedures enhances your professional profile.'
  };
  
  // Return the industry-specific content or a generic one if not found
  return industryContents[industry] || 
    `Professionals in the ${industry} industry should highlight relevant technical skills, specific achievements, and industry knowledge. Your optimized CV effectively showcases your qualifications and experience in this field.`;
} 