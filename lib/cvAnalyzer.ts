/**
 * CV Analyzer
 * 
 * This module provides functions to analyze CVs and calculate ATS scores
 * based on industry standards and best practices.
 */

import { cvLogger } from './logger';

// Define industry-specific keywords
const INDUSTRY_KEYWORDS: Record<string, string[]> = {
  'Technology': [
    'software', 'development', 'programming', 'javascript', 'python', 'java', 'react', 'angular', 'vue', 
    'node.js', 'aws', 'azure', 'cloud', 'devops', 'ci/cd', 'agile', 'scrum', 'git', 'github', 'api',
    'microservices', 'docker', 'kubernetes', 'machine learning', 'ai', 'data science', 'big data',
    'full stack', 'frontend', 'backend', 'database', 'sql', 'nosql', 'mongodb', 'postgresql'
  ],
  'Finance': [
    'financial analysis', 'accounting', 'budgeting', 'forecasting', 'investment', 'portfolio', 'risk management',
    'financial reporting', 'audit', 'compliance', 'banking', 'securities', 'trading', 'equity', 'debt',
    'capital markets', 'financial modeling', 'valuation', 'mergers', 'acquisitions', 'excel', 'bloomberg',
    'financial statements', 'balance sheet', 'income statement', 'cash flow', 'roi', 'npv', 'irr'
  ],
  'Healthcare': [
    'patient care', 'clinical', 'medical', 'healthcare', 'hospital', 'physician', 'nursing', 'treatment',
    'diagnosis', 'therapy', 'pharmaceutical', 'health records', 'hipaa', 'electronic medical records',
    'patient management', 'medical coding', 'medical billing', 'healthcare compliance', 'clinical trials',
    'medical research', 'public health', 'epidemiology', 'patient safety', 'quality improvement'
  ],
  'Marketing': [
    'marketing strategy', 'digital marketing', 'social media', 'content marketing', 'seo', 'sem', 'ppc',
    'google analytics', 'facebook ads', 'instagram', 'twitter', 'linkedin', 'brand management', 'market research',
    'customer acquisition', 'customer retention', 'email marketing', 'marketing automation', 'crm',
    'conversion rate', 'a/b testing', 'marketing campaigns', 'marketing analytics', 'marketing roi'
  ],
  'Sales': [
    'sales strategy', 'business development', 'account management', 'client relationship', 'negotiation',
    'closing deals', 'sales pipeline', 'lead generation', 'prospecting', 'cold calling', 'sales targets',
    'revenue growth', 'customer acquisition', 'sales forecasting', 'crm', 'salesforce', 'hubspot',
    'sales presentations', 'consultative selling', 'solution selling', 'territory management'
  ],
  'Human Resources': [
    'recruitment', 'talent acquisition', 'hiring', 'onboarding', 'employee relations', 'performance management',
    'compensation', 'benefits', 'hr policies', 'employee engagement', 'workforce planning', 'succession planning',
    'training', 'development', 'hr compliance', 'labor laws', 'diversity', 'inclusion', 'hris',
    'employee retention', 'organizational development', 'change management', 'hr analytics'
  ],
  'Operations': [
    'operations management', 'process improvement', 'supply chain', 'logistics', 'inventory management',
    'quality control', 'lean', 'six sigma', 'project management', 'resource allocation', 'vendor management',
    'procurement', 'cost reduction', 'efficiency', 'productivity', 'kpis', 'metrics', 'continuous improvement',
    'business process', 'operational excellence', 'erp', 'sap', 'oracle'
  ],
  'Legal': [
    'legal counsel', 'contracts', 'compliance', 'regulatory', 'litigation', 'legal research', 'legal writing',
    'negotiation', 'intellectual property', 'patents', 'trademarks', 'copyrights', 'corporate law',
    'employment law', 'legal risk', 'legal strategy', 'legal advice', 'legal documents', 'legal analysis',
    'case management', 'legal proceedings', 'legal compliance', 'legal framework'
  ],
  'Education': [
    'teaching', 'curriculum development', 'instructional design', 'assessment', 'educational technology',
    'classroom management', 'student engagement', 'learning outcomes', 'pedagogy', 'e-learning',
    'student success', 'academic advising', 'educational leadership', 'student services', 'higher education',
    'k-12', 'special education', 'educational research', 'student assessment', 'educational policy'
  ],
  'Construction': [
    'project management', 'construction management', 'building', 'architecture', 'engineering', 'site supervision',
    'safety compliance', 'building codes', 'blueprints', 'cad', 'estimating', 'bidding', 'subcontractors',
    'construction scheduling', 'quality control', 'budget management', 'construction materials',
    'construction equipment', 'osha compliance', 'building inspection', 'construction documentation'
  ]
};

