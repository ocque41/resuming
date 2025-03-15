/**
 * Helper functions for CV processing
 */

/**
 * Extract the EDUCATION section from the CV
 */
export const extractEducationSection = (cvText: string): string | null => {
  const educationRegex = /(?:^|\n)(?:EDUCATION|ACADEMIC|QUALIFICATIONS|ACADEMIC QUALIFICATIONS|EDUCATIONAL BACKGROUND|DEGREES?)(?:[:.\-]|\s*\n)([\s\S]*?)(?=\n(?:EXPERIENCE|WORK|EMPLOYMENT|PROFESSIONAL EXPERIENCE|CAREER|WORK HISTORY|JOB HISTORY|SKILLS|LANGUAGES|ACHIEVEMENTS|GOALS|REFERENCES|CONTACT|$))/i;
  const match = cvText.match(educationRegex);
  return match ? match[1].trim() : null;
};

/**
 * Extract the EXPERIENCE section from the CV
 */
export const extractExperienceSection = (cvText: string): string | null => {
  const experienceRegex = /(?:^|\n)(?:EXPERIENCE|WORK|EMPLOYMENT|PROFESSIONAL EXPERIENCE|CAREER|WORK HISTORY|JOB HISTORY)(?:[:.\-]|\s*\n)([\s\S]*?)(?=\n(?:EDUCATION|ACADEMIC|QUALIFICATIONS|SKILLS|LANGUAGES|ACHIEVEMENTS|GOALS|REFERENCES|CONTACT|$))/i;
  const match = cvText.match(experienceRegex);
  return match ? match[1].trim() : null;
};

/**
 * Extract the LANGUAGES section from the CV
 */
export const extractLanguagesSection = (cvText: string): string | null => {
  const languagesRegex = /(?:^|\n)(?:LANGUAGES?|LANGUAGE PROFICIENCY|LANGUAGE SKILLS|SPOKEN LANGUAGES?)(?:[:.\-]|\s*\n)([\s\S]*?)(?=\n(?:EDUCATION|EXPERIENCE|WORK|EMPLOYMENT|SKILLS|ACHIEVEMENTS|GOALS|REFERENCES|CONTACT|$))/i;
  const match = cvText.match(languagesRegex);
  return match ? match[1].trim() : null;
};

/**
 * Insert a section into the optimized content
 */
export const insertSectionInOptimizedContent = (optimizedContent: string, sectionName: string, sectionContent: string): string => {
  // Determine where to insert the section
  // Common section order: PROFILE, SKILLS, EXPERIENCE, EDUCATION, LANGUAGES, ACHIEVEMENTS, GOALS, REFERENCES
  const sectionOrder = ['PROFILE', 'SKILLS', 'EXPERIENCE', 'EDUCATION', 'LANGUAGES', 'ACHIEVEMENTS', 'GOALS', 'REFERENCES'];
  const sectionIndex = sectionOrder.indexOf(sectionName);
  
  if (sectionIndex === -1) {
    // If section is not in our standard order, append it at the end
    return `${optimizedContent.trim()}\n\n${sectionName}:\n${sectionContent}`;
  }
  
  // Try to find the section that should come after this one
  let insertAfterSection = null;
  for (let i = sectionIndex - 1; i >= 0; i--) {
    const prevSection = sectionOrder[i];
    if (new RegExp(`\\b${prevSection}\\b`, 'i').test(optimizedContent)) {
      insertAfterSection = prevSection;
      break;
    }
  }
  
  // If we found a section to insert after
  if (insertAfterSection) {
    const regex = new RegExp(`(\\b${insertAfterSection}[:\\s\\S]*?)(\\n\\n|$)`, 'i');
    const match = optimizedContent.match(regex);
    if (match && match.index !== undefined) {
      const insertPosition = match.index + match[0].length;
      return optimizedContent.substring(0, insertPosition) + 
             `\n\n${sectionName}:\n${sectionContent}` + 
             optimizedContent.substring(insertPosition);
    }
  }
  
  // If we couldn't find a good insertion point, just append it
  return `${optimizedContent.trim()}\n\n${sectionName}:\n${sectionContent}`;
};

/**
 * Utility function for retry with exponential backoff
 */
export const fetchWithRetry = async (url: string, options: RequestInit, maxRetries = 3, initialDelay = 2000) => {
  let retries = 0;
  let delay = initialDelay;
  
  while (retries <= maxRetries) {
    try {
      const response = await fetch(url, options);
      
      // If the response is a 429 (rate limit) or 5xx (server error), retry
      if (response.status === 429 || (response.status >= 500 && response.status < 600)) {
        // If we've reached max retries, throw the error
        if (retries === maxRetries) {
          throw new Error(`Request failed with status ${response.status} after ${maxRetries} retries`);
        }
        
        // Increment retry count and wait before trying again
        retries++;
        console.log(`Retry ${retries}/${maxRetries} after ${delay}ms delay (status: ${response.status})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        
        // Exponential backoff with jitter
        delay = Math.min(delay * 1.5, 30000) * (0.9 + Math.random() * 0.2);
        continue;
      }
      
      return response;
    } catch (error) {
      // If it's a network error or timeout, retry
      if (error instanceof Error && 
          (error.name === 'AbortError' || error.message.includes('network') || error.message.includes('fetch'))) {
        // If we've reached max retries, throw the error
        if (retries === maxRetries) {
          throw error;
        }
        
        // Increment retry count and wait before trying again
        retries++;
        console.log(`Retry ${retries}/${maxRetries} after ${delay}ms delay (error: ${error.message})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        
        // Exponential backoff with jitter
        delay = Math.min(delay * 1.5, 30000) * (0.9 + Math.random() * 0.2);
        continue;
      }
      
      // For other errors, throw immediately
      throw error;
    }
  }
  
  throw new Error(`Request failed after ${maxRetries} retries`);
}; 