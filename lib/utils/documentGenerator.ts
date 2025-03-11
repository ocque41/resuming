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
          spacing: { before: 400, after: 200 }
        })
      );
      
      // Prioritize skills from metadata if available
      if (metadata && metadata.skills && Array.isArray(metadata.skills) && metadata.skills.length > 0) {
        // Organize skills by category if there are many skills
        const skills = metadata.skills;
        
        // For a large set of skills, try to categorize them
        if (skills.length > 8) {
          // Define common skill categories
          const categories: Record<string, string[]> = {
            'Technical': ['programming', 'software', 'development', 'coding', 'java', 'python', 'javascript', 'html', 'css', 'sql', 'database', 'aws', 'cloud', 'azure', 'git', 'docker', 'kubernetes', 'api', 'backend', 'frontend', 'fullstack', 'mobile'],
            'Management': ['management', 'leadership', 'strategy', 'project', 'agile', 'scrum', 'team', 'planning', 'budgeting', 'stakeholder', 'coordination'],
            'Communication': ['communication', 'presentation', 'writing', 'negotiation', 'public speaking', 'documentation', 'reporting'],
            'Analysis': ['analysis', 'research', 'data', 'analytics', 'statistics', 'metrics', 'reporting', 'problem-solving', 'critical thinking'],
            'Design': ['design', 'ui', 'ux', 'user interface', 'user experience', 'photoshop', 'illustrator', 'figma', 'sketch', 'creative', 'visual'],
            'Industry-specific': []
          };
          
          // If industry is available, add industry-specific keywords
          if (metadata.industry) {
            const industrySkills = this.getIndustrySkills(metadata.industry);
            const lowercaseIndustryKeywords = industrySkills.map(skill => 
              skill.toLowerCase().replace(/\(.*\)/g, '').trim()
            );
            categories['Industry-specific'] = lowercaseIndustryKeywords;
          }
          
          // Categorize skills
          const categorizedSkills: Record<string, string[]> = {
            'Technical': [],
            'Management': [],
            'Communication': [],
            'Analysis': [],
            'Design': [],
            'Industry-specific': [],
            'Other': []
          };
          
          // Assign each skill to a category
          skills.forEach((skill: string) => {
            const lowercaseSkill = skill.toLowerCase();
            let assigned = false;
            
            for (const [category, keywords] of Object.entries(categories)) {
              if (keywords.some(keyword => lowercaseSkill.includes(keyword))) {
                categorizedSkills[category].push(skill);
                assigned = true;
                break;
              }
            }
            
            if (!assigned) {
              categorizedSkills['Other'].push(skill);
            }
          });
          
          // Add categorized skills to document
          for (const [category, categorySkills] of Object.entries(categorizedSkills)) {
            if (categorySkills.length > 0) {
              // Add category header
              children.push(
                new Paragraph({
                  children: [
                    new TextRun({ 
                      text: category,
                      bold: true,
                      size: 24
                    })
                  ],
                  spacing: { before: 200, after: 100 }
                })
              );
              
              // Add skills in the category
              categorySkills.forEach(skill => {
                children.push(
                  new Paragraph({
                    text: skill,
                    bullet: { level: 0 },
                    spacing: { before: 100, after: 100 }
                  })
                );
              });
            }
          }
        } else {
          // For a smaller set of skills, just list them
          metadata.skills.forEach((skill: string) => {
            children.push(
              new Paragraph({
                text: skill,
                bullet: { level: 0 },
                spacing: { before: 100, after: 100 }
              })
            );
          });
        }
      } 
      // Next try to use skills from content sections
      else if (contentSections['SKILLS']) {
        // Otherwise, use the content from the SKILLS section
        const skillsLines = contentSections['SKILLS'].split('\n');
        skillsLines.forEach(line => {
          const trimmedLine = line.trim();
          if (trimmedLine.length === 0) return;
          const isBullet = trimmedLine.startsWith('-') || trimmedLine.startsWith('•') || trimmedLine.startsWith('*');
          if (isBullet) {
            children.push(
              new Paragraph({ text: trimmedLine.substring(1).trim(), bullet: { level: 0 }, spacing: { before: 100, after: 100 } })
            );
          } else {
            children.push(
              new Paragraph({ text: trimmedLine, spacing: { before: 100, after: 100 } })
            );
          }
        });
      } 
      // Try to get skills from industry-relevant keywords if we know the industry
      else if (metadata && metadata.industry) {
        const industrySkills = this.getIndustrySkills(metadata.industry);
        industrySkills.forEach(skill => {
          children.push(
            new Paragraph({
              text: skill,
              bullet: { level: 0 },
              spacing: { before: 100, after: 100 }
            })
          );
        });
      } else {
        // If no skills found, do not add any default skills
        children.push(
          new Paragraph({ 
            children: [
              new TextRun({ 
                text: "No specific skills found. Please add relevant skills in your CV.",
                italics: true 
              })
            ],
            spacing: { before: 100, after: 100 },
          })
        );
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
    
    return children;
  }
  
  /**
   * Identify sections in the CV content
   */
  private static identifySections(content: string): Record<string, string> {
    const sections: Record<string, string> = {};
    
    // Define section headers regex patterns for improved detection
    const sectionPatterns = [
      { name: 'PROFILE', pattern: /(?:profile|summary|about me|objective)(?:\n|:|\s{2,})(.*?)(?=\n\s*(?:education|experience|work|employment|skills|languages|interests|references|profile|summary|\Z)|\Z)/is },
      { name: 'EXPERIENCE', pattern: /(?:experience|work history|employment|professional background|career|work)(?:\n|:|\s{2,})(.*?)(?=\n\s*(?:education|skills|languages|interests|references|profile|summary|\Z)|\Z)/is },
      { name: 'EDUCATION', pattern: /(?:education|academic|qualifications|degrees|university|college)(?:\n|:|\s{2,})(.*?)(?=\n\s*(?:experience|work|employment|skills|languages|interests|references|profile|summary|\Z)|\Z)/is },
      { name: 'SKILLS', pattern: /(?:skills|proficiencies|competencies|expertise|technical skills|core competencies)(?:\n|:|\s{2,})(.*?)(?=\n\s*(?:education|experience|work|employment|languages|interests|references|profile|summary|\Z)|\Z)/is },
      { name: 'LANGUAGES', pattern: /(?:languages|linguistic skills|language proficiency)(?:\n|:|\s{2,})(.*?)(?=\n\s*(?:education|experience|work|employment|skills|interests|references|profile|summary|\Z)|\Z)/is },
      { name: 'INTERESTS', pattern: /(?:interests|hobbies|activities|extracurricular)(?:\n|:|\s{2,})(.*?)(?=\n\s*(?:education|experience|work|employment|skills|languages|references|profile|summary|\Z)|\Z)/is },
      { name: 'REFERENCES', pattern: /(?:references|referees)(?:\n|:|\s{2,})(.*?)(?=\n\s*(?:education|experience|work|employment|skills|languages|interests|profile|summary|\Z)|\Z)/is }
    ];
    
    // Additional keywords for better education section identification
    const educationKeywords = [
      'university', 'college', 'school', 'degree', 'bachelor', 'master', 'phd', 'doctorate', 
      'diploma', 'certificate', 'thesis', 'gpa', 'grade', 'graduated', 'graduation', 
      'major', 'minor', 'academic', 'study', 'studies', 'mba', 'bsc', 'ba', 'bs', 'ma', 'ms', 'msc'
    ];
    
    // Additional keywords for better work experience section identification
    const experienceKeywords = [
      'managed', 'led', 'developed', 'created', 'implemented', 'responsible', 'achievements',
      'delivered', 'improved', 'increased', 'reduced', 'supervised', 'team', 'project',
      'client', 'customer', 'report', 'business', 'strategy', 'market', 'sales', 'revenue',
      'manager', 'director', 'supervisor', 'position', 'role', 'company', 'organization', 'firm'
    ];
    
    // Try to find sections based on patterns
    sectionPatterns.forEach(({ name, pattern }) => {
      const match = content.match(pattern);
      if (match && match[1]) {
        sections[name] = match[1].trim();
      }
    });
    
    // Post-processing validation for education vs experience to reduce confusion
    if (sections['EDUCATION'] && sections['EXPERIENCE']) {
      // Check if education section contains more experience keywords than education keywords
      const educationText = sections['EDUCATION'].toLowerCase();
      const experienceText = sections['EXPERIENCE'].toLowerCase();
      
      let educationKeywordCount = 0;
      let experienceKeywordCount = 0;
      
      educationKeywords.forEach(keyword => {
        if (educationText.includes(keyword.toLowerCase())) {
          educationKeywordCount++;
        }
      });
      
      experienceKeywords.forEach(keyword => {
        if (educationText.includes(keyword.toLowerCase())) {
          experienceKeywordCount++;
        }
      });
      
      // If the education section has more experience keywords than education keywords,
      // it's likely mislabeled. Either merge with experience or keep separate depending on the difference.
      if (experienceKeywordCount > educationKeywordCount * 2) {
        // Very clear mismatch - merge with experience
        sections['EXPERIENCE'] += '\n' + sections['EDUCATION'];
        delete sections['EDUCATION'];
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
  
  /**
   * Get industry-specific skills for the given industry
   * @param industry The industry to get skills for
   * @returns Array of industry-specific skills
   */
  private static getIndustrySkills(industry: string): string[] {
    const industrySkills: Record<string, string[]> = {
      'Technology': [
        'Programming (e.g., Python, JavaScript, Java)',
        'Cloud Services (AWS, Azure, GCP)',
        'Version Control Systems (Git)',
        'Database Management',
        'Agile/Scrum Methodologies',
        'Software Development Lifecycle',
        'API Development & Integration',
        'DevOps Practices'
      ],
      'Finance': [
        'Financial Analysis',
        'Risk Management',
        'Financial Reporting',
        'Budgeting & Forecasting',
        'Regulatory Compliance',
        'Investment Analysis',
        'Banking Operations',
        'Financial Modeling'
      ],
      'Healthcare': [
        'Electronic Health Records (EHR)',
        'Healthcare Regulation Compliance',
        'Medical Terminology',
        'Patient Care',
        'Clinical Documentation',
        'Healthcare Informatics',
        'Care Coordination',
        'Medical Coding'
      ],
      'Marketing': [
        'Digital Marketing',
        'Social Media Management',
        'Content Creation',
        'SEO/SEM',
        'Brand Development',
        'Market Research',
        'Campaign Management',
        'Analytics & Performance Tracking'
      ],
      'Education': [
        'Curriculum Development',
        'Student Assessment',
        'Learning Management Systems',
        'Instructional Design',
        'Educational Technology',
        'Classroom Management',
        'Student Engagement Strategies',
        'Differentiated Instruction'
      ],
      'Manufacturing': [
        'Supply Chain Management',
        'Quality Control',
        'Lean Manufacturing',
        'Production Planning',
        'Inventory Management',
        'Process Improvement',
        'ERP Systems',
        'Six Sigma Methodologies'
      ]
    };
    
    // Return industry-specific skills if available, or general professional skills
    return industrySkills[industry] || [
      'Project Management',
      'Communication Skills',
      'Problem Solving',
      'Team Collaboration',
      'Time Management',
      'Analytical Thinking',
      'Adaptability',
      'Leadership'
    ];
  }
} 