// Define common action verbs that indicate achievements
const ACTION_VERBS = [
  'achieved', 'improved', 'increased', 'reduced', 'developed', 'implemented', 'created', 'managed', 'led',
  'designed', 'launched', 'delivered', 'generated', 'negotiated', 'secured', 'streamlined', 'optimized',
  'transformed', 'established', 'executed', 'coordinated', 'spearheaded', 'pioneered', 'orchestrated',
  'overhauled', 'revitalized', 'cultivated', 'formulated', 'directed', 'championed', 'built', 'founded',
  'initiated', 'introduced', 'modernized', 'reorganized', 'restructured', 'strengthened', 'supervised'
];

// Define common technical terms
const TECHNICAL_TERMS = [
  'software', 'hardware', 'programming', 'development', 'engineering', 'architecture', 'infrastructure',
  'network', 'database', 'security', 'cloud', 'api', 'framework', 'library', 'platform', 'system',
  'application', 'interface', 'integration', 'deployment', 'implementation', 'testing', 'quality assurance',
  'version control', 'agile', 'scrum', 'kanban', 'waterfall', 'lean', 'six sigma', 'analytics', 'data',
  'algorithm', 'automation', 'artificial intelligence', 'machine learning', 'deep learning', 'neural network',
  'blockchain', 'cryptocurrency', 'virtual reality', 'augmented reality', 'internet of things', 'cybersecurity'
];

// Define soft skills that are valued across industries
const SOFT_SKILLS = [
  'communication', 'teamwork', 'leadership', 'problem solving', 'critical thinking', 'decision making',
  'time management', 'organization', 'adaptability', 'flexibility', 'creativity', 'innovation',
  'interpersonal skills', 'emotional intelligence', 'conflict resolution', 'negotiation', 'persuasion',
  'presentation', 'public speaking', 'writing', 'customer service', 'client relations', 'collaboration',
  'mentoring', 'coaching', 'training', 'strategic thinking', 'analytical skills', 'attention to detail'
];

// Define ATS-friendly section headers
const ATS_SECTION_HEADERS = [
  'summary', 'profile', 'objective', 'experience', 'work experience', 'employment history',
  'education', 'skills', 'technical skills', 'competencies', 'certifications', 'achievements',
  'projects', 'publications', 'languages', 'interests', 'references', 'professional development'
];

// Define the CV analysis result interface
export interface CVAnalysisResult {
  atsScore: number;
  industry: string;
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
  keywordMatches: {
    industry: string[];
    technical: string[];
    soft: string[];
  };
  metrics: {
    keywordDensity: number;
    actionVerbDensity: number;
    quantifiedAchievements: number;
    formatScore: number;
    sectionScore: number;
  };
}

/**
 * Analyzes a CV and calculates an ATS score based on industry standards
 * @param cvText The text content of the CV to analyze
 * @returns A promise that resolves to the CV analysis result
 */
