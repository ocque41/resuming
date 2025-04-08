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
  jobId?: string;
  status?: string;
  progress?: number;
}

/**
 * Interface representing an industry with its specific optimization parameters
 */
interface Industry {
  name: string;
  keywords: string[];
  importantSkills: string[];
  preferredFormats: string[];
  achievementMetrics: string[];
  commonTitles: string[];
}

/**
 * Collection of major industries with their specific optimization parameters
 */
const INDUSTRIES: Industry[] = [
  {
    name: 'Technology',
    keywords: ['software', 'development', 'programming', 'code', 'tech', 'digital', 'IT', 'computer', 'system', 'data', 'analytics', 'cloud', 'infrastructure', 'agile', 'DevOps', 'AI', 'machine learning', 'web', 'mobile', 'app', 'platform', 'API'],
    importantSkills: ['programming languages', 'frameworks', 'databases', 'cloud services', 'version control', 'testing', 'deployment', 'architecture', 'algorithms', 'data structures'],
    preferredFormats: ['skills-first', 'chronological', 'technical project summaries'],
    achievementMetrics: ['code quality', 'system performance', 'optimization %', 'decreased load time', 'increased efficiency', 'reduced bugs', 'improved uptime'],
    commonTitles: ['Software Engineer', 'Developer', 'Architect', 'DevOps Engineer', 'Data Scientist', 'Product Manager', 'Analyst', 'QA Engineer', 'Technical Lead', 'CTO']
  },
  {
    name: 'Finance',
    keywords: ['finance', 'bank', 'accounting', 'financial', 'audit', 'tax', 'revenue', 'budget', 'fiscal', 'investment', 'trading', 'assets', 'wealth', 'capital', 'portfolio', 'risk', 'compliance', 'securities', 'equity', 'profit', 'loss'],
    importantSkills: ['financial analysis', 'accounting', 'Excel', 'financial modeling', 'forecasting', 'budgeting', 'risk assessment', 'regulatory compliance', 'portfolio management'],
    preferredFormats: ['chronological', 'achievement-focused', 'formal'],
    achievementMetrics: ['ROI', 'revenue growth', 'cost reduction', 'portfolio performance', 'efficiency savings', 'audit findings', 'risk mitigation'],
    commonTitles: ['Financial Analyst', 'Accountant', 'Controller', 'Auditor', 'Investment Banker', 'Portfolio Manager', 'Risk Manager', 'CFO', 'Treasurer', 'Tax Specialist']
  },
  {
    name: 'Healthcare',
    keywords: ['healthcare', 'medical', 'clinical', 'patient', 'hospital', 'doctor', 'nurse', 'physician', 'therapy', 'diagnostic', 'treatment', 'pharmaceutical', 'health', 'care', 'wellness', 'disease', 'clinic'],
    importantSkills: ['patient care', 'clinical experience', 'electronic medical records', 'medical terminology', 'treatment planning', 'regulatory compliance', 'medical software'],
    preferredFormats: ['chronological', 'credential-focused', 'licensing-prominent'],
    achievementMetrics: ['patient outcomes', 'compliance rates', 'treatment efficacy', 'patient satisfaction', 'reduced readmissions', 'care quality metrics'],
    commonTitles: ['Physician', 'Nurse', 'Medical Director', 'Clinical Manager', 'Healthcare Administrator', 'Patient Care Coordinator', 'Medical Technician', 'Therapist']
  },
  {
    name: 'Marketing',
    keywords: ['marketing', 'brand', 'campaign', 'digital', 'social media', 'content', 'SEO', 'advertising', 'creative', 'strategy', 'audience', 'market', 'consumer', 'promotion', 'engagement', 'conversion', 'analytics', 'traffic'],
    importantSkills: ['content creation', 'social media management', 'SEO', 'analytics tools', 'campaign management', 'audience targeting', 'creative direction', 'CRM'],
    preferredFormats: ['achievement-focused', 'portfolio-linked', 'creative'],
    achievementMetrics: ['conversion rates', 'engagement metrics', 'traffic growth', 'ROI', 'market share', 'brand awareness', 'customer acquisition cost'],
    commonTitles: ['Marketing Manager', 'Digital Marketer', 'Content Strategist', 'Brand Manager', 'Social Media Specialist', 'SEO Expert', 'Marketing Director', 'Growth Hacker']
  },
  {
    name: 'Sales',
    keywords: ['sales', 'business development', 'account', 'revenue', 'client', 'customer', 'pipeline', 'target', 'quota', 'deal', 'lead', 'prospect', 'closing', 'negotiation', 'relationship', 'CRM', 'B2B', 'B2C'],
    importantSkills: ['negotiation', 'relationship building', 'CRM software', 'pipeline management', 'closing techniques', 'prospecting', 'account management', 'sales presentations'],
    preferredFormats: ['results-first', 'achievement-focused', 'metrics-driven'],
    achievementMetrics: ['revenue generated', 'quota attainment', 'deal size', 'sales cycle reduction', 'client retention', 'upselling', 'conversion rate'],
    commonTitles: ['Sales Representative', 'Account Executive', 'Business Development Manager', 'Sales Manager', 'Account Manager', 'Sales Director', 'VP of Sales', 'Customer Success Manager']
  },
  {
    name: 'Engineering',
    keywords: ['engineering', 'mechanical', 'electrical', 'civil', 'chemical', 'design', 'construction', 'manufacturing', 'industrial', 'product', 'technical', 'CAD', 'simulation', 'prototype', 'production', 'quality', 'standards'],
    importantSkills: ['CAD software', 'design techniques', 'engineering analysis', 'quality control', 'project management', 'technical specifications', 'regulatory compliance', 'testing methodologies'],
    preferredFormats: ['chronological', 'project-based', 'technical skills-prominent'],
    achievementMetrics: ['design improvements', 'efficiency gains', 'cost reduction', 'quality metrics', 'production yield', 'compliance rates', 'innovation metrics'],
    commonTitles: ['Mechanical Engineer', 'Electrical Engineer', 'Civil Engineer', 'Process Engineer', 'Product Engineer', 'Design Engineer', 'Project Engineer', 'Quality Engineer']
  },
  {
    name: 'Education',
    keywords: ['education', 'teaching', 'school', 'academic', 'student', 'learning', 'curriculum', 'classroom', 'instruction', 'educational', 'teacher', 'professor', 'faculty', 'pedagogy', 'assessment', 'training'],
    importantSkills: ['curriculum development', 'classroom management', 'student assessment', 'educational technology', 'instructional design', 'differentiated instruction', 'lesson planning'],
    preferredFormats: ['credential-first', 'chronological', 'teaching philosophy inclusion'],
    achievementMetrics: ['student performance improvement', 'program development', 'assessment outcomes', 'student engagement', 'graduation rates', 'curriculum adoption'],
    commonTitles: ['Teacher', 'Professor', 'Instructor', 'Principal', 'Academic Advisor', 'Education Coordinator', 'Dean', 'Department Chair', 'Curriculum Developer']
  },
  {
    name: 'Legal',
    keywords: ['legal', 'law', 'attorney', 'counsel', 'litigation', 'contract', 'compliance', 'regulatory', 'statute', 'court', 'judicial', 'legislation', 'policy', 'rights', 'investigation', 'claims', 'dispute'],
    importantSkills: ['legal research', 'case management', 'contract drafting', 'negotiation', 'client counseling', 'litigation', 'regulatory compliance', 'legal writing'],
    preferredFormats: ['credential-focused', 'chronological', 'formal'],
    achievementMetrics: ['case outcomes', 'settlement amounts', 'compliance improvements', 'risk mitigation', 'contract efficiencies', 'successful negotiations'],
    commonTitles: ['Attorney', 'Lawyer', 'Legal Counsel', 'Paralegal', 'Compliance Officer', 'Legal Assistant', 'General Counsel', 'Contract Manager', 'Litigation Specialist']
  }
];

