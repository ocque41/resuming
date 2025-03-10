import { 
  Document, 
  Paragraph, 
  TextRun, 
  HeadingLevel, 
  AlignmentType, 
  Table, 
  TableRow, 
  TableCell, 
  WidthType, 
  BorderStyle, 
  VerticalAlign,
  TableLayoutType,
  Header,
  Footer,
  HorizontalPositionRelativeFrom,
  VerticalPositionRelativeFrom,
  PageNumber,
  ImageRun,
  IRunOptions,
  ShadingType,
  convertInchesToTwip,
  LevelFormat,
  UnderlineType
} from "docx";
import { Packer } from "docx";
import * as fs from 'fs';
import * as path from 'path';
import { promises as fsPromises } from 'fs';

// Define a standard CV structure
export interface StandardCV {
  profile: {
    name: string;
    phone: string;
    email: string;
    location: string;
  };
  careerGoal: string;
  achievements: string[];
  skills: {
    category: string;
    items: string[];
  }[];
  workExperience: {
    dateRange: string;
    jobTitle: string;
    company: string;
    achievements: string[];
  }[];
  education: {
    institution: string;
    degree: string;
    year: string;
  }[];
  languages: {
    language: string;
    proficiency: string;
  }[];
}

export async function generateCVDocx(cv: StandardCV): Promise<Buffer> {
  // Define styles and colors
  const accentColor = "B4916C"; // Gold accent color
  const darkTextColor = "333333"; // Dark gray for main text
  const lightTextColor = "666666"; // Light gray for secondary text
  const headingBackgroundColor = "F5F5F5"; // Light gray background for section headings
  
  // Create sections
  const headerSection = createHeaderSection(cv.profile);
  const careerGoalSection = createCareerGoalSection(cv.careerGoal);
  const achievementsSection = createAchievementsSection(cv.achievements);
  const skillsSection = createSkillsSection(cv.skills);
  const workExperienceSection = createWorkExperienceSection(cv.workExperience);
  const educationSection = createEducationSection(cv.education);
  const languagesSection = createLanguagesSection(cv.languages);
  const footerSection = createFooterSection();
  
  // Create document
  const doc = new Document({
    styles: {
      paragraphStyles: [
        {
          id: "Heading1",
          name: "Heading 1",
          basedOn: "Normal",
          next: "Normal",
          quickFormat: true,
          run: {
            font: "Arial",
            size: 28,
            bold: true,
            color: accentColor,
          },
          paragraph: {
            spacing: {
              after: 200,
              before: 200,
            },
          },
        },
        {
          id: "Heading2",
          name: "Heading 2",
          basedOn: "Normal",
          next: "Normal",
          quickFormat: true,
          run: {
            font: "Arial",
            size: 24,
            bold: true,
            color: accentColor,
          },
          paragraph: {
            spacing: {
              after: 120,
            },
          },
        },
        {
          id: "SectionHeading",
          name: "Section Heading",
          basedOn: "Normal",
          next: "Normal",
          quickFormat: true,
          run: {
            font: "Arial",
            size: 22,
            bold: true,
            color: darkTextColor,
          },
          paragraph: {
            spacing: {
              after: 120,
              before: 240,
            },
            shading: {
              type: ShadingType.SOLID,
              color: headingBackgroundColor,
            },
          },
        },
        {
          id: "BodyText",
          name: "Body Text",
          basedOn: "Normal",
          next: "Normal",
          quickFormat: true,
          run: {
            font: "Arial",
            size: 22,
            color: darkTextColor,
          },
          paragraph: {
            spacing: {
              after: 80,
              line: 360, // 1.5 line spacing
            },
          },
        },
        {
          id: "BulletPoint",
          name: "Bullet Point",
          basedOn: "BodyText",
          next: "BodyText",
          quickFormat: true,
          paragraph: {
            indent: {
              left: convertInchesToTwip(0.25),
              hanging: convertInchesToTwip(0.25)
            },
            spacing: {
              after: 80
            }
          }
        },
      ],
    },
    numbering: {
      config: [
        {
          reference: "bullet-points",
          levels: [
            {
              level: 0,
              format: LevelFormat.BULLET,
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
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 720, // 0.5 inch
              right: 720, // 0.5 inch
              bottom: 720, // 0.5 inch
              left: 720, // 0.5 inch
            },
          },
        },
        headers: {
          default: headerSection,
        },
        footers: {
          default: footerSection,
        },
        children: [
          ...careerGoalSection,
          ...achievementsSection,
          ...skillsSection,
          ...workExperienceSection,
          ...educationSection,
          ...languagesSection,
        ],
      },
    ],
  });
  
  // Generate buffer
  const buffer = await Packer.toBuffer(doc);
  return buffer;
}