export async function analyzeCV(cvText: string): Promise<CVAnalysisResult> {
  try {
    cvLogger.info('Starting CV analysis');
    
    // Normalize the text for consistent analysis
    const normalizedText = normalizeText(cvText);
    
    // Detect the industry based on the CV content
    const industry = detectIndustry(normalizedText);
    cvLogger.debug(`Detected industry: ${industry}`);
    
    // Calculate keyword matches
    const keywordMatches = calculateKeywordMatches(normalizedText, industry);
    cvLogger.debug(`Found ${keywordMatches.industry.length} industry keywords, ${keywordMatches.technical.length} technical terms, and ${keywordMatches.soft.length} soft skills`);
    
    // Calculate metrics
    const metrics = calculateMetrics(normalizedText);
    cvLogger.debug(`Calculated metrics: keywordDensity=${metrics.keywordDensity.toFixed(2)}, actionVerbDensity=${metrics.actionVerbDensity.toFixed(2)}, quantifiedAchievements=${metrics.quantifiedAchievements}, formatScore=${metrics.formatScore.toFixed(2)}, sectionScore=${metrics.sectionScore.toFixed(2)}`);
    
    // Calculate the overall ATS score
    const atsScore = calculateATSScore(keywordMatches, metrics);
    cvLogger.debug(`Calculated ATS score: ${atsScore.toFixed(2)}`);
    
    // Identify strengths and weaknesses
    const { strengths, weaknesses } = identifyStrengthsAndWeaknesses(keywordMatches, metrics);
    cvLogger.debug(`Identified ${strengths.length} strengths and ${weaknesses.length} weaknesses`);
    
    // Generate recommendations
    const recommendations = generateRecommendations(weaknesses, industry);
    cvLogger.debug(`Generated ${recommendations.length} recommendations`);
    
    // Return the analysis result
    return {
      atsScore,
      industry,
      strengths,
      weaknesses,
      recommendations,
      keywordMatches,
      metrics
    };
  } catch (error) {
    cvLogger.error('Error analyzing CV', error instanceof Error ? error : new Error(String(error)));
    
    // Return a default analysis result in case of error
    return {
      atsScore: 50,
      industry: 'General',
      strengths: ['Unable to analyze strengths due to an error'],
      weaknesses: ['CV analysis failed'],
      recommendations: ['Please try again with a different CV format'],
      keywordMatches: {
        industry: [],
        technical: [],
        soft: []
      },
      metrics: {
        keywordDensity: 0,
        actionVerbDensity: 0,
        quantifiedAchievements: 0,
        formatScore: 0,
        sectionScore: 0
      }
    };
  }
}

/**
 * Normalizes the text for consistent analysis
 * @param text The text to normalize
 * @returns The normalized text
 */
function normalizeText(text: string): string {
  // Convert to lowercase for case-insensitive matching
  let normalized = text.toLowerCase();
  
  // Replace multiple spaces with a single space
  normalized = normalized.replace(/\s+/g, ' ');
  
  // Replace multiple newlines with a single newline
  normalized = normalized.replace(/\n+/g, '\n');
  
  // Remove special characters except for alphanumeric, spaces, and newlines
  normalized = normalized.replace(/[^\w\s\n]/g, ' ');
  
  return normalized;
}

/**
 * Detects the industry based on the CV content
 * @param text The normalized CV text
 * @returns The detected industry
 */
function detectIndustry(text: string): string {
  // Count the occurrences of industry-specific keywords
  const industryCounts: Record<string, number> = {};
  
  for (const [industry, keywords] of Object.entries(INDUSTRY_KEYWORDS)) {
    let count = 0;
    
    for (const keyword of keywords) {
      const regex = new RegExp(`\\b${keyword}\\b`, 'g');
      const matches = text.match(regex);
      
      if (matches) {
        count += matches.length;
      }
    }
    
    industryCounts[industry] = count;
  }
  
  // Find the industry with the highest count
  let maxCount = 0;
  let detectedIndustry = 'General';
  
  for (const [industry, count] of Object.entries(industryCounts)) {
    if (count > maxCount) {
      maxCount = count;
      detectedIndustry = industry;
    }
  }
  
  // If no clear industry is detected, return 'General'
  return maxCount > 5 ? detectedIndustry : 'General';
}

/**
 * Calculates keyword matches in the CV text
 * @param text The normalized CV text
 * @param industry The detected industry
 * @returns The keyword matches
 */
