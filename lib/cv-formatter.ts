// CV formatting utilities - consolidated from optimizeCV.ts

export interface FormattedSkillsResult {
  skills: string;
  languageSkills: string[];
}

// Function to extract a specific section from CV text based on various possible headings
export function extractSection(text: string, possibleHeadings: string[]): string {
  if (!text) return '';
  
  // Create a regex pattern to match any of the possible headings
  const headingPattern = possibleHeadings.map(heading => 
    heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') // Escape special regex characters
  ).join('|');
  
  // Create a regex to find the section and its content
  const sectionRegex = new RegExp(`(?:^|\\n)\\s*(${headingPattern})\\s*(?::|\\n)\\s*([\\s\\S]*?)(?=\\n\\s*(?:[A-Z][A-Za-z\\s]+)\\s*(?::|\\n)|$)`, 'i');
  
  // Try to match the section
  const match = text.match(sectionRegex);
  
  if (match && match[2]) {
    return match[2].trim();
  }
  
  // If no direct heading match, try to find content that might be relevant to this section
  for (const heading of possibleHeadings) {
    const lowerText = text.toLowerCase();
    const lowerHeading = heading.toLowerCase();
    
    if (lowerText.includes(lowerHeading)) {
      // Find the position of the heading
      const headingPos = lowerText.indexOf(lowerHeading);
      
      // Look for the next heading-like pattern (capitalized word followed by a colon or newline)
      const nextHeadingMatch = text.slice(headingPos).match(/\n\s*[A-Z][A-Za-z\s]+\s*(?::|\.|\n)/);
      
      if (nextHeadingMatch && nextHeadingMatch.index !== undefined) {
        const nextHeadingPos = nextHeadingMatch.index;
        // Extract the content between this heading and the next one
        return text.slice(headingPos + lowerHeading.length, headingPos + nextHeadingPos).trim();
      } else {
        // If there's no next heading, take the rest of the text
        return text.slice(headingPos + lowerHeading.length).trim();
      }
    }
  }
  
  return '';
}

// Function to format Profile section
export function formatProfile(profileText: string): string {
  if (!profileText) return '';
  
  // Ensure profile is clean and consistent
  let cleanedProfile = profileText
    .replace(/\s+/g, ' ')
    .replace(/profile:?\s*/i, '')
    .trim();
  
  // Make sure it starts with a capital letter
  if (cleanedProfile && cleanedProfile.length > 0) {
    cleanedProfile = cleanedProfile.charAt(0).toUpperCase() + cleanedProfile.slice(1);
  }
  
  // Make sure it ends with proper punctuation
  if (cleanedProfile && !cleanedProfile.endsWith('.') && !cleanedProfile.endsWith('!') && !cleanedProfile.endsWith('?')) {
    cleanedProfile += '.';
  }
  
  return cleanedProfile;
}

// Function to format Career Goal
export function formatCareerGoal(goalText: string): string {
  if (!goalText) return '';
  
  // Clean up the text
  let cleanedGoal = goalText
    .replace(/\s+/g, ' ')
    .replace(/career goals?:?\s*/i, '')
    .trim();
  
  // Make sure it starts with a capital letter
  if (cleanedGoal && cleanedGoal.length > 0) {
    cleanedGoal = cleanedGoal.charAt(0).toUpperCase() + cleanedGoal.slice(1);
  }
  
  // Make sure it ends with proper punctuation
  if (cleanedGoal && !cleanedGoal.endsWith('.') && !cleanedGoal.endsWith('!') && !cleanedGoal.endsWith('?')) {
    cleanedGoal += '.';
  }
  
  return cleanedGoal;
}

