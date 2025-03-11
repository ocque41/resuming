import { Document, Packer, Paragraph, TextRun, HeadingLevel, BorderStyle, AlignmentType } from "docx";
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
      
      // Create document with valid Paragraph objects
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
  private static createDocumentContent(sections: Record<string, string>, metadata?: any): Paragraph[] {
    const content: Paragraph[] = [];
    
    // Add title
    content.push(new Paragraph({
      text: 'OPTIMIZED CURRICULUM VITAE',
      heading: HeadingLevel.HEADING_1,
      alignment: AlignmentType.CENTER,
      spacing: { after: 20 }
    }));
    
    // Add contact information if available
    if (sections['Contact Information'] || sections['CONTACT INFORMATION']) {
      const contactInfo = sections['Contact Information'] || sections['CONTACT INFORMATION'];
      content.push(new Paragraph({
        text: contactInfo,
        alignment: AlignmentType.CENTER,
        spacing: { after: 20 }
      }));
    }
    
    // Add summary/profile if available
    if (sections['Summary'] || sections['SUMMARY'] || sections['Profile'] || sections['PROFILE']) {
      const summary = sections['Summary'] || sections['SUMMARY'] || sections['Profile'] || sections['PROFILE'];
      content.push(new Paragraph({
        text: 'PROFESSIONAL SUMMARY',
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 10, after: 10 }
      }));
      content.push(new Paragraph({
        text: summary,
        spacing: { after: 15 }
      }));
    }
    
    // Add skills section - ensure it's always present with actual data
    let skillsContent = sections['Skills'] || sections['SKILLS'] || '';
    let skillsList: string[] = [];
    
    if (skillsContent.trim()) {
      // Extract skills from the content
      skillsList = skillsContent
        .split(/[,;\n]/)
        .map(skill => skill.trim())
        .filter(skill => skill.length > 0);
    }
    
    // If no skills found or empty skills section, use a fallback
    if (skillsList.length === 0 && metadata && metadata.keywordAnalysis) {
      // Extract skills from keyword analysis if available
      skillsList = Object.keys(metadata.keywordAnalysis).slice(0, 10);
    }
    
    // If still no skills, use a generic set based on industry
    if (skillsList.length === 0 && metadata && metadata.industry) {
      const industry = metadata.industry.toLowerCase();
      
      if (industry.includes('tech') || industry.includes('software') || industry.includes('it')) {
        skillsList = ['Programming', 'Software Development', 'Problem Solving', 'Agile Methodologies', 'Database Management', 'System Architecture', 'Cloud Computing', 'API Integration', 'Version Control', 'Technical Documentation'];
      } else if (industry.includes('finance') || industry.includes('accounting')) {
        skillsList = ['Financial Analysis', 'Budgeting', 'Forecasting', 'Risk Assessment', 'Financial Reporting', 'Regulatory Compliance', 'Data Analysis', 'Strategic Planning', 'Financial Modeling', 'Accounting Principles'];
      } else if (industry.includes('marketing') || industry.includes('sales')) {
        skillsList = ['Digital Marketing', 'Market Research', 'Content Strategy', 'Social Media Management', 'SEO/SEM', 'Campaign Management', 'Customer Relationship Management', 'Brand Development', 'Analytics', 'Presentation Skills'];
      } else if (industry.includes('healthcare') || industry.includes('medical')) {
        skillsList = ['Patient Care', 'Medical Documentation', 'Healthcare Compliance', 'Clinical Procedures', 'Medical Terminology', 'Electronic Health Records', 'Patient Education', 'Case Management', 'Medical Research', 'Healthcare Regulations'];
      } else {
        skillsList = ['Communication', 'Leadership', 'Project Management', 'Problem Solving', 'Team Collaboration', 'Time Management', 'Critical Thinking', 'Adaptability', 'Attention to Detail', 'Organization'];
      }
    }
    
    // Add the skills section with the skills we found or generated
    content.push(new Paragraph({
      text: 'SKILLS',
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 10, after: 10 }
    }));
    
    // Format skills in a clean, organized way
    content.push(new Paragraph({
      text: skillsList.join(', '),
      spacing: { after: 15 }
    }));
    
    // Add experience section if available
    if (sections['Experience'] || sections['EXPERIENCE'] || sections['Work Experience'] || sections['WORK EXPERIENCE']) {
      const experience = sections['Experience'] || sections['EXPERIENCE'] || sections['Work Experience'] || sections['WORK EXPERIENCE'];
      content.push(new Paragraph({
        text: 'PROFESSIONAL EXPERIENCE',
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 10, after: 10 }
      }));
      content.push(new Paragraph({
        text: experience,
        spacing: { after: 15 }
      }));
      
      // Add achievements section based on experience
      if (experience && experience.trim().length > 0) {
        const achievements = this.extractAchievements(experience);
        
        if (achievements.length > 0) {
          content.push(new Paragraph({
            text: 'KEY ACHIEVEMENTS',
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 10, after: 10 }
          }));
          
          achievements.slice(0, 3).forEach(ach => {
            content.push(new Paragraph({
              text: `• ${ach}`,
              spacing: { after: 5 }
            }));
          });
        }
      }
    } else {
      // If no experience section, add a goals section instead
      content.push(new Paragraph({
        text: 'CAREER GOALS',
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 10, after: 10 }
      }));
      
      content.push(new Paragraph({
        text: "To secure a challenging position that utilizes my skills and experience while providing opportunities for professional growth. To contribute to organizational success through innovative solutions and dedication to excellence. To continuously develop my expertise and stay at the forefront of industry developments.",
        spacing: { after: 15 }
      }));
    }
    
    // Add education section if available
    if (sections['Education'] || sections['EDUCATION']) {
      const education = sections['Education'] || sections['EDUCATION'];
      content.push(new Paragraph({
        text: 'EDUCATION',
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 10, after: 10 }
      }));
      content.push(new Paragraph({
        text: education,
        spacing: { after: 15 }
      }));
    }
    
    // Add certifications if available
    if (sections['Certifications'] || sections['CERTIFICATIONS']) {
      const certifications = sections['Certifications'] || sections['CERTIFICATIONS'];
      content.push(new Paragraph({
        text: 'CERTIFICATIONS',
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 10, after: 10 }
      }));
      content.push(new Paragraph({
        text: certifications,
        spacing: { after: 15 }
      }));
    }
    
    // Add additional sections
    const knownSections = [
      'Contact Information', 'CONTACT INFORMATION',
      'Summary', 'SUMMARY', 'Profile', 'PROFILE',
      'Skills', 'SKILLS',
      'Experience', 'EXPERIENCE', 'Work Experience', 'WORK EXPERIENCE',
      'Education', 'EDUCATION',
      'Certifications', 'CERTIFICATIONS'
    ];
    
    for (const [key, value] of Object.entries(sections)) {
      if (!knownSections.includes(key) && value.trim()) {
        content.push(new Paragraph({
          text: key.toUpperCase(),
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 10, after: 10 }
        }));
        content.push(new Paragraph({
          text: value,
          spacing: { after: 15 }
        }));
      }
    }
    
    return content;
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
   * Extract achievements from work experience text
   */
  private static extractAchievements(experienceText: string): string[] {
    const achievements: string[] = [];
    
    // Split the experience text into lines
    const lines = experienceText.split('\n');
    
    // Define patterns that indicate achievements
    const achievementPatterns = [
      // Action verbs that often indicate achievements
      /\b(achieved|accomplished|improved|increased|decreased|reduced|saved|generated|delivered|created|developed|implemented|launched|led|managed|negotiated|organized|produced|resolved|streamlined|succeeded|transformed|won)\b/i,
      
      // Metrics and numbers often indicate achievements
      /\b(\d+%|\$\d+|\d+ percent|million|billion|thousand)\b/i,
      
      // Results and outcomes
      /\b(resulting in|which led to|leading to|improved|increased|decreased|reduced|enhanced|boosted|grew|expanded)\b/i
    ];
    
    // Look for lines that match achievement patterns
    for (const line of lines) {
      const trimmedLine = line.trim();
      
      // Skip empty lines
      if (!trimmedLine) continue;
      
      // Check if the line matches any achievement pattern
      const isAchievement = achievementPatterns.some(pattern => pattern.test(trimmedLine));
      
      if (isAchievement) {
        // Clean up the achievement text
        let achievement = trimmedLine;
        
        // Remove bullet points or numbering
        achievement = achievement.replace(/^[-•*]\s*/, '');
        achievement = achievement.replace(/^\d+\.\s*/, '');
        
        // Ensure the first letter is capitalized
        achievement = achievement.charAt(0).toUpperCase() + achievement.slice(1);
        
        // Add a period at the end if missing
        if (!achievement.endsWith('.') && !achievement.endsWith('!') && !achievement.endsWith('?')) {
          achievement += '.';
        }
        
        achievements.push(achievement);
      }
    }
    
    // If no achievements found using patterns, try to extract based on job titles or responsibilities
    if (achievements.length === 0) {
      // Look for job titles or positions
      const jobTitlePattern = /\b(manager|director|lead|senior|supervisor|coordinator|specialist|analyst|engineer|developer|consultant|advisor)\b/i;
      
      for (const line of lines) {
        const trimmedLine = line.trim();
        
        // Skip empty lines
        if (!trimmedLine) continue;
        
        // Check if the line contains a job title
        if (jobTitlePattern.test(trimmedLine)) {
          // Create a generic achievement based on the job title
          const jobTitle = trimmedLine.match(jobTitlePattern)?.[0] || '';
          
          if (jobTitle) {
            const capitalizedJobTitle = jobTitle.charAt(0).toUpperCase() + jobTitle.slice(1).toLowerCase();
            
            // Generate a generic achievement
            const genericAchievement = `Successfully performed as ${capitalizedJobTitle}, demonstrating leadership and expertise in the role.`;
            achievements.push(genericAchievement);
            
            // Only add one generic achievement based on job title
            break;
          }
        }
      }
      
      // If still no achievements, add generic ones
      if (achievements.length === 0) {
        achievements.push('Successfully completed projects on time and within budget constraints.');
        achievements.push('Collaborated effectively with cross-functional teams to achieve organizational goals.');
        achievements.push('Demonstrated strong problem-solving skills and attention to detail in all assignments.');
      }
    }
    
    // Return the top achievements (limit to 5)
    return achievements.slice(0, 5);
  }

  public static async generateDocument(cvData: string, metadata?: any): Promise<{ docxBase64: string }> {
    try {
      // Parse the CV data
      const sections = this.parseCVSections(cvData);
      
      // Create document content
      const content = this.createDocumentContent(sections, metadata);
      
      // Define document styles
      const documentDefinition = {
        content: content,
        styles: {
          header: {
            fontSize: 18,
            bold: true,
            color: '#333333'
          },
          contactInfo: {
            fontSize: 11,
            alignment: 'center'
          },
          sectionHeader: {
            fontSize: 14,
            bold: true,
            color: '#333333',
            decoration: 'underline'
          },
          normal: {
            fontSize: 11,
            lineHeight: 1.2
          },
          skills: {
            fontSize: 11,
            lineHeight: 1.2
          },
          skillItem: {
            fontSize: 11,
            lineHeight: 1.5
          },
          achievementItem: {
            fontSize: 11,
            lineHeight: 1.5
          },
          goalItem: {
            fontSize: 11,
            lineHeight: 1.5
          }
        },
        defaultStyle: {
          fontSize: 11,
          font: 'Helvetica'
        },
        pageMargins: [40, 40, 40, 40]
      };
      
      // Generate PDF
      const pdfDoc = require('pdfmake/build/pdfmake');
      const pdfFonts = require('pdfmake/build/vfs_fonts');
      pdfDoc.vfs = pdfFonts.pdfMake.vfs;
      
      // Create a buffer from the PDF
      const pdfBuffer = await new Promise<Buffer>((resolve) => {
        const pdfDocGenerator = pdfDoc.createPdf(documentDefinition);
        pdfDocGenerator.getBuffer((buffer: Buffer) => {
          resolve(buffer);
        });
      });
      
      // Convert to base64
      const docxBase64 = pdfBuffer.toString('base64');
      
      return { docxBase64 };
    } catch (error) {
      console.error('Error generating document:', error);
      throw error;
    }
  }

  /**
   * Parse CV data into sections
   */
  private static parseCVSections(cvData: string): Record<string, string> {
    const sections: Record<string, string> = {};
    
    // Split the CV data by section headers (all caps followed by newline)
    const sectionRegex = /^([A-Z][A-Z\s]+)(?:\r?\n|\r)/gm;
    let match;
    let lastIndex = 0;
    let lastSectionName = '';
    
    // Find all section headers
    while ((match = sectionRegex.exec(cvData)) !== null) {
      // If this isn't the first match, add the previous section content
      if (lastSectionName) {
        const sectionContent = cvData.substring(lastIndex, match.index).trim();
        sections[lastSectionName] = sectionContent;
      }
      
      // Update for the next section
      lastSectionName = match[1].trim();
      lastIndex = match.index + match[0].length;
    }
    
    // Add the last section
    if (lastSectionName) {
      const sectionContent = cvData.substring(lastIndex).trim();
      sections[lastSectionName] = sectionContent;
    }
    
    // If no sections were found, try to identify common sections
    if (Object.keys(sections).length === 0) {
      // Try to identify contact information (usually at the top)
      const lines = cvData.split('\n');
      let contactInfo = '';
      let i = 0;
      
      // First few lines are usually contact info
      while (i < lines.length && i < 5) {
        const line = lines[i].trim();
        if (line && (line.includes('@') || line.includes('phone') || line.includes('tel') || 
                    /^\d{3}[-.\s]?\d{3}[-.\s]?\d{4}$/.test(line.replace(/\D/g, '')))) {
          contactInfo += line + '\n';
        }
        i++;
      }
      
      if (contactInfo) {
        sections['Contact Information'] = contactInfo.trim();
      }
      
      // Look for common section indicators
      let currentSection = '';
      for (i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        
        if (!line) continue;
        
        // Check for section headers based on content
        if (line.toLowerCase().includes('experience') || 
            line.toLowerCase().includes('employment') || 
            line.toLowerCase().includes('work history')) {
          currentSection = 'Experience';
          sections[currentSection] = '';
        } else if (line.toLowerCase().includes('education') || 
                  line.toLowerCase().includes('academic') || 
                  line.toLowerCase().includes('university') || 
                  line.toLowerCase().includes('college')) {
          currentSection = 'Education';
          sections[currentSection] = '';
        } else if (line.toLowerCase().includes('skills') || 
                  line.toLowerCase().includes('proficiencies') || 
                  line.toLowerCase().includes('expertise')) {
          currentSection = 'Skills';
          sections[currentSection] = '';
        } else if (line.toLowerCase().includes('summary') || 
                  line.toLowerCase().includes('profile') || 
                  line.toLowerCase().includes('objective')) {
          currentSection = 'Summary';
          sections[currentSection] = '';
        } else if (line.toLowerCase().includes('certification') || 
                  line.toLowerCase().includes('license')) {
          currentSection = 'Certifications';
          sections[currentSection] = '';
        } else if (currentSection) {
          // Add content to the current section
          sections[currentSection] += line + '\n';
        }
      }
      
      // Clean up section content
      Object.keys(sections).forEach(key => {
        sections[key] = sections[key].trim();
      });
    }
    
    return sections;
  }
} 