function calculateKeywordMatches(text: string, industry: string): CVAnalysisResult['keywordMatches'] {
  const industryKeywords = industry !== 'General' ? INDUSTRY_KEYWORDS[industry] : [];
  const matches = {
    industry: [] as string[],
    technical: [] as string[],
    soft: [] as string[]
  };
  
  // Check for industry-specific keywords
  for (const keyword of industryKeywords) {
    const regex = new RegExp(`\\b${keyword}\\b`, 'g');
    if (regex.test(text)) {
      matches.industry.push(keyword);
    }
  }
  
  // Check for technical terms
  for (const term of TECHNICAL_TERMS) {
    const regex = new RegExp(`\\b${term}\\b`, 'g');
    if (regex.test(text)) {
      matches.technical.push(term);
    }
  }
  
  // Check for soft skills
  for (const skill of SOFT_SKILLS) {
    const regex = new RegExp(`\\b${skill}\\b`, 'g');
    if (regex.test(text)) {
      matches.soft.push(skill);
    }
  }
  
  return matches;
}

/**
 * Calculates various metrics for the CV
 * @param text The normalized CV text
 * @returns The calculated metrics
 */
function calculateMetrics(text: string): CVAnalysisResult['metrics'] {
  // Calculate keyword density
  const words = text.split(/\s+/).filter(word => word.length > 0);
  const wordCount = words.length;
  
  // Count action verbs
  let actionVerbCount = 0;
  for (const verb of ACTION_VERBS) {
    const regex = new RegExp(`\\b${verb}\\b`, 'g');
    const matches = text.match(regex);
    
    if (matches) {
      actionVerbCount += matches.length;
    }
  }
  
  // Calculate action verb density
  const actionVerbDensity = wordCount > 0 ? (actionVerbCount / wordCount) * 100 : 0;
  
  // Count quantified achievements (numbers, percentages, dollar amounts)
  const quantifiedRegex = /\b\d+%|\$\d+|\d+ (percent|million|thousand|hundred|users|customers|clients|projects|products|increase|decrease|reduction|improvement|growth)\b/g;
  const quantifiedMatches = text.match(quantifiedRegex);
  const quantifiedAchievements = quantifiedMatches ? quantifiedMatches.length : 0;
  
  // Calculate format score
  const formatScore = calculateFormatScore(text);
  
  // Calculate section score
  const sectionScore = calculateSectionScore(text);
  
  // Calculate overall keyword density
  const allKeywords = [
    ...(INDUSTRY_KEYWORDS['General'] || []),
    ...TECHNICAL_TERMS,
    ...SOFT_SKILLS,
    ...ACTION_VERBS
  ];
  
  let keywordCount = 0;
  for (const keyword of allKeywords) {
    const regex = new RegExp(`\\b${keyword}\\b`, 'g');
    const matches = text.match(regex);
    
    if (matches) {
      keywordCount += matches.length;
    }
  }
  
  const keywordDensity = wordCount > 0 ? (keywordCount / wordCount) * 100 : 0;
  
  return {
    keywordDensity,
    actionVerbDensity,
    quantifiedAchievements,
    formatScore,
    sectionScore
  };
}

/**
 * Calculates a score for the CV format
 * @param text The normalized CV text
 * @returns The format score (0-100)
 */
function calculateFormatScore(text: string): number {
  let score = 0;
  
  // Check for bullet points (indicates well-structured content)
  const bulletPointRegex = /•|-|\*/g;
  const bulletPointMatches = text.match(bulletPointRegex);
  const hasBulletPoints = bulletPointMatches && bulletPointMatches.length > 5;
  
  if (hasBulletPoints) {
    score += 20;
  }
  
  // Check for consistent date formatting
  const dateRegex = /(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|january|february|march|april|may|june|july|august|september|october|november|december)[\s\-–—]?\d{4}\s*[-–—]?\s*(present|current|now|\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|january|february|march|april|may|june|july|august|september|october|november|december)[\s\-–—]?\d{4})?/gi;
  const dateMatches = text.match(dateRegex);
  const hasConsistentDates = dateMatches && dateMatches.length >= 2;
  
  if (hasConsistentDates) {
    score += 20;
  }
  
  // Check for section headers
  const sectionHeaderRegex = /\n(.*?)\n/g;
  const potentialHeaders = [];
  let match;
  
  while ((match = sectionHeaderRegex.exec(text)) !== null) {
    potentialHeaders.push(match[1].trim().toLowerCase());
  }
  
  const hasHeaders = potentialHeaders.some(header => 
    ATS_SECTION_HEADERS.some(atsHeader => header.includes(atsHeader))
  );
  
  if (hasHeaders) {
    score += 20;
  }
  
  // Check for contact information at the top
  const contactInfoRegex = /(email|phone|address|linkedin|github).*?\n/i;
  const hasContactInfo = contactInfoRegex.test(text.substring(0, Math.min(500, text.length)));
  
  if (hasContactInfo) {
    score += 20;
  }
  
  // Check for appropriate length (not too short, not too long)
  const wordCount = text.split(/\s+/).filter(word => word.length > 0).length;
  
  if (wordCount >= 300 && wordCount <= 700) {
    score += 20;
  } else if (wordCount > 700) {
    // Penalize for being too long, but not as much
    score += 10;
  } else if (wordCount >= 200) {
    // Penalize for being too short, but not as much
    score += 10;
  }
  
  return score;
}

