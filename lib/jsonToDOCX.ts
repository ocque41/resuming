import { 
  Document, Packer, Paragraph, TextRun, HeadingLevel, 
  AlignmentType, Table, TableRow, TableCell, BorderStyle,
  ImageRun, Footer, Header, WidthType, TableOfContents,
  Tab, HorizontalPositionAlign, VerticalPositionAlign,
  HorizontalPositionRelativeFrom, VerticalPositionRelativeFrom
} from 'docx';

/**
 * Generate a DOCX file from structured CV data in modern professional style
 * 
 * @param data Structured CV data from extractStructuredDataFromPDF
 * @param templateId Template identifier
 * @returns DOCX Document object
 */
export function generateDOCXFromJSON(data: Record<string, any>, templateId: string): Document {
  // Process the structured data
  const { sections, nameAndContact } = data;
  
  // Create document with modern professional template styling
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
            size: 28,
            bold: true,
            color: "000000",
            font: "Calibri",
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
            size: 26,
            bold: true,
            color: "000000",
            font: "Calibri",
          },
          paragraph: {
            spacing: {
              before: 240,
              after: 120,
            },
          },
        },
        {
          id: "NameStyle",
          name: "Name Style",
          basedOn: "Normal",
          next: "Normal",
          quickFormat: true,
          run: {
            size: 36,
            bold: true,
            color: "000000",
            font: "Calibri",
          },
          paragraph: {
            alignment: AlignmentType.CENTER,
            spacing: {
              after: 60,
            },
          },
        },
        {
          id: "LastNameStyle",
          name: "Last Name Style",
          basedOn: "Normal",
          next: "Normal",
          quickFormat: true,
          run: {
            size: 36,
            bold: true,
            color: "808080", // Gray color for last name
            font: "Calibri",
          },
          paragraph: {
            alignment: AlignmentType.CENTER,
            spacing: {
              after: 60,
            },
          },
        },
        {
          id: "JobTitleStyle",
          name: "Job Title Style",
          basedOn: "Normal",
          next: "Normal",
          quickFormat: true,
          run: {
            size: 24,
            color: "000000",
            font: "Calibri",
          },
          paragraph: {
            alignment: AlignmentType.CENTER,
            spacing: {
              after: 60,
            },
          },
        },
        {
          id: "ContactInfoStyle",
          name: "Contact Info Style",
          basedOn: "Normal",
          next: "Normal",
          quickFormat: true,
          run: {
            size: 20,
            color: "000000",
            font: "Calibri",
          },
          paragraph: {
            alignment: AlignmentType.CENTER,
            spacing: {
              after: 60,
            },
          },
        },
      ],
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
        children: createDocumentContent(sections, nameAndContact),
      },
    ],
  });
  
  return doc;
}

/**
 * Create document content from CV sections
 */