function createHeaderSection(profile: StandardCV['profile']): Header {
  // Return a header with the name and contact information
  return new Header({
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({
            text: profile.name.toUpperCase(),
            bold: true,
            size: 36,
            color: "000000",
          }),
        ],
        spacing: { after: 120 },
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({
            text: `${profile.phone} • ${profile.email} • ${profile.location}`,
            size: 22,
            color: "666666",
          }),
        ],
        spacing: { after: 240 }, // More space after contact info
      }),
      // Add horizontal line
      new Paragraph({
        children: [
          new TextRun({
            text: "",
          }),
        ],
        border: {
          bottom: {
            color: "DDDDDD",
            space: 1,
            style: BorderStyle.SINGLE,
            size: 8,
          },
        },
        spacing: { after: 240 },
      }),
    ],
  });
}

function createFooterSection(): Footer {
  return new Footer({
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({
            text: "Page ",
            size: 18,
            color: "666666",
          }),
          new TextRun({
            children: [PageNumber.CURRENT],
            size: 18,
            color: "666666",
          }),
          new TextRun({
            text: " of ",
            size: 18,
            color: "666666",
          }),
          new TextRun({
            children: [PageNumber.TOTAL_PAGES],
            size: 18,
            color: "666666",
          }),
        ],
      }),
    ],
  });
}

function createCareerGoalSection(careerGoal: string): Paragraph[] {
  return [
    new Paragraph({
      style: "SectionHeading",
      children: [
        new TextRun({
          text: "CAREER GOAL",
          bold: true,
          color: "B4916C",
        }),
      ],
      border: {
        bottom: {
          color: "B4916C",
          style: BorderStyle.SINGLE,
          size: 15,
        },
      },
    }),
    new Paragraph({
      style: "BodyText",
      children: [
        new TextRun({
          text: careerGoal,
        }),
      ],
      spacing: { after: 240 }, // Extra space after section
    }),
  ];
}

function createAchievementsSection(achievements: string[]): Paragraph[] {
  const paragraphs: Paragraph[] = [
    new Paragraph({
      style: "SectionHeading",
      children: [
        new TextRun({
          text: "KEY ACHIEVEMENTS",
          bold: true,
          color: "B4916C",
        }),
      ],
      border: {
        bottom: {
          color: "B4916C",
          style: BorderStyle.SINGLE,
          size: 15,
        },
      },
    }),
  ];
  
  // Add achievements as bullet points
  achievements.forEach((achievement) => {
    paragraphs.push(
      new Paragraph({
        style: "BulletPoint",
        numbering: {
          reference: "bullet-points",
          level: 0,
        },
        children: [
          new TextRun({
            text: achievement,
          }),
        ],
      })
    );
  });
  
  // Add extra space after section
  paragraphs.push(new Paragraph({ spacing: { after: 240 } }));
  return paragraphs;
}

function createSkillsSection(skills: StandardCV['skills']): Paragraph[] {
  const paragraphs: Paragraph[] = [
    new Paragraph({
      style: "SectionHeading",
      children: [
        new TextRun({
          text: "SKILLS",
          bold: true,
          color: "B4916C",
        }),
      ],
      border: {
        bottom: {
          color: "B4916C",
          style: BorderStyle.SINGLE,
          size: 15,
        },
      },
    }),
  ];
  
  // Create table rows
  const rows: TableRow[] = [];
  
  // Process skills in groups of 3 categories per row
  for (let i = 0; i < skills.length; i += 3) {
    const tableCells: TableCell[] = [];
    
    // Add up to 3 categories in this row
    for (let j = 0; j < 3 && i + j < skills.length; j++) {
      const skill = skills[i + j];
      const cellParagraphs: Paragraph[] = [
        new Paragraph({
          children: [
            new TextRun({
              text: skill.category,
              bold: true,
              size: 22,
              color: "B4916C",
            }),
          ],
          spacing: { after: 80 },
        }),
      ];
      
      // Add skill items as bullet points
      skill.items.forEach((item) => {
        cellParagraphs.push(
          new Paragraph({
            numbering: {
              reference: "bullet-points",
              level: 0,
            },
            children: [
              new TextRun({
                text: item,
                size: 20,
              }),
            ],
            spacing: { after: 60 },
          })
        );
      });
      
      tableCells.push(
        new TableCell({
          children: cellParagraphs,
          width: {
            size: 33.33,
            type: WidthType.PERCENTAGE,
          },
          verticalAlign: VerticalAlign.TOP,
          margins: {
            top: 80,
            bottom: 80,
            left: 160,
            right: 160,
          },
        })
      );
    }
    
    // If we have fewer than 3 categories, add empty cells to maintain layout
    while (tableCells.length < 3) {
      tableCells.push(
        new TableCell({
          children: [new Paragraph("")],
          width: {
            size: 33.33,
            type: WidthType.PERCENTAGE,
          },
        })
      );
    }
    
    rows.push(new TableRow({ children: tableCells }));
  }
  
  // Create the table
  const skillsTable = new Table({
    width: {
      size: 100,
      type: WidthType.PERCENTAGE,
    },
    rows,
    layout: TableLayoutType.FIXED,
    borders: {
      insideHorizontal: {
        style: BorderStyle.NONE,
      },
      insideVertical: {
        style: BorderStyle.NONE,
      },
      top: {
        style: BorderStyle.NONE,
      },
      bottom: {
        style: BorderStyle.NONE,
      },
      left: {
        style: BorderStyle.NONE,
      },
      right: {
        style: BorderStyle.NONE,
      },
    },
  });
  
  // Add table to paragraphs as a child of a paragraph
  paragraphs.push(new Paragraph({ children: [skillsTable] }));
  
  // Add extra space after section
  paragraphs.push(new Paragraph({ spacing: { after: 240 } }));
  return paragraphs;
}