/**
 * Identify industry from job description
 * 
 * @param jobDescription - The job description text
 * @returns The identified industry or undefined if no clear match
 */
function identifyIndustry(jobDescription: string): Industry | undefined {
  const jobText = jobDescription.toLowerCase();
  
  // Calculate a match score for each industry
  const industryScores = INDUSTRIES.map(industry => {
    let score = 0;
    
    // Check for industry keywords in the job description
    industry.keywords.forEach(keyword => {
      const regex = new RegExp(`\\b${keyword.toLowerCase()}\\b`, 'g');
      const matches = jobText.match(regex);
      if (matches) {
        score += matches.length;
      }
    });
    
    // Check for common job titles
    industry.commonTitles.forEach(title => {
      if (jobText.includes(title.toLowerCase())) {
        score += 3; // Higher weight for title matches
      }
    });
    
    return { industry, score };
  });
  
  // Sort by score descending
  const sortedIndustries = industryScores.sort((a, b) => b.score - a.score);
  
  // Return the industry with the highest score if it's significant (threshold of 3)
  return sortedIndustries[0].score >= 3 ? sortedIndustries[0].industry : undefined;
}

/**
 * Get industry-specific optimization guidance
 * 
 * @param jobDescription - The job description text
 * @returns Object containing industry-specific optimization guidance
 */