function createDocumentContent(sections: Record<string, string>, nameAndContact: any): any[] {
  const documentElements = [];
  
  // Add name header with two-tone style
  documentElements.push(
    new Paragraph({
      children: [
        new TextRun({
          text: nameAndContact.firstName.toUpperCase(),
          bold: true,
          size: 36,
        }),
        new TextRun({
          text: " " + nameAndContact.lastName.toUpperCase(),
          bold: true,
          size: 36,
          color: "808080", // Gray color for last name
        }),
      ],
      alignment: AlignmentType.CENTER,
    })
  );
  
  // Add job title
  documentElements.push(
    new Paragraph({
      text: nameAndContact.jobTitle,
      alignment: AlignmentType.CENTER,
      spacing: {
        after: 100,
      },
    })
  );
  
  // Add contact info (phone, email, location)
  const contactInfoLines = [];
  if (nameAndContact.phone) contactInfoLines.push(nameAndContact.phone);
  if (nameAndContact.email) contactInfoLines.push(nameAndContact.email);
  if (nameAndContact.location) contactInfoLines.push(nameAndContact.location);
  
  documentElements.push(
    new Paragraph({
      text: contactInfoLines.join("\n"),
      alignment: AlignmentType.CENTER,
      spacing: {
        after: 400,
      },
    })
  );
  
  // Add ABOUT ME section
  if (sections.profile || sections.summary || sections.about_me) {
    documentElements.push(
      new Paragraph({
        text: "ABOUT ME",
        heading: HeadingLevel.HEADING_1,
        thematicBreak: true,
        spacing: {
          before: 400,
          after: 200,
        },
      })
    );
    
    const aboutText = sections.profile || sections.summary || sections.about_me;
    documentElements.push(
      new Paragraph({
        text: aboutText,
        spacing: {
          after: 200,
        },
      })
    );
  }
  
  // Add COMPETENCES section with three-column layout
  if (sections.skills || sections.competences) {
    documentElements.push(
      new Paragraph({
        text: "COMPETENCES",
        heading: HeadingLevel.HEADING_1,
        thematicBreak: true,
        spacing: {
          before: 400,
          after: 200,
        },
      })
    );
    
    // Parse skills into bullet points
    const skillsText = sections.skills || sections.competences;
    const skills = skillsText
      .split('\n')
      .map(skill => skill.trim())
      .filter(skill => skill.length > 0)
      .map(skill => skill.replace(/^[•\-\*]\s*/, '')); // Remove existing bullet markers
    
    // Create three-column layout for skills
    const skillColumns = createThreeColumnLayout(skills);
    documentElements.push(skillColumns);
  }
  
  // Add WORK EXPERIENCE section
  if (sections.experience || sections.work_experience) {
    documentElements.push(
      new Paragraph({
        text: "WORK EXPERIENCE",
        heading: HeadingLevel.HEADING_1,
        thematicBreak: true,
        spacing: {
          before: 400,
          after: 200,
        },
      })
    );
    
    // Create work experience entries
    const experienceElements = createWorkExperienceSection(sections.experience || sections.work_experience);
    documentElements.push(...experienceElements);
  }
  
  // Add EDUCATION section with three-column layout
  if (sections.education) {
    documentElements.push(
      new Paragraph({
        text: "EDUCATION",
        heading: HeadingLevel.HEADING_1,
        thematicBreak: true,
        spacing: {
          before: 400,
          after: 200,
        },
      })
    );
    
    // Create education section
    const educationElements = createEducationSection(sections.education);
    documentElements.push(...educationElements);
  }
  
  // Add LANGUAGES section
  if (sections.languages) {
    documentElements.push(
      new Paragraph({
        text: "LANGUAGES",
        heading: HeadingLevel.HEADING_1,
        thematicBreak: true,
        spacing: {
          before: 400,
          after: 200,
        },
      })
    );
    
    // Create languages section with proficiency bars
    const languagesElements = createLanguagesSection(sections.languages);
    documentElements.push(...languagesElements);
  }
  
  return documentElements;
}

/**
 * Create three-column layout for skills, with bullet points
 */
function createThreeColumnLayout(items: string[]): Table {
  // Calculate how many items per column
  const itemsPerColumn = Math.ceil(items.length / 3);
  
  // Create columns
  const column1 = items.slice(0, itemsPerColumn);
  const column2 = items.slice(itemsPerColumn, itemsPerColumn * 2);
  const column3 = items.slice(itemsPerColumn * 2);
  
  // Create table for three-column layout
  return new Table({
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
    rows: [
      new TableRow({
        children: [
          new TableCell({
            children: column1.map(item => 
              new Paragraph({
                text: "• " + item,
                spacing: {
                  after: 100,
                },
              })
            ),
            borders: {
              top: { style: BorderStyle.NONE },
              bottom: { style: BorderStyle.NONE },
              left: { style: BorderStyle.NONE },
              right: { style: BorderStyle.NONE },
            },
          }),
          new TableCell({
            children: column2.map(item => 
              new Paragraph({
                text: "• " + item,
                spacing: {
                  after: 100,
                },
              })
            ),
            borders: {
              top: { style: BorderStyle.NONE },
              bottom: { style: BorderStyle.NONE },
              left: { style: BorderStyle.NONE },
              right: { style: BorderStyle.NONE },
            },
          }),
          new TableCell({
            children: column3.map(item => 
              new Paragraph({
                text: "• " + item,
                spacing: {
                  after: 100,
                },
              })
            ),
            borders: {
              top: { style: BorderStyle.NONE },
              bottom: { style: BorderStyle.NONE },
              left: { style: BorderStyle.NONE },
              right: { style: BorderStyle.NONE },
            },
          }),
        ],
      }),
    ],
  });
}