function createWorkExperienceSection(workExperience: StandardCV['workExperience']): Paragraph[] {
  const paragraphs: Paragraph[] = [
    new Paragraph({
      style: "SectionHeading",
      children: [
        new TextRun({
          text: "WORK EXPERIENCE",
          bold: true,
          color: "B4916C",
        }),
      ],
      border: {
        bottom: {
          color: "B4916C",
          style: BorderStyle.SINGLE,
          size: 15,
        },
      },
    }),
  ];
  
  // Add each work experience
  workExperience.forEach((experience, index) => {
    // Date range
    paragraphs.push(
      new Paragraph({
        style: "BodyText",
        children: [
          new TextRun({
            text: experience.dateRange,
            italics: true,
            color: "B4916C",
            size: 22,
          }),
        ],
        spacing: { after: 60 },
      })
    );
    
    // Job title
    paragraphs.push(
      new Paragraph({
        style: "BodyText",
        children: [
          new TextRun({
            text: experience.jobTitle,
            bold: true,
            size: 24,
          }),
        ],
        spacing: { after: 60 },
      })
    );
    
    // Company
    paragraphs.push(
      new Paragraph({
        style: "BodyText",
        children: [
          new TextRun({
            text: experience.company,
            size: 22,
            allCaps: true,
          }),
        ],
        spacing: { after: 120 },
      })
    );
    
    // Achievements as bullet points
    experience.achievements.forEach((achievement) => {
      paragraphs.push(
        new Paragraph({
          style: "BulletPoint",
          numbering: {
            reference: "bullet-points",
            level: 0,
          },
          children: [
            new TextRun({
              text: achievement,
              size: 22,
            }),
          ],
        })
      );
    });
    
    // Add extra spacing between experiences (except after the last one)
    if (index < workExperience.length - 1) {
      paragraphs.push(new Paragraph({ spacing: { after: 240 } }));
    }
  });
  
  // Add extra space after section
  paragraphs.push(new Paragraph({ spacing: { after: 240 } }));
  return paragraphs;
}

function createEducationSection(education: StandardCV['education']): Paragraph[] {
  const paragraphs: Paragraph[] = [
    new Paragraph({
      style: "SectionHeading",
      children: [
        new TextRun({
          text: "EDUCATION",
          bold: true,
          color: "B4916C",
        }),
      ],
      border: {
        bottom: {
          color: "B4916C",
          style: BorderStyle.SINGLE,
          size: 15,
        },
      },
    }),
  ];
  
  // Create a table for education (3 columns)
  const tableCells: TableCell[] = [];
  
  education.forEach((edu) => {
    tableCells.push(
      new TableCell({
        children: [
          new Paragraph({
            children: [
              new TextRun({
                text: edu.institution,
                bold: true,
                size: 22,
              }),
            ],
            spacing: { after: 60 },
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: edu.degree,
                size: 22,
              }),
            ],
            spacing: { after: 60 },
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: edu.year,
                italics: true,
                size: 22,
              }),
            ],
          }),
        ],
        width: {
          size: 33.33,
          type: WidthType.PERCENTAGE,
        },
        verticalAlign: VerticalAlign.TOP,
        margins: {
          top: 80,
          bottom: 80,
          left: 160,
          right: 160,
        },
      })
    );
  });
  
  // Fill remaining cells if needed
  while (tableCells.length < 3) {
    tableCells.push(
      new TableCell({
        children: [new Paragraph("")],
        width: {
          size: 33.33,
          type: WidthType.PERCENTAGE,
        },
      })
    );
  }
  
  // Only add 3 items per row
  const rows: TableRow[] = [];
  for (let i = 0; i < tableCells.length; i += 3) {
    rows.push(
      new TableRow({
        children: tableCells.slice(i, i + 3),
      })
    );
  }
  
  const educationTable = new Table({
    width: {
      size: 100,
      type: WidthType.PERCENTAGE,
    },
    rows,
    layout: TableLayoutType.FIXED,
    borders: {
      insideHorizontal: {
        style: BorderStyle.NONE,
      },
      insideVertical: {
        style: BorderStyle.NONE,
      },
      top: {
        style: BorderStyle.NONE,
      },
      bottom: {
        style: BorderStyle.NONE,
      },
      left: {
        style: BorderStyle.NONE,
      },
      right: {
        style: BorderStyle.NONE,
      },
    },
  });
  
  // Add table to paragraphs as a child of a paragraph
  paragraphs.push(new Paragraph({ children: [educationTable] }));
  
  // Add extra space after section
  paragraphs.push(new Paragraph({ spacing: { after: 240 } }));
  return paragraphs;
}

