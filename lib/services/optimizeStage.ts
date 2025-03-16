import { logger } from '@/lib/logger';
import { 
  OptimizationStage, 
  OptimizationState, 
  updateStage, 
  recordOptimizationError,
  hasCompletedStage
} from './progressiveOptimization';
import { MistralRAGService } from '@/lib/utils/mistralRagService';
import { 
  optimizeCVWithGPT4o, 
  optimizeCVWithGPT4oFallback,
  processCustomPromptWithGPT4o
} from '@/lib/services/openai.service';

/**
 * Run the complete optimization stage
 */
export async function runOptimizeStage(
  userId: string,
  cvId: string,
  jobDescription: string,
  cvText: string,
  currentState: OptimizationState,
  preserveSections: Record<string, boolean> = {},
  options: { aiService?: 'auto' | 'openai' | 'mistral' } = {}
): Promise<OptimizationState> {
  try {
    // Check if we have completed the analysis stage
    if (!hasCompletedStage(currentState, OptimizationStage.ANALYZE_COMPLETED)) {
      logger.warn(`Cannot run optimize stage for CV ${cvId} - analysis stage not completed`);
      return currentState;
    }
    
    // Mark the optimize stage as started
    let state = updateStage(currentState, OptimizationStage.OPTIMIZE_STARTED);
    
    // Initialize the MistralRAGService if needed for analysis results
    const ragService = new MistralRAGService(options.aiService || 'auto');
    await ragService.processCVDocument(cvText);
    
    // Run the optimization steps in sequence
    state = await optimizeProfileStep(userId, cvId, jobDescription, cvText, state, ragService, preserveSections);
    state = await optimizeExperienceStep(userId, cvId, jobDescription, cvText, state, ragService, preserveSections);
    state = await optimizeSkillsStep(userId, cvId, jobDescription, cvText, state, ragService, preserveSections);
    state = await optimizeEducationStep(userId, cvId, jobDescription, cvText, state, ragService, preserveSections);
    
    // Combine all optimized sections into a complete optimized CV
    state = await combineOptimizedSectionsStep(userId, cvId, jobDescription, cvText, state, ragService, preserveSections);
    
    // Mark the optimize stage as completed
    state = updateStage(state, OptimizationStage.OPTIMIZE_COMPLETED);
    
    return state;
  } catch (error) {
    // Record the error and return the current state
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Error in optimize stage for CV ${cvId}: ${errorMessage}`);
    return recordOptimizationError(
      userId, 
      cvId, 
      jobDescription, 
      `Optimization failed: ${errorMessage}`,
      OptimizationStage.OPTIMIZE_STARTED
    );
  }
}

/**
 * Optimize the profile/summary section
 */
async function optimizeProfileStep(
  userId: string,
  cvId: string,
  jobDescription: string,
  cvText: string,
  currentState: OptimizationState,
  ragService: MistralRAGService,
  preserveSections: Record<string, boolean>
): Promise<OptimizationState> {
  try {
    logger.info(`Optimizing profile for CV ID: ${cvId}`);
    
    // Skip if we already have an optimized profile or if the section is preserved
    if (currentState.results.optimizedProfile || preserveSections['profile']) {
      logger.info(`Profile already optimized or preserved for CV ID: ${cvId}`);
      
      // If preserved, use the original profile from the analysis
      if (preserveSections['profile'] && !currentState.results.optimizedProfile) {
        const profileSection = currentState.results.sections?.find(
          section => section.name.toLowerCase().includes('profile') || 
                    section.name.toLowerCase().includes('summary') || 
                    section.name.toLowerCase().includes('objective')
        );
        
        if (profileSection) {
          return updateStage(
            currentState,
            OptimizationStage.PROFILE_OPTIMIZED,
            { optimizedProfile: profileSection.content }
          );
        }
      }
      
      return currentState;
    }
    
    // Get the profile section from the analysis results
    const profileSection = currentState.results.sections?.find(
      section => section.name.toLowerCase().includes('profile') || 
                section.name.toLowerCase().includes('summary') || 
                section.name.toLowerCase().includes('objective')
    );
    
    if (!profileSection) {
      logger.warn(`No profile section found for CV ID: ${cvId}`);
      return currentState;
    }
    
    // Optimize the profile section
    try {
      // Use OpenAI to optimize the profile
      const prompt = `
      I need to optimize this CV profile/summary section to better match the job description.
      
      Original Profile:
      ${profileSection.content}
      
      Job Description:
      ${jobDescription}
      
      Please rewrite the profile to:
      1. Highlight relevant skills and experience that match the job description
      2. Use strong action verbs and quantifiable achievements
      3. Keep it concise (3-5 sentences)
      4. Maintain the person's actual experience and qualifications (don't invent new ones)
      
      Return ONLY the optimized profile text, no explanations or formatting.
      `;
      
      const response = await processCustomPromptWithGPT4o(prompt, 0.3);
      const optimizedProfile = response.trim();
      
      logger.info(`Profile optimized for CV ID: ${cvId}`);
      
      // Update the state with the optimized profile
      return updateStage(
        currentState,
        OptimizationStage.PROFILE_OPTIMIZED,
        { optimizedProfile }
      );
    } catch (error) {
      logger.error(`Error optimizing profile: ${error instanceof Error ? error.message : String(error)}`);
      
      // Use the original profile as fallback
      return updateStage(
        currentState,
        OptimizationStage.PROFILE_OPTIMIZED,
        { optimizedProfile: profileSection.content }
      );
    }
  } catch (error) {
    // Log the error but continue with the process
    logger.error(`Error in profile optimization step: ${error instanceof Error ? error.message : String(error)}`);
    return currentState;
  }
}

/**
 * Optimize the experience section
 */
async function optimizeExperienceStep(
  userId: string,
  cvId: string,
  jobDescription: string,
  cvText: string,
  currentState: OptimizationState,
  ragService: MistralRAGService,
  preserveSections: Record<string, boolean>
): Promise<OptimizationState> {
  try {
    logger.info(`Optimizing experience for CV ID: ${cvId}`);
    
    // Skip if we already have optimized experience or if the section is preserved
    if (currentState.results.optimizedExperience || preserveSections['experience']) {
      logger.info(`Experience already optimized or preserved for CV ID: ${cvId}`);
      
      // If preserved, use the original experience from the analysis
      if (preserveSections['experience'] && !currentState.results.optimizedExperience) {
        const experienceSection = currentState.results.sections?.find(
          section => section.name.toLowerCase().includes('experience') || 
                    section.name.toLowerCase().includes('employment') || 
                    section.name.toLowerCase().includes('work history')
        );
        
        if (experienceSection) {
          return updateStage(
            currentState,
            OptimizationStage.EXPERIENCE_OPTIMIZED,
            { optimizedExperience: [experienceSection.content] }
          );
        }
      }
      
      return currentState;
    }
    
    // Get the experience section from the analysis results
    const experienceSection = currentState.results.sections?.find(
      section => section.name.toLowerCase().includes('experience') || 
                section.name.toLowerCase().includes('employment') || 
                section.name.toLowerCase().includes('work history')
    );
    
    if (!experienceSection) {
      logger.warn(`No experience section found for CV ID: ${cvId}`);
      return currentState;
    }
    
    // Optimize the experience section
    try {
      // Use OpenAI to optimize the experience
      const prompt = `
      I need to optimize this CV experience section to better match the job description.
      
      Original Experience:
      ${experienceSection.content}
      
      Job Description:
      ${jobDescription}
      
      Please rewrite the experience section to:
      1. Highlight achievements and responsibilities that are most relevant to the job
      2. Use strong action verbs and quantifiable results
      3. Incorporate relevant keywords from the job description
      4. Maintain the original job titles, companies, and dates
      5. Focus on the most relevant experience first
      
      Return ONLY the optimized experience text, preserving the original format but enhancing the content.
      `;
      
      const response = await processCustomPromptWithGPT4o(prompt, 0.3);
      const optimizedExperience = [response.trim()];
      
      logger.info(`Experience optimized for CV ID: ${cvId}`);
      
      // Update the state with the optimized experience
      return updateStage(
        currentState,
        OptimizationStage.EXPERIENCE_OPTIMIZED,
        { optimizedExperience }
      );
    } catch (error) {
      logger.error(`Error optimizing experience: ${error instanceof Error ? error.message : String(error)}`);
      
      // Use the original experience as fallback
      return updateStage(
        currentState,
        OptimizationStage.EXPERIENCE_OPTIMIZED,
        { optimizedExperience: [experienceSection.content] }
      );
    }
  } catch (error) {
    // Log the error but continue with the process
    logger.error(`Error in experience optimization step: ${error instanceof Error ? error.message : String(error)}`);
    return currentState;
  }
}

/**
 * Optimize the skills section
 */
async function optimizeSkillsStep(
  userId: string,
  cvId: string,
  jobDescription: string,
  cvText: string,
  currentState: OptimizationState,
  ragService: MistralRAGService,
  preserveSections: Record<string, boolean>
): Promise<OptimizationState> {
  try {
    logger.info(`Optimizing skills for CV ID: ${cvId}`);
    
    // Skip if we already have optimized skills or if the section is preserved
    if (currentState.results.optimizedSkills || preserveSections['skills']) {
      logger.info(`Skills already optimized or preserved for CV ID: ${cvId}`);
      
      // If preserved, use the original skills from the analysis
      if (preserveSections['skills'] && !currentState.results.optimizedSkills) {
        // Use extracted skills if available
        if (currentState.results.skills && currentState.results.skills.length > 0) {
          return updateStage(
            currentState,
            OptimizationStage.SKILLS_OPTIMIZED,
            { optimizedSkills: currentState.results.skills }
          );
        }
        
        // Otherwise, look for a skills section
        const skillsSection = currentState.results.sections?.find(
          section => section.name.toLowerCase().includes('skill') || 
                    section.name.toLowerCase().includes('competenc') || 
                    section.name.toLowerCase().includes('qualificat')
        );
        
        if (skillsSection) {
          // Split the skills section into individual skills
          const skills = skillsSection.content
            .split(/[,\n•\-]/)
            .map(skill => skill.trim())
            .filter(skill => skill.length > 0);
          
          return updateStage(
            currentState,
            OptimizationStage.SKILLS_OPTIMIZED,
            { optimizedSkills: skills }
          );
        }
      }
      
      return currentState;
    }
    
    // Get the skills from the analysis results
    const extractedSkills = currentState.results.skills || [];
    const skillsSection = currentState.results.sections?.find(
      section => section.name.toLowerCase().includes('skill') || 
                section.name.toLowerCase().includes('competenc') || 
                section.name.toLowerCase().includes('qualificat')
    );
    
    // Combine extracted skills and skills from the section
    let allSkills: string[] = [...extractedSkills];
    
    if (skillsSection) {
      // Split the skills section into individual skills
      const sectionSkills = skillsSection.content
        .split(/[,\n•\-]/)
        .map(skill => skill.trim())
        .filter(skill => skill.length > 0);
      
      // Add unique skills from the section
      sectionSkills.forEach(skill => {
        if (!allSkills.some(s => s.toLowerCase() === skill.toLowerCase())) {
          allSkills.push(skill);
        }
      });
    }
    
    if (allSkills.length === 0) {
      logger.warn(`No skills found for CV ID: ${cvId}`);
      return currentState;
    }
    
    // Optimize the skills
    try {
      // Use OpenAI to optimize the skills
      const prompt = `
      I need to optimize this list of skills to better match the job description.
      
      Original Skills:
      ${allSkills.join(', ')}
      
      Job Description:
      ${jobDescription}
      
      Please:
      1. Identify the most relevant skills for this job
      2. Prioritize technical skills that match the job requirements
      3. Include soft skills that are mentioned or implied in the job description
      4. Remove irrelevant skills
      5. Add any missing critical skills that the person likely has based on their experience
      
      Return ONLY a comma-separated list of the most relevant skills, no explanations.
      `;
      
      const response = await processCustomPromptWithGPT4o(prompt, 0.3);
      const optimizedSkills = response
        .split(',')
        .map(skill => skill.trim())
        .filter(skill => skill.length > 0);
      
      logger.info(`Skills optimized for CV ID: ${cvId}`);
      
      // Update the state with the optimized skills
      return updateStage(
        currentState,
        OptimizationStage.SKILLS_OPTIMIZED,
        { optimizedSkills }
      );
    } catch (error) {
      logger.error(`Error optimizing skills: ${error instanceof Error ? error.message : String(error)}`);
      
      // Use the original skills as fallback
      return updateStage(
        currentState,
        OptimizationStage.SKILLS_OPTIMIZED,
        { optimizedSkills: allSkills }
      );
    }
  } catch (error) {
    // Log the error but continue with the process
    logger.error(`Error in skills optimization step: ${error instanceof Error ? error.message : String(error)}`);
    return currentState;
  }
}

/**
 * Optimize the education section
 */
async function optimizeEducationStep(
  userId: string,
  cvId: string,
  jobDescription: string,
  cvText: string,
  currentState: OptimizationState,
  ragService: MistralRAGService,
  preserveSections: Record<string, boolean>
): Promise<OptimizationState> {
  try {
    logger.info(`Optimizing education for CV ID: ${cvId}`);
    
    // Skip if we already have optimized education or if the section is preserved
    if (currentState.results.optimizedEducation || preserveSections['education']) {
      logger.info(`Education already optimized or preserved for CV ID: ${cvId}`);
      
      // If preserved, use the original education from the analysis
      if (preserveSections['education'] && !currentState.results.optimizedEducation) {
        const educationSection = currentState.results.sections?.find(
          section => section.name.toLowerCase().includes('education') || 
                    section.name.toLowerCase().includes('academic') || 
                    section.name.toLowerCase().includes('qualification')
        );
        
        if (educationSection) {
          return updateStage(
            currentState,
            OptimizationStage.EDUCATION_OPTIMIZED,
            { optimizedEducation: [educationSection.content] }
          );
        }
      }
      
      return currentState;
    }
    
    // Get the education section from the analysis results
    const educationSection = currentState.results.sections?.find(
      section => section.name.toLowerCase().includes('education') || 
                section.name.toLowerCase().includes('academic') || 
                section.name.toLowerCase().includes('qualification')
    );
    
    if (!educationSection) {
      logger.warn(`No education section found for CV ID: ${cvId}`);
      return currentState;
    }
    
    // Optimize the education section
    try {
      // Use OpenAI to optimize the education
      const prompt = `
      I need to optimize this CV education section to better match the job description.
      
      Original Education:
      ${educationSection.content}
      
      Job Description:
      ${jobDescription}
      
      Please rewrite the education section to:
      1. Highlight degrees, courses, and qualifications most relevant to the job
      2. Emphasize relevant coursework or projects if mentioned
      3. Maintain the original institutions, degrees, and dates
      4. Format consistently
      
      Return ONLY the optimized education text, preserving the original format but enhancing the content.
      `;
      
      const response = await processCustomPromptWithGPT4o(prompt, 0.3);
      const optimizedEducation = [response.trim()];
      
      logger.info(`Education optimized for CV ID: ${cvId}`);
      
      // Update the state with the optimized education
      return updateStage(
        currentState,
        OptimizationStage.EDUCATION_OPTIMIZED,
        { optimizedEducation }
      );
    } catch (error) {
      logger.error(`Error optimizing education: ${error instanceof Error ? error.message : String(error)}`);
      
      // Use the original education as fallback
      return updateStage(
        currentState,
        OptimizationStage.EDUCATION_OPTIMIZED,
        { optimizedEducation: [educationSection.content] }
      );
    }
  } catch (error) {
    // Log the error but continue with the process
    logger.error(`Error in education optimization step: ${error instanceof Error ? error.message : String(error)}`);
    return currentState;
  }
}

/**
 * Combine all optimized sections into a complete optimized CV
 */
async function combineOptimizedSectionsStep(
  userId: string,
  cvId: string,
  jobDescription: string,
  cvText: string,
  currentState: OptimizationState,
  ragService: MistralRAGService,
  preserveSections: Record<string, boolean>
): Promise<OptimizationState> {
  try {
    logger.info(`Combining optimized sections for CV ID: ${cvId}`);
    
    // Skip if we already have optimized content
    if (currentState.results.optimizedContent) {
      logger.info(`Content already optimized for CV ID: ${cvId}`);
      return currentState;
    }
    
    // Get all the optimized sections
    const optimizedProfile = currentState.results.optimizedProfile || '';
    const optimizedExperience = currentState.results.optimizedExperience || [];
    const optimizedSkills = currentState.results.optimizedSkills || [];
    const optimizedEducation = currentState.results.optimizedEducation || [];
    
    // Get the original sections for any that weren't optimized
    const originalSections = currentState.results.sections || [];
    
    // Prepare the sections for the optimized CV
    const sections: Array<{ name: string; content: string }> = [];
    
    // Add the profile section
    if (optimizedProfile) {
      sections.push({
        name: 'Profile',
        content: optimizedProfile
      });
    } else {
      const profileSection = originalSections.find(
        section => section.name.toLowerCase().includes('profile') || 
                  section.name.toLowerCase().includes('summary') || 
                  section.name.toLowerCase().includes('objective')
      );
      
      if (profileSection) {
        sections.push(profileSection);
      }
    }
    
    // Add the experience section
    if (optimizedExperience.length > 0) {
      sections.push({
        name: 'Experience',
        content: optimizedExperience.join('\n\n')
      });
    } else {
      const experienceSection = originalSections.find(
        section => section.name.toLowerCase().includes('experience') || 
                  section.name.toLowerCase().includes('employment') || 
                  section.name.toLowerCase().includes('work history')
      );
      
      if (experienceSection) {
        sections.push(experienceSection);
      }
    }
    
    // Add the skills section
    if (optimizedSkills.length > 0) {
      sections.push({
        name: 'Skills',
        content: optimizedSkills.join(', ')
      });
    } else {
      const skillsSection = originalSections.find(
        section => section.name.toLowerCase().includes('skill') || 
                  section.name.toLowerCase().includes('competenc') || 
                  section.name.toLowerCase().includes('qualificat')
      );
      
      if (skillsSection) {
        sections.push(skillsSection);
      }
    }
    
    // Add the education section
    if (optimizedEducation.length > 0) {
      sections.push({
        name: 'Education',
        content: optimizedEducation.join('\n\n')
      });
    } else {
      const educationSection = originalSections.find(
        section => section.name.toLowerCase().includes('education') || 
                  section.name.toLowerCase().includes('academic') || 
                  section.name.toLowerCase().includes('qualification')
      );
      
      if (educationSection) {
        sections.push(educationSection);
      }
    }
    
    // Add any other sections from the original CV that weren't optimized
    originalSections.forEach(section => {
      const sectionName = section.name.toLowerCase();
      
      // Skip sections that were already added
      if (
        sectionName.includes('profile') || 
        sectionName.includes('summary') || 
        sectionName.includes('objective') ||
        sectionName.includes('experience') || 
        sectionName.includes('employment') || 
        sectionName.includes('work history') ||
        sectionName.includes('skill') || 
        sectionName.includes('competenc') || 
        sectionName.includes('qualificat') ||
        sectionName.includes('education') || 
        sectionName.includes('academic')
      ) {
        return;
      }
      
      // Add the section
      sections.push(section);
    });
    
    // Combine all sections into a single optimized CV
    const optimizedContent = sections
      .map(section => `${section.name.toUpperCase()}\n${section.content}`)
      .join('\n\n');
    
    // Calculate match score based on keyword matching
    const matchScore = await calculateMatchScore(optimizedContent, jobDescription);
    
    // Generate recommendations based on the optimized CV
    const recommendations = await generateRecommendations(optimizedContent, jobDescription);
    
    logger.info(`Combined optimized sections for CV ID: ${cvId}`);
    
    // Update the state with the optimized content
    return updateStage(
      currentState,
      OptimizationStage.OPTIMIZE_COMPLETED,
      { 
        optimizedContent,
        matchScore,
        recommendations
      }
    );
  } catch (error) {
    // Log the error but continue with the process
    logger.error(`Error combining optimized sections: ${error instanceof Error ? error.message : String(error)}`);
    
    // Create a fallback optimized content
    const sections = [];
    
    if (currentState.results.optimizedProfile) {
      sections.push(`PROFILE\n${currentState.results.optimizedProfile}`);
    }
    
    if (currentState.results.optimizedExperience && currentState.results.optimizedExperience.length > 0) {
      sections.push(`EXPERIENCE\n${currentState.results.optimizedExperience.join('\n\n')}`);
    }
    
    if (currentState.results.optimizedSkills && currentState.results.optimizedSkills.length > 0) {
      sections.push(`SKILLS\n${currentState.results.optimizedSkills.join(', ')}`);
    }
    
    if (currentState.results.optimizedEducation && currentState.results.optimizedEducation.length > 0) {
      sections.push(`EDUCATION\n${currentState.results.optimizedEducation.join('\n\n')}`);
    }
    
    const optimizedContent = sections.join('\n\n') || cvText;
    
    return updateStage(
      currentState,
      OptimizationStage.OPTIMIZE_COMPLETED,
      { 
        optimizedContent,
        matchScore: 0.5, // Default match score
        recommendations: ['Consider reviewing the optimized CV manually']
      }
    );
  }
}

/**
 * Calculate a match score between the optimized CV and the job description
 */
async function calculateMatchScore(optimizedContent: string, jobDescription: string): Promise<number> {
  try {
    // Use OpenAI to calculate a match score
    const prompt = `
    I need to calculate a match score between this CV and job description.
    
    CV:
    ${optimizedContent}
    
    Job Description:
    ${jobDescription}
    
    Please analyze how well the CV matches the job description, considering:
    1. Skills match
    2. Experience relevance
    3. Education requirements
    4. Overall fit
    
    Return ONLY a number between 0 and 1 representing the match score, where 1 is a perfect match and 0 is no match at all.
    `;
    
    const response = await processCustomPromptWithGPT4o(prompt, 0.1);
    const matchScore = parseFloat(response.trim());
    
    // Validate the match score
    if (isNaN(matchScore) || matchScore < 0 || matchScore > 1) {
      logger.warn(`Invalid match score: ${response}`);
      return 0.7; // Default reasonable score
    }
    
    return matchScore;
  } catch (error) {
    logger.error(`Error calculating match score: ${error instanceof Error ? error.message : String(error)}`);
    return 0.7; // Default reasonable score
  }
}

/**
 * Generate recommendations for further improvements
 */
async function generateRecommendations(optimizedContent: string, jobDescription: string): Promise<string[]> {
  try {
    // Use OpenAI to generate recommendations
    const prompt = `
    I need to generate recommendations for further improving this CV for the job.
    
    CV:
    ${optimizedContent}
    
    Job Description:
    ${jobDescription}
    
    Please provide 3-5 specific recommendations for improving the CV further to better match this job description.
    Focus on actionable advice that would make the CV more competitive for this specific role.
    
    Return ONLY a list of recommendations, one per line, no numbering or bullet points.
    `;
    
    const response = await processCustomPromptWithGPT4o(prompt, 0.3);
    const recommendations = response
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);
    
    return recommendations;
  } catch (error) {
    logger.error(`Error generating recommendations: ${error instanceof Error ? error.message : String(error)}`);
    return [
      'Add more quantifiable achievements to your experience',
      'Ensure your skills section highlights technical skills relevant to the job',
      'Tailor your profile summary to emphasize your fit for this specific role'
    ];
  }
} 