/**
 * Calculates a score for the CV sections
 * @param text The normalized CV text
 * @returns The section score (0-100)
 */
function calculateSectionScore(text: string): number {
  let score = 0;
  
  // Check for essential sections
  const essentialSections = [
    'summary', 'profile', 'objective',
    'experience', 'work experience', 'employment history',
    'education',
    'skills', 'technical skills', 'competencies'
  ];
  
  for (const section of essentialSections) {
    const regex = new RegExp(`\\b${section}\\b`, 'i');
    if (regex.test(text)) {
      score += 25; // Maximum of 100 for all four categories
      break; // Only count one match per category
    }
  }
  
  return Math.min(score, 100);
}

/**
 * Calculates the overall ATS score
 * @param keywordMatches The keyword matches
 * @param metrics The calculated metrics
 * @returns The ATS score (0-100)
 */
function calculateATSScore(
  keywordMatches: CVAnalysisResult['keywordMatches'],
  metrics: CVAnalysisResult['metrics']
): number {
  // Define weights for each component
  const weights = {
    industryKeywords: 0.25,
    technicalTerms: 0.15,
    softSkills: 0.10,
    keywordDensity: 0.10,
    actionVerbDensity: 0.15,
    quantifiedAchievements: 0.10,
    formatScore: 0.10,
    sectionScore: 0.05
  };
  
  // Calculate scores for each component
  const industryKeywordScore = Math.min(keywordMatches.industry.length / 10, 1) * 100;
  const technicalTermScore = Math.min(keywordMatches.technical.length / 8, 1) * 100;
  const softSkillScore = Math.min(keywordMatches.soft.length / 6, 1) * 100;
  const keywordDensityScore = Math.min(metrics.keywordDensity / 8, 1) * 100;
  const actionVerbDensityScore = Math.min(metrics.actionVerbDensity / 5, 1) * 100;
  const quantifiedAchievementsScore = Math.min(metrics.quantifiedAchievements / 5, 1) * 100;
  const formatScore = metrics.formatScore;
  const sectionScore = metrics.sectionScore;
  
  // Calculate the weighted average
  const atsScore =
    weights.industryKeywords * industryKeywordScore +
    weights.technicalTerms * technicalTermScore +
    weights.softSkills * softSkillScore +
    weights.keywordDensity * keywordDensityScore +
    weights.actionVerbDensity * actionVerbDensityScore +
    weights.quantifiedAchievements * quantifiedAchievementsScore +
    weights.formatScore * formatScore +
    weights.sectionScore * sectionScore;
  
  // Ensure the score is between 0 and 100
  return Math.max(0, Math.min(100, Math.round(atsScore)));
}

/**
 * Identifies strengths and weaknesses in the CV
 * @param keywordMatches The keyword matches
 * @param metrics The calculated metrics
 * @returns The identified strengths and weaknesses
 */