function createLanguagesSection(languages: StandardCV['languages']): Paragraph[] {
  const paragraphs: Paragraph[] = [
    new Paragraph({
      style: "SectionHeading",
      children: [
        new TextRun({
          text: "LANGUAGES",
          bold: true,
          color: "B4916C",
        }),
      ],
      border: {
        bottom: {
          color: "B4916C",
          style: BorderStyle.SINGLE,
          size: 15,
        },
      },
    }),
  ];
  
  // Create a table for languages (3 columns)
  const tableCells: TableCell[] = [];
  
  languages.forEach((lang) => {
    tableCells.push(
      new TableCell({
        children: [
          new Paragraph({
            children: [
              new TextRun({
                text: lang.language,
                bold: true,
                size: 22,
              }),
            ],
            spacing: { after: 60 },
          }),
          // Create a visual representation of proficiency
          createProficiencyBar(lang.proficiency),
        ],
        width: {
          size: 33.33,
          type: WidthType.PERCENTAGE,
        },
        margins: {
          top: 80,
          bottom: 80,
          left: 160,
          right: 160,
        },
      })
    );
  });
  
  // Fill remaining cells if needed
  while (tableCells.length < 3) {
    tableCells.push(
      new TableCell({
        children: [new Paragraph("")],
        width: {
          size: 33.33,
          type: WidthType.PERCENTAGE,
        },
      })
    );
  }
  
  // Only add 3 items per row
  const rows: TableRow[] = [];
  for (let i = 0; i < tableCells.length; i += 3) {
    rows.push(
      new TableRow({
        children: tableCells.slice(i, i + 3),
      })
    );
  }
  
  const languagesTable = new Table({
    width: {
      size: 100,
      type: WidthType.PERCENTAGE,
    },
    rows,
    layout: TableLayoutType.FIXED,
    borders: {
      insideHorizontal: {
        style: BorderStyle.NONE,
      },
      insideVertical: {
        style: BorderStyle.NONE,
      },
      top: {
        style: BorderStyle.NONE,
      },
      bottom: {
        style: BorderStyle.NONE,
      },
      left: {
        style: BorderStyle.NONE,
      },
      right: {
        style: BorderStyle.NONE,
      },
    },
  });
  
  // Add table to paragraphs as a child of a paragraph
  paragraphs.push(new Paragraph({ children: [languagesTable] }));
  
  return paragraphs;
}

function createProficiencyBar(proficiency: string): Paragraph {
  // Determine proficiency level (0-100)
  let level = 70; // Default to 70%
  
  // Parse proficiency text
  const lowerProf = proficiency.toLowerCase();
  if (lowerProf.includes('native') || lowerProf.includes('fluent') || lowerProf.includes('advanced')) {
    level = 90;
  } else if (lowerProf.includes('intermediate')) {
    level = 70;
  } else if (lowerProf.includes('basic') || lowerProf.includes('beginner')) {
    level = 40;
  } else if (lowerProf.includes('%')) {
    // Extract percentage if provided
    const match = lowerProf.match(/(\d+)%/);
    if (match && match[1]) {
      level = Math.min(100, Math.max(0, parseInt(match[1])));
    }
  }
  
  // Create visual bar - unfortunately docx doesn't support progress bars directly
  // We'll use special characters to create a visual representation
  const fullBlocks = Math.floor(level / 10);
  const barText = '■'.repeat(fullBlocks) + '□'.repeat(10 - fullBlocks);
  
  return new Paragraph({
    children: [
      new TextRun({
        text: barText,
        color: "B4916C",
        size: 20,
      }),
    ],
  });
}