/**
 * Create work experience section with date-job-company format
 */
function createWorkExperienceSection(experienceText: string): Paragraph[] {
  const paragraphs: Paragraph[] = [];
  
  // Split into job blocks
  const jobBlocks = experienceText.split(/\n\s*\n/).filter(block => block.trim());
  
  if (jobBlocks.length === 0) {
    // Create placeholder experience if none found
    return createPlaceholderExperience();
  }
  
  // Process each job block
  for (const block of jobBlocks) {
    const lines = block.split('\n');
    
    // Try to extract date range, job title, company
    let startDate = 'Sept. 20XX';
    let endDate = 'Juli. 20XX';
    let jobTitle = 'Job occupied';
    let companyAndCity = 'NAME OF THE COMPANY - CITY';
    
    // Extract dates
    const datePattern = /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|january|february|march|april|may|june|july|august|september|october|november|december|sept|juli)[a-z]*\.?\s+20\d{2}\b/i;
    const dateMatches = [];
    for (const line of lines) {
      const match = line.match(datePattern);
      if (match) {
        dateMatches.push(match[0]);
      }
    }
    
    if (dateMatches.length >= 1) {
      startDate = dateMatches[0];
    }
    if (dateMatches.length >= 2) {
      endDate = dateMatches[1];
    }
    
    // Try to extract job title
    for (const line of lines) {
      if (line.length > 0 && !line.match(datePattern) && !line.includes('-') && !line.startsWith('•')) {
        jobTitle = line.trim();
        break;
      }
    }
    
    // Try to extract company and city
    for (const line of lines) {
      if (line.includes('-') && !line.match(datePattern)) {
        companyAndCity = line.trim();
        break;
      }
    }
    
    // Add job header with start date and job title
    paragraphs.push(
      new Paragraph({
        children: [
          new TextRun({ text: startDate, bold: true }),
          new TextRun({ text: "    " }),
          new TextRun({ text: jobTitle }),
        ],
        spacing: { after: 80 },
      })
    );
    
    // Add end date and company+city
    paragraphs.push(
      new Paragraph({
        children: [
          new TextRun({ text: endDate, bold: true }),
          new TextRun({ text: "     " }),
          new TextRun({ text: companyAndCity }),
        ],
        spacing: { after: 80 },
      })
    );
    
    // Extract bullet points
    const bulletPoints = lines
      .filter(line => line.trim().startsWith('•') || line.trim().startsWith('-'))
      .map(line => line.replace(/^[•\-]\s*/, '').trim());
    
    // Create bullet points for job responsibilities
    if (bulletPoints.length > 0) {
      // First bullet point with "Missions or tasks realized:" prefix
      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({ text: "• Missions or tasks realized: ", bold: true }),
            new TextRun({ text: bulletPoints[0] }),
          ],
          spacing: { after: 80 },
        })
      );
      
      // Remaining bullet points
      for (let i = 1; i < Math.min(3, bulletPoints.length); i++) {
        paragraphs.push(
          new Paragraph({
            text: "• " + bulletPoints[i],
            spacing: { after: 80 },
          })
        );
      }
    } else {
      // Add placeholder bullet points if none found
      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({ text: "• Missions or tasks realized: ", bold: true }),
            new TextRun({ text: "Duis augue magna, bibendum at nunc id, gravida ultrices tellus. Pellentesque." }),
          ],
          spacing: { after: 80 },
        })
      );
      
      paragraphs.push(
        new Paragraph({
          text: "• Vehicula ante id, dictum ligula ante gravida ultrices. Lorem ipsum dolor sit amet.",
          spacing: { after: 80 },
        })
      );
      
      paragraphs.push(
        new Paragraph({
          text: "• Pellentesqu, ehicula ante id, dictum ligula ante. Lorem ipsum dolor sit amet.",
          spacing: { after: 80 },
        })
      );
    }
    
    // Add spacing between job entries
    paragraphs.push(
      new Paragraph({
        text: "",
        spacing: { after: 200 },
      })
    );
  }
  
  return paragraphs;
}

