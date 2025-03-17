/**
 * Service for tailoring CVs using the Mistral AI integration
 */

/**
 * Tailors a CV for a specific job by calling the API
 * @param cvText The original CV text
 * @param jobDescription The job description text
 * @param jobTitle Optional job title
 * @returns A promise with the tailored CV content and other results
 */
export async function tailorCVForJob(
  cvText: string,
  jobDescription: string,
  jobTitle?: string
): Promise<{
  tailoredContent: string;
  enhancedProfile: string;
  sectionImprovements: Record<string, string>;
}> {
  // Call the tailor-for-job API endpoint
  const response = await fetch('/api/cv/tailor-for-job', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ cvText, jobDescription, jobTitle }),
  });
  
  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }
  
  const data = await response.json();
  if (!data.success) {
    throw new Error(data.error || 'API returned unsuccessful response');
  }
  
  return data.result;
} 