// Helper function to parse a standardized CV from sections
export function parseStandardCVFromSections(sections: Record<string, string>): StandardCV {
  // Make sure sections exist, if not use empty object
  sections = sections || {};
  
  // Parse profile information - use more careful extraction to get real data
  const profileText = sections["PROFILE"] || sections["PERSONAL INFORMATION"] || sections["CONTACT"] || "";
  const profileLines = profileText.split('\n').filter(line => line.trim());
  
  // Extract name - first line is usually the name
  const nameLineIndex = profileLines.findIndex(line => 
    line.trim() && 
    !line.includes('@') && 
    !/phone|mobile|\+|\d{3}[-.\s]?\d{3}[-.\s]?\d{4}/i.test(line)
  );
  const nameLine = nameLineIndex !== -1 ? profileLines[nameLineIndex] : profileLines[0] || "";
  
  // Extract phone - look for numbers and common phone formats
  const phoneLineIndex = profileLines.findIndex(line => 
    /phone|mobile|\+|\d{3}[-.\s]?\d{3}[-.\s]?\d{4}/i.test(line)
  );
  const phoneLine = phoneLineIndex !== -1 ? profileLines[phoneLineIndex] : "";
  // Extract just the phone number if there's additional text
  const phoneMatch = phoneLine.match(/(\+?[\d\s\-\(\)\.]{7,})/);
  const phoneNumber = phoneMatch ? phoneMatch[1].trim() : phoneLine;
  
  // Extract email - look for @ symbol
  const emailLineIndex = profileLines.findIndex(line => line.includes('@'));
  const emailLine = emailLineIndex !== -1 ? profileLines[emailLineIndex] : "";
  // Extract just the email if there's additional text
  const emailMatch = emailLine.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
  const email = emailMatch ? emailMatch[1].trim() : emailLine;
  
  // Extract location - lines that aren't name, phone, or email
  // Fix: Use filter instead of findIndex to handle multiple potential location lines
  const locationLines = profileLines.filter(line => 
    line.trim() && 
    !line.includes('@') && 
    !/phone|mobile|\+|\d{3}[-.\s]?\d{3}[-.\s]?\d{4}/i.test(line) &&
    line !== nameLine
  );
  
  // Use the first location line found or empty string
  const locationLine = locationLines.length > 0 ? locationLines[0] : "";
  
  // Create the profile object with best available data
  const profile = {
    name: nameLine.trim() || "CV Owner",
    phone: phoneNumber.trim() || "",
    email: email.trim() || "",
    location: locationLine.trim() || ""
  };
  
  // Parse career goal - use actual content or leave empty
  const careerGoalText = sections["CAREER GOAL"] || sections["SUMMARY"] || sections["OBJECTIVE"] || sections["PROFESSIONAL SUMMARY"] || "";
  const careerGoal = careerGoalText.trim();
  
  // Parse achievements - use actual achievements or leave empty
  const achievementText = sections["ACHIEVEMENTS"] || sections["ACCOMPLISHMENTS"] || "";
  const achievementLines = achievementText.split('\n')
    .filter(line => line.trim())
    .map(line => line.replace(/^[-•*]\s*/, '').trim());
  
  // Ensure achievements is always an array, even if empty
  const achievements = achievementLines || [];
  
  // Parse skills section - identify real skills
  const skillsText = sections["SKILLS"] || sections["CORE COMPETENCIES"] || sections["TECHNICAL SKILLS"] || "";
  const skillCategories: StandardCV['skills'] = [];
  
  // Try to parse skill categories
  const categoryPattern = /([A-Za-z\s&]+):\s*\n((?:[-•*]?[^\n]+\n?)+)/g;
  let match;
  let matchFound = false;
  
  while ((match = categoryPattern.exec(skillsText)) !== null) {
    matchFound = true;
    const category = match[1].trim();
    const items = match[2]
      .split('\n')
      .map(line => line.replace(/^[-•*]\s*/, '').trim())
      .filter(line => line);
    
    if (items.length > 0) {
      skillCategories.push({ category, items });
    }
  }
  
  // If no categories were found using the pattern, split by lines
  if (!matchFound) {
    const allSkills = skillsText
      .split(/[,;\n]/)
      .map(skill => skill.replace(/^[-•*]\s*/, '').trim())
      .filter(skill => skill.length > 1); // Filter out single characters
    
    if (allSkills.length > 0) {
      // Check if we can group skills by common characteristics
      const technicalSkills = allSkills.filter(skill => 
        /software|programming|development|coding|database|system|data|technical|technology|engineering|analysis|framework|language|sql|python|java|javascript|aws|cloud/i.test(skill));
      
      const softSkills = allSkills.filter(skill => 
        /communication|leadership|team|management|organization|planning|problem.solving|critical|presentation|negotiation|interpersonal/i.test(skill));
      
      const domainSkills = allSkills.filter(skill => 
        !technicalSkills.includes(skill) && !softSkills.includes(skill));
      
      if (technicalSkills.length > 0) {
        skillCategories.push({ category: "Technical Skills", items: technicalSkills });
      }
      
      if (softSkills.length > 0) {
        skillCategories.push({ category: "Soft Skills", items: softSkills });
      }
      
      if (domainSkills.length > 0) {
        skillCategories.push({ category: "Domain Expertise", items: domainSkills });
      }
      
      // If the filtering didn't work well, just use all skills
      if (skillCategories.length === 0) {
        skillCategories.push({ category: "Professional Skills", items: allSkills });
      }
    } else {
      // Ensure we have at least an empty category to avoid array length errors
      skillCategories.push({ category: "Skills", items: [] });
    }
  }
  
  // Parse work experience - extract real experience data
  const workExperienceText = sections["WORK EXPERIENCE"] || sections["EXPERIENCE"] || sections["EMPLOYMENT"] || sections["PROFESSIONAL EXPERIENCE"] || "";
  const experienceEntries: StandardCV['workExperience'] = [];
  
  // Split by double newlines or date patterns
  const experienceBlocks = workExperienceText.split(/\n\s*\n/);
  
  for (const block of experienceBlocks) {
    if (!block.trim()) continue;
    
    const lines = block.split('\n').map(line => line.trim()).filter(line => line);
    if (lines.length < 2) continue;
    
    // Find date line, job title, company, and achievements
    const dateRangeIndex = lines.findIndex(line => 
      /\b(19|20)\d{2}\b/.test(line) || 
      /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b/i.test(line) ||
      /present|current|now/i.test(line)
    );
    
    // If we can't find a date line, make best guess about structure
    let dateRange = '';
    let jobTitle = '';
    let company = '';
    let achievementLines: string[] = [];
    
    if (dateRangeIndex !== -1) {
      dateRange = lines[dateRangeIndex];
      jobTitle = dateRangeIndex + 1 < lines.length ? lines[dateRangeIndex + 1] : '';
      company = dateRangeIndex + 2 < lines.length ? lines[dateRangeIndex + 2] : '';
      achievementLines = lines.slice(dateRangeIndex + 3);
    } else {
      // No clear date found, assume first line is title, second is company
      jobTitle = lines[0];
      company = lines.length > 1 ? lines[1] : '';
      achievementLines = lines.slice(2);
    }
    
    // Clean up and extract achievements
    const achievements = achievementLines
      .map(line => line.replace(/^[-•*]\s*/, '').trim())
      .filter(line => line);
    
    // Only add if we have at least job title and company
    if (jobTitle) {
      experienceEntries.push({
        dateRange: dateRange || '',
        jobTitle: jobTitle || '',
        company: company || '',
        achievements: achievements || []
      });
    }
  }
  
  // If no experience entries were found, add a placeholder to avoid array length errors
  if (experienceEntries.length === 0) {
    experienceEntries.push({
      dateRange: '',
      jobTitle: '',
      company: '',
      achievements: []
    });
  }
  
  // Parse education
  const educationText = sections["EDUCATION"] || sections["ACADEMIC BACKGROUND"] || "";
  const educationEntries: StandardCV['education'] = [];
  
  // Split by double newlines
  const educationBlocks = educationText.split(/\n\s*\n/);
  
  for (const block of educationBlocks) {
    if (!block.trim()) continue;
    
    const lines = block.split('\n').map(line => line.trim()).filter(line => line);
    if (lines.length < 1) continue;
    
    // Try to identify institution and degree, with year
    const institution = lines[0] || "";
    const degree = lines.length > 1 ? lines[1] : "";
    
    // Try to find a year in the text
    const yearMatch = block.match(/\b(19|20)\d{2}\b/);
    const year = yearMatch ? yearMatch[0] : "";
    
    // Only add if we have at least institution
    if (institution) {
      educationEntries.push({
        institution,
        degree,
        year
      });
    }
  }
  
  // If no education entries were found, add a placeholder to avoid array length errors
  if (educationEntries.length === 0) {
    educationEntries.push({
      institution: '',
      degree: '',
      year: ''
    });
  }
  
  // Parse languages
  const languagesText = sections["LANGUAGES"] || "";
  const languageEntries: StandardCV['languages'] = [];
  
  const languageLines = languagesText.split('\n')
    .map(line => line.trim())
    .filter(line => line);
  
  for (const line of languageLines) {
    // Try to identify language and proficiency
    const parts = line.split(/[-–:,]/);
    if (parts.length > 0) {
      const language = parts[0].trim();
      const proficiency = parts.length > 1 ? parts[1].trim() : "Proficient";
      
      if (language) {
        languageEntries.push({
          language,
          proficiency
        });
      }
    }
  }
  
  // If no language entries were found, add a placeholder to avoid array length errors
  if (languageEntries.length === 0) {
    languageEntries.push({
      language: '',
      proficiency: ''
    });
  }
  
  // Create the standardized CV object with all parsed data
  return {
    profile,
    careerGoal,
    achievements,
    skills: skillCategories,
    workExperience: experienceEntries,
    education: educationEntries,
    languages: languageEntries
  };
}

