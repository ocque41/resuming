import { logger } from '@/lib/logger';
import { 
  OptimizationStage, 
  OptimizationState, 
  updateStage, 
  recordOptimizationError,
  hasCompletedStage
} from './progressiveOptimization';
import { 
  optimizeCVWithGPT4o, 
  optimizeCVWithGPT4oFallback,
  processCustomPromptWithGPT4o,
  isOpenAIAvailable,
  CVAnalysisResult
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
  options: { aiService?: 'auto' | 'openai' } = {}
): Promise<OptimizationState> {
  try {
    // Check if we have completed the analysis stage
    if (!hasCompletedStage(currentState, OptimizationStage.ANALYZE_COMPLETED)) {
      logger.warn(`Cannot run optimize stage for CV ${cvId} - analysis stage not completed`);
      return currentState;
    }
    
    // Check if OpenAI is available
    const openaiAvailable = await isOpenAIAvailable();
    if (!openaiAvailable) {
      logger.error('OpenAI service is not available');
      return recordOptimizationError(
        userId,
        cvId,
        jobDescription,
        'OpenAI service is not available',
        OptimizationStage.OPTIMIZE_STARTED
      );
    }
    
    // Mark the optimize stage as started
    let state = updateStage(currentState, OptimizationStage.OPTIMIZE_STARTED);
    
    // Run the optimization steps in sequence
    state = await optimizeProfileWithOpenAI(userId, cvId, jobDescription, cvText, state, preserveSections);
    state = await optimizeExperienceWithOpenAI(userId, cvId, jobDescription, cvText, state, preserveSections);
    state = await optimizeSkillsWithOpenAI(userId, cvId, jobDescription, cvText, state, preserveSections);
    state = await optimizeEducationWithOpenAI(userId, cvId, jobDescription, cvText, state, preserveSections);
    
    // Combine all optimized sections into a complete optimized CV
    state = await combineOptimizedSectionsWithOpenAI(userId, cvId, jobDescription, cvText, state, preserveSections);
    
    // Mark the optimize stage as completed
    state = updateStage(state, OptimizationStage.OPTIMIZE_COMPLETED);
    
    return state;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Error in optimize stage for CV ${cvId}: ${errorMessage}`);
    
    return recordOptimizationError(
      userId,
      cvId,
      jobDescription,
      errorMessage,
      OptimizationStage.OPTIMIZE_STARTED
    );
  }
}

/**
 * Optimize the profile section using OpenAI
 */
async function optimizeProfileWithOpenAI(
  userId: string,
  cvId: string,
  jobDescription: string,
  cvText: string,
  currentState: OptimizationState,
  preserveSections: Record<string, boolean>
): Promise<OptimizationState> {
  logger.info(`Optimizing profile for CV ${cvId}`);
  
  try {
    // Skip if profile optimization is disabled
    if (preserveSections.profile) {
      logger.info(`Profile optimization disabled for CV ${cvId}`);
      return currentState;
    }
    
    // Get the profile section from the analysis results
    const profileSection = currentState.results.sections?.find(
      section => section.name.toLowerCase().includes('profile') || 
                section.name.toLowerCase().includes('summary') ||
                section.name.toLowerCase().includes('objective')
    );
    
    if (!profileSection) {
      logger.warn(`No profile section found for CV ${cvId}`);
      return currentState;
    }
    
    // Use OpenAI to optimize the profile
    const prompt = `
      Optimize the following CV profile section to better match this job description:
      
      Job Description: ${jobDescription}
      
      Current Profile:
      ${profileSection.content}
      
      Please provide an optimized version that:
      1. Highlights relevant skills and experience
      2. Aligns with the job requirements
      3. Is concise and impactful
      4. Maintains the original tone and style
      
      Return only the optimized profile text without any explanations.
    `;
    
    const optimizedProfile = await processCustomPromptWithGPT4o(prompt);
    
    // Update the state with the optimized profile
    return updateStage(
      currentState,
      OptimizationStage.PROFILE_OPTIMIZED,
      { optimizedProfile: optimizedProfile.trim() }
    );
  } catch (error) {
    logger.error(`Error optimizing profile: ${error instanceof Error ? error.message : String(error)}`);
    return currentState;
  }
}

/**
 * Optimize the experience section using OpenAI
 */
async function optimizeExperienceWithOpenAI(
  userId: string,
  cvId: string,
  jobDescription: string,
  cvText: string,
  currentState: OptimizationState,
  preserveSections: Record<string, boolean>
): Promise<OptimizationState> {
  logger.info(`Optimizing experience for CV ${cvId}`);
  
  try {
    // Skip if experience optimization is disabled
    if (preserveSections.experience) {
      logger.info(`Experience optimization disabled for CV ${cvId}`);
      return currentState;
    }
    
    // Get the experience section from the analysis results
    const experienceSection = currentState.results.sections?.find(
      section => section.name.toLowerCase().includes('experience') || 
                section.name.toLowerCase().includes('work') ||
                section.name.toLowerCase().includes('employment')
    );
    
    if (!experienceSection) {
      logger.warn(`No experience section found for CV ${cvId}`);
      return currentState;
    }
    
    // Use OpenAI to optimize the experience section
    const prompt = `
      Optimize the following CV experience section to better match this job description:
      
      Job Description: ${jobDescription}
      
      Current Experience:
      ${experienceSection.content}
      
      Please provide an optimized version that:
      1. Highlights relevant achievements and responsibilities
      2. Uses action verbs and quantifiable results
      3. Aligns with the job requirements
      4. Maintains the original structure and chronology
      
      Return only the optimized experience text without any explanations.
    `;
    
    const optimizedExperience = await processCustomPromptWithGPT4o(prompt);
    
    // Split the optimized experience into separate entries
    const experienceEntries = optimizedExperience
      .split(/\n{2,}/)
      .filter(entry => entry.trim().length > 0);
    
    // Update the state with the optimized experience
    return updateStage(
      currentState,
      OptimizationStage.EXPERIENCE_OPTIMIZED,
      { optimizedExperience: experienceEntries }
    );
  } catch (error) {
    logger.error(`Error optimizing experience: ${error instanceof Error ? error.message : String(error)}`);
    return currentState;
  }
}

/**
 * Optimize the skills section using OpenAI
 */
async function optimizeSkillsWithOpenAI(
  userId: string,
  cvId: string,
  jobDescription: string,
  cvText: string,
  currentState: OptimizationState,
  preserveSections: Record<string, boolean>
): Promise<OptimizationState> {
  logger.info(`Optimizing skills for CV ${cvId}`);
  
  try {
    // Skip if skills optimization is disabled
    if (preserveSections.skills) {
      logger.info(`Skills optimization disabled for CV ${cvId}`);
      return currentState;
    }
    
    // Get the skills section from the analysis results
    const skillsSection = currentState.results.sections?.find(
      section => section.name.toLowerCase().includes('skill') || 
                section.name.toLowerCase().includes('competenc') ||
                section.name.toLowerCase().includes('qualificat')
    );
    
    // Get the skills from the analysis
    const skills = currentState.results.skills || [];
    
    // Use OpenAI to optimize the skills
    const prompt = `
      Optimize the following CV skills to better match this job description:
      
      Job Description: ${jobDescription}
      
      Current Skills:
      ${skillsSection ? skillsSection.content : skills.join(', ')}
      
      Please provide an optimized list of skills that:
      1. Prioritizes skills mentioned in the job description
      2. Includes both technical and soft skills
      3. Is organized in a clear and readable format
      4. Maintains authenticity (don't add skills not implied in the original)
      
      Return only the optimized skills as a list, with each skill on a new line.
    `;
    
    const optimizedSkillsText = await processCustomPromptWithGPT4o(prompt);
    
    // Parse the optimized skills into an array
    const optimizedSkills = optimizedSkillsText
      .split('\n')
      .map(skill => skill.replace(/^[-•*]\s*/, '').trim())
      .filter(skill => skill.length > 0);
    
    // Update the state with the optimized skills
    return updateStage(
      currentState,
      OptimizationStage.SKILLS_OPTIMIZED,
      { optimizedSkills }
    );
  } catch (error) {
    logger.error(`Error optimizing skills: ${error instanceof Error ? error.message : String(error)}`);
    return currentState;
  }
}

/**
 * Optimize the education section using OpenAI
 */
async function optimizeEducationWithOpenAI(
  userId: string,
  cvId: string,
  jobDescription: string,
  cvText: string,
  currentState: OptimizationState,
  preserveSections: Record<string, boolean>
): Promise<OptimizationState> {
  logger.info(`Optimizing education for CV ${cvId}`);
  
  try {
    // Skip if education optimization is disabled
    if (preserveSections.education) {
      logger.info(`Education optimization disabled for CV ${cvId}`);
      return currentState;
    }
    
    // Get the education section from the analysis results
    const educationSection = currentState.results.sections?.find(
      section => section.name.toLowerCase().includes('educat') || 
                section.name.toLowerCase().includes('academic') ||
                section.name.toLowerCase().includes('qualificat')
    );
    
    if (!educationSection) {
      logger.warn(`No education section found for CV ${cvId}`);
      return currentState;
    }
    
    // Use OpenAI to optimize the education section
    const prompt = `
      Optimize the following CV education section to better match this job description:
      
      Job Description: ${jobDescription}
      
      Current Education:
      ${educationSection.content}
      
      Please provide an optimized version that:
      1. Highlights relevant courses, projects, or achievements
      2. Emphasizes education aspects relevant to the job
      3. Maintains the original structure and chronology
      4. Is concise and focused
      
      Return only the optimized education text without any explanations.
    `;
    
    const optimizedEducation = await processCustomPromptWithGPT4o(prompt);
    
    // Split the optimized education into separate entries
    const educationEntries = optimizedEducation
      .split(/\n{2,}/)
      .filter(entry => entry.trim().length > 0);
    
    // Update the state with the optimized education
    return updateStage(
      currentState,
      OptimizationStage.EDUCATION_OPTIMIZED,
      { optimizedEducation: educationEntries }
    );
  } catch (error) {
    logger.error(`Error optimizing education: ${error instanceof Error ? error.message : String(error)}`);
    return currentState;
  }
}

/**
 * Combine all optimized sections into a complete optimized CV
 */
async function combineOptimizedSectionsWithOpenAI(
  userId: string,
  cvId: string,
  jobDescription: string,
  cvText: string,
  currentState: OptimizationState,
  preserveSections: Record<string, boolean>
): Promise<OptimizationState> {
  logger.info(`Combining optimized sections for CV ${cvId}`);
  
  try {
    // Get all the optimized sections
    const optimizedProfile = currentState.results.optimizedProfile;
    const optimizedExperience = currentState.results.optimizedExperience;
    const optimizedSkills = currentState.results.optimizedSkills;
    const optimizedEducation = currentState.results.optimizedEducation;
    
    // Get the original sections for reference
    const originalSections = currentState.results.sections || [];
    
    // Build the optimized content
    let optimizedContent = '';
    
    // Add profile section
    if (optimizedProfile) {
      optimizedContent += `# Professional Profile\n\n${optimizedProfile}\n\n`;
    } else {
      // Use the original profile section if available
      const originalProfile = originalSections.find(
        section => section.name.toLowerCase().includes('profile') || 
                  section.name.toLowerCase().includes('summary') ||
                  section.name.toLowerCase().includes('objective')
      );
      
      if (originalProfile) {
        optimizedContent += `# ${originalProfile.name}\n\n${originalProfile.content}\n\n`;
      }
    }
    
    // Add experience section
    if (optimizedExperience && optimizedExperience.length > 0) {
      optimizedContent += `# Professional Experience\n\n`;
      optimizedExperience.forEach(exp => {
        optimizedContent += `${exp}\n\n`;
      });
    } else {
      // Use the original experience section if available
      const originalExperience = originalSections.find(
        section => section.name.toLowerCase().includes('experience') || 
                  section.name.toLowerCase().includes('work') ||
                  section.name.toLowerCase().includes('employment')
      );
      
      if (originalExperience) {
        optimizedContent += `# ${originalExperience.name}\n\n${originalExperience.content}\n\n`;
      }
    }
    
    // Add skills section
    if (optimizedSkills && optimizedSkills.length > 0) {
      optimizedContent += `# Skills\n\n`;
      optimizedSkills.forEach(skill => {
        optimizedContent += `- ${skill}\n`;
      });
      optimizedContent += '\n';
    } else {
      // Use the original skills section if available
      const originalSkills = originalSections.find(
        section => section.name.toLowerCase().includes('skill') || 
                  section.name.toLowerCase().includes('competenc') ||
                  section.name.toLowerCase().includes('qualificat')
      );
      
      if (originalSkills) {
        optimizedContent += `# ${originalSkills.name}\n\n${originalSkills.content}\n\n`;
      }
    }
    
    // Add education section
    if (optimizedEducation && optimizedEducation.length > 0) {
      optimizedContent += `# Education\n\n`;
      optimizedEducation.forEach(edu => {
        optimizedContent += `${edu}\n\n`;
      });
    } else {
      // Use the original education section if available
      const originalEducation = originalSections.find(
        section => section.name.toLowerCase().includes('educat') || 
                  section.name.toLowerCase().includes('academic') ||
                  section.name.toLowerCase().includes('qualificat')
      );
      
      if (originalEducation) {
        optimizedContent += `# ${originalEducation.name}\n\n${originalEducation.content}\n\n`;
      }
    }
    
    // Add any remaining original sections that weren't optimized
    const optimizedSectionNames = ['profile', 'summary', 'objective', 'experience', 'work', 'employment', 
                                 'skill', 'competenc', 'qualificat', 'educat', 'academic'];
    
    originalSections.forEach(section => {
      const sectionNameLower = section.name.toLowerCase();
      const isAlreadyIncluded = optimizedSectionNames.some(name => 
        sectionNameLower.includes(name)
      );
      
      if (!isAlreadyIncluded) {
        optimizedContent += `# ${section.name}\n\n${section.content}\n\n`;
      }
    });
    
    // Calculate match score and generate recommendations
    const matchScore = await calculateMatchScore(optimizedContent, jobDescription);
    const recommendations = await generateRecommendations(optimizedContent, jobDescription);
    
    // Update the state with the combined optimized content
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
    logger.error(`Error combining optimized sections: ${error instanceof Error ? error.message : String(error)}`);
    return currentState;
  }
}