function identifyStrengthsAndWeaknesses(
  keywordMatches: CVAnalysisResult['keywordMatches'],
  metrics: CVAnalysisResult['metrics']
): { strengths: string[], weaknesses: string[] } {
  const strengths: string[] = [];
  const weaknesses: string[] = [];
  
  // Check industry keywords
  if (keywordMatches.industry.length >= 8) {
    strengths.push('Strong industry-specific terminology');
  } else if (keywordMatches.industry.length <= 3) {
    weaknesses.push('Limited industry-specific terminology');
  }
  
  // Check technical terms
  if (keywordMatches.technical.length >= 6) {
    strengths.push('Good use of technical terms');
  } else if (keywordMatches.technical.length <= 2) {
    weaknesses.push('Limited technical vocabulary');
  }
  
  // Check soft skills
  if (keywordMatches.soft.length >= 5) {
    strengths.push('Well-rounded soft skills presentation');
  } else if (keywordMatches.soft.length <= 2) {
    weaknesses.push('Insufficient emphasis on soft skills');
  }
  
  // Check keyword density
  if (metrics.keywordDensity >= 6) {
    strengths.push('Optimal keyword density');
  } else if (metrics.keywordDensity <= 3) {
    weaknesses.push('Low keyword density');
  }
  
  // Check action verb usage
  if (metrics.actionVerbDensity >= 4) {
    strengths.push('Strong use of action verbs');
  } else if (metrics.actionVerbDensity <= 2) {
    weaknesses.push('Limited use of action verbs');
  }
  
  // Check quantified achievements
  if (metrics.quantifiedAchievements >= 4) {
    strengths.push('Good quantification of achievements');
  } else if (metrics.quantifiedAchievements <= 1) {
    weaknesses.push('Lack of quantified achievements');
  }
  
  // Check format score
  if (metrics.formatScore >= 80) {
    strengths.push('Well-formatted and ATS-friendly structure');
  } else if (metrics.formatScore <= 40) {
    weaknesses.push('Poor formatting for ATS compatibility');
  }
  
  // Check section score
  if (metrics.sectionScore >= 75) {
    strengths.push('Comprehensive section coverage');
  } else if (metrics.sectionScore <= 50) {
    weaknesses.push('Missing essential sections');
  }
  
  return { strengths, weaknesses };
}

/**
 * Generates recommendations based on identified weaknesses
 * @param weaknesses The identified weaknesses
 * @param industry The detected industry
 * @returns The generated recommendations
 */
function generateRecommendations(weaknesses: string[], industry: string): string[] {
  const recommendations: string[] = [];
  
  // Generate specific recommendations for each weakness
  for (const weakness of weaknesses) {
    switch (weakness) {
      case 'Limited industry-specific terminology':
        recommendations.push(`Incorporate more ${industry.toLowerCase()} terminology such as: ${getIndustryKeywords(industry).slice(0, 5).join(', ')}`);
        break;
      
      case 'Limited technical vocabulary':
        recommendations.push('Add more technical terms relevant to your field');
        break;
      
      case 'Insufficient emphasis on soft skills':
        recommendations.push('Include more soft skills such as communication, teamwork, and leadership');
        break;
      
      case 'Low keyword density':
        recommendations.push('Increase the density of relevant keywords throughout your CV');
        break;
      
      case 'Limited use of action verbs':
        recommendations.push('Start bullet points with strong action verbs like "achieved," "implemented," or "developed"');
        break;
      
      case 'Lack of quantified achievements':
        recommendations.push('Add metrics and numbers to quantify your achievements (e.g., "increased sales by 20%")');
        break;
      
      case 'Poor formatting for ATS compatibility':
        recommendations.push('Improve formatting with clear section headers and bullet points');
        break;
      
      case 'Missing essential sections':
        recommendations.push('Ensure your CV includes all essential sections: Summary, Experience, Education, and Skills');
        break;
      
      default:
        // No specific recommendation for this weakness
        break;
    }
  }
  
  // Add general recommendations if there are few specific ones
  if (recommendations.length <= 2) {
    recommendations.push('Use a clean, simple format with standard section headings');
    recommendations.push('Tailor your CV to each job application by matching keywords from the job description');
    recommendations.push('Keep your CV concise and focused on relevant experience');
  }
  
  return recommendations;
}

/**
 * Gets industry-specific keywords for a given industry
 * @param industry The industry
 * @returns The industry-specific keywords
 */
export function getIndustryKeywords(industry: string): string[] {
  return INDUSTRY_KEYWORDS[industry] || INDUSTRY_KEYWORDS['General'] || [];
}