interface CVSection {
  title: string;
  content: string;
}

interface FormattedCV {
  profile: string;
  achievements: string[];
  experience: {
    company: string;
    position: string;
    duration: string;
    responsibilities: string[];
  }[];
  skills: string[];
  education: {
    degree: string;
    institution: string;
    year: string;
  }[];
  languages: {
    language: string;
    proficiency: string;
  }[];
}

/**
 * Parses sections from markdown-formatted CV text
 */
export function parseMarkdownSections(cvText: string): Record<string, string> {
  const sections: Record<string, string> = {};
  
  // Split the text by headings (lines starting with #)
  const sectionRegex = /(?:^|\n)#\s+([A-Z\s]+)\s*\n([\s\S]*?)(?=(?:\n#\s+[A-Z\s]+)|$)/g;
  
  let match;
  while ((match = sectionRegex.exec(cvText)) !== null) {
    const sectionName = match[1].trim();
    const sectionContent = match[2].trim();
    sections[sectionName] = sectionContent;
  }
  
  return sections;
}

/**
 * Parse the optimized CV text into a structured format
 */
export function parseOptimizedCV(optimizedText: string): FormattedCV {
  const sections = parseMarkdownSections(optimizedText);
  
  // Parse profile
  const profile = sections['PROFILE'] || '';
  
  // Parse achievements
  const achievementsText = sections['ACHIEVEMENTS'] || '';
  const achievements = achievementsText
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.startsWith('-'))
    .map(line => line.substring(1).trim());
  
  // Parse experience
  const experienceText = sections['EXPERIENCE'] || '';
  const experienceBlocks = experienceText.split(/\n##\s+/).filter(Boolean);
  if (experienceBlocks[0] && !experienceBlocks[0].startsWith('##')) {
    experienceBlocks[0] = experienceBlocks[0].replace(/^#*\s+/, '');
  }
  
  const experience = experienceBlocks.map(block => {
    const lines = block.split('\n').filter(line => line.trim());
    const headerLine = lines[0] || '';
    
    // Parse company and position (format: "Company Name - Position (Start Date - End Date)")
    const headerMatch = headerLine.match(/(.*?)\s*-\s*(.*?)\s*\((.*?)\)/);
    
    const company = headerMatch ? headerMatch[1].trim() : headerLine;
    const position = headerMatch ? headerMatch[2].trim() : '';
    const duration = headerMatch ? headerMatch[3].trim() : '';
    
    // Parse responsibilities (bullet points)
    const responsibilities = lines
      .slice(1)
      .filter(line => line.trim().startsWith('-'))
      .map(line => line.substring(1).trim());
    
    return {
      company,
      position,
      duration,
      responsibilities
    };
  });
  
  // Parse skills
  const skillsText = sections['SKILLS'] || '';
  const skills = skillsText
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.startsWith('-'))
    .map(line => line.substring(1).trim());
  
  // Parse education
  const educationText = sections['EDUCATION'] || '';
  const educationLines = educationText
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean);
  
  const education = educationLines.map(line => {
    // Format: "[Degree] in [Field of Study], [Institution], [Graduation Year]"
    const matches = line.match(/(.*?)\s*,\s*(.*?)(?:\s*,\s*(.*))?$/);
    
    if (matches) {
      return {
        degree: matches[1] || '',
        institution: matches[2] || '',
        year: matches[3] || ''
      };
    }
    
    return {
      degree: line,
      institution: '',
      year: ''
    };
  });
  
  // Parse languages
  const languagesText = sections['LANGUAGES'] || '';
  const languageLines = languagesText
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean);
  
  const languages = languageLines.map(line => {
    // Format: "[Language]: [Proficiency Level]"
    const parts = line.split(':').map(part => part.trim());
    
    return {
      language: parts[0] || '',
      proficiency: parts[1] || ''
    };
  });
  
  return {
    profile,
    achievements,
    experience,
    skills,
    education,
    languages
  };
}