export function getIndustryOptimizationGuidance(jobDescription: string): {
  industry: string;
  keySkills: string[];
  suggestedMetrics: string[];
  formatGuidance: string;
} {
  // Identify the industry
  const industry = identifyIndustry(jobDescription);
  
  if (!industry) {
    // Default generic guidance if no specific industry is detected
    return {
      industry: 'General',
      keySkills: ['communication', 'teamwork', 'project management', 'problem-solving', 'organization'],
      suggestedMetrics: ['efficiency improvements', 'cost savings', 'project completion', 'team coordination'],
      formatGuidance: 'Use a clean, chronological format with clear section headings'
    };
  }
  
  // Ensure all required arrays exist with fallbacks
  const importantSkills = Array.isArray(industry.importantSkills) && industry.importantSkills.length > 0 
    ? industry.importantSkills 
    : ['communication', 'teamwork', 'industry-specific knowledge'];
    
  const achievementMetrics = Array.isArray(industry.achievementMetrics) && industry.achievementMetrics.length > 0
    ? industry.achievementMetrics
    : ['efficiency improvements', 'cost savings', 'project completion'];
    
  const preferredFormats = Array.isArray(industry.preferredFormats) && industry.preferredFormats.length > 0
    ? industry.preferredFormats
    : ['chronological', 'achievement-focused'];
  
  // Return industry-specific guidance with validated arrays
  return {
    industry: industry.name,
    keySkills: importantSkills,
    suggestedMetrics: achievementMetrics,
    formatGuidance: `Consider using ${preferredFormats.join(' or ')} format for ${industry.name} roles`
  };
}

/**
 * Maximum time to wait for tailoring job to complete (in milliseconds)
 */
const MAX_POLLING_TIME = 180000; // 3 minutes (increased from 45 seconds)

/**
 * Polling interval for checking job status (in milliseconds)
 */
const POLLING_INTERVAL = 5000;  // 5 seconds (increased from 2 seconds)

/**
 * Maximum number of retries for API calls
 */
const MAX_RETRIES = 3;

/**
 * Retry backoff factor (milliseconds)
 */
const RETRY_BACKOFF_FACTOR = 2;

/**
 * Retry an async function with exponential backoff
 */
async function retryWithBackoff<T>(
  fn: () => Promise<T>, 
  maxRetries: number = MAX_RETRIES,
  backoff: number = RETRY_BACKOFF_FACTOR
): Promise<T> {
  let lastError: any;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      logger.warn(`Attempt ${attempt + 1}/${maxRetries} failed:`, error instanceof Error ? error.message : String(error));
      // Exponential backoff with jitter
      const delay = backoff * Math.pow(2, attempt) * (0.9 + Math.random() * 0.2);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
}

/**
 * Poll for job status with a timeout
 */
export async function pollJobStatus(jobId: string): Promise<TailorCVResult> {
  logger.info(`Polling job status for job ${jobId}`);
  
  // Track last progress update to reduce log noise
  let lastProgressUpdate = 0;
  let consecutiveErrors = 0;
  
  const startTime = Date.now();
  
  while (Date.now() - startTime < MAX_POLLING_TIME) {
    try {
      // Add retries for network issues
      let retryCount = 0;
      let response = null;
      
      while (retryCount <= MAX_RETRIES) {
        try {
          response = await fetch(`/api/cv/tailor-for-job/status?jobId=${jobId}`);
          break; // Success, exit retry loop
        } catch (error) {
          retryCount++;
          logger.warn(`Fetch attempt ${retryCount} failed for job ${jobId}: ${error instanceof Error ? error.message : String(error)}`);
          
          if (retryCount > MAX_RETRIES) {
            throw error; // Re-throw if we've exhausted retries
          }
          
          // Exponential backoff before retry
          const backoffTime = 1000 * Math.pow(RETRY_BACKOFF_FACTOR, retryCount - 1);
          await new Promise(resolve => setTimeout(resolve, backoffTime));
        }
      }
      
      if (!response) {
        throw new Error('Failed to connect to status API after maximum retries');
      }
      
      if (!response.ok) {
        logger.error(`Error polling job status: ${response.status} ${response.statusText}`);
        
        // If server error, wait a bit before retrying
        if (response.status >= 500) {
          consecutiveErrors++;
          // If we get multiple errors in a row, wait longer
          const errorBackoff = Math.min(POLLING_INTERVAL * Math.pow(2, consecutiveErrors - 1), 10000);
          await new Promise(resolve => setTimeout(resolve, errorBackoff));
          continue;
        }
        
        throw new Error(`API error: ${response.status} ${response.statusText}`);
      }
      
      // Reset error counter on successful response
      consecutiveErrors = 0;
      
      const data = await response.json() as TailorCVResponse;
      
      // If job completed successfully, return the result
      if (data.success && data.status === 'completed' && data.result) {
        logger.info(`Job ${jobId} completed successfully`);
        return data.result;
      }
      
      // If job failed, throw an error
      if (data.status === 'error' || !data.success) {
        throw new Error(data.error || 'Job processing failed');
      }
      
      // Log progress only when it changes significantly
      if (data.progress && Math.abs(data.progress - lastProgressUpdate) >= 5) {
        logger.info(`Job ${jobId} progress: ${data.progress}%`);
        lastProgressUpdate = data.progress;
      }
      
      // Wait before next poll
      await new Promise(resolve => setTimeout(resolve, POLLING_INTERVAL));
    } catch (error) {
      consecutiveErrors++;
      logger.error('Error polling job status:', error instanceof Error ? error.message : String(error));
      
      // If we get too many consecutive errors, fail the job
      if (consecutiveErrors >= 5) {
        throw new Error('Too many consecutive errors while polling job status');
      }
      
      // Wait with increasing backoff before retrying
      const errorBackoff = Math.min(POLLING_INTERVAL * Math.pow(2, consecutiveErrors - 1), 10000);
      await new Promise(resolve => setTimeout(resolve, errorBackoff));
    }
  }
  
  // If we reached here, we timed out but job might still be processing
  logger.warn(`Job ${jobId} timed out after ${MAX_POLLING_TIME / 1000} seconds, but may still complete in the background`);
  throw new Error(`Job processing timed out after ${MAX_POLLING_TIME / 1000} seconds. The job is still processing in the background and may complete later.`);
}

