import { StructuredCV } from "@/lib/types";

/**
 * Formats a structured CV into a readable text format
 */
export function formatStructuredCV(cv: StructuredCV): string {
  let formattedText = '';

  // Format header section
  if (cv.header.length > 0) {
    formattedText += cv.header.join('\n') + '\n\n';
  }

  // Format profile section
  if (cv.profile.length > 0) {
    formattedText += 'PROFILE\n';
    formattedText += '-------\n';
    formattedText += cv.profile.join('\n') + '\n\n';
  }

  // Format achievements section
  if (cv.achievements.length > 0) {
    formattedText += 'ACHIEVEMENTS\n';
    formattedText += '-----------\n';
    formattedText += cv.achievements.map(achievement => {
      // Ensure achievement starts with a bullet point
      if (!achievement.startsWith('•') && !achievement.startsWith('-') && !achievement.startsWith('*')) {
        return `• ${achievement}`;
      }
      return achievement;
    }).join('\n') + '\n\n';
  }

  // Format goals section
  if (cv.goals.length > 0) {
    formattedText += 'PROFESSIONAL GOALS\n';
    formattedText += '-----------------\n';
    formattedText += cv.goals.map(goal => {
      // Ensure goal starts with a bullet point
      if (!goal.startsWith('•') && !goal.startsWith('-') && !goal.startsWith('*')) {
        return `• ${goal}`;
      }
      return goal;
    }).join('\n') + '\n\n';
  }

  // Format skills section
  if (cv.skills.length > 0) {
    formattedText += 'SKILLS\n';
    formattedText += '------\n';
    formattedText += cv.skills.map(skill => {
      // Ensure skill starts with a bullet point
      if (!skill.startsWith('•') && !skill.startsWith('-') && !skill.startsWith('*')) {
        return `• ${skill}`;
      }
      return skill;
    }).join('\n') + '\n\n';
  }

  // Format languages section
  if (cv.languages.length > 0) {
    formattedText += 'LANGUAGES\n';
    formattedText += '---------\n';
    formattedText += cv.languages.map(language => {
      // Ensure language starts with a bullet point
      if (!language.startsWith('•') && !language.startsWith('-') && !language.startsWith('*')) {
        return `• ${language}`;
      }
      return language;
    }).join('\n') + '\n\n';
  }

  // Format education section
  if (cv.education.length > 0) {
    formattedText += 'EDUCATION\n';
    formattedText += '---------\n';
    formattedText += cv.education.map(education => {
      // Ensure education starts with a bullet point
      if (!education.startsWith('•') && !education.startsWith('-') && !education.startsWith('*')) {
        return `• ${education}`;
      }
      return education;
    }).join('\n') + '\n\n';
  }

  return formattedText.trim();
} 