import { Document, Packer, Paragraph, TextRun, HeadingLevel, BorderStyle, convertInchesToTwip, PageOrientation, PageNumber, AlignmentType, Table, TableRow, TableCell, WidthType, ImageRun, UnderlineType, ShadingType, TableLayoutType } from "docx";
import { logger } from "@/lib/logger";
import * as fs from 'fs';
import * as path from 'path';

/**
 * Professional Document Generator
 * A utility for generating DOCX files from CV text with premium styling
 * that matches world-class CV templates
 */
export class DocumentGenerator {
  // Define professional color scheme
  private static readonly colors = {
    primary: "2D5597", // Professional blue
    accent: "2D5597",  // Professional blue
    dark: "333333",    // Dark text
    medium: "666666",  // Medium gray
    light: "AAAAAA",   // Light gray
    ultraLight: "F5F5F5", // Ultra light gray
    white: "FFFFFF",   // White
  };
  
  // Define photo placement options
  public static readonly PhotoPlacement = {
    TOP_RIGHT: 'top-right',
    HEADER: 'header',
    NONE: 'none'
  };

  // Define photo size options
  public static readonly PhotoSize = {
    SMALL: { width: 100, height: 100 },
    MEDIUM: { width: 150, height: 150 },
    LARGE: { width: 200, height: 200 }
  };

  // Define template styles
  public static readonly TemplateStyles = {
    MODERN: 'modern',
    CLASSIC: 'classic',
    MINIMAL: 'minimal',
    EXECUTIVE: 'executive',
    CREATIVE: 'creative'
  };

  // Define font options for different templates
  public static readonly FontOptions = {
    // Professional serif fonts
    SERIF: {
      GEORGIA: 'Georgia',
      TIMES: 'Times New Roman',
      GARAMOND: 'Garamond',
      PALATINO: 'Palatino Linotype',
      CAMBRIA: 'Cambria',
    },
    // Professional sans-serif fonts
    SANS_SERIF: {
      ARIAL: 'Arial',
      CALIBRI: 'Calibri',
      HELVETICA: 'Helvetica',
      SEGOE: 'Segoe UI',
      VERDANA: 'Verdana',
      TAHOMA: 'Tahoma',
    },
    // Modern fonts for special sections
    MODERN: {
      CENTURY: 'Century Gothic',
      FUTURA: 'Futura',
      GILL_SANS: 'Gill Sans',
      TREBUCHET: 'Trebuchet MS',
    }
  };

  // Static font presets with direct string references to avoid 'this' issues
  public static readonly FontPresets = {
    MODERN: {
      headingFont: 'Segoe UI',
      bodyFont: 'Calibri',
      nameFont: 'Segoe UI',
    },
    CLASSIC: {
      headingFont: 'Georgia',
      bodyFont: 'Times New Roman',
      nameFont: 'Georgia',
    },
    CORPORATE: {
      headingFont: 'Arial',
      bodyFont: 'Calibri',
      nameFont: 'Arial',
    },
    CREATIVE: {
      headingFont: 'Century Gothic',
      bodyFont: 'Calibri',
      nameFont: 'Century Gothic',
    },
    TECH: {
      headingFont: 'Segoe UI',
      bodyFont: 'Calibri',
      nameFont: 'Segoe UI',
    },
  };
  