// Function to format Achievements section with bullet points
export function formatAchievements(achievementsText: string): string {
  if (!achievementsText) return '';
  
  // Clean the achievements text
  const cleanedText = achievementsText
    .replace(/achievements:?\s*/i, '')
    .trim();
  
  // Split achievements by new lines or bullet points
  const achievements = cleanedText.split(/(?:\r?\n|\r|•|\*|-)/).filter(a => a.trim().length > 0);
  
  if (achievements.length === 0) {
    return '';
  }
  
  // Format each achievement
  return achievements.map(achievement => {
    // Clean up the achievement text
    let cleanedAchievement = achievement.trim();
    
    // Make sure it starts with a capital letter
    if (cleanedAchievement && cleanedAchievement.length > 0) {
      cleanedAchievement = cleanedAchievement.charAt(0).toUpperCase() + cleanedAchievement.slice(1);
    }
    
    // Make sure it ends with proper punctuation
    if (cleanedAchievement && !cleanedAchievement.endsWith('.') && !cleanedAchievement.endsWith('!') && !cleanedAchievement.endsWith('?')) {
      cleanedAchievement += '.';
    }
    
    return `• ${cleanedAchievement}`;
  }).join('\n');
}

// Function to format Skills with bullet points and categories
export function formatSkills(skillsText: string): FormattedSkillsResult {
  if (!skillsText) return { skills: '', languageSkills: [] };
  
  // Clean the skills text
  const cleanedText = skillsText
    .replace(/skills:?\s*/i, '')
    .trim();
  
  // Split skills by new lines or bullet points
  let skillItems = cleanedText.split(/(?:\r?\n|\r|•|\*|-)/).filter(s => s.trim().length > 0);
  
  if (skillItems.length === 0) {
    return { skills: '', languageSkills: [] };
  }
  
  // Try to categorize skills
  const technicalSkills: string[] = [];
  const softSkills: string[] = [];
  const languageSkills: string[] = [];
  const otherSkills: string[] = [];
  
  // Common soft skills keywords
  const softSkillKeywords = [
    'communication', 'teamwork', 'leadership', 'problem-solving', 'critical thinking',
    'time management', 'adaptability', 'creativity', 'interpersonal', 'collaboration',
    'emotional intelligence', 'negotiation', 'conflict resolution', 'decision making',
    'flexibility', 'resilience', 'work ethic', 'attention to detail', 'customer service'
  ];
  
  // Common technical skills keywords
  const technicalSkillKeywords = [
    'programming', 'software', 'hardware', 'coding', 'development', 'database', 'analysis',
    'engineering', 'architecture', 'design', 'testing', 'automation', 'framework', 'methodology',
    'algorithm', 'protocol', 'network', 'infrastructure', 'security', 'backend', 'frontend',
    'full-stack', 'devops', 'cloud', 'web', 'mobile', 'api'
  ];
  
  // Common language keywords
  const languageKeywords = [
    'language', 'fluent', 'native', 'proficient', 'intermediate', 'beginner', 'spoken', 'written',
    'english', 'spanish', 'french', 'german', 'chinese', 'japanese', 'italian', 'portuguese',
    'russian', 'arabic', 'hindi', 'korean', 'dutch', 'swedish', 'norwegian', 'danish', 'finnish',
    'greek', 'turkish', 'polish', 'czech', 'hungarian', 'romanian', 'bulgarian', 'serbian',
    'croatian', 'slovak', 'slovenian', 'ukrainian', 'hebrew', 'thai', 'vietnamese', 'malay',
    'indonesian', 'tagalog', 'filipino', 'bengali', 'urdu', 'farsi', 'persian', 'swahili'
  ];
  
  // Categorize each skill
  skillItems.forEach(skill => {
    const lowerSkill = skill.toLowerCase();
    
    if (softSkillKeywords.some(keyword => lowerSkill.includes(keyword))) {
      softSkills.push(skill.trim());
    } else if (technicalSkillKeywords.some(keyword => lowerSkill.includes(keyword))) {
      technicalSkills.push(skill.trim());
    } else if (languageKeywords.some(keyword => lowerSkill.includes(keyword))) {
      languageSkills.push(skill.trim());
    } else {
      otherSkills.push(skill.trim());
    }
  });
  
  // Format the final output
  let formattedSkills = '';
  
  // Add technical skills if present
  if (technicalSkills.length > 0) {
    formattedSkills += 'Technical Skills:\n';
    formattedSkills += technicalSkills.map(skill => `• ${skill}`).join('\n');
    formattedSkills += '\n\n';
  }
  
  // Add soft skills if present
  if (softSkills.length > 0) {
    formattedSkills += 'Soft Skills:\n';
    formattedSkills += softSkills.map(skill => `• ${skill}`).join('\n');
    formattedSkills += '\n\n';
  }
  
  // Add other skills if present
  if (otherSkills.length > 0) {
    if (!technicalSkills.length && !softSkills.length) {
      formattedSkills += 'Skills:\n';
    } else {
      formattedSkills += 'Other Skills:\n';
    }
    formattedSkills += otherSkills.map(skill => `• ${skill}`).join('\n');
  }
  
  return {
    skills: formattedSkills.trim(),
    languageSkills: languageSkills
  };
}