/**
 * Generate a DOCX file from optimized CV content
 */
export async function generateOptimizedCVDocx(
  optimizedContent: string,
  outputDir: string = '/tmp',
  fileName: string = 'optimized-cv.docx'
): Promise<{ filePath: string; base64: string }> {
  // Parse the optimized CV content
  const formattedCV = parseOptimizedCV(optimizedContent);
  
  // Create document
  const doc = new Document({
    styles: {
      default: {
        heading1: {
          run: {
            size: 28,
            bold: true,
            color: "2F5496",
          },
          paragraph: {
            spacing: {
              after: 120,
            },
          },
        },
        heading2: {
          run: {
            size: 26,
            bold: true,
            color: "2F5496",
          },
          paragraph: {
            spacing: {
              after: 120,
            },
          },
        },
      }
    },
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
        children: [
          // Profile Section
          new Paragraph({
            text: "PROFILE",
            heading: HeadingLevel.HEADING_1,
            thematicBreak: true,
          }),
          new Paragraph({
            text: formattedCV.profile,
            spacing: {
              after: 200,
            },
          }),
          
          // Achievements Section
          new Paragraph({
            text: "ACHIEVEMENTS",
            heading: HeadingLevel.HEADING_1,
            thematicBreak: true,
          }),
          ...formattedCV.achievements.map(
            achievement => new Paragraph({
              text: achievement,
              bullet: {
                level: 0,
              },
              spacing: {
                after: 120,
              },
            })
          ),
          new Paragraph({
            text: "",
            spacing: {
              after: 200,
            },
          }),
          
          // Experience Section
          new Paragraph({
            text: "EXPERIENCE",
            heading: HeadingLevel.HEADING_1,
            thematicBreak: true,
          }),
          ...formattedCV.experience.flatMap(exp => [
            new Paragraph({
              text: `${exp.company} - ${exp.position}`,
              heading: HeadingLevel.HEADING_2,
              spacing: {
                after: 80,
              },
            }),
            new Paragraph({
              text: exp.duration,
              spacing: {
                after: 120,
              },
            }),
            ...exp.responsibilities.map(
              resp => new Paragraph({
                text: resp,
                bullet: {
                  level: 0,
                },
                spacing: {
                  after: 80,
                },
              })
            ),
            new Paragraph({
              text: "",
              spacing: {
                after: 160,
              },
            }),
          ]),
          
          // Skills Section
          new Paragraph({
            text: "SKILLS",
            heading: HeadingLevel.HEADING_1,
            thematicBreak: true,
          }),
          ...formattedCV.skills.map(
            skill => new Paragraph({
              text: skill,
              bullet: {
                level: 0,
              },
              spacing: {
                after: 80,
              },
            })
          ),
          new Paragraph({
            text: "",
            spacing: {
              after: 200,
            },
          }),
          
          // Education Section
          new Paragraph({
            text: "EDUCATION",
            heading: HeadingLevel.HEADING_1,
            thematicBreak: true,
          }),
          ...formattedCV.education.flatMap(edu => [
            new Paragraph({
              text: edu.degree,
              heading: HeadingLevel.HEADING_2,
              spacing: {
                after: 80,
              },
            }),
            new Paragraph({
              text: `${edu.institution}${edu.year ? `, ${edu.year}` : ''}`,
              spacing: {
                after: 160,
              },
            }),
          ]),
          
          // Languages Section
          new Paragraph({
            text: "LANGUAGES",
            heading: HeadingLevel.HEADING_1,
            thematicBreak: true,
          }),
          ...formattedCV.languages.map(
            lang => new Paragraph({
              text: `${lang.language}: ${lang.proficiency}`,
              spacing: {
                after: 80,
              },
            })
          ),
        ],
      },
    ],
  });
  
  // Ensure the output directory exists
  try {
    await fsPromises.mkdir(outputDir, { recursive: true });
  } catch (error) {
    console.error('Error creating output directory:', error);
  }
  
  // Generate file path
  const filePath = path.join(outputDir, fileName);
  
  // Create a buffer with the docx
  const buffer = await Packer.toBuffer(doc);
  
  // Write the file to disk
  await fsPromises.writeFile(filePath, buffer);
  
  // Convert to base64 for preview or download
  const base64 = buffer.toString('base64');
  
  return {
    filePath,
    base64,
  };
}