/**
 * Service function to call the tailor-for-job API
 * 
 * @param cvText - The original CV text to be tailored
 * @param jobDescription - The job description to tailor the CV for
 * @param jobTitle - Optional job title for better context
 * @param cvId - The ID of the CV being tailored
 * @returns A promise that resolves to the tailored CV content and enhancements
 */
export async function tailorCVForJob(
  cvText: string,
  jobDescription: string,
  jobTitle?: string,
  cvId?: number
): Promise<{
  tailoredContent: string;
  enhancedProfile: string;
  sectionImprovements: Record<string, string>;
  success: boolean;
  error?: string;
  jobId?: string;
  industryInsights?: {
    industry: string;
    keySkills: string[];
    suggestedMetrics: string[];
    formatGuidance: string;
  };
}> {
  logger.info('Starting CV tailoring process');
  
  try {
    // Get industry-specific optimization guidance
    const industryInsights = getIndustryOptimizationGuidance(jobDescription);
    
    // Default empty result
    const defaultResult = {
      tailoredContent: '',
      enhancedProfile: '',
      sectionImprovements: {},
      success: false,
      error: 'Failed to tailor CV',
      industryInsights
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
    
    if (!cvId) {
      logger.error('Missing cvId parameter for tailorCVForJob');
      return {
        ...defaultResult,
        error: 'CV ID is required'
      };
    }
    
    // Start the tailoring job
    const response = await fetch('/api/cv/tailor-for-job', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        cvText,
        jobDescription,
        jobTitle,
        cvId,
        // Include industry insights for better tailoring
        industryInsights: {
          industry: industryInsights.industry || 'General',
          keySkills: Array.isArray(industryInsights.keySkills) ? industryInsights.keySkills : [],
          suggestedMetrics: Array.isArray(industryInsights.suggestedMetrics) ? industryInsights.suggestedMetrics : [],
          formatGuidance: industryInsights.formatGuidance || ''
        }
      }),
    });
    
    // Handle non-OK responses
    if (!response.ok) {
      const errorText = await response.text();
      logger.error(`Error starting tailoring job: ${response.status} - ${errorText}`);
      return {
        ...defaultResult,
        error: `API error: ${response.status} ${response.statusText}`
      };
    }
    
    // Parse response
    const data = await response.json() as TailorCVResponse;
    
    // Handle API-level failures
    if (!data.success || !data.jobId) {
      logger.error(`API reported failure: ${data.error || 'Unknown error'}`);
      return {
        ...defaultResult,
        error: data.error || 'Unknown error from API'
      };
    }
    
    // Poll for job completion
    try {
      const result = await pollJobStatus(data.jobId);
      
      // Return the successful result with industry insights
      return {
        tailoredContent: result.tailoredContent || cvText,
        enhancedProfile: result.enhancedProfile || '',
        sectionImprovements: result.sectionImprovements || {},
        success: true,
        jobId: data.jobId,
        industryInsights
      };
    } catch (pollError) {
      logger.error('Error polling for job completion:', pollError instanceof Error ? pollError.message : String(pollError));
      return {
        ...defaultResult,
        error: pollError instanceof Error ? pollError.message : 'Error during processing'
      };
    }
  } catch (error) {
    // Catch any unexpected errors
    logger.error('Error in tailorCVForJob:', error instanceof Error ? error.message : String(error));
    return {
      tailoredContent: '',
      enhancedProfile: '',
      sectionImprovements: {},
      success: false,
      error: error instanceof Error ? error.message : 'An unknown error occurred',
      industryInsights: getIndustryOptimizationGuidance(jobDescription)
    };
  }
} 