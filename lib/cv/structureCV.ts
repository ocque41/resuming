import { StructuredCV } from "@/lib/types";

/**
 * Structures raw CV text into organized sections
 */
export async function structureCV(text: string): Promise<StructuredCV> {
  // Initialize the structure
  const structure: StructuredCV = {
    header: [],
    profile: [],
    achievements: [],
    goals: [],
    skills: [],
    languages: [],
    education: []
  };

  // Split text into lines and remove empty lines
  const lines = text.split('\n').filter(line => line.trim());

  // Current section being processed
  let currentSection: keyof StructuredCV = 'header';
  let headerComplete = false;

  // Process each line
  for (const line of lines) {
    const trimmedLine = line.trim();

    // Skip empty lines
    if (!trimmedLine) continue;

    // Detect section headers
    const lowerLine = trimmedLine.toLowerCase();
    if (lowerLine.includes('profile') || lowerLine.includes('summary') || lowerLine.includes('about')) {
      currentSection = 'profile';
      continue;
    } else if (lowerLine.includes('achievement') || lowerLine.includes('accomplishment')) {
      currentSection = 'achievements';
      continue;
    } else if (lowerLine.includes('goal') || lowerLine.includes('objective')) {
      currentSection = 'goals';
      continue;
    } else if (lowerLine.includes('skill') || lowerLine.includes('technical') || lowerLine.includes('expertise')) {
      currentSection = 'skills';
      continue;
    } else if (lowerLine.includes('language')) {
      currentSection = 'languages';
      continue;
    } else if (lowerLine.includes('education') || lowerLine.includes('academic')) {
      currentSection = 'education';
      continue;
    }

    // Process header section (first few lines until another section is found)
    if (currentSection === 'header' && !headerComplete) {
      structure.header.push(trimmedLine);
      // Consider header complete after 4 lines or if we hit another section
      if (structure.header.length >= 4) {
        headerComplete = true;
        currentSection = 'profile';
      }
      continue;
    }

    // Add line to current section
    structure[currentSection].push(trimmedLine);
  }

  // Clean up sections
  for (const section of Object.keys(structure) as Array<keyof StructuredCV>) {
    // Remove empty lines
    structure[section] = structure[section].filter(line => line.trim());

    // Ensure bullet points for certain sections
    if (['achievements', 'goals', 'skills', 'languages', 'education'].includes(section)) {
      structure[section] = structure[section].map(line => {
        // If line doesn't start with a bullet point or dash, add one
        if (!line.startsWith('•') && !line.startsWith('-') && !line.startsWith('*')) {
          return `• ${line}`;
        }
        return line;
      });
    }
  }

  return structure;
} 