/**
 * Extract sections from raw CV text
 */
export function extractSections(rawText: string): CVSection[] {
  const sections: CVSection[] = [];
  const sectionTitles = [
    'PROFILE', 'SUMMARY', 'ABOUT', 'OBJECTIVE',
    'EXPERIENCE', 'WORK EXPERIENCE', 'EMPLOYMENT', 'PROFESSIONAL EXPERIENCE',
    'EDUCATION', 'ACADEMIC BACKGROUND', 'QUALIFICATIONS',
    'SKILLS', 'COMPETENCIES', 'TECHNICAL SKILLS',
    'LANGUAGES', 'LANGUAGE PROFICIENCY',
    'CERTIFICATIONS', 'CERTIFICATES', 'LICENSES',
    'PROJECTS', 'ACHIEVEMENTS', 'AWARDS'
  ];
  
  // Split text into lines
  const lines = rawText.split(/\r?\n/);
  let currentSection: CVSection | null = null;
  
  for (const line of lines) {
    const trimmedLine = line.trim();
    
    // Skip empty lines
    if (!trimmedLine) continue;
    
    // Check if this line is a section title
    const isSectionTitle = sectionTitles.some(title => 
      trimmedLine.toUpperCase().includes(title) && 
      (trimmedLine.toUpperCase() === title || 
       trimmedLine.toUpperCase().startsWith(title + ':') ||
       trimmedLine.toUpperCase().startsWith(title + ' '))
    );
    
    if (isSectionTitle) {
      // If we were building a section, push it to our array
      if (currentSection) {
        sections.push(currentSection);
      }
      
      // Start a new section
      currentSection = {
        title: trimmedLine,
        content: ''
      };
    } else if (currentSection) {
      // Add this line to the current section
      currentSection.content += (currentSection.content ? '\n' : '') + trimmedLine;
    }
  }
  
  // Add the last section if it exists
  if (currentSection) {
    sections.push(currentSection);
  }
  
  return sections;
}

export async function generateFormattedCVDocx(
  cvContent: string, 
  template: string = 'professional', 
  outputDir: string = '/tmp',
  fileName: string = 'cv.docx'
): Promise<{ filePath: string; base64: string }> {
  // For now, we'll just use a basic template and delegate to our optimized function
  return generateOptimizedCVDocx(cvContent, outputDir, fileName);
} 