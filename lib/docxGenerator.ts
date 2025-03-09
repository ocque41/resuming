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
  
  // Parse profile
  const profileText = sections["PROFILE"] || "";
  const profileLines = profileText.split('\n').filter(line => line.trim());
  const profile = {
    name: profileLines[0] || "NAME LAST NAME",
    phone: profileLines.find(line => /phone|^\+|\d{3}[-.\s]?\d{3}[-.\s]?\d{4}|^\d+$/.test(line.toLowerCase())) || 
           profileLines[1] || "+01 234 567 890",
    email: profileLines.find(line => line.includes('@')) || 
           profileLines[2] || "email@example.com",
    location: profileLines.find(line => !line.includes('@') && 
                                        !/phone|^\+|\d{3}[-.\s]?\d{3}[-.\s]?\d{4}|^\d+$/.test(line.toLowerCase()) && 
                                        line !== profileLines[0]) || 
              profileLines[3] || "City, Country"
  };
  
  // Parse career goal
  const careerGoal = (sections["CAREER GOAL"] || "").trim() || 
                     "Experienced professional seeking to leverage skills and expertise...";
  
  // Parse achievements
  const achievementText = sections["ACHIEVEMENTS"] || "";
  const achievementLines = achievementText.split('\n')
    .filter(line => line.trim())
    .map(line => line.replace(/^[-•*]\s*/, '').trim());
  const achievements = achievementLines.slice(0, 3);
  
  // Ensure we have exactly 3 achievements
  while (achievements.length < 3) {
    achievements.push("Achieved significant results through strategic initiative and implementation.");
  }
  
  // Parse skills
  const skillsText = sections["SKILLS"] || "";
  const skillCategories: StandardCV['skills'] = [];
  
  // Try to parse skill categories
  const categoryPattern = /([A-Za-z\s]+):\n((?:[-•*]?[^\n]+\n?)+)/g;
  let match;
  
  while ((match = categoryPattern.exec(skillsText)) !== null) {
    const category = match[1].trim();
    const items = match[2]
      .split('\n')
      .map(line => line.replace(/^[-•*]\s*/, '').trim())
      .filter(line => line);
    
    if (items.length > 0) {
      skillCategories.push({ category, items });
    }
  }
  
  // If no categories were found, create a default one
  if (skillCategories.length === 0) {
    const allSkills = skillsText
      .split('\n')
      .map(line => line.replace(/^[-•*]\s*/, '').trim())
      .filter(line => line);
    
    if (allSkills.length > 0) {
      skillCategories.push({ category: "Professional Skills", items: allSkills });
    } else {
      skillCategories.push({ 
        category: "Professional Skills", 
        items: ["Skill 1", "Skill 2", "Skill 3"] 
      });
    }
  }
  
  // Make sure we group skills into logical categories if they're not already
  if (skillCategories.length === 1 && skillCategories[0].items.length > 6) {
    const allItems = [...skillCategories[0].items];
    skillCategories.length = 0;
    
    const technicalSkills = allItems.filter(skill => 
      /software|programming|development|coding|database|system|data|technical|technology|engineering|analysis|framework|language/i.test(skill));
    
    const softSkills = allItems.filter(skill => 
      /communication|leadership|team|management|organization|planning|problem.solving|critical|presentation|negotiation|interpersonal/i.test(skill));
    
    const domainSkills = allItems.filter(skill => 
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
  }
  
  // Parse work experience
  const workExperienceText = sections["WORK EXPERIENCE"] || "";
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
      /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b/i.test(line)
    );
    
    if (dateRangeIndex === -1) continue;
    
    const dateRange = lines[dateRangeIndex];
    const jobTitle = lines[dateRangeIndex + 1] || "Position Title";
    const company = lines[dateRangeIndex + 2] || "Company Name - Location";
    
    // Extract achievements (bullet points or remaining lines)
    const achievementLines = lines.slice(dateRangeIndex + 3)
      .map(line => line.replace(/^[-•*]\s*/, '').trim())
      .filter(line => line);
    
    // Enhance achievements if they're too short or not specific enough
    const enhancedAchievements = achievementLines.map(achievement => {
      if (achievement.length < 30 || !(/\d/.test(achievement) || /increase|improve|reduce|save|lead|manage|develop|create|implement/i.test(achievement))) {
        // Add details if achievement is too general
        if (achievement.toLowerCase().includes("manage")) {
          return `${achievement} resulting in improved team efficiency and project delivery`;
        } else if (achievement.toLowerCase().includes("develop")) {
          return `${achievement} that increased productivity by 20% and reduced costs`;
        } else if (achievement.toLowerCase().includes("implement")) {
          return `${achievement} leading to streamlined operations and better outcomes`;
        } else {
          return `${achievement} with significant impact on business objectives`;
        }
      }
      return achievement;
    });
    
    // Ensure we have at least 3 achievements
    const workAchievements = enhancedAchievements.slice(0, 3);
    while (workAchievements.length < 3) {
      workAchievements.push(
        "Successfully implemented solutions that improved efficiency and productivity by 15%.",
        "Collaborated with cross-functional teams to achieve project goals and exceed client expectations.",
        "Managed resources effectively to ensure optimal performance and delivery of high-quality results."
      );
    }
    
    experienceEntries.push({
      dateRange,
      jobTitle,
      company,
      achievements: workAchievements.slice(0, 3) // Limit to 3 achievements
    });
  }
  
  // Ensure we have at least one work experience entry
  if (experienceEntries.length === 0) {
    experienceEntries.push({
      dateRange: "Jan 20XX - Present",
      jobTitle: "Position Title",
      company: "Company Name - Location",
      achievements: [
        "Successfully implemented solutions that improved efficiency and productivity by 15%.",
        "Collaborated with cross-functional teams to achieve project goals and exceed client expectations.",
        "Managed resources effectively to ensure optimal performance and delivery of high-quality results."
      ]
    });
  }
  
  // Parse education
  const educationText = sections["EDUCATION"] || "";
  const educationEntries: StandardCV['education'] = [];
  
  // Split by double newlines or institution patterns
  const educationBlocks = educationText.split(/\n\s*\n/);
  
  for (const block of educationBlocks) {
    if (!block.trim()) continue;
    
    const lines = block.split('\n').map(line => line.trim()).filter(line => line);
    if (lines.length < 2) continue;
    
    educationEntries.push({
      institution: lines[0] || "University or Institution",
      degree: lines[1] || "Degree or Qualification",
      year: lines[2] || "20XX"
    });
  }
  
  // Ensure we have at least one education entry
  if (educationEntries.length === 0) {
    educationEntries.push({
      institution: "University or Institution",
      degree: "Degree or Qualification",
      year: "20XX"
    });
  }
  
  // Parse languages
  const languagesText = sections["LANGUAGES"] || "";
  const languageEntries: StandardCV['languages'] = [];
  
  // Split by lines
  const languageLines = languagesText.split('\n').map(line => line.trim()).filter(line => line);
  
  for (const line of languageLines) {
    // Handle bullet points
    const languageText = line.replace(/^[-•*]\s*/, '').trim();
    
    // Try to extract language and proficiency (e.g., "English - Fluent" or "English (Fluent)")
    const match = languageText.match(/^(.*?)(?:[-–—:]\s*|\s*\(\s*)(.*?)(?:\s*\))?$/);
    
    if (match) {
      const language = match[1].trim();
      const proficiency = match[2].trim();
      
      languageEntries.push({
        language,
        proficiency
      });
    } else {
      // If we can't parse the format, just use the whole line as the language
      languageEntries.push({
        language: languageText,
        proficiency: "Fluent" // Default proficiency
      });
    }
  }
  
  // Ensure we have at least one language entry
  if (languageEntries.length === 0) {
    languageEntries.push({
      language: "English",
      proficiency: "Fluent"
    });
  }
  
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