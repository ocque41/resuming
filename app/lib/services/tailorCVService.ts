import { logger } from '@/lib/logger';

/**
 * Interface for the results returned by the tailor-for-job API
 */
interface TailorCVResult {
  tailoredContent: string;
  enhancedProfile: string;
  sectionImprovements: Record<string, string>;
}

/**
 * Interface for the response from the tailor-for-job API
 */
interface TailorCVResponse {
  success: boolean;
  result?: TailorCVResult;
  error?: string;
}

/**
 * Service function to call the tailor-for-job API
 * 
 * @param cvText - The original CV text to be tailored
 * @param jobDescription - The job description to tailor the CV for
 * @param jobTitle - Optional job title for better context
 * @returns A promise that resolves to the tailored CV content and enhancements
 */
export async function tailorCVForJob(
  cvText: string,
  jobDescription: string,
  jobTitle?: string
): Promise<{
  tailoredContent: string;
  enhancedProfile: string;
  sectionImprovements: Record<string, string>;
  success: boolean;
  error?: string;
}> {
  logger.info('Calling tailor-for-job API to optimize CV');
  
  try {
    // Default empty result
    const defaultResult = {
      tailoredContent: '',
      enhancedProfile: '',
      sectionImprovements: {},
      success: false,
      error: 'Failed to tailor CV'
    };
    
    // Check required parameters
    if (!cvText) {
      logger.error('Missing cvText parameter for tailorCVForJob');
      return {
        ...defaultResult,
        error: 'CV text is required'
      };
    }
    
    if (!jobDescription) {
      logger.error('Missing jobDescription parameter for tailorCVForJob');
      return {
        ...defaultResult,
        error: 'Job description is required'
      };
    }
    
    // Call the API
    const response = await fetch('/api/cv/tailor-for-job', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        cvText,
        jobDescription,
        jobTitle
      }),
    });
    
    // Handle non-OK responses
    if (!response.ok) {
      const errorText = await response.text();
      logger.error(`Error from tailor-for-job API: ${response.status} - ${errorText}`);
      return {
        ...defaultResult,
        error: `API error: ${response.status} ${response.statusText}`
      };
    }
    
    // Parse response
    const data = await response.json() as TailorCVResponse;
    
    // Handle API-level failures
    if (!data.success || !data.result) {
      logger.error(`API reported failure: ${data.error || 'Unknown error'}`);
      return {
        ...defaultResult,
        error: data.error || 'Unknown error from API'
      };
    }
    
    // Return the successful result
    return {
      tailoredContent: data.result.tailoredContent || cvText,
      enhancedProfile: data.result.enhancedProfile || '',
      sectionImprovements: data.result.sectionImprovements || {},
      success: true
    };
  } catch (error) {
    // Catch any unexpected errors
    logger.error('Error in tailorCVForJob:', error instanceof Error ? error.message : String(error));
    return {
      tailoredContent: '',
      enhancedProfile: '',
      sectionImprovements: {},
      success: false,
      error: error instanceof Error ? error.message : 'An unknown error occurred'
    };
  }
} 