  /**
   * Generate a DOCX file from CV text with professional formatting
   * @param cvText The optimized CV text
   * @param metadata Optional metadata for enhanced formatting
   * @param options Optional formatting options for the document
   */
  static async generateDocx(
    cvText: string, 
    metadata?: any, 
    options?: {
      templateStyle?: string;
      photoOptions?: {
        path?: string;
        placement?: string;
        size?: { width: number; height: number };
        border?: boolean;
        borderColor?: string;
      },
      fontOptions?: {
        headingFont?: string;
        bodyFont?: string;
        nameFont?: string;
        preset?: string;
      },
      colorOptions?: {
        primary?: string;
        accent?: string;
      }
    }
  ): Promise<Buffer> {
    try {
      logger.info("Starting professional document generation");
      const startTime = Date.now();
      
      // Clean up text for better parsing
      let filteredText = cvText
        .replace(/\bDeveloped\b/g, '')
        .replace(/\bDelivered\b/g, '')
        .replace(/\bImplemented\b/g, '');
      
      // Clean up any double spaces that might have been created
      filteredText = filteredText.replace(/\s{2,}/g, ' ');
      
      // Split the CV text into sections based on common headers
      const sections = this.splitIntoSections(filteredText);
      
      // Process template style
      const templateStyle = options?.templateStyle || this.TemplateStyles.MODERN;
      
      // Process font options
      let fonts = {
        headingFont: this.FontPresets.MODERN.headingFont,
        bodyFont: this.FontPresets.MODERN.bodyFont,
        nameFont: this.FontPresets.MODERN.nameFont
      };

      // Handle custom font presets
      if (options?.fontOptions?.preset) {
        const presetKey = options.fontOptions.preset.toUpperCase();
        if (presetKey in DocumentGenerator.FontPresets) {
          fonts = { ...DocumentGenerator.FontPresets[presetKey as keyof typeof DocumentGenerator.FontPresets] };
        }
      }

      // Override individual font options if specified
      if (options?.fontOptions?.headingFont) fonts.headingFont = options.fontOptions.headingFont;
      if (options?.fontOptions?.bodyFont) fonts.bodyFont = options.fontOptions.bodyFont;
      if (options?.fontOptions?.nameFont) fonts.nameFont = options.fontOptions.nameFont;

      // Process color options
      const colors = { ...this.colors };
      if (options?.colorOptions?.primary) colors.primary = options.colorOptions.primary;
      if (options?.colorOptions?.accent) colors.accent = options.colorOptions.accent;
      
      // Create document with optimal margins and modern formatting
      const doc = new Document({
        styles: {
          paragraphStyles: [
            {
              id: "SectionHeading",
              name: "Section Heading",
              basedOn: "Normal",
              next: "Normal",
              quickFormat: true,
              run: {
                font: fonts.headingFont,
                size: 28,
                bold: true,
                color: colors.primary,
              },
              paragraph: {
                spacing: {
                  after: 120,
                  before: 240,
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
                font: fonts.bodyFont,
                size: 22,
                color: colors.dark,
              },
              paragraph: {
                spacing: {
                  after: 80,
                  line: 360, // 1.5 line spacing
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
                  top: convertInchesToTwip(0.5),
                  right: convertInchesToTwip(0.5),
                  bottom: convertInchesToTwip(0.5),
                  left: convertInchesToTwip(0.5),
                },
                size: {
                  orientation: PageOrientation.PORTRAIT,
                },
              },
            },
            children: this.createDocumentContent(
              sections, 
              metadata, 
              templateStyle,
              options?.photoOptions,
              fonts,
              colors
            )
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
      
      // Look for a natural break in the text (empty line) within the first 10 lines
      let headerEndIndex = -1;
      for (let i = 0; i < Math.min(10, lines.length); i++) {
        if (lines[i].trim() === '' && i > 0) {
          headerEndIndex = i;
          break;
        }
      }
      
      // If no natural break found, use first 3 lines or 10% of the document
      if (headerEndIndex === -1) {
        headerEndIndex = Math.min(3, Math.ceil(lines.length * 0.1));
      }
      
      sections.header = lines.slice(0, headerEndIndex).join('\n').trim();
      sections.content = lines.slice(headerEndIndex).join('\n').trim();
    }
    
    return sections;
  }
  
  /**
   * Create document content with professional formatting
   */
  private static createDocumentContent(
    sections: Record<string, string>, 
    metadata?: any,
    templateStyle?: string,
    photoOptions?: {
      path?: string;
      placement?: string;
      size?: { width: number; height: number };
      border?: boolean;
      borderColor?: string;
    },
    fonts?: {
      headingFont: string;
      bodyFont: string;
      nameFont: string;
    },
    colors?: {
      primary: string;
      accent: string;
      dark: string;
      medium: string;
      light: string;
      ultraLight: string;
      white: string;
    }
  ): any[] {
    // Default fonts and colors if not provided
    const activeColors = colors || this.colors;
    const activeFonts = fonts || {
      headingFont: this.FontPresets.MODERN.headingFont,
      bodyFont: this.FontPresets.MODERN.bodyFont,
      nameFont: this.FontPresets.MODERN.nameFont
    };
    
    // Use modern template as default
    const activeTemplate = templateStyle || this.TemplateStyles.MODERN;
    
    const children: any[] = [];
    
    // Setup default photo options if not provided
    const photo = {
      path: photoOptions?.path || '',
      placement: photoOptions?.placement || this.PhotoPlacement.TOP_RIGHT,
      size: photoOptions?.size || this.PhotoSize.MEDIUM,
      border: photoOptions?.border !== undefined ? photoOptions.border : true,
      borderColor: photoOptions?.borderColor || activeColors.primary
    };
    
    // Add header based on selected template
    if (sections.header) {
      switch (activeTemplate) {
        case this.TemplateStyles.MODERN:
          this.createModernHeader(children, sections.header, photo, activeFonts, activeColors);
          break;
        case this.TemplateStyles.CLASSIC:
          this.createClassicHeader(children, sections.header, photo, activeFonts, activeColors);
          break;
        case this.TemplateStyles.MINIMAL:
          this.createMinimalHeader(children, sections.header, photo, activeFonts, activeColors);
          break;
        case this.TemplateStyles.EXECUTIVE:
          this.createExecutiveHeader(children, sections.header, photo, activeFonts, activeColors);
          break;
        case this.TemplateStyles.CREATIVE:
          this.createCreativeHeader(children, sections.header, photo, activeFonts, activeColors);
          break;
        default:
          this.createModernHeader(children, sections.header, photo, activeFonts, activeColors);
          break;
      }
    }
    
    // Add summary section if available
    if (sections.summary) {
      this.createSummarySection(children, sections.summary, activeTemplate, activeFonts, activeColors);
    }
    
    // Add skills section with modern formatting
    if (sections.skills) {
      this.createSkillsSection(children, sections.skills, metadata, activeTemplate, activeFonts, activeColors);
    }
    
    // Add experience section with enhanced formatting
    if (sections.experience) {
      this.createExperienceSection(children, sections.experience, activeTemplate, activeFonts, activeColors);
    }
    
    // Add education section with enhanced formatting
    if (sections.education) {
      this.createEducationSection(children, sections.education, activeTemplate, activeFonts, activeColors);
    }
    
    // Add languages section if available
    if (sections.languages) {
      this.createLanguagesSection(children, sections.languages, activeTemplate, activeFonts, activeColors);
    }
    
    // Add any remaining sections
    for (const [sectionName, content] of Object.entries(sections)) {
      if (!['header', 'summary', 'skills', 'experience', 'education', 'languages'].includes(sectionName)) {
        this.createGenericSection(children, sectionName, content, activeTemplate, activeFonts, activeColors);
      }
    }
    
    return children;
  }

  /**
   * Creates a modern header with clean layout and optional photo
   */
  private static createModernHeader(
    children: any[],
    headerContent: string,
    photoOptions: any,
    fonts: any,
    colors: any
  ): void {
    const headerLines = headerContent.split('\n');
    
    // Only include photo if a valid path is provided
    const hasPhoto = photoOptions.path && 
                    photoOptions.placement !== this.PhotoPlacement.NONE && 
                    fs.existsSync(photoOptions.path);
                    
    // Create a modern table layout for the header
    const table = new Table({
      width: {
        size: 100,
        type: WidthType.PERCENTAGE,
      },
      layout: TableLayoutType.FIXED,
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
            // Left column for name and job title
            new TableCell({
              width: {
                size: hasPhoto ? 70 : 100,
                type: WidthType.PERCENTAGE,
              },
              borders: {
                top: { style: BorderStyle.NONE },
                bottom: { style: BorderStyle.NONE },
                left: { style: BorderStyle.NONE },
                right: { style: BorderStyle.NONE },
              },
              children: [
                // Name in bold, large font with accent color
                new Paragraph({
                  alignment: AlignmentType.LEFT,
                  children: [
                    new TextRun({
                      text: headerLines[0]?.trim().toUpperCase() || "NAME",
                      bold: true,
                      size: 36, // ~18pt font
                      color: colors.primary,
                      font: fonts.nameFont,
                    }),
                  ],
                  spacing: {
                    after: 120
                  }
                }),
                // Job title if available
                ...(headerLines.length > 1 ? [
                  new Paragraph({
                    alignment: AlignmentType.LEFT,
                    children: [
                      new TextRun({
                        text: headerLines[1].trim(),
                        size: 28, // ~14pt font
                        color: colors.medium,
                        font: fonts.headingFont,
                        bold: true,
                      }),
                    ],
                    spacing: {
                      after: 120
                    }
                  })
                ] : []),
                // Contact info
                ...(headerLines.length > 2 ? headerLines.slice(2).map(line => 
                  new Paragraph({
                    alignment: AlignmentType.LEFT,
                    children: [
                      new TextRun({
                        text: line.trim(),
                        size: 22, // ~11pt font
                        font: fonts.bodyFont,
                        color: colors.dark,
                      }),
                    ],
                    spacing: {
                      after: 60
                    }
                  })
                ) : [])
              ],
            }),
            
            // Right column for photo (only if photo is provided)
            ...(hasPhoto ? [
              new TableCell({
                width: {
                  size: 30,
                  type: WidthType.PERCENTAGE,
                },
                borders: {
                  top: { style: BorderStyle.NONE },
                  bottom: { style: BorderStyle.NONE },
                  left: { style: BorderStyle.NONE },
                  right: { style: BorderStyle.NONE },
                },
                children: [
                  // Photo in a centered paragraph
                  new Paragraph({
                    alignment: AlignmentType.RIGHT,
                    children: [
                      this.createPhotoElement(photoOptions.path, photoOptions.size)
                    ],
                    spacing: {
                      after: 120
                    }
                  }),
                ],
              })
            ] : []),
          ],
        }),
      ],
    });
    
    children.push(table);
    
    // Add a professional separator line after the header
    children.push(
      new Paragraph({
        border: {
          bottom: {
            color: colors.primary,
            space: 1,
            style: BorderStyle.SINGLE,
            size: 20, // Thicker line for better visual separation
          },
        },
        spacing: {
          before: 120,
          after: 240
        }
      })
    );
  }

  /**
   * Create an elegant classic header with traditional styling
   */
  private static createClassicHeader(
    children: any[],
    headerContent: string,
    photoOptions: any,
    fonts: any,
    colors: any
  ): void {
    const headerLines = headerContent.split('\n');
    
    // Add name centered and large
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({
            text: headerLines[0]?.trim().toUpperCase() || "NAME",
            bold: true,
            size: 36, // ~18pt font
            color: colors.primary,
            font: fonts.nameFont,
          }),
        ],
        spacing: {
          after: 100
        }
      })
    );
    
    // Add job title if available
    if (headerLines.length > 1) {
      children.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({
              text: headerLines[1].trim(),
              italics: true,
              size: 26, // ~13pt font
              color: colors.medium,
              font: fonts.headingFont,
            }),
          ],
          spacing: {
            after: 160
          }
        })
      );
    }
    
    // Add contact info in a centered row
    if (headerLines.length > 2) {
      const contactInfo = headerLines.slice(2).filter(line => line.trim().length > 0);
      
      // Split contact info into chunks of 3 for multi-column layout
      for (let i = 0; i < contactInfo.length; i += 3) {
        const chunk = contactInfo.slice(i, i + 3);
        
        // Create a table row for contact info
        const contactTable = new Table({
          width: {
            size: 100,
            type: WidthType.PERCENTAGE,
          },
          layout: TableLayoutType.FIXED,
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
              children: chunk.map(item => 
                new TableCell({
                  borders: {
                    top: { style: BorderStyle.NONE },
                    bottom: { style: BorderStyle.NONE },
                    left: { style: BorderStyle.NONE },
                    right: { style: BorderStyle.NONE },
                  },
                  children: [
                    new Paragraph({
                      alignment: AlignmentType.CENTER,
                      children: [
                        new TextRun({
                          text: item.trim(),
                          size: 22, // ~11pt font
                          font: fonts.bodyFont,
                          color: colors.dark,
                        }),
                      ],
                    })
                  ],
                })
              ),
            }),
          ],
        });
        
        children.push(contactTable);
      }
    }
    
    // Add a decorative separator
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        border: {
          bottom: {
            color: colors.light,
            space: 1,
            style: BorderStyle.SINGLE,
            size: 10,
          },
        },
        spacing: {
          before: 160,
          after: 240
        }
      })
    );
    
    // Add photo if provided in a centered position
    if (photoOptions.path && photoOptions.placement !== this.PhotoPlacement.NONE && fs.existsSync(photoOptions.path)) {
      children.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            this.createPhotoElement(photoOptions.path, photoOptions.size)
          ],
          spacing: {
            after: 160
          }
        })
      );
    }
  }
  
  /**
   * Create a minimal header with clean, unobtrusive styling
   */
  private static createMinimalHeader(
    children: any[],
    headerContent: string,
    photoOptions: any,
    fonts: any,
    colors: any
  ): void {
    const headerLines = headerContent.split('\n');
    
    // Create a simple two-column layout
    const table = new Table({
      width: {
        size: 100,
        type: WidthType.PERCENTAGE,
      },
      layout: TableLayoutType.FIXED,
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
            // Left column for name and job title
            new TableCell({
              width: {
                size: 50,
                type: WidthType.PERCENTAGE,
              },
              borders: {
                top: { style: BorderStyle.NONE },
                bottom: { style: BorderStyle.NONE },
                left: { style: BorderStyle.NONE },
                right: { style: BorderStyle.NONE },
              },
              children: [
                // Name 
                new Paragraph({
                  alignment: AlignmentType.LEFT,
                  children: [
                    new TextRun({
                      text: headerLines[0]?.trim() || "NAME",
                      bold: true,
                      size: 32, // ~16pt font
                      color: colors.dark,
                      font: fonts.nameFont,
                    }),
                  ],
                  spacing: {
                    after: 80
                  }
                }),
                // Job title if available
                ...(headerLines.length > 1 ? [
                  new Paragraph({
                    alignment: AlignmentType.LEFT,
                    children: [
                      new TextRun({
                        text: headerLines[1].trim(),
                        size: 24, // ~12pt font
                        color: colors.medium,
                        font: fonts.headingFont,
                      }),
                    ],
                    spacing: {
                      after: 80
                    }
                  })
                ] : []),
              ],
            }),
            
            // Right column for contact info
            new TableCell({
              width: {
                size: 50,
                type: WidthType.PERCENTAGE,
              },
              borders: {
                top: { style: BorderStyle.NONE },
                bottom: { style: BorderStyle.NONE },
                left: { style: BorderStyle.NONE },
                right: { style: BorderStyle.NONE },
              },
              children: [
                // Contact info
                ...(headerLines.length > 2 ? headerLines.slice(2).map(line => 
                  new Paragraph({
                    alignment: AlignmentType.RIGHT,
                    children: [
                      new TextRun({
                        text: line.trim(),
                        size: 20, // ~10pt font
                        font: fonts.bodyFont,
                        color: colors.medium,
                      }),
                    ],
                    spacing: {
                      after: 40
                    }
                  })
                ) : [])
              ],
            }),
          ],
        }),
      ],
    });
    
    children.push(table);
    
    // Add a subtle separator line
    children.push(
      new Paragraph({
        border: {
          bottom: {
            color: colors.ultraLight,
            space: 1,
            style: BorderStyle.SINGLE,
            size: 10,
          },
        },
        spacing: {
          before: 80,
          after: 160
        }
      })
    );
    
    // Add photo if provided
    if (photoOptions.path && photoOptions.placement !== this.PhotoPlacement.NONE && fs.existsSync(photoOptions.path)) {
      // Only add photo in specific positions based on the minimal style
      if (photoOptions.placement === this.PhotoPlacement.HEADER) {
        children.push(
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              this.createPhotoElement(photoOptions.path, this.PhotoSize.SMALL)
            ],
            spacing: {
              after: 120
            }
          })
        );
      }
    }
  }
  
  /**
   * Create an executive-style header with sophisticated styling
   */
  private static createExecutiveHeader(
    children: any[],
    headerContent: string,
    photoOptions: any,
    fonts: any,
    colors: any
  ): void {
    const headerLines = headerContent.split('\n');
    
    // Create a sophisticated header layout
    const hasPhoto = photoOptions.path && 
                    photoOptions.placement !== this.PhotoPlacement.NONE && 
                    fs.existsSync(photoOptions.path);
    
    // Name with decorative underline
    children.push(
      new Paragraph({
        alignment: AlignmentType.LEFT,
        children: [
          new TextRun({
            text: headerLines[0]?.trim().toUpperCase() || "NAME",
            bold: true,
            size: 40, // ~20pt font
            color: colors.primary,
            font: fonts.nameFont,
          }),
        ],
        spacing: {
          after: 60
        }
      })
    );
    
    // Custom underline for name
    children.push(
      new Paragraph({
        border: {
          bottom: {
            color: colors.primary,
            space: 1,
            style: BorderStyle.SINGLE,
            size: 8,
          },
        },
        spacing: {
          after: 120
        },
        children: [
          new TextRun({
            text: " ",
            size: 1,
          }),
        ],
      })
    );
    
    // Create a table for job title and optional photo
    const contentTable = new Table({
      width: {
        size: 100,
        type: WidthType.PERCENTAGE,
      },
      layout: TableLayoutType.FIXED,
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
            // Left column for job title and contact
            new TableCell({
              width: {
                size: hasPhoto ? 70 : 100,
                type: WidthType.PERCENTAGE,
              },
              borders: {
                top: { style: BorderStyle.NONE },
                bottom: { style: BorderStyle.NONE },
                left: { style: BorderStyle.NONE },
                right: { style: BorderStyle.NONE },
              },
              children: [
                // Job title if available
                ...(headerLines.length > 1 ? [
                  new Paragraph({
                    alignment: AlignmentType.LEFT,
                    children: [
                      new TextRun({
                        text: headerLines[1].trim(),
                        size: 26, // ~13pt font
                        color: colors.dark,
                        font: fonts.headingFont,
                        bold: true,
                      }),
                    ],
                    spacing: {
                      after: 120
                    }
                  })
                ] : []),
                // Contact info in a clean layout
                ...(headerLines.length > 2 ? headerLines.slice(2).map(line => 
                  new Paragraph({
                    alignment: AlignmentType.LEFT,
                    children: [
                      new TextRun({
                        text: line.trim(),
                        size: 22, // ~11pt font
                        font: fonts.bodyFont,
                        color: colors.medium,
                      }),
                    ],
                    spacing: {
                      after: 40
                    }
                  })
                ) : [])
              ],
            }),
            
            // Right column for photo if provided
            ...(hasPhoto ? [
              new TableCell({
                width: {
                  size: 30,
                  type: WidthType.PERCENTAGE,
                },
                borders: {
                  top: { style: BorderStyle.NONE },
                  bottom: { style: BorderStyle.NONE },
                  left: { style: BorderStyle.NONE },
                  right: { style: BorderStyle.NONE },
                },
                children: [
                  // Photo aligned to the right
                  new Paragraph({
                    alignment: AlignmentType.RIGHT,
                    children: [
                      this.createPhotoElement(photoOptions.path, photoOptions.size)
                    ],
                  }),
                ],
              })
            ] : []),
          ],
        }),
      ],
    });
    
    children.push(contentTable);
    
    // Add an elegant separator
    children.push(
      new Paragraph({
        border: {
          bottom: {
            color: colors.light,
            space: 1,
            style: BorderStyle.DOUBLE,
            size: 4,
          },
        },
        spacing: {
          before: 120,
          after: 240
        }
      })
    );
  }
  
  /**
   * Create a creative header with distinctive styling
   */
  private static createCreativeHeader(
    children: any[],
    headerContent: string,
    photoOptions: any,
    fonts: any,
    colors: any
  ): void {
    const headerLines = headerContent.split('\n');
    
    // Only include photo if a valid path is provided
    const hasPhoto = photoOptions.path && 
                    photoOptions.placement !== this.PhotoPlacement.NONE && 
                    fs.existsSync(photoOptions.path);
    
    // Create a distinctive layout for creative fields
    // Name with distinctive styling
    children.push(
      new Paragraph({
        alignment: AlignmentType.LEFT,
        children: [
          new TextRun({
            text: (headerLines[0]?.trim() || "NAME").toUpperCase(),
            bold: true,
            size: 38, // ~19pt font
            color: colors.primary,
            font: fonts.nameFont,
          }),
        ],
        spacing: {
          after: 40
        }
      })
    );
    
    // Job title with creative styling
    if (headerLines.length > 1) {
      children.push(
        new Paragraph({
          alignment: AlignmentType.LEFT,
          children: [
            new TextRun({
              text: "// ",
              size: 24,
              color: colors.accent,
              font: fonts.headingFont,
            }),
            new TextRun({
              text: headerLines[1].trim(),
              size: 24, // ~12pt font
              color: colors.medium,
              font: fonts.headingFont,
              italics: true,
            }),
          ],
          spacing: {
            after: 120
          }
        })
      );
    }
    
    // Create a table for contact info and photo
    const contentTable = new Table({
      width: {
        size: 100,
        type: WidthType.PERCENTAGE,
      },
      layout: TableLayoutType.FIXED,
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
            // Left column for contact info
            new TableCell({
              width: {
                size: hasPhoto ? 70 : 100,
                type: WidthType.PERCENTAGE,
              },
              borders: {
                top: { style: BorderStyle.NONE },
                bottom: { style: BorderStyle.NONE },
                left: { style: BorderStyle.NONE },
                right: { style: BorderStyle.NONE },
              },
              children: [
                // Contact info with icon-like prefixes
                ...(headerLines.length > 2 ? headerLines.slice(2).map(line => 
                  new Paragraph({
                    alignment: AlignmentType.LEFT,
                    children: [
                      new TextRun({
                        text: "• ",
                        size: 22,
                        color: colors.accent,
                        font: fonts.bodyFont,
                        bold: true,
                      }),
                      new TextRun({
                        text: line.trim(),
                        size: 22, // ~11pt font
                        font: fonts.bodyFont,
                        color: colors.dark,
                      }),
                    ],
                    spacing: {
                      after: 40
                    }
                  })
                ) : [])
              ],
            }),
            
            // Right column for photo
            ...(hasPhoto ? [
              new TableCell({
                width: {
                  size: 30,
                  type: WidthType.PERCENTAGE,
                },
                borders: {
                  top: { style: BorderStyle.NONE },
                  bottom: { style: BorderStyle.NONE },
                  left: { style: BorderStyle.NONE },
                  right: { style: BorderStyle.NONE },
                },
                children: [
                  // Photo with creative styling
                  new Paragraph({
                    alignment: AlignmentType.RIGHT,
                    children: [
                      this.createPhotoElement(photoOptions.path, photoOptions.size)
                    ],
                  }),
                ],
              })
            ] : []),
          ],
        }),
      ],
    });
    
    children.push(contentTable);
    
    // Add a creative separator (dashed line)
    children.push(
      new Paragraph({
        border: {
          bottom: {
            color: colors.accent,
            space: 1,
            style: BorderStyle.DASHED,
            size: 8,
          },
        },
        spacing: {
          before: 80,
          after: 200
        }
      })
    );
  }

  /**
   * Creates a simple photo element for the CV
   */
  private static createPhotoElement(
    photoPath: string,
    size: { width: number; height: number }
  ): ImageRun {
    try {
      // Check if file exists
      if (!fs.existsSync(photoPath)) {
        logger.warn(`Photo not found at ${photoPath}`);
        throw new Error('Photo not found');
      }
      
      // Read the image file
      const imageData = fs.readFileSync(photoPath);
      
      // Create a simple image run
      // Note: If we encounter type issues, we'll need to use any to bypass
      // the strict typing of the docx library
      return new ImageRun({
        data: imageData,
        transformation: {
          width: size.width,
          height: size.height,
        },
      } as any); // Use type assertion to bypass strict typing
    } catch (error) {
      logger.error(`Error creating photo element: ${error instanceof Error ? error.message : String(error)}`);
      // Return a minimal 1x1 transparent image as fallback
      return new ImageRun({
        data: Buffer.from(
          'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
          'base64'
        ),
        transformation: {
          width: 1,
          height: 1,
        },
      } as any); // Use type assertion to bypass strict typing
    }
  }

  /**
   * Creates a summary/profile section with professional formatting
   */
  private static createSummarySection(
    children: any[],
    summaryText: string,
    templateStyle: string,
    fonts: any,
    colors: any
  ): void {
    // Add section header with appropriate styling based on template
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: 'PROFESSIONAL SUMMARY',
            bold: true,
            size: 28, // ~14pt font
            color: colors.primary,
            font: fonts.nameFont,
          }),
        ],
        spacing: { before: 200, after: 120 },
        border: {
          bottom: {
            color: colors.light,
            space: 1,
            style: BorderStyle.SINGLE,
            size: 6,
          },
        },
      })
    );
    
    // Process and add summary content
    const summaryLines = summaryText.split('\n');
    summaryLines.forEach(line => {
      const trimmedLine = line.trim();
      if (trimmedLine.length === 0) return;
      
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: trimmedLine,
              size: 24, // ~12pt font
              font: fonts.bodyFont,
              color: colors.dark,
            }),
          ],
          spacing: {
            before: 80,
            after: 80
          }
        })
      );
    });
  }
  
  /**
   * Creates a skills section with modern visualization
   */
  private static createSkillsSection(
    children: any[],
    skillsText: string,
    metadata: any,
    templateStyle: string,
    fonts: any,
    colors: any
  ): void {
    // Add section header
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: 'SKILLS',
            bold: true,
            size: 28, // ~14pt font
            color: colors.primary,
            font: fonts.nameFont,
          }),
        ],
        spacing: { before: 200, after: 120 },
        border: {
          bottom: {
            color: colors.light,
            space: 1,
            style: BorderStyle.SINGLE,
            size: 6,
          },
        },
      })
    );
    
    // Extract skills from provided text or metadata
    let skillsList: string[] = [];
    
    // Extract skills from the text
    const skillsLines = skillsText.split('\n');
    skillsList = skillsLines
      .map(line => {
        const trimmedLine = line.trim();
        if (trimmedLine.length === 0) return null;
        
        // Remove bullet points if present
        if (trimmedLine.startsWith('-') || trimmedLine.startsWith('•') || trimmedLine.startsWith('*')) {
          return trimmedLine.substring(1).trim();
        }
        return trimmedLine;
      })
      .filter(Boolean) as string[];
    
    // If no skills extracted from text, use metadata or industry-based skills
    if (skillsList.length === 0) {
      if (metadata && metadata.skills && Array.isArray(metadata.skills) && metadata.skills.length > 0) {
        skillsList = metadata.skills;
      } else if (metadata && metadata.industry) {
        skillsList = DocumentGenerator.getIndustrySkills(metadata.industry);
      }
    }
    
    // Use different skill presentations based on template style
    if (templateStyle === DocumentGenerator.TemplateStyles.MODERN || 
        templateStyle === DocumentGenerator.TemplateStyles.CREATIVE) {
      // Create a modern table with 3 columns for skills
      DocumentGenerator.createSkillsTable(children, skillsList, 3, fonts, colors);
    } else if (templateStyle === DocumentGenerator.TemplateStyles.MINIMAL) {
      // Create a simple comma-separated list of skills
      DocumentGenerator.createSkillsList(children, skillsList, fonts, colors);
    } else {
      // For classic and executive styles, use a 2-column formal table
      DocumentGenerator.createSkillsTable(children, skillsList, 2, fonts, colors);
    }
  }
  
  /**
   * Creates a 3-column table for skills with modern styling
   */
  private static createSkillsTable(
    children: any[],
    skillsList: string[],
    columnsPerRow: number,
    fonts: any,
    colors: any
  ): void {
    const tableRows: TableRow[] = [];
    
    for (let i = 0; i < skillsList.length; i += columnsPerRow) {
      const rowSkills = skillsList.slice(i, i + columnsPerRow);
      
      // Create cells for this row with enhanced styling
      const cells = rowSkills.map(skill => 
        new TableCell({
          borders: {
            top: { style: BorderStyle.NONE },
            bottom: { style: BorderStyle.NONE },
            left: { style: BorderStyle.NONE },
            right: { style: BorderStyle.NONE },
          },
          children: [
            new Paragraph({
              children: [
                new TextRun({
                  text: "• ",
                  size: 22,
                  bold: true,
                  color: colors.primary,
                  font: fonts.nameFont,
                }),
                new TextRun({
                  text: skill,
                  size: 22,
                  color: colors.dark,
                  font: fonts.bodyFont,
                }),
              ],
              spacing: { before: 60, after: 60 }
            })
          ],
        })
      );
      
      // If we don't have enough skills to fill the row, add empty cells
      while (cells.length < columnsPerRow) {
        cells.push(
          new TableCell({
            borders: {
              top: { style: BorderStyle.NONE },
              bottom: { style: BorderStyle.NONE },
              left: { style: BorderStyle.NONE },
              right: { style: BorderStyle.NONE },
            },
            children: [new Paragraph({})],
          })
        );
      }
      
      // Add the row to the table
      tableRows.push(new TableRow({ children: cells }));
    }
    
    // Create the skills table with the rows
    const skillsTable = new Table({
      width: {
        size: 100,
        type: WidthType.PERCENTAGE,
      },
      layout: TableLayoutType.FIXED,
      borders: {
        top: { style: BorderStyle.NONE },
        bottom: { style: BorderStyle.NONE },
        left: { style: BorderStyle.NONE },
        right: { style: BorderStyle.NONE },
        insideHorizontal: { style: BorderStyle.NONE },
        insideVertical: { style: BorderStyle.NONE },
      },
      rows: tableRows,
    });
    
    // Add the skills table to the document
    children.push(skillsTable);
  }
  
  /**
   * Creates a simple comma-separated list of skills for minimal style
   */
  private static createSkillsList(
    children: any[],
    skillsList: string[],
    fonts: any,
    colors: any
  ): void {
    // Group skills into chunks of ~5 for readability
    const SKILLS_PER_LINE = 5;
    for (let i = 0; i < skillsList.length; i += SKILLS_PER_LINE) {
      const skillsChunk = skillsList.slice(i, i + SKILLS_PER_LINE);
      
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: skillsChunk.join(' • '),
              size: 22,
              color: colors.dark,
              font: fonts.bodyFont,
            }),
          ],
          spacing: {
            before: 60,
            after: 60
          },
          alignment: AlignmentType.LEFT
        })
      );
    }
  }
  
  /**
   * Creates a professional experience section with enhanced formatting
   */
  private static createExperienceSection(
    children: any[],
    experienceText: string,
    templateStyle: string,
    fonts: any,
    colors: any
  ): void {
    // Add section header
    const sectionTitle = templateStyle === this.TemplateStyles.EXECUTIVE ? 
      'PROFESSIONAL EXPERIENCE' : 'EXPERIENCE';
      
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: sectionTitle,
            bold: true,
            size: 28, // ~14pt font
            color: colors.primary,
            font: fonts.nameFont,
          }),
        ],
        spacing: { before: 200, after: 120 },
        border: {
          bottom: {
            color: colors.light,
            space: 1,
            style: BorderStyle.SINGLE,
            size: 6,
          },
        },
      })
    );
    
    // Process experience content
    const experienceLines = experienceText.split('\n');
    let currentJobTitle = '';
    let currentCompany = '';
    let currentDateRange = '';
    let currentBullets: string[] = [];
    let isProcessingJob = false;
    
    for (let i = 0; i < experienceLines.length; i++) {
      const line = experienceLines[i].trim();
      if (line.length === 0) {
        // Empty line - if we were processing a job, add it to the document
        if (isProcessingJob && (currentJobTitle || currentCompany)) {
          this.addJobToDocument(children, currentJobTitle, currentCompany, currentDateRange, currentBullets, fonts, colors);
          
          // Reset for next job
          currentJobTitle = '';
          currentCompany = '';
          currentDateRange = '';
          currentBullets = [];
          isProcessingJob = false;
        }
        continue;
      }
      
      // Check if this is a bullet point
      const isBullet = line.startsWith('-') || line.startsWith('•') || line.startsWith('*');
      
      if (isBullet) {
        // Add to current bullets
        currentBullets.push(line.substring(1).trim());
        isProcessingJob = true;
      } else {
        // Check if this might be a job title, company, or date
        const containsYear = /\b(19|20)\d{2}\b/.test(line);
        const isShortLine = line.length < 60;
        
        if (containsYear && isShortLine) {
          // This is likely a date range
          currentDateRange = line;
          isProcessingJob = true;
        } else if (isShortLine) {
          // This is likely a job title or company
          if (!currentJobTitle) {
            currentJobTitle = line;
          } else if (!currentCompany) {
            currentCompany = line;
          }
          isProcessingJob = true;
        } else {
          // This is likely a description - add it as a bullet
          currentBullets.push(line);
          isProcessingJob = true;
        }
      }
    }
    
    // Add the last job if there is one
    if (isProcessingJob && (currentJobTitle || currentCompany)) {
      this.addJobToDocument(children, currentJobTitle, currentCompany, currentDateRange, currentBullets, fonts, colors);
    }
  }
  
  /**
   * Creates an education section with enhanced formatting
   */
  private static createEducationSection(
    children: any[],
    educationText: string,
    templateStyle: string,
    fonts: any,
    colors: any
  ): void {
    // Add section header
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: 'EDUCATION',
            bold: true,
            size: 28, // ~14pt font
            color: colors.primary,
            font: fonts.nameFont,
          }),
        ],
        spacing: { before: 200, after: 120 },
        border: {
          bottom: {
            color: colors.light,
            space: 1,
            style: BorderStyle.SINGLE,
            size: 6,
          },
        },
      })
    );
    
    // Process education content
    const educationLines = educationText.split('\n');
    let currentDegree = '';
    let currentInstitution = '';
    let currentYear = '';
    let currentDetails: string[] = [];
    let isProcessingEducation = false;
    
    for (let i = 0; i < educationLines.length; i++) {
      const line = educationLines[i].trim();
      if (line.length === 0) {
        // Empty line - if we were processing an education entry, add it to the document
        if (isProcessingEducation && (currentDegree || currentInstitution)) {
          this.addEducationToDocument(children, currentDegree, currentInstitution, currentYear, currentDetails, fonts, colors);
          
          // Reset for next education entry
          currentDegree = '';
          currentInstitution = '';
          currentYear = '';
          currentDetails = [];
          isProcessingEducation = false;
          
          // Add a separator between education entries
          children.push(
            new Paragraph({
              border: {
                bottom: {
                  color: "#EEEEEE",
                  space: 1,
                  style: BorderStyle.SINGLE,
                  size: 1,
                },
              },
              spacing: {
                after: 120
              }
            })
          );
        }
        continue;
      }
      
      // Check if this is a bullet point
      const isBullet = line.startsWith('-') || line.startsWith('•') || line.startsWith('*');
      
      if (isBullet) {
        // Add to current details
        currentDetails.push(line.substring(1).trim());
        isProcessingEducation = true;
      } else {
        // Check if this might be a degree, institution, or year
        const containsYear = /\b(19|20)\d{2}\b/.test(line);
        const isShortLine = line.length < 60;
        const isDegreeKeyword = /\b(degree|diploma|bachelor|master|phd|certificate)\b/i.test(line);
        
        if (containsYear && isShortLine) {
          // This is likely a year
          currentYear = line;
          isProcessingEducation = true;
        } else if (isDegreeKeyword || (isShortLine && !currentDegree)) {
          // This is likely a degree
          currentDegree = line;
          isProcessingEducation = true;
        } else if (isShortLine) {
          // This is likely an institution
          currentInstitution = line;
          isProcessingEducation = true;
        } else {
          // This is likely a description - add it as a detail
          currentDetails.push(line);
          isProcessingEducation = true;
        }
      }
    }
    
    // Add the last education entry if there is one
    if (isProcessingEducation && (currentDegree || currentInstitution)) {
      this.addEducationToDocument(children, currentDegree, currentInstitution, currentYear, currentDetails, fonts, colors);
    }
  }
  
  /**
   * Creates a languages section with visual level indicators
   */
  private static createLanguagesSection(
    children: any[],
    languagesText: string,
    templateStyle: string,
    fonts: any,
    colors: any
  ): void {
    // Add Languages header
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: 'LANGUAGES',
            bold: true,
            size: 28,
            color: colors.primary,
            font: fonts.nameFont,
          }),
        ],
        spacing: {
          before: 200,
          after: 120
        },
        border: {
          bottom: {
            color: colors.light,
            space: 1,
            style: BorderStyle.SINGLE,
            size: 6,
          },
        },
      })
    );
    
    // Process languages
    const languageLines = languagesText.split('\n');
    const languagesList: {language: string, level: string}[] = [];
    
    languageLines.forEach(line => {
      const trimmed = line.trim();
      if (!trimmed) return;
      
      // Try to extract language and level
      const parts = trimmed.split(':').map(p => p.trim());
      if (parts.length >= 2) {
        languagesList.push({
          language: parts[0],
          level: parts[1]
        });
      } else if (trimmed.includes('-')) {
        const dashParts = trimmed.split('-').map(p => p.trim());
        if (dashParts.length >= 2) {
          languagesList.push({
            language: dashParts[0],
            level: dashParts[1]
          });
        } else {
          languagesList.push({
            language: trimmed,
            level: 'Proficient'
          });
        }
      } else {
        languagesList.push({
          language: trimmed,
          level: 'Proficient'
        });
      }
    });
    
    // Create language visualization based on template style
    if (templateStyle === this.TemplateStyles.MODERN || 
        templateStyle === this.TemplateStyles.CREATIVE) {
      // Modern visualization with horizontal bars
      this.createLanguageBars(children, languagesList, 3, fonts, colors);
    } else if (templateStyle === this.TemplateStyles.MINIMAL) {
      // Simple list for minimal style
      this.createSimpleLanguageList(children, languagesList, fonts, colors);
    } else {
      // Classic visualization
      this.createLanguageBars(children, languagesList, 2, fonts, colors);
    }
  }
  
  /**
   * Creates language proficiency bars
   */
  private static createLanguageBars(
    children: any[],
    languagesList: {language: string, level: string}[],
    columnsPerRow: number,
    fonts: any,
    colors: any
  ): void {
    // Create a table for languages with modern visualization
    const languageRows: TableRow[] = [];
    
    for (let i = 0; i < languagesList.length; i += columnsPerRow) {
      const rowLanguages = languagesList.slice(i, i + columnsPerRow);
      
      // Create cells for this row
      const cells = rowLanguages.map(lang => 
        new TableCell({
          borders: {
            top: { style: BorderStyle.NONE },
            bottom: { style: BorderStyle.NONE },
            left: { style: BorderStyle.NONE },
            right: { style: BorderStyle.NONE },
          },
          children: [
            new Paragraph({
              children: [
                new TextRun({
                  text: lang.language,
                  size: 22,
                  bold: true,
                  color: colors.dark,
                  font: fonts.bodyFont,
                }),
              ],
              spacing: { after: 40 }
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: this.getLanguageLevelBar(lang.level),
                  size: 20,
                  color: colors.primary,
                  font: fonts.nameFont,
                }),
              ],
              spacing: { before: 0, after: 80 }
            })
          ],
        })
      );
      
      // If we don't have enough languages to fill the row, add empty cells
      while (cells.length < columnsPerRow) {
        cells.push(
          new TableCell({
            borders: {
              top: { style: BorderStyle.NONE },
              bottom: { style: BorderStyle.NONE },
              left: { style: BorderStyle.NONE },
              right: { style: BorderStyle.NONE },
            },
            children: [new Paragraph({})],
          })
        );
      }
      
      // Add the row to the table
      languageRows.push(new TableRow({ children: cells }));
    }
    
    // Create the languages table
    const languagesTable = new Table({
      width: {
        size: 100,
        type: WidthType.PERCENTAGE,
      },
      layout: TableLayoutType.FIXED,
      borders: {
        top: { style: BorderStyle.NONE },
        bottom: { style: BorderStyle.NONE },
        left: { style: BorderStyle.NONE },
        right: { style: BorderStyle.NONE },
        insideHorizontal: { style: BorderStyle.NONE },
        insideVertical: { style: BorderStyle.NONE },
      },
      rows: languageRows,
    });
    
    // Add the languages table
    children.push(languagesTable);
  }
  
  /**
   * Creates a simple language list for minimal style
   */
  private static createSimpleLanguageList(
    children: any[],
    languagesList: {language: string, level: string}[],
    fonts: any,
    colors: any
  ): void {
    languagesList.forEach(lang => {
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `${lang.language}: `,
              size: 22,
              bold: true,
              color: colors.dark,
              font: fonts.bodyFont,
            }),
            new TextRun({
              text: lang.level,
              size: 22,
              color: colors.medium,
              font: fonts.bodyFont,
            }),
          ],
          spacing: {
            before: 40,
            after: 40
          }
        })
      );
    });
  }
  
  /**
   * Creates a generic section for any additional content
   */
  private static createGenericSection(
    children: any[],
    sectionName: string,
    content: string,
    templateStyle: string,
    fonts: any,
    colors: any
  ): void {
    // Format section name
    const formattedName = sectionName.charAt(0).toUpperCase() + sectionName.slice(1).toLowerCase();
    
    // Add section header
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: formattedName,
            bold: true,
            size: 28, // ~14pt font
            color: colors.primary,
            font: fonts.nameFont,
          }),
        ],
        spacing: { before: 200, after: 120 },
        border: {
          bottom: {
            color: colors.light,
            space: 1,
            style: BorderStyle.SINGLE,
            size: 6,
          },
        },
      })
    );
    
    // Process content
    const contentLines = content.split('\n');
    contentLines.forEach(line => {
      const trimmedLine = line.trim();
      if (trimmedLine.length === 0) return;
      
      // Check if line is a bullet point
      if (trimmedLine.startsWith('-') || trimmedLine.startsWith('•') || trimmedLine.startsWith('*')) {
        children.push(
          new Paragraph({
            children: [
              new TextRun({
                text: "• ",
                size: 22,
                bold: true,
                color: colors.primary,
                font: fonts.nameFont,
              }),
              new TextRun({
                text: trimmedLine.substring(1).trim(),
                size: 22,
                color: colors.dark,
                font: fonts.bodyFont,
              }),
            ],
            spacing: {
              before: 40,
              after: 40
            },
            indent: {
              left: convertInchesToTwip(0.25)
            }
          })
        );
      } else {
        children.push(
          new Paragraph({
            children: [
              new TextRun({
                text: trimmedLine,
                size: 22,
                color: colors.dark,
                font: fonts.bodyFont,
              }),
            ],
            spacing: {
              before: 40,
              after: 40
            }
          })
        );
      }
    });
  }
  
  /**
   * Add a job entry to the document with premium styling
   */
  private static addJobToDocument(
    children: any[], 
    jobTitle: string, 
    company: string, 
    dateRange: string, 
    bullets: string[],
    fonts: any,
    colors: any
  ): void {
    // Create a table for job title and date - modern side-by-side layout
    const jobHeaderTable = new Table({
      width: {
        size: 100,
        type: WidthType.PERCENTAGE,
      },
      layout: TableLayoutType.FIXED,
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
            // Left column for job title and company
            new TableCell({
              width: {
                size: 70,
                type: WidthType.PERCENTAGE,
              },
              borders: {
                top: { style: BorderStyle.NONE },
                bottom: { style: BorderStyle.NONE },
                left: { style: BorderStyle.NONE },
                right: { style: BorderStyle.NONE },
              },
              children: [
                // Job title
                new Paragraph({
                  children: [
                    new TextRun({
                      text: jobTitle,
                      size: 24, // ~12pt font
                      bold: true,
                      color: colors.dark,
                      font: fonts.bodyFont,
                    }),
                  ],
                  spacing: {
                    after: 40
                  }
                }),
                // Company
                new Paragraph({
                  children: [
                    new TextRun({
                      text: company,
                      size: 22, // ~11pt font
                      italics: true,
                      color: colors.medium,
                      font: fonts.bodyFont,
                    }),
                  ],
                  spacing: {
                    after: 40
                  }
                }),
              ],
            }),
            
            // Right column for date range
            new TableCell({
              width: {
                size: 30,
                type: WidthType.PERCENTAGE,
              },
              borders: {
                top: { style: BorderStyle.NONE },
                bottom: { style: BorderStyle.NONE },
                left: { style: BorderStyle.NONE },
                right: { style: BorderStyle.NONE },
              },
              children: [
                new Paragraph({
                  alignment: AlignmentType.RIGHT,
                  children: [
                    new TextRun({
                      text: dateRange,
                      size: 22, // ~11pt font
                      color: colors.medium,
                      font: fonts.bodyFont,
                    }),
                  ],
                }),
              ],
            }),
          ],
        }),
      ],
    });
    
    children.push(jobHeaderTable);
    
    // Add bullets with enhanced formatting and proper bullet points
    bullets.forEach(bullet => {
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: "• ",
              size: 22, // ~11pt font
              color: colors.primary,
              bold: true,
              font: fonts.bodyFont,
            }),
            new TextRun({
              text: bullet,
              size: 22, // ~11pt font
              color: colors.dark,
              font: fonts.bodyFont,
            }),
          ],
          indent: {
            left: convertInchesToTwip(0.25)
          },
          spacing: {
            before: 40,
            after: 40
          }
        })
      );
    });
  }
  
  /**
   * Add an education entry to the document with premium styling
   */
  private static addEducationToDocument(
    children: any[], 
    degree: string, 
    institution: string, 
    year: string, 
    details: string[],
    fonts: any,
    colors: any
  ): void {
    // Create a table for education - modern side-by-side layout
    const educationHeaderTable = new Table({
      width: {
        size: 100,
        type: WidthType.PERCENTAGE,
      },
      layout: TableLayoutType.FIXED,
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
            // Left column for institution and degree
            new TableCell({
              width: {
                size: 70,
                type: WidthType.PERCENTAGE,
              },
              borders: {
                top: { style: BorderStyle.NONE },
                bottom: { style: BorderStyle.NONE },
                left: { style: BorderStyle.NONE },
                right: { style: BorderStyle.NONE },
              },
              children: [
                // Institution
                new Paragraph({
                  children: [
                    new TextRun({
                      text: institution,
                      size: 24, // ~12pt font
                      bold: true,
                      color: colors.dark,
                      font: fonts.bodyFont,
                    }),
                  ],
                  spacing: {
                    after: 40
                  }
                }),
                // Degree
                new Paragraph({
                  children: [
                    new TextRun({
                      text: degree,
                      size: 22, // ~11pt font
                      italics: true,
                      color: colors.medium,
                      font: fonts.bodyFont,
                    }),
                  ],
                  spacing: {
                    after: 40
                  }
                }),
              ],
            }),
            
            // Right column for year
            new TableCell({
              width: {
                size: 30,
                type: WidthType.PERCENTAGE,
              },
              borders: {
                top: { style: BorderStyle.NONE },
                bottom: { style: BorderStyle.NONE },
                left: { style: BorderStyle.NONE },
                right: { style: BorderStyle.NONE },
              },
              children: [
                new Paragraph({
                  alignment: AlignmentType.RIGHT,
                  children: [
                    new TextRun({
                      text: year,
                      size: 22, // ~11pt font
                      color: colors.medium,
                      font: fonts.bodyFont,
                    }),
                  ],
                }),
              ],
            }),
          ],
        }),
      ],
    });
    
    children.push(educationHeaderTable);
    
    // Add details if any
    details.forEach(detail => {
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: "• ",
              size: 22, // ~11pt font
              color: colors.primary,
              bold: true,
              font: fonts.bodyFont,
            }),
            new TextRun({
              text: detail,
              size: 22, // ~11pt font
              color: colors.dark,
              font: fonts.bodyFont,
            }),
          ],
          indent: {
            left: convertInchesToTwip(0.25)
          },
          spacing: {
            before: 40,
            after: 40
          }
        })
      );
    });
  }
  
  /**
   * Creates a visual representation of language proficiency
   * @param level The language proficiency level description
   * @returns A string with visual bars representing the proficiency level
   */
  private static getLanguageLevelBar(level: string): string {
    // Normalize the level to handle variations in wording
    const normalizedLevel = level.toLowerCase().trim();
    
    // Map proficiency levels to visualization bars (5 levels)
    if (normalizedLevel.includes('native') || 
        normalizedLevel.includes('fluent') || 
        normalizedLevel.includes('c2') ||
        normalizedLevel.includes('proficient') ||
        normalizedLevel.includes('full') ||
        normalizedLevel.includes('professional') ||
        normalizedLevel === '5/5') {
      return '■■■■■'; // 5/5 - Native/Fluent
    } else if (normalizedLevel.includes('advanced') || 
              normalizedLevel.includes('c1') ||
              normalizedLevel.includes('very good') ||
              normalizedLevel.includes('high') ||
              normalizedLevel === '4/5') {
      return '■■■■□'; // 4/5 - Advanced
    } else if (normalizedLevel.includes('intermediate') || 
              normalizedLevel.includes('b2') ||
              normalizedLevel.includes('good') ||
              normalizedLevel.includes('moderate') ||
              normalizedLevel === '3/5') {
      return '■■■□□'; // 3/5 - Intermediate
    } else if (normalizedLevel.includes('limited') || 
              normalizedLevel.includes('basic') || 
              normalizedLevel.includes('b1') ||
              normalizedLevel === '2/5') {
      return '■■□□□'; // 2/5 - Basic
    } else if (normalizedLevel.includes('elementary') || 
              normalizedLevel.includes('beginner') || 
              normalizedLevel.includes('a1') ||
              normalizedLevel.includes('a2') ||
              normalizedLevel === '1/5') {
      return '■□□□□'; // 1/5 - Elementary
    }
    
    // Default to middle level if we can't determine
    return '■■■□□';
  }

  /**
   * Gets a list of skills commonly associated with a specific industry
   * @param industry The industry to get skills for
   * @returns Array of industry-specific skills
   */
  public static getIndustrySkills(industry: string): string[] {
    // Normalize industry name
    const normalizedIndustry = industry.toLowerCase().trim();

    // Define skills for each industry
    const industrySkills: {[key: string]: string[]} = {
      technology: [
        'JavaScript', 'React', 'Node.js', 'Python', 'SQL', 'AWS', 'DevOps',
        'Cloud Computing', 'Microservices', 'Docker', 'CI/CD', 'REST APIs',
        'TypeScript', 'Data Structures', 'Algorithms', 'System Design', 
        'Agile Development', 'Machine Learning', 'AI', 'Infrastructure as Code'
      ],
      finance: [
        'Financial Analysis', 'Risk Management', 'Financial Modeling', 'Investment Analysis',
        'Portfolio Management', 'Valuation', 'Financial Reporting', 'Regulatory Compliance',
        'Budgeting', 'Forecasting', 'Excel', 'Bloomberg Terminal', 'Financial Statements',
        'Banking Regulations', 'Credit Analysis', 'Asset Management', 'Derivatives'
      ],
      healthcare: [
        'Patient Care', 'Clinical Documentation', 'Medical Terminology', 'HIPAA Compliance',
        'Healthcare Informatics', 'Electronic Health Records (EHR)', 'Patient Assessment',
        'Care Coordination', 'Quality Improvement', 'Clinical Research', 'Patient Education',
        'Healthcare Regulations', 'Medical Billing', 'CPT Coding', 'Treatment Planning'
      ],
      marketing: [
        'Digital Marketing', 'Social Media Marketing', 'Content Creation', 'SEO/SEM',
        'Campaign Management', 'Analytics', 'Brand Development', 'Market Research',
        'CRM Tools', 'Email Marketing', 'Growth Strategies', 'Competitive Analysis',
        'A/B Testing', 'Conversion Optimization', 'Advertising', 'Google Analytics',
        'Marketing Automation', 'Customer Journey Mapping', 'Copywriting'
      ],
      retail: [
        'Merchandising', 'Inventory Management', 'POS Systems', 'Customer Service',
        'Sales', 'Visual Merchandising', 'Supply Chain', 'Retail Operations',
        'E-commerce', 'Forecasting', 'Loss Prevention', 'Vendor Management',
        'Category Management', 'Pricing Strategies', 'Brand Management',
        'Retail Analytics', 'Customer Experience'
      ],
      legal: [
        'Legal Research', 'Case Management', 'Litigation', 'Legal Writing',
        'Contract Drafting', 'Legal Analysis', 'Regulatory Compliance', 'Due Diligence',
        'Client Communication', 'Legal Documentation', 'Negotiation', 'Alternative Dispute Resolution',
        'Legal Ethics', 'E-Discovery', 'Legal Project Management', 'Risk Assessment'
      ],
      'human resources': [
        'Recruitment', 'Employee Relations', 'Performance Management', 'HRIS',
        'Benefits Administration', 'Compensation Analysis', 'Employee Onboarding',
        'HR Policies', 'Talent Development', 'Workforce Planning', 'Compliance',
        'Labor Relations', 'DEIB Initiatives', 'Employment Law', 'Succession Planning',
        'HR Analytics', 'Training & Development'
      ],
      education: [
        'Curriculum Development', 'Instructional Design', 'Assessment Methods',
        'Classroom Management', 'Educational Technology', 'Differentiated Instruction',
        'Lesson Planning', 'Student Engagement', 'Educational Psychology',
        'Learning Management Systems', 'Special Education', 'Student Advising',
        'Research Methods', 'Program Evaluation', 'Grant Writing'
      ],
      manufacturing: [
        'Quality Control', 'Lean Manufacturing', 'Six Sigma', 'Process Improvement',
        'Supply Chain Management', 'Inventory Control', 'Production Planning',
        'Equipment Maintenance', 'Safety Protocols', 'ISO Standards',
        'Material Requirements Planning', 'CAD/CAM', 'Automation',
        'Cost Reduction', 'Production Scheduling', 'ERP Systems'
      ],
      construction: [
        'Project Management', 'Blueprint Reading', 'Building Codes',
        'Cost Estimation', 'Construction Methods', 'Safety Compliance',
        'Contract Administration', 'Quality Assurance', 'Scheduling',
        'Subcontractor Management', 'Building Information Modeling (BIM)',
        'Permitting', 'OSHA Regulations', 'Construction Documentation',
        'Site Supervision', 'Materials Knowledge'
      ]
    };

    // Search for matching industry
    const matchingIndustry = Object.keys(industrySkills).find(key => 
      normalizedIndustry.includes(key) || key.includes(normalizedIndustry)
    );

    // Return skills for matching industry or default skills if not found
    if (matchingIndustry) {
      return industrySkills[matchingIndustry];
    }

    // Default skills for any industry
    return [
      'Communication', 'Problem-Solving', 'Teamwork', 'Project Management',
      'Leadership', 'Time Management', 'Critical Thinking', 'Adaptability',
      'Organization', 'Attention to Detail', 'Microsoft Office', 'Customer Service'
    ];
  }

  /**
   * Generate an ATS-optimized DOCX CV with structured sections
   * @param optimizedText The optimized CV text from GPT-4o
   * @param atsAnalysis The ATS analysis metadata with scores and recommendations
   * @param options Optional formatting options for the document
   * @returns Buffer containing the generated DOCX file
   */
  static async generateATSOptimizedCV(
    optimizedText: string,
    atsAnalysis: {
      atsScore: number;
      originalAtsScore?: number;
      sectionRecommendations?: Record<string, string[]>;
      keywordRecommendations?: string[];
      missingSections?: string[];
      improvementSuggestions?: string[];
    },
    options?: {
      templateStyle?: string;
      photoOptions?: {
        path?: string;
        placement?: string;
        size?: { width: number; height: number };
        border?: boolean;
        borderColor?: string;
      },
      fontOptions?: {
        headingFont?: string;
        bodyFont?: string;
        nameFont?: string;
        preset?: string;
      },
      colorOptions?: {
        primary?: string;
        accent?: string;
      }
    }
  ): Promise<Buffer> {
    try {
      const startTime = Date.now();
      
      // Parse the optimized text into structured sections
      // This should handle both raw text and pre-structured sections
      const sections = this.parseATSOptimizedSections(optimizedText);
      
      // Process template style
      const templateStyle = options?.templateStyle || this.TemplateStyles.MODERN;
      
      // Process font options
      let fonts = {
        headingFont: this.FontPresets.MODERN.headingFont,
        bodyFont: this.FontPresets.MODERN.bodyFont,
        nameFont: this.FontPresets.MODERN.nameFont
      };

      // Handle custom font presets
      if (options?.fontOptions?.preset) {
        const presetKey = options.fontOptions.preset.toUpperCase();
        if (presetKey in DocumentGenerator.FontPresets) {
          fonts = { ...DocumentGenerator.FontPresets[presetKey as keyof typeof DocumentGenerator.FontPresets] };
        }
      }

      // Override individual font options if specified
      if (options?.fontOptions?.headingFont) fonts.headingFont = options.fontOptions.headingFont;
      if (options?.fontOptions?.bodyFont) fonts.bodyFont = options.fontOptions.bodyFont;
      if (options?.fontOptions?.nameFont) fonts.nameFont = options.fontOptions.nameFont;

      // Process color options
      const colors = { ...this.colors };
      if (options?.colorOptions?.primary) colors.primary = options.colorOptions.primary;
      if (options?.colorOptions?.accent) colors.accent = options.colorOptions.accent;
      
      // Create document with ATS-optimized formatting - using a slightly more conservative approach
      // for ATS compatibility while maintaining great visual design
      const doc = new Document({
        styles: {
          paragraphStyles: [
            {
              id: "SectionHeading",
              name: "Section Heading",
              basedOn: "Normal",
              next: "Normal",
              quickFormat: true,
              run: {
                font: fonts.headingFont,
                size: 28,
                bold: true,
                color: colors.primary,
              },
              paragraph: {
                spacing: {
                  after: 120,
                  before: 240,
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
                font: fonts.bodyFont,
                size: 22,
                color: colors.dark,
              },
              paragraph: {
                spacing: {
                  after: 80,
                  line: 360, // 1.5 line spacing
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
                  top: convertInchesToTwip(0.5),
                  right: convertInchesToTwip(0.5),
                  bottom: convertInchesToTwip(0.5),
                  left: convertInchesToTwip(0.5),
                },
                size: {
                  orientation: PageOrientation.PORTRAIT,
                },
              },
            },
            children: this.createATSOptimizedContent(
              sections, 
              atsAnalysis,
              templateStyle,
              options?.photoOptions,
              fonts,
              colors
            )
          }
        ]
      });
      
      // Generate buffer
      const buffer = await Packer.toBuffer(doc);
      
      console.log(`ATS-optimized document generation completed in ${Date.now() - startTime}ms with score ${atsAnalysis.atsScore}%`);
      return buffer;
    } catch (error) {
      console.error(`Error generating ATS-optimized document: ${error instanceof Error ? error.message : String(error)}`);
      throw new Error(`ATS-optimized document generation failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Parse optimized text into structured sections specifically for ATS optimization
   * @param optimizedText The optimized CV text
   * @returns Structured sections for document generation
   */
  private static parseATSOptimizedSections(optimizedText: string): Record<string, string> {
    try {
      // First, check if the text is already in JSON format (pre-structured)
      try {
        const parsedJSON = JSON.parse(optimizedText);
        if (typeof parsedJSON === 'object' && parsedJSON !== null) {
          return parsedJSON;
        }
      } catch {
        // Not JSON, continue with text parsing
      }
      
      // Initialize sections
      const sections: Record<string, string> = {
        header: "",
        profile: "",
        achievements: "",
        experience: "",
        skills: "",
        education: "",
        languages: ""
      };
      
      // Try to extract sections based on common headers in the text
      const sectionPatterns = {
        profile: /\b(PROFILE|SUMMARY|ABOUT ME|PROFESSIONAL SUMMARY)\b/i,
        achievements: /\b(ACHIEVEMENTS|KEY ACHIEVEMENTS|ACCOMPLISHMENTS)\b/i,
        experience: /\b(EXPERIENCE|WORK EXPERIENCE|EMPLOYMENT HISTORY|PROFESSIONAL EXPERIENCE)\b/i,
        skills: /\b(SKILLS|COMPETENCIES|TECHNICAL SKILLS|CORE COMPETENCIES)\b/i,
        education: /\b(EDUCATION|EDUCATIONAL BACKGROUND|ACADEMIC QUALIFICATIONS)\b/i,
        languages: /\b(LANGUAGES|LANGUAGE PROFICIENCY|LANGUAGE SKILLS)\b/i
      };
      
      // Extract the header (assume first few lines before any section)
      const headerEndMatch = optimizedText.match(new RegExp(`\\b(${Object.values(sectionPatterns).map(p => p.source.replace(/\\b/g, '')).join('|')})\\b`, 'i'));
      if (headerEndMatch && headerEndMatch.index) {
        sections.header = optimizedText.substring(0, headerEndMatch.index).trim();
      } else {
        // If no section headers found, extract first 5 lines as header
        const lines = optimizedText.split('\n');
        sections.header = lines.slice(0, Math.min(5, lines.length)).join('\n').trim();
      }
      
      // Extract each section
      for (const [sectionName, pattern] of Object.entries(sectionPatterns)) {
        const sectionMatch = optimizedText.match(new RegExp(`\\b${pattern.source.replace(/\\b/g, '')}\\b.*?\\n(.*?)(?=\\n\\s*\\b(${Object.values(sectionPatterns).map(p => p.source.replace(/\\b/g, '')).join('|')})\\b|$)`, 'is'));
        
        if (sectionMatch && sectionMatch[1]) {
          sections[sectionName] = sectionMatch[1].trim();
        }
      }
      
      return sections;
    } catch (error) {
      console.error(`Error parsing optimized sections: ${error instanceof Error ? error.message : String(error)}`);
      // Fallback to basic section extraction
      return this.splitIntoSections(optimizedText);
    }
  }
  
  /**
   * Create ATS-optimized document content with professional formatting
   * This specialized method ensures proper ATS compatibility while maintaining excellent design
   */
  private static createATSOptimizedContent(
    sections: Record<string, string>,
    atsAnalysis: any,
    templateStyle: string,
    photoOptions?: {
      path?: string;
      placement?: string;
      size?: { width: number; height: number };
      border?: boolean;
      borderColor?: string;
    },
    fonts?: {
      headingFont: string;
      bodyFont: string;
      nameFont: string;
    },
    colors?: {
      primary: string;
      accent: string;
      dark: string;
      medium: string;
      light: string;
      ultraLight: string;
      white: string;
    }
  ): any[] {
    // Default fonts and colors if not provided
    const activeColors = colors || this.colors;
    const activeFonts = fonts || {
      headingFont: this.FontPresets.MODERN.headingFont,
      bodyFont: this.FontPresets.MODERN.bodyFont,
      nameFont: this.FontPresets.MODERN.nameFont
    };
    
    // Use modern template as default
    const activeTemplate = templateStyle || this.TemplateStyles.MODERN;
    
    const children: any[] = [];
    
    // Setup default photo options if not provided
    const photo = {
      path: photoOptions?.path || '',
      placement: photoOptions?.placement || this.PhotoPlacement.TOP_RIGHT,
      size: photoOptions?.size || this.PhotoSize.MEDIUM,
      border: photoOptions?.border !== undefined ? photoOptions.border : true,
      borderColor: photoOptions?.borderColor || activeColors.primary
    };
    
    // Add header based on selected template
    if (sections.header) {
      switch (activeTemplate) {
        case this.TemplateStyles.MODERN:
          this.createModernHeader(children, sections.header, photo, activeFonts, activeColors);
          break;
        case this.TemplateStyles.CLASSIC:
          this.createClassicHeader(children, sections.header, photo, activeFonts, activeColors);
          break;
        case this.TemplateStyles.MINIMAL:
          this.createMinimalHeader(children, sections.header, photo, activeFonts, activeColors);
          break;
        case this.TemplateStyles.EXECUTIVE:
          this.createExecutiveHeader(children, sections.header, photo, activeFonts, activeColors);
          break;
        case this.TemplateStyles.CREATIVE:
          this.createCreativeHeader(children, sections.header, photo, activeFonts, activeColors);
          break;
        default:
          this.createModernHeader(children, sections.header, photo, activeFonts, activeColors);
          break;
      }
    }
    
    // Add profile section (About Me)
    if (sections.profile) {
      this.createATSSection(children, "PROFILE", sections.profile, activeFonts, activeColors);
    }
    
    // Add achievements section (3 bullet points summarizing top accomplishments)
    if (sections.achievements) {
      this.createATSSection(children, "ACHIEVEMENTS", sections.achievements, activeFonts, activeColors);
    }
    
    // Add experience section with enhanced formatting
    if (sections.experience) {
      this.createATSSection(children, "EXPERIENCE", sections.experience, activeFonts, activeColors);
    }
    
    // Add skills section with modern formatting
    if (sections.skills) {
      this.createATSSection(children, "SKILLS", sections.skills, activeFonts, activeColors);
    }
    
    // Add education section with enhanced formatting
    if (sections.education) {
      this.createATSSection(children, "EDUCATION", sections.education, activeFonts, activeColors);
    }
    
    // Add languages section if available
    if (sections.languages) {
      this.createATSSection(children, "LANGUAGES", sections.languages, activeFonts, activeColors);
    }
    
    // Add any remaining sections
    for (const [sectionName, content] of Object.entries(sections)) {
      if (!['header', 'profile', 'achievements', 'experience', 'skills', 'education', 'languages'].includes(sectionName)) {
        this.createATSSection(children, sectionName.toUpperCase(), content, activeFonts, activeColors);
      }
    }
    
    return children;
  }
  
  /**
   * Creates an ATS-optimized section with clear heading and content
   * Ensures proper formatting for ATS parsing while maintaining visual appeal
   */
  private static createATSSection(
    children: any[], 
    title: string, 
    content: string,
    fonts: any,
    colors: any
  ): void {
    // Add section header with appropriate styling
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: title,
            bold: true,
            size: 28, // ~14pt font
            color: colors.primary,
            font: fonts.nameFont,
          }),
        ],
        spacing: { before: 200, after: 120 },
        border: {
          bottom: {
            color: colors.light,
            space: 1,
            style: BorderStyle.SINGLE,
            size: 6,
          },
        },
      })
    );
    
    // Process content
    const lines = content.split('\n');
    let isInBulletList = false;
    
    lines.forEach((line, index) => {
      const trimmedLine = line.trim();
      if (trimmedLine.length === 0) {
        // Add some spacing for empty lines to improve readability
        if (isInBulletList) {
          isInBulletList = false;
          children.push(
            new Paragraph({
              spacing: { before: 80, after: 80 }
            })
          );
        }
        return;
      }
      
      // Check if line starts with a bullet point
      const isBullet = trimmedLine.startsWith('-') || 
                      trimmedLine.startsWith('•') || 
                      trimmedLine.startsWith('*') ||
                      /^\d+\.\s/.test(trimmedLine);
      
      if (isBullet) {
        isInBulletList = true;
        
        // Extract the content without the bullet character
        let bulletContent = trimmedLine;
        if (trimmedLine.startsWith('-') || trimmedLine.startsWith('•') || trimmedLine.startsWith('*')) {
          bulletContent = trimmedLine.substring(1).trim();
        } else if (/^\d+\.\s/.test(trimmedLine)) {
          bulletContent = trimmedLine.replace(/^\d+\.\s/, '').trim();
        }
        
        children.push(
          new Paragraph({
            children: [
              new TextRun({
                text: "• ",
                size: 22,
                bold: true,
                color: colors.primary,
                font: fonts.nameFont,
              }),
              new TextRun({
                text: bulletContent,
                size: 22,
                color: colors.dark,
                font: fonts.bodyFont,
              }),
            ],
            spacing: {
              before: 40,
              after: 40
            },
            indent: {
              left: convertInchesToTwip(0.25)
            }
          })
        );
      } else {
        // Check if this might be a subheading
        const isSubheading = (
          trimmedLine.length < 50 && 
          index > 0 && 
          lines[index - 1].trim().length === 0 &&
          ((index < lines.length - 1 && lines[index + 1].trim().length === 0) || 
          /\b(at|with|for)\b/i.test(trimmedLine))
        ) || /\d{4}\s*-\s*(present|\d{4})/i.test(trimmedLine);
        
        if (isSubheading) {
          // This is likely a job title, company name, or date range
          children.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: trimmedLine,
                  size: 24,
                  bold: true,
                  color: colors.dark,
                  font: fonts.bodyFont,
                }),
              ],
              spacing: { before: 100, after: 40 }
            })
          );
          isInBulletList = false;
        } else {
          // Regular paragraph
          children.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: trimmedLine,
                  size: 22,
                  color: colors.dark,
                  font: fonts.bodyFont,
                }),
              ],
              spacing: {
                before: 40,
                after: 40
              }
            })
          );
          isInBulletList = false;
        }
      }
    });
  }
} 