import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

// This is a mock API to extract keywords from a CV
// In a real implementation, this would use NLP or AI to extract relevant skills,
// job titles, and other keywords from the CV content
export async function POST(req: Request) {
  try {
    const { cvId, cvText } = await req.json();
    
    if (!cvText && !cvId) {
      return NextResponse.json(
        { error: 'Either cvId or cvText must be provided' },
        { status: 400 }
      );
    }
    
    let textToAnalyze = cvText;
    
    // If cvId is provided but no text, in a real app you would fetch the CV content
    // For this mock implementation, we'll just return some default keywords
    if (!textToAnalyze) {
      // Mock extracting keywords from CV text
      return NextResponse.json({
        keywords: ['react', 'typescript', 'frontend', 'javascript', 'node.js', 'development'],
        jobTypes: ['Frontend Developer', 'Full Stack Developer', 'JavaScript Developer'],
        locations: [],
        experience: '3-5 years'
      });
    }
    
    // Simple keyword extraction based on common tech terms
    // In a real implementation, this would use more sophisticated NLP
    const techKeywords = [
      'javascript', 'typescript', 'react', 'vue', 'angular', 'node.js', 'express', 
      'python', 'django', 'flask', 'java', 'spring', 'c#', '.net', 'php', 'laravel',
      'ruby', 'rails', 'go', 'rust', 'aws', 'azure', 'gcp', 'docker', 'kubernetes',
      'mongodb', 'postgresql', 'mysql', 'redis', 'graphql', 'rest api', 'html', 'css',
      'sass', 'less', 'tailwind', 'bootstrap', 'material ui', 'devops', 'ci/cd',
      'git', 'agile', 'scrum', 'testing', 'jest', 'mocha', 'cypress', 'selenium'
    ];
    
    const jobTitles = [
      'frontend developer', 'backend developer', 'full stack developer', 
      'software engineer', 'web developer', 'mobile developer', 'devops engineer',
      'data scientist', 'machine learning engineer', 'product manager',
      'ui/ux designer', 'qa engineer', 'system administrator'
    ];
    
    // Extract keywords
    const extractedKeywords = techKeywords.filter(keyword => 
      textToAnalyze.toLowerCase().includes(keyword.toLowerCase())
    );
    
    // Extract potential job titles
    const extractedJobTitles = jobTitles.filter(title => 
      textToAnalyze.toLowerCase().includes(title.toLowerCase())
    );
    
    // Very simple location extraction (would be more sophisticated in production)
    const locationRegex = /(new york|san francisco|seattle|austin|london|berlin|remote)/gi;
    const locationMatches = textToAnalyze.match(locationRegex) || [];
    const extractedLocations = [...new Set(locationMatches.map((l: string) => l.toLowerCase()))];
    
    // Simple experience level extraction
    let experience = '';
    if (textToAnalyze.match(/\b[5-9][\+]? years?\b/i) || textToAnalyze.match(/\b1[0-9][\+]? years?\b/i)) {
      experience = '5+ years';
    } else if (textToAnalyze.match(/\b[3-4][\+]? years?\b/i)) {
      experience = '3-5 years';
    } else if (textToAnalyze.match(/\b[1-2][\+]? years?\b/i)) {
      experience = '1-3 years';
    } else {
      experience = 'Entry level';
    }
    
    return NextResponse.json({
      keywords: extractedKeywords,
      jobTypes: extractedJobTitles.length > 0 ? extractedJobTitles : ['Software Developer'],
      locations: extractedLocations,
      experience
    });
    
  } catch (error) {
    console.error('Error extracting keywords:', error);
    return NextResponse.json(
      { error: 'Failed to extract keywords from CV' },
      { status: 500 }
    );
  }
} 