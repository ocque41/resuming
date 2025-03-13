// Common keywords in various fields
const commonKeywords = [
  // Management and Leadership
  'management', 'leadership', 'team', 'strategy', 'planning', 'coordination',
  'supervision', 'direction', 'organization', 'mentoring',

  // Development and Technical
  'development', 'programming', 'software', 'engineering', 'architecture',
  'design', 'implementation', 'testing', 'deployment', 'maintenance',

  // Project Management
  'project', 'agile', 'scrum', 'waterfall', 'sprint', 'milestone',
  'deadline', 'budget', 'resource', 'stakeholder',

  // Business and Operations
  'business', 'operations', 'process', 'optimization', 'efficiency',
  'productivity', 'analysis', 'reporting', 'metrics', 'kpi',

  // Communication and Collaboration
  'communication', 'collaboration', 'presentation', 'negotiation',
  'facilitation', 'coordination', 'teamwork', 'partnership',

  // Technical Skills
  'javascript', 'typescript', 'python', 'java', 'c++', 'react',
  'angular', 'vue', 'node', 'express', 'django', 'spring',
  'aws', 'azure', 'gcp', 'docker', 'kubernetes', 'ci/cd',

  // Data and Analytics
  'data', 'analytics', 'visualization', 'reporting', 'sql',
  'database', 'machine learning', 'ai', 'statistics', 'metrics',

  // Soft Skills
  'problem solving', 'critical thinking', 'innovation', 'creativity',
  'adaptability', 'flexibility', 'initiative', 'motivation',

  // Industry-specific
  'healthcare', 'finance', 'retail', 'education', 'manufacturing',
  'technology', 'consulting', 'marketing', 'sales', 'research'
];

/**
 * Extracts keywords from text by matching against common keywords
 * and identifying potential new keywords based on patterns
 */
export function extractKeywords(text: string): string[] {
  const normalizedText = text.toLowerCase();
  const words = normalizedText.split(/\s+/);
  
  // Find matches with common keywords
  const matches = new Set<string>();
  
  // Check for single word matches
  commonKeywords.forEach(keyword => {
    if (normalizedText.includes(keyword.toLowerCase())) {
      matches.add(keyword);
    }
  });
  
  // Check for phrases (2-3 words)
  for (let i = 0; i < words.length - 1; i++) {
    const twoWordPhrase = words[i] + ' ' + words[i + 1];
    if (commonKeywords.some(k => k.toLowerCase() === twoWordPhrase)) {
      matches.add(twoWordPhrase);
    }
    
    if (i < words.length - 2) {
      const threeWordPhrase = twoWordPhrase + ' ' + words[i + 2];
      if (commonKeywords.some(k => k.toLowerCase() === threeWordPhrase)) {
        matches.add(threeWordPhrase);
      }
    }
  }
  
  // Identify potential new keywords (capitalized words that aren't common words)
  const commonWords = new Set(['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'with', 'by']);
  const originalWords = text.split(/\s+/);
  
  originalWords.forEach(word => {
    if (
      word.length > 2 && // Ignore short words
      /^[A-Z]/.test(word) && // Starts with capital letter
      !commonWords.has(word.toLowerCase()) && // Not a common word
      !matches.has(word.toLowerCase()) // Not already matched
    ) {
      matches.add(word);
    }
  });
  
  return Array.from(matches);
} 