/**
 * Calculate the match score between the optimized CV and the job description
 */
async function calculateMatchScore(optimizedContent: string, jobDescription: string): Promise<number> {
  try {
    // Use OpenAI to calculate the match score
    const prompt = `
      Calculate a match score (0-100) between this CV and job description:
      
      Job Description:
      ${jobDescription}
      
      CV:
      ${optimizedContent}
      
      Analyze how well the CV matches the job requirements and return only a number between 0 and 100.
    `;
    
    const result = await processCustomPromptWithGPT4o(prompt);
    
    // Extract the score from the result
    const score = parseInt(result.trim(), 10);
    
    // Ensure the score is between 0 and 100
    return isNaN(score) ? 70 : Math.min(Math.max(score, 0), 100);
  } catch (error) {
    logger.error(`Error calculating match score: ${error instanceof Error ? error.message : String(error)}`);
    return 70; // Default score if calculation fails
  }
}

/**
 * Generate recommendations for further CV improvements
 */
async function generateRecommendations(optimizedContent: string, jobDescription: string): Promise<string[]> {
  try {
    // Use OpenAI to generate recommendations
    const prompt = `
      Generate 3-5 specific recommendations to further improve this CV for the job:
      
      Job Description:
      ${jobDescription}
      
      CV:
      ${optimizedContent}
      
      Provide actionable recommendations to better align the CV with the job requirements.
      Return each recommendation as a separate line.
    `;
    
    const result = await processCustomPromptWithGPT4o(prompt);
    
    // Split the result into separate recommendations
    return result
      .split('\n')
      .map(rec => rec.replace(/^[-•*]\s*/, '').trim())
      .filter(rec => rec.length > 0);
  } catch (error) {
    logger.error(`Error generating recommendations: ${error instanceof Error ? error.message : String(error)}`);
    return [
      'Add more quantifiable achievements',
      'Tailor your skills section to match job requirements',
      'Ensure your experience highlights relevant responsibilities'
    ]; // Default recommendations if generation fails
  }
} 