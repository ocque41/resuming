import { NextRequest, NextResponse } from 'next/server';
import { getUser } from '@/lib/auth/auth';
import { logger } from '@/lib/logger';
import { analyzeAndOptimizeWithGPT4o } from '@/lib/services/openaiOptimizer';
import { optimizeCV } from '@/lib/services/progressiveOptimizer';

// Type definition for analysis result
export interface CVAnalysisResult {
  industry?: string;
  language?: string;
  experience?: Array<{
    title: string;
    company: string;
    dates: string;
    responsibilities: string[];
  }>;
  education?: Array<{
    degree: string;
    field: string;
    institution: string;
    year: string;
  }>;
  skills?: {
    technical: string[];
    professional: string[];
  };
  achievements?: string[];
  profile?: string;
  languages?: string[];
  sections?: Array<{ name: string; content: string }>;
  strengths?: string[];
  weaknesses?: string[];
  missingKeywords?: string[];
  formattingIssues?: string[];
  structuralIssues?: string[];
}

// Transform OpenAI response to match our interface
function transformAnalysis(analysis: any): CVAnalysisResult {
  // Create a properly typed result
  const result: CVAnalysisResult = {
    industry: analysis?.industry || '',
    language: analysis?.language || '',
    sections: analysis?.sections || [],
    skills: {
      technical: [],
      professional: []
    },
    achievements: analysis?.achievements || [],
    profile: analysis?.profile || '',
    languages: analysis?.languages || [],
    strengths: analysis?.strengths || [],
    weaknesses: analysis?.weaknesses || [],
    missingKeywords: analysis?.missingKeywords || [],
    formattingIssues: analysis?.formattingIssues || [],
    structuralIssues: analysis?.structuralIssues || []
  };
  
  // Handle skills specifically
  if (analysis?.skills) {
    // If skills is an array, convert it to the expected format
    if (Array.isArray(analysis.skills)) {
      result.skills = {
        technical: analysis.skills,
        professional: []
      };
    } else if (typeof analysis.skills === 'object') {
      // If it's already an object, ensure it has the right properties
      result.skills = {
        technical: analysis.skills.technical || [],
        professional: analysis.skills.professional || []
      };
    }
  }
  
  return result;
}

// Helper function to get basic analysis
async function getBasicAnalysis(cvText: string, jobDescription: string): Promise<CVAnalysisResult> {
  try {
    const result = await analyzeAndOptimizeWithGPT4o(cvText, jobDescription);
    // Transform the analysis to match our interface
    return transformAnalysis(result.cvAnalysis);
  } catch (error) {
    logger.error('Error performing CV analysis:', error instanceof Error ? error.message : String(error));
    
    // Return an empty analysis result with the correct types
    return transformAnalysis({});
  }
}

// GET endpoint (for debugging/analysis only)
export async function GET(request: NextRequest) {
  try {
    // Get user session
    const user = await getUser();
    if (!user) {
      logger.warn('Unauthorized attempt to access CV analysis');
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const cvText = searchParams.get('cv') || '';
    const jobDescription = searchParams.get('job') || '';

    if (!cvText) {
      return NextResponse.json(
        { success: false, error: 'Missing CV text' },
        { status: 400 }
      );
    }

    // Get basic analysis
    const analysis = await getBasicAnalysis(cvText, jobDescription);

    return NextResponse.json({
      success: true,
      analysis
    });
  } catch (error) {
    logger.error('Error in CV analysis endpoint:', error instanceof Error ? error.message : String(error));
    return NextResponse.json(
      { success: false, error: 'Error analyzing CV' },
      { status: 500 }
    );
  }
}

// POST endpoint for CV optimization
export async function POST(request: NextRequest) {
  try {
    // Get user session
    const user = await getUser();
    if (!user) {
      logger.warn('Unauthorized attempt to access CV optimization');
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    try {
      // Parse request body
      const body = await request.json();
      const { cvId, jobListingId, cvText, jobDescription } = body;

      // Validate parameters
      if (!cvId && !cvText) {
        return NextResponse.json(
          { success: false, error: 'Missing CV ID or content' },
          { status: 400 }
        );
      }

      // Use provided CV text or job description
      const actualCvText = cvText || '';
      const actualJobDescription = jobDescription || '';

      // Track start time for performance logging
      const startTime = Date.now();
      
      // Ensure cvId is a string
      const cvIdString = typeof cvId === 'number' ? String(cvId) : (cvId || 'direct-input');
      
      // Make sure we have a string user ID
      const userId = String(user.id);
      
      logger.info(`Starting CV optimization for user ${userId}, CV ${cvIdString}`);

      // Start the optimization process
      const result = await optimizeCV(
        userId,
        cvIdString,
        actualCvText, 
        actualJobDescription, 
        {
          documentFormat: 'markdown',
          aiService: 'openai'
        }
      );

      // Log completion
      const duration = Date.now() - startTime;
      logger.info(`CV optimization ${result.success ? 'completed' : 'failed'} in ${duration}ms for user ${userId}`);

      if (!result.success) {
        // Get the error type and message
        const error = result.result.error || 'Unknown error';
        const isTimeout = typeof error === 'string' && (
          error.includes('timeout') || 
          error.includes('timed out') || 
          error.includes('high load')
        );
        
        // Return appropriate status code
        const statusCode = isTimeout ? 408 : 500; // 408 Request Timeout
        let userMessage = error;
        
        // Create user-friendly message for timeout errors
        if (isTimeout) {
          userMessage = 'CV optimization timed out. The system may be experiencing high load or your CV may be too complex. Please try again later or simplify your CV.';
        }
        
        return NextResponse.json(
          { 
            success: false, 
            error: userMessage,
            result: {
              progress: result.result.progress || 0,
              isTimeout: isTimeout
            }
          },
          { status: statusCode }
        );
      }

      // Return success response
      return NextResponse.json({
        success: true,
        result: {
          optimizedContent: result.result.optimizedContent,
          matchScore: result.result.matchScore,
          recommendations: result.result.recommendations || [],
          progress: 100
        }
      });
    } catch (error) {
      // Log the error
      logger.error('Error in CV optimization:', error instanceof Error ? error.message : String(error));
      
      // Check if it's a timeout error
      const errorMessage = error instanceof Error ? error.message : String(error);
      const isTimeout = errorMessage.includes('timeout') || errorMessage.includes('timed out');
      
      return NextResponse.json(
        { 
          success: false, 
          error: isTimeout 
            ? 'CV optimization timed out. Please try again when the system has less load.' 
            : 'Error optimizing CV. Please try again later.'
        },
        { status: isTimeout ? 408 : 500 }
      );
    }
  } catch (error) {
    // Catch any outer errors
    logger.error('Unexpected error in CV optimization endpoint:', error instanceof Error ? error.message : String(error));
    return NextResponse.json(
      { success: false, error: 'An unexpected error occurred. Please try again later.' },
      { status: 500 }
    );
  }
} 