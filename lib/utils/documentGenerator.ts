import { Document, Packer, Paragraph, TextRun, HeadingLevel, BorderStyle } from "docx";
import { logger } from "@/lib/logger";

/**
 * Enhanced Document Generator
 * A utility for generating DOCX files from CV text with improved section handling
 */
export class DocumentGenerator {
  /**
   * Generate a DOCX file from CV text with enhanced formatting
   * @param cvText The optimized CV text
   * @param metadata Optional metadata for enhanced formatting
   */
  static async generateDocx(cvText: string, metadata?: any): Promise<Buffer> {
    try {
      logger.info("Starting enhanced document generation");
      const startTime = Date.now();
      
      // Split the CV text into sections based on common headers
      const sections = this.splitIntoSections(cvText);
      
      // Create document
      const doc = new Document({
        sections: [
          {
            properties: {},
            children: this.createDocumentContent(sections, metadata)
          }
        ]
      });
      
      // Generate buffer
      const buffer = await Packer.toBuffer(doc);
      
      logger.info(`Document generation completed in ${Date.now() - startTime}ms`);
      return buffer;
    } catch (error) {
      logger.error(`Error generating document: ${error instanceof Error ? error.message : String(error)}`);
      throw new Error(`Document generation failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Split CV text into logical sections
   */
  private static splitIntoSections(text: string): Record<string, string> {
    const sections: Record<string, string> = {
      header: "",
      content: ""
    };
    
    // Try to find common section headers
    const headerMatch = text.match(/^(.*?)(?=\n\s*(?:EXPERIENCE|EDUCATION|SKILLS|PROFILE|SUMMARY))/is);
    if (headerMatch && headerMatch[0]) {
      sections.header = headerMatch[0].trim();
      sections.content = text.substring(headerMatch[0].length).trim();
    } else {
      // If no clear header found, use first few lines as header
      const lines = text.split('\n');
      const headerLines = lines.slice(0, Math.min(5, Math.ceil(lines.length * 0.1))); 
      sections.header = headerLines.join('\n').trim();
      sections.content = lines.slice(headerLines.length).join('\n').trim();
    }
    
    return sections;
  }
  
  /**
   * Create document content with appropriate formatting
   */
  private static createDocumentContent(sections: Record<string, string>, metadata?: any): any[] {
    const children: any[] = [];
    
    // Add header with name and contact info
    if (sections.header) {
      const headerLines = sections.header.split('\n');
      
      // First line is usually the name - make it prominent
      if (headerLines.length > 0) {
        children.push(
          new Paragraph({
            text: headerLines[0].trim(),
            heading: HeadingLevel.TITLE,
            spacing: {
              after: 200
            }
          })
        );
        
        // Add remaining header lines (contact info)
        const contactInfoLines = headerLines.slice(1).filter(line => line.trim().length > 0);
        if (contactInfoLines.length > 0) {
          children.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: contactInfoLines.join(' | '),
                  size: 22
                })
              ],
              spacing: {
                after: 400
              },
              alignment: 'center'
            })
          );
        }
      }
    }
    
    // Add horizontal separator
    children.push(
      new Paragraph({
        border: {
          bottom: {
            color: "999999",
            space: 1,
            style: BorderStyle.SINGLE,
            size: 6
          }
        },
        spacing: {
          after: 300
        }
      })
    );
    
    // Process main content
    if (sections.content) {
      // Adjust Education vs Experience confusion: if 'education' section exists but lacks clear education keywords, merge it into 'experience'
      if (sections['education']) {
        if (!/university|college|degree|bachelor|master|phd/i.test(sections['education'])) {
          // Merge education content into experience
          if (sections['experience']) {
            sections['experience'] += "\n" + sections['education'];
          } else {
            sections['experience'] = sections['education'];
          }
          delete sections['education'];
        }
      }
      
      const contentSections = this.identifySections(sections.content);
      
      // Add Profile section if it exists
      if (contentSections['PROFILE'] || contentSections['SUMMARY']) {
        const profileContent = contentSections['PROFILE'] || contentSections['SUMMARY'];
        
        // Add section heading
        children.push(
          new Paragraph({
            text: 'PROFILE',
            heading: HeadingLevel.HEADING_1,
            spacing: {
              before: 400,
              after: 200
            }
          })
        );
        
        // Add profile content
        const profileLines = profileContent.split('\n');
        profileLines.forEach(line => {
          const trimmedLine = line.trim();
          if (trimmedLine.length === 0) return;
          
          children.push(
            new Paragraph({
              text: trimmedLine,
              spacing: {
                before: 100,
                after: 100
              }
            })
          );
        });
      }
      
      // Check if Experience section exists
      const hasExperience = contentSections['EXPERIENCE'] || 
                           contentSections['WORK EXPERIENCE'] || 
                           contentSections['PROFESSIONAL EXPERIENCE'] ||
                           contentSections['EMPLOYMENT HISTORY'];
      
      // Only add Achievements section if there's work experience
      if (hasExperience) {
        // Extract achievements from work experience
        const experienceContent = contentSections['EXPERIENCE'] || 
                                 contentSections['WORK EXPERIENCE'] || 
                                 contentSections['PROFESSIONAL EXPERIENCE'] ||
                                 contentSections['EMPLOYMENT HISTORY'];
        
        // Parse the experience content to find achievement-like statements
        const achievements = this.extractAchievements(experienceContent);
        
        if (achievements.length > 0) {
          // Add Achievements section
          children.push(
            new Paragraph({
              text: 'ACHIEVEMENTS',
              heading: HeadingLevel.HEADING_1,
              spacing: {
                before: 400,
                after: 200
              }
            })
          );
          
          // Add achievement bullet points (limit to top 3)
          achievements.slice(0, 3).forEach(achievement => {
            children.push(
              new Paragraph({
                text: achievement,
                bullet: {
                  level: 0
                },
                spacing: {
                  before: 100,
                  after: 100
                }
              })
            );
          });
        }
        
        // Add Experience section
        children.push(
          new Paragraph({
            text: 'EXPERIENCE',
            heading: HeadingLevel.HEADING_1,
            spacing: {
              before: 400,
              after: 200
            }
          })
        );
        
        // Add experience content
        const experienceLines = experienceContent.split('\n');
        experienceLines.forEach(line => {
          const trimmedLine = line.trim();
          if (trimmedLine.length === 0) return;
          
          // Check if this is a bullet point
          const isBullet = trimmedLine.startsWith('-') || 
                           trimmedLine.startsWith('•') || 
                           trimmedLine.startsWith('*');
          
          // Add the paragraph with appropriate formatting
          if (isBullet) {
            children.push(
              new Paragraph({
                text: trimmedLine.substring(1).trim(),
                bullet: {
                  level: 0
                },
                spacing: {
                  before: 100,
                  after: 100
                }
              })
            );
          } else {
            children.push(
              new Paragraph({
                text: trimmedLine,
                spacing: {
                  before: 100,
                  after: 100
                }
              })
            );
          }
        });
      } else {
        // If no experience section, add Goals section instead
        children.push(
          new Paragraph({
            text: 'GOALS',
            heading: HeadingLevel.HEADING_1,
            spacing: {
              before: 400,
              after: 200
            }
          })
        );
        
        // Add goals bullet points based on skills
        const goals = [
          "Secure a challenging position that leverages my skills in problem-solving and innovation",
          "Contribute to a forward-thinking organization where I can apply my expertise to drive meaningful results",
          "Develop professionally through continuous learning and collaboration with industry experts"
        ];
        
        goals.forEach(goal => {
          children.push(
            new Paragraph({
              text: goal,
              bullet: {
                level: 0
              },
              spacing: {
                before: 100,
                after: 100
              }
            })
          );
        });
      }
      
      // Add Skills section -- use metadata.skills if available
      children.push(
        new Paragraph({
          text: 'SKILLS',
          heading: HeadingLevel.HEADING_1,
          spacing: {
            before: 400,
            after: 200
          }
        })
      );
      if (metadata && metadata.skills && Array.isArray(metadata.skills) && metadata.skills.length > 0) {
        // Use skills from metadata
        metadata.skills.forEach((skill: string) => {
          children.push(
            new Paragraph({
              text: skill,
              bullet: {
                level: 0
              },
              spacing: {
                before: 100,
                after: 100
              }
            })
          );
        });
      } else if (contentSections['SKILLS']) {
        // Otherwise, use the content from the SKILLS section
        const skillsLines = contentSections['SKILLS'].split('\n');
        skillsLines.forEach(line => {
          const trimmedLine = line.trim();
          if (trimmedLine.length === 0) return;
          
          // Check if this is a bullet point
          const isBullet = trimmedLine.startsWith('-') || 
                           trimmedLine.startsWith('•') || 
                           trimmedLine.startsWith('*');
          
          // Add the paragraph with appropriate formatting
          if (isBullet) {
            children.push(
              new Paragraph({
                text: trimmedLine.substring(1).trim(),
                bullet: {
                  level: 0
                },
                spacing: {
                  before: 100,
                  after: 100
                }
              })
            );
          } else {
            children.push(
              new Paragraph({
                text: trimmedLine,
                spacing: {
                  before: 100,
                  after: 100
                }
              })
            );
          }
        });
      } else {
        // If no skills found, do not add any default skills
      }
      
      // Add remaining sections (Education, etc.)
      Object.entries(contentSections).forEach(([sectionName, sectionContent]) => {
        // Skip sections we've already handled
        if (sectionName === 'PROFILE' || 
            sectionName === 'SUMMARY' || 
            sectionName === 'SKILLS' || 
            sectionName === 'EXPERIENCE' || 
            sectionName === 'WORK EXPERIENCE' || 
            sectionName === 'PROFESSIONAL EXPERIENCE' ||
            sectionName === 'EMPLOYMENT HISTORY') {
          return;
        }
        
        // Add section heading
        children.push(
          new Paragraph({
            text: sectionName.toUpperCase(),
            heading: HeadingLevel.HEADING_1,
            spacing: {
              before: 400,
              after: 200
            }
          })
        );
        
        // Add section content - split by lines or bullet points
        const contentLines = sectionContent.split('\n');
        contentLines.forEach(line => {
          const trimmedLine = line.trim();
          if (trimmedLine.length === 0) return;
          
          // Check if this is a bullet point
          const isBullet = trimmedLine.startsWith('-') || 
                           trimmedLine.startsWith('•') || 
                           trimmedLine.startsWith('*');
          
          // Add the paragraph with appropriate formatting
          if (isBullet) {
            children.push(
              new Paragraph({
                text: trimmedLine.substring(1).trim(),
                bullet: {
                  level: 0
                },
                spacing: {
                  before: 100,
                  after: 100
                }
              })
            );
          } else {
            children.push(
              new Paragraph({
                text: trimmedLine,
                spacing: {
                  before: 100,
                  after: 100
                }
              })
            );
          }
        });
      });
    }
    
    // Remove any "KEY WEAKNESSES ADDRESSED" section that might be in the sections
    if (sections['KEY WEAKNESSES ADDRESSED'] || sections['WEAKNESSES ADDRESSED']) {
      delete sections['KEY WEAKNESSES ADDRESSED'];
      delete sections['WEAKNESSES ADDRESSED'];
    }
    
    // Check if any sections contain "Weaknesses Addressed" text (case insensitive)
    Object.keys(sections).forEach(sectionKey => {
      const content = sections[sectionKey];
      if (content && typeof content === 'string') {
        // Check for headers or subsections related to weaknesses
        if (/weaknesses\s+addressed|key\s+weaknesses|areas\s+to\s+improve/i.test(content)) {
          // Try to extract and remove the weaknesses section
          const lines = content.split('\n');
          const filteredLines = lines.filter(line => 
            !/weaknesses\s+addressed|key\s+weaknesses|areas\s+to\s+improve/i.test(line)
          );
          sections[sectionKey] = filteredLines.join('\n');
        }
      }
    });
    
    return children;
  }
  
  /**
   * Identify sections in the CV content
   */
  private static identifySections(content: string): Record<string, string> {
    const sections: Record<string, string> = {};
    
    // Define section keywords to match against
    const sectionKeywords = {
      'PROFILE': ['profile', 'summary', 'about me', 'personal statement', 'professional summary', 'career objective'],
      'EXPERIENCE': ['experience', 'employment', 'work history', 'professional experience', 'career history', 'job history'],
      'EDUCATION': ['education', 'academic background', 'academic history', 'qualifications', 'degrees', 'academic qualifications'],
      'SKILLS': ['skills', 'technical skills', 'core competencies', 'competencies', 'expertise', 'key skills', 'proficiencies', 'technical proficiencies'],
      'PROJECTS': ['projects', 'key projects', 'project experience', 'professional projects'],
      'CERTIFICATIONS': ['certifications', 'certificates', 'professional certifications', 'credentials'],
      'LANGUAGES': ['languages', 'language proficiency', 'language skills'],
      'INTERESTS': ['interests', 'hobbies', 'activities', 'personal interests'],
      'REFERENCES': ['references', 'professional references'],
      'PUBLICATIONS': ['publications', 'research', 'papers', 'articles'],
      'AWARDS': ['awards', 'honors', 'achievements', 'recognitions']
    };
    
    // Split content by lines
    const lines = content.split('\n');
    let currentSection = '';
    let sectionContent = '';
    
    // Process each line
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Skip empty lines
      if (line === '') continue;
      
      // Check if line is a section header (all caps or followed by colon)
      const isHeader = (
        (line === line.toUpperCase() && line.length > 3) || 
        /^[A-Z][a-zA-Z\s]{2,}:/.test(line)
      );
      
      if (isHeader) {
        // Save previous section if exists
        if (currentSection && sectionContent) {
          sections[currentSection] = sectionContent.trim();
        }
        
        // Clean up header (remove colons and trim)
        let header = line.replace(':', '').trim();
        
        // Standardize section name based on keywords
        let matchedSection = '';
        for (const [section, keywords] of Object.entries(sectionKeywords)) {
          if (keywords.some(keyword => header.toLowerCase().includes(keyword.toLowerCase()))) {
            matchedSection = section;
            break;
          }
        }
        
        // Handle combined sections (e.g., "EDUCATION & SKILLS")
        if (!matchedSection) {
          // Check for combined sections like "EDUCATION & SKILLS" or "SKILLS AND QUALIFICATIONS"
          if (/education.+skill|skill.+education|qualification.+skill|skill.+qualification/i.test(header)) {
            // This is likely a combined section - we'll process it carefully later
            matchedSection = 'COMBINED_EDU_SKILLS';
          } else {
            // Use the header as is if no match found
            matchedSection = header.toUpperCase();
          }
        }
        
        currentSection = matchedSection;
        sectionContent = '';
      } else if (currentSection) {
        // Add line to current section content
        sectionContent += line + '\n';
      }
    }
    
    // Save the last section
    if (currentSection && sectionContent) {
      sections[currentSection] = sectionContent.trim();
    }
    
    // Handle combined education & skills sections
    if (sections['COMBINED_EDU_SKILLS']) {
      const combinedContent = sections['COMBINED_EDU_SKILLS'];
      delete sections['COMBINED_EDU_SKILLS'];
      
      // Look for skill-related keywords to split the content
      const skillLines = [];
      const eduLines = [];
      
      const skillKeywords = ['proficient in', 'experienced with', 'knowledge of', 'familiar with', 'skills:', 'skill set', 'programming', 'software', 'technologies', 'tools', 'languages', 'frameworks'];
      const eduKeywords = ['university', 'college', 'degree', 'bachelor', 'master', 'phd', 'gpa', 'graduated', 'diploma', 'major'];
      
      // Split the combined content into lines
      const contentLines = combinedContent.split('\n');
      
      // Try to identify which lines belong to which section
      for (const line of contentLines) {
        const lowerLine = line.toLowerCase();
        
        // Check if this line contains skill keywords
        const isSkillLine = skillKeywords.some(keyword => lowerLine.includes(keyword.toLowerCase())) || 
                            /^[•\-\*]?\s*[A-Za-z]+(,|:|\s-|\s–)/.test(line);
        
        // Check if this line contains education keywords
        const isEduLine = eduKeywords.some(keyword => lowerLine.includes(keyword.toLowerCase()));
        
        if (isSkillLine && !isEduLine) {
          skillLines.push(line);
        } else if (isEduLine) {
          eduLines.push(line);
        } else {
          // If we can't determine, put in the most recently used category or education as default
          if (skillLines.length > eduLines.length) {
            skillLines.push(line);
          } else {
            eduLines.push(line);
          }
        }
      }
      
      // Add the split sections if they have content
      if (skillLines.length > 0) {
        sections['SKILLS'] = skillLines.join('\n');
      }
      
      if (eduLines.length > 0) {
        sections['EDUCATION'] = eduLines.join('\n');
      }
    }
    
    // If there's no SKILLS section but we find skills in other sections, extract them
    if (!sections['SKILLS']) {
      const skillIndicators = [
        'technical skills:', 'skills:', 'skill set:', 'proficient in:', 'proficient with:',
        'experienced in:', 'experienced with:', 'expertise in:', 'competencies:'
      ];
      
      for (const [section, content] of Object.entries(sections)) {
        if (section !== 'SKILLS') {
          // Check if this section contains a skills subsection
          for (const indicator of skillIndicators) {
            if (content.toLowerCase().includes(indicator.toLowerCase())) {
              // Extract the skills section
              const parts = content.split(new RegExp(`(${indicator})`, 'i'));
              if (parts.length >= 3) {
                const index = parts.findIndex(p => p.toLowerCase() === indicator.toLowerCase());
                if (index >= 0 && index < parts.length - 1) {
                  // Extract the skills content (everything after the indicator)
                  let skillsContent = parts.slice(index + 1).join('');
                  
                  // Try to find where skills section ends (next section header or end of content)
                  const nextHeaderMatch = skillsContent.match(/\n\s*[A-Z][A-Z\s]+:/);
                  if (nextHeaderMatch) {
                    skillsContent = skillsContent.substring(0, nextHeaderMatch.index);
                  }
                  
                  // Add to SKILLS section
                  sections['SKILLS'] = (sections['SKILLS'] || '') + 
                                      (sections['SKILLS'] ? '\n' : '') + 
                                      skillsContent.trim();
                  
                  // Remove from original section
                  sections[section] = content.replace(indicator + skillsContent, '').trim();
                }
              }
            }
          }
        }
      }
    }
    
    return sections;
  }
  
  /**
   * Extract achievements from work experience content
   * Looks for sentences that appear to be achievements based on certain patterns
   */
  private static extractAchievements(experienceContent: string): string[] {
    const lines = experienceContent.split('\n');
    const achievements: string[] = [];
    
    // Action verbs that often indicate achievements
    const achievementVerbs = [
      "increased", "decreased", "improved", "reduced", "saved", "grew", 
      "developed", "created", "established", "implemented", "launched", 
      "generated", "delivered", "achieved", "won", "awarded", "recognized"
    ];
    
    // Patterns that might indicate metrics or quantifiable results
    const metricPatterns = [
      /\d+\s*%/, // Percentage (e.g., 25%)
      /\$\s*\d+/, // Dollar amount (e.g., $500K)
      /\d+\s*k/i, // Thousands (e.g., 500K)
      /\d+\s*m/i, // Millions (e.g., 2M)
      /\d+\s*million/i, // Written millions (e.g., 2 million)
      /\d+\s*billion/i, // Written billions (e.g., 1 billion)
    ];
    
    // Search through each line for achievement-like content
    lines.forEach((line) => {
      // Skip empty lines
      if (line.trim().length === 0) return;
      
      // Clean the line (remove bullet points)
      let cleanLine = line.trim();
      if (cleanLine.startsWith('-') || cleanLine.startsWith('•') || cleanLine.startsWith('*')) {
        cleanLine = cleanLine.substring(1).trim();
      }
      
      // Skip if line is too short
      if (cleanLine.length < 20) return;
      
      // Check if line contains achievement verbs
      const containsAchievementVerb = achievementVerbs.some(verb => 
        cleanLine.toLowerCase().includes(verb)
      );
      
      // Check if line contains metrics
      const containsMetrics = metricPatterns.some(pattern => 
        pattern.test(cleanLine)
      );
      
      // If line has either achievement verbs or metrics, consider it an achievement
      if (containsAchievementVerb || containsMetrics) {
        // Ensure first letter is capitalized
        const firstChar = cleanLine.charAt(0).toUpperCase();
        const restOfLine = cleanLine.slice(1);
        
        // Add to achievements
        achievements.push(firstChar + restOfLine);
      }
    });
    
    // If no achievements found using patterns, look for longest bullet points
    if (achievements.length === 0) {
      const bulletPoints = lines
        .filter(line => {
          const trimmed = line.trim();
          return (trimmed.startsWith('-') || trimmed.startsWith('•') || trimmed.startsWith('*')) && 
                 trimmed.length > 30; // Only consider substantial bullet points
        })
        .map(line => {
          let cleaned = line.trim();
          if (cleaned.startsWith('-') || cleaned.startsWith('•') || cleaned.startsWith('*')) {
            cleaned = cleaned.substring(1).trim();
          }
          return cleaned;
        })
        .sort((a, b) => b.length - a.length); // Sort by length (longest first)
      
      // Take up to 3 longest bullet points
      achievements.push(...bulletPoints.slice(0, 3));
    }
    
    // If still no achievements, create generic achievements based on job titles
    if (achievements.length === 0) {
      // Try to extract job titles
      const jobTitlePattern = /(?:^|\n)([A-Z][A-Za-z\s]+(?:Manager|Director|Engineer|Developer|Specialist|Analyst|Consultant|Designer|Coordinator|Assistant|Representative|Officer|Lead|Head|Chief))/g;
      const jobTitleMatches = [...experienceContent.matchAll(jobTitlePattern)];
      
      if (jobTitleMatches.length > 0) {
        // Use job titles to create achievements
        jobTitleMatches.slice(0, 2).forEach(match => {
          const jobTitle = match[1].trim();
          achievements.push(`Successfully performed key responsibilities as ${jobTitle}, exceeding expectations`);
          achievements.push(`Demonstrated excellence in problem-solving and teamwork as ${jobTitle}`);
        });
      } else {
        // Fallback to generic achievements
        achievements.push(
          "Successfully implemented process improvements resulting in increased efficiency",
          "Collaborated effectively with cross-functional teams to achieve organizational goals",
          "Recognized for exceptional performance and contribution to team success"
        );
      }
    }
    
    return achievements;
  }
} 