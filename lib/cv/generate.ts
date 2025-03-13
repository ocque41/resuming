import { KeywordMatch } from "@/lib/types";

// Achievement templates with placeholders for keywords and metrics
const achievementTemplates = [
  "Led {keyword} initiatives resulting in {metric}% improvement in team productivity",
  "Implemented {keyword} solutions that reduced operational costs by {metric}%",
  "Managed {keyword} projects with teams of {metric}+ professionals",
  "Developed {keyword} strategies leading to {metric}% increase in efficiency",
  "Spearheaded {keyword} transformation resulting in {metric}% performance boost",
  "Orchestrated {keyword} programs achieving {metric}% growth in key metrics",
  "Delivered {keyword} solutions generating ${metric}K in cost savings",
  "Executed {keyword} optimization leading to {metric}% reduction in processing time",
  "Established {keyword} frameworks improving team efficiency by {metric}%",
  "Pioneered {keyword} methodologies resulting in {metric}% quality improvement"
];

// Goal templates with placeholders for keywords
const goalTemplates = [
  "Drive innovation in {keyword} to achieve {metric}% improvement in system performance",
  "Lead {keyword} initiatives to reduce operational costs by {metric}%",
  "Develop and implement {keyword} strategies to increase efficiency by {metric}%",
  "Expand expertise in {keyword} to deliver ${metric}K in business value",
  "Advance {keyword} capabilities to improve team productivity by {metric}%",
  "Establish best practices in {keyword} to achieve {metric}% quality improvement",
  "Optimize {keyword} processes to reduce overhead by {metric}%",
  "Scale {keyword} solutions to support {metric}% business growth",
  "Champion {keyword} transformation to enhance performance by {metric}%",
  "Leverage {keyword} expertise to drive {metric}% improvement in key metrics"
];

/**
 * Generates a deterministic random number based on a seed string
 */
function seededRandom(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    const char = seed.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(Math.sin(hash));
}

/**
 * Generates a random metric based on the type of metric needed
 */
function generateMetric(seed: string, type: 'percentage' | 'amount' | 'team_size'): number {
  const random = seededRandom(seed);
  
  switch (type) {
    case 'percentage':
      return Math.floor(random * 45) + 15; // 15-60%
    case 'amount':
      return Math.floor(random * 900) + 100; // $100K-$1000K
    case 'team_size':
      return Math.floor(random * 15) + 5; // 5-20 team members
    default:
      return Math.floor(random * 50) + 10; // 10-60 (default range)
  }
}

/**
 * Generates quantified achievements based on keywords
 */
export function generateQuantifiedAchievements(keywords: string[]): string[] {
  const achievements: string[] = [];
  const usedTemplates = new Set<number>();
  
  // Ensure we have at least 3 keywords
  const paddedKeywords = [...keywords];
  while (paddedKeywords.length < 3) {
    paddedKeywords.push(keywords[0] || 'professional');
  }
  
  // Generate 5 unique achievements
  for (let i = 0; i < 5; i++) {
    // Select a random template that hasn't been used
    let templateIndex: number;
    do {
      templateIndex = Math.floor(seededRandom(`${paddedKeywords[i % paddedKeywords.length]}_${i}`) * achievementTemplates.length);
    } while (usedTemplates.has(templateIndex));
    
    usedTemplates.add(templateIndex);
    const template = achievementTemplates[templateIndex];
    
    // Select a keyword and generate metrics
    const keyword = paddedKeywords[i % paddedKeywords.length];
    const metricType = template.includes('$') ? 'amount' : template.includes('team') ? 'team_size' : 'percentage';
    const metric = generateMetric(`${keyword}_${i}_metric`, metricType);
    
    // Generate the achievement
    const achievement = template
      .replace('{keyword}', keyword)
      .replace('{metric}', metric.toString());
    
    achievements.push(achievement);
  }
  
  return achievements;
}

/**
 * Generates quantified goals based on keywords
 */
export function generateQuantifiedGoals(keywords: string[]): string[] {
  const goals: string[] = [];
  const usedTemplates = new Set<number>();
  
  // Ensure we have at least 3 keywords
  const paddedKeywords = [...keywords];
  while (paddedKeywords.length < 3) {
    paddedKeywords.push(keywords[0] || 'professional');
  }
  
  // Generate 3 unique goals
  for (let i = 0; i < 3; i++) {
    // Select a random template that hasn't been used
    let templateIndex: number;
    do {
      templateIndex = Math.floor(seededRandom(`goal_${paddedKeywords[i]}_${i}`) * goalTemplates.length);
    } while (usedTemplates.has(templateIndex));
    
    usedTemplates.add(templateIndex);
    const template = goalTemplates[templateIndex];
    
    // Select a keyword and generate metrics
    const keyword = paddedKeywords[i % paddedKeywords.length];
    const metricType = template.includes('$') ? 'amount' : 'percentage';
    const metric = generateMetric(`${keyword}_${i}_goal_metric`, metricType);
    
    // Generate the goal
    const goal = template
      .replace('{keyword}', keyword)
      .replace('{metric}', metric.toString());
    
    goals.push(goal);
  }
  
  return goals;
} 