/**
 * Create placeholder experience section
 */
function createPlaceholderExperience(): Paragraph[] {
  return [
    new Paragraph({
      children: [
        new TextRun({ text: "Sept. 20XX", bold: true }),
        new TextRun({ text: "    " }),
        new TextRun({ text: "Job occupied" }),
      ],
      spacing: { after: 80 },
    }),
    new Paragraph({
      children: [
        new TextRun({ text: "Juli. 20XX", bold: true }),
        new TextRun({ text: "     " }),
        new TextRun({ text: "NAME OF THE COMPANY - CITY" }),
      ],
      spacing: { after: 80 },
    }),
    new Paragraph({
      children: [
        new TextRun({ text: "• Missions or tasks realized: ", bold: true }),
        new TextRun({ text: "Duis augue magna, bibendum at nunc id, gravida ultrices tellus. Pellentesque." }),
      ],
      spacing: { after: 80 },
    }),
    new Paragraph({
      text: "• Vehicula ante id, dictum ligula ante gravida ultrices. Lorem ipsum dolor sit amet.",
      spacing: { after: 80 },
    }),
    new Paragraph({
      text: "• Pellentesqu, ehicula ante id, dictum ligula ante. Lorem ipsum dolor sit amet.",
      spacing: { after: 200 },
    }),
  ];
}

/**
 * Create education section with three columns
 */
function createEducationSection(educationText: string): any[] {
  // Parse education blocks
  const educationBlocks = educationText.split(/\n\s*\n/).filter(block => block.trim());
  
  // Create education entries
  const entries = [];
  
  if (educationBlocks.length === 0) {
    // Create placeholder entries if none found
    entries.push({
      school: 'UNIVERSITY OR SCHOOL',
      diploma: 'Diploma Xxxxxxxxx',
      year: '20XX'
    });
    entries.push({
      school: 'UNIVERSITY OR SCHOOL',
      diploma: 'Diploma Xxxxxxxxx',
      year: '20XX'
    });
    entries.push({
      school: 'UNIVERSITY OR SCHOOL',
      diploma: 'Diploma Xxxxxxxxx',
      year: '20XX'
    });
  } else {
    // Process education blocks
    for (const block of educationBlocks) {
      const lines = block.split('\n');
      
      // Find school/university name
      let school = 'UNIVERSITY OR SCHOOL';
      for (const line of lines) {
        if (line.match(/university|college|school|institut/i)) {
          school = line.trim().toUpperCase();
          break;
        }
      }
      if (school === 'UNIVERSITY OR SCHOOL' && lines.length > 0) {
        school = lines[0].trim().toUpperCase();
      }
      
      // Find diploma/degree
      let diploma = 'Diploma Xxxxxxxxx';
      for (const line of lines) {
        if (line.match(/diploma|degree|bachelor|master|phd|certificate/i)) {
          diploma = line.trim();
          break;
        }
      }
      if (diploma === 'Diploma Xxxxxxxxx' && lines.length > 1) {
        diploma = lines[1].trim();
      }
      
      // Find year
      let year = '20XX';
      for (const line of lines) {
        const yearMatch = line.match(/\b(20\d{2}|19\d{2})\b/);
        if (yearMatch) {
          year = yearMatch[0];
          break;
        }
      }
      
      entries.push({ school, diploma, year });
    }
    
    // Ensure we have at least 3 entries
    while (entries.length < 3) {
      entries.push({
        school: 'UNIVERSITY OR SCHOOL',
        diploma: 'Diploma Xxxxxxxxx',
        year: '20XX'
      });
    }
  }
  
  // Create education table for three-column layout
  return [
    new Table({
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
      rows: [
        new TableRow({
          children: [
            new TableCell({
              children: [
                new Paragraph({
                  text: entries[0].school,
                  spacing: { after: 80 },
                }),
                new Paragraph({
                  text: entries[0].diploma,
                  spacing: { after: 80 },
                }),
                new Paragraph({
                  text: entries[0].year,
                  spacing: { after: 80 },
                }),
              ],
              borders: {
                top: { style: BorderStyle.NONE },
                bottom: { style: BorderStyle.NONE },
                left: { style: BorderStyle.NONE },
                right: { style: BorderStyle.NONE },
              },
            }),
            new TableCell({
              children: [
                new Paragraph({
                  text: entries[1].school,
                  spacing: { after: 80 },
                }),
                new Paragraph({
                  text: entries[1].diploma,
                  spacing: { after: 80 },
                }),
                new Paragraph({
                  text: entries[1].year,
                  spacing: { after: 80 },
                }),
              ],
              borders: {
                top: { style: BorderStyle.NONE },
                bottom: { style: BorderStyle.NONE },
                left: { style: BorderStyle.NONE },
                right: { style: BorderStyle.NONE },
              },
            }),
            new TableCell({
              children: [
                new Paragraph({
                  text: entries[2].school,
                  spacing: { after: 80 },
                }),
                new Paragraph({
                  text: entries[2].diploma,
                  spacing: { after: 80 },
                }),
                new Paragraph({
                  text: entries[2].year,
                  spacing: { after: 80 },
                }),
              ],
              borders: {
                top: { style: BorderStyle.NONE },
                bottom: { style: BorderStyle.NONE },
                left: { style: BorderStyle.NONE },
                right: { style: BorderStyle.NONE },
              },
            }),
          ],
        }),
      ],
    }),
  ];
}

