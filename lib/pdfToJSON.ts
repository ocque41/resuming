import * as pdfjsLib from 'pdfjs-dist';
import { TextItem } from 'pdfjs-dist/types/src/display/api';
import { extractSections, analyzeCVContent } from './optimizeCV';

/**
 * Extract text from a PDF buffer
 */
export async function extractTextFromPDF(pdfBuffer: Buffer): Promise<string> {
  try {
    // Load PDF.js (with worker)
    const loadingTask = pdfjsLib.getDocument({ data: pdfBuffer });
    const pdf = await loadingTask.promise;
    
    console.log(`PDF loaded with ${pdf.numPages} pages`);
    
    let allText = '';
    
    // Extract text from each page
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      
      // Extract and join text items
      const pageText = content.items
        .filter((item): item is TextItem => 'str' in item)
        .map(item => item.str)
        .join(' ');
      
      allText += pageText + '\n\n';
    }
    
    return allText;
  } catch (error) {
    console.error('Error extracting text from PDF:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to extract text from PDF: ${errorMessage}`);
  }
}

/**
 * Extract structured CV data from a PDF buffer
 */
export async function extractStructuredDataFromPDF(pdfBuffer: Buffer): Promise<Record<string, any>> {
  // Extract raw text from PDF
  const extractedText = await extractTextFromPDF(pdfBuffer);
  
  // Extract sections from the text
  const sections = extractSections(extractedText);
  
  // Analyze content to identify strengths, weaknesses, etc.
  const analysis = analyzeCVContent(extractedText);
  
  // Extract name and contact info
  const nameAndContact = extractNameAndContact(extractedText, sections);
  
  return {
    sections,
    analysis,
    nameAndContact,
    originalText: extractedText
  };
}

/**
 * Extract name and contact information
 */
function extractNameAndContact(text: string, sections: Record<string, string>): {
  firstName: string;
  lastName: string;
  jobTitle: string;
  phone: string;
  email: string;
  location: string;
} {
  // Default values
  let result = {
    firstName: 'NAME',
    lastName: 'LAST NAME',
    jobTitle: 'JOB OCCUPIED',
    phone: '',
    email: '',
    location: ''
  };
  
  // Try to extract from contact section if available
  if (sections.contact) {
    const contactLines = sections.contact.split('\n');
    
    // First line is often the name
    if (contactLines.length > 0) {
      const nameParts = contactLines[0].split(' ');
      if (nameParts.length >= 2) {
        result.firstName = nameParts[0];
        result.lastName = nameParts.slice(1).join(' ');
      }
    }
    
    // Look for email, phone, and location in contact section
    for (const line of contactLines) {
      if (line.includes('@')) {
        result.email = line.trim();
      } else if (line.match(/\+?[\d\s-]{7,}/)) {
        result.phone = line.trim();
      } else if (line.match(/[A-Za-z]+,\s*[A-Za-z]+/) || 
                 line.includes('USA') || 
                 line.includes('UK')) {
        result.location = line.trim();
      } else if (line.match(/director|manager|engineer|developer|designer|consultant|specialist|analyst|coordinator/i) && !result.jobTitle) {
        result.jobTitle = line.trim();
      }
    }
  }
  
  // Try to extract job title from profile if not found
  if (result.jobTitle === 'JOB OCCUPIED' && sections.profile) {
    const profileLines = sections.profile.split('\n');
    for (const line of profileLines.slice(0, 3)) { // Check first few lines
      if (line.match(/director|manager|engineer|developer|designer|consultant|specialist|analyst|coordinator/i)) {
        result.jobTitle = line.trim();
        break;
      }
    }
  }
  
  return result;
} 