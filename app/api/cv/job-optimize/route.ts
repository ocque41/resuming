import { NextRequest, NextResponse } from 'next/server';
import { getUser, getCVsForUser } from '@/lib/db/queries.server';

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // Parse request body
    const body = await request.json();
    const { cvId, jobDescription } = body;

    if (!cvId || !jobDescription) {
      return NextResponse.json(
        { success: false, error: 'CV ID and job description are required' },
        { status: 400 }
      );
    }

    // Get the CV text
    const cvs = await getCVsForUser(user.id);
    const cv = cvs.find(cv => cv.id === parseInt(cvId));

    if (!cv || !cv.rawText) {
      return NextResponse.json(
        { success: false, error: 'CV not found or has no content' },
        { status: 404 }
      );
    }

    // Extract key requirements from job description
    const keyRequirements = await extractJobRequirements(jobDescription);

    // Optimize CV for the job
    const optimizationResult = await optimizeCVForJob(cv.rawText, keyRequirements);

    // Return the optimized CV and analysis
    return NextResponse.json({
      success: true,
      optimizedText: optimizationResult.optimizedText,
      jobMatchScore: optimizationResult.matchScore,
      keywordMatches: optimizationResult.keywordMatches,
      suggestedImprovements: optimizationResult.improvements
    });

  } catch (error) {
    console.error('Error in job-specific optimization:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'An unknown error occurred' 
      },
      { status: 500 }
    );
  }
}

// Helper function to extract key requirements from job description
async function extractJobRequirements(jobDescription: string) {
  // Extract key skills, experience requirements, and qualifications
  const requirements = {
    skills: [] as string[],
    experience: [] as string[],
    qualifications: [] as string[],
    softSkills: [] as string[]
  };

  try {
    // Extract skills (look for technical terms, tools, technologies)
    const skillsPattern = /(?:skills?|technologies?|tools?|proficient in|experience with)\s*(?::|include|required)?[^.]*?([^.]+)/gi;
    let match;
    while ((match = skillsPattern.exec(jobDescription)) !== null) {
      if (match[1]) {
        const skills = match[1].split(/,|\band\b/).map(s => s.trim());
        requirements.skills.push(...skills.filter(s => s.length > 0));
      }
    }

    // Extract experience requirements
    const experiencePattern = /(?:\d+(?:\+|\s*-\s*\d+)?\s+years?|experience in|background in)[^.]*?([^.]+)/gi;
    while ((match = experiencePattern.exec(jobDescription)) !== null) {
      if (match[1]) {
        requirements.experience.push(match[1].trim());
      }
    }

    // Extract qualifications
    const qualificationPattern = /(?:degree|certification|qualification|education)[^.]*?([^.]+)/gi;
    while ((match = qualificationPattern.exec(jobDescription)) !== null) {
      if (match[1]) {
        requirements.qualifications.push(match[1].trim());
      }
    }

    // Extract soft skills
    const softSkillPattern = /(?:ability to|capable of|strong|excellent)[^.]*?([^.]+)/gi;
    while ((match = softSkillPattern.exec(jobDescription)) !== null) {
      if (match[1]) {
        requirements.softSkills.push(match[1].trim());
      }
    }

    return requirements;
  } catch (error) {
    console.error('Error extracting job requirements:', error);
    throw new Error('Failed to analyze job requirements');
  }
}

// Helper function to optimize CV based on job requirements
async function optimizeCVForJob(cvText: string, requirements: {
  skills: string[];
  experience: string[];
  qualifications: string[];
  softSkills: string[];
}) {
  try {
    // Initialize result object
    const result = {
      optimizedText: cvText,
      matchScore: 0,
      keywordMatches: [] as string[],
      improvements: [] as string[]
    };

    // Track matched and missing keywords
    const matchedKeywords = new Set<string>();
    const missingKeywords = new Set<string>();

    // Check for keyword matches in CV
    const allKeywords = [
      ...requirements.skills,
      ...requirements.experience,
      ...requirements.qualifications,
      ...requirements.softSkills
    ];

    allKeywords.forEach(keyword => {
      if (cvText.toLowerCase().includes(keyword.toLowerCase())) {
        matchedKeywords.add(keyword);
      } else {
        missingKeywords.add(keyword);
      }
    });

    // Calculate match score (percentage of keywords found)
    result.matchScore = (matchedKeywords.size / allKeywords.length) * 100;

    // Store matched keywords
    result.keywordMatches = Array.from(matchedKeywords);

    // Generate improvements based on missing keywords
    if (missingKeywords.size > 0) {
      result.improvements.push(
        `Consider adding these keywords from the job description: ${Array.from(missingKeywords).join(', ')}`
      );
    }

    // Optimize the CV text by highlighting relevant experience
    // This is a placeholder for more sophisticated optimization logic
    const sections = cvText.split(/\n{2,}/);
    const optimizedSections = sections.map(section => {
      let sectionText = section;
      matchedKeywords.forEach(keyword => {
        // Highlight or emphasize matched keywords
        const regex = new RegExp(`(${keyword})`, 'gi');
        sectionText = sectionText.replace(regex, '$1');
      });
      return sectionText;
    });

    result.optimizedText = optimizedSections.join('\n\n');

    return result;
  } catch (error) {
    console.error('Error optimizing CV:', error);
    throw new Error('Failed to optimize CV for job requirements');
  }
} 