/**
 * Create languages section with proficiency bars
 */
function createLanguagesSection(languagesText: string): Paragraph[] {
  const paragraphs: Paragraph[] = [];
  
  // Extract languages and their proficiency levels
  const languages = [];
  const commonLanguages = [
    'English', 'German', 'Spanish', 'French', 'Italian', 
    'Chinese', 'Japanese', 'Russian', 'Portuguese', 'Arabic'
  ];
  
  const languageLines = languagesText.split('\n').filter(line => line.trim());
  
  // Try to extract languages with proficiency
  for (const line of languageLines) {
    for (const lang of commonLanguages) {
      if (line.toLowerCase().includes(lang.toLowerCase())) {
        // Try to determine proficiency
        let proficiency = 0.7; // Default to intermediate
        
        if (line.match(/native|fluent|mother tongue|perfect/i)) {
          proficiency = 1.0;
        } else if (line.match(/advanced|proficient|c2|c1/i)) {
          proficiency = 0.8;
        } else if (line.match(/intermediate|b2|b1/i)) {
          proficiency = 0.6;
        } else if (line.match(/basic|beginner|elementary|a2|a1/i)) {
          proficiency = 0.3;
        }
        
        languages.push({ name: lang, level: proficiency });
        break;
      }
    }
  }
  
  // If no languages detected, add default ones
  if (languages.length === 0) {
    languages.push({ name: 'English', level: 0.9 });
    languages.push({ name: 'German', level: 0.5 });
    languages.push({ name: 'Spanish', level: 0.3 });
  }
  
  // Create language entries with proficiency bars (limit to 3)
  for (const lang of languages.slice(0, 3)) {
    const filledBlocks = Math.round(lang.level * 10);
    const emptyBlocks = 10 - filledBlocks;
    
    // Create a text-based proficiency bar
    const filledBar = "█".repeat(filledBlocks);
    const emptyBar = "░".repeat(emptyBlocks);
    const bar = filledBar + emptyBar;
    
    paragraphs.push(
      new Paragraph({
        children: [
          new TextRun({ text: lang.name, bold: true }),
          new TextRun({ text: "     " }),
          new TextRun({ text: bar }),
        ],
        spacing: { after: 80 },
      })
    );
  }
  
  return paragraphs;
}

/**
 * Export the document to a buffer
 */
export async function exportDOCXToBuffer(doc: Document): Promise<Buffer> {
  return await Packer.toBuffer(doc);
} 