// Function to format Work Experience with structured entries
export function formatWorkExperience(experienceText: string): string {
  if (!experienceText) return '';
  
  // Clean the experience text
  const cleanedText = experienceText
    .replace(/work experience:?\s*/i, '')
    .trim();
  
  // Look for experience entries - typically they start with dates, company names, or job titles
  const experienceRegex = /(?:\d{1,2}\/\d{1,2}\/\d{2,4}|\d{1,2}\/\d{2,4}|\d{2,4}|\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{2,4})\s*(?:-|to|–|—)\s*(?:\d{1,2}\/\d{1,2}\/\d{2,4}|\d{1,2}\/\d{2,4}|\d{2,4}|\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{2,4}|Present|Current|Now)\s*:?\s*(.*?)(?=(?:\d{1,2}\/\d{1,2}\/\d{2,4}|\d{1,2}\/\d{2,4}|\d{2,4}|\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{2,4})\s*(?:-|to|–|—)|$)/gis;
  
  // Alternative regex for company/role-based format
  const companyRegex = /(?:^|\n)([A-Z][A-Za-z0-9\s&.,'-]+)(?:\s*[-–|]\s*|\n)([A-Za-z][A-Za-z0-9\s&.,'-]+)(?:\s*[-–|]\s*|\n)(.*?)(?=(?:^|\n)[A-Z][A-Za-z0-9\s&.,'-]+(?:\s*[-–|]\s*|\n)|$)/gs;
  
  let matches = Array.from(cleanedText.matchAll(experienceRegex));
  
  // If we couldn't find date-based entries, try company-based entries
  if (matches.length === 0) {
    matches = Array.from(cleanedText.matchAll(companyRegex));
  }
  
  // If we still have no matches, try splitting by double line breaks
  if (matches.length === 0) {
    const entries = cleanedText.split(/\n\s*\n/).filter(entry => entry.trim().length > 0);
    return entries.join('\n\n');
  }
  
  // Format each experience entry
  return matches.map(match => {
    // Clean up the experience entry
    const experienceEntry = match[0].trim();
    
    // Split into lines
    const lines = experienceEntry.split(/\r?\n/).filter(line => line.trim().length > 0);
    
    if (lines.length === 0) {
      return '';
    }
    
    // Format the position/company line
    let formattedEntry = lines[0] + '\n';
    
    // Add responsibilities/achievements
    const remainingLines = lines.slice(1);
    if (remainingLines.length > 0) {
      formattedEntry += remainingLines.map(line => {
        // Check if it already has a bullet point
        if (line.trim().startsWith('•') || line.trim().startsWith('-') || line.trim().startsWith('*')) {
          return line.trim();
        } else {
          return `• ${line.trim()}`;
        }
      }).join('\n');
    }
    
    return formattedEntry;
  }).join('\n\n');
}

// Function to format Education with structured entries
export function formatEducation(educationText: string): string {
  if (!educationText) return '';
  
  // Clean the education text
  const cleanedText = educationText
    .replace(/education:?\s*/i, '')
    .trim();
  
  // Split education entries by new lines
  const entries = cleanedText.split(/\r?\n\s*\r?\n/).filter(entry => entry.trim().length > 0);
  
  if (entries.length === 0) {
    return '';
  }
  
  // Format each education entry
  return entries.map(entry => {
    // Clean up the entry
    const cleanedEntry = entry.trim();
    
    // Split into lines
    const lines = cleanedEntry.split(/\r?\n/).filter(line => line.trim().length > 0);
    
    if (lines.length === 0) {
      return '';
    }
    
    // Format the degree/institution line
    let formattedEntry = lines[0] + '\n';
    
    // Add additional details
    const remainingLines = lines.slice(1);
    if (remainingLines.length > 0) {
      formattedEntry += remainingLines.map(line => {
        // Check if it already has a bullet point
        if (line.trim().startsWith('•') || line.trim().startsWith('-') || line.trim().startsWith('*')) {
          return line.trim();
        } else {
          return `• ${line.trim()}`;
        }
      }).join('\n');
    }
    
    return formattedEntry;
  }).join('\n\n');
}

// Function to format Languages section
export function formatLanguages(languagesText: string, skillsText?: string): string {
  if (!languagesText && !skillsText) return '';
  
  // Extract languages from the languages section
  let languages: string[] = [];
  if (languagesText) {
    const cleanedText = languagesText
      .replace(/languages:?\s*/i, '')
      .trim();
    
    // Split languages by new lines or bullet points
    languages = cleanedText.split(/(?:\r?\n|\r|•|\*|-)/).filter(l => l.trim().length > 0);
  }
  
  // Extract languages from the skills section if we have it
  if (skillsText) {
    const cleanedText = skillsText
      .replace(/skills:?\s*/i, '')
      .trim();
    
    // Common language keywords
    const languageKeywords = [
      'language', 'fluent', 'native', 'proficient', 'intermediate', 'beginner', 'spoken', 'written',
      'english', 'spanish', 'french', 'german', 'chinese', 'japanese', 'italian', 'portuguese',
      'russian', 'arabic', 'hindi', 'korean', 'dutch', 'swedish', 'norwegian', 'danish', 'finnish',
      'greek', 'turkish', 'polish', 'czech', 'hungarian', 'romanian', 'bulgarian', 'serbian',
      'croatian', 'slovak', 'slovenian', 'ukrainian', 'hebrew', 'thai', 'vietnamese', 'malay',
      'indonesian', 'tagalog', 'filipino', 'bengali', 'urdu', 'farsi', 'persian', 'swahili'
    ];
    
    // Split skills by new lines or bullet points
    const skillItems = cleanedText.split(/(?:\r?\n|\r|•|\*|-)/).filter(s => s.trim().length > 0);
    
    // Extract language-related skills
    const languageSkills = skillItems.filter(skill => {
      const lowerSkill = skill.toLowerCase();
      return languageKeywords.some(keyword => lowerSkill.includes(keyword));
    }).map(skill => skill.trim());
    
    // Add them to our languages array if they're not already there
    languageSkills.forEach(skill => {
      if (!languages.some(lang => lang.toLowerCase().includes(skill.toLowerCase()))) {
        languages.push(skill);
      }
    });
  }
  
  if (languages.length === 0) {
    return '';
  }
  
  // Format the languages
  return languages.map(language => {
    // Clean up
    let cleanedLanguage = language.trim();
    
    // Make sure it starts with a capital letter
    if (cleanedLanguage && cleanedLanguage.length > 0) {
      cleanedLanguage = cleanedLanguage.charAt(0).toUpperCase() + cleanedLanguage.slice(1);
    }
    
    return `• ${cleanedLanguage}`;
  }).join('\n');
}

// Function to standardize CV text into a consistent structure
export function standardizeCV(cvText: string): string {
  if (!cvText) return '';
  
  // Extract sections from the text
  const profileSection = extractSection(cvText, ['profile', 'about me', 'summary']);
  const careerGoalSection = extractSection(cvText, ['career goal', 'objective', 'professional goal']);
  const achievementsSection = extractSection(cvText, ['achievements', 'accomplishments', 'key achievements']);
  const skillsSection = extractSection(cvText, ['skills', 'competencies', 'expertise', 'qualifications']);
  const workExperienceSection = extractSection(cvText, ['work experience', 'professional experience', 'employment history', 'experience']);
  const educationSection = extractSection(cvText, ['education', 'academic background', 'qualifications', 'training']);
  const languagesSection = extractSection(cvText, ['languages', 'language skills', 'linguistic proficiency']);
  
  // Format each section
  const formattedProfile = formatProfile(profileSection);
  const formattedCareerGoal = formatCareerGoal(careerGoalSection);
  const formattedAchievements = formatAchievements(achievementsSection);
  
  // Handle the skills section, which now returns an object with skills and languageSkills
  const formattedSkillsResult = formatSkills(skillsSection);
  const formattedSkills = formattedSkillsResult.skills;
  const skillsLanguages = formattedSkillsResult.languageSkills;
  
  const formattedWorkExperience = formatWorkExperience(workExperienceSection);
  const formattedEducation = formatEducation(educationSection);
  
  // For languages, combine any language skills found in the skills section with the dedicated languages section
  const formattedLanguages = formatLanguages(
    languagesSection,
    skillsLanguages.length > 0 ? skillsLanguages.join('\n') : undefined
  );
  
  // Construct the standardized CV with section headings
  let standardizedCV = '';
  
  // Add Profile section
  if (formattedProfile) {
    standardizedCV += 'PROFILE\n';
    standardizedCV += formattedProfile;
    standardizedCV += '\n\n';
  } else {
    standardizedCV += 'PROFILE\n';
    standardizedCV += 'Experienced professional with a proven track record of success and a passion for delivering results.';
    standardizedCV += '\n\n';
  }
  
  // Add Career Goal section
  if (formattedCareerGoal) {
    standardizedCV += 'CAREER GOAL\n';
    standardizedCV += formattedCareerGoal;
    standardizedCV += '\n\n';
  } else {
    standardizedCV += 'CAREER GOAL\n';
    standardizedCV += 'To leverage my skills and experience in a challenging role that offers opportunities for professional growth and development.';
    standardizedCV += '\n\n';
  }
  
  // Add Achievements section
  if (formattedAchievements) {
    standardizedCV += 'ACHIEVEMENTS\n';
    standardizedCV += formattedAchievements;
    standardizedCV += '\n\n';
  } else {
    standardizedCV += 'ACHIEVEMENTS\n';
    standardizedCV += '• Successfully completed multiple projects ahead of schedule and under budget.\n';
    standardizedCV += '• Received recognition for outstanding performance and contributions to team success.\n';
    standardizedCV += '• Implemented innovative solutions that improved efficiency and productivity.';
    standardizedCV += '\n\n';
  }
  
  // Add Skills section
  if (formattedSkills) {
    standardizedCV += 'SKILLS\n';
    standardizedCV += formattedSkills;
    standardizedCV += '\n\n';
  } else {
    standardizedCV += 'SKILLS\n';
    standardizedCV += 'Technical Skills:\n';
    standardizedCV += '• Proficient in industry-standard software and tools\n';
    standardizedCV += '• Strong analytical and problem-solving abilities\n\n';
    standardizedCV += 'Soft Skills:\n';
    standardizedCV += '• Excellent communication and interpersonal skills\n';
    standardizedCV += '• Team leadership and collaboration';
    standardizedCV += '\n\n';
  }
  
  // Add Work Experience section
  if (formattedWorkExperience) {
    standardizedCV += 'WORK EXPERIENCE\n';
    standardizedCV += formattedWorkExperience;
    standardizedCV += '\n\n';
  } else {
    standardizedCV += 'WORK EXPERIENCE\n';
    standardizedCV += 'Company Name | Position Title | Month Year - Present\n';
    standardizedCV += '• Responsible for key projects and initiatives\n';
    standardizedCV += '• Collaborated with cross-functional teams to achieve objectives\n';
    standardizedCV += '• Contributed to process improvements and best practices';
    standardizedCV += '\n\n';
  }
  
  // Add Education section
  if (formattedEducation) {
    standardizedCV += 'EDUCATION\n';
    standardizedCV += formattedEducation;
    standardizedCV += '\n\n';
  } else {
    standardizedCV += 'EDUCATION\n';
    standardizedCV += 'University Name | Degree Program | Year - Year\n';
    standardizedCV += '• Graduated with honors\n';
    standardizedCV += '• Relevant coursework in key areas of study';
    standardizedCV += '\n\n';
  }
  
  // Add Languages section
  if (formattedLanguages) {
    standardizedCV += 'LANGUAGES\n';
    standardizedCV += formattedLanguages;
  } else {
    standardizedCV += 'LANGUAGES\n';
    standardizedCV += '• English - Fluent\n';
    standardizedCV += '• Additional languages as applicable';
  }
  
  return standardizedCV;
} 